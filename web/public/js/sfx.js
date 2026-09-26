// Every sound, every note of music and every bit of ambience is synthesised live with WebAudio — nothing to download.
// Instruments: plucked guitar/oud (Karplus-Strong), flute, horn, string pad, piano, marimba, kalimba, bells, taiko,
// hand drums and a kit. Each biome has its own song (A A B A form), plus night, storm, camp, menu and victory tunes.
let ctx = null, master = null, comp = null, sfxBus = null, musicBus = null, ambBus = null, ambFilter = null, verb = null, verbIn = null;
const VOL = { music: 0.38, sfx: 1, amb: 0.8 };
let musicOn = true, sfxOn = true;
try {
  musicOn = localStorage.getItem('gsv.music') !== '0'; sfxOn = localStorage.getItem('gsv.sfx') !== '0';
  for (const k of ['music', 'sfx', 'amb']) { const v = localStorage.getItem('gsv.vol.' + k); if (v !== null) VOL[k] = Math.max(0, Math.min(1, +v)); }
} catch { }

function buildGraph(c) {
  ctx = c;
  comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2; comp.connect(ctx.destination);
  master = ctx.createGain(); master.gain.value = 0.85; master.connect(comp);
  sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? VOL.sfx : 0; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? VOL.music : 0; musicBus.connect(master);
  // ambience goes through a filter so it sounds muffled when you're inside your shelter
  ambFilter = ctx.createBiquadFilter(); ambFilter.type = 'lowpass'; ambFilter.frequency.value = 18000; ambFilter.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = sfxOn ? VOL.amb : 0; ambBus.connect(ambFilter);
  // an outdoor reverb: a long, soft noise tail
  verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 400 ? i / 400 : 1); }
  verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = 1; verbIn.connect(verb);
  const vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg); vg.connect(master);
  noiseBuf = null; ksCache.clear();
}
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { buildGraph(new (window.AudioContext || window.webkitAudioContext)()); } catch { return; }
  music.start();
  ambience.start();
}
export const audioReady = () => !!ctx && ctx.state === 'running';
export function setMusic(on) { musicOn = on; try { localStorage.setItem('gsv.music', on ? '1' : '0'); } catch { } if (musicBus) musicBus.gain.setTargetAtTime(on ? VOL.music : 0, ctx.currentTime, 0.1); }
export function setSfx(on) { sfxOn = on; try { localStorage.setItem('gsv.sfx', on ? '1' : '0'); } catch { } if (sfxBus) { sfxBus.gain.setTargetAtTime(on ? VOL.sfx : 0, ctx.currentTime, 0.05); ambBus.gain.setTargetAtTime(on ? VOL.amb : 0, ctx.currentTime, 0.05); } }
export function setVolume(kind, v) {
  VOL[kind] = Math.max(0, Math.min(1, v)); try { localStorage.setItem('gsv.vol.' + kind, String(VOL[kind])); } catch { }
  if (!ctx) return;
  if (kind === 'music') musicBus.gain.setTargetAtTime(musicOn ? VOL.music : 0, ctx.currentTime, 0.05);
  if (kind === 'sfx') sfxBus.gain.setTargetAtTime(sfxOn ? VOL.sfx : 0, ctx.currentTime, 0.05);
  if (kind === 'amb') ambBus.gain.setTargetAtTime(sfxOn ? VOL.amb : 0, ctx.currentTime, 0.05);
}
export const audioState = () => ({ music: musicOn, sfx: sfxOn, vol: { ...VOL } });
const now = () => ctx ? ctx.currentTime : 0;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

// ------------------------------------------------------------------ building blocks
let noiseBuf = null;
function nb() { if (!noiseBuf) { const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; } return noiseBuf; }
function env(g, t0, vol, attack, dur, curve = 'exp') {
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur); else { g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.linearRampToValueAtTime(0, t0 + dur); }
}
function sendTo(node, amt) { if (!amt) return; const s = ctx.createGain(); s.gain.value = amt; node.connect(s); s.connect(verbIn); }
function tone(f, t0, dur, { type = 'sine', vol = 0.3, attack = 0.004, slide = 0, out = sfxBus, send = 0, vib = 0, vibRate = 6, detune = 0, curve = 'exp' } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t0 + dur);
  if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibRate; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(f * vib, t0 + Math.min(0.25, dur * 0.4)); l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 0.05); }
  env(g, t0, vol, attack, dur, curve);
  o.connect(g); g.connect(out); sendTo(g, send);
  o.start(t0); o.stop(t0 + dur + 0.05);
  return o;
}
function noise(t0, dur, { vol = 0.3, f = 2000, q = 1, type = 'bandpass', slide = 0, out = sfxBus, attack = 0.002, send = 0, rate = 1, curve = 'exp' } = {}) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = nb(); s.playbackRate.value = rate * (0.85 + Math.random() * 0.3);
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f * slide), t0 + dur);
  const g = ctx.createGain(); env(g, t0, vol, attack, dur, curve);
  s.connect(fl); fl.connect(g); g.connect(out); sendTo(g, send);
  s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
}
// Karplus-Strong plucked string, cached per note
const ksCache = new Map();
function ksBuffer(m, bright = 0.5, dur = 1.6) {
  const key = m + ':' + bright + ':' + dur;
  if (ksCache.has(key)) return ksCache.get(key);
  const sr = ctx.sampleRate, n = Math.floor(sr * dur), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  const f = midi(m), N = Math.max(2, Math.round(sr / f)), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (1 - bright * 0.5) + (i < N / 2 ? bright : -bright) * 0.5;
  const decay = 0.996 - (1 - bright) * 0.004 + Math.min(0.003, f / 200000);
  let p = 0, last = 0;
  for (let i = 0; i < n; i++) { const cur = ring[p], nxt = ring[(p + 1) % N]; const v = (cur + nxt) * 0.5 * decay; ring[p] = v; d[i] = cur; last = v; p = (p + 1) % N; }
  void last;
  ksCache.set(key, buf);
  return buf;
}
function pluck(m, t, { vol = 0.3, out = sfxBus, bright = 0.5, dur = 1.6, send = 0.2, bend = 0 } = {}) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = ksBuffer(Math.round(m), bright, dur);
  if (bend) { s.playbackRate.setValueAtTime(Math.pow(2, -bend / 12), t); s.playbackRate.exponentialRampToValueAtTime(1, t + 0.12); }
  const g = ctx.createGain(); g.gain.value = vol;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
  s.connect(hp); hp.connect(g); g.connect(out); sendTo(g, send);
  s.start(t); s.stop(t + dur);
}
// positional: a gain/pan/lowpass chain for a world position relative to the listener
let listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
export function setListener(x, y, z, yaw) { listener = { x, y, z, rx: Math.cos(yaw), rz: -Math.sin(yaw) }; }
function at(pos, base = 1, reach = 7, bus = sfxBus) {
  if (!ctx) return null;
  if (!pos) { if (base === 1) return bus; const g = ctx.createGain(); g.gain.value = base; g.connect(bus); setTimeout(() => { try { g.disconnect(); } catch { } }, 4000); return g; }
  const dx = pos[0] - listener.x, dy = pos[1] - listener.y, dz = pos[2] - listener.z, d = Math.hypot(dx, dy, dz);
  const g = ctx.createGain(); g.gain.value = base / (1 + d / reach);
  const p = ctx.createStereoPanner(); p.pan.value = d > 0.1 ? Math.max(-1, Math.min(1, (dx * listener.rx + dz * listener.rz) / d)) * 0.9 : 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 18000 / (1 + d / 12);
  g.connect(lp); lp.connect(p); p.connect(bus);
  setTimeout(() => { try { g.disconnect(); lp.disconnect(); p.disconnect(); } catch { } }, 4000);
  return g;
}
const distTo = pos => pos ? Math.hypot(pos[0] - listener.x, pos[2] - listener.z) : 0;

