// Baron Türkiye — 3D izometrik tahta önizlemesi (three.js)
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { TOKENS, ICON, ART } from './art.js';

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CUR = '฿';
const fmt = (n) => `${CUR}${n.toLocaleString('tr-TR')}`;
const short = (n) => `${n >= 1e6 ? (n / 1e6).toLocaleString('tr-TR') + 'M' : Math.round(n / 1000) + 'K'}`;

// ---------- tahta verisi ----------
const BOARD = await fetch('/api/board').then((r) => r.json());
const SQ = BOARD.squares, GROUPS = BOARD.groups;
const B = 10, U = B / 12.6, C = 1.8 * U;             // tahta kenarı, kare genişliği, köşe
const sideOf = (i) => (i < 10 ? 0 : i < 20 ? 1 : i < 30 ? 2 : 3); // 0 alt, 1 sol, 2 üst, 3 sağ (tahta düzleminde)
function sqCenter(i) {
  const h = B / 2, k = i % 10, s = sideOf(i);
  const along = k === 0 ? h - C / 2 : h - C - (k - 0.5) * U;   // köşeden ilerleme
  const edge = h - C / 2;
  if (s === 0) return new THREE.Vector3(along, 0, edge);
  if (s === 1) return new THREE.Vector3(-edge, 0, along);
  if (s === 2) return new THREE.Vector3(-along, 0, -edge);
  return new THREE.Vector3(edge, 0, -along);
}
const inward = (i) => [new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)][sideOf(i)];
const groupColor = (s) => (s.group ? GROUPS[s.group].color : '#8a8a8a');

// ---------- tahta yüzeyi (canvas dokusu) ----------
const SAMPLE = 'ABCabc0123 İŞĞÜÖÇışğüöç฿';
await Promise.all(['700', '800', '900'].map((w) => document.fonts.load(`${w} 40px Nunito`, SAMPLE)));
const svgImg = (str, color = '#2b2f33') => new Promise((res) => {
  const im = new Image();
  im.onload = () => res(im); im.onerror = () => res(null);
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str.replace(/currentColor/g, color).replace('<svg ', '<svg width="256" height="192" '));
});
const S = 4096, px = S / B, UP = U * px, CP = C * px;
const cv = document.createElement('canvas'); cv.width = cv.height = S;
const g = cv.getContext('2d');

