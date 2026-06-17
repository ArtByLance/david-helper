import {
  buildTodaySchedule,
  getMealEvents,
  loadConfig,
  loadDailySchedule,
  loadHelperActivities,
  loadMonthlyEvents,
  loadWeeklySchedule,
} from "./data.js";
import { getNow } from "./time.js";
import { parseTimeToMinutes } from "./utils.js";
import { getMealState } from "./meal-state.js";

const HELPER_RESET_MS = 60 * 1000;
const MEAL_WORDS = /\b(breakfast|lunch|supper|dinner)\b/i;

let helperData = null;
let helperDeck = [];
let helperCardIndex = 0;
let helperResetTimer = null;

export function isDoorHelperRoute(pathname = window.location.pathname) {
  const helper = new URLSearchParams(window.location.search).get("helper");
  return (
    pathname.replace(/\/+$/, "").toLowerCase() === "/helper/door" ||
    helper?.toLowerCase() === "door"
  );
}

export async function startDoorHelper() {
  document.documentElement.classList.add("helper-door-mode");
  document.getElementById("tv-stage")?.setAttribute("data-helper-door", "true");

  const [config, dailyData, weeklyData, monthlyData, activities] =
    await Promise.all([
      loadConfig(),
      loadDailySchedule(),
      loadWeeklySchedule(),
      loadMonthlyEvents(),
      loadHelperActivities(),
    ]);
  helperData = { config, dailyData, weeklyData, monthlyData, activities };

  document.getElementById("app-main")?.addEventListener("click", advanceHelper);
  document.addEventListener("keydown", handleHelperKeyDown);
  resetHelperDeck();
}

function handleHelperKeyDown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  advanceHelper();
}

function advanceHelper() {
  if (!helperDeck.length) return;
  helperCardIndex += 1;
  if (helperCardIndex >= helperDeck.length) {
    resetHelperDeck();
    return;
  }
  renderHelperCard();
  armHelperReset();
}

function resetHelperDeck() {
  helperDeck = buildHelperDeck(getNow());
  helperCardIndex = 0;
  renderHelperCard();
  armHelperReset();
}

function armHelperReset() {
  window.clearTimeout(helperResetTimer);
  helperResetTimer = window.setTimeout(resetHelperDeck, HELPER_RESET_MS);
}

function renderHelperCard() {
  const main = document.getElementById("app-main");
  const card = helperDeck[helperCardIndex];
  if (!main || !card) return;

  main.innerHTML = `
    <section class="screen helper-door-screen helper-${card.kind}" aria-label="${escapeAttribute(card.ariaLabel)}">
      <div class="helper-scene" aria-hidden="true"></div>
      <div class="helper-paper">
        ${card.html}
        <div class="helper-date">${escapeHtml(card.dateLabel)}</div>
        <div class="helper-tap-prompt">
          <span>TAP FOR MORE</span>
          <img src="./assets/objects/tap-for-more.png" alt="" draggable="false" />
        </div>
      </div>
    </section>
  `;
}

function buildHelperDeck(now) {
  const context = buildRightNowContext(now);
  const cards = [buildRightNowCard(context)];
  cards.push(
    ...getAvailableActivities(context).map((activity) =>
      buildActivityCard(activity, context),
    ),
  );
  cards.push(buildHelpCard(context));
  return cards;
}

function buildRightNowContext(now) {
  const today = buildScheduleForDate(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = buildScheduleForDate(tomorrowDate);
  const nowMinutes =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const settings = getHelperSettings();
  const isNight = isWithinMinutes(
    nowMinutes,
    settings.quietStart,
    settings.quietEnd,
  );
  const activeEvent = [...today.events]
    .reverse()
    .find(
      (event) =>
        nowMinutes >= event.timeMinutes &&
        nowMinutes < event.timeMinutes + event.holdMinutes,
    );
  const mealState = getMealState(now, getMealEvents(today.events));
  const relevantActiveEvent = isNight
    ? null
    : mealState.firstServingHour
      ? mealState.servingMeal
      : activeEvent;
  const nextMeal = today.events.find(
    (event) => isMeal(event) && event.timeMinutes > nowMinutes,
  );
  const minutesUntilMeal = nextMeal
    ? Math.max(0, nextMeal.timeMinutes - nowMinutes)
    : Number.POSITIVE_INFINITY;
  const nextToday = today.events.find(
    (event) => event.timeMinutes > nowMinutes,
  );
  const nextEvent =
    relevantActiveEvent ?? nextToday ?? tomorrow.events[0] ?? null;
  const nextIsTomorrow =
    !relevantActiveEvent && !nextToday && Boolean(nextEvent);
  const remainingMinutes = nextEvent
    ? getMinutesUntilEvent(
        nowMinutes,
        nextEvent,
        nextIsTomorrow,
        relevantActiveEvent,
      )
    : 0;

  return {
    now,
    nowMinutes,
    nextEvent,
    nextIsTomorrow,
    activeEvent: relevantActiveEvent,
    remainingMinutes,
    mealState,
    isNight,
    minutesUntilMeal,
    dateLabel: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now),
  };
}

