# Quy trình Vận hành Xử lý Dữ liệu Quá hạn (OVERDUE Remediation SOP)

- **Mã công việc**: WI-4.3 (Issue #65)
- **Quyết định kiến trúc cơ sở**: [ADR-003: Task Lifecycle với Derived Attention (ACCEPTED)](../decisions/ADR-003-task-lifecycle-with-derived-attention.md)
- **Mục tiêu**: Chuyển đổi trạng thái dữ liệu lịch sử `OVERDUE` từ trạng thái vòng đời (persisted lifecycle) sang tín hiệu chú ý phái sinh (derived attention), bảo đảm 100% không mất mát dữ liệu và có khả năng phục hồi hoàn toàn.

---

## 1. Bối cảnh & Nguyên tắc Bất biến (Hard Invariants)

Trước đây, hệ thống tồn tại sự nhầm lẫn giữa **Trạng thái Vòng đời (Lifecycle Status)** và **Tín hiệu Chú ý (Attention Signal)**, dẫn đến việc lưu `OVERDUE` như một giá trị của `enum TaskStatus` trong CSDL. Điều này gây méo mó tiến trình FSM, làm mất ngữ cảnh thực tế của nhiệm vụ (không rõ nhiệm vụ đang dở dang, chưa bắt đầu, hay đang chờ duyệt).

Theo **ADR-003 ACCEPTED**, hệ thống thiết lập các nguyên tắc bất biến bắt buộc:

1. **Nguyên tắc $\text{Lifecycle} \neq \text{Attention}$**:
   - `status` trong CSDL chỉ đại diện cho tiến trình thực thi khách quan: `NOT_STARTED`, `IN_PROGRESS`, `WAITING_APPROVAL`, `COMPLETED`, `CANCELLED`.
   - `OVERDUE` (Quá hạn) là **thuộc tính chú ý phái sinh (Derived Attention Flag)** được tính toán tại thời điểm đọc (`read-time`) bởi `attention-resolver.ts`, dựa trên `dueDate < now` và `status ∉ {COMPLETED, CANCELLED}`.
2. **NGHIÊM CẤM Blind Batch Update**:
   - **Tuyệt đối không chạy lệnh cập nhật hàng loạt không phân loại**:
     ```sql
     -- LỆNH BỊ CẤM HOÀN TOÀN:
     UPDATE tasks SET status = 'IN_PROGRESS' WHERE status = 'OVERDUE';
     ```
   - Lệnh trên sẽ phá hoại tính toàn vẹn dữ liệu của các nhiệm vụ chưa từng khởi động (đáng lẽ là `NOT_STARTED`) hoặc các nhiệm vụ đã nộp báo cáo chờ lãnh đạo duyệt (đáng lẽ là `WAITING_APPROVAL`).
3. **Phân loại Có khả năng Phục hồi Từng Nhiệm vụ (Recoverable Per-task Remediation)**:
   - Từng bản ghi `OVERDUE` phải được kiểm tra qua thuật toán phân loại 4 nhánh an toàn.
   - Mọi thao tác cập nhật đều phải sinh **Rollback Journal** để có thể đảo ngược trạng thái 100%.
   - Các bản ghi mâu thuẫn hoặc thiếu dữ liệu được cô lập vào **Manual Remediation Queue**.

---

## 2. Ma trận Quyết định Phân loại (Classification Decision Matrix)

Bộ phân loại `classifyOverdueTask()` tại `src/domain/tasks/remediation/overdue-classifier.ts` thực thi tuần tự các quy tắc:

| Thứ tự | Quy tắc | Điều kiện kích hoạt | Vòng đời Đích (`targetLifecycle`) | Cờ chú ý phái sinh | Ý nghĩa nghiệp vụ |
|:---:|:---|:---|:---:|:---:|:---|
| **0** | **Kiểm tra hợp lệ & Xung đột** | Status khác `OVERDUE`, `progress` ngoài `[0, 100]`, `deliverablesCount < 0`, cờ `hasConflict=true`, hoặc thiếu toàn bộ tín hiệu | `MANUAL_REMEDIATION` | `isOverdue: true` | Dữ liệu bất thường hoặc xung đột, cần kỹ sư/quản trị viên thẩm định thủ công. |
| **1** | **Rule 1: Đã nộp sản phẩm / Đang chờ duyệt** | `isSubmittedForApproval === true` HOẶC `deliverablesCount > 0` | `WAITING_APPROVAL` | `isOverdue: true` | Nhiệm vụ đã hoàn tất nộp kết quả trước khi hết hạn nhưng chưa được phê duyệt. |
| **2** | **Rule 2: Đang thực hiện dở dang** | `progress > 0` HOẶC `hasActivityLog === true` | `IN_PROGRESS` | `isOverdue: true` | Nhiệm vụ đã phát sinh tiến độ hoặc có lịch sử hoạt động của người dùng. |
| **3** | **Rule 3: Chưa thực hiện** | `progress === 0` VÀ `!hasActivityLog` VÀ `!deliverablesCount` VÀ `!isSubmittedForApproval` | `NOT_STARTED` | `isOverdue: true` | Nhiệm vụ chưa từng bắt đầu nhưng đã quá hạn mốc khởi động. |
| **4** | **Rule 4: Dự phòng mâu thuẫn** | Không thỏa mãn Rule 1, 2, 3 | `MANUAL_REMEDIATION` | `isOverdue: true` | Đưa vào hàng đợi rà soát thủ công, bảo vệ an toàn dữ liệu. |

---

## 3. Quy trình Vận hành Chuẩn (Standard Operating Procedure)

### Bước 1: Sao lưu CSDL và Kiểm tra Điều kiện Tiên quyết
Trước khi thực hiện trên bất kỳ môi trường nào (Staging/Production):
```bash
# 1. Sao lưu CSDL vật lý
./scripts/backup-db.sh

# 2. Kiểm tra typecheck và test suite
npm run typecheck
npx tsx --test tests/domain/overdue-remediation.test.ts
```

### Bước 2: Chạy Mô phỏng An toàn (Dry-Run Mode)
Mặc định script chạy ở chế độ `--dry-run` để kiểm tra phân bổ số liệu và phát hiện task mâu thuẫn mà không ghi vào CSDL:
```bash
npx tsx src/scripts/remediate-overdue-tasks.ts --dry-run
```
Hoặc khi kiểm thử với file fixture JSON (môi trường cô lập):
```bash
npx tsx src/scripts/remediate-overdue-tasks.ts --input=test-tasks.json --dry-run
```

**Kết quả đầu ra của Bước 2**:
- Nhật ký dự kiến: `reports/remediation/remediation-journal-<timestamp>.json`
- Danh sách cần rà soát thủ công (nếu có): `reports/remediation/manual-remediation-queue-<timestamp>.json`
- Bảng thống kê tổng hợp in trên terminal:
  - Tổng số task `OVERDUE` quét được.
  - Số lượng phân loại về `WAITING_APPROVAL`.
  - Số lượng phân loại về `IN_PROGRESS`.
  - Số lượng phân loại về `NOT_STARTED`.
  - Số lượng task rơi vào `MANUAL_REMEDIATION`.

### Bước 3: Đánh giá và Phê duyệt Báo cáo Dry-Run
1. Đảm bảo tỷ lệ phân loại tự động đạt kỳ vọng (> 95%).
2. Mở file `manual-remediation-queue-<timestamp>.json` để rà soát các trường hợp ngoại lệ.
3. Nhận phê duyệt chính thức từ Tech Lead / Database Administrator trước khi chuyển sang Bước 4.

### Bước 4: Thực thi Cập nhật Chính thức (Execute Mode)
Thực hiện cập nhật thực tế trong Database Transaction an toàn:
```bash
npx tsx src/scripts/remediate-overdue-tasks.ts --execute
```
Script sẽ:
1. Phân loại từng nhiệm vụ `OVERDUE`.
2. Ghi nhận file **Rollback Journal** chứa toàn bộ ID và trạng thái gốc `previousStatus = 'OVERDUE'`.
3. Xuất file `manual-remediation-queue-*.json` đối với các task xung đột (không bị thay đổi trong DB).
4. Áp dụng cập nhật trạng thái vòng đời cho các task an toàn (`NOT_STARTED`, `IN_PROGRESS`, `WAITING_APPROVAL`) trong Prisma transaction.

### Bước 5: Kiểm tra Sau Thực thi (Post-Remediation Verification)
1. Kiểm tra số lượng task `OVERDUE` còn lại trong CSDL:
   - Các bản ghi `OVERDUE` còn lại phải bằng chính xác số lượng trong `manual-remediation-queue-*.json`.
2. Kiểm tra giao diện Bàn làm việc (Workbench) và Danh sách công việc:
   - Các task sau remediation hiển thị đúng trạng thái tiến độ (`Chưa thực hiện`, `Đang thực hiện`, `Chờ duyệt`).
   - Cảnh báo `Quá hạn` tiếp tục hiển thị chuẩn xác thông qua tầng `attention-resolver.ts`.

---

## 4. Kế hoạch Hoàn tác Khẩn cấp (Rollback Plan)

Trong trường hợp phát hiện bất kỳ sự cố hoặc mâu thuẫn dữ liệu ngoài dự kiến sau khi chạy `--execute`, kỹ sư vận hành có thể phục hồi ngay lập tức 100% dữ liệu về trạng thái trước khi chạy bằng lệnh:

```bash
npx tsx src/scripts/remediate-overdue-tasks.ts --rollback=reports/remediation/remediation-journal-<timestamp>.json
```

**Cơ chế hoạt động của Rollback**:
- Đọc file Rollback Journal đã lưu.
- Khôi phục `status = 'OVERDUE'` cho toàn bộ danh sách `entries` đã cập nhật.
- Báo cáo số lượng bản ghi đã phục hồi thành công (`restoredCount`) và lỗi nếu có (`failedCount`).

---

## 5. Quy trình Xử lý Hàng đợi Rà soát Thủ công (Manual Queue Handling)

Đối với các task được xuất ra trong `manual-remediation-queue-<timestamp>.json`:
1. **Lý do ph��� biến**:
   - `progress` âm hoặc vượt quá 100% do lỗi ứng dụng bên ngoài nhập liệu.
   - Task bị đánh dấu hoàn thành (`isCompleted=true`) nhưng status vẫn ghi `OVERDUE`.
   - Task thiếu toàn bộ dữ liệu chỉ báo tiến độ.
2. **Quy trình xử lý**:
   - Người phụ trách đối chiếu biên bản bàn giao hoặc làm việc với chuyên viên/chủ nhiệm nhiệm vụ để xác định trạng thái thực tế.
   - Cập nhật trực tiếp qua giao diện quản trị hoặc script điều chỉnh chuyên biệt sau khi đã xác thực.
   - Ghi lại log biên bản điều chỉnh trong hệ thống Audit Log.
