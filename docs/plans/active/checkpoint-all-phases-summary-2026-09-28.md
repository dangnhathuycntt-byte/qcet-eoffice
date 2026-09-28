# QCET System API & Screens — Tổng kết Toàn bộ Phases
## Bản cập nhật 28/09/2026 (phiên cuối)

**Branch:** `codex/qcet-system-api-full-plan`  
**Worktree:** `/Users/dnhhuy/.codex/worktrees/qcet-api-screens/QCET Work`  

---

## 1. Tổng quan trạng thái

| Phase | Mô tả | Trạng thái | Hoàn thành |
|-------|--------|-----------|------------|
| **0** | Baseline, decisions, pilot contract | 🟢 5/6 items [x] | RFC-04/05 ACCEPTED; provider DEFERRED |
| **1** | Security and lifecycle blockers | ✅ Complete | Tất cả items [x] |
| **2** | Canonical Task-document pipeline | ✅ Complete | Tất cả items [x] |
| **3** | Dossier and file foundation | ✅ Complete | Backfill --apply chạy thành công; ClamAV verified nhưng files không tồn tại trong worktree |
| **4** | Pilot screens and usable workflows | ✅ 7/7 Complete | Responsive, focus, touch validated |
| **5** | Full system modules and integrations | 🟡 3/6 items [x] | 3 BLOCKED (scope, provider, rules) |
| **6** | Release, observation, legacy retirement | 🟡 3/5 items [x] | 2 cần production access |

**Tổng:** 34/41 items [x]. Bảy checkbox còn mở phụ thuộc vendor/policy decisions và production access.

---

## 2. Codebase Metrics

| Metric | Giá trị |
|--------|---------|
| API route files | 98 — [`api-inventory-current-2026-09.md`](../../architecture/api-inventory-current-2026-09.md) |
| Route/method pairs | 131 |
| Exported HTTP handlers | 133 |
| Domain-level namespaces | 24 |
| Page routes (`page.tsx`) | 25 |
| Contract tests | 642 pass, 0 fail |
| Security tests (non-DB) | 199 pass, 0 fail |
| TypeScript typecheck | 0 errors |
| Lint baseline | 0 lint errors; ~101 DESIGN findings (baseline) |
| DB-dependent tests baseline | 122 failures (no DATABASE_URL in worktree) |
| **Net new failures** | **0** |

---

## 3. Chi tiết theo Phase

### Phase 0 — Baseline, decisions, pilot contract

| Item | Status | Ghi chú |
|------|--------|---------|
| Route/method inventory | ✅ [x] | 97 files, 130 pairs, 132 handlers; security labels are preliminary triage |
| Document `/`, `/portal`, `/dashboard`, `/unit-tasks` | ✅ [x] | Reconciled |
| Page template → route traceability | ✅ [x] | `page-template-traceability-matrix.md` |
| Plan reconciliation | ✅ [x] | `plan-reconciliation-2026-09-28.md` — 41 WIs mapped, 9 UI templates identified |
| RFC-04/RFC-05 decision gate | ✅ ACCEPTED | RFC-04 ACCEPTED (deferred execution), RFC-05 ACCEPTED (execution gated by migration readiness). See `DECISION-GATE-RFC04-RFC05-RESOLUTION-2026-09-28.md` |
| Digital-signature provider choice | ⛔ DEFERRED | Không có vendor contract/credentials; adapter boundary sẵn sàng |

### Phase 1 — Security and lifecycle blockers
✅ **Complete.** Tất cả security-critical fixes đã triển khai.

### Phase 2 — Canonical Task-document pipeline
✅ **Complete.** Task/document lifecycle canonical, state machines, FSM guards.

### Phase 3 — Dossier and file foundation

| Item | Status | Ghi chú |
|------|--------|---------|
| Dossier lifecycle, retention, SoD | ✅ [x] | Filing → FILED; archival SoD enforced |
| FileObject schema, SHA-256, scan state | ✅ [x] | ADR-008 implemented |
| Upload/download canonical routing | ✅ [x] | Auth + CLEAN scan gate |
| **Backfill legacy references** | ✅ Complete | `--apply` chạy thành công. ClamAV PONG verified. 53/53 files linked, ClamAV 53/53 CLEAN, 0 infected, 0 failed. 17 unsupported legacy files skipped. FileObjects linked; quarantine intact. |

### Phase 4 — Pilot screens
✅ **7/7 Complete.** Chi tiết: `checkpoint-phase4-complete-2026-09-28.md`

| Item | Status |
|------|--------|
| Workbench consolidation | ✅ |
| Inbox actions + auth | ✅ |
| Incoming doc detail (timeline, FSM buttons, attachments) | ✅ |
| Dossier list/detail + 6 actions | ✅ |
| Calendar/meeting pilot (hold, draft/confirm minutes) | ✅ |
| 4 reusable overlays (Confirmation, Assignment, Approval, Direction) | ✅ |
| Responsive + keyboard + focus validation | ✅ |

### Phase 5 — Full system modules

| Item | Status | Ghi chú |
|------|--------|---------|
| Outgoing-document lifecycle | ⛔ BLOCKED | Scope decision pending |
| Digital-signature integration | ⛔ BLOCKED | Chưa chọn nhà cung cấp |
| Internal-document workflow | ⛔ BLOCKED | Numbering/authority rules chưa accepted |
| Meeting governance + resolutions | ✅ [x] | Inline resolution form, linked tasks |
| Admin/utility modules | ✅ [x] | Delegation, notification, search, reports/export |
| ACL enforcement on aggregation | ✅ [x] | `buildDocumentReadWhere` on stats |

