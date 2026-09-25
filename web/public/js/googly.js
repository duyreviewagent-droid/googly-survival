// The googly: a glossy jelly bean with wobbly googly eyes, swinging arms, skins, survival gear and tools.
import * as THREE from 'three';

export const SCALE = 1.2;
const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export function textSprite(text, { size = 44, color = '#fff', bg = 'rgba(0,0,0,.55)', border = null, pad = 12 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `900 ${size}px "Avenir Next", system-ui, sans-serif`;
  g.font = font;
  const w = g.measureText(text).width + pad * 2, h = size * 1.25 + pad * 2;
  c.width = Math.ceil(w); c.height = Math.ceil(h);
  g.font = font;
  if (bg) { g.fillStyle = bg; rr(g, 0, 0, c.width, c.height, 16); g.fill(); }
  if (border) { g.strokeStyle = border; g.lineWidth = 5; rr(g, 3, 3, c.width - 6, c.height - 6, 14); g.stroke(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.set(c.width / 200, c.height / 200, 1); s.renderOrder = 10;
  return s;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x, y, r); g.closePath(); }

// ------------------------------------------------------------------ skins (bought in the shop with coins)
export const SKINS = [
  { id: 'none', name: 'Classic', price: 0, dot: c => c },
  { id: 'polka', name: 'Polka Dots', price: 100, dot: c => `radial-gradient(circle at 30% 30%, #fff 18%, transparent 20%), radial-gradient(circle at 70% 65%, #fff 16%, ${c} 18%)` },
  { id: 'camo', name: 'Camo', price: 150, dot: () => 'radial-gradient(#6b7a3a 30%, #3a2e1c 60%)' },
  { id: 'zebra', name: 'Zebra', price: 200, dot: () => 'repeating-linear-gradient(70deg,#f4f4f4 0 5px,#141414 5px 9px)' },
  { id: 'tiger', name: 'Tiger', price: 250, dot: () => 'repeating-linear-gradient(60deg,#ff8a1c 0 5px,#1a1008 5px 8px)' },
  { id: 'cookie', name: 'Cookie', price: 300, dot: () => 'radial-gradient(circle at 35% 35%, #3a2010 12%, transparent 14%), radial-gradient(circle at 65% 60%, #3a2010 10%, #c98a4a 12%)' },
  { id: 'denim', name: 'Denim', price: 350, dot: () => 'repeating-linear-gradient(45deg,#3a5f9a 0 2px,#2c4a7a 2px 4px)' },
  { id: 'galaxy', name: 'Galaxy', price: 500, dot: () => 'radial-gradient(#ff4fd8, #3a0a6a 50%, #001a3a)' },
  { id: 'chrome', name: 'Chrome', price: 700, dot: () => 'linear-gradient(135deg,#fff,#8a96a8,#fff)' },
  { id: 'rainbow', name: 'Rainbow', price: 900, dot: () => 'linear-gradient(90deg,#ff2d55,#ffd60a,#34c759,#0a84ff,#bf5af2)' },
  { id: 'lava', name: 'Lava', price: 1100, dot: () => 'radial-gradient(#ff5a00 20%, #1a0a06 70%)' },
  { id: 'gold', name: 'Solid Gold', price: 1500, dot: () => 'linear-gradient(135deg,#fff3b0,#d4a52a,#fff3b0)' },
];
const skinCache = new Map();
function skinTex(id, color) {
  const key = id + color;
  if (skinCache.has(key)) return skinCache.get(key);
  const base = new THREE.Color(color), hex = '#' + base.getHexString();
  const dk = '#' + base.clone().multiplyScalar(0.45).getHexString(), lt = '#' + base.clone().lerp(new THREE.Color('#fff'), 0.35).getHexString();
  let t = null;
  if (id === 'camo') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#6b7a3a'; g.fillRect(0, 0, w, w);
    for (const [c, n] of [['#4a5a2a', 26], ['#3a2e1c', 18], ['#8f9a5a', 16], [hex, 8]]) for (let i = 0; i < n; i++) {
      g.fillStyle = c; g.beginPath(); const x = Math.random() * w, y = Math.random() * w;
      for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, r = 12 + Math.random() * 22; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.7); }
      g.fill();
    }
  });
  if (id === 'polka') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, w); g.fillStyle = '#fff';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 7, 0, 7); g.fill(); }
  });
  if (id === 'zebra') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#f2f2f0'; g.fillRect(0, 0, w, w); g.fillStyle = '#141414';
    for (let i = 0; i < 12; i++) { const y = i * 22 + Math.random() * 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(70, y - 16, 120, y + 20, 256, y + 4); g.lineTo(256, y + 11); g.bezierCurveTo(120, y + 26, 70, y - 6, 0, y + 9); g.fill(); }
  });
  if (id === 'tiger') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#ff8a1c'; g.fillRect(0, 0, w, w); g.fillStyle = '#1a1008';
    for (let i = 0; i < 14; i++) { const y = i * 19 + Math.random() * 6; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(60, y - 12, 100, y + 18, 140 + Math.random() * 60, y + 3); g.lineTo(130, y + 8); g.bezierCurveTo(90, y + 16, 50, y + 2, 0, y + 9); g.fill(); }
  });
  if (id === 'cookie') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#c98a4a'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? '#b0763a44' : '#e0a86044'; g.fillRect(Math.random() * w, Math.random() * w, 4, 4); }
    g.fillStyle = '#3a2010'; for (let i = 0; i < 26; i++) { const x = Math.random() * w, y = Math.random() * w; g.beginPath(); for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, r = 5 + Math.random() * 6; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
  });
  if (id === 'denim') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#34588f'; g.fillRect(0, 0, w, w);
    for (let i = 0; i < w * 2; i += 3) { g.strokeStyle = i % 2 ? '#2a4674' : '#4a6fa8'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(i, 0); g.lineTo(i - w, w); g.stroke(); }
    g.strokeStyle = '#e8a33a'; g.setLineDash([6, 5]); g.lineWidth = 2.5; for (const y of [60, 196]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
  if (id === 'galaxy') t = canvasTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#12002e'); gr.addColorStop(0.5, '#3a0a6a'); gr.addColorStop(1, '#001a3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { const x = Math.random() * w, y = Math.random() * h, r = 40 + Math.random() * 70; const n = g.createRadialGradient(x, y, 0, x, y, r); n.addColorStop(0, ['#ff4fd8aa', '#4fc3ffaa', '#b388ffaa'][i % 3]); n.addColorStop(1, '#0000'); g.fillStyle = n; g.fillRect(0, 0, w, h); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random()})`; g.fillRect(Math.random() * w, Math.random() * h, Math.random() < 0.1 ? 2 : 1, 1); }
  });
  if (id === 'rainbow') t = canvasTex(512, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); ['#ff2d55', '#ff9500', '#ffd60a', '#34c759', '#0a84ff', '#5e5ce6', '#bf5af2', '#ff2d55'].forEach((c, i, a) => gr.addColorStop(i / (a.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  if (id === 'lava') t = canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#1a0a06'; g.fillRect(0, 0, w, w); g.strokeStyle = '#ff5a00'; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { g.lineWidth = 1 + Math.random() * 4; g.beginPath(); let x = Math.random() * w, y = Math.random() * w; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  });
  if (id === 'none') t = canvasTex(128, 128, (g, w) => { g.fillStyle = hex; g.fillRect(0, 0, w, w); for (let i = 0; i < 600; i++) { g.fillStyle = Math.random() < 0.5 ? lt + '18' : dk + '18'; g.fillRect(Math.random() * w, Math.random() * w, 3, 3); } });
  skinCache.set(key, t);
  return t;
}
function skinMaterial(id, color) {
  const c = new THREE.Color(color);
  switch (id) {
    case 'gold': return new THREE.MeshPhysicalMaterial({ color: 0xffc83a, metalness: 1, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 });
    case 'chrome': return new THREE.MeshPhysicalMaterial({ color: 0xe8eef5, metalness: 1, roughness: 0.08, clearcoat: 1 });
    case 'lava': return new THREE.MeshPhysicalMaterial({ map: skinTex('lava', color), emissive: 0xff4a00, emissiveMap: skinTex('lava', color), emissiveIntensity: 1.8, roughness: 0.5 });
    case 'galaxy': return new THREE.MeshPhysicalMaterial({ map: skinTex('galaxy', color), emissive: 0xffffff, emissiveMap: skinTex('galaxy', color), emissiveIntensity: 0.35, roughness: 0.25, clearcoat: 1 });
    case 'camo': case 'tiger': case 'rainbow': case 'polka': case 'zebra': case 'cookie': case 'denim':
      return new THREE.MeshPhysicalMaterial({ map: skinTex(id, color), roughness: id === 'camo' || id === 'denim' || id === 'cookie' ? 0.75 : 0.35, clearcoat: id === 'camo' || id === 'denim' || id === 'cookie' ? 0 : 0.6 });
    default: return new THREE.MeshPhysicalMaterial({ color: c, map: skinTex('none', color), roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.2, sheen: 0.4, sheenColor: c.clone().lerp(new THREE.Color('#fff'), 0.5) });
  }
}

// ------------------------------------------------------------------ googly
const UP = new THREE.Vector3(0, 1, 0);
export class Googly {
  constructor({ color = '#9b59ff', name = '', skin = 'none', local = false } = {}) {
    this.group = new THREE.Group();
    this.root = new THREE.Group(); this.root.scale.setScalar(SCALE); this.group.add(this.root);
    this.color = color; this.local = local;
    this.pelvis = new THREE.Group(); this.pelvis.position.y = 0.5; this.root.add(this.pelvis);
    this.body = new THREE.Group(); this.pelvis.add(this.body);
    this.bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.38, 10, 24), std(0xffffff));
    this.bodyMesh.position.y = 0.4; this.bodyMesh.castShadow = true; this.bodyMesh.receiveShadow = true; this.body.add(this.bodyMesh);
    this.belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), std(0xffffff));
    this.belly.scale.set(1, 1.3, 0.4); this.belly.position.set(0, 0.25, 0.19); this.body.add(this.belly);
    // googly eyes
    this.eyes = [];
    for (const side of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(side * 0.125, 0.66, 0.27); e.rotation.set(-0.08, side * 0.28, 0);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.134, 0.134, 0.03, 28), std(0x15151a, 0.5)); rim.rotation.x = Math.PI / 2; e.add(rim);
      const white = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.036, 28), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1 })); white.rotation.x = Math.PI / 2; e.add(white);
      const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.012, 20), std(0x050505, 0.2)); pupil.rotation.x = Math.PI / 2; pupil.position.set(0, -0.03, 0.022); e.add(pupil);
      this.body.add(e);
      this.eyes.push({ node: e, pupil, p: new THREE.Vector2(0, -0.03), v: new THREE.Vector2(), last: null, lastV: new THREE.Vector3() });
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI), std(0x2a0c12, 0.4));
    this.mouth.position.set(0, 0.49, 0.29); this.mouth.rotation.z = Math.PI; this.body.add(this.mouth);
    // seeker cap (hot pink, with a magnifying-glass badge) — everyone can see who's "it"
    this.band = new THREE.Group(); this.band.visible = false; this.body.add(this.band);
    const capMat = new THREE.MeshPhysicalMaterial({ color: 0xff2d7a, roughness: 0.5, clearcoat: 0.4, emissive: 0xff2d7a, emissiveIntensity: 0.18 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.318, 28, 12, 0, Math.PI * 2, 0, 0.95), capMat); cap.position.y = 0.59; cap.rotation.x = -0.28; cap.castShadow = true; this.band.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24, 1, false, -Math.PI / 2, Math.PI), capMat); brim.position.set(0, 0.86, 0.2); brim.rotation.x = 0.18; brim.scale.set(1.05, 1, 0.95); this.band.add(brim);
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), capMat); button.position.set(0, 0.905, -0.08); this.band.add(button);
    const badge = new THREE.Group(); badge.position.set(0, 0.87, 0.2); badge.rotation.x = -0.9; this.band.add(badge);
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 20), std(0xffd23a, 0.3, 0.8)); badge.add(lens);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.052, 20), new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.05, emissive: 0x3a6a8a, emissiveIntensity: 0.3 })); glass.position.z = 0.002; badge.add(glass);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.07), std(0xffd23a, 0.3, 0.8)); handle.position.set(0.055, -0.055, 0); handle.rotation.z = 0.8; badge.add(handle);
    // arms: capsules from shoulder to hand, hands placed by pose
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 1, 4, 8), std(0xffffff)); arm.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(0xffffff, 0.5)); hand.castShadow = true;
      this.body.add(arm); this.body.add(hand);
      this.arms.push({ arm, hand, side, sh: new THREE.Vector3(side * 0.29, 0.44, 0), cur: new THREE.Vector3(side * 0.36, 0.1, 0.05) });
    }
    // legs
    this.hips = []; this.knees = []; this.legMeshes = [];
    const shoe = new THREE.MeshPhysicalMaterial({ color: 0x1c1c22, roughness: 0.35, clearcoat: 0.8 });
    for (const side of [-1, 1]) {
      const hp = new THREE.Group(); hp.position.set(side * 0.13, 0.02, 0); this.pelvis.add(hp);
      const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.17, 4, 8), std(0xffffff)); th.position.y = -0.12; hp.add(th);
      const kn = new THREE.Group(); kn.position.y = -0.23; hp.add(kn);
      const sn = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.17, 4, 8), std(0xffffff)); sn.position.y = -0.11; kn.add(sn);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), shoe); sh.scale.set(0.85, 0.55, 1.45); sh.position.set(0, -0.24, 0.06); kn.add(sh);
      th.castShadow = sn.castShadow = sh.castShadow = true;
      this.hips.push(hp); this.knees.push(kn); this.legMeshes.push(th, sn);
    }
    this.phase = 0; this.gait = 0; this.t = Math.random() * 10; this.crouchK = 0; this.hurtT = 0; this.reachT = 0; this.tauntT = 0; this.spinT = 0;
    this.lastSide = 0; this.onStep = null; this.pose = 'idle';
    this.setLook(color, skin);
    if (name) this.setName(name);
  }
  setLook(color, skin) {
    const key = color + skin;
    if (key === this.lookKey) return;
    this.lookKey = key; this.color = color; this.skin = skin;
    const mat = skinMaterial(skin, color);
    const c = new THREE.Color(color);
    const dark = skin === 'none' ? std(c.clone().multiplyScalar(0.62), 0.45) : mat;
    const bel = skin === 'none' ? std(c.clone().lerp(new THREE.Color('#fff'), 0.2), 0.4) : mat;
    this.bodyMesh.material = mat; this.belly.material = bel;
    for (const a of this.arms) { a.arm.material = mat; a.hand.material = skin === 'none' ? bel : mat; }
    for (const l of this.legMeshes) l.material = dark;
    if (this.name) this.setName(this.name, this.seeker);
  }
  setName(name, seeker = false) {
    this.name = name;
    if (this.tag) this.group.remove(this.tag);
    if (this.local) return;
    this.tag = textSprite((seeker ? '🔎 ' : '') + name, { size: 38, border: seeker ? '#ff2d7a' : this.color });
    this.tag.position.y = 2.3; this.group.add(this.tag);
  }
  setSeeker(on) {
    if (this.seeker === on) return;
    this.seeker = on; this.band.visible = on;
    if (this.name) this.setName(this.name, on);
  }
  reach() { this.reachT = 0.4; }
  /** what's in your right hand: 'axe' | 'pick' | null */
  setTool(kind) {
    if (this.toolKind === kind) return;
    this.toolKind = kind;
    const hand = this.arms[1].hand;
    if (this.tool) hand.remove(this.tool);
    this.tool = null;
    if (!kind) return;
    const g = new THREE.Group(), wood = std(0x8a5a2e, 0.8), steel = std(0xc8ccd4, 0.3, 0.9);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.5, 6), wood); handle.position.y = 0.16; g.add(handle);
    if (kind === 'axe') { const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.03), steel); head.position.set(0.07, 0.36, 0); g.add(head); }
    else { const head = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.022, 6, 12, Math.PI), steel); head.position.set(0, 0.34, 0); head.rotation.z = 0; g.add(head); }
    g.rotation.set(1.2, 0, 0.2); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    hand.add(g); this.tool = g;
  }
  /** survival gear you bought: coat (scarf), hat (sun hat), pack (backpack) */
  setGear(tools = []) {
    const key = tools.slice().sort().join(',');
    if (key === this.gearKey) return;
    this.gearKey = key;
    if (this.gear) this.body.remove(this.gear);
    this.gear = new THREE.Group(); this.body.add(this.gear);
    if (tools.includes('coat')) {
      const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.06, 8, 20), std(0xd8302a, 0.9)); scarf.rotation.x = Math.PI / 2 - 0.15; scarf.position.y = 0.5; this.gear.add(scarf);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.04), scarf.material); tail.position.set(0.12, 0.36, 0.27); tail.rotation.z = 0.2; this.gear.add(tail);
      const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 10, 0, 6.283, 0, 1.1), std(0x2a6ad8, 0.9)); beanie.position.y = 0.66; this.gear.add(beanie);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), std(0xffffff, 1)); pom.position.y = 0.95; this.gear.add(pom);
    }
    if (tools.includes('hat')) {
      const straw = std(0xe8c870, 0.9);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.03, 24), straw); brim.position.y = 0.86; this.gear.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.18, 18), straw); crown.position.y = 0.96; this.gear.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.05, 18), std(0xd8302a)); band.position.y = 0.9; this.gear.add(band);
      if (tools.includes('coat')) { brim.position.y = crown.position.y = band.position.y = 99; }
    }
    if (tools.includes('pack')) {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.46, 0.2), std(0x6a4a2a, 0.9)); pack.position.set(0, 0.38, -0.33); this.gear.add(pack);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.22), std(0x8a5a2a, 0.9)); flap.position.set(0, 0.6, -0.33); this.gear.add(flap);
    }
    this.gear.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  taunt() { this.tauntT = 1.3; }
  caught() { this.spinT = 0.8; this.hurtT = 0.35; }

  /** speed: ground speed; crouch; onGround; pose: 'idle' | 'count' (hands over eyes) | 'cheer' | 'sad'. */
  update(dt, { speed = 0, crouch = false, onGround = true, pose = 'idle' } = {}) {
    this.t += dt;
    this.gait += (Math.min(1, speed / 3.5) - this.gait) * (1 - Math.exp(-8 * dt));
    const run = Math.min(1, Math.max(0, (speed - 4.6) / 1.6));
    this.phase += speed / (1.25 + run * 0.35) * Math.PI * 2 * dt;
    this.crouchK += ((crouch ? 1 : 0) - this.crouchK) * (1 - Math.exp(-12 * dt));
    this.hurtT = Math.max(0, this.hurtT - dt); this.reachT = Math.max(0, this.reachT - dt); this.tauntT = Math.max(0, this.tauntT - dt); this.spinT = Math.max(0, this.spinT - dt);
    const g = this.gait * (1 - this.crouchK * 0.5), s = Math.sin(this.phase), c = Math.cos(this.phase), ck = this.crouchK;
    for (let i = 0; i < 2; i++) {
      const ph = this.phase + (i ? Math.PI : 0), swing = Math.max(0, Math.cos(ph));
      const air = onGround ? 0 : (i ? 0.5 : -0.3);
      this.hips[i].rotation.set(-(0.7 + run * 0.25) * Math.sin(ph) * g - ck * 1.1 + air, 0, (i ? 1 : -1) * (0.07 + ck * 0.1));
      this.knees[i].rotation.x = (1.3 + run * 0.4) * Math.pow(swing, 1.3) * g + 0.08 + ck * 1.9 + (onGround ? 0 : 0.6);
    }
    const side = s > 0 ? 0 : 1;
    if (side !== this.lastSide && g > 0.3 && onGround) this.onStep?.(side === 0 ? 1 : 0.7);
    this.lastSide = side;
    this.pelvis.position.y = 0.5 + (0.06 * Math.max(0, s) + 0.02 * Math.abs(c)) * g * (1 + run * 0.6) - ck * 0.24;
    const hurt = Math.sin(this.hurtT / 0.35 * Math.PI) * 0.35;
    const tw = this.tauntT > 0 ? Math.sin(this.t * 16) * 0.18 : 0;
    const lean = (0.1 + run * 0.18) * g + ck * 0.25 - hurt + (pose === 'count' ? 0.18 : 0) + (pose === 'sad' ? 0.25 : 0);
    this.body.rotation.set(lean, 0.12 * c * g + tw, 0.09 * s * g + Math.sin(this.t * 0.9) * 0.02 + tw * 0.6);
    this.root.rotation.y = this.spinT > 0 ? (1 - this.spinT / 0.8) * Math.PI * 4 : 0;
    this.faintK = (this.faintK || 0) + ((pose === 'faint' ? 1 : 0) - (this.faintK || 0)) * (1 - Math.exp(-6 * dt));
    this.root.rotation.x = -this.faintK * 1.45; this.root.position.y = this.faintK * 0.25;
    const breath = 1 + Math.sin(this.t * 2.2) * 0.012 + this.hurtT * 0.2 + (this.tauntT > 0 ? Math.abs(Math.sin(this.t * 16)) * 0.05 : 0);
    this.bodyMesh.scale.set(1 / Math.sqrt(breath), breath, 1 / Math.sqrt(breath));
    // hands: pick a target for each, then ease the arm there
    for (const a of this.arms) {
      const sd = a.side, sw = Math.sin(this.phase + (sd > 0 ? 0 : Math.PI)) * g;
      let tx = sd * (0.36 + run * 0.04), ty = 0.1 + Math.abs(sw) * 0.08 * (1 + run), tz = 0.05 + sw * (0.26 + run * 0.12);
      if (ck > 0.5) { tx = sd * 0.3; ty = 0.02; tz = 0.28; }                                      // hands on knees
      if (pose === 'count') { tx = sd * 0.13; ty = 0.66; tz = 0.4; }                              // covering the eyes
      if (pose === 'cheer') { tx = sd * 0.42; ty = 0.95 + Math.sin(this.t * 9 + sd) * 0.08; tz = 0.08; }
      if (pose === 'sad') { tx = sd * 0.24; ty = -0.05; tz = 0.12; }
      if (this.tauntT > 0) { tx = sd * (0.3 + Math.sin(this.t * 14) * 0.05); ty = 0.62; tz = 0.25; }   // wiggly fingers by the ears
      if (this.reachT > 0) { const k = Math.sin(this.reachT / 0.4 * Math.PI); tx = sd * 0.16; ty = 0.38 + k * 0.05; tz = 0.3 + k * 0.42; }
      a.cur.lerp(V.set(tx, ty, tz), 1 - Math.exp(-(this.reachT > 0 ? 30 : 16) * dt));
      const d = V2.copy(a.cur).sub(a.sh), L = d.length();
      a.arm.position.copy(a.sh).addScaledVector(d, 0.5);
      a.arm.quaternion.setFromUnitVectors(UP, d.normalize());
      a.arm.scale.set(1, Math.max(0.05, (L - 0.1) / 1.1), 1);
      a.hand.position.copy(a.cur);
    }
    // face: little O when caught or chasing, grin when taunting
    const shocked = this.hurtT > 0 || this.spinT > 0 || pose === 'sad' || pose === 'faint';
    this.mouth.rotation.z = shocked ? 0 : Math.PI;
    this.mouth.position.y = shocked ? 0.45 : 0.49;
    this.mouth.scale.set(this.tauntT > 0 ? 1.4 : 1, this.tauntT > 0 ? 1.4 : 1, 1);
    // googly eyes: pupils rattle around under gravity and head motion
    this.root.updateMatrixWorld(true);
    for (const e of this.eyes) {
      e.node.getWorldPosition(E); e.node.getWorldQuaternion(Q);
      UX.set(1, 0, 0).applyQuaternion(Q); UY.set(0, 1, 0).applyQuaternion(Q);
      if (!e.last) { e.last = E.clone(); e.lastV.set(0, 0, 0); }
      const ve = V.copy(E).sub(e.last).divideScalar(Math.max(dt, 1e-3));
      const ae = V2.copy(ve).sub(e.lastV).divideScalar(Math.max(dt, 1e-3)); if (ae.length() > 250) ae.setLength(250);
      e.last.copy(E); e.lastV.copy(ve);
      const a3 = V3.set(0, -22, 0).sub(ae), ax = a3.dot(UX), ay = a3.dot(UY);
      for (let k = 0; k < 3; k++) {
        const h = dt / 3;
        e.v.x += ax * h; e.v.y += ay * h; e.v.multiplyScalar(1 - 1.6 * h);
        e.p.x += e.v.x * h; e.p.y += e.v.y * h;
        const maxD = 0.061, d = e.p.length();
        if (d > maxD) { const nx = e.p.x / d, ny = e.p.y / d; e.p.set(nx * maxD, ny * maxD); const vn = e.v.x * nx + e.v.y * ny; if (vn > 0) { e.v.x -= nx * vn * 1.55; e.v.y -= ny * vn * 1.55; } }
      }
      e.pupil.position.set(e.p.x, e.p.y, 0.022);
    }
  }
}
const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), E = new THREE.Vector3(), UX = new THREE.Vector3(), UY = new THREE.Vector3(), Q = new THREE.Quaternion();
