# RFC-01: TaskAssignee to TaskActor Reconciliation Analysis
(Phân Tích Toàn Diện & Kế Hoạch Hợp Nhất Mô Hình Phân Công TaskAssignee Sang Mô Hình Quan Hệ ReBAC TaskActor)

- **Trạng thái**: PROPOSED (Chờ thẩm định tại Architecture Review Gate — Phase 4 / WI-4.1, Issue #63)
- **Ngày lập**: 2026-09-22
- **Tác giả**: Technical Architecture Working Group & Security Working Group
- **Người thẩm định**: Owner & Tech Lead (Architecture Review Gate)
- **Tài liệu tham chiếu**:
  - `ADR-001: Single Canonical Maker-Checker Guard Policy`
  - `ADR-002: Contextual Authorization Policy Engine (10-Step Pipeline)`
  - `ADR-003: Task Lifecycle with Derived Attention Model`
  - `ADR-005: TaskAssignee to TaskActor Migration Strategy (PROPOSED)`
  - `ADR-006: Department to OrganizationalUnit Consolidation`
  - `ADR-007: REST API Standard với Chuẩn Báo Lỗi RFC 9457 Problem Details`
  - `RFC-02: Department to OrganizationalUnit Reconciliation Analysis`
  - `RFC-03: Delegation Consolidation Analysis`
  - `docs/architecture/migration-map.md` (Mục 4.2 & FACT F06)
  - `docs/architecture/api-db-evolution.md` (R003 / Risk R01)
  - `Nghị định số 30/2020/NĐ-CP` về công tác văn thư và quản lý chỉ đạo điều hành văn bản
  - `Quyết định số 282/QĐ-CĐKTCNQN` của Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn về Quy chế tổ chức và hoạt động

---

## 1. Tóm Tắt Thực Thi (Executive Summary)

Hệ thống điều hành tác nghiệp số QCET E-Office hiện cùng lúc duy trì hai mô hình dữ liệu song song đại diện cho mối quan hệ giữa công việc/nhiệm vụ (`Task`) và các chủ thể thực hiện trong nhà trường:
1. **Model `TaskAssignee` (Mô hình Phân công Phẳng - Legacy)**: Lưu trữ phân công trực tiếp giữa công việc và người dùng cá nhân (`userId`), với phạm vi vai trò giới hạn trong 3 trạng thái tĩnh (`AssigneeRole`: `PRIMARY_OWNER`, `COLLABORATOR`, `SUPERVISOR`). Mô hình này không hỗ trợ phân công cho cấp đơn vị phòng/khoa/trung tâm, không ghi nhận chủ thể giao việc (`assignedById`), và không tích hợp sâu với cây thẩm quyền quan hệ ReBAC (Relationship-Based Access Control).
2. **Model `TaskActor` (Mô hình Quan hệ ReBAC Chuẩn Tắc - Canonical Target)**: Mô hình quan hệ động gồm 9 vai trò hành chính nghiệp vụ (`TaskActorRole`), hỗ trợ cả chủ thể cá nhân (`userId`) lẫn chủ thể tổ chức (`unitId` liên kết với `OrganizationalUnit`), cờ chuẩn hóa người chịu trách nhiệm chính duy nhất (`isPrimaryDRI`), dấu vết bổ nhiệm (`assignedById`, `appointedAt`), và ghi chú ủy nhiệm (`notes`).

Hiện tại, cả hai model này đang cùng tồn tại trong `prisma/schema.prisma` và được liên kết đồng thời vào model `Task` (`Task.assignees` và `Task.actors`). Thực trạng này dẫn đến các khiếm khuyết kiến trúc nghiêm trọng:
- **Nguy cơ sai lệch dữ liệu phân công (Assignment State Divergence - FACT F06)** giữa các luồng nghiệp vụ cũ và mới.
- **Phân mảnh logic kiểm soát thẩm quyền SoD (Separation of Duties - ADR-001)** khi các hàm bảo vệ chống tự phê duyệt (`checkAntiSelfApproval`, `isTaskMaker`) phải duyệt đồng thời cả hai mảng dữ liệu với các cấu trúc khác nhau.
- **Tăng chi phí truy vấn và độ phức tạp runtime**: Các dịch vụ tra cứu (`task-query-service.ts`) và dịch vụ DTO mapping (`task-dto.ts`) phải sử dụng các biểu thức điều kiện `OR` phức tạp hoặc fallback ad-hoc để đảm bảo tính tương thích ngược.

Tài liệu RFC-01 này cung cấp một bản phân tích kiểm toán toàn diện (comprehensive consumer audit) trên toàn hệ thống (Schema, API routes, Command/Query services, Attention Resolver, FSM State Machine, và UI components). Đồng thời, tài liệu đề xuất một lộ trình hợp nhất 7 bước theo phương pháp **Zero-Downtime Migration (Expand $\to$ Backfill $\to$ Parity Verify $\to$ Read Cutover $\to$ Write Cutover $\to$ Observe $\to$ Contract)** nhằm đưa `TaskActor` trở thành nguồn chân lý duy nhất (Single Source of Truth) trong Phase 4 và chuẩn bị cho việc khai tử hoàn toàn `TaskAssignee` trong Phase 9.

---

## 2. Bối Cảnh & Đặt Vấn Đề (Context & Problem Statement)

### 2.1 Hiện trạng song trùng mô hình (Dual Model Existence)

Theo quy chế hành chính của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QĐ 282/QĐ-CĐKTCNQN) và quy định văn thư chỉ đạo điều hành (Nghị định 30/2020/NĐ-CP), một nhiệm vụ hành chính không chỉ đơn thuần là việc gán cho một cá nhân thực thi, mà là một quy trình tương tác đa chủ thể có cấu trúc:
- **Người giao việc / Người phê duyệt (Assigner / Approver)**: Thường là Ban Giám hiệu hoặc Trưởng phòng ban chỉ đạo.
- **Đơn vị chủ trì (Lead Unit)**: Phòng hoặc Khoa chịu trách nhiệm toàn diện trước Nhà trường (ví dụ: Phòng Quản lý Đào tạo, Khoa Công nghệ thông tin).
- **Đơn vị phối hợp (Coordinating Unit)**: Các đơn vị cùng tham gia giải quyết nhiệm vụ.
- **Người chịu trách nhiệm chính (Directly Responsible Individual - DRI)**: Cá nhân trực tiếp triển khai và báo cáo kết quả.
- **Người phối hợp thực hiện (Collaborator)**: Giảng viên, chuyên viên cùng tham gia.
- **Người theo dõi / Người thẩm tra (Follower / Reviewer / Observer)**: Thanh tra nhân dân, tổ chức kiểm định, chuyên viên theo dõi tiến độ.

Trong cơ sở dữ liệu hiện hành:
- **`TaskAssignee`** được thiết kế ở giai đoạn ban đầu (Phase 0) với góc nhìn quản lý công việc cá nhân phẳng kiểu Todo-list.
- **`TaskActor`** được đưa vào nhằm phục vụ kiến trúc phân quyền ngữ cảnh ReBAC 10 bước (ADR-002) và phân cấp chỉ đạo 2 cấp (Trường $\to$ Đơn vị $\to$ Cá nhân).

