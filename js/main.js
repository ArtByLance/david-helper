import {
  MEALS,
  READ_CONTENT,
  TODAY_SPECIALS,
  WATCH_CONTENT,
} from "./app-data.js";
import { fitStageToViewport } from "./layout.js";
import { PlaybackService } from "./playback.js";
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
const ALERT_TRANSITION_MS = 260;
const ALERT_HOME_ENTRY_DELAY_MS = 750;
const VIEW_TRANSITION_OUT_MS = 150;
const VIEW_TRANSITION_IN_MS = 240;
const SHELF_PANEL_WIDTH = 800;
const SHOWS_SPINE_START_X = 1810;
const MEDIA_SPINE_TO_SPINE_GAP = 50;
const SHOWS_GROUP_GAP = 170 * 3;
const MEDIA_SPINE_BOTTOM = 245;
const MEDIA_SPINE_HEIGHT = 806;
const SHELF_EXTENSION_IMAGE = "./assets/shelves/shelf0.jpg";
const TODAY_CLOCK_IMAGE = "./assets/objects/clock.png";
const TODAY_MENU_IMAGE = "./assets/objects/card-menu.png";
const TODAY_NEXT_FLAG_IMAGE = "./assets/objects/next-flag-2.png";
const TODAY_SPECIAL_IMAGE = "./assets/objects/card-special.png";
const SHELF_IMAGE_BY_KIND = {
  TODAY: "./assets/shelves/shelf1.jpg",
  SHOWS: "./assets/shelves/shelf2.jpg",
  BOOKS: "./assets/shelves/shelf3.jpg",
};
const SHOWS_EXTENSION_PANELS = 7;
const SHOWS_MAX_SCROLL_LEFT = SHELF_PANEL_WIDTH * SHOWS_EXTENSION_PANELS;
const BOOKS_EXTENSION_PANELS = 6;
const BOOKS_MAX_SCROLL_LEFT = SHELF_PANEL_WIDTH * BOOKS_EXTENSION_PANELS;
const TODAY_EXTENSION_PANELS_WITH_SPECIAL = 4;
const TODAY_EXTENSION_PANELS_WITHOUT_SPECIAL = 3;
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
const MEDIA_SPINE_VIEW_SIDE_TINT = "#2f66f2";
const MEDIA_SPINE_VIEW_SIDE_TINT_OPACITY = 0.5;
const MEDIA_FRONT_VIEW_SPINE_OPACITY = 0.4;
const MEDIA_FRONT_TITLE_ROTATION_OFFSET = -4.8;
const MEDIA_FRONT_TITLE_RIGHT_INSET = 92;
const MEDIA_FRONT_TITLE_BOTTOM_INSET = 105;
const MEDIA_DEFAULT_TITLE_TINT = "#fff6df";
const MEDIA_SPINE_TITLE_X_OFFSET = 7;
const MEDIA_SPINE_TITLE_Y_OFFSET = 34;
const SHOWS_TEST_MEDIA = [
  {
    id: "frasier",
    title: "Frasier",
    type: "dvd",
    category: "Favorites",
    masterArt: "./assets/media/frasier.svg",
  },
  {
    id: "bones",
    title: "Bones",
    type: "dvd",
    category: "Favorites",
    masterArt: "./assets/media/bones.svg",
  },
  {
    id: "western",
    title: "Western Movie",
    type: "dvd",
    category: "Favorites",
    masterArt: "./assets/media/western-movie.svg",
  },
  {
    id: "gospel",
    title: "Gospel Music",
    type: "dvd",
    category: "Favorites",
    masterArt: "./assets/media/gospel-music.svg",
  },
];
let booksShelfMedia = [];

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
  readerItem: null,
  readerPage: 0,
  readerTurnDirection: "",
  readerSwipeStartX: 0,
  readerSwipeStartY: 0,
  readerSwipeStarted: false,
  handoffItem: null,
  handoffTimer: null,
  highlightedShowId: null,
  alertHidden: false,
  alertTransitioning: false,
  viewTransitioning: false,
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
          masterArt: `./assets/media/covers/${item.id}.jpg`,
          cover: `./assets/media/covers/${item.id}.jpg`,
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
    image: chapter.image ?? `./assets/media/scenes/${bookId}-${index + 1}.jpg`,
  }));
}

async function bootstrap() {
  applyInitialShelfRoute();
  fitStageToViewport();
  bindGlobalControls();
  await loadBooksShelfMedia();
  render();
  window.setInterval(renderMealTimerOnly, 20 * 1000);
}

