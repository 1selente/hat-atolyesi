import { availableDistricts, cities, colors, goals, modes, vehicleModels } from './cities.js'

export const DEPOT_COST = 340
export const LOAN = 2000
export const LOAN_TOTAL = 2440
export const DAY_MINUTES = 18 * 60
export const WALK_RADIUS = 1.15
export const HOURS = Array.from({length:18}, (_,i) => i + 6)
export const DEFAULT_FARE = 160 // retains v1's economic balance (fictional game TL)
const radians = Math.PI / 180

export function distance(a, b) {
  const y = (b[1] - a[1]) * radians
  const x = (b[0] - a[0]) * radians
  const h = Math.sin(y / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(x / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)))
}

export function closestDistrict(city, position) {
  return cities[city].districts.reduce((best, district) =>
    distance(position, district.slice(1, 3)) < distance(position, best.slice(1, 3)) ? district : best)
}

export function newGame(city) {
  return {
    version: 2, city, day: 1, minute: 360, cash: 12000, loan: 0,
    stations: [], lines: [], depots: [], goals: [], record: 0, history: [],
    fare: DEFAULT_FARE, growth: {}, settings: { theme: 'auto', accessible: false },
  }
}

export function migrate(save) {
  if (save?.version !== 1) return save
  return { ...save, version: 2, fare: DEFAULT_FARE, growth: {}, settings: {theme:'auto', accessible:false},
    lines: Array.isArray(save.lines) ? save.lines.map(l => ({ ...l, model:'standard', peakHeadway: l?.headway })) : save.lines }
}

export function vehiclePrice(line) { return Math.ceil(modes[line.mode].vehicle * vehicleModels[line.model ?? 'standard'].cost) }

export function active(line, day) {
  return line.fleet > 0 && line.readyAt <= day
}

export function lengthOf(stops) {
  return stops.slice(1).reduce((sum, stop, i) => sum + distance(stops[i].position, stop.position), 0)
}

export function estimate(stops, modeId, depth) {
  const mode = modes[modeId]
  const km = lengthOf(stops)
  const depthFactor = modeId === 'metro' ? 1 + (depth - 10) / 100 : 1
  return {
    km,
    cost: Math.ceil(km * mode.rail * depthFactor + stops.filter((s) => !s.id).length * mode.stop * depthFactor),
    days: Math.max(1, Math.ceil(km / 3 + stops.length / 4)),
  }
}

export function buildLine(state, stops, mode, depth, extension) {
  const plan = estimate(stops, mode, depth)
  if (stops.length < 2 || plan.cost > state.cash) return null
  const stopIds = stops.map((stop) => {
    if (stop.id) return stop.id
    const station = { ...stop, id: crypto.randomUUID() }
    state.stations.push(station)
    return station.id
  })
  if (extension) {
    extension.stops.push(...stopIds.slice(1))
    extension.readyAt = state.day + plan.days
  } else {
    const number = state.lines.reduce((max, line) => Math.max(max, line.number), 0) + 1
    extension = {
      id: crypto.randomUUID(), number, name: `H${number}`, mode, depth,
      stops: stopIds, readyAt: state.day + plan.days, fleet: 0, headway: 6, peakHeadway: 6, model: 'standard',
      color: colors[(number - 1) % colors.length],
    }
    state.lines.push(extension)
  }
  state.cash -= plan.cost
  return extension
}

export function service(line, stations, hour) {
  const mode = modes[line.mode]
  const model = vehicleModels[line.model ?? 'standard']
  const stops = line.stops.map((id) => stations.get(id))
  const km = lengthOf(stops)
  const peak = hour >= 7 && hour < 10 || hour >= 16 && hour < 19
  const traffic = peak && ['bus','localbus'].includes(line.mode) ? 1.35 : 1
  const roundTrip = 2 * (km / (mode.speed * model.speed) * 60 * traffic + (stops.length - 1) * 0.55) + 4
  const interval = Math.max(peak ? (line.peakHeadway ?? line.headway) : line.headway, roundTrip / Math.max(1, line.fleet))
  return {
    km, interval, traffic,
    capacity: (hour === undefined ? Math.floor(DAY_MINUTES / interval) : 60 / interval) * Math.round(mode.seats * model.capacity) * 2,
    expense: line.fleet * mode.operating * model.operating + km * 0.07,
  }
}

