// Bot oyuncular: sunucuda çalışan yapay zekâ.
// Takaslar, "takas olursa kim hangi seti tamamlar?" sorusu simüle edilerek değerlendirilir.
const crypto = require('crypto');
const { SQUARES, GROUPS, GROUP_MEMBERS, K, BUILD_LIMIT } = require('./board');

const BOT_NAMES = ['Bot Kemal', 'Bot Ayşe', 'Bot Mehmet', 'Bot Elif', 'Bot Cem', 'Bot Zehra'];
const RESERVE = 100 * K;          // elde tutulmaya çalışılan nakit
const STEP_MS = 210, DICE_MS = 1050, PREVIEW_MS = 750, CARD_PAUSE_MS = 2600;
const TRADE_COOLDOWN_TURNS = 6;   // bir bot en sık bu kadar turda bir teklif yapar
const REPEAT_BLOCK_TURNS = 24;    // aynı teklif bu kadar tur tekrarlanmaz

const rand = (a, b) => a + crypto.randomInt(Math.max(1, b - a));
const groupOf = (i) => (SQUARES[i].type === 'prop' ? SQUARES[i].group : null);
const groupValue = (g) => GROUP_MEMBERS[g].reduce((t, i) => t + SQUARES[i].price, 0);
const hasBuildings = (game, i) => { const g = groupOf(i); return !!g && GROUP_MEMBERS[g].some((j) => game.props[j].houses > 0); };

// Bir mülk, alan kişi için (şu anki duruma göre) grubu tamamlar mı?
function completesGroup(game, pid, idx) {
  const g = groupOf(idx);
  return !!g && GROUP_MEMBERS[g].every((i) => i === idx || game.props[i].owner === pid);
}

// ---------- takas simülasyonu ----------
function ownersAfter(game, t) {
  const own = {};
  for (const [i, pr] of Object.entries(game.props)) own[i] = pr.owner;
  t.giveProps.forEach((i) => { own[i] = t.to; });
  t.getProps.forEach((i) => { own[i] = t.from; });
  return own;
}
const fullGroups = (own, pid) => Object.keys(GROUPS).filter((g) => GROUP_MEMBERS[g].every((i) => own[i] === pid));
function ownersNow(game) { const o = {}; for (const [i, pr] of Object.entries(game.props)) o[i] = pr.owner; return o; }
// Bir grupta tamamlanmaya yakınlık (2/3, 1/2 gibi) — yakın setleri bozmayalım
function nearGroups(own, pid) {
  return Object.keys(GROUPS).filter((g) => {
    const m = GROUP_MEMBERS[g], mine = m.filter((i) => own[i] === pid).length;
    return mine === m.length - 1 && mine > 0;
  });
}

// pid açısından takasın değeri (pozitif = iyi)
function tradeValueFor(game, pid, t) {
  const before = ownersNow(game), after = ownersAfter(game, t);
  const other = pid === t.from ? t.to : t.from;
  let v = 0;
  const gets = pid === t.from ? t.getProps : t.giveProps;
  const gives = pid === t.from ? t.giveProps : t.getProps;
  gets.forEach((i) => { v += SQUARES[i].price * (game.props[i].mortgaged ? 0.5 : 1); });
  gives.forEach((i) => { v -= SQUARES[i].price * (game.props[i].mortgaged ? 0.5 : 1); });
  v += pid === t.from ? (t.getCash - t.giveCash) : (t.giveCash - t.getCash);
  v += (pid === t.from ? (t.getJail - t.giveJail) : (t.giveJail - t.getJail)) * 50 * K;
  // set kazanımı / kaybı
  const myNew = fullGroups(after, pid).filter((g) => !fullGroups(before, pid).includes(g));
  const myLost = fullGroups(before, pid).filter((g) => !fullGroups(after, pid).includes(g));
  const theirNew = fullGroups(after, other).filter((g) => !fullGroups(before, other).includes(g));
  myNew.forEach((g) => { v += groupValue(g) * 1.3; });
  myLost.forEach((g) => { v -= groupValue(g) * 1.5; });
  theirNew.forEach((g) => { v -= groupValue(g) * (myNew.length ? 0.9 : 1.6); });
  // tamamlanmaya yakın setimi bozuyorsa ceza
  const nearBefore = nearGroups(before, pid), nearAfter = nearGroups(after, pid);
  nearBefore.filter((g) => !nearAfter.includes(g) && !fullGroups(after, pid).includes(g)).forEach((g) => { v -= groupValue(g) * 0.4; });
  return v;
}

// Takas mantıklı mı? (aynı gruptan karşılıklı değiş tokuş gibi anlamsız takaslar elenir)
function sensible(t) {
  const gGive = new Set(t.giveProps.map(groupOf).filter(Boolean));
  if (t.getProps.some((i) => groupOf(i) && gGive.has(groupOf(i)))) return false;
  return t.giveProps.length + t.getProps.length + (t.giveCash ? 1 : 0) + (t.getCash ? 1 : 0) > 1;
}

