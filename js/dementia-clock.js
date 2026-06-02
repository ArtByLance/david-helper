const PERIOD_LABELS = {
  earlyMorning: "EARLY MORNING",
  morning: "MORNING",
  noon: "NOON",
  afternoon: "AFTERNOON",
  evening: "EVENING",
  night: "NIGHT",
};

export function renderDementiaClock(now) {
  const date = now instanceof Date ? now : new Date(now);
  const { time, ampm } = getFormattedTime(date);
  const icon = getSkyIcon(date);

  return `
    <section class="dementia-clock-object" aria-label="Dementia clock">
      <div class="dementia-clock-screen">
        <div class="dementia-clock-weekday">${formatWeekday(date)}</div>
        <div class="dementia-clock-period">${getPeriodLabel(date)}</div>
        <div class="dementia-clock-time-row">
          <div class="dementia-clock-time-main">
            <span class="dementia-clock-time">${time}</span>
            <span class="dementia-clock-ampm">${ampm}</span>
          </div>
        </div>
        ${renderSkyIcon(icon)}
        <div class="dementia-clock-date">
          <span class="dementia-clock-month">${formatMonth(date)}</span>
          <span class="dementia-clock-day">${date.getDate()}</span>
          <span class="dementia-clock-year">${date.getFullYear()}</span>
        </div>
      </div>
    </section>
  `;
}

export function refreshDementiaClocks(now, root = document) {
  const date = now instanceof Date ? now : new Date(now);
  const { time, ampm } = getFormattedTime(date);

  root.querySelectorAll(".dementia-clock-object").forEach((clock) => {
    setText(clock, ".dementia-clock-weekday", formatWeekday(date));
    setText(clock, ".dementia-clock-period", getPeriodLabel(date));
    setText(clock, ".dementia-clock-time", time);
    setText(clock, ".dementia-clock-ampm", ampm);
    setText(clock, ".dementia-clock-month", formatMonth(date));
    setText(clock, ".dementia-clock-day", date.getDate());
    setText(clock, ".dementia-clock-year", date.getFullYear());
    const icon = getSkyIcon(date);
    const skyIcon = clock.querySelector(".dementia-clock-sky-icon");
    if (skyIcon) skyIcon.outerHTML = renderSkyIcon(icon);
  });
}

function setText(root, selector, value) {
  const element = root.querySelector(selector);
  if (element) element.textContent = String(value);
}

function getPeriodLabel(date) {
  const hour = date.getHours();
  const minutesSinceMidnight = hour * 60 + date.getMinutes();

  if (
    minutesSinceMidnight >= 11 * 60 + 30 &&
    minutesSinceMidnight < 12 * 60 + 30
  ) {
    return PERIOD_LABELS.noon;
  }

  if (hour >= 5 && hour < 8) return PERIOD_LABELS.earlyMorning;
  if (hour >= 8 && hour < 12) return PERIOD_LABELS.morning;
  if (hour >= 12 && hour < 17) return PERIOD_LABELS.afternoon;
  if (hour >= 17 && hour < 21) return PERIOD_LABELS.evening;
  return PERIOD_LABELS.night;
}

function getFormattedTime(date) {
  let hour = date.getHours();
  const minute = String(date.getMinutes()).padStart(2, "0");
  const isPm = hour >= 12;
  hour = hour % 12 || 12;
  return {
    time: `${hour}:${minute}`,
    ampm: isPm ? "P.M." : "A.M.",
  };
}

function formatWeekday(date) {
  return date
    .toLocaleDateString("en-US", { weekday: "long" })
    .toUpperCase();
}

function formatMonth(date) {
  return date.toLocaleDateString("en-US", { month: "long" }).toUpperCase();
}

function getSkyIcon(date) {
  const hour = date.getHours();
  return hour >= 18 || hour < 6 ? "moon" : "sun";
}

function renderSkyIcon(icon) {
  if (icon === "moon") return renderMoonIcon();

  return `
    <svg
      class="dementia-clock-sky-icon dementia-clock-sun is-visible"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="23"></circle>
      <g>
        <line x1="50" y1="6" x2="50" y2="19"></line>
        <line x1="50" y1="81" x2="50" y2="94"></line>
        <line x1="6" y1="50" x2="19" y2="50"></line>
        <line x1="81" y1="50" x2="94" y2="50"></line>
        <line x1="18" y1="18" x2="28" y2="28"></line>
        <line x1="72" y1="72" x2="82" y2="82"></line>
        <line x1="82" y1="18" x2="72" y2="28"></line>
        <line x1="28" y1="72" x2="18" y2="82"></line>
      </g>
    </svg>
  `;
}

function renderMoonIcon() {
  return `
    <svg
      class="dementia-clock-sky-icon dementia-clock-moon is-visible"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <path
        d="M66 82c-25 0-45-20-45-45 0-10 3-19 8-27 3-4 9-1 8 4-1 4-2 8-2 12 0 23 19 42 42 42 4 0 8-1 12-2 5-1 8 5 4 8-8 5-17 8-27 8z"
      ></path>
    </svg>
  `;
}
