# ĐẶC TẢ KỸ THUẬT & KIẾN TRÚC HỆ THỐNG QCET E-OFFICE
## Hệ Thống Quản Trị & Điều Hành Văn Phòng Điện Tử Trường Cao Đẳng Kỹ Thuật Công Nghệ Quy Nhơn
**Mã tài liệu:** `QCET-SPEC-EOFFICE-2026-V1.2`  
**Ngày phát hành:** `2026-09-06`  
**Tiêu chuẩn tham chiếu:** MIT Atlas Gateway, Stanford Authority Manager, NUS uNivUS, Linear Design System, Enterprise RBAC & ISO 27001.

---

## 1. TỔNG QUAN & TẦM NHÌN HỆ THỐNG (EXECUTIVE OVERVIEW)

### 1.1 Bối cảnh & Mục tiêu
QCET E-Office là nền tảng số hóa quản trị đại học toàn diện dành riêng cho **Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn**, tích hợp điều hành chiến lược của Ban Giám Hiệu, chỉ đạo tác nghiệp của các Trưởng đơn vị/Khoa/Phòng và quản lý nhiệm vụ cá nhân của toàn thể Giảng viên, Chuyên viên.

Hệ thống giải quyết triệt để 4 vấn đề lớn của văn phòng điện tử truyền thống:
1. **Phân mảnh dữ liệu**: Không còn cảnh BGH và phòng ban phải quản lý công việc qua các bảng tính Excel hoặc nhóm chat rời rạc.
2. **Tắc nghẽn phê duyệt**: Xây dựng quy trình ủy quyền, phê duyệt minh chứng DACUM và tự động leo thang (auto-escalation) khi quá hạn SLA.
3. **Mù mờ tiến độ**: Dải thông số KPI thời gian thực, ma trận tiến độ đơn vị theo mã màu RAG (*Red - Amber - Green*).
4. **Giao diện lỗi thời & rác thông tin (UI Slop)**: Triệt tiêu các thành phần trang trí gây phân tâm; đạt chuẩn mật độ thông tin cao, tốc độ phản hồi tức thì (<50ms).

---

## 2. KIẾN TRÚC PHÂN CẤP 3 TẦNG QUẢN TRỊ (3-TIER GOVERNANCE & RBAC)