```
                            ┌─────────────────────────────────────────┐
                            │               Model Task                │
                            ├─────────────────────────────────────────┤
                            │ - id: cuid                              │
                            │ - code: string                          │
                            │ - title: string                         │
                            │ - leadUnitId: cuid?                     │
                            └────┬───────────────────────────────┬────┘
                                 │ 1..n                          │ 1..n
                                 ▼                               ▼
                 ┌─────────────────────────────┐ ┌─────────────────────────────┐
                 │     TaskAssignee (Legacy)   │ │     TaskActor (ReBAC Target)│
                 ├─────────────────────────────┤ ├─────────────────────────────┤
                 │ - id: cuid                  │ │ - id: cuid                  │
                 │ - taskId: cuid              │ │ - taskId: cuid              │
                 │ - userId: string (Required) │ │ - userId: string? (Nullable)│
                 │ - roleInTask: AssigneeRole  │ │ - unitId: cuid? (Nullable)  │
                 │   (3 roles: PRIMARY_OWNER,  │ │ - role: TaskActorRole       │
                 │    COLLABORATOR, SUPERVISOR)│ │   (9 roles: ASSIGNER, DRI,  │
                 │ - assignedAt: DateTime      │ │    LEAD_UNIT, REVIEWER,...) │
                 │                             │ │ - isPrimaryDRI: boolean     │
                 │                             │ │ - assignedById: string?     │
                 │                             │ │ - appointedAt: DateTime     │
                 │                             │ │ - notes: text?              │
                 └─────────────────────────────┘ └─────────────────────────────┘
```

### 2.2 Các khiếm khuyết kiến trúc cốt lõi (Core Architectural Deficiencies - FACT F06 & R003)

1. **Thiếu vắng khả năng giao việc cho cấp Đơn vị (Missing Unit-Level Assignment)**:
   - Trong `TaskAssignee`, trường `userId` là bắt buộc (`NOT NULL`). Do đó, Ban Giám hiệu không thể giao nhiệm vụ trực tiếp cho một Khoa/Phòng (ví dụ: giao Khoa Điện - Điện tử xây dựng chuẩn đầu ra) mà không chỉ định danh tính của một cá nhân cụ thể.
   - Để khắc phục, hệ thống trước đây phải dùng trường `Task.departmentId` hoặc `Task.leadUnitId`, dẫn đến sự tách rời giữa chủ thể nhiệm vụ và cơ chế phân vai.
2. **Hạn chế nghiêm trọng về mô hình vai trò (Role Expressiveness Bottleneck)**:
   - `AssigneeRole` chỉ hỗ trợ 3 giá trị: `PRIMARY_OWNER`, `COLLABORATOR`, `SUPERVISOR`.
   - Không thể phân định được ai là người giao việc (`ASSIGNER`), ai là người ký duyệt (`APPROVER`), ai là chuyên viên thẩm định hồ sơ (`REVIEWER`), và ai chỉ là đơn vị giám sát (`OBSERVER`).
   - Vai trò `SUPERVISOR` trong thực tế bị nhập nhằng giữa người kiểm tra chất lượng (Reviewer) và lãnh đạo cấp cao phê duyệt (Approver).
3. **Mất dấu vết kiểm toán bổ nhiệm (Loss of Appointment Audit Trail)**:
   - `TaskAssignee` chỉ có trường `assignedAt DateTime`, hoàn toàn không có thông tin `assignedById` (ai đã gán người này vào nhiệm vụ).
   - Khi xảy ra khiếu nại hoặc tranh chấp trách nhiệm hành chính, hệ thống không thể truy vết ngược nếu chỉ dựa vào bảng `TaskAssignee`.
4. **Nguy cơ vi phạm Bất biến "Một người chủ trì duy nhất" (Single Primary DRI Invariant Violation)**:
   - Khóa duy nhất của `TaskAssignee` là `@@unique([taskId, userId, roleInTask])`. Điều này cho phép một task có thể có **nhiều bản ghi** cùng mang `roleInTask = PRIMARY_OWNER` với các `userId` khác nhau.
   - Trong khi đó, nguyên tắc quản lý hành chính đòi hỏi một nhiệm vụ tại một thời điểm chỉ có duy nhất **một** đầu mối chỉ đạo chịu trách nhiệm cao nhất (`isPrimaryDRI = true`).
5. **Gánh nặng duy trì logic song trùng (Dual-Write & Dual-Read Complexity)**:
   - Như đã kiểm toán tại `src/server/tasks/task-command-service.ts` và `src/lib/services/task-actor-service.ts`, mỗi thao tác phân công lại (`reassign`) hoặc tạo mới nhiệm vụ đều phải gọi đồng thời 2 câu lệnh `tx.taskActor.create` và `tx.taskAssignee.create`. Nếu một trong hai logic bị cập nhật thiếu sót trong các nhánh tính năng khác, dữ liệu sẽ lập tức bị phân kỳ.

---

## 3. Ma Trận Chênh Lệch Lược Đồ (Schema Delta Matrix)

### 3.1 So sánh chi tiết từng trường thuộc tính (Field-by-Field Matrix)

