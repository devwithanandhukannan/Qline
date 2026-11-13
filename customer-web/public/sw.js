/* Qline service worker: static assets are cached, API calls are never cached or touched. */
const VERSION = 'v1';
const STATIC = `qline-static-${VERSION}`;
const PAGES = `qline-pages-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.add('/offline.html')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
  }
});

self.addEventListener('push', (e) => {
  let payload = { title: 'Qline', body: 'Your turn is coming up.', url: '/bookings' };
  if (e.data) {
    try {
      payload = { ...payload, ...e.data.json() };
    } catch {
      payload.body = e.data.text() || payload.body;
    }
  }
  e.waitUntil(
    self.registration.showNotification(payload.title || 'Qline', {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.tag || 'qline-turn',
      renotify: true,
      data: { url: payload.url || '/bookings' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const targetUrl = e.notification.data?.url || '/bookings';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client && client.url.includes(targetUrl)) return client.focus();
      }
      if (list[0] && 'navigate' in list[0]) {
        return list[0].navigate(targetUrl).then((c) => c?.focus?.());
      }
      return self.clients.openWindow?.(targetUrl);
    })
  );
});