// ------------------------------------------------------------------ instruments (used by the music and a few stingers)
const INST = {
  guitar(m, t, d, v, out) { pluck(m, t, { vol: v * 1.1, out, bright: 0.45, dur: Math.max(1, d + 0.6), send: 0.25 }); },
  oud(m, t, d, v, out) { pluck(m, t, { vol: v * 1.2, out, bright: 0.75, dur: 1.2, send: 0.3, bend: Math.random() < 0.3 ? 1 : 0 }); },
  harp(m, t, d, v, out) { pluck(m, t, { vol: v, out, bright: 0.3, dur: 2.4, send: 0.5 }); },
  flute(m, t, d, v, out) {
    const f = midi(m);
    tone(f, t, d + 0.12, { type: 'sine', vol: v * 0.8, attack: 0.06, out, send: 0.45, vib: 0.012, vibRate: 5.2, curve: 'lin' });
    tone(f * 2, t, d + 0.1, { type: 'sine', vol: v * 0.12, attack: 0.07, out, curve: 'lin' });
    noise(t, Math.min(0.25, d), { f: f * 2, q: 4, vol: v * 0.18, out, attack: 0.03 });
  },
  whistle(m, t, d, v, out) { tone(midi(m), t, d + 0.08, { type: 'sine', vol: v * 0.7, attack: 0.03, out, send: 0.35, vib: 0.02, vibRate: 6.5, curve: 'lin' }); },
  horn(m, t, d, v, out) {
    const f = midi(m), o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o1.type = o2.type = 'sawtooth'; o1.frequency.value = f; o2.frequency.value = f; o2.detune.value = 7;
    fl.type = 'lowpass'; fl.Q.value = 1.5; fl.frequency.setValueAtTime(f * 1.2, t); fl.frequency.linearRampToValueAtTime(f * 4, t + 0.08); fl.frequency.exponentialRampToValueAtTime(f * 2.2, t + d);
    env(g, t, v * 0.35, 0.05, d + 0.15, 'lin');
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(out); sendTo(g, 0.4);
    for (const o of [o1, o2]) { o.start(t); o.stop(t + d + 0.2); }
  },
  pad(m, t, d, v, out) {
    const f = midi(m), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = 'lowpass'; fl.frequency.value = Math.min(2400, f * 5); fl.Q.value = 0.5;
    env(g, t, v * 0.16, Math.min(0.8, d * 0.4), d + 0.6, 'lin');
    fl.connect(g); g.connect(out); sendTo(g, 0.6);
    for (const dt of [-9, 0, 8]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = dt; o.connect(fl); o.start(t); o.stop(t + d + 0.7); }
  },
  piano(m, t, d, v, out) {
    const f = midi(m), g = ctx.createGain(); g.connect(out); sendTo(g, 0.35);
    g.gain.value = 1;
    [[1, 1, 1.6], [2, 0.4, 0.9], [3, 0.18, 0.6], [4.01, 0.08, 0.35]].forEach(([k, a, dd]) => tone(f * k, t, Math.max(0.4, dd * (1.4 - m / 120)), { type: 'sine', vol: v * a * 0.5, out: g, attack: 0.003 }));
    noise(t, 0.02, { f: 2500, q: 1, vol: v * 0.08, out: g });
  },
  marimba(m, t, d, v, out) { const f = midi(m); tone(f, t, 0.5, { type: 'sine', vol: v * 0.7, out, send: 0.3 }); tone(f * 4, t, 0.06, { type: 'sine', vol: v * 0.2, out }); tone(f * 10, t, 0.02, { type: 'sine', vol: v * 0.05, out }); },
  kalimba(m, t, d, v, out) { const f = midi(m); tone(f, t, 1.1, { type: 'sine', vol: v * 0.6, out, send: 0.5 }); tone(f * 5.95, t, 0.12, { type: 'sine', vol: v * 0.12, out }); },
  bell(m, t, d, v, out) { const f = midi(m); tone(f, t, 2.2, { type: 'sine', vol: v * 0.45, out, send: 0.7 }); tone(f * 2.76, t, 1.1, { type: 'sine', vol: v * 0.12, out, send: 0.6 }); tone(f * 5.4, t, 0.5, { type: 'sine', vol: v * 0.05, out }); },
  pizz(m, t, d, v, out) { pluck(m, t, { vol: v, out, bright: 0.2, dur: 0.6, send: 0.3 }); },
  bass(m, t, d, v, out) {
    const f = midi(m), o = ctx.createOscillator(), o2 = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f / 2;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(200, t + d);
    env(g, t, v * 0.5, 0.008, d + 0.1);
    o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(out);
    for (const x of [o, o2]) { x.start(t); x.stop(t + d + 0.15); }
  },
  synthbass(m, t, d, v, out) {
    const f = midi(m), o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; fl.type = 'lowpass'; fl.Q.value = 7; fl.frequency.setValueAtTime(1400, t); fl.frequency.exponentialRampToValueAtTime(160, t + d);
    env(g, t, v * 0.32, 0.005, d + 0.05); o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.1);
  },
  brass(m, t, d, v, out) { INST.horn(m, t, d, v * 1.2, out); INST.horn(m + 12, t, d, v * 0.4, out); },
};
// drums
const DRUM = {
  k(t, v, out) { tone(150, t, 0.28, { vol: v * 0.9, slide: 0.3, out }); noise(t, 0.012, { f: 3500, vol: v * 0.15, out }); },
  s(t, v, out) { noise(t, 0.16, { f: 1900, q: 0.7, vol: v * 0.45, out, send: 0.25 }); tone(200, t, 0.08, { vol: v * 0.22, type: 'triangle', out }); },
  brush(t, v, out) { noise(t, 0.12, { f: 4200, q: 0.6, vol: v * 0.2, out, attack: 0.02 }); },
  h(t, v, out) { noise(t, 0.03, { f: 9000, type: 'highpass', vol: v * 0.12, out }); },
  o(t, v, out) { noise(t, 0.18, { f: 8000, type: 'highpass', vol: v * 0.1, out }); },
  sh(t, v, out) { noise(t, 0.06, { f: 6500, q: 1.2, vol: v * 0.12, out, attack: 0.015 }); },
  dum(t, v, out) { tone(110, t, 0.35, { vol: v * 0.8, slide: 0.55, out, send: 0.2 }); noise(t, 0.05, { f: 400, vol: v * 0.2, out }); },
  tek(t, v, out) { noise(t, 0.05, { f: 3200, q: 3, vol: v * 0.35, out, send: 0.15 }); tone(620, t, 0.04, { vol: v * 0.12, out }); },
  taiko(t, v, out) { tone(95, t, 0.9, { vol: v * 1.1, slide: 0.45, out, send: 0.55 }); noise(t, 0.25, { f: 180, type: 'lowpass', vol: v * 0.5, out }); },
  rim(t, v, out) { noise(t, 0.02, { f: 2600, q: 8, vol: v * 0.3, out }); tone(1700, t, 0.02, { vol: v * 0.1, out }); },
  tim(t, v, out) { tone(82, t, 1.1, { vol: v * 0.7, slide: 0.9, out, send: 0.5 }); noise(t, 0.3, { f: 200, type: 'lowpass', vol: v * 0.25, out }); },
  clap(t, v, out) { for (let i = 0; i < 3; i++) noise(t + i * 0.011, 0.09, { f: 1400, q: 1, vol: v * 0.3, out, send: 0.3 }); },
};

