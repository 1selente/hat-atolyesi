import {test} from 'node:test'
import assert from 'node:assert/strict'
import {newGame,buildLine,projectDay,parseSave,finishDay} from '../src/model.js'
import {configureLine,profile} from '../src/advanced.js'
import {syncRoster,syncCondition,availableUnits,maintainUnit,workshopUsage,setAutoMaintenance,runAutoMaintenance,unitBroken,settleComplaints} from '../src/detail.js'

function fixture(){
  const s=newGame('istanbul');s.cash=100000;s.company.realism=true;s.company.staff.driver=20;s.company.staff.maintenance=12
  const l=buildLine(s,[{name:'Taksim',position:[28.985,41.037]},{name:'Beşiktaş',position:[29.006,41.043]}],'metro',20)
  s.day=l.readyAt;l.fleet=5;syncRoster(l,s.day)
  return {s,l}
}
test('realism exposes estimated demand even without service and closed lines generate suspension complaints',()=>{
  const blank=newGame('istanbul')
  assert.equal(projectDay(blank).demand,0)
  blank.company.realism=true
  const empty=projectDay(blank);assert.ok(empty.unconnectedDemand>0);assert.equal(empty.connectedDemand,0);assert.equal(empty.riders,0);assert.equal(empty.rating,null);assert.ok(empty.flows.every(f=>f.riders===0))
  const {s,l}=fixture(),open=projectDay(s)
  assert.ok(open.riders>0);assert.ok(open.connectedDemand>0)
  assert.ok(configureLine(s,l,{closed:true}).ok)
  const closed=projectDay(s);assert.equal(closed.riders,0);assert.equal(closed.connectedDemand,0);assert.ok(closed.unconnectedDemand>0)
  assert.ok(closed.complaints.some(x=>x.kind==='suspension'&&x.target===l.id))
})
test('workshop capacities are independent and persistent faults require repair',()=>{
  const {s,l}=fixture()
  s.depots.push({id:'a',name:'A',position:[28.985,41.037]},{id:'b',name:'B',position:[29.006,41.043]})
  l.operations={...profile(l),depot:'a'}
  for(const u of l.units.slice(0,4))assert.ok(maintainUnit(s,l,u.number))
  const last=l.units[4];last.fault=true;last.failedUntil=s.day-1;syncCondition(l,s.day)
  assert.ok(unitBroken(last,s.day));assert.equal(availableUnits(l,s.day),0)
  assert.equal(maintainUnit(s,l,last.number,true),false)
  l.operations.depot='b'
  assert.equal(maintainUnit(s,l,last.number,false),false)
  assert.ok(maintainUnit(s,l,last.number,true))
  assert.deepEqual(workshopUsage(s).usage,{a:4,b:1})
  assert.equal(last.fault,false);assert.equal(last.events.at(-1).kind,'repair')
  assert.deepEqual(parseSave(JSON.stringify(s)),s)
})
test('automated servicing prioritizes faults and leaves one ready vehicle with logged costs',()=>{
  const {s,l}=fixture();s.depots.push({id:'a',name:'A',position:[28.985,41.037]})
  l.fleet=3;syncRoster(l,s.day);l.units.forEach(u=>u.wear=75);l.units[0].fault=true
  assert.ok(setAutoMaintenance(l,60));assert.equal(setAutoMaintenance(l,99),false)
  const jobs=runAutoMaintenance(s,l)
  assert.equal(jobs.length,2);assert.equal(jobs[0].repair,true);assert.equal(availableUnits(l,s.day),1)
  assert.deepEqual(parseSave(JSON.stringify(s)),s)
  s.day+=1;finishDay(s,projectDay(s));assert.ok(s.company.ledger.length)
})
test('complaints outside the display top fifty remain open until their source is resolved',()=>{
  const {s}=fixture()
  const districts=Array.from({length:65},(_,i)=>({name:'Bölge '+i,weight:4,stop:null}))
  const p={results:{},stops:{},districts,riders:0}
  settleComplaints(s,p);assert.ok(s.company.complaints.some(c=>c.target==='Bölge 64'&&c.status==='open'))
  s.day++;settleComplaints(s,p);assert.ok(s.company.complaints.some(c=>c.target==='Bölge 64'&&c.status==='open'))
  districts.at(-1).stop='served';s.day++;settleComplaints(s,p)
  assert.ok(s.company.complaints.some(c=>c.target==='Bölge 64'&&c.status==='resolved'))
})
