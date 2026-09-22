# RFC-02: Department to OrganizationalUnit Reconciliation Analysis
(Phân Tích Toàn Diện & Chiến Lược Hợp Nhất Mô Hình Phòng Ban Sang Đơn Vị Tổ Chức Cây Phân Cấp)

- **Trạng thái**: PROPOSED (Chờ thẩm định tại Architecture Review Gate — Phase 3 / WI-3.1, Issue #57)
- **Ngày lập**: 2026-09-22
- **Tác giả**: Technical Architecture Working Group & Security Working Group
- **Người thẩm định**: Owner & Tech Lead (Architecture Review Gate)
- **Tài liệu tham chiếu**:
  - `ADR-002: Contextual Authorization Policy Engine (10-Step Pipeline)`
  - `ADR-005: TaskAssignee to TaskActor Migration Strategy`
  - `ADR-006: Department to OrganizationalUnit Consolidation (PROPOSED)`
  - `ADR-007: REST API Standard với Chuẩn Báo Lỗi RFC 9457 Problem Details`
  - `RFC-08: User Directory Visibility & Personal Data Protection Policy`
  - `RFC-09: Canonical Dossier Read Policy Reconciliation`
  - `docs/architecture/migration-map.md` (Mục 4.3 & FACT F05)
  - `docs/architecture/api-db-evolution.md` (R005 / Risk R02)
  - `Quyết định số 282/QĐ-CĐKTCNQN` của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn về Quy định chức năng, nhiệm vụ cơ cấu tổ chức

---

## 1. Tóm Tắt Thực Thi (Executive Summary)

Hệ thống điều hành tác nghiệp QCET E-Office hiện tồn tại đồng thời hai mô hình đại diện cho cơ cấu tổ chức của nhà trường trong cơ sở dữ liệu và mã nguồn ứng dụng:
1. **Model `Department` (Legacy)**: Danh sách phẳng (flat list) với khóa chính chuỗi ký tự tự do `VarChar(50)` (ví dụ: `"BGH"`, `"P_QLDT"`, `"khoa-cntt"`, `"phong-dao-tao"`).
2. **Model `OrganizationalUnit` (ReBAC Target)**: Mô hình cây phân cấp hoàn chỉnh (hierarchical tree) với khóa chính CUID, mã chuẩn tắc duy nhất (`code UNIQUE`), loại hình đơn vị (`UnitType`), trạng thái vòng đời (`UnitStatus`), thời gian hiệu lực (`effectiveFrom`, `effectiveTo`), và bảng đóng thế quan hệ phân cấp (`UnitClosurePath`) phục vụ truy vấn tổ chức độ phức tạp $O(1)$.

Hai mô hình này hiện **hoàn toàn không có khóa ngoại (Foreign Key) liên kết trực tiếp**, dẫn đến hiện tượng phân đôi định danh (**Dual Identity - FACT F05**), phân mảnh quan hệ tham chiếu (Split References), và phân kỳ kết quả truy vấn (Query Divergence) giữa các luồng tác nghiệp.

Tài liệu RFC này thực hiện kiểm toán toàn diện (comprehensive consumer audit) trên toàn bộ Prisma schema, các REST API routes, UI components/dropdowns, và domain services; đồng thời thiết lập ma trận chênh lệch lược đồ (Schema Delta Matrix), ma trận ánh xạ dữ liệu (Data Mapping Matrix), và lộ trình hợp nhất 7 bước (Expand → Backfill → Parity Verify → Read Cutover → Write Cutover → Observe → Contract) theo kiến trúc không gián đoạn dịch vụ (Zero-Downtime Migration).

---

## 2. Bối Cảnh & Đặt Vấn Đề (Context & Problem Statement)

### 2.1 Hiện trạng song trùng mô hình (Dual Model Existence)

Cơ chế tổ chức của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET) là một cơ cấu sư phạm và hành chính đa tầng gồm Ban Giám hiệu, các Phòng chức năng, các Khoa chuyên môn và các Trung tâm trực thuộc theo Quyết định số 282/QĐ-CĐKTCNQN.

Trong mã nguồn hiện tại:
- **`Department`** được hình thành từ giai đoạn đầu phát triển ứng dụng (Phase 0), đóng vai trò danh mục tra cứu phẳng cho bảng phân công công việc đơn giản và thông tin cá nhân cơ bản của `User`.
- **`OrganizationalUnit`** được bổ sung trong kiến trúc phân quyền ReBAC (Relationship-Based Access Control) đa tầng phục vụ việc kế thừa thẩm quyền, phân cấp chỉ đạo văn bản 2 cấp theo Nghị định 30/2020/NĐ-CP, hồ sơ công việc (`WorkDossier`), quản lý cuộc họp (`Meeting`), và các vị trí việc làm (`PositionAssignment`) theo Nghị định 106/2020/NĐ-CP.

### 2.2 Các khiếm khuyết cốt lõi (Core Architectural Deficiencies - FACT F05 & R005)

1. **Thiếu vắng khóa ngoại liên kết (Missing Referential Linkage)**:
   Không tồn tại bất kỳ ràng buộc Foreign Key nào giữa `Department.id` (`VarChar(50)`) và `OrganizationalUnit.id` (`String @default(cuid())`). Không có bảng liên kết trung gian (mapping table). Hai bảng hoạt động như hai hòn đảo dữ liệu tách rời.
