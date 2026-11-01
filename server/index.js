// HTTP + Socket.IO sunucusu: hesaplar, çip ekonomisi, odalar, hızlı eşleşme, botlar, yeniden bağlanma.
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Game } = require('./game');
const { SQUARES, GROUPS, K } = require('./board');
const { BOT_NAMES, driveBots } = require('./bots');
const { createStore, publicUser } = require('./db');
const auth = require('./auth');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || false }, pingInterval: 10000, pingTimeout: 8000 });
let db, dbError = null;
try { db = createStore(); } catch (e) { dbError = e.message; db = null; }

// ---------- ekonomi ----------
const STAKES = [0, 50, 100, 250, 500];   // oda giriş ücreti (çip)
const QUICK_STAKE = 100;
const BOT_WIN_PER_BOT = 25;              // botlara karşı kazanınca bot başına çip
const ROUND_LIMITS = [20, 40, 60, 0];    // 0 = sınırsız

const ICONS = ['araba', 'sapka', 'gemi', 'cay', 'nazar', 'ucak', 'tac', 'roket'];
const COLORS = ['#e63946', '#1d7cf2', '#2a9d8f', '#f4a261', '#9b5de5', '#ff4fa3'];
const LOBBY_GRACE_MS = 20_000;
const QUICK_AUTOSTART_MS = 25_000;
const QUICK_MAX = 4;

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
app.get('/health', (_req, res) => res.json({
  ok: !dbError, rooms: rooms.size, players: io.engine.clientsCount,
  db: dbError ? 'hata' : db.kind,
  ...(dbError ? { dbHata: dbError } : {}),
  ...(db && db.where ? { dbAdres: db.where } : {}),
  databaseUrlTanimli: !!(process.env.DATABASE_URL && process.env.DATABASE_URL.trim()),
}));
// Veritabanı hazır değilse hesap isteklerini anlaşılır bir mesajla reddet
app.use('/api', (req, res, next) => {
  if (dbError && req.path !== '/board') return res.status(503).json({ error: `Veritabanına bağlanılamadı: ${dbError}` });
  next();
});
app.get('/api/board', (_req, res) => res.json({ squares: SQUARES, groups: GROUPS, K }));

// ---------- hesap API ----------
const ipOf = (req) => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: 'Sunucu hatası.' }); });
async function userFromReq(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  return m ? auth.userFromToken(db, m[1]) : null;
}

app.post('/api/register', wrap(async (req, res) => {
  if (auth.rateLimited(ipOf(req))) return res.status(429).json({ error: 'Çok fazla deneme. Biraz bekle.' });
  const { username, email, password } = req.body || {};
  const display = String(username || '').trim();
  const mail = auth.normEmail(email);
  if (!auth.NAME_RE.test(display)) return res.status(400).json({ error: 'Kullanıcı adı 3–16 karakter olmalı; harf, rakam ve _ kullanabilirsin.' });
  if (!auth.EMAIL_RE.test(mail)) return res.status(400).json({ error: 'Geçerli bir e-posta adresi gir.' });
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı.' });
  const r = await db.create({ username: auth.normName(display), email: mail, display, passHash: auth.hashPassword(password), sessionKey: auth.newSessionKey() });
  if (r.conflict) return res.status(409).json({ error: r.conflict === 'email' ? 'Bu e-posta ile zaten bir hesap var.' : 'Bu kullanıcı adı alınmış.' });
  res.json({ token: auth.makeToken(r.user), user: publicUser(r.user) });
}));

app.post('/api/login', wrap(async (req, res) => {
  if (auth.rateLimited(ipOf(req))) return res.status(429).json({ error: 'Çok fazla deneme. Biraz bekle.' });
  // kullanıcı adı veya e-posta ile giriş
  const { login, username, password } = req.body || {};
  const id = String(login || username || '').trim();
  const u = id.includes('@') ? await db.byEmail(auth.normEmail(id)) : await db.byName(auth.normName(id));
  if (!u || typeof password !== 'string' || !auth.verifyPassword(password, u.pass_hash)) return res.status(401).json({ error: 'Kullanıcı adı/e-posta veya şifre hatalı.' });
  res.json({ token: auth.makeToken(u), user: publicUser(u) });
}));

