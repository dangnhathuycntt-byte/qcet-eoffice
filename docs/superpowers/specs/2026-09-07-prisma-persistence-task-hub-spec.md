# ĐẶC TẢ THIẾT KẾ KỸ THUẬT: TẦNG LƯU TRỮ DỮ LIỆU BỀN VỮNG & ĐỒNG BỘ NHIỆM VỤ
**Tài liệu:** Technical Specification - Prisma PostgreSQL Persistence & Unified Task Hub  
**Dự án:** QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)  
**Ngày lập:** 07/09/2026  
**Trạng thái:** DRAFT - CHỜ PHÊ DUYỆT  

---

## 1. BỐI CẢNH & MỤC TIÊU HỆ THỐNG

### 1.1. Hiện trạng và Thách thức (Problem Statement)
* Hiện tại hệ thống QCET E-Office đang sở hữu giao diện người dùng (UI/UX) và logic tính toán nghiệp vụ (Business Engines) rất mạnh mẽ (815 tests xanh).
* Tuy nhiên, tệp `prisma/schema.prisma` mới chỉ dừng lại ở 5 bảng cơ bản liên quan đến Người dùng (`User`, `Account`, `Session`, `Department`).
* Toàn bộ dữ liệu Nhiệm vụ (`Task`), Phân công nhân sự (`TaskAssignee`), Sản phẩm/Minh chứng bàn giao (`TaskDeliverable`), Phân quyền thẩm định chuyên môn DACUM (`DacumDelegation`), và Lệnh điều hành BGH (`ExecutiveResolution`) vẫn đang được xử lý tạm thời trên bộ nhớ RAM (In-memory mock data).
* Hậu quả: Khi người dùng thao tác tạo mới việc, nộp minh chứng, gia hạn hoặc tải lại trang (F5), dữ liệu bị hoàn nguyên về trạng thái mẫu ban đầu, ngăn cản việc đưa hệ thống vào thử nghiệm thực tế tại **Phòng Đào tạo** và **Khoa CNTT**.

### 1.2. Mục tiêu Kỹ thuật (Engineering Goals)
1. **Thiết kế Schema Prisma toàn diện trên PostgreSQL:** Chuẩn hóa cấu trúc thực thể, quan hệ ràng buộc khóa ngoại (Foreign Keys), chỉ mục (Indexes) tối ưu hóa truy vấn theo chu kỳ năm học và phòng ban.
2. **Chuẩn hóa Định danh Vai trò (Role Enums):** Khắc phục triệt để sự sai lệch giữa `UserRole` trong CSDL (`BAN_GIAM_HIEU`, `TRUONG_PHONG`, `CHUYEN_VIEN`, `ADMIN`) và TypeScript (`'ADMIN' | 'MANAGER' | 'STAFF'`).
3. **Cung cấp API CRUD & Server Actions bền vững:** Xây dựng các route handlers chuẩn RESTful (`/api/tasks`, `/api/tasks/[id]`, `/api/tasks/[id]/deliverables`, `/api/executive/resolutions`) tích hợp phân quy���n chặt chẽ.
4. **Adapter Chuyển đổi Tương thích Ngược (Backward Compatibility):** Đảm bảo toàn bộ 815 unit tests hiện hữu và các UI components (`executive-cockpit-workspace.tsx`, `department-manager-workspace.tsx`, `cascading-task-table.tsx`) tiếp tục hoạt động trơn tru mà không bị vỡ giao diện.

---

## 2. THIẾT KẾ MÔ HÌNH DỮ LIỆU (PRISMA SCHEMA SPECIFICATION)

