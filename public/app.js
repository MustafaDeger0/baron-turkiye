/* Baron Türkiye — istemci */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tl = (n) => `${n < 0 ? '−' : ''}B${Math.abs(Math.round(n)).toLocaleString('tr-TR')}`;
  const after = (ms, fn) => (ms > 0 ? setTimeout(fn, ms) : fn());
  const ICONS = ['🚗', '🎩', '🐕', '⛵', '🧿', '☕', '🐈', '🚀'];
  const COLORS = ['#e63946', '#1d7cf2', '#2a9d8f', '#f4a261', '#9b5de5', '#ff4fa3'];
  const GROUP_ORDER = ['kahve', 'acikmavi', 'pembe', 'turuncu', 'kirmizi', 'sari', 'yesil', 'lacivert'];
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DICE_MS = REDUCED ? 0 : 1050;
  const STEP_MS = 210;

  // ---------- Baron Doları banknotları ----------
  const NOTES = [500, 100, 50, 20, 10, 5, 1];
  const NOTE_STYLE = {
    1: ['#f4f1ea', '#5f6368'], 5: ['#f9c9dc', '#9c2759'], 10: ['#fbe58a', '#7a5f00'], 20: ['#bfe8c8', '#1f6e3a'],
    50: ['#c2d9f7', '#1d4f9c'], 100: ['#f6d3a8', '#93500f'], 500: ['#dccbf5', '#4b2380'],
  };
  function noteSVG(d) {
    const [bg, ink] = NOTE_STYLE[d];
    return `<svg class="note" viewBox="0 0 160 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="157" height="77" rx="7" fill="${bg}" stroke="${ink}" stroke-width="3"/>
      <rect x="8" y="8" width="144" height="64" rx="4" fill="none" stroke="${ink}" stroke-width="1.2" stroke-dasharray="4 2" opacity=".55"/>
      <path d="M8 40 Q 40 22 80 40 T 152 40" stroke="${ink}" stroke-width="1" fill="none" opacity=".25"/>
      <path d="M8 46 Q 40 28 80 46 T 152 46" stroke="${ink}" stroke-width="1" fill="none" opacity=".25"/>
      <circle cx="80" cy="42" r="21" fill="#fff" opacity=".55" stroke="${ink}" stroke-width="1.5"/>
      <text x="80" y="53" text-anchor="middle" font-size="31" font-weight="900" fill="${ink}" font-family="Rubik,Arial,sans-serif">B</text>
      <text x="80" y="18" text-anchor="middle" font-size="7.5" letter-spacing="2.5" fill="${ink}" font-weight="800" font-family="Rubik,Arial,sans-serif">BARON BANKASI</text>
      <text x="80" y="73" text-anchor="middle" font-size="6" letter-spacing="2" fill="${ink}" font-weight="700" font-family="Rubik,Arial,sans-serif">BARON DOLARI</text>
      <text x="15" y="27" font-size="15" font-weight="900" fill="${ink}" font-family="Rubik,Arial,sans-serif">${d}</text>
      <text x="145" y="68" text-anchor="end" font-size="15" font-weight="900" fill="${ink}" font-family="Rubik,Arial,sans-serif">${d}</text>
    </svg>`;
  }
  const noteFor = (amt) => NOTES.find((n) => n <= amt) || 1;
  function breakdown(amt) {
    const out = [];
    let r = Math.max(0, amt);
    for (const n of NOTES) { const c = Math.floor(r / n); if (c) out.push([n, c]); r -= c * n; }
    return out;
  }

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* yok */ } },
  };

  let BOARD = null;
  let room = null;              // ekrana uygulanmış durum
  let latest = null;            // sunucudan gelen en son durum
  let prevGame = null;
  let session = store.get('baron_session');
  let skew = 0;
  let boardBuilt = false;
  let lastLogSeq = 0, seenChatSeq = 0;
  let modalRender = null;
  const queue = [];
  let busy = false;
  const shownPos = {};          // piyonların ekrandaki konumu
  const pawnEls = {};
  const cashShown = {};
  const cashTweens = {};

  const socket = io({ transports: ['websocket', 'polling'] });

  // ---------- yardımcılar ----------
  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  function showScreen(id) { ['home', 'lobby', 'game'].forEach((s) => $(`#${s}`).classList.toggle('hidden', s !== id)); }
  function myName() { return $('#nameInput').value.trim(); }
  function saveSession(res) {
    session = { code: res.code, secret: res.secret, pid: res.pid };
    store.set('baron_session', session);
    history.replaceState(null, '', `?oda=${res.code}`);
  }
  function clearSession() {
    session = null; room = null; latest = null; prevGame = null; queue.length = 0; busy = false;
    store.set('baron_session', null);
    history.replaceState(null, '', location.pathname);
    boardBuilt = false; renderGameOver.done = false; lastLogSeq = 0; seenChatSeq = 0;
    [shownPos, pawnEls, cashShown].forEach((o) => Object.keys(o).forEach((k) => delete o[k]));
    $('#tokenLayer').innerHTML = '';
    $('#overlay').classList.add('hidden');
    closeModal();
    showScreen('home');
    socket.emit('rooms:list', renderRooms);
  }
  const handle = (res) => {
    if (res && res.error) { toast(res.error, 'err'); return false; }
    if (res && res.secret) saveSession(res);
    return true;
  };
  function act(type, extra = {}) {
    socket.emit('game:act', { type, ...extra }, (res) => { if (res && res.error) toast(res.error, 'err'); });
  }
  const now = () => Date.now() + skew;
  const game = () => room && room.game;
  const me = () => game() && session && game().players.find((p) => p.id === session.pid);
  const playerById = (id) => game() && game().players.find((p) => p.id === id);
  const sq = (i) => BOARD.squares[i];
  const groupColor = (s) => (s.group ? BOARD.groups[s.group].color : s.type === 'station' ? '#3b4046' : '#8a8a8a');

  // ---------- modal ----------
  function openModal(renderFn) {
    modalRender = renderFn;
    $('#modalBody').innerHTML = '';
    renderFn($('#modalBody'));
    $('#modal').classList.remove('hidden');
  }
  function closeModal() { modalRender = null; $('#modal').classList.add('hidden'); }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.key === 'f' || e.key === 'F') && !e.target.closest('input,textarea,select') && !$('#game').classList.contains('hidden')) toggleFullscreen();
  });
  function confirmBox(text, yesLabel, onYes) {
    openModal((el) => {
      el.innerHTML = `<h3>${esc(text)}</h3><div class="modal-actions"><button class="btn primary" id="cYes">${esc(yesLabel)}</button><button class="btn" data-close>Vazgeç</button></div>`;
      $('#cYes', el).onclick = () => { closeModal(); onYes(); };
    });
  }

  // ---------- tam ekran ----------
  function toggleFullscreen() {
    const d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      const el = d.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
    } else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  }
  $('#fsBtn').onclick = toggleFullscreen;
  document.addEventListener('fullscreenchange', () => {
    $('#fsBtn').textContent = document.fullscreenElement ? '🗗 Küçült' : '⛶ Tam ekran';
    setTimeout(() => layoutPawns(false), 120);
  });

  // ---------- ana menü ----------
  (function notesBackground() {
    const bg = $('#notesBg');
    const list = [1, 5, 10, 20, 50, 100, 500, 100, 50, 20, 500, 10];
    bg.innerHTML = list.map((d, i) => {
      const left = (i * 8.3 + Math.random() * 6) % 96;
      const dur = 16 + Math.random() * 14;
      const delay = -Math.random() * dur;
      const r0 = Math.round(Math.random() * 60 - 30), r1 = r0 + Math.round(Math.random() * 240 - 120);
      return `<div class="note-float" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;--r0:${r0}deg;--r1:${r1}deg">${noteSVG(d)}</div>`;
    }).join('');
  })();

  $('#nameInput').value = store.get('baron_name') || '';
  $('#nameInput').addEventListener('change', () => store.set('baron_name', myName()));
  const params = new URLSearchParams(location.search);
  if (params.get('oda')) $('#codeInput').value = params.get('oda').toUpperCase();

  $('#quickBtn').onclick = () => { store.set('baron_name', myName()); socket.emit('room:quick', { name: myName() }, handle); };
  $('#showCreateBtn').onclick = () => $('#createForm').classList.toggle('hidden');
  $('#createForm').onsubmit = (e) => {
    e.preventDefault();
    store.set('baron_name', myName());
    socket.emit('room:create', {
      name: myName(), roomName: $('#roomNameInput').value, maxPlayers: +$('#maxPlayersSel').value,
      startMoney: +$('#startMoneySel').value, isPublic: $('#publicSel').value === '1',
    }, handle);
  };
  const join = (code) => { store.set('baron_name', myName()); socket.emit('room:join', { code, name: myName() }, handle); };
  $('#joinBtn').onclick = () => { const c = $('#codeInput').value.trim(); if (c.length < 5) return toast('5 haneli oda kodunu gir.', 'err'); join(c); };
  $('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });

  function renderRooms(list) {
    const ul = $('#publicRooms');
    if (!Array.isArray(list) || !list.length) { ul.innerHTML = '<li class="muted">Şu an açık oda yok. İlk odayı sen kur!</li>'; return; }
    ul.innerHTML = list.map((r) => `<li class="room"><div><b>${esc(r.name)}</b>${r.quick ? '<span class="tag">HIZLI</span>' : ''}<div class="muted">${r.players}/${r.maxPlayers} oyuncu · ${esc(r.code)}</div></div><button class="btn sm" data-join="${esc(r.code)}">Katıl</button></li>`).join('');
    $$('[data-join]', ul).forEach((b) => { b.onclick = () => join(b.dataset.join); });
  }

  // ---------- bağlantı & durum kuyruğu ----------
  socket.on('connect', () => {
    $('#conn').classList.add('hidden');
    if (session) {
      socket.emit('room:rejoin', session, (res) => { if (res && res.error) clearSession(); else handle(res); });
    } else {
      showScreen('home');
      socket.emit('rooms:list', renderRooms);
    }
  });
  socket.on('disconnect', () => $('#conn').classList.remove('hidden'));
  socket.on('rooms:list', renderRooms);
  socket.on('kicked', (msg) => { toast(msg, 'err'); session = null; room = null; showScreen('home'); });
  socket.on('room:state', (s) => {
    skew = s.serverNow - Date.now();
    latest = s;
    renderChat(s);
    if (!s.game) { queue.length = 0; busy = false; room = s; prevGame = null; showScreen('lobby'); renderLobby(); return; }
    queue.push(s);
    pump();
  });
  function pump() {
    if (busy || !queue.length || !BOARD) return;
    const s = queue.shift();
    busy = true;
    const fast = REDUCED || queue.length > 2;   // geride kalırsak animasyonları atla
    const dur = applyGame(s, fast);
    setTimeout(() => { busy = false; pump(); }, dur);
  }

  // ---------- lobi ----------
  function renderLobby() {
    $('#lobbyName').textContent = room.name;
    $('#lobbyInfo').textContent = `${room.players.length}/${room.maxPlayers} oyuncu · Başlangıç parası ${tl(room.startMoney)} · ${room.isPublic ? 'Herkese açık' : 'Özel oda'}`;
    $('#lobbyCode').textContent = room.code;
    const mine = room.players.find((p) => p.id === session.pid);
    $('#lobbyPlayers').innerHTML = room.players.map((p) => `
      <li class="${p.connected ? '' : 'off'}">
        <span class="pawn-chip" style="--c:${p.color}">${p.icon}</span>
        <b>${esc(p.name)}</b>${p.id === session.pid ? ' <span class="muted">(sen)</span>' : ''}
        ${p.id === room.hostId ? '<span class="crown">👑 Oda sahibi</span>' : ''}
      </li>`).join('') + Array.from({ length: room.maxPlayers - room.players.length }, () => '<li class="muted">Boş koltuk…</li>').join('');
    const takenI = new Set(room.players.filter((p) => p !== mine).map((p) => p.icon));
    const takenC = new Set(room.players.filter((p) => p !== mine).map((p) => p.color));
    $('#iconPicker').innerHTML = ICONS.map((i) => `<button class="chip ${mine && mine.icon === i ? 'sel' : ''} ${takenI.has(i) ? 'taken' : ''}" data-icon="${i}">${i}</button>`).join('');
    $('#colorPicker').innerHTML = COLORS.map((c) => `<button class="chip ${mine && mine.color === c ? 'sel' : ''} ${takenC.has(c) ? 'taken' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');
    $$('[data-icon]').forEach((b) => { b.onclick = () => socket.emit('lobby:token', { icon: b.dataset.icon }); });
    $$('[data-color]').forEach((b) => { b.onclick = () => socket.emit('lobby:token', { color: b.dataset.color }); });
    const host = room.hostId === session.pid;
    $('#startBtn').classList.toggle('hidden', !host);
    $('#startBtn').disabled = room.players.length < 2;
    $('#startBtn').textContent = room.players.length < 2 ? 'En az 2 oyuncu bekleniyor…' : 'Oyunu Başlat';
    $('#waitHost').classList.toggle('hidden', host);
  }
  $('#startBtn').onclick = () => socket.emit('lobby:start', handle);
  $('#leaveLobbyBtn').onclick = () => socket.emit('room:leave', () => clearSession());
  $('#copyLinkBtn').onclick = async () => {
    const url = `${location.origin}${location.pathname}?oda=${room.code}`;
    try { await navigator.clipboard.writeText(url); toast('Davet linki kopyalandı!'); } catch { prompt('Linki kopyala:', url); }
  };

  // ---------- sohbet ----------
  function renderChat(r) {
    const html = r.chat.map((m) => (m.from ? `<li><b>${esc(m.from)}:</b>${esc(m.text)}</li>` : `<li class="sys">${esc(m.text)}</li>`)).join('');
    ['#lobbyChat', '#gameChat'].forEach((id) => {
      const ul = $(id);
      const atBottom = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 40;
      ul.innerHTML = html;
      if (atBottom) ul.scrollTop = ul.scrollHeight;
    });
    const last = r.chat.length ? r.chat[r.chat.length - 1].seq : 0;
    const chatOpen = !$('[data-body="chat"]').classList.contains('hidden') || r.status === 'lobby';
    if (chatOpen) seenChatSeq = last;
    const unread = r.chat.filter((m) => m.seq > seenChatSeq && m.from).length;
    $('#chatBadge').textContent = unread;
    $('#chatBadge').classList.toggle('hidden', !unread);
  }
  $$('[data-chat]').forEach((f) => {
    f.onsubmit = (e) => {
      e.preventDefault();
      const inp = $('input', f);
      if (inp.value.trim()) socket.emit('chat', inp.value);
      inp.value = '';
    };
  });
  $$('.tab').forEach((t) => {
    t.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $$('.tab-body').forEach((b) => b.classList.toggle('hidden', b.dataset.body !== t.dataset.tab));
      if (t.dataset.tab === 'chat' && latest) { renderChat(latest); const ul = $('#gameChat'); ul.scrollTop = ul.scrollHeight; }
    };
  });

  // ---------- tahta ----------
  function gridPos(i) {
    if (i <= 10) return { r: 11, c: 11 - i, side: i % 10 === 0 ? 'corner' : 'bottom' };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, side: i === 20 ? 'corner' : 'left' };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), side: i === 30 ? 'corner' : 'top' };
    return { r: 1 + (i - 30), c: 11, side: 'right' };
  }
  const nameCls = (n) => (n.length > 8 ? 'nm long' : 'nm');
  function squareHTML(s) {
    if (s.type === 'prop') return `<div class="band"></div><div class="ct"><div class="${nameCls(s.name)}">${esc(s.name)}</div><div class="pr">${tl(s.price)}</div></div>`;
    return `<div class="ct">${squareInner(s)}</div>`;
  }
  function squareInner(s) {
    switch (s.type) {
      case 'station': {
        const ic = s.name.includes('Liman') ? '🚢' : s.name.includes('Havalimanı') ? '✈️' : '🚆';
        return `<div class="${nameCls(s.name)}">${esc(s.name)}</div><div class="ic">${ic}</div><div class="pr">${tl(s.price)}</div>`;
      }
      case 'utility': return `<div class="${nameCls(s.name)}">${esc(s.name)}</div><div class="ic">${s.icon}</div><div class="pr">${tl(s.price)}</div>`;
      case 'chance': return '<div class="nm">ŞANS</div><div class="ic">?</div><div></div>';
      case 'chest': return '<div class="nm">KAMU FONU</div><div class="ic">💰</div><div></div>';
      case 'tax': return `<div class="${nameCls(s.name)}">${esc(s.name)}</div><div class="ic">💸</div><div class="pr">${tl(s.amount)}</div>`;
      case 'go': return '<div>BAŞLANGIÇ</div><div class="big-arrow">⟵</div><div class="pr">Geçerken B200 al</div>';
      case 'jail': return '<div class="ic">🔒</div><div>HAPİS</div><div class="pr">sadece ziyaret</div>';
      case 'parking': return '<div class="ic">🅿️</div><div>ÜCRETSİZ<br>OTOPARK</div>';
      case 'gotojail': return '<div class="ic">👮</div><div>HAPSE<br>GİR</div>';
      default: return '';
    }
  }
  function buildBoard() {
    const b = $('#board');
    $$('.sq', b).forEach((x) => x.remove());
    BOARD.squares.forEach((s, i) => {
      const { r, c, side } = gridPos(i);
      const d = document.createElement('div');
      d.className = `sq ${side} ${s.type}${side === 'corner' ? ' corner' : ''}`;
      d.style.gridRow = r; d.style.gridColumn = c;
      d.style.setProperty('--gc', groupColor(s));
      d.dataset.idx = i;
      d.innerHTML = squareHTML(s);
      d.title = s.name;
      d.onclick = () => openDeed(i);
      b.appendChild(d);
    });
    $('#die1').innerHTML = cubeHTML(); $('#die2').innerHTML = cubeHTML();
    boardBuilt = true;
  }
  const sqEl = (i) => $(`.sq[data-idx="${i}"]`);

  function updateBoard(g, prev, fast) {
    BOARD.squares.forEach((s, i) => {
      const pr = g.props[i];
      if (!pr) return;
      const pp = prev && prev.props[i];
      const el = sqEl(i);
      el.classList.toggle('mortgaged', pr.mortgaged);
      let flag = $('.owner-flag', el);
      const owner = pr.owner && playerById(pr.owner);
      el.classList.toggle('owned', !!owner);
      if (owner) {
        el.style.setProperty('--oc', owner.color);
        if (!flag) { flag = document.createElement('div'); flag.className = 'owner-flag'; el.appendChild(flag); }
        flag.style.background = owner.color;
        flag.title = `Sahibi: ${owner.name}`;
        if (!fast && pp && pp.owner !== pr.owner) stamp(i, owner.color, pp.owner ? 'DEVREDİLDİ' : 'SATILDI!');
      } else if (flag) flag.remove();
      if (s.type === 'prop') {
        const band = $('.band', el);
        band.innerHTML = pr.houses === 5 ? '<i class="hotel"></i>' : '<i class="house"></i>'.repeat(pr.houses);
        if (!fast && pp && pr.houses > pp.houses) { band.classList.remove('pop'); void band.offsetWidth; band.classList.add('pop'); stamp(i, '#18a04a', pr.houses === 5 ? '🏨 OTEL!' : '🏠 EV!'); }
      }
    });
  }
  function stamp(i, color, text) {
    const el = sqEl(i);
    const st = document.createElement('div');
    st.className = 'stamp';
    st.style.setProperty('--sc', color);
    st.textContent = text;
    el.appendChild(st);
    setTimeout(() => st.remove(), 1900);
  }
  function pulseSquare(i) {
    const el = sqEl(i); if (!el) return;
    el.classList.remove('highlight'); void el.offsetWidth; el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 1900);
  }

  // ---------- piyonlar ----------
  function ensurePawns(g) {
    g.players.forEach((p) => {
      if (!pawnEls[p.id]) {
        const d = document.createElement('div');
        d.className = 'pawn';
        d.innerHTML = `<div class="pb" style="--c:${p.color}">${p.token}</div>`;
        d.style.setProperty('--c', p.color);
        d.title = p.name;
        $('#tokenLayer').appendChild(d);
        pawnEls[p.id] = d;
      }
      if (shownPos[p.id] === undefined) shownPos[p.id] = p.pos;
    });
  }
  function styleOfPawns(g) {
    g.players.forEach((p) => {
      const el = pawnEls[p.id]; if (!el) return;
      el.style.display = p.bankrupt ? 'none' : '';
      el.classList.toggle('cur', g.turn === p.id && g.phase !== 'gameover');
      el.classList.toggle('jailed', p.inJail);
    });
  }
  function layoutPawns(animate = true) {
    const g = game(); if (!g) return;
    const groups = {};
    g.players.filter((p) => !p.bankrupt && pawnEls[p.id]).forEach((p) => { (groups[shownPos[p.id]] ||= []).push(p.id); });
    for (const [pos, ids] of Object.entries(groups)) {
      const el = sqEl(pos); if (!el) continue;
      const cx = el.offsetLeft + el.offsetWidth / 2, cy = el.offsetTop + el.offsetHeight / 2;
      const r = ids.length > 1 ? Math.min(el.offsetWidth, el.offsetHeight) * 0.24 : 0;
      ids.forEach((id, k) => {
        const a = (k / ids.length) * Math.PI * 2 - Math.PI / 2;
        const pe = pawnEls[id];
        if (!animate) pe.style.transition = 'none';
        pe.style.left = `${cx + Math.cos(a) * r}px`;
        pe.style.top = `${cy + Math.sin(a) * r}px`;
        if (!animate) { void pe.offsetWidth; pe.style.transition = ''; }
      });
    }
  }
  window.addEventListener('resize', () => layoutPawns(false));

  function setPawn(pid, pos, mode, dur) {
    shownPos[pid] = pos;
    const pe = pawnEls[pid]; if (!pe) return;
    pe.classList.remove('hop', 'jump');
    if (mode === 'hop') { pe.style.transition = `left ${dur}ms ease, top ${dur}ms ease`; pe.style.setProperty('--hd', `${dur}ms`); void pe.offsetWidth; pe.classList.add('hop'); }
    else if (mode === 'jump') { pe.style.transition = ''; void pe.offsetWidth; pe.classList.add('jump'); }
    layoutPawns(mode !== 'none');
  }
  function pathOf(m) {
    const path = [];
    if (m.kind === 'back') { for (let p = m.from; p !== m.to;) { p = (p + 39) % 40; path.push(p); } }
    else { for (let p = m.from; p !== m.to;) { p = (p + 1) % 40; path.push(p); } }
    return path;
  }
  const stepFor = (len) => (len > 12 ? Math.max(70, Math.round(2400 / len)) : STEP_MS);
  function movesDuration(moves) {
    return (moves || []).reduce((t, m) => t + (m.kind === 'jail' ? 950 : pathOf(m).length * stepFor(pathOf(m).length) + 80), 0);
  }
  function animateMoves(moves, g) {
    let t = 0;
    for (const m of moves) {
      if (m.kind === 'jail') {
        after(t, () => { setPawn(m.pid, 10, 'jump'); banner('🚔 HAPSE!', 'jail'); });
        t += 950;
        continue;
      }
      const path = pathOf(m), step = stepFor(path.length);
      path.forEach((pos, k) => after(t + k * step, () => setPawn(m.pid, pos, 'hop', step)));
      t += path.length * step;
      const to = m.to;
      after(t, () => pulseSquare(to));
      t += 80;
    }
    after(t, () => snapTokens(g));
    return t;
  }
  function snapTokens(g) {
    let moved = false;
    g.players.forEach((p) => { if (shownPos[p.id] !== p.pos) { shownPos[p.id] = p.pos; moved = true; } });
    if (moved) layoutPawns(true);
  }

  // ---------- 3D zar ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const FACE_ROT = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] };
  const spin = [[0, 0], [0, 0]];
  function cubeHTML() {
    return `<div class="cube">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="face f${n}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
  }
  function setDice([a, b], roll) {
    [a, b].forEach((n, i) => {
      const die = $(`#die${i + 1}`), cube = $('.cube', die);
      if (!cube) return;
      if (roll) {
        spin[i][0] += 720 + 360 * Math.floor(Math.random() * 2);
        spin[i][1] += 720 + 360 * Math.floor(Math.random() * 2);
        cube.style.transition = `transform ${DICE_MS - 100}ms cubic-bezier(.12,.75,.28,1)`;
        die.classList.remove('tumble'); void die.offsetWidth; die.classList.add('tumble');
      } else cube.style.transition = 'none';
      const [fx, fy] = FACE_ROT[n];
      cube.style.transform = `rotateX(${spin[i][0] + fx}deg) rotateY(${spin[i][1] + fy}deg)`;
    });
  }

  // ---------- efektler ----------
  function banner(text, kind = '', color) {
    const b = $('#banner');
    b.className = `banner ${kind}`;
    if (color) b.style.setProperty('--bc', color); else b.style.removeProperty('--bc');
    b.textContent = text;
    clearTimeout(banner.t);
    banner.t = setTimeout(() => b.classList.add('hidden'), 1750);
  }
  function burst(text, x = '50%', y = '30%') {
    const el = document.createElement('div');
    el.className = 'burst';
    el.textContent = text;
    el.style.left = x; el.style.top = y;
    el.style.transform = 'translate(-50%,-50%)';
    $('#center').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
  const centerOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, ok: r.width > 0 }; };
  function rowPoint(pid) { const li = $(`#playerList li[data-pid="${pid}"]`); return li ? centerOf($('.cash', li) || li) : null; }
  function pawnPoint(pid) { const pe = pawnEls[pid]; return pe && pe.style.display !== 'none' ? centerOf(pe) : null; }
  const bankPoint = () => centerOf($('#diceRow'));
  function flyNotes(from, to, amount) {
    if (!from || !to || REDUCED) return;
    const count = Math.min(5, 1 + Math.floor(Math.log10(Math.max(1, amount)) * 1.4));
    const d = noteFor(amount);
    for (let k = 0; k < count; k++) {
      const el = document.createElement('div');
      el.className = 'fly-note';
      el.innerHTML = noteSVG(d);
      el.style.left = `${from.x}px`; el.style.top = `${from.y}px`;
      $('#fx').appendChild(el);
      const dx = to.x - from.x, dy = to.y - from.y;
      const lift = -Math.min(160, 60 + Math.hypot(dx, dy) * 0.25);
      const rot = (Math.random() * 2 - 1) * 200;
      el.animate([
        { transform: 'translate(0,0) rotate(0) scale(.4)', opacity: 0 },
        { transform: `translate(${dx * 0.15}px,${dy * 0.15 + lift * 0.5}px) rotate(${rot * 0.2}deg) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${dx * 0.55}px,${dy * 0.55 + lift}px) rotate(${rot * 0.6}deg) scale(1.05)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(.5)`, opacity: 0 },
      ], { duration: 1000, delay: k * 110, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'both' }).onfinish = () => el.remove();
    }
  }
  function floatText(pt, text, cls) {
    if (!pt) return;
    const el = document.createElement('div');
    el.className = `float-txt ${cls}`;
    el.textContent = text;
    el.style.left = `${pt.x}px`; el.style.top = `${pt.y}px`;
    $('#fx').appendChild(el);
    el.animate([
      { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0 },
      { transform: 'translate(-50%,-90%) scale(1.25)', opacity: 1, offset: 0.2 },
      { transform: 'translate(-50%,-250%) scale(1)', opacity: 0 },
    ], { duration: 1500, easing: 'ease-out', fill: 'both' }).onfinish = () => el.remove();
  }
  function flashRow(pid, cls) {
    const li = $(`#playerList li[data-pid="${pid}"]`); if (!li) return;
    li.classList.remove('gain', 'loss'); void li.offsetWidth; li.classList.add(cls);
  }
  function moneyFx(prev, g) {
    const deltas = g.players.map((p) => {
      const o = prev.players.find((x) => x.id === p.id);
      return { id: p.id, d: o ? p.cash - o.cash : 0 };
    }).filter((x) => x.d !== 0);
    const pos = deltas.filter((x) => x.d > 0), neg = deltas.filter((x) => x.d < 0);
    neg.forEach((n) => {
      const mi = pos.findIndex((p) => p.d === -n.d);
      if (mi >= 0) {
        const p = pos.splice(mi, 1)[0];
        flyNotes(pawnPoint(n.id) || rowPoint(n.id), rowPoint(p.id), -n.d);
        after(700, () => { floatText(rowPoint(p.id), `+${tl(p.d)}`, 'plus'); flashRow(p.id, 'gain'); });
      } else flyNotes(rowPoint(n.id), bankPoint(), -n.d);
      floatText(pawnPoint(n.id) || rowPoint(n.id), tl(n.d), 'minus');
      flashRow(n.id, 'loss');
    });
    pos.forEach((p) => {
      flyNotes(bankPoint(), rowPoint(p.id), p.d);
      after(650, () => { floatText(rowPoint(p.id), `+${tl(p.d)}`, 'plus'); flashRow(p.id, 'gain'); });
    });
  }
  function tweenCash(pid, to, fast) {
    const from = cashShown[pid] === undefined ? to : cashShown[pid];
    if (fast || from === to) { cashShown[pid] = to; cashTweens[pid] = null; return; }
    cashTweens[pid] = { from, to, start: performance.now(), dur: 900 };
    requestAnimationFrame(tickCash);
  }
  function tickCash(t) {
    let more = false;
    for (const [pid, tw] of Object.entries(cashTweens)) {
      if (!tw) continue;
      const k = Math.min(1, (t - tw.start) / tw.dur);
      const v = tw.from + (tw.to - tw.from) * (1 - (1 - k) ** 3);
      cashShown[pid] = k === 1 ? tw.to : v;
      const el = $(`.cash[data-cash="${pid}"]`);
      if (el && !el.dataset.dead) { el.textContent = tl(cashShown[pid]); el.classList.toggle('neg', cashShown[pid] < 0); }
      if (k < 1) more = true; else cashTweens[pid] = null;
    }
    if (more) requestAnimationFrame(tickCash);
  }

  let cardHide = null;
  function showCard(g, prev) {
    if (!g.card || (prev && prev.card && prev.card.seq === g.card.seq) || !prev) return;
    const p = playerById(g.card.player);
    const el = $('#cardPop');
    const ch = g.card.deck === 'chance';
    el.className = `card-pop ${g.card.deck}`;
    el.innerHTML = `<div class="ci"><div class="cf"><h4>${ch ? '❓ ŞANS' : '💰 KAMU FONU'}</h4><div>${esc(g.card.text)}</div><small class="muted">${esc(p ? p.name : '')}</small></div><div class="cb">${ch ? '?' : 'B'}</div></div>`;
    clearTimeout(cardHide);
    const hide = () => { el.classList.add('out'); setTimeout(() => el.classList.add('hidden'), 400); };
    cardHide = setTimeout(hide, 4800);
    el.onclick = hide;
  }

  // ---------- konfeti ----------
  function confetti() {
    if (REDUCED) return;
    const cv = $('#confetti'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#d7263d', '#f2b632', '#1d5fd0', '#1f9d55', '#ff4fa3', '#9b5de5'];
    const parts = Array.from({ length: 220 }, () => ({
      x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.5, vx: Math.random() * 4 - 2, vy: 2 + Math.random() * 4,
      w: 6 + Math.random() * 8, h: 8 + Math.random() * 10, r: Math.random() * 6, vr: Math.random() * .3 - .15, c: cols[Math.floor(Math.random() * cols.length)],
    }));
    const t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      parts.forEach((p) => {
        p.x += p.vx + Math.sin((t + p.y) / 300); p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      if (t - t0 < 6000) requestAnimationFrame(frame); else ctx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  // ---------- oyun ekranı ----------
  function applyGame(s, fast) {
    room = s;
    const g = s.game;
    const prev = prevGame;
    prevGame = g;
    showScreen('game');
    if (!boardBuilt) { buildBoard(); fast = true; }
    $('#gameRoomName').textContent = s.name;
    $('#gameCode').textContent = s.code;
    ensurePawns(g);
    styleOfPawns(g);
    if (fast) layoutPawns(false);

    const rolled = prev && g.rollId !== prev.rollId;
    const animate = !fast && rolled;
    const diceT = animate ? DICE_MS : 0;
    const moveT = animate ? movesDuration(g.moves) : 0;
    setDice(g.dice, animate);
    if (animate) {
      const [a, b] = g.dice;
      after(diceT - 150, () => { if (a === b) burst('ÇİFT! 🎲', '50%', '22%'); });
    }
    after(diceT, () => {
      if (animate && g.moves && g.moves.length) animateMoves(g.moves, g);
      else snapTokens(g);
      after(moveT, () => renderMain(g, prev, fast));
    });
    return diceT + moveT + (fast ? 0 : 120);
  }

  function renderMain(g, prev, fast) {
    updateBoard(g, prev, fast);
    styleOfPawns(g);
    renderPlayers(g, fast);
    if (!fast && prev) moneyFx(prev, g);
    renderCenter(g, prev, fast);
    renderLog(g);
    renderTrades(g);
    if (!fast) showCard(g, prev);
    if (!fast && prev) {
      const m = me();
      if (prev.turn !== g.turn && m && g.turn === m.id && g.phase !== 'gameover') banner('SIRA SENDE! 🎲', '', m.color);
      g.players.forEach((p) => {
        const o = prev.players.find((x) => x.id === p.id);
        if (o && !o.bankrupt && p.bankrupt) banner(`💥 ${p.name} İFLAS!`, '', '#333');
      });
    }
    if (modalRender) { const body = $('#modalBody'); const st = body.parentElement.scrollTop; body.innerHTML = ''; modalRender(body); body.parentElement.scrollTop = st; }
    renderGameOver(g);
  }

  function renderPlayers(g, fast) {
    $('#playerList').innerHTML = g.players.map((p) => {
      const owned = Object.entries(g.props).filter(([, pr]) => pr.owner === p.id).map(([i]) => +i).sort((a, b) => a - b);
      const mini = owned.map((i) => `<i style="background:${groupColor(sq(i))};${g.props[i].mortgaged ? 'opacity:.3' : ''}" title="${esc(sq(i).name)}"></i>`).join('');
      const shown = cashShown[p.id] === undefined ? p.cash : cashShown[p.id];
      return `<li class="${g.turn === p.id ? 'turn' : ''} ${p.bankrupt ? 'dead' : ''}" data-pid="${p.id}" style="--c:${p.color}">
        <span class="pawn-chip" style="--c:${p.color}">${p.token}</span>
        <div style="flex:1;min-width:0">
          <div class="pname">${esc(p.name)}${p.id === session.pid ? ' (sen)' : ''}
            ${p.inJail ? '<span class="badge-s jail">hapiste</span>' : ''}
            ${p.inDebt ? '<span class="badge-s debt">borçlu</span>' : ''}
            ${!p.connected && !p.bankrupt ? '<span class="badge-s off">çevrimdışı</span>' : ''}
            ${p.jailCards.length ? `<span class="badge-s" title="Hapisten çıkış kartı">🔑${p.jailCards.length}</span>` : ''}
          </div>
          <div class="mini">${mini}</div>
        </div>
        <span class="cash ${shown < 0 ? 'neg' : ''}" data-cash="${p.id}" ${p.bankrupt ? 'data-dead="1"' : ''}>${p.bankrupt ? 'İFLAS' : tl(shown)}</span>
      </li>`;
    }).join('');
    $$('#playerList li').forEach((li) => { li.onclick = () => openProps(li.dataset.pid); });
    g.players.forEach((p) => tweenCash(p.id, p.cash, fast));
  }

  const phaseText = { roll: 'zar atacak', buy: 'satın alma kararı veriyor', auction: 'açık artırma sürüyor', end: 'turunu bitirecek', gameover: 'oyun bitti' };
  function miniDeed(i) {
    const s = sq(i);
    const rent = s.type === 'prop' ? tl(s.rent[0]) : s.type === 'station' ? tl(25) : 'zar × 4';
    return `<div class="mini-deed"><div class="mh" style="background:${groupColor(s)}">${esc(s.name)}</div><div class="mb"><span>Fiyat <b>${tl(s.price)}</b></span><span>Kira <b>${rent}</b></span></div></div>`;
  }
  function renderCenter(g) {
    const cur = playerById(g.turn), m = me();
    const myTurn = m && cur && m.id === cur.id && !m.bankrupt;
    let info = `<span class="who" style="background:${cur.color}">${cur.token} ${esc(cur.name)}</span> <span class="${g.phase === 'gameover' ? '' : 'dots'}">${phaseText[g.phase] || ''}</span>`;
    if (myTurn && g.phase === 'roll') info = m.inJail ? `🔒 Hapistesin (${m.jailTurns + 1}. deneme)` : (g.extraRoll ? '🎲 Çift attın, tekrar at!' : '🎲 Sıra sende!');
    if (g.phase === 'buy' && g.pendingBuy !== null) info += `<br>${miniDeed(g.pendingBuy)}`;
    $('#turnInfo').innerHTML = info;

    const A = [];
    if (myTurn && m.cash >= 0) {
      if (g.phase === 'roll') {
        if (m.inJail) {
          A.push(['roll', '🎲 Çift Dene', 'primary pulse']);
          A.push(['payJail', `Kefalet Öde ${tl(50)}`, 'gold', m.cash < 50]);
          if (m.jailCards.length) A.push(['useJailCard', '🔑 Kartı Kullan', 'green']);
        } else A.push(['roll', g.extraRoll ? '🎲 Tekrar Zar At' : '🎲 Zar At', 'primary pulse']);
      } else if (g.phase === 'buy') {
        const s = sq(g.pendingBuy);
        A.push(['buy', `Satın Al ${tl(s.price)}`, 'green pulse', m.cash < s.price]);
        A.push(['decline', '🔨 Açık Artırma', 'gold']);
        A.push(['deed', 'Tapuya Bak', '']);
      } else if (g.phase === 'end') A.push(['endTurn', 'Turu Bitir ➜', 'primary']);
    }
    $('#actions').innerHTML = A.map(([t, l, c, dis]) => `<button class="btn ${c}" data-a="${t}" ${dis ? 'disabled' : ''}>${l}</button>`).join('');
    $$('#actions [data-a]').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.a === 'deed') return openDeed(g.pendingBuy);
        $$('#actions button').forEach((x) => { x.disabled = true; });
        act(b.dataset.a);
      };
    });

    const db = $('#debtBox');
    if (m && m.inDebt && !m.bankrupt) {
      db.classList.remove('hidden');
      db.innerHTML = `<b>⚠️ ${tl(-m.cash)} borcun var!</b><span>Ev sat veya mülk ipotek et. Kapatamazsan iflas edersin.</span>
        <div class="actions"><button class="btn gold" id="debtProps">📜 Mülklerim</button><button class="btn primary" id="debtBk">İflas Et</button></div><small id="debtTimer" class="muted"></small>`;
      $('#debtProps').onclick = () => openProps(m.id);
      $('#debtBk').onclick = () => confirmBox('İflas etmek istediğine emin misin?', 'İflas Et', () => act('bankrupt'));
    } else db.classList.add('hidden');

    renderAuction(g);
  }

  let lastBid = null;
  function renderAuction(g) {
    const box = $('#auctionBox');
    if (g.phase !== 'auction' || !g.auction) { box.classList.add('hidden'); lastBid = null; return; }
    box.classList.remove('hidden');
    const au = g.auction, s = sq(au.idx), m = me();
    const bidder = au.bidder && playerById(au.bidder);
    const canBid = m && !m.bankrupt && !au.passed.includes(m.id);
    const iLead = m && au.bidder === m.id;
    const changed = lastBid !== null && au.bid !== lastBid;
    lastBid = au.bid;
    box.innerHTML = `<h4><span class="gavel ${changed ? 'bang' : ''}">🔨</span> Açık Artırma: <span style="color:${groupColor(s)}">${esc(s.name)}</span></h4>
      <div class="bid ${changed ? 'bump' : ''}">${au.bid ? tl(au.bid) : 'Teklif yok'}</div>
      <div>${bidder ? `En yüksek: <b>${esc(bidder.name)}</b>` : 'İlk teklifi ver!'} · <span id="auTimer"></span></div>
      ${canBid && !iLead ? `<div class="row-btns">
          ${[1, 10, 50, 100].map((inc) => `<button class="btn sm" data-inc="${inc}" ${au.bid + inc > m.cash ? 'disabled' : ''}>+${inc}</button>`).join('')}
          <input id="bidInput" type="number" min="${au.bid + 1}" max="${m.cash}" placeholder="${au.bid + 1}">
          <button class="btn sm green" id="bidBtn">Teklif</button>
          <button class="btn sm ghost" id="passBtn">Çekil</button></div>` : ''}
      ${iLead ? '<b style="color:var(--green)">En yüksek teklif sende 👑</b>' : ''}
      ${m && !canBid && !iLead ? '<span class="muted">Bu artırmadan çekildin.</span>' : ''}`;
    $$('[data-inc]', box).forEach((b) => { b.onclick = () => act('bid', { amount: au.bid + +b.dataset.inc }); });
    if ($('#bidBtn', box)) {
      $('#bidBtn', box).onclick = () => { const v = parseInt($('#bidInput').value, 10); if (v) act('bid', { amount: v }); };
      $('#passBtn', box).onclick = () => act('pass');
    }
  }

  // zamanlayıcılar
  setInterval(() => {
    const r = latest;
    if (r && r.status === 'lobby') {
      const el = $('#autoStartInfo');
      if (r.autoStartAt) { el.classList.remove('hidden'); el.textContent = `⏱️ Oyun ${Math.max(0, Math.ceil((r.autoStartAt - now()) / 1000))} sn içinde otomatik başlayacak`; }
      else el.classList.add('hidden');
    }
    const g = game();
    if (!g || g.phase === 'gameover') return;
    const cur = playerById(g.turn);
    const total = cur && cur.connected ? g.timing.TURN_MS : g.timing.OFFLINE_TURN_MS;
    const left = Math.max(0, g.deadline - now());
    const bar = $('#timerBar');
    bar.style.width = `${g.phase === 'auction' ? 100 : Math.min(100, (left / total) * 100)}%`;
    bar.classList.toggle('warn', left < 10000);
    const at = $('#auTimer');
    if (at && g.auction) at.textContent = `⏱️ ${Math.max(0, Math.ceil((g.auction.endsAt - now()) / 1000))} sn`;
    const dt = $('#debtTimer'), m = me();
    if (dt && m && m.debtSince) dt.textContent = `Kalan süre: ${Math.max(0, Math.ceil((m.debtSince + g.timing.DEBT_MS - now()) / 1000))} sn`;
  }, 250);

  function renderLog(g) {
    const newest = g.log.length ? g.log[g.log.length - 1].seq : 0;
    if (newest === lastLogSeq) return;
    const prevSeq = lastLogSeq;
    lastLogSeq = newest;
    $('#logList').innerHTML = g.log.slice().reverse().map((l) => `<li class="${prevSeq && l.seq > prevSeq ? 'new' : ''}">${esc(l.text)}</li>`).join('');
  }

  // ---------- tapu ----------
  function deedHTML(i) {
    const s = sq(i), g = game(), pr = g.props[i];
    const owner = pr && pr.owner && playerById(pr.owner);
    const head = `<div class="dh" style="background:${groupColor(s)}"><small>TAPU SENEDİ</small>${esc(s.name)}</div>`;
    let rows = '';
    if (s.type === 'prop') {
      const labels = ['Kira', '1 ev ile', '2 ev ile', '3 ev ile', '4 ev ile', 'Otel ile'];
      rows = s.rent.map((r, k) => `<tr class="${pr.houses === k && pr.owner ? 'cur' : ''}"><td>${labels[k]}</td><td>${tl(r)}</td></tr>`).join('')
        + '<tr><td colspan="2" class="muted" style="font-size:13px">Renk grubunun tamamına sahipsen boş arsa kirası 2 kat</td></tr>'
        + `<tr><td>Ev / otel maliyeti</td><td>${tl(BOARD.groups[s.group].house)}</td></tr>`;
    } else if (s.type === 'station') {
      rows = [1, 2, 3, 4].map((n) => `<tr><td>${n} ulaşım noktası</td><td>${tl(25 * 2 ** (n - 1))}</td></tr>`).join('');
    } else if (s.type === 'utility') {
      rows = '<tr><td>1 idare</td><td>zar × 4</td></tr><tr><td>2 idare</td><td>zar × 10</td></tr>';
    } else {
      return `<div class="deed">${head}<div class="df">${s.type === 'tax' ? `${tl(s.amount)} vergi ödenir.` : 'Bu kare satın alınamaz.'}</div></div>`;
    }
    return `<div class="deed">${head}<table><tr><td>Fiyat</td><td>${tl(s.price)}</td></tr>${rows}<tr><td>İpotek değeri</td><td>${tl(s.mortgage)}</td></tr></table>
      <div class="df">Sahibi: <b>${owner ? esc(owner.name) : 'Banka'}</b>${pr.mortgaged ? ' · <b style="color:var(--red)">İPOTEKLİ</b>' : ''}${s.type === 'prop' && pr.houses ? ` · ${pr.houses === 5 ? '1 otel' : `${pr.houses} ev`}` : ''}</div></div>`;
  }
  function propButtons(i) {
    const s = sq(i), g = game(), pr = g.props[i], m = me();
    if (!m || !pr || pr.owner !== m.id || m.bankrupt) return '';
    const b = [];
    if (s.type === 'prop') {
      const h = BOARD.groups[s.group].house;
      b.push(`<button class="btn sm green" data-pa="build" data-i="${i}">${pr.houses === 4 ? '🏨 Otel' : '🏠 Ev'} ${tl(h)}</button>`);
      if (pr.houses) b.push(`<button class="btn sm" data-pa="sell" data-i="${i}">Bina sat +${tl(h / 2)}</button>`);
    }
    if (!pr.mortgaged) b.push(`<button class="btn sm gold" data-pa="mortgage" data-i="${i}">İpotek +${tl(s.mortgage)}</button>`);
    else b.push(`<button class="btn sm" data-pa="unmortgage" data-i="${i}">İpoteği kaldır ${tl(Math.ceil(s.mortgage * 1.1))}</button>`);
    return b.join('');
  }
  function bindPropButtons(el) { $$('[data-pa]', el).forEach((b) => { b.onclick = () => act(b.dataset.pa, { idx: +b.dataset.i }); }); }
  function openDeed(i) {
    if (!game()) return;
    openModal((el) => {
      el.innerHTML = deedHTML(i) + `<div class="modal-actions">${propButtons(i)}</div>`;
      bindPropButtons(el);
    });
  }

  // ---------- mülk listesi + cüzdan ----------
  function openProps(pid) {
    openModal((el) => {
      const g = game(); const p = playerById(pid);
      if (!g || !p) return;
      const owned = Object.entries(g.props).filter(([, pr]) => pr.owner === p.id).map(([i]) => +i);
      const order = (i) => { const s = sq(i); return s.group ? GROUP_ORDER.indexOf(s.group) : s.type === 'station' ? 8 : 9; };
      owned.sort((a, b) => order(a) - order(b) || a - b);
      const worth = owned.reduce((t, i) => t + (g.props[i].mortgaged ? 0 : sq(i).mortgage) + (sq(i).type === 'prop' ? g.props[i].houses * BOARD.groups[sq(i).group].house / 2 : 0), 0);
      const wallet = breakdown(p.cash).map(([n, c], k) => `<div class="wn" style="animation-delay:${k * 60}ms">${noteSVG(n)}<b>×${c}</b></div>`).join('');
      el.innerHTML = `<h3><span class="pawn-chip" style="--c:${p.color};display:inline-grid;vertical-align:middle">${p.token}</span> ${esc(p.name)} — ${tl(p.cash)}</h3>
        <div class="wallet">${wallet || '<span class="muted">Cüzdan boş 😬</span>'}</div>
        <p class="muted">${owned.length} mülk · Tasfiye değeri (ipotek + bina satışı): ${tl(worth)}</p>
        <div class="prop-groups">${owned.length ? owned.map((i) => {
          const s = sq(i), pr = g.props[i];
          const st = [pr.mortgaged ? 'ipotekli' : '', s.type === 'prop' && pr.houses ? (pr.houses === 5 ? 'otel' : `${pr.houses} ev`) : ''].filter(Boolean).join(', ');
          return `<div class="prop-row" style="--gc:${groupColor(s)}"><span class="n" data-deed="${i}" style="cursor:pointer">${esc(s.name)} <small>${st}</small></span>${propButtons(i)}</div>`;
        }).join('') : '<p class="muted">Henüz mülk yok.</p>'}</div>`;
      bindPropButtons(el);
      $$('[data-deed]', el).forEach((n) => { n.onclick = () => openDeed(+n.dataset.deed); });
    });
  }
  $('#myPropsBtn').onclick = () => session && openProps(session.pid);

  // ---------- takas ----------
  function tradeSummary(t) {
    const list = (props, cash, jail) => {
      const parts = props.map((i) => `<div style="border-left:5px solid ${groupColor(sq(i))};padding-left:5px">${esc(sq(i).name)}</div>`);
      if (cash) parts.push(`<div><b>${tl(cash)}</b></div>`);
      if (jail) parts.push(`<div>🔑 ${jail} hapis kartı</div>`);
      return parts.join('') || '<div class="muted">—</div>';
    };
    return `<div class="cols"><div><small class="muted">${esc(playerById(t.from).name)} verir:</small>${list(t.giveProps, t.giveCash, t.giveJail)}</div>
      <div><small class="muted">${esc(playerById(t.to).name)} verir:</small>${list(t.getProps, t.getCash, t.getJail)}</div></div>`;
  }
  function renderTrades(g) {
    const mine = g.trades.filter((t) => t.to === session.pid || t.from === session.pid);
    const incoming = mine.filter((t) => t.to === session.pid).length;
    $('#tradeBadge').textContent = incoming;
    $('#tradeBadge').classList.toggle('hidden', !incoming);
    if (incoming > (renderTrades.prev || 0)) toast('🤝 Yeni takas teklifin var! (Teklifler sekmesi)');
    renderTrades.prev = incoming;
    $('#tradeList').innerHTML = mine.length ? mine.map((t) => `<li><b>${t.to === session.pid ? `📩 ${esc(playerById(t.from).name)} sana teklif etti` : `📤 ${esc(playerById(t.to).name)} oyuncusuna teklifin`}</b>
      ${tradeSummary(t)}
      <div class="btns">${t.to === session.pid ? `<button class="btn sm green" data-ta="tradeAccept" data-id="${t.id}">Kabul</button><button class="btn sm" data-ta="tradeReject" data-id="${t.id}">Reddet</button>` : `<button class="btn sm" data-ta="tradeCancel" data-id="${t.id}">Geri çek</button>`}</div></li>`).join('')
      : '<li class="muted" style="border:none;background:none">Açık takas teklifi yok. "🤝 Takas" ile teklif yapabilirsin.</li>';
    $$('[data-ta]').forEach((b) => { b.onclick = () => act(b.dataset.ta, { id: +b.dataset.id }); });
  }
  $('#tradeBtn').onclick = () => {
    const g = game(), m = me();
    if (!g || !m || m.bankrupt) return;
    const others = g.players.filter((p) => !p.bankrupt && p.id !== m.id);
    if (!others.length) return;
    let target = others[0].id;
    const hasBuild = (i) => sq(i).type === 'prop' && BOARD.squares.some((x) => x.group === sq(i).group && g.props[x.index].houses > 0);
    const checks = (pid, name) => Object.entries(g.props).filter(([, pr]) => pr.owner === pid).map(([i]) => +i).sort((a, b) => a - b)
      .map((i) => `<label class="${hasBuild(i) ? 'dis' : ''}" style="--gc:${groupColor(sq(i))}"><input type="checkbox" name="${name}" value="${i}" ${hasBuild(i) ? 'disabled title="Grupta bina var"' : ''}> ${esc(sq(i).name)}${g.props[i].mortgaged ? ' <small class="muted">(ipotekli)</small>' : ''}</label>`).join('') || '<span class="muted">Mülk yok</span>';
    modalRender = null;
    const el = $('#modalBody');
    el.innerHTML = '';
    const draw = () => {
      const t = playerById(target);
      el.innerHTML = `<h3>🤝 Takas Teklifi</h3>
        <label class="field"><span>Kiminle?</span><select id="trTarget">${others.map((p) => `<option value="${p.id}" ${p.id === target ? 'selected' : ''}>${p.token} ${esc(p.name)} (${tl(p.cash)})</option>`).join('')}</select></label>
        <div class="trade-grid">
          <div><h4>Sen verirsin</h4><div class="check-list">${checks(m.id, 'give')}</div>
            <label class="field"><span>Baron Doları (en fazla ${tl(Math.max(0, m.cash))})</span><input id="trGiveCash" type="number" min="0" max="${Math.max(0, m.cash)}" value="0"></label>
            ${m.jailCards.length ? `<label class="field"><span>Hapis kartı</span><input id="trGiveJail" type="number" min="0" max="${m.jailCards.length}" value="0"></label>` : ''}</div>
          <div><h4>${esc(t.name)} verir</h4><div class="check-list">${checks(t.id, 'get')}</div>
            <label class="field"><span>Baron Doları (en fazla ${tl(Math.max(0, t.cash))})</span><input id="trGetCash" type="number" min="0" max="${Math.max(0, t.cash)}" value="0"></label>
            ${t.jailCards.length ? `<label class="field"><span>Hapis kartı</span><input id="trGetJail" type="number" min="0" max="${t.jailCards.length}" value="0"></label>` : ''}</div>
        </div>
        <div class="modal-actions" style="margin-top:14px"><button class="btn primary" id="trSend">Teklifi Gönder</button></div>`;
      $('#trTarget', el).onchange = (e) => { target = e.target.value; draw(); };
      $('#trSend', el).onclick = () => {
        const val = (id) => parseInt(($(`#${id}`, el) || {}).value, 10) || 0;
        socket.emit('game:act', {
          type: 'tradePropose', to: target,
          giveProps: $$('input[name="give"]:checked', el).map((c) => +c.value),
          getProps: $$('input[name="get"]:checked', el).map((c) => +c.value),
          giveCash: val('trGiveCash'), getCash: val('trGetCash'), giveJail: val('trGiveJail'), getJail: val('trGetJail'),
        }, (res) => { if (res.error) toast(res.error, 'err'); else { toast('Teklif gönderildi.'); closeModal(); } });
      };
    };
    draw();
    $('#modal').classList.remove('hidden');
  };

  // ---------- çıkış & oyun sonu ----------
  $('#leaveGameBtn').onclick = () => {
    const g = game(), m = me();
    const playing = g && g.phase !== 'gameover' && m && !m.bankrupt;
    if (!playing) return socket.emit('room:leave', () => clearSession());
    confirmBox('Oyundan çıkarsan iflas etmiş sayılırsın. Emin misin?', 'Çık', () => socket.emit('room:leave', () => clearSession()));
  };
  function renderGameOver(g) {
    const ov = $('#overlay');
    if (g.phase !== 'gameover') { ov.classList.add('hidden'); return; }
    if (renderGameOver.done) return;
    renderGameOver.done = true;
    const w = playerById(g.winner);
    ov.innerHTML = `<div class="win-box"><div class="trophy">🎩</div><h2>${w ? `${esc(w.name)} yeni Baron oldu!` : 'Oyun bitti'}</h2>
      ${w && w.id === session.pid ? '<p>Tebrikler, Baron sensin! 🏆</p>' : '<p>Bir dahaki sefere!</p>'}
      <div class="modal-actions"><button class="btn primary" id="homeBtn">Ana Menü</button><button class="btn" id="stayBtn">Tahtaya Bak</button></div></div>`;
    ov.classList.remove('hidden');
    confetti();
    $('#homeBtn').onclick = () => socket.emit('room:leave', () => clearSession());
    $('#stayBtn').onclick = () => ov.classList.add('hidden');
  }

  // ---------- başlat ----------
  fetch('/api/board').then((r) => r.json()).then((b) => { BOARD = b; pump(); });
})();
