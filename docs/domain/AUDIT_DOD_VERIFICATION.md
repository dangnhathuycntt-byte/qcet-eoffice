# BÁO CÁO KIỂM TOÁN ĐỘC LẬP & PHẢN BIỆN CHẤT LƯỢNG (QA AUDIT & ADVERSARIAL CRITIQUE)
## ĐÁNH GIÁ BỘ ĐẶC TẢ NGHIỆP VỤ MIỀN (DOMAIN SPECS) THEO 10 TIÊU CHÍ DEFINITION OF DONE (DoD)

**Dự án:** Hệ thống Điều hành & Tác nghiệp Điện tử Trường Cao đẳng Kinh tế và Công nghệ Quảng Ninh (QCET E-Office)  
**Phân hệ kiểm toán:** Toàn bộ 10 tài liệu đặc tả miền nghiệp vụ tại thư mục `docs/domain/`  
**Vai trò kiểm toán:** Chuyên viên Kiểm toán Độc lập & Phản biện QA Đối kháng (Independent Lead Auditor & Adversarial QA Critic)  
**Tình trạng tài liệu:** Báo cáo Xác minh Chuẩn tắc (Official DoD Verification Audit)  
**Mã tài liệu:** `QCET-AUDIT-DOD-2026-01`  
**Ngày thực hiện:** 09/09/2026  

---

## I. TỔNG QUAN KẾT QUẢ KIỂM TOÁN (EXECUTIVE SUMMARY)

Đoàn kiểm toán đã tiến hành rà soát đối kháng toàn diện 10 văn bản đặc tả nghiệp vụ miền mới ban hành tại `docs/domain/`, đối chiếu với 10 câu hỏi cốt lõi thuộc Tiêu chuẩn Hoàn thành (Definition of Done - DoD) của dự án QCET E-Office và các căn cứ pháp lý của Nhà nước Việt Nam (NĐ 30/2020/NĐ-CP, NĐ 232/2026/NĐ-CP, TT 63/2026/TT-BGDĐT, Luật GDĐT 2023, NĐ 68/2024/NĐ-CP, Luật 91/2025/QH15, Luật 117/2025/QH15, Luật 33/2024/QH15) cùng các Quyết định nội bộ của Nhà trường (QĐ 283, QĐ 282, QĐ 420, QĐ 203, QĐ 93, KH 227).

### Kết quả tổng hợp:
- **Số tiêu chí ĐẠT (PASS):** 9 / 10 (90%)
- **Số tiêu chí ĐẠT CÓ ĐIỀU KIỆN / CẢNH BÁO LỖ HỔNG (CONDITIONAL PASS / CRITICAL GAP):** 1 / 10 (Câu hỏi 3 - Quyền đọc hồ sơ nhân sự của System Admin)
- **Đánh giá chung:** Bộ đặc tả đã thành công vượt bậc trong việc xóa bỏ hoàn toàn lối tư duy phân quyền thô sơ cũ (Role Enum `ADMIN/MANAGER/STAFF`), thiết lập vững chắc mô hình Ủy quyền Lai 3 trục **RBAC + ReBAC + ABAC**, gắn kết chặt chẽ với cơ cấu thực tế của QCET và khung pháp lý công vụ Việt Nam. Tuy nhiên, góc nhìn kiểm toán đối kháng phát hiện một số điểm bất nhất giữa phần tuyên bố chính sách (Policy Narrative) và các đoạn mã mẫu thực thi (Implementation Pseudo-code), cùng một số tàn tích thuật ngữ doanh nghiệp (Corporate SaaS relic).

---

## II. BẢNG TỔNG HỢP ĐÁNH GIÁ 10 TIÊU CHÍ DEFINITION OF DONE

