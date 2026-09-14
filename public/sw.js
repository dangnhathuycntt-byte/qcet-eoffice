// QCET E-Office Service Worker
// Version: 2026.09.10.1 - PWA Architecture & Cache Hardening
// Contract: Versioned caches, controlled lifecycle, resource-tailored caching matrix, same-origin deep-link routing

const APP_VERSION = '2026.09.10.1';
const CACHE_STATIC_NAME = 'qcet-static-2026.09.10.1';
const CACHE_SHELL_NAME = 'qcet-shell-2026.09.10.1';
const CACHE_NAME = 'qcet-eoffice-v4'; // Legacy alias for backward compatibility
const API_CACHE_NAME = 'qcet-api-v2'; // Legacy API cache constant
const CURRENT_CACHES = [CACHE_STATIC_NAME, CACHE_SHELL_NAME, CACHE_NAME, API_CACHE_NAME];

const OFFLINE_FALLBACK_URL = '/tasks';
const API_TIMEOUT_MS = 2500;

const PRECACHE_ASSETS = [
  '/',
  '/tasks',
  '/?zone=tasks', // Legacy alias supported for backwards compatibility
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
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
              .filter((name) => !CURRENT_CACHES.includes(name) && !name.startsWith('qcet-api'))
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

  // API Endpoints: Network Only. Never intercept or cache in SW (F08).
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // A. Static Assets: Cache First Strategy (F08: strict allowlist, no generic extension match)
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/logo-qcet.png' ||
    url.pathname === '/logo-qcet.webp' ||
    url.pathname === '/favicon.ico';

  if (isStaticAsset) {
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

  // B. Navigation / App Shell: Network First -> fallback to cached shell -> offline HTML response
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
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
      color: #1e293b;
      padding: 20px;
      text-align: center;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      padding: 36px 28px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
      border: 1px solid #e2e8f0;
    }
    .icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: #eff6ff;
      color: #0e53b4;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      margin: 0 0 10px;
      color: #0f172a;
    }
    p {
      font-size: 0.925rem;
      color: #64748b;
      line-height: 1.55;
      margin: 0 0 24px;
    }
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 24px;
      background: #0e53b4;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 0.925rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s ease, transform 0.1s ease;
    }
    button:hover {
      background: #0b4394;
    }
    button:active {
      transform: scale(0.98);
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #090d16;
        color: #f1f5f9;
      }
      .card {
        background: #111827;
        border-color: #1f2937;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      }
      .icon-wrap {
        background: rgba(14, 83, 180, 0.2);
        color: #60a5fa;
      }
      h1 {
        color: #f8fafc;
      }
      p {
        color: #94a3b8;
      }
      button {
        background: #0e53b4;
      }
      button:hover {
        background: #0b4394;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrap">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="2" y1="2" x2="22" y2="22"></line>
        <path d="M8.5 16.5a5 5 0 0 1 7 0"></path>
        <path d="M4.93 10.93a10 10 0 0 1 12.02-.57"></path>
        <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    </div>
    <h1>Hệ thống đang ngoại tuyến</h1>
    <p>Hiện không có kết nối Internet. Vui lòng kiểm tra lại đường truyền mạng hoặc thử kết nối lại.</p>
    <button type="button" onclick="window.location.reload()">Thử tải lại</button>
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
  const rawTargetUrl = data.route || data.url || data.linkHref || '/tasks'; // Supported default route: /tasks

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
