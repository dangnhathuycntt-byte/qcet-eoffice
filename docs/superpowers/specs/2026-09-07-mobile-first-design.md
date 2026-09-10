# QCET E-Office: Đặc Tả Kiến Trúc & Thiết Kế Mobile-First PWA

- **Ngày ban hành**: 07/09/2026
- **Trạng thái**: Draft / Sẵn sàng triển khai
- **Tác giả / Nhóm thiết kế**: QCET Core Architecture Team
- **Tham chiếu chuẩn**:
  - Apple Human Interface Guidelines (Touch Targets & Safe Areas)
  - PWA W3C Standalone Web App Specifications 2026
  - Exa UX Audit Benchmarks (GopherTrunk Operator Cockpit PWA, Flowdesk React 19 + Tailwind v4 PWA)

---

## 1. Bối Cảnh & Mục Tiêu Cốt Lõi (Core Problem & Goals)

### 1.1 Vấn đề cốt lõi hiện tại
- Hệ thống QCET E-Office được thiết kế theo tư duy Desktop-first với Sidebar cố định 248px, các bảng dữ liệu nhiều cột (data tables), dropdown menu nhỏ ở góc trên và các Dialog/Modal nổi giữa màn hình (`fixed inset-0`).
- Khi sử dụng trên điện thoại di động (iPhone / Android) của Ban Giám hiệu và Trưởng đơn vị:
  1. Thao tác ngón tay cái rất khó khăn do các nút hành động (Duyệt việc, Tạo việc, Đổi đơn vị) nằm tít trên góc trên cùng ngoài tầm với (Top thumb-stretch zone).
  2. Dialog nổi giữa màn hình bị bàn phím ảo che mất trường nhập liệu, không có cử chỉ vuốt tự nhiên để đóng.
  3. Thiếu thanh điều hướng đáy cố định (Fixed Bottom Navigation Bar), khiến người dùng phải mở Drawer menu qua nút Hamburger nhiều lần.
  4. Chưa tối ưu tai thỏ (Dynamic Island / Notch) và thanh Home Indicator dẫn đến nguy cơ va chạm giao diện (`safe-area-inset`).

### 1.2 Mục tiêu đạt được (Design Goals)
1. **Trải nghiệm ứng dụng như Native App (Mobile-First PWA)**: Cài đặt trực tiếp lên Màn hình chính (Add to Home Screen) mà không cần qua App Store, chạy toàn màn hình (chromeless `standalone`).
2. **Công thái học Vùng ngón cái (Thumb-Zone Ergonomics)**: 90% hành động quyết định (Duyệt việc, Ký, Nộp minh chứng, Chuyển tab) nằm ở 40% nửa dưới màn hình với kích thước chạm tối thiểu **44×44px**.
3. **Cơ chế Sheet đáy (Bottom Sheets via Vaul)**: Toàn bộ Modal/Dialog trên mobile chuyển thành Bottom Sheet vuốt kéo mượt mà, có thanh gạt kéo xuống để đóng (`drag-to-dismiss`).
4. **Không phá vỡ trải nghiệm Desktop**: Kiến trúc thích ứng (Adaptive Shell) bảo toàn 100% sức mạnh của Cockpit và Workspace trên màn hình lớn (`md: 768px+`).

---

## 2. Kiến Trúc Điều Hướng & Shell (Navigation & AppShell Architecture)

### 2.1 Unified Shell: Chiếu 1 nguồn định tuyến thành 2 bề mặt
Hệ thống sử dụng chung một danh mục định tuyến (`SINGLE_TIER_NAV_ITEMS`), nhưng qua CSS breakpoint sẽ chiếu ra 2 giao diện hoàn toàn khác nhau:

```
                            SINGLE_TIER_NAV_ITEMS
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼ (< 768px - Mobile)                                ▼ (>= 768px - Desktop)
    ┌──────────────────────┐                           ┌──────────────────────┐
    │  Compact Topbar      │                           │  Desktop AppTopbar   │
    │  (Title + Scope pill)│                           │  (Search + Profiles) │
    ├──────────────────────┤                           ├──────────────────────┤
    │  Main Feed           │                           │  AppSidebar          │
    │  (Cards, pb-28)      │                           │  (248px Collapsible) │
    ├──────────────────────┤                           ├──────────────────────┤
    │  MobileBottomNav     │                           │  Main Content        │
    │  (5 Primary Thumb)   │                           │  (Multi-column grid) │
    ├──────────────────────┤                           └──────────────────────┘
    │  Vaul Bottom Sheets  │
    │  (Actions & Menu)    │
    └──────────────────────┘
```