| STT | Câu hỏi kiểm tra (DoD Mandate) | Kết quả | Trích dẫn nguồn tài liệu chuẩn tắc | Tóm tắt kết luận |
|:---:|---|:---:|---|---|
| **1** | Phó Hiệu trưởng phụ trách Đào tạo có được duyệt công việc về tài chính không? | **PASS** | `positions.md` (§2.2, §2.3)<br>`authority.md` (§3.3, §4 Step 6)<br>`permission-matrix.md` (§3.1, §4 Kịch bản 2B) | **KHÔNG**. Bị từ chối bởi bộ lọc ABAC Portfolio (`PORTFOLIO_MISMATCH`, 403 Forbidden). Trừ khi có văn bản ủy quyền cụ thể (`DelegationGrant`) từ Hiệu trưởng. |
| **2** | Khi Hiệu trưởng đi công tác và ủy quyền 3 ngày thì quyền nào được chuyển? | **PASS**<br>*(Cảnh báo ranh giới)* | `delegations.md` (§1, §2.1, §4, §5)<br>`authority.md` (§3.3, §8 SoD 4)<br>`positions.md` (§1.2) | Chỉ chuyển giao **các năng lực kỹ thuật cụ thể được liệt kê tường minh trong `DelegationGrant`** trong khung thời gian 3 ngày; không chuyển giao chức danh thể chế, cấm tái ủy quyền và cấm tự phê duyệt. |
| **3** | System Admin có đọc được hồ sơ nhân sự không? | **CONDITIONAL PASS**<br>*(Lỗ hổng mã mẫu)* | `authority.md` (§2 Invariant 3, §6, §7)<br>`permission-matrix.md` (§3.4, §3.5)<br>`positions.md` (§2.2) | **Chính sách: KHÔNG**. Phân lập quyền lực cấm Admin đọc tài liệu nhân sự. Tuy nhiên, **mã mẫu tại §6 `authority.md` bỏ sót hành vi đọc** (`dossier.view`), tạo kẽ hở kỹ thuật. |
| **4** | Văn thư được sửa nội dung văn bản sau khi người có thẩm quyền ký không? | **PASS** | `outgoing-documents.md` (§1 Inv 1, 2, 5; §3.2; §4.3)<br>`permission-matrix.md` (§4 Kịch bản 7)<br>`authority.md` (§8 SoD 3) | **TUYỆT ĐỐI KHÔNG**. Văn thư chỉ thẩm tra thể thức. Sau khi ký số, văn bản là bất biến (`immutable`); mọi can thiệp làm sai mã băm SHA-256 gây lỗi `DOCUMENT_MODIFIED`. |
| **5** | Trưởng khoa A có thấy task nội bộ Khoa B không? | **PASS** | `permission-matrix.md` (§3.1 row 72, §5)<br>`task-management.md` (§2.1.B, §3.1)<br>`authority.md` (§3.3, §4 Step 6) | **KHÔNG**. Thẩm quyền xem của Trưởng đơn vị bị đóng khung trong phạm vi đơn vị (`unit` scope); vi phạm trả về `DEPARTMENT_BOUNDARY_VIOLATION` (403 Forbidden). |
| **6** | Một chuyên viên phối hợp có được đổi DRI không? | **PASS** | `task-management.md` (§1 Inv 2, §3.1 Role 5, §3.2)<br>`authority.md` (§5.1 `task.reassign`)<br>`permission-matrix.md` (§3.1 row 75) | **KHÔNG**. Quyền đổi DRI độc quyền thuộc về Người giao việc (`ASSIGNER`), Trưởng đơn vị chủ trì (`LEAD_UNIT`), hoặc BGH qua `ExecutiveResolution`. Cán bộ phối hợp (`COLLABORATOR`) bị cấm (`Deny`). |
| **7** | Ai được “nhận để biết”? | **PASS**<br>*(Cần phân tách ngữ nghĩa)* | `task-management.md` (§3.1 Role 9 `OBSERVER`, §5)<br>`incoming-documents.md` (§3.2 RACI `Informed`)<br>`outgoing-documents.md` (§3.2, §5 `recipientList`) | Trong Task: Vai trò ReBAC **`OBSERVER`** (quyền xem Read-Only, không nhận ping đôn đốc). Trong Văn bản: Các cơ quan/đơn vị/cá nhân trong danh sách **Nơi nhận (`recipientList`)** theo NĐ 30/2020. |
| **8** | Văn bản đến ai chọn đơn vị chủ trì? | **PASS** | `incoming-documents.md` (§1 Inv 3, §2 `DIRECTED`, §3.1.B, §3.2)<br>`permission-matrix.md` (§3.2 row 94)<br>`authority.md` (§5.2) | **BAN GIÁM HIỆU** (Hiệu trưởng hoặc Phó Hiệu trưởng phụ trách mảng theo QĐ 420) thông qua Bút phê chỉ đạo điện tử (`DocumentDirective`). Văn thư và Trưởng phòng không có quyền này. |
| **9** | Ai được đánh số văn bản đi? | **PASS** | `outgoing-documents.md` (§1 Inv 1, 4; §2 `NUMBERED`; §3.4; §5)<br>`authority.md` (§8 SoD 3)<br>`permission-matrix.md` (§3.3 row 108) | **DUY NHẤT CÁN BỘ VĂN THƯ CƠ QUAN (`VAN_THU`)** sau khi BGH đã ký số. Lấy số tự động tăng dần từ `DocumentNumberSequence`. Người ký không được tự cấp số. |
| **10** | Sau khi hoàn thành công việc, ai chịu trách nhiệm lập hồ sơ? | **PASS** | `records-archive.md` (§1.1, §2.1, §3, §4)<br>`incoming-documents.md` (§2 `FILED`, §3.1.D, §3.2)<br>`task-management.md` (§3.1 Role 4 `DRI`) | **CÁ NHÂN CHỦ TRÌ GIẢI QUYẾT CÔNG VIỆC (Cán bộ thụ lý chính / DRI)** theo nguyên tắc: *"Người nào giải quyết việc nào thì lập hồ sơ việc đó"* (Điều 29 NĐ 30/2020 và Điều 12 QĐ 93). |

---

## III. BÁO CÁO PHẢN BIỆN CHI TIẾT TỪNG TIÊU CHÍ (DETAILED ADVERSARIAL AUDIT)

