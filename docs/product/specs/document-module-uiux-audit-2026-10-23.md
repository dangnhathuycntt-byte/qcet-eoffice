# Văn bản: rà soát UI/UX theo từng thành phần và luồng người dùng

Ngày: 2026-10-23. Trạng thái: **đã duyệt ngày 2026-10-23** (người dùng: “duyệt và tự quyết”); các quyết định D1–D9 do tác giả chọn ở §11 theo lời giao đó. Triển khai theo từng đợt ở §9; tiến độ ghi ở §9.1. Mục nào không nằm trong đợt đã làm vẫn là đề xuất.

Phạm vi: toàn bộ module Văn bản — Sổ văn bản (bảng, bộ lọc, hàng loạt, thẻ điện thoại), Quick View và trình xem tệp, hộp Soạn văn bản đi, luồng văn bản đi (trình → duyệt nội dung → thể thức → ký → cấp số → đóng dấu → phát hành → tiếp nhận → thu hồi), Tờ trình nội bộ, Hồ sơ công việc, Báo cáo duyệt, thông báo liên quan. Không đụng sidebar chung, quy trình Nhiệm vụ, hay quyết định ADR-015 (QCET chỉ soạn văn bản đi; văn bản đến phát sinh từ phát hành).

## 1. Kết luận

Khung giao diện của module đã đi cùng phần còn lại của QCET (bảng chung `ui/table`, Quick View, hộp soạn kiểu New issue, skeleton khi tải, trạng thái trống đứng giữa, không cuộn ma ở 1000×600, thẻ một cột ở 390px — xem §6). Rà soát không thấy lỗi bố cục lớn. **Lỗi nằm ở luồng**: giao diện không nói đúng *ai phải làm gì tiếp theo* và không báo cho người đó; một phần sự thật hiển thị (ký số, số/ký hiệu, “Đã lập hồ sơ”) không có thật phía sau.

Năm nhóm vấn đề, xếp theo mức nghiêm trọng:

| Nhóm | Biểu hiện chính (đã tái hiện trên trình duyệt trừ khi ghi khác) | Mã |
|---|---|---|
| A. Người đúng không thấy việc | Trưởng đơn vị không đọc được dự thảo của nhân viên mình (403) nên không duyệt được; hàng đợi “Chờ xử lý” tính theo trạng thái chứ không theo “tới lượt tôi”; 9/11 sự kiện outbox của văn bản đi và 4/6 của hồ sơ không có handler thông báo, nằm PENDING mãi | Q1, Q2, S3, N1 |
| B. Giao diện nói sai về quyền và trạng thái | Nút của bước hiển thị cho mọi người (người soạn thấy “Phê duyệt nội dung”), bấm ra “Thao tác thất bại (403)” và che lý do thật; stepper lệch một bước, không nói ai làm khi nào; chip “Đã ký” dùng cho cả “đã cấp số” lẫn “đã đóng dấu” | Q3, P1–P4 |
| C. Thông tin bị mất | Lý do trả lại được lưu và API trả về nhưng web không đọc (0 tham chiếu `contentReviewNotes`); người soạn không biết bị trả, không biết ai trả; số văn bản luôn mang ký hiệu “QĐ-CĐKTCNQN” kể cả công văn; ký nháy khóa luôn bản nháp sau khi bị trả | Q4, G2, G5 |
| D. Luồng không khép | Tiếp nhận là ngõ cụt (ADR-015 để sau); tờ trình duyệt xong dừng ở nhãn “Đã lập hồ sơ” không có hồ sơ; Hồ sơ công việc không tạo được, không thêm được tài liệu, “Đóng hồ sơ” luôn lỗi; người duyệt tờ trình không mở được tệp | R1, T1–T3, H1–H3 |
| E. Chữ ký số là giả | `signature_records` ghi `VALID` + “Ban Cơ yếu Chính phủ” gán cứng, hộp ký chỉ có [Hủy][Xác nhận]; người dùng tin đã ký số | G1 |

Hướng sửa (chi tiết ở §8–§9): **khép luồng văn bản đi trước, thêm tính năng sau**. Đợt A (P0) làm cho người duyệt thấy, được báo, bấm được đúng nút và người soạn biết bị trả vì sao; đợt B làm trạng thái và bước nhận trung thực; đợt C là tinh chỉnh. Các quyết định chủ sở hữu ở §11 (chữ ký số, ký hiệu số, nộp lưu, vai trò nơi nhận) đã được chọn ngày 2026-10-23 theo lời giao “duyệt và tự quyết”; mỗi lựa chọn đảo lại được.

## 2. Phương pháp và độ tin cậy

**Môi trường.** Bản sao cơ sở dữ liệu dev vào `qcet_audit` (DB dev `qcet_eoffice` không đụng), web cổng 3301, api cổng 3300, bộ chuyển người dùng cổng 3399 (chỉ cục bộ, cookie phiên ký bằng `AUTH_SECRET` riêng nên không dùng được với dev). 7 người dùng thật của dữ liệu dev: chuyên viên Phòng QLĐT (soạn), trưởng Phòng QLĐT, Văn thư, Hiệu trưởng, trưởng Khoa CNTT, trưởng Phòng TCKT, chuyên viên Khoa CNTT. Trình duyệt Playwright riêng (được đổi cỡ cửa sổ; Chrome của người dùng không chạm). Worker outbox chỉ chạy khi `NODE_ENV=production` (`apps/api/src/server/outbox/outbox-worker.ts:118`) nên dev không bao giờ gửi thông báo văn bản; khi cần xem thông báo phải chạy tay một vòng xử lý.

**Ba mức bằng chứng**, ghi ở từng mục:

- **[T]** quan sát trên trình duyệt (ảnh `NN` = `.playwright-mcp/docaudit/NN-*.png`, thư mục bị ignore nên không nằm trong git);
- **[D]** kiểm bằng API/DB trong `qcet_audit` (curl theo người dùng, `psql`);
- **[M]** chỉ đọc mã (`file:dòng`), chưa chạy.

Hai sub-agent chỉ đọc mã đã lập bảng trạng thái ↔ sự kiện ↔ hàng đợi thông báo và bảng route API ↔ điều khiển giao diện (64 file route = 74 cặp method + đường dẫn; 20 cặp không có nơi gọi ở web). Khẳng định của họ chỉ được ghi [T]/[D] khi tôi đã tái hiện; còn lại giữ [M].

**Hiệu chỉnh.** Bản đầu của tài liệu ghi nhầm ô “Số, ký hiệu” của tờ trình là do hệ thống cấp; thực tế do người dùng gõ tay (đã sửa ở §4.3 và T2). Ghi nhớ cũ “web gửi `notes` còn route ký đọc `signingNotes` nên ghi chú ký mất” là **sai**: web không gửi ghi chú cho bước ký (body `{}`); route `sign` đọc `signingNotes` và schema strict; chỗ rớt ghi chú thật là `organization-sign` (route nhận `notes`, `organizationSign` ở `outgoing-document-service.ts:1077-1194` không dùng). Lỗi 500 khi tải tệp lần đầu lúc rà là hiện vật môi trường (bản sao DB có dòng `file_objects` trùng `storage_key` nhưng đĩa thiếu tệp); không tính là lỗi sản phẩm, chỉ phần thông báo lỗi tiếng Anh thô là phát hiện hợp lệ (C2).

**Chưa quan sát** (xem §12): Chrome thật của người dùng, thiết bị cảm ứng, trình đọc màn hình, hộp Soạn văn bản đi ở 390px, thông báo đẩy, dữ liệu production, ký số thật.

## 3. Bản đồ module

| Bề mặt | Thành phần chính | Ghi chú |
|---|---|---|
| Sổ văn bản `/documents` (`?type=inbox|outbox`, `&bucket=`, `?tab=submission`) | `registry/document-ledger.tsx` (bảng), `document-card-list.tsx` (điện thoại), `document-registry-view.tsx`, bộ lọc/hiển thị/hàng loạt `registry/*` | Mặc định trộn đến + đi + tờ trình (ảnh 40) |
| Quick View `?docId=` | `document-quick-view.tsx`, `workspace/document-workspace-parts.tsx`, `outgoing-action-panel.tsx`, `outgoing-workflow-stepper.tsx`, `outgoing-recipients-panel.tsx`, `outgoing-initial-sign.tsx`, `workspace/submission-approval-panel.tsx`, trình xem `document-pdf-viewer.tsx`, `document-viewer-rail.tsx` | Không tồn tại trang chi tiết đầy đủ: nhánh `variant="full"` của `DocumentInfoSections` không có nơi gọi [M] |
| Hộp soạn | `compose-outgoing-dialog.tsx` (văn bản đi), `document-quick-entry-modal.tsx` (tờ trình) | Hai khung khác nhau (ảnh 02, 51) |
| Hồ sơ công việc `/dossiers`, `/dossiers/[id]` | `dossiers/dossier-registry-view.tsx`, `dossier-detail-view.tsx`, `dossier-disposal-panel.tsx` | Quản trị: danh sách hồ sơ đã hủy chờ xóa hẳn (`admin/disposed-dossiers-view.tsx`) |
| Báo cáo duyệt `/documents/approval-report` | `approval-report-view.tsx` | Skeleton khi tải (ảnh 99) |
| Thông báo | `apps/api/src/server/outbox/document-notification-handlers.ts` + hộp thư `/inbox` | 8 handler văn bản + 2 handler hồ sơ |

Máy trạng thái văn bản đi (`apps/api/src/server/documents/state-machine.ts:116-150`): DRAFT → CONTENT_REVIEW → FORMAT_CHECK → AUTHORIZED_SIGN → NUMBERED → ORGANIZATION_SIGNED → ISSUED → DELIVERED → FILED → ARCHIVED, cộng RECALLED. `sign` (ký chức danh) **không đổi trạng thái**, chỉ đặt `authorizedSignedAt` (`outgoing-document-service.ts:857-866`); `ARCHIVED` không có hàm nào đặt (`rg` ngoài test).

Số liệu route: 74 cặp method + đường dẫn trong `documents/**`, `dossiers/**`, `page-data/dossiers/[id]`; 20 cặp không có nơi gọi ở web, gồm các bước nghiệp vụ `revision`, `submit-format-check`, `deliver` và toàn bộ `dossiers/[id]/items` (liệt kê ở Phụ lục A). Không có lời gọi nào của web tới route không tồn tại.

## 4. Luồng người dùng

Mỗi luồng ghi theo người thật đã dùng để thử. “Gãy” là chỗ người dùng không hoàn thành được việc, hoặc hoàn thành mà không biết. Mã ở cột cuối trỏ tới §5.

### 4.1. Văn bản đi, từ soạn tới nơi nhận (luồng chính)

Nhân vật: **Hùng** (chuyên viên P.QLĐT, soạn), **Thí** (trưởng P.QLĐT), **Tường** (Hiệu trưởng), **Nhung** (Văn thư), **Vinh** (trưởng Khoa CNTT, nơi nhận).

| # | Bước | Người | Họ thấy | Gãy ở đâu | Mã |
|---|---|---|---|---|---|
| 1 | Soạn dự thảo | Hùng | Hộp soạn: trích yếu 24px, ghi chú, chip Hình thức/Độ khẩn/Độ mật/Hạn xử lý, kẹp giấy (ảnh 02–03) | Không chọn người duyệt, người ký, nơi nhận. Lưu nháp khi tệp lỗi: “Internal server error” tiếng Anh thô, hộp chỉ còn nút Đóng (ảnh 04) [T]. Quick View bản nháp ghi “Ban hành 23/10/2026” (ảnh 05) | C1, C2, C6 |
| 2 | Trình duyệt nội dung | Hùng | Hộp “Trình phê duyệt nội dung — Gửi dự thảo lên Trưởng đơn vị…” [Hủy][Xác nhận] (ảnh 08) | Không nói gửi cho ai (`content_reviewer_id` trống). Trình được khi **chưa có tệp nào** [D: 200] và khi chỉ có phụ lục. Không có “Rút lại” | C1, C3, Q5 |
| 3 | Sau khi trình | Hùng | Trạng thái “Chờ duyệt”, banner xanh cố định trong thân (ảnh 09) | **Vẫn thấy nút “Phê duyệt nội dung” và “Yêu cầu chỉnh sửa”**; bấm → hộp xác nhận → “Thao tác thất bại (403)” (ảnh 10–11) [T]. Vẫn **sửa được trích yếu** sau khi trình (API 200) [D] | Q3, Q15 |
| 4 | Duyệt nội dung | Thí | `/documents?type=outbox&bucket=pending` rỗng: “Không có văn bản đi chờ xử lý” (ảnh 13); mở link trực tiếp: “Bạn không có quyền xem văn bản này” (ảnh 14) [T][D: 403] | **P0**: trưởng đơn vị cùng đơn vị không đọc được dự thảo; cũng không được báo; sidebar không dấu hiệu nào | Q1, Q2, S3 |
| 5 | Duyệt nội dung (thực tế) | Tường | Thấy cả bản nháp của người khác (DRAFT-2026-1) trong “Chờ xử lý” (ảnh 15); nút chính “Phê duyệt nội dung”, “Yêu cầu chỉnh sửa” đỏ, khối “Ký nháy” (ảnh 16) | Hiệu trưởng thành người duy nhất duyệt được dù hộp trình nói “Trưởng đơn vị” | Q1, Q2 |
| 5b | **Trả lại** | Tường → Hùng | Hùng mở lại: bản nháp trông như mới tạo; không lý do, không tên người trả, không giờ (ảnh 93–94) [T]. API trả `outgoingWorkflow.contentReviewNotes = "[Trả lại]: Bổ sung căn cứ…"` nhưng web không đọc [D][M] | Người soạn không biết bị trả và vì sao; không có thông báo (`DOCUMENT_CONTENT_REJECTED` không handler) [D] | Q4, N1 |
| 6 | Duyệt thể thức | Nhung | Nút theo trạng thái; Hiệu trưởng cũng thấy “Xác nhận thể thức đạt” (việc của Văn thư) → 403 “Thao tác thất bại (403)” dù server trả lý do tiếng Việt rõ (`detail`) (ảnh 19–20) [T][M `outgoing-action-panel.tsx:127`] | Nút không theo người; lý do bị che | Q3 |
| 7 | Ký chức danh | Tường | Hộp “Ký chức danh — Ký số xác nhận thẩm quyền ban hành” [Hủy][Xác nhận]; không chọn chứng thư, không PIN/token, không chữ ký trên tệp (ảnh 21) | DB: `signature_records` `VALID`, nhà cung cấp “Ban Cơ yếu Chính phủ” gán cứng, không serial/hash [D][M `outgoing-document-service.ts:839-855`]. Sau ký vẫn còn nút “Ký chức danh” (bấm lại → 409, UI chỉ ghi “Thao tác thất bại (409)”) (ảnh 22) | G1, Q9 |
| 8 | Cấp số | Nhung | “Cấp số & ngày ban hành — … xác nhận ngày ban hành” chỉ có [Hủy][Xác nhận] (ảnh 23); sau đó “Số, ký hiệu: 10” (ảnh 24) | Không có ô ngày dù lời nói có; không xem trước số; kết quả `10/QĐ-CĐKTCNQN` cho **Công văn** (DB: `category = Công văn`, `original_number = 10/QĐ-CĐKTCNQN`) [D]; UI chỉ hiện “10” | G2, Q12 |
| 9 | Đóng dấu cơ quan | Nhung | Hộp dấu (ảnh 25). Sau bấm: Quick View không đổi, không banner, trạng thái cũ, vài giây sau mới hiện khối “Theo dõi nơi nhận” (ảnh 26–27) | Khoảng trống không nút nào; bước kế “Phát hành” nằm trong khối Theo dõi nơi nhận, không ở khu nút chính | Q8 |
| 10 | Phát hành | Nhung | Danh sách checkbox phẳng 18 đơn vị trong khung cao 160px, không ô tìm, không nhóm, không “Toàn trường”, gồm cả đơn vị người gửi (ảnh 30) | Câu “Chỉ thu hồi được văn bản đã phát hành…” hiện ngay lúc chuẩn bị phát hành; bấm “Phát hành” không xác nhận nêu cụ thể gửi cho ai | R3, R4 |
| 11 | Báo nơi nhận | hệ thống | Chỉ trưởng đơn vị nhận có “Có văn bản gửi đến đơn vị bạn” (sau khi chạy worker tay; ảnh 32–33) | Không nói đơn vị gửi/độ khẩn; không nút hành động tại chỗ; đơn vị không có trưởng → `skipped` im lặng [M `document-notification-handlers.ts:192-197`] | N2, R2 |
| 12 | Tiếp nhận | Vinh | Hàng trong sổ ghi “Đã phát hành” (trạng thái của người gửi); header “Văn bản đi · 10”, banner “quy trình xử lý hoàn tất” (ảnh 32, 34). “Tiếp nhận” là nút ghost 78×28px chữ 12px nằm cuối dòng đơn vị (đo bằng `getBoundingClientRect`) | Sau bấm: đổi thành “Đã nhận 23/10/2026” không toast; **hết đường**: không giao việc, không chuyển cán bộ, không trả lại, không lưu hồ sơ; bên gửi không được báo | R1, R5, S9 |

