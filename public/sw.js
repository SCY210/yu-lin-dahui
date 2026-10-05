// Cache only the public disconnected screen. Club pages, sessions, API data,
// avatars and uploaded photos always use the network and are never persisted here.
const OFFLINE_CACHE = 'yulin-offline-v1';
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(OFFLINE_PAGE, {credentials: 'omit', cache: 'reload'});
    if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) {
      throw new Error('Offline screen unavailable');
    }
    const cache = await caches.open(OFFLINE_CACHE);
    // Static hosts may redirect offline.html to /offline. Strip the redirect
    // metadata so the cached response can serve a different navigation safely.
    await cache.put(OFFLINE_PAGE, new Response(response.body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('yulin-offline-') && key !== OFFLINE_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' ||
      url.origin !== self.location.origin || url.pathname !== '/') return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    return await cache.match(OFFLINE_PAGE) ?? Response.error();
  }));
});
