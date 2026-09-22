# RFC-05: Document JSON/Text Relations Assessment
(Đánh Giá & Lộ Trình Chuẩn Hóa Quan Hệ Phi Chuẩn JSON/Text Trong Quy Trình Quản Lý Văn Bản & Chỉ Đạo Tác Nghiệp)

- **Trạng thái**: PROPOSED (Đề xuất thẩm định tại Architecture Review Gate — Phase 5 / WI-5.3, Issue #71)
- **Ngày lập**: 2026-09-22
- **Tác giả**: Technical Architecture Working Group & Document Workflow Domain Team
- **Người thẩm định**: Owner & Tech Lead (Architecture Review Gate)
- **Tài liệu tham chiếu**:
  - `ADR-001: Single Canonical Maker-Checker Guard Policy`
  - `ADR-002: Contextual Authorization Policy Engine (10-Step Pipeline)`
  - `ADR-004: Document Status Two-Tier Sync Architecture (Nghị định 30/2020/NĐ-CP)`
  - `ADR-005: TaskAssignee to TaskActor Migration Strategy`
  - `ADR-006: Department to OrganizationalUnit Consolidation`
  - `ADR-007: REST API Standard với Chuẩn Báo Lỗi RFC 9457 Problem Details`
  - `RFC-01: TaskAssignee to TaskActor Reconciliation Analysis`
  - `RFC-02: Department to OrganizationalUnit Reconciliation Analysis`
  - `RFC-03: Delegation Consolidation Analysis`
  - `RFC-06: TaskScope vs TaskOriginLevel Boundary Analysis`
  - `RFC-09: Canonical Dossier Read Policy Reconciliation`
  - `docs/architecture/api-db-evolution.md` (Mục R008 / Finding F09: JSON/Text Denormalized Relational Data)
  - `docs/architecture/enterprise-product-architecture.md` (Finding F1: Denormalized JSON/Text thay vì junction tables)
  - `docs/architecture/migration-map.md` (Bảng 4.2, Hàng 15: DocumentIncomingWorkflow & Hàng 16: UnitWorkAssignment)
  - `Nghị định số 30/2020/NĐ-CP` ngày 05/03/2020 của Chính phủ về công tác văn thư
  - `Quyết định số 282/QĐ-CĐKTCNQN` của Hiệu trưởng Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn về Quy chế tổ chức và hoạt động

---

## 1. Tóm Tắt Thực Thi (Executive Summary)

Trong quy trình quản lý văn bản và điều hành chỉ đạo của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET) theo tiêu chuẩn Nghị định 30/2020/NĐ-CP, việc xử lý một văn bản đến hoặc một nhiệm vụ trọng tâm luôn đòi hỏi sự phối hợp liên phòng/khoa và liên cá nhân:
- **Cấp Lãnh đạo (Tier 1 - Ban Giám hiệu)**: Phân công một đơn vị chủ trì (`leadUnitId`) và nhiều đơn vị phối hợp (`coordinatingUnitIds`).
- **Cấp Đơn vị (Tier 2 - Trưởng đơn vị)**: Phân công một chuyên viên/giảng viên trực tiếp chịu trách nhiệm chính (DRI - `driUserId`) và nhiều chuyên viên/giảng viên cùng phối hợp (`collaboratorUserIds`).

Tuy nhiên, trong quá trình phát triển nhanh từ giai đoạn sơ khởi (Phase 0) đến kiến trúc điều hành 2 cấp hiện tại (Phase 5), cơ sở dữ liệu và mã nguồn ứng dụng đang tồn tại ba thuộc tính quan hệ phi chuẩn (non-relational denormalized fields):
1. **`DocumentDirective.collaboratorIds` (`collaborator_ids` TEXT)**: Lưu chuỗi ký tự phân cách bằng dấu phẩy (CSV) hoặc chuỗi JSON serialize biểu diễn danh sách đơn vị phối hợp hoặc cá nhân phối hợp.
2. **`DocumentIncomingWorkflow.coordinatingUnitIds` (`coordinating_unit_ids` JSONB)**: Lưu mảng JSON chứa các định danh đơn vị phối hợp (`unitId[]`).
3. **`UnitWorkAssignment.collaboratorUserIds` (`collaborator_user_ids` JSONB)**: Lưu mảng JSON chứa các định danh cán bộ phối hợp (`userId[]`).

Thực trạng lưu trữ quan hệ thực thể dạng "chuỗi phẳng" và "mảng JSON không ràng buộc" này dẫn đến hàng loạt rủi ro kiến trúc nghiêm trọng:
- **Mất toàn vẹn tham chiếu (Zero Foreign Key Constraints)**: Hệ thống cơ sở dữ liệu PostgreSQL hoàn toàn không kiểm tra tính hợp lệ của các ID được lưu. Khi một đơn vị hoặc người dùng bị xóa, đổi mã hoặc sáp nhập, các ID này biến thành "dữ liệu ma" (orphaned IDs).
- **Bất khả thi trong việc xóa/cập nhật liên tầng (Cannot Cascade Delete/Update)**: RDBMS không thể tự động thu dọn dữ liệu khi các thực thể liên quan thay đổi trạng thái vòng đời.
- **Suy giảm hiệu năng truy vấn & Điểm mù truy vấn ngược (Query Inefficiency & Reverse Lookup Blindspots)**: Do không có chỉ mục GIN trên JSONB hay chỉ mục chức năng trên chuỗi Text, mọi truy vấn tìm kiếm văn bản phối hợp đều phải quét toàn bộ bảng (`Seq Scan`). Đặc biệt, bài toán nghiệp vụ cơ bản: *"Liệt kê tất cả văn bản đến mà đơn vị X được giao phối hợp xử lý"* không thể thực hiện hiệu quả bằng quan hệ Prisma chuẩn mà phải dùng truy vấn thô hoặc lọc thủ công trong bộ nhớ ứng dụng.
- **Nhập nhằng ngữ nghĩa & Bẫy kiểu dữ liệu (Semantic Ambiguity & Type Divergence)**: Cùng một trường `collaboratorIds` nhưng tại `incoming-document-service.ts` thì ghi CSV danh sách đơn vị, tại `directives/route.ts` thì serialize JSON, còn tại `document-classification.ts` và `task-policy.ts` lại so sánh trực tiếp với `userId` của cán bộ.
- **Rủi ro tương tranh dữ liệu (Concurrency Anomalies)**: Thao tác cập nhật đơn vị/cán bộ phối hợp bắt buộc phải đọc toàn bộ mảng, chỉnh sửa trong bộ nhớ rồi ghi đè lại, dễ dẫn đến hiện tượng mất cập nhật (Lost Updates) khi có nhiều yêu cầu đồng thời.

