// Sunucu yalnızca WebRTC bağlantı bilgisini iletir; mikrofon sesi saklanmaz.
function createVoice(io, rooms, getUser) {
  const calls = new Map();
  let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (process.env.VOICE_ICE_SERVERS) {
    iceServers = JSON.parse(process.env.VOICE_ICE_SERVERS);
    if (!Array.isArray(iceServers) || iceServers.some((s) => !s || ![].concat(s.urls || []).length || [].concat(s.urls).some((u) => typeof u !== 'string' || !/^(stun|turn|turns):/.test(u)))) throw new Error('VOICE_ICE_SERVERS geçerli ICE sunucuları içermeli.');
  }
  function context(socket) {
    const room = rooms.get(socket.data.code);
    const player = room?.players.find((p) => p.id === socket.data.pid && p.socketId === socket.id && p.connected && !p.isBot);
    return room && player && !room.isPublic && !room.quick && !room.botGame && room.status !== 'ended' ? { room, player } : null;
  }
  function publish(code) {
    const members = calls.get(code);
    if (!members) return;
    const peers = [...members.values()].map(({ id, name, muted }) => ({ id, name, muted }));
    for (const sid of members.keys()) io.sockets.sockets.get(sid)?.emit('voice:state', { code, peers });
  }
  function leave(socket, notify = false, onlyCode = null) {
    for (const [code, members] of calls) if ((!onlyCode || code === onlyCode) && members.delete(socket.id)) {
      if (notify) socket.emit('voice:closed');
      if (!members.size) calls.delete(code); else publish(code);
    }
  }
  function sync() {
    for (const [code, members] of calls) for (const sid of [...members.keys()]) {
      const socket = io.sockets.sockets.get(sid), current = socket && context(socket);
      if (!socket) { members.delete(sid); publish(code); }
      else if (!current || current.room.code !== code) leave(socket, true);
    }
  }
  function attach(socket) {
    let count = 0, since = Date.now();
    const limited = () => { const now = Date.now(); if (now - since >= 1000) { count = 0; since = now; } return ++count > 80; };
    socket.on('voice:join', async (request, cb) => {
      if (typeof cb !== 'function') return;
      if (limited()) return cb({ error: 'Çok hızlı işlem yapıyorsun.' });
      try {
        const u = await getUser(socket.data.uid), current = context(socket);
        if (!socket.connected || !current || request?.code !== current.room.code || !u || u.session_key !== socket.data.sessionKey) return cb({ error: 'Sesli sohbet yalnızca bulunduğun özel odada kullanılabilir.' });
        leave(socket);
        const { room, player } = current;
        if (!calls.has(room.code)) calls.set(room.code, new Map());
        calls.get(room.code).set(socket.id, { id: player.id, name: player.name, muted: request.muted === true });
        cb({ ok: true, code: room.code, selfId: player.id, iceServers, peers: [...calls.get(room.code).values()] });
        publish(room.code);
      } catch { cb({ error: 'Sesli sohbet başlatılamadı. Tekrar dene.' }); }
    });
    socket.on('voice:leave', (request) => leave(socket, false, request?.code || '-'));
    socket.on('voice:mute', (muted) => {
      if (limited()) return;
      const current = context(socket), member = current && calls.get(current.room.code)?.get(socket.id);
      if (member) { member.muted = !!muted; publish(current.room.code); }
    });
    socket.on('voice:signal', (packet, cb) => {
      const fail = () => typeof cb === 'function' && cb({ error: 'Ses bağlantısı iletilemedi.' });
      if (limited() || !packet || typeof packet !== 'object') return fail();
      const current = context(socket), members = current && calls.get(current.room.code);
      if (!current || !members?.has(socket.id) || packet.code !== current.room.code) return fail();
      const target = [...members.entries()].find(([, p]) => p.id === packet.to);
      if (!target || target[0] === socket.id) return fail();
      const description = packet.description, candidate = packet.candidate;
      if (description && candidate) return fail();
      if (description && (!['offer', 'answer'].includes(description.type) || typeof description.sdp !== 'string' || description.sdp.length > 16000)) return fail();
      if (candidate && (typeof candidate.candidate !== 'string' || candidate.candidate.length > 2000)) return fail();
      if (candidate && ((candidate.sdpMid != null && (typeof candidate.sdpMid !== 'string' || candidate.sdpMid.length > 256)) ||
        (candidate.sdpMLineIndex != null && (!Number.isInteger(candidate.sdpMLineIndex) || candidate.sdpMLineIndex < 0 || candidate.sdpMLineIndex > 10)) ||
        (candidate.usernameFragment != null && (typeof candidate.usernameFragment !== 'string' || candidate.usernameFragment.length > 256)))) return fail();
      if (!description && !candidate) return fail();
      const recipient = io.sockets.sockets.get(target[0]);
      if (!recipient || context(recipient)?.room.code !== current.room.code) return fail();
      recipient.emit('voice:signal', { code: current.room.code, from: current.player.id,
        ...(description ? { description: { type: description.type, sdp: description.sdp } } : { candidate: { candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment } }) });
      if (typeof cb === 'function') cb({ ok: true });
    });
    socket.on('disconnect', () => leave(socket));
  }
  return { attach, sync };
}
module.exports = { createVoice };
