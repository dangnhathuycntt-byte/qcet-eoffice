# KIẾN TRÚC ỦY QUYỀN & ĐỘNG CƠ PHÂN QUYỀN NĂNG LỰC CỐT LÕI (CORE AUTHORIZATION & CAPABILITY ENGINE SPECIFICATION)
## QCET E-OFFICE CANONICAL DOMAIN SPECIFICATION

**Cơ quan chủ quản:** Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh (QCET)  
**Phân hệ:** Động cơ Kiểm soát Truy cập & Năng lực Tác nghiệp (Authorization & Capability Engine)  
**Tình trạng tài liệu:** Đặc tả Chuẩn tắc (Canonical Reference Specification)  
**Mã tài liệu:** `QCET-AUTH-SPEC-2026-01`  
**Phiên bản:** 1.0.0 (Cập nhật tháng 09/2026)  
**Căn cứ pháp lý & thể chế:**
- Quyết định số 283/QĐ-CĐKTCNQN (Quy chế làm việc của Nhà trường).
- Quyết định số 282/QĐ-CĐKTCNQN (Sửa đổi Quy chế tổ chức và hoạt động).
- Quyết định số 420/QĐ-CĐKTCNQN (Phân công nhiệm vụ Ban Giám hiệu).
- Quyết định số 203/QĐ-CĐKTCNQN (Quy chế làm việc Khoa, Phòng, Trung tâm).
- Quyết định số 93/QĐ-CĐKTCNQN & Kế hoạch số 227/KH-CĐKTCNQN (Quy chế Văn thư - Lưu trữ).
- Nghị định số 30/2020/NĐ-CP của Chính phủ về công tác văn thư.
- Nghị định số 232/2026/NĐ-CP của Chính phủ về vị trí việc làm trong đơn vị sự nghiệp công lập.
- Thông tư số 63/2026/TT-BGDĐT ban hành Điều lệ trường cao đẳng.
- Luật Giao dịch điện tử số 20/2023/QH15 & Nghị định số 68/2024/NĐ-CP (Chữ ký số công vụ).
- Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 & Nghị định số 356/2025/NĐ-CP.
- Luật Bảo vệ bí mật nhà nước số 117/2025/QH15 & Luật Dữ liệu năm 2025.

---

## 1. TỔNG QUAN VÀ MỤC TIÊU THIẾT KẾ

Trong quản trị đại học và cao đẳng công lập tại Việt Nam, quyền hạn tác nghiệp không thể mô hình hóa đơn giản bằng một bảng phân quyền tĩnh (RBAC truyền thống). Thẩm quyền pháp lý của một chủ thể trong nhà trường phụ thuộc đồng thời vào:
1. **Vị trí chức danh (Position / Administrative Role)**: Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Trưởng khoa, Chuyên viên, Giảng viên, Văn thư, Lưu trữ, Quản trị hệ thống.
2. **Mối quan hệ với thực thể nghiệp vụ (Resource Relationships - ReBAC)**: Là người lập đề xuất, người chịu trách nhiệm chính (Primary Owner / DRI), cán bộ phối hợp, người ký số bản thảo, hay thủ trưởng đơn vị chủ trì.
3. **Thuộc tính ngữ cảnh và Phạm vi phụ trách (Attributes & Context - ABAC)**: Mảng công tác được phân công theo QĐ 420 (Đào tạo vs Hành chính - Cơ sở vật chất), khung thời gian ủy quyền (Delegation Window), cấp độ mật/khẩn của tài liệu, và mức độ phân loại dữ liệu theo Luật 91/2025/QH15.

Do đó, QCET E-Office thiết lập **Mô hình Ủy quyền Lai (Hybrid Authorization Model: RBAC + ReBAC + ABAC)** làm chuẩn mực bảo mật tối cao.

---

## 2. NGUYÊN TẮC HỆ THỐNG BẤT BIẾN (CORE ARCHITECTURAL INVARIANTS)

1. **Server Truth Wins**: Cơ sở dữ liệu và phiên làm việc được xác thực ở phía máy chủ (Server Session via Signed JWT) là nguồn chân lý tối thượng. Client UI chỉ là lớp hiển thị; mọi quyết định cho phép/từ chối hành động (`allow`/`deny`) đều phải được tính toán độc lập tại tầng API Route Handler / Domain Service trước khi thực hiện giao dịch ghi vào PostgreSQL.
2. **Role Is Not Scope**: Vai trò (`Role/Position`) đại diện cho quyền lực và năng lực hành động ("Tôi ĐƯỢC PHÉP LÀM GÌ?"). Phạm vi (`Scope`: `school`, `unit`, `my`) chỉ là bộ lọc tập dữ liệu hiển thị ("Tôi ĐANG XEM TẬP DỮ LIỆU NÀO?"). Việc người dùng chuyển sang bộ lọc cá nhân (`my`) tuyệt đối không làm suy giảm hoặc thay đổi thẩm quyền quản lý của họ.
3. **Strict Separation of Powers (Phân lập Quyền lực Công nghệ và Nghiệp vụ)**: Quản trị viên hệ thống (`ADMIN`) chỉ quản lý hạ tầng công nghệ, tài khoản, cấu hình kỹ thuật; tuyệt đối không có quyền hạn nghiệp vụ tự nhiên (không được ký văn bản, không được phê duyệt nhiệm vụ/minh chứng, không được xem tài liệu tài chính/nhân sự bảo mật).
4. **Separation of Duties (SoD - Phân lập Trách nhiệm Tác nghiệp)**:
   - Cán bộ tạo lập nhiệm vụ không được tự duyệt nhiệm vụ của chính mình (`Creator != Approver`).
   - Cán bộ thực thi hoặc nộp minh chứng không được tự đánh giá/phê duyệt sản phẩm của mình (`Executor != Reviewer`).
   - Người ký văn bản không được kiêm nhiệm vai trò cấp số văn bản đi hoặc đóng dấu cơ quan (`Signer != Numberer/Archivist`).
   - Cán bộ nhận ủy quyền xử lý không được duyệt các nhiệm vụ mà mình là người thực hiện chính (`Delegate != PrimaryOwner`).
