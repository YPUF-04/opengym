# Gearly: kurulum ve kullanım

Gearly, açık kaynak [openGym](https://github.com/DuarteSantos8/openGym) üzerine kurulu kişisel
spor ve günlük takip uygulaması. Bu fork'ta (YPUF-04/opengym) eklenenler:

- **Günlük ekranı** (Ana sayfadaki "Günlük" kartı): rutin görev listesi (gün ve saat dilimi seçimi),
  günlük seri ve 5 haftalık takvim, beslenme (hazır yiyecek listesi ile kalori ve protein),
  adım, su, uyku, boy/BMI, hedef kilo ilerlemesi, kalori ihtiyacı hesabı (Mifflin-St Jeor) ve
  ekipmanına göre bugün için egzersiz önerileri.
- Uygulamanın adı **Gearly**.

openGym'den gelenler zaten hazır: her egzersizde son kaldırdığın kilo, tahmini maksimum (1RM),
rekorlar (PR), otomatik kilo artırma, haftalık plan, istatistikler, vücut ölçüleri, ilerleme
fotoğrafları, ekipman profilleri ve Türkçe arayüz.

## 1. En kolay yol: GitHub Pages (bilgisayar ya da sunucu gerekmez)

Uygulama senin GitHub hesabında ücretsiz yayınlanır: `https://ypuf-04.github.io/opengym/`

1. GitHub'da repoyu aç: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Actions** sekmesinde "Deploy Gearly to GitHub Pages" iş akışını etkinleştir (fork'larda
   Actions ilk seferde kapalı olabilir, "I understand... enable" butonuna bas).
3. Değişikliklerin `main` dalına gelmesi gerekiyor (pull request'i birleştir). Birleşince iş akışı
   kendiliğinden çalışır, birkaç dakika sonra adres açılır. Elle çalıştırmak için:
   Actions → Deploy Gearly to GitHub Pages → **Run workflow**.

### iPhone'a uygulama gibi yükleme

1. **Safari** ile `https://ypuf-04.github.io/opengym/` adresini aç (Chrome değil, Safari).
2. Alttaki **Paylaş** düğmesi → **Ana Ekrana Ekle** → Ekle.
3. Ana ekrandaki Gearly simgesinden aç: tam ekran, uygulama gibi çalışır, internetsiz de açılır.
4. Dili Türkçe yap: **Settings (çark) → Units & language → Language → Türkçe** (Türkçede: Ayarlar → Birimler ve dil → Dil).

Bilgisayarda da aynı adresi Chrome/Edge/Safari ile açabilirsin.

### Önemli: verilerin

Bu sürümde veriler **sadece o cihazın tarayıcısında** durur. Telefon ve bilgisayar birbirini
görmez. Verini kaybetmemek için ara sıra **Ayarlar → Veriler ve yedek** bölümünden
yedek al (dosyayı iCloud Drive'a kaydet). Yeni cihazda aynı yerden **içe aktar** ile geri
yüklersin. iPhone, uzun süre açılmayan web uygulamalarının verisini silebilir; ana ekrana eklemek
bu riski azaltır ama yedek yine de şart.

## 2. Telefon ve bilgisayar senkron olsun: kendi sunucun (Docker)

Bilgisayarında ya da bir VPS'te (aylık birkaç dolar) çalışır, her cihaz aynı veriyi görür.
Kardeşin ve arkadaşların için ayrı hesap açabilirsin (ilerideki lig ve yarışmalar için de bu
gerekecek).

```bash
git clone https://github.com/YPUF-04/opengym.git gearly
cd gearly
cp .env.example .env        # RP_ID ve ORIGIN'i kendi adresine göre düzenle
docker compose up -d --build
```

Giriş için passkey (Face ID) kullanılır ve bu **HTTPS** ister. Evde en kolayı Tailscale:
ayrıntılar [SELF_HOSTING.md](SELF_HOSTING.md), [SELF_HOSTING_HTTPS.md](SELF_HOSTING_HTTPS.md) ve
Mac için [SELF_HOSTING_MAC.md](SELF_HOSTING_MAC.md) dosyalarında. Sonra iPhone'da Safari ile
sunucu adresini açıp yine **Ana Ekrana Ekle**.

## 3. App Store / Play Store

- **App Store'daki "openGym"** uygulaması orijinal geliştiricinin sürümüdür, buradaki Gearly
  değişikliklerini içermez.
- Gearly'yi kendi iPhone'una **gerçek uygulama** olarak kurmak için bir Mac, Xcode ve Apple
  geliştirici hesabı gerekir (ücretsiz hesapla uygulama 7 günde bir yeniden yüklenmeli; yıllık
  99 $ hesapla TestFlight ile rahat kurulur). Adımlar: [MOBILE.md](MOBILE.md).
- **Android**: `npm run build:mobile` ve Android Studio ile APK üretilebilir, Play Store için
  Google geliştirici hesabı (tek seferlik 25 $) gerekir.
- **Lisans uyarısı**: egzersiz görselleri/animasyonları Gym visual'dan openGym için
  lisanslıdır (NOTICE.md). Kendin için kullanmak sorun değil, ama Gearly adıyla mağazada
  **herkese açık** yayınlamak istersen bu görseller için ayrıca lisans alman gerekir. Kod
  AGPL olduğu için kaynak kodunu da açık tutman gerekir.

## Sonraki aşama (planlanan)

- Lig sistemi, şınav yarışı, arkadaşlarla 1'e 1 kapışma, 6 haneli kodla özel yarışmalar,
  rozetler (çok kullanıcılı sunucu, yani 2. yol gerekiyor)
- Rutin hatırlatma bildirimi
- AI koç ile antrenman ve yemek programı (sunucu ve bir AI API anahtarı gerekiyor,
  bkz. [AI_COACH.md](AI_COACH.md))
