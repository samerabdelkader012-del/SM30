const C='vehicle-v4',F=['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./logo.png'];
const notify=()=>self.clients.matchAll({includeUncontrolled:true}).then(cs=>cs.forEach(c=>c.postMessage({type:'update'})));
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>Promise.all(F.map(u=>fetch(u,{cache:'reload'}).then(r=>r.ok&&c.put(u,r)).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const q=e.request;
  if(q.method!=='GET'||new URL(q.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(C);
    const hit=await c.match(q,{ignoreSearch:true});
    const doc=q.mode==='navigate'||/(\/|index\.html)$/.test(new URL(q.url).pathname);
    const net=fetch(q.url,{cache:'no-store'}).then(async r=>{
      if(r.ok){
        if(hit&&doc){const t=await Promise.all([hit.clone().text(),r.clone().text()]);if(t[0]!==t[1])await notify()}
        await c.put(q,r.clone());
      }
      return r;
    }).catch(()=>null);
    if(hit){e.waitUntil(net);return hit}
    return (await net)||Response.error();
  })());
});
