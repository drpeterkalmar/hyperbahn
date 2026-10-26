// Service-Worker: offline spielbar, Cache-Busting über Inhalts-Hash (tools/update_sw.py)
const VERSION = 'fd1566e3c2';
const CACHE = 'hyperbahn-' + VERSION;
const ASSETS = [
  './',
  'assets/gleiter/hammer.glb',
  'assets/gleiter/klinge.glb',
  'assets/gleiter/pfeil.glb',
  'assets/gleiter/stachel.glb',
  'assets/musik/cyber_runner.m4a',
  'css/style.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'lib/addons/loaders/GLTFLoader.js',
  'lib/addons/utils/BufferGeometryUtils.js',
  'lib/addons/utils/SkeletonUtils.js',
  'lib/three.core.min.js',
  'lib/three.module.min.js',
  'manifest.webmanifest',
  'src/ai/gummiband.js',
  'src/ai/pilot.js',
  'src/audio/ton.js',
  'src/build.js',
  'src/config.js',
  'src/core/util.js',
  'src/core/vec.js',
  'src/core/zeit.js',
  'src/game/bestzeiten.js',
  'src/game/eingabe.js',
  'src/game/fahrhilfe.js',
  'src/game/gvignette.js',
  'src/game/items.js',
  'src/game/momente.js',
  'src/game/rennen.js',
  'src/gfx/bahn_geo.js',
  'src/gfx/bahnmesh.js',
  'src/gfx/drohne.js',
  'src/gfx/funken.js',
  'src/gfx/gleitermesh.js',
  'src/gfx/gpuzeit.js',
  'src/gfx/himmel.js',
  'src/gfx/kamera.js',
  'src/gfx/kern/taau.js',
  'src/gfx/kern/taau_mathe.js',
  'src/gfx/kinolook.js',
  'src/gfx/kulisse_kern.js',
  'src/gfx/kulisse_megastadt.js',
  'src/gfx/kulisse_riff.js',
  'src/gfx/kulisse_wueste.js',
  'src/gfx/minikarte.js',
  'src/gfx/regen.js',
  'src/gfx/stadt.js',
  'src/gfx/stadt_plan.js',
  'src/main.js',
  'src/physics/fahrgefuehl.js',
  'src/physics/gleiter.js',
  'src/track/alle.js',
  'src/track/bahn.js',
  'src/track/runden.js',
  'src/track/strecke1.js',
  'src/track/strecke_riff.js',
  'src/track/strecke_wueste.js',
  'src/track/strecken.js',
  'src/ui/hud.js',
  'src/ui/vorschau.js',
  'src/version.js'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('hyperbahn-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html', { cacheName: CACHE }).then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then((r) => r || fetch(req).then((res) => {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
    return res;
  })));
});