function routes(graph, origin) {
  const pending = [[origin, 0]]
  const best = new Map([[origin,0]])
  function push(entry) {
    let i = pending.length; pending.push(entry)
    while (i) { const p = (i-1)>>1; if (pending[p][1] <= entry[1]) break; pending[i] = pending[p]; i = p }
    pending[i] = entry
  }
  function pop() {
    const first = pending[0], last = pending.pop()
    if (pending.length) {
      let i = 0
      while (2*i+1 < pending.length) {
        let child = 2*i+1
        if (child+1 < pending.length && pending[child+1][1] < pending[child][1]) child++
        if (pending[child][1] >= last[1]) break
        pending[i] = pending[child]; i = child
      }
      pending[i] = last
    }
    return first
  }
  const settled = new Map()
  const previous = new Map()
  while (pending.length) {
    const [node, cost] = pop()
    if (settled.has(node)) continue
    settled.set(node, cost)
    for (const edge of graph.get(node) ?? []) {
      if (settled.has(edge.to) || cost + edge.cost >= (best.get(edge.to) ?? Infinity)) continue
      best.set(edge.to, cost + edge.cost)
      push([edge.to, cost + edge.cost])
      previous.set(edge.to, { from: node, line: edge.line })
    }
  }
  return { settled, previous }
}

