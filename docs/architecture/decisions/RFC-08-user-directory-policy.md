# RFC-08: Chính Sách Khả Kiến Danh Bạ Người Dùng & Bảo Vệ Dữ Liệu Cá Nhân (User Directory Visibility & Personal Data Protection Policy)

- **Status**: ACCEPTED
- **Date**: 2026-09-22
- **Author**: Security & Architecture Working Group
- **Deciders**: Owner (Approved at Architecture Review Gate — 2026-09-22)
- **Target Work Item**: WI-1.4a (#37), triển khai tại WI-1.4b
- **Owner Gate Decision**:
  - Áp dụng mô hình khả kiến đa tầng theo năng lực và ngữ cảnh (Capability/Context-based Tiered Policy).
  - **Tier 1 (Dữ liệu thể chế)**: Mở toàn trường cho mọi người dùng đã xác thực danh tính.
  - **Tier 2 (Dữ liệu liên lạc công vụ)**: Mở toàn trường khi trường dữ liệu được xác nhận là số máy bàn/phòng làm việc công vụ.
  - **Tier 3 (Dữ liệu cá nhân nhạy cảm)**: Mặc định ẩn trên danh bạ; chỉ truy cập thông qua explicit contextual capability và phạm vi thẩm quyền được duyệt.
  - **Tier 4 (Dữ liệu nhân sự luật định)**: Tuyệt đối không phơi bày qua Directory API.
  - **Trường `User.phone` hiện tại**: Xác định là dữ liệu hỗn hợp kế thừa (legacy mixed-classification data) và **BẮT BUỘC PHẢI ĐƯỢC BẢO VỆ MẶC ĐỊNH (Tier 3)** cho đến khi có migration chuẩn hóa tách thành `workPhone` và `personalPhone`.
- **Related Documents**:
  - `ADR-002: Contextual Authorization Policy Engine (10-Step Pipeline)`
  - `ADR-006: Department → OrganizationalUnit Consolidation`
  - `ADR-007: REST API Standard với Chuẩn Báo Lỗi RFC 9457 Problem Details`
  - `docs/security/data-classification.md: Data Classification & Protection Policy`

---

## 1. Context (Bối cảnh & Hiện trạng)

Hệ thống điều hành tác nghiệp trực tuyến QCET E-Office phục vụ toàn bộ cán bộ quản lý, giảng viên, chuyên viên và nhân viên của **Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn** (QCET). Với đặc thù một cơ sở giáo dục nghề nghiệp công lập, hệ thống phải vừa đảm bảo tính thông suốt, liên tục trong luân chuyển văn bản, giao việc, phân công nhiệm vụ và phối hợp liên phòng ban, vừa phải tuân thủ nghiêm ngặt khung pháp lý về bảo vệ dữ liệu cá nhân tại Việt Nam, đặc biệt là **Nghị định 13/2023/NĐ-CP**.

### 1.1 Khảo sát Hiện trạng Triển khai tại CURRENT HEAD

Rà soát mã nguồn thực tế tại thời điểm hiện tại cho thấy các vấn đề bảo mật và quyền riêng tư đáng quan ngại trong cơ chế hiển thị danh bạ người dùng:

1. **Endpoint `GET /api/users` thiếu kiểm soát truy cập ngữ cảnh (`src/app/api/users/route.ts`)**:
   - Handler chỉ yêu cầu xác thực cơ bản qua `requireAuthenticated(context)`.
   - Bất kỳ tài khoản người dùng đăng nhập nào (kể cả nhân viên thử việc, giảng viên thỉnh giảng hoặc tài khoản bị xâm nhập) đều có thể gửi request `GET /api/users` và lấy về danh sách toàn bộ nhân sự của nhà trường.
   - Không có kiểm tra phân quyền ranh giới tổ chức (Unit Scope), không kiểm tra vai trò nghiệp vụ (Role-based), và không có cơ chế lọc trường dữ liệu theo thẩm quyền.

2. **Dữ liệu DTO công khai bị lộ lọt trường cá nhân nhạy cảm (`src/server/dto/user-dto.ts`)**:
   - Hàm `toUserPublicDTOArray(users)` ánh xạ thực thể cơ sở dữ liệu sang `UserPublicDTO`:
     ```typescript
     export interface UserPublicDTO {
       id: string;
       name: string;
       email: string;
       role: string;
       position?: string | null;
       phone?: string | null;        // <-- RÒ RỈ DỮ LIỆU CÁ NHÂN (TIER 3 PII)
       avatarUrl?: string | null;
       departmentId?: string | null;
       department?: UserDepartmentDTO | null;
       createdAt: string;
       updatedAt: string;
     }
     ```
   - Trường `phone` (lưu trong bảng `User`) được trả về thẳng cho client trong mọi truy vấn danh bạ.

3. **Thực trạng Dữ liệu Hỗn hợp (Legacy Mixed-Classification Data) trong `User.phone`**:
   - Rà soát `prisma/schema.prisma` và dữ liệu khởi tạo `prisma/seed.ts` cho thấy: Hiện tại cơ sở dữ liệu chỉ có **duy nhất một trường `phone String? @db.VarChar(20)`** trên model `User`.
   - Trường này đang chứa dữ liệu hỗn hợp (mixed-classification data):
     - **Số máy bàn / điện thoại công vụ cơ quan (Bình Định - mã vùng 0256)**: Ví dụ `0256.3846.478` (BGH), `0256.3846.477` (Phòng QLĐT), `0256.3846.480` (Phòng TC-ĐBCL), `0256.3846.481` (Văn thư trường).
     - **Số điện thoại di động cá nhân của viên chức**: Ví dụ `0913.789.012` (Trưởng phòng QLĐT), `0914.123.456` (Trưởng phòng TC-ĐBCL), `0905.111.222` (Phó Giám đốc TT Số), `0988.555.777` (Giảng viên CNTT).
   - Vì nằm chung trong một trường duy nhất không có cờ phân loại, hệ thống hiện tại không thể phân biệt được đâu là số máy bàn công vụ (Tier 2) và đâu là số điện thoại di động cá nhân (Tier 3).

4. **Thói quen sử dụng danh bạ phía Client (`src/hooks/use-personnel-list.ts`)**:
   - Hook `usePersonnelList()` được dùng phổ biến trên 6+ component cốt lõi (`task-identity-block`, `task-properties-sidebar`, `task-block-editor`, `task-subtasks-section`, `subtask-detail-drawer`, `create-task-modal`).
   - Hook thực hiện gọi `fetch("/api/users")` không kèm bộ lọc, tải toàn bộ danh sách nhân sự về lưu trong biến module-level `_cache` phía trình duyệt.
   - Mặc dù giao diện giao việc và chọn người phối hợp chỉ cần các trường công vụ: `id`, `name`, `email` công vụ, `departmentName`, `title` (chức vụ/học vị), việc endpoint trả về cả `phone` đã tạo ra lỗ hổng **OWASP API3: Excessive Data Exposure**.

### 1.2 Rủi ro An ninh & Pháp lý

- **Vi phạm Nghị định 13/2023/NĐ-CP**: Việc phơi bày số điện thoại di động cá nhân cho toàn bộ người dùng trong hệ thống mà không có sự đồng ý hoặc không phục vụ mục đích pháp định vi phạm nguyên tắc "Hạn chế dữ liệu tối thiểu" (Điều 3 Khoản 4) và nguyên tắc "Bảo vệ dữ liệu cá nhân cơ bản" (Điều 2 Khoản 3).
- **Nguy cơ Thu thập Dữ liệu Hàng loạt (Bulk Scraping / Harvesting)**: Kẻ tấn công chiếm được một tài khoản thường có thể tải toàn bộ danh bạ nhân sự, lập danh sách số điện thoại của Ban Giám hiệu, Trưởng các phòng ban, phục vụ các chiến dịch tấn công giả mạo (Spear Phishing, Vishing, Business Email Compromise - BEC).
- **Xâm phạm đời tư cá nhân**: Cán bộ giảng viên bị làm phiền qua số điện thoại cá nhân ngoài giờ làm việc cho các vấn đề không khẩn cấp, thay vì liên lạc qua các kênh công vụ chính thống (Email công vụ `@cdktcnqn.edu.vn`, số máy lẻ nội bộ).

---

## 2. Data Protection Analysis (Phân tích Pháp lý & Nghị định 13/2023/NĐ-CP)

### 2.1 Căn cứ Pháp lý Áp dụng

1. **Nghị định 13/2023/NĐ-CP** ngày 17/04/2023 của Chính phủ về Bảo vệ dữ liệu cá nhân.
2. **Quyết định 283/QĐ-CĐKTCNQN** về Quy chế tổ chức và hoạt động của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.
3. **Quyết định 420/QĐ-CĐKTCNQN** về Quy định phân công nhiệm vụ trong Ban Giám hiệu và các đơn vị trực thuộc.
4. **Nghị định 30/2020/NĐ-CP** về Công tác văn thư và lưu trữ tài liệu điện tử.
5. **Luật An toàn thông tin mạng 2015** và **Luật Giao dịch điện tử 2023**.

### 2.2 Phân định Dữ liệu Công vụ vs. Dữ liệu Cá nhân được Bảo vệ

Căn cứ Điều 2 và Điều 3 Nghị định 13/2023/NĐ-CP, hệ thống E-Office phải phân định rõ ràng giữa hai nhóm dữ liệu:

| Tiêu chí | Dữ liệu Công vụ Thể chế (Institutional Public) | Dữ liệu Cá nhân được Bảo vệ (Protected Personal Data) |
| :--- | :--- | :--- |
| **Bản chất pháp lý** | Thông tin gắn liền với tư cách công vụ, vị trí việc làm và thẩm quyền hành chính của cán bộ trong tổ chức. | Thông tin gắn liền với quyền nhân thân, đời tư bí mật và định danh cá nhân của công dân. |
| **Các trường tiêu biểu** | Họ và tên, chức vụ, học vị/học hàm, đơn vị công tác, email công vụ (`@cdktcnqn.edu.vn`), số máy nhánh cơ quan, phòng làm việc. | Số điện thoại di động riêng, email cá nhân ngoài trường, số CCCD/CMND, mã số thuế cá nhân, địa chỉ nhà riêng, thông tin gia cảnh, bảng lương. |
| **Mục đích xử lý** | Vận hành quy trình hành chính, ký duyệt văn bản, giao nhận nhiệm vụ, phối hợp điều hành công việc nội bộ. | Quản lý quan hệ lao động, chế độ bảo hiểm, chi trả lương thưởng, hồ sơ cán bộ theo quy định của pháp luật lao động/viên chức. |
| **Căn cứ xử lý (NĐ 13)** | Căn cứ Điều 17: Phục vụ hoạt động của cơ quan, tổ chức theo luật định; thực hiện hợp đồng làm việc/lao động. | Yêu cầu sự chấp thuận của chủ thể dữ liệu (Điều 11), hoặc quyền hạn theo luật chuyên ngành của cơ quan quản lý nhân sự (Điều 17). |
| **Phạm vi khả kiến** | Toàn thể nhân sự trong nhà trường có thể tra cứu để phục vụ công việc. | Bị hạn chế nghiêm ngặt: Chỉ chính chủ, Lãnh đạo cấp cao, hoặc bộ phận Tổ chức - Cán bộ được tiếp cận. |

### 2.3 Các Nguyên tắc Cốt lõi của Nghị định 13 Phải Triệt Để Tuân Thủ

- **Nguyên tắc Giới hạn Mục đích (Purpose Limitation - Điều 3 Khoản 3)**: Người dùng tìm kiếm danh bạ để giao nhiệm vụ hoặc gửi văn bản chỉ được cung cấp thông tin phục vụ giao nhiệm vụ (Tên, Đơn vị, Chức vụ, Email công vụ), không được cung cấp số điện thoại di động riêng nếu không có lý do nghiệp vụ khẩn cấp.
- **Nguyên tắc Hạn chế Dữ liệu Tối thiểu (Data Minimization - Điều 3 Khoản 4)**: Mọi payload API danh bạ mặc định chỉ truyền tải tập thuộc tính tối thiểu cần thiết để render giao diện, loại bỏ hoàn toàn các thuộc tính nhạy cảm.
- **Biện pháp Bảo vệ Kỹ thuật & Tổ chức (Technical Safeguards - Điều 26)**: Áp dụng cơ chế kiểm soát truy cập RBAC/ReBAC, rate-limiting chống quét dữ liệu, phân quyền cấp trường (Field-level Authorization), và audit log ghi vết truy cập dữ liệu cá nhân.

---

## 3. Proposed Options (So sánh 3 Mô hình Tiếp cận)

Để giải quyết bài toán khả kiến danh bạ, 3 mô hình kiến trúc được đưa ra so sánh và đánh giá:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ SO SÁNH 3 MÔ HÌNH KHẢ KIẾN DANH BẠ (USER DIRECTORY VISIBILITY MODELS)           │
├────────────────────────────────┬───────────────────────────────┬────────────────┤
│ Mô hình 1: Toàn trường mở      │ Mô hình 2: Phân vùng đơn vị   │ Mô hình 3:     │
│ (School-wide Open)             │ (Unit-scoped Strict)          │ Năng lực &     │
│                                │                               │ Ngữ cảnh       │
│ • Mọi nhân sự thấy mọi thông   │ • Chỉ thấy nhân sự trong đơn  │ (Tiered        │
│   tin danh bạ của mọi người.   │   vị mình.                    │ Disclosure)    │
│ • Rủi ro: Vi phạm NĐ 13, rò    │ • Ngoài đơn vị: Chỉ thấy khi  │ • Đề xuất      │
│   rỉ số điện thoại cá nhân.    │   cùng chung nhiệm vụ.        │ • Cân bằng bảo │
│ • Scraping PII hàng loạt.      │ • Rủi ro: Tê liệt giao việc,  │   mật & nghiệp │
│                                │   đứt gãy UX liên phòng ban.  │   vụ.          │
└────────────────────────────────┴───────────────────────────────┴────────────────┘
```

### 3.1 Mô hình 1: Toàn trường mở (School-wide Open Directory)

- **Mô tả**: Giữ nguyên trạng thái hiện tại. Toàn bộ cán bộ, giảng viên, nhân viên sau khi đăng nhập đều có quyền xem và tìm kiếm toàn bộ danh bạ nhân sự của trường kèm tất cả trường thông tin (kể cả số điện thoại cá nhân).
- **Ưu điểm**:
  - Đơn giản nhất về mặt kỹ thuật, không yêu cầu thay đổi logic backend hay frontend.
  - Người dùng có thể tìm kiếm bất kỳ ai để liên hệ khi cần.
- **Nhược điểm & Rủi ro**:
  - **Vi phạm nghiêm trọng Nghị định 13/2023/NĐ-CP**: Phơi bày dữ liệu cá nhân không qua chọn lọc.
  - **Nguy cơ thu thập dữ liệu (Harvesting/Scraping)**: Bất kỳ máy tính chuyên viên nào bị cài mã độc đều có thể dump trọn vẹn danh bạ cán bộ trường.
  - **Làm phiền lãnh đạo & đời tư**: Giảng viên, nhân viên có thể gọi điện trực tiếp vào máy cá nhân của Ban Giám hiệu ngoài giờ hành chính mà không theo quy trình hành chính.
- **Kết luận**: **BÁC BỎ (REJECTED)** vì không đáp ứng yêu cầu pháp lý và chuẩn an toàn thông tin doanh nghiệp.

### 3.2 Mô hình 2: Phân vùng đơn vị nghiêm ngặt (Unit-Scoped Strict Directory)

- **Mô tả**: Áp dụng triệt để mô hình Zero Trust theo ranh giới tổ chức (`OrganizationalUnit`). Chuyên viên Phòng Đào tạo chỉ nhìn thấy nhân sự Phòng Đào tạo. Chỉ khi người dùng được giao một nhiệm vụ phối hợp liên phòng ban (`TaskActor`), họ mới nhìn thấy thông tin của các thành viên khác trong cùng nhiệm vụ đó.
- **Ưu điểm**:
  - Bảo vệ tối đa dữ liệu cá nhân khỏi sự tò mò nội bộ.
  - Phân lập dữ liệu hoàn toàn theo phòng ban/khoa.
- **Nhược điểm & Rủi ro**:
  - **Làm tê liệt nghiệp vụ cốt lõi của E-Office**:
    - Khi Trưởng phòng muốn tạo một nhiệm vụ mới và phối hợp với chuyên viên phòng khác: Dropdown tìm kiếm người thực hiện sẽ **trống rỗng** vì chưa có liên kết `TaskActor` từ trước!
    - Văn thư trường khi tiếp nhận văn bản đến không thể tìm kiếm chuyên viên phụ trách của các khoa để chuyển giao văn bản.
    - Cán bộ không thể tìm kiếm tài khoản của Lãnh đạo trường để trình ký văn bản đi.
  - **Đứt gãy trải nghiệm người dùng (UX Frustration)**: Người dùng buộc phải sử dụng các kênh trao đổi ngoài (Zalo, gọi điện ngoài) để hỏi username/email của đồng nghiệp, phá vỡ mục tiêu số hóa quản trị của hệ thống E-Office.
- **Kết luận**: **BÁC BỎ (REJECTED)** vì tính khả dụng thực tế quá thấp, cản trở trực tiếp hoạt động vận hành của nhà trường.

### 3.3 Mô hình 3: Tiếp cận theo Năng lực & Ngữ cảnh Phân tầng (Capability/Context-based Tiered Disclosure - KHUYẾN NGHỊ)

- **Mô tả**: Kết hợp giữa **Phân loại trường dữ liệu (Field-Level Classification)** và **Thẩm quyền/Ngữ cảnh truy vấn (Capability & Contextual Scope)**:
  - **Dữ liệu công vụ thể chế (Tier 1)**: Mở toàn trường cho mọi tài khoản đã xác thực để phục vụ giao việc, luân chuyển văn bản, mời họp và hiển thị sơ đồ tổ chức.
  - **Dữ liệu liên lạc tác nghiệp nội bộ (Tier 2)**: Hiển thị cho toàn trường các thông tin phục vụ công việc tại trụ sở (máy lẻ, phòng làm việc).
  - **Dữ liệu cá nhân được bảo vệ (Tier 3)**: Số điện thoại di động cá nhân, email riêng **bị ẩn hoàn toàn trên các danh bạ chung và picker giao việc**. Quyền truy cập được xác định theo năng lực ngữ cảnh (Contextual Capability) và phạm vi thẩm quyền (Scope), chỉ được hiển thị trong các ngữ cảnh được kiểm soát:
    1. Chính chủ xem hồ sơ của mình (`isSelf = true`).
    2. Người dùng sở hữu capability `user.personal.read_sensitive` với phạm vi thể chế (`INSTITUTIONAL_SCOPE` — ví dụ minh họa: Ban Giám hiệu, cán bộ phụ trách công tác Tổ chức - Cán bộ).
    3. Người dùng sở hữu capability `user.personal.read_sensitive` với phạm vi quản lý đơn vị trực tiếp (`UNIT_SCOPE` — ví dụ minh họa: Trưởng đơn vị quản lý nhân sự thuộc đơn vị mình).
- **Ưu điểm**:
  - **Cân bằng hoàn hảo giữa Bảo mật & Tính khả dụng (Security vs. Usability)**: Các picker giao việc, chọn người phối hợp, chuyển xử lý văn bản vẫn hoạt động mượt mà 100% với dữ liệu công vụ; đồng thời triệt tiêu hoàn toàn nguy cơ rò rỉ số điện thoại cá nhân.
  - **Tuân thủ đầy đủ Nghị định 13/2023/NĐ-CP**: Đảm bảo nguyên tắc hạn chế dữ liệu tối thiểu và bảo vệ đời tư cá nhân.
  - **Tương thích hoàn hảo với Pipeline 10 bước của Authorization Engine (ADR-002)**: Tích hợp trực tiếp tại Step 2 (Classification) và Step 7 (Organizational Scope).
- **Kết luận**: **RECOMMENDED — pending Owner approval**.

---

## 4. Field-Level Classification (Phân loại Trường Dữ liệu Chi tiết)

Toàn bộ thuộc tính của người dùng trong hệ thống QCET E-Office được phân định thành 4 cấp độ dữ liệu (Data Tiers) như sau:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ PHÂN TẦNG TRƯỜNG DỮ LIỆU DANH BẠ NGƯỜI DÙNG (FIELD-LEVEL TIERS)                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Tier 1: PUBLIC INSTITUTIONAL (Công vụ Công khai Nội bộ)                         │
│ • id, name, institutional email (@cdktcnqn.edu.vn), title, role,                │
│   department / unitId, avatarUrl, isActive                                      │
│ → Dùng cho: Assignee picker, autocomplete, mention (@), sơ đồ tổ chức           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Tier 2: OPERATIONAL CONTACT (Liên lạc Tác nghiệp Nội bộ)                        │
│ • workPhone (máy nhánh cơ quan), officeRoom (văn phòng làm việc)                │
│ → Dùng cho: Liên hệ công tác nội bộ trong giờ làm việc                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Tier 3: PROTECTED PERSONAL DATA (Dữ liệu Cá nhân được Bảo vệ - NĐ 13/2023)      │
│ • personalPhone (di động riêng), personalEmail (ngoài trường), ngày sinh, giới   │
│   tính                                                                          │
│ → Điều kiện: Chính chủ, Phòng TCCB, Ban Giám hiệu, hoặc Trưởng đơn vị quản lý   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Tier 4: HIGHLY SENSITIVE STATUTORY & HR (Dữ liệu Nhân sự Đặc thù & Bảo mật Cao) │
│ • CCCD/CMND, Mã số thuế, Địa chỉ thường trú, Lương, Hồ sơ kỷ luật               │
│ → Điều kiện: Module HR chuyên biệt; TUYỆT ĐỐI KHÔNG xuất hiện trên Directory API │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Chi tiết Thuộc tính theo Từng Tier

#### Tier 1: Public Institutional Directory Fields (Công vụ Công khai Nội bộ)
- **Mục đích**: Nhận diện cán bộ và định tuyến tác nghiệp trong toàn trường.
- **Danh sách trường**:
  - `id`: Định danh duy nhất của tài khoản (`cuid`).
  - `name`: Họ và tên đầy đủ của cán bộ.
  - `email`: Email công vụ do nhà trường cấp phát (ví dụ: `nguyenvana@cdktcnqn.edu.vn`).
  - `departmentId` / `unitId`: Mã đơn vị/khoa/phòng công tác.
  - `department` / `unit`: Tên và mã viết tắt của đơn vị công tác.
  - `title`: Học hàm, học vị, hoặc chức danh công tác (ví dụ: "TS. Trưởng khoa", "ThS. Giảng viên chính").
  - `role`: Vai trò chức danh hệ thống (`UserRole`).
  - `avatarUrl`: Ảnh đại diện tác nghiệp.
  - `isActive`: Trạng thái tài khoản đang hoạt động.
- **Quy tắc truy cập**: Mọi người dùng đã xác thực đều được đọc. Không cần che giấu trong nội bộ trường.

#### Tier 2: Operational Contact Fields (Liên lạc Tác nghiệp Nội bộ)
- **Mục đích**: Hỗ trợ trao đổi nghiệp vụ nhanh tại cơ quan.
- **Danh sách trường**:
  - `workPhone`: Số máy bàn nội bộ / số máy nhánh (Extension number).
  - `officeRoom`: Vị trí phòng làm việc tại các cơ sở (ví dụ: "Phòng 204 - Nhà A1").
  - `workScheduleSummary`: Tóm tắt lịch công tác công khai trong tuần.
- **Quy tắc truy cập**: Hiển thị cho toàn thể cán bộ trong trường khi tra cứu trang chi tiết danh bạ; không hiển thị ở các picker rút gọn để tiết kiệm băng thông.

#### Tier 3: Protected Personal Data Fields (Dữ liệu Cá nhân được Bảo vệ theo NĐ 13/2023/NĐ-CP)
- **Mục đích**: Thông tin liên lạc cá nhân phục vụ tình huống khẩn cấp hoặc quản trị nhân sự.
- **Tuyên bố Nguyên tắc Bắt buộc về Dữ liệu Hỗn hợp (Formal Default-Protected Declaration)**:
  > **NGUYÊN TẮC BẢO VỆ MẶC ĐỊNH CHO `User.phone`**: Do `User.phone` tại CURRENT HEAD là dữ liệu hỗn hợp (chứa cả số máy bàn cơ quan và số di động cá nhân), kiến trúc hệ thống **CHÍNH THỨC TUYÊN BỐ: TOÀN BỘ TRƯỜNG `User.phone` HIỆN TẠI BẮT BUỘC PHẢI ĐƯỢC BẢO VỆ MẶC ĐỊNH NHƯ DỮ LIỆU CÁ NHÂN TIER 3 (DEFAULT-PROTECTED AS TIER 3 PROTECTED PERSONAL DATA)**. Không được coi bất kỳ giá trị nào trong trường này là công khai cho đến khi một quyết định chuẩn hóa dữ liệu và migration schema phân tách rành mạch thành `workPhone` (Tier 2) và `personalPhone` (Tier 3) được thực thi hoàn tất.
- **Danh sách trường**:
  - `personalPhone` / `phone`: Số điện thoại của cán bộ (được bảo vệ mặc định là Tier 3).
  - `personalEmail`: Email cá nhân ngoài tổ chức (ví dụ: `@gmail.com`).
  - `dateOfBirth`: Ngày tháng năm sinh.
  - `gender`: Giới tính.
- **Quy tắc truy cập**: Mặc định **CHE GIẤU (REDACTED / NULL)** trên mọi endpoint danh bạ chung. Quyền truy cập được xác định theo năng lực ngữ cảnh (Contextual Capability) và phạm vi thẩm quyền (Scope), tuyệt đối không kiểm tra static role string (như `BAN_GIAM_HIEU` hay `TRUONG_PHONG`):
  1. Chính chủ truy cập hồ sơ của mình (`isSelf: requestUser.id === targetUser.id`).
  2. Người gửi request sở hữu capability `user.personal.read_sensitive` với phạm vi toàn thể chế (`INSTITUTIONAL_SCOPE` — ví dụ minh họa: Ban Giám hiệu, cán bộ phụ trách công tác Tổ chức - Cán bộ qua `PositionAssignment`).
  3. Người gửi request sở hữu capability `user.personal.read_sensitive` với phạm vi quản lý đơn vị trực tiếp (`UNIT_SCOPE`: cán bộ quản lý đơn vị đối với nhân sự thuộc `PositionAssignment.unitId` do mình phụ trách — ví dụ minh họa: Trưởng phòng, Trưởng khoa).

#### Tier 4: Highly Sensitive Statutory & HR Fields (Dữ liệu Nhân sự Đặc thù & Bảo mật Cao)
- **Mục đích**: Thực hiện chế độ chính sách, bảo hiểm, thuế và kỷ luật lao động.
- **Danh sách trường**:
  - `citizenId` / `taxId`: Số định danh cá nhân (CCCD) / Mã số thuế.
  - `homeAddress`: Địa chỉ nơi ở hiện tại / thường trú.
  - `payrollData`: Thông tin tài khoản ngân hàng, ngạch bậc lương, phụ cấp.
  - `evaluationRecords`: Đánh giá xếp loại viên chức hàng năm, hồ sơ khen thưởng / kỷ luật.
- **Quy tắc truy cập**: **TUYỆT ĐỐI KHÔNG BAO GIỜ** được đưa vào các endpoint thuộc `/api/users/*`. Toàn bộ dữ liệu này được bảo vệ trong các phân hệ nghiệp vụ độc lập (HR / Payroll), yêu cầu quyền hạn chuyên trách và tuân thủ nguyên tắc Phân lập trách nhiệm (Separation of Powers) theo ADR-002.

---

## 5. Permission & Visibility Matrix (Ma trận Phân quyền & Khả kiến)

### 5.1 Ma trận Khả kiến theo Năng lực Ngữ cảnh & Phạm vi Thẩm quyền (Contextual Capability & Scope)

Bảng dưới đây xác định quyền hạn tiếp cận từng nhóm trường dữ liệu dựa trên Năng lực ngữ cảnh (`Capability`) và Phạm vi (`Scope`) của người truy vấn, cùng mối quan hệ với đối tượng được tra cứu:

| Năng lực Ngữ cảnh & Phạm vi (`Contextual Capability & Scope`) | Ví dụ Chức danh Minh họa (`Illustrative Example`) | Ngữ cảnh Đối tượng (`Target Context`) | Tier 1: Public Institutional | Tier 2: Operational Contact | Tier 3: Protected Personal (Phone) | Tier 4: Sensitive HR |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Chính chủ (`isSelf: targetUserId === actor.id`)** | Mọi viên chức / nhân sự | Hồ sơ của chính mình | **READ** | **READ** | **READ / EDIT** | **READ** (chỉ xem) |
| **Năng lực danh bạ cơ bản (`user.directory.browse`)** | Giảng viên, Chuyên viên | Cùng đơn vị (`same_unit`) | **READ** | **READ** | **DENY** | **DENY** |
| **Năng lực danh bạ cơ bản (`user.directory.browse`)** | Giảng viên, Chuyên viên | Khác đơn vị (`cross_unit`) | **READ** | **READ** | **DENY** | **DENY** |
| **Nhiệm vụ phối hợp (`task.collaborator`)** | Thành viên nhóm công việc | Cùng nhiệm vụ (`collaborative_task`) | **READ** | **READ** | **DENY** (liên hệ qua E-Office) | **DENY** |
| **Quản lý đơn vị (`user.personal.read_sensitive` + `UNIT_SCOPE`)** | Trưởng phòng, Trưởng khoa | Cán bộ trong đơn vị mình (`unit_member`) | **READ** | **READ** | **READ** (quản lý điều hành) | **DENY** |
| **Quản lý đơn vị (`user.personal.read_sensitive` + `UNIT_SCOPE`)** | Trưởng phòng, Trưởng khoa | Cán bộ ngoài đơn vị (`cross_unit`) | **READ** | **READ** | **DENY** | **DENY** |
| **Lãnh đạo thể chế (`user.personal.read_sensitive` + `INSTITUTIONAL_SCOPE`)** | Ban Giám hiệu | Toàn trường (`institutional_wide`) | **READ** | **READ** | **READ** (chỉ đạo khẩn cấp) | **READ** (theo thẩm quyền) |
| **Quản trị nhân sự (`user.profile.manage_institutional` + `INSTITUTIONAL_SCOPE`)** | Cán bộ Phòng Tổ chức - Cán bộ | Toàn trường (`institutional_wide`) | **READ** | **READ** | **READ** (quản lý hồ sơ) | **READ / EDIT** |
| **Quản trị kỹ thuật (`account.manage` / `SYSTEM_ADMIN`)** | Quản trị viên hệ thống | Toàn trường (`institutional_wide`) | **READ** | **DENY** (không nghiệp vụ) | **DENY** (chống lạm quyền) | **DENY** (SoD tuyệt đối) |

> **Nguyên tắc Bất biến về Thẩm quyền (ADR-002 Invariants)**:  
> 1. **Role Is Not Scope / Role String Checks Prohibited**: Thẩm quyền truy cập dữ liệu cá nhân là hàm của **Contextual Capability + Scope**, tuyệt đối không kiểm tra chuỗi vai trò tĩnh (static role string). Các chức danh như *Ban Giám hiệu, Trưởng phòng, Chuyên viên TCCB* trong bảng trên chỉ đóng vai trò là **ví dụ minh họa** về các vị trí được cấp Capability và Scope qua `PositionAssignment`.  
> 2. **Phân lập Quyền lực Quản trị Kỹ thuật (Separation of Powers - ADR-002 Step 3)**: Quản trị viên kỹ thuật (`SYSTEM_ADMIN`) chỉ có quyền quản trị tài khoản (`account.manage`), cấu hình hạ tầng; **tuyệt đối không được cấp quyền xem dữ liệu cá nhân (Tier 3)** của cán bộ viên chức nếu không có yêu cầu điều tra sự cố bằng văn bản được phê duyệt.

### 5.2 Chuẩn hóa Khung Năng lực (Canonical Capability Actions)

Để hỗ trợ kiểm soát phân quyền minh bạch, bổ sung và chuẩn hóa các Capability Actions trong `src/server/authorization/capability.ts`:

```typescript
// ============================================================================
// USER DIRECTORY & PROFILE CAPABILITIES
// ============================================================================

export const USER_DIRECTORY_CAPABILITIES = [
  /** Duyệt danh sách danh bạ công vụ cơ bản (Tier 1) phục vụ giao việc, chọn người */
  'user.directory.browse',
  /** Tìm kiếm danh bạ theo tên, email, chức vụ (Tier 1) kèm rate-limit */
  'user.directory.search',
  /** Xem thông tin liên lạc tác nghiệp nội bộ (Tier 2: máy bàn, phòng làm việc) */
  'user.contact.read_internal',
  /** Xem số điện thoại di động cá nhân và dữ liệu liên lạc riêng (Tier 3) */
  'user.personal.read_sensitive',
  /** Quản lý, cập nhật thông tin cá nhân của chính mình */
  'user.profile.update_self',
  /** Quản lý, điều chỉnh hồ sơ cán bộ thuộc thẩm quyền Tổ chức - Cán bộ */
  'user.profile.manage_institutional',
] as const;

