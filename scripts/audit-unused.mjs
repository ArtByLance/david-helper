#!/usr/bin/env node

/*
  Production reachability audit for David's Shelves.

  This script is intentionally conservative. It marks files as production-used
  only when they are reachable from the deployed app shell, service worker,
  production data files, route shims, or production support code. It keeps labs,
  explicit archives, and older saved versions out of the removal path so they can
  be reviewed separately without risking the deployed app.
*/

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const trackedFiles = gitTrackedFiles();
const trackedSet = new Set(trackedFiles);
const used = new Map();
const archiveOrLab = new Set();
const junk = new Set();
const productionSupport = new Set();

const CORE_ENTRYPOINTS = [
  "index.html",
  "books/index.html",
  "shows/index.html",
  "today/index.html",
  "manifest.webmanifest",
  "_headers",
  "_redirects",
  ".gitignore",
  "README.md",
  "FIRE-TV.md",
  "robots.txt",
  "sw.js",
  "css/layout.css",
  "css/text.css",
  "css/reader.css",
  "js/main.js",
  "js/app-data.js",
  "js/dementia-clock.js",
  "js/layout.js",
  "js/layout/fit-stage.js",
  "js/layout/timeline.js",
  "js/playback.js",
  "js/reader.js",
  "js/time.js",
  "js/utils.js",
  "data/config.json",
  "data/shows.json",
  "data/reader/readerIndex.json",
];

const ARCHIVE_OR_LAB_PREFIXES = [
  "assets/unused/",
  "deprecated/",
  "data/reader/books/old/",
];

const ARCHIVE_OR_LAB_FILES = new Set([
  "data/clock-lab.html",
  "media-object-lab.html",
  "reader-lab.html",
  "reader-test.html",
  "js/data.js",
  "js/encouragement-note.js",
  "js/exit-prompt.js",
  "js/render.js",
  "js/render/clock.js",
  "js/render/next-card.js",
  "js/render/today-list.js",
  "js/view-model.js",
  "js/layout/today-map.js",
]);

const PRODUCTION_SUPPORT_PREFIXES = [
  "firetv-wrapper/",
  "netlify/functions/",
];

const PRODUCTION_SUPPORT_FILES = new Set(["scripts/audit-unused.mjs"]);

const STATIC_REFERENCE_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".json",
  ".webmanifest",
  ".md",
]);

main();

function main() {
  classifyPreservedFiles();
  seedCoreEntrypoints();
  traceStaticReferences();
  traceRuntimeDataReferences();

  const usedProduction = trackedFiles.filter((file) => used.has(file)).sort();
  const candidateUnused = trackedFiles
    .filter(
      (file) =>
        !used.has(file) &&
        !archiveOrLab.has(file) &&
        !junk.has(file) &&
        !productionSupport.has(file),
    )
    .sort();

  const result = {
    generatedAt: new Date().toISOString(),
    counts: {
      tracked: trackedFiles.length,
      usedProduction: usedProduction.length,
      candidateUnused: candidateUnused.length,
      archiveOrLab: archiveOrLab.size,
      productionSupport: productionSupport.size,
      junk: junk.size,
    },
    candidateUnused,
    archiveOrLab: [...archiveOrLab].sort(),
    productionSupport: [...productionSupport].sort(),
    junk: [...junk].sort(),
    usedProduction,
  };

  console.log(JSON.stringify(result, null, 2));
}

