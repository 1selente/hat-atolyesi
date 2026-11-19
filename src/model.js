import { availableDistricts, cities, colors, goals, modes, vehicleModels } from './cities.js'
import {newConstruction,validUnitDetails,validCompanyDetails,complaintsFor} from './detail.js'
import {actualFare,companyDefaults,companyExpenses,companyOf,companyRevenue,edgePairs,eventFactor,gameCity,lineComfort,lineKilometres,lineOperating,passengerCompetition,pointDistricts,profile,recordTransaction,seasonalFactor,segmentTime,serviceStopIds,serviceConstraints,settleCompany,sharedSegments,stationAccess,stationCapacity,validCompany,validCustomCity,validDepot,validFacility,validOperations} from './advanced.js'

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
    version: 3, city, day: 1, minute: 360, cash: 12000, loan: 0,
    stations: [], lines: [], depots: [], goals: [], record: 0, history: [],
    fare: DEFAULT_FARE, growth: {}, settings: { theme: 'auto', accessible: false },
    company: companyDefaults(),
  }
}

export function migrate(save) {
  if (save?.version === 1) save={ ...save, version: 2, fare: DEFAULT_FARE, growth: {}, settings: {theme:'auto', accessible:false},
    lines: Array.isArray(save.lines) ? save.lines.map(l => ({ ...l, model:'standard', peakHeadway: l?.headway })) : save.lines }
  if(save?.version===2) return {...save,version:3,company:save.company??companyDefaults()}
  return save
}

export function vehiclePrice(line) { return Math.ceil(modes[line.mode].vehicle * vehicleModels[line.model ?? 'standard'].cost * (['metro','tram','suburban','funicular'].includes(line.mode)?profile(line).vagons/4:1)) }

export function active(line, day) {
  return lineOperating(line, day)
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
  const existingEdges=sharedSegments(state.lines)
  const sharedKm=stops.slice(1).reduce((n,b,i)=>{const a=stops[i];return n+(a.id&&b.id&&existingEdges.has(`${mode}:${[a.id,b.id].sort().join('|')}`)?distance(a.position,b.position):0)},0)
  plan.cost=Math.max(0,Math.ceil((plan.cost-sharedKm*modes[mode].rail*.6)*companyOf(state).market))
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
      color: colors[(number - 1) % colors.length], operations:{...profile(null),started:state.day,originalReady:state.day+plan.days},
    }
    state.lines.push(extension)
  }
  extension.construction=newConstruction(state.day,plan.days,plan.cost)
  state.cash -= plan.cost
  recordTransaction(state,'Hat inşaatı',-plan.cost,extension.name)
  return extension
}

