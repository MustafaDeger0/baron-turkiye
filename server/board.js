// Tahta tanımı: 40 kare, renk grupları, kartlar.
// Fiyat ve kira tabloları klasik emlak oyunu değerleridir; kareler Türkiye illeridir. Para birimi: Baron Doları (B).

// Gerçekçi tutarlar: klasik tablo değerleri × K (örn. İstanbul B400.000)
const K = 1000;

const GROUPS = {
  // her bölgenin ev fiyatı farklı; otel = 4 ev üstüne ayrıca otel bedeli (ev × 2)
  kahve:   { name: 'Kahverengi', color: '#8B5A2B', house: 40 * K,  hotel: 80 * K },
  acikmavi:{ name: 'Açık Mavi',  color: '#3FB8E8', house: 60 * K,  hotel: 120 * K },
  pembe:   { name: 'Pembe',      color: '#E3338C', house: 90 * K,  hotel: 180 * K },
  turuncu: { name: 'Turuncu',    color: '#FF8A1F', house: 110 * K, hotel: 220 * K },
  kirmizi: { name: 'Kırmızı',    color: '#E53935', house: 140 * K, hotel: 280 * K },
  sari:    { name: 'Sarı',       color: '#F7CF1D', house: 160 * K, hotel: 320 * K },
  yesil:   { name: 'Yeşil',      color: '#24A148', house: 190 * K, hotel: 380 * K },
  lacivert:{ name: 'Lacivert',   color: '#1E4FD8', house: 230 * K, hotel: 460 * K },
};

const P = (name, group, price, rent) => ({ type: 'prop', name, group, price: price * K, rent: rent.map((r) => r * K) });
const S = (name) => ({ type: 'station', name, price: 200 * K });
const U = (name, icon) => ({ type: 'utility', name, price: 150 * K, icon });

const SQUARES = [
  { type: 'go', name: 'BAŞLANGIÇ' },
  P('Sinop', 'kahve', 60, [2, 10, 30, 90, 160, 250]),
  { type: 'chest', name: 'Kamu Fonu' },
  P('Kastamonu', 'kahve', 60, [4, 20, 60, 180, 320, 450]),
  { type: 'tax', name: 'Gelir Vergisi', amount: 200 * K, icon: 'coins' },
  S('Haydarpaşa Garı'),
  P('Amasya', 'acikmavi', 100, [6, 30, 90, 270, 400, 550]),
  { type: 'chance', name: 'Şans' },
  P('Tokat', 'acikmavi', 100, [6, 30, 90, 270, 400, 550]),
  P('Çorum', 'acikmavi', 120, [8, 40, 100, 300, 450, 600]),
  { type: 'jail', name: 'Hapis / Ziyaret' },
  P('Malatya', 'pembe', 140, [10, 50, 150, 450, 625, 750]),
  U('Elektrik İdaresi', 'bulb'),
  P('Elazığ', 'pembe', 140, [10, 50, 150, 450, 625, 750]),
  P('Diyarbakır', 'pembe', 160, [12, 60, 180, 500, 700, 900]),
  S('Ankara Garı'),
  P('Hatay', 'turuncu', 180, [14, 70, 200, 550, 750, 950]),
  { type: 'chest', name: 'Kamu Fonu' },
  P('Adana', 'turuncu', 180, [14, 70, 200, 550, 750, 950]),
  P('Mersin', 'turuncu', 200, [16, 80, 220, 600, 800, 1000]),
  { type: 'parking', name: 'Ücretsiz Otopark' },
  P('Rize', 'kirmizi', 220, [18, 90, 250, 700, 875, 1050]),
  { type: 'chance', name: 'Şans' },
  P('Trabzon', 'kirmizi', 220, [18, 90, 250, 700, 875, 1050]),
  P('Samsun', 'kirmizi', 240, [20, 100, 300, 750, 925, 1100]),
  S('Mersin Limanı'),
  P('Çanakkale', 'sari', 260, [22, 110, 330, 800, 975, 1150]),
  P('Balıkesir', 'sari', 260, [22, 110, 330, 800, 975, 1150]),
  U('Su İdaresi', 'drop'),
  P('Bursa', 'sari', 280, [24, 120, 360, 850, 1025, 1200]),
  { type: 'gotojail', name: 'Hapse Gir' },
  P('Muğla', 'yesil', 300, [26, 130, 390, 900, 1100, 1275]),
  P('Antalya', 'yesil', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: 'chest', name: 'Kamu Fonu' },
  P('İzmir', 'yesil', 320, [28, 150, 450, 1000, 1200, 1400]),
  S('İstanbul Havalimanı'),
  { type: 'chance', name: 'Şans' },
  P('Ankara', 'lacivert', 350, [35, 175, 500, 1100, 1300, 1500]),
  { type: 'tax', name: 'Lüks Vergisi', amount: 100 * K, icon: 'ring' },
  P('İstanbul', 'lacivert', 400, [50, 200, 600, 1400, 1700, 2000]),
];

