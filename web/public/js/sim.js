// Shared physics: googly movement over hilly terrain, sight lines and the computer players' navigation grid.
// Runs the same in the browser and on the server.
export const GRAV = 20, JUMP_V = 7.0;     // jump peak ≈ 1.22 m: enough to hop onto a 1.1 m block
export const PR = 0.38;                   // body radius
export const PH = 1.66, PHC = 1.18;       // standing / crouching height
export const STEP = 0.47;                 // highest ledge you walk up without jumping
export const EYE = 1.42, EYEC = 0.98;
export const WALK = 4.6, SPRINT = 6.6, CROUCH = 2.4, WADE = 0.6;
export const REACH = 2.6;                 // how close you must be to chop, mine, pick or bonk
export const CLIFF = 0.2;                 // terrain rising more than this per 0.18 m step is a cliff you can't walk up
export const CLIMB = 1.15;                // highest rise a computer player will jump up in one go

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/** Highest walkable top under a circle at (x,z) that is at most maxY. Returns { g, c }. */
export function groundCol(map, x, z, r, maxY) {
  let g = map.h(x, z), col = null;
  for (const c of map.colliders) {
    if (c.soft) continue;
    const top = c.y + c.h;
    if (top > maxY || top <= g) continue;
    if (c.t === 'b') {
      const dx = Math.max(Math.abs(x - c.x) - c.w / 2, 0), dz = Math.max(Math.abs(z - c.z) - c.d / 2, 0);
      if (dx * dx + dz * dz < r * r * 0.5) { g = top; col = c; }
    } else if (Math.hypot(x - c.x, z - c.z) < c.r + r * 0.5) { g = top; col = c; }
  }
  return { g, c: col };
}
export const groundAt = (map, x, z, r, maxY) => groundCol(map, x, z, r, maxY).g;

function overlapsXZ(c, x, z, r) {
  if (c.t === 'b') {
    const nx = clamp(x, c.x - c.w / 2, c.x + c.w / 2), nz = clamp(z, c.z - c.d / 2, c.z + c.d / 2);
    return (x - nx) ** 2 + (z - nz) ** 2 < r * r;
  }
  return Math.hypot(x - c.x, z - c.z) < c.r + r;
}
/** Is there something solid between crouch height and standing height right above us? */
export function lowCeiling(map, x, y, z) {
  for (const c of map.colliders) {
    if (c.soft) continue;
    if (c.y + c.h <= y + PHC - 0.02 || c.y >= y + PH) continue;
    if (c.y < y + PHC - 0.02) continue;          // it's a wall we're next to, not a ceiling
    if (overlapsXZ(c, x, z, PR - 0.02)) return true;
  }
  return false;
}

// push a body out of everything it overlaps (horizontal), ceiling bumps (vertical)
function resolve(p, map, h) {
  for (const c of map.colliders) {
    if (c.soft) continue;
    const top = c.y + c.h;
    if (p.y + h <= c.y + 0.01 || p.y >= top - 0.01) continue;         // no vertical overlap
    if (p.onGround && top - p.y <= STEP) continue;                     // it's a step: the ground check lifts us
    if (c.t === 'b') {
      const lx = c.x - c.w / 2, lz = c.z - c.d / 2;
      const nx = clamp(p.x, lx, lx + c.w), nz = clamp(p.z, lz, lz + c.d);
      const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= PR * PR) continue;
      // head bump on something above us
      if (p.vy > 0 && p.y + h - p.vy * 0.04 <= c.y + 0.05) { p.y = c.y - h; p.vy = 0; continue; }
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = nx + dx / d * PR; p.z = nz + dz / d * PR; }
      else { // centre inside the box: leave by the nearest face
        const ex = [p.x - lx, lx + c.w - p.x, p.z - lz, lz + c.d - p.z];
        const m = Math.min(...ex), i = ex.indexOf(m);
        if (i === 0) p.x = lx - PR; else if (i === 1) p.x = lx + c.w + PR; else if (i === 2) p.z = lz - PR; else p.z = lz + c.d + PR;
      }
    } else {
      let dx = p.x - c.x, dz = p.z - c.z; const d = Math.hypot(dx, dz), m = c.r + PR;
      if (d >= m) continue;
      if (p.vy > 0 && p.y + h - p.vy * 0.04 <= c.y + 0.05) { p.y = c.y - h; p.vy = 0; continue; }
      if (d < 1e-6) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      p.x = c.x + dx * m; p.z = c.z + dz * m;
    }
  }
}

