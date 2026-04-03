/**
 * main.js
 * =======
 *
 * This is the front door.
 *
 * When the page wakes up, this file:
 * - loads the data
 * - figures out what matters right now
 * - asks the renderer to paint it
 * - keeps everything refreshed on a gentle timer
 *
 * If you are poking around later and wondering "where does the app actually
 * start?", this is the answer.
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
  isWithinActiveDayWindow,
} from "./time.js";
import { renderView } from "./render.js";
import {
  fitStageToViewport,
  layoutTodayEvents,
  getTargetY,
  positionTimeline,
} from "./layout.js";
import { buildViewModel } from "./view-model.js";

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

    // Make the 1920x1080 stage behave nicely inside whatever browser window
    // we happen to be using today.
    fitStageToViewport();
    updateScreen();
    startTickLoop(config.tickSeconds);
  } catch (error) {
    console.error(error);
    renderFatalError(error);
  }
}

/**
 * Recompute the whole screen for "right now".
 *
 * In plain English:
 * check the current time, decide what David should see, render it, then nudge
 * the NOW pointer into the correct row after the DOM has its fresh layout.
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
    todaySchedule.events,
    focalState,
    progressFraction,
  );
  renderView(viewModel);

  // We wait one frame so the browser has already placed the rows.
  // Otherwise we'd be measuring yesterday's furniture arrangement.
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
/**
 * Start the refresh loop.
 *
 * This is intentionally boring: every few seconds, ask the screen to rethink
 * itself from scratch. For a dashboard this small, boring is a feature.
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
 * Put a big friendly error on the stage if startup falls over.
 *
 * The goal here is not "perfect error UX."
 * The goal is "future us can tell what broke without opening three tabs and
 * muttering at the ceiling."
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