5. **Data Protection by Default**: Mọi luồng dữ liệu cá nhân phải tuân thủ Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15. Tuyệt đối cấm số hóa và lưu trữ văn bản Bí mật nhà nước (`STATE_SECRET`) trên hệ thống E-Office vận hành trên môi trường mạng thông thường.

---

## 3. MÔ HÌNH ỦY QUYỀN LAI: RBAC + ReBAC + ABAC

Hệ thống hợp nhất ba trường phái kiểm soát truy cập thành một kiến trúc duy nhất:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HYBRID AUTHORIZATION MODEL (QCET)                        │
├───────────────────────┬──────────────────────────┬──────────────────────────┤
│  RBAC (Role-Based)    │   ReBAC (Relationship)   │     ABAC (Attribute)     │
├───────────────────────┼──────────────────────────┼──────────────────────────┤
│ • Vị trí việc làm     │ • Quan hệ Người - Việc   │ • Mảng phụ trách (QĐ420) │
│   theo NĐ 232/2026:   │   (Direct Assignment):   │   (ACADEMIC vs ADMIN)    │
│   - BGH_HT            │   - creator              │ • Hiệu lực ủy quyền      │
│   - BGH_PHT_DT        │   - primary_owner (DRI)  │   (DacumDelegation)      │
│   - BGH_PHT_CSVC      │   - collaborator         │ • Độ khẩn văn bản:       │
│   - TRUONG_DON_VI     │   - supervisor           │   THUONG, KHAN, HOA_TOC  │
│   - PHO_TRUONG_DON_VI │ • Quan hệ Văn bản:       │ • Phân loại dữ liệu:     │
│   - CHUYEN_VIEN       │   - drafting_user        │   PUBLIC, INTERNAL,      │
│   - GIANG_VIEN        │   - lead_dept_member     │   RESTRICTED, PERSONAL   │
│   - VAN_THU           │   - recipient_dept       │ • Vùng cấm tuyệt đối:    │
│   - LUU_TRU           │ • Quan hệ Hồ sơ:         │   STATE_SECRET           │
│   - QUAN_TRI_HE_THONG │   - dossier_creator      │   (Cấm lưu trên E-Office)│
└───────────────────────┴──────────────────────────┴──────────────────────────┘
```

### 3.1. Trục RBAC (Role-Based Access Control)
Định danh chức danh pháp lý của cán bộ theo phân bổ tổ chức của QĐ 282/QĐ-CĐKTCNQN và Nghị định 232/2026/NĐ-CP:
- `HIEU_TRUONG`: Người đứng đầu đơn vị sự nghiệp, đại diện pháp luật, chủ tài khoản.
- `PHO_HIEU_TRUONG`: Cấp phó giúp việc Hiệu trưởng, điều hành các lĩnh vực được phân công theo QĐ 420.
- `TRUONG_DON_VI`: Thủ trưởng đơn vị trực thuộc (Trưởng khoa, Trưởng phòng, Giám đốc trung tâm) theo QĐ 203.
- `PHO_TRUONG_DON_VI`: Cấp phó đơn vị trực thuộc, thực hiện nhiệm vụ theo phân công nội bộ và ủy quyền.
- `CHUYEN_VIEN` / `GIANG_VIEN`: Viên chức chuyên môn, nghiệp vụ, giảng dạy trực tiếp thực hiện nhiệm vụ.
- `VAN_THU`: Cán bộ nghiệp vụ văn thư cơ quan thuộc Phòng Hành chính - Quản trị theo NĐ 30/2020.
- `LUU_TRU`: Cán bộ nghiệp vụ lưu trữ lịch sử cơ quan theo QĐ 93 và Kế hoạch 227.
- `QUAN_TRI_HE_THONG` (`ADMIN`): Kỹ sư công nghệ thông tin quản trị hệ thống thuộc Trung tâm Số - Truyền thông.

### 3.2. Trục ReBAC (Relationship-Based Access Control)
Quyền hạn trên một bản ghi thực thể cụ thể (Task, Document, Dossier, Deliverable) phụ thuộc vào đồ thị quan hệ trực tiếp:
- **Task Relations**:
  - `isCreator(user, task)`: `task.createdById === user.id`
  - `isPrimaryOwner(user, task)`: Tồn tại `TaskAssignee` với `roleInTask === 'PRIMARY_OWNER'` và `userId === user.id`.
  - `isCollaborator(user, task)`: Tồn tại `TaskAssignee` với `roleInTask === 'COLLABORATOR'` và `userId === user.id`.
  - `isSupervisor(user, task)`: Tồn tại `TaskAssignee` với `roleInTask === 'SUPERVISOR'` và `userId === user.id`.
  - `isDepartmentHeadOfTask(user, task)`: Người dùng là Trưởng đơn vị của `task.departmentId`.
- **Document Relations**:
  - `isDraftingUser(user, doc)`: Người trực tiếp tạo dự thảo văn bản đi.
  - `isDraftingDepartmentHead(user, doc)`: Trưởng phòng/khoa của `doc.draftingDeptId`.
  - `isLeadDepartmentHead(user, doc)`: Trưởng phòng/khoa được chỉ đạo chủ trì giải quyết văn bản đến (`doc.leadDepartmentId`).
  - `isDesignatedSigner(user, doc)`: Lãnh đạo BGH được chỉ định ký số văn bản đi (`doc.signerName / signerTitle`).
- **Dossier Relations**:
  - `isDossierOwner(user, dossier)`: Người mở hồ sơ công việc điện tử.
  - `isArchivist(user)`: Cán bộ lưu trữ được giao tiếp nhận hồ sơ vào kho lưu trữ số cơ quan.

### 3.3. Trục ABAC (Attribute-Based Access Control)
Đánh giá các thuộc tính ngữ cảnh động:
- `user.portfolio`: Mảng phụ trách của Ban Giám hiệu theo QĐ 420:
  - `ACADEMIC`: Công tác đào tạo, khảo thí, nghiên cứu khoa học, CNTT, chuyển đổi số (Phó Hiệu trưởng Đào tạo).
  - `ADMINISTRATION_LOGISTICS`: Hành chính, tổng hợp, cơ sở vật chất, tài sản, tuyển sinh, đối ngoại (Phó Hiệu trưởng HC-CSVC).
  - `INSTITUTIONAL_STRATEGY`: Tổ chức cán bộ, tài chính, thanh tra, chiến lược tổng thể (Hiệu trưởng).
- `resource.departmentId`: Mã định danh đơn vị chuẩn tắc (`P_QLDT`, `P_HCQT`, `K_CNTT`,...).
- `resource.classification`: Cấp độ bảo mật dữ liệu (`PUBLIC`, `INTERNAL`, `RESTRICTED`, `PERSONAL`, `STATE_SECRET`).
- `context.validity`: Khoảng thời gian ủy quyền có hiệu lực (`startDate <= now && now <= expiresAt`) trích xuất từ `DacumDelegation`.
- `context.securityContext`: Địa chỉ IP nội bộ, giao thức xác thực hai lớp (2FA/MFA), tính toàn vẹn chứng thư số.

---

## 4. HÀM ĐÁNH GIÁ TRUY CẬP CHUẨN TẮC: `authorize()`

Mọi yêu cầu tác nghiệp trên hệ thống đều phải đi qua đường ống đánh giá chuẩn mực của hàm `authorize`:

```typescript
type AuthorizationDecision = {
  granted: boolean;
  statusCode: 
    | "GRANTED"
    | "UNAUTHENTICATED"
    | "DEACTIVATED_ACCOUNT"
    | "SEPARATION_OF_POWERS_VIOLATION"
    | "SEPARATION_OF_DUTIES_VIOLATION"
    | "STATE_SECRET_STRICT_PROHIBITION"
    | "PERSONAL_DATA_PRIVACY_BREACH"
    | "PORTFOLIO_MISMATCH"
    | "DELEGATION_EXPIRED"
    | "DEPARTMENT_BOUNDARY_VIOLATION"
    | "INSUFFICIENT_RELATIONSHIP"
    | "INSUFFICIENT_CAPABILITY";
  reason: string;
  auditRecord: {
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    timestamp: Date;
    decision: "ALLOW" | "DENY";
    policyMatched?: string;
    ipAddress?: string;
  };
};

