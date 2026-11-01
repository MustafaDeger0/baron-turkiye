<div align="center">

# 🎩 Baron Türkiye

**Türkiye'nin illerini kap, ev ve otel dik, rakiplerini iflas ettir. Baron sen ol!**

Tarayıcıdan oynanan, çevrimiçi ve çok oyunculu emlak ticareti oyunu

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)
![Oyuncu](https://img.shields.io/badge/oyuncu-2--6-d7263d)
![Lisans](https://img.shields.io/badge/lisans-MIT-blue)

</div>

---

## ✨ Özellikler

| | |
|---|---|
| 🏠 **Oda kur** | Özel (kod / davet linki) veya herkese açık oda · 2–6 oyuncu · başlangıç parası seçimi |
| 🔑 **Kodla katıl** | 5 haneli kodla ya da ana sayfadaki açık odalar listesinden |
| ⚡ **Hızlı eşleş** | Rastgele oyuncularla eşleş; 2 kişi olunca 25 sn sonra otomatik başlar |
| 🗺️ **Türkiye tahtası** | Sinop'tan İstanbul'a 22 il, 4 ulaşım noktası (gar, liman, havalimanı) |
| 💵 **Baron Doları (฿)** | Dolar işareti gibi çizgili B; B1.000'den B1 milyona banknotlar. İstanbul B400.000, başlangıç parası B1.500.000 |
| 🎲 **Tam kurallar** | Satın alma, açık artırma, ev/otel, ipotek, takas, hapis, Şans & Kamu Fonu kartları, iflas |
| ✨ **Animasyonlar** | 3D zar, zıplayan piyonlar, uçan banknotlar, desteden çekilen kartlar, "SATIN ALDI" duyurusu, hapis parmaklıkları, konfeti |
| 🗺️ **3D Türkiye haritası** | Tahtanın ortasında kabartmalı harita; satın alınan iller sahibinin rengiyle işaretlenir |
| 🎨 **İl çizimleri** | Her il karesinde o ile özgü bir çizim (Malatya kayısısı, Rize çayı, Çanakkale truva atı…) |
| 👤 **Hesaplar & çip** | Kayıt/giriş; kalıcı çip bakiyesi, oyun/galibiyet istatistiği, sıralama tablosu |
| 🎁 **Günlük ödül** | Her gün giriş ödülü (100 → 500 çip, 7 günlük seri) |
| 🤖 **Botlarla oyna** | 1–5 bota karşı ücretsiz oyun; kazanınca bot başına 25 çip. Çipsiz masalara lobide bot eklenebilir |
| 🏨 **Otel** | Tek tıkla otel: 4 ev + otel bedeli; tur sınırı (20/40/60) dolunca en zengin kazanır |
| ⛶ **Her ekrana sığar** | Masaüstü, tablet ve telefonda kaydırma olmadan; tek tıkla (veya **F** tuşuyla) tam ekran |
| 💬 **Sohbet** | Lobide ve oyun içinde canlı sohbet, olay kaydı |
| 🔄 **Yeniden bağlanma** | Sayfa yenilense ya da internet kopsa bile aynı koltuğa dönülür |
| ⏱️ **Süre sınırı** | Tur 60 sn, borç kapatma 90 sn; kimse oyunu kilitleyemez |
| 🛡️ **Hilesiz** | Tüm kurallar sunucuda uygulanır |
| 📱 **Mobil uyumlu** | Telefonda da oynanabilir |

## 🎮 Nasıl Oynanır?

1. Adını yaz, **Oda Kur**'a bas ve davet linkini arkadaşlarına gönder — ya da **Hızlı Eşleş** ile rastgele rakiplere katıl.
2. Sırası gelen zar atar; sahipsiz bir ile gelirsen satın al ya da açık artırmaya çıkar.
3. Bir renk grubunun tamamını topla, ev ve otel dikerek kiraları katla.
4. Paran biterse ev sat ya da ipotek et. Kapatamazsan iflas edersin.
5. Ayakta kalan son oyuncu **Baron** olur! 🏆

## 🚀 Kurulum

```bash
npm install
npm start
```

Ardından tarayıcıda **http://localhost:3000** adresini aç.

Testleri çalıştırmak için:

```bash
npm test
```

## 🎰 Çip Ekonomisi

- Yeni hesap **1.000 çip** ile başlar.
- **Hızlı eşleş**: giriş 100 çip. **Oda kur**: giriş ücreti 0 / 50 / 100 / 250 / 500 çip.
- Oyun başlarken herkesin giriş ücreti masaya konur; **kazanan masadaki tüm çipleri alır**.
- Yarım kalan (terk edilen) oyunlarda giriş ücretleri iade edilir.
- **Günlük ödül**: 100, 150, 200, 250, 300, 400, 500 çip (her gün gelirsen seri büyür, bir gün kaçırırsan başa döner).

## 🗄️ Veritabanı (hesapların kalıcı olması için önemli)

| Ortam değişkeni | Açıklama |
|---|---|
| `DATABASE_URL` | PostgreSQL bağlantı adresi. **Tanımlıysa hesaplar burada saklanır.** |
| `SESSION_SECRET` | Oturum anahtarlarını imzalayan gizli metin (uzun, rastgele). |

`DATABASE_URL` yoksa hesaplar `data/db.json` dosyasına yazılır. Bu, kendi bilgisayarında veya diski kalıcı bir sunucuda yeterlidir.
**Render gibi ücretsiz barındırmalarda disk kalıcı değildir**; sunucu yeniden başlarsa dosya silinir. Bu yüzden ücretsiz bir PostgreSQL
(ör. Neon, Supabase veya Render PostgreSQL) oluşturup bağlantı adresini `DATABASE_URL` olarak gir. Tablolar ilk açılışta otomatik oluşturulur.

## 🌍 Yayına Alma

> ⚠️ Oyun gerçek zamanlı WebSocket kullanır; **sürekli çalışan bir Node sunucusu** gerekir.
> Vercel / Netlify gibi yalnızca serverless platformlar uygun değildir.

### Render (ücretsiz, önerilen)

1. [render.com](https://render.com)'a GitHub hesabınla giriş yap.
2. **New → Blueprint** seç ve bu depoyu seç.
3. **Apply**'a bas. `SESSION_SECRET` otomatik üretilir; `DATABASE_URL` sorulduğunda PostgreSQL adresini yapıştır.
4. Birkaç dakika sonra oyunun linki hazır!

> 💤 Ücretsiz planda sunucu 15 dk boşta kalınca uyur; ilk açılış ~30 sn sürebilir.

### Docker

```bash
docker build -t baron-turkiye .
docker run -p 3000:3000 baron-turkiye
```

Railway, Fly.io veya kendi sunucunda da çalışır; `PORT` ortam değişkeni otomatik okunur.

## 📁 Proje Yapısı

```
baron-turkiye/
├── server/
│   ├── index.js    # HTTP + Socket.IO, hesap API'si, odalar, çip ekonomisi
│   ├── db.js       # Hesap deposu (PostgreSQL veya JSON dosyası)
│   ├── auth.js     # Şifre karma, oturum anahtarları
│   ├── bots.js     # Bot yapay zekâsı
│   ├── game.js     # Oyun motoru: kurallar ve zamanlayıcılar
│   └── board.js    # Kareler, fiyat/kira tabloları, kartlar
├── public/         # Arayüz (HTML / CSS / JS)
├── test/           # Simülasyon ve uçtan uca testler
├── Dockerfile
└── render.yaml
```

## 📝 Notlar

- Odalar sunucu belleğinde tutulur; sunucu yeniden başlarsa süren oyunlar silinir.
- Süreleri `server/game.js` içindeki `TIMING` ile, tahta ve kartları `server/board.js` üzerinden değiştirebilirsin.

---

<div align="center">
<sub>Bu proje Hasbro'nun Monopoly markasıyla ilişkili değildir; klasik emlak ticareti oyun mekaniklerini kullanan bağımsız bir yapımdır.</sub>
</div>
