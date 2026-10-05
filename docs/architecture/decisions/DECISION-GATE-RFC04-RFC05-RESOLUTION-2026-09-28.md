# Biên bản Quyết định RFC-04 / RFC-05 — Autonomous Resolution

| Trường          | Giá trị                                |
| --------------- | -------------------------------------- |
| Mã số           | DECISION-GATE-RFC04-RFC05-2026-09-28  |
| Ngày lập        | 28/09/2026                             |
| Phương thức     | Autonomous evidence-based resolution   |
| Tham chiếu      | DECISION-GATE-PHASE-0.3-2026-09-28    |

---

## 1. RFC-04: Document Domain Location — **ACCEPTED (Deferred Execution)**

### Quyết định
**ACCEPTED** — đề xuất kiến trúc phân tầng miền chuẩn tắc cho phân hệ Văn bản được chấp thuận.

### Ràng buộc thực thi
- **Không thực thi ngay** trong phiên hiện tại — RFC-04 yêu cầu refactoring cấu trúc thư mục, đang ở Phase 5 scope.
- Thực thi sử dụng Re-export Facades Pattern như mô tả trong RFC — zero-downtime, không DB migration.
- Phải tuân thủ trình tự: tạo `src/domain/documents/` → move pure domain logic → facade re-exports tại `src/lib/documents/` → update callers → retire facades.

### Bằng chứng hỗ trợ quyết định
1. **Gap G9 đã được xác định** trong `enterprise-product-architecture.md` — Document FSM nằm ngoài domain layer là nợ kiến trúc rõ ràng.
2. **Tiền lệ thành công**: `src/domain/tasks/` đã chứng minh pattern domain layer hoạt động tốt trong codebase.
3. **Rủi ro thấp**: Re-export Facades đảm bảo không breaking change. Rollback bằng `git revert` đơn giản.
4. **Không có schema change**: Prisma schema giữ nguyên hoàn toàn.
5. **Tất cả 8 ADRs nền tảng** (ADR-001 đến ADR-008) đã ACCEPTED, không có conflict.

### Lý do không defer thêm
- Mọi triển khai Phase 5 (outgoing/internal workflow) sẽ hưởng lợi từ domain layer chuẩn tắc.
- Deferral lâu hơn chỉ tăng chi phí refactoring sau này.

---

## 2. RFC-05: Document JSON/Text Relations — **ACCEPTED (Execution Gated by Migration Readiness)**

### Quyết định
**ACCEPTED** — đề xuất chuẩn hóa quan hệ JSON/Text denormalized được chấp thuận về nguyên tắc.

### Ràng buộc thực thi
- **Không thực thi cho đến khi có migration readiness** — yêu cầu:
  1. DB migration (additive expand trước, sau đó backfill/parity/cutover).
  2. ClamAV sẵn sàng cho file backfill (Phase 3 dependency).
  3. Production access để chạy expand migration.
- Ưu tiên **Phương án A (Explicit Join Models)** cho `collaboratorIds` và `coordinatingUnitIds` theo phân tích trong RFC. JSONB với GIN index (Phương án B) chỉ dùng cho trường hợp schema không thể mở rộng.

### Bằng chứng hỗ trợ quyết định
1. **5 khiếm khuyết kiến trúc** được chứng minh rõ ràng trong RFC-05: zero FK constraints, no cascade delete, query inefficiency, semantic ambiguity, concurrency anomalies.
2. **Pattern migration đã có tiền lệ**: ADR-008 FileObject expand migration đã thành công.
3. **Implementation plan v1** yêu cầu expand/backfill/parity/cutover/observe/contract sequence.

---

## 3. Các quyết định bổ sung — Autonomous Resolution

### 3.1 Digital Signature Provider — **DEFERRED (No Local Evidence)**
- **Lý do**: Không có hợp đồng vendor, credentials, hay pilot evidence khả dụng.
- **Hành động**: Adapter boundary (`src/lib/crypto/digital-signature-adapter.ts`) đã sẵn sàng. Contract tests (13 adapter + 32 extended) xác nhận interface completeness.
- **Khi nào resolve**: Khi Owner cung cấp vendor contract hoặc credentials.

### 3.2 Outgoing Document Scope — **DEFERRED (Policy Decision)**
- **Lý do**: Phạm vi workflow văn bản đi phụ thuộc quy chế nội bộ tổ chức, không thể suy từ code.
- **Hành động**: Outgoing document state machine contract tests (60 tests) đã cover mọi transition. Service layer sẵn sàng.
- **Khi nào resolve**: Khi Owner xác định scope (full workflow vs simplified issuance).

### 3.3 Internal Document Rules — **DEFERRED (Policy Decision)**
- **Lý do**: Quy tắc đánh số, thẩm quyền, và phạm vi hiển thị văn bản nội bộ cần quyết định nghiệp vụ.
- **Hành động**: Tab "Nội bộ" trong `DocumentRegistryView` đã hiển thị. API endpoints chưa phân tách.
- **Khi nào resolve**: Khi Owner ban hành quy tắc xử lý văn bản nội bộ.

### 3.4 RBAC Design — **DEFERRED (Architecture Decision)**
- **Lý do**: Account/permission provisioning cần thiết kế RBAC model phù hợp với Contextual Authorization Engine (ADR-002).
- **Hành động**: Read-only user directory đã delivered. Authorization engine canonical.
- **Khi nào resolve**: Khi Owner phê duyệt RBAC design proposal.

---

## 4. Tóm tắt

| Quyết định | Trạng thái | Execution Gate |
|-----------|-----------|----------------|
| RFC-04 | **ACCEPTED** | Phase 5 implementation sprint |
| RFC-05 | **ACCEPTED** | Migration readiness + production access |
| Signature Provider | DEFERRED | Vendor contract |
| Outgoing Scope | DEFERRED | Policy decision |
| Internal Doc Rules | DEFERRED | Policy decision |
| RBAC Design | DEFERRED | Architecture decision |

---

*Autonomous evidence-based resolution — 28/09/2026*
*Rationale recorded per execution plan §0.3 and the historical implementation v1 §I governance rules (plan removed from the checkout).*
