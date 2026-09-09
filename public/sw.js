// QCET E-Office Service Worker
// Version: 2.0.0 - Unified Mobile PWA Modernization
// Handles push notifications, badge counts, client navigation, and two-tier offline caching

const CACHE_NAME = 'qcet-eoffice-v4';
const API_CACHE_NAME = 'qcet-api-v1';
const OFFLINE_FALLBACK_URL = '/?zone=tasks';
const API_TIMEOUT_MS = 2500;

const PRECACHE_ASSETS = [
  '/',
  '/?zone=tasks',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/logo-qcet.png',
  '/logo-qcet.webp',
];

self.addEventListener('install', (event) => {
  const installTasks = [self.skipWaiting()];
  if (typeof caches !== 'undefined') {
    installTasks.push(
      caches.open(CACHE_NAME).then(async (cache) => {
        await Promise.allSettled(
          PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
        );
      })
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
              .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
              .map((name) => caches.delete(name))
          )
        )
    );
  }
  event.waitUntil(Promise.all(activateTasks));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  if (typeof caches === 'undefined') {
    return;
  }

  // Never cache static Next.js assets on localhost/dev to prevent cache poisoning
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // 1. Static Assets: Cache-First Strategy for Next.js chunks and static files
  if (url.pathname.startsWith('/_next/static/') || url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2|woff)$/)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(() => {});
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 2. Dashboard & Tasks APIs: Network-First with 2.5s Timeout fallback
  if (url.pathname.startsWith('/api/dashboard/') || url.pathname.startsWith('/api/tasks')) {
    event.respondWith(
      new Promise((resolve) => {
        let isTimedOut = false;
        const timer = setTimeout(() => {
          isTimedOut = true;
          // Timeout reached: attempt cache fallback
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.match(event.request).then((cached) => {
              if (cached) {
                const headers = new Headers(cached.headers);
                headers.set('X-QCET-Offline-Cache', 'true');
                resolve(
                  new Response(cached.body, {
                    status: cached.status,
                    statusText: cached.statusText,
                    headers,
                  })
                );
              } else {
                resolve(
                  new Response(
                    JSON.stringify({
                      error: 'Yêu cầu hết hạn thời gian (2.5s). Máy chủ đang phản hồi chậm.',
                      offline: true,
                    }),
                    {
                      status: 504,
                      headers: {
                        'Content-Type': 'application/json',
                        'X-QCET-Offline-Cache': 'true',
                      },
                    }
                  )
                );
              }
            });
          });
        }, API_TIMEOUT_MS);

        fetch(event.request)
          .then((networkResponse) => {
            clearTimeout(timer);
            if (!isTimedOut) {
              if (networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(API_CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone).catch(() => {});
                });
              }
              resolve(networkResponse);
            }
          })
          .catch(() => {
            clearTimeout(timer);
            if (!isTimedOut) {
              caches.open(API_CACHE_NAME).then((cache) => {
                cache.match(event.request).then((cached) => {
                  if (cached) {
                    const headers = new Headers(cached.headers);
                    headers.set('X-QCET-Offline-Cache', 'true');
                    resolve(
                      new Response(cached.body, {
                        status: cached.status,
                        statusText: cached.statusText,
                        headers,
                      })
                    );
                  } else {
                    resolve(
                      new Response(
                        JSON.stringify({
                          error: 'Mất kết nối mạng. Không có dữ liệu lưu tạm cho yêu cầu này.',
                          offline: true,
                        }),
                        {
                          status: 503,
                          headers: {
                            'Content-Type': 'application/json',
                            'X-QCET-Offline-Cache': 'true',
                          },
                        }
                      )
                    );
                  }
                });
              });
            }
          });
      })
    );
    return;
  }

  // Bypass other APIs
  if (url.pathname.startsWith('/api/')) return;

  // 3. Navigation & Document Requests: Network-First with Offline Page Fallback
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
        return new Response('Hệ thống đang ngoại tuyến. Vui lòng kiểm tra lại kết nối mạng.', {
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
    data: { linkHref: '/?zone=tasks' },
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'QCET E-Office',
        body: event.data.text() || 'Bạn có thông báo mới từ hệ thống điều hành',
        data: { linkHref: '/?zone=tasks' },
      };
    }
  }

  const title = payload.title || 'QCET E-Office';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo-qcet.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    data: payload.data || { linkHref: '/?zone=tasks' },
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
  const rawTargetUrl = data.linkHref || '/?zone=tasks'; // Default navigation fallback (/portal or /?zone=tasks)

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
