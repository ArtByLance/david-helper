const CACHE_VERSION = "davids-shelves-20260602-2";
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/css/layout.css",
  "/css/text.css",
  "/css/reader.css",
  "/js/main.js",
  "/js/playback.js",
  "/js/reader.js",
  "/js/app-data.js",
  "/js/layout.js",
  "/js/time.js",
  "/js/utils.js",
  "/js/layout/timeline.js",
  "/assets/home.jpg",
  "/assets/shelves/shelf0.jpg",
  "/assets/shelves/shelf1.jpg",
  "/assets/shelves/shelf2.jpg",
  "/assets/shelves/shelf3.jpg",
  "/assets/scenes/main-1.jpg",
  "/assets/scenes/main-2.jpg",
  "/assets/scenes/main-3.jpg",
  "/assets/scenes/main-4.jpg",
  "/assets/objects/book-front.png",
  "/assets/objects/book-spine.png",
  "/assets/objects/card-menu.png",
  "/assets/objects/card-special.png",
  "/assets/objects/card-urgent.png",
  "/assets/objects/clock.png",
  "/assets/objects/dvd-front.png",
  "/assets/objects/dvd-spine.png",
  "/assets/objects/next-flag-2.png",
  "/assets/objects/plate-section.png",
  "/assets/objects/post-it.png",
  "/assets/fonts/BebasNeue-Regular.ttf",
  "/assets/fonts/DSEG7ClassicMini-Bold.ttf",
  "/assets/fonts/Oswald-VariableFont_wght.ttf",
  "/data/config.json",
  "/data/daily.json",
  "/data/monthly.json",
  "/data/weekly.json",
  "/data/shows.json",
  "/data/reader/readerIndex.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await cache.addAll(CORE_ASSETS);
      await warmMediaCache(cache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/.netlify/functions/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/index.html"));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isFreshAsset(url.pathname)) {
    event.respondWith(networkFirst(request));
  }
});

async function warmMediaCache(cache) {
  await Promise.allSettled([
    warmShowCovers(cache),
    warmReaderBooks(cache),
  ]);
}

async function warmShowCovers(cache) {
  const library = await fetchJson("/data/shows.json");
  const coverUrls = (library.categories ?? []).flatMap((category) =>
    (category.items ?? []).map(
      (item) => `/assets/media/shows/covers/${String(item.id).replaceAll("_", "-")}.jpg`,
    ),
  );
  await addExisting(cache, coverUrls);
}

async function warmReaderBooks(cache) {
  const sections = await fetchJson("/data/reader/readerIndex.json");
  const ids = sections.flatMap((section) => (section.items ?? []).map((item) => item.id));
  const urls = ids.flatMap((id) => [
    `/data/reader/books/${id}.json`,
    `/assets/media/books/covers/${id}.jpg`,
  ]);
  await addExisting(cache, urls);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

async function addExisting(cache, urls) {
  await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, { cache: "reload" });
      if (response.ok) await cache.put(url, response);
    }),
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request, { ignoreSearch: true })) ??
      (fallbackUrl ? await caches.match(fallbackUrl) : undefined) ??
      Response.error()
    );
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/assets/") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".ttf") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg")
  );
}

function isFreshAsset(pathname) {
  return (
    pathname === "/index.html" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/data/")
  );
}
