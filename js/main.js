import {
  MEALS,
  READ_CONTENT,
  TODAY_SPECIALS,
  WATCH_CONTENT,
} from "./app-data.js";
import { fitStageToViewport } from "./layout.js";
import { PlaybackService } from "./playback.js";
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
const SHOWS_SPINE_WIDTH = 170;
const SHOWS_SPINE_GAP = -85;
const SHOWS_GROUP_GAP = SHOWS_SPINE_WIDTH * 3;
const SHOWS_TEST_GROUPS = [4, 1, 9, 3];
const SHOWS_SECTION_TITLES = ["Westerns", "War Movies", "Favorites", "Family"];
const BOOKS_TEST_GROUPS = [3, 2, 6, 1];
const BOOKS_SECTION_TITLES = ["Novels", "History", "Favorites", "Faith"];
const SHELF_EXTENSION_IMAGE = "./assets/shelves/shelf0.jpg";
const SHOWS_SPINE_IMAGE = "./assets/objects/dvd-spine.png";
const BOOKS_SPINE_IMAGE = "./assets/objects/book-spine.png";
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
const TODAY_EXTENSION_PANELS = 5;
const TODAY_MAX_SCROLL_LEFT = SHELF_PANEL_WIDTH * TODAY_EXTENSION_PANELS;

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

