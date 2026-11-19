import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'

function harness(){
  // Real SW handlers with an in-memory CacheStorage and controllable network.
  const scope='https://example.test/game/',listeners=new Map(),stores=new Map()
  const page='<script type="module" src="./assets/index-test.js"></script><link href="./assets/index-test.css" rel="stylesheet">'
  const responses=new Map([[scope,page],[scope+'manifest.webmanifest','{}'],[scope+'icon.svg','<svg/>'],[scope+'neighborhoods-2025.json','{"cities":{}}'],[scope+'assets/index-test.js','new URL("worker-abc.js", import.meta.url); new URL("maplibre-gl-worker-def.js", import.meta.url)'],[scope+'assets/index-test.css','body{}'],[scope+'assets/worker-abc.js','self.onmessage=()=>{}'],[scope+'assets/maplibre-gl-worker-def.js','worker']])
  let online=true,skipped=false,claimed=false
  const requestKey=req=>typeof req==='string'?req:req.url
  const fetch=async req=>{const key=requestKey(req);if(!online)throw Error('offline');return responses.has(key)?new Response(responses.get(key)):new Response('missing',{status:404})}
  const cacheStorage={async open(name){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {async addAll(urls){const fresh=await Promise.all(urls.map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('fetch failed');return [url,r]}));for(const [url,r] of fresh)store.set(url,r)},async add(url){const r=await fetch(url);if(!r.ok)throw Error('fetch failed');store.set(url,r)},async match(req){return store.get(requestKey(req))?.clone()},async put(req,res){store.set(requestKey(req),res.clone())}}},async keys(){return [...stores.keys()]},async delete(name){return stores.delete(name)},async match(req){for(const name of stores.keys()){const r=await (await this.open(name)).match(req);if(r)return r}}}
  const self={registration:{scope},addEventListener:(name,fn)=>listeners.set(name,fn),skipWaiting:async()=>{skipped=true},clients:{claim:async()=>{claimed=true}}}
  const code=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8')
  runInNewContext(code,{self,caches:cacheStorage,fetch,URL,Response,Promise})
  const lifecycle=async name=>{let promise;listeners.get(name)({waitUntil:p=>promise=p});return promise}
  const handle=async (url,mode='cors',method='GET')=>{let result;listeners.get('fetch')({request:{url,mode,method},respondWith:p=>result=p});return result}
  return {scope,responses,stores,cacheStorage,lifecycle,handle,offline:()=>online=false,flags:()=>({skipped,claimed})}
}
test('service worker precaches HTML, workers, styles and neighborhood data and reloads offline',async()=>{
  const h=harness();await h.cacheStorage.open('hat-atolyesi-shell-v3');await h.cacheStorage.open('unrelated')
  await h.lifecycle('install');assert.equal(h.flags().skipped,true)
  await h.lifecycle('activate');assert.equal(h.flags().claimed,true);assert.equal(h.stores.has('hat-atolyesi-shell-v3'),false);assert.ok(h.stores.has('unrelated'))
  h.offline();for(const path of ['','assets/index-test.js','assets/index-test.css','assets/worker-abc.js','assets/maplibre-gl-worker-def.js','neighborhoods-2025.json','manifest.webmanifest','icon.svg']){
    const response=await h.handle(h.scope+path,path?'cors':'navigate');assert.equal(response.ok,true,path)
  }
  assert.equal(await h.handle('https://tiles.openfreemap.org/tile'),undefined)
  assert.equal(await h.handle(h.scope+'neighborhoods-2025.json','cors','POST'),undefined)
})
test('broken new worker installation fails without deleting the previous working cache',async()=>{
  const h=harness();await h.cacheStorage.open('hat-atolyesi-shell-v3');h.responses.delete(h.scope+'assets/worker-abc.js')
  await assert.rejects(h.lifecycle('install'));assert.equal(h.flags().skipped,false);assert.ok(h.stores.has('hat-atolyesi-shell-v3'))
})
test('online navigation cannot replace the coherent offline shell with a partially deployed release',async()=>{
  const h=harness();const previous=h.responses.get(h.scope)
  await h.lifecycle('install');await h.lifecycle('activate')
  const next='<script src="./assets/new-version.js"></script>'
  h.responses.set(h.scope,next)
  assert.equal(await (await h.handle(h.scope,'navigate')).text(),next)
  h.offline()
  assert.equal(await (await h.handle(h.scope,'navigate')).text(),previous)
})
