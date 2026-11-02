// Baron Türkiye — 3D tahta görünümü (three.js). Oyun mantığı app.js'te; bu modül yalnız çizer.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { makeToken } from './tokens.js';

const CUR = '฿';
const mix = (a, b, t) => { const ca = new THREE.Color(a), cb = new THREE.Color(b); return '#' + ca.lerp(cb, t).getHexString(); };
const short = (n) => `${n >= 1e6 ? (n / 1e6).toLocaleString('tr-TR') + 'M' : Math.round(n / 1000) + 'K'}`;
const B = 10, U = B / 12.6, C = 1.8 * U, ROAD = 0.3;                 // tahta kenarı, kare genişliği, köşe kare
const sideOf = (i) => (i < 10 ? 0 : i < 20 ? 1 : i < 30 ? 2 : 3); // 0 alt(+z) 1 sol(-x) 2 üst(-z) 3 sağ(+x)
const INWARD = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function sqCenter(i) {
  const h = B / 2, k = i % 10, s = sideOf(i);
  const along = k === 0 ? h - C / 2 : h - C - (k - 0.5) * U, edge = h - C / 2;
  if (s === 0) return new THREE.Vector3(along, 0, edge);
  if (s === 1) return new THREE.Vector3(-edge, 0, along);
  if (s === 2) return new THREE.Vector3(-along, 0, -edge);
  return new THREE.Vector3(edge, 0, -along);
}
const sqSize = (i) => (i % 10 === 0 ? [C, C] : sideOf(i) % 2 === 0 ? [U, C] : [C, U]); // [x genişliği, z derinliği]
const inward = (i) => new THREE.Vector3(INWARD[sideOf(i)][0], 0, INWARD[sideOf(i)][1]);

// ---------------------------------------------------------------- tahta dokusu
async function paintBoard(S, squares, groups, ART, ICON) {
  const SAMPLE = 'ABCabc0123 İŞĞÜÖÇışğüöç฿';
  try { await Promise.all(['700', '800', '900'].map((w) => document.fonts.load(`${w} 40px Nunito`, SAMPLE))); } catch { /* yazı tipi yoksa da çiz */ }
  const L = 4096, px = L / B, UP = U * px, CP = C * px;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.setTransform(S / L, 0, 0, S / L, 0, 0);              // her şey 4096'lık mantıksal düzlemde çizilir
  const svgImg = (str, color = '#2b2f33') => new Promise((res) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null);
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str.replace(/currentColor/g, color).replace('<svg ', '<svg width="256" height="192" '));
  });
  const fitFont = (text, maxW, size, weight) => { let f = size; do { g.font = `${weight} ${f}px Nunito`; if (g.measureText(text).width <= maxW) break; f -= 2; } while (f > 10); return f; };
  const drawText = (text, x, y, maxW, size, color = '#1c2b38', weight = 800) => {
    const words = text.split(' ');
    const ls = words.length > 1 && fitFont(text, maxW, size, weight) < size * 0.78 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [text];
    const f = Math.min(...ls.map((l) => fitFont(l, maxW, size, weight)));
    g.font = `${weight} ${f}px Nunito`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    ls.forEach((l, k) => g.fillText(l, x, y + (k - (ls.length - 1) / 2) * f * 1.05));
  };
  const groupColor = (s) => (s.group ? groups[s.group].color : '#8a8a8a');
  const iconKey = (s) => (s.type === 'station' ? (s.name.includes('Liman') ? 'ship' : s.name.includes('Havalimanı') ? 'plane' : 'train') : s.icon);

  g.fillStyle = '#22384b'; g.fillRect(0, 0, L, L);
  const ci = CP, cw = L - 2 * CP;
  const grd = g.createRadialGradient(L / 2, L / 2 * 0.9, 50, L / 2, L / 2, cw * 0.75);
  grd.addColorStop(0, '#e9f6fb'); grd.addColorStop(0.5, '#cfe9f4'); grd.addColorStop(1, '#9fd0e6');
  g.fillStyle = grd; g.fillRect(ci, ci, cw, cw);
  // karelerle deniz arasında asfalt yol (beyaz kesikli şeritli, kaldırımlı)
  const RW = ROAD * px;
  g.fillStyle = '#d9dee3'; g.fillRect(ci, ci, cw, cw);
  g.fillStyle = '#5b646c'; g.fillRect(ci + 10, ci + 10, cw - 20, cw - 20);
  g.fillStyle = grd; g.fillRect(ci + RW, ci + RW, cw - 2 * RW, cw - 2 * RW);
  g.fillStyle = '#d9dee3'; g.fillRect(ci + RW - 10, ci + RW - 10, cw - 2 * RW + 20, 10); g.fillRect(ci + RW - 10, L - ci - RW, cw - 2 * RW + 20, 10); g.fillRect(ci + RW - 10, ci + RW - 10, 10, cw - 2 * RW + 20); g.fillRect(L - ci - RW, ci + RW - 10, 10, cw - 2 * RW + 20);
  g.fillStyle = grd; g.fillRect(ci + RW, ci + RW, cw - 2 * RW, cw - 2 * RW);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 9; g.setLineDash([44, 34]);
  g.strokeRect(ci + RW / 2, ci + RW / 2, cw - RW, cw - RW); g.setLineDash([]);
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 6;
  for (let y = ci + 120; y < ci + cw; y += 150) { g.beginPath(); for (let x = ci; x <= ci + cw; x += 40) g.lineTo(x, y + Math.sin(x / 70) * 14); g.stroke(); }
  // BARON şeridi (izleyiciye dönük: 45° eğik)
  g.save(); g.translate(L / 2, L / 2); g.rotate(-Math.PI / 4); g.translate(0, -cw * 0.3);
  g.fillStyle = '#9d1424'; g.beginPath(); g.roundRect(-560, -150, 1120, 300, 30); g.fill();
  g.fillStyle = '#d7263d'; g.beginPath(); g.roundRect(-540, -170, 1080, 300, 30); g.fill();
  drawText('BARON', 0, -40, 900, 230, '#fff', 900);
  drawText('T Ü R K İ Y E', 0, 85, 700, 70, '#ffe08a', 800);
  g.restore();

  const imgs = {};
  await Promise.all([
    ...Object.entries(ART).map(async ([k, v]) => { imgs['art:' + k] = await svgImg(v); }),
    ...Object.entries(ICON).map(async ([k, v]) => { imgs['ic:' + k] = await svgImg(v); }),
  ]);
  const icon = (k, x, y, w, h) => { const im = imgs['ic:' + k]; if (im) g.drawImage(im, x - w / 2, y - h / 2, w, h); };
  // çizimler yuvarlak, hafif gölgeli bir madalyonun içinde dursun
  const medal = (x, y, r, tint) => {
    g.save();
    g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 18; g.shadowOffsetY = 6;
    const rg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.7, tint ? mix('#fbfaf4', tint, 0.1) : '#f6f3e8'); rg.addColorStop(1, tint ? mix('#f1ead6', tint, 0.28) : '#e9e2cc');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.restore();
    g.save(); g.lineWidth = 5; g.strokeStyle = tint ? mix('#ffffff', tint, 0.55) : '#d9cfae'; g.beginPath(); g.arc(x, y, r - 3, 0, Math.PI * 2); g.stroke(); g.restore();
  };
  const artIn = (im, x, y, wd) => { if (!im) return; g.save(); g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 10; g.shadowOffsetY = 5; g.drawImage(im, x - wd / 2, y - wd * 0.375, wd, wd * 0.75); g.restore(); };

  for (const s of squares) {
    const i = s.index; if (i % 10 === 0) continue;
    const c = sqCenter(i), cx = (c.x + B / 2) * px, cy = (c.z + B / 2) * px;
    const sd = sideOf(i), flip = sd === 1 || sd === 2;            // uzak kenarlarda yazılar ters durmasın
    g.save(); g.translate(cx, cy); g.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][sd] + (flip ? Math.PI : 0));
    const w = UP, h = CP, x0 = -w / 2, y0 = -h / 2;
    const Y = (f) => (flip ? -y0 - h * f : y0 + h * f);
    const band = (f0, f1, color) => { g.fillStyle = color; const a = Y(f0), b = Y(f1); g.fillRect(x0 + 4, Math.min(a, b), w - 8, Math.abs(b - a)); };
    g.fillStyle = s.type === 'prop' ? '#fbfdf9' : s.type === 'chance' ? '#fff4e3' : s.type === 'chest' ? '#e8f1fd' : '#f3f7fa';
    g.fillRect(x0 + 4, y0 + 4, w - 8, h - 8);
    const amount = s.price || s.amount;
    if (s.type === 'prop') { band(0.012, 0.22, groupColor(s)); band(0.012, 0.06, 'rgba(255,255,255,.28)'); }
    if (amount) band(0.76, 0.988, s.type === 'tax' ? '#fde3e3' : '#ffeaa6');
    const yTop = flip ? 0.84 : 0.16;
    if (amount) drawText(short(amount), 0, y0 + h * (flip ? 0.12 : 0.88), w - 30, 92, s.type === 'tax' ? '#b3122b' : '#14202b', 900);
    if (s.type === 'prop') {
      drawText(s.name.toUpperCase(), 0, y0 + h * (flip ? 0.69 : 0.31), w - 30, 56, '#14202b', 900);
      const yc = y0 + h * (flip ? 0.4 : 0.6);
      medal(0, yc, h * 0.165, groupColor(s));
      artIn(imgs['art:' + s.name], 0, yc, w * 0.66);
    } else if (s.type === 'chance') {
      drawText('ŞANS', 0, y0 + h * yTop, w - 30, 54, '#a24f00', 900);
      medal(0, y0 + h * 0.52, h * 0.17, '#ef8a00');
      g.save(); g.font = '900 190px Nunito'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#6b3200'; g.strokeText('?', 0, y0 + h * 0.52); g.fillStyle = '#ef7d00'; g.fillText('?', 0, y0 + h * 0.52); g.restore();
    } else if (s.type === 'chest') {
      drawText('KAMU FONU', 0, y0 + h * yTop, w - 26, 50, '#1d4fb3', 900);
      medal(0, y0 + h * 0.52, h * 0.17, '#1d5fd0'); icon('chest', 0, y0 + h * 0.52, w * 0.5, w * 0.5);
    } else {
      drawText(s.name.toUpperCase(), 0, y0 + h * (flip ? 0.81 : 0.19), w - 26, 50, '#14202b', 900);
      medal(0, y0 + h * 0.5, h * 0.16, s.type === 'tax' ? '#d7263d' : null); icon(iconKey(s), 0, y0 + h * 0.5, w * 0.44, w * 0.44);
    }
    g.restore();
  }
  const corner = (i, bg, draw) => {
    const c = sqCenter(i), cx = (c.x + B / 2) * px, cy = (c.z + B / 2) * px;
    g.fillStyle = bg; g.fillRect(cx - CP / 2 + 4, cy - CP / 2 + 4, CP - 8, CP - 8);
    g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 4); draw(); g.restore();
  };
  // köşe kare 45° döndürülmüş yazılır; satırın genişliği köşegene olan uzaklığa göre daralır
  const cText = (text, x, y, size, color, weight = 900, half = false) => {
    const room = CP * Math.SQRT2 - 2 * (Math.abs(y) + size * 0.55) - 60;
    drawText(text, x, y, Math.max(60, half ? room / 2 - 20 : room), size, color, weight);
  };
  corner(0, '#ffe6e6', () => { cText('BAŞLANGIÇ', 0, 110, 84, '#d7263d'); cText(`geçişte ${CUR}200K al`, 0, 180, 42, '#5b2a2a', 800); });
  corner(10, '#fff3d6', () => { cText('HAPİS', 105, 120, 66, '#3b2412', 900, true); cText('ZİYARET', -105, 120, 46, '#7a5a3a', 800, true); });
  corner(20, '#e3f7e8', () => { cText('ÜCRETSİZ', 0, 100, 66, '#1f7a43'); cText('OTOPARK', 0, 175, 66, '#1f7a43'); });
  corner(30, '#e8eef5', () => { cText('HAPSE', 0, 100, 76, '#1d4fb3'); cText('GİR', 0, 180, 76, '#1d4fb3'); });
  g.strokeStyle = '#22384b'; g.lineWidth = 8; g.strokeRect(CP, CP, L - 2 * CP, L - 2 * CP);
  return cv;
}