function fitFont(text, maxW, size, weight = 800) {
  let f = size;
  do { g.font = `${weight} ${f}px Nunito`; if (g.measureText(text).width <= maxW) break; f -= 2; } while (f > 10);
  return f;
}
function lines(text, maxW, size, weight = 800) {
  const words = text.split(' ');
  if (words.length > 1 && fitFont(text, maxW, size, weight) < size * 0.78) return [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')];
  return [text];
}
function drawText(text, x, y, maxW, size, color = '#1c2b38', weight = 800) {
  const ls = lines(text, maxW, size, weight);
  const f = Math.min(...ls.map((l) => fitFont(l, maxW, size, weight)));
  g.font = `${weight} ${f}px Nunito`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  ls.forEach((l, k) => g.fillText(l, x, y + (k - (ls.length - 1) / 2) * f * 1.05));
}
const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

const iconKey = (s) => s.type === 'station' ? (s.name.includes('Liman') ? 'ship' : s.name.includes('Havalimanı') ? 'plane' : 'train') : s.type === 'utility' ? s.icon : s.type === 'tax' ? s.icon : null;

async function paintBoard() {
  // zemin
  g.fillStyle = '#22384b'; g.fillRect(0, 0, S, S);
  // orta alan: deniz
  const ci = CP, cw = S - 2 * CP;
  const grd = g.createRadialGradient(S / 2, S / 2 * 0.9, 50, S / 2, S / 2, cw * 0.75);
  grd.addColorStop(0, '#e9f6fb'); grd.addColorStop(0.5, '#cfe9f4'); grd.addColorStop(1, '#9fd0e6');
  g.fillStyle = grd; g.fillRect(ci, ci, cw, cw);
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 6;
  for (let y = ci + 120; y < ci + cw; y += 150) { g.beginPath(); for (let x = ci; x <= ci + cw; x += 40) g.lineTo(x, y + Math.sin(x / 70) * 14); g.stroke(); }
  // BARON şeridi
  g.save(); g.translate(S / 2, ci + cw * 0.2); g.rotate(-0.04);
  g.fillStyle = '#9d1424'; rr(-560, -150, 1120, 300, 30); g.fill();
  g.fillStyle = '#d7263d'; rr(-540, -170, 1080, 300, 30); g.fill();
  drawText('BARON', 0, -40, 900, 230, '#fff', 900);
  drawText('T Ü R K İ Y E', 0, 85, 700, 70, '#ffe08a', 800);
  g.restore();

  const imgs = {};
  await Promise.all([
    ...Object.entries(ART).map(async ([k, v]) => { imgs['art:' + k] = await svgImg(v); }),
    ...Object.entries(ICON).map(async ([k, v]) => { imgs['ic:' + k] = await svgImg(v); }),
  ]);
  const icon = (k, x, y, w, h, color) => { const im = imgs['ic:' + k]; if (im) g.drawImage(im, x - w / 2, y - h / 2, w, h); };

  for (const s of SQ) {
    const i = s.index; if (i % 10 === 0) continue;
    const c = sqCenter(i), cx = (c.x + B / 2) * px, cy = (c.z + B / 2) * px;
    const sd = sideOf(i), flip = sd === 1 || sd === 2;            // uzak kenarlarda yazılar ters durmasın
    const rot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][sd] + (flip ? Math.PI : 0);
    g.save(); g.translate(cx, cy); g.rotate(rot);
    const w = UP, h = CP, x0 = -w / 2, y0 = -h / 2;
    const Y = (f) => (flip ? -y0 - h * f : y0 + h * f);              // bant her zaman ortaya bakar
    const band = (f0, f1, color) => { g.fillStyle = color; const a = Y(f0), b = Y(f1); g.fillRect(x0 + 4, Math.min(a, b), w - 8, Math.abs(b - a)); };
    g.fillStyle = s.type === 'prop' ? '#fbfdf9' : s.type === 'chance' ? '#fff4e3' : s.type === 'chest' ? '#e8f1fd' : '#f3f7fa';
    g.fillRect(x0 + 4, y0 + 4, w - 8, h - 8);
    const amount = s.price || s.amount;
    if (s.type === 'prop') {
      band(0.012, 0.22, groupColor(s)); band(0.012, 0.06, 'rgba(255,255,255,.28)');
    }
    if (amount) band(0.76, 0.988, s.type === 'tax' ? '#fde3e3' : '#ffeaa6');
    // içerik: bant tarafı tahtanın ortasında, fiyat dış kenarda; yazılar hep izleyiciye dönük
    const yName = flip ? 0.67 : 0.33, yArt = flip ? 0.34 : 0.58, yPrice = flip ? 0.12 : 0.88, yTop = flip ? 0.84 : 0.16;
    if (flip) { // uzak kenar: fiyat üstte, bant altta görünür
      if (amount) drawText(short(amount), 0, y0 + h * yPrice, w - 12, 110, s.type === 'tax' ? '#b3122b' : '#14202b', 900);
    } else if (amount) drawText(short(amount), 0, y0 + h * yPrice, w - 12, 110, s.type === 'tax' ? '#b3122b' : '#14202b', 900);
    if (s.type === 'prop') {
      drawText(s.name.toUpperCase(), 0, y0 + h * (flip ? 0.66 : 0.33), w - 18, 66, '#14202b', 900);
      const im = imgs['art:' + s.name]; if (im) g.drawImage(im, -w * 0.3, y0 + h * yArt - w * 0.225, w * 0.6, w * 0.45);
    } else if (s.type === 'chance') {
      drawText('ŞANS', 0, y0 + h * yTop, w - 20, 62, '#a24f00', 900);
      g.save(); g.font = '900 210px Nunito'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#6b3200'; g.strokeText('?', 0, y0 + h * 0.52); g.fillStyle = '#ef7d00'; g.fillText('?', 0, y0 + h * 0.52); g.restore();
    } else if (s.type === 'chest') {
      drawText('KAMU FONU', 0, y0 + h * yTop, w - 16, 62, '#1d4fb3', 900);
      icon('chest', 0, y0 + h * 0.52, w * 0.62, w * 0.62);
    } else {
      drawText(s.name.toUpperCase(), 0, y0 + h * (flip ? 0.81 : 0.19), w - 16, 58, '#14202b', 900);
      icon(iconKey(s), 0, y0 + h * 0.5, w * 0.5, w * 0.5);
    }
    g.restore();
  }
  // köşeler
  const corner = (i, bg, draw) => {
    const c = sqCenter(i), cx = (c.x + B / 2) * px, cy = (c.z + B / 2) * px;
    g.fillStyle = bg; g.fillRect(cx - CP / 2 + 4, cy - CP / 2 + 4, CP - 8, CP - 8);
    g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 4); draw(); g.restore(); // tüm köşe yazıları izleyiciye dönük
  };
  corner(0, '#ffe6e6', () => { drawText('BAŞLANGIÇ', 0, -50, CP * 1.12, 115, '#d7263d', 900); drawText(`geçişte ${CUR}200K al`, 0, 45, CP * 1.1, 60, '#5b2a2a', 800); icon('arrow', 0, 140, 170, 120); });
  corner(10, '#fff3d6', () => { g.fillStyle = '#f28c28'; g.fillRect(-140, -150, 280, 230); g.fillStyle = '#3b2412'; for (let k = -110; k <= 110; k += 55) g.fillRect(k - 8, -150, 16, 230); drawText('HAPİS', 0, 140, 400, 110, '#3b2412', 900); });
  corner(20, '#e3f7e8', () => { icon('car', 0, -30, 220, 170); drawText('ÜCRETSİZ OTOPARK', 0, 120, CP * 1.12, 100, '#1f7a43', 900); });
  corner(30, '#e8eef5', () => { icon('cuffs', 0, -30, 200, 160); drawText('HAPSE GİR', 0, 120, CP * 1.05, 100, '#1d4fb3', 900); });
  // kareler arası çizgiler
  g.strokeStyle = '#22384b'; g.lineWidth = 8; g.strokeRect(CP, CP, S - 2 * CP, S - 2 * CP);
}
await paintBoard();

