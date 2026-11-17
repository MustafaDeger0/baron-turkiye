const assert = require('node:assert/strict');
const { fork } = require('child_process');
const { once } = require('events');
const { io } = require('socket.io-client');
const fs = require('fs'), path = require('path'), os = require('os');
const data = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'baron-restart-')), 'db.json');
let child, base; const sockets = [];
async function start() {
  child = fork(path.join(__dirname, 'server-fixture.js'), [], { env: { ...process.env, PORT: '0', DATABASE_URL: '', DATA_FILE: data, SESSION_SECRET: 'restart-secret' }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
  const [msg] = await once(child, 'message'); base = `http://127.0.0.1:${msg.port}`;
}
async function stop() { const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited; }
async function api(route, body, token) {
  const r = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return r.json();
}
const emit = (s, event, data) => new Promise((resolve, reject) => { const cb = (err, result) => err ? reject(err) : resolve(result); if (data == null) s.timeout(10000).emit(event, cb); else s.timeout(10000).emit(event, data, cb); });
const client = (token) => new Promise((resolve, reject) => { const s = io(base, { auth: { token }, reconnection: false }); sockets.push(s); s.on('connect', () => resolve(s)); s.on('connect_error', reject); });
async function inspect(type) { const result = once(child, 'message'); child.send({ type }); const [message] = await result; if (message.error) throw Error(message.error); return message; }
(async () => {
  await start();
  const reg = (username) => api('/api/register', { username, email: `${username}@test.co`, password: 'secret123' });
  const a = await reg('restartA'), b = await reg('restartB');
  const sa = await client(a.token), sb = await client(b.token);
  const room = await emit(sa, 'room:create', { maxPlayers: 2, stake: 250 });
  await emit(sb, 'room:join', { code: room.code }); await emit(sa, 'lobby:start', null);
  const before = await inspect('checkpoint');
  await stop(); sockets.forEach((s) => s.close());
  await start();
  const after = await inspect('inspect');
  for (const key of ['props', 'decks', 'dice', 'rollId']) assert.deepEqual(after[key], before[key], `${key} yeniden başlatmada korunur`);
  const ra = await client(a.token), rb = await client(b.token);
  assert.equal((await emit(ra, 'room:resume', null)).code, room.code);
  assert.equal((await emit(rb, 'room:resume', null)).code, room.code);
  assert.equal((await api('/api/me', null, a.token)).user.chips, 750);
  await emit(rb, 'room:leave', null);
  assert.equal((await api('/api/me', null, a.token)).user.chips, 1250);
  await stop(); sockets.forEach((s) => s.close()); await start();
  const final = (await api('/api/me', null, a.token)).user;
  assert.equal(final.chips, 1250); assert.equal(final.wins, 1);
  console.log('GERÇEK SÜREÇ YENİDEN BAŞLATMA VE TEK ÖDÜL TESTİ GEÇTİ');
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { sockets.forEach((s) => s.close()); if (child && child.exitCode === null && !child.killed) await stop(); });
