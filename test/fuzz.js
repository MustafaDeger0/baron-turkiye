// Rastgele eylemlerle oyun motorunu zorlar; tutarlılık kurallarını denetler
const { Game } = require('../server/game');
const { SQUARES, GROUPS } = require('../server/board');
const { driveBots } = require('../server/bots');
let fails = 0;
const fail = (m) => { fails++; if (fails < 15) console.log('HATA:', m); };
const TYPES = ['roll', 'buy', 'decline', 'endTurn', 'build', 'sell', 'mortgage', 'unmortgage', 'payJail', 'useJailCard', 'bid', 'pass', 'tradePropose', 'tradeAccept', 'tradeReject', 'bankrupt'];
function check(g, tag) {
  let houses = 0, hotels = 0;
  for (const [i, pr] of Object.entries(g.props)) {
    if (pr.houses === 5) hotels++; else houses += pr.houses;
    if (pr.houses && !pr.owner) fail(`${tag}: sahipsiz binada ev ${i}`);
    if (pr.houses && pr.mortgaged) fail(`${tag}: ipotekli mülkte ev ${i}`);
    if (pr.owner && !g.player(pr.owner)) fail(`${tag}: bilinmeyen sahip ${i}`);
    if (pr.owner && g.player(pr.owner).bankrupt) fail(`${tag}: iflas etmiş oyuncunun mülkü ${i}`);
  }
  if (houses + g.housesLeft !== 32) fail(`${tag}: ev sayısı tutmuyor ${houses}+${g.housesLeft}`);
  if (hotels + g.hotelsLeft !== 12) fail(`${tag}: otel sayısı tutmuyor ${hotels}+${g.hotelsLeft}`);
  for (const p of g.players) {
    if (!Number.isFinite(p.cash)) fail(`${tag}: ${p.name} parası sayı değil: ${p.cash}`);
    if (p.pos < 0 || p.pos > 39 || !Number.isInteger(p.pos)) fail(`${tag}: konum ${p.pos}`);
    if (p.bankrupt && p.cash !== 0) fail(`${tag}: iflas edenin parası ${p.cash}`);
    const w = g.netWorth(p); if (!Number.isFinite(w)) fail(`${tag}: servet NaN`);
  }
  if (!Number.isFinite(g.pot) || g.pot < 0) fail(`${tag}: kasa ${g.pot}`);
  if (g.phase !== 'gameover' && g.current().bankrupt) fail(`${tag}: sıra iflas etmiş oyuncuda`);
  const j = JSON.parse(JSON.stringify(g)); if (!j.players) fail('json');
}
const rnd = (n) => Math.floor(Math.random() * n);
for (let gi = 0; gi < 150; gi++) {
  const g = new Game([1, 2, 3, 4].map((k) => ({ id: 'p' + k, name: 'O' + k, color: '#000', token: 'araba', isBot: k > 2 })), { roundLimit: 0 });
  g.startsAt = 0;
  let t = Date.now();
  for (let step = 0; step < 4000 && g.phase !== 'gameover'; step++) {
    const p = g.players[rnd(4)];
    if (!p.isBot && !p.bankrupt) {
      const type = TYPES[rnd(TYPES.length)];
      const own = Object.keys(g.props).filter((i) => g.props[i].owner === p.id).map(Number);
      const a = { type, idx: own.length && Math.random() < 0.8 ? own[rnd(own.length)] : rnd(40), amount: (g.auction ? g.auction.bid : 0) + 10000 * (1 + rnd(5)) };
      if (type === 'bankrupt' && Math.random() < 0.97) continue;
      if (type === 'tradePropose') { const o = g.players[rnd(4)]; Object.assign(a, { to: o.id, giveCash: rnd(3) * 50000, giveProps: own.slice(0, rnd(2)), getProps: Object.keys(g.props).filter((i) => g.props[i].owner === o.id).map(Number).slice(0, rnd(2)) }); }
      if (type === 'tradeAccept' || type === 'tradeReject') { const tr = g.trades.find((x) => x.to === p.id); if (tr) a.id = tr.id; }
      if (type === 'build' && (!g.isCurrent(p))) { const before = JSON.stringify(g.props); const err = g.act(p.id, a); if (!err) fail('sıra dışında inşaat kabul edildi'); if (JSON.stringify(g.props) !== before) fail('sıra dışında inşaat oldu'); continue; }
      if (Math.random() < 0.5) {   // yeterince oynansın diye bazen grubu tamamla
        const gname = Object.keys(GROUPS)[rnd(8)];
        const mem = SQUARES.filter((s) => s.group === gname).map((s) => s.index);
        if (mem.every((i) => !g.props[i].owner || g.props[i].owner === p.id) && Math.random() < 0.05) mem.forEach((i) => { g.props[i].owner = p.id; });
      }
      g.act(p.id, a);
    }
    t += 400; driveBots(g, t); g.tick(t);
    check(g, `oyun ${gi} adım ${step}`);
    if (fails > 30) break;
  }
}
console.log(fails ? `FUZZ: ${fails} hata` : 'FUZZ TESTİ GEÇTİ');
process.exit(fails ? 1 : 0);
