# Hat Atölyesi

İstanbul, Ankara, İzmir, Bursa, Konya, Kayseri, Antalya ve Eskişehir'de kendi toplu taşıma ağını planlayıp işlettiğin tek oyunculu tarayıcı oyunu. Hesap, sunucu, abonelik veya API anahtarı gerekmez.

## Başlatma

Node.js 22.12+ veya 24 ve npm gerekir.

```sh
npm ci
npm run dev
```

Vite'ın terminalde gösterdiği adresi aç. `npm test` simülasyon testlerini çalıştırır. `npm run build` herhangi bir statik sunucuya konabilen `dist/` klasörünü üretir. `npm run preview` bu çıktıyı yerelde açar.

## Oyun

1. Bir talep merkezi yakınında depo kur. Haritada istediğin noktayı seçebilir veya paneldeki talep merkezi listesini kullanabilirsin.
2. Yeni hat aç. Metro, tramvay, metrobüs, otobüs, vapur, banliyö veya füniküler seç ve durakları sırayla ekle. Örnek koridorları da plan olarak açabilirsin. Beyaz duraklardan birini yeniden kullanarak aktarma kurabilirsin. Metroda tünel derinliği yapım maliyetini etkiler.
3. İnşa et, araç satın al ve sefer aralığını belirle. Depoya en yakın durak 8 km içinde olmalı. Yapım sürerken hattı kesik çizgiyle görebilirsin.
4. Günü bitir veya saati çalıştır. Günlük gelir ve gider gün kapanışında bütçeye işlenir. Hedefler bir kez ödül verir. Maliye sekmesinden kredi alabilir ve bilet fiyatını değiştirebilirsin.
5. Araç modeli, normal ve pik sefer aralıklarını ayarla. Hat panelindeki saatlik doluluk grafiği ve harita katmanlarıyla ağı geliştir. Referans hatlar sadece yaklaşık güzergâhları gösterir; oyun ekonomisine dahil değildir. Duraklara tıklayarak istasyon bilgilerini, mağaza ve durak işlemlerini gör.
6. Ayarlardan gece teması ve renk körü dostu çizgileri seç. Boşluk ile duraklat, 1–4 ile hızı ayarla, N/D ile hat/depo planla, Esc ile iptal et ve Shift+G ile günü bitir.

Her şehir ayrı otomatik kaydedilir. Kayıt menüsü JSON dışa/içe aktarımı, manuel yuva, kopyalama ve önceki gün yedeğini destekler. Bir dosya açmak o şehrin yerel kaydını günceller. Eski v1/v2 kayıtları otomatik olarak sürüm 3'e yükseltilir.

## Sürüm 3: Ulaşım imparatorluğu

- **Hat mühendisliği:** ara güzergâh noktaları, kıvrımların süre ve maliyet etkisi, ringler, ortak koridordan dallanma, ekspres durak seçimi, geçici kapalı duraklar, tek/çift ray, karşılaşma cepleri, sinyalizasyon, yapı türleri ve inşaat aşamaları. Hat panelindeki gelişmiş ayarları aç.
- **Filo ve tesisler:** peron uzunluğu, vagon sayısı, araç kondisyonu/yıpranma, yedek filo, bakım, arıza onarımı, üretici ve ikinci el siparişleri, teslim süresi, depo kapasite geliştirmeleri, reklam, turnike ve erişilebilirlik.
- **Yönetim:** şirket adı ve rengi, personel, finansman ve tahvil, belediye sözleşmeleri, bilet tarifeleri, abonman ve aktarma indirimi, ulaşım politikası, gelir/gider ayrıntıları, günlük muhasebe ve yatırım hareketleri.
- **Yolcu dünyası:** saatlik sefer planları, hafta sonu, takvim, hava, etkinlik, yolcu grupları, alternatif mod talebi, yoğun koridorlar, karşılanmayan talep ve başlangıç/varış akış haritası.
- **Kariyer ve özel şehirler:** beş senaryo, sekiz başarım, isteğe bağlı iflas koşulu ve kurtarma finansmanı. Yeni şehir için koordinat, yarıçap, nüfus ve bütçe seç; bölge ekle veya JSON listesi yükle. Örnek format: `[{"name":"Üniversite","lng":35.5,"lat":38.7,"weight":8,"kind":"school","population":12000,"source":"Oyuncu tahmini"}]`. Türler home, work, school, mall, airport, center ve stadium.
- **Çevrimdışı:** üretim sürümünü HTTPS veya localhost üzerinden ilk kez yükledikten sonra uygulama kabuğu önbelleğe alınır. İnternet yokken gerçek harita altlığı yerine yerel şema/boş altlık kullanılabilir. Üçüncü taraf harita döşemeleri indirilmez.

Yönetim → Şirket kimliği ve gerçekçilik içinden gelişmiş personel, enerji, hava, arıza ve kapasite hesaplarını açabilirsin. Varsayılan klasik mod eski kayıtların ekonomi dengesini korur.

## Sürüm 3.1: Ayrıntılı işletme

