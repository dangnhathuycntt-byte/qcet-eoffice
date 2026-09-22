# ADR-003: Task Lifecycle với Derived Attention — Nguyên tắc Lifecycle ≠ Attention

- **Status**: ACCEPTED
- **Date**: 2026-09-22
- **Deciders**: Owner (Approved at Architecture Review Gate)

## Context

Hệ thống hiện có **4 định nghĩa TaskStatus cạnh tranh** với số lượng giá trị khác nhau, gây ra inconsistency trong mapping, filtering, và UI rendering:

### 1. Prisma Schema — `enum TaskStatus` (6 giá trị)
```
NOT_STARTED, IN_PROGRESS, WAITING_APPROVAL, COMPLETED, OVERDUE, CANCELLED
```
*Nguồn: `prisma/schema.prisma:52-59`*

### 2. FSM `CanonicalTaskStatus` (5 giá trị)
```
NEW, IN_PROGRESS, WAITING_APPROVAL, COMPLETED, CANCELLED
```
*Nguồn: `src/domain/tasks/state-machine.ts:11-16`*

### 3. FSM `TaskStatus` union (5 canonical + 5 aliases = 10 giá trị)
```
NEW, IN_PROGRESS, WAITING_APPROVAL, COMPLETED, CANCELLED
+ NOT_STARTED, TODO, NEEDS_REVIEW, DONE, CANCELED
```
*Nguồn: `src/domain/tasks/state-machine.ts:18-24`*

### 4. Canonical Semantics `TaskLifecycleStatus` (7 giá trị)
```
NOT_STARTED, IN_PROGRESS, WAITING_APPROVAL, PENDING_EXECUTIVE_APPROVAL,
COMPLETED, OVERDUE, CANCELLED
```
*Nguồn: `src/domain/tasks/canonical-semantics.ts:38-77` (inferred from mapDbStatusToLifecycle)*

### 5. Display normalizer `normalizeDisplayStatus()` (5 giá trị)
```
NOT_STARTED, IN_PROGRESS, WAITING_APPROVAL, COMPLETED, CANCELLED
```
*Nguồn: `src/domain/tasks/canonical-semantics.ts:91-109`*

### Bảng Đối chiếu: Hành vi Hiện tại (CURRENT Behavior) vs Kiến trúc Đích (TARGET Behavior)

| Đặc điểm | Hành vi Hiện tại (CURRENT) | Kiến trúc Đích (TARGET — Quyết định bởi ADR-003) |
|:---|:---|:---|
| **Trạng thái khởi tạo** | DB lưu `NOT_STARTED`, nhưng FSM dùng `NEW` | `NOT_STARTED` là **trạng thái khởi tạo chuẩn tắc duy nhất (Canonical Persisted Initial State)** |
| **Vai trò của `NEW` / "Mới"** | Đang bị coi là 1 canonical state trong `state-machine.ts` | Trở thành **legacy / UI display alias** thuần túy, map về `NOT_STARTED` |
| **`OVERDUE` (Quá hạn)** | Bị lưu như một giá trị enum trong CSDL (`TaskStatus`) | Chuyển thành **thuộc tính chú ý phái sinh (Derived Attention Flag)**, không lưu CSDL |
| **Phân định ngữ nghĩa** | Trộn lẫn tiến trình thực hiện và cảnh báo thời gian | Tách bạch tuyệt đối: $\text{Lifecycle} \neq \text{Attention}$ |

## Decision

Thiết lập chuẩn kiến trúc vòng đời nhiệm vụ và cơ chế phái sinh sự chú ý:

### 1. Nguyên tắc Bất biến: Lifecycle ≠ Attention
- **Lifecycle Status**: Là thuộc tính khách quan của thực thể nhiệm vụ, được lưu trữ trong CSDL, phản ánh tiến trình xử lý và điều khiển các bước chuyển FSM.
- **Attention Signals**: Là thuộc tính chủ quan từ góc nhìn của một người dùng cụ thể, được tính toán (computed) tại thời điểm đọc (read-time) dựa trên tương quan giữa Lifecycle, thời hạn (`dueDate`), và vai trò của người dùng trên nhiệm vụ.

