// Uçtan uca: oda kur, kodla katıl, hızlı eşleş, oyunu oyna, yeniden bağlan.
process.env.PORT = 3999;
const { server } = require('../server/index');
const { io } = require('socket.io-client');
const URL = 'http://localhost:3999';
const emit = (s, ev, data) => new Promise((r) => (data === undefined ? s.emit(ev, r) : s.emit(ev, data, r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } else console.log('ok -', m); };
const client = () => { const s = io(URL, { transports: ['websocket'] }); s.state = null; s.on('room:state', (st) => { s.state = st; }); return new Promise((r) => s.on('connect', () => r(s))); };

(async () => {
  const a = await client(), b = await client(), c = await client();
  const ra = await emit(a, 'room:create', { name: 'Ali', roomName: 'Test', maxPlayers: 3, isPublic: true });
  assert(ra.ok && ra.code.length === 5, 'oda oluşturuldu ' + ra.code);
  const list = await emit(c, 'rooms:list');
  assert(list.some((r) => r.code === ra.code), 'açık oda listede görünüyor');
  const rb = await emit(b, 'room:join', { code: ra.code.toLowerCase(), name: '<b>Veli</b>' });
  assert(rb.ok, 'kodla katılındı');
  await wait(100);
  assert(a.state.players.length === 2 && !a.state.players[1].name.includes('<'), 'oyuncu adı temizlendi');
  const bad = await emit(b, 'lobby:start');
  assert(bad.error, 'oda sahibi olmayan başlatamaz');
  const st = await emit(a, 'lobby:start');
  assert(st.ok, 'oyun başladı');
  await wait(100);
  const g = a.state.game;
  assert(g && g.phase === 'roll', 'faz: roll');

  // birkaç tur oyna
  const socks = { [ra.pid]: a, [rb.pid]: b };
  for (let i = 0; i < 40; i++) {
    const gs = a.state.game; const cur = socks[gs.turn];
    if (gs.phase === 'gameover') break;
    let r;
    if (gs.phase === 'roll') r = await emit(cur, 'game:act', { type: 'roll' });
    else if (gs.phase === 'buy') r = await emit(cur, 'game:act', { type: 'buy' }), r.error && (r = await emit(cur, 'game:act', { type: 'decline' }));
    else if (gs.phase === 'auction') { await emit(a, 'game:act', { type: 'pass' }); r = await emit(b, 'game:act', { type: 'pass' }); }
    else if (gs.phase === 'end') {
      const p = gs.players.find((x) => x.id === gs.turn);
      if (p.cash < 0) r = await emit(cur, 'game:act', { type: 'bankrupt' }); else r = await emit(cur, 'game:act', { type: 'endTurn' });
    }
    await wait(30);
  }
  const owned = Object.values(a.state.game.props).filter((p) => p.owner).length;
  assert(a.state.game.rollId > 5, `oyun ilerledi (zar: ${a.state.game.rollId}, sahipli mülk: ${owned})`);
  const wrong = await emit(socks[a.state.game.players.find((p) => p.id !== a.state.game.turn).id], 'game:act', { type: 'roll' });
  assert(wrong.error, 'sırası olmayan zar atamaz: ' + wrong.error);

  // yeniden bağlanma
  b.disconnect();
  await wait(200);
  assert(a.state.game.players.find((p) => p.id === rb.pid).connected === false, 'kopan oyuncu çevrimdışı');
  const b2 = await client();
  const rj = await emit(b2, 'room:rejoin', { code: rb.code, secret: rb.secret });
  assert(rj.ok && rj.pid === rb.pid, 'yeniden bağlandı');
  await wait(100);
  assert(a.state.game.players.find((p) => p.id === rb.pid).connected === true, 'tekrar çevrimiçi');

  // hızlı eşleşme
  const q1 = await client(), q2 = await client();
  const r1 = await emit(q1, 'room:quick', { name: 'Q1' });
  const r2 = await emit(q2, 'room:quick', { name: 'Q2' });
  assert(r1.code === r2.code, 'hızlı eşleşme aynı odaya koydu');
  await wait(100);
  assert(q1.state.autoStartAt > Date.now(), 'otomatik başlatma geri sayımı kuruldu');

  // çıkış = iflas
  await emit(b2, 'room:leave');
  await wait(100);
  assert(a.state.game.phase === 'gameover' && a.state.game.winner === ra.pid, 'ayrılan oyuncu iflas etti, kalan kazandı');

  console.log('TÜM TESTLER GEÇTİ');
  server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