function bindGlobalControls() {
  document
    .getElementById("app-main")
    ?.addEventListener("click", handleMainClick);
  document
    .getElementById("app-main")
    ?.addEventListener("scroll", handleShelfScroll, true);
  document
    .getElementById("app-main")
    ?.addEventListener("pointerdown", handleReaderPointerDown);
  document
    .getElementById("app-main")
    ?.addEventListener("pointerup", handleReaderPointerUp);
  document.addEventListener("keydown", handleReaderKeyDown);
}

function render() {
  const now = getNow();
  renderMain(now);
  renderMealTimer(now);
  requestAnimationFrame(restoreShelfScroll);
}

function renderMealTimerOnly() {
  renderMealTimer(getNow());
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
  stage?.toggleAttribute("data-home", isHomeView());
  stage?.toggleAttribute("data-image-shell", isShelfImageView());
  stage?.toggleAttribute("data-reader", Boolean(state.readerItem));

  if (state.readerItem) {
    main.innerHTML = renderReaderView({
      item: state.readerItem,
      pageIndex: state.readerPage,
      turnDirection: state.readerTurnDirection,
    });
    state.readerTurnDirection = "";
    return;
  }

  if (state.handoffItem) {
    main.innerHTML = renderHandoff();
    return;
  }

  if (state.view === "HOME") {
    main.innerHTML = renderHome(now);
  } else if (state.activeShelf === "TODAY") {
    main.innerHTML = renderShelfImageShell("TODAY", now);
  } else if (state.activeShelf === "BOOKS") {
    main.innerHTML = renderShelfImageShell("BOOKS");
  } else if (state.activeShelf === "SHOWS") {
    main.innerHTML = renderShelfImageShell("SHOWS");
  }

  if (state.selectedItem) {
    main.insertAdjacentHTML("beforeend", renderTakeOffOverlay());
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

  return `
    <section class="screen home-screen" aria-label="David's Stuff">
      <img class="home-main-image" src="./assets/home.jpg" alt="" aria-hidden="true" draggable="false" />
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
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
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
      <div class="today-led-clock" aria-label="Current time">
        <img src="${TODAY_CLOCK_IMAGE}" alt="" aria-hidden="true" draggable="false" />
        <div class="today-led-clock-display">
          <div class="today-led-clock-text">${formatClock(now)}</div>
        </div>
      </div>

      ${special ? renderTodaySpecialCard(special) : ""}

      <section class="today-menu-card" aria-label="Meals today">
        <img src="${TODAY_MENU_IMAGE}" alt="" aria-hidden="true" draggable="false" />
        <div class="today-card-content">
          <h2>Meals Today</h2>
          <div class="today-meal-list">
            ${MEALS.map((meal) => renderTodayMealLine(meal, mealState.nextMealId)).join("")}
          </div>
        </div>
      </section>
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
    { length: BOOKS_EXTENSION_PANELS },
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
          ${renderMediaSpineItems(booksShelfMedia, "BOOKS")}
          ${renderMediaSectionPlates(booksShelfMedia, "books-section-plate")}
          ${renderScrollLabel()}
        </div>
      </div>
      <button class="shelf-back-zone" type="button" data-action="back-home" aria-label="Back to home">BACK</button>
    </section>
  `;
}

function renderShowsImageStrip() {
  const extensionPanels = Array.from(
    { length: SHOWS_EXTENSION_PANELS },
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
          ${renderMediaSpineItems(SHOWS_TEST_MEDIA, "SHOWS")}
          ${renderMediaSectionPlates(SHOWS_TEST_MEDIA, "shows-section-plate")}
          ${renderScrollLabel()}
        </div>
      </div>
      <button class="shelf-back-zone" type="button" data-action="back-home" aria-label="Back to home">BACK</button>
    </section>
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
  const hotspotClipPath = polygonCssClipPath(
    skin.artPolygons.spineArt,
    skin.viewBox,
  );

  return `
    <div
      class="media-object media-spine media-spine-item media-spine-${item.type}"
      aria-label="${escapeAttribute(item.title)}"
      style="--media-x: ${item.x}px; --media-bottom: ${item.bottom}px; --media-width: ${width}px; --media-height: ${item.height}px; --media-z-index: ${item.zIndex}; --media-hotspot-clip: ${hotspotClipPath};"
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

function renderMediaFrontItem(item) {
  const skin = getMediaSkin(item, "front");
  const width = getMediaObjectWidth(skin, item.height);

  return `
    <div
      class="media-object media-front media-front-item media-front-${item.type}"
      aria-label="${escapeAttribute(item.title)}"
      style="--media-x: ${item.x}px; --media-y: ${item.y}px; --media-width: ${width}px; --media-height: ${item.height}px; --media-rotation: ${item.rotationDegrees}deg;"
    >
      ${renderMediaObjectContent({ item, mode: "front", skin })}
    </div>
  `;
}

function renderMediaObjectContent({ item, mode, skin }) {
  const title = item.displayTitle ?? item.title;
  const svgId = `${slugify(item.title)}-${mode}`;

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
          baseColor && isSideFace
            ? `<rect
                width="${skin.viewBox.width}"
                height="${skin.viewBox.height}"
                fill="${escapeAttribute(displayColor)}"
                opacity="${MEDIA_SPINE_VIEW_SIDE_TINT_OPACITY}"
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
                opacity="${MEDIA_SPINE_VIEW_SIDE_TINT_OPACITY}"
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

  return `
    <svg
      class="media-svg media-titleLayer"
      viewBox="0 0 ${skin.viewBox.width} ${skin.viewBox.height}"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        ${renderMediaClipPath("title", skin.titlePolygon, svgId)}
        <filter id="${svgId}-titleShadow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#000" flood-opacity=".9" />
          <feDropShadow dx="0" dy="0" stdDeviation="39" flood-color="#000" flood-opacity=".92" />
        </filter>
        <filter id="${svgId}-spineTitleGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="0" stdDeviation="34" flood-color="#000" flood-opacity=".92" />
        </filter>
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
  const attrs = `
    class="media-titleText"
    x="${anchorX}"
    y="${anchorY}"
    text-anchor="start"
    dominant-baseline="middle"
    font-size="36"
    style="fill: ${escapeAttribute(titleTint)};"
    transform="rotate(-90 ${anchorX} ${anchorY})"
  `;

  return `
    <text ${attrs} filter="url(#${svgId}-spineTitleGlow)">${escapeHtml(title)}</text>
    <text ${attrs}>${escapeHtml(title)}</text>
  `;
}

function renderMediaFrontTitle(title, titleBox, svgId, titleTint) {
  const words = String(title).trim().split(/\s+/);
  const lineHeight = 72;
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
      ${filter}
    >${escapeHtml(word)}</text>
  `;
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

function polygonCssClipPath(polygon, viewBox) {
  return `polygon(${parsePolygon(polygon)
    .map(
      ([x, y]) =>
        `${roundPercent((x / viewBox.width) * 100)}% ${roundPercent((y / viewBox.height) * 100)}%`,
    )
    .join(", ")})`;
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
  return `<div class="shelf-scroll-label" aria-hidden="true">&lt; &nbsp; SCROLL &nbsp; &gt;</div>`;
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
        <div class="preview-spines">
          ${items.map((item) => renderPreviewItem(kind, item, recentMap)).join("")}
          <div class="preview-blank-space"></div>
        </div>
      </div>
    </button>
  `;
}

function renderPreviewItem(kind, item, recentMap) {
  const className = kind === "BOOKS" ? "book-spine" : "dvd-case";
  return `
    <div class="shelf-item ${className}" data-recent="${isRecent(recentMap[item.id])}">
      <span class="recent-ribbon" aria-hidden="true"></span>
      <span class="item-title">${item.title}</span>
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
  const className = kind === "BOOKS" ? "book-spine" : "dvd-case";

  return `
    <button
      class="shelf-item ${className}"
      type="button"
      data-action="take-off"
      data-kind="${kind}"
      data-item-id="${item.id}"
      data-recent="${recent}"
      data-highlighted="${highlighted}"
    >
      <span class="recent-ribbon" aria-hidden="true"></span>
      <span class="item-title">${item.title}</span>
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
    x: -32,
    y: -75,
    height: 1277,
    rotationDegrees: isBook ? -2 : 2,
  };

  return `
    <div class="take-off-layer" role="dialog" aria-label="${item.title}">
      <div class="shelf-dim"></div>
      <div class="take-off-media-shell">
        ${renderMediaFrontItem(coverItem)}
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
  return `
      <section class="screen handoff-screen" aria-label="TV handoff">
      <div class="handoff-card">
        <div class="screen-kicker">SHOWS SHELF</div>
        <h1>Starting the show</h1>
        <p>${state.handoffItem.title}</p>
        <p>This will return to the shelf in a minute.</p>
        <button class="secondary-action" type="button" data-action="return-shows">PUT BACK</button>
      </div>
    </section>
  `;
}

async function handleMainClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  if (
    (state.alertTransitioning || state.viewTransitioning) &&
    (action === "expand-shelf" || action === "back-home")
  )
    return;

  if (action === "expand-shelf") {
    const shelf = target.dataset.shelf;
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
    state.selectedItem = findItem(kind, target.dataset.itemId);
    render();
    return;
  }

  if (action === "put-back") {
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
    await PlaybackService.play(item);
    markRecent("davidsStuff.recentWatched", state.recentWatched, item.id);
    state.highlightedShowId = item.id;
    state.handoffItem = item;
    startHandoffTimer();
    render();
    return;
  }

  if (action === "return-shows") {
    finishHandoff();
  }
}

function handleReaderPointerDown(event) {
  if (!state.readerItem || event.target.closest("button")) return;
  state.readerSwipeStarted = true;
  state.readerSwipeStartX = event.clientX;
  state.readerSwipeStartY = event.clientY;
}

function handleReaderPointerUp(event) {
  if (!state.readerItem || !state.readerSwipeStarted) return;
  state.readerSwipeStarted = false;

  const deltaX = event.clientX - state.readerSwipeStartX;
  const deltaY = event.clientY - state.readerSwipeStartY;
  if (Math.abs(deltaX) < 70 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) {
    return;
  }

  if (deltaX < 0) {
    goToNextReaderPage();
  } else {
    goToPreviousReaderPage();
  }
}

function handleReaderKeyDown(event) {
  if (!state.readerItem) return;
  if (event.key === "ArrowLeft") goToPreviousReaderPage();
  if (event.key === "ArrowRight") goToNextReaderPage();
  if (event.key === "Escape") finishReading();
}

function goToNextReaderPage() {
  if (!state.readerItem) return;

  const pageCount = getReaderPageCount(state.readerItem);
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

function handleShelfScroll(event) {
  const shelf = event.target.closest?.("[data-shelf-kind]");
  if (!shelf) return;
  if (shelf.dataset.shelfKind === "BOOKS") {
    if (shelf.scrollLeft < SHELF_PANEL_WIDTH) {
      shelf.scrollLeft = SHELF_PANEL_WIDTH;
    } else if (shelf.scrollLeft > BOOKS_MAX_SCROLL_LEFT) {
      shelf.scrollLeft = BOOKS_MAX_SCROLL_LEFT;
    }
    state.booksScrollLeft = shelf.scrollLeft;
  } else if (shelf.dataset.shelfKind === "SHOWS") {
    if (shelf.scrollLeft < SHELF_PANEL_WIDTH) {
      shelf.scrollLeft = SHELF_PANEL_WIDTH;
    } else if (shelf.scrollLeft > SHOWS_MAX_SCROLL_LEFT) {
      shelf.scrollLeft = SHOWS_MAX_SCROLL_LEFT;
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
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, SHOWS_MAX_SCROLL_LEFT);
}

function clampBooksScroll(scrollLeft) {
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, BOOKS_MAX_SCROLL_LEFT);
}

function clampTodayScroll(scrollLeft) {
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, getTodayMaxScrollLeft());
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
  state.view = "SHELF";
  state.activeShelf = "SHOWS";
  render();
}

function clearSelection() {
  state.selectedItem = null;
  state.selectedKind = null;
}

function findItem(kind, id) {
  const source = kind === "BOOKS" ? READ_CONTENT : WATCH_CONTENT;
  return source.find((item) => item.id === id) ?? null;
}

function findShelfMediaItem(kind, id, title) {
  const source = kind === "BOOKS" ? booksShelfMedia : SHOWS_TEST_MEDIA;
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
  const nextMeal = mealsWithMinutes.find((meal) => nowMinutes < meal.minutes);

  if (!nextMeal) {
    return {
      resting: true,
      hiddenForDay: true,
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
    nextMealId: nextMeal.id,
    label: nextMeal.label,
    fillPercent,
    nowPercent,
    timeLeft,
    targetLabel: formatShelfMealTime(nextMeal.time),
    message: `We eat in ${timeLeft}.`,
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