// ---------- sahne ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfe3f5');
scene.fog = new THREE.Fog('#bfe3f5', 40, 90);

scene.add(new THREE.HemisphereLight('#ffffff', '#8aa4b8', 1.1));
const sun = new THREE.DirectionalLight('#fff4e0', 1.9);
sun.position.set(-8, 16, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
sun.shadow.bias = -0.0006; sun.shadow.radius = 4;
scene.add(sun);

// zemin (gökyüzü mavisi, gölge alır)
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.18 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.9; ground.receiveShadow = true; scene.add(ground);

// tahta: kalın plaka
const THICK = 0.55;
const slab = new THREE.Mesh(new RoundedBoxGeometry(B + 0.5, THICK, B + 0.5, 4, 0.12), new THREE.MeshStandardMaterial({ color: '#e9eef3', roughness: 0.8 }));
slab.position.y = -THICK / 2 - 0.02; slab.castShadow = true; slab.receiveShadow = true; scene.add(slab);
const base = new THREE.Mesh(new RoundedBoxGeometry(B + 0.7, 0.35, B + 0.7, 4, 0.12), new THREE.MeshStandardMaterial({ color: '#1d4a6e', roughness: 0.6 }));
base.position.y = -THICK - 0.15; base.castShadow = true; scene.add(base);
const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const top = new THREE.Mesh(new THREE.PlaneGeometry(B, B), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
top.rotation.x = -Math.PI / 2; top.receiveShadow = true; scene.add(top);

// orta: kart desteleri
function deck(color, label, x, z, ry) {
  const c2 = document.createElement('canvas'); c2.width = 512; c2.height = 360; const d = c2.getContext('2d');
  d.fillStyle = color; d.fillRect(0, 0, 512, 360);
  d.strokeStyle = 'rgba(255,255,255,.25)'; d.lineWidth = 26; for (let k = -400; k < 900; k += 70) { d.beginPath(); d.moveTo(k, 0); d.lineTo(k + 360, 360); d.stroke(); }
  d.fillStyle = '#fff'; d.font = '900 64px Nunito'; d.textAlign = 'center'; d.textBaseline = 'middle'; d.fillText(label, 256, 190);
  const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace;
  const side = new THREE.MeshStandardMaterial({ color: '#f4f1e8' });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.22, 1.05), [side, side, new THREE.MeshStandardMaterial({ map: t }), side, side, side]);
  m.position.set(x, 0.11, z); m.rotation.y = ry; m.castShadow = true; scene.add(m);
}
deck('#ef8a00', 'ŞANS ?', -1.9, 1.6, 0.6);
deck('#1d5fd0', 'KAMU FONU', 1.9, -1.6, 0.6 + Math.PI);

