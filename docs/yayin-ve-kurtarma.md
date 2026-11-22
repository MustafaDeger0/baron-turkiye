# Güvenilir maçlar ve hesap ayarları

## Render'a geçiş

Bu sürüm PostgreSQL'de mevcut hesapları silmeden `game_world`, `chip_ledger` tablolarını ve hesap güvenliği alanlarını açar. İlk yüklemeden önce mevcut veritabanının yedeğini alın. Eski sürümün yalnızca bellekte tuttuğu maçlar bu sürüme taşınamaz; ilk dağıtımı aktif maç yokken yapın. Sonraki dağıtımlarda kayıtlı maçlar geri yüklenir.

Render ortam değişkenleri:

- `DATABASE_URL`: kalıcı PostgreSQL bağlantısı. Render'ın geçici diskinde JSON dosyası kullanmak dağıtım sonrasında veri korumaz.
- `SESSION_SECRET`: mevcut değeri koruyun; değiştirmek oturumları geçersiz kılar.
- `ADMIN_USER_IDS`: yalnızca daha önce oluşturulmuş yönetici hesaplarının sayısal kimlikleri; virgülle ayrılır. Kendi hesabınızla `/api/me` yanıtındaki `user.id` değerini kullanın. Eski `ADMIN_USERS` e-posta/ad listesi artık yetki vermez. Bu kimlikler açılışta veritabanındaki kalıcı `is_admin` rolüne işlenir. Rolü kaldırmak için veritabanında ilgili hesabın `is_admin` alanını `false` yapın ve kimliği ortam listesinden çıkarın.
- `PUBLIC_URL=https://baron-turkiye.onrender.com`
- `RESEND_API_KEY`: Resend API anahtarı; GitHub'a veya istemciye yazmayın.
- `MAIL_FROM`: Resend'de doğruladığınız alan adındaki gönderici, örneğin `Baron Türkiye <destek@alanadiniz.com>`.
- `TRUST_PROXY_HOPS`: yalnızca güvenilen ters vekil sayısı biliniyorsa ayarlayın. Render'ın ağ yolunu doğruladıktan sonra uygun değeri girin. Varsayılan olarak istemcinin gönderdiği `X-Forwarded-For` güvenilmez.

Resend ayarları girilmeden şifre kurtarma formu hizmetin henüz açık olmadığını bildirir. Kullanıcıya gönderilen adres yalnızca `PUBLIC_URL` üzerinden üretilir; istek başlıklarından alınmaz. Sağlayıcı dokümanı: https://resend.com/docs/api-reference/emails/send-email

Node.js 22 veya üzeri gerekir. `render.yaml` Node 22'yi seçer. Bu sürüm tek etkin oyun sunucusu içindir; yatay ölçeklendirme veya çoklu worker kullanmayın. PostgreSQL kayıt sürümü kontrolü, dağıtım sırasında eski sunucunun yeni kaydın üzerine yazmasını engeller; eski süreç sağlık kontrolünde başarısız olur ve istemciler yeniden bağlanır. Birden fazla etkin sunucu için ortak oda yönlendirmesi ayrıca gerekir.

## Maç kaydı ve çipler

Her oda işlemi ve zamanlayıcı tek sıradan geçer. Başarılı yanıt ve oyun durumu, kayıt tamamlandıktan sonra gönderilir. Giriş ücretleri, ödül/istatistik değişiklikleri ve maç durumu aynı veritabanı işlemi içinde yazılır. Her ücret/sonuç/iade benzersiz işlem anahtarıyla deftere girer; tekrar deneme ikinci kez çip veya galibiyet vermez. JSON geliştirme deposunda dosya önce geçici dosyaya yazılır, diske aktarılır ve yeniden adlandırılır.

Kayda tahta, oyuncular, deste sırası, teklifler, sıra, süreler ve sonuç dahildir. Soket bağlantıları yeniden kurulmalıdır. Sohbet mesajları kalıcı maç kaydına alınmaz; şikayetler ayrı tutulmaya devam eder.

