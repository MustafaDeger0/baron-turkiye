// HTTP + Socket.IO sunucusu: oda kurma, kodla katılma, hızlı eşleşme, yeniden bağlanma.
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const { Game } = require('./game');
const { SQUARES, GROUPS } = require('./board');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || false }, pingInterval: 10000, pingTimeout: 8000 });

app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size, players: io.engine.clientsCount }));
app.get('/api/board', (_req, res) => res.json({ squares: SQUARES, groups: GROUPS }));

const ICONS = ['🚗', '🎩', '🐕', '⛵', '🧿', '☕', '🐈', '🚀'];
const COLORS = ['#e63946', '#1d7cf2', '#2a9d8f', '#f4a261', '#9b5de5', '#ff4fa3'];
const LOBBY_GRACE_MS = 20_000;
const QUICK_AUTOSTART_MS = 25_000;
const QUICK_MAX = 4;

/** @type {Map<string, any>} */
const rooms = new Map();

const rid = (n = 8) => crypto.randomBytes(n).toString('hex');
function newCode() {
  const A = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  let c;
  do { c = Array.from({ length: 5 }, () => A[crypto.randomInt(A.length)]).join(''); } while (rooms.has(c));
  return c;
}
function cleanName(n) {
  const s = String(n || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  return s || `Oyuncu${crypto.randomInt(100, 999)}`;
}

function createRoom({ roomName, isPublic, maxPlayers, startMoney, quick }) {
  const code = newCode();
  const room = {
    code,
    name: String(roomName || '').replace(/[<>]/g, '').trim().slice(0, 30) || `Oda ${code}`,
    isPublic: !!isPublic,
    quick: !!quick,
    maxPlayers: Math.min(6, Math.max(2, parseInt(maxPlayers, 10) || 4)),
    startMoney: [1000, 1500, 2000, 2500].includes(+startMoney) ? +startMoney : 1500,
    hostId: null,
    players: [],
    status: 'lobby',
    game: null,
    chat: [],
    chatSeq: 0,
    autoStartAt: null,
    emptySince: null,
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

function addPlayer(room, name) {
  const used = new Set(room.players.map((p) => p.icon));
  const usedC = new Set(room.players.map((p) => p.color));
  const p = {
    id: rid(4), secret: rid(16), name: cleanName(name),
    icon: ICONS.find((i) => !used.has(i)), color: COLORS.find((c) => !usedC.has(c)),
    connected: true, socketId: null, leaveTimer: null,
  };
  // aynı isimden ikinci kişi varsa numaralandır
  if (room.players.some((x) => x.name === p.name)) p.name = `${p.name.slice(0, 13)}#${room.players.length + 1}`;
  room.players.push(p);
  if (!room.hostId) room.hostId = p.id;
  sysChat(room, `${p.name} odaya katıldı.`);
  updateAutoStart(room);
  return p;
}

function removePlayer(room, pid) {
  const p = room.players.find((x) => x.id === pid);
  if (!p) return;
  clearTimeout(p.leaveTimer);
  room.players = room.players.filter((x) => x.id !== pid);
  sysChat(room, `${p.name} odadan ayrıldı.`);
  if (room.hostId === pid) room.hostId = room.players[0] ? room.players[0].id : null;
  if (!room.players.length) { rooms.delete(room.code); return; }
  updateAutoStart(room);
}

function updateAutoStart(room) {
  if (!room.quick || room.status !== 'lobby') return;
  if (room.players.length >= 2) { if (!room.autoStartAt) room.autoStartAt = Date.now() + QUICK_AUTOSTART_MS; }
  else room.autoStartAt = null;
  if (room.players.length >= room.maxPlayers) room.autoStartAt = Math.min(room.autoStartAt, Date.now() + 3000);
}

function startGame(room) {
  if (room.status !== 'lobby' || room.players.length < 2) return 'En az 2 oyuncu gerekli.';
  room.status = 'playing';
  room.autoStartAt = null;
  room.game = new Game(room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, token: p.icon })), { startMoney: room.startMoney });
  room.players.forEach((p) => { if (!p.connected) room.game.setConnected(p.id, false); });
  sysChat(room, 'Oyun başladı, bol şans!');
  return null;
}

function sysChat(room, text) { pushChat(room, null, text); }
function pushChat(room, from, text) {
  room.chat.push({ seq: ++room.chatSeq, from, text, t: Date.now() });
  if (room.chat.length > 60) room.chat.shift();
}

function publicRoom(room) {
  return {
    code: room.code, name: room.name, isPublic: room.isPublic, quick: room.quick,
    maxPlayers: room.maxPlayers, startMoney: room.startMoney, hostId: room.hostId, status: room.status,
    autoStartAt: room.autoStartAt, serverNow: Date.now(),
    players: room.players.map(({ id, name, icon, color, connected }) => ({ id, name, icon, color, connected })),
    chat: room.chat,
    game: room.game ? room.game.toJSON() : null,
  };
}
function broadcast(room) { if (rooms.has(room.code)) io.to(room.code).emit('room:state', publicRoom(room)); }

function listPublic() {
  return [...rooms.values()]
    .filter((r) => r.isPublic && r.status === 'lobby' && r.players.length < r.maxPlayers)
    .map((r) => ({ code: r.code, name: r.name, players: r.players.length, maxPlayers: r.maxPlayers, quick: r.quick }))
    .slice(0, 30);
}
let listDirty = false;
const markList = () => { listDirty = true; };

