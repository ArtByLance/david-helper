/*
 * David's Shelves production shell.
 *
 * This file owns the main kiosk-style experience after index.html loads:
 * 1. Boot/data loading: bootstrap() loads JSON-backed book/show shelves, keeps
 *    clock/meal timers fresh, then delegates every visual update to render().
 * 2. View state: the small state object below is the only navigation model for
 *    HOME, TODAY, SHOWS, BOOKS, selected media, handoff, and reader pages.
 * 3. Rendering: render() swaps full-screen HTML for the active view. Shelf views
 *    use fixed-position photographed shelf panels plus SVG-rendered book/DVD
 *    covers, so many numeric constants are tuned to the background artwork.
 * 4. Media objects: cover art is clipped into photographed object overlays
 *    instead of being laid out as normal rectangles; polygon helpers handle that
 *    geometry and should stay in sync with the PNG masks in assets/objects.
 * 5. Interaction/timing: home swipes, shelf scroll, meal alerts, idle return,
 *    video handoff, and reader turns all mutate state first, then call render().
 *
 * Keep this file conservative. Most visible behavior is art-aligned and intended
 * for an always-on family/kiosk display, so small layout changes can be obvious.
 */
import { MEALS, TODAY_SPECIALS } from "./app-data.js";
import {
  refreshDementiaClocks,
  renderDementiaClock,
} from "./dementia-clock.js";
import { fitStageToViewport } from "./layout.js";
import { launchVideoItem } from "./playback.js";
import { getReaderPageCount, renderReaderView } from "./reader.js";
import {
  formatClock,
  formatDateLabel,
  formatDayLabel,
  formatWeekdayKey,
  parseTimeToMinutes,
  pluralize,
} from "./utils.js";
import { getNow } from "./time.js";

const RECENT_DAYS = 7;
const HANDOFF_MS = 60 * 1000;
const MEAL_ACTIVE_MINUTES = 30;
const ALERT_TRANSITION_MS = 260;
const ALERT_HOME_ENTRY_DELAY_MS = 750;
const VIEW_TRANSITION_OUT_MS = 120;
const VIEW_TRANSITION_IN_MS = 180;
const IDLE_HOME_MS = 5 * 60 * 1000;
const IDLE_CHECK_MS = 15 * 1000;
const SHELF_PANEL_WIDTH = 800;
const FRONT_SHELF_START_X = 1624;
const FRONT_SHELF_BASE_Y = 1016;
// Shelf front-case spacing. Use a negative value if the visible plastic edges
// need to overlap because the source PNG includes transparent side canvas.
const FRONT_SHELF_ITEM_GAP = -100;
const FRONT_SHELF_GROUP_GAP = 230;
const FRONT_SHELF_DVD_HEIGHT = 424;
const FRONT_SHELF_BOOK_HEIGHT = 438;
const FRONT_SHELF_SCALE = 2.4;
const FRONT_SHELF_ROTATION_DEGREES = 4;
const SHELF_EXTENSION_IMAGE = "./assets/shelves/shelf0.jpg";
const HOME_SCENE_BY_DAY_PART = {
  night: "./assets/scenes/main-1.jpg",
  dawn: "./assets/scenes/main-2.jpg",
  day: "./assets/scenes/main-3.jpg",
  sunset: "./assets/scenes/main-4.jpg",
};
const TODAY_CLOCK_IMAGE = "./assets/objects/clock.png";
const TODAY_MENU_IMAGE = "./assets/objects/card-menu.png";
const TODAY_NEXT_FLAG_IMAGE = "./assets/objects/next-flag-2.png";
const TODAY_SPECIAL_IMAGE = "./assets/objects/card-special.png";
const POST_IT_IMAGE = "./assets/objects/post-it.png";
const SHELF_IMAGE_BY_KIND = {
  TODAY: "./assets/shelves/shelf1.jpg",
  SHOWS: "./assets/shelves/shelf2.jpg",
  BOOKS: "./assets/shelves/shelf3.jpg",
};
const TODAY_EXTENSION_PANELS_WITH_SPECIAL = 6;
const TODAY_EXTENSION_PANELS_WITHOUT_SPECIAL = 5;
const dvdFrontSkin = {
  overlay: "./assets/objects/dvd-front.png",
  viewBox: { width: 900, height: 1350 },
  artPolygons: {
    frontArt: "147,254 750,232 820,1122 229,1209",
    spineArt: "102,273 141,253 224,1208 179,1188",
  },
  titlePolygon: "147,254 750,232 820,1122 229,1209",
  hotspotPadding: 10,
};
const bookFrontSkin = {
  ...dvdFrontSkin,
  overlay: "./assets/objects/book-front.png",
};
const mediaSkins = {
  dvd: {
    front: dvdFrontSkin,
  },
  book: {
    front: bookFrontSkin,
  },
};
const MEDIA_FRONT_VIEW_SPINE_OPACITY = 0.4;
const MEDIA_FRONT_TITLE_ROTATION_OFFSET = -4.8;
const MEDIA_FRONT_TITLE_RIGHT_INSET = 92;
const MEDIA_FRONT_TITLE_LEFT_INSET = 126;
const MEDIA_FRONT_TITLE_BOTTOM_INSET = 115;
const MEDIA_DEFAULT_TITLE_TINT = "#fff6df";
let booksShelfMedia = [];
let showsShelfMedia = [];

// Single-page view model. It intentionally stays plain so event handlers can
// mutate state and immediately re-render without hidden framework lifecycle.
const state = {
  view: "HOME",
  activeShelf: null,
  booksScrollLeft: 0,
  showsScrollLeft: 0,
  todayScrollLeft: 0,
  selectedItem: null,
  selectedKind: null,
  takeOffExiting: false,
  readerItem: null,
  readerPage: 0,
  readerTurnDirection: "",
  readerScrollTarget: null,
  readerSwipeStartX: 0,
  readerSwipeStartY: 0,
  readerSwipeStarted: false,
  homeSwipeShelf: null,
  homeSwipeStartX: 0,
  homeSwipeStartY: 0,
  homeSwipeStarted: false,
  homeSwipeConsumed: false,
  handoffItem: null,
  handoffTimer: null,
  videoLaunchDebug: null,
  highlightedShowId: null,
  alertHidden: false,
  alertTransitioning: false,
  viewTransitioning: false,
  lastInteractionAt: Date.now(),
  idleReturnRunning: false,
  recentRead: loadRecent("davidsStuff.recentRead"),
  recentWatched: loadRecent("davidsStuff.recentWatched"),
};

window.addEventListener("DOMContentLoaded", bootstrap);
window.addEventListener("resize", () => {
  fitStageToViewport();
  render();
});

// Load active reader books from the JSON catalog used by the production shelf.
async function loadBooksShelfMedia() {
  try {
    const response = await fetch("./data/reader/readerIndex.json", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Reader index ${response.status}`);

    const sections = await response.json();
    const bookItems = sections.flatMap((section) =>
      (section.items ?? []).map(async (item) => {
        const book = await loadReaderBookDetails(item.id);

        return {
          id: item.id,
          title: book.title ?? item.title,
          displayTitle: book.displayTitle,
          type: "book",
          category: section.title,
          masterArt: `./assets/media/books/${item.id}/${item.id}-book-cover.jpg`,
          cover: `./assets/media/books/${item.id}/${item.id}-book-cover.jpg`,
          openingImage: `./assets/media/books/${item.id}/${item.id}-book-opener.jpg`,
          baseColor: book.baseColor,
          titleTint: book.titleTint,
          chapters: buildReaderBookChapters(item.id, book),
        };
      }),
    );
    booksShelfMedia = await Promise.all(bookItems);
  } catch (error) {
    console.warn("Could not load reader index for book shelf.", error);
    booksShelfMedia = [];
  }
}

// Load the production show list and normalize it into the shared media shape.
async function loadShowsShelfMedia() {
  try {
    const response = await fetch("./data/shows.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Shows ${response.status}`);

    const library = await response.json();
    const categories = orderShowCategories(
      library.categories ?? [],
      library.startCategoryId,
    );

    showsShelfMedia = categories.flatMap((category) =>
      (category.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        command: item.command,
        active: item.active,
        type: "dvd",
        category: category.title,
        baseColor: item.baseColor ?? category.baseColor,
        titleTint: item.titleTint ?? category.titleTint,
        masterArt: `./assets/media/shows/covers/${getShowCoverFile(item.id)}`,
      })),
    );
  } catch (error) {
    console.warn("Could not load shows shelf media.", error);
    showsShelfMedia = [];
  }
}

// Rotate the show shelf so a configured category can be presented first.
function orderShowCategories(categories, startCategoryId) {
  if (!startCategoryId) return categories;

  const startIndex = categories.findIndex(
    (category) => category.id === startCategoryId,
  );
  if (startIndex <= 0) return categories;

  return [
    categories[startIndex],
    ...categories.slice(0, startIndex),
    ...categories.slice(startIndex + 1),
  ];
}

// Convert show ids from data/shows.json into their cover-image filenames.
function getShowCoverFile(id) {
  return `${String(id).replaceAll("_", "-")}.jpg`;
}

