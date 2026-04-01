/**
 * layout.js
 * =========
 *
 * Measured positioning for the LED clock and red timeline line.
 *
 * Why this is separate
 * --------------------
 * The TODAY list is rendered dynamically. Once rendered, the script needs to:
 *   1) find row positions
 *   2) calculate the target Y
 *   3) place the clock and line smoothly
 *
 * This is layout logic, not render logic.
 */

/**
 * Scale the 1920x1080 stage to fit the browser window.
 * This preserves TV proportions during local development.
 */
export function fitStageToViewport() {
  const shell = document.getElementById('app-shell');
  const stage = document.getElementById('tv-stage');
  if (!shell || !stage) return;

  const shellWidth = shell.clientWidth;
  const shellHeight = shell.clientHeight;
  const stageWidth = stage.offsetWidth;
  const stageHeight = stage.offsetHeight;

  const scale = Math.min(shellWidth / stageWidth, shellHeight / stageHeight);
  stage.style.transform = `scale(${scale})`;
}

/**
 * Measure the vertical center of each TODAY event row.
 * Returns a map keyed by event time string, such as "12:00".
 *
 * @returns {Map<string, number>}
 */
export function measureEventRows() {
  const map = new Map();
  const panel = document.getElementById('today-section');
  const rows = document.querySelectorAll('.today-event-row');

  if (!panel) return map;

  const panelRect = panel.getBoundingClientRect();

  rows.forEach((row) => {
    const rect = row.getBoundingClientRect();
    const centerY = rect.top - panelRect.top + rect.height / 2;
    map.set(row.dataset.time ?? '', centerY);
  });

  return map;
}

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

  const focalY = rowMap.get(layoutState.focalEvent.time) ?? 0;
  if (layoutState.state === 'happeningSoon') {
    return focalY;
  }

  const previousY = layoutState.previousEvent
    ? rowMap.get(layoutState.previousEvent.time)
    : null;

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

  if (!clock || !line) return;

  const clockScaleRaw = getComputedStyle(clock).getPropertyValue('--clock-scale-y');
  const clockScaleY = Number.parseFloat(clockScaleRaw) || 1;
  // Centering should use the untransformed box height; scaleY around center
  // does not move the element's center point.
  const clockOffset = targetY - clock.offsetHeight / 2;
  const lineOffset = targetY - line.offsetHeight / 2;

  clock.style.transform = `translateY(${clockOffset}px) scaleY(${clockScaleY})`;
  line.style.transform = `translateY(${lineOffset}px)`;
}