export type UserDirectoryCapabilityAction = (typeof USER_DIRECTORY_CAPABILITIES)[number];
```

### 5.3 Tích hợp vào Pipeline 10 bước của Authorization Policy Engine (ADR-002)

Chính sách khả kiến danh bạ được tích hợp trực tiếp vào `authorization-engine.ts`:

- **Step 1 (Account / Session Validation)**: Chặn mọi truy cập ẩn danh vào danh bạ người dùng.
- **Step 2 (Resource Classification - DATA_CLASSIFICATION)**:
  - Nếu request yêu cầu trường Tier 3 (`phone`, `personalEmail`): Kiểm tra xem người yêu cầu có phải là chính chủ (`targetUserId === context.userId`) hoặc có capability `user.view_sensitive_personal_data` / `user.personal.read_sensitive`. Nếu không thỏa mãn $\to$ Trả về kết quả đã được lọc (Redacted / Filtered) hoặc DENY với mã lỗi `PERSONAL_DATA_PRIVACY_BREACH`.
- **Step 3 (Separation of Powers)**:
  - Chặn `SYSTEM_ADMIN` truy cập các trường dữ liệu cá nhân nếu không có lý do điều tra được kích hoạt trong phiên làm việc.
- **Step 7 (Organizational Scope - Unit Boundary)**:
  - Cán bộ sở hữu capability `user.personal.read_sensitive` với phạm vi đơn vị (`UNIT_SCOPE` — ví dụ: Trưởng phòng, Trưởng khoa qua `PositionAssignment`) chỉ được cấp quyền xem Tier 3 đối với các cán bộ có `PositionAssignment.unitId` thuộc ranh giới đơn vị do mình phụ trách.

---

## 6. Technical Design & Architecture Specifications (Thiết kế Kỹ thuật Chi tiết)

### 6.1 Tái cấu trúc Mappers & DTO (`src/server/dto/user-dto.ts`)

Thay vì chỉ có một DTO công khai duy nhất phơi bày trường `phone`, hệ thống phân tách thành 3 DTO tương ứng với các cấp độ bảo vệ:

```typescript
/**
 * 1. DTO Danh bạ Công vụ (Tier 1) - An toàn tuyệt đối, dùng cho Pickers, Autocomplete
 * OWASP API3 Compliant: Zero leakage of personal mobile phone or private data.
 */
