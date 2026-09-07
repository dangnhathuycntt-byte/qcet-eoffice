// QCET E-Office Service Worker
// Version: 1.0.0
// Handles push notifications, badge counts, client navigation, and offline fallback cache

const CACHE_NAME = 'qcet-eoffice-v1';
const OFFLINE_FALLBACK_URL = '/';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/logo-qcet.png',
];

self.addEventListener('install', (event) => {
  const installTasks = [self.skipWaiting()];
  if (typeof caches !== 'undefined') {
    installTasks.push(
      caches
        .open(CACHE_NAME)
        .then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
    );
  }
  event.waitUntil(Promise.all(installTasks));
});

self.addEventListener('activate', (event) => {
  const activateTasks = [self.clients.claim()];
  if (typeof caches !== 'undefined') {
    activateTasks.push(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((name) => name !== CACHE_NAME)
              .map((name) => caches.delete(name))
          )
        )
    );
  }
  event.waitUntil(Promise.all(activateTasks));
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests, bypass API calls and non-http schemes
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  if (typeof caches === 'undefined') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse.status === 200 &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        if (event.request.mode === 'navigate') {
          const fallback = await caches.match(OFFLINE_FALLBACK_URL);
          if (fallback) return fallback;
        }
        return new Response('He thong dang ngoai tuyen. Vui long kiem tra lai ket noi mang.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'QCET E-Office',
    body: 'Bạn có thông báo mới từ hệ thống điều hành',
    data: { linkHref: '/portal' },
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'QCET E-Office',
        body: event.data.text() || 'Bạn có thông báo mới từ hệ thống điều hành',
        data: { linkHref: '/portal' },
      };
    }
  }

  const title = payload.title || 'QCET E-Office';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo-qcet.png',
    badge: payload.badge || '/logo-qcet.png',
    data: payload.data || { linkHref: '/portal' },
    vibrate: payload.vibrate || [100, 50, 100],
    tag: payload.tag || 'qcet-notification',
    renotify: typeof payload.renotify === 'boolean' ? payload.renotify : true,
    requireInteraction: typeof payload.requireInteraction === 'boolean' ? payload.requireInteraction : false,
    actions: payload.actions || [],
  };

  const tasks = [];

  // 1. Show web notification
  tasks.push(self.registration.showNotification(title, options));

  // 2. Update app badge if supported
  if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') {
    const badgeCount =
      payload.data && typeof payload.data.badgeCount === 'number'
        ? payload.data.badgeCount
        : typeof payload.badgeCount === 'number'
        ? payload.badgeCount
        : 1;

    try {
      tasks.push(
        navigator.setAppBadge(badgeCount).catch(() => {})
      );
    } catch {
      // Ignore errors in environments without badge permission
    }
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const rawTargetUrl = data.linkHref || '/portal';

  // Build target URL relative or absolute
  let targetUrl = rawTargetUrl;
  try {
    const base = self.location ? self.location.origin : 'http://localhost:3000';
    targetUrl = new URL(rawTargetUrl, base).href;
  } catch {
    targetUrl = rawTargetUrl;
  }

  const tasks = [];

  // Clear app badge if supported
  if (typeof navigator !== 'undefined' && typeof navigator.clearAppBadge === 'function') {
    try {
      tasks.push(navigator.clearAppBadge().catch(() => {}));
    } catch {
      // Ignore
    }
  }

  // Focus existing matching window or open a new one
  const clientsScope = self.clients || (typeof clients !== 'undefined' ? clients : null);
  const windowPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // Check if there is already an open window
      for (const client of clientList) {
        if ('focus' in client) {
          // If already on the same page or origin
          if (client.url === targetUrl) {
            return client.focus();
          }
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(() => client.focus());
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    });

  tasks.push(windowPromise);
  event.waitUntil(Promise.all(tasks));
});
