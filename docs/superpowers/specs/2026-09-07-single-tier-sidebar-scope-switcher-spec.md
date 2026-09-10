# ĐẶC TẢ KỸ THUẬT: TÁI KIẾN TRÚC SINGLE-TIER SIDEBAR (248PX) & TOPBAR SCOPE SWITCHER
**Dự án:** QCET E-Office (Hệ thống Quản lý & Điều hành Văn phòng Điện tử - Trường CĐ Kỹ thuật Công nghệ Quy Nhơn)  
**Tài liệu:** Technical & UX Specification  
**Ngày lập:** 2026-09-07  
**Trạng thái:** Approved by User - Ready for Implementation Plan  

---

## 1. TỔNG QUAN & BỐI CẢNH KIẾN TRÚC

### 1.1 Vấn đề cốt lõi của kiến trúc cũ
1. **Tranh chấp thị giác từ Dual-Sidebar (Rail 56px + Panel 224px = 280px):**
   - Vừa có Primary Rail chọn module (`Quản lý công việc`, `Văn bản`, `Cơ cấu`), vừa có Sub-nav Panel hiển thị trang con. Cả hai đều sáng màu xanh `primary`, tạo cảm giác cồng kềnh, phân mảnh và "phần mềm nội bộ cũ đắp giao diện mới".
   - Tốn 280px chiều ngang màn hình, làm hẹp không gian hiển thị của bảng dữ liệu nhiệm vụ và dashboard.
2. **Nhầm lẫn giữa Vai trò (Identity) và Ngữ cảnh hiển thị (Scope):**
   - Trước đây người dùng phải tìm nút dài dòng `Chế độ xem toàn trường (Nâng cao)` đặt sâu bên trong phân khu Tasks của trang `/` để đổi góc nhìn.
   - Việc nhét cả mục "Toàn trường" lẫn "Cá nhân" vào thanh Sidebar gây quá tải nhận thức. Người dùng khó phân biệt giữa việc "Tôi là ai" (`STAFF`, `MANAGER`, `ADMIN`) với "Tôi đang muốn xem dữ liệu ở phạm vi nào" (`Toàn trường`, `Khoa/Phòng`, `Của tôi`).

### 1.2 Mục tiêu chuyển đổi (Design Goals)
1. **Đập bỏ Dual-Sidebar $\rightarrow$ Hợp nhất thành 1 Single-Tier Sidebar duy nhất:**
   - Chiều rộng chuẩn 248px (Expanded) và 64px (Collapsed [⌘B]).
   - Chuyển đổi mô hình từ `Module ➔ Section ➔ Page` cồng kềnh thành `Section ➔ Page` tinh gọn chuẩn Linear / Slack / Notion.
   - Tích hợp toàn bộ các phân hệ cần thiết vào 3 nhóm gọn gàng: `CÁ NHÂN`, `TOÀN TRƯỜNG & ĐƠN VỊ`, `VĂN BẢN & ĐIỀU HÀNH`.
2. **Tách biệt Ngữ cảnh Điều hành $\rightarrow$ Tích hợp Scope Switcher trên Header Topbar:**
   - Xóa bỏ hoàn toàn nút dài dòng `Chế độ xem toàn trường (Nâng cao)`.
   - Hiển thị gọn gàng trên Topbar: `🏫 Phạm vi: Toàn trường ▾` (hoặc `🏢 Phạm vi: [Tên đơn vị] ▾`, `👤 Phạm vi: Cá nhân ▾`).
   - Đồng bộ hai chiều với URL query parameter `?scope=school|unit|my&dept=...`.

---

## 2. KIẾN TRÚC CHI TIẾT SIDEBAR 1 TẦNG (SINGLE-TIER SIDEBAR 248PX)

