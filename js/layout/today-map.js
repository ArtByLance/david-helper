const DAY_START_MINUTES = 5 * 60;
const DAY_END_MINUTES = 23 * 60;
const TODAY_INNER_TOP_PAD = 0;
const TODAY_INNER_BOTTOM_PAD = 90;
const EVEN_WEIGHT = 0.06;
const PROPORTIONAL_WEIGHT = 0.94;
const MIN_VERTICAL_SPACING = 40;

/**
 * Position TODAY rows using a hybrid model:
 * - mostly even list spacing
 * - partly proportional to real time of day
 *
 * Returns center Y values relative to #today-section.
 *
 * @param {{ eventKey?: string, time: string, timeMinutes?: number, label?: string }[]} todayEvents
 * @returns {Map<string, number>}
 */
export function layoutTodayEvents(todayEvents) {
  const map = new Map();
  const section = document.getElementById('today-section');
  const panel = document.getElementById('today-panel');
  const container = document.getElementById('today-events');
  const rows = Array.from(document.querySelectorAll('.today-event-row'));

  if (!section || !panel || !container || !rows.length || !todayEvents?.length) {
    return map;
  }

  container.style.position = 'relative';
  const panelStyle = getComputedStyle(panel);
  const panelContentHeight = Math.max(
    1,
    panel.clientHeight -
      Number.parseFloat(panelStyle.paddingTop || '0') -
      Number.parseFloat(panelStyle.paddingBottom || '0')
  );
  container.style.height = `${Math.round(panelContentHeight)}px`;

  const sectionRect = section.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const panelTopInSection = panelRect.top - sectionRect.top;
  const containerTopInSection = containerRect.top - sectionRect.top;

  // Literal anchor targets:
  // - 5:00 lands on TODAY panel top border
  // - 23:00 lands on bottom of visible screen section
  const topAnchorInContainer = panelTopInSection - containerTopInSection;
  const bottomAnchorInContainer = section.clientHeight - containerTopInSection;
  const usableTop = topAnchorInContainer + TODAY_INNER_TOP_PAD;
  const usableBottom = Math.max(usableTop, bottomAnchorInContainer - TODAY_INNER_BOTTOM_PAD);
  const usableHeight = Math.max(1, usableBottom - usableTop);
  const dayStartYInSection = containerTopInSection + usableTop;

  const points = rows.map((row, index) => {
    const item = todayEvents[index];
    const timeMinutes = Number(row.dataset.timeMinutes ?? item?.timeMinutes ?? DAY_START_MINUTES);
    const rowHeight = Math.max(1, row.offsetHeight || 1);

    const proportionalT = clamp(
      (timeMinutes - DAY_START_MINUTES) / (DAY_END_MINUTES - DAY_START_MINUTES),
      0,
      1
    );
    const proportionalY = usableTop + proportionalT * usableHeight;

    const evenT = rows.length === 1 ? 0.5 : index / (rows.length - 1);
    const evenY = usableTop + evenT * usableHeight;

    return {
      row,
      eventKey: row.dataset.eventKey ?? `${row.dataset.time ?? ''}|${item?.label ?? ''}`,
      time: row.dataset.time ?? item?.time ?? '',
      rowHeight,
      targetY: EVEN_WEIGHT * evenY + PROPORTIONAL_WEIGHT * proportionalY
    };
  });

  const maxRowHeight = Math.max(...points.map((point) => point.rowHeight), 1);
  const minGap = Math.max(MIN_VERTICAL_SPACING, Math.round(maxRowHeight * 0.55));

  for (let index = 1; index < points.length; index += 1) {
    points[index].targetY = Math.max(
      points[index].targetY,
      points[index - 1].targetY + minGap
    );
  }

  const overflow = points[points.length - 1].targetY - usableBottom;
  if (overflow > 0) {
    for (const point of points) {
      point.targetY -= overflow;
    }
  }

  if (points[0].targetY < usableTop) {
    const underflow = usableTop - points[0].targetY;
    for (const point of points) {
      point.targetY += underflow;
    }
  }

  for (let index = points.length - 2; index >= 0; index -= 1) {
    points[index].targetY = Math.min(
      points[index].targetY,
      points[index + 1].targetY - minGap
    );
  }
  for (let index = 1; index < points.length; index += 1) {
    points[index].targetY = Math.max(
      points[index].targetY,
      points[index - 1].targetY + minGap
    );
  }

  for (const point of points) {
    const top = point.targetY - point.rowHeight / 2;
    point.row.style.top = `${Math.round(top)}px`;

    const yInSection = containerTopInSection + point.targetY;
    map.set(point.eventKey, yInSection);
    map.set(point.time, yInSection);
  }

  // Synthetic anchor when we're before the first scheduled event.
  // This keeps 5:00 behavior stable even without an explicit 5:00 row.
  map.set('__dayStart', dayStartYInSection);

  return map;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
