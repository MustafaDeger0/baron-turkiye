/* İsteğe bağlı, özel oda içinde WebRTC sesli sohbet. */
(() => {
  'use strict';
  window.BaronVoice = { create({ socket, onError }) {
    const $ = (id) => document.getElementById(id);
    const bar = $('voiceBar'), joinButton = $('voiceJoin'), muteButton = $('voiceMute'), leaveButton = $('voiceLeave');
    let room = null, stream = null, joining = false, joined = false, muted = false, epoch = 0;
    let iceServers = [], roster = [];
    const peers = new Map();
    function render(message) {
      bar.classList.toggle('hidden', !room?.eligible);
      joinButton.classList.toggle('hidden', joined);
      joinButton.disabled = joining || !socket.connected;
      joinButton.textContent = joining ? 'Bağlanılıyor…' : 'Sesli sohbete bağlan';
      muteButton.classList.toggle('hidden', !joined); leaveButton.classList.toggle('hidden', !joined);
      muteButton.textContent = muted ? 'Mikrofonu aç' : 'Mikrofonu kapat';
      muteButton.setAttribute('aria-pressed', String(muted));
      const connected = [...peers.values()].filter((p) => p.pc.connectionState === 'connected').length;
      $('voiceStatus').textContent = message || (joined ? muted ? 'Mikrofonun kapalı' : roster.length > 1 ? `${connected} kişiyle bağlı` : 'Bağlandın · diğer oyuncular bekleniyor' : 'Mikrofonun kapalı');
      $('voicePeers').textContent = joined ? roster.map((p) => `${p.name}${p.id === room?.selfId ? ' (sen)' : ''}${p.muted ? ' · mikrofon kapalı' : ''}`).join(' / ') : '';
      bar.dataset.state = joined ? 'joined' : joining ? 'joining' : 'idle';
    }
    function removePeer(id) {
      const peer = peers.get(id); if (!peer) return;
      peers.delete(id); peer.pc.onconnectionstatechange = null; peer.pc.onicecandidate = null; peer.pc.close(); peer.audio.remove();
    }
    function leave(notify = true, message) {
      const code = room?.code; epoch++; joining = false; joined = false; muted = false; roster = [];
      if (stream) stream.getTracks().forEach((track) => track.stop()); stream = null;
      for (const id of [...peers.keys()]) removePeer(id);
      if (notify && code && socket.connected) socket.emit('voice:leave', { code });
      render(message);
    }
    function signal(to, data) {
      if (joined && room && socket.connected) socket.emit('voice:signal', { code: room.code, to, ...data });
    }
    function peerFor(id) {
      if (peers.has(id)) return peers.get(id);
      const pc = new RTCPeerConnection({ iceServers });
      const audio = document.createElement('audio'); audio.autoplay = true; audio.setAttribute('playsinline', ''); audio.dataset.peer = id;
      $('voiceAudio').appendChild(audio);
      const peer = { pc, audio, pending: [], queue: Promise.resolve() }; peers.set(id, peer);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = ({ candidate }) => { if (candidate && peers.get(id) === peer) signal(id, { candidate: candidate.toJSON() }); };
      pc.ontrack = ({ streams }) => {
        audio.srcObject = streams[0];
        audio.play().catch(() => { render('Sesi açmak için mikrofon düğmesine dokun'); });
      };
      pc.onconnectionstatechange = () => {
        audio.dataset.connection = pc.connectionState;
        if (pc.connectionState === 'failed') render('Ses bağlantısı kurulamadı. Ayrılıp tekrar bağlanabilirsin.');
        else render();
      };
      return peer;
    }
    function enqueue(peer, work) {
      peer.queue = peer.queue.then(async () => { if (joined && peer.pc.signalingState !== 'closed') await work(); }).catch((e) => {
        if (joined && peer.pc.signalingState !== 'closed') { console.warn('Ses bağlantısı:', e.name); render('Ses bağlantısı kurulamadı. Tekrar bağlanmayı dene.'); }
      });
    }
    function updateRoster(state) {
      if (!joined || state.code !== room?.code) return;
      roster = state.peers;
      const ids = new Set(roster.filter((p) => p.id !== room.selfId).map((p) => p.id));
      for (const id of [...peers.keys()]) if (!ids.has(id)) removePeer(id);
      for (const id of ids) {
        if (peers.has(id)) continue;
        const peer = peerFor(id);
        // Her çiftte yalnızca küçük kimlik teklif üretir; eşzamanlı teklifler önlenir.
        if (room.selfId < id) enqueue(peer, async () => {
          await peer.pc.setLocalDescription(await peer.pc.createOffer());
          signal(id, { description: peer.pc.localDescription.toJSON() });
        });
      }
      render();
    }
    socket.on('voice:state', updateRoster);
    socket.on('voice:signal', (packet) => {
      if (!joined || packet.code !== room?.code || !roster.some((p) => p.id === packet.from)) return;
      const peer = peerFor(packet.from);
      enqueue(peer, async () => {
        if (packet.description) {
          await peer.pc.setRemoteDescription(packet.description);
          for (const candidate of peer.pending.splice(0)) await peer.pc.addIceCandidate(candidate);
          if (packet.description.type === 'offer') {
            await peer.pc.setLocalDescription(await peer.pc.createAnswer());
            signal(packet.from, { description: peer.pc.localDescription.toJSON() });
          }
        } else if (packet.candidate) {
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(packet.candidate); else peer.pending.push(packet.candidate);
        }
      });
    });
    socket.on('voice:closed', () => leave(false, 'Sesli sohbet sona erdi.'));
    socket.on('disconnect', () => leave(false, 'Bağlantı kesildi · mikrofonun kapatıldı'));
    joinButton.onclick = async () => {
      if (joining || joined || !room?.eligible || !socket.connected) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return onError('Sesli sohbet için HTTPS ve mikrofon destekleyen bir tarayıcı gerekli.');
      const attempt = ++epoch, code = room.code; joining = true; render();
      let acquired;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        if (attempt !== epoch || code !== room?.code) { acquired.getTracks().forEach((t) => t.stop()); return; }
        stream = acquired;
        const response = await new Promise((resolve, reject) => socket.timeout(10000).emit('voice:join', { code }, (err, result) => err ? reject(err) : resolve(result)));
        if (attempt !== epoch || code !== room?.code) { acquired.getTracks().forEach((t) => t.stop()); socket.emit('voice:leave', { code }); return; }
        if (!response?.ok) throw new Error(response?.error || 'Sesli sohbet başlatılamadı.');
        joining = false; joined = true; room.selfId = response.selfId; iceServers = response.iceServers;
        stream.getAudioTracks().forEach((t) => { t.onended = () => { if (joined) leave(true, 'Mikrofon bağlantısı kapandı.'); }; });
        updateRoster({ code, peers: response.peers }); render();
      } catch (e) {
        if (acquired) acquired.getTracks().forEach((t) => t.stop());
        if (attempt !== epoch) return;
        leave(); onError(e.name === 'NotAllowedError' ? 'Mikrofon izni verilmedi. İzin vererek tekrar bağlanabilirsin.' : e.name === 'NotFoundError' ? 'Mikrofon bulunamadı.' : e.message || 'Sesli sohbet başlatılamadı.');
      }
    };
    muteButton.onclick = () => {
      if (!joined || !stream) return;
      muted = !muted; stream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
      for (const peer of peers.values()) peer.audio.play().catch(() => {});
      socket.emit('voice:mute', muted); render();
    };
    leaveButton.onclick = () => leave();
    if (window.ResizeObserver) new ResizeObserver(() => window.dispatchEvent(new Event('baron:voice-layout'))).observe(bar);
    addEventListener('pagehide', () => leave());
    return { setRoom(next) {
      if (!next?.eligible || next.code !== room?.code || next.selfId !== room?.selfId) leave();
      room = next; render();
    } };
  } };
})();