Yeniden açılışta oyunculara dönmeleri için üç dakika verilir. İnternet kesintisi olan oyuncular için mevcut oyun kuralları devam eder. Sıradaki oyuncunun geri dönmesi karar süresini yeniden başlatır. Veri deposu çalışmıyorsa hamle başarılı sayılmaz; bellekteki hamle geri alınır.

## Hesap güvenliği

Şifre değiştirme mevcut şifreyi ister ve tüm oturumları kapatır. Çıkış yapma da sunucudaki oturum anahtarını değiştirir; diğer cihazlar tekrar giriş yapar. Şifre sıfırlama bağlantısı 30 dakika geçerli ve tek kullanımlıktır; veritabanında yalnızca özeti saklanır. Bağlantıdaki anahtar URL parçasında taşınır ve form açılırken adres çubuğundan temizlenir.

## Grafikler

Profil ayarlarından veya oyun içi Grafik düğmesinden Otomatik, Düşük, Orta, Yüksek ve 2D seçilebilir. Otomatik mod dar ekranlarda düşük kaliteyi seçer. Düşük kalitede gölgeler kapalı, doku 2048 piksel ve çizim 30 kare/saniye ile sınırlıdır. Orta 45, yüksek 60 kare/saniye hedefler; bunlar garanti edilen performans ölçümleri değildir. Sekme arka plandayken animasyon çizimi durur.

WebGL açılamaz veya bağlam kaybolursa aynı maç 2D tahtayla sürer. Tapu, satın alma, açık artırma, bina, takas ve sohbet aynı sunucu kurallarını kullanır. 2D kareler klavyeyle de açılır.

## Özel odalarda sesli sohbet

Sesli sohbet yalnızca özel insan oyuncu odalarında, oyuncu düğmeye basıp mikrofon izni verdiğinde açılır. Lobi ve oyun arasında bağlantı korunur. Mikrofon kapatma, ayrılma, oda değişimi, sekme değiştirerek aynı koltuğu devralma ve internet kesilmesinde bağlantı temizliği bulunur. Ses kaydı tutulmaz; Socket.IO yalnızca aynı özel odada sese katılmış oyuncular arasında WebRTC bağlantı bilgilerini iletir.

Varsayılan bağlantı STUN kullanır. Bazı mobil, kurumsal veya kısıtlı ağlarda doğrudan bağlantı engellenir; bunlar için bir TURN hizmeti gerekir. Render yalnızca sinyalleşme sunucusudur; ses aktarma sunucusu değildir. Kendi TURN sağlayıcınızın bilgilerini Render'daki `VOICE_ICE_SERVERS` değişkenine bir JSON dizisi olarak ekleyebilirsiniz:

```json
[{"urls":"stun:stun.l.google.com:19302"},{"urls":["turn:turn.example.com:3478","turns:turn.example.com:5349"],"username":"TURN_KULLANICI_ADI","credential":"TURN_PAROLASI"}]
```

Bu örneği gerçek hizmet bilgileriyle değiştirin; örnekteki alan adı çalışır bir servis değildir. TURN bilgilerini GitHub'a yazmayın. Bu bilgiler sesli sohbete katılan doğrulanmış oda üyelerine iletilir; sınırlı yetkili ve tercihen kısa ömürlü TURN kimlik bilgileri kullanın. Testler gerçek mikrofon yerine Chromium'un sahte ses aygıtını ve yalnızca yerel ICE adaylarını kullanır.

## Test komutları

```
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

Yerel Chrome ile: PowerShell'de `$env:PLAYWRIGHT_CHANNEL='chrome'` atayıp tarayıcı testini çalıştırın.

`npm test` canlı `DATABASE_URL`'i temizleyerek geçici test verileri kullanır. PostgreSQL testleri için sadece ayrı bir test veritabanını `PG_TEST_URL` olarak verin. Test bu veritabanında şema ve test kayıtları yazar; üretim adresini vermeyin.

GitHub Actions Linux ve Windows üzerinde Node 22/24 oyun testlerini, ayrı PostgreSQL servisinde veri bütünlüğünü, Chromium'da telefon ve masaüstü akışlarını çalıştırır. Tarayıcı hatalarında ekran görüntüleri ve izler Actions çıktısına eklenir.
