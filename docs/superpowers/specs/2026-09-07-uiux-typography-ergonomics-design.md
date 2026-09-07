# ĐẶC TẢ THIẾT KẾ: ĐẠI TU TYPOGRAPHY, CÔNG THÁI HỌC GIAO DIỆN & HỆ THỐNG MẬT ĐỘ HIỂN THỊ (UI/UX TYPOGRAPHY & ERGONOMICS)

**Dự án:** Hệ thống Điều hành & Văn phòng số QCET E-Office  
**Đơn vị áp dụng:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Ngày 07 tháng 09 năm 2026  
**Trạng thái:** Đã phê duyệt kiến trúc (Approved)  
**Tài liệu nền tảng:** Báo cáo Nghiên cứu & Đ��� xuất Nâng cấp UI/UX Typography (`BAO_CAO_NGHIEN_CUU_UIUX_TYPOGRAPHY.md`)  
**Tham chiếu tiêu chuẩn:** GovTech Singapore Design System (SGDS), IBM Carbon Design System, Nghị định 30/2020/NĐ-CP về thể thức văn bản, WCAG 2.1 AA Contrast Standards.

---

## 1. MỤC TIÊU & BỐI CẢNH

### 1.1. Hiện trạng & Thách thức
1. **Lạm dụng Micro-typography:** Toàn bộ hệ thống có hơn 1.000 vị trí sử dụng các lớp kích thước chữ siêu nhỏ (`text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-xs`), làm giảm khả năng đọc của Ban Giám hiệu, Trưởng phòng/khoa và Giảng viên.
2. **Xung đột dấu tiếng Việt (Diacritic Collision):** Font `Plus Jakarta Sans` trước đây khiến dấu thanh điệu (hỏi, ngã, sắc, huyền, nặng) bị dính bết vào mũ nguyên âm ở kích thước nhỏ.
3. **Suy giảm độ tương phản (Contrast Decay):** Màu `muted-foreground` ở Light Mode có tỷ lệ tương phản thấp (~3.1:1), vi phạm ngưỡng tối thiểu 4.5:1 của chuẩn WCAG 2.1 AA.
4. **Thiếu tính tùy biến mật độ:** Người dùng văn thư cần xử lý lượng văn bản lớn (cần Compact), trong khi Lãnh đạo và Giảng viên cần đọc thoáng đãng, kích thước chuẩn (Comfortable).

### 1.2. Mục tiêu ��ạt được
- **Unified Font System:** Chuyển dịch 100% sang font **Be Vietnam Pro** cho cả Heading và Body để hiển thị tiếng Việt hoàn hảo, giữ JetBrains Mono cho số liệu và mã hồ sơ.
- **Chặn sàn kích thước chữ:** Triệt tiêu hoàn toàn các class font < 12px trong toàn dự án.
- **Hệ thống Quản lý Mật độ (Token-Driven Density System):** Hỗ trợ chuyển đổi nhanh hai chế độ Comfortable (48px) và Compact (38px), lưu trữ `localStorage`, đồng bộ thời gian thực đa tab và chống giật giao diện (Anti-FOUC).
- **Chuẩn hóa công thái học Base Components:** Nút bấm tối thiểu 40px trên desktop, ô nhập liệu chuẩn `text-base md:text-sm` để chống zoom tự động trên Safari iOS.
- **Đảm bảo chất lượng kiểm thử:** Viết automated linter test quét sạch class < 12px và kiểm thử unit/integration cho Density Provider.

---

## 2. THIẾT KẾ CHI TIẾT CÁC PHÂN HỆ

### 2.1. Phân hệ 1: Hệ thống Font Chữ & Theme Tokens Toàn Cục

#### A. Cấu hình Font (`src/app/layout.tsx`)
Thay thế `Plus_Jakarta_Sans` bằng `Be_Vietnam_Pro`:
```tsx
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";

const fontSans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
```

#### B. Anti-FOUC Inline Script (`src/app/layout.tsx`)
Chèn ngay trong thẻ `<head>` để ngăn ngừa hiện tượng giật giao diện trước khi render lần đầu:
```html
<script
  dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          var density = localStorage.getItem('qcet-display-density');
          if (density === 'compact') {
            document.documentElement.setAttribute('data-density', 'compact');
          } else {
            document.documentElement.setAttribute('data-density', 'comfortable');
          }
        } catch (e) {}
      })();
    `,
  }}
