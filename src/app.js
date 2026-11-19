import { accessibleColors, availableDistricts, cities, corridors, goals, modes, newlyOpenedDistricts, vehicleModels } from './cities.js'
import {
  DEPOT_COST, LOAN, LOAN_TOTAL, active, buildLine, closestDistrict, distance, estimate,
  finishDay, newGame, parseSave, projectDay, rewardGoals, service, vehiclePrice,
} from './model.js'
import { makeMap } from './map.js'
import {addContract,createCustomCity,gameCity,closestPoint,importDistricts,recordTransaction,serviceStopIds,addDistrict,assignedFleet,reservedOrders,companyOf,configureLine,depotProfile,edgeKey,finance,hire,maintenance,orderVehicles,pointDistricts,profile,rescue,scenarioConfig,upgradeDepot,upgradeStation} from './advanced.js'
import {renderLineAdvanced,renderManagement,stationUpgradeButtons} from './management.js'
import {syncRoster,syncCondition,maintainUnit,setShifts,setLineShifts,setConstruction,accelerateConstruction,neighborhoodRows,simplifyRoute,ROAD_CLASSES} from './detail.js'
import './style.css'

const $ = (id) => document.getElementById(id)
const html = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c])
const key = (city) => `hat-atolyesi:v1:${city}`
const number = new Intl.NumberFormat('tr-TR')
const decimal = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })
const money = (value) => `₺${decimal.format(value)} Mn`
const pressed = (bool) => `aria-pressed="${bool}"`
const disabled = (bool) => bool ? 'disabled' : ''
const panel = $('panel')
const dialog = $('dialog')
let storageWorks = true
let toastTimer

function read(keyName) {
  try {
    return localStorage.getItem(keyName)
  } catch {
    storageWorks = false
    return null
  }
}

function write(keyName, value) {
  try {
    localStorage.setItem(keyName, value)
  } catch {
    storageWorks = false
  }
}

function load(city) {
  const raw = read(key(city))
  if (!raw) return newGame(city)
  try {
    const saved = parseSave(raw)
    if (saved.city !== city) throw new Error('Kayıt şehri uyuşmuyor.')
    return saved
  } catch {
    notify('Yerel kayıt açılamadı. Yeni oyun başlatıldı.')
    return newGame(city)
  }
}

let city = read('hat-atolyesi:city')
if (!Object.hasOwn(cities, city)) city = 'istanbul'
let state = load(city)
let projection
const emptyProjection = () => ({riders:0,coverage:0,income:0,expense:0,rating:null,demand:0,results:{},stops:{},districts:[],bySlice:[]})
let pending = false, revision = 0, queued = null, busy = false
let worker
try { worker = new Worker(new URL('./worker.js',import.meta.url),{type:'module'}) } catch { /* local fallback */ }
let tab = 'lines'
let selected = state.lines[0]?.id
let draft = null
let waypointEdit = null
let placingDepot = false
let speed = 0
let lastSpeed = 1
let theme
let baseWarning = ''
const map = makeMap($('map'), city, onMapClick, (message) => {
  baseWarning = message
  mapBanner()
})

$('city').innerHTML = Object.entries(cities).map(([id, entry]) => `<option value="${id}">${entry.name}</option>`).join('')

function notify(message) {
  $('notice').textContent = message
  $('notice').hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { $('notice').hidden = true }, 4400)
}

function persist() {
  write(key(state.city), JSON.stringify(state))
  write('hat-atolyesi:city', state.city)
}

function clock() {
  const rounded = Math.floor(state.minute)
  const twoDigits = (value) => String(value).padStart(2, '0')
  $('day').textContent = `Gün ${number.format(state.day)}`
  $('time').textContent = `${twoDigits(Math.floor(rounded / 60))}:${twoDigits(rounded % 60)}`
  const next = state.settings.theme === 'auto' ? state.minute >= 1200 ? 'dark' : 'light' : state.settings.theme
  if (next !== theme) {
    theme = next
    document.documentElement.dataset.theme = theme
    map.setTheme?.(theme)
  }
}

function updateOverview() {
  $('city').value = state.city
  $('city-title').textContent = gameCity(state).name
  $('city-population').textContent = `${number.format(gameCity(state).population)} ${companyOf(state).customCity?'· oyuncu tanımlı nüfus':'il nüfusu · TÜİK 2025'}`
  $('cash').textContent = money(state.cash)
  $('riders').textContent = pending ? 'Hesaplanıyor…' : number.format(projection.riders)
  $('coverage').textContent = pending ? '—' : `%${projection.coverage}`
  $('skip').disabled = pending
  clock()
  document.querySelectorAll('[data-speed]').forEach((el) => el.setAttribute('aria-pressed', Number(el.dataset.speed) === speed))
  document.querySelectorAll('[data-tab]').forEach((el) => el.setAttribute('aria-pressed', el.dataset.tab === tab))
}

function mapBanner() {
  const messages = [
    placingDepot && 'Haritadan depo konumu seç.',
    draft && 'Durak eklemek için haritaya tıkla. Beyaz duraklar aktarma kurar.',
    waypointEdit && 'Hat kesimine ara güzergâh noktası eklemek için haritaya tıkla.',
    baseWarning,
  ].filter(Boolean)
  $('map-banner').hidden = messages.length === 0
  $('map-banner').textContent = messages.join(' ')
}

function syncMap() {
  mapBanner()
  map.render(state, {
    draft, selected, showDemand: $('demand').checked, heat:$('heat').checked, walk:$('walk').checked, reference:$('reference').checked,flow:$('flow').checked,
    projection, accessible:state.settings.accessible,
    mode: waypointEdit?'waypoint':draft ? 'draw' : placingDepot ? 'depot' : '',
  })
  $('heat-legend').hidden = !$('heat').checked
}

function receiveProjection(result, token) {
  if (token !== revision) return
  projection = result
  pending = false
  const awarded = rewardGoals(state, projection)
  if (awarded.length) notify(awarded.map((goal) => `${goal.label} · +${money(goal.reward)}`).join(' / '))
  updateOverview()
  if (!panel.contains(document.activeElement) || !document.activeElement.matches('input,select,textarea')) renderPanel()
  syncMap()
  if (awarded.length) persist()
}

function sendProjection() {
  if (busy || !queued) return
  const job = queued; queued = null
  if (!worker) { receiveProjection(projectDay(job.state), job.revision); return }
  busy = true
  worker.postMessage(job)
}
if (worker) {
  worker.onmessage = ({data}) => {
    busy = false
    if (data.error && data.revision === revision) {
      worker.terminate(); worker = null
      receiveProjection(projectDay(state),revision)
    } else if (data.projection) receiveProjection(data.projection,data.revision)
    sendProjection()
  }
  worker.onerror = () => {
    worker?.terminate(); worker=null; busy=false; queued=null
    receiveProjection(projectDay(state),revision)
  }
}