### 2.1. Chuẩn hóa Định danh Vai trò & Trạng thái
```prisma
enum UserRole {
  BAN_GIAM_HIEU
  TRUONG_PHONG
  CHUYEN_VIEN
  ADMIN
}

enum TaskScope {
  SCHOOL          // Việc cấp trường do BGH giao cho các đơn vị
  DEPARTMENT      // Việc nội bộ do Trưởng đơn vị phân công cho cán bộ/giảng viên
  INDIVIDUAL      // Việc cá nhân tự quản lý
}

enum TaskStatus {
  NOT_STARTED     // Chưa thực hiện (trong hạn)
  IN_PROGRESS     // Đang thực hiện (trong hạn)
  WAITING_APPROVAL// Đã nộp sản phẩm, chờ Trưởng khoa/phòng hoặc BGH thẩm định
  COMPLETED       // Đã hoàn thành (đúng hạn hoặc có phê duyệt)
  OVERDUE         // Quá hạn chưa hoàn thành
  CANCELLED       // Hủy bỏ / Điều chỉnh theo lệnh BGH
}

enum TaskPriority {
  URGENT          // Hỏa tốc / Khẩn cấp
  HIGH            // Ưu tiên cao
  NORMAL          // Bình thường
  LOW             // Ưu tiên thấp
}

enum AssigneeRole {
  PRIMARY_OWNER   // Người/Đơn vị chủ trì (chịu trách nhiệm chính)
  COLLABORATOR    // Người/Đơn vị phối hợp thực hiện
  SUPERVISOR      // Người giám sát / thẩm định kết quả
}

enum DeliverableReviewStatus {
  PENDING             // Đang chờ thẩm định
  APPROVED            // Đạt chuẩn nghiệm thu
  REVISION_REQUIRED   // Chưa đạt, yêu cầu bổ sung / sửa đổi
}

enum ResolutionType {
  EXTEND_DEADLINE     // BGH gia hạn thời gian hoàn thành
  REASSIGN_OWNER      // BGH điều chuyển đơn vị/cá nhân chủ trì
  DIRECTIVE_NOTE      // BGH ban hành chỉ đạo nóng
  DISMISS_BOTTLENECK  // Giải tỏa điểm nghẽn điều hành
}
```

### 2.2. Chi tiết Mô hình Các Thực Thể Nghiệp Vụ

```prisma
// ==========================================
// 1. THỰC THỂ NHIỆM VỤ (CORE TASK MODEL)
// ==========================================
model Task {
  id              String         @id @default(cuid())
  code            String         @unique @db.VarChar(50) // Ví dụ: "NV-2026-09-001"
  title           String         @db.VarChar(500)
  description     String?        @db.Text
  scope           TaskScope      @default(SCHOOL)
  status          TaskStatus     @default(NOT_STARTED)
  priority        TaskPriority   @default(NORMAL)
  progressPercent Int            @default(0) @map("progress_percent") // 0 - 100
  
  // Chu kỳ học thuật QCET (25 tháng trước đến 24 tháng sau)
  academicMonth   Int            @map("academic_month") // 1 - 12
  academicYear    String         @map("academic_year") @db.VarChar(20) // "2026-2027"
  
  startDate       DateTime       @default(now()) @map("start_date")
  dueDate         DateTime       @map("due_date")
  completedAt     DateTime?      @map("completed_at")
  
  // Đơn vị quản lý chính
  departmentId    String?        @map("department_id") @db.VarChar(50)
  department      Department?    @relation(fields: [departmentId], references: [id])
  
  // Người khởi tạo
  createdById     String         @map("created_by_id")
  createdBy       User           @relation("TaskCreatedBy", fields: [createdById], references: [id])
  
  // Cấu trúc phân cấp nhiệm vụ (Parent - Child Subtasks)
  parentTaskId    String?        @map("parent_task_id")
  parentTask      Task?          @relation("SubTasks", fields: [parentTaskId], references: [id], onDelete: Cascade)
  subTasks        Task[]         @relation("SubTasks")
  
  // Quan hệ phân công, minh chứng, ủy quyền và can thiệp BGH
  assignees       TaskAssignee[]
  deliverables    TaskDeliverable[]
  delegations     DacumDelegation[]
  resolutions     ExecutiveResolution[]
  
  createdAt       DateTime       @default(now()) @map("created_at")
  updatedAt       DateTime       @updatedAt @map("updated_at")

  @@index([departmentId, academicYear, academicMonth])
  @@index([status, dueDate])
  @@index([scope, priority])
  @@map("tasks")
}

// ==========================================
// 2. PHÂN CÔNG NHÂN SỰ / ĐƠN VỊ (ASSIGNEES)
// ==========================================
model TaskAssignee {
  id           String       @id @default(cuid())
  taskId       String       @map("task_id")
  userId       String       @map("user_id")
  roleInTask   AssigneeRole @default(PRIMARY_OWNER) @map("role_in_task")
  assignedAt   DateTime     @default(now()) @map("assigned_at")
  
  task         Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId, roleInTask])
  @@index([userId, roleInTask])
  @@map("task_assignees")
}

// ==========================================
// 3. MINH CHỨNG SẢN PHẨM BÀN GIAO (DELIVERABLES)
// ==========================================
model TaskDeliverable {
  id           String                  @id @default(cuid())
  taskId       String                  @map("task_id")
  title        String                  @db.VarChar(255)
  fileUrl      String                  @map("file_url") @db.Text
  fileType     String?                 @map("file_type") @db.VarChar(50) // PDF, DOCX, XLSX, LINK
  fileSize     Int?                    @map("file_size") // Dung lượng bytes
  uploadedById String                  @map("uploaded_by_id")
  
  reviewStatus DeliverableReviewStatus @default(PENDING) @map("review_status")
  reviewerId   String?                 @map("reviewer_id")
  reviewNote   String?                 @map("review_note") @db.Text
  reviewedAt   DateTime?               @map("reviewed_at")
  
  task         Task                    @relation(fields: [taskId], references: [id], onDelete: Cascade)
  uploadedBy   User                    @relation("DeliverableUploadedBy", fields: [uploadedById], references: [id])
  reviewer     User?                   @relation("DeliverableReviewer", fields: [reviewerId], references: [id])
  
  createdAt    DateTime                @default(now()) @map("created_at")
  updatedAt    DateTime                @updatedAt @map("updated_at")

  @@index([taskId, reviewStatus])
  @@map("task_deliverables")
}

// ==========================================
// 4. ỦY QUYỀN CHUYÊN MÔN DACUM (DACUM DELEGATIONS)
// ==========================================
model DacumDelegation {
  id                 String       @id @default(cuid())
  taskId             String       @map("task_id")
  grantorId          String       @map("grantor_id")          // Người ủy quyền (Trưởng khoa / BGH)
  delegateId         String       @map("delegate_id")         // Người được ủy quyền (Tổ trưởng / Giảng viên chính)
  committeeRole      String       @map("committee_role") @db.VarChar(100) // Ví dụ: "Chủ tịch Hội đồng Thẩm định CTĐT"
  authorityScope     String       @map("authority_scope") @db.VarChar(255)// "Phê duyệt ma trận kỹ năng DACUM"
  expiresAt          DateTime     @map("expires_at")
  isActive           Boolean      @default(true) @map("is_active")
  
  task               Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  grantor            User         @relation("DelegationGrantor", fields: [grantorId], references: [id])
  delegate           User         @relation("DelegationDelegate", fields: [delegateId], references: [id])
  
  createdAt          DateTime     @default(now()) @map("created_at")
  updatedAt          DateTime     @updatedAt @map("updated_at")

  @@index([delegateId, isActive, expiresAt])
  @@map("dacum_delegations")
}

// ==========================================
// 5. NGHỊ QUYẾT & LỆNH ĐIỀU HÀNH BGH (EXECUTIVE RESOLUTIONS)
// ==========================================
model ExecutiveResolution {
  id              String         @id @default(cuid())
  taskId          String         @map("task_id")
  actorId         String         @map("actor_id") // Thành viên BGH thực hiện
  resolutionType  ResolutionType @map("resolution_type")
  directiveNote   String?        @map("directive_note") @db.Text
  grantedDays     Int?           @map("granted_days") // Số ngày được gia hạn thêm (+3, +7)
  previousDueDate DateTime?      @map("previous_due_date")
  newDueDate      DateTime?      @map("new_due_date")
  previousOwnerId String?        @map("previous_owner_id")
  newOwnerId      String?        @map("new_owner_id")
  
  task            Task           @relation(fields: [taskId], references: [id], onDelete: Cascade)
  actor           User           @relation("ResolutionActor", fields: [actorId], references: [id])
  
  createdAt       DateTime       @default(now()) @map("created_at")

  @@index([taskId, resolutionType])
  @@map("executive_resolutions")
}
```