2. **Song trùng định danh & Lệch không gian định danh (ID-Space Discrepancy)**:
   Một thực thể ngoài đời thực (ví dụ: *Phòng Quản lý Đào tạo*) được định danh bằng nhiều chuỗi khác nhau trong hệ thống:
   - Trong `Department.id`: vừa có `"P_QLDT"`, vừa có bí danh kế thừa `"phong-dao-tao"`, vừa có `"DT_QLKH"`.
   - Trong `OrganizationalUnit.id`: là một chuỗi ngẫu nhiên CUID (ví dụ: `"cuid_p_qldt_001"`).
   - Trong `OrganizationalUnit.code`: là mã chuẩn hóa viết hoa `"P_QLDT"`.
3. **Phân mảnh tham chiếu dữ liệu (Split References Across Schemas)**:
   - Các bảng trỏ về `Department`: `User.departmentId`, `Task.departmentId`, `Document.draftingDeptId`, `Document.leadDepartmentId`, `DocumentDirective.assignedDeptId`, `JobCatalogItem.departmentId`, `DacumDuty.departmentId`, `DacumDelegation.departmentId`, `TaskSequence.departmentCode`.
   - Các bảng trỏ về `OrganizationalUnit`: `PositionAssignment.unitId`, `Task.leadUnitId`, `TaskActor.unitId`, `DocumentIncomingWorkflow.leadUnitId`, `UnitWorkAssignment.unitId`, `WorkDossier.owningUnitId`, `Meeting.unitId`, `MeetingResolution.leadUnitId`.
4. **Phân kỳ kết quả truy vấn (Query Divergence) & Lỗ hổng nghiệp vụ**:
   - Khi một Trưởng phòng xem bộ lọc "Nhiệm vụ của đơn vị tôi" (`view=unit`):
     - Truy vấn cũ kiểm tra `Task.departmentId = User.departmentId`.
     - Truy vấn mới theo ReBAC kiểm tra `TaskActor.unitId IN (PositionAssignment.unitId)`.
     - Nếu một nhiệm vụ được tạo qua API cũ chỉ gán `departmentId = "phong-dao-tao"` mà không có `leadUnitId`, cán bộ trong đơn vị truy vấn qua cơ chế ReBAC cây phân cấp sẽ **hoàn toàn không thấy nhiệm vụ**, dẫn đến bỏ sót chỉ đạo điều hành.
5. **Vá víu logic runtime (Ad-hoc Runtime Polyfills)**:
   - Trong `src/server/tasks/task-command-service.ts` (dòng 616–625), hệ thống phải tự tra cứu mò mẫm:
     ```typescript
     const matchedOrgUnit = await tx.organizationalUnit.findFirst({
       where: {
         OR: [
           { id: effectiveDepartmentId },
           { code: effectiveDepartmentId },
         ],
       },
       select: { id: true },
     });
     ```
     Nếu `effectiveDepartmentId` là `"phong-dao-tao"`, điều kiện `OR` trên trả về `null` vì trong `OrganizationalUnit` mã chuẩn là `"P_QLDT"`, khiến `TaskActor` bị tạo với `unitId = null`.
   - Trong `src/app/api/delegations/route.ts` (dòng 97–107), lập trình viên phải ghi chú cảnh báo:
     > *"User.departmentId references the Department table while delegation assignments reference OrganizationalUnit, so the authorized unit scope is resolved ONCE here from the caller's active PositionAssignments (OrganizationalUnit id-space)..."*

---

## 3. Ma Trận Chênh Lệch Lược Đồ (Schema Delta Matrix)

### 3.1 So sánh chi tiết từng trường thuộc tính (Field-by-Field Matrix)