function gitTrackedFiles() {
  return execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function classifyPreservedFiles() {
  for (const file of trackedFiles) {
    if (path.basename(file) === ".DS_Store") junk.add(file);
    if (ARCHIVE_OR_LAB_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      archiveOrLab.add(file);
    }
    if (ARCHIVE_OR_LAB_FILES.has(file)) archiveOrLab.add(file);
    if (
      PRODUCTION_SUPPORT_PREFIXES.some((prefix) => file.startsWith(prefix)) ||
      PRODUCTION_SUPPORT_FILES.has(file)
    ) {
      productionSupport.add(file);
      markUsed(file, "production support");
    }
  }
}

function seedCoreEntrypoints() {
  for (const file of CORE_ENTRYPOINTS) {
    markUsed(file, "core entrypoint");
  }
}

function traceStaticReferences() {
  let changed = true;
  while (changed) {
    changed = false;
    for (const file of [...used.keys()]) {
      if (!isReferenceBearingFile(file)) continue;
      const content = readText(file);
      for (const reference of extractLiteralReferences(content)) {
        const resolved = resolveReference(file, reference);
        if (resolved && markUsed(resolved, `referenced by ${file}`)) {
          changed = true;
        }
      }
      for (const imported of extractModuleImports(content)) {
        const resolved = resolveReference(file, imported);
        if (resolved && markUsed(resolved, `imported by ${file}`)) {
          changed = true;
        }
      }
      for (const serviceWorkerAsset of extractServiceWorkerAssets(file, content)) {
        if (markUsed(serviceWorkerAsset, "service worker preload")) {
          changed = true;
        }
      }
    }
  }
}

function traceRuntimeDataReferences() {
  const shows = readJson("data/shows.json");
  if (shows) {
    for (const category of shows.categories ?? []) {
      for (const item of category.items ?? []) {
        const cover = `assets/media/shows/covers/${String(item.id).replaceAll(
          "_",
          "-",
        )}.jpg`;
        markUsed(cover, "show cover from data/shows.json");
      }
    }
  }

  const readerIndex = readJson("data/reader/readerIndex.json");
  const bookIds = [];
  for (const section of readerIndex ?? []) {
    for (const item of section.items ?? []) {
      bookIds.push(item.id);
    }
  }

  for (const bookId of bookIds) {
    const bookFile = `data/reader/books/${bookId}.json`;
    markUsed(bookFile, "book listed in readerIndex.json");
    markUsed(`assets/media/books/${bookId}/${bookId}-book-cover.jpg`, "book cover");
    markUsed(`assets/media/books/${bookId}/${bookId}-book-opener.jpg`, "reader opening image");

    const book = readJson(bookFile);
    (book?.chapters ?? []).forEach((chapter, index) => {
      const image = chapter.image
        ? normalizePath(chapter.image)
        : `assets/media/books/${bookId}/${bookId}-chapter-${index + 1}.jpg`;
      markUsed(image, `chapter image for ${bookId}`);
    });
  }
}

function isReferenceBearingFile(file) {
  return STATIC_REFERENCE_EXTENSIONS.has(path.extname(file));
}

function readText(file) {
  try {
    return fs.readFileSync(path.join(root, file), "utf8");
  } catch {
    return "";
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch {
    return null;
  }
}

function extractLiteralReferences(content) {
  const references = new Set();
  const patterns = [
    /\b(?:src|href)\s*=\s*["']([^"']+)["']/g,
    /url\(\s*["']?([^"')]+)["']?\s*\)/g,
    /fetch\(\s*["']([^"']+)["']/g,
    /["']((?:\.{0,2}\/)?(?:assets|css|data|js|books|shows|today|netlify)\/[^"']+)["']/g,
    /["']((?:\.{0,2}\/)?manifest\.webmanifest)["']/g,
    /["']((?:\.{0,2}\/)?sw\.js)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      references.add(match[1]);
    }
  }
  return references;
}

function extractModuleImports(content) {
  const imports = new Set();
  const patterns = [
    /import\s+[^"']*?from\s+["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /export\s+[^"']*?from\s+["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      imports.add(match[1]);
    }
  }
  return imports;
}

function extractServiceWorkerAssets(file, content) {
  if (file !== "sw.js") return [];

  const assets = [];
  const arrayMatch = content.match(/const\s+CORE_ASSETS\s*=\s*\[([\s\S]*?)\];/);
  if (!arrayMatch) return assets;

  for (const match of arrayMatch[1].matchAll(/["']([^"']+)["']/g)) {
    assets.push(normalizePath(match[1]));
  }
  return assets;
}

function resolveReference(fromFile, reference) {
  if (!reference || isExternalReference(reference)) return null;

  const cleanReference = stripReferenceNoise(reference);
  const candidates = [];
  if (cleanReference.startsWith("/")) {
    candidates.push(normalizePath(cleanReference));
  } else {
    candidates.push(normalizePath(path.join(path.dirname(fromFile), cleanReference)));
    candidates.push(normalizePath(cleanReference));
  }

  for (const candidate of candidates) {
    if (trackedSet.has(candidate)) return candidate;
  }
  return null;
}

function stripReferenceNoise(reference) {
  return reference
    .replace(/^\.\/+/, "")
    .replace(/^\//, "")
    .split(/[?#]/)[0];
}

function normalizePath(file) {
  return file
    .replace(/^\.\/+/, "")
    .replace(/^\//, "")
    .replaceAll("\\", "/");
}

function isExternalReference(reference) {
  return /^(?:[a-z]+:|#|data:|mailto:|tel:)/i.test(reference);
}

function markUsed(file, reason) {
  const normalized = normalizePath(file);
  if (!trackedSet.has(normalized)) return false;
  if (used.has(normalized)) return false;
  used.set(normalized, reason);
  return true;
}
