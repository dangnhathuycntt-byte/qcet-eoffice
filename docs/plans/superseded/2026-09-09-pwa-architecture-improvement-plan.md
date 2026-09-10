---
status: superseded
domain: architecture
created: 2026-09-09
superseded_by: 2026-09-09-remaining-source-improvement-master-plan.md
---

# QCET E-Office — PWA Architecture Improvement Implementation Plan

## Architectural Decision Record
- Keep: Next.js App Router, Web App Manifest, Service Worker, Web Push, PWA install, Offline-aware UI, PostgreSQL PushSubscription.
- Avoid: React Native/Flutter fork, separate mobile app repo, hard dependency on Background Sync, caching authenticated HTML/API unconditionally, auto skipWaiting with forced reloads on dirty forms.
- Architecture:
  - PWA Runtime Manager (PWAServiceWorkerManager)
  - PWA Onboarding Coordinator (Install UX + Push Pre-prompt FSM)
  - User-Isolated Offline Data Layer (IndexedDB: READ_CACHE, DRAFT, MUTATION_OUTBOX)
  - Durable Mutation Outbox with Idempotency and OCC Conflict Handling
  - Contextual Web Push with Deep-link routing and window focus

---

### Task 1: Service Worker Core & Lifecycle Refactor
**Goal:** Rewrite `public/sw.js` with version contract, explicit lifecycle (SKIP_WAITING message control, stale cache purge on activate), resource-tailored caching strategy matrix, same-origin deep-link routing with client window focus, and add Next.js security headers for `/sw.js`.

**Files to modify/create:**
- `public/sw.js`
- `next.config.mjs` (security headers for `/sw.js`)

**Key Specifications:**
1. Version contract:
   - `APP_VERSION = "2026.09.09.1"`
   - `CACHE_STATIC_NAME = "qcet-static-2026.09.09.1"`
   - `CACHE_SHELL_NAME = "qcet-shell-2026.09.09.1"`
2. Lifecycle:
   - On `install`: precache static shell assets (`/`, `/?zone=tasks`, icons). Do NOT blindly `self.skipWaiting()`; wait for message `"SKIP_WAITING"`.
   - On `message`: listen for `{ type: 'SKIP_WAITING' }` and call `self.skipWaiting()`.
   - On `activate`: `self.clients.claim()`, delete all old caches where cacheName does not match current version constants.
3. Caching Strategy Matrix:
   - **Static Assets** (`/_next/static/*`, images, fonts, icons): Cache First.
   - **Navigation / App Shell**: Network First -> fallback to cached shell (`/?zone=tasks` or `/`) -> offline response.
   - **Auth Endpoints** (`/api/auth/*`): Network Only. Never cache.
   - **Mutation Endpoints** (`POST`, `PUT`, `PATCH`, `DELETE`): Network Only. Do not intercept in SW.
   - **Sensitive Internal API Endpoints** (`/api/dashboard/*`, `/api/tasks/*`): Network First with tight timeout (2.5s) only when client explicitly requests offline fallback; never cache without header checks.
4. Push & Notification Click:
   - Deep links: validate route is same-origin.
   - Deduplication: use `tag` formatted as `task:{taskId}:{action}` or namespace.
   - Click handling: `clients.matchAll({ type: 'window', includeUncontrolled: true })`, match URL or origin, focus existing window and navigate, or `clients.openWindow(targetUrl)`.
5. Security Headers (`next.config.mjs`):
   - For `/sw.js`: `Cache-Control: no-cache, no-store, must-revalidate`, `Content-Type: application/javascript; charset=utf-8`, `Service-Worker-Allowed: /`.

---

### Task 2: PWA Service Worker Manager & Safe Update UX
**Goal:** Replace inline fire-and-forget script in `src/app/layout.tsx` with a robust `PWAServiceWorkerManager` component that handles registration, update detection, waiting workers, and safe user-prompted updates with dirty-form protection.

