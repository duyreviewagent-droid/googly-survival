// Pets: little googly-eyed buddies that trot, hop, waddle or fly after their owner. Bought in the shop.
import * as THREE from 'three';

export const PETS = [
  { id: 'none', name: 'No pet', price: 0, emoji: '·' },
  { id: 'rock', name: 'Pet Rock', price: 50, emoji: '🪨' },
  { id: 'pup', name: 'Googly Pup', price: 150, emoji: '🐶' },
  { id: 'kitty', name: 'Kitty', price: 200, emoji: '🐱' },
  { id: 'duck', name: 'Duckling', price: 250, emoji: '🦆' },
  { id: 'bunny', name: 'Bunny', price: 300, emoji: '🐰' },
  { id: 'slime', name: 'Slime', price: 450, emoji: '🟩' },
  { id: 'ghost', name: 'Ghosty', price: 650, emoji: '👻' },
  { id: 'dragon', name: 'Baby Dragon', price: 900, emoji: '🐉' },
  { id: 'ufo', name: 'Tiny UFO', price: 1200, emoji: '🛸' },
];
const std = (color, rough = 0.5, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const phys = o => new THREE.MeshPhysicalMaterial(o);
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent?.add(m); return m; };

function eye(parent, x, y, z, r = 0.05) {
  const e = new THREE.Group(); e.position.set(x, y, z); parent.add(e);
  const white = mesh(new THREE.CylinderGeometry(r, r, r * 0.3, 20), phys({ color: 0xffffff, roughness: 0.15, clearcoat: 1 }), 0, 0, 0, e); white.rotation.x = Math.PI / 2;
  const rim = mesh(new THREE.TorusGeometry(r, r * 0.08, 6, 20), std(0x111111), 0, 0, 0, e); void rim;
  const pupil = mesh(new THREE.CylinderGeometry(r * 0.48, r * 0.48, r * 0.1, 16), std(0x050505, 0.2), 0, -r * 0.3, r * 0.17, e); pupil.rotation.x = Math.PI / 2;
  return { e, pupil, r, p: new THREE.Vector2(0, -r * 0.3), v: new THREE.Vector2() };
}

