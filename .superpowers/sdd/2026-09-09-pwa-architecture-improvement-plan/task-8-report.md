# Task 8 Implementation Report: Storage Quota Management & Global Sync Status UX

**Date:** 2026-09-09  
**Branch:** `feat/dacum-role-delegation-workflow`  
**Task:** Storage Quota Management & Global Sync Status UX (Task 8 of PWA Architecture Improvement Plan)  
**Status:** COMPLETED (DONE)

---

## 1. Executive Summary

Task 8 delivers comprehensive Storage Quota Management, 3-tier True Connectivity Detection (`ONLINE`, `DEGRADED`, `OFFLINE`), Outbox Mutation Queue UX synchronization, and institutional Settings integration for QCET E-Office:

1. **Storage Quota & Persistence Management (`src/lib/pwa/storage-manager.ts`):**
   - Precise estimation via `navigator.storage.estimate()` calculating bytes used, quota, percentage, and human-readable formatting ("12.4 MB / 1.2 GB").
   - Storage breakdown estimation isolating Cache Storage and IndexedDB footprints.
   - Persistence status checking via `navigator.storage.persisted()`.
   - Explicit user-permission boundary via `requestStoragePersistence()`: only requested on direct user action ("Bật lưu trữ vĩnh viễn" / "Cho phép dùng dữ liệu ngoại tuyến"), never invoked automatically on cold login or app boot.
   - On-demand purge routine (`clearUserOfflineData`) targeting user-scoped `READ_CACHE`, `DRAFT`, `MUTATION_OUTBOX`, and runtime Service Worker caches.

2. **True Connectivity State Machine (`src/lib/pwa/connectivity.ts`):**
   - Tri-state model separating true reachability from superficial Wi-Fi association:
     - `ONLINE`: Connected with verified HTTP connectivity to `/api/health`.
     - `DEGRADED`: Browser reports online (`navigator.onLine = true`), but server ping fails or times out.
     - `OFFLINE`: Browser reports no physical network connection.
   - Exponential backoff and periodic heartbeat probes with page visibility / focus hooks.

3. **Global Sync Status UX (`src/components/pwa/pwa-sync-status.tsx`):**
   - Live banner and compact badge components observing connectivity states and outbox queue items.
   - Contextual operational indicators:
     - "Đã đồng bộ" (all items synced).
     - "Đang đồng bộ X/Y..." (during active flush).
     - "X thay đổi đang chờ đồng bộ" (offline with pending mutations).
     - "X thay đổi cần xử lý (Xung đột)" (conflict state with resolution triggers).
   - Touch-friendly actions (`[Đồng bộ ngay]`, conflict inspection) conforming to QCET institutional UI guidelines (no dark mode, 0 emojis, minimum 44px touch targets, blue-900 / slate color system).

4. **Settings Integration (`src/components/pwa/pwa-settings-card.tsx` & `src/components/pwa/pwa-health-settings.tsx`):**
   - Institutional card in `/settings` displaying:
     - Trạng thái cài đặt PWA (Standalone / Trình duyệt).
     - Trạng thái thông báo Web Push (Đã cấp phép / Chưa cấp phép).
     - Bộ nhớ ngoại tuyến (dung lượng sử dụng, hạn mức, tiến trình, lưu trữ bền vững).
     - Thay đổi chờ đồng bộ (hàng đợi Outbox & cảnh báo xung đột).
     - Phiên bản ứng dụng & trạng thái Service Worker.
   - Interactive user operations:
     - `[Bật lưu trữ vĩnh viễn]` (with confirmation and persistence verification).
     - `[Xóa dữ liệu ngoại tuyến]` (with dialog confirmation and outbox preservation toggle).
     - `[Kiểm tra cập nhật]` (with Service Worker check and update notification).

5. **Quick Fixes from Task 7 Reviewer:**
   - In `src/components/pwa/push-onboarding-sheet.tsx`: added `&& !isSubscribed` guard preventing push prompt from re-opening when subscription already exists.
   - In `src/lib/pwa/onboarding-coordinator.ts`: updated `snoozePush(days?: number)` so custom snooze durations (e.g. 365 days) calculate `pushPromptDismissedAt` and expiration accurately.

---

## 2. File Modifications and Additions

### Created Files
- `src/lib/pwa/storage-manager.ts`: Core storage quota manager, estimate calculations, persistence controls, on-demand purge API, and React hooks (`useStorageQuota`).
- `src/lib/pwa/connectivity.ts`: Tri-state connectivity detector (`ONLINE` / `DEGRADED` / `OFFLINE`), probe harness, event listeners, singleton manager, and React hook (`useConnectivity`).
- `src/components/pwa/pwa-sync-status.tsx`: Full sync status bar (`PWASyncStatusBar`), compact header badge (`PWASyncStatusBadge`), and wrapper component with conflict handling.
- `src/components/layout/pwa-sync-status.tsx`: Alias re-export module for layout consumption.
- `src/components/pwa/pwa-settings-card.tsx`: Full-featured administrative settings card for PWA, offline storage, persistence, and sync.
- `src/components/pwa/pwa-health-settings.tsx`: Specialized system health and diagnostics card.
- `tests/pwa/storage-manager.test.ts`: 13 unit tests covering formatBytes, check/request persistence, storage estimates, and user data purge.
- `tests/pwa/sync-status.test.ts`: 8 unit tests covering connectivity detector, state machine transitions, outbox subscriptions, and flush lifecycle.

### Modified Files
- `src/components/pwa/push-onboarding-sheet.tsx`: Added `!isSubscribed` check to auto-open guard.
- `src/lib/pwa/onboarding-coordinator.ts`: Updated `snoozePush` to support custom snooze duration in days.
- `src/app/settings/page.tsx`: Integrated `PWASettingsCard` into the settings overview grid.
- `src/components/layout/offline-banner.tsx`: Connected to `PWASyncStatusBar` with tri-state connectivity support.

---

## 3. Verification Results

### Automated Unit Tests
Executed command:
```bash
npx tsx --test tests/pwa/storage-manager.test.ts tests/pwa/sync-status.test.ts
```
Results:
- Total tests: 21
- Passed: 21
- Failed: 0
- Suites: 9

Executed full PWA test suite:
```bash
npx tsx --test tests/pwa/*.test.ts
```
Results:
- Total tests: 142
- Passed: 142
- Failed: 0
- Suites: 59

### TypeScript Typecheck
Executed command:
```bash
npm run typecheck
```
Output:
```
> qcet-eoffice@0.1.0 typecheck
> tsc --noEmit
```
Status: Exit code 0 (0 type errors across entire codebase).

### Architectural Invariant Audits
- **Zero Dark Theme Classes:** No `dark:` Tailwind classes in created components (`pwa-sync-status.tsx`, `pwa-settings-card.tsx`, `pwa-health-settings.tsx`).
- **Zero Emojis:** Pure SVG iconography from `lucide-react` used across all indicators and alerts.
- **Ergonomics:** All interactive buttons and touch targets meet or exceed 44px (`min-h-[44px]`).
- **Storage Persistence Principle:** `requestStoragePersistence()` is strictly invoked on explicit button click and never called on background initialization.

---

## 4. Git Commits

Commit message:
```
feat(pwa): implement storage quota management and global sync status UX

- Create storage manager for quota inspection, persistence, and user purge
- Implement 3-tier connectivity detector (ONLINE, DEGRADED, OFFLINE)
- Add global sync status bar, badge, and settings management card
- Apply Task 7 reviewer fixes (push snooze duration, auto-open guard)
- Add comprehensive unit tests in storage-manager.test.ts and sync-status.test.ts
```