Điểm vào của người soạn ngay sau bước 3 là **không có đường nào** để biết văn bản đang ở ai: không dòng “Đang chờ <ai>”, không giờ trình, không nút Rút lại (bước 2 và 3).

### 4.2. Văn bản nhận (đơn vị nhận)

Theo ADR-015 (đã duyệt), “văn bản đến” của đơn vị chính là dòng nơi nhận của văn bản đi đã phát hành; trưởng đơn vị nhận bấm “Tiếp nhận”. Phần việc sau tiếp nhận (vai trò XLC/PH/xem, giao việc cho từng đơn vị nhận, gửi cá nhân) được ADR-015 **để sau** và là câu hỏi 4 của chủ sở hữu (§11) — spec này không đề xuất làm thay. Những gì nằm trong phạm vi đã duyệt mà đang gãy: R1 (nút chính), R2 (đơn vị không trưởng), R5 (báo ngược), S9 (nhãn theo góc nhìn nơi nhận).

Luồng văn bản đến kiểu cũ (`VAN_BAN_DEN`: trình lãnh đạo, bút phê, giao đơn vị, giải quyết, lập hồ sơ) vẫn còn trong mã và chỉ đi tới được với dữ liệu cũ. Nút “Kết thúc” của luồng này **luôn thất bại** vì web không gửi `resolutionDocUrl` mà server bắt buộc, và còn đòi hồ sơ đã nộp lưu chứa mục “kết quả” trong khi UI không thêm được mục vào hồ sơ [M `incoming-document-service.ts:172-222`, `incoming-workflow-sections.tsx:162-163`]. Đây là mã còn sót: đề nghị quyết định ở §11 (giữ, ẩn hay xóa) chứ không sửa lẻ.

### 4.3. Tờ trình nội bộ

| # | Bước | Người | Họ thấy | Gãy ở đâu | Mã |
|---|---|---|---|---|---|
| 1 | Mở danh sách trống | Hùng | Vừa hộp gợi ý nổi “Soạn tờ trình đầu tiên” vừa EmptyState trùng nội dung (ảnh 50) | Hai khối nói một việc | T6 |
| 2 | Tạo | Hùng | Hộp khung cũ (không phải khung compose). “Số, ký hiệu” **bắt buộc** (“Vui lòng nhập Số ký hiệu văn bản gốc.”), placeholder ví dụ, dòng cố định “PDF hoặc Word, tối đa 10MB”; Đơn vị đề xuất không mặc định đơn vị người soạn (ảnh 51–53) | Từ vựng văn bản đến còn sót; ô số **do người dùng gõ tay** (lúc rà soát tôi gõ `01/TTr-QLĐT`; dữ liệu dev có `12r1r1r`), hệ thống chỉ cấp “Số 0006” nội bộ | T2 |
| 3 | Sau tạo | Hùng | Trạng thái **“Chờ bút phê”** ngay khi vừa tạo; mục “Luân chuyển” hiện chuỗi *văn bản đến* (“Tiếp nhận & Vào sổ — Số đến 6/2026 → Trình Ban Giám hiệu → Chỉ đạo & Bút phê → Giao đơn vị…”) song song hàng “Phê duyệt: Nháp · [Trình duyệt]” của luồng tờ trình; bốn con số (Số 0006, Số đến 6/2026, Số gốc, Số ký hiệu) (ảnh 54–55) | Hai hệ trạng thái mâu thuẫn trên một văn bản | T1 |
| 4 | Trình | Hùng | Hộp “Trình duyệt tờ trình” **tốt**: ô tìm đơn vị liên quan, “Đơn vị của bạn [Luôn duyệt]” khóa, chân “1 đơn vị duyệt → Lãnh đạo” (ảnh 56). Sau trình: “Chờ trưởng đơn vị [Rút lại]” (ảnh 57) | — (mẫu nên dùng lại cho nơi nhận) | — |
| 5 | Duyệt | Thí | Nhận thông báo “Tờ trình chờ bạn duyệt” (handler có). Mở tờ trình: **tệp “Bạn không có quyền xem tệp này. [Thử lại]”** (`GET /api/file-objects/:id` = 403; người soạn/BGH/Văn thư 200) (ảnh 58) [T][D] | Người duyệt không đọc được thứ mình duyệt | T3 |
| 6 | Quyết định | Thí, Tường | [Đồng ý] (chính) [Cần bổ sung] [Xin ý kiến]; “Đồng ý” thực hiện ngay, không xác nhận, không Hoàn tác (ảnh 58–60) | Việc đã báo người trình và người duyệt kế tiếp, không đảo được | T5 |
| 7 | Sau duyệt | Hùng | “Phê duyệt: Đã phê duyệt — P.QLĐT Đồng ý, Lãnh đạo Đồng ý”; nhãn bảng **“Đã lập hồ sơ”**; “Nhiệm vụ: Chưa có · Tạo nhiệm vụ” (ảnh 61) | Nhãn “Đã lập hồ sơ” sai (không có hồ sơ nào); tờ trình dừng; không bước kế rõ | T4 |

### 4.4. Hồ sơ công việc

| # | Bước | Họ thấy | Gãy ở đâu | Mã |
|---|---|---|---|---|
| 1 | Vào `/dossiers` | EmptyState, **không có nút Tạo hồ sơ** (ảnh 70; mã ghi “nút tạo hồ sơ chưa làm” ở `dossier-registry-view.tsx:133`) | Không tạo được từ trang hồ sơ | H1 |
| 2 | Từ sổ: “Lưu hồ sơ…” | Hộp “Lưu trữ hồ sơ văn bản”: lời “Lập hồ sơ lưu trữ… đưa vào danh mục hồ sơ lưu trữ”, **không có ô chọn hồ sơ**, chỉ ô ghi chú (ảnh 71) | Văn bản thành FILED, nhãn “Đã lập hồ sơ”, **không tạo `DossierItem`** [M `document-batch-service.ts:103-121,178-186`]; sổ có hàng “Đã lập hồ sơ” trong khi `/dossiers` có 0 hồ sơ | H1, H2 |
| 3 | Chi tiết hồ sơ (tạo bằng API) | “Danh mục tài liệu (0) — Chưa có tài liệu nào trong hồ sơ.”, nút duy nhất “Đóng hồ sơ”; không “Thêm tài liệu” (ảnh 96) | Không thêm được tài liệu | H1 |
| 4 | “Đóng hồ sơ” | Hộp “Xác nhận đóng hồ sơ này?” [Hủy][Đồng ý] (ảnh 97) → lỗi đỏ “Không thể đóng hồ sơ rỗng chưa có tài liệu, văn bản” (ảnh 98; 400) | Nút luôn hiện dù chắc chắn thất bại; lỗi không chỉ cách sửa (vì không có cách) | H1, H4 |
| 5 | Chuỗi lưu trữ | Đánh dấu sẵn sàng → Nộp → Tiếp nhận → Hoàn tất | Cần `retentionRuleId` (web không gửi/không chọn) và có mục [M `dossier-service.ts:688,766,903`]; “Chấp nhận lưu trữ” nhảy thẳng ARCHIVED nên “Hoàn tất lưu trữ” không tới được; “Hủy hồ sơ” (xét hủy) **không xác nhận** [M `dossier-disposal-panel.tsx:166-168`] | H3, H5 |

Kết luận luồng: với hồ sơ tạo từ giao diện, chuỗi lưu trữ **không đi hết được**; chỉ hồ sơ có dữ liệu seed hoặc nhập ngoài UI mới đi hết. Sổ ghi “Đã lập hồ sơ” là nhãn trạng thái, không phải sự thật về hồ sơ.

### 4.5. Tra cứu, lọc, liên kết sâu, thông báo

| # | Tình huống | Quan sát | Mã |
|---|---|---|---|
| 1 | Mở `/documents` | “Sổ văn bản 26/27”: trộn đến + đi + tờ trình, không cột “Loại”, “Bước xử lý” dùng 10 chữ khác nhau (Đã lập hồ sơ, Hoàn thành, Đã phát hành, Đang xử lý, Chờ bút phê, Chờ phê duyệt, Nháp, Chờ duyệt, Chờ ký, Đã ký) (ảnh 40) [T] | S1 |
| 2 | Lọc | Mức khẩn · Trạng thái · Năm · Đơn vị chủ trì; thiếu Loại, Trễ hạn/Sắp tới hạn, khoảng ngày, Người soạn/ký, Nơi nhận, Độ mật, Hình thức (ảnh 41) [T] | S4 |
| 3 | Chọn nhiều | “Đã chọn 2/26 · Lưu hồ sơ · Sao chép liên kết · Xuất Excel · Bỏ chọn Esc”; không hành động nghiệp vụ; “Xuất Excel” xuất CSV [T][M] (ảnh 43) | S5 |
| 4 | Bấm bước trong luồng | Sau mỗi bước hàng biến khỏi bộ lọc đang xem; dòng “Văn bản đang xem nằm ngoài kết quả hiện tại” (ảnh 30) | S11 |
| 5 | Mở từ thông báo đẩy | Máy chủ tạo `linkHref=/documents?id=…` ở 3 nơi, web chỉ đọc `docId`; hộp thư trong app có sửa lại, thông báo đẩy (`sw.js:360`) mở nguyên văn nên sổ mở mà không mở Quick View [M, chưa chạy] | N3 |
| 6 | Điện thoại 390px | Danh sách thẻ hai dòng, chi tiết một cột, “‹ quay lại”, lưới nhãn–giá trị (ảnh 45–46) — **tốt**; chip trạng thái luôn icon + chữ | §6 |

## 5. Phát hiện theo thành phần

Cách đọc: **Mức** P0 = dữ liệu hoặc hành động sai, hoặc luồng gãy; P1 = cản trở hoàn thành thao tác hay gây hiểu nhầm; P2 = tinh chỉnh. **Loại**: nghiệp vụ / hành vi / số đo / a11y / nhất quán. Mọi mục là **mới** (chưa tìm thấy trong ADR-015, `document-workspace.md` §17 hay `task-document-gap-spec.md`) trừ khi ghi nguồn. “AC” là tiêu chí nghiệm thu của đề xuất, kiểm được bằng trình duyệt/test. Mọi đề xuất đều **chưa duyệt**.

