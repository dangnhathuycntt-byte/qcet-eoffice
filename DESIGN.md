# QCET · tham chiếu thiết kế

Hướng dẫn agent nằm ở [AGENTS.md](AGENTS.md). Tệp này chỉ dẫn nguồn và ghi nhận hiện trạng; không phải yêu cầu thiết kế lại toàn bộ ứng dụng. Quyết định trực tiếp đã duyệt của người dùng có ưu tiên; không tự chọn bản mới hơn hoặc khôi phục trang đã revert.

## Nguồn cần đọc theo phạm vi

- Bộ người dùng chọn: `docs/design-archives/qcet-design-nen-tang-nhiem-vu.zip`. Tra `INDEX.md`, `project/` và `shots/` trong đúng gói khi cần đối chiếu bảng. Gói này không có `FOUNDATIONS.md`; không tạo lại nội dung bằng suy đoán.
- [Bảng bàn giao khác](docs/design-handoff/INDEX.md) là tài liệu tham khảo, không tự thay thế bộ được chọn.
- Token đang chạy: [globals.css](src/app/globals.css). Thành phần dùng chung: [ui](src/components/ui/). Tái sử dụng token/component; không chép các giá trị dưới đây vào từng màn hình.
- Thuật ngữ: [QCET UI Vocabulary](docs/ux/QCET_UI_VOCABULARY.md). Nghiệp vụ và phân quyền: tra [mục lục](docs/Index.md); ví dụ trong bảng thiết kế không quyết định nghiệp vụ.

## Ánh xạ màu hiện tại

Đối chiếu với checkout ngày 2026-10-02; đây là hiện trạng code, không phải bằng chứng mọi khác biệt với bảng gốc đã được duyệt.

| Vai trò | Utility / token | Giá trị hiện tại |
|---|---|---|
| Nền ứng dụng | `bg-background` / `--background` | `#FAFBFC` |
| Panel, popover | `bg-card`, `bg-popover` | `#FFFFFF` |
| Ô nhập, nút phụ | `bg-secondary`, `bg-muted` | `#F2F4F7` |
| Hover | `bg-accent` / `--accent` | `#EAEDF1` |
| Vùng đang chọn | `bg-selected` / `--selected` | `#E1EBF8` |
| Hành động chính | `bg-primary` / `--primary` | `#0058A0` |
| Hover hành động | `bg-primary-hover` / `--primary-hover` | `#004A88` |
| Chữ chính / phụ | `text-foreground`, `text-muted-foreground` | `#1A1D23` / `#5F6671` |
| Lỗi | `text-destructive`, `bg-danger-soft` | `#B91C1C` / `#FBEDED` |
| Nền icon nhấn | `--icon-accent` | `#C0D0F4` |

`--gray-5: #DEE2E8` vẫn tồn tại trong thang xám, nhưng không phải token ngữ nghĩa vùng chọn hiện tại. Hover và selected là hai trạng thái khác nhau.

## Quy ước giao diện nhiệm vụ đã duyệt (phiên 2026-10)

Các điểm dưới đây do người dùng duyệt trực tiếp khi chỉnh danh sách và chi tiết nhiệm vụ; chỉ áp cho phạm vi này, không tự mở rộng sang trang khác.

- Thang chữ gọn: `text-compact` (13px) cho nội dung chính, `text-xs` (12px) cho nhãn, số phụ, tab; không dùng cỡ lẻ 9/10/11px. Nét icon 1,5px (lint bắt buộc).
- Icon nhiệm vụ lấy từ một nguồn: [task-icons.tsx](src/lib/icons/task-icons.tsx) (lưới 19×19, `currentColor`). Trạng thái hiển thị bằng [TaskStatusCircle](src/components/tasks/task-status-circle.tsx), ưu tiên bằng [PrioritySignalBars](src/components/tasks/priority-signal-bars.tsx); không tự vẽ chấm hay icon lucide thay thế.
- Hạn hoàn thành dùng `getDueIndicator` trong [table-date-helpers.ts](src/components/tasks/table/utils/table-date-helpers.ts): đỏ khi trễ hoặc hôm nay, cam trong 7 ngày, còn lại xám; việc đã hoàn thành/hủy luôn xám.
- Chi tiết nhiệm vụ: trang cha và khung việc con dùng chung `TaskStatusSelect`, `TaskAssigneePicker`, `TaskDateRange` ([task-property-controls.tsx](src/components/tasks/detail/task-property-controls.tsx)). Cột phải gồm hai thẻ viền mảnh (Thuộc tính, Việc con); chỉ ô điều khiển sáng lên khi hover, không tô nền cả hàng. Tab "Tổng quan / Hoạt động" nằm bên trái trong thanh header, cùng hàng với nút sao chép liên kết và nút thuộc tính; đường kẻ nằm dưới cả thanh. Kiểu gạch chân (tab đang chọn: chữ đậm, gạch 2px ở đáy, không nền pill), cao 28px, chữ lùi để thẳng mép nội dung; số đếm là badge nhỏ `text-xs`. Thanh breadcrumb desktop ẩn ở `/tasks` và `/tasks/[id]`.
- Mô tả nhiệm vụ tự lưu sau 0,8 giây và hiện "Đang lưu… / Đã lưu" ở góc editor.

