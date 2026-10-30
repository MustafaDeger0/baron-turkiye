// Tahta tanımı: 40 kare, renk grupları, kartlar.
// Fiyat ve kira tabloları klasik emlak oyunu değerleridir; isimler İstanbul semtleridir.

const GROUPS = {
  kahve:   { name: 'Kahverengi', color: '#8B4513', house: 50 },
  acikmavi:{ name: 'Açık Mavi',  color: '#7EC8E3', house: 50 },
  pembe:   { name: 'Pembe',      color: '#D93A96', house: 100 },
  turuncu: { name: 'Turuncu',    color: '#F7941D', house: 100 },
  kirmizi: { name: 'Kırmızı',    color: '#E2231A', house: 150 },
  sari:    { name: 'Sarı',       color: '#F2D600', house: 150 },
  yesil:   { name: 'Yeşil',      color: '#1FA055', house: 200 },
  lacivert:{ name: 'Lacivert',   color: '#0B4EA2', house: 200 },
};

const P = (name, group, price, rent) => ({ type: 'prop', name, group, price, rent });
const S = (name) => ({ type: 'station', name, price: 200 });
const U = (name, icon) => ({ type: 'utility', name, price: 150, icon });

const SQUARES = [
  { type: 'go', name: 'BAŞLANGIÇ' },
  P('Kasımpaşa', 'kahve', 60, [2, 10, 30, 90, 160, 250]),
  { type: 'chest', name: 'Kamu Fonu' },
  P('Dolapdere', 'kahve', 60, [4, 20, 60, 180, 320, 450]),
  { type: 'tax', name: 'Gelir Vergisi', amount: 200 },
  S('Haydarpaşa Garı'),
  P('Sultanahmet', 'acikmavi', 100, [6, 30, 90, 270, 400, 550]),
  { type: 'chance', name: 'Şans' },
  P('Karaköy', 'acikmavi', 100, [6, 30, 90, 270, 400, 550]),
  P('Eminönü', 'acikmavi', 120, [8, 40, 100, 300, 450, 600]),
  { type: 'jail', name: 'Hapis / Ziyaret' },
  P('Beyoğlu', 'pembe', 140, [10, 50, 150, 450, 625, 750]),
  U('Elektrik İdaresi', '💡'),
  P('Cihangir', 'pembe', 140, [10, 50, 150, 450, 625, 750]),
  P('Harbiye', 'pembe', 160, [12, 60, 180, 500, 700, 900]),
  S('Sirkeci Garı'),
  P('Üsküdar', 'turuncu', 180, [14, 70, 200, 550, 750, 950]),
  { type: 'chest', name: 'Kamu Fonu' },
  P('Kadıköy', 'turuncu', 180, [14, 70, 200, 550, 750, 950]),
  P('Moda', 'turuncu', 200, [16, 80, 220, 600, 800, 1000]),
  { type: 'parking', name: 'Ücretsiz Otopark' },
  P('Erenköy', 'kirmizi', 220, [18, 90, 250, 700, 875, 1050]),
  { type: 'chance', name: 'Şans' },
  P('Göztepe', 'kirmizi', 220, [18, 90, 250, 700, 875, 1050]),
  P('Caddebostan', 'kirmizi', 240, [20, 100, 300, 750, 925, 1100]),
  S('Beşiktaş İskelesi'),
  P('Şişli', 'sari', 260, [22, 110, 330, 800, 975, 1150]),
  P('Nişantaşı', 'sari', 260, [22, 110, 330, 800, 975, 1150]),
  U('Su İdaresi', '💧'),
  P('Maçka', 'sari', 280, [24, 120, 360, 850, 1025, 1200]),
  { type: 'gotojail', name: 'Hapse Gir' },
  P('Levent', 'yesil', 300, [26, 130, 390, 900, 1100, 1275]),
  P('Maslak', 'yesil', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: 'chest', name: 'Kamu Fonu' },
  P('Etiler', 'yesil', 320, [28, 150, 450, 1000, 1200, 1400]),
  S('Havalimanı'),
  { type: 'chance', name: 'Şans' },
  P('Bebek', 'lacivert', 350, [35, 175, 500, 1100, 1300, 1500]),
  { type: 'tax', name: 'Lüks Vergisi', amount: 100 },
  P('Yeniköy', 'lacivert', 400, [50, 200, 600, 1400, 1700, 2000]),
];