function authorize(
  user: UserContext,
  action: CapabilityAction,
  resource: DomainResource | null,
  context: SecurityContext,
  now: Date = new Date()
): AuthorizationDecision;
```

### Quy trình Đánh giá 7 Bước (Evaluation Pipeline):

```
                       YÊU CẦU TÁC NGHIỆP (Action, Resource, Context)
                                         │
    ┌────────────────────────────────────▼────────────────────────────────────┐
    │ BƯỚC 1: XÁC THỰC DANH TÍNH & TRẠNG THÁI HOẠT ĐỘNG                       │
    │ - user.isActive === true                                                │
    │ - user.deactivatedAt === null                                           │
    │ - sessionToken còn hạn, chữ ký mật mã JWT hợp lệ                        │
    └────────────────────────────────────┬────────────────────────────────────┘
                                         │ [Hợp lệ]
    ┌────────────────────────────────────▼────────────────────────────────────┐
    │ BƯỚC 2: RÀNG BUỘC PHÁP LÝ VÙNG CẤM (LEGAL HARD INVARIANTS)             │
    │ - if resource.classification === 'STATE_SECRET':                        │
    │     -> TỪ CHỐI TUYỆT ĐỐI (Luật 117/2025/QH15) & KÍCH HOẠT CÔ LẬP        │
    │ - if resource.classification === 'PERSONAL' && !hasConsentOrLegalBasis: │
    │     -> TỪ CHỐI (Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15)               │
    └────────────────────────────────────┬────────────────────────────────────┘
                                         │ [Hợp lệ]
    ┌────────────────────────────────────▼────────────────────────────────────┐
    │ BƯỚC 3: PHÂN LẬP QUYỀN LỰC QUẢN TRỊ (SEPARATION OF POWERS)              │
    │ - if (user.activePositionCode === 'QUAN_TRI_HE_THONG' || isSystemAdmin):│
    │     -> TỪ CHỐI: Quản trị kỹ thuật không có quyền nghiệp vụ điều hành     │
    │        (Không ký văn bản, không duyệt task, không xem hồ sơ nhân sự/lương)│
    └────────────────────────────────────┬────────────────────────────────────┘
                                         │ [Hợp lệ]
    ┌────────────────────────────────────▼────────────────────────────────────┐
    │ BƯỚC 4: RÀNG BUỘC TRÁCH NHIỆM TÁC NGHIỆP (SEPARATION OF DUTIES - SoD)   │
    │ - Creator != Approver (Người tạo không được tự duyệt nhiệm vụ)          │
    │ - Executor != Reviewer (Người nộp minh chứng không được tự nghiệm thu)   │
    │ - Signer != Numberer/Archivist (Người ký không được tự cấp số/đóng dấu) │
    │ - Delegate != PrimaryOwner (Ủy quyền không được duyệt cho chính mình)   │
    └────────────────────────────────────┬────────────────────────────────────┘
                                         │ [Hợp lệ]
    ┌────────────────────────────────────▼────────────────────────────────────┐
    │ BƯỚC 5: ĐÁNH GIÁ MỐI QUAN HỆ THỰC THỂ (ReBAC EVALUATION)                │
    │ - Kiểm tra quan hệ trực tiếp: creator, primary_owner, collaborator,     │
    │   lead_department_head, drafting_user, assignee                         │
    └────────────────────────────────────┬────────────────────────────────────┘
                                         │ [Hợp lệ]
    ┌────────────────────────────────────▼────────────────────────────────────┐
    │ BƯỚC 6: ĐÁNH GIÁ NGỮ CẢNH VÀ THUỘC TÍNH (ABAC EVALUATION)               │
    │ - Ban Giám hiệu: Phù hợp mảng phụ trách theo QĐ 420 (hoặc Hiệu trưởng)  │
    │ - Đơn vị: Phù hợp ranh giới phòng ban theo QĐ 203                       │
    │ - Ủy quyền: Còn hạn hiệu lực (DacumDelegation.expiresAt >= now)         │
    └────────────────────────────────────┬────────────────────────────────────┘
                                         │ [Hợp lệ]
    ┌────────────────────────────────────▼────────────────────────────────────┐
    │ BƯỚC 7: ÁP DỤNG DANH MỤC NĂNG LỰC & XUẤT KẾT QUẢ KIỂM TOÁN              │
    │ - Đối chiếu ma trận Position + Relationship + Capability                │
    │ - Trả về: { granted: true, statusCode: 'GRANTED' }                      │
    │ - Ghi vết kiểm toán bất biến (Immutable Audit Log)                      │
    └─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. DANH MỤC NĂNG LỰC CHUẨN TẮC (CAPABILITIES CATALOG)