## Trang danh sách nhiệm vụ (`/tasks`) — hiện trạng

Ghi nhận từ code ngày 2026-10-09 ([page.tsx](src/app/tasks/page.tsx), [tasks-page-client.tsx](src/app/tasks/tasks-page-client.tsx), [task-row.tsx](src/components/tasks/table/components/task-row.tsx), [mobile-task-card.tsx](src/components/tasks/mobile-task-card.tsx), [task-kanban-board.tsx](src/components/tasks/task-kanban-board.tsx)). Đây là hiện trạng, không phải bằng chứng mọi chi tiết đã được duyệt.

- Phạm vi xem (`?view=`): Cá nhân (`related`), Đơn vị (`unit`), Toàn trường (`all`), Chờ duyệt (`approval`). Tham số `scope` cũ được chuyển hướng sang `view`. Chế độ hiển thị là bảng (mặc định) hoặc kanban, đồng bộ trên URL.
- Nhãn trạng thái: Mới, Đang thực hiện, Chờ duyệt, Chờ BGH duyệt, Cần chỉnh sửa; hạn quá thì hiện "Trễ hạn". Nhãn ưu tiên: Thấp, Bình thường, Cao, Khẩn cấp.

**Bảng (desktop)**
- Hàng: `h-12` (48px). Tên nhiệm vụ dùng `text-compact` đậm vừa; mã và số phụ dùng `text-xs`, font mono, số tabular.
- Tiêu đề cột: `h-11`, `text-xs`, dính đầu bảng trên nền `bg-card`. Icon sắp xếp `size-3`, nét 1,5.
- Trạng thái dùng `TaskStatusCircle` (`size-4`), màu trung tính. Ưu tiên dùng `PrioritySignalBars` (`size-4`); nhãn chữ chỉ hiện từ `lg`. Khẩn cấp là `text-rose-600`, các mức còn lại trung tính.
- Hạn dùng `getDueIndicator` (xem mục trên).
- Phân trang: `h-7`, `text-xs`.
- Thanh công cụ: control `h-7` (chip, nút phụ), `h-8.5` (ô tìm kiếm, nút icon), `h-9` (select). Bo `rounded-lg`, nền `bg-card`, viền `border-border/70`–`/80`, bóng `shadow-2xs`.

**Di động**
- Ô tìm kiếm và nút công cụ: `min-h-[44px]` là vùng chạm có chủ đích, giữ nguyên. Bo `rounded-xl`.
- Thẻ nhiệm vụ: `rounded-xl`, `p-3.5`, `min-h-[48px]`. Tiêu đề `text-[14px]` đậm, tối đa 2 dòng; mã `font-mono text-xs`; chip trạng thái `h-5.5`; thanh tiến độ `h-1.5`. Bộ lọc mở bằng sheet.

**Kanban**
- Cột: `w-[280px] xl:w-full`, `min-w-[270px]`, nền `bg-muted/30`, bo `rounded-2xl`, viền `border-border/30`, `p-2.5 sm:p-3`. Nút trên cột cao `h-7`–`h-8`.
- Thẻ: `rounded-2xl`, nền `bg-white`, viền `border-border/40`, `p-3.5 sm:p-4`, khoảng cách `gap-2`.
- Mỗi cột có chấm màu `size-1.5` theo cấu hình cột (xem khác biệt bên dưới).

## Khác biệt của trang nhiệm vụ so với quy ước đã duyệt

Chỉ ghi nhận, chưa sửa code. Cần người dùng quyết định trước khi đổi.

- Hàng bảng 48px và tiêu đề 44px, trong khi quy ước compact ghi hàng ≤ 32px và `h-7` cho control. Mật độ hiện tại thoải mái hơn quy ước.
- Cỡ lẻ còn trong trang: `text-[10px]` (2 chỗ ở thanh công cụ), `text-[14px]` (tiêu đề thẻ di động), `text-sm` (ô tìm kiếm di động). Quy ước ghi không dùng cỡ lẻ.
- Màu cố định thay vì token: `bg-white` của thẻ kanban; `text-sky-*`/`bg-sky-50` cho mã chip; `text-rose-*`, `text-amber-*`, `text-emerald-*` rải rác trong hàng và thẻ di động.
- Ưu tiên trong form tạo nhiệm vụ dùng màu xanh/amber/rose (`iconColor` ở `create-task-form-utils.ts`), còn bảng dùng chỉ báo trung tính. Hai nơi chưa thống nhất.
- Kanban dùng chấm màu cho cột, còn quy ước ghi trạng thái chỉ dùng `TaskStatusCircle`. Cần chốt đây là ngoại lệ hay phải đổi.

## Sổ văn bản, Quick View và trang chi tiết văn bản

Quyết định đã được người dùng duyệt (D1–D15 trong [document-workspace.md](docs/product/specs/document-workspace.md)); phần "hiện trạng" ghi từ code ngày 2026-10-09.

