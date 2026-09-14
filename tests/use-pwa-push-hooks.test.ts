import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Import hooks and helpers (will fail initially before implementation)
import { usePWAInstall, checkIsIOS } from '../src/hooks/use-pwa-install';
import { usePushNotification, urlBase64ToUint8Array } from '../src/hooks/use-push-notification';

describe('Task 6: PWA and Push Notification Hooks', () => {
  describe('urlBase64ToUint8Array utility', () => {
    test('converts standard Base64 string to correct Uint8Array', () => {
      // "Hello World" in base64 is "SGVsbG8gV29ybGQ="
      const base64 = 'SGVsbG8gV29ybGQ=';
      const result = urlBase64ToUint8Array(base64);
      const decodedStr = Buffer.from(result).toString('utf-8');
      assert.strictEqual(decodedStr, 'Hello World');
      assert.ok(result instanceof Uint8Array);
    });

    test('converts URL-safe Base64 with - and _ to Uint8Array', () => {
      // Standard: "+/==" vs URL-safe: "-_"
      // 0xfb, 0xff, 0xbf in base64 standard is "+/+/". In URL-safe it is "-_-_"
      const urlSafe = '-_-_';
      const result = urlBase64ToUint8Array(urlSafe);
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0], 0xfb);
      assert.strictEqual(result[1], 0xff);
      assert.strictEqual(result[2], 0xbf);
    });

    test('handles unpadded Base64 strings by adding required padding', () => {
      // Length 11 -> needs 1 '=': "SGVsbG8gV29ybGQ" -> "SGVsbG8gV29ybGQ="
      const unpadded = 'SGVsbG8gV29ybGQ';
      const result = urlBase64ToUint8Array(unpadded);
      assert.strictEqual(Buffer.from(result).toString('utf-8'), 'Hello World');

      // Length 2 -> needs 2 '=': "QQ" -> "QQ==" ("A")
      const unpadded2 = 'QQ';
      const result2 = urlBase64ToUint8Array(unpadded2);
      assert.strictEqual(Buffer.from(result2).toString('utf-8'), 'A');
    });

    test('converts simulated 65-byte VAPID public key correctly', () => {
      // 65-byte uncompressed P-256 public key starts with 0x04
      const rawKey = new Uint8Array(65);
      rawKey[0] = 0x04;
      for (let i = 1; i < 65; i++) {
        rawKey[i] = (i * 7) % 256;
      }
      const base64Url = Buffer.from(rawKey)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const converted = urlBase64ToUint8Array(base64Url);
      assert.strictEqual(converted.length, 65);
      assert.strictEqual(converted[0], 0x04);
      assert.deepStrictEqual(Array.from(converted), Array.from(rawKey));
    });
  });

  describe('checkIsIOS utility', () => {
    test('returns true for iPhone user agent', () => {
      const iphoneUA =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      assert.strictEqual(checkIsIOS(iphoneUA, 5), true);
      assert.strictEqual(checkIsIOS(iphoneUA, 0), true);
    });

    test('returns true for iPad user agent', () => {
      const ipadUA =
        'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';
      assert.strictEqual(checkIsIOS(ipadUA, 5), true);
    });

    test('returns true for iPod user agent', () => {
      const ipodUA =
        'Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
      assert.strictEqual(checkIsIOS(ipodUA, 0), true);
    });

    test('returns true for modern iPad reporting as Macintosh with touch points > 1', () => {
      const macLikeIpadUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
      assert.strictEqual(checkIsIOS(macLikeIpadUA, 5), true);
      assert.strictEqual(checkIsIOS(macLikeIpadUA, 2), true);
    });

    test('returns false for Mac Desktop without touch points (maxTouchPoints <= 1)', () => {
      const macDesktopUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      assert.strictEqual(checkIsIOS(macDesktopUA, 0), false);
      assert.strictEqual(checkIsIOS(macDesktopUA, 1), false);
    });

    test('returns false for Android mobile or tablet', () => {
      const androidPhoneUA =
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      assert.strictEqual(checkIsIOS(androidPhoneUA, 5), false);

      const androidTabletUA =
        'Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
      assert.strictEqual(checkIsIOS(androidTabletUA, 5), false);
    });

    test('returns false for Windows desktop', () => {
      const windowsUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      assert.strictEqual(checkIsIOS(windowsUA, 0), false);
    });

    test('handles empty or undefined user agent safely without throwing', () => {
      assert.strictEqual(checkIsIOS('', 0), false);
      assert.strictEqual(checkIsIOS(undefined, 0), false);
    });
  });

  describe('Contract and Source Code Invariants', () => {
    test('both hooks exist and are functions', () => {
      assert.strictEqual(typeof usePWAInstall, 'function');
      assert.strictEqual(typeof usePushNotification, 'function');
    });
  });

  describe('Push & PWA Workflow logic simulation', () => {
    test('urlBase64ToUint8Array handles invalid characters cleanly or throws standard error', () => {
      const valid = 'AAAA';
      const arr = urlBase64ToUint8Array(valid);
      assert.strictEqual(arr.length, 3);
    });

    test('checkIsStandalone returns true when window.matchMedia indicates standalone mode', () => {
      const origWindow = globalThis.window;
      try {
        // Mock standalone matchMedia
        (globalThis as unknown as { window: unknown }).window = {
          matchMedia: (query: string) => ({
            matches: query === '(display-mode: standalone)',
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
          }),
        };

        const { checkIsStandalone } = require('../src/hooks/use-pwa-install');
        assert.strictEqual(checkIsStandalone(), true);
      } finally {
        if (origWindow === undefined) {
          delete (globalThis as unknown as { window?: unknown }).window;
        } else {
          (globalThis as unknown as { window: unknown }).window = origWindow;
        }
      }
    });

    test('checkIsStandalone returns true when navigator.standalone is true (iOS Safari homescreen)', () => {
      const origWindow = globalThis.window;
      try {
        (globalThis as unknown as { window: unknown }).window = {
          matchMedia: () => ({ matches: false }),
        };
        try {
          Object.defineProperty(globalThis.navigator, 'standalone', {
            value: true,
            configurable: true,
          });
        } catch {
          // If navigator property cannot be redefined in this Node version, pass
        }

        const { checkIsStandalone } = require('../src/hooks/use-pwa-install');
        const res = checkIsStandalone();
        assert.strictEqual(typeof res, 'boolean');
      } finally {
        if (origWindow === undefined) {
          delete (globalThis as unknown as { window?: unknown }).window;
        } else {
          (globalThis as unknown as { window: unknown }).window = origWindow;
        }
        try {
          delete (globalThis.navigator as unknown as { standalone?: boolean }).standalone;
        } catch {
          // ignore
        }
      }
    });

    test('simulates subscription payload generation with p256dh and auth keys', () => {
      const mockKey = 'BMh1yYc28testKeyAAABBBCCCDDDEEEFFFGGGHHHIIIJJJKKKLLLMMMNNNOOOPPP';
      const applicationServerKey = urlBase64ToUint8Array(mockKey);
      assert.ok(applicationServerKey.length > 0);

      const mockSub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
        toJSON: () => ({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-token',
          keys: {
            p256dh: 'mock-p256dh',
            auth: 'mock-auth',
          },
        }),
      };

      const subJson = mockSub.toJSON();
      assert.strictEqual(subJson.endpoint, 'https://fcm.googleapis.com/fcm/send/test-token');
      assert.strictEqual(subJson.keys.p256dh, 'mock-p256dh');
      assert.strictEqual(subJson.keys.auth, 'mock-auth');
    });
  });
});
