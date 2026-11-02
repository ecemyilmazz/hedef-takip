# Hedeflerim

Su, öğün, uyku, mod, içecek, takviye, spor ve kişisel hedefleri takip eden bir web uygulaması (PWA).
Telefonda "Ana ekrana ekle" ile uygulama gibi açılır, bilgisayarda tarayıcıda çalışır.

## Veriler nerede?

- Her kullanıcı **kendi Google hesabıyla** giriş yapar.
- Kayıtlar önce cihazda saklanır, sonra kullanıcının **kendi Google Drive'ındaki gizli uygulama klasörüne** (`appDataFolder`) yazılır.
  - `config.json`: listeler ve hedefler
  - `day-YYYY-MM-DD.json`: o günün kayıtları
- Uygulama yalnızca bu klasöre erişebilir, Drive'daki diğer dosyaları göremez.
- Arada sunucu yoktur. Uygulamayı yayınlayan kişi bile başkalarının verisini göremez.
- Klasörü silmek için: Drive › Ayarlar › Uygulamaları yönet › Hedeflerim › Gizli uygulama verilerini sil.

## Kurulum (bir kez)

### 1. Google Cloud projesi ve giriş anahtarı

1. https://console.cloud.google.com adresine gir ve yeni bir proje oluştur (ör. "Hedeflerim").
2. **APIs & Services › Library** sayfasında **Google Drive API**'yi bul ve **Enable** de.
3. **APIs & Services › OAuth consent screen** (Google Auth Platform) sayfasını aç:
   - User type: **External**
   - Uygulama adı: Hedeflerim; destek ve geliştirici e-postası: kendi adresin
   - **Data access / Scopes** bölümüne şunları ekle: `.../auth/drive.appdata`, `openid`, `email`, `profile`
   - **Audience / Test users** bölümüne uygulamayı kullanacak herkesin Gmail adresini ekle (kendin dahil, en fazla 100 kişi).
4. **APIs & Services › Credentials › Create credentials › OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins**: `https://ecemyilmazz.github.io`. Bilgisayarda deneyeceksen `http://localhost:8000` de ekle.
   - Oluşan **Client ID**'yi kopyala (`...apps.googleusercontent.com` ile biter).
5. Bu depodaki `config.js` dosyasında `googleClientId: ''` kısmına bu kimliği yapıştır ve kaydet.

> Client ID gizli değildir; tarayıcıda görünmesi normaldir. "Client secret" bu uygulamada **kullanılmaz** ve hiçbir yere yazılmamalıdır.

### 2. Yayınlama (GitHub Pages)

Depo ayarlarında **Settings › Pages › Build and deployment** bölümünde Source: *Deploy from a branch*, Branch: `main` / `(root)` seçilir.
Uygulama şu adreste açılır: https://ecemyilmazz.github.io/hedef-takip/

### 3. Telefona ekleme

- **iPhone (Safari):** Paylaş › Ana Ekrana Ekle
- **Android (Chrome):** ⋮ › Ana ekrana ekle / Uygulamayı yükle

## Bilinen sınırlar

- Uygulama "test" modunda olduğu sürece yalnızca test kullanıcısı olarak eklenen hesaplar giriş yapabilir (en fazla 100 kişi). Herkese açmak için Google'ın uygulama doğrulaması gerekir.
- Sunucu olmadığı için Google oturumu yaklaşık 1 saatte bir yenilenir. Yenileme sırasında ekranda kısa bir Google penceresi açılıp kapanabilir. Bu arada yaptığın kayıtlar cihazda saklanır ve oturum yenilenince Drive'a yazılır.
- Aynı gün iki cihazda aynı anda kayıt yapılırsa listeler (su, içecek, not, spor) birleştirilir; tekil alanlarda (ör. mod) son kaydedilen geçerli olur.

## Yerelde çalıştırma

```bash
python3 -m http.server 8000
```

Ardından http://localhost:8000 adresini aç. Bu adresin Google Cloud'da "Authorized JavaScript origins" listesinde olması gerekir.
