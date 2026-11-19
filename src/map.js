import { Map as CityMap, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cities } from './cities.js'
import { active, distance } from './model.js'

setWorkerUrl(workerUrl)

const collection = (features = []) => ({ type: 'FeatureCollection', features })
const feature = (type, coordinates, properties = {}) => ({
  type: 'Feature', geometry: { type, coordinates }, properties,
})
const tint = ['get', 'color']
const sources = ['districts', 'depots', 'lines', 'stations', 'draft', 'vehicles']
const layers = [
  { id: 'district-halo', source: 'districts', type: 'circle', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['get', 'weight'], 15, ['*', ['get', 'weight'], 3]],
    'circle-color': '#b15338', 'circle-opacity': .20, 'circle-stroke-color': '#a63320', 'circle-stroke-width': 1,
  } },
  { id: 'district-dot', source: 'districts', type: 'circle', paint: { 'circle-radius': 4, 'circle-color': '#a84c35' } },
  { id: 'line-outline', source: 'lines', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: {
    'line-color': '#fffdf7', 'line-width': ['case', ['get', 'selected'], 10, 7],
  } },
  { id: 'completed-lines', source: 'lines', type: 'line', filter: ['!', ['get', 'building']], layout: {
    'line-join': 'round', 'line-cap': 'round',
  }, paint: { 'line-color': tint, 'line-width': ['case', ['get', 'selected'], 6, 4] } },
  { id: 'building-lines', source: 'lines', type: 'line', filter: ['get', 'building'], paint: {
    'line-color': tint, 'line-width': 5, 'line-dasharray': [2, 1],
  } },
  { id: 'depots-marker', source: 'depots', type: 'circle', paint: {
    'circle-radius': 7, 'circle-color': '#186470', 'circle-stroke-color': '#fffdf7', 'circle-stroke-width': 2,
  } },
  { id: 'station-marker', source: 'stations', type: 'circle', paint: {
    'circle-radius': ['case', ['get', 'transfer'], 8, 5.5], 'circle-color': '#fffdf7',
    'circle-stroke-color': '#17292a', 'circle-stroke-width': 2,
  } },
  { id: 'draft-line', source: 'draft', type: 'line', filter: ['==', ['geometry-type'], 'LineString'], paint: {
    'line-color': '#233739', 'line-width': 4, 'line-dasharray': [1, 1.4],
  } },
  { id: 'draft-stops', source: 'draft', type: 'circle', filter: ['==', ['geometry-type'], 'Point'], paint: {
    'circle-radius': 6, 'circle-color': '#f0aa71', 'circle-stroke-color': '#263837', 'circle-stroke-width': 2,
  } },
  { id: 'vehicle-marker', source: 'vehicles', type: 'circle', paint: {
    'circle-radius': 4, 'circle-color': tint, 'circle-stroke-color': '#fffdf7', 'circle-stroke-width': 1.5,
  } },
]

const blank = {
  version: 8, sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e5e8dc' } }],
}

export function makeMap(container, city, selectPoint, report) {
  let map
  const start = cities[city]
  try {
    map = new CityMap({
      container, style: blank, center: start.center, zoom: start.zoom,
      minZoom: 9, maxZoom: 17, dragRotate: false, touchPitch: false,
    })
  } catch {
    report('WebGL açılamadı. Panelden talep merkezlerini seçerek oynayabilirsin.')
    return { showCity() {}, render() {}, animate() {}, recenter() {} }
  }
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
  map.touchZoomRotate.disableRotation()
  let snapshot
  let draft
  let selected
  let showDemand = true
  let mode = ''
  let currentCity = city
  let paths = []

  function showCity(nextCity) {
    currentCity = nextCity
    recenter()
  }

  function recenter() {
    const current = cities[currentCity]
    map.jumpTo({ center: current.center, zoom: current.zoom })
  }

  const setSource = (name, data) => map.getSource(name)?.setData(collection(data))

  function update() {
    if (!snapshot) return
    const stationById = new Map(snapshot.stations.map((s) => [s.id, s]))
    const counts = new Map()
    for (const line of snapshot.lines) {
      for (const stop of line.stops) counts.set(stop, (counts.get(stop) ?? 0) + 1)
    }
    setSource('districts', showDemand ? cities[snapshot.city].districts.map(([name, lng, lat, weight]) =>
      feature('Point', [lng, lat], { name, weight })) : [])
    setSource('depots', snapshot.depots.map((d) => feature('Point', d.position, { name: d.name })))
    setSource('stations', snapshot.stations.map((s) => feature('Point', s.position, {
      id: s.id, name: s.name, transfer: counts.get(s.id) > 1,
    })))
    setSource('lines', snapshot.lines.map((l) => feature('LineString', l.stops.map((id) => stationById.get(id).position), {
      color: l.color, id: l.id, name: l.name, selected: selected === l.id, building: l.readyAt > snapshot.day,
    })))
    const coords = draft?.stops.map((s) => s.position) ?? []
    const preview = coords.map((position) => feature('Point', position))
    if (coords.length > 1) preview.push(feature('LineString', coords))
    setSource('draft', preview)
    paths = snapshot.lines.filter((l) => active(l, snapshot.day)).map((line) => {
      const coordinates = line.stops.map((id) => stationById.get(id).position)
      const segments = coordinates.slice(1).map((p, i) => distance(coordinates[i], p))
      return { line, coordinates, segments, total: segments.reduce((a, b) => a + b, 0) }
    })
    animate(snapshot.minute)
    map.getCanvas().style.cursor = mode ? 'crosshair' : ''
  }

  function animate(minute) {
    const vehicles = []
    for (const { line, coordinates, segments, total } of paths) {
      const count = Math.min(line.fleet, 8)
      for (let i = 0; i < count; i++) {
        const phase = (minute / (15 + total * 3) + i / count) % 1
        let remaining = (phase < .5 ? phase * 2 : (1 - phase) * 2) * total
        let index = 0
        while (index < segments.length - 1 && remaining > segments[index]) remaining -= segments[index++]
        const a = coordinates[index]
        const b = coordinates[index + 1]
        const fraction = segments[index] > 0 ? remaining / segments[index] : 0
        vehicles.push(feature('Point', [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction], { color: line.color }))
      }
    }
    setSource('vehicles', vehicles)
  }

  map.on('style.load', () => {
    for (const name of sources) map.addSource(name, { type: 'geojson', data: collection() })
    for (const layer of layers) map.addLayer(layer)
    update()
  })
  fetch('https://tiles.openfreemap.org/styles/positron', { signal: AbortSignal.timeout(10000) })
    .then((response) => {
      if (!response.ok) throw new Error('Basemap unavailable')
      return response.json()
    })
    .then((style) => map.setStyle(style, { diff: false }))
    .catch(() => report('Altlık harita yüklenemedi. Talep noktaları ve hat araçları kullanılabilir.'))

  map.on('click', (event) => {
    if (!map.getLayer('station-marker')) return
    const box = [[event.point.x - 8, event.point.y - 8], [event.point.x + 8, event.point.y + 8]]
    const item = (layer) => map.queryRenderedFeatures(box, { layers: [layer] })[0]
    const station = item('station-marker')
    const district = item('district-dot')
    const line = item('line-outline')
    const position = [event.lngLat.lng, event.lngLat.lat]
    selectPoint(position, station?.properties.id, district?.properties.name, line?.properties.id)
  })

  return {
    showCity, recenter, animate,
    render(state, options) {
      snapshot = state
      draft = options.draft
      selected = options.selected
      showDemand = options.showDemand
      mode = options.mode
      update()
    },
  }
}
