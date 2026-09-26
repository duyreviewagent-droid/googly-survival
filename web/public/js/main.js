// Googly Survival — browser client: menus, shop, solo engine, online lobbies, controls, prediction, HUD, minimap.
import * as THREE from 'three';
import { World } from './world.js';
import { Googly, SKINS } from './googly.js';
import { Pet, PETS } from './pets.js';
import { MAPS, CAMP, BIOME_LIST } from './maps.js';
import * as S from './sim.js';
import { Room, newPlayer, TIERS, TIER_NAMES, SHOP, BASE_PRICE, RESOURCES, DAY_LEN, NIGHT_FRAC, DIFF_NAMES } from './core.js';
import { sfx, music, ambience, unlockAudio, setMusic, setSfx, setVolume, audioState, setListener } from './sfx.js';

const Q = new URLSearchParams(location.search);
if (Q.has('shim')) window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('gsv.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gsv.' + k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem('gsv.' + k); } catch { } },
};
const COLORS = ['#ff6fb5', '#e8452c', '#ff9500', '#ffcc00', '#7bd13b', '#34c759', '#00c7be', '#2f7bff', '#9b59ff', '#8a5a2b', '#f2f2f7', '#3a3a3c', '#c8a078', '#5a2ab0'];
const prof = {
  name: store.get('name', ''), color: store.get('color', '#ffcc00'), skin: store.get('skin', 'none'), pet: store.get('pet', 'none'),
  stars: store.get('stars', 60), owned: store.get('owned', ['none']), ownedPets: store.get('ownedPets', ['none']),
  sens: store.get('sens', 1), invy: store.get('invy', false), zoom: store.get('zoom', 4.6),
  solo: store.get('soloSet', { map: -1, diff: 0, days: 4, storms: true, bonk: true }),
};
if (Q.has('stars')) prof.stars = +Q.get('stars');
const isMac = !!window.webkit?.messageHandlers?.gp;
const mobile = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
if (mobile) document.body.classList.add('mobile');
// the key a prompt shows: a keyboard letter on computers, the touch button's name on phones
const TOUCH_KEY = { E: 'USE', B: 'BUILD', Q: 'EAT', R: 'SIP', F: 'BONK' };
const kk = k => mobile ? TOUCH_KEY[k] || k : k;
const RES_EMOJI = { wood: '🪵', stone: '🪨', food: '🍗', gold: '🥇' };
const labelOf = (k, mapId = G?.mapId) => (MAPS[mapId ?? 2]?.labels || MAPS[2].labels)[k];
const resEmoji = (k, mapId = G?.mapId) => k === 'stone' && mapId === 0 ? '🧊' : k === 'food' ? ({ 0: '🐟', 1: '🌵', 2: '🫐', 3: '🫐' }[mapId] || '🍗') : RES_EMOJI[k];

const world = new World($('view'));
const clock = new THREE.Clock();
let G = null;              // the place we're in (Base Camp or a survival map)
let room = null, myId = 0;
let local = null;          // PLAY SOLO: the whole game runs right here in the page
let pendingRoom = (Q.get('room') || '').toUpperCase().slice(0, 4);
const ME = { hp: 100, food: 100, water: 100, temp: 50, env: 50, inv: { wood: 0, stone: 0, food: 0, gold: 0 }, can: 0, cap: 30, canCap: 3, coins: 0, tools: [], tier: 0, faint: 0, shelter: 0 };

// ------------------------------------------------------------------ screens
const SCREENS = ['scr-title', 'scr-solo', 'scr-online', 'scr-shop', 'scr-pause', 'scr-end', 'scr-help'];
let screen = 'scr-title', prevScreen = 'scr-title';
function show(id) { if (id !== screen) prevScreen = screen; screen = id; if (id && mobile) $('toast').style.opacity = 0; for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
function toast(t, ms = 2400) { const e = $('toast'); e.textContent = t; e.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.opacity = 0, ms); }
document.querySelectorAll('.back').forEach(b => b.onclick = () => { sfx.click(); show(screen === 'scr-help' && prevScreen !== 'scr-help' ? prevScreen : 'scr-title'); if (screen === 'scr-pause' && !G) show('scr-title'); });
document.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
document.addEventListener('keydown', () => unlockAudio(), { capture: true });
// iOS only lets audio start from a touchend / click, not a touchstart
document.addEventListener('touchend', () => unlockAudio(), { capture: true });
document.addEventListener('click', () => unlockAudio(), { capture: true });
if (mobile) {
  // no pinch-zoom, double-tap zoom or rubber-banding: only the panels that really scroll may move
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 || !e.target.closest?.('.card, .lp, #rooms, #shop-grid, #lb-log, input[type=range]')) e.preventDefault(); }, { passive: false });
  addEventListener('scroll', () => { if (scrollY) scrollTo(0, 0); });
}
let hoverT = 0;
document.addEventListener('mouseover', e => { const b = e.target.closest?.('button, .mapc, .item, .sw'); if (b && !b.disabled && performance.now() - hoverT > 60) { hoverT = performance.now(); sfx.hover(); } });

