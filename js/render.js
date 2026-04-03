/**
 * render.js
 * =========
 *
 * DOM updates only.
 *
 * Important design choice
 * -----------------------
 * All rendering should be driven by a single view model assembled in main.js.
 * That keeps this file focused and easy to reason about.
 */

/** @param {Document} root */
function getDom(root = document) {
  return {
    dayLabel: root.getElementById("day-label"),
    dateLabel: root.getElementById("date-label"),

    nextLabel: root.getElementById("next-label"),
    nextTime: root.getElementById("next-time"),
    nextSecondary: root.getElementById("next-secondary"),

    countdownText: root.getElementById("countdown-text"),
    progressShell: root.getElementById("progress-shell"),
    progressFill: root.getElementById("progress-fill"),
    happeningSoonSticker: root.getElementById("happening-soon-sticker"),

    help1: root.getElementById("help1"),
    help2: root.getElementById("help2"),
    encouragementNoteText: root.getElementById("encouragement-note-text"),

    ledClock: root.getElementById("led-clock"),
    todayEvents: root.getElementById("today-events"),
  };
}

/**
 * Render the entire screen from one view model.
 *
 * @param {any} viewModel
 */
export function renderView(viewModel) {
  const dom = getDom();

  renderHeader(dom, viewModel);
  renderNextCard(dom, viewModel);
  renderHelpText(dom, viewModel);
  renderEncouragementNote(dom, viewModel);
  renderClock(dom, viewModel);
  renderTodayList(dom, viewModel);
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderHeader(dom, vm) {
  dom.dayLabel.textContent = vm.dayLabel;
  dom.dateLabel.textContent = vm.dateLabel;
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderNextCard(dom, vm) {
  dom.nextLabel.textContent = vm.nextLabel || "";
  dom.nextTime.textContent = vm.nextTime || "";
  dom.nextSecondary.textContent = vm.nextSecondary || "";
  dom.nextSecondary.classList.toggle("hidden", !vm.nextSecondary);

  // Reset visibility first so only one state can be shown at a time.
  dom.countdownText.classList.add("hidden");
  dom.progressShell.classList.add("hidden");
  dom.happeningSoonSticker.hidden = true;
  dom.happeningSoonSticker.classList.add("hidden");

  if (vm.showHappeningSoon) {
    dom.happeningSoonSticker.hidden = false;
    dom.happeningSoonSticker.classList.remove("hidden");
    dom.countdownText.textContent = "";
    return;
  }

  if (vm.showProgress) {
    dom.countdownText.classList.remove("hidden");
    dom.progressShell.classList.remove("hidden");
    renderCountdownText(dom.countdownText, vm.countdownText || "");
    const remainingPercent = Math.max(
      0,
      Math.min(100, 100 - Math.round(vm.progressFraction * 100)),
    );
    dom.progressFill.style.width = `${remainingPercent}%`;
  }
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderHelpText(dom, vm) {
  dom.help1.textContent = vm.help1 || "";
  dom.help2.textContent = vm.help2 || "";
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderEncouragementNote(dom, vm) {
  dom.encouragementNoteText.textContent = vm.encouragementNote || "";
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderClock(dom, vm) {
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

  // Simple fixed-width style rendering: keep natural per-character widths
  // and apply uniform extra spacing between characters.
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

/**
 * Rebuild the TODAY list every tick.
 * For this app, the list is small, so the simplicity is worth it.
 *
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderTodayList(dom, vm) {
  dom.todayEvents.innerHTML = "";

  for (const item of vm.todayEvents) {
    const row = document.createElement("div");
    row.className = "today-event-row";
    row.dataset.eventKey = item.eventKey ?? `${item.time}|${item.label}`;
    row.dataset.time = item.time;
    row.dataset.timeMinutes = String(item.timeMinutes ?? "");
    row.dataset.past = String(item.isPast);
    row.dataset.focal = String(item.isFocal);
    row.dataset.clustered = String(item.isClustered);
    row.style.position = "absolute";
    row.style.left = "0";
    row.style.right = "0";

    const time = document.createElement("div");
    time.className = "today-time";
    time.textContent = item.timeDisplay;

    const label = document.createElement("div");
    label.className = "today-label";
    label.textContent = item.label;

    row.appendChild(time);
    row.appendChild(label);
    dom.todayEvents.appendChild(row);
  }
}

/**
 * Render countdown as semantic tokens so numbers can be visually emphasized.
 *
 * @param {HTMLElement} target
 * @param {string} countdownText
 */
function renderCountdownText(target, countdownText) {
  const text = String(countdownText || "").trim();
  target.innerHTML = "";
  if (!text) return;

  // Examples handled:
  // "3 hours and 28 minutes to go"
  // "45 minutes to go"
  // "1 minute to go"
  const twoUnitMatch = text.match(
    /^(\d+)\s+(hour|hours)\s+and\s+(\d+)\s+(minute|minutes)\s+to\s+go$/i,
  );
  if (twoUnitMatch) {
    appendToken(target, twoUnitMatch[1], "count-num");
    appendToken(target, ` ${twoUnitMatch[2]} `, "count-unit");
    appendToken(target, twoUnitMatch[3], "count-num");
    appendToken(target, ` ${twoUnitMatch[4]}`, "count-tail");
    return;
  }

  const oneUnitMatch = text.match(/^(\d+)\s+(minute|minutes)\s+to\s+go$/i);
  if (oneUnitMatch) {
    appendToken(target, oneUnitMatch[1], "count-num");
    appendToken(target, ` ${oneUnitMatch[2]}`, "count-tail");
    return;
  }

  const oneHourMatch = text.match(/^(\d+)\s+(hour|hours)\s+to\s+go$/i);
  if (oneHourMatch) {
    appendToken(target, oneHourMatch[1], "count-num");
    appendToken(target, ` ${oneHourMatch[2]}`, "count-tail");
    return;
  }

  // Fallback to plain content if the format evolves.
  target.textContent = text.replace(/\s+to\s+go$/i, "");
}

/**
 * @param {HTMLElement} target
 * @param {string} text
 * @param {string} className
 */
function appendToken(target, text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  target.appendChild(span);
}
