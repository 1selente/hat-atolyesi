import { cities, colors, goals, modes } from './cities.js'

export const DEPOT_COST = 340
export const LOAN = 2000
export const LOAN_TOTAL = 2440
export const DAY_MINUTES = 18 * 60
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
    version: 1, city, day: 1, minute: 360, cash: 12000, loan: 0,
    stations: [], lines: [], depots: [], goals: [], record: 0, history: [],
  }
}

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
      stops: stopIds, readyAt: state.day + plan.days, fleet: 0, headway: 6,
      color: colors[(number - 1) % colors.length],
    }
    state.lines.push(extension)
  }
  state.cash -= plan.cost
  return extension
}

export function service(line, stations) {
  const mode = modes[line.mode]
  const stops = line.stops.map((id) => stations.get(id))
  const km = lengthOf(stops)
  const roundTrip = 2 * (km / mode.speed * 60 + (stops.length - 1) * 0.55) + 4
  const interval = Math.max(line.headway, roundTrip / Math.max(1, line.fleet))
  return {
    km, interval,
    capacity: Math.floor(DAY_MINUTES / interval) * mode.seats * 2,
    expense: line.fleet * mode.operating + km * 0.07,
  }
}

function routes(graph, origin) {
  const pending = new Map([[origin, 0]])
  const settled = new Map()
  const previous = new Map()
  while (pending.size) {
    const [node, cost] = [...pending].reduce((a, b) => a[1] <= b[1] ? a : b)
    pending.delete(node)
    settled.set(node, cost)
    for (const edge of graph.get(node) ?? []) {
      if (settled.has(edge.to) || cost + edge.cost >= (pending.get(edge.to) ?? Infinity)) continue
      pending.set(edge.to, cost + edge.cost)
      previous.set(edge.to, { from: node, line: edge.line })
    }
  }
  return { settled, previous }
}

export function projectDay(state) {
  const stations = new Map(state.stations.map((s) => [s.id, s]))
  const results = Object.create(null)
  const graph = new Map()
  const activeStops = new Set()
  const join = (from, to, cost, line) => {
    const edges = graph.get(from) ?? []
    edges.push({ to, cost, line })
    graph.set(from, edges)
  }

  let expense = state.depots.length * 0.28
  for (const line of state.lines.filter((l) => active(l, state.day))) {
    const schedule = service(line, stations)
    results[line.id] = { ...schedule, boards: 0 }
    expense += schedule.expense
    for (const [index, id] of line.stops.entries()) {
      activeStops.add(id)
      const node = `${line.id}:${id}`
      join(id, node, schedule.interval / 2, line.id)
      join(node, id, 2.5)
      if (!index) continue
      const before = line.stops[index - 1]
      const cost = distance(stations.get(id).position, stations.get(before).position) / modes[line.mode].speed * 60 + 0.55
      join(node, `${line.id}:${before}`, cost)
      join(`${line.id}:${before}`, node, cost)
    }
  }

  const districts = cities[state.city].districts.map(([name, x, y, weight]) => {
    const position = [x, y]
    let stop = null
    let walk = 1.15
    for (const id of activeStops) {
      const km = distance(position, stations.get(id).position)
      if (km < walk) {
        stop = id
        walk = km
      }
    }
    return { name, weight, stop, walk }
  })
  const coverage = Math.round(100 * districts.filter((d) => d.stop).reduce((sum, d) => sum + d.weight, 0)
    / districts.reduce((sum, d) => sum + d.weight, 0))
  const cohorts = []
  for (const [i, a] of districts.entries()) {
    if (!a.stop) continue
    const { settled, previous } = routes(graph, a.stop)
    for (const b of districts.slice(i + 1)) {
      if (!b.stop || a.stop === b.stop || !settled.has(b.stop)) continue
      const used = new Set()
      for (let node = b.stop; node !== a.stop;) {
        const edge = previous.get(node)
        if (edge.line) used.add(edge.line)
        node = edge.from
      }
      const minutes = settled.get(b.stop) + (a.walk + b.walk) * 12
      const demand = Math.round(a.weight * b.weight * 155 / (1 + minutes / 34))
      cohorts.push({ used, demand, minutes })
      for (const id of used) results[id].boards += demand
    }
  }

  let riders = 0
  let demand = 0
  let travel = 0
  for (const trip of cohorts) {
    const share = Math.min(1, ...[...trip.used].map((id) => results[id].capacity / results[id].boards))
    const served = Math.floor(trip.demand * share)
    riders += served
    demand += trip.demand
    travel += served * trip.minutes
  }
  return {
    riders, demand, coverage, expense, results,
    income: riders * 0.00016,
    rating: demand ? Math.round(100 * (riders / demand) * Math.max(0.4, 1 - travel / Math.max(1, riders) / 135)) : null,
  }
}

export function rewardGoals(state) {
  const awarded = goals.filter((goal) => !state.goals.includes(goal.id) && goal.check(state))
  for (const goal of awarded) {
    state.goals.push(goal.id)
    state.cash += goal.reward
  }
  return awarded
}

export function finishDay(state, projection) {
  const payment = Math.min(30, state.loan, Math.max(0, state.cash + projection.income - projection.expense + 12))
  state.loan -= payment
  state.cash += 12 + projection.income - projection.expense - payment
  state.record = Math.max(state.record, projection.riders)
  state.history.push({ day: state.day, riders: projection.riders, cash: state.cash })
  state.history = state.history.slice(-14)
  state.day += 1
  state.minute = 360
}

const number = (value, minimum, maximum) => Number.isFinite(value) && value >= minimum && value <= maximum
const integer = (value, minimum, maximum) => Number.isInteger(value) && number(value, minimum, maximum)
const label = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit
const id = (value) => typeof value === 'string' && /^[\w-]{1,48}$/.test(value)
const list = (value, limit) => Array.isArray(value) && value.length <= limit
const unique = (values) => new Set(values).size === values.length

export function parseSave(json) {
  const s = JSON.parse(json)
  if (!s || s.version !== 1 || !Object.hasOwn(cities, s.city) || !integer(s.day, 1, 1e8)
    || !number(s.minute, 360, 1439.9999999) || !number(s.cash, -1e15, 1e15)
    || !number(s.loan, 0, LOAN_TOTAL) || !integer(s.record, 0, 1e9)
    || !list(s.stations, 2000) || !list(s.lines, 100) || !list(s.depots, 100)
    || !list(s.goals, goals.length) || !list(s.history, 14)) throw new Error('Kayıt biçimi geçersiz.')
  const [west, south, east, north] = cities[s.city].bounds
  const validPoint = (point) => point && id(point.id) && label(point.name, 48)
    && list(point.position, 2) && number(point.position[0], west, east) && number(point.position[1], south, north)
  const stopIds = new Set(s.stations.map((p) => p?.id))
  if (!s.stations.every(validPoint) || stopIds.size !== s.stations.length
    || !s.depots.every(validPoint) || !unique(s.depots.map((p) => p.id))
    || !s.lines.every((l) => l && id(l.id) && label(l.name, 32) && Object.hasOwn(modes, l.mode)
      && colors.includes(l.color) && integer(l.number, 1, 1e7) && integer(l.readyAt, 1, 1e8 + 1000)
      && integer(l.depth, 0, 60) && integer(l.fleet, 0, 40) && integer(l.headway, 2, 30)
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
