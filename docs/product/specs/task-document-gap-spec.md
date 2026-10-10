# SPEC — Khoảng trống chức năng Nhiệm vụ và Văn bản

Ngày: 2026-10-10. Trạng thái: **Draft, sẵn sàng lập kế hoạch**. Chưa triển khai.

Mọi câu hỏi mở đã được chọn phương án tại mục 3 và 8 (2026-10-10, người dùng ủy quyền quyết định toàn bộ). Không còn hạng mục nào ở trạng thái chờ quyết định. Việc cần xác minh ngoài repo được ghi là điều kiện có kiểm tra, không phải quyết định về nội dung pháp luật. Khi đổi quyết định, cập nhật mục 3, 8 và các hạng mục liên quan.

Nguồn đối chiếu:
- Bản đồ hệ thống (artifact `YMQ1BCru8M22gGEWYzhcF3`), mốc đối chiếu repo commit `16722f3f` (05/10/2026). Repo hiện đã có 102 commit sau mốc đó.
- Code: nhánh `feat/document-workspace`, HEAD `c42d659f` (10/10/2026).
- Quyết định: ADR-001, ADR-002, ADR-003, ADR-007, D05, D09, D10, D14, D15.

Ký hiệu: **[ĐÃ KIỂM]** = đã đối chiếu trực tiếp trong code bằng tìm kiếm/đọc file; **[GIẢ THUYẾT]** = chưa kiểm, phải xác minh trước khi triển khai; **[CẦN XÁC MINH]** = phụ thuộc thông tin ngoài repo, do pháp chế hoặc bên liên quan xác nhận. Spec không tự khẳng định nội dung đó.

---

## 1. Mục tiêu và phạm vi

Đưa Nhiệm vụ và Văn bản từ "luồng lõi đã chạy" sang "đủ chức năng theo bản đồ", từng hạng mục có tiêu chí nghiệm thu đo được.

**Trong phạm vi**
- Nhiệm vụ: Quy trình 2, 3, 4, 5 và các hạng mục Designed/Partial của các quy trình này trong bản đồ.
- Văn bản: Quy trình 6, 7, 8, 10 (không gồm Quy trình 17 kho tài liệu, xem mục 7).
- Nhắc hạn và thông báo liên quan trực tiếp đến nhiệm vụ và văn bản (Quy trình 11).

Lưu ý mã: "Quy trình N" là số quy trình trên bản đồ. "Q1–Q17" trong spec này là mã quyết định (mục 8), không phải số quy trình.
- Hạ tầng outbox và quyền mới cần để các hạng mục trên chạy.

**Ngoài phạm vi**
- Quy trình 1, 12–16 (tài khoản, nhập người dùng, khởi tạo, vận hành, lịch và phòng họp), Quy trình 18 (đánh giá tháng).
- Quy trình 17 kho tài liệu: là mô-đun mới, có spec riêng, bắt đầu sau khi P2 xong (Q15).
- Hộp thư và Action Inbox: đã có [inbox-workspace.md](inbox-workspace.md).
- Document Workspace (giao diện): đã có [document-workspace.md](document-workspace.md).

---

## 2. Nguyên tắc bất biến

Mọi hạng mục phải tuân thủ. Vi phạm bất kỳ mục nào thì không được đưa vào triển khai, kể cả khi bản đồ có yêu cầu.

| Mã | Nguyên tắc | Căn cứ |
|---|---|---|
| N1 | Chỉ 5 trạng thái nhiệm vụ: `NOT_STARTED`, `IN_PROGRESS`, `WAITING_APPROVAL`, `COMPLETED`, `CANCELLED`. Không thêm trạng thái. Quá hạn, trễ, sắp đến hạn là phép tính khi đọc. | ADR-003 [ĐÃ KIỂM: enum `TaskStatus` trong `prisma/schema.prisma`] |
| N2 | Không có kết cục "Không duyệt" cho nhiệm vụ. Duyệt chỉ có Đạt (`approve`) hoặc Yêu cầu chỉnh sửa (`request-revision`, lý do bắt buộc). Dừng hẳn là `cancel`, lý do bắt buộc. | D05 đã chốt |
| N3 | `COMPLETED` và `CANCELLED` là kết thúc, không mở lại. Làm lại bằng nhiệm vụ hoặc việc con mới. | ADR-003, bản đồ T3Audit |
| N4 | Người tạo, người thực hiện chính, người nộp, người tải sản phẩm không được duyệt. Ủy quyền không vượt được quy tắc này. | ADR-001 [ĐÃ KIỂM: `checkAntiSelfApproval` trong `src/domain/tasks/contract.ts`] |
| N5 | Quyền đi qua capability và `authorize()`. Nút giao diện lấy từ `availableActions` do server tính. Không kiểm role chuỗi ở client. | ADR-002, D10 |
| N6 | Server kiểm quyền và validate mọi lệnh ghi. Không tin role hay trạng thái do client gửi. | Bản đồ API 2 |
| N7 | Mọi lệnh ghi nhiệm vụ mang `expectedVersion` (hoặc `If-Match`). Lệch trả 412 theo RFC 9457. | ADR-007; `occ.ts` |
| N8 | Mỗi lệnh ghi ghi `AuditEvent` trong cùng transaction. Side-effect ra ngoài (push, email, webhook) đi qua outbox, không gọi trong transaction. | `src/lib/db/outbox.ts` (invariant 1, 2) |
| N9 | Không tiếp nhận, lưu, soạn văn bản mang dấu Mật, Tối mật, Tuyệt mật. Không tạo đường đi nào cho loại này. | D15; `document-classification.ts` [ĐÃ KIỂM] |
| N10 | Ngày nghiệp vụ theo `Asia/Ho_Chi_Minh`, dùng `src/lib/academic-calendar.ts` và `src/domain/tasks/deadlines.ts`. Năm học và `academicMonth` là đơn vị lọc chính của nhiệm vụ. | AGENTS.md; `Task.academicMonth` [ĐÃ KIỂM] |
| N11 | Không dùng `next build` để verify. Kiểm bằng `npm run typecheck`, `npm run lint` và test cụ thể. | AGENTS.md |

---

## 3. Quyết định

Gồm hai loại: **Q-mục** là câu hỏi của spec (đã chọn, có thể đổi trong spec). **D-mục** là quyết định chính thức của dự án (đã quyết theo ủy quyền để lập kế hoạch, chưa ghi vào decision register; ghi lại khi có người có thẩm quyền ký).

### 3.1 Quyết định của spec (Q1–Q17, chi tiết ở mục 8)

Đã chọn. Xem mục 8 và 8.1 để biết lý do.

### 3.2 Quyết định chính thức (D-mục)

| Mã | Câu hỏi | Trạng thái | Quyết định tạm | Hạng mục bị ảnh hưởng |
|---|---|---|---|---|
| D01 | Ký nháy, ký từ xa HSM hay token | Đã quyết (ủy quyền) | Thêm ký nháy tùy chọn theo repo; ký từ xa qua dịch vụ ký số, không in ra ký tay | V-09 (P3) |
| D03 | Duyệt bố trí phòng họp | Ngoài phạm vi | — | — |
| D04 | Có đánh giá nhiệm vụ hằng tháng không, thang điểm | Đã quyết (ủy quyền) | Không đưa vào lộ trình. Mở lại khi Ban Giám hiệu có quyết định bằng văn bản | T-10 (loại khỏi lộ trình) |
| D06 | Giao việc, việc con cho người khác đơn vị | Đã quyết (ủy quyền) | Chỉ giao trong đơn vị; khác đơn vị qua trưởng đơn vị | T-12 (P3) |
| D07 | Người dùng xem việc chung của đơn vị | Đã quyết (ủy quyền) | Người thường chỉ thấy phần của mình; trưởng đơn vị xem việc chung của đơn vị ở chế độ chỉ đọc | T-11 (P3) |
| D11 | Row-level security lớp hai | Hoãn | Deferred, sau khi sửa 7 lỗi authorization và có bộ test hồi quy | Ngoài phạm vi |
| D12 | Người duyệt dự phòng | Đã quyết (ủy quyền) | Có, qua `TaskApprovalStep`; chuyển dự phòng sau 4 ngày chờ duyệt | T-05, T-06 (bậc 4 ngày) |
| D13 | Kênh email cho thông báo | Đã quyết (ủy quyền) | Mặc định chỉ thông báo trong ứng dụng; email chỉ khi người dùng bật | H-1, T-06 |

Đã quyết (ủy quyền) nghĩa là: người dùng giao toàn quyền quyết định cho spec này, nên lựa chọn là căn cứ triển khai. Chưa ghi vào decision register của dự án; ghi lại khi có người có thẩm quyền ký.

---

## 4. Hạ tầng dùng chung

### H-1 Outbox worker

