// Service worker : la carte s'ouvre sans réseau (forêt). Les données calculées sont déjà dans le stockage du navigateur.
// - fichiers de l'appli et bibliothèques : copie locale, mise à jour en arrière-plan quand le réseau revient ;
// - fonds de carte IGN déjà vus : gardés (5000 au plus) pour être affichés hors connexion ;
// - données (météo, IGN, Zenodo, GBIF…) : toujours le réseau, jamais de copie périmée ici.
const SHELL = 'shell-v1', TILES = 'tuiles-ign-v1', MAX_TILES = 5000;
const SHELL_URLS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_URLS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || req.headers.has('range')) return;
  const u = new URL(req.url);
  const isShell = SHELL_URLS.some(s => new URL(s, self.registration.scope).href === u.href) || (u.origin === location.origin && (u.pathname.endsWith('/') || u.pathname.endsWith('.html')));
  if (isShell){ // réseau d'abord (pour avoir la dernière version), copie locale sinon
    e.respondWith(fetch(req).then(r => { if (r.ok){ const c = r.clone(); caches.open(SHELL).then(ca => ca.put(req, c)); } return r; }).catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('./index.html'))));
    return; }
  if (u.hostname === 'data.geopf.fr' && u.pathname.startsWith('/wmts') && /REQUEST=GetTile/i.test(u.search)){
    e.respondWith(caches.open(TILES).then(async ca => { const hit = await ca.match(req);
      const net = fetch(req).then(async r => { if (r.ok){ await ca.put(req, r.clone()); const ks = await ca.keys(); for (let i = 0; i < ks.length - MAX_TILES; i++) await ca.delete(ks[i]); } return r; });
      return hit ? (net.catch(() => {}), hit) : net; }));
  }
});
