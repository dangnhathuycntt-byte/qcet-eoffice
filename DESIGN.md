# QCET · tham chiếu thiết kế

Hướng dẫn agent nằm ở [AGENTS.md](AGENTS.md). Tệp này ghi **hiện trạng code** (rà lại ngày 2026-10-10) và các quyết định người dùng đã duyệt; không phải yêu cầu thiết kế lại. Quyết định trực tiếp của người dùng có ưu tiên. Giá trị nào chưa khớp nhau được ghi ở mục cuối, không tự sửa.

## Nguồn

- Token đang chạy: [globals.css](src/app/globals.css). Thành phần dùng chung: [ui/](src/components/ui/). Dùng token/component, không chép giá trị hex hay px vào từng màn hình.
- [Bảng bàn giao](docs/design-handoff/INDEX.md) là tài liệu tham khảo, không tự thay quyết định đã duyệt.
- Thuật ngữ: [QCET UI Vocabulary](docs/ux/QCET_UI_VOCABULARY.md). Nghiệp vụ và phân quyền: [mục lục](docs/Index.md). Ví dụ trong bảng thiết kế không quyết định nghiệp vụ.
- Chưa có bộ thiết kế được duyệt cho phân hệ Văn bản. Gói `qcet-design-nen-tang-nhiem-vu.zip` từng được nhắc ở bản cũ hiện không có trong repo.

## Token

**Màu** (thang `--gray-*`, `--accent-*` → token ngữ nghĩa kiểu shadcn; app chỉ có giao diện sáng, `<html class="light">`):

| Vai trò | Utility | Giá trị |
|---|---|---|
| Nền ứng dụng | `bg-background` | `#FAFBFC` |
| Thẻ, panel, popover | `bg-card`, `bg-popover` | `#FFFFFF` |
| Ô nhập, nút phụ | `bg-secondary`, `bg-muted` | `#F2F4F7` |
| Hover; viền | `bg-accent`; `border-border` | `#EAEDF1` |
| Đường ngăn trung tính | `--gray-5` | `#DEE2E8` |
| Vùng đang chọn | `bg-selected` | `#E1EBF8` |
| Hành động chính / hover | `bg-primary` / `bg-primary-hover` | `#0058A0` / `#004A88` |
| Chữ chính / phụ | `text-foreground` / `text-muted-foreground` | `#1A1D23` / `#5F6671` |
| Lỗi; tín hiệu trễ hạn, khẩn | `text-destructive`, `bg-danger-soft` | `#B91C1C` / `#FBEDED` |
| Tín hiệu sắp tới hạn, mức khẩn vừa | `text-warning` | `#B45309` (~5:1 trên trắng) |
| Nền icon nghiệp vụ | `--icon-accent` | `#C0D0F4` |
| Icon loại tệp (chỉ trang trí) | `text-file-pdf` / `-word` / `-excel` / `-slide` / `-image` / `-archive` | `#C62828` / `#2B579A` / `#1D6F42` / `#C43E1C` / `#6D4BB5` / `#6B6F76` |

Hover (`accent`) và đang chọn (`selected`) là hai trạng thái khác nhau. Nút chính là xanh `#0058A0`; màu than chì `#25282F` trong gói thiết kế cũ không áp dụng.

**Chữ:** Be Vietnam Pro (`next/font`, [layout.tsx](src/app/layout.tsx)); mono là font hệ thống. Thang: `text-xs` 12px · `text-compact` 13px/18px · `text-sm` 14px · 16 · 20 · 24 · 28px. Không dùng cỡ tùy biến `text-[…px]`.

**Bo góc:** `--radius-chip` 8px · `--radius-control` 12px · `--radius-card` 14px · `--radius-panel` 16px · `--radius-menu` 14px. Utility Tailwind `rounded-sm/md/lg/xl` = 8/12/14/16px.

**Kích thước control:** `--control-height` 34px · `--control-height-sm` 28px · `--touch-target` 44px · avatar 20 (bảng) / 24 / 32px · sidebar 254px / 64px khi thu gọn.

