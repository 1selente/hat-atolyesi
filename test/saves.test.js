import {test} from 'node:test'
import assert from 'node:assert/strict'
import {newGame,parseSave} from '../src/model.js'
import {gameKey,slotsKey,recoveryKey,readSlots,storeSlot,removeSlot,writeGame,recoverGame} from '../src/saves.js'

function memory(){
  const map=new Map(),blocked=new Set()
  return {blocked,getItem:k=>map.get(k)??null,setItem(k,v){if(blocked.has(k))throw Error('quota');map.set(k,v)}}
}
const city='kayseri'
const entry=(n,automatic=false,json=JSON.stringify(newGame(city)))=>({id:String(n),name:'Gün '+n,day:n,automatic,json})
test('manual checkpoints survive automatic rollover and full slots are never silently evicted',()=>{
  const storage=memory()
  for(let i=1;i<=11;i++)assert.equal(storeSlot(storage,city,entry(i)).ok,true)
  assert.equal(storeSlot(storage,city,entry(12,true)).ok,true)
  assert.equal(storeSlot(storage,city,entry(13,true)).ok,true)
  const before=storage.getItem(slotsKey(city))
  assert.equal(storeSlot(storage,city,entry(14)).reason,'full')
  assert.equal(storage.getItem(slotsKey(city)),before)
  assert.deepEqual(readSlots(storage,city).map(x=>x.id),['13','11','10','9','8','7','6','5','4','3','2','1'])
  assert.ok(removeSlot(storage,city,'1'));assert.ok(storeSlot(storage,city,entry(14)).ok)
})
test('stale sessions and quota errors cannot overwrite existing game data',()=>{
  const s=memory(),original=JSON.stringify(newGame(city))
  assert.ok(writeGame(s,city,original,null).ok)
  assert.equal(writeGame(s,city,'next',null).reason,'conflict')
  s.blocked.add(gameKey(city));assert.equal(writeGame(s,city,'next',original).reason,'storage')
  assert.equal(s.getItem(gameKey(city)),original)
})
test('corrupt data falls back to newest valid matching checkpoint and archives original bytes',()=>{
  const s=memory(),good=newGame(city);good.cash=12345
  s.setItem(gameKey(city),'invalid raw')
  storeSlot(s,city,entry(1,false,JSON.stringify(good)))
  storeSlot(s,city,entry(2,false,JSON.stringify(newGame('istanbul'))))
  storeSlot(s,city,entry(3,false,'bad'))
  s.setItem(slotsKey(city),JSON.stringify([null,...readSlots(s,city)]))
  const r=recoverGame(s,city,parseSave,newGame)
  assert.equal(r.status,'recovered');assert.equal(r.state.cash,12345);assert.equal(r.blocked,false)
  assert.equal(s.getItem(recoveryKey(city)),'invalid raw');assert.equal(s.getItem(gameKey(city)),'invalid raw')
})
test('failed archive or existing distinct recovery data blocks automatic overwrite',()=>{
  const s=memory();s.setItem(gameKey(city),'bad')
  s.blocked.add(recoveryKey(city))
  assert.equal(recoverGame(s,city,parseSave,newGame).blocked,true)
  s.blocked.clear();s.setItem(recoveryKey(city),'prior corruption')
  assert.equal(recoverGame(s,city,parseSave,newGame).blocked,true)
  assert.equal(s.getItem(gameKey(city)),'bad')
  assert.equal(s.getItem(recoveryKey(city)),'prior corruption')
})