Hệ thống phân định 3 cấp độ quản trị chặt chẽ, bảo đảm nguyên tắc **Tối thiểu đặc quyền (Least Privilege)** và **Tách biệt nhiệm vụ (Separation of Duties)**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: BAN GIÁM HIỆU & QUẢN TRỊ VIÊN (BGH / ADMIN)                    │
│ ├─ Giám sát toàn trường: 304 Nhiệm vụ cấp Trường, Ma trận 12 đơn vị    │
│ ├─ Phê duyệt tối cao: Mốc chiến lược, kiểm định, phân bổ ngân sách     │
│ └─ Cờ đỏ (Red Flag): Nhận cảnh báo tức thì khi nhiệm vụ trễ hạn >48h   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ (Giao việc cấp Trường / Chỉ đạo)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: TRƯỞNG KHOA / TRƯỞNG PHÒNG (TRƯỞNG ĐƠN VỊ)                    │
│ ├─ Điều hành đơn vị: 920 Công việc Đơn vị, cân bằng tải giảng viên     │
│ ├─ Ủy quyền nhiệm vụ (Delegation): Phân công, chuyển giao tạm thời     │
│ └─ Kiểm định bước 1: Đánh giá minh chứng DACUM trước khi trình BGH     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ (Giao việc cụ thể / Theo dõi)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: GIẢNG VIÊN / CHUYÊN VIÊN (STAFF & FACULTY)                    │
│ ├─ Không gian cá nhân: Tiếp nhận việc được phân công, lịch trình tuần  │
│ ├─ Báo cáo minh chứng: Tải giáo trình, tài liệu OCR, biên bản họp      │
│ └─ Phản hồi nghẽn việc: Báo cáo khó khăn, yêu cầu gia hạn trực tiếp    │
└─────────────────���──────────────────────────────────────────────────────┘
```

### 2.1 Ma Trận Phân Quyền Chi Tiết

| Chức năng / Quyền hạn | BGH (`BAN_GIAM_HIEU`) | Trưởng đơn vị (`TRUONG_PHONG`) | Chuyên viên (`CHUYEN_VIEN`) |
| :--- | :---: | :---: | :---: |
| **Xem KPI & Ma trận tiến độ toàn trường** | Toàn quyền xem | Xem đơn vị mình + KPI tổng | Chỉ xem KPI cá nhân & đơn vị |
| **Tạo Nhiệm vụ cấp Trường** | Có | Không (Chỉ đề xuất) | Không |
| **Tạo & Giao Công việc Đơn vị** | Có | Toàn quyền trong đơn vị | Không (Chỉ tạo việc cá nhân) |
| **Ủy quyền nhiệm vụ (Delegation)** | Có | Có (Nội bộ đơn vị) | Không |
| **Phê duyệt minh chứng DACUM bước 1** | Có (Duyệt vượt cấp) | Toàn quyền trong đơn vị | Không |
| **Phê duyệt hoàn thành cấp Trường** | Toàn quyền duyệt | Không | Không |
| **Xuất báo cáo tổng hợp / Excel** | Toàn trường | Trong đơn vị | Cá nhân |
| **Quản trị người dùng & Phân vai trò** | Quản trị viên (Admin) | Không | Không |

---

## 3. BỐ CỤC CỔNG ĐIỀU HÀNH ĐA PHÂN KHU (MULTI-ZONE PORTAL HUB)

Bố cục không gian làm việc tuân thủ mô hình **Bento Grid** của các đại học tiên tiến thế giới (MIT Atlas, Ellucian Experience), chia thành 5 phân khu chức năng:

```
AppShell
├── AppTopbar (52px, Sticky, Glassmorphism OKLCH)
│   ├── Left: SidebarToggle (Ctrl+B) + Contextual Breadcrumbs + LiveClock
│   ├── Center: Zone Switcher Tabs (Portal, Dashboard, Tasks, Calendar, Org)
│   └── Right: QuickTaskButton (Phím 'N') + Notifications + ThemeToggle + UserMenu
├── AppSidebar (Thu gọn 64px / Mở rộng 240px)
│   ├── Nhóm Phân Khu Điều Hành (Portal, Dashboard, Tasks, Calendar, Org)
│   └── Nhóm Tiện Ích & Danh Mục (Thông báo, Cài đặt, Tài liệu hướng dẫn)
└── Main Content Container (Dynamic Router & Zone Switcher)
```

### 3.1 Cấu hình 5 Phân Khu (Workspace Zones)

1. **Phân khu 1 - Cổng thông tin Tổng thể (`zone=portal` / `/portal`)**:
   - **Bento Grid 12 cột**:
     - *Hero Card (8 cột)*: Thống kê nhanh tiến độ trường, dải KPI (304 Cấp trường, 920 Đơn vị, 31% hoàn thành).
     - *Nhiệm vụ trọng tâm (4 cột)*: 5 công việc khẩn cấp nhất cần BGH hoặc Trưởng phòng xử lý ngay.
     - *Lịch công tác tuần (4 cột)*: Mốc họp chi bộ, họp hội đồng trường, thanh tra giáo d���c.
     - *Ma trận Phòng Ban (4 cột)*: Tình trạng RAG của 12 Khoa/Phòng/Trung tâm.
     - *Lối tắt 1-chạm (4 cột)*: Tạo nhanh nhiệm vụ, tra cứu văn bản, phân bổ DACUM.
2. **Phân khu 2 - Bảng chỉ số Điều hành (`zone=dashboard` / `/dashboard`)**:
   - Ma trận tiến độ đơn vị (`DepartmentProgressMatrix`).
   - Trung tâm chỉ đạo điều hành của BGH (`ExecutiveActionCenter`).
   - Dải thông số vĩ mô (`ExecutiveStatStrip`).
3. **Phân khu 3 - Quản lý Công việc & Giao việc (`zone=tasks` / `/`)**:
   - Bộ lọc đa chiều: Loại nhiệm vụ (Cấp trường / Đơn vị), Đơn vị chủ trì, Mức độ ưu tiên, Trạng thái.
   - 3 Chế độ xem: Bảng dữ liệu chuẩn Enterprise (`Table`), Thẻ Kanban (`Board`), Dòng thời gian (`Timeline`).
   - Ngăn xem nhanh bên phải (`SideDrawer`) chi tiết nhiệm vụ và lịch sử trao đổi.
4. **Phân khu 4 - Lịch công tác & Sự kiện (`zone=calendar` / `/calendar`)**:
   - Đồng bộ lịch công tác tuần của Ban Giám Hiệu.
   - Lịch bảo vệ đề tài, họp chuyên môn các khoa kỹ thuật và kinh tế.
5. **Phân khu 5 - Cơ cấu Tổ chức & Nhân sự (`zone=org` / `/org`)**:
   - Cây sơ đồ tổ chức phân cấp từ Hội đồng trường, Ban Giám hiệu, đến các Phòng ban, Khoa chuyên môn và Trung tâm.
   - Danh bạ cán bộ, chuyên môn đào tạo, định mức tải giảng dạy.

---

## 4. CƠ SỞ DỮ LIỆU HẠT NHÂN (POSTGRESQL 16 & PRISMA DATA CONTRACT)

Hệ thống vận hành trên **PostgreSQL 16 Enterprise**, quản lý qua **Prisma ORM**.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  ADMIN
  BAN_GIAM_HIEU
  TRUONG_PHONG
  CHUYEN_VIEN
}

enum PriorityLevel {
  KHAN_CAP
  CAO
  TRUNG_BINH
  THAP
}

enum TaskStatus {
  CHUA_BAT_DAU
  DANG_THUC_HIEN
  CHO_PHE_DUYET
  HOAN_THANH
  TRE_HAN
}

enum DelegationScope {
  DON_VI_NOI_BO
  LIEN_PHONG_BAN
  CHIEN_LUOC_TOAN_TRUONG
}

model Department {
  id          String   @id @default(uuid())
  code        String   @unique @db.VarChar(50) // Ví dụ: BGH, CNTT, DTVT, KTX...
  name        String   @db.VarChar(255)
  leadTitle   String?  @map("lead_title") @db.VarChar(100)
  colorHex    String?  @map("color_hex") @db.VarChar(20)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  users       User[]
  tasks       Task[]   @relation("DepartmentTasks")

  @@map("departments")
}

model User {
  id             String    @id @default(uuid())
  email          String    @unique @db.VarChar(255)
  passwordHash   String?   @map("password_hash") @db.VarChar(255)
  name           String    @db.VarChar(255)
  avatarUrl      String?   @map("avatar_url") @db.Text
  role           UserRole  @default(CHUYEN_VIEN)
  title          String?   @db.VarChar(100)
  departmentId   String?   @map("department_id")
  isActive       Boolean   @default(true) @map("is_active")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  department     Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  createdTasks   Task[]      @relation("TaskCreator")
  assignedTasks  Task[]      @relation("TaskAssignee")
  delegations    Delegation[] @relation("UserDelegations")

  @@map("users")
}

model Task {
  id             String        @id @default(uuid())
  code           String        @unique @db.VarChar(50) // VD: NV-2026-001
  title          String        @db.VarChar(500)
  description    String?       @db.Text
  type           String        @default("CAP_TRUONG") // CAP_TRUONG | DON_VI
  priority       PriorityLevel @default(TRUNG_BINH)
  status         TaskStatus    @default(CHUA_BAT_DAU)
  progress       Int           @default(0) // 0-100%

  startDate      DateTime?     @map("start_date")
  dueDate        DateTime?     @map("due_date")
  completedAt    DateTime?     @map("completed_at")

  creatorId      String        @map("creator_id")
  assigneeId     String?       @map("assignee_id")
  departmentId   String?       @map("department_id")

  dacumEvidenceUrl String?     @map("dacum_evidence_url") @db.Text
  slaHours       Int           @default(48) @map("sla_hours")
  isEscalated    Boolean       @default(false) @map("is_escalated")

  creator        User          @relation("TaskCreator", fields: [creatorId], references: [id])
  assignee       User?         @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  department     Department?   @relation("DepartmentTasks", fields: [departmentId], references: [id], onDelete: SetNull)
  delegations    Delegation[]

  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")

  @@index([status, priority])
  @@index([departmentId])
  @@map("tasks")
}

model Delegation {
  id             String          @id @default(uuid())
  taskId         String          @map("task_id")
  delegatorId    String          @map("delegator_id")
  delegateeId    String          @map("delegatee_id")
  scope          DelegationScope @default(DON_VI_NOI_BO)
  notes          String?         @db.Text
  expiresAt      DateTime?       @map("expires_at")
  createdAt      DateTime        @default(now()) @map("created_at")

  task           Task            @relation(fields: [taskId], references: [id], onDelete: Cascade)
  delegator      User            @relation("UserDelegations", fields: [delegatorId], references: [id])

  @@map("task_delegations")
}
```

