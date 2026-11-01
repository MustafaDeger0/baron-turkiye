/* Baron Türkiye — ses: tarayıcıda üretilen özgün arka plan müziği (hafif caz/lounge) ve efektler.
   Hiçbir hazır ses dosyası kullanılmaz; her şey Web Audio ile çalınır. */
(() => {
  'use strict';
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* yok */ } },
  };
  let ctx = null, master, musicBus, sfxBus, noiseBuf, verb;
  let musicOn = store.get('baron_music', true), sfxOn = store.get('baron_sfx', true);
  let playing = false, timer = null, nextTime = 0, step = 0;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master = ctx.createGain(); master.gain.value = 0.9;
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16;
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.5;
    // basit yankı (oda hissi)
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3; }
    verb.buffer = ir;
    const verbGain = ctx.createGain(); verbGain.gain.value = 0.18;
    musicBus.connect(master); musicBus.connect(verb); verb.connect(verbGain); verbGain.connect(master);
    sfxBus.connect(master); master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx;
  }

  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

  // ---------- çalgılar ----------
  function env(g, t, a, peak, d, sustainLevel, rel, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustainLevel), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sustainLevel), t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  }
  // Elektrik piyano benzeri (FM) akor
  function keys(notes, t, dur, vel = 0.5, bus = musicBus) {
    notes.forEach((n) => {
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
      car.type = 'sine'; mod.type = 'sine';
      car.frequency.value = hz(n); mod.frequency.value = hz(n) * 2;
      mg.gain.setValueAtTime(hz(n) * 1.4, t); mg.gain.exponentialRampToValueAtTime(hz(n) * 0.15, t + 0.5);
      mod.connect(mg); mg.connect(car.frequency);
      env(g, t, 0.005, 0.11 * vel, 0.4, 0.35, 0.35, dur);
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) { pan.pan.value = ((n % 7) - 3) / 8; car.connect(g); g.connect(pan); pan.connect(bus); } else { car.connect(g); g.connect(bus); }
      car.start(t); mod.start(t); car.stop(t + dur + 0.5); mod.stop(t + dur + 0.5);
    });
  }
  function bass(n, t, dur) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = hz(n); o2.frequency.value = hz(n);
    f.type = 'lowpass'; f.frequency.value = 700;
    env(g, t, 0.01, 0.42, 0.18, 0.5, 0.08, dur * 0.85);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }
  function vibe(n, t, dur, vel = 0.5) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), g2 = ctx.createGain(), trem = ctx.createOscillator(), tg = ctx.createGain();
    o.type = 'sine'; o2.type = 'sine';
    o.frequency.value = hz(n); o2.frequency.value = hz(n) * 4.0;
    env(g, t, 0.003, 0.14 * vel, 0.9, 0.25, 0.6, dur);
    env(g2, t, 0.002, 0.03 * vel, 0.15, 0.01, 0.1, 0.1);
    trem.frequency.value = 5.2; tg.gain.value = 0.25;
    const out = ctx.createGain(); out.gain.value = 1;
    trem.connect(tg); tg.connect(out.gain);
    o.connect(g); o2.connect(g2); g.connect(out); g2.connect(out); out.connect(musicBus);
    [o, o2, trem].forEach((x) => { x.start(t); x.stop(t + dur + 1); });
  }
  function noise(t, dur, freq, q, vol, bus = musicBus, type = 'highpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  function kick(t, vol = 0.5) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3);
  }

  // ---------- beste (özgün): Fa majör, hafif swing, 16 ölçü ----------
  const BPM = 106, BEAT = 60 / BPM, SWING = 0.62;
  // [kök, akor sesleri (MIDI)]
  const CH = {
    Fmaj7: [41, [57, 60, 64, 65]], Dm7: [38, [57, 60, 62, 65]], Gm7: [43, [58, 62, 65, 67]], C7: [36, [58, 60, 64, 67]],
    Am7: [45, [57, 60, 64, 67]], D7: [38, [57, 60, 62, 66]], Bbmaj7: [46, [57, 62, 65, 69]], Bbm6: [46, [55, 61, 62, 65]],
    Em7b5: [40, [55, 58, 62, 64]], A7: [45, [55, 61, 64, 67]],
  };
  const FORM = ['Fmaj7', 'Dm7', 'Gm7', 'C7', 'Am7', 'D7', 'Gm7', 'C7', 'Bbmaj7', 'Bbm6', 'Am7', 'D7', 'Gm7', 'C7', 'Fmaj7', 'C7'];
  // melodi: ölçü başına [vuruş(0-3.5), nota, süre(vuruş)] — yazılı, rastgele değil
  const MEL = [
    [[0, 72, 1], [1.5, 69, 0.5], [2, 67, 1], [3, 65, 1]],
    [[0.5, 69, 0.5], [1, 72, 1.5], [3, 74, 1]],
    [[0, 72, 1.5], [2, 70, 0.5], [2.5, 69, 0.5], [3, 67, 1]],
    [[0, 64, 2], [2.5, 67, 0.5], [3, 70, 1]],
    [[0, 69, 1.5], [2, 72, 1], [3, 76, 1]],
    [[0, 74, 2], [2.5, 72, 0.5], [3, 69, 1]],
    [[0, 70, 1], [1.5, 69, 0.5], [2, 67, 1], [3, 65, 0.5], [3.5, 64, 0.5]],
    [[0, 67, 3]],
    [[0, 69, 1], [1, 72, 1], [2, 77, 1.5]],
    [[0, 76, 1], [1.5, 74, 0.5], [2, 73, 2]],
    [[0, 72, 1], [1, 69, 1], [2, 72, 1], [3, 76, 1]],
    [[0, 74, 1.5], [2, 72, 0.5], [2.5, 69, 1.5]],
    [[0, 70, 1], [1, 74, 1], [2, 72, 1], [3, 70, 1]],
    [[0, 69, 1], [1, 67, 1], [2, 64, 1], [3, 67, 1]],
    [[0, 65, 3]],
    [],
  ];
  // yürüyen bas: kök → akor sesi → beşli → bir sonraki köke yarım ses yaklaşma
  function walk(bar) {
    const [r] = CH[FORM[bar]], [nr] = CH[FORM[(bar + 1) % FORM.length]];
    const third = CH[FORM[bar]][1][1] - 24, fifth = r + 7;
    return [r, third, fifth, nr + (nr > fifth ? -1 : 1)];
  }
  let melodyOn = false;
  function scheduleBar(bar, t0) {
    const name = FORM[bar], [, chord] = CH[name];
    const sw = (beat) => t0 + (Math.floor(beat) + (beat % 1 ? SWING : 0)) * BEAT;
    // akor vuruşları (charleston)
    keys(chord, sw(0), BEAT * 1.2, 0.55);
    keys(chord, sw(1.5), BEAT * 0.9, 0.45);
    if (bar % 2) keys(chord, sw(3.5), BEAT * 0.6, 0.35);
    walk(bar).forEach((n, i) => bass(n, sw(i), BEAT));
    // davul: ride/hihat swing, fırça trampet, yumuşak bas davul
    for (let b = 0; b < 4; b++) {
      noise(sw(b), 0.09, 7000, 0.7, 0.05);
      if (b % 2 === 1) { noise(sw(b + 0.5), 0.05, 8000, 0.7, 0.03); noise(sw(b), 0.18, 1800, 0.6, 0.05, musicBus, 'bandpass'); }
      if (b % 2 === 0) kick(sw(b), 0.28);
    }
    if (melodyOn) MEL[bar].forEach(([b, n, d]) => vibe(n, sw(b), d * BEAT, 0.6));
  }
  function scheduler() {
    while (nextTime < ctx.currentTime + 0.25) {
      const bar = step % FORM.length;
      if (bar === 0) melodyOn = Math.floor(step / FORM.length) % 3 !== 2; // her üç turdan birinde sadece eşlik
      scheduleBar(bar, nextTime);
      nextTime += BEAT * 4;
      step++;
    }
  }
  function startMusic() {
    if (!musicOn || playing || !init()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    playing = true;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 2);
    nextTime = ctx.currentTime + 0.1; step = 0;
    timer = setInterval(scheduler, 60);
    scheduler();
  }
  function stopMusic() {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(0.0001, t + 0.6);
  }

  // ---------- efektler ----------
  const SFX = {
    dice() { for (let i = 0; i < 6; i++) noise(ctx.currentTime + i * 0.07 + Math.random() * 0.03, 0.04, 2500 + Math.random() * 2000, 2, 0.35, sfxBus, 'bandpass'); },
    step() { noise(ctx.currentTime, 0.05, 900, 3, 0.12, sfxBus, 'bandpass'); },
    coin() { const t = ctx.currentTime; [88, 93].forEach((n, i) => keys([n], t + i * 0.08, 0.15, 0.7, sfxBus)); },
    pay() { const t = ctx.currentTime; [76, 71].forEach((n, i) => keys([n], t + i * 0.09, 0.14, 0.5, sfxBus)); },
    buy() { const t = ctx.currentTime; [72, 76, 79, 84].forEach((n, i) => vibe(n, t + i * 0.07, 0.4, 0.9)); },
    jackpot() { const t = ctx.currentTime; [72, 76, 79, 84, 88, 91].forEach((n, i) => vibe(n, t + i * 0.06, 0.5, 1)); for (let i = 0; i < 10; i++) keys([96 + (i % 3) * 2], t + 0.3 + i * 0.05, 0.08, 0.4, sfxBus); },
    jail() { const t = ctx.currentTime; for (let i = 0; i < 4; i++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(i % 2 ? 660 : 880, t + i * 0.25); g.gain.setValueAtTime(0.05, t + i * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.24); o.connect(g); g.connect(sfxBus); o.start(t + i * 0.25); o.stop(t + i * 0.25 + 0.25); } },
    card() { noise(ctx.currentTime, 0.25, 1200, 0.5, 0.18, sfxBus, 'bandpass'); },
    turn() { const t = ctx.currentTime; vibe(79, t, 0.3, 0.7); vibe(84, t + 0.1, 0.5, 0.7); },
  };
  function sfx(name) {
    if (!sfxOn || !init() || !SFX[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    try { SFX[name](); } catch { /* sessizce geç */ }
  }

  // Müzik site açılır açılmaz başlasın. Tarayıcı izin vermezse (otomatik oynatma engeli)
  // sayfadaki ilk dokunuş/tıklama/tuşta kendiliğinden devam eder.
  const unlock = () => {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (musicOn && !playing) startMusic();
  };
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && musicOn && ctx.state === 'suspended') ctx.resume().catch(() => {}); });
  if (musicOn) { try { startMusic(); } catch { /* izin yoksa ilk dokunuşta */ } }

  window.BaronAudio = {
    sfx,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    toggleMusic() { musicOn = !musicOn; store.set('baron_music', musicOn); if (musicOn) startMusic(); else stopMusic(); return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; store.set('baron_sfx', sfxOn); return sfxOn; },
    // test için: müziği çevrimdışı işleyip ses seviyesini ölç
    _renderTest: async (seconds = 6) => {
      const OAC = window.OfflineAudioContext;
      const real = ctx; const oc = new OAC(2, 44100 * seconds, 44100);
      ctx = oc;
      master = oc.createGain(); musicBus = oc.createGain(); musicBus.gain.value = 0.16; sfxBus = oc.createGain();
      musicBus.connect(master); master.connect(oc.destination);
      noiseBuf = oc.createBuffer(1, 44100, 44100); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      melodyOn = true; for (let b = 0, t = 0.05; t < seconds; b++, t += BEAT * 4) scheduleBar(b % FORM.length, t);
      const buf = await oc.startRendering();
      ctx = real; master = null; if (real) { ctx = null; init(); }
      const d = buf.getChannelData(0); let sum = 0, peak = 0;
      for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); }
      return { rms: Math.sqrt(sum / d.length), peak };
    },
  };
})();
