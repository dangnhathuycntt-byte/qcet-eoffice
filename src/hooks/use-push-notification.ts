'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Converts a base64 or URL-safe base64 string to a Uint8Array.
 * Handles padding characters (=) and url-safe substitutions (- and _).
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  if (typeof atob === 'function') {
    const rawData = atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    const buffer = new ArrayBuffer(buf.byteLength);
    const outputArray = new Uint8Array(buffer);
    outputArray.set(buf);
    return outputArray;
  }

  throw new Error('No base64 decoding mechanism available');
}

/**
 * Detects device category for telemetry and notification targeting.
 */
function detectDeviceType(): string {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua))) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

/**
 * Race a promise against a safety timeout to prevent deadlocks on unsupported or unresponsive browsers.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs = 4000, fallbackVal: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallbackVal), timeoutMs);
  });
  return Promise.race([
    promise.then((val) => {
      if (timer) clearTimeout(timer);
      return val;
    }),
    timeoutPromise,
  ]);
}

const runWithTimeout = withTimeout;

export interface UsePushNotificationReturn {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscription: PushSubscription | null;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
  sendTestNotification: (options?: { title?: string; body?: string; linkHref?: string }) => Promise<boolean>;
}

/**
 * Hook to manage Web Push notification permission, subscription lifecycle,
 * and test push dispatch with iOS Safari user gesture invariants.
 */
