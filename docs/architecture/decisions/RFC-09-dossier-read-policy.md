# RFC-09: Canonical Dossier Read Policy Reconciliation (Hợp nhất Chính sách Đọc Hồ sơ Công việc)

- **Status**: ACCEPTED with Option B — Scoped Item-Level Read Only
- **Date**: 2026-09-22
- **Author**: Security Architecture Team (WI-1.5a / Issue #38)
- **Deciders**: Owner (Approved at Architecture Review Gate — 2026-09-22)
- **Target Implementation**: WI-1.5b
- **Canonical Invariant (Owner Gate Decision)**:
  - **`DossierItem.addedById` TUYỆT ĐỐI KHÔNG TỰ NÓ cấp quyền đọc toàn bộ hồ sơ (`WorkDossier`)**.
  - Cán bộ đóng góp tài liệu có quyền đọc chính tài liệu do mình đóng góp (Scoped Item-Level Read Only), nhưng việc tiếp cận toàn bộ hồ sơ bắt buộc phải có một mối quan hệ/năng lực hợp lệ độc lập khác (người chịu trách nhiệm chính, ranh giới đơn vị sở hữu được phép, trách nhi���m lưu trữ, thẩm quyền lãnh đạo BGH, hoặc giấy ủy quyền hợp lệ).
- **Affects**:
  - `src/server/policies/dossier-policy.ts` (`canReadDossier`)
  - `src/lib/services/dossier-service.ts` (`getDossierDetail`, `listDossiers`, `hasSchoolWideArchivalAccess`)
  - `src/app/api/files/[...path]/route.ts` (File download stream authorization)
  - `src/app/api/dossiers/route.ts` (Dossier collection listing & creation)
  - `src/app/api/dossiers/[id]/route.ts` (Dossier detail retrieval)
  - `src/app/api/dossiers/[id]/items/route.ts` (Dossier items retrieval)
  - `src/server/authorization/authorization-engine.ts` (Canonical Contextual Engine Integration)

---

## 1. Bối cảnh & Đặt vấn đề (Context)

Trong hệ thống E-Office của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET), **Hồ sơ công việc (`WorkDossier`)** và **Tài liệu hồ sơ (`DossierItem`)** là trung tâm của vòng đời quản lý văn thư và lưu trữ lịch sử theo quy định tại Nghị định 30/2020/NĐ-CP và Luật Lưu trữ. Hồ sơ công việc gắn kết các văn bản đến, văn bản đi, nhiệm vụ, biên bản họp và tài liệu đính kèm tạo thành một thực thể quản trị thống nhất.

