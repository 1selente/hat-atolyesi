import { Map as CityMap, Marker, Popup, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { accessibleColors, availableDistricts, cities, corridors, modes, vehicleModels } from './cities.js'
import { active, distance, estimate, WALK_RADIUS } from './model.js'

setWorkerUrl(workerUrl)

const collection = (features = []) => ({ type: 'FeatureCollection', features })
const feature = (type, coordinates, properties = {}) => ({
  type: 'Feature', geometry: { type, coordinates }, properties,
})
const tint = ['get', 'color']
const sources = ['districts', 'coverage', 'reference', 'depots', 'lines', 'stations', 'draft', 'vehicles', 'draft-preview']
const lineTint=['case',['boolean',['get','heat'],false],['interpolate',['linear'],['get','load'],0,'#2e9e6a',.7,'#f2b705',1,'#d1342b'],tint]
const layers = [
  {id:'reference-lines',source:'reference',type:'line',paint:{'line-color':'#7f9299','line-width':3,'line-dasharray':[2,2],'line-opacity':.75}},
  {id:'coverage-area',source:'coverage',type:'fill',paint:{'fill-color':'#28a778','fill-opacity':.13,'fill-outline-color':'#277c66'}},
  { id: 'district-halo', source: 'districts', type: 'circle', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, ['get', 'weight'], 15, ['*', ['get', 'weight'], 3]],
    'circle-color': '#b15338', 'circle-opacity': .20, 'circle-stroke-color': ['case',['get','unserved'],'#de3027','#a63320'], 'circle-stroke-width': ['case',['get','unserved'],3,1],
  } },
  { id: 'district-dot', source: 'districts', type: 'circle', paint: { 'circle-radius': ['case',['get','landmark'],7,4], 'circle-color': ['case',['get','landmark'],'#b87914','#a84c35'], 'circle-stroke-color':'#fff','circle-stroke-width':['case',['get','landmark'],2,0] } },
  { id: 'line-outline', source: 'lines', type: 'line', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: {
    'line-color': '#fffdf7', 'line-width': ['case', ['get', 'selected'], 10, 7],
  } },
  { id: 'completed-lines', source: 'lines', type: 'line', filter: ['all',['!', ['get', 'building']],['==',['get','pattern'],0]], layout: {
    'line-join': 'round', 'line-cap': 'round',
  }, paint: { 'line-color': lineTint, 'line-width': ['case', ['get', 'selected'], 6, 4] } },
  ...[1,2].map(pattern=>({id:`line-pattern-${pattern}`,source:'lines',type:'line',filter:['all',['!',['get','building']],['==',['get','pattern'],pattern]],layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':lineTint,'line-width':['case',['get','selected'],6,4],'line-dasharray':pattern===1?[2.5,1.4]:[.4,1.4]}})),
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
  ...[3,2,1].map(i=>({id:`transfer-ring-${i}`,source:'stations',type:'circle',filter:['all',['get','transfer'],['has',`ring${i}`]],paint:{'circle-radius':8+i*3,'circle-color':'transparent','circle-stroke-color':['get',`ring${i}`],'circle-stroke-width':2}})),
  { id: 'draft-line', source: 'draft', type: 'line', filter: ['==', ['geometry-type'], 'LineString'], paint: {
    'line-color': '#233739', 'line-width': 4, 'line-dasharray': [1, 1.4],
  } },
  { id: 'draft-stops', source: 'draft', type: 'circle', filter: ['==', ['geometry-type'], 'Point'], paint: {
    'circle-radius': 6, 'circle-color': '#f0aa71', 'circle-stroke-color': '#263837', 'circle-stroke-width': 2,
  } },
  {id:'draft-preview-line',source:'draft-preview',type:'line',paint:{'line-color':['case',['get','invalid'],'#de3027','#354e50'],'line-width':3,'line-dasharray':[1,1.4]}},
  {id:'vehicle-marker',source:'vehicles',type:'symbol',layout:{'icon-image':'vehicle-arrow','icon-size':.65,'icon-rotate':['get','bearing'],'icon-rotation-alignment':'map','icon-allow-overlap':true,'icon-ignore-placement':true},paint:{'icon-color':tint,'icon-halo-color':'#fff','icon-halo-width':1}},
]

const labelLayers=[
  {id:'reference-label',source:'reference',type:'symbol',minzoom:11,layout:{'symbol-placement':'line','text-field':['get','name'],'text-size':10},paint:{'text-color':'#637780','text-halo-color':'#fff','text-halo-width':1}},
  {id:'station-label',source:'stations',type:'symbol',minzoom:11.5,filter:['get','transfer'],layout:{'text-field':['get','name'],'text-size':12,'text-offset':[0,1.5],'text-anchor':'top','text-allow-overlap':false,'symbol-sort-key':0},paint:{'text-color':'#28373b','text-halo-color':'#fff','text-halo-width':1.5}},
  {id:'station-label-normal',source:'stations',type:'symbol',minzoom:12.5,filter:['!',['get','transfer']],layout:{'text-field':['get','name'],'text-size':11,'text-offset':[0,1.1],'text-anchor':'top','text-allow-overlap':false},paint:{'text-color':'#28373b','text-halo-color':'#fff','text-halo-width':1.5}},
  {id:'landmark-label',source:'districts',type:'symbol',minzoom:11,filter:['get','landmark'],layout:{'text-field':['get','name'],'text-size':11,'text-offset':[0,1],'text-anchor':'top'},paint:{'text-color':'#7a4d12','text-halo-color':'#fff','text-halo-width':1.5}},
  {id:'vehicle-label',source:'vehicles',type:'symbol',minzoom:11,filter:['get','accessible'],layout:{'text-field':['get','name'],'text-size':10,'text-offset':[0,1.2],'text-anchor':'top','text-allow-overlap':true},paint:{'text-color':'#18282a','text-halo-color':'#fff','text-halo-width':1}},
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
  let projection, heat=false, walk=false, reference=false, accessible=false, currentTheme, styleRevision=0
  let alerts=[], stationPopup, previewMarker
  const color = l => accessible?accessibleColors[(l.number-1)%accessibleColors.length]:l.color

  function showCity(nextCity) {
    closeStation()
    currentCity = nextCity
    recenter()
  }

  function recenter() {
    const current = cities[currentCity]
    map.jumpTo({ center: current.center, zoom: current.zoom })
  }

  const setSource = (name, data) => map.getSource(name)?.setData(collection(data))

  function circle(position){
    const [x,y]=position, d=WALK_RADIUS/111.195, lon=d/Math.cos(y*Math.PI/180)
    const points=Array.from({length:32},(_,i)=>[x+lon*Math.cos(i/32*2*Math.PI),y+d*Math.sin(i/32*2*Math.PI)])
    points.push(points[0]);return points
  }

  function closeStation(){stationPopup?.remove();stationPopup=null}
  function showStation(position,content){
    closeStation();stationPopup=new Popup({closeButton:true,maxWidth:'290px'}).setLngLat(position).setDOMContent(content).addTo(map);return true
  }

  function updateAlerts(){
    alerts.forEach(m=>m.remove());alerts=[]
    if(!snapshot||map.getZoom()<11||mode)return
    const positions=[]
    for(const l of snapshot.lines){
      if(l.readyAt>snapshot.day)continue
      const f=projection?.results[l.id]
      const overloaded=f?.bySlice?.some(h=>h.boards>h.capacity)
      const tooSlow=f?.bySlice?.some(h=>h.interval>(h.hour>=7&&h.hour<10||h.hour>=16&&h.hour<19?l.peakHeadway:l.headway)*1.5)
      let message=!l.fleet?'Araç bekliyor':overloaded?'Aşırı dolu':tooSlow?'Araç sayısı yetmiyor':''
      if(!message)continue
      const st=snapshot.stations.find(s=>s.id===l.stops[Math.floor(l.stops.length/2)])
      if(!st)continue
      const el=document.createElement('button');el.className='map-alert';el.type='button';el.textContent=`! ${l.name}: ${message}`
      el.addEventListener('click',e=>{e.stopPropagation();selectPoint(st.position,undefined,undefined,l.id)})
      const point=map.project(st.position),near=positions.filter(p=>Math.abs(p.x-point.x)<160&&Math.abs(p.y-point.y)<45).length
      positions.push(point)
      alerts.push(new Marker({element:el,anchor:'bottom',offset:[0,-16-near*30]}).setLngLat(st.position).addTo(map))
      if(alerts.length===3)break
    }
  }

  function update() {
    if (!snapshot) return
    const stationById = new Map(snapshot.stations.map((s) => [s.id, s]))
    const counts = new Map(), rings=new Map()
    for (const line of snapshot.lines) {
      for (const stop of line.stops) {counts.set(stop, (counts.get(stop) ?? 0) + 1);if(!rings.has(stop))rings.set(stop,[]);rings.get(stop).push(color(line))}
    }
    const coverageByName=new Map((projection?.districts??[]).map(d=>[d.name,d.stop]))
    setSource('districts', showDemand||walk ? availableDistricts(snapshot.city,snapshot.day).map(([name, lng, lat, weight,kind]) =>
      feature('Point', [lng, lat], { name, weight:weight*(snapshot.growth[name]??1),landmark:['airport','mall','school'].includes(kind),unserved:walk&&!coverageByName.get(name) })) : [])
    const anchors=new Map(cities[snapshot.city].districts.map(d=>[d[0],d.slice(1,3)]))
    setSource('reference',reference?(corridors[snapshot.city]??[]).map(([name,,...stops])=>feature('LineString',stops.map(n=>anchors.get(n)).filter(Boolean),{name})):[])
    const activeIds=new Set(snapshot.lines.filter(l=>active(l,snapshot.day)).flatMap(l=>l.stops))
    setSource('coverage',walk?snapshot.stations.filter(s=>activeIds.has(s.id)).map(s=>feature('Polygon',[circle(s.position)])):[])
    setSource('depots', snapshot.depots.map((d) => feature('Point', d.position, { name: d.name })))
    setSource('stations', snapshot.stations.map((s) => feature('Point', s.position, {
      id: s.id, name: s.name, transfer: counts.get(s.id) > 1,...Object.fromEntries((rings.get(s.id)??[]).slice(0,3).map((c,i)=>[`ring${i+1}`,c])),
    })))
    setSource('lines', snapshot.lines.map((l) => feature('LineString', l.stops.map((id) => stationById.get(id).position), {
      color: color(l), id: l.id, name: l.name, selected: selected === l.id, building: l.readyAt > snapshot.day,heat:heat&&active(l,snapshot.day),load:(projection?.results[l.id]?.boards??0)/Math.max(1,projection?.results[l.id]?.capacity??0),pattern:accessible?(l.number-1)%3:0,
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
    if(!draft){setSource('draft-preview',[]);previewMarker?.remove();previewMarker=null}
    if(mode)closeStation()
    updateAlerts()
  }

  function animate(minute) {
    const vehicles = []
    for (const { line, coordinates, segments, total } of paths) {
      const count = Math.min(line.fleet, 8)
      for (let i = 0; i < count; i++) {
        const cycle=2*(total/(modes[line.mode].speed*vehicleModels[line.model??'standard'].speed)*60+(coordinates.length-1)*.55)+4
        const phase = (minute / cycle + i / count) % 1
        let remaining = (phase < .5 ? phase * 2 : (1 - phase) * 2) * total
        let index = 0
        while (index < segments.length - 1 && remaining > segments[index]) remaining -= segments[index++]
        const a = coordinates[index]
        const b = coordinates[index + 1]
        const fraction = segments[index] > 0 ? remaining / segments[index] : 0
        const bearing=Math.atan2((b[0]-a[0])*Math.cos(a[1]*Math.PI/180),b[1]-a[1])*180/Math.PI+(phase<.5?0:180)
        vehicles.push(feature('Point', [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction], {color:color(line),bearing,accessible,name:`H${line.number}`}))
      }
    }
    setSource('vehicles', vehicles)
  }

  map.on('style.load', () => {
    for (const name of sources) map.addSource(name, { type: 'geojson', data: collection() })
    const canvas=document.createElement('canvas');canvas.width=canvas.height=24
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(12,1);ctx.lineTo(22,20);ctx.lineTo(12,16);ctx.lineTo(2,20);ctx.closePath();ctx.fill();map.addImage('vehicle-arrow',ctx.getImageData(0,0,24,24),{sdf:true})
    for (const layer of layers) map.addLayer(layer)
    if(map.getStyle().glyphs)for(const layer of labelLayers)map.addLayer(layer)
    update()
  })
  function setTheme(theme){
    if(theme===currentTheme)return
    currentTheme=theme;const token=++styleRevision
    fetch(`https://tiles.openfreemap.org/styles/${theme==='dark'?'dark':'positron'}`, { signal: AbortSignal.timeout(10000) })
    .then((response) => {
      if (!response.ok) throw new Error('Basemap unavailable')
      return response.json()
    })
    .then((style) => {if(token===styleRevision){map.setStyle(style, { diff: false });report('')}})
    .catch(() => {if(token===styleRevision){if(map.getStyle()?.glyphs)report('Harita teması yüklenemedi; mevcut altlık korunuyor.');else {map.setStyle({...blank,layers:[{id:'background',type:'background',paint:{'background-color':theme==='dark'?'#25323a':'#e5e8dc'}}]},{diff:false});report('Altlık harita yüklenemedi. Talep noktaları ve hat araçları kullanılabilir.')}}})
  }
  map.on('zoomend',updateAlerts)
  map.on('mousemove',event=>{
    if(!draft?.stops.length||!matchMedia('(hover:hover)').matches)return
    const point=[event.lngLat.lng,event.lngLat.lat],prev=draft.stops.at(-1).position,km=distance(prev,point),invalid=km<modes[draft.mode].spacing
    setSource('draft-preview',[feature('LineString',[prev,point],{invalid})])
    const added=estimate([...draft.stops,{position:point}],draft.mode,draft.depth).cost-estimate(draft.stops,draft.mode,draft.depth).cost
    if(!previewMarker){const el=document.createElement('div');el.className='preview-marker';previewMarker=new Marker({element:el,offset:[0,-20]}).setLngLat(point).addTo(map)}
    previewMarker.getElement().textContent=invalid?'Çok yakın':`${km.toFixed(1)} km · +₺${added} Mn`;previewMarker.setLngLat(point)
  })
  map.getCanvas().addEventListener('mouseleave',()=>{setSource('draft-preview',[]);previewMarker?.remove();previewMarker=null})

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
    showCity, recenter, animate,setTheme,showStation,closeStation,
    render(state, options) {
      snapshot = state
      draft = options.draft
      selected = options.selected
      showDemand = options.showDemand
      projection=options.projection;heat=options.heat;walk=options.walk;reference=options.reference;accessible=options.accessible
      mode = options.mode
      update()
    },
  }
}