function evaluateTrade(game, bot, t) {
  if (!sensible(t)) return false;
  if (t.getCash > bot.cash - RESERVE / 2) return false;
  const v = tradeValueFor(game, bot.id, t);
  const size = [...t.giveProps, ...t.getProps].reduce((s, i) => s + SQUARES[i].price, 0) + t.giveCash + t.getCash;
  return v > size * 0.05;
}

// Seti tamamlamak için eksik mülkü isteyen teklif üret
function proposeTrade(game, bot) {
  if (game.trades.some((t) => t.from === bot.id)) return null;
  if ((bot.lastTradeTurn ?? -99) > game.turnCount - TRADE_COOLDOWN_TURNS) return null;
  bot.tradeMemory ||= {};
  const now = ownersNow(game);
  // önce en değerli setler
  const targets = Object.keys(GROUPS)
    .filter((g) => {
      const m = GROUP_MEMBERS[g], mine = m.filter((i) => now[i] === bot.id).length;
      return mine > 0 && mine === m.length - 1 && !m.some((i) => game.props[i].houses > 0);
    })
    .sort((a, b) => groupValue(b) - groupValue(a));

  for (const g of targets) {
    const want = GROUP_MEMBERS[g].find((i) => now[i] !== bot.id);
    const owner = now[want];
    if (!owner) continue;
    const op = game.player(owner);
    if (!op || op.bankrupt) continue;

    const offers = [];
    // a) Karşılıklı set takası: karşı tarafın da setini tamamlayan, FARKLI gruptan bir mülkümü ver
    Object.keys(game.props).map(Number).forEach((i) => {
      if (now[i] !== bot.id || groupOf(i) === g || hasBuildings(game, i)) return;
      offers.push({ giveProps: [i], getProps: [want], giveCash: 0 });
    });
    // b) İşime yaramayan bir mülk + para
    Object.keys(game.props).map(Number).forEach((i) => {
      if (now[i] !== bot.id || groupOf(i) === g || hasBuildings(game, i)) return;
      const extra = Math.max(0, Math.round((SQUARES[want].price * 1.3 - SQUARES[i].price) / (10 * K)) * 10 * K);
      if (extra > 0 && extra <= Math.min(bot.cash - RESERVE, bot.cash * 0.55)) offers.push({ giveProps: [i], getProps: [want], giveCash: extra });
    });
    // c) Sadece para: setin değerine göre cömert
    [1.5, 2.0, 2.5, 3.0, 3.5].forEach((f) => {
      const cash = Math.round((SQUARES[want].price * f) / (10 * K)) * 10 * K;
      if (cash <= Math.min(bot.cash - RESERVE, bot.cash * 0.55)) offers.push({ giveProps: [], getProps: [want], giveCash: cash }); // parasının yarısından fazlasını vermez
    });

    // Bot için iyi + karşı taraf için de kabul edilebilir olanı seç
    const scored = offers.map((o) => {
      const t = { from: bot.id, to: owner, giveCash: o.giveCash || 0, getCash: 0, giveProps: o.giveProps, getProps: o.getProps, giveJail: 0, getJail: 0 };
      return { o, t, mine: tradeValueFor(game, bot.id, t), theirs: tradeValueFor(game, owner, t) };
    }).filter((x) => sensible(x.t) && x.mine > SQUARES[want].price * 0.1)
      .filter((x) => { const key = `${owner}:${x.o.getProps}:${x.o.giveProps}:${x.o.giveCash}`; return (x.key = key) && !(bot.tradeMemory[key] > game.turnCount - REPEAT_BLOCK_TURNS); })
      .sort((a, b) => (b.theirs - a.theirs) || (b.mine - a.mine)); // kendisi için kârlı olanlar içinde karşı tarafa en cömert olanı
    if (!scored.length) continue;
    const best = scored[0];
    bot.lastTradeTurn = game.turnCount;
    bot.tradeMemory[best.key] = game.turnCount;
    return { type: 'tradePropose', to: owner, giveProps: best.o.giveProps, getProps: best.o.getProps, giveCash: best.o.giveCash || 0 };
  }
  return null;
}

// Hareket animasyonunun istemcide süreceği yaklaşık süre (bot beklesin ki izlenebilsin)
function animDelay(game) {
  let t = DICE_MS + 600 + PREVIEW_MS;
  for (const m of game.moves || []) {
    if (m.kind === 'jail') { t += 2500; continue; }
    const n = m.kind === 'back' ? (m.from - m.to + 40) % 40 : (m.to - m.from + 40) % 40;
    t += n > 12 ? 2400 : n * STEP_MS;
  }
  if (game.cardRollId === game.rollId) t += CARD_PAUSE_MS;
  return t + 700;
}

