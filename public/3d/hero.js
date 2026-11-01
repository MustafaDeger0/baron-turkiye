// Ana sayfadaki 3D vitrin: oyunun karakterleri ve zarları (oyundakilerin aynısı)
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { makeToken } from './tokens.js';
import { pipTex, FACE, dieQuat } from './view.js';

export function createHero(canvas, isVisible) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2.5, Math.max(1.5, devicePixelRatio)));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#5a7a92', 1.25));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.1); sun.position.set(-3, 7, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); sun.shadow.radius = 6;
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#8fd0ff', 0.8); rim.position.set(4, 3, -4); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // karakterler yay şeklinde dizili
  const LINE = [['araba', '#e63946'], ['sapka', '#1d7cf2'], ['cay', '#f4a261'], ['tac', '#9b5de5'], ['roket', '#2a9d8f']];
  const tokens = LINE.map(([k, c], i) => {
    const t = makeToken(k, c);
    const a = (i - 2) * 0.36;
    t.position.set(Math.sin(a) * 2.2 - 0.3, 0, -Math.cos(a) * 0.9 + 0.6);
    t.rotation.y = -a * 0.8 + 0.25; t.scale.multiplyScalar(1.35);
    t.userData.base = t.rotation.y;
    scene.add(t); return t;
  });
  // zarlar
  const mats = FACE.map((n) => new THREE.MeshStandardMaterial({ map: pipTex(n), roughness: 0.32 }));
  const dice = [0, 1].map((k) => { const d = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.1), mats); d.castShadow = true; d.position.set(1.65 + k * 0.72, 0.31, -0.55 + k * 0.35); scene.add(d); return d; });

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0.05, 2.3, 5.4); camera.lookAt(0.05, 0.45, 0);
  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 200;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // zar atışı: birkaç saniyede bir havaya atılıp dönerek düşer
  let roll = null, nextRoll = 600;
  function startRoll(now) {
    roll = { t0: now, dur: 1300, from: dice.map((d) => d.quaternion.clone()), to: dice.map(() => dieQuat(1 + Math.floor(Math.random() * 6), Math.random() * Math.PI * 2)), spin: dice.map(() => new THREE.Vector3(Math.random() * 12 + 8, Math.random() * 8, Math.random() * 12 + 8)) };
  }
  renderer.setAnimationLoop((now) => {
    if (!isVisible()) return;
    resize();
    tokens.forEach((t, i) => {
      const ph = now / 520 - i * 0.7;
      t.position.y = Math.max(0, Math.sin(ph)) * 0.32;                 // sırayla zıplasınlar
      t.rotation.y = t.userData.base + Math.sin(now / 1400 + i) * 0.35;
      t.rotation.z = Math.sin(ph) * 0.06;
    });
    if (!roll && now > nextRoll) startRoll(now);
    if (roll) {
      const t = Math.min(1, (now - roll.t0) / roll.dur);
      dice.forEach((d, k) => {
        d.position.y = 0.31 + Math.abs(Math.sin(t * Math.PI * 2.2)) * 1.6 * (1 - t);
        if (t < 0.75) { const s = roll.spin[k]; d.rotation.set(s.x * t, s.y * t, s.z * t); }
        else { const s = roll.spin[k], q = new THREE.Quaternion().setFromEuler(new THREE.Euler(s.x * 0.75, s.y * 0.75, s.z * 0.75)); d.quaternion.slerpQuaternions(q, roll.to[k], (t - 0.75) / 0.25); }
      });
      if (t >= 1) { roll = null; nextRoll = now + 3400; }
    }
    renderer.render(scene, camera);
  });
}