**Files to modify/create:**
- `src/components/pwa/pwa-service-worker-manager.tsx`
- `src/components/pwa/pwa-update-dialog.tsx`
- `src/app/layout.tsx`

**Key Specifications:**
1. Registration & Lifecycle:
   - Register `/sw.js` on window load in production (or when enabled in development).
   - Listen to `registration.onupdatefound`, track `installingWorker.onstatechange`.
   - Detect `waiting` worker (`registration.waiting`).
   - Listen to `navigator.serviceWorker.oncontrollerchange` to reload smoothly when update is applied.
2. Safe Update Protection:
   - Check if page has active unsaved edits (e.g. active input/textarea focus, unsaved draft forms).
   - If dirty: display warning "Có bản cập nhật mới. Vui lòng hoàn tất biểu mẫu trước khi cập nhật." Do not auto-reload.
   - If clean: display notification banner/toast "Có phiên bản QCET E-Office mới" with button `[Cập nhật ngay]`.
   - When user clicks `[Cập nhật ngay]`: postMessage `{ type: 'SKIP_WAITING' }` to the waiting worker -> wait for `controllerchange` -> `window.location.reload()`.
3. Root Layout Integration:
   - Remove inline `<script>` registration from `src/app/layout.tsx`.
   - Mount `<PWAServiceWorkerManager />` inside `RootLayout` / `AppShell`.

---

### Task 3: User-Isolated IndexedDB Offline Data Layer & Logout Purge
**Goal:** Create a client-side IndexedDB persistence layer segregating `READ_CACHE`, `DRAFT`, and `MUTATION_OUTBOX`, isolated by `userId` namespace (`qcet:user:<id>:...`), and implement automatic cache/database purging on user logout.

**Files to modify/create:**
- `src/lib/pwa/indexed-db.ts`
- `src/lib/pwa/offline-store.ts`
- `src/lib/auth-context.tsx` (wire logout purge)

**Key Specifications:**
1. Three Distinct Data Categories:
   - `READ_CACHE`: Ephemeral read data (tasks, calendars). Can be discarded on cache clear.
   - `DRAFT`: Unsaved user drafts (task creation drafts, notes). Persisted until explicitly submitted or deleted.
   - `MUTATION_OUTBOX`: Queued mutations to sync with server.
2. User Isolation & Multi-user Safety:
   - All record keys or object stores must be scoped by user: `qcet:user:${userId}:${storeType}`.
   - User B logging into a shared PC or tablet must never see User A's offline cache.
3. Logout Purge Mechanism:
   - Export `purgeUserOfflineData(userId: string): Promise<void>`.
   - When `logout()` in `AuthContext` is invoked:
     - Clear private IndexedDB stores for that user.
     - Clear private Cache Storage entries.
     - Reset in-memory queue.
     - Clear outbox for that user.

---

### Task 4: Durable Offline Mutation Outbox with Idempotency & OCC Conflict Handling
**Goal:** Redesign `src/lib/offline-sync.ts` from localStorage to the IndexedDB Outbox. Implement idempotency keys, expectedVersion for optimistic concurrency control (OCC), background drain, and user-facing 409 Conflict resolution UI.

**Files to modify/create:**
- `src/lib/offline-sync.ts`
- `src/lib/pwa/outbox-manager.ts`
- `src/components/pwa/offline-conflict-dialog.tsx`

**Key Specifications:**
1. Outbox Record Structure:
   ```ts
   interface OfflineOutboxItem {
     id: string; // uuid
     userId: string;
     operation: string; // e.g. "TASK_UPDATE_PROGRESS" | "TASK_STATUS_CHANGE"
     entityId: string;
     url: string;
     method: "POST" | "PUT" | "PATCH" | "DELETE";
     payload: unknown;
     expectedVersion?: number;
     idempotencyKey: string;
     createdAt: number;
     retryCount: number;
     status: "pending" | "syncing" | "conflict" | "failed";
     serverConflictData?: unknown;
   }
   ```