SQUARES.forEach((s, i) => { s.index = i; if (s.price) s.mortgage = s.price / 2; });

const GROUP_MEMBERS = {};
SQUARES.forEach((s) => { if (s.type === 'prop') (GROUP_MEMBERS[s.group] ||= []).push(s.index); });

// Kart efektleri
// move: hedef kare | moveRel: adım | nearest: 'station'|'utility' | money: +/- | jail | jailFree
// repairs: [ev, otel] | eachPlayer: +/- (her oyuncudan alır / her oyuncuya öder)
const CHANCE = [
  { text: 'BAŞLANGIÇ noktasına ilerle ve ₺200 al.', move: 0 },
  { text: 'Caddebostan\'da sahil yürüyüşü! Caddebostan\'a ilerle.', move: 24 },
  { text: 'Beyoğlu\'nda konser var. Beyoğlu\'na ilerle.', move: 11 },
  { text: 'Yeniköy\'de bir yalı gezisine davetlisin. Yeniköy\'e ilerle.', move: 39 },
  { text: 'Haydarpaşa Garı\'ndan trene bin. Haydarpaşa Garı\'na ilerle.', move: 5 },
  { text: 'En yakın istasyona ilerle. Sahibi varsa iki kat kira öde.', nearest: 'station' },
  { text: 'En yakın istasyona ilerle. Sahibi varsa iki kat kira öde.', nearest: 'station' },
  { text: 'En yakın idareye ilerle. Sahibi varsa zar toplamının 10 katını öde.', nearest: 'utility' },
  { text: 'Bankadaki mevduatın faiz getirdi. ₺50 al.', money: 50 },
  { text: 'Hapisten Çıkış Kartı. Saklayabilir veya takas edebilirsin.', jailFree: true },
  { text: 'Yanlış vapura bindin! 3 kare geri git.', moveRel: -3 },
  { text: 'Doğruca hapse gir. BAŞLANGIÇ\'tan geçme, ₺200 alma.', jail: true },
  { text: 'Binalarına bakım yaptır: ev başına ₺25, otel başına ₺100 öde.', repairs: [25, 100] },
  { text: 'Köprüde hız sınırını aştın. ₺15 ceza öde.', money: -15 },
  { text: 'Mahalle muhtarı seçildin! Her oyuncuya ₺50 ikram et.', eachPlayer: -50 },
  { text: 'Konut kredin erken kapandı, bankadan ₺150 iade al.', money: 150 },
];

const CHEST = [
  { text: 'BAŞLANGIÇ noktasına ilerle ve ₺200 al.', move: 0 },
  { text: 'Banka hatası senin lehine. ₺200 al.', money: 200 },
  { text: 'Diş hekimi faturası geldi. ₺50 öde.', money: -50 },
  { text: 'Hisse senetlerini sattın. ₺50 al.', money: 50 },
  { text: 'Hapisten Çıkış Kartı. Saklayabilir veya takas edebilirsin.', jailFree: true },
  { text: 'Doğruca hapse gir. BAŞLANGIÇ\'tan geçme, ₺200 alma.', jail: true },
  { text: 'Bayram ikramiyesi! ₺100 al.', money: 100 },
  { text: 'Vergi iaden yattı. ₺20 al.', money: 20 },
  { text: 'Bugün doğum günün! Her oyuncudan ₺10 al.', eachPlayer: 10 },
  { text: 'Hayat sigortan vadesini doldurdu. ₺100 al.', money: 100 },
  { text: 'Hastane masrafı. ₺100 öde.', money: -100 },
  { text: 'Kurs ücreti. ₺50 öde.', money: -50 },
  { text: 'Danışmanlık ücreti aldın. ₺25 al.', money: 25 },
  { text: 'Sokak onarımına katkı: ev başına ₺40, otel başına ₺115 öde.', repairs: [40, 115] },
  { text: 'Simit yarışmasında ikinci oldun! ₺10 al.', money: 10 },
  { text: 'Uzak bir akrabandan miras kaldı. ₺100 al.', money: 100 },
];

module.exports = { SQUARES, GROUPS, GROUP_MEMBERS, CHANCE, CHEST };
