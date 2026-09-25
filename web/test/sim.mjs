// A whole game with four computer googlies, run as fast as possible. Usage: node test/sim.mjs [map] [diff] [days]
import { Room, TIER_NAMES } from '../public/js/core.js';
import { MAPS } from '../public/js/maps.js';
const map = +(process.argv[2] ?? 2), diff = +(process.argv[3] ?? 1), days = +(process.argv[4] ?? 4);
let ended = null; const log = [];
const R = new Room({ solo: true, settings: { map, diff, days }, out: () => {} });
R.bcast = m => { if (m.t === 'end') ended = m; if (m.t === 'chat' && m.sys) log.push(`[${R.clock.toFixed(0)}s] ${m.text}`); };
R.start();
const dt = 1 / 30; let steps = 0;
const t0 = Date.now();
while (!ended && steps < 30 * 60 * 30) {
  R.tick(dt); steps++;
  if (steps % (30 * 30) === 0) console.log(`t=${R.clock.toFixed(0)} ` + [...R.players.values()].map(p => `${p.name}[hp${p.hp | 0} f${p.food | 0} w${p.water | 0} T${p.temp | 0} $${p.coins} w${p.inv.wood} s${p.inv.stone} g${p.inv.gold} f${p.inv.food} tier${p.tier} ${p.brain.task?.k || '-'}${p.brain.task?.type ? ':' + p.brain.task.type : ''}]`).join(' '));
}
if (process.env.LOG) console.log(log.join('\n'));
console.log(`\n${MAPS[map].name} · diff ${diff} · ${days} days · ${((Date.now() - t0) / 1000).toFixed(1)}s real`);
for (const r of ended.rows) console.log(`${r.name.padEnd(10)} total ${String(r.total).padStart(5)}  money $${r.money}  shelter ${TIER_NAMES[map][r.tier]} ($${r.shelter})  faints ${r.faints}`);
