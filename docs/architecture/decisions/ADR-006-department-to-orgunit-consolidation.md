# ADR-006: Department → OrganizationalUnit Consolidation

- **Status**: PROPOSED (giữ nguyên PROPOSED cho đến khi RFC-02 hoàn tất)
- **Date**: 2026-09-22
- **Deciders**: Owner (pending Architecture Review Gate — **không thẩm định tại Gate Phase 0**)

## Context

Prisma schema hiện chứa **hai mô hình tổ chức song song** không có khóa ngoại liên kết:

### Model `Department` — Legacy (danh sách phẳng)
```prisma
model Department {
  id          String   @id @db.VarChar(50)    // Mã phòng ban ngắn, VD: "CNTT", "KHOA_CO_KHI"
  name        String   @db.VarChar(255)
  shortName   String?
  color       String?
  users       User[]                          // User.departmentId → Department.id
  tasks       Task[]                          // Task.departmentId → Department.id
  draftingDocs Document[]
  leadDocs     Document[]
  directives   DocumentDirective[]
  jobCatalogItems JobCatalogItem[]
  dacumDuties     DacumDuty[]
  delegations     DacumDelegation[]
}
```
- **Đặc điểm**: Flat list, không có `parentId`, không có closure table, không biểu diễn cây phân cấp.
- **Consumer chính**: `Task.departmentId`, `User.departmentId`, `Document` relations, `DacumDelegation`, Job Catalog.

### Model `OrganizationalUnit` — Target (cây phân cấp)
```prisma
model OrganizationalUnit {
  id               String               @id @default(cuid())
  code             String               @unique @db.VarChar(50)
  name             String               @db.VarChar(255)
  type             UnitType             // SCHOOL | FACULTY | DEPARTMENT | CENTER | OFFICE | OTHER
  parentId         String?              // Quan hệ cha-con
  status           UnitStatus           // ACTIVE | INACTIVE | MERGED | DISSOLVED
  effectiveFrom    DateTime
  effectiveTo      DateTime?
  parent           OrganizationalUnit?  @relation("UnitHierarchy", ...)
  children         OrganizationalUnit[] @relation("UnitHierarchy")
  ancestorPaths    UnitClosurePath[]    // Closure table cho truy vấn phân cấp O(1)
  descendantPaths  UnitClosurePath[]
  positionAssignments PositionAssignment[]
  leadTasks           Task[]            @relation("TaskLeadUnit")
  taskActors          TaskActor[]
  workDossiers        WorkDossier[]
  meetings            Meeting[]
}
```
- **Đặc điểm**: Hierarchical tree + closure table, temporal validity (`effectiveFrom`/`effectiveTo`), typed (`UnitType`), statused (`UnitStatus`).
- **Consumer chính**: `TaskActor.unitId`, `PositionAssignment.unitId`, `Task.leadUnitId`, `WorkDossier`, `Meeting`, `UnitWorkAssignment`.

### Vấn đề cốt lõi (FACT F05)
1. **Không có FK liên kết**: `Department.id` (VarChar ngắn) và `OrganizationalUnit.id` (CUID) không có mapping table hoặc foreign key nào.
2. **Dual identity**: `Task` trỏ cả `departmentId` (Department) và `leadUnitId` (OrganizationalUnit). `User` trỏ `departmentId` (Department) trong khi `PositionAssignment` trỏ `unitId` (OrganizationalUnit).
3. **Query divergence**: Filter "nhiệm vụ đơn vị tôi" dùng `departmentId` trên Task legacy path, nhưng `unitId` trên TaskActor path → kết quả khác nhau nếu mapping không đồng bộ.

## Decision (Đề xuất — chờ RFC-02)

Hợp nhất `Department` vào `OrganizationalUnit` theo quy trình 7-step migration:
1. **Expand**: Thêm `OrganizationalUnit.legacyDepartmentId` mapping field.
2. **Backfill**: Chạy script tạo OrganizationalUnit record cho mỗi Department, ghi mapping.
3. **Parity Verify**: Assert mọi `task.departmentId` có mapping sang `OrganizationalUnit`.
4. **Read Cutover**: Chuyển tất cả read paths sang OrganizationalUnit.
5. **Write Cutover**: Chuyển tất cả write paths.
6. **Observe**: Monitor 2 tuần.
7. **Contract**: Xóa `Department` model và `Task.departmentId` FK.

> **QUAN TRỌNG**: Quyết định này BẮT BUỘC phải có RFC-02 hoàn tất trước khi chuyển sang ACCEPTED. RFC-02 phải audit toàn bộ consumers, đánh giá tác động lên queries lịch sử, và xây dựng data mapping matrix.

## Alternatives Considered

### A1: Giữ nguyên cả hai model (Status quo)
- **Ưu điểm**: Không cần migration, không rủi ro.
- **Nhược điểm**: Dual identity tiếp tục gây query divergence; developer phải nhớ dùng model nào cho context nào; không thể truy vấn phân cấp trên Department.

### A2: Thêm FK `Department.organizationalUnitId` liên kết 2 model
- **Ưu điểm**: Backward compatible, cho phép join.
- **Nhược điểm**: Vẫn duy trì 2 source of truth; không giải quyết gốc rễ duplication.

### A3: Deprecated Department — chỉ dùng cho backward-compatible reads
- **Ưu điểm**: Giảm thiểu rủi ro.
- **Nhược điểm**: Phải maintain code path cũ vô thời hạn.

## Consequences

### Tích cực
- Single organizational source of truth.
- Truy vấn phân cấp thống nhất qua closure table.
- Temporal validity cho tái cấu trúc tổ chức (sáp nhập/giải thể đơn vị).

### Tiêu cực
- Migration phức tạp: cần map VarChar IDs sang CUIDs.
- Rủi ro trung bình: queries lịch sử dùng `departmentId` cần rewrite.
- Tạm thời dual-read/write trong giai đoạn migration.

## Migration Impact

- **Database**: Expand → Backfill → Contract trên `Department` table.
- **API**: Mọi endpoint filter theo `departmentId` cần chuyển sang `unitId` hoặc closure path query.
- **UI**: Department selector components cần chuyển sang OrgUnit tree selector.
- **Rollback**: Tại mỗi bước migration có thể rollback an toàn.

## Evidence

| Artifact | File | Line | Mô tả |
|----------|------|------|-------|
| Department model | `prisma/schema.prisma` | 87–104 | Flat list, 8 relations, VarChar ID |
| OrganizationalUnit model | `prisma/schema.prisma` | 914–941 | Hierarchical tree, closure table, CUID |
| UnitClosurePath | `prisma/schema.prisma` | 943–953 | Closure table cho O(1) ancestor/descendant |
| Task.departmentId | `prisma/schema.prisma` | 236 | FK → Department |
| Task.leadUnitId | `prisma/schema.prisma` | 243 | FK → OrganizationalUnit |
| User.departmentId | `prisma/schema.prisma` | 112 | FK → Department |
| PositionAssignment.unitId | `prisma/schema.prisma` | 1016 | FK → OrganizationalUnit |
| TaskActor.unitId | `prisma/schema.prisma` | 1168 | FK → OrganizationalUnit |

## Related ADRs

- **ADR-002**: Contextual Authorization Policy Engine — OrgUnit là input quan trọng trong pipeline 10 bước.
- **ADR-005**: TaskAssignee → TaskActor — TaskActor dùng `unitId` (OrgUnit), TaskAssignee không có unit reference.
- **RFC-02**: Department ↔ OrganizationalUnit Analysis (phải hoàn tất trước khi ADR-006 được ACCEPTED).