// Fetch per-book details so the shelf and reader share cover/color/chapter data.
async function loadReaderBookDetails(id) {
  try {
    const response = await fetch(`./data/reader/books/${id}.json`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Book ${id} ${response.status}`);
    return response.json();
  } catch (error) {
    console.warn(`Could not load reader book ${id}.`, error);
    return {};
  }
}

// Fill in default chapter image paths when a book JSON file omits them.
function buildReaderBookChapters(bookId, book) {
  return (book.chapters ?? []).map((chapter, index) => ({
    ...chapter,
    image:
      chapter.image ??
      `./assets/media/books/${bookId}/${bookId}-chapter-${index + 1}.jpg`,
  }));
}

// Merge optional kiosk VM/config settings without blocking the app on failure.
async function loadKioskConfig() {
  try {
    const response = await fetch("./data/config.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Config ${response.status}`);

    const config = await response.json();
    if (!config.kiosk) return;

    window.KIOSK = {
      ...(window.KIOSK ?? {}),
      ...config.kiosk,
      vm: config.kiosk.vm ?? window.KIOSK?.vm ?? {},
    };
  } catch (error) {
    console.warn("Could not load kiosk config.", error);
  }
}

// Start the app once DOM is ready: route, size, bind, load JSON, then render.
async function bootstrap() {
  applyInitialShelfRoute();
  fitStageToViewport();
  bindGlobalControls();
  await loadKioskConfig();
  await Promise.all([loadBooksShelfMedia(), loadShowsShelfMedia()]);
  render();
  window.setInterval(renderMealTimerOnly, 20 * 1000);
  window.setInterval(checkIdleReturnHome, IDLE_CHECK_MS);
}

// Attach global delegated handlers. The rendered HTML is frequently replaced.
function bindGlobalControls() {
  document
    .getElementById("app-main")
    ?.addEventListener("click", handleMainClick);
  document
    .getElementById("app-main")
    ?.addEventListener("pointerdown", markUserInteraction, {
      capture: true,
      passive: true,
    });
  document
    .getElementById("app-main")
    ?.addEventListener("touchstart", markUserInteraction, {
      capture: true,
      passive: true,
    });
  document
    .getElementById("app-main")
    ?.addEventListener("scroll", handleShelfScroll, {
      capture: true,
      passive: true,
    });
  document
    .getElementById("app-main")
    ?.addEventListener("scroll", handleReaderScroll, {
      capture: true,
      passive: true,
    });
  document
    .getElementById("app-main")
    ?.addEventListener("pointerdown", handleReaderPointerDown);
  document
    .getElementById("app-main")
    ?.addEventListener("pointerup", handleReaderPointerUp);
  document
    .getElementById("app-main")
    ?.addEventListener("pointerdown", handleHomeShelfPointerDown);
  document.addEventListener("pointerup", handleHomeShelfPointerUp);
  document.addEventListener("pointercancel", cancelHomeShelfSwipe);
  document.addEventListener("keydown", markUserInteraction, {
    capture: true,
  });
  document.addEventListener("keydown", handleReaderKeyDown);
}

// Repaint the current screen and restore scroll positions after DOM replacement.
function render() {
  const now = getNow();
  renderMain(now);
  renderMealTimer(now);
  requestAnimationFrame(() => {
    restoreShelfScroll();
    restoreReaderScroll();
  });
}

// Lightweight timer tick used between full renders.
function renderMealTimerOnly() {
  const now = getNow();
  renderMealTimer(now);
  renderLiveClockText(now);
}

// Update live clock text in-place so full shelves do not rebuild every tick.
function renderLiveClockText(now) {
  document
    .querySelectorAll(".home-today-clock-text, .today-led-clock-text")
    .forEach((element) => {
      element.textContent = formatClock(now);
    });
  refreshDementiaClocks(now);
}

// Honor direct shelf links used by local smoke tests and Fire TV shortcuts.
function applyInitialShelfRoute() {
  const params = new URLSearchParams(window.location.search);
  const shelf =
    params.get("openShelf") ?? routeToShelf(window.location.pathname);
  if (!shelf) return;

  state.view = "SHELF";
  state.activeShelf = shelf;
  state.alertHidden = true;
  if (shelf === "TODAY") state.todayScrollLeft = SHELF_PANEL_WIDTH;
  if (shelf === "SHOWS") state.showsScrollLeft = SHELF_PANEL_WIDTH;
  if (shelf === "BOOKS") state.booksScrollLeft = SHELF_PANEL_WIDTH;
  window.history.replaceState({}, "", "./");
}

// Keep persistent layer containers mounted, swapping only each layer's contents.
function renderMain(now) {
  const main = document.getElementById("app-main");
  if (!main) return;

  const stage = document.getElementById("tv-stage");
  setBooleanDataAttribute(stage, "data-home", isHomeView());
  setBooleanDataAttribute(stage, "data-image-shell", isShelfImageView());
  setBooleanDataAttribute(stage, "data-reader", Boolean(state.readerItem));

  const homeLayer = ensureAppLayer(main, "home-layer");
  const shelfLayer = ensureAppLayer(main, "shelf-layer");
  const takeOffLayer = ensureAppLayer(main, "take-off-layer-slot");
  const handoffLayer = ensureAppLayer(main, "handoff-layer");
  const readerLayer = ensureAppLayer(main, "reader-layer");

  renderHomeLayer(homeLayer, now);
  renderShelfLayer(shelfLayer, now);
  renderTakeOffLayerSlot(takeOffLayer);
  renderHandoffLayer(handoffLayer);
  renderReaderLayer(readerLayer);
}

// Lazily create a named app layer under the main stage.
function ensureAppLayer(main, className) {
  let layer = main.querySelector(`.${className}`);
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = `app-layer ${className}`;
  main.appendChild(layer);
  return layer;
}

// The home layer is stable; refresh only time-sensitive pieces after creation.
function renderHomeLayer(layer, now) {
  if (!layer.hasChildNodes()) {
    layer.innerHTML = renderHome(now);
  }

  refreshHomeLayer(layer, now);
  layer.toggleAttribute("aria-hidden", state.view !== "HOME");
}

// Patch home date, scene, and Today objects without recreating the whole screen.
function refreshHomeLayer(layer, now) {
  const dateReadout = getHomeDateReadout(now);
  layer
    .querySelector(".home-main-image")
    ?.setAttribute("src", getHomeScene(now));

  const leftDate = layer.querySelector(
    ".home-date-readout:not(.home-date-readout-right)",
  );
  leftDate?.setAttribute("aria-label", dateReadout.ariaLabel);
  const leftText = leftDate?.querySelector("strong");
  if (leftText) {
    leftText.innerHTML = `<span>${escapeHtml(dateReadout.weekday)}</span> ${escapeHtml(dateReadout.dayPart)}`;
  }

  const rightText = layer.querySelector(".home-date-readout-right small");
  if (rightText) rightText.textContent = dateReadout.dateLabel;

  const todayObjects = layer.querySelector(".home-today-object-layer");
  if (todayObjects) {
    const template = document.createElement("template");
    template.innerHTML = renderHomeTodayObjects(now).trim();
    todayObjects.replaceWith(template.content.firstElementChild);
  }
}

// Render the active shelf image-strip. The key avoids unnecessary DOM churn.
function renderShelfLayer(layer, now) {
  const shouldShowShelf = state.view === "SHELF" && Boolean(state.activeShelf);
  layer.hidden = !shouldShowShelf;
  if (!shouldShowShelf) return;

  const key = `${state.activeShelf}:${state.activeShelf === "TODAY" ? formatWeekdayKey(now) : ""}`;
  if (layer.dataset.renderKey === key) return;

  layer.innerHTML = renderShelfImageShell(state.activeShelf, now);
  layer.dataset.renderKey = key;
}

// Show or hide the selected-media pickup overlay without disturbing shelves.
function renderTakeOffLayerSlot(layer) {
  layer.hidden = !state.selectedItem;
  if (!state.selectedItem) {
    layer.replaceChildren();
    delete layer.dataset.renderKey;
    return;
  }

  const key = `${state.selectedKind}:${state.selectedItem.id}:${state.takeOffExiting}`;
  if (layer.dataset.renderKey === key) return;

  layer.innerHTML = renderTakeOffOverlay();
  layer.dataset.renderKey = key;
}

// Render the temporary "starting video" handoff state while playback launches.
function renderHandoffLayer(layer) {
  layer.hidden = !state.handoffItem;
  if (!state.handoffItem) {
    layer.replaceChildren();
    delete layer.dataset.renderKey;
    return;
  }

  const key = `${state.handoffItem.id}:${state.videoLaunchDebug?.url ?? ""}`;
  if (layer.dataset.renderKey === key) return;

  layer.innerHTML = renderHandoff();
  layer.dataset.renderKey = key;
}

// Mount the reader only when a book is open; otherwise keep the layer empty.
function renderReaderLayer(layer) {
  layer.hidden = !state.readerItem;
  if (!state.readerItem) {
    layer.replaceChildren();
    return;
  }

  layer.innerHTML = renderReaderView({
    item: state.readerItem,
    pageIndex: state.readerPage,
    turnDirection: state.readerTurnDirection,
  });
  state.readerTurnDirection = "";
}

// Use boolean data attributes for CSS state without leaking string values.
function setBooleanDataAttribute(element, name, enabled) {
  if (!element) return;
  if (enabled) {
    element.setAttribute(name, "true");
  } else {
    element.removeAttribute(name);
  }
}

