# Rà soát UI/UX QCET E-Office — Phân hệ Văn bản

Kết luận: Giao diện hiện tại đã có nền tảng cho kiểu làm việc Split Workspace giống Linear, nhưng chất lượng trình bày và tổ chức thông tin chưa tốt. Vấn đề lớn nhất không phải là thiếu màu sắc hay hiệu ứng, mà là phân cấp thông tin yếu, bảng chưa thích ứng tốt theo độ rộng và vùng chi tiết chưa hỗ trợ rõ ràng quy trình xử lý văn bản.

Mình đã xem cả hai ảnh và đối chiếu thêm với mã nguồn nhánh `feat/document-workspace` của QCET Work. Dưới đây là các vấn đề quan sát được, nguyên nhân và phương án cải thiện.

## 1. Những lỗi nghiêm trọng cần sửa trước

| Mức độ | Vấn đề                                                         | Nhận xét                                        |
| ------ | -------------------------------------------------------------- | ----------------------------------------------- |
| P0     | Cột Thượng khẩn đè lên Cơ quan ban hành ở ảnh 2                | Lỗi layout rõ ràng, cần sửa ngay                |
| P0     | Khi mở Quick View, mức khẩn từ chữ chuyển thành biểu tượng `!` | Thông tin nghiệp vụ quan trọng trở nên khó hiểu |
| P1     | Trạng thái Đã đăng ký không phản ánh rõ việc cần xử lý         | Người dùng khó xác định bước tiếp theo          |
| P1     | Panel chi tiết đặt quá nhiều metadata trên một dòng            | Khó đọc, khó tìm thông tin                      |
| P1     | Chưa có hành động xử lý chính nổi bật trong panel              | Xem được văn bản nhưng khó biết phải làm gì     |
| P1     | Không gian rất lớn nhưng nội dung lại nhỏ, dồn vào phía trên   | Mất cân đối thị giác                            |
| P2     | Thanh tìm kiếm, bộ lọc và nút tạo văn bản chen cùng một hàng   | Phân cấp thao tác chưa rõ                       |
| P2     | Quá nhiều chữ xám nhạt, icon mảnh và đường viền yếu            | Thiếu độ tương phản, cảm giác nhạt nhòa         |

### Lỗi cụ thể trong ảnh 2

P0 — Layout

Cột bị chồng chữ

Mô phỏng vị trí hiển thị hiện tại

! Thượng khẩn

UBND Tỉnh Bình Định

Hai giá trị sát nhau đến mức không còn ranh giới cột rõ ràng.

Trong mã nguồn, `document-ledger.tsx` quy định cột mức khẩn rộng `80px` khi bảng rộng, hoặc `56px` ở chế độ khác. Kích thước này không đủ để hiển thị cả icon và nhãn “Thượng khẩn”.

Cách sửa đúng: dùng cột có `min-width` thực tế, khoảng cách giữa các cột ổn định và chuyển sang cách hiển thị rút gọn theo độ rộng vùng danh sách. Tuyệt đối không để nội dung tràn sang ô khác.

## 2. Danh sách văn bản — cần thiết kế lại cách trình bày

### 2.1. Bảng hiện tại chưa có thứ bậc thông tin tốt

Ở ảnh 2, trích yếu văn bản chiếm một vùng rất rộng nhưng các thông tin còn lại bị phân tán. Trong khi đó, khi mở Quick View ở ảnh 1, hai cột Cơ quan ban hành và Chủ trì biến mất hoàn toàn.

Việc ẩn cột theo độ rộng là đúng, nhưng cần giữ những thông tin quan trọng trong dòng văn bản thay vì đơn giản là bỏ chúng đi.

Mình đề xuất ba cấp responsive:

| Vùng danh sách | Nội dung hiển thị                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Rộng ≥ 1200px  | Trích yếu, cơ quan ban hành, mức khẩn, chủ trì, hạn xử lý, bước xử lý                             |
| Vừa 780–1199px | Trích yếu, mức khẩn, hạn xử lý, bước xử lý; cơ quan ban hành nằm dưới trích yếu                   |
| Hẹp 480–779px  | Trích yếu, thông tin phụ, hạn xử lý và bước xử lý; mức khẩn hiện bằng chữ ngay trong dòng văn bản |

