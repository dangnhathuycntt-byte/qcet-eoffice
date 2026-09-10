# QCET E-Office — Domain Specification: Organization & Institutional Structure
**Document Code:** `SPEC-DOMAIN-ORG-2026-01`  
**Domain:** Core Organizational Hierarchy, Institutional Bodies, and Temporal Validity  
**Institution:** Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh (QCET)  
**Status:** Canonical Domain Specification  
**Version:** 1.0.0  
**Effective Date:** 2026-09-09  

---

## 1. Executive Domain Summary

The Organization domain models the administrative, academic, and structural reality of Quang Ninh College of Economic and Technology (Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh - QCET). The institutional structure is not a static tree; it is a **temporally versioned, regulatory-bound network** of organizational units and cross-functional collective bodies.

### 1.1. Core Regulatory Foundations
1. **Quyết định số 282/QĐ-CĐKTCNQN (19/08/2026)**: Sửa đổi, bổ sung Quy chế tổ chức và hoạt động của Nhà trường; chuẩn hóa hệ thống 05 Phòng chức năng, 02 Trung tâm trực thuộc và 09 Khoa đào tạo chuyên môn (tổng cộng 16 đơn vị cấu thành, gồm 07 đơn vị tham mưu/dịch vụ số và 09 đơn vị đào tạo chuyên môn).
2. **Phương án số 690/ĐA-CĐKTCNQN (19/08/2026)**: Sắp xếp, tinh gọn tổ chức bộ máy và bố trí nhân sự giai đoạn 2026-2030; quy định cơ chế sáp nhập, chuyển tiếp và phân bổ lại nguồn lực.
3. **Quyết định số 283/QĐ-CĐKTCNQN (19/08/2026)**: Quy chế làm việc của Nhà trường, xác lập nguyên tắc tập trung dân chủ, chế độ thủ trưởng và trách nhiệm người đứng đầu đơn vị.
4. **Thông tư số 63/2026/TT-BGDĐT**: Ban hành Điều lệ trường cao đẳng; quy định thẩm quyền của Hội đồng trường, Ban Giám hiệu, Trưởng khoa và các hội đồng tư vấn.

### 1.2. Ubiquitous Language (Ngôn ngữ chung)
- **OrganizationalUnit (Đơn vị cấu thành)**: Một thực thể hành chính hoặc chuyên môn có thẩm quyền, chức năng và cơ cấu nhân sự xác định theo quyết định thành lập của Nhà trường hoặc cơ quan chủ quản.
- **Unit Hierarchy (Cấp bậc đơn vị)**: Phân cấp hành chính xác định luồng báo cáo, quan hệ chỉ đạo và phạm vi phân quyền, bao gồm 6 cấp: `SCHOOL`, `FACULTY`, `DEPARTMENT`, `CENTER`, `SECTION`, `OTHER`.
- **Temporal Validity (Hiệu lực thời gian)**: Khoảng thời gian pháp lý (`effectiveFrom` đến `effectiveTo`) mà một đơn vị hoặc mối quan hệ tổ chức tồn tại và có giá trị pháp lý, ngăn ngừa việc xóa cứng dữ liệu lịch sử.
- **Successor Unit (Đơn vị kế thừa)**: Đơn vị tiếp nhận chức năng, nhiệm vụ và dữ liệu lịch sử của một hoặc nhiều đơn vị bị sáp nhập hoặc giải thể theo phương án tinh gọn bộ máy.
- **Predecessor Unit (Đơn vị tiền nhiệm)**: Đơn vị ban đầu bị giải thể hoặc chuyển giao chức năng cho đơn vị kế thừa.
- **OrganizationalBody (Tổ chức / Hội đồng chuyên trách)**: Cơ quan tập thể (Hội đồng trường, Ban chỉ đạo, Hội đồng khoa học, Tổ công tác) được thành lập theo quyết định riêng, quy tụ nhân sự từ nhiều đơn vị khác nhau để thực hiện mục tiêu chuyên biệt.
- **BodyMembership (Tư cách thành viên Hội đồng)**: Quan hệ bổ nhiệm một viên chức vào một vị trí xác định trong Hội đồng/Ban chuyên trách (`CHAIR`, `VICE_CHAIR`, `SECRETARY`, `MEMBER`) theo một nhiệm kỳ cụ thể.

