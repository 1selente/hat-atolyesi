// Only the application shell and bundled public data. No third-party map tiles.
const CACHE='hat-atolyesi-shell-v3.2'
const scope=new URL(self.registration.scope)
const allowed=url=>{const u=new URL(url);return u.origin===scope.origin&&u.pathname.startsWith(scope.pathname)&&!u.pathname.includes('/@vite/')&&!u.pathname.includes('/node_modules/')}
const staticAsset=url=>allowed(url)&&/\/assets\/|manifest\.webmanifest$|icon\.svg$|neighborhoods-2025\.json$/.test(url)
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE)
  await cache.addAll([scope.href,...['manifest.webmanifest','icon.svg','neighborhoods-2025.json'].map(name=>new URL(name,scope).href)])
  const page=await cache.match(scope.href),html=await page.text()
  const urls=[...new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>new URL(m[1],scope).href).filter(staticAsset))]
  // A failed installation leaves the previous working version active.
  await cache.addAll(urls)
  for(const url of urls.filter(u=>u.endsWith('.js'))){
    const file=await cache.match(url),js=await file.text()
    const workers=[...new Set(js.match(/(?:maplibre-gl-)?worker-[A-Za-z0-9_-]+\.js/g)??[])]
    await cache.addAll(workers.map(name=>new URL(name,url).href))
  }
  await self.skipWaiting()
})()))
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('hat-atolyesi-shell-')&&key!==CACHE)await caches.delete(key)
  await self.clients.claim()
})()))
self.addEventListener('message',event=>{
  if(event.data?.type!=='cache-assets'||!Array.isArray(event.data.urls))return
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.all(event.data.urls.slice(0,100).filter(u=>typeof u==='string'&&staticAsset(u)).map(u=>cache.add(u).catch(()=>{})))})())
})
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET'||!allowed(req.url))return
  if(req.mode==='navigate'){
    event.respondWith((async()=>{try{const response=await fetch(req);if(response.ok)return response}catch{}return (await (await caches.open(CACHE)).match(scope.href))??Response.error()})());return
  }
  if(!staticAsset(req.url))return
  event.respondWith((async()=>{const cache=await caches.open(CACHE),old=await cache.match(req);if(old)return old;const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response})())
})