| Thuộc tính (Attribute) | `TaskAssignee` (Legacy) | `TaskActor` (ReBAC Target) | Đánh giá chênh lệch & Chiến lược tương thích |
|---|---|---|---|
| **Định danh (`id`)** | `String @id @default(cuid())` | `String @id @default(cuid())` | **Tương đồng 100%**. Cả hai đều sử dụng định danh CUID. |
| **Khóa ngoại Task (`taskId`)** | `String @map("task_id")` | `String @map("task_id")` | **Tương đồng 100%**. Quan hệ cascade delete khi Task bị xóa. |
| **Chủ thể người dùng (`userId`)** | `String @map("user_id")` (`NOT NULL`) | `String? @map("user_id")` (`NULLABLE`) | **Mở rộng phạm vi**. `TaskActor` cho phép `userId` null khi nhiệm vụ được giao trực tiếp cho một đơn vị tổ chức (`unitId`). Khi ánh xạ từ `TaskAssignee`, `userId` luôn được bảo toàn. |
| **Chủ thể đơn vị (`unitId`)** | Không hỗ trợ | `String? @map("unit_id")` | **Tính năng mới**. Cho phép gắn `OrganizationalUnit` vào vai trò `LEAD_UNIT` hoặc `COORDINATING_UNIT`. Khi backfill từ `TaskAssignee`, có thể derive `unitId` từ `User.positionAssignments` hoặc `Task.leadUnitId`. |
| **Vai trò (`role`)** | `AssigneeRole` (3 giá trị):<br>- `PRIMARY_OWNER`<br>- `COLLABORATOR`<br>- `SUPERVISOR` | `TaskActorRole` (9 giá trị):<br>- `ASSIGNER`<br>- `LEAD_UNIT`<br>- `COORDINATING_UNIT`<br>- `DRI`<br>- `COLLABORATOR`<br>- `FOLLOWER`<br>- `REVIEWER`<br>- `APPROVER`<br>- `OBSERVER` | **Nâng cấp ngữ nghĩa**. `PRIMARY_OWNER` chuyển thành `DRI`. `COLLABORATOR` giữ nguyên `COLLABORATOR`. `SUPERVISOR` được chuyển thành `REVIEWER` hoặc `OBSERVER` tùy ngữ cảnh phê duyệt nhiệm vụ. |
| **Cờ chủ trì chính (`isPrimaryDRI`)** | Suy diễn gián tiếp qua `roleInTask == PRIMARY_OWNER` | `Boolean @default(false) @map("is_primary_dri")` | **Ràng buộc tường minh**. Đảm bảo xác định chính xác và nhanh chóng ai là cá nhân chịu trách nhiệm cao nhất, phục vụ bộ lọc tìm kiếm và đánh giá KPI. |
| **Người giao việc (`assignedById`)** | Không hỗ trợ | `String? @map("assigned_by_id")` | **Tính năng mới**. Liên kết với `User` qua quan hệ `@relation("ActorAssignedBy")`. Lưu vết ai đã bổ nhiệm chủ thể vào vai trò này. Khi backfill, lấy giá trị từ `Task.createdById`. |
| **Thời điểm bổ nhiệm (`appointedAt`)** | `assignedAt DateTime @default(now())` | `appointedAt DateTime @default(now())` | **Tương đồng về mặt chức năng**. Đổi tên cột từ `assigned_at` sang `appointed_at` nhằm phản ánh đúng ngữ nghĩa hành chính (bổ nhiệm/phân công). |
| **Ghi chú phân công (`notes`)** | Không hỗ trợ | `String? @db.Text` | **Tính năng mới**. Cho phép lưu chỉ đạo kèm theo khi phân công nhiệm vụ (ví dụ: "Đồng chí Nam hỗ trợ phần tính toán khối lượng"). |
| **Ràng buộc tính duy nhất (Uniqueness)** | `@@unique([taskId, userId, roleInTask])` | `@@index([taskId, role])`<br>`@@index([userId])`<br>`@@index([unitId])` | `TaskAssignee` ngăn chặn trùng lặp bộ ba, nhưng cho phép nhiều `PRIMARY_OWNER`. `TaskActor` sử dụng chỉ mục linh hoạt và kiểm soát bất biến Single Primary DRI tại tầng Application Service / Transaction. |

### 3.2 So sánh các quan hệ ràng buộc (Relation Topology Comparison)

```prisma
// ============================================================================
// Model Cũ: TaskAssignee (prisma/schema.prisma:278-290)
// ============================================================================
model TaskAssignee {
  id         String       @id @default(cuid())
  taskId     String       @map("task_id")
  userId     String       @map("user_id")
  roleInTask AssigneeRole @default(PRIMARY_OWNER) @map("role_in_task")
  assignedAt DateTime     @default(now()) @map("assigned_at")
  task       Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId, roleInTask], name: "task_user_role_unique")
  @@index([userId, roleInTask])
  @@map("task_assignees")
}

// ============================================================================
// Model Mới: TaskActor (prisma/schema.prisma:1157-1176)
// ============================================================================
model TaskActor {
  id           String              @id @default(cuid())
  taskId       String              @map("task_id")
  task         Task                @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId       String?             @map("user_id")
  user         User?               @relation(fields: [userId], references: [id], onDelete: SetNull)
  unitId       String?             @map("unit_id")
  unit         OrganizationalUnit? @relation(fields: [unitId], references: [id], onDelete: SetNull)
  role         TaskActorRole
  isPrimaryDRI Boolean             @default(false) @map("is_primary_dri")
  assignedById String?             @map("assigned_by_id")
  assignedBy   User?               @relation("ActorAssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)
  appointedAt  DateTime            @default(now()) @map("appointed_at")
  notes        String?             @db.Text

  @@index([taskId, role])
  @@index([userId])
  @@index([unitId])
  @@map("task_actors")
}
```

### 3.3 Phân tích khoảng trống kiểu dữ liệu và ràng buộc bất biến (Invariants & Constraints)

1. **Ràng buộc bất biến Single Primary DRI (Invariable Primary DRI)**:
   - Mỗi nhi��m vụ `Task` chỉ được phép có tối đa một bản ghi `TaskActor` thỏa mãn điều kiện `role = DRI AND isPrimaryDRI = true`.
   - Khi một người mới được bổ nhiệm làm Primary DRI, toàn bộ các bản ghi `TaskActor` DRI trước đó của nhiệm vụ phải được chuyển trạng thái: `isPrimaryDRI = false` và chuyển role thành `COLLABORATOR` (đã được hiện thực hóa mẫu trong `src/lib/services/task-actor-service.ts:227-237`).
2. **Ràng buộc về tính toàn vẹn của Chủ thể (Actor Polymorphic Integrity)**:
   - Một bản ghi `TaskActor` phải có ít nhất một trong hai trường `userId` hoặc `unitId` khác `null`:
     $$\text{CHECK} \ ((\text{user\_id IS NOT NULL}) \ \text{OR} \ (\text{unit\_id IS NOT NULL}))$$
   - Khi `role = LEAD_UNIT` hoặc `role = COORDINATING_UNIT`, trường `unitId` bắt buộc phải có giá trị.
   - Khi `role = DRI`, trường `userId` bắt buộc phải có giá trị (bảo đảm tính cá thể hóa trách nhiệm cá nhân).
3. **Ràng buộc chống xung đột vai trò nội tại (Role Mutex Guard)**:
   - Một cá nhân (`userId`) trong một nhiệm vụ không thể vừa đóng vai trò `DRI` lại vừa có một bản ghi riêng biệt là `COLLABORATOR`. Nếu cá nhân đó là DRI, họ mặc nhiên là người thực thi chính.

---

## 4. Kiểm Toán Toàn Diện Các Thành Phần Tiêu Thụ (Comprehensive Consumer Audit)

Để chuẩn bị cho lộ trình chuyển đổi không gián đoạn, nhóm kiến trúc đã tiến hành quét toàn diện mã nguồn nhằm lập danh mục tất cả các điểm tiêu thụ (consumers) đang đọc hoặc ghi vào `TaskAssignee` và `TaskActor`.

### 4.1 Lớp Cơ sở dữ liệu & Prisma Schema Topology

| Thành phần | Vị trí file:dòng | Loại quan hệ | Đánh giá hiện trạng |
|---|---|---|---|
| `Task.assignees` | `prisma/schema.prisma:237` | `TaskAssignee[]` | Quan hệ 1-N truyền thống. Cần chuyển sang trạng thái deprecated và xóa bỏ trong Phase 9. |
| `Task.actors` | `prisma/schema.prisma:253` | `TaskActor[]` | Quan hệ 1-N chuẩn tắc mới. Là đích đến duy nhất của toàn bộ truy vấn. |
| `User.taskAssignees` | `prisma/schema.prisma:130` | `TaskAssignee[]` | Danh sách các nhiệm vụ người dùng được phân công qua bảng cũ. |
| `User.taskActors` | `prisma/schema.prisma:144` | `TaskActor[]` | Danh sách các vai trò nhiệm vụ mà người dùng nắm giữ. |
| `User.assignedActors` | `prisma/schema.prisma:145` | `TaskActor[]` | Danh sách các phân công do người dùng này bổ nhiệm cho người khác (`assignedById`). |
| `OrganizationalUnit.taskActors` | `prisma/schema.prisma:930` | `TaskActor[]` | Danh sách các nhiệm vụ được giao cho đơn vị này chủ trì hoặc phối hợp. |