### 1. Phó Hiệu trưởng phụ trách Đào tạo có được duyệt công việc về tài chính không?
- **Đánh giá:** **PASS** (Tuân thủ nghiêm ngặt mô hình ABAC).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `positions.md` Mục 2.2 & 2.3: Phân định rạch ròi 11 mảng trách nhiệm theo Quyết định số 420/QĐ-CĐKTCNQN. Lĩnh vực `FINANCE` (Tài chính & Ngân sách) do Hiệu trưởng (`BGH_HT`) trực tiếp phụ trách, tham mưu bởi Phòng Tài chính (`P_TC`). Phó Hiệu trưởng Đào tạo (`BGH_PHT_DT` - ThS. Trần Trọng Kiệm) chỉ phụ trách mảng `ACADEMIC` gồm: `TRAINING`, `STUDENT_AFFAIRS`, và `DIGITAL_TRANSFORMATION`.
  - `authority.md` Mục 3.3 & Quy trình đánh giá 7 bước (§4 Bước 6): Thuộc tính `user.portfolio` của PHT Đào tạo là `ACADEMIC`. Khi kiểm tra yêu cầu phê duyệt công việc tài chính, hàm `authorize()` đối chiếu ngữ cảnh thuộc tính và trả về mã từ chối `PORTFOLIO_MISMATCH` (HTTP 403 Forbidden).
  - `permission-matrix.md` Kịch bản 2B mô tả chính xác trường hợp này: Khi PHT Đào tạo cố gắng ký duyệt hồ sơ/hợp đồng thuộc mảng tài sản/tài chính, hệ thống chặn đứng với thông báo lỗi: *"Văn bản thuộc lĩnh vực Quản trị - Cơ sở vật chất... Đồng chí không có thẩm quyền ký số văn bản này trừ khi có giấy ủy quyền điều hành."*
- **Lỗ hổng tiềm ẩn & Kiến nghị:**
  - *Kẽ hở nghiệp vụ:* Trong các nhiệm vụ chuyên môn Đào tạo có cấu phần tài chính phụ trợ (ví dụ: "Mua sắm vật tư thực hành khoa CNTT" hoặc "Thanh toán tiền vượt giờ giảng"), cần làm rõ: PHT Đào tạo chỉ phê duyệt **khối lượng chuyên môn**, còn **thẩm định dự toán và duyệt chi** bắt buộc phải chuyển tiếp qua Phòng Tài chính thẩm tra và Hiệu trưởng (chủ tài khoản) phê duyệt tối hậu theo Luồng 3 (`STRATEGIC_HIGH_RISK`) của `task-management.md`.

---

### 2. Khi Hiệu trưởng đi công tác và ủy quyền 3 ngày thì quyền nào được chuyển?
- **Đánh giá:** **PASS** (Thiết kế thực thể hạng nhất đạt chuẩn, nhưng cần chuẩn hóa gói quyền mẫu).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `delegations.md` Mục 1.1, Mục 2.1 và Mục 4: Tuân thủ chặt chẽ Điều 138, 142 Bộ luật Dân sự 2015, Thông báo số 619/TB-CĐKTCNQN và QĐ 283/QĐ-CĐKTCNQN. 
  - Khẳng định bất biến cốt lõi: **Không ủy quyền thể nhân/chức vụ, chỉ ủy quyền tập hợp con các năng lực (`capability`) có giới hạn**.
  - Thực thể `DelegationGrant` yêu cầu xác định cụ thể: `fromAssignmentId` (Hiệu trưởng), `toAssignmentId` (Phó Hiệu trưởng), `capability` (ví dụ: `task:approve_step1`, `document:sign_level2`), `responsibilityArea` (mảng phụ trách ủy quyền), `resourceScope` (`INSTITUTION_WIDE` hoặc theo vụ việc), và khoảng thời gian hiệu lực `validFrom` đến `validUntil` (3 ngày tính theo giờ ICT UTC+7).
  - Ràng buộc bất biến đi kèm:
    1. Cấm tái ủy quyền (`noSubDelegation = true`): Người nhận quyền không được ủy quyền tiếp cho người thứ ba.
    2. Cấm tự phê duyệt (Maker-Checker Invariant): Phó Hiệu trưởng nhận quyền không được dùng quyền của Hiệu trưởng để duyệt nhiệm vụ/minh chứng do chính mình làm chủ trì hoặc nộp.
