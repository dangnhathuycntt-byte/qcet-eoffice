# Canonical Findings Tracker — Pre-Pilot Reconciliation

| Trường | Giá trị |
|--------|---------|
| Ngày lập | 28/09/2026 |
| Phase 6 Item | 173 — Reconcile audit findings |
| Trạng thái | 🟡 Pre-pilot portion COMPLETE; full reconciliation BLOCKED chờ deployed pilot |
| Scope | Tổng hợp tất cả findings từ contract tests, security tests, operations docs, checkpoint reports, và accuracy audit vào một tracker duy nhất |

---

## 1. Contract Test Findings (531/531 aggregated pass)

| Test File | Tests | Pass | Findings |
|-----------|-------|------|----------|
| task-contracts.test.ts | 76 | 76 | Không có issue |
| document-creation-contracts.test.ts | 48 | 48 | Không có issue |
| document-action-contracts.test.ts | 38 | 38 | Không có issue |
| document-query-contract.test.ts | 56 | 56 | Không có issue |
| update-document-contract.test.ts | 59 | 59 | Không có issue |
| batch-document-contract.test.ts | 13 | 13 | Không có issue |
| document-stats-acl.test.ts | 7 | 7 | Không có issue |
| export-document-contract.test.ts | 15 | 15 | Không có issue |
| dossier-contract-validation.test.ts | 24 | 24 | Không có issue |
| dossier-supplementary-contract.test.ts | 14 | 14 | Không có issue |
| meeting-contract.test.ts | 38 | 38 | Không có issue |
| meeting-resolution-contract.test.ts | 11 | 11 | Không có issue |
| executive-contract.test.ts | 26 | 26 | Không có issue |
| notification-contract.test.ts | 27 | 27 | Không có issue |
| user-query-contract.test.ts | 43 | 43 | Query parsing, role/search filters, pagination window and count metadata |
| audit-log-api-contract.test.ts | 28 | 28 | Không có issue (real authorization engine tests) |
| ict-date-boundaries.test.ts | 5 | 5 | ICT start/end boundaries and normalized ordering |
| admin-api-response.test.ts | 3 | 3 | Audit/user envelope mapping and safe defaults |
| **TOTAL** | **531** | **531** | **0 findings** |

**Kết luận:** 44 Zod schemas, 18 test files — tất cả route contracts valid. Không có schema drift, missing validation, hoặc incorrect response shape. Latest focused run: 79/79 tests across the audit, user query, ICT boundary, and admin response suites. Audit log tests bao gồm real `authorize()` engine behavior (SYSTEM_ADMIN, HIEU_TRUONG institutional authority, Separation of Powers, deactivated account denial).

---

## 2. Security Test Findings (199/199 pass)

| Test File | Tests | Pass | Findings |
|-----------|-------|------|----------|
| idor-security.test.ts | 48 | 48 | Không có IDOR vulnerability |
| csrf.test.ts (tests/server/security/) | 77 | 77 | CSRF protection verified |
| authz-security-regression.test.ts | 74 | 74 | Authorization contracts intact |
| **TOTAL** | **199** | **199** | **0 findings** |

**Kết luận:** IDOR, CSRF, và AuthZ regression tests toàn bộ pass. Không có security regression từ các thay đổi phiên hiện tại.

---

## 3. Baseline Failures (pre-existing, không phải regressions)

| Category | Count | Root Cause | Action |
|----------|-------|------------|--------|
| Lint errors | 123 trên 655 files | Pre-existing codebase lint debt | Không action — baseline, không từ phiên hiện tại |
| DB-dependent test failures | 122 | Missing `DATABASE_URL` trong worktree | Không action — expected trong isolated worktree |
| Domain test (canonical-routes) | 1 | Label changed `'Quản lý nhiệm vụ'` → `'Nhiệm vụ'` | Pre-existing branch label change |
| Infrastructure (path-matcher) | 1 | Missing `.claude/hooks/path-matcher.cjs` | Worktree-specific, không từ current changes |