Mọi quyền hạn trong hệ thống được chuẩn hóa theo cú pháp danh mục phân cấp: `<domain>.<subdomain>.<verb>`.

### 5.1. Phân hệ Quản lý Nhiệm vụ (Task Capabilities)

| Mã Năng Lực (Capability) | Tên gọi tác nghiệp | Mô tả ngữ nghĩa và Ràng buộc thẩm quyền |
|---|---|---|
| `task.view` | Xem thông tin nhiệm vụ | Xem chi tiết nhiệm vụ, tiến độ, hạn nộp. Cho phép đối với người tạo, người thực hiện, phối hợp, lãnh đạo đơn vị trực thuộc, hoặc BGH khi tra cứu toàn trường. |
| `task.create` | Tạo mới nhiệm vụ | Tạo nhiệm vụ cấp trường (`SCHOOL`), cấp đơn vị (`DEPARTMENT`) hoặc cá nhân (`INDIVIDUAL`). Cán bộ chỉ được tạo nhiệm vụ trong phạm vi thẩm quyền. |
| `task.assign` | Phân công giao việc | Chỉ định người chịu trách nhiệm chính (`PRIMARY_OWNER`) và các thành viên phối hợp (`COLLABORATOR`). |
| `task.reassign` | Điều chuyển giao việc | Thay đổi người chủ trì khi có biến động nhân sự, tắc nghẽn tiến độ hoặc theo quyết định của Ban Giám hiệu (`ExecutiveResolution`). |
| `task.update_execution` | Cập nhật thực hiện | Báo cáo tỷ lệ hoàn thành (%), cập nhật nhật ký tiến độ, ghi chú tác nghiệp. Dành riêng cho người chủ trì và người phối hợp. |
| `task.submit_result` | Nộp sản phẩm minh chứng | Tải lên tệp đính kèm (`TaskDeliverable`), tài liệu hoàn thành, báo cáo nghiệm thu để gửi cấp quản lý phê duyệt. |
| `task.review` | Thẩm tra sản phẩm | Đánh giá sản phẩm minh chứng, yêu cầu chỉnh sửa (`REVISION_REQUIRED`) nếu chưa đạt chuẩn chất lượng theo DACUM. Áp dụng SoD: Không được tự thẩm tra sản phẩm do mình nộp. |
| `task.approve` | Phê duyệt hoàn thành | Nghiệm thu chính thức sản phẩm minh chứng, xác nhận hoàn thành nhiệm vụ (`COMPLETED`). Dành cho Trưởng đơn vị hoặc BGH. Áp dụng SoD: Người tạo/người làm chính không được tự duyệt. |
| `task.monitor` | Giám sát tác nghiệp | Theo dõi bảng điều khiển tiến độ, phát hiện điểm nghẽn, xem tỷ lệ trễ hạn của các đơn vị mà không can thiệp sửa đổi dữ liệu. |
| `task.remind` | Đôn đốc nhắc việc | Phát lệnh nhắc việc tức thời qua thông báo nội bộ và Telegram Bot theo Thông báo số 593/TB-CĐKTCNQN. |
| `task.close` | Đóng kết thúc nhiệm vụ | Quyết định đóng hồ sơ nhiệm vụ sau khi toàn bộ sản phẩm và công việc thành phần đã được phê duyệt đầy đủ. |
| `task.cancel` | Hủy bỏ nhiệm vụ | Hủy nhiệm vụ không còn phù hợp với kế hoạch công tác. Bắt buộc nhập lý do giải trình và lưu vết kiểm toán vĩnh viễn. |

