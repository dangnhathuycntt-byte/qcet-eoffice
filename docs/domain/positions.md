# QCET E-Office — Domain Specification: Positions, Portfolios & Job Profiles
**Document Code:** `SPEC-DOMAIN-POS-2026-01`  
**Domain:** Identity vs. Position Assignment, Responsibility Areas, Portfolio Delegation, and DACUM Profiles  
**Institution:** Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh (QCET)  
**Status:** Canonical Domain Specification  
**Version:** 1.0.0  
**Effective Date:** 2026-09-09  

---

## 1. Executive Domain Summary

The Position domain addresses one of the most critical enterprise invariants in public higher education management: **The absolute decoupling of Identity (User), Position Assignment (PositionAssignment), Responsibility Portfolio (ResponsibilityArea), and Technical Capabilities (Software Capabilities)**.

In public educational institutions governed by Vietnamese administrative law, a natural person (User) is appointed to a job title (PositionDefinition) within a specific organizational unit for a defined term. Furthermore, senior leaders (such as members of the Ban Giám hiệu) hold broad statutory titles (e.g., "Phó Hiệu trưởng") but are allocated specific portfolios of responsibility (e.g., Đào tạo, Hành chính - Quản trị, Cơ sở vật chất) under institutional assignment decisions (specifically **Quyết định số 420/QĐ-CĐKTCNQN**).

### 1.1. Core Regulatory Foundations
1. **Nghị định số 232/2026/NĐ-CP**: Quy định về Vị trí việc làm và định mức biên chế viên chức trong đơn vị sự nghiệp công lập; phân tách 4 nhóm vị trí việc làm (`LDPU`, `VCMN`, `VCDC`, `HTPV`).
2. **Quyết định số 420/QĐ-CĐKTCNQN (03/12/2025)**: Phân công nhiệm vụ cụ thể của Ban Giám hiệu (Hiệu trưởng và các Phó Hiệu trưởng phụ trách các mảng công tác).
3. **Quyết định số 283/QĐ-CĐKTCNQN (19/08/2026)**: Quy chế làm việc của Nhà trường, xác lập nguyên tắc phân công nhiệm vụ, chế độ chịu trách nhiệm cá nhân và cơ chế phân cấp phê duyệt.
4. **Quyết định số 203/QĐ-CĐKTCNQN (15/05/2025)**: Quy chế làm việc, chức năng nhiệm vụ cụ thể của từng Khoa, Phòng và Trung tâm.

### 1.2. Ubiquitous Language (Ngôn ngữ chung)
- **User (Định danh thể nhân)**: Thực thể đại diện cho một cá nhân đăng nhập hệ thống thông qua tài khoản Google Workspace công vụ (`@cdktcnqn.edu.vn`), lưu giữ thông tin nhân thân và trạng thái xác thực.
- **PositionDefinition (Định nghĩa vị trí việc làm)**: Khung chức danh hoặc chức vụ chuẩn hóa theo đề án vị trí việc làm (ví dụ: "Hiệu trưởng", "Phó Trưởng khoa", "Giảng viên Hạng II", "Chuyên viên quản lý đào tạo").
- **PositionAssignment (Bổ nhiệm vị trí công tác)**: Bản ghi ràng buộc có kỳ hạn gắn một `User` với một `PositionDefinition` tại một `OrganizationalUnit` cụ thể theo Quyết định bổ nhiệm/phân công công tác.
- **AssignmentType (Loại hình bổ nhiệm)**: Tính chất pháp lý của việc giữ chức vụ:
  - `PRIMARY` (Chính nhiệm / Bổ nhi���m chính thức).
  - `ACTING` (Quyền / Phụ trách đơn vị khi khuyết cấp trưởng).
  - `CONCURRENT` (Kiêm nhiệm vị trí chuyên môn hoặc tổ chức khác).
  - `INTERIM` (Tạm quyền trong thời gian cấp trưởng vắng mặt ngắn hạn).