function update({ save = false, calculate = save || !projection } = {}) {
  projection ??= emptyProjection()
  if (calculate) {
    pending = true
    queued = {revision:++revision,state:structuredClone(state)}
  }
  updateOverview()
  renderPanel()
  syncMap()
  if (save) persist()
  if (calculate) sendProjection()
}

const button = (action, label, options = '') =>
  `<button type="button" data-action="${action}" ${options}>${label}</button>`

function districtPicker(actionLabel) {
  const points = (companyOf(state).customCity?[]:availableDistricts(state.city,state.day)).map(d=>
    `<option value="district:${cities[state.city].districts.indexOf(d)}">${html(d[0])} · talep ${d[3]}/10</option>`)
  points.push(...companyOf(state).customDistricts.map((d,i)=>`<option value="custom:${i}">${html(d.name)} · talep ${d.weight}</option>`))
  const existing = draft ? state.stations.filter((p) => !draft.stops.some((s) => s.id === p.id)
    && !(draft.extension && currentLine().stops.includes(p.id)))
    .map((s) => `<option value="station:${s.id}">${html(s.name)} · aktarma</option>`) : []
  return `<form class="stack" data-form="point">
    <label class="field">Konum <select name="point">${[...existing, ...points].join('')}</select></label>
    <button type="submit">${actionLabel}</button>
  </form>`
}

function describeLine(line) {
  const p=profile(line)
  if(p.closed||p.pausedUntil>state.day)return 'Kapalı'
  if (line.readyAt > state.day) return `${line.readyAt - state.day} gün kaldı`
  return line.fleet ? 'Seferde' : 'Araç bekliyor'
}

const lineColor = l => state.settings.accessible ? accessibleColors[(l.number-1)%accessibleColors.length] : profile(l).brandColor||l.color
function hourlyChart(forecast) {
  if (!forecast?.bySlice?.length) return ''
  const max = Math.max(1,...forecast.bySlice.map(h=>h.boards/Math.max(1,h.capacity)))
  return `<div class="hourly"><div class="row spread"><strong>Saatlik doluluk</strong><span class="hint">06 – 24</span></div><div class="hour-bars" aria-label="Saatlik yolcu talebi ve kapasite oranı">${forecast.bySlice.map(h=>{
    const load=h.boards/Math.max(1,h.capacity); return `<div class="hour-column" title="${h.hour}:00 · %${Math.round(load*100)}"><i style="height:${Math.max(3,load/max*100)}%;background:${load>1?'#c33b34':load>.7?'#db9b24':'#249b75'}"></i></div>`
  }).join('')}</div><div class="row spread hint"><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div>`
}

function currentLine() {
  return state.lines.find((line) => line.id === selected)
}

function renderLine(line) {
  const mode = modes[line.mode]
  const st = new Map(state.stations.map((s) => [s.id, s]))
  const specs = service(line,st,Math.min(23,Math.floor(state.minute/60)),state)
  const forecast = projection.results[line.id]
  const price = vehiclePrice(line)
  const canBuy = line.fleet < 40 && state.cash >= price
  return `<section class="stack section">
    <form class="row" data-form="rename">
      <label class="field" style="flex:1">Hat adı<input name="name" maxlength="32" required value="${html(line.name)}"></label>
      <button type="submit" style="align-self:end">Kaydet</button>
    </form>
    <dl class="readings">
      <div><dt>Tür</dt><dd>${mode.name}</dd></div>
      <div><dt>Durum</dt><dd>${describeLine(line)}</dd></div>
      <div><dt>Uzunluk</dt><dd>${decimal.format(specs.km)} km</dd></div>
      <div><dt>Araç / hazır</dt><dd>${line.fleet} / ${specs.available}</dd></div>
      <div><dt>Gerçek sıklık</dt><dd>${forecast ? `${decimal.format(specs.interval)} dk` : '—'}</dd></div>
      <div><dt>Tahmini doluluk</dt><dd>${forecast?.capacity ? `%${Math.round(forecast.boards / forecast.capacity * 100)}` : '—'}</dd></div>
      <div><dt>Günlük biniş</dt><dd>${forecast ? number.format(Math.round(forecast.served)) : '—'}</dd></div>
      <div><dt>Pik sıklığı</dt><dd>${forecast ? `${decimal.format(forecast.bySlice.find(h=>h.hour===8).interval)} dk` : '—'}</dd></div>
    </dl>
    ${hourlyChart(forecast)}
    <label class="field">Araç modeli ${line.fleet ? '(değiştirmek için filoyu sat)' : ''}<select id="vehicle-model" ${disabled(line.fleet>0)}>${Object.entries(vehicleModels).map(([id,m])=>`<option value="${id}" ${line.model===id?'selected':''}>${m.name} · kapasite %${Math.round(m.capacity*100)}</option>`).join('')}</select></label>
    <label class="field">Hedef sefer aralığı
      <select id="headway">${Array.from({ length: 29 }, (_, i) => i + 2)
        .map((n) => `<option value="${n}" ${line.headway === n ? 'selected' : ''}>${n} dakika</option>`).join('')}</select>
    </label>
    <label class="field">Pik saat sefer aralığı (07–10 / 16–19)<select id="peak-headway">${Array.from({length:29},(_,i)=>i+2).map(n=>`<option value="${n}" ${line.peakHeadway===n?'selected':''}>${n} dakika</option>`).join('')}</select></label>
    <div class="row wrap">
      ${button('buy', `Araç al · ${money(price)}`, `class="primary" ${disabled(!canBuy)}`)}
      ${button('sell', 'Araç sat', disabled(!line.fleet))}
      ${button('extend', 'Hattı uzat', disabled(profile(line).ring||line.stops.length >= (mode.maxStops ?? 24)))}
    </div>
    <ol class="stop-list" aria-label="Hat durakları">${line.stops.map((id, i) =>
      `<li><span class="hint">${i + 1}.</span> ${html(st.get(id).name)}${state.lines.filter((l) => l.stops.includes(id)).length > 1 ? ' <span class="hint">· aktarma</span>' : ''}${button('station-info','Bilgi',`data-station="${id}" aria-label="${html(st.get(id).name)} durağı bilgisi"`)}</li>`).join('')}</ol>
  </section>${renderLineAdvanced(state,line,forecast)}`
}