### 5.1. Quick View và khối nút thao tác (văn bản đi)

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| Q1 | P0 · nghiệp vụ | Trưởng đơn vị cùng đơn vị với người soạn mở dự thảo → 403 “Văn bản nội bộ chỉ cho phép truy cập trong phạm vi đơn vị xử lý, lãnh đạo phụ trách hoặc người có liên quan trực tiếp”; truong_cntt cũng 403. Nguyên nhân: bảng `documents` không có cột đơn vị, văn bản đi có `leadUnitId = null`, nên truy cập INTERNAL chỉ còn người đăng ký, lãnh đạo, Văn thư. Trong khi `hybrid-authorization.ts:1529-1533` (`UNIT_LEADER_OUTGOING_REVIEW`) cấp cho trưởng đơn vị quyền duyệt nội dung: đọc và duyệt mâu thuẫn. [T ảnh 13–14][D][M `authorization/document-classification.ts`, `packages/db/prisma/schema.prisma` model `Document`] | Ghi đơn vị soạn lên văn bản đi (schema `CreateOutgoingDraftSchema` đã có `draftingDeptId`) và cho phép đọc với trưởng/phó đơn vị soạn và người được chỉ định duyệt/ký. **Cần quyết định phân quyền (§11 D5).** AC: trưởng P.QLĐT mở dự thảo của chuyên viên P.QLĐT được; trưởng Khoa CNTT vẫn 403; có test ranh giới theo đơn vị |
| Q2 | P0 · nghiệp vụ | Không chỉ định người duyệt: hộp trình nói “Trưởng đơn vị” nhưng `content_reviewer_id` trống; ai có quyền cũng duyệt được; thực tế chỉ Hiệu trưởng duyệt được (do Q1). iOffice chọn người xử lý chính/đồng xử lý khi chuyển [R14]; netLex hiện người phụ trách bước và “+N” [R3]. [T ảnh 08, 15–16][D][M] | Bước “Trình” chọn người duyệt (mặc định: trưởng đơn vị soạn) kèm lời nhắn tùy chọn; ghi `contentReviewerId`; hiển thị “Đang chờ <tên>”. AC: sau trình, Quick View của người soạn ghi “Đang chờ Lê Văn Thí duyệt nội dung” và người đó thấy văn bản trong “Chờ xử lý” |
| Q3 | P0 · hành vi | `OutgoingActionPanel` lấy nút theo trạng thái (`STATUS_ACTIONS[status]`, `outgoing-action-panel.tsx:109`), `currentUserId` bị bỏ (`_currentUserId` :98) và được truyền `""` (`document-workspace-parts.tsx:283,312`). Server đã tính `availableActions` (người soạn = `["document.read"]`) và web parse nhưng không dùng (`document-detail-client.ts:33-34`). Hệ quả: người soạn thấy “Phê duyệt nội dung” + “Yêu cầu chỉnh sửa” sau khi trình; Hiệu trưởng thấy “Xác nhận thể thức đạt”; Văn thư thấy “Ký chức danh”; bấm → hộp xác nhận → banner đỏ “Thao tác thất bại (403)”. Lý do thật (`detail` RFC 9457, ví dụ “Nhiệm vụ này thuộc thẩm quyền nghiệp vụ văn thư…”) bị che vì panel đọc `data.message` mà 5/7 route trả `detail` (`outgoing-action-panel.tsx:127`); mọi panel khác đã đọc `detail`. [T ảnh 10–11, 19, 21–22][D][M] | Chỉ hiện nút khi `availableActions` cho phép; thay cho người khác bằng một dòng “Đang chờ <vai trò/tên> <việc>” (mẫu “Assignee actions” so với “Process status” của netLex [R3]; DocuSign “Current/Waiting” [R6]). Dùng chung một hàm đọc lỗi (`detail` rồi `message`). AC: ở mỗi trạng thái, ma trận 5 người dùng chỉ hiện đúng nút của người đến lượt; không còn banner “Thao tác thất bại (4xx)” trần; test ma trận vai trò × trạng thái |
| Q4 | P0 · hành vi | Lý do trả lại: server lưu `contentReviewNotes = "[Trả lại]: …"` và trả trong `outgoingWorkflow`; `rg contentReviewNotes apps/web/src` = 0 kết quả. Người soạn mở lại thấy bản nháp “như mới”, không lý do, người trả, giờ (ảnh 93–94). `DOCUMENT_CONTENT_REJECTED` không handler nên cũng không thông báo. [T][D][M `outgoing-document-service.ts:560-606`] | Khối “Bị trả lại” ở đầu Quick View của người soạn: ai, khi nào, lý do; chip trạng thái “Cần sửa”; thông báo cho người soạn kèm lý do rút gọn. Sau khi trình lại, giữ lịch sử trả ở “Luân chuyển”. AC: reject với ghi chú → người soạn thấy đúng ghi chú và tên người trả mà không phải mở menu nào |
| Q5 | P1 · hành vi | Không có “Rút lại” cho văn bản đi (tờ trình có, ảnh 57). iOffice: sau trình chuyên viên không sửa/xóa nhưng có “Lấy lại” nếu người nhận chưa mở [R14]. | “Rút lại” khi người duyệt chưa quyết (dùng cơ chế `markApprovalOpened` của tờ trình hoặc kiểm `status = CONTENT_REVIEW` và chưa duyệt). AC: người soạn bấm Rút lại → về Nháp, người duyệt mất mục khỏi hàng đợi và được báo |
| Q6 | P1 · hành vi | Mọi bước dùng cùng một hộp: icon máy bay giấy, một câu mô tả, [Hủy][Xác nhận] (ảnh 08, 10, 21, 23, 25). NN/g: nêu hậu quả cụ thể, nút nói hành động, không dùng Yes/No [R7]. Xác nhận cho việc routine làm người dùng bấm theo thói quen [R7]. | Nội dung hộp theo bước, nêu đối tượng và hậu quả: “Gửi cho Lê Văn Thí duyệt nội dung”; “Cấp số 11/CĐKTCNQN-QLĐT, ngày 23/10/2026”; nút “Gửi duyệt”, “Cấp số”, “Đóng dấu”, “Phát hành tới 3 đơn vị”. Giữ xác nhận cho bước đã báo người khác hay không đảo được; không thêm Hoàn tác song song. AC: không còn nút “Xác nhận” trần trong luồng văn bản đi |
| Q7 | P1 · a11y | Banner xanh “… thành công.” nằm cố định trong thân Quick View (ảnh 09), không rõ khi nào biến mất; chưa kiểm `role`/live region. GOV.UK: banner thành công dùng tiêu đề “Success”, gỡ khi sang trang mới, `role=alert` chuyển focus [R4]; Material: thông báo không cướp focus, polite [R11]. [T][chưa kiểm aria] | Phản hồi ngay trên chính control (chip trạng thái đổi) cộng toast chung của app thay cho banner cố định; live region `polite`, không chuyển focus. AC: trình đọc màn hình đọc kết quả; banner không tồn tại sau khi đổi văn bản |
| Q8 | P1 · hành vi | Sau “Đóng dấu cơ quan” Quick View không đổi (không banner, trạng thái cũ, nút biến mất) tới khi khối nơi nhận tải xong vài giây sau; bước kế “Phát hành” nằm trong khối “Theo dõi nơi nhận”, không ở khu nút chính (ảnh 25–28). | Làm mới ngay sau mutation (cập nhật cục bộ từ phản hồi); đặt nút bước kế ở khu nút chính cho người đến lượt; khối “Theo dõi nơi nhận” chỉ để theo dõi. AC: sau đóng dấu, trạng thái và nút “Phát hành” đổi ngay từ phản hồi của lệnh (không đợi khối nơi nhận tải), không có khoảng trống không nút |
| Q9 | P1 · hành vi | Ở AUTHORIZED_SIGN hiện song song “Ký chức danh” và “Cấp số & ngày ban hành” (`outgoing-step-actions.ts:23-26`) dù cấp số chỉ hợp lệ sau ký (`outgoing-document-service.ts:933`) và do người khác làm (SoD); sau khi ký, “Ký chức danh” vẫn còn (409 khi bấm lại). [T ảnh 22][M] | Tách thành hai trạng thái hiển thị: “Chờ ký” → “Chờ cấp số” (dùng `authorizedSignedAt`); chỉ hiện nút của đúng bước. AC: sau ký không còn nút Ký |
| Q11 | P1 · nhất quán | Người nhận mở văn bản: header “Văn bản đi · 10”, banner “Văn bản đã phát hành · quy trình xử lý hoàn tất”, cột bước “Đã phát hành” — đúng với người gửi, sai với người nhận (ảnh 32, 34). | Quick View theo góc nhìn: người nhận thấy “Văn bản đến · từ <đơn vị gửi>”, trạng thái “Chờ tiếp nhận/Đã tiếp nhận”, nút “Tiếp nhận” ở khu nút chính. AC: ba chỗ (hàng, header, banner) cùng nói theo người xem |
| Q12 | P2 · nhất quán | “Số, ký hiệu” chỉ hiện “10” (thiếu ký hiệu) ở trạng thái đã cấp số (ảnh 24, 91); tiêu đề “Văn bản đi · 10”. | Hiện số đầy đủ `10/CĐKTCNQN-QLĐT` (cùng nguồn với bảng). AC: một chuỗi duy nhất ở bảng, header, in phiếu |
| Q13 | P1 · hành vi | Hộp “Sửa thông tin” cho sửa “Số / Ký hiệu” (`originalNumber` bắt buộc) nhưng PATCH cấm trường này → lỗi kỹ thuật “Các trường […] không được phép cập nhật qua generic PATCH…” [M `document-edit.tsx:92-113`, `documents/[id]/route.ts:152-184`; chưa chạy] | Bỏ ô cho loại không sửa được; nếu cần đổi số thì qua lệnh riêng của Văn thư (G3). AC: không ô nào gây lỗi 400 cố định |
| Q14 | P2 · hành vi | “Tạo nhiệm vụ” hiện không xét quyền sửa văn bản; tạo xong mới gắn bằng PATCH, nếu không đủ quyền thì “Đã tạo nhiệm vụ nhưng chưa gắn được” và “Gắn lại” lại thất bại [M `document-workspace-parts.tsx:364-412`; chưa chạy] | Kiểm `canEdit` trước khi hiện; hoặc gắn qua đường không cần quyền sửa metadata. AC: không còn nhiệm vụ mồ côi do gắn thất bại |

| Q15 | P1 · nghiệp vụ | Người soạn **sửa được nội dung sau khi trình**: nháp → trình (CONTENT_REVIEW) → `PATCH` trích yếu → 200, `canEdit = true`, người duyệt không được báo; thêm tệp dùng cùng `canUpdateDocument` (chưa thử). Người duyệt có thể duyệt một bản khác bản đã trình. iOffice: sau khi trình chuyên viên không sửa/xóa [R14]; công cụ duyệt khác khóa bản ghi khi chờ [R15]. [D] | Khóa nội dung và tệp khi CONTENT_REVIEW; muốn sửa thì “Rút lại” (Q5) rồi trình lại. AC: PATCH trích yếu/thêm tệp khi CONTENT_REVIEW bị từ chối bằng lý do tiếng Việt; sau Rút lại sửa được |

### 5.2. Stepper, trạng thái và lịch sử luân chuyển

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| P1 | P1 · nghiệp vụ | Stepper 7 bước **lệch một bước ở nửa sau**: `getStepState` coi bước “hiện tại” = bước có khóa bằng status. Khi status = ORGANIZATION_SIGNED, “Dấu cơ quan” hiện “Hiện tại” trong khi việc đã xong, còn “Phát hành” (việc kế) xám (ảnh 30); status ISSUED vẫn “Hiện tại” ở “Phát hành” với icon đồng hồ, không bao giờ hoàn tất; AUTHORIZED_SIGN trước và sau khi ký trông giống nhau vì `sign` không đổi status. [T][M `outgoing-workflow-stepper.tsx`] | “Hiện tại” = bước **chờ làm** (status → bước kế), bước xong có dấu tích; ISSUED = tất cả xong. Bảng ánh xạ trong §8.2. AC: test từng status → trạng thái từng bước |
| P2 | P1 · hành vi | Stepper không nói ai/khi nào dù component hỗ trợ (`getStepActorInfo`): Quick View chỉ truyền `{status, createdAt} as never` (`document-workspace-parts.tsx:237`). Chỉ “Dự thảo” có giờ. NN/g: giữ các cập nhật trước kèm ngày [R1]; iOffice có “Xem luồng xử lý” và “Lịch sử thao tác” ngay trên chi tiết [R14]. [T ảnh 18, 30] | Truyền workflow thật (người, thời điểm, ghi chú) vào stepper; tooltip/hàng phụ dưới mỗi bước đã xong. AC: mỗi bước xong hiện tên người và giờ |
| P3 | P1 · nhất quán | Chip trạng thái gộp: CONTENT_REVIEW và FORMAT_CHECK đều “Chờ duyệt”; NUMBERED và ORGANIZATION_SIGNED đều “Đã ký”; AUTHORIZED_SIGN “Chờ ký” kể cả sau khi đã ký. Không có chip “Cần sửa” sau trả lại. [T ảnh 17–24] | Chip nói **đang chờ ai làm gì**: Nháp · Cần sửa · Chờ duyệt nội dung · Chờ kiểm thể thức · Chờ ký · Chờ cấp số · Chờ đóng dấu · Chờ phát hành · Đã phát hành (§8.2). Giữ icon + chữ (không chỉ màu). AC: 11 trạng thái có chip khác nhau |
| P4 | P2 · hành vi | Stepper nằm trong mục thu gọn “Chi tiết và luân chuyển” (ảnh 18) nên người soạn không thấy văn bản đang ở đâu nếu không mở mục. | Dòng một dòng “Đang chờ Văn thư kiểm thể thức · từ 09:12” dưới trạng thái; stepper đầy đủ vẫn trong mục thu gọn. AC: không cần mở mục để biết đang chờ ai |
| P5 | P2 · nhất quán | API `audit-logs` dựng dòng thời gian 5 bước **Format → Content → Sign → Issue** (`document-audit-timeline.ts:212`), ngược máy trạng thái (Content → Format); nhãn hành động thiếu cho `DOCUMENT_CONTENT_REJECTED`, `CONTENT_REVIEW_REQUESTED`, `AUTHORIZED_SIGNED`, `NUMBERED`, `ORGANIZATION_SIGNED` nên trả khóa thô; `notes` không đọc `contentReviewNotes`. Hiện **không hiển thị** cho văn bản đi (Quick View dùng stepper), chỉ cho tờ trình/văn bản cũ. [D][M] | Một nguồn duy nhất cho “luồng xử lý” văn bản đi dựng từ audit log có người/giờ/ghi chú, nhãn tiếng Việt đầy đủ; xóa dựng 5 bước sai. AC: test mọi `eventType` outbox của văn bản có nhãn |

### 5.3. Ký, cấp số, đóng dấu

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| G1 | P0 · nghiệp vụ, trung thực | **Ký số là giả.** `signDocument` ghi `verificationStatus = VALID`; `certificateMetadata` lấy từ client, thiếu thì điền `{provider: "Ban Cơ yếu Chính phủ", status: "VALID"}` (`outgoing-document-service.ts:839-855`); chữ ký cơ quan điền cứng CA (:1127-1144); ký nháy ghi `VALID` (`outgoing-initial-sign.ts:84-86`). Hộp ký không có chứng thư/PIN/token, tệp không đổi (ảnh 21–22). `digital-signature-service.ts` ở web mô phỏng VGCA bằng `Math.random`. Phần trung thực duy nhất là `UnverifiedSignatureVerifier` cho tệp đến. [T][D][M] | Tạm thời (trước quyết định §11 D1): gọi đúng tên “Xác nhận ký” và ghi “Chưa ký số bằng chứng thư”, không ghi nhà cung cấp CA khi không có; dọn mô phỏng ở web. Khi có quyết định chữ ký thật thì làm theo đó. AC: không bản ghi `VALID` nào không có chứng thư; không chuỗi “Ban Cơ yếu Chính phủ” gán cứng |
| G2 | P0 · nghiệp vụ | Số, ký hiệu luôn là `n/QĐ-CĐKTCNQN`: `notation = input.codeNotation \|\| "QĐ-CĐKTCNQN"` (`outgoing-document-service.ts:1013`), web gửi `{}`. Bản nháp tạo qua API không gửi `category` được lưu “Quyết định”. Một **Công văn** nhận `10/QĐ-CĐKTCNQN` (DB `qcet_audit`, bản ghi `cmvkidm7l0001vik1s1aa4107`). NĐ 30/2020 Điều 8.3.b: ký hiệu công văn = viết tắt cơ quan + viết tắt đơn vị soạn thảo hoặc lĩnh vực (ví dụ `234/SYT-VP`); văn bản có tên loại = viết tắt loại + viết tắt cơ quan (Phụ lục III: QĐ, TTr, KH, BC, TB…); chữ viết tắt do người đứng đầu quy định [R12]. [T ảnh 23–24][D][M] | Sinh ký hiệu theo loại văn bản (bảng Phụ lục III) + viết tắt cơ quan/đơn vị cấu hình; cho Văn thư xem trước và sửa trước khi cấp (iOffice: số tự sinh theo sổ nhưng sửa được [R14]). **Cần bảng viết tắt từ chủ sở hữu và quyết định dùng chung dãy số với VNPT (§11 D6).** AC: công văn của P.QLĐT → `…/CĐKTCNQN-QLĐT` (tên viết tắt do chủ sở hữu cung cấp); mỗi loại một mẫu; test bảng loại → ký hiệu |
| G3 | P1 · hành vi | Hộp “Cấp số & ngày ban hành” nói “xác nhận ngày ban hành” nhưng không có ô ngày, không xem trước số; route nhận `outgoingNumberStr`, `codeNotation`, `issuedDate`, `securityLevel`, `urgency` nhưng UI luôn gửi `{}` (`outgoing-action-panel.tsx`, `assign-number/route.ts`). NĐ 30 Điều 15: số theo thứ tự thời gian, liên tục 01/01–31/12, duy nhất trong năm; văn bản điện tử cấp số bằng chức năng hệ thống, giấy cấp sau khi có chữ ký [R13]. Thứ tự ký → cấp số của QCET khớp Điều 15.2. | Hộp có: “Số sẽ cấp” (xem trước), ngày ban hành (mặc định hôm nay, sửa được), ký hiệu (G2). AC: số xem trước bằng số cấp thật; ngày hiển thị khớp ngày ghi |
| G4 | P2 · nghiệp vụ | `DigitalSignatureDialog` (mở từ “Xem chữ ký số”) chạy ở client, không gọi API; `currentUser` không được truyền nên người ký mặc định cố định “TS. Nguyễn Văn Hùng / Hiệu trưởng” [M `digital-signature-dialog.tsx:65-70,124-143`, `document-registry-view.tsx:538-544`; chưa chạy trình duyệt] | Xóa hộp mô phỏng hoặc nối vào G1 sau quyết định. AC: không còn đường tạo “chữ ký” không lưu |
| G5 | P1 · hành vi | **Ký nháy khóa luôn bản nháp.** `isDocumentImmutable` đúng khi có bất kỳ `SignatureRecord` (`state-machine.ts:394`); trả lại chỉ đặt bản ghi cũ REVOKED (`outgoing-document-service.ts:1353-1362`). Tái hiện: nháp → trình → Hiệu trưởng ký nháy → trả lại → người soạn sửa trích yếu → **400 `IMMUTABLE_DOCUMENT`**, văn bản vẫn Nháp. [D] | `isDocumentImmutable` bỏ qua chữ ký ký nháy và bản ghi REVOKED khi status = DRAFT. AC: bản nháp bị trả lại sửa được; test trên đúng chuỗi trên |
| G6 | P2 · hành vi | `organization-sign` nhận `notes` nhưng `organizationSign` bỏ (`actions/organization-sign/route.ts:7,17`); UI không có ô ghi chú ký. | Bỏ trường thừa hoặc lưu ghi chú; thống nhất `notes`/`signingNotes`. AC: không trường nhận mà bỏ lặng lẽ |