// ------------------------------------------------------------------ the songs
// chords: one per bar as [root semitone, quality]; mel: 8 notes a bar (semitones above root+24, '.' rest, '-' hold);
// bass/drum patterns are 16 steps per bar; form plays the sections in order and loops.
const Q = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], D7: [0, 4, 7, 10], s4: [0, 5, 7], M9: [0, 4, 7, 14], dim: [0, 3, 6], ph: [0, 1, 4, 7] };
const mel = s => s.trim().split(/\s+/).map(x => x === '.' ? null : x === '-' ? '-' : +x);
const SONGS = {
  // title screen: warm folk with guitar, flute and a gentle kit
  menu: {
    bpm: 100, root: 43, swing: 0.12, lead: 'flute', comp: 'guitar', bass: 'bass', pad: 'pad', kit: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', sh: '..x...x...x...x.' },
    comp_pat: 'strum', form: 'AABA',
    A: { chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], mel: mel('12 - 16 19 21 - 19 16  14 - - 12 14 16 - .  16 - 19 21 24 - 21 19  17 - 16 14 12 - - .') },
    B: { chords: [[5, 'M'], [0, 'M'], [5, 'M'], [7, 'D7']], mel: mel('17 - 21 - 24 - 21 19  19 - 16 - 12 - - .  17 19 21 - 24 26 24 21  19 - - 17 14 - - .') },
  },
  // Base Camp: laid-back campfire singalong — guitar strums, whistled tune, shaker
  camp: {
    bpm: 92, root: 43, swing: 0.2, lead: 'whistle', comp: 'guitar', bass: 'bass', kit: { k: 'x.......x..x....', s: '....x.......x...', sh: 'xxxxxxxxxxxxxxxx' }, comp_pat: 'strum', form: 'AABA',
    A: { chords: [[0, 'M'], [5, 'M'], [0, 'M'], [7, 'M']], mel: mel('19 - 21 19 16 - 14 12  14 - 16 - 17 - 16 .  19 - 21 19 16 - 12 -  14 - - 16 12 - - .') },
    B: { chords: [[5, 'M'], [5, 'M'], [0, 'M'], [7, 'D7']], mel: mel('21 - 21 19 17 - 19 21  24 - - 21 19 - - .  19 - 19 17 16 - 14 12  14 - 16 - 12 - - .') },
  },
  // Whispering Woods: bright folk — fingerpicked guitar, flute, marimba countermelody
  forest: {
    bpm: 104, root: 48, swing: 0.14, lead: 'flute', comp: 'guitar', counter: 'marimba', bass: 'bass', kit: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, comp_pat: 'arp', form: 'AABA',
    A: { chords: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']], mel: mel('12 14 16 - 19 - 16 14  12 - 9 - 12 - - .  17 - 16 14 12 - 14 16  14 - - - 7 - - .') },
    B: { chords: [[5, 'M7'], [4, 'm'], [2, 'm7'], [7, 'D7']], mel: mel('21 - 19 17 16 - 17 19  19 - 16 - 12 - - .  17 - 16 14 12 - 11 12  14 - - 16 19 - - .') },
  },
  // Frozen Tundra: glassy and lonely — kalimba ostinato, bells, string pad, very soft pulse
  arctic: {
    bpm: 80, root: 50, swing: 0, lead: 'bell', comp: 'kalimba', bass: 'bass', pad: 'pad', kit: { k: 'x...............', rim: '........x.......' }, comp_pat: 'ostinato', form: 'AABA',
    A: { chords: [[0, 'm'], [-2, 'M'], [3, 'M'], [-5, 'M']], mel: mel('12 - - - 15 - 14 -  12 - - - 10 - - .  15 - - 17 19 - 17 -  15 - 14 - 10 - - .') },
    B: { chords: [[5, 'm'], [0, 'm'], [-2, 'M'], [-5, 's4']], mel: mel('17 - - 20 19 - 17 -  15 - - - 12 - - .  14 - 15 - 17 - 19 -  19 - - - 17 - - .') },
  },
  // Scorched Dunes: phrygian-dominant groove — oud, hand drums (dum/tek), drone
  desert: {
    bpm: 96, root: 40, swing: 0.06, lead: 'oud', comp: 'drone', bass: 'bass', kit: { dum: 'x.....x...x.....', tek: '...x.x...x...xx.', sh: 'x.x.x.x.x.x.x.x.' }, comp_pat: 'drone', form: 'AABA',
    A: { chords: [[0, 'ph'], [0, 'ph'], [1, 'M'], [0, 'ph']], mel: mel('12 13 16 - 17 16 13 12  13 - 12 - 11 12 - .  16 17 19 - 20 19 17 16  17 16 13 - 12 - - .') },
    B: { chords: [[5, 'm'], [1, 'M'], [5, 'm'], [0, 'ph']], mel: mel('17 - 20 - 22 20 19 17  16 17 16 13 12 - - .  20 - 19 17 16 17 16 13  13 - 12 - 12 - - .') },
  },
  // Rocky Peaks: heroic alpine — horn melody, strings, pizzicato bass, timpani
  mountains: {
    bpm: 88, root: 41, swing: 0, lead: 'horn', comp: 'pizz', bass: 'bass', pad: 'pad', kit: { tim: 'x.......x.......', rim: '....x.......x...', sh: '..x...x...x...x.' }, comp_pat: 'arp', form: 'AABA',
    A: { chords: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], mel: mel('12 - 16 - 19 - - 21  19 - 16 - 12 - - .  14 - 16 17 19 - 17 16  14 - - - 12 - - .') },
    B: { chords: [[5, 'M'], [7, 'M'], [4, 'm'], [9, 'm']], mel: mel('17 - 21 - 24 - 21 -  19 - - 23 24 - - .  21 - 19 17 16 - 14 12  14 - 16 - 19 - - .') },
  },
  // night on any map: soft piano and pad (the crickets come from the ambience)
  night: {
    bpm: 70, root: 45, swing: 0.05, lead: 'piano', comp: 'piano_ch', bass: null, pad: 'pad', kit: {}, comp_pat: 'block', form: 'AB',
    A: { chords: [[0, 'm7'], [-4, 'M7'], [3, 'M'], [-2, 'M']], mel: mel('. . 12 - 15 - 14 -  . . 12 - 10 - - .  . . 15 - 17 - 19 -  17 - 15 - 14 - - .') },
    B: { chords: [[5, 'm7'], [3, 'M7'], [-4, 'M7'], [-5, 's4']], mel: mel('. . 17 - 20 - 19 -  17 - 15 - 12 - - .  . . 14 - 15 - 17 -  15 - 14 - 12 - - .') },
  },
  // storms: taiko drums, low string ostinato, brass stabs
  storm: {
    bpm: 138, root: 38, swing: 0, lead: 'brass', comp: 'ostinato_low', bass: 'synthbass', pad: 'pad', kit: { taiko: 'x..x..x...x.x...', clap: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', k: 'x...x...x...x...' }, comp_pat: 'ostinato', form: 'AB',
    A: { chords: [[0, 'm'], [0, 'm'], [-4, 'M'], [-2, 'M']], mel: mel('12 - - 15 - - 14 -  12 - - - . . . .  15 - - 17 - - 19 -  17 - 15 - 14 - - .') },
    B: { chords: [[-4, 'M'], [-2, 'M'], [0, 'm'], [-5, 'M']], mel: mel('20 - - 19 - - 17 -  15 - - 14 - - 12 -  15 - 17 - 19 - 20 -  19 - - - 17 - - .') },
  },
  // the results screen: a victory march
  end: {
    bpm: 116, root: 48, swing: 0, lead: 'brass', comp: 'guitar', bass: 'bass', pad: 'pad', kit: { k: 'x.......x.......', s: '....x.......x.x.', h: 'x.x.x.x.x.x.x.x.' }, comp_pat: 'strum', form: 'AB',
    A: { chords: [[0, 'M'], [5, 'M'], [7, 'M'], [0, 'M']], mel: mel('12 - 16 - 19 - 24 -  21 - 19 - 17 - 16 -  14 - 16 17 19 - 17 16  16 - - - 12 - - .') },
    B: { chords: [[5, 'M'], [0, 'M'], [7, 'M'], [0, 'M']], mel: mel('17 - 21 - 24 - 21 -  19 - 16 - 12 - 16 -  14 - 17 - 21 - 19 -  24 - - - . . . .') },
  },
};
const VOICE_VOL = { flute: 0.28, whistle: 0.2, oud: 0.3, horn: 0.2, bell: 0.3, piano: 0.3, brass: 0.18, marimba: 0.22, kalimba: 0.2 };

