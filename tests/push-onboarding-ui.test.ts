import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

describe('Task 7: Push Onboarding & Mobile Settings UI', () => {
  const pwaSheetPath = path.resolve(process.cwd(), 'src/components/pwa/push-onboarding-sheet.tsx');
  const mobileMenuDrawerPath = path.resolve(process.cwd(), 'src/components/layout/mobile-menu-drawer.tsx');
  const appShellPath = path.resolve(process.cwd(), 'src/components/layout/app-shell.tsx');

  describe('PushOnboardingSheet File & Source Contract', () => {
    test('push-onboarding-sheet.tsx exists', () => {
      assert.ok(fs.existsSync(pwaSheetPath), 'File src/components/pwa/push-onboarding-sheet.tsx should exist');
    });

    test('PushOnboardingSheet source complies with senior-friendly requirements', () => {
      const content = fs.readFileSync(pwaSheetPath, 'utf-8');

      // "use client" directive
      assert.ok(content.includes('"use client"') || content.includes("'use client'"), 'Must be a client component');

      // Uses hooks
      assert.ok(content.includes('usePWAInstall'), 'Must use usePWAInstall hook');
      assert.ok(content.includes('usePushNotification'), 'Must use usePushNotification hook');

      // Senior-friendly touch target: min-h-[52px]
      assert.ok(content.includes('min-h-[52px]'), 'Must include min-h-[52px] touch targets for senior-friendly ergonomics');

      // Senior-friendly typography: base text or larger (heading >= 18/20px, body >= 16px)
      assert.ok(content.includes('text-base') || content.includes('text-lg') || content.includes('text-xl'), 'Must use large readable typography');

      // iOS Safari 3-step guide copy
      assert.ok(content.includes('Cài đặt QCET E-Office lên màn hình chính'), 'Must have iOS guide title');
      assert.ok(content.includes('Chia sẻ') || content.includes('chia sẻ'), 'Must mention Chia sẻ in iOS instructions');
      assert.ok(content.includes('Thêm vào Màn hình chính') || content.includes('Thêm vào MH chính'), 'Must mention Add to Home Screen');
      assert.ok(content.includes('Thêm') && content.includes('hoàn tất'), 'Must mention tap Thêm to complete');

      // Android 1-click install copy
      assert.ok(content.includes('Cài đặt ứng dụng QCET E-Office'), 'Must have Android install title');
      assert.ok(content.includes('CÀI ĐẶT 1-CHẠM'), 'Must have CÀI ĐẶT 1-CHẠM CTA button');

      // Push notification soft prompt copy
      assert.ok(content.includes('Bật chuông báo chỉ đạo & việc khẩn'), 'Must have push notification title');
      assert.ok(
        content.includes('Bật thông báo trên thiết bị') || content.includes('BẬT THÔNG BÁO NGAY'),
        'Must have Bật thông báo trên thiết bị CTA button'
      );
      assert.ok(content.includes('Để sau'), 'Must have dismiss / snooze button');

      // LocalStorage snooze key
      assert.ok(content.includes('qcet-push-onboarding-dismissed'), 'Must use qcet-push-onboarding-dismissed localStorage key');

      // Event listener for manual trigger
      assert.ok(content.includes('qcet:open-push-onboarding'), 'Must listen for qcet:open-push-onboarding custom event');

      // Zero emoji policy (0% emoji slop)
      // Check for emoji unicode ranges: \p{Extended_Pictographic}
      const emojiRegex = /\p{Extended_Pictographic}/u;
      const linesWithEmoji = content
        .split('\n')
        .map((line, idx) => ({ line, num: idx + 1 }))
        .filter(({ line }) => emojiRegex.test(line));

      assert.strictEqual(
        linesWithEmoji.length,
        0,
        `PushOnboardingSheet must strictly have 0 emojis. Found emoji on lines: ${linesWithEmoji.map((l) => `${l.num}: "${l.line.trim()}"`).join(', ')}`
      );
    });

    test('PushOnboardingSheet exports PushOnboardingSheet component', async () => {
      const module = await import('../src/components/pwa/push-onboarding-sheet');
      assert.ok(typeof module.PushOnboardingSheet === 'function', 'PushOnboardingSheet must be exported as a function/component');
    });
  });

  describe('MobileMenuDrawer Integration', () => {
    test('mobile-menu-drawer.tsx integrates push notification controls', () => {
      const content = fs.readFileSync(mobileMenuDrawerPath, 'utf-8');

      // Hooks imported
      assert.ok(content.includes('usePushNotification'), 'MobileMenuDrawer must import usePushNotification');
      assert.ok(content.includes('usePWAInstall'), 'MobileMenuDrawer must import usePWAInstall');

      // Dedicated section
      assert.ok(
        content.includes('THÔNG BÁO ĐIỆN THOẠI & ỨNG DỤNG') || content.includes('THÔNG BÁO ĐIỆN THOẠI'),
        'Must contain mobile notification and app section'
      );

      // Push status badges
      assert.ok(content.includes('Đã kích hoạt'), 'Must have "Đã kích hoạt" status');
      assert.ok(content.includes('Chưa bật'), 'Must have "Chưa bật" status');

      // Test notification button
      assert.ok(content.includes('Thử chuông ngay'), 'Must have "Thử chuông ngay" test button');
      assert.ok(content.includes('sendTestNotification'), 'Must call sendTestNotification');

      // Installation / iOS guide actions
      assert.ok(
        content.includes('Cài đặt lên màn hình chính') || content.includes('installApp'),
        'Must support installing app when installable'
      );
      assert.ok(
        content.includes('Xem hướng dẫn cài đặt iOS') || content.includes('qcet:open-push-onboarding'),
        'Must support viewing iOS install guide'
      );

      // Touch targets
      assert.ok(content.includes('min-h-[44px]') || content.includes('min-h-[48px]'), 'Must use touch-friendly sizes');

      // Zero emoji policy
      const emojiRegex = /\p{Extended_Pictographic}/u;
      const linesWithEmoji = content
        .split('\n')
        .map((line, idx) => ({ line, num: idx + 1 }))
        .filter(({ line }) => emojiRegex.test(line));

      assert.strictEqual(
        linesWithEmoji.length,
        0,
        `MobileMenuDrawer must strictly have 0 emojis. Found emoji on lines: ${linesWithEmoji.map((l) => `${l.num}: "${l.line.trim()}"`).join(', ')}`
      );
    });
  });

  describe('AppShell Integration', () => {
    test('app-shell.tsx mounts PushOnboardingSheet', () => {
      const content = fs.readFileSync(appShellPath, 'utf-8');

      assert.ok(
        content.includes('PushOnboardingSheet'),
        'AppShell must import and render PushOnboardingSheet'
      );
      assert.ok(
        content.includes('<PushOnboardingSheet'),
        'AppShell must mount <PushOnboardingSheet />'
      );
    });
  });

  describe('Permission Recovery Guide & Denied State (Task 4)', () => {
    test('push-onboarding-sheet.tsx exports PermissionRecoveryGuide component', async () => {
      const module = await import('../src/components/pwa/push-onboarding-sheet');
      assert.ok(
        typeof module.PermissionRecoveryGuide === 'function',
        'PermissionRecoveryGuide must be exported as a function/component'
      );
    });

    test('PermissionRecoveryGuide renders 3-step guide for Chrome Desktop with Lock icon', async () => {
      const module = await import('../src/components/pwa/push-onboarding-sheet');
      const { PermissionRecoveryGuide } = module;

      const html = renderToStaticMarkup(
        React.createElement(PermissionRecoveryGuide, { initialPlatform: 'chrome' })
      );

      // 3-step guide for Chrome Desktop
      assert.ok(
        html.includes('Ổ khóa') || html.includes('Khóa') || html.includes('bi���u tượng'),
        'Chrome Step 1 must mention lock icon / site settings'
      );
      assert.ok(
        html.includes('Thông báo') && (html.includes('Cho phép') || html.includes('Bật')),
        'Chrome Step 2 must mention changing notifications to Allow'
      );
      assert.ok(
        html.includes('Tải lại') || html.includes('F5'),
        'Chrome Step 3 must mention reloading page to apply changes'
      );
    });

    test('PermissionRecoveryGuide renders 3-step guide for Safari iOS with Settings instructions', async () => {
      const module = await import('../src/components/pwa/push-onboarding-sheet');
      const { PermissionRecoveryGuide } = module;

      const html = renderToStaticMarkup(
        React.createElement(PermissionRecoveryGuide, { initialPlatform: 'safari' })
      );

      // 3-step guide for Safari iOS
      assert.ok(
        html.includes('Cài đặt') || html.includes('Settings'),
        'Safari Step 1 must mention Settings app on iOS'
      );
      assert.ok(
        html.includes('Thông báo') && (html.includes('Cho phép') || html.includes('bật')),
        'Safari Step 2 must mention enabling Notifications in Settings'
      );
      assert.ok(
        html.includes('Quay lại') || html.includes('QCET') || html.includes('Tải lại'),
        'Safari Step 3 must mention returning to QCET app or reloading'
      );
    });

    test('PushOnboardingSheet renders PermissionRecoveryGuide when permission is denied', async () => {
      const module = await import('../src/components/pwa/push-onboarding-sheet');
      const { PushOnboardingSheet } = module;

      const html = renderToStaticMarkup(
        React.createElement(PushOnboardingSheet, {
          manualOpen: true,
          permissionOverride: 'denied',
        })
      );

      // Title indicating permission denied / recovery
      assert.ok(
        html.includes('Hướng dẫn mở lại quyền thông báo') ||
          html.includes('Quyền thông báo đang bị khóa') ||
          html.includes('bị chặn'),
        'Must display recovery title when permission is denied'
      );
      // Contains platform options / recovery steps
      assert.ok(
        html.includes('Chrome') || html.includes('Safari'),
        'Must show platform instructions for Chrome or Safari'
      );
      assert.ok(
        html.includes('Tải lại') || html.includes('Áp dụng'),
        'Must have reload or refresh action'
      );
      assert.ok(
        html.includes('Để sau'),
        'Must have dismiss / Để sau button'
      );
    });

    test('PermissionRecoveryGuide strictly complies with 0% emoji and light-only Tailwind v4 standard', () => {
      const content = fs.readFileSync(pwaSheetPath, 'utf-8');

      // No dark: classes
      assert.ok(!content.includes('dark:'), 'push-onboarding-sheet.tsx must not contain dark: classes');

      // 0% emojis
      const emojiRegex = /\p{Extended_Pictographic}/u;
      const linesWithEmoji = content
        .split('\n')
        .map((line, idx) => ({ line, num: idx + 1 }))
        .filter(({ line }) => emojiRegex.test(line));

      assert.strictEqual(
        linesWithEmoji.length,
        0,
        `push-onboarding-sheet.tsx must strictly have 0 emojis. Found: ${linesWithEmoji.map((l) => `${l.num}: "${l.line.trim()}"`).join(', ')}`
      );
    });
  });
});
