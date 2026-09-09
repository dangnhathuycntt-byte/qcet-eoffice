---
status: active
domain: architecture
created: 2026-09-09
supersedes:
  - 2026-09-09-source-architecture-improvement-plan.md
  - 2026-09-09-api-hardening-architecture-plan.md
  - 2026-09-09-pwa-architecture-improvement-plan.md
---

# QCET E-Office — Remaining Source Improvement Master Plan

> **Plan Type:** Multi-Wave System Hardening & Operational Readiness  
> **Target:** Secure, Reproducible, Deployable, Observable, Recoverable, Configurable, Auditable, Maintainable.  
> **Execution Strategy:** Subagent-Driven Development with independent implementer subagents and rigorous task reviewers.

---

## Global Constraints & Invariants

1. **Zero Confidential Files in `public/`**: `public/` must strictly contain only public assets (logos, icons, PWA manifests, public docs). All internal documents must go through authenticated, authorized storage endpoints.
2. **Server-Side Truth & Secure Boundaries**: Client components must never access server secrets or Prisma directly.
3. **Environment Separation**: Build-time constants (`NEXT_PUBLIC_*`) must never be conflated with runtime server secrets (`process.env`).
4. **Feature Flags ≠ Permissions**: Flags manage rollout and operational kill switches; RBAC and authorization policies strictly enforce permissions.
5. **No Slop & Log Sanitization**: Observability and logs must sanitize PII, tokens, session IDs, and database credentials.
6. **Backward Compatibility**: Preserve existing passing test suites (2101 tests) without regressions.

---

### Task 1: Audit public/documents & Implement Private File Storage Boundary

- **Objective:** Audit and eliminate all confidential/internal document exposure from `public/`. Establish canonical private file storage and temporary file abstractions.
- **Actions:**
  1. Inspect `public/documents/` and move operational files (such as `KeHoach_CongTac_Thang9_2026.doc`) to secure private storage or rename sample/template files to `public/public-documents/` if purely public samples.
  2. Implement `src/storage/private-files.ts` providing secure file storage interface, MIME verification, path traversal prevention, and authorized stream helpers.
  3. Implement `src/storage/temporary-files.ts` with metadata (owner, createdAt, expiresAt, status) and cleanup routines.
  4. Add unit and integration tests in `tests/storage/file-storage-boundary.test.ts` verifying file boundary and path safety.
- **Verification:** `npx tsx --test tests/storage/file-storage-boundary.test.ts` passes; 0 internal confidential files in `public/`.

---

### Task 2: Central Environment Configuration (Server, Client & Runtime)

