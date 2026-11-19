import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import * as model from '../src/model.js'
import * as cities from '../src/cities.js'
import * as advanced from '../src/advanced.js'
import * as management from '../src/management.js'

// Exercise initial rendering and the full fallback-panel flow without WebGL.
// The real browser's WebGL rendering is covered separately by style validation.
test('application boots and plays a complete line through its offline panel',()=>{
  const markup=readFileSync(new URL('../index.html',import.meta.url),'utf8')
  const elements=new Map([...markup.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,{
    id,innerHTML:'',textContent:'',checked:false,open:false,hidden:false,disabled:false,
    addEventListener(){},contains(){return false},setAttribute(){},showModal(){this.open=true},close(){this.open=false},
  }]))
  const saved=new Map()
  const document={getElementById:id=>elements.get(id),querySelectorAll:()=>[],addEventListener(){},documentElement:{dataset:{}},activeElement:null}
  const context={...model,...cities,...advanced,...management,document,window:{addEventListener(){}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},
    makeMap:()=>({render(){},animate(){},showCity(){},recenter(){},setTheme(){}}),
    setTimeout:()=>0,clearTimeout(){},matchMedia:()=>({matches:false}),requestAnimationFrame(){},performance,structuredClone,crypto,
  }
  const source=readFileSync(new URL('../src/app.js',import.meta.url),'utf8')
  const api=runInNewContext(source.slice(source.indexOf('const $ =')).replaceAll('import.meta.url',JSON.stringify(new URL('../src/app.js',import.meta.url).href))+';({actions,place,advanceDay,switchCity,getState:()=>state,getProjection:()=>projection})',context)
  assert.equal(elements.get('city-title').textContent,'İstanbul')
  assert.equal(elements.get('riders').textContent,'0')
  api.actions.depot();api.place([28.985,41.037],null,'Taksim')
  api.actions['new-line']();api.place([28.985,41.037],null,'Taksim');api.place([29.006,41.043],null,'Beşiktaş')
  api.actions.build();api.actions.buy()
  for(let i=0;i<4;i++)api.advanceDay()
  assert.ok(api.getProjection().riders>0)
  assert.match(elements.get('panel').innerHTML,/Saatlik doluluk/)
  assert.equal(model.parseSave(saved.get('hat-atolyesi:v1:istanbul')).lines.length,1)
  api.switchCity('kayseri');assert.equal(api.getState().city,'kayseri');assert.equal(api.getProjection().riders,0)
  api.switchCity('istanbul');assert.equal(api.getState().lines.length,1)
})
