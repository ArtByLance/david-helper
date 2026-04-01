/**
 * utils.js
 * ========
 *
 * Shared helper functions used across modules.
 *
 * Why this file exists
 * --------------------
 * Small pure functions tend to get reused everywhere:
 * - time parsing
 * - date formatting
 * - singular/plural wording
 * - safe string helpers
 *
 * Keeping them here prevents the other modules from bloating.
 */

/** @param {string} value */
export function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * Convert "HH:MM" to minutes after midnight.
 * Example:
 *   parseTimeToMinutes('12:00') -> 720
 *   parseTimeToMinutes('09:15') -> 555
 *
 * @param {string} hhmm
 * @returns {number}
 */
export function parseTimeToMinutes(hhmm) {
  const [hour, minute] = hhmm.split(':').map(Number);
  return hour * 60 + minute;
}

/**
 * Convert minutes after midnight to "H:MM" 12-hour display without AM/PM.
 * Example:
 *   minutesToShortDisplay(720) -> "12:00"
 *   minutesToShortDisplay(555) -> "9:15"
 *
 * @param {number} totalMinutes
 * @returns {string}
 */
export function minutesToShortDisplay(totalMinutes) {
  const safe = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  let hours = Math.floor(safe / 60);
  const minutes = safe % 60;

  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${pad2(minutes)}`;
}

/**
 * Format the live clock the same way David is used to seeing it.
 * Example:
 *   11:32
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatClock(date) {
  return minutesToShortDisplay(date.getHours() * 60 + date.getMinutes());
}

/**
 * Format the date in the desired style.
 * Example:
 *   APRIL 1, 2026
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatDateLabel(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).formatToParts(date);

  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  const year = parts.find((part) => part.type === 'year')?.value ?? '';

  return `${month.toUpperCase()} ${day}, ${year}`;
}

/**
 * Format the weekday in all caps.
 * Example:
 *   WEDNESDAY
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatDayLabel(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' })
    .format(date)
    .toUpperCase();
}

/**
 * Return YYYY-MM-DD in local time.
 * Used to match schedule override keys.
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Return lowercase weekday key used by week.json.
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatWeekdayKey(date) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' })
    .format(date)
    .toLowerCase();
}

/**
 * Format a positive countdown in easy language.
 * Examples:
 *   90 -> "1 hour and 30 minutes to go"
 *   60 -> "1 hour to go"
 *   45 -> "45 minutes to go"
 *   1  -> "1 minute to go"
 *
 * @param {number} minutesRemaining
 * @returns {string}
 */
export function formatCountdown(minutesRemaining) {
  const rounded = Math.max(0, Math.ceil(minutesRemaining));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;

  if (rounded < 60) {
    return `${rounded} ${pluralize('minute', rounded)} to go`;
  }

  if (minutes === 0) {
    return `${hours} ${pluralize('hour', hours)} to go`;
  }

  return `${hours} ${pluralize('hour', hours)} and ${minutes} ${pluralize(
    'minute',
    minutes
  )} to go`;
}

/**
 * @param {string} word
 * @param {number} count
 * @returns {string}
 */
export function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

/**
 * Safely convert possibly-empty string-like values to trimmed strings.
 * Useful when optional help1/help2 fields are missing.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function toCleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
