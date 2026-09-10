# Specification: Comprehensive Security, Role Architecture & Performance Remediation

**Date:** 2026-09-08  
**Standard:** QCET E-Office Engineering Rules (Next.js 15, React 19, Tailwind CSS v4 Light-Only, OWASP Web Security, RFC 8030 Web Push)

---

## 1. Problem Statement & Scope

A rigorous code review identified critical security vulnerabilities, role-handling inconsistencies, and UI/state defects across the QCET E-Office platform:

1. **P0 Security Vulnerabilities**:
   - `/api/auth/demo-session`: Allows unauthenticated callers to arbitrarily issue signed JWT cookies with administrative/managerial credentials in non-demo or production environments if not gated, and accepts unvalidated arbitrary user IDs.
   - `/api/notifications/push/subscribe`: Accepted unauthenticated requests with arbitrary `userId` in JSON request body, allowing an attacker to overwrite or hijack push notification endpoints of arbitrary users (violating RFC 8030 capability & session-binding security principles).
   - `/api/notifications/push/test`: Accepted unauthenticated requests with arbitrary `userId`, enabling unauthorized trigger of notification spam and in-app notification insertion.
   - `/login`: Target redirect parameter (`redirect` / `callbackUrl`) unvalidated, allowing potential Open Redirect attacks (violating OWASP Unvalidated Redirects recommendations).

2. **Role Architecture & Permissions**:
   - `RoleSwitcherPill`: Missing check for whether the current user is a demo user. When a real user is authenticated via password or Google OAuth, the demo persona switcher should either be hidden, disabled, or strictly gated to avoid misleading users into thinking they have switched their persistent database account.
   - `useTaskFilters`: Incomplete executive role recognition for Vietnamese academic roles `HIEU_TRUONG` and `PHO_HIEU_TRUONG` compared to `useUrlParamsSync`.
   - `onboarding-constants`: `getRoleTourSteps` did not map `HIEU_TRUONG` and `PHO_HIEU_TRUONG` to executive BGH tour steps, causing leadership users to see staff tours.

3. **Performance & React Context Architecture**:
   - `dashboard-context.tsx`: `DashboardActionsContext` actions value memoized with `[]` while referencing functions from `useDashboardState` and `useModalState`, causing stale closure traps on task updates, deliverable submissions, and reviews.
   - `usePushNotification`: Client-side fallback to `user-admin-bgh` and unauthenticated `userId` submission in API payload.

4. **Accessibility & Component Quality**:
   - `welcome-modal.tsx`: Keyboard focus trap lacked initial focus on mount and previous focus restoration on unmount (WCAG 2.1 AA dialog guidelines).
   - `onboarding-checklist-widget.tsx`: Progress bar grid had hardcoded `grid-cols-4`, causing visual breakage if task count differed from 4.

---

## 2. Technical Architecture & Invariants

### 2.1 Demo Session Route (`/api/auth/demo-session`)
- **Environment Gate**: Must only execute when `NODE_ENV !== "production"` or explicit demo mode flag is active.
- **Whitelist Gate**: `userId` must strictly belong to `DEFAULT_DEMO_USERS` or verified demo accounts. Arbitrary user IDs must be rejected with HTTP 403 / 400.
- **Cookie Security**: Set `HttpOnly`, `SameSite=lax`, `Path=/`, and secure in production.

### 2.2 Push Notification Subscriptions (`/api/notifications/push/subscribe` & `/test`)
- **Authentication Invariant**: Endpoints must strictly require an authenticated session (`getSessionFromRequest(request)`).
- **Body `userId` Removal**: No route shall accept `userId` from untrusted request bodies to bypass authentication or reassign subscriptions.
- **RFC 8030 Alignment**: Every push subscription is bound exclusively to `session.id`.
- **Test Push Sanitization**: Validate `linkHref` to ensure it is a safe relative path (`/` followed by alphanumeric/path chars, no `//`, `/\`, or scheme `javascript:`).

### 2.3 Open Redirect Prevention (`/login`)
- Implement `sanitizeRedirectUrl(targetUrl)`:
  - If null, empty, or invalid -> default to `/`
  - Must start with `/`
  - Must not start with `//` (protocol-relative) or `/\\`
  - Must not contain `://` or control characters (`\r`, `\n`)
  - Must not contain `javascript:`, `data:`, or `vbscript:`

### 2.4 React Context Stale Closure Remediation (`dashboard-context.tsx`)
- Ref-forwarded action pattern: Store latest `dashboardState` and `modalState` in mutable React refs (`useRef`).
- Forward all action calls inside `actionsValue` to `dashboardStateRef.current` and `modalStateRef.current`.
- Guarantees 100% stable object reference for `DashboardActionsContext` without ever triggering consumer re-renders or suffering from stale closures.

### 2.5 Role-Based UI Consistency
- Synchronize `HIEU_TRUONG` and `PHO_HIEU_TRUONG` in:
  - `use-task-filters.ts`
  - `onboarding-constants.ts`
- Gating `RoleSwitcherPill`: Only display or enable role switching when the user is running in demo mode (`provider === 'demo'` or user ID is a demo account), or render a non-interactive badge for real accounts.

---

## 3. Verification & Compliance Criteria
- `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- `npm test` passes 100% of unit and integration test suites.
- Regression tests added covering:
  - Demo session validation and injection rejection.
  - Push subscribe 401 unauthenticated enforcement and rejection of unauthenticated body tampering.
  - Open redirect sanitation in login page.
  - Ref-forwarded stable actions in DashboardContext.
