// Googly Survival — the whole game: lobby, days and nights, hunger/thirst/temperature, gathering, the trading
// post, shelters, storms, supply crates, bonking, scoring and the computer googlies.
// The same Room runs on the server (online lobbies) and inside the page (PLAY SOLO, no server needed).
import { MAPS, CAMP, MAP_COUNT, BIOME_LIST } from './maps.js';
import * as S from './sim.js';

export const SLOTS = 4;                     // four googlies per game: you + friends + computer googlies
export const DAY_LEN = 120, NIGHT_FRAC = 0.34;
export const RESOURCES = ['wood', 'stone', 'food', 'gold'];
export const BASE_PRICE = { wood: 3, stone: 4, food: 2, gold: 18 };
export const TIERS = [
  { cost: null, prot: 0 },
  { cost: { wood: 6 }, prot: 0.4 },
  { cost: { wood: 12, stone: 5 }, prot: 0.62 },
  { cost: { wood: 20, stone: 12, coins: 30 }, prot: 0.8 },
  { cost: { wood: 30, stone: 24, coins: 80 }, prot: 0.92 },
  { cost: { wood: 40, stone: 40, coins: 200 }, prot: 1 },
];
export const TIER_NAMES = [
  ['No shelter', 'Snow Wall', 'Igloo', 'Ice Cabin', 'Ice Lodge', 'Ice Palace'],
  ['No shelter', 'Tarp Shade', 'Adobe Hut', 'Clay House', 'Sandstone Villa', 'Desert Palace'],
  ['No shelter', 'Lean-to', 'Log Hut', 'Log Cabin', 'Tree Lodge', 'Wooden Fort'],
  ['No shelter', 'Rock Shelter', 'Stone Hut', 'Chalet', 'Mountain Lodge', 'Stone Castle'],
];
export const SHOP = [
  { id: 'ration', name: 'Food Ration', emoji: '🥫', price: 6, desc: '+1 food in your pack' },
  { id: 'bottle', name: 'Water Bottle', emoji: '🧴', price: 4, desc: '+1 water in your canteen' },
  { id: 'axe', name: 'Steel Axe', emoji: '🪓', price: 30, tool: true, desc: 'Chop wood twice as fast' },
  { id: 'pick', name: 'Pickaxe', emoji: '⛏️', price: 40, tool: true, desc: 'Mine stone and gold twice as fast' },
  { id: 'coat', name: 'Warm Coat', emoji: '🧥', price: 35, tool: true, desc: 'The cold gets to you half as fast' },
  { id: 'hat', name: 'Sun Hat', emoji: '👒', price: 25, tool: true, desc: 'The heat gets to you half as fast' },
  { id: 'pack', name: 'Big Backpack', emoji: '🎒', price: 45, tool: true, desc: 'Carry 60 things instead of 30' },
  { id: 'canteen', name: 'Big Canteen', emoji: '🫗', price: 20, tool: true, desc: 'Hold 6 water instead of 3' },
];
export const tierValue = t => { let v = 0; for (let i = 1; i <= t; i++) { const c = TIERS[i].cost; v += (c.wood || 0) * BASE_PRICE.wood + (c.stone || 0) * BASE_PRICE.stone + (c.coins || 0); } return v; };
const GATHER = { tree: ['wood', 0.8, 'axe'], rock: ['stone', 0.95, 'pick'], gold: ['gold', 1.7, 'pick'], food: ['food', 0.7, null] };
const MAX_AMT = { tree: 5, rock: 5, gold: 3, food: 3 };
const REGROW = { tree: 55, rock: 75, gold: 110, food: 35 };
const NODE_R = { tree: 0.4, rock: 1.1, gold: 0.9, food: 0.6 };
const BOTS = [['PINKY', '#ff6fb5'], ['BLUEBERRY', '#2f7bff'], ['LIMEY', '#7bd13b'], ['SUNNY', '#ffc53a'], ['OLLIE', '#ff9500'], ['MINTY', '#00c7be']];
const BOT_LOOK = [['polka', 'pup'], ['none', 'duck'], ['camo', 'none'], ['none', 'bunny'], ['tiger', 'none'], ['none', 'kitty']];
const DIFF = [
  // rest: chance each decision to sit down for a break; gather: how much slower than you they chop and mine
  { name: 'Easy', speed: 0.78, gather: 3.2, think: 1.4, drink: 22, eat: 22, warm: 18, storms: false, bonk: 0, crate: 10, wander: 0.22, rest: 0.3, tools: 0.08 },
  { name: 'Normal', speed: 0.86, gather: 2.2, think: 1.0, drink: 30, eat: 30, warm: 24, storms: false, bonk: 0, crate: 22, wander: 0.12, rest: 0.18, tools: 0.25 },
  { name: 'Hard', speed: 0.95, gather: 1.4, think: 0.6, drink: 38, eat: 38, warm: 27, storms: true, bonk: 1 / 45, crate: 45, wander: 0.04, rest: 0.06, tools: 0.6 },
];
export const DIFF_NAMES = DIFF.map(d => d.name);
const clean = (s, n) => String(s ?? '').replace(/[<>&"]/g, '').trim().slice(0, n);
const r2 = v => Math.round(v * 100) / 100;
const clampI = (v, a, b) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a; };
const angDiff = (a, b) => ((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const NAVS = new Map();
const navFor = id => { if (!NAVS.has(id)) NAVS.set(id, S.buildNav(MAPS[id])); return NAVS.get(id); };
let nextBotId = 900000, nextPickId = 1;

export function newPlayer(o = {}) {
  return {
    id: 0, name: 'GOOGLY', color: '#ff6fb5', skin: 'none', pet: 'none', bot: false,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, onGround: true, crouch: false, stun: 0,
    hp: 100, food: 100, water: 100, temp: 50, inv: { wood: 0, stone: 0, food: 0, gold: 0 }, can: 2, coins: 10, tools: [],
    plot: -1, tier: 0, spent: 0, faints: 0, faintT: 0, gatherT: 0, bonkT: 0, swingT: 0, actT: 0, earned: 0, lastMe: '',
    ...o,
  };
}
const load = p => p.inv.wood + p.inv.stone + p.inv.food + p.inv.gold;
const capOf = p => p.tools.includes('pack') ? 60 : 30;
const canCap = p => p.tools.includes('canteen') ? 6 : 3;

export class Room {
  /** out(player, msg) delivers a message to one human player. */
  constructor({ code = 'SOLO', solo = false, pub = false, name = '', settings = {}, out }) {
    this.code = code; this.solo = solo; this.public = pub; this.name = clean(name, 24); this.out = out;
    this.players = new Map(); this.hostId = 0;
    this.settings = { map: -1, days: 4, diff: 1, cpus: true, bonk: true, storms: true, ...settings };
    this.state = 'lobby'; this.mapId = CAMP; this.map = MAPS[CAMP]; this.nav = navFor(CAMP);
    this.clock = 0; this.rt = 0; this.endT = 0; this.snapAcc = 0; this.boardAcc = 0; this.meAcc = 0;
    this.nodes = []; this.pickups = new Map(); this.crates = new Map(); this.zaps = [];
    this.storm = null; this.stormPlan = null; this.market = { ...BASE_PRICE }; this.day = 0; this.crateT = 40;
    this.syncBots();
  }
  // ---------------------------------------------------------------- messaging
  bcast(m) { for (const p of this.players.values()) if (!p.bot) this.out(p, m); }
  sys(text) { this.bcast({ t: 'chat', sys: true, text }); }
  humans() { return [...this.players.values()].filter(p => !p.bot); }
  pub(p) { return { id: p.id, name: p.name, color: p.color, skin: p.skin, pet: p.pet, bot: p.bot, host: this.hostId === p.id, plot: p.plot, tier: p.tier, tools: p.tools }; }
  full(p) { return { ...this.pub(p), x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw), faint: p.faintT > 0 }; }
  info() { return { code: this.code, public: this.public, name: this.name, host: this.hostId, state: this.state, settings: this.settings, solo: this.solo, players: [...this.players.values()].map(p => this.pub(p)) }; }
  pushRoom() { this.bcast({ t: 'room', room: this.info() }); }
  worldMsg() {
    return {
      t: 'world', map: this.mapId, state: this.state, clock: this.clock, days: this.settings.days, settings: this.settings, day: this.day,
      players: [...this.players.values()].map(p => this.full(p)),
      nodes: this.nodes.map(n => n.amt), pickups: [...this.pickups.values()], crates: [...this.crates.values()],
      market: this.market, storm: this.storm ? { name: this.storm.name, left: this.storm.end - this.clock } : null,
    };
  }
  listing() { return { code: this.code, name: this.name || (this.humans()[0]?.name + "'s camp"), humans: this.humans().length, state: this.state, map: this.settings.map < 0 ? 'Random map' : BIOME_LIST[this.settings.map].name, diff: DIFF[this.settings.diff].name }; }

  // ---------------------------------------------------------------- joining and leaving
  canJoin() { return this.humans().length < SLOTS && (this.state === 'lobby' || [...this.players.values()].some(p => p.bot)); }
  join(p) {
    if (!this.canJoin()) return false;
    if (this.state !== 'lobby') {
      // take over a computer googly's plot (and its shelter) mid-game
      const b = [...this.players.values()].find(q => q.bot);
      this.players.delete(b.id); this.bcast({ t: 'gone', id: b.id });
      Object.assign(p, { plot: b.plot, tier: b.tier, spent: b.spent, hp: 100, food: 90, water: 90, temp: 50, inv: { wood: 0, stone: 0, food: 1, gold: 0 }, can: 2, coins: 10, tools: [], faints: 0, faintT: 0 });
    }
    this.players.set(p.id, p);
    if (!this.hostId || !this.players.has(this.hostId)) this.hostId = p.id;
    this.syncBots();
    this.place(p);
    this.out(p, { t: 'joined', code: this.code, id: p.id });
    this.out(p, this.worldMsg());
    this.bcast({ t: 'join', p: this.full(p) });
    this.pushRoom();
    this.sys(this.state === 'lobby' ? `${p.name} joined the camp` : `${p.name} jumped in and took over a plot`);
    return true;
  }
  leave(p) {
    if (!this.players.has(p.id)) return;
    this.players.delete(p.id);
    this.bcast({ t: 'gone', id: p.id });
    if (!this.humans().length) return;
    if (this.hostId === p.id) this.hostId = this.humans()[0].id;
    if (this.state !== 'lobby' && this.settings.cpus) {
      // a computer googly takes over their plot so the game stays four-a-side
      const b = this.makeBot(); Object.assign(b, { plot: p.plot, tier: p.tier, spent: p.spent, x: p.x, y: p.y, z: p.z });
      this.players.set(b.id, b); this.bcast({ t: 'join', p: this.full(b) });
    } else this.syncBots();
    this.sys(`${p.name} left`);
    this.pushRoom();
  }
  makeBot() {
    const used = new Set([...this.players.values()].map(q => q.name));
    let i = BOTS.findIndex(([n]) => !used.has(n)); if (i < 0) i = 0;
    const [name, color] = BOTS[i], [skin, pet] = BOT_LOOK[i];
    return newPlayer({ id: nextBotId++, name, color, skin, pet, bot: true, diff: this.settings.diff, speedMul: DIFF[this.settings.diff].speed, brain: newBrain() });
  }
  syncBots() {
    const want = this.settings.cpus ? Math.max(0, SLOTS - this.humans().length) : 0;
    const bots = [...this.players.values()].filter(p => p.bot);
    while (bots.length > want) { const b = bots.pop(); this.players.delete(b.id); this.bcast({ t: 'gone', id: b.id }); }
    while (bots.length < want && this.state === 'lobby') {
      const b = this.makeBot(); this.players.set(b.id, b); bots.push(b); this.place(b); this.bcast({ t: 'join', p: this.full(b) });
    }
    for (const b of bots) { b.diff = this.settings.diff; b.speedMul = DIFF[b.diff].speed; }
  }
  place(p) {
    const map = this.map;
    let x, z;
    if (this.state === 'lobby' || this.state === 'end' && this.mapId === CAMP) { const s = map.spawns[Math.floor(Math.random() * map.spawns.length)]; x = s[0] + (Math.random() - 0.5) * 2; z = s[1] + (Math.random() - 0.5) * 2; }
    else { const pl = map.plots[p.plot] || map.plots[0]; const a = Math.random() * 6.28; x = pl.x + Math.cos(a) * 2; z = pl.z + Math.sin(a) * 2; }
    Object.assign(p, { x, z, y: S.groundAt(map, x, z, S.PR, 50), vx: 0, vy: 0, vz: 0, onGround: true, yaw: yawTo(-x, -z) });
    if (p.brain) p.brain = newBrain();
  }

  // ---------------------------------------------------------------- the game itself
  start() {
    if (this.state === 'play') return;
    const all = [...this.players.values()];
    this.mapId = this.settings.map >= 0 ? this.settings.map : Math.floor(Math.random() * MAP_COUNT);
    this.map = MAPS[this.mapId]; this.nav = navFor(this.mapId);
    this.state = 'play'; this.clock = 0; this.day = 0; this.storm = null; this.stormPlan = null; this.zaps = []; this.crateT = 35 + Math.random() * 15;
    this.nodes = this.map.nodes.map(n => ({ amt: MAX_AMT[n.type], regrow: 0 }));
    this.pickups.clear(); this.crates.clear();
    const plots = shuffle([0, 1, 2, 3]);
    all.forEach((p, i) => Object.assign(p, { plot: plots[i % 4], tier: 0, spent: 0, hp: 100, food: 100, water: 100, temp: 50, inv: { wood: 0, stone: 0, food: 2, gold: 0 }, can: 2, coins: 10, tools: [], faints: 0, faintT: 0, earned: 0, stun: 0, lastMe: '' }));
    for (const p of all) this.place(p);
    this.newDay();
    this.bcast(this.worldMsg());
    this.pushRoom();
    const b = BIOME_LIST[this.mapId];
    this.sys(`${b.emoji} ${b.name}! Survive ${this.settings.days} days. Most money + best shelter wins.`);
  }
  newDay() {
    this.day++;
    const prev = this.market;
    this.market = {};
    for (const k of RESOURCES) this.market[k] = Math.max(1, Math.round(BASE_PRICE[k] * (0.6 + Math.random() * 1.0)));
    if (this.day === 1) this.market = { ...BASE_PRICE };
    // a storm some time today (never in the first minute of the game)
    if (this.settings.storms) { const at = (this.day - 1) * DAY_LEN + (this.day === 1 ? 70 : 12 + Math.random() * 90); this.stormPlan = { warn: at - 12, start: at, end: at + 26, warned: false }; }
    if (this.day > 1) {
      const best = RESOURCES.map(k => [k, this.market[k] / BASE_PRICE[k]]).sort((a, b) => b[1] - a[1])[0];
      const lab = this.map.labels[best[0]];
      this.bcast({ t: 'day', day: this.day, market: this.market, prev });
      this.sys(`☀️ Day ${this.day} of ${this.settings.days}. Hot tip: ${lab} sells for $${this.market[best[0]]} today!`);
    }
  }
  endGame() {
    this.state = 'end'; this.endT = this.solo ? 1e9 : 16;
    const rows = [...this.players.values()].map(p => {
      const invValue = RESOURCES.reduce((a, k) => a + p.inv[k] * this.market[k], 0);
      const money = p.coins + invValue, shelter = p.spent;
      return { id: p.id, name: p.name, color: p.color, bot: p.bot, coins: p.coins, invValue, money, tier: p.tier, shelter, faints: p.faints, total: money + shelter - p.faints * 40 };
    }).sort((a, b) => b.total - a.total);
    const top = (f, g = () => 0) => rows.slice().sort((a, b) => f(b) - f(a) || g(b) - g(a))[0];
    const awards = [
      { k: 'rich', emoji: '💰', title: 'Richest', id: top(r => r.money).id, val: '$' + top(r => r.money).money },
      { k: 'home', emoji: '🏠', title: 'Best Shelter', id: top(r => r.tier, r => r.shelter).id, val: TIER_NAMES[this.mapId][top(r => r.tier, r => r.shelter).tier] },
      { k: 'tough', emoji: '❤️', title: 'Toughest', id: top(r => -r.faints, r => r.total).id, val: top(r => -r.faints, r => r.total).faints + ' faints' },
    ];
    this.bcast({ t: 'end', rows, awards, map: this.mapId });
    rows.forEach((r, i) => {
      const p = this.players.get(r.id); if (!p || p.bot) return;
      const items = [[['1st place!', '2nd place', '3rd place', '4th place'][i], [120, 70, 45, 25][i]]];
      if (r.tier) items.push([`Built a ${TIER_NAMES[this.mapId][r.tier]}`, r.tier * 12]);
      if (!r.faints) items.push(['Never fainted', 30]);
      for (const a of awards) if (a.id === r.id) items.push([`${a.emoji} ${a.title}`, 25]);
      this.out(p, { t: 'stars', items, total: items.reduce((a, b) => a + b[1], 0) });
    });
    this.pushRoom();
  }
  toLobby() {
    this.state = 'lobby'; this.mapId = CAMP; this.map = MAPS[CAMP]; this.nav = navFor(CAMP); this.storm = null; this.stormPlan = null;
    this.pickups.clear(); this.crates.clear(); this.nodes = [];
    this.syncBots();
    for (const p of this.players.values()) { p.faintT = 0; p.stun = 0; this.place(p); }
    this.bcast(this.worldMsg());
    this.pushRoom();
  }

  // ---------------------------------------------------------------- saving a solo game (every 30 s) and carrying on later
  save() {
    if (this.state !== 'play') return null;
    return {
      v: 1, settings: this.settings, mapId: this.mapId, clock: this.clock, day: this.day, market: this.market, stormPlan: this.stormPlan, storm: this.storm, crateT: this.crateT,
      nodes: this.nodes, pickups: [...this.pickups.values()], crates: [...this.crates.values()],
      players: [...this.players.values()].map(p => { const { ws, brain, room, lastMe, ...rest } = p; void ws; void brain; void room; void lastMe; return rest; }),
    };
  }
  restore(d, human) {
    Object.assign(this, { settings: d.settings, mapId: d.mapId, map: MAPS[d.mapId], nav: navFor(d.mapId), state: 'play', clock: d.clock, day: d.day, market: d.market, stormPlan: d.stormPlan, storm: null, crateT: d.crateT, nodes: d.nodes, zaps: [] });
    if (d.stormPlan && d.clock >= d.stormPlan.start && d.clock < d.stormPlan.end) this.stormPlan.warned = false, this.stormPlan.warn = d.clock + 3, this.stormPlan.start = d.clock + 15, this.stormPlan.end = d.clock + 40;
    this.pickups = new Map(d.pickups.map(k => [k.id, k])); this.crates = new Map(d.crates.map(c => [c.id, c]));
    for (const k of [...d.pickups, ...d.crates]) nextPickId = Math.max(nextPickId, k.id + 1);
    this.players.clear();
    for (const s of d.players) {
      if (s.bot) { const b = newPlayer({ ...s, brain: newBrain() }); this.players.set(b.id, b); nextBotId = Math.max(nextBotId, b.id + 1); }
      else { const { id, name, color, skin, pet } = human; Object.assign(human, s, { id, name, color, skin, pet, lastMe: '' }); this.players.set(human.id, human); }
    }
    this.hostId = human.id;
    this.out(human, { t: 'joined', code: this.code, id: human.id });
    this.out(human, this.worldMsg());
    this.pushRoom();
    this.sys(`Welcome back! Day ${this.day} of ${this.settings.days}.`);
  }

  // ---------------------------------------------------------------- the weather and the clock
  nightness(t = this.clock) {
    const d = (t % DAY_LEN) / DAY_LEN, n0 = 1 - NIGHT_FRAC;
    if (d < 0.05) return 1 - smooth(d / 0.05);               // dawn
    if (d > n0 - 0.05 && d < n0 + 0.03) return smooth((d - (n0 - 0.05)) / 0.08);   // dusk
    return d >= n0 ? 1 : 0;
  }
  shelterOf(p) {
    const pl = this.map.plots?.[p.plot];
    if (!pl || !p.tier) return 0;
    return Math.hypot(p.x - pl.x, p.z - pl.z) < pl.r ? TIERS[p.tier].prot : 0;
  }
  nearFire(p) { const f = this.map.post?.fire; return f && Math.hypot(p.x - f.x, p.z - f.z) < 7.5; }
  envTemp(p) {
    const m = this.map;
    let env = m.temp.day + (m.temp.night - m.temp.day) * this.nightness();
    if (this.mapId === 3) env -= Math.max(0, p.y - 5) * 1.8;          // it's colder up the mountain
    if (this.storm) env = env + (m.storm.temp - env) * 0.85;
    const lake = m.wetAt(p.x, p.z); if (lake && p.y < lake.level + 0.2) env = this.mapId === 0 ? -20 : Math.min(env, env - 12);
    if (p.tools.includes('coat') && env < 50) env = Math.min(50, env + 12);
    if (p.tools.includes('hat') && env > 50) env = Math.max(50, env - 12);
    if (this.nearFire(p)) env = env < 55 ? 55 + (env - 55) * 0.2 : env;
    // a shelter has a fire (or shade) inside: the better the shelter, the comfier it is
    const prot = this.shelterOf(p);
    if (prot) env += ((env < 50 ? 62 : 44) - env) * prot;
    return env;
  }
  tickStorm() {
    const P = this.stormPlan;
    if (P && !this.storm && this.clock >= P.end) { this.stormPlan = null; return; }
    if (P && !P.warned && this.clock >= P.warn) { P.warned = true; this.bcast({ t: 'storm', k: 'warn', name: this.map.storm.name, in: 12 }); this.sys(`${this.map.storm.emoji} ${this.map.storm.warn}`); }
    if (P && !this.storm && this.clock >= P.start && this.clock < P.end) { this.storm = { name: this.map.storm.name, end: P.end, zapT: 2 }; this.bcast({ t: 'storm', k: 'start', name: this.storm.name, left: P.end - this.clock }); }
    if (this.storm && this.clock >= this.storm.end) { this.storm = null; this.stormPlan = null; this.bcast({ t: 'storm', k: 'end' }); }
  }
  tickZaps(dt) {
    const st = this.map.storm;
    if (this.storm && st.zap) {
      this.storm.zapT -= dt;
      if (this.storm.zapT <= 0) {
        this.storm.zapT = 0.9 + Math.random() * 1.1;
        const exposed = [...this.players.values()].filter(p => p.faintT <= 0 && this.shelterOf(p) < 0.6 && !this.nearFire(p));
        if (exposed.length) {
          const p = exposed[Math.floor(Math.random() * exposed.length)], a = Math.random() * 6.28, d = Math.random() < 0.35 ? 0.5 : 1.5 + Math.random() * 5;
          const z = { x: r2(p.x + Math.cos(a) * d), z: r2(p.z + Math.sin(a) * d), at: this.clock + 1.3, k: st.rocks ? 'rock' : 'bolt' };
          z.y = r2(this.map.h(z.x, z.z));
          this.zaps.push(z); this.bcast({ t: 'zap', ...z, warn: 1.3 });
        }
      }
    }
    for (const z of this.zaps) {
      if (this.clock < z.at) continue;
      z.done = true;
      this.bcast({ t: 'boom', x: z.x, y: z.y, z: z.z, k: z.k });
      for (const p of this.players.values()) {
        if (p.faintT > 0) continue;
        const d = Math.hypot(p.x - z.x, p.z - z.z);
        if (d < 2.9) { this.hurt(p, 26, z.k === 'rock' ? 'squashed by a boulder' : 'zapped by lightning'); this.knock(p, p.x - z.x, p.z - z.z, 6, 5); }
      }
    }
    this.zaps = this.zaps.filter(z => !z.done);
  }
  tickCrates(dt) {
    if (this.nightness() > 0.5) return;
    this.crateT -= dt;
    if (this.crateT <= 0) {
      this.crateT = 50 + Math.random() * 35;
      const nav = this.nav, m = this.map;
      for (let tries = 0; tries < 60; tries++) {
        const x = (Math.random() - 0.5) * (m.W - 40), z = (Math.random() - 0.5) * (m.D - 40);
        if (m.plots.some(pl => Math.hypot(pl.x - x, pl.z - z) < 14) || Math.hypot(x, z) < 16 || m.wetAt(x, z)) continue;
        const k = S.navNode(nav, x, m.h(x, z) + 0.2, z); if (k < 0 || Math.abs(nav.floor[k] - m.h(x, z)) > 0.3) continue;
        const items = {}; for (let i = 0, n = 4 + Math.floor(Math.random() * 5); i < n; i++) { const r = RESOURCES[Math.floor(Math.random() * 4)]; items[r] = (items[r] || 0) + (r === 'gold' ? 1 : 2); }
        const c = { id: nextPickId++, x: r2(x), y: r2(m.h(x, z)), z: r2(z), coins: 20 + Math.floor(Math.random() * 35), items, until: this.clock + 70 };
        this.crates.set(c.id, c);
        this.bcast({ t: 'crate', c });
        this.sys('📦 A supply crate is parachuting down! First googly there gets it.');
        break;
      }
    }
    for (const c of this.crates.values()) if (this.clock > c.until) { this.crates.delete(c.id); this.bcast({ t: 'crategone', id: c.id }); }
  }

  // ---------------------------------------------------------------- being a googly
  hurt(p, n, why) {
    if (p.faintT > 0) return;
    p.hp -= n; p.lastWhy = why;
    if (!p.bot) this.out(p, { t: 'ouch', n: Math.round(n), why });
  }
  knock(p, dx, dz, sp, up) {
    const d = Math.hypot(dx, dz) || 1, vx = dx / d * sp, vz = dz / d * sp;
    p.stun = 0.45;
    if (p.bot) { p.vx = vx; p.vz = vz; p.vy = up; p.onGround = false; }
    else this.out(p, { t: 'kb', vx: r2(vx), vy: up, vz: r2(vz) });
  }
  faint(p) {
    p.faintT = 7; p.faints++; p.hp = 0;
    // drop half of everything you were carrying (and a quarter of your money) where you fell
    const items = {}; let any = false;
    for (const k of RESOURCES) { const n = Math.floor(p.inv[k] / 2); if (n) { items[k] = n; p.inv[k] -= n; any = true; } }
    const coins = Math.floor(p.coins / 4); p.coins -= coins;
    if (any || coins) this.drop(p.x, p.y, p.z, items, coins, p.id);
    this.bcast({ t: 'fx', k: 'faint', id: p.id, why: p.lastWhy || 'fainted' });
    this.sys(`😵 ${p.name} fainted (${p.lastWhy || 'too tired'}) and dropped stuff!`);
  }
  respawn(p) {
    p.faintT = 0; p.hp = 60; p.food = Math.max(p.food, 55); p.water = Math.max(p.water, 55); p.temp = 50; p.stun = 0;
    this.place(p);
    if (!p.bot) this.out(p, { t: 'tp', x: r2(p.x), y: r2(p.y), z: r2(p.z) });
    this.bcast({ t: 'fx', k: 'wake', id: p.id });
  }
  drop(x, y, z, items, coins, by) {
    const k = { id: nextPickId++, x: r2(x + (Math.random() - 0.5) * 0.6), y: r2(y), z: r2(z + (Math.random() - 0.5) * 0.6), items, coins, by, t: this.clock };
    this.pickups.set(k.id, k);
    this.bcast({ t: 'pick', add: [k] });
  }
  give(p, items, coins) {
    const left = {}; let any = false;
    for (const k of RESOURCES) { const n = items[k] || 0; const can = Math.min(n, capOf(p) - load(p)); p.inv[k] += can; if (n - can > 0) { left[k] = n - can; any = true; } }
    p.coins += coins || 0; p.earned += coins || 0;
    return any ? left : null;
  }
  tickPlayer(p, dt) {
    if (p.faintT > 0) { p.faintT -= dt; if (p.faintT <= 0) this.respawn(p); return; }
    if (this.state !== 'play') return;
    const st = this.map.storm, prot = this.shelterOf(p), fire = this.nearFire(p);
    // body temperature drifts towards the air around you
    const env = this.envTemp(p);
    let rate = 0.03;
    if (env > p.temp && p.temp < 45 && (fire || prot)) rate = 0.075;        // warming up by a fire is quick
    if (env < p.temp && p.temp > 55 && prot) rate = 0.075;                   // and so is cooling off in the shade
    if (env < p.temp && p.tools.includes('coat')) rate *= 0.5;
    if (env > p.temp && p.tools.includes('hat')) rate *= 0.5;
    p.temp += (env - p.temp) * (1 - Math.exp(-rate * dt));
    const moving = Math.hypot(p.vx, p.vz) > 5.2;
    p.food -= 0.4 * dt * (moving ? 1.25 : 1);
    p.water -= (0.52 + (p.temp > 64 ? 0.35 : 0) + (this.storm ? 0.3 * st.water : 0)) * dt * (moving ? 1.2 : 1);
    p.food = Math.max(0, p.food); p.water = Math.max(0, p.water);
    let dmg = 0;
    if (p.temp < 25) dmg += (25 - p.temp) / 25 * 2.4 + 0.2;
    if (p.temp > 76) dmg += (p.temp - 76) / 24 * 2.4 + 0.2;
    if (p.food <= 0) dmg += 0.9;
    if (p.water <= 0) dmg += 1.3;
    if (this.storm && !fire) dmg += st.hurt * (1 - prot);
    if (dmg) { p.hp -= dmg * dt; p.lastWhy = p.water <= 0 ? 'too thirsty' : p.food <= 0 ? 'too hungry' : p.temp < 25 ? 'froze' : p.temp > 76 ? 'overheated' : `caught in the ${st.name.toLowerCase()}`; }
    else if (p.food > 35 && p.water > 35) p.hp += (prot ? 1.6 : fire ? 1.0 : 0.45) * dt;
    p.hp = Math.min(100, p.hp);
    if (p.hp <= 0) this.faint(p);
    // walk over dropped things to pick them up
    for (const k of this.pickups.values()) {
      if (Math.hypot(k.x - p.x, k.z - p.z) > 1.5 || Math.abs(k.y - p.y) > 2) continue;
      if (this.clock - k.t < (k.by === p.id ? 2.5 : 0.5)) continue;
      const left = this.give(p, k.items, k.coins);
      this.pickups.delete(k.id);
      this.bcast({ t: 'pick', rm: [k.id], by: p.id });
      if (left) this.drop(k.x, k.y, k.z, left, 0, p.id);
    }
  }

  // ---------------------------------------------------------------- actions (from a player's message or a computer googly's brain)
  act(p, m) {
    if (this.state !== 'play' || p.faintT > 0) return;
    const t = this.clock;
    switch (m.t) {
      case 'gather': {
        const n = this.map.nodes[m.id | 0], s = this.nodes[m.id | 0]; if (!n || !s || s.amt <= 0) return;
        const [res, base, tool] = GATHER[n.type];
        const every = base * (tool && p.tools.includes(tool) ? 0.5 : 1) * (p.bot ? DIFF[p.diff].gather : 1);
        if (t < p.gatherT) return;
        if (Math.hypot(n.x - p.x, n.z - p.z) > S.REACH + NODE_R[n.type] * n.s + 0.4) return;
        if (load(p) >= capOf(p)) { if (!p.bot) this.out(p, { t: 'toast', text: 'Your backpack is full — sell stuff at the trading post or build!' }); p.gatherT = t + 1; return; }
        p.gatherT = t + every; p.swingT = 0.35;
        p.inv[res]++; s.amt--;
        if (n.v === 'cactus') p.water = Math.min(100, p.water + 8);
        if (s.amt <= 0) s.regrow = t + REGROW[n.type] * (0.85 + Math.random() * 0.3);
        this.bcast({ t: 'node', id: n.id, amt: s.amt, by: p.id, res });
        break;
      }
      case 'drink': {
        if (t < p.actT) return;
        const lake = this.map.lakes.find(l => Math.hypot(p.x - l.x, p.z - l.z) < l.r + 2.4); if (!lake) return;
        p.actT = t + 0.45; p.water = Math.min(100, p.water + 34); p.can = canCap(p); p.swingT = 0.3;
        this.bcast({ t: 'fx', k: 'drink', id: p.id });
        break;
      }
      case 'eat': if (p.inv.food > 0 && p.food < 96 && t >= p.actT) { p.actT = t + 0.4; p.inv.food--; p.food = Math.min(100, p.food + 30); this.bcast({ t: 'fx', k: 'eat', id: p.id }); } break;
      case 'sip': if (p.can > 0 && p.water < 96 && t >= p.actT) { p.actT = t + 0.4; p.can--; p.water = Math.min(100, p.water + 35); this.bcast({ t: 'fx', k: 'drink', id: p.id }); } break;
      case 'build': {
        const pl = this.map.plots[p.plot]; if (!pl || Math.hypot(p.x - pl.x, p.z - pl.z) > pl.r + 2.5 || p.tier >= 5) return;
        const c = TIERS[p.tier + 1].cost;
        if ((c.wood || 0) > p.inv.wood || (c.stone || 0) > p.inv.stone || (c.coins || 0) > p.coins) { if (!p.bot) this.out(p, { t: 'toast', text: 'Not enough materials yet' }); return; }
        p.inv.wood -= c.wood || 0; p.inv.stone -= c.stone || 0; p.coins -= c.coins || 0;
        p.tier++; p.spent = tierValue(p.tier);
        this.bcast({ t: 'tier', id: p.id, tier: p.tier });
        this.sys(`🏠 ${p.name} built a ${TIER_NAMES[this.mapId][p.tier]}!`);
        break;
      }
      case 'sell': {
        if (!this.atPost(p)) return;
        const k = RESOURCES.includes(m.item) ? m.item : null; if (!k) return;
        const n = m.n === 'all' ? p.inv[k] : Math.min(p.inv[k], clampI(m.n, 1, 99)); if (!n) return;
        p.inv[k] -= n; const got = n * this.market[k]; p.coins += got; p.earned += got;
        this.bcast({ t: 'fx', k: 'sell', id: p.id, got });
        break;
      }
      case 'buy': {
        if (!this.atPost(p)) return;
        const it = SHOP.find(s => s.id === m.item); if (!it) return;
        if (it.tool && p.tools.includes(it.id)) return;
        if (p.coins < it.price) { if (!p.bot) this.out(p, { t: 'toast', text: `You need $${it.price - p.coins} more` }); return; }
        if (it.id === 'ration' && load(p) >= capOf(p)) return;
        if (it.id === 'bottle' && p.can >= canCap(p)) return;
        p.coins -= it.price;
        if (it.id === 'ration') p.inv.food++; else if (it.id === 'bottle') p.can++; else p.tools.push(it.id);
        this.bcast({ t: 'fx', k: 'buy', id: p.id, item: it.id });
        if (it.tool) this.bcast({ t: 'tools', id: p.id, tools: p.tools });
        break;
      }
      case 'open': {
        const c = this.crates.get(m.id | 0); if (!c || Math.hypot(c.x - p.x, c.z - p.z) > 2.8) return;
        this.crates.delete(c.id);
        const left = this.give(p, c.items, c.coins);
        if (left) this.drop(c.x, c.y, c.z, left, 0, p.id);
        this.bcast({ t: 'crategone', id: c.id, by: p.id, coins: c.coins, items: c.items });
        this.sys(`📦 ${p.name} grabbed the supply crate (+$${c.coins})!`);
        break;
      }
      case 'bonk': {
        if (!this.settings.bonk || t < p.bonkT) return;
        p.bonkT = t + 1.6; p.swingT = 0.35;
        let best = null, bd = 2.6;
        for (const q of this.players.values()) {
          if (q === p || q.faintT > 0) continue;
          const d = Math.hypot(q.x - p.x, q.z - p.z);
          if (d < bd && Math.abs(q.y - p.y) < 1.6 && (d < 1.2 || Math.abs(angDiff(yawTo(q.x - p.x, q.z - p.z), p.yaw)) < 1.2)) { bd = d; best = q; }
        }
        this.bcast({ t: 'fx', k: 'swing', id: p.id });
        if (!best) return;
        this.knock(best, best.x - p.x, best.z - p.z, 8, 5.5);
        const have = RESOURCES.filter(k => best.inv[k] > 0);
        const items = {}; let coins = 0;
        if (have.length) { const k = have[Math.floor(Math.random() * have.length)]; best.inv[k]--; items[k] = 1; }
        else if (best.coins >= 3) { coins = 3; best.coins -= 3; }
        if (have.length || coins) this.drop(best.x, best.y, best.z, items, coins, best.id);
        this.bcast({ t: 'fx', k: 'bonk', id: p.id, tg: best.id });
        break;
      }
    }
  }
  atPost(p) { const q = this.map.post; return q && Math.hypot(p.x - q.x, p.z - (q.z - 1.9)) < 5.5; }

  // ---------------------------------------------------------------- messages from a human
  handle(p, m) {
    switch (m.t) {
      case 'set':
        if (this.hostId !== p.id) return;
        { const s = m.settings || {};
          if (s.map !== undefined) this.settings.map = clampI(s.map, -1, MAP_COUNT - 1);
          if (s.days !== undefined) this.settings.days = clampI(s.days, 1, 10);
          if (s.diff !== undefined) this.settings.diff = clampI(s.diff, 0, 2);
          for (const k of ['cpus', 'bonk', 'storms']) if (s[k] !== undefined) this.settings[k] = !!s[k];
          if (s.public !== undefined) this.public = !!s.public;
          if (this.state === 'lobby') this.syncBots(); else for (const b of this.players.values()) if (b.bot) { b.diff = this.settings.diff; b.speedMul = DIFF[b.diff].speed; }
          this.pushRoom(); }
        break;
      case 'start': if (this.hostId === p.id && this.state !== 'play') { if (this.state === 'end') { this.state = 'lobby'; this.syncBots(); } this.start(); } break;
      case 'lobby': if (this.hostId === p.id && this.state === 'end') this.toLobby(); break;
      case 'chat': { const text = clean(m.text, 140); if (text) this.bcast({ t: 'chat', from: p.name, color: p.color, text }); break; }
      case 'st': {
        if (p.faintT > 0) return;
        if (m.w !== this.mapId) return;                  // still on the old map
        const x = +m.x, y = +m.y, z = +m.z;
        if (![x, y, z].every(Number.isFinite)) return;
        const map = this.map;
        if (Math.hypot(x - p.x, z - p.z) < 14) { p.x = Math.max(-map.W / 2, Math.min(map.W / 2, x)); p.z = Math.max(-map.D / 2, Math.min(map.D / 2, z)); p.y = Math.max(-5, Math.min(80, y)); }
        else this.out(p, { t: 'tp', x: r2(p.x), y: r2(p.y), z: r2(p.z) });
        p.vx = +m.vx || 0; p.vz = +m.vz || 0; p.yaw = +m.yaw || 0; p.onGround = !!m.g;
        break;
      }
      default: this.act(p, m);
    }
  }

  // ---------------------------------------------------------------- one server tick
  tick(dt) {
    this.rt += dt;
    if (this.state === 'play') {
      this.clock += dt;
      if (Math.floor(this.clock / DAY_LEN) + 1 > this.day && this.clock < this.settings.days * DAY_LEN) this.newDay();
      this.tickStorm(); this.tickZaps(dt); this.tickCrates(dt);
      for (let i = 0; i < this.nodes.length; i++) { const s = this.nodes[i]; if (s.amt <= 0 && this.clock >= s.regrow) { s.amt = MAX_AMT[this.map.nodes[i].type]; this.bcast({ t: 'node', id: i, amt: s.amt }); } }
      if (this.clock >= this.settings.days * DAY_LEN) this.endGame();
    } else if (this.state === 'end') { this.endT -= dt; if (this.endT <= 0) this.toLobby(); }
    for (const p of this.players.values()) {
      p.swingT = Math.max(0, p.swingT - dt);
      this.tickPlayer(p, dt);
      if (p.bot) { try { botThink(this, p, dt); } catch (e) { console.error('bot', e); } }
    }
    // snapshots: where everyone is
    this.snapAcc += dt;
    if (this.snapAcc >= 1 / 20) {
      this.snapAcc = 0;
      const e = [];
      for (const p of this.players.values()) e.push([p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.yaw), (p.onGround ? 2 : 0) | (p.faintT > 0 ? 4 : 0) | (p.swingT > 0 ? 8 : 0) | (p.stun > 0 ? 16 : 0), r2(p.vx), r2(p.vz)]);
      this.bcast({ t: 'snap', st: this.state, clock: r2(this.clock), e });
    }
    // your own bars and backpack, a few times a second
    this.meAcc += dt;
    if (this.meAcc >= 0.2) {
      this.meAcc = 0;
      for (const p of this.players.values()) {
        if (p.bot) continue;
        const m = { t: 'me', hp: Math.round(p.hp), food: Math.round(p.food), water: Math.round(p.water), temp: Math.round(p.temp), env: Math.round(this.state === 'play' ? this.envTemp(p) : 50), inv: p.inv, can: p.can, cap: capOf(p), canCap: canCap(p), coins: p.coins, tools: p.tools, tier: p.tier, faint: r2(Math.max(0, p.faintT)), shelter: this.state === 'play' ? this.shelterOf(p) : 0 };
        const s = JSON.stringify(m); if (s !== p.lastMe) { p.lastMe = s; this.out(p, m); }
      }
    }
    // the leaderboard
    this.boardAcc += dt;
    if (this.boardAcc >= 1 && this.state === 'play') {
      this.boardAcc = 0;
      this.bcast({ t: 'board', rows: [...this.players.values()].map(p => [p.id, p.coins + RESOURCES.reduce((a, k) => a + p.inv[k] * this.market[k], 0), p.tier, p.faints, Math.round(p.hp), p.spent]) });
    }
  }
}

// ==================================================================== computer googlies
function newBrain() { return { task: null, thinkT: Math.random() * 0.5, path: null, goal: null, pathT: 0, stuckT: 0, lastPos: null, stuck: 0, jump: false, waitT: 0, hopT: 2 + Math.random() * 6, wander: null, noPath: 0 }; }

function walkTo(R, p, dt, goal, sprint = false) {
  const B = p.brain, map = R.map, nav = R.nav, t = R.rt;
  const gy = goal[2] ?? map.h(goal[0], goal[1]);
  if (!B.path || !B.goal || Math.hypot(goal[0] - B.goal[0], goal[1] - B.goal[1]) > 1 || t - B.pathT > 3) {
    B.goal = goal; B.pathT = t; B.path = S.findPath(nav, p.x, p.y, p.z, goal[0], gy, goal[1]);
    if (!B.path) B.noPath++;
  }
  let f = { dx: 0, dz: 0, jump: false, done: false };
  if (B.path) f = S.followPath(p, B.path, nav);
  const there = f.done || Math.hypot(goal[0] - p.x, goal[1] - p.z) < 0.7;
  if (!B.lastPos) B.lastPos = [p.x, p.z];
  B.stuckT += dt;
  if (B.stuckT > 0.8) {
    const moved = Math.hypot(p.x - B.lastPos[0], p.z - B.lastPos[1]);
    if (moved < 0.3 && (f.dx || f.dz) && !there) { B.jump = true; B.stuck++; if (B.stuck > 1) B.path = null; if (B.stuck > 4) { B.noPath += 2; B.stuck = 0; } } else B.stuck = 0;
    B.stuckT = 0; B.lastPos = [p.x, p.z];
  }
  const dx = there ? 0 : f.dx, dz = there ? 0 : f.dz;
  S.stepPlayer(p, { dx, dz, jump: (f.jump || B.jump) && !there, sprint }, dt, map);
  B.jump = false;
  if (dx || dz) turnTo(p, yawTo(dx, dz), dt, 9);
  return there;
}
const turnTo = (p, yaw, dt, rate = 8) => { p.yaw += angDiff(yaw, p.yaw) * (1 - Math.exp(-rate * dt)); };
const standStill = (R, p, dt) => S.stepPlayer(p, { dx: 0, dz: 0, jump: false, sprint: false }, dt, R.map);

// a spot next to a node where a googly can stand and reach it
function approach(R, p, n) {
  const nav = R.nav, map = R.map, r = NODE_R[n.type] * n.s + 1.0;
  let best = null, bd = 1e9;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, x = n.x + Math.cos(a) * r, z = n.z + Math.sin(a) * r;
    const k = S.navNode(nav, x, map.h(x, z) + 0.3, z);
    if (k < 0 || Math.abs(nav.floor[k] - map.h(x, z)) > 0.4) continue;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < bd) { bd = d; best = [x, z]; }
  }
  return best;
}
function nearestNode(R, p, type, avoid) {
  let best = null, bd = 1e9;
  const taken = new Set([...R.players.values()].filter(q => q.bot && q !== p && q.brain.task?.node !== undefined).map(q => q.brain.task.node));
  R.map.nodes.forEach((n, i) => {
    if (n.type !== type || R.nodes[i].amt <= 0 || (avoid && avoid.has(i))) return;
    let d = Math.hypot(n.x - p.x, n.z - p.z) + (taken.has(i) ? 25 : 0) + Math.abs(n.y - p.y) * 2;
    if (d < bd) { bd = d; best = n; }
  });
  return best;
}
function nearestWater(R, p) {
  let best = null, bd = 1e9;
  for (const l of R.map.lakes) {
    const a = Math.atan2(p.z - l.z, p.x - l.x);
    for (const da of [0, 0.6, -0.6, 1.2, -1.2, 2, -2, 3]) {
      const x = l.x + Math.cos(a + da) * (l.r + 0.8), z = l.z + Math.sin(a + da) * (l.r + 0.8);
      const k = S.navNode(R.nav, x, R.map.h(x, z) + 0.3, z); if (k < 0) continue;
      const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; best = [x, z]; }
      break;
    }
  }
  return best;
}
function need(R, p) {
  if (p.tier >= 5) return { wood: 0, stone: 0, coins: 0 };
  const c = TIERS[p.tier + 1].cost;
  return { wood: Math.max(0, (c.wood || 0) - p.inv.wood), stone: Math.max(0, (c.stone || 0) - p.inv.stone), coins: Math.max(0, (c.coins || 0) - p.coins) };
}