// ------------------------------------------------------------------ title: name, colour, stars
$('nm').value = prof.name;
$('nm').oninput = () => { prof.name = $('nm').value.replace(/[<>&"]/g, '').slice(0, 14); store.set('name', prof.name); sendMe(); };
function drawSwatches() {
  $('swatches').innerHTML = COLORS.map(c => `<div data-c="${c}" style="background:${c}" class="sw ${c === prof.color ? 'on' : ''}"></div>`).join('');
  $('swatches').querySelectorAll('div').forEach(d => d.onclick = () => setColor(d.dataset.c));
}
function setColor(c) { prof.color = c; store.set('color', c); sfx.click(); drawSwatches(); if (shopTab === 'colors') drawShop(); lookChanged(); }
drawSwatches();
function drawStars() { for (const id of ['t-stars', 's-stars']) $(id).textContent = prof.stars; }
function addStars(n) { prof.stars += n; store.set('stars', prof.stars); drawStars(); }
drawStars();
function needName() { if (!prof.name.trim()) { $('nm').focus(); toast('Type your name first'); sfx.nope(); return true; } return false; }
$('b-solo').onclick = () => { if (needName()) return; sfx.click(); show('scr-solo'); drawSoloMaps(); };
$('b-online').onclick = () => { if (needName()) return; sfx.click(); openOnline(); };
$('b-help').onclick = $('p-help').onclick = () => { sfx.click(); show('scr-help'); };
$('b-shop').onclick = () => { sfx.shopOpen(); openShop(); };
const fsToggle = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen not available here')); };
$('b-fs').onclick = $('p-fs').onclick = () => { sfx.click(); fsToggle(); };
if (!document.documentElement.requestFullscreen) for (const id of ['b-fs', 'p-fs']) $(id).classList.add('hidden');   // iPhone Safari can't
function drawAudioBtns() { const a = audioState(); for (const id of ['b-music', 'p-music']) $(id).textContent = a.music ? '♪ Music: on' : '♪ Music: off'; for (const id of ['b-sfx', 'p-sfx']) $(id).textContent = a.sfx ? '🔊 Sound: on' : '🔈 Sound: off'; }
$('b-music').onclick = $('p-music').onclick = () => { setMusic(!audioState().music); drawAudioBtns(); };
$('b-sfx').onclick = $('p-sfx').onclick = () => { setSfx(!audioState().sfx); drawAudioBtns(); sfx.click(); };
drawAudioBtns();
function drawInvite() {
  $('invite').classList.toggle('hidden', !pendingRoom);
  $('invite').innerHTML = `You've been invited to lobby <b>${esc(pendingRoom)}</b> — type your name and press JOIN`;
  $('b-online').innerHTML = pendingRoom ? `JOIN ${esc(pendingRoom)}<small>your friend's lobby</small>` : 'PLAY ONLINE<small>optional · lobbies · codes · invite up to 3 friends</small>';
}
drawInvite();
function drawContinue() {
  const s = store.get('solo', null);
  $('b-continue').classList.toggle('hidden', !s);
  if (s) $('continue-sub').textContent = `${BIOME_LIST[s.map]?.emoji || ''} ${BIOME_LIST[s.map]?.name || ''} · day ${s.day} of ${s.days} · saved ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
drawContinue();
$('b-continue').onclick = () => { if (needName()) return; sfx.click(); continueSolo(); };

// ------------------------------------------------------------------ solo setup
function mapCards(el, cur, onPick, small = false, locked = false) {
  const list = [...BIOME_LIST, { id: -1, key: 'random', name: 'Random', emoji: '🎲', blurb: 'Surprise me!' }];
  el.innerHTML = list.map(b => `<div class="mapc ${b.key} ${b.id === cur ? 'on' : ''} ${locked ? 'locked' : ''}" data-id="${b.id}"><span class="em">${b.emoji}</span>${esc(b.name)}<small>${esc(b.blurb)}</small></div>`).join('');
  if (!locked) el.querySelectorAll('.mapc').forEach(d => d.onclick = () => { sfx.click(); onPick(+d.dataset.id); });
}
function drawSoloMaps() { mapCards($('solo-maps'), prof.solo.map, id => { prof.solo.map = id; store.set('soloSet', prof.solo); drawSoloMaps(); }); }
$('solo-d').value = prof.solo.diff; $('solo-days').value = prof.solo.days; $('solo-storms').value = prof.solo.storms ? 1 : 0; $('solo-bonk').value = prof.solo.bonk ? 1 : 0;
for (const [id, k, f] of [['solo-d', 'diff', Number], ['solo-days', 'days', Number], ['solo-storms', 'storms', v => v === '1'], ['solo-bonk', 'bonk', v => v === '1']]) $(id).onchange = () => { prof.solo[k] = f($(id).value); store.set('soloSet', prof.solo); };
$('solo-go').onclick = () => { sfx.click(); startSolo(prof.solo); };

// ------------------------------------------------------------------ the solo engine: a Room right here in the page
function makeLocal() {
  const inbox = [];
  const r = new Room({ code: 'SOLO', solo: true, settings: {}, out: (p, m) => inbox.push(m) });
  const p = newPlayer({ id: 1, name: prof.name.trim() || 'GOOGLY', color: prof.color, skin: prof.skin, pet: prof.pet });
  local = { room: r, p, inbox };
  myId = 1;
  return local;
}
function startSolo(set) {
  closeOnline();
  const L = makeLocal();
  Object.assign(L.room.settings, { map: set.map, diff: set.diff, days: set.days, storms: set.storms, bonk: set.bonk, cpus: true });
  L.room.syncBots();
  L.room.join(L.p);
  if (Q.get('noCpus') === '1') { for (const b of [...L.room.players.values()]) if (b.bot) L.room.players.delete(b.id); }
  L.room.start();
  store.del('solo'); drawContinue();
  pump();
}
function continueSolo() {
  const s = store.get('solo', null); if (!s) return;
  closeOnline();
  const L = makeLocal();
  try { L.room.restore(s.data, L.p); } catch (e) { console.error(e); toast("Couldn't load that save — starting fresh"); store.del('solo'); drawContinue(); local = null; return; }
  pump();
}
function saveSolo(flash = true) {
  if (!local) return;
  const data = local.room.save();
  if (!data) return;
  store.set('solo', { data, at: Date.now(), map: data.mapId, day: data.day, days: data.settings.days });
  if (flash) { const e = $('saved'); e.style.opacity = 1; setTimeout(() => e.style.opacity = 0, 1200); }
}
setInterval(() => { if (local && G && G.mapId !== CAMP && G.state === 'play') saveSolo(); store.set('stars', prof.stars); }, 30000);
addEventListener('beforeunload', () => { if (local && G?.state === 'play') saveSolo(false); });
let lastPump = performance.now();
function pump() {
  if (!local) return;
  const t = performance.now(), dt = Math.min(0.1, (t - lastPump) / 1000); lastPump = t;
  if (dt > 0) local.room.tick(dt);
  const box = local.inbox.splice(0);
  for (const m of box) onMsg(m);
}
setInterval(() => { if (document.hidden) pump(); }, 50);        // keep the world going in a background tab

// ------------------------------------------------------------------ online
let ws = null, wasConnected = false, wantOnline = false;
// the web page talks to the server it came from; the Mac app (which carries the game inside it) talks to Render
const SERVER = (window.__server || (location.protocol.startsWith('http') ? location.origin : 'https://googly-survival.onrender.com')).replace(/\/$/, '');
function send(m) {
  if (local) { if (m.t === 'leave') return; if (m.t === 'me') { Object.assign(local.p, { name: m.name, color: m.color, skin: m.skin, pet: m.pet }); return; } local.room.handle(local.p, m); return; }
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
}
function sendMe() { send({ t: 'me', name: prof.name.trim() || 'GOOGLY', color: prof.color, skin: prof.skin, pet: prof.pet }); }
function connect() {
  if (ws && ws.readyState <= 1) return;
  $('on-status').textContent = 'Connecting to the server… (it can take ~30 seconds to wake up)';
  ws = new WebSocket(SERVER.replace(/^http/, 'ws'));
  ws.onopen = () => { wasConnected = true; $('on-status').textContent = 'Connected. Make a lobby, or join one with a code.'; sendMe(); send({ t: 'list' }); if (pendingRoom) { send({ t: 'join', code: pendingRoom }); pendingRoom = ''; drawInvite(); } else autoLobby(); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (!local) onMsg(m); };
  ws.onclose = () => {
    if (local) return;
    if (wasConnected) toast('Lost connection to the server — reconnecting…', 4000);
    wasConnected = false;
    if (G && !local) { leaveWorld(); room = null; show('scr-title'); }
    $('on-status').textContent = "Can't reach the server right now. PLAY SOLO works without it!";
    if (wantOnline) setTimeout(connect, 2000);
  };
}
function openOnline() { wantOnline = true; show('scr-online'); connect(); if (ws?.readyState === 1) send({ t: 'list' }); }
function closeOnline() { wantOnline = false; if (ws) { const w = ws; ws = null; w.onclose = null; try { w.close(); } catch { } } }
function autoLobby() { if (Q.has('lobby')) { if (!prof.name) prof.name = 'TESTER'; sendMe(); send({ t: 'create', public: false }); } }
setInterval(() => { if (!local && ws?.readyState === 1) send({ t: 'ping', c: performance.now() }); }, 5000);
$('on-pub').onclick = () => { sfx.click(); send({ t: 'create', public: true }); };
$('on-priv').onclick = () => { sfx.click(); send({ t: 'create', public: false }); };
$('on-join').onclick = () => { const c = $('on-code').value.trim().toUpperCase(); if (c.length !== 4) return toast('Lobby codes are 4 letters'); sfx.click(); send({ t: 'join', code: c }); };
$('on-code').onkeydown = e => { if (e.key === 'Enter') $('on-join').click(); };
$('on-ref').onclick = () => { sfx.click(); send({ t: 'list' }); };
function drawRooms(list) {
  $('rooms').innerHTML = list.length ? list.map(r => `<div class="roomrow"><div><b>${esc(r.name)}</b><small>${r.humans}/4 players · ${esc(r.map)} · CPUs ${esc(r.diff)} · ${r.state === 'lobby' ? 'waiting at camp' : 'game on — take over a CPU'}</small></div><button class="green" data-c="${r.code}">JOIN</button></div>`).join('')
    : `<div class="empty">No open lobbies right now. Make one and send your friends the code!</div>`;
  $('rooms').querySelectorAll('button').forEach(b => b.onclick = () => { sfx.click(); send({ t: 'join', code: b.dataset.c }); });
}
setInterval(() => { if (screen === 'scr-online' && !G && !local) send({ t: 'list' }); }, 4000);

// ------------------------------------------------------------------ shop (stars → skins, pets)
let shopTab = 'skins', shopOpen = false;
function seg(el, value, onPick) {
  const draw = v => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  el.querySelectorAll('button').forEach(b => b.onclick = () => { sfx.click(); draw(b.dataset.v); onPick(b.dataset.v); });
  draw(value);
}
seg($('shop-tab'), shopTab, v => { shopTab = v; drawShop(); });
function openShop() { shopOpen = true; show('scr-shop'); drawShop(); keys.clear(); unlock(); }
function closeShop() { shopOpen = false; show(G ? null : 'scr-title'); }
$('shop-close').onclick = () => { sfx.click(); closeShop(); };
function drawShop() {
  drawStars();
  const g = $('shop-grid');
  if (shopTab === 'colors') {
    g.innerHTML = COLORS.map(c => `<div class="item ${c === prof.color ? 'on' : ''}" data-c="${c}"><i class="sk" style="background:${c}"></i>Colour<small class="own">${c === prof.color ? 'WEARING' : 'free'}</small></div>`).join('');
    g.querySelectorAll('.item').forEach(d => d.onclick = () => setColor(d.dataset.c));
    return;
  }
  const pets = shopTab === 'pets', list = pets ? PETS : SKINS, owned = pets ? prof.ownedPets : prof.owned, cur = pets ? prof.pet : prof.skin;
  g.innerHTML = list.map(it => {
    const has = owned.includes(it.id) || it.price === 0, on = it.id === cur;
    const icon = pets ? `<span class="em">${it.emoji}</span>` : `<i class="sk" style="background:${it.dot(prof.color)}"></i>`;
    const tag = on ? `<small class="eq">${pets ? 'WITH YOU' : 'WEARING'}</small>` : has ? `<small class="own">owned · tap to use</small>` : `<small class="price">★ ${it.price}</small>`;
    return `<div class="item ${on ? 'on' : ''} ${has ? '' : 'locked'}" data-id="${it.id}">${icon}${it.name}${tag}</div>`;
  }).join('');
  g.querySelectorAll('.item').forEach(d => d.onclick = () => buy(pets, d.dataset.id));
}
function buy(pets, id) {
  const it = (pets ? PETS : SKINS).find(x => x.id === id), owned = pets ? prof.ownedPets : prof.owned;
  if (!owned.includes(id) && it.price > 0) {
    if (prof.stars < it.price) { sfx.nope(); toast(`You need ${it.price - prof.stars} more stars — finish games to earn them!`); return; }
    addStars(-it.price); owned.push(id); store.set(pets ? 'ownedPets' : 'owned', owned);
    sfx.buy(); toast(`You got ${it.name}!`);
  } else sfx.click();
  if (pets) { prof.pet = id; store.set('pet', id); } else { prof.skin = id; store.set('skin', id); }
  drawShop(); lookChanged();
}
function lookChanged() {
  sendMe();
  if (preview) { preview.fig.setLook(prof.color, prof.skin); setPet(preview, prof.pet); }
  const e = G?.ents.get(myId); if (e) { e.fig.setLook(prof.color, prof.skin); setPet(e, prof.pet); }
}

// ------------------------------------------------------------------ lobby panel
const amHost = () => room && room.host === myId;
function drawLobby() {
  if (!room) return;
  $('lb-code').textContent = room.code;
  $('lb-count').textContent = `· ${room.players.filter(p => !p.bot).length}/4 players`;
  const slots = room.players.map(p => `<div class="pl"><span class="dot" style="background:${esc(p.color)}"></span>${esc(p.name)}${p.id === myId ? ' (you)' : ''}${p.pet && p.pet !== 'none' ? ' ' + (PETS.find(x => x.id === p.pet)?.emoji || '') : ''}<span class="tag">${p.bot ? 'CPU' : p.host ? 'HOST' : 'PLAYER'}</span></div>`);
  for (let i = room.players.length; i < 4; i++) slots.push(`<div class="pl" style="opacity:.5"><span class="dot" style="background:transparent"></span>empty spot<span class="tag">invite a friend</span></div>`);
  $('lb-players').innerHTML = slots.join('');
  const s = room.settings, h = amHost();
  mapCards($('lb-maps'), s.map, id => send({ t: 'set', settings: { map: id } }), true, !h);
  $('lb-days').value = String(s.days); $('lb-diff').value = String(s.diff); $('lb-cpus').value = s.cpus ? '1' : '0'; $('lb-storms').value = s.storms ? '1' : '0'; $('lb-bonk').value = s.bonk ? '1' : '0';
  for (const id of ['lb-days', 'lb-diff', 'lb-cpus', 'lb-storms', 'lb-bonk']) $(id).disabled = !h;
  $('lb-pub').checked = room.public; $('lb-pub').disabled = !h;
  $('lb-hostctl').classList.toggle('hidden', !h);
  $('lb-summary').classList.toggle('hidden', h);
  const mapName = s.map < 0 ? '🎲 Random map' : `${BIOME_LIST[s.map].emoji} ${BIOME_LIST[s.map].name}`;
  $('lb-summary').innerHTML = `Map: <b>${mapName}</b><br>${s.days} days · CPUs ${s.cpus ? DIFF_NAMES[s.diff] : 'off'} · storms ${s.storms ? 'on' : 'off'} · bonking ${s.bonk ? 'on' : 'off'}<br>${room.public ? 'Public lobby' : 'Private lobby'} · only the host can change these`;
  $('lb-start').classList.toggle('hidden', !h);
  $('lb-start').textContent = room.state === 'lobby' ? 'START GAME' : 'GAME RUNNING…';
  $('lb-start').disabled = room.state !== 'lobby';
  const hostName = room.players.find(p => p.id === room.host)?.name || 'the host';
  $('lb-wait').textContent = h ? 'You are the host. Invite friends with the code or link, then press START GAME. Empty spots get computer googlies.' : `Waiting for ${hostName} to start… walk around while you wait!`;
}
for (const [id, k, f] of [['lb-days', 'days', Number], ['lb-diff', 'diff', Number], ['lb-cpus', 'cpus', v => v === '1'], ['lb-storms', 'storms', v => v === '1'], ['lb-bonk', 'bonk', v => v === '1']]) $(id).onchange = () => send({ t: 'set', settings: { [k]: f($(id).value) } });
$('lb-pub').onchange = () => send({ t: 'set', settings: { public: $('lb-pub').checked } });
$('lb-start').onclick = () => { sfx.click(); send({ t: 'start' }); };
$('lb-leave').onclick = () => { sfx.click(); leaveAll(); };
$('lb-shop').onclick = () => { sfx.shopOpen(); openShop(); };
$('lb-hide').onclick = () => { sfx.click(); $('lobbyui').classList.add('collapsed'); };
$('lb-show').onclick = () => { sfx.click(); $('lobbyui').classList.remove('collapsed'); };
const inviteLink = () => `${SERVER}/?room=${room.code}`;
$('lb-copy').onclick = async () => {
  sfx.click();
  const link = inviteLink();
  try { await navigator.clipboard.writeText(link); toast('Invite link copied! Send it to your friends: ' + link, 4000); }
  catch { prompt('Send this link to your friends:', link); }
};
if (navigator.share) { $('lb-share').classList.remove('hidden'); $('lb-share').onclick = () => navigator.share({ title: 'Googly Survival', text: `Come survive with me — lobby code ${room.code}`, url: inviteLink() }).catch(() => { }); }
$('lb-form').onsubmit = e => { e.preventDefault(); const t = $('lb-msg').value.trim(); if (t) send({ t: 'chat', text: t }); $('lb-msg').value = ''; $('lb-msg').blur(); };
function addChat(m) {
  const line = m.sys ? `<div class="sys">${esc(m.text)}</div>` : `<div><b style="color:${esc(m.color)}">${esc(m.from)}:</b> ${esc(m.text)}</div>`;
  for (const id of ['lb-log', 'log']) { const el = $(id); el.insertAdjacentHTML('beforeend', line); while (el.children.length > 40) el.firstChild.remove(); el.scrollTop = 1e6; }
  if (!m.sys) { sfx.chat(); const e = G && [...G.ents.values()].find(q => q.name === m.from); if (e) sfx.babble(e.id === myId ? null : [e.x, e.y + 1.4, e.z], e.id, Math.min(7, 2 + Math.ceil(m.text.length / 12))); }
}

// ------------------------------------------------------------------ messages from the game (the page's own Room, or the server)
function onMsg(m) {
  switch (m.t) {
    case 'hello': myId = m.id; break;
    case 'list': drawRooms(m.rooms); break;
    case 'err': toast(m.msg, 3500); sfx.nope(); break;
    case 'joined': sfx.join(); myId = m.id ?? myId; $('lb-log').innerHTML = ''; $('log').innerHTML = ''; if (!local && location.protocol.startsWith('http')) history.replaceState(null, '', '?room=' + m.code); break;
    case 'left': history.replaceState(null, '', location.pathname); break;
    case 'room': room = m.room; drawLobby(); break;
    case 'chat': addChat(m); break;
    case 'world': enterWorld(m); break;
    case 'toast': toast(m.text); sfx.full(); break;
    default: if (G) onGameMsg(m);
  }
}

// ------------------------------------------------------------------ entering a place
const me = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, onGround: true, crouch: false, yaw: 0, camYaw: 0, camPitch: -0.25, stun: 0 };
function enterWorld(m) {
  const map = world.load(m.map);
  preview = null;
  G = { mapId: m.map, map, state: m.state, clock: m.clock, days: m.days, settings: m.settings, ents: new Map(), sendT: 0, day: m.day, market: m.market, prevMarket: null, storm: m.storm ? { k: 'on', name: m.storm.name, until: m.clock + m.storm.left } : null, board: new Map(), lastDayPart: null, mm: null };
  for (const p of m.players) addEnt(p);
  const mine = m.players.find(p => p.id === myId);
  if (mine) Object.assign(me, { x: mine.x, y: mine.y, z: mine.z, vx: 0, vy: 0, vz: 0, yaw: mine.yaw, camYaw: mine.yaw, camPitch: m.map === CAMP ? -0.28 : -0.25, onGround: true, stun: 0 });
  (m.nodes || []).forEach((a, i) => world.setNode(i, a));
  for (const k of m.pickups || []) world.addPickup(k);
  for (const c of m.crates || []) world.addCrate(c, true);
  world.setStorm(!!m.storm);
  $('feed').innerHTML = '';
  closeTrade();
  if (m.map === CAMP) {
    $('lobbyui').classList.remove('hidden'); $('hud').classList.remove('hidden'); $('hud').classList.add('lobby');
    if (screen !== 'scr-shop') show(null);
    unlock(); music.play('camp');
    if (m.state === 'lobby' && G.wasEnd) toast('Back at Base Camp — walk around while you wait for the next game', 3000);
  } else {
    $('lobbyui').classList.add('hidden'); $('hud').classList.remove('hidden', 'lobby');
    shopOpen = false; show(null);
    const b = BIOME_LIST[m.map];
    music.play(b.key);
    if (m.clock < 3) { center(`${b.emoji} ${b.name.toUpperCase()}`, 3600, '#ffe07a', `Survive ${m.days} days · most money + best shelter wins`); sfx.dawn(); }
    buildMinimap();
    setTimeout(() => { if (G && G.mapId === m.map && G.clock < 40) hintOnce(mobile ? 'Hold USE next to a tree, rock or bush to gather. Your plot is the flag in your colour!' : 'Hold E (or hold the mouse) on a tree, rock or bush to gather. Your plot is the flag in your colour!'); }, 3800);
    if (!mobile && !Q.has('bot') && !Q.has('cam')) askLock();
    applyTestHooks();
  }
  drawTools();
}
function leaveWorld() {
  if (!G) return;
  G = null;
  $('hud').classList.add('hidden'); $('clickto').classList.add('hidden'); $('board').classList.add('hidden'); $('lobbyui').classList.add('hidden'); $('faint').classList.add('hidden');
  closeTrade(); unlock();
  music.play('menu');
  showPreview();
}
function leaveAll() {
  if (local) { if (G?.state === 'play') saveSolo(false); local = null; drawContinue(); }
  else send({ t: 'leave' });
  leaveWorld(); room = null; show('scr-title');
}
function setPet(a, kind) {
  if (a.petKind === kind) return;
  if (a.pet) { a.pet.group.parent?.remove(a.pet.group); a.pet = null; }
  a.petKind = kind;
  if (kind && kind !== 'none') { a.pet = new Pet(kind); world.actors.add(a.pet.group); }
}
function addEnt(p) {
  const isMe = p.id === myId;
  const fig = new Googly({ color: p.color, name: p.name, skin: p.skin, local: isMe });
  fig.group.position.set(p.x, p.y, p.z); fig.group.rotation.y = p.yaw + Math.PI;
  world.actors.add(fig.group);
  const e = { id: p.id, name: p.name, color: p.color, bot: p.bot, fig, buf: [], x: p.x, y: p.y, z: p.z, yaw: p.yaw, flags: 2, vx: 0, vz: 0, pet: null, petKind: null, plot: p.plot, tier: p.tier || 0, tools: p.tools || [], money: 0, faints: 0, hp: 100 };
  setPet(e, isMe ? prof.pet : p.pet);
  fig.setGear(e.tools);
  if (isMe) fig.onStep = v => sfx.step(null, v * 0.5, surfaceAt(me.x, me.y, me.z));
  else fig.onStep = v => { if (Math.hypot(e.x - me.x, e.z - me.z) < 22) sfx.step([e.x, e.y, e.z], v * 0.8, surfaceAt(e.x, e.y, e.z)); };
  G.ents.set(p.id, e);
  if (p.plot >= 0 && G.mapId !== CAMP) world.setPlot(p.plot, { color: p.color, name: p.id === myId ? 'Your' : p.name, tier: p.tier || 0 });
  return e;
}
const ent = id => G?.ents.get(id);
/** what your feet are on, for the footstep sound */
function surfaceAt(x, y, z) {
  const m = G?.map; if (!m) return 'grass';
  const l = m.wetAt(x, z); if (l && y < l.level + 0.25) return m.water?.ice ? 'rock' : 'water';
  const g = S.groundCol(m, x, z, S.PR, y + 0.1);
  if (g.c && g.g > m.h(x, z) + 0.1) return g.c.kind === 'log' || g.c.kind === 'counter' || g.c.kind === 'tramp' || g.c.kind === 'tent' ? 'wood' : 'rock';
  if (m.ground === 'snow') return 'snow'; if (m.ground === 'sand') return 'sand';
  if (m.ground === 'alpine') { if (y > 9.5) return 'snow'; if (m.slope(x, z) > 0.6) return 'rock'; }
  return 'grass';
}
const nameSpan = id => { const e = ent(id); return e ? `<span style="color:${esc(e.color)}">${esc(e.name)}</span>` : '???'; };
function center(text, ms = 1500, color = '#fff', small = '') { const c = $('center'); c.innerHTML = esc(text) + (small ? `<small>${esc(small)}</small>` : ''); c.style.color = color; c.style.opacity = 1; clearTimeout(center.t); center.t = setTimeout(() => c.style.opacity = 0, ms); }
function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d); while ($('feed').children.length > 6) $('feed').lastChild.remove(); }
function pop(text, color = '#fff') {
  const d = document.createElement('div'); d.className = 'popup'; d.textContent = text; d.style.color = color;
  d.style.cssText += `;position:absolute;left:50%;bottom:${120 + Math.random() * 20}px;transform:translateX(-50%);font-weight:900;font-size:20px;text-shadow:2px 2px #000;transition:all 1.1s ease-out;pointer-events:none`;
  $('hud').appendChild(d); requestAnimationFrame(() => { d.style.bottom = (parseFloat(d.style.bottom) + 70) + 'px'; d.style.opacity = 0; }); setTimeout(() => d.remove(), 1200);
}
const shown = new Set();
function hintOnce(t) { if (shown.has(t)) return; shown.add(t); toast(t, 5000); }

function onGameMsg(m) {
  const t = performance.now() / 1000;
  switch (m.t) {
    case 'snap':
      G.clock = m.clock;
      if (m.st !== G.state) G.state = m.st;
      for (const a of m.e) {
        const e = ent(a[0]); if (!e) continue;
        e.buf.push({ t, x: a[1], y: a[2], z: a[3], yaw: a[4], flags: a[5], vx: a[6], vz: a[7] });
        if (e.buf.length > 30) e.buf.shift();
      }
      break;
    case 'me': {
      const wasFaint = ME.faint > 0, oldInv = { ...ME.inv }, oldCoins = ME.coins;
      Object.assign(ME, m);
      if (!wasFaint && m.faint > 0) { $('faint').classList.remove('hidden'); unlock(); closeTrade(); }
      if (wasFaint && m.faint <= 0) { $('faint').classList.add('hidden'); if (!mobile && !Q.has('bot')) askLock(); }
      if (m.coins > oldCoins && G.lastSell !== m.coins) pop(`+$${m.coins - oldCoins}`, '#7dff9a');
      for (const k of RESOURCES) if (m.inv[k] > oldInv[k] && !G.gatherPop) pop(`+${m.inv[k] - oldInv[k]} ${resEmoji(k)} ${labelOf(k)}`);
      G.gatherPop = false;
      if (tradeOpen) drawTrade();
      drawTools();
      break;
    }
    case 'tp': Object.assign(me, { x: m.x, y: m.y, z: m.z, vx: 0, vy: 0, vz: 0 }); break;
    case 'kb': me.vx = m.vx; me.vz = m.vz; me.vy = m.vy; me.onGround = false; me.stun = 0.45; break;
    case 'ouch': sfx.ouch(myId); $('vign').style.setProperty('--vc', '#ff1a3a'); G.hurtT = 0.6; break;
    case 'join': if (!ent(m.p.id)) { addEnt(m.p); feed(`${nameSpan(m.p.id)} joined`); } break;
    case 'gone': { const e = ent(m.id); if (e) { world.actors.remove(e.fig.group); if (e.pet) world.actors.remove(e.pet.group); G.ents.delete(m.id); } break; }
    case 'look': { const e = ent(m.p.id); if (e && m.p.id !== myId) { e.fig.setLook(m.p.color, m.p.skin); e.color = m.p.color; setPet(e, m.p.pet); } break; }
    case 'node': {
      world.setNode(m.id, m.amt, true);
      const n = G.map.nodes[m.id]; if (!n || !m.by) break;
      const e = ent(m.by); if (e) { e.fig.reach(); e.fig.setTool(n.type === 'tree' ? 'axe' : n.type === 'food' ? null : 'pick'); e.toolT = 1.2; }
      const pos = [n.x, n.y + 1, n.z];
      if (n.type === 'tree') { sfx.chop(pos); world.chips({ x: n.x, y: n.y + 1.2, z: n.z }, 0xc8a070, 5); if (m.amt === 0) sfx.treeFall(pos); }
      else if (n.type === 'rock') { if (n.v === 'ice') sfx.iceChip(pos); else sfx.mine(pos, false); world.chips({ x: n.x, y: n.y + 0.9, z: n.z }, n.v === 'ice' ? 0xcfeaf8 : n.v === 'sandstone' ? 0xd08a52 : 0x8a8884, 5); }
      else if (n.type === 'gold') { sfx.mine(pos, true); world.chips({ x: n.x, y: n.y + 0.8, z: n.z }, 0xffc83a, 4); }
      else { sfx.pluck(pos, n.v === 'fish'); if (n.v === 'fish') world.puff({ x: n.x, y: n.y + 0.2, z: n.z }, 0xcfe8ff, 8, 2); }
      if (m.by === myId) { sfx.get(m.res); pop(`+1 ${resEmoji(m.res)} ${labelOf(m.res)}`); G.gatherPop = true; }
      break;
    }
    case 'pick':
      for (const k of m.add || []) world.addPickup(k);
      for (const id of m.rm || []) { world.removePickup(id); if (m.by === myId) sfx.pickup(); }
      break;
    case 'tier': {
      const e = ent(m.id); if (e) e.tier = m.tier;
      if (e && e.plot >= 0) world.setPlot(e.plot, { tier: m.tier });
      const pl = G.map.plots[e?.plot]; if (pl) sfx.build([pl.x, pl.y + 1, pl.z]);
      if (e) sfx.yay(m.id === myId ? null : [e.x, e.y + 1, e.z], m.id);
      if (m.id === myId) center(`YOU BUILT A ${TIER_NAMES[G.mapId][m.tier].toUpperCase()}!`, 2600, '#ffe07a', m.tier < 5 ? 'Warmer, safer, and worth more at the end' : 'The best shelter there is!');
      break;
    }
    case 'tools': { const e = ent(m.id); if (e) { e.tools = m.tools; e.fig.setGear(m.tools); } break; }
    case 'crate': world.addCrate(m.c); sfx.crate(); if (G.mapId !== CAMP) feed('📦 Supply crate dropped! Follow the yellow beam'); break;
    case 'crategone': world.removeCrate(m.id); if (m.by === myId) { sfx.open(); center(`SUPPLY CRATE! +$${m.coins}`, 2000, '#7dff9a'); } break;
    case 'zap': world.zapWarn(m); if (m.k === 'rock') sfx.whistle([m.x, m.y + 5, m.z]); else sfx.zapWarn([m.x, m.y, m.z]); break;
    case 'boom': world.boom(m); if (m.k === 'bolt') sfx.thunder(Math.hypot(m.x - me.x, m.z - me.z)); else sfx.rockfall([m.x, m.y, m.z]); break;
    case 'storm':
      if (m.k === 'warn') { G.storm = { k: 'warn', name: m.name, until: G.clock + m.in }; sfx.warn(); center(`${stormEmoji()} ${m.name} COMING!`, 3000, '#ff9a7a', 'Get to your shelter or the campfire at the trading post'); }
      if (m.k === 'start') { G.storm = { k: 'on', name: m.name, until: G.clock + m.left }; world.setStorm(true); }
      if (m.k === 'end') { G.storm = null; world.setStorm(false); feed('🌤 The storm has passed'); }
      break;
    case 'day': G.day = m.day; G.prevMarket = m.prev; G.market = m.market; sfx.dawn(); center(`☀️ DAY ${m.day}`, 2600, '#ffe07a', m.day === G.days ? 'The last day — make it count!' : 'The trading post has new prices'); break;
    case 'fx': {
      const e = ent(m.id); if (!e) break;
      const pos = [e.x, e.y + 1, e.z];
      if (m.k === 'faint') { e.fig.caught(); if (m.id === myId) { sfx.faint(); $('faint-why').textContent = `You ${m.why}.`; } else { feed(`😵 ${nameSpan(m.id)} fainted!`); sfx.aww(pos, m.id); } }
      if (m.k === 'wake' && m.id === myId) sfx.wake();
      if (m.k === 'drink') { if (m.id === myId) sfx.drink(); else sfx.splash(pos); e.fig.reach(); }
      if (m.k === 'eat' && m.id === myId) sfx.eat();
      if (m.k === 'sell' && m.id === myId) { sfx.sell(Math.ceil(m.got / 10)); pop(`+$${m.got}`, '#7dff9a'); G.lastSell = ME.coins + m.got; }
      if (m.k === 'buy' && m.id === myId) { sfx.buy(); const it = SHOP.find(s => s.id === m.item); if (it) pop(`${it.emoji} ${it.name}!`, '#ffe07a'); }
      if (m.k === 'swing') { e.fig.reach(); sfx.swing(pos); }
      if (m.k === 'bonk') {
        const tg = ent(m.tg); if (tg) { tg.fig.caught(); sfx.bonk([tg.x, tg.y + 1, tg.z]); world.puff({ x: tg.x, y: tg.y + 1.6, z: tg.z }, 0xffe07a, 10, 3); }
        if (m.tg === myId) center('BONK!', 900, '#ffb08a', `${e.name} bonked you — you dropped something!`);
        else if (m.id === myId && tg) pop(`BONK! ${tg.name} dropped something`, '#ffb08a');
      }
      break;
    }
    case 'board': for (const r of m.rows) { const e = ent(r[0]); if (e) { e.money = r[1]; e.tier = r[2]; e.faints = r[3]; e.hp = r[4]; } } break;
    case 'end': showEnd(m); break;
    case 'stars': showStars(m); break;
  }
}
const stormEmoji = () => ({ 0: '🌨', 1: '🌪', 2: '⛈', 3: '🪨' }[G?.mapId] || '🌩');

// ------------------------------------------------------------------ input
const keys = new Set(); let locked = false, macLocked = false, chatting = false, mouseHeld = false;
const look = { dx: 0, dy: 0 };
const typing = e => e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range' || e.target.tagName === 'SELECT';
addEventListener('keydown', e => {
  if (chatting) { if (e.key === 'Escape') closeChat(); return; }
  if (typing(e)) { if (e.key === 'Escape') e.target.blur(); return; }
  if (G && ['Tab', ' ', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
  keys.add(e.code);
  if (!G) return;
  if (e.code === 'KeyM') { setMusic(!audioState().music); drawAudioBtns(); toast(audioState().music ? 'Music on' : 'Music off', 900); }
  if (G.mapId === CAMP) {
    if (e.code === 'Enter' || e.code === 'KeyT') { e.preventDefault(); $('lobbyui').classList.remove('collapsed'); $('lb-msg').focus(); keys.clear(); }
    if (e.code === 'KeyE' && onShopMat() && !shopOpen) { sfx.shopOpen(); openShop(); }
    if (e.code === 'Escape' && shopOpen) closeShop();
    return;
  }
  if (e.repeat) return;
  if (e.code === 'KeyE') { if (tradeOpen) closeTrade(); else useOnce(); }
  if (e.code === 'KeyQ') send({ t: 'eat' });
  if (e.code === 'KeyR') send({ t: 'sip' });
  if (e.code === 'KeyB') tryBuild();
  if (e.code === 'KeyF') doBonk();
  if (e.code === 'KeyT' || e.code === 'Enter') { e.preventDefault(); openChat(); }
  if (e.code === 'Escape') { if (tradeOpen) closeTrade(); else if (macLocked) { unlock(); pause(); } }
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); mouseHeld = false; });
const canvas = $('view');
let drag = null;
canvas.addEventListener('mousedown', e => {
  if (!G) return;
  if (G.mapId === CAMP || shopOpen) { drag = { x: e.clientX, y: e.clientY }; return; }
  if (!locked && !macLocked && !mobile) { askLock(); return; }
  if (e.button === 0) { mouseHeld = true; useOnce(); }
  if (e.button === 2) doBonk();
});
addEventListener('mousemove', e => {
  if (locked) { look.dx += e.movementX; look.dy += e.movementY; }
  else if (drag) { look.dx += (e.clientX - drag.x) * 1.4; look.dy += (e.clientY - drag.y) * 1.4; drag = { x: e.clientX, y: e.clientY }; }
});
addEventListener('mouseup', e => { drag = null; if (e.button === 0) mouseHeld = false; });
canvas.addEventListener('wheel', e => { if (!G) return; prof.zoom = Math.max(2.2, Math.min(12, prof.zoom * (1 + Math.sign(e.deltaY) * 0.1))); store.set('zoom', prof.zoom); }, { passive: true });
addEventListener('contextmenu', e => { if (G) e.preventDefault(); });
window.__look = (dx, dy) => { if (macLocked) { look.dx += dx; look.dy += dy; } };
window.__unlocked = () => { if (macLocked) { macLocked = false; mouseHeld = false; if (G && G.mapId !== CAMP && !tradeOpen && ME.faint <= 0) pause(); } };
window.__mouse = (b, down) => { if (!macLocked) return; if (b === 0) { mouseHeld = down; if (down) useOnce(); } if (b === 2 && down) doBonk(); };
function askLock() {
  if (!G || G.mapId === CAMP || tradeOpen || ME.faint > 0) return;
  if (isMac) { window.webkit.messageHandlers.gp.postMessage('lock'); macLocked = true; $('clickto').classList.add('hidden'); if (screen === 'scr-pause') show(null); return; }
  $('clickto').classList.remove('hidden');
}
$('clickto').onclick = () => { unlockAudio(); if (isMac) return askLock(); canvas.requestPointerLock?.(); };
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { $('clickto').classList.add('hidden'); if (screen === 'scr-pause') show(null); }
  else { mouseHeld = false; if (G && G.mapId !== CAMP && !chatting && !tradeOpen && screen !== 'scr-end' && ME.faint <= 0 && !shopOpen) pause(); }
});
function unlock() { if (document.pointerLockElement) document.exitPointerLock(); if (macLocked) { macLocked = false; window.webkit?.messageHandlers?.gp?.postMessage('unlock'); } }
function pause() { if (!G) return; keys.clear(); show('scr-pause'); $('clickto').classList.add('hidden'); }
$('p-resume').onclick = () => { sfx.click(); show(null); if (isMac) askLock(); else if (!mobile) canvas.requestPointerLock?.(); };
$('p-leave').onclick = () => { sfx.click(); leaveAll(); };
$('sens').value = prof.sens; $('sens').oninput = () => { prof.sens = +$('sens').value; store.set('sens', prof.sens); };
for (const k of ['music', 'sfx', 'amb']) { const el = $('vol-' + k); el.value = audioState().vol[k]; el.oninput = () => { setVolume(k, +el.value); if (k === 'sfx') sfx.click(); }; }
$('invy').checked = prof.invy; $('invy').onchange = () => { prof.invy = $('invy').checked; store.set('invy', prof.invy); };
function openChat() { chatting = true; keys.clear(); mouseHeld = false; $('chatform').classList.remove('hidden'); $('chatin').focus(); }
function closeChat() { chatting = false; $('chatform').classList.add('hidden'); $('chatin').blur(); $('chatin').value = ''; }
$('chatform').onsubmit = e => { e.preventDefault(); const t = $('chatin').value.trim(); if (t) send({ t: 'chat', text: t }); closeChat(); };
const onShopMat = () => G && G.mapId === CAMP && Math.hypot(me.x - G.map.shop.x, me.z - G.map.shop.z) < G.map.shop.r;

// touch controls: stick on the left, drag anywhere else to look, pinch to zoom, buttons on the right
const touch = { mx: 0, mz: 0, mag: 0, jump: false, run: false, board: false, stickId: null, lookId: null, lx: 0, ly: 0, act: false, pinch: null, pts: new Map() };
if (mobile) {
  const stick = $('stick'), knob = $('knob');
  const moveStick = t => {
    const r = stick.getBoundingClientRect(), R = r.width / 2, dx = (t.clientX - r.left - R) / R, dy = (t.clientY - r.top - R) / R, l = Math.min(1, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const k = l < 0.12 ? 0 : l;   // a little dead zone
    touch.mx = Math.cos(a) * k; touch.mz = -Math.sin(a) * k; touch.mag = k;
    knob.style.transform = `translate(${Math.cos(a) * l * R * 0.62}px, ${Math.sin(a) * l * R * 0.62}px)`;
  };
  const stopStick = () => { touch.stickId = null; touch.mx = touch.mz = touch.mag = 0; knob.style.transform = ''; };
  stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; touch.stickId = t.identifier; moveStick(t); }, { passive: false });
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) moveStick(t);
      if (touch.pts.has(t.identifier)) touch.pts.set(t.identifier, [t.clientX, t.clientY]);
      if (t.identifier === touch.lookId && !touch.pinch) { look.dx += (t.clientX - touch.lx) * 2.2; look.dy += (t.clientY - touch.ly) * 2.2; touch.lx = t.clientX; touch.ly = t.clientY; }
    }
    if (touch.pinch) {
      const [a, b] = touch.pinch.ids.map(i => touch.pts.get(i));
      if (a && b) { prof.zoom = Math.max(2.2, Math.min(12, touch.pinch.z * touch.pinch.d / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])))); }
    }
  }, { passive: false });
  const end = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === touch.stickId) stopStick();
      if (t.identifier === touch.lookId) touch.lookId = null;
      touch.pts.delete(t.identifier);
      if (touch.pinch?.ids.includes(t.identifier)) { touch.pinch = null; store.set('zoom', prof.zoom); const rest = [...touch.pts.entries()][0]; if (rest) { touch.lookId = rest[0]; [touch.lx, touch.ly] = rest[1]; } }
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();   // no emulated mouse clicks (a look-tap must never gather or build)
    for (const t of e.changedTouches) {
      touch.pts.set(t.identifier, [t.clientX, t.clientY]);
      if (touch.lookId === null) { touch.lookId = t.identifier; touch.lx = t.clientX; touch.ly = t.clientY; }
      else if (!touch.pinch && touch.pts.size >= 2) { const [a, b] = [...touch.pts.values()]; touch.pinch = { ids: [...touch.pts.keys()].slice(0, 2), d: Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), z: prof.zoom }; }
    }
  }, { passive: false });
  // hold-style buttons react on touchstart (no 300 ms wait) and light up while held
  const tb = (id, down, up) => {
    const el = $(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); el.classList.add('held'); down(); }, { passive: false });
    const off = () => { el.classList.remove('held'); up?.(); };
    el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
  };
  tb('t-jump', () => touch.jump = true, () => touch.jump = false);
  tb('t-act', () => { if (G?.mapId === CAMP) { if (onShopMat() && !shopOpen) { sfx.shopOpen(); openShop(); } return; } touch.act = true; if (tradeOpen) return; useOnce(); }, () => touch.act = false);
  tb('t-eat', () => send({ t: 'eat' })); tb('t-sip', () => send({ t: 'sip' })); tb('t-bonk', () => doBonk());
  tb('t-build', () => { if (G && G.mapId !== CAMP && G.state === 'play' && ME.faint <= 0) tryBuild(); });
  tb('t-run', () => { touch.run = !touch.run; $('t-run').classList.toggle('on', touch.run); });
  // these open things (and may pop the keyboard), so they use a real click
  $('t-board').onclick = () => { touch.board = !touch.board; $('t-board').classList.toggle('on', touch.board); };
  $('t-chat').onclick = () => { if (!G) return; if (G.mapId === CAMP) { $('lobbyui').classList.remove('collapsed'); $('lb-msg').focus(); } else if (chatting) closeChat(); else openChat(); };
  $('t-menu').onclick = () => { if (G?.mapId === CAMP) $('lobbyui').classList.toggle('collapsed'); else pause(); };
  $('chatin').addEventListener('blur', () => { if (chatting) setTimeout(() => { if (chatting && document.activeElement !== $('chatin')) closeChat(); }, 50); scrollTo(0, 0); });
  $('lb-msg').addEventListener('blur', () => scrollTo(0, 0));
}

