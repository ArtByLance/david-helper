/**
 * Render the LED clock.
 *
 * @param {{ ledClock: HTMLElement }} dom
 * @param {{ clockText?: string }} vm
 */
export function renderClock(dom, vm) {
  const rawClock = String(vm.clockText ?? "");
  const [rawHours = "", rawMinutes = ""] = rawClock.split(":");
  const hours = (rawHours.trim().replace(/^0+(?=\d)/, "") || "0").slice(-2);
  const minutes = rawMinutes.trim().padStart(2, "0").slice(-2);
  drawLedClock(dom.ledClock, hours, minutes);
  dom.ledClock.setAttribute("aria-label", `Current time ${hours}:${minutes}`);
}

/**
 * Draw clock text in canvas using actual glyph bounds so spacing is based
 * on the rendered character edges instead of DOM text boxes.
 *
 * @param {HTMLElement} host
 * @param {string} hours
 * @param {string} minutes
 */
function drawLedClock(host, hours, minutes) {
  if (!host) return;

  const text = `${hours}:${minutes}`;
  let canvas = host.querySelector("canvas.clock-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.className = "clock-canvas";
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

  const style = getComputedStyle(host);
  const fontSize = style.fontSize || "84px";
  const fontWeight = style.fontWeight || "700";
  const fontFamily = style.fontFamily || "sans-serif";
  const fontSizePx = Number.parseFloat(fontSize) || 84;
  const letterSpacingPx = Number.parseFloat(style.letterSpacing || "0") || 0;
  let scaledFontPx = Math.max(1, fontSizePx * 0.84);
  ctx.fillStyle = style.color || "#ff1f1f";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  let layout = null;

  for (let i = 0; i < 8; i += 1) {
    ctx.font = `${fontWeight} ${scaledFontPx}px ${fontFamily}`;
    layout = measureClockRun(ctx, text, letterSpacingPx);
    const textWidth = layout.width;
    const textHeight = layout.ascent + layout.descent;
    if (textWidth <= width * 0.95 && textHeight <= height * 0.9) {
      break;
    }
    scaledFontPx *= 0.92;
  }

  if (!layout) return;

  const offsetX = (width - layout.width) / 2;
  const baselineY =
    (height - (layout.ascent + layout.descent)) / 2 + layout.ascent + 1;
  ctx.font = `${fontWeight} ${scaledFontPx}px ${fontFamily}`;

  for (const run of layout.runs) {
    ctx.fillText(run.char, offsetX + run.x, baselineY);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} letterSpacingPx
 * @returns {{ runs: { char: string, x: number }[], width: number, ascent: number, descent: number }}
 */
function measureClockRun(ctx, text, letterSpacingPx) {
  const runs = [];
  let x = 0;
  let ascent = 0;
  let descent = 0;
  const chars = Array.from(text);

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const metrics = ctx.measureText(char);
    const charAscent = Number.isFinite(metrics.actualBoundingBoxAscent)
      ? metrics.actualBoundingBoxAscent
      : 0;
    const charDescent = Number.isFinite(metrics.actualBoundingBoxDescent)
      ? metrics.actualBoundingBoxDescent
      : 0;
    ascent = Math.max(ascent, charAscent);
    descent = Math.max(descent, charDescent);
    runs.push({ char, x });
    x += metrics.width;
    if (i < chars.length - 1) {
      x += letterSpacingPx;
    }
  }

  return {
    runs,
    width: x,
    ascent,
    descent,
  };
}
