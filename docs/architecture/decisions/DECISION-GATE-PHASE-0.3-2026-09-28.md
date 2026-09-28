# Biên bản Cổng Quyết định — Phase 0.3

| Trường          | Giá trị                                |
| --------------- | -------------------------------------- |
| Mã số           | DECISION-GATE-PHASE-0.3               |
| Ngày lập        | 28/09/2026                             |
| Phase           | 0 — Baseline, Decisions, and Pilot Contract |
| Deliverable     | Phase 0.3 — Architecture Decision Gates |
| Trạng thái      | **HOÀN TẤT** — đã ghi nhận các quyết định & trì hoãn |

---

## 1. Mục đích

Ghi nhận kết quả rà soát các quyết định kiến trúc tại cổng Phase 0.3. Tài liệu này xác nhận những RFC nào đã được đề xuất, những quyết định nào đã được chấp thuận, và những vấn đề nào được trì hoãn có chủ đích đến phase phù hợp.

---

## 2. RFC đã đề xuất — Chờ Architecture Review Gate

### 2.1 RFC-04: Document Domain Location

| Thuộc tính      | Chi tiết |
| --------------- | -------- |
| Tệp             | `docs/architecture/decisions/RFC-04-document-domain-location.md` |
| Trạng thái       | **PROPOSED** — chờ Architecture Review Gate |
| Quyết định       | **Trì hoãn** |
| Phạm vi ảnh hưởng | RFC-04 chặn việc di dời domain (`src/domain/documents/`), không chặn các bản vá bảo mật hoặc đúng đắn (correctness fix) trên các route hiện tại |

**Lý do trì hoãn:** Việc tái tổ chức vị trí module văn bản cần đánh giá kỹ tác động đến import graph, test coverage, và backward compatibility. Các endpoint hiện tại (`src/app/api/documents/`) vẫn hoạt động ổn định và đã được gia cố bảo mật trong Phase 1. Quyết định sẽ được xét lại khi Phase 2 bắt đầu.

### 2.2 RFC-05: Document JSON/Text Relations

| Thuộc tính      | Chi tiết |
| --------------- | -------- |
| Tệp             | `docs/architecture/decisions/RFC-05-document-json-text-relations.md` |
| Trạng thái       | **PROPOSED** — chờ Architecture Review Gate |
| Quyết định       | **Trì hoãn** |
| Phạm vi ảnh hưởng | RFC-05 chặn việc chuẩn hóa schema (normalize JSON/Text columns), không chặn các mutation hiện tại |

**Lý do trì hoãn:** Chuẩn hóa quan hệ JSON/Text trong bảng `documents` cần phối hợp với migration strategy (Phase 6). Schema hiện tại đang phục vụ đủ chức năng CRUD. Quyết định sẽ được xét lại cùng Phase 5.

---

## 3. Quyết định chưa đưa ra — Trì hoãn có chủ đích

### 3.1 Nhà cung cấp chữ ký số (Digital Signature Provider)

| Thuộc tính      | Chi tiết |
| --------------- | -------- |
| Trạng thái       | **CHƯA QUYẾT ĐỊNH** |
| Trì hoãn đến     | Phase 5 (Task 5.1 — Digital Signature Integration) |
| Hiện trạng code  | `src/lib/crypto/digital-signature-service.ts` |

**Mô tả hiện trạng:** Codebase đã có service layer với adapter boundary, tuân thủ Nghị định 30/2020/NĐ-CP và QCVN 102:2016/BTTTT. Hiện dùng simulated SHA-256 signatures. Interface đã thiết kế sẵn các type: `DigitalCertificateInfo`, `SealType` (`ORGANIZATION_SEAL`, `LEADER_SIGNATURE`, `DEPARTMENT_STAMP`).

**Lý do trì hoãn:** Việc chọn nhà cung cấp chữ ký số phụ thuộc vào yêu cầu pháp lý cụ thể của đơn vị triển khai, ngân sách, và tương thích phần cứng HSM. Adapter boundary cho phép tích hợp bất kỳ provider nào mà không thay đổi business logic.

### 3.2 Kênh phân phối văn bản đi (Delivery Channels for Outgoing Documents)

| Thuộc tính      | Chi tiết |
| --------------- | -------- |
| Trạng thái       | **CHƯA QUYẾT ĐỊNH** |
| Trì hoãn đến     | Phase 5 (Task 5.2 — Outgoing Document Workflows) |
| Hiện trạng code  | `src/app/api/documents/outgoing/[id]/actions/deliver/route.ts` |