### 5.2. Phân hệ Văn bản Đến (Incoming Document Capabilities - NĐ 30/2020)

| Mã Năng Lực (Capability) | Tên gọi tác nghiệp | Mô tả ngữ nghĩa và Ràng buộc thẩm quyền |
|---|---|---|
| `document.incoming.register` | Tiếp nhận và Vào sổ văn bản đến | Kiểm tra tính toàn vẹn, định dạng PDF/A quét màu, lấy số đ��n tự động liên tục theo năm, cập nhật Sổ đăng ký văn bản đến. Dành riêng cho `VAN_THU`. |
| `document.incoming.present` | Trình văn bản đến | Chuyển văn bản điện tử lên Ban Giám hiệu xem xét, định tuyến tự động hoặc thủ công theo phân công lĩnh vực QĐ 420. Dành cho `VAN_THU`. |
| `document.incoming.direct` | Bút phê chỉ đạo điều hành | Ban hành ý kiến chỉ đạo điện tử (`DocumentDirective`), xác định phòng ban chủ trì, phòng ban phối hợp, thời hạn hoàn thành. Dành riêng cho `BAN_GIAM_HIEU`. |
| `document.incoming.assign_unit` | Phân giao đơn vị chủ trì | Xác định đơn vị chuyên môn chịu trách nhiệm chính xử lý văn bản. Tự động kích hoạt cơ chế tạo `Task` liên kết (`linkedTaskId`). |
| `document.incoming.assign_person` | Phân công cán bộ xử lý | Trưởng đơn vị sau khi nhận văn bản phân công cụ thể chuyên viên/giảng viên trong khoa/phòng thụ lý giải quyết trong 24 giờ. |
| `document.incoming.execute` | Thụ lý thực hiện văn bản | Cán bộ được phân công nghiên cứu văn bản, lập hồ sơ công việc, soạn dự thảo văn bản trả lời hoặc thực hiện nội dung chỉ đạo. |

### 5.3. Phân hệ Văn bản Đi (Outgoing Document Capabilities - NĐ 30/2020)

| Mã Năng Lực (Capability) | Tên gọi tác nghiệp | Mô tả ngữ nghĩa và Ràng buộc thẩm quyền |
|---|---|---|
| `document.outgoing.draft` | Khởi tạo dự thảo văn bản đi | Tạo hồ sơ dự thảo văn bản, nhập trích yếu, soạn nội dung, tải tệp bản thảo định dạng DOCX/PDF. Dành cho cán bộ soạn thảo (`CHUYEN_VIEN`, `GIANG_VIEN`). |
| `document.outgoing.review_content` | Kiểm duyệt nội dung chuyên môn | Trưởng phòng/Trưởng khoa nơi soạn thảo kiểm tra tính chính xác về nội dung chuyên môn, căn cứ pháp lý và tính khả thi trước khi trình trường. |
| `document.outgoing.review_format` | Kiểm tra thể thức văn bản | Văn thư cơ quan hoặc chuyên viên tổng hợp Phòng HC-QT kiểm tra thẩm quyền ban hành, thể thức và kỹ thuật trình bày theo Phụ lục I NĐ 30/2020. |
| `document.outgoing.sign` | Ký số chức danh có thẩm quyền | Hiệu trưởng ký số cá nhân (Token/SIM PKI chuyên dùng công vụ) với hình ảnh chữ ký màu xanh tại vị trí thẩm quyền chính thức. |
| `document.outgoing.sign_kt` | Ký thay Hiệu trưởng (KT.) | Phó Hiệu trưởng ký số cá nhân đối với các văn bản thuộc lĩnh vực phân công công tác thường xuyên theo QĐ 420/QĐ-CĐKTCNQN. |
| `document.outgoing.sign_tuq` | Ký thừa ủy quyền (TUQ.) | Trưởng phòng/Trưởng khoa ký số cá nhân khi và chỉ khi có quyết định/văn bản ủy quyền bằng văn bản của Hiệu trưởng (`DelegationGrant` hợp lệ kèm `sourceDocument`). Cấm tái ủy quyền cho cấp phó. |
| `document.outgoing.number` | Cấp số văn bản đi | Văn thư cơ quan cấp số đi từ Bộ đếm số tự động atomic (`DocumentNumberSequence`), ghi ngày ban hành và cập nhật Sổ văn bản đi. |
| `document.outgoing.organization_sign` | Ký số cơ quan (Đóng dấu số) | Văn thư cơ quan áp dụng Chữ ký số tổ chức (Con dấu điện tử màu đỏ) trùm lên 1/3 chữ ký chức danh về phía bên trái. |
| `document.outgoing.issue` | Phát hành văn bản | Phát hành văn bản điện tử qua Trục liên thông văn bản quốc gia, gửi email công vụ và lưu trữ bản số hóa có mã băm SHA-256 vào sổ văn bản cơ quan. |

### 5.4. Phân hệ Hồ sơ Công việc & Lưu trữ (Dossier & Archive Capabilities - QĐ 93, KH 227)

