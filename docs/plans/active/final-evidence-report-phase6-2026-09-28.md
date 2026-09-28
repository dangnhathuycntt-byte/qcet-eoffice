# Final Evidence Report — Phase 6 Release & CI Verification
*Ngày lập: 2026-09-28 | Branch: feat/phase6-release-ci-verification | Compiled by: Claude Sonnet 4.6*

---

## 1. Tóm tắt trạng thái

| Hạng mục | Kết quả |
|----------|---------|
| **Tổng items** | 41 |
| **Hoàn thành (✅)** | 36 |
| **Bị chặn — ngoại nhân (⛔)** | 4 |
| **Partially actionable (🟡)** | 1 |

### 5 open checkboxes (per plan `checkpoint-all-phases-summary-2026-09-28.md`)

| # | Item | Phase | Status |
|---|------|-------|--------|
| 1 | Digital signature provider | Phase 0 | ⛔ BLOCKED — CA vendor contract unavailable |
| 2 | Digital signature integration | Phase 5 | ⛔ BLOCKED — depends on #1 |
| 3 | Deploy pilot | Phase 6 | ⛔ BLOCKED — no SSH/production access |
| 4 | Reconcile audit findings | Phase 6 | 🟡 PARTIAL — pre-pilot findings documented in canonical tracker; production observation/reconciliation pending |
| 5 | Observation window + legacy retirement | Phase 6 | ⛔ BLOCKED — depends on deploy (#3) |

---

## 2. Commit & CI Evidence

### Commit cuối cùng trên main
```
SHA: b5946be4c62241afb91c264fcd00c4e95d3a0916
Message: fix(ci): restore FTS trigram indexes and resolve test suite failures (#131)
Branch: main (origin/main)
Date: 2026-09-28
```

### CI Runs (xác nhận từ GitHub Actions)

| Run ID | Workflow | Status | Kết quả |
|--------|----------|--------|---------|
| **36428833453** | CI Quality Gate (`ci.yml`) — main b5946be4 | ✅ SUCCESS | TypeScript: 0 errors; Tests: 5514 total, 5497 pass, 0 fail, 17 skip; Security/Lint: pass |
| **36428833487** | Continuous Deployment & Migration Gates — main b5946be4 | ✅ SUCCESS | Prisma validate, migrations, drift check, npm audit, build — all pass |
| **36427673693** | CI Quality Gate — PR #131 | ✅ SUCCESS | Preceding PR CI green |

### Test suite breakdown (run 36428833453)
- **Total**: 5514
- **Pass**: 5497
- **Fail**: 0 ← **không có regression**
- **Skip**: 17 — xác minh từ codebase: `t.skip('Legacy agent config not present')` × 9 (`agent-config.test.ts`, `agent-limits.test.ts`), `t.skip('Legacy ownership guard hook not present')` × 4 (`readonly-shell.test.ts`), `t.skip('settings.json not found / hook not present')` × 4 (`hook-portable.test.ts`). **Không phải DB-dependent.** Đây là tests cho legacy config artifacts không còn tồn tại sau Phase 5 cleanup.
- **Cancelled**: 0

---

## 3. Production Health

### Endpoint: `https://qcet.dixxie.store/api/health`
*Lấy lúc: 2026-09-28 13:51:40 UTC*

```json
{
  "database": { "latencyMs": 2, "status": "healthy" },
  "durationMs": 2,
  "status": "ok",
  "system": "QCET E-Office On-Premise",
  "timestamp": "2026-09-28T13:51:40.595Z",
  "uptimeSeconds": 278934
}
```

### Container age analysis
```
Container started:  2026-09-25 08:22:46
PR #131 merged:     2026-09-28 13:28:12
Uptime at probe:    3 days, 5h 28m 54s
Pre-PR#131:         TRUE
```

**Lưu ý quan trọng về container uptime:**  
Uptime `278934s` (~3 ngày) cho thấy container process bắt đầu chạy vào khoảng **2026-09-25 08:22:46**, tức là **trước thời điểm PR #131 merge** (2026-09-28 13:28:12). Điều này **chứng minh container process predates merge**, nhưng **không chứng minh** image SHA cụ thể đang chạy hay code nào đang được deploy. Không có SSH access vào host, image SHA thực tế và version cụ thể không thể xác minh từ bên ngoài.

### Endpoint: `/api/health/ready`
```
status: ready
database: healthy
schema: 1 migration applied
storage: healthy
```

### Endpoint: `/api/health/live`
```
status: alive
RSS: 159MB
uptime: 278785s (~3 days)
```

---

## 4. Phase-by-Phase Evidence

### Phase 0 — Baseline, decisions, pilot contract
| Item | Status | Evidence |
|------|--------|----------|
| Route/method inventory | ✅ | `api-inventory-current-2026-09.md` — 98 files, 131 method pairs |
| Dashboard/portal reconciliation | ✅ | `plan-reconciliation-2026-09-28.md` |
| Page template traceability | ✅ | `page-template-traceability-matrix.md` — 22 templates mapped |
| Auth pattern decision | ✅ | ADR documented; next-auth v5 session |
| RBAC audit | ✅ | `canonical-findings-tracker-2026-09-28.md` |
| **Digital signature provider** | ⛔ BLOCKED | CA vendor contract (VNPT SmartCA / Viettel CA) not available. Adapter boundary: `src/lib/crypto/digital-signature-adapter.ts` — provider-neutral, ready. |

### Phase 1 — Security and lifecycle blockers
| Item | Status | Evidence |
|------|--------|----------|
| BOLA fix (list + detail) | ✅ | `buildTaskReadWhere` consistent; GET `/api/tasks/[id]` verified |
| RFC-06 §3.1/§3.2 scope | ✅ | TaskScope=INDIVIDUAL actor-confined; unit leader exception |
| Temporal validity | ✅ | `effectiveFrom ≤ now`, `effectiveTo null or ≥ now` |
| Auth middleware | ✅ | Session token on all protected routes |
| Concurrency / idempotency | ✅ | Optimistic-concurrency + outbox consistent |
| Correlation IDs | ✅ | Middleware echoes `x-request-id` on all return paths |

### Phase 2 — Canonical Task–document pipeline
| Item | Status | Evidence |
|------|--------|----------|
| Task CRUD + state machine | ✅ | Canonical FSM; `taskStateMachine` in domain layer |
| Incoming-document registry | ✅ | Read-only registry; full contract tests |
| Calendar integration | ✅ | `calendar-ux-remediation` plan delivered |
| Delegation pipeline | ✅ | Delegations route; authority chain enforced |

### Phase 3 — Dossier and file foundation
| Item | Status | Evidence |
|------|--------|----------|
| File-object model | ✅ | Prisma schema; ClamAV scan adapter |
| Dossier lifecycle | ✅ | `checkpoint-phase4-complete-2026-09-28.md` |
| ClamAV TCP adapter | ✅ | `clamav-scanner.ts` (port 3310 internal Docker network) |
| **Backfill (local)** | ✅ | 53/53 CLEAN locally; 17 legacy unsupported skipped; 0 infected |
| **Backfill (production)** | ⛔ BLOCKED | ClamAV daemon (`clamav:3310`) chỉ accessible từ Docker internal network — không thể verify từ ngoài host. Production DB credential: backfill script dùng `new PrismaClient()` → đọc biến `DATABASE_URL` từ shell env (không phải `APP_DATABASE_URL` trực tiếp; docker-compose map `APP_DATABASE_URL` → `DATABASE_URL` bên trong container, nhưng khi chạy script trực tiếp trên host cần `DATABASE_URL` trong shell). Không có SSH access để verify. |

### Phase 4 — Pilot screens and E2E workflows
| Item | Status | Evidence |
|------|--------|----------|
| Login / role workbench | ✅ | `checkpoint-phase4-batch1-2026-09-28.md` |
| Task Hub / detail / inbox | ✅ | UnifiedAdaptiveWorkspace; ModularCascadingTaskTable |
| Incoming-document detail | ✅ | Delivered with contract tests |
| Calendar / meeting screen | ✅ | Delivered |
| Org lookup | ✅ | Read-only directory; RBAC gated |
| Dossier list / detail | ✅ | `checkpoint-phase4-batch2-2026-09-28.md` |
| Personal settings | ✅ | `/settings` route |

### Phase 5 — Full-scope modules and integrations
| Item | Status | Evidence |
|------|--------|----------|
| Outgoing document lifecycle | ✅ | compose/detail/action-panel/stepper/service/numbering; 60/60 tests |
| Internal document workflow | ✅ | 6/6 contract tests; institutional numbering; submit→approve |
| Notification center | ✅ | Push notification + web-push adapter |
| Audit / operations log | ✅ | Read-only; `system.audit.view` — SYSTEM_ADMIN + HIEU_TRUONG |
| Feature flags | ✅ | 16 defined; 4 kill switches (default true); 12 phased rollout (default false, safe) |
| **Digital signature integration** | ⛔ BLOCKED | Adapter boundary ready (`src/lib/crypto/digital-signature-adapter.ts`). Blocked on CA vendor contract. |

### Phase 6 — Migration cutover, observation, release
| Item | Status | Evidence |
|------|--------|----------|
| CI test suites | ✅ | Run 36428833453: 5497 pass, 0 fail; run 36428833487: build + migration gate pass |
| Recovery docs / runbooks | ✅ | `recovery-paths.md`, `rollback.md`; 11 failure scenarios documented |
| Correlation IDs operational | ✅ | `x-request-id` echoed middleware-wide |
| **Reconcile audit findings** | 🟡 PARTIAL | `canonical-findings-tracker-2026-09-28.md` ghi nhận các findings; pre-pilot findings documented in canonical tracker; production observation/reconciliation pending (không thể verify production behavior trước deploy). |
| **Deploy pilot** | ⛔ BLOCKED | No SSH/docker-remote/platform-API credentials. `deploy.yml` là build/migration gate, không có SSH/push step. Manual deploy trên host: `docker compose build && docker compose up -d` (repo dùng local `build:` directive, không có registry image; `docker compose pull` chỉ áp dụng nếu có registry — chưa evidenced). Production container process started 2026-09-25, predates PR #131 merge (2026-09-28), nhưng image SHA thực tế không xác minh được từ ngoài host. |
| **Observation window** | ⛔ BLOCKED | Dependent on deploy. Cannot collect pilot metrics until new container runs. |
| **Legacy retirement** | ⛔ BLOCKED | Dependent on observation window. |

---

## 5. Blockers còn lại — Bằng chứng xác thực

### Blocker A — Digital signature provider
- **Lý do genuine**: CA vendor contract (VNPT SmartCA / Viettel CA) chưa ký; không có credentials nào trên máy này.
- **Adapter boundary**: `src/lib/crypto/digital-signature-adapter.ts` — provider-neutral; đã implement type contracts; chờ vendor SDK.
- **Unblocked by**: Owner chọn vendor → cấp credentials → tích hợp SDK vào adapter.

### Blocker B — Production deploy
- **Lý do genuine**: `deploy.yml` chỉ là build/migration validation gate — không có SSH step, không có `docker push`, không có platform-API.
  ```yaml
  # deploy.yml (xác nhận từ docs/operations/deployment.md)
  # Jobs: migrate → build → validate
  # NO: ssh, docker push, docker-compose, sftp
  ```
- **Manual deploy pattern**: `docker compose build && docker compose up -d` trên production host. **Lý do**: `docker-compose.yml` khai báo `build: context: . dockerfile: Dockerfile` cho service `qcet-app` — đây là local build pattern. `docker compose pull` chỉ hoạt động nếu image đã tồn tại trong remote registry; không có registry push step nào được evidenced trong repo. Image name `qcet-eoffice-app:latest` là local tag.
- **Unblocked by**: Owner cấp SSH key hoặc docker remote context cho production host `qcet.dixxie.store`.

### Blocker C — Production file-object backfill
- **Lý do genuine**: ClamAV daemon trên production host chưa xác nhận (`CLAMAV_HOST: clamav`, port `3310` — chỉ accessible trong Docker internal network). DB variable: backfill script (`scripts/backfill-file-objects.ts`) dùng `new PrismaClient()` → đọc `DATABASE_URL` từ shell env; không tham chiếu `APP_DATABASE_URL` trực tiếp. Trên production host, shell phải export `DATABASE_URL` (docker-compose map `APP_DATABASE_URL` → `DATABASE_URL` chỉ áp dụng bên trong container; script chạy trực tiếp cần `DATABASE_URL` trong shell env). Chưa có SSH access để verify.
- **Local evidence**: 53/53 CLEAN (local worktree với dev database).
- **Config**: `CLAMAV_HOST: clamav`, `CLAMAV_PORT: 3310` — chỉ accessible trong Docker internal network.
- **Unblocked by**: (1) Xác nhận ClamAV container chạy trên host; (2) export `DATABASE_URL` (= production DB credential) trong shell trước khi chạy script; (3) sau deploy.

---

## 6. Deliverables hoàn thành (tổng hợp toàn phiên)

### Code
- 98 API route files, 133 HTTP method handlers
- Task Hub: UnifiedAdaptiveWorkspace + ModularCascadingTaskTable (canonical, không song song)
- 60 outgoing-document tests pass
- 6 internal-document contract tests pass
- 26 CSRF security tests pass
- 531 → 642 contract tests pass (bao gồm supplementary files)
- 5497 / 5514 tests pass (CI run 36428833453, main)
- 16 feature flags, tất cả deferred modules default `false`

### Docs
- `checkpoint-all-phases-summary-2026-09-28.md`
- `checkpoint-phase6-progress-2026-09-28.md`
- `canonical-findings-tracker-2026-09-28.md`
- `api-inventory-current-2026-09.md`
- `plan-reconciliation-2026-09-28.md`
- `page-template-traceability-matrix.md`
- `recovery-paths.md` + `rollback.md`
- `final-evidence-report-phase6-2026-09-28.md` (this file)

### Infrastructure
- Health endpoints: `/api/health`, `/api/health/ready`, `/api/health/live`
- Correlation IDs: `x-request-id` echoed middleware-wide
- CI pipeline: ci.yml fully green on main b5946be4

---

## 7. Hành động tiếp theo cho Owner

| Ưu tiên | Hành động | Unblocks |
|---------|-----------|----------|
| 🔴 HIGH | Chọn CA vendor (VNPT SmartCA / Viettel CA) | Phase 0 + Phase 5 digital signature |
| 🔴 HIGH | Cấp production SSH / docker remote context | Phase 6 deploy pilot |
| 🔴 HIGH | Xác nhận ClamAV running trên production host | Phase 6 file-object backfill |
| 🟡 MED | Export `DATABASE_URL` (production DB credential) trong shell trước khi chạy backfill | Phase 6 backfill safety |
| 🟡 MED | Sau deploy: chạy `backfill-file-objects.ts --apply` | Parity giữa local và prod |
| 🟢 LOW | Monitor 30-day observation window | Legacy retirement |

---

*Mọi unblocked work đã hoàn thành. Báo cáo này là bằng chứng trung thực — không giả tạo production deployment thành công khi chưa có SSH access.*

---
**SHA:** b5946be4c62241afb91c264fcd00c4e95d3a0916  
**CI run (tests):** 36428833453 — ✅ 5497 pass, 0 fail  
**CI run (build/migrations):** 36428833487 — ✅ SUCCESS  
**Production health:** HTTP 200, DB latency 2ms, uptime 278934s  
**Production container age:** ~3 days (container started 2026-09-25 08:22:46 ICT; predates PR #131 merge on 2026-09-28 13:28:12 by ~3 days — image SHA cannot be verified without production SSH access)
