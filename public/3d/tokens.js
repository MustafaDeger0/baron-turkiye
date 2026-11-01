// 3D oyuncu karakterleri: araba, şapka, gemi, çay bardağı, nazar, uçak, taç, roket.
// Her biri oyuncunun rengini taşır; tabanı y=0'da, önü +z yönüne bakar, boyu ~0.6.
import * as THREE from 'three';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05, ...o });
const shade = (hex, k) => { const c = new THREE.Color(hex); c.offsetHSL(0, 0, k); return c; };
function add(grp, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; grp.add(m); return m;
}
const lathe = (pts, seg = 32) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

function car(color) {
  const g = new THREE.Group(), body = std(color), dark = std('#22272c', { roughness: 0.6 }), glass = std('#bfe6ff', { roughness: 0.1, metalness: 0.3 }), chrome = std('#e8ecef', { metalness: 0.2, roughness: 0.25 });
  add(g, new THREE.BoxGeometry(0.34, 0.13, 0.6), body, 0, 0.12, 0);
  add(g, new THREE.BoxGeometry(0.3, 0.12, 0.3), body, 0, 0.24, -0.04);
  add(g, new THREE.BoxGeometry(0.31, 0.09, 0.31), glass, 0, 0.245, -0.04);
  add(g, new THREE.BoxGeometry(0.36, 0.04, 0.1), chrome, 0, 0.1, 0.31);   // tampon
  add(g, new THREE.BoxGeometry(0.36, 0.04, 0.08), chrome, 0, 0.1, -0.31);
  for (const [x, z] of [[-0.17, 0.18], [0.17, 0.18], [-0.17, -0.2], [0.17, -0.2]]) add(g, new THREE.CylinderGeometry(0.075, 0.075, 0.06, 20), dark, x, 0.075, z, 0, 0, Math.PI / 2);
  for (const x of [-0.11, 0.11]) add(g, new THREE.SphereGeometry(0.03, 12, 8), std('#fff6c8', { emissive: '#ffe58a', emissiveIntensity: 0.6 }), x, 0.15, 0.3);
  return g;
}
function hat(color) {
  const g = new THREE.Group(), felt = std('#24282d', { roughness: 0.55 });
  add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.035, 40), felt, 0, 0.02, 0);
  add(g, new THREE.CylinderGeometry(0.17, 0.19, 0.42, 40), felt, 0, 0.25, 0);
  add(g, new THREE.CylinderGeometry(0.17, 0.17, 0.02, 40), felt, 0, 0.465, 0);
  add(g, new THREE.CylinderGeometry(0.195, 0.2, 0.08, 40), std(color), 0, 0.09, 0);   // oyuncu renginde bant
  return g;
}
function ship(color) {
  const g = new THREE.Group();
  const shape = new THREE.Shape(); shape.moveTo(-0.3, 0.12); shape.lineTo(0.3, 0.12); shape.lineTo(0.22, 0); shape.lineTo(-0.2, 0); shape.closePath();
  const hull = new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  hull.translate(0, 0, -0.13);
  add(g, hull, std(color), 0, 0.02, 0, 0, Math.PI / 2, 0);
  add(g, new THREE.BoxGeometry(0.2, 0.02, 0.5), std('#c8a06a', { roughness: 0.7 }), 0, 0.16, 0);  // güverte
  add(g, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 8), std('#6d4c41'), 0, 0.42, 0.02);
  const sail = new THREE.Shape(); sail.moveTo(0, 0); sail.lineTo(0, 0.4); sail.lineTo(0.24, 0.03); sail.closePath();
  add(g, new THREE.ShapeGeometry(sail), std('#fbfbf7', { side: THREE.DoubleSide }), 0, 0.2, 0.04, 0, -Math.PI / 2, 0);
  add(g, new THREE.ConeGeometry(0.035, 0.08, 4), std(color), 0, 0.7, 0.02, Math.PI / 2, 0, 0);    // bayrak
  return g;
}
function teaGlass(color) {
  const g = new THREE.Group();
  add(g, lathe([[0, 0], [0.26, 0], [0.27, 0.02], [0.24, 0.035], [0, 0.035]]), std(color), 0, 0, 0);   // tabak (oyuncu rengi)
  const glass = std('#ffffff', { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide });
  add(g, lathe([[0.07, 0.04], [0.11, 0.05], [0.13, 0.12], [0.085, 0.25], [0.09, 0.33], [0.13, 0.43], [0.135, 0.45]]), glass, 0, 0, 0);
  add(g, lathe([[0, 0.05], [0.105, 0.055], [0.125, 0.12], [0.082, 0.25], [0.087, 0.32], [0.118, 0.4], [0, 0.4]]), std('#a8320f', { roughness: 0.15, transparent: true, opacity: 0.92 }), 0, 0, 0); // çay
  add(g, new THREE.BoxGeometry(0.04, 0.025, 0.03), std('#ffffff'), 0.16, 0.05, 0.12);   // şeker
  add(g, new THREE.CylinderGeometry(0.006, 0.006, 0.36, 6), std('#d9dde2', { metalness: 0.2, roughness: 0.2 }), 0.05, 0.36, 0, 0, 0, -0.35); // kaşık
  return g;
}
function evilEye(color) {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.16, 0.2, 0.05, 32), std(color), 0, 0.025, 0);   // taban
  add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), std('#d8b23a', { metalness: 0.2, roughness: 0.3 }), 0, 0.1, 0);
  const eye = new THREE.Group(); eye.position.y = 0.38;
  const disc = (r, c, z) => add(eye, new THREE.CylinderGeometry(r, r, 0.05, 40), std(c, { roughness: 0.12, metalness: 0.15 }), 0, 0, z, Math.PI / 2, 0, 0);
  disc(0.24, '#1747b8', 0); disc(0.17, '#ffffff', 0.012); disc(0.12, '#5fa8ff', 0.024); disc(0.06, '#0b0f1a', 0.036);
  disc(0.24, '#1747b8', -0.001);
  g.add(eye);
  return g;
}
function plane(color) {
  const g = new THREE.Group(), body = std(color), white = std('#f4f6f8');
  add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), std('#9aa3ab', { metalness: 0.2 }), 0, 0.11, 0);   // direk
  add(g, new THREE.CylinderGeometry(0.12, 0.14, 0.04, 24), std('#3b4046'), 0, 0.02, 0);
  const p = new THREE.Group(); p.position.y = 0.3; g.add(p);
  add(p, new THREE.CapsuleGeometry(0.065, 0.42, 6, 16), white, 0, 0, 0, Math.PI / 2, 0, 0);
  add(p, new THREE.BoxGeometry(0.62, 0.02, 0.13), body, 0, -0.01, 0.02);              // kanatlar
  add(p, new THREE.BoxGeometry(0.22, 0.015, 0.07), body, 0, 0.01, -0.22);             // yatay kuyruk
  add(p, new THREE.BoxGeometry(0.015, 0.13, 0.09), body, 0, 0.08, -0.23);             // dikey kuyruk
  add(p, new THREE.SphereGeometry(0.05, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#bfe6ff', { roughness: 0.1 }), 0, 0.04, 0.17, 0.3, 0, 0);
  return g;
}
function crown(color) {
  const g = new THREE.Group(), gold = std('#f6c443', { metalness: 0.25, roughness: 0.3, emissive: '#5a3d00', emissiveIntensity: 0.25 });
  add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.05, 40), std(color), 0, 0.025, 0);   // yastık
  add(g, new THREE.CylinderGeometry(0.19, 0.17, 0.2, 40, 1, true), std('#f6c443', { metalness: 0.25, roughness: 0.3, emissive: '#5a3d00', emissiveIntensity: 0.25, side: THREE.DoubleSide }), 0, 0.16, 0);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    add(g, new THREE.ConeGeometry(0.05, 0.16, 8), gold, Math.sin(a) * 0.18, 0.33, Math.cos(a) * 0.18);
    add(g, new THREE.SphereGeometry(0.025, 10, 8), gold, Math.sin(a) * 0.18, 0.42, Math.cos(a) * 0.18);
    add(g, new THREE.SphereGeometry(0.028, 10, 8), std(k % 2 ? '#d7263d' : '#1d7cf2', { roughness: 0.1 }), Math.sin(a) * 0.185, 0.16, Math.cos(a) * 0.185);
  }
  return g;
}
function rocket(color) {
  const g = new THREE.Group(), white = std('#f4f6f8');
  add(g, lathe([[0.001, 0.1], [0.1, 0.12], [0.12, 0.22], [0.12, 0.42], [0.1, 0.52], [0.001, 0.52]]), white, 0, 0, 0);
  add(g, lathe([[0.001, 0.5], [0.1, 0.52], [0.07, 0.6], [0.035, 0.66], [0.001, 0.69]]), std(color), 0, 0, 0);   // burun
  add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 20), std('#5fa8ff', { roughness: 0.1 }), 0, 0.38, 0.115, Math.PI / 2, 0, 0); // pencere
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2, fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(0.13, -0.05); fin.lineTo(0.13, 0.04); fin.lineTo(0, 0.16); fin.closePath();
    const m = add(g, new THREE.ExtrudeGeometry(fin, { depth: 0.02, bevelEnabled: false }), std(color), 0, 0.1, 0); m.rotation.y = a; m.translateX(0.09); m.translateZ(-0.01);
  }
  add(g, new THREE.ConeGeometry(0.07, 0.12, 16), std('#ffb02e', { emissive: '#ff7a00', emissiveIntensity: 0.9, transparent: true, opacity: 0.9 }), 0, 0.05, 0, Math.PI, 0, 0); // alev
  return g;
}

const MAKERS = { araba: car, sapka: hat, gemi: ship, cay: teaGlass, nazar: evilEye, ucak: plane, tac: crown, roket: rocket };
export function makeToken(token, color) {
  const g = (MAKERS[token] || car)(color);
  g.scale.setScalar(1.15);
  return g;
}
export const TOKEN_KEYS = Object.keys(MAKERS);
