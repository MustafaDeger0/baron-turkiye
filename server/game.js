// Sunucu tarafında yetkili oyun motoru. Tüm kurallar burada uygulanır;
// istemciler yalnızca eylem gönderir ve durumu görüntüler.
const crypto = require('crypto');
const { SQUARES, GROUPS, GROUP_MEMBERS, CHANCE, CHEST, K, BUILD_LIMIT } = require('./board');
const GO_MONEY = 200 * K;
const JAIL_FEE = 50 * K;

const TIMING = {
  TURN_MS: 60_000,          // sıradaki oyuncunun karar süresi
  OFFLINE_TURN_MS: 12_000,  // bağlantısı kopan oyuncunun süresi
  DEBT_MS: 90_000,          // borç kapatma süresi
  OFFLINE_DEBT_MS: 15_000,
  AUCTION_MS: 12_000,       // açık artırma başlangıç süresi
  AUCTION_BID_MS: 7_000,    // her tekliften sonra en az kalan süre
  OFFLINE_KICK_MS: 180_000, // 3 dk bağlanmayan oyuncu iflas eder
};

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const die = () => crypto.randomInt(1, 7);
const isInt = (n) => Number.isInteger(n);
const tl = (n) => `B${Number(n).toLocaleString('tr-TR')}`;

class Game {
  constructor(players, opts = {}) {
    this.startMoney = opts.startMoney || 1500 * K;
    this.roundLimit = opts.roundLimit === 0 ? 0 : (opts.roundLimit || 40);
    this.turnCount = 0;
    this.players = shuffle(players.map((p) => ({
      id: p.id, name: p.name, color: p.color, token: p.token, isBot: !!p.isBot,
      cash: this.startMoney, pos: 0, inJail: false, jailTurns: 0, jailCards: [],
      bankrupt: false, connected: true, offlineSince: null, debtTo: null, debtSince: null,
    })));
    this.props = {};
    SQUARES.forEach((s) => { if (s.price) this.props[s.index] = { owner: null, houses: 0, mortgaged: false }; });
    this.pot = 0;          // Ücretsiz Otopark kasası
    this.potWins = 0;
    this.housesLeft = 32;
    this.hotelsLeft = 12;
    this.decks = { chance: shuffle([...CHANCE.keys()]), chest: shuffle([...CHEST.keys()]) };
    this.turn = 0;
    this.phase = 'roll';
    this.doubles = 0;
    this.extraRoll = false;
    this.dice = [1, 1];
    this.rollId = 0;
    this.moves = []; // son zar atışındaki hareketler (istemci animasyonu için)
    this.pendingBuy = null;
    this.auction = null;
    this.trades = [];
    this.tradeSeq = 0;
    this.log = [];
    this.logSeq = 0;
    this.card = null;
    this.cardSeq = 0;
    this.winner = null;
    this.startedAt = Date.now();
    this.addLog(`Oyun başladı! Sıra: ${this.players.map((p) => p.name).join(' → ')}`);
    this.resetDeadline();
  }

  // ---------- yardımcılar ----------
  addLog(text) {
    this.log.push({ seq: ++this.logSeq, text });
    if (this.log.length > 150) this.log.shift();
  }
  player(id) { return this.players.find((p) => p.id === id); }
  current() { return this.players[this.turn]; }
  active() { return this.players.filter((p) => !p.bankrupt); }
  isCurrent(p) { return this.current() === p; }
  resetDeadline() {
    const cur = this.current();
    this.deadline = Date.now() + (cur && cur.connected ? TIMING.TURN_MS : TIMING.OFFLINE_TURN_MS);
  }
  ownsGroup(pid, group) { return GROUP_MEMBERS[group].every((i) => this.props[i].owner === pid); }
  groupHasBuildings(group) { return GROUP_MEMBERS[group].some((i) => this.props[i].houses > 0); }
  countOwned(pid, type) { return SQUARES.filter((s) => s.type === type && this.props[s.index].owner === pid).length; }