app.get('/api/me', wrap(async (req, res) => {
  const u = await userFromReq(req);
  if (!u) return res.status(401).json({ error: 'Oturum geçersiz.' });
  res.json({ user: publicUser(u) });
}));

app.post('/api/daily', wrap(async (req, res) => {
  const u = await userFromReq(req);
  if (!u) return res.status(401).json({ error: 'Oturum geçersiz.' });
  const { user, reward } = await db.claimDaily(u.id);
  if (!reward) return res.status(409).json({ error: 'Bugünün ödülünü zaten aldın. Yarın tekrar gel!', user: publicUser(user) });
  pushUser(user);
  res.json({ reward, user: publicUser(user) });
}));

app.get('/api/leaderboard', wrap(async (_req, res) => {
  const top = await db.top(20);
  res.json({ top: top.map((u) => ({ name: u.display, chips: u.chips, wins: u.wins, games: u.games })) });
}));

const pushUser = (u) => { if (u) io.to(`u:${u.id}`).emit('me', publicUser(u)); };

// ---------- odalar ----------
/** @type {Map<string, any>} */
const rooms = new Map();
const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
function newCode() {
  const A = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function createRoom({ roomName, isPublic, maxPlayers, startMoney, quick, stake, roundLimit, botGame }) {
  const code = newCode();
  const room = {
    code,
    name: String(roomName || '').replace(/[<>]/g, '').trim().slice(0, 30) || `Oda ${code}`,
    isPublic: !!isPublic,
    quick: !!quick,
    botGame: !!botGame,
    maxPlayers: Math.min(6, Math.max(2, parseInt(maxPlayers, 10) || 4)),
    startMoney: [1000, 1500, 2000, 2500].map((x) => x * K).includes(+startMoney) ? +startMoney : 1500 * K,
    stake: STAKES.includes(+stake) ? +stake : 0,
    roundLimit: ROUND_LIMITS.includes(+roundLimit) ? +roundLimit : 40,
    hostId: null,
    players: [],
    status: 'lobby',
    game: null,
    pot: 0,
    paid: [],          // giriş ücreti ödeyen kullanıcılar
    result: null,
    chat: [],
    chatSeq: 0,
    autoStartAt: null,
    emptySince: null,
    createdAt: Date.now(),
  };
  if (room.botGame) room.stake = 0;
  rooms.set(code, room);
  return room;
}

function pickLook(room) {
  const used = new Set(room.players.map((p) => p.icon));
  const usedC = new Set(room.players.map((p) => p.color));
  return { icon: ICONS.find((i) => !used.has(i)), color: COLORS.find((c) => !usedC.has(c)) };
}
function addPlayer(room, user) {
  const p = { id: rid(4), userId: user.id, name: user.display, chips: user.chips, ...pickLook(room), connected: true, socketId: null, leaveTimer: null, isBot: false };
  room.players.push(p);
  if (!room.hostId) room.hostId = p.id;
  sysChat(room, `${p.name} odaya katıldı.`);
  updateAutoStart(room);
  return p;
}
function addBot(room) {
  const used = new Set(room.players.map((p) => p.name));
  const name = BOT_NAMES.find((n) => !used.has(n)) || `Bot ${room.players.length + 1}`;
  const p = { id: `bot-${rid(3)}`, userId: null, name, chips: null, ...pickLook(room), connected: true, socketId: null, isBot: true };
  room.players.push(p);
  sysChat(room, `${name} masaya oturdu.`);
  return p;
}

function removePlayer(room, pid) {
  const p = room.players.find((x) => x.id === pid);
  if (!p) return;
  clearTimeout(p.leaveTimer);
  room.players = room.players.filter((x) => x.id !== pid);
  sysChat(room, `${p.name} odadan ayrıldı.`);
  const humans = room.players.filter((x) => !x.isBot);
  if (room.hostId === pid) room.hostId = humans[0] ? humans[0].id : null;
  if (!humans.length) { rooms.delete(room.code); return; }
  updateAutoStart(room);
}

function updateAutoStart(room) {
  if (!room.quick || room.status !== 'lobby') return;
  if (room.players.length >= 2) { if (!room.autoStartAt) room.autoStartAt = Date.now() + QUICK_AUTOSTART_MS; }
  else room.autoStartAt = null;
  if (room.players.length >= room.maxPlayers) room.autoStartAt = Math.min(room.autoStartAt, Date.now() + 3000);
}

// Oyunu başlat: herkesten giriş ücreti tahsil edilir
async function startGame(room) {
  if (room.status !== 'lobby' || room.starting) return 'Oyun zaten başlıyor.';
  if (room.players.length < 2) return 'En az 2 oyuncu gerekli.';
  room.starting = true;
  try {
    if (room.stake > 0) {
      for (const p of room.players.filter((x) => !x.isBot)) {
        const u = await db.debit(p.userId, room.stake);
        if (u) { room.paid.push(p.userId); room.pot += room.stake; p.chips = u.chips; pushUser(u); }
        else { sysChat(room, `${p.name} giriş ücretini (${room.stake} çip) karşılayamadı ve masadan kalktı.`); removePlayer(room, p.id); }
      }
      if (!rooms.has(room.code)) return 'Oda kapandı.';
      if (room.players.length < 2) {
        await refundAll(room);
        return 'Yeterli oyuncu kalmadı.';
      }
    }
    room.status = 'playing';
    room.autoStartAt = null;
    room.game = new Game(room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, token: p.icon, isBot: p.isBot })),
      { startMoney: room.startMoney, roundLimit: room.roundLimit });
    room.players.forEach((p) => { if (!p.connected) room.game.setConnected(p.id, false); });
    sysChat(room, room.pot ? `Oyun başladı! Masadaki ödül: ${room.pot} çip.` : 'Oyun başladı, bol şans!');
    return null;
  } finally { room.starting = false; }
}
async function refundAll(room) {
  for (const uid of room.paid) pushUser(await db.credit(uid, room.stake));
  room.paid = []; room.pot = 0;
}

