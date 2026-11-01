// Uçtan uca: kayıt/giriş, günlük ödül, çipli oda, hızlı eşleşme, botlu oyun, yeniden bağlanma, ödül dağıtımı.
const os = require('os');
const path = require('path');
process.env.PORT = process.env.PORT || 3999;
if (!process.env.DATABASE_URL) process.env.DATA_FILE = path.join(os.tmpdir(), `baron-test-${Date.now()}.json`);
const { server, ready, rooms } = require('../server/index');
const { io } = require('socket.io-client');
const { driveBots } = require('../server/bots');
const URL = `http://localhost:${process.env.PORT}`;
const emit = (s, ev, data) => new Promise((r) => (data === undefined ? s.emit(ev, r) : s.emit(ev, data, r)));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } else console.log('ok -', m); };
const api = async (p, body, token) => {
  const r = await fetch(URL + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json()) };
};
const client = (token) => new Promise((res, rej) => {
  const s = io(URL, { transports: ['websocket'], auth: { token } });
  s.state = null; s.me = null;
  s.on('room:state', (st) => { s.state = st; });
  s.on('me', (u) => { s.me = u; });
  s.on('connect', () => res(s)); s.on('connect_error', (e) => rej(e));
});
const uniq = Date.now() % 100000;

(async () => {
  await ready;
  // --- hesaplar
  const bad = await api('/api/register', { username: 'a', password: '123456' });
  assert(bad.status === 400, 'kısa kullanıcı adı reddedildi');
  const A = await api('/api/register', { username: `Ali${uniq}`, password: 'gizli123' });
  assert(A.token && A.user.chips === 1000, 'kayıt: 1000 başlangıç çipi');
  const dup = await api('/api/register', { username: `ali${uniq}`, password: 'gizli123' });
  assert(dup.status === 409, 'aynı ad (büyük/küçük harf farkı) reddedildi');
  const wrong = await api('/api/login', { username: `Ali${uniq}`, password: 'yanlis' });
  assert(wrong.status === 401, 'yanlış şifre reddedildi');
  const L = await api('/api/login', { username: `ALİ${uniq}`.replace('İ', 'I').toLowerCase(), password: 'gizli123' });
  assert(L.token, 'giriş başarılı');
  const d1 = await api('/api/daily', {}, A.token);
  assert(d1.reward === 100 && d1.user.chips === 1100 && !d1.user.dailyAvailable, 'günlük ödül: +100 çip');
  const d2 = await api('/api/daily', {}, A.token);
  assert(d2.status === 409, 'aynı gün ikinci ödül verilmez');
  const B = await api('/api/register', { username: `Veli${uniq}`, password: 'gizli123' });
  let noAuth = false; try { await client('sahte'); } catch { noAuth = true; }
  assert(noAuth, 'geçersiz anahtarla soket bağlantısı reddedildi');

  // --- çipli oda
  const a = await client(A.token), b = await client(B.token);
  const ra = await emit(a, 'room:create', { roomName: 'Test', maxPlayers: 2, stake: 250, isPublic: true });
  assert(ra.ok, 'çipli oda kuruldu (250)');
  const bot = await emit(a, 'lobby:bot', { add: true });
  assert(bot.error, 'çipli masaya bot eklenemez');
  const rb = await emit(b, 'room:join', { code: ra.code });
  assert(rb.ok, 'ikinci oyuncu katıldı');
  const st = await emit(a, 'lobby:start');
  assert(st.ok, 'oyun başladı');
  await wait(150);
  assert(a.state.pot === 500, 'masada 500 çip ödül');
  assert(a.me.chips === 850 && b.me.chips === 750, 'giriş ücretleri düşüldü');
  // yeniden bağlanma
  b.disconnect(); await wait(150);
  const b2 = await client(B.token);
  const rs = await emit(b2, 'room:resume');
  assert(rs.ok && rs.code === ra.code, 'oturumla odaya geri dönüldü');
  // B oyundan çıkar -> A kazanır
  await emit(b2, 'room:leave'); await wait(300);
  assert(a.state.status === 'ended' && a.state.result.prize === 500, 'kazanan ödülü aldı');
  assert(a.me.chips === 1350 && a.me.wins === 1 && a.me.games === 1, 'kazananın çipi ve istatistiği güncellendi');
  const me = await api('/api/me', null, B.token);
  assert(me.user.chips === 750 && me.user.games === 1 && me.user.wins === 0, 'kaybedenin kaydı kalıcı');
  await emit(a, 'room:leave');

  // --- yetersiz çip
  const C = await api('/api/register', { username: `Can${uniq}`, password: 'gizli123' });
  const c = await client(C.token);
  const rc = await emit(c, 'room:create', { stake: 500 }); // 1000 çip var, yeterli
  assert(rc.ok, '500 çiplik oda kurulabildi');
  await emit(c, 'room:leave');

  // --- hızlı eşleşme
  const q1 = await emit(a, 'room:quick', {});
  const q2 = await emit(b2, 'room:quick', {});
  assert(q1.code === q2.code, 'hızlı eşleşme aynı masaya koydu');
  await wait(100);
  assert(a.state.stake === 100 && a.state.autoStartAt, 'hızlı masa: 100 çip, otomatik başlatma sayacı');
  await emit(a, 'room:leave'); await emit(b2, 'room:leave');

  // --- botlarla oyun
  const rbots = await emit(c, 'room:bots', { bots: 3, roundLimit: 20 });
  assert(rbots.ok, 'botlarla oyun açıldı');
  await wait(200);
  assert(c.state.status === 'playing' && c.state.players.filter((p) => p.isBot).length === 3, '3 bot masada, oyun başladı');
  const room = rooms.get(rbots.code);
  const human = room.game.players.find((p) => !p.isBot);
  // insanın yerine hızlı oyna: botlar sunucuda kendi oynar
  const t0 = Date.now();
  while (room.game.phase !== 'gameover' && Date.now() - t0 < 90000) {
    if (room.game.current() === human) {
      const ph = room.game.phase;
      if (human.cash < 0) room.game.act(human.id, { type: 'bankrupt' });
      else if (ph === 'roll') room.game.act(human.id, { type: 'roll' });
      else if (ph === 'buy') room.game.act(human.id, { type: 'buy' }) && room.game.act(human.id, { type: 'decline' });
      else if (ph === 'end') room.game.act(human.id, { type: 'endTurn' });
    }
    if (room.game.auction && !room.game.auction.passed.includes(human.id)) room.game.act(human.id, { type: 'pass' });
    for (const p of room.game.players) if (p.isBot) p.nextAt = 0; // test için botları hızlandır
    driveBots(room.game, Date.now());
    await wait(5);
  }
  assert(room.game.phase === 'gameover', `botlu oyun bitti (${room.game.rollId} zar)`);
  await wait(1200);
  assert(c.state.result, `sonuç hesaplandı (kazanan ${c.state.result.winner === human.id ? 'insan' : 'bot'}, ödül ${c.state.result.prize})`);

  const lb = await api('/api/leaderboard');
  assert(lb.top.length >= 3 && lb.top[0].chips >= lb.top[1].chips, 'sıralama tablosu');
  console.log('TÜM TESTLER GEÇTİ');
  server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