- **Hiện trạng [ĐÃ KIỂM]:** `processOutboxBatch` được định nghĩa trong `src/lib/db/outbox.ts` nhưng không có nơi nào gọi. `vercel.json` chỉ có một cron hằng ngày (`document-deadline-check`). Production chạy bằng `docker-compose.yml` trên máy chủ (có `qcet-app` và `cloudflared`), không phải Vercel. Vì vậy các sự kiện `TASK_REMINDER_NOTIFICATION` và `DOCUMENT_*` đã ghi vào `outbox_events` nhưng không được gửi.
- **Quyết định (Q7, sửa khi triển khai):** worker chạy trong tiến trình app qua `src/instrumentation.ts`, cùng mẫu với `file-scan-worker`, bật bằng `OUTBOX_WORKER_ENABLED` (mặc định `true` trong `docker-compose.yml`), lặp mỗi 60 giây. Lý do đổi so với service riêng: image production chỉ chứa bản build Next.js, không có mã TypeScript hay `tsx`; một service riêng cần thêm bước đóng gói. Chạy nhiều bản vẫn an toàn vì sự kiện được nhận bằng cập nhật nguyên tử `PENDING → PROCESSING`. Không dùng Vercel cron cho outbox.
- **Yêu cầu:**
  - Idempotent: cùng một sự kiện không gửi hai lần khi retry. Dedupe theo `outbox_events.id` ở phía người nhận.
  - Retry theo backoff có sẵn; quá `maxRetries` chuyển `FAILED` kèm `lastError`.
  - Kênh mặc định là thông báo trong ứng dụng (D13). Web push theo cấu hình người dùng.
  - Dừng an toàn khi nhận tín hiệu `SIGTERM` (Docker): hoàn tất batch đang chạy rồi thoát.
- **Quyết định (Q16):** giữ `vercel.json` nguyên, không xóa trong đợt này. Cron văn bản hiện có vẫn chạy như cũ.
- **Chấp nhận khi:**
  - AC-H1-1: sự kiện `PENDING` được xử lý trong tối đa 2 phút kể từ `availableAt`.
  - AC-H1-2: sự kiện lỗi lặp lại đúng số lần, sau đó `FAILED` và có `lastError`.
  - AC-H1-3: chạy worker hai lần liên tiếp không tạo thông báo thứ hai.
  - AC-H1-4: khi app nhận `SIGTERM`, hook tắt chờ batch đang chạy xong rồi mới đóng kết nối DB.
  - AC-H1-5: sự kiện tồn đọng quá 24 giờ khi xử lý lần đầu được đánh dấu xong mà không gửi, tránh gửi dồn thông báo cũ khi bật worker.

### H-2 Capability mới

Các hạng mục Designed trong bản đồ ghi "N/A · chưa có capability". Mỗi capability mới cần:
- Khai báo trong `src/server/authorization/capability.ts`, đặt tên theo quy ước `task.*`, `document.*`, `dossier.*`.
- Gán cho chức vụ qua bộ máy quyền (ADR-002), không gán theo role chuỗi.
- Cập nhật `available-actions.ts`, ma trận PQ1 trên bản đồ, và test quyền.

Capability liên quan hành động nhạy cảm (hủy, thu hồi, hủy hồ sơ) phải được đối chiếu với `NON_DELEGABLE_CAPABILITIES` và `STATUTORY_SIGNING_CAPABILITIES`. Ghi nhận: không capability nào trong spec được đưa vào `NON_DELEGABLE_CAPABILITIES` nếu chưa có ADR.

### H-3 Schema và migration

- Mọi thay đổi qua `prisma migrate`. Kiểm bằng DB test (`qcet_test`), không dùng DB vận hành (`qcet_eoffice`).
- Ưu tiên migration cộng thêm (thêm bảng, thêm cột nullable). Không đổi kiểu cột đang có dữ liệu. Ngoại lệ có chủ đích: thêm giá trị enum (V-05) phải kiểm tra tương thích với code đọc enum.

### H-4 Kiểm thử

- Test trong `tests/`, chạy bằng `node scripts/run-tests.mjs --files tests/<file>.test.ts`. Đọc số test thực chạy và số skip.
- Mỗi hạng mục có ít nhất: một ca quyền (403), một ca scope/ràng buộc nghiệp vụ, một ca OCC (412), một ca kiểm audit/outbox trong cùng transaction.

---

## 5. Nhiệm vụ (T)

### T-00 Đường duyệt cho người duyệt được chỉ định

- **Hiện trạng:** Enum `TaskActorRole` có `REVIEWER`, `APPROVER`. Tìm trong `src/server/authorization/authorization-engine.ts` không thấy xử lý hai vai trò này ngoài các mã chính sách bước 10. Bản đồ T3Audit ghi đây là "Lỗi 3". [GIẢ THUYẾT]
- **Quyết định (Q17):** coi là lỗi cần sửa ở P0. Việc đầu tiên là viết test tái hiện. Nếu test không tái hiện được thì đóng hạng mục và cập nhật bản đồ.
- **Yêu cầu:** Người được chỉ định là `REVIEWER`/`APPROVER` của nhiệm vụ có quyền `task.approve` và `task.review` đúng phạm vi, theo ADR-001.
- **Chấp nhận khi:**
  - AC-T00-1: test tái hiện lỗi thất bại trước khi sửa, đạt sau khi sửa.
  - AC-T00-2: người `COLLABORATOR` vẫn không duyệt được.

### T-01 Xin gia hạn

- **Hiện trạng [ĐÃ KIỂM]:** Không có route, model hay giao diện. Hạn chỉ đổi qua `PATCH /api/tasks/{id}`.
- **Nguồn:** Quy trình 4; API 2 (`request-extension`, `decide-extension`, Designed).
- **Hành vi:**
  - Người thực hiện chính xin gia hạn khi nhiệm vụ đang `NOT_STARTED` hoặc `IN_PROGRESS`.
  - **Không cho xin khi `WAITING_APPROVAL` (Q2).** Lý do: nhiệm vụ đang chờ duyệt, đổi hạn lúc này làm lệch cách tính trễ đã chốt ở T-06.
  - Yêu cầu gồm hạn mới, lý do (từ 3 ký tự). Hạn mới phải sau hạn hiện tại.
  - Mỗi nhiệm vụ chỉ có một yêu cầu `PENDING` tại một thời điểm.
  - Hạn `dueDate` không đổi cho đến khi người giao đồng ý.
  - Người giao chọn: đồng ý (`APPROVE`), từ chối (`REJECT`, lý do bắt buộc), hoặc đề xuất hạn khác (`COUNTER`, kèm `newDueDate`). Người thực hiện nhận đề xuất và chấp nhận hoặc từ chối.
  - Không trả lời trong 2 ngày: nhắc người giao (T-06). Quá 4 ngày: báo người quản lý.
  - Từ lần gia hạn thứ ba, dòng Hoạt động có nhãn "gia hạn nhiều lần" để người quản lý thấy.
- **API:**
  - `POST /api/tasks/{id}/actions/request-extension` — body `{ requestedDueDate, reason, expectedVersion }` — 201.
  - `POST /api/tasks/{id}/actions/decide-extension` — body `{ requestId, decision: APPROVE|REJECT|COUNTER, newDueDate?, note?, expectedVersion }` — 200.
  - Lỗi: 403 không đúng người; 409 đã có yêu cầu `PENDING`; 409 nhiệm vụ đang `WAITING_APPROVAL` hoặc đã kết thúc; 412 lệch version; 422 hạn không hợp lệ hoặc thiếu lý do.
- **Quyền (đề xuất):** `task.request_extension` (người thực hiện chính), `task.decide_extension` (người giao, hoặc trưởng đơn vị chủ quản qua chức vụ).
- **Dữ liệu (đề xuất):** bảng `task_extension_requests` gồm `id`, `task_id`, `requested_by_id`, `requested_due_date`, `reason`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `SUPERSEDED`), `counter_due_date`, `decided_by_id`, `decided_at`, `decision_note`, `created_at`. Index `(task_id, status)`.
- **Audit và outbox:** `TASK_EXTENSION_REQUESTED`, `TASK_EXTENSION_DECIDED`. Khi `APPROVE` hoặc người thực hiện chấp nhận `COUNTER`: cập nhật `dueDate`, tăng `version`, cùng transaction. Outbox thông báo người giao (khi có yêu cầu) và người thực hiện (khi có quyết định).
- **Giao diện:** nút "Xin gia hạn" trong menu hành động, theo `availableActions`. Yêu cầu đang chờ hiển thị ở phần Tổng quan của trang chi tiết, kèm nút đồng ý, từ chối, đề xuất hạn khác.
- **Chấp nhận khi:**
  - AC-T01-1: xin gia hạn hợp lệ tạo `PENDING`, `dueDate` không đổi, Hoạt động có dòng mới.
  - AC-T01-2: xin lần hai khi đang có `PENDING` trả 409.
  - AC-T01-3: `APPROVE` cập nhật `dueDate` và tăng `version`. Người không phải người giao nhận 403.
  - AC-T01-4: hạn mới không sau hạn cũ trả 422.
  - AC-T01-5: xin khi `WAITING_APPROVAL`, `COMPLETED` hoặc `CANCELLED` trả 409.

