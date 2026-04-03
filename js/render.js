/**
 * render.js
 * =========
 *
 * DOM updates only.
 *
 * Important design choice
 * -----------------------
 * All rendering should be driven by a single view model assembled in main.js.
 * That keeps this file focused and easy to reason about.
 */

import { renderClock } from "./render/clock.js";
import { renderNextCard } from "./render/next-card.js";
import { renderTodayList } from "./render/today-list.js";

/** @param {Document} root */
function getDom(root = document) {
  return {
    dayLabel: root.getElementById("day-label"),
    dateLabel: root.getElementById("date-label"),

    nextLabel: root.getElementById("next-label"),
    nextTime: root.getElementById("next-time"),
    nextSecondary: root.getElementById("next-secondary"),

    countdownText: root.getElementById("countdown-text"),
    progressShell: root.getElementById("progress-shell"),
    progressFill: root.getElementById("progress-fill"),
    happeningSoonSticker: root.getElementById("happening-soon-sticker"),

    help1: root.getElementById("help1"),
    help2: root.getElementById("help2"),
    encouragementNoteText: root.getElementById("encouragement-note-text"),

    ledClock: root.getElementById("led-clock"),
    todayEvents: root.getElementById("today-events"),
  };
}

/**
 * Render the entire screen from one view model.
 *
 * @param {any} viewModel
 */
export function renderView(viewModel) {
  const dom = getDom();

  renderHeader(dom, viewModel);
  renderNextCard(dom, viewModel);
  renderHelpText(dom, viewModel);
  renderEncouragementNote(dom, viewModel);
  renderClock(dom, viewModel);
  renderTodayList(dom, viewModel);
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderHeader(dom, vm) {
  dom.dayLabel.textContent = vm.dayLabel;
  dom.dateLabel.textContent = vm.dateLabel;
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderHelpText(dom, vm) {
  dom.help1.textContent = vm.help1 || "";
  dom.help2.textContent = vm.help2 || "";
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderEncouragementNote(dom, vm) {
  dom.encouragementNoteText.textContent = vm.encouragementNote || "";
}