/**
 * One movement step. p: {x,y,z,vx,vy,vz,onGround,crouch,seeker,speedMul}.
 * inp: {dx,dz (world direction, length ≤ 1), jump, sprint, crouch}.
 */
export function stepPlayer(p, inp, dt, map) {
  // you can't stand up under a bed
  p.crouch = !!inp.crouch || (p.crouch && lowCeiling(map, p.x, p.y, p.z));
  const h = p.crouch ? PHC : PH;
  const wet = map.wetAt(p.x, p.z) && p.y < map.wetAt(p.x, p.z).level + 0.1;
  const sp = (p.crouch ? CROUCH : inp.sprint ? SPRINT : WALK) * (wet ? WADE : 1) * (p.speedMul || 1) * (p.stun > 0 ? 0 : 1);
  let mx = inp.dx || 0, mz = inp.dz || 0; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const k = 1 - Math.exp(-(p.onGround ? 14 : 2.6) * dt);
  p.vx += (mx * sp - p.vx) * k; p.vz += (mz * sp - p.vz) * k;
  if (inp.jump && p.onGround && !p.crouch) { p.vy = JUMP_V; p.onGround = false; p.jumped = true; }
  p.vy -= GRAV * dt;
  const n = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vz) * dt / 0.18));
  for (let i = 0; i < n; i++) {
    const ox = p.x, oz = p.z, ho = map.h(ox, oz);
    p.x += p.vx * dt / n; p.z += p.vz * dt / n;
    // too steep to walk up: stay put (unless we're already high enough in the air)
    const hn = map.h(p.x, p.z), step = Math.hypot(p.x - ox, p.z - oz);
    if (hn - Math.max(p.y, ho) > CLIFF * Math.max(1, step / 0.18)) { p.x = ox; p.z = oz; p.vx *= 0.3; p.vz *= 0.3; }
    resolve(p, map, h);
  }
  const was = p.onGround;
  p.y += p.vy * dt;
  const { g, c } = groundCol(map, p.x, p.z, PR, p.y + (was ? STEP : 0.05) + Math.max(0, -p.vy * dt));
  if (p.y <= g) {
    if (!was && p.vy < -9) p.landed = -p.vy;
    p.y = g; p.vy = 0; p.onGround = true;
    if (c && c.bounce && !was) { p.vy = c.bounce; p.onGround = false; p.bounced = true; }
  }
  else if (was && p.y - g < STEP && p.vy <= 0) { p.y = g; p.vy = 0; p.onGround = true; }         // walk down steps
  else p.onGround = false;
  resolve(p, map, h);
  const hw = map.W / 2 - PR, hd = map.D / 2 - PR;
  p.x = clamp(p.x, -hw, hw); p.z = clamp(p.z, -hd, hd);
  if (map.roof && p.y + h > map.roof) { p.y = map.roof - h; p.vy = Math.min(0, p.vy); }
  if (p.stun > 0) p.stun -= dt;
}

