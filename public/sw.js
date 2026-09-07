// QCET E-Office Service Worker
// Version: 1.0.0
// Handles push notifications, badge counts, and client navigation

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