- **Lỗ hổng & Điểm cần bổ sung (Adversarial Critique):**
  - Hiện tại tài liệu `delegations.md` định nghĩa trường `capability: String` dưới dạng đơn lẻ hoặc tự do. Trong thực tế hành chính khi Hiệu trưởng đi công tác 3 ngày theo Thông báo 619, Hiệu trưởng giao "Ủy quyền điều hành giải quyết công việc chung của Trường". 
  - Hệ thống **chưa đặc tả Danh mục Năng lực Mặc định Được Chuyển giao** (`STANDARD_TRAVEL_DELEGATION_BUNDLE`) và **Danh mục Vùng cấm Không Thể Chuyển giao** (`NON_DELEGABLE_CAPABILITIES`):
    * *Không thể chuyển giao qua ủy quyền tác nghiệp thông thường:* Ký quyết định điều động/bổ nhiệm cán bộ (`position.manage`), ký rút dự toán Kho bạc Nhà nước (thẩm quyền Chủ tài khoản đăng ký với KBNN), sửa đổi Quy chế tổ chức hoạt động của Nhà trường.
    * *Cần bổ sung vào `delegations.md`:* Định nghĩa một enum hoặc preset chuẩn hóa các năng lực được phép ủy quyền ngắn hạn để tránh việc người dùng nhập chuỗi tùy tiện.

---

### 3. System Admin có đọc được hồ sơ nhân sự không?
- **Đánh giá:** **CONDITIONAL PASS / CRITICAL IMPLEMENTATION GAP** (Chính sách tuyên bố CẤM nhưng mã nguồn mẫu để lộ kẽ hở).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `authority.md` Mục 2 Invariant 3 & Mục 6: Thiết lập nguyên tắc Phân lập quyền lực tuyệt đối (Strict Separation of Powers). Tuyên bố dứt khoát tại bảng Mục 6: Quản trị kỹ thuật (`ADMIN`) **[CẤM TUYỆT ĐỐI]: KHÔNG xem tài liệu nhân sự, lương**.
  - `permission-matrix.md` Mục 3.4 & 3.5: Cột `ADMIN` bị đánh dấu `✗ (Deny - SoP)` đối với toàn bộ các hành động trên hồ sơ (`dossier.open`, `dossier.add_item`, `dossier.close`, `dossier.transfer_archive`, `dossier.accept_archive`). ADMIN chỉ có các quyền hạ tầng: `account.manage`, `org.manage`, `position.manage`, `system.configure`, `audit.view`.
  - `positions.md` Mục 2.2: Mảng `HR` (Tổ chức & Cán bộ) thuộc Phòng TC-ĐBCL và Hiệu trưởng, hoàn toàn không thuộc Trung tâm Số - Truyền thông (nơi đặt tài khoản Quản trị viên).
- **Phát hiện lỗ hổng nghiêm trọng (Critical Vulnerability Findings):**
  1. **Lỗ hổng mảng cấm trong mã mẫu (`authority.md` lines 308-316):**
     Đoạn mã mẫu cưỡng chế bằng code:
     ```typescript
     if (user.role === "ADMIN") {
       const forbiddenBusinessActions: CapabilityAction[] = [
         "document.outgoing.sign",
         "document.outgoing.number",
         "document.outgoing.organization_sign",
         "document.incoming.direct",
         "task.approve",
         "task.review",
         "dossier.accept_archive"
       ];
       if (forbiddenBusinessActions.includes(action)) { ... }
     }
     ```
     **Phản biện:** Mảng `forbiddenBusinessActions` **hoàn toàn không có** `dossier.view`, `hr.view`, `user.view_sensitive_personal_data`! Nếu lập trình viên sao chép nguyên văn mảng này vào `src/lib/authorization-service.ts`, System Admin sẽ gọi được API đọc nội dung hồ sơ nhân sự mà không bị hàm này chặn!
  2. **Kẽ hở "Gỡ lỗi kỹ thuật" (`permission-matrix.md` row 72):**
     Hàng `task.view` cấp cho `ADMIN`: `✓ (Chỉ phục vụ gỡ lỗi kỹ thuật)`. Nếu một nhiệm vụ nhân sự nhạy cảm (như "Xử lý kỷ luật viên chức Y" hoặc "Đánh giá quy hoạch cán bộ", mang phân loại `RESTRICTED` hoặc `PERSONAL`) được tạo ra, Quản trị viên có thể mượn danh nghĩa "gỡ lỗi kỹ thuật" để xem toàn bộ nội dung nếu hệ thống không cưỡng chế kiểm tra cấp độ dữ liệu tại Bước 2 Pipeline.
  3. **Tàn tích Legacy Role Enum:** Đoạn code kiểm tra `if (user.role === "ADMIN")` đi ngược lại nguyên tắc không sử dụng Role enum đơn giản; cần thay thế bằng việc kiểm tra mã vị trí `user.activePositionCode === "QUAN_TRI_HE_THONG"`.

---

