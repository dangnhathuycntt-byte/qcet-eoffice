/**
 * Push Notification Manager
 * Handles client-side push notification subscription lifecycle, VAPID key exchange,
 * iOS Safari standalone constraints, granular topic preferences, tag deduplication,
 * and secure same-origin deep link validation.
 */

import { checkIsIOS, checkIsStandalone } from "./onboarding-coordinator";
import {
  type PushPreferences,
  type PushTopic,
  getDefaultPushPreferences,
  loadLocalPushPreferences,
  saveLocalPushPreferences,
  syncServerPushPreferences,
  mapNotificationTypeToTopic,
  isTopicEnabled,
} from "./push-preferences";

export interface IOSPushStatus {
  isIOS: boolean;
  isStandalone: boolean;
  isPushSupported: boolean;
  requiresPwaInstall: boolean;
  message: string | null;
}

export interface PushSubscriptionResult {
  success: boolean;
  subscription?: PushSubscription | null;
  error?: string;
  code?:
    | "UNSUPPORTED"
    | "PERMISSION_DENIED"
    | "IOS_STANDALONE_REQUIRED"
    | "VAPID_MISSING"
    | "REGISTRATION_FAILED"
    | "SERVER_SYNC_FAILED";
  guidanceMessage?: string;
}

export interface NotificationPayloadData {
  entityId?: string;
  type?: string;
  route?: string;
  url?: string;
  linkHref?: string;
  [key: string]: unknown;
}

export interface FormattedPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag: string;
  data: NotificationPayloadData;
}

/**
 * Converts a base64 string to a Uint8Array suitable for PushManager.subscribe applicationServerKey
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData =
    typeof atob !== "undefined"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");

  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Compares an existing subscription applicationServerKey against a new target Uint8Array public key.
 * Used to detect VAPID key rotations and trigger automatic client-side re-subscription.
 */
export function areServerKeysEqual(
  existingKey: ArrayBuffer | ArrayBufferView | null | undefined,
  newKeyBytes: Uint8Array
): boolean {
  if (!existingKey) return false;
  const existingBytes =
    existingKey instanceof ArrayBuffer
      ? new Uint8Array(existingKey)
      : ArrayBuffer.isView(existingKey)
      ? new Uint8Array(existingKey.buffer, existingKey.byteOffset, existingKey.byteLength)
      : null;

  if (!existingBytes || existingBytes.length !== newKeyBytes.length) return false;
  for (let i = 0; i < existingBytes.length; i++) {
    if (existingBytes[i] !== newKeyBytes[i]) return false;
  }
  return true;
}

/**
 * Validates that a route or URL is strictly same-origin to prevent open redirect vulnerabilities.
 * Returns the normalized local path or fallback route if untrusted.
 */
export function validateSameOriginRoute(
  routeOrUrl: string | null | undefined,
  baseOrigin?: string
): string {
  const fallback = "/tasks";
  if (!routeOrUrl || typeof routeOrUrl !== "string") {
    return fallback;
  }

  const trimmed = routeOrUrl.trim();
  if (!trimmed) return fallback;

  // Block javascript:, data:, vbscript: protocols immediately
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return fallback;
  }

  try {
    const origin =
      baseOrigin ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

    // Relative path check
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      return trimmed;
    }

    const parsed = new URL(trimmed, origin);
    if (parsed.origin === origin) {
      return parsed.pathname + parsed.search + parsed.hash;
    }

    // Untrusted external origin detected -> fallback to safe internal route
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Generates deduplication tags adhering to canonical institutional namespaces:
 * - task:${taskId}:review
 * - task:${taskId}:assigned
 * - task:${taskId}:deadline
 * - doc:${docId}:directive
 */
export function generateNotificationTag(
  entityType: "task" | "doc" | string,
  entityId: string,
  actionOrType: string
): string {
  const cleanId = (entityId || "global").trim();
  const normalizedAction = actionOrType.toLowerCase().replace(/_/g, "-");

  if (entityType === "doc" || entityType === "document") {
    return `doc:${cleanId}:directive`;
  }

  if (normalizedAction.includes("review") || normalizedAction.includes("deliverable")) {
    return `task:${cleanId}:review`;
  }
  if (normalizedAction.includes("assign")) {
    return `task:${cleanId}:assigned`;
  }
  if (normalizedAction.includes("deadline") || normalizedAction.includes("warning")) {
    return `task:${cleanId}:deadline`;
  }

  return `task:${cleanId}:${normalizedAction}`;
}

/**
 * Checks platform compatibility specifically for iOS Safari.
 * Apple requires Web Push on iOS 16.4+ to be installed to the Home Screen (standalone mode).
 */
export function checkIOSPushStatus(
  userAgent?: string,
  maxTouchPoints?: number
): IOSPushStatus {
  const isIOS = checkIsIOS(userAgent, maxTouchPoints);
  const isStandalone = checkIsStandalone();

  if (!isIOS) {
    return {
      isIOS: false,
      isStandalone,
      isPushSupported: typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
      requiresPwaInstall: false,
      message: null,
    };
  }

  // iOS environment detected
  if (!isStandalone) {
    return {
      isIOS: true,
      isStandalone: false,
      isPushSupported: false,
      requiresPwaInstall: true,
      message:
        "Để nhận thông báo trên iPhone/iPad, vui lòng thêm ứng dụng vào Màn hình chính trước.",
    };
  }

  // iOS installed standalone
  const hasPushApi = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
  return {
    isIOS: true,
    isStandalone: true,
    isPushSupported: hasPushApi,
    requiresPwaInstall: false,
    message: hasPushApi
      ? null
      : "Thiết bị iOS của bạn cần cập nhật lên iOS 16.4 trở lên để kích hoạt thông báo đẩy.",
  };
}