Tài liệu RFC-05 này thực hiện kiểm toán toàn diện mã nguồn, phân tích chi tiết các rủi ro, so sánh chuyên sâu giữa hai phương án kỹ thuật: **Phương án A: Mô hình Liên kết Chuẩn hóa (Explicit Join Models)** và **Phương án B: Duy trì JSONB có Kiểm soát Chặt chẽ (Validated JSONB + GIN Index + Zod Schema)**, đồng thời xây dựng lộ trình di chuyển 6 bước theo nguyên tắc **Zero-Downtime Migration (Expand -> Dual-Write -> Backfill -> Parity Verify -> Read Cutover -> Contract)** nhằm chuẩn hóa triệt để cấu trúc dữ liệu cho Phase 5 và Phase 6.

---

## 2. Bối Cảnh & Đặt Vấn Đề (Context & Problem Statement)

### 2.1 Quy trình Xử lý Văn bản 2 cấp theo Nghị định 30/2020/NĐ-CP tại QCET

Theo quy định văn thư hành chính và quy chế làm việc của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn, quy trình luân chuyển văn bản đến và chỉ đạo tác nghiệp diễn ra qua 2 cấp độ phân công rõ rệt:

```
                            [VĂN BẢN ĐẾN TỪ CƠ QUAN BÊN NGOÀI]
                                            │
                                            ▼
                               [Tiếp nhận & Vào sổ Văn thư]
                                  (IncomingDocumentStatus)
                                            │
                                            ▼
                                [Trình Lãnh đạo Nhà trường]
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │     TIER 1: CHỈ ĐẠO BAN GIÁM HIỆU (BGH)       │
                    │         (DocumentIncomingWorkflow)            │
                    ├───────────────────────────────────────────────┤
                    │ - Đơn vị chủ trì: leadUnitId (1 Đơn vị)       │
                    │ - Đơn vị phối hợp: coordinatingUnitIds (n ĐV) │
                    │ - Nội dung chỉ đạo: leadershipInstruction    │
                    │ - Hạn hoàn thành: deadline                    │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │   TIER 2: TRƯỞNG ĐƠN VỊ CHỦ TRÌ PHÂN CÔNG     │
                    │            (UnitWorkAssignment)               │
                    ├───────────────────────────────────────────────┤
                    │ - Cán bộ xử lý chính: driUserId (1 Chuyên viên│
                    │ - Cán bộ phối hợp: collaboratorUserIds (n CB) │
                    │ - Nhiệm vụ gắn kết: taskId -> Task / TaskActor│
                    │ - Hạn xử lý đơn vị: deadline                  │
                    └───────────────────────────────────────────────┘
```

1. **Phân công Cấp 1 (Tier 1 - Ban Giám hiệu)**:
   - Hiệu trưởng hoặc Phó Hiệu trưởng phụ trách lĩnh vực nghiên cứu văn bản, ra bút phê chỉ đạo.
   - Xác định rõ một **Đơn vị chủ trì** (ví dụ: Phòng Quản lý Đào tạo) chịu trách nhiệm đầu mối.
   - Xác định danh sách các **Đơn vị phối hợp** (ví dụ: Khoa Công nghệ thông tin, Khoa Cơ khí, Phòng Tài chính - Kế toán) có trách nhiệm cung cấp số liệu, tham gia hội đồng hoặc đóng góp ý kiến.
2. **Phân công Cấp 2 (Tier 2 - Lãnh đạo Đơn vị Chủ trì)**:
   - Sau khi nhận được chỉ đạo, Trưởng đơn vị chủ trì tổ chức giao việc nội bộ.
   - Xác định một cán bộ chịu trách nhiệm chính (**Directly Responsible Individual - DRI**) để soạn thảo văn bản phản hồi hoặc xây dựng kế hoạch.
   - Xác định danh sách các cán bộ tham gia phối hợp (**Collaborators**) trong nội bộ đơn vị hoặc các đơn vị liên quan.
   - Tự động sinh ra một nhiệm vụ (`Task`) tương ứng trong hệ thống theo dõi tiến độ công việc chung.

### 2.2 Nguồn gốc Lịch sử của Các Quan hệ Phi chuẩn (Historical Genesis)

Trong cơ sở dữ liệu `prisma/schema.prisma`, các thực thể lưu trữ quan hệ phối hợp được tạo ra qua các thời kỳ kiến trúc khác nhau:

#### 1. Model kế thừa `DocumentDirective` (Phase 0)
- Được xây dựng để lưu vết nhanh bút phê của BGH trên bản scan văn bản:
  ```prisma
  model DocumentDirective {
    id               String      @id @default(cuid())
    documentId       String      @map("document_id")
    leaderId         String      @map("leader_id")
    instruction      String      @db.Text
    deadline         DateTime?
    assignedDeptId   String      @map("assigned_dept_id") @db.VarChar(50)
    collaboratorIds  String?     @map("collaborator_ids") @db.Text
    isTaskGenerated  Boolean     @default(false) @map("is_task_generated")
    ...
  }
  ```
- Tại thời điểm này, chưa có khái niệm bảng trung gian hay chuẩn hóa quan hệ nhiều-nhiều (Many-to-Many). Để lưu danh sách các phòng/khoa phối hợp, nhà phát triển đã chọn giải pháp nối chuỗi đơn giản: lưu danh sách mã phòng ban ngăn cách bởi dấu phẩy (CSV) vào cột text `collaborator_ids` (ví dụ: `"khoa-cntt,phong-qctb"` hoặc `"P_TCDBCL,P_QLDT,P_TC"`).

#### 2. Model hiện đại `DocumentIncomingWorkflow` và `UnitWorkAssignment` (Phase 5)
- Được bổ sung theo kiến trúc 2 tầng (ADR-004) nhằm đáp ứng quy trình xử lý văn bản đến của Nghị định 30/2020/NĐ-CP:
  ```prisma
  model DocumentIncomingWorkflow {
    id                    String                 @id @default(cuid())
    documentId            String                 @unique @map("document_id")
    ...
    leadUnitId            String?                @map("lead_unit_id")
    leadUnit              OrganizationalUnit?    @relation("DocWorkflowLeadUnit", fields: [leadUnitId], references: [id], onDelete: SetNull)
    coordinatingUnitIds   Json?                  @map("coordinating_unit_ids")
    ...
  }

  model UnitWorkAssignment {
    id                  String                   @id @default(cuid())
    workflowId          String                   @map("workflow_id")
    ...
    unitId              String                   @map("unit_id")
    driUserId           String                   @map("dri_user_id")
    driUser             User                     @relation("UnitWorkDri", fields: [driUserId], references: [id], onDelete: Restrict)
    collaboratorUserIds Json?                    @map("collaborator_user_ids")
    ...
  }
  ```
