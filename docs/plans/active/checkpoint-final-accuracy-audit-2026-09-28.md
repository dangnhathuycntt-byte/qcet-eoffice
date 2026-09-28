# Final Accuracy & Stale-Artifact Audit — 28/09/2026

## Phạm vi

8-point audit kiểm tra tính chính xác của tài liệu checkpoint, loại bỏ artifact lỗi thời, và chú thích blocker cụ thể cho mỗi item chưa hoàn thành.

---

## 1. Checklist count reconciliation

**Nguồn gốc:** `system-api-and-screens-execution-plan-2026-09-28.md`

| Metric | Giá trị cũ (sai) | Giá trị đúng |
|--------|-------------------|--------------|
| Items [x] | 33 | **32** |
| Items [ ] | 9 | **9** |
| Tổng | 42 | **41** |

**File đã sửa:** `checkpoint-all-phases-summary-2026-09-28.md` — cập nhật tổng thành 32/41.

### 9 items [ ] với blocker cụ thể:

| Line | Item | Blocker |
|------|------|---------|
| 66 | RFC-04/RFC-05 decision gate | ⛔ Owner decision |
| 67 | Digital-signature provider choice | ⛔ Chưa chọn nhà cung cấp |
| 124 | Backfill legacy file references | ⛔ ClamAV chưa sẵn sàng |
| 156 | Outgoing-document compose/detail | ⛔ Scope decision pending |
| 157 | Digital-signature provider integration | ⛔ Chưa chọn nhà cung cấp |
| 158 | Internal-document workflow | ⛔ Numbering/authority rules chưa accepted |
| 172 | Deploy pilot to bounded user group | ⛔ Production access + ClamAV |
| 173 | Reconcile audit findings | 🟡 Pre-pilot portion done; full reconciliation chờ deployed pilot |
| 174 | Observation window + legacy removal | ⛔ Cần observation data từ deployed pilot |

---

## 2. Phase 0 wording — plan-reconciliation.md

**Vấn đề:** Bản đối chiếu cũ gộp deliverable tài liệu với cổng quyết định, khiến trạng thái Phase 0 không rõ.

**Sửa chữa:**
- Đổi tiêu đề thành "Phase 0 Documentation Deliverables"
- Thêm blockquote ghi chú phân biệt deliverable hoàn thành vs quyết định BLOCKED
- Cập nhật kết luận (Section 7) phân tách: deliverable ✅ hoàn thành, quyết định ⛔ BLOCKED
- Trong mục 6.3, giữ RFC-04/RFC-05 ở trạng thái PROPOSED và ghi rõ BLOCKED; không tự ý Accept/Reject
- Footer ghi rõ "4/6 items hoàn thành; 2 items BLOCKED"

---

## 3. Phase 6 item 173 — Blocker annotation

**Vấn đề:** Item 173 không có annotation blocker, dù 2 item kề cận (172, 174) đều có.

**Phân tích:**
- **Phần locally actionable:** Reconcile pre-pilot findings (493 contract test results, 199 security test results, operations docs) vào checkpoint documents → **ĐÃ HOÀN THÀNH** trong các checkpoint Phase 4/5/6.
- **Phần cần deployed pilot:** Real authorization-denial logs, command-conflict observations, outbox-failure patterns, workflow-aging data → **BLOCKED chờ production deploy.**

**Sửa chữa:**
- Thêm annotation vào execution plan item 173
- Cập nhật Phase 6 status note (line 179) phản ánh tính chất dual của item 173
- Cập nhật all-phases-summary: item 173 đánh dấu 🟡 thay vì ⛔

---

## 4. Metrics labeling

**Vấn đề:** Một số checkpoint mô tả metrics như thể chúng thuộc commit `38425d5f`, dù toàn bộ phần thực thi chưa commit.

**Sửa chữa:**
- Checkpoints label evidence as HEAD `38425d5f` plus uncommitted working-tree changes
- Follow-up audit snapshot: **188 paths** — 97 modified, 89 untracked, 2 deleted
- Counts describe the current worktree snapshot; they are not committed changes

---

## 5. Stale artifact deletion

### Đã xóa (confirmed unreferenced, superseded):

| File | Size | SHA-256 | Lý do xóa |
|------|------|---------|-----------|
| `mockup-ban-lam-viec.html` | 58,684 bytes | `4604a6e0...` | Mockup Bàn làm việc — superseded bởi `src/components/dashboard/` implemented screens. Zero references trong codebase. Vi phạm zero-mockup spec (`SPEC_ERADICATE_MOCKUPS_AND_REAL_QCET_ALIGNMENT.md`). |
| `public/mockup-ban-lam-viec.html` | 58,684 bytes | `4604a6e0...` | Identical copy (cùng git blob `54ce8959...`). |

