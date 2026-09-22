# RFC-03: Phân Tích Hợp Nhất Mô Hình Ủy Quyền (Delegation Consolidation Analysis: DacumDelegation vs DelegationGrant)

- **Status**: DRAFT (Đề xuất cho Architecture Review Gate)
- **Date**: 2026-09-22
- **Author**: Security & Authorization Architecture Working Group
- **Deciders**: Architecture Review Board / System Owner
- **Target Work Item**: WI-3.2 (Issue #58)
- **Scope**: Tài liệu kiểm toán hiện trạng, phân tích so sánh và thiết kế lộ trình hợp nhất mô hình ủy quyền (Strictly Audit & Analysis RFC document only). Tuyệt đối không thay đổi mã nguồn (Zero code modification) và không chỉnh sửa schema cơ sở dữ liệu (Zero schema migration) trong phạm vi Work Item này.
- **Related Documents**:
  - `ADR-001: Hợp nhất Maker-Checker / Separation of Duties Guard thành một hàm canonical duy nhất`
  - `ADR-002: Contextual Authorization Policy Engine (10-Step Pipeline)`
  - `ADR-006: Department → OrganizationalUnit Consolidation`
  - `SPEC-DOMAIN-DEL-2026-01: QCET E-Office Domain Specification — Delegations & Authority Grants` (`docs/domain/delegations.md`)
  - `docs/architecture/enterprise-product-architecture.md`
  - `docs/domain/regulations_knowledge_base.md`

---

## 1. Context & Problem Statement (Bối cảnh & Vấn đề Cốt lõi)

### 1.1 Hiện trạng Tồn tại Song song Hai Mô hình Ủy quyền (Dual Existence)

Trong quá trình phát triển hệ thống điều hành tác nghiệp trực tuyến **QCET E-Office** tại Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn, cơ chế ủy quyền quyền hạn công vụ hiện đang bị phân mảnh nghiêm trọng bởi sự tồn tại song song của hai mô hình dữ liệu và cơ chế đánh giá quyền lực khác nhau:

1. **Mô hình Kế thừa `DacumDelegation` (`prisma/schema.prisma:314-338`)**:
   - Được thiết kế trong giai đoạn sơ khởi (Phase 0 / Sprint 1) phục vụ nghiệp vụ thẩm định hồ sơ kỹ năng chuyên môn DACUM và phân công công việc đơn giản cấp khoa/phòng.
   - Bản chất là mô hình hướng người dùng cá nhân (`grantorId: User`, `delegateId: User`), gắn trực tiếp vào thực thể `User` và bảng `Department` cũ.
   - Thẩm quyền ủy quyền được biểu diễn bằng các chuỗi văn bản tự do (`committeeRole`, `authorityScope`), thiếu cấu trúc kiểm soát phạm vi và không nhận biết các vị trí công tác hay mảng phụ trách quản trị nhà trường.

2. **Mô hình Chuẩn tắc `DelegationGrant` (`prisma/schema.prisma:1071-1096`) kèm `DelegationScopeRule` (`1098-1109`)**:
   - Được thiết kế trong Phase 2-4 theo mô hình kiểm soát truy cập dựa trên quan hệ và thẩm quyền ngữ cảnh (Canonical ReBAC Engine).
   - Bản chất là thực thể pháp lý công vụ hạng nhất (First-Class Entity), gắn trực tiếp vào các quyết định bổ nhiệm vị trí công tác (`PositionAssignment`), phản ánh chính xác nguyên tắc pháp lý: *"Viên chức quản lý ủy quyền thẩm quyền gắn liền với chức vụ được bổ nhiệm, không ủy quyền tư cách cá nhân"*.
   - Tích hợp sâu với danh mục 11 mảng trách nhiệm (`ResponsibilityArea`) của Ban Giám hiệu theo Quyết định 420/QĐ-CĐKTCNQN, hệ thống hành động năng lực (`CapabilityAction`), vòng đời hiệu lực chặt chẽ (`DelegationStatus`), kiểm soát chống tái ủy quyền, thuật toán BFS phát hiện chu trình ủy quyền vòng tròn, và gắn với số văn bản căn cứ pháp lý theo Nghị định 30/2020/NĐ-CP.

### 1.2 Những Hệ lụy và Rủi ro Kiến trúc (Architectural Drift & Technical Debt)

Sự tồn tại song hành của hai mô hình này dẫn đến các rủi ro hệ thống nghiêm trọng:

1. **Phân mảnh Động cơ Phân quyền (Authorization Divergence & Dual-Path Checks)**:
   - Trong khi động cơ phân quyền chuẩn tắc 10 bước (`src/server/authorization/authorization-engine.ts`) và dịch vụ ngữ cảnh (`src/server/authorization/authorization-context-service.ts:168`) chỉ công nhận và nạp các bản ghi `DelegationGrant`, thì lớp tác vụ cũ (`src/server/tasks/task-policy.ts:32-84`) vẫn duy trì logic kiểm tra hai tầng: kiểm tra `DelegationGrant` trước, nếu không có thì fallback sang truy vấn bảng `DacumDelegation`.
   - Lớp fallback này tạo ra lỗ hổng bảo mật: một ủy quyền đã bị thu hồi hoặc không hợp lệ theo chuẩn ReBAC vẫn có thể được chấp thuận nếu tồn tại một bản ghi `DacumDelegation` cũ chưa được dọn dẹp.

2. **Rủi ro Toàn vẹn Dữ liệu khi Xóa / Hủy Nhiệm vụ (Cascading Deletion Mismatch)**:
   - Trong `src/server/tasks/task-command-service.ts` (dòng 1234, 1250), khi thực hiện xóa nhiệm vụ hoặc xóa cây nhiệm vụ con, hệ thống chỉ kích hoạt lệnh:
     ```typescript
     await tx.dacumDelegation.deleteMany({ where: { taskId } });
     ```
   - Các bản ghi `DelegationGrant` hoặc `DelegationScopeRule` liên kết tới nhiệm vụ này hoàn toàn không được xử lý đồng bộ, để lại các bản ghi rác trôi nổi (orphaned scope rules).

3. **Lệch pha Giao diện Người dùng và API (Client-Server Architectural Disconnect)**:
   - Giao diện quản lý ủy quyền cấp đơn vị (`src/components/dashboard/delegation-management-modal.tsx`) và định nghĩa kiểu dữ liệu phía Client (`src/types/delegation.ts`) vẫn hoàn toàn bám theo mô hình DACUM cũ (`grantorRole: ADMIN | MANAGER`, `scope: DACUM_REVIEW_STEP1 | TASK_ASSIGNMENT | FULL_DEPARTMENT_APPROVAL`).
   - Cụ thể, hàm lưu ủy quyền tại Client (`src/hooks/use-task-mutations.ts:534-544`) chỉ tạo ID giả lập (`del-${Date.now()}`) và cập nhật biến trạng thái React trên bộ nhớ RAM mà không hề gửi HTTP POST tới API `/api/delegations` chuẩn tắc đã được trang bị đầy đủ cơ chế xác thực và ghi vết kiểm toán.

4. **Nợ Kỹ thuật trong Công cụ Đồng bộ Dữ liệu (Transitional Migration Overhead)**:
   - Dự án hiện phải duy trì một kịch bản di trú dữ liệu tạm thời (`prisma/data-migrations/backfill-dacum-to-delegation-grants.ts`) được kích hoạt qua `run-all.ts` nhằm quét toàn bộ `DacumDelegation` để tạo bản ghi `DelegationGrant` tương đương.
   - Việc duy trì hai bảng cùng lúc làm tăng dung lượng lưu trữ, phức tạp hóa việc bảo trì chỉ mục cơ sở dữ liệu và cản trở việc chuẩn hóa toàn diện theo các quyết định kiến trúc ADR-002 và ADR-006.

---

## 2. Expressiveness & Model Comparison (So sánh Năng lực Biểu đạt & Mô hình Dữ liệu)

### 2.1 Bảng Đối chiếu Chi tiết Thuộc tính & Khả năng Biểu đạt

| Tiêu chí So sánh | Mô hình Kế thừa `DacumDelegation` | Mô hình Chuẩn tắc `DelegationGrant` | Đánh giá Kiến trúc |
| :--- | :--- | :--- | :--- |
| **Thực thể Đại diện (Subject / Object)** | `grantorId: String (FK -> User)`<br>`delegateId: String (FK -> User)` | `grantorAssignmentId: String (FK -> PositionAssignment)`<br>`granteeAssignmentId: String (FK -> PositionAssignment)` | **Vượt trội hoàn toàn**: Phù hợp Luật Cán bộ, công chức và Quy chế 283. Phân định rõ ràng khi một cán bộ kiêm nhiệm nhiều chức vụ. |
| **Phạm vi Đơn vị (Unit Scoping)** | `departmentId: String? (FK -> Department)` | Gắn gián tiếp qua `PositionAssignment.unitId` (`FK -> OrganizationalUnit`) | `DelegationGrant` kế thừa hoàn toàn mô hình hợp nhất đơn vị theo ADR-006. |
| **Mảng Trách nhiệm Thể chế (Portfolio Alignment)** | Không hỗ trợ (Hoàn toàn không có khái niệm `ResponsibilityArea`) | `responsibilityAreaId: String? (FK -> ResponsibilityArea)` | Bắt buộc đối với cấp Ban Giám hiệu theo Quyết định 420/QĐ-CĐKTCNQN (11 mảng trách nhiệm). |
| **Quyền năng Kỹ thuật (Capability / Action)** | `authorityScope: String (VarChar 255)` (Text tự do, không kiểm soát type) | `action: String (VarChar 100)` (Ràng buộc chặt chẽ với enum `CapabilityAction`) | Ngăn ngừa việc truyền các chuỗi hành động không xác định; cho phép phân giải chính xác qua `canPerformAction()`. |
| **Quy tắc Phạm vi Chi tiết (Granular Scope Rules)** | Chỉ có `taskId: String?` hoặc `departmentId: String?` trực tiếp trên bảng | Bảng con `DelegationScopeRule` (`entityType`, `entityId`, `constraintType`) | Cho phép mở rộng giới hạn ủy quyền theo từng tập hợp tài nguyên cụ thể (nhiệm vụ, loại văn bản, dự án). |
| **Cơ chế Quản lý Thời gian (Temporal Validity)** | `startDate: DateTime? (default now())`<br>`expiresAt: DateTime`<br>`isActive: Boolean` | `validFrom: DateTime`<br>`validUntil: DateTime`<br>`status: DelegationStatus (ACTIVE, PENDING, EXPIRED, REVOKED)` | Tránh mâu thuẫn trạng thái (ví dụ: `isActive = true` nhưng `expiresAt < now()`). Đánh giá trực tiếp theo dấu thời gian microsecond ICT (UTC+7). |
| **Vết Thu hồi Pháp lý (Revocation Traceability)** | Không lưu vết (Chỉ đổi `isActive = false`, đè `version`) | Lưu vết đầy đủ: `revokedAt: DateTime?`, `revokedReason: String?`, `DelegationStatus.REVOKED` | Đáp ứng tiêu chuẩn kiểm toán và bảo đảm tính bất khả chối bỏ (Non-repudiation) theo Luật Giao dịch điện tử. |
| **Căn cứ Pháp lý Văn bản (Legal Provenance)** | `documentRef: String? (VarChar 100)` (Không bắt buộc) | `sourceDocumentNumber: String (VarChar 100)` (Bắt buộc theo Nghị định 30/2020/NĐ-CP) | Đảm bảo tính hợp hiến/hợp pháp của văn bản hành chính; không thể tạo ủy quyền "miệng" trên hệ thống. |
| **Kiểm soát Tự Ủy quyền (Anti-Self-Delegation)** | Không có ràng buộc | Chặn cứng: `grantorAssignment.userId !== granteeAssignment.userId` | Ngăn chặn việc tự nâng quyền ảo hoặc tạo vòng lặp thẩm quyền. |
| **Kiểm soát Chu trình Vòng lặp (Circular Delegation)** | Không có | Thuật toán BFS đa cấp phát hiện cả vòng lặp nghịch đảo trực tiếp và vòng lặp qua nhiều trung gian | Loại bỏ hoàn toàn bế tắc phân quyền và gian lận ủy quyền chéo. |
| **Tích hợp Maker-Checker SoD (ADR-001)** | Kiểm tra rời rạc phía client (`canUserApproveTask`), bỏ sót người tạo task | Động cơ Step 10 chạy sau Step 8, kiểm tra đầy đủ 5 nhóm Maker và luôn ghi đè (Override) ủy quyền | Đảm bảo an toàn tuyệt đối, không có ngoại lệ. |

### 2.2 Phân tích Chi tiết Khả năng Biểu đạt Phạm vi (Scope Capabilities)

1. **Ràng buộc Mảng Trách nhiệm theo Quyết định 420/QĐ-CĐKTCNQN**:
   - Trong `DelegationGrant`, trường `responsibilityAreaId` cho phép Hiệu trưởng ủy quyền có giới hạn cho Phó Hiệu trưởng hoặc Trưởng phòng. Ví dụ: Phó Hiệu trưởng phụ trách mảng Đào tạo (`TRAINING`) chỉ có thể được ủy quyền phê duyệt các nhiệm vụ và văn bản thuộc lĩnh vực Đào tạo.
   - `DacumDelegation` hoàn toàn không có khả năng này; mọi ủy quyền đều mang tính chung chung hoặc chỉ gắn với một `departmentId`, không thể mô hình hóa được phân công chỉ đạo liên đơn vị của Ban Giám hiệu.

2. **Cấu trúc Năng lực Hành động (Capability Actions)**:
   - `DelegationGrant` ánh xạ trực tiếp tới danh mục thẩm quyền chuẩn tại `src/server/authorization/capability.ts` (ví dụ: `task.approve`, `task.review`, `document.outgoing.sign_kt`, `document.outgoing.sign_tuq`).
   - `DacumDelegation` sử dụng `authorityScope` chứa các chuỗi tùy biến như `"DACUM_REVIEW_STEP1"`, `"FULL_DEPARTMENT_APPROVAL"`. Các chuỗi này không tương thích với bộ kiểm tra quyền hạn của các phân hệ khác (Văn bản đi, Văn bản đến, Hồ sơ công việc).

3. **Cơ chế Ràng buộc Bổ trợ (`DelegationScopeRule`)**:
   - Model `DelegationScopeRule` hoạt động như một bộ lọc vị từ (predicate filter) gắn kèm `DelegationGrant`:
     ```prisma
     model DelegationScopeRule {
       id                String          @id @default(cuid())
       delegationGrantId String          @map("delegation_grant_id")
       entityType        String          @map("entity_type") @db.VarChar(50) // "TASK", "DOCUMENT", "PROGRAM"
       entityId          String?         @map("entity_id") @db.VarChar(100)  // ID cụ thể nếu ủy quyền 1 tài nguyên
       constraintType    String          @map("constraint_type") @db.VarChar(50) // "EQUALS", "IN_SCOPE"
       delegationGrant   DelegationGrant @relation(fields: [delegationGrantId], references: [id], onDelete: Cascade)
     }
     ```
   - Nhờ đó, một văn bản ủy quyền có thể bao hàm cả việc: *"Ủy quyền quyền phê duyệt nhiệm vụ (`task.approve`) nhưng chỉ giới hạn trong các nhiệm vụ thuộc Chương trình Chuyển đổi số (entityId: PROG_DIGITAL_TRANSFORM)"*.

---

## 3. Statutory & Legal Non-Delegable Boundaries (Ranh giới Thẩm quyền Luật định Bất khả Ủy quyền & Ràng buộc Pháp lý)

### 3.1 Căn cứ Thể chế & Quy định Pháp luật Việt Nam

Quá trình ủy quyền trong hệ thống thông tin điều hành của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn bắt buộc phải tuân thủ nghiêm ngặt các căn cứ pháp luật và quy chế nội bộ sau:

1. **Bộ luật Dân sự số 91/2015/QH13 (Điều 138, Điều 142)**:
   - Xác lập nguyên tắc đại diện theo ủy quyền.
   - **Quy định cấm tái ủy quyền (Prohibition of Sub-delegation)**: Người được ủy quyền chỉ được thực hiện công việc trong phạm vi ủy quyền và tuyệt đối không được ủy quyền lại cho người khác nếu không có sự đồng ý bằng văn bản của người ủy quyền ban đầu.
2. **Luật Giáo dục nghề nghiệp số 74/2014/QH13 & Thông tư số 63/2026/TT-BGDĐT (Điều lệ Trường Cao đẳng)**:
   - Quy định thẩm quyền tối cao và chế độ thủ trưởng của Hiệu trưởng - người đại diện theo pháp luật của Nhà trường, chủ tài khoản pháp định và người đứng đầu bộ máy.
3. **Nghị định số 30/2020/NĐ-CP (Điều 13, Phụ lục I)**:
   - Thể thức và thẩm quyền ký văn bản hành chính: Ký thay mặt (TM.), Ký thay (KT.), Ký thừa ủy quyền (TUQ.), Ký thừa lệnh (TL.).
   - Mọi trường hợp ký thừa ủy quyền bắt buộc phải có quyết định hoặc văn bản ủy quyền hợp lệ bằng văn bản và phải ghi rõ chức danh, số hiệu văn bản ủy quyền.
4. **Quyết định số 283/QĐ-CĐKTCNQN ngày 19/08/2026 của Hiệu trưởng QCET**:
   - Ban hành Quy chế làm việc của Nhà trường:
     - **Điều 3**: Chế độ trách nhiệm người đứng đầu, nguyên tắc một việc chỉ giao một người chủ trì và chịu trách nhiệm chính.
     - **Điều 4**: Nguyên tắc ủy quyền điều hành khi Hiệu trưởng hoặc Trưởng đơn vị đi công tác hoặc vắng mặt.
5. **Quyết định số 420/QĐ-CĐKTCNQN ngày 03/12/2025 của Hiệu trưởng QCET**:
   - Quy định phân công nhiệm vụ cụ thể giữa Hiệu trưởng và các Phó Hiệu trưởng; xác lập ranh giới 11 mảng trách nhiệm (`ResponsibilityArea`) và thẩm quyền ký thay trong từng lĩnh vực.
6. **Thông báo số 619/TB-CĐKTCNQN**:
   - Hướng dẫn việc phân công, ủy quyền xử lý công việc hành chính khi lãnh đạo vắng mặt.

### 3.2 Danh mục Thẩm quyền Luật định Bất khả Ủy quyền (`NON_DELEGABLE_CAPABILITIES`)

Dưới góc độ pháp lý, quyền lực công vụ của người đứng đầu đơn vị sự nghiệp công lập không thể được chuyển giao tùy tiện. Căn cứ Quy chế 283, Thông tư 63 và Luật Ngân sách Nhà nước, hệ thống đã mã hóa cứng danh mục các quyền năng **tuyệt đối không được phép đưa vào bất kỳ văn bản ủy quyền nào** (`src/server/authorization/capability.ts:227-240`):

```typescript
export const NON_DELEGABLE_CAPABILITIES: readonly CapabilityAction[] = [
  'position.manage_leadership',     // 1. Quản lý nhân sự lãnh đạo (Bổ nhiệm, miễn nhiệm, điều động Trưởng/Phó đơn vị)
  'hr.disciplinary_action',         // 2. Xử lý kỷ luật viên chức, người lao động
  'finance.treasury_disbursement',  // 3. Rút dự toán ngân sách Nhà nước, quyền Chủ tài khoản tại KBNN
  'regulation.institutional_amend', // 4. Ban hành, sửa đổi Quy chế tổ chức hoạt động, Quy chế chi tiêu nội bộ
  'account.manage',                 // 5. Quản lý danh bạ tài khoản hệ thống
  'system.configure',               // 6. Cấu hình tham số bảo mật toàn hệ thống
  'org.manage',                     // 7. Thành lập, giải thể, sáp nhập đơn vị tổ chức
  'position.manage',                // 8. Quản lý khung vị trí việc làm
  'system.account.manage',          // 9. Quản trị tài khoản hạ tầng
  'system.org.manage',              // 10. Quản trị cấu trúc tổ chức hạ tầng
  'system.position.manage',         // 11. Quản trị chức danh hạ tầng
  'system.system.configure',        // 12. Cấu hình hệ thống cấp thấp
] as const;
```

**Cơ chế Thực thi (Fail-Closed Enforcement)**:
- Tại tầng Service (`src/server/services/delegation-grant-service.ts:152-156`), khi hàm `createDelegation()` nhận yêu cầu, nếu `action` nằm trong danh mục trên, hệ thống ngay lập tức ném ra lỗi `ValidationError`:
  > *"Hành động '...' thuộc danh mục thẩm quyền luật định TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP ỦY QUYỀN theo quy định pháp luật và Điều lệ Trường."*
- Tại tầng REST API (`src/app/api/delegations/route.ts:292-299`), request bị từ chối với mã HTTP `403 Forbidden` và mã lỗi chuẩn `NON_DELEGABLE_POWER`.

### 3.3 Ràng buộc Bất biến Cốt lõi: Ủy quyền Tuyệt đối Không Vượt rào SoD (Maker-Checker Invariant & ADR-001)

Một trong những rủi ro gian lận quản trị nghiêm trọng nhất là việc một cán bộ tự phê duyệt công việc hoặc nghiệm thu sản phẩm do chính mình tạo ra bằng cách sử dụng "tấm bình phong" ủy quyền. 

**Nguyên tắc Bất biến Toàn hệ thống (System Invariant)**:
> **Một cá nhân là Maker của nhiệm vụ (người khởi tạo, người chịu trách nhiệm chính DRI, người thực thi, người nộp báo cáo hoặc người tải lên minh chứng) TIẾP TỤC BỊ CẤM TUYỆT ĐỐI khỏi việc phê duyệt hoặc nghiệm thu nhiệm vụ đó, KỂ CẢ KHI người đó đang nắm giữ giấy ủy quyền phê duyệt (`DelegationGrant`) hợp lệ từ cấp trên.**

#### Bằng chứng Hiện thực Kiến trúc trong Động cơ Phân quyền 10 Bước

Sự ưu tiên tối cao của nguyên tắc Phân lập Trách nhiệm (Separation of Duties - SoD) so với cơ chế Ủy quyền được bảo đảm tuyệt đối thông qua thứ tự thực thi trong đường ống kiểm tra của `src/server/authorization/authorization-engine.ts`:

```
[Incoming Request: action = "task.approve"]
                  │
                  ▼
┌────────────────────────────────────────────────────────┐
│ BƯỚC 8: ĐÁNH GIÁ VĂN BẢN ỦY QUYỀN (Delegation Grant)   │
│ - Kiểm tra thời gian: validFrom <= NOW <= validUntil   │
│ - Kiểm tra mảng phụ trách: ResponsibilityArea          │
│ - Kiểm tra hành vi: action == "task.approve"           │
│ - Khớp ủy quyền thành công!                            │
│   ==> candidateAllowed = true                          │
│   ==> candidateGrant = grant                           │
└─────────────────────────┬──────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────┐
│ BƯỚC 10: KIỂM SOÁT PHÂN LẬP TRÁCH NHIỆM (SoD Guard)   │
│ - Gọi hàm canonical: checkSeparationOfDuties(...)      │
│ - Kiểm tra xem actor.userId có trùng với:              │
│   + creatorId / createdById (Người tạo việc)           │
│   + primaryOwnerId / driId / leadUserId (Người chủ trì)│
│   + assigneeIds / assignees (Cán bộ thực hiện)         │
│   + submittedByUserId (Người nộp báo cáo)              │
│   + deliverableUploadedByIds (Người tải minh chứng)    │
└─────────────────────────┬──────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │ Actor LÀ Maker                │ Actor KHÔNG LÀ Maker
          ▼                               ▼
┌───────────────────────────���───┐ ┌───────────────────────────────┐
│ TỪ CHỐI TUYỆT ĐỐI (DENY)      │ │ CHẤP THUẬN THAO TÁC (ALLOW)   │
│ - rejectionCode: SOD_VIOLATION│ │ - Ghi nhận dấu ấn ủy quyền:   │
│ - policyMatched:              │ │   delegationGrantId           │
│   STEP_10_CREATOR_NOT_APPROVER│ │   sourceDocumentNumber        │
│ ==> GHI ĐÈ BƯỚC 8 HOÀN TOÀN   │ │   grantorId                   │
└───────────────────────────────┘ └───────────────────────────────┘
```

Theo kiến trúc trên:
1. Bước 8 chỉ làm nhiệm vụ mở rộng thẩm quyền danh nghĩa (đóng vai trò thay thế vị trí của Grantor).
2. Bước 10 chạy sau Bước 8 và đóng vai trò người gác cổng tối cao. Nếu hàm `checkSeparationOfDuties()` (chuẩn hóa theo ADR-001) trả về `allowed: false`, toàn bộ quyết định của Bước 8 bị hủy bỏ ngay lập tức, trả về mã lỗi `SOD_VIOLATION`.
3. Do đó, **về mặt toán học và logic kiến trúc, không một giấy ủy quyền nào có thể giúp một cán bộ tự phê duyệt công việc của chính m��nh**.

### 3.4 Các Ràng buộc Bất biến Bổ trợ Khác

1. **Cấm Tái Ủy quyền (Prohibition of Sub-delegation)**:
   - Theo Điều 142 Bộ luật Dân sự 2015, người được ủy quyền không có quyền ủy thác tiếp cho bên thứ ba.
   - Hệ thống ngăn chặn điều này bằng cách kiểm tra nguồn gốc vị trí: Nếu một vị trí đang thực thi quyền năng phái sinh từ một `DelegationGrant`, hệ thống chặn không cho phép tạo `DelegationGrant` thứ cấp.
2. **Phát hiện Chu trình Ủy quyền Vòng tròn (BFS Circular Delegation Detection)**:
   - `DelegationGrantService.detectCircularDelegation()` (`src/server/services/delegation-grant-service.ts:388-447`) chạy thuật toán duyệt đồ thị theo chiều rộng (Breadth-First Search) để phát hiện cả ủy quyền chéo trực tiếp (A -> B và B -> A) lẫn chu trình đa cấp (A -> B -> C -> A).
3. **Tự động Thu hồi Dạng Xếp tầng (Cascade Auto-Revocation on Position Termination)**:
   - Khi một viên chức được điều động, bổ nhiệm vị trí mới hoặc thôi giữ chức vụ (`PositionAssignment` chuyển sang trạng thái `TERMINATED` hoặc `SUPERSEDED`), dịch vụ quản lý vị trí (`src/server/services/position-assignment-service.ts:445-455, 555`) tự động kích hoạt thu hồi tất cả các `DelegationGrant` mà vị trí này đã ban hành hoặc tiếp nhận, tránh hiện tượng thẩm quyền "ma" tồn tại sau luân chuyển công tác.

---

## 4. Consumer Audit (Kiểm toán Toàn diện Hiện trạng Sử dụng Trong Codebase)

Để phục vụ kế hoạch di trú an toàn, nhóm kiến trúc đã thực hiện kiểm toán toàn diện tất cả các tệp mã nguồn, định nghĩa dữ liệu, API và giao diện có liên quan đến hai mô hình ủy quyền:

### 4.1 Tầng Cơ sở Dữ liệu & Di trú Dữ liệu (Database & Migrations)

| Vị trí Tệp Mã Nguồn | Thực thể Tham chiếu | Nội dung & Mục đích Sử dụng |
| :--- | :--- | :--- |
| `prisma/schema.prisma:314-338` | `model DacumDelegation` | Bảng kế thừa `dacum_delegations` (gắn với `User`, `Department`, `Task`). Cần lập kế hoạch loại bỏ. |
| `prisma/schema.prisma:1071-1096` | `model DelegationGrant` | Bảng chuẩn tắc `delegation_grants` (gắn với `PositionAssignment`, `ResponsibilityArea`). |
| `prisma/schema.prisma:1098-1109` | `model DelegationScopeRule` | Bảng con lưu trữ điều kiện lọc tài nguyên chi tiết của `DelegationGrant`. |
| `prisma/data-migrations/backfill-dacum-to-delegation-grants.ts` | Cả 2 mô hình | Kịch bản quét `DacumDelegation` và tự động sinh `DelegationGrant` tương đương để duy trì tính tương thích tạm thời. |
| `prisma/data-migrations/run-all.ts:33-61` | `backfillDacumToDelegationGrants` | Bước thực thi thứ 3 trong chuỗi migration tổng thể. |
| `src/lib/db/occ.ts:15, 109, 271-278` | `DacumDelegation` | Cung cấp hàm kiểm soát tương tranh lạc quan `updateDacumDelegationWithOCC` cho bảng DACUM cũ. |

### 4.2 Tầng Động cơ Phân quyền & Quản lý Ngữ cảnh (Authorization & Context)

| Vị trí Tệp Mã Nguồn | Thực thể Tham chiếu | Nội dung & Mục đích Sử dụng |
| :--- | :--- | :--- |
| `src/server/authorization/authorization-context.ts:69-105` | `interface ActiveDelegationGrant` | Hợp đồng ngữ cảnh định nghĩa các thông tin ủy quyền hợp lệ được nạp vào phiên làm việc. |
| `src/server/authorization/authorization-context-service.ts:168-245` | Chỉ `DelegationGrant` | Bước 4 nạp các ủy quyền đang hoạt động. **Ghi chú kiến trúc khẳng định: Chỉ nạp `DelegationGrant`, tuyệt đối không nạp `DacumDelegation`**. |
| `src/server/authorization/authorization-engine.ts:950-1020` | `ActiveDelegationGrant` | Bước 8: Đánh giá quyền ủy quyền hợp lệ, ghi đè ranh giới đơn vị và m���ng trách nhiệm danh nghĩa. |
| `src/server/authorization/authorization-engine.ts:1250-1410` | Canonical SoD Guard | Bước 10: Chặn tự phê duyệt đối với người tạo lập/chủ trì, ghi đè quyết định của Bước 8. |
| `src/server/authorization/capability.ts:227-240` | `NON_DELEGABLE_CAPABILITIES` | Danh mục 12 hành vi thẩm quyền luật định bất khả chuyển giao. |
| `src/server/authorization/authorization-audit.ts:33, 84-104` | `delegationGrantId` | Ghi vết kiểm toán hành vi ủy quyền vào nhật ký hệ thống `AuditLog`. |
| `src/server/authorization/authorization-context-cache.ts:15, 302-315` | `DelegationGrant` | Vô hiệu hóa bộ nhớ đệm ngữ cảnh hai chiều (Two-Way Cache Invalidation) khi ủy quyền được tạo hoặc thu hồi. |

### 4.3 Tầng Dịch vụ Nghiệp vụ (Application & Domain Services)

| Vị trí Tệp Mã Nguồn | Thực thể Tham chiếu | Đánh giá & Rủi ro Kiến trúc |
| :--- | :--- | :--- |
| `src/server/services/delegation-grant-service.ts` | Chỉ `DelegationGrant` | Dịch vụ chuẩn tắc xử lý tạo, thu hồi, duyệt chu trình BFS, tra cứu lịch sử ủy quyền. |
| `src/server/tasks/task-policy.ts:32-84` | Cả 2 mô hình (`checkActiveDelegation`) | **VÙNG NỢ KỸ THUẬT**: Kiểm tra `DelegationGrant` trước, nếu không thấy thì fallback sang `DacumDelegation`. Cần loại bỏ fallback. |
| `src/server/tasks/task-command-service.ts:1234, 1250` | Chỉ `dacumDelegation` | **RỦI RO CAO**: Khi xóa nhiệm vụ chỉ xóa trong `dacumDelegation`, bỏ sót các ràng buộc trong `DelegationScopeRule`. |
| `src/server/services/position-assignment-service.ts:445, 555` | Chỉ `DelegationGrant` | Tự động thu hồi cascade tất cả các `DelegationGrant` khi một vị trí công tác bị chấm dứt. |
| `src/server/services/action-inbox-service.ts:110-120` | Chỉ `DelegationGrant` | Nạp các tác vụ cần xử lý vào Hộp thư công vụ dựa trên các thẩm quyền được ủy quyền hợp lệ. |
| `src/lib/services/incoming-document-service.ts:228-260` | Chỉ `DelegationGrant` | Phân phối và xử lý văn bản đến theo quyền ủy quyền. |
| `src/lib/services/dossier-service.ts:190-210` | Chỉ `DelegationGrant` | Kiểm soát quyền đọc và thụ lý hồ sơ công việc theo ủy quyền. |
| `src/lib/auth/hybrid-authorization.ts:181, 1164` | `ActiveDelegationGrantContext` | Lớp tương thích phân quyền lai (Hybrid Authorization Adapter). |

### 4.4 Tầng REST API

| Endpoint & Tệp Handler | Thực thể Tham chiếu | Đánh giá Chức năng |
| :--- | :--- | :--- |
| `GET /api/delegations`<br>`src/app/api/delegations/route.ts:76-240` | `DelegationGrant` | Liệt kê danh sách ủy quyền; tích hợp kiểm soát BOLA (Issue #28) và phân quyền phạm vi đơn vị chặt chẽ. |
| `POST /api/delegations`<br>`src/app/api/delegations/route.ts:247-530` | `DelegationGrant` | Tiếp nhận và xác thực tạo ủy quyền mới; kiểm tra quyền hạn, chặn non-delegable capabilities, ghi log giao dịch. |
| `POST /api/delegations/[id]/revoke`<br>`src/app/api/delegations/[id]/revoke/route.ts` | `DelegationGrant` | Thu hồi ủy quyền hợp pháp; cập nhật trạng thái `REVOKED` và xóa cache ngữ cảnh hai chiều. |

### 4.5 Tầng Giao diện Người dùng & Client State (UI Components & Hooks)

| Vị trí Tệp Mã Nguồn | Thực thể / Khái niệm Sử dụng | Vấn đề & Khoảng cách với Canonical Model |
| :--- | :--- | :--- |
| `src/types/delegation.ts` | `interface DelegationRule`<br>`type DelegationScope` | **HOÀN TOÀN LẠC HẬU**: Vẫn dùng kiểu dữ liệu mô phỏng DACUM cũ (`grantorRole: ADMIN | MANAGER`, `scope: DACUM_REVIEW_STEP1...`). |
| `src/lib/delegation-authority-engine.ts` | `canUserApproveTask()` | **LOGIC PHÂN TÁN**: Hàm kiểm tra thẩm quyền phê duyệt phía client; kiểm tra SoD chưa đầy đủ so với Step 10 của server. |
| `src/hooks/use-task-mutations.ts:130-160` | `fetch("/api/delegations")` | Gọi API chuẩn nhưng lại chuyển đổi (map) ngược về định dạng `DelegationRule` cũ. |
| `src/hooks/use-task-mutations.ts:534-550` | `handleSaveDelegation`<br>`handleRevokeDelegation` | **MOCK TẠI CHỖ**: Hàm lưu/hủy chỉ chỉnh sửa mảng trong React state, không gọi POST tới `/api/delegations`. |
| `src/components/dashboard/delegation-management-modal.tsx` | Form tạo ủy quyền | Giao diện cho phép chọn người trong phòng ban, tạo ID giả (`grantee-${Date.now()}`), lưu vào context nội bộ. |
| `src/components/dashboard/dashboard-modals-host.tsx` | Host component | Truyền hàm `handleSaveDelegation` và danh sách `delegations` xuống modal. |
| `src/components/dashboard/task-detail-side-sheet.tsx:52, 799` | `delegations` prop | Sử dụng danh sách ủy quyền để tính toán quyền hiển thị nút bấm phê duyệt nhiệm vụ phía client. |
| `src/components/dashboard/department-grouped-task-view.tsx:282` | `delegations` prop | Đếm số lượng ủy quyền đang hoạt động của đơn vị. |
| `src/components/layout/scope-switcher.tsx:584` | Event trigger | Phát sự kiện `qcet:open-delegation-modal` để mở modal ủy quyền. |

---

## 5. Unified Model Proposal (Đề xuất Mô hình Hợp nhất Chuẩn tắc)

### 5.1 Khẳng định Mô hình Duy nhất: `DelegationGrant` là Canonical Aggregate Root

Nhóm Kiến trúc đề xuất xóa bỏ hoàn toàn thực thể `DacumDelegation` và quy tụ 100% nghiệp vụ ủy quyền trong toàn hệ thống về một Aggregate Root duy nhất: **`DelegationGrant`**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DelegationGrant (Aggregate Root)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ - id: String (CUID, Khóa chính duy nhất)                                    │
│ - grantorAssignmentId: String (FK -> PositionAssignment của người giao)     │
│ - granteeAssignmentId: String (FK -> PositionAssignment của ngư���i nhận)     │
│ - responsibilityAreaId: String? (FK -> ResponsibilityArea theo QĐ 420)      │
│ - action: String (Khớp CapabilityAction, ví dụ: "task.approve")             │
│ - resourceScope: String ("INSTITUTION", "UNIT", "SPECIFIC_TASK", ...)       │
│ - validFrom: DateTime (Thời điểm bắt đầu, ICT / UTC+7)                      │
│ - validUntil: DateTime (Thời điểm kết thúc, ICT / UTC+7)                    │
│ - sourceDocumentNumber: String (Số QĐ/TB ủy quyền theo NĐ 30/2020)          │
│ - reason: String? (Lý do ủy quyền / phân công)                              │
│ - status: DelegationStatus (ACTIVE | PENDING | EXPIRED | REVOKED)           │
│ - revokedAt: DateTime? (Thời điểm thu hồi)                                  │
│ - revokedReason: String? (Lý do thu hồi)                                    │
│ - createdAt: DateTime                                                       │
│ - updatedAt: DateTime                                                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 1
                                       │
                                       │ 0..*
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DelegationScopeRule                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ - id: String (CUID)                                                         │
│ - delegationGrantId: String (FK -> DelegationGrant)                         │
│ - entityType: String ("TASK", "DOCUMENT", "PROGRAM", "PROJECT")             │
│ - entityId: String? (ID cụ thể của thực thể đích nếu ủy quyền theo tài nguyên)│
│ - constraintType: String ("EQUALS", "IN_SCOPE", "EXCLUDE")                  │
│ - createdAt: DateTime                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Cơ chế Hỗ trợ Ủy quyền Cấp Nhiệm vụ (Task-Level Granularity Support)

Một trong những lý do khiến `DacumDelegation` còn tồn tại là trường `taskId: String?` cho phép ủy quyền phê duyệt hoặc thực hiện trên đúng **một nhiệm vụ cụ thể**.

Để mô hình hợp nhất thay thế hoàn hảo tính năng này mà vẫn bảo đảm tính tổng quát cao, hai phương án kiến trúc được đánh giá:

- **Phương án A (Dùng bảng con `DelegationScopeRule`)**:
  - Đặt `resourceScope = "SPECIFIC_TASK"`.
  - Tạo một bản ghi `DelegationScopeRule` với `entityType = "TASK"` và `entityId = taskId`.
  - *Ưu điểm*: Cực kỳ linh hoạt, áp dụng đồng nhất cho cả Document, Task, Project.
  - *Nhược điểm*: Phải JOIN thêm bảng khi kiểm tra thẩm quyền một task cụ thể.
- **Phương án B (Hybrid Approach - Khuyến nghị)**:
  - Sử dụng bảng con `DelegationScopeRule` làm cơ chế tổng quát chuẩn tắc.
  - Khi tra cứu trong `authorization-context-service.ts`, các `scopeRules` của active grants được nạp sẵn vào bộ nhớ RAM của context (đối tượng `ActiveDelegationGrant.scopeRules`).
  - Hàm `matchesScope()` trong động cơ ReBAC thực hiện so sánh in-memory:
    ```typescript
    if (grant.resourceScope === 'SPECIFIC_TASK') {
      const match = grant.scopeRules?.some(
        (r) => r.entityType === 'TASK' && r.entityId === resource.id
      );
      if (!match) return false;
    }
    ```
  - *Kết luận*: Phương án B đáp ứng 100% yêu cầu kỹ thuật mà không cần thêm cột dư thừa vào bảng chính `delegation_grants`.

### 5.3 Đồng bộ Hóa Kiểu Dữ liệu Client-Server (Canonical DTO Alignment)

Thay thế hoàn toàn cấu trúc `DelegationRule` cũ tại `src/types/delegation.ts` bằng `DelegationGrantDTO` chuẩn:

```typescript
export interface DelegationGrantDTO {
  id: string;
  grantorAssignmentId: string;
  grantorUserId: string;
  grantorName: string;
  grantorPositionTitle: string;
  grantorUnitName: string;
  granteeAssignmentId: string;
  granteeUserId: string;
  granteeName: string;
  granteePositionTitle: string;
  granteeUnitName: string;
  action: CapabilityAction;
  resourceScope: string;
  responsibilityAreaId?: string | null;
  responsibilityAreaName?: string | null;
  validFrom: string; // ISO 8601
  validUntil: string; // ISO 8601
  sourceDocumentNumber: string;
  reason?: string | null;
  status: "ACTIVE" | "PENDING" | "EXPIRED" | "REVOKED";
  revokedAt?: string | null;
  revokedReason?: string | null;
  scopeRules?: Array<{
    id: string;
    entityType: string;
    entityId?: string | null;
    constraintType: string;
  }>;
}
```

---

## 6. Phased Transition Plan & Migration Roadmap (Lộ trình Chuyển đổi Theo Giai đoạn)

Việc hợp nhất hai mô hình ủy quyền phải được tiến hành thận trọng qua 4 giai đoạn độc lập nhằm bảo đảm hệ thống vận hành liên tục 24/7, không gây gián đoạn công tác điều hành tại các đơn vị:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: ĐỐI SOÁT & ĐẢM BẢO TƯƠNG ĐỒNG (Phase 1: Parity & Bridge)      │
│ [Trạng thái hiện tại - WI-3.2]                                              │
│ - Ban hành RFC-03 phân tích toàn diện.                                     │
│ - Duy trì kịch bản backfill-dacum-to-delegation-grants.ts trong CI/CD.      │
│ - Giữ nguyên mã nguồn nghiệp vụ, không sửa schema.                          │
└─────────────���────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: CHUẨN HÓA GIAO DIỆN & KẾT NỐI API (Phase 2: UI Realignment)   │
│ [Dự kiến triển khai: Sprint kế tiếp]                                        │
│ - Tái cấu trúc DelegationManagementModal: Chọn PositionAssignment thực tế. │
│ - Kết nối trực tiếp Form UI với POST /api/delegations & revoke API.        │
│ - Loại bỏ mock state trên RAM tại use-task-mutations.ts.                    │
│ - Chuẩn hóa types/delegation.ts sang DelegationGrantDTO.                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: TÁCH RỜI PHÍA SERVER & CẮT CẦU (Phase 3: Server Decoupling)   │
│ - Cắt bỏ nhánh fallback DacumDelegation tại src/server/tasks/task-policy.ts.│
│ - Cập nhật task-command-service.ts để xóa DelegationScopeRule khi xóa Task. │
│ - Loại bỏ DacumDelegation khỏi src/lib/db/occ.ts.                           │
│ - Đảm bảo 100% luồng kiểm tra quyền hạn chỉ đi qua DelegationGrant.         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 4: DỌN DẸP SCHEMA & HOÀN TẤT DI TRÚ (Phase 4: Schema Pruning)     │
│ - Chạy migration Prisma cuối cùng: DROP TABLE dacum_delegations.             │
│ - Xóa model DacumDelegation khỏi prisma/schema.prisma.                       │
│ - Xóa bỏ kịch bản backfill-dacum-to-delegation-grants.ts.                    │
│ - Hoàn tất hợp nhất 100%.                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Chi tiết Thực hiện Từng Giai đoạn

#### Giai đoạn 1: Đối soát & Đảm bảo Tương đồng (Parity & Verification) — Hiện tại
- **Mục tiêu**: Lập tài liệu phân tích RFC-03, bảo đảm 100% dữ liệu lịch sử trong `dacum_delegations` đã có bản ghi đối ứng hợp lệ trong `delegation_grants`.
- **Hành động kỹ thuật**: Không chỉnh sửa schema, không sửa mã nguồn. Kiểm tra báo cáo của `backfill-dacum-to-delegation-grants.ts` để khẳng định `paritySuccess = true` và `mismatchCount = 0`.

#### Giai đoạn 2: Chuẩn hóa Giao diện & Kết nối API (Client UI Realignment)
- **Mục tiêu**: Đưa trải nghiệm người dùng trên Bàn làm việc về đúng chuẩn pháp lý công vụ.
- **Hành động kỹ thuật**:
  1. Cập nhật `DelegationManagementModal`: Thay vì nhập text tên cán bộ tự do, tích hợp component chọn cán bộ gắn với `PositionAssignment` tích cực tại đơn vị (kế thừa từ `usePersonnelList` / `useDepartmentList`).
  2. Bắt buộc người dùng nhập số văn bản căn cứ (`sourceDocumentNumber`) và chọn mảng phụ trách nếu thuộc BGH.
  3. Gắn lệnh gọi `fetch("/api/delegations", { method: "POST", body })` thật vào hàm `handleSubmit`, hiển thị thông báo lỗi RFC 9457 rõ ràng nếu vi phạm SoD hoặc Non-delegable.
  4. Nút hủy ủy quyền gọi `POST /api/delegations/[id]/revoke`.

#### Giai đoạn 3: Tách rời Phía Server & Cắt Cầu Fallback (Server Decoupling)
- **Mục tiêu**: Xóa bỏ hoàn toàn sự phụ thuộc runtime vào bảng `dacum_delegations`.
- **Hành động kỹ thuật**:
  1. Sửa `src/server/tasks/task-policy.ts`: Trong hàm `checkActiveDelegation()`, loại bỏ hoàn toàn khối `if (tx.dacumDelegation) { ... }`, chỉ giữ lại nhánh truy vấn `tx.delegationGrant`.
  2. Sửa `src/server/tasks/task-command-service.ts`: Thay thế lệnh xóa `dacumDelegation` bằng lệnh dọn dẹp các `delegationScopeRule` có `entityType = 'TASK'` và `entityId = taskId`.
  3. Xóa `dacumDelegation` khỏi danh sách entity quản lý của `src/lib/db/occ.ts`.

#### Giai đoạn 4: Dọn dẹp Schema & Đóng Vĩnh viễn (Schema Sunset)
- **Mục tiêu**: Loại bỏ code thừa, tối ưu cơ sở dữ liệu.
- **Hành động kỹ thuật**:
  1. Xóa `model DacumDelegation` và các quan hệ ngược (`delegationsGranted`, `delegationsReceived` trong model `User`, `delegations` trong model `Department` và `Task`) khỏi `prisma/schema.prisma`.
  2. Tạo migration an toàn thực hiện `DROP TABLE "dacum_delegations"`.
  3. Xóa file `prisma/data-migrations/backfill-dacum-to-delegation-grants.ts`.

---

## 7. Risk Assessment & Mitigations (Đánh giá Rủi ro & Biện pháp Giảm thiểu)

| Rủi ro Tiềm ẩn | Mức độ | Biện pháp Giảm thiểu & Kiểm soát |
| :--- | :---: | :--- |
| **Mất mát thẩm quyền đang có của cán bộ cấp khoa/phòng khi cắt fallback** | Trung bình | Kịch bản backfill đã đối soát 100% dữ liệu sang `DelegationGrant`. Trước khi cắt nhánh fallback ở Phase 3, chạy script kiểm tra đối chiếu lần cuối. |
| **Người dùng tạo ủy quyền mới trên UI bị lỗi do thiếu PositionAssignment** | Thấp | Toàn bộ nhân sự chính thức của trường đã được gán `PositionAssignment` qua migration Phase 2. Giao diện chỉ cho phép chọn các viên chức có vị trí công tác đang hoạt động (`AssignmentStatus.ACTIVE`). |
| **Cán bộ lợi dụng ủy quyền để tự nghiệm thu sản phẩm của mình** | Cao | Đã được bảo vệ tuyệt đối: Động cơ Step 10 SoD thực thi sau Step 8 và ghi đè toàn bộ quyết định ủy quyền nếu phát hiện xung đột lợi ích (ADR-001). |
| **Xung đột bộ nhớ đệm phân quyền khi ủy quyền bị thu hồi đột xuất** | Trung bình | Dịch vụ `DelegationGrantService.revokeDelegation()` tự động kích hoạt `authorizationContextCache.invalidateAuthorizationContextCache()` cho cả người ủy quyền và người nhận quyền ngay trong cùng giao dịch. |

---

## 8. Decision Summary & Action Items (Tóm tắt Quyết định & Các Bước Tiếp theo)

1. **Khẳng định Định hướng**: Chấp thuận định hướng hợp nhất toàn diện mô hình ủy quyền về một thực thể chuẩn tắc duy nhất: `DelegationGrant`.
2. **Kế hoạch Thực thi Ngay (WI-3.2)**: 
   - Đóng Issue #58 với tài liệu phân tích kiến trúc RFC-03 hoàn chỉnh tại `docs/architecture/decisions/RFC-03-delegation-consolidation.md`.
   - Giữ nguyên trạng thái mã nguồn và schema dữ liệu theo đúng phạm vi của nhiệm vụ kiểm toán.
3. **Kế hoạch Cho Các Work Items Kế tiếp**:
   - Mở Work Item thực thi Phase 2: Nâng cấp `DelegationManagementModal` kết nối API thật và loại bỏ mock state phía Client.
   - Mở Work Item thực thi Phase 3 & 4: Cắt bỏ fallback trong `task-policy.ts` và tạo migration xóa bảng `dacum_delegations`.