---

## 5. ĐẶC TẢ MÁY TRẠNG THÁI & LEO THANG TỰ ĐỘNG (DELEGATION & SLA STATE MACHINE)

```
       [ KHỞI TẠO (DRAFT) ]
                │
                ▼ (Giao việc cho đơn vị / cá nhân)
       [ ĐANG THỰC HIỆN ] ──(Quá hạn SLA 48h)──► [ CỜ ĐỎ LEO THANG (ESCALATED) ]
                │                                           │ (BGH can thiệp trực tiếp)
                ▼ (Nộp minh chứng hoàn thành)              ▼
       [ CHỜ DUYỆT BƯỚC 1 (Khoa/Phòng) ]
                │
                ├── (Trưởng phòng yêu cầu sửa) ──► [ ĐANG THỰC HIỆN ]
                │
                ▼ (Trưởng phòng xác nhận đạt)
       [ CHỜ DUYỆT BƯỚC 2 (BGH / Cấp Trường) ]
                │
                ├── (BGH bác bỏ minh chứng) ──► [ ĐANG THỰC HIỆN ]
                │
                ▼ (BGH phê duyệt chính thức)
       [ HOÀN THÀNH & LƯU TRỮ ]
```

### 5.1 Quy tắc Leo Thang SLA (Auto-Escalation Engine)
1. Mỗi nhiệm vụ cấp trường được ấn định SLA cảnh báo (mặc định: `48h` trước hạn ch��t).
2. Khi tiến độ = 0% hoặc không có cập nhật trong 48h, trường `isEscalated` được bật sang `true`.
3. Hệ thống gửi thông báo đẩy trực tiếp vào hộp thư điều hành của Ban Giám Hiệu (`NotificationPopover`) và ghim biểu tượng chuông cảnh báo đỏ trên thanh tiêu đề.

