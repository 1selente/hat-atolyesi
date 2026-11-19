import { cities, goals, modes } from './cities.js'
import {
  DEPOT_COST, LOAN, LOAN_TOTAL, active, buildLine, closestDistrict, distance, estimate,
  finishDay, newGame, parseSave, projectDay, rewardGoals, service,
} from './model.js'
import { makeMap } from './map.js'
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
let tab = 'lines'
let selected = state.lines[0]?.id
let draft = null
let placingDepot = false
let speed = 0
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
}

function updateOverview() {
  $('city').value = state.city
  $('city-title').textContent = cities[state.city].name
  $('cash').textContent = money(state.cash)
  $('riders').textContent = number.format(projection.riders)
  $('coverage').textContent = `%${projection.coverage}`
  clock()
  document.querySelectorAll('[data-speed]').forEach((el) => el.setAttribute('aria-pressed', Number(el.dataset.speed) === speed))
  document.querySelectorAll('[data-tab]').forEach((el) => el.setAttribute('aria-pressed', el.dataset.tab === tab))
}

function mapBanner() {
  const messages = [
    placingDepot && 'Haritadan depo konumu seç.',
    draft && 'Durak eklemek için haritaya tıkla. Beyaz duraklar aktarma kurar.',
    baseWarning,
  ].filter(Boolean)
  $('map-banner').hidden = messages.length === 0
  $('map-banner').textContent = messages.join(' ')
}

function syncMap() {
  mapBanner()
  map.render(state, {
    draft, selected, showDemand: $('demand').checked,
    mode: draft ? 'draw' : placingDepot ? 'depot' : '',
  })
}

function update({ save = false } = {}) {
  const awarded = rewardGoals(state)
  if (awarded.length) notify(awarded.map((goal) => `${goal.label} · +${money(goal.reward)}`).join(' / '))
  projection = projectDay(state)
  updateOverview()
  renderPanel()
  syncMap()
  if (save) persist()
}

const button = (action, label, options = '') =>
  `<button type="button" data-action="${action}" ${options}>${label}</button>`

function districtPicker(actionLabel) {
  const points = cities[state.city].districts.map(([name, , , weight], index) =>
    `<option value="district:${index}">${html(name)} · talep ${weight}/10</option>`)
  const existing = draft ? state.stations.filter((p) => !draft.stops.some((s) => s.id === p.id)
    && !(draft.extension && currentLine().stops.includes(p.id)))
    .map((s) => `<option value="station:${s.id}">${html(s.name)} · aktarma</option>`) : []
  return `<form class="stack" data-form="point">
    <label class="field">Konum <select name="point">${[...existing, ...points].join('')}</select></label>
    <button type="submit">${actionLabel}</button>
  </form>`
}

function describeLine(line) {
  if (line.readyAt > state.day) return `${line.readyAt - state.day} gün kaldı`
  return line.fleet ? 'Seferde' : 'Araç bekliyor'
}

function currentLine() {
  return state.lines.find((line) => line.id === selected)
}

