// ?icon=1 — draws the app icon: an orange googly warming its hands by a campfire under the night sky.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Googly } from './googly.js';

export function renderIcon() {
  const N = 1024;
  document.body.innerHTML = '';
  document.body.style.background = 'transparent'; document.documentElement.style.background = 'transparent';
  const out = document.createElement('canvas'); out.width = out.height = N; out.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px';
  document.body.appendChild(out);
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(N, N, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.25;
  scene.add(new THREE.HemisphereLight(0x6a80c0, 0x2a1a10, 0.7));
  const moon = new THREE.DirectionalLight(0x9ab4ff, 0.9); moon.position.set(-4, 5, -2); scene.add(moon);
  const fireLight = new THREE.PointLight(0xffa850, 14, 12, 1.4); fireLight.position.set(0.75, 0.7, 0.4); scene.add(fireLight);
  const front = new THREE.DirectionalLight(0xffb070, 0.9); front.position.set(2, 1.5, 5); scene.add(front);

  // the orange googly, looking happy, hands out towards the warm fire
  const g = new Googly({ color: '#ff9a26', local: true });
  g.group.position.set(-0.7, 0, -0.1); g.group.rotation.y = 0.75; g.group.scale.setScalar(0.92); scene.add(g.group);
  g.setGear(['coat']);
  for (let i = 0; i < 90; i++) g.update(1 / 60, { speed: 0, pose: 'cheer' });
  g.eyes.forEach((e, i) => e.pupil.position.set(i ? 0.03 : 0.04, -0.012, 0.022));     // eyes on the fire
  g.mouth.scale.set(1.35, 1.3, 1);

  // the campfire: stones, crossed logs, layered flames and a glow
  const fire = new THREE.Group(); fire.position.set(0.8, 0, 0.35); scene.add(fire);
  const stone = new THREE.MeshStandardMaterial({ color: 0x7a7874, roughness: 0.9, flatShading: true });
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), stone); const a = i / 9 * Math.PI * 2; s.position.set(Math.cos(a) * 0.42, 0.06, Math.sin(a) * 0.42); s.rotation.set(i, i * 2, 0); fire.add(s); }
  const logM = new THREE.MeshStandardMaterial({ color: 0x5a3418, roughness: 0.9 });
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.7, 8), logM); l.position.y = 0.16; l.rotation.set(1.05, i * Math.PI / 2 + 0.4, 0); fire.add(l); }
  const flame = (h, rad, col, y, op) => { const f = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false })); f.position.y = y + h / 2; fire.add(f); return f; };
  flame(0.95, 0.3, 0xff4a10, 0.1, 0.8); flame(0.75, 0.22, 0xff8a20, 0.12, 0.9); flame(0.5, 0.14, 0xffe070, 0.14, 0.95);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, f = flame(0.45 + (i % 3) * 0.12, 0.1, i % 2 ? 0xff6a18 : 0xffb030, 0.1, 0.85); f.position.x = Math.cos(a) * 0.17; f.position.z = Math.sin(a) * 0.17; f.rotation.z = -Math.cos(a) * 0.35; f.rotation.x = Math.sin(a) * 0.35; }
  // snowy ground disc

  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0.25, 1.35, 6.2); cam.lookAt(0.2, 0.72, 0);
  scene.updateMatrixWorld(true);
  r.render(scene, cam);

  const c = out.getContext('2d');
  const M = 100, S = N - 2 * M, R = 185;
  c.save();
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 30; c.shadowOffsetY = 12;
  tile(c, M, M, S, S, R); const bg = c.createLinearGradient(0, M, 0, M + S); bg.addColorStop(0, '#0a1430'); bg.addColorStop(0.6, '#1c2a58'); bg.addColorStop(1, '#0a1020'); c.fillStyle = bg; c.fill();
  c.restore();
  c.save(); tile(c, M, M, S, S, R); c.clip();
  // stars, a moon, pine silhouettes and the ground
  for (let i = 0; i < 70; i++) { const x = M + (i * 7919 % S), y = M + (i * 104729 % 380); c.fillStyle = `rgba(255,255,255,${0.35 + (i % 5) * 0.12})`; c.beginPath(); c.arc(x, y, 1.5 + (i % 3), 0, 7); c.fill(); }
  c.save(); c.shadowColor = '#fff6d0'; c.shadowBlur = 40; c.fillStyle = '#f8f2d8'; c.beginPath(); c.arc(770, 250, 46, 0, 7); c.fill(); c.restore(); c.fillStyle = '#e0d8b8'; for (const [x, y, rr] of [[755, 240, 9], [785, 265, 6], [775, 228, 5]]) { c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill(); }
  c.fillStyle = '#0c1a14';
  for (const [x, h, w] of [[140, 330, 110], [240, 260, 90], [330, 300, 100], [700, 280, 95], [800, 350, 120], [900, 290, 100]]) { const b = 690; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x - w * (1 - k * 0.22), b - k * h * 0.28); c.lineTo(x, b - h - k * 10); c.lineTo(x + w * (1 - k * 0.22), b - k * h * 0.28); c.fill(); } }
  const gr = c.createLinearGradient(0, 640, 0, N); gr.addColorStop(0, '#1e3a1e'); gr.addColorStop(1, '#0c1a0c'); c.fillStyle = gr; c.fillRect(0, 660, N, N);
  // the warm glow on the ground around the fire
  const gl = c.createRadialGradient(640, 700, 10, 640, 700, 420); gl.addColorStop(0, 'rgba(255,150,60,.55)'); gl.addColorStop(1, 'rgba(255,150,60,0)'); c.fillStyle = gl; c.fillRect(0, 0, N, N);
  c.restore();
  // sparks rising from the fire, and the 3D googly + fire, all inside the rounded tile
  c.save(); tile(c, M, M, S, S, R); c.clip();
  c.drawImage(r.domElement, 0, 0);
  for (const [x, y, s] of [[650, 420, 7], [690, 360, 5], [620, 330, 6], [705, 290, 4], [660, 250, 5], [630, 200, 3], [690, 470, 4]]) { c.fillStyle = '#ffd070'; c.shadowColor = '#ff9a30'; c.shadowBlur = 14; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); }
  c.restore();
  const pre = document.createElement('pre'); pre.id = 'icondata'; pre.textContent = out.toDataURL('image/png'); pre.style.display = 'none'; document.body.appendChild(pre);
  document.title = 'ICON READY';
  window.__iconReady = true;
}
function tile(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
