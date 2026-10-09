# QCET Design System Conventions & Architecture Blueprint

## 1. Triết lý Thiết kế (Core Philosophy)
- **Không viền, không thẻ để ngăn vùng (Borderless & Cardless Lists)**: Phân tách bố cục và danh sách bằng các lớp nền (`#FAFBFC`, `#FFFFFF`, `#F2F4F7`) và khoảng trắng theo lưới 4px, không dùng đường kẻ hay thẻ đóng khung cứng nhắc.
- **Một màu nhấn xanh thương hiệu (`#0058A0`)**: Dành riêng cho hành động chính và vùng đang chọn (`#E1EBF8`). Màu sắc khác chỉ xuất hiện khi thực sự mang thông tin nghiệp vụ (ví dụ: `#B91C1C` cho quá hạn/xóa).
- **Trạng thái dùng hình khối icon, không dùng màu sắc rực rỡ**: Trạng thái nhiệm vụ dùng icon nét mảnh 16px xám (`#5F6671`), "Hoàn thành" là icon đặc. Mức ưu tiên dùng 4 vạch tăng dần (chỉ "Khẩn cấp" có màu đỏ).
- **Mỗi màn hình chỉ có 1 nút đặc chính**: Nút hành động chính (`variant="default"`) luôn đặt bên phải cùng hoặc vị trí ưu tiên; các nút phụ dùng `secondary` hoặc `ghost`.

---

## 2. Thang Màu 12 Bậc (12-Step Grayscale Ramp & Semantic Tokens)
QCET áp dụng thang màu ngữ nghĩa chuẩn hóa (Radix-like semantic mapping) trong `@theme inline`:

| Bậc | Token CSS / Tailwind | Giá trị HEX | Mục đích sử dụng |
|---|---|---|---|
| **1** | `bg-background` / `color-bg-app` | `#FAFBFC` | Nền trang toàn ứng dụng (ngoài panel) |
| **2** | `bg-card` / `bg-popover` / `color-bg-panel` | `#FFFFFF` | Nền panel trắng, hộp thoại modal, popover, menu |
| **3** | `bg-secondary` / `color-bg-control` | `#F2F4F7` | Ô nhập liệu (Input), nút phụ, chip, nền nhóm |
| **4** | `bg-accent` / `color-bg-hover` | `#EAEDF1` | Trạng thái hover dòng bảng, nút bấm, menu item |
| **5** | `bg-selected` / `color-bg-selected` | `#E1EBF8` | Vùng đang chọn (xanh nhạt), tab active |
| **6** | `bg-mark` | `#DADDE2` | Ô chọn checkbox chưa tick, thanh trượt |
| **7** | `fg-faint` | `#C9CDD3` | Tay nắm kéo thả khối (⠿), dấu phân chia mờ |
| **8** | `text-disabled` / `fg-disabled` | `#9AA0A9` | Chữ và icon vô hiệu hóa (miễn trừ tương phản) |
| **9** | `bg-primary` / `color-action` | `#0058A0` | Nút hành động chính, checkbox tick, công tắc bật |
| **10** | `bg-primary-hover` / `color-action-hover` | `#004A88` | Hover trên nút chính |
| **11** | `text-muted-foreground` / `color-text-secondary` | `#5F6671` | Nhãn form, phụ đề, chú thích, gợi ý (đạt tương phản 5.8:1) |
| **12** | `text-foreground` / `color-text-primary` | `#1A1D23` | Tiêu đề và chữ nội dung chính |

### Các màu phản hồi đặc biệt:
- `text-destructive` / `color-feedback-danger`: `#B91C1C` (Trễ hạn, nút xóa)
- `bg-danger-soft` / `color-feedback-danger-bg`: `#FBEDED` (Nền ô lỗi, nền nút xóa mềm)
- `color-icon-accent`: `#C0D0F4` (Nền chip icon 28px)
- `color-overlay`: `rgba(0, 0, 0, 0.40)` (Lớp tối backdrop sau hộp thoại modal)

