import {test} from 'node:test'
import assert from 'node:assert/strict'
import {buildLine,newGame,projectDay,service,finishDay,parseSave} from '../src/model.js'
import {actualFare,addContract,addDistrict,configureLine,createCustomCity,edgeKey,finance,gameCity,hire,importDistricts,lineKilometres,maintenance,orderVehicles,profile,serviceStopIds,sharedSegments,upgradeStation,upgradeDepot,stationProfile,depotProfile,scenarioConfig,settleCompany} from '../src/advanced.js'
import {renderManagement,renderLineAdvanced} from '../src/management.js'

function setup(){
  const s=newGame('istanbul')
  s.cash=100000
  const l=buildLine(s,[{name:'Taksim',position:[28.985,41.037]},{name:'Beşiktaş',position:[29.006,41.043]},{name:'Levent',position:[29.015,41.080]}],'metro',20)
  s.day=l.readyAt;l.fleet=8
  return {s,l,stations:new Map(s.stations.map(p=>[p.id,p]))}
}
test('waypoints change length, travel time and investment; ring closes the route',()=>{
  const {s,l,stations}=setup(),km=lineKilometres(l,stations),cash=s.cash
  const [a,b]=l.stops
  assert.equal(configureLine(s,l,{waypoints:{[edgeKey(a,b)]:[[29.001,41.055]]}}).ok,true)
  assert.ok(lineKilometres(l,stations)>km)
  assert.ok(s.cash<cash)
  const bent=lineKilometres(l,stations)
  assert.equal(configureLine(s,l,{ring:true,oneway:true}).ok,true)
  assert.ok(lineKilometres(l,stations)>bent)
  assert.ok(projectDay(s).riders>0)
})
test('single tracks, shared rail, signal upgrades and schedules constrain service',()=>{
  const {s,l,stations}=setup()
  assert.ok(configureLine(s,l,{tracks:1}).ok)
  assert.ok(service(l,stations,8,s).interval>=10)
  assert.ok(configureLine(s,l,{passing:true,signal:'cbtc'}).ok)
  assert.ok(service(l,stations,8,s).interval>=5)
  const shared=sharedSegments([l,{...l,id:'other'},{...l,id:'third'},{...l,id:'fourth'}])
  assert.ok(service(l,stations,8,s,shared).interval>=6)
  assert.ok(configureLine(s,l,{schedule:Array(18).fill(0)}).ok)
  assert.equal(projectDay(s).riders,0)
  assert.equal(projectDay(s).coverage,0)
})
test('express and closed stops change the service graph; invalid selections are rejected',()=>{
  const {s,l,stations}=setup();const [a,b,c]=l.stops
  assert.ok(configureLine(s,l,{express:true,expressStops:[a,c]}).ok)
  assert.deepEqual(service(l,stations,8,s).servedStops,[a,c])
  assert.equal(configureLine(s,l,{closedStops:[a]}).ok,false)
  assert.ok(configureLine(s,l,{express:false,closedStops:[b]}).ok)
  assert.deepEqual(serviceStopIds(l),[a,c])
  assert.ok(configureLine(s,l,{closed:true}).ok)
  assert.equal(projectDay(s).riders,0)
})
test('platform and depot upgrades, orders, used vehicle wear and maintenance interact',()=>{
  const {s,l}=setup()
  assert.equal(configureLine(s,l,{vagons:6}).ok,false)
  for(const st of s.stations)assert.ok(upgradeStation(s,st,'platform'))
  assert.equal(stationProfile(s.stations[0]).platform,6)
  assert.ok(configureLine(s,l,{vagons:6}).ok)
  const d={id:'depot',name:'Merkez',position:s.stations[0].position};s.depots.push(d)
  assert.ok(upgradeDepot(s,d));assert.equal(depotProfile(d).capacity,80)
  assert.ok(configureLine(s,l,{depot:d.id}).ok)
  let old=l.fleet
  assert.ok(orderVehicles(s,l,2,'budget',true))
  finishDay(s,projectDay(s));assert.equal(l.fleet,old)
  finishDay(s,projectDay(s));assert.equal(l.fleet,old+2)
  assert.ok(profile(l).wear>0)
  assert.ok(maintenance(s,l));assert.equal(profile(l).wear,0)
  assert.equal(maintenance(s,l),false)
})
test('staff, fares, weather and competing modes affect service and accounting',()=>{
  const {s,l,stations}=setup()
  s.company.realism=true
  assert.equal(service(l,stations,8,s).available,0)
  assert.ok(hire(s,'driver',8));assert.ok(hire(s,'maintenance',2))
  assert.equal(service(l,stations,8,s).available,8)
  const p=projectDay(s);assert.ok(p.riders>0);assert.ok(p.breakdown.staff>0);assert.ok(p.breakdown.energy>0)
  s.company.tariff='distance';s.company.discount=50;s.company.pass=true
  assert.ok(actualFare(s,{km:2,transfers:1,mode:'metro'})<s.fare)
  assert.ok(actualFare(s,{km:25,transfers:0,mode:'metro'})>s.fare)
  l.mode='bus';s.company.weather='snow';assert.ok(service(l,stations,8,s).traffic>1.35);l.mode='metro'
  assert.ok(finance(s,'short'));const debt=s.company.debts[0].remaining
  finishDay(s,projectDay(s));assert.ok(s.company.debts[0].remaining<debt)
  assert.equal(s.company.ledger.length,1);assert.ok(s.company.transactions.length>=3)
  assert.deepEqual(parseSave(JSON.stringify(s)),s)
})
test('contracts, scenario targets and custom city data operate without external APIs',()=>{
  const {s}=setup()
  assert.ok(addContract(s,'Taksim'))
  finishDay(s,projectDay(s))
  assert.equal(s.company.contracts[0].status,'complete')
  const c=newGame('kayseri')
  assert.ok(createCustomCity(c,{name:'Yeni Şehir',lng:35.5,lat:38.7,radius:20,population:400000,budget:12000}))
  assert.equal(gameCity(c).name,'Yeni Şehir')
  const district={name:'Üniversite',lng:35.55,lat:38.72,weight:10,kind:'school',population:2000,source:'Örnek veri'}
  assert.ok(addDistrict(c,district))
  assert.equal(importDistricts(c,[{...district,name:'Park'},{...district,name:'Geçersiz',lng:100}]),false)
  assert.equal(c.company.customDistricts.length,2)
  assert.equal(projectDay(c).districts.length,2)
  assert.ok(scenarioConfig(c,'budget'));assert.equal(c.cash,5500)
  assert.deepEqual(parseSave(JSON.stringify(c)),c)
  const invalid=structuredClone(c);invalid.company.customCity.bounds=[0,0,100,100]
  assert.throws(()=>parseSave(JSON.stringify(invalid)))
})
test('v2 migration preserves baseline and advanced forms escape user data',()=>{
  const {s,l}=setup();const v2=structuredClone(s);v2.version=2;delete v2.company;delete v2.lines[0].operations
  const upgraded=parseSave(JSON.stringify(v2));assert.equal(upgraded.version,3);assert.equal(upgraded.lines.length,1)
  s.company.name='<script>test</script>'
  assert.match(renderManagement(s,projectDay(s)),/&lt;script&gt;/)
  assert.match(renderManagement(s,projectDay(s)),/custom-city/)
  assert.match(renderLineAdvanced(s,l,projectDay(s).results[l.id]),/expressStops/)
})
