import { parseTimeToMinutes, pluralize } from "./utils.js";

const FIRST_SERVING_HOUR_MINUTES = 60;

// Shared meal-counter state used by both shelf and door-helper experiences.
export function getMealState(now, meals = []) {
  const nowMinutes =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const mealsWithMinutes = meals.map((meal) => ({
    ...meal,
    minutes: parseTimeToMinutes(meal.time),
    servingEndMinutes:
      typeof meal.servingEndMinutes === "number"
        ? meal.servingEndMinutes
        : meal.servingEnd
          ? parseTimeToMinutes(meal.servingEnd)
          : parseTimeToMinutes(meal.time) + 120,
  }));
  const servingMeal = [...mealsWithMinutes]
    .reverse()
    .find(
      (meal) =>
        nowMinutes >= meal.minutes && nowMinutes < meal.servingEndMinutes,
    );
  const firstServingHour = Boolean(
    servingMeal &&
      nowMinutes < servingMeal.minutes + FIRST_SERVING_HOUR_MINUTES,
  );
  const followingMeal = servingMeal
    ? getFollowingMeal(servingMeal, mealsWithMinutes)
    : null;

  if (firstServingHour) {
    return {
      resting: false,
      hiddenForDay: false,
      serving: true,
      firstServingHour: true,
      servingMeal,
      followingMeal,
      nextMealId: servingMeal.id,
      label: servingMeal.label,
      fillPercent: 0,
      nowPercent: 100,
      timeLeft: "",
      targetLabel: `served until ${formatShelfMealTime(servingMeal.servingEnd)}`,
      message: `They're serving ${toTitleCase(servingMeal.label)} now.\nNext meal is ${toTitleCase(followingMeal?.label || "Breakfast")}.`,
    };
  }

  const nextMeal = mealsWithMinutes.find((meal) => nowMinutes < meal.minutes);

  if (!nextMeal) {
    return {
      resting: true,
      hiddenForDay: true,
      serving: Boolean(servingMeal),
      firstServingHour: false,
      servingMeal: servingMeal ?? null,
      followingMeal: null,
      nextMealId: null,
      label: "REST WHEN READY",
      fillPercent: 100,
      nowPercent: 100,
      timeLeft: "",
      targetLabel: "REST",
      message: "Rest whenever you feel ready.",
    };
  }

  const previousMeal = [...mealsWithMinutes]
    .reverse()
    .find((meal) => meal.minutes <= nowMinutes);
  const start = previousMeal?.minutes ?? 0;
  const span = Math.max(1, nextMeal.minutes - start);
  const elapsed = Math.max(0, nowMinutes - start);
  const remaining = Math.max(0, nextMeal.minutes - nowMinutes);
  const fillPercent = clamp((remaining / span) * 100, 0, 100);
  const nowPercent = clamp((elapsed / span) * 100, 0, 100);
  const timeLeft = formatMealTimeLeft(remaining);

  return {
    resting: false,
    hiddenForDay: false,
    serving: Boolean(servingMeal),
    firstServingHour: false,
    servingMeal: servingMeal ?? null,
    followingMeal: nextMeal,
    nextMealId: nextMeal.id,
    label: nextMeal.label,
    fillPercent,
    nowPercent,
    timeLeft,
    targetLabel: formatShelfMealTime(nextMeal.time),
    message: `You will eat ${String(nextMeal.label).toUpperCase()}\nin ${timeLeft}.`,
  };
}

function getFollowingMeal(currentMeal, meals) {
  const currentIndex = meals.findIndex((meal) => meal.id === currentMeal.id);
  return meals[currentIndex + 1] ?? meals[0] ?? null;
}

function formatMealTimeLeft(minutesRemaining) {
  const rounded = Math.max(1, Math.ceil(minutesRemaining));
  if (rounded < 60) {
    return `${rounded} ${pluralize("minute", rounded)}`;
  }
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!minutes) return `${hours} ${pluralize("hour", hours)}`;
  return `${hours} ${pluralize("hour", hours)}, ${minutes} ${pluralize("minute", minutes)}`;
}

function formatShelfMealTime(time) {
  const minutes = parseTimeToMinutes(time);
  const hour24 = Math.floor(minutes / 60);
  const hour = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "pm" : "am";
  return `${hour} ${suffix}`;
}

function toTitleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
