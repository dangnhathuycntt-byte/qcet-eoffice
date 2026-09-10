# Task 7 Implementation Report: Contextual Push Pre-Prompt, Subscription Lifecycle, Deep Linking & Notification Dedup

## Executive Summary
Task 7 completes the institutional Web Push notification architecture for QCET E-Office. It implements a non-intrusive, contextual pre-prompt sheet, full push subscription lifecycle handling (with VAPID key exchange, server synchronization, and dead subscription pruning), granular push topic preferences, iOS Safari standalone constraints detection, service worker tag-based deduplication, and secure same-origin window focusing and deep linking.

Additionally, all 4 quick-fix recommendations from the Task 6 reviewer were executed and verified.

---

## 1. Reviewer Quick Fixes Applied (Task 6 Remediation)
1. **User ID Forwarding in AppShell (`src/components/layout/app-shell.tsx`)**:
   - `PWAInstallPrompt` and `PushOnboardingSheet` now receive `userId={user?.id}` from authenticated user context, guaranteeing isolated per-user onboarding states and preferences.
2. **iOS Guided Snooze (`src/components/pwa/pwa-install-prompt.tsx`)**:
   - When `promptInstall()` returns `"ios_guided"`, the banner automatically triggers `snoozeInstall()` and calls `onDismiss?.()`, preventing the banner from competing with the opened iOS guide modal.
3. **Desktop Progression in Coordinator (`src/lib/pwa/onboarding-coordinator.ts`)**:
   - Added `advanceNonInstallableDesktop()` and `advanceToPushEligible()` to allow desktop environments without `beforeinstallprompt` to advance to `PUSH_ELIGIBLE` after reaching `ENGAGED`.
4. **Coordinator Re-export Wrapper (`src/components/pwa/pwa-onboarding-coordinator.tsx`)**:
   - Created re-export module exposing `PWAInstallPrompt`, `PushOnboardingSheet`, and `usePWAOnboardingCoordinator`.

---

## 2. Implemented Architecture & Subsystems

### A. Push Subscription Lifecycle & Utilities (`src/lib/pwa/push-manager.ts`)
- **VAPID Key Conversion**: `urlBase64ToUint8Array` handles URL-safe and standard base64 string decoding into `Uint8Array`.
- **Subscription Management**:
  - `checkNotificationPermission()`: inspects `Notification.permission` safely across SSR and browser environments.
  - `subscribeToPush(options)`: verifies permission (or requests it during user-initiated gesture), fetches or creates browser push subscription with VAPID key, and syncs endpoint/p256dh/auth to `/api/notifications/push`.
  - `unsubscribeFromPush()`: unsubscribes locally via `subscription.unsubscribe()` and informs server via `DELETE /api/notifications/push`.
  - Expired / dead subscription handling (404/410 Gone triggers server-side status revocation and client cleanup).
- **iOS Safari Platform Detection (`checkIOSPushStatus`)**:
  - Evaluates user agent and `navigator.standalone` / display mode.
  - On iOS Safari in standard browser mode, flags `requiresPwaInstall: true` and `isPushSupported: false` (as Apple requires Web Push on iOS 16.4+ to run from an installed Home Screen PWA), delivering actionable guidance rather than cryptic errors.
- **Deep Link Sanitization (`validateSameOriginRoute`)**:
  - Enforces same-origin URL parsing. Rejects external phishing origins and dangerous URL schemes (`javascript:`, `data:`, `vbscript:`), safely falling back to `/tasks`.
- **Payload Formatting & Canonical Tag Generation**:
  - Standardizes canonical notification tag namespaces: `task:${taskId}:review`, `task:${taskId}:assigned`, `task:${taskId}:deadline`, and `doc:${docId}:directive`.
  - Formats payloads with structured data (`entityId`, `type`, `route`, `url`, `badgeCount`).

### B. Push Notification Preferences & Topic Routing (`src/lib/pwa/push-preferences.ts`)
- Configurable granular topics:
  - `task_assigned`: New task assignments.
  - `task_review`: Deliverable reviews and approval requests.
  - `deadline_reminder`: 24-hour deadline warnings.
  - `document_directive`: Incoming executive directives and urgent official dispatches.