export interface UserDirectorySummaryDTO {
  id: string;
  name: string;
  email: string; // Email công vụ @cdktcnqn.edu.vn
  role: string;
  position?: string | null;
  avatarUrl?: string | null;
  departmentId?: string | null;
  department?: UserDepartmentDTO | null;
  isActive: boolean;
}

/**
 * 2. DTO Tác nghiệp Cơ quan (Tier 1 + Tier 2) - Chi tiết danh bạ nội bộ
 */
export interface UserOperationalProfileDTO extends UserDirectorySummaryDTO {
  workPhone?: string | null; // Số máy lẻ bàn làm việc
  officeRoom?: string | null; // Vị trí phòng làm việc
}

/**
 * 3. DTO Cá nhân Bảo vệ (Tier 1 + Tier 2 + Tier 3) - Chỉ cấp khi có thẩm quyền
 */
export interface UserPersonalProfileDTO extends UserOperationalProfileDTO {
  phone?: string | null; // Số điện thoại di động cá nhân
  personalEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Hàm mapper thông minh thực hiện lọc dữ liệu tự động dựa trên ngữ cảnh ủy quyền:

```typescript
export function toSanitizedUserDTO(
  rawUser: Record<string, any>,
  canViewSensitive: boolean
): UserDirectorySummaryDTO | UserPersonalProfileDTO {
  const baseSummary: UserDirectorySummaryDTO = {
    id: String(rawUser.id),
    name: String(rawUser.name),
    email: String(rawUser.email),
    role: String(rawUser.role),
    position: rawUser.title ?? rawUser.position ?? null,
    avatarUrl: rawUser.avatarUrl ?? null,
    departmentId: rawUser.departmentId ?? null,
    department: extractDepartment(rawUser),
    isActive: Boolean(rawUser.isActive ?? true),
  };

  if (!canViewSensitive) {
    return baseSummary;
  }

  return {
    ...baseSummary,
    phone: rawUser.phone ?? null,
    createdAt: toISOStringSafe(rawUser.createdAt),
    updatedAt: toISOStringSafe(rawUser.updatedAt),
  };
}
```

### 6.2 Cải tiến Endpoint `GET /api/users` & Thêm Endpoint Cá nhân

1. **`GET /api/users` (Mặc định cho Dropdown / Directory Browsing)**:
   - Chỉ trả về danh sách dạng `UserDirectorySummaryDTO[]`.
   - **Tuyệt đối không đính kèm `phone`** trong danh sách hàng loạt.
   - Bắt buộc phân trang an toàn (Safe Capped Pagination): Mặc định `pageSize = 20`, tối đa `limit = 50`. Nghiêm cấm client gửi `limit=1000` để vét cạn cơ sở dữ liệu.
   - Tích hợp kiểm tra Rate Limit: Cán bộ tìm kiếm với tần suất cao (vượt ngưỡng 30 requests/phút) sẽ bị chặn tạm thời qua `assertRateLimit(authUser.id, 'SEARCH')`.

2. **`GET /api/users/me` (Hồ sơ của chính người dùng hiện tại)**:
   - Trả về toàn bộ thông tin cá nhân của chính chủ, bao gồm cả số điện thoại, cài đặt giao diện, thông báo.

3. **`GET /api/users/[id]` (Xem chi tiết một cá nhân cụ thể)**:
   - Thực thi Contextual Authorization Engine (ADR-002 Pipeline):
     - Nếu người xem là chính chủ (`targetUserId === context.userId`) $\to$ Cung cấp `phone`.
     - Nếu người xem sở hữu capability `user.personal.read_sensitive` với phạm vi thể chế (`INSTITUTIONAL_SCOPE` — ví dụ minh họa: Ban Giám hiệu, cán bộ phụ trách TCCB) $\to$ Cung cấp `phone`.
     - Nếu người xem sở hữu capability `user.personal.read_sensitive` với phạm vi đơn vị (`UNIT_SCOPE`) và đối tượng thuộc cùng đơn vị quản lý (`targetUser.unitId === actor.unitId` — ví dụ minh họa: Trưởng đơn vị quản lý trực tiếp) $\to$ Cung cấp `phone`.
     - Mọi trường hợp khác không thỏa mãn capability/scope $\to$ Trả về `UserOperationalProfileDTO` với `phone = null` (che giấu Tier 3).

### 6.3 Cơ chế Ghi vết Kiểm toán (Audit Logging) theo Nghị định 13

Điều 26 Nghị định 13/2023/NĐ-CP yêu cầu cơ quan kiểm soát dữ liệu phải lưu trữ nhật ký xử lý dữ liệu cá nhân. Do đó, mọi hành vi truy cập trường Tier 3 (Số điện thoại cá nhân) trên hệ thống bắt buộc phải được ghi nhận vào bảng nhật ký kiểm toán (`authorization-audit.ts`):

```json
{
  "timestamp": "2026-09-22T10:15:30.123Z",
  "actorId": "usr_truongphong_daotao",
  "action": "user.personal.read_sensitive",
  "targetUserId": "usr_giangvien_cntt",
  "decision": "GRANT",
  "policyMatched": "STEP_7_UNIT_LEADER_OVER_MEMBER",
  "accessedFields": ["phone"],
  "ipAddress": "10.0.12.45",
  "requestId": "req_audit_7c8d9e"
}
```

---

## 7. Migration Impact & Backward Compatibility (Tác động Chuyển đổi & Tương thích Ngược)

### 7.1 Đánh giá Tác động lên Giao diện Người dùng (Frontend Components)

Rà soát toàn bộ các thành phần đang tiêu thụ dữ liệu nhân sự qua `usePersonnelList()`:

1. **`src/hooks/use-personnel-list.ts`**:
   - Hiện đang định nghĩa interface `PersonnelOption`:
     ```typescript
     export interface PersonnelOption {
       id: string;
       name: string;
       email?: string;
       departmentName?: string;
       title?: string;
       role?: string;
     }
     ```
   - **Xác nhận tương thích 100%**: Interface này **hoàn toàn không chứa trường `phone`**!
   - Việc loại bỏ `phone` khỏi `GET /api/users` không gây ra bất kỳ lỗi runtime hay sai lệch giao diện nào đối với `usePersonnelList()`.

2. **Các UI Pickers & Subtask Drawers**:
   - `task-identity-block.tsx`: Sử dụng `name`, `avatarUrl`, `title` để hiển thị người chủ trì nhiệm vụ $\to$ **Hoạt động hoàn hảo**.
   - `task-properties-sidebar.tsx`: Sử dụng `id`, `name`, `departmentName` trong dropdown gán người $\to$ **Hoạt động hoàn hảo**.
   - `task-subtasks-section.tsx` & `subtask-detail-drawer.tsx`: Gán người phụ trách việc con $\to$ **Hoạt động hoàn hảo**.
   - `task-block-editor.tsx`: Tính năng Mention `@user` trong nội dung tài liệu/nhiệm vụ $\to$ **Hoạt động hoàn hảo**.

### 7.2 Lộ trình Nâng cấp Cơ sở Dữ liệu & Chuẩn Hóa Dữ liệu Hỗn Hợp (Database Schema Evolution)

Trong kiến trúc cơ sở dữ liệu hiện tại (`prisma/schema.prisma`):
- Model `User` chỉ có một trường duy nhất: `phone String? @db.VarChar(20)`.
- Hiện trạng dữ liệu thực tế (`prisma/seed.ts` và dữ liệu vận hành): Đang chứa lẫn lộn cả số cố định cơ quan (ví dụ `0256.3846.478`) và số di động cá nhân (ví dụ `0913.789.012`).

**Quyết định Kiến trúc và Lộ trình Xử lý**:
1. **Chính sách Bảo vệ Mặc định Hiện tại (Current Default-Protected Policy - WI-1.4b)**:
   - Toàn bộ trường `User.phone` được đối xử thống nhất như **Dữ liệu Cá nhân được Bảo vệ (Tier 3 Protected Personal Data)**.
   - Tuyệt đối không suy diễn dựa trên đầu số hoặc giả định số nào là máy bàn để mở công khai. Mặc định chặn trên danh bạ công vụ cho đến khi dữ liệu được chuẩn hóa rõ ràng.
2. **Kế hoạch Tách Schema trong Tương lai (Future Schema Normalization Decision)**:
   - Lập quyết định kiến trúc và migration script để phân tách thành 2 trường độc lập:
     - `workPhone String? @map("work_phone") @db.VarChar(50)`: Lưu số máy bàn nội bộ / số máy nhánh cơ quan (Tier 2 - Operational Contact).
     - `personalPhone String? @map("personal_phone") @db.VarChar(50)`: Lưu số điện thoại di động riêng của cá nhân (Tier 3 - Protected Personal Data).
   - Viết data migration script: Sử dụng regex và logic phân loại (ví dụ: các số bắt đầu bằng `0256` hoặc danh sách số văn phòng được xác nhận sẽ di chuyển sang `workPhone`, các số di động còn lại chuyển sang `personalPhone`).
   - Sau khi hoàn thành migration và verification, `workPhone` sẽ được mở trong DTO tác nghiệp Tier 2, trong khi `personalPhone` tiếp tục được bảo vệ nghiêm ngặt theo chính sách Tier 3.

---

## 8. Implementation Plan for WI-1.4b (Kế hoạch Triển khai Chi tiết)

Kế hoạch triển khai kỹ thuật tại WI-1.4b bao gồm 5 bước tuần tự:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ KẾ HOẠCH TRIỂN KHAI WI-1.4b (IMPLEMENTATION ROADMAP)                            │
├──────────┬──────────────────────────────────────────────────────────────────────┤
│ Bước 1   │ Bổ sung Canonical Capabilities vào `src/server/authorization/`       │
│          │ • Thêm `USER_DIRECTORY_CAPABILITIES` vào `capability.ts`             │
│          │ • Tích hợp logic lọc tại Step 2 & Step 7 trong authorization engine  │
├──────────┼──────────────────────────────────────────────────────────────────────┤
│ Bước 2   │ Tái cấu trúc User DTOs trong `src/server/dto/user-dto.ts`            │
│          │ • Thêm `UserDirectorySummaryDTO` (không có phone)                    │
│          │ • Viết hàm mapper `toSanitizedUserDTO()` với cờ kiểm soát thẩm quyền │
├──────────┼──────────────────────────────────────────────────────────────────────┤
│ Bước 3   │ Cập nhật Route Handler `src/app/api/users/route.ts`                  │
│          │ • Sử dụng `UserDirectorySummaryDTO` an toàn cho danh bạ chung        │
│          │ • Siết chặt phân trang (max take = 50) và rate limiting              │
├──────────┼──────────────────────────────────────────────────────────────────────┤
│ Bước 4   │ Bổ sung Route Xem Hồ sơ Chi tiết có Kiểm soát Thẩm quyền             │
│          │ • Cập nhật `GET /api/users/[id]` để chỉ mở số điện thoại cho chính   │
│          │   chủ hoặc người có capability `user.personal.read_sensitive`        │
├──────────┼──────────────────────────────────────────────────────────────────────┤
│ Bước 5   │ Kiểm thử Toàn diện & Xác thực Hợp chuẩn                              │
│          │ • Viết unit test cho DTO sanitization (chống leak phone)             │
│          │ • Viết integration test kiểm tra ma trận phân quyền khả kiến         │
│          │ • Chạy `npm run typecheck` và `npm test`                             │
└──────────┴──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Decision Summary & Sign-off

| Mục đánh giá | Kết luận Đề xuất |
| :--- | :--- |
| **Mô hình Khả kiến** | **Mô hình 3**: Capability/Context-Based Tiered Disclosure (Phân tầng theo Năng lực & Ngữ cảnh). |
| **Xử lý `User.phone`** | **Default-Protected as Tier 3**: Do dữ liệu hỗn hợp (chứa cả máy bàn và di động cá nhân), toàn bộ `User.phone` được bảo vệ mặc định là Tier 3 cho đến khi có migration tách `workPhone` và `personalPhone`. |
| **Bảo vệ Dữ liệu** | Tuân thủ tuyệt đối Nghị định 13/2023/NĐ-CP; loại bỏ số điện thoại cá nhân khỏi các danh bạ hàng loạt. |
| **Tương thích UI** | 100% tương thích ngược với `usePersonnelList` và các component giao việc, phối hợp hiện tại. |
| **Trạng thái RFC** | **PROPOSED** — Đệ trình Architecture Review Gate phê duyệt trước khi lập trình tại WI-1.4b. |