### T-02 Từ chối nhận việc

- **Hiện trạng [ĐÃ KIỂM]:** Không có `decline`.
- **Nguồn:** Quy trình 3, 5; API 2 (`decline`, Designed).
- **Quyết định (Q1):** giữ nguyên DRI cho đến khi người giao giao lại. Không thêm trạng thái mới (N1), không xóa DRI để tránh nhiệm vụ không có người phụ trách.
- **Hành vi:**
  - Chỉ từ chối khi nhiệm vụ còn `NOT_STARTED`. Lý do bắt buộc, từ 3 ký tự.
  - Ghi dòng Hoạt động, thông báo người giao (outbox).
  - Nếu người giao không giao lại trong 2 ngày: nhắc người giao (T-06); sau 4 ngày báo người quản lý.
- **Quyền:** `task.decline` (người thực hiện chính).
- **Chấp nhận khi:**
  - AC-T02-1: từ chối khi `IN_PROGRESS` trả 409.
  - AC-T02-2: từ chối tạo dòng Hoạt động và thông báo người giao; DRI không đổi.

### T-03 Bình luận nhiệm vụ

- **Hiện trạng [ĐÃ KIỂM]:** Không có model `TaskComment` và không có endpoint. Dòng Hoạt động (`task-activity-feed.tsx`) chỉ dựng từ `AuditEvent`. Có `comment-thread.tsx` trong `components/ui` nhưng không gắn với nhiệm vụ.
- **Nguồn:** API 2 (`comments`, Designed); quy tắc gộp trong `activity-feed-aggregator.ts` đã nêu "không gộp qua bình luận".
- **Hành vi:**
  - Người có quan hệ với nhiệm vụ (người giao, người thực hiện, người phối hợp, người theo dõi, đơn vị chủ trì) được bình luận. Người chỉ đọc không bình luận.
  - Nội dung tối đa 2000 ký tự, văn bản thuần. Không render HTML từ bình luận.
  - Tác giả sửa được; xóa là xóa mềm, giữ dấu vết trong Hoạt động.
  - `@tên` nhắc người dùng: tạo thông báo qua outbox, cho người được nhắc.
- **Dữ liệu (đề xuất):** `task_comments` gồm `id`, `task_id`, `author_id`, `body`, `created_at`, `edited_at`, `deleted_at`. Index `(task_id, created_at)`.
- **API (đề xuất):** `GET|POST /api/tasks/{id}/comments`, `PATCH|DELETE /api/tasks/{id}/comments/{commentId}`.
- **Quyền (đề xuất):** `task.comment` (ghi), `task.read` (đọc).
- **Chấp nhận khi:**
  - AC-T03-1: người không có quan hệ với nhiệm vụ nhận 403.
  - AC-T03-2: nội dung chứa thẻ HTML được lưu và hiển thị dạng văn bản thuần.
  - AC-T03-3: xóa mềm bình luận không làm mất dòng Hoạt động.

### T-04 Tiêu chí hoàn thành

- **Hiện trạng [ĐÃ KIỂM]:** Có trường mô tả tự do "tiêu chí nghiệm thu" trong form tạo nhiệm vụ. Không có danh sách tiêu chí có cấu trúc.
- **Nguồn:** Quy trình 2 (mục "Tiêu chí xong", Mới).
- **Hành vi:**
  - Người giao thêm tiêu chí khi tạo hoặc khi nhiệm vụ còn `NOT_STARTED`/`IN_PROGRESS`. Tối đa 20 tiêu chí, mỗi tiêu chí tối đa 300 ký tự.
  - Người duyệt đánh dấu từng tiêu chí trong màn duyệt.
  - **Duyệt không bị chặn khi còn tiêu chí chưa đạt (Q3).** Giao diện hiện xác nhận "Còn N tiêu chí chưa đạt, vẫn duyệt?". Lý do: D05 chỉ có Đạt hoặc Yêu cầu chỉnh sửa, không có trạng thái trung gian; người duyệt vẫn chọn Yêu cầu chỉnh sửa khi chưa đạt.
- **Dữ liệu (đề xuất):** `task_acceptance_criteria` gồm `id`, `task_id`, `position`, `text`, `checked`, `checked_by_id`, `checked_at`.
- **Quyền:** `task.assign` (sửa tiêu chí: người giao, trưởng đơn vị, lãnh đạo; không dùng `task.update_metadata` vì quyền này cho cả người chủ trì sửa tiêu chuẩn dùng để chấm mình), `task.review` (đánh dấu khi duyệt).
- **Chấp nhận khi:**
  - AC-T04-1: sửa tiêu chí khi `WAITING_APPROVAL` trả 409.
  - AC-T04-2: đánh dấu tiêu chí được ghi vào `AuditEvent` cùng transaction với lệnh duyệt.
  - AC-T04-3: duyệt khi còn tiêu chí chưa đạt vẫn thành công, và dòng Hoạt động ghi số tiêu chí chưa đạt.

### T-05 Người duyệt dự phòng

- **Hiện trạng [ĐÃ KIỂM]:** `TaskApprovalStep` có `reviewerUserId`, chỉ một người duyệt cho mỗi bước.
- **Quyết định (D12, đã quyết):** thêm người dự phòng trên `TaskApprovalStep` (cột nullable `backupReviewerUserId`). Chuyển sang dự phòng khi chờ duyệt quá 4 ngày theo T-06. Người dự phòng vẫn chịu N4.
- **Chấp nhận khi:** người dự phòng chỉ nhận được việc sau đúng mốc 4 ngày; người dự phòng vẫn chịu N4.

### T-06 Nhắc hạn và nhắc tăng cấp

- **Hiện trạng [ĐÃ KIỂM]:** `TASK_REMINDER_NOTIFICATION` chỉ có khi người dùng bấm "Nhắc" (`remind`). Không có nhắc tự động trước hạn, nhắc trễ hạn hay nhắc chờ duyệt cho nhiệm vụ. Cron văn bản `document-deadline-scanner.ts` là mẫu có thể tham chiếu.
- **Nguồn:** Quy trình 4 (nhắc trước hạn, trễ hạn), Quy trình 2 (chờ duyệt quá 2 ngày), Quy trình 11 (nhắc tăng cấp, gộp thông báo, không gửi cho người tự gây ra sự kiện).
- **Hành vi:**

| Sự kiện | Điều kiện | Người nhận | Tắt được? |
|---|---|---|---|
| Nhắc trước hạn | Còn 1 ngày theo ICT, nhiệm vụ chưa `COMPLETED`/`CANCELLED` | Người thực hiện chính, người phối hợp | Có, trong Cài đặt thông báo |
| Trễ hạn | Qua hạn, một lần cho mỗi `dueDate` | Người thực hiện, người giao | Không |
| Chờ duyệt quá 2 ngày | `WAITING_APPROVAL` từ `submitted_at` ≥ 2 ngày | Người duyệt | Có |
| Chờ duyệt quá 4 ngày | Như trên ≥ 4 ngày | Người dự phòng (D12) và người giao | Không |
| Không trả lời yêu cầu gia hạn hoặc giao lại | Yêu cầu quá 2 ngày chưa có quyết định | Người giao (hoặc người được giao lại) | Có |
| Giao việc | Khi được giao | Người thực hiện | Không |

- **Quy tắc:**
  - Không gửi cho người tự thực hiện hành động.
  - Trễ ngừng đếm khi nộp duyệt; thời gian chờ duyệt đếm cho người duyệt.
  - Gộp: nhiều thay đổi cùng nhiệm vụ trong 5 phút thành một thông báo.
- **Dữ liệu (đề xuất):** bảng `task_reminder_log` gồm `task_id`, `kind`, `due_key`, `sent_at`, với ràng buộc unique `(task_id, kind, due_key)` để chống gửi trùng.
- **Cơ chế:** cron theo ICT hằng ngày (cùng mẫu với `document-deadline-check`) ghi outbox; H-1 gửi đi.
- **Phụ thuộc:** H-1, T-05 (cho bậc 4 ngày).
- **Chấp nhận khi:**
  - AC-T06-1: nhắc trước hạn chỉ gửi một lần cho mỗi nhiệm vụ mỗi `dueDate`.
  - AC-T06-2: người đã tắt loại "nhắc trước hạn" không nhận được; loại "trễ hạn" vẫn gửi.
  - AC-T06-3: chạy cron hai lần cùng ngày không tạo thêm thông báo.
  - AC-T06-4: nhiệm vụ đã nộp duyệt không còn được tính trễ cho người thực hiện.

### T-07 Quản lý người phối hợp và người theo dõi qua API

