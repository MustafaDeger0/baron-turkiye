// İç durum kaydı istemciye gönderilen toJSON'dan ayrıdır: deste sırası dahil korunur.
const { Game } = require('./game');

function snapshot(rooms, persistent = false) {
  return { version: 1, savedAt: Date.now(), rooms: [...rooms.values()].map((room) => ({
    ...room, starting: false, chat: persistent ? [] : room.chat,
    players: room.players.map(({ leaveTimer, ...p }) => p),
    game: room.game ? { ...room.game } : null,
  })) };
}

function restore(rooms, saved, restart = false) {
  if (!saved) return;
  if (saved.version !== 1 || !Array.isArray(saved.rooms)) throw new Error('Desteklenmeyen maç kaydı.');
  rooms.clear();
  const now = Date.now(), pause = Math.max(0, now - saved.savedAt);
  for (const raw of saved.rooms) {
    const room = structuredClone(raw);
    room.starting = false;
    if (room.game) room.game = Object.assign(Object.create(Game.prototype), room.game);
    if (restart) {
      room.emptySince = now;
      room.players.forEach((p) => { p.socketId = null; p.leaveTimer = null; p.connected = !!p.isBot; });
      if (room.autoStartAt) room.autoStartAt += pause + 20_000;
      if (room.game) {
        const g = room.game;
        g.startsAt += pause;
        g.deadline = now + 180_000; // geri dönmek için herkesin üç dakika süresi var
        if (g.auction) g.auction.endsAt = now + 180_000;
        g.players.forEach((p) => {
          p.connected = !!p.isBot; p.offlineSince = p.isBot ? null : now;
          if (p.debtSince) p.debtSince = now + 180_000;
          if (p.nextAt) p.nextAt = now + 180_000;
        });
      }
    }
    rooms.set(room.code, room);
  }
}

function validateOperations(operations) {
  for (const op of operations) {
    if (typeof op.key !== 'string' || !op.key || !Array.isArray(op.entries)) throw new Error('Geçersiz çip işlemi.');
    for (const e of op.entries) {
      if (!Number.isSafeInteger(e.uid) || ![e.chips ?? 0, e.games ?? 0, e.wins ?? 0].every(Number.isSafeInteger)) throw new Error('Geçersiz çip miktarı.');
    }
  }
}

module.exports = { snapshot, restore, validateOperations };
