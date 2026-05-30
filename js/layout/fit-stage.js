/**
 * Scale the 800x1280 stage to fit the browser window.
 * This preserves tablet proportions during local development.
 */
export function fitStageToViewport() {
  const shell = document.getElementById('app-shell');
  const stage = document.getElementById('tv-stage');
  if (!shell || !stage) return;

  const shellWidth = shell.clientWidth;
  const shellHeight = shell.clientHeight;
  const stageWidth = stage.offsetWidth;
  const stageHeight = stage.offsetHeight;

  const scale = Math.min(shellWidth / stageWidth, shellHeight / stageHeight);
  stage.style.transform = `scale(${scale})`;
}
