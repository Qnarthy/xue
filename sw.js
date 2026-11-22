// Service worker : permet à l'appli de fonctionner sans connexion.
// Pense à changer VERSION à chaque mise à jour de l'appli.
const VERSION = 'xue-v4.1.0';
const SHELL = [
  './', 'index.html', 'style.css', 'manifest.json',
  'app.js', 'data.js', 'store.js', 'fsrs.js', 'pinyin.js', 'audio.js',
  'ui.js', 'sentences.js', 'oral.js', 'ai.js', 'tutor.js', 'pitch.js', 'pron.js', 'exam.js',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5.0/dist/hanzi-writer.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'xue-strokes').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Données des traits des caractères : mises en cache au fur et à mesure (elles ne changent jamais)
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open('xue-strokes').then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  // Fichiers de l'appli : toujours la dernière version si connecté (max 3 s), sinon le cache
  if (url.origin === location.origin) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const net = fetch(e.request, { cache: 'no-cache' }).then(res => { if (res.ok) c.put(e.request, res.clone()); return res; });
      const timeout = new Promise(r => setTimeout(r, 3000));
      try {
        const res = await Promise.race([net, timeout]);
        if (res) return res;
      } catch (err) { /* hors connexion */ }
      return (await c.match(e.request, { ignoreSearch: true })) || net;
    }));
  }
});