// ---------------------------------------------------------------- binalar
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
function roofGeo(w, d, h) {          // üçgen çatı (iki eğimli)
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
}
function houseMesh(roof = '#d1453b', k = 0) {
  const grp = new THREE.Group();
  const walls = ['#fff7e8', '#f4ead2', '#eef3f7'][k % 3];
  const put = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
  put(new THREE.BoxGeometry(0.17, 0.13, 0.15), M(walls), 0, 0.065, 0);
  put(roofGeo(0.21, 0.19, 0.1), M(roof, { roughness: 0.45 }), 0, 0.13, 0);
  put(new THREE.BoxGeometry(0.03, 0.06, 0.03), M('#8a5a44'), 0.05, 0.215, -0.03);                 // baca
  put(new THREE.BoxGeometry(0.04, 0.065, 0.005), M('#7b4a2e'), 0, 0.034, 0.076);                   // kapı
  const glass = M('#9fd8ff', { emissive: '#3a6f9a', emissiveIntensity: 0.15, roughness: 0.2 });
  put(new THREE.BoxGeometry(0.035, 0.035, 0.005), glass, -0.05, 0.08, 0.076);
  put(new THREE.BoxGeometry(0.035, 0.035, 0.005), glass, 0.05, 0.08, 0.076);
  grp.scale.setScalar(1.15);
  return grp;
}
function hotelMesh(roof = '#d1453b') {
  const grp = new THREE.Group();
  const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
  put(new THREE.BoxGeometry(0.5, 0.06, 0.3), M('#d9dee3'), 0, 0.03, 0);                              // kaide
  put(new THREE.BoxGeometry(0.44, 0.38, 0.24), M('#fffaf0'), 0, 0.25, 0);                            // gövde
  put(new THREE.BoxGeometry(0.48, 0.05, 0.28), M(roof, { roughness: 0.4 }), 0, 0.465, 0);             // çatı
  put(new THREE.BoxGeometry(0.16, 0.08, 0.12), M(roof, { roughness: 0.4 }), 0, 0.53, 0);              // çatı katı
  const glass = M('#9fd8ff', { emissive: '#ffd25e', emissiveIntensity: 0.25, roughness: 0.2 });
  for (const zs of [1, -1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) put(new THREE.BoxGeometry(0.06, 0.06, 0.006), glass, -0.15 + c * 0.1, 0.13 + r * 0.1, 0.122 * zs);
  put(new THREE.BoxGeometry(0.2, 0.025, 0.07), M(roof), 0, 0.12, 0.15);                               // giriş saçağı
  put(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), M('#9aa3ab'), 0.18, 0.6, 0);                  // bayrak direği
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), M(roof, { side: THREE.DoubleSide })); flag.position.set(0.23, 0.67, 0); grp.add(flag);
  return grp;
}
function flagMesh(color) {      // sahibi olan boş arsada küçük bayrak
  const grp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), M('#e8ecef', { metalness: 0.3 })); pole.position.y = 0.16; pole.castShadow = true; grp.add(pole);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.09, 6, 1), M(color, { side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.15 })); f.position.set(0.077, 0.27, 0); f.castShadow = true; grp.add(f);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.02, 12), M('#9aa3ab')); base.position.y = 0.01; grp.add(base);
  grp.userData.flag = f;
  return grp;
}