- Trong thiết kế này, kiểu `Json` (PostgreSQL `JSONB`) được sử dụng như một giải pháp linh hoạt để lưu mảng các ID mà không phải tạo thêm bảng liên kết trung gian trong schema.
- Tuy nhiên, việc áp dụng `Json` cho các quan hệ thực thể cốt lõi (Core Entity Relations) đã vi phạm nguyên tắc thiết kế cơ sở dữ liệu quan hệ, gây ra các khiếm khuyết được ghi nhận tại Finding F09 / Risk R008 (`docs/architecture/api-db-evolution.md`) và Finding F1 (`docs/architecture/enterprise-product-architecture.md`).

---

## 3. Kiểm Toán Toàn Diện Mã Nguồn (Comprehensive Codebase Audit)

Để xác định chính xác mức độ ảnh hưởng của các trường JSON/Text, nhóm kiến trúc đã thực hiện kiểm toán toàn bộ mã nguồn trên 4 bề mặt: Database Schema & Migrations, API Contracts & DTOs, Business Services & State Handlers, và Authorization Engine.

### 3.1 Bề mặt Schema & Cơ sở Dữ liệu

| Bảng Cơ sở Dữ liệu | Tên Cột | Kiểu Dữ liệu Postgres | Ràng buộc Khóa ngoại (FK) | Chỉ mục (Index) | Ngữ nghĩa Thực tế Được Lưu |
|:---|:---|:---|:---|:---|:---|
| `document_directives` | `collaborator_ids` | `TEXT` | Không có | Không có | Danh sách đơn vị phối hợp (dạng CSV hoặc JSON string) |
| `document_incoming_workflows` | `coordinating_unit_ids` | `JSONB` | Không có | Không có | Mảng CUID của các `OrganizationalUnit` phối hợp |
| `unit_work_assignments` | `collaborator_user_ids` | `JSONB` | Không có | Không có | Mảng CUID/ID của các `User` phối hợp |

*Bằng chứng mã nguồn*:
- `prisma/schema.prisma:483`: `collaboratorIds String? @map("collaborator_ids") @db.Text`
- `prisma/schema.prisma:531`: `coordinatingUnitIds Json? @map("coordinating_unit_ids")`
- `prisma/schema.prisma:578`: `collaboratorUserIds Json? @map("collaborator_user_ids")`
- `prisma/migrations/20260910000000_baseline/migration.sql:361, 380, 407`: Các cột được tạo với kiểu `TEXT` và `JSONB` thô, hoàn toàn không có `REFERENCES` hay `CREATE INDEX ... USING GIN`.

### 3.2 Bề mặt Hợp đồng API (Contracts) & Đối tượng Truyền Dữ liệu (DTO)

1. **`src/contracts/documents.ts` (dòng 291–297)**:
   ```typescript
   export const CreateDirectiveSchema = z.object({
     ...
     collaboratorIds: z
       .union([
         z.array(z.string().trim().max(128)),
         z.string().trim().max(1000),
       ])
       .optional()
       .nullable(),
   });
   ```
   Hợp đồng API buộc phải chấp nhận cả hai định dạng: hoặc mảng chuỗi `string[]` hoặc chuỗi tự do `string` có độ dài tối đa 1000 ký tự. Đây là biểu hiện rõ rệt của sự thỏa hiệp lỏng lẻo do thiếu chuẩn hóa dữ liệu tầng dưới.

2. **`src/server/dto/document-dto.ts` (dòng 259 và dòng 360)**:
   ```typescript
   collaboratorIds: d.collaboratorIds ?? null,
   ```
   Tầng DTO chuyển thẳng giá trị `collaboratorIds` từ database ra ngoài mà không chuẩn hóa thành cấu trúc danh sách nhất quán, đẩy gánh nặng phân tích cú pháp (parsing) cho phía client.

### 3.3 Bề mặt Xử lý Nghiệp vụ & Đường ống Chỉ đạo (Business Services & Pipelines)

Kiểm toán phát hiện **5 kiểu phân tích cú pháp phòng thủ (Defensive Parsing Workarounds)** khác nhau cùng tồn tại rải rác trong hệ thống:

#### 1. Định dạng JSON String vs CSV trong `src/app/api/documents/[id]/directives/route.ts` (dòng 177–181):
```typescript
const serializedCollaborators = Array.isArray(validated.collaboratorIds)
  ? JSON.stringify(validated.collaboratorIds)
  : typeof validated.collaboratorIds === "string"
  ? validated.collaboratorIds
  : null;
```
Khi gọi API bút phê trực tiếp, mảng đơn vị phối hợp được tuần tự hóa thành chuỗi JSON: `'["dept-1","dept-2"]'`.

#### 2. Định dạng CSV thuần trong `src/lib/services/incoming-document-service.ts` (dòng 582):
```typescript
const dir = await tx.documentDirective.create({
  data: {
    ...
    collaboratorIds: (input.coordinatingUnitIds || []).join(","),
  },
});
```
Khi phát lệnh chỉ đạo qua quy trình xử lý văn bản đến v2, mảng đơn vị phối hợp lại được nối chuỗi bằng dấu phẩy: `"dept-1,dept-2"`.

#### 3. Bộ phân tích chắp vá trong `src/lib/documents/directive-pipeline.ts` (dòng 47–64):
```typescript
export function parseCollaboratorIds(raw?: string | null): string[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      // fallback to comma-separated
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
```
Hàm này cố gắng "đoán" xem chuỗi đang lưu là mảng JSON hay danh sách CSV, chứng minh tình trạng dữ liệu hỗn tạp trong cùng một cột.

#### 4. Khởi tạo dữ liệu mẫu trong `prisma/seed.ts` (dòng 2644, 2682, 3236):
```typescript
// Dòng 2644: Danh sách mã phòng ban CSV
collaboratorIds: 'P_TCDBCL,P_QLDT,P_TC,P_HCQT,P_TSHTQT,TT_STT,K_CNTT,K_CK,K_DIEN,K_CNOTO,K_KTNN,K_KTQT,K_VHNT,K_DAICUONG',
// Dòng 2682: Danh sách slug đơn vị cũ
collaboratorIds: 'khoa-cntt,tt-tuyensinh',
```
Dữ liệu mẫu chứa cả mã phòng ban theo chuẩn cũ lẫn slug viết thường, không có bất kỳ ràng buộc nào với khóa chính của bảng `Department` hay `OrganizationalUnit`.

