import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import * as model from '../src/model.js'
import * as cities from '../src/cities.js'
import * as advanced from '../src/advanced.js'
import * as management from '../src/management.js'
import * as detail from '../src/detail.js'
import * as saves from '../src/saves.js'

// Exercise initial rendering and the full fallback-panel flow without WebGL.
// The real browser's WebGL rendering is covered separately by style validation.
test('application boots, operates a line and imports data through its management panel',async()=>{
  const markup=readFileSync(new URL('../index.html',import.meta.url),'utf8')
  const elements=new Map([...markup.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{
    id,innerHTML:'',textContent:'',checked:false,open:false,hidden:false,disabled:false,
    addEventListener(){},contains(){return false},setAttribute(){},showModal(){this.open=true},close(){this.open=false},
  }]))
  const saved=new Map()
  const document={getElementById:id=>elements.get(id),querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}},activeElement:null}
  const dataset=JSON.parse(readFileSync(new URL('../public/neighborhoods-2025.json',import.meta.url),'utf8'))
  const context={...model,...cities,...advanced,...management,...detail,...saves,document,window:{addEventListener(){}},localStorage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)},
    URL,AbortSignal,location:{href:'https://example.test/game/'},fetch:async url=>{assert.equal(String(url),'https://example.test/game/neighborhoods-2025.json');return {ok:true,json:async()=>dataset}},
    makeMap:()=>({render(){},animate(){},showCity(){},recenter(){},setTheme(){}}),
    setTimeout:()=>0,clearTimeout(){},matchMedia:()=>({matches:false}),requestAnimationFrame(){},performance,structuredClone,crypto,
  }
  const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
  const api=runInNewContext(source.slice(source.indexOf('const $ =')).replaceAll('import.meta.url',JSON.stringify(new URL('../src/app.js',import.meta.url).href))+';({actions,place,advanceDay,switchCity,formCommand,getState:()=>state,getProjection:()=>projection})',context)
  assert.equal(elements.get('city-title').textContent,'İstanbul')
  assert.equal(elements.get('riders').textContent,'0')
  api.actions.depot();api.place([28.985,41.037],null,'Taksim')
  api.actions['new-line']();api.place([28.985,41.037],null,'Taksim');api.place([29.006,41.043],null,'Beşiktaş')
  api.actions.build();api.actions.buy()
  for(let i=0;i<4;i++)api.advanceDay()
  assert.ok(api.getProjection().riders>0)
  assert.match(elements.get('panel').innerHTML,/Saatlik doluluk/)
  assert.equal(model.parseSave(saved.get('hat-atolyesi:v1:istanbul')).lines.length,1)
  const line=api.getState().lines[0];assert.equal(line.units.length,1)
  api.actions['unit-service']({dataset:{unit:String(line.units[0].number)}})
  assert.ok(line.units[0].maintenanceUntil>api.getState().day)
  api.actions.buy();assert.equal(line.units.length,2)
  api.actions.sell();assert.equal(line.units.length,1)
  api.switchCity('kayseri');assert.equal(api.getState().city,'kayseri');assert.equal(api.getProjection().riders,0)
  await api.actions['neighborhood-import']({disabled:false,closest:()=>({elements:{limit:{value:'10'}}})})
  assert.equal(api.getState().company.customDistricts.length,10)
  assert.equal(model.parseSave(saved.get('hat-atolyesi:v1:kayseri')).company.customDistricts.length,10)
  assert.match(management.renderManagement(api.getState(),api.getProjection()),/Yolcu şikâyet merkezi/)
  api.switchCity('istanbul');assert.equal(api.getState().lines.length,1)
})
