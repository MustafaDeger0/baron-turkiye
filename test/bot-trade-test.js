// Bot takas kararları: anlamsız (aynı set) takas yok, set tamamlayan teklifler, adil değerlendirme
const { Game } = require('../server/game');
const { decide, evaluateTrade, sensible } = require('../server/bots');
const { K } = require('../server/board');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } console.log('ok -', m); };
const mk = () => { const g = new Game([{ id: 'h', name: 'İnsan' }, { id: 'b', name: 'Bot', isBot: true }]); g.turn = g.players.findIndex((p) => p.id === 'b'); g.phase = 'end'; g.turnCount = 50; return g; };
const own = (g, pid, idxs) => idxs.forEach((i) => { g.props[i].owner = pid; });

// 1) Bende Ankara, onda İstanbul: bot "ikisini ters çevirelim" dememeli
let g = mk(); own(g, 'b', [37]); own(g, 'h', [39]);
let a = decide(g, g.player('b'));
assert(!(a.type === 'tradePropose' && a.giveProps.includes(37) && a.getProps.includes(39)), `aynı setten ters takas önerilmedi (${a.type}${a.type === 'tradePropose' ? ` ver:${a.giveProps} al:${a.getProps} para:${a.giveCash}` : ''})`);
if (a.type === 'tradePropose') assert(sensible({ ...a, getCash: 0, giveJail: 0, getJail: 0 }), 'teklif mantıklı');

// 2) Botun 2/3 açık mavisi var, eksik Çorum insanda: setini tamamlamak için teklif yapmalı
g = mk(); own(g, 'b', [6, 8]); own(g, 'h', [9]);
a = decide(g, g.player('b'));
assert(a.type === 'tradePropose' && a.getProps.includes(9) && !a.giveProps.some((i) => [6, 8, 9].includes(i)), `set tamamlayan teklif: Çorum isteniyor (ver:${a.giveProps} para:${a.giveCash})`);

// 3) Karşılıklı set: bot açık mavi 2/3 + tek Ankara; insan Çorum + İstanbul → Ankara↔Çorum ikisinin de setini tamamlar
g = mk(); own(g, 'b', [6, 8, 37]); own(g, 'h', [9, 39]);
a = decide(g, g.player('b'));
assert(a.type === 'tradePropose' && (a.getProps.includes(9) || a.getProps.includes(39)) && sensible({ ...a, getCash: 0, giveJail: 0, getJail: 0 }), `set tamamlamaya yönelik mantıklı teklif (al:${a.getProps} ver:${a.giveProps} para:${a.giveCash})`);
assert(a.giveCash <= g.player('b').cash * 0.55, 'parasının yarısından fazlasını teklif etmiyor');

// 4) Gelen anlamsız teklif reddedilir: aynı setten değiş tokuş
g = mk(); own(g, 'b', [37]); own(g, 'h', [39]);
let t = { id: 1, from: 'h', to: 'b', giveProps: [39], getProps: [37], giveCash: 0, getCash: 0, giveJail: 0, getJail: 0 };
assert(!evaluateTrade(g, g.player('b'), t), 'aynı setten değiş tokuş reddedildi');

// 5) Bot, rakibe set tamamlatan ucuz teklifi reddeder, cömert teklifi kabul eder
g = mk(); own(g, 'b', [9]); own(g, 'h', [6, 8]);
t = { id: 2, from: 'h', to: 'b', giveProps: [], getProps: [9], giveCash: 150 * K, getCash: 0, giveJail: 0, getJail: 0 };
assert(!evaluateTrade(g, g.player('b'), t), 'rakibe seti ucuza vermez (150.000)');
t.giveCash = 800 * K;
assert(evaluateTrade(g, g.player('b'), t), 'cömert teklifi kabul eder (800.000)');

// 6) İki tarafa da set kazandıran takas: bot kabul eder
g = mk(); own(g, 'b', [6, 8, 37]); own(g, 'h', [9, 39]);
t = { id: 3, from: 'h', to: 'b', giveProps: [9], getProps: [37], giveCash: 100 * K, getCash: 0, giveJail: 0, getJail: 0 };
const ok6 = evaluateTrade(g, g.player('b'), t);
console.log('   (karşılıklı set + 100.000 → bot', ok6 ? 'kabul etti' : 'reddetti', ')');
console.log('BOT TAKAS TESTLERİ GEÇTİ');