| Thuộc tính (Attribute) | `Department` (Legacy) | `OrganizationalUnit` (ReBAC Target) | Đánh giá chênh lệch & Giải pháp tương thích |
|---|---|---|---|
| **Primary Key (`id`)** | `String @id @db.VarChar(50)` | `String @id @default(cuid())` | **Xung đột kiểu định danh**. `Department` dùng slug/mã ngắn; `OrganizationalUnit` dùng CUID. Cần giữ CUID làm chuẩn, map slug cũ vào trường ánh xạ `legacyDepartmentId` hoặc `code`. |
| **Mã đơn vị (`code`)** | Không có (lạm dụng `id` hoặc `shortName`) | `String @unique @db.VarChar(50)` | `OrganizationalUnit` có ràng buộc duy nhất (Unique Constraint), chuẩn hóa theo QĐ 282 (chữ in hoa, gạch dưới). |
| **Tên đơn vị (`name`)** | `String @db.VarChar(255)` | `String @db.VarChar(255)` | **Tương đồng 100%**. Độ dài và định dạng văn bản tương đương nhau. |
| **Tên viết tắt (`shortName`)** | `String? @map("short_name") @db.VarChar(50)` | Không có cột riêng | Chuyển vào thuộc tính `metadata.shortName` dạng JSON trong `OrganizationalUnit` hoặc quy ước hiển thị từ `code`. |
| **Màu sắc hiển thị (`color`)** | `String? @db.VarChar(20)` (Hex color cho UI badge) | Không có cột riêng | Chuyển vào `metadata.color` trong `OrganizationalUnit`. |
| **Phân loại đơn vị (`type`)** | Không có (mô hình coi mọi đơn vị ngang hàng) | `UnitType` Enum (`SCHOOL`, `FACULTY`, `DEPARTMENT`, `CENTER`, `SECTION`, `OTHER`) | `OrganizationalUnit` phản ánh đúng bản chất thể ch��� giáo dục nghề nghiệp theo Luật GDNN. |
| **Quan hệ thứ bậc (`parentId`)** | Không có (mô hình danh sách phẳng) | `String? @map("parent_id")` | `OrganizationalUnit` hỗ trợ quan hệ cha-con tự tham chiếu `@relation("UnitHierarchy")`. |
| **Đóng thế quan hệ (`closure`)** | Không có | `UnitClosurePath[]` (`ancestorPaths`, `descendantPaths`) | Bảng phụ trợ `unit_closure_paths` lưu trữ toàn bộ các đường dẫn bắc cầu với độ sâu `depth`, cho phép truy vấn đệ quy cây đơn vị với độ phức tạp $O(1)$. |
| **Trạng thái vòng đời (`status`)** | Không có (mặc định luôn hoạt động) | `UnitStatus` Enum (`ACTIVE`, `REORGANIZING`, `MERGED`, `DISSOLVED`, `SUSPENDED`) | Cho phép quản lý lịch sử sáp nhập, giải thể, chuyển đổi khoa/phòng theo quy định hành chính công. |
| **Hiệu lực thời gian (Temporal)** | Chỉ có `createdAt`, `updatedAt` | `effectiveFrom DateTime`, `effectiveTo DateTime?` | Cho phép xác định quyền hạn và trách nhiệm đơn vị tại một thời điểm lịch sử cụ thể (point-in-time validity). |
| **Dữ liệu mở rộng (`metadata`)** | Không có | `Json?` | Lưu trữ cấu hình linh hoạt: `shortName`, `color`, `phone`, `email`, `location`, `legacyDepartmentId`, danh sách mã bí danh cũ (`aliasCodes`). |
| **Thời gian tạo/sửa** | `createdAt`, `updatedAt` | `createdAt`, `updatedAt` | **Tương đồng 100%**. |

### 3.2 So sánh các quan hệ ràng buộc (Relation Topology Comparison)

```
MÔ HÌNH HIỆN TẠI (DUAL MODEL FRAGMENTATION):

   [Department] (Flat, VarChar PK)
       │��── 1:N ───> User (departmentId)
       │─── 1:N ───> Task (departmentId)
       │─── 1:N ───> Document (draftingDeptId, leadDepartmentId)
       │─── 1:N ───> DocumentDirective (assignedDeptId)
       │─── 1:N ───> JobCatalogItem (departmentId)
       │─── 1:N ───> DacumDuty (departmentId)
       │─── 1:N ───> DacumDelegation (departmentId)
       └─── 1:N ───> TaskSequence (departmentCode)
       
   [OrganizationalUnit] (Hierarchical Tree, CUID PK)
       │─── 1:N ───> UnitClosurePath (ancestorId / descendantId)
       │─── 1:N ───> PositionAssignment (unitId) ─── 1:N ───> User
       │─── 1:N ───> Task (leadUnitId)
       │─── 1:N ───> TaskActor (unitId)
       │─── 1:N ───> DocumentIncomingWorkflow (leadUnitId)
       │─── 1:N ───> UnitWorkAssignment (unitId)
       │─── 1:N ───> WorkDossier (owningUnitId)
       │─── 1:N ───> Meeting (unitId)
       └─── 1:N ───> MeetingResolution (leadUnitId)
```

---

## 4. Kiểm Toán Toàn Diện Các Bên Tiêu Thụ Dữ Liệu (Consumer Audit)

### 4.1 Bảng tổng hợp các đối tượng tiêu thụ (Audit Inventory Matrix)