export function usePushNotification(): UsePushNotificationReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Background initialization on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);

    let isMounted = true;

    const initializeRegistration = async () => {
      try {
        let reg: ServiceWorkerRegistration | null =
          (await withTimeout(navigator.serviceWorker.getRegistration('/'), 4000, null)) ?? null;
        if (!reg) {
          reg = await withTimeout(
            navigator.serviceWorker.register('/sw.js', { scope: '/' }),
            4000,
            null
          );
        }
        if (!isMounted || !reg) return;
        setRegistration(reg);

        const existingSub = await withTimeout(reg.pushManager.getSubscription(), 4000, null);
        if (!isMounted) return;

        if (existingSub) {
          setSubscription(existingSub);
          setIsSubscribed(true);
        } else {
          setSubscription(null);
          setIsSubscribed(false);
        }
        setPermission(Notification.permission);
      } catch (err) {
        console.warn('Failed to initialize push service worker registration:', err);
      }
    };

    void initializeRegistration();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Subscribes to web push notifications.
   * INVARIANT: Notification.requestPermission() must be invoked immediately
   * upon user click before any asynchronous network fetch to satisfy iOS Safari requirements.
   */
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    setError(null);
    setIsLoading(true);

    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('Trình duyệt không hỗ trợ Push Notifications');
        return false;
      }

      // CRITICAL: Request permission synchronously at gesture boundary
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission !== 'granted') {
        setError('Người dùng từ chối cấp quyền thông báo');
        return false;
      }

      // Ensure service worker registration is available
      let reg: ServiceWorkerRegistration | null = registration;
      if (!reg) {
        reg = (await withTimeout(navigator.serviceWorker.getRegistration('/'), 4000, null)) ?? null;
        if (!reg) {
          reg = await withTimeout(
            navigator.serviceWorker.register('/sw.js', { scope: '/' }),
            4000,
            null
          );
        }
        if (reg) {
          reg = await withTimeout(navigator.serviceWorker.ready, 4000, reg);
          setRegistration(reg);
        }
      }

      if (!reg) {
        throw new Error('Không thể đăng ký Service Worker cho thông báo');
      }

      // Fetch VAPID public key
      const keyRes = await fetch('/api/notifications/push/key');
      if (!keyRes.ok) {
        throw new Error('Không thể tải khóa công khai VAPID từ máy chủ');
      }
      const keyData = await keyRes.json();
      if (!keyData?.success || !keyData?.publicKey) {
        throw new Error(keyData?.error || 'Khóa VAPID không hợp lệ');
      }

      // Check for existing subscription or create new one
      let activeSub = await withTimeout(reg.pushManager.getSubscription(), 4000, null);

      if (!activeSub) {
        const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
        activeSub = await withTimeout(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          }),
          4000,
          null as unknown as PushSubscription
        );
      }

      if (!activeSub) {
        throw new Error('Không thể tạo thông tin đăng ký Push');
      }

      const subJson = activeSub.toJSON();
      const rawP256dh = activeSub.getKey ? (activeSub.getKey('p256dh') as ArrayBuffer | null) : null;
      const rawAuth = activeSub.getKey ? (activeSub.getKey('auth') as ArrayBuffer | null) : null;
      const p256dh = subJson.keys?.p256dh || (rawP256dh ? btoa(String.fromCharCode(...new Uint8Array(rawP256dh))) : '');
      const auth = subJson.keys?.auth || (rawAuth ? btoa(String.fromCharCode(...new Uint8Array(rawAuth))) : '');

      const subRes = await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: activeSub.endpoint,
          p256dh,
          auth,
          deviceType: detectDeviceType(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        }),
      });

      const subData = await subRes.json().catch(() => null);
      if (!subRes.ok || !subData?.success) {
        throw new Error(subData?.error || 'Máy chủ không thể lưu thông tin đăng ký');
      }

      setSubscription(activeSub);
      setIsSubscribed(true);

      // Trigger immediate welcome notification via active registration
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && reg) {
        try {
          reg.showNotification('QCET E-Office', {
            body: 'Chuông thông báo đẩy đã kích hoạt thành công!',
            icon: '/logo-qcet.png',
            badge: '/icons/badge-72x72.png',
            tag: 'qcet-welcome-notification',
            vibrate: [200, 100, 200],
            data: { linkHref: '/?zone=tasks' },
          } as any);
        } catch {
          // ignore notification display error
        }
      }

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định khi kích hoạt thông báo';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration]);

  /**
   * Unsubscribes from push notifications both locally and on the server.
   */
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    setIsLoading(true);
    setError(null);

    try {
      let activeSub = subscription;
      if (!activeSub && registration) {
        activeSub = await withTimeout(registration.pushManager.getSubscription(), 4000, null);
      }

      if (!activeSub) {
        setIsSubscribed(false);
        setSubscription(null);
        return true;
      }

      const endpoint = activeSub.endpoint;

      // Unsubscribe at the browser level
      await activeSub.unsubscribe();

      // Revoke on the server
      await fetch('/api/notifications/push/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint }),
      }).catch((err) => {
        console.warn('Failed to revoke subscription on server:', err);
      });

      setSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi hủy đăng ký thông báo';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [subscription, registration]);

  /**
   * Triggers a test push notification to verify push delivery and badge display.
   */
  const sendTestNotification = useCallback(
    async (options?: { title?: string; body?: string; linkHref?: string }): Promise<boolean> => {
      if (typeof window === 'undefined') return false;

      setIsLoading(true);
      setError(null);

      const title = options?.title || 'Thử nghiệm thông báo QCET';
      const body =
        options?.body ||
        'Đây là thông báo đẩy thử nghiệm kiểm tra tính năng chuông trên thiết bị.';
      const linkHref = options?.linkHref || '/?zone=tasks';

      // If notification permission is granted, immediately trigger a local notification
      // via the active service worker registration for instant tactile feedback
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted' &&
        registration
      ) {
        try {
          (registration as any).showNotification(title, {
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: `qcet-test-${Date.now()}`,
            vibrate: [200, 100, 200],
            data: { linkHref },
          });
        } catch {
          // ignore display error
        }
      }

      try {
        const res = await fetch('/api/notifications/push/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            body,
            linkHref,
          }),
        });

        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          return true;
        }

        const errMsg = data?.error || 'Không thể gửi thông báo thử nghiệm';
        setError(errMsg);
        return false;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi mạng khi gửi thông báo thử nghiệm';
        setError(msg);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [registration]
  );

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscription,
    subscribeToPush,
    unsubscribeFromPush,
    sendTestNotification,
  };
}
