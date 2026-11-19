import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec'

test('map overlays validate against the MapLibre style specification, with and without glyphs',()=>{
  const source=readFileSync(new URL('../src/map.js',import.meta.url),'utf8')
  const declarations=source.slice(source.indexOf('const collection'),source.indexOf('const blank'))
  for(const labels of [false,true]){
    const style=runInNewContext(`${declarations};({version:8,${labels?'glyphs:"https://example.org/{fontstack}/{range}.pbf",':''}sources:Object.fromEntries(sources.map(n=>[n,{type:"geojson",data:collection()}])),layers:${labels?'[...layers,...labelLayers]':'layers'}})`)
    assert.deepEqual(validateStyleMin(style).map(e=>e.message),[])
  }
})