| Mã Năng Lực (Capability) | Tên gọi tác nghiệp | Mô tả ngữ nghĩa và Ràng buộc thẩm quyền |
|---|---|---|
| `dossier.open` | Lập hồ sơ công việc điện tử | Khởi tạo danh mục hồ sơ công việc số đầu năm hoặc khi bắt đầu triển khai một đề án/nhiệm vụ lớn theo Danh mục hồ sơ cơ quan. |
| `dossier.add_item` | Thu thập văn bản vào hồ sơ | Tập hợp các văn bản đi, đến, tờ trình, biên bản họp, sản phẩm minh chứng đã hoàn thành vào hồ sơ công việc điện tử. |
| `dossier.close` | Đóng kết thúc hồ sơ | Khóa biên tập hồ sơ khi công việc kết thúc, kiểm tra tính toàn vẹn và lập bản mục lục tài liệu trong hồ sơ. |
| `dossier.transfer_archive` | Nộp lưu hồ sơ vào Lưu trữ cơ quan | Cán bộ lập hồ sơ chuyển giao hồ sơ điện tử đã đóng sang bộ phận Lưu trữ cơ quan (Phòng HC-QT) kèm biên bản giao nhận điện tử. |
| `dossier.accept_archive` | Thẩm tra & Tiếp nhận lưu trữ | Cán bộ Lưu trữ (`LUU_TRU`) kiểm tra tiêu chuẩn lưu trữ, xác định thời hạn bảo quản (vĩnh viễn hoặc có thời hạn), xếp vào kho số cơ quan. |

### 5.5. Phân hệ Quản trị Hệ thống & Hạ tầng (System Administration Capabilities)

| Mã Năng Lực (Capability) | Tên gọi tác nghiệp | Mô tả ngữ nghĩa và Ràng buộc thẩm quyền |
|---|---|---|
| `account.manage` | Quản lý tài khoản người dùng | Tạo tài khoản, liên kết Google Workspace (`@cdktcnqn.edu.vn`), kích hoạt/vô hiệu hóa tài khoản, cấp lại phương thức xác thực. |
| `org.manage` | Quản lý cơ cấu tổ chức | Cập nhật danh mục phòng ban, khoa, trung tâm theo QĐ 282/QĐ-CĐKTCNQN, thiết lập mã định danh chuẩn và cấu trúc phân cấp. |
| `position.manage` | Quản lý vị trí việc làm & DACUM | Quản lý danh mục vị trí việc làm theo NĐ 232/2026/NĐ-CP (`JobCatalogItem`), cụm nhiệm vụ (`DacumDuty`) và định nghĩa công việc (`DacumTaskDef`). |
| `system.configure` | Cấu hình tham số kỹ thuật | Cấu hình máy chủ thư điện tử, tích hợp Telegram Bot Webhook, cấu hình tham số bảo mật máy chủ, sao lưu dữ liệu tự động. |
| `audit.view` | Giám sát nhật ký an ninh | Xem xét nhật ký truy cập, nhật ký thay đổi quyền hạn, phát hiện hành vi vi phạm an toàn thông tin theo Luật An ninh mạng. |

---

## 6. NGUYÊN TẮC PHÂN LẬP QUYỀN LỰC TUYỆT ĐỐI (STRICT SEPARATION OF POWERS)

Một lỗ hổng nghiêm trọng thường gặp trong các hệ thống phần mềm là gán quyền "siêu quản trị" (`SUPER_ADMIN`) cho nhân viên CNTT, dẫn đến việc người làm kỹ thuật có thể tự ý đọc thư từ, duyệt chi ngân sách, ký văn bản hoặc sửa đổi kết quả công tác. QCET E-Office thiết lập nguyên tắc phân lập quyền lực bất biến:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 STRICT SEPARATION OF POWERS ARCHITECTURE                    │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ QUẢN TRỊ KỸ THUẬT (SYSTEM ADMIN)     │ THẨM QUYỀN ĐIỀU HÀNH (BUSINESS OPS)   │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ [ĐƯỢC PHÉP]:                         │ [ĐƯỢC PHÉP]:                         │
│ - Quản lý tài khoản, mật khẩu, SSO   │ - Ký số văn bản đi (BGH)             │
│ - Tạo/sửa phòng ban, chức danh       │ - Bút phê chỉ đạo văn bản đến (BGH)  │
│ - Cấu hình sao lưu, mạng, Telegram   │ - Phê duyệt nhiệm vụ / minh chứng    │
│ - Xem nhật ký an ninh hệ thống       │ - Xem hồ sơ cán bộ, bảng lương       │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ [CẤM TUYỆT ĐỐI]:                     │ [CẤM TUYỆT ĐỐI]:                     │
│ - KHÔNG ký văn bản hành chính        │ - KHÔNG can thiệp trực tiếp cấu hình │
│ - KHÔNG phê duyệt nhiệm vụ nội bộ    │   máy chủ, mạng, cơ sở dữ liệu       │
│ - KHÔNG xem tài liệu nhân sự, lương  │ - KHÔNG sửa đổi mã nguồn hoặc        │
│ - KHÔNG sửa đổi lịch sử kiểm toán    │   bỏ qua quy trình kiểm soát kỹ thuật│
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### Quy tắc kiểm tra kỹ thuật (Hard Code Guard):
```typescript
const isSystemAdmin = user.activeAssignment?.positionCode === "QUAN_TRI_HE_THONG" || user.systemRole === "SYSTEM_ADMIN";

if (isSystemAdmin) {
  // Nguyên tắc Default Deny trên thực thể nghiệp vụ: Quản trị viên chỉ được cấp các quyền hạ tầng kỹ thuật
  const allowedAdminPrefixes = ["system.", "account.", "org.", "position.", "audit."];
  const isInfrastructureAction = allowedAdminPrefixes.some(prefix => action.startsWith(prefix));

  if (!isInfrastructureAction) {
    return {
      granted: false,
      statusCode: "SEPARATION_OF_POWERS_VIOLATION",
      reason: "Quản trị viên kỹ thuật bị cấm tuyệt đối truy cập hoặc can thiệp nghiệp vụ quản lý, hồ sơ nhân sự, bảng lương và văn bản điều hành của Nhà trường."
    };
  }

  // Danh mục hành vi cấm bổ sung tường minh (bao gồm cả đọc dữ liệu nhạy cảm)
  const forbiddenBusinessActions: CapabilityAction[] = [
    "document.outgoing.sign",
    "document.outgoing.sign_kt",
    "document.outgoing.sign_tuq",
    "document.outgoing.number",
    "document.outgoing.organization_sign",
    "document.incoming.direct",
    "task.approve",
    "task.review",
    "dossier.view",
    "dossier.accept_archive",
    "hr.view",
    "payroll.view",
    "user.view_sensitive_personal_data"
  ];
  if (forbiddenBusinessActions.includes(action)) {
    return {
      granted: false,
      statusCode: "SEPARATION_OF_POWERS_VIOLATION",
      reason: "Vi phạm nguyên tắc phân lập quyền lực: Quản trị viên không được phép thực hiện hành động nghiệp vụ hoặc xem dữ liệu nhân sự nhạy cảm."
    };
  }
}
```