export function projectDay(state) {
  const stations = new Map(state.stations.map((s) => [s.id, s]))
  const results = Object.create(null)
  const activeStops = new Set()
  const operating = state.lines.filter(l => active(l,state.day))
  let expense = state.depots.length * 0.28
  for (const line of operating) {
    const schedule = service(line, stations)
    results[line.id] = { ...schedule, boards: 0, served:0, bySlice: [], capacity:0 }
    expense += schedule.expense
    line.stops.forEach(id => activeStops.add(id))
  }
  const districts = availableDistricts(state.city,state.day).map(([name, x, y, weight, kind]) => {
    const position = [x, y]
    let stop = null
    let walk = WALK_RADIUS
    for (const id of activeStops) {
      const km = distance(position, stations.get(id).position)
      if (km <= walk) {
        stop = id
        walk = km
      }
    }
    return { name, position, kind, weight:weight*(state.growth?.[name]??1), stop, walk }
  })
  const coverage = Math.round(100 * districts.filter((d) => d.stop).reduce((sum, d) => sum + d.weight, 0)
    / districts.reduce((sum, d) => sum + d.weight, 0))
  let riders = 0
  let demand = 0
  let travel = 0
  const stops = Object.fromEntries([...activeStops].map(id => [id,0]))
  const bySlice = []
  const curve = HOURS.map(h => h>=7&&h<10 ? 1.8 : h>=16&&h<19 ? 1.7 : h>=20 ? .35 : .9)
  const sum = curve.reduce((a,b)=>a+b,0)
  const fare = state.fare ?? DEFAULT_FARE
  const elasticity = (DEFAULT_FARE / Math.max(10,fare)) ** .38
  // Reuse route searches across hours with identical traffic/schedule profiles.
  const profiles = new Map()
  const servedDistricts = districts.filter(d => d.stop)
  for (const [i,hour] of HOURS.entries()) {
    const peak = hour>=7&&hour<10 || hour>=16&&hour<19
    const key = peak ? 'peak' : 'normal'
    const schedules = new Map(operating.map(l=>[l.id,service(l,stations,hour)]))
    if (!profiles.has(key)) {
      const graph = new Map(), cache = new Map(), pairs = []
      const join = (from,to,cost,line) => { if(!graph.has(from)) graph.set(from,[]); graph.get(from).push({to,cost,line}) }
      for (const l of operating) {
        const schedule = schedules.get(l.id)
        for (const [index,id] of l.stops.entries()) {
          const node = `${l.id}:${id}`
          join(id,node,schedule.interval/2,l.id); join(node,id,2.5)
          if (!index) continue
          const prev = l.stops[index-1]
          const cost = distance(stations.get(id).position,stations.get(prev).position)/ (modes[l.mode].speed*vehicleModels[l.model??'standard'].speed)*60*schedule.traffic+.55
          join(node,`${l.id}:${prev}`,cost); join(`${l.id}:${prev}`,node,cost)
        }
      }
      for (const [index,a] of servedDistricts.entries()) {
        if (!cache.has(a.stop)) cache.set(a.stop,routes(graph,a.stop))
        const {settled,previous}=cache.get(a.stop)
        for(const b of servedDistricts.slice(index+1)) {
          if(a.stop===b.stop || !settled.has(b.stop)) continue
          const used=new Set()
          for(let node=b.stop;node!==a.stop;) { const edge=previous.get(node); if(edge.line) used.add(edge.line); node=edge.from }
          const minutes=settled.get(b.stop)+(a.walk+b.walk)*12
          const base=a.weight*b.weight*155/(1+minutes/34)*elasticity*cities[state.city].demandScale
          pairs.push({a,b,used:[...used],minutes,base})
        }
      }
      profiles.set(key,pairs)
    }
    const loads = new Map(operating.map(l=>[l.id,0]))
    const trips = profiles.get(key).map(pair=>{
      const weekend=(state.day-1)%7>=5
      const factor = (d) => d.kind==='school' ? (weekend?.45:hour<10||hour>=14&&hour<17?1.18:.8) : d.kind==='mall' ? (hour>=12&&hour<21?(weekend?1.45:1.15):.75) : d.kind==='work'&&weekend?.75:1
      const requested = pair.base*curve[i]/sum*(factor(pair.a)+factor(pair.b))/2
      for(const id of pair.used) loads.set(id,loads.get(id)+requested)
      return {...pair,requested}
    })
    let sliceRiders=0, sliceDemand=0, towardsWork=0, towardsHome=0
    const carried=new Map(operating.map(l=>[l.id,0]))
    for(const trip of trips) {
      const share=Math.min(1,...trip.used.map(id=>schedules.get(id).capacity/loads.get(id)))
      const count=trip.requested*(Number.isFinite(share)?share:0)
      sliceRiders+=count; sliceDemand+=trip.requested; travel+=count*trip.minutes
      const homeA=trip.a.kind==='home', homeB=trip.b.kind==='home'
      const direction=homeA!==homeB ? (hour<10?.8:hour>=16?.2:.5) : .5
      const aBoard=count*(homeA?direction:homeB?1-direction:.5)
      stops[trip.a.stop]+=aBoard; stops[trip.b.stop]+=count-aBoard
      if(homeA!==homeB){towardsWork+=count*direction;towardsHome+=count*(1-direction)}
      for(const id of trip.used) carried.set(id,carried.get(id)+count)
    }
    riders+=sliceRiders; demand+=sliceDemand
    bySlice.push({hour,riders:sliceRiders,demand:sliceDemand,towardsWork,towardsHome})
    for(const l of operating){
      const r=results[l.id], s=schedules.get(l.id), boards=loads.get(l.id), served=carried.get(l.id)
      r.boards+=boards; r.capacity+=s.capacity; r.served+=served
      r.bySlice.push({hour,boards,capacity:s.capacity,served,interval:s.interval})
    }
  }
  riders=Math.round(riders); demand=Math.round(demand)
  const retailIncome=state.stations.filter(s=>s.shop && activeStops.has(s.id)).reduce((sum,s)=>sum+.035+(stops[s.id]??0)*.000003,0)
  return {
    riders, demand, coverage, expense, results, stops, districts, bySlice,
    income: riders * fare / 1e6, retailIncome,
    rating: demand ? Math.round(100 * (riders / demand) * Math.max(0.4, 1 - travel / Math.max(1, riders) / 135)) : null,
  }
}

export function rewardGoals(state, projection) {
  const awarded = goals.filter((goal) => !state.goals.includes(goal.id) && goal.check(state, projection))
  for (const goal of awarded) {
    state.goals.push(goal.id)
    state.cash += goal.reward
  }
  return awarded
}