### 3.4 Bề mặt Phân quyền & Phân loại Văn bản (Authorization Engine)

Nghiêm trọng nhất là tại tầng phân quyền, việc thiếu ràng buộc kiểu đã dẫn đến **sai lệch ngữ nghĩa nguy hiểm**:

1. **`src/server/authorization/document-classification.ts` (dòng 304–307)**:
   ```typescript
   if (typeof d.collaboratorIds === 'string') {
     const ids = d.collaboratorIds.split(',').map((s: string) => s.trim());
     if (ids.includes(userId)) return true;
   }
   ```
   **Lỗi nghiêm trọng (Semantic Bug)**: Trong khi `d.collaboratorIds` lưu danh sách **mã đơn vị** phối hợp (ví dụ: `"khoa-cntt"`, `"P_QLDT"`), hàm này lại so sánh từng phần tử với **`userId` của cá nhân** (`ids.includes(userId)`)! Hơn nữa, nếu chuỗi được lưu là JSON string `["khoa-cntt"]`, hàm `split(',')` sẽ tạo ra mảng `['["khoa-cntt"']`, hoàn toàn làm sai lệch logic phân quyền.

2. **`src/server/policies/task-policy.ts` (dòng 63–75)**:
   ```typescript
   export function isCollaborator(user: AuthenticatedUserContext, collaboratorIds?: string[] | string | null): boolean {
     if (!collaboratorIds || !user.id) return false;
     if (Array.isArray(collaboratorIds)) {
       return collaboratorIds.includes(user.id);
     }
     if (typeof collaboratorIds === 'string') {
       const trimmed = collaboratorIds.trim();
       if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
         try {
           const parsed = JSON.parse(trimmed);
           if (Array.isArray(parsed)) return parsed.includes(user.id);
         } catch { ... }
       }
       return trimmed.split(',').map(s => s.trim()).includes(user.id);
     }
     return false;
   }
   ```
   Hàm này tiếp tục lặp lại toàn bộ logic suy đoán chuỗi JSON/CSV chỉ để ki��m tra quyền truy cập của một người dùng.

---

## 4. Phân Tích Rủi Ro & Khiếm Khuyết Kỹ Thuật (Risk & Defect Analysis)

### 4.1 Mất Toàn Vẹn Tham Chiếu (Loss of Referential Integrity)

Trong cơ sở dữ liệu quan hệ chuẩn mực, các mối quan hệ giữa các thực thể phải được bảo vệ bằng ràng buộc khóa ngoại (Foreign Key Constraints). Với các cột JSONB và Text:
- PostgreSQL chỉ kiểm tra tính hợp lệ cú pháp JSON (đối với JSONB) hoặc độ dài chuỗi (đối với Text). RDBMS hoàn toàn không có nhận thức rằng các phần tử bên trong mảng là khóa chính trỏ đến bảng `organizational_units` hay `users`.
- Bất kỳ giá trị chuỗi nào cũng có thể được ghi vào cơ sở dữ liệu: ID không tồn tại, ID viết sai chính tả, ID của một thực thể đã bị xóa, hoặc chuỗi rỗng (`["cuid_fake_123", "", null]`).
- Tình trạng **"Dữ liệu Ma" (Orphaned Data)** chắc chắn sẽ tích lũy theo thời gian khi cán bộ luân chuyển công tác, tài khoản người dùng bị khóa/xóa hoặc các đơn vị phòng khoa được tổ chức lại theo đề án sáp nhập của Nhà trường.

### 4.2 Bất Khả Thi Trong Việc Xóa/Cập Nhật Liên Tầng (Cannot Cascade Delete or Update)

Khi thực hiện tái cấu trúc dữ liệu theo lộ trình ADR-006 (Department to OrganizationalUnit Consolidation) hoặc khi gỡ bỏ một đơn vị/người dùng:
- Với các cột có Foreign Key (như `DocumentIncomingWorkflow.leadUnitId` hay `UnitWorkAssignment.driUserId`), RDBMS tự động áp dụng chính sách `ON DELETE RESTRICT` (ngăn chặn xóa vi phạm) hoặc `ON DELETE SET NULL`.
- Với `coordinating_unit_ids` và `collaborator_user_ids`, RDBMS **hoàn toàn im lặng**. Khi một `OrganizationalUnit` bị xóa hoặc đổi mã, các bản ghi văn bản vẫn giữ nguyên mảng chứa ID cũ. Khi người dùng mở chi tiết văn bản, hệ thống sẽ cố gắng tra cứu đơn vị phối hợp theo ID cũ và trả về giá trị rỗng/lỗi `Undefined Unit`.
- Để dọn dẹp các ID này, quản trị viên không thể dùng các câu lệnh SQL ngắn gọn mà bắt buộc phải viết các đoạn mã chạy ngầm (cron job) để quét toàn bộ cơ sở dữ liệu, parse từng mảng JSON, lọc bỏ phần tử và ghi ngược lại, tiêu tốn tài nguyên và tiềm ẩn nguy cơ làm sai lệch dữ liệu.

### 4.3 Suy Giảm Hiệu Năng & Điểm Mù Truy Vấn Ngược (Query Inefficiency & Reverse Lookup Blindspots)

Đây là vấn đề nghiêm trọng nhất về m��t vận hành và mở rộng quy mô hệ thống:

```
VẤN ĐỀ TRUY VẤN NGƯỢC (REVERSE LOOKUP PROBLEM):
"Tìm tất cả văn bản đến mà Khoa CNTT (unit_id = 'cuid_cntt') tham gia phối hợp xử lý"

CƠ SỞ DỮ LIỆU HIỆN TẠI (JSONB không GIN Index & CSV Text):
SELECT * FROM document_incoming_workflows 
WHERE coordinating_unit_ids @> '["cuid_cntt"]';
-> Thực thi: Seq Scan on document_incoming_workflows (Quét toàn bộ bảng O(N))
-> Chi phí I/O: Cực lớn khi số lượng văn bản đạt hàng chục nghìn bản ghi.

NẾU CHUẨN HÓA BẢNG JOIN MODEL (DocumentCoordinatingUnit):
SELECT w.* FROM document_incoming_workflows w
JOIN document_coordinating_units cu ON cu.workflow_id = w.id
WHERE cu.unit_id = 'cuid_cntt';
-> Thực thi: Index Scan on document_coordinating_units(unit_id) (Độ phức tạp O(log N))
-> Tốc độ phản hồi: Dưới 1ms, tận dụng tối đa B-Tree index chuẩn tắc.
```

