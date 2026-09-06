# Đặc Tả Kiến Trúc Điều Hướng 2 Cột (Dual-Rail Navigation Architecture Spec)

**Dự án:** QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)  
**Ngày lập:** 2026-09-07  
**Tác giả:** Antigravity x QCET Engineering Team  
**Trạng thái:** Chờ duyệt (Pending Review)

---

## 1. Bối Cảnh & Động Lực (Context & Motivation)

### 1.1 Vấn đề hiện tại
- Trước đây, thanh điều hướng (Sidebar) của QCET E-Office sử dụng cấu trúc **danh sách phẳng (Flat List)**, gom chung: *Bàn làm việc, Kho 304 nhiệm vụ, Lịch công tác, Sơ đồ tổ chức, Thông báo*.
- Kết quả: Khi Giảng viên hoặc Lãnh đạo đăng nhập, họ đối mặt với một danh sách chức năng lẫn lộn giữa tác vụ cá nhân hàng ngày và dữ liệu quản trị toàn trường, gây quá tải nhận thức (*"vào web không biết xài sao, thấy quá rối"*).

### 1.2 Giải pháp kiến trúc: Dual-Rail Navigation (Cảm hứng Plane.so & Tiêu chuẩn SaaS B2B)
- Tách bạch rõ ràng **Bản đồ phân hệ lớn (Global Navigation - Rail 1)** và **Menu chức năng chi tiết theo ngữ cảnh (Contextual Navigation - Rail 2)**.
- Người dùng luôn biết mình đang ở phân hệ nào, chỉ thấy các công cụ liên quan trực tiếp đến nhiệm vụ đó, đồng thời có thể thu gọn Rail 2 thành cột icon mỏng để tối đa hóa diện tích làm việc (bảng nhiệm vụ, lịch, văn bản).

---

## 2. Kiến Trúc Phân Tầng (Two-Tier Information Architecture)