SQUARES.forEach((s, i) => { s.index = i; if (s.price) s.mortgage = s.price / 2; });

const GROUP_MEMBERS = {};
SQUARES.forEach((s) => { if (s.type === 'prop') (GROUP_MEMBERS[s.group] ||= []).push(s.index); });

// Kart efektleri
// move: hedef kare | moveRel: adım | nearest: 'station'|'utility' | money: +/- | jail | jailFree
// repairs: [ev, otel] | eachPlayer: +/- (her oyuncudan alır / her oyuncuya öder)
const CHANCE = [
  { text: 'BAŞLANGIÇ noktasına ilerle ve B200 al.', move: 0 },
  { text: 'Samsun\'da 19 Mayıs coşkusu var! Samsun\'a ilerle.', move: 24 },
  { text: 'Kayısı hasadı başladı! Malatya\'ya ilerle.', move: 11 },
  { text: 'Boğaz turu kazandın! İstanbul\'a ilerle.', move: 39 },
  { text: 'Haydarpaşa Garı\'ndan trene bin. Haydarpaşa Garı\'na ilerle.', move: 5 },
  { text: 'En yakın istasyona ilerle. Sahibi varsa iki kat kira öde.', nearest: 'station' },
  { text: 'En yakın istasyona ilerle. Sahibi varsa iki kat kira öde.', nearest: 'station' },
  { text: 'En yakın idareye ilerle. Sahibi varsa zar toplamının 10 katını öde.', nearest: 'utility' },
  { text: 'Bankadaki mevduatın faiz getirdi. B50 al.', money: 50 },
  { text: 'Hapisten Çıkış Kartı. Saklayabilir veya takas edebilirsin.', jailFree: true },
  { text: 'Yanlış otobüse bindin! 3 kare geri git.', moveRel: -3 },
  { text: 'Doğruca hapse gir. BAŞLANGIÇ\'tan geçme, B200 alma.', jail: true },
  { text: 'Binalarına bakım yaptır: ev başına B25, otel başına B100 öde.', repairs: [25, 100] },
  { text: 'Otobanda hız sınırını aştın. B15 ceza öde.', money: -15 },
  { text: 'Mahalle muhtarı seçildin! Her oyuncuya B50 ikram et.', eachPlayer: -50 },
  { text: 'Konut kredin erken kapandı, bankadan B150 iade al.', money: 150 },
];

const CHEST = [
  { text: 'BAŞLANGIÇ noktasına ilerle ve B200 al.', move: 0 },
  { text: 'Banka hatası senin lehine. B200 al.', money: 200 },
  { text: 'Diş hekimi faturası geldi. B50 öde.', money: -50 },
  { text: 'Hisse senetlerini sattın. B50 al.', money: 50 },
  { text: 'Hapisten Çıkış Kartı. Saklayabilir veya takas edebilirsin.', jailFree: true },
  { text: 'Doğruca hapse gir. BAŞLANGIÇ\'tan geçme, B200 alma.', jail: true },
  { text: 'Bayram ikramiyesi! B100 al.', money: 100 },
  { text: 'Vergi iaden yattı. B20 al.', money: 20 },
  { text: 'Bugün doğum günün! Her oyuncudan B10 al.', eachPlayer: 10 },
  { text: 'Hayat sigortan vadesini doldurdu. B100 al.', money: 100 },
  { text: 'Hastane masrafı. B100 öde.', money: -100 },
  { text: 'Kurs ücreti. B50 öde.', money: -50 },
  { text: 'Danışmanlık ücreti aldın. B25 al.', money: 25 },
  { text: 'Sokak onarımına katkı: ev başına B40, otel başına B115 öde.', repairs: [40, 115] },
  { text: 'Simit yarışmasında ikinci oldun! B10 al.', money: 10 },
  { text: 'Uzak bir akrabandan miras kaldı. B100 al.', money: 100 },
];

// Kart tutarlarını ölçekle ve metinlerdeki tutarları biçimlendir
const fmt = (n) => `B${(n * K).toLocaleString('tr-TR')}`;
for (const c of [...CHANCE, ...CHEST]) {
  c.text = c.text.replace(/B(\d+)/g, (_, n) => fmt(+n));
  if (c.money) c.money *= K;
  if (c.eachPlayer) c.eachPlayer *= K;
  if (c.repairs) c.repairs = c.repairs.map((x) => x * K);
}

const BUILD_LIMIT = 3; // bir oyuncu kendi turu başına en fazla 3 bina dikebilir
module.exports = { SQUARES, GROUPS, GROUP_MEMBERS, CHANCE, CHEST, K, BUILD_LIMIT };