function getAvailableActivities(context) {
  return (helperData.activities ?? [])
    .filter((activity) => !activity.chairOnly)
    .filter((activity) => isActivityAvailable(activity, context))
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
}

function isActivityAvailable(activity, context) {
  const availability = activity.availability ?? {};
  if (!isInAnyTimeRange(context.nowMinutes, availability.timeRanges)) {
    return false;
  }
  if (availability.excludeDuringMealServing && context.mealState.serving) {
    return false;
  }
  if (
    availability.excludeBeforeMealsMinutes &&
    context.minutesUntilMeal <= availability.excludeBeforeMealsMinutes
  ) {
    return false;
  }
  return true;
}

function isInAnyTimeRange(nowMinutes, ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return true;
  return ranges.some((range) =>
    isWithinMinutes(
      nowMinutes,
      parseActivityTime(range.start),
      parseActivityTime(range.end),
    ),
  );
}

function parseActivityTime(time) {
  if (time === "24:00") return 24 * 60;
  return parseTimeToMinutes(time);
}

function buildScheduleForDate(date) {
  return buildTodaySchedule(
    date,
    helperData.dailyData,
    helperData.weeklyData,
    helperData.monthlyData,
    helperData.config,
  );
}

function getMinutesUntilEvent(nowMinutes, event, isTomorrow, activeEvent) {
  if (activeEvent) return 0;
  return Math.max(
    0,
    event.timeMinutes + (isTomorrow ? 24 * 60 : 0) - nowMinutes,
  );
}

function buildRightNowCard(context) {
  const event = context.nextEvent;
  const dayDone = isDayDone(context) && !context.isNight;
  const dialState = getRightNowDialState(context, event, dayDone);
  const sentences = [
    `It’s ${formatNaturalClock(context.now)} ${getConversationalPeriod(context.now)}.`,
  ];
  let rightNowDetail = "";

  if (dayDone) {
    sentences.push("No other activity today;<br>relax and sleep.");
  } else if (context.isNight) {
    sentences.push("Everyone is in bed.", "It’s a good time to be in bed.");
  } else if (context.mealState.firstServingHour) {
    sentences.push(
      `They’re serving ${toNaturalLabel(context.mealState.servingMeal.label)} now.`,
    );
  } else if (context.activeEvent) {
    sentences.push(formatActiveEventSentence(event));
    if (!isMeal(event) && event.location) {
      sentences.push(formatLocationSentence(event));
    }
  } else if (event) {
    if (!isMeal(event) || context.mealState.hiddenForDay) {
      const timing = context.nextIsTomorrow
        ? `tomorrow at ${formatEventTime(event.time)}`
        : `in ${formatApproximateDuration(context.remainingMinutes)}`;
      sentences.push(`${toNaturalLabel(event.label)}<br>starts ${timing}.`);
      if (event.location) sentences.push(formatLocationSentence(event));
      if (context.remainingMinutes > 30) {
        sentences.push("There’s nothing you need to do<br>right now.");
      }
    }
  } else {
    sentences.push("There’s nothing you need to do<br>right now.");
  }

  if (!dayDone && shouldShowMealDial(context, event)) {
    rightNowDetail =
      context.mealState.firstServingHour ||
      (isMeal(event) && !context.mealState.hiddenForDay)
        ? renderHelperMealDial(context)
        : renderNextEventStrip(context);
  } else if (!dayDone && !context.isNight) {
    rightNowDetail = renderNextEventStrip(context);
  }

  return {
    kind: [
      "right-now",
      context.isNight ? "helper-night" : "",
      dayDone ? "helper-day-done" : "",
      dialState ? `helper-dial-time-${dialState}` : "",
    ]
      .filter(Boolean)
      .join(" "),
    ariaLabel: "Right now",
    dateLabel: "",
    html: `
      ${renderContextBand("WHAT'S HAPPENING NOW?", context, false)}
      ${context.isNight && !dayDone ? renderStopSign() : ""}
      <div class="helper-message">
        ${sentences.map((sentence) => `<p>${highlightSentence(sentence, true)}</p>`).join("")}
      </div>
      ${rightNowDetail}
    `,
  };
}