1. **Thiếu chỉ mục GIN trên JSONB**:
   - `DocumentIncomingWorkflow.coordinatingUnitIds` không có chỉ mục GIN (`jsonb_path_ops`). Khi số lượng văn bản đến tăng lên hàng năm, bất kỳ truy vấn nào sử dụng toán tử `@>` của JSONB đều biến thành thao tác quét toàn bảng (Full Table Scan), gây nghẽn CPU cơ sở dữ liệu.
2. **Nguy cơ khớp chuỗi sai trong Text CSV (`collaboratorIds`)**:
   - Để tìm văn bản phối hợp trong `DocumentDirective`, truy vấn bắt buộc phải dùng `LIKE '%unit_id%'`.
   - Điều này dẫn đến lỗi khớp chuỗi con (Substring Collision): Tìm kiếm đơn vị `"KT"` (Kế toán) sẽ khớp nhầm với các đơn vị `"K_KTNN"` (Khoa Kinh tế - Nông nghiệp) và `"K_KTQT"` (Khoa Kinh tế Quốc tế).
3. **Bế tắc trong việc xây dựng Bàn làm việc (Dashboard Aggregations)**:
   - Trong `src/lib/services/incoming-document-service.ts` (hàm `listIncomingWorkflows`, dòng 1161–1215), bộ lọc tìm kiếm hỗ trợ `filters.leadUnitId`, `filters.leaderId`, `filters.driUserId`, nhưng **hoàn toàn không hỗ trợ `filters.coordinatingUnitId`**.
   - Lý do là việc kết hợp điều kiện lọc JSON trong Prisma Client cùng với phân trang (`skip`, `take`) và sắp xếp (`orderBy`) rất phức tạp và không tối ưu. Hệ quả là trên Bàn làm việc của Trưởng khoa, hệ thống chỉ hiển thị được văn bản mà khoa mình chủ trì, còn văn bản khoa mình phối hợp thì bị b�� sót hoàn toàn.

### 4.4 Rủi Ro Tương Tranh Dữ Liệu & Mất Cập Nhật (Concurrency Anomalies & Lost Updates)

Xét kịch bản phân công phối hợp diễn ra trong thực tế:
1. **Thời điểm $T_1$**: Hiệu trưởng chỉ đạo văn bản giao Khoa CNTT chủ trì, phối hợp với Phòng Đào tạo (`coordinatingUnitIds = ["P_QLDT"]`).
2. **Thời điểm $T_2$**: Phó Hiệu trưởng phụ trách cơ sở vật chất xem xét văn bản và bổ sung thêm Phòng Quản trị Thiết bị vào danh sách phối hợp. Phiên làm việc của Phó Hiệu trưởng đọc được `coordinatingUnitIds = ["P_QLDT"]`.
3. **Thời điểm $T_3$**: Cùng lúc đó, Ban Giám hiệu ra quyết định bổ sung thêm Phòng Khảo thí & ĐBCL (`"P_TCDBCL"`). Phiên làm việc thứ hai cũng đọc `coordinatingUnitIds = ["P_QLDT"]`.
4. **Thời điểm $T_4$**: Phiên của Phó Hiệu trưởng ghi đè mảng mới: `["P_QLDT", "P_QCTB"]`.
5. **Thời điểm $T_5$**: Phiên thứ hai hoàn tất sau và ghi đè mảng: `["P_QLDT", "P_TCDBCL"]`.

**Hậu quả**: Thao tác tại $T_5$ ghi đè hoàn toàn thay đổi của $T_4$. Phòng Quản trị Thiết bị (`P_QCTB`) bị biến mất khỏi danh sách phối hợp mà không để lại dấu vết cảnh báo nào. Nếu quan hệ phối hợp được lưu dưới dạng các dòng độc lập trong bảng liên kết trung gian (Join Model), hai thao tác thêm mới bản ghi (`INSERT`) hoàn toàn độc lập và không bao giờ xảy ra xung đột ghi đè mảng.

---

## 5. Đánh Giá Các Phương Án Kỹ Thuật (Technical Options Evaluation)

Nhóm kiến trúc tiến hành đánh giá chi tiết hai phương án kỹ thuật khả thi:

### 5.1 Phương án A: Mô hình Liên kết Chuẩn hóa (Explicit Join Models) - Khuyến nghị

Chuẩn hóa toàn diện các quan hệ phi chuẩn thành các thực thể liên kết nhiều-nhiều (Junction Models) chuẩn tắc trong cơ sở dữ liệu quan hệ, tích hợp đầy đủ khóa ngoại, chỉ mục B-Tree và metadata kiểm toán.

#### 1. Cấu trúc Mô hình Đề xuất

```
                      ┌──────────────────────────────────────┐
                      │       DocumentIncomingWorkflow       │
                      ├──────────────────────────────────────┤
                      │ id: String (CUID, PK)                │
                      │ documentId: String (FK)              │
                      │ leadUnitId: String (FK)              │
                      └──────────────────┬───────────────────┘
                                         │ 1
                                         │
                                         │ 1..n
                                         ▼
                      ┌──────────────────────────────────────┐
                      │       DocumentCoordinatingUnit       │
                      │          (Bảng Join Model)           │
                      ├──────────────────────────────────────┤
                      │ id: String (CUID, PK)                │
                      │ workflowId: String (FK -> Workflow)  │
                      │ unitId: String (FK -> OrgUnit)       │
                      │ assignedById: String (FK -> User)    │
                      │ assignedAt: DateTime                 │
                      │ notes: String?                       │
                      ├──────────────────────────────────────┤
                      │ @@unique([workflowId, unitId])       │
                      │ @@index([unitId])                    │
                      └──────────────────┬───────────────────┘
                                         │ n
                                         │
                                         ▼ 1
                      ┌──────────────────────────────────────┐
                      │          OrganizationalUnit          │
                      ├──────────────────────────────────────┤
                      │ id: String (CUID, PK)                │
                      │ code: String (UNIQUE)                │
                      │ name: String                         │
                      └──────────────────────────────────────┘
```

