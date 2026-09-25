// The four survival maps plus the Base Camp lobby. Everything here is generated from a fixed seed, so the
// server and every browser build exactly the same terrain, lakes, trees, rocks and ore.
export const ARCTIC = 0, DESERT = 1, FOREST = 2, MOUNTAINS = 3, CAMP = 4;
export const MAP_COUNT = 4;

export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// value noise on a hashed lattice
function noise2(seed) {
  const P = new Float32Array(512), r = rng(seed);
  for (let i = 0; i < 512; i++) P[i] = r();
  const h = (i, j) => P[((i * 73856093) ^ (j * 19349663)) & 511];
  return (x, z) => {
    const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    return lerp(lerp(h(i, j), h(i + 1, j), u), lerp(h(i, j + 1), h(i + 1, j + 1), u), v) * 2 - 1;
  };
}
const fbm = (n, x, z, oct = 4) => { let a = 0, amp = 1, f = 1, sum = 0; for (let o = 0; o < oct; o++) { a += n(x * f, z * f) * amp; sum += amp; amp *= 0.5; f *= 2.03; } return a / sum; };

// ------------------------------------------------------------------ what each biome is like
// temp: the air temperature your googly drifts towards (0 = freezing, 50 = comfy, 100 = roasting)
// labels: what "wood" and "stone" are called here (in the Arctic you cut ice blocks, in the desert sandstone)
const BIOMES = [
  {
    key: 'arctic', name: 'Frozen Tundra', emoji: '❄️', blurb: 'Blizzards, thin ice and very little wood. Stay warm!',
    seed: 1101, W: 160, temp: { day: 22, night: 6 }, amp: 1.6,
    storm: { name: 'BLIZZARD', emoji: '🌨', temp: 0, water: 1, hurt: 1.6, warn: 'A blizzard is coming — get inside!' },
    labels: { wood: 'Wood', stone: 'Ice', food: 'Fish', gold: 'Gold' },
    sky: { day: ['#9fc8e8', '#e6f2fa'], night: ['#0a1428', '#1c2c48'], fog: '#dce9f4', fogDay: 0.0055, sun: '#fff4e6' },
    ground: 'snow', water: { color: '#6fa8c8', ice: true },
    counts: { tree: 30, rock: 46, food: 16, gold: 12 },
  },
  {
    key: 'desert', name: 'Scorched Dunes', emoji: '🏜️', blurb: 'Roasting days, freezing nights, and water is rare.',
    seed: 2202, W: 160, temp: { day: 86, night: 24 }, amp: 2.8,
    storm: { name: 'SANDSTORM', emoji: '🌪', temp: 92, water: 2.6, hurt: 1.4, warn: 'A sandstorm is rolling in — find shelter!' },
    labels: { wood: 'Wood', stone: 'Sandstone', food: 'Cactus Fruit', gold: 'Gold' },
    sky: { day: ['#6ab0e8', '#f6e2b8'], night: ['#0c0c26', '#2a2040'], fog: '#f0d8a8', fogDay: 0.0035, sun: '#fff0cc' },
    ground: 'sand', water: { color: '#2aa6b0' },
    counts: { tree: 30, rock: 44, food: 30, gold: 20 },
  },
  {
    key: 'forest', name: 'Whispering Woods', emoji: '🌲', blurb: 'Plenty of wood and berries, but watch out for lightning.',
    seed: 3303, W: 160, temp: { day: 56, night: 34 }, amp: 3.2,
    storm: { name: 'THUNDERSTORM', emoji: '⛈', temp: 26, water: 0.6, hurt: 0.6, zap: true, warn: 'A thunderstorm is coming — lightning hits googlies outside!' },
    labels: { wood: 'Wood', stone: 'Stone', food: 'Berries', gold: 'Gold' },
    sky: { day: ['#6aa8e0', '#d8ecf4'], night: ['#08101c', '#18283a'], fog: '#b8d0c0', fogDay: 0.0045, sun: '#fff2d8' },
    ground: 'grass', water: { color: '#3a7a8a' },
    counts: { tree: 96, rock: 30, food: 32, gold: 7 },
  },
  {
    key: 'mountains', name: 'Rocky Peaks', emoji: '🏔️', blurb: 'Gold in the rocks, cold up high, and falling boulders.',
    seed: 4404, W: 160, temp: { day: 40, night: 16 }, amp: 9,
    storm: { name: 'ROCKSLIDE', emoji: '🪨', temp: 12, water: 0.8, hurt: 1.0, zap: true, rocks: true, warn: 'Rockslide and snow coming — boulders will fall!' },
    labels: { wood: 'Wood', stone: 'Stone', food: 'Berries', gold: 'Gold' },
    sky: { day: ['#5a9ae0', '#dce8f4'], night: ['#060c1a', '#1a2438'], fog: '#c8d4e0', fogDay: 0.004, sun: '#fff6e8' },
    ground: 'alpine', water: { color: '#3a8ab0' },
    counts: { tree: 44, rock: 56, food: 16, gold: 30 },
  },
];