function bootstrap() {
  applyInitialShelfRoute();
  fitStageToViewport();
  bindGlobalControls();
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

  if (state.readerItem) {
    main.innerHTML = renderReader();
    return;
  }

  if (state.handoffItem) {
    main.innerHTML = renderHandoff();
    return;
  }

  if (state.view === "HOME") {
    main.innerHTML = renderHome();
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
  const mealMessage = document.getElementById("meal-message");

  mealTimer?.setAttribute("data-rest", String(mealState.resting));
  mealTimer?.classList.toggle("alert-card-hidden", state.alertHidden);
  if (mealName) mealName.textContent = mealState.label;
  if (mealFill) mealFill.style.width = `${mealState.fillPercent}%`;
  if (mealTarget) mealTarget.textContent = mealState.targetLabel;
  if (mealMessage) mealMessage.textContent = mealState.message;
}

function renderHome() {
  return `
    <section class="screen home-screen" aria-label="David's Stuff">
      <img class="home-main-image" src="./assets/home.jpg" alt="" aria-hidden="true" draggable="false" />
      <button class="home-tap-zone today-tap-zone" type="button" data-action="expand-shelf" data-shelf="TODAY" aria-label="Today shelf"></button>
      <button class="home-tap-zone shows-tap-zone" type="button" data-action="expand-shelf" data-shelf="SHOWS" aria-label="Shows shelf"></button>
      <button class="home-tap-zone books-tap-zone" type="button" data-action="expand-shelf" data-shelf="BOOKS" aria-label="Books shelf"></button>
    </section>
  `;
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
  const extensionPanels = Array.from(
    { length: TODAY_EXTENSION_PANELS },
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
    <div class="today-object-layer">
      <div class="today-led-clock" aria-label="Current time">
        <img src="${TODAY_CLOCK_IMAGE}" alt="" aria-hidden="true" draggable="false" />
        <div class="today-led-clock-display">
          <div class="today-led-clock-text">${formatClock(now)}</div>
        </div>
      </div>

      <section class="today-special-card" aria-label="Today only">
        <img src="${TODAY_SPECIAL_IMAGE}" alt="" aria-hidden="true" draggable="false" />
        <div class="today-card-content">
          <h2>Today Only</h2>
          ${
            special
              ? `<strong>${special.title}</strong>
                <span>${special.time}</span>
                <p>${special.place}</p>`
              : `<strong>Quiet Day</strong>
                <span>No special event</span>
                <p>Just enjoy the day.</p>`
          }
        </div>
      </section>

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
          ${renderBooksTestSpines()}
          ${renderBooksSectionPlates()}
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
          ${renderShowsTestSpines()}
          ${renderShowsSectionPlates()}
          ${renderScrollLabel()}
        </div>
      </div>
      <button class="shelf-back-zone" type="button" data-action="back-home" aria-label="Back to home">BACK</button>
    </section>
  `;
}

function renderShowsTestSpines() {
  const spines = [];

  getShowsTestGroups().forEach((group) => {
    for (let index = 0; index < group.count; index += 1) {
      const left = group.left + index * (SHOWS_SPINE_WIDTH + SHOWS_SPINE_GAP);
      spines.push(`
        <button
          class="shows-test-spine"
          type="button"
          data-action="test-spine"
          aria-label="Test media spine"
          style="left: ${left}px"
        >
          <img src="${SHOWS_SPINE_IMAGE}" alt="" aria-hidden="true" draggable="false" />
        </button>
      `);
    }
  });

  return spines.join("");
}

function renderShowsSectionPlates() {
  return getShowsTestGroups()
    .map(
      (group) => `
    <div class="shows-section-plate" style="left: ${group.left}px" aria-hidden="true">
      <span>${group.title}</span>
    </div>
  `,
    )
    .join("");
}

function renderBooksTestSpines() {
  const spines = [];

  getBooksTestGroups().forEach((group) => {
    for (let index = 0; index < group.count; index += 1) {
      const left = group.left + index * (SHOWS_SPINE_WIDTH + SHOWS_SPINE_GAP);
      spines.push(`
        <button
          class="books-test-spine"
          type="button"
          data-action="test-spine"
          aria-label="Test book spine"
          style="left: ${left}px"
        >
          <img src="${BOOKS_SPINE_IMAGE}" alt="" aria-hidden="true" draggable="false" />
        </button>
      `);
    }
  });

  return spines.join("");
}

function renderBooksSectionPlates() {
  return getBooksTestGroups()
    .map(
      (group) => `
    <div class="books-section-plate" style="left: ${group.left}px" aria-hidden="true">
      <span>${group.title}</span>
    </div>
  `,
    )
    .join("");
}

function getShowsTestGroups() {
  let left = SHOWS_SPINE_START_X;

  return SHOWS_TEST_GROUPS.map((count, index) => {
    const group = {
      count,
      left,
      title: SHOWS_SECTION_TITLES[index],
    };

    left += count * (SHOWS_SPINE_WIDTH + SHOWS_SPINE_GAP) + SHOWS_GROUP_GAP;
    return group;
  });
}

function getBooksTestGroups() {
  let left = SHOWS_SPINE_START_X;

  return BOOKS_TEST_GROUPS.map((count, index) => {
    const group = {
      count,
      left,
      title: BOOKS_SECTION_TITLES[index],
    };

    left += count * (SHOWS_SPINE_WIDTH + SHOWS_SPINE_GAP) + SHOWS_GROUP_GAP;
    return group;
  });
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

  return `
    <div class="take-off-layer" role="dialog" aria-label="${item.title}">
      <div class="shelf-dim"></div>
      <section class="taken-card ${isBook ? "book-cover" : "movie-cover"}">
        <div class="cover-category">${item.category}</div>
        <h2>${item.title}</h2>
        <p>${item.description}</p>
        <div class="cover-actions">
          <button class="primary-action" type="button" data-action="${isBook ? "read-book" : "watch-item"}">${actionWord}</button>
          <button class="secondary-action" type="button" data-action="put-back">PUT BACK</button>
        </div>
      </section>
    </div>
  `;
}

function renderReader() {
  const item = state.readerItem;
  const pages = item.pages;
  const isEnd = state.readerPage >= pages.length;
  const pageNumber = Math.min(state.readerPage + 1, pages.length);

  if (isEnd) {
    return `
      <section class="screen reader-screen reader-end" aria-label="The end">
        <div class="reader-paper">
          <div class="the-end">THE END</div>
          <p>You finished:</p>
          <h1>${item.title}</h1>
          <div class="reader-actions">
            <button class="primary-action" type="button" data-action="read-again">READ AGAIN</button>
            <button class="secondary-action" type="button" data-action="finish-reading">PUT BACK</button>
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="screen reader-screen" aria-label="${item.title}">
      <article class="reader-paper">
        <div class="reader-top">
          <div class="reader-book-title">${item.title}</div>
          <div class="reader-page-count">Page ${pageNumber} of ${pages.length}</div>
        </div>
        <p class="reader-text">${pages[state.readerPage]}</p>
        <div class="reader-actions">
          <button class="secondary-action" type="button" data-action="reader-prev" ${state.readerPage === 0 ? "disabled" : ""}>BACK A PAGE</button>
          <button class="primary-action" type="button" data-action="reader-next">${state.readerPage === pages.length - 1 ? "FINISH" : "NEXT PAGE"}</button>
          <button class="secondary-action" type="button" data-action="finish-reading">PUT BACK</button>
        </div>
      </article>
    </section>
  `;
}

function renderHandoff() {
  return `
    <section class="screen handoff-screen" aria-label="TV handoff">
      <div class="handoff-card">
        <div class="screen-kicker">SHOWS SHELF</div>
        <h1>${state.handoffItem.title}</h1>
        <p>Your show is ready on the TV.</p>
        <p>Use your TV remote to watch.</p>
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

  if (action === "test-spine") {
    console.info("spine tapped");
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
    clearSelection();
    render();
    return;
  }

  if (action === "reader-prev") {
    state.readerPage = Math.max(0, state.readerPage - 1);
    render();
    return;
  }

  if (action === "reader-next") {
    state.readerPage += 1;
    if (state.readerItem && state.readerPage >= state.readerItem.pages.length) {
      markRecent(
        "davidsStuff.recentRead",
        state.recentRead,
        state.readerItem.id,
      );
    }
    render();
    return;
  }

  if (action === "read-again") {
    state.readerPage = 0;
    render();
    return;
  }

  if (action === "finish-reading") {
    if (state.readerItem && state.readerPage >= state.readerItem.pages.length) {
      markRecent(
        "davidsStuff.recentRead",
        state.recentRead,
        state.readerItem.id,
      );
    }
    state.readerItem = null;
    state.readerPage = 0;
    state.view = "SHELF";
    state.activeShelf = "BOOKS";
    render();
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
    if (shelf.scrollLeft < SHELF_PANEL_WIDTH) {
      shelf.scrollLeft = SHELF_PANEL_WIDTH;
    } else if (shelf.scrollLeft > TODAY_MAX_SCROLL_LEFT) {
      shelf.scrollLeft = TODAY_MAX_SCROLL_LEFT;
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
  return clamp(scrollLeft, SHELF_PANEL_WIDTH, TODAY_MAX_SCROLL_LEFT);
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
      nextMealId: null,
      label: "REST WHEN READY",
      fillPercent: 100,
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
  const remaining = Math.max(0, nextMeal.minutes - nowMinutes);
  const fillPercent = clamp(((span - remaining) / span) * 100, 0, 100);
  const timeLeft = formatMealTimeLeft(remaining);

  return {
    resting: false,
    nextMealId: nextMeal.id,
    label: nextMeal.label,
    fillPercent,
    timeLeft,
    targetLabel: `${nextMeal.label}\n${nextMeal.displayTime}`,
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
