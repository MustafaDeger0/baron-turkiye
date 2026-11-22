# Baron Türkiye — Google Play yüklemesi

## Paket ve indirme

- Uygulama kimliği: `com.baronturkiye.oyun` (ilk yüklemeden sonra değişmez).
- Android hedefi: API 36. Uygulama TWA ile canlı oyunu açar; web güncellemeleri ayrıca mağaza paketi gerektirmez.
- GitHub → Actions → **Android paketi (Play Store)** → başarılı çalışma → **Artifacts** bölümündeki ZIP dosyasını indir.
- ZIP içindeki `app-release.aab` Play Console'a yüklenir. `app-release.apk` gerçek telefonda denemek içindir.
- İmzalama anahtarı GitHub Secrets içindeki mevcut `KEYSTORE_BASE64` ve `KEYSTORE_PASSWORD` ile korunur. Yeni anahtar üretmeyin; anahtar ve parolasını güvenli yerde yedekleyin.
- Android dosyaları veya paket iş akışı main dalında değişince yeni paket otomatik üretilir. Elle üretmek için aynı iş akışında **Run workflow** kullanın. Her üretimde artan sürüm kodu kullanılır.

## Play Console'da ilk uygulama

1. **Tüm uygulamalar → Uygulama oluştur**. Ad: **Baron Türkiye**, varsayılan dil: Türkçe, tür: Oyun. Ücretli satış/uygulama içi ödeme şu anda yok; mevcut oyun ücretsizdir.
2. Mağaza adı, kısa açıklama ve tam açıklama için aşağıdaki metinleri kullanın. İkon ve tanıtım görseli `magaza-gorselleri/` klasöründe. Ekran görüntülerini güncel sürümden gerçek Android cihazla yenileyin.
3. Gizlilik politikası: https://baron-turkiye.onrender.com/gizlilik.html
4. Hesap silme bağlantısı: https://baron-turkiye.onrender.com/hesap-sil.html
5. **Test edin ve yayınlayın → Dahili test** bölümünden bir sürüm oluşturup AAB dosyasını yükleyin. Test kullanıcıları ekleyip gerçek telefonda oyunu deneyin.
6. **Uygulama bütünlüğü / Uygulama imzalama** bölümündeki **uygulama imzalama anahtarı SHA-256** değerini Render'daki `ANDROID_SHA256` ortam değişkenine ekleyin. Birden fazla değer virgülle ayrılabilir. Bu, yükleme anahtarından farklı olabilir. Siteyi yeniden yayınladıktan sonra `/.well-known/assetlinks.json` bu değeri göstermelidir.
7. İçerik derecelendirmesi, hedef kitle, veri güvenliği ve uygulama erişimi formlarını gerçek oyun özelliklerine göre doldurun. Oyunda hesap, yazılı sohbet, kullanıcı bildirme ve özel odada isteğe bağlı sesli sohbet bulunduğunu bildirin. Sesli sohbetin yalnızca geçici olarak iletildiğini, kaydedilmediğini ve diğer oyunculara gittiğini dikkate alın. Formda ses verisi için geçici işleme sorularını da yanıtlayın; yalnızca kayıt tutulmamasına dayanarak “hiç ses işlenmiyor” seçmeyin.
8. İnceleme ekibinin giriş yapabilmesi için ayrı, yönetici olmayan bir test hesabı hazırlayıp **Uygulama erişimi** bölümüne ekleyin. Gerçek hesabınızın parolasını paylaşmayın.
9. Hesabınız için konsolun gösterdiği kapalı test ve üretime erişim adımlarını tamamlayın. Gerekli test süresi ve katılımcı sayısını konsoldaki güncel gerekliliklere göre uygulayın.

## Mağaza metinleri

### Ad
Baron Türkiye

### Kısa açıklama
İlleri satın al, ev ve otel kur. Arkadaşlarınla emlak yarışına katıl!

### Tam açıklama
Türkiye'nin illerini satın al, emlaklarını geliştir ve rakiplerine karşı stratejini kur. Baron Türkiye, arkadaşlarınla veya botlara karşı oynayabileceğin çevrimiçi bir emlak ticareti oyunudur.

• Arkadaşların için özel oda oluştur ve oda koduyla davet et.
• Hızlı eşleşme ile başka oyuncularla masaya otur.
• İlleri satın al, renk gruplarını tamamla, ev ve otel kur.
• Takas, açık artırma ve ipotek seçenekleriyle stratejini geliştir.
• Botlara karşı pratik yap.
• Özel odalarda isteğe bağlı sesli sohbete katıl; bas-konuş veya açık mikrofon seç.
• Günlük ödülleri topla ve sıralamada yüksel.

Oyun internet bağlantısı ve oyuncu hesabı gerektirir. Sesli sohbet isteğe bağlıdır; kullanmak için mikrofon izni gerekir. Oyun içi para ve çipler yalnızca oyun puanıdır; gerçek paraya çevrilemez.

## Gerçek cihaz kontrolü

- Play dahili test bağlantısından kurulabilme, açılışta adres çubuğunun görünmemesi.
- Dikey/yatay ekran, çentikli telefon ve Android geri hareketi.
- Kayıt/giriş, şifre kurtarma ve hesap silme.
- İki ayrı telefonda özel oda, sesli sohbete katılma, bas-konuşa basma/bırakma, dokunma iptali, açık mikrofon, susturma ve ayrılma.
- Uygulamayı arka plana alma/ekran kilidi sırasında bas-konuşun açık kalmaması.
- Wi-Fi ve mobil veri arasında ses bağlantısı. Bazı ağlar için TURN gerekir; `docs/yayin-ve-kurtarma.md` içindeki `VOICE_ICE_SERVERS` ayarına bakın.

## Resmî kaynaklar

- Hedef API: https://developer.android.com/google/play/requirements/target-sdk
- PWA ve Play: https://developers.google.com/codelabs/pwa-in-play
- İmzalama sertifikası ve web eşleştirmesi: https://developer.android.com/training/app-links/configure-assetlinks

Mağaza form ve beyanları hesap sahibinin gerçek uygulama ve şirket bilgilerine dayanmalıdır. Paket üretimi uygulamayı otomatik olarak mağazada yayınlamaz.