Các ngưỡng này nên đo theo chiều rộng thực của vùng danh sách, không theo toàn bộ trình duyệt.

Ví dụ một dòng được tổ chức lại

Danh sách hẹp

Về việc triển khai kế hoạch công tác năm 2026

Số đến 0008 · UBND tỉnh · 09/10/2026

Thượng khẩn

·

Hạn 16/10

Đã đăng ký

Còn 7 ngày

Đây là minh họa cách tổ chức thông tin, không phải bản dựng từ dữ liệu thật.

Điểm quan trọng là người dùng có thể nhận biết trích yếu, nơi gửi, mức khẩn và hạn xử lý mà không phải mở chi tiết.

### 2.2. Dòng phụ đang hiển thị thông tin kỹ thuật không phù hợp

Trong ảnh có chuỗi `iu223hh9239f3hh29` nằm ngay cạnh số đến `0008`.

Trong `document-registry-view.tsx`, mình thấy `mapApiDocumentToOfficial()` có cơ chế lấy `item.id` làm giá trị dự phòng cho `documentNumber` khi thiếu dữ liệu.

Cần sửa theo nguyên tắc:

- Hiện số đến và số/ký hiệu văn bản thực tế, không dùng ID hệ thống làm nội dung thay thế.
- Nếu thiếu số/ký hiệu, để trống hoặc hiển thị trạng thái phù hợp.
- Chỉ hiện ngày ban hành một lần ở danh sách, tránh lặp lại trong dòng phụ và cột riêng nếu không cần thiết.

### 2.3. Thanh công cụ thiếu tổ chức

Hiện tại tiêu đề “Văn bản đến”, số lượng, tìm kiếm, bộ lọc, tùy chỉnh bảng và nút vào sổ nằm trên một hàng thấp khoảng 40px.

Đề xuất:

Văn bản đến

Chờ xử lý · 1 văn bản

&#x20;Vào sổ

Nên tách rõ hai tầng: tiêu đề + hành động chính và tìm kiếm + lọc + hiển thị. Với Quick View mở, toolbar được phép co gọn theo vùng danh sách.

### 2.4. Trạng thái cần thể hiện đúng nghiệp vụ

Ảnh chụp đang ở thư mục “Chờ xử lý” nhưng cột trạng thái ghi “Đã đăng ký”.

Đọc `document-ledger-format.ts` cho thấy “Đã đăng ký” tương ứng trạng thái workflow `REGISTERED`. Vì vậy, đây không nhất thiết là lỗi dữ liệu: một văn bản có thể đã vào sổ nhưng vẫn nằm trong hàng chờ xử lý.

Tuy nhiên, giao diện chưa phân biệt rõ hai khái niệm này. Nên đổi nhãn cột thành Bước xử lý nếu đang thể hiện quy trình văn bản, còn “Chờ xử lý” được thể hiện là bộ lọc danh sách.

## 3. Panel Quick View — phần cần cải thiện mạnh nhất

Hiện tại panel chi tiết trông như một bản ghi metadata kéo dài, chưa giống một không gian làm việc với văn bản.

### 3.1. Thứ tự thông tin chưa phù hợp

Hiện tại:

Văn bản đến · Số đến 0008

## Trích yếu văn bản

Đã đăng ký · Thượng khẩn · Hạn 16/10/2026 · Số ký hiệu · Chi tiết

Nhiệm vụ liên kết

Chưa gắn nhiệm vụ...

Luân chuyển và lịch sử

Chưa có tệp đính kèm

Các thông tin về xử lý và tệp văn bản bị đặt phía dưới. Điều đó khiến người dùng phải tìm thao tác chính thay vì nhìn thấy ngay.

### 3.2. Cấu trúc đề xuất

Văn bản đến / Số đến 0008

## Về việc triển khai kế hoạch công tác năm 2026

UBND tỉnh · Số ký hiệu: 123/UBND · Ban hành 09/10/2026

Đã đăng ký

