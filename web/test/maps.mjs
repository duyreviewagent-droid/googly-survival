// Every map: node counts, plots and post reachable from each other, water reachable, nav build time.
import { MAPS } from '../public/js/maps.js';
import * as S from '../public/js/sim.js';
let bad = 0;
for (const m of MAPS) {
  const t0 = performance.now(); const nav = S.buildNav(m); const tn = performance.now() - t0;
  const c = {}; for (const n of m.nodes) c[n.type] = (c[n.type] || 0) + 1;
  let hmax = -1e9; for (let x = -70; x <= 70; x += 2) for (let z = -70; z <= 70; z += 2) hmax = Math.max(hmax, m.h(x, z));
  const out = [`${m.name.padEnd(16)} nav ${tn.toFixed(0)}ms nodes ${JSON.stringify(c)} hmax ${hmax.toFixed(1)}`];
  const from = [m.post?.x ?? 0, (m.post?.z ?? 0) + 8];
  const goals = [...m.plots.map(p => ['plot' + p.i, p.x, p.z]), ...m.lakes.map((l, i) => ['lake' + i, l.x + l.r + 0.5, l.z])];
  let unreach = 0;
  for (const n of m.nodes) { const p = S.findPath(nav, from[0], m.h(...from), from[1], n.x + 1.6, 0, n.z); if (!p) unreach++; }
  for (const [name, x, z] of goals) { const p = S.findPath(nav, from[0], m.h(...from), from[1], x, m.h(x, z), z); if (!p) { out.push('  UNREACHABLE ' + name); bad++; } }
  out.push(`  nodes unreachable: ${unreach}/${m.nodes.length}`);
  if (unreach > m.nodes.length * 0.08) bad++;
  console.log(out.join('\n'));
}
process.exit(bad ? 1 : 0);