function botThink(R, p, dt) {
  const B = p.brain, D = DIFF[p.diff ?? 1];
  if (p.faintT > 0) return;
  if (R.state !== 'play') {
    // hang around the camp: wander, hop on the trampolines, warm up by the fire
    B.waitT -= dt;
    if (B.waitT > 0) { standStill(R, p, dt); return; }
    if (!B.wander) B.wander = [(Math.random() - 0.5) * (R.map.W - 10), (Math.random() - 0.5) * (R.map.D - 10)];
    B.hopT -= dt; if (B.hopT <= 0) { B.hopT = 2 + Math.random() * 7; B.jump = true; }
    if (walkTo(R, p, dt, B.wander) || B.noPath > 2) { B.wander = null; B.noPath = 0; B.waitT = 1 + Math.random() * 4; }
    return;
  }
  B.thinkT -= dt;
  if (B.thinkT <= 0 || !B.task) { B.thinkT = D.think * (0.7 + Math.random() * 0.6); decide(R, p, B, D); }
  doTask(R, p, B, D, dt);
}

function decide(R, p, B, D) {
  const cur = B.task, map = R.map, pl = map.plots[p.plot], home = pl ? [pl.x, pl.z] : [0, 8];
  const set = task => { if (!cur || cur.k !== task.k || cur.node !== task.node || cur.id !== task.id) { B.task = task; B.path = null; B.noPath = 0; } };
  // quick fixes that don't need walking
  if (p.water < D.drink && p.can > 0) R.act(p, { t: 'sip' });
  if (p.food < D.eat + 15 && p.inv.food > 0) R.act(p, { t: 'eat' });
  const storm = R.storm || (R.stormPlan?.warned && R.clock > R.stormPlan.warn);
  // 1. thirsty and nothing in the canteen: go to the water
  if (p.water < D.drink && p.can <= 0 || cur?.k === 'drink' && (p.water < 96 || p.can < canCap(p))) { const w = nearestWater(R, p); if (w) return set({ k: 'drink', to: w }); }
  // 2. hungry and no food: pick some (or buy some if we're rich and near the post)
  if (p.food < D.eat && p.inv.food <= 0 || cur?.k === 'gather' && cur.type === 'food' && p.inv.food < 2 && p.food < 70) {
    if (p.coins >= 12 && Math.hypot(p.x, p.z) < 30) return set({ k: 'post', buy: ['ration', 'ration'] });
    const n = nearestNode(R, p, 'food'); if (n) return set({ k: 'gather', node: n.id, type: 'food' });
  }
  // 3. too cold, too hot, or a storm: get to shelter (home if it's any good, else the campfire at the post)
  const bad = p.temp < D.warm || p.temp > 100 - D.warm || (storm && D.storms);
  const envT = R.envTemp(p), lo = Math.min(44, envT - 3), hi = Math.max(58, envT + 3);
  if (bad || cur?.k === 'warm' && (p.temp < lo || p.temp > hi || (R.storm && D.storms))) {
    const goodHome = p.tier >= (map.storm.zap ? 2 : 1);
    return set({ k: 'warm', to: goodHome ? home : [map.post.fire.x + 2, map.post.fire.z + 1.5] });
  }
  // a computer googly needs a sit-down now and then
  if (cur?.k === 'rest') return;
  if (Math.random() < D.rest * D.think) return set({ k: 'rest', until: R.clock + 4 + Math.random() * 7 });
  // 4. a supply crate nearby
  let crate = null, cd = D.crate;
  for (const c of R.crates.values()) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < cd) { cd = d; crate = c; } }
  if (crate) return set({ k: 'crate', id: crate.id, to: [crate.x, crate.z] });
  // 5. can build the next shelter: go home and build it
  const nd = need(R, p);
  if (p.tier < 5 && !nd.wood && !nd.stone && !nd.coins) return set({ k: 'build', to: home });
  // 6. keep a snack or two
  if (p.inv.food < 2 && p.food < 85) { const n = nearestNode(R, p, 'food'); if (n && Math.hypot(n.x - p.x, n.z - p.z) < 22) return set({ k: 'gather', node: n.id, type: 'food' }); }
  // 7. the economy: sell when full or when money is what we're missing
  const surplus = { wood: Math.max(0, p.inv.wood - (p.tier < 5 ? TIERS[p.tier + 1].cost.wood || 0 : 0)), stone: Math.max(0, p.inv.stone - (p.tier < 5 ? TIERS[p.tier + 1].cost.stone || 0 : 0)) };
  const sellValue = p.inv.gold * R.market.gold + surplus.wood * R.market.wood + surplus.stone * R.market.stone;
  const wantTool = pickTool(R, p, D);
  if (load(p) >= capOf(p) - 1 || (nd.coins > 0 && !nd.wood && !nd.stone && sellValue >= nd.coins) || (wantTool && p.coins + sellValue >= wantTool.price + 5 && sellValue > 0) || (wantTool && p.coins >= wantTool.price) || cur?.k === 'post' && !cur.done) {
    return set({ k: 'post', surplus, buy: wantTool ? [wantTool.id] : [] });
  }
  if (Math.random() < D.wander && cur?.k !== 'wander') return set({ k: 'wander', to: [p.x + (Math.random() - 0.5) * 30, p.z + (Math.random() - 0.5) * 30], until: R.clock + 5 });
  if (cur?.k === 'gather' && R.nodes[cur.node].amt > 0 && load(p) < capOf(p)) return;      // keep at it
  // gather what we need most (money comes from gold, or whatever sells best today)
  let type;
  if (nd.wood && (!nd.stone || nd.wood / (TIERS[p.tier + 1].cost.wood || 1) >= nd.stone / (TIERS[p.tier + 1].cost.stone || 1))) type = 'tree';
  else if (nd.stone) type = 'rock';
  else {
    const perSec = { tree: R.market.wood / GATHER.tree[1], rock: R.market.stone / GATHER.rock[1], gold: R.market.gold / GATHER.gold[1] * (p.tools.includes('pick') ? 2 : 1) };
    type = Object.entries(perSec).sort((a, b) => b[1] - a[1])[0][0];
  }
  const avoid = new Set(B.failed || []);
  const n = nearestNode(R, p, type, avoid) || nearestNode(R, p, type === 'tree' ? 'rock' : 'tree', avoid);
  if (n) set({ k: 'gather', node: n.id, type: n.type });
  else set({ k: 'wander', to: [p.x + (Math.random() - 0.5) * 30, p.z + (Math.random() - 0.5) * 30], until: R.clock + 4 });
}
function pickTool(R, p, D) {
  if (Math.random() > D.tools) return null;
  const order = R.mapId === 0 || R.mapId === 3 ? ['coat', 'axe', 'pick', 'pack'] : R.mapId === 1 ? ['hat', 'pick', 'canteen', 'axe', 'pack'] : ['axe', 'pick', 'pack'];
  for (const id of order) { if (p.tools.includes(id)) continue; const it = SHOP.find(s => s.id === id); if (p.tier >= 1 || id === 'coat' || id === 'hat') return it; }
  return null;
}

