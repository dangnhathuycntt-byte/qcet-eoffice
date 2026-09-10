# BÁO CÁO NGHIÊN CỨU & RÀ SOÁT CHUYÊN SÂU: MOBILE FORMS, BÀN PHÍM ẢO (VIRTUAL KEYBOARD) & ADAPTIVE BOTTOM DRAWER
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Khắc phục Lỗi Bàn phím ảo Che Mất Nút Lưu (iOS/Android), Triệt tiêu Auto-zoom Safari (16px Floor) & Chuyển đổi Modal thành Bottom Drawer Ghim Nút Hành Động (Sticky Action Dock)

---

## 1. PHÂN TÍCH CHUẨN CÔNG NGHIỆP & BẢN CHẤT XUNG ĐỘT VIEWPORT (EXA INSIGHTS 2025-2026)

### 1.1. Xung đột giữa Layout Viewport và Visual Viewport
* **Android Chrome:** Khi bàn phím ảo (Software Keyboard) mở lên, trình duyệt chủ động thu nhỏ Layout Viewport (`window.innerHeight` giảm tương ứng).
* **iOS Safari:** Xem bàn phím ảo như một lớp phủ nổi (Overlay). `window.innerHeight`, `100vh`, `100dvh` **hoàn toàn không đổi**! Thay vào đó, iOS đẩy Visual Viewport trượt lên, khiến bất kỳ phần tử nào dùng `position: fixed; bottom: 0` bị chìm xuống dưới bàn phím.
* **Hậu quả trên màn hình điện thoại (667px - 852px):** Khi bàn phím chiếm 300px - 380px, không gian thực tế chỉ còn lại ~300px - 450px. Toàn bộ các nút "Lưu", "Tạo việc mới", "Giao việc" nằm ở đáy form bị che khuất 100%!

### 1.2. Hiện tượng Auto-Zoom phá vỡ giao diện trên iOS Safari (Font < 16px)
* Nếu thẻ `<input>`, `<select>`, `<textarea>` có font-size nhỏ hơn **16px** (ví dụ `text-xs` = 12px), iOS Safari tự động phóng to toàn bộ trang web lên ~133%.
* Hậu quả: Layout bị lệch trục ngang, thanh tiêu đề trôi khỏi màn hình, người dùng buộc phải dùng 2 ngón tay thu nhỏ lại.

---

## 2. RÀ SOÁT HIỆN TRẠNG BIỂU MẪU DỰ ÁN QCET E-OFFICE

### 2.1. `create-task-modal.tsx` (52KB)
* Sử dụng Modal căn giữa truyền thống với `my-auto items-center`. Khi bàn phím ảo bật lên, hộp thoại bị ép dồn vào giữa, nửa trên trôi khỏi đỉnh màn hình, nửa dưới chìm dưới bàn phím.
* Các ô input tiêu đề, người chủ trì dùng `text-xs` (12px), kích hoạt lỗi auto-zoom của Safari.
* Cụm chọn nhanh ngày tháng (`Hôm nay`, `+3 ngày`, `+1 tuần`, `Cuối tháng`) bị bẻ dòng (wrap) lộn xộn, chiếm tới 110px chiều cao.
* Nút "Giao việc" / "Tạo việc mới" bị chìm dưới bàn phím.

### 2.2. `task-detail-side-sheet.tsx`
* Biểu mẫu nộp minh chứng `#deliverable-form` và Dialog từ chối nhiệm vụ (`isRejectionModalOpen`): Nút submit nằm trong luồng cuộn (in-flow), không phải sticky. Khi cán bộ gõ nội dung giải trình trong `textarea`, bàn phím che sạch nút "Xác nhận trả lại" và "Nộp minh chứng".

### 2.3. `user-profile-modal.tsx`
* Nút "Lưu thông tin hồ sơ" nằm ở cuối luồng cuộn (`mt-6 border-t`), hoàn toàn không sticky. Khi nhập số điện thoại hoặc chức danh, nút lưu biến mất bên dưới màn hình.
* Thiếu thuộc tính `inputMode="tel"` cho trường số điện thoại.

---

## 3. KIẾN TRÚC GIẢI PHÁP 4 TẦNG

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Responsive Modal / Drawer Architecture                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Desktop >= 768px]                     [Mobile < 768px]                    │
│  Centered Dialog Card (672px)           Vaul BottomSheet (92dvh)            │
│                                                                             │
│  ┌───────────────────────────┐          ┌─────────────────────────────────┐ │
│  │ Modal Header (Sticky)     │          │ Drawer Drag Handle Bar          │ │
│  ├───��───────────────────────┤          │ Drawer Header (Compact)         │ │
│  │ Scrollable Body           │          ├─────────────────────────────────┤ │
│  │                           │          │ Scrollable Content Area         │ │
│  │                           │          │ (scroll-padding-bottom)         │ │
│  ├───────────────────────────┤          │ [Input Auto Scroll on Focus]    │ │
│  │ Sticky Action Footer      │          ├─────────────────────────────────┤ │
│  └───────────────────────────┘          │ Keyboard-Aware Action Dock      │ │
│                                         │ bottom: var(--keyboard-h)       │ │
│                                         │ padding-bottom: env(safe...)    │ │
│                                         └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1. Chuyển đổi Adaptive: Desktop Centered Modal sang Mobile Bottom Sheet (Vaul)
* Dự án đã tích hợp sẵn thư viện `vaul` (`src/components/ui/bottom-sheet.tsx`).
* Khi `isMobile = true`: Mở từ đáy màn hình, có thanh kéo đóng trực quan, chiều cao tối đa `92dvh`.
* Ghim cố định **Thanh hành động đáy (Sticky Action Dock)** với `backdrop-blur-md` và khoảng đệm `pb-[max(0.75rem,env(safe-area-inset-bottom))]`. Nút bấm "Lưu" / "Tạo việc" **luôn luôn hiển thị 100% thời gian**, không bao giờ bị bàn phím che khuất.

### 3.2. Cấu hình Viewport & Hook `useVirtualKeyboard` (`src/hooks/use-virtual-keyboard.ts`)
* Cập nhật `interactiveWidget: "resizes-content"` trong `src/app/layout.tsx`.
* Lắng nghe `window.visualViewport` để tính toán chính xác chiều cao bàn phím và cập nhật biến CSS `--keyboard-height`.
* Tự động cuộn phần tử đang gõ vào chính giữa màn hình khả dụng (`scrollIntoView({ behavior: 'smooth', block: 'center' })`).

### 3.3. Áp dụng chuẩn Sàn 16px (16px Floor Rule)
* Mọi input trên mobile: `className="text-base sm:text-xs leading-normal"` hoặc CSS toàn cục. Triệt ti��u hoàn toàn lỗi tự động phóng to của Safari.

### 3.4. Date Picker & Dropdown Ergonomics
* Dải nút chọn ngày tắt (`Hôm nay`, `+3 ngày`, `+1 tuần`): Chuyển thành thanh cuộn ngang 1 hàng (`overflow-x-auto no-scrollbar`), không nhảy dòng.
* Trường số điện thoại: Bổ sung `type="tel" inputMode="tel" autoComplete="tel"`.

---

## 4. KẾT LUẬN

Giải pháp mang lại trải nghiệm nhập liệu và giao việc chuẩn mực như ứng dụng bản địa (Native iOS/Android): gõ phím mượt mà không phóng to lệch layout, nút Lưu luôn nằm ngay trên đầu ngón tay cái và form trượt nhẹ nhàng từ đáy màn hình.