// ---------- socket ----------
io.on('connection', (socket) => {
  let bucket = 0;
  const limiter = setInterval(() => { bucket = 0; }, 1000);
  const guard = (fn) => (...args) => {
    if (++bucket > 25) return;
    try { fn(...args); } catch (e) { console.error(e); const cb = args.find((a) => typeof a === 'function'); if (cb) cb({ error: 'Sunucu hatası.' }); }
  };
  const ctx = () => {
    const room = rooms.get(socket.data.code);
    const me = room && room.players.find((p) => p.id === socket.data.pid);
    return { room, me };
  };
  const attach = (room, p) => {
    if (socket.data.code && socket.data.code !== room.code) leave();
    clearTimeout(p.leaveTimer);
    // eski soket varsa (başka sekme) ayır
    if (p.socketId && p.socketId !== socket.id) {
      const old = io.sockets.sockets.get(p.socketId);
      if (old) { old.emit('kicked', 'Bu oyuncuya başka bir sekmeden bağlanıldı.'); old.leave(room.code); old.data = {}; }
    }
    p.socketId = socket.id; p.connected = true;
    socket.data = { code: room.code, pid: p.id };
    socket.join(room.code);
    room.emptySince = null;
    if (room.game) room.game.setConnected(p.id, true);
  };
  const leave = () => {
    const { room, me } = ctx();
    socket.data = {};
    if (!room || !me) return;
    socket.leave(room.code);
    if (room.status === 'lobby') removePlayer(room, me.id);
    else {
      me.connected = false; me.socketId = null;
      if (room.game) {
        const gp = room.game.player(me.id);
        if (gp && !gp.bankrupt && room.game.phase !== 'gameover') room.game.bankrupt(gp, 'oyundan ayrıldı');
        room.game.setConnected(me.id, false);
      }
    }
    broadcast(room); markList();
  };

  socket.on('rooms:list', guard((cb) => typeof cb === 'function' && cb(listPublic())));

  socket.on('room:create', guard((opts = {}, cb) => {
    const room = createRoom({ ...opts, quick: false });
    const p = addPlayer(room, opts.name);
    attach(room, p);
    cb({ ok: true, code: room.code, pid: p.id, secret: p.secret });
    broadcast(room); markList();
  }));

  socket.on('room:join', guard(({ code, name } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb({ error: 'Oda bulunamadı.' });
    if (room.status !== 'lobby') return cb({ error: 'Bu odada oyun başlamış.' });
    if (room.players.length >= room.maxPlayers) return cb({ error: 'Oda dolu.' });
    const p = addPlayer(room, name);
    attach(room, p);
    cb({ ok: true, code: room.code, pid: p.id, secret: p.secret });
    broadcast(room); markList();
  }));

  socket.on('room:quick', guard(({ name } = {}, cb) => {
    let room = [...rooms.values()]
      .filter((r) => r.quick && r.isPublic && r.status === 'lobby' && r.players.length < r.maxPlayers)
      .sort((a, b) => b.players.length - a.players.length)[0];
    if (!room) room = createRoom({ roomName: 'Hızlı Oyun', isPublic: true, maxPlayers: QUICK_MAX, quick: true });
    const p = addPlayer(room, name);
    attach(room, p);
    cb({ ok: true, code: room.code, pid: p.id, secret: p.secret });
    broadcast(room); markList();
  }));

  socket.on('room:rejoin', guard(({ code, secret } = {}, cb) => {
    const room = rooms.get(String(code || ''));
    const p = room && room.players.find((x) => x.secret === secret);
    if (!p) return cb({ error: 'Oturum bulunamadı.' });
    attach(room, p);
    cb({ ok: true, code: room.code, pid: p.id, secret: p.secret });
    broadcast(room);
  }));

  socket.on('room:leave', guard((cb) => { leave(); if (typeof cb === 'function') cb({ ok: true }); }));

  socket.on('lobby:start', guard((cb) => {
    const { room, me } = ctx();
    if (!room || !me) return cb && cb({ error: 'Odada değilsin.' });
    if (room.hostId !== me.id) return cb && cb({ error: 'Oyunu yalnızca oda sahibi başlatabilir.' });
    const err = startGame(room);
    if (cb) cb(err ? { error: err } : { ok: true });
    broadcast(room); markList();
  }));

  socket.on('lobby:token', guard(({ icon, color } = {}) => {
    const { room, me } = ctx();
    if (!room || !me || room.status !== 'lobby') return;
    if (ICONS.includes(icon) && !room.players.some((p) => p !== me && p.icon === icon)) me.icon = icon;
    if (COLORS.includes(color) && !room.players.some((p) => p !== me && p.color === color)) me.color = color;
    broadcast(room);
  }));

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
    if (room.game.phase === 'gameover') room.status = 'ended';
    if (cb) cb(err ? { error: err } : { ok: true });
    if (!err) broadcast(room);
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
    if (room.status === 'lobby' && room.autoStartAt && now >= room.autoStartAt) {
      if (!startGame(room)) { broadcast(room); markList(); }
      else room.autoStartAt = null;
    }
    if (room.status === 'playing' && room.game) {
      if (room.game.tick(now)) {
        if (room.game.phase === 'gameover') room.status = 'ended';
        broadcast(room);
      }
    }
    const anyOnline = room.players.some((p) => p.connected);
    if (anyOnline) room.emptySince = null;
    else if (!room.emptySince) room.emptySince = now;
    else if (now - room.emptySince > (room.status === 'playing' ? 10 * 60_000 : 2 * 60_000)) rooms.delete(room.code);
  }
  if (listDirty) { listDirty = false; io.emit('rooms:list', listPublic()); }
}, 1000);

server.listen(PORT, () => console.log(`Baron Türkiye sunucusu http://localhost:${PORT} adresinde çalışıyor`));

module.exports = { server, io };