### 2.2 Cấu trúc 5 Điểm Chạm trên `MobileBottomNav` (Cố định ở đáy)

| Vị trí | Icon & Nhãn | Hành động khi chạm | Chú thích công thái học |
| :--- | :--- | :--- | :--- |
| **1** | 🏠 **Tổng quan** | Chuyển đến `/` (Dashboard tổng thể) | Trực quan, phản hồi trạng thái active |
| **2** | 📋 **Công việc** | Chuyển đến `/?zone=tasks` | Tab công việc theo vai trò |
| **3** | ⚡ **Duyệt / Tạo** | **Nút FAB nổi bật ở giữa**: Mở Bottom Sheet duyệt nhanh (BGH) hoặc tạo việc | Điểm chạm tự nhiên nhất của ngón cái |
| **4** | 🔔 **Thông báo** | Chuyển đến `/notifications` | Có chấm đỏ hiển thị số thông báo chưa đọc |
| **5** | ☰ **Menu & Hồ sơ** | Mở `MobileMenuDrawer` (Vaul Bottom Sheet) | Chứa toàn bộ tính năng phụ: Lịch, Cài đặt, Đổi vai trò |

### 2.3 Safe-Area Inset Handling (Tiêu chuẩn P0 của iOS & Android)
- **Viewport meta**: Bổ sung `viewportFit: "cover"` vào metadata Next.js.
- **Thanh Bottom Nav**:
  ```css
  padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  ```
- **Khoảng đệm nội dung chính**:
  ```css
  /* main content padding-bottom để tránh bị che bởi Bottom Nav */
  padding-bottom: calc(5.5rem + env(safe-area-inset-bottom));
  ```
- **Thanh Topbar**:
  ```css
  padding-top: max(0.5rem, env(safe-area-inset-top));
  ```

---

## 3. Hệ Thống Bottom Sheet Dựa Trên `Vaul`

### 3.1 Vì sao chọn `vaul`?
1. Tương thích chuẩn với React 19 (`^19.0.0`) và Tailwind CSS v4.
2. Hỗ trợ gesture vuốt đóng (drag down to dismiss) đạt 60fps mượt mà, cảm giác y hệt ứng dụng iOS/Android gốc.
3. Không làm phình bundle như Framer Motion, chỉ ~3KB gzipped.
4. Tự động xử lý khóa cuộn trang nền (Scroll Locking) và Accessibility (A11y focus trapping).

### 3.2 Các trường hợp chuyển đổi sang Bottom Sheet

1. **Sheet Chọn Phạm Vi (Scope Switcher)**:
   - Trên Topbar mobile: Nút hiển thị gọn `[Khoa CNTT ▾]`.
   - Khi bấm: Mở Sheet đáy chứa 3 khối:
     - Đơn vị trực thuộc của tôi (`Phòng QTM & CNTT`).
     - Đơn vị phụ trách chuyên môn (`Khoa CNTT`).
     - Danh sách các đơn vị khác (có ô tìm kiếm nhanh).
2. **Sheet Chi Tiết & Phê Duyệt Công Việc (Task Detail & Approval)**:
   - Thay thế modal giữa màn hình.
   - Chiều cao: `max-h-[88vh]`.
   - Header cố định: Tiêu đề công việc + Trạng thái khẩn cấp + Nút X đóng.
   - Body cuộn mượt: Nội dung mô tả, danh sách minh chứng (file PDF/ảnh có thể mở xem trực tiếp).
   - Sticky Action Footer: Nút **[Phê duyệt ngay]** (Xanh) và nút **[Yêu cầu sửa đổi]** (Hổ phách) cố định ở đáy sheet, ngón cái bấm tức thì.
3. **Sheet Nộp Minh Chứng (Submit Deliverable)**:
   - Hỗ trợ chọn file hoặc chụp ảnh trực tiếp từ camera điện thoại.
   - Nhập ghi chú nhanh kèm nút nộp to rõ ràng.
4. **Sheet Menu Tổng Hợp (Navigation & Preferences)**:
   - Thẻ hồ sơ cá nhân: Tên, chức vụ, đơn vị.
   - Chuyển đổi nhanh vai trò demo (BGH, Trưởng phòng/khoa, Giảng viên).
   - Nút gạt chuyển đổi giao diện Sáng / Tối.
   - Lối tắt đến: Lịch tuần trường, Danh bạ/Cơ cấu tổ chức, Cài đặt, Đăng xuất.