// ------------------------------------------------------------------ build a map
function buildSurvival(id) {
  const B = BIOMES[id], W = B.W, R = rng(B.seed), n1 = noise2(B.seed), n2 = noise2(B.seed + 7);
  const half = W / 2;
  // raw terrain before flattening
  let raw;
  if (id === ARCTIC) raw = (x, z) => fbm(n1, x / 30, z / 30) * B.amp + Math.max(0, fbm(n2, x / 12, z / 12)) * 1.4;
  else if (id === DESERT) raw = (x, z) => (Math.sin(x * 0.07 + Math.sin(z * 0.045) * 2.2) * 0.5 + 0.5) * B.amp + fbm(n1, x / 25, z / 25) * 1.5 + fbm(n2, x / 8, z / 8) * 0.25;
  else if (id === FOREST) raw = (x, z) => fbm(n1, x / 32, z / 32) * B.amp + fbm(n2, x / 10, z / 10) * 0.5;
  else raw = (x, z) => {
    const ridge = 1 - Math.abs(fbm(n1, x / 40, z / 40, 3));
    const d = Math.hypot(x, z) / half;
    return ridge * ridge * B.amp * (0.25 + smooth((d - 0.25) / 0.6) * 1.1) + fbm(n2, x / 12, z / 12) * 0.9;
  };
  // the edge of the world: hills rise all the way round
  const edge = (x, z) => { const r = Math.max(Math.abs(x), Math.abs(z)) / half; return smooth((r - 0.86) / 0.14) * (id === MOUNTAINS ? 22 : 12); };

  // places that must be flat: the trading post, the four plots, lakes
  const post = { x: 0, z: 0, r: 13 };
  const plotSpots = {
    [ARCTIC]: [[-42, -40], [44, -38], [42, 44], [-44, 42]],
    [DESERT]: [[-44, -42], [42, -44], [44, 40], [-42, 42]],
    [FOREST]: [[-40, -44], [44, -40], [40, 44], [-44, 40]],
    [MOUNTAINS]: [[-38, -36], [38, -38], [36, 38], [-38, 36]],
  }[id];
  const lakes = {
    [ARCTIC]: [{ x: -14, z: 28, r: 15 }, { x: 34, z: 2, r: 7 }],
    [DESERT]: [{ x: 22, z: -18, r: 9 }, { x: -34, z: 10, r: 4.5 }],
    [FOREST]: [{ x: -24, z: -16, r: 13 }, { x: 26, z: 20, r: 8 }, { x: 4, z: 46, r: 6 }],
    [MOUNTAINS]: [{ x: 18, z: 16, r: 9 }, { x: -22, z: -6, r: 6 }],
  }[id];
  const flats = [{ x: post.x, z: post.z, r: post.r }, ...plotSpots.map(([x, z]) => ({ x, z, r: 9 }))];
  for (const f of flats) f.y = raw(f.x, f.z);
  // mountain plots and the post sit lower down, so the valley floor is walkable
  if (id === MOUNTAINS) for (const f of flats) f.y = Math.min(f.y, 3 + (f === flats[0] ? 0 : 2));
  for (const l of lakes) { l.y = raw(l.x, l.z); if (id === MOUNTAINS) l.y = Math.min(l.y, 3); l.level = l.y - 0.35; l.bed = l.y - (id === ARCTIC ? 0.9 : 1.15); }

  const h = (x, z) => {
    let y = raw(x, z);
    for (const f of flats) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r + 10) y = lerp(y, f.y, smooth(1 - (d - f.r) / 10)); }
    for (const l of lakes) {
      const d = Math.hypot(x - l.x, z - l.z);
      if (d < l.r + 8) { y = lerp(y, l.y, smooth(1 - (d - l.r) / 8)); if (d < l.r + 1.5) y = lerp(y, l.bed, smooth(1 - (d - l.r * 0.55) / (l.r * 0.45 + 1.5))); }
    }
    return y + edge(x, z);
  };
  const wetAt = (x, z) => { for (const l of lakes) if (Math.hypot(x - l.x, z - l.z) < l.r) return l; return null; };
  const slope = (x, z) => Math.hypot(h(x + 0.7, z) - h(x - 0.7, z), h(x, z + 0.7) - h(x, z - 0.7)) / 1.4;

  // ---------------------------------------------------------------- the trading post and its campfire
  const py = flats[0].y;
  const colliders = [
    { t: 'b', x: 0, y: py, z: -4.2, w: 7.5, h: 3.4, d: 3.4, kind: 'post' },           // the shop hut
    { t: 'b', x: 0, y: py, z: -1.9, w: 6.2, h: 1.05, d: 0.8, kind: 'counter' },       // the counter you trade over
    { t: 'c', x: 0, y: py, z: 5.5, r: 0.75, h: 0.45, kind: 'fire' },                  // the big campfire
    { t: 'b', x: -3.2, y: py, z: 5.4, w: 0.6, h: 0.45, d: 2.4, kind: 'log' },
    { t: 'b', x: 3.2, y: py, z: 5.4, w: 0.6, h: 0.45, d: 2.4, kind: 'log' },
  ];

  // ---------------------------------------------------------------- resource nodes
  const nodes = [], taken = [];
  const clear = (x, z, r) => {
    if (Math.abs(x) > half - 12 || Math.abs(z) > half - 12) return false;
    if (Math.hypot(x - post.x, z - post.z) < post.r + 3) return false;
    for (const [px, pz] of plotSpots) if (Math.hypot(x - px, z - pz) < 10) return false;
    for (const l of lakes) if (Math.hypot(x - l.x, z - l.z) < l.r + 2.2) return false;
    for (const t of taken) if (Math.hypot(x - t[0], z - t[1]) < r + t[2]) return false;
    return slope(x, z) < 0.55;
  };
  const place = (type, count, radius, pick, near = null) => {
    let made = 0, tries = 0;
    while (made < count && tries++ < count * 80) {
      let x, z;
      if (near && R() < near.p) { const c = near.pts[Math.floor(R() * near.pts.length)], a = R() * 6.283, d = near.r0 + R() * near.r1; x = c[0] + Math.cos(a) * d; z = c[1] + Math.sin(a) * d; }
      else { x = (R() - 0.5) * (W - 26); z = (R() - 0.5) * (W - 26); }
      if (!clear(x, z, radius)) continue;
      const v = pick(x, z);
      if (!v) continue;
      taken.push([x, z, radius]);
      const y = Math.min(h(x, z), h(x + 0.6, z), h(x - 0.6, z), h(x, z + 0.6), h(x, z - 0.6));
      nodes.push({ id: nodes.length, type, x: +x.toFixed(2), z: +z.toFixed(2), y: +y.toFixed(3), ...v, rot: R() * 6.283, s: 0.85 + R() * 0.35 });
      made++;
    }
  };
  const C = B.counts;
  const lakePts = lakes.map(l => [l.x, l.z]);
  if (id === ARCTIC) {
    place('tree', C.tree, 2.2, () => ({ v: 'pine', snow: true }), { p: 0.8, pts: [[-50, -5], [10, -50], [55, 20], [-5, 58]], r0: 0, r1: 14 });
    place('rock', C.rock, 2.0, () => ({ v: 'ice' }));
    place('food', C.food, 1.6, () => ({ v: 'fish' }));
    place('gold', C.gold, 2.0, () => ({ v: 'ore' }));
  } else if (id === DESERT) {
    place('tree', 12, 2.0, () => ({ v: 'palm' }), { p: 1, pts: lakePts, r0: 11, r1: 6 });
    place('tree', C.tree - 12, 2.0, () => ({ v: 'dead' }));
    place('rock', C.rock, 2.2, () => ({ v: 'sandstone' }));
    place('food', C.food, 1.4, () => ({ v: 'cactus' }));
    place('gold', C.gold, 2.0, () => ({ v: 'ore' }));
  } else if (id === FOREST) {
    place('tree', C.tree, 2.1, () => ({ v: R() < 0.55 ? 'oak' : 'pine' }), { p: 0.35, pts: [[-55, 20], [55, -10], [10, -55]], r0: 0, r1: 16 });
    place('rock', C.rock, 2.0, () => ({ v: 'granite' }));
    place('food', C.food, 1.4, () => ({ v: 'berry' }));
    place('gold', C.gold, 2.0, () => ({ v: 'ore' }));
  } else {
    place('tree', C.tree, 2.1, (x, z) => h(x, z) < 12 ? { v: 'pine', snow: h(x, z) > 8 } : null);
    place('rock', C.rock, 2.1, (x, z) => ({ v: 'granite', snow: h(x, z) > 10 }));
    place('food', C.food, 1.4, (x, z) => h(x, z) < 9 ? { v: 'berry' } : null);
    place('gold', C.gold, 2.0, (x, z) => ({ v: 'ore', snow: h(x, z) > 10 }), { p: 0.5, pts: [[-55, 0], [55, 0], [0, 55], [0, -55]], r0: 0, r1: 20 });
  }
  // fishing holes sit in the ice: move them onto the lake
  if (id === ARCTIC) {
    const holes = nodes.filter(n => n.type === 'food'); let k = 0;
    for (const n of holes) { const l = lakes[k % lakes.length], a = k * 2.4, d = (0.2 + ((k * 37) % 10) / 16) * l.r * 0.85; n.x = +(l.x + Math.cos(a) * d).toFixed(2); n.z = +(l.z + Math.sin(a) * d).toFixed(2); n.y = l.level; k++; }
  }
  // nodes the googlies bump into
  for (const n of nodes) {
    const s = n.s;
    if (n.type === 'tree') colliders.push({ t: 'c', x: n.x, y: n.y - 0.3, z: n.z, r: (n.v === 'palm' ? 0.28 : n.v === 'dead' ? 0.25 : 0.36) * s, h: 6 * s, node: n.id });
    if (n.type === 'rock') colliders.push(n.v === 'ice' ? { t: 'b', x: n.x, y: n.y - 0.3, z: n.z, w: 1.5 * s, h: 1.5 * s, d: 1.5 * s, node: n.id } : { t: 'c', x: n.x, y: n.y - 0.3, z: n.z, r: 0.95 * s, h: 1.3 * s + 0.3, node: n.id });
    if (n.type === 'gold') colliders.push({ t: 'c', x: n.x, y: n.y - 0.3, z: n.z, r: 0.8 * s, h: 1.1 * s + 0.3, node: n.id });
    if (n.type === 'food' && n.v === 'cactus') colliders.push({ t: 'c', x: n.x, y: n.y - 0.3, z: n.z, r: 0.3 * s, h: 2.2 * s, node: n.id });
  }

  const plots = plotSpots.map(([x, z], i) => ({ i, x, z, y: flats[i + 1].y, r: 6.5 }));
  const spawns = [[-3, 9], [3, 9], [-3, 12], [3, 12]].map(([x, z]) => [x, z]);
  return {
    id, ...B, D: W, h, wetAt, slope, lakes, post: { ...post, y: py, fire: { x: 0, z: 5.5 } }, plots, nodes, colliders, spawns,
    roof: 0,
  };
}