// ---------------------------------------------------------------- tahta süsleri
function treeMesh(k) {
  const grp = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 8), M('#7b4a2e')); trunk.position.y = 0.08; trunk.castShadow = true; grp.add(trunk);
  const green = ['#2f9e44', '#40c057', '#2b8a3e'][k % 3];
  if (k % 2) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 10), M(green)); c.position.y = 0.3; c.castShadow = true; grp.add(c); }
  else { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), M(green, { flatShading: true })); c.position.y = 0.27; c.castShadow = true; grp.add(c); }
  return grp;
}
function signTex(draw, w = 256, h = 128) {
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; draw(c2.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function landmark(kind) {
  const grp = new THREE.Group();
  const put = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
  if (kind === 'go') {            // başlangıç kapısı
    for (const x of [-0.26, 0.26]) put(new THREE.CylinderGeometry(0.035, 0.04, 0.5, 12), M('#ffffff'), x, 0.25, 0);
    const t = signTex((d, w, h) => { d.fillStyle = '#d7263d'; d.fillRect(0, 0, w, h); d.fillStyle = '#fff'; d.font = '900 64px Nunito'; d.textAlign = 'center'; d.textBaseline = 'middle'; d.fillText('BAŞLA', w / 2, h / 2 + 4); });
    const side = M('#b5182b');
    put(new THREE.BoxGeometry(0.64, 0.14, 0.06), [side, side, side, side, M('#ffffff', { map: t }), M('#ffffff', { map: t })], 0, 0.52, 0);
    for (const x of [-0.26, 0.26]) { const f = put(new THREE.ConeGeometry(0.04, 0.12, 4), M('#f2b632'), x, 0.65, 0); f.rotation.y = Math.PI / 4; }
  } else if (kind === 'jail') {   // hapishane binası
    put(new THREE.BoxGeometry(0.56, 0.36, 0.4), M('#a7b0b8', { roughness: 0.9 }), 0, 0.18, 0);
    put(new THREE.BoxGeometry(0.6, 0.05, 0.44), M('#5b646c'), 0, 0.385, 0);
    put(new THREE.BoxGeometry(0.3, 0.2, 0.01), M('#2b2f33'), 0, 0.18, 0.201);
    for (let k = 0; k < 6; k++) put(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), M('#d9dee3', { metalness: 0.5, roughness: 0.3 }), -0.125 + k * 0.05, 0.18, 0.21);
    const t = signTex((d, w, h) => { d.fillStyle = '#f28c28'; d.fillRect(0, 0, w, h); d.fillStyle = '#3b2412'; d.font = '900 66px Nunito'; d.textAlign = 'center'; d.textBaseline = 'middle'; d.fillText('HAPİS', w / 2, h / 2 + 4); });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), M('#fff', { map: t })); sg.position.set(0, 0.33, 0.202); grp.add(sg);
    for (const x of [-0.24, 0.24]) put(new THREE.BoxGeometry(0.08, 0.46, 0.08), M('#8e979f'), x, 0.23, 0.18);   // kuleler
  } else if (kind === 'parking') { // otopark tabelası + park etmiş arabalar
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), M('#9aa3ab'), -0.24, 0.21, 0);
    const t = signTex((d, w, h) => { d.fillStyle = '#1d5fd0'; d.beginPath(); d.roundRect(4, 4, w - 8, h - 8, 26); d.fill(); d.fillStyle = '#fff'; d.font = '900 200px Nunito'; d.textAlign = 'center'; d.textBaseline = 'middle'; d.fillText('P', w / 2, h / 2 + 10); }, 256, 256);
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), M('#fff', { map: t, side: THREE.DoubleSide })); sg.position.set(-0.24, 0.45, 0.015); grp.add(sg);
    grp.userData.cars = true;
  } else if (kind === 'police') {  // polis kulübesi, tepesinde yanıp sönen siren
    put(new THREE.BoxGeometry(0.34, 0.34, 0.3), M('#1d4fb3'), 0, 0.17, 0);
    put(new THREE.BoxGeometry(0.35, 0.06, 0.31), M('#ffffff'), 0, 0.24, 0);
    put(new THREE.BoxGeometry(0.4, 0.04, 0.36), M('#0f2f6e'), 0, 0.36, 0);
    put(new THREE.BoxGeometry(0.12, 0.18, 0.01), M('#9fd8ff', { roughness: 0.2 }), 0.06, 0.12, 0.151);
    const red = put(new THREE.SphereGeometry(0.045, 14, 10), M('#ff2d3c', { emissive: '#ff0018', emissiveIntensity: 1 }), -0.06, 0.41, 0);
    const blue = put(new THREE.SphereGeometry(0.045, 14, 10), M('#2d7dff', { emissive: '#0050ff', emissiveIntensity: 0.2 }), 0.06, 0.41, 0);
    grp.userData.siren = [red, blue];
  }
  return grp;
}
// ---------------------------------------------------------------- zarlar
function pipTex(n) {
  const c2 = document.createElement('canvas'); c2.width = c2.height = 128; const d = c2.getContext('2d');
  d.fillStyle = '#c8102e'; d.fillRect(0, 0, 128, 128); d.fillStyle = '#fff';
  ({ 1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]], 4: [[36, 36], [92, 36], [36, 92], [92, 92]], 5: [[34, 34], [94, 34], [64, 64], [34, 94], [94, 94]], 6: [[36, 30], [92, 30], [36, 64], [92, 64], [36, 98], [92, 98]] })[n]
    .forEach(([x, y]) => { d.beginPath(); d.arc(x, y, 11, 0, 7); d.fill(); });
  const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const FACE = [3, 4, 1, 6, 2, 5]; // +x -x +y -y +z -z
const UPROT = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2] };
const dieQuat = (v, yaw) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...UPROT[v])));

