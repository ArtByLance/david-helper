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
const SHOWS_SPINE_START_X = 1810;
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
const MEDIA_SPINE_TO_SPINE_GAP = 70;
const SHOWS_GROUP_GAP = 170 * 3;
const MEDIA_SPINE_BOTTOM = 245;
const MEDIA_SPINE_HEIGHT = 806;
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
const dvdSpineSkin = {
  overlay: "./assets/objects/dvd-spine.png",
  viewBox: { width: 196, height: 713 },
  artPolygons: {
    sideFaceArt: "29,33 102,68 100,681 30,593",
    spineArt: "103,67 182,67 181,687 101,688",
  },
  titlePolygon: "103,67 182,67 181,687 101,688",
  hotspotPadding: 10,
};
const bookSpineSkin = {
  ...dvdSpineSkin,
  overlay: "./assets/objects/book-spine.png",
};
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
    spine: dvdSpineSkin,
    front: dvdFrontSkin,
  },
  book: {
    spine: bookSpineSkin,
    front: bookFrontSkin,
  },
};
const MEDIA_SPINE_VIEW_FACE_OPACITY = 0;
const MEDIA_SPINE_VIEW_FACE_TINT_OPACITY = 0.2;
const MEDIA_SPINE_VIEW_SIDE_TINT = "#2f66f2";
const MEDIA_SPINE_VIEW_SPINE_TINT_OPACITY = 0.89;
const MEDIA_FRONT_VIEW_SPINE_OPACITY = 0.4;
const MEDIA_FRONT_TITLE_ROTATION_OFFSET = -4.8;
const MEDIA_FRONT_TITLE_RIGHT_INSET = 92;
const MEDIA_FRONT_TITLE_LEFT_INSET = 126;
const MEDIA_FRONT_TITLE_BOTTOM_INSET = 115;
const MEDIA_DEFAULT_TITLE_TINT = "#fff6df";
const MEDIA_SPINE_TITLE_X_OFFSET = 7;
const MEDIA_SPINE_TITLE_Y_OFFSET = 15;
let booksShelfMedia = [];
let showsShelfMedia = [];

// When shelf content is built out, keep one extra blank panel past the expected
// far-right end so overscroll never exposes the stage edge.
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
          masterArt: `./assets/media/books/covers/${item.id}.jpg`,
          cover: `./assets/media/books/covers/${item.id}.jpg`,
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

function getShowCoverFile(id) {
  return `${String(id).replaceAll("_", "-")}.jpg`;
}

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

function buildReaderBookChapters(bookId, book) {
  return (book.chapters ?? []).map((chapter, index) => ({
    ...chapter,
    image:
      chapter.image ??
      `./assets/media/books/chapters/${bookId}-${index + 1}.jpg`,
  }));
}

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

function render() {
  const now = getNow();
  renderMain(now);
  renderMealTimer(now);
  requestAnimationFrame(() => {
    restoreShelfScroll();
    restoreReaderScroll();
  });
}

function renderMealTimerOnly() {
  const now = getNow();
  renderMealTimer(now);
  renderLiveClockText(now);
}

function renderLiveClockText(now) {
  document
    .querySelectorAll(".home-today-clock-text, .today-led-clock-text")
    .forEach((element) => {
      element.textContent = formatClock(now);
    });
  refreshDementiaClocks(now);
}

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

function ensureAppLayer(main, className) {
  let layer = main.querySelector(`.${className}`);
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = `app-layer ${className}`;
  main.appendChild(layer);
  return layer;
}

function renderHomeLayer(layer, now) {
  if (!layer.hasChildNodes()) {
    layer.innerHTML = renderHome(now);
  }

  refreshHomeLayer(layer, now);
  layer.toggleAttribute("aria-hidden", state.view !== "HOME");
}

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

function renderShelfLayer(layer, now) {
  const shouldShowShelf = state.view === "SHELF" && Boolean(state.activeShelf);
  layer.hidden = !shouldShowShelf;
  if (!shouldShowShelf) return;

  const key = `${state.activeShelf}:${state.activeShelf === "TODAY" ? formatWeekdayKey(now) : ""}`;
  if (layer.dataset.renderKey === key) return;

  layer.innerHTML = renderShelfImageShell(state.activeShelf, now);
  layer.dataset.renderKey = key;
}

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