function chooseManagement(game, bot) {
  for (const [i, pr] of Object.entries(game.props)) {
    if (pr.owner !== bot.id || !pr.mortgaged) continue;
    const cost = Math.ceil(SQUARES[i].mortgage * 1.1);
    if (bot.cash - cost > RESERVE * 3) return { type: 'unmortgage', idx: +i };
  }
  if ((bot.builds || 0) >= BUILD_LIMIT) return null;
  let best = null;
  for (const g of Object.keys(GROUPS)) {
    if (!game.ownsGroup(bot.id, g)) continue;
    const mem = GROUP_MEMBERS[g];
    if (mem.some((i) => game.props[i].mortgaged)) continue;
    const min = Math.min(...mem.map((i) => game.props[i].houses));
    if (min >= 5) continue;
    const idx = mem.find((i) => game.props[i].houses === min);
    const cost = min === 4 ? GROUPS[g].hotel : GROUPS[g].house;
    if (bot.cash - cost < RESERVE) continue;
    if (min < 4 && game.housesLeft <= 0) continue;
    if (min === 4 && game.hotelsLeft <= 0) continue;
    if (best === null || SQUARES[idx].rent[min + 1] > SQUARES[best].rent[game.props[best].houses + 1]) best = idx;
  }
  return best !== null ? { type: 'build', idx: best } : null;
}

// Botun şu an yapacağı tek eylem (yoksa null)
function decide(game, bot) {
  if (bot.bankrupt || game.phase === 'gameover') return null;
  if (bot.cash < 0) return { type: '_resolveDebt' };

  const offer = game.trades.find((t) => t.to === bot.id);
  if (offer) return { type: evaluateTrade(game, bot, offer) ? 'tradeAccept' : 'tradeReject', id: offer.id };

  if (game.phase === 'auction' && game.auction) {
    const au = game.auction;
    if (au.passed.includes(bot.id) || au.bidder === bot.id) return null;
    const s = SQUARES[au.idx];
    let factor = 0.85;
    if (completesGroup(game, bot.id, au.idx)) factor = 1.6;
    else if (game.active().some((o) => o.id !== bot.id && completesGroup(game, o.id, au.idx))) factor = 1.25;
    const max = Math.min(s.price * factor, bot.cash - 50 * K);
    const inc = Math.max(5 * K, Math.round((s.price * 0.05) / K) * K);
    if (au.bid + inc <= max) return { type: 'bid', amount: au.bid + inc };
    return { type: 'pass' };
  }

  if (game.current() !== bot) return null;
  if (game.phase === 'roll') {
    if (bot.inJail) {
      if (bot.jailCards.length) return { type: 'useJailCard' };
      const unowned = Object.values(game.props).filter((p) => !p.owner).length;
      if (unowned > 12 && bot.cash > 400 * K) return { type: 'payJail' };
    }
    return { type: 'roll' };
  }
  if (game.phase === 'buy') {
    const s = SQUARES[game.pendingBuy];
    const wants = (bot.cash - s.price >= RESERVE * 0.5) || (completesGroup(game, bot.id, s.index) && bot.cash >= s.price);
    return { type: wants && bot.cash >= s.price ? 'buy' : 'decline' };
  }
  if (game.phase === 'end') return chooseManagement(game, bot) || proposeTrade(game, bot) || { type: 'endTurn' };
  return null;
}

// Odanın oyunundaki botları sürer; bir şey değiştiyse true döner
function driveBots(game, now) {
  let changed = false;
  for (const bot of game.players) {
    if (!bot.isBot || bot.bankrupt || game.phase === 'gameover') continue;
    if (bot.nextAt && now < bot.nextAt) continue;
    const a = decide(game, bot);
    if (!a) continue;
    if (a.type === '_resolveDebt') {
      if (now - (bot.debtSince || now) < 1500) { bot.nextAt = now + 500; continue; }
      game.autoResolve(bot);
      bot.nextAt = now + 900;
      changed = true;
      continue;
    }
    const prevRoll = game.rollId;
    const err = game.act(bot.id, a);
    if (err) {
      if (a.type === 'buy') game.act(bot.id, { type: 'decline' });
      else if (a.type === 'bid') game.act(bot.id, { type: 'pass' });
      else if (a.type === 'tradeAccept') game.act(bot.id, { type: 'tradeReject', id: a.id });
      else if (['build', 'unmortgage', 'tradePropose'].includes(a.type)) game.act(bot.id, { type: 'endTurn' });
    }
    changed = true;
    bot.nextAt = now + (game.rollId !== prevRoll ? animDelay(game) : rand(700, 1300));
  }
  return changed;
}

module.exports = { BOT_NAMES, driveBots, decide, evaluateTrade, proposeTrade, tradeValueFor, sensible };
