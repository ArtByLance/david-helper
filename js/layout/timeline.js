const SHOW_TIMELINE_DEBUG = false;

/**
 * Compute the NOW target Y inside the schedule's local coordinate space.
 *
 * Most of the day, the marker follows the time ruler.
 * During the happening-soon window, it snaps to the focal event row instead.
 *
 * @param {{
 *   state: 'countdown' | 'happeningSoon',
 *   previousEvent: any | null,
 *   focalEvent: any | null,
 *   nowMinutes: number,
 *   progressFraction: number
 * }} layoutState
 * @param {Map<string, number>} rowMap
 * @returns {number}
 */
export function getTargetY(layoutState, rowMap) {
  const timeAnchoredY = getTimeAnchoredY(layoutState.nowMinutes, rowMap);
  if (!layoutState.focalEvent || layoutState.state !== "happeningSoon") {
    return timeAnchoredY;
  }

  // Shared-time blocks should point at the top of the cluster.
  let focalY = getEventY(layoutState.focalEvent, rowMap, "start");
  if (!isUsableY(focalY)) {
    focalY = timeAnchoredY;
  }
  return focalY;
}

/**
 * Position the NOW pointer PNG to track the computed schedule Y.
 * The LED clock is now fixed on the photo device and does not move.
 *
 * @param {number} targetY
 */
export function positionTimeline(targetY) {
  const line = document.getElementById("timeline-line");

  if (!line) return;
  const rootStyle = getComputedStyle(document.documentElement);
  const localRotate = rootStyle.getPropertyValue("--now-flag-rotate").trim() || "0deg";
  const rotationDegrees = Number.parseFloat(localRotate) || 0;
  const rotationRadians = (rotationDegrees * Math.PI) / 180;
  const tipXOffset = readCssNumber(rootStyle, "--now-flag-tip-x-offset", line.offsetWidth);
  const tipYOffset = readCssNumber(rootStyle, "--now-flag-tip-y-offset", line.offsetHeight / 2);
  const targetYNudge = readCssNumber(rootStyle, "--now-flag-target-y-nudge", 0);
  const centerX = line.offsetWidth / 2;
  const centerY = line.offsetHeight / 2;
  const rotatedTipYOffset =
    centerY +
    Math.sin(rotationRadians) * (tipXOffset - centerX) +
    Math.cos(rotationRadians) * (tipYOffset - centerY);

  // Let the full-day ruler extend beyond the visible paper.
  // Midnight and late-night positions can live just off-screen.
  const lineOffset = targetY + targetYNudge - rotatedTipYOffset;

  line.style.transform = `translateY(${lineOffset}px) rotate(${localRotate})`;
}

/**
 * Draw temporary guide lines so we can see the timeline math on the paper.
 *
 * This is intentionally loud and obvious while we debug.
 *
 * @param {Map<string, number>} rowMap
 * @param {number} targetY
 */
