import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import {
  setPushSenderForTesting,
  getVapidPublicKey,
  formatTaskPushPayload,
  sendPushNotificationToUser,
  TaskPushEventType,
} from '../src/lib/push-service';
import {
  dispatchTaskAssignedPush,
  safeAfter,
  flushSafeAfter,
} from '../src/lib/push-dispatch';
import {
  GET as getPushSubscribe,
  POST as postPushSubscribe,
  DELETE as deletePushSubscribe,
} from '../src/app/api/push/subscribe/route';
import { POST as postPushTest } from '../src/app/api/push/test/route';
import manifestFn from '../src/app/manifest';
import { checkIsIOS } from '../src/hooks/use-pwa-install';
import { UserRole } from '@prisma/client';

describe('Mobile PWA & Push Notification End-to-End Test Suite', () => {
  let testUser: { id: string; name: string; email: string; role: string; departmentId: string | null };
  let adminUser: { id: string; name: string; email: string; role: string; departmentId: string | null };
  let userToken: string;
  let adminToken: string;

  const testEndpoint1 = 'https://fcm.googleapis.com/fcm/send/test-e2e-endpoint-device-1';
  const testEndpoint2 = 'https://fcm.googleapis.com/fcm/send/test-e2e-endpoint-device-2';
  const testP256dh = 'BM5xK1Gq0jP4rW_eT_e2e_fake_p256dh_key_base64_data';
  const testAuth = 'e2e_fake_auth_secret_base64';

  const createdNotificationIds: string[] = [];
  const createdTaskIds: string[] = [];
  const sentPushMockCalls: Array<{ subscription: any; payload: any }> = [];

  before(async () => {
    // 1. Setup mock push sender
    setPushSenderForTesting(async (sub, payload) => {
      sentPushMockCalls.push({
        subscription: sub,
        payload: payload ? JSON.parse(payload.toString()) : null,
      });
      return { statusCode: 200, body: 'OK', headers: {} };
    });

    // 2. Resolve or fallback test users
    let user = await prisma.user.findFirst({
      where: { role: UserRole.CHUYEN_VIEN },
    });
    if (!user) {
      user = await prisma.user.findFirst();
    }
    assert.ok(user, 'At least one user must exist in the database');
    testUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    };

    let admin = await prisma.user.findFirst({
      where: { role: { in: [UserRole.BAN_GIAM_HIEU, UserRole.ADMIN] } },
    });
    if (!admin) {
      admin = user;
    }
    adminUser = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      departmentId: admin.departmentId,
    };

    userToken = signSessionToken({
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      role: testUser.role,
      departmentId: testUser.departmentId || undefined,
    });

    adminToken = signSessionToken({
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      departmentId: adminUser.departmentId || undefined,
    });

    // Clean up existing test subscriptions if any
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: [testEndpoint1, testEndpoint2] } },
    });
  });

  after(async () => {
    // Restore default push sender
    setPushSenderForTesting(null);

    // Clean up test subscriptions
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: [testEndpoint1, testEndpoint2] } },
    });

    // Clean up test notifications
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } },
      });
    }

    // Clean up test tasks
    if (createdTaskIds.length > 0) {
      await prisma.taskAssignee.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }
  });

  test('1. VAPID Configuration & Public Key API endpoint (GET /api/push/subscribe)', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/subscribe', {
      method: 'GET',
    });
    const res = await getPushSubscribe(req);
    assert.strictEqual(res.status, 200, 'GET /api/push/subscribe must return HTTP 200');

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(typeof json.publicKey === 'string' && json.publicKey.length > 20);
    assert.strictEqual(json.publicKey, getVapidPublicKey());
  });

  test('2. Subscription registration (POST /api/push/subscribe) with user agent, platform, endpoint, keys', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${userToken}`,
      },
      body: JSON.stringify({
        endpoint: testEndpoint1,
        keys: {
          p256dh: testP256dh,
          auth: testAuth,
        },
        platform: 'iOS',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      }),
    });

    const res = await postPushSubscribe(req);
    assert.strictEqual(res.status, 200, 'POST /api/push/subscribe must return HTTP 200');

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.subscriptionId, 'Must return created subscription ID');

    const saved = await prisma.pushSubscription.findUnique({
      where: { endpoint: testEndpoint1 },
    });
    assert.ok(saved, 'Subscription record must exist in database');
    assert.strictEqual(saved.userId, testUser.id);
    assert.strictEqual(saved.status, 'ACTIVE');
    assert.strictEqual(saved.deviceType, 'iOS');
    assert.strictEqual(saved.p256dh, testP256dh);
    assert.strictEqual(saved.auth, testAuth);
    assert.ok(saved.userAgent?.includes('iPhone'));
  });

  test('3. Subscription deletion / revocation (DELETE /api/push/subscribe)', async () => {
    const req = new NextRequest('http://localhost:3000/api/push/subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${userToken}`,
      },
      body: JSON.stringify({
        endpoint: testEndpoint1,
      }),
    });

    const res = await deletePushSubscribe(req);
    assert.strictEqual(res.status, 200, 'DELETE /api/push/subscribe must return HTTP 200');

    const json = await res.json();
    assert.strictEqual(json.success, true);

    const revoked = await prisma.pushSubscription.findUnique({
      where: { endpoint: testEndpoint1 },
    });
    assert.ok(revoked);
    assert.strictEqual(revoked.status, 'REVOKED', 'Subscription status must transition to REVOKED');
  });

  test('4. Test notification dispatch endpoint (POST /api/push/test)', async () => {
    // Re-activate subscription for dispatch
    await prisma.pushSubscription.update({
      where: { endpoint: testEndpoint1 },
      data: { status: 'ACTIVE' },
    });

    sentPushMockCalls.length = 0;

    const req = new NextRequest('http://localhost:3000/api/push/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${userToken}`,
      },
      body: JSON.stringify({
        title: 'Kiem tra chuong thong bao',
        body: 'Noi dung thong bao thu nghiem van hanh tren dien thoai di dong',
        linkHref: '/portal?tab=notifications',
      }),
    });

    const res = await postPushTest(req);
    assert.strictEqual(res.status, 200, 'POST /api/push/test must return HTTP 200');

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.notification?.id);
    createdNotificationIds.push(json.notification.id);

    // Verify sent push notification payload received by mock
    assert.ok(sentPushMockCalls.length >= 1, 'Mock sender must record at least 1 push delivery');
    const lastCall = sentPushMockCalls[sentPushMockCalls.length - 1];
    assert.strictEqual(lastCall.payload.data.linkHref, '/portal?tab=notifications');

    // Verify in-app notification record in DB
    const dbNotif = await prisma.notification.findUnique({
      where: { id: json.notification.id },
    });
    assert.ok(dbNotif);
    assert.strictEqual(dbNotif.userId, testUser.id);
    assert.strictEqual(dbNotif.isRead, false);
    assert.strictEqual(dbNotif.type, 'test');
  });

  test('5. Notification record lifecycle: Task action triggers background notification creation in Prisma database', async () => {
    const uniqueCode = `TEST-E2E-${Date.now()}`;
    const testTask = await prisma.task.create({
      data: {
        code: uniqueCode,
        title: 'Nhiem vu kiem thu he thong push PWA toan dien',
        priority: 'NORMAL',
        scope: 'DEPARTMENT',
        academicMonth: 9,
        academicYear: '2026-2027',
        dueDate: new Date(Date.now() + 86400000 * 2),
        departmentId: testUser.departmentId,
        createdById: adminUser.id,
        assignees: {
          create: {
            userId: testUser.id,
          },
        },
      },
    });
    createdTaskIds.push(testTask.id);

    // Trigger push notification dispatch via safeAfter background wrapper
    safeAfter(async () => {
      await dispatchTaskAssignedPush({
        task: {
          id: testTask.id,
          title: testTask.title,
          dueDate: new Date(Date.now() + 86400000 * 2),
        },
        actorName: adminUser.name,
        assigneeId: testUser.id,
      });
    });

    // Await background execution
    await flushSafeAfter();

    // Verify notification was created in database
    const notif = await prisma.notification.findFirst({
      where: {
        userId: testUser.id,
        type: { in: ['assigned', 'TASK_ASSIGNED'] },
        linkHref: { contains: testTask.id },
      },
      orderBy: { createdAt: 'desc' },
    });

    assert.ok(notif, 'A TASK_ASSIGNED notification must be created in Prisma');
    createdNotificationIds.push(notif.id);
    assert.strictEqual(notif.userId, testUser.id);
    assert.strictEqual(notif.isRead, false);
    assert.strictEqual(notif.category, 'task');
    assert.ok(notif.title.length > 0);
    assert.ok(notif.body.length > 0);
    assert.ok(notif.linkHref.includes(testTask.id));
  });

  test('6. Copywriting Matrix compliance: All 6 core events adhere to character budgets (Title <= 35 chars, Body <= 90 chars)', () => {
    const coreEvents: TaskPushEventType[] = [
      'TASK_ASSIGNED',
      'DELIVERABLE_SUBMITTED',
      'DELIVERABLE_APPROVED',
      'DELIVERABLE_REVISION',
      'DEADLINE_WARNING_24H',
      'EXECUTIVE_DIRECTIVE',
    ];

    const longTitle = 'Bao cao tong ket nghiem thu de tai khoa hoc cong nghe cap truong nam hoc 2025-2026';
    const longDirective = 'Yeu cau dong chi Truong phong khan truong ra soat lai toan bo ho so chung tu giai ngan dot 1 va trinh Ban Giam Hieu truoc ngay 15';

    for (const event of coreEvents) {
      const payload = formatTaskPushPayload({
        event,
        taskId: 'task-cuid-123',
        taskTitle: longTitle,
        actorName: 'Hieu truong TS. Nguyen Van A',
        dueDateStr: '24/09/2026',
        directiveNote: longDirective,
      });

      assert.ok(
        payload.title.length <= 35,
        `Event ${event} title (${payload.title.length} chars) exceeded 35 chars budget: "${payload.title}"`
      );
      assert.ok(
        payload.body.length <= 90,
        `Event ${event} body (${payload.body.length} chars) exceeded 90 chars budget: "${payload.body}"`
      );
      assert.ok(payload.tag.startsWith('task-task-cuid-123-'), 'Tag must follow task-taskId-action format');
      assert.ok(payload.data.linkHref.length > 0, 'linkHref must not be empty');
    }
  });

  test('7. Zero emoji policy verification across all push copywriting templates, service worker messages, and PWA assets', () => {
    const filesToCheck = [
      'src/lib/push-service.ts',
      'src/lib/push-dispatch.ts',
      'src/app/manifest.ts',
      'public/sw.js',
      'src/components/pwa/push-onboarding-sheet.tsx',
      'src/hooks/use-pwa-install.ts',
      'src/hooks/use-push-notification.ts',
    ];

    // Standard Unicode ranges for emojis
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const relPath of filesToCheck) {
      const absPath = path.resolve(process.cwd(), relPath);
      assert.ok(fs.existsSync(absPath), `Target file ${relPath} must exist`);

      const content = fs.readFileSync(absPath, 'utf8');
      const match = content.match(emojiRegex);
      assert.strictEqual(
        match,
        null,
        `Found forbidden emoji in ${relPath}: ${match ? match[0] : ''}`
      );
    }
  });

  test('8. PWA manifest assets (src/app/manifest.ts, app name, icons 192/512/maskable, standalone display, start_url, theme_color)', () => {
    const manifest = manifestFn();

    assert.ok(
      manifest.name === 'QCET E-Office - Hệ thống Điều hành Văn phòng Điện tử' ||
      manifest.name === 'QCET E-Office - Trường CĐ Kinh tế & Công nghệ Quảng Ninh' ||
      manifest.name === 'QCET E-Office - Trường CĐ Kinh tế & Công nghệ ',
      `Unexpected manifest name: ${manifest.name}`
    );
    assert.strictEqual(manifest.short_name, 'QCET E-Office');
    assert.strictEqual(manifest.display, 'standalone');
    assert.ok(
      manifest.start_url === '/' || manifest.start_url === '/?source=pwa',
      `Unexpected start_url: ${manifest.start_url}`
    );
    assert.ok(
      ['#1e3a8a', '#fbfbfb', '#0f172a'].includes(manifest.theme_color as string),
      'Theme color must be standard blue, slate-900, or light #fbfbfb'
    );

    // Check icons
    const icons = manifest.icons as Array<{ src: string; sizes: string; purpose?: string }>;
    assert.ok(Array.isArray(icons) && icons.length >= 2, 'Manifest must have at least 2 icon declarations');

    const has192 = icons.some((i) => i.sizes === '192x192');
    const has512 = icons.some((i) => i.sizes === '512x512');
    const hasMaskable = icons.some((i) => i.purpose?.includes('maskable'));

    assert.ok(has192, 'Manifest must provide 192x192 icon');
    assert.ok(has512, 'Manifest must provide 512x512 icon');
    assert.ok(hasMaskable, 'Manifest must provide maskable icon');
  });

  test('9. Service Worker (public/sw.js) push event handler, notificationclick event handler with deep link focus/open, offline fallback cache', () => {
    const swPath = path.resolve(process.cwd(), 'public/sw.js');
    assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');

    const swContent = fs.readFileSync(swPath, 'utf8');

    // Push event handler
    assert.ok(swContent.includes("addEventListener('push'"), 'Service worker must handle push event');
    assert.ok(swContent.includes('showNotification'), 'Service worker must call showNotification');
    assert.ok(swContent.includes('setAppBadge'), 'Service worker must support badge updates');

    // Notification click event handler
    assert.ok(swContent.includes("addEventListener('notificationclick'"), 'Service worker must handle notificationclick');
    assert.ok(swContent.includes('notification.close()'), 'Notification must be closed on click');
    assert.ok(swContent.includes('clients.matchAll'), 'Service worker must search for open client windows');
    assert.ok(swContent.includes('client.focus()'), 'Service worker must focus existing window');
    assert.ok(swContent.includes('openWindow'), 'Service worker must open window if not found');

    // Offline fallback cache
    assert.ok(swContent.includes('CACHE_NAME'), 'Service worker must define cache name');
    assert.ok(swContent.includes("addEventListener('fetch'"), 'Service worker must handle fetch event for offline');
    assert.ok(swContent.includes('caches.match'), 'Service worker must match cached response');
  });

  test('10. Client hooks & Onboarding components contract (usePWAInstall, usePushNotification, PushOnboardingSheet)', () => {
    // Check iOS detection logic in usePWAInstall
    assert.strictEqual(checkIsIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
    assert.strictEqual(checkIsIOS('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)'), true);
    assert.strictEqual(checkIsIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), true); // iPadOS 13+
    assert.strictEqual(checkIsIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), false); // Standard Mac desktop
    assert.strictEqual(checkIsIOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), false); // Android

    // Verify source integrity of hooks and component
    const pwaHookPath = path.resolve(process.cwd(), 'src/hooks/use-pwa-install.ts');
    const pushHookPath = path.resolve(process.cwd(), 'src/hooks/use-push-notification.ts');
    const sheetComponentPath = path.resolve(process.cwd(), 'src/components/pwa/push-onboarding-sheet.tsx');

    assert.ok(fs.existsSync(pwaHookPath));
    assert.ok(fs.existsSync(pushHookPath));
    assert.ok(fs.existsSync(sheetComponentPath));

    const pwaSource = fs.readFileSync(pwaHookPath, 'utf8');
    assert.ok(pwaSource.includes('usePWAInstall'));
    assert.ok(pwaSource.includes('beforeinstallprompt'));

    const pushSource = fs.readFileSync(pushHookPath, 'utf8');
    assert.ok(pushSource.includes('usePushNotification'));
    assert.ok(pushSource.includes('subscribeToPush'));
    assert.ok(pushSource.includes('unsubscribeFromPush'));

    const sheetSource = fs.readFileSync(sheetComponentPath, 'utf8');
    assert.ok(sheetSource.includes('PushOnboardingSheet'));
    assert.ok(sheetSource.includes('BottomSheet'));
  });

  test('11. Self-healing subscription handling: 410 Gone / 404 Not Found status marks database subscription as REVOKED', async () => {
    // Setup 2 subscriptions in DB
    const sub1 = await prisma.pushSubscription.upsert({
      where: { endpoint: testEndpoint1 },
      update: { status: 'ACTIVE', failureCount: 0, lastFailureCode: null },
      create: {
        userId: testUser.id,
        endpoint: testEndpoint1,
        p256dh: testP256dh,
        auth: testAuth,
        status: 'ACTIVE',
      },
    });

    const sub2 = await prisma.pushSubscription.upsert({
      where: { endpoint: testEndpoint2 },
      update: { status: 'ACTIVE', failureCount: 0, lastFailureCode: null },
      create: {
        userId: testUser.id,
        endpoint: testEndpoint2,
        p256dh: testP256dh,
        auth: testAuth,
        status: 'ACTIVE',
      },
    });

    // Mock sender to simulate sub1 returning 410 Gone, and sub2 succeeding
    setPushSenderForTesting(async (sub) => {
      if (sub.endpoint === testEndpoint1) {
        const error: any = new Error('Subscription expired or unsubscribed');
        error.statusCode = 410;
        throw error;
      }
      return { statusCode: 200, body: 'OK', headers: {} };
    });

    const payload = formatTaskPushPayload({
      event: 'TASK_ASSIGNED',
      taskId: 'test-self-healing-task',
      taskTitle: 'Kiem thu co che tu phuc hoi subscription',
      actorName: 'QCET System',
    });

    const result = await sendPushNotificationToUser(testUser.id, payload);

    assert.strictEqual(result.revokedCount, 1, 'Revoked count must be 1');
    assert.ok(result.sentCount >= 1, 'Sent count must be at least 1');

    // Verify DB states
    const updatedSub1 = await prisma.pushSubscription.findUnique({
      where: { id: sub1.id },
    });
    const updatedSub2 = await prisma.pushSubscription.findUnique({
      where: { id: sub2.id },
    });

    assert.ok(updatedSub1);
    assert.strictEqual(updatedSub1.status, 'REVOKED', 'Expired endpoint must be marked as REVOKED');
    assert.strictEqual(updatedSub1.lastFailureCode, 410);

    assert.ok(updatedSub2);
    assert.strictEqual(updatedSub2.status, 'ACTIVE', 'Healthy endpoint must remain ACTIVE');
  });
});
