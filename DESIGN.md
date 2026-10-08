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
- Chi tiết nhiệm vụ: trang cha và khung việc con dùng chung `TaskStatusSelect`, `TaskAssigneePicker`, `TaskDateRange` ([task-property-controls.tsx](src/components/tasks/detail/task-property-controls.tsx)). Cột phải gồm hai thẻ viền mảnh (Thuộc tính, Việc con); chỉ ô điều khiển sáng lên khi hover, không tô nền cả hàng. Tab "Tổng quan / Hoạt động" căn trái dưới dải đầu trang; thanh breadcrumb desktop ẩn ở `/tasks` và `/tasks/[id]`.
- Mô tả nhiệm vụ tự lưu sau 0,8 giây và hiện "Đang lưu… / Đã lưu" ở góc editor.

## Component và trạng thái

- Font Be Vietnam Pro được cấu hình trong [layout.tsx](src/app/layout.tsx); chọn cỡ và weight theo bảng liên quan, không suy ra weight mới chỉ vì font đã được nạp.
- Kích thước và bo góc lấy từ token và variant của [Button](src/components/ui/button.tsx), [Input](src/components/ui/input.tsx) cùng component tương ứng. Không áp một kích thước chung cho mọi control.
- Giữ trạng thái focus bàn phím, disabled, loading, empty, error và reduced motion. Đối chiếu responsive tại viewport của bảng và kiểm tra vùng bấm trên điện thoại khi sửa UI.
- Đăng nhập và onboarding là luồng riêng; chỉ đọc bảng và code của luồng đó khi có yêu cầu. Không áp lại toàn bộ màn hình từ gói thiết kế khi đang sửa component khác.

## Khác biệt chưa được giải quyết bởi lần dọn tài liệu này

- Gói thiết kế gốc ghi nút chính than chì `#25282F`; token hiện tại dùng xanh `#0058A0`. Bản tóm tắt cũ tại gốc đã dùng xanh trước lần rà soát này; không tự đổi lại màu theo ZIP.
- Bản tóm tắt cũ ghi ô nhập bo 12px và control mobile cao 48px đồng loạt; `Input` hiện dùng bo 8px, cao 48/36px và `Button` mặc định cao 44/34px (mobile/desktop). Cần đối chiếu bảng đúng phạm vi trước khi thay đổi.
- Các giá trị, ví dụ lifecycle, đăng nhập, onboarding hoặc thời hạn lưu trữ trong artifact không tự trở thành quyết định sản phẩm. Chỉ xử lý khác biệt khi tác vụ liên quan yêu cầu và có căn cứ.
