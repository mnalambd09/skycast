const CACHE = 'skycast-shell-v1';
const SHELL = ['/','/index.html','/manifest.webmanifest','/icon.svg','/offline.html'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
  else event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; })));
});
self.addEventListener('push', event => {
  let data = {}; try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title || 'SkyCast — Good morning', { body: data.body || 'Your daily weather is ready.', icon: '/icon.svg', badge: '/icon.svg', tag: data.tag || 'skycast-morning', renotify: false, data: { url: data.url || '/' }, actions: [{ action: 'open', title: 'View forecast' }] }));
});
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => { const existing = clients.find(client => new URL(client.url).origin === self.location.origin); if (existing) return existing.focus(); return self.clients.openWindow(event.notification.data?.url || '/'); })); });