// ---------------------------------------------------------------- görünüm
export async function createView(canvas, { squares, groups, ART, ICON, onPick }) {
  const small = Math.min(screen.width, screen.height) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2.5, Math.max(1.5, devicePixelRatio)));   // 1x ekranlarda da kenar yumuşatma için 1.5x çiz
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();

  scene.add(new THREE.HemisphereLight('#ffffff', '#8aa4b8', 1.1));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.9);
  sun.position.set(-8, 16, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.18 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.9; ground.receiveShadow = true; scene.add(ground);

  const THICK = 0.55;
  const slab = new THREE.Mesh(new RoundedBoxGeometry(B + 0.5, THICK, B + 0.5, 4, 0.12), new THREE.MeshStandardMaterial({ color: '#e9eef3', roughness: 0.8 }));
  slab.position.y = -THICK / 2 - 0.02; slab.castShadow = true; slab.receiveShadow = true; scene.add(slab);
  const base = new THREE.Mesh(new RoundedBoxGeometry(B + 0.7, 0.35, B + 0.7, 4, 0.12), new THREE.MeshStandardMaterial({ color: '#1d4a6e', roughness: 0.6 }));
  base.position.y = -THICK - 0.15; base.castShadow = true; scene.add(base);
  const maxTex = renderer.capabilities.maxTextureSize || 4096;
  const tcv = await paintBoard(Math.min(4096, maxTex), squares, groups, ART, ICON);
  const tex = new THREE.CanvasTexture(tcv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const top = new THREE.Mesh(new THREE.PlaneGeometry(B, B), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
  top.rotation.x = -Math.PI / 2; top.receiveShadow = true; scene.add(top);

  // köşe yapıları (köşe karenin arka yarısında, piyonları kapatmasın)
  const sirens = [];
  [[0, 'go'], [10, 'jail'], [20, 'parking'], [30, 'police']].forEach(([i, kind]) => {
    const lm = landmark(kind), c = sqCenter(i);
    // yapı köşenin arka ucunda; karakterler önde durur, yapının içinde kaybolmaz
    lm.position.set(c.x - 0.44, 0, c.z - 0.44); lm.rotation.y = Math.PI / 4;
    lm.scale.setScalar(kind === 'jail' ? 1.0 : 1.1);
    scene.add(lm);
    if (lm.userData.siren) sirens.push(lm.userData.siren);
    if (lm.userData.cars) ['#e9ecef', '#ffd43b'].forEach((col, k) => { const car = makeToken('araba', col); car.scale.setScalar(0.8); car.position.set(c.x - 0.18 + (k ? 0.42 : -0.42) * 0.707, 0, c.z - 0.18 - (k ? 0.42 : -0.42) * 0.707); car.rotation.y = Math.PI / 4 + (k ? 0.2 : -0.1); scene.add(car); });
  });
  // tahta ortasının köşelerinde ağaç kümeleri
  const inner = B / 2 - C - ROAD - 0.32;
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], q) => {
    [[0, 0], [0.32, -0.05], [0.05, 0.3]].forEach(([dx, dz], k) => {
      const t = treeMesh(q + k); t.position.set(sx * (inner - dx), 0, sz * (inner - dz)); t.scale.setScalar(0.9 + ((q * 3 + k) % 3) * 0.15); scene.add(t);
    });
  });

  // kart desteleri: üst üste birkaç yuvarlak köşeli kart, en üstte desenli yüz
  const decks = {};
  function deckFace(chance) {
    const W = 1024, H = 720, c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const d = c2.getContext('2d');
    const base = chance ? '#f08a00' : '#1d5fd0', light = chance ? '#ffb347' : '#4f8ff0', dark = chance ? '#a95300' : '#0f3a8a';
    d.fillStyle = '#fffaf0'; d.beginPath(); d.roundRect(0, 0, W, H, 70); d.fill();
    const gr = d.createLinearGradient(0, 0, W, H); gr.addColorStop(0, light); gr.addColorStop(1, base);
    d.fillStyle = gr; d.beginPath(); d.roundRect(26, 26, W - 52, H - 52, 54); d.fill();
    d.save(); d.beginPath(); d.roundRect(26, 26, W - 52, H - 52, 54); d.clip();
    d.globalAlpha = 0.16; d.fillStyle = '#fff';
    for (let k = -H; k < W; k += 64) { d.beginPath(); d.moveTo(k, 0); d.lineTo(k + 32, 0); d.lineTo(k + 32 + H, H); d.lineTo(k + H, H); d.fill(); }
    d.restore();
    d.strokeStyle = 'rgba(255,255,255,.85)'; d.lineWidth = 10; d.setLineDash([24, 18]); d.beginPath(); d.roundRect(60, 60, W - 120, H - 120, 36); d.stroke(); d.setLineDash([]);
    // ortada madalyon + simge
    d.fillStyle = '#fff'; d.beginPath(); d.arc(W / 2, H / 2 - 40, 170, 0, Math.PI * 2); d.fill();
    d.strokeStyle = dark; d.lineWidth = 12; d.stroke();
    d.textAlign = 'center'; d.textBaseline = 'middle';
    if (chance) { d.font = '900 260px Nunito'; d.lineWidth = 16; d.strokeStyle = dark; d.strokeText('?', W / 2, H / 2 - 30); d.fillStyle = base; d.fillText('?', W / 2, H / 2 - 30); }
    else { d.font = '900 210px Nunito'; d.fillStyle = base; d.fillText('฿', W / 2, H / 2 - 30); }
    d.font = '900 92px Nunito'; d.fillStyle = '#fff'; d.lineWidth = 14; d.strokeStyle = dark; d.lineJoin = 'round';
    const label = chance ? 'ŞANS' : 'KAMU FONU';
    d.strokeText(label, W / 2, H - 120); d.fillText(label, W / 2, H - 120);
    const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }
  function deck(key, x, z) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.PI / 4;
    const edge = new THREE.MeshStandardMaterial({ color: '#f7f2e6', roughness: 0.8 });
    for (let k = 0; k < 6; k++) {
      const card = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.03, 1.0, 2, 0.06), edge);
      card.position.set((Math.random() - 0.5) * 0.04, 0.02 + k * 0.032, (Math.random() - 0.5) * 0.04); card.rotation.y = (Math.random() - 0.5) * 0.06;
      card.castShadow = true; card.receiveShadow = true; grp.add(card);
    }
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.985), new THREE.MeshStandardMaterial({ map: deckFace(key === 'chance'), roughness: 0.55 }));
    face.rotation.x = -Math.PI / 2; face.position.y = 0.02 + 5 * 0.032 + 0.017; grp.add(face);
    scene.add(grp); decks[key] = grp;
  }
  deck('chance', -1.95, 1.0);
  deck('chest', 1.0, -1.95);

  // banka (kalan ev/otel) ve otopark kasası tahtanın üstünde, tahtayla birlikte yakınlaşır
  function flatSign(wd, ht, cw, ch) {
    const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
    const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
    const holder = new THREE.Group(); holder.rotation.y = Math.PI / 4; holder.add(m);
    return { holder, mesh: m, ctx: c2.getContext('2d'), tex: t, cw, ch };
  }
  const bank = flatSign(2.6, 0.81, 1024, 318); bank.holder.position.set(-0.45, 0.012, 2.25); scene.add(bank.holder);
  function setBank(houses, hotels) {
    const { ctx: d, cw, ch } = bank;
    d.clearRect(0, 0, cw, ch);
    d.fillStyle = 'rgba(255,255,255,.96)'; d.beginPath(); d.roundRect(8, 8, cw - 16, ch - 16, 70); d.fill();
    d.lineWidth = 12; d.strokeStyle = '#1b2a36'; d.stroke();
    d.textAlign = 'left'; d.textBaseline = 'middle'; d.fillStyle = '#5c6b77'; d.font = '900 54px Nunito'; d.fillText('BANKA', 60, ch / 2);
    const item = (x, n, low, hotel) => {
      d.fillStyle = hotel ? '#d91e2a' : '#1aa34d';
      if (hotel) { d.beginPath(); d.moveTo(x + 10, ch / 2 - 40); d.lineTo(x + 110, ch / 2 - 40); d.lineTo(x + 120, ch / 2 - 22); d.lineTo(x + 120, ch / 2 + 46); d.lineTo(x, ch / 2 + 46); d.lineTo(x, ch / 2 - 22); d.fill(); }
      else { d.beginPath(); d.moveTo(x + 45, ch / 2 - 52); d.lineTo(x + 92, ch / 2 - 10); d.lineTo(x + 92, ch / 2 + 46); d.lineTo(x - 2, ch / 2 + 46); d.lineTo(x - 2, ch / 2 - 10); d.fill(); }
      d.fillStyle = low ? '#d7263d' : '#1b2a36'; d.font = '900 110px Nunito'; d.fillText(String(n), x + (hotel ? 140 : 112), ch / 2 + 6);
    };
    item(330, houses, houses <= 6, false); item(640, hotels, hotels <= 3, true);
    bank.tex.needsUpdate = true;
  }
  setBank(32, 12);

  // otopark kasası: banknot destesi + etiket
  function noteTex(color) {
    const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 128; const d = c2.getContext('2d');
    d.fillStyle = color; d.fillRect(0, 0, 256, 128); d.strokeStyle = 'rgba(0,0,0,.25)'; d.lineWidth = 6; d.strokeRect(10, 10, 236, 108);
    d.fillStyle = 'rgba(255,255,255,.75)'; d.beginPath(); d.arc(128, 64, 34, 0, 7); d.fill();
    d.fillStyle = 'rgba(0,0,0,.55)'; d.font = '900 46px Nunito'; d.textAlign = 'center'; d.textBaseline = 'middle'; d.fillText('฿', 128, 66);
    const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const NOTE_MATS = ['#c9b3f2', '#a9c8f5', '#f5c99b', '#b9e3b0', '#f3a8b5'].map((c) => new THREE.MeshStandardMaterial({ map: noteTex(c), roughness: 0.7 }));
  const potGrp = new THREE.Group(); potGrp.position.set(2.05, 0, 0.35); scene.add(potGrp);
  const potLabel = flatSign(1.9, 0.53, 768, 215); potLabel.holder.position.set(2.5, 0.012, 0.85); potLabel.holder.visible = false; scene.add(potLabel.holder);
  let potNotes = [], potShown = 0;
  function setPot(amount) {
    const want = amount > 0 ? Math.min(14, 2 + Math.floor(Math.log2(amount / 25000) * 1.6)) : 0;
    if (amount <= 0 && potNotes.length) {     // kasa boşaldı: banknotlar havaya uçsun
      const fly = potNotes; potNotes = [];
      fly.forEach((n, k) => { const y0 = n.position.y; anims.push({ t: 0, dur: 700 + k * 40, fn: (t) => { n.position.y = y0 + t * 2.4; n.rotation.y += 0.2; n.material.opacity = 1 - t; if (t >= 1) potGrp.remove(n); } }); n.material = n.material.clone(); n.material.transparent = true; });
    }
    while (potNotes.length < want) {
      const k = potNotes.length;
      const n = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.012, 0.31), NOTE_MATS[k % NOTE_MATS.length]);
      n.position.set(Math.sin(k * 2.3) * 0.08, 0.008 + k * 0.016, Math.cos(k * 1.7) * 0.08); n.rotation.y = Math.PI / 4 + Math.sin(k * 1.3) * 0.5; n.castShadow = true;
      potGrp.add(n); potNotes.push(n);
      const y1 = n.position.y; n.position.y = y1 + 0.8;
      anims.push({ t: 0, dur: 380, fn: (t) => { n.position.y = y1 + (1 - t) * (1 - t) * 0.8; } });
    }
    while (potNotes.length > want) potGrp.remove(potNotes.pop());
    potLabel.holder.visible = amount > 0;
    if (amount > 0 && amount !== potShown) {
      const { ctx: d, cw, ch } = potLabel;
      d.clearRect(0, 0, cw, ch);
      d.fillStyle = 'rgba(255,255,255,.96)'; d.beginPath(); d.roundRect(8, 8, cw - 16, ch - 16, 60); d.fill(); d.lineWidth = 10; d.strokeStyle = '#1b2a36'; d.stroke();
      d.textAlign = 'center'; d.textBaseline = 'middle';
      d.fillStyle = '#1f9d55'; d.font = '900 40px Nunito'; d.fillText('OTOPARK KASASI', cw / 2, 66);
      d.fillStyle = '#1b2a36'; d.font = '900 76px Nunito'; d.fillText(`${CUR}${amount.toLocaleString('tr-TR')}`, cw / 2, 145);
      potLabel.tex.needsUpdate = true;
    }
    potShown = amount;
  }

  // ---------- kare katmanları: sahiplik, ipotek, vurgu ----------
  const overlays = {};
  const flatRect = (i, color, opacity, inset = 0.04, y = 0.006) => {
    const [w, d] = sqSize(i);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - inset, d - inset), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(sqCenter(i)); m.position.y = y; m.renderOrder = 2; scene.add(m); return m;
  };
  const ownerMarks = {}, buildings = {}, mortg = {}, flags = {};
  function setProp(i, color, houses, mortgaged) {
    const key = `${color}|${houses}|${mortgaged}`; if (overlays[i] === key) return; overlays[i] = key;
    if (ownerMarks[i]) { scene.remove(ownerMarks[i]); ownerMarks[i] = null; }
    if (color) {
      const c = sqCenter(i), inw = inward(i), [w, d] = sqSize(i);
      const m = new THREE.Mesh(new THREE.BoxGeometry(inw.x ? 0.07 : w * 0.88, 0.035, inw.z ? 0.07 : d * 0.88), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
      m.position.copy(c).addScaledVector(inw, -C * 0.465); m.position.y = 0.018; scene.add(m); ownerMarks[i] = m;
    }
    if (buildings[i]) { scene.remove(buildings[i]); buildings[i] = null; }
    if (flags[i]) { scene.remove(flags[i]); flags[i] = null; }
    if (color && !houses) {
      const f = flagMesh(color), c = sqCenter(i), inw = inward(i);
      f.position.copy(c).addScaledVector(inw, C * 0.36); f.rotation.y = Math.atan2(-inw.x, -inw.z) + Math.PI / 2;
      scene.add(f); flags[i] = f;
    }
    if (houses) {
      const grp = new THREE.Group(), c = sqCenter(i), inw = inward(i);
      const bandCenter = c.clone().addScaledVector(inw, C * 0.4);
      const along = new THREE.Vector3(-inw.z, 0, inw.x);
      const face = Math.atan2(-inw.x, -inw.z);    // ön yüz karenin dışına (izleyiciye) baksın
      if (houses === 5) { const h = hotelMesh(color || undefined); h.scale.setScalar(1.15); h.position.copy(bandCenter).addScaledVector(inw, -0.08); h.rotation.y = face; grp.add(h); }
      else {
        // 1-2 ev yan yana, 3-4 ev iki sıra (Business Tour tarzı küçük mahalle)
        const spots = houses <= 2 ? [[-(houses - 1) * 0.17, 0], [0.17, 0]] : [[-0.17, 0], [0.17, 0], [-0.17, -0.24], [0.17, -0.24]];
        for (let k = 0; k < houses; k++) { const h = houseMesh(color || undefined, i + k); h.scale.setScalar(1.3); h.position.copy(bandCenter).addScaledVector(along, spots[k][0]).addScaledVector(inw, spots[k][1]); h.rotation.y = face; grp.add(h); }
      }
      scene.add(grp); buildings[i] = grp;
    }
    if (mortg[i]) { scene.remove(mortg[i]); mortg[i] = null; }
    if (mortgaged) mortg[i] = flatRect(i, '#20262c', 0.55, 0.06, 0.008);
  }
  function popBuilding(i) {
    const b = buildings[i]; if (!b) return;
    anims.push({ t: 0, dur: 600, fn: (t) => { const s = t < 0.6 ? t / 0.6 * 1.25 : 1.25 - (t - 0.6) / 0.4 * 0.25; b.scale.setScalar(Math.max(0.01, s)); } });
  }

  // vurgular
  const marks = new Set();
  const glow = (i, color, opacity) => { const m = flatRect(i, color, opacity, 0.02, 0.01); m.material.blending = THREE.AdditiveBlending; marks.add(m); return m; };
  let pathMarks = [], targetMark = null, landedMark = null;
  function clearPreview() { pathMarks.forEach((m) => { scene.remove(m); marks.delete(m); }); pathMarks = []; if (targetMark) { scene.remove(targetMark); marks.delete(targetMark); targetMark = null; } }
  function preview(path, to) {
    clearPreview();
    path.forEach((i, k) => setTimeout(() => {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), new THREE.MeshBasicMaterial({ color: '#f2b632' }));
      d.rotation.x = -Math.PI / 2; d.position.copy(sqCenter(i)); d.position.y = 0.012; scene.add(d); pathMarks.push(d);
    }, k * 40));
    targetMark = glow(to, '#ffcf3a', 0.55); targetMark.userData.pulse = true;
  }
  function landed(i) {
    if (landedMark) { scene.remove(landedMark); marks.delete(landedMark); landedMark = null; }
    if (i != null) landedMark = glow(i, '#ffd54a', 0.35);
  }
  function pulse(i) {
    wave(i);
    const m = glow(i, '#ffffff', 0.7);
    anims.push({ t: 0, dur: 1200, fn: (t) => { m.material.opacity = 0.7 * (1 - t); if (t >= 1) { scene.remove(m); marks.delete(m); } } });
  }
  function removeStep(i) { const k = pathMarks.findIndex((d) => d.position.distanceTo(sqCenter(i)) < 0.05); if (k >= 0) { scene.remove(pathMarks[k]); pathMarks.splice(k, 1); } }

  // ---------- efektler ----------
  const parts = [];
  const PART_GEO = new THREE.BoxGeometry(0.07, 0.07, 0.015);
  function burst(pos, color, n = 26, power = 1, kind = 'confetti') {
    const cols = Array.isArray(color) ? color : [color, '#ffffff', '#f2b632'];
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(kind === 'coin' ? new THREE.CylinderGeometry(0.06, 0.06, 0.018, 14) : PART_GEO, new THREE.MeshStandardMaterial({ color: kind === 'coin' ? '#f6c443' : cols[k % cols.length], emissive: kind === 'coin' ? '#7a5200' : '#000000', emissiveIntensity: 0.3, transparent: true }));
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2, sp = (0.9 + Math.random() * 1.6) * power;
      m.userData = { v: new THREE.Vector3(Math.cos(a) * sp * 0.6, 2.2 * power + Math.random() * 2 * power, Math.sin(a) * sp * 0.6), r: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), life: 1.1 + Math.random() * 0.6, age: 0 };
      scene.add(m); parts.push(m);
    }
  }
  function wave(i, color = '#ffd54a') {
    const c = sqCenter(i);
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.copy(c); m.position.y = 0.02; scene.add(m);
    anims.push({ t: 0, dur: 800, fn: (t) => { m.scale.setScalar(1 + t * 3.2); m.material.opacity = 0.9 * (1 - t); if (t >= 1) scene.remove(m); } });
  }
  function puff(pos) {
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
      const a = (k / 8) * Math.PI * 2; m.position.set(pos.x + Math.cos(a) * 0.25, 0.06, pos.z + Math.sin(a) * 0.25); scene.add(m);
      anims.push({ t: 0, dur: 600, fn: (t) => { m.position.x += Math.cos(a) * 0.01; m.position.z += Math.sin(a) * 0.01; m.scale.setScalar(1 + t * 1.8); m.material.opacity = 0.6 * (1 - t); if (t >= 1) scene.remove(m); } });
    }
  }
  // oyun olayları için hazır efektler
  function fx(kind, i, color) {
    const at = (i != null ? sqCenter(i) : new THREE.Vector3()).setY(0.25);
    if (kind === 'buy') { burst(at, color, 34, 1); wave(i, color); }
    else if (kind === 'build') { burst(at, ['#1aa34d', '#7ddc8f', '#ffffff'], 22, 0.8); wave(i, '#1aa34d'); }
    else if (kind === 'jackpot') { burst(at, null, 40, 1.3, 'coin'); wave(i, '#f2b632'); }
    else if (kind === 'go') { burst(at, ['#d7263d', '#f2b632', '#ffffff'], 30, 1); wave(i, '#f2b632'); }
    else if (kind === 'land') wave(i, color || '#ffd54a');
    else if (kind === 'win') { for (let k = 0; k < 4; k++) setTimeout(() => burst(new THREE.Vector3((Math.random() - 0.5) * 6, 0.3, (Math.random() - 0.5) * 6), ['#d7263d', '#f2b632', '#1d7cf2', '#1f9d55', '#ffffff'], 40, 1.5), k * 300); }
  }
  // yeni oyunda eski oyunun her şeyini temizle
  function reset() {
    for (const [id, p] of Object.entries(pawns)) { scene.remove(p.root); delete pawns[id]; }
    for (let i = 0; i < 40; i++) setProp(i, null, 0, false);
    Object.keys(overlays).forEach((k) => delete overlays[k]);
    landed(null); clearPreview(); setPot(0); setBank(32, 12); turnId = null;
    view.manual = false;
  }

  // ---------- karakterler ----------
  const pawns = {};
  function ensurePawn(id, token, color) {
    if (pawns[id]) return;
    const root = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.014; root.add(ring);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.33, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.015; root.add(halo);
    const model = makeToken(token, color); root.add(model);
    scene.add(root);
    pawns[id] = { root, model, ring, halo, cur: false, anim: null, target: null, face: 0, pending: null };
  }
  function setVisible(id, v) { if (pawns[id]) pawns[id].root.visible = v; }
  function setTurn(id) { Object.entries(pawns).forEach(([k, p]) => { p.cur = k === id; }); turnId = id; }
  let turnId = null;
  function spotFor(key, k, n) {
    const i = key === 'jail' ? 10 : +key;
    const c = sqCenter(i);
    const front = new THREE.Vector3(1, 0, 1).normalize(), lat = new THREE.Vector3(1, 0, -1).normalize();
    if (i % 10 === 0) {
      c.addScaledVector(front, 0.22);                       // köşede yapının önü
      if (i === 10) c.addScaledVector(lat, key === 'jail' ? 0.36 : -0.36);   // hapistekiler "HAPİS", ziyaretçiler "ZİYARET" tarafında
      if (n > 1) { const a = (k / n) * Math.PI * 2, r = i === 10 ? 0.17 : 0.26; c.addScaledVector(lat, Math.cos(a) * r).addScaledVector(front, Math.sin(a) * r * 0.6); }
      return c;
    }
    c.addScaledVector(inward(i), -0.2);                      // evler karenin iç tarafında, karakterler dış tarafta
    if (n > 1) { const a = (k / n) * Math.PI * 2 + Math.PI / 4, r = 0.19; c.x += Math.cos(a) * r; c.z += Math.sin(a) * r; }
    return c;
  }
  // groups: { '5': [id, id], 'jail': [id] }
  function layout(groups, animate) {
    for (const [key, ids] of Object.entries(groups)) {
      ids.forEach((id, k) => {
        const p = pawns[id]; if (!p) return;
        const to = spotFor(key, k, ids.length);
        if (p.target && p.target.distanceTo(to) < 0.001) return;
        const from = p.root.position.clone();
        if (![from.x, from.y, from.z].every(Number.isFinite)) from.copy(to);   // bozuk konumdan kurtar
        p.target = to;
        const mode = p.pending ? p.pending.mode : 'slide';
        let dur = p.pending && Number.isFinite(p.pending.dur) ? p.pending.dur : mode === 'jump' ? 900 : 260;
        p.pending = null;
        if (!animate || !p.everPlaced) { p.root.position.copy(to); p.anim = null; p.everPlaced = true; return; }
        const dx = to.x - from.x, dz = to.z - from.z;
        if (Math.hypot(dx, dz) > 0.05) p.face = Math.atan2(dx, dz);
        p.anim = { from, to, t: 0, dur: Math.max(120, dur), h: mode === 'hop' ? 0.42 : mode === 'jump' ? 1.6 : 0.08, spin: mode === 'jump' };
      });
    }
  }
  function step(id, mode, dur) { if (pawns[id]) pawns[id].pending = { mode, dur }; }

  // ---------- zarlar ----------
  const dieMats = FACE.map((n) => new THREE.MeshStandardMaterial({ map: pipTex(n), roughness: 0.35 }));
  const dice = [0, 1].map((k) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.09), dieMats); m.castShadow = true; m.position.set(k ? 0.45 : -0.45, 0.31, k ? -0.2 : 0.2); m.quaternion.copy(dieQuat(k ? 5 : 3, 0.3)); scene.add(m); return m; });
  function setDice(vals, roll, ms = 1000) {
    dice.forEach((d, k) => {
      const endQ = dieQuat(vals[k], Math.PI / 4 + (Math.random() - 0.5) * 0.6);
      if (!roll) { d.quaternion.copy(endQ); return; }
      const from = d.position.clone(), to = new THREE.Vector3((k ? 0.5 : -0.5) + (Math.random() - 0.5) * 0.4, 0.31, (k ? -0.25 : 0.25) + (Math.random() - 0.5) * 0.4);
      const spin = new THREE.Vector3(Math.random() * 14 + 10, Math.random() * 10, Math.random() * 14 + 10);
      anims.push({ t: 0, dur: ms - 60 + k * 60, fn: (t) => {
        const e = 1 - Math.pow(1 - t, 3);
        d.position.lerpVectors(from, to, e);
        d.position.y = 0.31 + Math.abs(Math.sin(t * Math.PI * 2.2)) * 2.0 * (1 - t);
        if (t < 0.75) d.rotation.set(spin.x * t, spin.y * t, spin.z * t);
        else { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(spin.x * 0.75, spin.y * 0.75, spin.z * 0.75)); d.quaternion.slerpQuaternions(q, endQ, (t - 0.75) / 0.25); }
        if (t >= 1) { d.quaternion.copy(endQ); d.position.y = 0.31; puff(d.position); }
      } });
    });
  }
  function drawDeck(key) {
    const m = decks[key]; if (!m) return;
    anims.push({ t: 0, dur: 600, fn: (t) => { m.position.y = Math.sin(t * Math.PI) * 0.3; m.rotation.z = Math.sin(t * Math.PI * 2) * 0.06; } });
    burst(m.position.clone().setY(0.3), key === 'chance' ? '#ffb347' : '#6fa8ff', 22, 0.9);
  }

  // ---------- kamera ----------
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const EL = 34 * Math.PI / 180, AZ = Math.PI / 4;
  const camDir = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
  const view = { target: new THREE.Vector3(), zoom: 1, wantTarget: new THREE.Vector3(), wantZoom: 1, mode: 'all', manual: false };
  let fitHalfH = 6, shakeT = 0;
  let margins = { top: 0, bottom: 0, left: 0, right: 0 };
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    const diag = (B + 0.7) * Math.SQRT2, needW = diag * 1.02, needH = diag * Math.sin(EL) + 1.6;
    const uw = Math.max(100, w - margins.left - margins.right), uh = Math.max(100, h - margins.top - margins.bottom);
    // tahta yüksekliği / genişliği kullanılabilir alana sığsın
    const halfFromH = needH / 2 * h / uh, halfFromW = needW / 2 * h / uw;
    fitHalfH = Math.max(halfFromH, halfFromW);
    camera.left = -fitHalfH * w / h; camera.right = fitHalfH * w / h; camera.top = fitHalfH; camera.bottom = -fitHalfH;
    // kullanılabilir alanın ortasına kaydır
    const offX = (margins.left - margins.right) / 2, offY = (margins.top - margins.bottom) / 2;
    camera.clearViewOffset();
    if (offX || offY) camera.setViewOffset(w, h, -offX, -offY, w, h);
    camera.updateProjectionMatrix();
  }
  function setMargins(m) { margins = { ...margins, ...m }; resize(); }
  function focus() {
    if (view.manual) return;
    const p = turnId && pawns[turnId];
    if (view.mode === 'follow' && p) { view.wantTarget.set(p.root.position.x, 0, p.root.position.z); view.wantZoom = 1.9; }
    else { view.wantTarget.set(0, 0, 0); view.wantZoom = 1; }
  }
  function setCamMode(mode) { view.mode = mode; view.manual = false; focus(); }

  // dokunma: kaydır / iki parmak yakınlaştır / tıkla
  const ptrs = new Map(); let pinch0 = 0, zoom0 = 1, down = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    down = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: false } : null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = view.wantZoom; }
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId); if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY }; ptrs.set(e.pointerId, cur);
    if (down && Math.hypot(cur.x - down.x, cur.y - down.y) > 8) down.moved = true;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; view.manual = true; view.wantZoom = Math.min(3.2, Math.max(0.85, zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch0)); return; }
    if (!down || !down.moved || view.wantZoom <= 1.02) return;
    view.manual = true;
    const k = (fitHalfH * 2 / (canvas.clientHeight || innerHeight)) / view.zoom;
    const right = new THREE.Vector3(Math.cos(AZ), 0, -Math.sin(AZ)), fwd = new THREE.Vector3(-Math.sin(AZ), 0, -Math.cos(AZ));
    view.wantTarget.addScaledVector(right, -(cur.x - prev.x) * k).addScaledVector(fwd, (cur.y - prev.y) * k / Math.sin(EL));
    view.wantTarget.clampLength(0, 6);
  });
  const up = (e) => {
    ptrs.delete(e.pointerId);
    if (down && !down.moved && performance.now() - down.t < 500 && e.type === 'pointerup') { const i = pick(e.clientX, e.clientY); if (i != null && onPick) onPick(i); }
    down = null;
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.manual = true; view.wantZoom = Math.min(3.2, Math.max(0.85, view.wantZoom * (e.deltaY < 0 ? 1.12 : 0.89))); if (view.wantZoom <= 1.02) view.wantTarget.set(0, 0, 0); }, { passive: false });

  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function pick(x, y) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.ray.intersectPlane(plane, new THREE.Vector3()); if (!hit) return null;
    for (let i = 0; i < 40; i++) { const c = sqCenter(i), [w, d] = sqSize(i); if (Math.abs(hit.x - c.x) <= w / 2 && Math.abs(hit.z - c.z) <= d / 2) return i; }
    return null;
  }
  function screenOf(v) {
    const r = canvas.getBoundingClientRect(), p = v.clone().project(camera);
    return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
  }
  const pawnScreen = (id) => (pawns[id] && pawns[id].root.visible ? screenOf(pawns[id].root.position.clone().add(new THREE.Vector3(0, 0.45, 0))) : null);
  const squareScreen = (i) => screenOf(sqCenter(i));
  const centerScreen = () => screenOf(new THREE.Vector3(0, 0, 0));
  const potScreen = () => screenOf(potGrp.position.clone().setY(0.2));
  const bankScreen = () => screenOf(bank.holder.position.clone());
  function shake() { shakeT = 0.45; }

  // ---------- döngü ----------
  const anims = [];
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!canvas.offsetParent) return;                       // oyun ekranı kapalıyken çizme
    for (let k = anims.length - 1; k >= 0; k--) { const a = anims[k]; a.t = Math.min(1, a.t + dt * 1000 / a.dur); a.fn(a.t); if (a.t >= 1) anims.splice(k, 1); }
    for (let k = parts.length - 1; k >= 0; k--) {
      const m = parts[k], u = m.userData; u.age += dt;
      u.v.y -= 7 * dt; m.position.addScaledVector(u.v, dt);
      if (m.position.y < 0.02) { m.position.y = 0.02; u.v.multiplyScalar(0.4); u.v.y = Math.abs(u.v.y) * 0.3; }
      m.rotation.x += u.r.x * dt; m.rotation.y += u.r.y * dt; m.rotation.z += u.r.z * dt;
      m.material.opacity = Math.min(1, (u.life - u.age) * 2.5);
      if (u.age >= u.life) { scene.remove(m); m.geometry !== PART_GEO && m.geometry.dispose(); m.material.dispose(); parts.splice(k, 1); }
    }
    for (const p of Object.values(pawns)) {
      if (p.anim) {
        const a = p.anim; a.t = Math.min(1, a.t + dt * 1000 / a.dur);
        const e = a.h > 1 ? (a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2) : a.t;
        p.root.position.lerpVectors(a.from, a.to, e);
        p.root.position.y = Math.sin(a.t * Math.PI) * a.h;
        if (a.spin) p.model.rotation.y = p.face + a.t * Math.PI * 2;
        if (a.t >= 1 || !Number.isFinite(a.t)) { p.anim = null; p.root.position.copy(a.to); p.root.position.y = 0; }
      } else p.root.position.y = 0;
      if (!Number.isFinite(p.root.position.x + p.root.position.z + p.model.rotation.y)) { p.anim = null; if (p.target) p.root.position.copy(p.target); p.model.rotation.set(0, 0, 0); p.face = 0; }
      // gidiş yönüne dön, sırası gelen hafifçe zıplasın
      const ry = p.model.rotation.y; let d = p.face - ry; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (!(p.anim && p.anim.spin)) p.model.rotation.y = ry + d * Math.min(1, dt * 10);
      p.model.position.y = p.cur && !p.anim ? Math.abs(Math.sin(now / 280)) * 0.07 : 0;
      p.halo.material.opacity = p.cur ? 0.5 + 0.4 * Math.sin(now / 200) : 0;
      p.halo.scale.setScalar(p.cur ? 1 + 0.15 * Math.sin(now / 200) : 1);
    }
    const on = Math.floor(now / 350) % 2 === 0;
    sirens.forEach(([r, b]) => { r.material.emissiveIntensity = on ? 1.2 : 0.1; b.material.emissiveIntensity = on ? 0.1 : 1.2; });
    Object.values(flags).forEach((f) => { if (f) f.userData.flag.rotation.y = Math.sin(now / 300 + f.position.x * 3) * 0.35; });
    marks.forEach((m) => { if (m.userData.pulse) m.material.opacity = 0.35 + 0.3 * Math.sin(now / 130); });
    focus();
    const f = 1 - Math.exp(-dt * 4);
    view.target.lerp(view.wantTarget, f); view.zoom += (view.wantZoom - view.zoom) * f;
    camera.zoom = view.zoom; camera.updateProjectionMatrix();
    const jit = shakeT > 0 ? (shakeT -= dt, new THREE.Vector3((Math.random() - 0.5) * 0.25, 0, (Math.random() - 0.5) * 0.25)) : new THREE.Vector3();
    camera.position.copy(view.target).add(jit).addScaledVector(camDir, 40);
    camera.lookAt(view.target.clone().add(jit));
    renderer.render(scene, camera);
  });
  addEventListener('resize', () => requestAnimationFrame(resize));
  resize();
  // gölgelendiricileri şimdiden derle: oyun ekranı açılınca ilk kare beklemesin
  try { const hold = makeToken('araba', '#888'); scene.add(hold); renderer.compile(scene, camera); scene.remove(hold); } catch { /* sorun değil */ }

  const debugPawns = () => Object.fromEntries(Object.entries(pawns).map(([k, p]) => [k, { pos: p.root.position.toArray().map((v) => +v.toFixed(2)), vis: p.root.visible, anim: !!p.anim }]));
  return { fx, reset, setBank, setPot, potScreen, bankScreen, debugPawns, ensurePawn, setVisible, setTurn, layout, step, setProp, popBuilding, preview, clearPreview, removeStep, landed, pulse, setDice, drawDeck, setCamMode, get camMode() { return view.mode; }, setMargins, resize, pawnScreen, squareScreen, centerScreen, shake, pick };
}
export { pipTex, FACE, dieQuat };