Thượng khẩn

Hạn 16/10 · Còn 7 ngày

Giao xử lý

Tệp văn bản

0 tệp

Chưa có tệp văn bản

Tệp đính kèm sẽ được hiển thị và đọc trực tiếp tại đây.

Thông tin văn bản

Nhiệm vụ liên kết

Chưa có

Luân chuyển và lịch sử

Minh họa cấu trúc mong muốn. Nút “Giao xử lý” chỉ xuất hiện nếu văn bản đang ở bước cho phép và người dùng có quyền thực hiện.

Thứ tự ưu tiên nên là:

1. Nhận diện văn bản và mức độ khẩn.
2. Thao tác nghiệp vụ mà người dùng được phép làm.
3. Nội dung/tệp văn bản.
4. Thuộc tính bổ sung, nhiệm vụ liên kết và lịch sử.

Không nên giấu toàn bộ metadata trong popover “Chi tiết”. Cơ quan ban hành, số/ký hiệu và ngày xử lý thường cần nhìn thấy ngay; những trường ít dùng mới nên nằm trong phần mở rộng.

### 3.3. Khi có PDF, ưu tiên diện tích đọc

Khi văn bản có tệp, Quick View nên hiển thị tệp ngay bên dưới header ngắn gọn, với thanh điều hướng trang và chọn tệp khi có nhiều tệp. Full Page nên dành phần lớn diện tích cho PDF, đưa thuộc tính vào inspector bên phải.

Khi không có tệp, không cần cố kéo dài một khung trống lớn. Empty state gọn, có nút bổ sung tệp cho người được phân quyền, là đủ.

## 4. Những vấn đề phát hiện thêm từ mã nguồn

| Tệp                            | Phát hiện                                                                          | Đề xuất                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `registry/document-ledger.tsx` | Nhãn mức khẩn bắt đầu hiện từ breakpoint 900px nhưng cột chỉ rộng 80px ở bảng rộng | Sửa min-width, co chữ đúng cách, kiểm thử nhiều độ rộng                            |
| `document-registry-view.tsx`   | Có fallback `documentNumber` sang ID hệ thống                                      | Loại bỏ ID nội bộ khỏi giao diện                                                   |
| `document-registry-view.tsx`   | Khi mở pane, focus được chuyển sang nút Đóng                                       | Với pane non-modal, nên ưu tiên giữ focus dòng để tiếp tục duyệt bằng ↑/↓ hoặc j/k |
| `document-workspace-parts.tsx` | Metadata dùng một chuỗi inline dài, ngăn bởi dấu chấm                              | Tách thành nhóm thông tin rõ ràng                                                  |
| `document-detail-parts.tsx`    | “Tạo nhiệm vụ” thực chất dẫn tới `/tasks`                                          | Dẫn tới đúng luồng tạo nhiệm vụ và liên kết văn bản                                |
| `document-quick-view.tsx`      | Nút in gọi `window.print()`                                                        | Tạo giao diện in riêng, tránh in kèm danh sách và sidebar                          |
| `document-quick-view.tsx`      | Trạng thái không có tệp chỉ là một dòng chữ                                        | Thay bằng empty state có hướng dẫn/hành động phù hợp                               |

Một lưu ý quan trọng: `DocumentInfoSections` hiện có panel thao tác dành cho văn bản đi, còn văn bản đến chủ yếu hiển thị nhiệm vụ liên kết và lịch sử. Cần thiết kế các hành động theo đúng quy trình, lấy quyền thao tác từ server; không đơn giản thêm nút “Giao xử lý” vào mọi văn bản.

## 5. Chốt định hướng thị giác

Mình đề xuất phong cách Quiet Minimal + Linear, nhưng bám sát nghiệp vụ quản lý văn bản của QCET.

Thông số thiết kế đề xuất

Màu chủ đạo

QCET Blue

Nền ứng dụng

Neutral Slate

Nội dung chính

14px · Medium

Thông tin phụ

12–13px · Regular

Chiều cao dòng bảng

60–68px

Độ rộng Quick View mặc định

600–640px