// ------------------------------------------------------------------ sight lines
/** First hit of the segment a→b against the map. soft=false ignores curtains, blankets and the like. */
export function segMap(map, ax, ay, az, bx, by, bz, soft = true) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  let best = null;
  // the ground: march along the segment and find where it dips under the terrain
  const steps = Math.min(40, Math.max(4, Math.ceil(Math.hypot(dx, dz) / 0.5)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (ay + dy * t < map.h(ax + dx * t, az + dz * t) + 0.15) { best = { t: (i - 0.5) / steps, n: [0, 1, 0], c: null }; break; }
  }
  if (map.roof && by > map.roof && ay <= map.roof) { const t = (map.roof - ay) / dy; if (!best || t < best.t) best = { t, n: [0, -1, 0], c: null }; }
  for (const c of map.colliders) {
    if (c.soft && !soft) continue;
    if (c.t === 'b') {
      let t0 = 0, t1 = best ? best.t : 1, axis = -1, sign = 0;
      const mins = [c.x - c.w / 2, c.y, c.z - c.d / 2], maxs = [c.x + c.w / 2, c.y + c.h, c.z + c.d / 2], o = [ax, ay, az], d = [dx, dy, dz];
      let ok = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-9) { if (o[i] < mins[i] || o[i] > maxs[i]) { ok = false; break; } continue; }
        let ta = (mins[i] - o[i]) / d[i], tb = (maxs[i] - o[i]) / d[i], sg = -1;
        if (ta > tb) { const q = ta; ta = tb; tb = q; sg = 1; }
        if (ta > t0) { t0 = ta; axis = i; sign = sg; }
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && axis >= 0) { const n = [0, 0, 0]; n[axis] = sign; best = { t: t0, n, c }; }
    } else {
      const fx = ax - c.x, fz = az - c.z, A = dx * dx + dz * dz, Bq = 2 * (fx * dx + fz * dz), Cq = fx * fx + fz * fz - c.r * c.r;
      const lim = best ? best.t : 1;
      if (A > 1e-9) {
        const disc = Bq * Bq - 4 * A * Cq;
        if (disc >= 0) {
          const t = (-Bq - Math.sqrt(disc)) / (2 * A);
          if (t >= 0 && t <= lim) { const y = ay + dy * t; if (y >= c.y && y <= c.y + c.h) { best = { t, n: [(fx + dx * t) / c.r, 0, (fz + dz * t) / c.r], c }; continue; } }
        }
      }
      const top = c.y + c.h;
      if (dy < 0 && ay >= top && by <= top) { const t = (ay - top) / (ay - by); if (t <= lim) { const x = ax + dx * t - c.x, z = az + dz * t - c.z; if (x * x + z * z <= c.r * c.r) best = { t, n: [0, 1, 0], c }; } }
    }
  }
  return best;
}
export const canSee = (map, a, b) => !segMap(map, a[0], a[1], a[2], b[0], b[1], b[2]);
export const eyeOf = p => [p.x, p.y + (p.crouch ? EYEC : EYE), p.z];
export const chestOf = p => [p.x, p.y + (p.crouch ? 0.72 : 1.0), p.z];
export const headOf = p => [p.x, p.y + (p.crouch ? PHC : PH) - 0.18, p.z];
/** Can a looker see any of this googly (head or chest)? */
export const seesBody = (map, eye, q) => canSee(map, eye, headOf(q)) || canSee(map, eye, chestOf(q));