## Component nền

- [Button](src/components/ui/button.tsx): mobile luôn cao 44px; desktop `default` 34px (`text-sm`), `sm`/`xs` 28px (`text-xs`), `icon` 34px, `icon-sm`/`icon-xs` 28px.
- [Input](src/components/ui/input.tsx): bo 12px, nền `bg-secondary`, không viền; thường 48px mobile / 36px desktop, `compact` 44 / 28px (`text-compact`).
- **Kích thước bảng:** hàng một dòng 40px, hàng hai dòng 48px; tiêu đề cột cao bằng hàng; item popover/menu ≤ 32px.
- **Ưu tiên / mức khẩn:** chỉ mức cao nhất (Khẩn cấp, Hỏa tốc, Thượng khẩn) dùng `text-destructive`; Khẩn của văn bản dùng `text-warning`; các mức khác trung tính. Áp cho cả bảng lẫn form tạo nhiệm vụ.
- Trạng thái nhiệm vụ: [TaskStatusCircle](src/components/tasks/task-status-circle.tsx). Ưu tiên / mức khẩn: [PrioritySignalBars](src/components/tasks/priority-signal-bars.tsx). Icon nghiệp vụ: [task-icons.tsx](src/lib/icons/task-icons.tsx). Không tự vẽ chấm hay thay bằng icon lucide.
- Icon lucide nét 1,5px (lint bắt buộc).
- Giữ đủ trạng thái focus bàn phím, disabled, loading, empty, error, reduced motion.

## Trang danh sách (Nhiệm vụ là chuẩn, Văn bản dùng chung)

Người dùng chọn thanh công cụ Nhiệm vụ làm chuẩn (2026-10-10). Phần dùng chung nằm ở [list-toolbar.tsx](src/components/ui/list-toolbar.tsx) và [active-filter-breadcrumb.tsx](src/components/workspace/components/active-filter-breadcrumb.tsx):

- **Thanh công cụ một hàng:** tiêu đề trang (`text-compact` đậm) bên trái; bên phải theo thứ tự tìm · lọc · hiển thị · hành động chính. Mọi control cao 28px (`h-7`), bo `rounded-md`, viền `border-border/80`, nền `bg-background`. Đường kẻ `border-border/60` dưới thanh.
- **Ô tìm** `ListToolbarSearch`: rộng 140px (mobile) / 180px, focus thì giãn 240px (`LIST_TOOLBAR_SEARCH_*`); phím `/` để focus.
- **Nút lọc** hiện số bộ lọc bằng `ListToolbarCountBadge`. Nút chính dùng `listToolbarPrimaryButtonClass` (dấu `+` và nhãn).
- **Hàng bộ lọc** `ActiveFilterBar` + `FilterSegmentChip` ("Nhãn: Giá trị ✕" kèm icon loại bộ lọc), bên phải là "↺ Xóa lọc" và "x kết quả". Chỉ hiện khi có bộ lọc; cách đường kẻ và bảng 16px. Khi không có bộ lọc, bảng cũng cách đường kẻ 16px.
- Riêng Nhiệm vụ có thêm nút "Xóa bộ lọc" (`ListToolbarClearFiltersButton`) cạnh nút lọc; Văn bản đã bỏ nút này theo yêu cầu.

## Nhiệm vụ

