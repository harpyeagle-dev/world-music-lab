'use strict';

// Bump cache name to force clients to fetch the latest bundle/service worker
const CACHE_NAME = 'ethno-explorer-v6-20251227';
const RUNTIME_CACHE = 'ethno-runtime-v2';

// Skip cache installation - let network handle it
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(keys
        .filter(k => k.startsWith('ethno-') && k !== CACHE_NAME && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip favicon
  if (url.pathname.includes('favicon')) {
    event.respondWith(
      fetch(request).catch(() => 
        new Response('', { status: 204 })
      )
    );
    return;
  }
  
  // Network-first for HTML navigation
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Try cache; if not found, fall back to index.html within this SW's scope
          const scopedIndex = new URL('index.html', self.location);
          return caches.match(request)
            .then((cached) => cached || caches.match(scopedIndex));
        })
    );
    return;
  }
  
  // Cache audio files
  if (request.url.match(/\.(wav|ogg|flac|mp3|m4a|weba|webm)$/i)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE)
        .then((cache) =>
          cache.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            }).catch(() => cached);
          })
        )
    );
    return;
  }
  
  // Cache images
  if (request.url.match(/\.(png|jpg|jpeg|svg|gif|webp)$/i)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE)
        .then((cache) =>
          cache.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            }).catch(() => cached);
          })
        )
    );
    return;
  }
  
  // Network-first for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && request.method === 'GET') {
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