### 2.1 Kích thước và Trạng thái Hiển thị
| Chế độ | Bề rộng Sidebar | Trạng thái hiển thị | Padding tương ứng trên AppShell |
| :--- | :--- | :--- | :--- |
| **Expanded (Mặc định)** | `248px` (`w-[248px]`) | Full Logo + Tiêu đề + Icon + Text nhãn + Badge số | `md:pl-[248px]` |
| **Collapsed ([⌘B])** | `64px` (`w-16`) | Logo thu nhỏ + Icon căn giữa + Tooltip nổi bên phải | `md:pl-16` |
| **Mobile (< md)** | Drawer Overlay `288px` | Sliding Drawer trượt từ trái sang kèm Backdrop làm mờ | `pl-0` |

### 2.2 Thu gọn Khối Header Sidebar (30-40% Height Reduction)
- **Thiết kế cũ:** Header chiếm > 72px với nhiều khoảng trắng thừa.
- **Thiết kế mới (Chiều cao cố định 48px):**
  - Khối Flexbox gọn gàng: Logo trường QCET (kích thước 28x28px) đặt cạnh khối văn bản 2 dòng:
    - Dòng 1: `QUẢN LÝ CÔNG VIỆC` (font Be Vietnam Pro, font-semibold, text-[13px], tracking-tight).
    - Dòng 2: `Năm học 2026–2027` (font-mono, text-[11px], text-muted-foreground).
  - Khi Collapsed (64px): Chỉ hiện Logo QCET 32x32px căn giữa hoàn hảo.

### 2.3 Cấu trúc Nhóm và Danh mục Điều hướng (Navigation Items)
Toàn bộ danh mục được tổ chức theo cấu trúc phẳng `Section ➔ Page`:

```text
┌──────────────────────────────────────────────┐
│ [Logo QCET]  QUẢN LÝ CÔNG VIỆC               │ (H: 48px)
│              Năm học 2026–2027               │
├──────────────────────────────────────────────┤
│                                              │
│  CÁ NHÂN                                     │
│  ▦ Bàn làm việc                              │ -> href="/"
│  □ Lịch công tác                         [1] │ -> href="/calendar"
│  ♧ Thông báo                             [5] │ -> href="/notifications"
│                                              │
│  TOÀN TRƯỜNG & ĐƠN VỊ                        │
│  ☑ Kho nhiệm vụ                              │ -> href="/tasks"
│                                              │
│  VĂN BẢN & ĐIỀU HÀNH                         │
│  ✉ Sổ văn bản đến/đi                     [6] │ -> href="/documents"
│  🏢 Cơ cấu & Danh bạ                         │ -> href="/org"
│                                              │
├──────────────────────────────────────────────┤
│  ⚙ Cài đặt                                   │ -> href="/settings"
│  ‹ Thu gọn thanh bên                    [⌘B] │ -> onClick={toggleCollapse}
└──────────────────────────────────────────────┘
```

### 2.4 Quy chuẩn Thị giác & Micro-Interactions (Visual Tokens)
- **Active State (Tinh tế, chuẩn Modern SaaS):**
  - Không dùng khối màu xanh đặc chói mắt (`bg-primary text-primary-foreground`).
  - Sử dụng **Subtle Tint**: `bg-primary/10 text-primary font-semibold shadow-2xs`.
  - Có vạch chỉ thị active bên trái (Active indicator bar: `absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full`).
- **Hover State:** `hover:bg-muted/70 text-foreground transition-colors duration-150`.
- **Badges:**
  - Bỏ các khối pill to thô kệch.
  - Sử dụng số font Mono thanh thoát: `font-mono text-[11px] font-semibold px-1.5 py-0.2 rounded-md`.
  - `Lịch công tác`: badge `[1]` với style `bg-sky-500/15 text-sky-600 dark:text-sky-400`.
  - `Thông báo`: badge `[5]` với style `bg-rose-500/15 text-rose-600 dark:text-rose-400`.
  - `Văn bản`: badge `[6]` với style `bg-amber-500/15 text-amber-600 dark:text-amber-400`.
- **Phím tắt Thu gọn:**
  - Lắng nghe toàn cục `⌘B` (Mac) và `Ctrl+B` (Windows) để mở rộng / thu gọn thanh bên.
  - Lưu trạng thái vào `localStorage` (`qcet_sidebar_collapsed`) để duy trì giữa các phiên làm việc.

