---
status: completed
domain: security
created: 2026-09-08
---

# Implementation Plan: Security, Role Architecture & Performance Remediation

**Date:** 2026-09-08  
**Spec Reference:** `docs/superpowers/specs/2026-09-08-security-and-architecture-remediation-spec.md`

---

## Phase 1: Remediate P0 Security Vulnerabilities

### Step 1.1: Harden `/api/auth/demo-session`
- **File:** `src/app/api/auth/demo-session/route.ts`
- **Changes:**
  - Verify environment allows demo login (`process.env.NODE_ENV !== "production"` or explicit allowed flag).
  - Validate requested `userId` or `role` strictly against known demo users (`DEFAULT_DEMO_USERS` or valid demo user IDs).
  - Reject arbitrary user IDs with HTTP 403 Forbidden.
  - Return clean error response on violation.

### Step 1.2: Harden `/api/notifications/push/subscribe`
- **File:** `src/app/api/notifications/push/subscribe/route.ts`
- **Changes:**
  - Remove all fallbacks to `body.userId` when unauthenticated.
  - Require `session?.id` from `getSessionFromRequest(request)`. If absent, return HTTP 401 Unauthorized immediately.
  - In `DELETE` method, only allow unsubscribing endpoints belonging to the authenticated `session.id`.

### Step 1.3: Update Push Client Hook & Demo Tests
- **Files:**
  - `src/hooks/use-push-notification.ts`: Remove passing unauthenticated client `userId` in POST body; ensure fetch relies on cookie-based authentication.
  - `tests/demo-session-push.test.ts`: Update test to establish a demo session first via `/api/auth/demo-session` and provide session cookie, verifying that unauthenticated subscribe without cookie is rejected with 401.
  - Add explicit security tests verifying that arbitrary `userId` cannot hijack subscriptions.

---

## Phase 2: Remediate High Priority Vulnerabilities & Architectural Defects

### Step 2.1: Harden `/api/notifications/push/test`
- **File:** `src/app/api/notifications/push/test/route.ts`
- **Changes:**
  - Enforce authentication via session cookie (remove `body?.userId` unauthenticated impersonation).
  - Sanitize `linkHref` to ensure safe relative URL format (`/^/[^/\\]/`).

### Step 2.2: Harden Login Page Against Open Redirects
- **File:** `src/app/login/page.tsx`
- **Changes:**
  - Add `sanitizeRedirectUrl` helper.
  - Sanitize `redirect` and `callbackUrl` query parameters.

### Step 2.3: Fix `dashboard-context.tsx` Stale Closure in Actions
- **File:** `src/components/dashboard/dashboard-context.tsx`
- **Changes:**
  - Use `useRef` for `dashboardState` and `modalState`.
  - Ref-forward all action calls so `actionsValue` has stable `[]` dependency while always executing latest methods.

### Step 2.4: Align Academic Executive Roles in `useTaskFilters`
- **File:** `src/hooks/use-task-filters.ts`
- **Changes:**
  - Add `HIEU_TRUONG` and `PHO_HIEU_TRUONG` to `isExecutive` detection matching `useUrlParamsSync`.

### Step 2.5: Role-Aware `RoleSwitcherPill`
- **File:** `src/components/auth/role-switcher-pill.tsx`
- **Changes:**
  - Check if current user is a demo user (`user.provider === 'demo'` or user ID is in `DEFAULT_DEMO_USERS`).
  - If user is a real authenticated user (e.g. system or Google), disable the switcher or display role badge only to prevent state desynchronization.

---

## Phase 3: Remediate Medium & Low Issues

### Step 3.1: Complete Role Mapping in Onboarding Tour Steps
- **File:** `src/lib/onboarding-constants.ts`
- **Changes:**
  - Map `HIEU_TRUONG`, `PHO_HIEU_TRUONG`, and `BGH` to executive tour steps.
  - Map `TRUONG_DON_VI` to manager tour steps.

### Step 3.2: Accessible Focus Trapping in `WelcomeModal`
- **File:** `src/components/onboarding/welcome-modal.tsx`
- **Changes:**
  - Auto-focus first interactive element upon mount.
  - Store and restore previous active element upon unmount.

### Step 3.3: Dynamic Progress Bar Columns in `OnboardingChecklistWidget`
- **File:** `src/components/onboarding/onboarding-checklist-widget.tsx`
- **Changes:**
  - Replace hardcoded `grid-cols-4` with dynamic style `gridTemplateColumns: repeat(${tasks.length}, minmax(0, 1fr))` for responsiveness to different task lengths.

---

## Phase 4: Full Verification & Test Coverage
1. Execute `npm run typecheck` (`tsc --noEmit`).
2. Run test suites with `npm test`.
3. Verify all security regression tests pass.