2. Synchronization Lifecycle:
   - Outbox is persisted in IndexedDB under user scope.
   - Send `Idempotency-Key` and `If-Match` / `expectedVersion` headers.
   - On network reconnection or app focus: trigger sequential flush.
   - If server returns 409 CONFLICT:
     - Do NOT discard and do NOT blindly overwrite server data.
     - Mark item `status: "conflict"`, store server response conflict details.
     - Alert user via `OfflineConflictDialog`.
     - User options: `[Xem thay đổi]`, `[Áp dụng lại (Ghi đè)]`, `[Bỏ thay đổi của tôi]`.
3. Progressive Enhancement:
   - If `window.SyncManager` is supported, register `registration.sync.register('qcet-outbox')`.
   - Fallback gracefully to `window.addEventListener('online')` and document focus events.

---

### Task 5: Web App Manifest Audit, Stable Identity, Maskable Icons & Shortcuts
**Goal:** Audit `src/app/manifest.ts` to satisfy full Chromium, Android, and iOS PWA installability criteria, define a stable PWA id, configure maskable and any-purpose icons, and add high-value shortcuts for E-Office operations.

**Files to modify/create:**
- `src/app/manifest.ts`

**Key Specifications:**
1. Stable Identity:
   - Set `id: "/"` and `scope: "/"`.
   - Ensure `start_url: "/"` is consistent across releases.
2. Standard Icons:
   - 192x192 and 512x512 with `purpose: "any"`.
   - 192x192 and 512x512 with `purpose: "maskable"`.
3. High-Value Shortcuts for QCET E-Office:
   - Nhiệm vụ (`/tasks` or `/?zone=tasks`)
   - Văn bản (`/documents` or `/?zone=documents`)
   - Lịch công tác (`/calendar` or `/?zone=calendar`)
   - Tạo nhiệm vụ mới (`/?action=create_task`)
4. System display & categories:
   - `display: "standalone"`
   - `categories: ["productivity", "education", "business"]`
   - `lang: "vi"`, `dir: "ltr"`

---

### Task 6: PWA Onboarding Coordinator & Install UX Orchestration
**Goal:** Unify disjointed welcome modals, tour guides, install banners, and push permission prompts into a coherent, user-friendly state machine (`PWAOnboardingCoordinator`). Never spam prompts on first load.

**Files to modify/create:**
- `src/components/pwa/pwa-onboarding-coordinator.tsx`
- `src/components/pwa/mobile-app-install-modal.tsx`
- `src/hooks/use-pwa-install.ts`

**Key Specifications:**
1. State Machine:
   - `NEW_USER` -> `WELCOME_DONE` -> `ENGAGED` -> `INSTALL_ELIGIBLE` -> `INSTALLED` -> `PUSH_ELIGIBLE`.
   - No install modal or push prompt on raw initial page load. Wait until user has completed welcome/onboarding or interacted with work items.
2. Chromium Flow:
   - Capture `beforeinstallprompt` event and stash it.
   - Show non-intrusive banner or menu CTA: `[Cài đặt ứng dụng]`.
   - On click: call `prompt()`, track user choice (`accepted` / `dismissed`).
3. iOS Safari Flow:
   - Detect iOS Safari browser (non-standalone).
   - Display clear step-by-step visual instruction sheet: Share button (biểu tượng Chia sẻ) -> "Thêm vào MH chính" (Add to Home Screen).
   - Only trigger after user explicitly requests installation.

---

### Task 7: Push Notification Overhaul, Deep Links, iOS Awareness & Push Preferences
**Goal:** Overhaul push notification subscription flow with contextual pre-prompts, iOS Home Screen PWA capability awareness, deep-link navigation, dead subscription cleanup on 404/410, and user notification category preferences.

**Files to modify/create:**
- `src/components/pwa/push-onboarding-sheet.tsx`
- `src/lib/pwa/push-preferences.ts`
- `src/lib/push-service.ts`
- `src/app/api/notifications/push/route.ts`

