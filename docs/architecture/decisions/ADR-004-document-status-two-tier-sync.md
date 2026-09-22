# ADR-004: Document Status Two-Tier Sync — Administrative Status tự động đồng bộ từ Workflow Status

- **Status**: ACCEPTED
- **Date**: 2026-09-22
- **Deciders**: Owner (Approved at Architecture Review Gate)

## Context

Hệ thống quản lý văn bản hiện có **3 tầng status song song** mà không có ràng buộc DB hay domain service đồng bộ giữa chúng:

### Tier 1: Persisted Administrative Status — `enum DocumentStatus` (5 giá trị)
```
CHO_PHAN_CONG, DANG_XU_LY, CHO_PHE_DUYET, DA_HOAN_THANH, LUU_THEO_DOI
```
*Nguồn: `prisma/schema.prisma:38-44`*

Đây là trạng thái **được lưu trữ vật lý (persisted canonical administrative state)** trên bảng `documents`, phục vụ thống kê báo cáo hành chính toàn trường theo Nghị định 30/2020/NĐ-CP và hiển thị trên Bàn làm việc BGH / Trưởng đơn vị.

### Tier 2a: Incoming Workflow Status — `enum IncomingDocumentStatus` (10 giá trị)
```
RECEIVED → REGISTERED → PRESENTED → DIRECTED → ASSIGNED_TO_LEAD_UNIT
→ UNIT_ASSIGNED_PERSON → IN_PROGRESS → RESOLVED → FILED → ARCHIVED
```
*Nguồn: `prisma/schema.prisma:500-511`, FSM: `src/lib/documents/state-machine.ts:35-66`*

### Tier 2b: Outgoing Workflow Status — `enum OutgoingDocumentStatus` (10 giá trị)
```
DRAFT → CONTENT_REVIEW → FORMAT_CHECK → AUTHORIZED_SIGN → NUMBERED
→ ORGANIZATION_SIGNED → ISSUED → DELIVERED → FILED → ARCHIVED
```
*Nguồn: `prisma/schema.prisma:600-611`, FSM: `src/lib/documents/state-machine.ts:112-143`*

### Vấn đề: Thiếu cơ chế đồng bộ có thẩm quyền rõ ràng (FACT F07)

Hiện tại **không có DB constraint, trigger, hay domain service chuyên trách** nào bảo đảm rằng khi `IncomingDocumentStatus` chuyển bước, thì trường `Document.status` cũng được cập nhật tương ứng một cách tự động và nguyên tử. Hệ quả:
1. Văn bản đến đã xử lý xong (`RESOLVED`) nhưng `Document.status` vẫn treo `DANG_XU_LY` — BGH thấy văn bản "đang xử lý" trong khi thực tế đã giải quyết.
2. Văn bản đi đã ban hành (`ISSUED`) nhưng `Document.status` chưa cập nhật `DA_HOAN_THANH` — báo cáo hành chính sai lệch.
3. Các route handler phải tự cập nhật thủ công — phân tán, dễ bỏ sót, không thể bảo đảm audit trail nhất quán.

## Decision

Thiết lập kiến trúc đồng bộ trạng thái văn bản 2 tầng với các quy tắc phân quyền sở hữu và đồng bộ chuẩn tắc:

### 1. Bản chất của `Document.status`
- `Document.status` là **trạng thái hành chính chuẩn tắc được lưu trữ vật lý (Persisted Canonical Administrative State)** trên model `Document`.
- Nó KHÔNG PHẢI là một view phái sinh tạm thời trên bộ nhớ, mà là nguồn dữ liệu chuẩn cho các báo cáo pháp lý, số liệu điều hành, và truy vấn thống kê cấp trường.

### 2. Quy tắc Quyền sở hữu Chuẩn tắc (Authoritative Ownership Rule)
- **Độc quyền sở hữu ghi**: Thẩm quyền cập nhật `Document.status` thuộc về **Domain Service duy nhất (`DocumentWorkflowService` / `DocumentLifecycleService`)**.
- **Cấm Mutation trực tiếp**: Các API route handlers, UI components, hoặc background jobs tuyệt đối KHÔNG ĐƯỢC thực hiện lệnh `UPDATE documents SET status = ...` trực tiếp. Mọi thay đổi trạng thái bắt buộc phải thông qua các Business Command của Domain Service.