Tuy nhiên, qua rà soát bảo mật thuộc Work Item WI-1.5a (Issue #38), kiến trúc hiện tại đang tồn tại **hai luồng thẩm định quyền đọc hồ sơ (Dossier Read Authorization Flows) độc lập và xung đột sâu sắc**:

1. **Luồng 1 (Policy Adapter Flow)**:
   Được cài đặt tại `src/server/policies/dossier-policy.ts` qua hàm `canReadDossier()`, hiện đang được sử dụng duy nhất bởi endpoint tải tệp `src/app/api/files/[...path]/route.ts` (dòng 163).
   - Luồng này kiểm tra Data Classification Clearance (`canAccessClassification()`), bảo vệ các cấp độ bảo mật (`RESTRICTED`, `PERSONAL_DATA`, `MAT`).
   - Kiểm tra quyền đóng góp tài liệu (`items[].addedById`).
   - Kiểm tra người nộp lưu (`submittedById`) và người tiếp nhận lưu trữ (`archivedById`).
   - Kiểm tra ranh giới đơn vị (`owningUnitId`) và vai trò lãnh đạo.

2. **Luồng 2 (Service Layer Flow)**:
   Được cài đặt trực tiếp trong `src/lib/services/dossier-service.ts` tại `getDossierDetail()` (dòng 1228-1238) và `listDossiers()` (dòng 1132-1143), phục vụ trực tiếp các REST API routes (`/api/dossiers/[id]`, `/api/dossiers/[id]/items`, `/api/dossiers`).
   - Luồng này kiểm tra thông qua helper nội bộ `hasSchoolWideArchivalAccess()`.
   - **Hoàn toàn bỏ qua** kiểm tra Data Classification Clearance.
   - **Bỏ qua** quyền của người đóng góp tài liệu (`addedById`), người nộp lưu (`submittedById`), người tiếp nhận lưu trữ (`archivedById`).
   - Chỉ cho phép `responsiblePersonId` hoặc thành viên cùng đơn vị (`owningUnitId === departmentId || activeUnitId`).

### Hệ quả bảo mật và trải nghiệm (Impact of Asymmetry)

Sự bất đối xứng giữa hai implementation dẫn tới các lỗ hổng và lỗi trải nghiệm nghiêm trọng:

1. **Lộ lọt dữ liệu phân loại nhạy cảm (Data Classification Leakage via API)**:
   Một nhân viên bình thường cùng đơn vị có thể gọi `GET /api/dossiers/[id]` để đọc toàn bộ thông tin chi tiết và danh mục tài liệu của hồ sơ mang nhãn `RESTRICTED` hoặc `PERSONAL_DATA` (thậm chí tài liệu mật nếu bị gán sai quy trình), trong khi theo Nghị đ└nh 13/2023/NĐ-CP và chính sách Step 2 của ADR-002, nhân viên cùng phòng **không đương nhiên được xem** tài liệu giới hạn nếu không có nhiệm vụ trực tiếp hoặc ủy quyền.
2. **Xung đột quyền truy cập tệp và siêu dữ liệu (File vs. Metadata Paradox)**:
   Một cán bộ được phân công phối hợp thực hiện nhiệm vụ và tải lên biên bản vào hồ sơ (`items[].addedById = user.id`):
   - Khi truy cập `/api/dossiers/[id]` để xem tiến độ hồ sơ: Bị hệ thống trả về `403 Forbidden` (do `DossierService.getDossierDetail` chặn vì không phải `responsiblePersonId` và khác đơn vị).
   - Khi gọi trực tiếp endpoint download tệp `/api/files/...`: Lại được cấp quyền tải tệp thành công (do `dossier-policy.ts` cho phép vì là contributor).
3. **Mất khả năng tra soát lịch sử của người nộp lưu và lưu trữ viên (Archival Audit Disruption)**:
   Sau khi hồ sơ được nộp lưu (`SUBMITTED_TO_ARCHIVE`) hoặc lưu trữ hoàn tất (`ARCHIVED`), người nộp lưu (`submittedById`) nếu được điều chuyển công tác sang đơn vị khác sẽ bị mất hoàn toàn quyền tra cứu hồ sơ do chính mình hoàn thiện và nộp lưu trong `DossierService`.
4. **Bất đồng bộ giữa danh sách (List Query) và chi tiết (Detail Query)**:
   Trong `DossierService.listDossiers()`, câu lệnh truy vấn Prisma chỉ xét `user.departmentId`, hoàn toàn bỏ qua `user.activeUnitId` (được resolve từ `PositionAssignment`), khiến cán bộ kiêm nhiệm hoặc đã chuyển đổi đơn vị theo mô hình ADR-006 không thể nhìn thấy hồ sơ của đơn vị mình phụ trách trên danh sách, nhưng nếu có ID thì có thể xem được chi tiết.

Do đó, việc ban hành **RFC-09** là điều kiện tiên quyết nhằm chuẩn hóa một **Canonical Dossier Read Policy** duy nhất, loại bỏ code duplication, bảo đảm tuân thủ pháp lý và đóng kín các lỗ hổng bảo mật.

---

## 2. Bảng đối chiếu chênh lệch chi tiết (Discrepancy Evidence Table)

Dưới đây là bảng phân tích đối chiếu chi tiết giữa Luồng 1 (`src/server/policies/dossier-policy.ts`) và Luồng 2 (`src/lib/services/dossier-service.ts`):

| Tiêu chí phân quyền / Kiểm tra | Luồng 1: `dossier-policy.ts` (`canReadDossier`) | Luồng 2: `dossier-service.ts` (`getDossierDetail` / `listDossiers`) | Điểm sai lệch & Hệ quả bảo mật (Security Gap) | File:Line Reference |
| :--- | :--- | :--- | :--- | :--- |
| **1. Data Classification Clearance** | **CÓ KIỂM TRA**: Gọi `canAccessClassification(userOrContext, target)`. Chặn ngay lập tức nếu hồ sơ là `RESTRICTED`, `PERSONAL_DATA`, hoặc tài liệu mật mà người dùng không có clearance. | **HOÀN TOÀN KHÔNG KIỂM TRA**: Không có bất kỳ bước kiểm tra độ mật/phân loại dữ liệu nào trong `getDossierDetail`. Trong `listDossiers`, `classification` chỉ là filter tùy chọn từ client (`filter.classification`). | **RẤT NGUY HIỂM (CWE-200)**: Mọi thành viên trong cùng đơn vị đều đọc được hồ sơ `RESTRICTED` và `PERSONAL_DATA`. Vi phạm Nghị định 13/2023/NĐ-CP và Luật 117/2025/QH15. | `dossier-policy.ts:78-93`<br>`dossier-service.ts:1157-1159, 1228-1238` |
| **2. Item Contributor Access (`items[].addedById`)** | **CÓ KIỂM TRA**: Duyệt qua mảng `dossier.items`, nếu có ít nhất một item do người dùng thêm (`addedById === userId`) thì cấp quyền đọc (`return true`). | **BỎ QUA**: Hoàn toàn không kiểm tra `items[].addedById`. Chỉ kiểm tra `responsiblePersonId` và ranh giới đơn vị. | **LỖI NGHIỆP VỤ & BẤT ĐỐI XỨNG**: Cán bộ đóng góp tài liệu tải được file đính kèm qua `/api/files/...` nhưng bị chặn `403 Forbidden` khi mở giao diện chi tiết hồ sơ `/api/dossiers/[id]`. | `dossier-policy.ts:124-130`<br>`dossier-service.ts:1229-1237` |
| **3. Submitter Access (`submittedById`)** | **CÓ KIỂM TRA**: Kiểm tra trực tiếp `if (dossier.submittedById === userId) return true`. | **BỎ QUA**: Không kiểm tra `submittedById`. Trong `listDossiers` cũng không có điều kiện tìm kiếm theo `submittedById`. | **MẤT DẤU VẾT QUẢN TRỊ**: Người nộp lưu hồ sơ vào lưu trữ cơ quan không thể tra cứu lại hồ sơ do mình bàn giao nếu hồ sơ thuộc đơn vị cũ hoặc người chịu trách nhiệm chính bị thay đổi. | `dossier-policy.ts:121`<br>`dossier-service.ts:1136-1142, 1230` |
| **4. Archiver Access (`archivedById`)** | **CÓ KIỂM TRA**: Kiểm tra trực tiếp `if (dossier.archivedById === userId) return true`. | **BỎ QUA**: Không kiểm tra `archivedById`. Chỉ dựa vào vị trí hiện tại qua `hasSchoolWideArchivalAccess()`. | **LỖ HỔNG LƯU TRỮ LỊCH SỬ**: Lưu trữ viên đã trực tiếp thẩm định, tiếp nhận và vào sổ hồ sơ (`archivedById`) nếu chuyển sang vị trí công tác khác sẽ mất quyền đọc hồ sơ mình từng thụ lý. | `dossier-policy.ts:122`<br>`dossier-service.ts:1229-1237` |
| **5. Ranh giới đơn vị (`owningUnitId`)** | **HỖ TRỢ ĐA DẠNG**: Kiểm tra `departmentId`, `activeUnitId`, và danh sách `primaryUnitIds` từ `AuthorizationContext`. | **BẤT NHẤT GIỮA DETAIL VÀ LIST**: `getDossierDetail` kiểm tra cả `departmentId` và `activeUnitId`. Nhưng `listDossiers` **chỉ kiểm tra** `user.departmentId`, bỏ qua `activeUnitId`. | **GHOST DOSSIERS**: Người dùng có `activeUnitId` từ `PositionAssignment` (ADR-006) nhưng `departmentId` null/cũ sẽ thấy danh sách trống nhưng nếu mở bằng URL trực tiếp thì lại xem được. | `dossier-policy.ts:133-146`<br>`dossier-service.ts:1135-1139, 1231-1234` |
| **6. Quyền Lãnh đạo & Quản trị viên (Executive & Admin)** | Kiểm tra `ADMIN`, `isExecutive` (`BAN_GIAM_HIEU`, `HIEU_TRUONG`, `PHO_HIEU_TRUONG`). | `hasSchoolWideArchivalAccess` kiểm tra `systemRole === 'RECTOR'` hoặc chức danh `HIEU_TRUONG`, `PHO_HIEU_TRUONG`, `VAN_THU`, `LUU_TRU`, `CLERK`, `ARCHIVIST`. Bỏ qua `ADMIN` thuần túy và role string `BAN_GIAM_HIEU`. | **BẤT NHẤT ĐỊNH DANH**: Tài khoản Admin kỹ thuật hoặc tài khoản có role `BAN_GIAM_HIEU` (chưa gán PositionAssignment mã chuẩn) bị chặn ở Service nhưng được cho phép ở Policy. | `dossier-policy.ts:43-52, 96-112`<br>`dossier-service.ts:172-187` |
| **7. Cơ chế tích hợp Context** | Hỗ trợ cả `AuthenticatedUser` (REST session) và `AuthorizationContext` (10-Step Engine). | Chỉ nhận `AuthenticatedUserContext` hoặc `SessionPayload`, tự resolve qua `resolveUserContext()`. | Phân mảnh kiểu dữ liệu context, không tận dụng được cache và delegation pipeline của ADR-002. | `dossier-policy.ts:66-75`<br>`dossier-service.ts:1203-1207` |

---

## 3. Khung pháp lý & Cơ sở chuẩn mực (Legal & Statutory Framework)

Hồ sơ công việc trong cơ sở giáo dục nghề nghiệp công lập không đơn thuần là một bảng dữ liệu kỹ thuật, mà chịu sự điều chỉnh trực tiếp của các văn bản quy phạm pháp luật và quy chế nội bộ:

### 3.1. Nghị định số 30/2020/NĐ-CP — Chương IV: Quản lý công tác văn thư, lưu trữ cơ quan
- **Điều 28 (Lập hồ sơ công việc)**:
  - Cán bộ, công chức, viên chức trong quá trình theo dõi, giải quyết công việc có trách nhiệm mở hồ sơ, thu thập và cập nhật toàn bộ văn bản, tài liệu hình thành vào hồ sơ (`OPEN` $\to$ `ACTIVE`).
  - Hồ sơ phản ánh đúng nhiệm vụ được giao; văn bản thu thập phải có mối liên hệ nội dung chặt chẽ.
- **Điều 29 (Nộp lưu hồ sơ, tài liệu vào Lưu trữ cơ quan)**:
  - Cán bộ giải quyết công việc (`responsiblePersonId`) có trách nhiệm hoàn chỉnh hồ sơ (`CLOSED` $\to$ `READY_FOR_ARCHIVE`) và bàn giao cho Lưu trữ cơ quan (`SUBMITTED_TO_ARCHIVE`).
  - Giao nhận hồ sơ phải lập Mục lục hồ sơ nộp lưu và Biên bản bàn giao; Lưu trữ viên cơ quan (`archivedById`, chức danh `LUU_TRU`/`VAN_THU`) kiểm tra, tiếp nhận và vào sổ đăng ký lưu trữ cơ quan (`ACCEPTED` $\to$ `ARCHIVED`).
- **Điều 30 & 31 (Trách nhiệm quản lý và sử dụng tài liệu lưu trữ cơ quan)**:
  - **Người đứng đầu cơ quan (Hiệu trưởng / Ban Giám hiệu)**: Có thẩm quyền toàn diện trong việc cho phép khai thác, sử dụng tài liệu lưu trữ của cơ quan; giám sát toàn diện mọi hồ sơ công việc.
  - **Người đứng đầu đơn vị (Trưởng phòng, Trưởng khoa, Giám đốc trung tâm)**: Chịu trách nhiệm quản lý, theo dõi và có thẩm quyền khai thác toàn bộ hồ sơ công việc thuộc phạm vi chức năng, nhiệm vụ của đơn vị mình.
  - **Cá nhân lập hồ sơ (Maker / Người giải quyết)**: Có quyền tra cứu, tham khảo hồ sơ do mình tạo lập để phục vụ công tác chuyên môn liên tục.
  - **Cán bộ đóng góp tài liệu (Item Contributor)**: Được quyền tiếp cận hồ sơ công việc đối với các nội dung/tài liệu mình tham gia xây dựng hoặc nhiệm vụ phối hợp liên quan.
  - **Văn thư & Lưu trữ cơ quan (`VAN_THU`, `LUU_TRU`)**: Chịu trách nhiệm bảo quản an toàn tài liệu, phục vụ khai thác, tra cứu theo đúng quy chế cơ quan.

### 3.2. Luật Bảo vệ bí mật nhà nước số 117/2025/QH15
- Tuyệt đối nghiêm cấm việc lưu trữ, xử lý hoặc chia sẻ tài liệu chứa bí mật nhà nước (`MAT`, `TOI_MAT`, `TUYET_MAT`) trên các mạng thông tin thông thường không có giải pháp mã hóa cơ yếu được phê duyệt.
- Hồ sơ chứa tài liệu mật hoặc bản thân hồ sơ mang dấu mật phải kích hoạt cơ chế **Default DENY** trên nền tảng web thông thường, chỉ cho phép hiển thị nếu có quy định chính sách đặc thù (`hasApprovedStatutorySecretPolicy === true`).

### 3.3. Nghị định số 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân
- Hồ sơ công việc chứa dữ liệu cá nhân nhạy cảm (`PERSONAL_DATA`) hoặc hồ sơ nhân sự, hồ sơ kỷ luật/khiếu nại (`RESTRICTED`):
- Nguyên tắc cốt lõi: **"Unit membership alone is NOT enough"** (Thành viên đơn vị không đương nhiên được quyền tiếp cận). Chỉ người chịu trách nhiệm chính, người có thẩm quyền lãnh đạo trực ti└p hoặc người được ủy quyền hợp lệ mới được đọc hồ sơ dạng này.

### 3.4. Quy chế tổ chức & hoạt động nhà trường (QĐ 283/QĐ-CĐKTCNQN & QĐ 420/QĐ-CĐKTCNQN)
- Hiệu trưởng lãnh đạo toàn diện; Phó Hiệu trưởng phụ trách lĩnh vực (Portfolio) theo phân công.
- Phân lập trách nhiệm (Separation of Duties - SoD): Người nộp lưu hồ sơ (`submittedById`) không được đồng thời tự mình đóng vai trò Lưu trữ viên tiếp nhận hồ sơ (`archivedById`) vào kho lưu trữ của trường (nguyên tắc Maker-Checker đã quy định tại ADR-001 và ADR-002 Step 10).

---

## 4. Thiết kế Chính sách Đọc Hồ sơ Hợp nhất (Proposed Canonical Policy Specification)

Nhằm triệt tiêu sự phân tán, RFC-09 đề xuất hợp nhất toàn bộ logic thẩm định quyền đọc hồ sơ thành **một hàm canonical duy nhất** `canReadDossier()` được chuẩn hóa, kết hợp cùng helper xây dựng điều kiện lọc cơ sở dữ liệu `buildDossierReadWhere()`.

### 4.1. Thứ tự đánh giá tuần tự nghiêm ngặt (Strict Evaluation Pipeline)

Quy trình thẩm định tuân thủ chặt chẽ 7 bước theo kiến trúc ADR-002:

```
[Request / Access Attempt]
           │
           ▼
┌─────└──────────────────────────────────────────────────┐
│ Bước 1: Xác thực Phiên & Trạng thái Tài khoản          │
│ - Kiểm tra userId, tài khoản đang hoạt động (isActive) │
└──────────────────────────┬─────────────────────────────┘
                           │ (Hợp lệ)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Bước 2: Kiểm soát Phân loại Dữ liệu (Classification)    │
│ - Gọi canAccessClassification()                        │
│ - Chặn STATE_SECRET (MAT/TOI_MAT/TUYET_MAT)            │
│ - Chặn RESTRICTED / PERSONAL_DATA nếu không có         │
│   direct relation, executive mandate, hoặc delegation  │
└──────────────────────────┬───────────────────└─────────┘
                           │ (Đạt chuẩn Clearance)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Bước 3: Phân lập Quyền lực Kỹ thuật (Admin Guard)     │
│ - SYSTEM_ADMIN không có thẩm quyền nghiệp vụ đọc       │
│   hồ sơ INTERNAL/RESTRICTED nếu không có Direct/Exec   │
└──────────────────────────┬─────────────────────────────┘
                           │ (Tiếp tục)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Bước 4: Mối quan hệ Trực tiếp Chuẩn (Direct Rel)       │
│ - Responsible Person (responsiblePersonId === userId)  │
│ - Submitter (submittedById === userId)                 │
│ - Archiver (archivedById === userId)                   │
│ ──> CẤP QUYỀN (ALLOW: STEP_4_DIRECT_RELATIONSHIP)      │
│ ────────────────────────────────────────────────────── │
│ * Lưu ý: Item Contributor (items[].addedById) là       │
│   ĐIỂM QUYẾT ĐỊNH CHỦ QUẢN CHƯA GIẢI QUYẾT (UNRESOLVED)│
│   Chưa đưa vào baseline; tùy thuộc phê chuẩn Option A  │
│   hoặc Option B tại mục 4.4                            │
└──────────────────────────┬─────────────────────────────┘
                           │ (Không có quan hệ trực tiếp)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Bước 5: Thẩm quyền Giám sát Toàn trường & Lưu trữ      │
│ - Ban Giám hiệu (HIEU_TRUONG, PHO_HIEU_TRUONG, RECTOR) │
│ - Văn thư & Lưu trữ (VAN_THU, LUU_TRU, ARCHIVIST, CLERK)│
│ ──> CẤP QUYỀN (ALLOW: STEP_5_INSTITUTIONAL_CLEARANCE)  │
└──────────────────────────┬─────────────────────────────┘
                           │ (Không thuộc BGH / Lưu trữ)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Bước 6: Ranh giới Đơn vị Sở hữu (Unit Boundary Scope) │
│ - Kiểm tra owningUnitId khớp với user.departmentId,    │
│   activeUnitId, hoặc primaryUnitIds                   │
│ - ĐIỀU KIỆN TIÊN QUYẾT: Hồ sơ phải có phân loại        │
│   INTERNAL hoặc PUBLIC (Đã được lọc qua Bước 2)       │
│ - Trưởng đơn vị: Toàn quyền đọc hồ sơ đơn vị           │
│ - Thành viên đơn vị: Đọc hồ sơ nghiệp vụ chung đơn vị  │
│ ──> CẤP QUYỀN (ALLOW: STEP_6_UNIT_BOUNDARY)            │
└──────────────────────────┬─────────────────────────────┘
                           │ (Khác đơn vị sở hữu)
                           ▼
┌────────────────────────────────────────────────────────┐
│ Bước 7: Thẩm quyền Ủy quyền Hoạt động (Delegation)     │
│ - Kiểm tra giấy ủy quyền DacumDelegation hợp lệ còn    │
│   hiệu lực trao quyền quản lý/khai thác hồ sơ đơn vị  │
│ ──> CẤP QUYỀN (ALLOW: STEP_7_VALID_DELEGATION)         │
└──────────────────────────┬─────────────────────────────┘
                           │ (Không thỏa mãn)
                           ▼
                     [DENY: DEFAULT]
```

### 4.2. Ma trận Ánh xạ Vai trò & Vị trí Chức danh (Role & Position Mapping)

| Nhóm chủ thể (Actor Group) | Vị trí / Chức danh chuẩn | Quyền đọc hồ sơ theo trạng thái vòng đời | Điều kiện ràng buộc |
| :--- | :--- | :--- | :--- |
| **Ban Giám hiệu (Executive)** | `HIEU_TRUONG`, `PHO_HIEU_TRUONG`, `BGH`, `RECTOR` | Toàn bộ trạng thái (`OPEN`, `ACTIVE`, `CLOSED`, `READY_FOR_ARCHIVE`, `SUBMITTED_TO_ARCHIVE`, `ACCEPTED`, `ARCHIVED`) | Đọc toàn trường. Đối với `RESTRICTED`: Hiệu trưởng đọc toàn bộ; Phó Hiệu trưởng đọc theo Portfolio phụ trách hoặc phân công. |
| **Văn thư & Lưu trữ cơ quan (Clerk & Archivist)** | `VAN_THU`, `LUU_TRU`, `CLERK`, `ARCHIVIST` | Đọc toàn trường đối với hồ sơ đã nộp lưu hoặc lưu trữ (`SUBMITTED_TO_ARCHIVE`, `ACCEPTED`, `ARCHIVED`). Đọc hồ sơ đang mở/xử lý phục vụ đối chiếu mục lục nộp lưu. | Không tự ý can thiệp nội dung hồ sơ đang mở của đơn vị khác. Phải tuân thủ quy chế giải mật. |
| **Lãnh đạo Đơn vị (Unit Leader)** | `TRUONG_PHONG`, `TRUONG_KHOA`, `GIAM_DOC_TT` | Toàn bộ hồ sơ có `owningUnitId` thuộc đơn vị mình quản lý. | Có quyền đọc mọi hồ sơ `INTERNAL` của đơn vị. Với hồ sơ `RESTRICTED`, chỉ đọc nếu là người giao việc hoặc có liên quan trực tiếp. |
| **Cán bộ lập hồ sơ (Responsible Person / Maker)** | Bất kỳ chức danh nào được phân công | Đọc toàn diện hồ sơ mình phụ trách (`responsiblePersonId === userId`) xuyên suốt mọi trạng thái vòng đời. | Quyền gắn liền với nhân thân người tạo lập (ngay cả khi điều chuyển đơn vị vẫn giữ quyền tra cứu lịch sử). |
| **Người nộp lưu & Người lưu trữ (Submitter / Archiver)** | Cán bộ hoàn tất nộp lưu hoặc Lưu trữ viên tiếp nhận | Đọc hồ sơ mà mình đã nộp lưu (`submittedById`) hoặc mình đã tiếp nhận vào kho lưu trữ (`archivedById`). | Bảo đảm tính giải trình và bằng chứng pháp lý theo Điều 29 Nghị định 30/2020/NĐ-CP. |
| **Cán bộ đóng góp tài liệu (Item Contributor)** | Bất kỳ ai thêm ít nhất 1 item vào hồ sơ | **ĐIỂM QUYẾT ĐỊNH CHÍNH SÁCH CHỦ QUẢN (OWNER POLICY DECISION)**:<br>- *Lựa chọn A*: Đọc toàn bộ hồ sơ chứa tài liệu.<br>- *Lựa chọn B*: Chỉ đọc tài liệu do chính mình đóng góp, không đọc cả hồ sơ. | Tùy thuộc phê duyệt của Chủ quản tại Architecture Review Gate (xem chi tiết mục 4.4). |
| **Chuyên viên / Giảng viên trong đơn vị (Unit Member)** | Cán bộ thuộc đơn vị `owningUnitId` | Đọc các hồ sơ `INTERNAL` công khai trong đơn vị. | **TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỌC** các hồ sơ gắn cờ `RESTRICTED` hoặc `PERSONAL_DATA` nếu không có quan hệ trực tiếp. |
| **Người ngoài đơn vị (External User)** | Không thuộc các nhóm trên | **TỪ CHỐI TRUY CẬP (DENY)** | Chỉ được tiếp cận khi có văn bản ủy quyền (`DelegationGrant`) hợp lệ. |

### 4.3. Đặc tả Hợp đồng Giao diện (Interface & Contract Specification)

#### A. Hàm Canonical `canReadDossier`
Đặt tại `src/server/policies/dossier-policy.ts` (và được export/re-export qua `src/server/authorization/`):

```typescript
export interface CanonicalDossierEntity {
  id: string;
  code?: string;
  title?: string;
  owningUnitId: string;
  responsiblePersonId: string;
  submittedById?: string | null;
  archivedById?: string | null;
  status: DossierStatus | string;
  classification: DataClassification | string;
  securityLevel?: string | null;
  items?: Array<{
    id?: string;
    addedById?: string | null;
    [key: string]: unknown;
  }> | null;
  [key: string]: unknown;
}

export interface DossierAccessDecision {
  allowed: boolean;
  reason: string;
  policyMatched: string;
}

export function evaluateDossierReadAccess(
  actor: AuthenticatedUser | AuthorizationContext,
  dossier: CanonicalDossierEntity
): DossierAccessDecision;

export function canReadDossier(
  actor: AuthenticatedUser | AuthorizationContext,
  dossier: CanonicalDossierEntity
): boolean;
```

#### B. Helper Xây dựng Điều kiện Lọc Truy vấn Danh sách (`buildDossierReadWhere`)
Nhằm bảo đảm danh sách hồ sơ (`DossierService.listDossiers`) khớp hoàn toàn với chính sách đọc chi tiết, hàm xây dựng truy vấn Prisma WHERE được chuẩn hóa:

```typescript
export function buildDossierReadWhere(
  user: AuthenticatedUserContext
): Prisma.WorkDossierWhereInput {
  // 1. Quản trị viên toàn trường / Ban Giám hiệu / Lưu trữ viên
  if (hasSchoolWideArchivalAccess(user)) {
    // Nếu là BGH hoặc Văn thư/Lưu trữ: xem toàn bộ hồ sơ INTERNAL,
    // riêng RESTRICTED chỉ hiển thị nếu có quan hệ trực tiếp hoặc quyền lãnh đạo cao nhất (Hiệu trưởng)
    if (user.activePositionCode === 'HIEU_TRUONG' || user.systemRole === 'RECTOR') {
      return {}; // Hiệu trưởng xem toàn bộ
    }
    return {
      OR: [
        { classification: { notIn: [DataClassification.RESTRICTED, DataClassification.PERSONAL_DATA] } },
        { responsiblePersonId: user.id },
        { submittedById: user.id },
        { archivedById: user.id },
        // [OWNER DECISION: OPTION B ACCEPTED]:
        // DossierItem.addedById KHÔNG cấp quyền đọc cấp hồ sơ. Item Contributor chỉ đọc/tải
        // item do mình đóng góp qua cơ chế phân quyền cấp item (canReadDossierItem).
      ],
    };
  }

  // 2. Cán bộ đơn vị & Chuyên viên
  const activeUnits = [user.departmentId, user.activeUnitId].filter(Boolean) as string[];

  return {
    OR: [
      // Quan hệ trực tiếp chuẩn tắc với hồ sơ (kể cả khi hồ sơ là RESTRICTED)
      { responsiblePersonId: user.id },
      { submittedById: user.id },
      { archivedById: user.id },
      // [OWNER DECISION: OPTION B ACCEPTED]:
      // DossierItem.addedById KHÔNG đưa vào baseline query của hồ sơ.
      // Quyền đọc cấp item được kiểm soát độc lập tại API items và file route.
      // Thành viên trong đơn vị sở hữu (chỉ đối với hồ sơ không bị RESTRICTED/PERSONAL_DATA)
      ...(activeUnits.length > 0
        ? [
            {
              owningUnitId: { in: activeUnits },
              classification: {
                notIn: [DataClassification.RESTRICTED, DataClassification.PERSONAL_DATA],
              },
            },
          ]
        : []),
    ],
  };
}
```

### 4.4. Điểm Quyết định Chính sách Chủ quản: Phạm vi Quyền của Cán bộ Đóng góp Tài liệu (Owner Policy Decision Point: Item Contributor Scope)

> **LƯU Ý QUAN TRỌNG (ARCHITECTURAL GOVERNANCE)**:
> Quy tắc *"Cán bộ đóng góp tài liệu (`items[].addedById === userId`) có quyền đọc toàn bộ hồ sơ công việc"* **LÀ MỘT QUYẾT ĐỊNH CHƯA GIẢI QUYẾT (UNRESOLVED OWNER POLICY DECISION)**.
> - **KHÔNG ĐƯỢC TỰ Ý MẶC NHẬN** quy tắc này vào baseline canonical khi chưa có chữ ký phê chuẩn chính thức của Chủ quản hệ thống (Owner) tại Cổng Đánh giá Kiến trúc (Architecture Review Gate).
> - Baseline canonical tại §4.1 và §4.3 **chỉ bao gồm** 3 quan hệ trực tiếp chuẩn mực: Người chịu trách nhiệm chính (`responsiblePersonId`), Người nộp lưu (`submittedById`), và Người tiếp nhận lưu trữ (`archivedById`).
> - Dưới đây là đặc tả kỹ thuật và phân tích đánh đổi (trade-offs) giữa hai phương án để Chủ quản lựa chọn.

#### 4.4.1. Phương án A: Cán bộ đóng góp có toàn quyền đọc hồ sơ chứa tài liệu (Option A - Full Dossier Read)
- **Cơ chế**: Khi người dùng có định danh trùng khớp với `addedById` của ít nhất một `DossierItem` bên trong hồ sơ (`items.some(item => item.addedById === userId)`), hệ thống mở rộng quyền đọc toàn bộ thực thể `WorkDossier` và toàn bộ danh mục tài liệu kèm theo.
- **Đặc tả kỹ thuật (Technical Specification)**:
  - *Truy vấn danh sách (`buildDossierReadWhere`)*: Bổ sung thêm điều kiện `{ items: { some: { addedById: user.id } } }` vào mệnh đề `OR`.
  - *Thẩm định chi tiết (`canReadDossier`)*: Bổ sung bước kiểm tra:
    ```typescript
    if (Array.isArray(dossier.items) && dossier.items.some((item) => item.addedById === userId)) {
      return true;
    }
    ```
- **Ưu điểm**:
  - *Thúc đẩy tối đa tinh thần cộng tác liên đơn vị*: Cán bộ phối hợp nắm bắt được toàn cảnh vụ việc, tiến trình giải quyết nhiệm vụ chung, các văn bản chỉ đạo và đóng góp của các đồng nghiệp khác trong cùng một hồ sơ.
  - *Đơn giản hóa mô hình kỹ thuật*: Không đòi hỏi cơ chế lọc phức tạp ở cấp độ phần tử con (`Item-level Authorization Filtering`), giảm chi phí truy vấn cơ sở dữ liệu.
- **Rủi ro bảo mật & Nhược điểm**:
  - *Vi phạm nguyên tắc đặc quyền tối thiểu (Least Privilege)*: Hồ sơ công việc thực tế trong trường thường tập hợp nhiều tài liệu có tính chất khác nhau, có thể chứa tờ trình nhạy cảm, ý kiến phê duyệt tài chính, dự thảo nội bộ hoặc biên bản giải trình do cán bộ khác tải lên.
  - *Nguy cơ lộ lọt thông tin chéo (Cross-Department Data Leakage)*: Một cán bộ ngoài đơn vị chỉ được mời nộp một biên bản khảo sát kỹ thuật lại có thể đọc được toàn bộ hợp đồng, báo giá, hoặc các tài liệu thảo luận nội bộ khác của đơn vị chủ trì.

#### 4.4.2. Phương án B: Cán bộ đóng góp chỉ được đọc chính tài liệu do mình đóng góp (Option B - Scoped Item-Level Read Only) — *Khuyến nghị của Đội ngũ Bảo mật*
- **Cơ chế**: Cán bộ đóng góp tài liệu (`items[].addedById === userId`) **CHỈ CÓ QUYỀN** xem siêu dữ liệu và tải về chính tài liệu/minh chứng do bản thân đã tải lên. Cán bộ đó **KHÔNG ĐƯỢC TỰ ĐỘNG CẤP QUYỀN** đọc toàn bộ hồ sơ công việc hoặc các tài liệu do người khác tải lên, trừ khi họ có thẩm quyền quản lý đơn vị (`owningUnitId`), thẩm quyền lãnh đạo toàn trường (`Executive`), hoặc văn bản ủy quyền hợp lệ (`DelegationGrant`).
- **Đặc tả kỹ thuật (Technical Specification)**:
  - *Truy vấn danh sách (`buildDossierReadWhere`)*: Giữ nguyên baseline, **KHÔNG** bổ sung `{ items: { some: { addedById: user.id } } }`. Contributor không nhìn thấy hồ sơ trên danh sách nếu không có thẩm quyền đơn vị.
  - *Thẩm định chi tiết hồ sơ (`canReadDossier`)*: Giữ nguyên baseline, **TỪ CHỐI** nếu chỉ là item contributor đơn thuần.
  - *Thẩm định cấp phần tử (`canReadDossierItem`)*: Bổ sung helper phân quyền cấp item phục vụ endpoint `/api/dossiers/[id]/items` và route tải tệp `/api/files/...`:
    ```typescript
    export function canReadDossierItem(
      actor: AuthenticatedUser | AuthorizationContext,
      item: { id: string; addedById?: string | null },
      dossier: CanonicalDossierEntity
    ): boolean {
      // 1. Nếu có quyền đọc toàn bộ hồ sơ (canReadDossier) -> Đọc được mọi item
      if (canReadDossier(actor, dossier)) {
        return true;
      }
      // 2. Phân quyền cấp phần tử: Chỉ đọc/tải chính item do mình đóng góp
      const userId = typeof (actor as any).isSystemAdmin === 'function'
        ? (actor as AuthorizationContext).userId
        : (actor as AuthenticatedUser).id;
      return Boolean(userId && item.addedById && item.addedById === userId);
    }
    ```
- **Ưu điểm**:
  - *Bảo mật tối đa theo nguyên tắc đặc quyền tối thiểu (Least Privilege)*: Đóng kín hoàn toàn bề mặt rò rỉ dữ liệu giữa các đơn vị phối hợp.
  - *Hài hòa chuẩn mực pháp lý với Nghị định 30/2020/NĐ-CP*: Hồ sơ công việc thuộc thẩm quyền quản trị của đơn vị chủ trì và người lập hồ sơ (`responsiblePersonId`); cán bộ phối hợp chỉ chịu trách nhiệm về phần tài liệu do mình cung cấp.
- **Đánh đổi kỹ thuật (Technical Trade-off & Overhead)**:
  - Yêu cầu bổ sung logic lọc phân quyền cấp phần tử (`Item-level Filtering`) trong API `GET /api/dossiers/[id]/items` và điều kiện JOIN/filter trong Prisma query.
  - Khi cán bộ đóng góp truy cập `/api/dossiers/[id]`, hệ thống chỉ trả về siêu dữ liệu tóm lược của hồ sơ và chỉ render các items mà người dùng có quyền tiếp cận.

#### 4.4.3. Bảng so sánh Đánh đổi Kiến trúc (Trade-off Matrix)

| Tiêu chí so sánh | Phương án A (Toàn quyền đọc hồ sơ) | Phương án B (Chỉ đọc tài liệu do mình đóng góp) |
| :--- | :--- | :--- |
| **Tính hợp tác (Collaboration)** | **Cao** — Dễ dàng chia sẻ bối cảnh công việc liên đơn vị. | **Trung bình** — Cần đơn vị chủ trì chủ động chia sẻ hoặc phân quyền rõ ràng. |
| **Nguyên tắc Least Privilege** | **Kém** — Thừa quyền, tiềm ẩn nguy cơ lộ lọt tài liệu nhạy cảm khác. | **Tuyệt đối** — Đúng quyền, đúng trách nhiệm đối với từng tài liệu. |
| **Tuân thủ Nghị định 30/2020** | **Chấp nhận được** — Dựa trên giả định hồ sơ là không gian làm việc chung. | **Chặt chẽ** — Phản ánh đúng ranh giới trách nhiệm đơn vị lập hồ sơ. |
| **Độ phức tạp mã nguồn (Code Complexity)** | **Thấp** — Boolean check đơn giản trên mảng items của hồ sơ. | **Trung bình - Cao** — Cần lọc danh sách item trả về ở tầng Service và SQL query. |
| **Khuyến nghị của Security Team** | Không khuyến nghị cho môi trường sản xuất. | **KHUYẾN NGHỊ CHÍNH THỨC** (Trình Owner phê chuẩn). |

#### 4.4.4. Quyết định Chính thức của Chủ quản Hệ thống (Owner Policy Decision Sign-off)

Trạng thái quyết định: **ĐÃ PHÊ DUYỆT (ACCEPTED WITH OPTION B)** — Phê duyệt chính thức tại Cổng Đánh giá Kiến trúc (Architecture Review Gate) ngày 2026-09-22.

```markdown
┌────────────────────────────────────────────────────────────────────────┐
│ PHÊ DUYỆT CHÍNH SÁCH CHỦ QUẢN (OWNER POLICY DECISION SIGN-OFF)         │
│                                                                        │
│ [ ] PHƯƠNG ÁN A: Trao quyền đọc toàn bộ hồ sơ cho Item Contributor     │
│ [X] PHƯƠNG ÁN B: Chỉ cho phép đọc tài liệu do chính mình đóng góp       │
│                  (Scoped Item-Level Read Only)                         │
│                                                                        │
│ Người phê duyệt: Owner / Lead Architect                                │
│ Ngày phê chuẩn:  22 / 09 / 2026                                        │
│ Bất biến chuẩn tắc (Canonical Invariant):                              │
│ DossierItem.addedById TUYỆT ĐỐI KHÔNG TỰ NÓ cấp quyền đọc toàn bộ     │
│ hồ sơ (WorkDossier). Contributor chỉ được đọc/tải chính item của mình. │
│ Đọc toàn bộ hồ sơ bắt buộc phải có quan hệ/năng lực độc lập khác       │
│ (responsiblePersonId, owningUnitId, archival, Executive, delegation).  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Phân tích Bảo mật & Mô hình Đe dọa (Security Analysis & Threat Modeling)

Việc áp dụng RFC-09 khắc phục trực tiếp các rủi ro bảo mật trọng yếu sau:

### 5.1. Triệt tiêu lỗ hổng IDOR (Insecure Direct Object Reference)
- **Hiện trạng**: Kẻ tấn công hoặc người dùng nội bộ biết được `id` của một hồ sơ nhạy cảm (`RESTRICTED`/`PERSONAL_DATA`) thuộc đơn vị mình có thể gọi thẳng endpoint `GET /api/dossiers/[id]`. Service hiện tại chỉ kiểm tra `dossier.owningUnitId === user.departmentId` và trả về toàn bộ dữ liệu.
- **Sau chuẩn hóa**: Bước 2 của Canonical Policy bắt buộc kiểm tra `canAccessClassification()`. Nếu người dùng không phải là `responsiblePersonId`, không có `delegation` và không phải là Hiệu trưởng, hệ thống lập tức từ chối với mã lỗi `CLASSIFICATION_CLEARANCE_REQUIRED` (HTTP 403), bảo vệ trọn vẹn dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.

### 5.2. Đóng kín lỗ hổng Bypass qua Endpoint Download Tệp (File vs. Metadata Divergence)
- **Hiện trạng**: `dossier-policy.ts` cho phép `items[].addedById` tải file, nhưng `DossierService.getDossierDetail` lại chặn xem thông tin hồ sơ. Ngược lại, đối với hồ sơ `RESTRICTED`, `DossierService` cho phép xem thông tin hồ sơ nhưng endpoint `/api/files/...` lại chặn tải file (do policy chặn classification).
- **Sau chuẩn hóa**: Sự bất nhất này được triệt tiêu hoàn toàn khi cả 2 điểm vào (API Service và File Stream Route) đều được căn chỉnh đồng nhất theo quyết định của Chủ quản tại §4.4:
  - *Nếu Chủ quản phê duyệt Phương án A*: Cả trang chi tiết hồ sơ (`/api/dossiers/[id]`) và route tải tệp (`/api/files/...`) đều cấp quyền đọc toàn diện cho Item Contributor.
  - *Nếu Chủ quản phê duyệt Phương án B*: Cả hai endpoint đều áp dụng nguyên tắc kiểm soát quyền theo cấp phần tử (Item-level Authorization qua `canReadDossierItem()`). Contributor không thể xem các tài liệu khác trong hồ sơ, và endpoint tải tệp chỉ cho phép tải tệp đính kèm thuộc chính item do cán bộ đó tải lên (`dossierItem.addedById === userId`).

### 5.3. Bảo toàn nguyên tắc Phân lập Trách nhiệm (Separation of Duties - SoD)
- Nghị định 30/2020/NĐ-CP và ADR-001 quy định rõ: Người nộp lưu hồ sơ (`submittedById`) không được tự duyệt tiếp nhận lưu trữ cho chính hồ sơ của mình (`archivedById`).
- Trong chính sách đọc, việc ghi nhận cả `submittedById` và `archivedById` như hai thực thể độc lập giúp lưu vết kiểm toán (Audit Trail) chính xác danh tính người bàn giao và người tiếp nhận, ngăn chặn việc một người tự biên tự diễn làm sai lệch hồ sơ lưu trữ lịch sử.

### 5.4. Phòng ngừa tấn công khai thác quyền Quản trị viên (Separation of Powers)
- Tuân thủ ADR-002: Quản trị viên kỹ thuật (`SYSTEM_ADMIN`) không được mặc định đọc nội dung hồ sơ nghiệp vụ nếu không có vai trò nghiệp vụ tương ứng. Tránh nguy cơ tài khoản IT Admin bị chiếm dụng dẫn đến rò rỉ toàn bộ hồ sơ công việc mật của cơ quan.

---

## 6. Kế hoạch Triển khai cho WI-1.5b (Implementation Plan)

Quá trình triển khai kỹ thuật được phân kỳ thành 5 giai đoạn an toàn, không gây gián đoạn hệ thống (Zero-Downtime Migration):

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 1: Quyết định Chủ quản & Chuẩn hóa Core Policy                │
│ - Chốt phê duyệt Phương án A hoặc Phương án B (§4.4) tại Review Gate    │
│ - Hoàn thiện hàm canReadDossier() & buildDossierReadWhere()            │
│   (kèm canReadDossierItem() nếu phê chuẩn Phương án B)                  │
│ - Viết unit test suite bao phủ 100% các nhánh đánh giá                  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 2: Tái cấu trúc DossierService (getDossierDetail)             │
│ - Thay thế logic ad-hoc tại dòng 1228-1238 bằng canReadDossier()       │
│ - Truy vấn submittedById, archivedById (và items theo Option đã chọn)   │
│ - Ném lỗi chuẩn ForbiddenError kèm mã lý do vi phạm                     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 3: Đồng bộ Danh sách DossierService.listDossiers              │
│ - Áp dụng buildDossierReadWhere() vào câu lệnh Prisma count/findMany    │
│ - Hỗ trợ phân quyền đồng nhất giữa danh sách và trang chi tiết          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 4: Đồng bộ Endpoint Tải tệp (/api/files/[...path])            │
│ - Kiểm tra và bảo đảm Prisma include items và dossier metadata đầy đủ   │
│ - Gọi canReadDossier() (hoặc canReadDossierItem()) đồng nhất            │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Giai đoạn 5: Xác thực Hợp chuẩn & Regression Testing                    │
│ - Chạy npm run typecheck && npm test                                    │
│ - Kiểm thử tích hợp kịch bản 5 nhóm vai trò (BGH, Trưởng đơn vị,        │
│   Chuyên viên, Lưu trữ viên, Contributor) và hồ sơ RESTRICTED           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.1. Danh mục Tệp Thay đổi Chi tiết (File Modification Map for WI-1.5b)

| STT | Đường dẫn tệp | Trách nhiệm thay đổi trong WI-1.5b |
| :--- | :--- | :--- |
| 1 | `src/server/policies/dossier-policy.ts` | Hoàn thiện hàm canonical `canReadDossier()`, bổ sung `evaluateDossierReadAccess()`, `buildDossierReadWhere()` (và `canReadDossierItem()` nếu chọn Phương án B). |
| 2 | `src/lib/services/dossier-service.ts` | Thay thế toàn bộ logic đọc ad-hoc tại `getDossierDetail()` và `listDossiers()` bằng canonical policy và query builder theo phương án đã phê duyệt. |
| 3 | `src/app/api/files/[...path]/route.ts` | Gọi hàm authorization tương ứng (canReadDossier hoặc canReadDossierItem), đồng bộ hoàn toàn với metadata. |
| 4 | `src/server/authorization/authorization-engine.ts` | Bổ sung action `dossier.read` vào Step 4, Step 5, Step 6 của Contextual Engine để hỗ trợ gọi qua `assertAuthorized(user, 'dossier.read', resource)`. |
| 5 | `tests/unit/dossier-read-policy.test.ts` | Tạo mới test suite kiểm thử toàn diện các case phân quyền, ranh giới đơn vị, cấp độ bảo mật và nhánh Item Contributor theo phương án được chọn. |

---

## 7. Kết luận & Khuyến nghị (Conclusion & Recommendation)

Hợp nhất chính sách đọc hồ sơ công việc theo **RFC-09** là bước đi nền tảng nhằm:
1. Đảm bảo tính tuân thủ pháp lý cao nhất với **Nghị định 30/2020/NĐ-CP**, **Luật Bảo vệ bí mật nhà nước 117/2025/QH15** và **Nghị định 13/2023/NĐ-CP**.
2. Loại bỏ hoàn toàn sự vênh quyền giữa xem siêu dữ liệu hồ sơ và tải tài liệu đính kèm.
3. Củng cố vững chắc mô hình phân quyền theo ngữ cảnh (Contextual Authorization) đã được xác lập trong **ADR-002**.

Khuyến nghị Chủ quản hệ thống và Kiến trúc sư trưởng phê duyệt RFC-09 kèm theo chỉ đạo lựa chọn chính sách tại **mục 4.4** để làm cơ sở thực thi ngay cho Work Item **WI-1.5b**.