**Kết luận:** 0 net new failures. Tất cả 247 failures đều là baseline pre-existing.

---

## 4. TypeScript Typecheck

| Check | Kết quả |
|-------|---------|
| `npm run typecheck` (`tsc --noEmit`) | ✅ 0 errors |

---

## 5. Operations Documentation Findings

### 5.1 Recovery Paths (`docs/operations/recovery-paths.md`)
✅ Tài liệu đầy đủ cho 11 failure scenarios:
- **Signature failures (6):** provider unreachable, certificate expired, certificate revoked, HSM failure, tampered document, rate limit exceeded
- **Delivery gateway failures (5):** gateway down, partial delivery, attachment too large, invalid recipient, timeout

### 5.2 Rollback Procedures (`docs/operations/rollback.md`)
✅ Cross-linked từ recovery-paths.md. Correlation ID propagation verified.

### 5.3 Health Endpoints
✅ Ba endpoints hoạt động đúng:
- `/api/health` — basic health
- `/api/health/ready` — readiness probe
- `/api/health/live` — liveness probe

### 5.4 Correlation IDs
✅ Middleware wired — tất cả return paths echo `x-request-id`. Static asset bypass (intentional).

---

## 6. Accuracy Audit Findings (8-point audit, 28/09/2026)

| # | Audit Point | Kết quả | Action Taken |
|---|-------------|---------|--------------|
| 1 | Checklist count reconciliation | ✅ Fixed | 32/41 (was incorrectly 33/42) |
| 2 | Phase 0 wording | ✅ Fixed | Title → "Documentation Deliverables", 2 BLOCKED items noted |
| 3 | Phase 6 item 173 annotation | ✅ Fixed | Marked 🟡 partially actionable |
| 4 | Metrics labeling | ✅ Fixed | "HEAD + dirty" notation throughout |
| 5 | Stale artifact deletion | ✅ Done | 2 duplicate mockups deleted; design/audit references retained |
| 6 | plan-reconciliation consistency | ✅ Updated | Active crosswalk reflects current routes/screens; stale duplicate removed |
| 7 | Verification (typecheck, git diff) | ✅ Clean | 0 errors, 0 whitespace issues |
| 8 | Final status | ✅ Documented | 9 items × specific blockers |

---

## 7. Cross-Document Reconciliation Findings (workflow audit, 28/09/2026)

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | Working-tree path count changed during follow-up: prior 162 → current 188 (97 modified, 89 untracked, 2 deleted) | Error | ✅ Recounted from `git status --short --untracked-files=all` |
| 2 | Phantom test file: `csrf-auth-security.test.ts` → actual `csrf.test.ts` | Error | ✅ Fixed |
| 3 | Phantom test file: `authorization-contracts.test.ts` → actual `authz-security-regression.test.ts` | Error | ✅ Fixed |
| 4 | Page/API surface counts lagged new screens/routes | Warning | ✅ Recounted from source: 25 pages, 98 API route files, 131 route/method pairs, 133 handlers |
| 5 | Admin template status stale; Global audit API listed as blocked | Error | ✅ Fixed — #18 partial/provisioning gated; #21 read-only API/screen delivered under canonical authorization |
| 6 | Phase 6 checkpoint uses 3-task vs execution plan's 5-item structure | Warning | Noted — different granularity, both valid |
| 7 | `page-template-traceability-matrix.md` reference lacks full path | Warning | Noted — file exists at `docs/plans/active/` |
| 8 | Old API inventory still contained the 31-route/43-handler snapshot | Error | ✅ Marked historical; linked the current 97-route inventory. Security labels remain preliminary triage. |

---

## 8. Stale Artifacts

### Đã xóa
| File | Status |
|------|--------|
| `mockup-ban-lam-viec.html` | ✅ Deleted (58,684 bytes) |
| `public/mockup-ban-lam-viec.html` | ✅ Deleted (58,684 bytes) |

