const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
process.env.PORT = '0'; process.env.DATABASE_URL = '';
process.env.SESSION_SECRET = 'reliability-test-secret';
process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'baron-reliable-')), 'db.json');
process.env.ADMIN_USERS = 'attacker,owner@test.co'; process.env.ADMIN_USER_IDS = '';
process.env.RESEND_API_KEY = 'test-only'; process.env.MAIL_FROM = 'Baron <sender@test.co>'; process.env.PUBLIC_URL = 'https://baron.example';
const { server, io, ready, rooms, db, ticker, runWorld } = require('../server/index');
const { io: connect } = require('socket.io-client');
const sockets = [];
const originalFetch = global.fetch;
let resetLink;
global.fetch = async (url, opts) => {
  if (url === 'https://api.resend.com/emails') { resetLink = JSON.parse(opts.body).text.match(/https:\/\/\S+/)[0]; return new Response('{"id":"mock"}', { status: 200 }); }
  return originalFetch(url, opts);
};
let base;
async function api(route, body, token) {
  const r = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...await r.json() };
}
const emit = (s, ev, value) => new Promise((resolve, reject) => {
  const cb = (err, result) => err ? reject(err) : resolve(result);
  if (value == null) s.timeout(10000).emit(ev, cb); else s.timeout(10000).emit(ev, value, cb);
});
function client(token) {
  return new Promise((resolve, reject) => {
    const s = connect(base, { auth: { token }, transports: ['websocket'], reconnection: false }); sockets.push(s);
    s.on('connect', () => resolve(s)); s.on('connect_error', reject);
  });
}
(async () => {
  await ready; base = `http://127.0.0.1:${server.address().port}`;
  const reg = (name, email = `${name}@test.co`) => api('/api/register', { username: name, email, password: 'secret123' });
  const a = await reg('attacker', 'owner@test.co'), b = await reg('second'), c = await reg('third');
  assert.equal((await api('/api/admin/check', null, a.token)).status, 403, 'e-posta ve ad eşleşmesi yönetici yapmaz');
  const sa = await client(a.token), sb = await client(b.token), sc = await client(c.token);
  const room = await emit(sa, 'room:create', { maxPlayers: 2, stake: 250 });
  const joins = await Promise.all([emit(sb, 'room:join', { code: room.code }), emit(sc, 'room:join', { code: room.code })]);
  assert.equal(joins.filter((x) => x.ok).length, 1, 'son koltuğa yalnızca bir kişi alınır');
  assert.equal(rooms.get(room.code).players.length, 2);
  assert.ok((await emit(sa, 'lobby:start', null)).ok);
  assert.equal((await api('/api/me', null, a.token)).user.chips, 750);
  await runWorld(() => { rooms.get(room.code).game.startsAt = 0; });
  const before = JSON.stringify(rooms.get(room.code).game);
  const commit = db.commitWorld.bind(db);
  db.commitWorld = async () => { throw new Error('test: disk/veritabanı kesintisi'); };
  const active = rooms.get(room.code).game.current().id;
  const currentUid = rooms.get(room.code).players.find((p) => p.id === active).userId;
  const currentSocket = currentUid === a.user.id ? sa : joins[0].ok ? sb : sc;
  assert.ok((await emit(currentSocket, 'game:act', { type: 'roll' })).error, 'kayıt hatasında başarı yanıtı gönderilmez');
  db.commitWorld = commit;
  assert.equal(JSON.stringify(rooms.get(room.code).game), before, 'kayıt hatasında hamle geri alınır');
  assert.ok((await emit(currentSocket, 'game:act', { type: 'roll' })).ok, 'kesinti sonrası tekrar oynanır');
  db.commitWorld = async () => { throw new Error('test: ayrılma kaydı kesintisi'); };
  assert.ok((await emit(sa, 'room:leave', null)).error);
  db.commitWorld = commit;
  assert.equal((await emit(sa, 'room:resume', null)).code, room.code, 'başarısız çıkış koltuğu ve soket üyeliğini korur');
  await db.provisionAdmins([a.user.id]);
  assert.equal((await api('/api/admin/cash', { code: 'missing', delta: 10, pid: '*' }, a.token)).status, 400);
  // Bot oyununa aynı hesaptan eşzamanlı iki giriş sadece tek koltuk yaratır.
  const d = await reg('parallel'), sd1 = await client(d.token), sd2 = await client(d.token);
  const parallel = await Promise.all([emit(sd1, 'room:bots', { bots: 1 }), emit(sd2, 'room:bots', { bots: 1 })]);
  assert.equal(parallel.filter((x) => x.ok).length, 1);
  assert.equal([...rooms.values()].flatMap((r) => r.players).filter((p) => p.userId === d.user.id).length, 1);
  // E-posta çağrısı yerelde taklit edilir; gerçek e-posta gönderilmez.
  const forgot = await api('/api/password/forgot', { email: 'parallel@test.co' }); assert.equal(forgot.status, 200);
  const resetToken = new URLSearchParams(new URL(resetLink).hash.slice(1)).get('reset');
  assert.ok(resetToken);
  const disk = fs.readFileSync(process.env.DATA_FILE, 'utf8'); assert.ok(!disk.includes(resetToken), 'ham sıfırlama anahtarı saklanmaz');
  assert.equal((await api('/api/password/reset', { token: resetToken, password: 'newsecret123' })).status, 200);
  assert.equal((await api('/api/password/reset', { token: resetToken, password: 'another123' })).status, 400);
  assert.equal((await api('/api/me', null, d.token)).status, 401, 'şifre yenilenince eski anahtar kapanır');
  const login = await api('/api/login', { login: 'parallel', password: 'newsecret123' }); assert.ok(login.token);
  assert.equal((await api('/api/password/change', { password: 'newsecret123', newPassword: 'lastsecret123' }, login.token)).status, 200);
  assert.equal((await api('/api/me', null, login.token)).status, 401);
  const last = await api('/api/login', { login: 'parallel', password: 'lastsecret123' });
  assert.equal((await api('/api/logout', {}, last.token)).status, 200);
  assert.equal((await api('/api/me', null, last.token)).status, 401);
  console.log('EŞZAMANLILIK, KAYIT HATASI, YÖNETİCİ VE HESAP TESTLERİ GEÇTİ');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => {
  global.fetch = originalFetch; clearInterval(ticker); sockets.forEach((s) => s.close());
  await new Promise((resolve) => io.close(resolve)); await db.close();
});
