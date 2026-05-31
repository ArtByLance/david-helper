export function renderReaderView({ item, pageIndex, turnDirection = "" }) {
  const pages = buildReaderPages(item);
  const isEnd = pageIndex >= pages.length;

  if (isEnd) return renderEndPage(item, turnDirection);
  return renderReaderPage(item, pages, pageIndex, turnDirection);
}

export function getReaderPageCount(item) {
  return buildReaderPages(item).length;
}

function renderReaderPage(item, pages, pageIndex, turnDirection) {
  const page = pages[pageIndex];

  if (page.type === "title") {
    return renderTitlePage(item, page, pages.length, turnDirection);
  }
  if (page.layout === "image-text") {
    return renderChapterPage(page, pageIndex, turnDirection);
  }
  if (page.layout === "text-image") {
    return renderChapterEndPage(page, pageIndex, turnDirection);
  }

  return `
    <section class="screen reader-screen ${turnDirection}" aria-label="${escapeHtml(item.title)}">
      ${renderPutBackButton()}
      ${renderPageTurns(pageIndex)}
      <div class="reader-title">${escapeHtml(page.chapterTitle)}</div>
      <article class="reader-content">
        <div class="reader-text">${renderParagraphs(page.text)}</div>
      </article>
      ${renderFooter(pageIndex, pages.length)}
    </section>
  `;
}

function renderTitlePage(item, page, pageCount, turnDirection) {
  return `
    <section class="screen reader-screen title-page ${turnDirection}" aria-label="${escapeHtml(item.title)}">
      ${renderPutBackButton()}
      <button class="page-turn next" type="button" data-action="reader-next" aria-label="Start reading">Next</button>
      <img class="title-cover" src="${escapeAttribute(page.cover)}" alt="" draggable="false" />
      <h1 class="title-heading">${escapeHtml(page.title)}</h1>
      <div class="reader-footer">${pageCount} pages</div>
    </section>
  `;
}

function renderChapterPage(page, pageIndex, turnDirection) {
  return `
    <section class="screen reader-screen chapter-screen ${turnDirection}" aria-label="${escapeHtml(page.chapterTitle)}">
      ${renderPutBackButton()}
      ${renderPageTurns(pageIndex)}
      <img class="chapter-image" src="${escapeAttribute(page.image)}" alt="" draggable="false" />
      <article class="chapter-body">
        <div class="chapter-number">Chapter ${page.chapterNumber}</div>
        <h1 class="chapter-name">${escapeHtml(page.chapterTitle)}</h1>
        <div class="chapter-text">${renderParagraphs(page.text)}</div>
      </article>
      ${renderFooter(pageIndex, page.totalPages)}
    </section>
  `;
}

function renderChapterEndPage(page, pageIndex, turnDirection) {
  return `
    <section class="screen reader-screen ${turnDirection}" aria-label="${escapeHtml(page.chapterTitle)}">
      ${renderPutBackButton()}
      ${renderPageTurns(pageIndex)}
      <div class="reader-title">${escapeHtml(page.chapterTitle)}</div>
      <article class="chapter-end-content">
        <div class="reader-text">${renderParagraphs(page.text)}</div>
        <img class="chapter-end-image" src="${escapeAttribute(page.image)}" alt="" draggable="false" />
      </article>
      ${renderFooter(pageIndex, page.totalPages)}
    </section>
  `;
}

function renderEndPage(item, turnDirection) {
  return `
    <section class="screen reader-screen reader-end ${turnDirection}" aria-label="The end">
      ${renderPutBackButton()}
      <div class="reader-end-title">THE END</div>
      <p>You finished</p>
      <h1>${escapeHtml(item.title)}</h1>
      <button class="page-turn prev" type="button" data-action="read-again" aria-label="Read again">Read again</button>
    </section>
  `;
}

function renderPutBackButton() {
  return `<button class="reader-exit" type="button" data-action="finish-reading">Put Back</button>`;
}

function renderPageTurns(pageIndex) {
  return `
    <button class="page-turn prev" type="button" data-action="reader-prev" ${pageIndex === 0 ? "disabled" : ""} aria-label="Previous page">Previous</button>
    <button class="page-turn next" type="button" data-action="reader-next" aria-label="Next page">Next</button>
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
  return `./assets/media/scenes/${item.id}-${chapterIndex + 1}.jpg`;
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