// ------------------------------------------------------------------ navigation grid for the computer players
// A 2.5D grid with up to L floors stacked in each cell (the floor under the bed and the quilt on top of it).
const L = 3;
export function buildNav(map, cell = 1) {
  const nx = Math.floor(map.W / cell), nz = Math.floor(map.D / cell), N = nx * nz * L;
  const floor = new Float32Array(N), open = new Uint8Array(N), low = new Uint8Array(N);
  const cx = i => -map.W / 2 + (i + 0.5) * cell, cz = j => -map.D / 2 + (j + 0.5) * cell;
  const pad = PR + 0.12, rr = pad / Math.SQRT1_2;   // cells within `pad` of a block count as standing on it
  const solid = map.colliders.filter(c => !c.soft);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = cx(i), z = cz(j);
    const near = solid.filter(c => c.t === 'b' ? Math.abs(x - c.x) < c.w / 2 + pad && Math.abs(z - c.z) < c.d / 2 + pad : Math.hypot(x - c.x, z - c.z) < c.r + pad);
    // every surface you could stand on here: the floor and the tops of things under the foot circle
    const tops = [map.h(x, z)];
    for (const c of near) {
      const top = c.y + c.h;
      const on = c.t === 'b' ? (Math.max(Math.abs(x - c.x) - c.w / 2, 0) ** 2 + Math.max(Math.abs(z - c.z) - c.d / 2, 0) ** 2 < rr * rr * 0.5) : Math.hypot(x - c.x, z - c.z) < c.r + rr * 0.5;
      if (on && !tops.includes(top)) tops.push(top);
    }
    tops.sort((a, b) => a - b);
    let n = 0;
    for (const g of tops) {
      if (n >= L) break;
      if (tops.some(t => t > g && t <= g + STEP)) continue;          // a lip right above: that's the real surface
      let ok = true, lo = false;
      for (const c of near) {
        const top = c.y + c.h;
        if (top <= g + 0.01 || c.y >= g + PH) continue;
        if (c.y >= g + PHC) lo = true; else { ok = false; break; }
      }
      if (!ok || Math.abs(x) > map.W / 2 - 1.5 || Math.abs(z) > map.D / 2 - 1.5 || (map.roof && g + PHC >= map.roof)) continue;
      if (g === tops[0] && map.slope(x, z) > 0.9) continue;          // a cliff face
      const k = (j * nx + i) * L + n++;
      floor[k] = g; low[k] = lo || map.wetAt(x, z) ? 1 : 0; open[k] = 1;
    }
  }
  return { nx, nz, cell, floor, open, low, cx, cz, W: map.W, D: map.D };
}
const colOf = (nav, x, z) => clamp(Math.floor((x + nav.W / 2) / nav.cell), 0, nav.nx - 1) + clamp(Math.floor((z + nav.D / 2) / nav.cell), 0, nav.nz - 1) * nav.nx;
/** The nav node for a googly at (x, y, z): the floor in that cell closest to (just under) its feet. -1 if none. */
export function navNode(nav, x, y, z) {
  const b = colOf(nav, x, z) * L; let best = -1, bd = 1e9;
  for (let l = 0; l < L; l++) { const k = b + l; if (!nav.open[k]) continue; const d = y - nav.floor[k], s = d >= -0.3 ? d : 3 - d * 2; if (s < bd) { bd = s; best = k; } }
  return best;
}
function nearestOpen(nav, x, y, z) {
  let k = navNode(nav, x, y, z); if (k >= 0) return k;
  const c = colOf(nav, x, z), i0 = c % nav.nx, j0 = (c / nav.nx) | 0;
  for (let r = 1; r < 10; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= nav.nx || j >= nav.nz) continue;
    k = navNode(nav, nav.cx(i), y, nav.cz(j)); if (k >= 0) return k;
  }
  return -1;
}
/** A* over the layered grid; climbs at most CLIMB between neighbours (with a jump). Returns [[x,z,floorY],...] or null. */
export function findPath(nav, x0, y0, z0, x1, y1, z1) {
  const s = nearestOpen(nav, x0, y0, z0), e = nearestOpen(nav, x1, y1, z1);
  if (s < 0 || e < 0) return null;
  if (s === e) return [[x1, z1, nav.floor[e]]];
  const N = nav.floor.length, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap = [], ec = (e / L) | 0, ex = ec % nav.nx, ez = (ec / nav.nx) | 0;
  const hfn = k => { const c = (k / L) | 0; return Math.hypot(c % nav.nx - ex, ((c / nav.nx) | 0) - ez) + Math.abs(nav.floor[k] - nav.floor[e]) * 0.5; };
  const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  // a neighbouring floor we can reach from floor k (walk, step, hop up or drop down)
  const link = (k, c2) => { let best = -1, bd = 1e9; for (let l = 0; l < L; l++) { const n = c2 * L + l; if (!nav.open[n]) continue; const rise = nav.floor[n] - nav.floor[k]; if (rise > CLIMB || rise < -6) continue; const d = Math.abs(rise); if (d < bd) { bd = d; best = n; } } return best; };
  g[s] = 0; push(s, hfn(s));
  let it = 0;
  while (heap.length && it++ < 90000) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1;
    if (k === e) break;
    const c = (k / L) | 0, i = c % nav.nx, j = (c / nav.nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nav.nx || b >= nav.nz) continue;
      const n = link(k, b * nav.nx + a); if (n < 0 || closed[n]) continue;
      if (di && dj && (link(k, j * nav.nx + a) < 0 || link(k, b * nav.nx + i) < 0)) continue;
      const rise = nav.floor[n] - nav.floor[k];
      const ng = g[k] + (di && dj ? 1.414 : 1) + (rise > STEP ? 3 : rise < -STEP ? 1 : 0) + (nav.low[n] ? 2 : 0);
      if (ng < g[n]) { g[n] = ng; from[n] = k; push(n, ng + hfn(n)); }
    }
  }
  if (from[e] < 0) return null;
  const path = []; let k = e;
  while (k !== s && k >= 0) { const c = (k / L) | 0; path.push([nav.cx(c % nav.nx), nav.cz((c / nav.nx) | 0), nav.floor[k]]); k = from[k]; }
  path.reverse();
  // string-pull: drop points we can walk straight past on the same floor
  const out = [];
  let prev = [x0, z0, nav.floor[s]];
  for (let q = 0; q < path.length; q++) {
    const nxt = path[q + 1];
    if (nxt && straight(nav, prev, nxt)) continue;
    out.push(path[q]); prev = path[q];
  }
  if (out.length) out[out.length - 1] = [x1, z1, nav.floor[e]];
  return out.length ? out : [[x1, z1, nav.floor[e]]];
}
function straight(nav, a, b) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / (nav.cell * 0.5));
  let y = a[2];
  for (let i = 1; i <= n; i++) {
    const t = i / n, k = navNode(nav, a[0] + (b[0] - a[0]) * t, y + 0.2, a[1] + (b[1] - a[1]) * t);
    if (k < 0 || Math.abs(nav.floor[k] - y) > STEP) return false;
    y = nav.floor[k];
  }
  return Math.abs(y - b[2]) < 0.3;     // and we really ended up on b's floor, not the one underneath it
}

/** Steering for a computer player along a findPath() result. Mutates path; returns {dx, dz, jump, crouch, done}. */
export function followPath(p, path, nav) {
  // only move on from a waypoint once we're actually standing at its height (not underneath it)
  while (path.length > 1 && Math.hypot(path[0][0] - p.x, path[0][1] - p.z) < 0.45 && p.y > path[0][2] - 0.3) path.shift();
  if (!path.length) return { dx: 0, dz: 0, jump: false, crouch: false, done: true };
  const [gx, gz, gy] = path[0], d = Math.hypot(gx - p.x, gz - p.z);
  const done = path.length === 1 && d < 0.4 && Math.abs(p.y - gy) < 0.5;
  const here = navNode(nav, p.x, p.y + 0.1, p.z), ahead = navNode(nav, p.x + (gx - p.x) * Math.min(1, 0.7 / (d || 1)), p.y + 0.1, p.z + (gz - p.z) * Math.min(1, 0.7 / (d || 1)));
  void here; void ahead;
  return { dx: d > 0.12 ? (gx - p.x) / d : 0, dz: d > 0.12 ? (gz - p.z) / d : 0, jump: gy > p.y + STEP && d < 1.7, crouch: false, done };
}
