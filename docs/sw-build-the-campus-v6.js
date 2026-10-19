// Saves the game for offline reloads, and replaces that copy when a new build is published.
// CACHE must match SW_BUILD in game.js. Bump both together when publishing a new build.
const CACHE = "build-the-campus-v6";
// The origin is shared with other projects (a2-learning-studio.github.io); touch only this game's caches.
const PREFIX = "build-the-campus-";

// The game page, whatever query string it was opened with (?mode=class, ?src=qr). It is stored once, under "./" and
// "./index.html", so an old copy can never hide under a query-string key and come back offline.
function isGamePage(url) {
  const root = new URL("./", self.registration.scope).pathname;
  const path = new URL(url).pathname;
  return path === root || path === `${root}index.html`;
}

// Install stores the page the visitor already has (I15). The copy comes from the browser's own HTTP cache when it is
// there ("force-cache"), so a first visit does not download the page again. Only if that copy is missing does the
// page come from the network, once.
async function precache() {
  const cache = await caches.open(CACHE);
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = wins.map((c) => c.url).find((u) => new URL(u).origin === self.location.origin && isGamePage(u));
  const url = open ? open.split("#")[0] : new URL("./", self.registration.scope).href;
  const res = await fetch(new Request(url, { cache: "force-cache" }));
  if (!res.ok) return;
  await cache.put("./", res.clone());
  await cache.put("./index.html", res);
}

self.addEventListener("install", (event) => {
  // A failed copy never blocks the update; the next visit to the page stores it.
  event.waitUntil(precache().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Notes, the voice handoff and the offline kiosk download are never stored.
function leaveToNetwork(url) {
  const path = new URL(url).pathname;
  return path.endsWith(".md") || path.includes("VOICE_HANDOFF") || path.endsWith("-offline.html");
}
// Narration clips carry a content hash (?v=), so a stored clip never goes stale: serve it from the cache first.
function isClip(url) {
  const u = new URL(url);
  return u.pathname.includes("/voice/") && u.pathname.endsWith(".mp3") && u.searchParams.has("v");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  if (leaveToNetwork(req.url)) return;
  // Range requests (media streaming) go straight to the network; the game fetches clips whole.
  if (req.headers.has("range")) return;
  const page = isGamePage(req.url);
  const store = (res) => {
    if (res.ok && res.status === 200 && (res.type === "basic" || res.type === "default")) {
      const copy = res.clone();
      caches.open(CACHE).then(async (cache) => {
        if (page) {
          await cache.put("./", copy.clone());
          await cache.put("./index.html", copy);
        } else await cache.put(req, copy);
      }).catch(() => {});
    }
    return res;
  };
  if (isClip(req.url)) {
    event.respondWith(caches.open(CACHE).then((cache) => cache.match(req)).then((hit) => hit || fetch(req).then(store)));
    return;
  }
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then(store)
      // Offline: the game page falls back to its saved copy; anything else only to its own saved copy, never to the page.
      .catch(() => caches.open(CACHE).then(async (cache) => {
        const hit = page ? (await cache.match("./index.html")) || (await cache.match("./")) : await cache.match(req);
        return hit || Response.error();
      })),
  );
});