1. **Gerçek mahalle nüfusu:** Yönetim → Gerçek mahalle nüfus paketi. Oyuna gömülü 624 mahalle, sekiz şehirde seçili 27 ilçeden derlenmiştir. İnternet veya API anahtarı gerektirmez. Seçilen mahallelerin gerçek nüfusu, koordinatı ve kaynak kodu kayda eklenir; aynı mahalle ikinci kez eklenmez. Oyun sınırları, toplam 100 özel bölge sınırı ve geçerli koordinatlar doğrulanır.
2. **Araç kartları:** Hatlar → Tek tek araç yönetimi. Araç numarası, edinim ve son bakım günü, üretici, kilometre, kondisyon, bağımsız arıza ve atölye durumu saklanır. İkinci el araç ayrı kondisyonla teslim edilir. Yedek araç yalnızca hizmet açığını kapatır. Gerçekçilikte bakım için teknisyen ve atölye gerekir, yıpranma çalışılan saatlere bağlıdır.
3. **Vardiyalar:** Yönetim'den sabah, öğle ve akşam sürücülerini ayır; hat başına vardiya sınırı belirle. Manuel vardiya toplamı kadroyu aşamaz ve sürücüler aynı vardiyada birden fazla hatta sayılmaz. İstasyon, temizlik ve güvenlik kadroları kapasite/şikâyetleri etkiler. Otomatik vardiya eski dengeyi korur.
4. **Şantiye:** Yedi iş aşamasının ilerlemesi, bütçe, gecikme, ek ekip ve duraklatma ayrı izlenir. Hava, yapı türü ve ekip sayısı tahmini açılışa etki eder. Klasik modda olağan inşaat süresi korunur.
5. **Trafik ve güzergâh:** Otobüs hattında yerel cadde, ana arter veya öncelikli yol seç. Saatler, hava, ortak koridorlar ve yakın mahalle nüfusu trafik katsayısını değiştirir. İki durak arasına GeoJSON LineString veya koordinat dizisi aktar; en önemli 12 ara nokta ve maliyet farkı hesaplanır.
6. **Şikâyet merkezi:** Doluluk, bekleme, arıza, temizlik, erişim, güvenlik ve hizmet eksikliği tahminleri günlük tutulur. Sorun ortadan kalktığında kayıt çözülmüş olarak işaretlenir; gerçekçilikte şirket itibarı etkilenir.
7. **Çevrimdışı:** Uygulama, çalışan simülasyon ve harita işçileri, stiller ve mahalle veri paketi kurulumda önbelleğe alınır. Eksik dosya varsa yeni önbellek eski çalışan sürümün yerini almaz. Çevrimdışı yeniden açılış, kurulum hatası ve üçüncü taraf döşemelerinin önbelleğe alınmaması otomatik testlerle doğrulanır.

Eski sürüm 1–3 kayıtları çalışır. Ayrıntılı araç/şantiye alanları gerektiğinde oluşur. Nüfus kayıtları gerçek kaynaklıdır; yolcu sayıları, trafik yoğunluğu, inşaat süreleri ve arıza oranları oyun tahminidir. Tüm Türkiye'nin mahalleleri ya da canlı trafik verisi değildir.

### Mahalle veri paketi

Kaynak: **TÜİK, Adrese Dayalı Nüfus Kayıt Sistemi (2025)**. Konumlar: **© OpenStreetMap katkıcıları**, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Derleme: [Topografya Açık Veri, mahalle verileri](https://github.com/topografya/veri/tree/yayin/mahalle), OSM 2026-11-01 kesiti. Ayrı, indirilebilir türetilmiş veri paketi `public/neighborhoods-2025.json` dosyasında ODbL 1.0 kapsamında sunulur; kaynak dosya yolları ve blob SHA değerleri de pakette yer alır. Konumu olmayan kayıtlar dahil edilmez, sınırları temsil eden noktalar veya yayımlanmış OSM noktaları kullanılır.

## Simülasyon

- `src/cities.js` şehir sınırlarını, talep merkezlerini, ulaşım türlerini ve hedefleri içerir. İl nüfusları [TÜİK ADNKS 2025](https://data.tuik.gov.tr/Bulten/Index?p=53899) ve İstatistiklerle Çocuk 2025, tablo 1.6 kaynaklıdır. İl nüfusu, şehirler arası talep çarpanına yumuşatılarak uygulanır. Tek tek mahalle/nokta ağırlıkları, hat şablonları ve konumlar yaklaşık oyun değerleridir; resmi tarifeler veya gözlenen yolcu sayıları değildir.
- `src/model.js` kuş uçuşu koridor uzaklığını, yapım süresini ve filo başına kapasiteyi hesaplar. İkili yığınlı Dijkstra ile en kısa rotayı yürüyüş, bekleme, hat üstü yolculuk ve aktarma süreleriyle bulur. Her gün 18 saat diliminde kapasite, pik talep, yol trafiği ve gelir hesaplanır; 30 günde bir talep bölgeleri büyür. `src/worker.js` bu hesabı arayüzden ayrı bir Web Worker'da çalıştırır.
- `src/map.js` gerçek altlık haritası üzerinde durakları, depoları, taslakları ve araç hareketlerini çizer. `src/app.js` paneli, araçları, oyun saatini ve kayıtları yönetir.
- Sunucu veya hesap kurulumu gerekmiyor. İnternet ve WebGL, altlık haritanın gösterimi için gerekli. Harita açılamazsa yerel şema ve paneldeki nokta listesiyle oyun sürdürülebilir.

## İnceleme ve kaynaklar

[Yumo Metro](https://metro.yumo.games/) oyununda herkese açık arayüz ve yardım ekranı incelendi. Şehir seçimi, haritadan durak ekleme, depo, hat inşaatı, araç edinme, sefer aralığı, aktarma ve şehir başına kayıt gibi gözlemler tasarım girdisi oldu. Hat Atölyesi'nin kodu, arayüzü, şehir talep tabloları ve denge değerleri bu proje için yazıldı.

Harita [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) ile çizilir. Altlık [OpenFreeMap](https://openfreemap.org/quick_start/) üzerinden gelir. OpenStreetMap, OpenMapTiles ve OpenFreeMap atıfları haritada gösterilir. [Vite](https://vite.dev/guide/) geliştirme sunucusunu ve üretim derlemesini sağlar.
