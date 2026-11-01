// Sadece botlardan oluşan oyunlar sonuna kadar oynanabiliyor mu?
const { Game } = require('../server/game');
const { driveBots } = require('../server/bots');
let finished = 0, turnsTotal = 0, maxRounds = 0;
const N = 60;
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 4);
  const game = new Game(Array.from({ length: n }, (_, i) => ({ id: 'b' + i, name: 'Bot' + i, isBot: true })));
  let t = Date.now(), steps = 0;
  while (game.phase !== 'gameover' && steps < 60000) {
    t += 400; steps++;
    driveBots(game, t);
    game.tick(t);
  }
  if (game.phase === 'gameover') finished++;
  turnsTotal += game.rollId; maxRounds = Math.max(maxRounds, game.rollId);
  let houses = 0, hotels = 0;
  for (const pr of Object.values(game.props)) { if (pr.houses === 5) hotels++; else houses += pr.houses; }
  if (houses + game.housesLeft !== 32 || hotels + game.hotelsLeft !== 12) { console.log('ARZ HATASI'); process.exit(1); }
}
console.log({ games: N, finished, avgRolls: Math.round(turnsTotal / N), maxRolls: maxRounds });
if (finished < N * 0.8) { console.log('Çok az oyun bitti'); process.exit(1); }
