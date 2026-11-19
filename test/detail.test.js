import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {newGame,buildLine,projectDay,finishDay,parseSave,service} from '../src/model.js'
import {configureLine,orderVehicles,hire,upgradeStation,importDistricts,profile,assignedFleet,reservedOrders} from '../src/advanced.js'
import {syncRoster,syncCondition,availableUnits,maintainUnit,advanceUnits,setShifts,setLineShifts,setConstruction,constructionDetails,accelerateConstruction,complaintsFor,settleComplaints,neighborhoodRows,simplifyRoute,roadTraffic} from '../src/detail.js'
import {cities} from '../src/cities.js'

function network(mode='metro'){
  const s=newGame('istanbul');s.cash=100000
  const l=buildLine(s,[{name:'Taksim',position:[28.985,41.037]},{name:'Beşiktaş',position:[29.006,41.043]},{name:'Levent',position:[29.015,41.080]}],mode,20)
  s.day=l.readyAt;l.fleet=4
  return {s,l,stations:new Map(s.stations.map(x=>[x.id,x]))}
}
test('individual vehicles keep unique IDs, independent wear and failures, reserves fill only real shortages',()=>{
  const {s,l,stations}=network();s.company.realism=true;s.company.staff.driver=10
  assert.ok(configureLine(s,l,{spare:1}).ok);syncRoster(l,s.day)
  assert.equal(l.units.length,5);assert.equal(new Set(l.units.map(x=>x.number)).size,5)
  const regular=l.units.filter(u=>!u.reserve),reserve=l.units.find(u=>u.reserve)
  advanceUnits(s,l,projectDay(s).results[l.id],8)
  assert.ok(regular.every(u=>u.km>0));assert.equal(reserve.km,0)
  regular[0].failedUntil=s.day+2;syncCondition(l,s.day)
  assert.equal(availableUnits(l,s.day),4)
  regular[1].failedUntil=s.day+2;syncCondition(l,s.day)
  assert.equal(service(l,stations,8,s).available,3)
  assert.equal(maintainUnit(s,l,regular[0].number,true),false)
  s.depots.push({id:'depot',name:'Depo',position:[28.985,41.037]});s.company.staff.maintenance=1
  assert.ok(maintainUnit(s,l,regular[0].number,true))
  assert.equal(maintainUnit(s,l,regular[1].number,true),false)
  assert.ok(regular[1].failedUntil>s.day)
  assert.deepEqual(parseSave(JSON.stringify(s)),s)
})
test('deliveries preserve existing vehicle identities and used condition; depot reserve and pending fleet count',()=>{
  const {s,l}=network();syncRoster(l,s.day);l.units[0].wear=12
  const id=l.units[0].number;const d={id:'depot',name:'Depo',position:[28.985,41.037],facility:{level:0,capacity:7,workshop:1}};s.depots.push(d)
  assert.ok(configureLine(s,l,{depot:d.id,spare:1}).ok)
  assert.equal(assignedFleet(s,d),5);assert.ok(orderVehicles(s,l,2,'budget',true));assert.equal(reservedOrders(s,d),2)
  assert.equal(orderVehicles(s,l,1),false);assert.equal(configureLine(s,l,{spare:2}).ok,false)
  finishDay(s,projectDay(s));finishDay(s,projectDay(s))
  assert.equal(l.fleet,6);assert.equal(l.units.find(u=>u.number===id).wear,12);assert.equal(l.units.filter(u=>u.supplier==='budget'&&u.wear===45).length,2)
  assert.equal(reservedOrders(s,d),0);assert.equal(assignedFleet(s,d),7)
  assert.deepEqual(parseSave(JSON.stringify(s)),s)
})
test('manual shifts cap hourly operations and do not double-book drivers',()=>{
  const {s,l,stations}=network();s.company.realism=true;assert.ok(hire(s,'driver',4))
  assert.equal(setShifts(s,[3,3,3]),false);assert.ok(setShifts(s,[0,1,3]))
  assert.ok(setLineShifts(s,l,[4,4,2]))
  assert.equal(service(l,stations,8,s).available,0)
  assert.equal(service(l,stations,13,s).available,1)
  assert.equal(service(l,stations,19,s).available,2)
  assert.ok(projectDay(s).coverage>0);assert.ok(projectDay(s).riders>0)
  assert.equal(hire(s,'driver',-1),false)
  const another=buildLine(s,s.stations.slice(0,2),'metro',20);another.fleet=3;another.readyAt=s.day
  assert.equal(service(another,stations,13,s).available,0);assert.equal(service(another,stations,19,s).available,1)
})
test('construction progress, weather delays, pause, crews and paid acceleration change the opening date',()=>{
  const s=newGame('kayseri');s.cash=100000;s.company.realism=true;s.company.weather='snow'
  const l=buildLine(s,[{name:'Belsin',position:[35.396,38.744]},{name:'Talas',position:[35.565,38.689]}],'tram',0)
  const old=l.readyAt
  finishDay(s,projectDay(s));assert.ok(l.readyAt>old);assert.equal(l.construction.delays,1)
  const done=l.construction.done;assert.ok(setConstruction(s,l,1,true));finishDay(s,projectDay(s));assert.equal(l.construction.done,done)
  assert.ok(setConstruction(s,l,3,false));assert.ok(accelerateConstruction(s,l));assert.ok(l.construction.done>done)
  s.company.weather='clear'
  while(l.readyAt>s.day&&s.day<100)finishDay(s,projectDay(s))
  assert.equal(constructionDetails(l,s.day).ratio,1);assert.equal(constructionDetails(l,s.day).tasks.every(x=>x.progress===100),true)
  assert.ok(l.construction.extra>=40);assert.deepEqual(parseSave(JSON.stringify(s)),s)
})
test('road classes, time of day, shared corridors and nearby actual population modify traffic',()=>{
  const {s,l}=network('localbus');s.company.realism=true
  const peak=roadTraffic(s,l,8),night=roadTraffic(s,l,23);assert.ok(peak>night)
  l.roadClass='priority';assert.ok(roadTraffic(s,l,8)<peak)
  l.roadClass='local';assert.ok(roadTraffic(s,l,8)>peak)
  const previous=roadTraffic(s,l,8);s.company.customDistricts.push({name:'Mahalle',lng:28.985,lat:41.037,population:100000,weight:5,kind:'home'})
  assert.ok(roadTraffic(s,l,8)>previous)
})
test('complaints are generated, persist, resolve when the issue is fixed, and round-trip',()=>{
  const {s,l}=network();const projection=projectDay(s);const st=s.stations[0]
  projection.stops[st.id]=50000
  assert.ok(complaintsFor(s,projection).some(x=>x.kind==='access'&&x.target===st.id))
  settleComplaints(s,projection);const report=s.company.complaints.find(x=>x.kind==='access'&&x.target===st.id);assert.equal(report.status,'open')
  assert.ok(upgradeStation(s,st,'access'));s.day++;settleComplaints(s,projection);assert.equal(report.status,'resolved')
  assert.deepEqual(parseSave(JSON.stringify(s)),s)
})
test('all eight real population packages have non-duplicated, bounded, verified-format points and import atomically',()=>{
  const data=JSON.parse(readFileSync(new URL('../public/neighborhoods-2025.json',import.meta.url),'utf8'))
  assert.equal(Object.values(data.cities).flat().length,624)
  for(const city of Object.keys(cities)){
    const s=newGame(city),records=data.cities[city];assert.ok(records.length>=70)
    assert.equal(new Set(records.map(x=>x[0])).size,records.length)
    const rows=neighborhoodRows(data,city,cities[city].bounds,80,[])
    assert.equal(rows.length,records.length);assert.ok(rows.every(x=>x.population>0&&x.source.includes('TÜİK')))
    assert.ok(importDistricts(s,rows));assert.equal(neighborhoodRows(data,city,cities[city].bounds,80,rows.map(x=>x.name)).length,0)
    assert.equal(parseSave(JSON.stringify(s)).company.customDistricts.length,rows.length)
  }
})
test('route importer preserves endpoints, largest bends, validates bounds and limits geometry',()=>{
  const b=[28,40,30,42],coordinates=Array.from({length:100},(_,i)=>[28.5+i/100,41+Math.sin(i/4)*.03])
  const points=simplifyRoute({type:'LineString',coordinates},b)
  assert.ok(points.length<=14);assert.deepEqual(points[0],coordinates[0]);assert.deepEqual(points.at(-1),coordinates.at(-1))
  assert.equal(simplifyRoute([[29,41],[40,41]],b),null);assert.equal(simplifyRoute({type:'Polygon',coordinates:[coordinates]},b),null)
})
test('malformed detailed saves fail instead of silently accepting corruption',()=>{
  const {s,l}=network();syncRoster(l,s.day);const malformed=structuredClone(s);malformed.lines[0].units[0].wear=200
  assert.throws(()=>parseSave(JSON.stringify(malformed)))
  const corrupt=structuredClone(s);corrupt.company.shifts=[9000,9000,9000];assert.throws(()=>parseSave(JSON.stringify(corrupt)))
})