function isDayDone(context) {
  return context.mealState.hiddenForDay && !context.mealState.serving;
}

function getRightNowDialState(context, event, dayDone) {
  if (dayDone) return "";
  return shouldShowMealDial(context, event)
    ? getMealDialDisplay(context).state
    : "";
}

function shouldShowMealDial(context, event) {
  if (context.isNight) return false;
  if (context.nowMinutes < 6 * 60) return false;
  return (
    context.mealState.firstServingHour ||
    (isMeal(event) && !context.mealState.hiddenForDay)
  );
}

function formatActiveEventSentence(event) {
  const label = toNaturalLabel(event.label);
  if (/^lunch$/i.test(label)) return "It’s lunchtime now.";
  if (isMeal(event)) return `It’s ${label.toLowerCase()} time now.`;
  return `${label}<br>is happening now.`;
}

function formatLocationSentence(event) {
  const label = toNaturalLabel(event.label);
  const location = String(event.location);
  if (/^your room$/i.test(location)) return `${label} is in<br>your room.`;
  return `${label} is in<br>the ${location}.`;
}

function buildActivityCard(activity, context) {
  if (activity.snackList) return buildSnackCard(activity, context);

  return {
    kind: `idea helper-idea-${activity.id}`,
    ariaLabel: "Things you can do now",
    dateLabel: "",
    html: `
      ${renderContextBand("WHAT CAN I DO NOW?", context)}
      ${renderIdeaVisual(activity)}
      <div class="helper-idea-title">${escapeHtml(activity.title)}</div>
      <div class="helper-idea-message">${renderActivityMessage(activity.message)}</div>
    `,
  };
}

function buildSnackCard(activity, context) {
  const snacks = helperData.config.helper?.snacks ?? {};
  const lines = Object.entries(snacks)
    .filter(([, items]) => Array.isArray(items) && items.length)
    .map(
      ([place, items]) => `
        <div class="helper-snack-line">
          <strong>${escapeHtml(toNaturalLabel(place))}</strong>
          <span>${escapeHtml(items.join(" · "))}</span>
        </div>
      `,
    )
    .join("");

  return {
    kind: "idea helper-idea-snack helper-snack",
    ariaLabel: "Things you can do now",
    dateLabel: "",
    html: `
      ${renderContextBand("WHAT CAN I DO NOW?", context)}
      <div class="helper-snack-image">
        <img src="${escapeAttribute(activity.image)}" alt="" draggable="false" />
      </div>
      <div class="helper-idea-title">${escapeHtml(activity.title)}</div>
      <div class="helper-idea-message helper-snack-message">${renderActivityMessage(activity.message)}</div>
      <div class="helper-snack-list">${lines}</div>
    `,
  };
}

function buildHelpCard(context) {
  const helpButton = helperData.config.helper?.helpButton ?? {};
  const image = "./assets/objects/things-to-do-button.jpg";
  const arrival =
    helpButton.arrival || "Someone will come see you\nin a few minutes.";
  return {
    kind: "help",
    ariaLabel: "Help button instructions",
    dateLabel: "",
    html: `
      ${renderContextBand("I NEED SOMETHING!", context)}
      <div class="helper-help-layout">
        <div class="helper-help-questions">
          <p>Too hot?</p>
          <p>Too cold?</p>
          <p>Have a question?</p>
        </div>
        <div class="helper-help-photo-shell">
          <img
            class="helper-help-photo"
            src="${escapeAttribute(image)}"
            alt="Help button beside the chair"
            onerror="this.hidden=true; this.nextElementSibling.hidden=false"
          />
          <div class="helper-help-photo-missing" hidden>
            HELP BUTTON PHOTO<br />NEEDED HERE
          </div>
        </div>
        <p class="helper-help-instruction">
          <strong>PRESS THE BUTTON</strong><br />
          until the light comes on.
        </p>
        <p class="helper-help-arrival">${escapeHtml(arrival)}</p>
      </div>
    `,
  };
}

