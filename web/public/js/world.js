// Draws the four biomes and Base Camp: terrain, lakes and ice, trees, rocks, ore, food, the trading post, everyone's
// shelters, supply crates, the day/night sky and the weather. Every texture is painted on a canvas — nothing to download.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MAPS, CAMP, rng } from './maps.js';
import { Googly, textSprite } from './googly.js';

const std = o => new THREE.MeshStandardMaterial(o);
const phys = o => new THREE.MeshPhysicalMaterial(o);
const texCache = new Map();
function tex(key, w, h, draw, rep = [1, 1]) {
  let base = texCache.get(key);
  if (!base) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    base = new THREE.CanvasTexture(c); base.colorSpace = THREE.SRGBColorSpace; base.anisotropy = 8;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    texCache.set(key, base);
  }
  if (rep[0] === 1 && rep[1] === 1) return base;
  const t = base.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true;
  return t;
}
const speck = (g, w, h, n, cols, s = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(Math.random() * w, Math.random() * h, s, s); } };
const T = {
  grain: rep => tex('grain', 256, 256, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); speck(g, w, h, 9000, ['#e8e8e8', '#d4d4d4', '#f6f6f6', '#c8c8c8'], 2); }, rep),
  bark: rep => tex('bark', 128, 256, (g, w, h) => { g.fillStyle = '#6a4a2e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = i % 2 ? '#4a321e' : '#7e5a3a'; g.lineWidth = 2 + Math.random() * 4; g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 8, h / 3, x - 8, h * 2 / 3, x + Math.random() * 6, h); g.stroke(); } }, rep),
  planks: rep => tex('planks', 256, 256, (g, w, h) => { for (let y = 0; y < h; y += 32) { const tone = 120 + Math.random() * 40; g.fillStyle = `rgb(${tone + 40},${tone * 0.72},${tone * 0.45})`; g.fillRect(0, y, w, 31); g.fillStyle = '#3a2412'; g.fillRect(0, y + 31, w, 1); for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(60,35,15,.25)'; g.beginPath(); g.moveTo(0, y + Math.random() * 30); g.lineTo(w, y + Math.random() * 30); g.stroke(); } } }, rep),
  logs: rep => tex('logs', 256, 256, (g, w, h) => { for (let y = 0; y < h; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, '#5a3a1e'); gr.addColorStop(0.5, '#9a6a3e'); gr.addColorStop(1, '#4a2e16'); g.fillStyle = gr; g.fillRect(0, y, w, 32); } speck(g, w, h, 600, ['#00000022', '#ffffff14'], 3); }, rep),
  clay: rep => tex('clay', 256, 256, (g, w, h) => { g.fillStyle = '#c98a5a'; g.fillRect(0, 0, w, h); speck(g, w, h, 5000, ['#b87a4a', '#d89a6a', '#a86a3a', '#e0a878'], 3); for (let i = 0; i < 8; i++) { g.strokeStyle = '#9a5a3066'; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) g.lineTo(x += (Math.random() - 0.5) * 30, y += Math.random() * 20); g.stroke(); } }, rep),
  bricks: (rep, a = '#8a8a8e', b = '#6a6a70') => tex('bricks' + a, 256, 256, (g, w, h) => { g.fillStyle = '#3a3a3e'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = ((y / 32) % 2) * -32; x < w; x += 64) { g.fillStyle = Math.random() < 0.5 ? a : b; g.fillRect(x + 2, y + 2, 60, 28); } speck(g, w, h, 1500, ['#00000022', '#ffffff18'], 3); }, rep),
  ice: rep => tex('iceblk', 256, 256, (g, w, h) => { g.fillStyle = '#cfeaf8'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 64) for (let x = ((y / 64) % 2) * -64; x < w; x += 128) { g.strokeStyle = '#9ccbe4'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, 124, 60); } speck(g, w, h, 800, ['#ffffff66', '#a8d8f066'], 3); }, rep),
  stripes: () => tex('stripes', 256, 64, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#fff4e0' : '#d8342c'; g.fillRect(x, 0, 32, h); } }),
  sign: (text, bg = '#6a4a2e', fg = '#ffe8a0', w = 1024, h = 256) => tex('sign' + text + bg, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 42) { g.fillStyle = '#00000022'; g.fillRect(0, y, w, 2); }
    g.strokeStyle = '#2a1a0a'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
    g.font = `900 ${Math.floor(h * 0.5)}px "Futura", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#0006'; g.fillText(text, w / 2 + 6, h / 2 + 8); g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 2);
  }),
  canvasTent: col => tex('tent' + col, 128, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 4) { g.fillStyle = '#00000010'; g.fillRect(i, 0, 1, h); g.fillRect(0, i, w, 1); } }),
};

// ------------------------------------------------------------------ terrain colours per biome
const C = (h) => new THREE.Color(h);
const PAL = {
  snow: { a: C('#f4f8fc'), b: C('#dbe8f2'), c: C('#c4d6e6'), rock: C('#8a96a4') },
  sand: { a: C('#f0d29a'), b: C('#e2b878'), c: C('#c89a5e'), rock: C('#b0784a') },
  grass: { a: C('#5e9a3a'), b: C('#4a8030'), c: C('#7a6a40'), rock: C('#7a7a70') },
  alpine: { a: C('#6a9a44'), b: C('#58803a'), c: C('#8a8478'), rock: C('#7c7a76'), snow: C('#f2f6fa') },
};

export class World {
  constructor(canvas) {
    this.lq = /lq=1/.test(location.search);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.lq, powerPreference: 'high-performance', preserveDrawingBuffer: /shot|icon/.test(location.search) });
    this.renderer.setPixelRatio(this.lq ? 0.6 : Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.lq;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 600);
    this.canvas = canvas;
    // lights that live across maps
    this.hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5a4a3a, 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.flash = new THREE.PointLight(0xdfe8ff, 0, 120, 1.2); this.scene.add(this.flash);
    this.makeSky();
    this.parts = []; this.mapId = -1; this.focus = new THREE.Vector3();
    this.nightK = 0; this.stormK = 0; this.stormWant = 0; this.flashT = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    new ResizeObserver(() => this.resize()).observe(canvas);
  }
  resize() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  makeSky() {
    this.skyU = { top: { value: new THREE.Color('#6aa8e0') }, bot: { value: new THREE.Color('#d8ecf4') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff') }, night: { value: 0 } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; varying vec3 vd;
        void main(){ float h = clamp(vd.y*1.4+0.1,0.0,1.0); vec3 c = mix(bot, top, pow(h,0.8));
          float s = max(dot(vd, sunDir),0.0); c += sunCol * (pow(s, 900.0)*3.0 + pow(s, 12.0)*0.25) * (1.0-night);
          vec3 md = -sunDir; float m = max(dot(vd, md),0.0); c += vec3(0.9,0.95,1.0) * pow(m, 1400.0) * 2.0 * night;
          gl_FragColor = vec4(c,1.0); }`,
    }));
    sky.renderOrder = -10; this.sky = sky; this.scene.add(sky);
    // stars
    const n = 900, pos = new Float32Array(n * 3), r = rng(5);
    for (let i = 0; i < n; i++) { const a = r() * 6.283, y = r() * 0.9 + 0.08, s = Math.sqrt(1 - y * y); pos.set([Math.cos(a) * s * 480, y * 480, Math.sin(a) * s * 480], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
  }
  clear() {
    if (this.level) { this.scene.remove(this.level); this.level.traverse(o => { o.geometry?.dispose?.(); }); }
    if (this.weather) { this.scene.remove(this.weather); this.weather = null; }
    this.parts = []; this.nodeViews = []; this.plotViews = []; this.fires = []; this.crates = new Map(); this.pickups = new Map(); this.zaps = []; this.flags = []; this.fish = [];
  }

  // ------------------------------------------------------------------ build a map
  load(id) {
    if (this.mapId === id && this.level) { for (const o of [...this.actors.children]) this.actors.remove(o); return this.map; }
    this.clear();
    this.mapId = id;
    const map = this.map = MAPS[id];
    const L = this.level = new THREE.Group(); this.scene.add(L);
    this.fx = new THREE.Group(); L.add(this.fx);
    this.actors = new THREE.Group(); L.add(this.actors);
    this.terrain(L, map);
    for (const l of map.lakes) this.lake(L, map, l);
    if (id === CAMP) this.camp(L, map);
    else {
      this.post(L, map);
      this.nodeViews = map.nodes.map(n => this.node(L, map, n));
      this.plotViews = map.plots.map(pl => this.plot(L, map, pl));
      this.backdrop(L, map);
    }
    this.makeWeather(map);
    L.traverse(o => { if (o.isMesh && !o.userData.noShadow) { o.receiveShadow = true; } });
    this.setTime(20, 0);
    return map;
  }
  terrain(L, map) {
    const size = map.W + 140, seg = this.lq ? 90 : 200;
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), P = PAL[map.ground], r = rng(map.seed || 9), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = map.h(x, z);
      pos.setY(i, y);
      const sl = map.slope(x, z), n = (Math.sin(x * 0.31 + z * 0.17) + Math.sin(x * 0.07 - z * 0.23) * 1.5) * 0.25 + (r() - 0.5) * 0.25;
      tmp.copy(P.a).lerp(P.b, Math.min(1, Math.max(0, 0.5 + n)));
      if (map.ground === 'sand') tmp.lerp(P.c, Math.min(1, Math.max(0, (1.2 - y) * 0.25)));
      if (map.ground === 'grass' || map.ground === 'alpine') tmp.lerp(P.c, Math.min(0.8, Math.max(0, sl - 0.35) * 1.4 + Math.max(0, n - 0.3)));
      tmp.lerp(P.rock, Math.min(1, Math.max(0, (sl - 0.6) * 1.6)));
      if (map.ground === 'alpine') tmp.lerp(P.snow, Math.min(1, Math.max(0, (y - 9.5) / 2.5 - sl * 0.5)));
      if (map.ground === 'snow') tmp.lerp(P.c, Math.min(0.6, Math.max(0, n * 0.8)));
      for (const l of map.lakes) { const d = Math.hypot(x - l.x, z - l.z); if (d < l.r + 2.5) tmp.lerp(map.ground === 'snow' ? P.c : map.ground === 'sand' ? C('#8a7a4a') : C('#5a4a30'), Math.min(0.7, (l.r + 2.5 - d) / 3)); }
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ vertexColors: true, map: T.grain([size / 6, size / 6]), roughness: map.ground === 'snow' ? 0.55 : 0.95, metalness: 0 }));
    m.receiveShadow = true; L.add(m);
    // grass tufts and pebbles for texture close up
    if (map.ground === 'grass' || map.ground === 'alpine') this.tufts(L, map, 2200, 0x4f8a2e, 0.45);
    if (map.ground === 'sand') this.tufts(L, map, 350, 0xa89a50, 0.35);
    if (map.ground === 'snow') this.tufts(L, map, 250, 0x8a9a7a, 0.25);
  }
  tufts(L, map, n, color, hgt) {
    const geo = new THREE.ConeGeometry(0.035, hgt * 0.55, 3); geo.translate(0, hgt * 0.275, 0);
    const im = new THREE.InstancedMesh(geo, std({ color, roughness: 1 }), n), r = rng(77), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const x = (r() - 0.5) * (map.W - 8), z = (r() - 0.5) * (map.D - 8);
      if (map.wetAt(x, z) || map.slope(x, z) > 0.7 || (map.ground === 'alpine' && map.h(x, z) > 9)) continue;
      e.set((r() - 0.5) * 0.5, r() * 6, (r() - 0.5) * 0.5); q.setFromEuler(e);
      const s = 0.5 + r() * 0.6;
      M.compose(new THREE.Vector3(x, map.h(x, z) - 0.02, z), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(k++, M);
    }
    im.count = k; im.userData.noShadow = true; L.add(im);
  }
  lake(L, map, l) {
    const ice = map.water?.ice;
    const m = new THREE.Mesh(new THREE.CircleGeometry(l.r + 1.2, 48), ice
      ? phys({ color: 0xcfe8f6, roughness: 0.12, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.92 })
      : phys({ color: map.water.color, roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.82, clearcoat: 1 }));
    m.rotation.x = -Math.PI / 2; m.position.set(l.x, l.level, l.z); m.userData.noShadow = true; m.userData.water = !ice;
    L.add(m);
    if (ice) {  // cracks painted on the ice
      const crack = new THREE.Mesh(new THREE.CircleGeometry(l.r, 48), new THREE.MeshBasicMaterial({ map: tex('cracks', 512, 512, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(120,170,200,.6)'; for (let i = 0; i < 26; i++) { g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) g.lineTo(x += (Math.random() - 0.5) * 90, y += (Math.random() - 0.5) * 90); g.stroke(); } }), transparent: true, depthWrite: false }));
      crack.rotation.x = -Math.PI / 2; crack.position.set(l.x, l.level + 0.01, l.z); L.add(crack);
    } else { this.water ||= []; this.water.push(m); }
  }
  // the hills beyond the edge: a ring of trees or rocks so the world doesn't just stop
  backdrop(L, map) {
    const r = rng(31), half = map.W / 2;
    const n = map.ground === 'grass' ? 160 : map.ground === 'alpine' ? 90 : map.ground === 'snow' ? 70 : 40;
    for (let i = 0; i < n; i++) {
      const a = r() * 6.283, d = half + 4 + r() * 50, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (Math.max(Math.abs(x), Math.abs(z)) < half + 2) continue;
      const y = map.h(x, z);
      if (map.ground === 'sand') { const g = this.rockMesh('sandstone', 1.4 + r() * 2.5, r); g.position.set(x, y - 0.4, z); L.add(g); }
      else { const g = this.treeMesh(map.ground === 'grass' && r() < 0.5 ? 'oak' : 'pine', map.ground !== 'grass' && (map.ground === 'snow' || y > 9), 1.2 + r() * 0.8); g.position.set(x, y - 0.3, z); L.add(g); }
    }
  }

  // ------------------------------------------------------------------ trees, rocks, ore, food
  treeMesh(v, snow, s = 1) {
    const g = new THREE.Group();
    const bark = this.barkM ||= std({ map: T.bark([1, 2]), roughness: 0.95 });
    if (v === 'pine') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.34, 2.2, 8), bark); trunk.position.y = 1.1; g.add(trunk);
      const leaf = this.pineM ||= std({ color: 0x2e5a2e, roughness: 0.9, flatShading: true });
      const snowM = this.snowM ||= std({ color: 0xf6fafc, roughness: 0.6, flatShading: true });
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.7 - i * 0.35, 1.9, 9), leaf); c.position.y = 1.9 + i * 1.05; c.rotation.y = i; g.add(c);
        if (snow) { const sc = new THREE.Mesh(new THREE.ConeGeometry(1.25 - i * 0.28, 0.9, 9), snowM); sc.position.y = 2.45 + i * 1.05; sc.rotation.y = i; g.add(sc); }
      }
    } else if (v === 'oak') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 3, 8), bark); trunk.position.y = 1.5; g.add(trunk);
      const leaf = this.oakM ||= std({ color: 0x4a8a34, roughness: 0.85, flatShading: true });
      const r = rng(Math.floor(s * 1000));
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1 + r() * 0.6, 0), leaf); b.position.set((r() - 0.5) * 2, 3.6 + r() * 1.4, (r() - 0.5) * 2); g.add(b); }
    } else if (v === 'palm') {
      let y = 0, x = 0; const seg = 7;
      for (let i = 0; i < seg; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.8, 7), this.palmBark ||= std({ color: 0x8a6a42, roughness: 0.95 })); c.position.set(x, y + 0.4, 0); c.rotation.z = -i * 0.04; g.add(c); y += 0.78; x += i * 0.03; }
      const fr = this.frondM ||= std({ color: 0x3a8a3a, roughness: 0.8, side: THREE.DoubleSide, flatShading: true });
      for (let i = 0; i < 8; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3, 4, 1, true), fr); f.scale.set(1, 1, 0.2); f.position.set(x, y, 0); f.rotation.set(0, i / 8 * 6.283, 1.9); f.translateY(1.3); g.add(f); }
      for (let i = 0; i < 3; i++) { const co = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.cocoM ||= std({ color: 0x5a3a1a })); co.position.set(x + Math.cos(i * 2) * 0.25, y - 0.2, Math.sin(i * 2) * 0.25); g.add(co); }
    } else {  // dead tree
      const dm = this.deadM ||= std({ color: 0x7a6650, roughness: 1 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 3.4, 6), dm); trunk.position.y = 1.7; g.add(trunk);
      for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, 1.4, 5), dm); b.position.set(0, 1.8 + i * 0.45, 0); b.rotation.set(0, i * 1.7, 0.9); b.translateY(0.6); g.add(b); }
    }
    g.scale.setScalar(s);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  rockMesh(v, s, r = Math.random) {
    let m;
    if (v === 'ice') {
      m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), this.iceM ||= phys({ color: 0xbfe6fa, roughness: 0.08, transmission: 0.35, thickness: 1, clearcoat: 1, transparent: true, opacity: 0.95 }));
      m.position.y = 0.75; m.rotation.y = r() * 3;
    } else if (v === 'sandstone') {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.9 - i * 0.18, 1.0 - i * 0.15, 0.5, 7), i % 2 ? (this.ss1 ||= std({ color: 0xd08a52, roughness: 1, flatShading: true })) : (this.ss2 ||= std({ color: 0xb87040, roughness: 1, flatShading: true }))); b.position.y = 0.25 + i * 0.48; b.rotation.y = r() * 3; g.add(b); }
      m = g;
    } else {
      const geo = new THREE.DodecahedronGeometry(1, 1), p = geo.attributes.position, rr = rng(Math.floor(r() * 1e6));
      for (let i = 0; i < p.count; i++) { const f = 0.8 + rr() * 0.35; p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.75, p.getZ(i) * f); }
      geo.computeVertexNormals();
      m = new THREE.Mesh(geo, this.graniteM ||= std({ color: 0x8a8884, roughness: 0.95, flatShading: true })); m.position.y = 0.55;
    }
    const g = new THREE.Group(); g.add(m); g.scale.setScalar(s);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  node(L, map, n) {
    const g = new THREE.Group(); g.position.set(n.x, n.y, n.z); g.rotation.y = n.rot; L.add(g);
    const v = { n, g, amt: -1, shake: 0 };
    if (n.type === 'tree') {
      v.full = this.treeMesh(n.v, n.snow, n.s); g.add(v.full);
      v.stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * n.s, 0.38 * n.s, 0.45, 8), std({ color: 0x8a6a42, roughness: 0.9 })); v.stump.position.y = 0.2; v.stump.castShadow = true; g.add(v.stump);
      const ring = new THREE.Mesh(new THREE.CircleGeometry(0.28 * n.s, 12), std({ color: 0xd8b888 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.43; v.stump.add(ring); ring.position.y = 0.23;
    } else if (n.type === 'rock') {
      v.full = this.rockMesh(n.v, n.s); g.add(v.full);
      if (n.snow) { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.8 * n.s, 10, 6, 0, 6.3, 0, 1.2), this.snowM ||= std({ color: 0xf6fafc, roughness: 0.6, flatShading: true })); cap.position.y = 0.95 * n.s; cap.scale.y = 0.4; v.full.add(cap); }
    } else if (n.type === 'gold') {
      v.full = this.rockMesh('granite', n.s * 0.85); g.add(v.full);
      v.nuggets = [];
      const gm = this.goldM ||= std({ color: 0xffc83a, metalness: 1, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
      for (let i = 0; i < 6; i++) { const a = i * 1.1, k = new THREE.Mesh(new THREE.OctahedronGeometry(0.16 + (i % 3) * 0.04, 0), gm); k.position.set(Math.cos(a) * 0.72 * n.s, (0.35 + (i % 3) * 0.25) * n.s, Math.sin(a) * 0.72 * n.s); k.rotation.set(i, i * 2, 0); g.add(k); v.nuggets.push(k); }
    } else if (n.v === 'berry' || n.v === 'fish' && false) {
      const bush = new THREE.Group(); g.add(bush); v.full = bush;
      const lm = this.bushM ||= std({ color: 0x3a7a2a, roughness: 0.9, flatShading: true });
      for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + (i % 2) * 0.15, 0), lm); b.position.set(Math.cos(i * 1.3) * 0.4, 0.45 + (i % 3) * 0.12, Math.sin(i * 1.3) * 0.4); b.castShadow = true; bush.add(b); }
      v.fruit = [];
      const bm = this.berryM ||= std({ color: 0xd8203a, roughness: 0.3 });
      for (let i = 0; i < 12; i++) { const a = i * 2.4, k = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bm); k.position.set(Math.cos(a) * 0.72, 0.3 + (i % 4) * 0.2, Math.sin(a) * 0.72); bush.add(k); v.fruit.push(k); }
    } else if (n.v === 'cactus') {
      const cm = this.cactusM ||= std({ color: 0x4a8a3a, roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.8, 6, 10), cm); body.position.y = 1.1; body.castShadow = true; g.add(body);
      for (const s of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(s * 0.28, 0.9 + (s > 0 ? 0.3 : 0), 0); g.add(arm); const a1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.4, 4, 8), cm); a1.rotation.z = Math.PI / 2; a1.position.x = s * 0.25; arm.add(a1); const a2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 4, 8), cm); a2.position.set(s * 0.45, 0.35, 0); a2.castShadow = true; arm.add(a2); }
      v.fruit = [];
      const fm = this.pearM ||= std({ color: 0xe8457a, roughness: 0.4 });
      for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), fm); k.position.set(Math.cos(i * 2.1) * 0.18, 2.15, Math.sin(i * 2.1) * 0.18); g.add(k); v.fruit.push(k); }
      g.scale.setScalar(n.s);
    } else if (n.v === 'fish') {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), std({ color: 0x0a2a3e, roughness: 0.1 })); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.02; g.add(hole);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.1, 6, 20), std({ color: 0xeef6fa, roughness: 0.5 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.03; g.add(rim);
      const fish = new THREE.Group(); const fb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std({ color: 0x7a9ab8, metalness: 0.5, roughness: 0.3 })); fb.scale.set(1.8, 0.8, 0.6); fish.add(fb);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), fb.material); tail.rotation.z = Math.PI / 2; tail.position.x = -0.32; fish.add(tail);
      fish.visible = false; g.add(fish); this.fish.push({ fish, v, t: Math.random() * 5 });
      v.fruit = [];
      const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9), this.barkM); sign.position.set(0.95, 0.45, 0); g.add(sign);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), std({ color: 0xff7a2a, side: THREE.DoubleSide })); flag.position.set(1.12, 0.82, 0); g.add(flag);
    }
    return v;
  }
  setNode(id, amt, hit = false) {
    const v = this.nodeViews?.[id]; if (!v) return;
    const n = v.n, max = n.type === 'tree' || n.type === 'rock' ? 5 : 3;
    if (hit) v.shake = 0.3;
    if (v.amt === amt) return;
    const was = v.amt; v.amt = amt;
    if (n.type === 'tree') { v.full.visible = amt > 0; v.stump.visible = amt <= 0; if (was > 0 && amt <= 0) { this.fallTree(v); } }
    if (n.type === 'rock') { v.full.visible = amt > 0; v.full.scale.setScalar(n.s * (0.45 + 0.55 * amt / max)); }
    if (n.type === 'gold') v.nuggets.forEach((k, i) => k.visible = i < amt * 2);
    if (v.fruit) v.fruit.forEach((k, i) => k.visible = i < Math.ceil(v.fruit.length * amt / max));
  }
  fallTree(v) {
    // a quick falling copy of the tree, then it's gone
    const copy = v.full.clone(); copy.visible = true; v.g.add(copy);
    this.parts.push({ m: copy, fall: 0, life: 1.4, v: new THREE.Vector3(), g: v.g });
  }

  // ------------------------------------------------------------------ the trading post
  post(L, map) {
    const q = map.post, y = q.y, G = new THREE.Group(); G.position.set(q.x, y, q.z); L.add(G);
    const wood = std({ map: T.planks([2, 1]), roughness: 0.85 });
    const hut = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.4, 3.4), wood); hut.position.set(0, 1.7, -4.2); hut.castShadow = true; G.add(hut);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 3.1, 1.6, 4, 1), std({ color: map.ground === 'snow' ? 0xf4f8fc : 0x8a3a2a, roughness: 0.8 })); roof.scale.set(1.75, 1, 0.85); roof.rotation.y = Math.PI / 4; roof.position.set(0, 4.2, -4.2); roof.castShadow = true; G.add(roof);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.05, 0.8), std({ map: T.planks([2, 0.5]), roughness: 0.8 })); counter.position.set(0, 0.53, -1.9); counter.castShadow = true; G.add(counter);
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.1, 1.0), std({ color: 0x5a3a1e, roughness: 0.6 })); top.position.set(0, 1.1, -1.9); G.add(top);
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 3), std({ map: T.stripes(), side: THREE.DoubleSide, roughness: 0.8 })); awning.material.map.repeat.set(3, 1); awning.position.set(0, 3.1, -1.6); awning.rotation.x = -Math.PI / 2 + 0.35; awning.castShadow = true; G.add(awning);
    for (const s of [-1, 1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.7), this.barkM ||= std({ map: T.bark([1, 2]), roughness: 0.95 })); pole.position.set(s * 3.5, 1.35, -0.4); G.add(pole); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), std({ map: T.sign('TRADING POST', '#6a4a2e', '#ffe07a'), roughness: 0.7 })); sign.position.set(0, 3.0, -2.47); G.add(sign);
    const dollar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.12, 24), std({ color: 0xffc83a, metalness: 1, roughness: 0.25 })); dollar.rotation.x = Math.PI / 2; dollar.position.set(0, 5.3, -4.2); G.add(dollar); this.spinCoin = dollar;
    // wares on the counter
    const wares = [[0x8a6a42, 0.4], [0x8a8884, 0.35], [0xd8203a, 0.2], [0xffc83a, 0.18]];
    wares.forEach(([c, s], i) => { const w = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s, s), std({ color: c, roughness: 0.6, metalness: c === 0xffc83a ? 1 : 0 })); w.position.set(-2.2 + i * 1.4, 1.15 + s / 2, -1.9); G.add(w); });
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1, 12), std({ color: 0x7a5230, roughness: 0.8 })); b.position.set(-4.4 + (i % 2) * 0.9, 0.5, -3 + Math.floor(i / 2) * 0.9); b.castShadow = true; G.add(b); }
    // the shopkeeper
    const keeper = new Googly({ color: '#c8a078', local: true }); keeper.group.position.set(0.6, 0, -3.0); G.add(keeper.group); this.keeper = keeper;
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.3, 16), std({ color: 0x3a2a1a })); hat.position.y = 0.95; keeper.body.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 20), hat.material); brim.position.y = 0.82; keeper.body.add(brim);
    // the big campfire with log benches
    this.campfire(G, 0, 5.5, 1.3);
    for (const s of [-1, 1]) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 10), this.barkM); lg.rotation.x = Math.PI / 2; lg.position.set(s * 3.2, 0.3, 5.4); lg.castShadow = true; G.add(lg); }
    // lanterns
    for (const s of [-1, 1]) { const ln = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd080 })); ln.position.set(s * 3.5, 2.6, -0.35); G.add(ln); }
  }
  campfire(parent, x, z, s = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); parent.add(g);
    for (let i = 0; i < 8; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), this.graniteM ||= std({ color: 0x8a8884, roughness: 0.95, flatShading: true })); st.position.set(Math.cos(i / 8 * 6.283) * 0.55, 0.08, Math.sin(i / 8 * 6.283) * 0.55); g.add(st); }
    for (let i = 0; i < 4; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.8, 6), std({ color: 0x4a2e16 })); lg.position.y = 0.2; lg.rotation.set(0.9, i * 1.57, 0); g.add(lg); }
    const flames = [];
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.05, 0.7 - i * 0.12, 7), new THREE.MeshBasicMaterial({ color: [0xff6a1a, 0xffa030, 0xffe070][i], transparent: true, opacity: 0.9, depthWrite: false })); f.position.y = 0.4; f.userData.noShadow = true; g.add(f); flames.push(f); }
    const light = new THREE.PointLight(0xff9a40, 2, 14 * s, 1.5); light.position.y = 1; g.add(light);
    this.fires.push({ flames, light, t: Math.random() * 9, g });
    return g;
  }

  // ------------------------------------------------------------------ plots and shelters
  plot(L, map, pl) {
    const g = new THREE.Group(); g.position.set(pl.x, pl.y, pl.z); L.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(pl.r - 0.25, pl.r, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2), std({ color: 0xdadada, metalness: 0.6, roughness: 0.3 })); pole.position.set(pl.r - 1, 2.1, 0); pole.castShadow = true; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8, 8, 1), std({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(pl.r - 1 + 0.66, 3.75, 0); flag.castShadow = true; g.add(flag);
    this.flags.push(flag);
    const house = new THREE.Group(); g.add(house);
    // face the house towards the middle of the map
    house.rotation.y = Math.atan2(-pl.x, -pl.z);
    return { pl, g, ring, flag, house, tier: -1, color: null, tag: null };
  }
  setPlot(i, { color, name, tier }) {
    const v = this.plotViews?.[i]; if (!v) return;
    if (color && v.color !== color) { v.color = color; v.ring.material.color.set(color); v.flag.material.color.set(color); }
    if (name !== undefined && v.name !== name) {
      v.name = name; if (v.tag) v.g.remove(v.tag);
      if (name) { v.tag = textSprite(name + "'s plot", { size: 34, border: color || '#fff' }); v.tag.position.set(v.pl.r - 1, 4.7, 0); v.g.add(v.tag); }
    }
    if (tier !== undefined && tier !== v.tier) { const up = v.tier >= 0 && tier > v.tier; v.tier = tier; this.buildShelter(v, tier); if (up) this.confetti({ x: v.pl.x, y: v.pl.y + 3, z: v.pl.z }, 50); }
  }
  buildShelter(v, tier) {
    const H = v.house; for (const c of [...H.children]) H.remove(c);
    v.walls = [];
    if (!tier) return;
    const b = this.map.ground, M = this.houseMats(b);
    const add = (geo, mat, x, y, z, wall = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; H.add(m); if (wall) v.walls.push(m); return m; };
    const pole = (x, z, h) => add(new THREE.CylinderGeometry(0.1, 0.12, h, 6), this.barkM, x, h / 2, z, false);
    const gable = (w, d, y, mat) => { const r = add(new THREE.CylinderGeometry(0.01, w * 0.72, 1.6, 4, 1), mat, 0, y + 0.8, 0); r.rotation.y = Math.PI / 4; r.scale.set(1, 1, d / w); return r; };
    if (tier === 1) {
      if (b === 'snow') { const w = add(new THREE.TorusGeometry(2.2, 0.55, 6, 14, Math.PI), M.wall, 0, 0, -0.5); w.rotation.x = 0; w.scale.set(1, 1.1, 1); }
      else if (b === 'sand') { pole(-1.6, -1.2, 2.2); pole(1.6, -1.2, 2.2); pole(-1.6, 1.2, 1.4); pole(1.6, 1.2, 1.4); const tarp = add(new THREE.PlaneGeometry(3.6, 2.8), M.cloth, 0, 1.85, 0); tarp.rotation.x = -Math.PI / 2 + 0.28; tarp.material.side = THREE.DoubleSide; }
      else if (b === 'alpine') { for (let i = 0; i < 7; i++) { const s = add(new THREE.DodecahedronGeometry(0.55, 0), M.wall, -1.8 + i * 0.6, 0.4 + (i % 2) * 0.3, -1.2); s.rotation.set(i, i, 0); } pole(-1.6, 1, 1.5); pole(1.6, 1, 1.5); const rf = add(new THREE.PlaneGeometry(3.8, 2.8), M.roof, 0, 1.55, -0.1); rf.rotation.x = -Math.PI / 2 + 0.35; rf.material.side = THREE.DoubleSide; }
      else { pole(-1.6, 1.2, 0.4); pole(1.6, 1.2, 0.4); const rf = add(new THREE.BoxGeometry(3.6, 0.12, 3.2), M.roof, 0, 1.2, 0); rf.rotation.x = 0.7; for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.09, 0.09, 3.3, 6), this.barkM, -1.6 + i * 0.8, 1.3, 0.1).rotation.x = Math.PI / 2 + 0.7; }
      this.homeFire(H, 0, 2.4, 0.7);
      return;
    }
    if (tier === 2) {
      if (b === 'snow') {
        add(new THREE.SphereGeometry(2.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.wall, 0, 0, 0);
        const tun = add(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 12, 1, false, 0, Math.PI), M.wall, 0, 0, 2.3); tun.rotation.set(Math.PI / 2, 0, Math.PI / 2); tun.rotation.order = 'YXZ'; tun.rotation.set(0, Math.PI / 2, Math.PI / 2);
        const door = add(new THREE.CircleGeometry(0.62, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x1a2a3a }), 0, 0.02, 3.12, false);
      } else if (b === 'sand') {
        add(new THREE.BoxGeometry(3.6, 2.4, 3.2), M.wall, 0, 1.2, 0);
        add(new THREE.BoxGeometry(3.9, 0.2, 3.5), M.trim, 0, 2.5, 0);
        for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 5), this.barkM, -1.4 + i * 0.9, 2.2, 1.7, false).rotation.x = Math.PI / 2;
        this.door(H, 0, 1.62, M);
      } else {
        add(new THREE.CylinderGeometry(2, 2.1, 2.2, 14), M.wall, 0, 1.1, 0);
        add(new THREE.ConeGeometry(2.7, 2, 14), M.roof, 0, 3.2, 0);
        this.door(H, 0, 2.05, M);
      }
      this.homeFire(H, 1.8, 3.2, 0.7);
      return;
    }
    // tier 3+: a proper house, bigger each time
    const w = tier === 3 ? 4.4 : tier === 4 ? 5.4 : 5.6, d = tier === 3 ? 3.8 : 4.4, h = tier === 3 ? 2.6 : 2.8;
    add(new THREE.BoxGeometry(w, h, d), M.wall, 0, h / 2, 0);
    if (b === 'alpine' || tier >= 4) add(new THREE.BoxGeometry(w + 0.2, 0.7, d + 0.2), M.base, 0, 0.35, 0);
    this.door(H, 0, d / 2 + 0.02, M);
    for (const s of [-1, 1]) this.windowPane(H, s * w * 0.3, h * 0.6, d / 2 + 0.03);
    let top = h;
    if (tier >= 4) { add(new THREE.BoxGeometry(w * 0.8, h * 0.85, d * 0.85), M.wall2, 0, h + h * 0.42, 0); for (const s of [-1, 1]) this.windowPane(H, s * w * 0.22, h * 1.45, d * 0.425 + 0.03); top = h * 1.85; }
    if (b === 'sand') { add(new THREE.BoxGeometry((tier >= 4 ? w * 0.8 : w) + 0.3, 0.25, (tier >= 4 ? d * 0.85 : d) + 0.3), M.trim, 0, top + 0.12, 0); if (tier >= 4) { const dome = add(new THREE.SphereGeometry(1.2, 16, 10, 0, 6.283, 0, Math.PI / 2), M.trim2, 0, top + 0.2, 0); } }
    else if (b === 'snow' && tier === 3) { add(new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3), M.roof, 0, top + 0.1, 0); gable(w + 0.3, d + 0.3, top + 0.2, M.roof); }
    else gable(tier >= 4 ? w * 0.85 : w + 0.3, tier >= 4 ? d * 0.9 : d + 0.3, top, M.roof);
    // chimney with smoke
    const ch = add(new THREE.BoxGeometry(0.6, 1.6, 0.6), M.base, w * 0.3, top + 0.9, -d * 0.2);
    this.chimneys ||= []; this.chimneys.push({ x: v.pl.x, z: v.pl.z, top: v.pl.y + top + 1.8, t: 0, house: H, ch });
    if (tier === 5) {
      // walls and towers round the whole plot
      const R = 5.9;
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + Math.PI / 4, tx = Math.cos(a) * R, tz = Math.sin(a) * R;
        add(new THREE.CylinderGeometry(0.75, 0.85, 4.2, 10), M.base, tx, 2.1, tz);
        add(new THREE.ConeGeometry(1.0, 1.4, 10), M.roof, tx, 4.9, tz);
        const fl = add(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshStandardMaterial({ color: v.color || 0xffffff, side: THREE.DoubleSide }), tx + 0.36, 6.1, tz, false); this.flags.push(fl);
        add(new THREE.CylinderGeometry(0.03, 0.03, 1.2), this.barkM, tx, 5.9, tz, false);
      }
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2, wx = Math.cos(a) * R * 0.72, wz = Math.sin(a) * R * 0.72;
        if (i === 1) continue;       // the gate side (faces the middle of the map)
        const wl = add(new THREE.BoxGeometry(0.5, 2.2, R * 1.2), M.base, wx, 1.1, wz); wl.rotation.y = a;
        for (let k = -2; k <= 2; k++) { const c = add(new THREE.BoxGeometry(0.55, 0.45, 0.5), M.base, wx + Math.sin(a) * k * 1.2 * -1, 2.4, wz + Math.cos(a) * k * 1.2); c.rotation.y = a; }
      }
    }
    this.homeFire(H, w / 2 + 1.2, d / 2 + 1.4, 0.7);
  }
  door(H, x, z, M) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.08), M.door); d.position.set(x, 0.85, z); H.add(d); const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std({ color: 0xffc83a, metalness: 1 })); k.position.set(x + 0.3, 0.85, z + 0.05); H.add(k); }
  windowPane(H, x, y, z) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.06), std({ color: 0x3a2412 })); f.position.set(x, y, z); H.add(f); const g = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.56), this.winM ||= std({ color: 0xffd890, emissive: 0xffa040, emissiveIntensity: 0.2, roughness: 0.2 })); g.position.set(x, y, z + 0.04); H.add(g); }
  homeFire(H, x, z, s) { this.campfire(H, x, z, s); }
  houseMats(b) {
    this.hm ||= {};
    if (this.hm[b]) return this.hm[b];
    const wood = std({ map: T.logs([1.5, 1.5]), roughness: 0.9 }), door = std({ map: T.planks([0.5, 1]), roughness: 0.8 });
    const M = {
      snow: { wall: phys({ map: T.ice([1.5, 1.5]), roughness: 0.25, clearcoat: 0.6 }), wall2: phys({ map: T.ice([1.2, 1.2]), roughness: 0.25, clearcoat: 0.6 }), roof: std({ color: 0xf6fafc, roughness: 0.6 }), base: std({ map: T.bricks([1.5, 1.5], '#b8d4e6', '#a0c0d8'), roughness: 0.5 }), door, trim: std({ color: 0xffffff }), cloth: std({ color: 0xc83a2a }) },
      sand: { wall: std({ map: T.clay([1.5, 1.5]), roughness: 1 }), wall2: std({ map: T.clay([1.2, 1.2]), roughness: 1 }), roof: std({ color: 0xa86a3a }), base: std({ map: T.bricks([1.5, 1.5], '#d0a070', '#b88858'), roughness: 1 }), door, trim: std({ color: 0xe8c89a, roughness: 1 }), trim2: std({ color: 0x3aa0b8, roughness: 0.4, metalness: 0.2 }), cloth: std({ color: 0xe8e0c8, roughness: 1 }) },
      grass: { wall: wood, wall2: wood, roof: std({ color: 0x5a3a24, roughness: 0.9, map: T.planks([2, 2]) }), base: std({ map: T.bricks([1.5, 1.5]), roughness: 0.9 }), door, trim: wood, cloth: std({ color: 0x3a6a3a }) },
      alpine: { wall: wood, wall2: wood, roof: std({ color: 0x3a2a24, roughness: 0.8, map: T.planks([2, 2]) }), base: std({ map: T.bricks([1.5, 1.5]), roughness: 0.9 }), door, trim: wood, cloth: std({ color: 0x3a3a6a }) },
    }[b] || null;
    if (b === 'alpine') M.wall = wood; else if (b === 'grass') M.wall = wood;
    if (b === 'alpine' || b === 'grass') M.wall2 = wood;
    if (b === 'snow') { M.roof.map = null; }
    if (b === 'alpine') { M.roof = std({ color: 0x4a3a34, roughness: 0.8, map: T.planks([2, 2]) }); }
    // the stone castle and wooden fort use their own base
    if (b === 'alpine') M.wall = std({ map: T.bricks([1.5, 1.5]), roughness: 0.9 });
    return (this.hm[b] = M);
  }
  // see into your own house: fade its walls while you're inside
  setInside(i, inside) {
    const v = this.plotViews?.[i]; if (!v || !v.walls) return;
    for (const m of v.walls) { if (!m.material.userData.cloned) { m.material = m.material.clone(); m.material.userData.cloned = true; } m.material.transparent = true; m.material.opacity += ((inside ? 0.22 : 1) - m.material.opacity) * 0.2; m.material.depthWrite = m.material.opacity > 0.9; }
  }

  // ------------------------------------------------------------------ Base Camp
  camp(L, map) {
    this.campfire(L, 0, 0, 1.5);
    for (const c of map.colliders) {
      if (c.kind === 'log') { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, Math.max(c.w, c.d), 10), this.barkM ||= std({ map: T.bark([1, 2]), roughness: 0.95 })); lg.rotation.set(c.w > c.d ? 0 : Math.PI / 2, 0, c.w > c.d ? Math.PI / 2 : 0); lg.position.set(c.x, 0.3, c.z); lg.castShadow = true; L.add(lg); }
      if (c.kind === 'tramp') {
        const g = new THREE.Group(); g.position.set(c.x, 0, c.z); L.add(g);
        const mat = new THREE.Mesh(new THREE.CylinderGeometry(c.r, c.r, 0.08, 32), std({ color: 0x1a1a22, roughness: 0.6 })); mat.position.y = 0.48; g.add(mat);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(c.r, 0.12, 8, 32), std({ color: 0x2a8aff, roughness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.y = 0.5; g.add(rim);
        for (let i = 0; i < 6; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5), std({ color: 0x888888, metalness: 0.8 })); leg.position.set(Math.cos(i) * c.r, 0.25, Math.sin(i) * c.r); g.add(leg); }
      }
      if (c.kind === 'tent') {
        const col = ['#e84a3a', '#2a8aff', '#f0b020', '#3aa04a'][c.i];
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 2.2, 2.6, 4, 1), std({ map: T.canvasTent(col), roughness: 0.9 })); t.rotation.y = Math.PI / 4; t.scale.set(1, 1, 1.1); t.position.set(c.x, 1.3, c.z); t.castShadow = true; L.add(t);
        const door = new THREE.Mesh(new THREE.CircleGeometry(0.6, 3), new THREE.MeshBasicMaterial({ color: 0x1a1008 })); door.position.set(c.x, 0.45, c.z + 1.58); door.rotation.z = Math.PI / 2; L.add(door);
      }
    }
    // the SHOP stall where you buy skins and pets
    const s = map.shop;
    const stall = new THREE.Group(); stall.position.set(s.x + 2.4, 0, s.z); stall.rotation.y = -Math.PI / 2; L.add(stall);
    const cnt = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.8), std({ map: T.planks([1, 0.5]) })); cnt.position.y = 0.5; cnt.castShadow = true; stall.add(cnt);
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.8), std({ map: T.stripes(), side: THREE.DoubleSide })); aw.position.set(0, 2.5, 0.2); aw.rotation.x = -Math.PI / 2 + 0.4; stall.add(aw);
    for (const k of [-1, 1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4), this.barkM); pl.position.set(k * 1.9, 1.2, 0.6); stall.add(pl); }
    const sgn = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), std({ map: T.sign('SHOP', '#b8860b', '#fff') })); sgn.position.set(0, 1.7, -0.3); stall.add(sgn);
    const ringM = new THREE.Mesh(new THREE.RingGeometry(s.r - 0.3, s.r, 40), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.7, depthWrite: false })); ringM.rotation.x = -Math.PI / 2; ringM.position.set(s.x, 0.04, s.z); L.add(ringM); this.shopRing = ringM;
    // the big sign
    const board = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), std({ map: T.sign('GOOGLY SURVIVAL', '#2a5a2a', '#ffe07a') })); board.position.set(0, 4.6, -19); L.add(board);
    for (const k of [-1, 1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6), this.barkM); pl.position.set(k * 4.8, 3, -19.05); pl.castShadow = true; L.add(pl); }
    // woods all round the clearing
    const r = rng(12);
    for (let i = 0; i < 90; i++) { const a = r() * 6.283, d = map.W / 2 + 2 + r() * 30; const t = this.treeMesh(r() < 0.5 ? 'oak' : 'pine', false, 1 + r() * 0.6); t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); L.add(t); }
  }

  // ------------------------------------------------------------------ crates, pickups, lightning, boulders
  addCrate(c, landed = false) {
    const g = new THREE.Group(); g.position.set(c.x, c.y, c.z); this.level.add(g);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), std({ map: T.planks([1, 1]), roughness: 0.8 })); box.position.y = 0.45; box.castShadow = true; g.add(box);
    for (const [x, z] of [[-0.56, 0], [0.56, 0]]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.94, 1.14), std({ color: 0x4a4a4a, metalness: 0.7 })); band.position.set(x, 0.45, z); g.add(band); }
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), std({ map: T.sign('SUPPLIES', '#c83a2a', '#fff') })); lbl.position.set(0, 0.5, 0.56); g.add(lbl);
    const chute = new THREE.Group(); chute.visible = !landed; g.add(chute);
    const can = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 8, 0, 6.283, 0, 1.2), std({ map: T.stripes(), side: THREE.DoubleSide })); can.position.y = 4.2; chute.add(can);
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 3.5), std({ color: 0xffffff })); const a = i * 1.57 + 0.78; s.position.set(Math.cos(a) * 0.9, 2.5, Math.sin(a) * 0.9); s.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); chute.add(s); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 30; beam.userData.noShadow = true; g.add(beam);
    const v = { c, g, chute, fall: landed ? 0 : 28, beam };
    g.position.y = c.y + v.fall;
    this.crates.set(c.id, v);
  }
  removeCrate(id) { const v = this.crates.get(id); if (!v) return; this.puff({ x: v.c.x, y: v.c.y + 0.6, z: v.c.z }, 0xc8a070, 14, 3); this.level.remove(v.g); this.crates.delete(id); }
  addPickup(k) {
    const g = new THREE.Group(); g.position.set(k.x, k.y, k.z); this.level.add(g);
    const sack = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), std({ color: 0xa87a4a, roughness: 1 })); sack.scale.y = 0.85; sack.position.y = 0.3; sack.castShadow = true; g.add(sack);
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 8), sack.material); tie.position.y = 0.6; g.add(tie);
    if (k.coins) { const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), std({ color: 0xffc83a, metalness: 1, roughness: 0.3 })); coin.position.set(0.3, 0.5, 0); coin.rotation.z = Math.PI / 2; g.add(coin); }
    this.pickups.set(k.id, { k, g, t: Math.random() * 6 });
  }
  removePickup(id) { const v = this.pickups.get(id); if (!v) return; this.puff({ x: v.k.x, y: v.k.y + 0.4, z: v.k.z }, 0xffe07a, 8, 2); this.level.remove(v.g); this.pickups.delete(id); }
  zapWarn(z) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.9, 32), new THREE.MeshBasicMaterial({ color: z.k === 'rock' ? 0xff9a2a : 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(z.x, z.y + 0.12, z.z); ring.userData.noShadow = true; this.fx.add(ring);
    const v = { ring, t: z.warn, k: z.k, x: z.x, y: z.y, z: z.z };
    if (z.k === 'rock') { v.rock = this.rockMesh('granite', 1.2); v.rock.position.set(z.x, z.y + 40, z.z); this.fx.add(v.rock); }
    this.zaps.push(v);
  }
  boom(z) {
    const v = this.zaps.find(q => Math.abs(q.x - z.x) < 0.01 && Math.abs(q.z - z.z) < 0.01);
    if (v) { this.fx.remove(v.ring); if (v.rock) this.fx.remove(v.rock); this.zaps.splice(this.zaps.indexOf(v), 1); }
    if (z.k === 'bolt') {
      const pts = []; let x = z.x, y = z.y + 60, zz = z.z; pts.push(new THREE.Vector3(x, y, zz));
      while (y > z.y) { y -= 4 + Math.random() * 4; x += (Math.random() - 0.5) * 3; zz += (Math.random() - 0.5) * 3; pts.push(new THREE.Vector3(y <= z.y ? z.x : x, Math.max(z.y, y), y <= z.y ? z.z : zz)); }
      const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xeef4ff, transparent: true, opacity: 1 }));
      this.fx.add(bolt); this.parts.push({ m: bolt, life: 0.25, bolt: true });
      this.flash.position.set(z.x, z.y + 20, z.z); this.flashT = 0.35;
      this.puff({ x: z.x, y: z.y + 0.3, z: z.z }, 0xfff4c0, 16, 5);
    } else {
      this.puff({ x: z.x, y: z.y + 0.5, z: z.z }, 0x8a8884, 22, 5);
      const r = this.rockMesh('granite', 0.9); r.position.set(z.x, z.y, z.z); this.fx.add(r); this.parts.push({ m: r, life: 4, still: true });
    }
  }

  // ------------------------------------------------------------------ the sky, the sun and the weather
  /** clock: seconds into the game; nightK: 0 day … 1 night (from core) */
  setTime(clock, nightK) {
    this.nightK = nightK;
    const map = this.map; if (!map) return;
    const dayLen = 120, d = (clock % dayLen) / dayLen;
    // the sun crosses the sky during the first 66% of each day, the moon the rest
    const dayPart = 0.66, a = d < dayPart ? (d / dayPart) * Math.PI : Math.PI + (d - dayPart) / (1 - dayPart) * Math.PI;
    const sunDir = new THREE.Vector3(Math.cos(a) * 0.8, Math.sin(a), 0.45).normalize();
    this.skyU.sunDir.value.copy(sunDir);
    const n = nightK, low = Math.max(0, 1 - Math.abs(Math.sin(a)) * 3) * (1 - n);     // golden hour
    const sky = map.sky, st = this.stormK;
    const top = new THREE.Color(sky.day[0]).lerp(new THREE.Color(sky.night[0]), n), bot = new THREE.Color(sky.day[1]).lerp(new THREE.Color(sky.night[1]), n).lerp(new THREE.Color('#ffaa66'), low * 0.5);
    const stormCol = new THREE.Color(map.key === 'desert' ? '#c8965a' : map.key === 'forest' ? '#4a5460' : '#c8d0da');
    top.lerp(stormCol, st * 0.8); bot.lerp(stormCol, st * 0.9);
    this.skyU.top.value.copy(top); this.skyU.bot.value.copy(bot); this.skyU.night.value = n;
    this.skyU.sunCol.value.set(sky.sun).lerp(new THREE.Color('#ff9a50'), low);
    this.stars.material.opacity = n * (1 - st);
    const moonPhase = d >= dayPart;
    const lightDir = moonPhase ? new THREE.Vector3(-sunDir.x, -sunDir.y, sunDir.z) : sunDir;
    this.sun.intensity = (moonPhase ? 0.35 : 2.6 * Math.min(1, Math.sin(a) * 4)) * (1 - st * 0.6) * (1 - n * 0.2);
    this.sun.color.set(moonPhase ? '#9ab4e8' : sky.sun).lerp(new THREE.Color('#ffa060'), moonPhase ? 0 : low * 0.7);
    this.sunDir = lightDir;
    this.hemi.intensity = (1.15 - n * 0.7) * (1 - st * 0.25);
    this.hemi.color.set(n > 0.5 ? '#6a80b0' : '#cfe6ff'); this.hemi.groundColor.set(map.ground === 'snow' ? '#aab8c8' : map.ground === 'sand' ? '#a8845a' : '#4a5a3a');
    const fogCol = new THREE.Color(sky.fog).lerp(new THREE.Color(sky.night[1]), n).lerp(bot, 0.3).lerp(stormCol, st);
    if (!this.scene.fog) this.scene.fog = new THREE.FogExp2(fogCol, sky.fogDay);
    this.scene.fog.color.copy(fogCol);
    this.scene.fog.density = sky.fogDay * (1 + n * 0.6) + st * (map.key === 'forest' ? 0.02 : 0.045);
    this.renderer.toneMappingExposure = 1.0 - n * 0.15;
    if (this.winM) this.winM.emissiveIntensity = 0.2 + n * 1.6;
  }
  makeWeather(map) {
    const n = this.lq ? 700 : 2400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 50, Math.random() * 26, (Math.random() - 0.5) * 50], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const key = map.key, col = key === 'desert' ? 0xd8b078 : key === 'forest' ? 0xa8c0d8 : 0xffffff;
    this.weather = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: key === 'forest' ? 0.07 : key === 'desert' ? 0.09 : 0.12, transparent: true, opacity: 0, depthWrite: false }));
    this.weather.userData = { key, base: key === 'arctic' ? 0.35 : key === 'mountains' ? 0.1 : 0 };
    this.weather.frustumCulled = false; this.weather.userData.noShadow = true;
    this.scene.add(this.weather);
  }
  setStorm(on) { this.stormWant = on ? 1 : 0; }

  // ------------------------------------------------------------------ little effects
  puff(p, col = 0xffffff, n = 10, speed = 3) {
    this.dropGeo ||= new THREE.SphereGeometry(1, 6, 4);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.dropGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
      m.position.set(p.x, p.y, p.z); m.scale.setScalar(0.06 + Math.random() * 0.07);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.fx.add(m); this.parts.push({ m, v, life: 0.6 + Math.random() * 0.4, fade: true });
    }
  }
  chips(p, col, n = 6) {
    this.chipGeo ||= new THREE.BoxGeometry(0.12, 0.08, 0.1);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.chipGeo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
      m.position.set(p.x, p.y, p.z);
      const v = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4);
      this.fx.add(m); this.parts.push({ m, v, life: 0.9, conf: true, spin: new THREE.Vector3(9, 7, 0), floor: p.y - 0.8 });
    }
  }
  confetti(p, n = 40) {
    this.confGeo ||= new THREE.PlaneGeometry(0.12, 0.2);
    const cols = [0xe84a5f, 0x2a9df4, 0xffc93c, 0x6ab04c, 0x9b59ff, 0xff8c42];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.confGeo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
      m.position.set(p.x, p.y, p.z);
      const v = new THREE.Vector3((Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.5) * 6);
      this.fx.add(m); this.parts.push({ m, v, life: 2 + Math.random(), spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), conf: true, floor: p.y - 3 });
    }
  }
  smoke(x, y, z) {
    this.smokeGeo ||= new THREE.SphereGeometry(1, 7, 5);
    const m = new THREE.Mesh(this.smokeGeo, new THREE.MeshBasicMaterial({ color: 0xb8b8b8, transparent: true, opacity: 0.45, depthWrite: false }));
    m.position.set(x, y, z); m.scale.setScalar(0.25); this.fx.add(m);
    this.parts.push({ m, v: new THREE.Vector3((Math.random() - 0.3) * 0.4, 1.1, (Math.random() - 0.5) * 0.3), life: 3, fade: true, smoke: true });
  }
  update(dt, t, focus) {
    if (focus) this.focus.copy(focus);
    const f = this.focus;
    // the sun's shadow box follows you around
    if (this.sunDir) { this.sun.position.copy(f).addScaledVector(this.sunDir, 90); this.sun.target.position.copy(f); }
    this.sky.position.copy(this.camera.position); this.stars.position.copy(this.camera.position);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i]; q.life -= dt;
      if (q.life <= 0) { (q.g || this.fx).remove(q.m); if (q.m.material?.dispose && !q.g) q.m.material.dispose(); this.parts.splice(i, 1); continue; }
      if (q.bolt) { q.m.material.opacity = q.life / 0.25; continue; }
      if (q.still) { if (q.life < 1) q.m.scale.multiplyScalar(1 - dt * 2); continue; }
      if (q.fall !== undefined) { q.fall = Math.min(Math.PI / 2, q.fall + dt * (0.5 + q.fall * 3)); q.m.rotation.z = q.fall; if (q.life < 0.4) q.m.scale.multiplyScalar(1 - dt * 3); continue; }
      if (q.conf) { q.v.y -= 9 * dt; q.v.multiplyScalar(1 - dt * 1.2); q.m.rotation.x += q.spin.x * dt; q.m.rotation.y += q.spin.y * dt; }
      else if (q.smoke) { q.m.scale.multiplyScalar(1 + dt * 0.6); q.m.material.opacity *= 1 - dt * 0.5; }
      else { q.v.y += dt * 0.5; q.m.scale.multiplyScalar(1 + dt * 2.5); if (q.fade) q.m.material.opacity *= 1 - dt * 3; }
      q.m.position.addScaledVector(q.v, dt);
      if (q.floor !== undefined && q.m.position.y < q.floor) { q.m.position.y = q.floor; q.v.set(0, 0, 0); }
    }
    if (this.spinCoin) this.spinCoin.rotation.z = t * 1.5;
    if (this.shopRing) this.shopRing.material.opacity = 0.45 + Math.sin(t * 4) * 0.25;
    if (this.keeper) { this.keeper.group.rotation.y = Math.sin(t * 0.4) * 0.5; this.keeper.update(dt, { speed: 0 }); }
    for (const fi of this.fires) {
      fi.t += dt;
      fi.flames.forEach((fl, i) => { fl.scale.set(1 + Math.sin(fi.t * 13 + i) * 0.15, 1 + Math.sin(fi.t * 9 + i * 2) * 0.25, 1); fl.rotation.y += dt * (2 + i); });
      fi.light.intensity = (0.8 + this.nightK * 3) * (0.85 + Math.sin(fi.t * 17) * 0.1 + Math.sin(fi.t * 7) * 0.08);
      if (Math.random() < dt * 1.5) { const p = new THREE.Vector3(); fi.g.getWorldPosition(p); this.smoke(p.x, p.y + 0.9 * fi.g.scale.x, p.z); }
    }
    for (const ch of this.chimneys || []) { if (!ch.house.parent) continue; ch.t -= dt; if (ch.t <= 0) { ch.t = 0.5; const p = new THREE.Vector3(); ch.ch.getWorldPosition(p); this.smoke(p.x, p.y + 0.9, p.z); } }
    this.chimneys = (this.chimneys || []).filter(c => c.house.parent && c.ch.parent);
    for (const fl of this.flags) { const p = fl.geometry.attributes.position; if (!fl.userData.base) fl.userData.base = Float32Array.from(p.array); const b = fl.userData.base; for (let i = 0; i < p.count; i++) { const x = b[i * 3]; p.setZ(i, Math.sin(t * 5 + x * 4) * 0.12 * (x + 0.65)); } p.needsUpdate = true; }
    for (const v of this.nodeViews || []) if (v.shake > 0) { v.shake -= dt; const k = Math.sin(v.shake * 60) * v.shake * 0.25; (v.full || v.g).rotation.z = k; (v.full || v.g).rotation.x = k * 0.6; }
    for (const fs of this.fish) { fs.t -= dt; if (fs.t <= 0 && fs.v.amt > 0) { fs.t = 3 + Math.random() * 6; fs.jump = 0; } if (fs.jump !== undefined) { fs.jump += dt; const k = fs.jump / 0.8; fs.fish.visible = k < 1; fs.fish.position.set((k - 0.5) * 0.8, Math.sin(k * Math.PI) * 0.9, 0); fs.fish.rotation.z = -(k - 0.5) * 2.5; if (k >= 1) fs.jump = undefined; } }
    for (const w of this.water || []) w.material.opacity = 0.8 + Math.sin(t * 1.3) * 0.04;
    for (const v of this.crates.values()) {
      if (v.fall > 0) { v.fall = Math.max(0, v.fall - dt * 4.5); v.g.position.y = v.c.y + v.fall; v.g.rotation.z = Math.sin(t * 2) * 0.06 * Math.min(1, v.fall); if (v.fall === 0) { v.chute.visible = false; this.puff({ x: v.c.x, y: v.c.y + 0.3, z: v.c.z }, 0xd8c8a8, 14, 3); } }
      v.beam.material.opacity = 0.12 + Math.sin(t * 3) * 0.06;
    }
    for (const v of this.pickups.values()) { v.t += dt; v.g.rotation.y = v.t * 1.5; v.g.position.y = v.k.y + Math.abs(Math.sin(v.t * 3)) * 0.15; }
    for (const z of this.zaps) { z.t -= dt; z.ring.material.opacity = 0.4 + Math.abs(Math.sin(t * 12)) * 0.5; z.ring.scale.setScalar(0.8 + Math.max(0, z.t) * 0.3); if (z.rock) z.rock.position.y = z.y + Math.max(0.6, z.t / 1.3 * 40); }
    // lightning flash
    this.flashT = Math.max(0, this.flashT - dt); this.flash.intensity = this.flashT > 0 ? 900 * (this.flashT / 0.35) * (0.5 + Math.random()) : 0;
    // weather
    this.stormK += (this.stormWant - this.stormK) * (1 - Math.exp(-dt * 0.8));
    if (this.weather) {
      const W = this.weather, U = W.userData, amt = Math.max(U.base, this.stormK);
      W.material.opacity = Math.min(0.9, amt * 1.2);
      W.visible = amt > 0.02;
      W.position.set(f.x, f.y - 4, f.z);
      if (W.visible) {
        const p = W.geometry.attributes.position, fallV = U.key === 'forest' ? 22 : U.key === 'desert' ? 2 : 3.2 + this.stormK * 4, wind = U.key === 'desert' ? 16 * this.stormK + 1 : this.stormK * 6;
        for (let i = 0; i < p.count; i++) {
          let x = p.getX(i) + wind * dt + Math.sin(t + i) * dt * 0.3, y = p.getY(i) - fallV * dt, z = p.getZ(i) + wind * 0.3 * dt;
          if (y < 0) y += 26; if (x > 25) x -= 50; if (z > 25) z -= 50;
          p.setXYZ(i, x, y, z);
        }
        p.needsUpdate = true;
      }
    }
  }
}