**Key Specifications:**
1. Contextual Pre-Prompt:
   - Never call `Notification.requestPermission()` on app load.
   - Show value-led prompt after user sees pending tasks/deadlines: "Nhận thông báo khi có nhiệm vụ được phân công hoặc cần duyệt gấp".
   - CTA: `[Bật thông báo trên thiết bị]`.
2. iOS Web Push Compatibility:
   - Detect if running on iOS: Web Push is only supported when added to Home Screen (iOS >= 16.4).
   - If iOS in Safari browser mode: guide user to install PWA first before enabling push.
3. Push Preferences:
   - User toggles: Task assigned, Approval required, Deadline reminder, Document directive.
   - Stored in user settings / DB.
4. Subscription Cleanup:
   - When web push dispatch returns `404` or `410 Gone`, mark `PushSubscription.disabledAt = new Date()` or delete invalid endpoint to avoid retrying dead endpoints.

---

### Task 8: Storage Quota Management, Global Sync Status & PWA Health UI
**Goal:** Implement `PWAStorageManager` with `navigator.storage.estimate()`, build a true-connectivity global sync status banner, and add an "Ứng dụng & Ngoại tuyến" section in system settings.

**Files to modify/create:**
- `src/lib/pwa/storage-manager.ts`
- `src/components/layout/pwa-sync-status.tsx`
- `src/components/pwa/pwa-health-settings.tsx`

**Key Specifications:**
1. Storage Management:
   - Use `navigator.storage.estimate()` to inspect storage usage and quota in MB.
   - Provide explicit user action: "Cho phép dùng dữ liệu ngoại tuyến" which calls `navigator.storage.persist()`.
2. True Connectivity & Sync Status Banner:
   - Combines `navigator.onLine` with API health/heartbeat check to avoid false positives (e.g. Wi-Fi connected but portal offline).
   - Shows connection status: Online, Mất kết nối (Offline), Đang đồng bộ (Syncing X/Y), Xung đột (Conflict).
   - Display pending outbox mutation count badge.
3. PWA Health Settings ("Ứng dụng & Ngoại tuyến"):
   - Display: App Version (`2026.09.09.1`), Service Worker status, Install status, Push status, Offline storage usage, Outbox queue count.
   - Actions: `[Kiểm tra bản cập nhật]`, `[Xóa dữ liệu ngoại tuyến]`, `[Đồng bộ ngay]`.
4. PWA Telemetry:
   - Lightweight client telemetry event dispatcher: `pwa.install.offer`, `pwa.install.accept`, `push.permission.granted`, `sw.update.detected`, `sync.conflict`.

---

### Task 9: Progressive Enhancements, Badging & Verification Test Suite
**Goal:** Add App Badging API progressive enhancement, selective document offline caching safeguards, create automated tests for PWA modules, and evaluate Serwist gate.

**Files to modify/create:**
- `src/lib/pwa/badging.ts`
- `tests/pwa/sw-lifecycle.test.ts`
- `tests/pwa/indexed-db-isolation.test.ts`
- `tests/pwa/outbox-sync.test.ts`
- `tests/pwa/onboarding-coordinator.test.ts`
- `docs/architecture/pwa-serwist-evaluation.md`

**Key Specifications:**
1. Badging API:
   - Use `navigator.setAppBadge(count)` and `navigator.clearAppBadge()` where supported.
   - Reflect only actionable items (pending approvals or urgent overdue tasks).
2. Automated Test Suite:
   - Test user isolation in IndexedDB (User A cannot access User B records).
   - Test outbox queuing, idempotency key generation, and 409 conflict tagging.
   - Test onboarding coordinator state transitions.
   - Test service worker version constants and header configuration.
3. Serwist Evaluation Gate:
   - Document complexity analysis of handwritten `public/sw.js` vs Serwist migration.
   - If handwritten SW remains under ~250 LOC and well-tested, keep handwritten SW per architecture plan.