| Lớp kiến trúc (Layer) | Tệp nguồn (File Path) | Tên thực thể / Endpoint / Hook | Cách thức sử dụng & Tác động phụ thuộc |
|---|---|---|---|
| **Prisma Schema** | `prisma/schema.prisma` | Model `Department` (dòng 87–104) | Định nghĩa bảng phẳng với 8 quan hệ khóa ngoại trực tiếp. |
| **Prisma Schema** | `prisma/schema.prisma` | Model `User` (dòng 112–113) | `departmentId String? @db.VarChar(50)` liên kết trực tiếp `Department`. |
| **Prisma Schema** | `prisma/schema.prisma` | Model `Task` (dòng 230–231) | `departmentId String? @db.VarChar(50)` tồn tại song song với `leadUnitId` (dòng 249–250). |
| **Prisma Schema** | `prisma/schema.prisma` | Model `Document` (dòng 387, 393) | `draftingDeptId`, `leadDepartmentId` trỏ trực tiếp về `Department`. |
| **Prisma Schema** | `prisma/schema.prisma` | Model `DocumentDirective` (dòng 488) | `assignedDeptId` bắt buộc trỏ về `Department`. |
| **Prisma Schema** | `prisma/schema.prisma` | Model `TaskSequence` (dòng 775) | `departmentCode` dùng làm khóa chính tổng hợp sinh số nhiệm vụ. |
| **Prisma Schema** | `prisma/schema.prisma` | Model `JobCatalogItem` & `DacumDuty` (dòng 798, 815) | `departmentId` liên kết danh mục vị trí việc làm và ma trận DACUM với `Department`. |
| **Prisma Schema** | `prisma/schema.prisma` | Model `DacumDelegation` (dòng 321–328) | `departmentId` liên kết ủy quyền nhiệm vụ với `Department`. |
| **API Route** | `src/app/api/departments/route.ts` | `GET /api/departments` | Trả về danh sách đơn vị từ `prisma.department.findMany()`, kèm tùy chọn `includePersonnel` nạp người dùng từ quan hệ `users`. |
| **API Route** | `src/app/api/users/route.ts` | `GET /api/users` | Tiếp nhận query param `departmentId`, lọc `where: { departmentId }`, include thực thể `department` phẳng. |
| **API Route** | `src/app/api/tasks/route.ts` | `GET / POST /api/tasks` | Xử lý param `departmentId` / `dept`. Kiểm tra thẩm quyền tạo việc truyền `departmentId` cho cả `departmentId` và `leadUnitId`. |
| **API Route** | `src/app/api/delegations/route.ts` | `GET /api/delegations` | Phải chuyển dịch thủ công từ `User.departmentId` sang `PositionAssignment.unitId` để kiểm tra phân quyền xem ủy quyền. |
| **API Route** | `src/app/api/dashboard/overview/route.ts` | `GET /api/dashboard/overview` | Tổng hợp số liệu thống kê nhiệm vụ theo `departmentId`. |
| **API Route** | `src/app/api/documents/route.ts` | `GET / POST /api/documents` | Xử lý luồng văn bản đi/đến theo `draftingDeptId` và `leadDepartmentId`. |
| **API Route** | `src/app/api/executive/resolutions/route.ts` | `GET /api/executive/resolutions` | Lọc kết luận BGH theo `leadDepartmentId` (song song với `leadUnitId`). |
| **Service Layer** | `src/server/tasks/task-command-service.ts` | `createTask`, `updateTask` | Ghi cả `Task.departmentId` và tự động tìm `matchedOrgUnit` để tạo `TaskActor(role=DRI)`. |
| **Service Layer** | `src/server/tasks/task-query-service.ts` | `buildTaskViewWhere`, `extractUserContextDetails` | Tạo mệnh đề `OR: [{ leadUnitId }, { departmentId }, { actors: { unitId } }]` do không chắc chắn dữ liệu nằm ở cột nào. |
| **Domain Layer** | `src/domain/tasks/contract.ts` | `isActorUnitHead` | So sánh trực tiếp chuỗi: `actor.departmentId === unitId`. |
| **Domain Layer** | `src/domain/tasks/state-machine.ts` | Task State Machine Guard | So sánh chuỗi `task.departmentId !== actor.departmentId` để chặn hành động chuyển trạng thái. |
| **Domain Layer** | `src/domain/tasks/attention-resolver.ts` | Attention Resolver | Phân giải cờ chú ý dựa trên `task.departmentId || task.leadDepartmentId`. |
| **Domain Layer** | `src/domain/tasks/subtask-status-guard.ts` | Subtask Status Guard | Kiểm tra quyền cập nhật nhiệm vụ con thông qua so sánh `departmentId`. |
| **Domain Layer** | `src/domain/tasks/mappers.ts` | Task DTO Mappers | Ánh xạ đồng thời cả `departmentId`, `departmentName`, `departmentCode`, `leadDepartmentId`. |
| **Authorization** | `src/server/authorization/authorization-context-service.ts` | `loadAuthorizationContext` | Nạp `user.departmentId` song song với danh sách `activePositions[].unit`. |
| **Authorization** | `src/server/authorization/available-actions.ts` | Action Resolver | Tính toán quyền văn bản và nhiệm vụ bằng cách trích xuất song song `doc.departmentId` và `doc.leadUnitId`. |
| **Client Hook** | `src/hooks/use-department-list.ts` | `useDepartmentList()` | Fetch dữ liệu từ `/api/departments`, lưu in-memory cache 5 phút, trả về `DepartmentOption[]`. |
| **Client UI** | `src/components/tasks/create/create-task-modal.tsx` | Dropdown chọn đơn vị | Gọi `useDepartmentList({ includePersonnel: true })`, bind `selectedDeptCode`, gửi payload tạo việc có `departmentId`. |
| **Client UI** | `src/components/dashboard/create-task-modal.tsx` | Modal tạo việc Dashboard | Sử dụng `useDepartmentList` tương tự để hiển thị danh sách phòng ban. |
| **Client UI** | `src/components/org/organization-tree.tsx` | Cây cơ cấu tổ chức | Hợp nhất dữ liệu cấu hình tĩnh `QCET_ORG_UNITS` với danh sách nhân sự từ `useDepartmentList`. |
| **Client UI** | `src/components/auth/user-profile-modal.tsx` | Modal hồ sơ cá nhân | Sử dụng `useDepartmentList` để hiển thị tên phòng ban của người dùng. |
| **Static Data** | `src/lib/departments.ts` | `QCET_UNIT_CANONICAL_MAP` | Chứa từ điển ánh xạ 16 mã quy chuẩn và các mã legacy alias ("phong-dao-tao" → "P_QLDT"). |
| **Static Data** | `src/lib/org/org-structure.ts` | `QCET_ORG_UNITS` | Cấu hình thông tin địa chỉ, email, số điện thoại tĩnh của các đơn vị. |

---

## 5. Ma Trận Ánh Xạ Dữ Liệu Thực Tế (Data Mapping Matrix)

Để đảm bảo chuyển đổi toàn vẹn 100% không làm mất dữ liệu lịch sử, bảng sau đây định nghĩa ánh xạ toàn bộ các mã `Department.id` hiện có trong database/seed sang `OrganizationalUnit.code` và `UnitType` tương ứng theo cấu trúc chuẩn tắc 16 đơn vị của QCET:

| STT | Mã Legacy (`Department.id`) | Mã Bí Danh Khác (Aliases) | Mã Chuẩn Tắc (`OrganizationalUnit.code`) | Tên Đơn Vị Chuẩn Tắc | Cấp Bậc / Loại (`UnitType`) | Mã Cha (`parentId`) |
|---|---|---|---|---|---|---|
| 0 | `BGH` | `ban-giam-hieu`, `dept-bgh` | `QCET` | Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (Cấp Trường / BGH) | `SCHOOL` (Cấp 0) | `null` (Root) |
| 1 | `P_QLDT` | `phong-dao-tao`, `DT_QLKH`, `P_DTQLKH`, `dept-p-qldt` | `P_QLDT` | Phòng Quản lý Đào tạo | `DEPARTMENT` (Cấp 1) | `QCET` |
| 2 | `P_TSHTQT` | `P_CTHSSV`, `phong-cthssv`, `tt-tuyensinh`, `dept-p-tshtqt` | `P_CTHSSV` / `TT_TS_HTVL` | Phòng Công tác Học sinh - Sinh viên / TT Tuyển sinh & HTVL | `DEPARTMENT` / `CENTER` | `QCET` |
| 3 | `P_HCQT` | `P_TCHC_QT`, `phong-qctb`, `TCHC`, `dept-p-hcqt` | `P_TCHC_QT` | Phòng Tổ chức Hành chính - Quản trị | `DEPARTMENT` (Cấp 1) | `QCET` |
| 4 | `P_TC` | `P_TCKT`, `phong-tckt`, `KHTC`, `dept-p-tc` | `P_TCKT` | Phòng Tài chính - Kế toán | `DEPARTMENT` (Cấp 1) | `QCET` |
| 5 | `P_TCDBCL` | `P_KT_DBCL`, `P_KTDBCL`, `TC_DBCL`, `dept-p-tcdbcl` | `P_KT_DBCL` | Phòng Khảo thí & Đảm bảo chất lượng | `DEPARTMENT` (Cấp 1) | `QCET` |
| 6 | `TT_NNTH` | `TT_NN_TH`, `dept-tt-nnth`, `thu_vien` | `TT_NN_TH` | Trung tâm Ngoại ngữ - Tin học | `CENTER` (Cấp 1) | `QCET` |
| 7 | `TT_STT` | `TT_TS_HTVL`, `tt-laixe` | `TT_TS_HTVL` | Trung tâm Tuyển sinh & Hợp tác việc làm | `CENTER` (Cấp 1) | `QCET` |
| 8 | `K_CNTT` | `khoa-cntt`, `CNTT`, `dept-k-cntt`, `dept-k-dtth` | `K_CNTT` | Khoa Công nghệ thông tin | `FACULTY` (Cấp 1) | `QCET` |
| 9 | `K_DIEN` | `khoa-dien`, `K_DIEN_DTV`, `dept-k-dien` | `K_DIEN_DTV` | Khoa Điện - Điện tử | `FACULTY` (Cấp 1) | `QCET` |
| 10 | `K_CK` | `khoa-co-khi`, `K_CNOTO`, `khoa-oto`, `dept-k-ck` | `K_CK` | Khoa Cơ khí | `FACULTY` (Cấp 1) | `QCET` |
| 11 | `K_KTQT` | `K_KT`, `dept-k-ktth`, `dept-k-ktqt` | `K_KT` | Khoa Kinh tế | `FACULTY` (Cấp 1) | `QCET` |
| 12 | `K_DULICH` | `K_DL`, `khoa-dulich`, `dept-k-dulich` | `K_DL` | Khoa Du lịch | `FACULTY` (Cấp 1) | `QCET` |
| 13 | `K_XD` | `khoa-xaydung` | `K_XD` | Khoa Xây dựng | `FACULTY` (Cấp 1) | `QCET` |
| 14 | `K_DAICUONG` | `K_KHCB`, `K_VHNT`, `khoa-daicuong`, `khoa-vhnt` | `K_KHCB` | Khoa Khoa học cơ bản | `FACULTY` (Cấp 1) | `QCET` |
| 15 | `K_MAY_TT` | `khoa-may` | `K_MAY_TT` | Khoa May - Thời trang | `FACULTY` (Cấp 1) | `QCET` |
| 16 | `K_KTNN` | `K_NL_TS`, `khoa-nongnghiep` | `K_NL_TS` | Khoa Nông lâm - Thủy sản | `FACULTY` (Cấp 1) | `QCET` |

---

## 6. Chiến Lược Di Chuyển & Hợp Nhất 7 Bước (Migration & Reconciliation Strategy)

Theo quy định kiến trúc tại `ADR-006` và quy chuẩn kiểm thử an toàn, lộ trình chuyển đổi tuân thủ nghiêm ngặt mô hình **Expand and Contract (Parallel Run & Zero Downtime)** gồm 7 bước cụ thể:

```
LỘ TRÌNH 7 BƯỚC HỢP NHẤT (EXPAND & CONTRACT):

+-----------------------------------------------------------------------------------+
| Bước 1: EXPAND                                                                    |
| - Thêm legacyDepartmentId, aliasCodes vào OrganizationalUnit                      |
| - Giữ nguyên Department model làm Legacy Facade                                  |
| - Thiết lập cơ chế Dual-Write Adapter                                             |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Bước 2: BACKFILL                                                                  |
| - Chạy sync script backfillDepartmentToUnits                                     |
| - Ánh xạ 100% Department → OrganizationalUnit                                    |
| - Backfill Task.leadUnitId từ Task.departmentId                                  |
| - Backfill PositionAssignment cho Users                                          |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Bước 3: PARITY VERIFICATION (Automated Verification Gate)                         |
| - Chạy bộ kiểm thử 5-file Parity Suite                                           |
| - Khẳng định 100% ID, code, name, FK mapping khớp tuyệt đối                     |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Bước 4: READ CUTOVER                                                              |
| - /api/departments chuyển sang đọc OrganizationalUnit (ACTIVE)                   |
| - Task Query Service chuyển sang lọc theo leadUnitId + Closure Paths             |
| - User Directory đọc theo Unit Structure                                         |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Bước 5: WRITE CUTOVER                                                             |
| - Form tạo Task/User ghi trực tiếp vào leadUnitId & PositionAssignment           |
| - Department chỉ nhận write thụ động qua sync adapter                             |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Bước 6: OBSERVE (Giai đoạn Quan sát 14 Ngày)                                      |
| - Giám sát Telemetry & Audit Logs trên Staging & Production                       |
| - Khẳng định 0 lượt truy cập đọc trực tiếp vào Department table                  |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| Bước 7: CONTRACT (Phase 9 - Dọn Dẹp Cuối Cùng)                                    |
| - Gỡ bỏ Dual-Write Adapter                                                        |
| - Xóa các Foreign Key trỏ về Department                                           |
| - Drop table departments trong Prisma schema                                      |
+-----------------------------------------------------------------------------------+
```

### Bước 1: Expand (Mở Rộng Lược Đồ & Thiết Lập Facade)
1. **Bổ sung trường trên `OrganizationalUnit`**:
   - Thêm `legacyDepartmentId String? @unique @map("legacy_department_id") @db.VarChar(50)`.
   - Mở rộng cấu trúc `metadata Json?` để lưu trữ:
     ```json
     {
       "shortName": "P.QLĐT",
       "color": "#2563EB",
       "aliasCodes": ["phong-dao-tao", "DT_QLKH"],
       "phone": "0256.3846.477",
       "location": "Tầng 1 Nhà A"
     }
     ```
2. **Duy trì `Department` như một Legacy Facade**:
   - Không xóa bất kỳ trường nào của `Department` tại bước này.
   - Thêm cơ chế **Dual-Write (Ghi Kép)** trong tầng dịch vụ: Khi có thao tác tạo mới hoặc cập nhật một đơn vị thông qua `OrganizationalUnitService`, hệ thống tự động đồng bộ một bản ghi tương đương vào bảng `Department` với `id = unit.legacyDepartmentId || unit.code`.

### Bước 2: Backfill (Đồng Bộ & Khởi Tạo Dữ Liệu)
Sử dụng và hoàn thiện script chuẩn `prisma/data-migrations/backfill-department-to-units.ts`:
1. **Khởi tạo Đơn vị Cây Chuẩn Tắc**:
   - Nạp 16 đơn vị cấu thành chu��n tắc theo Quyết định 282/QĐ-CĐKTCNQN từ `prisma/seeds/canonical-org-seed.ts`.
   - Sinh cây đóng thế `UnitClosurePath` hoàn chỉnh cho toàn bộ các đơn vị cấp Trường (`SCHOOL`), Phòng (`DEPARTMENT`), Khoa (`FACULTY`), và Trung tâm (`CENTER`).
2. **Khớp nối 100% Legacy Departments**:
   - Duyệt qua từng bản ghi trong bảng `departments`.
   - Tra cứu qua bảng ánh xạ `DEPARTMENT_TO_ORG_UNIT_CODE_MAP`.
   - Nếu đơn vị chuẩn đã tồn tại: Cập nhật `legacyDepartmentId = dept.id` và lưu `color`, `shortName` vào `metadata`.
   - Nếu là đơn vị phát sinh đột xuất trong dữ liệu kiểm thử: Tự động tạo bản ghi `OrganizationalUnit` mới trực thuộc `QCET` Root để đảm bảo tính toàn vẹn 100%.
3. **Đồng bộ Dữ liệu Tác Nghiệp Lịch Sử**:
   - **Nhiệm vụ (`Task`)**: Duyệt các bản ghi có `departmentId != null` nhưng `leadUnitId == null`. Gán `leadUnitId = targetUnit.id`. Đồng thời tạo bản ghi `TaskActor` với vai trò `role = LEAD_UNIT` tương ứng.
   - **Người dùng (`User`)**: Duyệt các người dùng có `departmentId != null` nhưng chưa có `PositionAssignment(status=ACTIVE)`. Tự động tạo bản ghi phân công vị trí (`PositionAssignment`) gắn với đơn vị `targetUnit.id` và chức danh định nghĩa mặc định (`CAN_BO_CHUYEN_VIEN_CANONICAL` hoặc `TRUONG_DON_VI_CANONICAL`).
   - **Văn bản (`Document`)**: Khởi tạo trường `draftingUnitId` và `leadUnitId` kế thừa từ `draftingDeptId` và `leadDepartmentId`.

### Bước 3: Parity Verification (Thẩm Định Đối Chiếu Tuyệt Đối)
Trước khi thực hiện bất kỳ thao tác chuyển đổi đọc nào, bộ kiểm thử đối chiếu tự động (Automated Data Parity Test Suite) theo kiến trúc tại `docs/architecture/migration-map.md` (mục 4.3.2) bắt buộc phải đạt 100% Pass:

```
tests/migrations/rfc-02-department-to-org-unit/
├── parity.test.ts            # Assert mọi Department.id đều có 1 OrganizationalUnit duy nhất
├── hierarchy.test.ts         # Assert UnitClosurePath phản ánh đúng quan hệ cấp trường -> đơn vị
├── fk-integrity.test.ts      # Assert mọi Task.departmentId đều trỏ tới leadUnitId hợp lệ
├── query-equivalence.test.ts  # Shadow test: Truy vấn theo Department == Truy vấn theo Unit
└── user-context.test.ts      # Assert User.departmentId tương thích hoàn toàn PositionAssignment
```

**Các tiêu chí dừng khẩn cấp (Gate Assertions)**:
- Số lượng `Department` không có mapping sang `OrganizationalUnit` phải bằng **0**.
- Số lượng `Task` có `departmentId` nhưng thiếu `leadUnitId` phải bằng **0**.
- Không có bất kỳ sai lệch nào về số lượng nhiệm vụ trả về giữa hai phương thức lọc danh sách.

### Bước 4: Read Cutover (Chuyển Đổi Tầng Đọc)
1. **Endpoint `GET /api/departments`**:
   - Tái cấu trúc bên trong handler mà không làm thay đổi JSON Contract trả về:
     ```typescript
     // Thay vì prisma.department.findMany()
     const units = await prisma.organizationalUnit.findMany({
       where: { status: UnitStatus.ACTIVE },
       include: {
         positionAssignments: includePersonnel ? {
           where: { status: AssignmentStatus.ACTIVE },
           include: { user: true }
         } : false
       },
       orderBy: { code: 'asc' }
     });
     // Map về Contract DepartmentOption cho Client
     ```
   - Khách hàng giao diện (Client UI) hoàn toàn không nhận thấy sự thay đổi (Zero UI Breaking Change).
2. **Tầng Truy Vấn Nhiệm Vụ (`src/server/tasks/task-query-service.ts`)**:
   - Loại bỏ mệnh đề phụ thuộc vào `departmentId`.
   - Sử dụng triệt để `leadUnitId` và cây đóng thế `UnitClosurePath` để hỗ trợ truy vấn xuyên phòng ban và đơn vị trực thuộc.
3. **Endpoint `GET /api/users`**:
   - Cho phép lọc đồng thời theo `unitId` và `departmentId` (ánh xạ ngầm `departmentId` sang `unitId`).

### Bước 5: Write Cutover (Chuyển Đổi Tầng Ghi)
1. **Endpoint `POST /api/tasks` & `taskCommandService.createTask`**:
   - Input payload chấp nhận `unitId` (hoặc `departmentId` legacy).
   - Tầng ứng dụng phân giải thành `leadUnitId` (CUID) hợp lệ.
   - Thao tác ghi trực tiếp vào `Task.leadUnitId` và bảng `TaskActor`.
   - Ghi phụ trợ vào `Task.departmentId` thông qua trường legacy mapping.
2. **Tạo mới Người Dùng (`User`)**:
   - Khi tạo người dùng mới, bắt buộc tạo kèm bản ghi `PositionAssignment` gắn với `OrganizationalUnit`.

### Bước 6: Observe (Giai Đoạn Quan Sát 14 Ngày)
- Kích hoạt logging và telemetry đo lường:
  - Ghi vết mọi truy vấn SQL còn tham chiếu tới bảng `departments` hoặc cột `department_id`.
  - Giám sát các lỗi liên quan đến phân quyền và hiển thị danh bạ.
- Thời gian quan sát tối thiểu: **14 ngày liên tục** trên môi trường Staging và Production mà không phát sinh lỗi bất thường.

### Bước 7: Contract (Thu Hồi & Dọn Dẹp — Phase 9)
Sau khi hoàn tất toàn bộ các Phase nghiệp vụ (Phase 3 đến Phase 8):
1. Gỡ bỏ cơ chế Dual-Write Adapter.
2. Tạo Prisma migration xóa bỏ các cột:
   - `Task.departmentId` (và index tương ứng).
   - `User.departmentId`.
   - `Document.draftingDeptId`, `Document.leadDepartmentId`.
   - `DocumentDirective.assignedDeptId`.
   - `JobCatalogItem.departmentId`.
   - `DacumDuty.departmentId`.
   - `DacumDelegation.departmentId`.
3. Xóa bỏ hoàn toàn model `Department` (`table departments`) khỏi `prisma/schema.prisma`.
4. Dọn dẹp các tệp shim/facade tương thích ngược (`src/lib/departments.ts`).

---

## 7. Phân Tích Rủi Ro & Kế Hoạch Khôi Phục (Risk Analysis & Rollback Plan)

### 7.1 Ma trận phân tích rủi ro (Risk Analysis Matrix)