// ------------------------------------------------------------------ Base Camp: the lobby clearing
function buildCamp() {
  const W = 44;
  const colliders = [
    { t: 'c', x: 0, y: 0, z: 0, r: 0.9, h: 0.5, kind: 'fire' },
    ...[0, 1, 2, 3].map(i => { const a = i / 4 * Math.PI * 2; return { t: 'b', x: Math.cos(a) * 3.6, y: 0, z: Math.sin(a) * 3.6, w: 0.6, h: 0.5, d: 2.6, kind: 'log', a }; }).map(c => Math.abs(Math.cos(c.a)) > 0.5 ? { ...c, w: 0.6, d: 2.6 } : { ...c, w: 2.6, d: 0.6 }),
    { t: 'c', x: -12, y: 0, z: 10, r: 1.8, h: 0.5, bounce: 13, kind: 'tramp' },
    { t: 'c', x: 12, y: 0, z: 10, r: 1.8, h: 0.5, bounce: 13, kind: 'tramp' },
    ...[[-14, -12], [-5, -15], [5, -15], [14, -12]].map(([x, z], i) => ({ t: 'b', x, y: 0, z, w: 3.2, h: 2.2, d: 3.4, kind: 'tent', i })),
  ];
  return {
    id: CAMP, key: 'camp', name: 'Base Camp', W, D: W, h: () => 0, wetAt: () => null, slope: () => 0, lakes: [], nodes: [], plots: [],
    colliders, spawns: [[-4, 6], [4, 6], [-6, 2], [6, 2], [0, 8], [-8, 6], [8, 6], [0, -6]],
    shop: { x: 15, z: -2, r: 2.2 }, ground: 'grass', temp: { day: 50, night: 50 },
    sky: { day: ['#6aa8e0', '#d8ecf4'], night: ['#08101c', '#18283a'], fog: '#b8d0c0', fogDay: 0.006, sun: '#fff2d8' },
    labels: BIOMES[2].labels, roof: 0,
  };
}

export const MAPS = [0, 1, 2, 3].map(buildSurvival).concat([buildCamp()]);
export const BIOME_LIST = BIOMES.map((b, i) => ({ id: i, key: b.key, name: b.name, emoji: b.emoji, blurb: b.blurb }));