---

## 3. KIẾN TRÚC API & LUỒNG DỮ LIỆU (DATA FLOW & ENDPOINTS)

### 3.1. Danh mục Tuyến API Cốt Lõi
1. `GET /api/tasks`
   * **Mục đích:** Truy xuất danh sách nhiệm vụ đa chiều có phân trang và lọc theo chu kỳ tháng QCET.
   * **Query Parameters:** `scope`, `dept`, `academicMonth`, `academicYear`, `status`, `priority`, `search`.
   * **B���o mật:** Giảng viên chỉ xem được việc cá nhân (`scope=individual`) hoặc việc phòng ban trực thuộc (`departmentId`); BGH và Admin có quyền xem `scope=school` trên 11 đơn vị.
2. `POST /api/tasks`
   * **Mục đích:** Tạo mới nhiệm vụ.
   * **Payload Validation:** Kiểm tra bắt buộc có Title, DueDate, DepartmentId, PrimaryOwner.
   * **Logic tự động:** Sinh mã định danh quy chuẩn `NV-YYYY-MM-XXXX` (liên tục trong tháng).
3. `PATCH /api/tasks/[id]`
   * **Mục đích:** Cập nhật tiến độ (% hoàn thành), đổi trạng thái, sửa đổi ghi chú.
4. `POST /api/tasks/[id]/deliverables`
   * **Mục đích:** Giảng viên nộp minh chứng / sản phẩm hoàn thành.
   * **Side-effects:** Tự động chuyển `status` của Task sang `WAITING_APPROVAL`.
