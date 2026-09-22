# RFC-04: Document Domain Layer Location Evaluation
(Đánh Giá & Lộ Trình Tái Cấu Trúc Phân Tầng Miền Xử Lý Văn Bản Sang src/domain/documents/)

- **Trạng thái**: PROPOSED (Đề xuất thẩm định tại Architecture Review Gate — Phase 5 / WI-5.2, Issue #70)
- **Ngày lập**: 2026-09-22
- **Tác giả**: Technical Architecture Working Group & Document Domain Modeling Team
- **Người thẩm định**: Owner & Tech Lead (Architecture Review Gate)
- **Tài liệu tham chiếu**:
  - `ADR-001: Single Canonical Maker-Checker Guard`
  - `ADR-002: Contextual Authorization Policy Engine (10-Step Pipeline)`
  - `ADR-003: Task Lifecycle with Derived Attention State`
  - `ADR-004: Document Status Two-Tier Sync — Administrative Status tự động đồng bộ từ Workflow Status`
  - `ADR-007: REST API Standard với Chuẩn Báo Lỗi RFC 9457 Problem Details`
  - `RFC-01: TaskAssignee to TaskActor Migration Strategy`
  - `RFC-02: Department to OrganizationalUnit Reconciliation Analysis`
  - `RFC-03: Delegation Consolidation Analysis`
  - `RFC-06: TaskScope vs TaskOriginLevel Boundary Analysis`
  - `docs/architecture/enterprise-product-architecture.md` (Mục Gap G9: Document FSM Outside Domain Layer)
  - `docs/architecture/implementation-plan-v1.md` (Mục Phase 5 / WI-5.2)
  - `Nghị định 30/2020/NĐ-CP` về Công tác văn thư
  - `Nghị định 68/2024/NĐ-CP` về Chữ ký số và dịch vụ tin cậy trong giao dịch điện tử

---

## 1. Tóm Tắt Thực Thi (Executive Summary)

Trong hệ thống quản trị điều hành tác nghiệp **QCET E-Office**, văn bản hành chính (`Document`: Văn bản đến, Văn bản đi, Tờ trình nội bộ) là thực thể pháp lý cao nhất, là nguồn phát sinh thẩm quyền chỉ đạo, giao việc và nghiệm thu công tác trong toàn Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.

Tuy nhiên, trong khi phân hệ Nhiệm vụ (`Task`) đã được thiết lập một tầng miền chuẩn tắc hoàn chỉnh tại `src/domain/tasks/` (tuân thủ chặt chẽ nguyên lý Domain-Driven Design và Clean Architecture: tách biệt hoàn toàn logic nghiệp vụ thuần túy khỏi cơ sở dữ liệu và framework), thì toàn bộ logic nghiệp vụ cốt lõi của phân hệ Văn bản hiện đang nằm rải rác trong thư mục tiện ích dùng chung **`src/lib/documents/`**. 

Hiện trạng này đã được xác định chính thức là món nợ kiến trúc **Gap G9 (Document FSM Outside Domain Layer)** trong tài liệu `docs/architecture/enterprise-product-architecture.md`:
> *"Task có full domain layer (`src/domain/tasks/`), nhưng Document FSM sống tại `src/lib/documents/state-machine.ts` — outside domain pattern."*

Kiểm toán mã nguồn tại `src/lib/documents/` cho thấy sự **trộn lẫn nghiêm trọng giữa 3 tầng kiến trúc** trong 7 tệp tin (tổng cộng 1.632 dòng mã):
1. **Quy tắc miền thuần túy (Pure Domain Invariants)**: Máy trạng thái văn bản đến/đi theo Nghị định 30/2020 và Nghị định 68/2024 (`state-machine.ts`), kiểm soát phân lập nhiệm vụ (Separation of Duties - SoD), tính bất biến của văn bản đã ký (`isDocumentImmutable`), thuật toán cấp số hiển thị (`formatDocumentDisplayNumber`), và kiểm tra tính hợp lệ của dữ liệu (`document-validator.ts`).
2. **Dịch vụ hạ tầng & Truy cập dữ liệu (Infrastructure & Data Access)**: Thao tác trực tiếp với cơ sở dữ liệu qua Prisma Client (`document-service.ts`), truy vấn giao dịch PostgreSQL atomic sequence (`numbering-engine.ts`), và thực thi quyền hạn lọc dữ liệu (`canReadDocument`).
3. **Tiện ích giao diện người dùng (UI Presentation Helpers)**: Bộ phân loại trạng thái hiển thị của thanh trạng thái bảng văn bản (`registry-state.ts`).

Tài liệu RFC này thực hiện kiểm toán toàn diện mã nguồn hiện tại, xác định chi tiết các đối tượng tiêu thụ (callers), đề xuất kiến trúc phân tầng mục tiêu đưa logic miền thuần túy về **`src/domain/documents/`** và dịch vụ ứng dụng/hạ tầng về **`src/server/documents/`**, đồng thời vạch ra chiến lược chuyển đổi 5 pha sử dụng **Re-export Facades Pattern** đảm bảo không gây gián đoạn hệ thống (Zero-Downtime), không làm vỡ dev server hay hỏng cache biên dịch.

---

## 2. Bối Cảnh & Đặt Vấn Đề (Context & Problem Statement)

### 2.1 Lịch Sử Phát Triển & Nguồn Gốc Phân Bố Mã Nguồn

Hệ thống quản lý văn bản của QCET E-Office trải qua quá trình phát triển nhanh chóng để đáp ứng yêu cầu số hóa hành chính:
- **Giai đoạn đầu (Phase 0 / Sprint 2)**: Nhóm phát triển ban đầu tạo thư mục `src/lib/documents/` với mục đích làm nơi chứa các hàm tiện ích (utilities) hỗ trợ các API routes cơ bản (`/api/documents`). Trong giai đoạn này, các khái niệm về Clean Architecture chưa được phân định rõ ràng giữa tầng miền (`domain`) và tầng tiện ích chung (`lib`).
- **Giai đoạn chuẩn hóa quy trình (Sprint 5 Cutover)**: Nhóm kỹ thuật bổ sung máy trạng thái chuẩn mực theo Nghị định 30/2020/NĐ-CP và Nghị định 68/2024/NĐ-CP, cơ chế kiểm soát phân lập nhiệm vụ SoD, kiểm soát tính bất biến khi ký số, và cơ chế cấp số tự động nguyên tử. Tuy nhiên, thay vì tạo mới một tầng miền chuẩn tắc tại `src/domain/documents/` tương tự như `src/domain/tasks/`, toàn bộ logic nâng cao này tiếp tục được nhồi nhét vào `src/lib/documents/`.
- **Giai đoạn ReBAC & Two-Tier Sync (Phase 4 - Phase 5)**: Khi áp dụng kiến trúc phân quyền ngữ cảnh (ADR-002) và đồng bộ trạng thái 2 tầng (ADR-004), hệ thống tiếp tục bổ sung các dịch vụ độc lập như `src/lib/services/incoming-document-service.ts` và `src/lib/services/outgoing-document-service.ts`, trong khi `src/lib/documents/document-service.ts` vẫn phục vụ các endpoint CRUD cũ. Điều này dẫn đến sự phân mảnh cấu trúc và nhập nhằng ranh giới trách nhiệm.

### 2.2 Năm Khiếm Khuyết Kiến Trúc Cốt Lõi (Core Architectural Deficiencies)

#### Khiếm khuyết 1: Vi phạm Nguyên lý Nghịch đảo Phụ thuộc (Domain Inversion & Leakage)
Theo nguyên lý Clean Architecture và Domain-Driven Design (DDD), **Tầng Miền (Domain Layer)** phải là hạt nhân độc lập nhất của hệ thống, chỉ chứa các quy tắc nghiệp vụ thuần túy (Enterprise Business Rules), không được phụ thuộc vào bất kỳ thư viện ngoài, cơ sở dữ liệu, framework web hay chi tiết hạ tầng nào.
Hiện tại, logic cốt lõi của văn bản lại nằm trong `src/lib/` — một thư mục vốn dành cho các thư viện tiện ích (utility libraries) như `format.ts`, `prisma.ts`, `utils.ts`. Việc đặt quy tắc nghiệp vụ thể chế của nhà trường vào `lib` làm lu mờ ranh giới kiến trúc và khiến các lập trình viên mới dễ dàng đưa các phụ thuộc hạ tầng vào tầng miền.

#### Khiếm khuyết 2: Ghép nối Chặt Chẽ với Lớp Lỗi Máy Chủ (`@/server/api/errors`)
Trong `src/lib/documents/state-machine.ts`:
```typescript
import { InvalidTransitionError, ValidationError, ForbiddenError } from "@/server/api/errors";
```
Máy trạng thái `IncomingDocumentStateMachine` và `OutgoingDocumentStateMachine` trực tiếp throw các ngoại lệ thuộc tầng Server API (`InvalidTransitionError`, `ForbiddenError`, `ValidationError`). 
Hệ quả:
- Logic máy trạng thái không thể được tái sử dụng trên môi trường Client UI (ví dụ: hiển thị trước các nút hành động khả dụng trên giao diện văn thư hoặc vô hiệu hóa các nút chuyển trạng thái không hợp lệ) mà không kéo theo toàn bộ mã nguồn của tầng máy chủ.
- Kiểm thử đơn vị (Unit Test) cho máy trạng thái không thể chạy hoàn toàn độc lập mà bị phụ thuộc vào định nghĩa lỗi HTTP/API của máy chủ.

#### Khiếm khuyết 3: Sự Trộn Lẫn Giữa Thuật Toán Miền và Thao Tác Cơ Sở Dữ Liệu trong `numbering-engine.ts`
Trong `src/lib/documents/numbering-engine.ts` (226 dòng):
- **Thuật toán miền thuần túy**: Hàm `formatDocumentDisplayNumber()` (định dạng số văn bản theo Điều 10 NĐ 30/2020: `"01"`, `"89/CĐKTCN-ĐT"`, `"TT-5/2026"`), hàm `generateDocumentCode()` (mã định danh nội bộ: `"VBDEN-2026-0001"`), và `simulateAtomicNumbering()` (mô phỏng bộ đếm trong bộ nhớ).
- **Thao tác hạ tầng cơ sở dữ liệu**: Hàm `getNextRegistrationNumber()` và `getNextRegistrationNumberRawSql()` trực tiếp nhập `prisma` từ `@/lib/prisma`, thực hiện truy vấn raw SQL `UPDATE document_number_sequences`, quản lý khóa bi quan/lạc quan và mở transaction `db.$transaction`.
Việc đặt chung hai trách nhiệm này vào một tệp tin khiến các thành phần chỉ cần định dạng số văn bản (như export Excel hoặc hiển thị UI) buộc phải nạp cả module kết nối cơ sở dữ liệu Prisma!

#### Khiếm khuyết 4: Lạc Chỗ Tiện Ích Trạng Thái Giao Diện (`registry-state.ts`)
Tệp `src/lib/documents/registry-state.ts` (20 dòng) chỉ định nghĩa hàm `getRegistryStateKind()` nhận vào `isLoading`, `hasError`, `itemCount` để trả về `loading | error | empty | data` cho component React `src/components/documents/document-registry-view.tsx`.
Một hàm thuần túy hỗ trợ render UI lại nằm chung thư mục với dịch vụ truy vấn cơ sở dữ liệu và máy trạng thái thể chế, gây ô nhiễm không gian tên của phân hệ văn bản.

#### Khiếm khuyết 5: Sự Bất Đối Xứng Kiến Trúc Giữa Các Phân Hệ Cốt Lõi
Hệ thống QCET E-Office quản lý 2 trục tác nghiệp chính: **Nhiệm vụ (`Task`)** và **Văn bản (`Document`)**.
- Phân hệ Task được tổ chức bài bản:
  - `src/domain/tasks/`: Chứa state machine, types, mappers, semantics, deadlines, remediation (100% không phụ thuộc Prisma hay Server).
  - `src/server/tasks/`: Chứa command service, query service, policy service.
- Phân hệ Document bị phân mảnh:
  - Không hề có thư mục `src/domain/documents/`!
  - `src/lib/documents/`: Chứa cả state machine, validator, service, numbering, excel export, UI state.
  - `src/lib/services/`: Chứa `incoming-document-service.ts` và `outgoing-document-service.ts`.
  - `src/server/policies/`: Chứa `document-policy.ts`.
  - `src/lib/`: Chứa facade `document-numbering.ts`.
Sự bất đối xứng này tạo ra gánh nặng nhận thức (cognitive load) lớn cho đội ngũ kỹ sư và đi ngược lại tiêu chuẩn phát triển nhất quán của dự án.

---

## 3. Kiểm Toán Toàn Diện Sự Phụ Thuộc & Đối Tượng Sử Dụng (Dependency & Consumer Audit)

### 3.1 Bản Kê Chi Tiết Các Tệp Tin Trong `src/lib/documents/`

Hiện tại, thư mục `src/lib/documents/` chứa 7 tệp tin với tổng cộng **1.632 dòng mã**. Dưới đây là bảng phân tích chi tiết từng tệp:

| Tệp tin | Số dòng | Trách nhiệm hiện tại | Phụ thuộc đầu vào (Imports) | Bản chất kiến trúc thực tế |
|---|---|---|---|---|
| `state-machine.ts` | 320 LOC | Định nghĩa FSM văn bản đến (10 trạng thái) & văn bản đi (10 trạng thái); Ràng buộc SoD; Kiểm tra tính bất biến (`isDocumentImmutable`). | `@prisma/client`, `@/server/api/errors` | **Pure Domain Logic** (nhưng bị ô nhiễm bởi Server Error classes) |
| `directive-pipeline.ts` | 156 LOC | Ánh xạ độ khẩn văn bản sang độ ưu tiên nhiệm vụ; Phân tích danh sách đơn vị phối hợp; Chuyển đổi bút phê BGH thành nhiệm vụ cấp trường (`GeneratedTaskPayload`). | `@/types/document`, `@/types/workspace`, `@/lib/format` | **Domain Translation Service** (Anti-Corruption Layer giữa Document và Task) |
| `numbering-engine.ts` | 226 LOC | Định dạng số ký hiệu văn bản (NĐ 30/2020); Sinh mã định danh nội bộ; Truy vấn cấp số liên tục nguyên tử trong DB qua Prisma/SQL. | `@/lib/prisma`, `@/types/document` | **Hỗn hợp (Mixed)**: Thuật toán định dạng là Pure Domain; Cấp số qua DB là Infrastructure Service |
| `document-validator.ts` | 280 LOC | Kiểm tra tính hợp lệ của dữ liệu tạo mới văn bản, bút phê lãnh đạo; Bảo vệ các trường bất biến và trường kiểm soát bởi workflow (`FORBIDDEN_PATCH_FIELDS`). | `@/types/document` | **Pure Domain Invariants & Rules** (100% không phụ thuộc hạ tầng) |
| `document-service.ts` | 495 LOC | Dịch vụ CRUD văn bản tổng quát; Tích hợp phân quyền đọc (`canReadDocument`); Truy vấn phân trang, t��m kiếm; Điều phối lưu trữ đính kèm và bút phê. | `@prisma/client`, `@/lib/prisma`, `@/types/document`, `@/server/api/request-context`, `@/server/authorization/*`, `@/server/policies/*`, `@/server/api/errors`, `./numbering-engine`, `./state-machine` | **Application & Infrastructure Service** (Tầng ứng dụng / Data Access) |
| `excel-export.ts` | 135 LOC | Định dạng tiêu đề cột Sổ đăng ký văn bản đến/đi theo Phụ lục IV NĐ 30/2020; Định dạng ngày tháng; Sinh chuỗi CSV chuẩn RFC 4180. | `@/types/document` | **Domain Presentation / Specification** (Quy chuẩn xuất bản thể thức NĐ 30) |
| `registry-state.ts` | 20 LOC | Hàm phân loại trạng thái hiển thị của Sổ văn bản (`loading`, `error`, `empty`, `data`). | Không có | **UI Presentation Helper** (Chỉ phục vụ Client Component) |

### 3.2 Ma Trận Đối Tượng Tiêu Thụ Ngoại Vi (External Consumer Matrix)

Kiểm toán toàn bộ codebase xác định chính xác các điểm gọi (callers) phụ thuộc vào `src/lib/documents/`:

```
                                  +-------------------------------------------------+
                                  |                API ROUTE HANDLERS               |
                                  | src/app/api/documents/route.ts                  |
                                  | src/app/api/documents/[id]/route.ts             |
                                  | src/app/api/documents/[id]/directives/route.ts  |
                                  | src/app/api/documents/export-excel/route.ts     |
                                  +-------------------------------------------------+
                                       |          |              |          |
                                       v          |              v          v
+-------------------------------+  +-----------+  |        +-----------+  +--------------+
| SERVER POLICIES & SERVICES    |  | document- |  |        | directive-|  | excel-       |
| document-policy.ts            |  | service.ts|  |        | pipeline  |  | export.ts    |
| incoming-document-service.ts  |  +-----------+  |        +-----------+  +--------------+
| outgoing-document-service.ts  |       |         |              |              |
+-------------------------------+       |         v              v              v
               |                        |   +------------------------------------+
               +----------------------->|   |        src/lib/documents/          |
               |                        |   |                                    |
               v                        +-->|  state-machine.ts                  |
+-------------------------------+           |  document-validator.ts             |
| UI COMPONENTS                 |           |  numbering-engine.ts               |
| document-registry-view.tsx    |---------->|  registry-state.ts                 |
+-------------------------------+           +------------------------------------+
               ^                                      ^
               |                                      |
+-------------------------------+                     |
| TESTS & FACADES               |                     |
| tests/document-*.test.ts      |---------------------+
| src/lib/document-numbering.ts |
+-------------------------------+
```

#### Chi tiết các đối tượng tiêu thụ theo nhóm:

1. **Nhóm API Routes (`src/app/api/documents/`)**:
   - `src/app/api/documents/route.ts`:
     - Nhập `listDocuments`, `createDocument` từ `@/lib/documents/document-service`
     - Nhập `validateDocumentCreatePayload` từ `@/lib/documents/document-validator`
   - `src/app/api/documents/[id]/route.ts`:
     - Nhập `getDocumentById`, `updateDocument`, `deleteDocument` từ `@/lib/documents/document-service`
     - Nhập `isDocumentImmutable` từ `@/lib/documents/state-machine`
     - Nhập `validateDocumentUpdatePayload` từ `@/lib/documents/document-validator`
   - `src/app/api/documents/[id]/directives/route.ts`:
     - Nhập `getDocumentById` từ `@/lib/documents/document-service`
     - Nhập `executeDirectivePipeline`, `mapDirectiveToSchoolTask` từ `@/lib/documents/directive-pipeline`
     - Nhập `validateDirectivePayload` từ `@/lib/documents/document-validator`
   - `src/app/api/documents/export-excel/route.ts`:
     - Nhập `listDocuments` từ `@/lib/documents/document-service`
     - Nhập `generateAppendixIVCsv` từ `@/lib/documents/excel-export`

2. **Nhóm Server Policies & Lifecycle Services (`src/server/` & `src/lib/services/`)**:
   - `src/server/policies/document-policy.ts`:
     - Nhập `isDocumentImmutable` từ `@/lib/documents/state-machine` (dùng để chặn quyền sửa/xóa văn bản đã ký hoặc ban hành).
   - `src/lib/services/incoming-document-service.ts`:
     - Nhập `getNextRegistrationNumber` từ `@/lib/documents/numbering-engine`
     - Nhập `IncomingDocumentStateMachine` từ `@/lib/documents/state-machine`
   - `src/lib/services/outgoing-document-service.ts`:
     - Nhập `getNextRegistrationNumber` từ `@/lib/documents/numbering-engine`
     - Nhập `OutgoingDocumentStateMachine`, `isDocumentImmutable` từ `@/lib/documents/state-machine`

3. **Nhóm Facade Trung Gian (`src/lib/`)**:
   - `src/lib/document-numbering.ts`:
     - Re-export toàn bộ: `formatDocumentDisplayNumber`, `formatRegistrationNumber`, `generateDocumentCode`, `simulateAtomicNumbering`, `getNextRegistrationNumber`, `getNextRegistrationNumberRawSql`, `getNextDocumentSequence`, `resetDocumentMemorySequences` từ `./documents/numbering-engine`.
     - Phục vụ các caller như `tests/atomic-sequence-generation.test.ts` và `tests/database-architecture-hardening.test.ts`.

4. **Nhóm Giao Diện Người Dùng (`src/components/documents/`)**:
   - `src/components/documents/document-registry-view.tsx`:
     - Nhập `getRegistryStateKind` từ `@/lib/documents/registry-state` (dòng 39).

5. **Nhóm Kiểm Thử Tự Động (`tests/`)**:
   - `tests/document-api-routes.test.ts`: Gọi `document-validator`, `document-service`.
   - `tests/document-v2-workflow.test.ts`: Gọi `state-machine`, `numbering-engine`, `document-validator`.
   - `tests/document-numbering.test.ts`: Gọi `numbering-engine`, `document-service`, `registry-state`.
   - `tests/document-directive-pipeline.test.ts`: Gọi `directive-pipeline`.
   - `tests/document-excel-export.test.ts`: Gọi `excel-export`, `numbering-engine`, `directive-pipeline`.

---

## 4. Kiến Trúc Phân Tầng Mục Tiêu Đề Xuất (Proposed Target Architecture)

Để giải quyết triệt để các khiếm khuyết trên và đồng bộ với phân hệ `src/domain/tasks/`, kiến trúc mới sẽ phân rã thành 3 tầng chức năng độc lập theo chuẩn Clean Architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      TẦNG GIAO DIỆN (UI LAYER)                         │
│  src/components/documents/registry-state.ts (UI view-state helper)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│              TẦNG DỊCH VỤ ỨNG DỤNG & HẠ TẦNG (SERVER SERVICES)          │
│                    src/server/documents/                               │
│  - document-query-service.ts     : Truy vấn, phân trang, lọc ACL       │
│  - document-command-service.ts   : Ghi dữ liệu, mutation, transaction   │
│  - numbering-service.ts          : Cấp số nguyên tử từ PostgreSQL      │
│  - incoming-workflow-service.ts  : Vòng đời văn bản đến (NĐ 30/2020)   │
│  - outgoing-workflow-service.ts  : Vòng đời văn bản đi (NĐ 68/2024)    │
│  - index.ts                      : Re-export chuẩn tắc cho backend     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (chỉ phụ thuộc một chiều)
┌───────────────────────────────────▼────────────────────────────────────┐
│                 TẦNG MIỀN THUẦN TÚY (PURE DOMAIN LAYER)                │
│                    src/domain/documents/                               │
│  - state-machine.ts       : FSM thuần túy, chuyển trạng thái, SoD,     │
│                             immutability checks (Zero Server/DB deps)  │
│  - numbering.ts           : Thuật toán định dạng số ký hiệu, sinh mã   │
│  - validators.ts          : Luật thẩm định dữ liệu & bất biến (NĐ 30)  │
│  - directive-pipeline.ts  : Ánh xạ bút phê sang nhiệm vụ (ACL Domain)  │
│  - export.ts              : Đặc tả Sổ văn bản Phụ lục IV NĐ 30         │
│  - types.ts / contract.ts : Thực thể miền, interface, domain status    │
│  - errors.ts              : Domain error types chuẩn hóa               │
│  - index.ts               : Re-export chuẩn tắc cho toàn hệ thống      │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Chi Tiết Tầng Miền Thuần Túy: `src/domain/documents/`

**Nguyên tắc tối thượng**: Tầng này **TUYỆT ĐỐI KHÔNG** import từ `@prisma/client`, `@/lib/prisma`, `next/*`, hoặc `@/server/*`. Mọi logic đều là pure functions hoặc in-memory state machines có tính xác định (deterministic).

1. **`src/domain/documents/state-machine.ts`**:
   - Di chuyển toàn bộ bảng chuyển trạng thái `INCOMING_DOCUMENT_TRANSITIONS` và `OUTGOING_DOCUMENT_TRANSITIONS`.
   - Các class `IncomingDocumentStateMachine` và `OutgoingDocumentStateMachine`.
   - **Tái cấu trúc quan trọng**: Thay vì throw trực tiếp `InvalidTransitionError` và `ForbiddenError` của tầng server, chuyển đổi sang trả về kết quả kiểu đối tượng kết quả miền (Domain Result Object) tương tự như `src/domain/tasks/state-machine.ts`:
     ```typescript
     export interface DocumentTransitionResult {
       allowed: boolean;
       reason?: string;
       code?: string;
     }
     ```
     Đồng thời cung cấp hàm `assertTransition()` ném ra `DocumentDomainError` độc lập, cho phép tầng server bắt và ánh xạ sang mã lỗi RFC 9457 HTTP tương ứng.
   - Hàm `isDocumentImmutable(doc: DocumentImmutabilityTarget): boolean`.
   - Hàm `assertDocumentNotImmutable()`.
   - Các hàm kiểm tra phân lập nhiệm vụ (SoD): `assertDrafterNotContentReviewer`, `assertSignerNotNumberer`, `assertSignerNotOrganizationSigner`.

2. **`src/domain/documents/numbering.ts`**:
   - Trích xuất toàn bộ logic định dạng và sinh mã độc lập khỏi `numbering-engine.ts`:
     - `formatDocumentDisplayNumber(type, num, year, departmentCode): string`
     - `formatRegistrationNumber` (alias)
     - `generateDocumentCode(type, year, num): string`
     - `simulateAtomicNumbering(type, year, storage?): Promise<number>`
     - `resetDocumentMemorySequences(): void`
   - Module này có thể được chạy ở cả Server, Edge Runtime, Browser hoặc CLI mà không cần cài đặt driver cơ sở dữ liệu.

3. **`src/domain/documents/validators.ts`**:
   - Chuyển toàn bộ nội dung từ `src/lib/documents/document-validator.ts`:
     - `validateDocumentCreatePayload(payload)`
     - `validateDirectivePayload(payload)`
     - `validateDocumentUpdatePayload(payload)`
     - `FORBIDDEN_PATCH_FIELDS`, `ALLOWED_DOCUMENT_UPDATE_FIELDS`
     - `isWorkflowControlledField(fieldName)`

4. **`src/domain/documents/directive-pipeline.ts`**:
   - Chuyển toàn bộ logic ánh xạ từ `src/lib/documents/directive-pipeline.ts`:
     - `mapUrgencyToTaskPriority(urgency)`
     - `parseCollaboratorIds(raw)`
     - `mapDirectiveToSchoolTask(doc, directive)`
     - `executeDirectivePipeline(doc, directive, taskCreator)` (Higher-order function nhận delegate lưu trữ nhiệm vụ).

5. **`src/domain/documents/export.ts`**:
   - Chuyển toàn bộ nội dung từ `src/lib/documents/excel-export.ts`:
     - `getAppendixIVHeaders(type)`
     - `formatDate(isoStr)`
     - `generateAppendixIVCsv(documents, type)`

6. **`src/domain/documents/types.ts` & `contract.ts`**:
   - Định nghĩa các enum và type chuẩn tắc của văn bản: `DocumentType`, `DocumentUrgency`, `DocumentSecurityLevel`, `DocumentStatus`, `IncomingDocumentStatus`, `OutgoingDocumentStatus`.
   - Nhờ đó, tầng miền không còn phải import enum từ `@prisma/client`.

7. **`src/domain/documents/index.ts`**:
   - Canonical barrel export cho toàn bộ phân hệ Document Domain:
     ```typescript
     export * from "./types";
     export * from "./state-machine";
     export * from "./numbering";
     export * from "./validators";
     export * from "./directive-pipeline";
     export * from "./export";
     ```

### 4.2 Chi Tiết Tầng Dịch Vụ Ứng Dụng & Hạ Tầng: `src/server/documents/`

Tầng này chịu trách nhiệm tương tác với cơ sở dữ liệu Prisma, quản lý transaction, kiểm tra thẩm quyền ReBAC, và phát outbox event.

1. **`src/server/documents/numbering-service.ts`**:
   - Trích xuất logic tương tác cơ sở dữ liệu từ `src/lib/documents/numbering-engine.ts`:
     - `getNextRegistrationNumber(type, year, client?, options?)`: Sử dụng PostgreSQL sequence hoặc bảng `DocumentNumberSequence` trong Prisma transaction.
     - `getNextRegistrationNumberRawSql(type, year, client?)`: Truy vấn raw SQL atomic increment.
     - `getNextDocumentSequence(...)`.
   - Phụ thuộc: Nhập `prisma` từ `@/lib/prisma` và các hàm format từ `@/domain/documents/numbering`.

2. **`src/server/documents/document-query-service.ts`**:
   - Trích xuất các hàm đọc từ `document-service.ts`:
     - `getDocumentById(id, userContext?, db?)`
     - `listDocuments(filter?, db?)`
     - Tích hợp `buildDocumentReadWhere` từ `@/server/policies/document-policy`.

3. **`src/server/documents/document-command-service.ts`**:
   - Trích xuất các hàm ghi từ `document-service.ts`:
     - `createDocument(payload, db?)`: Gọi `getNextRegistrationNumber` từ `numbering-service.ts` và `validateDocumentCreatePayload` từ `@/domain/documents/validators`.
     - `updateDocument(id, payload, userContext?, db?)`: Gọi `assertDocumentNotImmutable` từ `@/domain/documents/state-machine` và `validateDocumentUpdatePayload`.
     - `deleteDocument(id, userContext?, db?)`: Kiểm tra tính bất biến và xóa mềm/xóa cứng.

4. **`src/server/documents/incoming-workflow-service.ts` & `outgoing-workflow-service.ts`**:
   - Hợp nhất và chuẩn hóa lộ trình từ `src/lib/services/incoming-document-service.ts` và `src/lib/services/outgoing-document-service.ts`.
   - Đảm bảo thực thi nguyên tắc đồng bộ trạng thái 2 tầng theo **ADR-004** (`DocumentStatusTwoTierSync`).

### 4.3 Tái Bố Trí Tiện Ích Giao Diện Người Dùng (UI Presentation Helper)

- Tệp `src/lib/documents/registry-state.ts` sẽ được chuyển về vị trí tự nhiên của nó tại:
  **`src/components/documents/registry-state.ts`**
  hoặc được export từ `src/components/documents/index.ts`.
- Tệp này chỉ phục vụ hiển thị trên view `DocumentRegistryView`, hoàn toàn không có vai trò nghiệp vụ phía máy chủ hay miền dữ liệu.

---

## 5. Chiến Lược Di Chuyển & Re-export Facades (Zero-Downtime Migration Strategy)

### 5.1 Nguyên Tắc Vận Hành "Không Gián Đoạn" (Zero-Downtime & Zero-Breakage)

Việc tái cấu trúc một phân hệ lớn như Document có nguy cơ gây lỗi biên dịch hoặc gián đoạn phiên làm việc của dev server nếu thực hiện di chuyển tệp tin (file move) đột ngột.
Để đảm bảo an toàn tuyệt đối, dự án áp dụng **Quy tắc Bắt buộc**:
1. **Bảo toàn giao diện tương thích ngược 100% (100% Backward Compatibility)**: Mọi đường dẫn import cũ (`@/lib/documents/*`, `@/lib/document-numbering`) phải tiếp tục hoạt động mà không gây lỗi TypeScript hay runtime error.
2. **Tuân thủ nghiêm ngặt Quy chuẩn Xác thực (`.claude/rules/verification.md`)**: Tuyệt đối không chạy `next build` / `npm run build` gây crash dev server và hỏng thư mục `.next/`. Xác thực bằng `npm run typecheck`, `npm run lint`, và các test suites chuyên biệt.
3. **Mô hình Expand & Contract qua Re-export Facades**: Tạo cấu trúc mới trước, biến cấu trúc cũ thành facade chuyển tiếp, sau đó di chuyển các caller theo từng pha độc lập.

### 5.2 Thiết Kế Các Re-export Facades Tại `src/lib/documents/`

Các tệp tin hiện tại trong `src/lib/documents/` sẽ được giữ lại làm các **Facade Modules** mỏng, chỉ thực hiện nhiệm vụ re-export:

1. **`src/lib/documents/state-machine.ts` (Facade)**:
   ```typescript
   /**
    * @deprecated Re-exported from @/domain/documents/state-machine.
    * Please update your imports to use the canonical domain path.
    */
   export * from "@/domain/documents/state-machine";
   ```

2. **`src/lib/documents/directive-pipeline.ts` (Facade)**:
   ```typescript
   /**
    * @deprecated Re-exported from @/domain/documents/directive-pipeline.
    */
   export * from "@/domain/documents/directive-pipeline";
   ```

3. **`src/lib/documents/document-validator.ts` (Facade)**:
   ```typescript
   /**
    * @deprecated Re-exported from @/domain/documents/validators.
    */
   export * from "@/domain/documents/validators";
   ```

4. **`src/lib/documents/excel-export.ts` (Facade)**:
   ```typescript
   /**
    * @deprecated Re-exported from @/domain/documents/export.
    */
   export * from "@/domain/documents/export";
   ```

5. **`src/lib/documents/registry-state.ts` (Facade)**:
   ```typescript
   /**
    * @deprecated Re-exported from @/components/documents/registry-state.
    */
   export * from "@/components/documents/registry-state";
   ```

6. **`src/lib/documents/numbering-engine.ts` (Composite Facade)**:
   ```typescript
   /**
    * @deprecated Re-exports formatting algorithms from @/domain/documents/numbering
    * and database sequence operations from @/server/documents/numbering-service.
    */
   export {
     formatDocumentDisplayNumber,
     formatRegistrationNumber,
     generateDocumentCode,
     simulateAtomicNumbering,
     resetDocumentMemorySequences,
   } from "@/domain/documents/numbering";

   export {
     getNextRegistrationNumber,
     getNextRegistrationNumberRawSql,
     getNextDocumentSequence,
     type DocumentNumberingOptions,
   } from "@/server/documents/numbering-service";
   ```

7. **`src/lib/documents/document-service.ts` (Facade)**:
   ```typescript
   /**
    * @deprecated Re-exported from @/server/documents/document-service.
    */
   export * from "@/server/documents/document-service";
   ```

8. **`src/lib/document-numbering.ts` (Facade Cấp Cao)**:
   ```typescript
   /**
    * Document Numbering Facade (ND 30/2020/ND-CP)
    * Canonical entry point preserved for backward compatibility.
    */
   export * from "@/domain/documents/numbering";
   export * from "@/server/documents/numbering-service";
   ```

### 5.3 Lộ Trình Triển Khai 5 Pha (5-Phase Phased Migration Roadmap)

Quá trình triển khai vật lý sẽ được thực thi trong Work Item tiếp theo (WI-5.2 Implementation PR) theo lộ trình 5 pha rõ ràng:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHA 1: KHỞI TẠO TẦNG MIỀN THUẦN TÚY (PURE DOMAIN SCAFFOLDING)          │
│ - Tạo src/domain/documents/ (types, state-machine, numbering,           │
│   validators, directive-pipeline, export, index.ts)                     │
│ - Đảm bảo zero external dependencies (no Prisma, no Server errors)      │
│ - Bổ sung unit tests độc lập tại tests/domain/documents/                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ PHA 2: KHỞI TẠO DỊCH VỤ HẠ TẦNG MÁY CHỦ (SERVER SERVICES SCAFFOLDING)   │
│ - Tạo src/server/documents/ (numbering-service, query, command, index)  │
│ - Chuyển giao logic DB sequence và CRUD query/mutation                  │
│ - Tích hợp chính sách phân quyền ReBAC và audit logging                 │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ PHA 3: THIẾT LẬP RE-EXPORT FACADES (BACKWARD-COMPATIBILITY SHIMS)      │
│ - Chuyển toàn bộ các tệp tại src/lib/documents/* thành Facades          │
│ - Cập nhật src/lib/document-numbering.ts thành Facade                   │
│ - Chạy `npm run typecheck` & test suite: 100% test cũ phải PASS          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ PHA 4: DI CHUYỂN CÁC CALLER THEO TỪNG NHÓM (CALLER MIGRATION)           │
│ - Nhóm 1: API Routes (src/app/api/documents/*)                          │
│ - Nhóm 2: Server Services (incoming/outgoing document services)         │
│ - Nhóm 3: UI Components (document-registry-view.tsx)                    │
│ - Nhóm 4: Test Suites (tests/document-*.test.ts)                        │
│ - Kiểm tra liên tục bằng `npm run typecheck` sau mỗi nhóm                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ PHA 5: ĐÁNH DẤU DEPRECATION & KHÓA RÀO CHẮN LINT (CONTRACT PHASE)       │
│ - Thêm chú thích @deprecated kèm cảnh báo TSDoc                         │
│ - Cấu hình ESLint rule cấm import mới từ @/lib/documents                │
│ - Cập nhật tài liệu kiến trúc hệ thống (enterprise-product-arch)        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Kế Hoạch Kiểm Thử, Xác Thực & Phục Hồi (Verification & Rollback Plan)

### 6.1 Quy Chuẩn Kiểm Tra Bắt Buộc (Verification Protocol)

Nhằm đảm bảo an toàn tuyệt đối cho môi trường dev server theo đúng quy định tại `.claude/rules/verification.md`:
- **NGHIÊM CẤM**:
  ```bash
  # TUYỆT ĐỐI KHÔNG CHẠY TRONG QUÁ TRÌNH KIỂM TRA
  npm run build
  next build
  ```
- **CÁC LỆNH KIỂM TRA THAY THẾ CHUẨN MỰC**:
  ```bash
  # 1. Kiểm tra toàn vẹn kiểu dữ liệu tĩnh (Type-safety)
  npm run typecheck

  # 2. Kiểm tra quy chuẩn mã nguồn và linter
  npm run lint

  # 3. Chạy toàn bộ các bài kiểm thử liên quan đến phân hệ văn bản
  npx tsx --test tests/document-api-routes.test.ts
  npx tsx --test tests/document-directive-pipeline.test.ts
  npx tsx --test tests/document-excel-export.test.ts
  npx tsx --test tests/document-numbering.test.ts
  npx tsx --test tests/document-v2-workflow.test.ts
  npx tsx --test tests/database-architecture-hardening.test.ts
  npx tsx --test tests/atomic-sequence-generation.test.ts

  # 4. Pipeline kiểm tra đầy đủ an toàn (nếu cần)
  npm run verify
  ```

### 6.2 Ma Trận Xác Thực Đẳng Cấu (Parity Verification Matrix)

Trước khi đóng Work Item triển khai thực tế, cần đối chiếu bảng đối chiếu đẳng cấu (Parity Checklist) giữa các hàm cũ và mới:

| Ký hiệu xuất bản (Exported Symbol) | Vị trí cũ (`src/lib/documents/`) | Vị trí mới chuẩn tắc | Kiểm tra tương thích kiểu |
|---|---|---|---|
| `IncomingDocumentStateMachine` | `state-machine.ts` | `@/domain/documents/state-machine` | Khớp 100% chữ ký hàm `canTransition`, `assertTransition`, `isFinalized` |
| `OutgoingDocumentStateMachine` | `state-machine.ts` | `@/domain/documents/state-machine` | Khớp 100% chữ ký hàm FSM và các assertion SoD |
| `isDocumentImmutable` | `state-machine.ts` | `@/domain/documents/state-machine` | Khớp 100% input `DocumentImmutabilityTarget` |
| `formatDocumentDisplayNumber` | `numbering-engine.ts` | `@/domain/documents/numbering` | Khớp 100% logic định dạng NĐ 30/2020 |
| `generateDocumentCode` | `numbering-engine.ts` | `@/domain/documents/numbering` | Khớp 100% cấu trúc tiền tố VBDEN/VBDI/TTNB |
| `getNextRegistrationNumber` | `numbering-engine.ts` | `@/server/documents/numbering-service` | Khớp 100% hỗ trợ transaction client và raw SQL |
| `validateDocumentCreatePayload` | `document-validator.ts` | `@/domain/documents/validators` | Khớp 100% danh sách lỗi và luật kiểm tra |
| `FORBIDDEN_PATCH_FIELDS` | `document-validator.ts` | `@/domain/documents/validators` | Khớp 100% danh sách trường bất biến |
| `mapDirectiveToSchoolTask` | `directive-pipeline.ts` | `@/domain/documents/directive-pipeline` | Khớp 100% interface `GeneratedTaskPayload` |
| `generateAppendixIVCsv` | `excel-export.ts` | `@/domain/documents/export` | Khớp 100% định dạng xuất bản Phụ lục IV |
| `getRegistryStateKind` | `registry-state.ts` | `@/components/documents/registry-state` | Khớp 100% type `RegistryStateKind` |

### 6.3 Kế Hoạch Phục Hồi An Toàn (Rollback Playbook)

Do toàn bộ quá trình tái cấu trúc sử dụng mẫu thiết kế Re-export Facades và không thực hiện thay đổi lược đồ cơ sở dữ liệu (`prisma/schema.prisma` giữ nguyên):
1. **Rủi ro lỗi tại tầng gọi (Caller Regression)**:
   - Nếu bất kỳ API route hoặc service nào gặp lỗi sau khi đổi đường dẫn import, chỉ cần revert tệp tin caller đó về import từ `@/lib/documents/*` (vì facade vẫn luôn tồn tại và hoạt động).
2. **Rủi ro lỗi tại tầng facade (Shim Failure)**:
   - Trong trường hợp xấu nhất, thực hiện `git revert` commit di chuyển mã nguồn. Không có dữ liệu nào bị ảnh hưởng do không có database migration.
3. **Tính độc lập của nhánh**:
   - Mọi thao tác đều được thực thi trên nhánh riêng `rfc/document-location`, tuân thủ chính sách Git Workflow (`.claude/rules/git-workflow.md`): Tuyệt đối không tự ý merge vào `main` cho đến khi có chỉ thị từ người dùng.

---

## 7. Đánh Giá Tác Động & Lợi Ích Kiến Trúc (Architectural Impact & Benefits)

| Tiêu chí | Trước khi tái cấu trúc (`src/lib/documents/`) | Sau khi tái cấu trúc (`src/domain/documents/`) | Lợi ích thu được |
|---|---|---|---|
| **Tuân thủ Clean Architecture** | ❌ Vi phạm: Logic nghiệp vụ cốt lõi bị nhốt trong thư mục tiện ích hạ tầng `lib/`. | ✅ Chuẩn mực: Tầng Domain độc lập hoàn toàn với Server, DB, Web framework. | Đạt chuẩn thiết kế doanh nghiệp cấp cao, phân định trách nhiệm rõ ràng. |
| **Tính Nhất Quán Hệ Thống** | ❌ Lệch chuẩn: Task có `src/domain/tasks/`, Document không có domain layer (Gap G9). | ✅ Đồng bộ: Cả Task và Document đều sở hữu domain layer chuẩn tắc và song hành. | Xóa bỏ Gap G9, giảm gánh nặng nhận thức cho đội ngũ kỹ sư. |
| **Khả năng Tái sử dụng (Reusability)** | ❌ Kém: Máy trạng thái và định dạng số bị dính liền với Prisma và Server Errors. | ✅ Tối đa: Logic FSM, format số, validator có thể chạy cả Client, Server, Edge, Worker. | Cho phép kiểm tra trạng thái ngay trên UI trước khi gửi request lên server. |
| **Khả năng Kiểm thử (Testability)** | ⚠️ Phức tạp: Kiểm thử FSM và format số phải nạp các mock liên quan đến server. | ✅ Tinh gọn: Unit test cho tầng domain chạy độc lập 100% trong bộ nhớ siêu tốc ($<1\text{ms}$). | Tăng độ bao phủ kiểm thử (test coverage) và độ tin cậy của mã nguồn. |
| **Bảo Vệ Tính Bất Biến & SoD** | ⚠️ Rủi ro: Các luật SoD và Immutability nằm rải rác, dễ bị bypass qua generic service. | ✅ Tuyệt đối: Các rào chắn bảo vệ được đóng gói tập trung tại hạt nhân miền. | Bảo đảm tuân thủ nghiêm ngặt Nghị định 30/2020 và Nghị định 68/2024. |

---

## 8. Kết Luận & Khuyến Nghị (Conclusion & Recommendation)

Tài liệu **RFC-04** đã chứng minh tính cấp thiết, tính khả thi và lộ trình kỹ thuật chi tiết của việc di chuyển phân hệ Văn bản sang cấu trúc phân tầng miền chuẩn tắc:
1. **Đề xuất Chấp thuận (Approval Recommendation)**: Kính trình Architecture Review Gate thẩm định và phê duyệt RFC-04 ở trạng thái **ACCEPTED**.
2. **Kế hoạch Thực thi Kế tiếp (Next Step Execution)**: 
   - Sau khi RFC-04 được phê duyệt, tạo Issue thực thi triển khai kỹ thuật (WI-5.2 Implementation PR) để tạo cấu trúc `src/domain/documents/`, `src/server/documents/` và các facades tại `src/lib/documents/`.
   - Kết hợp kết quả của RFC-04 với **ADR-004** (`Document Status Two-Tier Sync`) để hoàn thiện bức tranh kiến trúc tổng thể cho toàn bộ phân hệ điều hành văn bản của QCET E-Office.