---

## 7. TIÊU CHUẨN PHÂN LOẠI DỮ LIỆU & QUY ĐỊNH VÙNG CẤM (DATA CLASSIFICATIONS & HARD POLICIES)

Mọi thực thể tài liệu và nhiệm vụ trong hệ thống bắt buộc phải gắn với một cấp độ phân loại dữ liệu (`DataClassification`):

```
                               CẤP ĐỘ PHÂN LOẠI DỮ LIỆU
                                         │
        ┌──────────────────┬─────────────┴───────┬──────────────────┐
        ▼                  ▼                     ▼                  ▼
      PUBLIC            INTERNAL            RESTRICTED           PERSONAL
    (Công khai)        (Nội bộ)             (Hạn chế)          (Dữ liệu cá nhân)
  Thông báo chung,   Văn bản chỉ đạo,     Kế hoạch tài chính,   CCCD, Tài khoản NH,
  Lịch công tác,     Quy trình đào tạo,   Đề thi, Đáp án,      Bệnh án, Đánh giá,
  Tuyển sinh         Tiến độ nhiệm vụ     Hồ sơ kỷ luật        Theo Luật 91/2025
        │                  │                     │                  │
        └──────────────────┼─────────────────────┴──────────────────┘
                           ▼
                 [VÙNG CẤM TUYỆT ĐỐI]
                     STATE_SECRET
           (Bí mật Nhà nước: Mật, Tối mật, Tuyệt mật)
        Theo Luật Bảo vệ bí mật nhà nước 117/2025/QH15
    -> CẤM SỐ HÓA, CẤM LƯU TRỮ TRÊN QCET E-OFFICE TRỰC TUYẾN
```

### 7.1. Bốn Cấp độ Dữ liệu Hợp lệ trên Hệ thống
1. **`PUBLIC` (Công khai)**: Thông tin tuyển sinh, lịch công tác tuần công khai, biểu mẫu hành chính, chương trình đào tạo công bố theo chuẩn kiểm định. Bất kỳ ai trong hoặc ngoài trường đều có thể truy cập.
2. **`INTERNAL` (Nội bộ)**: Các thông báo nội bộ, kế hoạch tuần của khoa/phòng, tiến độ nhiệm vụ chung, văn bản hành chính thông thường. Mọi viên chức, giảng viên đã đăng nhập đều có thể tra cứu theo phạm vi phân công.
3. **`RESTRICTED` (Hạn chế)**: Kế hoạch phân bổ ngân sách, đề thi, đáp án, tài liệu đánh giá cán bộ, hồ sơ xử lý kỷ luật. Chỉ Ban Giám hiệu và Trưởng các đơn vị liên quan trực tiếp mới có quyền truy cập.
4. **`PERSONAL` (Dữ liệu cá nhân theo Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP)**: Số Căn cước công dân, số điện thoại riêng, địa chỉ cư trú, thông tin tài khoản ngân hàng nhận lương, hồ sơ bệnh án viên chức.
   - Bắt buộc mã hóa lưu trữ ở mức trường dữ liệu (Field-level Encryption).
   - Tối thiểu hóa dữ liệu (Data Minimization): Không bao giờ gửi các trường này trong payload API của danh sách chung.

### 7.2. Chính sách Vùng cấm: Bí mật Nhà nước (`STATE_SECRET`)
- **Căn cứ**: Luật Bảo vệ bí mật nhà nước số 117/2025/QH15.
- **Quy định bất biến**:
  - Hệ thống QCET E-Office là nền tảng quản lý hành chính vận hành trên mạng diện rộng thông thường, **KHÔNG ĐƯỢC PHÉP tiếp nhận, số hóa, đăng tải, luân chuyển hoặc lưu trữ văn bản thuộc danh mục MẬT, TỐI MẬT, TUYỆT MẬT**.
  - Văn thư cơ quan tuyệt đối không scan tài liệu mật lên phần mềm; tài liệu mật phải xử lý bằng Sổ văn bản mật truyền thống hoặc mạng nội bộ cơ yếu cô lập (Air-gapped Network).
  - Khi phát hiện người dùng vô ý tải lên tệp đính kèm chứa nội dung bí mật nhà nước, hệ thống tự động kích hoạt trạng thái **Quarantine & Revoke (Cô lập khẩn cấp)**, khóa quyền truy cập tệp, gửi cảnh báo tức thời cho Ban Giám hiệu và Quản trị an ninh thông tin để lập biên bản xử lý theo quy định pháp luật.

---

