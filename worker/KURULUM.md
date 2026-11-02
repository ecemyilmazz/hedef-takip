# Kalıcı oturum sunucusu (Cloudflare Worker) — kurulum

Bu küçük sunucu, uygulamanın Google oturumunu **pencere açmadan** yenilemesini sağlar.
Hiçbir veri saklamaz; Drive'daki verilerine dokunmaz. Ücretsizdir.

## 1. Cloudflare hesabı
1. https://dash.cloudflare.com/sign-up adresinden ücretsiz hesap aç (e-posta + şifre).

## 2. Worker oluştur
1. Sol menüde **Compute (Workers) › Workers & Pages** › **Create** › **Create Worker** (Hello World şablonu).
2. Ad: `hedeflerim-auth` › **Deploy**.
3. **Edit code**'a bas. Soldaki dosyanın içindekilerin **hepsini sil**, bu depodaki `worker/worker.js` dosyasının içeriğini yapıştır:
   https://github.com/ecemyilmazz/hedef-takip/blob/main/worker/worker.js (sağ üstte "Copy raw file" düğmesi)
4. Sağ üstte **Deploy**.

## 3. Ayarlar (Settings › Variables and Secrets › Add)
| Ad | Tür | Değer |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Text | `967121735414-jnrc0ag77nk7prpobuc82pp4e8e291vn.apps.googleusercontent.com` |
| `ALLOWED_ORIGINS` | Text | `https://ecemyilmazz.github.io` |
| `GOOGLE_CLIENT_SECRET` | **Secret** | Google Cloud › Google Auth Platform › Clients › Hedeflerim web › **Add secret** ile oluşturduğun **yeni** secret |
| `SESSION_KEY` | **Secret** | En az 32 karakterlik rastgele bir metin (örn. bir şifre üreticisinden). Kimseyle paylaşma. |

Kaydet / **Deploy**.

> Secret değerlerini **bu sohbete, GitHub'a veya başka bir yere yazma.** Sadece Cloudflare'deki "Secret" kutusuna yapıştır.

## 4. Kontrol
Worker adresini tarayıcıda aç (örn. `https://hedeflerim-auth.KULLANICIADI.workers.dev`).
`{"ok":true,"service":"hedeflerim-auth","configured":true}` görmelisin.
`configured:false` görürsen 3. adımdaki ayarlardan biri eksik.

## 5. Uygulamaya bağla
Worker adresini (secret değil, sadece adres) uygulamanın `config.js` dosyasındaki `authServer` alanına yaz.
Sonra uygulamada **Ayarlar › Kalıcı oturumu yenile**'ye bir kez bas; Google izin ister, onayla.
Bundan sonra oturum arka planda yenilenir.

## Güvenlik notları
- Sunucu Google'ın yenileme anahtarını **şifreleyip** tarayıcıya geri verir; kendisi saklamaz.
- Sunucu sadece `ALLOWED_ORIGINS` adresinden gelen istekleri kabul eder.
- Erişimi tamamen kesmek için: https://myaccount.google.com/permissions › Hedeflerim › Erişimi kaldır.