export const music = {
  song: 'menu', cur: null, next: 0, step: 0, gain: null, started: false,
  start() { if (this.started) return; this.started = true; this.newGain(0.4); this.tick(); },
  newGain(fade) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(1, ctx.currentTime + fade); g.connect(musicBus);
    if (this.gain) { const old = this.gain; old.gain.cancelScheduledValues(ctx.currentTime); old.gain.setValueAtTime(old.gain.value, ctx.currentTime); old.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.6); setTimeout(() => { try { old.disconnect(); } catch { } }, 2500); }
    this.gain = g;
  },
  play(name) {
    if (this.song === name) return;
    this.song = name; this.step = 0;
    if (ctx && this.started) { this.newGain(name === 'storm' ? 0.6 : 1.8); this.next = ctx.currentTime + 0.1; }
  },
  tick() {
    if (!ctx) return;
    if (ctx.state === 'running') this.fill(ctx.currentTime + 0.2);
    setTimeout(() => this.tick(), 50);
  },
  /** schedule every note up to `until` (seconds on the audio clock) */
  fill(until) {
    const S = SONGS[this.song] || SONGS.menu, spb = 60 / S.bpm / 4, out = this.gain;
    if (this.next < ctx.currentTime - 0.5) this.next = ctx.currentTime + 0.05;
    while (this.next < until) {
      const step = this.step, s = step % 16, bar = Math.floor(step / 16), secIdx = Math.floor(bar / 4) % S.form.length, sec = S[S.form[secIdx]], b4 = bar % 4;
      const [cr, cq] = sec.chords[b4], chord = Q[cq], root = S.root + cr;
      const t = this.next + (s % 2 ? spb * S.swing : 0);
      // drums
      for (const k in S.kit) { const p = S.kit[k]; if (p[s] === 'x') DRUM[k](t, (s % 4 === 0 ? 1 : 0.75) * (0.9 + Math.random() * 0.2), out); }
      // bass: root on 1, fifth on the & of 2, octave pickup
      if (S.bass && (s === 0 || s === 6 || s === 10 || (s === 14 && b4 === 3))) {
        const iv = s === 0 ? 0 : s === 6 ? 7 : s === 10 ? 12 : 10;
        INST[S.bass](root - 12 + iv, t, spb * (s === 0 ? 5 : 3), s === 0 ? 0.9 : 0.65, out);
      }
      // chords / accompaniment
      const pat = S.comp_pat, comp = S.comp;
      if (pat === 'strum' && (s === 0 || s === 4 || s === 6 || s === 10 || s === 12 || s === 14)) chord.concat([12]).forEach((iv, i) => INST.guitar(root + 12 + iv, t + i * 0.012 * (s % 4 === 2 ? -1 : 1) + 0.02, spb * 3, s % 4 === 0 ? 0.13 : 0.08, out));
      if (pat === 'arp' && s % 2 === 0) { const seq = [0, 1, 2, 3, 2, 1, 0, 2]; const ch = chord.concat([12]); INST[comp](root + 12 + ch[seq[(s / 2) % 8] % ch.length], t, spb * 2, 0.14, out); }
      if (pat === 'ostinato' && s % 2 === 0) { const seq = comp === 'ostinato_low' ? [0, 0, 7, 0, 3, 0, 7, 12] : [0, 7, 12, 7, 3, 7, 12, 14]; const inst = comp === 'ostinato_low' ? 'pizz' : 'kalimba'; INST[inst](root + (comp === 'ostinato_low' ? 0 : 24) + seq[(s / 2) % 8], t, spb * 2, comp === 'ostinato_low' ? 0.35 : 0.14, out); }
      if (pat === 'drone' && s === 0) { INST.pad(root, t, spb * 16, 0.6, out); INST.pad(root + 7, t, spb * 16, 0.4, out); }
      if (pat === 'block' && (s === 0 || s === 8)) chord.forEach((iv, i) => INST.piano(root + 12 + iv, t + i * 0.02, spb * 8, 0.1, out));
      if (S.pad && s === 0 && pat !== 'drone') chord.forEach(iv => INST.pad(root + 12 + iv, t, spb * 16, 0.35, out));
      // countermelody (marimba answers in the gaps)
      if (S.counter && s % 4 === 2 && bar % 2 === 1) INST[S.counter](root + 24 + chord[(s / 4 | 0) % chord.length], t, spb, 0.12, out);
      // melody: 8th notes, '-' holds the previous note
      if (s % 2 === 0) {
        const mi = b4 * 8 + s / 2, note = sec.mel[mi];
        if (note !== null && note !== '-' && note !== undefined) {
          let len = 1; while (sec.mel[mi + len] === '-' && (mi + len) % 8 !== 0) len++;
          INST[S.lead](S.root + 24 + note, t, spb * 2 * len - 0.02, VOICE_VOL[S.lead] || 0.25, out);
        }
      }
      this.next += spb; this.step++;
    }
  },
};