// ------------------------------------------------------------------ using things: gather, drink, trade, open, build, bonk
/** what's right in front of you that E (or holding the mouse) would use */
function target() {
  if (!G || G.mapId === CAMP || G.state !== 'play' || ME.faint > 0) return null;
  const map = G.map;
  for (const v of world.crates.values()) if (v.fall === 0 && Math.hypot(v.c.x - me.x, v.c.z - me.z) < 2.6) return { k: 'crate', id: v.c.id, x: v.c.x, z: v.c.z };
  let best = null, bs = 1e9;
  const fx = -Math.sin(me.camYaw), fz = -Math.cos(me.camYaw);
  map.nodes.forEach((n, i) => {
    if ((world.nodeViews[i]?.amt ?? 1) <= 0) return;
    const dx = n.x - me.x, dz = n.z - me.z, d = Math.hypot(dx, dz), R = { tree: 0.4, rock: 1.1, gold: 0.9, food: 0.6 }[n.type] * n.s;
    if (d > S.REACH + R + 0.2 || Math.abs(n.y - me.y) > 2.5) return;
    const facing = (dx * fx + dz * fz) / (d || 1);
    const sc = d - R - facing * 1.2;
    if (sc < bs) { bs = sc; best = { k: 'node', id: i, n, x: n.x, z: n.z }; }
  });
  if (best) return best;
  if (map.lakes.some(l => Math.hypot(me.x - l.x, me.z - l.z) < l.r + 2.2) && (ME.water < 99 || ME.can < ME.canCap)) return { k: 'drink' };
  const q = map.post; if (q && Math.hypot(me.x - q.x, me.z - (q.z - 1.9)) < 5.3) return { k: 'trade' };
  return null;
}
const atMyPlot = () => { const pl = G?.map.plots?.[ent(myId)?.plot]; return pl && Math.hypot(me.x - pl.x, me.z - pl.z) < pl.r + 2.3 ? pl : null; };
let useT = 0;
function useOnce() {
  const tg = target(); if (!tg) { if (atMyPlot() && G.state === 'play') tryBuild(); return; }
  if (tg.k === 'crate') send({ t: 'open', id: tg.id });
  else if (tg.k === 'trade') openTrade();
  else useHeld(tg, true);
}
function useHeld(tg, now = false) {
  const t = performance.now();
  if (!now && t - useT < 120) return; useT = t;
  if (tg.k === 'node') {
    me.yaw = Math.atan2(-(tg.x - me.x), -(tg.z - me.z));
    const fig = ent(myId)?.fig; if (fig) { fig.setTool(tg.n.type === 'tree' ? 'axe' : tg.n.type === 'food' ? null : 'pick'); ent(myId).toolT = 1.2; }
    send({ t: 'gather', id: tg.id });
  } else if (tg.k === 'drink') send({ t: 'drink' });
}
function tryBuild() {
  const pl = atMyPlot();
  if (!pl) { toast('Go to your plot (the flag in your colour — look for 🏠 on the minimap) to build'); sfx.nope(); return; }
  if (ME.tier >= 5) { toast('Your shelter is already the best there is!'); return; }
  const c = TIERS[ME.tier + 1].cost;
  if ((c.wood || 0) > ME.inv.wood || (c.stone || 0) > ME.inv.stone || (c.coins || 0) > ME.coins) { sfx.nope(); toast(`You need ${costText(c, true)}`); return; }
  send({ t: 'build' });
}
function costText(c, missingOnly = false) {
  const parts = [];
  for (const k of ['wood', 'stone']) if (c[k] && (!missingOnly || ME.inv[k] < c[k])) parts.push(`<span class="${ME.inv[k] >= c[k] ? 'ok' : 'no'}">${missingOnly ? c[k] - ME.inv[k] + ' more' : `${ME.inv[k]}/${c[k]}`} ${resEmoji(k)} ${labelOf(k)}</span>`);
  if (c.coins && (!missingOnly || ME.coins < c.coins)) parts.push(`<span class="${ME.coins >= c.coins ? 'ok' : 'no'}">${missingOnly ? '$' + (c.coins - ME.coins) + ' more' : `$${ME.coins}/$${c.coins}`}</span>`);
  return missingOnly ? parts.join(', ').replace(/<[^>]+>/g, '') : parts.join(' · ');
}
function doBonk() {
  if (!G || G.mapId === CAMP || G.state !== 'play' || ME.faint > 0) return;
  if (!G.settings.bonk) { toast('Bonking is off in this game'); return; }
  const t = performance.now(); if (t - (doBonk.last || 0) < 1600) return; doBonk.last = t;
  // face the nearest googly in front of the camera
  let best = null, bd = 2.8;
  for (const e of G.ents.values()) { if (e.id === myId) continue; const d = Math.hypot(e.x - me.x, e.z - me.z); if (d < bd) { bd = d; best = e; } }
  if (best) me.yaw = Math.atan2(-(best.x - me.x), -(best.z - me.z));
  send({ t: 'st', w: G.mapId, x: me.x, y: me.y, z: me.z, vx: me.vx, vz: me.vz, yaw: me.yaw, g: me.onGround ? 1 : 0 });
  send({ t: 'bonk' });
}