// ---------- binalar ----------
function house(color) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), mat); body.position.y = 0.08;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.13, 4), new THREE.MeshStandardMaterial({ color: '#b3402a', roughness: 0.6 }));
  roof.position.y = 0.225; roof.rotation.y = Math.PI / 4;
  [body, roof].forEach((m) => { m.castShadow = true; grp.add(m); });
  return grp;
}
function hotel() {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.26), new THREE.MeshStandardMaterial({ color: '#d91e2a', roughness: 0.45 }));
  body.position.y = 0.21; body.castShadow = true; grp.add(body);
  const win = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffd25e', emissiveIntensity: 0.4 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.01), win); w.position.set(-0.18 + c * 0.12, 0.14 + r * 0.14, 0.131); grp.add(w); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: '#7a0f18' })); roof.position.y = 0.445; grp.add(roof);
  return grp;
}
const buildings = {};
function setBuildings(i, n) {
  if (buildings[i]) scene.remove(buildings[i]);
  if (!n) return;
  const grp = new THREE.Group(), c = sqCenter(i), inw = inward(i);
  const bandCenter = c.clone().addScaledVector(inw, C * 0.4);
  const along = new THREE.Vector3(-inw.z, 0, inw.x);
  if (n === 5) { const h = hotel(); h.position.copy(bandCenter); h.rotation.y = Math.atan2(inw.x, inw.z); grp.add(h); }
  else for (let k = 0; k < n; k++) { const h = house('#1aa34d'); h.position.copy(bandCenter).addScaledVector(along, (k - (n - 1) / 2) * 0.19); grp.add(h); }
  scene.add(grp); buildings[i] = grp;
}

// sahip işareti: karenin dış kenarında renkli şerit
const flags = {};
function setOwner(i, color) {
  if (flags[i]) scene.remove(flags[i]);
  const c = sqCenter(i), inw = inward(i);
  const m = new THREE.Mesh(new THREE.BoxGeometry(inw.x ? 0.06 : U * 0.86, 0.03, inw.z ? 0.06 : U * 0.86), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25 }));
  m.position.copy(c).addScaledVector(inw, -C * 0.47); m.position.y = 0.016; scene.add(m); flags[i] = m;
}

