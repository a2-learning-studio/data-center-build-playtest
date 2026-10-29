// Saves the game for offline reloads, and replaces that copy when a new build is published.
// CACHE must match SW_BUILD in game.js. Bump both together when publishing a new build.
const CACHE = "build-the-campus-v7";
// The origin is shared with other projects (a2-learning-studio.github.io); touch only this game's caches.
const PREFIX = "build-the-campus-";
// The SHA-256 of every file this worker keeps, written in by build.mjs: the game page, the educator sheet and each
// narration clip the page uses. Any page on the shared origin can also write to this game's caches, so a saved copy
// is served only when it matches; this file itself is out of their reach (SA-2). Files not listed are never stored.
const DIGESTS = {"voice/en/intro.mp3?v=6d64085277d3":"6d64085277d3f52396a75e0635317aaa2dfe158b883271a2b170734b2be57fe9","voice/en/phase-site.mp3?v=86e785420918":"86e785420918f2530b16c0fb5fd5c697553d98f707698cc3de35bcdb0ce3bfdb","voice/en/phase-grade.mp3?v=829379ff5e16":"829379ff5e16fc0f466a31f856a412bbacc41731e3893b3cfee93774220b25a6","voice/en/phase-util.mp3?v=15d6cacf17a8":"15d6cacf17a80140aa23e7cdc8e9e01275087bfab88acdd6e42f2a0c06993721","voice/en/phase-found.mp3?v=e565359de986":"e565359de986c8b1ca51b557fecd7a77a48b7f5f4537f9ba7f7088d9a4ebefcb","voice/en/phase-shell.mp3?v=77947575a9c6":"77947575a9c666d00f26a62c9df66dd78bfa6e72c7b971d5096f9a1b77fda4e0","voice/en/phase-mep.mp3?v=59ab9719565c":"59ab9719565cf6c9f8938dc9b6da4a97a4e3a833b82cc3271cafc86f705f93f7","voice/en/phase-fitout.mp3?v=60070ac7f652":"60070ac7f652f4aeab68a1a9ca6b34b34f196d3214900ea012ff110ed8a1aee2","voice/en/phase-cx.mp3?v=c826e0153ec2":"c826e0153ec21d6385427a6a1ed84caeac821698ace471a83be654e975098751","voice/en/phase-turn.mp3?v=4ac9cb60eab5":"4ac9cb60eab5f1c56d3e38e2cd999192286295c0ec3912000d0c0e830b5f5104","voice/en/el-zoning.mp3?v=cc3ae1e1a623":"cc3ae1e1a62394628e81cd9af3dbc4df6b203538b30e352d5fe7fb6d64cdda2d","voice/en/el-capacity.mp3?v=af74d347f297":"af74d347f297b10a662ad5263470f3aa525c96aa09a34b8f09e35d54a15703ed","voice/en/el-stormPlan.mp3?v=722b3f5c32ce":"722b3f5c32ce2b784f127efc72ff60c3928e0be39805b3a0b040910a0a07a52e","voice/en/el-meetings.mp3?v=98718caa1700":"98718caa17009b7b40a8a13a6ae1c635dfe6840283123474dcd483303553a9c7","voice/en/el-clear.mp3?v=04c2a45b7c76":"04c2a45b7c76b4be4f2ecae961ca01d8be9666c0e10b3971f94234d5d1803391","voice/en/el-erosion.mp3?v=605834dd78b6":"605834dd78b6b8dcad1cfaa5d2895eab06bc8564bf5cc3eb9a4ff1465b8bb065","voice/en/el-ponds.mp3?v=b88cc666a78f":"b88cc666a78f4bac2e385588da00a16c402b8939fe6814ea8ae856ae84570037","voice/en/el-roads.mp3?v=dd92dccfb3d4":"dd92dccfb3d4530d2b2fdbc37685a150424d93c4c75bf151a6e14ca54434861c","voice/en/el-substation.mp3?v=bee0db3a60cb":"bee0db3a60cbd3d72d5bbd41afe6c5121157a49d82e327ec63fbb42a9fda0e62","voice/en/el-transmission.mp3?v=bb276a48250b":"bb276a48250b1e23a9d046b436195f6fd78dac1f72d90ff1da335f0f4b89d1f6","voice/en/el-water.mp3?v=ff6fb1c89eba":"ff6fb1c89ebaa3c0ccf0f057251906b5a22b49798863525ecc6e295a75a0f151","voice/en/el-fiber.mp3?v=59e3c6c0aa55":"59e3c6c0aa55c8b8fd8a6bf7dc66f4614e8d519de2e85407c94cdf38e3b03e4e","voice/en/el-slab.mp3?v=c193da577077":"c193da577077c79b537f1a8bd91922f81d9580d78fe412a157d66d34a416fca1","voice/en/el-pads.mp3?v=255f4a1d9fe2":"255f4a1d9fe2d82d7114c0fc735908472822ca92b0270886541cb1afa8d90447","voice/en/el-panels.mp3?v=46efa59ae9a7":"46efa59ae9a7da7f3516c2aefa65dd993c3be01a0002f9fb33dfe032a3aa9fad","voice/en/el-steel.mp3?v=0caf74b93423":"0caf74b934232935f1d395cc54e21e59f5e33451f326ec18efdd27951aefa995","voice/en/el-roof.mp3?v=2c871fdb915a":"2c871fdb915a926c9f7d11c73501f91d31163707ba7d89f731a19a8ba98d0f31","voice/en/el-switchgear.mp3?v=2c2de9fc001a":"2c2de9fc001a0a37ae0a582efd2e99a7e866f31284ccd511f872c7928b316287","voice/en/el-ups.mp3?v=f7e9766fe0d7":"f7e9766fe0d74fbe9876a93731ae303c066f051d7661a474feec3eec51347f7f","voice/en/el-gens.mp3?v=cc115cfcf9db":"cc115cfcf9dbf8ccaf420cdc753a95cea219770dde2f852fcb97bb15668f9c0e","voice/en/el-cooling.mp3?v=feba347ff5c0":"feba347ff5c0afae075792ed223f3d3eda6f82cfa5941940d0e7ce27197f2123","voice/en/el-fire.mp3?v=8f66537b17f5":"8f66537b17f5e7696d9c35fbf92ef951cf53d1bdd2417bc0dab68eb020e860fc","voice/en/el-racks.mp3?v=50e74ecb7e7d":"50e74ecb7e7dbca9c8c90e6dac1ee107d0115c638a356b0a560e56bb669e6506","voice/en/el-containment.mp3?v=da2c770f9d12":"da2c770f9d125e35f39ce7be735f01c8ce80b89a8ab10663bffd8582fe4596ce","voice/en/el-trays.mp3?v=6ef94a05fbff":"6ef94a05fbff9997684846a4dd6909c966f930daa110a2edd7612338296fdf3e","voice/en/el-L1.mp3?v=cb5b16054e77":"cb5b16054e77e37ace9f5e1acee7e1ecdfaadc17871e6688ca0f3adf2d63d433","voice/en/el-L2.mp3?v=2f14610e0f9b":"2f14610e0f9b44eba478b6a3668c952afc98b3172e9aa23b32b9a8014e97a032","voice/en/el-L3.mp3?v=81a61e3288a5":"81a61e3288a5fb07922e2b7f628dec816d67e0810599373bfa79c0ece8a09abc","voice/en/el-L4.mp3?v=40ac00397db8":"40ac00397db8637c0495ee786a4cc2edddb21e18e0f2c7505fac608986994b82","voice/en/el-L5.mp3?v=fdbd0d590276":"fdbd0d5902768db62d53d2d183be3d4650cdd2ac7c8110c49a8eaa265cbf4aac","voice/en/el-punch.mp3?v=f9127dfb5bef":"f9127dfb5bef04542be7a5dd0f67851bd3692f5fb325b370e9bd89d84cbbb40e","voice/en/el-handover.mp3?v=747d30c47f5a":"747d30c47f5ac9c888fb57287810665a56d835d8257ed25f6dfe89535103a433","voice/en/card-weather.mp3?v=4dc66692852a":"4dc66692852a401203b97fe6ddda317c64907cfa9a1c0f8b56ffbd83c18c2f55","voice/en/opt-weather-a.mp3?v=debd487d565f":"debd487d565f564db02ef029edd801e7f69f1d0ba9edf34e46b501e0f4657e7c","voice/en/opt-weather-b.mp3?v=b0ac3a0aa162":"b0ac3a0aa162ed32630c7cf8a7fe5bbf7a128b2a5a363316683cd83c37e4dabf","voice/en/card-longlead.mp3?v=beeefe589172":"beeefe5891722e887961efe22d71c1636623ce002913deb013c21b8dd0283ba7","voice/en/opt-longlead-a.mp3?v=95dbb604620f":"95dbb604620fe9a12cb5fb741fad43bfb2fe8214982e10495007b9ba2e608320","voice/en/opt-longlead-b.mp3?v=ed872df03558":"ed872df03558a80dc15fa14449e1eb7418a845f5bca92efd2740559d5bf67928","voice/en/opt-longlead-c.mp3?v=481bb13ea1c5":"481bb13ea1c58974f6a51948251e9dbb7e3823b3c210dec171e2cdbca8a8fbd1","voice/en/card-labor.mp3?v=4801656f09c7":"4801656f09c751517d8739056dbb147f3199caf6f518f2e13b55e2c7a61d038d","voice/en/opt-labor-a.mp3?v=735b0270ad32":"735b0270ad3264feecb5bfb81f89384f906b1b93c9da4782e45474c5c4c2bdc4","voice/en/opt-labor-b.mp3?v=81c4995730e4":"81c4995730e449099892c9140b148776006fd13b50d0e2ccee56173d89d50412","voice/en/opt-labor-c.mp3?v=fd98efaa3402":"fd98efaa3402775e3a83b818d17d5ccfe4130c2dda4f7e31db5276cf5308a157","voice/en/cx.mp3?v=b299c0803478":"b299c080347812afc445662662cccfe888f7420bc668992bdd0ccb67402e37d0","voice/en/end.mp3?v=7095692c2b98":"7095692c2b98be4eaeb0aafb090adfaec59268b4c77503e67946bda1d902577f","voice/en/card-heat.mp3?v=2ac472c33e92":"2ac472c33e920944c8d273d29463e601438d81ace3c52635861a0a7ae44c700c","voice/en/opt-heat-a.mp3?v=edfc18d8aedd":"edfc18d8aedd0cc887ea057696bc9cea17ea45ef0351602cf26b9bbd92db7b79","voice/en/opt-heat-b.mp3?v=c172afd922dd":"c172afd922dde817f821cced6462dcfdfaf22fc40113670c49f3ef4c4814f172","voice/en/card-haul.mp3?v=65b17cb1f8ba":"65b17cb1f8bad2e148ff3a0f773e671f28c6fea73b4ae853b96c2409eefab988","voice/en/opt-haul-a.mp3?v=900679ecf597":"900679ecf59754411d7093e6e65468eb142eb434345c0ffdc324e690731d91a0","voice/en/opt-haul-b.mp3?v=96b1845693a4":"96b1845693a4febaccc9363956db64127b3d94e21389f4c3f4a1f32461bf66b5","voice/en/card-inspect.mp3?v=3656d8e56282":"3656d8e56282ab5dd1d6e741779cb9ae4b21528d7bf1b74d87068f14ee44d5ac","voice/en/opt-inspect-a.mp3?v=ce65182c7333":"ce65182c733346fabe0aae83d104c9cf4451386cc66693ce89f3317988b06210","voice/en/opt-inspect-b.mp3?v=ebbcb9f74a1d":"ebbcb9f74a1d69e9a4496f774a664102e5e47738258b16f682c9b65e11807316","voice/en/card-nearmiss.mp3?v=608adec5b7a6":"608adec5b7a66328f00e02d63a573e6cf77ad57dbca047a76c8924b48d845491","voice/en/opt-nearmiss-a.mp3?v=32e9d93fb799":"32e9d93fb799a6f6453b20ed1d2256d1e3600478a1baddb32e0878a850508616","voice/en/opt-nearmiss-b.mp3?v=e6af23ff0be2":"e6af23ff0be272138df79ef1a049df2eb05ea2405e438d5b36df8f056d863777","voice/en/card-supply.mp3?v=9e5eb08d2f1f":"9e5eb08d2f1f84b43e6b2ff2353a3d33c57431e86640c4ea68c3bc28e9cda2d8","voice/en/opt-supply-a.mp3?v=cefc4f0637da":"cefc4f0637da505913aff8532d9b60fba43926585050ba2b4016843b8e2520ab","voice/en/opt-supply-b.mp3?v=08747d9616c5":"08747d9616c58a2699e1792cd879efb684da41b172a525e999fb5a199999299c","voice/en/card-retest.mp3?v=be65e8ceb5a2":"be65e8ceb5a2f18f02bfbca86bea1f479a2f3e926219abce618f07f19e9178a8","voice/en/opt-retest-a.mp3?v=8e7fd09e2581":"8e7fd09e2581c162c2105ec2648d9b35c869cfc6c274d8737c8882a868175a73","voice/en/opt-retest-b.mp3?v=c2c9be1cd4a1":"c2c9be1cd4a17df6a01cb0146872ef1119ec7c202898b1f13c3875da8c34f73d","index.html":"54c2fa80345a058acf442806c1f07acbcddd0f3909bd63e4c6e3b231de558f90","educator.html":"7a9108efb762d0733e726ee912791b5617ea46b47dc5cfdc45fb172d25c1cc99"};
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