  pay(from, to, amount, reason, toName) {
    if (amount <= 0) return;
    from.cash -= amount;
    if (to) to.cash += amount;
    this.addLog(`${from.name} → ${to ? to.name : (toName || 'Banka')}: ${tl(amount)} (${reason})`);
    if (from.cash < 0) {
      if (!from.debtSince) from.debtSince = Date.now();
      from.debtTo = to ? to.id : null;
      this.addLog(`${from.name} borçlu duruma düştü (${tl(-from.cash)}). Mülk ipotekle/ev sat ya da iflas et.`);
    }
  }
  // Cezalar (vergi, kart, onarım, hapis) bankaya değil Ücretsiz Otopark kasasına gider
  payToPot(p, amount, reason) {
    if (amount <= 0) return;
    this.pot += amount;
    this.pay(p, null, amount, reason, 'Otopark kasası');
    this.addLog(`Otopark kasasında şimdi ${tl(this.pot)} var.`);
  }
  receive(p, amount, reason) {
    p.cash += amount;
    this.addLog(`${p.name} bankadan ${tl(amount)} aldı (${reason})`);
  }
  refreshDebts() {
    for (const p of this.players) {
      if (p.debtSince && p.cash >= 0) {
        p.debtSince = null; p.debtTo = null;
        this.addLog(`${p.name} borcunu kapattı.`);
        if (this.isCurrent(p)) this.resetDeadline();
      }
    }
  }

  // ---------- eylem dağıtıcı ----------
  act(pid, a) {
    if (this.phase === 'gameover') return 'Oyun bitti.';
    const p = this.player(pid);
    if (!p) return 'Oyuncu bulunamadı.';
    if (p.bankrupt) return 'İflas ettin, artık yalnızca izleyebilirsin.';
    if (!a || typeof a.type !== 'string') return 'Geçersiz eylem.';
    const idx = a.idx;
    let err;
    switch (a.type) {
      case 'roll': err = this.roll(p); break;
      case 'payJail': err = this.payJail(p); break;
      case 'useJailCard': err = this.useJailCard(p); break;
      case 'buy': err = this.buy(p); break;
      case 'decline': err = this.decline(p); break;
      case 'bid': err = this.bid(p, a.amount); break;
      case 'pass': err = this.passAuction(p); break;
      case 'endTurn': err = this.endTurn(p); break;
      case 'build': err = this.build(p, idx); break;
      case 'sell': err = this.sell(p, idx); break;
      case 'mortgage': err = this.mortgage(p, idx); break;
      case 'unmortgage': err = this.unmortgage(p, idx); break;
      case 'tradePropose': err = this.tradePropose(p, a); break;
      case 'tradeAccept': err = this.tradeAccept(p, a.id); break;
      case 'tradeReject': err = this.tradeReject(p, a.id); break;
      case 'tradeCancel': err = this.tradeCancel(p, a.id); break;
      case 'bankrupt': err = this.bankrupt(p); break;
      default: err = 'Bilinmeyen eylem.';
    }
    if (!err) {
      this.refreshDebts();
      if (this.isCurrent(p) && ['roll', 'payJail', 'useJailCard', 'buy', 'decline'].includes(a.type)) this.resetDeadline();
      this.checkWinner();
    }
    return err || null;
  }

  // ---------- zar & hareket ----------
  roll(p) {
    if (!this.isCurrent(p)) return 'Sıra sende değil.';
    if (this.phase !== 'roll') return 'Şu an zar atamazsın.';
    if (p.cash < 0) return 'Önce borcunu kapatmalısın.';
    const a = this.forceDice ? this.forceDice[0] : die(), b = this.forceDice ? this.forceDice[1] : die(), sum = a + b, dbl = a === b;
    this.dice = [a, b];
    this.rollId++;
    this.moves = [];
    this.rollLogSeq = this.logSeq;
    this.addLog(`${p.name} zar attı: ${a} + ${b} = ${sum}${dbl ? ' (çift!)' : ''}`);
    if (p.inJail) {
      if (dbl) {
        p.inJail = false; p.jailTurns = 0;
        this.addLog(`${p.name} çift attı ve hapisten çıktı.`);
      } else {
        p.jailTurns++;
        if (p.jailTurns >= 3) {
          this.addLog(`${p.name} 3. denemede de çift atamadı, ${tl(JAIL_FEE)} ödeyip çıkıyor.`);
          this.payToPot(p, JAIL_FEE, 'Hapis cezası');
          p.inJail = false; p.jailTurns = 0;
        } else {
          this.phase = 'end';
          return null;
        }
      }
      this.extraRoll = false;
      this.move(p, sum);
    } else {
      if (dbl) {
        this.doubles++;
        if (this.doubles >= 3) {
          this.addLog(`${p.name} üst üste 3 kez çift attı!`);
          this.sendToJail(p);
          this.phase = 'end';
          return null;
        }
      }
      this.extraRoll = dbl;
      this.move(p, sum);
    }
    this.afterMove();
    return null;
  }

  afterMove() {
    if (this.phase === 'buy' || this.phase === 'auction' || this.phase === 'gameover') return;
    const p = this.current();
    if (p.bankrupt) return;
    this.phase = this.extraRoll && !p.inJail ? 'roll' : 'end';
  }