// ---------- piyonlar ----------
function pawnMesh(color) {
  const pts = [[0, 0], [0.26, 0], [0.27, 0.04], [0.24, 0.08], [0.17, 0.11], [0.13, 0.2], [0.095, 0.42], [0.15, 0.46], [0.15, 0.5], [0.07, 0.53], [0, 0.53]].map(([x, y]) => new THREE.Vector2(x, y));
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.05 });
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 32, 20), mat); head.position.y = 0.64;
  [body, head].forEach((m) => { m.castShadow = true; grp.add(m); });
  grp.scale.setScalar(1.15);
  return grp;
}
const PLAYERS = [
  { name: 'Sen', color: '#e63946', cash: 1500000, human: true },
  { name: 'Bot Ayşe', color: '#2a9d8f', cash: 1500000 },
  { name: 'Bot Kemal', color: '#1d7cf2', cash: 1500000 },
  { name: 'Bot Mehmet', color: '#f4a261', cash: 1500000 },
];
PLAYERS.forEach((p) => { p.pos = 0; p.mesh = pawnMesh(p.color); scene.add(p.mesh); });
function pawnSpot(p, i) {
  const here = PLAYERS.filter((q) => q.pos === i), k = here.indexOf(p), n = here.length;
  const c = sqCenter(i);
  if (n > 1) { const a = (k / n) * Math.PI * 2; c.x += Math.cos(a) * 0.2; c.z += Math.sin(a) * 0.2; }
  return c;
}
const placeAll = () => PLAYERS.forEach((p) => { if (!p.moving) p.mesh.position.copy(pawnSpot(p, p.pos)); });
placeAll();

// örnek binalar (görünüm için)
const OWN = {};
[[39, 2, 5], [37, 2, 3], [34, 1, 2], [31, 1, 1], [16, 3, 1], [21, 3, 0], [23, 3, 0]].forEach(([i, pi, n]) => { OWN[i] = pi; setOwner(i, PLAYERS[pi].color); setBuildings(i, n); });

// ---------- zarlar ----------
function pipTex(n) {
  const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const d = c2.getContext('2d');
  d.fillStyle = '#c8102e'; d.fillRect(0, 0, 128, 128); d.fillStyle = '#fff';
  const P = { 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] }[n];
  P.forEach(([x, y]) => { d.beginPath(); d.arc(x, y, 11, 0, 7); d.fill(); });
  const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FACE = [3, 4, 1, 6, 2, 5]; // +x -x +y -y +z -z
const dieMats = FACE.map((n) => new THREE.MeshStandardMaterial({ map: pipTex(n), roughness: 0.35 }));
const dice = [0, 1].map((k) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.09), dieMats); m.castShadow = true; m.position.set((k ? 0.55 : -0.55) - 0.6, 0.31, -0.6); scene.add(m); return m; });
const UPROT = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] };
function finalQuat(v, yaw) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...UPROT[v]));
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(q);
}
dice.forEach((d, k) => d.quaternion.copy(finalQuat(k ? 5 : 3, 0.3)));

const tweens = [];
const tween = (dur, fn) => new Promise((res) => tweens.push({ t: 0, dur, fn, res }));
const ease = (t) => 1 - Math.pow(1 - t, 3);

async function rollDice() {
  const vals = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
  await Promise.all(dice.map(async (d, k) => {
    const from = d.position.clone(), to = new THREE.Vector3((k ? 0.6 : -0.6) - 0.6 + (Math.random() - 0.5) * 0.5, 0.31, -0.6 + (Math.random() - 0.5) * 0.6);
    const spin = new THREE.Vector3(Math.random() * 14 + 10, Math.random() * 10, Math.random() * 14 + 10);
    const endQ = finalQuat(vals[k], Math.random() * Math.PI * 2), startQ = d.quaternion.clone();
    await tween(1100 + k * 120, (t) => {
      const e = ease(t);
      d.position.lerpVectors(from, to, e);
      d.position.y = 0.31 + Math.abs(Math.sin(t * Math.PI * 2.2)) * 2.2 * (1 - t);
      if (t < 0.75) d.rotation.set(spin.x * t, spin.y * t, spin.z * t);
      else { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(spin.x * 0.75, spin.y * 0.75, spin.z * 0.75)); d.quaternion.slerpQuaternions(q, endQ, (t - 0.75) / 0.25); }
    });
    d.quaternion.copy(endQ);
  }));
  return vals;
}