- **ResponsibilityArea (Lĩnh vực trách nhiệm / Mảng công tác)**: Phân vùng nghiệp vụ hành chính - chuyên môn của Nhà trường theo quy chuẩn phân cấp.
- **PositionPortfolioAssignment (Phân công mảng công tác)**: Bản ghi liên kết một bổ nhiệm lãnh đạo với các lĩnh vực trách nhiệm cụ thể theo Quyết định phân công (QĐ 420).
- **DACUM Job Profile (Hồ sơ năng lực & Nhiệm vụ nghề nghiệp)**: Mô tả thực tế về nhiệm vụ, công việc chi tiết, tiêu chí chất lượng và sản phẩm giao nộp theo phương pháp DACUM (Developing A Curriculum).
- **Software Capability (Quyền năng kỹ thuật)**: Hành động cụ thể mà hệ thống phần mềm cho phép thực thi (ví dụ: `task:approve_step1`, `document:sign_official`, `user:manage_unit`).

---

## 2. Domain Models & Aggregates

### 2.1. Structural Decomposition: User vs. PositionAssignment

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│            User (Identity)           │       │    PositionDefinition (Catalog)      │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ - id: UUID                           │       │ - id: UUID                           │
│ - email: String (@cdktcnqn.edu.vn)   │       │ - code: String (e.g., "GV_HANG_2")   │
│ - fullName: String                   │       │ - name: String (e.g., "Giảng viên")  │
│ - nationalId: String (CCCD)          │       │ - group: JobCatalogGroup             │
│ - status: UserStatus (ACTIVE|LOCKED) │       │   (LDPU | VCMN | VCDC | HTPV)        │
│ - isStaff: Boolean (Legacy Flag)     │       │ - standardCivilServiceRank: String   │
└──────────────────┬───────────────────┘       └──────────────────┬───────────────────┘
```

> **Ghi chú kiến trúc về chuyển tiếp nhân sự (`isStaff` vs `PositionAssignment`):**  
> Thuộc tính `User.isStaff` trong lược đồ cơ sở dữ liệu hiện tại là cờ boolean kế thừa (legacy schema flag). Trong mô hình nghiệp vụ đích, tư cách viên chức/người lao động hợp lệ được suy diễn động từ sự tồn tại của ít nhất một `PositionAssignment` ở trạng thái `ACTIVE`. Phân nhóm vị trí việc làm được chuẩn hóa theo `PositionDefinition.group` gồm 04 nhóm pháp định theo Nghị định 232/2026/NĐ-CP và Nghị định 111/2022/NĐ-CP:
> - `LDPU`: Lãnh đạo, quản lý (Hiệu trưởng, Phó Hiệu trưởng, Trưởng/Phó phòng, Trưởng/Phó khoa, Giám đốc trung tâm).
> - `VCMN`: Viên chức chuyên môn, nghiệp vụ (Giảng viên các hạng, Giáo viên GDNN, Chuyên viên chính/chuyên viên phụ trách đào tạo, khảo thí).
> - `VCDC`: Viên chức chuyên môn dùng chung (Kế toán, Văn thư, Thủ quỹ, Thư viện, Quản trị mạng, Pháp chế).
> - `HTPV`: Nhân viên hỗ trợ, phục vụ ký hợp đồng lao động theo Nghị định 111/2022/NĐ-CP (Lái xe, Bảo vệ, Tạp vụ).

```
                   │ 1                                            ��� 1
                   │                                              │
                   │ 0..*                                         │ 0..*
                   ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                            PositionAssignment (Aggregate)                           │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                          │