function doTask(R, p, B, D, dt) {
  const T = B.task;
  if (!T) { standStill(R, p, dt); return; }
  const sprint = T.k === 'warm' || T.k === 'crate' || T.k === 'drink' && p.water < 20;
  if (B.noPath > 3) { if (T.node !== undefined) (B.failed ||= []).push(T.node); if ((B.failed?.length || 0) > 12) B.failed.shift(); B.task = null; B.noPath = 0; return; }
  switch (T.k) {
    case 'drink': if (walkTo(R, p, dt, T.to, sprint)) { R.act(p, { t: 'drink' }); if (p.water >= 96 && p.can >= canCap(p)) B.task = null; } break;
    case 'warm': if (walkTo(R, p, dt, T.to, sprint)) { standStill(R, p, dt); const e = R.envTemp(p); if (!R.storm && p.temp >= Math.min(44, e - 3) && p.temp <= Math.max(58, e + 3)) B.task = null; } break;
    case 'crate': if (!R.crates.has(T.id)) { B.task = null; break; } if (walkTo(R, p, dt, T.to, true) || Math.hypot(T.to[0] - p.x, T.to[1] - p.z) < 2) R.act(p, { t: 'open', id: T.id }); break;
    case 'build': if (walkTo(R, p, dt, T.to)) { R.act(p, { t: 'build' }); B.task = null; } break;
    case 'wander': if (walkTo(R, p, dt, T.to) || R.clock > T.until) B.task = null; break;
    case 'rest': standStill(R, p, dt); p.yaw += dt * 0.4 * Math.sin(R.clock * 0.7 + p.id); if (R.clock > T.until || p.water < D.drink || p.food < D.eat || p.temp < D.warm || p.temp > 100 - D.warm) B.task = null; break;
    case 'post': {
      const q = R.map.post;
      if (walkTo(R, p, dt, [q.x + (p.id % 3 - 1) * 2, q.z])) {
        for (const k of ['gold', 'wood', 'stone']) { const n = k === 'gold' ? p.inv.gold : T.surplus?.[k] || 0; if (n) R.act(p, { t: 'sell', item: k, n }); }
        if (load(p) >= capOf(p) - 1) for (const k of ['wood', 'stone']) if (p.inv[k] > 4) R.act(p, { t: 'sell', item: k, n: p.inv[k] - 4 });
        for (const id of T.buy || []) R.act(p, { t: 'buy', item: id });
        if (p.coins >= 20 && p.inv.food < 1) R.act(p, { t: 'buy', item: 'ration' });
        B.task = null;
      }
      break;
    }
    case 'gather': {
      const n = R.map.nodes[T.node];
      if (!n || R.nodes[T.node].amt <= 0 || load(p) >= capOf(p)) { B.task = null; break; }
      if (!T.to) { T.to = approach(R, p, n); if (!T.to) { (B.failed ||= []).push(T.node); B.task = null; break; } }
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < S.REACH + NODE_R[n.type] * n.s - 0.2 || walkTo(R, p, dt, T.to)) {
        standStill(R, p, dt); turnTo(p, yawTo(n.x - p.x, n.z - p.z), dt, 10);
        R.act(p, { t: 'gather', id: n.id });
        if (n.type === 'food' && p.food < 70 && p.inv.food > 0) R.act(p, { t: 'eat' });
      }
      break;
    }
    default: standStill(R, p, dt);
  }
  // a cheeky bonk now and then, if someone with stuff is right next to us
  if (R.settings.bonk && D.bonk && Math.random() < D.bonk * dt * 10) {
    for (const q of R.players.values()) {
      if (q === p || q.faintT > 0 || load(q) < 2) continue;
      if (Math.hypot(q.x - p.x, q.z - p.z) < 2.2) { p.yaw = yawTo(q.x - p.x, q.z - p.z); R.act(p, { t: 'bonk' }); break; }
    }
  }
}