```
┌─────────┬─────────────────────────────────┬────────────────────────────────────────────────────────┐
│ Rail 1  │ Rail 2: Sub-Nav Pane (230px)    │ Vùng làm việc chính (Main Content Area)                │
│ (56px)  │ (Thu gọn còn 56px khi ấn Ctrl+B)│                                                        │
├─────────┼─────────────────────────────────┼───────────────────────────���────────────────────────────┤
│ [Logo]  │ [Tiêu đề phân hệ]               │                                                        │
│         │                                 │                                                        │
│   💼    │ ▼ CÁ NHÂN                       │                                                        │
│  Work   │   ├─ 🏠 Bàn làm việc (/)        │                                                        │
│         │   ├─ 📅 Lịch công tác (/calendar)│                                                       │
│   📜    │   └─ 🔔 Thông báo (/notifications)                                                      │
│  Docs   │                                 │                                                        │
│         │ ▼ TOÀN TRƯỜNG & ĐƠN VỊ          │                                                        │
│   🏛️    │   ├─ 📋 Kho nhiệm vụ (/tasks)   │                                                        │
│   Org   │   └─ ⚖️ Hàng đợi duyệt           │                                                        │
│  ─────  │                                 │                                                        │
│   ⚙️    │ [Trạng thái & Nút thu gọn]      │                                                        │
│ Settings│                                 │                                                        │
└─────────┴─────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 3. Chi Tiết Các Phân Hệ & Menu Rail 2

### 3.1 Phân hệ 1: 💼 Công việc & Nhiệm vụ (`currentModule = "work"`)
Phục vụ điều hành, giao việc và thực hiện nhiệm vụ năm học (304 việc trường, 920 việc đơn vị).

*   **Nhóm CÁ NHÂN (Personal Focus):**
    *   `🏠 Bàn làm việc` (`/`): Không gian cá nhân hóa theo vai trò (BGH: Khoang chỉ huy; Trưởng khoa: Bàn điều hành; Giảng viên: Việc cần làm & nộp minh chứng).
    *   `📅 Lịch công tác` (`/calendar`): Lịch tuần trường, lịch giảng dạy, coi thi, deadline nhiệm vụ.
    *   `🔔 Thông báo & Nhắc việc` (`/notifications`): Cảnh báo việc sắp đến hạn, quá hạn và kết quả duyệt (Badge số lư���ng phản hồi tức thì).
*   **Nhóm ĐƠN VỊ & TOÀN TRƯỜNG (Organization Tasks):**
    *   `📋 Kho nhiệm vụ` (`/tasks`): Tra cứu bảng phân cấp nhiệm vụ 2 cấp (304 việc trường, 920 việc khoa).
    *   `⚖️ Hàng đợi thẩm định` (`/?tab=approvals`): Danh sách minh chứng chờ lãnh đạo phê duyệt (3 trạng thái: Đạt / Yêu cầu sửa / Từ chối).

### 3.2 Phân hệ 2: 📜 Văn bản & Công văn (`currentModule = "documents"`)
Phục vụ quản lý công văn đi, công văn đến, luồng tờ trình và ký số (chuẩn hành chính giáo dục).

*   **Nhóm VĂN BẢN ĐẾN & ĐI (In/Out Dispatch):**
    *   `📥 Công văn đến` (`/documents?tab=inbox`): Văn bản chỉ đạo từ Bộ LĐ-TB&XH, Tổng cục GDNN, UBND Tỉnh, Sở ban ngành.
    *   `📤 Công văn đi & Tờ trình` (`/documents?tab=outbox`): Hồ sơ, tờ trình đề xuất từ các Phòng/Khoa trình Ban Giám Hiệu.
*   **Nhóm XỬ LÝ & LƯU TRỮ (Processing & Archive):**
    *   `✍️ Chờ ký duyệt & Bút phê` (`/documents?tab=pending`): Luồng xử lý nhanh cho Lãnh đạo cho ý kiến chỉ đạo và ký số.
    *   `🗄️ Sổ văn bản điện tử` (`/documents?tab=archive`): Sổ lưu trữ, phân loại văn bản theo năm và số hiệu.

### 3.3 Phân hệ 3: 🏛️ Cơ cấu & Danh bạ (`currentModule = "org"`)
Phục vụ tra cứu bộ máy nhà trường, phân công và nhân sự.

*   **Nhóm TỔ CHỨC & BỘ MÁY:**
    *   `🏢 Sơ đồ tổ chức` (`/org`): Cây cơ cấu Ban Giám hiệu và 11 Phòng / Khoa / Trung tâm.
    *   `👥 Danh bạ cán bộ` (`/org?tab=directory`): Tra cứu thông tin liên lạc cán bộ, giảng viên, chuyên viên.
    *   `🛡️ Ủy quyền điều hành` (`/org?tab=delegations`): Phân quyền và ủy quyền xử lý công việc theo quy chế trường.

---

## 4. Đặc Tả Tương Tác & Giao Diện (Interaction & UI Specifications)

### 4.1 Kích thước & Trạng thái (Desktop >= 768px)
1. **Rail 1 (Primary Module Rail):**
   - Rộng cố định `w-14` (56px), nền `bg-sidebar-primary/5` hoặc `bg-card border-r border-border/70`.
   - Mỗi nút phân hệ có kích thước `size-10` (40x40), bo góc tròn `rounded-xl`.
   - Trạng thái Active: Có viền trái `before:absolute before:left-0 before:w-1 before:h-5 before:bg-primary before:rounded-r-full`, nền `bg-primary/10 text-primary`.
   - Tooltip xuất hiện bên phải khi hover hiển thị tên phân hệ.
2. **Rail 2 (Sub-Navigation Pane):**
   - **Mở rộng (Default / Expanded):** Rộng `w-56` (224px). Có tiêu đề phân hệ, tiêu đề nhóm (font-mono text-[10px] uppercase tracking-wider text-muted-foreground), tên chức năng và badge số lượng.
   - **Thu gọn (Collapsed - Chuẩn Ảnh 2):** Rộng `w-14` (56px). Ẩn văn bản, chỉ hiển thị icon căn giữa + badge tròn nhỏ ở góc trên phải.
   - Nút gạt thu gọn/mở rộng ở chân Rail 2 hoặc phím tắt `Ctrl + B` (`Cmd + B`).
   - Trạng thái thu gọn được lưu vào `localStorage.getItem("qcet_sidebar_collapsed")`.

### 4.2 Tương tác trên Thiết bị di động (Mobile < 768px)
- Ẩn Dual-Rail mặc định, có nút hamburger trên App Header.
- Khi mở menu Mobile: Hiển thị thanh trượt chọn nhanh phân hệ (Work / Documents / Org) ở đầu Drawer, bên dưới là danh sách menu con của phân hệ đang chọn. Tự động đóng drawer khi người dùng chọn một mục điều hướng.

### 4.3 Tính nguyên vẹn thiết kế (Anti-Slop & Design System Compliance)
- Sử dụng 100% token của hệ thống thiết kế hiện tại (`globals.css` Tailwind v4, OKLCH color space).
- Nghiêm cấm sử dụng emoji làm icon giao diện; sử dụng chuẩn bộ icon Lucide SVG (`CheckSquare`, `Calendar`, `Bell`, `FileText`, `Send`, `Inbox`, `Building2`, `Users`, `ShieldCheck`).
- Không phá vỡ các route hiện có (`/`, `/tasks`, `/calendar`, `/org`, `/notifications`).

---

## 5. Kế Hoạch Triển Khai & Kiểm Thử (Implementation & Verification)

1. **Giai đoạn 1: Refactor Sidebar Context & Data Structures**
   - Bổ sung định nghĩa `NavigationModule` (`work` | `documents` | `org`) và phân nhóm menu trong `sidebar-context.tsx`.
   - Tự động nhận diện `currentModule` dựa trên `pathname`.
2. **Giai đoạn 2: Xây dựng Component `AppRail` & Tinh chỉnh `AppSidebar`**
   - Tách Rail 1 cố định và biến Rail 2 thành panel phụ thuộc module.
   - Cung cấp tính năng chuyển đổi mượt mà giữa trạng thái mở rộng và thu gọn (Ảnh 2).
3. **Giai đoạn 3: Xây dựng Trang mẫu Văn bản & Công văn (`/documents`)**
   - Tạo trang `/documents` với layout chuyên nghiệp gồm 4 tab (Công văn đến, Công văn đi/Tờ trình, Chờ ký duyệt, Sổ lưu trữ).
4. **Giai đoạn 4: Kiểm thử tự động & Đánh giá trực quan**
   - Kiểm tra Typecheck (`npm run typecheck`).
   - Viết unit tests kiểm tra cấu trúc Dual-Rail, routing và active state.
   - Kiểm định trên Browser Preview với cả 3 vai trò (BGH, Trưởng khoa, Giảng viên).