// ------------------------------------------------------------------ the trading post
let tradeOpen = false;
function openTrade() { tradeOpen = true; $('trade').classList.remove('hidden'); unlock(); keys.clear(); mouseHeld = false; drawTrade(); sfx.shopOpen(); }
function closeTrade() { if (!tradeOpen) return; tradeOpen = false; sfx.panel(false); $('trade').classList.add('hidden'); if (G && G.mapId !== CAMP && !mobile && !Q.has('bot')) { if (isMac) askLock(); else canvas.requestPointerLock?.(); } }
$('tr-close').onclick = () => { sfx.click(); closeTrade(); };
function drawTrade() {
  if (!G) return;
  $('tr-coins').textContent = ME.coins;
  const best = RESOURCES.slice().sort((a, b) => G.market[b] / BASE_PRICE[b] - G.market[a] / BASE_PRICE[a])[0];
  $('tr-day').textContent = `Day ${G.day}: ${labelOf(best)} is selling for $${G.market[best]} today — ${G.market[best] > BASE_PRICE[best] ? 'a great price!' : 'not bad.'}`;
  $('tr-sell').innerHTML = RESOURCES.map(k => {
    const p = G.market[k], dir = p > BASE_PRICE[k] ? 'up' : p < BASE_PRICE[k] ? 'down' : '';
    return `<div class="trow"><span>${resEmoji(k)}</span><span class="nm">${labelOf(k)}<small>you have ${ME.inv[k]}</small></span><span class="pr ${dir}">$${p}${dir === 'up' ? ' ▲' : dir === 'down' ? ' ▼' : ''}</span><button class="green" data-s="${k}" data-n="1" ${ME.inv[k] ? '' : 'disabled'}>Sell 1</button><button class="gold" data-s="${k}" data-n="all" ${ME.inv[k] ? '' : 'disabled'}>Sell all</button></div>`;
  }).join('');
  $('tr-buy').innerHTML = SHOP.map(it => {
    const own = it.tool && ME.tools.includes(it.id);
    return `<div class="trow ${own ? 'owned' : ''}"><span>${it.emoji}</span><span class="nm">${it.name}<small>${it.desc}</small></span><span class="pr">$${it.price}</span><button class="blue" data-b="${it.id}" ${own || ME.coins < it.price ? 'disabled' : ''}>${own ? 'OWNED' : 'Buy'}</button></div>`;
  }).join('');
  $('tr-sell').querySelectorAll('button').forEach(b => b.onclick = () => send({ t: 'sell', item: b.dataset.s, n: b.dataset.n === 'all' ? 'all' : 1 }));
  $('tr-buy').querySelectorAll('button').forEach(b => b.onclick = () => send({ t: 'buy', item: b.dataset.b }));
}