function getHelperSettings() {
  const helper = helperData.config.helper ?? {};
  return {
    quietStart: parseTimeToMinutes(helper.quietHours?.start ?? "21:00"),
    quietEnd: parseTimeToMinutes(helper.quietHours?.end ?? "06:00"),
  };
}

function renderHelperMealDial(context) {
  const meal = context.mealState;
  const display = getMealDialDisplay(context);

  return `
    <div
      class="helper-meal-dial helper-meal-dial-${escapeAttribute(display.state)}"
      style="--helper-dial-progress: ${display.progress}%;"
    >
      <div class="helper-meal-dial-face" aria-hidden="true">
        <div class="helper-meal-dial-center">
          <span class="helper-meal-dial-number">${renderMealDialCenter(display.center)}</span>
        </div>
      </div>
      ${display.detail ? `<div class="helper-meal-dial-detail">${escapeHtml(display.detail)}</div>` : ""}
      ${display.target ? `<div class="helper-meal-dial-target">${escapeHtml(display.target)}</div>` : ""}
      ${display.message ? `<div class="helper-meal-dial-message">${escapeHtml(display.message)}</div>` : ""}
    </div>
  `;
}

function getMealDialDisplay(context) {
  const meal = context.mealState;
  const label = toNaturalLabel(meal.label);

  if (meal.firstServingHour) {
    return {
      state: "serving",
      progress: 100,
      center: "NOW",
      detail: "",
      target: meal.targetLabel,
      message: "",
    };
  }

  const minutes = Math.max(1, Math.ceil(context.remainingMinutes));
  const progress =
    minutes < 60
      ? clamp((minutes / 60) * 100, 2, 100)
      : clamp(Number(meal.fillPercent || 0), 2, 100);
  const state = getMealDialState(minutes);
  const hourDisplay = formatDialHours(minutes);
  const target = `UNTIL ${label.toUpperCase()} AT ${meal.targetLabel}`;
  const message =
    minutes < 10 ? "It’s ok to walk down \nto the dining room now." : "";

  if (minutes < 60) {
    return {
      state,
      progress,
      center: String(minutes),
      detail: minutes === 1 ? "MINUTE" : "MINUTES",
      target,
      message,
    };
  }

  return {
    state,
    progress,
    center: hourDisplay.value,
    detail: hourDisplay.unit,
    target,
    message,
  };
}

function formatDialHours(minutes) {
  const halfHours = Math.max(1, Math.round(minutes / 30));
  const wholeHours = Math.floor(halfHours / 2);
  const hasHalf = halfHours % 2 === 1;
  const value =
    wholeHours > 0
      ? `${wholeHours}${hasHalf ? " ½" : ""}`
      : hasHalf
        ? "½"
        : "1";
  return {
    value,
    unit: value === "1" ? "HOUR" : "HOURS",
  };
}

function getMealDialState(minutes) {
  if (minutes < 10) return "green";
  if (minutes < 20) return "gold";
  if (minutes < 30) return "orange";
  if (minutes < 60) return "red";
  return "blue";
}

function renderMealDialCenter(value) {
  const text = String(value);
  if (!text.includes("½")) return escapeHtml(text);
  const whole = text.replace("½", "").trim();
  return `${whole ? `<span>${escapeHtml(whole)}</span>` : ""}<span class="helper-meal-dial-half" aria-label="one half"><span>1</span><i></i><span>2</span></span>`;
}