- Provides per-user storage isolation (`qcet_push_prefs_v1:${userId}`) and bidirectional sync with the backend.

### C. Server-Side Push API (`src/app/api/notifications/push/route.ts`)
- `GET`: Returns VAPID public key, active subscriptions count, and stored topic preferences.
- `POST`: Upserts push subscription in `prisma.pushSubscription` and persists user topic preferences in `prisma.user.onboardingData`.
- `DELETE`: Marks subscriptions as `REVOKED` in the database.

### D. Service Worker Deduplication & Navigation (`public/sw.js`)
- `push` handler:
  - Inspects incoming push payload and synthesizes canonical deduplication tags (`task:${taskId}:review`, `task:${taskId}:assigned`, `task:${taskId}:deadline`, `doc:${docId}:directive`).
  - Sets `renotify: true` to alert user without flooding notification center.
  - Updates app badge using `navigator.setAppBadge` when available.
- `notificationclick` handler:
  - Closes notification and clears badge (`navigator.clearAppBadge`).
  - Resolves target route with strict same-origin validation.
  - Matches open browser windows via `self.clients.matchAll({ type: 'window', includeUncontrolled: true })`.
  - If a matching window exists, focuses and navigates it; if none exists, calls `self.clients.openWindow(targetUrl)`.

### E. Contextual Pre-Prompt Sheet (`src/components/pwa/push-onboarding-sheet.tsx`)
- Zero cold permission prompts: prompts only after eligibility or user trigger.
- Light-only institutional palette: slate-900 typography, institutional blue (`#1e3a8a`), slate-50/100/200 borders and cards.
- Senior-friendly touch ergonomics: `min-h-[52px]` and `min-h-[44px]` touch targets.
- Embedded recovery guide (`PermissionRecoveryGuide`): 3-step lock icon instructions for Chrome desktop, 3-step Settings app instructions for iOS Safari.
- Embedded iOS Safari guide: clear 3-step instruction when running in iOS browser mode.
- 0% emojis, 0 dark theme classes.

---

## 3. Verification & Test Evidence

### Test Execution Summary
1. **Unit Test Suite (`tests/pwa/push-manager.test.ts`)**:
   - **21 tests passing (0 failures)**:
     - VAPID & Uint8Array key conversion
     - Same-origin route validation (valid relative routes, absolute same-origin URLs, blocking external hosts, blocking `javascript:` / `data:` URI exploits)
     - Tag namespaces & deduplication (`task:*:review`, `task:*:assigned`, `task:*:deadline`, `doc:*:directive`)
     - iOS platform constraints & browser mode detection
     - Push preferences storage and topic filters
     - Anti-slop invariants (0 emojis, 0 dark theme classes, min 44px touch targets)
2. **Push UI Contract Tests (`tests/push-onboarding-ui.test.ts`)**:
   - **10 tests passing (0 failures)**:
     - Component contracts, recovery guides, Chrome/Safari guidance copy, 0% emojis, light-only Tailwind classes.
3. **Complete PWA Test Suite (`tests/pwa/*.test.ts`)**:
   - **121 tests passing (0 failures)** across all PWA modules.
4. **Combined PWA + UI Test Suite**:
   - **131 tests passing (0 failures)**.
5. **TypeScript Compiler Verification**:
   - `npx tsc --noEmit` passed with **0 errors**.

---

## 4. Anti-Slop & Institutional Compliance Checklist
- [x] **0% Emojis**: Verified via Unicode regex across all created/edited files.
- [x] **Light-Only Design**: Zero `dark:` classes in UI components.
- [x] **Touch Target Sizing**: All interactive buttons meet or exceed the 44px minimum (`min-h-[44px]` / `min-h-[52px]`).
- [x] **Security**: Open redirect prevention via strict same-origin validation in service worker and client handlers.
- [x] **State Isolation**: Push preferences and onboarding coordinator state isolated by `userId`.