Tương tự cho Tier 2 phân công chuyên viên:
```
                      ┌──────────────────────────────────────┐
                      │          UnitWorkAssignment          │
                      ├──────────────────────────────────────┤
                      │ id: String (CUID, PK)                │
                      │ driUserId: String (FK -> User)       │
                      └──────────────────┬───────────────────┘
                                         │ 1
                                         │
                                         │ 1..n
                                         ▼
                      ┌──────────────────────────────────────┐
                      │         UnitWorkCollaborator         │
                      │          (Bảng Join Model)           │
                      ├──────────────────────────────────────┤
                      │ id: String (CUID, PK)                │
                      │ assignmentId: String (FK -> Assign)  │
                      │ userId: String (FK -> User)          │
                      │ assignedById: String (FK -> User)    │
                      │ assignedAt: DateTime                 │
                      ├──────────────────────────────────────┤
                      │ @@unique([assignmentId, userId])     │
                      │ @@index([userId])                    │
                      └──────────────────────────────────────┘
```

#### 2. Định nghĩa Schema Prisma Đề xuất
```prisma
model DocumentCoordinatingUnit {
  id           String                   @id @default(cuid())
  workflowId   String                   @map("workflow_id")
  unitId       String                   @map("unit_id")
  assignedById String?                  @map("assigned_by_id")
  assignedAt   DateTime                 @default(now()) @map("assigned_at")
  notes        String?                  @db.Text

  workflow     DocumentIncomingWorkflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  unit         OrganizationalUnit       @relation("CoordinatingUnitDocs", fields: [unitId], references: [id], onDelete: Restrict)
  assignedBy   User?                    @relation("CoordinatingUnitAssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)

  @@unique([workflowId, unitId], name: "workflow_unit_unique")
  @@index([unitId])
  @@index([workflowId])
  @@map("document_coordinating_units")
}

model UnitWorkCollaborator {
  id           String             @id @default(cuid())
  assignmentId String             @map("assignment_id")
  userId       String             @map("user_id")
  assignedById String?            @map("assigned_by_id")
  assignedAt   DateTime           @default(now()) @map("assigned_at")

  assignment   UnitWorkAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  user         User               @relation("UnitWorkCollaboratorUser", fields: [userId], references: [id], onDelete: Restrict)
  assignedBy   User?              @relation("UnitWorkCollaboratorAssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)

  @@unique([assignmentId, userId], name: "assignment_user_unique")
  @@index([userId])
  @@index([assignmentId])
  @@map("unit_work_collaborators")
}
```

*Xử lý đối với `DocumentDirective.collaboratorIds`*:
- Không tạo bảng join riêng cho model legacy `DocumentDirective`.
- Theo kiến trúc ADR-004 và đề án hợp nhất ADR-006, `DocumentDirective` sẽ dần được thay thế bởi `DocumentIncomingWorkflow` (Tier 1). Trong giai đoạn chuyển tiếp, dữ liệu `collaboratorIds` của các directive cũ sẽ được backfill đồng bộ vào `DocumentCoordinatingUnit` tương ứng của văn bản đó.

### 5.2 Phương án B: Duy trì JSONB có Kiểm soát Chặt chẽ (Validated JSONB + GIN Index + Zod Schema)

Giữ nguyên cột JSONB trong cơ sở dữ liệu để tránh tăng số lượng bảng, nhưng khắc phục các nhược điểm hiện tại bằng cách bổ sung chỉ mục GIN chuyên dụng và siết chặt tầng xác thực ứng dụng.

#### 1. Tối ưu hóa Database với Chỉ mục GIN
```sql
-- Bổ sung GIN index với jsonb_path_ops để tối ưu toán tử chứa @>
CREATE INDEX idx_doc_incoming_coord_units_gin 
ON document_incoming_workflows USING GIN (coordinating_unit_ids jsonb_path_ops);

CREATE INDEX idx_unit_work_collab_users_gin 
ON unit_work_assignments USING GIN (collaborator_user_ids jsonb_path_ops);
```

#### 2. Ràng buộc Tầng Ứng dụng (Application-Level Integrity Guards)
- Bắt buộc chuẩn hóa mảng JSON tại cổng vào API bằng Zod Schema:
  ```typescript
  const CoordinatingUnitIdsSchema = z.array(z.string().cuid()).min(1).max(20);
  ```
- Kiểm tra toàn vẹn tham chiếu trong Service trước khi thực thi lệnh ghi:
  ```typescript
  if (input.coordinatingUnitIds && input.coordinatingUnitIds.length > 0) {
    const existingCount = await tx.organizationalUnit.count({
      where: { id: { in: input.coordinatingUnitIds }, status: 'ACTIVE' }
    });
    if (existingCount !== input.coordinatingUnitIds.length) {
      throw new ValidationError("Một hoặc nhiều đơn vị phối hợp không tồn tại hoặc đã giải thể.");
    }
  }
  ```

### 5.3 Ma Trận So Sánh & Đánh Đổi Toàn Diện (Comprehensive Trade-Off Matrix)