### 5.4. Nơi nhận, phát hành, tiếp nhận, thu hồi

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| R1 | P1 · hành vi | “Tiếp nhận” là nút ghost cỡ xs (78×28, chữ 12px, đo bằng DOM) nằm cuối dòng đơn vị trong khối “Theo dõi nơi nhận”, không phải nút chính; sau bấm chỉ đổi thành “Đã nhận 23/10/2026”, không toast. Sau đó **hết bước** (ngõ cụt) — phần việc sau tiếp nhận ADR-015 để sau. [T ảnh 34–35] | Đặt “Tiếp nhận văn bản” ở khu nút chính cho trưởng đơn vị nhận (mẫu “Assignee actions đứng đầu” [R3]); sau tiếp nhận hiện dòng “Đã tiếp nhận bởi <tên>, <giờ>”; nội dung bước kế chờ §11 D4. AC: người nhận thấy đúng một nút chính, không cần cuộn tới khối nơi nhận |
| R2 | P1 · nghiệp vụ | Server cho **phát hành không nơi nhận** (`recipientRows` chỉ tạo khi có; mặc định chuỗi “Nội bộ và các đơn vị liên quan”, `outgoing-document-service.ts:1236-1244`); UI ép chọn ≥1 (`outgoing-recipients-panel.tsx:101-105`). Đơn vị không có trưởng → handler trả `skipped` (`document-notification-handlers.ts:192-197`): văn bản “Đã phát hành” mà không ai biết. Không có API thêm nơi nhận sau phát hành (route chỉ GET). | Chặn ở server (ít nhất một nơi nhận hợp lệ); khi đơn vị nhận không có trưởng, báo cho Văn thư tại bước phát hành (“Đơn vị X chưa có trưởng, sẽ báo cho phó/Văn thư”); cho thêm nơi nhận sau phát hành. AC: phát hành rỗng bị từ chối với lý do tiếng Việt |
| R3 | P1 · hành vi | Bộ chọn nơi nhận: 18 checkbox phẳng trong khung cao 160px (cuộn lồng trong cuộn pane), không ô tìm, không nhóm Khoa/Phòng/Trung tâm, không “Toàn trường”, gồm cả đơn vị của người gửi (ảnh 30). Hộp “Trình duyệt tờ trình” cùng module đã có ô tìm, hàng khóa “Đơn vị của bạn”, chân tóm tắt (ảnh 56). | Dùng lại bộ chọn của “Trình duyệt tờ trình”; thêm nhóm theo loại đơn vị, “Chọn tất cả”, ẩn/đánh dấu đơn vị người gửi; Gmail/Outlook-kiểu chip khi đã chọn nhiều. AC: tìm “CNTT” ra một đơn vị; số đã chọn hiện ở nút “Phát hành tới N đơn vị” |
| R4 | P1 · hành vi | Dòng “Chỉ thu hồi được văn bản đã phát hành và chưa lưu trữ, chưa thu hồi.” (`recallBlockedReason`) hiện ngay lúc chuẩn bị phát hành (ảnh 30); “Phát hành” không xác nhận nêu cụ thể gửi ai (xem Q6). | Chỉ hiện lý do thu hồi sau phát hành; hộp xác nhận “Phát hành tới Khoa CNTT, Phòng TCKT?” liệt kê đơn vị. AC: không câu chữ về thu hồi trước phát hành |
| R5 | P1 · nghiệp vụ | `confirmReceipt` chỉ ghi `receivedAt/receivedById` + audit, **không phát sự kiện** (`outgoing-recipients.ts:194`): Văn thư và người soạn không biết ai đã nhận; không hạn tiếp nhận, không nhắc “chưa tiếp nhận”. DocuSign có Resend cho người đang đến lượt [R6]. | Thông báo gộp cho người phát hành/soạn (“2/3 đơn vị đã tiếp nhận”); nút “Nhắc” cho Văn thư với đơn vị chưa nhận (P2). AC: sau tiếp nhận, người soạn nhận thông báo |
| R6 | P2 · hành vi | “Thu hồi” là chữ đỏ không viền (ảnh 31); thu hồi chỉ được khi chưa ai tiếp nhận (`recall-rules.ts:10-18`) nhưng UI không nói điều kiện khi bị chặn ngoài dòng R4. | Hiện lý do bị chặn dạng tooltip/dòng phụ khi nút vô hiệu. AC: lý do hiện đúng lúc |
| R7 | P2 · nghiệp vụ | Thông báo phát hành/tiếp nhận chỉ đến **trưởng** đơn vị ACTIVE (`document-notification-handlers.ts:23-30`); trưởng vắng không có người thay, phó hoặc người được ủy quyền không tiếp nhận được (`outgoing-recipients.ts:100-109`). | Theo quy tắc ủy quyền sẵn có của QCET (chưa kiểm phạm vi): báo cả người được ủy quyền. **Phụ thuộc §11 D4.** |

### 5.5. Hộp Soạn văn bản đi

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| C1 | P1 · hành vi | Không chọn người duyệt, người ký, nơi nhận lúc soạn; chip chỉ có Hình thức/Độ khẩn/Độ mật/Hạn (ảnh 02–03). Schema đã có `authorizedSignerId`, `recipientList` (`CreateOutgoingDraftSchema`) nhưng UI không dùng. Nơi nhận chỉ được chọn lúc phát hành do Văn thư (ADR-015, không đổi ở đây). | Người ký chọn lúc soạn hoặc lúc trình (chip “Người ký”, mặc định trống); người duyệt chọn ở bước trình (Q2). Nơi nhận dự kiến là ghi chú cho Văn thư, không ràng buộc. Không thêm chữ thường trực (quy tắc “nhiều thông tin rác”). AC: chip “Người ký” dùng bộ chọn người chung; không placeholder ví dụ |
| C2 | P1 · hành vi | Tệp lỗi khi lưu nháp: hộp hiện “Đã lưu bản nháp nhưng còn tệp chưa đính kèm được: Internal server error Mở văn bản và dùng ‘Thêm tệp’.”, chuyển sang trạng thái mờ chỉ còn nút Đóng, Quick View của bản nháp đã mở sẵn phía sau (ảnh 04). Lỗi tiếng Anh thô; không nêu tệp nào; không “Thử lại”. GOV.UK có câu lỗi chuẩn từng loại: sai loại, quá lớn, rỗng, virus, “could not be uploaded — try again” và trạng thái Uploading/Uploaded từng tệp với live region “X of Y files uploaded” [R5, R9]. | Lỗi theo từng tệp, câu tiếng Việt theo bảng GOV.UK (sai loại, vượt dung lượng, tệp rỗng, nhiễm virus, lỗi tạm thời → “Thử lại”); chip trạng thái từng tệp; không đóng hộp khi còn tệp lỗi, hoặc đóng và để Quick View hiện danh sách lỗi có nút thử lại. AC: ép lỗi từng loại, thông báo đúng loại, tệp lỗi thử lại được mà không tạo bản nháp thứ hai |
| C3 | P1 · nghiệp vụ | Trình duyệt nội dung được khi **chưa có tệp dự thảo nào** (API 200 với bản nháp không tệp; ảnh 93 hiện “Chưa có tệp đính kèm” kèm nút “Trình phê duyệt nội dung”) và khi chỉ có phụ lục [D][T]. Tệp đầu tiên tải lên mặc định là bản gốc nên lỗi lần 1 làm phụ lục thành “bản gốc” (ảnh 07). | Bấm “Trình” khi thiếu tệp: báo dưới nút + đưa tới “Thêm tệp” (không `disabled`, theo quy tắc hộp thoại); cho đánh dấu một tệp là “Bản dự thảo”. AC: server từ chối trình khi không có tệp dự thảo, với lý do tiếng Việt |
| C4 | P2 · số đo | Tiêu đề 24px ngắt dòng ở dấu gạch nối (“2026-” / “2027”) (ảnh 03). | Dùng gạch nối không ngắt (U+2011) hoặc `text-wrap: pretty` cho `Input variant="title"`. AC: “2026-2027” không bị tách |
| C5 | P2 · hành vi | Hàng tệp chỉ có tên và dung lượng; chưa thấy nút gỡ tệp trước khi lưu (ảnh 03) — chưa kiểm hover/focus. | Nút gỡ hiện khi focus và trên cảm ứng như `TableRowActions`. AC: gỡ được bằng bàn phím |
| C6 | P2 · nhất quán | Quick View bản nháp hiện “Ban hành 23/10/2026” (ảnh 05) dù chưa phát hành; nhãn sai nghĩa. | Ẩn “Ban hành” khi nháp, hoặc nhãn “Tạo lúc”. AC: nhãn đúng nghĩa ở mọi trạng thái |
| C7 | P2 · hành vi | Menu ⋯ của nháp: Hỏi Trợ lý · Sửa thông tin · Thêm tệp · In phiếu văn bản (ảnh 06). Không “Xóa nháp” (route `DELETE /documents/[id]` có, UI không), không “Nhân bản”. “Thêm tệp” mở thẳng bộ chọn của hệ điều hành, không tiến trình/toast. | “Xóa nháp” **với Hoàn tác** (một mục, kết quả hiện ngay, theo quy tắc xác nhận/Hoàn tác); “Thêm tệp” hiện chip trạng thái từng tệp (C2). AC: xóa nháp hoàn tác được trong thời gian toast |
| C8 | P2 · hành vi | Chưa có “Lưu và gửi duyệt” một bước (đã ghi ở bộ nhớ dự án là chưa làm); Gmail/Outlook gộp soạn → gửi. | Tùy chọn sau khi Q2 xong: nút chính “Gửi duyệt” cạnh “Lưu bản nháp”. **Không thuộc đợt đầu.** |

### 5.6. Sổ văn bản (bảng, bộ lọc, hàng loạt, hàng đợi)

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| S1 | P1 · nhất quán | `/documents` mặc định “Sổ văn bản 26” trộn đến + đi + tờ trình; không cột “Loại”; sidebar **không đánh dấu mục nào** khi ở đường dẫn này (ảnh 40); “Bước xử lý” dùng 10 chữ khác nhau. Điện thoại có chip nhóm “Tất cả ▾” (ảnh 45), desktop không. | Cột “Loại” (icon + chữ) hoặc chip nhóm như điện thoại; sidebar đánh dấu “Văn bản” khi ở sổ tất cả; “Bước xử lý” theo ma trận chip §8.2. AC: mọi hàng nêu loại; có mục sidebar sáng |
| S2 | P1 · nhất quán | Bảng văn bản đi dùng cột của văn bản đến: “Cơ quan ban hành” luôn là chính trường, “Chủ trì” trống, “Hạn xử lý” cho nháp, “Ngày ban hành” cho bản đang chờ duyệt (ảnh 15, 32). Thiếu Người soạn/Đơn vị soạn, Người ký, Nơi nhận. | Bộ cột theo loại sổ qua cơ chế `visibleColumns` sẵn có: sổ đi = Văn bản · Người soạn (đơn vị) · Đang chờ · Người ký · Ngày; sổ đến = Văn bản · Đơn vị gửi · Chờ tiếp nhận · Ngày nhận. AC: không cột nào luôn trống ở một loại sổ |
| S3 | P0 · nghiệp vụ | “Chờ xử lý” tính theo **trạng thái** (`OUTGOING_PENDING = DRAFT, CONTENT_REVIEW, FORMAT_CHECK, AUTHORIZED_SIGN`, `document-bucket-where.ts`), không theo “tới lượt tôi”; `OUTGOING_DONE = NUMBERED, ORGANIZATION_SIGNED` nên văn bản **rời khỏi “Chờ xử lý” của Văn thư** khi còn phải đóng dấu và phát hành; Hiệu trưởng thấy nháp của người khác trong “Chờ xử lý” (DRAFT-2026-1) (ảnh 15); sidebar không dấu hiệu việc chờ. Mẫu: tab “Chờ bạn / Bạn đã gửi / Đã quyết định” [R15]; DocuSign “Action Required / Waiting for Others” [R6]. [T][M] | Định nghĩa lại theo người đến lượt (§8.1): “Chờ xử lý” = đang chờ tôi; “Đã xử lý” = tôi đã làm, đang ở người khác (kèm chip “Chờ <ai>”). Dấu chấm 6px ở mục sidebar khi có việc (như nút Hộp thư), không badge số. **Đổi nghĩa mục sidebar: cần duyệt (§11 D8).** AC: Văn thư thấy văn bản ở NUMBERED/ORG_SIGNED trong “Chờ xử lý”; Hiệu trưởng không thấy nháp người khác |
| S4 | P1 · hành vi | Bộ lọc chỉ có Mức khẩn · Trạng thái · Năm · Đơn vị chủ trì (ảnh 41). Thiếu Loại, Trễ hạn/Sắp tới hạn, khoảng ngày, Người soạn, Người ký, Nơi nhận, Độ mật, Hình thức. | Thêm theo `ListToolbarFilterPopover`, ưu tiên: Loại, Trễ hạn, Người soạn, Nơi nhận. AC: lọc “Nơi nhận = Khoa CNTT” ra đúng văn bản |
| S5 | P2 · nhất quán | Thanh hàng loạt “Đã chọn 2/26 · Lưu hồ sơ · Sao chép liên kết · Xuất Excel · Bỏ chọn Esc” (ảnh 43); thanh phủ lên hàng cuối; “Xuất Excel” tự sinh **CSV** (`document-bulk-toolbar.tsx:326-331`) trong khi báo cáo duyệt “Xuất Excel” ra `.xlsx`. “Lưu hồ sơ…” hiện cho tờ trình dù batch từ chối `UNSUPPORTED_DOCUMENT_TYPE` (`document-batch-service.ts:58-60`). | Gọi đúng tên “Xuất CSV” hoặc dùng route Excel thật (`GET/POST /documents/export-excel` đã có, không dùng); ẩn “Lưu hồ sơ” với loại không hỗ trợ; chừa chỗ cho thanh hàng loạt. AC: nhãn đúng định dạng tệp tải |
| S6 | P2 · hành vi | Menu ⋯ hàng: Xem nhanh · Lưu hồ sơ… · Sao chép liên kết · Sao chép số, ký hiệu · Hỏi Trợ lý (ảnh 44); không hành động nghiệp vụ của bước (Trình, Duyệt, Phát hành, Tiếp nhận). Nhãn nút icon tốt (“Thao tác văn bản <số>”). | Thêm “việc chính của bước” đầu menu khi người dùng đang đến lượt (cùng lệnh với Quick View). AC: một lệnh duy nhất, hai chỗ gọi |
| S9 | P1 · nhất quán | Với đơn vị nhận, cột “Bước xử lý” hiện “Đã phát hành” (trạng thái của người gửi) (ảnh 32) thay vì “Chờ tiếp nhận/Đã tiếp nhận” của họ. Trống “Văn bản đến › Chờ xử lý” viết đúng theo ADR-015 (ảnh 80) — giữ. | Chip theo góc nhìn người xem (§8.2). AC: hàng của đơn vị nhận không bao giờ ghi “Đã phát hành” khi chưa tiếp nhận |
| S11 | P2 · hành vi | Sau mỗi bước hàng biến khỏi bộ lọc đang xem, thay bằng dòng “Văn bản đang xem nằm ngoài kết quả hiện tại” (ảnh 30); người làm nhiều bước liên tiếp (Văn thư: thể thức → cấp số → đóng dấu → phát hành) mất chỗ trong danh sách. | Giữ hàng đang mở cho tới khi đóng Quick View; hoặc tự chuyển sang hàng kế cùng hàng đợi như triage. AC: làm 4 bước liên tiếp không phải tìm lại văn bản |

