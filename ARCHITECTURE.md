# QCET E-Office — System Architecture & Technical Map

**System**: QCET E-Office (Hệ thống Điều hành & Quản lý Công việc Nội bộ)  
**Institution**: Cao đẳng Công nghệ Quang Châu (QCET)  
**Document Status**: Canonical Reference  
**Last Updated**: 2026-10-19  

---

## 1. System Purpose & Core Mission

QCET E-Office is the digital governance and administrative operating system for Quang Chau College of Engineering and Technology (Cao đẳng Công nghệ Quang Châu). The platform consolidates institutional task assignment, DACUM-aligned role delegation, official document circulation (văn bản đến/đi), directives, and academic calendar scheduling into a single, cohesive web application.

The core design philosophy prioritizes:
- **Administrative Clarity**: Clear visual hierarchy, light-only administrative design, and zero visual clutter.
- **Operational Data Integrity**: Strict derivation of metrics from database records without synthetic or fabricated data.
- **Role-to-Scope Separation**: Decoupling what a user is authorized to perform (Role) from which slice of institutional data they are viewing (Scope).
- **Single Source of Truth**: Exactly one canonical implementation per domain capability.

---

## 2. Technology Stack & Foundation

The platform is built on modern, standard web technologies:

| Layer | Technology | Version | Purpose & Invariants |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `15.5.25` (LTS baseline) | Server Components (RSC), API route handlers, static/dynamic streaming. |
| **UI Runtime** | React & React DOM | `19.2.8` | Component rendering, hooks, transitions, concurrent mode. |
| **Styling** | Tailwind CSS & PostCSS | `v4.0.9` (`@tailwindcss/postcss`) | CSS-first styling via `apps/web/src/app/globals.css`. Strict Light-Only OKLCH standard. |
| **Data Layer** | Prisma ORM | `6.19.3` | Type-safe database queries, schema migrations, and client generation. |
| **Database** | PostgreSQL / SQLite | Multi-dialect | PostgreSQL in staging/production; SQLite dialect supported for isolated tests. |
| **Language** | TypeScript | `5.7.3` | Strict type checking (`tsc --noEmit`), zero type assertions on domain invariants. |
| **Icons & Primitives** | Lucide React & Vaul | `1.14.0` / `1.1.2` | Clean stroke-width 1.5 iconography; mobile bottom sheets. |

---

## 3. Directory Structure Map

Two Next.js applications in one npm-workspaces repository (ADR-011). Only `apps/api` touches the database, Redis,
ClamAV, uploads, migrations, workers and cron; `apps/web` renders pages and reads data over HTTP.

```
qcet-eoffice/
├── apps/
│   ├── web/                      # @qcet/web — pages, components, PWA (service qcet-web)
│   │   ├── src/app/              # App Router pages and layouts (no /api)
│   │   ├── src/components/       # UI (ui/, layout/, tasks/, workspace/, documents/, dashboard/)
│   │   ├── src/hooks/, src/context/
│   │   ├── src/lib/              # UI-only helpers; server-api.ts = serverApiFetch, getWebSession, fetchPageData
│   │   ├── src/proxy.ts          # canonical redirects, /login, session-cookie presence; /api passes through
│   │   ├── public/               # static assets, sw.js, icons
│   │   ├── next.config.ts        # rewrites /api/:path* → API_INTERNAL_URL (fixed at build), proxyTimeout 340 s
│   │   └── Dockerfile
│   └── api/                      # @qcet/api — route handlers only (service qcet-api)
│       ├── src/app/api/          # REST handlers, incl. GET /api/page-data/* and /api/auth/me for the web
│       ├── src/server/           # services, authorization, outbox worker + agent jobs, observability
│       ├── src/lib/, src/domain/ # server-side helpers (jwt-session.ts, …)
│       ├── src/proxy.ts          # full /api logic: session, correlation id, security
│       ├── src/instrumentation.ts # starts outbox / file-scan workers
│       ├── Dockerfile, docker-entrypoint.sh  # prisma migrate deploy, then apps/api/server.js
│       └── next.config.ts
├── packages/
│   ├── contracts/                # @qcet/contracts — Zod schemas and DTO types (incl. page-data.ts, session.ts)
│   ├── shared/                   # @qcet/shared — pure domain logic and helpers (academic-calendar, …); no Prisma
│   └── db/                       # @qcet/db — Prisma client, audit, outbox; prisma/ schema, migrations, seeds
├── tests/                        # cross-app tests and package-only tests (cwd = repo root)
├── e2e/                          # Playwright (starts api + web)
├── scripts/                      # lint, check-orphans, run-tests (per workspace), dev.mjs, smoke-split.mjs
└── docs/                         # product and architecture documentation
```