  passGo(p) { this.receive(p, GO_MONEY, 'BAŞLANGIÇ\'tan geçti'); }

  move(p, steps) {
    const np = (p.pos + steps + 40) % 40;
    if (steps > 0 && np < p.pos) this.passGo(p);
    this.moves.push({ pid: p.id, from: p.pos, to: np, kind: 'walk' });
    p.pos = np;
    this.land(p, { dice: steps });
  }

  moveTo(p, target, opts = {}) {
    if (target < p.pos) this.passGo(p);
    this.moves.push({ pid: p.id, from: p.pos, to: target, kind: 'walk' });
    p.pos = target;
    this.land(p, opts);
  }

  sendToJail(p) {
    this.moves.push({ pid: p.id, from: p.pos, to: 10, kind: 'jail' });
    p.pos = 10; p.inJail = true; p.jailTurns = 0;
    this.extraRoll = false;
    this.addLog(`${p.name} hapse girdi.`);
  }

  land(p, opts = {}) {
    const sq = SQUARES[p.pos];
    switch (sq.type) {
      case 'prop': case 'station': case 'utility': {
        const pr = this.props[p.pos];
        if (pr.owner === null) {
          this.addLog(`${p.name}, ${sq.name} karesine geldi (satılık: ${tl(sq.price)}).`);
          this.phase = 'buy';
          this.pendingBuy = p.pos;
          return;
        }
        if (pr.owner === p.id) { this.addLog(`${p.name} kendi mülkü ${sq.name} üzerinde.`); return; }
        if (pr.mortgaged) { this.addLog(`${sq.name} ipotekli, kira yok.`); return; }
        const owner = this.player(pr.owner);
        if (!owner || owner.bankrupt) return;
        const rent = this.rent(p.pos, opts);
        this.pay(p, owner, rent, `${sq.name} kirası`);
        return;
      }
      case 'tax': this.payToPot(p, sq.amount, sq.name); return;
      case 'chance': this.drawCard(p, 'chance'); return;
      case 'chest': this.drawCard(p, 'chest'); return;
      case 'gotojail': this.sendToJail(p); return;
      case 'jail': this.addLog(`${p.name} hapishaneyi ziyaret ediyor.`); return;
      case 'parking':
        if (this.pot > 0) {
          const won = this.pot;
          this.pot = 0;
          p.cash += won;
          this.potWins++;
          this.addLog(`${p.name} Ücretsiz Otopark kasasındaki ${tl(won)}'yi kaptı!`);
        } else this.addLog(`${p.name} otoparkta dinleniyor (kasa boş).`);
        return;
      default: return;
    }
  }

  rent(idx, opts = {}) {
    const sq = SQUARES[idx], pr = this.props[idx];
    if (sq.type === 'prop') {
      if (pr.houses > 0) return sq.rent[pr.houses];
      return sq.rent[0] * (this.ownsGroup(pr.owner, sq.group) ? 2 : 1);
    }
    if (sq.type === 'station') {
      const n = this.countOwned(pr.owner, 'station');
      return 25 * K * 2 ** (n - 1) * (opts.stationMult || 1);
    }
    if (sq.type === 'utility') {
      if (opts.utilityRoll) {
        const a = die(), b = die();
        this.dice = [a, b]; this.rollId++;
        this.addLog(`İdare kirası için zar: ${a} + ${b} → ×10`);
        return (a + b) * 10 * K;
      }
      const n = this.countOwned(pr.owner, 'utility');
      const sum = opts.dice || this.dice[0] + this.dice[1];
      return sum * (n === 2 ? 10 : 4) * K;
    }
    return 0;
  }

