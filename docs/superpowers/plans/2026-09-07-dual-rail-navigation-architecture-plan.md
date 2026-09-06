# Kế Hoạch Triển Khai: Kiến Trúc Điều Hướng 2 Cột (Dual-Rail Navigation Architecture Plan)

**Mã tài liệu:** `2026-09-07-dual-rail-navigation-architecture-plan`  
**Đặc tả thiết kế liên quan:** [`docs/superpowers/specs/2026-09-07-dual-rail-navigation-architecture-design.md`](../specs/2026-09-07-dual-rail-navigation-architecture-design.md)  
**Ngày lập:** 2026-09-07  
**Trạng thái:** Sẵn sàng thực hiện (Ready to Execute)

---

## 1. Mục Tiêu & Tiêu Chí Thành Công (Goals & Acceptance Criteria)

### 1.1 Mục tiêu
1. Chuyển đổi thanh điều hướng từ danh sách phẳng (flat list) sang cấu trúc **2 cột độc lập (Dual-Rail Navigation)**:
   - **Rail 1 (56px):** Cột mỏng cố định chọn 3 phân hệ trụ cột (*Công việc*, *Văn bản & Công văn*, *Cơ cấu & Nhân sự*).
   - **Rail 2 (224px mở rộng / 56px thu gọn):** Menu chi tiết theo phân hệ, phân nhóm khoa học (*Cá nhân*, *Đơn vị & Toàn trường*).
2. Khi thu gọn Rail 2 (qua nút bấm hoặc phím tắt `Ctrl + B`), Rail 2 co lại thành **cột icon mỏng 56px** (giống hệt ảnh người dùng cung cấp) để tối đa hóa không gian làm việc.
3. Thêm trang `/documents` (Văn bản & Công văn) với giao diện mẫu chuẩn mực hành chính (Công văn đến, Công văn đi & Tờ trình, Chờ ký duyệt & Bút phê, Sổ văn bản).
4. Đảm bảo 100% không phá vỡ tính năng hiện hữu, đạt chuẩn Zero-Slop (0% emoji), Typecheck sạch (`npm run typecheck`), và toàn bộ unit test đều pass.

---

## 2. Danh Sách Nhiệm Vụ Chi Tiết (Bite-Sized Implementation Tasks)

### Task 1: Mở rộng `sidebar-context.tsx` với Mô hình Module & Grouped Navigation
- **Mục tiêu:** Định nghĩa kiểu dữ liệu `NavigationModule` (`work` | `documents` | `org`), các nhóm menu `NavigationSection` (`personal` | `workspace`), và hàm helper tự động ánh xạ URL hiện tại sang `currentModule`.
- **Tập tin cần sửa:**
  - `src/components/layout/sidebar-context.tsx`
- **Kiểm thử:** Viết hàm test kiểm tra `resolveModuleFromPathname(pathname)` cho các route `/`, `/tasks`, `/calendar`, `/documents`, `/org`, `/notifications`.

---

### Task 2: Viết Bộ Kiểm Thử Tự Động cho Dual-Rail Navigation (TDD)
- **Mục tiêu:** Tạo file test tự động kiểm tra toàn bộ luồng điều hướng 2 cột, phát hiện active state, tính toán chiều rộng padding cho main layout, và phím tắt `Ctrl + B`.
- **Tập tin tạo mới:**
  - `tests/dual-rail-navigation.test.ts`
- **Lệnh chạy test:**
  ```bash
  npx tsx --test tests/dual-rail-navigation.test.ts
  ```

---

### Task 3: Xây dựng Component `AppPrimaryRail` (Rail 1 - Cột Phân hệ Cố định 56px)
- **Mục tiêu:** Tạo cột icon ngoài cùng bên trái với logo QCET, 3 icon phân hệ chính (Work, Documents, Org), tooltip định danh khi hover, active indicator viền dọc thanh lịch, và cụm chân trang (Settings + trạng thái Notion).
- **Tập tin tạo mới:**
  - `src/components/layout/app-primary-rail.tsx`
- **Tiêu chuẩn thiết kế:** Tailwind CSS v4, Lucide icons (`Briefcase`, `FileText`, `Building2`, `Settings`), bo góc `rounded-xl`, không dùng emoji.

---

### Task 4: Cải Tiến `AppSidebar` thành Sub-Navigation Pane (Rail 2)
- **Mục tiêu:** Cập nhật `src/components/layout/app-sidebar.tsx` để render menu chi tiết theo `currentModule`:
  - Có tiêu đề phân hệ ở đỉnh.
  - Phân tách 2 nhóm: CÁ NHÂN và TOÀN TRƯỜNG & ĐƠN VỊ.
  - Hỗ trợ trạng thái thu gọn còn 56px (icon-only + badge + tooltip giống Ảnh 2).
  - Tích hợp phím tắt `Ctrl + B` (`Cmd + B`) và lưu trạng thái vào `localStorage`.
- **Tập tin cần sửa:**
  - `src/components/layout/app-sidebar.tsx`

---

### Task 5: Xây dựng Trang Giao Diện Mẫu Văn bản & Công văn (`/documents`)
- **Mục tiêu:** Tạo trang `/documents` với layout chuyên nghiệp, 4 tab nghiệp vụ:
  1. *Công văn đến (Inbox)*: Văn bản từ cơ quan cấp trên, lọc theo cơ quan ban hành, độ mật/khẩn.
  2. *Công văn đi & Tờ trình (Outbox)*: Tờ trình đề xuất từ các Khoa/Phòng gửi BGH.
  3. *Chờ ký duyệt & Bút phê (Pending)*: Luồng ký số và phê duyệt nhanh dành cho Lãnh đạo.
  4. *Sổ văn bản điện tử (Archive)*: Tra cứu số hiệu, trích yếu, tệp đính kèm.
- **Tập tin tạo mới:**
  - `src/app/documents/page.tsx`
  - `src/components/documents/documents-shell.tsx`

---

### Task 6: Cập Nhật `AppShell` & Khung Điều Hướng Mobile Drawer
- **Mục tiêu:** Cập nhật `AppShell` để tính toán padding lề trái chuẩn xác cho vùng nội dung:
  - Khi Rail 2 mở rộng: `md:pl-[280px]` (56px + 224px).
  - Khi Rail 2 thu gọn: `md:pl-[112px]` (56px + 56px).
  - Mobile Drawer: Hiển thị tab chuyển nhanh phân hệ (Work / Documents / Org) ngay trên đỉnh menu di động.
- **Tập tin cần sửa:**
  - `src/components/layout/app-shell.tsx`

---

### Task 7: Kiểm Thử Toàn Diện, Typecheck & Xác Minh Trực Quan (Verification)
- **Mục tiêu:** Đảm bảo toàn bộ hệ thống không lỗi TypeScript, tất cả test cases đều xanh và giao diện hiển thị hoàn hảo trên Browser Preview.
- **Các bước thực hiện:**
  1. `npm run typecheck`
  2. `npm test`
  3. Mở dev preview `http://localhost:3001/`, click thử nghiệm chuyển đổi phân hệ (Work -> Docs -> Org) và thu gọn/mở rộng Rail 2 (`Ctrl + B`).
  4. Chụp ảnh màn hình (screenshot) kiểm chứng gửi báo cáo.
