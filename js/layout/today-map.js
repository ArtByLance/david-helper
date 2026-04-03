const DAY_START_MINUTES = 5 * 60;

/**
 * Position TODAY rows as a simple evenly spaced list.
 * Hybrid/time-weighted spacing is intentionally suspended for this phase.
 *
 * Returns center Y values relative to #today-text-group.
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

  const groupRect = textGroup.getBoundingClientRect();
  const stage = document.getElementById("tv-stage");
  const stageRect = stage ? stage.getBoundingClientRect() : null;
  const panelRect = panel.getBoundingClientRect();
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

  // Measure final rendered row centers after transforms.
  for (const point of points) {
    const rowRect = point.row.getBoundingClientRect();
    const yInGroup = rowRect.top - groupRect.top + rowRect.height / 2;
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
      const rowRect = point.row.getBoundingClientRect();
      ys.push(rowRect.top - groupRect.top + rowRect.height / 2);
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
  const dayStartYInGroup = panelRect.top - groupRect.top;
  const dayEndYInGroup = stageRect
    ? stageRect.bottom - groupRect.top
    : textGroup.clientHeight;
  map.set("__dayStart", dayStartYInGroup);
  map.set("__screenBottom", dayEndYInGroup);

  return map;
}