### 5.7. Tệp và trình xem

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| F1 | P2 · hành vi | Trong lúc tải, trình xem hiện chữ “Đang tải trình xem tệp…” (ảnh 16), không skeleton (quy tắc khung giữ chỗ). | Skeleton theo hình trang tệp. AC: không còn chữ đơn trong vùng tải |
| F2 | P2 · số đo | Tay “Xem tệp <tên>” trên thanh trượt trang đo **32×16 px** (`getBoundingClientRect`); các nút còn lại của thanh công cụ 32×32, ô chọn hàng 24×24, nút hành động 28×28. WCAG 2.2 SC 2.5.8 đòi ≥ 24×24 trừ ngoại lệ khoảng cách (vòng tròn 24px không giao mục tiêu khác) [R10]. [T] | Kiểm ngoại lệ khoảng cách cho tay 32×16; nếu không đạt thì cao ≥ 24px hoặc cách các mục tiêu lân cận. AC: không mục tiêu con trỏ nào < 24 mà không đạt ngoại lệ |
| F3 | P1 · nghiệp vụ | Trình xem docx hoạt động (ảnh 91, **tốt**); người duyệt tờ trình bị chặn tệp 403 (T3). | Xem T3. |
| F4 | P2 · hành vi | Không có khái niệm “bản chính dự thảo” so với phụ lục (C3); thứ tự tệp là thứ tự tải lên. | Đánh dấu bản dự thảo; sắp xếp bản chính lên đầu. |

### 5.8. Thông báo và nhắc việc

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| N1 | P0 · nghiệp vụ | **Im lặng.** 9/11 loại sự kiện outbox của văn bản đi không có handler: `DOCUMENT_DRAFT_CREATED`, `CONTENT_REVIEW_REQUESTED`, `CONTENT_APPROVED`, `CONTENT_REJECTED`, `FORMAT_APPROVED`, `AUTHORIZED_SIGNED`, `NUMBERED`, `ORGANIZATION_SIGNED`, `REVISION_CREATED`; chỉ `ISSUED` và `RECALLED` có. `processOutboxBatch` chỉ lấy sự kiện có handler (`packages/db/src/outbox.ts:570-603`) nên chúng **PENDING mãi** (`qcet_audit`: 14/16 sự kiện còn PENDING sau khi chạy tay một vòng) [D][M]. Hồ sơ: `DOSSIER_CREATED`, `CLOSED`, `SUBMITTED_ARCHIVE`, `ACCEPTED_ARCHIVE` không handler; chỉ `DISPOSAL_PROPOSED/DECIDED` có. Người soạn không biết bị trả, người ký không biết thể thức đã đạt, Văn thư không biết đã ký để cấp số. Hộp thư của người duyệt không có mục văn bản (ảnh 12). | Bảng “ai cần biết gì” ở §8.3; handler mới; **test kiến trúc**: mọi `eventType` được `publishOutboxEvent` phải có handler hoặc nằm trong danh sách được ghi lý do bỏ qua. AC: mỗi dòng bảng §8.3 có test; không `eventType` nào PENDING mãi |
| N2 | P1 · nhất quán | Thông báo phát hành “Có văn bản gửi đến đơn vị bạn” (ảnh 33): không nêu đơn vị gửi, độ khẩn, trích yếu đầy đủ; không nút hành động; chỉ trưởng đơn vị nhận ACTIVE; đơn vị không trưởng → `skipped`. NN/g: thông báo đẩy nên có chi tiết hoặc link tới tracker [R1]. | “<Đơn vị gửi> gửi: <trích yếu> · Khẩn”; nút “Mở văn bản” (đã có) + “Tiếp nhận” nếu người nhận đúng quyền. AC: nội dung thông báo đủ để quyết định mở hay chưa |
| N3 | P2 · hành vi | Máy chủ tạo `linkHref=/documents?id=…` ở `push-service.ts:389`, `document-notification-handlers.ts:50`, `document-deadline-scanner.ts:305`; web chỉ đọc `docId` (`document-pane-history.ts:14`); hộp thư trong app có vá (`notification-inbox.ts:147-151`) nhưng thông báo đẩy mở nguyên văn (`public/sw.js:360`). [M, chưa chạy] | Một tên tham số (`docId`) ở mọi chỗ; hoặc web chấp nhận cả `id`. AC: bấm thông báo đẩy mở đúng Quick View |
| N4 | P1 · nghiệp vụ | Bộ quét hạn văn bản (`document-deadline-scanner.ts`) chỉ chạy qua `GET /api/cron/document-deadline-check` do `vercel.json` gọi; vòng worker không gọi (`outbox-worker.ts:83-115`). Nếu production là docker-compose (không Vercel) thì không ai nhắc trễ hạn văn bản; người nhận dự phòng là tối đa 5 người BGH/Văn thư không sắp xếp (`take: 5`). [M; production chưa kiểm] | Gọi quét trong chu kỳ worker hoặc có cron bên ngoài được ghi vào tài liệu vận hành. AC: có chứng cứ lịch chạy ở môi trường triển khai |
| N5 | P2 · nghiệp vụ | Không có nhắc cho: duyệt quá 48 giờ (chỉ dùng trong báo cáo), chưa tiếp nhận sau phát hành. | Sau N1: nhắc theo ngưỡng cấu hình; không làm trong đợt đầu. |

### 5.9. Tờ trình nội bộ

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| T1 | P1 · nhất quán | Hai hệ trạng thái trên một tờ trình: nhãn “Chờ bút phê” (luồng văn bản đến cũ) + chuỗi “Tiếp nhận & Vào sổ → Trình Ban Giám hiệu → …” song song với “Phê duyệt: Nháp [Trình duyệt]” (ảnh 54–55). Bốn con số cho một văn bản. [T] | “Bước xử lý” và mục “Luân chuyển” của tờ trình chỉ theo luồng phê duyệt tờ trình (Nháp → Chờ trưởng đơn vị → Chờ lãnh đạo → Đã phê duyệt/Cần bổ sung/Không phê duyệt); bỏ chuỗi văn bản đến; một số hiệu hiển thị. AC: không từ vựng văn bản đến ở tờ trình |
| T2 | P1 · hành vi | Hộp tạo khung cũ (không phải khung compose); “Số, ký hiệu” bắt buộc với lỗi “Vui lòng nhập Số ký hiệu văn bản gốc.” trong khi đây là văn bản nội bộ do chính người soạn gõ số tay (giá trị rác như `12r1r1r` có trong dữ liệu dev), hệ thống chỉ cấp số nội bộ “Số 0006”; placeholder dạng ví dụ (“VD: 125/TCGDNN-VP”); dòng cố định “PDF hoặc Word, tối đa 10MB”; Đơn vị đề xuất không mặc định đơn vị người soạn, 18 đơn vị không ô tìm (ảnh 51–53). | Chuyển sang khung compose của hộp Soạn văn bản đi; ô số/ký hiệu thành tùy chọn, để trống thì hệ thống cấp `n/TTr-<viết tắt đơn vị>` theo dãy riêng của tờ trình; placeholder chỉ là tên ô; ràng buộc tệp nằm ở chỗ chọn tệp và trong lỗi; đơn vị mặc định = đơn vị người soạn. AC: hộp đo đúng số đo khung compose; không ô nhập nào thừa |
| T3 | P0 · nghiệp vụ | Trưởng đơn vị được giao duyệt **không mở được tệp**: “Bạn không có quyền xem tệp này. [Thử lại]” (`GET /api/file-objects/:id` = 403 “Bạn không có quyền truy cập tệp này”; người soạn/BGH/Văn thư 200) (ảnh 58). Người duyệt không đọc được thứ mình duyệt. [T][D] | Quyền đọc tệp theo quan hệ văn bản: người có bước duyệt (đang chờ hoặc đã quyết) đọc được tệp của tờ trình. Cùng gốc với Q1: truy cập INTERNAL thiếu quan hệ đơn vị. AC: người có bước duyệt mở được tệp, người ngoài luồng vẫn 403; test ranh giới |
| T4 | P1 · nghiệp vụ | Sau khi duyệt xong: nhãn bảng **“Đã lập hồ sơ”** (không có hồ sơ nào), “Nhiệm vụ: Chưa có · Tạo nhiệm vụ”, tờ trình dừng; không sinh văn bản đi/nhiệm vụ/hồ sơ [D][M `submission-approval-service.ts:232-331`] (ảnh 61). [gap-spec V-06: “Sau phê duyệt: tạo nhiệm vụ liên kết bằng một nút; tờ trình vào hồ sơ” — đề xuất chưa duyệt] | Nhãn đúng “Đã phê duyệt”; bước kế do chủ sở hữu quyết (§11 D2). Cho tới lúc đó chỉ sửa nhãn. AC: không nhãn “Đã lập hồ sơ” khi không có `DossierItem` |
| T5 | P1 · hành vi | “Đồng ý” chạy ngay, không xác nhận/Hoàn tác (ảnh 58–60) trong khi việc đã báo người trình và người duyệt tiếp theo. Quy tắc: đã báo người khác thì xác nhận (không dùng cả hai). NN/g: xác nhận cụ thể, nút nêu hành động [R7]. | Hộp “Đồng ý tờ trình ‘…’ và chuyển lãnh đạo?” [Đồng ý][Quay lại]. AC: không quyết định nào chạy khi bấm lần đầu mà không xác nhận |
| T6 | P2 · nhất quán | Danh sách trống có cả hộp gợi ý nổi “Soạn tờ trình đầu tiên” lẫn EmptyState trùng nội dung (ảnh 50). | Giữ một: `EmptyState` có nút. |
| T7 | P2 · nhất quán | Quyết định tờ trình: Đồng ý / Cần bổ sung / Không phê duyệt; văn bản đi: Phê duyệt nội dung / Yêu cầu chỉnh sửa (ảnh 16, 58). | Chọn một bộ từ (§11 D7). |
| T8 | P2 · nhất quán | Trang Báo cáo thời gian duyệt (ảnh 100): ô lọc ngày hiện placeholder `dd/mm/yyyy` trong khi tóm tắt nói “25/07/2026 – 23/10/2026” (khoảng mặc định không hiện trên ô); ba tên cho một trang (menu “Báo cáo thời gian duyệt”, tiêu đề tab “Báo cáo duyệt tờ trình”, tiêu đề trang “Báo cáo thời gian duyệt tờ trình”); hàng không liên kết tới tờ trình. Skeleton khi tải (ảnh 99) **tốt**. | Điền khoảng mặc định vào ô; một tên; hàng liên kết tới danh sách tờ trình theo đơn vị/người. AC: ô lọc phản ánh khoảng đang áp dụng |

### 5.10. Hồ sơ công việc

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| H1 | P0 · hành vi | Không tạo được hồ sơ từ `/dossiers` (mã ghi “nút tạo hồ sơ chưa làm” `dossier-registry-view.tsx:133`), không thêm/xem/gỡ mục (`POST/GET/DELETE /dossiers/[id]/items` không có nơi gọi), chi tiết hồ sơ trống chỉ có “Đóng hồ sơ” (ảnh 70, 96). Nơi duy nhất tạo hồ sơ trong UI là ô nhanh của luồng văn bản đến cũ (`incoming-workflow-sections.tsx:181`). [T][M] | Nút “Tạo hồ sơ” ở header (`ListPageCreateButton`); “Thêm tài liệu” ở chi tiết (chọn văn bản/nhiệm vụ/tệp); bộ chọn Bảng thời hạn bảo quản khi đánh dấu sẵn sàng lưu trữ. AC: đi hết chuỗi Tạo → Thêm → Đóng → Sẵn sàng → Nộp → Tiếp nhận từ giao diện |
| H2 | P1 · nghiệp vụ, trung thực | “Lưu hồ sơ” (hàng/hàng loạt/Quick View) chuyển văn bản sang FILED và nhãn “Đã lập hồ sơ” nhưng **không tạo `DossierItem`** (payload không có `dossierId`; `document-batch-service.ts:103-121,178-186`); hộp nói “đưa vào danh mục hồ sơ lưu trữ” (ảnh 71). Sổ có hàng “Đã lập hồ sơ” khi `/dossiers` có 0 hồ sơ (ảnh 40 và 70). Ba nhãn cho một việc: “Lưu hồ sơ”, “Lập hồ sơ”, “Lưu trữ hồ sơ văn bản”. | Hộp có ô chọn/tạo hồ sơ và thêm đúng mục; nhãn “Đã lập hồ sơ” chỉ khi có `DossierItem`; một tên thao tác. AC: sau lưu, hồ sơ chứa văn bản; sổ và hồ sơ khớp |
| H3 | P1 · hành vi | “Chấp nhận lưu trữ” gửi `{}`; server mặc định đích ARCHIVED (`dossier-service.ts:837`) nên “Hoàn tất lưu trữ” (chỉ hiện ở ACCEPTED, `dossier-detail-view.tsx:412-421`) không tới được; `reject-archive` đưa về READY_FOR_ARCHIVE bất biến, không đường về ACTIVE, người nộp không được báo. [M] | Quyết định bỏ nút/trạng thái ACCEPTED hay gửi `status: ACCEPTED`; báo người nộp khi bị từ chối. **Phụ thuộc §11 D3** (nộp lưu 01 năm hay 60 ngày). |
| H4 | P2 · hành vi | “Đóng hồ sơ”: hộp “Xác nhận đóng hồ sơ này?” [Hủy][Đồng ý] (không nêu hồ sơ nào, hậu quả gì, nút Yes/No — R7) và nút luôn hiện dù hồ sơ rỗng chắc chắn lỗi (ảnh 97–98). | Ẩn/giải thích khi rỗng (“Thêm tài liệu trước khi đóng”); hộp nêu tên hồ sơ, số tài liệu, hậu quả (“không thêm/bớt được tài liệu”), nút “Đóng hồ sơ”/“Giữ mở”. AC: lỗi không còn là kết quả mong đợi của một nút hiện sẵn |
| H5 | P1 · hành vi | “Hủy hồ sơ” (quyết định xét hủy) gọi thẳng `dispose` không xác nhận (`dossier-disposal-panel.tsx:166-168`), trong khi mọi thao tác hồ sơ khác dùng `confirmAction` và “Xóa hẳn” dùng `DestructiveConfirmDialog`. Không đảo được. [M] | `DestructiveConfirmDialog` nêu tên hồ sơ, số tài liệu. AC: không thao tác hủy nào chạy ở lần bấm đầu |
| H6 | P2 · nhất quán | Quyền hiển thị nút hồ sơ dùng danh sách vai trò cứng ở client (`BAN_GIAM_HIEU/TRUONG_PHONG/VAN_THU/ADMIN`, `dossier-detail-view.tsx:341-354`), khác ma trận capability của server; quản trị kỹ thuật bị server từ chối mọi nghiệp vụ nhưng client vẫn hiện. [M] | Dùng `availableActions` của hồ sơ như Q3. |

