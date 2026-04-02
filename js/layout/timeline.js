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
  if (!layoutState.focalEvent) return 0;

  const focalY =
    rowMap.get(toEventKey(layoutState.focalEvent)) ??
    rowMap.get(layoutState.focalEvent.time) ??
    0;
  if (layoutState.state === 'happeningSoon') {
    return focalY;
  }

  const previousY = layoutState.previousEvent
    ? rowMap.get(toEventKey(layoutState.previousEvent)) ??
      rowMap.get(layoutState.previousEvent.time)
    : rowMap.get('__dayStart') ?? null;

  if (previousY == null) {
    return focalY;
  }

  return previousY + (focalY - previousY) * layoutState.progressFraction;
}

/**
 * Position both the LED clock and the red line around the same center Y.
 *
 * @param {number} targetY
 */
export function positionTimeline(targetY) {
  const clock = document.getElementById('led-clock');
  const line = document.getElementById('timeline-line');
  const stage = document.getElementById('tv-stage');
  const clockSection = document.getElementById('clock-section');

  if (!clock || !line || !stage || !clockSection) return;

  const clockScaleRaw = getComputedStyle(clock).getPropertyValue('--clock-scale-y');
  const clockScaleY = Number.parseFloat(clockScaleRaw) || 1;
  const scaledClockHeight = clock.offsetHeight * clockScaleY;

  // Clamp movement so the clock never drops below the stage bottom edge.
  // This prevents the stretched LED clock from being visually clipped.
  const stageRect = stage.getBoundingClientRect();
  const clockSectionRect = clockSection.getBoundingClientRect();
  const stageBottomInClockSection = stageRect.bottom - clockSectionRect.top;
  const minCenterY = scaledClockHeight / 2;
  const maxCenterY = stageBottomInClockSection - scaledClockHeight / 2;
  const clampedTargetY = clamp(targetY, minCenterY, maxCenterY);

  // Centering should use the untransformed box height; scaleY around center
  // does not move the element's center point.
  const clockOffset = clampedTargetY - clock.offsetHeight / 2;
  const lineOffset = clampedTargetY - line.offsetHeight / 2;

  clock.style.transform = `translateY(${clockOffset}px) scaleY(${clockScaleY})`;
  line.style.transform = `translateY(${lineOffset}px)`;
}

function toEventKey(event) {
  if (!event) return '';
  return `${event.time ?? ''}|${event.label ?? ''}`;
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