5. `POST /api/tasks/[id]/review`
   * **Mục đích:** Trưởng đơn vị hoặc BGH nghiệm thu sản phẩm.
   * **Kiểm tra SoD (Separation of Duties):** Cấm tuyệt đối người nộp minh chứng tự duyệt cho chính mình.
   * **Kết quả:** Nếu `APPROVED` -> Task chuyển `COMPLETED`. Nếu `REVISION_REQUIRED` -> Task giữ `IN_PROGRESS` kèm ghi chú sửa đổi.
6. `POST /api/executive/resolutions`
   * **Mục đích:** BGH xử lý điểm nghẽn qua `ExecutiveResolutionDrawer` (Gia hạn, Điều chuyển người chủ trì, Bút phê chỉ đạo).
   * **Ghi vết Audit:** Lưu bản ghi vào bảng `executive_resolutions` phục vụ Báo cáo giao ban tuần.

### 3.2. Lớp Adapter Đồng Bộ (Domain Adapter Interface)
Để tránh sửa đổi ồ ạt các React components giao diện đang chạy ổn định, tạo file `src/lib/adapters/task-db-adapter.ts`:
```typescript
import { Task as PrismaTask, TaskAssignee, TaskDeliverable, Department } from '@prisma/client';
import { SchoolTask } from '@/lib/unified-task-hub';

export function mapPrismaTaskToSchoolTask(
  raw: PrismaTask & {
    department?: Department | null;
    assignees?: (TaskAssignee & { user: { name: string; avatarUrl?: string | null } })[];
    deliverables?: TaskDeliverable[];
  }
): SchoolTask {
  // Ánh xạ an toàn từ mô hình Prisma sang SchoolTask interface hiện hữu
  const primaryAssignee = raw.assignees?.find(a => a.roleInTask === 'PRIMARY_OWNER');
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description || '',
    department: raw.department?.name || 'Văn phòng trường',
    assignedTo: primaryAssignee?.user?.name || 'Chưa phân công',
    dueDate: raw.dueDate.toISOString().split('T')[0],
    priority: raw.priority.toLowerCase() as any,
    status: raw.status.toLowerCase() as any,
    academicMonth: raw.academicMonth,
    progress: raw.progressPercent,
    // Các trường đặc thù khác...
  };
}
```

---

## 4. KẾ HOẠCH KIỂM THỬ & DI CHUYỂN DỮ LIỆU (TESTING & MIGRATION)

### 4.1. Kịch bản Dữ liệu Mẫu Ban đầu (Seed Data Strategy)
* Cập nhật `prisma/seed.ts` để nạp dữ liệu chuẩn xác cho **11 đơn vị thực tế** của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn:
  1. Ban Giám hiệu (Hiệu trưởng & 2 Phó Hiệu trưởng)
  2. Phòng Đào tạo (Đơn vị thí điểm 1)
  3. Khoa Công nghệ Thông tin (Đơn vị thí điểm 2)
  4. Khoa Cơ khí
  5. Khoa Điện - Điện tử
  6. Khoa Kỹ thuật Ô tô
  7. Phòng Công tác Học sinh - Sinh viên
  8. Phòng Quản trị - Thiết bị
  9. Phòng Tài chính - Kế toán
  10. Trung tâm Đào tạo Lái xe & Dịch vụ Kỹ thuật
  11. Trung tâm Tuyển sinh & Truyền thông
* Tự động sinh tối thiểu 40 nhiệm vụ mẫu rải đều theo chu kỳ 12 tháng năm học 2026–2027 với đầy đủ các trạng thái (Đúng hạn, Quá hạn, Chờ duyệt, Điểm nghẽn cần tháo gỡ).

### 4.2. Tiêu chí Nghiệm thu Kỹ thuật (Acceptance Criteria)
1. Lệnh `npx prisma db push` hoặc `npx prisma migrate dev` thực thi thành công không lỗi cú pháp trên PostgreSQL.
2. Lệnh `npm run db:seed` nạp đầy đủ người dùng và nhiệm vụ mẫu vào cơ sở dữ liệu.
3. Toàn bộ **815 unit tests hiện tại vẫn đạt 100% pass** (`npm test`).
4. Thao tác thêm mới nhiệm vụ hoặc nộp minh chứng trên giao diện Web lưu dữ liệu thực tế vào PostgreSQL và vẫn hiển thị nguyên vẹn sau khi bấm Refresh (`Cmd + Shift + R`).
