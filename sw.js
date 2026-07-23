const CACHE = 'sycora-v4';

// Assets statiques mis en cache (icônes + librairies).
// Les pages HTML (index/montage/auris) ne sont PAS pré-cachées :
// elles sont récupérées depuis le réseau en priorité, pour que les
// mises à jour s'affichent immédiatement.
const STATIC_ASSETS = [
  './icon-192.png',
  './icon-512.png',
  './modele_dgid.xlsx',
  './modele_sycebnl.xlsx',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js',
  'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      // Mise en cache individuelle et tolérante : un asset absent
      // (ex. icon-512.png non encore ajoutée) n'empêche pas l'installation.
      Promise.all(STATIC_ASSETS.map(url =>
        cache.add(url).catch(() => { /* asset ignoré s'il est indisponible */ })
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isHTML = e.request.destination === 'document'
    || url.pathname.endsWith('.html')
    || url.pathname === '/'
    || url.pathname.endsWith('/');

  if (isHTML) {
    // Pages HTML : réseau prioritaire, cache en secours (mode hors-ligne)
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Assets statiques : cache prioritaire, réseau en secours
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return resp;
        });
      })
    );
  }
});