### 5.11. Phím tắt, ⌘K, Trợ lý

| Mã | Mức · loại | Phát hiện và bằng chứng | Đề xuất; AC |
|---|---|---|---|
| K1 | P2 · nhất quán | Sổ văn bản có bàn phím tốt: Tab vào hàng, J/K hoặc ↑/↓ chuyển, Enter mở, Space hoặc X chọn, phím Menu/Shift+F10 mở menu, → sang chi tiết (`document-ledger.tsx:700-752`). Nhưng “Space” ở đây là **chọn**, còn bảng phím tắt “?” ghi Space = “Xem nhanh (Peek)” cho bảng nhiệm vụ; bảng “?” không có nhóm văn bản; phải Tab vào hàng trước khi J/K có tác dụng (đã thử: bấm J từ thân trang không đổi gì). [M][T] | Nhóm “Sổ văn bản” trong `global-shortcuts-modal`; thống nhất nghĩa Space giữa hai bảng hoặc ghi rõ. AC: mọi phím có thật được liệt kê, không phím nào ghi sai |
| K2 | P2 · hành vi | ⌘K chỉ có “Tạo nhiệm vụ…” và điều hướng tới văn bản; không “Soạn văn bản đi”/“Soạn tờ trình”/“Tạo hồ sơ” (`command-search-modal.tsx:335-337`). Quy tắc: hành động tạo mới của màn có trong ⌘K. [M] | Thêm ba lệnh (theo cờ `outgoingDocuments` và quyền). AC: ⌘K → “Soạn văn bản đi” mở hộp |
| K3 | P2 · hành vi | Trợ lý chỉ có công cụ văn bản **chỉ đọc** (`assistant-tool-documents.ts:1-4`), không có công cụ hồ sơ. Theo ADR-012, ghi dữ liệu qua thẻ chờ duyệt. | Cơ hội sau (đề xuất thẻ “soạn dự thảo”), **ngoài phạm vi spec này**. |

### 5.12. Từ vựng

Nguồn có thẩm quyền: `docs/ux/QCET_UI_VOCABULARY.md` (chỉ đối chiếu các từ “Phê duyệt”, “Văn bản”). Bất nhất đang có trong giao diện (đề xuất chọn ở §11 D7, không tự đổi):

| Mã | Khái niệm | Các cách gọi đang dùng | Ghi chú |
|---|---|---|---|
| V1 | Kết thúc văn bản | Hoàn thành · Đã phát hành · Đã lập hồ sơ · Đã thu hồi · Đã lưu | Một trạng thái người dùng, ba chữ cho “xong” |
| V2 | Gửi duyệt | “Trình phê duyệt nội dung” (đi) · “Trình duyệt” (tờ trình) · “Trình xử lý/Trình ký” (iOffice [R14]) | |
| V3 | Quyết định duyệt | “Phê duyệt nội dung / Yêu cầu chỉnh sửa” · “Đồng ý / Cần bổ sung / Không phê duyệt” | T7 |
| V4 | Đưa vào hồ sơ | “Lưu hồ sơ” · “Lập hồ sơ” · “Lưu trữ hồ sơ văn bản” | H2 |
| V5 | Giao đơn vị | “Giao đơn vị” · “Giao đơn vị chủ trì…” · “Chuyển” (còn là phân công người xử lý ở luồng cũ) | Luồng cũ; xem §4.2 |
| V6 | Số | “Số, ký hiệu” · “Số hiệu” · “Số ký hiệu văn bản gốc” · “Số đến” · “Số 0006” | Một văn bản có tới bốn con số (T1) |

### 5.13. Điện thoại và truy cập

- **Tốt** ở 390px: danh sách thẻ hai dòng, chi tiết một cột, “‹ quay lại”, lưới nhãn–giá trị, chip trạng thái icon + chữ (ảnh 45–46).
- **Chưa kiểm**: hộp Soạn văn bản đi ở 390px, thao tác duyệt/ký trên điện thoại, kéo thả tệp, trình đọc màn hình (VoiceOver/NVDA), thiết bị cảm ứng thật (`hover-only-reveal` đã có lint nhưng chưa rà từng control văn bản).
- Số đo: ô chọn hàng 24×24 (đúng ngưỡng 2.5.8 [R10]); nút hành động 28×28; “Tiếp nhận” 78×28 chữ 12px; tay trang tệp 32×16 (F2).

## 6. Điểm tốt, giữ nguyên

Không sửa lại những chỗ sau (đã đạt quy tắc, hoặc là mẫu nên dùng lại):

- Khung Quick View, bảng chung `ui/table`, hộp soạn kiểu New issue; không cuộn ma ở 1000×600 (`scrollHeight` thân trang = 0 ở Quick View, ảnh 92); thẻ một cột ở 390px (ảnh 45–46).
- Hộp “Trình duyệt tờ trình” (ô tìm, hàng khóa “Đơn vị của bạn”, chân tóm tắt) và “Rút lại” của tờ trình — **mẫu cho bộ chọn nơi nhận và cho Rút lại của văn bản đi**.
- Lỗi theo từng ô trong hộp tạo tờ trình; skeleton của trang báo cáo duyệt (ảnh 99); trạng thái trống đứng giữa và đúng từ ngữ ADR-015 (ảnh 70, 80).
- Nhãn truy cập của nút icon (“Thao tác văn bản <số>”, “Bộ lọc văn bản”); bàn phím sổ văn bản (K1); trình xem pdf/docx.
- Tách nhiệm vụ ở server đang đúng: người duyệt thể thức ≠ người ký ≠ người cấp số ≠ người đóng dấu; thứ tự ký → cấp số → đóng dấu số khớp NĐ 30/2020 Điều 15.2 [R13].
- Thông báo lỗi tiếng Việt từ server (`detail`) đủ rõ, chỉ web làm mất (Q3).

## 7. Nghiên cứu web và cách áp dụng

Tra cứu ngày 2026-10-23 bằng Exa; **đọc phần trích trả về, chưa mở toàn trang** (ghi rõ để không coi là đã nghiên cứu sâu). Đây là căn cứ tham khảo, không thay quy chuẩn hay nghiệp vụ QCET. Mục R15–R16 là tài liệu sản phẩm/ví dụ triển khai, không phải chuẩn.

