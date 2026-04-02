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
    renderCountdownText(dom.countdownText, vm.countdownText || '');
    const remainingPercent = Math.max(0, Math.min(100, 100 - Math.round(vm.progressFraction * 100)));
    dom.progressFill.style.width = `${remainingPercent}%`;
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
  drawLedClock(dom.ledClock, hours, minutes);
  dom.ledClock.setAttribute('aria-label', `Current time ${hours}:${minutes}`);
}

/**
 * Draw clock text in canvas using actual glyph bounds so spacing is based
 * on the rendered character edges instead of DOM text boxes.
 *
 * @param {HTMLElement} host
 * @param {string} hours
 * @param {string} minutes
 */
function drawLedClock(host, hours, minutes) {
  if (!host) return;

  const text = `${hours}:${minutes}`;
  let canvas = host.querySelector('canvas.clock-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'clock-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.innerHTML = '';
    host.appendChild(canvas);
  }

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(host.clientWidth));
  const height = Math.max(1, Math.round(host.clientHeight));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const style = getComputedStyle(host);
  const fontSize = style.fontSize || '84px';
  const fontWeight = style.fontWeight || '700';
  const fontFamily = style.fontFamily || 'sans-serif';
  const fontSizePx = Number.parseFloat(fontSize) || 84;
  const contentScale = 0.75; // Shrink the number container by 25%.
  const scaledFontPx = Math.max(1, fontSizePx * contentScale);
  ctx.font = `${fontWeight} ${scaledFontPx}px ${fontFamily}`;
  ctx.fillStyle = style.color || '#ff1f1f';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const chars = text.split('');
  const glyphs = chars.map((char) => {
    const m = ctx.measureText(char);
    const left = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : 0;
    const right = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : m.width;
    const ascent = Number.isFinite(m.actualBoundingBoxAscent)
      ? m.actualBoundingBoxAscent
      : scaledFontPx * 0.75;
    const descent = Number.isFinite(m.actualBoundingBoxDescent)
      ? m.actualBoundingBoxDescent
      : scaledFontPx * 0.25;

    return {
      char,
      left,
      right,
      ascent,
      descent,
      inkWidth: Math.max(0, left + right)
    };
  });

  // Smaller gap between regular digits, equal and slightly larger gap around colon.
  const digitGap = Math.round(21 * contentScale);
  const colonGap = Math.round(24 * contentScale);
  let xInk = 0;
  for (let i = 0; i < glyphs.length; i += 1) {
    const g = glyphs[i];
    g.inkLeft = xInk;
    g.originX = g.inkLeft + g.left;
    g.inkRight = g.inkLeft + g.inkWidth;

    if (i < glyphs.length - 1) {
      const next = glyphs[i + 1];
      const gap = g.char === ':' || next.char === ':' ? colonGap : digitGap;
      xInk = g.inkRight + gap;
    } else {
      xInk = g.inkRight;
    }
  }

  const totalInkWidth = xInk;
  const offsetX = (width - totalInkWidth) / 2;
  // Use a stable reference string so vertical centering does not jitter by glyph.
  const ref = ctx.measureText('88:88');
  const refAscent = Number.isFinite(ref.actualBoundingBoxAscent) ? ref.actualBoundingBoxAscent : scaledFontPx * 0.75;
  const refDescent = Number.isFinite(ref.actualBoundingBoxDescent) ? ref.actualBoundingBoxDescent : scaledFontPx * 0.25;
  const baselineY = (height - (refAscent + refDescent)) / 2 + refAscent;

  for (const g of glyphs) {
    ctx.fillText(g.char, offsetX + g.originX, baselineY);
  }
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
    row.dataset.eventKey = item.eventKey ?? `${item.time}|${item.label}`;
    row.dataset.time = item.time;
    row.dataset.timeMinutes = String(item.timeMinutes ?? '');
    row.dataset.past = String(item.isPast);
    row.dataset.focal = String(item.isFocal);
    row.style.position = 'absolute';
    row.style.left = '0';
    row.style.right = '0';

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

/**
 * Render countdown as semantic tokens so numbers can be visually emphasized.
 *
 * @param {HTMLElement} target
 * @param {string} countdownText
 */
function renderCountdownText(target, countdownText) {
  const text = String(countdownText || '').trim();
  target.innerHTML = '';
  if (!text) return;

  // Examples handled:
  // "3 hours and 28 minutes to go"
  // "45 minutes to go"
  // "1 minute to go"
  const twoUnitMatch = text.match(
    /^(\d+)\s+(hour|hours)\s+and\s+(\d+)\s+(minute|minutes)\s+to\s+go$/i
  );
  if (twoUnitMatch) {
    appendToken(target, twoUnitMatch[1], 'count-num');
    appendToken(target, ` ${twoUnitMatch[2]} `, 'count-unit');
    appendToken(target, twoUnitMatch[3], 'count-num');
    appendToken(target, ` ${twoUnitMatch[4]} to go`, 'count-tail');
    return;
  }

  const oneUnitMatch = text.match(/^(\d+)\s+(minute|minutes)\s+to\s+go$/i);
  if (oneUnitMatch) {
    appendToken(target, oneUnitMatch[1], 'count-num');
    appendToken(target, ` ${oneUnitMatch[2]} to go`, 'count-tail');
    return;
  }

  // Fallback to plain content if the format evolves.
  target.textContent = text;
}

/**
 * @param {HTMLElement} target
 * @param {string} text
 * @param {string} className
 */
function appendToken(target, text, className) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  target.appendChild(span);
}
