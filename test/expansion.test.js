import {test} from 'node:test'
import assert from 'node:assert/strict'
import {Worker} from 'node:worker_threads'
import {cities,corridors,modes} from '../src/cities.js'
import {buildLine,distance,finishDay,newGame,parseSave,projectDay,rewardGoals,service,vehiclePrice,DEFAULT_FARE} from '../src/model.js'

function network(mode='metro') {
  const state=newGame('istanbul')
  const line=buildLine(state,[{name:'Taksim',position:[28.985,41.037]},{name:'Levent',position:[29.015,41.080]}],mode,20)
  line.fleet=3;state.day=line.readyAt;return {state,line}
}

test('old v1 records migrate without losing city, station, line or history data',()=>{
  const {state}=network()
  const old=structuredClone(state);old.version=1;delete old.growth;delete old.fare;delete old.settings
  for(const l of old.lines){delete l.model;delete l.peakHeadway}
  assert.deepEqual(parseSave(JSON.stringify(old)),state)
  assert.equal(state.fare,DEFAULT_FARE)
})

test('hourly demand peaks; totals and station boardings reconcile',()=>{
  const {state,line}=network();const p=projectDay(state);const slices=p.results[line.id].bySlice
  assert.equal(slices.length,18)
  assert.ok(slices.find(s=>s.hour===8).boards>slices.find(s=>s.hour===12).boards)
  assert.ok(Math.abs(p.riders-p.bySlice.reduce((n,s)=>n+s.riders,0))<=.5)
  assert.ok(Math.abs(p.riders-Object.values(p.stops).reduce((a,b)=>a+b,0))<=.5)
  assert.ok(Math.abs(p.results[line.id].boards-slices.reduce((n,s)=>n+s.boards,0))<.001)
  assert.ok(slices.every(s=>s.served<=s.capacity+.001))
})

test('uncongested two-station metro preserves the original daily demand within one percent',()=>{
  const state=newGame('istanbul');const a={name:'Taksim',position:[28.985,41.037]},b={name:'Beşiktaş',position:[29.006,41.043]};const line=buildLine(state,[a,b],'metro',20)
  line.fleet=5;state.day=line.readyAt
  const {interval}=service(line,new Map(state.stations.map(s=>[s.id,s])))
  const oldMinutes=interval/2+distance(a.position,b.position)/58*60+.55+2.5
  const oldDemand=Math.round(9*7*155/(1+oldMinutes/34))
  assert.ok(Math.abs(projectDay(state).riders-oldDemand)/oldDemand<.01)
})

test('fares affect demand and revenue; vehicle models affect capacity and cost',()=>{
  const {state,line}=network();const base=projectDay(state);state.fare=300;const expensive=projectDay(state)
  assert.ok(expensive.demand<base.demand);assert.equal(expensive.income,expensive.riders*300/1e6)
  const stations=new Map(state.stations.map(s=>[s.id,s]));const standard=service(line,stations);const price=vehiclePrice(line)
  line.model='high';assert.ok(service(line,stations).capacity>standard.capacity);assert.ok(vehiclePrice(line)>price)
})

test('road traffic affects peak schedules, rail does not',()=>{
  const {state,line}=network('localbus');const stations=new Map(state.stations.map(s=>[s.id,s]));line.fleet=1
  assert.ok(service(line,stations,8).interval>service(line,stations,12).interval)
  line.mode='metro';assert.equal(service(line,stations,8).interval,service(line,stations,12).interval)
})

test('city grows faster around operating stations and saves successfully',()=>{
  const {state}=network();state.day=30;const p=projectDay(state);finishDay(state,p)
  assert.ok(state.growth.Taksim>state.growth.Bağcılar)
  assert.ok(projectDay(state).districts.some(d=>d.name==='Sarıyer'))
  assert.deepEqual(parseSave(JSON.stringify(state)),state)
})

test('airport connection rewards once and retail generates extra income',()=>{
  const state=newGame('kayseri');const line=buildLine(state,[{name:'Havalimanı',position:[35.495,38.771]},{name:'Cumhuriyet',position:[35.488,38.722]}],'localbus',10)
  line.fleet=5;state.day=line.readyAt;state.stations[0].shop=true
  const p=projectDay(state);assert.ok(p.retailIncome>0);assert.ok(rewardGoals(state,p).some(g=>g.id==='airport'));assert.equal(rewardGoals(state,p).length,0)
})

test('all city and template anchors fit the bounded map and use supported transport',()=>{
  assert.equal(Object.keys(cities).length,8)
  for(const [id,city] of Object.entries(cities)){
    const [w,s,e,n]=city.bounds
    assert.ok(city.districts.every(([,x,y])=>x>=w&&x<=e&&y>=s&&y<=n),id)
    for(const [,mode,...names] of corridors[id]){assert.ok(modes[mode]);assert.ok(names.every(name=>city.districts.some(d=>d[0]===name)),id)}
    assert.equal(projectDay(newGame(id)).riders,0)
  }
})

test('invalid version-two fields are rejected',()=>{
  const {state}=network();state.fare=-1;assert.throws(()=>parseSave(JSON.stringify(state)))
})

test('100 lines and 1000 stations simulate in the worker with a matching projection',async()=>{
  const state=newGame('istanbul');state.day=2
  state.stations=Array.from({length:1000},(_,i)=>({id:`s${i}`,name:`Durak ${i}`,position:[28.9+(i%40)*.005,40.95+Math.floor(i/40)*.006]}))
  state.lines=Array.from({length:100},(_,i)=>({id:`l${i}`,number:i+1,name:`H${i+1}`,mode:'localbus',model:'standard',depth:10,stops:[...(i?[`s${i*10-1}`]:[]),...state.stations.slice(i*10,i*10+10).map(s=>s.id)],fleet:8,readyAt:1,headway:6,peakHeadway:4,color:'#ca492c'}))
  const expected=projectDay(state)
  const url=new URL('../src/worker.js',import.meta.url).href
  const code=`import {parentPort} from 'node:worker_threads';globalThis.self={postMessage:m=>parentPort.postMessage(m)};await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));`
  const worker=new Worker(new URL(`data:text/javascript,${encodeURIComponent(code)}`))
  try{
    const actual=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage({revision:9,state})})
    assert.equal(actual.revision,9);assert.equal(actual.projection.riders,expected.riders);assert.equal(Object.keys(actual.projection.results).length,100)
  }finally{await worker.terminate()}
})