// ------------------------------------------------------------------ ambience: each biome sounds like somewhere
export const ambience = {
  loops: {}, st: { biome: null, night: 0, storm: 0, fire: 99, water: 99, inside: false, wet: false }, timers: {},
  start() {
    const loop = (name, filterType, f, q) => {
      const s = ctx.createBufferSource(); s.buffer = nb(); s.loop = true; s.playbackRate.value = name === 'rain' ? 1 : 0.7;
      const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(ambBus); s.start();
      this.loops[name] = { g, fl };
    };
    loop('wind', 'bandpass', 500, 0.9);
    loop('gust', 'bandpass', 1200, 2.5);
    loop('rain', 'bandpass', 3000, 0.4);
    loop('rainLow', 'lowpass', 500, 0.5);
    loop('sand', 'highpass', 3500, 0.5);
    loop('fire', 'lowpass', 300, 0.7);
    loop('cicada', 'bandpass', 5200, 12);
    // cicadas pulse
    const cl = ctx.createOscillator(), cg = ctx.createGain(); cl.frequency.value = 18; cg.gain.value = 0.5; cl.connect(cg); cg.connect(this.loops.cicada.g.gain); cl.start();
    const wob = () => { if (!ctx) return; const w = this.loops.wind, gu = this.loops.gust, st = this.st; w.fl.frequency.setTargetAtTime(250 + Math.random() * 500 * (0.5 + st.storm), ctx.currentTime, 0.8); gu.fl.frequency.setTargetAtTime(700 + Math.random() * 1400, ctx.currentTime, 0.5); setTimeout(wob, 900); }; wob();
  },
  /** called every frame by the game with what's around you */
  update(dt, s) {
    if (!ctx || !this.loops.wind) return;
    Object.assign(this.st, s);
    const S = this.st, b = S.biome, t = ctx.currentTime, L = this.loops, set = (k, v, tc = 0.8) => L[k].g.gain.setTargetAtTime(v, t, tc);
    const windBase = { arctic: 0.28, mountains: 0.24, desert: 0.12, forest: 0.05, camp: 0.03 }[b] ?? 0;
    set('wind', windBase + S.storm * (b === 'forest' ? 0.25 : 0.6));
    set('gust', (windBase * 0.25 + S.storm * 0.18) * (0.5 + Math.sin(t * 0.3) * 0.5));
    set('rain', b === 'forest' ? S.storm * 0.35 : b === 'mountains' ? S.storm * 0.05 : 0, 1.5);
    set('rainLow', b === 'forest' ? S.storm * 0.4 : 0, 1.5);
    set('sand', b === 'desert' ? S.storm * 0.4 : b === 'arctic' ? S.storm * 0.12 : 0, 1.2);
    set('fire', S.fire < 9 ? 0.25 * (1 - S.fire / 9) : 0, 0.3);
    set('cicada', b === 'desert' && S.night < 0.5 && !S.storm ? 0.03 : b === 'forest' && S.night < 0.5 && !S.storm ? 0.008 : 0, 2);
    ambFilter.frequency.setTargetAtTime(S.inside ? 900 : 18000, t, 0.3);
    // one-off sounds of the place
    const every = (k, lo, hi, fn) => { this.timers[k] = (this.timers[k] ?? rnd(lo, hi)) - dt; if (this.timers[k] <= 0) { this.timers[k] = rnd(lo, hi); fn(); } };
    const day = S.night < 0.5, calm = S.storm < 0.3;
    if (S.fire < 9) every('crackle', 0.08, 0.5, () => this.crackle(S.fire));
    if (S.water < 12 && b !== 'arctic') every('lap', 1.2, 2.6, () => this.lap(S.water));
    if (!b || b === 'menu') return;
    if ((b === 'forest' || b === 'camp') && day && calm) every('bird', 1.5, 5, () => this.bird());
    if (b === 'mountains' && day && calm) { every('bird', 5, 12, () => this.bird(true)); every('eagle', 25, 50, () => this.eagle()); }
    if (b === 'desert' && day && calm) every('hawk', 20, 45, () => this.eagle(true));
    if (!day && calm && b !== 'arctic') every('cricket', 0.5, 1.6, () => this.cricket());
    if (!day && calm && (b === 'forest' || b === 'camp')) every('owl', 14, 30, () => this.owl());
    if (!day && (b === 'arctic' || b === 'mountains')) every('howl', 25, 55, () => sfx.howl());
    if (b === 'arctic') every('creak', 12, 30, () => this.iceCreak());
    if (b === 'forest' && calm) every('leaves', 4, 9, () => noise(now(), 1.8, { f: 2500, q: 0.4, vol: 0.05, out: ambBus, attack: 0.8, curve: 'lin' }));
    if (b === 'forest' && S.storm > 0.5) every('drip', 0.1, 0.3, () => tone(rnd(1800, 3200), now(), 0.04, { vol: 0.02, slide: 0.6, out: ambBus }));
  },
  crackle(d) { const t = now(), v = 0.14 * (1 - d / 9); for (let i = 0; i < 1 + (Math.random() * 3 | 0); i++) noise(t + i * rnd(0.01, 0.05), rnd(0.005, 0.02), { f: rnd(1500, 5000), q: 2, vol: v * rnd(0.4, 1), out: ambBus }); if (Math.random() < 0.08) noise(t, 0.25, { f: 700, q: 1, vol: v * 0.6, out: ambBus }); },
  lap(d) { const t = now(), v = 0.09 * (1 - d / 12); noise(t, 0.9, { f: 450, q: 0.7, vol: v, out: ambBus, attack: 0.3, slide: 1.6 }); noise(t + 0.5, 0.6, { f: 900, q: 1, vol: v * 0.5, out: ambBus, attack: 0.1 }); },
  bird(alpine = false) {
    const t = now(), pan = ctx.createStereoPanner(); pan.pan.value = rnd(-0.9, 0.9); pan.connect(ambBus);
    const kind = Math.random() * 3 | 0, base = alpine ? rnd(2200, 3000) : rnd(2600, 4200);
    const n = kind === 0 ? 3 + (Math.random() * 4 | 0) : kind === 1 ? 2 : 5;
    for (let i = 0; i < n; i++) {
      const tt = t + i * (kind === 2 ? 0.07 : 0.16), f = base * (kind === 1 ? (i ? 0.8 : 1.15) : 1 + Math.sin(i) * 0.1);
      tone(f, tt, kind === 2 ? 0.05 : 0.11, { vol: 0.035, slide: kind === 1 ? 0.75 : 1.25, out: pan, attack: 0.01, send: 0.2 });
    }
  },
  cricket() { const t = now(), pan = ctx.createStereoPanner(); pan.pan.value = rnd(-1, 1); pan.connect(ambBus); const f = rnd(4200, 4800); for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) tone(f, t + i * 0.13 + k * 0.022, 0.016, { vol: 0.02, out: pan }); },
  owl() { const t = now(), pan = ctx.createStereoPanner(); pan.pan.value = rnd(-0.8, 0.8); pan.connect(ambBus); tone(380, t, 0.35, { vol: 0.08, slide: 0.92, out: pan, attack: 0.05, send: 0.6 }); tone(360, t + 0.5, 0.6, { vol: 0.07, slide: 0.88, out: pan, attack: 0.08, send: 0.6, vib: 0.01 }); },
  eagle(hawk = false) { const t = now(); tone(hawk ? 2400 : 2000, t, 1.1, { type: 'sawtooth', vol: 0.02, slide: 0.55, out: ambBus, attack: 0.05, send: 0.8, vib: 0.02, vibRate: 22 }); noise(t, 1, { f: 2200, q: 6, vol: 0.02, out: ambBus, slide: 0.6, send: 0.6 }); },
  iceCreak() { const t = now(); noise(t, 1.4, { f: 180, q: 18, vol: 0.12, out: ambBus, slide: 2.5, attack: 0.2, send: 0.5 }); tone(90, t, 1.2, { type: 'sawtooth', vol: 0.015, slide: 1.8, out: ambBus, send: 0.4 }); },
};
// old name kept: the storm wind level (now part of the ambience)
export const wind = { set(level) { ambience.st.storm = level >= 0.9 ? 1 : level > 0.3 ? 0.3 : 0; } };

// ------------------------------------------------------------------ googly voices: little formant squeaks
function voice(pos, pitch, pattern, vol = 0.12) {
  if (!ctx) return; const t = now(), o = at(pos, vol * 10, 8);
  for (const [dt, f0, f1, dur, vowel] of pattern) {
    const osc = ctx.createOscillator(), g = ctx.createGain(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * pitch, t + dt); osc.frequency.exponentialRampToValueAtTime(f1 * pitch, t + dt + dur);
    const formants = { a: [800, 1200], e: [500, 1900], i: [300, 2300], o: [500, 900], u: [350, 700] }[vowel || 'a'];
    env(g, t + dt, 0.45, 0.015, dur);
    osc.connect(g);
    for (const ff of formants) { const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff * (0.9 + pitch * 0.1); bp.Q.value = 6; g.connect(bp); bp.connect(o); }
    osc.start(t + dt); osc.stop(t + dt + dur + 0.05);
  }
}
const pitchOf = id => 0.85 + ((id * 37) % 10) / 20;

