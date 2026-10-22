# ADR-015: Chỉ soạn văn bản đi; văn bản đến phát sinh từ phát hành, chỉ gửi nhận trong trường

- **Status**: ACCEPTED. Người dùng đặt quy tắc ngày 22/10/2026 ("logic chỉ được tạo văn bản đi (giống gửi mail vậy) chứ không tự tạo văn bản đến", "qcet là app nội bộ chỉ gửi nhận trong trường") và duyệt phương án ("đồng ý làm toàn bộ"). Chưa triển khai production.
- **Date**: 2026-10-22
- **Deciders**: Chủ sở hữu dự án.

## Context

Trước quyết định này, mọi người đã đăng nhập đều tạo được văn bản đến qua `POST /api/documents` (nút "Vào sổ văn bản đến"), còn đường dành cho văn thư `POST /api/documents/incoming` không được giao diện dùng. Phát hành văn bản đi chỉ ghi dòng nơi nhận; không ai được báo, đơn vị nhận không mở được văn bản, và "đã tiếp nhận" do văn thư bên gửi ghi thay.

Đối chiếu VNPT iOffice của trường (xem chỉ đọc ngày 22/10/2026): chuyên viên chỉ có "Khởi tạo văn bản đi"; văn bản trường phát hành tự hiện ở nơi nhận trong mục Văn bản đến hoặc Văn bản thông báo, số đến bằng số đi, văn thư không vào sổ lại. Văn bản của cơ quan ngoài trường do văn thư vào sổ, nhưng QCET không nhận văn bản ngoài trường: việc đó vẫn làm trên VNPT.

## Decision

1. **Không ai tạo văn bản đến, kể cả văn thư.** `POST /api/documents` với `VAN_BAN_DEN` và `POST /api/documents/incoming` trả 403 (`canCreateDocument`, `INCOMING_CREATE_FORBIDDEN_MESSAGE`). Giao diện bỏ nút "Vào sổ văn bản đến" và bộ chọn loại ở hộp nhập nhanh; hộp đó chỉ còn soạn tờ trình. Hàm dịch vụ `registerIncomingDocument` giữ lại cho test luồng văn bản đến cũ và cho liên thông sau này (RFC-12, chưa duyệt).
2. **Phát hành là gửi, như gửi thư; không sinh bản sao.** Văn bản đi ở trạng thái `ISSUED`, `DELIVERED`, `FILED`, `ARCHIVED` hoặc `RECALLED` có đơn vị trong `OutgoingDocumentRecipient` (`INTERNAL_UNIT`) thì mọi thành viên đơn vị đó đọc được (`deliveredToUnitsWhere` trong `buildDocumentReadWhere`, `deliveredUnitIds` trong `canAccessClassification`, cả khi tải tệp đính kèm). Không tạo bản sao `VAN_BAN_DEN` vì mỗi bản sao chiếm một số trong sổ văn bản đến (`@@unique([type, documentYear, registrationNumber])`), trái với cách VNPT để số đến bằng số đi. Đã thu hồi vẫn đọc được để nơi nhận xem thông báo thu hồi.
3. **Sổ của người xem.** Sổ Văn bản đến = văn bản đến đã có + văn bản đi đã phát hành tới đơn vị người xem (`buildInboxTypeWhere`). Sổ Văn bản đi không tính văn bản đơn vị khác gửi tới (`buildDocumentReadWhere(ctx, { delivered: false })`). Bộ đếm (`getDocumentStatsRows`) đếm đúng như danh sách. Xuất sổ theo Phụ lục IV giữ đúng loại, không gồm văn bản được gửi tới.
4. **Tiếp nhận do nơi nhận bấm.** Trưởng đơn vị nhận (chức danh `isUnitLeaderPosition` tại đơn vị đó) bấm "Tiếp nhận" cho đơn vị mình; văn thư bên gửi không bấm thay. Dòng nơi nhận ngoài trường (`EXTERNAL`) còn trong dữ liệu cũ thì văn thư vẫn ghi nhận như trước. Trong sổ đến, văn bản chưa được đơn vị tiếp nhận nằm ở "Chờ xử lý"; đã tiếp nhận, đã thu hồi hoặc đã lưu trữ thì ở "Đã xử lý". Đã có nơi nhận tiếp nhận thì không thu hồi được (quy tắc V-05 giữ nguyên).
5. **Chỉ gửi trong trường.** Nơi nhận khi phát hành phải là đơn vị trong trường (`RecipientInputSchema` chỉ nhận `unitId`); giao diện bỏ ô "Cơ quan, tổ chức ngoài trường".
6. **Báo khi phát hành.** Handler outbox `DOCUMENT_ISSUED_NOTIFICATION` báo trưởng các đơn vị nhận chưa tiếp nhận (thông báo `document_delivered`). Sự kiện cùng loại do bước vào sổ cũ để lại (văn bản đến) được hoàn tất mà không báo ai; lúc quyết định, CSDL dev có 56 sự kiện như vậy và chưa có văn bản đi nào đã phát hành, nên không có thông báo cũ bị gửi dồn.
7. **Soạn văn bản đi bật mặc định.** Cờ `outgoingDocuments` đổi mặc định thành bật vì đây là lối duy nhất để gửi văn bản.

## Consequences

- Văn bản đến đã vào sổ trước ngày này vẫn đi luồng cũ (trình lãnh đạo, bút phê, phân công, lưu hồ sơ).
- Văn bản gửi tới đơn vị mới chỉ đọc và tiếp nhận được. Để sau: vai trò của từng nơi nhận như VNPT (xử lý chính, phối hợp, xem để biết), mỗi đơn vị nhận tự giao việc (`Document.linkedTaskId` hiện là duy nhất nên một văn bản chỉ liên kết một nhiệm vụ), gửi tới từng cá nhân.
- `POST /api/documents/{id}/actions/issue` vẫn cho phát hành không kèm nơi nhận (giao diện bắt chọn ít nhất một đơn vị); văn bản như vậy không tới ai.
- Route `GET /api/documents/duplicate-check` không còn giao diện nào gọi.

## Alternatives Considered

1. **Mỗi đơn vị nhận một bản sao văn bản đến kèm `DocumentIncomingWorkflow`.** Dùng lại được luồng bút phê, phân công, nhưng tiêu số sổ đến cho văn bản nội bộ và tách một văn bản thành nhiều bản phải đồng bộ (thu hồi, thay thế). Bị bác.
2. **Giữ nút vào sổ cho văn thư để nhận văn bản ngoài trường.** Phương án đề xuất ban đầu; bị bác khi người dùng xác nhận QCET chỉ gửi nhận trong trường.