---

## 3. KIẾN TRÚC SCOPE SWITCHER TRÊN TOPBAR (OPERATIONAL CONTEXT)

### 3.1 Định vị và Tương tác trên Header Topbar
- **Vị trí:** Đặt ngay sau Breadcrumbs trên `AppTopbar`, trước ô tìm kiếm ⌘K:
  ```text
  [Menu Mobile] [QCET E-Office > Bàn làm việc] | [🏫 Phạm vi: Toàn trường ▾]   [ 🔍 Tìm kiếm... ⌘K ] ...
  ```
- **Nút Trigger:**
  - Nút bấm bo tròn 10px (`h-8 px-2.5 rounded-lg border border-border/60 bg-background/80 hover:bg-muted/60 text-xs font-medium`).
  - Biểu tượng thay đổi theo ngữ cảnh:
    - Toàn trường: `🏫 Phạm vi: Toàn trường ▾`
    - Đơn vị: `🏢 Phạm vi: [Tên viết tắt Đơn vị] ▾` (ví dụ: `🏢 Phạm vi: K.CNTT ▾`)
    - Cá nhân: `👤 Phạm vi: Cá nhân (Của tôi) ▾`

### 3.2 Cấu trúc Dropdown Menu Scope Switcher
Khi click vào Trigger, mở ra popover dropdown (width ~260px) được phân nhóm khoa học:

1. **Nhóm Toàn trường (Macro Strategic Scope):**
   - `🏫 Toàn trường (BGH QCET)`:
     - Kèm phụ đề: *"Giám sát 11 đơn vị, phê duyệt & điểm nghẽn"*
     - Khi chọn: Cập nhật URL `?scope=school`. Màn hình Bàn làm việc (`/`) chuyển ngay sang **Executive Cockpit Workspace**.
2. **Nhóm Cá nhân (Micro Focused Scope):**
   - `👤 Cá nhân (Của tôi)`:
     - Kèm phụ đề: *"Nhiệm vụ được phân công & theo dõi hạn chót"*
     - Khi chọn: Cập nhật URL `?scope=my`. Màn hình chuyển sang **My Focus Workspace**.
3. **Nhóm Đơn vị / Khoa / Phòng (Mesoscale Operational Scope):**
   - Tiêu đề mục: `ĐƠN VỊ & KHOA PHÒNG`
   - Danh sách các đơn vị thực tế từ `QCET_DEPARTMENTS` (Phòng Đào tạo & QLKH, Khoa CNTT, Khoa Điện - Điện tử, v.v.).
   - Khi chọn: Cập nhật URL `?scope=unit&dept=[deptCode]`. Màn hình chuyển sang **Unit Command Hub**.
4. **Chân Menu (Footer Action):**
   - `⚙ Quản lý phân quyền & ủy quyền...` (Mở modal `DelegationManagementModal` để phục vụ quy trình DACUM).

### 3.3 Loại bỏ Nút cũ
- Xóa bỏ hoàn toàn nút:
  ```tsx
  <Button onClick={handleToggleStaffExpanded}>
    <LayoutGrid size={14} />
    <span>Chế độ xem toàn trường (Nâng cao)</span>
  </Button>
  ```
  trong `src/app/page.tsx` và mọi thông báo thừa thãi liên quan.

---

## 4. QUẢN LÝ DỮ LIỆU & ĐỒNG BỘ TRẠNG THÁI (STATE SYNCHRONIZATION)

### 4.1 Cơ chế Đồng bộ Hai chiều (Two-Way Sync)
```text
┌────────────────────────────────────────────────────────┐
│                   URL SearchParams                     │
│               (?scope=school|unit|my&dept=...)         │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    ┌───────────────────┐       ┌───────────────────┐
    │  Topbar Switcher  │       │  Page Workspaces  │
    │  (Hiển thị label  │       │ (Executive / Unit │
    │   & dropdown chọn)│       │  / My Focus)      │
    └───────────────────┘       └───────────────────┘
```