│ - userId: UUID                                                                      │
│ - positionDefinitionId: UUID                                                        │
│ - unitId: UUID (Points to OrganizationalUnit)                                       │
│ - assignmentType: AssignmentType (PRIMARY | ACTING | CONCURRENT | INTERIM)          │
│ - appointmentDecisionRef: String (e.g., "QĐ 142/QĐ-CĐKTCNQN")                       │
│ - effectiveFrom: Date                                                               │
│ - effectiveTo: Date?                                                                │
│ - status: AssignmentStatus (ACTIVE | ON_LEAVE | TERMINATED | SUPERSEDED)            │
│ - isPrimaryForUser: Boolean                                                         │
│ - createdAt: DateTime                                                               │
│ - updatedAt: DateTime                                                               │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │ 1
                                           │
                                           │ 0..*
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                       PositionPortfolioAssignment (Entity)                          │
├─────────────────────────────────────────────────────────────────────────────────────┤
│ - id: UUID                                                                          │
│ - positionAssignmentId: UUID                                                        │
│ - responsibilityArea: ResponsibilityArea                                            │
│   (FINANCE | HR | QUALITY_ASSURANCE | TRAINING | STUDENT_AFFAIRS |                   │
│    DIGITAL_TRANSFORMATION | ADMINISTRATION | FACILITIES | ADMISSIONS |              │
│    INTERNATIONAL_RELATIONS | RESEARCH)                                              │
│ - oversightType: OversightType (PRIMARY_DIRECT | SECONDARY_SUPERVISORY)             │
│ - decisionRef: String (e.g., "QĐ 420/QĐ-CĐKTCNQN")                                  │
│ - validFrom: Date                                                                   │
│ - validTo: Date?                                                                    │
│ - notes: String?                                                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2. Standard ResponsibilityArea Enumeration
Based on QCET's institutional organization and Quyết định 420/QĐ-CĐKTCNQN, the 11 canonical responsibility areas are defined:

| Identifier | Tên mảng trách nhiệm | Phạm vi nghiệp vụ | Đơn vị chủ trì tham mưu | Lãnh đạo BGH phụ trách (QĐ 420) |
|---|---|---|---|---|
| `FINANCE` | Tài chính & Ngân sách | Dự toán, thu chi, tài khoản, thanh quyết toán, chế độ chính sách viên chức | Phòng Tài chính (`P_TC`) | Hiệu trưởng (`BGH_HT`) |
| `HR` | Tổ chức & Cán bộ | Bổ nhiệm, điều động, tuyển dụng, kỷ luật, quy hoạch, vị trí việc làm | Phòng Tổ chức - ĐBCL (`P_TCDBCL`) | Hiệu trưởng (`BGH_HT`) |
| `QUALITY_ASSURANCE` | Khảo thí & Đảm bảo chất lượng | Kiểm định chất lượng trường/chương trình, thanh tra nội bộ, khảo sát ý kiến | Phòng Tổ chức - ĐBCL (`P_TCDBCL`) | Hiệu trưởng (`BGH_HT`) |
| `TRAINING` | Đào tạo & Học vụ | Chương trình đào tạo, lịch giảng dạy, thi tốt nghiệp, cấp phát văn bằng | Phòng Qu���n lý Đào tạo (`P_QLDT`) | Phó Hiệu trưởng Đào tạo (`BGH_PHT_DT`) |
| `STUDENT_AFFAIRS` | Công tác Học sinh - Sinh viên | Chế độ chính sách HSSV, rèn luyện, khen thưởng HSSV, ký túc xá, an ninh trật tự | Phòng Quản lý Đào tạo (`P_QLDT`) | Phó Hiệu trưởng Đào tạo (`BGH_PHT_DT`) |
| `DIGITAL_TRANSFORMATION` | Chuyển đổi số & CNTT | Hệ điều hành E-Office, hạ tầng mạng, bảo mật, ứng dụng AI, Cổng thông tin | Trung tâm Số - Truyền thông (`TT_STT`) | Phó Hiệu trưởng Đào tạo (`BGH_PHT_DT`) |
| `ADMINISTRATION` | Hành chính & Văn thư | Tiếp nhận văn bản, phát hành văn bản, lưu trữ hồ sơ, quản lý con dấu, xe cơ quan | Phòng Hành chính - Quản trị (`P_HCQT`) | Phó Hiệu trưởng HC-CSVC (`BGH_PHT_CSVC`) |
| `FACILITIES` | Cơ sở vật chất & Tài sản | Mua sắm thường xuyên, quản trị đất đai, bảo dưỡng thiết bị, an toàn lao động, PCCC | Phòng Hành chính - Quản trị (`P_HCQT`) | Phó Hiệu trưởng HC-CSVC (`BGH_PHT_CSVC`) |
| `ADMISSIONS` | Tuyển sinh & Hướng nghiệp | Kế hoạch tuyển sinh các hệ, truyền thông tư vấn hướng nghiệp, chỉ tiêu tuyển sinh | Phòng Tuyển sinh - HTQT (`P_TSHTQT`) | Phó Hiệu trưởng HC-CSVC (`BGH_PHT_CSVC`) |
| `INTERNATIONAL_RELATIONS` | Hợp tác quốc tế & Đối ngoại | Dự án hợp tác nước ngoài, trao đổi giảng viên/chuyên gia, kết nối doanh nghiệp FDI | Phòng Tuyển sinh - HTQT (`P_TSHTQT`) | Phó Hiệu trưởng HC-CSVC (`BGH_PHT_CSVC`) |
| `RESEARCH` | Nghiên cứu khoa học & Đổi mới sáng tạo | Đề tài nghiên cứu các cấp, sáng kiến cải tiến kỹ thuật, phong trào tự làm thiết bị | Phòng Tuyển sinh - HTQT (`P_TSHTQT`) | Phó Hiệu trưởng HC-CSVC (`BGH_PHT_CSVC`) |