export function service(line, stations, hour, state, shared) {
  const mode = modes[line.mode]
  const model = vehicleModels[line.model ?? 'standard']
  const stops = line.stops.map((id) => stations.get(id))
  const km = lineKilometres(line,stations),p=profile(line)
  const constraints=serviceConstraints(line,state,hour,shared),traffic=constraints.traffic
  const servedStops=serviceStopIds(line)
  const roundTrip = (p.ring?1:2) * (edgePairs(line).reduce((n,[a,b])=>n+segmentTime(line,a,b,stations,mode.speed*model.speed,traffic),0) + (servedStops.length - 1) * 0.55) + 4
  const interval = Math.max(constraints.target||30,constraints.minimum,roundTrip / Math.max(1,constraints.available))
  const capacity = constraints.enabled&&constraints.available>0?(hour === undefined ? Math.floor(DAY_MINUTES / interval) : 60 / interval) * Math.round(mode.seats * model.capacity*constraints.capacityFactor) * (p.ring&&p.oneway?1:2):0
  return {
    km, interval, traffic, available:constraints.available, servedStops,
    capacity,
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
  const company=companyOf(state),shared=sharedSegments(operating)
  let expense = state.depots.length * 0.28
  for (const line of operating) {
    const schedule = service(line, stations,undefined,state,shared)
    results[line.id] = { ...schedule, boards: 0, served:0, bySlice: [], capacity:0 }
    expense += schedule.expense
    if(HOURS.some(h=>{const check=serviceConstraints(line,state,h,shared);return check.enabled&&check.available>0}))schedule.servedStops.forEach(id => activeStops.add(id))
  }
  const districts = pointDistricts(state).map(([name, x, y, weight, kind]) => {
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
    / Math.max(1,districts.reduce((sum, d) => sum + d.weight, 0)))
  let riders = 0
  let demand = 0
  let travel = 0
  let fareRevenue=0,transfers=0,alternative=0
  const flowMap=new Map(),passengerGroups={worker:0,student:0,tourist:0,senior:0,shopping:0,other:0}
  const stops = Object.fromEntries([...activeStops].map(id => [id,0]))
  const bySlice = []
  const curve = HOURS.map(h => h>=7&&h<10 ? 1.8 : h>=16&&h<19 ? 1.7 : h>=20 ? .35 : .9)
  const sum = curve.reduce((a,b)=>a+b,0)
  const fare = state.fare ?? DEFAULT_FARE
  const elasticity = (DEFAULT_FARE / Math.max(10,fare)) ** .38
  // Reuse route searches across hours with identical traffic/schedule profiles.
  const profiles = new Map()
  const servedDistricts = districts.filter(d => d.stop)
  const directional=operating.some(l=>profile(l).ring&&profile(l).oneway)
  for (const [i,hour] of HOURS.entries()) {
    const peak = hour>=7&&hour<10 || hour>=16&&hour<19
    const schedules = new Map(operating.map(l=>[l.id,service(l,stations,hour,state,shared)]))
    const key = operating.map(l=>`${schedules.get(l.id).interval}:${schedules.get(l.id).capacity>0}:${schedules.get(l.id).traffic}`).join(',')
    if (!profiles.has(key)) {
      const graph = new Map(), cache = new Map(), pairs = []
      const join = (from,to,cost,line) => { if(!graph.has(from)) graph.set(from,[]); graph.get(from).push({to,cost,line}) }
      for (const l of operating) {
        const schedule = schedules.get(l.id)
        if(!schedule.capacity)continue
        const p=profile(l), served=schedule.servedStops
        for (const [index,id] of served.entries()) {
          const node = `${l.id}:${id}`
          join(id,node,schedule.interval/2*(company.realism?lineComfort(l):1),l.id); join(node,id,stationAccess(stations.get(id)))
          if (!index) continue
          const prev = served[index-1],a=l.stops.indexOf(prev),b=l.stops.indexOf(id)
          const cost = l.stops.slice(a+1,b+1).reduce((n,s,i)=>n+segmentTime(l,l.stops[a+i],s,stations,modes[l.mode].speed*vehicleModels[l.model??'standard'].speed,schedule.traffic),0)+.55
          if(!p.ring||!p.oneway)join(node,`${l.id}:${prev}`,cost); join(`${l.id}:${prev}`,node,cost)
        }
        if(p.ring&&served.length>=2){const a=served.at(-1),b=served[0],start=l.stops.indexOf(a),end=l.stops.indexOf(b),ids=[...l.stops.slice(start),...l.stops.slice(0,end+1)],cost=ids.slice(1).reduce((n,id,i)=>n+segmentTime(l,ids[i],id,stations,modes[l.mode].speed*vehicleModels[l.model??'standard'].speed,schedule.traffic),0)+.55;join(`${l.id}:${a}`,`${l.id}:${b}`,cost);if(!p.oneway)join(`${l.id}:${b}`,`${l.id}:${a}`,cost)}
      }
      for (const [index,a] of servedDistricts.entries()) {
        if (!cache.has(a.stop)) cache.set(a.stop,routes(graph,a.stop))
        const {settled,previous}=cache.get(a.stop)
        for(const b of directional?servedDistricts:servedDistricts.slice(index+1)) {
          if(a.stop===b.stop || !settled.has(b.stop)) continue
          const used=new Set()
          for(let node=b.stop;node!==a.stop;) { const edge=previous.get(node); if(edge.line) used.add(edge.line); node=edge.from }
          const minutes=settled.get(b.stop)+(a.walk+b.walk)*12
          const km=distance(a.position,b.position),transferCount=Math.max(0,used.size-1),mode=state.lines.find(l=>l.id===[...used][0])?.mode
          const tripFare=actualFare(state,{km,transfers:transferCount,mode,kind:a.kind==='school'||b.kind==='school'?'school':a.kind})
          const potential=a.weight*b.weight*155/(1+(minutes+(company.realism?transferCount*4:0))/34)*((DEFAULT_FARE/Math.max(10,tripFare))**.38)*gameCity(state).demandScale*(directional?.5:1)
          const competition=passengerCompetition(state,minutes,km,[a.kind,b.kind]);const base=potential*competition
          pairs.push({a,b,used:[...used],minutes,base,alternative:potential-base,tripFare,transferCount,km})
        }
      }
      profiles.set(key,pairs)
    }
    const loads = new Map(operating.map(l=>[l.id,0]))
    const trips = profiles.get(key).map(pair=>{
      const weekend=(state.day-1)%7>=5
      const factor = (d) => d.kind==='school' ? (weekend?.45:hour<10||hour>=14&&hour<17?1.18:.8) : d.kind==='mall' ? (hour>=12&&hour<21?(weekend?1.45:1.15):.75) : d.kind==='work'&&weekend?.75:1
      const modifiers=(factor(pair.a)*seasonalFactor(state,pair.a.kind,hour)*eventFactor(state,pair.a.name,hour)+factor(pair.b)*seasonalFactor(state,pair.b.kind,hour)*eventFactor(state,pair.b.name,hour))/2
      const requested = pair.base*curve[i]/sum*modifiers
      alternative+=pair.alternative*curve[i]/sum*modifiers
      for(const id of pair.used) loads.set(id,loads.get(id)+requested)
      return {...pair,requested}
    })
    let sliceRiders=0, sliceDemand=0, towardsWork=0, towardsHome=0
    const carried=new Map(operating.map(l=>[l.id,0]))
    const stationLoads=new Map();if(company.realism)for(const trip of trips)for(const stop of [trip.a.stop,trip.b.stop])stationLoads.set(stop,(stationLoads.get(stop)??0)+trip.requested)
    for(const trip of trips) {
      const ratios=company.realism?[trip.a.stop,trip.b.stop].map(id=>stationCapacity(stations.get(id))*Math.max(.6,Math.min(1,company.staff.station*4/Math.max(1,activeStops.size)))/18/Math.max(1,stationLoads.get(id))):[]
      const share=Math.min(1,...ratios,...trip.used.map(id=>schedules.get(id).capacity/loads.get(id)))
      const count=trip.requested*(Number.isFinite(share)?share:0)
      sliceRiders+=count; sliceDemand+=trip.requested; travel+=count*trip.minutes
      fareRevenue+=count*trip.tripFare/1e6;transfers+=count*trip.transferCount
      const kind=trip.a.kind==='school'||trip.b.kind==='school'?'student':trip.a.kind==='airport'||trip.b.kind==='airport'?'tourist':trip.a.kind==='mall'||trip.b.kind==='mall'?'shopping':trip.a.kind==='work'||trip.b.kind==='work'?'worker':'other'
      passengerGroups[kind]+=count*.92;passengerGroups.senior+=count*.08
      const key=`${trip.a.name}|${trip.b.name}`,old=flowMap.get(key)??{from:trip.a.name,to:trip.b.name,fromPosition:trip.a.position,toPosition:trip.b.position,demand:0,riders:0};old.demand+=trip.requested;old.riders+=count;flowMap.set(key,old)
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
      r.bySlice.push({hour,boards,capacity:s.capacity,served,interval:s.interval,available:s.available})
    }
  }
  riders=Math.round(riders); demand=Math.round(demand)
  const retailIncome=state.stations.filter(s=>s.shop && activeStops.has(s.id)).reduce((sum,s)=>sum+.035+(stops[s.id]??0)*.000003,0)
  const breakdown=companyExpenses(state,expense,operating,stations)
  const result={
    riders, demand, coverage, expense:breakdown.total, results, stops, districts, bySlice,breakdown,
    income:company.tariff==='flat'&&!company.discount&&!company.pass&&company.policy!=='student'?riders * fare / 1e6:fareRevenue, retailIncome,
    averageTravel:riders?travel/riders:0,transfers:Math.round(transfers),alternative:Math.round(alternative),passengerGroups,flows:[...flowMap.values()].sort((a,b)=>b.demand-a.demand).slice(0,100),
    rating: demand ? Math.round(100 * (riders / demand) * Math.max(0.4, 1 - travel / Math.max(1, riders) / 135)) : null,
  }
  return {...result,...companyRevenue(state,result),complaints:complaintsFor(state,result)}
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
  const revenue=projection.income+(projection.retailIncome??0)+(projection.advertising??0)
  const subsidy=projection.subsidy??12
  const payment = Math.min(30, state.loan, Math.max(0, state.cash + revenue - projection.expense + subsidy))
  state.loan -= payment
  state.cash += subsidy + revenue - projection.expense - payment
  state.record = Math.max(state.record, projection.riders)
  settleCompany(state,projection,payment)
  state.history.push({ day: state.day, riders: projection.riders, cash: state.cash })
  state.history = state.history.slice(-14)
  state.day += 1
  state.minute = 360
  if ((state.day-1)%30===0) {
    for (const d of projection.districts ?? []) state.growth[d.name] = Math.min(5, (state.growth[d.name]??1)*(d.stop?1.04+(companyOf(state).realism?Math.min(.03,(projection.stops[d.stop]??0)/1e6):0):1.02))
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
  if (!s || s.version !== 3 || !Object.hasOwn(cities, s.city) || !integer(s.day, 1, 1e8)
    || !number(s.minute, 360, 1439.9999999) || !number(s.cash, -1e15, 1e15)
    || !number(s.loan, 0, LOAN_TOTAL) || !integer(s.record, 0, 1e9)
    || !list(s.stations, 2000) || !list(s.lines, 100) || !list(s.depots, 100)
    || !list(s.goals, goals.length) || !list(s.history, 14) || !integer(s.fare,10,300)
    || !s.settings || !['auto','light','dark'].includes(s.settings.theme) || typeof s.settings.accessible!=='boolean'
    || !s.growth || typeof s.growth!=='object' || Array.isArray(s.growth) || !Object.entries(s.growth).every(([k,v])=>(cities[s.city].districts.some(d=>d[0]===k)||s.company?.customDistricts?.some(d=>d.name===k))&&number(v,1,5))) throw new Error('Kayıt biçimi geçersiz.')
  if(!validCustomCity(s.company?.customCity??null))throw new Error('Özel şehir geçersiz.')
  const [west, south, east, north] = gameCity(s).bounds
  const validPoint = (point) => point && id(point.id) && label(point.name, 48)
    && list(point.position, 2) && number(point.position[0], west, east) && number(point.position[1], south, north)
  const stopIds = new Set(s.stations.map((p) => p?.id))
  if (!s.stations.every(p=>validPoint(p)&&(p.shop===undefined||typeof p.shop==='boolean')&&validFacility(p)) || stopIds.size !== s.stations.length
    || !s.depots.every(d=>validPoint(d)&&validDepot(d)) || !unique(s.depots.map((p) => p.id))
    || !s.lines.every((l) => l && id(l.id) && label(l.name, 32) && Object.hasOwn(modes, l.mode)
      && colors.includes(l.color) && integer(l.number, 1, 1e7) && integer(l.readyAt, 1, 1e8 + 1000)
      && integer(l.depth, 0, 60) && integer(l.fleet, 0, 40) && integer(l.headway, 2, 30) && integer(l.peakHeadway,2,30) && Object.hasOwn(vehicleModels,l.model)
      && list(l.stops, modes[l.mode].maxStops ?? 24) && l.stops.length >= 2 && unique(l.stops)
      && l.stops.every((key) => stopIds.has(key)) && (!l.operations||validOperations(profile(l),s,l)) && validUnitDetails(l,s.day))
    || !unique(s.lines.map((l) => l.id)) || !unique(s.lines.map((l) => l.number))
    || !unique(s.goals) || !s.goals.every((key) => goals.some((g) => g.id === key))
    || !s.history.every((d) => d && integer(d.day, 1, s.day) && integer(d.riders, 0, 1e9) && number(d.cash, -1e15, 1e15))) {
    throw new Error('Kayıt verileri doğrulanamadı.')
  }
  if(!validCompany(s.company,s)||!validCompanyDetails(s.company,s.day))throw new Error('Şirket verileri doğrulanamadı.')
  const byId = new Map(s.stations.map((station) => [station.id, station]))
  if (s.lines.some((line) => line.stops.slice(1).some((stop, index) =>
    distance(byId.get(stop).position, byId.get(line.stops[index]).position) < modes[line.mode].spacing))) {
    throw new Error('Kayıttaki durak aralıkları geçersiz.')
  }
  return s
}
