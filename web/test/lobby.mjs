// Two players online: A makes a private lobby, B joins by code, they chat, walk around Base Camp, A picks a map and starts,
// both land on it with 2 CPUs filling the empty spots, B gathers something, B leaves and a CPU takes over.
import WebSocket from 'ws';
const url = process.env.URL || 'ws://localhost:8131';
const mk = name => new Promise(res => { const ws = new WebSocket(url); ws.log = []; ws.on('message', r => { const m = JSON.parse(r); ws.log.push(m); if (m.t === 'hello') { ws.id = m.id; ws.send(JSON.stringify({ t: 'me', name, color: '#ff9a26', skin: 'none', pet: 'pup' })); res(ws); } }); });
const wait = (ws, f, ms = 5000) => new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { const m = ws.log.find(f); if (m) { clearInterval(iv); res(m); } else if (Date.now() - t0 > ms) { clearInterval(iv); rej(new Error('timeout waiting')); } }, 20); });
const tx = (ws, m) => ws.send(JSON.stringify(m));
const A = await mk('ALICE'), B = await mk('BOB');
tx(A, { t: 'create', public: true });
const code = (await wait(A, m => m.t === 'joined')).code;
tx(B, { t: 'list' }); const list = await wait(B, m => m.t === 'list');
console.log('public list shows', list.rooms.map(r => r.code + ' ' + r.name).join(', '));
tx(B, { t: 'join', code });
const wb = await wait(B, m => m.t === 'world');
console.log('B joined', code, 'map', wb.map, '(4 = Base Camp) players', wb.players.map(p => p.name + (p.bot ? '(cpu)' : '')).join(' '));
tx(B, { t: 'chat', text: 'hi alice!' });
console.log('chat reached A:', (await wait(A, m => m.t === 'chat' && m.text === 'hi alice!')).from);
tx(B, { t: 'st', w: 4, x: 3, y: 0, z: 1, yaw: 0, g: 1 });
await new Promise(r => setTimeout(r, 300));
const snap = [...A.log].reverse().find(m => m.t === 'snap');
console.log('A sees B walking at camp', snap.e.find(e => e[0] === B.id).slice(1, 4));
tx(A, { t: 'set', settings: { map: 2, days: 2 } });
tx(A, { t: 'start' });
const wa2 = await wait(A, m => m.t === 'world' && m.map === 2), wb2 = await wait(B, m => m.t === 'world' && m.map === 2);
console.log('game started for both on map', wa2.map, wb2.map, 'players', wa2.players.map(p => `${p.name}${p.bot ? '(cpu)' : ''}@plot${p.plot}`).join(' '));
const me = wb2.players.find(p => p.id === B.id);
// walk B next to a node and gather
const { MAPS } = await import('../public/js/maps.js');
const n = MAPS[2].nodes.filter(n => n.type === 'tree').sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
for (let k = 1; k <= 12; k++) { const t = Math.min(1, k / 10); tx(B, { t: 'st', w: 2, x: me.x + (n.x + 1 - me.x) * t, y: MAPS[2].h(n.x + 1, n.z), z: me.z + (n.z - me.z) * t, yaw: 0, g: 1 }); await new Promise(r => setTimeout(r, 60)); }
tx(B, { t: 'gather', id: n.id });
const got = await wait(B, m => m.t === 'node' && m.by === B.id);
console.log('B chopped tree', got.id, 'left', got.amt, 'res', got.res);
B.close();
const gone = await wait(A, m => m.t === 'gone' && m.id === B.id);
const cpu = await wait(A, m => m.t === 'join' && m.p.bot && m.p.plot === me.plot);
console.log('B left; a CPU took over plot', cpu.p.plot, 'as', cpu.p.name);
process.exit(0);