- **Hiện trạng [ĐÃ KIỂM]:** `task-actor-service.ts` có logic thêm người phối hợp (không cho thêm DRI làm phối hợp) nhưng chỉ được `task-domain-actions.ts` gọi nội bộ. Không có route `/api/tasks/{id}/people`. Giao diện có dòng "Phối hợp" trong thuộc tính, chưa kiểm được có sửa trực tiếp không.
- **Nguồn:** API 2 (`POST|DELETE /tasks/{id}/people`, Designed); Quy trình 3.
- **Hành vi:**
  - Thêm hoặc bớt `COLLABORATOR` và `FOLLOWER`. Không thêm DRI làm phối hợp.
  - Người phối hợp không duyệt, không đổi trạng thái; chỉ bình luận và đính tệp.
  - Đổi người việc con: người cũ giữ lịch sử, người mới được báo, ghi chú đang làm dở giữ nguyên.
- **Quyền:** `task.assign`.
- **Chấp nhận khi:**
  - AC-T07-1: thêm DRI làm phối hợp trả 422.
  - AC-T07-2: người phối hợp gọi `approve` nhận 403.

### T-08 Đổi hàng loạt

- **Hiện trạng [ĐÃ KIỂM]:** Không có `bulk-update`. Có `DocumentBatch` cho văn bản nhưng không dùng cho nhiệm vụ.
- **Nguồn:** API 2 (`POST /tasks/actions/bulk-update`, tối đa 200 việc, kết quả từng dòng, `Idempotency-Key` bắt buộc).
- **Quyết định (Q6):** đợt đầu chỉ đổi **ưu tiên**. Không đổi hạn và đơn vị hàng loạt: hạn cần người giao đồng ý (T-01), đơn vị liên quan đến chuyển giao trách nhiệm (T-12). Không đổi trạng thái hàng loạt (bản đồ T3Menu: "chỉ đổi bằng nút hành động").
- **Hành vi:**
  - Mỗi dòng kiểm quyền riêng; một dòng lỗi không làm hỏng các dòng khác. Kết quả trả về từng dòng `{ id, ok, code?, message? }`.
  - `Idempotency-Key` lưu trong `idempotency_records` (có sẵn).
- **Chấp nhận khi:**
  - AC-T08-1: lô 201 dòng trả 422 cho toàn lô.
  - AC-T08-2: gửi lại cùng `Idempotency-Key` không tạo thay đổi thứ hai.
  - AC-T08-3: dòng không có quyền trả 403 trong kết quả, các dòng còn lại vẫn áp dụng.

### T-09 Mẫu và lặp lại

- **Hiện trạng [ĐÃ KIỂM]:** Không có `task-templates` và `task-recurrences`.
- **Nguồn:** API 2 (Designed); T3Bulk ("Đổi hàng loạt, lặp lại, mẫu").
- **Quyết định (Q9):** chu kỳ theo `academicMonth` (năm học), đúng với N10.
- **Thiết kế:**
  - `TaskTemplate`: tên, đơn vị chủ quản, tiêu đề mẫu, mô tả, tiêu chí, danh sách việc con mẫu.
  - `TaskRecurrence`: mẫu, chu kỳ theo tháng học, `nextRunAt`. Scheduler tạo nhiệm vụ idempotent với unique `(recurrence_id, period_key)`, `period_key` dạng `YYYY-MM` theo năm học.
- **Chấp nhận khi:** cron chạy lại trong cùng kỳ không tạo nhiệm vụ thứ hai.

### T-10 Đánh giá nhiệm vụ hằng tháng

- **Trạng thái:** loại khỏi lộ trình theo D04 (mục 3.2). Không đặc tả và không triển khai trong các đợt P0–P3. Mở lại khi có quyết định bằng văn bản của Ban Giám hiệu.

### T-11 Xem việc chung của đơn vị

- **Trạng thái:** đã quyết theo D07 (mục 3.2). Phạm vi: người thường chỉ thấy phần của mình; trưởng đơn vị xem việc chung của đơn vị ở chế độ chỉ đọc. Chưa đặc tả giao diện.

### T-12 Giao việc cho người khác đơn vị

- **Trạng thái:** đã quyết theo D06 (mục 3.2). Phạm vi: chỉ giao trong đơn vị; khác đơn vị qua trưởng đơn vị. Đặc tả chi tiết ở P3.

---

## 6. Văn bản (V)

### V-01 Trả lại và chuyển nhầm đơn vị xử lý

- **Hiện trạng [ĐÃ KIỂM]:** `IncomingDocumentStatus` không có trạng thái trả lại. `UnitWorkAssignment.status` là chuỗi tự do (mặc định `ASSIGNED`), có thể dùng thêm giá trị mà không đổi enum.
- **Nguồn:** Quy trình 6 (trả lại, chuyển nhầm, không xóa lịch sử); API 2 (`return`, `reroute`, Designed).
- **Hành vi:**
  - Đơn vị xử lý trả lại kèm lý do bắt buộc. `UnitWorkAssignment` chuyển `status = RETURNED`, giữ bản ghi cũ. Văn bản về `ASSIGNED_TO_LEAD_UNIT` để đơn vị chủ trì phân công lại.
  - Văn thư chuyển nhầm sang đơn vị khác (`reroute`): bản ghi cũ `status = REROUTED`, tạo bản ghi mới cho đơn vị mới. Lý do bắt buộc.
  - Thêm chuyển tiếp hợp lệ `UNIT_ASSIGNED_PERSON → ASSIGNED_TO_LEAD_UNIT` trong `INCOMING_DOCUMENT_TRANSITIONS` ([ĐÃ KIỂM] hiện chưa có).
- **Quyền (đề xuất):** `document.incoming.return` (trưởng đơn vị được phân công), `document.incoming.reroute` (văn thư). Hai capability mới.
- **Chấp nhận khi:**
  - AC-V01-1: trả lại không có lý do trả 422.
  - AC-V01-2: lịch sử phân công còn đủ bản ghi cũ.
  - AC-V01-3: chuyển nhầm không tạo nhiệm vụ liên kết mới nếu nhiệm vụ cũ đã hoàn thành (xem V-10).

### V-02 Cảnh báo trùng số ký hiệu và nơi gửi

- **Hiện trạng [ĐÃ KIỂM]:** Không có kiểm tra trùng. `originalNumber` chỉ có index, không unique. Giá trị mặc định `CHƯA_CÓ_SỐ` khi thiếu.
- **Nguồn:** Quy trình 6 ("Trùng số ký hiệu và nơi gửi thì cảnh báo trước khi đăng ký").
- **Quyết định (Q4):** cảnh báo, cho người đăng ký xác nhận tiếp tục. Không chặn.
- **Hành vi:**
  - `GET /api/documents/duplicate-check?originalNumber=&issuingAuthority=` trả danh sách văn bản trùng trong phạm vi người dùng được đọc.
  - Chuẩn hóa so sánh: bỏ khoảng trắng thừa, không phân biệt hoa thường, bỏ qua `CHƯA_CÓ_SỐ`.
  - Đăng ký mà không xác nhận: trả 409 với mã `DUPLICATE_SUSPECT` và danh sách văn bản trùng. Gửi lại kèm `acknowledgeDuplicate: true` thì đăng ký tiếp.
  - Kết quả chỉ gồm văn bản người dùng có quyền đọc. Không tiết lộ sự tồn tại của văn bản bị ẩn.
- **Chấp nhận khi:**
  - AC-V02-1: văn bản trùng bị ẩn với người dùng không có quyền không xuất hiện trong kết quả.
  - AC-V02-2: `CHƯA_CÓ_SỐ` không gây cảnh báo.
  - AC-V02-3: đăng ký có xác nhận tạo đúng một văn bản và một bản ghi Audit.

### V-03 Kiểm chữ ký số văn bản đến

- **Hiện trạng [ĐÃ KIỂM]:** `SignatureRecord` chỉ ghi chữ ký do hệ thống tạo cho văn bản đi. Không có kiểm tra chữ ký của bên gửi.
- **Nguồn:** Quy trình 6 (kiểm tra ký số, gắn cờ khi thiếu hoặc sai); API 2 (`GET /documents/{id}/signatures`, Designed).
- **Quyết định (Q12):** không chọn nhà cung cấp trong đợt này. Xây giao diện `SignatureVerifier` (đầu vào: chữ ký, nội dung, chứng thư; đầu ra: trạng thái enum). Triển khai mặc định trả `UNVERIFIED`, không bao giờ trả `VALID`, cho đến khi có nhà cung cấp được ADR-V08 phê duyệt. Lý do: chọn dịch vụ kiểm chứng cần cùng quyết định về chứng thư của liên thông.
- **Hành vi:** kiểm khi nhận; trạng thái `VALID`, `INVALID`, `REVOKED`, `UNVERIFIED` (đã có enum `SignatureVerificationStatus`). `INVALID` hoặc thiếu chữ ký thì gắn cờ, Văn thư báo nơi gửi.
- **Chấp nhận khi:** văn bản không có chữ ký hợp lệ được gắn cờ; trạng thái `UNVERIFIED` không bị coi là hợp lệ.

### V-04 Từ chối tiếp nhận (liên thông)

