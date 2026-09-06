# Kế Hoạch Triển Khai: Kiến Trúc Điều Hướng 2 Cột (Dual-Rail Navigation Architecture Plan)

**Mã tài liệu:** `2026-09-07-dual-rail-navigation-architecture-plan`  
**Định hướng cập nhật:** Tập trung 100% vào phân hệ **Quản lý Công việc & Dự án (Work)**; các phân hệ khác gắn nhãn "Đang phát triển" (Coming Soon)  
**Ngày lập:** 2026-09-07  
**Trạng thái:** Sẵn sàng thực hiện (Ready to Execute)

---

## 1. Mục Tiêu Trọng Tâm (Core Focus)

1. **Khắc phục triệt để tình trạng "web quá rối":**
   - Phân hệ **💼 Quản lý công việc & Dự án (Work)** được tổ chức lại ngăn nắp với 2 nhóm chức năng nhận thức rõ ràng:
     - **CÁ NHÂN:** Bàn làm việc của tôi (`/`), Lịch công tác (`/calendar`), Thông báo (`/notifications`).
     - **TOÀN TRƯỜNG & ĐƠN VỊ:** Kho 304 nhiệm vụ (`/tasks`), Hàng đợi phê duyệt minh chứng.
2. **Khung Dual-Rail chuẩn mực:**
   - **Rail 1 (56px cố định ngoài cùng):** Cột mỏng chọn phân hệ:
     - 💼 **Công việc (Work)** — Hoạt động 100%.
     - 📜 **Công văn & Văn bản (Docs)** — Gắn nhãn *"Đang phát triển"*, trang đích hiển thị giao diện placeholder trang nhã.
     - 🏛️ **Tổ chức & Nhân sự (Org)** — Sơ đồ tổ chức 11 đơn vị.
     - ⚙️ **Cài đặt & Trạng thái Notion** — Ở đáy Rail 1.
   - **Rail 2 (Sub-Nav Pane):**
     - Mở rộng `224px` với tiêu đề nhóm rõ ràng.
     - Thu gọn còn `56px` (chuẩn Ảnh 2 người dùng cung cấp) để mở rộng tối đa không gian làm việc cho bảng nhiệm vụ và bàn làm việc.
     - Phím tắt `Ctrl + B` (`Cmd + B`) và click trực tiếp vào icon phân hệ active để đóng/mở nhanh.
3. **Các phân hệ phụ:** Hiển thị trạng thái *"Đang phát triển"* (In Development) chuyên nghiệp, không làm phân tán tài nguyên phát triển.

---

## 2. Danh Sách Nhiệm Vụ Triển Khai (Implementation Tasks)

### Task 1: Mở rộng `sidebar-context.tsx` với Data Model Phân Hệ & Nhóm Menu
- Định nghĩa kiểu `NavigationModule` (`work` | `documents` | `org`), cờ `isComingSoon?: boolean`.
- Khai báo cấu trúc menu 2 nhóm cho phân hệ `work`: `personal` và `workspace`.
- Tự động ánh xạ `currentModule` dựa trên `pathname`.
- Xử lý `isMounted` an toàn cho `localStorage` (`qcet_sidebar_collapsed`).

### Task 2: Viết Bộ Kiểm Thử Tự Động Dual-Rail (TDD)
- Viết test suite `tests/dual-rail-navigation.test.ts`:
  - Kiểm tra ánh xạ route và active state của `work`, `documents`, `org`.
  - Kiểm tra phân nhóm menu (Cá nhân vs Toàn trường).
  - Kiểm tra tính toán padding layout (`md:pl-[280px]` và `md:pl-[112px]`).
  - Kiểm tra tính năng toggle collapse `Ctrl + B`.
  - Anti-slop audit (0% emoji trong mã nguồn).

### Task 3: Xây dựng Component `AppPrimaryRail` (Rail 1 - 56px)
- Logo QCET đỉnh thanh điều hướng.
- 3 nút phân hệ: Work (chính), Documents (có badge hoặc tag "Đang phát triển"), Org.
- Tooltip định danh + Active indicator viền nhấn thanh lịch.
- Chân trang: Nút Cài đặt + Đèn báo kết nối Notion.

### Task 4: Nâng Cấp `AppSidebar` thành Sub-Navigation Pane (Rail 2)
- Render menu phân nhóm rõ ràng cho phân hệ Work.
- Trạng thái thu gọn icon-only chuẩn Ảnh 2 (rộng đúng 56px, căn giữa icon, tooltip chi tiết khi hover, badge nổi).
- Nút bấm thu gọn ở chân và phím tắt `Ctrl + B`.

### Task 5: Xây Dựng Trang Placeholder "Đang Phát Triển" Cho Phân Hệ Khác (`/documents`)
- Tạo trang `/documents` trang nhã với thông báo tính năng đang phát triển theo lộ trình của Trường, kèm nút "Quay lại Quản lý công việc" giúp người dùng không bị kẹt.

### Task 6: Cập Nhật `AppShell` & Drawer Trên Mobile
- Cập nhật padding lề trái nội dung chính: `md:pl-[280px]` (khi mở rộng) / `md:pl-[112px]` (khi thu gọn).
- Mobile Drawer: Thanh chọn nhanh phân hệ dạng tab pill ở đầu drawer, tự đóng khi click chuyển trang.

### Task 7: Kiểm Thử Toàn Diện, Typecheck & Xác Minh Trực Quan (Verification)
- `npm run typecheck` (0 lỗi).
- `npm test` (Tất cả test cases đều xanh).
- Thao tác thực tế trên Browser Preview: chuyển tab, thu gọn/mở rộng Rail 2, kiểm tra responsive.
- Chụp ảnh màn hình báo cáo hoàn tất.