// ------------------------------------------------------------------ your googly
const V = new THREE.Vector3(), V2 = new THREE.Vector3();
const camPos = new THREE.Vector3();
function localInput() {
  const k = c => keys.has(c);
  if (Q.has('bot')) return botInput();
  let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0) + touch.mx;
  let mz = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0) + touch.mz;
  if (shopOpen || screen === 'scr-pause' || ME.faint > 0) mx = mz = 0;
  return { mx, mz, jump: k('Space') || touch.jump, sprint: k('ShiftLeft') || k('ShiftRight') || touch.run || touch.mag > 0.9 };
}
const botS = { t: 0, mx: 0, mz: 1 };
function botInput() { botS.t -= 1 / 60; if (botS.t <= 0) { botS.t = 1 + Math.random() * 2; botS.mx = Math.random() * 2 - 1; me.camYaw += (Math.random() - 0.5) * 2; } return { mx: botS.mx * 0.4, mz: 1, jump: Math.random() < 0.01, sprint: true }; }

function updateLocal(dt) {
  const inp = localInput();
  const sens = 0.0024 * prof.sens;
  me.camYaw -= look.dx * sens; me.camPitch -= look.dy * sens * (prof.invy ? -1 : 1); look.dx = look.dy = 0;
  me.camPitch = Math.max(-1.3, Math.min(0.75, me.camPitch));
  const s = Math.sin(me.camYaw), c = Math.cos(me.camYaw);
  let dx = inp.mx * c - inp.mz * s, dz = -inp.mx * s - inp.mz * c;
  if (ME.faint > 0 || tradeOpen && false) dx = dz = 0;
  const n = Math.ceil(dt / (1 / 90));
  for (let i = 0; i < n; i++) S.stepPlayer(me, { dx, dz, jump: inp.jump && i === 0 && ME.faint <= 0, sprint: inp.sprint }, dt / n, G.map);
  if (me.jumped) { me.jumped = false; sfx.jump(null, myId); }
  if (me.bounced) { me.bounced = false; sfx.boing(null); }
  if (me.landed) { sfx.land(Math.min(1, me.landed / 14)); me.landed = 0; }
  const moving = Math.hypot(dx, dz) > 0.1;
  if (moving) me.yaw += (((Math.atan2(-dx, -dz) - me.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-12 * dt));
  // holding E / the mouse keeps gathering (or drinking)
  if ((keys.has('KeyE') || mouseHeld || touch.act) && G.mapId !== CAMP && !tradeOpen && !chatting) { const tg = target(); if (tg && (tg.k === 'node' || tg.k === 'drink')) useHeld(tg); }
  if (tradeOpen && G.map.post && Math.hypot(me.x - G.map.post.x, me.z - G.map.post.z + 1.9) > 7) closeTrade();
  G.sendT -= dt;
  if (G.sendT <= 0) { G.sendT = G.mapId === CAMP ? 1 / 15 : 1 / 30; send({ t: 'st', w: G.mapId, x: +me.x.toFixed(3), y: +me.y.toFixed(3), z: +me.z.toFixed(3), vx: +me.vx.toFixed(2), vz: +me.vz.toFixed(2), yaw: +me.yaw.toFixed(3), g: me.onGround ? 1 : 0 }); }
}

// ------------------------------------------------------------------ everyone's googly + pet
function updateEnts(dt) {
  const rt = performance.now() / 1000 - (local ? 0.06 : 0.1);
  for (const e of G.ents.values()) {
    let speed, onGround, faint = false;
    if (e.id === myId) {
      e.x = me.x; e.y = me.y; e.z = me.z; e.yaw = me.yaw;
      speed = Math.hypot(me.vx, me.vz); onGround = me.onGround; faint = ME.faint > 0;
      e.fig.root.visible = camPos.distanceTo(V.set(me.x, me.y + 1.1, me.z)) > 0.9;
    } else {
      const b = e.buf;
      if (b.length) {
        let i = b.length - 1; while (i > 0 && b[i - 1].t > rt) i--;
        const B = b[i], A = b[Math.max(0, i - 1)];
        const k = B.t === A.t ? 1 : Math.max(0, Math.min(1.2, (rt - A.t) / (B.t - A.t)));
        e.x = A.x + (B.x - A.x) * k; e.y = A.y + (B.y - A.y) * k; e.z = A.z + (B.z - A.z) * k;
        e.yaw = A.yaw + (((B.yaw - A.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, k);
        e.flags = B.flags; e.vx = B.vx; e.vz = B.vz;
      }
      speed = Math.hypot(e.vx, e.vz); onGround = !!(e.flags & 2); faint = !!(e.flags & 4);
      if (e.flags & 8 && !e.swung) { e.fig.reach(); e.swung = true; } if (!(e.flags & 8)) e.swung = false;
    }
    if (e.toolT > 0) { e.toolT -= dt; if (e.toolT <= 0) e.fig.setTool(null); }
    const f = e.fig;
    f.group.position.set(e.x, e.y, e.z); f.group.rotation.y = e.yaw + Math.PI;
    let pose = faint ? 'faint' : 'idle';
    if (G.state === 'end' && G.winner) pose = G.winner === e.id ? 'cheer' : 'sad';
    f.update(dt, { speed: faint ? 0 : speed, onGround, pose });
    if (e.pet) e.pet.update(dt, e.x, e.y, e.z, e.yaw, speed, faint);
  }
  // see inside your own shelter
  const mine = ent(myId);
  if (mine && mine.plot >= 0 && G.mapId !== CAMP) { const pl = G.map.plots[mine.plot]; world.setInside(mine.plot, Math.hypot(me.x - pl.x, me.z - pl.z) < 4.2 || Math.hypot(camPos.x - pl.x, camPos.z - pl.z) < 4); }
}

// ------------------------------------------------------------------ camera
function updateCamera(dt) {
  const cam = world.camera;
  if (Q.has('cam')) { const v = Q.get('cam').split(',').map(Number); cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]); cam.fov = +(Q.get('fov') || 60); cam.updateProjectionMatrix(); camPos.copy(cam.position); setListener(camPos.x, camPos.y, camPos.z, 0); return; }
  if (shopOpen) {
    const fwd = V2.set(-Math.sin(me.yaw), 0, -Math.cos(me.yaw)), right = V.set(Math.cos(me.yaw), 0, -Math.sin(me.yaw));
    const want = new THREE.Vector3(me.x, me.y + 1.35, me.z).addScaledVector(fwd, 3.1).addScaledVector(right, innerWidth > 900 ? -1.3 : 0);
    camPos.lerp(want, 1 - Math.exp(-6 * dt)); cam.position.copy(camPos);
    cam.lookAt(me.x - right.x * (innerWidth > 900 ? 1.0 : 0), me.y + 0.95, me.z - right.z * (innerWidth > 900 ? 1.0 : 0));
    cam.fov = 50; cam.updateProjectionMatrix(); setListener(camPos.x, camPos.y, camPos.z, me.yaw); return;
  }
  const lobby = G.mapId === CAMP;
  const pivot = V.set(me.x, me.y + 1.5, me.z);
  const dist = lobby ? Math.max(5, prof.zoom + 1) : prof.zoom;
  const cp = Math.cos(me.camPitch), fwd = V2.set(-Math.sin(me.camYaw) * cp, Math.sin(me.camPitch), -Math.cos(me.camYaw) * cp);
  const want = pivot.clone().addScaledVector(fwd, -dist);
  const hit = S.segMap(G.map, pivot.x, pivot.y, pivot.z, want.x, want.y, want.z);
  const pos = hit ? pivot.clone().lerp(want, Math.max(0, hit.t - 0.1 / dist)) : want;
  pos.y = Math.max(pos.y, G.map.h(pos.x, pos.z) + 0.35);
  camPos.copy(pos);
  cam.position.copy(camPos);
  cam.lookAt(pivot.clone().addScaledVector(fwd, 4));
  cam.fov += ((mobile ? 72 : 66) - cam.fov) * (1 - Math.exp(-10 * dt)); cam.updateProjectionMatrix();
  setListener(camPos.x, camPos.y, camPos.z, me.camYaw);
}

// ------------------------------------------------------------------ minimap
function buildMinimap() {
  const map = G.map, N = 180, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), sc = map.W / N;
  const pal = { snow: [[236, 242, 248], [150, 160, 172]], sand: [[232, 200, 140], [176, 120, 74]], grass: [[90, 150, 60], [120, 120, 110]], alpine: [[100, 150, 70], [130, 128, 124]] }[map.ground];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -map.W / 2 + (i + 0.5) * sc, z = -map.D / 2 + (j + 0.5) * sc, h = map.h(x, z), sl = map.slope(x, z);
    let [r, gg, b] = pal[0]; const k = Math.min(1, Math.max(0, (sl - 0.35) * 1.5));
    r += (pal[1][0] - r) * k; gg += (pal[1][1] - gg) * k; b += (pal[1][2] - b) * k;
    if (map.ground === 'alpine' && h > 9.5) { r = gg = b = 240; }
    const shade = 0.85 + Math.max(-0.2, Math.min(0.25, (map.h(x - 1, z - 1) - h) * 0.3));
    const wet = map.wetAt(x, z);
    const o = (j * N + i) * 4;
    if (wet) { img.data[o] = map.water.ice ? 190 : 50; img.data[o + 1] = map.water.ice ? 225 : 130; img.data[o + 2] = map.water.ice ? 245 : 190; }
    else { img.data[o] = r * shade; img.data[o + 1] = gg * shade; img.data[o + 2] = b * shade; }
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // trees as little dots
  for (const n of map.nodes) { const px = (n.x + map.W / 2) / sc, pz = (n.z + map.D / 2) / sc; g.fillStyle = n.type === 'tree' ? '#1e4a1e' : n.type === 'gold' ? '#ffc83a' : n.type === 'rock' ? '#6a6a6a' : '#d8304a'; g.fillRect(px - 1, pz - 1, n.type === 'tree' ? 2 : 2, 2); }
  G.mm = c;
}
function drawMinimap() {
  const cv = $('mm'), g = cv.getContext('2d'), map = G.map, N = 180, sc = N / map.W;
  if (!G.mm) return;
  g.drawImage(G.mm, 0, 0);
  const P = (x, z) => [(x + map.W / 2) * sc, (z + map.D / 2) * sc];
  // trading post
  const [qx, qz] = P(map.post.x, map.post.z); g.font = '14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💰', qx, qz);
  // plots
  for (const e of G.ents.values()) { if (e.plot < 0) continue; const pl = map.plots[e.plot], [x, z] = P(pl.x, pl.z); g.fillStyle = e.color; g.beginPath(); g.arc(x, z, 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = e.id === myId ? 2.5 : 1; g.stroke(); g.font = '10px sans-serif'; g.fillText('🏠', x, z + 0.5); }
  for (const v of world.crates.values()) { const [x, z] = P(v.c.x, v.c.z); g.fillStyle = '#ffd23a'; g.fillRect(x - 4, z - 4, 8, 8); g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(x - 4, z - 4, 8, 8); }
  for (const e of G.ents.values()) {
    if (e.id === myId) continue;
    const [x, z] = P(e.x, e.z); g.fillStyle = e.color; g.beginPath(); g.arc(x, z, 3.5, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
  }
  // you: an arrow
  const [x, z] = P(me.x, me.z);
  g.save(); g.translate(x, z); g.rotate(-me.camYaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2); g.lineTo(-5, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
}

// ------------------------------------------------------------------ HUD
function nightK(t) { const d = (t % DAY_LEN) / DAY_LEN, n0 = 1 - NIGHT_FRAC; if (d < 0.05) return 1 - d / 0.05; if (d > n0 - 0.05 && d < n0 + 0.03) return (d - (n0 - 0.05)) / 0.08; return d >= n0 ? 1 : 0; }
function drawTools() {
  const tl = { axe: '🪓', pick: '⛏️', coat: '🧥', hat: '👒', pack: '🎒', canteen: '🫗' };
  $('tools').innerHTML = ME.tools.map(t => `<span title="${t}">${tl[t] || ''}</span>`).join('');
  const e = ent(myId); if (e) { e.fig.setGear(ME.tools); }
}
function setText(el, t) { if (el.textContent !== t) el.textContent = t; }
function setBar(id, v, low) { const el = $(id); el.querySelector('i').style.width = Math.max(0, Math.min(100, v)) + '%'; el.querySelector('b').textContent = Math.round(v); el.classList.toggle('low', low); }
function updateHUD(dt) {
  const lobby = G.mapId === CAMP;
  if (lobby) {
    const mat = onShopMat() && !shopOpen;
    $('prompt').innerHTML = mat ? (mobile ? 'Tap <span class="k">SHOP</span> to open the shop' : 'Press <span class="k">E</span> to open the SHOP') : '';
    if (mobile) { $('hud').classList.toggle('shopmat', mat); setText($('t-act'), 'SHOP'); }
    return;
  }
  const t = G.clock, days = G.days, dayT = t % DAY_LEN, n0 = DAY_LEN * (1 - NIGHT_FRAC), night = dayT >= n0;
  const left = Math.max(0, Math.ceil((night ? DAY_LEN : n0) - dayT));
  const day = Math.min(days, Math.floor(t / DAY_LEN) + 1);
  $('dayname').textContent = G.state === 'end' ? 'GAME OVER' : day === days ? `FINAL DAY (${day} of ${days})` : `DAY ${day} of ${days}`;
  $('clock').textContent = `${night ? '🌙' : '☀️'} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('clock').title = night ? 'until morning' : 'until night';
  $('daybar').querySelector('i').style.left = (dayT / DAY_LEN * 100) + '%';
  // day/night changes
  const part = night ? 'night' : 'day';
  if (G.lastDayPart && part !== G.lastDayPart && part === 'night') { sfx.dusk(); feed('🌙 Night is falling — it gets cold!'); if (G.mapId !== 1) setTimeout(() => G && sfx.howl(), 3000); }
  G.lastDayPart = part;
  const nk = nightK(t);
  world.setTime(t, nk);
  const stormOn = G.storm?.k === 'on';
  music.play(stormOn ? 'storm' : nk > 0.7 ? 'night' : BIOME_LIST[G.mapId].key);
  // storm banner
  if (G.storm) {
    const s = Math.max(0, Math.ceil(G.storm.until - t));
    $('storm').classList.remove('hidden');
    $('storm').textContent = G.storm.k === 'warn' ? `${stormEmoji()} ${G.storm.name} in ${s}s — get to shelter!` : `${stormEmoji()} ${G.storm.name}! ${s}s left${ME.shelter >= 0.6 ? ' · you are safe inside' : ''}`;
    if (G.storm.k === 'warn' && s <= 0) G.storm.k = 'on';
  } else $('storm').classList.add('hidden');
  // money, bars, backpack
  $('h-coins').textContent = ME.coins;
  setBar('b-hp', ME.hp, ME.hp < 30); setBar('b-food', ME.food, ME.food < 25); setBar('b-water', ME.water, ME.water < 25);
  const tb = $('b-temp'); tb.querySelector('em').style.left = Math.max(0, Math.min(100, ME.temp)) + '%'; tb.querySelector('b').textContent = ME.temp < 30 ? 'COLD' : ME.temp > 70 ? 'HOT' : 'OK'; tb.classList.toggle('low', ME.temp < 25 || ME.temp > 75);
  tb.querySelector('b').style.color = ME.temp < 30 ? '#8ad8ff' : ME.temp > 70 ? '#ffa07a' : '#7dff9a';
  const load = RESOURCES.reduce((a, k) => a + ME.inv[k], 0);
  $('pack').innerHTML = RESOURCES.map(k => `<div class="it"><b>${resEmoji(k)} ${ME.inv[k]}</b><small>${labelOf(k).toUpperCase()}</small></div>`).join('') + `<div class="it"><b>💧 ${ME.can}/${ME.canCap}</b><small>CANTEEN</small></div><div class="cap ${load >= ME.cap ? 'full' : ''}">🎒 ${load}/${ME.cap}</div>`;
  // the leaderboard
  const rows = [...G.ents.values()].sort((a, b) => (b.money + TIERS.slice(1, b.tier + 1).length * 0 + tierWorth(b.tier)) - (a.money + tierWorth(a.tier)));
  $('lead').innerHTML = `<div class="lh">MONEY · SHELTER</div>` + rows.map(e => `<div class="lr ${e.id === myId ? 'me' : ''} ${e.flags & 4 ? 'fainted' : ''}"><span class="dot" style="background:${esc(e.color)}"></span>${esc(e.name)}<span class="ti">${'🏠'.repeat(Math.min(1, e.tier))}${e.tier ? e.tier : ''}</span><b>$${e.money}</b></div>`).join('');
  drawMinimap();
  // danger vignette
  G.hurtT = Math.max(0, (G.hurtT || 0) - dt);
  let vc = null, va = 0;
  if (ME.temp < 30) { vc = '#4ab0ff'; va = (30 - ME.temp) / 30; }
  if (ME.temp > 70) { vc = '#ff8a2a'; va = (ME.temp - 70) / 30; }
  if (ME.hp < 35) { vc = '#ff1a3a'; va = Math.max(va, (35 - ME.hp) / 35); }
  if (G.hurtT > 0) { vc = '#ff1a3a'; va = Math.max(va, G.hurtT); }
  if (vc) $('vign').style.setProperty('--vc', vc);
  $('vign').style.opacity = Math.min(0.85, va) * (0.75 + Math.sin(performance.now() / 300) * 0.15);
  // your body complains: tummy rumbles, teeth chatter, panting, a dry cough
  if (ME.faint <= 0) {
    G.bodyT = (G.bodyT ?? 4) - dt;
    if (G.bodyT <= 0) {
      G.bodyT = 6 + Math.random() * 5;
      if (ME.temp < 26) sfx.chatter(); else if (ME.temp > 74) sfx.pant(); else if (ME.food < 22) sfx.growl(); else if (ME.water < 18) sfx.cough(); else G.bodyT = 2;
    }
    if (G.coldBefore && ME.temp >= 40 && (ME.shelter > 0 || nearFireLocal())) { sfx.ahh(); G.coldBefore = false; }
    if (ME.temp < 30) G.coldBefore = true;
  }
  if (ME.hp < 30 && ME.faint <= 0) { G.alarmT = (G.alarmT || 0) - dt; if (G.alarmT <= 0) { G.alarmT = 1.2; sfx.heartbeat(0.7); } }
  // what can I do here?
  let pr = '';
  const tg = target(), pl = atMyPlot();
  if (ME.faint > 0) pr = '';
  else if (tg?.k === 'crate') pr = `<span class="k">${kk('E')}</span> open the <b>SUPPLY CRATE</b>`;
  else if (tg?.k === 'node') {
    const n = tg.n, verb = n.type === 'tree' ? 'chop' : n.type === 'food' ? (n.v === 'fish' ? 'fish' : 'pick') : 'mine', what = n.type === 'tree' ? labelOf('wood') : n.type === 'rock' ? labelOf('stone') : n.type === 'gold' ? 'Gold' : labelOf('food');
    const tool = n.type === 'tree' ? 'axe' : n.type === 'food' ? null : 'pick';
    pr = `Hold <span class="k">${kk('E')}</span> to ${verb} <b>${what}</b>` + (tool && !ME.tools.includes(tool) ? `<small>a ${tool === 'axe' ? 'steel axe' : 'pickaxe'} from the trading post makes this twice as fast</small>` : '');
  } else if (tg?.k === 'drink') pr = `Hold <span class="k">${kk('E')}</span> to <b>drink</b> and fill your canteen`;
  else if (tg?.k === 'trade') pr = `<span class="k">${kk('E')}</span> <b>TRADING POST</b><small>sell what you gathered · buy tools</small>`;
  if (pl && G.state === 'play' && ME.faint <= 0 && !tradeOpen) {
    const next = ME.tier + 1;
    const bl = next <= 5 ? `<span class="k">${kk('B')}</span> build a <b>${TIER_NAMES[G.mapId][next]}</b><small class="cost">${costText(TIERS[next].cost)}</small>` : `<b>${TIER_NAMES[G.mapId][ME.tier]}</b> — the best shelter there is!`;
    pr = pr ? pr + '<br>' + bl : bl;
  }
  $('prompt').innerHTML = tradeOpen ? '' : pr;
  if (mobile) {
    const lab = ME.faint > 0 ? 'USE' : tg?.k === 'node' ? ({ tree: 'CHOP', rock: 'MINE', gold: 'MINE' }[tg.n.type] || (tg.n.v === 'fish' ? 'FISH' : 'PICK')) : tg?.k === 'drink' ? 'DRINK' : tg?.k === 'trade' ? 'TRADE' : tg?.k === 'crate' ? 'OPEN' : 'USE';
    setText($('t-act'), lab); $('t-build').classList.toggle('ready', !!pl && ME.tier < 5);
  }
  // survival tips
  let hint = '';
  if (ME.faint > 0) { $('faint-t').textContent = `Waking up at ${ME.tier ? 'your shelter' : 'your plot'} in ${Math.ceil(ME.faint)}…`; }
  else if (ME.water < 30) hint = ME.can > 0 ? `💧 Thirsty! Press ${kk('R')} to sip from your canteen` : `💧 Thirsty! Find a lake and hold ${kk('E')} to drink`;
  else if (ME.food < 30) hint = ME.inv.food > 0 ? `🍗 Hungry! Press ${kk('Q')} to eat` : `🍗 Hungry! Gather ${labelOf('food')} or buy a ration at the trading post`;
  else if (ME.temp < 30) hint = '🥶 Freezing! Get into your shelter or next to a campfire' + (ME.tools.includes('coat') ? '' : ' — a warm coat helps');
  else if (ME.temp > 70) hint = '🥵 Too hot! Get into the shade of your shelter, or drink lots' + (ME.tools.includes('hat') ? '' : ' — a sun hat helps');
  else if (load >= ME.cap) hint = '🎒 Your pack is full — sell things at the trading post, or build!';
  else if (ME.tier === 0 && ME.inv.wood >= 6) hint = `🏠 You have enough wood for a shelter — go to your flag and press ${kk('B')}`;
  $('hint').textContent = hint;
  $('keys').textContent = 'WASD move · Mouse look · E/hold click use · Q eat · R sip · B build · F bonk · Tab scores · T chat · Esc menu';
  // scoreboard
  const showBoard = keys.has('Tab') || touch.board;
  $('board').classList.toggle('hidden', !showBoard);
  if (showBoard) $('board').innerHTML = `<table><tr><th>GOOGLY</th><th class="r">MONEY</th><th>SHELTER</th><th class="r">FAINTS</th><th class="r">❤️</th></tr>${rows.map(e => `<tr class="${e.id === myId ? 'me' : ''}"><td><span class="dot" style="background:${esc(e.color)}"></span> ${esc(e.name)}${e.bot ? ' <small>(CPU)</small>' : ''}</td><td class="r">$${e.money}</td><td>${TIER_NAMES[G.mapId][e.tier]}</td><td class="r">${e.faints}</td><td class="r">${e.hp}</td></tr>`).join('')}</table><p class="tiny">${BIOME_LIST[G.mapId].name} · ${local ? 'solo game' : 'lobby ' + esc(room?.code || '')} · money counts what you carry at today's prices</p>`;
}
function tierWorth(t) { let v = 0; for (let i = 1; i <= t; i++) { const c = TIERS[i].cost; v += (c.wood || 0) * 3 + (c.stone || 0) * 4 + (c.coins || 0); } return v; }

// ------------------------------------------------------------------ end of the game
function showEnd(m) {
  G.state = 'end';
  unlock(); closeTrade();
  if (local) { store.del('solo'); drawContinue(); }
  const win = m.rows[0], iWon = win.id === myId;
  G.winner = win.id;
  $('end-title').innerHTML = iWon ? '🏆 YOU WIN!' : `🏆 ${esc(win.name)} WINS!`;
  $('end-sub').textContent = `${BIOME_LIST[m.map].emoji} ${BIOME_LIST[m.map].name} · ${G.days} days survived · money + shelter − fainting`;
  $('end-awards').innerHTML = m.awards.map(a => { const e = m.rows.find(r => r.id === a.id); return `<div class="award"><span class="em">${a.emoji}</span>${a.title}<small><span style="color:${esc(e?.color || '#fff')}">${esc(e?.name || '')}</span> · ${esc(a.val)}</small></div>`; }).join('');
  $('end-list').innerHTML = `<div class="stand head"><span>#</span><span>GOOGLY</span><span class="r">MONEY</span><span>SHELTER</span><span class="r">😵</span><span class="r">TOTAL</span></div>` + m.rows.map((r, i) => `<div class="stand ${i === 0 ? 'first' : ''} ${r.id === myId ? 'me' : ''}"><span>${['🥇', '🥈', '🥉', '4'][i]}</span><span class="n"><span class="dot" style="background:${esc(r.color)}"></span>${esc(r.name)}${r.bot ? ' <small>(CPU)</small>' : ''}${r.id === myId ? ' <small>(you)</small>' : ''}</span><span class="r money">$${r.money}</span><span class="home">${TIER_NAMES[m.map][r.tier]} <small>($${r.shelter})</small></span><span class="r">${r.faints}</span><span class="r"><b>${r.total}</b></span></div>`).join('');
  $('end-stars').classList.add('hidden');
  $('end-again').classList.toggle('hidden', !(local || amHost()));
  $('end-lobby').classList.toggle('hidden', !!local || !amHost());
  if (iWon) { sfx.win(); world.confetti({ x: me.x, y: me.y + 2, z: me.z }, 80); } else sfx.lose();
  music.play('end');
  show('scr-end');
  clearInterval(showEnd.iv);
  if (!local) { let n = 16; $('end-t').textContent = `Back to Base Camp in ${n}…`; showEnd.iv = setInterval(() => { n--; $('end-t').textContent = n > 0 ? `Back to Base Camp in ${n}…` : 'Back to Base Camp…'; if (n <= 0 || !G) clearInterval(showEnd.iv); }, 1000); }
  else $('end-t').textContent = '';
}
function showStars(m) {
  addStars(m.total);
  const el = $('end-stars'); el.classList.remove('hidden');
  el.innerHTML = `<span class="coins"><i class="star"></i>+${m.total} stars</span><br><ul>${m.items.map(([k, v]) => `<li><span>${esc(k)}</span><b>+${v}</b></li>`).join('')}</ul><br><small>You have ${prof.stars} stars · spend them on skins and pets in the SHOP</small>`;
  setTimeout(() => sfx.coin(Math.ceil(m.total / 20)), 700);
}
$('end-again').onclick = () => { sfx.click(); show(null); send({ t: 'start' }); };
$('end-lobby').onclick = () => { sfx.click(); send({ t: 'lobby' }); };
$('end-leave').onclick = () => { sfx.click(); leaveAll(); };

// ------------------------------------------------------------------ title backdrop: you and three friends round the Base Camp campfire
let preview = null;
function showPreview() {
  world.load(CAMP);
  world.setTime(35, 0);
  const fig = new Googly({ color: prof.color, skin: prof.skin, local: true });
  fig.group.position.set(-0.6, 0, -2.4); world.actors.add(fig.group);
  preview = { fig, pet: null, petKind: null, t: 0, pals: [] };
  setPet(preview, prof.pet);
  [['#2f7bff', -2.7, -0.2, 'coat'], ['#7bd13b', 1.9, -2.2, 'hat'], ['#ff6fb5', -2.4, 2.3, 'pack']].forEach(([c, x, z, gear]) => { const g = new Googly({ color: c, local: true }); g.group.position.set(x, 0, z); g.group.rotation.y = Math.atan2(8.5 - x, 8 - z) * 0.5 + Math.atan2(-x, -z) * 0.5; g.setGear([gear]); world.actors.add(g.group); preview.pals.push(g); });
}
function menuUpdate(dt) {
  if (!preview) return;
  const P = preview; P.t += dt;
  const fig = P.fig, cam = world.camera, wide = innerWidth > 900;
  fig.group.rotation.y = Math.atan2(8.5 + 0.6, 8 + 2.4) + Math.sin(P.t * 0.5) * 0.25;
  if (Math.sin(P.t * 0.7) > 0.99 && fig.tauntT <= 0) fig.taunt();
  fig.update(dt, { speed: 0 });
  P.pals.forEach((g, i) => { if (Math.sin(P.t * 0.9 + i * 2) > 0.995) g.reach(); g.update(dt, { speed: 0 }); });
  if (P.pet) P.pet.update(dt, -0.6, 0, -2.4, fig.group.rotation.y - Math.PI, 0, false);
  if (Q.has('cam')) { updateCameraFixed(); return; }
  if (shopOpen) {
    cam.position.set(-0.6 + 2.2, 1.5, -2.4 + 2.4); cam.lookAt(-0.6 + (wide ? -1.1 : 0), 0.95, -2.4 + (wide ? 1.0 : 0)); cam.fov = 48;
  } else {
    const sway = Math.sin(P.t * 0.12) * 0.6;
    cam.position.set(8.5 + sway, 3.2, 8 - sway); cam.lookAt(wide ? -1.5 : 0.5, 1.0, wide ? -1 : 0.5); cam.fov = 50;
  }
  cam.updateProjectionMatrix();
  setListener(cam.position.x, cam.position.y, cam.position.z, 0);
}
function updateCameraFixed() { const v = Q.get('cam').split(',').map(Number), cam = world.camera; cam.position.set(v[0], v[1], v[2]); cam.lookAt(v[3], v[4], v[5]); cam.fov = +(Q.get('fov') || 60); cam.updateProjectionMatrix(); }

// ------------------------------------------------------------------ test hooks (?solo=MAP&clock=S&tier=N&storm=1&shelters=1&trade=1&pos=x,z&fakeend=1)
let hooksDone = false;
function applyTestHooks() {
  if (hooksDone || !local) return; hooksDone = true;
  const R = local.room;
  if (Q.has('clock')) { R.clock = +Q.get('clock'); R.day = Math.floor(R.clock / DAY_LEN); R.newDay(); }
  if (Q.has('shelters')) [...R.players.values()].forEach((p, i) => { p.tier = Math.min(5, (+Q.get('shelters') || 2) + i); p.spent = 0; R.bcast({ t: 'tier', id: p.id, tier: p.tier }); });
  if (Q.has('tier')) { local.p.tier = +Q.get('tier'); R.bcast({ t: 'tier', id: 1, tier: local.p.tier }); }
  if (Q.has('rich')) { Object.assign(local.p.inv, { wood: 20, stone: 8, food: 2, gold: 0 }); local.p.coins = 120; local.p.tools = ['axe', 'coat', 'pack']; }
  if (Q.has('storm')) { R.stormPlan = { warn: R.clock - 1, start: R.clock + 0.5, end: R.clock + 60, warned: true }; }
  if (Q.has('crate')) R.crateT = 0.5;
  if (Q.has('pos')) { const [x, z] = Q.get('pos').split(',').map(Number); local.p.x = me.x = x; local.p.z = me.z = z; local.p.y = me.y = S.groundAt(G.map, x, z, S.PR, 60); }
  if (Q.has('yaw')) me.camYaw = +Q.get('yaw');
  if (Q.has('pitch')) me.camPitch = +Q.get('pitch');
  if (Q.has('trade')) setTimeout(openTrade, 300);
  if (Q.has('hot')) local.p.temp = 22, local.p.water = 20;
  if (Q.has('fakeend')) setTimeout(() => R.endGame(), 600);
}

// ------------------------------------------------------------------ what you can hear around you
function fires() {
  const m = G.map, out = [];
  if (m.post) out.push([m.post.fire.x, m.post.fire.z]);
  if (G.mapId === CAMP) out.push([0, 0]);
  for (const e of G.ents.values()) if (e.tier > 0 && e.plot >= 0) { const pl = m.plots[e.plot]; out.push([pl.x, pl.z]); }
  return out;
}
function nearFireLocal() { return fires().some(([x, z]) => Math.hypot(x - me.x, z - me.z) < 7.5); }
function feedAmbience(dt) {
  const m = G.map;
  const fire = Math.min(99, ...fires().map(([x, z]) => Math.hypot(x - camPos.x, z - camPos.z)));
  const water = Math.min(99, ...m.lakes.map(l => Math.max(0, Math.hypot(camPos.x - l.x, camPos.z - l.z) - l.r)));
  const biome = G.mapId === CAMP ? 'camp' : BIOME_LIST[G.mapId].key;
  ambience.update(dt, { biome, night: G.mapId === CAMP ? 0 : nightK(G.clock), storm: G.storm?.k === 'on' ? 1 : G.storm?.k === 'warn' ? 0.3 : 0, fire, water, inside: ME.tier >= 2 && ME.shelter > 0 && G.mapId !== CAMP });
}

// ------------------------------------------------------------------ main loop
function frame() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  pump();
  if (G) {
    updateLocal(dt);
    updateEnts(dt);
    updateCamera(dt);
    updateHUD(dt);
    feedAmbience(dt);
    world.update(dt, t, V.set(me.x, me.y, me.z));
  } else { menuUpdate(dt); world.update(dt, t, V.set(0, 0, 0)); ambience.update(dt, { biome: 'camp', night: 0, storm: 0, fire: 5, water: 99, inside: false }); }
  world.renderer.render(world.scene, world.camera);
  if (Q.has('dbg')) { const d = $('dbg') || document.body.appendChild(Object.assign(document.createElement('pre'), { id: 'dbg', style: 'position:fixed;left:0;bottom:160px;z-index:99;color:#0f0;background:#000a;font-size:12px' })); d.textContent = JSON.stringify({ myId, map: G?.mapId, state: G?.state, clock: G?.clock?.toFixed(1), me: [me.x, me.y, me.z].map(v => +v.toFixed(2)), ME }); }
  requestAnimationFrame(frame);
}
if (!Q.has('icon') && !Q.has('audiotest')) {
  showPreview(); frame();
  if (pendingRoom) setTimeout(() => { if (prof.name) openOnline(); }, 200);
  if (Q.has('lobby')) { if (!prof.name) { prof.name = 'TESTER'; } openOnline(); }
  if (Q.has('solo')) { if (!prof.name) prof.name = 'TESTER'; startSolo({ map: +Q.get('solo'), diff: +(Q.get('diff') ?? 1), days: +(Q.get('days') ?? 4), storms: Q.get('storms') !== '0', bonk: true }); }
  if (Q.has('shop')) openShop();
  if (Q.has('help')) show('scr-help');
  if (Q.has('soloscreen')) { show('scr-solo'); drawSoloMaps(); }
}
window.__gs = { get G() { return G; }, me, ME, world, send, get room() { return room; }, get local() { return local; }, prof };
if (Q.has('icon')) import('./icon.js').then(m => m.renderIcon());
if (Q.has('audiotest')) import('./sfx.js').then(async m => {
  document.body.innerHTML = '<pre id="at" style="position:fixed;inset:0;margin:0;padding:10px;background:#000;color:#0f0;font:12px monospace;column-count:3;z-index:999"></pre>';
  const pre = document.getElementById('at'), t0 = performance.now();
  const res = await m.audioTest((k, r) => { pre.textContent += `${r.err ? 'ERR ' + r.err : (r.rms < 0.001 ? 'SILENT ' : 'ok ') + 'rms ' + r.rms + ' peak ' + r.peak} ${k}\n`; });
  pre.textContent = `DONE ${Object.keys(res).length} sounds in ${((performance.now() - t0) / 1000).toFixed(1)}s\n` + pre.textContent;
  window.__audio = res; document.title = 'AUDIO DONE';
});