| Tiêu Chí Đánh Giá | Hiện Trạng (CSV Text & Raw JSONB) | Phương Án A: Mô Hình Liên Kết Chuẩn Hóa (Explicit Join Models) | Phương Án B: JSONB Có Kiểm Soát (Validated JSONB + GIN) |
|:---|:---:|:---:|:---:|
| **Toàn vẹn Dữ liệu (Referential Integrity)** | 🔴 **Rất Kém**<br>(Không kiểm tra FK, rác dữ liệu ma) | 🟢 **Tuyệt Đối**<br>(RDBMS quản lý FK cứng với `onDelete: Restrict`) | 🟡 **Trung Bình**<br>(Phụ thuộc hoàn toàn vào code ứng dụng) |
| **Bảo vệ Cascade Delete / Update** | 🔴 **Không thể**<br>(RDBMS không thể tự động xử lý) | 🟢 **Tự động & An toàn**<br>(Xóa workflow tự động xóa coordinating units) | 🔴 **Thủ công**<br>(Phải viết trigger hoặc job quét định kỳ) |
| **Hiệu năng Truy vấn Ngược (Reverse Lookup)** | 🔴 **Chậm**<br>(Full Table Scan, không filter được) | 🟢 **Tối Ưu ($O(\log N)$)**<br>(B-Tree index trên `unit_id` và `user_id`) | 🟡 **Khá**<br>(Sử dụng GIN index nhưng tốn RAM hơn B-Tree) |
| **Khả năng Mở rộng Metadata** | 🔴 **Không thể**<br>(Chỉ lưu danh sách ID thô) | 🟢 **Rất Tốt**<br>(Lưu được `assignedById`, `assignedAt`, `notes`) | 🟡 **Khó**<br>(Phải đổi cấu trúc JSON thành mảng objects) |
| **Khả năng Chống Tương Tranh (Concurrency)** | 🔴 **Dễ Lỗi**<br>(Ghi đè toàn bộ mảng / chuỗi) | 🟢 **Cao**<br>(Thêm/bớt dòng độc lập không xung đột) | 🔴 **Dễ Lỗi**<br>(Vẫn phải ghi đè toàn bộ mảng JSONB) |
| **Tiện ích Lập trình với Prisma (Ergonomics)** | 🔴 **Chắp vá**<br>(Phải tự viết parser CSV/JSON khắp nơi) | 🟢 **Chuẩn Tắc**<br>(Dùng `include`, quan hệ n-m chuẩn, type-safe) | 🟡 **Khá**<br>(Vẫn phải cast `as string[]` ở nhiều nơi) |
| **Chi phí Di chuyển Dữ liệu (Migration Effort)** | 🟢 **0**<br>(Giữ nguyên hiện trạng lỗi) | 🟡 **Trung Bình**<br>(Cần tạo 2 bảng mới & chạy script backfill) | 🟢 **Thấp**<br>(Chỉ cần tạo thêm chỉ m���c GIN) |
| **Tuân thủ Chuẩn Hành chính (NĐ 30/2020)** | 🔴 **Không Đạt**<br>(Dễ thất lạc dấu vết phân công phối hợp) | 🟢 **Đạt Chuẩn Cao Nhất**<br>(Mỗi đơn vị phối hợp là một thực thể pháp lý) | 🟡 **Tạm Chấp Nhận** |

---

## 6. Lộ Trình Di Chuyển Dữ Liệu Zero-Downtime (Migration & Backfill Roadmap)

Nhóm kiến trúc đề xuất quy trình chuyển đổi 6 bước đảm bảo hệ thống đang phục vụ cán bộ giảng viên không bị gián đoạn (Zero Downtime):

```
                                 LỘ TRÌNH DI CHUYỂN DỮ LIỆU 6 BƯỚC
                                 
  [Giai đoạn 1]       [Giai đoạn 2]       [Giai đoạn 3]       [Giai đoạn 4]       [Giai đoạn 5]       [Giai đoạn 6]
     EXPAND             DUAL-WRITE           BACKFILL         PARITY VERIFY       READ CUTOVER          CONTRACT
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│Tạo bảng mới  │    │Ghi đồng thời │    │Quét & chuyển │    │Đối soát 100% │    │Chuyển query  │    │Deprecate &   │
│Join Models   │───>│vào JSONB và  │───>│dữ liệu cũ    │───>│dữ liệu hai   │───>│đọc từ bảng   │───>│dọn dẹp các   │
│trong Schema  │    │bảng mới      │    │vào bảng mới  │    │nguồn song song│    │Join Models   │    │cột cũ        │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Bước 1: Giai đoạn Mở rộng Schema (Expand Phase)
- Bổ sung hai model `DocumentCoordinatingUnit` và `UnitWorkCollaborator` vào `prisma/schema.prisma`.
- Thực thi migration tạo bảng mới và các chỉ mục Foreign Key tương ứng trong PostgreSQL.
- Giữ nguyên các cột cũ `coordinating_unit_ids`, `collaborator_user_ids` và `collaborator_ids`. Không gây bất kỳ ảnh hưởng nào đến mã nguồn hiện hành.

### B��ớc 2: Giai đoạn Ghi Song Song (Dual-Write Phase)
- Cập nhật các hàm nghiệp vụ cốt lõi trong `src/lib/services/incoming-document-service.ts`:
  - Trong `directDocument`: Khi ghi nhận chỉ đạo Tier 1, ngoài việc lưu `coordinatingUnitIds` vào cột JSONB, thực hiện tạo các dòng tương ứng trong `DocumentCoordinatingUnit`.
  - Trong `assignUnitWork`: Khi ghi nhận phân công Tier 2, ngoài việc lưu `collaboratorUserIds` vào cột JSONB, thực hiện tạo các dòng tương ứng trong `UnitWorkCollaborator`.
- Đảm bảo toàn bộ thao tác ghi kép nằm trọn vẹn trong một giao dịch cơ sở dữ liệu duy nhất (`prisma.$transaction`).

### Bước 3: Giai đoạn Chuyển đổi Dữ liệu Lịch sử (Backfill Phase)
- Xây dựng script di chuyển dữ liệu độc lập (Idempotent Migration Script). Script có khả năng chạy lại nhiều lần mà không tạo bản ghi trùng lặp:
  1. **Xử lý `DocumentIncomingWorkflow.coordinatingUnitIds`**:
     - Đọc các dòng có `coordinating_unit_ids IS NOT NULL`.
     - Phân tích mảng JSON, kiểm tra tính hợp lệ của từng `unitId` trong bảng `organizational_units`.
     - Nạp vào `DocumentCoordinatingUnit` với `workflow_unit_unique` guard.
  2. **Xử lý `UnitWorkAssignment.collaboratorUserIds`**:
     - Đọc các dòng có `collaborator_user_ids IS NOT NULL`.
     - Phân tích mảng JSON, kiểm tra tính hợp lệ của từng `userId` trong bảng `users`.
     - Nạp vào `UnitWorkCollaborator`.
  3. **Xử lý `DocumentDirective.collaboratorIds` (Legacy)**:
     - Đọc các directive cũ.
     - Sử dụng hàm chuẩn hóa để bóc tách cả định dạng CSV lẫn JSON string.
     - Ánh xạ mã đơn vị cũ (`assignedDeptId` / `collaboratorIds`) sang `OrganizationalUnit.id` chuẩn tắc thông qua ma trận đối soát của RFC-02.
     - Gắn kết vào văn bản tương ứng.

*Kịch bản SQL minh họa cho quá trình Backfill dữ liệu JSONB sang bảng Join Model*:
```sql
-- Backfill DocumentCoordinatingUnit từ coordinating_unit_ids (JSONB)
INSERT INTO document_coordinating_units (id, workflow_id, unit_id, assigned_by_id, assigned_at)
SELECT 
    'bfill_' || substr(md5(random()::text), 1, 20),
    w.id,
    unit_elem.value::text,
    w.leader_id,
    COALESCE(w.directed_at, w.created_at)
