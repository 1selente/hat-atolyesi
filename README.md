# Hat Atölyesi

İstanbul, Ankara ve İzmir'de kendi toplu taşıma ağını planlayıp işlettiğin tek oyunculu tarayıcı oyunu.

## Başlatma

Node.js 22.12+ veya 24 ve npm gerekir.

```sh
npm ci
npm run dev
```

Vite'ın terminalde gösterdiği adresi aç. `npm test` simülasyon testlerini çalıştırır. `npm run build` herhangi bir statik sunucuya konabilen `dist/` klasörünü üretir. `npm run preview` bu çıktıyı yerelde açar.

## Oyun

1. Bir talep merkezi yakınında depo kur. Haritada istediğin noktayı seçebilir veya paneldeki talep merkezi listesini kullanabilirsin.
2. Yeni hat aç. Metro, tramvay, metrobüs, banliyö veya füniküler seç ve durakları sırayla ekle. Beyaz duraklardan birini yeniden kullanarak aktarma kurabilirsin. Metroda tünel derinliği yapım maliyetini etkiler.
3. İnşa et, araç satın al ve sefer aralığını belirle. Depoya en yakın durak 8 km içinde olmalı. Yapım sürerken hattı kesik çizgiyle görebilirsin.
4. Günü bitir veya saati çalıştır. Günlük gelir ve gider gün kapanışında bütçeye işlenir. Hedefler bir kez ödül verir. Maliye sekmesinden kredi alabilirsin.

Her şehir ayrı otomatik kaydedilir. Kayıt menüsü JSON dışa ve içe aktarımını destekler. Bir dosya açmak o şehrin yerel kaydını günceller.

## Simülasyon

- `src/cities.js` şehir sınırlarını, talep merkezlerini, ulaşım türlerini ve hedefleri içerir. Talep ağırlıkları oyun dengesi için hazırlanmıştır.
- `src/model.js` kuş uçuşu koridor uzaklığını, yapım süresini ve filo başına kapasiteyi hesaplar. En kısa rotayı yürüyüş, bekleme, hat üstü yolculuk ve aktarma süreleriyle bulur. Bir rota kapasiteyi aştığında taşınan yolcu sayısını en kısıtlı hattın kapasitesine göre düşürür.
- `src/map.js` gerçek altlık haritası üzerinde durakları, depoları, taslakları ve araç hareketlerini çizer. `src/app.js` paneli, araçları, oyun saatini ve kayıtları yönetir.
- Sunucu veya hesap kurulumu gerekmiyor. İnternet ve WebGL, altlık haritanın gösterimi için gerekli. Harita açılamazsa paneldeki nokta listesiyle oyun sürdürülebilir.

## İnceleme ve kaynaklar

[Yumo Metro](https://metro.yumo.games/) oyununda herkese açık arayüz ve yardım ekranı incelendi. Şehir seçimi, haritadan durak ekleme, depo, hat inşaatı, araç edinme, sefer aralığı, aktarma ve şehir başına kayıt gibi gözlemler tasarım girdisi oldu. Hat Atölyesi'nin kodu, arayüzü, şehir talep tabloları ve denge değerleri bu proje için yazıldı.

Harita [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) ile çizilir. Altlık [OpenFreeMap](https://openfreemap.org/quick_start/) üzerinden gelir. OpenStreetMap, OpenMapTiles ve OpenFreeMap atıfları haritada gösterilir. [Vite](https://vite.dev/guide/) geliştirme sunucusunu ve üretim derlemesini sağlar.
