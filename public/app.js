/* Baron Türkiye — istemci */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tl = (n) => `₺${n}`;
  const ICONS = ['🚗', '🎩', '🐕', '⛵', '🧿', '☕', '🐈', '🚀'];
  const COLORS = ['#e63946', '#1d7cf2', '#2a9d8f', '#f4a261', '#9b5de5', '#ff4fa3'];
  const GROUP_ORDER = ['kahve', 'acikmavi', 'pembe', 'turuncu', 'kirmizi', 'sari', 'yesil', 'lacivert'];

  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* yok */ } },
  };

  let BOARD = null;           // { squares, groups }
  let room = null;            // sunucudan gelen oda durumu
  let session = store.get('emlak_session');
  let skew = 0;
  let boardBuilt = false;
  let lastRollId = null, lastCardSeq = null, lastLogSeq = 0, seenChatSeq = 0;
  let modalRender = null;     // açık modalı yeniden çizen fonksiyon
  const shown = {}, targets = {}, animating = {};

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
    store.set('emlak_session', session);
    history.replaceState(null, '', `?oda=${res.code}`);
  }
  function clearSession() {
    session = null; room = null; store.set('emlak_session', null);
    history.replaceState(null, '', location.pathname);
    boardBuilt = false; renderGameOver.done = false; lastRollId = null; lastCardSeq = null; lastLogSeq = 0; seenChatSeq = 0;
    Object.keys(shown).forEach((k) => delete shown[k]);
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
  const me = () => game() && game().players.find((p) => p.id === (session && session.pid));
  const playerById = (id) => game() && game().players.find((p) => p.id === id);
  const sq = (i) => BOARD.squares[i];
  const groupColor = (s) => (s.group ? BOARD.groups[s.group].color : s.type === 'station' ? '#333' : '#8a8a8a');

  // ---------- modal ----------
  function openModal(renderFn) {
    modalRender = renderFn;
    $('#modalBody').innerHTML = '';
    renderFn($('#modalBody'));
    $('#modal').classList.remove('hidden');
  }
  function closeModal() { modalRender = null; $('#modal').classList.add('hidden'); }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  function confirmBox(text, yesLabel, onYes) {
    openModal((el) => {
      el.innerHTML = `<h3>${esc(text)}</h3><div class="modal-actions"><button class="btn primary" id="cYes">${esc(yesLabel)}</button><button class="btn" data-close>Vazgeç</button></div>`;
      $('#cYes', el).onclick = () => { closeModal(); onYes(); };
    });
  }

  // ---------- ana menü ----------
  $('#nameInput').value = store.get('emlak_name') || '';
  $('#nameInput').addEventListener('change', () => store.set('emlak_name', myName()));
  const params = new URLSearchParams(location.search);
  if (params.get('oda')) $('#codeInput').value = params.get('oda').toUpperCase();

  $('#quickBtn').onclick = () => { store.set('emlak_name', myName()); socket.emit('room:quick', { name: myName() }, handle); };
  $('#showCreateBtn').onclick = () => $('#createForm').classList.toggle('hidden');
  $('#createForm').onsubmit = (e) => {
    e.preventDefault();
    store.set('emlak_name', myName());
    socket.emit('room:create', {
      name: myName(), roomName: $('#roomNameInput').value, maxPlayers: +$('#maxPlayersSel').value,
      startMoney: +$('#startMoneySel').value, isPublic: $('#publicSel').value === '1',
    }, handle);
  };
  const join = (code) => { store.set('emlak_name', myName()); socket.emit('room:join', { code, name: myName() }, handle); };
  $('#joinBtn').onclick = () => { const c = $('#codeInput').value.trim(); if (c.length < 5) return toast('5 haneli oda kodunu gir.', 'err'); join(c); };
  $('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#joinBtn').click(); });

  function renderRooms(list) {
    const ul = $('#publicRooms');
    if (!Array.isArray(list) || !list.length) { ul.innerHTML = '<li class="muted">Şu an açık oda yok. İlk odayı sen kur!</li>'; return; }
    ul.innerHTML = list.map((r) => `<li class="room"><div><b>${esc(r.name)}</b>${r.quick ? '<span class="tag">HIZLI</span>' : ''}<div class="muted">${r.players}/${r.maxPlayers} oyuncu · ${esc(r.code)}</div></div><button class="btn sm" data-join="${esc(r.code)}">Katıl</button></li>`).join('');
    $$('[data-join]', ul).forEach((b) => { b.onclick = () => join(b.dataset.join); });
  }

  // ---------- bağlantı ----------
  socket.on('connect', () => {
    $('#conn').classList.add('hidden');
    if (session) {
      socket.emit('room:rejoin', session, (res) => {
        if (res && res.error) { clearSession(); } else handle(res);
      });
    } else {
      showScreen('home');
      socket.emit('rooms:list', renderRooms);
    }
  });
  socket.on('disconnect', () => $('#conn').classList.remove('hidden'));
  socket.on('rooms:list', renderRooms);
  socket.on('kicked', (msg) => { toast(msg, 'err'); session = null; room = null; showScreen('home'); });
  socket.on('room:state', (s) => {
    room = s;
    skew = s.serverNow - Date.now();
    render();
  });

  function render() {
    if (!room) return showScreen('home');
    if (room.status === 'lobby') { showScreen('lobby'); renderLobby(); }
    else { showScreen('game'); renderGame(); }
    renderChat();
  }

  // ---------- lobi ----------
  function renderLobby() {
    $('#lobbyName').textContent = room.name;
    $('#lobbyInfo').textContent = `${room.players.length}/${room.maxPlayers} oyuncu · Başlangıç parası ${tl(room.startMoney)} · ${room.isPublic ? 'Herkese açık' : 'Özel oda'}`;
    $('#lobbyCode').textContent = room.code;
    const mine = room.players.find((p) => p.id === session.pid);
    $('#lobbyPlayers').innerHTML = room.players.map((p) => `
      <li class="${p.connected ? '' : 'off'}">
        <span class="pawn" style="--c:${p.color}">${p.icon}</span>
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
  function renderChat() {
    const html = room.chat.map((m) => (m.from ? `<li><b>${esc(m.from)}:</b>${esc(m.text)}</li>` : `<li class="sys">${esc(m.text)}</li>`)).join('');
    ['#lobbyChat', '#gameChat'].forEach((id) => {
      const ul = $(id);
      const atBottom = ul.scrollHeight - ul.scrollTop - ul.clientHeight < 40;
      ul.innerHTML = html;
      if (atBottom) ul.scrollTop = ul.scrollHeight;
    });
    const last = room.chat.length ? room.chat[room.chat.length - 1].seq : 0;
    const chatOpen = !$('[data-body="chat"]').classList.contains('hidden') || room.status === 'lobby';
    if (chatOpen) seenChatSeq = last;
    const unread = room.chat.filter((m) => m.seq > seenChatSeq && m.from).length;
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

  // ---------- sekmeler ----------
  $$('.tab').forEach((t) => {
    t.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $$('.tab-body').forEach((b) => b.classList.toggle('hidden', b.dataset.body !== t.dataset.tab));
      if (t.dataset.tab === 'chat' && room) { seenChatSeq = room.chat.length ? room.chat[room.chat.length - 1].seq : 0; renderChat(); const ul = $('#gameChat'); ul.scrollTop = ul.scrollHeight; }
    };
  });

  // ---------- tahta ----------
  function gridPos(i) {
    if (i <= 10) return { r: 11, c: 11 - i, side: i % 10 === 0 ? 'corner' : 'bottom' };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, side: i === 20 ? 'corner' : 'left' };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), side: i === 30 ? 'corner' : 'top' };
    return { r: 1 + (i - 30), c: 11, side: 'right' };
  }
  function squareHTML(s) {
    if (s.type === 'prop') return `<div class="band" style="background:${BOARD.groups[s.group].color}"></div><div class="ct"><div class="nm">${esc(s.name)}</div><div class="pr">${tl(s.price)}</div></div>`;
    return `<div class="ct">${squareInner(s)}</div>`;
  }
  function squareInner(s) {
    switch (s.type) {
      case 'station': {
        const ic = s.name.includes('İskele') ? '⛴️' : s.name.includes('Havalimanı') ? '✈️' : '🚆';
        return `<div class="nm">${esc(s.name)}</div><div class="ic">${ic}</div><div class="pr">${tl(s.price)}</div>`;
      }
      case 'utility': return `<div class="nm">${esc(s.name)}</div><div class="ic">${s.icon}</div><div class="pr">${tl(s.price)}</div>`;
      case 'chance': return '<div class="nm">ŞANS</div><div class="ic">?</div><div></div>';
      case 'chest': return '<div class="nm">KAMU FONU</div><div class="ic">💰</div><div></div>';
      case 'tax': return `<div class="nm">${esc(s.name)}</div><div class="ic">💸</div><div class="pr">${tl(s.amount)} öde</div>`;
      case 'go': return '<div>BAŞLANGIÇ</div><div class="big-arrow">⟵</div><div class="pr">Geçerken ₺200 al</div>';
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
      d.className = `sq ${side} ${s.type}${side === 'corner' ? ' corner' : ''}${s.type === 'prop' ? ' has-band' : ''}`;
      d.style.gridRow = r; d.style.gridColumn = c;
      d.dataset.idx = i;
      d.innerHTML = `${squareHTML(s)}<div class="tokens"></div>`;
      d.title = s.name;
      d.onclick = () => openDeed(i);
      b.appendChild(d);
    });
    boardBuilt = true;
  }
  function updateBoard(g) {
    BOARD.squares.forEach((s, i) => {
      const pr = g.props[i];
      if (!pr) return;
      const el = $(`.sq[data-idx="${i}"]`);
      el.classList.toggle('mortgaged', pr.mortgaged);
      let flag = $('.owner-flag', el);
      const owner = pr.owner && playerById(pr.owner);
      if (owner) {
        if (!flag) { flag = document.createElement('div'); flag.className = 'owner-flag'; el.appendChild(flag); }
        flag.style.background = owner.color;
        flag.title = `Sahibi: ${owner.name}`;
      } else if (flag) flag.remove();
      if (s.type === 'prop') {
        $('.band', el).innerHTML = pr.houses === 5 ? '<i class="hotel"></i>' : '<i class="house"></i>'.repeat(pr.houses);
      }
    });
  }

  // piyon animasyonu
  function syncTokens(g) {
    g.players.forEach((p) => {
      targets[p.id] = p.pos;
      if (shown[p.id] === undefined) { shown[p.id] = p.pos; return; }
      const d = (p.pos - shown[p.id] + 40) % 40;
      if (d === 0) return;
      if (d > 12 || p.bankrupt || (p.inJail && p.pos === 10)) { shown[p.id] = p.pos; return; }
      if (!animating[p.id]) stepToken(p.id);
    });
    drawTokens();
  }
  function stepToken(pid) {
    if (shown[pid] === targets[pid]) { animating[pid] = false; return; }
    animating[pid] = true;
    const d = (targets[pid] - shown[pid] + 40) % 40;
    shown[pid] = d > 12 ? targets[pid] : (shown[pid] + 1) % 40;
    drawTokens();
    setTimeout(() => stepToken(pid), 150);
  }
  function drawTokens() {
    const g = game(); if (!g) return;
    $$('.tokens').forEach((t) => { t.innerHTML = ''; });
    g.players.forEach((p) => {
      if (p.bankrupt) return;
      const host = $(`.sq[data-idx="${shown[p.id]}"] .tokens`);
      if (!host) return;
      const pw = document.createElement('span');
      pw.className = `pawn${g.turn === p.id ? ' cur' : ''}`;
      pw.style.setProperty('--c', p.color);
      pw.textContent = p.token;
      pw.title = p.name;
      host.appendChild(pw);
    });
  }

  // zar
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function setDie(el, n) { el.innerHTML = Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[n].includes(i) ? 'on' : ''}"></i>`).join(''); }
  function updateDice(g) {
    const [a, b] = g.dice;
    if (lastRollId === null || g.rollId === lastRollId) { setDie($('#die1'), a); setDie($('#die2'), b); lastRollId = g.rollId; return; }
    lastRollId = g.rollId;
    const d1 = $('#die1'), d2 = $('#die2');
    [d1, d2].forEach((d) => { d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('rolling'); });
    let k = 0;
    const iv = setInterval(() => {
      setDie(d1, 1 + Math.floor(Math.random() * 6)); setDie(d2, 1 + Math.floor(Math.random() * 6));
      if (++k > 6) { clearInterval(iv); setDie(d1, a); setDie(d2, b); }
    }, 70);
  }

  function showCard(g) {
    if (!g.card) { lastCardSeq = 0; return; }
    if (lastCardSeq === null) { lastCardSeq = g.card.seq; return; }
    if (g.card.seq === lastCardSeq) return;
    lastCardSeq = g.card.seq;
    const p = playerById(g.card.player);
    const el = $('#cardPop');
    el.className = `card-pop ${g.card.deck}`;
    el.innerHTML = `<h4>${g.card.deck === 'chance' ? '❓ ŞANS' : '💰 KAMU FONU'}</h4><div>${esc(g.card.text)}</div><small class="muted">${esc(p ? p.name : '')}</small>`;
    clearTimeout(showCard.t);
    showCard.t = setTimeout(() => el.classList.add('hidden'), 4500);
    el.onclick = () => el.classList.add('hidden');
  }

  // ---------- oyun ekranı ----------
  function renderGame() {
    const g = game();
    if (!g || !BOARD) return;
    if (!boardBuilt) buildBoard();
    $('#gameRoomName').textContent = room.name;
    $('#gameCode').textContent = room.code;
    updateBoard(g);
    syncTokens(g);
    updateDice(g);
    showCard(g);
    renderPlayers(g);
    renderCenter(g);
    renderLog(g);
    renderTrades(g);
    if (modalRender) { const body = $('#modalBody'); const st = body.parentElement.scrollTop; body.innerHTML = ''; modalRender(body); body.parentElement.scrollTop = st; }
    renderGameOver(g);
  }

  function renderPlayers(g) {
    $('#playerList').innerHTML = g.players.map((p) => {
      const owned = Object.entries(g.props).filter(([, pr]) => pr.owner === p.id).map(([i]) => +i).sort((a, b) => a - b);
      const mini = owned.map((i) => `<i style="background:${groupColor(sq(i))};${g.props[i].mortgaged ? 'opacity:.35' : ''}" title="${esc(sq(i).name)}"></i>`).join('');
      return `<li class="${g.turn === p.id ? 'turn' : ''} ${p.bankrupt ? 'dead' : ''}" data-pid="${p.id}">
        <span class="pawn" style="--c:${p.color}">${p.token}</span>
        <div style="flex:1;min-width:0">
          <div class="pname">${esc(p.name)}${p.id === session.pid ? ' (sen)' : ''}
            ${p.inJail ? '<span class="badge-s jail">hapiste</span>' : ''}
            ${p.inDebt ? '<span class="badge-s debt">borçlu</span>' : ''}
            ${!p.connected && !p.bankrupt ? '<span class="badge-s off">çevrimdışı</span>' : ''}
            ${p.jailCards.length ? `<span class="badge-s" title="Hapisten çıkış kartı">🔑${p.jailCards.length}</span>` : ''}
          </div>
          <div class="mini">${mini}</div>
        </div>
        <span class="cash ${p.cash < 0 ? 'neg' : ''}">${p.bankrupt ? 'İFLAS' : tl(p.cash)}</span>
      </li>`;
    }).join('');
    $$('#playerList li').forEach((li) => { li.onclick = () => openProps(li.dataset.pid); });
  }

  const phaseText = { roll: 'zar atacak', buy: 'satın alma kararı veriyor', auction: 'açık artırma sürüyor', end: 'turunu bitirecek', gameover: 'oyun bitti' };
  function renderCenter(g) {
    const cur = playerById(g.turn), m = me();
    const myTurn = m && cur && m.id === cur.id && !m.bankrupt;
    let info = `<span class="who" style="background:${cur.color}">${cur.token} ${esc(cur.name)}</span> ${phaseText[g.phase] || ''}`;
    if (g.phase === 'buy' && g.pendingBuy !== null) info += `<br><small>${esc(sq(g.pendingBuy).name)} — ${tl(sq(g.pendingBuy).price)}</small>`;
    if (myTurn && g.phase === 'roll') info = m.inJail ? `🔒 Hapistesin (${m.jailTurns + 1}. deneme)` : (g.extraRoll ? '🎲 Çift attın, tekrar at!' : '🎲 Sıra sende!');
    $('#turnInfo').innerHTML = info;

    const A = [];
    if (myTurn && m.cash >= 0) {
      if (g.phase === 'roll') {
        if (m.inJail) {
          A.push(['roll', '🎲 Çift Dene', 'primary']);
          A.push(['payJail', `Kefalet Öde ${tl(50)}`, 'gold', m.cash < 50]);
          if (m.jailCards.length) A.push(['useJailCard', '🔑 Kartı Kullan', 'green']);
        } else A.push(['roll', g.extraRoll ? '🎲 Tekrar Zar At' : '🎲 Zar At', 'primary']);
      } else if (g.phase === 'buy') {
        const s = sq(g.pendingBuy);
        A.push(['buy', `Satın Al ${tl(s.price)}`, 'green', m.cash < s.price]);
        A.push(['decline', '🔨 Açık Artırma', 'gold']);
        A.push(['deed', 'Tapuya Bak', '']);
      } else if (g.phase === 'end') A.push(['endTurn', 'Turu Bitir ➜', 'primary']);
    }
    $('#actions').innerHTML = A.map(([t, l, c, dis]) => `<button class="btn ${c}" data-a="${t}" ${dis ? 'disabled' : ''}>${l}</button>`).join('');
    $$('#actions [data-a]').forEach((b) => {
      b.onclick = () => { if (b.dataset.a === 'deed') openDeed(g.pendingBuy); else { b.disabled = true; act(b.dataset.a); } };
    });

    // borç kutusu
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

  function renderAuction(g) {
    const box = $('#auctionBox');
    if (g.phase !== 'auction' || !g.auction) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const au = g.auction, s = sq(au.idx), m = me();
    const bidder = au.bidder && playerById(au.bidder);
    const canBid = m && !m.bankrupt && !au.passed.includes(m.id);
    const iLead = m && au.bidder === m.id;
    box.innerHTML = `<h4>🔨 Açık Artırma: <span style="color:${groupColor(s)}">${esc(s.name)}</span></h4>
      <div class="bid">${au.bid ? tl(au.bid) : 'Teklif yok'}</div>
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
    const g = game();
    if (room && room.status === 'lobby') {
      const el = $('#autoStartInfo');
      if (room.autoStartAt) { el.classList.remove('hidden'); el.textContent = `⏱️ Oyun ${Math.max(0, Math.ceil((room.autoStartAt - now()) / 1000))} sn içinde otomatik başlayacak`; }
      else el.classList.add('hidden');
    }
    if (!g || g.phase === 'gameover') return;
    const cur = playerById(g.turn);
    const total = cur && cur.connected ? g.timing.TURN_MS : g.timing.OFFLINE_TURN_MS;
    const left = Math.max(0, g.deadline - now());
    const bar = $('#timerBar');
    bar.style.width = `${g.phase === 'auction' ? 100 : Math.min(100, (left / total) * 100)}%`;
    bar.classList.toggle('warn', left < 10000);
    const at = $('#auTimer');
    if (at && g.auction) at.textContent = `${Math.max(0, Math.ceil((g.auction.endsAt - now()) / 1000))} sn`;
    const dt = $('#debtTimer'), m = me();
    if (dt && m && m.debtSince) dt.textContent = `Kalan süre: ${Math.max(0, Math.ceil((m.debtSince + g.timing.DEBT_MS - now()) / 1000))} sn`;
  }, 250);

  function renderLog(g) {
    const newest = g.log.length ? g.log[g.log.length - 1].seq : 0;
    if (newest === lastLogSeq) return;
    lastLogSeq = newest;
    $('#logList').innerHTML = g.log.slice().reverse().map((l) => `<li>${esc(l.text)}</li>`).join('');
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
        + `<tr><td colspan="2" class="muted" style="font-size:12px">Grubun tamamına sahipsen boş arsa kirası 2 kat</td></tr>`
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
      b.push(`<button class="btn sm green" data-pa="build" data-i="${i}">${pr.houses === 4 ? '🏨 Otel' : '🏠 Ev'} +${tl(h)}</button>`);
      if (pr.houses) b.push(`<button class="btn sm" data-pa="sell" data-i="${i}">Bina sat +${tl(h / 2)}</button>`);
    }
    if (!pr.mortgaged) b.push(`<button class="btn sm gold" data-pa="mortgage" data-i="${i}">İpotek +${tl(s.mortgage)}</button>`);
    else b.push(`<button class="btn sm" data-pa="unmortgage" data-i="${i}">İpoteği kaldır −${tl(Math.ceil(s.mortgage * 1.1))}</button>`);
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

  // ---------- mülk listesi ----------
  function openProps(pid) {
    openModal((el) => {
      const g = game(); const p = playerById(pid);
      if (!g || !p) return;
      const owned = Object.entries(g.props).filter(([, pr]) => pr.owner === p.id).map(([i]) => +i);
      const order = (i) => { const s = sq(i); return s.group ? GROUP_ORDER.indexOf(s.group) : s.type === 'station' ? 8 : 9; };
      owned.sort((a, b) => order(a) - order(b) || a - b);
      const worth = owned.reduce((t, i) => t + (g.props[i].mortgaged ? 0 : sq(i).mortgage) + (sq(i).type === 'prop' ? g.props[i].houses * BOARD.groups[sq(i).group].house / 2 : 0), 0);
      el.innerHTML = `<h3><span class="pawn" style="--c:${p.color};display:inline-grid;width:30px;height:30px;font-size:16px;vertical-align:middle">${p.token}</span> ${esc(p.name)} — ${tl(p.cash)}</h3>
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
    // Takas modalı durum güncellemelerinde yeniden çizilmez; seçimler korunur.
    modalRender = null;
    $('#modalBody').innerHTML = '';
    const el = $('#modalBody');
    const draw = () => {
      const t = playerById(target);
      el.innerHTML = `<h3>🤝 Takas Teklifi</h3>
        <label class="field"><span>Kiminle?</span><select id="trTarget">${others.map((p) => `<option value="${p.id}" ${p.id === target ? 'selected' : ''}>${p.token} ${esc(p.name)} (${tl(p.cash)})</option>`).join('')}</select></label>
        <div class="trade-grid">
          <div><h4>Sen verirsin</h4><div class="check-list">${checks(m.id, 'give')}</div>
            <label class="field"><span>Para (en fazla ${tl(Math.max(0, m.cash))})</span><input id="trGiveCash" type="number" min="0" max="${Math.max(0, m.cash)}" value="0"></label>
            ${m.jailCards.length ? `<label class="field"><span>Hapis kartı</span><input id="trGiveJail" type="number" min="0" max="${m.jailCards.length}" value="0"></label>` : ''}</div>
          <div><h4>${esc(t.name)} verir</h4><div class="check-list">${checks(t.id, 'get')}</div>
            <label class="field"><span>Para (en fazla ${tl(Math.max(0, t.cash))})</span><input id="trGetCash" type="number" min="0" max="${Math.max(0, t.cash)}" value="0"></label>
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
    ov.innerHTML = `<div class="win-box"><div class="trophy">🏆</div><h2>${w ? `${esc(w.name)} yeni Baron oldu!` : 'Oyun bitti'}</h2>
      ${w && w.id === session.pid ? '<p>Tebrikler, Baron sensin! 🎩</p>' : '<p>Bir dahaki sefere!</p>'}
      <div class="modal-actions"><button class="btn primary" id="homeBtn">Ana Menü</button><button class="btn" id="stayBtn">Tahtaya Bak</button></div></div>`;
    ov.classList.remove('hidden');
    $('#homeBtn').onclick = () => socket.emit('room:leave', () => clearSession());
    $('#stayBtn').onclick = () => ov.classList.add('hidden');
  }

  // ---------- başlat ----------
  fetch('/api/board').then((r) => r.json()).then((b) => { BOARD = b; if (room) render(); });
})();