// ---------- kamera (izometrik, tahta 45° dönük) ----------
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const ISO_EL = 34 * Math.PI / 180, ISO_AZ = Math.PI / 4;
const camDir = new THREE.Vector3(Math.sin(ISO_AZ) * Math.cos(ISO_EL), Math.sin(ISO_EL), Math.cos(ISO_AZ) * Math.cos(ISO_EL));
const view = { target: new THREE.Vector3(), zoom: 1, wantTarget: new THREE.Vector3(), wantZoom: 1, follow: false };
let fitHalfH = 6;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  // tahtanın (çapraz) görünen genişliği/yüksekliği: köşegen ≈ B·√2, yükseklik ≈ köşegen·sin(el) + kalınlık
  const diag = (B + 0.7) * Math.SQRT2;
  const needW = diag * 1.02, needH = diag * Math.sin(ISO_EL) + 1.6;
  const usable = (h - 12) / h;   // oyuncu kartları köşelerde; elmas tahtanın tepe ve dip noktaları ortada
  fitHalfH = Math.max(needH / 2 / usable, needW / 2 / (w / h));
  camera.left = -fitHalfH * w / h; camera.right = fitHalfH * w / h; camera.top = fitHalfH; camera.bottom = -fitHalfH;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
function updateCam() {
  camera.zoom = view.zoom; camera.updateProjectionMatrix();
  camera.position.copy(view.target).addScaledVector(camDir, 40);
  camera.lookAt(view.target);
}
function focusOn(p) {
  if (view.follow && p) { view.wantTarget.copy(p.mesh.position); view.wantTarget.y = 0; view.wantZoom = 1.9; }
  else { view.wantTarget.set(0, 0, 0); view.wantZoom = 1; }
}
$('#camFollow').onclick = () => { view.follow = true; $('#camFollow').classList.add('on'); $('#camAll').classList.remove('on'); focusOn(PLAYERS[turn]); };
$('#camAll').onclick = () => { view.follow = false; $('#camAll').classList.add('on'); $('#camFollow').classList.remove('on'); focusOn(null); };
// dikey ekranda tahta küçük kalacağı için piyonu yakından izleyerek başla
if (innerHeight > innerWidth) { view.follow = true; } else { $('#camFollow').classList.remove('on'); $('#camAll').classList.add('on'); }