### 4.2 Lớp Xử lý Lệnh & Biến đổi Dữ liệu (Mutation & Command Services)

1. **`src/server/tasks/task-command-service.ts`**:
   - `createFromMeetingResolution` (dòng 310–336): Tạo task từ kết luận cuộc họp. Hiện đang thực hiện dual-write: vừa chèn `assignees: { create: [{ userId, roleInTask: PRIMARY_OWNER }] }` vừa tạo `tx.taskActor.create({ data: { role: TaskActorRole.DRI, isPrimaryDRI: true } })`.
   - `createTask` (dòng 615–638): Khi tạo task qua API chính, sau khi tạo task kèm assignees, service thực hiện tra cứu `OrganizationalUnit` rồi tạo `TaskActor` với `role: TaskActorRole.DRI`.
   - `updateTask` (dòng 984–1022): Khi cập nhật `assigneeId`, service xóa `TaskActor` role DRI cũ và tạo mới, đồng thời xóa `TaskAssignee` role `PRIMARY_OWNER` cũ và tạo mới.
2. **`src/lib/services/task-actor-service.ts`**:
   - `setTaskDRI` (dòng 239–262): Bổ nhiệm DRI mới. Đã thực hiện đồng bộ ngược sang `tx.taskAssignee` bằng cách xóa `PRIMARY_OWNER` cũ và upsert bản ghi mới.
   - `addTaskCollaborator` (dòng 320–335): Thêm người phối hợp. Upsert vào `tx.taskActor` và đồng thời upsert vào `tx.taskAssignee` với `roleInTask: AssigneeRole.COLLABORATOR`.
   - `addTaskObserver` (dòng 344–375): Thêm người quan sát vào `TaskActor` (`role: TaskActorRole.OBSERVER`). **Lưu ý**: Phương thức này hoàn toàn không ghi vào `TaskAssignee` vì `TaskAssignee` không có vai trò quan sát viên phù hợp.
3. **`src/lib/services/task-domain-actions.ts`**:
   - `loadTaskAndBuildResource` (dòng 209–241): Tải thông tin task để xây dựng tài nguyên phục vụ kiểm tra phân quyền (Authorization Resource). Hiện đang phải đọc đồng thời cả `task.actors` và `task.assignees`, sau đó dùng `Set` gộp danh sách ID (`primaryOwnerId`, `collaboratorIds`, `assigneeIds`).
   - `reassign` (dòng 1481–1522): Gọi `setTaskDRI` trong transaction.
4. **`src/lib/db/transactions.ts`**:
   - `createTaskAtomic` (dòng 137–195): Định nghĩa giao diện `TaskAssigneeInput` và tạo task nguyên tử kèm lồng ghép `assignees: { createMany: ... }`. Chưa có hỗ trợ khởi tạo `TaskActor` trực tiếp trong transaction helper này.
5. **`src/lib/services/incoming-document-service.ts`**:
   - `createTaskFromDirective` (dòng 756–770): Phân công nhiệm vụ từ văn bản đến. Đã sử dụng `TaskActorRole.ASSIGNER`, `TaskActorRole.DRI`, `TaskActorRole.COLLABORATOR`.

### 4.3 Lớp Truy vấn & Chỉ mục Tìm kiếm (Query Services & Search Indexing)

1. **`src/server/tasks/task-query-service.ts`**:
   - Bộ lọc `view=assigned` (dòng 410–420): Đang phải dùng điều kiện `OR` kép để lọc task theo người thực hiện:
     ```typescript
     OR: [
       { actors: { some: { userId: userFilter } } },
       { assignees: { some: { userId: userFilter } } },
     ]
     ```
     Điều kiện này làm giảm hiệu năng truy vấn của database do không tận dụng tối ưu được index riêng biệt.
   - `computeTaskViewerContext` (dòng 529–595): Kiểm tra quan hệ của người xem đối với task. Đang kiểm tra `task.actors` trước, nếu không thấy mới fallback sang `task.assignees`.
2. **`src/server/services/action-inbox-service.ts`**:
   - Dòng 64–80: Truy vấn các việc cần xử lý trong Action Inbox. Đã chuyển đổi thành công sang truy vấn hoàn toàn trên `actors: { some: { userId, role: TaskActorRole.DRI } }` và `role IN [REVIEWER, APPROVER]`.
3. **`src/server/dto/task-dto.ts`**:
   - `extractAssignees` (dòng 216–239): Kiểm tra mảng `raw.actors` trước. Nếu có phần tử thì trích xuất danh sách người dùng từ actors. Chỉ khi `raw.actors` trống mới fallback đọc từ `raw.assignees`.
   - `extractLeadAssignee` (dòng 242–286): Tìm người chủ trì bằng cách duyệt `raw.actors` với điều kiện `role === 'DRI' || isPrimaryDRI`. Nếu không có mới duyệt qua `raw.leadAssignee`, `raw.primaryOwner`, và mảng `raw.assignees`.
   - `extractDerivedCollaborators` (dòng 301–330): Tự động tổng hợp danh sách phối hợp của task cha từ các DRI của task con active.
4. **`src/app/api/search/route.ts`**:
   - Dòng 145 & 289: Tìm kiếm toàn văn công việc. Vẫn đang tìm kiếm bằng điều kiện `{ assignees: { some: { userId: authUser.id } } }`. Đây là một lỗ hổng cần được cập nhật sang `actors`.

### 4.4 Lớp Domain Logic, State Machine & Bộ Giải Quyết Chú Ý (Attention Resolver & SoD)

1. **`src/domain/tasks/contract.ts`**:
   - `SoDEvaluationContext` (dòng 70–87): Định nghĩa ngữ cảnh kiểm tra Separation of Duties. Chứa các trường `assigneeIds`, `assignees`, `collaborators`, `coAssignees`.
   - `checkAntiSelfApproval` (dòng 107–155): Đảm bảo nguyên tắc Maker-Checker (ADR-001). Cán bộ đã tạo việc hoặc được phân công làm DRI/Collaborator tuyệt đối không được tự duyệt nhiệm vụ. Hiện hàm này vẫn nhận dữ liệu dạng mảng `assignees[]` với thuộc tính `roleInTask`.
2. **`src/domain/tasks/attention-resolver.ts`**:
   - `isTaskAssignee` (dòng 277–327): Kiểm tra xem người dùng có phải là người thực thi không. Hàm duyệt qua hơn 10 trường fallback (`assigneeId`, `leadAssigneeId`, `primaryOwnerId`, `assignees`, `collaborators`...) nhưng chưa chuẩn hóa kiểm tra trực tiếp qua `actors`.