---

## 6. TIÊU CHUẨN THIẾT KẾ KỸ THUẬT & CHỐNG "SLOP" (ANTI-SLOP GUIDELINES)

Hệ thống áp dụng các tiêu chuẩn thiết kế khắt khe, hướng tới đẳng cấp các công cụ như Linear và Raycast:

1. **0% Emoji Trang Trí**:
   - Tuyệt đối không dùng emoji (🚀, 📌, 🔥, ✅, ⚠️, ...) làm icon trong mã nguồn giao diện.
   - Toàn bộ biểu tượng trực quan dùng thư viện chuẩn `lucide-react`.
2. **Quy Chuẩn Độ Dày Nét Icon (Stroke Width)**:
   - Tất cả icon Lucide bắt buộc đặt `strokeWidth={1.5}` để tạo độ thanh mảnh, sang trọng và đồng nhất.
3. **Hiển Thị Số Liệu Tabular Numerals**:
   - Toàn bộ chữ số (thống kê tiến độ, tỉ lệ %, mã công việc, số điện thoại, ngày giờ) bắt buộc sử dụng lớp CSS `font-mono tabular-nums`. Điều này ngăn chặn sự rung lắc layout khi dữ liệu được cập nhật thời gian thực.
4. **Không Gian Màu OKLCH & Phân Tầng Thị Giác (Elevation Levels)**:
   - Sử dụng OKLCH với độ tương phản đạt chuẩn WCAG AA/AAA.
   - Thang đổ bóng tinh tế: `shadow-2xs`, `shadow-xs`, kết hợp viền bán trong suốt `border-border/60`.