// Oyun bitince çipleri dağıt (bir kez)
async function settle(room) {
  if (room.settled || !room.game || room.game.phase !== 'gameover') return;
  room.settled = true;
  room.status = 'ended';
  const g = room.game;
  const winner = room.players.find((p) => p.id === g.winner);
  const deltas = {};
  room.players.filter((p) => !p.isBot).forEach((p) => { deltas[p.id] = room.paid.includes(p.userId) ? -room.stake : 0; });
  let prize = 0;
  if (winner && !winner.isBot) {
    prize = room.pot;
    const bots = room.players.filter((p) => p.isBot).length;
    if (room.botGame) prize += bots * BOT_WIN_PER_BOT;
    if (prize) pushUser(await db.credit(winner.userId, prize));
    deltas[winner.id] = (deltas[winner.id] || 0) + prize;
  }
  for (const p of room.players.filter((x) => !x.isBot)) {
    pushUser(await db.addStats(p.userId, 1, winner && winner.id === p.id ? 1 : 0));
  }
  room.result = { winner: winner ? winner.id : null, pot: room.pot, prize, deltas };
  sysChat(room, winner ? `${winner.name} kazandı${prize ? ` ve ${prize} çip aldı` : ''}!` : 'Oyun bitti.');
  broadcast(room);
}

function sysChat(room, text) { pushChat(room, null, text); }
function pushChat(room, from, text) {
  room.chat.push({ seq: ++room.chatSeq, from, text, t: Date.now() });
  if (room.chat.length > 60) room.chat.shift();
}

function publicRoom(room) {
  return {
    code: room.code, name: room.name, isPublic: room.isPublic, quick: room.quick, botGame: room.botGame,
    maxPlayers: room.maxPlayers, startMoney: room.startMoney, stake: room.stake, pot: room.pot, roundLimit: room.roundLimit,
    hostId: room.hostId, status: room.status, result: room.result,
    autoStartAt: room.autoStartAt, serverNow: Date.now(),
    players: room.players.map(({ id, name, icon, color, connected, isBot, chips }) => ({ id, name, icon, color, connected, isBot, chips })),
    chat: room.chat,
    game: room.game ? room.game.toJSON() : null,
  };
}
function broadcast(room) { if (rooms.has(room.code)) io.to(room.code).emit('room:state', publicRoom(room)); }

function listPublic() {
  return [...rooms.values()]
    .filter((r) => r.isPublic && r.status === 'lobby' && r.players.length < r.maxPlayers)
    .map((r) => ({ code: r.code, name: r.name, players: r.players.length, maxPlayers: r.maxPlayers, quick: r.quick, stake: r.stake }))
    .slice(0, 30);
}
let listDirty = false;
const markList = () => { listDirty = true; };

