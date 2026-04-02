/**
 * time.js
 * =======
 *
 * Time engine for the dashboard.
 *
 * Core idea
 * ---------
 * The screen always has a focal event.
 * That focal event is either:
 *   - the next upcoming event, or
 *   - the current event, if we are inside its HAPPENING SOON hold window
 *
 * Display states
 * --------------
 * 1) countdown
 *    Before the HAPPENING SOON pre-window starts
 *
 * 2) happeningSoon
 *    From 15 minutes before event start until 5 minutes after event start
 *
 * Progress bar behavior
 * ---------------------
 * - visible in countdown state
 * - hidden in happeningSoon state
 * - fill is based on progress from previous anchor event to focal event time
 */

/**
 * Return the current Date, honoring ?debugNow=... when present.
 *
 * Example:
 *   ?debugNow=2026-04-01T11:32:00
 *
 * @returns {Date}
 */
export function getNow() {
  const params = new URLSearchParams(window.location.search);
  const debugNow = params.get('debugNow');

  if (debugNow) {
    const parsed = new Date(debugNow);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

/**
 * Return whether the active day window is in effect.
 * This is mainly used to decide whether countdown/progress concepts should be active.
 *
 * @param {Date} now
 * @param {{ dayStartHour: number, dayEndHour: number }} config
 * @returns {boolean}
 */
export function isWithinActiveDayWindow(now, config) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = config.dayStartHour * 60;
  const end = config.dayEndHour * 60;
  return minutes >= start && minutes <= end;
}

/**
 * Determine the focal event and visual state.
 *
 * @param {Date} now
 * @param {any[]} events
 * @returns {{
 *   state: 'countdown' | 'happeningSoon',
 *   previousEvent: any | null,
 *   focalEvent: any | null,
 *   nextFutureEvent: any | null,
 *   minutesUntilStart: number,
 *   nowMinutes: number
 * }}
 */
const SOON_LEAD_MINUTES = 15;
const SOON_TAIL_MINUTES = 5;

export function getFocalState(now, events) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  if (!events.length) {
    return {
      state: 'countdown',
      previousEvent: null,
      focalEvent: null,
      nextFutureEvent: null,
      minutesUntilStart: 0,
      nowMinutes
    };
  }

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const eventStart = event.timeMinutes;
    const soonStart = eventStart - SOON_LEAD_MINUTES;
    const soonEnd = eventStart + SOON_TAIL_MINUTES;

    if (nowMinutes >= soonStart && nowMinutes < soonEnd) {
      return {
        state: 'happeningSoon',
        previousEvent: index > 0 ? events[index - 1] : null,
        focalEvent: event,
        nextFutureEvent: events[index + 1] ?? null,
        minutesUntilStart: 0,
        nowMinutes
      };
    }

    if (nowMinutes < soonStart) {
      return {
        state: 'countdown',
        previousEvent: index > 0 ? events[index - 1] : null,
        focalEvent: event,
        nextFutureEvent: events[index + 1] ?? null,
        minutesUntilStart: eventStart - nowMinutes,
        nowMinutes
      };
    }
  }

  return {
    state: 'countdown',
    previousEvent: events[events.length - 1] ?? null,
    focalEvent: null,
    nextFutureEvent: null,
    minutesUntilStart: 0,
    nowMinutes
  };
}

/**
 * Return progress from previous anchor to focal event start.
 *
 * Rules
 * -----
 * - countdown state only
 * - if no previous event exists, use app day start as implicit anchor
 * - clamp to [0, 1]
 *
 * @param {number} nowMinutes
 * @param {any | null} previousEvent
 * @param {any | null} focalEvent
 * @param {{ dayStartHour: number }} config
 * @returns {number}
 */
export function getProgressFraction(nowMinutes, previousEvent, focalEvent, config) {
  if (!focalEvent) return 0;

  const startAnchor = previousEvent
    ? previousEvent.timeMinutes
    : config.dayStartHour * 60;
  const endAnchor = focalEvent.timeMinutes;

  if (endAnchor <= startAnchor) return 1;

  const raw = (nowMinutes - startAnchor) / (endAnchor - startAnchor);
  return clamp(raw, 0, 1);
}

/**
 * Return a display-friendly next-time label.
 * Example:
 *   12:00 -> "AT 12:00"
 *
 * @param {string} hhmm
 * @returns {string}
 */
export function formatNextTimeLabel(hhmm) {
  const [hourText, minuteText] = hhmm.split(':');
  const hour = Number(hourText);
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `AT ${displayHour}:${minuteText}`;
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