**Mô tả hiện trạng:** Endpoint `deliver` đã tồn tại và xử lý logic chuyển trạng thái văn bản đi. Tuy nhiên, cấu hình kênh phân phối cụ thể (liên thông LGSP, email, trục văn bản quốc gia) chưa được triển khai.

**Lý do trì hoãn:** Kênh phân phối phụ thuộc vào hạ tầng liên thông của đơn vị. Endpoint hiện tại đủ để test workflow nội bộ.

### 3.3 Phạm vi văn bản nội bộ (Internal Document Scope)

| Thuộc tính      | Chi tiết |
| --------------- | -------- |
| Trạng thái       | **CHƯA QUYẾT ĐỊNH** |
| Trì hoãn đến     | Phase 5 |
| Hiện trạng code  | `src/components/documents/document-registry-view.tsx` (tab "Nội bộ" hiển thị) |

**Mô tả hiện trạng:** Giao diện `DocumentRegistryView` đã có tab cho văn bản nội bộ, nhưng workflow xử lý văn bản nội bộ (luân chuyển, phê duyệt, ký số nội bộ) chưa hoàn thiện. Các endpoint API cho văn bản nội bộ chưa được phân tách rõ ràng khỏi văn bản đến/đi.

**Lý do trì hoãn:** Workflow văn bản nội bộ cần xác định rõ sự khác biệt với văn bản đến/đi về quy trình phê duyệt và phạm vi phân phối. Sẽ được thiết kế chi tiết trong Phase 5.

---

## 4. ADR đã chấp thuận (Tham chiếu)

Các ADR sau đã được chấp thuận và có hiệu lực tại thời điểm Phase 0.3:

| ADR   | Tiêu đề | Tệp |
| ----- | ------- | ---- |
| ADR-001 | Single Canonical Maker-Checker Guard | `docs/architecture/decisions/ADR-001-*.md` |
| ADR-002 | Contextual Authorization Policy Engine | `docs/architecture/decisions/ADR-002-*.md` |
| ADR-003 | Task Lifecycle with Derived Attention | `docs/architecture/decisions/ADR-003-*.md` |
| ADR-004 | Document Status Two-Tier Sync | `docs/architecture/decisions/ADR-004-*.md` |
| ADR-005 | Task Assignee-to-Actor Migration | `docs/architecture/decisions/ADR-005-*.md` |
| ADR-006 | Department-to-OrgUnit Consolidation | `docs/architecture/decisions/ADR-006-*.md` |
| ADR-007 | REST API Standard RFC 9457 | `docs/architecture/decisions/ADR-007-*.md` |
| ADR-008 | FileObject Canonical Model | `docs/architecture/decisions/ADR-008-*.md` |

---

## 5. RFC đang mở (Tham chiếu)

Ngoài RFC-04 và RFC-05 đã nêu trên, các RFC sau cũng đang ở trạng thái PROPOSED:

| RFC    | Tiêu đề | Ảnh hưởng Phase |
| ------ | ------- | --------------- |
| RFC-01 | Task Assignee-Actor Reconciliation | Phase 2 |
| RFC-02 | Department-OrgUnit Reconciliation | Phase 3 |
| RFC-03 | Delegation Consolidation | Phase 3 |
| RFC-06 | Task Scope-Origin Boundary | Phase 2 |
| RFC-07 | Action-Inbox-Notification Separation | Phase 3 |
| RFC-08 | User Directory Policy | Phase 3 |
| RFC-09 | Dossier Read Policy | Phase 3 |
| RFC-10 | Meeting Governance | Phase 3 |
| RFC-11 | Dossier Archival Governance | Phase 3 |

---

## 6. Kết luận

Phase 0.3 hoàn tất với việc ghi nhận rõ ràng 2 RFC đang chờ xét duyệt và 3 quyết định được trì hoãn có chủ đích. Không có quyết định nào bị bỏ sót — mỗi mục trì hoãn đều có lý do, phase mục tiêu, và adapter/placeholder trong codebase để đảm bảo tính mở rộng khi đến thời điểm triển khai.

---

*Tài liệu này là Phase 0.3 deliverable thuộc kế hoạch triển khai hệ thống QCET eOffice.*
*Ngày ký: 28/09/2026*