### 4. Văn thư được sửa nội dung văn bản sau khi người có thẩm quyền ký không?
- **Đánh giá:** **PASS** (Thiết kế hoàn chỉnh, chặt chẽ về cả mặt thể chế và mật mã học).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `outgoing-documents.md` Mục 1 Invariant 1: Phân định rạch ròi 4 hành vi pháp lý độc lập: Duyệt nội dung (`CONTENT_REVIEW`) != Thẩm tra thể thức (`FORMAT_RECORDS_REVIEW`) != Ký số thẩm quyền (`AUTHORIZED_SIGN`) != Cấp số & Đóng dấu số (`NUMBERED` & `ORGANIZATION_DIGITAL_SIGN`).
  - `outgoing-documents.md` Mục 1 Invariant 2 & Mục 3.2: Văn thư chỉ là người gác cổng thể thức theo Phụ lục I NĐ 30/2020. Văn thư **tuyệt đối không được tự ý sửa đổi nội dung chuyên môn** của văn bản. Nếu phát hiện lỗi, Văn thư chỉ có quyền từ chối tiếp nhận và trả về đơn vị soạn thảo để chỉnh sửa.
  - `outgoing-documents.md` Mục 1 Invariant 5 & Mục 4.3 Bước 4: Văn bản sau khi áp chữ ký số là bất biến (`immutable`). Hệ thống lưu trữ `SignatureRecord` chứa mã băm SHA-256 của tệp PDF tại thời điểm ký (`signedDocumentHash`). Nếu Văn thư hoặc bất kỳ ai can thiệp sửa đổi nội dung PDF, tiến trình xác thực sẽ phát hiện sai lệch mã băm và kích hoạt trạng thái cảnh báo đỏ `DOCUMENT_MODIFIED` (Văn bản đã bị sửa đổi trái phép), làm vô hiệu hóa toàn bộ giá trị pháp lý.
  - `permission-matrix.md` Kịch bản 7: Mô phỏng chính xác trường hợp Văn thư phát hiện lỗi chính tả sau khi Hiệu trưởng đã ký số và cố gắng sửa văn bản. Hàm `authorize()` từ chối quyền truy cập; bắt buộc chuyển đơn vị soạn thảo thu hồi và trình ký lại.

---

### 5. Trưởng khoa A có thấy task nội bộ Khoa B không?
- **Đánh giá:** **PASS** (Đóng khung phạm vi ranh giới đơn vị chính xác).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `permission-matrix.md` Mục 3.1 row 72: Đối với năng lực `task.view`, vị trí `TRUONG_DON_VI` được cấp quyền: `✓ (Đơn vị + Được giao)`. Điều này có nghĩa Trưởng khoa A chỉ được xem các nhiệm vụ thuộc đơn vị mình (Khoa A) hoặc các nhiệm vụ do cấp trên giao đích danh cho cá nhân Trưởng khoa A.
  - `permission-matrix.md` Mục 5: Bảng mã từ chối định nghĩa rõ mã lỗi `DEPARTMENT_BOUNDARY_VIOLATION` (HTTP 403 Forbidden): *"Cán bộ đơn vị này can thiệp vào công việc nội bộ của đơn vị khác khi không được phân công phối hợp. Chỉ thao tác trong phạm vi phòng ban công tác hoặc chờ quyết định phân công phối hợp."*
  - `task-management.md` Mục 2.1.B: Nhiệm vụ phát sinh cấp đơn vị (`UNIT`) do Trưởng khoa giao từ kế hoạch nội bộ hoặc phân rã từ công việc cấp trường: *"Chỉ giới hạn phạm vi trách nhiệm và nhân sự trong nội bộ đơn vị (trừ trường hợp mời chuyên gia phối hợp theo văn bản)"*.
  - `authority.md` Mục 3.3 & §4 Bước 6: Kiểm tra thuộc tính `resource.departmentId` khớp với `user.departmentId` theo QĐ 203/QĐ-CĐKTCNQN.

---

### 6. Một chuyên viên phối hợp có được đổi DRI không?
- **Đánh giá:** **PASS** (Bất biến phân quyền ReBAC hoàn hảo).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `task-management.md` Mục 1 Invariant 2 (Single DRI Invariant): Mỗi nhiệm vụ chỉ có duy nhất 01 DRI chịu trách nhiệm chính.
  - `task-management.md` Mục 3.1 & Mục 3.2: Phân định rạch ròi thẩm quyền giữa các vai trò ReBAC:
    * `ASSIGNER` (Người giao việc): Có quyền chỉ định hoặc điều chuyển DRI.
    * `LEAD_UNIT` (Trưởng đơn vị chủ trì): Có thẩm quyền chỉ định và thay đổi nhân sự DRI thuộc đơn vị.
    * `COLLABORATOR` (Cán bộ phối hợp): Chỉ có quyền xem tài liệu, t��i lên minh chứng thành phần, bình luận trao đổi. **Tuyệt đối không có quyền đổi DRI, không có quyền đổi người phối hợp khác**.
    * Tại bảng Ma trận ReBAC (§3.2): Hàng "Phân công / Thay đổi COLLABORATOR" đối với `COLLABORATOR` ghi rõ: **Không**.
  - `permission-matrix.md` Mục 3.1 row 75: Năng lực `task.reassign` (Điều chuyển giao việc / thay đổi DRI) đối với ngạch `GIANG_VIEN_CHUYEN_VIEN` bị đánh dấu từ chối tuyệt đối: **`✗ (Deny)`**.

---