- Phụ thuộc V-08. Không triển khai trong các đợt P0–P2.

### V-05 Thu hồi văn bản đi

- **Hiện trạng [ĐÃ KIỂM]:** Không có `recall`. `OutgoingDocumentStatus` không có trạng thái thu hồi. `recipientList` là văn bản tự do, không phải danh sách người nhận có định danh.
- **Nguồn:** Quy trình 7 (thu hồi, trạng thái "Đã thu hồi"); API 2 (`recall`, Designed).
- **Phụ thuộc:** cần mô hình người nhận có định danh (V-05a, mục 7).
- **Quyết định (Q10):** không thu hồi sau khi bên nhận đã tiếp nhận. Chỉ thay thế bằng văn bản mới có số mới.
- **Hành vi (khi V-05a có):**
  - Thu hồi khi bên nhận chưa tiếp nhận. Thêm trạng thái `RECALLED` vào `OutgoingDocumentStatus` (migration enum, kiểm tra code đọc enum theo H-3).
  - Đã tiếp nhận: chỉ phát hành bản thay thế có số mới, ghi "thay thế số …". Số đã cấp không tái sử dụng.
- **Quyền (đề xuất):** `document.outgoing.recall`.
- **Chấp nhận khi:**
  - AC-V05-1: thu hồi sau khi bên nhận đã tiếp nhận trả 409.
  - AC-V05-2: số văn bản đã thu hồi không được cấp lại.

### V-06 Tờ trình nội bộ đầy đủ

- **Hiện trạng [ĐÃ KIỂM]:** Có loại `TO_TRINH_NOI_BO` và đánh số riêng theo năm (`numbering-engine.ts`: `TT-n/năm`). Chưa có luồng trưởng đơn vị rồi lãnh đạo, duyệt song song, rút lại, xin ý kiến, quy trình tùy chỉnh.
- **Nguồn:** Quy trình 8; API 2 (`decide-approval`, `approval-flows`, Designed).
- **Hành vi cần có:**
  - **Luồng cơ bản:** chuyên viên trình → trưởng đơn vị → lãnh đạo. Nếu người trình là trưởng đơn vị thì bỏ bước trưởng đơn vị.
  - **Quyết định (Q13):** workflow riêng `DocumentApprovalWorkflow` cho tờ trình, không tái sử dụng `DocumentOutgoingWorkflow`. Lý do: Quy trình 8 ghi tờ trình không phát hành ra ngoài, trong khi luồng văn bản đi có cấp số, ký số cơ quan và phát hành. Trước khi thiết kế, đối chiếu `src/lib/documents/state-machine.ts` để biết `TO_TRINH_NOI_BO` hiện đi qua luồng nào (bước kiểm, không phải quyết định).
  - **Duyệt song song (Mới):** tờ trình liên quan nhiều đơn vị, các trưởng đơn vị duyệt song song, đủ đồng ý mới lên lãnh đạo. Mô hình đề xuất: `DocumentApprovalStep(documentId, groupOrder, unitId, approverUserId, status PENDING|APPROVED|REVISION_REQUIRED, decidedAt, note)`. Nhóm hoàn tất khi mọi bước `APPROVED`.
  - **Rút lại:** khi chưa ai mở thì về Nháp; sau đó phải xin trả lại.
  - **Xin ý kiến (Mới):** chuyển phiếu cho người cho ý kiến, không đổi người duyệt. Mô hình: `DocumentConsultation`.
  - **Người nghỉ giữa chừng:** quản trị thay người xử lý ở bước đang chờ, có dấu vết; không làm lại từ đầu.
  - **Sau phê duyệt:** tạo nhiệm vụ liên kết bằng một nút; tờ trình vào hồ sơ.
  - **Không phê duyệt (Q5):** có, lý do bắt buộc, người trình thấy ngay. Đây là kết cục của tờ trình, không phải của nhiệm vụ; D05 chỉ áp dụng cho nhiệm vụ.
  - **Quy trình tùy chỉnh:** không đặc tả trong đợt này (bản đồ ghi "Chờ chốt"). Thuộc P3.
  - **Báo cáo thời gian duyệt (Mới):** thống kê theo đơn vị và người, thời gian từng bước, tỷ lệ đúng hạn, xuất Excel. Phụ thuộc dấu thời gian của mỗi bước (mô hình trên).
- **Chấp nhận khi:**
  - AC-V06-1: duyệt song song, một bước `REVISION_REQUIRED` đưa nhóm về người trình.
  - AC-V06-2: người trùng vai trò người trình và người duyệt bị từ chối (N4 áp dụng cho tờ trình).
  - AC-V06-3: số tờ trình không dùng chung với số văn bản đi.

### V-07 Xét hủy và gia hạn bảo quản hồ sơ

- **Hiện trạng [ĐÃ KIỂM]:** `RetentionRule` và `WorkDossier` có. Không có `propose-disposal`, `dispose`, hay `admin/dossiers/{id}/actions/purge`.
- **Nguồn:** Quy trình 10 (xét hủy, Designed); API 2.
- **Hành vi:**
  - Văn thư lập đề nghị hủy kèm biên bản. Lãnh đạo quyết định hủy hoặc gia hạn.
  - Hủy là xóa mềm trước. Quản trị hệ thống xóa hẳn (`purge`) chỉ sau khi có biên bản và không mở nội dung.
  - Hồ sơ có văn bản mật không tồn tại trên hệ thống (N9) nên không có trường hợp đặc biệt.
- **Quyền (đề xuất):** `dossier.propose_disposal` (văn thư), `dossier.dispose` (lãnh đạo, theo chức vụ). Capability mới, đánh giá lại với `STATUTORY_SIGNING_CAPABILITIES`.
- **Nhắc (Mới):** nhắc thời hạn nộp lưu trước 30 ngày; dùng cơ chế T-06 và H-1.
- **Chấp nhận khi:**
  - AC-V07-1: văn thư không tự quyết định hủy (403).
  - AC-V07-2: `purge` không chạy khi chưa có biên bản.
  - AC-V07-3: hồ sơ đã xóa mềm không hiện trong tra cứu thường.

### V-08 Liên thông trục quốc gia

- **Hiện trạng [ĐÃ KIỂM]:** Không có `external-orgs`, `interop/messages`, `internal/interop/webhook`, mã định danh văn bản, hay đóng gói edXML.
- **Nguồn:** Quy trình 6, 7.
- **Quyết định (Q8, Q11):** bắt đầu ADR và RFC liên thông ngay trong P1, không chờ mốc pháp lý. Không viết code liên thông trước khi ADR được duyệt.
- **Về mốc 01/11/2026:** bản đồ ghi văn bản gửi qua trục tuân Quyết định 43/2026/QĐ-TTg từ 01/11/2026. Spec này **không** xác nhận nội dung hay mốc hiệu lực của văn bản pháp luật. Pháp chế xác minh mốc này và đưa vào đầu vào của ADR. Nếu mốc được xác nhận, ADR ưu tiên hoàn thành trước mốc và V-08 chuyển lên P2. Nếu không xác nhận được, V-08 giữ ở P3.
- **Yêu cầu tiền đề:** ADR và RFC riêng về kết nối trục, định dạng gói tin, xác thực, chứng thư số, xử lý lỗi.
- **Thành phần (dự kiến):** `ExternalOrganization` (cơ quan ngoài, mã liên thông), `InteropMessage` (gửi và nhận, trạng thái), webhook nhận có xác thực chữ ký gói tin, mã định danh gán khi cấp số đi, từ chối tiếp nhận có lý do, kiểm tra gói tin trước khi tạo văn bản đến.
- **Chấp nhận khi:** sẽ đặc tả ở ADR riêng.

### V-09 Ký nháy và ký từ xa

- **Trạng thái:** đã quyết theo D01 (mục 3.2). Thêm ký nháy tùy chọn; ký từ xa qua dịch vụ ký số; không in ra ký tay. Thuộc P3.

### V-10 Liên kết hai chiều văn bản và nhiệm vụ

- **Hiện trạng [ĐÃ KIỂM]:** Đã có. `Document.linkedTaskId` (unique), `document-task-two-way-traceability.test.ts`, `document-linked-task-access.test.ts`, và liên kết được ghi nhật ký khi đổi.
- **Ghi chú:** bản đồ ghi `POST /documents/{id}/links/tasks` là Designed. Thực tế hạng mục này đã có một phần (liên kết qua `PATCH` và `linkedTaskId`, chưa có endpoint riêng). Cần cập nhật bản đồ, không cần triển khai lại.
- **Quyết định:** giữ quan hệ một-một (một văn bản, một nhiệm vụ liên kết). Nhiều nhiệm vụ cho một văn bản là mở rộng riêng, không thuộc đợt này.

---

## 7. Hạng mục tách riêng

