import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

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
      assert.ok(content.includes('BẬT THÔNG BÁO NGAY'), 'Must have BẬT THÔNG BÁO NGAY CTA button');
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
});