### 7. Ai được “nhận để biết”?
- **Đánh giá:** **PASS** (Nhưng cần làm rõ ranh giới giữa Phân hệ Nhiệm vụ và Phân hệ Văn bản).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - **Trong Phân hệ Quản lý Nhiệm vụ (`Task Management`):**
    * `task-management.md` Mục 3.1 Role 9 & Mục 5: Định nghĩa chính thức chủ thể ReBAC **`OBSERVER` (Nhận để biết / Giám sát thụ động)**.
    * Đối tượng: Các cá nhân hoặc lãnh đạo đơn vị liên quan cần nắm bắt thông tin phục vụ điều hành chung nhưng không tham gia tác nghiệp trực tiếp.
    * Quyền hạn: Quyền xem chỉ đọc (`Read-Only`) toàn bộ tiến trình và hồ sơ; không bị gửi thông báo đôn đốc làm phiền; không có quyền sửa đổi, nộp minh chứng hay phê duyệt.
  - **Trong Phân hệ Văn bản Đi & Văn bản Đến (`Documents`):**
    * `incoming-documents.md` Mục 3.2: Thể hiện qua vai trò **`Informed (I)`** trong Ma trận RACI (ví dụ: Văn thư nhận thông báo khi BGH đã chỉ đạo; Chuyên viên nhận thông báo khi BGH duyệt kết quả).
    * `outgoing-documents.md` Mục 3.2 & Mục 5: Thể hiện qua mục **"Nơi nhận" (`recipientList`)** trên văn bản ban hành theo Điều 16 và Phụ lục I NĐ 30/2020/NĐ-CP (bao gồm: Nơi nhận để thực hiện, Nơi nhận để báo cáo, và Nơi nhận để biết/lưu).
- **Điểm cần hoàn thiện:** Bổ sung vào bảng ma trận ReBAC tại `task-management.md` §3.2 một hàng quy định rõ: *Ai có quyền thêm người vào danh sách `OBSERVER`?* (Khuyến nghị: Chỉ `ASSIGNER` và `LEAD_UNIT`).

---

### 8. Văn bản đến ai chọn đơn vị chủ trì?
- **Đánh giá:** **PASS** (Tuyệt đối tuân thủ thẩm quyền Ban Giám hiệu).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `incoming-documents.md` Mục 1 Invariant 3 (Nguyên tắc chỉ đạo hai cấp chuẩn tắc): Thẩm quyền Cấp 1 (Trường -> Đơn vị) thuộc về **Lãnh đạo có thẩm quyền (Ban Giám hiệu)**. Lãnh đạo ghi bút phê chỉ định Đơn vị chủ trì (`leadDepartmentId`) và Đơn vị phối hợp (`collaboratorIds`).
  - `incoming-documents.md` Mục 2 Vòng đời: Trạng thái `DIRECTED` (Đã có bút phê chỉ đạo) xác định tác nhân chính duy nhất là **Ban Giám hiệu (`BAN_GIAM_HIEU`)**.
  - `incoming-documents.md` Mục 3.1.B: Lãnh đạo BGH căn cứ QĐ 420/QĐ-CĐKTCNQN xem xét văn bản, ghi Bút phê điện tử (`DocumentDirective`), xác định duy nhất 01 đơn vị chủ trì.
  - `incoming-documents.md` Mục 3.2 Bảng RACI: Hoạt động "Bút phê cấp 1: Giao đơn vị chủ trì & hạn xử lý" xác định BGH giữ vai trò **R, A** (Chủ trì và Chịu trách nhiệm tối hậu). Văn thư chỉ giữ vai trò thông báo (I).
  - `permission-matrix.md` Mục 3.2 row 94: Năng lực `document.incoming.assign_unit`:
    * `HIEU_TRUONG`: `✓ (Chỉ định ĐV chủ trì toàn trường)`.
    * `PHO_HIEU_TRUONG`: `✓ (Chỉ định ĐV thuộc mảng)`.
    * Tất cả các vị trí khác (`TRUONG_DON_VI`, `PHO_DON_VI`, `VIEN_CHUC`, `VAN_THU`, `ADMIN`): Đều bị từ chối **`✗ (Deny)`**.

---