function renderLine(line) {
  const mode = modes[line.mode]
  const st = new Map(state.stations.map((s) => [s.id, s]))
  const specs = service(line, st)
  const forecast = projection.results[line.id]
  const canBuy = line.fleet < 40 && state.cash >= mode.vehicle
  return `<section class="stack section">
    <form class="row" data-form="rename">
      <label class="field" style="flex:1">Hat adı<input name="name" maxlength="32" required value="${html(line.name)}"></label>
      <button type="submit" style="align-self:end">Kaydet</button>
    </form>
    <dl class="readings">
      <div><dt>Tür</dt><dd>${mode.name}</dd></div>
      <div><dt>Durum</dt><dd>${describeLine(line)}</dd></div>
      <div><dt>Uzunluk</dt><dd>${decimal.format(specs.km)} km</dd></div>
      <div><dt>Araç</dt><dd>${line.fleet}</dd></div>
      <div><dt>Gerçek sıklık</dt><dd>${forecast ? `${decimal.format(specs.interval)} dk` : '—'}</dd></div>
      <div><dt>Tahmini doluluk</dt><dd>${forecast ? `%${Math.min(100, Math.round(forecast.boards / forecast.capacity * 100))}` : '—'}</dd></div>
    </dl>
    <label class="field">Hedef sefer aralığı
      <select id="headway">${Array.from({ length: 29 }, (_, i) => i + 2)
        .map((n) => `<option value="${n}" ${line.headway === n ? 'selected' : ''}>${n} dakika</option>`).join('')}</select>
    </label>
    <div class="row wrap">
      ${button('buy', `Araç al · ${money(mode.vehicle)}`, `class="primary" ${disabled(!canBuy)}`)}
      ${button('sell', 'Araç sat', disabled(!line.fleet))}
      ${button('extend', 'Hattı uzat', disabled(line.stops.length >= (mode.maxStops ?? 24)))}
    </div>
    <ol class="stop-list" aria-label="Hat durakları">${line.stops.map((id, i) =>
      `<li><span class="hint">${i + 1}.</span> ${html(st.get(id).name)}${state.lines.filter((l) => l.stops.includes(id)).length > 1 ? ' <span class="hint">· aktarma</span>' : ''}</li>`).join('')}</ol>
  </section>`
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

function renderPanel() {
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
      <dl class="readings">
        <div><dt>Günlük bilet geliri</dt><dd>${money(projection.income)}</dd></div>
        <div><dt>Günlük işletme gideri</dt><dd>${money(projection.expense)}</dd></div>
        <div><dt>Günlük belediye desteği</dt><dd>${money(12)}</dd></div>
        <div><dt>Kalan kredi borcu</dt><dd>${money(state.loan)}</dd></div>
        <div><dt>Yolcu memnuniyeti</dt><dd>${projection.rating === null ? '—' : `%${projection.rating}`}</dd></div>
        <div><dt>Günlük karşılanmayan talep</dt><dd>${number.format(projection.demand - projection.riders)}</dd></div>
      </dl>
      <p class="hint">${money(LOAN)} kredi için toplam ${money(LOAN_TOTAL)} geri ödeme yapılır. Tahsilat günde ${money(30)}.</p>
      ${button('loan', 'Kredi al', disabled(state.loan > 0))}
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
    ${state.lines.length ? `<ul class="line-list">${state.lines.map((l) =>
      `<li>${button('select-line', `<span class="line-chip" style="background:${l.color}"></span><strong>${html(l.name)}</strong><span class="hint">${describeLine(l)}</span>`,
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
  if (!extension && state.lines.length >= 100) return notify('Hat sınırına ulaştın.')
  placingDepot = false
  draft = { mode: extension?.mode ?? 'metro', depth: extension?.depth ?? 20, stops: [], extension: extension?.id }
  if (extension) draft.stops.push(state.stations.find((s) => s.id === extension.stops.at(-1)))
  update()
}

function onMapClick(position, stationId, districtName, lineId) {
  if (draft || placingDepot) {
    const station = state.stations.find((s) => s.id === stationId)
    const district = cities[state.city].districts.find(([name]) => name === districtName)
    place(station?.position ?? district?.slice(1, 3) ?? position, station, district?.[0])
  } else if (lineId) {
    selected = lineId
    tab = 'lines'
    update()
  } else if (stationId) {
    notify(state.stations.find((s) => s.id === stationId)?.name ?? 'Durak')
  } else if (districtName) {
    notify(districtName)
  }
}

function place(position, existing, name) {
  const [west, south, east, north] = cities[state.city].bounds
  if (position[0] < west || position[0] > east || position[1] < south || position[1] > north) {
    return notify('Bu konum şehir sınırlarının dışında.')
  }
  if (placingDepot) {
    if (state.cash < DEPOT_COST || state.depots.length >= 100) return notify('Depo kurulamıyor.')
    state.depots.push({ id: crypto.randomUUID(), position, name: `${name ?? closestDistrict(state.city, position)[0]} Deposu` })
    state.cash -= DEPOT_COST
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
  const autoName = closestDistrict(state.city, position)[0]
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
  selected = line.id
  draft = null
  notify(`${line.name} inşaata girdi. ${line.readyAt}. gün açılacak.`)
  update({ save: true })
}

function advanceDay() {
  const opens = state.lines.filter((l) => l.readyAt === state.day + 1)
  finishDay(state, projection)
  if (opens.length) notify(`${opens.map((l) => l.name).join(', ')} inşaatı tamamlandı.`)
  update({ save: true })
}

function switchCity(nextCity, loadedState) {
  persist()
  state = loadedState ?? load(nextCity)
  selected = state.lines[0]?.id
  draft = null
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
  cancel() { draft = null; placingDepot = false; update() },
  undo() { draft.stops.pop(); update() },
  build: finishConstruction,
  'select-line'(el) { selected = el.dataset.line; update() },
  buy() {
    const line = currentLine()
    const mode = modes[line.mode]
    if (line.fleet >= 40 || state.cash < mode.vehicle) return
    state.cash -= mode.vehicle
    line.fleet++
    update({ save: true })
  },
  sell() {
    const line = currentLine()
    if (!line.fleet) return
    line.fleet--
    state.cash += Math.floor(modes[line.mode].vehicle * .52)
    update({ save: true })
  },
  loan() {
    if (state.loan) return
    state.cash += LOAN
    state.loan = LOAN_TOTAL
    update({ save: true })
  },
}

panel.addEventListener('click', (event) => {
  const el = event.target.closest('button[data-action]')
  if (el) actions[el.dataset.action](el)
})
panel.addEventListener('submit', (event) => {
  event.preventDefault()
  const form = event.target
  const data = new FormData(form)
  if (form.dataset.form === 'rename') {
    const name = data.get('name').trim()
    if (!name) return notify('Bir hat adı yaz.')
    currentLine().name = name
    return update({ save: true })
  }
  const [kind, pick] = data.get('point').split(':')
  if (kind === 'station') {
    const station = state.stations.find((s) => s.id === pick)
    place(station.position, station)
  } else {
    const [name, x, y] = cities[state.city].districts[Number(pick)]
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
  </div>`))

$('save').addEventListener('click', () => openDialog('Oyun kaydı', `<div class="stack">
  <p>${storageWorks ? 'Her şehir bu tarayıcıda ayrı ve otomatik kaydedilir.' : 'Tarayıcı depolaması kullanılamıyor. Oyunu saklamak için dosyayı indir.'}</p>
  <div class="row wrap">${button('export', 'JSON indir', 'class="primary"')}${button('import', 'JSON aç')}</div>
  <p class="hint">Bir kayıt açıldığında dosyadaki şehrin yerel kaydı güncellenir.</p></div>`))

$('dialog-body').addEventListener('click', (event) => {
  const action = event.target.closest('button')?.dataset.action
  if (action === 'export') {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hat-atolyesi-${state.city}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  if (action === 'import') $('import').click()
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

document.querySelectorAll('[data-speed]').forEach((el) => el.addEventListener('click', () => {
  speed = Number(el.dataset.speed)
  updateOverview()
}))
document.querySelectorAll('[data-tab]').forEach((el) => el.addEventListener('click', () => {
  tab = el.dataset.tab
  updateOverview()
  renderPanel()
}))
$('city').addEventListener('change', (event) => switchCity(event.target.value))
$('demand').addEventListener('change', syncMap)
$('recenter').addEventListener('click', () => map.recenter())
$('skip').addEventListener('click', advanceDay)
window.addEventListener('pagehide', persist)

setInterval(() => {
  if (!speed || document.hidden || dialog.open) return
  state.minute += speed * 4
  if (state.minute >= 1440) advanceDay()
  else clock()
  map.animate(state.minute)
}, 250)

update()
