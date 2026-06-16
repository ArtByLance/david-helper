/**
 * data.js
 * =======
 *
 * Data loading and merge logic.
 *
 * Data sources
 * ------------
 * - /data/config.json   -> app-wide settings
 * - /data/schedule/01-daily.json   -> fixed every-day anchors
 * - /data/schedule/02-weekly.json  -> recurring weekly overrides by weekday
 * - /data/schedule/03-monthly.json -> date-specific overrides
 *
 * Merge strategy
 * --------------
 * 1) Start with the daily baseline
 * 2) Apply recurring weekly overrides for that weekday
 * 3) Apply date-specific monthly overrides
 * 4) Sort final list by time
 *
 * Notes
 * -----
 * - if two events share the same time, they are both allowed
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

export async function loadDailySchedule() {
  return loadJson('./data/schedule/01-daily.json');
}

export async function loadWeeklySchedule() {
  return loadJson('./data/schedule/02-weekly.json');
}

export async function loadMonthlyEvents() {
  return loadJson('./data/schedule/03-monthly.json');
}

export async function loadHelperActivities() {
  return loadJson('./data/helper/activities.json');
}

/**
 * Build today's final schedule.
 *
 * @param {Date} date
 * @param {any[]} dailyData
 * @param {Record<string, { add?: any[], remove?: Array<string | { matchTime?: string, time?: string }>, replace?: Array<{ matchTime?: string, event: any }> }>} weeklyData
 * @param {Record<string, { add?: any[], remove?: Array<string | { matchTime?: string, time?: string }>, replace?: Array<{ matchTime?: string, event: any }> }>} monthlyData
 * @param {{ defaultHoldMinutes: number }} config
 * @returns {{ dateKey: string, weekdayKey: string, events: any[] }}
 */
export function buildTodaySchedule(date, dailyData, weeklyData, monthlyData, config) {
  const weekdayKey = formatWeekdayKey(date);
  const dateKey = formatDateKey(date);

  const baseEvents = Array.isArray(dailyData) ? dailyData : [];
  const weeklyPlan = weeklyData[weekdayKey] ?? {};
  const monthlyPlan = monthlyData[dateKey] ?? {};
  let events = baseEvents.map((event) => normalizeEvent(event, config, "daily"));
  events = applyOverrides(events, weeklyPlan, config, "weekly");
  events = applyOverrides(events, monthlyPlan, config, "monthly");

  const specials = events.filter((event) => event.todayCard);
  return {
    dateKey,
    weekdayKey,
    events: sortEvents(events.filter((event) => !event.allDay)),
    specials: sortEvents(specials),
  };
}

/**
 * Normalize an event so later code has fewer edge cases.
 *
 * @param {any} event
 * @param {{ defaultHoldMinutes: number }} config
 * @param {'daily' | 'weekly' | 'monthly'} [source]
 * @returns {any}
 */
function normalizeEvent(event, config, source = 'daily') {
  const label = typeof event.label === 'string' ? event.label : '';
  const meal =
    typeof event.meal === 'boolean'
      ? event.meal
      : /\b(breakfast|lunch|luncheon|supper|dinner)\b/i.test(label);
  const timeMinutes = parseTimeToMinutes(event.time);
  const servingEnd =
    typeof event.servingEnd === 'string'
      ? event.servingEnd
      : meal
        ? minutesToTime(timeMinutes + 120)
        : '';
  return {
    id: typeof event.id === 'string' ? event.id : slugifyLabel(label),
    time: event.time,
    label,
    meal,
    servingEnd,
    servingEndMinutes: servingEnd ? parseTimeToMinutes(servingEnd) : null,
    allDay: Boolean(event.allDay),
    todayCard: Boolean(event.todayCard),
    displayTime: typeof event.displayTime === 'string' ? event.displayTime : '',
    note: typeof event.note === 'string' ? event.note : '',
    help1: typeof event.help1 === 'string' ? event.help1 : '',
    help2: typeof event.help2 === 'string' ? event.help2 : '',
    location: typeof event.location === 'string' ? event.location : '',
    direction: typeof event.direction === 'string' ? event.direction : '',
    source,
    highlight:
      typeof event.highlight === 'boolean'
        ? event.highlight
        : getDefaultHighlight(source, label),
    holdMinutes:
      typeof event.holdMinutes === 'number'
        ? event.holdMinutes
        : config.defaultHoldMinutes,
    timeMinutes
  };
}

function minutesToTime(minutes) {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minute = String(normalized % 60).padStart(2, '0');
  return `${hour}:${minute}`;
}

function slugifyLabel(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getMealEvents(events) {
  return (events ?? []).filter((event) => event.meal);
}

/**
 * @param {any[]} events
 * @returns {any[]}
 */
function sortEvents(events) {
  return [...events].sort((a, b) => a.timeMinutes - b.timeMinutes);
}

/**
 * Apply remove/replace/add overrides to an event list.
 *
 * Supported shapes:
 * - remove: ["10:00"] or [{ matchTime: "10:00" }]
 * - replace: [{ matchTime: "12:00", event: { ... } }]
 * - add: [{ ...event }]
 *
 * @param {any[]} events
 * @param {{ add?: any[], remove?: Array<string | { matchTime?: string, time?: string }>, replace?: Array<{ matchTime?: string, event: any }> }} plan
 * @param {{ defaultHoldMinutes: number }} config
 * @param {'weekly' | 'monthly'} source
 * @returns {any[]}
 */
function applyOverrides(events, plan, config, source) {
  let nextEvents = [...events];

  const removals = Array.isArray(plan.remove) ? plan.remove : [];
  for (const removal of removals) {
    const matchTime =
      typeof removal === 'string'
        ? removal
        : removal?.matchTime ?? removal?.time ?? '';
    if (!matchTime) continue;
    nextEvents = nextEvents.filter((event) => event.time !== matchTime);
  }

  const replacements = Array.isArray(plan.replace) ? plan.replace : [];
  for (const replacement of replacements) {
    const matchTime = replacement?.matchTime ?? '';
    const nextEvent = replacement?.event;
    if (!matchTime || !nextEvent) continue;
    nextEvents = nextEvents.map((event) =>
      event.time === matchTime ? normalizeEvent(nextEvent, config, source) : event,
    );
  }

  const additions = Array.isArray(plan.add) ? plan.add : [];
  for (const added of additions) {
    nextEvents.push(normalizeEvent(added, config, source));
  }

  return nextEvents;
}

/**
 * Anything outside the daily baseline is highlighted by default.
 * Individual events can always opt out with `"highlight": false`.
 *
 * @param {'daily' | 'weekly' | 'monthly'} source
 * @param {string} label
 * @returns {boolean}
 */
function getDefaultHighlight(source, label) {
  if (source === 'weekly' || source === 'monthly') return true;
  return false;
}