  drawCard(p, deck) {
    const list = deck === 'chance' ? CHANCE : CHEST;
    const id = this.decks[deck].shift();
    const card = list[id];
    if (!card.jailFree) this.decks[deck].push(id);
    this.card = { deck, text: card.text, seq: ++this.cardSeq, player: p.id };
    this.cardRollId = this.rollId;
    this.addLog(`${p.name} ${deck === 'chance' ? 'Şans' : 'Kamu Fonu'} kartı çekti: "${card.text}"`);

    if (card.move !== undefined) return this.moveTo(p, card.move);
    if (card.moveRel) {
      const to = (p.pos + card.moveRel + 40) % 40;
      this.moves.push({ pid: p.id, from: p.pos, to, kind: 'back' });
      p.pos = to;
      return this.land(p);
    }
    if (card.nearest) {
      let t = p.pos;
      do { t = (t + 1) % 40; } while (SQUARES[t].type !== card.nearest);
      return this.moveTo(p, t, card.nearest === 'station' ? { stationMult: 2 } : { utilityRoll: true });
    }
    if (card.money > 0) return this.receive(p, card.money, 'kart');
    if (card.money < 0) return this.payToPot(p, -card.money, 'kart');
    if (card.jail) return this.sendToJail(p);
    if (card.jailFree) { p.jailCards.push(deck); return; }
    if (card.repairs) {
      let houses = 0, hotels = 0;
      for (const [i, pr] of Object.entries(this.props)) {
        if (pr.owner !== p.id) continue;
        if (pr.houses === 5) hotels++; else houses += pr.houses;
        void i;
      }
      const cost = houses * card.repairs[0] + hotels * card.repairs[1];
      if (cost > 0) this.payToPot(p, cost, `onarım (${houses} ev, ${hotels} otel)`);
      else this.addLog(`${p.name}'in binası yok, ödeme çıkmadı.`);
      return;
    }
    if (card.eachPlayer) {
      for (const o of this.active()) {
        if (o === p) continue;
        if (card.eachPlayer > 0) this.pay(o, p, card.eachPlayer, 'kart');
        else this.pay(p, o, -card.eachPlayer, 'kart');
      }
    }
  }

  // ---------- hapis ----------
  payJail(p) {
    if (!this.isCurrent(p) || this.phase !== 'roll' || !p.inJail) return 'Şu an kefalet ödeyemezsin.';
    if (p.cash < JAIL_FEE) return 'Yeterli paran yok.';
    this.payToPot(p, JAIL_FEE, 'Hapis kefaleti');
    p.inJail = false; p.jailTurns = 0;
    this.addLog(`${p.name} kefaletle serbest kaldı.`);
    return null;
  }
  useJailCard(p) {
    if (!this.isCurrent(p) || this.phase !== 'roll' || !p.inJail) return 'Şu an kart kullanamazsın.';
    if (!p.jailCards.length) return 'Hapisten çıkış kartın yok.';
    const deck = p.jailCards.shift();
    const id = (deck === 'chance' ? CHANCE : CHEST).findIndex((c) => c.jailFree);
    this.decks[deck].push(id);
    p.inJail = false; p.jailTurns = 0;
    this.addLog(`${p.name} Hapisten Çıkış Kartı kullandı.`);
    return null;
  }

  // ---------- satın alma & açık artırma ----------
  buy(p) {
    if (!this.isCurrent(p) || this.phase !== 'buy') return 'Şu an satın alamazsın.';
    const sq = SQUARES[this.pendingBuy];
    if (p.cash < sq.price) return 'Yeterli paran yok. Açık artırmaya çıkarabilirsin.';
    p.cash -= sq.price;
    this.props[sq.index].owner = p.id;
    this.addLog(`${p.name}, ${sq.name} mülkünü ${tl(sq.price)}'ye satın aldı.`);
    this.pendingBuy = null;
    this.phase = 'moving';
    this.afterMove();
    return null;
  }
  decline(p) {
    if (!this.isCurrent(p) || this.phase !== 'buy') return 'Şu an bu işlem yapılamaz.';
    this.startAuction(this.pendingBuy);
    return null;
  }
  startAuction(idx) {
    this.phase = 'auction';
    this.auction = {
      idx, bid: 0, bidder: null,
      passed: this.players.filter((p) => p.bankrupt || !p.connected).map((p) => p.id),
      endsAt: Date.now() + TIMING.AUCTION_MS,
    };
    this.addLog(`${SQUARES[idx].name} açık artırmaya çıktı!`);
    this.checkAuctionEnd();
  }
  bid(p, amount) {
    const au = this.auction;
    if (this.phase !== 'auction' || !au) return 'Açık artırma yok.';
    if (au.passed.includes(p.id)) return 'Bu artırmadan çekildin.';
    if (!isInt(amount) || amount <= au.bid || amount < 1) return 'Teklif mevcut tekliften yüksek olmalı.';
    if (amount > p.cash) return 'Bu teklif için paran yetmiyor.';
    au.bid = amount; au.bidder = p.id;
    au.endsAt = Math.max(au.endsAt, Date.now() + TIMING.AUCTION_BID_MS);
    this.addLog(`${p.name} ${tl(amount)} teklif etti.`);
    this.checkAuctionEnd();
    return null;
  }
  passAuction(p) {
    const au = this.auction;
    if (this.phase !== 'auction' || !au) return 'Açık artırma yok.';
    if (au.passed.includes(p.id)) return 'Zaten çekildin.';
    if (au.bidder === p.id) return 'En yüksek teklif sende, çekilemezsin.';
    au.passed.push(p.id);
    this.addLog(`${p.name} artırmadan çekildi.`);
    this.checkAuctionEnd();
    return null;
  }
  checkAuctionEnd() {
    const au = this.auction;
    if (!au) return;
    const remaining = this.active().filter((p) => !au.passed.includes(p.id)).map((p) => p.id);
    if ((au.bidder && remaining.every((id) => id === au.bidder)) || (!au.bidder && remaining.length === 0)) {
      this.resolveAuction();
    }
  }
  resolveAuction() {
    const au = this.auction;
    if (!au) return;
    const sq = SQUARES[au.idx];
    const w = au.bidder && this.player(au.bidder);
    if (w && !w.bankrupt && w.cash >= au.bid) {
      w.cash -= au.bid;
      this.props[au.idx].owner = w.id;
      this.addLog(`${sq.name}, ${w.name} tarafından ${tl(au.bid)}'ye alındı.`);
    } else {
      this.addLog(`${sq.name} için teklif gelmedi, bankada kaldı.`);
    }
    this.auction = null;
    this.pendingBuy = null;
    this.phase = 'moving';
    if (this.current().bankrupt) this.nextTurn();
    else this.afterMove();
  }