---

### 2.3. Concrete Ban Giám hiệu Portfolio Allocation (Quyết định 420)

```
                     ┌──────────────────────────────────────┐
                     │          Hiệu trưởng (QCET)          │
                     │         ThS. Phạm Văn Tường          │
                     └──────────────────┬───────────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
      [ FINANCE ]                     [ HR ]              [ QUALITY_ASSURANCE ]
  (Phòng Tài chính)           (Phòng Tổ chức - ĐBCL)     (Thanh tra & Kiểm định)

                     ┌──────────────────────────────────────┐
                     │         Phó Hiệu trưởng Đào tạo      │
                     │          ThS. Trần Trọng Kiệm        │
                     └──────────────────┬───────────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
     [ TRAINING ]              [ STUDENT_AFFAIRS ]      [ DIGITAL_TRANSFORMATION ]
  (Phòng Quản lý Đào tạo)       (Phòng QLĐT / Ký túc xá)    (Trung tâm Số - TT / AI)
  (09 Khoa đào tạo)

                     ┌──────────────────────────────────────┐
                     │      Phó Hiệu trưởng HC - CSVC       │
                     │          ThS. Lê Xuân Nguyên         │
                     └──────────────────┬───────────────────┘
                                        │
           ┌──────────────┬─────────────┼─────────────┬──────────────┐
           ▼              ▼             ▼             ▼              ▼
  [ ADMINISTRATION ] [ FACILITIES ] [ ADMISSIONS ] [ INT_RELATIONS ] [ RESEARCH ]
    (Phòng HC-QT)    (Phòng HC-QT)  (Phòng TS-HTQT) (Phòng TS-HTQT) (Phòng TS-HTQT)
```

---

## 3. Separation of DACUM Job Profiles and Software Capabilities

