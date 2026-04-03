/**
 * exit-prompt.js
 * ==============
 *
 * Standalone renderer for the top-right exit prompt.
 * Supports lightweight inline markup:
 *   - <b>...</b> => bold run
 *
 * Draws text using canvas glyph bounds so centering is based on ink,
 * not line-box metrics.
 */

/**
 * Render the exit prompt centered in #top-prompt.
 *
 * @param {string} text
 */
export function renderExitPrompt(text) {
  const host = document.getElementById("top-prompt");
  if (!host) return;

  const source = String(text || "").trim();
  const runs = parsePromptRuns(source);
  const plainText = runs.map((run) => run.text).join("");
  host.setAttribute("aria-label", plainText || "Exit prompt");

  let canvas = host.querySelector("canvas.prompt-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "prompt-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.innerHTML = "";
    host.appendChild(canvas);
  }

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(host.clientWidth));
  const height = Math.max(1, Math.round(host.clientHeight));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (!runs.length) return;

  const style = getComputedStyle(host);
  const fontSize = style.fontSize || "40px";
  const baseWeight = style.fontWeight || "400";
  const boldWeight = "900";
  const fontFamily = style.fontFamily || "Arial, sans-serif";
  const sizePx = Number.parseFloat(fontSize) || 40;

  ctx.fillStyle = style.color || "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  let cursorX = 0;
  let minInkLeft = Infinity;
  let maxInkRight = -Infinity;
  let maxAscent = 0;
  let maxDescent = 0;

  for (const run of runs) {
    const weight = run.bold ? boldWeight : baseWeight;
    ctx.font = `${weight} ${fontSize} ${fontFamily}`;
    const m = ctx.measureText(run.text);
    const left = Number.isFinite(m.actualBoundingBoxLeft)
      ? m.actualBoundingBoxLeft
      : 0;
    const right = Number.isFinite(m.actualBoundingBoxRight)
      ? m.actualBoundingBoxRight
      : m.width;
    const ascent = Number.isFinite(m.actualBoundingBoxAscent)
      ? m.actualBoundingBoxAscent
      : sizePx * 0.75;
    const descent = Number.isFinite(m.actualBoundingBoxDescent)
      ? m.actualBoundingBoxDescent
      : sizePx * 0.25;

    run.originX = cursorX;
    run.weight = weight;
    run.inkLeft = cursorX - left;
    run.inkRight = cursorX + right;

    minInkLeft = Math.min(minInkLeft, run.inkLeft);
    maxInkRight = Math.max(maxInkRight, run.inkRight);
    maxAscent = Math.max(maxAscent, ascent);
    maxDescent = Math.max(maxDescent, descent);
    cursorX += m.width;
  }

  const inkWidth = Math.max(1, maxInkRight - minInkLeft);
  const promptOffsetX = -8;
  const promptOffsetY = 8;
  const originX = (width - inkWidth) / 2 - minInkLeft + promptOffsetX;
  const baselineY =
    (height - (maxAscent + maxDescent)) / 2 + maxAscent + promptOffsetY;

  for (const run of runs) {
    ctx.font = `${run.weight} ${fontSize} ${fontFamily}`;
    ctx.fillText(run.text, originX + run.originX, baselineY);
  }
}

/**
 * Parse prompt string and support <b>...</b> emphasis.
 *
 * @param {string} source
 * @returns {{ text: string, bold: boolean, originX?: number, weight?: string, inkLeft?: number, inkRight?: number }[]}
 */
function parsePromptRuns(source) {
  if (!source) return [];

  const runs = [];
  const re = /<b>(.*?)<\/b>/gi;
  let lastIndex = 0;
  let match = re.exec(source);
  while (match) {
    const matchStart = match.index;
    if (matchStart > lastIndex) {
      runs.push({ text: source.slice(lastIndex, matchStart), bold: false });
    }
    runs.push({ text: match[1], bold: true });
    lastIndex = matchStart + match[0].length;
    match = re.exec(source);
  }
  if (lastIndex < source.length) {
    runs.push({ text: source.slice(lastIndex), bold: false });
  }

  return runs.filter((run) => run.text.length > 0);
}