| Mã | Nguồn | Điều nguồn hỗ trợ | QCET áp dụng / không áp dụng |
|---|---|---|---|
| R1 | [NN/g — Status Trackers and Progress Updates](https://www.nngroup.com/articles/status-tracker-progress-update/) | Tracker (kéo) và cập nhật đẩy nên đi cùng nhau; giữ các cập nhật trước kèm ngày; chỉ tracker gây lo lắng, chỉ thông báo dễ mất | Áp dụng: stepper có người/giờ (P2) **và** thông báo (N1). Không áp dụng nhãn “chờ giao hàng” của thương mại điện tử |
| R2 | [NN/g — Designing for Long Waits](https://www.nngroup.com/articles/designing-for-waits-and-interruptions/) | Chỉ ra bước đã xong và bước còn lại; thông báo thành công kèm ngữ cảnh (thời điểm, liên kết tới bản ghi); cho ghi chú; có lịch sử | Áp dụng: thông báo/kết quả thao tác nêu số cấp, nơi nhận, giờ (G3, N2) |
| R3 | [netLex — Workflow trên màn hình tài liệu](https://netlex.zendesk.com/hc/en-us/articles/42529818640407-New-Workflow-Experience-on-the-Document-Screen) | Cột phải theo vai trò: “Assignee actions” (chỉ người phụ trách bước, đứng đầu) và “Process status” (người khác: trạng thái, bước hiện tại, việc đang chờ); hiện người phụ trách khác, hạn bước, số lần lặp bước; “Reject” trả về bước trước kèm lý do; chuyển người phụ trách | Áp dụng: Q3 (nút chỉ cho người đến lượt, người khác thấy “Đang chờ …”), Q4 (số lần trả lại, lý do). Không áp dụng: nhiều người phụ trách song song, chuyển/nhận việc (ngoài phạm vi) |
| R4 | [GOV.UK — Notification banner](https://design-system.service.gov.uk/components/notification-banner/) | Banner thành công xanh, tiêu đề “Success” để không chỉ dựa vào màu (WCAG 1.4.1), gỡ khi sang trang mới, dùng tiết kiệm; không dùng cho lỗi validate | Áp dụng cho Q7. Không đưa quy tắc “role=alert chuyển focus” vì Material khuyên polite, không cướp focus (R11) |
| R5 | [GOV.UK — Task list và Tag](https://design-system.service.gov.uk/components/task-list/), [HMRC — File upload pattern](https://design.tax.service.gov.uk/hmrc-design-patterns/file-upload/) | Tag là trạng thái (tính từ), không tương tác; chip Uploading/Uploaded từng tệp, live region “X of Y files uploaded”, “file … removed” | Áp dụng cho C2 (chip trạng thái từng tệp). Không dùng task list (QCET là luồng tuần tự) |
| R6 | DocuSign — [hướng dẫn DOA Wisconsin](https://doa.wi.gov/Documents/DEO/WisconsineSignatureUserGuide.pdf) và [Community](https://community.docusign.com/esignature-111/how-do-i-see-if-a-document-for-signature-has-been-opened-or-viewed-but-not-signed-yet-1493) | Người ký có trạng thái Completed/Current/Waiting; “Waiting for Others” không nói ai đã mở → cần lịch sử (Viewed/Opened); Resend chỉ gửi cho người đang đến lượt; ký xong có thể hoàn tất sau/giao người khác/từ chối; có chứng nhận hoàn tất | Áp dụng: S3 (“Chờ bạn / Chờ người khác”), R5 (Nhắc). Không áp dụng: mô hình chữ ký điện tử của DocuSign; bản tóm tắt NĐ 30/2020 của ĐH Bách khoa Đà Nẵng ghi văn bản điện tử có giá trị pháp lý khi được ký số bởi người có thẩm quyền và ký số của cơ quan (chưa đối chiếu toàn văn; §11 D1) |
| R7 | [NN/g — Confirmation Dialogs Can Prevent User Errors](https://www.nngroup.com/articles/confirmation-dialog/) | Chỉ xác nhận cho hậu quả nghiêm trọng, không routine; nêu cụ thể hậu quả; nút mô tả hành động thay Yes/No; không mặc định Yes; luôn nghĩ tới Undo | Áp dụng: Q6, T5, H4, H5. Khớp quy tắc xác nhận/Hoàn tác của AGENTS.md |
| R8 | [NN/g — User Control and Freedom](https://www.nngroup.com/articles/user-control-and-freedom/), [NN/g — Preventing User Errors](https://www.nngroup.com/articles/user-mistakes/) | Undo phải khám phá được (toast vài giây dễ lỡ); Gmail “Undo send” tới 30 giây | Áp dụng: C7 (xóa nháp có Hoàn tác). Không áp dụng cho bước đã báo người khác (dùng xác nhận) |
| R9 | [GOV.UK — File upload](https://design-system.service.gov.uk/components/file-upload/), [Error message](https://design-system.service.gov.uk/components/error-message/) | Câu lỗi chuẩn theo từng loại (chưa chọn, sai loại, quá lớn, rỗng, virus, có mật khẩu, “could not be uploaded — try again”); không xóa dữ liệu đã nhập khi báo lỗi | Áp dụng: C2 (dịch sát nghĩa sang tiếng Việt, giữ một nguồn câu chữ) |
| R10 | [W3C — SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | Mục tiêu ≥ 24×24 CSS px, trừ: khoảng cách (vòng 24px không giao mục tiêu khác), tương đương, nội dòng, do trình duyệt, thiết yếu | Áp dụng: F2. 28px của control chuẩn QCET đạt; không suy ra 44px |
| R11 | [Material Design 3 — Snackbar (accessibility)](https://m3.material.io/components/snackbar/accessibility) | Snackbar có action không tự đóng; thông tin trong snackbar tự đóng phải có phản hồi inline; live region polite, không chuyển focus; 4–10 giây nếu không có action | Áp dụng: Q7. Không áp dụng phím Alt+G của Material |
| R12 | NĐ 30/2020/NĐ-CP, Điều 8 khoản 3 và Phụ lục III ([toàn văn qua dap.ctu.edu.vn](https://dap.ctu.edu.vn/images/upload/Ngh-nh-30-nm-2020-ca-Chnh-ph-v-cng-tc-vn-th.pdf), [bảng viết tắt](https://thuvienphapluat.vn/phap-luat/phu-luc-3-nghi-dinh-302020ndcp-bang-chu-viet-tat-ten-loai-mau-trinh-bay-van-ban-hanh-chinh-va-ban-s-291129.html)) | Ký hiệu = viết tắt loại + viết tắt cơ quan; **công văn**: viết tắt cơ quan + viết tắt đơn vị soạn hoặc lĩnh vực; số < 10 thêm số 0; nhóm viết tắt nối bằng “-”; chữ viết tắt do người đứng đầu quy định; Phụ lục III: QĐ, TTr, KH, BC, TB… | Áp dụng: G2. Dữ liệu viết tắt cơ quan/đơn vị phải do chủ sở hữu cung cấp |
| R13 | NĐ 30/2020, Điều 15–16 (cùng nguồn R12) | Số theo thứ tự thời gian trong năm, bắt đầu 01 ngày 01/01, kết thúc 31/12, duy nhất trong năm, thống nhất giữa giấy và điện tử; văn bản giấy cấp số sau khi có chữ ký, chậm nhất ngày làm việc kế tiếp; văn bản điện tử cấp số bằng chức năng hệ thống; đăng ký bằng hệ thống phải in ra đủ trường theo mẫu sổ và đóng sổ | Áp dụng: G3. “In/đóng sổ đăng ký” là điều **chưa kiểm** QCET có hay không (§12) |
| R14 | VNPT iOffice qua tài liệu hướng dẫn công khai ([xã Thu Lũm](https://xathulum.laichau.gov.vn/upload/105515/20241115/HDSD_VAI_TRO_LANH_DAO__1__cac74.pdf), [Sở KH&CN Phú Thọ](https://sokhoahoccongnghe.phutho.gov.vn/Uploads/files/phu%20luc%201_%20qlvbdh-vanthu.pdf), [ĐH SPTDTT TP.HCM](https://tchc.upes.edu.vn/2024/08/23/thong-bao-ve-viec-nhan-va-gui-van-ban-qua-he-thong-van-phong-dien-tu-quan-ly-van-ban-va-dieu-hanh-cong-tac-vnpt-ioffice-ho-chi-minh/)) | Dự thảo → Trình xử lý/Trình ký → Chờ xử lý → Đã xử lý → Chờ phát hành → Đã ban hành; sau khi trình chuyên viên không sửa/xóa; có “Xem luồng xử lý” và “Lịch sử thao tác” trên chi tiết; “Xin ý kiến” tách khỏi “Chuyển”; chọn xử lý chính/đồng xử lý; “Lấy lại” khi người nhận chưa mở; khi ban hành chọn sổ, số ký hiệu tự sinh nhưng sửa được | Áp dụng: Q5, P2, G2. Không áp dụng: xin ý kiến, đồng xử lý, liên thông trục văn bản quốc gia (ngoài phạm vi và ADR-015) |
| R15 | Tài liệu sản phẩm phổ thông ([Runnit](https://docs.runnit.io/user/projects/approvals/), [UnitX](https://unitx.unitfactor.org/docs/approvals), [ObjectOS](https://docs.objectos.ai/docs/use/approvals)) | Hộp duyệt chia “Chờ bạn / Bạn đã gửi / Đã quyết định / Tất cả”; empty “bạn đã xử lý hết”; yêu cầu chỉnh sửa **bắt buộc có bình luận**; nút duyệt chỉ hiện cho người được giao; bản ghi khóa khi chờ duyệt để người duyệt thấy đúng bản đã trình; lỗi tải hiện Retry chứ không “không có gì” | Áp dụng: S3, Q3, Q15 (khóa bản ghi khi chờ duyệt) |
| R16 | [Twenty CRM — PR chip input người nhận](https://github.com/twentyhq/twenty/pull/22668) | Ô người nhận dạng chip: dedupe, chip lỗi chặn gửi, dán danh sách, Backspace chọn rồi xóa, gợi ý loại trừ mục đã chọn | Ví dụ triển khai cho R3 khi chọn nhiều đơn vị; không phải yêu cầu |

## 8. Mô hình đề xuất

### 8.1. Ma trận trạng thái: chip, bước đang chờ, nút theo người

Một bảng nguồn duy nhất cho chip trạng thái (P3), stepper (P1), nút (Q3), hàng đợi (S3), thông báo (§8.3). “Chờ” luôn nói **ai** đang giữ.

| Trạng thái kỹ thuật (+ cờ) | Chip hiển thị | Đang chờ | Việc | Nút chính cho người đó | Bước “hiện tại” của stepper |
|---|---|---|---|---|---|
| DRAFT | Nháp | Người soạn | Soạn, đính tệp, chọn người duyệt/ký | Trình duyệt | Dự thảo |
| DRAFT + bị trả lại (sự kiện `CONTENT_REJECTED` sau lần trình gần nhất) | Cần sửa | Người soạn | Sửa theo lý do | Trình lại | Dự thảo |
| CONTENT_REVIEW | Chờ duyệt nội dung | Người duyệt được chỉ định | Phê duyệt / Yêu cầu chỉnh sửa (bắt buộc lý do) | Phê duyệt nội dung | Phê duyệt nội dung |
| FORMAT_CHECK | Chờ kiểm thể thức | Văn thư | Xác nhận thể thức đạt | Xác nhận thể thức | Kiểm tra thể thức |
| AUTHORIZED_SIGN, chưa có `authorizedSignedAt` | Chờ ký | Người ký (được chỉ định, hoặc lãnh đạo có quyền) | Ký chức danh | Ký | Ký chức danh |
| AUTHORIZED_SIGN, đã ký | Chờ cấp số | Văn thư (≠ người ký, SoD) | Cấp số | Cấp số | Cấp số |
| NUMBERED | Chờ đóng dấu | Văn thư (≠ người ký) | Đóng dấu cơ quan | Đóng dấu | Dấu cơ quan |
| ORGANIZATION_SIGNED | Chờ phát hành | Văn thư | Chọn nơi nhận, phát hành | Phát hành | Phát hành |
| ISSUED / DELIVERED | Đã phát hành · N/M đơn vị đã nhận | — (theo dõi) | — | — | tất cả xong |
| (góc nhìn đơn vị nhận) ISSUED | Chờ tiếp nhận → Đã tiếp nhận | Trưởng đơn vị nhận | Tiếp nhận | Tiếp nhận văn bản | — |
| FILED | Đã lưu hồ sơ (chỉ khi có `DossierItem`; nếu không thì giữ “Đã phát hành”) | — | — | — | tất cả xong |
| RECALLED | Đã thu hồi | — | — | — | — |

Người không phải người đang giữ thấy một dòng “Đang chờ <tên/vai trò> <việc> · từ <giờ>” thay cho nút (R3). `availableActions` của server là nguồn quyết định hiển thị nút, không bảng trạng thái ở web.

### 8.2. Hàng đợi theo người (thay nghĩa “Chờ xử lý”)

| Mục sidebar | Nghĩa hiện nay (theo trạng thái) | Nghĩa đề xuất (theo người) |
|---|---|---|
| Văn bản đi › Chờ xử lý | DRAFT, CONTENT_REVIEW, FORMAT_CHECK, AUTHORIZED_SIGN của mọi người xem được | Văn bản đang chờ **tôi** theo §8.1 (kèm bản nháp và bản “Cần sửa” của chính tôi) |
| Văn bản đi › Đã xử lý | NUMBERED, ORGANIZATION_SIGNED | Văn bản tôi đã làm bước của mình và đang ở người khác (chip “Chờ <ai>”) — gồm cả văn bản tôi soạn mà đang chờ duyệt |
| Văn bản đi › Đã phát hành / Đã thu hồi | như cũ | như cũ |
| Văn bản đến › Chờ xử lý | văn bản đến + phát hành tới đơn vị tôi chưa xử lý xong | Chờ tôi **tiếp nhận** (trưởng đơn vị) |

Dấu chấm 6px ở mục khi có việc (như nút Hộp thư), không badge số, giữ nguyên quy tắc “khung lùi lại”. Đổi nghĩa mục sidebar là quyết định cần duyệt (§11 D8).

### 8.3. Thông báo: ai cần biết gì

| Sự kiện | Người nhận | Nội dung ngắn | Ghi chú |
|---|---|---|---|
| `DOCUMENT_CONTENT_REVIEW_REQUESTED` | Người duyệt nội dung | “<Người soạn> trình duyệt: <trích yếu>” | Cần Q1 + Q2 trước |
| `DOCUMENT_CONTENT_REJECTED` | Người soạn | “<Người trả> yêu cầu chỉnh sửa: <lý do rút gọn>” | Q4 |
| `DOCUMENT_CONTENT_APPROVED` | Văn thư (kiểm thể thức) | “Chờ kiểm thể thức: <trích yếu>” | Người soạn: thấy trạng thái, không cần thông báo |
| `DOCUMENT_FORMAT_APPROVED` | Người ký | “Chờ ký: <trích yếu>” | |
| `DOCUMENT_AUTHORIZED_SIGNED` | Văn thư | “Đã ký, chờ cấp số: <trích yếu>” | |
| `DOCUMENT_NUMBERED`, `DOCUMENT_ORGANIZATION_SIGNED` | không gửi (cùng Văn thư làm bước kế; hàng đợi đủ) | — | Ghi vào danh sách “bỏ qua có lý do” của test N1 |
| `DOCUMENT_ISSUED_NOTIFICATION` | Trưởng đơn vị nhận (đã có) + người soạn | “<Đơn vị gửi> gửi: <trích yếu> · <độ khẩn>” | N2; đơn vị không trưởng → báo Văn thư |
| (mới) tiếp nhận | Người phát hành và người soạn | “Khoa CNTT đã tiếp nhận (2/3)” | R5 |
| `DOCUMENT_RECALLED_NOTIFICATION` | Trưởng đơn vị nhận (đã có) | giữ | |
| `DOCUMENT_REVISION_CREATED`, `DOCUMENT_DRAFT_CREATED` | không gửi | — | Ghi “bỏ qua có lý do” |
| Hồ sơ: `DOSSIER_SUBMITTED_ARCHIVE`, `ACCEPTED_ARCHIVE`, reject | Lưu trữ viên / người nộp | theo H3 | Sau quyết định D3 |

Quy tắc: người thực hiện không nhận thông báo cho hành động của chính mình; không gửi hai thông báo cho cùng một việc đến cùng một người.

## 9. Thứ tự làm đề xuất

Cỡ: S ≈ nửa ngày, M ≈ 1–2 ngày, L > 2 ngày; ước lượng thô, chưa đo. “Chặn bởi” = cần quyết định ở §11 hoặc việc trước.

| Đợt | Mục | Mã | Cỡ | Chặn bởi |
|---|---|---|---|---|
| **A. Khép luồng văn bản đi (P0)** | A1 Quyền đọc dự thảo và tệp cho người có bước duyệt | Q1, T3 | L | D5 |
| | A2 Nút theo `availableActions`, đọc `detail` của lỗi, dòng “Đang chờ …” | Q3, Q9 | M | — |
| | A3 Chỉ định người duyệt khi trình, “Rút lại”, khóa nội dung khi chờ duyệt | Q2, Q5, Q15 | M | A1 |
| | A4 Hiện lý do trả lại; ký nháy không khóa bản nháp bị trả | Q4, G5 | S | — |
| | A5 Handler thông báo + test kiến trúc outbox | N1 | M | A1, A3 |
| | A6 Hàng đợi “tới lượt tôi” + chấm sidebar | S3 | M | A3, D8 |
| | A7 Nhãn ký trung thực tạm thời | G1 | S | D1 (phần nhãn tạm không chặn) |
| | A8 Ký hiệu theo loại, hộp cấp số có xem trước/ngày | G2, G3 | M | D6 |
| **B. Trạng thái và bước nhận trung thực (P1)** | B1 Stepper đúng + người/giờ + chip §8.1 | P1–P4 | M | A2 |
| | B2 Nơi nhận: bộ chọn dùng lại, xác nhận cụ thể, chặn phát hành rỗng, báo đơn vị không trưởng | R2–R4 | M | — |
| | B3 Tiếp nhận: nút chính, góc nhìn người nhận, báo ngược | R1, R5, Q11, S9 | M | D4 (phần sau tiếp nhận) |
| | B4 Tờ trình: một hệ trạng thái, khung compose, xác nhận Đồng ý, nhãn đúng | T1, T2, T4, T5 | M | D2 (bước sau duyệt) |
| | B5 Hồ sơ: tạo, thêm tài liệu, Bảng thời hạn, “Lưu hồ sơ” thật | H1–H3 | L | D3 |
| | B6 Sổ: cột theo loại, “Loại”, bộ lọc thêm | S1, S2, S4 | M | — |
| | B7 Soạn: lỗi từng tệp, chặn trình khi thiếu tệp dự thảo | C2, C3 | M | — |
| **C. Tinh chỉnh (P2)** | Hộp xác nhận cụ thể mọi bước, toast thay banner, ⌘K, bảng phím tắt, từ vựng, xóa nháp có Hoàn tác, mục tiêu 24px, hàng giữ lại sau bước, xuất đúng định dạng | Q6, Q7, K1–K2, V1–V6, C7, F2, S5, S11 | M–L | D7 |

Lý do đặt A trước: A1–A5 là điều kiện để luồng chạy được với **người thật khác người soạn**; mọi cải thiện hiển thị ở B đều vô nghĩa khi người duyệt không đọc được văn bản. Không đề xuất thêm tính năng mới (xin ý kiến, đồng xử lý, liên thông trục văn bản) trước khi A xong.

### 9.1. Tiến độ

| Mục | Trạng thái |
|---|---|
| A1 · Q1 + T3 (đọc và duyệt theo đơn vị soạn, mở tệp) | **Xong** 23/10/2026, nhánh `feat/document-flow-closure`. Cột `document_outgoing_workflows.drafting_unit_id` (migration `20261023150000`, điền sẵn cho dự thảo cũ theo phân công chính của người soạn); `createOutgoingDraft` ghi đơn vị soạn (chỉ nhận `draftingDeptId` nếu là đơn vị người soạn đang giữ chức danh). Trưởng/phó đơn vị soạn và người được trình duyệt/kiểm thể thức/ký đọc được (chi tiết, danh sách, tệp); đồng nghiệp cùng đơn vị không đọc dự thảo chưa trình. `approveContent`/`rejectContent` thêm kiểm phạm vi: chỉ người được trình, trưởng/phó đơn vị soạn hoặc lãnh đạo trường (trước đó trưởng đơn vị nào cũng duyệt được dự thảo của đơn vị khác). Tệp: `file-access-service` dùng chung một hàm đọc (ngữ cảnh đầy đủ + người tham gia duyệt tờ trình). Test `apps/api/tests/outgoing-drafting-unit-access.test.ts` (7 ca; bỏ sửa ACL thì ca 2, 4, 6 đỏ); 235/235 ca ở 18 tệp liên quan xanh. Kiểm trực tiếp trên `qcet_audit`: trưởng P.QLĐT 200, trưởng Khoa CNTT và chuyên viên CNTT 403, trưởng CNTT duyệt dự thảo của P.QLĐT 403 kèm lý do, trưởng P.QLĐT duyệt 200. Chưa kiểm trên trình duyệt vì không đổi giao diện |
| A2 · Q3 + Q9 (nút theo người, lỗi `detail`, dòng “Đang chờ …”) | **Xong** 23/10/2026. Chi tiết văn bản đi trả thêm `outgoingStep = { actions, waiting }` tính theo người xem: `runOutgoingStepGate` (phân tách nhiệm vụ, phạm vi duyệt, quyền theo chức danh) dùng chung cho bảy lệnh ghi và cho việc tính nút nên nút hiện đúng bằng điều server chấp nhận; bảng bước và `describeOutgoingWaiting` ở `packages/shared/.../outgoing-steps.ts` (chuyển từ web, hợp đồng kiểu ở `packages/contracts`). Ký chức danh và cấp số tách theo `authorizedSignedAt` (sau ký không còn nút Ký). Chỉ người soạn thấy và bấm được “Trình” (trước đó trưởng đơn vị trình thay được). Người chưa đến lượt thấy “Đang chờ <tên/vai trò> <việc> · từ <ngày giờ>”; hộp lỗi đọc `detail` qua `readApiErrorMessage`. Hiệu trưởng vẫn thấy nút duyệt nội dung ở mọi dự thảo vì server cho phép lãnh đạo trường duyệt thay (giữ như vậy, ghi để quyết định sau). Test: `outgoing-step-view` (7 ca ma trận vai trò × trạng thái), `outgoing-step-actions` (+2), `outgoing-action-panel` web (4); 85/85 ca liên quan xanh. Trình duyệt (`qcet_audit`): trưởng P.QLĐT thấy 2 nút cao 28px chữ 13px, Enter mở hộp xác nhận, Esc đóng và trả focus về nút; chuyên viên soạn thấy dòng chờ cao 18px, icon 16px; 390px không tràn ngang, không cuộn thừa. Còn tồn: nút “Xác nhận” của hộp vẫn khóa khi thiếu lý do (Q6, Đợt C) |
| A3 · Q2 + Q5 + Q15 (chọn người duyệt, Rút lại, khóa nội dung khi chờ duyệt) | **Xong** 23/10/2026. Người duyệt chọn trong `listContentReviewers`: trưởng đơn vị soạn (mặc định) và lãnh đạo trường, không có người soạn, không có cấp phó (cấp phó chỉ duyệt khi có ủy quyền); server từ chối người khác (`INVALID_CONTENT_REVIEWER`) và tự gán trưởng đơn vị soạn khi không chọn, nên “Đang chờ <tên> duyệt nội dung” và hàng đợi theo `contentReviewerId` luôn có chủ. Hộp “Trình duyệt nội dung” (`DialogForm`: người duyệt mặc định sẵn, lời nhắn tùy chọn, Ctrl/Cmd+Enter gửi, “Gửi duyệt” `type="submit"`, focus vào ô chọn). “Rút lại” (`withdraw-content-review`): chỉ người soạn, chỉ khi còn CONTENT_REVIEW; về Nháp, bỏ người duyệt, ghi nhật ký và sự kiện `DOCUMENT_CONTENT_REVIEW_WITHDRAWN` (handler thông báo ở A5). Trình, duyệt, trả lại và rút lại nhận việc có điều kiện trạng thái (`updateMany`), nên bấm đồng thời hay duyệt sau khi rút lại trả 409 thay vì duyệt nhầm bản nháp; duyệt nội dung chỉ còn nhận CONTENT_REVIEW (trước đây nhận cả Nháp). Khóa Q15: PATCH nội dung, thêm tệp, xóa và `canEdit` bị chặn ở CONTENT_REVIEW → AUTHORIZED_SIGN bằng `OUTGOING_UNDER_REVIEW` kèm lời nhắc rút lại; gắn liên kết nhiệm vụ không bị khóa. Người soạn đang chờ thấy “Đang chờ … · từ …” kèm nút Rút lại; người có việc ở bước không thấy dòng chờ. Test `outgoing-review-lock` (5 ca), cập nhật `outgoing-documents-v2` (người soạn và trưởng phòng có phân công cùng đơn vị); 292/292 ca liên quan xanh. Trình duyệt (`qcet_audit`): hộp 400px, ô chọn 28px chữ 13px, nhãn “Lê Văn Thí · Trưởng phòng, Phòng Quản lý Đào tạo”, Enter mở hộp và focus ở ô chọn, Ctrl+Enter gửi, Rút lại → xác nhận → về Nháp; 390px hộp thành tấm đáy không tràn. Còn tồn: hộp xác nhận chung của Rút lại/Trả lại còn khóa nút khi thiếu lý do (Q6, Đợt C) |
| A4 · Q4 + G5 (lý do trả lại, chip “Cần sửa”, ký nháy không khóa nháp) | **Xong** 23/10/2026. `isDocumentImmutable` chỉ tính chữ ký còn hiệu lực (bỏ ký nháy `INITIAL` và bản ghi `REVOKED`): nháp → trình → ký nháy → trả lại → sửa trích yếu qua PATCH nay 200 (trước đó 400 `IMMUTABLE_DOCUMENT`; `applyDocumentPatch` chọn thêm `signatureType`/`verificationStatus`, bỏ `take: 1`). Ghi chú trả lại dùng `formatReturnedNote`/`returnedReasonOf` (`[Trả lại]: <lý do>`, nhận cả bản ghi cũ). `outgoingStep.returned = { by, at, note }` lấy người và giờ từ nhật ký `DOCUMENT_CONTENT_REJECTED` gần nhất (không thêm cột); `needsRevision` trên dòng danh sách và chi tiết cho chip “Cần sửa” (`getLedgerStepLabel` tham số thứ tư). Khối “Bị trả lại để sửa · <người> · <ngày giờ>” và lý do nằm đầu khối thao tác của người soạn, kèm nút “Trình phê duyệt nội dung” để trình lại. `evaluateInitialSign` dùng `draftingUnitId` của workflow (còn dự phòng theo chức vụ cho dự thảo cũ). Test `outgoing-returned-draft` (3 ca, bỏ sửa `state-machine` thì cả 3 đỏ), `outgoing-step-actions` (+2), 120 ca ký nháy/máy trạng thái liên quan xanh. Trình duyệt (`qcet_audit`): khối cao 56px, chữ 13px, icon 16px, bo 8px, `role="note"`, chip “Cần sửa” ở hàng danh sách và ô Trạng thái. Còn tồn: B1 làm đủ 11 chip; ký nháy của phiên bản trước còn hiện sau khi trả lại (cần quyết định có hết hiệu lực khi nháp bị trả không) |

## 10. Tiêu chí nghiệm thu chung

- **Ma trận người dùng × trạng thái** (7 người dùng đã nêu × 11 trạng thái §8.1): nút hiển thị = `availableActions` của server; người không đến lượt thấy “Đang chờ …” đúng tên; không banner “Thao tác thất bại (4xx)” trần ở bất kỳ ô nào của ma trận. Có test tự động cho phần dữ liệu (bảng ánh xạ) và Playwright cho phần hiển thị.
- **Test kiến trúc outbox**: mọi `eventType` được `publishOutboxEvent` có handler hoặc nằm trong danh sách “bỏ qua có lý do”; không sự kiện PENDING mãi sau một vòng worker.
- **Test ranh giới đọc**: trưởng đơn vị soạn đọc được dự thảo và tệp của đơn vị mình, không đọc của đơn vị khác; người có bước duyệt đọc được tệp tờ trình; người ngoài luồng vẫn 403.
- **Trình duyệt, cho mỗi màn sửa**: Tab/Enter/Esc/Ctrl+Cmd+Enter; đo DOM (cỡ chữ, chiều cao, bo góc) so với thang trong AGENTS.md; đủ trạng thái rỗng, lỗi, đang gửi, tên dài; ảnh 1x và 390px; `scrollHeight > clientHeight` mọi khối `overflow: auto` ở 1000×600, 1440×900, 390px; tệp tải lỗi từng loại.
- `npm run lint` không tăng baseline; sửa dòng cũ thì làm sạch dòng đó. Không dùng `next build` để kiểm.
- Mỗi lỗi đã báo ở đây khi sửa phải có test tái hiện (ví dụ G5: nháp → trình → ký nháy → trả lại → sửa → 200).

## 11. Quyết định (D1–D9)

Ngày 2026-10-23 người dùng trả lời “duyệt và tự quyết”: spec được duyệt và các câu hỏi chủ sở hữu do tác giả chọn. D1–D4 là bốn câu hỏi từ nghiên cứu 22/10/2026, D5–D9 phát sinh từ rà soát này. Mỗi lựa chọn dưới đây là **quyết định có thể đảo lại** khi chủ sở hữu có ý khác; cột “Chặn” cũ không còn chặn.

| Mã | Câu hỏi | Chọn (23/10/2026) | Lý do và giới hạn |
|---|---|---|---|
| D1 | Loại chữ ký số thật và định vị QCET so với VNPT iOffice | QCET chưa ký số bằng chứng thư. Ghi nhận **“Xác nhận ký”** nội bộ, không ghi `VALID`, không ghi nhà cung cấp CA khi không có; hiển thị rõ “Chưa ký số bằng chứng thư”; bỏ hộp ký mô phỏng ở web | Không có chứng thư hay token để tích hợp; hiển thị sự thật quan trọng hơn vẻ ngoài. Nối chữ ký số thật (NĐ 30 yêu cầu văn bản điện tử có chữ ký số của người có thẩm quyền và của cơ quan) là việc riêng khi có CA |
| D2 | Tờ trình sau khi duyệt | Dừng ở “Đã phê duyệt”; nút “Tạo nhiệm vụ” sẵn có là bước kế; sửa nhãn sai “Đã lập hồ sơ”. Không sinh văn bản đi tự động | Gap-spec V-06 vẫn là đề xuất; giữ thay đổi nhỏ, không dựng luồng mới |
| D3 | Thời hạn nộp lưu hồ sơ | Giữ hiện trạng 01 năm (NĐ 30, Luật Lưu trữ 33/2024) | TT 05/2025/TT-BNV (60 ngày) mâu thuẫn và chưa có hướng dẫn thống nhất; không đổi code |
| D4 | Vai trò XLC/PH/xem, giao việc từng đơn vị nhận, gửi cá nhân | Hoãn (giữ ADR-015). Chỉ làm: “Tiếp nhận” thành nút chính, báo ngược cho người phát hành | Mở rộng nghiệp vụ lớn, cần người dùng cuối cho biết cách trường làm |
| D5 | Quyền đọc dự thảo của trưởng đơn vị | (a) có giới hạn: ghi **đơn vị soạn** lên văn bản đi (cột mới `draftingUnitId` ở quy trình văn bản đi); **trưởng/phó đơn vị soạn** và người được chỉ định duyệt/ký đọc được; thành viên khác của đơn vị **không** đọc nháp | Khớp quyền duyệt đã có trong `hybrid-authorization.ts`; không nới rộng hơn mức cần |
| D6 | Viết tắt cơ quan/đơn vị cho ký hiệu; dãy số chung với VNPT | Cơ quan = `CĐKTCNQN` (đúng như QĐ 283/QĐ-CĐKTCNQN và QĐ 420/QĐ-CĐKTCNQN đã dẫn trong mã), đặt trong `INSTITUTION_CONFIG`. Đơn vị = `metadata.shortName` của đơn vị nếu có, nếu không lấy **chữ cái đầu các từ của tên đơn vị** bỏ “Phòng/Khoa/Trung tâm/Ban”, “và”, “&” (Phòng Quản lý Đào tạo → QLĐT; Phòng Tài chính - Kế toán → TCKT; Khoa Công nghệ thông tin → CNTT). Ký hiệu theo loại văn bản (Phụ lục III NĐ 30). Dãy số giữ hiện trạng: riêng của QCET theo loại và năm | Văn thư sửa được ký hiệu trước khi cấp. Nếu QCET phát hành chính thức song song với VNPT thì phải thống nhất dãy số — rủi ro trùng số được ghi ở §12, không giải bằng code |
| D7 | Từ vựng | Giữ hai bộ nút quyết định vì nghĩa khác (tờ trình có “Không phê duyệt”). Sửa chỗ gây hiểu sai: trạng thái kết thúc đúng nghĩa (“Đã phê duyệt”, “Đã phát hành”, “Đã lưu hồ sơ” chỉ khi có hồ sơ thật); một tên “Lưu hồ sơ”; “Số, ký hiệu” đầy đủ. Không đổi tên hàng loạt | Tránh đổi thuật ngữ khi chưa đối chiếu hết `QCET_UI_VOCABULARY.md` |
| D8 | Đổi nghĩa “Chờ xử lý / Đã xử lý” | Đổi theo người (§8.2) cho Văn bản đi | Đúng nhu cầu “tới lượt tôi”; mục sidebar giữ nguyên tên |
| D9 | Luồng văn bản đến kiểu cũ | Giữ mã, không đầu tư; không sửa nút “Kết thúc” trong đợt này. Ghi vào “Còn tồn” | Chỉ dữ liệu cũ đi vào; sửa cần quyết định về hồ sơ kết quả |

## 12. Chưa kiểm và giới hạn

- Chrome của người dùng, thiết bị cảm ứng, trình đọc màn hình; hộp Soạn văn bản đi và thao tác duyệt/ký ở 390px; `role`/live region của banner sau thao tác (Q7).
- Thông báo đẩy mở bằng `?id=` (N3); lịch chạy `document-deadline-check` ở môi trường triển khai (N4); dữ liệu và hành vi production.
- `DigitalSignatureDialog` khi nút ký lộ ra (G4); “Tạo nhiệm vụ” khi thiếu quyền sửa (Q14); “Sửa thông tin” đổi số/ký hiệu (Q13): chỉ đọc mã.
- QCET đã có chức năng in/đóng sổ đăng ký văn bản đi theo Phụ lục IV NĐ 30 chưa (Điều 16.2.b): chưa tìm; “In phiếu văn bản” ở menu ⋯ là chức năng khác.
- Người dùng ủy quyền có được tiếp nhận thay trưởng đơn vị (R7): chưa đọc quy tắc ủy quyền.
- Phạm vi quyền của `confirm-receipt` ở tầng route; thêm tệp khi đang chờ duyệt (Q15 mới thử PATCH trích yếu).
- Nghiên cứu web chỉ đọc phần trích; chưa kiểm chéo bản mới nhất của từng trang.
- Chưa so với `docs/ux/QCET_UI_VOCABULARY.md` ngoài vài từ.

## Phụ lục A. Route không có nơi gọi ở web (20 cặp)

| Route | Ghi chú |
|---|---|
| POST `/documents/[id]/actions/submit-format-check` | Bước thừa theo luồng UI (`approve-content` đã chuyển thẳng sang FORMAT_CHECK); cổng trạng thái yếu (`outgoing-document-service.ts:630-636`) |
| POST `/documents/[id]/actions/revision` | **Không nút** nên văn bản đã ký/phát hành không có đường sửa trong UI; service không kiểm trạng thái (`:1317-1349`) và có thể đưa ISSUED về DRAFT mà giữ nơi nhận |
| POST `/documents/outgoing/[id]/actions/deliver` | DELIVERED chỉ đặt được qua route này; các bước sau chấp nhận ISSUED |
| DELETE `/documents/[id]` | Không nút xóa nháp (C7) |
| GET, POST `/documents/[id]/directives`; GET `/documents/[id]/workflow` | Tương thích cũ; UI dùng `actions/direct` |
| GET `/documents/incoming`, `/incoming/[id]`; GET `/documents/outgoing`, `/outgoing/[id]` | UI dùng `GET /documents`; `GET /documents/outgoing` trả cả văn bản đơn vị khác gửi tới (không truyền `delivered:false`, `outgoing-document-service.ts:1494` — trái ADR-015 §3; web không gọi) |
| POST `/documents/incoming` | Luôn 403 (đúng ADR-015) |
| GET `/documents/download`; GET `/documents/duplicate-check`; GET, POST `/documents/export-excel` | “Xuất Excel” của thanh hàng loạt tự sinh CSV (S5) |
| GET `/dossiers/[id]`; GET, POST, DELETE `/dossiers/[id]/items` | Trang chi tiết dùng page-data; **không UI thêm/gỡ/xem mục** (H1) |

Kèm theo: `PATCH /documents/[id]` cho `leadUnitId` tạo `incomingWorkflow` cho mọi loại văn bản (`document-service.ts:609-614`; create chặn, update chưa) — rủi ro dữ liệu ở API, web không gọi cho văn bản đi.

## Phụ lục B. Sự kiện outbox của văn bản và hồ sơ

| Có handler | Không handler (PENDING mãi) |
|---|---|
| Văn bản: `APPROVAL_REQUESTED`, `APPROVAL_DECIDED`, `APPROVAL_RETURN`, `CONSULTATION` (tờ trình), `RETURNED`, `REROUTED` (luồng cũ), **`ISSUED`**, **`RECALLED`** | Văn bản đi: `DRAFT_CREATED`, `CONTENT_REVIEW_REQUESTED`, `CONTENT_APPROVED`, `CONTENT_REJECTED`, `FORMAT_APPROVED`, `AUTHORIZED_SIGNED`, `NUMBERED`, `ORGANIZATION_SIGNED`, `REVISION_CREATED`; luồng cũ: `PRESENTED`, `DIRECTIVE`, `ASSIGNED`, `RESOLVED`, `FILED` |
| Hồ sơ: `DISPOSAL_PROPOSED`, `DISPOSAL_DECIDED` | Hồ sơ: `CREATED`, `CLOSED`, `SUBMITTED_ARCHIVE`, `ACCEPTED_ARCHIVE` |

Nguồn: `apps/api/src/server/outbox/outbox-worker.ts:29-36`, `document-notification-handlers.ts:74-241`, `dossier-notification-handlers.ts:44,58`, `packages/db/src/outbox.ts:570-603`. Việc `DOCUMENT_OVERDUE`/`EXPIRING_SOON` được `acknowledge` có chủ ý.

## Phụ lục C. Bằng chứng và môi trường rà soát

- Ảnh: `.playwright-mcp/docaudit/01…100-*.png` (ignore bởi git). Số ảnh dùng trong tài liệu: 01–35 luồng văn bản đi, 40–46 sổ, 50–61 tờ trình, 70–71 hồ sơ, 80 hộp thư, 90–92 tệp và 1000×600, 93–95 bản nháp bị trả lại, 96–98 chi tiết hồ sơ, 99–100 báo cáo duyệt.
- Cơ sở dữ liệu `qcet_audit` (bản sao dev) và ba tiến trình cục bộ (web 3301, api 3300, bộ chuyển người dùng 3399) **còn chạy** sau rà soát; chỉ dọn khi người dùng đồng ý. Dữ liệu dev `qcet_eoffice` không bị chạm.
- Số liệu route và bảng trạng thái ↔ sự kiện lấy từ hai bản đọc mã độc lập; điểm tôi tái hiện đã nâng lên [T]/[D] trong §4–§5.