function renderDraft() {
  const plan = estimate(draft.stops, draft.mode, draft.depth)
  const extension = Boolean(draft.extension)
  const enoughStops = draft.stops.length >= 2
  const depotReady = hasDepot(draft.stops)
  return `<section class="stack">
    <div class="row spread"><h2 class="heading">${extension ? 'Hat uzatma planı' : 'Yeni hat planı'}</h2>${button('cancel', 'İptal')}</div>
    <div class="two">
      <label class="field">Araç türü <select id="mode" ${disabled(extension)}>
        ${Object.entries(modes).map(([id, m]) => `<option value="${id}" ${id === draft.mode ? 'selected' : ''}>${m.name}</option>`).join('')}
      </select></label>
      <label class="field">Tünel derinliği <select id="depth" ${disabled(extension || draft.mode !== 'metro')}>
        ${[10, 20, 30, 40, 50, 60].map((depth) => `<option value="${depth}" ${depth === draft.depth ? 'selected' : ''}>${depth} m</option>`).join('')}
      </select></label>
    </div>
    ${districtPicker('Durağı ekle')}
    <ol class="stop-list" aria-label="Plan durakları">${draft.stops.map((stop, i) =>
      `<li><span class="hint">${i + 1}.</span> ${html(stop.name)} ${stop.id && !(extension && i === 0) ? '<span class="hint">· aktarma</span>' : ''}</li>`).join('')}</ol>
    ${!enoughStops ? '<p class="hint">Bir hat için en az iki durak gerekir.</p>' : ''}
    ${enoughStops && !depotReady ? '<p class="hint">Planın en az bir durağı bir depoya 8 km mesafede olmalı.</p>' : ''}
    ${enoughStops && plan.cost > state.cash ? '<p class="hint">İnşaat için bütçe yetersiz.</p>' : ''}
    <div class="row spread"><span>${decimal.format(plan.km)} km · ${plan.days} gün</span><strong>${money(plan.cost)}</strong></div>
    <div class="row wrap">${button('build', 'İnşa et', `class="primary" ${disabled(!enoughStops || !depotReady || plan.cost > state.cash)}`)}
      ${button('undo', 'Son durağı kaldır', disabled(draft.stops.length <= Number(extension)))}</div>
  </section>`
}