### Design and audit references reviewed
| File | Size | Recommendation |
|------|------|----------------|
| `ux-evaluation-audit.html` | 20,199 bytes | Retained as an unreferenced UX audit report; not a mockup, no clear superseding report found |
| `enterprise-motion-design-spec.html` | 36,346 bytes | Retained as motion-design reference; no clear superseding document found |
| `motion-performance-a11y-guide.html` | 27,985 bytes | Retained as accessibility/performance guidance; no clear superseding document found |
| `.claude/audit-task-creation-frontend.html` | 27,192 bytes | Retained as dated internal audit evidence, not a product mockup |

---

## 9. External Blockers — 7 nhóm phụ thuộc còn mở

| # | Blocker | Items bị chặn | Mức ưu tiên |
|---|---------|---------------|-------------|
| 1 | **Nhà cung cấp chữ ký số** chưa chọn | Phase 0 (line 67), Phase 5 (line 157) | Cao |
| 2 | **Scope outgoing-document** chưa quyết | Phase 5 (line 156) | Cao |
| 3 | **ClamAV readiness** | Phase 3 backfill (line 124), Phase 6 deploy (line 172) | Cao |
| 4 | **RFC-04/RFC-05** chờ Owner | Phase 0 decision gate (line 66) | Trung bình |
| 5 | **Internal-document rules** chưa accepted | Phase 5 (line 158) | Trung bình |
| 6 | **RBAC design** chưa quyết | Phase 5 blocked dependency | Trung bình |
| 7 | **Production access** | Phase 6 (lines 172, 173 partial, 174) | Thấp (chờ blockers #1–6) |

---

## 10. Post-Pilot Findings (BLOCKED — chờ deployed pilot)

Các findings sau **không thể thu thập** cho đến khi có deployed pilot:

| Finding Type | Cần từ pilot |
|-------------|-------------|
| Real authorization-denial logs | Production access logs |
| Command-conflict observations | Multi-user concurrent edits |
| Outbox-failure patterns | Real delivery gateway interactions |
| Workflow-aging data | Time-based state transitions in production |
| Document routing accuracy | Real organizational hierarchy routing |
| Notification delivery reliability | Push notification under real load |

**Kết luận:** Post-pilot reconciliation sẽ hoàn thành Phase 6 item 173 sau khi pilot deployed.

---

## 11. Tổng kết

| Metric | Giá trị |
|--------|---------|
| **Execution plan items hoàn thành** | 32/41 |
| **Items còn mở** | 9 (liên quan quyết định, hạ tầng và pilot) |
| **Contract tests** | 531/531 aggregated ✅; latest focused set 79/79 ✅ |
| **Security tests** | 199/199 ✅ |
| **Typecheck** | 0 errors ✅ |
| **Net new failures** | 0 ✅ |
| **Accuracy audit findings** | 8/8 resolved ✅ |
| **Cross-document reconciliation findings** | 5 errors fixed, 3 warnings noted ✅ |
| **Mockup artifacts removed** | 2 (117,368 bytes); stale duplicate crosswalk also removed |
| **Design/audit references retained** | 4 (not mockups; no clear superseding source) |
| **Pre-pilot reconciliation** | ✅ COMPLETE |
| **Post-pilot reconciliation** | ⛔ BLOCKED chờ deployed pilot |

Các hạng mục còn mở cần quyết định, hạ tầng hoặc dữ liệu pilot. Account/Permission Admin (#18) read-only directory đã triển khai; provisioning vẫn BLOCKED chờ RBAC design. Audit/Operations Log (#21) đã triển khai read-only với canonical authorization. Ma trận hiện ghi nhận 18 `exists`, 3 `needs-enhancement`, 1 `needs-creation`.

---

*Canonical findings tracker — phiên làm việc 28/09/2026*
*Tài liệu này hoàn thành phần locally-actionable của Phase 6 item 173.*