// ------------------------------------------------------------------ sound effects
export const sfx = {
  click() { if (!ctx) return; const t = now(); tone(1800, t, 0.03, { vol: 0.07 }); noise(t, 0.012, { f: 4000, q: 2, vol: 0.05 }); },
  hover() { if (!ctx) return; tone(1400, now(), 0.02, { vol: 0.025 }); },
  panel(open = true) { if (!ctx) return; noise(now(), 0.18, { f: open ? 900 : 2200, q: 0.8, vol: 0.1, slide: open ? 2.4 : 0.4, attack: 0.03 }); },
  /** surface: snow | sand | grass | rock | wood | water */
  step(pos, v = 1, surface = 'grass') {
    if (!ctx) return; const t = now(), o = at(pos, 1.2 * v);
    if (surface === 'snow') { noise(t, 0.09, { f: 2400, q: 0.6, vol: 0.60, out: o }); noise(t + 0.02, 0.06, { f: 5500, q: 1, vol: 0.24, out: o }); }
    else if (surface === 'sand') noise(t, 0.1, { f: 3200, q: 0.5, vol: 0.36, out: o, attack: 0.02 });
    else if (surface === 'water') { noise(t, 0.2, { f: 1200, q: 0.6, vol: 0.60, out: o, slide: 0.5 }); tone(rnd(500, 700), t + 0.03, 0.06, { vol: 0.12, slide: 1.8, out: o }); }
    else if (surface === 'rock') { noise(t, 0.04, { f: 2800, q: 2, vol: 0.54, out: o }); tone(rnd(180, 220), t, 0.04, { vol: 0.18, out: o, slide: 0.7 }); }
    else if (surface === 'wood') { tone(rnd(160, 190), t, 0.07, { vol: 0.36, out: o, slide: 0.8, type: 'triangle' }); noise(t, 0.03, { f: 1500, q: 2, vol: 0.30, out: o }); }
    else { noise(t, 0.06, { f: 1300, q: 0.9, vol: 0.42, out: o }); noise(t + 0.01, 0.04, { f: 4000, q: 1, vol: 0.12, out: o }); }
  },
  jump(pos, id = 1) { if (!ctx) return; const t = now(), o = at(pos, 0.8); noise(t, 0.1, { f: 1400, q: 1, vol: 0.1, out: o, slide: 1.6 }); voice(pos, pitchOf(id), [[0, 300, 420, 0.1, 'u']], 0.07); },
  land(v = 1, pos) { if (!ctx) return; const t = now(), o = at(pos, 1); tone(90, t, 0.14, { vol: 0.28 * v, slide: 0.5, out: o }); noise(t, 0.1, { f: 700, vol: 0.2 * v, out: o }); if (v > 0.8) voice(pos, 1, [[0.02, 260, 180, 0.14, 'o']], 0.06); },
  boing(pos) { if (!ctx) return; const t = now(), o = at(pos, 1); tone(180, t, 0.55, { vol: 0.25, slide: 2.6, out: o, vib: 0.05 }); tone(360, t, 0.35, { vol: 0.08, slide: 2.4, out: o, type: 'triangle' }); },
  chop(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.9, 10); noise(t, 0.08, { f: 1100, q: 1.6, vol: 0.55, out: o, send: 0.15 }); tone(rnd(140, 180), t, 0.15, { vol: 0.4, slide: 0.55, out: o, type: 'triangle' }); noise(t + 0.012, 0.05, { f: 3500, q: 2, vol: 0.12, out: o }); },
  treeFall(pos) {
    if (!ctx) return; const t = now(), o = at(pos, 1.5, 14);
    const cr = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); cr.type = 'sawtooth'; cr.frequency.setValueAtTime(70, t); cr.frequency.linearRampToValueAtTime(40, t + 0.7);
    fl.type = 'bandpass'; fl.frequency.value = 600; fl.Q.value = 9; env(g, t, 0.15, 0.1, 0.8, 'lin'); cr.connect(fl); fl.connect(g); g.connect(o); cr.start(t); cr.stop(t + 0.9);
    noise(t + 0.6, 0.6, { f: 2400, q: 0.5, vol: 0.2, out: o, attack: 0.05 });            // leaves swooshing
    tone(60, t + 0.95, 0.5, { vol: 0.6, slide: 0.5, out: o, send: 0.4 }); noise(t + 0.95, 0.7, { f: 300, type: 'lowpass', vol: 0.5, out: o, send: 0.3 });
  },
  mine(pos, gold) { if (!ctx) return; const t = now(), o = at(pos, 1.8, 10); noise(t, 0.05, { f: 4200, q: 5, vol: 0.4, out: o }); tone(gold ? 1760 : rnd(1100, 1400), t, gold ? 0.4 : 0.2, { type: 'triangle', vol: gold ? 0.14 : 0.1, out: o, send: 0.35 }); tone(95, t, 0.1, { vol: 0.3, slide: 0.6, out: o }); if (gold) { tone(2640, t + 0.06, 0.35, { type: 'sine', vol: 0.07, out: o, send: 0.5 }); tone(3520, t + 0.12, 0.3, { type: 'sine', vol: 0.04, out: o, send: 0.5 }); } },
  iceChip(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.3, 10); noise(t, 0.06, { f: 6000, q: 3, vol: 0.3, out: o }); for (let i = 0; i < 3; i++) tone(rnd(2500, 4500), t + i * 0.03, 0.12, { vol: 0.05, out: o, send: 0.4 }); tone(110, t, 0.08, { vol: 0.2, slide: 0.6, out: o }); },
  pluck(pos, fish) {
    if (!ctx) return; const t = now(), o = at(pos, 1.6, 8);
    if (fish) { noise(t, 0.3, { f: 1300, q: 0.7, vol: 0.35, out: o, slide: 0.5 }); tone(480, t + 0.06, 0.14, { vol: 0.08, slide: 1.9, out: o }); tone(900, t + 0.2, 0.06, { vol: 0.05, out: o }); }
    else { noise(t, 0.14, { f: 2600, q: 0.9, vol: 0.25, out: o }); tone(700, t + 0.02, 0.07, { type: 'triangle', vol: 0.12, slide: 1.7, out: o }); }
  },
  get(res) { if (!ctx) return; const t = now(), m = { wood: 72, stone: 67, food: 76, gold: 84 }[res] || 72; tone(midi(m), t, 0.09, { type: 'triangle', vol: 0.07 }); tone(midi(m + 7), t + 0.05, 0.14, { type: 'triangle', vol: 0.06, send: 0.2 }); },
  drink() { if (!ctx) return; const t = now(); for (let i = 0; i < 3; i++) { tone(280 + i * 50, t + i * 0.12, 0.09, { vol: 0.16, slide: 2 }); noise(t + i * 0.12, 0.07, { f: 900, q: 3, vol: 0.1 }); } tone(520, t + 0.42, 0.12, { vol: 0.06, slide: 0.7 }); voice(null, 1, [[0.48, 330, 280, 0.25, 'a']], 0.05); },
  splash(pos) { if (!ctx) return; const t = now(), o = at(pos, 1, 8); noise(t, 0.4, { f: 1400, q: 0.6, vol: 0.3, out: o, slide: 0.4 }); },
  eat() { if (!ctx) return; const t = now(); for (let i = 0; i < 4; i++) noise(t + i * 0.12, 0.07, { f: rnd(1300, 2000), q: 1.5, vol: 0.28 }); voice(null, 1, [[0.52, 330, 400, 0.12, 'o'], [0.66, 400, 300, 0.18, 'u']], 0.06); },
  sell(n = 1) { if (!ctx) return; const t = now(); noise(t, 0.05, { f: 5000, q: 4, vol: 0.22 }); tone(midi(88), t, 0.12, { type: 'square', vol: 0.055 }); tone(midi(95), t + 0.07, 0.45, { type: 'square', vol: 0.055, send: 0.3 }); for (let i = 0; i < Math.min(8, n + 2); i++) { tone(rnd(3000, 4200), t + 0.12 + i * 0.045, 0.06, { vol: 0.04 }); noise(t + 0.12 + i * 0.045, 0.02, { f: 7000, q: 6, vol: 0.08 }); } },
  build(pos) {
    if (!ctx) return; const t = now(), o = at(pos, 1.3, 14);
    for (let i = 0; i < 5; i++) { noise(t + i * 0.13, 0.06, { f: 1100 + i * 80, q: 2, vol: 0.4, out: o }); tone(170, t + i * 0.13, 0.08, { vol: 0.2, slide: 0.6, out: o, type: 'triangle' }); }
    noise(t + 0.2, 0.5, { f: 600, q: 0.6, vol: 0.15, out: o, slide: 0.7 });
    [60, 64, 67, 72, 76, 79].forEach((m, i) => { INST.brass(m, t + 0.7 + i * 0.08, 0.3 + (i === 5 ? 0.6 : 0), 0.35, sfxBus); });
    DRUM.tim(t + 0.7, 0.8, sfxBus);
  },
  bonk(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.5, 10); noise(t, 0.05, { f: 700, q: 1, vol: 0.5, out: o }); tone(440, t, 0.4, { type: 'sine', vol: 0.3, slide: 0.45, out: o, vib: 0.08 }); tone(900, t + 0.02, 0.1, { type: 'square', vol: 0.05, out: o }); voice(pos, 1.2, [[0.05, 500, 700, 0.12, 'o']], 0.08); },
  swing(pos) { if (!ctx) return; const t = now(), o = at(pos, 0.8); noise(t, 0.16, { f: 800, q: 1.2, vol: 0.22, slide: 2.4, out: o, attack: 0.03 }); },
  faint() { if (!ctx) return; const t = now(); voice(null, 1, [[0, 420, 200, 0.7, 'o']], 0.1); tone(440, t, 1, { type: 'sawtooth', vol: 0.05, slide: 0.25, send: 0.4 }); tone(220, t + 0.1, 1, { type: 'triangle', vol: 0.12, slide: 0.3 }); noise(t + 0.75, 0.25, { f: 300, vol: 0.35 }); for (let i = 0; i < 3; i++) tone(midi(84 + i * 3), t + 1 + i * 0.12, 0.2, { vol: 0.04, send: 0.4 }); },
  wake() { if (!ctx) return; const t = now(); [60, 67, 72].forEach((m, i) => INST.harp(m, t + i * 0.1, 1, 0.25, sfxBus)); voice(null, 1, [[0.1, 300, 450, 0.3, 'a']], 0.06); },
  ouch(id = 1) { if (!ctx) return; voice(null, pitchOf(id), [[0, 600, 400, 0.13, 'o']], 0.09); tone(600, now(), 0.12, { type: 'square', vol: 0.03, slide: 0.6 }); },
  warn() { if (!ctx) return; const t = now(); for (let i = 0; i < 3; i++) { tone(660, t + i * 0.5, 0.25, { type: 'square', vol: 0.06, send: 0.3 }); tone(440, t + i * 0.5 + 0.25, 0.25, { type: 'square', vol: 0.06, send: 0.3 }); } DRUM.taiko(t, 0.7, sfxBus); DRUM.taiko(t + 1, 0.8, sfxBus); },
  thunder(d = 10) { if (!ctx) return; const t = now(), v = 1 / (1 + d / 25), lag = Math.min(1.5, d / 60); noise(t + lag, 0.12, { f: 3000, q: 0.5, vol: 0.5 * v, type: 'highpass' }); noise(t + lag + 0.05, 2.6, { f: 170, q: 0.6, vol: 1.0 * v, type: 'lowpass', attack: 0.05, send: 0.6 }); noise(t + lag + 0.4, 2, { f: 80, q: 0.8, vol: 0.7 * v, type: 'lowpass', attack: 0.2 }); for (let i = 0; i < 4; i++) noise(t + lag + 0.2 + i * rnd(0.2, 0.5), 0.4, { f: 120, type: 'lowpass', vol: 0.4 * v }); },
  rockfall(pos) { if (!ctx) return; const t = now(), o = at(pos, 1.7, 14); noise(t, 1.3, { f: 150, q: 0.7, vol: 0.9, type: 'lowpass', out: o, send: 0.3 }); for (let i = 0; i < 8; i++) { noise(t + rnd(0, 0.8), 0.08, { f: rnd(500, 1400), q: 2, vol: 0.3, out: o }); tone(rnd(60, 120), t + rnd(0, 0.6), 0.15, { vol: 0.2, slide: 0.5, out: o }); } },
  whistle(pos) { if (!ctx) return; const t = now(), o = at(pos, 1, 14); tone(1800, t, 1.2, { type: 'sine', vol: 0.06, slide: 0.35, out: o }); noise(t, 1.2, { f: 1500, q: 3, vol: 0.05, out: o, slide: 0.4 }); },
  zapWarn(pos) { if (!ctx) return; const t = now(), o = at(pos, 1, 12); noise(t, 1.2, { f: 3000, q: 8, vol: 0.06, out: o, attack: 0.9, curve: 'lin' }); tone(120, t, 1.2, { type: 'sawtooth', vol: 0.03, slide: 1.8, out: o, attack: 1 }); },
  crate() { if (!ctx) return; const t = now(); for (const d of [0, 7]) tone(95, t, 3, { type: 'sawtooth', vol: 0.04, vib: 0.03, vibRate: 30, attack: 0.8, detune: d, send: 0.3, curve: 'lin' }); noise(t, 3, { f: 350, q: 0.6, vol: 0.08, attack: 1, curve: 'lin' }); noise(t + 1.8, 0.3, { f: 1500, q: 1, vol: 0.15, slide: 0.5 }); [72, 76, 79, 84].forEach((m, i) => INST.marimba(m, t + 2.1 + i * 0.09, 0.2, 0.3, sfxBus)); },
  open() { if (!ctx) return; const t = now(); noise(t, 0.18, { f: 600, q: 1, vol: 0.45 }); tone(140, t, 0.2, { vol: 0.2, slide: 0.6, type: 'triangle' }); [72, 76, 79, 84, 88].forEach((m, i) => INST.marimba(m, t + 0.12 + i * 0.06, 0.2, 0.35, sfxBus)); for (let i = 0; i < 6; i++) tone(rnd(3000, 4500), t + 0.3 + i * 0.05, 0.06, { vol: 0.04 }); },
  pickup() { if (!ctx) return; const t = now(); tone(880, t, 0.08, { type: 'triangle', vol: 0.1, slide: 1.5 }); tone(1320, t + 0.06, 0.12, { type: 'triangle', vol: 0.08, send: 0.2 }); },
  full() { if (!ctx) return; const t = now(); tone(300, t, 0.15, { type: 'square', vol: 0.045 }); tone(240, t + 0.14, 0.2, { type: 'square', vol: 0.045 }); },
  dawn() { if (!ctx) return; const t = now(); [67, 71, 74, 79, 83].forEach((m, i) => INST.harp(m, t + i * 0.15, 1.5, 0.22, sfxBus)); ambience.bird(); setTimeout(() => ambience.bird(), 700); tone(midi(79), t + 0.9, 1.4, { type: 'sine', vol: 0.04, send: 0.6, vib: 0.01 }); },
  dusk() { if (!ctx) return; const t = now(); [72, 67, 64, 60, 55].forEach((m, i) => INST.bell(m, t + i * 0.25, 1, 0.18, sfxBus)); },
  howl() { if (!ctx) return; const t = now(), o = at([listener.x + rnd(-40, 40), listener.y, listener.z + rnd(20, 40)], 0.45, 30, ambBus || sfxBus); tone(400, t, 0.6, { type: 'sine', vol: 0.12, slide: 1.35, out: o, attack: 0.25, send: 0.8 }); tone(540, t + 0.55, 1.8, { type: 'sine', vol: 0.12, slide: 0.7, out: o, vib: 0.02, attack: 0.1, send: 0.8 }); },
  heartbeat(v = 1) { if (!ctx) return; const t = now(); tone(58, t, 0.16, { vol: 0.5 * v, slide: 0.6 }); tone(52, t + 0.2, 0.2, { vol: 0.38 * v, slide: 0.6 }); },
  // your body complaining
  growl() { if (!ctx) return; const t = now(), o = ctx.createOscillator(), fl = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 70; l.frequency.value = 9; lg.gain.value = 30; l.connect(lg); lg.connect(o.frequency); fl.type = 'lowpass'; fl.frequency.value = 260; fl.Q.value = 6; env(g, t, 0.2, 0.2, 1.1, 'lin'); o.connect(fl); fl.connect(g); g.connect(sfxBus); for (const x of [o, l]) { x.start(t); x.stop(t + 1.2); } },
  chatter() { if (!ctx) return; const t = now(); for (let i = 0; i < 10; i++) { noise(t + i * 0.055, 0.02, { f: 3200, q: 3, vol: 0.12 }); tone(900, t + i * 0.055, 0.015, { vol: 0.03 }); } },
  pant() { if (!ctx) return; const t = now(); for (let i = 0; i < 3; i++) { noise(t + i * 0.42, 0.18, { f: 1400, q: 0.8, vol: 0.12, attack: 0.05 }); noise(t + i * 0.42 + 0.2, 0.16, { f: 900, q: 0.8, vol: 0.09, attack: 0.04 }); } },
  cough() { if (!ctx) return; const t = now(); for (let i = 0; i < 2; i++) { noise(t + i * 0.25, 0.12, { f: 600, q: 1, vol: 0.25 }); voice(null, 1, [[i * 0.25, 220, 160, 0.1, 'a']], 0.06); } },
  ahh() { if (!ctx) return; voice(null, 1, [[0, 380, 300, 0.6, 'a']], 0.06); },
  // someone said something in chat: a googly babble from them
  babble(pos, id = 2, n = 4) { if (!ctx) return; const p = pitchOf(id), pat = []; const vs = 'aeiou'; for (let i = 0; i < n; i++) { const f = rnd(260, 420); pat.push([i * 0.11, f, f * rnd(0.8, 1.2), 0.09, vs[Math.random() * 5 | 0]]); } voice(pos, p, pat, 0.07); },
  yay(pos, id = 1) { if (!ctx) return; voice(pos, pitchOf(id), [[0, 400, 600, 0.15, 'a'], [0.17, 600, 750, 0.25, 'i']], 0.09); },
  aww(pos, id = 1) { if (!ctx) return; voice(pos, pitchOf(id), [[0, 420, 280, 0.6, 'o']], 0.08); },
  alarm() { if (!ctx) return; const t = now(); tone(880, t, 0.12, { type: 'square', vol: 0.05 }); tone(660, t + 0.14, 0.12, { type: 'square', vol: 0.05 }); },
  beep(hi) { if (!ctx) return; tone(hi ? 1320 : 880, now(), hi ? 0.4 : 0.15, { type: 'square', vol: 0.07, send: 0.2 }); },
  coin(n = 1) { if (!ctx) return; const t = now(); for (let i = 0; i < Math.min(n, 14); i++) { tone(midi(88), t + i * 0.07, 0.08, { type: 'square', vol: 0.045 }); tone(midi(95), t + i * 0.07 + 0.05, 0.25, { type: 'square', vol: 0.045, send: 0.2 }); } },
  buy() { if (!ctx) return; const t = now(); noise(t, 0.05, { f: 3000, q: 2, vol: 0.2 }); [76, 79, 84, 88].forEach((m, i) => INST.marimba(m, t + 0.05 + i * 0.07, 0.3, 0.4, sfxBus)); },
  nope() { if (!ctx) return; const t = now(); tone(220, t, 0.12, { type: 'square', vol: 0.07 }); tone(180, t + 0.12, 0.2, { type: 'square', vol: 0.07 }); },
  win() { if (!ctx) return; const t = now(); [67, 72, 76, 79, 84].forEach((m, i) => INST.brass(m, t + i * 0.12, i === 4 ? 1.2 : 0.2, 0.4, sfxBus)); [0, 0.36, 0.6].forEach(d => DRUM.tim(t + d, 0.9, sfxBus)); for (let i = 0; i < 24; i++) noise(t + 0.8 + Math.random() * 1.4, 0.05, { f: 3000 + Math.random() * 3000, q: 6, vol: 0.08 }); voice(null, 1.1, [[0.6, 400, 650, 0.2, 'a'], [0.82, 650, 800, 0.4, 'i']], 0.09); },
  lose() { if (!ctx) return; const t = now(); [67, 63, 60, 55].forEach((m, i) => INST.horn(m, t + i * 0.25, 0.45 + (i === 3 ? 0.6 : 0), 0.35, sfxBus)); voice(null, 1, [[1, 420, 260, 0.8, 'o']], 0.07); },
  chat() { if (!ctx) return; tone(1200, now(), 0.05, { vol: 0.05 }); },
  join() { if (!ctx) return; const t = now(); INST.marimba(76, t, 0.2, 0.35, sfxBus); INST.marimba(83, t + 0.08, 0.2, 0.35, sfxBus); },
  shopOpen() { if (!ctx) return; const t = now(); [84, 88, 91, 96].forEach((m, i) => INST.bell(m, t + i * 0.05, 0.5, 0.15, sfxBus)); sfx.panel(true); },
};

