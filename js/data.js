/**
 * data.js
 * =======
 *
 * Data loading and merge logic.
 *
 * Data sources
 * ------------
 * - /data/config.json   -> app-wide settings
 * - /data/week.json     -> standard weekly rhythm
 * - /data/schedule.json -> date-specific overrides
 *
 * Merge strategy
 * --------------
 * 1) Start with the weekday baseline from week.json
 * 2) Apply date-specific remove rules
 * 3) Apply date-specific replace rules
 * 4) Apply date-specific add rules
 * 5) Sort final list by time
 *
 * Notes
 * -----
 * - v1 uses time-based matching because it is simple and easy to edit by hand
 * - if two events share the same time, they are both allowed unless one is
 *   explicitly replaced or removed
 */

import { formatDateKey, formatWeekdayKey, parseTimeToMinutes } from './utils.js';

/** @param {string} path */
async function loadJson(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

export async function loadConfig() {
  return loadJson('./data/config.json');
}

export async function loadWeekData() {
  return loadJson('./data/week.json');
}

export async function loadScheduleOverrides() {
  return loadJson('./data/schedule.json');
}

/**
 * Build today's final schedule.
 *
 * @param {Date} date
 * @param {Record<string, any[]>} weekData
 * @param {Record<string, any>} scheduleData
 * @param {{ defaultHoldMinutes: number }} config
 * @returns {{ dateKey: string, weekdayKey: string, events: any[] }}
 */
export function buildTodaySchedule(date, weekData, scheduleData, config) {
  const weekdayKey = formatWeekdayKey(date);
  const dateKey = formatDateKey(date);

  const baseEvents = Array.isArray(weekData[weekdayKey]) ? weekData[weekdayKey] : [];
  let events = baseEvents.map((event) => normalizeEvent(event, config));

  const overrides = scheduleData[dateKey];
  if (!overrides) {
    return { dateKey, weekdayKey, events: sortEvents(events) };
  }

  if (Array.isArray(overrides.remove)) {
    for (const removal of overrides.remove) {
      events = events.filter((event) => event.time !== removal.matchTime);
    }
  }

  if (Array.isArray(overrides.replace)) {
    for (const replacement of overrides.replace) {
      events = events.map((event) =>
        event.time === replacement.matchTime
          ? normalizeEvent(replacement.event, config)
          : event
      );
    }
  }

  if (Array.isArray(overrides.add)) {
    for (const added of overrides.add) {
      events.push(normalizeEvent(added, config));
    }
  }

  return { dateKey, weekdayKey, events: sortEvents(events) };
}

/**
 * Normalize an event so later code has fewer edge cases.
 *
 * @param {any} event
 * @param {{ defaultHoldMinutes: number }} config
 * @returns {any}
 */
function normalizeEvent(event, config) {
  return {
    time: event.time,
    label: event.label,
    help1: typeof event.help1 === 'string' ? event.help1 : '',
    help2: typeof event.help2 === 'string' ? event.help2 : '',
    holdMinutes:
      typeof event.holdMinutes === 'number'
        ? event.holdMinutes
        : config.defaultHoldMinutes,
    timeMinutes: parseTimeToMinutes(event.time)
  };
}

/**
 * @param {any[]} events
 * @returns {any[]}
 */
function sortEvents(events) {
  return [...events].sort((a, b) => a.timeMinutes - b.timeMinutes);
}