// Kullanıcının bulunduğu (bitmemiş) oda
function roomOfUser(uid) {
  for (const r of rooms.values()) {
    if (r.status === 'ended') continue;
    const p = r.players.find((x) => x.userId === uid);
    if (p) return { room: r, p };
  }
  return null;
}

// ---------- soket ----------
io.use(async (socket, next) => {
  if (dbError) return next(new Error('server'));
  try {
    const u = await auth.userFromToken(db, socket.handshake.auth && socket.handshake.auth.token);
    if (!u) return next(new Error('auth'));
    socket.data = { uid: u.id, uname: u.display };
    next();
  } catch (e) { next(new Error('server')); }
});

io.on('connection', (socket) => {
  const uid = socket.data.uid;
  socket.join(`u:${uid}`);
  let bucket = 0;
  const limiter = setInterval(() => { bucket = 0; }, 1000);
  const guard = (fn) => (...args) => {
    if (++bucket > 25) return;
    const cb = args.find((a) => typeof a === 'function');
    Promise.resolve().then(() => fn(...args)).catch((e) => { console.error(e); if (cb) cb({ error: 'Sunucu hatası.' }); });
  };
  const ctx = () => {
    const room = rooms.get(socket.data.code);
    const me = room && room.players.find((p) => p.id === socket.data.pid);
    return { room, me };
  };
  const attach = (room, p) => {
    clearTimeout(p.leaveTimer);
    if (p.socketId && p.socketId !== socket.id) {
      const old = io.sockets.sockets.get(p.socketId);
      if (old) { old.emit('kicked', 'Hesabına başka bir sekmeden bağlanıldı.'); old.leave(room.code); old.data.code = null; old.data.pid = null; }
    }
    p.socketId = socket.id; p.connected = true;
    socket.data.code = room.code; socket.data.pid = p.id;
    socket.join(room.code);
    room.emptySince = null;
    if (room.game) room.game.setConnected(p.id, true);
  };
  const leave = () => {
    const { room, me } = ctx();
    socket.data.code = null; socket.data.pid = null;
    if (!room || !me) return;
    socket.leave(room.code);
    if (room.status === 'lobby') removePlayer(room, me.id);
    else {
      me.connected = false; me.socketId = null;
      if (room.game) {
        const gp = room.game.player(me.id);
        if (gp && !gp.bankrupt && room.game.phase !== 'gameover') room.game.bankrupt(gp, 'oyundan ayrıldı');
        room.game.setConnected(me.id, false);
        if (room.game.phase === 'gameover') settle(room);
      }
    }
    broadcast(room); markList();
  };
  // Yeni bir odaya girmeden önce: lobideki eski odadan çık, süren oyun varsa engelle
  const ensureFree = () => {
    const cur = roomOfUser(uid);
    if (!cur) return null;
    if (cur.room.status === 'lobby') { if (socket.data.code !== cur.room.code) { socket.data.code = cur.room.code; socket.data.pid = cur.p.id; } leave(); return null; }
    const gp = cur.room.game && cur.room.game.player(cur.p.id);
    if (gp && !gp.bankrupt) return 'Devam eden bir oyunun var. Önce ona dön ya da çık.';
    return null;
  };
  const canAfford = async (stake) => {
    if (!stake) return null;
    const u = await db.byId(uid);
    return u && u.chips >= stake ? null : `Bu masa için ${stake} çip gerekiyor. Günlük ödülünü almayı unutma!`;
  };
  const joined = (room, p, cb) => { attach(room, p); cb({ ok: true, code: room.code, pid: p.id }); broadcast(room); markList(); };

  socket.on('rooms:list', guard((cb) => typeof cb === 'function' && cb(listPublic())));

  socket.on('room:resume', guard((cb) => {
    const cur = roomOfUser(uid);
    if (!cur) return cb({ none: true });
    attach(cur.room, cur.p);
    cb({ ok: true, code: cur.room.code, pid: cur.p.id });
    broadcast(cur.room);
  }));

  socket.on('room:create', guard(async (opts = {}, cb) => {
    const busy = ensureFree(); if (busy) return cb({ error: busy });
    const stake = STAKES.includes(+opts.stake) ? +opts.stake : 0;
    const err = await canAfford(stake); if (err) return cb({ error: err });
    const u = await db.byId(uid);
    const room = createRoom({ ...opts, stake, quick: false });
    joined(room, addPlayer(room, u), cb);
  }));

  socket.on('room:bots', guard(async (opts = {}, cb) => {
    const busy = ensureFree(); if (busy) return cb({ error: busy });
    const n = Math.min(5, Math.max(1, parseInt(opts.bots, 10) || 3));
    const u = await db.byId(uid);
    const room = createRoom({ roomName: 'Botlarla Oyun', isPublic: false, maxPlayers: n + 1, startMoney: opts.startMoney, roundLimit: opts.roundLimit, botGame: true });
    const p = addPlayer(room, u);
    for (let i = 0; i < n; i++) addBot(room);
    attach(room, p);
    await startGame(room);
    cb({ ok: true, code: room.code, pid: p.id });
    broadcast(room);
  }));

  socket.on('room:join', guard(async ({ code } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb({ error: 'Oda bulunamadı.' });
    const mine = room.players.find((x) => x.userId === uid);
    if (mine) return joined(room, mine, cb);
    if (room.status !== 'lobby') return cb({ error: 'Bu odada oyun başlamış.' });
    if (room.players.length >= room.maxPlayers) return cb({ error: 'Oda dolu.' });
    const busy = ensureFree(); if (busy) return cb({ error: busy });
    const err = await canAfford(room.stake); if (err) return cb({ error: err });
    if (!rooms.has(room.code) || room.status !== 'lobby' || room.players.length >= room.maxPlayers) return cb({ error: 'Oda artık uygun değil.' });
    joined(room, addPlayer(room, await db.byId(uid)), cb);
  }));

  socket.on('room:quick', guard(async (_o, cb) => {
    const busy = ensureFree(); if (busy) return cb({ error: busy });
    const err = await canAfford(QUICK_STAKE); if (err) return cb({ error: err });
    let room = [...rooms.values()]
      .filter((r) => r.quick && r.isPublic && r.status === 'lobby' && r.players.length < r.maxPlayers)
      .sort((a, b) => b.players.length - a.players.length)[0];
    if (!room) room = createRoom({ roomName: 'Hızlı Oyun', isPublic: true, maxPlayers: QUICK_MAX, quick: true, stake: QUICK_STAKE, roundLimit: 40 });
    joined(room, addPlayer(room, await db.byId(uid)), cb);
  }));

  socket.on('room:leave', guard((cb) => { leave(); if (typeof cb === 'function') cb({ ok: true }); }));

  socket.on('lobby:start', guard(async (cb) => {
    const { room, me } = ctx();
    if (!room || !me) return cb && cb({ error: 'Odada değilsin.' });
    if (room.hostId !== me.id) return cb && cb({ error: 'Oyunu yalnızca oda sahibi başlatabilir.' });
    const err = await startGame(room);
    if (cb) cb(err ? { error: err } : { ok: true });
    broadcast(room); markList();
  }));

  socket.on('lobby:bot', guard(({ add, id } = {}, cb) => {
    const { room, me } = ctx();
    const done = (r) => typeof cb === 'function' && cb(r);
    if (!room || !me || room.status !== 'lobby') return done({ error: 'Lobide değilsin.' });
    if (room.hostId !== me.id) return done({ error: 'Botları yalnızca oda sahibi yönetebilir.' });
    if (room.stake > 0) return done({ error: 'Çipli masalara bot eklenemez.' });
    if (add) {
      if (room.players.length >= room.maxPlayers) return done({ error: 'Masa dolu.' });
      addBot(room);
    } else {
      const b = room.players.find((p) => p.id === id && p.isBot);
      if (b) removePlayer(room, b.id);
    }
    done({ ok: true });
    broadcast(room); markList();
  }));

  socket.on('lobby:token', guard(({ icon, color } = {}) => {
    const { room, me } = ctx();
    if (!room || !me || room.status !== 'lobby') return;
    if (ICONS.includes(icon) && !room.players.some((p) => p !== me && p.icon === icon)) me.icon = icon;
    if (COLORS.includes(color) && !room.players.some((p) => p !== me && p.color === color)) me.color = color;
    broadcast(room);
  }));

  if (process.env.DEBUG) {
    // Yalnızca geliştirme: sonraki zarları sabitler (testler için)
    socket.on('debug:dice', (d) => { const { room } = ctx(); if (room && room.game) room.game.forceDice = Array.isArray(d) ? d : null; });
  }

  socket.on('chat', guard((text) => {
    const { room, me } = ctx();
    const t = String(text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200);
    if (!room || !me || !t) return;
    pushChat(room, me.name, t);
    broadcast(room);
  }));

  socket.on('game:act', guard((action, cb) => {
    const { room, me } = ctx();
    if (!room || !me || !room.game) return cb && cb({ error: 'Aktif oyun yok.' });
    const err = room.game.act(me.id, action);
    if (cb) cb(err ? { error: err } : { ok: true });
    if (!err) broadcast(room);
    if (room.game.phase === 'gameover') settle(room);
  }));

  socket.on('disconnect', () => {
    clearInterval(limiter);
    const { room, me } = ctx();
    if (!room || !me || me.socketId !== socket.id) return;
    me.connected = false; me.socketId = null;
    if (room.status === 'lobby') {
      me.leaveTimer = setTimeout(() => {
        if (!me.connected && rooms.has(room.code) && room.status === 'lobby') { removePlayer(room, me.id); broadcast(room); markList(); }
      }, LOBBY_GRACE_MS);
    } else if (room.game) {
      room.game.setConnected(me.id, false);
    }
    broadcast(room);
  });
});