- **Danh sách** (`/tasks`): phạm vi `?view=` Cá nhân / Đơn vị / Toàn trường / Chờ duyệt; bảng hoặc kanban, đồng bộ URL. Hàng bảng 48px (hai dòng), tiêu đề cột 48px ([task-row.tsx](src/components/tasks/table/components/task-row.tsx), [task-table-header.tsx](src/components/tasks/table/components/task-table-header.tsx)).
- **Hạn** dùng `getDueIndicator` ([table-date-helpers.ts](src/components/tasks/table/utils/table-date-helpers.ts)): `destructive` khi trễ hoặc hôm nay, `warning` khi còn ≤ 7 ngày, còn lại xám; việc hoàn thành/hủy luôn xám. Thẻ di động dùng cùng quy tắc.
- **Chi tiết (đã duyệt):**
  - Trang cha và khung việc con dùng chung `TaskStatusSelect`, `TaskAssigneePicker`, `TaskDateRange` ([task-property-controls.tsx](src/components/tasks/detail/task-property-controls.tsx)).
  - Cột phải gồm hai thẻ viền mảnh (Thuộc tính, Việc con); chỉ ô điều khiển sáng khi hover.
  - Tab "Tổng quan / Hoạt động" gạch chân 2px, cao 28px.
  - Khung việc con rộng 560px (`--subtask-peek-width`).
  - Mô tả tự lưu sau 800ms.
  - Breadcrumb desktop ẩn ở Nhiệm vụ, Hộp thư, Sổ văn bản.
- **Di động:** vùng chạm 44px là chủ đích. Thẻ nhiệm vụ `rounded-xl`, tiêu đề tối đa 2 dòng; bộ lọc mở bằng sheet.
- **Kanban:** cột `bg-muted/30`, bo 16px; thẻ `bg-card`, bo 16px; trạng thái cột dùng `TaskStatusCircle`.

## Văn bản

Kiến trúc đã duyệt ở [document-workspace.md](docs/product/specs/document-workspace.md) (D1–D17, §17). Code: [registry/](src/components/documents/registry/), [workspace/](src/components/documents/workspace/), [document-view-model.ts](src/lib/documents/document-view-model.ts).

**Sổ văn bản** (`/documents`)
- Loại sổ và nhóm ở sidebar (Chờ xử lý / Đã xử lý / Đã phát hành, `bucket`) là phạm vi xem, không phải bộ lọc: không hiện chip, "Xóa lọc" không bỏ đi, trạng thái rỗng không báo "không khớp bộ lọc".
- Trạng thái rỗng (`getLedgerEmptyCopy`) đặt giữa vùng danh sách (min 48vh), có icon, nội dung theo ngữ cảnh: có từ khóa thì nêu từ khóa; chỉ bộ lọc thì "không khớp bộ lọc" + "Xóa bộ lọc"; nhóm trống thì nói nhóm đó sẽ hiện gì (Đã xử lý/Đã phát hành có lối "Xem văn bản chờ xử lý"); sổ trống thì nút tạo theo loại sổ.
- Thanh công cụ và hàng bộ lọc theo mục *Trang danh sách*. Ô tìm có placeholder "Tìm văn bản… /", tìm theo số, ký hiệu, trích yếu.
- Hàng và tiêu đề cột tối thiểu 40px (cỡ medium của Carbon). `line-clamp-*` đặt `display: -webkit-box`, nên không đặt chung thẻ với `hidden` của ô ẩn theo độ rộng (làm lệch cột); đặt ở thẻ con. Trích yếu một dòng, cắt cuối, tooltip hiện toàn văn khi hover/focus và chỉ khi bị cắt. Cơ quan ban hành và Chủ trì không ghi tắt: cột giãn theo chỗ trống (`minmax(144px,0.4fr)`), tên dài xuống tối đa 2 dòng (hàng 48px). Số, ký hiệu (do cơ quan ban hành cấp, hiển thị nguyên văn) nằm sau trích yếu khi bảng ≥ 1100px. Số đến không hiện trong hàng.
- Cột đổi theo độ rộng **của bảng** (container query):
  - < 720px: chọn · văn bản · hạn 96 · bước xử lý 112.
  - 720–1099px: thêm mức khẩn (icon, 28) và ngày ban hành.
  - ≥ 1100px: thêm cơ quan ban hành và chủ trì (144 mỗi cột); mức khẩn có nhãn (112).
