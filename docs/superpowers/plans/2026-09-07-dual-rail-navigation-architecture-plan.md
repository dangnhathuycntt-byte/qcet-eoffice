# Kế Hoạch Triển Khai: Kiến Trúc Điều Hướng 2 Cột (Dual-Rail Navigation Architecture Plan)

**Mã tài liệu:** `2026-09-07-dual-rail-navigation-architecture-plan`  
**Đặc tả thiết kế liên quan:** [`docs/superpowers/specs/2026-09-07-dual-rail-navigation-architecture-design.md`](../specs/2026-09-07-dual-rail-navigation-architecture-design.md)  
**Ngày lập:** 2026-09-07 (Đã cập nhật sau Exa Review)  
**Trạng thái:** Sẵn sàng thực hiện (Ready to Execute)

---

## 1. Mục Tiêu & Tiêu Chí Thành Công (Goals & Acceptance Criteria)

### 1.1 Mục tiêu
1. Chuyển đổi thanh điều hướng từ danh sách phẳng (flat list) sang cấu trúc **2 cột kết hợp trong một Container thống nhất (Unified Dual-Rail)** theo chuẩn Slack / Plane / shadcn:
   - **Container:** `fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-row`.
   - **Rail 1 (56px cố định ngoài cùng):** Cột mỏng chọn 3 phân hệ trụ cột (*Công việc*, *Văn bản & Công văn*, *Cơ cấu & Nhân sự*).
   - **Rail 2 (224px mở rộng / 56px thu gọn):** Menu chi tiết theo phân hệ, phân nhóm khoa học (*Cá nhân*, *Đơn vị & Toàn trường*).
2. Khi thu gọn Rail 2 (qua nút bấm, phím tắt `Ctrl + B`, hoặc click vào icon phân hệ đang active), Rail 2 co lại thành **cột icon mỏng 56px** (giống hệt ảnh người dùng cung cấp - tổng bề rộng 2 rail lúc n��y là `112px`).
3. Thêm trang `/documents` (Văn bản & Công văn) với giao diện mẫu chuẩn mực hành chính (Công văn đến, Công văn đi & Tờ trình, Chờ ký duyệt & Bút phê, Sổ văn bản).
4. Đảm bảo 100% không phá vỡ tính năng hiện hữu, đạt chuẩn Zero-Slop (0% emoji), Typecheck sạch (`npm run typecheck`), chống lỗi Hydration Mismatch và toàn bộ test cases đều pass.

---

## 2. Kết Quả Exa Review & Các Điểm Cải Tiến Kỹ Thuật (Architecture Refinements)

1. **Inline Flex Siblings (Không tách rời DOM):**
   - Đặt cả Rail 1 và Rail 2 làm 2 phần tử con trực tiếp (siblings) trong cùng 1 khối `AppSidebar` desktop. Điều này triệt tiêu hoàn toàn nguy cơ lệch tọa độ `left`, hở viền, hoặc chồng lấn z-index.
2. **Tương tác thông minh kiểu Slack (Slack-style Rail Interaction):**
   - Bấm vào phân hệ chưa active: Chuyển phân hệ và tự động mở rộng Rail 2 để hiển thị chi tiết.
   - Bấm vào phân hệ *đang active*: Đóng/Mở nhanh Rail 2 (Toggle Collapse).
3. **Phòng ngừa lỗi Hydration Mismatch (SSR Safe):**
   - Sử dụng cờ `mounted` trong `SidebarContext` để việc đọc `localStorage` diễn ra sau khi React mount ở client, tránh lệch giao diện giữa Server và Client.
4. **Mobile Drawer Tối Ưu:**
   - Trên mobile (< 768px), drawer hiển thị thanh tab ngang chuyển phân hệ ở đỉnh (Work / Docs / Org), bên dưới là danh sách menu con của phân hệ đó, đảm bảo thao tác ngón tay thoải mái.

---

## 3. Danh Sách Nhiệm Vụ Chi Tiết (Bite-Sized Implementation Tasks)

### Task 1: Mở rộng `sidebar-context.tsx` với Data Model Phân Hệ & Nhóm Menu
- **Mục tiêu:** 
  - Định nghĩa kiểu `NavigationModule` (`work` | `documents` | `org`), kiểu `NavigationSection` (`personal` | `workspace`).
  - Lưu trữ cấu hình menu theo từng module (`MODULE_NAV_CONFIG`).
  - Bổ sung hàm `resolveModuleFromPathname(pathname)` tự động đồng bộ phân hệ khi chuyển trang.
  - Cung cấp `currentModule`, `setCurrentModule(module)`, cờ `isMounted` và xử lý an toàn `localStorage`.
