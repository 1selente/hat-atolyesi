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
}

export const modes = {
  metro: { name: 'Metro', rail: 340, stop: 160, vehicle: 210, seats: 950, speed: 58, operating: 0.21, spacing: 0.45 },
  tram: { name: 'Tramvay', rail: 125, stop: 55, vehicle: 85, seats: 280, speed: 27, operating: 0.085, spacing: 0.22 },
  bus: { name: 'Metrobüs', rail: 82, stop: 38, vehicle: 38, seats: 160, speed: 32, operating: 0.048, spacing: 0.28 },
  suburban: { name: 'Banliyö', rail: 225, stop: 105, vehicle: 160, seats: 660, speed: 74, operating: 0.15, spacing: 0.75 },
  funicular: { name: 'Füniküler', rail: 255, stop: 110, vehicle: 105, seats: 190, speed: 22, operating: 0.07, spacing: 0.2, maxStops: 2 },
}

export const colors = ['#ca492c', '#2666be', '#168260', '#9146a2', '#ad710f', '#087b95', '#ca407b', '#6758aa']

export const goals = [
  { id: 'first', label: 'İlk hat', detail: 'Bir hat hizmete girsin.', reward: 220, check: (s) => s.lines.some((l) => l.readyAt <= s.day && l.fleet > 0) },
  { id: 'junction', label: 'Aktarma merkezi', detail: 'İki hat aynı durağı kullansın.', reward: 350, check: (s) => s.stations.some((p) => s.lines.filter((l) => l.stops.includes(p.id)).length > 1) },
  { id: 'riders', label: '10.000 yolculuk', detail: 'Bir günde 10.000 yolculuk yap.', reward: 600, check: (s) => s.record >= 10000 },
  { id: 'network', label: 'Üç koridor', detail: 'Üç hat aynı gün işletilsin.', reward: 800, check: (s) => s.lines.filter((l) => l.readyAt <= s.day && l.fleet > 0).length >= 3 },
]