3. **`src/domain/tasks/state-machine.ts`**:
   - `TaskAssigneeInfo` & `TaskContext` (dòng 55–77): FSM context nhận mảng `assignees?: TaskAssigneeInfo[]` với thuộc tính `roleInTask?: string`. Cần bổ sung và chuyển dịch sang hỗ trợ `actors?: Array<{ userId?: string; role: TaskActorRole; isPrimaryDRI?: boolean }>`.
4. **`src/domain/tasks/types.ts` & `src/domain/tasks/mappers.ts`**:
   - `TaskAssigneeDomain` (dòng 40–45): Vẫn giữ kiểu `DomainAssigneeRole = 'PRIMARY_OWNER' | 'COLLABORATOR'`.
   - `toTaskAssigneeDomain` (dòng 35–54): Nhận `raw` object và map thuộc tính `roleInTask`.

### 4.5 Lớp REST API Route Handlers

1. **`src/app/api/tasks/route.ts`**:
   - GET: Tiếp nhận query parameter `assignedTo` hoặc `assigneeId`, chuyển vào `taskQueryService`.
   - POST: Tiếp nhận payload chứa `assigneeId` (ID của Primary DRI) và `collaboratorIds`, ủy quyền cho `taskCommandService.createTask`.
2. **`src/app/api/tasks/[id]/actions/reassign/route.ts`**:
   - POST: Nhận `newAssigneeId` và `newAssigneeName`, gọi `taskDomainActionService.reassign`. Bên dưới gọi `setTaskDRI`.
3. **`src/app/api/documents/download/route.ts`**:
   - Dòng 118: Include `assignees` khi xác thực quyền tải tệp đính kèm liên quan đến công việc.

### 4.6 Lớp Giao diện Người dùng (UI Components)

Mặc dù giao diện người dùng sử dụng thuật ngữ hiển thị là "Người chủ trì" (Lead / DRI) và "Người phối hợp" (Collaborators), mã nguồn component có sự đan xen giữa hai mô hình:
- **`TaskAssigneePicker`** (`src/components/tasks/detail/task-property-controls.tsx:70`): Component lựa chọn người chủ trì sử dụng `@base-ui Combobox`. Tên component mang tiền tố `TaskAssignee`, nhận prop `assigneeId` và `assigneeName`.
- **`TaskPropertiesSidebar`** (`src/components/tasks/detail/task-properties-sidebar.tsx:421`): Hiển thị hàng chọn Lead / DRI, truyền dữ liệu từ `leadAssigneeName` hoặc `assigneeName`.
- **`SubtaskDetailDrawer`** (`src/components/tasks/detail/subtask-detail-drawer.tsx:342`): Gọi hàm `updateTaskAssignee` từ `@/lib/tasks/task-actions`.
- **`TaskContextMenu`** (`src/components/tasks/table/task-context-menu.tsx:166`): Menu chuột phải hỗ trợ gán nhanh người thực hiện qua submenu "assignee".
- **`ModularCascadingTaskTable`** (`src/components/tasks/table/modular-cascading-task-table.tsx:585`): Đã xây dựng `TaskActorContract` cho người dùng hiện tại để truyền vào các policy guard.
- **`MobileTaskCard` & `TaskKanbanBoard`**: Hiển thị avatar và tên của người chịu trách nhiệm chính thông qua các trường chuẩn hóa DTO `leadAssigneeName` / `assigneeName`.

---

## 5. Chiến Lược Hợp Nhất & Di Trú Không Gián Đoạn (Migration & Reconciliation Strategy)

Tuân thủ nghiêm ngặt nguyên tắc **Zero-Downtime Migration** và phương pháp luận **Expand and Contract**, quy trình chuyển đổi từ `TaskAssignee` sang `TaskActor` được phân chia thành 7 giai đoạn liên tục có kiểm soát.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LỘ TRÌNH 7 GIAI ĐOẠN                             │
│                                                                             │
│  [Phase 1: Expand]        Hoàn thiện Dual-Write 100% các mutation           │
│         │                                                                   │
│         ▼                                                                   │
│  [Phase 2: Backfill]      Chuyển đổi dữ liệu lịch sử (Role Mapping)         │
│         │                                                                   │
│         ▼                                                                   │
│  [Phase 3: Parity Verify] Đối soát tính tương đồng tuyệt đối (100% Match)   │
│         │                                                                   │
│         ▼                                                                   │
│  [Phase 4: Read Cutover]  Chuyển toàn bộ truy vấn & domain guard sang Actor │
│         │                                                                   │
│         ▼                                                                   │
│  [Phase 5: Write Cutover] Ngừng ghi vào TaskAssignee (No-op / Deprecated)   │
│         │                                                                   │
│         ▼                                                                   │
│  [Phase 6: Observe]       Giám sát hệ thống trong 14-30 ngày                │
│         │                                                                   │
│         ▼                                                                   │
│  [Phase 7: Contract]      Xóa bỏ bảng task_assignees (Phase 9 Cleanup)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Giai đoạn 1: Mở rộng (Expand Phase - Complete Dual-Write)

Mục tiêu: Đảm bảo rằng **mọi thao tác ghi mới** vào hệ thống đều được lưu trữ đầy đủ và chính xác vào bảng canonical `TaskActor`, đồng thời duy trì bản sao tương thích trong `TaskAssignee`.

1. **Hiện trạng Dual-write**:
   - `taskCommandService.createTask` $\to$ Đã ghi cả hai.
   - `taskCommandService.updateTask` $\to$ Đã ghi cả hai.
   - `taskActorService.setTaskDRI` $\to$ Đã ghi cả hai.
   - `taskActorService.addTaskCollaborator` $\to$ Đã ghi cả hai.
2. **Các điểm thiếu sót cần bổ sung trong Expand Phase**:
   - **`createTaskAtomic` trong `src/lib/db/transactions.ts`**: Hiện tại helper này chỉ insert `TaskAssignee`. Cần bổ sung logic tự động tạo bản ghi `TaskActor` tương ứng với `role: TaskActorRole.DRI` (cho Primary Owner) và `role: TaskActorRole.COLLABORATOR` trong cùng transaction.
   - **Xóa nhiệm vụ (Task Deletion)**: Đảm bảo cả hai bảng đều có `onDelete: Cascade` từ `Task` (đã có trong Prisma schema).

### 5.2 Giai đoạn 2: Bơm chuyển Dữ liệu Lịch sử (Backfill Phase & Role Mapping Matrix)

Mục tiêu: Đồng bộ hóa toàn bộ các bản ghi `TaskAssignee` hiện có trong database sang `TaskActor` mà chưa từng được chuyển đổi.

#### 5.2.1 Ma trận ánh xạ vai trò (Role Mapping Matrix)