### 3.1. Architectural Distinction
A frequent design antipattern is coupling operational Job Descriptions with Software Access Control Rules. The QCET domain enforces strict separation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DACUM Job Profile (Operational Domain)                   │
│                                                                             │
│ - "What the person does in the physical educational and management world"   │
│ - Governed by: Nghị định 232/2026/NĐ-CP, Quy chế làm việc 203/QĐ-CĐKTCNQN   │
│ - Entities: JobCatalogItem, DacumDuty, DacumTaskDef, RequiredDeliverable    │
│ - Metrics: Giờ chuẩn giảng dạy, tiêu chí chất lượng, tần suất thực hiện     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Realizes / Assigned to
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PositionAssignment (Binding)                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Grants / Activates
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Software Capabilities (Security Domain)                 │
│                                                                             │
│ - "What atomic actions the authenticated user can invoke in software"       │
│ - Governed by: RBAC / ABAC policies, Security invariants                    │
│ - Capabilities: task:create, document:sign_level2, directive:issue,         │
│                 deliverable:approve, budget:endorse                         │
│ - Enforcement: Server API Route Handlers, Database row-level security       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Capability Granting Rule Matrix
Software capabilities are derived dynamically from the combination of `PositionAssignment.assignmentType`, `PositionDefinition.group`, and active `PositionPortfolioAssignment`:

```typescript
export interface SoftwareCapability {
  resource: "task" | "document" | "deliverable" | "directive" | "user" | "budget";
  action: "create" | "read" | "update" | "delete" | "approve" | "sign" | "reassign";
  scope: "personal" | "unit" | "portfolio" | "school";
}
```

1. **Hiệu trưởng (`BGH_HT`)**:
   - Holds `school` scope for all actions on all resources.
   - Holds definitive signature capability (`document:sign:school`).
2. **Phó Hiệu trưởng (`BGH_PHT_*`)**:
   - Holds `portfolio` scope matching active `ResponsibilityArea` records under QĐ 420.
   - Holds authorized signature capability (`document:sign:portfolio`, formatted as `KT. HIỆU TRƯỞNG / PHÓ HIỆU TRƯỞNG`).
3. **Trưởng đơn vị (`TRUONG_DON_VI`)**:
   - Holds `unit` scope for task creation, review, and task delegation within their department.
   - Holds unit initial signature capability (`document:initial_review:unit`).
4. **Viên chức chuyên môn (`CHUYEN_VIEN`, `GIANG_VIEN`)**:
   - Holds `personal` scope for task execution and deliverable upload.
   - Prohibited from self-approving deliverables.

---

## 4. Structured Business Rules

### Rule POS-01: User Identity Decoupling
- **Source regulation**: Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15; Nghị định số 232/2026/NĐ-CP.
- **Business actor**: Quản trị hệ thống (`ADMIN`) hoặc Dịch vụ đồng bộ danh mục nhân sự.
- **Precondition**:
  1. Thể nhân phải có địa chỉ email Google Workspace chính thức thuộc miền `@cdktcnqn.edu.vn`.
  2. Số định danh cá nhân (CCCD) phải được xác thực và duy nhất.
- **Action**: Tạo bản ghi `User` mà không gán cứng mã vai trò quản lý (`Role`) trong bảng người dùng. Vai trò và quyền lực chỉ được xác định khi kích hoạt `PositionAssignment`.
- **Resource**: Thực thể `User`.
- **Result**: Người dùng có thể đăng nhập vào hệ thống nhưng chỉ có quyền truy cập cơ bản (Onboarding / Personal Workspace) cho đến khi được bổ nhiệm vị trí việc làm.
- **Exceptions**:
  - `400 Bad Request`: Email không thuộc miền cơ quan hoặc CCCD không đúng định dạng 12 số.
  - `409 Conflict`: Trùng email hoặc số CCCD với người dùng đã tồn tại.
- **Audit requirement**: Lưu vết `USER_IDENTITY_REGISTERED` với `userId`, `email`, `timestamp`.

---

