/**
 * main.js
 * =======
 *
 * Entry point and orchestration.
 *
 * Responsibilities
 * ----------------
 * - load data files
 * - build today's merged schedule
 * - compute the live view model
 * - render the screen
 * - measure rows and position the clock/line
 * - refresh every configured number of seconds
 * - rescale the TV stage when the browser window changes
 *
 * Suggested local workflow
 * ------------------------
 * 1) Start a local server in the project root
 *      python3 -m http.server 8000
 *
 * 2) Open the app
 *      http://localhost:8000
 *
 * 3) Test a fake moment in time
 *      http://localhost:8000/?debugNow=2026-04-01T11:32:00
 *
 * 4) Keep VS Code Live Server or manual refresh running while tweaking layout
 */

import {
  loadConfig,
  loadWeekData,
  loadScheduleOverrides,
  buildTodaySchedule,
} from "./data.js";
import {
  getNow,
  getFocalState,
  getProgressFraction,
  formatNextTimeLabel,
  isWithinActiveDayWindow,
} from "./time.js";
import {
  formatClock,
  formatDateLabel,
  formatDayLabel,
  formatCountdown,
  minutesToShortDisplay,
} from "./utils.js";
import { renderView } from "./render.js";
import {
  fitStageToViewport,
  layoutTodayEvents,
  getTargetY,
  positionTimeline,
} from "./layout.js";
import { getEncouragementPhrase } from "./encouragement-note.js";

let appState = null;
let tickHandle = null;

window.addEventListener("DOMContentLoaded", bootstrap);
window.addEventListener("resize", () => {
  fitStageToViewport();
  requestAnimationFrame(updateScreen);
});

async function bootstrap() {
  try {
    const [config, weekData, scheduleData] = await Promise.all([
      loadConfig(),
      loadWeekData(),
      loadScheduleOverrides(),
    ]);

    const now = getNow();
    const todaySchedule = buildTodaySchedule(
      now,
      weekData,
      scheduleData,
      config,
    );

    appState = {
      config,
      weekData,
      scheduleData,
      todaySchedule,
    };

    fitStageToViewport();
    updateScreen();
    startTickLoop(config.tickSeconds);
  } catch (error) {
    console.error(error);
    renderFatalError(error);
  }
}

/**
 * Recompute the screen for the current moment and render it.
 */
function updateScreen() {
  if (!appState) return;

  const now = getNow();
  const { config, todaySchedule } = appState;
  const focalState = getFocalState(now, todaySchedule.events);
  const activeWindow = isWithinActiveDayWindow(now, config);

  const progressFraction =
    activeWindow && focalState.state === "countdown"
      ? getProgressFraction(
          focalState.nowMinutes,
          focalState.previousEvent,
          focalState.focalEvent,
          config,
        )
      : 0;

  const viewModel = buildViewModel(
    now,
    config,
    todaySchedule.events,
    focalState,
    progressFraction,
  );
  renderView(viewModel);

  // Measure after render so row positions are current.
  requestAnimationFrame(() => {
    const rowMap = layoutTodayEvents(viewModel.todayEvents);
    const targetY = getTargetY(
      {
        state: focalState.state,
        previousEvent: focalState.previousEvent,
        focalEvent: focalState.focalEvent,
        nowMinutes: focalState.nowMinutes,
        progressFraction,
      },
      rowMap,
    );
    positionTimeline(targetY);
  });
}

/**
 * Convert raw app state into one clean view model for render.js.
 *
 * @param {Date} now
 * @param {any} config
 * @param {any[]} events
 * @param {any} focalState
 * @param {number} progressFraction
 * @returns {any}
 */
function buildViewModel(now, config, events, focalState, progressFraction) {
  const focalRaw = focalState.focalEvent;
  const focalCluster = focalRaw
    ? events.filter((event) => event.timeMinutes === focalRaw.timeMinutes)
    : [];
  const focal = focalCluster.length
    ? choosePrimaryEvent(focalCluster)
    : focalRaw;
  const secondaryClusterItems = focalCluster.filter(
    (event) =>
      focal && !(event.time === focal.time && event.label === focal.label),
  );
  const showHappeningSoon =
    focalState.state === "happeningSoon" && Boolean(focal);
  const showCountdown = focalState.state === "countdown" && Boolean(focal);
  const passedEventCount = events.filter(
    (event) => event.timeMinutes < focalState.nowMinutes,
  ).length;

  return {
    dayLabel: formatDayLabel(now),
    dateLabel: formatDateLabel(now),
    locationLabel: config.locationName,

    nextLabel: focal?.label?.toUpperCase?.() ?? "",
    nextTime: focal ? formatNextTimeLabel(focal.time) : "",
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

    help1: focal?.help1 ?? "",
    help2: focal?.help2 ?? "",
    encouragementNote: getEncouragementPhrase(passedEventCount),

    clockText: formatClock(now),

    todayEvents: events.map((event) => ({
      eventKey: `${event.time}|${event.label}`,
      time: event.time,
      timeMinutes: event.timeMinutes,
      timeDisplay: minutesToShortDisplay(event.timeMinutes),
      label: event.label,
      isPast: event.timeMinutes < focalState.nowMinutes && event !== focal,
      isFocal: Boolean(focal) && event.timeMinutes === focal.timeMinutes,
      isClustered: events.some(
        (other) => other !== event && other.timeMinutes === event.timeMinutes,
      ),
    })),
  };
}

/**
 * Pick a stable primary event when multiple events share one time.
 * Lower score wins.
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
 * Start the recurring update timer.
 *
 * @param {number} tickSeconds
 */
function startTickLoop(tickSeconds) {
  stopTickLoop();
  tickHandle = window.setInterval(updateScreen, tickSeconds * 1000);
}

function stopTickLoop() {
  if (tickHandle) {
    window.clearInterval(tickHandle);
    tickHandle = null;
  }
}

/**
 * Render a very simple visible error if required JSON files fail to load.
 *
 * @param {unknown} error
 */
function renderFatalError(error) {
  const stage = document.getElementById("tv-stage");
  if (!stage) return;

  stage.innerHTML = `
    <div style="
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      padding: 80px;
      background: #dfe6ee;
      color: #8b1111;
      font-family: Arial, Helvetica, sans-serif;
      text-align: center;
    ">
      <div>
        <div style="font-size: 54px; font-weight: 900; margin-bottom: 20px;">Dashboard could not load</div>
        <div style="font-size: 28px; line-height: 1.3; max-width: 1000px;">
          Check your local server, file paths, and JSON syntax.<br />
          Open the browser console for details.
        </div>
        <pre style="margin-top: 28px; font-size: 20px; white-space: pre-wrap; color: #333;">${String(
          error,
        )}</pre>
      </div>
    </div>
  `;
}