FROM document_incoming_workflows w,
LATERAL jsonb_array_elements_text(w.coordinating_unit_ids) AS unit_elem(value)
JOIN organizational_units u ON u.id = unit_elem.value
ON CONFLICT (workflow_id, unit_id) DO NOTHING;

-- Backfill UnitWorkCollaborator từ collaborator_user_ids (JSONB)
INSERT INTO unit_work_collaborators (id, assignment_id, user_id, assigned_by_id, assigned_at)
SELECT 
    'bfill_' || substr(md5(random()::text), 1, 20),
    a.id,
    user_elem.value::text,
    a.assigned_by_id,
    a.created_at
FROM unit_work_assignments a,
LATERAL jsonb_array_elements_text(a.collaborator_user_ids) AS user_elem(value)
JOIN users usr ON usr.id = user_elem.value
ON CONFLICT (assignment_id, user_id) DO NOTHING;
```

### Bước 4: Giai đoạn Đối soát & Xác minh Đồng nhất (Parity Verification Phase)
- Triển khai kiểm tra tự động (Automated Consistency Check):
  - So sánh số lượng phần tử trong `coordinating_unit_ids` với số dòng trong `DocumentCoordinatingUnit` của từng workflow.
  - Kiểm tra xem có trường hợp nào phát sinh không khớp (Mismatch) giữa hai nguồn hay không.
  - Ghi nhận nhật ký kiểm toán đối soát vào bảng `audit_events`.

### Bước 5: Giai đoạn Chuyển đổi Đọc (Read Cutover Phase)
- Cập nhật các dịch vụ truy vấn và DTO mapping sang đọc trực tiếp từ bảng join model:
  - Cập nhật `listIncomingWorkflows` để hỗ trợ bộ lọc quan hệ:
    ```typescript
    if (filters.coordinatingUnitId) {
      where.coordinatingUnits = {
        some: { unitId: filters.coordinatingUnitId },
      };
    }
    ```
  - Cập nhật `document-classification.ts` để kiểm tra quyền tiếp cận văn bản dựa trên quan hệ thực thể:
    ```typescript
    const isCoordinatingUnitMember = doc.incomingWorkflow?.coordinatingUnits?.some(
      cu => userPrimaryUnitIds.includes(cu.unitId)
    );
    ```
  - Xóa bỏ hoàn toàn các đoạn mã parse phòng thủ (`parseCollaboratorIds`, regex, chuỗi cắt dán) trong `directive-pipeline.ts` và `task-policy.ts`.

### Bước 6: Giai đoạn Thu Hẹp & Khai Tử Cột Cũ (Contract Phase)
- Đánh dấu `@deprecated` trên các trường `coordinatingUnitIds`, `collaboratorUserIds` và `collaboratorIds`.
- Chấm dứt ghi vào các cột cũ (chuyển sang ghi đơn vào bảng Join Model).
- Trong các Phase bảo trì schema tiếp theo, tiến hành xóa bỏ các cột không sử dụng khỏi cơ sở dữ liệu (`ALTER TABLE ... DROP COLUMN`).

---

## 7. Khuyến Nghị Kiến Trúc & Quyết Định (Recommendation & Architectural Decision)

### 7.1 Khuyến nghị Cốt lõi của Nhóm Kiến trúc

1. **Thông qua Phương án A (Explicit Join Models)**:
   - Áp dụng cấu trúc bảng liên kết trung gian chuẩn hóa cho toàn bộ quy trình chỉ đạo 2 cấp của Nghị định 30/2020/NĐ-CP (`DocumentCoordinatingUnit` cho Tier 1 và `UnitWorkCollaborator` cho Tier 2).
   - Đây là giải pháp triệt để duy nhất bảo đảm tính toàn vẹn tham chiếu của RDBMS, triệt tiêu nguy cơ dữ liệu rác, tối ưu hóa triệt để hiệu năng truy vấn phân trang/lọc trên Bàn làm việc, và mở đường cho việc ghi nhận lịch sử phối hợp chính xác theo chuẩn hành chính nhà nước.

2. **Khai tử & Hợp nhất Dần `DocumentDirective.collaboratorIds`**:
   - Không đầu tư tạo bảng join riêng cho model legacy `DocumentDirective`.
   - Kết hợp kế hoạch triển khai của **ADR-004 (2-Tier Status Architecture)** và **ADR-006 (OrgUnit Consolidation)** để chuyển toàn bộ nghiệp vụ chỉ đạo của BGH sang `DocumentIncomingWorkflow`. Các bút phê cũ sẽ được coi là nhật ký lịch sử (read-only historical audit) và dần được thay thế bởi luồng 2 cấp chính quy.

3. **Chấm dứt Sự Nhập Nhằng giữa Mã Đơn Vị và Mã Người Dùng**:
   - Ban hành quy chuẩn định danh nghiêm ngặt: Quan hệ phối hợp cấp Trường là quan hệ giữa **Văn bản** và **Đơn vị tổ chức** (`OrganizationalUnit`), không bao giờ được gộp chung hoặc lưu nhầm với định danh cá nhân của **Người dùng** (`User`).
   - Sửa chữa ngay lập tức lỗi logic tại `document-classification.ts:306` trong quá trình triển khai mã nguồn của Phase 5.

---

## 8. Bảng Chữ Ký Thẩm Định (Decision Sign-Off Placeholder)

| Vai Trò Thẩm Định | Đại Diện / Chức Danh | Trạng Thái | Ngày Ký | Ghi Chú Ý Kiến |
|:---|:---|:---:|:---:|:---|
| **Technical Lead** | Lead Architect | APPROVED | 2026-09-22 | Đồng thuận áp dụng Phương án A. Yêu cầu tuân thủ nghiêm ngặt lộ trình Zero-Downtime 6 bước, không mutate schema trong phạm vi RFC. |
| **Domain Lead** | Quản lý Quy trình Văn thư | APPROVED | 2026-09-22 | Phù hợp hoàn toàn với quy chế phối hợp công tác theo Nghị định 30/2020/NĐ-CP và QĐ 282 của Nhà trường. |
| **Security & ReBAC Lead** | Kỹ sư An toàn & Phân quyền | APPROVED | 2026-09-22 | Xóa bỏ lỗ hổng rò rỉ phân quyền do so sánh nhầm giữa UnitId và UserId tại `document-classification.ts`. |
| **Database Administrator** | DBA Platform Team | APPROVED | 2026-09-22 | Loại bỏ hoàn toàn Full Table Scan trên các bảng nghiệp vụ lớn, chuyển sang truy vấn chỉ mục B-Tree chuẩn $O(\log N)$. |