function renderPanel(){const open=new Set([...(panel.querySelectorAll?.('details[open]')??[])].map(el=>el.querySelector('summary')?.textContent));renderPanelContent();for(const el of panel.querySelectorAll?.('details')??[])if(open.has(el.querySelector('summary')?.textContent))el.open=true}
function renderPanelContent() {
  if(tab==='management'){panel.innerHTML=renderManagement(state,projection);return}
  if (tab === 'goals') {
    panel.innerHTML = `<section class="stack">
      <h2 class="heading">Şehir hedefleri</h2>
      <ul class="goal-list">${goals.map((goal) => `<li>
        <div class="row spread"><strong>${goal.label}</strong><span>${state.goals.includes(goal.id) ? '✓ Tamamlandı' : money(goal.reward)}</span></div>
        <p class="hint">${goal.detail}</p></li>`).join('')}</ul>
    </section>`
    return
  }
  if (tab === 'finance') {
    panel.innerHTML = `<section class="stack">
      <h2 class="heading">İşletme hesabı</h2>
      <label class="field">Bilet ücreti (oyun TL)<select id="fare">${[10,20,40,60,80,100,120,160,200,250,300].map(f=>`<option value="${f}" ${state.fare===f?'selected':''}>₺${f}</option>`).join('')}</select></label>
      <dl class="readings">
        <div><dt>Günlük bilet geliri</dt><dd>${money(projection.income)}</dd></div>
        <div><dt>Günlük mağaza geliri</dt><dd>${money(projection.retailIncome??0)}</dd></div>
        <div><dt>Günlük işletme gideri</dt><dd>${money(projection.expense)}</dd></div>
        <div><dt>Günlük belediye desteği</dt><dd>${money(12)}</dd></div>
        <div><dt>Kalan kredi borcu</dt><dd>${money(state.loan)}</dd></div>
        <div><dt>Yolcu memnuniyeti</dt><dd>${projection.rating === null ? '—' : `%${projection.rating}`}</dd></div>
        <div><dt>Günlük karşılanmayan talep</dt><dd>${number.format(projection.demand - projection.riders)}</dd></div>
      </dl>
      <p class="hint">${money(LOAN)} kredi için toplam ${money(LOAN_TOTAL)} geri ödeme yapılır. Tahsilat günde ${money(30)}.</p>
      ${button('loan', 'Kredi al', disabled(state.loan > 0))}
      <p class="hint">Bilet fiyatı arttığında talep azalır. Giderler araç modeline ve hat uzunluğuna bağlıdır. Fiyatlar gerçek ücretler değil, oyun dengesi içindir.</p>
      ${state.history.length ? `<table class="history"><thead><tr><th>Gün</th><th>Yolcu</th><th>Kapanış bakiyesi</th></tr></thead><tbody>
        ${[...state.history].reverse().map((d) => `<tr><td>${number.format(d.day)}</td><td>${number.format(d.riders)}</td><td>${money(d.cash)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="hint">İlk gün kapandığında burada görünecek.</p>'}
    </section>`
    return
  }
  if (draft) {
    panel.innerHTML = renderDraft()
    return
  }
  if (placingDepot) {
    panel.innerHTML = `<section class="stack">
      <div class="row spread"><h2 class="heading">Depo konumu</h2>${button('cancel', 'İptal')}</div>
      <p class="hint">Haritaya tıkla ya da bir talep merkezi seç. Yapım bedeli ${money(DEPOT_COST)}.</p>
      ${districtPicker('Depoyu kur')}
    </section>`
    return
  }
  const line = currentLine()
  panel.innerHTML = `<section class="stack">
    <div class="row spread"><h2 class="heading">Ağ planı</h2><span class="hint">${state.depots.length} depo · ${state.stations.length} durak</span></div>
    <div class="row wrap">${button('new-line', 'Yeni hat', 'class="primary"')}
      ${button('depot', 'Depo kur', disabled(state.cash < DEPOT_COST || state.depots.length >= 100))}</div>
    <label class="field">Örnek gerçek koridorlardan planla<select id="corridor"><option value="">Bir koridor seç…</option>${(companyOf(state).customCity?[]:corridors[state.city]??[]).map(([name],i)=>`<option value="${i}">${html(name)}</option>`).join('')}</select></label>
    <p class="hint">Şablonlar yaklaşık gerçek güzergâh referanslarıdır; resmi durak veya tarife verisi değildir.</p>
    ${state.lines.length ? `<ul class="line-list">${state.lines.map((l) =>
      `<li>${button('select-line', `<span class="line-chip" style="background:${lineColor(l)}"></span><strong>${html(l.name)}</strong><span class="hint">${describeLine(l)}</span>`,
        `class="line-choice" data-line="${l.id}" ${pressed(l.id === selected)}`)}</li>`).join('')}</ul>`
    : `<div class="empty stack"><h3 class="heading">İlk koridorunu aç</h3>
      <p class="hint">Depo kur, en az iki talep merkezini bağla ve bir araç ekle. İnşaat tamamlanınca hat seferlere başlar.</p></div>`}
  </section>${line ? renderLine(line) : ''}`
}

function hasDepot(stops) {
  const route = draft?.extension
    ? state.stations.filter((s) => currentLine()?.stops.includes(s.id)).concat(stops)
    : stops
  return state.depots.some((depot) => route.some((stop) => distance(depot.position, stop.position) <= 8))
}

function startDraft(extension = null) {
  if(extension&&profile(extension).ring){notify('Ring hattını uzatmak için önce ringi kapat.');return false}
  if (!extension && state.lines.length >= 100) {notify('Hat sınırına ulaştın.');return false}
  placingDepot = false
  waypointEdit=null
  tab = 'lines'
  if(extension) selected=extension.id
  draft = { mode: extension?.mode ?? 'metro', depth: extension?.depth ?? 20, stops: [], extension: extension?.id }
  if (extension) draft.stops.push(state.stations.find((s) => s.id === extension.stops.at(-1)))
  update()
  return true
}

function stationCard(id) {
  const station=state.stations.find(s=>s.id===id)
  if(!station) return
  const lines=state.lines.filter(l=>l.stops.includes(id))
  const content=document.createElement('div')
  content.className='stack station-card'
  content.innerHTML=`<h3>${html(station.name)}</h3><span class="hint">Günlük biniş: ${number.format(Math.round(projection.stops[id]??0))}</span><div class="row wrap">${lines.map(l=>`<button data-line="${l.id}"><span class="line-chip" style="display:inline-block;background:${lineColor(l)}"></span> ${html(l.name)}</button>`).join('')}</div><button data-station-action="extend">Buradan hat planla</button><button data-station-action="shop" ${disabled(station.shop||state.cash<50)}>${station.shop?'Mağaza kirada':'Mağaza kur · ₺50 Mn'}</button>${stationUpgradeButtons(station,state)}<button data-station-action="remove">Durağı kaldır</button>`
  content.addEventListener('click',e=>{
    const btn=e.target.closest('button'); if(!btn)return
    map.closeStation?.(); if(dialog.open)dialog.close()
    if(btn.dataset.line){selected=btn.dataset.line;tab='lines';update();return}
    if(btn.dataset.stationAction==='extend'){
      const terminal=lines.find(l=>l.stops.at(-1)===id && l.stops.length<(modes[l.mode].maxStops??24))
      if(startDraft(terminal??null) && !terminal){draft.stops.push(station);update()} return
    }
    if(btn.dataset.stationAction==='shop'&&!station.shop&&state.cash>=50){station.shop=true;state.cash-=50;update({save:true});notify('Mağaza işletmeye hazır.');return}
    if(btn.dataset.stationAction?.startsWith('upgrade:')){if(upgradeStation(state,station,btn.dataset.stationAction.split(':')[1])){update({save:true});notify('İstasyon geliştirildi.')}else notify('Geliştirme yapılamadı.');return}
    if(btn.dataset.stationAction==='remove'){
      const byId=new Map(state.stations.map(s=>[s.id,s]))
      if(lines.some(l=>{const ids=l.stops.filter(s=>s!==id);const p=profile(l),next={...l,stops:ids,operations:{...p,expressStops:p.expressStops.filter(x=>x!==id),closedStops:p.closedStops.filter(x=>x!==id)}};return serviceStopIds(next).length<2||ids.length<(profile(l).ring?3:2)||ids.some((s,i)=>i&&distance(byId.get(s).position,byId.get(ids[i-1]).position)<modes[l.mode].spacing)})) return notify('Hat bütünlüğü nedeniyle bu durak kaldırılamaz.')
      if(!window.confirm(`${station.name} durağı tüm bağlı hatlardan kaldırılsın mı?`))return
      lines.forEach(l=>{l.stops=l.stops.filter(s=>s!==id);if(l.operations){l.operations.expressStops=profile(l).expressStops.filter(x=>x!==id);l.operations.closedStops=profile(l).closedStops.filter(x=>x!==id);if(l.operations.expressStops.length<2)l.operations.expressStops=[]}if(l.operations)for(const k of Object.keys(l.operations.waypoints))if(k.split('|').includes(id))delete l.operations.waypoints[k]});state.stations=state.stations.filter(s=>s.id!==id);update({save:true})
    }
  })
  if(!map.showStation?.(station.position,content)) { openDialog('Durak bilgisi','');$('dialog-body').append(content) }
}

function onMapClick(position, stationId, districtName, lineId) {
  if(waypointEdit){const l=state.lines.find(x=>x.id===waypointEdit.line);const edit=waypointEdit;waypointEdit=null;if(l)addWaypoint(l,edit.edge,position);return}
  if (draft || placingDepot) {
    const station = state.stations.find((s) => s.id === stationId)
    const district = pointDistricts(state).find(([name]) => name === districtName)
    place(station?.position ?? district?.slice(1, 3) ?? position, station, district?.[0])
  } else if (stationId) {
    stationCard(stationId)
  } else if (lineId) {
    selected = lineId
    tab = 'lines'
    update()
  } else if (districtName) {
    notify(districtName)
  }
}

function place(position, existing, name) {
  const [west, south, east, north] = gameCity(state).bounds
  if (position[0] < west || position[0] > east || position[1] < south || position[1] > north) {
    return notify('Bu konum şehir sınırlarının dışında.')
  }
  if (placingDepot) {
    if (state.cash < DEPOT_COST || state.depots.length >= 100) return notify('Depo kurulamıyor.')
    state.depots.push({ id: crypto.randomUUID(), position, name: `${name ?? closestPoint(state,position)[0]} Deposu` })
    state.cash -= DEPOT_COST
    recordTransaction(state,'Depo inşaatı',-DEPOT_COST,state.depots.at(-1).name)
    placingDepot = false
    return update({ save: true })
  }
  if (!draft) return
  const mode = modes[draft.mode]
  const alreadyBuilt = draft.extension ? currentLine().stops.length - 1 : 0
  if (draft.stops.length + alreadyBuilt >= (mode.maxStops ?? 24)) return notify('Bu araç türü için durak sınırına ulaştın.')
  if (existing && (draft.stops.some((s) => s.id === existing.id)
    || (draft.extension && currentLine().stops.includes(existing.id)))) return notify('Bu durak zaten hatta var.')
  const previous = draft.stops.at(-1)
  if (previous && distance(previous.position, position) < mode.spacing) {
    return notify(`Ardışık duraklar en az ${number.format(mode.spacing * 1000)} m aralıklı olmalı.`)
  }
  const autoName = closestPoint(state,position)[0]
  const baseName = name ?? autoName
  const names = new Set([...state.stations, ...draft.stops].map((s) => s.name))
  let stopName = baseName
  for (let suffix = 2; names.has(stopName); suffix++) stopName = `${baseName} ${suffix}`
  draft.stops.push(existing ?? { position, name: stopName })
  update()
}

function finishConstruction() {
  if (!draft || !hasDepot(draft.stops)) return
  if (state.stations.length + draft.stops.filter((s) => !s.id).length > 2000) return notify('Şehir durak sınırına ulaştı.')
  const line = buildLine(state, draft.stops, draft.mode, draft.depth, draft.extension ? currentLine() : null)
  if (!line) return
  if (draft.name && !draft.extension) line.name = draft.name.slice(0,32)
  if(draft.parent){line.operations={...profile(line),parent:draft.parent,express:!!draft.express}}
  selected = line.id
  draft = null
  notify(`${line.name} inşaata girdi. ${line.readyAt}. gün açılacak.`)
  update({ save: true })
}

function advanceDay() {
  if (pending) return
  if(companyOf(state).bankrupt&&!companyOf(state).freeplay){setSpeed(0);return notify('Şirket iflas durumunda. Yönetimden kurtarma veya serbest oyun seç.')}
  const building = state.lines.filter(l=>l.readyAt>state.day)
  checkpoint('Önceki gün',true)
  finishDay(state, projection)
  const opens=building.filter(l=>l.readyAt<=state.day)
  if (opens.length) notify(`${opens.map((l) => l.name).join(', ')} inşaatı tamamlandı.`)
  else if (newlyOpenedDistricts(state.city,state.day).length) notify(`Yeni talep bölgeleri açıldı: ${newlyOpenedDistricts(state.city,state.day).join(', ')}`)
  else if ((state.day-1)%30===0) notify('Şehir büyüdü! Bağlantılı bölgelerde talep daha hızlı arttı.')
  update({ save: true })
}

function switchCity(nextCity, loadedState) {
  persist()
  state = loadedState ?? load(nextCity)
  projection = emptyProjection()
  selected = state.lines[0]?.id
  draft = null
  waypointEdit=null
  placingDepot = false
  tab = 'lines'
  speed = 0
  map.showCity(state.city)
  update({ save: true })
}

const actions = {
  'new-line': () => startDraft(),
  extend: () => startDraft(currentLine()),
  depot() { draft = null; placingDepot = true; update() },
  cancel() { draft = null; waypointEdit=null; placingDepot = false; update() },
  undo() { draft.stops.pop(); update() },
  build: finishConstruction,
  'select-line'(el) { selected = el.dataset.line; update() },
  'station-info'(el) { stationCard(el.dataset.station) },
  buy() {
    const line = currentLine()
    const price = vehiclePrice(line)
    const d=state.depots.find(d=>d.id===profile(line).depot),onOrder=companyOf(state).orders.filter(o=>o.line===line.id).reduce((n,o)=>n+o.quantity,0)
    if (line.fleet+onOrder >= 40 || state.cash < price || d&&assignedFleet(state,d)+reservedOrders(state,d)>=depotProfile(d).capacity) return notify('Filo veya depo kapasitesi yetersiz.')
    state.cash -= price
    recordTransaction(state,'Araç alımı',-price,line.name)
    syncRoster(line,state.day)
    line.fleet++
    syncRoster(line,state.day);syncCondition(line,state.day)
    update({ save: true })
  },
  sell() {
    const line = currentLine()
    if (!line.fleet) return
    syncRoster(line,state.day);const unit=line.units.filter(u=>!u.reserve).at(-1)
    const revenue=Math.floor(vehiclePrice(line) * .52*(1-unit.wear/150))
    line.fleet--;line.units=line.units.filter(u=>u.number!==unit.number);syncCondition(line,state.day)
    state.cash += revenue;recordTransaction(state,'Araç satışı',revenue,line.name)
    update({ save: true })
  },
  loan() {
    if (state.loan) return
    state.cash += LOAN
    state.loan = LOAN_TOTAL
    update({ save: true })
  },
  'open-line'(el){selected=el.dataset.line;tab='lines';update()},
  'accelerate'(){const l=currentLine();if(accelerateConstruction(state,l)){recordTransaction(state,'İnşaat hızlandırma',-40,l.name);update({save:true})}},
  'upgrade-depot'(el){const d=state.depots.find(x=>x.id===el.dataset.depot);if(d&&upgradeDepot(state,d))update({save:true});else notify('Depo geliştirilemedi.')},
  'maintain'(){if(maintenance(state,currentLine())){notify('Araçlar bakıma alındı.');update({save:true})}else notify('Bakım başlatılamadı.')},
  'repair'(){const l=currentLine(),p=profile(l);if(l.units){const u=l.units.find(u=>u.failedUntil>state.day&&u.maintenanceUntil<=state.day);if(u){const cost=maintainUnit(state,l,u.number,true);if(cost){recordTransaction(state,'Araç onarımı',-cost,l.name);return update({save:true})}}return notify('Onarım için teknisyen, atölye ve bütçe gerekli.')}if(p.failedUntil>state.day&&state.cash>=15){state.cash-=15;l.operations={...p,failedUntil:0};update({save:true})}else notify('Kurtarma için bütçe veya arıza gerekli.')},
  'unit-service'(el){const l=currentLine(),cost=maintainUnit(state,l,Number(el.dataset.unit),el.dataset.repair==='true');if(cost){recordTransaction(state,'Araç bakımı',-cost,l.name);update({save:true})}else notify('İşlem için bütçe, arıza durumu ve uygun atölyeyi kontrol et.')},
  'automatic-shifts'(){delete state.company.shifts;update({save:true});notify('Otomatik vardiya düzeni etkin.')},
  async 'neighborhood-import'(el){const snapshot=state;const limit=Number(el.closest('form').elements.limit.value);el.disabled=true;try{const response=await fetch(new URL('./neighborhoods-2025.json',location.href),{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Veri paketi açılamadı');const data=await response.json();if(state!==snapshot)return;const c=companyOf(state);if(c.customCity)throw Error('Özel şehirde hazır mahalleler kullanılamaz.');const rows=neighborhoodRows(data,state.city,gameCity(state).bounds,Math.min(limit,100-c.customDistricts.length),[...pointDistricts(state).map(d=>d[0]),...cities[state.city].districts.map(d=>d[0])]);if(!rows.length)throw Error('Yeni mahalle yok veya bölge sınırına ulaşıldı.');if(!importDistricts(state,rows))throw Error('Veri doğrulanamadı.');update({save:true});notify(rows.length+' gerçek nüfuslu mahalle eklendi.')}catch(e){notify(e.message||'Mahalle paketi açılamadı.')}finally{el.disabled=false}},
  'branch'(){const l=currentLine();if(!startDraft())return;draft.mode=l.mode;draft.depth=l.depth;draft.parent=l.id;draft.name=`${l.name} B`;draft.stops=l.stops.slice(0,Math.max(1,Math.ceil(l.stops.length/2))).map(id=>state.stations.find(s=>s.id===id));update()},
  'express-clone'(){const l=currentLine();if(!startDraft())return;draft.mode=l.mode;draft.depth=l.depth;draft.parent=l.id;draft.express=true;draft.name=`${l.name} Ekspres`;draft.stops=l.stops.map(id=>state.stations.find(s=>s.id===id));update()},
  'replacement-bus'(){const l=currentLine();if(!startDraft())return;draft.mode='localbus';draft.depth=0;draft.parent=l.id;draft.name=`${l.name} Yedek`;draft.stops=l.stops.map(id=>state.stations.find(s=>s.id===id));update()},
  'waypoint-map'(el){const edge=el.closest('form').elements.edge.value;waypointEdit={line:currentLine().id,edge};mapBanner();syncMap();notify('Haritadan ara nokta seç.')},
  'waypoint-clear'(el){const l=currentLine(),[a,b]=el.closest('form').elements.edge.value.split('|');const p=profile(l),waypoints={...p.waypoints};delete waypoints[edgeKey(a,b)];applyLine(l,{waypoints})},
  'rescue'(){if(rescue(state)){update({save:true});notify('Acil finansman sağlandı.')}else notify('Kurtarma kullanılamıyor.')},
  'ledger-export'(){const csv=['Gün,Gelir,Gider,Net,Borç ödemesi,Bakiye,Yolcu',...companyOf(state).ledger.map(d=>[d.day,d.revenue,d.expense,d.profit,d.debtPayment,d.cash,d.riders].join(','))].join('\n');download(csv,'hat-atolyesi-muhasebe.csv','text/csv')},
}

function applyLine(line,patch){const result=configureLine(state,line,patch);notify(result.message);if(result.ok)update({save:true});return result.ok}
function addWaypoint(line,edge,position){const [a,b]=edge.split('|'),k=edgeKey(a,b),p=profile(line),points=[...(p.waypoints[k]??[])];if(points.length>=12)return notify('Kesimde en fazla 12 ara nokta olabilir.');if(a<b)points.push(position);else points.unshift(position);applyLine(line,{waypoints:{...p.waypoints,[k]:points}})}
function download(content,filename,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function formCommand(name,data){
  const get=k=>data.get(k),int=k=>Number(get(k)),c=companyOf(state),l=currentLine(),p=l&&profile(l);let ok=true
  if(name==='line-engineering'){
    const depot=state.depots.find(d=>d.id===get('depot'));if(depot&&assignedFleet(state,depot)+(p.depot===depot.id?0:l.fleet)>depotProfile(depot).capacity)return notify('Depoda bu filo için yer yok.')
    const patch={ring:data.has('ring'),oneway:data.has('ring')&&data.has('oneway'),express:data.has('express'),expressStops:data.getAll('expressStops'),closedStops:data.getAll('closedStops'),tracks:get('tracks')?int('tracks'):p.tracks,signal:get('signal')??p.signal,passing:data.has('passing'),structure:get('structure')??p.structure,vagons:get('vagons')?int('vagons'):p.vagons,comfort:int('comfort'),closed:data.has('closed'),pausedUntil:int('pause')?state.day+int('pause'):0,spare:int('spare'),brandColor:get('brandColor'),ad:data.has('ad'),depot:get('depot')};return applyLine(l,patch)
  }
  if(name==='line-schedule'){const parse=s=>s.trim()?s.split(',').map(x=>Number(x.trim())):null;return applyLine(l,{schedule:parse(get('normal')),weekendSchedule:parse(get('weekend'))})}
  if(name==='waypoint')return addWaypoint(l,get('edge'),[int('lng'),int('lat')])
  if(name==='route-import'){try{const points=simplifyRoute(JSON.parse(get('geojson')),gameCity(state).bounds),[a,b]=get('edge').split('|'),st=new Map(state.stations.map(s=>[s.id,s]));if(!points||!st.has(a)||!st.has(b))throw Error();const first=st.get(a).position,last=st.get(b).position;const direct=distance(points[0],first)+distance(points.at(-1),last),reverse=distance(points[0],last)+distance(points.at(-1),first);if(Math.min(direct,reverse)>1.5)throw Error();const ordered=direct<=reverse?points:[...points].reverse();const middle=ordered.slice(1,-1);return applyLine(l,{waypoints:{...p.waypoints,[edgeKey(a,b)]:a<b?middle:middle.reverse()}})}catch{return notify('GeoJSON güzergâhı geçersiz veya uçları seçilen duraklara uzak.')}}
  if(name==='line-shifts')ok=setLineShifts(state,l,[int('morning'),int('noon'),int('evening')])
  else if(name==='shifts')ok=setShifts(state,[int('morning'),int('noon'),int('evening')])
  else if(name==='construction')ok=setConstruction(state,l,int('crew'),data.has('paused'))
  else if(name==='road-class'){ok=Object.hasOwn(ROAD_CLASSES,get('road'));if(ok)l.roadClass=get('road')}
  else if(name==='order')ok=orderVehicles(state,l,int('quantity'),get('supplier'),data.has('used'))
  else if(name==='company'){if(!get('name').trim())return notify('Şirket adı gerekli.');if(!c.realism&&data.has('realism')){c.staff.driver=Math.max(c.staff.driver,state.lines.reduce((a,l)=>a+l.fleet,0)+10);c.staff.maintenance=Math.max(c.staff.maintenance,2);c.staff.station=Math.max(c.staff.station,5)}c.realism=data.has('realism');c.freeplay=data.has('freeplay');c.name=get('name').trim().slice(0,48);c.color=get('color');if(c.freeplay)c.bankrupt=false}
  else if(name==='staff')ok=hire(state,get('role'),int('count'))
  else if(name==='policy'){c.policy=get('policy');c.tariff=get('tariff');c.discount=int('discount');c.pass=data.has('pass')}
  else if(name==='funding')ok=finance(state,get('kind'))
  else if(name==='contract')ok=addContract(state,get('district'))
  else if(name==='district'){const d={name:get('name').trim(),lng:int('lng'),lat:int('lat'),weight:int('weight'),kind:get('kind')};if(get('population')!=='')d.population=int('population');if(get('source').trim())d.source=get('source').trim();ok=addDistrict(state,d)}
  else if(name==='district-import'){try{ok=importDistricts(state,JSON.parse(get('json')))}catch{ok=false}}
  else if(name==='custom-city'){const fresh=newGame(state.city);if(!createCustomCity(fresh,{name:get('name').trim(),lng:int('lng'),lat:int('lat'),radius:int('radius'),population:int('population'),budget:int('budget')}))return notify('Şehir bilgileri geçersiz.');if(!window.confirm('Mevcut kayıt yedeklenip özel şehir açılacak. Devam?'))return;checkpoint('Özel şehir öncesi');switchCity(state.city,fresh);return}
  else if(name==='scenario'){if(!window.confirm('Mevcut oyun yedeklenip bu şehirde yeni senaryo başlatılacak. Devam?'))return;checkpoint(`Senaryo öncesi, gün ${state.day}`);const fresh=newGame(state.city);fresh.company.customCity=structuredClone(c.customCity);fresh.company.customDistricts=structuredClone(c.customDistricts);scenarioConfig(fresh,get('scenario'));fresh.company.realism=get('scenario')!=='sandbox';fresh.company.staff.driver=10;switchCity(state.city,fresh);return}
  else return false
  if(ok){update({save:true});notify('İşlem tamamlandı.')}else notify('İşlem yapılamadı; bütçe, sınır veya verileri kontrol et.')
  return true
}

panel.addEventListener('click', (event) => {
  const el = event.target.closest('button[data-action]')
  if (el) actions[el.dataset.action](el)
})
panel.addEventListener('submit', (event) => {
  event.preventDefault()
  const form = event.target
  const data = new FormData(form)
  if(!['point','rename'].includes(form.dataset.form))return formCommand(form.dataset.form,data)
  if (form.dataset.form === 'rename') {
    const name = data.get('name').trim()
    if (!name) return notify('Bir hat adı yaz.')
    currentLine().name = name
    return update({ save: true })
  }
  const [kind, pick] = (data.get('point')??'').split(':')
  if (kind === 'station') {
    const station = state.stations.find((s) => s.id === pick)
    place(station.position, station)
  } else if(kind==='custom'){
    const d=companyOf(state).customDistricts[Number(pick)];if(d)place([d.lng,d.lat],null,d.name)
  } else {
    const point = cities[state.city].districts[Number(pick)];if(!point)return;const [name,x,y]=point
    place([x, y], null, name)
  }
})
panel.addEventListener('change', (event) => {
  const { id, value } = event.target
  if (id === 'mode') {
    const mode = modes[value]
    if (draft.stops.length > (mode.maxStops ?? 24)
      || draft.stops.some((stop, i) => i && distance(stop.position, draft.stops[i - 1].position) < mode.spacing)) {
      event.target.value = draft.mode
      return notify('Bu durak dizilimi seçilen araç türüne uymuyor.')
    }
    draft.mode = value
    update()
  }
  if (id === 'depth') {
    draft.depth = Number(value)
    update()
  }
  if (id === 'headway') {
    currentLine().headway = Number(value)
    update({ save: true })
  }
  if(id==='peak-headway'){currentLine().peakHeadway=Number(value);update({save:true})}
  if(id==='vehicle-model' && currentLine().fleet===0){currentLine().model=value;update({save:true})}
  if(id==='fare'){state.fare=Number(value);update({save:true})}
  if(id==='corridor' && value!=='') {
    const [name,mode,...names]=corridors[state.city][Number(value)]
    if(state.lines.length>=100)return notify('Hat sınırına ulaştın.')
    startDraft(); draft.mode=mode
    for(const name of names){
      const point=cities[state.city].districts.find(d=>d[0]===name)
      if(!point) continue
      const pos=point.slice(1,3)
      if(draft.stops.length && distance(draft.stops.at(-1).position,pos)<modes[mode].spacing) continue
      const old=state.stations.find(s=>distance(s.position,pos)<.08)
      if(!old || !draft.stops.some(s=>s.id===old.id)) draft.stops.push(old??{name,position:pos})
    }
    draft.name=name
    update()
  }
})

function openDialog(title, content) {
  $('dialog-title').textContent = title
  $('dialog-body').innerHTML = content
  dialog.showModal()
}

$('help').addEventListener('click', () => openDialog('Nasıl oynanır?', `<div class="stack">
  <ol class="stack">
    <li><strong>Depo kur.</strong> Haritadan veya paneldeki talep merkezlerinden konum seç.</li>
    <li><strong>Bir hat planla.</strong> Araç türünü seç, durakları sırayla ekle ve yapımı başlat. Beyaz bir durak seçersen iki hat arasında aktarma oluşur.</li>
    <li><strong>Araç al ve sefer aralığını ayarla.</strong> Filo yetersizse gerçek sefer aralığı hedefinden daha uzun olur.</li>
    <li><strong>Günü ilerlet.</strong> Süreyi hızlandır veya Günü bitir düğmesini kullan. Bütçe ve günlük kayıt her gün kapanışta güncellenir.</li>
  </ol>
  <p class="hint">Hedefler ilerlemene ödül verir. Maliye sekmesi talebi, geliri, gideri ve krediyi gösterir.</p>
  <p><strong>Kısayollar:</strong> Boşluk: duraklat/devam · 1–4: hız · N: hat · D: depo · Esc: iptal · Shift+G: günü bitir.</p>
  </div>`))

$('settings').addEventListener('click',()=>openDialog('Görünüm ayarları',`<div class="stack"><label class="field">Tema<select id="theme-select">${[['auto','Otomatik (20:00 sonrası koyu)'],['light','Açık'],['dark','Koyu']].map(([id,name])=>`<option value="${id}" ${state.settings.theme===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="row"><input type="checkbox" id="accessible-select" ${state.settings.accessible?'checked':''}> Renk körü dostu hatlar</label><p class="hint">Ayarlar bu şehir için otomatik kaydedilir.</p></div>`))
$('dialog-body').addEventListener('change',e=>{
  if(e.target.id==='theme-select')state.settings.theme=e.target.value
  else if(e.target.id==='accessible-select')state.settings.accessible=e.target.checked
  else return
  persist();update()
})

function snapshots(){try{return JSON.parse(read(`hat-atolyesi:slots:${state.city}`)||'[]').filter(x=>x&&typeof x.json==='string'&&typeof x.id==='string'&&typeof x.name==='string')}catch{return []}}
function checkpoint(name,automatic=false){const items=snapshots().filter(x=>!automatic||!x.automatic);const entry={id:crypto.randomUUID(),name:name.slice(0,80),automatic,day:state.day,json:JSON.stringify(state)};items.unshift(entry);const limited=items.slice(0,12);try{localStorage.setItem(`hat-atolyesi:slots:${state.city}`,JSON.stringify(limited));return true}catch{if(!automatic)notify('Kayıt alanı dolu; JSON indirerek yedekle.');return false}}
function saveDialog(){const records=snapshots();openDialog('Oyun kaydı', `<div class="stack">
  <p>${storageWorks ? 'Her şehir bu tarayıcıda ayrı ve otomatik kaydedilir.' : 'Tarayıcı depolaması kullanılamıyor. Oyunu saklamak için dosyayı indir.'}</p>
  <div class="row wrap">${button('export', 'JSON indir', 'class="primary"')}${button('import', 'JSON aç')}</div>
  <label class="field">Yeni kayıt adı<input id="snapshot-name" maxlength="80" placeholder="Örn. Metro planı A"></label>${button('snapshot','Manuel kayıt oluştur')}
  <h3 class="heading">Kayıt yuvaları</h3>${records.map(r=>`<div class="stack saved-slot"><strong>${html(r.name)}</strong><span class="hint">Gün ${html(r.day)} ${r.automatic?'· otomatik':''}</span><div class="row wrap">${button('restore','Geri yükle',`data-slot="${html(r.id)}"`)}${button('copy-slot','Kopyala',`data-slot="${html(r.id)}"`)}${button('export-slot','İndir',`data-slot="${html(r.id)}"`)}</div></div>`).join('')||'<p class="hint">Henüz kayıt yok.</p>'}
  <p class="hint">En son 12 kayıt yuvası tarayıcıda tutulur. Daha fazla kayıt için JSON dosyası indir.</p></div>`)}
$('save').addEventListener('click',saveDialog)

$('dialog-body').addEventListener('click', (event) => {
  const btn=event.target.closest('button'),action=btn?.dataset.action
  if (action === 'export') {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hat-atolyesi-${state.city}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (action === 'import') $('import').click()
  if(action==='snapshot'){const name=$('snapshot-name')?.value.trim()||`Gün ${state.day}`;if(checkpoint(name)){dialog.close();saveDialog()}}
  if(['restore','copy-slot','export-slot'].includes(action)){const slot=snapshots().find(s=>s.id===btn.dataset.slot);if(!slot)return;if(action==='export-slot')return download(slot.json,`hat-atolyesi-${state.city}-${slot.day}.json`);try{const saved=parseSave(slot.json);if(action==='restore'){if(!window.confirm('Bu kayıt geri yüklensin mi? Mevcut oyun yedeklenecek.'))return;checkpoint(`Geri yükleme öncesi · ${state.day}`);switchCity(saved.city,saved);dialog.close();notify('Kayıt geri yüklendi.')}else{const records=snapshots();records.unshift({...slot,id:crypto.randomUUID(),name:`${slot.name} (kopya)`.slice(0,80),automatic:false});write(`hat-atolyesi:slots:${state.city}`,JSON.stringify(records.slice(0,12)));dialog.close();saveDialog()}}catch{notify('Kayıt doğrulanamadı.')}}
})

$('import').addEventListener('change', async (event) => {
  const file = event.target.files[0]
  event.target.value = ''
  if (!file) return
  try {
    if (file.size > 2_000_000) throw new Error('Kayıt 2 MB boyut sınırını aşıyor.')
    const imported = parseSave(await file.text())
    switchCity(imported.city, imported)
    dialog.close()
    notify('Oyun kaydı açıldı.')
  } catch {
    notify('Bu dosya geçerli bir Hat Atölyesi kaydı değil.')
  }
})

function setSpeed(value){speed=value;if(speed)lastSpeed=speed;updateOverview()}
document.querySelectorAll('[data-speed]').forEach((el) => el.addEventListener('click', () => setSpeed(Number(el.dataset.speed))))
document.querySelectorAll('[data-tab]').forEach((el) => el.addEventListener('click', () => {
  tab = el.dataset.tab
  updateOverview()
  renderPanel()
}))
$('city').addEventListener('change', (event) => switchCity(event.target.value))
$('demand').addEventListener('change', syncMap)
$('heat').addEventListener('change',syncMap)
$('walk').addEventListener('change',syncMap)
$('reference').addEventListener('change',syncMap)
$('flow').addEventListener('change',syncMap)
$('recenter').addEventListener('click', () => map.recenter())
$('skip').addEventListener('click', advanceDay)
window.addEventListener('pagehide', persist)

document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.altKey||e.metaKey||dialog.open||e.target.matches('input,select,textarea,button,[contenteditable]'))return
  const k=e.key.toLowerCase()
  if(k===' '){e.preventDefault();setSpeed(speed?0:lastSpeed)}
  else if(['1','2','3','4'].includes(k)){setSpeed([0,1,4,12][Number(k)-1])}
  else if(k==='n')actions['new-line']()
  else if(k==='d'&&state.cash>=DEPOT_COST){tab='lines';actions.depot()}
  else if(k==='escape'&&(draft||placingDepot||waypointEdit))actions.cancel()
  else if(k==='g'&&e.shiftKey)advanceDay()
})

let previousFrame=performance.now(), lastPaint=0, lastClock=0
const reduced=matchMedia('(prefers-reduced-motion: reduce)')
function frame(now){
  const delta=Math.min(100,now-previousFrame);previousFrame=now
  if(speed&&!document.hidden&&!dialog.open){
    state.minute=Math.min(1439.999,state.minute+speed*16*delta/1000)
    if(state.minute>=1439.999)advanceDay()
    if(now-lastClock>150){clock();lastClock=now}
    if(now-lastPaint>(reduced.matches?1000:state.lines.length>50?65:state.lines.length>20?32:15)){map.animate(state.minute);lastPaint=now}
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

update()

if(typeof navigator!=='undefined'&&'serviceWorker' in navigator&&location.protocol!=='file:'&&new URL(import.meta.url).pathname.includes('/assets/')){
  navigator.serviceWorker.register(new URL('./sw.js',location.href)).then(()=>navigator.serviceWorker.ready).then(reg=>{
    const urls=performance.getEntriesByType('resource').map(r=>r.name).filter(u=>new URL(u).origin===location.origin)
    reg.active?.postMessage({type:'cache-assets',urls})
  }).catch(()=>{})
}