Nên giảm cảm giác hai thẻ card lớn đang nằm độc lập bằng một workspace thống nhất, sử dụng đường phân cách nhẹ giữa danh sách và pane. Không thêm gradient, bóng nặng hoặc quá nhiều badge.

Với ảnh hiện tại chỉ có một văn bản và không có tệp, khoảng trống lớn là điều tự nhiên. Không cần thêm dashboard hoặc nội dung giả để lấp chỗ trống. Cần đánh giá thiết kế bằng tập dữ liệu thực tế gồm nhiều văn bản có tiêu đề dài, nhiều mức khẩn, nhiều trạng thái và tệp đính kèm.

## 6. Thứ tự triển khai đề xuất

Giai đoạn 1 — Sửa lỗi hiển thị và dữ liệu (P0)

Cột chồng chữ, mức khẩn bị ẩn nhãn, ID nội bộ, responsive của bảng và các trạng thái tràn chữ. Chưa thay đổi kiến trúc.

Giai đoạn 2 — Tái cấu trúc Quick View (P1)

Header, metadata, hành động theo quyền, PDF, empty state, liên kết nhiệm vụ, hành vi focus và in văn bản. Dùng chung component với Full Page.

Giai đoạn 3 — Hoàn thiện visual và kiểm thử (P2)

Typography, khoảng cách, toolbar, màu, hover, active row và kiểm thử Playwright ở các kích thước desktop/mobile.

### Tiêu chí nghiệm thu

Kiểm thử ở các chiều rộng 1280px, 1440px và 1920px, khi pane đóng/mở hoặc resize. Không cột nào chồng chữ, không có cuộn ngang ngoài ý muốn. Một trích yếu dài 200 ký tự và tên cơ quan dài vẫn phải hiển thị ổn định.

Kiểm thử luồng click dòng, chuyển văn bản bằng bàn phím, mở Full Page, Back/Forward, deep link `?docId=`, đổi tệp PDF, in và tạo nhiệm vụ liên kết. Các hành động nghiệp vụ phải tuân thủ quyền phía server. So sánh screenshot bằng Playwright sau mỗi giai đoạn để hạn chế lỗi hồi quy.

## 7. Prompt giao agent triển khai

Rà soát và cải thiện toàn diện UI/UX phân hệ Văn bản QCET E-Office theo hướng Quiet Minimal / Linear, đồng bộ Task Detail.

**Ưu tiên:**

1. Fix lỗi bảng chồng cột, mức khẩn bị mất nhãn, ID nội bộ hiển thị ra UI, overflow/responsive.
2. Redesign toolbar thành hai tầng; tối ưu hierarchy, typography và density bảng.
3. Redesign Document Quick View: header rõ ràng, metadata có cấu trúc, thao tác nghiệp vụ theo quyền, ưu tiên PDF, empty state gọn, nhiệm vụ liên kết và lịch sử.
4. Sửa nút Tạo nhiệm vụ dẫn sai luồng, kiểm tra hành vi In, keyboard focus và resize.
5. Thống nhất UI giữa Quick View và Full Page bằng component dùng chung.

Giữ nguyên kiến trúc, API, DB, nghiệp vụ và cơ chế phân quyền hiện có. Không rewrite không cần thiết. Không thêm gradient, shadow nặng, card thừa hoặc thông tin giả.

**Quy trình:** Audit → lập kế hoạch và xác định root cause → triển khai từng nhóm → screenshot trước/sau → Playwright responsive + keyboard → typecheck/lint/tests. Báo cáo thay đổi, lỗi đã sửa và vấn đề còn tồn đọng.

Đề xuất cuối cùng: Không nên tiếp tục chỉnh từng padding, màu hoặc icon riêng lẻ. Phần quan trọng nhất là thiết kế lại information hierarchy của bảng và Quick View. Hai vùng này phải phối hợp thành một workspace thống nhất: danh sách để chọn và so sánh, Quick View để đọc nhanh và thao tác, Full Page để làm việc sâu với văn bản/PDF. Đây là thay đổi mang lại hiệu quả UX lớn nhất, trong khi vẫn tận dụng được kiến trúc đã xây dựng.