/**
 * Render the TODAY event list.
 *
 * The list is small, so we rebuild it from scratch each time.
 * That keeps this code easy to trust and easy to read.
 *
 * @param {{ todayEvents: HTMLElement }} dom
 * @param {{ todayEvents: any[] }} vm
 */
export function renderTodayList(dom, vm) {
  dom.todayEvents.innerHTML = "";

  for (const item of vm.todayEvents) {
    const row = document.createElement("div");
    row.className = "today-event-row";
    row.dataset.eventKey = item.eventKey ?? `${item.time}|${item.label}`;
    row.dataset.time = item.time;
    row.dataset.timeMinutes = String(item.timeMinutes ?? "");
    row.dataset.source = item.source ?? "daily";
    row.dataset.highlight = String(Boolean(item.highlight));
    row.dataset.past = String(item.isPast);
    row.dataset.focal = String(item.isFocal);
    row.dataset.clustered = String(item.isClustered);
    row.style.position = "absolute";
    row.style.left = "0";
    row.style.right = "0";

    const time = document.createElement("div");
    time.className = "today-time";
    time.textContent = item.timeDisplay;

    const label = document.createElement("div");
    label.className = "today-label";
    label.textContent = item.label;

    row.appendChild(time);
    row.appendChild(label);
    dom.todayEvents.appendChild(row);
  }
}