// Owns the supper/lunch/breakfast alert state and its dismissal window.
function renderMealTimer(now) {
  const mealState = getMealState(now);
  const mealTimer = document.getElementById("meal-timer");
  const mealName = document.getElementById("meal-name");
  const mealFill = document.getElementById("meal-bar-fill");
  const mealTarget = document.getElementById("meal-target-label");
  const mealMarker = document.getElementById("meal-now-marker");
  const mealMessage = document.getElementById("meal-message");
  const shouldHideCard =
    Boolean(state.readerItem) ||
    Boolean(state.handoffItem) ||
    state.alertHidden ||
    mealState.hiddenForDay;

  mealTimer?.setAttribute("data-rest", String(mealState.resting));
  mealTimer?.setAttribute("data-eating", String(mealState.eating));
  mealTimer?.setAttribute("data-urgent", String(mealState.urgent));
  mealTimer?.setAttribute("aria-hidden", String(shouldHideCard));
  mealTimer?.classList.toggle("alert-card-hidden", shouldHideCard);
  mealTimer?.style.setProperty(
    "--meal-now-percent",
    `${mealState.nowPercent}%`,
  );
  if (mealName) mealName.textContent = mealState.label;
  if (mealFill) mealFill.style.width = `${mealState.fillPercent}%`;
  if (mealTarget) mealTarget.textContent = mealState.targetLabel;
  if (mealMarker) mealMarker.toggleAttribute("hidden", mealState.resting);
  if (mealMessage) mealMessage.textContent = mealState.message;
}

// Render the home room background and fixed shelf hotspots.
function renderHome(now) {
  const dateReadout = getHomeDateReadout(now);
  const homeScene = getHomeScene(now);

  return `
    <section class="screen home-screen" aria-label="David's Stuff">
      <img class="home-main-image" src="${homeScene}" alt="" aria-hidden="true" draggable="false" />
      ${renderHomeTodayObjects(now)}
      <div class="home-date-readout" aria-label="${escapeAttribute(dateReadout.ariaLabel)}">
        <strong><span>${escapeHtml(dateReadout.weekday)}</span> ${escapeHtml(dateReadout.dayPart)}</strong>
      </div>
      <div class="home-date-readout home-date-readout-right" aria-hidden="true">
        <small>${escapeHtml(dateReadout.dateLabel)}</small>
      </div>
      <button class="home-tap-zone today-tap-zone" type="button" data-action="expand-shelf" data-shelf="TODAY" aria-label="Today shelf"></button>
      <button class="home-tap-zone shows-tap-zone" type="button" data-action="expand-shelf" data-shelf="SHOWS" aria-label="Shows shelf"></button>
      <button class="home-tap-zone books-tap-zone" type="button" data-action="expand-shelf" data-shelf="BOOKS" aria-label="Books shelf"></button>
    </section>
  `;
}

// Render clickable Today objects that sit on the home shelf photo.
function renderHomeTodayObjects(now) {
  const weekdayKey = formatWeekdayKey(now);
  const special = TODAY_SPECIALS[weekdayKey];
  const mealState = getMealState(now);

  return `
    <div class="home-today-object-layer" data-has-special="${Boolean(special)}" aria-hidden="true">
      <div class="home-today-clock">
        <img src="${TODAY_CLOCK_IMAGE}" alt="" draggable="false" />
        <div class="home-today-clock-display">
          <div class="home-today-clock-text">${formatClock(now)}</div>
        </div>
      </div>
      ${special ? renderHomeTodaySpecialCard(special) : ""}
      ${renderHomeTodayMealCard(mealState)}
    </div>
  `;
}

// Render the home-shelf special note card when TODAY_SPECIALS has an entry.
function renderHomeTodaySpecialCard(special) {
  return `
    <div class="home-today-special-card">
      <img src="${TODAY_SPECIAL_IMAGE}" alt="" draggable="false" />
      <div class="home-today-special-content">
        <h2>Today</h2>
        <strong>${escapeHtml(special.title)}</strong>
        <span>${escapeHtml(special.time)}</span>
      </div>
    </div>
  `;
}

// Render the compact home meal card; the active meal alert is separate.
function renderHomeTodayMealCard(mealState) {
  return `
    <div class="home-today-menu-card">
      <img src="${TODAY_MENU_IMAGE}" alt="" draggable="false" />
      <div class="home-today-menu-content">
        <h2>Meals Today</h2>
        <div class="home-today-meal-list">
          ${MEALS.map((meal) => renderHomeTodayMealLine(meal, mealState.nextMealId)).join("")}
        </div>
      </div>
    </div>
  `;
}

// Render one row in the home meal card and mark the next scheduled meal.
function renderHomeTodayMealLine(meal, nextMealId) {
  const isNext = meal.id === nextMealId;
  return `
    <div class="home-today-meal-line" data-next="${isNext}">
      ${isNext ? `<img class="home-today-next-meal-flag" src="${TODAY_NEXT_FLAG_IMAGE}" alt="" aria-hidden="true" draggable="false" />` : ""}
      <strong>${toTitleCase(meal.label)}</strong>
      <span>${formatShelfMealTime(meal.time)}</span>
    </div>
  `;
}

// Select the room image by day part so the shelf matches the clock.
function getHomeScene(now) {
  const hour = now.getHours();
  if (hour < 6 || hour >= 20) return HOME_SCENE_BY_DAY_PART.night;
  if (hour < 9) return HOME_SCENE_BY_DAY_PART.dawn;
  if (hour < 17) return HOME_SCENE_BY_DAY_PART.day;
  return HOME_SCENE_BY_DAY_PART.sunset;
}

// Compose the large readable date labels shown on the home scene.
function getHomeDateReadout(now) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
  })
    .format(now)
    .toUpperCase();
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);
  const dayPart = getDayPart(now);

  return {
    weekday,
    dayPart,
    dateLabel,
    ariaLabel: `${weekday} ${dayPart}, ${dateLabel}`,
  };
}

