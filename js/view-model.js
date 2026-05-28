/**
 * view-model.js
 * =============
 *
 * This file does the "what should the screen say right now?" thinking.
 * main.js gets the raw ingredients, and this file turns them into one tidy
 * view model that render.js can paint without needing to know the backstory.
 */

import { getEncouragementPhrase } from "./encouragement-note.js";
import {
  formatClock,
  formatDateLabel,
  formatDayLabel,
  formatCountdown,
  minutesToShortDisplay,
} from "./utils.js";
import { formatNextTimeLabel } from "./time.js";

/**
 * Build one clean object for the renderer.
 *
 * Real-world version:
 * We look at the schedule, decide what matters most right now, then hand the
 * UI a simple cheat sheet instead of making it figure things out live.
 * It is the difference between handing someone a tidy note card versus
 * dropping a folder of loose papers in their lap.
 *
 * @param {Date} now
 * @param {any[]} events
 * @param {any} focalState
 * @param {number} progressFraction
 * @returns {any}
 */
export function buildViewModel(now, events, focalState, progressFraction) {
  const focalRaw = focalState.focalEvent;
  const focalCluster = focalRaw
    ? events.filter((event) => event.timeMinutes === focalRaw.timeMinutes)
    : [];
  const focal = focalCluster.length
    ? choosePrimaryEvent(focalCluster)
    : focalRaw;
  // After the final event, keep showing the last meaningful item through
  // midnight even though there is no future focal event anymore.
  const fallbackEvent = !focal && focalState.previousEvent
    ? focalState.previousEvent
    : null;
  const displayEvent = focal ?? fallbackEvent;
  const secondaryClusterItems = focalCluster.filter(
    (event) =>
      focal && !(event.time === focal.time && event.label === focal.label),
  );
  const showHappeningSoon =
    (focalState.state === "happeningSoon" && Boolean(focal)) ||
    (!focal && Boolean(fallbackEvent));
  const showCountdown = focalState.state === "countdown" && Boolean(focal);
  const passedEventCount = countPassedEvents(events, focalState.nowMinutes);

  return {
    dayLabel: formatDayLabel(now),
    dateLabel: formatDateLabel(now),

    nextLabel: displayEvent?.label?.toUpperCase?.() ?? "",
    nextTime: displayEvent ? formatNextTimeLabel(displayEvent.time) : "",
    nextSecondary:
      secondaryClusterItems.length > 0
        ? `ALSO: ${secondaryClusterItems[0].label.toUpperCase()}`
        : "",

    state: focalState.state,
    countdownText: showCountdown
      ? formatCountdown(focalState.minutesUntilStart)
      : "",
    progressFraction,
    showProgress: showCountdown,
    showHappeningSoon,

    help1: displayEvent?.help1 ?? "",
    help2: displayEvent?.help2 ?? "",
    encouragementNote: getEncouragementPhrase(passedEventCount),

    clockText: formatClock(now),
    todayEvents: buildTodayEventViewModels(events, displayEvent, focalState.nowMinutes),
  };
}

/**
 * If several events share a time, pick the one David most likely cares about
 * first. Meals win. Care items come next. Everything else follows.
 *
 * @param {any[]} eventsAtSameTime
 * @returns {any}
 */
function choosePrimaryEvent(eventsAtSameTime) {
  if (!eventsAtSameTime.length) return null;

  const score = (label) => {
    const text = String(label || "").toLowerCase();
    if (/(breakfast|lunch|supper|dinner|meal)/.test(text)) return 0;
    if (/(medicine|medication|doctor|nurse|care)/.test(text)) return 1;
    if (/(laundry|bath|bedtime|service|church)/.test(text)) return 2;
    return 3;
  };

  return [...eventsAtSameTime].sort((a, b) => {
    const scoreDiff = score(a.label) - score(b.label);
    if (scoreDiff !== 0) return scoreDiff;
    return String(a.label || "").localeCompare(String(b.label || ""));
  })[0];
}

/**
 * Count how many schedule items are already behind us.
 *
 * This is what drives the encouraging-note rotation.
 * One event passes, the note moves ahead by one phrase.
 *
 * @param {any[]} events
 * @param {number} nowMinutes
 * @returns {number}
 */
function countPassedEvents(events, nowMinutes) {
  return events.filter((event) => event.timeMinutes < nowMinutes).length;
}

/**
 * Shape the TODAY column into renderer-friendly rows.
 *
 * @param {any[]} events
 * @param {any | null} focal
 * @param {number} nowMinutes
 * @returns {any[]}
 */
function buildTodayEventViewModels(events, focal, nowMinutes) {
  return events.map((event) => ({
    eventKey: `${event.time}|${event.label}`,
    time: event.time,
    timeMinutes: event.timeMinutes,
    timeDisplay: minutesToShortDisplay(event.timeMinutes),
    label: event.label,
    source: event.source ?? "daily",
    highlight: Boolean(event.highlight),
    isPast: event.timeMinutes < nowMinutes && event !== focal,
    isFocal: event === focal,
    isClustered: events.some(
      (other) => other !== event && other.timeMinutes === event.timeMinutes,
    ),
  }));
}