| Mã | Hạng mục | Lý do tách | Việc cần làm trước |
|---|---|---|---|
| V-05a | Mô hình người nhận văn bản đi có định danh | `recipientList` là văn bản tự do; V-05 và theo dõi nơi nhận phụ thuộc vào đây | ADR nhỏ về mô hình người nhận |
| QT17 | Kho tài liệu và biểu mẫu (`/library/*`, Quy trình 17) | Mô-đun mới: thư mục, phiên bản, quét virus, dấu chìm, ACL thư mục | Spec riêng |
| V-08 | Liên thông trục | Liên quan pháp lý và kỹ thuật ngoài hệ thống | ADR, RFC, xác minh mốc pháp lý |

---

## 8. Quyết định của spec (Q1–Q17)

| # | Câu hỏi | Quyết định | Lý do |
|---|---|---|---|
| Q1 | Từ chối nhận việc xử lý thế nào khi chưa có trạng thái mới? | Giữ DRI đến khi giao lại; ghi lý do; thông báo và nhắc người giao sau 2 ngày | Không thêm trạng thái (N1), không để nhiệm vụ không có người phụ trách |
| Q2 | Có cho xin gia hạn khi `WAITING_APPROVAL` không? | Không | Đang đếm chờ duyệt; đổi hạn lúc này làm lệch T-06 |
| Q3 | Duyệt có chặn khi còn tiêu chí chưa đạt không? | Không chặn, xác nhận cảnh báo | D05 không có trạng thái trung gian; người duyệt đã có lựa chọn Yêu cầu chỉnh sửa |
| Q4 | Trùng số ký hiệu: chặn hay cảnh báo? | Cảnh báo, cho xác nhận | Bản đồ ghi "cảnh báo"; số có thể bị nhập sai hoặc trùng hợp |
| Q5 | "Không phê duyệt" có áp dụng cho tờ trình không? | Có, lý do bắt buộc | D05 chỉ áp dụng nhiệm vụ; tờ trình là quy trình khác |
| Q6 | Danh sách trường đổi hàng loạt | Chỉ ưu tiên | Hạn và đơn vị liên quan đến đồng ý và trách nhiệm (T-01, T-12); trạng thái không đổi hàng loạt |
| Q7 | Nền tảng và tần suất chạy outbox worker | Chạy trong tiến trình app qua `instrumentation.ts`, bật bằng `OUTBOX_WORKER_ENABLED`, lặp 60 giây (sửa khi triển khai) | Production chạy Docker; image không có mã TS nên service riêng cần thêm bước đóng gói; repo đã có mẫu `file-scan-worker` |
| Q8 | Mốc 01/11/2026 của liên thông trục | Không đưa V-08 vào P0–P2; ADR trước; xác minh mốc với pháp chế | Spec không xác nhận nội dung pháp luật; tránh lập kế hoạch dựa trên mốc chưa kiểm |
| Q9 | Chu kỳ mẫu lặp lại | Theo `academicMonth` (năm học) | Khớp N10 và cách lọc nhiệm vụ hiện tại |
| Q10 | Thu hồi sau khi bên nhận đã tiếp nhận? | Không; chỉ thay thế bằng số mới | Khớp bản đồ Quy trình 7 |

---

### 8.1 Quyết định bổ sung

| # | Câu hỏi | Quyết định | Lý do |
|---|---|---|---|
| Q11 | Khi nào bắt đầu ADR liên thông trục? | Ngay trong P1, không chờ mốc pháp lý | ADR là điều kiện trước mọi code liên thông; chờ thì mất thời gian |
| Q12 | Chọn nhà cung cấp kiểm chữ ký số? | Chưa chọn. Xây `SignatureVerifier` mặc định `UNVERIFIED` | Chọn dịch vụ cần cùng quyết định về chứng thư của liên thông |
| Q13 | Tờ trình dùng workflow nào? | `DocumentApprovalWorkflow` riêng | Tờ trình không phát hành ra ngoài; không cần cấp số, ký số cơ quan |
| Q14 | Đánh giá nhiệm vụ hằng tháng (D04) | Loại khỏi lộ trình | Quyết định thuộc Ban Giám hiệu; spec không thay thế |
| Q15 | Kho tài liệu (Quy trình 17) | Spec riêng, bắt đầu sau P2 | Là mô-đun mới, không nằm trong luồng nhiệm vụ và văn bản hiện tại |
| Q16 | Có xóa `vercel.json` không? | Không, giữ nguyên trong đợt này | Chưa rõ còn dùng; xóa là thay đổi ngoài phạm vi |
| Q17 | T-00 (REVIEWER/APPROVER) xử lý thế nào? | Coi là lỗi P0, viết test tái hiện trước | Giả thuyết chưa kiểm; test là cách kiểm nhanh nhất |

---

## 9. Thứ tự triển khai

| Giai đoạn | Hạng mục | Điều kiện |
|---|---|---|
| **P0 — Nền** | H-1 outbox worker; H-2 capability; T-00 đường duyệt REVIEWER/APPROVER | Không còn quyết định mở |
| **P1 — Làm ngay** | T-01 xin gia hạn; T-02 từ chối nhận; T-03 bình luận; T-04 tiêu chí; T-06 nhắc trước hạn, trễ hạn, chờ duyệt; T-07 người phối hợp qua API; V-01 trả lại và chuyển nhầm; V-02 cảnh báo trùng số; V-10 cập nhật bản đồ; ADR liên thông (V-08, Q11) | H-1 cho T-06 |
| **P2 — Sau P1** | T-08 đổi hàng loạt (ưu tiên); V-06 tờ trình (gồm duyệt song song, rút lại, xin ý kiến, báo cáo thời gian duyệt); V-07 xét hủy hồ sơ; V-05a rồi V-05 thu hồi | V-05a phải có trước V-05 |
| **P3 — Cần ADR hoặc quyết định ngoài** | T-05 người dự phòng (D12 đã quyết); T-09 mẫu và lặp lại; T-11, T-12 (D07, D06 đã quyết); V-03 kiểm chữ ký (adapter, chưa chọn dịch vụ); V-08 liên thông (ADR, xác minh pháp lý); V-09 ký nháy (D01 đã quyết); quy trình tùy chỉnh của tờ trình | ADR, xác nhận D-mục, xác minh pháp lý |

Phụ thuộc chính:
- T-06 (bậc 4 ngày) và T-02 (nhắc người giao) phụ thuộc H-1 và T-05.
- V-05 phụ thuộc V-05a.
- V-08 phụ thuộc V-03, V-05a và ADR.
- T-01 và T-08 dùng chung quy tắc đổi hạn; T-08 không đổi hạn nên không phụ thuộc trực tiếp.

---

## 10. Kiểm chứng

- Mỗi hạng mục có test theo H-4. Tên file đề xuất theo mẫu `tests/<domain>-<hạng-mục>.test.ts`, ví dụ `tests/task-extension-request.test.ts`.
- Lệnh chạy:
  - `npm run typecheck`
  - `npm run lint`
  - `node scripts/run-tests.mjs --files tests/<file>.test.ts`
- Luồng UI chính (T-01, V-01, V-06) cần E2E Playwright với DB test riêng.
- Không báo "đã kiểm" cho hạng mục chưa chạy test. Thiếu môi trường DB test thì báo phần chưa kiểm chứng.
- H-1: kiểm bằng test DB (`tests/outbox-worker-task-notifications.test.ts`); không kiểm trên production.

---

## 11. Rủi ro

| Rủi ro | Tác động | Biện pháp |
|---|---|---|
| Bản đồ lệch repo (mốc `16722f3f`, HEAD `c42d659f`, 102 commit) | Có hạng mục ghi "Designed" nhưng đã có một phần (ví dụ V-10) | Cập nhật bản đồ (P1) trước khi tạo ticket |
| Gán quyền mới sai | Lỗ hổng phân quyền; bản đồ đã ghi 7 lỗi đang mở ở Phân quyền 2 | Test quyền bắt buộc, đánh giá trước khi bật |
| Worker chưa chạy | Mọi thông báo outbox âm thầm không gửi | H-1 là điều kiện của T-06, T-02, V-07 |
| Thông báo trùng khi retry | Người dùng nhận nhiều thông báo cùng một việc | Ràng buộc unique và dedupe theo outbox id |
| Mốc 01/11/2026 cho liên thông chưa xác minh | Nếu đúng, V-08 bị trễ | Xác minh với pháp chế ngay trong P0; nếu xác nhận thì tách ADR khẩn |
| Quyết định ủy quyền (D01, D06, D07, D12, D13) bị đổi hoặc chưa được ghi vào decision register | Phải làm lại hạng mục liên quan | Ghi vào decision register khi có người có thẩm quyền ký, trước khi bắt đầu P3 |

---

## 12. Tham chiếu