export function renderTimelineDebug(rowMap, targetY) {
  const group = document.getElementById("today-text-group");
  if (!group) return;

  if (!SHOW_TIMELINE_DEBUG) {
    const existingLayer = document.getElementById("timeline-debug-layer");
    if (existingLayer) existingLayer.remove();
    return;
  }

  let layer = document.getElementById("timeline-debug-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.id = "timeline-debug-layer";
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "20";
    group.appendChild(layer);
  }

  layer.innerHTML = "";

  const guides = [
    { label: "TOP", y: rowMap.get("__dayStart"), color: "#00e5ff" },
    { label: "FIRST EVENT", y: rowMap.get("__firstEventY"), color: "#7c4dff" },
    { label: "BOTTOM", y: rowMap.get("__screenBottom"), color: "#ff9800" },
    { label: "NOW TARGET", y: targetY, color: "#ff1744" },
  ];

  for (const [key, value] of rowMap.entries()) {
    if (!key.startsWith("__m:")) continue;
    const minute = Number(key.slice(4));
    if (!Number.isFinite(minute) || !Number.isFinite(value)) continue;
    guides.push({
      label: minuteToLabel(minute),
      y: value,
      color: "#7cff7c",
    });
  }

  const seen = new Set();
  for (const guide of guides) {
    if (!Number.isFinite(guide.y)) continue;
    const dedupeKey = `${guide.label}|${guide.y}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    layer.appendChild(makeGuideLine(guide.label, Number(guide.y), guide.color));
  }
}

function toEventKey(event) {
  if (!event) return "";
  return `${event.time ?? ""}|${event.label ?? ""}`;
}

/**
 * @param {any} event
 * @param {Map<string, number>} rowMap
 * @param {'center' | 'start' | 'end'} [anchor]
 * @returns {number}
 */
function getEventY(event, rowMap, anchor = "center") {
  if (!event) return 0;
  const minuteKey = String(event.timeMinutes);
  const clusterStart = rowMap.get(`__clusterStart:${minuteKey}`);
  const clusterEnd = rowMap.get(`__clusterEnd:${minuteKey}`);
  const clusterCenter = rowMap.get(`__cluster:${minuteKey}`);

  if (anchor === "start" && Number.isFinite(clusterStart)) {
    return Number(clusterStart);
  }
  if (anchor === "end" && Number.isFinite(clusterEnd)) {
    return Number(clusterEnd);
  }
  if (anchor === "center" && Number.isFinite(clusterCenter)) {
    return Number(clusterCenter);
  }

  const mappedY =
    rowMap.get(`__cluster:${event.timeMinutes}`) ??
    rowMap.get(toEventKey(event)) ??
    rowMap.get(event.time) ??
    rowMap.get(`__m:${event.timeMinutes}`);

  if (Number.isFinite(mappedY) && mappedY > 0) {
    return mappedY;
  }

  // Fallback: measure the row directly in local layout coordinates.
  const group = document.getElementById("today-text-group");
  if (!group) return 0;

  const exactSelector = `.today-event-row[data-event-key="${cssEscape(
    toEventKey(event),
  )}"]`;
  let row = document.querySelector(exactSelector);

  if (!row && event.time) {
    row = document.querySelector(
      `.today-event-row[data-time="${cssEscape(event.time)}"]`,
    );
  }

  if (!row) return 0;
  return getOffsetWithinAncestor(row, group) + row.offsetHeight / 2;
}

/**
 * Build the full-day time ruler for the schedule paper.
 *
 * Key anchors:
 * - 00:00 -> TOP
 * - first event -> first event row
 * - in-between events -> row-to-row interpolation
 * - last event -> last event row
 * - 23:59 -> BOTTOM
 *
 * @param {number} nowMinutes
 * @param {Map<string, number>} rowMap
 * @returns {number}
 */
function getTimeAnchoredY(nowMinutes, rowMap) {
  let startY = rowMap.get("__dayStart");
  let endY = rowMap.get("__screenBottom");
  const firstMinute = rowMap.get("__firstEventMinute");
  const firstY = rowMap.get("__firstEventY");
  const lastMinute = rowMap.get("__lastEventMinute");
  const lastY = rowMap.get("__lastEventY");

  if (!isUsableY(startY) || !isUsableY(endY) || endY <= startY) {
    const section = document.getElementById("today-section");
    const group = document.getElementById("today-text-group");

    if (section && group) {
      startY = getOffsetWithinAncestor(section.querySelector("#today-panel"), group);
      endY = group.clientHeight || section.clientHeight;
    }
  }

  if (!isUsableY(startY)) startY = 0;
  if (!isUsableY(endY) || endY <= startY) {
    endY = Math.max(startY + 1, 600);
  }

  const now = Number(nowMinutes);
  if (!Number.isFinite(now)) {
    return startY;
  }

  // Midnight must land on the exact TOP anchor with no interpolation.
  if (now <= 0) {
    return startY;
  }

  // Treat the midnight-to-first-event span as its own exact segment.
  // This guarantees 00:00 lands on TOP and the first event lands on its row.
  if (
    Number.isFinite(firstMinute) &&
    Number.isFinite(firstY) &&
    firstMinute > 0 &&
    now <= firstMinute
  ) {
    const t = clamp(now / firstMinute, 0, 1);
    return startY + (firstY - startY) * t;
  }

  // After the last event, keep mapping real clock time through the final
  // stretch of the day so the marker can travel from the last row to BOTTOM.
  if (
    Number.isFinite(lastMinute) &&
    Number.isFinite(lastY) &&
    lastMinute < (24 * 60) - 1 &&
    now >= lastMinute
  ) {
    const span = Math.max(1, ((24 * 60) - 1) - lastMinute);
    const t = clamp((now - lastMinute) / span, 0, 1);
    return lastY + (endY - lastY) * t;
  }

  const anchors = getTimeAnchors(rowMap, startY, endY);
  if (!anchors.length) {
    return startY;
  }

  if (now <= anchors[0].minute) {
    return anchors[0].y;
  }

  for (let index = 1; index < anchors.length; index += 1) {
    const previous = anchors[index - 1];
    const next = anchors[index];

    if (now <= next.minute) {
      const span = Math.max(1, next.minute - previous.minute);
      const t = clamp((now - previous.minute) / span, 0, 1);
      return previous.y + (next.y - previous.y) * t;
    }
  }

  return anchors[anchors.length - 1].y;
}

