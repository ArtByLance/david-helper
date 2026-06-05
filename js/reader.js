/*
 * Reader view renderer.
 *
 * main.js owns navigation and state; this module stays pure and returns HTML
 * for the currently selected book. Book data is JSON-driven, with a generated
 * title page followed by chapter pages that may choose image/text ordering.
 */

// Render the horizontally scrollable reader screen for the active book.
export function renderReaderView({ item, pageIndex }) {
  const pages = buildReaderPages(item);
  const safePageIndex = clamp(pageIndex, 0, Math.max(0, pages.length - 1));

  return `
    <section class="screen reader-screen reader-slider-screen" aria-label="${escapeHtml(item.title)}">
      ${renderPutBackButton()}
      <div class="reader-page-track" data-reader-current-page="${safePageIndex}" data-reader-page-count="${pages.length}">
        ${pages
          .map((page, index) => renderReaderPagePanel(item, page, index, pages.length))
          .join("")}
      </div>
      ${renderReaderPageClickZones(safePageIndex)}
      ${renderReaderControls(safePageIndex, pages.length)}
    </section>
  `;
}

// Report page count to main.js without duplicating page-building logic there.
export function getReaderPageCount(item) {
  return buildReaderPages(item).length;
}

// Dispatch each normalized page to the matching visual template.
function renderReaderPagePanel(item, page, pageIndex, pageCount) {
  if (page.type === "title") {
    return renderTitlePagePanel(item, page, pageIndex, pageCount);
  }
  if (page.layout === "image-text") {
    return renderChapterPagePanel(page, pageIndex, pageCount);
  }
  if (page.layout === "text-image") {
    return renderChapterEndPagePanel(page, pageIndex, pageCount);
  }

  return `
    <article class="reader-page reader-text-page" aria-label="${escapeHtml(page.chapterTitle)}">
      <div class="reader-title">${escapeHtml(page.chapterTitle)}</div>
      <div class="reader-content">
        <div class="reader-text">${renderParagraphs(page.text)}</div>
      </div>
    </article>
  `;
}

// Render the generated title page from book cover/title metadata.
function renderTitlePagePanel(item, page, pageIndex, pageCount) {
  return `
    <article class="reader-page title-page" aria-label="${escapeHtml(item.title)}">
      <img class="title-cover" src="${escapeAttribute(page.cover)}" alt="" draggable="false" />
      <h1 class="title-heading">${escapeHtml(page.title)}</h1>
    </article>
  `;
}

// Render a chapter page with image first and text beside it.
function renderChapterPagePanel(page, pageIndex, pageCount) {
  return `
    <article class="reader-page chapter-screen" aria-label="${escapeHtml(page.chapterTitle)}">
      <img class="chapter-image" src="${escapeAttribute(page.image)}" alt="" draggable="false" />
      <div class="chapter-body">
        <div class="chapter-number">Chapter ${page.chapterNumber}</div>
        <h1 class="chapter-name">${escapeHtml(page.chapterTitle)}</h1>
        <div class="chapter-text">${renderParagraphs(page.text)}</div>
      </div>
    </article>
  `;
}

// Render a chapter page with text first and supporting image beside it.
function renderChapterEndPagePanel(page, pageIndex, pageCount) {
  return `
    <article class="reader-page chapter-end-screen" aria-label="${escapeHtml(page.chapterTitle)}">
      <div class="reader-title">${escapeHtml(page.chapterTitle)}</div>
      <div class="chapter-end-content">
        <div class="reader-text">${renderParagraphs(page.text)}</div>
        <img class="chapter-end-image" src="${escapeAttribute(page.image)}" alt="" draggable="false" />
      </div>
    </article>
  `;
}

// Persistent exit control in the upper reader chrome.
function renderPutBackButton() {
  return `<button class="reader-exit" type="button" data-action="finish-reading">Put Back</button>`;
}

// Invisible page-area fallbacks for David: left side goes back, right advances.
function renderReaderPageClickZones(pageIndex) {
  return `
    <div class="reader-page-click-zones" aria-hidden="true">
      <button class="reader-page-click-zone reader-page-click-prev" type="button" data-action="reader-prev" tabindex="-1" ${pageIndex === 0 ? "disabled" : ""}></button>
      <button class="reader-page-click-zone reader-page-click-next" type="button" data-action="reader-next" tabindex="-1"></button>
    </div>
  `;
}

// Render page controls with disabled/Done states derived from page index.
function renderReaderControls(pageIndex, pageCount) {
  const isLastPage = pageIndex >= pageCount - 1;
  return `
    <div class="reader-controls" aria-label="Reading controls">
      <button class="reader-control reader-control-prev" type="button" data-action="reader-prev" ${pageIndex === 0 ? "disabled" : ""}>Back</button>
      ${renderFooter(pageIndex, pageCount)}
      <button class="reader-control reader-control-next" type="button" data-action="reader-next">${isLastPage ? "Done" : "Next"}</button>
    </div>
  `;
}

// Render human-readable page position.
function renderFooter(pageIndex, pageCount) {
  return `<div class="reader-footer">Page ${pageIndex + 1} of ${pageCount}</div>`;
}

// Normalize book JSON into the flat page list consumed by the renderer.
function buildReaderPages(item) {
  const chapters = Array.isArray(item.chapters) ? item.chapters : [];
  const chapterPages = chapters.flatMap((chapter, chapterIndex) =>
    (chapter.pages ?? []).map((page) => ({
      ...page,
      type: "chapter",
      chapterTitle: chapter.title,
      chapterNumber: chapterIndex + 1,
      image: chapter.image ?? getChapterImage(item, chapterIndex),
      text: normalizeParagraphs(page.text),
    })),
  );
  const pages = [
    {
      type: "title",
      title: item.title,
      cover: item.openingImage ?? item.cover ?? item.masterArt,
    },
    ...chapterPages,
  ];

  return pages.map((page) => ({
    ...page,
    totalPages: pages.length,
  }));
}

// Default image convention for chapters that do not specify a custom image.
function getChapterImage(item, chapterIndex) {
  return `./assets/media/books/${item.id}/${item.id}-chapter-${chapterIndex + 1}.jpg`;
}

// Accept either paragraph arrays or double-newline separated text.
function normalizeParagraphs(text) {
  if (Array.isArray(text)) return text.filter(Boolean);
  if (!text) return [];
  return String(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

// Render escaped paragraphs into the reader body.
function renderParagraphs(paragraphs) {
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

// Clamp requested page indexes into the available range.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Escape text inserted into reader template strings as HTML.
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Attribute escaping currently matches HTML escaping for reader templates.
function escapeAttribute(value) {
  return escapeHtml(value);
}