- Mức khẩn mỗi mức một icon: Hỏa tốc dấu chấm than, Thượng khẩn 3 cột (`destructive`), Khẩn 2 cột (`warning`), Thường 1 cột. Màu không thay nhãn.
- Hạn: `destructive` khi trễ, `warning` khi hôm nay hoặc còn ≤ 2 ngày. Ngưỡng này khác Nhiệm vụ (≤ 7 ngày) **có chủ đích**: SPEC §17.4B không áp quy tắc hạn của nhiệm vụ sang văn bản.
- Ngày luôn có năm `dd/MM/yyyy`, chỉ rút gọn `dd/MM` khi đang lọc đúng năm đó. Giá trị rỗng hiện `—` kèm tên truy cập.
- Đang xem: `aria-current` + `bg-selected`. Đã chọn để thao tác hàng loạt: checkbox + `aria-selected`. Hai trạng thái độc lập.

**Quick View**
- Pane không modal khi vùng workspace ≥ 942px (480 danh sách + 22 khung + 440 pane). Đang pane thì xuống overlay ngay dưới ngưỡng; từ overlay chỉ quay lại pane khi ≥ 966px.
- Độ rộng mặc định 640, kéo trong 440–1100, nhớ `qcet_document_pane_width`; thanh kéo dùng được bằng bàn phím.
- Đường chia kéo giãn (pane văn bản, pane việc con) và nút thu gọn sidebar có grip `ResizeGrip` luôn hiện: 4×32px ở giữa khe, `border` lúc nghỉ, đậm hơn khi hover, `primary` khi kéo/focus. Vùng kéo 24px bắc qua khe; thẻ chứa để `overflow: visible` (nội dung bo góc ở lớp trong) để vùng kéo không bị cắt.
- Overlay hẹp là dialog modal: nền `inert`, focus vào nút Đóng, Esc đóng.
- Header 40px gồm loại · số đến (chữ số đều cột, không dùng font mono); bên phải: Mở trang đầy đủ, menu "Thao tác khác" (Sửa thông tin, Thêm tệp khi có quyền; in phiếu, chữ ký số), Đóng.
- Thân chỉ có thao tác theo bước của quy trình (nút chính); không có hàng nút Sửa/Thêm tệp riêng.
- Trích yếu 16/24px tối đa 2 dòng, có "Xem thêm".
- Thuộc tính chính là lưới nhãn–giá trị (nhãn 12px, cột nhãn 112px, hàng 28px): Trạng thái (kèm mức khẩn) · Hạn xử lý ("dd/MM/yyyy · Còn N ngày", cùng nhãn và màu với cột hạn của bảng) · Số, ký hiệu · Ban hành · Cơ quan ban hành. Pane ≥ 560px chia 2 cột, hẹp hơn 1 cột; trường trống không hiện. Dòng "Nhiệm vụ" (nhiệm vụ liên kết hoặc "Chưa có · Tạo nhiệm vụ") nối tiếp lưới, cùng cột nhãn.
- Các khối trong thân cách nhau 12px. Mục "Chi tiết và luân chuyển" thu gọn mặc định, gom thuộc tính còn lại, ý kiến chỉ đạo và luân chuyển/quy trình.
- Không có danh sách tệp riêng: nút "Tệp N" ở dòng tên tệp là nơi chọn tệp (bỏ quyết định D15 theo yêu cầu làm gọn ngày 10/10).
- Khi chi tiết còn tải, không hiện thao tác nào dựng từ dữ liệu dòng danh sách.