---

## 3. Typography & Chữ viết (Be Vietnam Pro & Thang 7 Bậc)
- **Phông chữ chuẩn**: `Be Vietnam Pro` (`var(--font-sans)`). Văn bản hành chính nhà nước có thể dùng `Tinos` (`var(--font-serif)`).
- **Thang cỡ chữ tối ưu hóa 7 bậc chuẩn**:

| Bậc cỡ chữ | Kích thước | Class Tailwind | Line Height | Mục đích sử dụng |
|---|---|---|---|---|
| **Caption** | 12px | `text-xs` | 16px (`leading-4`) | Nhãn phụ, badge, tag, gợi ý form, timestamp |
| **Compact** | 13px | `text-[13px]` | 18px (`leading-[18px]`) | Bảng dữ liệu gọn (linear table), danh sách việc con |
| **Body** | 14px | `text-sm` | 20px (`leading-5`) | Chữ nội dung chính, ô nhập Input, nút bấm chuẩn |
| **Subtitle** | 16px | `text-base` | 24px (`leading-6`) | Tiêu đề khối panel, tiêu đề modal, tên văn bản |
| **Title** | 20px | `text-xl` | 28px (`leading-7`) | Tiêu đề thẻ quan trọng, modal lớn |
| **Headline**| 24px | `text-2xl` | 32px (`leading-8`) | Tiêu đề trang, số đếm thống kê trung bình |
| **Hero** | 28px | `text-[28px]` | 36px (`leading-9`) | Chỉ số đo lường chính (StatsTile), số liệu quan trọng |

- **Ba độ đậm, mỗi độ một việc**:
  - `600` (Semibold): Tiêu đề trang, tiêu đề modal, tiêu đề khối (28, 24, 20, 16px).
  - `500` (Medium): Nhãn giao diện, nút bấm, tab đang chọn, filter chip (14, 12, 13px).
  - `400` (Regular): Nội dung văn bản, mô tả, dòng danh sách gọn (14, 12, 13px).
- **Số, Ngày và Mã**: Luôn sử dụng class `tabular-nums` để thẳng hàng cột (ví dụ: `28/09/2026`, `0/1`, `NV-2026-09-129`).
- **Quy tắc**: Tuyệt đối không dùng các kích thước chữ lẻ ngoài thang 7 bậc (như `text-[9px]`, `text-[10px]`, `text-[11px]`). Cỡ chữ nhỏ nhất cho phép trên toàn giao diện là 12px (`text-xs`).

---

## 4. Hệ Thống Bo Góc (Border Radius Hierarchy)
- `8px` (`rounded-sm`): Chip nhỏ, badge, nút toolbar (26/28px), mục menu thanh bên.
- `12px` (`rounded-md`): Nút bấm chuẩn (34px), ô nhập liệu Input (36px), chip lọc.
- `14px` (`rounded-lg`): Menu popup, thẻ popover.
- `16px` (`rounded-xl` / `rounded-2xl`): Panel chính, hộp thoại Dialog modal.
- `24px` (`rounded-3xl`): Thẻ đăng nhập, ngăn kéo BottomSheet dưới.
- `Tròn` (`rounded-full`): Avatar, Switch, nút tròn icon.

---

## 5. Chiều Cao, Mật Độ & Lưới Khoảng Cách (4px Grid)
- **Chiều cao chuẩn của controls**:
  - Nút toolbar: 28px (`h-7`, bo 8px).
  - Nút mặc định: 34px (`h-8.5`, bo 12px, đệm ngang 14px, gap 6px).
  - Ô nhập Input: 36px (`h-9`, bo 12px, đệm ngang 12px).
  - Dòng danh sách gọn (Linear density): 38–40px (việc con 34px).
  - Dòng bảng tiêu chuẩn: 48px (việc con 44px).
  - Dòng 2 dòng chữ (kèm mô tả/hạn): 64px.
  - Vùng chạm cảm ứng di động: tối thiểu 44px (`h-11`).
