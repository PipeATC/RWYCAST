/* ============================================================
   RWYCAST · Service Worker (PWA instalable + shell offline)
   ------------------------------------------------------------
   - Cachea el "app shell" (HTML, icono, manifest, libs CDN) para
     que la app abra aunque no haya red.
   - Navegación: red primero (toma la última versión) con respaldo
     a la copia cacheada cuando está offline.
   - NO intercepta el tráfico dinámico (Firebase, Analytics): va
     siempre directo a la red para mantener el tiempo real.
   Sube la versión de CACHE al cambiar assets para forzar refresco.
   ============================================================ */
const CACHE = 'rwycast-v5';
const JS_MODULES = [
  './js/core/react-setup.js',
  './js/config/version.js',
  './js/config/keys.js',
  './js/data/seed.js',
  './js/data/icons.js',
  './js/services/firebase.js',
  './js/services/state.js',
  './js/services/metars.js',
  './js/services/briefing.js',
  './js/services/users.js',
  './js/auth/rbac.js',
  './js/auth/password.js',
  './js/utils/time.js',
  './js/utils/catalog.js',
  './js/components/app.js',
  './js/components/login.js',
  './js/components/layout.js',
  './js/components/viewer.js',
  './js/components/log.js',
  './js/components/briefing-view.js',
  './js/components/catalog-view.js',
  './js/components/users-view.js',
  './js/main.js',
];
const CORE = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon-512.png',
  ...JS_MODULES,
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll falla si una sola request falla; usamos peticiones tolerantes
      .then(c => Promise.all(CORE.map(u =>
        fetch(u, { mode: 'no-cors' }).then(r => c.put(u, r)).catch(() => {})
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tráfico dinámico en tiempo real: no tocar.
  if (/firebaseio\.com|firebasedatabase\.app|google-analytics|googletagmanager/.test(url.host)) return;

  // JS/CSS locales: red primero (evita servir módulos rotos del cache en desarrollo)
  if (url.origin === location.origin && /\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(r => {
        if (r && r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return r;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Navegación: red primero, respaldo al shell cacheado.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => {
          if (r && r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then(c => c.put('./index.html', copy));
          }
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto de assets (propios + CDN de libs): cache primero, luego red.
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(r => {
      const okToCache = r && (r.ok || r.type === 'opaque')
        && (url.origin === location.origin || /cloudflare\.com|gstatic\.com/.test(url.host));
      if (okToCache) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }))
  );
});