### Rule POS-02: Creation of PositionAssignment
- **Source regulation**: Nghị định số 232/2026/NĐ-CP Điều 5; Quyết định số 283/QĐ-CĐKTCNQN Điều 8.
- **Business actor**: Hiệu trưởng Nhà trường (`BGH_HT`) hoặc Trưởng phòng Tổ chức - ĐBCL (`P_TCDBCL`) được ủy quyền.
- **Precondition**:
  1. Phải có Quyết định tuyển dụng, bổ nhiệm hoặc phân công công tác bằng văn bản (`appointmentDecisionRef`).
  2. `PositionDefinition` tồn tại trong Danh mục vị trí việc làm chuẩn hóa.
  3. `OrganizationalUnit` đang ở trạng thái `ACTIVE`.
  4. Một người dùng tại một thời điểm chỉ có thể có đúng một `PositionAssignment` có `isPrimaryForUser = true`.
- **Action**: Khởi tạo bản ghi `PositionAssignment` với `status = ACTIVE`, `effectiveFrom = Ngày quyết định`, `assignmentType`.
- **Resource**: Thực thể `PositionAssignment`.
- **Result**: Người dùng được cấp thẩm quyền quản lý hoặc chuyên môn tương ứng với chức danh tại đơn vị.
- **Exceptions**:
  - `422 Unprocessable Entity`: Cố gắng gán `isPrimaryForUser = true` trong khi người dùng đã có một vị trí chính nhiệm đang hoạt động mà chưa làm thủ tục điều chuyển.
- **Audit requirement**: Lưu vết `POSITION_ASSIGNED` với chữ ký số của người ký quyết định, `userId`, `unitId`, `positionId`, `decisionRef`.

---

### Rule POS-03: Portfolio Allocation to Executive Positions (Quyết định 420)
- **Source regulation**: Quyết định số 420/QĐ-CĐKTCNQN; Thông tư số 63/2026/TT-BGDĐT Điều 11.
- **Business actor**: Hiệu trưởng Nhà trường (`BGH_HT`).
- **Precondition**:
  1. Đối tượng tiếp nhận phải có `PositionAssignment` thuộc nhóm lãnh đạo Ban Giám hiệu (`Hiệu trưởng` hoặc `Phó Hiệu trưởng`).
  2. Quyết định phân công nhiệm vụ có hiệu lực pháp lý (`decisionRef = 420/QĐ-CĐKTCNQN` hoặc quyết định điều chỉnh tiếp theo).
  3. Mỗi mảng trách nhiệm (`ResponsibilityArea`) phải có đúng một lãnh đạo BGH giữ vai trò `PRIMARY_DIRECT`.
- **Action**: Tạo hoặc cập nhật các bản ghi `PositionPortfolioAssignment` gắn liền với `PositionAssignmentId` của thành viên Ban Giám hiệu.
- **Resource**: Thực thể `PositionPortfolioAssignment`.
- **Result**: Hệ thống tự động định tuyến các văn bản đến, báo cáo tiến độ và đề xuất giải quyết thuộc lĩnh vực tương ứng về Khoang chỉ huy (`ExecutiveCockpit`) của đồng chí BGH phụ trách.
- **Exceptions**:
  - `400 Bad Request`: Gán mảng trách nhiệm cho vị trí không thuộc Ban Giám hiệu.
  - `409 Conflict`: Trùng lặp lãnh đạo phụ trách chính (`PRIMARY_DIRECT`) cho cùng một mảng nghiệp vụ mà không có quyết định thay thế.
- **Audit requirement**: Ghi nhật ký kiểm toán hệ thống `PORTFOLIO_ALLOCATED` kèm danh sách các `ResponsibilityArea` được điều chỉnh.

---

### Rule POS-04: Handling Acting & Concurrent Positions (Quyền & Kiêm nhiệm)
- **Source regulation**: Nghị định số 232/2026/NĐ-CP Điều 12; Quyết định số 283/QĐ-CĐKTCNQN.
- **Business actor**: Hiệu trưởng Nhà trường (`BGH_HT`).
- **Precondition**:
  1. Có Quyết định giao quyền (`ACTING`) hoặc Quyết định kiêm nhiệm (`CONCURRENT`).
  2. Thời hạn giao quyền phải có ngày kết thúc xác định hoặc không quá 12 tháng theo quy định về bổ nhiệm viên chức lãnh đạo.
