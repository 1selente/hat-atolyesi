import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildLine, finishDay, newGame, parseSave, projectDay, rewardGoals } from '../src/model.js'

const taksim = { name: 'Taksim', position: [28.985, 41.037] }
const besiktas = { name: 'Beşiktaş', position: [29.006, 41.043] }
const uskudar = { name: 'Üsküdar', position: [29.016, 41.025] }

test('construction, vehicles, and settlement govern opening and cash', () => {
  const state = newGame('istanbul')
  const line = buildLine(state, [taksim, besiktas], 'metro', 20)
  assert.ok(state.cash < 12000)
  line.fleet = 1
  assert.equal(projectDay(state).riders, 0)
  while (state.day < line.readyAt) finishDay(state, projectDay(state))
  const schedule = projectDay(state)
  assert.ok(schedule.riders > 0)
  assert.ok(schedule.results[line.id].interval >= line.headway)
  assert.ok(rewardGoals(state).some((goal) => goal.id === 'first'))
  assert.equal(rewardGoals(state).length, 0)
  finishDay(state, schedule)
  assert.equal(state.history.at(-1).riders, schedule.riders)
  assert.deepEqual(parseSave(JSON.stringify(state)), state)
})

test('connecting lines through an existing station unlocks transfer demand', () => {
  const state = newGame('istanbul')
  const first = buildLine(state, [taksim, besiktas], 'metro', 20)
  const second = buildLine(state, [state.stations[1], uskudar], 'tram', 10)
  first.fleet = 2
  second.fleet = 2
  state.day = Math.max(first.readyAt, second.readyAt)
  const connected = projectDay(state)
  assert.equal(state.stations.length, 3)
  assert.ok(connected.results[second.id].boards > 0)
  assert.ok(connected.riders > 0)
  assert.ok(rewardGoals(state).some((goal) => goal.id === 'junction'))
  second.fleet = 0
  assert.ok(projectDay(state).riders < connected.riders)
})

test('invalid or dangling station references are rejected on import', () => {
  const state = newGame('istanbul')
  buildLine(state, [taksim, besiktas], 'metro', 20)
  state.stations.pop()
  assert.throws(() => parseSave(JSON.stringify(state)), /doğrulanamadı/)
})
