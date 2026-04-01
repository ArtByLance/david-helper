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

/** @param {Document} root */
function getDom(root = document) {
  return {
    dayLabel: root.getElementById('day-label'),
    dateLabel: root.getElementById('date-label'),
    locationLabel: root.getElementById('location-label'),
    topPrompt: root.getElementById('top-prompt'),

    nextLabel: root.getElementById('next-label'),
    nextTime: root.getElementById('next-time'),

    countdownText: root.getElementById('countdown-text'),
    progressShell: root.getElementById('progress-shell'),
    progressFill: root.getElementById('progress-fill'),
    happeningSoonPill: root.getElementById('happening-soon-pill'),

    help1: root.getElementById('help1'),
    help2: root.getElementById('help2'),

    ledClock: root.getElementById('led-clock'),
    todayEvents: root.getElementById('today-events')
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
  dom.locationLabel.textContent = vm.locationLabel;
  dom.topPrompt.textContent = vm.topPrompt;
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderNextCard(dom, vm) {
  dom.nextLabel.textContent = vm.nextLabel || '';
  dom.nextTime.textContent = vm.nextTime || '';

  // Reset visibility first so only one state can be shown at a time.
  dom.countdownText.classList.add('hidden');
  dom.progressShell.classList.add('hidden');
  dom.happeningSoonPill.hidden = true;
  dom.happeningSoonPill.classList.add('hidden');
  dom.happeningSoonPill.textContent = 'HAPPENING SOON';

  if (vm.showHappeningSoon) {
    dom.happeningSoonPill.hidden = false;
    dom.happeningSoonPill.classList.remove('hidden');
    dom.countdownText.textContent = '';
    return;
  }

  if (vm.showProgress) {
    dom.countdownText.classList.remove('hidden');
    dom.progressShell.classList.remove('hidden');
    dom.countdownText.textContent = vm.countdownText || '';
    dom.progressFill.style.width = `${Math.round(vm.progressFraction * 100)}%`;
  }
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderHelpText(dom, vm) {
  dom.help1.textContent = vm.help1 || '';
  dom.help2.textContent = vm.help2 || '';
}

/**
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderClock(dom, vm) {
  const rawClock = String(vm.clockText ?? '');
  const [rawHours = '', rawMinutes = ''] = rawClock.split(':');
  const hours = (rawHours.trim().replace(/^0+(?=\d)/, '') || '0').slice(-2);
  const minutes = rawMinutes.trim().padStart(2, '0').slice(-2);

  const clockStrip = document.createElement('div');
  clockStrip.className = 'clock-time-strip';
  if (hours.length === 1) {
    clockStrip.classList.add('clock-single-hour');
  }

  const hourGroup = document.createElement('span');
  hourGroup.className = 'clock-hours';
  hourGroup.textContent = hours;

  const separatorGroup = document.createElement('span');
  separatorGroup.className = 'clock-colon';
  separatorGroup.setAttribute('aria-hidden', 'true');
  separatorGroup.textContent = ':';

  const minuteGroup = document.createElement('span');
  minuteGroup.className = 'clock-minutes';
  minuteGroup.textContent = minutes;

  clockStrip.appendChild(hourGroup);
  clockStrip.appendChild(separatorGroup);
  clockStrip.appendChild(minuteGroup);

  // Keep a clean spoken label for assistive technologies.
  dom.ledClock.setAttribute('aria-label', `Current time ${hours}:${minutes}`);
  dom.ledClock.innerHTML = '';
  dom.ledClock.appendChild(clockStrip);
}

/**
 * Rebuild the TODAY list every tick.
 * For this app, the list is small, so the simplicity is worth it.
 *
 * @param {ReturnType<typeof getDom>} dom
 * @param {any} vm
 */
function renderTodayList(dom, vm) {
  dom.todayEvents.innerHTML = '';

  for (const item of vm.todayEvents) {
    const row = document.createElement('div');
    row.className = 'today-event-row';
    row.dataset.time = item.time;
    row.dataset.past = String(item.isPast);
    row.dataset.focal = String(item.isFocal);

    const time = document.createElement('div');
    time.className = 'today-time';
    time.textContent = item.timeDisplay;

    const label = document.createElement('div');
    label.className = 'today-label';
    label.textContent = item.label;

    row.appendChild(time);
    row.appendChild(label);
    dom.todayEvents.appendChild(row);
  }
}
