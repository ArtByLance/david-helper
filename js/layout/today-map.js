const DAY_START_MINUTES = 5 * 60;

/**
 * Position TODAY rows as a simple evenly spaced list.
 * Hybrid/time-weighted spacing is intentionally suspended for this phase.
 *
 * Returns center Y values in the local layout space of #today-text-group.
 *
 * Important:
 * The schedule paper is visually transformed in CSS, but the NOW flag lives
 * inside that same transformed group. So the flag must follow local layout
 * coordinates, not already-transformed screen pixels, or it will drift more
 * and more as it moves down the page.
 *
 * @param {{ eventKey?: string, time: string, timeMinutes?: number, label?: string }[]} todayEvents
 * @returns {Map<string, number>}
 */
export function layoutTodayEvents(todayEvents) {
  const map = new Map();
  const section = document.getElementById("today-section");
  const textGroup = document.getElementById("today-text-group");
  const panel = document.getElementById("today-panel");
  const container = document.getElementById("today-events");
  const rows = Array.from(document.querySelectorAll(".today-event-row"));

  if (
    !section ||
    !textGroup ||
    !panel ||
    !container ||
    !rows.length ||
    !todayEvents?.length
  ) {
    return map;
  }

  container.style.position = "relative";
  const containerHeight = Math.max(
    1,
    container.clientHeight || panel.clientHeight || section.clientHeight,
  );
  container.style.height = `${Math.round(containerHeight)}px`;

  const points = rows.map((row, index) => {
    const rowHeight = Math.max(1, row.offsetHeight || 1);
    const t = rows.length === 1 ? 0.5 : index / (rows.length - 1);
    const targetY = t * containerHeight;
    const top = targetY - rowHeight / 2;
    row.style.top = `${Math.round(top)}px`;
    return {
      row,
      eventKey: row.dataset.eventKey ?? "",
      time: row.dataset.time ?? "",
      timeMinutes: Number(row.dataset.timeMinutes ?? DAY_START_MINUTES),
      targetY,
    };
  });

  // Measure row centers in the group's own local layout coordinates.
  for (const point of points) {
    const yInGroup =
      getOffsetWithinAncestor(point.row, textGroup) + point.row.offsetHeight / 2;
    if (point.eventKey) map.set(point.eventKey, yInGroup);
    if (point.time) map.set(point.time, yInGroup);
    map.set(`__m:${point.timeMinutes}`, yInGroup);
  }

  // Time-cluster anchors for shared-time events.
  const byMinute = new Map();
  for (const point of points) {
    const key = `__cluster:${point.timeMinutes}`;
    if (!byMinute.has(key)) byMinute.set(key, []);
    byMinute.get(key).push(point);
  }
  for (const [key, grouped] of byMinute.entries()) {
    if (!grouped.length) continue;
    const ys = [];
    for (const point of grouped) {
      ys.push(
        getOffsetWithinAncestor(point.row, textGroup) + point.row.offsetHeight / 2,
      );
    }
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
    const minute = key.replace("__cluster:", "");
    map.set(key, centerY);
    map.set(`__clusterStart:${minute}`, minY);
    map.set(`__clusterEnd:${minute}`, maxY);
  }

  // Stable time anchors for NOW flag range.
  const dayStartYInGroup = getOffsetWithinAncestor(panel, textGroup);
  const dayEndYInGroup = Math.max(textGroup.clientHeight, section.clientHeight);
  map.set("__dayStart", dayStartYInGroup);
  map.set("__screenBottom", dayEndYInGroup);

  return map;
}

/**
 * Return the local Y offset of an element inside an ancestor.
 *
 * Think of this as "how far down the paper is this thing before any fancy
 * perspective effects get painted on top?"
 *
 * @param {HTMLElement} element
 * @param {HTMLElement} ancestor
 * @returns {number}
 */
function getOffsetWithinAncestor(element, ancestor) {
  let offset = 0;
  let current = element;

  while (current && current !== ancestor) {
    offset += current.offsetTop || 0;
    current = /** @type {HTMLElement | null} */ (current.offsetParent);
  }

  return current === ancestor ? offset : 0;
}
