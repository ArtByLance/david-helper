const HOLD_MS = 1000;

let launchTimer = null;
let launchButton = null;

export function isLauncherRoute(pathname = window.location.pathname) {
  const params = new URLSearchParams(window.location.search);
  if (params.get("helper") || params.get("mode")) return false;

  const route = pathname.replace(/\/+$/, "").toLowerCase();
  return route === "" || route === "/index.html";
}

export function isChairRoute(pathname = window.location.pathname) {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return (
    pathname.replace(/\/+$/, "").toLowerCase() === "/chair" ||
    mode?.toLowerCase() === "chair"
  );
}

export function isTvRoute(pathname = window.location.pathname) {
  const mode = new URLSearchParams(window.location.search).get("mode");
  return (
    pathname.replace(/\/+$/, "").toLowerCase() === "/tv" ||
    mode?.toLowerCase() === "tv"
  );
}

export function startLauncher() {
  document.documentElement.classList.add("launcher-mode");
  const stage = document.getElementById("tv-stage");
  stage?.setAttribute("data-launcher", "true");
  stage?.removeAttribute("data-home");
  stage?.removeAttribute("data-helper-door");

  const main = document.getElementById("app-main");
  if (!main) return;

  main.innerHTML = `
    <section class="screen launcher-screen" aria-label="Choose tablet mode">
      <div class="launcher-card">
        <p class="launcher-kicker">START TABLET</p>
        <h1>Is this tablet for standing at the DOOR, sitting in the CHAIR, or watching TV?</h1>
        <div class="launcher-options">
          ${renderLauncherOption({
            mode: "door",
            title: "DOOR",
            description: "Standing at the door",
            icon: "door",
          })}
          ${renderLauncherOption({
            mode: "chair",
            title: "CHAIR",
            description: "Sitting in the chair",
            icon: "chair",
          })}
          ${renderLauncherOption({
            mode: "tv",
            title: "TV",
            description: "Simple TV player",
            icon: "tv",
          })}
        </div>
        <p class="launcher-instruction">PRESS AND HOLD TO START</p>
      </div>
    </section>
  `;

  main.addEventListener("pointerdown", handleLaunchPointerDown);
  main.addEventListener("pointerup", cancelLaunchHold);
  main.addEventListener("pointerleave", cancelLaunchHold);
  main.addEventListener("pointercancel", cancelLaunchHold);
}

function renderLauncherOption({ mode, title, description, icon }) {
  return `
    <button class="launcher-option launcher-option-${mode}" data-launch-mode="${mode}" type="button">
      <span class="launcher-icon launcher-icon-${icon}" aria-hidden="true"></span>
      <strong>${title}</strong>
      <span>${description}</span>
      <i class="launcher-hold-progress" aria-hidden="true"></i>
    </button>
  `;
}

function handleLaunchPointerDown(event) {
  const button = event.target.closest?.("[data-launch-mode]");
  if (!button) return;

  cancelLaunchHold();
  launchButton = button;
  launchButton.classList.add("is-holding");
  launchButton.setPointerCapture?.(event.pointerId);

  launchTimer = window.setTimeout(() => {
    const mode = launchButton?.dataset.launchMode;
    cancelLaunchHold();
    if (mode === "door") {
      window.location.replace(getLaunchUrl("door"));
    } else if (mode === "chair" || mode === "tv") {
      window.location.replace(getLaunchUrl(mode));
    }
  }, HOLD_MS);
}

function getLaunchUrl(mode) {
  if (isLocalFileServer()) {
    if (mode === "door") return "/index.html?helper=door";
    return `/index.html?mode=${mode}`;
  }
  if (mode === "door") return "/helper/door";
  return `/${mode}`;
}

function isLocalFileServer() {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(
    window.location.hostname,
  );
}

function cancelLaunchHold() {
  window.clearTimeout(launchTimer);
  launchTimer = null;
  launchButton?.classList.remove("is-holding");
  launchButton = null;
}