function renderNextEventStrip(context) {
  if (!context.nextEvent || context.isNight) {
    const nextText = context.nextEvent
      ? `${toNaturalLabel(context.nextEvent.label)} is ${
          context.remainingMinutes < 60 && !context.nextIsTomorrow
            ? "soon"
            : "next"
        } at ${formatEventTime(context.nextEvent.time)}.`
      : "";
    return nextText
      ? `<div class="helper-next-strip">${escapeHtml(nextText)}</div>`
      : "";
  }

  const event = context.nextEvent;
  return `
    <div class="helper-next-strip">
      <strong>${escapeHtml(toNaturalLabel(event.label))}</strong>
      <span>${escapeHtml(formatEventTime(event.time))}</span>
      ${!isMeal(event) && event.location ? `<small>${escapeHtml(event.location)}</small>` : ""}
    </div>
  `;
}

function getConversationalPeriod(now) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 5 * 60) return "in the middle of the night";
  if (minutes < 7 * 60) return "in the early morning";
  if (minutes < 11 * 60 + 30) return "in the morning";
  if (minutes < 12 * 60 + 30) return "around lunchtime";
  if (minutes < 17 * 60) return "in the afternoon";
  if (minutes < 21 * 60) return "in the evening";
  return "at night";
}

function formatNaturalClock(now) {
  const hour = now.getHours() % 12 || 12;
  return `${hour}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatEventTime(time) {
  const minutes = parseTimeToMinutes(time);
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  const hour = date.getHours() % 12 || 12;
  return minutes % 60
    ? `${hour}:${String(minutes % 60).padStart(2, "0")}`
    : String(hour);
}

function formatApproximateDuration(minutes) {
  if (minutes < 8) return "about 5 minutes";
  if (minutes < 60) {
    const rounded = Math.max(5, Math.round(minutes / 5) * 5);
    return `about ${rounded} minutes`;
  }
  if (minutes <= 90) return "about an hour";

  const roundedHalfHours = Math.max(3, Math.round(minutes / 30));
  const wholeHours = Math.floor(roundedHalfHours / 2);
  if (roundedHalfHours % 2 === 0) {
    return `about ${wholeHours} ${wholeHours === 1 ? "hour" : "hours"}`;
  }
  return `about ${wholeHours} and a half hours`;
}

function isWithinMinutes(minutes, start, end) {
  return start <= end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isMeal(event) {
  return Boolean(event?.label && MEAL_WORDS.test(event.label));
}

function toNaturalLabel(label) {
  const value = String(label || "");
  if (/supper/i.test(value)) return "Supper";
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function highlightSentence(sentence, allowBreaks = false) {
  const safeSentence = escapeHtml(sentence);
  return (
    allowBreaks ? safeSentence.replaceAll("&lt;br&gt;", "<br>") : safeSentence
  )
    .replace(/\b(\d{1,2}:\d{2})\b/g, '<span class="helper-key-time">$1</span>')
    .replace(
      /\b(breakfast|lunch|supper|dinner)\b/gi,
      '<span class="helper-key-next">$1</span>',
    )
    .replace(
      /\b(nothing you need to do|a good time to be in bed)\b/gi,
      '<span class="helper-key-calm">$1</span>',
    );
}

function renderActivityMessage(message) {
  return escapeHtml(message).replace(
    /\b(tablet\s+beside your chair)\b/gi,
    '<span class="helper-key-place">$1</span>',
  );
}

function renderContextBand(title, context, includeTime = true) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  })
    .format(context.now)
    .toUpperCase();
  const period = getConversationalPeriod(context.now)
    .replace(/^(in the|around|at)\s+/i, "")
    .toUpperCase();

  return `
    <div class="helper-context-band">
      <div class="helper-context-title">${escapeHtml(title)}</div>
    </div>
    <div class="helper-context-details">
      ${includeTime ? `<strong>${escapeHtml(formatNaturalClock(context.now))}</strong>` : ""}
      <span>${escapeHtml(weekday)}</span>
      <span>${escapeHtml(period)}</span>
    </div>
  `;
}

function renderStopSign() {
  return `
    <div class="helper-stop-sign">
      <img src="./assets/objects/stop-sign.png" alt="Stop" draggable="false" />
    </div>
  `;
}

function renderIdeaVisual(activity) {
  if (activity.image) {
    return `
      <div class="helper-idea-visual">
        <img src="${escapeAttribute(activity.image)}" alt="" draggable="false" />
      </div>
    `;
  }
  return `<div class="helper-idea-mark" aria-hidden="true">${escapeHtml(activity.title)}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