| Giá trị nguồn trong `AssigneeRole` | Giá trị đích trong `TaskActorRole` | Giá trị `isPrimaryDRI` | Quy tắc xác định ngữ cảnh bổ sung |
|---|---|---|---|
| `PRIMARY_OWNER` | `DRI` | `true` | Nếu trong cùng một task có nhiều bản ghi `PRIMARY_OWNER` do dữ liệu cũ bị lỗi, bản ghi có `assignedAt` mới nhất sẽ được chọn làm `isPrimaryDRI = true`. Các bản ghi còn lại chuyển thành `role: COLLABORATOR, isPrimaryDRI: false`. |
| `COLLABORATOR` | `COLLABORATOR` | `false` | Giữ nguyên danh tính cá nhân `userId`. |
| `SUPERVISOR` | `REVIEWER` (Mặc định)<br>hoặc `OBSERVER` | `false` | - Nếu nhiệm vụ có `approvalProcesses` hoặc thuộc luồng yêu cầu phê duyệt sản phẩm bàn giao (`TaskDeliverable`), map thành `REVIEWER`.<br>- Nếu chỉ được gán để nắm thông tin tiến độ, map thành `OBSERVER`. |

#### 5.2.2 Quy tắc phục hồi ngữ cảnh giao việc (Context Recovery Rules)
- **`assignedById`**: Lấy từ trường `Task.createdById` của nhiệm vụ tương ứng. Nếu `createdById` không tồn tại hoặc người dùng đã bị xóa, gán giá trị của Quản trị viên hệ thống hoặc để `null`.
- **`appointedAt`**: Kế thừa chính xác từ `TaskAssignee.assignedAt`. Nếu `assignedAt` bị null, dùng `Task.createdAt`.
- **`unitId`**: Tra cứu đơn vị công tác hiện tại của người dùng từ bảng `PositionAssignment` (hoặc `User.departmentId` được ánh xạ qua `OrganizationalUnit`) tại thời điểm tạo nhiệm vụ.

#### 5.2.3 Bản thảo Script Di trú Dữ liệu (Idempotent Backfill Script Specification)

Script chạy dưới dạng một Database Migration hoặc một CLI script độc lập (`scripts/backfill-task-actors.ts`), bảo đảm tính lũy kế (idempotent):

```typescript
/**
 * Thuật toán Backfill Idempotent từ TaskAssignee sang TaskActor
 */
async function backfillTaskAssigneesToActors(prisma: PrismaClient) {
  const BATCH_SIZE = 500;
  let cursor: string | undefined = undefined;

  console.log("Bắt đầu tiến trình Backfill TaskAssignee -> TaskActor...");

  while (true) {
    const assignees = await prisma.taskAssignee.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
      include: {
        task: {
          select: {
            id: true,
            createdById: true,
            createdAt: true,
            leadUnitId: true,
          },
        },
      },
    });

    if (assignees.length === 0) break;

    for (const assignee of assignees) {
      if (!assignee.task) continue;

      // 1. Xác định Role đích
      let targetRole: TaskActorRole;
      let isPrimary = false;

      if (assignee.roleInTask === AssigneeRole.PRIMARY_OWNER) {
        targetRole = TaskActorRole.DRI;
        isPrimary = true;
      } else if (assignee.roleInTask === AssigneeRole.COLLABORATOR) {
        targetRole = TaskActorRole.COLLABORATOR;
      } else {
        targetRole = TaskActorRole.REVIEWER;
      }

      // 2. Kiểm tra xem TaskActor đã tồn tại chưa (Idempotency check)
      const existingActor = await prisma.taskActor.findFirst({
        where: {
          taskId: assignee.taskId,
          userId: assignee.userId,
          role: targetRole,
        },
      });

      if (!existingActor) {
        await prisma.taskActor.create({
          data: {
            taskId: assignee.taskId,
            userId: assignee.userId,
            unitId: assignee.task.leadUnitId ?? null,
            role: targetRole,
            isPrimaryDRI: isPrimary,
            assignedById: assignee.task.createdById ?? null,
            appointedAt: assignee.assignedAt ?? assignee.task.createdAt,
            notes: "Migrated from legacy TaskAssignee",
          },
        });
      }
    }

    cursor = assignees[assignees.length - 1].id;
    console.log(`Đã xử lý đến con trỏ ID: ${cursor}`);
  }

  // 3. Post-backfill Invariant Repair: Đảm bảo mỗi task chỉ có duy nhất 1 isPrimaryDRI = true
  await repairPrimaryDRIInvariants(prisma);
  console.log("Hoàn thành tiến trình Backfill.");
}
```

### 5.3 Giai đoạn 3: Kiểm Chứng Tính Tương Đồng Tuyệt Đối (Parity Verification Phase)

Trước khi chuyển hướng luồng đọc, hệ thống cần thực hiện kiểm chứng tự động nhằm cam kết 100% bản ghi nhiệm vụ có sự đồng nhất tuyệt đối giữa hai bảng:

1. **Tiêu chuẩn tương đồng (Parity Metrics)**:
   - **Metric 1 (Assignee Coverage)**: $100\%$ các bản ghi trong `task_assignees` đều có bản ghi `task_actors` tương ứng với cùng `taskId`, `userId`, và role tương đương.
   - **Metric 2 (Primary DRI Parity)**: Mỗi nhiệm vụ có `TaskAssignee` role `PRIMARY_OWNER` đều phải có chính xác một `TaskActor` với `role = DRI AND isPrimaryDRI = true`.
   - **Metric 3 (Count Match)**: Tổng số người thực thi duy nhất của mỗi nhiệm vụ trên hai bảng phải hoàn toàn trùng khớp.
2. **Kịch bản kiểm thử tự động (Verification Query)**:
   ```sql
   -- Truy vấn tìm kiếm các task bị lệch người thực thi giữa 2 bảng
   SELECT
     t.id AS task_id,
     t.code AS task_code,
     COUNT(DISTINCT ta.user_id) AS legacy_assignee_count,
     COUNT(DISTINCT tact.user_id) FILTER (WHERE tact.role IN ('DRI', 'COLLABORATOR')) AS canonical_actor_count
   FROM tasks t
   LEFT JOIN task_assignees ta ON ta.task_id = t.id
   LEFT JOIN task_actors tact ON tact.task_id = t.id
   GROUP BY t.id, t.code
   HAVING COUNT(DISTINCT ta.user_id) != COUNT(DISTINCT tact.user_id) FILTER (WHERE tact.role IN ('DRI', 'COLLABORATOR'));
   ```
   Bất kỳ dòng kết quả nào trả về từ truy vấn trên đều kích hoạt cờ cảnh báo lỗi và chặn quá trình chuyển đổi sang Giai đoạn 4.

### 5.4 Giai đoạn 4: Chuyển Đổi Luồng Đọc (Read Cutover Phase)

Sau khi tính tương đồng đạt 100%, toàn bộ các thành phần đọc dữ liệu được cấu hình lại để truy vấn trực tiếp vào `TaskActor`:

1. **`src/server/tasks/task-query-service.ts`**:
   - Loại bỏ điều kiện `OR` kép trong `view=assigned`. Chuyển thành truy vấn duy nhất:
     ```typescript
     actors: {
       some: {
         userId: userFilter,
         role: { in: [TaskActorRole.DRI, TaskActorRole.COLLABORATOR] },
       },
     }
     ```
   - Nâng cấp `computeTaskViewerContext` để đọc hoàn toàn từ `task.actors`.
2. **`src/server/dto/task-dto.ts`**:
   - Tinh gọn `extractAssignees` và `extractLeadAssignee`: Xóa bỏ toàn bộ các khối mã fallback đọc từ `raw.assignees`, chỉ đọc từ `raw.actors`.
3. **`src/domain/tasks/attention-resolver.ts` & `contract.ts`**:
   - Cập nhật `isTaskAssignee` và `checkAntiSelfApproval`: Nhận danh sách actors chuẩn tắc `TaskActorContract[]` thay vì nhận các mảng chuỗi hoặc đối tượng gán phẳng `assignees[]`.
4. **`src/app/api/search/route.ts` & `src/app/api/documents/download/route.ts`**:
   - Chuyển mệnh đề `include: { assignees: true }` sang `include: { actors: true }`.

### 5.5 Giai đoạn 5: Chuyển Đổi Luồng Ghi (Write Cutover Phase)

Mục tiêu: Ngừng hoàn toàn việc ghi dữ liệu vào bảng cũ `TaskAssignee`.

1. **Cập nhật Command Services**:
   - Xóa bỏ các lệnh `tx.taskAssignee.deleteMany` và `tx.taskAssignee.create` / `upsert` trong:
     - `src/server/tasks/task-command-service.ts`
     - `src/lib/services/task-actor-service.ts`
     - `src/lib/services/task-domain-actions.ts`
     - `src/lib/db/transactions.ts`
2. **Tắt quan hệ lồng ghép trong `createTaskAtomic`**:
   - Loại bỏ thuộc tính `assignees` khỏi `CreateTaskAtomicPayload`, thay thế bằng cấu trúc `actors?: TaskActorInput[]`.
3. **Đặt bảng `task_assignees` ở chế độ Read-only / Frozen**:
   - Bảng cũ được giữ lại trong cơ sở dữ liệu làm dữ liệu lưu trữ (archive/standby), không nhận thêm bất kỳ mutation nào.

### 5.6 Giai đoạn 6: Quan Sát & Ổn Định (Observe Phase)

1. Duy trì hệ thống hoạt động với `TaskActor` là nguồn chân lý duy nhất trong khoảng thời gian từ **14 đến 30 ngày**.
2. Thiết lập cơ chế ghi nhật ký (logging) và giám sát lỗi:
   - Theo dõi các ngoại lệ liên quan đến `TaskActorAuthorizationError`.
   - Giám sát các lỗi giao dịch không tìm thấy người chủ trì trong các luồng FSM State Machine.
   - Thu thập phản hồi từ người dùng thực tế trên các giao diện: Bàn làm việc, Lịch công tác, Danh sách công việc dạng tầng (Cascading Task Table).

### 5.7 Giai đoạn 7: Thu Hẹp & Loại Bỏ Hoàn Toàn (Contract Phase - Phase 9 Deprecation)

Khi hệ thống đã hoàn toàn ổn định và được sự phê duyệt chính thức từ Architecture Review Gate trong Phase 9:

1. **Tạo Prisma Migration loại bỏ lược đồ**:
   ```prisma
   // Xóa bỏ model TaskAssignee
   // Xóa bỏ enum AssigneeRole
   // Xóa quan hệ assignees khỏi model Task và model User
   ```
2. **Thực thi câu lệnh DDL an toàn**:
   ```sql
   DROP TABLE IF EXISTS "task_assignees" CASCADE;
   DROP TYPE IF EXISTS "AssigneeRole";
   ```
3. **Dọn dẹp mã nguồn (Dead Code Elimination)**:
   - Xóa bỏ các type interfaces: `TaskAssigneeDomain`, `TaskAssigneeDTO`, `TaskAssigneeInfo`.
   - Đổi tên các component UI mang tính lịch sử (ví dụ: `TaskAssigneePicker` $\to$ `TaskLeadPicker` hoặc `TaskActorPicker`) theo đúng quy chuẩn đặt tên [Component & Identifier Naming (.claude/rules/naming.md)](.claude/rules/naming.md).

---

## 6. Ma Trận Đánh Giá R���i Ro & Chiến Lược Hoàn Nguyên (Risk Analysis & Rollback Strategy)

### 6.1 Ma Trận Đánh Giá Rủi Ro Kiến Trúc & Nghiệp Vụ

| Mã rủi ro | Mô tả rủi ro chi tiết | Khả năng (L) | Mức độ (I) | Mức rủi ro | Biện pháp giảm thiểu & Kiểm soát chủ động |
|---|---|---|---|---|---|
| **R-01** | **Vi phạm Bất biến Single Primary DRI**<br>Quá trình backfill tạo ra nhiều hơn 1 bản ghi `isPrimaryDRI = true` cho cùng một task do dữ liệu cũ có nhiều `PRIMARY_OWNER`. | Trung bình (M) | Nghiêm trọng (H) | **CAO** | Áp dụng thuật ngữ sắp xếp thời gian `assignedAt DESC`, chỉ chọn duy nhất 1 bản ghi mới nhất làm DRI, các bản ghi cũ tự động ép kiểu thành `COLLABORATOR`. Chạy script kiểm tra vi phạm trước khi chuyển luồng đọc. |
| **R-02** | **Lỗ hổng phân quyền Anti-Self-Approval (ADR-001)**<br>Khi đổi sang `TaskActor`, nếu một Maker không được map đúng vai trò `DRI` hoặc `COLLABORATOR`, họ có thể tự phê duyệt nhiệm vụ của chính mình. | Thấp (L) | Thảm họa (C) | **CAO** | Giữ nguyên logic SoD guard tại `contract.ts` kiểm tra toàn bộ các vai trò người thực thi (`DRI`, `COLLABORATOR`, `COORDINATING_UNIT`). Chạy 100% test suite SoD hiện có (`npm test`). |
| **R-03** | **Suy giảm hiệu năng truy vấn danh sách công việc**<br>Bảng `task_actors` có cấu trúc rộng hơn và chứa quan hệ đa hình (`userId`, `unitId`), dẫn đến truy vấn JOIN chậm hơn bảng phẳng cũ. | Trung bình (M) | Trung bình (M) | **TRUNG BÌNH** | Thiết lập đầy đủ các chỉ mục phức hợp: `@@index([taskId, role])`, `@@index([userId, role])`, `@@index([unitId, role])`. Áp dụng kỹ thuật projection chỉ `select` các trường cần thiết trong `taskQueryService`. |
| **R-04** | **Phân kỳ dữ liệu trong giai đoạn Dual-Write (Data Divergence)**<br>Một API endpoint ngách chưa được cập nhật dual-write dẫn đến việc chỉ ghi vào bảng cũ mà không ghi vào bảng mới. | Trung bình (M) | Nghiêm trọng (H) | **CAO** | Đã tiến hành kiểm toán toàn diện ở Mục 4. Đặt cờ cảnh báo lỗi và chạy cronjob đối soát (Parity Reconciler) mỗi đêm để tự động bù đắp dữ liệu thiếu hụt. |
| **R-05** | **Giao diện người dùng bị trống tên Người chủ trì**<br>UI components đọc nhầm trường khi DTO chuyển đổi giữa `leadAssigneeName` và `driName`. | Thấp (L) | Trung bình (M) | **TRUNG BÌNH** | DTO serialization trong `task-dto.ts` tiếp tục xuất cả 2 trường `leadAssigneeName` và `assigneeName` trong suốt giai đoạn chuyển tiếp, bảo đảm UI không bị gãy vỡ (zero visual regression). |