- **Tập tin cần sửa:**
  - `src/components/layout/sidebar-context.tsx`
- **Kiểm thử:** Viết hàm test kiểm tra logic ánh xạ URL và cấu trúc menu.

---

### Task 2: Viết Bộ Kiểm Thử Tự Động cho Dual-Rail Navigation (TDD)
- **Mục tiêu:** Tạo test suite kiểm tra:
  - Ánh xạ đường dẫn (`/`, `/tasks`, `/calendar`, `/documents`, `/org`).
  - Tính toán độ rộng sidebar (Expanded: 280px; Collapsed: 112px).
  - Phím tắt `Ctrl + B` và logic chuyển module.
  - Anti-slop audit (0% emoji trong code).
- **Tập tin tạo mới:**
  - `tests/dual-rail-navigation.test.ts`
- **Lệnh chạy test:**
  ```bash
  npx tsx --test tests/dual-rail-navigation.test.ts
  ```

---

### Task 3: Xây dựng Component `AppPrimaryRail` (Rail 1 - 56px)
- **Mục tiêu:** Cột icon mỏng ngoài cùng:
  - Đỉnh: Logo QCET (32x32) về trang chủ.
  - Thân: 3 nút phân hệ (`Briefcase` - Công việc, `FileText` - Văn bản, `Building2` - Cơ cấu & Nhân sự).
  - Active indicator viền dọc thanh lịch, badge số lượng, tooltip định danh khi hover.
  - Đáy: Nút Cài đặt (`Settings`) + Đèn trạng thái đồng bộ Notion.
- **Tập tin tạo mới:**
  - `src/components/layout/app-primary-rail.tsx`

---

### Task 4: Nâng Cấp `AppSidebar` thành Khung Dual-Rail Hoàn Chỉnh (Rail 1 + Rail 2)
- **Mục tiêu:** 
  - Tích hợp `AppPrimaryRail` (Rail 1) và Sub-Navigation Pane (Rail 2) trong cùng 1 khối desktop.
  - Rail 2 mở rộng `224px` với tiêu đề phân hệ, tiêu đề nhóm (`CÁ NHÂN`, `ĐƠN VỊ & TOÀN TRƯỜNG`), danh mục chức năng.
  - Rail 2 thu gọn `56px` (hiển thị cột icon mỏng giống hệt Ảnh 2 người dùng cung cấp).
  - Nút thu gọn / mở rộng ở chân trang và hỗ trợ phím tắt `Ctrl + B`.
- **Tập tin cần sửa:**
  - `src/components/layout/app-sidebar.tsx`

---

### Task 5: Xây dựng Trang Giao Diện Mẫu Văn bản & Công văn (`/documents`)
- **Mục tiêu:** Tạo trang `/documents` với layout chuyên nghiệp gồm 4 tab hành chính:
  1. *Công văn đến (Inbox)*: Danh sách văn bản từ cơ quan cấp trên (Bộ LĐ-TB&XH, UBND Tỉnh, Sở GD&ĐT).
  2. *Công văn đi & Tờ trình (Outbox)*: Hồ sơ, tờ trình từ các phòng/khoa trình BGH.
  3. *Chờ ký duyệt & Bút phê (Pending)*: Luồng ký số và xử lý văn bản khẩn cho Lãnh đạo.
  4. *Sổ văn bản điện tử (Archive)*: Tra cứu số hiệu, trích yếu, tệp đính kèm.
- **Tập tin tạo mới:**
  - `src/app/documents/page.tsx`
  - `src/components/documents/documents-shell.tsx`

---

### Task 6: Cập Nhật `AppShell` & Drawer Trên Mobile
- **Mục tiêu:** 
  - Cập nhật `AppShell` căn chỉnh lề nội dung chính:
    - Khi Rail 2 mở rộng: `md:pl-[280px]`.
    - Khi Rail 2 thu gọn: `md:pl-[112px]`.
  - Trên Mobile (< 768px): Drawer trượt có thanh tab chuyển nhanh phân hệ (Work / Docs / Org) ở đầu menu.
- **Tập tin cần sửa:**
  - `src/components/layout/app-shell.tsx`

---

### Task 7: Kiểm Thử Toàn Diện, Typecheck & Xác Minh Trực Quan (Verification)
- **Mục tiêu:**
  - `npm run typecheck` - 0 lỗi.
  - `npm test` - Toàn bộ tests đều pass.
  - Dùng dev browser preview để kiểm tra tương tác: chuyển phân hệ, thu gọn/mở rộng `Ctrl + B`, kiểm tra dark/light mode.
  - Chụp ảnh màn hình (screenshot) kiểm chứng.
