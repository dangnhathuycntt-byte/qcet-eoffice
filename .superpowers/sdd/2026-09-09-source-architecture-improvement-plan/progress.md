# SDD ledger — plan: docs/superpowers/plans/2026-09-09-source-architecture-improvement-plan.md

## Pre-flight Conflict Scan
| Task A | Task B | Interface / File | Conflict Scan Result | Ruling |
|---|---|---|---|---|
| Task 1 | Task 2 | Next.js / React build | Task 1 checks baseline dependencies; Task 2 operates on App Router boundaries. Compatible. | Proceed. |
| Task 2 | Task 3 | Server components vs Task Services | Task 2 introduces direct server reads; Task 3 standardizes the domain service layer. Task 2 can consume initial services or prepare Server Component wrappers. | Task 3 domain services will be the canonical import target for Task 2. |
| Task 3 | Task 4 | Task Domain Service vs DTO/Zod Contracts | Task 3 command/query services must consume TaskDTO & Zod schemas from Task 4. | Domain services adhere strictly to Zod contracts. |
| Task 3 | Task 5 | Task Mutations vs Auth Session Truth | Mutations in TaskCommandService must enforce AuthenticatedSession validation. | Zero mutation permissions granted to offline-cached state. |
| Task 3 | Task 8 | TaskCommandService vs Prisma Transactions | Multi-step writes in TaskCommandService must execute inside prisma.$transaction. | Atomic transactions required for task approvals and resolution. |
| Task 6 | Task 10 | Error schemas & State Machine | TaskStateMachine returns structured domain errors conforming to ApiError. | Standardize error codes across state machine and API routes. |
| Task 7 | Task 3 | Audit Trail vs Task Command Service | TaskCommandService emits business audit events. | Decoupled event emission on successful transaction commits. |

## Progress Log
- [x] **Task 1: Security & Dependency Baseline Audit (Phase 1)** - Completed. Next.js updated to ^15.5.25 (resolved 15.5.25), overrides for postcss (^8.5.28) and deepmerge-ts (^8.0.2) applied, 0 CVEs, 0 typecheck errors, 2074/2074 tests passing. Documented in `docs/architecture/dependency-baseline.md`. Commit: `ceec13fce8402cf3e674aea48728bccecd89af17`.
- [x] **Task 2: Server / Client Boundary Audit & Direct Server Reads (Phase 2 & Phase 3)** - Completed. Converted `/` and `/tasks` to Server Components performing direct server reads via `getLiveDashboardData()`. Interactivity isolated into client islands `UnifiedTaskHubClient` and `TasksPageClient`. Elimination of initial HTTP round-trips/waterfalls. 6/6 tests passing in `tests/server-client-boundary.test.ts`. Commit: `c06cede`.
- [x] **Task 3: Canonical Task Query & Command Domain Services (Phase 4 & Phase 5)** - Completed. Established canonical task domain services (`src/server/tasks/task-policy.ts`, `src/server/tasks/task-query-service.ts`, `src/server/tasks/task-command-service.ts`). Delegated `/api/tasks`, `/api/tasks/[id]`, and `/api/tasks/[id]/deliverables` to domain services. Enforced Role Is Not Scope, Segregation of Duties (SoD), and One Metric, One Definition. 50/50 tests passing across all task suites.