- Code điểm chạm chính:
  - `src/domain/tasks/state-machine.ts`, `src/domain/tasks/contract.ts`
  - `src/lib/services/task-domain-actions.ts`, `src/lib/services/task-actor-service.ts`
  - `src/lib/documents/state-machine.ts`, `src/lib/documents/incoming-workflow.ts`
  - `src/lib/services/incoming-document-service.ts`, `src/lib/services/outgoing-document-service.ts`
  - `src/lib/documents/document-deadline-scanner.ts`, `src/app/api/cron/document-deadline-check/route.ts`
  - `src/lib/db/outbox.ts`, `src/server/authorization/capability.ts`, `src/server/authorization/authorization-engine.ts`
  - `src/instrumentation.ts`, `src/server/outbox/` (worker và handler), `docker-compose.yml` (`OUTBOX_WORKER_ENABLED`), `vercel.json` (không dùng cho outbox)
- Schema: `prisma/schema.prisma` (các model `Task`, `TaskApprovalStep`, `Document`, `DocumentIncomingWorkflow`, `UnitWorkAssignment`, `DocumentOutgoingWorkflow`, `SignatureRecord`, `OutboxEvent`, `WorkDossier`).
- Bản đồ: artifact `YMQ1BCru8M22gGEWYzhcF3`, các trang Quy trình 2–8, 10, 11; API 2; R02, R03; T3Audit; T3Flow.

---

## 13. Trạng thái triển khai

Nhánh `feat/task-document-gaps`. Cập nhật sau mỗi hạng mục.