  // ---------- tur ----------
  endTurn(p) {
    if (!this.isCurrent(p)) return 'Sıra sende değil.';
    if (this.phase === 'roll') return p.inJail ? 'Önce zar at, kefalet öde ya da kart kullan.' : 'Önce zar atmalısın.';
    if (this.phase !== 'end') return 'Turu şu an bitiremezsin.';
    if (p.cash < 0) return 'Borcunu kapatmadan turu bitiremezsin.';
    this.nextTurn();
    return null;
  }
  nextTurn() {
    if (this.phase === 'gameover') return;
    this.doubles = 0; this.extraRoll = false; this.pendingBuy = null;
    this.turnCount++;
    if (this.roundLimit && this.turnCount >= this.roundLimit * this.players.length) { this.endByLimit(); return; }
    const n = this.players.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.turn + k) % n;
      if (!this.players[i].bankrupt) { this.turn = i; break; }
    }
    this.phase = 'roll';
    this.current().builds = 0;
    this.addLog(`Sıra ${this.current().name} oyuncusunda.`);
    this.resetDeadline();
  }

  // ---------- inşaat & ipotek ----------
  ownProp(p, idx) {
    if (!isInt(idx) || !this.props[idx]) return 'Geçersiz mülk.';
    if (this.props[idx].owner !== p.id) return 'Bu mülk senin değil.';
    return null;
  }
  build(p, idx) {
    const e = this.ownProp(p, idx); if (e) return e;
    if (this.phase === 'auction') return 'Açık artırma sırasında inşaat yapılamaz.';
    const sq = SQUARES[idx], pr = this.props[idx];
    if (sq.type !== 'prop') return 'Buraya bina yapılamaz.';
    if (!this.ownsGroup(p.id, sq.group)) return 'Önce bu renk grubunun tamamına sahip olmalısın.';
    const members = GROUP_MEMBERS[sq.group];
    if (members.some((i) => this.props[i].mortgaged)) return 'Grupta ipotekli mülk var.';
    if (pr.houses >= 5) return 'Zaten otel var.';
    if (pr.houses > Math.min(...members.map((i) => this.props[i].houses))) return 'Evleri gruba eşit dağıtmalısın.';
    if ((p.builds || 0) >= BUILD_LIMIT) return `Bir turda en fazla ${BUILD_LIMIT} bina dikebilirsin. Sıran tekrar gelince devam et.`;
    const cost = pr.houses === 4 ? GROUPS[sq.group].hotel : GROUPS[sq.group].house;
    if (p.cash < cost) return 'Yeterli paran yok.';
    if (pr.houses === 4) {
      if (this.hotelsLeft <= 0) return 'Bankada otel kalmadı.';
      pr.houses = 5; this.hotelsLeft--; this.housesLeft += 4;
      this.addLog(`${p.name}, ${sq.name} üzerine otel dikti.`);
    } else {
      if (this.housesLeft <= 0) return 'Bankada ev kalmadı.';
      pr.houses++; this.housesLeft--;
      this.addLog(`${p.name}, ${sq.name} üzerine ev yaptı (${pr.houses}).`);
    }
    p.cash -= cost;
    p.builds = (p.builds || 0) + 1;
    return null;
  }
  sell(p, idx) {
    const e = this.ownProp(p, idx); if (e) return e;
    const sq = SQUARES[idx], pr = this.props[idx];
    if (sq.type !== 'prop' || pr.houses === 0) return 'Satılacak bina yok.';
    const members = GROUP_MEMBERS[sq.group];
    if (pr.houses < Math.max(...members.map((i) => this.props[i].houses))) return 'Binaları gruptan eşit satmalısın.';
    const half = GROUPS[sq.group].house / 2, hotelHalf = GROUPS[sq.group].hotel / 2;
    if (pr.houses === 5) {
      if (this.housesLeft >= 4) {
        pr.houses = 4; this.housesLeft -= 4; this.hotelsLeft++;
        p.cash += hotelHalf;
        this.addLog(`${p.name}, ${sq.name} otelini sattı (+${tl(hotelHalf)}).`);
      } else {
        pr.houses = 0; this.hotelsLeft++;
        p.cash += hotelHalf + half * 4;
        this.addLog(`${p.name}, ${sq.name} otelini sattı; bankada ev olmadığından tüm binalar gitti (+${tl(hotelHalf + half * 4)}).`);
      }
    } else {
      pr.houses--; this.housesLeft++;
      p.cash += half;
      this.addLog(`${p.name}, ${sq.name} üzerinden bir ev sattı (+${tl(half)}).`);
    }
    return null;
  }
  mortgage(p, idx) {
    const e = this.ownProp(p, idx); if (e) return e;
    const sq = SQUARES[idx], pr = this.props[idx];
    if (pr.mortgaged) return 'Zaten ipotekli.';
    if (sq.type === 'prop' && this.groupHasBuildings(sq.group)) return 'Önce gruptaki binaları satmalısın.';
    pr.mortgaged = true;
    p.cash += sq.mortgage;
    this.addLog(`${p.name}, ${sq.name} mülkünü ipotek etti (+${tl(sq.mortgage)}).`);
    return null;
  }
  unmortgage(p, idx) {
    const e = this.ownProp(p, idx); if (e) return e;
    const sq = SQUARES[idx], pr = this.props[idx];
    if (!pr.mortgaged) return 'İpotekli değil.';
    const cost = Math.ceil(sq.mortgage * 1.1);
    if (p.cash < cost) return 'Yeterli paran yok.';
    p.cash -= cost; pr.mortgaged = false;
    this.addLog(`${p.name}, ${sq.name} ipoteğini kaldırdı (-${tl(cost)}).`);
    return null;
  }

  // ---------- takas ----------
  validateTrade(t) {
    const from = this.player(t.from), to = this.player(t.to);
    if (!from || !to || from.bankrupt || to.bankrupt || from === to) return 'Geçersiz oyuncu.';
    if (t.giveCash > Math.max(0, from.cash)) return `${from.name} teklif ettiği parayı karşılayamıyor.`;
    if (t.getCash > Math.max(0, to.cash)) return `${to.name} istenen parayı karşılayamıyor.`;
    for (const i of t.giveProps) if (!this.props[i] || this.props[i].owner !== from.id) return 'Teklifteki mülkler artık geçerli değil.';
    for (const i of t.getProps) if (!this.props[i] || this.props[i].owner !== to.id) return 'İstenen mülkler artık geçerli değil.';
    for (const i of [...t.giveProps, ...t.getProps]) {
      const sq = SQUARES[i];
      if (sq.type === 'prop' && this.groupHasBuildings(sq.group)) return `${sq.name} grubunda bina var; önce binaları sat.`;
    }
    if (t.giveJail > from.jailCards.length || t.getJail > to.jailCards.length) return 'Hapis kartı sayısı geçersiz.';
    if (!t.giveCash && !t.getCash && !t.giveProps.length && !t.getProps.length && !t.giveJail && !t.getJail) return 'Boş takas teklifi.';
    return null;
  }
  tradePropose(p, a) {
    const cleanList = (l) => (Array.isArray(l) ? [...new Set(l.filter(isInt))].slice(0, 28) : []);
    const num = (n) => (isInt(n) && n > 0 ? n : 0);
    const t = {
      id: ++this.tradeSeq, from: p.id, to: a.to,
      giveCash: num(a.giveCash), getCash: num(a.getCash),
      giveProps: cleanList(a.giveProps), getProps: cleanList(a.getProps),
      giveJail: num(a.giveJail), getJail: num(a.getJail),
    };
    if (this.trades.filter((x) => x.from === p.id).length >= 3) return 'En fazla 3 açık teklifin olabilir.';
    const e = this.validateTrade(t); if (e) return e;
    this.trades.push(t);
    this.addLog(`${p.name}, ${this.player(t.to).name} oyuncusuna takas teklif etti.`);
    return null;
  }
  tradeAccept(p, id) {
    const t = this.trades.find((x) => x.id === id);
    if (!t || t.to !== p.id) return 'Teklif bulunamadı.';
    const e = this.validateTrade(t);
    if (e) { this.trades = this.trades.filter((x) => x !== t); return e; }
    const from = this.player(t.from), to = p;
    from.cash += t.getCash - t.giveCash;
    to.cash += t.giveCash - t.getCash;
    t.giveProps.forEach((i) => { this.props[i].owner = to.id; });
    t.getProps.forEach((i) => { this.props[i].owner = from.id; });
    for (let k = 0; k < t.giveJail; k++) to.jailCards.push(from.jailCards.shift());
    for (let k = 0; k < t.getJail; k++) from.jailCards.push(to.jailCards.shift());
    this.trades = this.trades.filter((x) => x !== t);
    this.addLog(`${from.name} ile ${to.name} takası tamamlandı.`);
    return null;
  }
  tradeReject(p, id) {
    const t = this.trades.find((x) => x.id === id);
    if (!t || t.to !== p.id) return 'Teklif bulunamadı.';
    this.trades = this.trades.filter((x) => x !== t);
    this.addLog(`${p.name}, ${this.player(t.from).name} oyuncusunun takas teklifini reddetti.`);
    return null;
  }
  tradeCancel(p, id) {
    const t = this.trades.find((x) => x.id === id);
    if (!t || t.from !== p.id) return 'Teklif bulunamadı.';
    this.trades = this.trades.filter((x) => x !== t);
    return null;
  }

  // ---------- iflas ----------
  bankrupt(p, reason) {
    if (p.bankrupt) return 'Zaten iflas ettin.';
    let creditor = p.cash < 0 && p.debtTo ? this.player(p.debtTo) : null;
    if (creditor && creditor.bankrupt) creditor = null;
    for (const [i, pr] of Object.entries(this.props)) {
      if (pr.owner !== p.id) continue;
      if (pr.houses === 5) { this.hotelsLeft++; } else { this.housesLeft += pr.houses; }
      pr.houses = 0;
      if (creditor) { pr.owner = creditor.id; } else { pr.owner = null; pr.mortgaged = false; }
      void i;
    }
    for (const deck of p.jailCards) {
      if (creditor) creditor.jailCards.push(deck);
      else this.decks[deck].push((deck === 'chance' ? CHANCE : CHEST).findIndex((c) => c.jailFree));
    }
    p.jailCards = [];
    if (creditor && p.cash > 0) creditor.cash += p.cash;
    p.cash = 0; p.bankrupt = true; p.debtSince = null; p.debtTo = null; p.inJail = false;
    this.trades = this.trades.filter((t) => t.from !== p.id && t.to !== p.id);
    this.addLog(`${p.name} iflas etti${reason ? ` (${reason})` : ''}.${creditor ? ` Varlıkları ${creditor.name} oyuncusuna geçti.` : ' Mülkleri bankaya döndü.'}`);

    if (this.auction) {
      if (this.auction.bidder === p.id) { this.auction.bidder = null; this.auction.bid = 0; }
      if (!this.auction.passed.includes(p.id)) this.auction.passed.push(p.id);
    }
    if (this.checkWinner()) return null;
    if (this.isCurrent(p)) {
      if (this.auction) { this.auction = null; this.pendingBuy = null; }
      this.nextTurn();
    } else if (this.auction) {
      this.checkAuctionEnd();
    }
    return null;
  }

  // Süresi dolan/çevrimdışı borçlu için otomatik tasfiye
  autoResolve(p) {
    let guard = 100;
    while (p.cash < 0 && guard-- > 0) {
      const withHouses = Object.entries(this.props)
        .filter(([, pr]) => pr.owner === p.id && pr.houses > 0)
        .sort((a, b) => b[1].houses - a[1].houses);
      if (withHouses.length) { this.sell(p, +withHouses[0][0]); continue; }
      const mort = Object.entries(this.props).find(([i, pr]) => pr.owner === p.id && !pr.mortgaged &&
        !(SQUARES[i].type === 'prop' && this.groupHasBuildings(SQUARES[i].group)));
      if (mort) { this.mortgage(p, +mort[0]); continue; }
      break;
    }
    if (p.cash < 0) this.bankrupt(p, 'borcunu kapatamadı');
    else this.refreshDebts();
  }

  netWorth(p) {
    let w = p.cash;
    for (const [i, pr] of Object.entries(this.props)) {
      if (pr.owner !== p.id) continue;
      const s = SQUARES[i];
      w += pr.mortgaged ? s.mortgage : s.price;
      if (s.type === 'prop') w += pr.houses === 5 ? GROUPS[s.group].house * 4 + GROUPS[s.group].hotel : pr.houses * GROUPS[s.group].house;
    }
    return w;
  }
  endByLimit() {
    const act = this.active().map((p) => ({ p, w: this.netWorth(p) })).sort((a, b) => b.w - a.w);
    this.phase = 'gameover';
    this.auction = null;
    this.winner = act[0] ? act[0].p.id : null;
    this.addLog(`Tur sınırı (${this.roundLimit}) doldu! En zengin oyuncu kazanır.`);
    act.forEach((x, k) => this.addLog(`${k + 1}. ${x.p.name}: ${tl(x.w)} toplam servet`));
    this.addLog(`Oyun bitti! Kazanan: ${act[0] ? act[0].p.name : '—'}`);
  }
  forceEnd(reason) {
    const act = this.active().map((p) => ({ p, w: this.netWorth(p) })).sort((a, b) => b.w - a.w);
    this.phase = 'gameover'; this.auction = null;
    this.winner = act[0] ? act[0].p.id : null;
    this.addLog(`Oyun bitti (${reason}). Kazanan: ${act[0] ? act[0].p.name : '—'}`);
  }
  checkWinner() {
    if (this.phase === 'gameover') return true;
    const act = this.active();
    if (act.length <= 1) {
      this.phase = 'gameover';
      this.auction = null;
      this.winner = act[0] ? act[0].id : null;
      this.addLog(`Oyun bitti! Kazanan: ${act[0] ? act[0].name : '—'}`);
      return true;
    }
    return false;
  }

  // ---------- bağlantı & zamanlayıcı ----------
  setConnected(id, connected) {
    const p = this.player(id);
    if (!p) return;
    p.connected = connected;
    p.offlineSince = connected ? null : Date.now();
    if (!connected && this.auction && !this.auction.passed.includes(id) && this.auction.bidder !== id) {
      this.auction.passed.push(id);
      this.checkAuctionEnd();
    }
    if (this.isCurrent(p)) this.resetDeadline();
  }

  tick(now = Date.now()) {
    if (this.phase === 'gameover') return false;
    let changed = false;
    for (const p of this.active()) {
      if (!p.connected && p.offlineSince && now - p.offlineSince > TIMING.OFFLINE_KICK_MS) {
        this.bankrupt(p, 'bağlantı koptu'); changed = true;
        if (this.phase === 'gameover') return true;
      }
    }
    if (this.phase === 'auction' && this.auction && now >= this.auction.endsAt) {
      this.resolveAuction(); changed = true;
    }
    for (const p of this.active()) {
      if (p.cash < 0 && p.debtSince) {
        const lim = p.connected ? TIMING.DEBT_MS : TIMING.OFFLINE_DEBT_MS;
        if (now - p.debtSince > lim) { this.addLog(`${p.name} için borç süresi doldu, otomatik tasfiye.`); this.autoResolve(p); changed = true; }
      }
    }
    if (this.phase === 'gameover') return true;
    const cur = this.current();
    if (this.phase !== 'auction' && cur.cash >= 0 && now >= this.deadline) {
      changed = true;
      this.addLog(`${cur.name} için süre doldu.`);
      if (this.phase === 'roll') this.act(cur.id, { type: 'roll' });
      else if (this.phase === 'buy') this.act(cur.id, { type: 'decline' });
      else if (this.phase === 'end') this.act(cur.id, { type: 'endTurn' });
      this.resetDeadline();
    }
    if (changed) this.checkWinner();
    return changed;
  }

  toJSON() {
    return {
      players: this.players.map(({ debtSince, offlineSince, tradeMemory, nextAt, lastTradeTurn, ...rest }) => ({ ...rest, inDebt: !!debtSince, debtSince })),
      props: this.props,
      turn: this.current().id,
      phase: this.phase,
      dice: this.dice,
      rollId: this.rollId,
      moves: this.moves,
      pot: this.pot,
      potWins: this.potWins,
      rollLogSeq: this.rollLogSeq || 0,
      pendingBuy: this.pendingBuy,
      auction: this.auction,
      trades: this.trades,
      log: this.log.slice(-80),
      card: this.card,
      winner: this.winner,
      housesLeft: this.housesLeft,
      hotelsLeft: this.hotelsLeft,
      buildLimit: BUILD_LIMIT,
      deadline: this.deadline,
      extraRoll: this.extraRoll,
      timing: TIMING,
      round: Math.floor(this.turnCount / this.players.length) + 1,
      roundLimit: this.roundLimit,
      worth: Object.fromEntries(this.players.map((p) => [p.id, p.bankrupt ? 0 : this.netWorth(p)])),
    };
  }
}

module.exports = { Game, TIMING };
