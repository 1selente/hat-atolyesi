export const cities = {
  istanbul: {
    name: 'İstanbul', center: [29.009, 41.031], bounds: [28.45, 40.77, 29.58, 41.35], zoom: 11.25,
    districts: [
      ['Taksim', 28.985, 41.037, 9], ['Şişli', 28.988, 41.060, 8], ['Beşiktaş', 29.006, 41.043, 7],
      ['Levent', 29.015, 41.080, 9], ['Eminönü', 28.971, 41.018, 7], ['Aksaray', 28.948, 41.009, 8],
      ['Üsküdar', 29.016, 41.025, 8], ['Kadıköy', 29.024, 40.991, 9], ['Acıbadem', 29.047, 41.003, 5],
      ['Altunizade', 29.047, 41.023, 6], ['Bostancı', 29.095, 40.957, 6], ['Zincirlikuyu', 29.011, 41.068, 7],
      ['Bakırköy', 28.872, 40.977, 7], ['Topkapı', 28.924, 41.018, 6], ['Kağıthane', 28.971, 41.081, 6],
    ],
  },
  ankara: {
    name: 'Ankara', center: [32.847, 39.925], bounds: [32.49, 39.64, 33.19, 40.13], zoom: 11.4,
    districts: [
      ['Kızılay', 32.855, 39.920, 10], ['Ulus', 32.854, 39.943, 8], ['Sıhhiye', 32.857, 39.929, 8],
      ['Bahçelievler', 32.827, 39.927, 7], ['Beşevler', 32.827, 39.937, 6], ['AŞTİ', 32.812, 39.918, 8],
      ['Söğütözü', 32.804, 39.911, 7], ['ODTÜ', 32.781, 39.891, 7], ['Dikimevi', 32.879, 39.934, 6],
      ['Keçiören', 32.865, 39.977, 8], ['Tunalı', 32.862, 39.905, 6], ['Demetevler', 32.795, 39.966, 6],
    ],
  },
  izmir: {
    name: 'İzmir', center: [27.118, 38.436], bounds: [26.79, 38.19, 27.44, 38.66], zoom: 11.3,
    districts: [
      ['Konak', 27.129, 38.418, 9], ['Alsancak', 27.143, 38.439, 8], ['Basmane', 27.143, 38.423, 8],
      ['Halkapınar', 27.166, 38.434, 7], ['Bornova', 27.219, 38.460, 8], ['Ege Üniversitesi', 27.227, 38.456, 7],
      ['Karşıyaka', 27.112, 38.458, 8], ['Bostanlı', 27.094, 38.457, 7], ['Bayraklı', 27.166, 38.463, 7],
      ['Üçyol', 27.119, 38.406, 6], ['Göztepe', 27.081, 38.404, 6], ['Buca', 27.175, 38.386, 7],
    ],
  },
  bursa: { name: 'Bursa', center: [29.06, 40.20], bounds: [28.77, 40.08, 29.31, 40.44], zoom: 11.4, districts: [
    ['Kent Meydanı',29.064,40.195,9], ['Şehreküstü',29.062,40.188,8], ['Osmangazi',29.051,40.199,8], ['Acemler',29.014,40.211,8], ['Nilüfer',28.978,40.215,9], ['Görükle',28.840,40.229,7], ['Uludağ Üniversitesi',28.875,40.229,8,'school'], ['Kestel',29.211,40.197,6], ['Yıldırım',29.095,40.197,8], ['Mudanya',28.883,40.374,6],
  ] },
  konya: { name: 'Konya', center: [32.49,37.89], bounds: [32.22,37.66,32.82,38.17], zoom: 11.5, districts: [
    ['Alaaddin',32.492,37.872,10], ['Mevlana',32.505,37.871,9], ['Kültürpark',32.482,37.877,8], ['Otogar',32.488,37.95,8], ['Selçuk Üniversitesi',32.514,38.027,9,'school'], ['Bosna Hersek',32.504,38.009,8], ['Meram',32.432,37.836,7], ['Karatay',32.54,37.875,7], ['Yatağan',32.57,37.91,5],
  ] },
  kayseri: { name: 'Kayseri', center: [35.49,38.73], bounds: [35.25,38.53,35.73,38.95], zoom: 11.5, districts: [
    ['Cumhuriyet Meydanı',35.488,38.722,10], ['Düvenönü',35.478,38.722,8], ['Hastane',35.462,38.735,8], ['Erciyes Üniversitesi',35.524,38.709,9,'school'], ['Talas',35.565,38.689,8], ['İldem',35.624,38.771,7], ['Organize Sanayi',35.331,38.732,8,'work'], ['Belsin',35.396,38.744,7], ['Kumsmall',35.424,38.779,7,'mall'],
  ] },
  antalya: { name: 'Antalya', center: [30.70,36.90], bounds: [30.46,36.75,31.03,37.12], zoom: 11.5, districts: [
    ['Muratpaşa',30.70,36.89,10], ['Kaleiçi',30.706,36.884,8], ['Otogar',30.658,36.924,8], ['Akdeniz Üniversitesi',30.648,36.895,9,'school'], ['Konyaaltı',30.641,36.865,8], ['Lara',30.778,36.855,8], ['Kepez',30.678,36.961,8], ['Aksu',30.847,36.946,6], ['MarkAntalya',30.702,36.897,7,'mall'],
  ] },
  eskisehir: { name: 'Eskişehir', center: [30.52,39.77], bounds: [30.33,39.62,30.75,39.93], zoom: 12, districts: [
    ['Çarşı',30.52,39.774,10], ['Odunpazarı',30.523,39.766,8], ['Anadolu Üniversitesi',30.498,39.794,9,'school'], ['Osmangazi Üniversitesi',30.485,39.751,8,'school'], ['Otogar',30.563,39.779,7], ['Sazova',30.470,39.768,6], ['Batıkent',30.446,39.794,7], ['Şehir Hastanesi',30.572,39.756,8], ['ESPark',30.513,39.783,7,'mall'],
  ] },
}