### 3. Quy tắc Đồng bộ Nguyên tử (Synchronization Rule)
- Mỗi khi xảy ra một bước chuyển đổi trạng thái kỹ thuật (technical transition) trên `DocumentIncomingWorkflow` hoặc `DocumentOutgoingWorkflow`, Domain Service trong **cùng transaction nguyên tử (`prisma.$transaction`)** có trách nhiệm tự động đồng bộ giá trị tương ứng vào `Document.status`.
- **Bảng ánh xạ chuẩn tắc (Canonical Sync Mapping)**:

   **Văn bản đến (Incoming Documents):**
   | Incoming Workflow Status (Tier 2a) | → Persisted Document.status (Tier 1) | Ý nghĩa hành chính |
   |------------------------------------|--------------------------------------|-------------------|
   | RECEIVED, REGISTERED | `CHO_PHAN_CONG` | Văn thư đã tiếp nhận/vào sổ, chờ trình lãnh đạo |
   | PRESENTED, DIRECTED, ASSIGNED_TO_LEAD_UNIT, UNIT_ASSIGNED_PERSON | `CHO_PHAN_CONG` | Đang trong quy trình xin ý kiến và giao đơn vị thụ lý |
   | IN_PROGRESS | `DANG_XU_LY` | Cán bộ đang tiến hành xử lý văn bản |
   | RESOLVED | `DA_HOAN_THANH` | Đơn vị/cán bộ đã hoàn tất xử lý |
   | FILED, ARCHIVED | `LUU_THEO_DOI` | Đã đưa vào hồ sơ lưu trữ cơ quan |

   **Văn bản đi (Outgoing Documents):**
   | Outgoing Workflow Status (Tier 2b) | → Persisted Document.status (Tier 1) | Ý nghĩa hành chính |
   |------------------------------------|--------------------------------------|-------------------|
   | DRAFT, CONTENT_REVIEW, FORMAT_CHECK | `DANG_XU_LY` | Đang soạn thảo, duyệt nội dung và thể thức |
   | AUTHORIZED_SIGN | `CHO_PHE_DUYET` | Đang trình lãnh đạo có thẩm quyền ký ban hành |
   | NUMBERED, ORGANIZATION_SIGNED | `DANG_XU_LY` | Đã ký, đang chờ cấp số và đóng dấu cơ quan |
   | ISSUED, DELIVERED | `DA_HOAN_THANH` | Văn bản đã chính thức phát hành |
   | FILED, ARCHIVED | `LUU_THEO_DOI` | Đã lập hồ sơ lưu trữ theo dõi |

### 4. Rào chắn Bất biến (Immutability Enforcement)
- Khi văn bản đạt trạng thái phát hành (`ISSUED`/`DELIVERED`) hoặc lưu trữ (`FILED`/`ARCHIVED`), toàn bộ nội dung tệp tin, trích yếu, số ký hiệu đều trở thành bất biến (immutable) theo `isDocumentImmutable()` (`src/lib/documents/state-machine.ts:257-304`). Cả trạng thái kỹ thuật và trạng thái hành chính đều bị đóng băng.

## Alternatives Considered

1. **DB Trigger (PostgreSQL Triggers)**: Tự động cập nhật qua trigger ở tầng CSDL.
   - *Bác bỏ*: Khó kiểm thử tự động, khó debug, phân tán business logic ra khỏi codebase, không tận dụng được type system của Prisma.

2. **Xóa bỏ `DocumentStatus`, chỉ dùng Workflow Status**:
   - *Bác bỏ*: Buộc BGH và các báo cáo hành chính phải xử lý 10 trạng thái kỹ thuật chi tiết của cả 2 luồng; gây phức tạp giao diện không cần thiết cho cấp lãnh đạo điều hành.

3. **Event-driven Eventually Consistent Sync (Outbox / Queue)**:
   - *Bác bỏ*: Chấp nhận độ trễ (delay) đồng bộ. Không phù hợp với dashboard BGH đòi hỏi tính tức thời và chính xác tuyệt đối sau khi ký văn bản.

## Consequences

### Tích cực
- Bảo đảm tính nhất quán dữ liệu 100%: `Document.status` luôn phản ánh đúng tiến trình thực tế.
- Bàn làm việc BGH và báo cáo thống kê chính xác tuyệt đối mà không cần join phức tạp nhiều bảng.
- Tập trung hóa logic nghiệp vụ vào Domain Service, loại bỏ mutation tự do ở API routes.

### Tiêu cực
- Mọi thao tác chuyển trạng thái văn bản bắt buộc phải đi qua Domain Service trong `$transaction`.
- Cần chạy script đối soát dữ liệu lịch sử một lần để đồng bộ lại các văn bản cũ.

## Migration Impact

| Thành phần | Thay đổi |
|------------|----------|
| `src/lib/services/` | Tập trung hóa mutation logic vào Domain Service với transaction nguyên tử |
| API route handlers | Loại bỏ các lệnh cập nhật `Document.status` tự do; chuyển sang gọi service |
| DB data reconciliation | Script đối soát và đồng bộ một lần cho các văn bản hiện hữu |
| Dashboard queries | Truy vấn trực tiếp `Document.status` với độ tin cậy tuyệt đối |

## Evidence

| Bằng chứng | File:Line |
|------------|-----------|
| `DocumentStatus` enum (5 giá trị) | `prisma/schema.prisma:38-44` |
| `IncomingDocumentStatus` enum (10 giá trị) | `prisma/schema.prisma:500-511` |
| `OutgoingDocumentStatus` enum (10 giá trị) | `prisma/schema.prisma:600-611` |
| Incoming FSM transitions | `src/lib/documents/state-machine.ts:35-66` |
| Outgoing FSM transitions | `src/lib/documents/state-machine.ts:112-143` |
| Immutability check | `src/lib/documents/state-machine.ts:257-304` |

## Related ADRs

- [ADR-002](ADR-002-contextual-authorization-policy-engine.md) — Phân quyền ký và phát hành văn bản tuân thủ pipeline 10 bước.
- [ADR-003](ADR-003-task-lifecycle-with-derived-attention.md) — Tách bạch giữa trạng thái khách quan và sự chú ý.
- [ADR-007](ADR-007-rest-api-standard-rfc9457.md) — Chuẩn hóa API endpoints cho các thao tác văn bản.