### 6.2 Chiến Lược Hoàn Nguyên Từng Giai Đoạn (Phase-by-Phase Rollback Strategy)

Nhờ áp dụng chiến lược mở rộng và thu hẹp (Expand-Contract), hệ thống có khả năng hoàn nguyên an toàn tại từng thời điểm mà không làm gián đoạn người dùng:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CHIẾN LƯỢC HOÀN NGUYÊN (ROLLBACK)                     │
├──────────────────────────────┬──────────────────────────────────────────────┤
│ Điểm xảy ra sự cố            │ Hành động hoàn nguyên (Remediation Action)   │
├──────────────────────────────┼───────────────────────────────────────────���──┤
│ Trong Phase 1 & 2            │ - Tắt tiến trình backfill.                   │
│ (Expand / Backfill)          │ - Dữ liệu bảng cũ TaskAssignee hoàn toàn     │
│                              │   nguyên vẹn, ứng dụng tiếp tục hoạt động.   │
├──────────────────────────────┼──────────────────────────────────────────────┤
│ Trong Phase 4                │ - Đổi cấu hình cờ tính năng (Feature Flag)   │
│ (Read Cutover)               │   TASK_ACTOR_READ_ENABLED = false.           │
│                              │ - Ứng dụng ngay lập tức quay lại đọc từ      │
│                              │   TaskAssignee vì bảng cũ vẫn được duy trì   │
│                              │   dual-write liên tục.                       │
├──────────────────────────────┼──────────────────────────────────────────────┤
│ Trong Phase 5 & 6            │ - Chạy script đồng bộ ngược khẩn cấp         │
│ (Write Cutover / Observe)    │   (Reverse Sync): Bơm dữ liệu mới phát sinh  │
│                              │   từ TaskActor về TaskAssignee.              │
│                              │ - Kích hoạt lại dual-write.                  │
├──────────────────────────────┼──────────────────────────────────────────────┤
│ Trong Phase 7                │ - Khôi phục bảng từ bản sao lưu Database     │
│ (Contract - Drop Table)      │   Snapshot được tạo ngay trước khi chạy lệnh │
│                              │   DROP TABLE.                                │
└──────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 7. Kế Hoạch Kiểm Thử & Tiêu Chí Nghiệm Thu (Verification Plan & Acceptance Criteria)

### 7.1 Kế hoạch Kiểm thử Tự động (Automated Verification)

Tuân thủ nghiêm ngặt quy tắc [Verification & Testing Rules (.claude/rules/verification.md)](.claude/rules/verification.md), tuyệt đối **không** chạy `next build` / `npm run build` trong môi trường dev server. Các bước kiểm thử bao gồm:

1. **Kiểm tra Type-safety**:
   ```bash
   npm run typecheck
   ```
   Đảm bảo không phát sinh bất kỳ lỗi TypeScript nào trong các file DTO, Query service, và Domain contracts.
2. **Kiểm tra Linter & Code Standards**:
   ```bash
   npm run lint
   ```
3. **Kiểm tra Test Suite hiện có**:
   ```bash
   npm test
   ```
   Đặc biệt xác nhận toàn bộ các bài test liên quan đến phân quyền SoD (`checkAntiSelfApproval`) và State Machine đều vượt qua (100% pass).
4. **Kiểm tra Đối soát Dữ liệu (Parity Check Script)**:
   - Chạy script kiểm tra đối soát trên môi trường Staging/UAT với dữ liệu thực tế, khẳng định tỷ lệ tương đồng $100\%$ không có ngoại lệ.

### 7.2 Tiêu chí Nghiệm thu (Acceptance Criteria)

Tài liệu RFC-01 này được coi là hoàn thành và đủ điều kiện để thông qua tại Architecture Review Gate khi thỏa mãn các tiêu chí:
- [x] Phân tích làm rõ bản chất song trùng mô hình giữa `TaskAssignee` và `TaskActor`.
- [x] Xây dựng đầy đủ Ma trận Chênh lệch Lược đồ (Schema Delta Matrix) cho từng trường dữ liệu và ràng buộc.
- [x] Hoàn thành kiểm toán 100% các thành phần tiêu thụ trong mã nguồn (Prisma, Command, Query, Domain, API, UI).
- [x] Thiết lập lộ trình chuyển đổi 7 bước chi tiết (Zero-Downtime Migration) từ Expand đến Contract (Phase 9).
- [x] Định nghĩa ma trận ánh xạ vai trò rõ ràng, giải quyết triệt để vấn đề Single Primary DRI và vai trò Supervisor.
- [x] Thiết lập ma trận đánh giá rủi ro và các kịch bản rollback khả thi cho từng giai đoạn.
- [x] Không can thiệp sửa đổi mã nguồn hoặc tạo file migration cơ sở dữ liệu trong phạm vi RFC này (Strictly audit & analysis only).

---

## 8. Kết Luận & Khuyến Nghị (Conclusion & Actionable Recommendations)

Việc duy trì song song hai mô hình `TaskAssignee` và `TaskActor` là một khoản nợ kỹ thuật lịch sử (Technical Debt) cần phải được giải quyết dứt điểm. Mô hình `TaskActor` không chỉ giải quyết trọn vẹn bài toán phân quyền ReBAC đa tầng theo chuẩn ADR-002, mà còn phản ánh chính xác cấu trúc vận hành hành chính công của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn theo Quyết định số 282/QĐ-CĐKTCNQN và Nghị định số 30/2020/NĐ-CP.

**Khuyến nghị thực thi ngay sau khi RFC-01 được thông qua**:
1. **Khởi tạo Work Item tiếp theo (WI-4.2)**: Bổ sung logic dual-write hoàn chỉnh vào `createTaskAtomic` trong `src/lib/db/transactions.ts`.
2. **Xây dựng Script Backfill (WI-4.3)**: Phát triển và chạy thử nghiệm script di trú dữ liệu `scripts/backfill-task-actors.ts` trên môi trường Staging.
3. **Triển khai Read Cutover có gắn Feature Flag (WI-4.4)**: Chuyển hướng các dịch vụ đọc sang `TaskActor` với cơ chế bật/tắt an toàn.
4. **Lên kế hoạch dọn dẹp Phase 9**: Ghi nhận việc xóa bỏ bảng `task_assignees` vào kế hoạch phát hành Phase 9 theo đúng lộ trình tiến hóa kiến trúc.
