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

Her şehir ayrı otomatik kaydedilir. Kayıt menüsü JSON dışa ve içe aktarımını destekler. Bir dosya açmak o şehrin yerel kaydını günceller. Eski v1 kayıtları içe aktarım veya normal açılış sırasında sürüm 2'ye yükseltilir.

## Simülasyon

- `src/cities.js` şehir sınırlarını, talep merkezlerini, ulaşım türlerini ve hedefleri içerir. İl nüfusları [TÜİK ADNKS 2025](https://data.tuik.gov.tr/Bulten/Index?p=53899) ve İstatistiklerle Çocuk 2025, tablo 1.6 kaynaklıdır. İl nüfusu, şehirler arası talep çarpanına yumuşatılarak uygulanır. Tek tek mahalle/nokta ağırlıkları, hat şablonları ve konumlar yaklaşık oyun değerleridir; resmi tarifeler veya gözlenen yolcu sayıları değildir.
- `src/model.js` kuş uçuşu koridor uzaklığını, yapım süresini ve filo başına kapasiteyi hesaplar. İkili yığınlı Dijkstra ile en kısa rotayı yürüyüş, bekleme, hat üstü yolculuk ve aktarma süreleriyle bulur. Her gün 18 saat diliminde kapasite, pik talep, yol trafiği ve gelir hesaplanır; 30 günde bir talep bölgeleri büyür. `src/worker.js` bu hesabı arayüzden ayrı bir Web Worker'da çalıştırır.
- `src/map.js` gerçek altlık haritası üzerinde durakları, depoları, taslakları ve araç hareketlerini çizer. `src/app.js` paneli, araçları, oyun saatini ve kayıtları yönetir.
- Sunucu veya hesap kurulumu gerekmiyor. İnternet ve WebGL, altlık haritanın gösterimi için gerekli. Harita açılamazsa paneldeki nokta listesiyle oyun sürdürülebilir.

## İnceleme ve kaynaklar

[Yumo Metro](https://metro.yumo.games/) oyununda herkese açık arayüz ve yardım ekranı incelendi. Şehir seçimi, haritadan durak ekleme, depo, hat inşaatı, araç edinme, sefer aralığı, aktarma ve şehir başına kayıt gibi gözlemler tasarım girdisi oldu. Hat Atölyesi'nin kodu, arayüzü, şehir talep tabloları ve denge değerleri bu proje için yazıldı.

Harita [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) ile çizilir. Altlık [OpenFreeMap](https://openfreemap.org/quick_start/) üzerinden gelir. OpenStreetMap, OpenMapTiles ve OpenFreeMap atıfları haritada gösterilir. [Vite](https://vite.dev/guide/) geliştirme sunucusunu ve üretim derlemesini sağlar.
