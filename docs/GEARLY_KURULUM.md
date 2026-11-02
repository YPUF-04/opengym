# Gearly: kurulum ve kullanım

Gearly, açık kaynak [openGym](https://github.com/DuarteSantos8/openGym) üzerine kurulu kişisel
spor ve günlük takip uygulaması. Bu fork'ta (YPUF-04/opengym) eklenenler:

- **Günlük ekranı** (Ana sayfadaki "Günlük" kartı): rutin görev listesi (gün ve saat dilimi seçimi),
  günlük seri ve 5 haftalık takvim, beslenme (hazır yiyecek listesi ile kalori ve protein),
  adım, su, uyku, boy/BMI, hedef kilo ilerlemesi, kalori ihtiyacı hesabı (Mifflin-St Jeor) ve
  ekipmanına göre bugün için egzersiz önerileri.
- Uygulamanın adı **Gearly**, sakin mavi renkler ve yeni logo (Ayarlar → Look & Home'dan
  başka renk de seçilebilir).
- **Android APK**: GitHub her sürümde otomatik üretir, uygulama içinden güncelleme de gelir.
- Ana sayfada ve Ayarlar'da **"Gearly telefonunda"**: Android indirme ve iPhone'a yükleme adımları.

Adım adım, işaretlenebilir kurulum listesi de var (sohbette paylaşılan "Gearly Kurulum Listesi").

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

## Android'e yükleme

1. Android telefonda Chrome ile `https://github.com/YPUF-04/opengym/releases/latest` adresini aç
   (ya da Gearly web sürümünde ana sayfadaki **Android** düğmesine bas).
2. **Assets** altında `Gearly-<sürüm>.apk` dosyasını indir (`.sha256` olanı değil).
3. İndirileni aç; "bu kaynaktan izin verilmiyor" derse **Ayarlar → Bu kaynaktan izin ver**.
4. **Yükle**. Play Protect uyarırsa **Diğer ayrıntılar → Yine de yükle**.

APK, `.github/workflows/android-apk.yml` ile `main` dalına her değişiklikte yeniden yapılır. Yeni
bir sürüm numarası (`frontend/package.json` içindeki `version`) uygulamada güncelleme olarak
görünür.

**İmza anahtarı:** repo ayarlarında `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD` ve
`ANDROID_KEY_ALIAS` gizli değerleri (Settings → Secrets → Actions) yoksa her yapım geçici bir
anahtarla imzalanır; o zaman yeni sürüm eskinin üstüne kurulmaz (yedek al, sil, yeniden kur).
Kalıcı anahtar için bilgisayarda Java ile:

```bash
keytool -genkeypair -keystore gearly.keystore -alias gearly -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 gearly.keystore   # çıkan uzun metin ANDROID_KEYSTORE_B64 olur
```

Şifreyi `ANDROID_KEYSTORE_PASSWORD`'a, `gearly` kelimesini `ANDROID_KEY_ALIAS`'a koy. Anahtar
dosyasını ve şifreyi güvenli bir yerde sakla, kimseyle paylaşma; kaybedersen güncellemeler yine
eskinin üstüne kurulmaz.

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

**Hesap açma ve yarışmalar için önerilen `.env` ayarları:**

```bash
PASSWORD_LOGIN=1      # isim + şifre ile hesap açılabilsin (Face ID/passkey de kalır)
FIRST_USER_ADMIN=1    # ilk açılan hesap admin olur: adresi paylaşmadan önce ilk hesabı sen aç
INVITE_ONLY=1         # sadece davet kodu verdiklerin hesap açabilsin
ALLOW_GUEST=0         # hesapsız girişi kapat
```

Arkadaşların adresi açar, **Hesap oluştur** der, senin Admin dashboard'dan ürettiğin davet
kodunu, bir isim ve şifre girer. Sonra ana sayfadaki **Yarışmalar** kartından şınav, squat,
mekik, barfiks, plank, adım ya da antrenman sayısı yarışması başlatılır; 6 harfli kod
paylaşılır, herkes yaptığını girer, sıralama herkese aynı görünür.

**Admin olmak için:** `.env` içinde ilk kurulumda `FIRST_USER_ADMIN=1` aç ve adresi kimseyle
paylaşmadan önce ilk hesabı sen oluştur: ilk hesap otomatik admin olur. Sonradan eklemek için
Ayarlar → Hesap → **Account ID**'ni `.env` içinde `ADMIN_UIDS=<id>` olarak yaz ve
`docker compose up -d` çalıştır. Admin olunca Ayarlar → Hesap → **Admin dashboard**'da
kullanıcıları, antrenmanlarını görürsün; `INVITE_ONLY=1` ile davet kodu üretip sadece
arkadaşlarını alabilirsin.

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
- **Android**: APK yukarıdaki gibi hazır. Play Store için Google geliştirici hesabı (tek
  seferlik 25 $) ve kalıcı imza anahtarı gerekir.
- **iPhone, Mac olmadan gerçek uygulama**: `ios.yml` iş akışı imzasız bir IPA üretebiliyor;
  Sideloadly gibi bir araçla ücretsiz Apple hesabınla yüklenir ama 7 günde bir yenilenmesi
  gerekir. Bu yüzden iPhone için önerilen yol Safari → Ana Ekrana Ekle.
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