- Kiến trúc lai: **Quick View** (pane không modal ở `/documents?docId=`, danh sách vẫn cuộn/chọn/lọc được) và **Full Page** (route riêng, PDF-first). Cùng một bộ khung dữ liệu: [document-view-model.ts](src/lib/documents/document-view-model.ts), `DocumentSummaryBlock`, `DocumentInfoSections` trong [workspace/](src/components/documents/workspace/).
- Pane: desktop khi vùng workspace đủ `LIST_MIN 480 + PANE_MIN 440` px; hẹp hơn là overlay modal toàn màn hình (hysteresis 24px). Độ rộng mặc định 640, kéo trong 440–1100, nhớ ở `localStorage` (`qcet_document_pane_width`); thanh kéo dùng được bằng bàn phím (←/→ 20px, Home đặt lại). Ngăn với danh sách bằng một đường kẻ mảnh, không bóng, không lớp phủ.
- Bảng sổ văn bản đổi cột theo độ rộng **của chính bảng** (container query): dưới 720px chỉ còn văn bản, hạn xử lý, trạng thái; từ 720px thêm mức khẩn và ngày ban hành; từ 1100px thêm cơ quan ban hành và chủ trì.
- Lịch sử: mở pane là push, đổi văn bản/tệp là replace, đóng bằng nút/Esc là `history.back()` khi pane do danh sách mở (deep link thì replace), Back đóng pane, Forward mở lại. Esc đóng popover trước rồi mới đóng pane.
- Trình xem tệp: rail dọc 44px (nhóm Xem — Trang — Tìm — Khung — Tệp), nút `size-8`, icon 16px nét 1,5, tooltip bên trái. Nhiều tệp: 2–8 tệp có vạch; mọi trường hợp ≥ 2 tệp có nút "Tệp N" mở danh sách (hàng 32px, popover 256px). Danh sách tệp ở Quick View mở khi ≤ 5 tệp, thu gọn khi nhiều hơn, nhớ lựa chọn (`qcet_document_files_pref`).
- PDF dựng theo cửa sổ (trang quanh khung nhìn ± 2), mỗi trang giữ chỗ đúng khổ riêng; tìm kiếm chạy trên chỉ mục văn bản của mọi trang. Toàn màn hình dùng Fullscreen API trên chính phần tử trình xem (không đổi tệp/zoom/trang); thiết bị không hỗ trợ thì mở Full Page.
- Full Page: đầu trang gọn (tiêu đề, metadata, thao tác chính), trình xem chiếm phần còn lại và tự cuộn; thuộc tính, nhiệm vụ liên kết, luân chuyển, nhật ký nằm trong panel 320px không modal, mặc định đóng, mở từ nút "Thông tin" (nhớ ở `qcet_document_info_panel`). Dưới 1024px xếp dọc, panel nằm dưới trình xem. Tệp đang xem theo `?file=`; zoom và trang từng tệp nhớ trong `sessionStorage`.
- Cỡ chữ và control theo thang compact ở đầu tài liệu; không thêm badge hay màu mới, trạng thái dùng `TaskStatusCircle`.

**Chưa kiểm chứng bằng mắt:** chưa so với bảng thiết kế gốc (chưa có bộ thiết kế được duyệt cho phân hệ Văn bản); kích thước đã đối chiếu trên Chrome ở 1440, 1000 và 390px qua ảnh chụp E2E.

## Component và trạng thái

- Font Be Vietnam Pro được cấu hình trong [layout.tsx](src/app/layout.tsx); chọn cỡ và weight theo bảng liên quan, không suy ra weight mới chỉ vì font đã được nạp.
- Kích thước và bo góc lấy từ token và variant của [Button](src/components/ui/button.tsx), [Input](src/components/ui/input.tsx) cùng component tương ứng. Không áp một kích thước chung cho mọi control.
- Giữ trạng thái focus bàn phím, disabled, loading, empty, error và reduced motion. Đối chiếu responsive tại viewport của bảng và kiểm tra vùng bấm trên điện thoại khi sửa UI.
- Đăng nhập và onboarding là luồng riêng; chỉ đọc bảng và code của luồng đó khi có yêu cầu. Không áp lại toàn bộ màn hình từ gói thiết kế khi đang sửa component khác.

## Khác biệt chưa được giải quyết bởi lần dọn tài liệu này

- Gói thiết kế gốc ghi nút chính than chì `#25282F`; token hiện tại dùng xanh `#0058A0`. Bản tóm tắt cũ tại gốc đã dùng xanh trước lần rà soát này; không tự đổi lại màu theo ZIP.
- Bản tóm tắt cũ ghi ô nhập bo 12px và control mobile cao 48px đồng loạt; `Input` hiện dùng bo 8px, cao 48/36px và `Button` mặc định cao 44/34px (mobile/desktop). Cần đối chiếu bảng đúng phạm vi trước khi thay đổi.
- Các giá trị, ví dụ lifecycle, đăng nhập, onboarding hoặc thời hạn lưu trữ trong artifact không tự trở thành quyết định sản phẩm. Chỉ xử lý khác biệt khi tác vụ liên quan yêu cầu và có căn cứ.