// ------------------------------------------------------------------ ?audiotest=1: render every sound offline and measure it
export async function audioTest(onRow) {
  const out = {}, saved = { ctx, master, comp, sfxBus, musicBus, ambBus, ambFilter, verb, verbIn, noiseBuf, song: music.song, gain: music.gain, loops: ambience.loops };
  const wasOn = [musicOn, sfxOn]; musicOn = sfxOn = true;
  const run = async (name, secs, fn) => {
    const oc = new OfflineAudioContext(2, Math.floor(44100 * secs), 44100);
    buildGraph(oc); music.gain = null; ambience.loops = {}; ambience.timers = {};
    try { fn(); } catch (e) { out[name] = { err: e.message }; onRow?.(name, out[name]); return; }
    const buf = await oc.startRendering(), d = buf.getChannelData(0);
    let s = 0, pk = 0; for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; pk = Math.max(pk, Math.abs(d[i])); }
    out[name] = { rms: +Math.sqrt(s / d.length).toFixed(4), peak: +pk.toFixed(3) };
    onRow?.(name, out[name]);
  };
  for (const k of Object.keys(sfx)) await run('sfx.' + k, 2.6, () => sfx[k](k === 'step' ? null : undefined));
  for (const surf of ['snow', 'sand', 'grass', 'rock', 'wood', 'water']) await run('step.' + surf, 0.6, () => sfx.step(null, 1, surf));
  for (const n of Object.keys(SONGS)) await run('song.' + n, 8, () => { music.song = n; music.step = 0; music.next = 0; music.gain = ctx.createGain(); music.gain.connect(musicBus); music.fill(7.8); });
  for (const [b, night, storm] of [['forest', 0, 0], ['forest', 1, 0], ['forest', 0, 1], ['arctic', 0, 1], ['desert', 0, 0], ['desert', 0, 1], ['mountains', 0, 0], ['camp', 0, 0]])
    await run(`amb.${b}${night ? '.night' : ''}${storm ? '.storm' : ''}`, 5, () => { ambience.start(); for (let i = 0; i < 40; i++) ambience.update(0.5, { biome: b, night, storm, fire: 4, water: 6, inside: false }); });
  Object.assign(music, { song: saved.song, gain: saved.gain }); ambience.loops = saved.loops;
  ({ ctx, master, comp, sfxBus, musicBus, ambBus, ambFilter, verb, verbIn, noiseBuf } = saved);
  [musicOn, sfxOn] = wasOn;
  return out;
}