// Province population: TÜİK ADNKS, 31 December 2025, Table 1.6 of
// İstatistiklerle Çocuk 2025, https://data.tuik.gov.tr/Bulten/Index?p=53899
export const population2025 = {istanbul:15754053,ankara:5910320,izmir:4504185,bursa:3263011,konya:2343409,kayseri:1458991,antalya:2777677,eskisehir:927956}

// Approximate geographic anchors; weights are fictional game-balancing values,
// not official passenger counts or schedules. No key or paid data service.
const extras = {
  istanbul: [['İstanbul Havalimanı',28.752,41.262,9,'airport'], ['Sabiha Gökçen',29.309,40.907,9,'airport'], ['Sarıyer',29.052,41.166,6,'home'], ['Bağcılar',28.857,41.034,9,'home'], ['Başakşehir',28.790,41.104,8,'home'], ['Pendik',29.235,40.876,8,'home'], ['Söğütlüçeşme',29.038,40.991,8,'center'], ['Mall of İstanbul',28.808,41.063,7,'mall'], ['İTÜ Ayazağa',29.026,41.105,7,'school']],
  ankara: [['Esenboğa Havalimanı',32.999,40.124,9,'airport'], ['Ankara Garı',32.845,39.936,8,'center'], ['Batıkent',32.724,39.969,8,'home'], ['Çayyolu',32.699,39.891,8,'home'], ['Ankamall',32.832,39.951,7,'mall'], ['Ankara Üniversitesi',32.833,39.937,7,'school']],
  izmir: [['Adnan Menderes Havalimanı',27.158,38.292,9,'airport'], ['Balçova',27.043,38.394,7,'home'], ['Gaziemir',27.132,38.321,8,'home'], ['Çiğli',27.062,38.494,8,'work'], ['Mavişehir',27.086,38.473,7,'home']],
  bursa: [['Yenişehir Havalimanı',29.549,40.255,7,'airport']],
  kayseri: [['Kayseri Havalimanı',35.495,38.771,8,'airport']],
  konya: [['Konya Havalimanı',32.562,37.98,8,'airport']],
  antalya: [['Antalya Havalimanı',30.801,36.906,10,'airport']],
  eskisehir: [['Hasan Polatkan Havalimanı',30.519,39.813,7,'airport']],
}
cities.bursa.bounds[2] = 29.60
const work = new Set(['Levent','Şişli','Zincirlikuyu','Söğütözü','Ulus','Bayraklı','Halkapınar','Acemler'])
const home = new Set(['Acıbadem','Bostancı','Kağıthane','Bakırköy','Keçiören','Demetevler','Karşıyaka','Bostanlı','Buca','Talas','İldem','Görükle'])
for (const [id, city] of Object.entries(cities)) {
  const added = extras[id] ?? []
  city.population=population2025[id]
  // Dampened population scaling keeps small cities enjoyable while reflecting size.
  city.demandScale=(city.population/population2025.istanbul)**.18
  city.landmarks = added.filter(d => ['airport','mall','school'].includes(d[4])).map(([name,lng,lat,weight,kind]) => ({name,lng,lat,weight,kind}))
  city.districts = [...city.districts, ...added].map(([name,x,y,w,kind]) => [name,x,y,w,kind ?? (work.has(name) ? 'work' : home.has(name) ? 'home' : /Üniversite|ODTÜ/.test(name) ? 'school' : 'center')])
}

