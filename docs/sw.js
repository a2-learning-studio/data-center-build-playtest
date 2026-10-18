// Saves the game for offline reloads, and replaces that copy when a new build is published.
// Cache name bump: an older worker deletes every cache that is not this name.
const CACHE = "build-the-campus-v3";

function precache() {
  return caches.open(CACHE).then(async (cache) => {
    for (const url of ["./", "./index.html"]) {
      const res = await fetch(new Request(url, { cache: "reload" }));
      if (res.ok) await cache.put(url, res);
    }
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// Notes and the voice handoff are not part of the game and are never stored.
function leaveToNetwork(req) {
  const path = new URL(req.url).pathname;
  return path.endsWith(".md") || path.includes("VOICE_HANDOFF");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  if (leaveToNetwork(req)) return;
  event.respondWith(
    fetch(req, { cache: "no-cache" })
      .then((res) => {
        if (res.ok && (res.type === "basic" || res.type === "default")) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html") || caches.match("./"))),
  );
});
