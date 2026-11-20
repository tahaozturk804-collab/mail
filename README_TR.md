# NEXUSCORE AI — İlk Android MVP (0.1.0)

Kişisel kullanım için hazırlanmış, Kotlin Android katmanı + React/Vite arayüz kaynağı içeren başlangıç projesi.

## Bu sürümde çalışanlar

- Yerel siberpunk komut paneli ve sistem kayıt akışı.
- Kotlin `AndroidBridge` üzerinden dar kapsamlı, izin listeli komut yönlendirme.
- Uygulama sürecinin CPU kullanım tahmini.
- Sistem RAM kullanımı, uygulama heap'i, pil seviyesi/sıcaklığı ve Android termal durumunun okunması.
- Türkçe, tek seferlik sesli komut girişi (Android konuşma tanıma ekranı ile; mikrofon izni yalnızca kullanıcı butona bastığında istenir).
- Sistem ayar sayfalarını açma, medya sesini tek kademe artırma/azaltma.
- Hassas komutlar için ilk seviye yerel engel.

## Bilinçli olarak bu MVP'de olmayanlar

- Root, cihaz yöneticisi veya sınırsız sistem yetkisi.
- Yüzen pencere balonu ve AccessibilityService otomasyonu (sonraki sürüm için planlandı).
- Arka planda sürekli mikrofon dinleme / wake-word.
- Bankacılık, parola, ödeme, toplu silme veya dışarı veri aktarma.
- Wi-Fi/Bluetooth adaptörünü sessizce açma-kapama. İlgili sistem ayar sayfası açılır.
- Kesin donanım düzeyinde %35 CPU limiti.

Android, normal uygulamalara bazı sistem durumlarını doğrudan değiştirme yetkisi vermez. Bu sürüm yalnızca sistemin izin verdiği ayar ekranlarını açar.

## Gereksinimler

- Android Studio (güncel kararlı sürüm)
- JDK 17
- Android SDK Platform 35 ve Build Tools
- Test için Android 11–15 cihaz veya emülatör
- React arayüzünü yeniden derlemek için Node.js 20+ ve npm

## Android Studio'da açma

1. ZIP'i çıkar.
2. Android Studio'da `NEXUSCORE-AI/android` klasörünü **Open** ile aç.
3. Gradle senkronizasyonu tamamlanınca bir Android 11–15 cihaz bağla veya emülatör başlat.
4. `app` yapılandırmasını çalıştır.

Proje, `android/gradle/wrapper/gradle-wrapper.properties` içinde Gradle 8.13 dağıtımını ve resmi SHA-256 doğrulamasını tanımlar. Bu pakette ağ kısıtları nedeniyle resmi `gradle-wrapper.jar` ve derlenmiş APK yer almıyor. Android Studio wrapper JAR eksikliği bildirirse, bilgisayarında Gradle kurulu olan bir terminalde `android` klasörüne girip `gradle wrapper --gradle-version 8.13` komutunu çalıştır. Bu işlem standart `gradlew` dosyalarını üretir. Ardından Android Studio ile yeniden senkronize et.

5. APK üretmek için Android Studio menüsünde **Build → Build Bundle(s) / APK(s) → Build APK(s)** yolunu kullan. Başarılı derlemede APK genellikle `android/app/build/outputs/apk/debug/app-debug.apk` konumunda oluşur.

## React arayüzünü Android'e aktarma

Android uygulamasında ilk açılışta çalışan çevrimdışı bir HTML/CSS/JS başlangıç arayüzü zaten bulunur. React kaynakları `frontend/` klasöründedir. Node/npm erişimi olan bilgisayarda:

```bash
cd frontend
npm install
npm run build
npm run sync-android
```

`sync-android`, `frontend/dist` içeriğini `android/app/src/main/assets/www` klasörüne kopyalar. Ardından Android Studio'da Gradle Sync yapıp uygulamayı yeniden çalıştır.

## Desteklenen örnek komutlar

- `yardım`
- `cihaz bilgisi`
- `ayarları aç`
- `wifi ayarları`
- `bluetooth ayarları`
- `ekran ayarları`
- `pil ayarları`
- `ses artır`
- `ses azalt`

Komut yönlendiricisi bir genel amaçlı yapay zekâ değildir; ilk sürümde yalnızca bu açıkça tanımlanmış komutları yürütür.

## %35 CPU hedefinin doğru yorumu

`ResourceGovernor.kt`, yalnızca kendi kuyruğuna verilen kısa arka plan görevlerini ölçülen süreç yükü hedefin üzerine çıktığında bekletir ve arka plan iş parçacığı önceliğini düşürür. Bu, Android uygulamasının bütün iş parçacıklarına/yerel kütüphanelerine ya da cihazın diğer uygulamalarına donanım düzeyinde kesin %35 kota koymaz. UI'daki CPU değeri **NEXUSCORE uygulama sürecinin normalize edilmiş CPU tahminidir**, cihazın toplam CPU kullanım yüzdesi değildir.

## Güvenlik notu

`addJavascriptInterface` yalnızca paket içindeki yerel WebView sayfasına açılmıştır. WebView'e uzak veya kullanıcıdan alınmış HTML yüklemeyin. Köprüye yeni metot eklerken yalnızca gerekli işlemleri açın ve her komut için izin listesi kullanın.

## Kaynaklar

- Android WebView güvenliği: https://developer.android.com/develop/ui/views/layout/webapps/webview
- Android `Process.setThreadPriority`: https://developer.android.com/reference/android/os/Process#setThreadPriority(int)
- Android termal durum API'si: https://developer.android.com/reference/android/os/PowerManager#getCurrentThermalStatus()
- Arka plan foreground-service kısıtları: https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start
- Android 15 foreground-service değişiklikleri: https://developer.android.com/about/versions/15/changes/foreground-service-types