/**
 * @param {number | null | undefined} value
 * @returns {boolean}
 */
function isUsableY(value) {
  return Number.isFinite(value);
}

/**
 * @param {CSSStyleDeclaration} styles
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function readCssNumber(styles, name, fallback) {
  const parsed = Number.parseFloat(styles.getPropertyValue(name));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Minimal CSS.escape fallback for attribute selectors.
 * @param {string} value
 * @returns {string}
 */
function cssEscape(value) {
  const source = String(value ?? "");
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(source);
  }
  return source.replace(/["\\]/g, "\\$&");
}

/**
 * Return how far down an element sits within an ancestor before transforms.
 *
 * @param {Element | null} element
 * @param {HTMLElement} ancestor
 * @returns {number}
 */
function getOffsetWithinAncestor(element, ancestor) {
  let offset = 0;
  let current = /** @type {HTMLElement | null} */ (element);

  while (current && current !== ancestor) {
    offset += current.offsetTop || 0;
    current = /** @type {HTMLElement | null} */ (current.offsetParent);
  }

  return current === ancestor ? offset : 0;
}

/**
 * Build a simple time-to-Y ruler for the day.
 *
 * We use:
 * - top of paper at midnight
 * - each schedule row at its own event time
 * - bottom of paper at 11:59 PM
 *
 * That gives the NOW flag a consistent "where should this be at this clock
 * time?" answer without depending on whichever event happens to be focal.
 *
 * @param {Map<string, number>} rowMap
 * @param {number} startY
 * @param {number} endY
 * @returns {{ minute: number, y: number }[]}
 */
function getTimeAnchors(rowMap, startY, endY) {
  const anchors = [{ minute: 0, y: startY }];

  for (const [key, value] of rowMap.entries()) {
    if (!key.startsWith("__m:") || !isUsableY(value)) continue;
    const minute = Number(key.slice(4));
    if (!Number.isFinite(minute)) continue;
    anchors.push({ minute, y: Number(value) });
  }

  anchors.push({ minute: (24 * 60) - 1, y: endY });

  anchors.sort((a, b) => a.minute - b.minute);

  const deduped = [];
  for (const anchor of anchors) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.minute === anchor.minute) {
      previous.y = anchor.y;
    } else {
      deduped.push(anchor);
    }
  }

  return deduped;
}

/**
 * @param {string} label
 * @param {number} y
 * @param {string} color
 * @returns {HTMLDivElement}
 */
function makeGuideLine(label, y, color) {
  const line = document.createElement("div");
  line.style.position = "absolute";
  line.style.left = "0";
  line.style.right = "0";
  line.style.top = `${Math.round(y)}px`;
  line.style.borderTop = `2px dashed ${color}`;
  line.style.opacity = "0.95";

  const tag = document.createElement("div");
  tag.textContent = label;
  tag.style.position = "absolute";
  tag.style.right = "6px";
  tag.style.top = "-14px";
  tag.style.padding = "1px 4px";
  tag.style.background = color;
  tag.style.color = "#111";
  tag.style.font = "700 12px/1 monospace";
  tag.style.borderRadius = "3px";
  tag.style.boxShadow = "0 0 0 1px rgba(0,0,0,0.2)";

  line.appendChild(tag);
  return line;
}

/**
 * @param {number} minute
 * @returns {string}
 */
function minuteToLabel(minute) {
  const hours24 = Math.floor(minute / 60);
  const minutes = minute % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")}`;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