| Mã rủi ro | Mô tả rủi ro | Khả năng | Mức độ | Biện pháp giảm thiểu & Kiểm soát phòng ngừa |
|---|---|---|---|---|
| **R-01** | **Xung đột kiểu ID (CUID vs VarChar Slug)**: Các truy vấn client gửi mã dạng `"P_QLDT"` nhưng backend kỳ vọng CUID `"cuid_..."`. | Cao | Nghiêm trọng | Duy trì hàm helper phân giải linh hoạt `resolveUnitId(input)` tại application layer: Nếu input là CUID thì tra cứu `id`, nếu là slug thì tra cứu `code` hoặc `legacyDepartmentId`. |
| **R-02** | **Mất dữ liệu nhiệm vụ lịch sử mang mã bí danh cũ (`alias`)**: Các nhiệm vụ năm 2025 mang mã `"phong-dao-tao"` bị sót khi lọc theo `"P_QLDT"`. | Trung bình | Nghiêm trọng | Bảng ánh xạ `DEPARTMENT_TO_ORG_UNIT_CODE_MAP` gom tất cả các biến thể alias về cùng một đơn vị chuẩn. Backfill script gán trực tiếp `leadUnitId` CUID vào bản ghi nhiệm vụ. |
| **R-03** | **Vỡ giao diện các Dropdown chọn đơn vị (`CreateTaskModal`, `OrganizationTree`)**: Client component bị lỗi render do thay đổi cấu trúc dữ liệu trả về từ API. | Thấp | Nghiêm trọng | Giữ nguyên 100% API contract của `GET /api/departments` và hook `useDepartmentList`. Dữ liệu trả về vẫn bảo đảm các thuộc tính `{ id, name, code, color, personnel }`. |
| **R-04** | **Lệch phân quyền trong 10-Step Authorization Engine (ADR-002)**: Quyền kiểm tra ranh giới đơn vị (Unit Boundary) bị từ chối sai do `context.user.departmentId` không khớp `task.leadUnitId`. | Cao | Rất nghiêm trọng | Tại Bước 4, `authorization-context-service.ts` nạp đồng bộ `unitId` vào `context.user` và kiểm tra ranh giới dựa trên tập hợp `myUnitIds` hợp nhất từ cả `PositionAssignment` và `legacyDepartmentId`. |
| **R-05** | **Suy giảm hiệu năng do truy vấn bảng Closure Table**: Các truy vấn đệ quy cây phân cấp làm chậm thời gian phản hồi của dashboard. | Thấp | Trung bình | Bảng `unit_closure_paths` đã được đánh chỉ mục kép `@@id([ancestorId, descendantId])` và `@@index([descendantId])`. Độ phức tạp truy vấn là $O(1)$ chỉ với 1 phép JOIN đơn giản. |

### 7.2 Kế hoạch khôi phục khẩn cấp (Rollback Plan)

Tại từng giai đoạn triển khai, kế hoạch rollback được kích hoạt độc lập với thời gian khôi phục mục tiêu (RTO < 5 phút):

#### Rollback trong Giai đoạn 1 & 2 (Expand & Backfill)
- **Tác động**: Không ảnh hưởng đến dữ liệu đang chạy vì bảng `Department` và các cột `departmentId` cũ hoàn toàn nguyên vẹn.
- **Thao tác**:
  1. Hủy bỏ tiến trình chạy script backfill nếu đang thực thi.
  2. Bỏ qua các bản ghi mới tạo trên `OrganizationalUnit` (dữ liệu cũ vẫn đọc từ `Department`).

#### Rollback trong Giai đoạn 4 (Read Cutover)
- **Điều kiện kích hoạt (Circuit Breaker)**: Tỉ lệ lỗi HTTP 5xx trên `/api/departments` hoặc `/api/tasks` tăng vượt quá **0.5%** trong 5 phút, hoặc có phản ánh từ người dùng về việc không thấy nhiệm vụ của đơn vị.
- **Thao tác**:
  1. Thiết lập biến môi trường Feature Flag:
     ```env
     FEATURE_FLAG_ORG_UNIT_READ_CUTOVER=false
     ```
  2. Hệ thống tự động chuyển luồng đọc trở lại `prisma.department.findMany()` và mệnh đề `where: { departmentId }` trong `task-query-service.ts`.
  3. Không cần can thiệp rollback cơ sở dữ liệu.

#### Rollback trong Giai đoạn 5 (Write Cutover)
- **Điều kiện kích hoạt**: Phát hiện bản ghi nhiệm vụ mới tạo không đồng bộ được sang `Department` hoặc bị lỗi foreign key constraint.
- **Thao tác**:
  1. Tắt cờ ghi trực tiếp `FEATURE_FLAG_ORG_UNIT_WRITE_CUTOVER=false`.
  2. Các lệnh tạo việc quay trở lại ghi khóa chính vào `Task.departmentId`.
  3. Chạy script bù đắp dữ liệu (delta reconciliation script) cho các bản ghi sinh ra trong khoảng thời gian xảy ra sự cố.

---

## 8. Kết Luận & Khuyến Nghị Tiếp Theo (Next Actions)

RFC-02 đã hoàn thành toàn diện việc khảo sát hiện trạng, phân tích chênh lệch lược đồ, kiểm toán các bên tiêu thụ và vạch ra chiến lược di chuyển an toàn không gián đoạn dịch vụ.

**Các bước hành động tiếp theo sau khi RFC-02 được thông qua**:
1. Cập nhật trạng thái của `ADR-006` từ `PROPOSED` sang `ACCEPTED` tại Architecture Review Gate.
2. Triển khai nhánh kiểm thử Parity Suite tại `tests/migrations/rfc-02-department-to-org-unit/`.
3. Lập lịch thực thi Bước 1 (Expand) và Bước 2 (Backfill) trong kế hoạch nâng cấp hạ tầng dữ liệu của dự án.
