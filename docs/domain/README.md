# QCET E-OFFICE: CẨM NANG KIẾN TRÚC MIỀN NGHIỆP VỤ & CHỈ MỤC CHUẨN TẮC
## (CANONICAL DOMAIN ARCHITECTURE MASTER GUIDE & SPECIFICATION INDEX)

**Cơ quan chủ quản:** Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn  (QCET)  
**Vị trí tài liệu:** `/docs/domain/README.md`  
**Cấp độ hiệu lực:** Tài liệu Kiến trúc Chuẩn tắc Tối cao (Supreme Canonical Architecture Guide)  
**Ngày ban hành:** 09/09/2026  
**Kiến trúc sư trưởng:** Lead Solutions Architect & Institutional Governance Specialist  
**Đối tượng áp dụng:** Ban Giám hiệu, Trưởng các Đơn vị, Kỹ sư Phần mềm, Chuyên viên An toàn thông tin, Kiểm toán viên Hệ thống và Các tác vụ Agentic AI.

---

## MỤC LỤC TỔNG QUAN

1. [Tuyên bố Đột phá Kiến trúc: Bước chuyển mình từ Naive RBAC sang Động cơ Phân quyền Lai 3 Trục](#1-tuyên-bố-đột-phá-kiến-trúc-bước-chuyển-mình-từ-naive-rbac-sang-động-cơ-phân-quyền-lai-3-trục)
2. [Bản đồ Chỉ mục Toàn diện 10 Hồ sơ Đặc tả Nghiệp vụ Miền](#2-bản-đồ-chỉ-mục-toàn-diện-10-hồ-sơ-đặc-tả-nghiệp-vụ-miền)
3. [10 Tiêu chuẩn Hoàn thành (Definition of Done) & Câu trả lời Kiến trúc Dứt khoát](#3-10-tiêu-chuẩn-hoàn-thành-definition-of-done--câu-trả-lời-kiến-trúc-dứt-khoát)
4. [Lộ trình Di trú 10 Giai đoạn (10-Phase Migration Roadmap)](#4-lộ-trình-di-trú-10-giai-đoạn-10-phase-migration-roadmap)
5. [Kế hoạch Hành động Ngay cho Phase 3 & Phase 4 (Tái cấu trúc Lược đồ Cơ sở Dữ liệu)](#5-kế-hoạch-hành-động-ngay-cho-phase-3--phase-4-tái-cấu-trúc-lược-đồ-cơ-sở-dữ-liệu)

---

## 1. TUYÊN BỐ ĐỘT PHÁ KIẾN TRÚC: BƯỚC CHUYỂN MÌNH TỪ NAIVE RBAC SANG ĐỘNG CƠ PHÂN QUYỀN LAI 3 TRỤC

### 1.1 Thất bại mang tính hệ thống của Mô hình Naive RBAC (Corporate SaaS Paradigm)
Trong giai đoạn đầu phát triển, hệ thống QCET E-Office bị chi phối bởi tư duy "SaaS hóa" thương mại với tam giác vai trò cứng nhắc:
$$\text{UserRole} = \{\text{ADMIN}, \text{MANAGER}, \text{STAFF}\}$$
Cách tiếp cận này đã gây ra những khiếm khuyết thể chế nghiêm trọng:
1. **San bằng thẩm quyền pháp định (Semantic Loss)**:
   - Hiệu trư���ng (người đại diện pháp luật, chịu trách nhiệm toàn diện trước Bộ LĐ-TB&XH/Tổng cục GDNN và UBND tỉnh ) bị xếp chung hàng với Phó Hiệu trưởng thành `ADMIN` hoặc `BAN_GIAM_HIEU`.
   - Trưởng phòng chức năng (tham mưu tổng hợp) và Trưởng khoa đào tạo (chuyên môn sư phạm) bị cào bằng thành `MANAGER`.
   - Giảng viên trực tiếp giảng dạy và Chuyên viên văn phòng bị gộp chung thành `STAFF`.
2. **Xung đột thể chế và vi phạm An toàn thông tin**:
   - Quản trị viên kỹ thuật IT (`ADMIN`) trong mô hình SaaS có toàn quyền đọc/ghi. Khi áp dụng vào đại học công lập, điều này đồng nghĩa với việc nhân viên mạng có thể tự ý phê duyệt kế hoạch tài chính, sửa quyết định kỷ luật viên chức, hoặc can thiệp điểm số học vụ — vi phạm nghiêm trọng **Nguyên tắc Phân lập Quyền lực (Separation of Powers)**.
3. **Đánh tráo khái niệm giữa Thẩm quyền (Authority) và Bộ lọc Dữ liệu (Scope)**:
   - Lập trình viên nhầm lẫn giữa cờ `scope: "SCHOOL"` (bộ lọc hiển thị dữ liệu cấp trường) với thẩm quyền ban hành chỉ đạo, dẫn đến việc cấm đoán tùy tiện hoặc hở sườn bảo mật khi người dùng đổi chế độ xem trên giao diện.
4. **Nhầm lẫn phương pháp sư phạm DACUM với quyền hạn phần mềm**:
   - DACUM (Developing A CurriculUM) là phương pháp phân tích nghề để xây dựng chương trình giảng dạy và khung năng lực, hoàn toàn không phải là c��c mã quyền hạn tác nghiệp trong cơ sở dữ liệu (`permission tokens`).

### 1.2 Mô hình Mục tiêu: Động cơ Phân quyền Lai Chuẩn mực Nhà nước (Hybrid Authorization Engine)
QCET E-Office thiết lập mô hình thẩm quyền 3 chiều độc lập nhưng tích hợp nguyên khối tại tầng máy chủ:

```
                                  ┌────────────────────────────────────────────────────────┐
                                  │           AUTHENTICATED USER IDENTITY                  │
                                  │      (Email công vụ @cdktcnqn.edu.vn, Id, CCCD)        │
                                  └──────────────────────────┬─────────────────────────────┘
                                                             │
                                                             ▼
                                  ┌────────────────────────────────────────────────────────┐
                                  │          TRỤC 1: CƠ CẤU TỔ CHỨC & CHỨC VỤ              │
                                  │             (Organization & Positions)                 │
                                  │  - Vị trí công tác (NĐ 232/2026): LDPU, VCMN, VCDC    │
                                  │  - Đơn vị cấu thành (QĐ 282): 05 Phòng, 02 TT, 09 Khoa │
                                  │  - Bổ nhiệm đa nhiệm: PRIMARY, CONCURRENT, ACTING      │
                                  └──────────────────────────┬─────────────────────────────┘
                                                             │
                                 ┌───────────────────────────┴───────────────────────────┐
                                 ▼                                                       ▼
  ┌───────────────────────────────────────────────┐     ┌───────────────────────────────────────────────┐
  │         TRỤC 2: MẢNG PHỤ TRÁCH & ABAC         │     │         TRỤC 3: MỐI QUAN HỆ TÁC NGHIỆP        │
  │          (Portfolio & Data Policies)          │     │                    (ReBAC)                    │
  │  - Phân công BGH (QĐ 420): 11 mảng phụ trách  │     │  - Quan hệ trực tiếp với Task / Document:     │
  │  - Cấp độ dữ liệu: PUBLIC, INTERNAL,          │     │    ASSIGNER, LEAD_UNIT, DRI, COLLABORATOR,    │
  │    RESTRICTED, SECRET (Vùng cấm BMNN)         │     │    REVIEWER, APPROVER, FOLLOWER, OBSERVER     │
  │  - Ủy quyền có thời hạn (DelegationGrant)    │     │  - Bút phê liên thông 2 cấp (Two-Tier Cascade)│
  └───────────────────────┬───────────────────────┘     └───────────────────────┬───────────────────────┘
                          │                                                     │
                          └──────────────────────────┬──────────────────────────┘
                                                     │
                                                     ▼
                                  ┌────────────────────────────────────────────────────────┐
                                  │          FINE-GRAINED CAPABILITY EVALUATION            │
                                  │               (authorize(actor, action, resource))     │
                                  │  - Default Deny (Mặc định từ chối)                     │
                                  │  - Separation of Powers (Phân lập quyền Quản trị)      │
                                  │  - Separation of Duties (Maker-Checker, SoD 1..4)      │
                                  │  - Monotonic Audit Ledger (Bất biến, SHA-256)          │
                                  └────────────────────────────────────────────────────────┘
```

---

## 2. BẢN ĐỒ CHỈ MỤC TOÀN DIỆN 10 HỒ SƠ ĐẶC TẢ NGHIỆP VỤ MIỀN

Bộ đặc tả nghiệp vụ miền của QCET E-Office gồm 10 tập tài liệu chuyên sâu được lưu trữ tại `/docs/domain/`, đóng vai trò là "Hiến pháp kỹ thuật" tối cao cho toàn bộ hệ thống:

| STT | Tập tài liệu & Đường dẫn liên kết | Thể chế & Pháp quy chuẩn tắc | Nội dung cốt lõi & Ràng buộc bất biến | Thực thể miền trung tâm |
|:---:|---|---|---|---|
| **1** | [**`organization.md`**](./organization.md)<br>*Cơ cấu tổ chức & Thực thể hành chính* | - QĐ 282/QĐ-CĐKTCNQN (19/08/2026)<br>- Phương án 690/PA-CĐKTCNQN | Chuẩn hóa 16 đơn vị cấu thành: 05 Phòng chức năng, 02 Trung tâm trực thuộc, 09 Khoa đào tạo chuyên môn và Khối Ban Giám hiệu. Bảng ánh xạ chuyển tiếp bí danh kế thừa `QCET_UNIT_CANONICAL_MAP`. | `OrganizationalUnit`<br>`UnitClosurePath`<br>`UnitMembership` |
| **2** | [**`positions.md`**](./positions.md)<br>*Vị trí việc làm, Đa nhiệm & Mảng phụ trách* | - NĐ 232/2026/NĐ-CP<br>- QĐ 420/QĐ-CĐKTCNQN<br>- TT 63/2026/TT-BGDĐT | Tách biệt Tài khoản định danh (`User`) khỏi Vị trí việc làm (`PositionDefinition`). Hỗ trợ bổ nhiệm đa nhiệm (`PositionAssignment`), phân định 11 mảng trách nhiệm BGH (`ResponsibilityArea`) và 4 nhóm ngạch pháp định (LDPU, VCMN, VCDC, HTPV). | `PositionDefinition`<br>`PositionAssignment`<br>`PortfolioAssignment` |
| **3** | [**`authority.md`**](./authority.md)<br>*Kiến trúc Thẩm quyền Lai & Phân lập Quyền lực* | - Luật An ninh mạng 2018<br>- Quy chế 283/QĐ-CĐKTCNQN<br>- Luật 117/2025/QH15 | Động cơ thẩm định năng lực 7 bước (`authorize`). Cưỡng chế Phân lập quyền lực tuyệt đối (Separation of Powers): Quản trị viên IT bị cấm can thiệp nghiệp vụ và xem dữ liệu nhân sự nhạy cảm. 4 quy tắc SoD ngăn chặn gian lận. | `CapabilityAction`<br>`AuthorizationContext`<br>`DataClassification` |
| **4** | [**`delegations.md`**](./delegations.md)<br>*Mô hình Ủy quyền & Điều phối Tác nghiệp* | - QĐ 283 Điều 4<br>- Thông báo 619/TB-CĐKTCNQN<br>- Bộ luật Dân sự 2015 Đ.138 | Quản lý vòng đời ủy quyền công vụ (`DelegationGrant`). Tuyệt đối cấm tái ủy quyền (Prohibition of Sub-delegation). Kiểm soát chống tự phê duyệt (Anti-Self-Approval). Danh mục thẩm quyền luật định bất khả chuyển giao (`NON_DELEGABLE_CAPABILITIES`). | `DelegationGrant`<br>`DelegationScopeRule`<br>`DelegationAuditLog` |
| **5** | [**`task-management.md`**](./task-management.md)<br>*Hệ điều phối Tác nghiệp & Quản lý Nhiệm vụ* | - Quy chế 283/QĐ-CĐKTCNQN<br>- QĐ 203/QĐ-CĐKTCNQN | Quản lý nhiệm vụ theo mô hình ReBAC 8 vai trò (Assigner, Lead Unit, DRI, Collaborator, Follower, Reviewer, Approver, Observer). Luồng phê duyệt đa cấp linh hoạt thích ứng rủi ro (Risk Tiers 1..4), loại bỏ hoàn toàn mô hình cứng nhắc SaaS. | `Task`<br>`TaskAssignment`<br>`TaskDeliverable`<br>`TaskApprovalStep` |
| **6** | [**`incoming-documents.md`**](./incoming-documents.md)<br>*Quản lý Văn bản Đến & Bút phê Liên thông* | - NĐ 30/2020/NĐ-CP Phụ lục IV<br>- QĐ 420/QĐ-CĐKTCNQN | Chu trình 6 trạng thái xử lý văn bản đến. Định tuyến Bút phê điều hành 2 cấp: Cấp 1 (BGH giao Đơn vị chủ trì) tự động sinh Task; Cấp 2 (Trưởng đơn vị giao chuyên viên thụ lý trong 24h). Cơ chế Xin gia hạn thời hạn (`RequestExtension`) có BGH phê duyệt. | `Document` (INCOMING)<br>`DocumentDirective`<br>`DocumentTrackingItem` |
| **7** | [**`outgoing-documents.md`**](./outgoing-documents.md)<br>*Soạn thảo, Ký số PKI, Đóng dấu số & Phát hành* | - NĐ 30/2020/NĐ-CP Phụ lục I<br>- Luật Giao dịch điện tử 2023 | Quy trình 7 bước nghiêm ngặt. Phân tách rạch ròi Ký chức danh chính thức, Ký thay (`sign_kt`), Ký thừa ủy quyền (`sign_tuq`). Đóng dấu số cơ quan trùm 1/3 chữ ký chức danh. Bất biến mật mã SHA-256 sau khi ký. Quy trình chuyển đổi Bưu chính công ích khi gửi số thất bại. | `Document` (OUTGOING)<br>`DocumentVersion`<br>`SignatureRecord`<br>`DocumentNumberSequence` |
| **8** | [**`records-archive.md`**](./records-archive.md)<br>*Hồ sơ Công việc Số & Lưu trữ Lịch sử* | - Luật Lưu trữ số 33/2024/QH15<br>- QĐ 93 & KH 227 CĐKTCNQN | Nguyên tắc "Người giải quyết việc nào thì lập hồ sơ việc đó". Vòng đời 5 pha: Mở hồ sơ, Thu thập tài liệu, Kết thúc hồ sơ, Nộp lưu trữ cơ quan và Tiếp nhận số hóa vĩnh viễn/có thời hạn. Mã định danh hồ sơ công vụ theo cấu trúc pháp định 6 thành phần. | `WorkDossier`<br>`DossierDocumentItem`<br>`ArchiveDeliveryRecord` |
| **9** | [**`permission-matrix.md`**](./permission-matrix.md)<br>*Ma trận Năng lực & Kiểm soát Truy cập Toàn diện* | - Khung năng lực hệ thống<br>- Kiến trúc Thẩm quyền Lai | Ma trận phân quyền chuẩn tắc đối chiếu từng Capability với 8 vị trí thể chế. 10 kịch bản kiểm thử ủy quyền biên (Boundary Scenarios). Bộ mã lỗi từ chối chuẩn hóa HTTP 403. | `CanonicalPermissionMatrix`<br>`ScenarioVerification`<br>`RejectionCode` |
| **10** | [**`regulations_knowledge_base.md`**](./regulations_knowledge_base.md)<br>*Cơ sở Tri thức Pháp quy & Thể chế Nội bộ* | - Toàn bộ 16 Văn bản QPPL<br>& Quyết định quản trị QCET | Tra cứu căn cứ pháp lý, điều khoản viện dẫn, số hiệu, ngày ban hành và phạm vi áp dụng cho từng quyết định thiết kế kiến trúc trong hệ thống. | `StatutoryIndex`<br>`InstitutionalRuleRegistry` |

### Báo cáo Kiểm toán Độc lập Đính kèm:
- [**`AUDIT_LEGAL_COMPLIANCE.md`**](./AUDIT_LEGAL_COMPLIANCE.md): Báo cáo Kiểm toán Pháp lý & Tuân thủ Thể chế Hành chính Công lập (Đạt 100% tuân thủ pháp luật Việt Nam).
- [**`AUDIT_DOD_VERIFICATION.md`**](./AUDIT_DOD_VERIFICATION.md): Báo cáo Thẩm định Độc lập theo 10 Tiêu chuẩn Hoàn thành (Definition of Done) và Đánh giá Lỗ hổng Kỹ thuật.

---

## 3. 10 TIÊU CHUẨN HOÀN THÀNH (DEFINITION OF DONE) & CÂU TRẢ LỜI KIẾN TRÚC DỨT KHOÁT

10 câu hỏi dưới đây đại diện cho cam kết không thể thương lượng của kiến trúc QCET E-Office đối với t��nh đúng đắn về mặt pháp lý và kỹ thuật:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 10 TIÊU CHÍ DEFINITION OF DONE CỦA QCET                                │
├────┬─────────────────────────────────────────────────────────────────────────────┬───────────────────┤
│ STT│ CÂU HỎI KIỂM CHỨNG BẮT BUỘC                                                │ KẾT QUẢ KIẾN TRÚC │
├────┼─────────────────────────────────────────────────────────────────────────────┼───────────────────┤
│ 1  │ Phó Hiệu trưởng phụ trách Đào tạo có được duyệt công việc về tài chính?     │ TUYỆT ĐỐI KHÔNG   │
│ 2  │ Khi Hiệu trưởng đi công tác ủy quyền 3 ngày thì những quyền nào được chuyển?│ CHỈ QUYỀN CHỈ ĐỊNH│
│ 3  │ System Admin có đọc được hồ sơ nhân sự, bảng lương và tài liệu mật không?   │ TUYỆT ĐỐI KHÔNG   │
│ 4  │ Văn thư có được sửa nội dung văn bản sau khi người có thẩm quyền đã ký số?  │ TUYỆT ĐỐI KHÔNG   │
│ 5  │ Trưởng khoa A có xem được nhiệm vụ nội bộ thuộc Khoa B không?               │ TUYỆT ĐỐI KHÔNG   │
│ 6  │ Một cán bộ / chuyên viên phối hợp (Collaborator) có được đổi người chủ trì? │ TUYỆT ĐỐI KHÔNG   │
│ 7  │ Ai được gắn vai trò "Nhận để biết" trong Task và Văn bản hành chính?        │ OBSERVER & NƠI NHẬN│
│ 8  │ Khi văn bản đến trường, ai là người có thẩm quyền chọn Đơn vị chủ trì?      │ DUY NHẤT BAN GIÁM HIỆU│
│ 9  │ Ai là người duy nhất được cấp số và vào sổ văn bản đi chính thức?          │ DUY NHẤT VĂN THƯ  │
│ 10 │ Sau khi nhiệm vụ hoàn thành, ai chịu trách nhiệm lập hồ sơ công việc số?    │ DUY NHẤT CHỦ TRÌ (DRI)│
└────┴──────────���──────────────────────────────────────────────────────────────────┴───────────────────┘
```

### Chi tiết Phân tích & Cơ chế Kiểm soát:

#### Câu 1: Phó Hiệu trưởng phụ trách Đào tạo có được duyệt công việc về tài chính không?
- **Câu trả lời**: **TUYỆT ĐỐI KHÔNG**.
- **Căn cứ Thể chế**: Quyết định số 420/QĐ-CĐKTCNQN phân công rõ: Lĩnh vực Tài chính (`FINANCE`) do Hiệu trưởng trực tiếp chỉ đạo toàn diện; Phó Hiệu trưởng Đào tạo chỉ phụ trách các mảng Đào tạo (`TRAINING`), Công tác HSSV (`STUDENT_AFFAIRS`) và Chuyển đổi số (`DIGITAL_TRANSFORMATION`).
- **Cơ chế Kỹ thuật**: Tầng thẩm định ABAC tại Bước 6 của hàm `authorize()` kiểm tra `PortfolioAssignment`. Bất kỳ yêu cầu duyệt nhiệm vụ hoặc dự toán tài chính nào xuất phát từ PHT Đào tạo mà không có bản ghi ủy quyền hợp lệ từ Hiệu trưởng sẽ bị chặn ngay lập tức với mã lỗi `PORTFOLIO_MISMATCH` (HTTP 403 Forbidden).

#### Câu 2: Khi Hiệu trưởng đi công tác và ủy quyền 3 ngày thì quyền nào được chuyển?
- **Câu trả lời**: **CHỈ CHUYỂN GIAO CÁC QUYỀN NĂNG TÁC NGHIỆP CỤ THỂ ĐƯỢC NÊU RÕ TRONG VĂN BẢN ỦY QUYỀN; TUYỆT ĐỐI KHÔNG CHUYỂN GIAO CHỨC DANH PHÁP ĐỊNH VÀ CÁC QUYỀN LUẬT ĐỊNH TỐI CAO**.
- **Căn cứ Thể chế**: Thông báo số 619/TB-CĐKTCNQN, Quyết định số 283/QĐ-CĐKTCNQN (Điều 4), Bộ luật Dân sự 2015 (Điều 138) và Điều lệ Trường cao đẳng.
- **Cơ chế Kỹ thuật**: 
  - Hệ thống ghi nhận một bản ghi `DelegationGrant` với khoảng thời gian hiệu lực chính xác `[validFrom, validUntil]`.
  - Các quyền được chuyển giao (ví dụ: `document.incoming.direct`, `task.approve` thuộc thẩm quyền chung).
  - **Vùng cấm bất khả chuyển giao (`NON_DELEGABLE_CAPABILITIES`)**: Bổ nhiệm/miễn nhiệm/kỷ luật cán bộ lãnh đạo đơn vị, ký rút dự toán ngân sách Nhà nước tại Kho bạc Nhà nước tỉnh , và ký sửa đổi Quy chế tổ chức hoạt động của Nhà trường.
  - **Cưỡng chế bất biến**: Cấm tuyệt đối tái ủy quyền (`noSubDelegation: true`) và cấm tự phê duyệt công việc do chính mình làm chủ trì hoặc nộp minh chứng (`Maker-Checker / Anti-Self-Approval`).

#### Câu 3: System Admin có đọc được hồ sơ nhân sự, bảng lương và tài liệu mật không?
- **Câu trả lời**: **TUYỆT ĐỐI KHÔNG**.
- **Căn cứ Thể chế**: Luật An ninh mạng 2018, Luật Bảo vệ dữ liệu cá nhân (Luật 91/2025/QH15), Luật Bảo vệ Bí mật Nhà nước (Luật 117/2025/QH15) và Nguyên tắc Phân lập Quyền lực Quản trị (Separation of Powers).
- **Cơ chế Kỹ thuật**:
  - Hệ thống áp dụng nguyên tắc **Default Deny** trên toàn bộ các thực thể nghiệp vụ (`Task`, `Document`, `Dossier`, `Deliverable`, `Payroll`) đối với người dùng giữ chức danh `QUAN_TRI_HE_THONG` hoặc vai trò hạ tầng `SYSTEM_ADMIN`.
  - Quản trị viên chỉ được cấp các năng lực hạ tầng thuộc tiền tố `system.*`, `account.*`, `org.*`, `position.*`, `audit.*`.
  - Mọi yêu cầu xem dữ liệu nhân sự nhạy cảm (`dossier.view`, `hr.view`, `payroll.view`) đều bị trả về lỗi `SEPARATION_OF_POWERS_VIOLATION`.
  - Trong trường hợp hãn hữu Quản trị viên cần truy cập kỹ thuật để phục vụ khắc phục sự cố hệ thống (`task.view`), hệ thống bắt buộc **che mặt nạ dữ liệu (Data Masking)** đối với thông tin định danh cá nhân và tệp đính kèm, đồng thời kích hoạt cảnh báo an ninh mức cao vào sổ kiểm toán bất biến.

#### Câu 4: Văn thư được sửa nội dung văn bản sau khi người có thẩm quyền ký không?
- **Câu trả lời**: **TUYỆT ĐỐI KHÔNG**.
- **Căn cứ Thể chế**: Nghị định số 30/2020/NĐ-CP (Điều 11, Điều 12, Điều 18, Điều 19) và Luật Giao dịch điện tử 2023.
- **Cơ chế Kỹ thuật**:
  - Phân định rạch ròi: Trưởng đơn vị kiểm tra chuyên môn (`CONTENT_REVIEW`), Văn thư kiểm tra thể thức kỹ thuật (`FORMAT_REVIEW`), Lãnh đạo trường ký số thẩm quyền (`AUTHORIZED_SIGN`).
  - Khi người có thẩm quyền áp chữ ký số cá nhân (Token/SIM PKI chuyên dùng công vụ), tệp văn bản PDF/A chuyển sang trạng thái bất biến (`immutable`). Hệ thống băm tệp và lưu mã băm `signedDocumentHash` (SHA-256) vào `SignatureRecord`.
  - Văn thư chỉ có quyền cấp số (`document.outgoing.number`) và đóng dấu số tổ chức (`document.outgoing.organization_sign`). Nếu văn bản bị can thiệp sửa đổi dù chỉ 1 byte, mã băm sẽ sai lệch, hệ thống lập tức khóa văn bản với cảnh báo `DOCUMENT_MODIFIED`. Nếu phát hiện sai sót nội dung, Văn thư chỉ có quyền từ chối và trả lại đơn vị soạn thảo để thu hồi trình ký lại.

#### Câu 5: Trưởng khoa A có thấy task nội bộ Khoa B không?
- **Câu trả lời**: **TUYỆT ĐỐI KHÔNG**.
- **Căn cứ Thể chế**: Quyết định số 282/QĐ-CĐKTCNQN và Quyết định số 203/QĐ-CĐKTCNQN về chức năng nhiệm vụ các khoa chuyên môn.
- **Cơ chế Kỹ thuật**:
  - Đối với năng lực `task.view`, thẩm quyền của `TRUONG_DON_VI` bị đóng khung nghiêm ngặt trong phạm vi đơn vị mình quản lý (`resource.departmentId === user.departmentId`) hoặc các nhiệm vụ mà đơn vị được phân công là Đơn vị phối hợp (`TaskAssignment.unitId`).
  - Bất kỳ yêu cầu truy cập nào vi phạm ranh giới tổ chức sẽ bị chặn tại Bước 6 của hàm `authorize()` với mã lỗi `DEPARTMENT_BOUNDARY_VIOLATION` (HTTP 403 Forbidden).

#### Câu 6: Một chuyên viên phối hợp có được đổi DRI không?
- **Câu trả lời**: **TUYỆT ĐỐI KHÔNG**.
- **Căn cứ Thể chế**: Quy chế làm việc QĐ 283/QĐ-CĐKTCNQN.
- **Cơ chế Kỹ thuật**:
  - Cán bộ phối hợp nắm giữ vai trò ReBAC là `COLLABORATOR`. Trong bảng ma trận quyền hạn ReBAC của Task Hub, hành vi điều chuyển người chịu trách nhiệm chính (`task.reassign`) bị đánh dấu **`✗ (Deny)`**.
  - Quyền thay đổi người chịu trách nhiệm chính độc quyền thuộc về Người giao việc (`ASSIGNER`), Trưởng đơn vị chủ trì (`LEAD_UNIT`), hoặc Ban Giám hiệu thông qua Lệnh điều hành giải quyết bế tắc (`ExecutiveResolution`).

#### Câu 7: Ai được “nhận để biết”?
- **Câu trả lời**: 
  - Trong **Hệ điều phối Tác nghiệp (Task Hub)**: Là các cá nhân hoặc đơn vị được gán vai trò ReBAC **`OBSERVER`** (Người giám sát / Nhận để biết). Những người này chỉ có quyền xem thông tin và tiến độ (`Read-Only`), không phải nộp sản phẩm minh chứng và không bị gửi ping đôn đốc tự động. Quyền bổ sung hoặc loại bỏ `OBSERVER` thuộc về Người giao việc (`ASSIGNER`) và Trưởng đơn vị chủ trì (`LEAD_UNIT`).
  - Trong **Hệ thống Quản lý Văn bản**: Là danh sách các cơ quan, tổ chức, đơn vị hoặc cá nhân tại mục **Nơi nhận (`recipientList`)** theo quy định tại Điều 10 Nghị định số 30/2020/NĐ-CP. Hệ thống tự động phân phối văn bản điện tử đến bảng tin theo dõi của các đối tượng này với quyền đọc lưu trữ.

#### Câu 8: Văn bản đến ai chọn đơn vị chủ trì?
- **Câu trả lời**: **DUY NHẤT BAN GIÁM HIỆU (HIỆU TRƯỞNG HOẶC PHÓ HIỆU TRƯỞNG PHỤ TRÁCH MẢNG THEO QĐ 420)**.
- **Căn cứ Thể chế**: Nghị định số 30/2020/NĐ-CP (Điều 24, Phụ lục IV) và Quy chế làm việc QĐ 283/QĐ-CĐKTCNQN.
- **Cơ chế Kỹ thuật**:
  - Cán bộ Văn thư cơ quan (`VAN_THU`) sau khi vào sổ chỉ có quyền Lập phiếu trình văn bản (`document.incoming.present`).
  - Thẩm quyền ban hành Bút phê điều hành cấp 1 (`document.incoming.direct` và `document.incoming.assign_unit`) dành riêng cho `BAN_GIAM_HIEU`. Khi BGH xác định đơn vị chủ trì và hạn hoàn thành, hệ thống thực thi giao dịch nguyên khối (Database Transaction) tự động tạo `Task` cấp trường liên kết trong Task Hub. Văn thư và Trưởng phòng tuyệt đối không được tự ý ấn định đơn vị chủ trì.

#### Câu 9: Ai được đánh số văn bản đi?
- **Câu trả lời**: **DUY NHẤT CÁN BỘ VĂN THƯ CƠ QUAN (`VAN_THU`)**.
- **Căn cứ Thể chế**: Nghị định số 30/2020/NĐ-CP (Điều 15, Phụ lục I).
- **Cơ chế Kỹ thuật**:
  - Việc cấp số văn bản đi (`document.outgoing.number`) chỉ được kích hoạt sau khi văn bản đã được Lãnh đạo trường ký số thành công.
  - Số văn bản được sinh tự động, liên tục, tăng dần theo năm từ bộ đếm tuần tự an toàn giao dịch (`DocumentNumberSequence`).
  - Người ký và cán bộ soạn thảo bị từ chối quyền can thiệp vào tiến trình cấp số nhằm bảo đảm tính liên tục và tính pháp lý của Sổ đăng ký văn bản đi của Nhà trường (Separation of Duties - SoD Rule 3).

#### Câu 10: Sau khi hoàn thành công việc, ai chịu trách nhiệm lập hồ sơ?
- **Câu trả lời**: **DUY NHẤT VIÊN CHỨC CHỦ TRÌ THỤ LÝ CHÍNH (DRI) HOẶC CÁN BỘ SOẠN THẢO VĂN BẢN**.
- **Căn cứ Thể chế**: Khoản 1 Điều 9 Luật Lưu trữ số 33/2024/QH15: *"Cá nhân được giao nhiệm vụ giải quyết công việc có trách nhiệm lập hồ sơ về công việc đó và nộp lưu hồ sơ, tài liệu vào Lưu trữ cơ quan đúng thời hạn quy định."*
- **Cơ chế Kỹ thuật**:
  - Bất biến thể chế tối cao: **"Người nào giải quyết việc nào thì lập hồ sơ việc đó"**.
  - Thực thể Hồ sơ công việc (`WorkDossier`) bắt buộc gắn trường `ownerId` với viên chức giữ vai trò `DRI` của nhiệm vụ hoặc người soạn thảo văn bản đi/đ���n.
  - Trưởng phòng giữ vai trò phê duyệt kiểm tra (`A` trong ma trận RACI), Lưu trữ viên giữ vai trò thẩm tra nộp lưu (`ARCHIVED`). Không ai được lập hồ sơ thay cho cá nhân trực tiếp thụ lý công việc.

---

## 4. LỘ TRÌNH DI TRÚ 10 GIAI ĐOẠN (10-PHASE MIGRATION ROADMAP)

Để đưa hệ thống từ trạng thái phân quyền thô sơ cũ về kiến trúc đích chuẩn mực mà không làm gián đoạn vận hành của Nhà trường, lộ trình chuyển đổi được thiết kế gồm 10 giai đoạn tuần tự và an toàn:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             QCET E-OFFICE 10-PHASE ARCHITECTURAL ROADMAP                         │
├───────┬────────────────────────────────────────┬─────────────┬───────────────────────────────────┤
│ Giai  │ Tên giai đoạn                          │ Trạng thái  │ Mục tiêu cốt lõi & Sản phẩm chính │
│ đoạn  │                                        │             │                                   │
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-0   │ Architectural Freeze                   │ HOÀN THÀNH  │ Đóng băng toàn bộ sửa đổi Role cũ;│
│       │ (Đóng băng phân quyền cũ)              │             │ ban hành quy tắc .claude/rules/05 │
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-1   │ Legal & Institutional Grounding        │ HOÀN THÀNH  │ Số hóa thể chế pháp lý: NĐ 30,    │
│       │ (Số hóa căn cứ thể chế)                │             │ NĐ 232, QĐ 282, 283, 420, 203, 93 │
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-2   │ Domain Specification & Bounded Contexts│ HOÀN THÀNH  │ Ban hành 10 tài liệu đặc tả miền; │
│       │ (Thiết lập 10 đặc tả miền nghiệp vụ)   │             │ đạt 10/10 tiêu chí Definition of Done│
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-3   │ Database Schema Refactoring            │ TIẾP THEO   │ Thiết kế mô hình dữ liệu Prisma:  │
│       │ (Tái cấu trúc lược đồ CSDL Prisma)     │ (ƯU TIÊN 1) │ Unit, Position, Assignment, Grant │
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-4   │ Zero-Downtime Data Migration Strategy  │ CHUẨN BỊ    │ Viết script chuyển đổi dữ liệu    │
│       │ (Kế hoạch di trú dữ liệu an toàn)      │             │ bảo toàn dữ liệu lịch sử tasks/docs│
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-5   │ Authoritative Policy Engine            │ KẾ HOẠCH    │ Xây dựng src/server/auth/policies/│
│       │ (Động cơ thẩm định chính sách máy chủ) │             │ thực thi authorize() thuần máy chủ│
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-6   │ API Layer Harmonization & Enforcement  │ KẾ HOẠCH    │ Xóa bỏ query role, gắn capabilities│
│       │ (Chuẩn hóa API & Thực thi bảo mật)     │             │ có kiểu dữ liệu vào JSON response │
├───────┼──────────���─────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-7   │ Clean Data Migration & Seed Alignment  │ KẾ HOẠCH    │ Nạp dữ liệu hạt giống chuẩn 16 đơn│
│       │ (Đồng bộ dữ liệu hạt giống thực tế)    │             │ vị, nhân sự thật, loại bỏ mockup  │
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-8   │ Client UI De-SaaSification             │ KẾ HOẠCH    │ Loại bỏ RoleSwitcher, bind nút bấm│
│       │ (Loại bỏ mặt nạ SaaS trên giao diện)   │             │ trực tiếp theo capabilities server│
├───────┼────────────────────────────────────────┼───���─────────┼───────────────────────────────────┤
│ P-9   │ Adversarial Security Verification      │ KẾ HOẠCH    │ Chạy bộ kiểm thử tự động 10 kịch  │
│       │ (Kiểm thử an ninh đối kháng tự động)   │             │ bản tấn công leo thang đặc quyền  │
├───────┼────────────────────────────────────────┼─────────────┼───────────────────────────────────┤
│ P-10  │ Production Cutover & Handover          │ KẾ HOẠCH    │ Xóa bỏ các shim tương thích cũ,   │
│       │ (Cắt chuyển chính thức & Bàn giao)     │             │ đóng gói tài liệu bàn giao BGH    │
└───────┴────────────────────────────────────────┴─────────────┴───────────────────────────────────┘
```

---

## 5. KẾ HOẠCH HÀNH ĐỘNG NGAY CHO PHASE 3 & PHASE 4 (TÁI CẤU TRÚC LƯỢC ĐỒ CƠ SỞ DỮ LIỆU)

Ngay sau khi hoàn tất công tác phê duyệt đặc tả miền tại Phase 2, nhiệm vụ trọng tâm hàng đầu của đội ngũ kỹ thuật là triển khai **Phase 3: Database Schema Refactoring** và **Phase 4: Zero-Downtime Data Migration Strategy**.

### 5.1 Mục tiêu Kỹ thuật Cốt lõi của Phase 3
Thay thế triệt để cột `User.role (enum UserRole)` và cờ `isStaff` bằng các mô hình quan hệ chuẩn hóa trong PostgreSQL thông qua Prisma ORM:

```prisma
// 1. Đơn vị cấu thành chuẩn tắc theo Quyết định 282/QĐ-CĐKTCNQN
model OrganizationalUnit {
  id               String               @id @default(uuid())
  code             String               @unique // P_QLDT, P_HCQT, K_CNTT, TT_STT...
  name             String               // Tên đầy đủ đơn vị
  shortName        String?              // Tên viết tắt
  unitType         UnitClassification   // FUNCTIONAL_DEPT | ACADEMIC_FACULTY | OPERATIONAL_CENTER | EXECUTIVE_BOARD
  parentUnitId     String?
  parentUnit       OrganizationalUnit?  @relation("UnitHierarchy", fields: [parentUnitId], references: [id])
  childUnits       OrganizationalUnit[] @relation("UnitHierarchy")
  sortOrder        Int                  @default(0)
  isActive         Boolean              @default(true)
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  assignments      PositionAssignment[]
  primaryTasks     Task[]               @relation("TaskLeadUnit")

  @@map("organizational_units")
}

// 2. Danh mục Vị trí việc làm chuẩn tắc theo Nghị định 232/2026/NĐ-CP
model PositionDefinition {
  id               String               @id @default(uuid())
  code             String               @unique // HIEU_TRUONG, TRUONG_KHOA, GIANG_VIEN_H2...
  name             String               // Tên vị trí việc làm
  group            JobCatalogGroup      // LDPU | VCMN | VCDC | HTPV
  standardRank     String?              // Ngạch viên chức tương ứng
  isActive         Boolean              @default(true)
  createdAt        DateTime             @default(now())
  updatedAt        DateTime             @updatedAt

  assignments      PositionAssignment[]

  @@map("position_definitions")
}

// 3. Thực thể Bổ nhiệm đa nhiệm của Viên chức / Người lao động
model PositionAssignment {
  id                     String             @id @default(uuid())
  userId                 String
  user                   User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  positionDefinitionId   String
  positionDefinition     PositionDefinition @relation(fields: [positionDefinitionId], references: [id])
  unitId                 String
  unit                   OrganizationalUnit @relation(fields: [unitId], references: [id])
  assignmentType         AssignmentType     // PRIMARY | ACTING | CONCURRENT | INTERIM
  appointmentDecisionRef String?            // Số quyết định bổ nhiệm
  effectiveFrom          DateTime           @db.Date
  effectiveTo            DateTime?          @db.Date
  status                 AssignmentStatus   // ACTIVE | ON_LEAVE | TERMINATED | SUPERSEDED
  isPrimaryForUser       Boolean            @default(false)
  createdAt              DateTime           @default(now())
  updatedAt              DateTime           @updatedAt

  portfolioAssignments  PortfolioAssignment[]
  delegationsFrom       DelegationGrant[]   @relation("DelegationsFrom")
  delegationsTo         DelegationGrant[]   @relation("DelegationsTo")

  @@unique([userId, positionDefinitionId, unitId, assignmentType])
  @@index([userId, status])
  @@map("position_assignments")
}

// 4. Mảng trách nhiệm Lãnh đạo Ban Giám hiệu theo Quyết định 420/QĐ-CĐKTCNQN
model PortfolioAssignment {
  id                   String               @id @default(uuid())
  positionAssignmentId String
  positionAssignment   PositionAssignment   @relation(fields: [positionAssignmentId], references: [id], onDelete: Cascade)
  responsibilityArea   ResponsibilityArea   // FINANCE | HR | TRAINING | ADMINISTRATION...
  oversightType        OversightType        // PRIMARY_DIRECT | SECONDARY_SUPERVISORY
  decisionRef          String               // QĐ 420/QĐ-CĐKTCNQN
  validFrom            DateTime             @db.Date
  validTo              DateTime?            @db.Date
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  @@unique([positionAssignmentId, responsibilityArea])
  @@map("portfolio_assignments")
}

// 5. Thực thể Ủy quyền tác nghiệp công vụ (Chuẩn hóa từ DacumDelegation)
model DelegationGrant {
  id                   String               @id @default(uuid())
  fromAssignmentId     String
  fromAssignment       PositionAssignment   @relation("DelegationsFrom", fields: [fromAssignmentId], references: [id])
  toAssignmentId       String
  toAssignment         PositionAssignment   @relation("DelegationsTo", fields: [toAssignmentId], references: [id])
  scopeType            DelegationScopeType  // SPECIFIC_TASKS | RESPONSIBILITY_AREA | FULL_OFFICE_INTERIM
  capabilities         String[]             // Danh sách CapabilityAction cụ thể được ủy quyền
  sourceDocumentRef    String               // Số hiệu văn bản ủy quyền gốc (TB 619...)
  validFrom            DateTime
  validUntil           DateTime
  status               DelegationStatus     // ACTIVE | REVOKED | EXPIRED
  noSubDelegation      Boolean              @default(true) // Bất biến: Tuyệt đối cấm tái ủy quyền
  revokedAt            DateTime?
  revocationReason     String?
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  @@index([toAssignmentId, status, validFrom, validUntil])
  @@map("delegation_grants")
}
```

### 5.2 Chiến lược Di trú Dữ liệu Không Gián đoạn (Zero-Downtime Migration Strategy)
Để bảo toàn tuyệt đối 100% dữ liệu lịch sử các nhiệm vụ và văn bản hiện có:
1. **Bước 1 (Schema Extension)**: Thêm các bảng mới vào `schema.prisma` nhưng **chưa xóa** các cột cũ (`User.role`, `User.departmentId`, `User.isStaff`). Chạy migration tạo bảng mới.
2. **Bước 2 (Data Backfill & Seeding)**:
   - Chạy script chuyển đổi tự động: Đọc danh sách `User` hiện tại, dựa vào `role` và `departmentId` cũ để sinh các bản ghi `OrganizationalUnit`, `PositionDefinition` và `PositionAssignment` tương ứng.
   - Thiết lập bảng ánh xạ bí danh `QCET_UNIT_CANONICAL_MAP` để hỗ trợ giải mã mã phòng ban cũ.
3. **Bước 3 (Dual-Writing & Anti-Corruption Layer)**:
   - Cài đặt tầng thích ứng (Adapter / Anti-Corruption Layer) trong `src/server/auth/`: Mọi yêu cầu xác thực phiên đăng nhập vẫn đọc được cả dữ liệu vị trí mới và giả lập `user.role` cũ cho các giao diện chưa kịp chuyển đổi.
4. **Bước 4 (Switching Authorization Engine)**:
   - Chuyển đổi các middleware bảo vệ route sang gọi trực tiếp hàm `authorize(actor, action, resource)`.
5. **Bước 5 (Cleanup & Decommissioning)**:
   - Sau khi hoàn thành Phase 8 (Client UI de-SaaSification) và chạy kiểm thử an ninh Phase 9 thành công, tiến hành xóa bỏ các trường thừa trong database thông qua migration dọn dẹp cuối cùng.

### 5.3 Danh mục Công việc Cần Triển khai Ngay (Immediate Execution Checklist)
- [ ] **Mở nhánh phát triển chuyên biệt**: `feat/phase-3-schema-refactoring` từ nhánh chính.
- [ ] **Cập nhật `prisma/schema.prisma`**: Bổ sung 5 mô hình thực thể miền mới theo thiết kế đã phê duyệt.
- [ ] **Tạo tệp migration Prisma**: Kiểm tra câu lệnh SQL sinh ra, đảm bảo an toàn tuyệt đối không làm mất dữ liệu.
- [ ] **Xây dựng `prisma/seeds/canonical-org-seed.ts`**: Nạp 16 đơn vị cấu thành thực tế của QCET và danh mục vị trí việc làm theo NĐ 232/2026/NĐ-CP.
- [ ] **Xây dựng bộ kiểm thử tính toàn vẹn (Integrity Tests)**: Xác nhận việc ánh xạ thành công từ dữ liệu tài khoản hiện tại sang mô hình vị trí việc làm mới.

---

## 6. KẾT LUẬN & THÔNG ĐIỆP KIẾN TRÚC TỐI CAO

QCET E-Office không phải là một ứng dụng quản lý công việc văn phòng thông thường (Generic To-Do App) và càng không phải là một giải pháp sao chép nguyên mẫu từ mô hình doanh nghiệp tư nhân. Hệ thống này là **Hệ điều hành Điều hành Số & Quản trị Công vụ** của một cơ sở giáo dục nghề nghiệp công lập trực thuộc tỉnh .

Mọi dòng mã nguồn được viết ra, mọi bảng cơ sở dữ liệu được thiết kế, và mọi giao diện người dùng được hiển thị bắt buộc phải phản ánh trung thực:
1. **Tính Tối thượng của Thể chế & Pháp luật**: Luật pháp Nhà nước và Quy chế Nhà trường là luật kiểm soát truy cập cao nhất.
2. **Nguyên tắc Phân lập Quyền lực & Tách biệt Trách nhiệm**: Công nghệ phục vụ quản lý, người làm kỹ thuật không được can thiệp vào thẩm quyền điều hành công vụ.
3. **Tính Toàn vẹn & Trách nhiệm Giải trình**: Mỗi hành vi ký duyệt, phân công, nộp lưu hồ sơ đều phải có chủ thể pháp lý rõ ràng, không thể chối bỏ và được bảo chứng bởi mật mã học.

Bản Cẩm nang này cùng 10 Hồ sơ Đặc tả Nghiệp vụ Miền là kim chỉ nam bất biến hướng dẫn toàn bộ lộ trình phát triển và hoàn thiện dự án QCET E-Office.

---
*Tài liệu được phê duyệt và lưu hành chuẩn tắc trong kho tài liệu kiến trúc của QCET E-Office.*
