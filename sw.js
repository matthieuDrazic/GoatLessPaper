const CACHE='goatlesspaper-v10';
const CORE=['./','./index.html','./app.js','./manifest.webmanifest'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
 self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 const path=new URL(req.url).pathname;
 // Navigation et scripts toujours servis depuis la même version publiée.
 if(req.mode==='navigate'||/\/(app\.js|index\.html|sw\.js)$/.test(path)){
  event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req)));
  return;
 }
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});