export function finishDay(state, projection) {
  const revenue=projection.income+(projection.retailIncome??0)
  const payment = Math.min(30, state.loan, Math.max(0, state.cash + revenue - projection.expense + 12))
  state.loan -= payment
  state.cash += 12 + revenue - projection.expense - payment
  state.record = Math.max(state.record, projection.riders)
  state.history.push({ day: state.day, riders: projection.riders, cash: state.cash })
  state.history = state.history.slice(-14)
  state.day += 1
  state.minute = 360
  if ((state.day-1)%30===0) {
    for (const d of projection.districts ?? []) state.growth[d.name] = Math.min(5, (state.growth[d.name]??1)*(d.stop?1.04:1.02))
  }
}

const number = (value, minimum, maximum) => Number.isFinite(value) && value >= minimum && value <= maximum
const integer = (value, minimum, maximum) => Number.isInteger(value) && number(value, minimum, maximum)
const label = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit
const id = (value) => typeof value === 'string' && /^[\w-]{1,48}$/.test(value)
const list = (value, limit) => Array.isArray(value) && value.length <= limit
const unique = (values) => new Set(values).size === values.length

export function parseSave(json) {
  const s = migrate(JSON.parse(json))
  if (!s || s.version !== 2 || !Object.hasOwn(cities, s.city) || !integer(s.day, 1, 1e8)
    || !number(s.minute, 360, 1439.9999999) || !number(s.cash, -1e15, 1e15)
    || !number(s.loan, 0, LOAN_TOTAL) || !integer(s.record, 0, 1e9)
    || !list(s.stations, 2000) || !list(s.lines, 100) || !list(s.depots, 100)
    || !list(s.goals, goals.length) || !list(s.history, 14) || !integer(s.fare,10,300)
    || !s.settings || !['auto','light','dark'].includes(s.settings.theme) || typeof s.settings.accessible!=='boolean'
    || !s.growth || typeof s.growth!=='object' || Array.isArray(s.growth) || !Object.entries(s.growth).every(([k,v])=>cities[s.city].districts.some(d=>d[0]===k)&&number(v,1,5))) throw new Error('Kayıt biçimi geçersiz.')
  const [west, south, east, north] = cities[s.city].bounds
  const validPoint = (point) => point && id(point.id) && label(point.name, 48)
    && list(point.position, 2) && number(point.position[0], west, east) && number(point.position[1], south, north)
  const stopIds = new Set(s.stations.map((p) => p?.id))
  if (!s.stations.every(p=>validPoint(p)&&(p.shop===undefined||typeof p.shop==='boolean')) || stopIds.size !== s.stations.length
    || !s.depots.every(validPoint) || !unique(s.depots.map((p) => p.id))
    || !s.lines.every((l) => l && id(l.id) && label(l.name, 32) && Object.hasOwn(modes, l.mode)
      && colors.includes(l.color) && integer(l.number, 1, 1e7) && integer(l.readyAt, 1, 1e8 + 1000)
      && integer(l.depth, 0, 60) && integer(l.fleet, 0, 40) && integer(l.headway, 2, 30) && integer(l.peakHeadway,2,30) && Object.hasOwn(vehicleModels,l.model)
      && list(l.stops, modes[l.mode].maxStops ?? 24) && l.stops.length >= 2 && unique(l.stops)
      && l.stops.every((key) => stopIds.has(key)))
    || !unique(s.lines.map((l) => l.id)) || !unique(s.lines.map((l) => l.number))
    || !unique(s.goals) || !s.goals.every((key) => goals.some((g) => g.id === key))
    || !s.history.every((d) => d && integer(d.day, 1, s.day) && integer(d.riders, 0, 1e9) && number(d.cash, -1e15, 1e15))) {
    throw new Error('Kayıt verileri doğrulanamadı.')
  }
  const byId = new Map(s.stations.map((station) => [station.id, station]))
  if (s.lines.some((line) => line.stops.slice(1).some((stop, index) =>
    distance(byId.get(stop).position, byId.get(line.stops[index]).position) < modes[line.mode].spacing))) {
    throw new Error('Kayıttaki durak aralıkları geçersiz.')
  }
  return s
}
