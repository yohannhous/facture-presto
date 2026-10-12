// Service worker — permet l'installation et l'ouverture hors ligne de l'app.
// L'envoi d'email (POST vers Make) n'est jamais mis en cache.
const CACHE = 'presto-facture-v2';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];
const JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll(SHELL);
      // jsPDF vient d'un CDN : on le met en cache pour générer le PDF hors ligne
      try { await cache.add(new Request(JSPDF, { mode: 'cors' })); } catch (e) {}
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // les POST (envoi Make) passent direct

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isJspdf = req.url === JSPDF;
  if (!sameOrigin && !isJspdf) return;

  // Réseau d'abord pour la page (toujours à jour), cache en secours
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Cache d'abord pour le reste (icônes, manifest, jsPDF)
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