## 8. NGUYÊN TẮC TÁCH BIỆT TRÁCH NHIỆM TÁC NGHIỆP (SEPARATION OF DUTIES - SoD)

Nhằm đảm bảo sự minh bạch, liêm chính công vụ và ngăn chặn gian lận hoặc xung đột lợi ích, động cơ phân quyền cưỡng chế 4 quy tắc SoD sau:

### Quy tắc SoD 1: Người tạo không được tự phê duyệt (`Creator != Approver`)
- Trong chu trình thực hiện nhiệm vụ: Nếu một cán bộ (kể cả Trưởng phòng hoặc Phó Hiệu trưởng) tự mình tạo một nhiệm vụ cá nhân hoặc nhiệm vụ đơn vị mà mình là người chịu trách nhiệm chính, cán bộ đó **không được phép tự bấm nút phê duyệt hoàn thành (`task.approve`)** cho chính nhiệm vụ đó.
- Yêu cầu tác nghiệp: Nhiệm vụ phải được trình lên cấp quản lý trực tiếp cao hơn (Trưởng phòng trình BGH; BGH trình Hiệu trưởng) phê duyệt nghiệm thu.

### Quy tắc SoD 2: Người thực thi không được tự thẩm tra sản phẩm (`Executor != Reviewer`)
- Khi chuyên viên hoặc giảng viên nộp sản phẩm minh chứng (`TaskDeliverable`):
  - `deliverable.uploadedById !== reviewer.id`.
  - Cán bộ nộp minh chứng bị hệ thống khóa hoàn toàn các thao tác đánh giá đạt/không đạt (`task.review`) hoặc phê duyệt (`task.approve`) trên chính sản phẩm đó.
  - Bắt buộc Trưởng đơn vị, Tổ trưởng chuyên môn hoặc cán bộ giám sát được phân công độc lập thực hiện thẩm tra.

### Quy tắc SoD 3: Người ký không được kiêm nhiệm cấp số và đóng dấu (`Signer != Numberer/Archivist`)
- Tuân thủ nghiêm ngặt Điều 15, 17 và 18 Nghị định số 30/2020/NĐ-CP:
  - Lãnh đạo Nhà trường (Hiệu trưởng / Phó Hiệu trưởng) thực hiện ký số thẩm quyền (`document.outgoing.sign`).
  - Sau khi văn bản có chữ ký số thẩm quyền, văn bản phải được chuyển về bộ phận Văn thư cơ quan. Lãnh đạo ký văn bản **tuyệt đối không thể tự mình cấp số văn bản đi (`document.outgoing.number`)** hoặc **tự mình áp dụng con dấu điện tử cơ quan (`document.outgoing.organization_sign`)**.
  - Chỉ có tài khoản của nhân viên Văn thư cơ quan (`VAN_THU`) mới sở hữu năng lực cấp số và đóng dấu pháp nhân của Nhà trường.

### Quy tắc SoD 4: Cán bộ nhận ủy quyền không được tự phê duyệt cho mình (`Delegate != PrimaryOwner`)
- Khi Trưởng đơn vị ủy quyền quyền phê duyệt công việc cho Phó Trưởng đơn vị qua cơ chế `DacumDelegation`:
  - Phó Trưởng đơn vị được thay mặt Trưởng đơn vị duyệt sản phẩm của các chuyên viên, giảng viên khác trong khoa/phòng.
  - Nhưng đối với các nhiệm vụ mà chính Phó Trưởng đơn vị đó là người chịu trách nhiệm chính (`PRIMARY_OWNER`), quyền ủy quyền tự động mất hiệu lực đối với nhiệm vụ đó. Nhiệm vụ đó bắt buộc phải do chính Trưởng đơn vị phê duyệt hoặc trình thẳng lên Phó Hiệu trưởng phụ trách.

---

## 9. VẾT KIỂM TOÁN BẤT BIẾN & TÍNH CHỐNG CHỐI BỎ (IMMUTABLE AUDIT TRAIL & NON-REPUDIATION)

Mọi quyết định của hàm `authorize()` dẫn đến việc thay đổi trạng thái văn bản, ký số, phê duyệt minh chứng hoặc chuyển đổi quyền lực đều phải tạo ra một bản ghi kiểm toán bất biến (Write-Once-Read-Many):
1. **Metadata kiểm toán**: `actorId`, `actorRole`, `targetResourceId`, `capabilityUsed`, `decision`, `reasonCode`, `timestamp` (lấy theo giờ máy chủ ICT UTC+7), `ipAddress`, `userAgent`.
2. **Bảo đảm toàn vẹn tài liệu**: Mọi văn bản khi ký số, nộp lưu hoặc phê duyệt đều phải tính toán và đối chiếu mã băm **SHA-256** (`sha256Hash`). Nếu tệp tin bị thay đổi dù chỉ một byte trên hệ thống tệp lưu trữ, mã băm sẽ không khớp và hệ thống lập tức từ chối quyền truy cập, đồng thời gióng chuông cảnh báo vi phạm tính toàn vẹn tài liệu.
3. **Tuân thủ Luật Giao dịch điện tử 20/2023/QH15**: Bản ghi phê duyệt điện tử và chữ ký số công vụ có giá trị pháp lý tương đương văn bản giấy có chữ ký tươi và con dấu đỏ, đảm bảo tính chống chối bỏ hoàn toàn trước các cơ quan thanh tra, kiểm tra.

---

*Đặc tả này là chuẩn mực thiết kế tối thượng áp dụng cho toàn bộ các module mã nguồn Backend (Prisma, Next.js Server Actions, Route Handlers), Middleware xác thực và Frontend UI trong hệ thống QCET E-Office.*
