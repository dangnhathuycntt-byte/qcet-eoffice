# RFC-12: Liên thông văn bản điện tử qua trục quốc gia

- **Status**: DRAFT (chưa duyệt; chưa được phép viết mã liên thông)
- **Date**: 2026-10-10
- **Nguồn**: [SPEC khoảng trống Nhiệm vụ và Văn bản](../../product/specs/task-document-gap-spec.md) mục V-08 và quyết định Q8, Q11; bản đồ hệ thống (Quy trình 6, 7).
- **Deciders**: Ban Giám hiệu, Văn thư, đầu mối công nghệ thông tin, pháp chế.
- **Affects (dự kiến)**: `Document`, `DocumentIncomingWorkflow`, `DocumentOutgoingWorkflow`, `SignatureRecord`, outbox, một route webhook nhận gói tin, một bảng gói tin liên thông.

## 1. Vì sao có RFC này

Hiện trạng đã kiểm trong repo: **không có** gói tin edXML, mã định danh văn bản, danh mục cơ quan ngoài, bảng gói tin liên thông, hay webhook nhận (xem spec V-08). Văn bản đến nhập bằng tay hoặc tải tệp; văn bản đi chỉ ghi `recipientList` dạng văn bản tự do.

Bản đồ hệ thống ghi rằng văn bản điện tử gửi, nhận qua trục liên thông phải tuân Quyết định 43/2026/QĐ-TTg từ 01/11/2026. **RFC này không xác nhận nội dung hay mốc hiệu lực của văn bản pháp luật.** Mục 6 liệt kê những gì pháp chế phải xác minh trước khi lập kế hoạch.

## 2. Phạm vi

**Trong phạm vi:** nhận văn bản đến qua trục (kiểm gói tin, kiểm chữ ký, tạo văn bản đến, từ chối có lý do); gửi văn bản đi qua trục (đóng gói, gán mã định danh, gửi, ghi nhận trạng thái); thu hồi qua trục khi bên nhận chưa tiếp nhận.

**Ngoài phạm vi:** văn bản mang dấu Mật, Tối mật, Tuyệt mật (D15: hệ thống không tiếp nhận, lưu, soạn); kho tài liệu; ký số từ xa của người ký (D01, V-09).

## 3. Nguyên tắc không thay đổi

- N8: mọi side-effect ra ngoài đi qua outbox, không gọi trục trong transaction.
- N9 và D15: gói tin có dấu mật bị từ chối ngay khi nhận, không lưu nội dung.
- ADR-002: quyền qua capability; chỉ hệ thống (chữ ký gói tin) được gọi webhook nhận.
- ADR-007: lỗi theo RFC 9457; mọi lệnh ghi có audit; lệnh khó đảo ngược có `Idempotency-Key`.

## 4. Hướng thiết kế đề xuất (chưa chốt)

### 4.1 Lớp nối (adapter)

Một giao diện `InteropGateway` (gửi gói tin, nhận gói tin, tra cứu trạng thái) tách khỏi nghiệp vụ. Bản cài đặt thật chỉ viết sau khi có tài liệu kỹ thuật chính thức của trục; trước đó có bản giả lập cho kiểm thử. Lý do: định dạng gói tin, phương thức xác thực và chứng thư là điều kiện bên ngoài repo.

### 4.2 Dữ liệu

- `ExternalOrganization`: cơ quan ngoài, mã liên thông, trạng thái kết nối.
- `InteropMessage`: hướng (gửi, nhận), `documentId`, trạng thái (`PENDING`, `SENT`, `DELIVERED`, `RECEIVED`, `REJECTED`, `FAILED`), mã gói tin ngoài, lý do từ chối, số lần thử, dấu thời gian.
- Mã định danh văn bản: gán khi cấp số đi; lưu cùng số đến với văn bản đến. Không đổi sau khi phát hành.
- Phụ thuộc V-05a: người nhận văn bản đi có định danh (thay `recipientList` văn bản tự do) để biết bên nào đã tiếp nhận.

### 4.3 Luồng nhận

1. Webhook nhận gói tin, xác thực chữ ký gói tin, ghi `InteropMessage(RECEIVED)`.
2. Kiểm tra toàn vẹn và dấu mật; lỗi thì `REJECTED` kèm lý do, nơi gửi thấy lý do.
3. Kiểm chữ ký số văn bản (V-03; mặc định `UNVERIFIED`, không bao giờ coi là hợp lệ).
4. Tạo văn bản đến qua đường đăng ký hiện có (cảnh báo trùng số V-02 áp dụng).
5. Văn thư xác nhận tiếp nhận hoặc từ chối.

### 4.4 Luồng gửi

Cấp số, ký số cơ quan, rồi ghi sự kiện outbox `INTEROP_SEND`. Worker gửi, cập nhật trạng thái, thử lại theo backoff có sẵn, quá số lần thì `FAILED` để Văn thư xử lý. Thu hồi (V-05) chỉ gửi được khi bên nhận chưa tiếp nhận.

## 5. Các phương án và đánh đổi

| Phương án | Ưu | Nhược |
|---|---|---|
| A. Tự xây lớp nối theo tài liệu trục | Kiểm soát đầy đủ, không phụ thuộc bên thứ ba | Tốn công, cần chứng thư và môi trường thử của trục |
| B. Dùng phần mềm liên thông trung gian có sẵn | Nhanh | Thêm điểm lỗi, thêm chi phí, phải kiểm định dạng dữ liệu hai chiều |
| C. Chỉ nhập, xuất tay đến khi có yêu cầu bắt buộc | Không rủi ro kỹ thuật | Không đáp ứng nếu quy định bắt buộc điện tử |

Đề xuất tạm: A với giao diện `InteropGateway` để có thể đổi sang B mà không đổi nghiệp vụ. Chưa chọn chính thức.

## 6. Việc cần xác minh ngoài repo (pháp chế, đầu mối CNTT)

1. Nội dung và mốc hiệu lực của Quyết định 43/2026/QĐ-TTg đối với trường; nghĩa vụ cụ thể (gửi, nhận, định dạng, thời hạn).
2. Tài liệu kỹ thuật chính thức của trục: định dạng gói tin, xác thực, chứng thư số, môi trường thử.
3. Trường đã có tài khoản, chứng thư số cơ quan và mã liên thông chưa.
4. Có bắt buộc kết nối điện tử, hay vẫn được dùng văn bản giấy hoặc thư điện tử cho nơi chưa kết nối.

Nếu mục 1 xác nhận mốc gần, RFC này chuyển lên ưu tiên cao nhất (spec mục 3, Q8).

## 7. Tiêu chí để chuyển sang APPROVED

- Mục 6 có câu trả lời bằng văn bản.
- Chọn phương án mục 5.
- Có tài liệu kỹ thuật của trục và môi trường thử.
- Có ADR cho mô hình người nhận (V-05a).

## 8. Rủi ro

| Rủi ro | Biện pháp |
|---|---|
| Làm theo mốc pháp lý chưa kiểm | Mục 6 là điều kiện trước; không viết mã khi chưa trả lời |
| Gói tin có dấu mật lọt vào hệ thống | Từ chối ngay khi nhận, không lưu nội dung, có test |
| Gửi trùng khi thử lại | Khóa idempotency theo mã gói tin ngoài |
| Chữ ký số không kiểm được | Mặc định `UNVERIFIED`, văn bản bị gắn cờ, Văn thư báo nơi gửi |