/>
```

#### C. Cấu hình CSS Variables & Contrast (`src/app/globals.css`)
1. **Nâng độ tương phản Light Mode đạt chuẩn WCAG AA (> 4.5:1):**
   - Điều chỉnh `--muted-foreground` từ `oklch(0.48 0.015 250)` sang `oklch(0.38 0.015 250)`.
2. **Line-height & Font Scale:**
   - Body font-size cơ sở: `0.875rem` (14px), line-height: `1.5` - `1.625` (`leading-relaxed`) để mở rộng khoảng thở cho dấu mũ và thanh điệu tiếng Việt.
3. **Khai báo Density Tokens:**
   ```css
   :root,
   [data-density="comfortable"] {
     --table-cell-py: 0.8125rem;    /* 13px padding top/bottom -> tổng row height ~48px */
     --table-font-size: 0.875rem;   /* 14px */
     --table-lh: 1.375rem;          /* 22px */
     --table-header-py: 0.75rem;    /* 12px */
   }

   [data-density="compact"] {
     --table-cell-py: 0.4375rem;    /* 7px padding top/bottom -> tổng row height ~38px */
     --table-font-size: 0.8125rem;  /* 13px */
     --table-lh: 1.125rem;          /* 18px */
     --table-header-py: 0.5rem;     /* 8px */
   }

   .table-row-dense {
     font-size: var(--table-font-size);
     line-height: var(--table-lh);
   }

   .table-cell-dense {
     padding-top: var(--table-cell-py);
     padding-bottom: var(--table-cell-py);
   }
   ```
   *Lưu ý kỹ thuật:* Tuyệt đối không gắn `transition: padding, font-size` lên `.table-cell-dense` hoặc `.table-row-dense` để tránh hiện tượng layout thrashing khi chuyển đổi mật độ.

---

### 2.2. Phân hệ 2: Quản lý Mật độ Toàn Cục & Nút Chuyển Đổi Toolbar

#### A. Provider & Hook (`src/components/density-provider.tsx`)
- Khởi tạo React Context quản lý `density: 'comfortable' | 'compact'`.
- Lưu trữ localStorage qua key `qcet-display-density`.
- Đồng bộ DOM: `document.documentElement.setAttribute('data-density', density)`.
- Đăng ký listener sự kiện `window.addEventListener('storage', ...)` để tự động cập nhật khi người dùng thay đổi chế độ trên tab trình duyệt khác.

#### B. Nút chuyển đổi Toolbar (`src/components/ui/density-toggle.tsx`)
- Cung cấp giao diện trực quan cho phép người dùng chọn giữa "Thoải mái (48px)" và "Thu gọn (38px)".
- Sử dụng icon `Rows3` / `Rows4` (hoặc `Maximize2` / `Minimize2`) từ `lucide-react`.
- Tích hợp Tooltip hướng dẫn chi tiết.
- Được gắn vào thanh toolbar của:
  1. `src/components/dashboard/unified-task-toolbar.tsx` (hoặc toolbar của bảng công việc).
  2. `src/components/documents/document-registry-view.tsx` (Sổ văn bản).

---

### 2.3. Phân hệ 3: Chuẩn Hóa Base Components & Xóa Bỏ Micro-Typography

#### A. Chuẩn hóa `src/components/ui/button.tsx`
- Cấu hình kích thước công thái học:
  - `default`: `h-10 px-4 py-2 text-sm font-medium` (thay cho `h-9` chật hẹp).
  - `sm`: `h-8.5 px-3 text-xs font-medium` (đảm bảo diện tích bấm tối thiểu trên màn hình cảm ứng/chuột).
  - `lg`: `h-11 px-6 text-base font-semibold`.
  - `icon`: `h-10 w-10` (default) và `h-8.5 w-8.5` (sm).
- Đảm bảo icon bên trong có `size-4` (sm/default) hoặc `size-5` (lg) và không bị méo (`shrink-0`).

#### B. Chuẩn hóa `src/components/ui/badge.tsx`
- Quy định kích thước sàn: `text-xs` (12px) `font-medium`.
- Padding cân đối: `px-2.5 py-0.75` bo góc mềm mại, không dính sát viền.
- Hỗ trợ số liệu với `tabular-nums`.

#### C. Chuẩn hóa Form Inputs / Select / Textarea
- Chiều cao ô nhập liệu chuẩn: `h-10` (40px).
- Kích thước font responsive chống zoom iOS: `text-base md:text-sm`.
- Placeholder màu `text-muted-foreground` rõ nét, đạt chuẩn tương phản.

#### D. Triệt tiêu hoàn toàn class font < 12px
- Thay thế toàn bộ các mẫu `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]` trong codebase sang `text-xs` (12px) hoặc `text-[13px]`.

---

### 2.4. Phân hệ 4: Đại Tu Bảng Biểu & Màn Hình Trọng Tâm

#### A. Bảng Phân cấp Nhiệm vụ (`src/components/dashboard/cascading-task-table.tsx`)
- Tháo bỏ class bọc ngoài `text-xs`.
- Áp dụng `.table-row-dense` cho các hàng dữ liệu và `.table-cell-dense` cho các ô `<td>`.
- Tiêu đề công việc hiển thị `text-sm font-medium text-foreground leading-snug`.
- Mã công việc hiển thị `font-mono text-xs tabular-nums text-muted-foreground`.
- Vùng bấm chọn mở rộng cây phân cấp đạt tối thiểu 32x32px.

#### B. Sổ Văn bản Đến/Đi (`src/components/documents/document-registry-view.tsx`)
- Trích yếu văn bản hiển thị `text-sm font-medium text-foreground line-clamp-2 leading-relaxed`.
- Số/ký hiệu văn bản hiển thị `font-mono text-xs md:text-[13px] font-semibold text-primary`.
- Tích hợp `DensityToggle` ngay trên thanh điều khiển của sổ văn bản.

#### C. Thanh Điều Hướng Sidebar (`app-sidebar.tsx`) & Topbar (`app-topbar.tsx`)
- Menu item hiển thị `text-[13.5px]` hoặc `text-sm font-medium`, chiều cao tối thiểu `min-h-10`.
- Icon menu đạt chuẩn `size-[18px]`.
- Badge đếm số công việc đạt `text-xs font-semibold`.

---

## 3. KẾ HOẠCH KIỂM THỬ & BẢO ĐẢM CHẤT LƯỢNG (QA PLAN)

### 3.1. Nguyên tắc tuân thủ quy tắc CLAUDE.md
- Tuyệt đối **không chạy `npm run build`** khi dev server đang hoạt động trên cổng 3001 nhằm tránh xóa đè cache chunks `.next/`.
- Sử dụng `npm run typecheck` (`tsc --noEmit`) và `npm test` (`tsx --test tests/**/*.test.ts`).

### 3.2. Bộ kiểm thử tự động (Automated Test Suite)
1. **Linter Test Quét sạch Micro-Typography (`tests/typography-micro-classes.test.ts`):**
   - Quét đệ quy toàn bộ thư mục `src/` (`.tsx`, `.ts`, `.css`).
   - Khẳng định không có sự xuất hiện của các chuỗi regex:
     - `text-\[8px\]`
     - `text-\[9px\]`
     - `text-\[10px\]`
     - `text-\[11px\]`
   - Test tự động báo lỗi nếu có bất kỳ lập trình viên nào thêm class < 12px trong tương lai.
2. **Unit & Integration Test Density System (`tests/display-density.test.ts`):**
   - Kiểm tra khởi tạo giá trị từ `localStorage`.
   - Kiểm tra thay đổi DOM attribute `data-density`.
   - Kiểm tra listener sự kiện `storage` cập nhật trạng thái đa tab.
3. **Kiểm tra hồi quy giao diện hiện có:**
   - Đảm bảo toàn bộ các test hiện có (`tests/dual-rail-navigation.test.ts`, `tests/documents-roadmap-page.test.ts`) tiếp tục vượt qua 100%.