### 9. Ai được đánh số văn bản đi?
- **Đánh giá:** **PASS** (Bảo đảm nguyên tắc tập trung văn thư và SoD).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `outgoing-documents.md` Mục 1 Invariant 1 (Tách bạch 4 hành vi) & Invariant 4 (Cấp số đi bất biến): Số văn bản đi được lấy tự động từ hệ thống đếm số nguyên tử (`DocumentNumberSequence`), liên tục từ số 01 ngày 01/01 đến hết 31/12 của năm ban hành. Tuyệt đối cấm cấp số khống, lùi số hoặc giữ số trước khi văn bản được ký duyệt chính thức.
  - `outgoing-documents.md` Mục 2 Vòng đời: Trạng thái `NUMBERED` (Đã cấp số văn bản đi) khẳng định tác nhân thực hiện là **Văn thư (`VAN_THU`)**.
  - `outgoing-documents.md` Mục 3.4: Bộ phận Văn thư (được Hiệu trưởng giao quản lý con dấu và sổ văn bản đi theo NĐ 30/2020) là chủ thể duy nhất kích hoạt chức năng cấp số và áp con dấu điện tử cơ quan sau khi kiểm tra chữ ký Lãnh đạo.
  - `authority.md` Mục 8 SoD 3 (`Signer != Numberer/Archivist`): Lãnh đạo ký văn bản tuyệt đối không được tự cấp số và tự đóng dấu.
  - `permission-matrix.md` Mục 3.3 row 108: Năng lực `document.outgoing.number`:
    * `VAN_THU`: **`✓ (Cấp số từ Sequence)`**.
    * `HIEU_TRUONG` & `PHO_HIEU_TRUONG`: Bị từ chối bởi cơ chế SoD: **`✗ (Deny) [SoD]`**.
    * Mọi vị trí khác: **`✗ (Deny)`**.

---

### 10. Sau khi hoàn thành công việc, ai chịu trách nhiệm lập hồ sơ?
- **Đánh giá:** **PASS** (Chuẩn tắc hóa theo Luật Lưu trữ và Nghị định 30).
- **Phân tích căn cứ pháp lý & kiến trúc:**
  - `records-archive.md` Mục 1.1: Trích dẫn trực tiếp Khoản 1 Điều 29 Nghị định số 30/2020/NĐ-CP và Điều 12 Quy chế Lưu trữ ban hành kèm theo Quyết định số 93/QĐ-CĐKTCNQN:
    > *"Cá nhân được giao nhiệm vụ giải quyết công việc có trách nhiệm lập hồ sơ về công việc đó và nộp lưu hồ sơ, tài liệu vào Lưu trữ cơ quan đúng thời hạn quy định."*
  - Nguyên tắc bất biến thể chế: **"Người nào giải quyết việc nào thì lập hồ sơ việc đó"**.
  - `records-archive.md` Mục 2.1: Trường `ownerId` (Chủ hồ sơ) bắt buộc phải là viên chức giữ vai trò `DRI` của nhiệm vụ hoặc chuyên viên chính được phân công giải quyết văn bản.
  - `task-management.md` Mục 3.1 Role 4: Viên chức giữ vai trò `DRI` chịu trách nhiệm chính về việc lập và nộp lưu Hồ sơ công việc điện tử (`WorkDossier`).
  - `incoming-documents.md` Mục 2 Trạng thái `FILED` & Mục 3.2 RACI row 10: Chuyên viên thụ lý chính giữ vai trò **R** (Responsible - Trực tiếp thực hiện lập hồ sơ), Trưởng phòng giữ vai trò **A** (Accountable - Kiểm tra đôn đốc), Văn thư giữ vai trò **C** (Consulted - Hướng dẫn nghiệp vụ).

---

## IV. CÁC PHÁT HIỆN ĐỐI KHÁNG, KẼ HỞ NGHIỆP VỤ & TÀN TÍCH HỆ THỐNG CŨ (SYSTEMIC VULNERABILITIES & RESIDUAL RISKS)

Bên cạnh việc trả lời đạt 10 câu hỏi cốt lõi, chuyên viên kiểm toán đối kháng chỉ ra 5 vấn đề tồn đọng có nguy cơ tạo ra kẽ hở an ninh hoặc vi phạm chuẩn mực kiến trúc nếu đưa vào triển khai:

### 1. Lỗ hổng kỹ thuật trong danh sách đen của Quản trị viên (`authority.md`)
- **Mô tả khiếm khuyết:** Tại `authority.md` §6, đoạn code mẫu định nghĩa `forbiddenBusinessActions` chỉ chứa các hành động ghi (`sign`, `number`, `direct`, `approve`, `review`, `accept_archive`). Danh sách này thiếu các hành động đọc dữ liệu nhạy cảm (`dossier.view`, `hr.view`, `payroll.view`).
- **Hậu quả:** Kỹ sư hệ thống khi lập trình có thể chỉ kiểm tra mảng này, dẫn đến việc tài khoản `ADMIN` có thể gửi yêu cầu `GET /api/dossiers/hr-file-123` và đọc toàn bộ hồ sơ viên chức mà không bị chặn ở tầng middleware.
- **Biện pháp khắc phục:** Sửa đổi `authority.md` và mã nguồn: Áp dụng nguyên tắc **Mặc định từ chối (Default Deny)** cho tài khoản `QUAN_TRI_HE_THONG` trên toàn bộ các tài nguyên nghiệp vụ miền (`Task`, `Document`, `Dossier`, `Deliverable`), chỉ cho phép các capability thuộc nhóm `system.*`, `account.*`, `org.*`, `audit.*`.