- **Objective:** Eliminate loose `process.env` lookups across the codebase. Implement validated schema for server, client, and runtime configs with fail-fast startup.
- **Actions:**
  1. Create `src/config/env.server.ts` using Zod schema (`DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `NODE_ENV`, etc.) that validates immediately on server initialization.
  2. Create `src/config/env.client.ts` validating safe `NEXT_PUBLIC_*` client-side constants.
  3. Create `src/config/runtime.ts` exposing safe runtime configuration helpers and preventing accidental secret leakage.
  4. Create endpoint `src/app/api/runtime-config/route.ts` that safely returns non-sensitive runtime parameters (environment, features, version) for client consumption.
  5. Add tests in `tests/config/env-validation.test.ts` asserting schema validation, fail-fast behavior on missing secrets, and secret isolation.
- **Verification:** `npx tsx --test tests/config/env-validation.test.ts` passes; `npm run typecheck` passes.

---

### Task 3: Security Headers & CSP (Report-Only Rollout)

- **Objective:** Establish browser-level defense in depth via HTTP security headers and Content Security Policy without breaking Next.js hydration.
- **Actions:**
  1. Create `src/config/security-headers.ts` defining:
     - `Content-Security-Policy-Report-Only` (with initial sensible directives: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, script/style/img/connect whitelists for Google Auth and self).
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `X-Frame-Options: DENY`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (in production)
  2. Integrate security headers into Next.js middleware (`src/middleware.ts`) or `next.config.ts`.
  3. Add tests in `tests/config/security-headers.test.ts` verifying headers and CSP directives presence and format.
- **Verification:** `npx tsx --test tests/config/security-headers.test.ts` passes; Next.js builds cleanly.

---

### Task 4: Feature Flags & Operational Kill Switches

- **Objective:** Provide zero-deployment operational control over high-risk features and external integrations without coupling flags to authorization.
- **Actions:**
  1. Create `src/features/flags.ts` defining typed feature flags and kill switches:
     - `pushNotifications`
     - `externalGoogleLogin`
     - `offlineMutations`
     - `largeExcelExport`
     - `taskWorkspaceV2`
     - `mobileAgenda`
     - `newExecutiveDashboard`
  2. Implement flag evaluation with environment variable overrides (e.g. `FEATURE_FLAG_*`) and safe defaults.
  3. Enforce separation of concerns: explicit comments and types ensuring flags are never checked as permission substitutes.
  4. Add tests in `tests/features/feature-flags.test.ts` verifying default states, kill switch overrides, and type safety.
- **Verification:** `npx tsx --test tests/features/feature-flags.test.ts` passes.

---

### Task 5: Client Error Boundaries & Observability Telemetry

- **Objective:** Prevent single-component errors from crashing the entire application. Establish privacy-safe logging and telemetry.
- **Actions:**
  1. Implement modular client error boundaries in `src/components/common/error-boundary.tsx`:
     - `AppShellErrorBoundary`
     - `WorkspaceErrorBoundary`
     - `TaskDetailErrorBoundary`
     - `DocumentViewerErrorBoundary`
     Each boundary renders graceful fallback UI matching QCET light aesthetic with retry buttons.
  2. Create `src/telemetry/sanitize.ts` with `sanitizeLogContext()` removing passwords, tokens, auth headers, connection strings, and PII.
  3. Create `src/telemetry/client.ts` and `src/telemetry/server.ts` integrating React 19 `reportError` and safe structured logging.
  4. Create `src/telemetry/web-vitals.ts` for tracking LCP, INP, CLS, TTFB.
  5. Add tests in `tests/telemetry/error-boundary-and-logging.test.ts`.
- **Verification:** `npx tsx --test tests/telemetry/error-boundary-and-logging.test.ts` passes.

---

### Task 6: Governance Documentation & Environment Templates

- **Objective:** Institutionalize data classification, logging policy, retention schedules, and deployment guides.
- **Actions:**
  1. Create `docs/security/data-classification.md` (Public, Internal, Confidential, Security Sensitive).
  2. Create `docs/security/logging-policy.md` (sanitization rules, retention, forbidden fields).
  3. Create `docs/security/secrets.md` (lifecycle, rotation, environment separation).
  4. Create `docs/operations/deployment.md`, `docs/operations/rollback.md`, `docs/operations/staging.md`, `docs/operations/retention.md`.
  5. Create `.env.example` documenting all configuration keys with required/optional and server/client markings (0 real secrets).
  6. Create `.github/CODEOWNERS` defining ownership across prisma, auth, tasks, and security configs.
- **Verification:** File presence and integrity verified; `.env.example` contains no real production credentials.

---

### Task 7: CI/CD Pipeline & Supply Chain Quality Gate

- **Objective:** Enforce immutable deployment discipline, dependency scanning, and frozen lockfile checks.
- **Actions:**
  1. Create `.github/workflows/ci.yml` with steps: checkout, setup-node (Node 20/22 via .nvmrc), `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npx prisma validate`, `npm run build`.
  2. Create `.github/workflows/dependency-review.yml` scanning dependencies on PR.
  3. Create `.nvmrc` pinning `20.18.0`.
  4. Update `package.json` scripts to include `"lint"` and `"verify": "npm run typecheck && npm run lint && npm test"`.
- **Verification:** Workflow files are valid YAML; `npm run verify` runs typecheck, lint, and tests cleanly.

---

### Task 8: Architecture Fitness Tests

- **Objective:** Ensure automated regression gates catch architectural drift (Prisma in client, secrets leaked to client, direct process.env, unsanitized logs).
- **Actions:**
  1. Create `tests/architecture/fitness-rules.test.ts`:
     - Test 1: No client components (`"use client"`) import Prisma client or server-only modules.
     - Test 2: Zero confidential files stored under `public/`.
     - Test 3: No direct `process.env` access in frontend UI components (`src/components/`).
     - Test 4: `sanitizeLogContext()` strips sensitive keys (`password`, `token`, `secret`, `authorization`, `cookie`).
     - Test 5: `.env.example` exists and contains no live secrets.
  2. Run the complete test suite and typecheck.
- **Verification:** All architecture fitness tests pass; overall suite passes with 0 regressions.
