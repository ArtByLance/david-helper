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
      ${renderReaderControls(safePageIndex, pages.length)}
    </section>
  `;
}

export function getReaderPageCount(item) {
  return buildReaderPages(item).length;
}

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

function renderTitlePagePanel(item, page, pageIndex, pageCount) {
  return `
    <article class="reader-page title-page" aria-label="${escapeHtml(item.title)}">
      <img class="title-cover" src="${escapeAttribute(page.cover)}" alt="" draggable="false" />
      <h1 class="title-heading">${escapeHtml(page.title)}</h1>
    </article>
  `;
}

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

function renderPutBackButton() {
  return `<button class="reader-exit" type="button" data-action="finish-reading">Put Back</button>`;
}

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

function renderFooter(pageIndex, pageCount) {
  return `<div class="reader-footer">Page ${pageIndex + 1} of ${pageCount}</div>`;
}

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
      cover: item.cover ?? item.masterArt,
    },
    ...chapterPages,
  ];

  return pages.map((page) => ({
    ...page,
    totalPages: pages.length,
  }));
}

function getChapterImage(item, chapterIndex) {
  return `./assets/media/books/chapters/${item.id}-${chapterIndex + 1}.jpg`;
}

function normalizeParagraphs(text) {
  if (Array.isArray(text)) return text.filter(Boolean);
  if (!text) return [];
  return String(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function renderParagraphs(paragraphs) {
  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