// Coarse daypart buckets matched to the available photographed backgrounds.
function getDayPart(now) {
  const hour = now.getHours();
  if (hour < 6 || hour >= 21) return "Bedtime";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

// Render the scrollable photographed shelf shell for TODAY, SHOWS, or BOOKS.
function renderShelfImageShell(kind, now = getNow()) {
  if (kind === "TODAY") {
    return renderTodayImageShell(now);
  }
  if (kind === "SHOWS") {
    return renderShowsImageStrip();
  }
  if (kind === "BOOKS") {
    return renderBooksImageStrip();
  }

  return `
    <section class="screen shelf-image-screen" aria-label="${toTitleCase(kind)} shelf">
      <img class="shelf-zoom-image" src="${SHELF_IMAGE_BY_KIND[kind]}" alt="" aria-hidden="true" draggable="false" />
      ${renderScrollLabel()}
      <button class="shelf-back-zone" type="button" data-action="back-home" aria-label="Back to home">BACK</button>
    </section>
  `;
}

// Render the Today shelf: clock/menu/special objects over repeated shelf panels.
function renderTodayImageShell(now) {
  const extensionPanelCount = getTodayExtensionPanelCount(now);
  const extensionPanels = Array.from(
    { length: extensionPanelCount },
    () => `
    <img class="shelf-strip-image" src="${SHELF_EXTENSION_IMAGE}" alt="" aria-hidden="true" draggable="false" />
  `,
  ).join("");

  return `
    <section class="screen shelf-image-screen shelf-strip-screen" aria-label="Today shelf">
      <div class="shelf-strip-window" data-shelf-kind="TODAY">
        <div class="shelf-strip-track">
          <img class="shelf-strip-image" src="${SHELF_EXTENSION_IMAGE}" alt="" aria-hidden="true" draggable="false" />
          <img class="shelf-strip-image" src="${SHELF_IMAGE_BY_KIND.TODAY}" alt="" aria-hidden="true" draggable="false" />
          ${extensionPanels}
          ${renderTodayObjects(now)}
          ${renderScrollLabel()}
        </div>
      </div>
      <button class="shelf-back-zone" type="button" data-action="back-home" aria-label="Back to home">BACK</button>
    </section>
  `;
}

// Position Today shelf objects. Coordinates are tuned to the shelf photograph.
function renderTodayObjects(now) {
  const weekdayKey = formatWeekdayKey(now);
  const special = TODAY_SPECIALS[weekdayKey];
  const mealState = getMealState(now);

  return `
    <div class="today-object-layer" data-has-special="${Boolean(special)}">
      <section class="today-menu-card" aria-label="Meals today">
        <img src="${TODAY_MENU_IMAGE}" alt="" aria-hidden="true" draggable="false" />
        <div class="today-card-content">
          <h2>Meals Today</h2>
          <div class="today-meal-list">
            ${MEALS.map((meal) => renderTodayMealLine(meal, mealState.nextMealId)).join("")}
          </div>
        </div>
      </section>

      ${special ? renderTodaySpecialCard(special) : ""}

      <div class="today-led-clock" aria-label="Current time">
        <img src="${TODAY_CLOCK_IMAGE}" alt="" aria-hidden="true" draggable="false" />
        <div class="today-led-clock-display">
          <div class="today-led-clock-text">${formatClock(now)}</div>
        </div>
      </div>

      ${renderDementiaClock(now)}
    </div>
  `;
}

// Render the larger Today special card used inside the shelf view.
function renderTodaySpecialCard(special) {
  return `
    <section class="today-special-card" aria-label="Today">
      <img src="${TODAY_SPECIAL_IMAGE}" alt="" aria-hidden="true" draggable="false" />
      <div class="today-card-content">
        <h2>Today</h2>
        <strong>${special.title}</strong>
        <span>${special.time}</span>
        <p>${special.place}</p>
      </div>
    </section>
  `;
}

// Render a single meal line for the Today shelf plate.
function renderTodayMealLine(meal, nextMealId) {
  const isNext = meal.id === nextMealId;
  return `
    <div class="today-meal-line" data-next="${isNext}">
      ${isNext ? `<img class="today-next-meal-flag" src="${TODAY_NEXT_FLAG_IMAGE}" alt="" aria-hidden="true" draggable="false" />` : ""}
      <strong>${toTitleCase(meal.label)}</strong>
      <span>${formatShelfMealTime(meal.time)}</span>
    </div>
  `;
}

// Render the books shelf as cover rows on the photographed shelf strip.
function renderBooksImageStrip() {
  const extensionPanels = Array.from(
    { length: getBooksExtensionPanelCount() },
    () => `
    <img class="shelf-strip-image" src="${SHELF_EXTENSION_IMAGE}" alt="" aria-hidden="true" draggable="false" />
  `,
  ).join("");

  return `
    <section class="screen shelf-image-screen shelf-strip-screen" aria-label="Books shelf">
      <div class="shelf-strip-window" data-shelf-kind="BOOKS">
        <div class="shelf-strip-track">
          <img class="shelf-strip-image" src="${SHELF_EXTENSION_IMAGE}" alt="" aria-hidden="true" draggable="false" />
          <img class="shelf-strip-image" src="${SHELF_IMAGE_BY_KIND.BOOKS}" alt="" aria-hidden="true" draggable="false" />
          ${extensionPanels}
          ${renderCoverShelfRows("BOOKS", booksShelfMedia, state.recentRead)}
          ${renderScrollLabel()}
        </div>
      </div>
      <button class="shelf-back-zone" type="button" data-action="back-home" aria-label="Back to home">BACK</button>
    </section>
  `;
}

// Render the shows shelf as cover rows on the photographed shelf strip.
function renderShowsImageStrip() {
  const extensionPanels = Array.from(
    { length: getShowsExtensionPanelCount() },
    () => `
    <img class="shelf-strip-image" src="${SHELF_EXTENSION_IMAGE}" alt="" aria-hidden="true" draggable="false" />
  `,
  ).join("");

  return `
    <section class="screen shelf-image-screen shelf-strip-screen" aria-label="Shows shelf">
      <div class="shelf-strip-window" data-shelf-kind="SHOWS">
        <div class="shelf-strip-track">
          <img class="shelf-strip-image" src="${SHELF_EXTENSION_IMAGE}" alt="" aria-hidden="true" draggable="false" />
          <img class="shelf-strip-image" src="${SHELF_IMAGE_BY_KIND.SHOWS}" alt="" aria-hidden="true" draggable="false" />
          ${extensionPanels}
          ${renderCoverShelfRows("SHOWS", showsShelfMedia, state.recentWatched)}
          ${renderScrollLabel()}
        </div>
      </div>
      <button class="shelf-back-zone" type="button" data-action="back-home" aria-label="Back to home">BACK</button>
    </section>
  `;
}

// Render grouped front-cover rows plus enough blank panel extension for scroll.
function renderCoverShelfRows(kind, items, recentMap) {
  const layout = buildFrontShelfLayout(kind, items);

  return `
    <div class="front-shelf-layer front-shelf-layer-${kind.toLowerCase()}">
      ${layout.sections
        .map((section) => renderFrontShelfSectionPlate(kind, section))
        .join("")}
      ${layout.items
        .map((item) => renderFrontShelfItem(kind, item, recentMap))
        .join("")}
    </div>
  `;
}

// Convert grouped media data into fixed shelf coordinates.
function buildFrontShelfLayout(kind, items) {
  let x = FRONT_SHELF_START_X;
  const sections = [];
  const shelfItems = [];

  for (const [category, categoryItems] of groupByCategory(items)) {
    const sectionX = x;

    categoryItems.forEach((item, itemIndex) => {
      const shelfItem = createFrontShelfItem(kind, item, x, itemIndex);
      shelfItems.push(shelfItem);
      x += shelfItem.width + FRONT_SHELF_ITEM_GAP;
    });

    sections.push({
      category,
      x: sectionX,
      width: Math.max(220, x - sectionX - FRONT_SHELF_ITEM_GAP),
    });
    x += FRONT_SHELF_GROUP_GAP;
  }

  return { sections, items: shelfItems, endX: getFrontShelfEndX(shelfItems) };
}

// Build one positioned media item with row/category metadata for labels.
function createFrontShelfItem(kind, item, x, itemIndex) {
  const slotHeight =
    kind === "BOOKS" ? FRONT_SHELF_BOOK_HEIGHT : FRONT_SHELF_DVD_HEIGHT;
  const height = slotHeight * FRONT_SHELF_SCALE;
  const skin = getMediaSkin(item, "front");
  const width = getMediaObjectWidth(skin, height);
  const stagger = itemIndex % 2 === 0 ? 0 : 11;

  return {
    ...item,
    svgScope: `shelf-${kind}-${item.id}`,
    x,
    y: FRONT_SHELF_BASE_Y - height + stagger,
    width,
    height,
    rotationDegrees: FRONT_SHELF_ROTATION_DEGREES,
  };
}

// Calculate the far-right edge of the cover shelf content.
function getFrontShelfEndX(items) {
  if (!items.length) return SHELF_PANEL_WIDTH * 2;
  return Math.max(...items.map((item) => item.x + item.width));
}

// Clamp scroll width based on actual cover layout rather than panel count alone.
function getFrontShelfMaxScrollLeft(kind) {
  const items = kind === "BOOKS" ? booksShelfMedia : showsShelfMedia;
  return Math.max(
    SHELF_PANEL_WIDTH,
    Math.ceil(buildFrontShelfLayout(kind, items).endX),
  );
}

// Extra background panels prevent the shelf strip from ending before content.
function getFrontShelfExtensionPanelCount(kind) {
  const maxScrollLeft = getFrontShelfMaxScrollLeft(kind);
  const requiredContentWidth = maxScrollLeft + SHELF_PANEL_WIDTH;
  return Math.max(1, Math.ceil(requiredContentWidth / SHELF_PANEL_WIDTH) - 2);
}

// Number of shelf extension panels needed for the current shows list.
function getShowsExtensionPanelCount() {
  return getFrontShelfExtensionPanelCount("SHOWS");
}

// Number of shelf extension panels needed for the current book list.
function getBooksExtensionPanelCount() {
  return getFrontShelfExtensionPanelCount("BOOKS");
}

// Maximum horizontal scroll for the shows shelf.
function getShowsMaxScrollLeft() {
  return getFrontShelfMaxScrollLeft("SHOWS");
}

// Maximum horizontal scroll for the books shelf.
function getBooksMaxScrollLeft() {
  return getFrontShelfMaxScrollLeft("BOOKS");
}

// Render a category plate aligned with the first item in that section.
function renderFrontShelfSectionPlate(kind, section) {
  const className =
    kind === "BOOKS" ? "books-section-plate" : "shows-section-plate";

  return `
    <div
      class="section-plate ${className}"
      style="left: ${section.x}px;"
      aria-hidden="true"
    ><span>${escapeHtml(section.category)}</span></div>
  `;
}

// Render one clickable media object sitting on the photographed shelf.
function renderFrontShelfItem(kind, item, recentMap) {
  const recent = isRecent(recentMap[item.id]);
  const highlighted = kind === "SHOWS" && state.highlightedShowId === item.id;
  const skin = getMediaSkin(item, "front");

  return `
    <button
      class="media-object media-front media-front-item front-shelf-media front-shelf-media-${item.type}"
      type="button"
      data-action="take-off"
      data-kind="${kind}"
      data-item-id="${escapeAttribute(item.id)}"
      data-recent="${recent}"
      data-highlighted="${highlighted}"
      aria-label="${escapeAttribute(item.title)}"
      style="--media-x: ${item.x}px; --media-y: ${item.y}px; --media-width: ${item.width}px; --media-height: ${item.height}px; --media-rotation: ${item.rotationDegrees}deg;"
    >
      ${renderMediaObjectContent({ item, mode: "front", skin })}
    </button>
  `;
}

// Render a front-facing book/DVD object; action is optional for overlays.
function renderMediaFrontItem(item, action = "") {
  const skin = getMediaSkin(item, "front");
  const width = getMediaObjectWidth(skin, item.height);
  const actionAttributes = action
    ? `data-action="${escapeAttribute(action)}" role="button" tabindex="0"`
    : "";

  return `
    <div
      class="media-object media-front media-front-item media-front-${item.type}"
      aria-label="${escapeAttribute(item.title)}"
      ${actionAttributes}
      style="--media-x: ${item.x}px; --media-y: ${item.y}px; --media-width: ${width}px; --media-height: ${item.height}px; --media-rotation: ${item.rotationDegrees}deg;"
    >
      ${renderMediaObjectContent({ item, mode: "front", skin })}
    </div>
  `;
}

// Compose the SVG object layers: clipped art, overlay PNG, and title text.
function renderMediaObjectContent({ item, mode, skin }) {
  const title = item.displayTitle ?? item.title;
  const svgId = `${slugify(item.svgScope ?? item.id ?? item.title)}-${mode}`;

  return `
    ${renderMediaArtLayer({ item, mode, skin, svgId })}
    ${renderMediaTitleLayer({ item, title, mode, skin, svgId })}
    <img class="media-overlay" src="${skin.overlay}" alt="" aria-hidden="true" draggable="false" />
  `;
}

// Resolve the skin for a media kind and presentation mode.
function getMediaSkin(item, mode) {
  return mediaSkins[item.type]?.[mode] ?? mediaSkins.dvd[mode];
}

// Preserve overlay aspect ratio when fitting a media object to shelf height.
function getMediaObjectWidth(skin, height) {
  return Math.round((height * skin.viewBox.width) / skin.viewBox.height);
}

// Render all art clipped into the object mask before the overlay PNG is placed.
function renderMediaArtLayer({ item, skin, svgId }) {
  return renderMediaFrontArtLayer({ item, skin, svgId });
}

// Fit cover art into the skewed cover polygon, including side shading.
function renderMediaFrontArtLayer({ item, skin, svgId }) {
  const frontPlacement = polygonPlacement(skin.artPolygons.frontArt);
  const baseColor = item.baseColor;
  const displayColor = baseColor ? enrichMediaColor(baseColor) : "";

  return `
    <svg
      class="media-svg media-artLayer"
      viewBox="0 0 ${skin.viewBox.width} ${skin.viewBox.height}"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        ${renderMediaClipPaths(skin.artPolygons, svgId)}
      </defs>
      <image
        href="${escapeAttribute(item.masterArt)}"
        x="${frontPlacement.x}"
        y="${frontPlacement.y}"
        width="${frontPlacement.width}"
        height="${frontPlacement.height}"
        transform="rotate(${frontPlacement.angle} ${frontPlacement.centerX} ${frontPlacement.centerY})"
        preserveAspectRatio="none"
        clip-path="url(#${svgId}-frontArt)"
      />
      ${
        baseColor
          ? `<rect
              width="${skin.viewBox.width}"
              height="${skin.viewBox.height}"
              fill="${escapeAttribute(displayColor)}"
              clip-path="url(#${svgId}-spineArt)"
            />`
          : ""
      }
      <image
        href="${escapeAttribute(item.masterArt)}"
        width="${skin.viewBox.width}"
        height="${skin.viewBox.height}"
        preserveAspectRatio="xMidYMid slice"
        opacity="${baseColor ? "0.12" : "1"}"
        clip-path="url(#${svgId}-spineArt)"
      />
      <rect
        width="${skin.viewBox.width}"
        height="${skin.viewBox.height}"
        fill="#000"
        opacity="${baseColor ? "0.32" : MEDIA_FRONT_VIEW_SPINE_OPACITY}"
        clip-path="url(#${svgId}-spineArt)"
      />
    </svg>
  `;
}

// Render title text inside the cover-art polygon. The handmade width estimate
// keeps titles from stacking too aggressively without relying on canvas metrics.
function renderMediaTitleLayer({ item, title, skin, svgId }) {
  const titleBox = polygonBounds(skin.titlePolygon);
  const titleTint = item.titleTint ?? MEDIA_DEFAULT_TITLE_TINT;
  const text = renderMediaFrontTitle(title, titleBox, svgId, titleTint);
  const filters = isLitePerformanceMode()
    ? ""
    : `
        <filter id="${svgId}-titleShadow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".9" />
          <feDropShadow dx="0" dy="0" stdDeviation="39" flood-color="#000" flood-opacity=".92" />
        </filter>
      `;

  return `
    <svg
      class="media-svg media-titleLayer"
      viewBox="0 0 ${skin.viewBox.width} ${skin.viewBox.height}"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        ${renderMediaClipPath("title", skin.titlePolygon, svgId)}
        ${filters}
      </defs>
      <g clip-path="url(#${svgId}-title)">
        ${text}
      </g>
    </svg>
  `;
}

// Place wrapped title lines near the lower-right of the angled cover polygon.
function renderMediaFrontTitle(title, titleBox, svgId, titleTint) {
  const maxLineWidth =
    titleBox.maxX -
    MEDIA_FRONT_TITLE_RIGHT_INSET -
    (titleBox.minX + MEDIA_FRONT_TITLE_LEFT_INSET);
  const words = wrapMediaTitleLines(title, maxLineWidth, 76);
  const lineHeight = 72;
  const isLite = isLitePerformanceMode();
  const liteAttrs = isLite
    ? `stroke="#000" stroke-width="5" paint-order="stroke fill"`
    : "";
  const startY =
    titleBox.maxY -
    MEDIA_FRONT_TITLE_BOTTOM_INSET -
    (words.length - 1) * lineHeight;
  const renderLine = (word, index, filter = "") => `
    <text
      class="media-titleText"
      x="${titleBox.maxX - MEDIA_FRONT_TITLE_RIGHT_INSET}"
      y="${startY + index * lineHeight}"
      text-anchor="end"
      font-size="76"
      style="fill: ${escapeAttribute(titleTint)};"
      ${liteAttrs}
      ${filter}
    >${escapeHtml(word)}</text>
  `;
  if (isLite) {
    return `
      <g transform="rotate(${titleBox.angle + MEDIA_FRONT_TITLE_ROTATION_OFFSET} ${titleBox.centerX} ${titleBox.centerY})">
        ${words.map((word, index) => renderLine(word, index)).join("")}
      </g>
    `;
  }

  const glowLines = words
    .map((word, index) =>
      renderLine(word, index, `filter="url(#${svgId}-titleShadow)"`),
    )
    .join("");
  const cleanLines = words
    .map((word, index) => renderLine(word, index))
    .join("");

  return `
    <g transform="rotate(${titleBox.angle + MEDIA_FRONT_TITLE_ROTATION_OFFSET} ${titleBox.centerX} ${titleBox.centerY})">
      ${glowLines}
      ${cleanLines}
    </g>
  `;
}

// Greedy word wrapping tuned for bold SVG title text on angled media covers.
function wrapMediaTitleLines(title, maxLineWidth, fontSize) {
  const words = String(title).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (
      currentLine &&
      estimateMediaTitleWidth(candidate, fontSize) > maxLineWidth
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [String(title)];
}

// Estimate display width cheaply; enough for kiosk title wrapping consistency.
function estimateMediaTitleWidth(value, fontSize) {
  return String(value)
    .split("")
    .reduce((width, char) => {
      if (char === " ") return width + fontSize * 0.22;
      if (/[:;,.!'-]/.test(char)) return width + fontSize * 0.22;
      if (/[ilI1]/.test(char)) return width + fontSize * 0.24;
      if (/[mwMW]/.test(char)) return width + fontSize * 0.64;
      return width + fontSize * 0.48;
    }, 0);
}

// Lite mode drops expensive shadows when the kiosk device struggles with SVG.
function isLitePerformanceMode() {
  return window.KIOSK_PERF_MODE === "lite";
}

// Make supplied base colors richer before using them on narrow side facets.
function enrichMediaColor(hexColor) {
  const rgb = parseHexColor(hexColor);
  if (!rgb) return hexColor;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const saturation = Math.min(0.74, Math.max(0.42, hsl.s * 1.55));
  const lightness = Math.min(0.42, Math.max(0.24, hsl.l + 0.14));
  return hslToHex(hsl.h, saturation, lightness);
}

// Parse six-digit hex colors used by JSON media metadata.
function parseHexColor(hexColor) {
  const match = String(hexColor)
    .trim()
    .match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;

  const value = Number.parseInt(match[1], 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

// Convert RGB to HSL for lightness/saturation tuning.
function rgbToHsl(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: lightness };
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return { h: hue / 6, s: saturation, l: lightness };
}

// Convert tuned HSL values back into CSS hex.
function hslToHex(h, s, l) {
  const hueToRgb = (p, q, t) => {
    let hue = t;
    if (hue < 0) hue += 1;
    if (hue > 1) hue -= 1;
    if (hue < 1 / 6) return p + (q - p) * 6 * hue;
    if (hue < 1 / 2) return q;
    if (hue < 2 / 3) return p + (q - p) * (2 / 3 - hue) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const toHex = (value) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(hueToRgb(p, q, h + 1 / 3))}${toHex(
    hueToRgb(p, q, h),
  )}${toHex(hueToRgb(p, q, h - 1 / 3))}`;
}

// Escape text inserted into template strings as HTML.
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Attribute escaping currently matches HTML escaping for these templates.
function escapeAttribute(value) {
  return escapeHtml(value);
}

// Render all named polygon masks for one media object SVG scope.
function renderMediaClipPaths(polygons, svgId) {
  return Object.entries(polygons)
    .map(([name, polygon]) => renderMediaClipPath(name, polygon, svgId))
    .join("");
}

// Render one SVG clip path with a per-object id to avoid DOM collisions.
function renderMediaClipPath(name, polygon, svgId) {
  return `
    <clipPath id="${svgId}-${name}">
      <polygon points="${escapeAttribute(polygon)}" />
    </clipPath>
  `;
}

// Measure a polygon string and capture its top-edge angle for title rotation.
function polygonBounds(polygon) {
  const points = parsePolygon(polygon);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    angle: polygonTopEdgeAngle(points),
  };
}

// Expand a polygon's bounds slightly so rotated cover art bleeds past the mask.
function polygonPlacement(polygon) {
  const bounds = polygonBounds(polygon);
  const bleed = Math.max(bounds.width, bounds.height) * 0.1;

  return {
    x: bounds.minX - bleed,
    y: bounds.minY - bleed,
    width: bounds.width + bleed * 2,
    height: bounds.height + bleed * 2,
    centerX: bounds.centerX,
    centerY: bounds.centerY,
    angle: bounds.angle,
  };
}

// Compute the angle of the first polygon edge, treated as the visual top edge.
function polygonTopEdgeAngle(points) {
  const [start, end] = points;
  const radians = Math.atan2(end[1] - start[1], end[0] - start[0]);
  return Number(((radians * 180) / Math.PI).toFixed(3));
}

// Keep CSS percent values stable and readable.
// Parse SVG polygon point strings into numeric coordinate pairs.
function parsePolygon(polygon) {
  return polygon.split(/\s+/).map((point) => point.split(",").map(Number));
}

// Create id-safe SVG scopes from titles or item ids.
function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Small visual hint shown on scrollable shelf strips.
function renderScrollLabel() {
  return `<div class="shelf-scroll-label" aria-hidden="true">SCROLL &nbsp; &gt;</div>`;
}

// Render the modal-like object pickup view for a selected book or show.
function renderTakeOffOverlay() {
  const item = state.selectedItem;
  const isBook = state.selectedKind === "BOOKS";
  const actionWord = isBook ? "READ" : "WATCH";
  const action = isBook ? "read-book" : "watch-item";
  const coverItem = {
    ...item,
    svgScope: `take-off-${item.id}`,
    x: -32,
    y: -75,
    height: 1277,
    rotationDegrees: isBook ? -2 : 2,
  };

  return `
    <div class="take-off-layer${state.takeOffExiting ? " take-off-exiting" : ""}" role="dialog" aria-label="${item.title}">
      <div class="shelf-dim"></div>
      <div class="take-off-media-shell">
        ${renderMediaFrontItem(coverItem, action)}
        <div class="take-off-actions">
          <button class="primary-action icon-action" type="button" data-action="${action}">
            ${isBook ? renderBookIcon() : renderRemoteIcon()}
            <span>${actionWord}</span>
          </button>
          <button class="secondary-action icon-action" type="button" data-action="put-back">
            ${renderReturnIcon()}
            <span>PUT BACK</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// Inline icon used by the pickup overlay read action.
function renderBookIcon() {
  return `
    <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M8 11h13c3 0 5 2 5 5v21c0-3-2-5-5-5H8z" />
      <path d="M40 11H27c-3 0-5 2-5 5v21c0-3 2-5 5-5h13z" />
      <path d="M24 16v21" />
    </svg>
  `;
}

// Inline icon used by the pickup overlay watch action.
function renderRemoteIcon() {
  return `
    <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="15" y="5" width="18" height="38" rx="6" />
      <circle cx="24" cy="15" r="4" />
      <path d="M20 25h8" />
      <path d="M20 32h8" />
    </svg>
  `;
}

// Inline icon used by put-back/return actions.
function renderReturnIcon() {
  return `
    <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M19 13 8 24l11 11" />
      <path d="M9 24h21c6 0 10 4 10 10v2" />
    </svg>
  `;
}

// Render the handoff overlay shown while a show is launched on the TV.
function renderHandoff() {
  const debugText = getVideoLaunchDebugText();

  return `
    <section class="screen handoff-screen" aria-label="TV handoff">
      <div class="handoff-shelf-backdrop" aria-hidden="true">
        ${renderShowsImageStrip()}
      </div>
      <div class="handoff-card">
        <div class="handoff-note">
          <img class="handoff-post-it" src="${POST_IT_IMAGE}" alt="" aria-hidden="true" draggable="false" />
          <div class="handoff-content">
            <h1>
              <span>Starting</span>
              <span>${escapeHtml(state.handoffItem.title)}</span>
              <span>on your TV.</span>
            </h1>
            <p>Use your remote to control it.</p>
            <p>This window will close shortly.</p>
          </div>
        </div>
        <button class="secondary-action handoff-put-back" type="button" data-action="return-shows">PUT BACK</button>
      </div>
      ${
        debugText
          ? `<div class="video-launch-debug" aria-live="polite">${escapeHtml(debugText)}</div>`
          : ""
      }
    </section>
  `;
}

// Surface VoiceMonkey configuration issues only when a launch did not fire.
function getVideoLaunchDebugText() {
  const launch = state.videoLaunchDebug;
  if (!launch) return "";
  if (launch.mode === "LIVE" && launch.fired) return "";
  if (launch.url) return launch.url;
  return `VoiceMonkey URL not configured for ${launch.command || state.handoffItem?.command || state.handoffItem?.title || "this show"}`;
}

// Enter a shelf view through the shared alert and view-transition timing.
async function openShelf(shelf) {
  if (!shelf || state.alertTransitioning || state.viewTransitioning) return;

  clearSelection();
  if (shelf === "SHOWS") state.showsScrollLeft = SHELF_PANEL_WIDTH;
  if (shelf === "BOOKS") state.booksScrollLeft = SHELF_PANEL_WIDTH;
  if (shelf === "TODAY") state.todayScrollLeft = SHELF_PANEL_WIDTH;
  animateAlertExitToShelf();
  await transitionView("to-shelf", () => {
    state.view = "SHELF";
    state.activeShelf = shelf;
    render();
  });
}

// Delegate all click actions from the frequently re-rendered main layer.
async function handleMainClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  if (action === "expand-shelf" && state.homeSwipeConsumed) {
    state.homeSwipeConsumed = false;
    return;
  }
  if (
    (state.alertTransitioning || state.viewTransitioning) &&
    (action === "expand-shelf" || action === "back-home")
  )
    return;

  if (action === "expand-shelf") {
    await openShelf(target.dataset.shelf);
    return;
  }

  if (action === "back-home") {
    if (isShelfImageView()) {
      clearSelection();
      await transitionView("to-home", () => {
        state.view = "HOME";
        state.activeShelf = null;
        render();
      });
      animateAlertEnterHome();
    } else {
      state.view = "HOME";
      state.activeShelf = null;
      clearSelection();
      render();
    }
    return;
  }

  if (action === "take-off") {
    const kind = target.dataset.kind;
    state.selectedKind = kind;
    state.takeOffExiting = false;
    state.selectedItem = findItem(kind, target.dataset.itemId);
    render();
    return;
  }

  if (action === "put-back") {
    state.takeOffExiting = true;
    render();
    await wait(VIEW_TRANSITION_OUT_MS);
    clearSelection();
    render();
    return;
  }

  if (action === "read-book" && state.selectedItem) {
    state.readerItem = state.selectedItem;
    state.readerPage = 0;
    state.readerTurnDirection = "";
    state.readerScrollTarget = null;
    clearSelection();
    render();
    return;
  }

  if (action === "reader-prev") {
    goToPreviousReaderPage();
    return;
  }

  if (action === "reader-next") {
    goToNextReaderPage();
    return;
  }

  if (action === "read-again") {
    scrollReaderToPage(0);
    return;
  }

  if (action === "finish-reading") {
    finishReading();
    return;
  }

  if (action === "watch-item" && state.selectedItem) {
    const item = state.selectedItem;
    clearSelection();
    state.handoffItem = item;
    state.videoLaunchDebug = null;
    startHandoffTimer();
    render();

    try {
      state.videoLaunchDebug = launchVideoItem(item);
      markRecent("davidsStuff.recentWatched", state.recentWatched, item.id);
      state.highlightedShowId = item.id;
      render();
    } catch (error) {
      console.error(`Could not launch ${item.title}.`, error);
    }
    return;
  }

  if (action === "return-shows") {
    finishHandoff();
  }
}

// Reset reader swipe state when a pointer starts inside the reader.
function handleReaderPointerDown(event) {
  if (!state.readerItem) return;
  state.readerSwipeStarted = false;
  state.readerScrollTarget = null;
}

// Update idle-return bookkeeping for any meaningful user input.
function markUserInteraction() {
  state.lastInteractionAt = Date.now();
}

// Capture home-shelf swipe starts from the invisible shelf tap zones.
function handleHomeShelfPointerDown(event) {
  if (!isHomeView()) return;
  const zone = event.target.closest?.(".home-tap-zone[data-shelf]");
  if (!zone) return;

  zone.setPointerCapture?.(event.pointerId);
  state.homeSwipeShelf = zone.dataset.shelf;
  state.homeSwipeStartX = event.clientX;
  state.homeSwipeStartY = event.clientY;
  state.homeSwipeStarted = true;
  state.homeSwipeConsumed = false;
}

// Clear swipe bookkeeping when the pointer is cancelled outside the zone.
function cancelHomeShelfSwipe() {
  state.homeSwipeStarted = false;
  state.homeSwipeShelf = null;
}

// Convert horizontal home swipes into shelf opens while suppressing follow-up taps.
async function handleHomeShelfPointerUp(event) {
  if (!state.homeSwipeStarted) return;

  const shelf = state.homeSwipeShelf;
  state.homeSwipeStarted = false;
  state.homeSwipeShelf = null;
  if (!isHomeView() || !shelf) return;

  const deltaX = event.clientX - state.homeSwipeStartX;
  const deltaY = event.clientY - state.homeSwipeStartY;
  const horizontalSwipe =
    Math.abs(deltaX) >= 35 && Math.abs(deltaX) > Math.abs(deltaY);
  if (!horizontalSwipe) return;

  event.preventDefault();
  state.homeSwipeConsumed = true;
  window.setTimeout(() => {
    state.homeSwipeConsumed = false;
  }, 500);
  await openShelf(shelf);
}

// Complete pointer gestures in the reader; scroll handles page selection.
function handleReaderPointerUp(event) {
  if (!state.readerItem) return;
  state.readerSwipeStarted = false;
}

// Keyboard support for overlay actions and reader paging.
function handleReaderKeyDown(event) {
  const activeAction = document.activeElement?.dataset?.action;
  if (
    activeAction &&
    (activeAction === "read-book" || activeAction === "watch-item") &&
    (event.key === "Enter" || event.key === " ")
  ) {
    event.preventDefault();
    document.activeElement.click();
    return;
  }

  if (!state.readerItem) return;
  if (event.key === "ArrowLeft") goToPreviousReaderPage();
  if (event.key === "ArrowRight") goToNextReaderPage();
  if (event.key === "Escape") finishReading();
}

// Advance the reader and mark a book recent when the final page is passed.
function goToNextReaderPage() {
  if (!state.readerItem) return;

  const pageCount = getReaderPageCount(state.readerItem);
  if (state.readerPage >= pageCount - 1) {
    markRecent("davidsStuff.recentRead", state.recentRead, state.readerItem.id);
    finishReading();
    return;
  }
  if (state.readerPage >= pageCount) return;

  scrollReaderToPage(state.readerPage + 1);
}

// Move back one reader page and set the page-turn animation direction.
function goToPreviousReaderPage() {
  if (!state.readerItem || state.readerPage <= 0) return;

  scrollReaderToPage(state.readerPage - 1);
}

// Move the existing reader track so button/tap navigation feels like a swipe.
function scrollReaderToPage(pageIndex, behavior = "smooth") {
  if (!state.readerItem) return;

  const track = document.querySelector(".reader-page-track");
  const pageCount = getReaderPageCount(state.readerItem);
  const targetPage = clamp(pageIndex, 0, Math.max(0, pageCount - 1));
  const currentPage = state.readerPage;
  if (!track) {
    state.readerPage = targetPage;
    state.readerTurnDirection =
      targetPage >= currentPage ? "turn-next" : "turn-prev";
    render();
    return;
  }

  const pageWidth = getReaderPageWidth(track);
  state.readerPage = targetPage;
  state.readerScrollTarget = targetPage;
  state.readerTurnDirection =
    targetPage >= currentPage ? "turn-next" : "turn-prev";
  syncReaderControls(targetPage, pageCount);
  track.scrollTo({
    left: targetPage * pageWidth,
    behavior,
  });
}

// Close the reader and return to the books shelf.
function finishReading() {
  if (
    state.readerItem &&
    state.readerPage >= getReaderPageCount(state.readerItem)
  ) {
    markRecent("davidsStuff.recentRead", state.recentRead, state.readerItem.id);
  }

  state.readerItem = null;
  state.readerPage = 0;
  state.readerTurnDirection = "";
  state.readerScrollTarget = null;
  state.view = "SHELF";
  state.activeShelf = "BOOKS";
  render();
}

// Sync reader state from horizontal page-track scroll.
function handleReaderScroll(event) {
  if (!state.readerItem) return;

  const track = event.target.closest?.(".reader-page-track");
  if (!track) return;

  markUserInteraction();
  const pageWidth = getReaderPageWidth(track);
  const pageCount = getReaderPageCount(state.readerItem);
  if (state.readerScrollTarget !== null) {
    const targetScrollLeft = state.readerScrollTarget * pageWidth;
    if (Math.abs(track.scrollLeft - targetScrollLeft) > 2) {
      syncReaderControls(state.readerScrollTarget, pageCount);
      return;
    }
    state.readerScrollTarget = null;
  }

  const nextPage = clamp(
    Math.round(track.scrollLeft / pageWidth),
    0,
    Math.max(0, pageCount - 1),
  );
  state.readerPage = nextPage;
  state.readerTurnDirection = "";
  syncReaderControls(nextPage, pageCount);
}

// Restore reader page position after a render rebuilds the page track.
function restoreReaderScroll() {
  if (!state.readerItem) return;

  const track = document.querySelector(".reader-page-track");
  if (!track) return;

  const pageWidth = getReaderPageWidth(track);
  const targetScrollLeft = state.readerPage * pageWidth;
  if (Math.abs(track.scrollLeft - targetScrollLeft) <= 2) return;
  track.scrollLeft = targetScrollLeft;
  syncReaderControls(state.readerPage, getReaderPageCount(state.readerItem));
}

// Reader page width is the full stage-width track, not the padded page content.
function getReaderPageWidth(track) {
  return track.clientWidth || SHELF_PANEL_WIDTH;
}

// Keep reader footer and prev/next controls aligned with current page.
function syncReaderControls(pageIndex, pageCount) {
  const screen = document.querySelector(".reader-screen");
  if (!screen) return;

  const footer = screen.querySelector(".reader-controls .reader-footer");
  if (footer) footer.textContent = `Page ${pageIndex + 1} of ${pageCount}`;

  const previousButton = screen.querySelector(".reader-control-prev");
  if (previousButton) previousButton.disabled = pageIndex === 0;
  screen.querySelectorAll(".reader-page-click-prev").forEach((button) => {
    button.disabled = pageIndex === 0;
  });

  const nextButton = screen.querySelector(".reader-control-next");
  if (nextButton) {
    nextButton.textContent = pageIndex >= pageCount - 1 ? "Done" : "Next";
  }
}

// Persist and clamp horizontal shelf scroll for the active shelf strip.
function handleShelfScroll(event) {
  const shelf = event.target.closest?.("[data-shelf-kind]");
  if (!shelf) return;
  markUserInteraction();
  if (shelf.dataset.shelfKind === "BOOKS") {
    if (shelf.scrollLeft < SHELF_PANEL_WIDTH) {
      shelf.scrollLeft = SHELF_PANEL_WIDTH;
    } else if (shelf.scrollLeft > getBooksMaxScrollLeft()) {
      shelf.scrollLeft = getBooksMaxScrollLeft();
    }
    state.booksScrollLeft = shelf.scrollLeft;
  } else if (shelf.dataset.shelfKind === "SHOWS") {
    if (shelf.scrollLeft < SHELF_PANEL_WIDTH) {
      shelf.scrollLeft = SHELF_PANEL_WIDTH;
    } else if (shelf.scrollLeft > getShowsMaxScrollLeft()) {
      shelf.scrollLeft = getShowsMaxScrollLeft();
    }
    state.showsScrollLeft = shelf.scrollLeft;
  } else if (shelf.dataset.shelfKind === "TODAY") {
    const todayMaxScrollLeft = getTodayMaxScrollLeft();
    if (shelf.scrollLeft < SHELF_PANEL_WIDTH) {
      shelf.scrollLeft = SHELF_PANEL_WIDTH;
    } else if (shelf.scrollLeft > todayMaxScrollLeft) {
      shelf.scrollLeft = todayMaxScrollLeft;
    }
    state.todayScrollLeft = shelf.scrollLeft;
  }
}

// Restore shelf scroll positions after DOM replacement.
function restoreShelfScroll() {
  const booksShelf = document.querySelector('[data-shelf-kind="BOOKS"]');
  const showsShelf = document.querySelector('[data-shelf-kind="SHOWS"]');
  const todayShelf = document.querySelector('[data-shelf-kind="TODAY"]');
  if (booksShelf)
    booksShelf.scrollLeft = clampBooksScroll(state.booksScrollLeft);
  if (showsShelf)
    showsShelf.scrollLeft = clampShowsScroll(state.showsScrollLeft);
  if (todayShelf)
    todayShelf.scrollLeft = clampTodayScroll(state.todayScrollLeft);
}

// Keep shows scroll inside the photographed strip's usable range.
function clampShowsScroll(scrollLeft) {
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, getShowsMaxScrollLeft());
}

// Keep books scroll inside the photographed strip's usable range.
function clampBooksScroll(scrollLeft) {
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, getBooksMaxScrollLeft());
}

// Keep Today scroll inside the photographed strip's usable range.
function clampTodayScroll(scrollLeft) {
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, getTodayMaxScrollLeft());
}

// Periodically return idle shelf views to the home scene.
async function checkIdleReturnHome() {
  if (!shouldIdleReturnHome()) return;

  state.idleReturnRunning = true;
  state.lastInteractionAt = Date.now();
  try {
    clearSelection();
    await transitionView("to-home", () => {
      state.view = "HOME";
      state.activeShelf = null;
      render();
    });
    animateAlertEnterHome();
  } finally {
    state.idleReturnRunning = false;
  }
}

// Guard idle-return so it never interrupts active overlays/readers/transitions.
function shouldIdleReturnHome() {
  if (state.idleReturnRunning) return false;
  if (Date.now() - state.lastInteractionAt < IDLE_HOME_MS) return false;
  if (state.view !== "SHELF") return false;
  if (state.readerItem || state.selectedItem || state.handoffItem) return false;
  if (
    state.alertTransitioning ||
    state.viewTransitioning ||
    state.takeOffExiting
  )
    return false;
  return true;
}

// Apply CSS transition classes around a state update and render.
async function transitionView(direction, updateView) {
  if (state.viewTransitioning) return;
  state.viewTransitioning = true;
  const main = document.getElementById("app-main");

  try {
    main?.classList.remove(
      "view-transition-in",
      "view-transition-to-home",
      "view-transition-to-shelf",
    );
    main?.classList.add("view-transition-out");
    await wait(VIEW_TRANSITION_OUT_MS);

    updateView();

    main?.classList.remove("view-transition-out");
    main?.classList.add("view-transition-in", `view-transition-${direction}`);
    await wait(VIEW_TRANSITION_IN_MS);
    main?.classList.remove(
      "view-transition-in",
      "view-transition-to-home",
      "view-transition-to-shelf",
    );
  } finally {
    state.viewTransitioning = false;
  }
}

// Hide the meal alert before shelf navigation so it does not cover the shelf.
async function animateAlertExitToShelf() {
  if (state.alertTransitioning) return;
  state.alertTransitioning = true;
  const mealTimer = document.getElementById("meal-timer");

  try {
    if (getMealState(getNow()).hiddenForDay) {
      state.alertHidden = true;
      mealTimer?.classList.add("alert-card-hidden");
      return;
    }

    state.alertHidden = false;
    mealTimer?.classList.remove("alert-card-hidden");
    mealTimer?.classList.remove("alert-card-entering");
    mealTimer?.classList.add("alert-card-exiting");
    await wait(ALERT_TRANSITION_MS);
    state.alertHidden = true;
    mealTimer?.classList.add("alert-card-hidden");
    mealTimer?.classList.remove("alert-card-exiting");
  } finally {
    state.alertTransitioning = false;
  }
}

// Reintroduce the meal alert on home after the shelf transition settles.
async function animateAlertEnterHome() {
  if (state.alertTransitioning) return;
  state.alertTransitioning = true;
  const mealTimer = document.getElementById("meal-timer");

  try {
    mealTimer?.classList.remove("alert-card-exiting");
    mealTimer?.classList.add("alert-card-hidden");
    await wait(ALERT_HOME_ENTRY_DELAY_MS);

    if (getMealState(getNow()).hiddenForDay) {
      state.alertHidden = false;
      mealTimer?.classList.add("alert-card-hidden");
      return;
    }

    mealTimer?.classList.remove("alert-card-hidden");
    mealTimer?.classList.add("alert-card-entering");
    state.alertHidden = false;
    await wait(ALERT_TRANSITION_MS);
    mealTimer?.classList.remove("alert-card-entering");
  } finally {
    state.alertTransitioning = false;
  }
}

// True only when no modal/reader/handoff layer is masking the home view.
function isHomeView() {
  return !state.readerItem && !state.handoffItem && state.view === "HOME";
}

// True only when the photographed shelf strip is the active visible view.
function isShelfImageView() {
  return !state.readerItem && !state.handoffItem && state.view === "SHELF";
}

// Promise wrapper used by transition timing code.
function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// Support simple /today, /shows, and /books redirect-style routes.
function routeToShelf(pathname) {
  const route = pathname.replace(/\/+$/, "").split("/").pop()?.toLowerCase();
  if (route === "today") return "TODAY";
  if (route === "shows") return "SHOWS";
  if (route === "books") return "BOOKS";
  return null;
}

// Auto-close the video handoff overlay after the TV launch grace period.
function startHandoffTimer() {
  window.clearTimeout(state.handoffTimer);
  state.handoffTimer = window.setTimeout(finishHandoff, HANDOFF_MS);
}

// Clear handoff state and return to the shows shelf.
function finishHandoff() {
  window.clearTimeout(state.handoffTimer);
  state.handoffTimer = null;
  state.handoffItem = null;
  state.videoLaunchDebug = null;
  state.view = "SHELF";
  state.activeShelf = "SHOWS";
  render();
}

// Clear the selected pickup object and any exit animation state.
function clearSelection() {
  state.selectedItem = null;
  state.selectedKind = null;
  state.takeOffExiting = false;
}

// Resolve a selected item from the loaded production shelf arrays.
function findItem(kind, id) {
  const source = kind === "BOOKS" ? booksShelfMedia : showsShelfMedia;
  return source.find((item) => item.id === id) ?? null;
}

// Calculate whether the meal alert should be hidden, counting down, or active.
function getMealState(now) {
  const nowMinutes =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const mealsWithMinutes = MEALS.map((meal) => ({
    ...meal,
    minutes: parseTimeToMinutes(meal.time),
  }));
  const currentMeal = [...mealsWithMinutes]
    .reverse()
    .find(
      (meal) =>
        nowMinutes >= meal.minutes &&
        nowMinutes < meal.minutes + MEAL_ACTIVE_MINUTES,
    );

  if (currentMeal) {
    return {
      resting: false,
      hiddenForDay: false,
      eating: true,
      urgent: nowMinutes <= currentMeal.minutes + 10,
      nextMealId: currentMeal.id,
      label: currentMeal.label,
      fillPercent: 0,
      nowPercent: 100,
      timeLeft: "",
      targetLabel: formatShelfMealTime(currentMeal.time),
      message: "It's time to eat.",
    };
  }

  const nextMeal = mealsWithMinutes.find((meal) => nowMinutes < meal.minutes);

  if (!nextMeal) {
    return {
      resting: true,
      hiddenForDay: true,
      eating: false,
      urgent: false,
      nextMealId: null,
      label: "REST WHEN READY",
      fillPercent: 100,
      nowPercent: 100,
      timeLeft: "",
      targetLabel: "REST",
      message: "Rest whenever you feel ready.",
    };
  }

  const previousMeal = [...mealsWithMinutes]
    .reverse()
    .find((meal) => meal.minutes <= nowMinutes);
  const start = previousMeal?.minutes ?? 0;
  const span = Math.max(1, nextMeal.minutes - start);
  const elapsed = Math.max(0, nowMinutes - start);
  const remaining = Math.max(0, nextMeal.minutes - nowMinutes);
  const fillPercent = clamp((remaining / span) * 100, 0, 100);
  const nowPercent = clamp((elapsed / span) * 100, 0, 100);
  const timeLeft = formatMealTimeLeft(remaining);

  return {
    resting: false,
    hiddenForDay: false,
    eating: false,
    urgent: remaining <= 10,
    nextMealId: nextMeal.id,
    label: nextMeal.label,
    fillPercent,
    nowPercent,
    timeLeft,
    targetLabel: formatShelfMealTime(nextMeal.time),
    message: `We eat in\n${timeLeft}.`,
  };
}

// Format meal countdown copy in the large alert card.
function formatMealTimeLeft(minutesRemaining) {
  const rounded = Math.max(1, Math.ceil(minutesRemaining));
  if (rounded < 60) {
    return `${rounded} ${pluralize("minute", rounded)}`;
  }
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (!minutes) return `${hours} ${pluralize("hour", hours)}`;
  return `${hours} ${pluralize("hour", hours)}, ${minutes} ${pluralize("minute", minutes)}`;
}

// Preserve source order while grouping shelf items by category.
function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return [...groups.entries()];
}

// Persist recently watched/read markers in localStorage.
function markRecent(storageKey, recentMap, id) {
  recentMap[id] = Date.now();
  localStorage.setItem(storageKey, JSON.stringify(recentMap));
}

// Load recent markers defensively so corrupt storage cannot break startup.
function loadRecent(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "{}");
  } catch {
    return {};
  }
}