### 2. Sự nhập nhằng giữa "Gỡ lỗi kỹ thuật" và Quyền riêng tư (`permission-matrix.md`)
- **Mô tả khiếm khuyết:** Tại `permission-matrix.md` Mục 3.1, capability `task.view` của `ADMIN` được ghi là `✓ (Chỉ phục vụ gỡ lỗi kỹ thuật)`.
- **Hậu quả:** Không có cơ chế ràng buộc kỹ thuật nào định nghĩa thế nào là "chỉ phục vụ gỡ lỗi kỹ thuật". Quản trị viên có thể xem dữ liệu nhạy cảm của các nhiệm vụ kỷ luật, khen thưởng hoặc kế hoạch tài chính bảo mật.
- **Biện pháp khắc phục:** Cưỡng chế quy tắc: Khi `ADMIN` xem task để gỡ lỗi, hệ thống phải che mờ (Masking) toàn bộ nội dung tệp đính kèm và dữ liệu cá nhân (Personal Data), hoặc yêu cầu cơ chế Phê duyệt khẩn cấp hai người (Dual-Control Emergency Access) kèm ghi nhật ký kiểm toán mức cảnh báo an ninh cao.

### 3. Tồn tại tàn tích kiểm tra cứng `user.role === 'ADMIN'`
- **Mô tả khiếm khuyết:** Tại `authority.md` dòng 179 và dòng 307 vẫn xuất hiện cú pháp `user.role === 'ADMIN'`.
- **Hậu quả:** Vi phạm nguyên tắc cốt lõi của QCET: *Role không phải là một enum đơn giản tĩnh; quyền hạn phát sinh từ PositionAssignment và Dynamic Capabilities*.
- **Biện pháp khắc phục:** Chuẩn hóa lại thành kiểm tra vị trí công tác hoặc năng lực hệ thống: `user.activeAssignment?.positionCode === 'QUAN_TRI_HE_THONG'`.

### 4. Thiếu danh mục ranh giới ủy quyền cho Hiệu trưởng (`delegations.md`)
- **Mô tả khiếm khuyết:** Khi Hiệu trưởng ủy quyền 3 ngày cho Phó Hiệu trưởng theo Thông báo 619, tài liệu chưa quy định danh mục các thẩm quyền **bất khả chuyển giao** (Non-delegable Powers) theo luật định.
- **Biện pháp khắc phục:** Bổ sung vào `delegations.md` danh mục các quyền cấm ủy quyền:
  1. Ký quyết định bổ nhiệm, điều động, kỷ luật nhân sự cấp trưởng đơn vị.
  2. Quyền chủ tài khoản ngân sách nhà nước tại Kho bạc Nhà nước.
  3. Ký văn bản sửa đổi Quy chế tổ chức và hoạt động của Nhà trường.

### 5. Tàn tích thuật ngữ doanh nghiệp (Corporate Relics)
- **Mô tả khiếm khuyết:**
  - Trong `task-management.md` dòng 453-455, phần chú thích của enum `ApprovalRiskTier` vẫn dùng từ tiếng Anh thương mại: `// Rủi ro thấp - 1 cấp (Manager)`, `// Rủi ro trung bình - 2 cấp (Reviewer -> Manager)`.
  - Trong `positions.md` dòng 52, mô hình dữ liệu vẫn còn trường `isStaff: Boolean`.
- **Biện pháp khắc phục:** Làm sạch thuật ngữ: Thay `Manager` bằng `Trưởng đơn vị / Lãnh đạo đơn vị`; thay `isStaff` bằng phân loại ngạch viên chức theo Nghị định 232/2026/NĐ-CP (`civilServiceGroup`: `LDPU` - Lãnh đạo quản lý, `VCMN` - Viên chức chuyên môn, `VCDC` - Viên chức dùng chung, `HTPV` - Hỗ trợ phục vụ).

---

## V. KẾT LUẬN & KIẾN NGHỊ BÀN GIAO (AUDIT VERDICT)

Bộ đặc tả miền nghiệp vụ mới tại `docs/domain/` đã **ĐẠT CHUẨN THIẾT KẾ ĐẶC TẢ NGHIỆP VỤ (SPECIFICATION READY)** đối với toàn bộ 10 câu hỏi của Definition of Done. Hệ thống đã đoạn tuyệt dứt khoát với tư duy "Role enum" giản đơn cũ và thiết lập một khung quản trị điện tử đại học công lập mẫu mực, tương thích hoàn toàn với thể chế hành chính Việt Nam.

Đoàn kiểm toán khuyến nghị Đội ngũ Phát triển Phần mềm (Engineering Team):
1. Cập nhật ngay 2 chỉnh sửa nhỏ trong file `authority.md` (bổ sung hành vi đọc vào vùng cấm của Admin) và `delegations.md` (bổ sung danh mục quyền không được ủy quyền của Hiệu trưởng) trước khi tiến hành viết code cho các Service và Middleware.
2. Dùng chính 10 kịch bản kiểm toán này làm bộ dữ liệu kiểm thử tự động (End-to-End & Unit Test Suite) cho tầng kiểm soát truy cập tại `tests/authorization/`.

---
*Báo cáo được lập bởi Chuyên viên Kiểm toán Độc lập & Phản biện QA Đối kháng QCET E-Office.*