**Trình xem tệp**
- Dòng tên tệp 32px bám đầu vùng cuộn, kèm nút "Tệp N" khi có ≥ 2 tệp.
- Rail dọc 44px gồm Xem · Trang · Tìm · Khung, nút 32px. Rail tự gộp thu phóng và trang khi vùng cuộn thấp.
- Thu phóng ghi "Vừa rộng" hoặc "x% so với vừa chiều rộng". Số trang hiện một dòng `3/12`.
- Icon loại tệp `FileTypeIcon` ([file-type-icon.tsx](src/components/documents/file-type-icon.tsx)): tờ giấy tô màu định dạng, nhãn trắng (PDF, W, X, P; ảnh, tệp nén), 20px, `aria-hidden` vì tên tệp đã có đuôi. Dùng ở dòng tên tệp, menu "Tệp N", danh sách tệp ở Full Page. Màu icon không mang trạng thái.
- Xem trước được: PDF, ảnh, Word `.docx` (docx-preview, nạp khi cần; không dựng altChunk, lọc liên kết chỉ giữ http(s)/mailto/#; bảng căn giữa rộng hơn vùng chữ lấn đều hai lề như Word). `.doc`, Excel, PowerPoint, tệp nén: không.
- Không chọn tệp: mở tệp đầu (bản gốc); nếu tệp đầu không xem trước được mà còn tệp xem được thì mở tệp đó.
- Tệp không xem trước được: thông báo nêu định dạng ("Tệp Excel (.xlsx)…"), nút Tải về và "Xem <tệp khác>" khi có; không hiện rail công cụ xem (Full Page chỉ giữ nút panel thông tin).
- PDF dựng theo cửa sổ trang; tìm kiếm chạy trên mọi trang. Bản scan không có lớp chữ thì báo rõ không tìm được.

**Full Page:** trình xem chiếm phần chính; panel thông tin 320px không modal, mặc định đóng. Tệp đang xem theo `?file=`.

## Đã thống nhất ngày 2026-10-10

- AGENTS.md, SPEC Văn bản và code dùng cùng chuẩn chiều cao hàng (40/48px, tiêu đề cột bằng hàng). Tiêu đề cột bảng Nhiệm vụ đã nâng từ 44 lên 48px.
- Component dùng chung của trang danh sách (`list-toolbar`, `active-filter-breadcrumb`), thanh công cụ, bảng, kanban, thẻ di động, form tạo nhiệm vụ và Văn bản đang dùng (ledger, Quick View, trình xem, form vào sổ) không còn cỡ chữ tùy biến.
- Trong các phạm vi trên, màu tín hiệu (trễ hạn, sắp hạn, lỗi nhập, khẩn) dùng `text-destructive`/`bg-danger-soft` và `text-warning` (token mới `--warning`) thay cho `rose-*`/`amber-*`. Ưu tiên ở form tạo nhiệm vụ theo cùng quy tắc với bảng.

## Còn tồn (ngoài phạm vi lần thống nhất này)

- Còn khoảng 236 chỗ cỡ chữ tùy biến (43 file) và 648 chỗ `rose-*`/`amber-*` (103 file) ở các màn khác: cockpit lãnh đạo, portal, lịch, PWA, trang showcase. Cần làm theo từng màn, kèm kiểm trên trình duyệt.
- Bảng màu trạng thái nhiều sắc (xanh, tím, lục, cam, đỏ) vẫn dùng palette Tailwind: `STATUS_BADGE_CONFIGS` trong [constants.ts](src/components/tasks/table/constants.ts), nhãn trạng thái trong [document-badges.ts](src/components/documents/document-badges.ts), `iconColor` cột kanban (không còn được đọc). Đây là màu phân loại, chưa có token; cần quyết định riêng trước khi đổi.
- Icon loại văn bản `FileText` màu cam trong [document-quick-entry-modal.tsx](src/components/documents/document-quick-entry-modal.tsx) là màu trang trí, chưa đổi.
- `document-stats-summary.tsx`, `document-filter-bar.tsx`, `document-table.tsx` trong `registry/` không còn được trang `/documents` dùng, vẫn còn cỡ chữ/màu cũ.
- `PriorityIndicator` trong [task-row.tsx](src/components/tasks/table/components/task-row.tsx) không còn được dùng (bảng dùng `PrioritySignalBars`) nhưng chưa xóa.
- Trang Nhiệm vụ còn nút "Xóa bộ lọc" cạnh nút lọc, Văn bản thì không. `tests/unified-task-toolbar.test.ts` đang yêu cầu nút này.
