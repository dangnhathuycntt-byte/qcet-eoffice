# QCET E-Office — Runtime Configuration & Environment Architecture

**Document Status**: Canonical Architecture Reference  
**Scope**: Build-time vs Runtime Variables, Inlining Caveats, Dynamic Configuration Endpoint, Secret Boundary  
**Last Updated**: 2026-09-09  

---

## 1. The Core Dilemma: Build-Time vs. Runtime Configuration

In standard Next.js applications, environment variables prefixed with `NEXT_PUBLIC_` are evaluated and **inlined statically into client-side JavaScript bundles during `next build`**.

While convenient for static deployments, this creates severe architectural issues in enterprise containerized deployments:
1. **Container Immutability Violation**: If configuration is baked in at build time, the Docker image cannot be promoted unchanged from Staging to Production (e.g., URLs, client IDs, and feature flags differ between environments).
2. **Accidental Secret Exposure**: If developers inadvertently prefix a secret with `NEXT_PUBLIC_`, the compiler bundles the secret into publicly readable client JavaScript.
3. **Redeployment Overhead**: Toggling a feature flag or updating a domain requires a full multi-minute container compilation instead of a rapid container restart.

---

## 2. QCET Dual-Channel Configuration Architecture

To achieve absolute container immutability, zero-secret security, and dynamic environment promotion, QCET E-Office implements a **Dual-Channel Configuration Architecture**:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 ENVIRONMENT VARIABLES                  │
                  │   (.env.local / Container Env / Docker Secrets)        │
                  └────────────────────────────────────────────────────────┘
                                    │                       │
           [Build-Time Safe Inlining]                       [Server-Only Runtime]
                                    │                       │
                                    ▼                       ▼
┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────────────┐
│  STATIC COMPILATION (next build)             │ │  NODE.JS STANDALONE RUNTIME                  │
│  - Evaluates src/config/env.client.ts        │ │  - Evaluates src/config/env.server.ts        │
│  - Strict whitelist of safe NEXT_PUBLIC_*    │ │  - Strict Zod validation & fail-fast startup │
│  - Rejects database URLs, keys, & secrets   │ │  - Holds DATABASE_URL, AUTH_SECRET, VAPID    │
└─────────────────────────────────────��────────┘ └──────────────────────────────────────────────┘
                                                                    │
                                                  [Evaluates getPublicRuntimeConfig()]
                                                  [Enforces assertZeroSecrets()]
                                                                    │
                                                                    ▼
                                                 ┌──────────────────────────────────────────────┐
                                                 │  DYNAMIC ENDPOINT: /api/runtime-config       │
                                                 │  - Emits runtime features & version          │
                                                 │  - Cache: max-age=60, s-maxage=60            │
                                                 └──────────────────────────────────────────────┘
                                                                    │
                                                            (HTTP Fetch on Boot)
                                                                    │
                                                                    ▼
                                                 ┌──────────────────────────────────────────────┐
                                                 │  CLIENT SINGLETON STATE & FEATURE FLAGS      │
                                                 │  - Dynamic feature activation                │
                                                 │  - Zero client image rebuild required        │
                                                 └──────────────────────────────────────────────┘
```

---

## 3. Channel 1: Static Build-Time Validation (`src/config/env.client.ts`)

For properties that **must** be available synchronously before the first network request (such as initial PWA asset URLs or fallback version tags), the Next.js compiler inlines `NEXT_PUBLIC_*` variables.

### Safety Invariants Enforced by `ClientEnvSchema`:
- **Strict Schema Filtering**: Only explicitly defined keys are allowed (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_REFERENCE_DATE`, `NEXT_PUBLIC_APP_VERSION`).
- **Forbidden Secret Blacklist**: Rejects any key named in `FORBIDDEN_SERVER_SECRETS` (`DATABASE_URL`, `AUTH_SECRET`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`, etc.).
- **Value Content Inspection**: Regex guards scan values and reject any string matching database connection strings (`postgres://...`) or private key blocks (`-----BEGIN ... PRIVATE KEY-----`).

---

## 4. Channel 2: Dynamic Runtime Config (`/api/runtime-config`)

For dynamic operational capabilities, environment indicators, and feature flags, client components consume configuration dynamically from `/api/runtime-config`.

### 4.1 Server Implementation (`src/config/runtime.ts`)
The server evaluates `getPublicRuntimeConfig()`, assembling runtime metadata:

```typescript
export interface PublicRuntimeConfig {
  environment: "development" | "production" | "test";
  features: PublicRuntimeFeatures;
  version: string;
  buildId: string;
  appUrl?: string;
  referenceDate?: string;
}
```

### 4.2 The Zero-Secret Assertion Guard
Before the configuration payload is returned by `/api/runtime-config`, it must pass through `assertZeroSecrets(config)`:
```typescript
const FORBIDDEN_SECRET_KEY_PATTERNS = [
  /SECRET/i,
  /(?<!PUBLIC_)PRIVATE/i,
  /PASSWORD/i,
  /DATABASE/i,
  /JWT/i,
  /TOKEN/i,
  /CREDENTIAL/i,
];
```
If any key or value in the object graph matches a secret pattern or contains a database connection string, an error is thrown, aborting the response with HTTP 500 rather than leaking data to the network.

### 4.3 HTTP Caching & Edge Performance
The endpoint serves responses with optimized cache headers:
```http
Cache-Control: public, max-age=60, s-maxage=60, stale-while-revalidate=300
```
- Browser clients cache the runtime config for 60 seconds.
- Reverse proxies (Nginx) cache the response for 60 seconds (`s-maxage=60`), protecting the Node.js server under high concurrency.
- If upstream is re-evaluating, clients can use stale responses for up to 300 seconds (`stale-while-revalidate=300`).

---

## 5. Client Consumption Guidelines

Client components and services must observe the following patterns:

### Pattern A: Accessing Build-Time Client Env
Use the canonical `clientEnv` proxy from `@/config/env.client`:
```typescript
import { clientEnv } from "@/config/env.client";

// Safe, validated, type-safe access
const appUrl = clientEnv.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
```

### Pattern B: Accessing Dynamic Feature Flags
Use the canonical feature flags API from `@/features/flags`:
```typescript
import { isFeatureEnabled } from "@/features/flags";

if (isFeatureEnabled("taskWorkspaceV2")) {
  // Render modern V2 task workspace
}
```

---

## 6. Developer & DevOps Invariant Checklist

- [ ] **Never prefix server secrets with `NEXT_PUBLIC_`**: Always store database URLs, API secret keys, and passwords in server-only variables.
- [ ] **Never import `@/config/env.server` in Client Components**: Importing server config in files with `'use client'` triggers a build error and runtime assertion.
- [ ] **Verify `/api/runtime-config` in CI**: Automated tests assert that `/api/runtime-config` returns valid JSON with zero sensitive attributes.