### 2. Chuẩn hóa Bộ Trạng thái Vòng đời (Canonical Lifecycle States)
- **`NOT_STARTED` là trạng thái khởi tạo chuẩn tắc duy nhất (Canonical Persisted Initial State)** được lưu trữ vật lý trong CSDL và điều khiển bởi FSM.
- **`NEW` / "Mới" chỉ là presentation alias** cho mục đích hiển thị nhãn UI hoặc tương thích dữ liệu nhập khẩu; `NEW` tuyệt đối không được coi là một canonical state độc lập trong domain hay CSDL.
- Chuỗi chuyển đổi trạng thái FSM chuẩn tắc:
  ```
  NOT_STARTED ──(start/assign)──→ IN_PROGRESS ──(submit_result)──→ WAITING_APPROVAL ──(approve)──→ COMPLETED
       │                              │                                  │
       └──────────────┬───────────────┴──────────────────────────────────┘
                      └──(cancel)──→ CANCELLED
  ```
  *(Lưu ý: Không tự ý bổ sung các quy tắc mở lại/reopen từ trạng thái kết thúc `COMPLETED` hoặc `CANCELLED` khi chưa có quyết định kiến trúc riêng biệt; dữ liệu tại trạng thái kết thúc được bảo vệ đóng băng).*

### 3. Tín hiệu Chú ý Phái sinh (Derived Attention Signals)
Các trạng thái chú ý được tính toán động tại tầng Attention Resolver (`attention-resolver.ts`), không chiếm giá trị cột `status` trong CSDL:
- `overdue`: Phái sinh khi `dueDate < now` và nhiệm vụ chưa kết thúc (`status ∉ {COMPLETED, CANCELLED}`).
- `due_soon`: Phái sinh khi nhiệm vụ sắp đến hạn (theo ngưỡng cấu hình).
- `requires_my_action`: Người dùng là DRI/Assignee và nhiệm vụ đang ở `IN_PROGRESS` hoặc `NOT_STARTED`.
- `requires_my_approval`: Người dùng có thẩm quyền phê duyệt và nhiệm vụ đang ở `WAITING_APPROVAL`, đồng thời thỏa mãn rào chắn Maker-Checker (ADR-001).
- `blocked`: Nhiệm vụ bị phụ thuộc hoặc bị đình trệ.

### 4. Chiến lược Phục hồi Dữ liệu An toàn cho `OVERDUE` (Recoverable Remediation Strategy)
- **TUYỆT ĐỐI CẤM cập nhật hàng loạt không phân loại** (`UPDATE tasks SET status='IN_PROGRESS' WHERE status='OVERDUE'`).
- Từng bản ghi có `status = 'OVERDUE'` trong CSDL sẽ được phân tích và phân loại có khả năng phục hồi (recoverable per-task classification):
  1. *Nhiệm vụ đã có phát sinh tiến độ hoặc nhật ký*: phân loại về `IN_PROGRESS` kèm cờ phái sinh `isOverdue = true`.
  2. *Nhiệm vụ chưa bắt đầu nhưng đã quá hạn bắt đầu*: phân loại về `NOT_STARTED` kèm cờ `isOverdue = true`.
  3. *Nhiệm vụ đã nộp kết quả nhưng chưa được duyệt*: phân loại về `WAITING_APPROVAL` kèm cờ `isOverdue = true`.
  4. *Nhiệm vụ mâu thuẫn dữ liệu*: đưa vào Hàng đợi Rà soát Thủ công (Manual Remediation Queue).
- Enum `OVERDUE` trong Prisma schema được duy trì tạm thời trong các bước chuyển tiếp và chỉ bị loại bỏ ở giai đoạn Contract (Phase 9) khi kiểm chứng đạt zero-record.

## Alternatives Considered

