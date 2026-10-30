// Rastgele botlarla motoru binlerce turda zorlar; tutarlılık kontrolleri yapar.
const { Game } = require('../server/game');
const { SQUARES } = require('../server/board');
let games = 0, totalTurns = 0, errors = 0;
for (let g = 0; g < 300; g++) {
  const n = 2 + (g % 5);
  const game = new Game(Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: '#000', token: 'x' })));
  let steps = 0;
  while (game.phase !== 'gameover' && steps < 20000) {
    steps++;
    const cur = game.current();
    const rnd = Math.random();
    // rastgele herkes yönetim işlemi denesin
    for (const p of game.active()) {
      const owned = Object.keys(game.props).map(Number).filter(i => game.props[i].owner === p.id);
      if (owned.length && Math.random() < 0.3) game.act(p.id, { type: 'build', idx: owned[Math.floor(Math.random()*owned.length)] });
      if (p.cash < 0) {
        if (Math.random() < 0.5) game.autoResolve(p);
        else for (const i of owned) { game.act(p.id, { type: 'sell', idx: i }); game.act(p.id, { type: 'mortgage', idx: i }); }
        if (p.cash < 0 && !p.bankrupt) game.act(p.id, { type: 'bankrupt' });
      }
      if (Math.random() < 0.02) {
        const others = game.active().filter(o => o !== p);
        const o = others[0];
        if (o) {
          const theirs = Object.keys(game.props).map(Number).filter(i => game.props[i].owner === o.id);
          game.act(p.id, { type: 'tradePropose', to: o.id, giveCash: 50000, getProps: theirs.slice(0,1) });
        }
      }
    }
    for (const t of [...game.trades]) game.act(t.to, { type: Math.random() < .5 ? 'tradeAccept' : 'tradeReject', id: t.id });
    if (game.phase === 'gameover') break;
    const c = game.current();
    if (game.phase === 'roll') {
      if (c.inJail && c.jailCards.length && rnd < .5) game.act(c.id, { type: 'useJailCard' });
      else if (c.inJail && rnd < .3) game.act(c.id, { type: 'payJail' });
      game.act(c.id, { type: 'roll' });
    } else if (game.phase === 'buy') {
      if (game.act(c.id, { type: rnd < .7 ? 'buy' : 'decline' }) && game.phase === 'buy') game.act(c.id, { type: 'decline' });
    } else if (game.phase === 'auction') {
      for (const p of game.active()) {
        if (Math.random() < .5 && p.cash > game.auction?.bid + 10000) game.act(p.id, { type: 'bid', amount: game.auction.bid + 10 });
        else if (game.auction) game.act(p.id, { type: 'pass' });
      }
      if (game.auction) game.resolveAuction();
    } else if (game.phase === 'end') {
      game.act(c.id, { type: 'endTurn' });
    }
    // değişmezler
    let houses = 0, hotels = 0;
    for (const [i, pr] of Object.entries(game.props)) {
      if (pr.houses === 5) hotels++; else houses += pr.houses;
      if (pr.owner && game.player(pr.owner).bankrupt) { console.log('bankrupt owner', i); errors++; }
      if (pr.houses && pr.mortgaged) { console.log('mortgaged with houses'); errors++; }
      if (pr.houses && SQUARES[i].type !== 'prop') { errors++; }
    }
    if (houses + game.housesLeft !== 32 || hotels + game.hotelsLeft !== 12) { console.log('house supply mismatch', houses, game.housesLeft, hotels, game.hotelsLeft); errors++; break; }
    if (game.current().bankrupt && game.phase !== 'gameover') { console.log('current bankrupt', game.phase); errors++; break; }
    if (!['roll','buy','auction','end','gameover'].includes(game.phase)) { console.log('bad phase', game.phase); errors++; break; }
  }
  games++; totalTurns += steps;
  if (game.phase !== 'gameover') { /* long game ok */ }
  JSON.stringify(game.toJSON());
}
console.log({ games, avgSteps: Math.round(totalTurns / games), errors });
