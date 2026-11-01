// Bot oyuncular: sunucuda çalışan basit ama makul bir yapay zekâ.
const crypto = require('crypto');
const { SQUARES, GROUPS, GROUP_MEMBERS, K } = require('./board');

const BOT_NAMES = ['Bot Kemal', 'Bot Ayşe', 'Bot Mehmet', 'Bot Elif', 'Bot Cem', 'Bot Zehra'];
const RESERVE = 100 * K;          // elde tutulmaya çalışılan nakit
const STEP_MS = 210, DICE_MS = 1050;

const rand = (a, b) => a + crypto.randomInt(Math.max(1, b - a));

// Bir mülk, alan kişi için grubu tamamlar mı?
function completesGroup(game, pid, idx) {
  const s = SQUARES[idx];
  if (s.type !== 'prop') return false;
  return GROUP_MEMBERS[s.group].every((i) => i === idx || game.props[i].owner === pid);
}
function propValue(game, pid, idx) {
  const s = SQUARES[idx];
  return s.price * (completesGroup(game, pid, idx) ? 2.2 : 1);
}

// Hareket animasyonunun istemcide süreceği yaklaşık süre (bot beklesin ki izlenebilsin)
function animDelay(game) {
  let t = DICE_MS + 600 + 750; // + hedef kare önizlemesi
  for (const m of game.moves || []) {
    if (m.kind === 'jail') { t += 2500; continue; }
    const n = m.kind === 'back' ? (m.from - m.to + 40) % 40 : (m.to - m.from + 40) % 40;
    t += n > 12 ? 2400 : n * STEP_MS;
  }
  if (game.card) t += 1500;
  return t + 700;
}

function chooseManagement(game, bot) {
  // ipotek kaldır
  for (const [i, pr] of Object.entries(game.props)) {
    if (pr.owner !== bot.id || !pr.mortgaged) continue;
    const cost = Math.ceil(SQUARES[i].mortgage * 1.1);
    if (bot.cash - cost > RESERVE * 3) return { type: 'unmortgage', idx: +i };
  }
  // ev / otel dik
  let best = null;
  for (const g of Object.keys(GROUPS)) {
    if (!game.ownsGroup(bot.id, g)) continue;
    const mem = GROUP_MEMBERS[g];
    if (mem.some((i) => game.props[i].mortgaged)) continue;
    const min = Math.min(...mem.map((i) => game.props[i].houses));
    if (min >= 5) continue;
    const idx = mem.find((i) => game.props[i].houses === min);
    const cost = GROUPS[g].house;
    if (bot.cash - cost < RESERVE) continue;
    if (min < 4 && game.housesLeft <= 0) continue;
    if (min === 4 && game.hotelsLeft <= 0) continue;
    if (!best || SQUARES[idx].rent[min + 1] > SQUARES[best].rent[game.props[best].houses + 1]) best = idx;
  }
  if (best !== null) return { type: 'build', idx: best };
  return null;
}

// Tekel için eksik tek mülkü başka bir oyuncudan istemek (takas veya para teklifi)
function proposeTrade(game, bot) {
  if (game.trades.some((t) => t.from === bot.id)) return null;
  if ((bot.lastTradeTurn || -99) > game.turnCount - 6) return null;
  for (const g of Object.keys(GROUPS)) {
    const mem = GROUP_MEMBERS[g];
    const mine = mem.filter((i) => game.props[i].owner === bot.id);
    const missing = mem.filter((i) => game.props[i].owner !== bot.id);
    if (missing.length !== 1 || mine.length === 0) continue;
    const want = missing[0], owner = game.props[want].owner;
    if (!owner || game.player(owner).bankrupt) continue;
    if (mem.some((i) => game.props[i].houses > 0)) continue;
    bot.lastTradeTurn = game.turnCount;
    // karşı tarafa tekel tamamlatacak bir mülküm varsa takas öner
    const swap = Object.keys(game.props).map(Number).find((i) => game.props[i].owner === bot.id && completesGroup(game, owner, i)
      && !(SQUARES[i].type === 'prop' && GROUP_MEMBERS[SQUARES[i].group].some((j) => game.props[j].houses > 0)));
    if (swap !== undefined) return { type: 'tradePropose', to: owner, giveProps: [swap], getProps: [want] };
    const cash = Math.min(Math.round((SQUARES[want].price * 1.8) / K) * K, bot.cash - RESERVE);
    if (cash >= SQUARES[want].price) return { type: 'tradePropose', to: owner, giveCash: cash, getProps: [want] };
  }
  return null;
}

function evaluateTrade(game, bot, t) {
  const other = t.from;
  let give = t.getCash, get = t.giveCash;
  const gainsMonopoly = t.giveProps.some((i) => completesGroup(game, bot.id, i));
  for (const i of t.getProps) {
    give += SQUARES[i].price;
    if (completesGroup(game, other, i)) give += SQUARES[i].price * (gainsMonopoly ? 0.8 : 3); // rakibe tekel verme
  }
  for (const i of t.giveProps) get += propValue(game, bot.id, i);
  give += t.getJail * 50 * K; get += t.giveJail * 50 * K;
  if (t.getCash > bot.cash - RESERVE) return false;
  return get > give * 1.1;
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
      // geçersizse güvenli bir eyleme düş
      if (a.type === 'buy') game.act(bot.id, { type: 'decline' });
      else if (a.type === 'bid') game.act(bot.id, { type: 'pass' });
      else if (a.type === 'build' || a.type === 'unmortgage') game.act(bot.id, { type: 'endTurn' });
    }
    changed = true;
    bot.nextAt = now + (game.rollId !== prevRoll ? animDelay(game) : rand(700, 1300));
  }
  return changed;
}

module.exports = { BOT_NAMES, driveBots, decide };