1. **Giữ nguyên 4 định nghĩa, thêm adapter layer**: Tăng complexity mà không giải quyết root cause — các định nghĩa vẫn drift theo thời gian.

2. **Cập nhật hàng loạt (Blind Batch Update)**: `UPDATE status='IN_PROGRESS'` toàn bộ task `OVERDUE`. Bị bác bỏ vì phá hỏng tính toàn vẹn dữ liệu đối với các task chưa từng bắt đầu hoặc đang chờ duyệt mà quá hạn.

3. **Coi `NEW` là canonical thay vì `NOT_STARTED`**: Bị bác bỏ vì `NOT_STARTED` thể hiện chính xác ngữ nghĩa hành chính trong tiếng Việt ("Chưa thực hiện"), và là giá trị mặc định đang lưu trữ trong Prisma schema (`prisma/schema.prisma:222`).

## Consequences

### Tích cực
- Nhất quán 100% giữa CSDL, Domain FSM và giao diện: `NOT_STARTED` là điểm khởi đầu duy nhất.
- Tách bạch hoàn toàn tiến trình khách quan khỏi yếu tố thời gian, loại bỏ các lỗi FSM giả khi task quá hạn.
- Giữ nguyên tính chính xác của dữ liệu lịch sử thông qua chiến lược phân loại có phục hồi.

### Tiêu cực
- Cần triển khai migration script phân loại dữ liệu chi tiết kèm hàng đợi rà soát thủ công (WI-4.3).
- Cần đồng bộ hóa lại các nơi đang kiểm tra chuỗi `status === 'NEW'` chuyển sang `NOT_STARTED`.

## Migration Impact

| Thành phần | Thay đổi |
|------------|----------|
| `src/domain/tasks/state-machine.ts` | Đổi `CanonicalTaskStatus`: `NEW` thành alias của `NOT_STARTED` |
| `src/domain/tasks/canonical-semantics.ts` | Hợp nhất normalizer: `mapDbStatusToLifecycle` và `normalizeTaskStatus` trả về `NOT_STARTED` |
| `prisma/schema.prisma` | Giữ nguyên `NOT_STARTED` làm default; xóa `OVERDUE` ở Phase 9 |
| DB migration script (WI-4.3) | Phân loại từng task OVERDUE có khả năng phục hồi |
| UI components | Hiển thị nhãn "Chưa bắt đầu" hoặc "Mới", lọc theo `NOT_STARTED` |

## Evidence

| Bằng chứng | File:Line |
|------------|-----------|
| Prisma TaskStatus enum (có NOT_STARTED, có OVERDUE) | `prisma/schema.prisma:52-59` |
| Prisma Task status default `NOT_STARTED` | `prisma/schema.prisma:222` |
| FSM CanonicalTaskStatus dùng `NEW` thay vì `NOT_STARTED` | `src/domain/tasks/state-machine.ts:11-16` |
| `normalizeTaskStatus()` normalizer map cả hai | `src/domain/tasks/state-machine.ts:85-93` |
| `mapDbStatusToLifecycle()` trả 7 trạng thái | `src/domain/tasks/canonical-semantics.ts:38-78` |
| `normalizeDisplayStatus()` gom về 5 trạng thái | `src/domain/tasks/canonical-semantics.ts:91-109` |
| Attention resolver invariant Lifecycle ≠ Attention | `src/domain/tasks/attention-resolver.ts:1-13` |
| OVERDUE derived từ `isDatePast()` | `src/domain/tasks/attention-resolver.ts:401-412` |

## Related ADRs

- [ADR-001](ADR-001-single-canonical-maker-checker-guard.md) — SoD guard trigger dựa trên lifecycle status `WAITING_APPROVAL`.
- [ADR-002](ADR-002-contextual-authorization-policy-engine.md) — Step 9 (Workflow State) phụ thuộc canonical lifecycle states.
- [ADR-004](ADR-004-document-status-two-tier-sync.md) — Đồng bộ trạng thái 2 tầng trong quản lý văn bản.