function setBooleanDataAttribute(element, name, enabled) {
  if (!element) return;
  if (enabled) {
    element.setAttribute(name, "true");
  } else {
    element.removeAttribute(name);
  }
}

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

function renderHomeTodaySpecialCard(special) {
  return `
    <div class="home-today-special-card">
      <img src="${TODAY_SPECIAL_IMAGE}" alt="" draggable="false" />
      <div class="home-today-special-content">
        <h2>Today Only</h2>
        <strong>${escapeHtml(special.title)}</strong>
        <span>${escapeHtml(special.time)}</span>
      </div>
    </div>
  `;
}

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

function getHomeScene(now) {
  const hour = now.getHours();
  if (hour < 6 || hour >= 20) return HOME_SCENE_BY_DAY_PART.night;
  if (hour < 9) return HOME_SCENE_BY_DAY_PART.dawn;
  if (hour < 17) return HOME_SCENE_BY_DAY_PART.day;
  return HOME_SCENE_BY_DAY_PART.sunset;
}

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

function getDayPart(now) {
  const hour = now.getHours();
  if (hour < 6 || hour >= 21) return "Bedtime";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

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

function renderTodaySpecialCard(special) {
  return `
    <section class="today-special-card" aria-label="Today only">
      <img src="${TODAY_SPECIAL_IMAGE}" alt="" aria-hidden="true" draggable="false" />
      <div class="today-card-content">
        <h2>Today Only</h2>
        <strong>${special.title}</strong>
        <span>${special.time}</span>
        <p>${special.place}</p>
      </div>
    </section>
  `;
}

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

function getFrontShelfEndX(items) {
  if (!items.length) return SHELF_PANEL_WIDTH * 2;
  return Math.max(...items.map((item) => item.x + item.width));
}

function getFrontShelfMaxScrollLeft(kind) {
  const items = kind === "BOOKS" ? booksShelfMedia : showsShelfMedia;
  return Math.max(
    SHELF_PANEL_WIDTH,
    Math.ceil(buildFrontShelfLayout(kind, items).endX),
  );
}

function getFrontShelfExtensionPanelCount(kind) {
  const maxScrollLeft = getFrontShelfMaxScrollLeft(kind);
  const requiredContentWidth = maxScrollLeft + SHELF_PANEL_WIDTH;
  return Math.max(1, Math.ceil(requiredContentWidth / SHELF_PANEL_WIDTH) - 2);
}

function getShowsExtensionPanelCount() {
  return getFrontShelfExtensionPanelCount("SHOWS");
}

function getBooksExtensionPanelCount() {
  return getFrontShelfExtensionPanelCount("BOOKS");
}

function getShowsMaxScrollLeft() {
  return getFrontShelfMaxScrollLeft("SHOWS");
}

function getBooksMaxScrollLeft() {
  return getFrontShelfMaxScrollLeft("BOOKS");
}

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

function renderMediaSpineItems(items, kind, gap = MEDIA_SPINE_TO_SPINE_GAP) {
  const positionedItems = getShelfMediaGroups(items, gap).flatMap((group) =>
    positionMediaGroupItems(group.items, group.left, gap),
  );

  return positionedItems
    .map((item, index) =>
      renderMediaSpineItem({
        ...item,
        kind,
        zIndex: positionedItems.length - index + 10,
      }),
    )
    .join("");
}

function renderMediaSpineItem(item) {
  const skin = getMediaSkin(item, "spine");
  const width = getMediaObjectWidth(skin, item.height);

  return `
    <div
      class="media-object media-spine media-spine-item media-spine-${item.type}"
      aria-label="${escapeAttribute(item.title)}"
      style="--media-x: ${item.x}px; --media-bottom: ${item.bottom}px; --media-width: ${width}px; --media-height: ${item.height}px; --media-z-index: ${item.zIndex};"
    >
      ${renderMediaObjectContent({ item, mode: "spine", skin })}
      <button
        class="media-spine-hotspot"
        type="button"
        data-action="media-spine"
        data-kind="${escapeAttribute(item.kind)}"
        data-item-id="${escapeAttribute(item.id)}"
        data-title="${escapeAttribute(item.title)}"
        aria-label="${escapeAttribute(item.title)}"
      ></button>
    </div>
  `;
}

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

function renderMediaObjectContent({ item, mode, skin }) {
  const title = item.displayTitle ?? item.title;
  const svgId = `${slugify(item.svgScope ?? item.id ?? item.title)}-${mode}`;

  return `
    ${renderMediaArtLayer({ item, mode, skin, svgId })}
    ${renderMediaTitleLayer({ item, title, mode, skin, svgId })}
    <img class="media-overlay" src="${skin.overlay}" alt="" aria-hidden="true" draggable="false" />
  `;
}

function getMediaSkin(item, mode) {
  return mediaSkins[item.type]?.[mode] ?? mediaSkins.dvd[mode];
}

function getMediaObjectWidth(skin, height) {
  return Math.round((height * skin.viewBox.width) / skin.viewBox.height);
}

function renderMediaArtLayer({ item, mode, skin, svgId }) {
  return mode === "front"
    ? renderMediaFrontArtLayer({ item, skin, svgId })
    : renderMediaSpineArtLayer({ item, skin, svgId });
}

function renderMediaSpineArtLayer({ item, skin, svgId }) {
  const baseColor = item.baseColor;
  const displayColor = baseColor ? enrichMediaColor(baseColor) : "";
  const artImages = Object.entries(skin.artPolygons)
    .map(([name]) => {
      const isSideFace = name === "sideFaceArt";
      const isSpineFace = name === "spineArt";

      return `
        <image
          href="${escapeAttribute(item.masterArt)}"
          width="${skin.viewBox.width}"
          height="${skin.viewBox.height}"
          preserveAspectRatio="xMidYMid slice"
          opacity="1"
          clip-path="url(#${svgId}-${name})"
        />
        ${
          baseColor && isSpineFace
            ? `<rect
                width="${skin.viewBox.width}"
                height="${skin.viewBox.height}"
                fill="${escapeAttribute(displayColor)}"
                opacity="${MEDIA_SPINE_VIEW_SPINE_TINT_OPACITY}"
                clip-path="url(#${svgId}-${name})"
              />`
            : baseColor && isSideFace
              ? `<rect
                width="${skin.viewBox.width}"
                height="${skin.viewBox.height}"
                fill="${escapeAttribute(displayColor)}"
                opacity="${MEDIA_SPINE_VIEW_FACE_TINT_OPACITY}"
                clip-path="url(#${svgId}-${name})"
              />`
              : !baseColor && isSideFace
                ? `<rect
                width="${skin.viewBox.width}"
                height="${skin.viewBox.height}"
                fill="#000"
                opacity="${MEDIA_SPINE_VIEW_FACE_OPACITY}"
                clip-path="url(#${svgId}-${name})"
              />
              <rect
                width="${skin.viewBox.width}"
                height="${skin.viewBox.height}"
                fill="${MEDIA_SPINE_VIEW_SIDE_TINT}"
                opacity="0"
                clip-path="url(#${svgId}-${name})"
              />`
                : ""
        }
      `;
    })
    .join("");

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
      ${artImages}
    </svg>
  `;
}

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

function renderMediaTitleLayer({ item, title, mode, skin, svgId }) {
  const titleBox = polygonBounds(skin.titlePolygon);
  const titleTint = item.titleTint ?? MEDIA_DEFAULT_TITLE_TINT;
  const text =
    mode === "spine"
      ? renderMediaSpineTitle(title, titleBox, svgId, titleTint)
      : renderMediaFrontTitle(title, titleBox, svgId, titleTint);
  const filters = isLitePerformanceMode()
    ? ""
    : `
        <filter id="${svgId}-titleShadow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".9" />
          <feDropShadow dx="0" dy="0" stdDeviation="39" flood-color="#000" flood-opacity=".92" />
        </filter>
        <filter id="${svgId}-spineTitleGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="0" stdDeviation="34" flood-color="#000" flood-opacity=".92" />
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

function renderMediaSpineTitle(title, titleBox, svgId, titleTint) {
  const anchorX = titleBox.centerX + MEDIA_SPINE_TITLE_X_OFFSET;
  const anchorY = titleBox.maxY - 70 + MEDIA_SPINE_TITLE_Y_OFFSET;
  const isLite = isLitePerformanceMode();
  const liteAttrs = isLite
    ? `stroke="#000" stroke-width="4" paint-order="stroke fill"`
    : "";
  const attrs = `
    class="media-titleText"
    x="${anchorX}"
    y="${anchorY}"
    text-anchor="start"
    dominant-baseline="middle"
    font-size="42"
    style="fill: ${escapeAttribute(titleTint)};"
    transform="rotate(-90 ${anchorX} ${anchorY})"
    ${liteAttrs}
  `;

  if (isLite) return `<text ${attrs}>${escapeHtml(title)}</text>`;

  return `
    <text ${attrs} filter="url(#${svgId}-spineTitleGlow)">${escapeHtml(title)}</text>
    <text ${attrs}>${escapeHtml(title)}</text>
  `;
}

function renderMediaFrontTitle(title, titleBox, svgId, titleTint) {
  const maxLineWidth =
    (titleBox.maxX - MEDIA_FRONT_TITLE_RIGHT_INSET) -
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

function isLitePerformanceMode() {
  return window.KIOSK_PERF_MODE === "lite";
}

function renderMediaSectionPlates(
  items,
  className,
  gap = MEDIA_SPINE_TO_SPINE_GAP,
) {
  return getShelfMediaGroups(items, gap)
    .map(
      (group) => `
    <div class="${className}" style="left: ${group.left}px" aria-hidden="true">
      <span>${group.title}</span>
    </div>
  `,
    )
    .join("");
}

function getShelfMediaGroups(items, gap = MEDIA_SPINE_TO_SPINE_GAP) {
  let left = SHOWS_SPINE_START_X;
  const categories = [];

  items.forEach((item) => {
    let group = categories.find(
      (candidate) => candidate.title === item.category,
    );
    if (!group) {
      group = {
        left,
        title: item.category,
        items: [],
      };
      categories.push(group);
    }
    group.items.push(item);
  });

  return categories.map((category) => {
    const positionedGroup = {
      ...category,
      left,
    };

    left += getMediaGroupWidth(category.items, gap) + SHOWS_GROUP_GAP;
    return positionedGroup;
  });
}

function positionMediaGroupItems(items, groupLeft, gap) {
  let x = groupLeft;

  return items.map((item) => {
    const positionedItem = {
      ...item,
      x,
      bottom: MEDIA_SPINE_BOTTOM,
      height: MEDIA_SPINE_HEIGHT,
    };
    x += getMediaSpineStep(item, gap);
    return positionedItem;
  });
}

function getMediaGroupWidth(items, gap) {
  return items.reduce((width, item) => width + getMediaSpineStep(item, gap), 0);
}

function getMediaSpineStep(item, gap) {
  const skin = getMediaSkin(item, "spine");
  const bounds = polygonBounds(skin.artPolygons.spineArt);
  const objectWidth = getMediaObjectWidth(skin, MEDIA_SPINE_HEIGHT);
  const spineWidth = (bounds.width / skin.viewBox.width) * objectWidth;
  return spineWidth + gap;
}

function enrichMediaColor(hexColor) {
  const rgb = parseHexColor(hexColor);
  if (!rgb) return hexColor;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const saturation = Math.min(0.74, Math.max(0.42, hsl.s * 1.55));
  const lightness = Math.min(0.42, Math.max(0.24, hsl.l + 0.14));
  return hslToHex(hsl.h, saturation, lightness);
}

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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function renderMediaClipPaths(polygons, svgId) {
  return Object.entries(polygons)
    .map(([name, polygon]) => renderMediaClipPath(name, polygon, svgId))
    .join("");
}

function renderMediaClipPath(name, polygon, svgId) {
  return `
    <clipPath id="${svgId}-${name}">
      <polygon points="${escapeAttribute(polygon)}" />
    </clipPath>
  `;
}

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

function polygonTopEdgeAngle(points) {
  const [start, end] = points;
  const radians = Math.atan2(end[1] - start[1], end[0] - start[0]);
  return Number(((radians * 180) / Math.PI).toFixed(3));
}

function roundPercent(value) {
  return Number(value.toFixed(3));
}

function parsePolygon(polygon) {
  return polygon.split(/\s+/).map((point) => point.split(",").map(Number));
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function renderScrollLabel() {
  return `<div class="shelf-scroll-label" aria-hidden="true">SCROLL &nbsp; &gt;</div>`;
}

function renderTodayShelfPreview(now, nextMealId, special) {
  return `
    <button class="home-shelf today-home-shelf" type="button" data-action="expand-shelf" data-shelf="TODAY">
      <div class="home-shelf-label">TODAY SHELF</div>
      <div class="home-shelf-board">
        <div class="preview-calendar">
          <span>${formatDayLabel(now)}</span>
          <strong>${toTitleCase(formatDateLabel(now))}</strong>
        </div>
        <div class="preview-clock">${formatClock(now)}</div>
        <div class="preview-meals">
          ${MEALS.map(
            (meal) => `
            <div data-next="${meal.id === nextMealId}">
              <span>${meal.displayTime}</span>
              <strong>${meal.label[0]}${meal.label.slice(1).toLowerCase()}</strong>
            </div>
          `,
          ).join("")}
        </div>
        <div class="preview-note" data-has-note="${Boolean(special)}">
          ${special ? `<span>Today Only</span><strong>${special.title}</strong>` : `<span>Today Only</span><strong>Quiet Day</strong>`}
        </div>
      </div>
    </button>
  `;
}

function renderMediaShelfPreview(kind, label, items, recentMap) {
  return `
    <button class="home-shelf media-home-shelf" type="button" data-action="expand-shelf" data-shelf="${kind}">
      <div class="home-shelf-label">${label.toUpperCase()}</div>
      <div class="home-shelf-board">
        <div class="preview-covers">
          ${items.map((item) => renderPreviewItem(kind, item, recentMap)).join("")}
          <div class="preview-blank-space"></div>
        </div>
      </div>
    </button>
  `;
}

function renderPreviewItem(kind, item, recentMap) {
  const className =
    kind === "BOOKS" ? "preview-book-cover" : "preview-dvd-cover";
  return `
    <div class="preview-cover-item ${className}" data-recent="${isRecent(recentMap[item.id])}">
      <img src="${escapeAttribute(item.masterArt)}" alt="" aria-hidden="true" draggable="false" />
      <span>${escapeHtml(item.title)}</span>
    </div>
  `;
}

function renderTodayExpanded(now) {
  const weekdayKey = formatWeekdayKey(now);
  const special = TODAY_SPECIALS[weekdayKey];
  const nextMeal = getMealState(now).nextMealId;

  return `
    <section class="screen today-screen expanded-screen" aria-label="Today shelf">
      ${renderBackButton()}
      <header class="today-header">
        <div>
          <div class="screen-kicker">TODAY SHELF</div>
          <h1>${formatDayLabel(now)}</h1>
          <div class="today-date">${toTitleCase(formatDateLabel(now))}</div>
        </div>
        <div class="tablet-clock" aria-label="Current time">${formatClock(now)}</div>
      </header>

      <section class="paper-card meals-paper" aria-label="Meals today">
        <div class="paper-title">Meals Today</div>
        <div class="meal-list">
          ${MEALS.map((meal) => renderMealRow(meal, nextMeal)).join("")}
        </div>
      </section>

      ${
        special
          ? `<section class="today-note" aria-label="Today only">
              <div class="pin"></div>
              <div class="note-label">Today Only</div>
              <h2>${special.title}</h2>
              <div class="note-time">${special.time}</div>
              <div class="note-place">${special.place}</div>
              <p>${special.note}</p>
            </section>`
          : `<section class="today-note today-note-empty" aria-label="No special item">
              <div class="pin"></div>
              <div class="note-label">Today Only</div>
              <h2>Nothing Special Today</h2>
              <p>Just follow the meal times and enjoy a quiet day.</p>
            </section>`
      }
    </section>
  `;
}

function renderMealRow(meal, nextMealId) {
  const isNext = meal.id === nextMealId;
  return `
    <div class="meal-row" data-next="${isNext}">
      <div class="meal-time">${meal.displayTime}</div>
      <div class="meal-label">${meal.label[0]}${meal.label.slice(1).toLowerCase()}</div>
      ${isNext ? `<div class="next-flag">NEXT</div>` : ""}
    </div>
  `;
}

function renderExpandedShelf(kind, items, recentMap) {
  const grouped = groupByCategory(items);
  const title = kind === "BOOKS" ? "Books Shelf" : "Shows Shelf";

  return `
    <section class="screen shelf-screen expanded-screen" aria-label="${title}">
      ${renderBackButton()}
      <header class="shelf-header">
        <div>
          <div class="screen-kicker">${kind}</div>
          <h1>${title}</h1>
        </div>
      </header>

      <div class="shelf-window" data-shelf-kind="${kind}">
        <div class="shelf-track">
          ${grouped
            .map(([category, categoryItems]) =>
              renderShelfSection(kind, category, categoryItems, recentMap),
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

function renderBackButton() {
  return `<button class="back-home-button" type="button" data-action="back-home">BACK TO DAVID'S STUFF</button>`;
}

function renderShelfSection(kind, category, items, recentMap) {
  return `
    <section class="shelf-section" aria-label="${category}">
      <h2>${category}</h2>
      <div class="shelf-board">
        ${items.map((item) => renderShelfItem(kind, item, recentMap)).join("")}
        <div class="blank-shelf-space" aria-hidden="true"></div>
      </div>
    </section>
  `;
}

function renderShelfItem(kind, item, recentMap) {
  const recent = isRecent(recentMap[item.id]);
  const highlighted = kind === "SHOWS" && state.highlightedShowId === item.id;
  const className =
    kind === "BOOKS" ? "expanded-book-cover" : "expanded-dvd-cover";

  return `
    <button
      class="shelf-item expanded-cover-item ${className}"
      type="button"
      data-action="take-off"
      data-kind="${kind}"
      data-item-id="${item.id}"
      data-recent="${recent}"
      data-highlighted="${highlighted}"
    >
      <img src="${escapeAttribute(item.masterArt)}" alt="" aria-hidden="true" draggable="false" />
      <span class="item-title">${escapeHtml(item.title)}</span>
    </button>
  `;
}

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

function renderBookIcon() {
  return `
    <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M8 11h13c3 0 5 2 5 5v21c0-3-2-5-5-5H8z" />
      <path d="M40 11H27c-3 0-5 2-5 5v21c0-3 2-5 5-5h13z" />
      <path d="M24 16v21" />
    </svg>
  `;
}

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

function renderReturnIcon() {
  return `
    <svg class="action-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M19 13 8 24l11 11" />
      <path d="M9 24h21c6 0 10 4 10 10v2" />
    </svg>
  `;
}

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

function getVideoLaunchDebugText() {
  const launch = state.videoLaunchDebug;
  if (!launch) return "";
  if (launch.mode === "LIVE" && launch.fired) return "";
  if (launch.url) return launch.url;
  return `VoiceMonkey URL not configured for ${launch.command || state.handoffItem?.command || state.handoffItem?.title || "this show"}`;
}

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

  if (action === "media-spine") {
    const kind = target.dataset.kind;
    state.selectedKind = kind;
    state.takeOffExiting = false;
    state.selectedItem = findShelfMediaItem(
      kind,
      target.dataset.itemId,
      target.dataset.title,
    );
    if (state.selectedItem) render();
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
    state.readerPage = 0;
    state.readerTurnDirection = "turn-prev";
    render();
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

function handleReaderPointerDown(event) {
  if (!state.readerItem) return;
  state.readerSwipeStarted = false;
}

function markUserInteraction() {
  state.lastInteractionAt = Date.now();
}

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

function cancelHomeShelfSwipe() {
  state.homeSwipeStarted = false;
  state.homeSwipeShelf = null;
}

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

function handleReaderPointerUp(event) {
  if (!state.readerItem) return;
  state.readerSwipeStarted = false;
}

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

function goToNextReaderPage() {
  if (!state.readerItem) return;

  const pageCount = getReaderPageCount(state.readerItem);
  if (state.readerPage >= pageCount - 1) {
    markRecent("davidsStuff.recentRead", state.recentRead, state.readerItem.id);
    finishReading();
    return;
  }
  if (state.readerPage >= pageCount) return;

  state.readerPage += 1;
  state.readerTurnDirection = "turn-next";
  if (state.readerPage >= pageCount) {
    markRecent("davidsStuff.recentRead", state.recentRead, state.readerItem.id);
  }
  render();
}

function goToPreviousReaderPage() {
  if (!state.readerItem || state.readerPage <= 0) return;

  state.readerPage = Math.max(0, state.readerPage - 1);
  state.readerTurnDirection = "turn-prev";
  render();
}

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
  state.view = "SHELF";
  state.activeShelf = "BOOKS";
  render();
}

function handleReaderScroll(event) {
  if (!state.readerItem) return;

  const track = event.target.closest?.(".reader-page-track");
  if (!track) return;

  markUserInteraction();
  const pageWidth = track.clientWidth || SHELF_PANEL_WIDTH;
  const pageCount = getReaderPageCount(state.readerItem);
  const nextPage = clamp(
    Math.round(track.scrollLeft / pageWidth),
    0,
    Math.max(0, pageCount - 1),
  );
  state.readerPage = nextPage;
  state.readerTurnDirection = "";
  syncReaderControls(nextPage, pageCount);
}

function restoreReaderScroll() {
  if (!state.readerItem) return;

  const track = document.querySelector(".reader-page-track");
  if (!track) return;

  const pageWidth = track.clientWidth || SHELF_PANEL_WIDTH;
  const targetScrollLeft = state.readerPage * pageWidth;
  if (Math.abs(track.scrollLeft - targetScrollLeft) <= 2) return;
  track.scrollLeft = targetScrollLeft;
  syncReaderControls(state.readerPage, getReaderPageCount(state.readerItem));
}

function syncReaderControls(pageIndex, pageCount) {
  const screen = document.querySelector(".reader-screen");
  if (!screen) return;

  const footer = screen.querySelector(".reader-controls .reader-footer");
  if (footer) footer.textContent = `Page ${pageIndex + 1} of ${pageCount}`;

  const previousButton = screen.querySelector('[data-action="reader-prev"]');
  if (previousButton) previousButton.disabled = pageIndex === 0;

  const nextButton = screen.querySelector('[data-action="reader-next"]');
  if (nextButton) {
    nextButton.textContent = pageIndex >= pageCount - 1 ? "Done" : "Next";
  }
}

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

function clampShowsScroll(scrollLeft) {
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, getShowsMaxScrollLeft());
}

function clampBooksScroll(scrollLeft) {
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, getBooksMaxScrollLeft());
}

function clampTodayScroll(scrollLeft) {
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, getTodayMaxScrollLeft());
}

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

function isHomeView() {
  return !state.readerItem && !state.handoffItem && state.view === "HOME";
}

function isShelfImageView() {
  return !state.readerItem && !state.handoffItem && state.view === "SHELF";
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function routeToShelf(pathname) {
  const route = pathname.replace(/\/+$/, "").split("/").pop()?.toLowerCase();
  if (route === "today") return "TODAY";
  if (route === "shows") return "SHOWS";
  if (route === "books") return "BOOKS";
  return null;
}

function startHandoffTimer() {
  window.clearTimeout(state.handoffTimer);
  state.handoffTimer = window.setTimeout(finishHandoff, HANDOFF_MS);
}

function finishHandoff() {
  window.clearTimeout(state.handoffTimer);
  state.handoffTimer = null;
  state.handoffItem = null;
  state.videoLaunchDebug = null;
  state.view = "SHELF";
  state.activeShelf = "SHOWS";
  render();
}

function clearSelection() {
  state.selectedItem = null;
  state.selectedKind = null;
  state.takeOffExiting = false;
}

function findItem(kind, id) {
  const source = kind === "BOOKS" ? booksShelfMedia : showsShelfMedia;
  return source.find((item) => item.id === id) ?? null;
}

function findShelfMediaItem(kind, id, title) {
  const source = kind === "BOOKS" ? booksShelfMedia : showsShelfMedia;
  const shelfItem =
    source.find((item) => item.id === id) ??
    source.find((item) => item.title === title) ??
    null;
  const catalogItem = findItem(kind, id);

  if (!shelfItem) return catalogItem;
  return {
    ...catalogItem,
    ...shelfItem,
    category: shelfItem.category ?? catalogItem?.category,
  };
}

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

function groupByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return [...groups.entries()];
}

function markRecent(storageKey, recentMap, id) {
  recentMap[id] = Date.now();
  localStorage.setItem(storageKey, JSON.stringify(recentMap));
}

function loadRecent(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "{}");
  } catch {
    return {};
  }
}

function isRecent(timestamp) {
  if (!timestamp) return false;
  return Date.now() - Number(timestamp) < RECENT_DAYS * 24 * 60 * 60 * 1000;
}

function toTitleCase(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function formatShelfMealTime(time) {
  const minutes = parseTimeToMinutes(time);
  const hour24 = Math.floor(minutes / 60);
  const hour = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "pm" : "am";
  return `${hour} ${suffix}`;
}

function getTodayExtensionPanelCount(now = getNow()) {
  return getTodaySpecial(now)
    ? TODAY_EXTENSION_PANELS_WITH_SPECIAL
    : TODAY_EXTENSION_PANELS_WITHOUT_SPECIAL;
}

function getTodayMaxScrollLeft(now = getNow()) {
  return SHELF_PANEL_WIDTH * getTodayExtensionPanelCount(now);
}

function getTodaySpecial(now) {
  return TODAY_SPECIALS[formatWeekdayKey(now)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
