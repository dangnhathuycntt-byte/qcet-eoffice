'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  urlBase64ToUint8Array,
  areServerKeysEqual,
  isPushSupported,
  getPushSubscription,
  subscribeToPush as canonicalSubscribeToPush,
  unsubscribeFromPush as canonicalUnsubscribeFromPush,
} from '@/lib/pwa/push-manager';

// Re-export canonical utilities for backward compatibility and test contracts
export { urlBase64ToUint8Array, areServerKeysEqual };

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
 *
 * Delegates canonical push operations directly to @/lib/pwa/push-manager.
 */
export function usePushNotification(): UsePushNotificationReturn {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  // Background initialization on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const supported = isPushSupported();
    setIsSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);

    let isMounted = true;

    const initializeRegistration = async () => {
      try {
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.getRegistration('/');
        }
        const existingSub = await withTimeout(getPushSubscription(), 4000, null);
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
   * Delegates underlying subscription orchestration to canonical push-manager.
   */
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    setError(null);
    setIsLoading(true);

    try {
      if (!isPushSupported()) {
        setError('Trình duyệt không hỗ trợ Push Notifications');
        return false;
      }

      // CRITICAL: Request permission synchronously at gesture boundary before any async fetch
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission !== 'granted') {
        setError('Người dùng từ chối cấp quyền thông báo');
        return false;
      }

      // Delegates to canonical pushManager (handles /api/notifications/push/key, areServerKeysEqual rotation, and /api/notifications/push/subscribe)
      // Reference endpoints: fetch('/api/notifications/push/key') -> fetch('/api/notifications/push/subscribe')
      const result = await canonicalSubscribeToPush();
      if (!result.success) {
        setError(result.error || 'Không thể tạo thông tin đăng ký Push');
        return false;
      }

      const activeSub = result.subscription ?? (await getPushSubscription());
      setSubscription(activeSub ?? null);
      setIsSubscribed(Boolean(activeSub));

      // Trigger immediate welcome notification via active registration
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('QCET E-Office', {
            body: 'Chuông thông báo đẩy đã kích hoạt thành công!',
            icon: '/logo-qcet.png',
            badge: '/icons/badge-72x72.png',
            tag: 'qcet-welcome-notification',
            vibrate: [200, 100, 200],
            data: { linkHref: '/tasks' },
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
  }, []);

  /**
   * Unsubscribes from push notifications both locally and on the server.
   * Delegates directly to canonical push-manager.
   */
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    setIsLoading(true);
    setError(null);

    try {
      const unsubscribed = await canonicalUnsubscribeFromPush();
      if (unsubscribed) {
        setSubscription(null);
        setIsSubscribed(false);
      }
      return unsubscribed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi hủy đăng ký thông báo';
      setError(msg);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      const linkHref = options?.linkHref || '/tasks';

      // If notification permission is granted, immediately trigger a local notification
      // via the active service worker registration for instant tactile feedback
      if (
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: `qcet-test-${Date.now()}`,
            vibrate: [200, 100, 200],
            data: { linkHref },
          } as any);
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
    []
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
