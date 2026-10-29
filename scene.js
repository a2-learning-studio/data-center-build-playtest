// scene.js — the Red Clay Ridge campus in 3D (three.js, inlined as THREE). Units are metres.
// World plan x runs toward the county road, plan y toward Pecan Street; in three.js that is x, z, with y up.
// Every part sits in a tagged group { show, hide, opt, keep } that the game shows or hides.
// Reduced detail for weak graphics (I17). ?quality=low or ?quality=high in the address overrides the guess.
function detectLowQ() {
  const q = new URLSearchParams(location.search).get("quality");
  if (q === "low") return true;
  if (q === "high") return false;
  let gpu = "";
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") || probe.getContext("webgl");
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch { /* keep the default quality if the probe fails */ }
  return lowGpu(gpu, navigator.hardwareConcurrency || 4, navigator.deviceMemory || 8);
}
// gpu is the renderer string, cores the thread count, mem the memory in GB (Chrome reports 0.25 to 8).
function lowGpu(gpu, cores, mem) {
  const g = String(gpu).toLowerCase();
  const small = cores <= 4 && mem <= 4;
  // Software rendering, or a very small machine.
  if (/swiftshader|llvmpipe|softpipe|software|microsoft basic render/.test(g) || cores <= 2 || mem <= 2) return true;
  // Intel: Iris Xe, Iris Plus and Arc keep full detail unless the machine is small; older HD and UHD graphics get less.
  if (/intel/.test(g)) return /iris\s*\(?r?\)?\s*(xe|plus)|iris xe|\barc\b|xe graphics/.test(g) ? small : true;
  // Entry-level phone, tablet and Chromebook graphics (ARM Mali T and G31-G57, Adreno 100-500, PowerVR and others).
  if (/mali-(t|4|g[1-5]\d\b)|adreno\s*(\(tm\)\s*)?[1-5]\d\d\b|powervr|videocore|vivante/.test(g)) return true;
  // Everything else, AMD, NVIDIA and Apple graphics included: less detail only on a small machine.
  return small;
}