| Hạng mục | Trạng thái | Kiểm chứng | Ghi chú |
|---|---|---|---|
| T-00 | Xong | `tests/security/task-designated-reviewer-authz.test.ts` 11/11; 26 file test quyền 497/498 (1 lỗi do chạy song song DB, đạt khi chạy riêng) | Nguyên nhân gốc: `assigneeIds` gom mọi TaskActor nên REVIEWER/APPROVER bị bước 10 chặn "tự duyệt"; FOLLOWER/OBSERVER có quyền cập nhật tiến độ. Thêm `partitionTaskActorUserIds` dùng chung cho server và `availableActions`. |
| H-1 | Xong | `tests/outbox-worker-task-notifications.test.ts` 7/7; 20 file test push/outbox/notification 277/278 (`mobile-pwa-push-e2e` lỗi sẵn trên code gốc) | Handler: nhắc việc, giao lại, nộp duyệt, Đạt, yêu cầu chỉnh sửa (kèm lý do), hủy. Đánh dấu xong không gửi: `TASK_COMPLETED`, trễ hạn văn bản (cron đã gửi). Sự kiện văn bản đến, văn bản đi, hồ sơ, ủy quyền chưa có handler, giữ `PENDING` để làm ở các hạng mục V. |
| V-02 | Xong | `tests/document-duplicate-check.test.ts` 7/7; 9 file test văn bản liên quan 217/217; lint 109 lỗi bằng baseline | API `GET /api/documents/duplicate-check`; đăng ký văn bản đến (`/api/documents`, `/api/documents/incoming`) trả 409 `DUPLICATE_SUSPECT` nếu chưa gửi `acknowledgeDuplicate`. Kết quả lọc theo `buildDocumentReadWhere`. Hai form (vào sổ nhanh, đăng ký văn bản đến) hiện cảnh báo và lưu lần hai để xác nhận. Chưa kiểm trên trình duyệt. |
| T-07 | Xong (API) | `tests/task-people-management.test.ts` 9/9; 640 test quyền/bảo mật 640/640 | `POST|DELETE /api/tasks/{id}/people`. Người giao (người tạo) được thêm `task.assign` ở bước 4 của `authorize()`. Không thêm người đang giữ vai trò chủ trì, người giao, người duyệt; thêm lại cùng vai trò không đổi gì. Lỗi nghiệp vụ trả 400 (`ValidationError` của codebase), không phải 422 như spec. Chưa làm giao diện thêm, bớt người; thuộc tính "Phối hợp" trên trang chi tiết chưa gọi API này. |
| T-03 | Xong (API, giao diện chưa xem trên trình duyệt) | `tests/task-comments.test.ts` 10/10, `tests/task-comment-mentions.test.ts` 4/4; 947 test quyền/outbox/thông báo (946 đạt, 1 lỗi sẵn `mobile-pwa-push-e2e`) | Migration `20261010100000_task_comments` (mới áp dụng lên `qcet_test`; DB dev cần `prisma migrate deploy`). Capability `task.comment`. `GET|POST /api/tasks/{id}/comments`, `PATCH|DELETE .../{commentId}`. Nhật ký chỉ lưu `commentId`, không lưu nội dung. Nhắc tên giới hạn trong người có vai trò trên nhiệm vụ. Giao diện: khối Bình luận ở tab Hoạt động của `task-detail-page`. Chưa gắn vào `TaskDetailView` (màn workspace cũ). |
| T-04 | Xong (API và khối giao diện; xác nhận khi bấm Duyệt chưa làm) | `tests/task-acceptance-criteria.test.ts` 9/9; 84 file test liên quan 1260/1262 (1 lỗi sẵn `mobile-pwa-push-e2e`; 1 lỗi `task-actor-service` chỉ khi chạy song song, đạt riêng 7/7 cả trước và sau thay đổi) | Migration `20261010110000_task_acceptance_criteria` (đã áp dụng lên `qcet_test`). `GET|PUT /api/tasks/{id}/criteria`, `PATCH /api/tasks/{id}/criteria/{criterionId}`. Sửa tiêu chí dùng `task.assign` thay vì `task.update_metadata` (xem mục T-04). Sửa danh sách tăng `version` nhiệm vụ; trang chi tiết đồng bộ lại version. Duyệt ghi `unmetCriteria` vào nhật ký và kết quả. Khối giao diện ở tab Tổng quan, cảnh báo khi còn tiêu chí chưa đạt. **Chưa làm:** hộp thoại xác nhận "Còn N tiêu chí chưa đạt, vẫn duyệt?" ở các điểm bấm Duyệt (nhiều nơi gọi `approve`); ô nhập tiêu chí trong form tạo nhiệm vụ. Chưa xem trên trình duyệt. |
| T-01 | Xong (API, rào chắn đổi hạn, khối giao diện; chưa xem trên trình duyệt) | `tests/task-extension.test.ts` 15/15; 175 file test liên quan 2395/2402, 7 lỗi đều không do thay đổi này (4 lỗi y hệt ở commit gốc: `api-overview-route-contracts`, `task-action-icons`, `task-content-regressions`, `task-table-engine`; 1 lỗi sẵn `mobile-pwa-push-e2e`; 2 lỗi chỉ khi chạy song song, đạt riêng) | Migration `20261010120000_task_extension_requests` (đã áp dụng lên `qcet_test`). Capability `task.request_extension` (chủ trì), `task.decide_extension` (người giao, trưởng đơn vị trong phạm vi, lãnh đạo). `POST /api/tasks/{id}/actions/request-extension`, `.../decide-extension` (APPROVE, REJECT, COUNTER do người giao; ACCEPT, DECLINE do người xin), `GET /api/tasks/{id}/extensions`. Chặn xin khi chờ duyệt (Q2); việc con không vượt hạn cha. Lần gia hạn thứ ba ghi `TASK_EXTENSION_REPEATED`. **Thay đổi hành vi có sẵn:** `PATCH /api/tasks/{id}` đổi `dueDate` nay cần `task.assign`; người thực hiện nhận 403 `DEADLINE_CHANGE_REQUIRES_ASSIGNER` và phải dùng Xin gia hạn. Giao diện: khối Gia hạn ở tab Tổng quan. **Chưa làm:** ẩn ô đổi hạn trực tiếp cho người thực hiện ở thanh thuộc tính (hiện vẫn hiện và báo lỗi 403 khi lưu); nhắc người giao sau 2 ngày và báo người quản lý sau 4 ngày (thuộc T-06). |
| T-02 | Xong (API và khối giao diện; chưa xem trên trình duyệt) | `tests/task-decline.test.ts` 6/6 | Migration `20261010130000_task_decline_notices` (đã áp dụng lên `qcet_test`). Capability `task.decline`. `POST /api/tasks/{id}/actions/decline`, `GET` cùng đường dẫn trả trạng thái. Thông báo từ chối còn hiệu lực khi do người chủ trì hiện tại gửi sau lần bổ nhiệm gần nhất, nên giao lại là tự hết hiệu lực, không cần xóa ở từng đường đổi chủ trì. Báo người giao qua outbox. **Chưa làm:** nhắc người giao sau 2 ngày và báo người quản lý sau 4 ngày (thuộc T-06). |
| V-01 | Xong (API và nút xử lý; chưa xem trên trình duyệt) | `tests/incoming-document-return-reroute.test.ts` 9/9; 100 file test văn bản/quy trình/quyền 1692/1692 | Migration `20261010140000_document_unit_returns` (đã áp dụng lên `qcet_test`). Bảng `document_unit_returns` giữ lịch sử mỗi lần trả lại. Capability `document.incoming.return` (trưởng đơn vị chủ trì, trong ranh giới đơn vị) và `document.incoming.reroute` (Văn thư), thêm ở cả `authorization-engine` và `hybrid-authorization` (dịch vụ văn bản đến dùng hệ hybrid). Trả lại: về `DIRECTED`, bỏ đơn vị chủ trì, hủy phân công thụ lý đang mở (`CANCELLED`, đúng từ vựng sẵn có); không trả lại khi đã sinh nhiệm vụ liên kết. Chuyển lại: về `ASSIGNED_TO_LEAD_UNIT` với đơn vị mới, không chọn lại đơn vị vừa trả. Thêm hai chuyển tiếp hợp lệ trong `INCOMING_DOCUMENT_TRANSITIONS`. `POST /api/documents/{id}/actions/return` và `.../reroute`. Thông báo trong ứng dụng cho Văn thư, lãnh đạo bút phê (khi trả lại) và trưởng đơn vị nhận (khi chuyển); chưa có web push cho sự kiện văn bản. Nút Trả lại và Chuyển đơn vị khác trong `IncomingWorkflowActions`, nhập lý do và chọn đơn vị ngay trên trang (thay cho `window.confirm/alert`). **Chưa làm:** hiển thị lịch sử trả lại trên trang chi tiết (có sẵn `listDocumentReturns`, chưa có route đọc); bước `assign-unit` của trưởng đơn vị ở `ASSIGNED_TO_LEAD_UNIT` chưa có nút (có từ trước, ngoài phạm vi). |
| T-06 | Xong phần tự động (nhắc trước hạn, trễ hạn, chờ duyệt 48/96 giờ, gia hạn và từ chối chưa xử lý 48/96 giờ); chưa có bậc dự phòng và chưa gộp thông báo | `tests/task-reminder-rules.test.ts` 5/5, `tests/task-reminder-scanner.test.ts` 9/9; 30 file outbox/thông báo/nhiệm vụ 375/377 (1 lỗi sẵn `mobile-pwa-push-e2e`; 1 lỗi `document-overdue-cron-scanner` chỉ khi chạy song song, đạt riêng 14/14 cả ở commit gốc) | Migration `20261010150000_task_reminder_logs` (đã áp dụng lên `qcet_test`). Bộ quét `scanTaskReminders` chạy trong worker outbox mỗi 10 phút và qua `GET /api/cron/task-reminders` (cùng cơ chế xác thực `CRON_SECRET`). Chống gửi trùng bằng ràng buộc duy nhất `(task, kind, dueKey)`; gửi lỗi thì nhả khóa để quét lại. Gửi từ 07:00 giờ Việt Nam; báo trễ chỉ trong 30 ngày để không gửi dồn khi mới bật. Tắt được qua cài đặt push sẵn có: `deadlineReminder` (nhắc trước hạn) và `taskReview` (nhắc người duyệt 48 giờ); báo trễ và các mốc 96 giờ không tắt được. Nhiệm vụ chờ duyệt không báo trễ cho người thực hiện. **Chưa làm:** người duyệt dự phòng ở mốc 96 giờ (T-05, đang chờ); gộp thông báo trong 5 phút (Quy trình 11); cài đặt thông báo riêng cho từng loại ngoài hai mục push hiện có. |
| V-08 (ADR) | Đã khởi động: RFC nháp | [RFC-12](../../architecture/decisions/RFC-12-national-interop-axis.md) (DRAFT) | Theo quyết định Q11. RFC liệt kê việc pháp chế phải xác minh trước khi viết mã (nội dung và mốc của Quyết định 43/2026/QĐ-TTg, tài liệu kỹ thuật của trục, chứng thư số, phương án A/B/C). Chưa có mã liên thông. |
| T-08 | Xong phần API (chưa gắn vào thanh thao tác hàng loạt) | `tests/task-bulk-update.test.ts` 6/6 | `POST /api/tasks/actions/bulk-update`: `{ items: [{id, expectedVersion}], priority }`, tối đa 200, bắt buộc `Idempotency-Key`, kiểm quyền (`task.update_metadata`), kiểm version và trạng thái riêng từng dòng, kết quả từng dòng; một dòng lỗi không ảnh hưởng dòng khác; đặt cùng giá trị thì không đổi và không tăng version. Chỉ đổi ưu tiên (Q6). **Chưa làm:** mục "Đổi ưu tiên" trên `BatchActionBar` (thanh này đang có sẵn đổi trạng thái, gia hạn hạn chót hàng loạt, giao lại; thao tác gia hạn hạn chót hàng loạt đó nay chịu rào chắn đổi hạn của T-01 với người không phải người giao). |
| V-06 | Xong phần cốt lõi (trình, duyệt song song, Cần bổ sung, Không phê duyệt, rút lại, thay người xử lý, xin ý kiến, báo cáo thời gian duyệt, khối giao diện; chưa xem trên trình duyệt) | `tests/submission-approval.test.ts` 11/11, `tests/submission-rules.test.ts` 6/6; 123 file test văn bản/quy trình/quyền 1933/1934 (1 lỗi `api-overview-route-contracts` y hệt ở commit gốc) | Migration `20261010160000_document_approval_workflow` (đã áp dụng lên `qcet_test`). **Q13 đã kiểm:** tờ trình trước đây chỉ là `Document` thường, không có luồng nào. `DocumentApprovalWorkflow` riêng, các bước theo vòng trình (`DocumentApprovalStep`), phiếu xin ý kiến (`DocumentConsultation`). Capability `document.submission.submit` (người lập), `.review_unit` (trưởng đơn vị của bước), `.approve` (lãnh đạo). Đơn vị chỉ Đồng ý hoặc Cần bổ sung; Không phê duyệt chỉ ở lãnh đạo (Q5), lý do bắt buộc. Người trình là trưởng đơn vị thì bước đơn vị mình bị bỏ qua. Người duyệt phải là trưởng đơn vị của bước (hoặc người được chỉ định thay); người trình không tự duyệt. Rút lại chỉ khi chưa ai mở: `GET /approval` do người duyệt gọi sẽ đánh dấu đã mở. Quyền đọc mở rộng cho người tham gia luồng (người trình, người duyệt được chỉ định, trưởng đơn vị của bước, người được xin ý kiến) ở cả danh sách (`buildDocumentReadWhere`) và chi tiết. API: `GET /api/documents/{id}/approval`, `POST .../actions/{submit-approval, decide-approval, withdraw-approval, reassign-approval-step, ask-consultation, answer-consultation}`, `GET /api/documents/approval-report` (JSON hoặc `format=csv` mở bằng Excel; lãnh đạo xem toàn bộ, trưởng đơn vị xem đơn vị mình). Thông báo trong ứng dụng qua outbox. **Chưa làm:** nút tạo nhiệm vụ liên kết sau khi phê duyệt; "xin trả lại" khi đã có người mở (hiện báo lỗi hướng dẫn); giao diện thay người xử lý và xem báo cáo (chỉ có API); tệp `.xlsx` thật (đang xuất CSV); quy trình tùy chỉnh (thuộc P3). |
| V-07 | Xong (API, nhắc việc, khối giao diện; chưa xem trên trình duyệt) | `tests/dossier-disposal-rules.test.ts` 5/5, `tests/dossier-disposal.test.ts` 9/9; 43 file test hồ sơ/quyền/outbox/bảo mật 563/563; lint 109 lỗi bằng baseline | Migration `20261010170000_dossier_disposal` (đã áp dụng lên `qcet_test`; DB dev cần `prisma migrate deploy`). Hồ sơ thêm `retentionExtraYears`, `disposedAt`, `disposedById`; bảng `DossierDisposalProposal` (PROPOSED, DISPOSE, EXTEND) và `DossierReminderLog`. Capability `dossier.propose_disposal` (Văn thư), `dossier.dispose` (lãnh đạo; người đề nghị không tự quyết định), `dossier.purge` (chỉ quản trị hệ thống). Chỉ đề nghị khi hồ sơ đã lưu trữ, hết hạn bảo quản (kể cả phần gia hạn), không vĩnh viễn, chưa có đề nghị mở; số biên bản và lý do bắt buộc. Gia hạn tối đa tổng 70 năm. Quyết định hủy: hồ sơ biến khỏi danh sách và chi tiết (404). Xóa hẳn: `POST /api/admin/dossiers/{id}/actions/purge`, chỉ hồ sơ đã hủy có quyết định DISPOSE; nhật ký `DOSSIER_PURGED` giữ số biên bản. API: `GET /api/dossiers/{id}/disposal`, `POST .../actions/propose-disposal`, `.../actions/dispose`. Bộ quét `scanDossierReminders` (trong worker và cron): nhắc người phụ trách trước hạn nộp lưu 30 ngày, báo Văn thư khi hồ sơ hết hạn bảo quản và chưa có đề nghị; chống trùng bằng ràng buộc duy nhất. Thông báo đề nghị và quyết định qua outbox. Khối giao diện "Xét hủy hồ sơ" ở cột phải trang chi tiết hồ sơ. **Chưa làm:** xóa tệp vật lý của hồ sơ khi xóa hẳn (chỉ xóa bản ghi); giao diện xóa hẳn (chỉ API). |