/**
 * Checks general Web Push support in the current environment
 */
export function isPushSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // Check iOS constraint first
  const iosStatus = checkIOSPushStatus();
  if (iosStatus.isIOS && !iosStatus.isStandalone) {
    return false;
  }

  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Retrieves the current active PushSubscription from the service worker registration
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.error("Failed to get push subscription:", err);
    return null;
  }
}

/**
 * Fetches the VAPID public key from the server
 */
export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/notifications/push/key", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey || null;
  } catch (err) {
    console.error("Failed to fetch VAPID public key:", err);
    return null;
  }
}

/**
 * Full lifecycle push subscription flow:
 * 1. Checks iOS standalone requirement and Notification API support.
 * 2. Requests notification permission.
 * 3. Retrieves VAPID key.
 * 4. Calls registration.pushManager.subscribe().
 * 5. Syncs new subscription with backend.
 */
export async function subscribeToPush(options?: {
  vapidKey?: string;
  userId?: string | null;
  preferences?: PushPreferences;
}): Promise<PushSubscriptionResult> {
  const iosStatus = checkIOSPushStatus();
  if (iosStatus.isIOS && !iosStatus.isStandalone) {
    return {
      success: false,
      code: "IOS_STANDALONE_REQUIRED",
      error: "iOS PWA must be installed to Home Screen",
      guidanceMessage: iosStatus.message || undefined,
    };
  }

  if (!isPushSupported()) {
    return {
      success: false,
      code: "UNSUPPORTED",
      error: "Push notifications are not supported in this browser environment.",
    };
  }

  // 1. Request permission
  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return {
      success: false,
      code: "PERMISSION_DENIED",
      error: "Notification permission was denied by the user.",
    };
  }

  // 2. Fetch or use provided VAPID public key
  let vapidKey = options?.vapidKey;
  if (!vapidKey) {
    const fetched = await fetchVapidPublicKey();
    if (!fetched) {
      return {
        success: false,
        code: "VAPID_MISSING",
        error: "VAPID public key could not be retrieved from server.",
      };
    }
    vapidKey = fetched;
  }

  // 3. Register subscription via ServiceWorker PushManager
  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    const targetServerKey = urlBase64ToUint8Array(vapidKey);

    if (subscription) {
      // VAPID key rotation detection: if subscription key does not match target VAPID public key,
      // unsubscribe stale subscription and recreate with updated key
      const existingKey = subscription.options?.applicationServerKey;
      const isKeyMatching = areServerKeysEqual(existingKey, targetServerKey);
      if (!isKeyMatching) {
        try {
          await subscription.unsubscribe();
        } catch {
          // Ignore unsubscribe error and proceed to re-subscribe with new key
        }
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: targetServerKey as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return {
        success: false,
        code: "REGISTRATION_FAILED",
        error: "Malformed subscription keys received from browser.",
      };
    }

    // 4. Server Sync
    const syncRes = await fetch("/api/notifications/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint,
        keys: { p256dh, auth },
        userAgent: navigator.userAgent,
        deviceType: iosStatus.isIOS ? "ios" : "browser",
      }),
    });

    if (!syncRes.ok) {
      // Fallback endpoint test
      const altRes = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh, auth },
          userAgent: navigator.userAgent,
          deviceType: iosStatus.isIOS ? "ios" : "browser",
        }),
      });

      if (!altRes.ok) {
        return {
          success: false,
          code: "SERVER_SYNC_FAILED",
          error: "Failed to persist push subscription to server database.",
        };
      }
    }

    // 5. Store / Sync preferences
    const preferences = options?.preferences || loadLocalPushPreferences(options?.userId);
    saveLocalPushPreferences(preferences, options?.userId);
    await syncServerPushPreferences(preferences);

    return {
      success: true,
      subscription,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Push subscription error:", err);
    return {
      success: false,
      code: "REGISTRATION_FAILED",
      error: errorMsg,
    };
  }
}

/**
 * Unsubscribes from push notifications, notifies backend, and cleans up local registration
 */
export async function unsubscribeFromPush(options?: {
  userId?: string | null;
}): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return true;

    const endpoint = subscription.endpoint;

    // 1. Inform server to revoke / deactivate record
    try {
      await fetch("/api/notifications/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    } catch {
      // Continue client cleanup even if server is offline
    }

    // 2. Unsubscribe on browser
    const unsubscribed = await subscription.unsubscribe();
    return unsubscribed;
  } catch (err) {
    console.error("Failed to unsubscribe from push:", err);
    return false;
  }
}

/**
 * Formats a notification payload ensuring deduplication tags and same-origin routes
 */
export function formatNotificationPayload(
  title: string,
  body: string,
  options: {
    entityType?: "task" | "doc" | string;
    entityId?: string;
    action?: string;
    route?: string;
    customTag?: string;
  }
): FormattedPushPayload {
  const entityType = options.entityType || "task";
  const entityId = options.entityId || "general";
  const action = options.action || "notice";
  const tag =
    options.customTag || generateNotificationTag(entityType, entityId, action);

  const safeRoute = validateSameOriginRoute(options.route || `/tasks?taskId=${encodeURIComponent(entityId)}`);

  return {
    title: title.trim(),
    body: body.trim(),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag,
    data: {
      entityId,
      type: action.toUpperCase(),
      route: safeRoute,
      url: safeRoute,
      linkHref: safeRoute,
    },
  };
}

export {
  type PushPreferences,
  type PushTopic,
  getDefaultPushPreferences,
  loadLocalPushPreferences,
  saveLocalPushPreferences,
  syncServerPushPreferences,
  mapNotificationTypeToTopic,
  isTopicEnabled,
};
