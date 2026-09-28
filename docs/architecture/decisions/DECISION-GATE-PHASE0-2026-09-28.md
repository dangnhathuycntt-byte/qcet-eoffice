# Biên bản Cổng Quyết định — Phase 0 (Tổng hợp)

| Trường     | Giá trị                                              |
| ---------- | ---------------------------------------------------- |
| Mã số      | DECISION-GATE-PHASE0-2026-09-28                      |
| Ngày lập   | 28/09/2026                                            |
| Phase      | 0 — Baseline, Decisions, and Pilot Contract           |
| Deliverable| Phase 0 completion — tổng hợp trạng thái quyết định |
| Trạng thái | **HOÀN TẤT** — ghi nhận quyết định & trì hoãn       |

---

## 1. Mục đích

Tổng hợp trạng thái tất cả các quyết định kiến trúc tại thời điểm kết thúc Phase 0. Tài liệu này kế thừa và mở rộng `DECISION-GATE-PHASE-0.3-2026-09-28.md` bằng cách ghi nhận rõ ràng mọi quyết định đã đưa ra, đang chờ, và được trì hoãn có chủ đích.

---

## 2. RFC — Trạng thái PROPOSED (Chờ Architecture Review Gate)

### 2.1 RFC-04: Document Domain Location

| Thuộc tính         | Chi tiết |
| ------------------ | -------- |
| Tệp                | `docs/architecture/decisions/RFC-04-document-domain-location.md` |
| Trạng thái          | **PROPOSED** — chờ Owner review tại Architecture Review Gate |
| Phase dự kiến xét   | Phase 5 / WI-5.2 (Issue #70) |
| Nội dung            | Đánh giá di dời domain logic từ `src/lib/documents/` sang `src/domain/documents/` theo Re-export Facades Pattern 5 phase |
| Tác giả             | Technical Architecture Working Group |
| Ngày đề xuất        | 22/09/2026 |

**Lý do chờ:** Việc tái tổ chức vị trí module văn bản cần đánh giá kỹ tác động đến import graph, test coverage, và backward compatibility. RFC-04 chặn việc di dời domain, không chặn các bản vá bảo mật hoặc đúng đắn trên route hiện tại. Quyết định sẽ được xét lại khi Phase 2 bắt đầu.

**Tác động hiện tại:** Không ảnh hưởng Phase 0–1. Các endpoint văn bản hiện tại (`src/app/api/documents/`) tiếp tục hoạt động bình thường.

### 2.2 RFC-05: Document JSON/Text Relations

| Thuộc tính         | Chi tiết |
| ------------------ | -------- |
| Tệp                | `docs/architecture/decisions/RFC-05-document-json-text-relations.md` |
| Trạng thái          | **PROPOSED** — chờ Owner review tại Architecture Review Gate |
| Phase dự kiến xét   | Phase 5 / WI-5.3 (Issue #71) |
| Nội dung            | Đánh giá chuẩn hóa các quan hệ denormalized JSON/Text (collaboratorIds dạng CSV, coordinatingUnitIds dạng JSON) trong bảng document và directive workflow |
| Tác giả             | Technical Architecture Working Group & Document Workflow Domain Team |
| Ngày đề xuất        | 22/09/2026 |

**Lý do chờ:** Chuẩn hóa quan hệ JSON/Text cần phối hợp chặt với migration strategy (Phase 6+). Schema hiện tại đang phục vụ đủ chức năng CRUD. RFC-05 chặn chuẩn hóa schema, không chặn mutation hiện tại.

**Tác động hiện tại:** Không ảnh hưởng Phase 0–3. Code mutation hiện tại xử lý JSON/CSV bằng helper functions.

---

## 3. Quyết định chưa đưa ra — Trì hoãn có chủ đích

### 3.1 Nhà cung cấp chữ ký số (Digital Signature Provider)

| Thuộc tính         | Chi tiết |
| ------------------ | -------- |
| Trạng thái          | **CHƯA QUYẾT ĐỊNH** |
| Trì hoãn đến        | Phase 5 (Digital Signature Integration) |
| Ranh giới hiện tại  | Adapter boundary trong `src/lib/crypto/digital-signature-service.ts` |

**Mô tả:** Codebase đã tham chiếu Nghị định 68/2024/NĐ-CP (luật chữ ký số) và có `DigitalSignatureDialog` component (`src/components/documents/digital-signature-dialog.tsx`). Interface đã thiết kế sẵn các type (`DigitalCertificateInfo`, `SealType`). Hiện dùng simulated SHA-256 signatures.

**Không có nhà cung cấp cụ thể được chọn** (VNPT-CA, Viettel-CA, FPT-CA, BKAV-CA, hoặc bất kỳ provider nào). Adapter boundary cho phép tích hợp provider tùy ý mà không thay đổi business logic. Chỉ viết provider-neutral tests cho đến khi quyết định được đưa ra.

**Lý do trì hoãn:** Việc chọn provider phụ thuộc vào yêu cầu pháp lý cụ thể của đơn vị triển khai, ngân sách, tương thích phần cứng HSM, và chính sách mua sắm.

### 3.2 Kênh phân phối văn bản đi (Delivery Channels)

| Thuộc tính         | Chi tiết |
| ------------------ | -------- |
| Trạng thái          | **CHƯA QUYẾT ĐỊNH** |
| Trì hoãn đến        | Phase 5 (Outgoing Document Workflows) |
| Ranh giới hiện tại  | Endpoint `POST /api/documents/outgoing/[id]/actions/deliver` và `OutgoingRecipientList` component |

**Mô tả:** Endpoint `deliver` tồn tại và xử lý logic chuyển trạng thái. Tuy nhiên, các kênh phân phối cụ thể chưa được xác định:

- Liên thông LGSP (Trục dữ liệu địa phương)
- Trục văn bản quốc gia (eDocs)
- Email tự động
- Phân phối vật lý (physical mail tracking)
- eDelivery

**Lý do trì hoãn:** Kênh phân phối phụ thuộc vào hạ tầng liên thông của đơn vị triển khai. Endpoint hiện tại đủ để test workflow nội bộ.

### 3.3 Phạm vi văn bản nội bộ (Internal Document Scope)

| Thuộc tính         | Chi tiết |
| ------------------ | -------- |
| Trạng thái          | **CHƯA QUYẾT ĐỊNH** — đề xuất Phase 5 |
| Trì hoãn đến        | Phase 5 |
| Ranh giới hiện tại  | Tab "Nội bộ" (submission) trong `DocumentRegistryView` |

**Mô tả:** Giao diện đã có tab cho văn bản nội bộ (`TO_TRINH_NOI_BO`), với API support cơ bản. Tuy nhiên, phạm vi workflow đầy đủ chưa được hình thức hóa:

- Chuỗi phê duyệt (approval chain) riêng cho văn bản nội bộ
- Luân chuyển nội bộ vs. phân phối bên ngoài
- Mối quan hệ với văn bản đi (outgoing documents)
- Lifecycle riêng biệt vs. dùng chung lifecycle văn bản đến/đi

RFC-04 đề cập gián tiếp nhưng không định nghĩa lifecycle riêng biệt cho văn bản nội bộ.

**Lý do trì hoãn:** Workflow văn bản nội bộ cần RFC riêng hoặc mở rộng RFC-04 để xác định rõ ranh giới với văn bản đến/đi. Đề xuất xử lý trong Phase 5 sau khi RFC-04 được xét duyệt.

---

## 4. ADR đã chấp thuận (Tham chiếu tại thời điểm Phase 0)

| ADR     | Tiêu đề                                    | Tệp |
| ------- | ------------------------------------------- | ---- |
| ADR-001 | Single Canonical Maker-Checker Guard        | `docs/architecture/decisions/ADR-001-*.md` |
| ADR-002 | Contextual Authorization Policy Engine      | `docs/architecture/decisions/ADR-002-*.md` |
| ADR-003 | Task Lifecycle with Derived Attention       | `docs/architecture/decisions/ADR-003-*.md` |
| ADR-004 | Document Status Two-Tier Sync               | `docs/architecture/decisions/ADR-004-*.md` |
| ADR-005 | Task Assignee-to-Actor Migration            | `docs/architecture/decisions/ADR-005-*.md` |
| ADR-006 | Department-to-OrgUnit Consolidation         | `docs/architecture/decisions/ADR-006-*.md` |
| ADR-007 | REST API Standard RFC 9457                  | `docs/architecture/decisions/ADR-007-*.md` |
| ADR-008 | FileObject Canonical Model                  | `docs/architecture/decisions/ADR-008-*.md` |

---

## 5. RFC đang mở (Tham chiếu đầy đủ)

| RFC    | Tiêu đề                                    | Trạng thái | Phase ảnh hưởng |
| ------ | ------------------------------------------- | ---------- | --------------- |
| RFC-01 | Task Assignee-Actor Reconciliation          | PROPOSED   | Phase 4         |
| RFC-02 | Department-OrgUnit Reconciliation           | PROPOSED   | Phase 3         |
| RFC-03 | Delegation Consolidation                    | PROPOSED   | Phase 3         |
| RFC-04 | Document Domain Location                    | PROPOSED   | Phase 5         |
| RFC-05 | Document JSON/Text Relations                | PROPOSED   | Phase 5         |
| RFC-06 | Task Scope-Origin Boundary                  | PROPOSED   | Phase 4         |
| RFC-07 | Action-Inbox-Notification Separation        | PROPOSED   | Phase 7         |
| RFC-08 | User Directory Policy                       | PROPOSED   | Phase 1         |
| RFC-09 | Dossier Read Policy                         | PROPOSED   | Phase 1         |
| RFC-10 | Meeting Governance                          | PROPOSED   | Phase 3         |
| RFC-11 | Dossier Archival Governance                 | PROPOSED   | Phase 3         |

---

## 6. Kết luận

Phase 0 hoàn tất với các kết quả sau:

1. **2 RFC** (RFC-04, RFC-05) ở trạng thái PROPOSED, chờ Owner review — không chặn Phase 1–3.
2. **3 quyết định** được trì hoãn có chủ đích: chữ ký số, kênh phân phối, và phạm vi văn bản nội bộ — mỗi mục đều có adapter/placeholder trong codebase.
3. **8 ADR** đã được chấp thuận, tạo nền tảng cho Phase 1 (security & lifecycle blockers).
4. **9 RFC bổ sung** (RFC-01 đến RFC-03, RFC-06 đến RFC-11) ở trạng thái PROPOSED, ánh xạ rõ ràng đến các phase tương ứng trong implementation plan.

Không có quyết định nào bị bỏ sót. Mỗi mục trì hoãn đều có lý do, phase mục tiêu, và ranh giới kỹ thuật (adapter/placeholder) trong codebase.

---

*Tài liệu này là Phase 0 deliverable — Decision Gate tổng hợp.*
*Ngày ký: 28/09/2026*
