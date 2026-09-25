import { Room } from '../public/js/core.js';
const map = +process.argv[2], diff = +process.argv[3];
let ended = null;
const R = new Room({ solo: true, settings: { map, diff, days: 4 }, out: () => {} });
R.bcast = m => { if (m.t === 'end') ended = m; };
R.start();
const time = {}; const temps = [];
while (!ended) { R.tick(1 / 30); for (const p of R.players.values()) { const k = (p.brain.task?.k || '-') + (p.brain.task?.type ? ':' + p.brain.task.type : ''); time[k] = (time[k] || 0) + 1 / 30 / 4; } const p = [...R.players.values()][0]; if (Math.round(R.clock * 30) % 150 === 0) temps.push(`${R.clock | 0}:${p.temp | 0}/${R.envTemp(p) | 0}${p.brain.task?.k?.[0] || '-'}`); }
console.log(Object.entries(time).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v | 0}s`).join(', '));
console.log(temps.join(' '));
console.log([...R.players.values()].map(p => p.name + ' tools ' + p.tools).join(' | '));
