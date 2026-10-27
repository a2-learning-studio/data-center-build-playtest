// Saves the game for offline reloads, and replaces that copy when a new build is published.
// CACHE must match SW_BUILD in game.js. Bump both together when publishing a new build.
const CACHE = "build-the-campus-v7";
// The origin is shared with other projects (a2-learning-studio.github.io); touch only this game's caches.
const PREFIX = "build-the-campus-";
// The SHA-256 of every file this worker keeps, written in by build.mjs: the game page, the educator sheet and each
// narration clip the page uses. Any page on the shared origin can also write to this game's caches, so a saved copy
// is served only when it matches; this file itself is out of their reach (SA-2). Files not listed are never stored.
const DIGESTS = __DIGESTS__;
const SCOPE = new URL("./", self.registration.scope).pathname;
// How long a page already saved waits for the network before its saved copy opens instead.
const NAV_WAIT = 4000;

// Where a request is stored, and the name its digest is listed under. The game page, whatever query string it was
// opened with (?mode=class, ?src=qr), is stored once, under "index.html", and also answers "./" (it used to be stored
// twice, BTC-80), so an old copy can never hide under a query-string key and come back offline. A clip keeps its
// ?v= content hash. Anything else not listed returns null and goes to the network as if there were no worker.
function keyOf(url) {
  const u = new URL(url);
  if (u.origin !== self.location.origin || !u.pathname.startsWith(SCOPE)) return null;
  const path = u.pathname.slice(SCOPE.length);
  const key = path === "" ? "index.html" : isClip(url) ? path + u.search : path;
  return Object.prototype.hasOwnProperty.call(DIGESTS, key) ? key : null;
}
// Narration clips carry a content hash (?v=), so a stored clip never goes stale: serve it from the cache first.
function isClip(url) {
  const u = new URL(url);
  return u.pathname.includes("/voice/") && u.pathname.endsWith(".mp3") && u.searchParams.has("v");
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
// Pages are compared with LF line endings, as build.mjs hashed them, so a checkout that changed them still matches.
async function matches(res, key) {
  if (!res || !key) return false;
  const body = key.endsWith(".html") ? new TextEncoder().encode((await res.clone().text()).replace(/\r\n?/g, "\n")) : await res.clone().arrayBuffer();
  return hex(await crypto.subtle.digest("SHA-256", body)) === DIGESTS[key];
}
const cacheKey = (key) => new URL(key, self.registration.scope).href;

// Install stores the page the visitor already has (I15). The copy comes from the browser's own HTTP cache when it is
// there ("force-cache"), so a first visit does not download the page again. Only if that copy is missing, or is not
// this build's page, does the page come from the network, once.
async function precache() {
  const cache = await caches.open(CACHE);
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const open = wins.map((c) => c.url).find((u) => keyOf(u) === "index.html");
  const url = open ? open.split("#")[0] : new URL("./", self.registration.scope).href;
  let res = await fetch(new Request(url, { cache: "force-cache" }));
  if (res.ok && !(await matches(res, "index.html"))) res = await fetch(new Request(url, { cache: "no-cache" }));
  if (res.ok && (await matches(res, "index.html"))) await cache.put(cacheKey("index.html"), res);
}

// Clips this build still uses are copied over from an older build's cache, which activation then drops: their
// addresses carry their content hash, so they are still good, and a kiosk that goes offline after an update keeps its
// narration (FE-4, PA-7). The copy happens at install, while the older build still serves the pages, because the
// browser holds every request until a new worker has activated.
async function carryOver() {
  const cache = await caches.open(CACHE);
  const have = new Set((await cache.keys()).map((r) => r.url));
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX) || name === CACHE) continue;
    const old = await caches.open(name);
    await Promise.all((await old.keys()).filter((r) => isClip(r.url) && keyOf(r.url) && !have.has(r.url)).map(async (r) => {
      have.add(r.url);
      const res = await old.match(r);
      if (res) await cache.put(r, res);
    }));
  }
}

self.addEventListener("install", (event) => {
  // A failed copy never blocks the update; the next visit to the page stores it.
  event.waitUntil(Promise.all([precache().catch(() => {}), carryOver().catch(() => {})]).then(() => self.skipWaiting()));
});

// Activation drops the older builds' caches and anything this build does not list, such as a clip that changed, or
// the page's old second copy under "./".
async function prune() {
  const cache = await caches.open(CACHE);
  const keep = (url) => { const key = keyOf(url); return !!key && url === cacheKey(key); };
  await Promise.all((await cache.keys()).filter((r) => !keep(r.url)).map((r) => cache.delete(r)));
  await Promise.all((await caches.keys()).filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(prune().catch(() => {}).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Notes, the offline kiosk download and anything else not listed are never stored.
  const key = keyOf(req.url);
  if (!key) return;
  // Range requests (media streaming) go straight to the network; the game fetches clips whole.
  if (req.headers.has("range")) return;
  // Only a copy that matches its digest is kept.
  const store = (res) => {
    if (res.ok && res.status === 200 && (res.type === "basic" || res.type === "default")) {
      const copy = res.clone();
      (async () => {
        if (await matches(copy, key)) await (await caches.open(CACHE)).put(cacheKey(key), copy);
      })().catch(() => {});
    }
    return res;
  };
  const saved = () => caches.open(CACHE).then((cache) => cache.match(cacheKey(key))).then(async (hit) => ((await matches(hit, key)) ? hit : null));
  if (isClip(req.url)) {
    event.respondWith(saved().then((hit) => hit || fetch(req).then(store)));
    return;
  }
  // Offline, and when the host answers with an error (404, 5xx), each file falls back to its own saved copy, never to
  // another file, and never to a copy that does not match (the network's answer or the browser's error shows instead).
  // A page already saved also opens from that copy when the network has not answered in NAV_WAIT ms: a stalled
  // connection used to leave a kiosk on a blank page (review). With no saved copy, as on a first visit, the page
  // waits for the network as long as the browser does.
  const net = fetch(req, { cache: "no-cache" }).then(store);
  const fallback = (res) => saved().then((hit) => hit || res || Response.error());
  const answer = net.then((res) => (res.ok ? res : fallback(res)), () => fallback());
  if (req.mode !== "navigate") { event.respondWith(answer); return; }
  event.respondWith(saved().then((hit) => (hit ? Promise.race([answer, new Promise((r) => setTimeout(() => r(hit), NAV_WAIT))]) : answer)));
});