// parmakla kaydırma / iki parmakla yakınlaştırma
const ptrs = new Map(); let pinch0 = 0, zoom0 = 1;
canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.wantZoom; } });
canvas.addEventListener('pointermove', (e) => {
  const prev = ptrs.get(e.pointerId); if (!prev) return;
  const cur = { x: e.clientX, y: e.clientY }; ptrs.set(e.pointerId, cur);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; view.wantZoom = Math.min(3, Math.max(0.8, zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0)); return; }
  if (view.wantZoom <= 1.02) return;
  const k = (fitHalfH * 2 / innerHeight) / view.zoom;
  const right = new THREE.Vector3(Math.cos(ISO_AZ), 0, -Math.sin(ISO_AZ)), fwd = new THREE.Vector3(-Math.sin(ISO_AZ), 0, -Math.cos(ISO_AZ));
  view.wantTarget.addScaledVector(right, -(cur.x - prev.x) * k).addScaledVector(fwd, (cur.y - prev.y) * k / Math.sin(ISO_EL));
  view.wantTarget.clampLength(0, 6);
});
const up = (e) => ptrs.delete(e.pointerId);
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { view.wantZoom = Math.min(3, Math.max(0.8, view.wantZoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: true });

// ---------- HUD ----------
function renderHud() {
  $('#players').innerHTML = PLAYERS.map((p, k) => `<div class="pl c${k} ${k === turn ? 'turn' : ''}"><i style="background:${p.color}"></i>${p.name}<b>${fmt(p.cash)}</b></div>`).join('');
}
const info = (t) => { $('#info').innerHTML = t; };
function showCard(s) {
  const el = $('#card');
  el.innerHTML = `<div class="h" style="background:${s.type === 'prop' ? groupColor(s) : '#3b4046'}"><small>TAPU SENEDİ</small>${s.name}</div><div class="bd">Fiyat <b>${fmt(s.price)}</b>${s.rent ? ` · Kira <b>${fmt(s.rent[0])}</b>` : ''}</div>`;
  el.classList.add('show');
}
const hideCard = () => $('#card').classList.remove('show');
function actions(list) {
  return new Promise((res) => {
    $('#act').innerHTML = list.map(([k, label, cls]) => `<button class="big ${cls || ''}" data-k="${k}">${label}</button>`).join('');
    $('#act').querySelectorAll('button').forEach((b) => { b.onclick = () => { $('#act').innerHTML = ''; res(b.dataset.k); }; });
  });
}

// ---------- tur akışı (önizleme) ----------
let turn = 0;
async function movePawn(p, steps) {
  p.moving = true;
  for (let k = 0; k < steps; k++) {
    const from = p.mesh.position.clone();
    p.pos = (p.pos + 1) % 40;
    if (p.pos === 0) { p.cash += 200000; renderHud(); }
    const to = pawnSpot(p, p.pos);
    await tween(230, (t) => { p.mesh.position.lerpVectors(from, to, t); p.mesh.position.y = Math.sin(t * Math.PI) * 0.45; });
    if (view.follow) focusOn(p);
  }
  p.mesh.position.y = 0; p.moving = false; placeAll();
}
async function playTurn() {
  const p = PLAYERS[turn]; renderHud();
  focusOn(p);
  if (p.human) { info('Sıra sende!'); await actions([['roll', 'Zar At']]); } else { info(`${p.name} zar atıyor…`); await sleep(700); }
  const [a, b] = await rollDice();
  info(`${p.name}: ${a} + ${b} = ${a + b}`);
  await sleep(250);
  await movePawn(p, a + b);
  const s = SQ[p.pos];
  if ((s.type === 'prop' || s.type === 'station' || s.type === 'utility') && OWN[p.pos] === undefined) {
    showCard(s);
    let buy;
    if (p.human) buy = (await actions([['buy', `Satın Al ${fmt(s.price)}`, 'green'], ['pass', 'Geç', 'ghost']])) === 'buy' && p.cash >= s.price;
    else { await sleep(1100); buy = p.cash - s.price > 300000; }
    hideCard();
    if (buy) { p.cash -= s.price; OWN[p.pos] = turn; setOwner(p.pos, p.color); info(`${p.name}, ${s.name} aldı!`); }
  } else if (OWN[p.pos] !== undefined && OWN[p.pos] !== turn && s.rent) {
    const rent = s.rent[0] * 3; p.cash -= rent; PLAYERS[OWN[p.pos]].cash += rent; info(`${p.name} → ${PLAYERS[OWN[p.pos]].name}: ${fmt(rent)} kira`);
  } else info(`${p.name} → ${s.name}`);
  renderHud();
  await sleep(p.human ? 500 : 900);
  turn = (turn + 1) % PLAYERS.length;
  playTurn();
}

// ---------- döngü ----------
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  for (let k = tweens.length - 1; k >= 0; k--) { const tw = tweens[k]; tw.t = Math.min(1, tw.t + dt * 1000 / tw.dur); tw.fn(tw.t); if (tw.t >= 1) { tweens.splice(k, 1); tw.res(); } }
  const f = 1 - Math.exp(-dt * 4);
  view.target.lerp(view.wantTarget, f); view.zoom += (view.wantZoom - view.zoom) * f;
  // sırası gelen piyon hafifçe zıplasın
  PLAYERS.forEach((p, k) => { if (!p.moving) p.mesh.position.y = k === turn ? Math.abs(Math.sin(now / 300)) * 0.06 : 0; });
  updateCam();
  renderer.render(scene, camera);
});
$('#loading').remove();
renderHud();
playTurn();