- **Action**: Khởi tạo bản ghi `PositionAssignment` với `assignmentType = ACTING` (hoặc `CONCURRENT`), `isPrimaryForUser = false`, `effectiveFrom`, `effectiveTo`.
- **Resource**: Thực thể `PositionAssignment`.
- **Result**: Người dùng nhận thêm quyền hạn phê duyệt và điều hành tại đơn vị kiêm nhiệm/giao quyền mà không mất vị trí công tác gốc. Giao diện làm việc cho phép chuyển đổi ngữ cảnh làm việc giữa các đơn vị mà không cần đăng xuất.
- **Exceptions**:
  - `403 Forbidden`: Trưởng phòng tự bổ nhiệm cấp dưới làm quyền trưởng đơn vị trái thẩm quyền của Hiệu trưởng.
- **Audit requirement**: Lưu vết `CONCURRENT_POSITION_ASSIGNED` kèm `decisionRef` và thời hạn bổ nhiệm.

---

### Rule POS-05: Mapping DACUM Duty to Actual Tasks
- **Source regulation**: Quyết định số 203/QĐ-CĐKTCNQN; Nghị định số 232/2026/NĐ-CP Điều 14.
- **Business actor**: Trưởng đơn vị (`TRUONG_DON_VI`) hoặc Cán bộ chủ trì nhiệm vụ.
- **Precondition**:
  1. `DacumTaskDef` tồn tại trong ma trận DACUM đã được nghiệm thu của đơn vị.
  2. Người tạo nhiệm vụ có quyền giao việc tại đơn vị hoặc tạo việc cho chính mình theo kế hoạch công tác.
- **Action**: Khởi tạo `Task` liên kết khóa ngoại `dacumTaskDefId`. Tự động sao chép tiêu chí đánh giá (`criteria`) và sản phẩm bắt buộc (`requiredDeliverables`) vào cấu hình nhiệm vụ.
- **Resource**: Thực thể `Task`, `DacumTaskDef`, `TaskDeliverable`.
- **Result**: Nhiệm vụ được chuẩn hóa đầu ra; sản phẩm hoàn thành được tự động tính vào định mức giờ công tác hoặc giờ chuẩn giảng dạy của viên chức theo quy định.
- **Exceptions**:
  - `400 Bad Request`: Giao nhiệm vụ DACUM vượt quá phạm vi chuyên môn của đơn vị mà không có phê duyệt của Ban Giám hiệu.
- **Audit requirement**: Lưu vết `TASK_DACUM_LINKED` với `taskId`, `dacumTaskDefId`, `standardHours`.

---

## 5. Security Context & Session Resolution Service

When an authenticated user requests an operation, the `PositionContextResolver` service dynamically computes the active security envelope:

```typescript
export interface ActiveSecurityEnvelope {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
  primaryAssignment: {
    id: string;
    unitId: string;
    unitCode: string;
    positionTitle: string;
    group: "LDPU" | "VCMN" | "VCDC" | "HTPV";
  };
  activeAssignments: Array<{
    id: string;
    unitId: string;
    unitCode: string;
    type: "PRIMARY" | "ACTING" | "CONCURRENT" | "INTERIM";
  }>;
  portfolios: Array<{
    area: ResponsibilityArea;
    oversight: "PRIMARY_DIRECT" | "SECONDARY_SUPERVISORY";
  }>;
  capabilities: Set<string>;
}
```

This resolution ensures that **Role Is Not Scope**: An executive holding `portfolios: [TRAINING]` can view documents school-wide, but system logic routes operational approvals for training matters exclusively to their active workflow queue.
