# QCET E-Office — Service Worker Architecture & Serwist Evaluation Gate

**Document Status**: Canonical Architecture Decision Record (ADR)  
**Scope**: PWA Service Worker Implementation Strategy, Serwist Toolchain Evaluation, Complexity Audit, and Evolution Thresholds  
**Last Updated**: 2026-09-09  
**Decision**: Retain Handwritten Service Worker (`public/sw.js`) for Current Milestone  

---

## 1. Executive Summary & Context

As part of the QCET E-Office PWA Architecture modernization, an architectural decision gate was established to evaluate whether to:
1. **Option A**: Retain and maintain the handwritten, vanilla Service Worker (`public/sw.js`).
2. **Option B**: Adopt **Serwist** (`@serwist/next`, the modular Workbox successor for Next.js).

After rigorous code auditing, build pipeline profiling, and automated test suite integration, the architecture team has evaluated both options against QCET Core System Invariants.

**Conclusion**: Retain the handwritten Service Worker (`public/sw.js`).  
The handwritten implementation is 445 lines of code (including comments and documentation), modular, fully compliant with browser standards, zero-dependency, and directly testable without complex build shims.

---

## 2. Technical Audit of Current Implementation (`public/sw.js`)

### 2.1 Code Metrics & Surface Area
- **Total Physical Lines**: 445 lines (including comprehensive section comments and JSDoc).
- **Core Executable Logic**: ~240 lines of JavaScript.
- **External Runtime Dependencies**: 0 (Zero external dependencies, purely native Web API standards: Service Workers, Cache Storage, Notifications, Badging, and Background Sync).
- **Testability**: 100% testable inside Node.js test runners using `node:vm` and mock execution contexts without requiring a webpack/TypeScript compilation step.

### 2.2 Functional Partitioning
The current `public/sw.js` is partitioned into seven distinct, isolated operational zones:
1. **Version Contract & Bucket Constants**: Strict semantic versioning (`2026.09.09.1`) preventing cache drift.
2. **Install Lifecycle**: Pre-caches core institutional assets (`/`, `/?zone=tasks`, icons, manifest) without aggressive auto-activation, deferring to user readiness.
3. **Controlled Update Message Handler**: Implements explicit `SKIP_WAITING` control orchestrating zero-downtime updates via user toast notification.
4. **Activation & Bucket Purge**: Calls `clients.claim()` and atomically deletes legacy or outdated cache buckets (`CURRENT_CACHES` whitelist).
5. **Resource-Tailored Strategy Matrix**:
   - **Mutations (POST/PUT/PATCH/DELETE)**: Strictly Network Only. Never intercepted by Service Worker.
   - **Localhost Development Environment**: Dynamic bypass preventing local cache poisoning (preventing the Next.js Dev/Build cache conflict).
   - **Authentication Endpoints (`/api/auth/*`)**: Strictly Network Only. No caching of session cookies, CSRF tokens, or identity credentials.
   - **Static Assets (`/_next/static/*`, fonts, icons)**: Cache First strategy with dynamic bucket storage (`qcet-static-*`).
   - **Dynamic API Endpoints (`/api/*`)**: Network First with strict 2500ms timeout and cached fallback.
   - **HTML Document Navigation**: Network First with offline fallback to cached shell `/` or `/?zone=tasks`.
6. **Push Notifications & OS Deep Linking**:
   - Parses institutional notification payload.
   - Deduplicates notifications via semantic tags (`task:${taskId}:${action}`).
   - Integrates OS app icon badging (`navigator.setAppBadge`).
   - Deep links strictly to same-origin paths, focusing existing windows or navigating safely.
7. **Background Sync Progressive Enhancement**:
   - Listens for `'qcet-outbox-sync'` (and legacy `'qcet-outbox'`).
   - Posts `QCET_OUTBOX_DRAIN` message to active client windows to trigger sequential queue flush.

---

## 3. Comparison Matrix: Handwritten SW vs. Serwist

| Evaluation Dimension | Handwritten `public/sw.js` (Current) | Serwist (`@serwist/next`) | QCET Assessment |
| :--- | :--- | :--- | :--- |
| **Dependency Weight** | **0 dependencies** (native Web APIs) | Requires `@serwist/next`, `serwist`, Workbox packages (~15+ packages) | Handwritten wins (lean supply chain). |
| **Next.js 15 & Turbopack Compatibility** | **100% native** (served from `/public`, zero compiler interference) | Requires webpack plugin hooks; Turbopack support requires workarounds | Handwritten wins (avoids Turbopack build failure). |
| **Development Cache Conflict** | **Explicit localhost bypass** prevents dev/build collisions | Automatic Workbox precache manifest generation frequently conflicts with dev server | Handwritten wins (honors Memory invariant). |
| **Build Pipeline Complexity** | **None** (plain static asset in `public/`) | Requires secondary compilation step (`app/sw.ts` -> `public/sw.js`) | Handwritten wins (faster CI/CD builds). |
| **Automated Node.js Testing** | Fast, deterministic via `node:vm` (~40ms execution) | Requires bundling SW bundle before running test matrix | Handwritten wins (simplified testing). |
| **Complex Route Regex Matching** | Handcrafted `URL.pathname` branching | Rich declarative routing via `RegExp` / Workbox strategies | Serwist marginally superior if 50+ routes exist. |
| **Precache Manifest Size** | Minimal explicit list of core shell assets | Auto-generated hashes for all Next.js static chunks | Serwist better for massive static multi-page sites; unnecessary for App Router PWA shell. |

---

## 4. Decision Gate Conclusion

### Decision: Retain Handwritten Service Worker
The handwritten `public/sw.js` delivers:
1. **Zero build toolchain friction**: Works seamlessly with Next.js 15, Turbopack, and Docker standalone output without additional webpack plugins.
2. **Absolute institutional transparency**: Every line of caching, security gating, and push routing is clear, audited, and adheres to institutional invariants (e.g., zero emojis, strict authentication bypass, and same-origin URL enforcement).
3. **Low maintenance overhead**: The code is ~445 lines (well within maintainable engineering limits), clean, well-commented, and backed by automated unit tests in `tests/pwa/sw-lifecycle.test.ts`.

---

## 5. Thresholds for Future Serwist Migration

A transition to Serwist or a compiled service worker framework is **strictly deferred** until one or more of the following objective engineering thresholds are crossed:

1. **Precache Asset Proliferation**: The static precache list exceeds **50 individual chunks** requiring automated build-time hash calculation to prevent stale chunk caching.
2. **Route Complexity Escalation**: The service worker routing table exceeds **15 distinct regex caching strategies** that cannot be cleanly expressed in standard branching logic.
3. **Lines of Code Threshold**: The handwritten `public/sw.js` file exceeds **600 executable lines** (excluding comments), indicating that manual strategy composition is degrading readability.
4. **Turbopack Native Plugin Support**: Turbopack officially stabilizes native PWA plugin integration with first-class Serwist support, eliminating the risk of dev/build pipeline incompatibility.

If any of these conditions are met, a formal migration spike will be conducted following this document's requirements.
