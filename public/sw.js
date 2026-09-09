// QCET E-Office Service Worker
// Version: 2026.09.09.1 - PWA Architecture Improvement
// Contract: Versioned caches, controlled lifecycle, resource-tailored caching matrix, same-origin deep-link routing

const APP_VERSION = '2026.09.09.1';
const CACHE_STATIC_NAME = 'qcet-static-2026.09.09.1';
const CACHE_SHELL_NAME = 'qcet-shell-2026.09.09.1';
const CACHE_NAME = 'qcet-eoffice-v4'; // Legacy alias for backward compatibility
const API_CACHE_NAME = 'qcet-api-v1'; // Legacy API cache constant
const CURRENT_CACHES = [CACHE_STATIC_NAME, CACHE_SHELL_NAME, API_CACHE_NAME];

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
  '/icons/badge-72x72.png',
  '/logo-qcet.png',
  '/logo-qcet.webp',
];

// 1. Install: Precache shell & static assets without automatic skipWaiting
self.addEventListener('install', (event) => {
  if (typeof caches === 'undefined') return;
  event.waitUntil(
    caches.open(CACHE_SHELL_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
      );
    })
  );
});

// 2. Message: Controlled update execution via SKIP_WAITING
self.addEventListener('message', (event) => {
  if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

// 3. Activate: Immediate client claim & purge stale cache buckets
self.addEventListener('activate', (event) => {
  const activateTasks = [self.clients.claim()];
  if (typeof caches !== 'undefined') {
    activateTasks.push(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((name) => !CURRENT_CACHES.includes(name))
              .map((name) => caches.delete(name))
          )
        )
    );
  }
  event.waitUntil(Promise.all(activateTasks));
});

// 4. Fetch: Resource-tailored caching strategy matrix
self.addEventListener('fetch', (event) => {
  // Mutation Endpoints (POST, PUT, PATCH, DELETE): Network Only. Never intercept in SW.
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  if (typeof caches === 'undefined') return;

  // Never cache static Next.js assets on localhost/dev to prevent cache poisoning
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // Auth Endpoints: Network Only. Never cache.
  if (url.pathname.startsWith('/api/auth/')) {
    return;
  }

  // A. Static Assets: Cache First Strategy (Next.js bundles, chunks, images, fonts, icons)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2|woff|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_STATIC_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(() => {});
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // B. Sensitive Internal API Endpoints (/api/dashboard/*, /api/tasks/*)
  // Network First with tight timeout (2.5s) only when client explicitly requests offline fallback; never cache without header checks.
  if (url.pathname.startsWith('/api/dashboard/') || url.pathname.startsWith('/api/tasks')) {
    const allowsOffline =
      event.request.headers.get('x-qcet-offline-fallback') === 'true' ||
      event.request.headers.get('x-offline-fallback') === 'true' ||
      url.searchParams.get('offline_fallback') === 'true';

    // Disallow unprompted / indiscriminate caching for sensitive internal API endpoints
    if (!allowsOffline) {
      return;
    }

    event.respondWith(
      new Promise((resolve) => {
        let isTimedOut = false;
        const timer = setTimeout(() => {
          isTimedOut = true;
          caches.open(CACHE_SHELL_NAME).then((cache) => {
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
              const cacheControl = networkResponse.headers.get('Cache-Control') || '';
              const canCache =
                networkResponse.status === 200 &&
                !cacheControl.includes('no-store') &&
                !cacheControl.includes('no-cache');

              if (canCache) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_SHELL_NAME).then((cache) => {
                  cache.put(event.request, responseClone).catch(() => {});
                });
              }
              resolve(networkResponse);
            }
          })
          .catch(() => {
            clearTimeout(timer);
            if (!isTimedOut) {
              caches.open(CACHE_SHELL_NAME).then((cache) => {
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

  // Bypass all other API routes
  if (url.pathname.startsWith('/api/')) return;

  // C. Navigation / App Shell: Network First -> fallback to cached shell -> offline HTML response
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse.status === 200 &&
            event.request.url.startsWith(self.location.origin)
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_SHELL_NAME).then((cache) => {
              cache.put(event.request, responseClone).catch(() => {});
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedDirect = await caches.match(event.request);
          if (cachedDirect) return cachedDirect;

          const cachedZone = await caches.match(OFFLINE_FALLBACK_URL);
          if (cachedZone) return cachedZone;

          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;

          return new Response(
            `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ngoại tuyến - QCET E-Office</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fbfbfb; color: #1e293b; padding: 20px; box-sizing: border-box; text-align: center; }
    .card { background: white; border-radius: 12px; padding: 32px 24px; max-width: 420px; width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
    h1 { font-size: 1.25rem; margin: 0 0 12px; color: #0f172a; }
    p { font-size: 0.925rem; color: #64748b; line-height: 1.5; margin: 0 0 24px; }
    button { background: #1e3a8a; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 0.925rem; font-weight: 500; cursor: pointer; }
    button:hover { background: #1e40af; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Hệ thống đang ngoại tuyến</h1>
    <p>Hiện không có kết nối mạng. Vui lòng kiểm tra lại đường truyền của bạn.</p>
    <button onclick="window.location.reload()">Thử lại</button>
  </div>
</body>
</html>`,
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }
          );
        })
    );
    return;
  }
});

// 5. Push: Deduplication by tag (task:{taskId}:{action}, doc:{docId}:directive) and badge updates
self.addEventListener('push', (event) => {
  let payload = {
    title: 'QCET E-Office',
    body: 'Bạn có thông báo mới từ hệ thống điều hành',
    data: { route: '/tasks', linkHref: '/tasks' },
  };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'QCET E-Office',
        body: event.data.text() || 'Bạn có thông báo mới từ hệ thống điều hành',
        data: { route: '/tasks', linkHref: '/tasks' },
      };
    }
  }

  const title = payload.title || 'QCET E-Office';

  // Tag deduplication: canonical namespaces task:${id}:${action} or doc:${id}:directive
  let notificationTag = payload.tag;
  if (!notificationTag && payload.data) {
    const entityId = payload.data.entityId || payload.data.taskId;
    const type = String(payload.data.type || payload.data.action || payload.data.event || 'notice').toLowerCase();
    if (entityId) {
      if (String(entityId).startsWith('doc-') || type.includes('directive')) {
        const docId = String(entityId).replace(/^doc-/, '');
        notificationTag = `doc:${docId}:directive`;
      } else if (type.includes('review') || type.includes('deliverable')) {
        notificationTag = `task:${entityId}:review`;
      } else if (type.includes('assign')) {
        notificationTag = `task:${entityId}:assigned`;
      } else if (type.includes('deadline') || type.includes('warning')) {
        notificationTag = `task:${entityId}:deadline`;
      } else {
        notificationTag = `task:${entityId}:${type}`;
      }
    }
  }
  if (!notificationTag) {
    notificationTag = 'qcet-notification';
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo-qcet.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    data: payload.data || { route: '/tasks', linkHref: '/tasks' },
    vibrate: payload.vibrate || [100, 50, 100],
    tag: notificationTag,
    renotify: typeof payload.renotify === 'boolean' ? payload.renotify : true,
    requireInteraction: typeof payload.requireInteraction === 'boolean' ? payload.requireInteraction : false,
    actions: payload.actions || [],
  };

  const tasks = [self.registration.showNotification(title, options)];

  // Update app badge if supported
  if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') {
    const badgeCount =
      payload.data && typeof payload.data.badgeCount === 'number'
        ? payload.data.badgeCount
        : typeof payload.badgeCount === 'number'
        ? payload.badgeCount
        : 1;

    try {
      tasks.push(navigator.setAppBadge(badgeCount).catch(() => {}));
    } catch {
      // Ignore in environments without badge permission
    }
  }

  event.waitUntil(Promise.all(tasks));
});

