# SDD ledger — plan: docs/superpowers/plans/2026-09-09-pwa-architecture-improvement-plan.md

## Pre-flight Plan Scan

| Task Pair / Interface | Producer -> Consumer Relationship | Finding / Agreement |
|---|---|---|
| Task 1 & Task 2 (`public/sw.js` & `pwa-service-worker-manager.tsx`) | Task 1 provides `SKIP_WAITING` message handler & version contract; Task 2 sends `SKIP_WAITING` on user confirmation and listens to `controllerchange`. | Consistent: no premature auto-reload, message protocol matches. |
| Task 3 & Task 4 (`indexed-db.ts` & `outbox-manager.ts` / `offline-sync.ts`) | Task 3 establishes user-isolated IndexedDB stores; Task 4 builds the durable outbox and conflict resolution on top of it. | Consistent: both require `userId` scoping and idempotency keys. |
| Task 6 & Task 7 (`pwa-onboarding-coordinator.tsx` & `push-onboarding-sheet.tsx`) | Task 6 orchestrates the onboarding state machine (`NEW_USER` -> `ENGAGED` -> `INSTALL` -> `PUSH`); Task 7 triggers contextual push pre-prompt. | Consistent: no spamming on page load, push pre-prompt runs when user reaches `PUSH_ELIGIBLE`. |
| Task 4 & Task 8 (`offline-sync.ts` / `outbox-manager.ts` & `pwa-sync-status.tsx`) | Task 4 manages outbox queue and conflict states; Task 8 displays sync status, pending count, and conflict alert to user. | Consistent: outbox exposes subscription/event listener for pending count and conflict count. |
| Task 1 (`sw.js`) self-consistency | Pre-caches shell & static assets, bypasses auth/mutations, provides offline fallback. | Consistent with offline requirements and security invariants. |
| Task 2 (`pwa-service-worker-manager.tsx`) self-consistency | Replaces fire-and-forget inline script in `src/app/layout.tsx`. | Clean single-responsibility mounting in AppShell. |
| Task 3 (`indexed-db.ts`, `offline-store.ts`) self-consistency | Scoped by `userId`, cleans up on logout. | Complies with data isolation invariant. |
| Task 4 (`outbox-manager.ts`, `offline-sync.ts`) self-consistency | Replaces localStorage with IndexedDB, handles 409 conflict gracefully. | Complies with optimistic concurrency and server-truth invariant. |
| Task 5 (`src/app/manifest.ts`) self-consistency | Stable id, standard icons, practical shortcuts. | Valid Next.js App Router metadata manifest. |
| Task 6 (`pwa-onboarding-coordinator.tsx`) self-consistency | Coordinates install modal and iOS instructions without double-prompting. | Respects web permission standards. |
| Task 7 (`push-onboarding-sheet.tsx`, `push-service.ts`) self-consistency | Contextual push request, clean dead subscriptions. | Aligns with push delivery best practices. |
| Task 8 (`pwa-sync-status.tsx`, `storage-manager.ts`) self-consistency | Storage quota inspection + true connectivity detection. | Provides clear user transparency. |
| Task 9 (Progressive enhancements & tests) self-consistency | Automated tests for PWA subsystems + Serwist evaluation. | Verification without breaking changes. |

Status: Pre-flight scan clean. No conflicts.

## Task Execution Log

### Task 1: Service Worker Core & Lifecycle Refactor
- Commit: `b43de87`
- Implementer report: `task-1-report.md`
- Review package: `review-f2e0a45..b43de87.diff`
- Review verdict: Approved (Spec compliant, clean lifecycle, safe caching matrix, all tests pass).
- Status: Completed.

### Task 2: PWA Service Worker Manager & Safe Update UX
- Commits: `19144b6`, `066043e`
- Implementer reports: `task-2-report.md`
- Review verdict: Approved (Exhaustive dirty-form detection, initial claim suppression via `hadController`, decoupled registration/listeners, 27/27 tests pass).
- Status: Completed.

### Task 3: User-Isolated IndexedDB Offline Data Layer & Logout Purge
- Commit: `f4a97e4`
- Implementer report: `task-3-report.md`
- Review package: `review-8f5e4cd..f4a97e4.diff`
- Review verdict: Approved (Multi-user isolation, TTL-aware read cache, persistent draft store, resilient logout purge, 17/17 tests pass).
- Status: Completed.

### Task 4: Durable Offline Mutation Outbox with Idempotency & OCC Conflict Handling
- Commit: `16fe029`
- Implementer report: `task-4-report.md`
- Review package: `review-5c3ff35..16fe029.diff`
- Review verdict: Approved (Idempotency headers, OCC 409 conflict retention, FIFO ordering, override vs discard resolution, progressive sync, light-only anti-slop UI, 16/16 tests pass).
- Status: Completed.

### Task 5: Web App Manifest Audit, Stable Identity, Maskable Icons & Shortcuts
- Commit: `3acecba`
- Implementer report: `task-5-report.md`
- Review package: `review-ea01c0b..3acecba.diff`
- Review verdict: Approved (Stable PWA ID, W3C/Chromium installability, 192/512 maskable & any icons, institutional shortcuts, outbox stuck-syncing reconciliation, 13/13 manifest tests pass).
- Status: Completed.

### Task 6: PWA Onboarding Coordinator & Install UX Orchestration
- Commit: `38f2661`
- Implementer report: `task-6-report.md`
- Status: Ready for Review (Formal state machine NEW_USER -> WELCOME_DONE -> ENGAGED -> INSTALL_ELIGIBLE -> INSTALLED -> PUSH_ELIGIBLE, zero cold-load prompt spam, deferred beforeinstallprompt, iOS Safari step-by-step guidance, user isolation, light-only institutional UI, 15/15 tests pass).






