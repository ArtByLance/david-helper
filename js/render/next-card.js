/**
 * Render the NEXT card.
 *
 * This file owns the little state machine for that card:
 * either we are showing the countdown/progress pair, or we are showing the
 * HAPPENING SOON sticker. Never both at once.
 *
 * @param {{
 *   nextLabel: HTMLElement,
 *   nextTime: HTMLElement,
 *   nextSecondary: HTMLElement,
 *   countdownText: HTMLElement,
 *   progressShell: HTMLElement,
 *   progressFill: HTMLElement,
 *   happeningSoonSticker: HTMLElement
 * }} dom
 * @param {any} vm
 */
export function renderNextCard(dom, vm) {
  dom.nextLabel.textContent = vm.nextLabel || "";
  dom.nextTime.textContent = vm.nextTime || "";
  dom.nextSecondary.textContent = vm.nextSecondary || "";
  dom.nextSecondary.classList.toggle("hidden", !vm.nextSecondary);

  dom.countdownText.classList.add("hidden");
  dom.progressShell.classList.add("hidden");
  dom.happeningSoonSticker.hidden = true;
  dom.happeningSoonSticker.classList.add("hidden");

  if (vm.showHappeningSoon) {
    dom.happeningSoonSticker.hidden = false;
    dom.happeningSoonSticker.classList.remove("hidden");
    dom.countdownText.textContent = "";
    return;
  }

  if (!vm.showProgress) return;

  dom.countdownText.classList.remove("hidden");
  dom.progressShell.classList.remove("hidden");
  renderCountdownText(dom.countdownText, vm.countdownText || "");
  const remainingPercent = Math.max(
    0,
    Math.min(100, 100 - Math.round(vm.progressFraction * 100)),
  );
  dom.progressFill.style.width =
    remainingPercent > 0 ? `calc(${remainingPercent}% - 9px)` : "0";
}

/**
 * Render countdown as semantic tokens so numbers can be visually emphasized.
 *
 * @param {HTMLElement} target
 * @param {string} countdownText
 */
function renderCountdownText(target, countdownText) {
  const text = String(countdownText || "").trim();
  target.innerHTML = "";
  if (!text) return;

  // We split the string on purpose so the numbers can be bigger and easier to
  // spot from across the room.
  const twoUnitMatch = text.match(
    /^(\d+)\s+(hour|hours)\s+and\s+(\d+)\s+(minute|minutes)\s+to\s+go$/i,
  );
  if (twoUnitMatch) {
    appendToken(target, twoUnitMatch[1], "count-num");
    appendToken(target, ` ${twoUnitMatch[2]} `, "count-unit");
    appendToken(target, twoUnitMatch[3], "count-num");
    appendToken(target, ` ${twoUnitMatch[4]}`, "count-tail");
    return;
  }

  const oneUnitMatch = text.match(/^(\d+)\s+(minute|minutes)\s+to\s+go$/i);
  if (oneUnitMatch) {
    appendToken(target, oneUnitMatch[1], "count-num");
    appendToken(target, ` ${oneUnitMatch[2]}`, "count-tail");
    return;
  }

  const oneHourMatch = text.match(/^(\d+)\s+(hour|hours)\s+to\s+go$/i);
  if (oneHourMatch) {
    appendToken(target, oneHourMatch[1], "count-num");
    appendToken(target, ` ${oneHourMatch[2]}`, "count-tail");
    return;
  }

  target.textContent = text.replace(/\s+to\s+go$/i, "");
}

/**
 * @param {HTMLElement} target
 * @param {string} text
 * @param {string} className
 */
function appendToken(target, text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  target.appendChild(span);
}