5. **Điều Khiển Bàn Phím Chuyên Nghiệp (Power-User Shortcuts)**:
   - Phím `N`: Mở modal tạo mới công việc nhanh từ mọi màn hình.
   - Phím `Ctrl+B / ⌘B`: Bật/tắt thanh điều hướng bên (Sidebar).
   - Phím số `1`, `2`, `3`, `4`, `5`: Chuyển tức thì giữa 5 phân khu chức năng.
   - Phím `Ctrl+K / ⌘K`: Kích hoạt thanh tìm kiếm toàn năng (Omnibar tra cứu cán bộ, công việc, phòng ban).

---

## 7. AN NINH BẢO MẬT & CHỈ TIÊU HIỆU NĂNG (SECURITY & PERFORMANCE)

### 7.1 Chính Sách An Toàn & Bảo Mật
- **Cơ chế Phiên (Session Management)**:
  - Cookie `qcet_session` chứa JWT ký bởi thuật toán HS256 với secret có độ dài tối thiểu 32 ký tự.
  - Cấu hình cookie: `HttpOnly: true`, `SameSite: Lax`, `Secure: true (trên production)`, `Path: /`.
  - Nghiêm cấm lưu trữ JWT trong `localStorage` hay `sessionStorage` của trình duyệt.
- **Kiểm tra trạng thái kích hoạt (`isActive`)**:
  - Mọi request vào `/api/auth/login` và `/api/auth/me` đều đối soát trạng thái `user.isActive === true` trong PostgreSQL. Nếu tài khoản bị đình chỉ, phiên làm việc lập tức vô hiệu hóa (HTTP 403).
- **Phân định quyền tạo tài khoản**:
  - API đăng ký công cộng `/api/auth/register` ép cứng quyền `CHUYEN_VIEN`. Không chấp nhận tham số phân quyền từ phía client để triệt tiêu nguy cơ leo thang đặc quyền (Privilege Escalation).
- **Mã Hóa Mật Khẩu**:
  - Sử dụng thuật toán `bcryptjs` với 10 vòng salt (`saltRounds = 10`), kiểm tra độ dài mật khẩu từ 6 đến 72 ký tự.

### 7.2 Ngân Sách Hiệu Năng (Performance Budgets)
- **First Contentful Paint (FCP)**: < 0.8 giây.
- **Time to Interactive (TTI)**: < 1.2 giây.
- **Interaction to Next Paint (INP)**: < 50ms (Nhờ cơ chế Optimistic UI).
- **Zero Full-Page Reload**: Điều hướng phân khu mượt mà qua Next.js Client Router, không tải lại trang.

---

## 8. LỘ TRÌNH TRIỂN KHAI & MỞ RỘNG (ROADMAP)

- **Giai đoạn 1 (Hiện tại - Hoàn tất)**: CSDL PostgreSQL 16, Xác thực bảo mật, Giao diện 5 phân khu Bento Grid, Quản lý công việc 3 cấp, Tiêu chuẩn Anti-slop.
- **Giai đoạn 2 (Tiếp theo)**:
  - Tích hợp định danh tập trung Google Workspace OAuth (`@cdktcnqn.edu.vn`).
  - Module AI hỗ trợ BGH tóm tắt báo cáo minh chứng DACUM và phát hiện điểm nghẽn tiến độ.
  - Ứng dụng PWA Mobile điều hành nhanh cho Ban Giám Hiệu.