function createScene(canvas, { reduced = () => false, signs = null, onMode = null } = {}) {
  const T3 = THREE;
  const lowQ = detectLowQ();
  const signMats = {};
  const signLines = () => (signs ? signs() : ["", "", ""]);
  let seed = 1234567;
  const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const TILE = { x0: -260, x1: 260, z0: -180, z1: 180 };

  // ---------- renderer, camera, light ----------
  const renderer = new T3.WebGLRenderer({ canvas, antialias: !lowQ, powerPreference: "high-performance" });
  renderer.setPixelRatio(lowQ ? 1 : Math.min(1.5, window.devicePixelRatio || 1));
  renderer.toneMapping = T3.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = lowQ ? T3.BasicShadowMap : T3.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.localClippingEnabled = true;
  const scene = new T3.Scene();
  const camera = new T3.PerspectiveCamera(30, 1, 5, 4000);

  // Sky: a gradient dome, also baked into an environment map for reflections on glass, water and metal.
  const skyGeo = new T3.SphereGeometry(1800, 32, 16);
  const skyMat = new T3.ShaderMaterial({
    side: T3.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new T3.Color("#8fbbe6") }, mid: { value: new T3.Color("#e7eef2") }, low: { value: new T3.Color("#f4ecdf") } },
    vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, low, smoothstep(0.0, 0.25, -h)); gl_FragColor = vec4(c, 1.0); }",
  });
  const sky = new T3.Mesh(skyGeo, skyMat);
  scene.add(sky);
  const pmrem = new T3.PMREMGenerator(renderer);
  const envScene = new T3.Scene();
  envScene.add(new T3.Mesh(skyGeo, skyMat));
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.fog = new T3.Fog("#e9eef0", 1400, 2600);

  const hemi = new T3.HemisphereLight("#e4f0ff", "#a0906c", 1.35);
  scene.add(hemi);
  const sun = new T3.DirectionalLight("#fff3e0", 2.6);
  sun.position.set(-170, 300, 190);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowQ ? 1024 : 2048, lowQ ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -330, right: 330, top: 260, bottom: -260, near: 10, far: 1200 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- procedural textures ----------
  const canvasTex = (w, h, draw, { repeat = [1, 1], color = true } = {}) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    draw(g, w, h);
    const t = new T3.CanvasTexture(c);
    if (color) t.colorSpace = T3.SRGBColorSpace;
    t.wrapS = t.wrapT = T3.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 8;
    return t;
  };
  const speckle = (g, w, h, base, specks, blotch = []) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (const [col, n, r] of blotch) {
      for (let i = 0; i < n; i++) {
        const x = R() * w, y = R() * h, rr = r * (0.5 + R());
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, col);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = gr;
        g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
    }
    for (const [col, n, s0, s1] of specks) {
      g.fillStyle = col;
      for (let i = 0; i < n; i++) {
        const s = s0 + R() * (s1 - s0);
        g.globalAlpha = 0.25 + R() * 0.55;
        g.fillRect(R() * w, R() * h, s, s);
      }
    }
    g.globalAlpha = 1;
  };
  const TX = {
    grass: canvasTex(512, 512, (g, w, h) => speckle(g, w, h, "#7c9a58", [["#6a8a4a", 3200, 1, 3], ["#8eaa66", 3000, 1, 3], ["#a7b97a", 900, 1, 2], ["#5d7a42", 1200, 1, 2]], [["rgba(160,170,105,.25)", 10, 70], ["rgba(80,110,60,.22)", 10, 70]])),
    dirt: canvasTex(512, 512, (g, w, h) => {
      speckle(g, w, h, "#b98c5f", [["#9c7048", 2400, 1, 3], ["#cfa577", 2000, 1, 3], ["#7f5a3a", 500, 1, 2]], [["rgba(150,105,65,.18)", 10, 120], ["rgba(215,175,125,.2)", 10, 120]]);
      g.strokeStyle = "rgba(110,75,45,.35)";
      g.lineWidth = 5;
      for (let i = 0; i < 6; i++) { g.beginPath(); const y = R() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 60 * (R() - 0.5), w * 0.7, y + 60 * (R() - 0.5), w, y); g.stroke(); }
    }),
    asphalt: canvasTex(256, 256, (g, w, h) => speckle(g, w, h, "#55595e", [["#474b4f", 1800, 1, 2], ["#6a6e72", 1600, 1, 2], ["#7c7f82", 300, 1, 2]])),
    gravel: canvasTex(256, 256, (g, w, h) => speckle(g, w, h, "#b4ada2", [["#9a9387", 2200, 1, 3], ["#cdc7bd", 2000, 1, 3], ["#857e74", 500, 1, 2]])),
    slab: canvasTex(256, 256, (g, w, h) => speckle(g, w, h, "#c7c3ba", [["#b9b5ac", 900, 1, 3], ["#d3cfc7", 900, 1, 3]], [["rgba(160,155,145,.25)", 8, 60]])),
    soil: canvasTex(512, 64, (g, w, h) => {
      const bands = ["#6b4a33", "#7d573b", "#5d3f2b", "#8a6343", "#6f4c34"];
      bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, (i * h) / bands.length, w, h / bands.length + 1); });
      g.fillStyle = "#4f7a3a";
      g.fillRect(0, 0, w, 6);
      for (let i = 0; i < 700; i++) { g.fillStyle = R() < 0.5 ? "rgba(40,25,15,.35)" : "rgba(200,170,130,.25)"; g.fillRect(R() * w, 6 + R() * (h - 6), 2, 2); }
    }),
    panel: canvasTex(256, 256, (g, w, h) => {
      speckle(g, w, h, "#d8d3c8", [["#cbc6bb", 600, 1, 3], ["#e2ddd3", 600, 1, 3]]);
      const gr = g.createLinearGradient(0, h * 0.75, 0, h);
      gr.addColorStop(0, "rgba(120,110,95,0)");
      gr.addColorStop(1, "rgba(120,110,95,.28)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#9c978d";
      g.fillRect(0, 0, 3, h);
      g.fillStyle = "rgba(150,145,135,.6)";
      g.fillRect(0, h * 0.3, w, 2);
      g.fillStyle = "rgba(110,105,95,.5)";
      for (const [x, y] of [[0.3, 0.12], [0.7, 0.12]]) g.fillRect(x * w, y * h, 4, 4);
    }),
    roof: canvasTex(256, 256, (g, w, h) => {
      speckle(g, w, h, "#e9ebea", [["#dfe2e1", 500, 1, 3]], [["rgba(190,195,195,.25)", 6, 60]]);
      g.fillStyle = "rgba(170,175,175,.7)";
      for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 1.5, h);
    }),
    siding: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,.14)";
      for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 1.5);
    }),
    shingle: canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 10) {
        g.fillStyle = "rgba(0,0,0,.18)";
        g.fillRect(0, y, w, 2);
        for (let x = (y / 10) % 2 ? 0 : 8; x < w; x += 16) g.fillRect(x, y, 1.5, 10);
      }
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.12})`; g.fillRect(R() * w, R() * h, 3, 3); }
    }),
    ribs: canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = "#c8cdd0";
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) { g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(x, 0, 2, h); g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x + 5, 0, 2, h); }
    }),
    louver: canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = "#e8e6df";
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#6c6f70";
      g.fillRect(6, 14, w - 12, h - 28);
      g.fillStyle = "rgba(255,255,255,.35)";
      for (let y = 16; y < h - 14; y += 4) g.fillRect(6, y, w - 12, 1);
    }),
    leds: canvasTex(256, 64, (g, w, h) => {
      g.fillStyle = "#15181b";
      g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 16) {
        g.fillStyle = "#2a2f34";
        g.fillRect(x + 1, 2, 14, h - 4);
        for (let y = 6; y < h - 6; y += 5) {
          const r = R();
          g.fillStyle = r < 0.55 ? "#3dff9a" : r < 0.8 ? "#4fb3ff" : r < 0.9 ? "#ffcb47" : "#2a2f34";
          g.fillRect(x + 3 + Math.floor(R() * 9), y, 2, 1.5);
        }
      }
    }),
    chain: canvasTex(64, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = "rgba(170,175,178,1)";
      g.lineWidth = 1.5;
      for (let i = -h; i < w + h; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    }),
    stripe: canvasTex(64, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#fff"; g.fillRect(0, 0, w * 0.55, h); }),
    glow: canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.35, "rgba(255,255,255,.45)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }),
    puff: canvasTex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, "rgba(255,255,255,.9)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }),
    water: canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = "#808080";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},255,.18)`; g.lineWidth = 1 + R() * 2; g.beginPath(); const x = R() * w, y = R() * h; g.arc(x, y, 4 + R() * 14, 0, Math.PI * (0.4 + R())); g.stroke(); }
    }, { color: false }),
  };
  const textTex = (lines, { w = 512, h = 256, bg = "#f6f2e8", fg = "#163a30", accent = "#a9492a" } = {}) =>
    canvasTex(w, h, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.fillStyle = accent;
      g.fillRect(0, 0, w, 18);
      g.fillStyle = fg;
      g.textAlign = "center";
      lines.forEach(([text, size, weight], i) => { g.font = `${weight || 700} ${size}px Geist, Inter, "Segoe UI", sans-serif`; g.fillText(text, w / 2, 70 + i * (size + 22)); });
    });

  // ---------- materials ----------
  const M = (o) => new T3.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const tx = (base, rx, ry) => { const t = base.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t; };
  const MAT = {
    grass: M({ map: tx(TX.grass, 16, 11) }),
    soil: M({ map: tx(TX.soil, 12, 1) }),
    asphalt: M({ map: TX.asphalt, roughness: 0.92 }),
    gravel: M({ map: TX.gravel, roughness: 1 }),
    slab: M({ map: TX.slab, roughness: 0.8 }),
    roof: M({ map: TX.roof, roughness: 0.7 }),
    paint: M({ color: "#f4f1e8", roughness: 0.6 }),
    yellowLine: M({ color: "#e8b923", roughness: 0.6 }),
    white: M({ color: "#ecebe5", roughness: 0.45, metalness: 0.05 }),
    enclosure: M({ map: TX.louver, roughness: 0.5, metalness: 0.1 }),
    metal: M({ color: "#9aa1a6", roughness: 0.4, metalness: 0.7 }),
    galv: M({ color: "#b9c0c4", roughness: 0.35, metalness: 0.8 }),
    dark: M({ color: "#2c3034", roughness: 0.55, metalness: 0.3 }),
    rubber: M({ color: "#1f2124", roughness: 0.9 }),
    steel: M({ color: "#9a4a2f", roughness: 0.6, metalness: 0.4 }),
    machine: M({ color: "#f0b323", roughness: 0.45, metalness: 0.15 }),
    glass: new (lowQ ? T3.MeshStandardMaterial : T3.MeshPhysicalMaterial)({ color: "#5d7f97", roughness: 0.08, metalness: 0.2, envMapIntensity: 1.4 }),
    clearGlass: new (lowQ ? T3.MeshStandardMaterial : T3.MeshPhysicalMaterial)({ color: "#cfe7f2", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false }),
    water: new (lowQ ? T3.MeshStandardMaterial : T3.MeshPhysicalMaterial)(Object.assign({ color: "#3d6f73", roughness: 0.1, metalness: 0.1, normalMap: tx(TX.water, 1, 1), normalScale: new T3.Vector2(0.12, 0.12), envMapIntensity: 1.2 }, lowQ ? {} : { clearcoat: 0.6 })),
    bank: M({ map: tx(TX.dirt, 2, 2), color: "#c9b98f" }),
    wood: M({ color: "#8a6a48", roughness: 0.9 }),
    trunk: M({ color: "#6b4f37", roughness: 0.95 }),
    leaf: M({ color: "#ffffff", roughness: 0.85 }),
    berm: M({ map: tx(TX.grass, 10, 2), roughness: 1 }),
    tray: M({ color: "#e0b43a", roughness: 0.5, metalness: 0.4 }),
    racks: M({ map: TX.leds, emissiveMap: TX.leds, emissive: "#ffffff", emissiveIntensity: 1.4, roughness: 0.4, metalness: 0.3 }),
    beacon: new T3.MeshStandardMaterial({ color: "#1fdf86", emissive: "#1fdf86", emissiveIntensity: 2.2 }),
    lamp: new T3.MeshStandardMaterial({ color: "#fff6dc", emissive: "#ffe9b0", emissiveIntensity: 1.6 }),
    chain: new T3.MeshStandardMaterial({ map: tx(TX.chain, 20, 1), transparent: true, alphaTest: 0.4, side: T3.DoubleSide, metalness: 0.6, roughness: 0.4 }),
    silt: M({ color: "#26282a", roughness: 0.95 }),
    tank: M({ color: "#d9d2c1", roughness: 0.5, metalness: 0.2 }),
    tower: M({ color: "#8fa7b4", roughness: 0.6, metalness: 0.2 }),
    loadbank: M({ color: "#e0782b", roughness: 0.5, metalness: 0.2 }),
    wall: M({ color: "#cfc7b6", roughness: 0.9 }),
    chiller: M({ color: "#d9dcd9", roughness: 0.45, metalness: 0.3 }),
  };
  const panelMat = (len, h, base = TX.panel) => M({ map: tx(base, Math.max(1, Math.round(len / 10)), Math.max(1, h / 16)), roughness: 0.82 });
  const ribMat = (len, h) => M({ map: tx(TX.ribs, len / 4, 1), roughness: 0.45, metalness: 0.45 });

  // ---------- tagged groups ----------
  const groups = [];
  const groupFor = (tags = {}) => {
    const key = [tags.show || "", tags.hide || "", tags.opt || "", tags.keep || "", tags.need || "", tags.drop ? 1 : 0, tags.shift || ""].join("|");
    let g = groups.find((q) => q.userData.key === key);
    if (!g) {
      g = new T3.Group();
      g.userData = { key, show: tags.show || "", hide: tags.hide || "", opt: tags.opt || "", keep: tags.keep || "", need: tags.need || "", drop: !!tags.drop, shift: tags.shift || "", rise: 1 };
      scene.add(g);
      groups.push(g);
    }
    return g;
  };
  const base = groupFor({});
  const add = (parent, mesh, cast = true, recv = true) => { mesh.castShadow = cast; mesh.receiveShadow = recv; parent.add(mesh); return mesh; };
  // A box from plan x0..x1, z0..z1 and height y0..y1.
  const box = (g, mat, x0, x1, z0, z1, y0, y1, cast = true) => {
    const m = new T3.Mesh(new T3.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return add(g, m, cast);
  };
  // A box with softly rounded vertical edges, for enclosures, trailers and vehicles.
  const rgeo = new Map();
  const rbox = (g, mat, cx, cz, w, d, y0, h, r = 0.5, rotY = 0) => {
    const key = `${w}|${d}|${h}|${r}`;
    if (!rgeo.has(key)) {
      const s = new T3.Shape();
      const x = -w / 2, y = -d / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + w - r, y);
      s.quadraticCurveTo(x + w, y, x + w, y + r);
      s.lineTo(x + w, y + d - r);
      s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
      s.lineTo(x + r, y + d);
      s.quadraticCurveTo(x, y + d, x, y + d - r);
      s.lineTo(x, y + r);
      s.quadraticCurveTo(x, y, x + r, y);
      const b = Math.min(r * 0.6, h * 0.2);
      const geo = new T3.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 2, curveSegments: 4 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, b, 0);
      rgeo.set(key, geo);
    }
    const m = new T3.Mesh(rgeo.get(key), mat);
    m.position.set(cx, y0, cz);
    m.rotation.y = rotY;
    return add(g, m);
  };
  const cyl = (g, mat, x, z, r, y0, h, seg = 20, rTop = r) => {
    const m = new T3.Mesh(new T3.CylinderGeometry(rTop, r, h, seg), mat);
    m.position.set(x, y0 + h / 2, z);
    return add(g, m);
  };
  const flatShape = (g, mat, plan, y, rad = 0) => {
    const { x, y: z, w, d } = plan;
    const r = Math.min(rad, w / 2, d / 2);
    // Drawn in (x, -z) and turned up, so the face looks at the sky.
    const s = new T3.Shape();
    const P2 = (px, pz) => [px, -pz];
    s.moveTo(...P2(x + r, z));
    s.lineTo(...P2(x + w - r, z));
    s.quadraticCurveTo(...P2(x + w, z), ...P2(x + w, z + r));
    s.lineTo(...P2(x + w, z + d - r));
    s.quadraticCurveTo(...P2(x + w, z + d), ...P2(x + w - r, z + d));
    s.lineTo(...P2(x + r, z + d));
    s.quadraticCurveTo(...P2(x, z + d), ...P2(x, z + d - r));
    s.lineTo(...P2(x, z + r));
    s.quadraticCurveTo(...P2(x, z), ...P2(x + r, z));
    const geo = new T3.ShapeGeometry(s, 16);
    geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 64, uv.getY(i) / 64);
    const m = new T3.Mesh(geo, mat);
    m.position.y = y;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const strip = (g, mat, x0, x1, z0, z1, y = 0.05) => {
    const m = new T3.Mesh(new T3.PlaneGeometry(x1 - x0, z1 - z0), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const mat2 = (m, rx, ry) => { const c = m.clone(); if (c.map) { c.map = tx(m.map, rx, ry); } return c; };

  // ---------- the diorama tile ----------
  const tile = new T3.Mesh(new T3.BoxGeometry(520, 14, 360), [MAT.soil, MAT.soil, MAT.grass, MAT.soil, MAT.soil, MAT.soil]);
  tile.position.y = -7;
  tile.receiveShadow = true;
  base.add(tile);
  const shadowDisc = new T3.Mesh(new T3.PlaneGeometry(760, 560), new T3.MeshBasicMaterial({ map: TX.glow, color: "#3b3328", transparent: true, opacity: 0.35, depthWrite: false }));
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = -22;
  scene.add(shadowDisc);

  // Roads: county road on the right edge, Pecan Street on the lower left, with markings and a sidewalk.
  strip(base, mat2(MAT.asphalt, 2, 36), 228, 246, -180, 180, 0.06);
  strip(base, mat2(MAT.asphalt, 50, 1.2), -260, 228, 158, 170, 0.06);
  strip(base, MAT.slab, -260, 226, 154, 157.5, 0.07);
  for (let z = -176; z < 176; z += 9) strip(base, MAT.yellowLine, 236.7, 237.3, z, z + 5, 0.08);
  for (let x = -256; x < 224; x += 9) strip(base, MAT.yellowLine, x, x + 5, 163.7, 164.3, 0.08);
  const HOMES = [-236, -196, -156, -116, -76];
  const homeColors = ["#d9c7a3", "#a9bfcf", "#e8e1d2", "#c7a28c", "#b5c4a5"];
  const roofColors = ["#5b4c45", "#3f4448", "#6b5546", "#4a4f55", "#5a4a3f"];
  const carColors = ["#b8322a", "#2e5a88", "#e6e6e6", "#2c2f33", "#8c9298", "#c9a227", "#3c6e4f"];

  // A gable roof prism over a plan, ridge along x.
  const gable = (g, mat, x0, x1, z0, z1, y, h) => {
    const s = new T3.Shape();
    const d = z1 - z0;
    s.moveTo(-d / 2, 0);
    s.lineTo(d / 2, 0);
    s.lineTo(0, h);
    s.closePath();
    const geo = new T3.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false });
    geo.rotateY(Math.PI / 2);
    const m = new T3.Mesh(geo, mat);
    m.position.set(x0, y, (z0 + z1) / 2);
    return add(g, m);
  };
  HOMES.forEach((hx, i) => {
    const wall = M({ map: tx(TX.siding, 3, 1), color: homeColors[i], roughness: 0.8 });
    const roof = M({ map: tx(TX.shingle, 3, 2), color: roofColors[i], roughness: 0.9 });
    box(base, wall, hx, hx + 22, 134, 149, 0, 5.2);
    gable(base, [wall, roof], hx - 1, hx + 23, 133, 150, 5.2, 4.6);
    box(base, MAT.glass, hx + 3, hx + 7, 149, 149.15, 1.6, 3.6, false);
    box(base, MAT.glass, hx + 9, hx + 12, 149, 149.15, 1.6, 3.6, false);
    box(base, M({ color: "#f2efe7" }), hx + 14, hx + 21, 149, 149.15, 0.1, 3.2, false);
    strip(base, MAT.slab, hx + 14, hx + 21, 149, 156, 0.07);
    rbox(base, M({ color: carColors[i], roughness: 0.35, metalness: 0.5 }), hx + 17.5, 152.5, 2, 4.4, 0.35, 1.3, 0.5, 0);
    rbox(base, MAT.glass, hx + 17.5, 152.7, 1.7, 2.4, 1.6, 0.6, 0.4);
    // Back-yard fence facing the site.
    box(base, MAT.wood, hx - 2, hx + 26, 127.6, 127.9, 0, 1.8);
  });

  // ---------- trees (instanced, bucketed by tag) ----------
  const treeBuckets = new Map();
  const tree = (x, z, s = 1, tags = {}, kind = R() < 0.4 ? "pine" : "oak") => {
    const key = JSON.stringify(tags);
    if (!treeBuckets.has(key)) treeBuckets.set(key, { tags, list: [] });
    treeBuckets.get(key).list.push({ x, z, s, kind, rot: R() * 6.28, hue: R() });
  };
  const blob = new T3.SphereGeometry(1, 18, 14);
  {
    const p = blob.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new T3.Vector3().fromBufferAttribute(p, i);
      const n = 1 + 0.12 * Math.sin(v.x * 5.1 + v.y * 3.3) + 0.08 * Math.sin(v.z * 7.7);
      p.setXYZ(i, v.x * n, v.y * n * 0.92, v.z * n);
    }
    blob.computeVertexNormals();
  }
  const cone = new T3.ConeGeometry(1, 1, 16, 3);
  const trunkGeo = new T3.CylinderGeometry(0.22, 0.32, 1, 6);
  function buildTrees() {
    for (const { tags, list } of treeBuckets.values()) {
      const g = groupFor(tags);
      const parts = [
        { geo: trunkGeo, mat: MAT.trunk, f: (t, m) => m.compose(new T3.Vector3(t.x, (t.kind === "pine" ? 3.5 : 2.6) * t.s, t.z), new T3.Quaternion(), new T3.Vector3(t.s * 1.2, (t.kind === "pine" ? 7 : 5.2) * t.s, t.s * 1.2)), c: null },
        { geo: blob, mat: MAT.leaf, only: "oak", f: (t, m) => m.compose(new T3.Vector3(t.x, 7.4 * t.s, t.z), new T3.Quaternion().setFromAxisAngle(new T3.Vector3(0, 1, 0), t.rot), new T3.Vector3(4.3 * t.s, 4 * t.s, 4.3 * t.s)), c: (t) => new T3.Color().setHSL(0.22 + t.hue * 0.06, 0.38, 0.27 + t.hue * 0.07) },
        { geo: blob, mat: MAT.leaf, only: "oak", f: (t, m) => m.compose(new T3.Vector3(t.x + 1.8 * t.s * Math.cos(t.rot), 9.6 * t.s, t.z + 1.8 * t.s * Math.sin(t.rot)), new T3.Quaternion(), new T3.Vector3(2.8 * t.s, 2.7 * t.s, 2.8 * t.s)), c: (t) => new T3.Color().setHSL(0.23 + t.hue * 0.05, 0.38, 0.33 + t.hue * 0.06) },
        { geo: cone, mat: MAT.leaf, only: "pine", f: (t, m) => m.compose(new T3.Vector3(t.x, 9 * t.s, t.z), new T3.Quaternion().setFromAxisAngle(new T3.Vector3(0, 1, 0), t.rot), new T3.Vector3(3.6 * t.s, 9 * t.s, 3.6 * t.s)), c: (t) => new T3.Color().setHSL(0.3 + t.hue * 0.04, 0.32, 0.17 + t.hue * 0.05) },
        { geo: cone, mat: MAT.leaf, only: "pine", f: (t, m) => m.compose(new T3.Vector3(t.x, 13.4 * t.s, t.z), new T3.Quaternion(), new T3.Vector3(2.5 * t.s, 6.5 * t.s, 2.5 * t.s)), c: (t) => new T3.Color().setHSL(0.31 + t.hue * 0.04, 0.3, 0.21 + t.hue * 0.05) },
      ];
      for (const part of parts) {
        const items = list.filter((t) => !part.only || t.kind === part.only);
        if (!items.length) continue;
        const im = new T3.InstancedMesh(part.geo, part.mat, items.length);
        const m = new T3.Matrix4();
        items.forEach((t, i) => { part.f(t, m); im.setMatrixAt(i, m); if (part.c) im.setColorAt(i, part.c(t)); });
        im.castShadow = true;
        im.receiveShadow = true;
        g.add(im);
      }
    }
  }
  HOMES.forEach((hx) => tree(hx + 3, 128.5 + 3, 0.75, {}, "oak"));
  const PONDS = [{ x: -230, y: 22, w: 62, d: 58, r: 20 }, { x: 108, y: 30, w: 70, d: 56, r: 22 }];
  const inBuild = (x, y) => x > -176 && x < 132 && y > -160 && y < 20;
  const roadOrPond = (x, y) => x > 220 || (y > -8 && y < 20 && x > -112) || PONDS.some((p) => x > p.x - 6 && x < p.x + p.w + 6 && y > p.y - 6 && y < p.y + p.d + 6);
  for (let gx = -250; gx <= 214; gx += 15) {
    for (let gy = -172; gy <= 122; gy += 15) {
      const x = gx + (R() - 0.5) * 10, y = gy + (R() - 0.5) * 10, s = 0.75 + R() * 0.5;
      if (roadOrPond(x, y) || (x > 128 && y < -100) || R() < 0.18) continue;
      if (y > 90) tree(x, y, s, { hide: "clear", keep: "buffer:a" });
      else if (inBuild(x, y) || (x > 128 && y > -100) || y > -10) tree(x, y, s, { hide: "clear" });
      else tree(x, y, s);
    }
  }

  // ---------- phase 1: site & permits ----------
  {
    const g = groupFor({ show: "zoning", hide: "punch" });
    box(g, MAT.wood, 217.5, 218, 21, 21.5, 0, 4.4);
    box(g, MAT.wood, 217.5, 218, 27.5, 28, 0, 4.4);
    const noticeMat = new T3.MeshStandardMaterial({ map: textTex([[signLines()[0], 56, 800], [signLines()[1], 40, 600]]) });
    signMats.notice = noticeMat;
    const sign = new T3.Mesh(new T3.PlaneGeometry(8, 4), noticeMat);
    sign.position.set(218.3, 4.2, 24.5);
    sign.rotation.y = Math.PI / 2;
    add(g, sign);
    box(g, M({ color: "#3a3a3a" }), 217.6, 218.2, 20.5, 28.5, 2.1, 6.3).material = M({ color: "#5a5a5a" });
  }
  const stakes = (pts, color, tags) => {
    const g = groupFor(tags);
    const flag = M({ color, roughness: 0.6, side: T3.DoubleSide });
    for (const [x, z] of pts) {
      box(g, MAT.wood, x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, 2.4);
      const f = new T3.Mesh(new T3.PlaneGeometry(1.2, 0.7), flag);
      f.position.set(x + 0.6, 2.1, z);
      add(g, f);
    }
  };
  const corners = (p, i = 0) => [[p.x + i, p.y + i], [p.x + p.w - i, p.y + i], [p.x + p.w - i, p.y + p.d - i], [p.x + i, p.y + p.d - i]];
  stakes(corners({ x: 135, y: -165, w: 70, d: 60 }), "#ff7a1a", { show: "capacity", hide: "substation" });
  stakes(PONDS.flatMap((p) => corners(p, 6)), "#2f8fe0", { show: "stormPlan", hide: "ponds" });
  stakes([[-242, -168], [220, -168], [220, 126], [-242, 126], [-11, -168], [-11, 126]], "#ff3fa4", { show: "zoning", hide: "punch" });

  // ---------- phase 2: clearing, erosion control, ponds, roads ----------
  {
    const g = groupFor({ show: "clear", hide: "punch" });
    flatShape(g, M({ map: TX.dirt, roughness: 1 }), { x: -170, y: -158, w: 300, d: 176 }, 0.04, 6);
    // Bulldozer and excavator parked on the pad, the site trailer and two portable toilets.
    const dozer = (x, z, rot) => {
      const q = new T3.Group();
      q.position.set(x, 0, z);
      q.rotation.y = rot;
      rbox(q, MAT.rubber, 0, -1.6, 5.6, 1.1, 0, 1.3, 0.5);
      rbox(q, MAT.rubber, 0, 1.6, 5.6, 1.1, 0, 1.3, 0.5);
      rbox(q, MAT.machine, -0.4, 0, 4.2, 2.6, 1.1, 1.6, 0.3);
      rbox(q, MAT.machine, -1.2, 0, 1.8, 2.2, 2.6, 1.7, 0.2);
      box(q, MAT.glass, -2.15, -0.25, -1.0, 1.0, 3.0, 4.0, false);
      box(q, MAT.metal, 3.2, 3.6, -2.4, 2.4, 0.1, 1.8);
      add(g, q);
    };
    dozer(-60, -10, 0.4);
    const exc = new T3.Group();
    exc.position.set(60, 0, -20);
    exc.rotation.y = -0.7;
    rbox(exc, MAT.rubber, 0, -1.7, 6, 1.2, 0, 1.2, 0.5);
    rbox(exc, MAT.rubber, 0, 1.7, 6, 1.2, 0, 1.2, 0.5);
    rbox(exc, MAT.machine, 0, 0, 4.6, 3.4, 1.3, 1.8, 0.4);
    rbox(exc, MAT.machine, -1, 0.9, 1.6, 1.4, 3.1, 1.8, 0.2);
    const arm = new T3.Mesh(new T3.BoxGeometry(6, 0.7, 0.7), MAT.machine);
    arm.position.set(2.8, 4.6, -0.4);
    arm.rotation.z = 0.5;
    add(exc, arm);
    const stick = new T3.Mesh(new T3.BoxGeometry(4, 0.55, 0.55), MAT.machine);
    stick.position.set(6.2, 3.8, -0.4);
    stick.rotation.z = -1.0;
    add(exc, stick);
    rbox(exc, MAT.dark, 7.4, -0.4, 1.4, 1.4, 0.2, 1.1, 0.3);
    add(g, exc);
    rbox(g, MAT.white, 161, 20, 22, 8, 0, 3.6, 0.4);
    box(g, MAT.glass, 152, 170, 24.05, 24.1, 1.6, 2.6, false);
    box(g, MAT.wood, 158, 161, 24, 26, 0, 0.8);
    rbox(g, M({ color: "#2e6fb8" }), 176, 18, 1.4, 1.4, 0, 2.3, 0.2);
    rbox(g, M({ color: "#2e6fb8" }), 178, 18, 1.4, 1.4, 0, 2.3, 0.2);
  }
  {
    const g = groupFor({ show: "erosion", hide: "punch" });
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new T3.Mesh(new T3.BoxGeometry(len, 0.8, 0.08), MAT.silt);
      m.position.set((x0 + x1) / 2, 0.4, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      add(g, m);
      for (let t = 0; t <= len; t += 6) box(g, MAT.wood, x0 + ((x1 - x0) * t) / len - 0.1, x0 + ((x1 - x0) * t) / len + 0.1, z0 + ((z1 - z0) * t) / len - 0.1, z0 + ((z1 - z0) * t) / len + 0.1, 0, 1.1);
    };
    run(-172, -160, 132, -160);
    run(132, -160, 132, -8);
    run(-172, -160, -172, 20);
    run(-172, 20, -112, 20);
  }
  for (const p of PONDS) {
    const g = groupFor({ show: "ponds", shift: "ponds" });
    flatShape(g, MAT.bank, p, 0.05, p.r);
    flatShape(g, MAT.water, { x: p.x + 5, y: p.y + 5, w: p.w - 10, d: p.d - 10 }, 0.09, p.r - 4);
    // Outlet structure.
    box(g, MAT.slab, p.x + p.w - 6, p.x + p.w - 3, p.y + p.d / 2 - 1.5, p.y + p.d / 2 + 1.5, 0, 1.4);
  }
  {
    const g = groupFor({ show: "roads", shift: "roads" });
    strip(g, mat2(MAT.asphalt, 30, 1), -100, 228, 0, 12, 0.065);
    const lay = groupFor({ show: "roads", hide: "punch", shift: "roads" });
    strip(lay, mat2(MAT.gravel, 4, 3), 120, 204, -62, -12, 0.06);
    strip(lay, mat2(MAT.gravel, 2, 1), 196, 228, -4, 16, 0.07);
    const pipe = M({ color: "#2f3236", roughness: 0.5, metalness: 0.5 });
    const pvc = M({ color: "#e9e6dc", roughness: 0.5 });
    for (const [x, z, mat] of [[132, -52, pipe], [150, -52, pvc], [168, -52, pipe]]) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4 - r; c++) {
        const m = new T3.Mesh(new T3.CylinderGeometry(0.55, 0.55, 12, 12), mat);
        m.rotation.z = Math.PI / 2;
        m.position.set(x, 0.55 + r * 0.95, z + c * 1.15 + r * 0.55);
        add(lay, m);
      }
    }
    for (let r = 0; r < 3; r++) box(lay, MAT.steel, 130, 150, -36 + r * 0.1, -30, r * 0.7, r * 0.7 + 0.6);
  }
  {
    const g = groupFor({ show: "roads", opt: "wall:a" });
    for (let x = -242; x < 58; x += 6) {
      box(g, MAT.wall, x, x + 5.8, 124.4, 125.4, 0, 6);
      box(g, M({ color: "#a39a88" }), x + 5.7, x + 6, 124.2, 125.6, 0, 6.3);
    }
  }
  {
    const g = groupFor({ show: "clear", opt: "buffer:a" });
    const s = new T3.Shape();
    s.moveTo(-10, 0);
    s.bezierCurveTo(-5, 0.5, -4, 4.6, 0, 4.8);
    s.bezierCurveTo(4, 4.6, 5, 0.5, 10, 0);
    s.closePath();
    const geo = new T3.ExtrudeGeometry(s, { depth: 300, bevelEnabled: false, curveSegments: 10 });
    geo.rotateY(Math.PI / 2);
    const m = new T3.Mesh(geo, MAT.berm);
    m.position.set(-242, 0, 113);
    add(g, m);
    for (let x = -230; x < 54; x += 18) tree(x + R() * 6, 112 + R() * 3, 0.6, { show: "punch", opt: "buffer:a" }, R() < 0.5 ? "pine" : "oak");
  }

  // ---------- phase 3: utilities ----------
  {
    const g = groupFor({ show: "substation", shift: "substation" });
    strip(g, mat2(MAT.gravel, 4, 3), 135, 205, -165, -105, 0.07);
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new T3.Mesh(new T3.PlaneGeometry(len, 2.6), MAT.chain);
      m.position.set((x0 + x1) / 2, 1.4, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      add(g, m, false, false);
      for (let t = 0; t <= len; t += 5) cyl(g, MAT.galv, x0 + ((x1 - x0) * t) / len, z0 + ((z1 - z0) * t) / len, 0.08, 0, 2.8, 6);
    };
    fence(135, -165, 205, -165);
    fence(205, -165, 205, -105);
    fence(205, -105, 135, -105);
    fence(135, -105, 135, -165);
    for (const x of [146, 170]) {
      box(g, MAT.slab, x - 1, x + 15, -148, -134, 0, 0.5);
      rbox(g, M({ color: "#5d666c", roughness: 0.45, metalness: 0.5 }), x + 7, -141, 10, 7, 0.5, 6, 0.3);
      for (let i = 0; i < 9; i++) box(g, M({ color: "#4f575c", roughness: 0.5, metalness: 0.5 }), x + 2.5 + i * 1.1, x + 2.8 + i * 1.1, -146.2, -144.4, 1.2, 6);
      for (const bx of [x + 3.5, x + 7, x + 10.5]) cyl(g, M({ color: "#8a5a3b", roughness: 0.3 }), bx, -139.5, 0.35, 6.5, 2.8, 10, 0.2);
      const cons = new T3.Mesh(new T3.CylinderGeometry(0.9, 0.9, 6, 14), MAT.metal);
      cons.rotation.z = Math.PI / 2;
      cons.position.set(x + 7, 8, -143.5);
      add(g, cons);
    }
    for (const x of [150, 190]) { box(g, MAT.galv, x - 0.4, x + 0.4, -159, -158.2, 0, 14); }
    box(g, MAT.galv, 149.6, 190.4, -159, -158.2, 13.6, 14.4);
    for (const x of [158, 170, 182]) cyl(g, M({ color: "#7b5641", roughness: 0.3 }), x, -158.6, 0.3, 11.4, 2.2, 8);
    rbox(g, M({ color: "#d8cdb6" }), 193, -119, 14, 10, 0, 4.6, 0.3);
    box(g, M({ color: "#6f6a62" }), 185.8, 200.2, -124.2, -113.8, 4.6, 5);
  }
  {
    const g = groupFor({ show: "transmission" });
    const POLES = [[250, -170], [212, -170]];
    for (const [x, z] of POLES) {
      for (const dz of [-5, 5]) cyl(g, MAT.galv, x, z + dz, 0.55, 0, 27, 10, 0.4);
      box(g, MAT.galv, x - 0.5, x + 0.5, z - 9, z + 9, 25, 26);
      for (const dz of [-7, 0, 7]) cyl(g, M({ color: "#7b5641" }), x, z + dz, 0.22, 23.6, 1.4, 8);
    }
    const tubeMat = MAT.dark;
    const wires = [];
    for (const dz of [-7, 0, 7]) {
      const pts = [];
      const A = new T3.Vector3(262, 24.5, -170 + dz), B = new T3.Vector3(250, 23.6, -170 + dz), C = new T3.Vector3(212, 23.6, -170 + dz), D = new T3.Vector3(170 + dz * 1.6, 11.4, -158.6);
      const sag = (p, q, s) => { for (let i = 0; i <= 20; i++) { const t = i / 20; const v = p.clone().lerp(q, t); v.y -= Math.sin(Math.PI * t) * s; pts.push(v); } };
      sag(B, C, 2.4);
      sag(C, D, 1.6);
      const geo = new T3.TubeGeometry(new T3.CatmullRomCurve3(pts), 80, 0.12, 5);
      const m = new T3.Mesh(geo, tubeMat.clone());
      m.userData.live = true;
      add(g, m, true, false);
      wires.push(m);
      void A;
    }
    g.userData.wires = wires;
  }
  const paint = (g, color, pts, w = 0.7) => {
    const mat = M({ color, roughness: 0.7 });
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
      strip(g, mat, Math.min(x0, x1) - w / 2, Math.max(x0, x1) + w / 2, Math.min(z0, z1) - w / 2, Math.max(z0, z1) + w / 2, 0.11);
    }
    for (const [x, z] of pts) { box(g, M({ color }), x - 0.15, x + 0.15, z - 0.15, z + 0.15, 0, 1.4); }
  };
  {
    const g = groupFor({ show: "water", hide: "punch" });
    paint(g, "#2f6fd6", [[236, -26], [-12, -26], [-12, -60]]);
    paint(g, "#2fa04f", [[236, -18], [-4, -18], [-4, -60]]);
  }
  {
    const g = groupFor({ show: "water" });
    rbox(g, MAT.slab, 229, -29, 6, 4, 0, 1.2, 0.2);
    for (const [x, z] of [[120, -26], [40, -26], [120, -18], [40, -18]]) cyl(g, MAT.dark, x, z, 1.1, 0, 0.2, 18);
  }
  {
    const g = groupFor({ show: "fiber", hide: "punch" });
    paint(g, "#ff8a1f", [[236, 20], [24, 20], [24, -60]]);
    paint(g, "#ff8a1f", [[-60, -180], [-60, -140]]);
    for (const [x, z] of [[236, 20], [130, 20], [24, 20], [-60, -176]]) rbox(g, M({ color: "#ff8a1f" }), x, z + 2, 0.6, 0.6, 0, 1.6, 0.15);
  }

  // ---------- phase 4: foundations ----------
  const H = { x0: -150, x1: 30, z0: -140, z1: -60 };
  box(groupFor({ show: "slab", shift: "hall" }), MAT.slab, H.x0 - 2, H.x1 + 2, H.z0 - 2, H.z1 + 2, 0, 0.8);
  box(groupFor({ show: "slab", shift: "hall" }), MAT.slab, -151, -109, -60, -37, 0, 0.6);
  const GENS = Array.from({ length: 7 }, (_, i) => ({ x: 86, z: -134.5 + i * 11 }));
  {
    const g = groupFor({ show: "pads", shift: "yard" });
    box(g, MAT.slab, 39, 63, -136, -99, 0, 0.6);
    for (const p of GENS) box(g, MAT.slab, p.x - 7, p.x + 7, p.z - 4.5, p.z + 4.5, 0, 0.6);
    box(g, MAT.slab, 39, 63, -95, -87, 0, 0.6);
    box(groupFor({ show: "pads", shift: "hall" }), MAT.slab, -192, -168, -132, -108, 0, 0.6);
    box(groupFor({ show: "pads", opt: "cool:b", shift: "yard" }), MAT.slab, 37, 69, -55, -39, 0, 0.6);
  }

  // ---------- phase 5: shell ----------
  const HH = 17.5;
  {
    const g = groupFor({ show: "panels", shift: "hall" });
    box(g, panelMat(180, HH), H.x0, H.x1, H.z0, H.z0 + 1.2, 0.8, HH);
    box(g, panelMat(80, HH), H.x0, H.x0 + 1.2, H.z0, H.z1, 0.8, HH);
    box(g, panelMat(180, HH), H.x0, H.x1, H.z1 - 1.2, H.z1, 0.8, HH);
    box(g, panelMat(80, HH), H.x1 - 1.2, H.x1, H.z0, H.z1, 0.8, HH);
    // Office: concrete with a glass band.
    box(g, panelMat(40, 10), -150, -110, -60, -38, 0.6, 10.5);
    box(g, MAT.glass, -150.2, -109.8, -60.2, -37.8, 3.8, 7.2);
    box(g, M({ color: "#e9e3d6" }), -151, -109, -61, -37, 10.5, 11);
    // Loading dock doors on the front wall.
    for (const x of [-95, -80, -65]) box(g, M({ color: "#a9afb3", metalness: 0.5, roughness: 0.4 }), x, x + 6, H.z1 + 0.01, H.z1 + 0.06, 0.8, 6.5, false);
  }
  {
    const g = groupFor({ show: "panels", hide: "ups", shift: "hall" });
    // A crawler crane setting panels and steel.
    const c = new T3.Group();
    c.position.set(10, 0, -40);
    c.rotation.y = 0.3;
    rbox(c, MAT.rubber, 0, -2.4, 9, 1.4, 0, 1.5, 0.6);
    rbox(c, MAT.rubber, 0, 2.4, 9, 1.4, 0, 1.5, 0.6);
    rbox(c, M({ color: "#d63b2a", roughness: 0.4, metalness: 0.2 }), 0, 0, 7, 4.6, 1.5, 3.4, 0.4);
    rbox(c, MAT.dark, -3.6, 0, 2, 4.4, 1.6, 2.6, 0.3);
    const boomLen = 46;
    const boom = new T3.Mesh(new T3.BoxGeometry(boomLen, 1.2, 1.2), M({ color: "#d63b2a", roughness: 0.4, metalness: 0.3 }));
    const ang = 1.05;
    boom.position.set(Math.cos(ang) * boomLen * 0.5 * -1 + 1, 4 + Math.sin(ang) * boomLen * 0.5, 0);
    boom.rotation.z = -ang + Math.PI;
    add(c, boom);
    const tipX = 1 - Math.cos(ang) * boomLen, tipY = 4 + Math.sin(ang) * boomLen;
    const line = new T3.Mesh(new T3.CylinderGeometry(0.06, 0.06, tipY - 8, 4), MAT.dark);
    line.position.set(tipX, (tipY + 8) / 2, 0);
    add(c, line);
    rbox(c, MAT.machine, tipX, 0, 1, 1, 6.6, 1.4, 0.2);
    add(g, c);
  }
  {
    const g = groupFor({ show: "steel", shift: "hall" });
    for (const z of [-120, -100, -80]) box(g, MAT.steel, -0.5, 0.5, z - 0.5, z + 0.5, 0.8, 15.6);
    for (let x = 0; x < 30; x += 5) box(g, MAT.steel, x - 0.3, x + 0.3, H.z0 + 1.2, H.z1 - 1.2, 15, 15.8);
    box(g, MAT.steel, -0.6, 0.6, H.z0 + 1.2, H.z1 - 1.2, 15.6, 16.4);
  }
  {
    const g = groupFor({ show: "roof", shift: "hall" });
    box(g, mat2(MAT.roof, 6, 3), H.x0 + 1.2, 0.6, H.z0 + 1.2, H.z1 - 1.2, 15.8, 16.4);
    for (const x of [-130, -100, -70, -40]) box(g, MAT.white, x, x + 2, -104, -101, 16.4, 17.2);
  }

  // ---------- phase 6: MEP ----------
  {
    const g = groupFor({ show: "ups", shift: "yard" });
    box(g, ribMat(35, 8), 40, 62, -135, -100, 0.6, 9);
    box(g, M({ color: "#d4d8da", metalness: 0.4, roughness: 0.4 }), 39.6, 62.4, -135.4, -99.6, 9, 9.5);
    for (const z of [-130, -122, -114, -106]) box(g, MAT.enclosure, 62, 62.1, z, z + 4, 3, 6, false);
  }
  {
    const g = groupFor({ show: "switchgear", shift: "yard" });
    for (let i = 0; i < 4; i++) {
      rbox(g, M({ color: "#c9cdc9", roughness: 0.45, metalness: 0.2 }), 42.3 + i * 5.5, -91, 4.6, 6, 0.6, 3.6, 0.2);
      box(g, M({ color: "#7e8487" }), 40.4 + i * 5.5, 44.2 + i * 5.5, -87.95, -87.9, 1, 3.8, false);
    }
  }
  const fans = [];
  const fanGeo = (() => { const parts = [0, 1, 2].map((k) => new T3.BoxGeometry(2.4, 0.08, 0.35).rotateY((k * Math.PI) / 3).toNonIndexed()); const g = new T3.BufferGeometry(); for (const n of ["position", "normal", "uv"]) { const size = parts[0].attributes[n].itemSize; g.setAttribute(n, new T3.BufferAttribute(Float32Array.from(parts.flatMap((p) => [...p.attributes[n].array])), size)); } return g; })();
  const fan = (g, x, y, z, r = 1.3) => {
    cyl(g, MAT.dark, x, z, r, y, 0.25, 20);
    const b = new T3.Group();
    b.position.set(x, y + 0.32, z);
    const m = new T3.Mesh(fanGeo, MAT.metal);
    m.scale.set(r / 1.3, 1, r / 1.3);
    m.userData.live = true;
    b.add(m);
    g.add(b);
    fans.push(b);
  };
  {
    const g = groupFor({ show: "gens", shift: "yard" });
    for (const p of GENS) {
      rbox(g, MAT.enclosure, p.x, p.z, 12, 6.6, 0.6, 4.4, 0.5);
      cyl(g, MAT.dark, p.x - 3.5, p.z, 0.45, 5, 3.4, 10);
      cyl(g, MAT.dark, p.x - 3.5, p.z, 0.65, 8.3, 0.3, 10);
    }
  }
  {
    const g = groupFor({ show: "cooling", opt: "cool:a", drop: true, shift: "hall" });
    for (let x = -142; x < -10; x += 22) {
      for (const z of [-128, -112, -96, -80]) {
        rbox(g, MAT.chiller, x + 7, z + 3.5, 14, 7, 16.4, 2.4, 0.3);
        for (const fx of [x + 2.8, x + 7, x + 11.2]) fan(g, fx, 18.8, z + 3.5, 1.5);
      }
    }
  }
  const steamSpots = [];
  {
    const g = groupFor({ show: "cooling", opt: "cool:b", shift: "yard" });
    for (let i = 0; i < 3; i++) {
      const x = 38 + i * 10.5 + 4.5;
      box(g, MAT.tower, x - 4.5, x + 4.5, -54, -40, 0.6, 8.4);
      box(g, MAT.enclosure, x - 4.5, x + 4.5, -40, -39.9, 1.4, 6, false);
      cyl(g, MAT.tower, x, -47, 3.6, 8.4, 2.2, 24);
      fan(g, x, 10.4, -47, 3);
      steamSpots.push([x, 11, -47]);
    }
  }
  {
    const g = groupFor({ show: "fire", shift: "hall" });
    cyl(g, MAT.tank, -180, -120, 10, 0.6, 14, 40);
    cyl(g, MAT.tank, -180, -120, 10.1, 14.6, 2.4, 40, 0.8);
    for (let y = 1; y < 14; y += 0.6) box(g, MAT.galv, -170.4, -169.8, -120.6, -119.4, y, y + 0.1);
    rbox(g, M({ color: "#cfc7b6" }), -171, -100.5, 10, 7, 0, 4, 0.3);
  }

  // ---------- phase 7: fit-out inside the open bay ----------
  const ROWS = [3.2, 8.2, 13.6, 18.6, 24];
  const RZ = [H.z0 + 7, H.z1 - 7];
  {
    const g = groupFor({ show: "racks", shift: "hall" });
    for (const x of ROWS) box(g, MAT.racks, x, x + 1.2, RZ[0], RZ[1], 0.8, 3.2);
  }
  {
    const g = groupFor({ show: "containment", shift: "hall" });
    for (const [a, b] of [[4.4, 8.2], [14.8, 18.6]]) {
      box(g, MAT.clearGlass, a, b, RZ[0], RZ[1], 3.2, 3.35, false);
      box(g, MAT.clearGlass, a, b, RZ[1] - 0.1, RZ[1], 0.8, 3.2, false);
    }
  }
  {
    const g = groupFor({ show: "trays", shift: "hall" });
    for (const x of [3.6, 14, 24.4]) box(g, MAT.tray, x - 0.3, x + 0.9, H.z0 + 1.2, H.z1 - 1.2, 5, 5.25);
    for (let z = H.z0 + 10; z < H.z1; z += 12) box(g, MAT.tray, 3.3, 25.1, z, z + 0.6, 5.25, 5.4);
  }

  // ---------- phase 8: commissioning ----------
  const beacons = [];
  const beacon = (tags, pts) => {
    const g = groupFor(tags);
    for (const [x, y, z] of pts) {
      const m = new T3.Mesh(new T3.SphereGeometry(0.7, 14, 10), MAT.beacon);
      m.position.set(x, y, z);
      m.userData.live = true;
      g.add(m);
      beacons.push(m);
    }
  };
  beacon({ show: "L1", need: "substation", shift: "substation" }, [[153, 7.6, -141], [177, 7.6, -141]]);
  beacon({ show: "L2", need: "switchgear", shift: "yard" }, [0, 1, 2, 3].map((i) => [42.3 + i * 5.5, 5.1, -91]));
  beacon({ show: "L3", need: "gens", shift: "yard" }, GENS.map((p) => [p.x + 4, 5.8, p.z]));
  beacon({ show: "L5", shift: "hall" }, [[51, 10.2, -117], [-130, 11.5, -48]]);
  {
    const g = groupFor({ show: "L4", hide: "handover", shift: "yard" });
    for (let i = 0; i < 4; i++) {
      rbox(g, MAT.loadbank, 109, -128 + i * 16, 8, 12, 0.4, 3.6, 0.4);
      box(g, MAT.enclosure, 104.9, 105, -133 + i * 16, -123 + i * 16, 1, 3.6, false);
      for (const dz of [-3, 3]) cyl(g, MAT.rubber, 109, -128 + i * 16 + dz, 0.5, 0, 0.5, 10);
    }
  }

  // ---------- phase 9: turnover ----------
  {
    const g = groupFor({ show: "punch" });
    strip(g, mat2(MAT.asphalt, 4, 2), -168, -98, -30, -2, 0.068);
    for (let x = -161; x < -100; x += 7) { strip(g, MAT.paint, x - 0.1, x + 0.1, -30, -20, 0.075); strip(g, MAT.paint, x - 0.1, x + 0.1, -12, -2, 0.075); }
    strip(g, MAT.slab, -150, -110, -37, -32, 0.07);
    for (let i = 0; i < 12; i++) {
      const x = -164 + (i % 6) * 7 + 3.5 + (i > 5 ? 28 : 0) * 0;
      const z = i < 6 ? -25 : -7;
      if (R() < 0.25) continue;
      const col = carColors[Math.floor(R() * carColors.length)];
      rbox(g, M({ color: col, roughness: 0.35, metalness: 0.5 }), x, z, 2, 4.4, 0.35, 1.3, 0.5);
      rbox(g, MAT.glass, x, z + 0.2, 1.7, 2.4, 1.6, 0.6, 0.4);
    }
    for (const [x, z] of [[-170, -32], [-96, -32], [-170, 0], [-96, 0], [124, -66], [70, -2]]) {
      cyl(g, MAT.dark, x, z, 0.18, 0, 9, 8);
      const head = new T3.Mesh(new T3.BoxGeometry(1.8, 0.35, 0.8), MAT.lamp);
      head.position.set(x + 0.6, 9, z);
      g.add(head);
    }
    for (let z = -150; z < 110; z += 16) if (z < -12 || z > 18) tree(214, z, 0.7, { show: "punch" }, "oak");
    for (const [x, z] of [[-175, -40], [-92, -40], [-175, 6], [-92, 8]]) tree(x, z, 0.65, { show: "punch" }, "oak");
  }
  {
    const g = groupFor({ show: "handover" });
    rbox(g, M({ color: "#e8e3d6" }), 201, 18, 6, 6, 0, 3.4, 0.3);
    box(g, MAT.glass, 197.9, 204.1, 20.9, 21.05, 1.4, 2.8, false);
    box(g, M({ color: "#e8e3d6" }), 197.5, 204.5, 14.5, 21.5, 3.4, 3.8);
    const arm = box(g, M({ color: "#c0392b" }), 188, 197, 13, 13.4, 1.6, 1.9);
    void arm;
    const campusMat = new T3.MeshStandardMaterial({ map: textTex([[signLines()[2], 72, 800]], { w: 512, h: 160, bg: "#163a30", fg: "#f7f4ee", accent: "#e69f00" }) });
    signMats.campus = campusMat;
    const sign = new T3.Mesh(new T3.PlaneGeometry(10, 3), campusMat);
    sign.position.set(222.4, 2.2, 28);
    sign.rotation.y = Math.PI / 2;
    add(g, sign);
    box(g, MAT.slab, 221.8, 222.3, 22.6, 33.4, 0, 3.8);
  }

  buildTrees();

  // Fewer draw calls for library laptops: within each tagged group, bake every static mesh that
  // shares a material into one geometry. Moving parts (fans, beacons, wires) are marked live and kept.
  (function mergeStatic() {
    scene.updateMatrixWorld(true);
    const names = ["position", "normal", "uv"];
    for (const g of groups) {
      const buckets = new Map();
      g.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.userData.live || Array.isArray(o.material) || o.material.transparent) return;
        if (!names.every((n) => o.geometry.attributes[n])) return;
        const key = o.material.uuid + (o.castShadow ? "c" : "n");
        if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, list: [] });
        buckets.get(key).list.push(o);
      });
      for (const b of buckets.values()) {
        if (b.list.length < 2) continue;
        const parts = b.list.map((o) => { const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); geo.clearGroups(); geo.applyMatrix4(o.matrixWorld); return geo; });
        const total = parts.reduce((s, p) => s + p.attributes.position.count, 0);
        const merged = new T3.BufferGeometry();
        for (const n of names) {
          const size = parts[0].attributes[n].itemSize;
          const arr = new Float32Array(total * size);
          let off = 0;
          for (const p of parts) { arr.set(p.attributes[n].array, off); off += p.attributes[n].count * size; }
          merged.setAttribute(n, new T3.BufferAttribute(arr, size));
        }
        merged.computeBoundingSphere();
        const m = new T3.Mesh(merged, b.mat);
        m.castShadow = b.cast;
        m.receiveShadow = true;
        for (const o of b.list) o.parent.remove(o);
        g.add(m);
      }
    }
  })();
  // A lost context draws nothing until it is restored: the loop stops, and kick() starts nothing meanwhile (FE-1).
  let lost = false;
  const gl = renderer.getContext();
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; stop(); document.body.dataset.nogl = ""; });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false;
    // Rebuild the GPU state in place. A reload would wipe the game in progress (C6).
    const env = new T3.PMREMGenerator(renderer);
    scene.environment = env.fromScene(envScene, 0.04).texture;
    env.dispose();
    renderer.shadowMap.needsUpdate = true;
    delete document.body.dataset.nogl;
    start();
  });

  // ---------- neighborhood overlays ----------
  const ov = new T3.Group();
  scene.add(ov);
  const clip = [new T3.Plane(new T3.Vector3(1, 0, 0), 260), new T3.Plane(new T3.Vector3(-1, 0, 0), 260), new T3.Plane(new T3.Vector3(0, 0, 1), 180), new T3.Plane(new T3.Vector3(0, 0, -1), 180)];
  const OV = {};
  const ovGroup = (name) => { const g = new T3.Group(); g.userData = { name, level: 0, on: false, hot: 1 }; ov.add(g); OV[name] = g; g.visible = false; return g; };
  const basic = (color, o = {}) => new T3.MeshBasicMaterial({ color, transparent: true, depthWrite: false, clippingPlanes: clip, ...o });
  const pathTube = (g, pts, color, r = 0.9, y = 0.7) => {
    const path = new T3.CurvePath();
    for (let i = 1; i < pts.length; i++) path.add(new T3.LineCurve3(new T3.Vector3(pts[i - 1][0], y, pts[i - 1][1]), new T3.Vector3(pts[i][0], y, pts[i][1])));
    const len = path.getLength();
    const map = TX.stripe.clone();
    map.needsUpdate = true;
    map.repeat.set(len / 9, 1);
    const m = new T3.Mesh(new T3.TubeGeometry(path, Math.max(20, Math.round(len / 3)), r, 6), basic(color, { map, opacity: 0.95 }));
    g.add(m);
    g.userData.maps = [...(g.userData.maps || []), map];
    return m;
  };
  const ROUTES = {
    a: [[241, -178], [241, 4], [204, 4]],
    b: [[-258, 166], [234, 166], [234, 8], [204, 8]],
  };
  pathTube(ovGroup("route-a"), ROUTES.a, "#ffb000");
  pathTube(ovGroup("route-b"), ROUTES.b, "#ffb000");
  {
    const g = ovGroup("storm");
    pathTube(g, [[-150, -60], [-175, -10], [-199, 51]], "#1d8fe0", 0.7, 0.5);
    pathTube(g, [[30, -60], [60, 26], [143, 58]], "#1d8fe0", 0.7, 0.5);
  }
  pathTube(ovGroup("setback"), [[-242, 92], [212, 92]], "#00a37a", 0.6, 0.4);
  {
    const g = ovGroup("power");
    pathTube(g, [[168, -105], [168, -117], [62, -117]], "#d65db1", 0.8, 0.5);
  }
  const ripples = (name, cx, cz, color) => {
    const g = ovGroup(name);
    g.userData.rings = [];
    for (let i = 0; i < 5; i++) {
      const m = new T3.Mesh(new T3.RingGeometry(0.96, 1, 120), basic(color, { opacity: 0.5, side: T3.DoubleSide }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, 0.6 + i * 0.01, cz);
      g.add(m);
      g.userData.rings.push(m);
    }
    return g;
  };
  ripples("noise", -60, -50, "#d4532c");
  ripples("gens", 86, -100, "#d4532c");
  const particles = (name, n, color, size, area) => {
    const g = ovGroup(name);
    const geo = new T3.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos.set(area(i), i * 3); seeds[i] = R(); }
    geo.setAttribute("position", new T3.BufferAttribute(pos, 3));
    const pts = new T3.Points(geo, new T3.PointsMaterial({ color, size, map: TX.puff, transparent: true, depthWrite: false, opacity: 0.55, sizeAttenuation: true }));
    g.add(pts);
    g.userData.pts = pts;
    g.userData.home = pos.slice();
    g.userData.seeds = seeds;
    return g;
  };
  particles("dust", 380, "#b88a5a", 7, () => [-165 + R() * 290, R() * 14, -155 + R() * 170]);
  particles("plume", 160, "#ffffff", 5, (i) => { const s = steamSpots[i % 3] || [55, 11, -47]; return [s[0] + (R() - 0.5) * 4, s[1] + R() * 22, s[2] + (R() - 0.5) * 4]; });
  {
    const g = ovGroup("glow");
    for (const [x, z] of [[-170, -32], [-96, -32], [-170, 0], [-96, 0], [124, -66], [70, -2], [-60, -50], [20, -40]]) {
      const m = new T3.Mesh(new T3.PlaneGeometry(52, 52), basic("#ffc94a", { map: TX.glow, opacity: 0.35, blending: T3.AdditiveBlending }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.5, z);
      g.add(m);
    }
  }

  // ---------- trucks ----------
  const truckSet = [];
  for (let i = 0; i < 4; i++) {
    const t = new T3.Group();
    rbox(t, MAT.dark, 0, 0, 9.5, 2.5, 0.7, 0.5, 0.2);
    rbox(t, M({ color: "#f4f2ec", roughness: 0.35, metalness: 0.3 }), 3.4, 0, 2.6, 2.5, 1.1, 2.4, 0.35);
    box(t, MAT.glass, 4.66, 4.72, -1.05, 1.05, 2.3, 3.2, false);
    rbox(t, M({ color: ["#d8892b", "#7f8a8f", "#b8322a", "#d8892b"][i], roughness: 0.55, metalness: 0.3 }), -1.6, 0, 6.2, 2.6, 1.2, 2.2, 0.25);
    for (const wx of [3.4, -0.6, -3.2]) for (const wz of [-1.25, 1.25]) {
      const w = new T3.Mesh(new T3.CylinderGeometry(0.55, 0.55, 0.45, 12), MAT.rubber);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 0.55, wz);
      add(t, w);
    }
    t.visible = false;
    scene.add(t);
    truckSet.push(t);
  }
  const trucks = { count: 0, route: "a", t: 0 };
  const routeCurve = {};
  for (const [k, pts] of Object.entries(ROUTES)) {
    const path = new T3.CurvePath();
    for (let i = 1; i < pts.length; i++) path.add(new T3.LineCurve3(new T3.Vector3(pts[i - 1][0], 0.1, pts[i - 1][1]), new T3.Vector3(pts[i][0], 0.1, pts[i][1])));
    routeCurve[k] = { path, len: path.getLength() };
  }

  // ---------- camera control (drag-to-pan, report section 3.0b) ----------
  // HOME is the one place the overview looks at. Zoomed in means want.dist < 0.8 x fitDist, decided at pointer-down:
  // then a plain drag moves the view. Right-drag, Shift-drag and a two-finger twist turn it; wheel and pinch zoom
  // toward the pointer. The target may only wander as far as the zoom allows, so zooming out eases it home.
  const HOME = { x: -10, z: -20, az: 0.78, el: 0.6 };
  const MIN_DIST = 120;
  const EL_MIN = 0.28, EL_MAX = 1.25;
  const PAUSE_MS = 10000;
  const view = { az: HOME.az, el: HOME.el, dist: 640, target: new T3.Vector3(HOME.x, 0, HOME.z) };
  const want = { az: HOME.az, el: HOME.el, dist: 640, target: new T3.Vector3(HOME.x, 0, HOME.z) };
  const safe = { x: 0, y: 0, w: 1, h: 1, W: 1, Ht: 1 };
  let fitDist = 640;
  let attract = true;
  let manualAt = -Infinity;
  let zoomedNow = false;
  const isZoomed = () => want.dist < 0.8 * fitDist;
  function bounds() {
    const f = Math.max(0, 1 - want.dist / fitDist), rx = 250 * f, rz = 175 * f;
    return { x0: Math.max(TILE.x0 + 20, HOME.x - rx), x1: Math.min(TILE.x1 - 20, HOME.x + rx), z0: Math.max(TILE.z0 + 20, HOME.z - rz), z1: Math.min(TILE.z1 - 20, HOME.z + rz) };
  }
  function clampTarget() {
    const b = bounds(), t = want.target;
    t.x = Math.min(b.x1, Math.max(b.x0, t.x));
    t.z = Math.min(b.z1, Math.max(b.z0, t.z));
  }
  function notifyMode() {
    const z = isZoomed();
    canvas.toggleAttribute("data-zoomed", z);
    if (z === zoomedNow) return;
    zoomedNow = z;
    onMode?.(z);
  }
  function manual() { manualAt = performance.now(); attract = false; }
  // Move by a screen distance in pixels; the ground stays under the pointer.
  function pan(dx, dy) {
    const s = (2 * want.dist * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, canvas.clientHeight);
    const k = 1 / Math.sin(view.el), sa = Math.sin(view.az), ca = Math.cos(view.az), t = want.target;
    t.x += (-dx * ca - dy * sa * k) * s;
    t.z += (dx * sa - dy * ca * k) * s;
    clampTarget();
    manual();
    kick();
  }
  const ray = new T3.Raycaster(), ndc = new T3.Vector2(), ground = new T3.Plane(new T3.Vector3(0, 1, 0), 0), hitPt = new T3.Vector3();
  // The camera as it will be once it settles, so quick drags and wheel turns anchor to the right spot.
  const scratch = new T3.PerspectiveCamera();
  function wantCamera() {
    scratch.copy(camera, false);
    const ce = Math.cos(want.el);
    scratch.position.set(want.target.x + Math.sin(want.az) * ce * want.dist, want.target.y + Math.sin(want.el) * want.dist, want.target.z + Math.cos(want.az) * ce * want.dist);
    scratch.lookAt(want.target);
    scratch.updateMatrixWorld(true);
    return scratch;
  }
  function groundAt(cx, cy, cam = camera) {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(ground, hitPt);
  }
  // A drag from (x0, y0) to (x1, y1): the ground point under the pointer stays under it.
  function dragMove(x0, y0, x1, y1) {
    const cam = wantCamera();
    const a = groundAt(x0, y0, cam)?.clone();
    const b = a && groundAt(x1, y1, cam);
    if (!a || !b) { pan(x1 - x0, y1 - y0); return; }
    want.target.x += a.x - b.x;
    want.target.z += a.z - b.z;
    clampTarget();
    manual();
    kick();
  }
  // Zoom by a factor (below 1 zooms in), toward the ground under (cx, cy) when given.
  function zoomBy(factor, cx, cy) {
    const d0 = want.dist;
    const d1 = Math.min(fitDist * 1.4, Math.max(MIN_DIST, d0 * factor));
    const p = cx != null ? groundAt(cx, cy, wantCamera())?.clone() : null;
    want.dist = d1;
    {
      if (p) {
        const a = 1 - d1 / d0;
        want.target.x += (p.x - want.target.x) * a;
        want.target.z += (p.z - want.target.z) * a;
      }
    }
    clampTarget();
    manual();
    notifyMode();
    kick();
  }
  function turn(daz, del) {
    want.az += daz;
    want.el = Math.min(EL_MAX, Math.max(EL_MIN, want.el + del));
    manual();
    kick();
  }

  const pointers = new Map();
  let placeMode = false;
  let placeCb = null;
  // The current drag. It is re-baselined whenever the number of fingers changes, so lifting one finger
  // after a pinch does not swing the view (I16).
  let gesture = null;
  function baseline() {
    const pts = [...pointers.values()];
    if (!pts.length) { gesture = null; return; }
    const mode1 = gesture?.mode1 || "turn";
    if (pts.length === 1) {
      const p = pts[0];
      gesture = { mode1, mode: mode1, x: p.x, y: p.y, lx: p.x, ly: p.y, az: want.az, el: want.el };
    } else {
      const [a, b] = pts;
      gesture = { mode1, mode: "multi", mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
    }
  }
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button === 1) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* the pointer may already be gone */ }
    // The mode is fixed at pointer-down and does not change mid-drag.
    // While siting a piece, a plain drag moves the footprint. Right-drag, Shift-drag and two fingers still turn.
    const siting = placeMode && placeCb && e.button === 0 && !e.shiftKey;
    if (!pointers.size) gesture = { mode1: e.button === 2 || e.shiftKey ? "turn" : siting ? "place" : isZoomed() ? "move" : "turn" };
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    baseline();
    attract = false;
    if (gesture?.mode === "place") {
      const p = groundAt(e.clientX, e.clientY);
      if (p) placeCb({ type: "down", x: p.x, z: p.z });
    }
    kick();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.mode === "multi") {
      const [a, b] = [...pointers.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      let dAng = ang - gesture.ang;
      if (dAng > Math.PI) dAng -= 2 * Math.PI;
      if (dAng < -Math.PI) dAng += 2 * Math.PI;
      if (isZoomed()) dragMove(gesture.mx, gesture.my, mx, my);
      if (d > 0 && gesture.d > 0) zoomBy(gesture.d / d, mx, my);
      if (Math.abs(dAng) < 0.5) turn(dAng, 0);
      Object.assign(gesture, { mx, my, d, ang });
      return;
    }
    if (gesture.mode === "place") {
      const p = groundAt(e.clientX, e.clientY);
      if (p && placeCb) placeCb({ type: "move", x: p.x, z: p.z });
      gesture.lx = e.clientX;
      gesture.ly = e.clientY;
      return;
    }
    if (gesture.mode === "move") {
      dragMove(gesture.lx, gesture.ly, e.clientX, e.clientY);
      gesture.lx = e.clientX;
      gesture.ly = e.clientY;
      return;
    }
    want.az = gesture.az - (e.clientX - gesture.x) * 0.006;
    want.el = Math.min(EL_MAX, Math.max(EL_MIN, gesture.el + (e.clientY - gesture.y) * 0.004));
    manual();
    kick();
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const wasPlace = gesture?.mode === "place";
    const start = gesture;
    const p = wasPlace ? groundAt(e.clientX, e.clientY) : null;
    const tap = !!(wasPlace && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 14);
    pointers.delete(e.pointerId);
    baseline();
    if (wasPlace && placeCb && p) placeCb({ type: "up", x: p.x, z: p.z, tap });
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    zoomBy(Math.exp(Math.max(-200, Math.min(200, dy)) * 0.0012), e.clientX, e.clientY);
  }, { passive: false });
  const STEP_PX = 80;
  // The on-screen buttons and the keys share these actions. Moving the view applies only when zoomed in.
  function act(name) {
    switch (name) {
      case "in": zoomBy(0.8); break;
      case "out": zoomBy(1 / 0.8); break;
      case "left": turn(0.2, 0); break;
      case "right": turn(-0.2, 0); break;
      case "up": turn(0, 0.08); break;
      case "down": turn(0, -0.08); break;
      case "panL": if (isZoomed()) pan(STEP_PX, 0); break;
      case "panR": if (isZoomed()) pan(-STEP_PX, 0); break;
      case "panU": if (isZoomed()) pan(0, STEP_PX); break;
      case "panD": if (isZoomed()) pan(0, -STEP_PX); break;
      case "reset": resetView(); break;
      default: return false;
    }
    return true;
  }
  canvas.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    const arrow = { ArrowLeft: "L", ArrowRight: "R", ArrowUp: "U", ArrowDown: "D" }[k];
    // While siting, arrow keys nudge the footprint (handled by the game) instead of turning the view.
    if (placeMode && arrow && !e.shiftKey) { e.preventDefault(); return; }
    let name = "";
    if (arrow && e.shiftKey) name = `pan${arrow}`;
    else if (arrow) name = { L: "left", R: "right", U: "up", D: "down" }[arrow];
    else if (k === "+" || k === "=") name = "in";
    else if (k === "-" || k === "_") name = "out";
    else return;
    e.preventDefault();
    act(name);
  });

  function resize() {
    const W = canvas.clientWidth, Ht = canvas.clientHeight;
    if (!W || !Ht) return;
    renderer.setSize(W, Ht, false);
    camera.aspect = W / Ht;
    // Centre the campus in the open area between the panels.
    const cx = safe.x + safe.w / 2, cy = safe.y + safe.h / 2;
    camera.setViewOffset(W, Ht, W / 2 - cx, Ht / 2 - cy, W, Ht);
    const vf = (camera.fov * Math.PI) / 180;
    const openH = Math.max(120, safe.h), openW = Math.max(160, safe.w);
    const vHalf = Math.tan(vf / 2) * (openH / Ht);
    const hHalf = vHalf * (openW / openH);
    fitDist = Math.max(250 / hHalf, 175 / vHalf);
    if (!fitted || Math.abs(want.dist - lastFit) < 1) { want.dist = fitDist; view.dist = view.dist || fitDist; }
    lastFit = fitDist;
    fitted = true;
    clampTarget();
    notifyMode();
    camera.updateProjectionMatrix();
    kick();
  }
  let fitted = false, lastFit = 0;

  // ---------- visibility and rise ----------
  let firstApply = true;
  function apply(isVisible, animate = true) {
    // Shadows are drawn again only when a part comes or goes: a hover on a Neighbors row repaints the scene but
    // changes no part (FE-3).
    let changed = firstApply;
    for (const g of groups) {
      const on = isVisible(g.userData);
      if (on && !g.visible && animate && !firstApply && !reduced()) {
        g.userData.rise = 0;
        g.userData.riseT = 0;
      }
      if (g.visible !== on) changed = true;
      g.visible = on;
    }
    firstApply = false;
    if (changed) renderer.shadowMap.needsUpdate = true;
    kick();
  }
  function overlays(state) {
    ov.visible = state.on;
    for (const [name, g] of Object.entries(OV)) {
      const s = state.layers[name] || { on: false, level: 0 };
      g.visible = s.on;
      g.userData.level = s.level;
      g.userData.hot = state.focus ? (state.focus.includes(name) ? 1.6 : 0.15) : 1;
    }
    trucks.count = state.on ? state.trucks : 0;
    trucks.route = state.route;
    const tw = groups.find((q) => q.userData.show === "transmission");
    if (tw && tw.userData.wires) for (const w of tw.userData.wires) { w.material.color.set(state.on && state.layers.power?.on ? "#d65db1" : "#2c3034"); w.material.emissive?.set(state.on && state.layers.power?.on ? "#5a1d48" : "#000000"); }
    kick();
  }
  // Where a placed element sits, for the camera and the floating tag.
  function boundsOf(id) {
    const box3 = new T3.Box3();
    for (const g of groups) if (g.userData.show === id && g.visible) box3.expandByObject(g);
    return box3.isEmpty() ? null : box3;
  }
  // The game frames a placed part or a hovered panel row, but never right after the player moved the view,
  // and never past the bounds the current zoom allows (at the overview that means it stays home).
  function aim(x, z) {
    attract = false;
    if (performance.now() - manualAt < PAUSE_MS) { kick(); return; }
    want.target.set(x, 0, z);
    clampTarget();
    kick();
  }
  function focus(id) {
    const b = boundsOf(id);
    if (!b || reduced()) return;
    const c = b.getCenter(new T3.Vector3());
    aim(c.x * 0.55 + HOME.x * 0.45, c.z * 0.55 + HOME.z * 0.45);
  }
  function screenOf(id) {
    const b = boundsOf(id);
    if (!b) return null;
    const p = new T3.Vector3((b.min.x + b.max.x) / 2, b.max.y + 3, (b.min.z + b.max.z) / 2).project(camera);
    if (p.z > 1) return null;
    return [((p.x + 1) / 2) * canvas.clientWidth, ((1 - p.y) / 2) * canvas.clientHeight];
  }
  function resetView() {
    Object.assign(want, { az: HOME.az, el: HOME.el, dist: fitDist });
    want.target.set(HOME.x, 0, HOME.z);
    manualAt = -Infinity;
    notifyMode();
    kick();
  }

  // ---------- frame loop ----------
  const clock = new T3.Clock();
  let ledT = 0;
  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const still = reduced();
    const time = clock.elapsedTime;
    if (attract && !still) want.az += dt * 0.05;
    const k = still ? 1 : 1 - Math.exp(-dt * 5);
    view.az += (want.az - view.az) * k;
    view.el += (want.el - view.el) * k;
    view.dist += (want.dist - view.dist) * k;
    view.target.lerp(want.target, k);
    const ce = Math.cos(view.el);
    camera.position.set(view.target.x + Math.sin(view.az) * ce * view.dist, view.target.y + Math.sin(view.el) * view.dist, view.target.z + Math.cos(view.az) * ce * view.dist);
    camera.lookAt(view.target);
    sun.target.position.copy(view.target);
    sun.position.set(view.target.x - 170, 300, view.target.z + 190);

    let rising = false;
    for (const g of groups) {
      const u = g.userData;
      if (u.rise < 1) {
        rising = true;
        u.riseT += dt;
        const t = Math.min(1, u.riseT / 0.75);
        const e = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
        if (u.drop) { g.position.y = (1 - t) * 30; g.scale.y = 1; }
        else g.scale.y = Math.max(0.001, e);
        if (t >= 1) { u.rise = 1; g.scale.y = 1; g.position.y = 0; }
      }
    }
    if (rising) renderer.shadowMap.needsUpdate = true;
    if (!still) {
      for (const f of fans) f.rotation.y += dt * 9;
      ledT += dt;
      if (ledT > 0.35) { ledT = 0; MAT.racks.emissiveMap.offset.x = (MAT.racks.emissiveMap.offset.x + 0.0625) % 1; }
      MAT.water.normalMap.offset.set(time * 0.01, time * 0.006);
    }
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.2);
    MAT.beacon.emissiveIntensity = still ? 2 : 1.2 + 1.6 * pulse;
    for (const g of Object.values(OV)) {
      if (!g.visible) continue;
      const u = g.userData;
      for (const map of u.maps || []) if (!still) map.offset.x -= dt * 1.4;
      g.traverse((o) => { if (o.material && o.material.userData.base === undefined) o.material.userData.base = o.material.opacity; if (o.material) o.material.opacity = Math.min(1, o.material.userData.base * u.hot); });
      if (u.rings) {
        const rMax = u.name === "noise" ? 70 + 40 * u.level : 22 + 18 * u.level;
        const n = Math.max(1, Math.min(5, u.level + 1));
        u.rings.forEach((m, i) => {
          m.visible = i < n;
          const ph = still ? (i + 1) / (n + 1) : ((time * 0.18 + i / n) % 1);
          const r = 8 + ph * rMax;
          m.scale.set(r, r, 1);
          m.material.opacity = Math.min(1, (1 - ph) * 0.75 * u.hot);
        });
      }
      if (u.pts) {
        const pos = u.pts.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const s = u.seeds[i];
          if (u.name === "plume") {
            const life = still ? s : (time * 0.12 + s) % 1;
            const h = u.home;
            pos.setXYZ(i, h[i * 3] + Math.sin(s * 40 + life * 3) * life * 6, 11 + life * 30, h[i * 3 + 2] + Math.cos(s * 30) * life * 6);
          } else {
            const h = u.home;
            const life = still ? s : (time * 0.08 + s) % 1;
            pos.setXYZ(i, h[i * 3] + life * 18, 1 + life * 16, h[i * 3 + 2] - life * 6);
          }
        }
        pos.needsUpdate = true;
        u.pts.material.opacity = (u.name === "dust" ? 0.18 + 0.12 * u.level : 0.38) * Math.min(1, u.hot);
      }
    }
    const rc = routeCurve[trucks.route] || routeCurve.a;
    if (!still && trucks.count) trucks.t += dt * 16;
    truckSet.forEach((t, i) => {
      t.visible = i < trucks.count;
      if (!t.visible) return;
      const u = ((trucks.t / rc.len) + i / Math.max(1, trucks.count)) % 1;
      const p = rc.path.getPointAt(u);
      const q = rc.path.getPointAt(Math.min(1, u + 0.002));
      t.position.copy(p);
      t.rotation.y = Math.atan2(-(q.z - p.z), q.x - p.x);
    });
    renderer.render(scene, camera);
  }
  let running = false;
  let raf = 0;
  let lastDraw = 0;
  const shown = (obj) => {
    let n = obj;
    while (n) { if (!n.visible) return false; n = n.parent; }
    return true;
  };
  // Held while a dialog covers the map (issue cards, the end screen, About): a change still draws its one frame, but
  // the fans, trucks and rings stop redrawing behind the backdrop (BTC-UX-20).
  let held = false;
  function needsFrame() {
    if (document.hidden || held) return false;
    if (attract && !reduced()) return true;
    if (gesture || pointers.size) return true;
    if (Math.abs(want.az - view.az) > 0.001) return true;
    if (Math.abs(want.el - view.el) > 0.001) return true;
    if (Math.abs(want.dist - view.dist) > 0.5) return true;
    if (view.target.distanceTo(want.target) > 0.5) return true;
    if (groups.some((g) => g.visible && g.userData.rise < 1)) return true;
    // With reduced motion the fans, effect rings and trucks stand still, so once drawn the frame does not change
    // (FE-3): the loop stops instead of redrawing it.
    if (reduced()) return false;
    if (fans.some(shown)) return true;
    if (ov.visible && Object.values(OV).some((g) => g.visible)) return true;
    if (trucks.count > 0) return true;
    return false;
  }
  function kick() {
    if (document.hidden || lost || gl.isContextLost()) return;
    if (running) return;
    running = true;
    clock.getDelta();
    lastDraw = 0;
    raf = requestAnimationFrame(loop);
  }
  // The camera is still easing, the player is dragging, or a part is rising: draw every frame then.
  function moving() {
    if (gesture || pointers.size) return true;
    if (Math.abs(want.az - view.az) > 0.001 || Math.abs(want.el - view.el) > 0.001) return true;
    if (Math.abs(want.dist - view.dist) > 0.5 || view.target.distanceTo(want.target) > 0.5) return true;
    return groups.some((g) => g.visible && g.userData.rise < 1);
  }
  function loop(now) {
    if (!running) return;
    // The context can be lost a few hundred milliseconds before its event arrives. Drawing then threw from inside
    // three.js (a new shader's log is null on a lost context), so the loop stops here (FE-1, QL-3).
    if (gl.isContextLost()) { stop(); return; }
    // Idle animation (the slow intro turn, fans, trucks, effect rings) runs at 30 frames a second at most.
    const cap = (attract && !gesture) || !moving() ? 1000 / 30 : 0;
    if (cap && lastDraw && now - lastDraw < cap - 1) { raf = requestAnimationFrame(loop); return; }
    lastDraw = now || performance.now();
    // A frame that throws ends the loop instead of leaving it marked as running, which kept kick() from ever
    // starting it again and left the map frozen for the rest of the game (FE-1).
    let more = false;
    try {
      frame();
      more = needsFrame();
    } finally {
      if (more) raf = requestAnimationFrame(loop);
      else running = false;
    }
  }
  function start() { kick(); }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : kick()));
  new ResizeObserver(resize).observe(canvas);

  // Footprints drawn while the player sites a piece. Not part of the tagged groups, so apply() leaves them alone.
  // The piece being sited has a dark outline, and a spot that does not fit is striped as well as red, so neither
  // the footprint against the ground nor fits against does-not-fit depends on colour alone (AS-1, WCAG 1.4.1, 1.4.11).
  const ghost = new T3.Group();
  scene.add(ghost);
  const hatch = canvasTex(32, 32, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) if (((i % w) + Math.floor(i / w)) % w < w / 2) img.data.fill(255, i * 4, i * 4 + 4);
    g.putImageData(img, 0, 0);
  });
  const ghostMat = {
    ok: new T3.MeshBasicMaterial({ color: "#1f8a5b", transparent: true, opacity: 0.45, depthWrite: false }),
    bad: new T3.MeshBasicMaterial({ color: "#c2452a", map: hatch, transparent: true, opacity: 0.85, depthWrite: false }),
    set: new T3.MeshBasicMaterial({ color: "#163a30", transparent: true, opacity: 0.22, depthWrite: false }),
    line: new T3.MeshBasicMaterial({ color: "#00a37a", transparent: true, opacity: 0.95, depthWrite: false }),
    edge: new T3.MeshBasicMaterial({ color: "#10261d" }),
  };
  const EDGE = 2;
  const STRIPE = 8;
  function clearGhost() {
    for (const c of [...ghost.children]) { c.geometry?.dispose(); ghost.remove(c); }
  }
  function setFootprints(items) {
    clearGhost();
    for (const item of items || []) {
      const mat = ghostMat[item.tone] || ghostMat.set;
      for (const r of item.rects || []) {
        const w = Math.max(0.5, r.w), h = Math.max(0.5, r.h);
        const geo = new T3.PlaneGeometry(w, h);
        // Stripes keep the same spacing in metres on every footprint.
        if (mat.map) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / STRIPE, (uv.getY(i) * h) / STRIPE); }
        const m = new T3.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(r.x + r.w / 2, item.tone === "set" ? 0.22 : 0.4, r.z + r.h / 2);
        ghost.add(m);
        if (item.tone === "set") continue;
        for (const [ew, eh, ex, ez] of [[w + EDGE, EDGE, 0, -h / 2], [w + EDGE, EDGE, 0, h / 2], [EDGE, h, -w / 2, 0], [EDGE, h, w / 2, 0]]) {
          const e = new T3.Mesh(new T3.PlaneGeometry(ew, eh), ghostMat.edge);
          e.rotation.x = -Math.PI / 2;
          e.position.set(r.x + r.w / 2 + ex, 0.45, r.z + r.h / 2 + ez);
          ghost.add(e);
        }
      }
      if (item.setback) {
        const line = new T3.Mesh(new T3.PlaneGeometry(454, 1.4), ghostMat.line);
        line.rotation.x = -Math.PI / 2;
        line.position.set(-15, 0.5, 92);
        ghost.add(line);
      }
    }
    ghost.visible = ghost.children.length > 0;
    kick();
  }
  function setShifts(map) {
    let changed = false;
    for (const g of groups) {
      const id = g.userData.shift;
      if (!id) continue;
      const d = (map && map[id]) || { x: 0, z: 0 };
      if (g.position.x !== d.x || g.position.z !== d.z) { g.position.x = d.x; g.position.z = d.z; changed = true; }
    }
    if (changed) { renderer.shadowMap.needsUpdate = true; kick(); }
  }
  function setPlaceMode(on, cb) {
    placeMode = !!on;
    placeCb = on ? cb : null;
    canvas.toggleAttribute("data-placing", placeMode);
    kick();
  }

  return {
    apply,
    overlays,
    setShifts,
    setFootprints,
    setPlaceMode,
    focus,
    screenOf,
    resetView,
    setSafe(r) { Object.assign(safe, r); resize(); },
    setAttract(v) { if (v) resetView(); attract = v; kick(); },
    hold(on) { const was = held; held = !!on; if (was && !held) kick(); },
    act,
    zoomed: isZoomed,
    refreshSigns() {
      const src = signLines();
      const swap = (mat, map) => { if (!mat) return; const old = mat.map; mat.map = map; mat.needsUpdate = true; old?.dispose(); };
      swap(signMats.notice, textTex([[src[0], 56, 800], [src[1], 40, 600]]));
      swap(signMats.campus, textTex([[src[2], 72, 800]], { w: 512, h: 160, bg: "#163a30", fg: "#f7f4ee", accent: "#e69f00" }));
      renderer.shadowMap.needsUpdate = true;
      kick();
    },
    lookAt(x, z) { aim(x * 0.6 + HOME.x * 0.4, z * 0.6 + HOME.z * 0.4); },
    setView(o) { if (o.az != null) want.az = o.az; if (o.el != null) want.el = o.el; if (o.dist != null) want.dist = o.dist; if (o.x != null) want.target.set(o.x, 0, o.z); clampTarget(); manual(); notifyMode(); kick(); },
    // For checks: where the camera is headed, and the bounds it may move within.
    cam: () => ({ az: want.az, el: want.el, dist: want.dist, x: want.target.x, z: want.target.z, vx: view.target.x, vz: view.target.z, vdist: view.dist, vaz: view.az, vel: view.el, fitDist, zoomed: isZoomed(), bounds: bounds(), manualAt }),
    groundAt: (cx, cy) => { const p = groundAt(cx, cy); return p ? { x: p.x, z: p.z } : null; },
    start,
    renderOnce: frame,
    meshes: () => { const out = {}; scene.traverse((o) => { if (o.isMesh && o.visible) { let g = o; while (g.parent && g.parent !== scene) g = g.parent; const k = (g.userData && g.userData.key) || g.type; const m = Array.isArray(o.material) ? 'multi' : (o.material.transparent ? 'T' : '') + o.material.type.slice(4, 9); out[k] = out[k] || {}; out[k][m] = (out[k][m] || 0) + 1; } }); return out; },
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), lowQ }),
  };
}
