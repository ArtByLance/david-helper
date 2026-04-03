/**
 * Compute the Y target for the LED clock and line.
 *
 * Rules
 * -----
 * - countdown state: interpolate between previous event row and focal row
 * - happeningSoon state: snap to focal row center
 * - if no previous row exists, snap directly to focal row
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
  if (!layoutState.focalEvent) {
    return timeAnchoredY;
  }

  // For duplicate-time blocks, use the start anchor while approaching that time.
  let focalY = getEventY(layoutState.focalEvent, rowMap, "start");
  if (!isUsableY(focalY)) {
    focalY = timeAnchoredY;
  }
  if (layoutState.state === "happeningSoon") {
    return focalY;
  }

  let previousY = layoutState.previousEvent
    ? getEventY(layoutState.previousEvent, rowMap, "end")
    : (rowMap.get("__dayStart") ?? null);

  if (!isUsableY(previousY)) {
    previousY = rowMap.get("__dayStart") ?? 0;
  }

  if (!isUsableY(previousY)) {
    return focalY;
  }

  const blendedY =
    previousY + (focalY - previousY) * layoutState.progressFraction;
  return isUsableY(blendedY) ? blendedY : timeAnchoredY;
}

/**
 * Position the NOW pointer PNG to track the computed schedule Y.
 * The LED clock is now fixed on the photo device and does not move.
 *
 * @param {number} targetY
 */
export function positionTimeline(targetY) {
  const line = document.getElementById("timeline-line");
  const scheduleGroup = document.getElementById("today-text-group");
  const stage = document.getElementById("tv-stage");

  if (!line || !scheduleGroup || !stage) return;
  const rootStyle = getComputedStyle(document.documentElement);
  const localYOffset =
    Number.parseFloat(rootStyle.getPropertyValue("--now-flag-local-y")) || 0;
  const localRotate =
    rootStyle.getPropertyValue("--now-flag-rotate").trim() || "0deg";
  const groupRect = scheduleGroup.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const halfFlag = line.offsetHeight / 2;

  // Hard visual clamp in pixels so the flag never goes off-screen.
  const minCenterY = halfFlag;
  const maxCenterY = Math.max(
    minCenterY,
    stageRect.bottom - groupRect.top - halfFlag,
  );
  const clampedCenterY = clamp(targetY, minCenterY, maxCenterY);
  const lineOffset = clampedCenterY - halfFlag + localYOffset;

  line.style.transform = `translateY(${lineOffset}px) rotate(${localRotate})`;
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

  // Fallback: measure the rendered row directly.
  const group = document.getElementById("today-text-group");
  if (!group) return 0;
  const groupRect = group.getBoundingClientRect();

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
  const rowRect = row.getBoundingClientRect();
  return rowRect.top - groupRect.top + rowRect.height / 2;
}

/**
 * For times with no focal event (before first or after last),
 * use fixed day anchors:
 * - 5:00 AM => day-start anchor
 * - 11:00 PM and later => screen bottom
 *
 * @param {number} nowMinutes
 * @param {Map<string, number>} rowMap
 * @returns {number}
 */
function getTimeAnchoredY(nowMinutes, rowMap) {
  let startY = rowMap.get("__dayStart");
  let endY = rowMap.get("__screenBottom");

  if (!isUsableY(startY) || !isUsableY(endY) || endY <= startY) {
    const section = document.getElementById("today-section");
    const group = document.getElementById("today-text-group");
    const stage = document.getElementById("tv-stage");

    if (section && group) {
      const groupRect = group.getBoundingClientRect();
      startY = 0;
      endY = group.clientHeight || section.clientHeight;

      if (stage) {
        const stageRect = stage.getBoundingClientRect();
        endY = stageRect.bottom - groupRect.top;
      }
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

  const dayStart = 5 * 60;
  const dayEnd = 23 * 60;
  const t = clamp((now - dayStart) / (dayEnd - dayStart), 0, 1);
  return startY + (endY - startY) * t;
}

/**
 * @param {number | null | undefined} value
 * @returns {boolean}
 */
function isUsableY(value) {
  return Number.isFinite(value) && Number(value) >= 0;
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
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