// ---------- ana döngü ----------
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status === 'lobby' && room.autoStartAt && now >= room.autoStartAt && !room.starting) {
      room.autoStartAt = null;
      startGame(room).then((err) => { if (!err) { broadcast(room); markList(); } }).catch(console.error);
    }
    if (room.status === 'playing' && room.game) {
      if (room.game.phase !== 'gameover' && !room.game.players.some((p) => !p.isBot && !p.bankrupt)) room.game.forceEnd('masada oyuncu kalmadı');
      const a = room.game.tick(now);
      const b = driveBots(room.game, now);
      if (a || b) broadcast(room);
      if (room.game.phase === 'gameover') settle(room).catch(console.error);
    }
    const anyOnline = room.players.some((p) => !p.isBot && p.connected);
    if (anyOnline) room.emptySince = null;
    else if (!room.emptySince) room.emptySince = now;
    else if (now - room.emptySince > (room.status === 'playing' ? 10 * 60_000 : 2 * 60_000)) {
      rooms.delete(room.code);
      if (room.status === 'playing' && !room.settled) refundAll(room).catch(console.error); // yarım kalan oyun: ücret iadesi
    }
  }
  if (listDirty) { listDirty = false; io.emit('rooms:list', listPublic()); }
}, 1000);

// Veritabanını hazırla (Neon uykudaysa birkaç kez dene). Başaramazsa sunucu yine açılır,
// /health sayfasında hatanın nedeni görünür — böylece sorun gizli kalmaz.
async function initDb() {
  if (!db) return;
  for (let k = 1; k <= 5; k++) {
    try { await db.init(); dbError = null; return; } catch (e) {
      dbError = e.message;
      console.error(`Veritabanına bağlanılamadı (deneme ${k}/5): ${e.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
console.log(`DATABASE_URL ${process.env.DATABASE_URL && process.env.DATABASE_URL.trim() ? `bulundu → ${db && db.where ? db.where : '(geçersiz)'}` : 'TANIMLI DEĞİL → hesaplar geçici dosyaya yazılacak'}`);
if (dbError) console.error(`HATA: ${dbError}`);
const ready = initDb().then(() => new Promise((ok) => {
  server.listen(PORT, () => {
    console.log(`Baron Türkiye sunucusu http://localhost:${PORT} (veri: ${dbError ? 'HATA' : db.kind})`);
    if (dbError) console.error(`Veritabanı çalışmıyor: ${dbError}. /health sayfasına bak.`);
    else if (db.kind === 'json') console.log('Not: DATABASE_URL bulunamadı, hesaplar yerel dosyaya yazılıyor (Render gibi ortamlarda kalıcı değildir).');
    ok();
  });
}));

module.exports = { server, io, db, ready, rooms };
