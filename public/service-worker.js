/* Cache public app assets only. Never store authenticated API or storage responses. */
const CACHE='navo-public-20261014-1',ASSETS=['/offline.html','/app-icon.svg','/app-icon-192.png','/app-icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('navo-public-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/offline.html')));return;}if(ASSETS.includes(u.pathname))e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