- **Thang khoảng cách (Semantic Spacing Tokens)**:
  - Đệm trong (Inset): `inset-xs` (4px), `inset-sm` (8px), `inset-md` (12px), `inset-lg` (16px), `inset-xl` (24px).
  - Khoảng cách dọc (Stack): `stack-xs` (4px: nhãn → ô), `stack-sm` (8px: tiêu đề → mô tả), `stack-md` (16px: ô → ô), `stack-lg` (24px: phần → phần), `stack-xl` (48px: giữa các vùng chính).
  - Khoảng cách ngang (Inline): `inline-xs` (4px), `inline-sm` (8px: icon → chữ, chip → chip), `inline-md` (12px: nút → nút), `inline-lg` (16px).
- **Quy tắc**: Dùng thuộc tính `gap`, không đặt margin riêng cho phần tử con. Chiều cao do hàng quyết định, padding dọc = 0 ở các controls (căn giữa bằng flex).

---

## 6. Hộp Thoại (Modal) & Ngăn Kéo (Drawer / SidePanel)
- **Hộp thoại (StandardDialog / DestructiveConfirmDialog)**:
  - Nền trắng `bg-card`, không viền `border-0`, bo `rounded-2xl` (16px), đệm `p-6` (24px), bóng sâu `shadow-[var(--shadow-dialog)]`.
  - Backdrop: đen 40% `bg-black/40` (hoặc `bg-overlay`), không dùng hiệu ứng mờ kính `backdrop-blur`.
  - Vị trí: cách mép trên 10% chiều cao màn hình (tránh nhảy bố cục khi nội dung thay đổi), max-height 85vh.
  - Kích thước: `sm: 400px` (xác nhận), `md: 560px` (biểu mẫu vừa), `lg: 720px` (xem trước tệp/in).
- **Ngăn kéo dưới di động (BottomSheet)**:
  - Tự động thay thế Modal trên màn hình < 640px. Bo góc trên 24px (`rounded-t-[24px]`), tay nắm kéo 36×4px (`h-1 w-9`), tối đa 90% chiều cao màn hình.
- **Ngăn chi tiết (SidePanel / Peek Drawer)**:
  - Rộng 560–640px, trượt từ bên phải vào (260ms), danh sách bảng bên trái co lại theo tỷ lệ 65/35.

---

## 7. Quy Tắc Nội Dung & Tiếng Việt Chuẩn Hóa
- **Từ vựng thống nhất**:
  - Dùng **"Nhiệm vụ"** (không dùng "công việc" hay "task").
  - Dùng **"Việc con"** (không dùng "nhiệm vụ con", tối đa 2 cấp phân cấp).
  - Dùng **"Phụ trách"** cho cá nhân, **"Đơn vị chủ trì"** cho phòng/khoa.
  - Dùng **"Người duyệt"** (thay cho "người thẩm định"), **"Nộp kết quả"** (thay cho "nộp minh chứng").
  - Dùng **"Yêu cầu chỉnh sửa"** (thay cho "từ chối" hoặc "trả về").
- **Định dạng thời gian**:
  - Ngày: `DD/MM/YYYY` (trong bảng cùng năm hiển thị `DD/MM`).
  - Giờ: `HH:mm` (chuẩn 24 giờ, ví dụ: `16:10`).
  - Hoạt động trong 7 ngày: hiển thị tương đối (ví dụ: `hôm qua, 16:10`), sau 7 ngày hiển thị ngày đầy đủ (`20/09/2026`).
  - Hạn xử lý: `còn 1 ngày` hoặc `trễ 29 ngày` (chữ đỏ khi trễ).
- **Giọng văn & Trạng thái**:
  - Ngắn gọn, đưa hành động lên đầu câu, dùng câu chủ động.
  - Không dùng dấu chấm than (!), không dùng biểu tượng cảm xúc (emoji) trong giao diện nghiệp vụ.
  - Khi hoàn tất việc: nói rõ điều đã xảy ra, ai được thông báo, việc kế tiếp (không dùng hiệu ứng ăn mừng pháo hoa).