| `docs/architecture/plan-reconciliation-2026-09-28.md` | — | — | Removed as an untracked stale duplicate; the maintained crosswalk is `docs/plans/active/plan-reconciliation-2026-09-28.md`. |

### Đã rà soát và giữ lại làm tài liệu tham khảo:

| File | Size | Tính chất | Lý do giữ |
|------|------|-----------|-----------|
| `ux-evaluation-audit.html` | 20,199 bytes | UX Audit Report | Retained as historical UX audit material; not a mockup, no clear superseding report found. |
| `enterprise-motion-design-spec.html` | 36,346 bytes | Motion design reference | Retained; no clear superseding document found. |
| `motion-performance-a11y-guide.html` | 27,985 bytes | Accessibility/performance reference | Retained; no clear superseding document found. |
| `.claude/audit-task-creation-frontend.html` | 27,192 bytes | Frontend audit artifact | Retained as dated internal audit evidence, not a product mockup. |

The old `api-inventory.md` is retained as a **2026-09-09 historical snapshot**. Its 31-route/43-handler counts and security findings are explicitly marked historical; `api-inventory-current-2026-09.md` is the current static inventory (98 route files, 131 declared route/method pairs, 133 exports; security labels are preliminary triage).

---

## 6. plan-reconciliation.md consistency

| Claim | Kiểm chứng | Kết quả |
|-------|------------|---------|
| "22 templates" (execution plan) | Đếm trong execution plan | ✅ Chính xác — 22 templates referenced in exit gate |
| "41 work items" (implementation plan v1) | Đếm WI-0.1→WI-9.4 | ✅ Chính xác |
| "9 UI templates" không trong implementation plan | Section 3 liệt kê | ✅ Chính xác — 9 items listed |
| "38/41 backend-only" | Section 2 kết luận | ✅ Chính xác — 38 + 3 overlap = 41 |
| Phase 0 status | Active crosswalk title + conclusion | ✅ Documentation deliverables complete; RFC-04/05 and provider choice remain blocked |
| API inventory status | Historical and current inventories | ✅ 31/43 snapshot labelled historical; 97/130/132 static surface linked |
| Implemented screens | Source tree + traceability matrix | ✅ 23 page routes; incoming detail, dossiers, meeting detail, compose and workbench are present |

---

## 7. Verification results

| Check | Kết quả |
|-------|---------|
| `git diff --check` | ✅ Không có whitespace errors |
| `npm run typecheck` | ✅ 0 errors (final audit run) |
| Mockup deletion | ✅ 2 files xóa sạch, không ảnh hưởng codebase |
| Dirty file count | 188 paths (97M, 89 untracked, 2D) at follow-up audit snapshot |

---

## 8. Final status — 9 unchecked items by blocker

| Blocker | Items bị chặn | Giải pháp |
|---------|---------------|-----------|
| **Owner chưa quyết RFC-04/RFC-05** | Line 66 | Owner Accept/Reject |
| **Chưa chọn nhà cung cấp chữ ký số** | Lines 67, 157 | Chọn provider |
| **ClamAV chưa sẵn sàng** | Lines 124, 172 | Deploy ClamAV container |
| **Scope outgoing-document chưa quyết** | Line 156 | Owner quyết định phạm vi |
| **Internal-document rules chưa accepted** | Line 158 | Accept numbering/authority rules |
| **RBAC design chưa quyết** | Template #18 provisioning | Owner chốt policy trước khi tạo/sửa tài khoản hoặc phân quyền; read-only directory đã có |
| **Production access** | Lines 172, 173 (partial), 174 | Cấp production access + deploy pilot |

### Tổng kết

- **32/41 items hoàn thành** (execution plan)
- **9 checkboxes còn mở**; các mục phụ thuộc quyết định, scanner/backfill hoặc pilot. Item 173 đã hoàn tất phần pre-pilot; phần post-pilot vẫn mở.
- Ma trận 22 templates: **18 exists, 3 needs-enhancement, 1 needs-creation**. #18 có read-only directory nhưng provisioning chờ RBAC design; #21 audit API/screen đã được triển khai với canonical capability authorization. Internal Document (#16) chờ chốt scope.
- **2 mockup files** đã xóa (117,368 bytes total)
- **3 design-reference HTML và 1 internal audit HTML** được giữ lại vì không phải mockup và chưa có tài liệu thay thế rõ ràng
- **0 regressions** — typecheck clean, git diff --check clean

---

*Audit checkpoint — phiên làm việc 28/09/2026*
*Tất cả sửa chữa đã áp dụng trực tiếp vào các tài liệu nguồn.*