---

## 4. Tái Cấu Trúc Giao Diện Thẻ Công Việc (Card-based Task Feed)

### 4.1 Nguyên lý Cards over Tables trên Màn hình Nhỏ (< 768px)
- Desktop dùng bảng hoặc chia cột ngang để hiển thị nhiều thông tin cùng lúc.
- Mobile chuyển 100% sang dạng **Thẻ Tác Vụ Dọc (Vertical Card Stack)**:
  - **Dòng 1**: Mã công việc + Pill trạng thái hạn chót (Đỏ: Quá hạn / Hôm nay, Vàng: Tuần này, Xanh: Đã duyệt).
  - **Dòng 2**: Tiêu đề công việc (Font Semibold 14px, tương phản cao, tối đa 2 dòng).
  - **Dòng 3**: Người phụ trách chính (DRI) + Tên đơn vị + Số lượng việc con/minh chứng (ví dụ `2/3`).
  - **Dòng 4**: Nút hành động nhanh (Ví dụ: `[⚡ Xem & Duyệt]` hoặc `[📤 Nộp báo cáo]`).

### 4.2 Tab Lọc Cuộn Ngang (Horizontal Scrollable Filter Pills)
- Thay thế dropdown filter rườm rà bằng thanh Tab cuộn ngang mượt mà (`overflow-x-auto no-scrollbar scroll-smooth`):
  - `[ Tất cả ]` `[ Hạn hôm nay (3) ]` `[ Cần duyệt (2) ]` `[ Đang làm ]` `[ Hoàn thành ]`
  - Các pill có hiệu ứng active rõ ràng, độ cao tối thiểu 36px, lề cách tay 8px.

---

## 5. Kiến Trúc Triển Khai PWA (Progressive Web App)

### 5.1 Cấu hình Web App Manifest (`src/app/manifest.ts`)
```typescript
import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QCET E-Office - Hệ thống Điều hành Văn phòng Điện tử",
    short_name: "QCET E-Office",
    description: "Hệ thống quản lý công việc và điều hành văn phòng điện tử Trường CĐ Kỹ thuật Cao Thắng",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0C0E",
    theme_color: "#18181B",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

### 5.2 Standalone Back Navigation Guard
- Vì PWA trên iOS chạy chế độ `standalone` không có thanh địa chỉ hay nút Back của trình duyệt:
- Mọi trang con (`/notifications`, `/settings`, `/tasks/[id]`) bắt buộc phải có nút **`[← Quay lại]`** ở góc trái Topbar hoặc sử dụng Bottom Sheet để người dùng không bị kẹt trang.

---

## 6. Lộ Trình Triển Khai Theo Giai Đoạn (Implementation Phases)

### Phase 1: Nền tảng PWA & Thư viện Bottom Sheet
1. Cài đặt thư viện `vaul`.
2. Tạo component dùng chung `src/components/ui/drawer.tsx` (dựa trên `vaul` và Tailwind v4).
3. Cấu hình `src/app/manifest.ts` và bổ sung `viewportFit: "cover"` vào `src/app/layout.tsx`.

### Phase 2: Shell Thích Ứng & Bottom Navigation Bar
1. Tạo component `src/components/layout/mobile-bottom-nav.tsx` với 5 mục chạm chuẩn công thái học.
2. Cập nhật `src/components/layout/app-shell.tsx` để tích hợp `MobileBottomNav` (< md) và ẩn `AppSidebar` (< md).
3. Đệm khoảng trống đáy (`pb-28`) cho toàn bộ trang nội dung để chống che khuất.

### Phase 3: Chuyển Đổi Các Tương Tác Cốt Lõi Sang Bottom Sheet
1. Chuyển `ScopeSwitcher` trên mobile sang kích hoạt `ScopeSelectSheet`.
2. Chuyển `MobileMenuDrawer` (thay thế nút hamburger cũ) thành Bottom Sheet phong phú mở từ nút số 5.
3. Chuyển luồng `SubmitDeliverableModal` và duyệt việc thành Vaul Bottom Sheet.

### Phase 4: Kiểm Thử, Đo Đạc & Tối Ưu Hóa
1. Kiểm tra trên Mobile Viewport (iPhone SE 375px, iPhone 15/16 393px, Samsung Galaxy S24 360px).
2. Đảm bảo toàn bộ touch targets >= 44×44px, không có hiện tượng giật rung (layout shift) hoặc cuộn kép (double scroll).
3. Chạy `npm run typecheck` và `npm test` để xác nhận chất lượng toàn diện.