---

## 8. Hướng Dẫn Sử Dụng Component & Phân Định Vai Trò

### Standard* vs Primitives thô:
- **`StandardDialog`, `StandardMenu`, `StandardPopover`, `StandardCollapsible`**: Là các component chuẩn hóa đã áp dụng toàn bộ token QCET (nền trắng `bg-card`, không viền `border-0`, bóng `shadow-dialog` / `shadow-menu`, tương tác bàn phím chuẩn). Luôn sử dụng các component `Standard*` khi xây dựng màn hình và luồng tính năng.
- **Primitives thô (`Dialog`, `Menu`, `Popover`, `Collapsible`)**: Chỉ sử dụng khi cần tùy biến sâu cấu trúc DOM hoặc xây dựng các component chuyên biệt mới.

### InlineAlert vs FeedbackToast:
- **`InlineAlert` / `InlineAlertBanner`**: Dùng cho thông báo tĩnh gắn liền với trang hoặc form (lỗi nhập liệu, cảnh báo quyền hạn, hướng dẫn quy trình). Luôn nằm trong luồng giao diện (DOM flow) và không tự biến mất.
- **`FeedbackToast` / `useFeedback`**: Dùng cho phản hồi tức thời của hành động người dùng (lưu thành công, gửi văn bản, tải tệp, sao chép liên kết). Xuất hiện dạng thông báo nổi ở trên cùng và tự động ẩn sau 4 giây.

---

## 9. Snippet Mẫu Chuẩn Idiomatic

```tsx
import React from 'react';
import { 
  Button, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  Badge, 
  Input, 
  Textarea, 
  VietnameseDatePicker,
  UserAvatar,
  UserAvatarGroup
} from 'qcet-eoffice';
import { Plus, Check, Calendar, ArrowRight } from 'lucide-react';

export function TaskFormExample() {
  const [date, setDate] = React.useState('2026-10-15');

  return (
    <Card className="max-w-lg rounded-2xl border-0 bg-card p-6 shadow-none">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-foreground">
            Giao nhiệm vụ mới
          </CardTitle>
          <Badge variant="secondary">Chuyên môn</Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Tên nhiệm vụ</label>
          <Input placeholder="Nhập tên nhiệm vụ cần xử lý..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Hạn hoàn thành</label>
            <VietnameseDatePicker 
              value={date} 
              onChange={setDate} 
              variant="input"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Người phụ trách</label>
            <div className="flex items-center gap-2 h-9 px-3 rounded-xl bg-secondary">
              <UserAvatar name="Đặng Nhật Huy" size="sm" />
              <span className="text-xs font-medium text-foreground">Đặng Nhật Huy</span>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Nội dung hướng dẫn</label>
          <Textarea 
            placeholder="Ghi chú chi tiết yêu cầu công việc..." 
            autoResize 
            showCount 
            maxCharacters={500} 
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-0">
          <UserAvatarGroup 
            users={[
              { name: "Đặng Nhật Huy" },
              { name: "Nguyễn Thị Hồng Trinh" },
              { name: "Ngô Lê Minh Khuê" },
              { name: "Nguyễn Ngọc Vinh" }
            ]}
            max={3}
            size="sm"
          />

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="default">Hủy</Button>
            <Button variant="default" size="default">
              <Plus className="size-4" />
              Tạo nhiệm vụ
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## Task-page components (group `tasks`)
Reusable parts of the task list page, for building other list/table pages in the same style: `TaskRow`, `TaskTableHeader`, `TaskTableToolbar`, `TaskPaginationBar`, `TaskEmptyState`, `SubtaskInlineRow`, `BatchActionBar`, `MobileTaskCard`, `TaskStatusCircle` (status → icon/color) and `PrioritySignalBars` (priority → bars). Read each `components/tasks/<Name>/<Name>.d.ts` for props; only `TaskStatusCircle` and `PrioritySignalBars` have authored previews, the rest show a floor card but render fine when imported.