// Treat recent markers as short-lived visual badges.
function isRecent(timestamp) {
  if (!timestamp) return false;
  return Date.now() - Number(timestamp) < RECENT_DAYS * 24 * 60 * 60 * 1000;
}

// Humanize all-caps meal and shelf labels for card copy.
function toTitleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

// Format 24-hour meal config values as compact shelf labels.
function formatShelfMealTime(time) {
  const minutes = parseTimeToMinutes(time);
  const hour24 = Math.floor(minutes / 60);
  const hour = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "pm" : "am";
  return `${hour} ${suffix}`;
}

// Today needs more blank shelf panels when a special card is visible.
function getTodayExtensionPanelCount(now = getNow()) {
  return getTodaySpecial(now)
    ? TODAY_EXTENSION_PANELS_WITH_SPECIAL
    : TODAY_EXTENSION_PANELS_WITHOUT_SPECIAL;
}

// Maximum horizontal scroll for the Today shelf strip.
function getTodayMaxScrollLeft(now = getNow()) {
  return SHELF_PANEL_WIDTH * getTodayExtensionPanelCount(now);
}

// Lookup the special Today card by current weekday.
function getTodaySpecial(now) {
  return TODAY_SPECIALS[formatWeekdayKey(now)];
}

// Clamp numeric UI state before writing it back into scroll/page positions.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
