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

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let message = {};
    try { const value = event.data?.json(); if (value && typeof value === 'object' && !Array.isArray(value)) message = value; } catch { /* Show a visible fallback. */ }
    const signup = ['signup','registration','changes','matches','fees','awards','upcoming'].includes(message.kind) && typeof message.eventId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(message.eventId);
    await self.registration.showNotification(signup ? (message.kind==='signup'?'羽林大会 · 新接龙':typeof message.title==='string'?message.title.slice(0,80):'羽林大会 · 活动提醒') : '羽林大会 · 通知', {
      body: typeof message.body === 'string' ? message.body.slice(0,250) : '有新消息，请打开羽林大会查看。',
      icon: '/icons/app-192.png', badge: '/icons/app-192.png',
      tag: signup ? (message.kind==='signup'?'yulin-signup-'+message.eventId:typeof message.tag==='string'?message.tag.slice(0,240):'yulin-'+message.kind+'-'+message.eventId) : 'yulin-push-test', renotify: false,
      data: { path: signup ? '/?page=events&event='+encodeURIComponent(message.eventId)+(message.tab==='rounds'||message.tab==='fees'||message.tab==='social'?'&tab='+message.tab:'') : '/?page=me' },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = event.notification.data?.path;
    // Push content can never direct users to another origin or a login endpoint.
    const safePath = typeof path === 'string' && /^\/\?page=(me|events)(?:&event=[A-Za-z0-9_%~-]{1,300})?(?:&tab=(overview|rounds|fees|social))?$/.test(path) ? path : '/?page=me';
    const url = new URL(safePath,self.location.origin).href;
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) if (new URL(client.url).origin === self.location.origin && 'navigate' in client) {
      await client.navigate(url);await client.focus();return;
    }
    await self.clients.openWindow(url);
  })());
});