export const corridors = {
  istanbul: [['M2 örnek koridoru','metro','Taksim','Şişli','Zincirlikuyu','Levent','İTÜ Ayazağa'], ['Boğaz vapuru','ferry','Beşiktaş','Üsküdar','Kadıköy'], ['Metrobüs örnek koridoru','bus','Topkapı','Zincirlikuyu','Altunizade','Söğütlüçeşme']],
  ankara: [['Ankaray örnek koridoru','metro','AŞTİ','Beşevler','Kızılay','Dikimevi'], ['M1 örnek koridoru','metro','Kızılay','Sıhhiye','Ulus','Demetevler','Batıkent']],
  izmir: [['İzmir metro örnek koridoru','metro','Üçyol','Konak','Basmane','Halkapınar','Bornova','Ege Üniversitesi'], ['Körfez vapuru','ferry','Konak','Karşıyaka','Bostanlı']],
  bursa: [['Bursaray örnek koridoru','metro','Kestel','Şehreküstü','Osmangazi','Acemler','Nilüfer','Uludağ Üniversitesi']],
  konya: [['Tramvay örnek koridoru','tram','Alaaddin','Kültürpark','Otogar','Bosna Hersek','Selçuk Üniversitesi']],
  kayseri: [['Tramvay örnek koridoru','tram','Belsin','Düvenönü','Cumhuriyet Meydanı','Erciyes Üniversitesi','Talas']],
  antalya: [['AntRay örnek koridoru','tram','Otogar','Muratpaşa','MarkAntalya','Aksu']],
  eskisehir: [['ESTRAM örnek koridoru','tram','Anadolu Üniversitesi','ESPark','Çarşı','Odunpazarı','Osmangazi Üniversitesi']],
}

const unlockDays = {istanbul:{Sarıyer:31,Pendik:61},ankara:{Çayyolu:31},izmir:{Mavişehir:31},bursa:{Mudanya:31},konya:{Yatağan:31},kayseri:{Kumsmall:31},antalya:{Lara:31},eskisehir:{Sazova:31}}
export function availableDistricts(city, day) {
  return cities[city].districts.filter(d=>day>=(unlockDays[city]?.[d[0]]??1))
}
export function newlyOpenedDistricts(city,day) {
  return Object.entries(unlockDays[city]??{}).filter(([,opens])=>opens===day).map(([name])=>name)
}

export const modes = {
  metro: { name: 'Metro', rail: 340, stop: 160, vehicle: 210, seats: 950, speed: 58, operating: 0.21, spacing: 0.45 },
  tram: { name: 'Tramvay', rail: 125, stop: 55, vehicle: 85, seats: 280, speed: 27, operating: 0.085, spacing: 0.22 },
  bus: { name: 'Metrobüs', rail: 82, stop: 38, vehicle: 38, seats: 160, speed: 32, operating: 0.048, spacing: 0.28 },
  suburban: { name: 'Banliyö', rail: 225, stop: 105, vehicle: 160, seats: 660, speed: 74, operating: 0.15, spacing: 0.75 },
  funicular: { name: 'Füniküler', rail: 255, stop: 110, vehicle: 105, seats: 190, speed: 22, operating: 0.07, spacing: 0.2, maxStops: 2 },
  localbus: { name: 'Otobüs', rail: 12, stop: 12, vehicle: 18, seats: 85, speed: 22, operating: .032, spacing: .15 },
  ferry: { name: 'Vapur', rail: 18, stop: 80, vehicle: 100, seats: 480, speed: 25, operating: .12, spacing: .6 },
}

export const vehicleModels = {
  standard: { name: 'Standart', cost: 1, capacity: 1, operating: 1, speed: 1 },
  compact: { name: 'Kompakt', cost: .68, capacity: .65, operating: .72, speed: 1.04 },
  high: { name: 'Yüksek kapasiteli', cost: 1.5, capacity: 1.65, operating: 1.36, speed: .97 },
  eco: { name: 'Enerji verimli', cost: 1.24, capacity: 1, operating: .65, speed: 1 },
}

export const colors = ['#ca492c', '#2666be', '#168260', '#9146a2', '#ad710f', '#087b95', '#ca407b', '#6758aa']
export const accessibleColors = ['#0072B2','#E69F00','#009E73','#CC79A7','#D55E00','#56B4E9','#F0E442','#000000']

export const goals = [
  { id: 'first', label: 'İlk hat', detail: 'Bir hat hizmete girsin.', reward: 220, check: (s) => s.lines.some((l) => l.readyAt <= s.day && l.fleet > 0) },
  { id: 'junction', label: 'Aktarma merkezi', detail: 'İki hat aynı durağı kullansın.', reward: 350, check: (s) => s.stations.some((p) => s.lines.filter((l) => l.stops.includes(p.id)).length > 1) },
  { id: 'riders', label: '10.000 yolculuk', detail: 'Bir günde 10.000 yolculuk yap.', reward: 600, check: (s) => s.record >= 10000 },
  { id: 'network', label: 'Üç koridor', detail: 'Üç hat aynı gün işletilsin.', reward: 800, check: (s) => s.lines.filter((l) => l.readyAt <= s.day && l.fleet > 0).length >= 3 },
  { id: 'airport', label: 'Havalimanı bağlantısı', detail: 'Önemli bir havalimanına aktif ulaşım sağla.', reward: 1200, check: (s, p) => p?.districts?.some(d => d.kind === 'airport' && d.stop) },
]