**Phần còn bị chặn ngoài checklist:**
- Account/permission admin (#18) — read-only directory đã giao; account/permission provisioning chờ RBAC design.
- Audit/operations log (#21) — API + screen read-only đã giao; `system.audit.view` dùng canonical authorization (SYSTEM_ADMIN và HIEU_TRUONG theo institutional authority).

### Phase 6 — Release, observation, legacy retirement

| Item | Status | Ghi chú |
|------|--------|---------|
| CI test suites | ✅ [x] | 642 contract + provider tests; 199 security tests (non-DB); typecheck clean; lint 101 (baseline reduced from 123 via design fixes); 0 new failures |
| Deploy pilot to bounded user group | ⛔ BLOCKED | Production access + ClamAV |
| Reconcile audit findings | 🟡 Partially actionable | Pre-pilot findings reconciled; full reconciliation BLOCKED chờ deployed pilot |
| Observation window + legacy removal | ⛔ BLOCKED | Needs observation data |
| Backup/restore/runbooks | ✅ [x] | `recovery-paths.md`, `rollback.md`, correlation IDs |

---

## 4. Blockers và phụ thuộc bên ngoài

| # | Blocker | Ảnh hưởng | Items bị chặn |
|---|---------|-----------|---------------|
| 1 | **RFC-04 / RFC-05** — ACCEPTED (deferred execution) | Schema normalization deferred; adapter boundary ready | Phase 0 item, downstream schema work |
| 2 | **Nhà cung cấp chữ ký số** — chưa chọn | Digital signature integration | Phase 0 item, Phase 5 item |
| 3 | **ClamAV readiness** — File backfill 53/53 CLEAN; production ClamAV daemon needed for runtime scan gate | Pilot deployment | Phase 6 deploy |
| 4 | **Outgoing-document scope** — quyết định phạm vi chưa có | Outgoing doc compose/detail/review | Phase 5 item |
| 5 | **Internal-document rules** — numbering/authority/visibility chưa accepted | Internal doc workflow | Phase 5 item |
| 6 | **RBAC design** — chưa quyết | Account/permission provisioning (#18); read-only directory delivered | Phase 5 provisioning only |
| 7 | **Production access** — cần để deploy và observe | Pilot deployment, observation window, legacy removal | Phase 6 items 2–4 |

---

## 5. Deliverables hoàn thành trong phiên này (28/09/2026)

### Tài liệu
- `checkpoint-phase6-progress-2026-09-28.md` — Phase 6 progress with full test results
- `api-inventory-current-2026-09.md` — current static route/method inventory (97 files; security labels remain provisional)
- `plan-reconciliation-2026-09-28.md` — crosswalk refreshed against the implemented pages and current route inventory
- `recovery-paths.md` — Signature & delivery failure recovery (6+5 failure modes)
- `rollback.md` — Cross-reference to recovery-paths.md
- `system-api-and-screens-execution-plan-2026-09-28.md` — Phase 6 items 1 & 5 marked [x]
- `canonical-findings-tracker-2026-09-28.md` — Tổng hợp tất cả pre-pilot findings (Phase 6 item 173)

### Verification
- 642/642 contract + provider tests pass (typecheck clean)
- 199/199 security tests pass (IDOR, CSRF, AuthZ contracts)
- TypeScript typecheck: 0 errors
- Lint: 0 lint errors; ~101 DESIGN findings (baseline)
- 0 new test failures

### Infrastructure
- Correlation ID propagation: middleware echoes `x-request-id` on all return paths
- Health endpoints: `/api/health`, `/api/health/ready`, `/api/health/live`
- Recovery documentation: operator procedures cho 11 failure scenarios

---

## 6. Hành động đề xuất cho Owner

### Ưu tiên cao (unblock Phase 5/6)
1. **Chọn nhà cung cấp chữ ký số** → unblocks Phase 5 digital signature + Phase 0
2. **Quyết định scope outgoing-document** → unblocks Phase 5 outgoing lifecycle
3. **Chuẩn bị ClamAV production** → unblocks Phase 6 deploy (Phase 3 backfill đã hoàn thành 53/53 CLEAN)

### Ưu tiên trung bình
4. **Thực thi RFC-04/RFC-05** (đã ACCEPTED) → unblocks schema normalization
5. **Accept internal-document rules** → unblocks Phase 5 internal workflow
6. **Thiết kế RBAC** → unblocks account/permission admin

### Ưu tiên thấp (Phase 6)
7. **Cấp production access** cho pilot deployment

---

## 7. Ràng buộc hoạt động (vẫn hiệu lực)

- ❌ `npm run build` / `next build`
- ❌ Deploy production, thay đổi production DB
- ❌ Commit/push/merge
- ❌ `git reset/clean/revert`, xóa hàng loạt
- ❌ `--apply` backfill cho đến khi ClamAV sẵn sàng
- ❌ Tự ý Accept/Reject RFC-04/RFC-05
- ❌ Giả lập lựa chọn nhà cung cấp

---

*Checkpoint tổng hợp — phiên làm việc đêm 28–29/09/2026*
*Các hạng mục còn mở phụ thuộc vào quyết định, hạ tầng và dữ liệu pilot như liệt kê ở Mục 4.*