Rules enforced by `npm run lint` (`scripts/architecture-boundaries.mjs`): no imports across apps, no server-only
module in `apps/web/src`, route handlers do not import Prisma directly, `packages/*` never import `apps/*`,
`@qcet/shared` and `@qcet/contracts` stay free of `@qcet/db`.

---

## 4. End-to-End Data Flow

```
[ User Interaction / Client View ]
              │
              ▼
[ UnifiedTaskToolbar / AppShell Controls ]
              │
              ▼
[ useTaskFilters & URL Sync ] ──(Sync query params: ?scope=&category=&search=)
              │
              ▼
[ UnifiedAdaptiveWorkspace Engine ]
              │
              ├── Optimistic Mutation Cache (utils/task-workspace-mutations)
              │
              ▼
[ Browser → same host /api/* ]
              │
              ├── production: cloudflared rule ^/api(/|$) → qcet-api; everything else → qcet-web
              ├── direct to web (dev, fallback): web rewrites /api/* → API_INTERNAL_URL
              ├── server-rendered pages: serverApiFetch → API_INTERNAL_URL (cookie, x-request-id forwarded)
              │
              ▼
[ qcet-api Route Handlers (/api/*) ]
              │
              ├── Verify Session & Extract Server Identity (jwt-session.ts)
              ├── Enforce Server-Side RBAC & Separation of Duties (Maker-Checker)
              ├── Validate Input Payload (Zod / Schema validation)
              │
              ▼
[ Prisma Database Engine (PostgreSQL / SQLite) ]
              │
              ▼
[ Server Truth Response ] ──(Reconcile UI State & Revalidate Caches)
```

---

## 5. Canonical Domain Boundaries

1. **Task Workspace Boundary**:
   - `UnifiedAdaptiveWorkspace` and `ModularCascadingTaskTable` are the exclusive engines for viewing, filtering, and mutating institutional tasks.
   - All filter parameters, search strings, and pagination states flow strictly through `useTaskFilters`.
2. **Official Documents Boundary**:
   - Manages incoming (`VAN_BAN_DEN`), outgoing (`VAN_BAN_DI`), and internal submissions (`TO_TRINH_NOI_BO`).
   - Governed by strict status lifecycles (`CHO_PHAN_CONG` -> `DANG_XU_LY` -> `CHO_PHE_DUYET` -> `DA_HOAN_THANH`).
3. **Academic Calendar Boundary**:
   - All institutional dates, semesters, academic weeks, and deadline evaluations are governed by `packages/shared/src/lib/academic-calendar.ts`.
   - All comparisons pin to Indochina Time (ICT, UTC+7) using canonical reference helpers (`getSystemReferenceDate`).
4. **Authentication & Authorization Boundary**:
   - Authentication relies strictly on server-side signed JWT sessions. Client storage is treated solely as a transient UI cache.
   - RBAC permissions are enforced in server route handlers; client-claimed roles are never trusted for mutations.
5. **Navigation Boundary**:
   - `apps/web/src/lib/navigation/canonical-navigation-registry.ts` is the single source of truth for all routes, labels, icons, sidebar ordering, and mobile placements.

---

## 6. System Invariants Summary

- **One Capability, One Implementation**: Zero duplicate engines, parallel toolbars, or conflicting state hooks.
- **Server Truth Wins**: The database and server session are canonical; UI state reconciles against server truth.
- **Zero Synthetic Operational Data**: Never inject mock counts, fabricated audit logs, or hardcoded KPI percentages.
- **Light-Only Standard**: Strictly light administrative styling grounded in OKLCH semantic tokens.
- **One API Process**: Exactly one `qcet-api` instance runs migrations, the outbox worker (lease via `outbox_events.locked_at`, `OUTBOX_LEASE_MS`) and cron; `qcet-web` holds no server secrets and never reaches the database.

---

## 7. Background Work (Outbox & Agent Jobs)

- Side effects are written to `outbox_events` in the same transaction as the domain change (`@qcet/db/outbox`).
- The worker in `qcet-api` polls every `OUTBOX_POLL_INTERVAL_MS` (60 s). Claiming sets `locked_at`; events stuck in
  `PROCESSING` longer than `OUTBOX_LEASE_MS` (10 min) return to `PENDING` (counted as an attempt; dead-lettered at the limit).
- Agent jobs use the same lane: `enqueueAgentJob(tx, { type, payload, idempotencyKey, actorId })` writes
  `AGENT_JOB_<type>` with a deterministic id (duplicate keys are ignored); handlers registered in `AGENT_JOB_HANDLERS`
  run with an `AbortSignal` (`AGENT_JOB_TIMEOUT_MS`, 5 min) and each run records an `AuditEvent` summary. See ADR-011.