// 6. Notification Click: Deep links with same-origin validation, client window focus / navigation
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const rawTargetUrl = data.route || data.url || data.linkHref || '/portal'; // Supported default routes: /portal or /tasks

  // Enforce strict same-origin route validation to prevent open redirects
  let targetUrl = '/tasks';
  try {
    const baseOrigin = self.location ? self.location.origin : 'http://localhost:3000';
    if (typeof rawTargetUrl === 'string' && /^(javascript|data|vbscript):/i.test(rawTargetUrl.trim())) {
      targetUrl = new URL('/tasks', baseOrigin).href;
    } else {
      const parsed = new URL(rawTargetUrl, baseOrigin);
      if (parsed.origin === baseOrigin) {
        targetUrl = parsed.href;
      } else {
        targetUrl = new URL('/tasks', baseOrigin).href;
      }
    }
  } catch {
    const baseOrigin = self.location ? self.location.origin : 'http://localhost:3000';
    targetUrl = new URL('/tasks', baseOrigin).href;
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

  // Click handling: match existing window and focus/navigate, or openWindow
  const windowPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // 1. Exact URL match -> focus
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // 2. Any same-origin window -> navigate and focus
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            return client.navigate(targetUrl).then((navigated) => (navigated || client).focus());
          }
          return client.focus();
        }
      }

      // 3. No existing window -> open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    });

  tasks.push(windowPromise);
  event.waitUntil(Promise.all(tasks));
});

// 7. Background Sync: Progressive sync for offline mutation outbox
self.addEventListener('sync', (event) => {
  if (event.tag === 'qcet-outbox-sync' || event.tag === 'qcet-outbox') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'QCET_OUTBOX_DRAIN' });
        }
      })
    );
  }
});