1. Khi người dùng chọn một phạm vi từ Topbar Switcher:
   - URL được cập nhật an toàn qua `router.replace(`/?scope=...`, { scroll: false })`.
   - `page.tsx` đọc `scopeQuery` và tự động hiển thị giao diện tương ứng mà không cần reload trang.
2. Khi người dùng truy cập trực tiếp từ bookmark hoặc chia sẻ link có `?scope=unit&dept=K_CNTT`:
   - Topbar Switcher tự động hiển thị `🏢 Phạm vi: Khoa CNTT`.
   - Trang `/` kích hoạt đúng không gian điều hành của Khoa CNTT.

---

## 5. KẾ HOẠCH FILE THAY ĐỔI & CLEANUP CODE

### 5.1 Các File Sửa đổi (Modified Files)
1. `src/components/layout/sidebar-context.tsx`:
   - Cập nhật kiểu và danh sách menu: Chuyển sang cấu trúc 1 tầng duy nhất (`personal`, `workspace`, `operations`).
   - Cập nhật `sidebarWidth`: 248px (expanded), 64px (collapsed).
2. `src/components/layout/app-shell.tsx`:
   - Cập nhật padding nội dung: `md:pl-[248px]` khi expanded và `md:pl-16` khi collapsed.
3. `src/components/layout/app-sidebar.tsx`:
   - Đập bỏ cấu trúc Dual-Rail (`AppPrimaryRail` + `Sub-Nav Rail 2`).
   - Viết lại Single-Tier Sidebar thanh lịch (248px), hỗ trợ Collapsed Mode 64px với Tooltip nổi bên phải.
   - Logo + Header thu gọn còn 48px.
4. `src/components/layout/app-topbar.tsx`:
   - Tích hợp component `ScopeSwitcher` gọn gàng ngay cạnh Breadcrumbs.
5. `src/app/page.tsx`:
   - Xóa bỏ nút cũ `Chế độ xem toàn trường (Nâng cao)`.
   - Đảm bảo bắt tín hiệu `scope` từ URL SearchParams để kích hoạt `ExecutiveCockpitWorkspace`, `UnitCommandHub`, hoặc `MyFocusWorkspace`.
6. `tests/dual-rail-navigation.test.ts` $\rightarrow$ Đổi tên và cập nhật thành `tests/single-tier-navigation.test.ts`:
   - Cập nhật các test case kiểm thử cấu trúc menu 1 tầng, các section và các route mapping.

### 5.2 Các File Gỡ bỏ (Deleted / Deprecated Files)
- `src/components/layout/app-primary-rail.tsx`: Gỡ bỏ hoàn toàn sau khi hợp nhất vào `app-sidebar.tsx`.

---

## 6. QUY TRÌNH KIỂM THỬ & CHẤT LƯỢNG (QA CHECKLIST)

1. **Quy tắc Build (Engineering Rules):**
   - Tuyệt đối không chạy `next build` đè lên cổng 3001 khi dev server đang chạy.
   - Sử dụng `npm run typecheck` (`tsc --noEmit`) để kiểm tra toàn bộ kiểu dữ liệu TypeScript.
   - Chạy `npm test` để xác nhận toàn bộ unit test suite đều xanh.
2. **Kiểm tra Tương tác & Visual:**
   - Kiểm tra hiển thị Sidebar 248px: Logo, tiêu đề, các section `CÁ NHÂN`, `TOÀN TRƯỜNG & ĐƠN VỊ`, `VĂN BẢN & ĐIỀU HÀNH`.
   - Thử nghiệm phím tắt `⌘B` / `Ctrl+B` thu gọn về 64px, kiểm tra Tooltip khi hover icon.
   - Thử nghiệm Scope Switcher trên Topbar: Chuyển qua lại giữa Toàn trường, Khoa/Phòng và Cá nhân, xác nhận dashboard tự động cập nhật mượt mà.