export class Pet {
  constructor(kind) {
    this.kind = kind;
    this.group = new THREE.Group();
    this.body = new THREE.Group(); this.group.add(this.body);
    this.eyes = []; this.parts = {};
    this.t = Math.random() * 10; this.fly = kind === 'ghost' || kind === 'dragon' || kind === 'ufo';
    this.pos = null; this.vel = new THREE.Vector3(); this.yaw = 0; this.hop = 0; this.speed = 0;
    this.build(kind);
  }
  build(k) {
    const B = this.body, P = this.parts;
    if (k === 'rock') {
      const geo = new THREE.DodecahedronGeometry(0.22, 1), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const f = 0.85 + ((i * 7919) % 13) / 60; pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * 0.75, pos.getZ(i) * f); }
      geo.computeVertexNormals();
      mesh(geo, std(0x8a8680, 0.95, { flatShading: true }), 0, 0.17, 0, B);
      this.eyes.push(eye(B, -0.07, 0.24, 0.17, 0.06), eye(B, 0.08, 0.25, 0.16, 0.05));
    }
    if (k === 'pup') {
      const fur = std(0xa8703a, 0.8), dark = std(0x5a3a1a, 0.8);
      const torso = mesh(new THREE.CapsuleGeometry(0.14, 0.26, 6, 12), fur, 0, 0.26, 0, B); torso.rotation.x = Math.PI / 2;
      P.head = new THREE.Group(); P.head.position.set(0, 0.42, 0.22); B.add(P.head);
      mesh(new THREE.SphereGeometry(0.15, 16, 12), fur, 0, 0, 0, P.head);
      mesh(new THREE.SphereGeometry(0.07, 12, 8), std(0xd8a878, 0.8), 0, -0.04, 0.12, P.head);
      mesh(new THREE.SphereGeometry(0.03, 8, 6), std(0x111111, 0.3), 0, -0.01, 0.19, P.head);
      P.ears = [-1, 1].map(s => { const e = mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 8), dark, s * 0.13, 0.02, -0.02, P.head); e.rotation.z = s * 0.4; return e; });
      this.eyes.push(eye(P.head, -0.06, 0.05, 0.13, 0.045), eye(P.head, 0.06, 0.05, 0.13, 0.045));
      P.tail = new THREE.Group(); P.tail.position.set(0, 0.32, -0.27); B.add(P.tail);
      const tl = mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 6), fur, 0, 0.08, 0, P.tail); void tl; P.tail.rotation.x = -0.6;
      P.legs = [[-0.08, 0.14], [0.08, 0.14], [-0.08, -0.14], [0.08, -0.14]].map(([x, z]) => mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 6), fur, x, 0.09, z, B));
    }
    if (k === 'kitty') {
      const fur = std(0xf0a040, 0.8), stripe = std(0xc86a1a, 0.8);
      const torso = mesh(new THREE.CapsuleGeometry(0.12, 0.24, 6, 12), fur, 0, 0.24, 0, B); torso.rotation.x = Math.PI / 2;
      P.head = new THREE.Group(); P.head.position.set(0, 0.4, 0.2); B.add(P.head);
      mesh(new THREE.SphereGeometry(0.14, 16, 12), fur, 0, 0, 0, P.head);
      P.ears = [-1, 1].map(s => { const e = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), stripe, s * 0.08, 0.13, 0, P.head); e.rotation.z = -s * 0.25; return e; });
      mesh(new THREE.SphereGeometry(0.022, 8, 6), std(0xff7a9a, 0.4), 0, -0.02, 0.135, P.head);
      for (const s of [-1, 1]) for (const dy of [-0.01, 0.015]) { const w = mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14), std(0xffffff), s * 0.08, -0.03 + dy, 0.11, P.head); w.rotation.z = Math.PI / 2 + s * dy * 6; }
      this.eyes.push(eye(P.head, -0.055, 0.04, 0.12, 0.042), eye(P.head, 0.055, 0.04, 0.12, 0.042));
      P.tail = new THREE.Group(); P.tail.position.set(0, 0.28, -0.24); B.add(P.tail);
      mesh(new THREE.CapsuleGeometry(0.025, 0.26, 4, 6), stripe, 0, 0.15, 0, P.tail); P.tail.rotation.x = -0.3;
      P.legs = [[-0.07, 0.12], [0.07, 0.12], [-0.07, -0.12], [0.07, -0.12]].map(([x, z]) => mesh(new THREE.CapsuleGeometry(0.03, 0.1, 4, 6), fur, x, 0.08, z, B));
    }
    if (k === 'duck') {
      const y = std(0xffd23a, 0.6);
      mesh(new THREE.SphereGeometry(0.16, 16, 12), y, 0, 0.18, 0, B).scale.set(1, 0.9, 1.2);
      P.head = new THREE.Group(); P.head.position.set(0, 0.36, 0.1); B.add(P.head);
      mesh(new THREE.SphereGeometry(0.1, 14, 10), y, 0, 0, 0, P.head);
      mesh(new THREE.ConeGeometry(0.04, 0.1, 10), std(0xff8a1c, 0.5), 0, -0.02, 0.12, P.head).rotation.x = Math.PI / 2;
      this.eyes.push(eye(P.head, -0.045, 0.03, 0.08, 0.035), eye(P.head, 0.045, 0.03, 0.08, 0.035));
      P.wings = [-1, 1].map(s => { const w = mesh(new THREE.SphereGeometry(0.08, 10, 8), y, s * 0.15, 0.2, -0.02, B); w.scale.set(0.35, 0.7, 1); return w; });
      P.legs = [-1, 1].map(s => mesh(new THREE.BoxGeometry(0.06, 0.02, 0.08), std(0xff8a1c), s * 0.06, 0.01, 0.03, B));
    }
    if (k === 'bunny') {
      const fur = std(0xf4f0ec, 0.9);
      mesh(new THREE.SphereGeometry(0.15, 16, 12), fur, 0, 0.16, -0.02, B).scale.set(1, 0.95, 1.15);
      P.head = new THREE.Group(); P.head.position.set(0, 0.32, 0.13); B.add(P.head);
      mesh(new THREE.SphereGeometry(0.11, 14, 10), fur, 0, 0, 0, P.head);
      P.ears = [-1, 1].map(s => { const e = mesh(new THREE.CapsuleGeometry(0.03, 0.18, 4, 8), fur, s * 0.05, 0.17, -0.02, P.head); e.rotation.z = -s * 0.15; const inner = mesh(new THREE.CapsuleGeometry(0.015, 0.14, 4, 6), std(0xffa0b8, 0.6), 0, 0, 0.018, e); void inner; return e; });
      mesh(new THREE.SphereGeometry(0.02, 8, 6), std(0xff7a9a), 0, -0.02, 0.105, P.head);
      mesh(new THREE.SphereGeometry(0.05, 10, 8), fur, 0, 0.16, -0.19, B);
      this.eyes.push(eye(P.head, -0.045, 0.03, 0.09, 0.035), eye(P.head, 0.045, 0.03, 0.09, 0.035));
    }
    if (k === 'slime') {
      P.jelly = mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34, 4, 4, 4), phys({ color: 0x3ad04a, roughness: 0.1, transmission: 0.4, thickness: 0.3, clearcoat: 1, transparent: true, opacity: 0.85 }), 0, 0.15, 0, B);
      const pos = P.jelly.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(pos, i), l = v.length(); v.multiplyScalar((0.19 + (v.clone().normalize().y > 0.5 ? 0.02 : 0)) / Math.max(l, 1e-3) * 0.55 + 0.45); pos.setXYZ(i, v.x, v.y, v.z); } P.jelly.geometry.computeVertexNormals();
      mesh(new THREE.SphereGeometry(0.05, 8, 6), std(0x1a6a22, 0.3), 0.05, 0.1, -0.02, B);
      this.eyes.push(eye(B, 0, 0.2, 0.17, 0.08));
    }
    if (k === 'ghost') {
      const mat = phys({ color: 0xffffff, roughness: 0.3, transparent: true, opacity: 0.82, emissive: 0xbfd8ff, emissiveIntensity: 0.25 });
      mesh(new THREE.SphereGeometry(0.17, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, 0.2, 0, B);
      P.skirt = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 18, 2, true), mat, 0, 0.1, 0, B);
      this.eyes.push(eye(B, -0.06, 0.26, 0.14, 0.045), eye(B, 0.06, 0.26, 0.14, 0.045));
      P.arms = [-1, 1].map(s => mesh(new THREE.SphereGeometry(0.05, 10, 8), mat, s * 0.19, 0.15, 0.02, B));
    }
    if (k === 'dragon') {
      const g = std(0x7a4ad8, 0.5), belly = std(0xffc85a, 0.6);
      const torso = mesh(new THREE.CapsuleGeometry(0.1, 0.2, 6, 12), g, 0, 0.2, 0, B); torso.rotation.x = Math.PI / 2 - 0.3;
      mesh(new THREE.SphereGeometry(0.08, 12, 8), belly, 0, 0.18, 0.06, B).scale.set(1, 1.2, 0.6);
      P.head = new THREE.Group(); P.head.position.set(0, 0.35, 0.16); B.add(P.head);
      mesh(new THREE.SphereGeometry(0.1, 14, 10), g, 0, 0, 0, P.head);
      mesh(new THREE.SphereGeometry(0.06, 10, 8), g, 0, -0.03, 0.09, P.head).scale.set(1, 0.8, 1.2);
      for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.02, 0.08, 6), belly, s * 0.05, 0.1, -0.03, P.head).rotation.x = -0.4;
      this.eyes.push(eye(P.head, -0.045, 0.04, 0.08, 0.035), eye(P.head, 0.045, 0.04, 0.08, 0.035));
      const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0); wingShape.lineTo(0.32, 0.12); wingShape.lineTo(0.28, -0.02); wingShape.lineTo(0.2, -0.06); wingShape.lineTo(0.1, -0.05); wingShape.closePath();
      P.wings = [-1, 1].map(s => { const w = new THREE.Group(); w.position.set(s * 0.06, 0.28, -0.04); B.add(w); const m = mesh(new THREE.ShapeGeometry(wingShape), new THREE.MeshStandardMaterial({ color: 0x9a6aff, side: THREE.DoubleSide, roughness: 0.6 }), 0, 0, 0, w); m.scale.x = s; return w; });
      P.tail = mesh(new THREE.ConeGeometry(0.05, 0.3, 8), g, 0, 0.15, -0.22, B); P.tail.rotation.x = -Math.PI / 2 - 0.4;
    }
    if (k === 'ufo') {
      const metal = phys({ color: 0xc8d0dc, metalness: 1, roughness: 0.2, clearcoat: 1 });
      mesh(new THREE.SphereGeometry(0.26, 24, 10), metal, 0, 0.1, 0, B).scale.set(1, 0.25, 1);
      mesh(new THREE.SphereGeometry(0.12, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), phys({ color: 0x9adfff, roughness: 0.05, transmission: 0.7, transparent: true, opacity: 0.6 }), 0, 0.14, 0, B);
      const alien = mesh(new THREE.SphereGeometry(0.06, 12, 10), std(0x6ae05a, 0.5), 0, 0.17, 0, B); void alien;
      this.eyes.push(eye(B, 0, 0.19, 0.055, 0.03));
      P.lights = [];
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P.lights.push(mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe04a }), Math.cos(a) * 0.23, 0.09, Math.sin(a) * 0.23, B)); }
      P.beam = mesh(new THREE.ConeGeometry(0.2, 0.9, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x9aff9a, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }), 0, -0.4, 0, B);
      P.beam.castShadow = false;
    }
    this.group.traverse(o => { if (o.isMesh && o !== P.beam) o.castShadow = true; });
  }
  /** Follow an owner standing at (x, y, z) facing yaw. */
  update(dt, x, y, z, yaw, ownerSpeed = 0, crouch = false) {
    this.t += dt;
    // stand a little behind and to the side of the owner (closer when they're crouched and hiding)
    const back = crouch ? 0.55 : 1.0, side = crouch ? 0.35 : 0.75;
    const tx = x - Math.sin(yaw) * -back + Math.cos(yaw) * side, tz = z - Math.cos(yaw) * -back - Math.sin(yaw) * side;
    const ty = y + (this.fly ? (crouch ? 0.5 : 1.25) + Math.sin(this.t * 2) * 0.08 : 0);
    if (!this.pos || this.pos.distanceTo(W.set(tx, ty, tz)) > 12) this.pos = new THREE.Vector3(tx, ty, tz);
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const want = d > 0.25 ? Math.min(ownerSpeed + 2.5, d * 4) : 0;
    const vx = d > 0.01 ? dx / d * want : 0, vz = d > 0.01 ? dz / d * want : 0;
    this.vel.x += (vx - this.vel.x) * (1 - Math.exp(-8 * dt)); this.vel.z += (vz - this.vel.z) * (1 - Math.exp(-8 * dt));
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    this.pos.y += (ty - this.pos.y) * (1 - Math.exp(-(this.fly ? 4 : 14) * dt));
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.speed > 0.3) this.yaw += (((Math.atan2(this.vel.x, this.vel.z) - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-10 * dt));
    else this.yaw += (((yaw + Math.PI - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * (1 - Math.exp(-2 * dt));
    this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
    this.animate(dt);
  }
  animate(dt) {
    const k = this.kind, P = this.parts, t = this.t, mv = Math.min(1, this.speed / 3), B = this.body;
    B.position.y = 0; B.rotation.set(0, 0, 0); B.scale.set(1, 1, 1);
    if (k === 'rock') { B.position.y = Math.abs(Math.sin(t * 12)) * 0.06 * mv; B.rotation.z = Math.sin(t * 12) * 0.12 * mv; }
    if (k === 'pup' || k === 'kitty') {
      const f = t * (k === 'pup' ? 14 : 12);
      P.legs.forEach((l, i) => { l.rotation.x = Math.sin(f + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 * mv; });
      B.position.y = Math.abs(Math.sin(f)) * 0.03 * mv;
      P.tail.rotation.z = Math.sin(t * (k === 'pup' ? 18 : 3)) * (k === 'pup' ? 0.7 : 0.35);
      P.head.rotation.x = Math.sin(t * 1.3) * 0.08; P.head.rotation.z = Math.sin(t * 0.7) * 0.12;
      if (k === 'pup') P.ears.forEach((e, i) => { e.rotation.z = (i ? 1 : -1) * (0.4 + Math.sin(f) * 0.25 * mv); });
    }
    if (k === 'duck') { B.rotation.z = Math.sin(t * 10) * 0.2 * (0.3 + mv); P.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.max(0, Math.sin(t * 20)) * 0.6 * mv; }); P.head.rotation.x = Math.sin(t * 10) * 0.15 * mv; }
    if (k === 'bunny') { const h = Math.max(0, Math.sin(t * 9)); B.position.y = h * 0.22 * Math.max(mv, 0.15 * (Math.sin(t * 0.5) > 0.7 ? 1 : 0)); B.scale.set(1 + (1 - h) * 0.06, 1 - (1 - h) * 0.08, 1); P.ears.forEach((e, i) => { e.rotation.x = -h * 0.5 * mv; e.rotation.z = (i ? -1 : 1) * 0.15 + Math.sin(t * 2 + i) * 0.08; }); }
    if (k === 'slime') { const h = Math.max(0, Math.sin(t * 7)); B.position.y = h * 0.14 * Math.max(0.25, mv); const sq = 1 - (1 - h) * 0.25; B.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); }
    if (k === 'ghost') { B.rotation.z = Math.sin(t * 2) * 0.1; P.skirt.scale.x = 1 + Math.sin(t * 6) * 0.05; P.arms.forEach((a, i) => { a.position.y = 0.15 + Math.sin(t * 4 + i * 2) * 0.03; }); }
    if (k === 'dragon') { P.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.2 + Math.sin(t * 14) * 0.7); }); B.rotation.x = 0.15 * mv; P.tail.rotation.y = Math.sin(t * 3) * 0.3; }
    if (k === 'ufo') { B.rotation.y = t * 1.5; P.lights.forEach((l, i) => { l.material.color.setHSL(((t * 0.6 + i / 8) % 1), 1, 0.6); }); P.beam.material.opacity = 0.08 + Math.sin(t * 5) * 0.04; }
    // tiny googly eyes jiggle with motion
    for (const e of this.eyes) {
      e.v.x += (-this.vel.x * 0.4 + (Math.random() - 0.5) * 2) * dt * 8; e.v.y += (-20 * e.r - Math.abs(B.position.y) * 30) * dt;
      e.v.multiplyScalar(1 - 3 * dt); e.p.addScaledVector(e.v, dt);
      const maxD = e.r * 0.45, d = e.p.length(); if (d > maxD) { e.p.multiplyScalar(maxD / d); e.v.multiplyScalar(-0.5); }
      e.pupil.position.set(e.p.x, e.p.y, e.r * 0.17);
    }
  }
}
const W = new THREE.Vector3();