---

## 2. Domain Models & Aggregates

### 2.1. OrganizationalUnit Aggregate
An `OrganizationalUnit` represents a formal administrative division.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OrganizationalUnit (Aggregate Root)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID / CUID                                                           │
│ - code: String (e.g., "K_CNTT", "P_QLDT", "TT_STT") [Immutable Canonical]   │
│ - name: String (e.g., "Khoa Công nghệ thông tin")                           │
│ - shortName: String (e.g., "Khoa CNTT")                                     │
│ - type: UnitType (SCHOOL | FACULTY | DEPARTMENT | CENTER | SECTION | OTHER) │
│ - parentUnitId: UUID? (Points to superior unit)                             │
│ - level: Integer (0: School, 1: Faculty/Dept/Center, 2: Section/Dept-division│
│ - effectiveFrom: Date                                                       │
│ - effectiveTo: Date?                                                        │
│ - status: UnitStatus (ACTIVE | REORGANIZING | MERGED | DISSOLVED | SUSPENDED)│
│ - successorUnitId: UUID? (Points to successor unit after merge/dissolution) │
│ - legalDocumentRef: String (e.g., "282/QĐ-CĐKTCNQN")                         │
│ - displayOrder: Integer                                                     │
│ - createdAt: DateTime                                                       │
│ - updatedAt: DateTime                                                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 1
                                       │
                                       │ 0..*
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UnitReorganizationEvent (Entity)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                  │
│ - eventType: ReorgType (ESTABLISHMENT | MERGER | SPLIT | DISSOLUTION | RENAME)│
│ - decisionRef: String (e.g., "Phương án 690/ĐA-CĐKTCNQN")                  │
│ - executionDate: Date                                                       │
│ - notes: String                                                             │
│ - affectedUnitIds: List<UUID>                                               │
│ - createdByUserId: UUID                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Canonical Unit Hierarchy Classification:
| UnitType | Định nghĩa tiếng Việt | Phạm vi thẩm quyền & Ví dụ thực tế | Mã chuẩn tắc QCET |
|---|---|---|---|
| `SCHOOL` | Cấp Trường | Toàn bộ Nhà trường (Cơ quan chỉ đạo cao nhất) | `QCET_ROOT` |
| `FACULTY` | Khoa Đào tạo chuyên môn | Đào tạo chuyên môn, nghiên cứu ứng dụng, quản lý sinh viên (Khoa CNTT, Khoa Cơ khí, Khoa Điện, Khoa Ô tô, Khoa Du lịch, Khoa Kinh tế, Khoa VHNT, Khoa THPT, Khoa Nông nghiệp) | `K_CNTT`, `K_CK`, `K_OTO`, `K_DIEN`, `K_DL`, `K_KT`, `K_VHNT`, `K_THPT`, `K_NN` |
| `DEPARTMENT` | Phòng chức năng | Tham mưu, tổng hợp, điều hành nghiệp vụ (Phòng Quản lý Đào tạo, Phòng Hành chính - Quản trị, Phòng Tổ chức - Đảm bảo chất lượng, Phòng Tài chính, Phòng Tuyển sinh - HTQT) | `P_QLDT`, `P_HCQT`, `P_TCDBCL`, `P_TC`, `P_TSHTQT` |
| `CENTER` | Trung tâm trực thuộc | Cung cấp dịch vụ số, đào tạo ngắn hạn, dịch vụ hỗ trợ (Trung tâm Số - Truyền thông, Trung tâm Ngoại ngữ - Tin học) | `TT_STT`, `TT_NNTH` |
| `SECTION` | Bộ môn / Tổ chuyên môn | Đơn vị học thuật trực thuộc Khoa hoặc tổ nghiệp vụ trực thuộc Phòng (Bộ môn Phần mềm, Bộ môn Mạng máy tính, Tổ Văn thư - Lưu trữ) | `BM_PM`, `BM_MMT`, `TO_VTLU` |
| `OTHER` | Đơn vị đặc thù / Dự án | Trạm y tế cơ quan, Ban Quản lý dự án xây dựng, Văn phòng dự án ODA | `DA_XD_2026`, `TYT_CQ` |

---

### 2.2. OrganizationalBody & BodyMembership Aggregate
An `OrganizationalBody` represents a cross-functional collective entity. It has its own governance scope, leadership structure, and decision-making mandate.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OrganizationalBody (Aggregate Root)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID / CUID                                                           │
│ - code: String (e.g., "HD_TRUONG", "BCĐ_CDS", "HĐ_KHĐT", "TC_DACUM_CNTT")    │
│ - name: String (e.g., "Ban Ch�� đạo Chuyển đổi số và Ứng dụng AI")          │
│ - type: BodyType (COUNCIL | COMMITTEE | STEERING_COMMITTEE | WORKING_GROUP) │
│ - establishmentDecisionRef: String (e.g., "QĐ 115/QĐ-CĐKTCNQN")            │
│ - parentBodyId: UUID?                                                       │
│ - termStartDate: Date                                                       │
│ - termEndDate: Date?                                                        │
│ - mandateSummary: String                                                    │
│ - status: BodyStatus (ACTIVE | CONCLUDED | SUSPENDED)                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ 1
                                       │
                                       │ 1..*
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BodyMembership (Entity)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                  │
│ - bodyId: UUID                                                              │
│ - userId: UUID                                                              │
│ - positionAssignmentId: UUID (Binding to formal organizational position)    │
│ - roleInBody: BodyRole (CHAIR | VICE_CHAIR | SECRETARY | MEMBER)            │
│ - appointmentDecisionRef: String (e.g., "QĐ 116/QĐ-CĐKTCNQN")              │
│ - termStartDate: Date                                                       │
│ - termEndDate: Date?                                                        │
│ - status: MembershipStatus (ACTIVE | RELIEVED | EXPIRED)                    │
│ - relievedReason: String?                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Collective Body Classification:
1. `COUNCIL` (Hội đồng):
   - **Hội đồng trường (Governing Council)**: Cơ quan quản trị cao nhất theo Thông tư 63/2026/TT-BGDĐT.
   - **Hội đồng Khoa học và Đào tạo (Academic & Research Council)**: Tư vấn cho Hiệu trưởng về mở ngành, chương trình đào tạo, giáo trình và nghiên cứu.
   - **Hội đồng Thi đua - Khen thưởng & Kỷ luật**: Xem xét khen thưởng, thi đua và kỷ luật viên chức/học sinh sinh viên.
2. `STEERING_COMMITTEE` (Ban Chỉ đạo):
   - **Ban Chỉ đạo Chuyển đổi số & Cải cách hành chính**: Trực tiếp điều hành quá trình số hóa và triển khai QCET E-Office.
   - **Ban Chỉ đạo Tuyển sinh & Hợp tác doanh nghiệp**: Điều hành chiến dịch tuyển sinh các hệ đào tạo.
3. `COMMITTEE` (Ban chuyên môn):
   - Ban Thẩm định chương trình đào tạo, Ban Kiểm kê tài sản định kỳ, Ban Đón tiếp đối tác quốc tế.
4. `WORKING_GROUP` (Tổ công tác):
   - Tổ biên soạn ma trận DACUM, Tổ chuyên gia kiểm định chất lượng nội bộ, Tổ ứng cứu sự cố an ninh mạng.

---

## 3. Temporal Validity & Historical Integrity Preservation

### 3.1. Reorganization Invariant (Quyết định 282 & Phương án 690)
Under no circumstances shall an `OrganizationalUnit` record be deleted or modified in place to overwrite historical facts. When units are merged, split, or dissolved:

1. **Past Data Anchoring**: Any `Task`, `Document`, `Deliverable`, or `AuditLog` created when Unit A was active must remain permanently linked to Unit A.
2. **Succession Pointer**: Unit A receives `status = MERGED`, `effectiveTo = ExecutionDate`, and `successorUnitId = UnitB.id`.
3. **Query Bifurcation**:
   - **Current Operational Views (Active Scope)**: Only return units where `status = ACTIVE` and `(effectiveTo IS NULL OR effectiveTo >= CURRENT_DATE)`.
   - **Historical Audit & Archival Views**: Include all units, decorating defunct units with their effective date boundaries (e.g., *"Khoa Du lịch (Đã sáp nhập vào Khoa Du lịch - Dịch vụ từ 01/09/2026)"*).
4. **Task Migration**: Active/pending tasks of a dissolved unit must be formally reassigned or transitioned to the successor unit via a logged `UnitReorganizationEvent`.

---

## 4. Structured Business Rules

### Rule ORG-01: Establishment of Organizational Unit
- **Source regulation**: Quyết định số 282/QĐ-CĐKTCNQN; Thông tư số 63/2026/TT-BGDĐT Điều 8.
- **Business actor**: Hiệu trưởng Nhà trường (`BGH_HT`) hoặc Quản trị viên hệ thống (`ADMIN`) được ủy quyền.
- **Precondition**:
  1. Phải có Quyết định thành lập hoặc văn bản chấp thuận của cơ quan có thẩm quyền (`legalDocumentRef` không được rỗng).
  2. Mã đơn vị (`code`) phải là duy nhất trên toàn hệ thống và tuân thủ quy tắc ký hiệu viết hoa (`K_[KHOA]`, `P_[PHONG]`, `TT_[TRUNG_TAM]`, `BM_[BO_MON]`).
  3. Cấp bậc đơn vị (`type`) phải khớp với vị trí phân cấp (`level` và `parentUnitId`).
- **Action**: Khởi tạo bản ghi `OrganizationalUnit` với `effectiveFrom = Ngày có hiệu lực`, `status = ACTIVE`.
- **Resource**: Thực thể `OrganizationalUnit`.
- **Result**: Đơn vị mới xuất hiện trên cây tổ chức hệ thống; sẵn sàng để phân bổ vị trí công tác (`PositionAssignment`).
- **Exceptions**:
  - `400 Bad Request`: Mã đơn vị trùng lặp hoặc không đúng định dạng quy chuẩn.
  - `403 Forbidden`: Người thực hiện không có vai trò Hiệu trưởng hoặc Quản trị viên hệ thống.
  - `422 Unprocessable Entity`: `effectiveFrom` không hợp lệ hoặc thiếu `legalDocumentRef`.
- **Audit requirement**: Lưu vết kiểm toán bất biến chứa `actorId`, `action = ORG_UNIT_CREATED`, `unitCode`, `legalDocumentRef`, `timestamp`.

---

### Rule ORG-02: Reorganization & Merger of Units (Phương án 690/ĐA)
- **Source regulation**: Phương án số 690/ĐA-CĐKTCNQN; Quyết định số 282/QĐ-CĐKTCNQN.
- **Business actor**: Hiệu trưởng Nhà trường (`BGH_HT`).
- **Precondition**:
  1. Tồn tại văn bản Quyết định sáp nhập / tinh gọn bộ máy (`decisionRef`).
  2. Các đơn vị tiền nhiệm (`predecessorUnitIds`) đang ở trạng thái `ACTIVE`.
  3. Đã xác định rõ đơn vị kế thừa (`successorUnitId`) hoặc đã khởi tạo đơn vị mới kế thừa.
  4. Toàn bộ các nhiệm vụ đang mở (`Task` ở trạng thái chưa hoàn thành) của các đơn vị tiền nhiệm đã được lập phương án chuyển giao.
- **Action**: Thực hiện giao dịch nguyên tử (Atomic Database Transaction):
  1. Cập nhật các đơn vị tiền nhiệm: `status = MERGED`, `effectiveTo = executionDate`, `successorUnitId = successor.id`.
  2. Tạo bản ghi `UnitReorganizationEvent` liên kết danh sách đơn vị bị ảnh hưởng.
  3. Di chuyển các nhiệm vụ đang mở sang đơn vị kế thừa hoặc đánh dấu ủy thác quyền giám sát cho Trưởng đơn vị mới.
- **Resource**: Danh sách `OrganizationalUnit` tiền nhiệm, `OrganizationalUnit` kế thừa, `UnitReorganizationEvent`.
- **Result**: Cây cơ cấu tổ chức cập nhật ngay lập tức; dữ liệu lịch sử (văn bản đi/đến, nhiệm vụ đã nghiệm thu) của đơn vị cũ được bảo toàn vĩnh viễn với chỉ dấu đơn vị đã sáp nhập.
- **Exceptions**:
  - `409 Conflict`: Đơn vị tiền nhiệm đã giải thể hoặc sáp nhập trước đó.
  - `422 Unprocessable Entity`: `successorUnitId` trùng với một trong các `predecessorUnitIds` mà không có căn cứ pháp lý hợp lệ.
- **Audit requirement**: Ghi nhật ký kiểm toán hệ thống `ORG_UNIT_MERGED` với chữ ký số phê duyệt hoặc mã định danh của Hiệu trưởng, danh sách ID tiền nhiệm, ID kế thừa và `decisionRef`.

---

### Rule ORG-03: Dissolution of an Organizational Unit
- **Source regulation**: Quyết định số 282/QĐ-CĐKTCNQN; Thông tư số 63/2026/TT-BGDĐT.
- **Business actor**: Hiệu trưởng Nhà trường (`BGH_HT`).
- **Precondition**:
  1. Có Quyết định giải thể bằng văn bản (`legalDocumentRef`).
  2. Toàn bộ nhân sự thuộc đơn vị đã được điều động hoặc chuyển sang trạng thái chờ bố trí (`status = REASSIGNMENT_PENDING`).
  3. Không còn nhiệm vụ nào ở trạng thái chờ duyệt hoặc đang xử lý mà chưa được phân công đơn vị tiếp nhận xử lý thay.
- **Action**: Cập nhật đơn vị: `status = DISSOLVED`, `effectiveTo = executionDate`.
- **Resource**: Thực thể `OrganizationalUnit`.
- **Result**: Đơn vị bị vô hiệu hóa khỏi các danh mục lựa chọn giao việc và văn thư mới; vẫn hiển thị trong các báo cáo tổng kết giai đoạn lịch sử có liên quan.
- **Exceptions**:
  - `400 Bad Request`: Còn nhân sự chưa được điều chuyển hoặc còn nhiệm vụ tồn đọng chưa giải quyết.
  - `403 Forbidden`: Người thực hiện không phải Hiệu trưởng.
- **Audit requirement**: Lưu vết `ORG_UNIT_DISSOLVED` kèm lý do giải thể, danh sách nhân sự đã điều động và căn cứ pháp lý.

---

### Rule ORG-04: Establishment and Appointment of OrganizationalBody
- **Source regulation**: Quyết định số 283/QĐ-CĐKTCNQN Điều 5; Thông tư số 63/2026/TT-BGDĐT Điều 12, Điều 15.
- **Business actor**: Hiệu trưởng Nhà trường (`BGH_HT`).
- **Precondition**:
  1. Quyết định thành lập Hội đồng/Ban/Tổ có số hiệu và ngày ban hành hợp lệ.
  2. Mỗi Hội đồng/Ban phải có đúng một `CHAIR` (Chủ tịch/Trưởng ban/Tổ trưởng).
  3. Thành viên được chỉ định (`userId`) phải đang có `PositionAssignment` tích cực tại một đơn vị trong trường.
- **Action**:
  1. Tạo bản ghi `OrganizationalBody` với `status = ACTIVE`, `termStartDate`.
  2. Tạo các bản ghi `BodyMembership` tương ứng cho từng thành viên với vai trò cụ thể (`CHAIR`, `VICE_CHAIR`, `SECRETARY`, `MEMBER`).
- **Resource**: Thực thể `OrganizationalBody`, danh sách `BodyMembership`.
- **Result**: Hội đồng có tư cách pháp lý trong hệ thống; các thành viên nhận được thẩm quyền xử lý các công việc thuộc phạm vi của Hội đồng (ví dụ: chấm đề tài khoa học, xét duyệt thi đua).
- **Exceptions**:
  - `400 Bad Request`: Thiếu vai trò `CHAIR` hoặc có nhiều hơn một `CHAIR`.
  - `404 Not Found`: Không tìm thấy nhân sự hoặc nhân sự đã nghỉ công tác.
- **Audit requirement**: Lưu vết `ORG_BODY_ESTABLISHED` và `BODY_MEMBERSHIP_ASSIGNED` với mã định danh người ra quyết định, số hiệu văn bản thành lập và danh sách thành viên.

---

### Rule ORG-05: Expiration and Relieving of BodyMembership
- **Source regulation**: Quyết định số 283/QĐ-CĐKTCNQN; Nghị định số 232/2026/NĐ-CP.
- **Business actor**: Hiệu trưởng Nhà trường hoặc Chủ tịch Hội đồng/Trưởng ban.
- **Precondition**:
  1. Có quyết định kiện toàn thay thế thành viên hoặc Hội đồng hết nhiệm kỳ hoạt động.
  2. Thành viên cần miễn nhiệm đang ở trạng thái `ACTIVE` trong Hội đồng.
- **Action**: Cập nhật `BodyMembership.status = RELIEVED` hoặc `EXPIRED`, gán `termEndDate = CURRENT_DATE`, ghi nhận `relievedReason`.
- **Resource**: Thực thể `BodyMembership`.
- **Result**: Viên chức chấm dứt quyền hạn biểu quyết và phê duyệt nhân danh Hội đồng kể từ thời điểm quyết định có hiệu lực.
- **Exceptions**:
  - `400 Bad Request`: Miễn nhiệm `CHAIR` mà chưa chỉ định người thay thế hoặc chưa giải thể Hội đồng.
- **Audit requirement**: Lưu vết `BODY_MEMBERSHIP_RELIEVED` kèm `actorId`, `relievedMemberId`, `reason`, `timestamp`.

---

## 5. Temporal Query & State Machine Specifications

### 5.1. Unit Lifecycle State Machine
```
   [DRAFT / PROPOSED]
           │
           │ (Establishment Decision)
           ▼
        ACTIVE ◄─────────────────────────┐
           │                             │
   ┌───────┴───────────────┐             │ (Revocation of Suspension)
   │ (Reorg Plan)          │ (Disciplinary)│
   ▼                       ▼             │
REORGANIZING           SUSPENDED ────────┘
   │
   ├───────────────────────┬───────────────────────┐
   │ (Merger Completed)    │ (Split Completed)     │ (Abolished)
   ▼                       ▼                       ▼
MERGED                   MERGED                DISSOLVED
(Points to Successor)  (Points to Multiple)   (Terminal State)
```

### 5.2. Temporal Slice Query Strategy (Prisma / SQL)
To retrieve the active organizational structure at any historical timestamp $T$:
```sql
SELECT u.* 
FROM organizational_units u
WHERE u.effective_from <= :targetTimestamp
  AND (u.effective_to IS NULL OR u.effective_to > :targetTimestamp)
  AND u.status IN ('ACTIVE', 'REORGANIZING');
```
To trace the operational lineage of a migrated unit:
```sql
WITH RECURSIVE UnitLineage AS (
  SELECT id, code, name, status, successor_unit_id, 0 AS depth
  FROM organizational_units
  WHERE id = :historicalUnitId
  UNION ALL
  SELECT o.id, o.code, o.name, o.status, o.successor_unit_id, l.depth + 1
  FROM organizational_units o
  INNER JOIN UnitLineage l ON o.id = l.successor_unit_id
)
SELECT * FROM UnitLineage ORDER BY depth ASC;
```

---

## 6. Backward Compatibility & Anti-Corruption Layer
To support existing code referencing legacy unit identifiers, the system maintains the canonical mapping table `QCET_UNIT_CANONICAL_MAP`:
```typescript
export const QCET_UNIT_CANONICAL_MAP: Record<string, string> = {
  // Aliases and Seed Mappings to Canonical Units
  // Academic Faculties (09 Khoa đào tạo chuyên môn)
  "KHOA_CNTT": "K_CNTT",
  "CNTT": "K_CNTT",
  "K_CNTT": "K_CNTT",

  "KHOA_CO_KHI": "K_CK",
  "CO_KHI": "K_CK",
  "K_CK": "K_CK",

  "KHOA_OTO": "K_OTO",
  "K_CNOTO": "K_OTO",     // Seed alignment: Công nghệ Ô tô
  "OTO": "K_OTO",
  "K_OTO": "K_OTO",

  "KHOA_DIEN": "K_DIEN",
  "DIEN": "K_DIEN",
  "K_DIEN": "K_DIEN",

  "KHOA_DU_LICH": "K_DL",
  "K_DULICH": "K_DL",    // Seed alignment: Du lịch
  "DU_LICH": "K_DL",
  "K_DL": "K_DL",

  "KHOA_KINH_TE": "K_KT",
  "K_KTQT": "K_KT",      // Seed alignment: Kinh tế - Quản trị
  "KINH_TE": "K_KT",
  "K_KT": "K_KT",

  "KHOA_VHNT": "K_VHNT",
  "VAN_HOA_NGHE_THUAT": "K_VHNT",
  "K_VHNT": "K_VHNT",

  "KHOA_THPT": "K_THPT",
  "K_DAICUONG": "K_THPT", // Seed alignment: Giáo dục đại cương / THPT
  "THPT": "K_THPT",
  "K_THPT": "K_THPT",

  "KHOA_NONG_NGHIEP": "K_NN",
  "K_KTNN": "K_NN",       // Seed alignment: Kinh tế Nông nghiệp
  "NONG_NGHIEP": "K_NN",
  "K_NN": "K_NN",

  // Functional Departments (05 Phòng chức năng)
  "PHONG_QLDT": "P_QLDT",
  "QLDT": "P_QLDT",
  "P_QLDT": "P_QLDT",

  "PHONG_HCQT": "P_HCQT",
  "HCQT": "P_HCQT",
  "P_HCQT": "P_HCQT",

  "PHONG_TCDBCL": "P_TCDBCL",
  "TCDBCL": "P_TCDBCL",
  "P_TCDBCL": "P_TCDBCL",

  "PHONG_TC": "P_TC",
  "TAI_CHINH": "P_TC",
  "P_TC": "P_TC",

  "PHONG_TSHTQT": "P_TSHTQT",
  "TSHTQT": "P_TSHTQT",
  "P_TSHTQT": "P_TSHTQT",

  // Centers (02 Trung tâm trực thuộc)
  "TT_SO_TRUYENTHONG": "TT_STT",
  "TT_STT": "TT_STT",

  "TT_NGOAINGU_TINHOC": "TT_NNTH",
  "TT_NNTH": "TT_NNTH",

  // Executive (Ban Giám hiệu)
  "BAN_GIAM_HIEU": "BGH",
  "BGH": "BGH"
};
```
Any incoming request using legacy codes is translated at the API boundary via the Domain Normalization Pipe before processing by Core Domain Services.
