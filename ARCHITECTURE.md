# QCET E-Office — System Architecture & Technical Map

**System**: QCET E-Office (Hệ thống Điều hành & Quản lý Công việc Nội bộ)  
**Institution**: Cao đẳng Công nghệ Quang Châu (QCET)  
**Document Status**: Canonical Reference  
**Last Updated**: 2026-09-09  

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
| **Styling** | Tailwind CSS & PostCSS | `v4.0.9` (`@tailwindcss/postcss`) | CSS-first styling via `src/app/globals.css`. Strict Light-Only OKLCH standard. |
| **Data Layer** | Prisma ORM | `6.19.3` | Type-safe database queries, schema migrations, and client generation. |
| **Database** | PostgreSQL / SQLite | Multi-dialect | PostgreSQL in staging/production; SQLite dialect supported for isolated tests. |
| **Language** | TypeScript | `5.7.3` | Strict type checking (`tsc --noEmit`), zero type assertions on domain invariants. |
| **Icons & Primitives** | Lucide React & Vaul | `1.14.0` / `1.1.2` | Clean stroke-width 1.5 iconography; mobile bottom sheets. |

---

## 3. Directory Structure Map

```
qcet-eoffice/
├── src/
│   ├── app/                      # Next.js App Router pages and API route handlers
│   │   ├── api/                  # Server-side REST API handlers (tasks, docs, auth, export)
│   │   ├── tasks/                # Canonical Task Workspace route
│   │   ├── documents/            # Document management routes (inbox, outbox, directives)
│   │   ├── calendar/             # Academic calendar and institutional schedule routes
│   │   ├── org/                  # Organizational directory and structure
│   │   └── settings/             # System and user settings
│   ├── components/               # React UI components
│   │   ├── layout/               # Shell, AppSidebar, AppTopbar, MobileBottomNav, ScopeSwitcher
│   │   ├── tasks/                # ModularCascadingTaskTable, UnifiedTaskToolbar, side sheets
│   │   ├── workspace/            # UnifiedAdaptiveWorkspace engine and state coordinator
│   │   ├── documents/            # Document viewers, directive forms, approval dialogs
│   │   ├── dashboard/            # Executive matrix, stat strips, KPI cards
│   │   └── ui/                   # Primitive design system components (buttons, badges, inputs)
│   ├── hooks/                    # Reusable React hooks (useTaskFilters, useAuthRole, useVirtualKeyboard)
│   ├── lib/                      # Core domain utilities and business logic
│   │   ├── navigation/           # canonical-navigation-registry.ts
│   │   ├── academic-calendar.ts  # Academic calendar, week calculations, ICT timezone
│   │   ├── dashboard-aggregator.ts # Metric calculations and rollup definitions
│   │   ├── jwt-session.ts        # Server JWT creation, validation, and cookie parsing
│   │   └── prisma.ts             # Prisma client singleton instance
│   └── types/                    # Core TypeScript definitions (auth, dashboard, workspace, task)
├── prisma/                       # Prisma schema definition, migrations, and seed scripts
├── tests/                        # Automated unit and regression test suites (tsx --test)
└── docs/                         # Canonical product and architecture documentation
    ├── product/                  # Invariants, roles and scopes, institutional metrics
    └── architecture/             # Workspace, navigation, auth, mobile, API inventory
```

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
[ Server Route Handlers (/api/*) ]
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
   - All institutional dates, semesters, academic weeks, and deadline evaluations are governed by `src/lib/academic-calendar.ts`.
   - All comparisons pin to Indochina Time (ICT, UTC+7) using canonical reference helpers (`getSystemReferenceDate`).
4. **Authentication & Authorization Boundary**:
   - Authentication relies strictly on server-side signed JWT sessions. Client storage is treated solely as a transient UI cache.
   - RBAC permissions are enforced in server route handlers; client-claimed roles are never trusted for mutations.
5. **Navigation Boundary**:
   - `src/lib/navigation/canonical-navigation-registry.ts` is the single source of truth for all routes, labels, icons, sidebar ordering, and mobile placements.

---

## 6. System Invariants Summary

- **One Capability, One Implementation**: Zero duplicate engines, parallel toolbars, or conflicting state hooks.
- **Server Truth Wins**: The database and server session are canonical; UI state reconciles against server truth.
- **Zero Synthetic Operational Data**: Never inject mock counts, fabricated audit logs, or hardcoded KPI percentages.
- **Light-Only Standard**: Strictly light administrative styling grounded in OKLCH semantic tokens.
