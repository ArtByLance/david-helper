/**
 * layout.js
 * =========
 *
 * Public layout surface used by main.js.
 * This file intentionally re-exports focused layout modules so callers keep a
 * stable import path while internal responsibilities stay separated.
 */

export { fitStageToViewport } from './layout/fit-stage.js';
export { layoutTodayEvents } from './layout/today-map.js';
export { getTargetY, positionTimeline, renderTimelineDebug } from './layout/timeline.js';
