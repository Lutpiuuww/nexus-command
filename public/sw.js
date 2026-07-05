const CACHE_NAME = 'smart-command-center-v1';

// Daftar aset statis utama yang wajib diakses offline
const ASSETS_TO_CACHE = [
  '/',
  '/dashboard'
];

// 1. Install Service Worker & Amankan Aset Inti
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 2. Intersepsi Request (Kunci Utama Caching Gambar Peta)
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Jika browser meminta gambar peta dari CartoDB atau OSRM, amankan ke Cache lokal!
  if (requestUrl.host === 'b.basemaps.cartocdn.com' || 
      requestUrl.host === 'a.basemaps.cartocdn.com' || 
      requestUrl.host === 'c.basemaps.cartocdn.com' ||
      requestUrl.host === 'router.project-osrm.org') {
    
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          // Jika sudah ada di cache, pakai yang ada di cache (Offline Mode)
          if (response) return response;

          // Jika belum ada, ambil dari internet lalu simpan kembaran datanya ke cache
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Protokol standar untuk aset web biasa
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});