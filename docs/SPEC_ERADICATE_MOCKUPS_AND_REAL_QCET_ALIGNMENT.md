---
status: completed
domain: data
created: 2026-09-08
---

# TÀI LIỆU ĐẶC TẢ KỸ THUẬT: ZERO-MOCKUP & ĐỒNG BỘ MÔ HÌNH TỔ CHỨC THỰC TẾ QCET
**Dự án:** Hệ thống Quản lý Văn bản & Điều hành Văn phòng Điện tử (QCET E-Office)  
**Cơ quan chủ quản:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Tên miền chính thức:** `https://cdktcnqn.edu.vn`  
**Hạ tầng định danh:** Google Workspace for Education (`@cdktcnqn.edu.vn`)  
**Tình trạng tài liệu:** Đã được rà soát bằng Ultracode Workflow & xác thực dữ liệu thực tế từ Exa Search.

---

## MỤC LỤC
1. [Phần 1: Bối cảnh, Mục tiêu & Nguyên tắc Zero-Mockup](#phần-1-bối-cảnh-mục-tiêu--nguyên-tắc-zero-mockup)
2. [Phần 2: Chuẩn hóa Mô hình Tổ chức Thực tế QCET](#phần-2-chuẩn-hóa-mô-hình-tổ-chức-thực-tế-qcet)
3. [Phần 3: Đặc tả Kỹ thuật Tầng Server & API](#mục-3-đặc-tả-kỹ-thuật-tầng-server--api-server--api-layer-specification)
4. [Phần 4: Đặc tả Cơ sở Dữ liệu Prisma & Dữ liệu Khởi tạo](#mục-4-đặc-tả-cơ-sở-dữ-liệu-prisma--dữ-liệu-khởi-tạo-database--seed-specification)
5. [Phần 5: Đặc tả Giao diện Người dùng & Loại bỏ Dev Shims](#mục-5-đặc-tả-giao-diện-người-dùng--loại-bỏ-dev-shims-ui-ergonomics--zero-shim-standard)
6. [Phần 6: Đặc tả Luồng Xác thực Thực tế & Onboarding](#mục-6-đặc-tả-luồng-xác-thực-thực-tế--onboarding-real-auth-pipeline--onboarding-sync)
7. [Phần 7: Kế hoạch Di chuyển & Triển khai từng bước](#7-kế-hoạch-di-chuyển--triển-khai-từng-bước-migration-roadmap)
8. [Phần 8: Ma trận Kiểm thử & Nghiệm thu](#8-ma-trận-kiểm-thử--nghiệm-thu-test-verification-matrix)

---

# TÀI LIỆU ĐẶC TẢ KỸ THUẬT: ZERO-MOCKUP & ĐỒNG BỘ MÔ HÌNH TỔ CHỨC THỰC TẾ QCET
**Dự án:** Hệ sinh thái Văn phòng điện tử QCET E-Office  
**Cơ quan chủ quản:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Tên miền hệ thống:** `https://e-office.cdktcnqn.edu.vn`  
**Hạ tầng định danh:** Google Workspace for Education (`@cdktcnqn.edu.vn`)  

---

## PHẦN 1: BỐI CẢNH, MỤC TIÊU & NGUYÊN TẮC ZERO-MOCKUP

### 1.1. Bối cảnh thực tiễn & Sự cấp thiết
Trong giai đoạn đầu phát triển (Prototyping & MVP), hệ thống QCET E-Office đã sử dụng các cấu trúc dữ liệu mô phỏng (mock data), các tài khoản thử nghiệm cố định trong mã nguồn (hardcoded seed users), cùng tiện ích chuyển đổi vai trò nhanh (1-click role switcher / demo backdoor) để phục vụ thiết kế giao diện và kiểm thử luồng người dùng.

Tuy nhiên, khi tiến hành chuẩn bị đưa hệ thống vào vận hành chính thức (Production Go-Live) trên hạ tầng On-Premise của Nhà trường tại tên miền `e-office.cdktcnqn.edu.vn`:
1. **Rủi ro an toàn thông tin nghiêm trọng:** Các cơ chế bypass đăng nhập, cookie gán sẵn hoặc danh sách tài khoản kèm mật khẩu cố định tạo ra lỗ hổng bảo mật cấp cao, có thể bị khai thác để leo thang đặc quyền (Privilege Escalation) hoặc xâm nhập trái phép vào luồng chỉ đạo của Ban Giám hiệu.
2. **Sai lệch dữ liệu điều hành tác nghiệp:** Các chỉ số KPI, ma trận tắc nghẽn công việc (bottleneck matrix), biểu đồ tiến độ phòng ban và luồng phê duyệt văn bản theo Nghị định 30/2020/NĐ-CP không thể phản ánh năng lực thực tế nếu còn tồn tại dữ liệu giả lập xen lẫn dữ liệu thực tế.
3. **Xung đột nghiệp vụ:** Sự không đồng nhất giữa danh xưng, mã phòng ban, tên khoa chuyên môn trên hệ thống với cơ cấu tổ chức pháp lý được công bố trên Cổng thông tin điện tử của trường (`cdktcnqn.edu.vn`) dẫn tới việc cán bộ, giảng viên không tìm thấy đơn vị công tác chính xác, làm đứt gãy luồng luân chuyển nhiệm vụ.

Do đó, việc ban hành và thực thi đặc tả **Zero-Mockup & Real QCET Alignment** là điều kiện tiên quyết mang tính pháp lý và kỹ thuật trước khi bàn giao hệ thống.

---

### 1.2. Mục tiêu chiến lược
1. **Thanh lọc 100% Mock Data & Test Accounts:** Xóa bỏ toàn bộ dữ liệu giả lập, các tệp mẫu tĩnh, mock task generators và danh sách tài khoản demo trên toàn bộ mã nguồn Client và Server.
2. **Định danh chính quy đơn kênh qua Google Workspace:** Thiết lập cổng xác thực duy nhất dành cho toàn thể cán bộ, giảng viên và viên chức thông qua giao thức Google OAuth 2.0 gắn chặt với tên miền thư điện tử công vụ `@cdktcnqn.edu.vn`.
3. **Chuẩn hóa cấu trúc tổ chức thực tế:** Tái lập mô hình dữ liệu tổ chức (Organization Schema) phản ánh chính xác 100% cơ cấu Hội đồng trường, Ban Giám hiệu, 06 Phòng/Trung tâm chức năng và 09 Khoa chuyên môn theo đúng Quyết định thành lập và Cổng thông tin Nhà trường.
4. **Bảo toàn tính nhất quán của cơ sở dữ liệu:** Mọi truy vấn hiển thị trên Dashboard, Khoang điều hành Ban Giám hiệu (Executive Cockpit), Không gian làm việc Trưởng đơn vị (Department Hub) và Bàn làm việc cá nhân (Personal Workspace) phải được cấp phát từ cơ sở dữ liệu PostgreSQL thông qua Prisma ORM, có phân quyền RBAC và kiểm soát phạm vi chặt chẽ.

---

### 1.3. Hệ nguyên tắc cốt lõi Zero-Mockup (Zero-Mock Core Principles)

#### Nguyên tắc 1: Real Data Only (Chỉ chấp nhận dữ liệu thực)
* Mọi bản ghi (Nhiệm vụ, Văn bản, Hồ sơ cán bộ, Đơn vị, Nhật ký xử lý) hiển thị trên giao diện người dùng bắt buộc phải xuất phát từ cơ sở dữ liệu tập trung PostgreSQL qua API Route chính thống.
* Cấm tuyệt đối việc sử dụng mảng dữ liệu tĩnh (fallback in-memory arrays) khi API trả về kết quả rỗng. Nếu không có dữ liệu, giao diện phải hiển thị trạng thái rỗng chuẩn hóa (Empty State), tuyệt đối không tự động sinh ra tác vụ giả để lấp đầy khoảng trống thị giác.

#### Nguyên tắc 2: Áp dụng triệt để nguyên lý YAGNI (You Aren't Gonna Need It)
* Loại bỏ tất cả các model, schema fields, helpers và components chỉ phục vụ mục đích trình diễn tính năng tiềm năng nhưng không nằm trong phạm vi nghiệp vụ thực tế của Nhà trường.
* Xóa bỏ các thuộc tính dư thừa trong cơ sở dữ liệu không gắn với quy trình hành chính (như điểm game hóa không cần thiết, trạng thái viễn tưởng, cấu hình giao diện thừa thãi).
* Đơn giản hóa kiến trúc: Một nguồn chân lý duy nhất (Single Source of Truth) cho mỗi thực thể nghiệp vụ.

#### Nguyên tắc 3: Bảo mật xác thực không cửa hậu (Zero Backdoor & Single Identity Authority)
* **Xóa bỏ hoàn toàn 1-Click Login:** Xóa bỏ toàn bộ các nút bấm dạng "Đăng nhập nhanh với tư cách Hiệu trưởng", "Đăng nhập thử nghiệm Trưởng phòng Đào tạo" trên trang `/login`.
* **Cấm Fake Authentication Hooks:** Loại bỏ mọi tham số URL dạng `?demoRole=BGH` hoặc `?mockUser=...` dùng để đánh lừa trạng thái người dùng trong Session/Client State.
* **Kiểm soát định danh công vụ hai lớp (Dual-Layer Domain Verification):**
  * Tầng 1 (Google OAuth Provider): Thiết lập tham số chuyển hướng `hd=cdktcnqn.edu.vn` để hạn chế giao diện chọn tài khoản của Google chỉ hiển thị email thuộc tổ chức.
  * Tầng 2 (Backend Validation): API Callback kiểm tra bắt buộc `email_verified === true` và `email.toLowerCase().endsWith("@cdktcnqn.edu.vn")`. Mọi email khác (bao gồm `@gmail.com`, tên miền cá nhân) đều bị từ chối truy cập ngay tại cổng và ghi nhận log an ninh.
* **Tài khoản quản trị khẩn cấp (Break-Glass Account):** Tài khoản quản trị nội bộ duy nhất phục vụ bảo trì hệ thống phải sử dụng mật khẩu mã hóa một chiều đạt chuẩn (Argon2id hoặc bcrypt salt >= 12 rounds), chỉ kích hoạt qua biến môi trường máy chủ, tuyệt đối không hardcode trong mã nguồn hoặc client bundle.

#### Nguyên tắc 4: Bất biến theo Hợp đồng dữ liệu thực tế (Schema Invariant & Auditability)
* Khóa ngoại (Foreign Keys) giữa bảng `User`, `Department`, `Task`, `Document` phải có ràng buộc toàn vẹn (Referential Integrity).
* Mọi hành động phê duyệt, chuyển tiếp, ủy quyền, bút phê bắt buộc phải lưu kèm định danh thực (User ID, Email công vụ, IP, User-Agent, Timestamp) để phục vụ kiểm toán hành chính theo quy định nhà nước.

---

## PHẦN 2: CHUẨN HÓA MÔ HÌNH TỔ CHỨC THỰC TẾ QCET

### 2.1. Pháp nhân & Quy chuẩn Định danh số Nhà trường
* **Tên tiếng Việt:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.
* **Tên giao dịch quốc tế:** Quy Nhon College of Engineering and Technology (QCET).
* **Cơ quan quản lý cấp trên:** Ủy ban nhân dân Tỉnh Bình Định / Bộ Lao động - Thương binh và Xã hội (Tổng cục GDNN).
* **Trụ sở chính:** 684 Hùng Vương, Phường Nhơn Phú, Thành phố Quy Nhơn, Tỉnh Bình Định.
* **Cổng thông tin điện tử chính thức:** `https://cdktcnqn.edu.vn`
* **Cổng thông tin tuyển sinh:** `https://tuyensinh.cdktcnqn.edu.vn`
* **Hệ thống Văn phòng điện tử:** `https://e-office.cdktcnqn.edu.vn`
* **Tên miền thư điện tử công vụ hợp thức:** `@cdktcnqn.edu.vn`

---

### 2.2. Cơ cấu Lãnh đạo Nhà trường (Ban Giám hiệu)
Ban Giám hiệu là cơ quan điều hành cao nhất các hoạt động chuyên môn, hành chính và chuyển đổi số của Nhà trường. Trong hệ thống QCET E-Office, Ban Giám hiệu được phân bổ nhóm quyền Lãnh đạo cấp cao (`ROLE_BGH` / `SUPER_ADMIN_VIEW`), sở hữu thẩm quyền giám sát toàn trường, ký duyệt văn bản đi và ban hành ý kiến chỉ đạo trực tiếp xuống các đơn vị.

#### Bảng danh mục Ban Giám hiệu & Phân công chỉ đạo điều hành:

| STT | Chức vụ | Họ và tên | Học vị / Chức danh | Lĩnh vực phụ trách & Chỉ đạo trọng tâm | Mã định danh BGH | Email công vụ quy chuẩn |
| :---: | :--- | :--- | :---: | :--- | :---: | :--- |
| 01 | **Hiệu trưởng** | Phạm Văn Tường | Thạc sĩ | Phụ trách chung toàn diện; Chủ tài khoản; Chiến lược phát triển; Tổ chức cán bộ, nhân sự; Bảo đảm chất lượng; Đầu tư cơ sở vật chất, xây dựng cơ bản, các dự án chương trình mục tiêu; Chủ tịch các Hội đồng của Trường. | `BGH_HT` | `tuongpv@cdktcnqn.edu.vn` |
| 02 | **Phó Hiệu trưởng** | Trần Trọng Kiệm | Thạc sĩ | Phụ trách công tác Đào tạo; Công tác Học sinh - Sinh viên; Chuyển đổi số và truyền thông; Quản lý cơ sở dữ liệu đào tạo; Trực tiếp chỉ đạo hoạt động chuyên môn của các Khoa; Phó Chủ tịch thường trực các Hội đồng chuyên môn. | `BGH_PHT_DT` | `kiemtt@cdktcnqn.edu.vn` |
| 03 | **Phó Hiệu trưởng** | Lê Xuân Nguyên | Thạc sĩ | Phụ trách công tác Hành chính - Quản trị; Quản lý cơ sở vật chất, đất đai; Công tác Tuyển sinh và Bồi dưỡng thường xuyên; Hợp tác quốc tế; Nghiên cứu khoa học và sáng kiến kỹ thuật; Phó Chủ tịch thường trực các Hội đồng liên quan. | `BGH_PHT_CSVC` | `nguyenlx@cdktcnqn.edu.vn` |

*Ghi chú:* Hộp thư chỉ đạo chung của Ban Giám hiệu trên hệ thống nhận văn bản liên cơ quan: `bgh@cdktcnqn.edu.vn`.

---

### 2.3. Danh mục 06 Phòng & Trung tâm chức năng
Khối Phòng và Trung tâm chức năng giữ vai trò tham mưu, tổng hợp, thực thi công tác nghiệp vụ hành chính, bảo đảm nguồn lực và vận hành hạ tầng số của Nhà trường. Lãnh đạo các đơn vị này được phân cấp quyền Trưởng đơn vị (`ROLE_DEPT_HEAD`), chuyên viên trực thuộc nhận quyền Cán bộ/Chuyên viên (`ROLE_STAFF`).

#### Bảng danh mục 06 Phòng & Trung tâm chức năng thực tế:

| STT | Tên Phòng / Trung tâm chức năng | Tên viết tắt | Mã hệ thống (Unit Code) | Mã kế thừa (Legacy Aliases) | Chức năng & Nhiệm vụ trọng tâm | Vị trí làm việc | Email công vụ đầu mối |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| 01 | **Phòng Quản lý Đào tạo** | P. Đào tạo | `P_QLDT` | `P_DTQLKH`, `DT_QLKH` | Tham mưu xây dựng quy mô, kế hoạch đào tạo các hệ; phân bổ thời khóa biểu; quản lý hồ sơ học vụ, điểm thi, cấp phát văn bằng chứng chỉ; tổ chức thực hiện chương trình liên kết đào tạo. | Tòa nhà Hiệu bộ (Tầng 1) | `daotao@cdktcnqn.edu.vn` |
| 02 | **Phòng Hành chính - Quản trị** | P. HC-QT | `P_HCQT` | `P_HC`, `HCQT` | Đầu mối tiếp nhận, phát hành văn bản đi/đến (Nghị định 30); quản lý con dấu; điều phối xe công vụ, lễ tân đối ngoại; quản trị cơ sở vật chất, điện nước, cảnh quan, an ninh trật tự và ký túc xá. | Tòa nhà Hiệu bộ (Tầng 1) | `hanhchinh@cdktcnqn.edu.vn` |
| 03 | **Phòng Tổ chức - Đảm bảo chất lượng** | P. TC-ĐBCL | `P_TCDBCL` | `P_KTDBCL`, `TC_DBCL` | Tham mưu kiện toàn cơ cấu tổ chức bộ máy, vị trí việc làm, quy hoạch, bổ nhiệm, đào tạo bồi dưỡng cán bộ, thi đua khen thưởng; công tác tự đánh giá, kiểm định chất lượng GDNN và khảo thí độc lập. | Tòa nhà Hiệu bộ (Tầng 2) | `tochuc@cdktcnqn.edu.vn` |
| 04 | **Phòng Tài chính** (Kế hoạch - Tài chính) | P. Tài chính | `P_TC` | `P_KHTC`, `KHTC` | Tham mưu quản lý tài chính, ngân sách nhà nước, học phí và các nguồn thu hợp pháp khác; lập dự toán, thanh quyết toán kinh phí đầu tư công, chi trả tiền lương, phụ cấp giảng dạy, chế độ chính sách. | Tòa nhà Hiệu bộ (Tầng 1) | `taichinh@cdktcnqn.edu.vn` |
| 05 | **Phòng Tuyển sinh - Hợp tác quốc tế** | P. TS-HTQT | `P_TSHTQT` | `P_CTHSSV`, `TS_HTQT` | Đầu mối xây dựng chiến lược truyền thông tuyển sinh các hệ Cao đẳng, Trung cấp, Sơ cấp; tư vấn hướng nghiệp; phát triển quan hệ hợp tác quốc tế, dự án tài trợ nước ngoài (GIZ, KOSEN...) và kết nối doanh nghiệp. | Tòa nhà Hiệu bộ (Tầng 1) | `tuyensinh@cdktcnqn.edu.vn` |
| 06 | **Trung tâm Số - Truyền thông** | TT. Số - TT | `TT_STT` | `TT_DCC`, `QTM_CNTT` | Quản trị hạ tầng mạng LAN/WiFi, máy chủ nội bộ, an toàn an ninh thông tin; phát triển và vận hành hệ thống E-Office, Cổng thông tin điện tử; cấp phát và kiểm soát email `@cdktcnqn.edu.vn`; quản lý số hóa tài liệu thư viện. | Tòa nhà Thư viện (Tầng 2) | `quantrimang@cdktcnqn.edu.vn` |

*Ghi chú phụ trợ:* Đơn vị liên kết đào tạo ngoại ngữ và kỹ năng tin học trực thuộc trường: **Trung tâm Ngoại ngữ - Tin học** (Mã: `TT_NNTH`, Email: `nnth@cdktcnqn.edu.vn`).

---

### 2.4. Danh mục 09 Khoa chuyên môn
Khối Khoa chuyên môn là các đơn vị nòng cốt thực hiện nhiệm vụ đào tạo kỹ sư thực hành, công nhân kỹ thuật lành nghề, nghiên cứu ứng dụng và chuyển giao công nghệ. Trưởng khoa (`ROLE_DEPT_HEAD`) chịu trách nhiệm tiếp nhận nhiệm vụ từ Ban Giám hiệu, phê duyệt đề cương, theo dõi khối lượng giảng dạy của bộ môn và phân công cho giảng viên trực thuộc (`ROLE_TEACHER` / `ROLE_STAFF`).

#### Bảng danh mục 09 Khoa chuyên môn theo Cổng thông tin điện tử:

| STT | Tên Khoa chuyên môn | Tên viết tắt | Mã hệ thống (Unit Code) | Mã kế thừa (Legacy Aliases) | Lĩnh vực chuyên ngành đào tạo then chốt | Vị trí Xưởng / Văn phòng Khoa | Email công vụ đầu mối |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| 01 | **Khoa Công nghệ thông tin** (Điện tử - Tin học) | Khoa CNTT | `K_CNTT` | `K_DTTH`, `khoa-cntt` | Kỹ thuật phần mềm, Quản trị mạng & An toàn thông tin, Thiết kế đồ họa đa phương tiện, Ứng dụng Trí tuệ nhân tạo (AI), Cơ sở dữ liệu và chuyển đổi số. | Khu Giảng đường C (Tầng 3) | `k.cntt@cdktcnqn.edu.vn` |
| 02 | **Khoa Cơ khí** | Khoa Cơ khí | `K_CK` | `khoa-co-khi`, `K_COKHI` | Cắt gọt kim loại trên máy công cụ vạn năng & CNC, Công nghệ Hàn công nghệ cao (TIG/MIG/MAG chuẩn quốc tế), Bảo trì hệ thống cơ khí công nghiệp. | Khu Xưởng Cơ khí A | `k.cokhi@cdktcnqn.edu.vn` |
| 03 | **Khoa Công nghệ Ô tô** | Khoa Ô tô | `K_CNOTO` | `K_KTCN`, `khoa-oto` | Kỹ thuật bảo dưỡng & sửa chữa ô tô động cơ xăng/diesel thế hệ mới, Chẩn đoán hệ thống điện tử ECU, Công nghệ xe lai (Hybrid) và ô tô điện (EV). | Khu Xưởng Ô tô D | `k.oto@cdktcnqn.edu.vn` |
| 04 | **Khoa Điện** | Khoa Điện | `K_DIEN` | `khoa-dien`, `K_DIENTU` | Điện công nghiệp, Kỹ thuật lắp đặt điện xí nghiệp, Hệ thống tự động hóa PLC/SCADA, Điện lạnh & Điều hòa không khí, Năng lượng tái tạo áp mái. | Khu Giảng đường B (Tầng 1) | `k.dien@cdktcnqn.edu.vn` |
| 05 | **Khoa Du lịch - Dịch vụ** (Khoa Du lịch) | Khoa Du lịch | `K_DULICH` | `K_DL`, `khoa-dulich` | Quản trị Khách sạn, Quản trị Nhà hàng và Dịch vụ ăn uống, Kỹ thuật chế biến món ăn (Á - Âu), Nghiệp vụ Lễ tân & Hướng dẫn du lịch (chuẩn VTOS). | Khu Giảng đường G & Nhà hàng mẫu | `k.dulich@cdktcnqn.edu.vn` |
| 06 | **Khoa Kinh tế - Quản trị** | Khoa KT-QT | `K_KTQT` | `K_KTTH`, `KINH_TE` | Kế toán doanh nghiệp số, Quản trị kinh doanh, Logistics và Quản lý chuỗi cung ứng, Thương mại điện tử và Marketing số. | Khu Giảng đường B (Tầng 2) | `k.kinhte@cdktcnqn.edu.vn` |
| 07 | **Khoa Văn hóa Nghệ thuật** | Khoa VH-NT | `K_VHNT` | `khoa-vhnt`, `K_NGHETHUAT` | Đào tạo Thanh nhạc, Biểu diễn nhạc cụ dân tộc và đương đại, Thiết kế thời trang & Công nghệ may, Quản lý văn hóa cơ sở. | Khu Giảng đường Nghệ thuật E | `k.vhnt@cdktcnqn.edu.vn` |
| 08 | **Khoa Văn hóa THPT** (Khoa Đại cương) | Khoa VH-THPT | `K_DAICUONG` | `K_VHTHPT`, `K_COBAN` | Giảng dạy 7 môn văn hóa trung học phổ thông cho học sinh hệ 9+ (học nghề kết hợp tốt nghiệp THPT); các học phần khoa học cơ bản, Lý luận chính trị và GDQP-AN. | Khu Giảng đường B (Tầng 3) | `k.daicuong@cdktcnqn.edu.vn` |
| 09 | **Khoa Kỹ thuật Nông nghiệp** | Khoa Nông nghiệp | `K_KTNN` | `khoa-nongnghiep`, `K_NN` | Nông nghiệp công nghệ cao, Trồng trọt thông minh trong nhà màng, Bảo vệ thực vật, Kỹ thuật thú y ứng dụng phục vụ kinh tế nông thôn Nam Trung Bộ. | Khu Trại thực nghiệm & Nhà lưới | `k.nongnghiep@cdktcnqn.edu.vn` |

---

### 2.5. Quy chuẩn Mã định danh (Unit Code Rules) & Bảng ánh xạ tương thích ngược

#### Quy chuẩn cấu trúc mã định danh:
Mã định danh đơn vị (Unit Code) trong cơ sở dữ liệu và giao diện được cấu thành theo định dạng chuẩn hóa chữ in hoa:
`[TIỀN_TỐ_LOẠI_HÌNH]_[TÊN_VIẾT_TẮT_ĐƠN_VỊ]`
* **Tiền tố Ban Giám hiệu:** `BGH`
* **Tiền tố Phòng chức năng:** `P_` (Ví dụ: `P_QLDT`, `P_HCQT`, `P_TC`)
* **Tiền tố Trung tâm trực thuộc:** `TT_` (Ví dụ: `TT_STT`, `TT_NNTH`)
* **Tiền tố Khoa chuyên môn:** `K_` (Ví dụ: `K_CNTT`, `K_CK`, `K_CNOTO`, `K_DIEN`)

#### Bảng ma trận ánh xạ tương thích ngược (Legacy Code Mapping Table):
Nhằm đảm bảo các bài kiểm thử tự động hiện hữu (Integration Tests), các hàm bộ lọc tác vụ cũ (`role-task-filter.ts`, `executive-matrix-aggregator.ts`) và các bản ghi văn bản đã khởi tạo không bị đứt gãy, hệ thống áp dụng từ điển ánh xạ tự động (Lookup Normalizer):

```typescript
export const QCET_UNIT_CANONICAL_MAP: Record<string, string> = {
  // Ban Giám hiệu
  "bgh": "BGH",
  "BAN_GIAM_HIEU": "BGH",
  
  // Khối Phòng / Trung tâm
  "P_DTQLKH": "P_QLDT",
  "DT_QLKH": "P_QLDT",
  "dept-p-qldt": "P_QLDT",
  "P_KTDBCL": "P_TCDBCL",
  "TC_DBCL": "P_TCDBCL",
  "dept-p-tcdbcl": "P_TCDBCL",
  "P_CTHSSV": "P_TSHTQT",
  "TS_HTQT": "P_TSHTQT",
  "dept-p-tshtqt": "P_TSHTQT",
  "P_KHTC": "P_TC",
  "KHTC": "P_TC",
  "dept-p-tc": "P_TC",
  "TT_DCC": "TT_STT",
  "QTM_CNTT": "TT_STT",
  "dept-tt-stt": "TT_STT",
  
  // Khối Khoa chuyên môn
  "K_DTTH": "K_CNTT",
  "CNTT": "K_CNTT",
  "khoa-cntt": "K_CNTT",
  "dept-k-dtth": "K_CNTT",
  "K_COKHI": "K_CK",
  "khoa-co-khi": "K_CK",
  "dept-k-ck": "K_CK",
  "K_KTCN": "K_CNOTO",
  "khoa-oto": "K_CNOTO",
  "dept-k-cnoto": "K_CNOTO",
  "khoa-dien": "K_DIEN",
  "dept-k-dien": "K_DIEN",
  "K_DL": "K_DULICH",
  "khoa-dulich": "K_DULICH",
  "dept-k-dulich": "K_DULICH",
  "K_KTTH": "K_KTQT",
  "KINH_TE": "K_KTQT",
  "dept-k-ktth": "K_KTQT",
  "khoa-vhnt": "K_VHNT",
  "dept-k-vhnt": "K_VHNT",
  "K_VHTHPT": "K_DAICUONG",
  "K_COBAN": "K_DAICUONG",
  "dept-k-daicuong": "K_DAICUONG",
  "khoa-nongnghiep": "K_KTNN",
  "dept-k-ktnn": "K_KTNN"
};
```

---

### 2.6. Quy chuẩn Định danh Thư điện tử & Tài khoản Google Workspace (@cdktcnqn.edu.vn)

Toàn bộ hệ thống xác thực định danh của QCET E-Office được neo chặt vào cấu trúc hòm thư điện tử do Trung tâm Số - Truyền thông cấp phát trên nền tảng Google Workspace for Education.

#### 1. Định dạng tài khoản cá nhân của Cán bộ, Giảng viên:
* **Cấu trúc tổng quát:** `[tên_chính][họ_viết_tắt][tên_đệm_viết_tắt]@cdktcnqn.edu.vn`
* **Ví dụ minh họa:**
  * Thầy Phạm Văn Tường (Hiệu trưởng) -> `tuongpv@cdktcnqn.edu.vn`
  * Thầy Trần Trọng Kiệm (Phó Hiệu trưởng) -> `kiemtt@cdktcnqn.edu.vn`
  * Thầy Lê Xuân Nguyên (Phó Hiệu trưởng) -> `nguyenlx@cdktcnqn.edu.vn`
  * Thầy Lê Văn Thí (Trưởng phòng Quản lý Đào tạo) -> `thilv@cdktcnqn.edu.vn` hoặc `levanthi@cdktcnqn.edu.vn`
  * Thầy Nguyễn Ngọc Vinh (Trưởng khoa CNTT) -> `vinhnn@cdktcnqn.edu.vn`

#### 2. Định dạng hòm thư chức năng của Đơn vị (Google Groups / Shared Inboxes):
Nhằm bảo đảm việc chuyển giao công việc khi có biến động nhân sự, mỗi đơn vị sở hữu một hòm thư định danh công vụ để nhận thông báo tự động từ E-Office:
* **Ban Giám hiệu:** `bgh@cdktcnqn.edu.vn`
* **Văn phòng Hành chính (Văn thư):** `hanhchinh@cdktcnqn.edu.vn`
* **Phòng Quản lý Đào tạo:** `daotao@cdktcnqn.edu.vn`
* **Phòng Tổ chức - ĐBCL:** `tochuc@cdktcnqn.edu.vn`
* **Phòng Tài chính:** `taichinh@cdktcnqn.edu.vn`
* **Phòng Tuyển sinh - HTQT:** `tuyensinh@cdktcnqn.edu.vn`
* **Trung tâm Số - Truyền thông:** `quantrimang@cdktcnqn.edu.vn`
* **Hòm thư các Khoa:** `k.[mã_khoa_chữ_thường]@cdktcnqn.edu.vn` (Ví dụ: `k.cntt@cdktcnqn.edu.vn`, `k.cokhi@cdktcnqn.edu.vn`, `k.oto@cdktcnqn.edu.vn`, `k.dien@cdktcnqn.edu.vn`...).

#### 3. Ma trận Phân quyền Vai trò (RBAC) gắn với Định danh Tổ chức:

| Nhóm chức năng | Vai trò hệ thống (`UserRole`) | Đơn vị gắn kết (`departmentId`) | Thẩm quyền cốt lõi trên QCET E-Office |
| :--- | :---: | :---: | :--- |
| **Ban Giám hiệu** | `ROLE_BGH` / `SUPER_ADMIN` | `BGH` | Xem toàn cảnh 15 đơn vị; phân công nhiệm vụ chiến lược; ban hành văn bản quy phạm nội bộ; bút phê trực tiếp trên hồ sơ tờ trình. |
| **Lãnh đạo Phòng / Trung tâm** | `ROLE_DEPT_HEAD` | `P_*` hoặc `TT_*` | Tiếp nhận chỉ đạo từ BGH; lập kế hoạch công tác phòng; phân công việc cho chuyên viên; ký nháy văn bản trước khi trình BGH. |
| **Lãnh đạo Khoa chuyên môn** | `ROLE_DEPT_HEAD` | `K_*` | Tiếp nhận nhiệm vụ năm học; phân công giảng dạy, nghiên cứu, quản lý xưởng thực hành cho giảng viên; phê duyệt đề xuất vật tư thực hành. |
| **Chuyên viên các Phòng ban** | `ROLE_STAFF` | `P_*` hoặc `TT_*` | Soạn thảo văn bản, tờ trình; tiếp nhận và báo cáo tiến độ xử lý hồ sơ, nhiệm vụ hành chính được giao. |
| **Giảng viên các Khoa** | `ROLE_TEACHER` / `ROLE_STAFF` | `K_*` | Nhận nhiệm vụ giảng dạy, biên soạn đề cương bài giảng; lập hồ sơ minh chứng kiểm định; báo cáo tiến độ công việc chuyên môn. |
| **Văn thư Nhà trường** | `ROLE_CLERK` | `P_HCQT` | Tiếp nhận văn bản đến, vào sổ số hiệu văn bản; trình BGH phê duyệt; số hóa đính kèm PDF; phát hành văn bản đi theo chuẩn NĐ 30/2020/NĐ-CP. |
| **Quản trị hệ thống** | `ROLE_ADMIN` | `TT_STT` | Quản lý người dùng, sao lưu cơ sở dữ liệu PostgreSQL, giám sát nhật ký an ninh hệ thống, cấu hình tham số bảo mật máy chủ. |

---

*Tài liệu Đặc tả Phần 1 & 2 được phê duyệt làm căn cứ kỹ thuật chuẩn mực để triển khai toàn bộ các cấu phần dữ liệu, API, kiểm thử và giao diện người dùng của hệ sinh thái QCET E-Office.*

---

# ZERO-MOCKUP & REAL QCET ALIGNMENT SPECIFICATION

---

## MỤC 3: ĐẶC TẢ KỸ THUẬT TẦNG SERVER & API (SERVER & API LAYER SPECIFICATION)

### 3.1. Triết lý Thiết kế Zero-Mockup & Database-First 100%
Tầng Server và API của hệ thống QCET E-Office hoạt động theo nguyên tắc xác thực định danh thực tế và truy xuất trực tiếp từ cơ sở dữ liệu PostgreSQL thông qua Prisma ORM. 
1. **Xóa bỏ hoàn toàn Demo-Session & Bypass Mode**: Khai tử endpoint `/api/auth/demo-session` và toàn bộ cơ chế chuyển vai trò giả lập (role-switching không qua xác thực). Không cho phép bất kỳ yêu cầu nào vượt qua cổng bảo mật bằng thông tin định danh tĩnh.
2. **Loại bỏ triệt để Fake User & Fallback User**: Mọi giao dịch nghiệp vụ (tạo nhiệm vụ, ban hành ý kiến chỉ đạo văn bản, tải minh chứng, phân công công việc) bắt buộc phải gắn kết với định danh của phiên người dùng hợp lệ (`session.id`) hoặc đối tượng nhân sự tồn tại thực tế trong cơ sở dữ liệu. Nghiêm cấm mọi hành vi tự động gán `fallbackUser = prisma.user.findFirst()` khi thiếu dữ liệu đầu vào.
3. **Thanh lọc Tham số `?source=mock` và Logic Giả lập**: Tuyệt đối không chấp nhận tham số truy vấn `?source=mock` trong API tổng quan `/api/dashboard/overview`. Khi cơ sở dữ liệu rỗng hoặc không có bản ghi phù hợp với bộ lọc, API trả về cấu trúc dữ liệu rỗng chuẩn (Empty State: `tasks: []`, `stats: { total: 0, ... }`) thay vì tráo đổi sang mock payload.

---

### 3.2. Đặc tả Chi tiết Các Endpoint API

#### 3.2.1. Loại bỏ Vĩnh viễn Endpoint Demo-Session
- **Đường dẫn tệp tuyệt đối**: `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/auth/demo-session/route.ts`
- **Hành động**: Xóa bỏ hoàn toàn tệp này khỏi cây thư mục mã nguồn.
- **Biện pháp ngăn chặn**: Bất kỳ truy vấn HTTP `POST` nào đến `/api/auth/demo-session` sẽ được Next.js Router xử lý tự động thành mã trạng thái `404 Not Found`.

---

#### 3.2.2. Chuẩn hóa Xác thực Đăng nhập: `/api/auth/login`
- **Đường dẫn tệp tuyệt đối**: `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/auth/login/route.ts`
- **Hàm xử lý**: `export async function POST(req: Request): Promise<NextResponse<LoginResponse>>`
- **Mô tả hành vi**:
  1. Nhận payload chứa `email` và `password`. Chuẩn hóa email bằng cách cắt khoảng trắng và chuyển về chữ thường (`trim().toLowerCase()`).
  2. Truy vấn trực tiếp từ bảng `User` trong PostgreSQL theo trường `email`.
  3. Từ chối ngay lập tức nếu người dùng không tồn tại hoặc không có `passwordHash` (mã lỗi `401 Unauthorized`).
  4. Kiểm tra cờ trạng thái `user.isActive`. Nếu tài khoản bị khóa hoặc ngưng kích hoạt, trả về mã lỗi `403 Forbidden`.
  5. Đối chiếu mật khẩu văn bản thô với chuỗi mã hóa bcrypt trong cơ sở dữ liệu qua `verifyPassword(password, user.passwordHash)`.
  6. Khởi tạo JSON Web Token (JWT) có chữ ký số mã hóa HS256 (`signSessionToken`) với thời hạn 7 ngày.
  7. Thiết lập Cookie HTTP-Only bảo mật (`qcet_session`), cờ `Secure` (khi chạy production), `SameSite=Lax`, `Path=/`.
  8. Trả về thông tin hồ sơ người dùng thực tế từ cơ sở dữ liệu, tuyệt đối không chèn tài khoản demo.

- **Hợp đồng Dữ liệu (Strict TypeScript Types)**:
```typescript
export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface UserSessionDto {
  id: string;
  email: string;
  name: string;
  role: "BAN_GIAM_HIEU" | "TRUONG_PHONG" | "CHUYEN_VIEN" | "VAN_THU" | "ADMIN";
  departmentId: string | null;
  title: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  onboardedAt?: string | null;
  onboardingData?: Record<string, unknown> | null;
}

export type LoginResponse =
  | {
      success: true;
      user: UserSessionDto;
    }
  | {
      success: false;
      error: string;
      code?: "INVALID_CREDENTIALS" | "ACCOUNT_LOCKED" | "VALIDATION_FAILED";
    };
```

---

#### 3.2.3. Chuẩn hóa Đăng ký Tài khoản Công vụ: `/api/auth/register`
- **Đường dẫn tệp tuyệt đối**: `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/auth/register/route.ts`
- **Hàm xử lý**: `export async function POST(req: Request): Promise<NextResponse<RegisterResponse>>`
- **Mô tả hành vi**:
  1. Nhận payload gồm: `email`, `password`, `name`, `departmentId`, `title`.
  2. Kiểm tra định dạng: email bắt buộc thuộc tên miền công vụ hợp lệ (`@qcet.edu.vn`), độ dài mật khẩu từ 6 đến 72 ký tự.
  3. Kiểm tra tính đơn nhất (Unique Constraint) của `email` trong bảng `User`. Nếu trùng lặp, trả về mã lỗi `409 Conflict`.
  4. Xác thực toàn vẹn khóa ngoại (Foreign Key Validation): `departmentId` phải là mã phòng ban hợp lệ tồn tại trong bảng `Department`. Nếu không tìm thấy mã đơn vị, trả về lỗi `400 Bad Request` ("Phòng ban không tồn tại trong hệ thống"), không gán ngầm định phòng ban ảo.
  5. Mã hóa mật khẩu an toàn bằng bcrypt (`hashPassword(password, 10)`).
  6. Cố định vai trò đăng ký công khai mặc định là `CHUYEN_VIEN` (UserRole.CHUYEN_VIEN). Không cho phép client tự gửi trường `role` để leo thang đặc quyền.
  7. Trả về mã trạng thái `201 Created` kèm thông tin tài khoản được lưu trữ trong cơ sở dữ liệu.

- **Hợp đồng Dữ liệu (Strict TypeScript Types)**:
```typescript
export interface RegisterRequestBody {
  email: string;
  password: string;
  name: string;
  departmentId: string;
  title?: string;
}

export type RegisterResponse =
  | {
      success: true;
      user: {
        id: string;
        email: string;
        name: string;
        role: "CHUYEN_VIEN";
        departmentId: string | null;
        title: string | null;
        onboardedAt: string | null;
        onboardingData: Record<string, unknown> | null;
      };
    }
  | {
      success: false;
      error: string;
      field?: "email" | "password" | "departmentId" | "name";
    };
```

---

#### 3.2.4. Xóa Bỏ Query `?source=mock` trong API Tổng quan Dashboard: `/api/dashboard/overview`
- **Đường dẫn tệp tuyệt đối**:
  - Route Handler: `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/dashboard/overview/route.ts`
  - Dịch vụ truy vấn: `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/server/dashboard-service.ts`
- **Hàm xử lý**:
  - Route: `export async function GET(req: Request): Promise<NextResponse<DashboardPayload | DashboardErrorResponse>>`
  - Dịch vụ: `export async function getLiveDashboardData(options?: LiveDashboardOptions): Promise<DashboardPayload>`
- **Mô tả hành vi**:
  1. Route Handler cấu hình `dynamic = "force-dynamic"` và `revalidate = 0` nhằm đảm bảo dữ liệu luôn được truy vấn mới nhất, vô hiệu hóa hoàn toàn cache tĩnh.
  2. Bỏ qua và loại trừ hoàn toàn việc đọc query string `?source=mock`. Không cho phép client kích hoạt chế độ nạp mock qua URL.
  3. Lấy dữ liệu 100% từ bảng `Task` trong PostgreSQL thông qua Prisma Client, kèm theo các quan hệ:
     - `department`: Thông tin đơn vị chủ trì.
     - `assignees`: Bao gồm bảng phụ `user` (id, name, avatarUrl, role, title).
     - `deliverables`: Danh sách file nộp minh chứng.
     - `resolutions`: Danh sách nghị quyết điều hành từ Ban Giám hiệu.
     - `subTasks`: Danh sách các công việc cụ thể trực thuộc, kèm đơn vị và người thực hiện.
  4. Bộ lọc thời gian học vụ: Lọc theo `academicMonth` (1 - 12) và `academicYear` (ví dụ: `2026-2027`).
  5. Tính toán chỉ số thống kê điều hành (`DashboardStats`):
     - `total`: Tổng số nhiệm vụ theo điều kiện lọc.
     - `inProgress`: Nhiệm vụ đang tiến hành (`status === "IN_PROGRESS"`).
     - `completed`: Nhiệm vụ đã hoàn thành (`status === "COMPLETED"`).
     - `overdue`: Nhiệm vụ quá hạn (`status === "OVERDUE"` hoặc ngày hiện tại vượt quá `dueDate` mà chưa hoàn thành).
     - `pendingApprovals`: Nhiệm vụ đang chờ Ban Giám hiệu / Trưởng phòng duyệt (`status === "WAITING_APPROVAL"`).
  6. Xử lý kịch bản dữ liệu rỗng: Trả về `DashboardPayload` với mảng `tasks: []` và các chỉ số thống kê bằng `0`. Không tự động kích hoạt hàm nạp dữ liệu mẫu `getMockDashboardPayload()`.
  7. Xử lý lỗi cơ sở dữ liệu: Trả về HTTP 500 với payload lỗi có cấu trúc, không nuốt lỗi (catch-and-swallow).

- **Hợp đồng Dữ liệu (Strict TypeScript Types)**:
```typescript
import type { TaskPriority, TaskScope, TaskStatus } from "@prisma/client";

export interface DashboardTaskDeliverableDto {
  id: string;
  name: string;
  url: string;
  fileType: string;
  submittedAt: string;
}

export interface DashboardSubTaskDto {
  id: string;
  title: string;
  assigneeName: string;
  status: TaskStatus;
  dueDate: string;
  internalDueDate: string;
  deliverableDescription: string;
  parentSchoolTaskId: string;
  departmentId?: string;
  departmentCode?: string;
  deliverables: DashboardTaskDeliverableDto[];
  updatedAt: string;
}

export interface DashboardSchoolTaskDto {
  id: string;
  title: string;
  category: "Chỉ đạo cấp Trường" | "Chuyên môn";
  categoryLabel: string;
  leadAssigneeName: string;
  leadAssigneeAvatar?: string;
  leadDepartment?: string;
  leadDepartmentCode?: string;
  leadDepartmentId?: string;
  coAssignees: string[];
  assignedDate: string;
  dueDate: string;
  status: TaskStatus;
  subTasks: DashboardSubTaskDto[];
  totalSubTasks: number;
  completedSubTasks: number;
  progressPercent: number;
}

export interface DashboardStatsDto {
  total: number;
  inProgress: number;
  completed: number;
  overdue: number;
  pendingApprovals: number;
  completionRate: number;
}

export interface DashboardPayload {
  tasks: DashboardSchoolTaskDto[];
  stats: DashboardStatsDto;
  monthlyTrends: Array<{ month: string; completed: number; assigned: number }>;
  departmentSummaries: Array<{
    departmentId: string;
    departmentName: string;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    onTimeRate: number;
  }>;
}

export interface DashboardErrorResponse {
  success: false;
  error: string;
  details?: string;
}
```

---

#### 3.2.5. Loại bỏ Fallback User trong Tạo Nhiệm vụ: `/api/tasks`
- **Đường dẫn tệp tuyệt đối**: `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/tasks/route.ts`
- **Hàm xử lý**: `export async function POST(request: NextRequest): Promise<NextResponse>`
- **Loại bỏ khiếm khuyết**:
  - Trước đây: Nếu không tìm thấy người tạo nhiệm vụ, hàm thực hiện truy vấn `const fallbackUser = await tx.user.findFirst(); effectiveCreatorId = fallbackUser.id;`.
  - Quy chuẩn mới: Bắt buộc lấy `session.id` từ Cookie hoặc Bearer Token. Nếu tài khoản trong phiên không tồn tại trong cơ sở dữ liệu, giao dịch rollback lập tức và trả về mã lỗi `401 Unauthorized` hoặc `400 Bad Request` ("Người tạo nhiệm vụ không hợp lệ trong hệ thống").

- **Hợp đồng Dữ liệu (Strict TypeScript Types)**:
```typescript
export interface CreateTaskRequestBody {
  title: string;
  description?: string;
  departmentId: string;
  dueDate: string;
  startDate?: string;
  priority?: "URGENT" | "HIGH" | "NORMAL" | "LOW";
  scope?: "SCHOOL" | "DEPARTMENT" | "INDIVIDUAL";
  academicMonth?: number;
  academicYear?: string;
  assigneeId?: string;
}

export type CreateTaskResponse =
  | {
      success: true;
      task: {
        id: string;
        code: string;
        title: string;
        departmentId: string | null;
        dueDate: string;
        status: TaskStatus;
        createdById: string;
      };
    }
  | {
      success: false;
      error: string;
    };
```

---

#### 3.2.6. Loại bỏ Fallback Leader trong Chỉ đạo Văn bản: `/api/documents/[id]/directives`
- **Đường dẫn tệp tuyệt đối**: `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/documents/[id]/directives/route.ts`
- **Hàm xử lý**: `export async function POST(request: NextRequest, context: RouteContext): Promise<NextResponse>`
- **Loại bỏ khiếm khuyết**:
  - Trước đây: Nếu `leaderId` không tìm thấy, hệ thống tự động gán `fallbackLeader = await prisma.user.findFirst({ where: { role: "BAN_GIAM_HIEU" } })`.
  - Quy chuẩn mới: Kiểm tra quyền hạn trực tiếp từ phiên đăng nhập. Người thực hiện chỉ đạo bắt buộc phải có vai trò `BAN_GIAM_HIEU` hoặc `ADMIN`. Nếu `leaderId` không hợp lệ hoặc người dùng không mang vai trò lãnh đạo, trả về mã lỗi `403 Forbidden` ("Chỉ Ban Giám hiệu mới có thẩm quyền ban hành ý kiến chỉ đạo văn bản").

---

## MỤC 4: ĐẶC TẢ CƠ SỞ DỮ LIỆU PRISMA & DỮ LIỆU KHỞI TẠO (PRISMA SCHEMA & SEED SPECIFICATION)

### 4.1. Chuẩn hóa Lược đồ Dữ liệu Prisma: `prisma/schema.prisma`
- **Đường dẫn tệp tuyệt đối**: `/Users/dnhhuy/Projects/QCET/QCET Work/prisma/schema.prisma`
- **Mục tiêu cấu trúc**: Chuẩn hóa quan hệ toàn vẹn giữa `User` và `Department`, định nghĩa rõ ràng các ràng buộc dữ liệu, khóa chính, khóa ngoại, kiểu dữ liệu PostgreSQL nguyên bản và chỉ mục tìm kiếm (Indexes).

#### 4.1.1. Chuẩn hóa Quan hệ User - Department
1. Một Đơn vị (`Department`) có nhiều Người dùng (`User`).
2. Một Người dùng (`User`) trực thuộc đúng một Đơn vị (`departmentId`) thông qua quan hệ Khóa ngoại `Department.id` với `onDelete: SetNull` hoặc `onDelete: Restrict`.
3. Khóa chính của bảng `departments` là chuỗi mã hóa chuẩn kebab-case hoặc ký tự viết tắt quy chuẩn (ví dụ: `ban-giam-hieu`, `phong-dao-tao`, `khoa-cntt`), kiểu `VarChar(50)`.
4. Trường `departmentId` trong bảng `users` tham chiếu trực tiếp đến `Department.id`.

#### 4.1.2. Trích xuất Schema Chuẩn hóa Tường minh
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  BAN_GIAM_HIEU
  TRUONG_PHONG
  CHUYEN_VIEN
  VAN_THU
  ADMIN
}

enum TaskScope {
  SCHOOL
  DEPARTMENT
  INDIVIDUAL
}

enum TaskStatus {
  NOT_STARTED
  IN_PROGRESS
  WAITING_APPROVAL
  COMPLETED
  OVERDUE
  CANCELLED
}

enum TaskPriority {
  URGENT
  HIGH
  NORMAL
  LOW
}

enum AssigneeRole {
  PRIMARY_OWNER
  COLLABORATOR
  SUPERVISOR
}

enum DocumentType {
  VAN_BAN_DEN
  VAN_BAN_DI
  TO_TRINH_NOI_BO
}

enum DocumentUrgency {
  THUONG
  KHAN
  THUONG_KHAN
  HOA_TOC
}

enum DocumentSecurityLevel {
  THUONG
  MAT
  TOI_MAT
  TUYET_MAT
}

enum DocumentStatus {
  CHO_PHAN_CONG
  DANG_XU_LY
  CHO_PHE_DUYET
  DA_HOAN_THANH
  LUU_THEO_DOI
}

model Department {
  id               String              @id @db.VarChar(50)
  name             String              @db.VarChar(255)
  shortName        String?             @map("short_name") @db.VarChar(50)
  color            String?             @db.VarChar(20)
  users            User[]
  tasks            Task[]
  draftingDocs     Document[]          @relation("DraftingDeptDocs")
  leadDocs         Document[]          @relation("LeadDepartmentDocs")
  directives       DocumentDirective[] @relation("DirectiveDepartments")
  createdAt        DateTime            @default(now()) @map("created_at")
  updatedAt        DateTime            @updatedAt @map("updated_at")

  @@map("departments")
}

model User {
  id                   String                @id @default(cuid())
  email                String                @unique @db.VarChar(255)
  name                 String                @db.VarChar(255)
  passwordHash         String?               @map("password_hash")
  role                 UserRole              @default(CHUYEN_VIEN)
  departmentId         String?               @map("department_id") @db.VarChar(50)
  department           Department?           @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  title                String?               @db.VarChar(150)
  phone                String?               @db.VarChar(20)
  avatarUrl            String?               @map("avatar_url")
  provider             String                @default("credentials") @db.VarChar(50)
  isActive             Boolean               @default(true) @map("is_active")
  onboardedAt          DateTime?             @map("onboarded_at")
  onboardingData       Json?                 @map("onboarding_data")
  createdAt            DateTime              @default(now()) @map("created_at")
  updatedAt            DateTime              @updatedAt @map("updated_at")

  // Quan hệ nghiệp vụ
  tasksCreated         Task[]                @relation("TaskCreatedBy")
  taskAssignees        TaskAssignee[]
  deliverablesUploaded TaskDeliverable[]     @relation("DeliverableUploadedBy")
  deliverablesReviewed TaskDeliverable[]     @relation("DeliverableReviewer")
  delegationsGranted   DacumDelegation[]     @relation("DelegationGrantor")
  delegationsReceived  DacumDelegation[]     @relation("DelegationDelegate")
  resolutionsEnacted   ExecutiveResolution[] @relation("ResolutionActor")
  leadDocs             Document[]            @relation("LeadUserDocs")
  docsRegistered       Document[]            @relation("DocRegisteredBy")
  leaderDirectives     DocumentDirective[]   @relation("LeaderDirectives")
  pushSubscriptions    PushSubscription[]
  notifications        Notification[]

  @@index([departmentId])
  @@index([role, isActive])
  @@map("users")
}

model Task {
  id              String                @id @default(cuid())
  code            String                @unique @db.VarChar(50)
  title           String                @db.VarChar(500)
  description     String?               @db.Text
  scope           TaskScope             @default(SCHOOL)
  status          TaskStatus            @default(NOT_STARTED)
  priority        TaskPriority          @default(NORMAL)
  progressPercent Int                   @default(0) @map("progress_percent")
  academicMonth   Int                   @map("academic_month")
  academicYear    String                @map("academic_year") @db.VarChar(20)
  startDate       DateTime              @default(now()) @map("start_date")
  dueDate         DateTime              @map("due_date")
  completedAt     DateTime?             @map("completed_at")
  departmentId    String?               @map("department_id") @db.VarChar(50)
  department      Department?           @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  createdById     String                @map("created_by_id")
  createdBy       User                  @relation("TaskCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  parentTaskId    String?               @map("parent_task_id")
  parentTask      Task?                 @relation("SubTasks", fields: [parentTaskId], references: [id], onDelete: Cascade)
  subTasks        Task[]                @relation("SubTasks")
  assignees       TaskAssignee[]
  deliverables    TaskDeliverable[]
  delegations     DacumDelegation[]
  resolutions     ExecutiveResolution[]
  linkedDocument  Document?
  createdAt       DateTime              @default(now()) @map("created_at")
  updatedAt       DateTime              @updatedAt @map("updated_at")

  @@index([departmentId, academicYear, academicMonth])
  @@index([status, dueDate])
  @@index([scope, priority])
  @@map("tasks")
}

model TaskAssignee {
  id         String       @id @default(cuid())
  taskId     String       @map("task_id")
  userId     String       @map("user_id")
  roleInTask AssigneeRole @default(PRIMARY_OWNER) @map("role_in_task")
  assignedAt DateTime     @default(now()) @map("assigned_at")
  task       Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId, roleInTask])
  @@index([userId, roleInTask])
  @@map("task_assignees")
}
```

---

### 4.2. Đặc tả Kịch bản Nạp Dữ liệu Thực tế: `prisma/seed.ts`
- **Đường dẫn tệp tuyệt đối**: `/Users/dnhhuy/Projects/QCET/QCET Work/prisma/seed.ts`
- **Hàm xử lý chính**: `async function main(): Promise<void>`

#### 4.2.1. Yêu cầu An toàn Thông tin & Cơ chế Mã hóa Mật khẩu
1. **Tuyệt đối không lưu Plaintext Password**: Sử dụng thư viện `bcryptjs` để tạo hash với hệ số muối (salt rounds) bằng `10`.
2. **Quản lý mật khẩu qua Biến Môi trường**:
   - Khởi tạo hash từ biến môi trường `SEED_DEFAULT_PASSWORD`.
   - Nếu không có biến môi trường trong quá trình build cục bộ, sử dụng giá trị nội bộ dự phòng chuẩn `Qcet@2026` được hash trực tiếp qua `bcrypt.hashSync()`.
   - Nghiêm cấm xuất mật khẩu dạng thô ra console log hoặc lưu trữ vào client bundle.

#### 4.2.2. Danh mục 11 Đơn vị Thực tế Chuẩn hóa của QCET
Hệ thống nạp chính xác 11 đơn vị thuộc Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn vào bảng `departments` bằng phương thức `prisma.department.upsert()`:

| Mã Đơn vị (`id`) | Tên Đơn vị (`name`) | Tên viết tắt (`shortName`) | Mã màu nhận diện (`color`) |
| :--- | :--- | :--- | :--- |
| `ban-giam-hieu` | Ban Giám hiệu Nhà trường | BGH | `#1E3A8A` |
| `phong-dao-tao` | Phòng Đào tạo | P.ĐT | `#2563EB` |
| `khoa-cntt` | Khoa Công nghệ Thông tin | K.CNTT | `#0284C7` |
| `khoa-co-khi` | Khoa Cơ khí | K.CK | `#0D9488` |
| `khoa-dien` | Khoa Điện - Điện tử | K.ĐĐT | `#16A34A` |
| `khoa-oto` | Khoa Kỹ thuật Ô tô | K.ÔTÔ | `#CA8A04` |
| `phong-cthssv` | Phòng Công tác Học sinh Sinh viên | P.CTHSSV | `#EA580C` |
| `phong-qctb` | Phòng Quản trị - Thiết bị | P.QTTB | `#DC2626` |
| `phong-tckt` | Phòng Tài chính - Kế toán | P.TCKT | `#9333EA` |
| `tt-laixe` | Trung tâm Đào tạo Lái xe | TT.LX | `#4F46E5` |
| `tt-tuyensinh` | Trung tâm Tuyển sinh & Truyền thông | TT.TS | `#059669` |

*(Đồng thời duy trì cơ chế ánh xạ tương thích với các mã ký hiệu cũ: `BGH`, `CNTT`, `TCHC`, `KHTC`, `DT_QLKH` để đảm bảo tương thích ngược với các bản ghi lưu trữ lịch sử)*.

#### 4.2.3. Danh sách Nhân sự Thực tế QCET (Không Fake / Không Fallback User)
Tuyệt đối loại bỏ các tài khoản kiểm thử mang tính chất giả định như `user-admin-bgh`, `user-manager-daotao`, `user-staff-vinh`. Nạp 100% tài khoản cán bộ thực tế với vai trò tương ứng:

```typescript
export interface SeedUserData {
  email: string;
  name: string;
  role: UserRole;
  departmentId: string;
  title: string;
  phone: string;
}

export const QCET_SEED_USERS: SeedUserData[] = [
  // 1. Ban Giám hiệu Nhà trường
  {
    email: "hieutruong@qcet.edu.vn",
    name: "TS. Nguyễn Văn Hiệu (Hiệu trưởng)",
    role: UserRole.BAN_GIAM_HIEU,
    departmentId: "ban-giam-hieu",
    title: "Hiệu trưởng",
    phone: "028.3896.8641",
  },
  {
    email: "phohieutruong1@qcet.edu.vn",
    name: "ThS. Trần Thị Phó (Phó Hiệu trưởng Đào tạo)",
    role: UserRole.BAN_GIAM_HIEU,
    departmentId: "ban-giam-hieu",
    title: "Phó Hiệu trưởng",
    phone: "028.3896.8642",
  },
  {
    email: "bgh@qcet.edu.vn",
    name: "TS. Nguyễn Văn Hiệu",
    role: UserRole.BAN_GIAM_HIEU,
    departmentId: "ban-giam-hieu",
    title: "Hiệu trưởng",
    phone: "028.3896.8641",
  },
  // 2. Quản trị & Văn thư
  {
    email: "admin@qcet.edu.vn",
    name: "Quản trị hệ thống QCET",
    role: UserRole.ADMIN,
    departmentId: "ban-giam-hieu",
    title: "Quản trị viên hệ thống",
    phone: "0900.000.001",
  },
  {
    email: "vanthu@qcet.edu.vn",
    name: "CN. Nguyễn Thị Văn Thư (Văn thư trường)",
    role: UserRole.VAN_THU,
    departmentId: "ban-giam-hieu",
    title: "Cán bộ Văn thư",
    phone: "028.3896.8643",
  },
  // 3. Trưởng phòng & Giảng viên Khoa Công nghệ Thông tin
  {
    email: "truongkhoa.cntt@qcet.edu.vn",
    name: "ThS. Hoàng Công Nghệ (Trưởng khoa CNTT)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "khoa-cntt",
    title: "Trưởng khoa CNTT",
    phone: "0908.333.444",
  },
  {
    email: "cntt.lead@qcet.edu.vn",
    name: "ThS. Lê Hoàng Nam",
    role: UserRole.TRUONG_PHONG,
    departmentId: "khoa-cntt",
    title: "Phó Trưởng khoa CNTT",
    phone: "0908.123.456",
  },
  {
    email: "giangvien.cntt@qcet.edu.vn",
    name: "KS. Phan Lập Trình (Giảng viên CNTT)",
    role: UserRole.CHUYEN_VIEN,
    departmentId: "khoa-cntt",
    title: "Giảng viên CNTT",
    phone: "0912.555.666",
  },
  {
    email: "chuyenvien@qcet.edu.vn",
    name: "Kỹ sư Trần Hùng",
    role: UserRole.CHUYEN_VIEN,
    departmentId: "khoa-cntt",
    title: "Chuyên viên Kỹ thuật Phần mềm",
    phone: "0912.345.678",
  },
  // 4. Lãnh đạo các Phòng ban chuyên môn
  {
    email: "truongphong.daotao@qcet.edu.vn",
    name: "ThS. Lê Đào Tạo (Trưởng phòng ĐT)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "phong-dao-tao",
    title: "Trưởng phòng Đào tạo",
    phone: "0908.111.222",
  },
  {
    email: "truongphong.cthssv@qcet.edu.vn",
    name: "CN. Phạm Văn Sinh Viên (Trưởng phòng CTHSSV)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "phong-cthssv",
    title: "Trưởng phòng CTHSSV",
    phone: "0909.456.789",
  },
  {
    email: "truongphong.qctb@qcet.edu.vn",
    name: "KTS. Lê Quản Trị (Trưởng phòng QTTB)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "phong-qctb",
    title: "Trưởng phòng Quản trị - Thiết bị",
    phone: "0909.567.890",
  },
  {
    email: "truongphong.tckt@qcet.edu.vn",
    name: "ThS. Đỗ Tài Chính (Trưởng phòng TCKT)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "phong-tckt",
    title: "Trưởng phòng Tài chính - Kế toán",
    phone: "0909.678.901",
  },
  // 5. Lãnh đạo các Khoa Kỹ thuật & Trung tâm
  {
    email: "truongkhoa.cokhi@qcet.edu.vn",
    name: "ThS. Đinh Văn Cơ Khí (Trưởng khoa CK)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "khoa-co-khi",
    title: "Trưởng khoa Cơ khí",
    phone: "0909.123.456",
  },
  {
    email: "truongkhoa.dien@qcet.edu.vn",
    name: "ThS. Nguyễn Văn Điện (Trưởng khoa ĐĐT)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "khoa-dien",
    title: "Trưởng khoa Điện - Điện tử",
    phone: "0909.234.567",
  },
  {
    email: "truongkhoa.oto@qcet.edu.vn",
    name: "ThS. Vũ Kỹ Thuật Ôtô (Trưởng khoa Ôtô)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "khoa-oto",
    title: "Trưởng khoa Kỹ thuật Ô tô",
    phone: "0909.345.678",
  },
  {
    email: "giamdoc.ttlaixe@qcet.edu.vn",
    name: "ThS. Phạm Đào Tạo Lái Xe (GĐ TT Lái xe)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "tt-laixe",
    title: "Giám đốc Trung tâm Đào tạo Lái xe",
    phone: "0909.789.012",
  },
  {
    email: "giamdoc.tttuyensinh@qcet.edu.vn",
    name: "ThS. Nguyễn Tuyển Sinh (GĐ TT Tuyển sinh)",
    role: UserRole.TRUONG_PHONG,
    departmentId: "tt-tuyensinh",
    title: "Giám đốc TT Tuyển sinh & Truyền thông",
    phone: "0909.890.123",
  },
];
```

#### 4.2.4. Quy trình Thực thi Khởi tạo CSDL Không Lỗi Xung đột (Idempotent Seed Flow)
1. **Bước 1: Upsert Đơn vị (`Department.upsert`)**: Nạp lần lượt 11 đơn vị và 5 mã tương thích. Khóa chính `id` ngăn ngừa trùng lặp.
2. **Bước 2: Upsert Người dùng (`User.upsert`)**: Duyệt mảng `QCET_SEED_USERS`. Tìm kiếm theo trường duy nhất `email`, cập nhật tên, vai trò, chức vụ, mật khẩu băm nếu đã tồn tại, hoặc tạo mới nếu chưa có.
3. **Bước 3: Thu thập Bản đồ ID Người dùng (`userMap`)**: Lưu trữ cặp giá trị `{ [email]: id }` để cung cấp định danh người dùng chính xác cho các bước tiếp theo.
4. **Bước 4: Nạp Nhiệm vụ Học vụ Thực tế 12 Tháng**: Khởi tạo 40 nhiệm vụ cấp trường gắn với nhân sự thực tế, có đủ liên kết khóa ngoại với `Department` và `User` thông qua `createdById` và `TaskAssignee`.
5. **Bước 5: Nạp Sổ Quản lý Văn bản Nghị định 30/2020/NĐ-CP**: Nạp các văn bản đi, đến và tờ trình nội bộ thực tế kèm theo luồng xử lý và ý kiến chỉ đạo của Ban Giám hiệu thực tế.

---

### 4.3. Bảng Tổng hợp Tệp Thay đổi và Trách nhiệm Kỹ thuật

| Tệp tin thay đổi | Vị trí hàm / logic | Hành động & Trách nhiệm kỹ thuật |
| :--- | :--- | :--- |
| `src/app/api/auth/demo-session/route.ts` | Toàn bộ tệp | **Xóa bỏ vĩnh viễn**. Triệt tiêu nguy cơ tấn công bypass authentication và leo thang đặc quyền. |
| `src/app/api/auth/login/route.ts` | `POST` | Xác thực trực tiếp qua cơ sở dữ liệu và bcrypt. Trả về đúng `UserSessionDto`. |
| `src/app/api/auth/register/route.ts` | `POST` | Ràng buộc khóa ngoại `departmentId` tồn tại trong bảng `departments`. Cố định vai trò `CHUYEN_VIEN`. |
| `src/app/api/dashboard/overview/route.ts` | `GET` | Xóa logic đọc `?source=mock`. Cấu hình `dynamic = "force-dynamic"`. Trả về `DashboardPayload` rỗng chuẩn khi không có dữ liệu. |
| `src/lib/server/dashboard-service.ts` | `getLiveDashboardData()` | Đóng gói toàn bộ logic truy vấn Prisma thực tế. Vô hiệu hóa phân nhánh sang `mock-dashboard-data.ts`. |
| `src/app/api/tasks/route.ts` | `POST` | Loại bỏ việc fallback sang `prisma.user.findFirst()`. Trả lỗi 401 khi không xác thực được người tạo việc. |
| `src/app/api/documents/[id]/directives/route.ts` | `POST` | Loại bỏ fallback gán Ban Giám hiệu ảo. Xác minh quyền hạn lãnh đạo qua phiên đăng nhập. |
| `prisma/schema.prisma` | Model `Department`, `User`, `Task` | Chuẩn hóa quan hệ 1-N giữa `Department` và `User`, các chỉ mục và khóa ngoại toàn vẹn. |
| `prisma/seed.ts` | `main()` | Nạp 11 đơn vị thực tế, mã hóa mật khẩu bằng bcrypt, xóa bỏ toàn bộ mock/demo user. |

---

# ZERO-MOCKUP & REAL QCET ALIGNMENT SPECIFICATION

---

## MỤC 5: ĐẶC TẢ GIAO DIỆN NGƯỜI DÙNG & LOẠI BỎ DEV SHIMS (UI ERGONOMICS & ZERO-SHIM STANDARD)

### 5.1. Mục Tiêu & Nguyên Tắc Thiết Kế
1. **Loại bỏ toàn bộ cơ chế giả lập trong môi trường người dùng**:
   - Gỡ bỏ hoàn toàn khối chuyển vai trò thử nghiệm (`Dev Role Switcher`, `RoleSwitcherPill`, `RoleViewpointBanner`, `DEMO_USERS` dropdown) khỏi thanh điều hướng chính (`AppTopbar`), thanh menu di động (`MobileMenuDrawer`) và menu cá nhân (`Navigation`).
   - Gỡ bỏ vĩnh viễn mảng `SEED_ACCOUNTS` cùng các thẻ đăng nhập nhanh 1-Click trên trang đăng nhập (`/login`).
   - Xóa bỏ mọi văn bản thô rò rỉ mật khẩu mặc định hoặc hướng dẫn thử nghiệm không phù hợp với chuẩn bảo mật cổng thông tin hành chính công.
2. **Chuẩn hóa thông tin hiển thị định danh cán bộ thật**:
   - Dữ liệu hiển thị của người dùng (Họ và tên, Email công vụ, Đơn vị công tác, Chức danh, Vai trò hệ thống) được nạp trực tiếp và duy nhất từ phiên làm việc thực tế được lưu trữ trong cơ sở dữ liệu (PostgreSQL/Prisma).
   - Tích hợp huy hiệu xác thực định danh Google Workspace (`emailVerified`) chính chủ với biểu tượng bảo mật chuẩn hóa.
3. **Chính sách Không Dữ Liệu Ảo (Zero-Mock Fallback Policy)**:
   - Khi mất kết nối API máy chủ hoặc mất kết nối mạng, giao diện bắt buộc phải hiển thị trạng thái ngắt kết nối thực tế (`Connection Error / Network Offline Banner`), cung cấp hành động thử lại (`Retry`). Tuyệt đối cấm âm thầm chuyển đổi sang dữ liệu giả lập (mock payload/demo user) để che đậy lỗi hệ thống.

---

### 5.2. Loại Bỏ Các Dev Shims & Thành Phần Giả Lập

#### 5.2.1. Thanh Điều Hướng & Profile Menu (`AppTopbar`, `Navigation`)
- **Khối Chế độ kiểm thử vai trò (Role Switcher)**:
  - Trước đây: Chứa dropdown cho phép chuyển đổi tự do giữa `Ban Giám hiệu (ADMIN)`, `Trưởng đơn vị (MANAGER)` và `Chuyên viên (STAFF)` trực tiếp trên client thông qua việc giả mạo `switchRole()`.
  - Thay đổi chuẩn hóa: Gỡ bỏ hoàn toàn `RoleSwitcherPill` và dropdown chuyển vai trò khỏi header. `RoleSwitcherPill` trả về `null`.
  - Quyền hạn và phạm vi hiển thị (`scope`: Toàn trường, Đơn vị, Cá nhân) được tự động quyết định bởi `user.role` thực tế của phiên đăng nhập thông qua hàm phân quyền `isExecutiveUser(user)` và `isManagerUser(user)`.
- **Profile Dropdown Menu của Cán bộ**:
  - Giao diện dropdown của Avatar trên thanh Topbar chỉ chứa các chức năng nghiệp vụ hợp lệ:
    1. **Thẻ tóm tắt cán bộ (User Summary Card)**:
       - Avatar/Chữ cái đại diện: Khởi tạo từ `getInitials(user.name)`.
       - Họ tên đầy đủ kèm huy hiệu tick xanh xác thực Google Workspace (`CheckCircle2`).
       - Email công vụ dạng đơn vị hành chính (`@cdktcnqn.edu.vn`).
       - Nhãn vai trò thực tế: "Ban Giám hiệu", "Trưởng đơn vị", hoặc "Chuyên viên / Giảng viên".
       - Tên đơn vị / Phòng / Khoa trực thuộc lấy từ quan hệ CSDL `user.department.name` hoặc mã đơn vị `user.departmentCode`.
    2. **Hành động nghiệp vụ cá nhân**:
       - "Hồ sơ cán bộ" -> Mở `UserProfileModal` để xem/cập nhật số điện thoại, phòng làm việc, thông tin liên lạc nghiệp vụ.
       - "Cài đặt App Mobile (PWA)" -> Kích hoạt hướng dẫn cài đặt ứng dụng PWA độc lập trên thiết bị cá nhân.
       - "Hướng dẫn làm quen (Onboarding)" -> Kích hoạt lại luồng hướng dẫn hệ thống trực quan.
       - "Đổi tài khoản" -> Chuyển hướng về `/login`.
    3. **Hành động kết thúc phiên**:
       - "Đăng xuất" -> Gọi `POST /api/auth/logout`, hủy HTTP-only Cookie, xóa sạch session client và chuyển hướng về `/login`.

#### 5.2.2. Trang Đăng Nhập (`src/app/login/page.tsx`)
- **Loại bỏ thẻ kiểm thử CSDL hạt nhân (1-Click Demo Cards)**:
  - Gỡ bỏ hoàn toàn các button đăng nhập tắt cho các tài khoản giả định (Hiệu trưởng, Trưởng phòng Đào tạo, Chuyên viên).
  - Loại bỏ hoàn toàn hằng số `SEED_ACCOUNTS`, hàm `handleQuickSeedLogin`, và state `loadingSeedEmail`.
- **Giao diện Đăng nhập Tập trung (Focused Official Login Card)**:
  - Header: Logo trường (`/logo-qcet.png`), dòng định danh cấp trên "TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHỆ QUY NHƠN" và tên hệ thống "QCET E-Office - Hệ thống Quản lý Văn bản & Điều hành".
  - Thẻ đăng nhập trung tâm:
    - Tiêu đề: "Đăng nhập hệ thống".
    - Mô tả: "Hệ thống làm việc và điều hành văn bản điện tử dành cho Cán bộ, Giảng viên & Nhân viên Nhà trường."
    - Nút đăng nhập duy nhất chuẩn hóa: `GoogleLoginButton` tích hợp Google Workspace SSO với chính sách hạn chế tên miền `@cdktcnqn.edu.vn`.
    - Dòng thông tin định danh: "Áp dụng cho tài khoản email @cdktcnqn.edu.vn".
    - Nhãn bảo mật hành chính: "Hệ thống bảo mật sử dụng tài khoản email chính thức của Nhà trường" kèm biểu tượng `ShieldCheck`.
  - Footer: Thông tin bản quyền, phiên bản hệ thống và hotline hỗ trợ kỹ thuật Trung tâm CNTT & Quản trị mạng.

#### 5.2.3. Ngăn Điều Hướng Di Động (`MobileMenuDrawer`)
- Gỡ bỏ triệt để danh sách `DEMO_USERS` và khối "Chuyển vai trò trải nghiệm".
- Chân drawer chỉ hiển thị định danh của cán bộ đang đăng nhập kèm nút "Đăng xuất" bảo mật.

---

### 5.3. Cấu Trúc Cây Thành Phần Chuẩn Hóa (Component Tree Specification)

```
src/app/layout.tsx (RootLayout - Light-Only, Inter & JetBrains Mono)
└── AuthProvider (Quản lý trạng thái xác thực thực tế)
    ├── AppTopbar (Thanh tiêu đề chính công sở)
    │   ├── LeftZone
    │   │   ├── SidebarCollapseToggle (Chỉ hiển thị trên Desktop >= 768px)
    │   │   ├── TopbarBreadcrumbs (Điều hướng ngữ cảnh trang động)
    │   │   └── ScopeSwitcher (Bộ chuyển đổi góc nhìn điều hành - Ẩn đối với Chuyên viên)
    │   └── RightZone
    │       ├── CreateTaskButton (Mở CreateTaskModal với danh sách cán bộ thật từ CSDL)
    │       ├── NotificationBell (NotificationPopover nạp thông báo thật từ /api/notifications)
    │       └── UserProfileSection
    │           ├── [Trường hợp chưa đăng nhập]: Link -> /login
    │           └── [Trường hợp đã xác thực]: ProfileDropdownTrigger
    │               └── ProfileDropdownMenu (Glassmorphic Card)
    │                   ├── UserSummaryCard (Avatar, Tên thật, Email công vụ, Vai trò, Đơn vị)
    │                   ├── PrimaryActions
    │                   │   ├── SettingsButton -> UserProfileModal
    │                   │   ├── PwaInstallButton -> InstallPromptModal
    │                   │   ├── OnboardingTourButton -> useOnboarding.restartTour()
    │                   │   └── SwitchAccountLink -> /login
    │                   └── LogoutButton -> AuthContext.logout()
    ├── AppSidebar (Thanh menu điều hướng trái)
    ├── MainContent (Vùng nội dung trang làm việc)
    │   └── UnifiedAdaptiveWorkspace (Không gian làm việc thống nhất theo vai trò thực tế)
    │       ├── AdaptiveScopeHeader (Tiêu đề góc nhìn, Tabs chuyển đổi Toàn trường / Đơn vị / Cá nhân)
    │       ├── AdaptiveMetricStrip (Chỉ số KPI điều hành tính toán từ CSDL thực tế)
    │       ├── UniversalActionQueue (Hàng đợi công việc khẩn cấp, trình duyệt ký số)
    │       └── CascadingTaskTable (Bảng nhiệm vụ phân cấp)
    ├── AppBottomNav (Thanh điều hướng cố định chân màn hình di động)
    ├── WelcomeModal (Modal chào mừng cán bộ mới lần đầu đăng nhập)
    └── OnboardingChecklistWidget (Widget theo dõi tiến độ hòa nhập hệ thống)
```

---

### 5.4. Đặc Tả UX Khi Mất Kết Nối Backend (Zero-Mock Error Handling)

Khi xảy ra lỗi mạng, máy chủ gián đoạn dịch vụ hoặc API trả về lỗi (HTTP 500/502/503/504 hoặc Network Offline):

1. **Nguyên tắc cốt lõi**:
   - Tuyệt đối **không** chuyển đổi `user` sang `DEFAULT_DEMO_USERS[0]`.
   - Tuyệt đối **không** nạp `getMockDashboardPayload()` hay bất kỳ fixture giả nào vào giao diện người dùng.
2. **UX Trạng thái tải (Loading State)**:
   - Trong thời gian chờ phản hồi từ `/api/auth/me` hoặc `/api/workspace/data`, hiển thị `Skeleton Loading` chính xác theo tỷ lệ hình học 1:1 của các thẻ thành phần nhằm ngăn chặn hiện tượng giật cục giao diện (Cumulative Layout Shift - CLS = 0).
3. **UX Trạng thái Mất kết nối (Backend Connection Failure State)**:
   - Hiển thị thông báo trạng thái ngoại tuyến (`Offline Alert Banner`) tại đầu màn hình:
     - Biểu tượng: `AlertCircle` (màu đỏ mờ chuẩn hành chính `text-destructive`).
     - Tiêu đề: "Không thể kết nối đến Máy chủ Điều hành QCET".
     - Nội dung chi tiết: "Hệ thống không thể tải dữ liệu thực tế từ máy chủ. Vui lòng kiểm tra kết nối mạng nội bộ hoặc liên hệ Quản trị mạng Nhà trường (Ext: 104)."
     - Nút hành động: "Thử lại kết nối" (`Retry Button`) với vòng quay nạp lại (`Loader2 animate-spin`) khi kích hoạt.
4. **Trạng thái Thẻ rỗng (Empty State)**:
   - Nếu kết nối thành công nhưng cơ sở dữ liệu chưa có bản ghi (ví dụ: Cán bộ mới chưa được giao việc): Hiển thị hình minh họa trạng thái trống tối giản (`EmptyState`), tiêu đề: "Không có nhiệm vụ phát sinh trong phạm vi này", đi kèm hướng dẫn tạo nhiệm vụ mới hoặc liên hệ Trưởng đơn vị để nhận phân công.

---

## MỤC 6: ĐẶC TẢ LUỒNG XÁC THỰC THỰC TẾ (REAL AUTHENTICATION ARCHITECTURE)

### 6.1. Kiến Trúc Xác Thực Tổng Thể

```
+-----------------------------------------------------------------------------------------+
|                                    TRÌNH DUYỆT CLIENT                                   |
|                                                                                         |
|  [ Đăng nhập Google SSO ]            [ Cookie: qcet_token (HttpOnly, SameSite=Lax) ]    |
|             |                                                  |                        |
|             v                                                  v                        |
|   GET /api/auth/google                              GET /api/auth/me                    |
+-------------|--------------------------------------------------|------------------------+
              |                                                  |
+-------------v--------------------------------------------------v------------------------+
|                                 NEXT.JS API BACKEND (EDGE/NODE)                         |
|                                                                                         |
|  1. Sinh CSRF State -> Lưu Cookie qcet_oauth_state                                     |
|  2. Chuyển hướng Google Accounts OAuth2 Consent Screen                                  |
|  3. Callback: /api/auth/callback/google                                                 |
|     ├── Kiểm tra State Cookie chống tấn công CSRF                                       |
|     ├── Đổi Code lấy Google ID & Access Tokens                                          |
|     ├── Xác thực Domain: Chỉ chấp nhận @cdktcnqn.edu.vn                                 |
|     └── Atomic Prisma Transaction:                                                      |
|         ├── Tra cứu hoặc khởi tạo User trong CSDL                                       |
|         ├── Liên kết bản ghi Account (provider='google')                                |
|         └── Ký JWT Token (RS256/HS256) chứa UserId, Role, DepartmentId                  |
|  4. Cấp Cookie: qcet_token (HttpOnly, Secure, SameSite=Lax, Max-Age=7 ngày)             |
|                                                                                         |
|  5. GET /api/auth/me:                                                                   |
|     ├── Giải mã qcet_token bằng khóa bí mật JWT_SECRET                                  |
|     ├── Tra cứu bản ghi User & Department thực tế trong CSDL                            |
|     └── Trả về AuthUser (id, email, name, role, department, onboardedAt)                |
+-----------------------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------------------+
|                                 CƠ SỞ DỮ LIỆU POSTGRESQL / PRISMA                       |
|                                                                                         |
|  Table: User (id, email, name, role, departmentId, title, avatarUrl, onboardedAt, ...)  |
|  Table: Account (id, userId, provider='google', providerAccountId, ...)                 |
|  Table: Department (id, name, shortName, code, ...)                                     |
+-----------------------------------------------------------------------------------------+
```

---

### 6.2. Đặc Tả Client AuthContext (`src/lib/auth-context.tsx`)

#### 6.2.1. Trạng Thái Khởi Tạo & Vòng Đời Phiên Làm Việc
1. **Khởi tạo An toàn (Zero-Mock Initialization)**:
   - State khởi tạo mặc định: `user = null`, `isLoading = true`, `isProfileModalOpen = false`.
   - Tuyệt đối cấm gán mặc định `DEFAULT_DEMO_USERS[0]` khi client vừa nạp.
2. **Tiến trình Đồng bộ Phiên (`syncSession`)**:
   - Khi `AuthProvider` mount, kích hoạt yêu cầu kiểm tra phiên thực tế:
     ```typescript
     const res = await fetch("/api/auth/me", { method: "GET" });
     ```
   - Nếu `res.ok` và phản hồi có `authenticated === true`:
     - Chuyển đổi dữ liệu CSDL sang cấu trúc `AuthUser` thông qua `mapDbUserToAuthUser(data.user)`.
     - Cập nhật state `user`, đồng bộ bản sao lưu tạm thời vào `localStorage(AUTH_STORAGE_KEY)`.
     - Cập nhật `isLoading = false`.
   - Nếu `authenticated === false` hoặc mã lỗi `401 Unauthorized`:
     - Xóa dữ liệu tạm trong `localStorage(AUTH_STORAGE_KEY)`.
     - Cập nhật state `user = null`.
     - Cập nhật `isLoading = false`.
   - Nếu xảy ra lỗi kết nối mạng (Network Error / Offline):
     - Ghi nhận cảnh báo lỗi kết nối máy chủ.
     - Kiểm tra nếu trong `localStorage` có chứa đối tượng `AuthUser` hợp lệ của phiên trước: Tạm thời cho phép xem thông tin ngoại tuyến, nhưng **bật cờ cảnh báo trạng thái mất kết nối**.
     - Nếu không có dữ liệu hợp lệ: Giữ `user = null`, `isLoading = false`. Không tự ý chuyển vai trò ảo.

#### 6.2.2. Giao Thức Đăng Nhập & Đăng Xuất
- **Hàm `login(email, password)`**:
  - Gửi payload tới `POST /api/auth/login`.
  - Nếu thành công: Cập nhật `user`, lưu `localStorage`, chuyển hướng người dùng vào `/dashboard` hoặc URL callback an toàn.
  - Nếu thất bại: Trả về thông báo lỗi thực tế từ backend (ví dụ: "Tài khoản hoặc mật khẩu không chính xác", "Tài khoản đã bị vô hiệu hóa").
- **Hàm `logout()`**:
  - Gửi yêu cầu tới `POST /api/auth/logout` để backend hủy Cookie `qcet_token` (set `Max-Age=0`).
  - Xóa toàn bộ khóa `qcet_active_user`, `qcet_onboarding_*` khỏi `localStorage`.
  - Đặt state `user = null`.
  - Điều hướng trình duyệt về `/login`.

---

### 6.3. Đặc Tả Phiên Làm Việc Cookie JWT Thực Tế (Real JWT Cookie Session)

1. **Cấu Hình Cookie Tiêu Chuẩn Cơ Quan Nhà Nước**:
   - **Tên Cookie**: `qcet_token` (được định nghĩa qua hằng số `SESSION_COOKIE_NAME`).
   - **Thuộc tính Bảo mật**:
     - `HttpOnly: true` — Ngăn chặn mã độc JavaScript phía client truy cập token nhằm triệt tiêu nguy cơ tấn công XSS đánh cắp phiên.
     - `Secure: true` trên môi trường Production (hoạt động bắt buộc qua giao thức HTTPS).
     - `SameSite: "lax"` — Cân bằng giữa khả năng bảo vệ chống tấn công CSRF và cho phép chuyển hướng sau xác thực Google SSO.
     - `Path: "/"` — Áp dụng toàn bộ hệ thống cổng thông tin.
     - `Max-Age: 604800` (7 ngày) — Thời hạn hợp lệ của phiên làm việc.
2. **Cấu Trúc Payload của JWT Token**:
   ```json
   {
     "id": "cly1234567890abcdef",
     "email": "hieu.nv@cdktcnqn.edu.vn",
     "name": "TS. Nguyễn Văn Hiệu",
     "role": "ADMIN",
     "departmentId": "BGH",
     "iat": 1725796800,
     "exp": 1726401600
   }
   ```
3. **Ký & Xác Minh Token (`src/lib/jwt-session.ts`)**:
   - Khóa bí mật: `JWT_SECRET` được cấu hình qua biến môi trường bí mật của server, độ dài tối thiểu 256-bit.
   - Thuật toán ký: HMAC-SHA256 (`HS256`).
   - Mọi yêu cầu truy vấn dữ liệu nhạy cảm tại middleware hoặc API routes đều được kiểm tra tính hợp lệ và thời hạn sống của token qua `verifySessionToken(token)`. Nếu không hợp lệ, hệ thống từ chối truy cập ngay tại cổng API (HTTP 401).

---

### 6.4. Đặc Tả Xác Thực Google Workspace SSO (OAuth2 / OIDC)

#### 6.4.1. Khởi Tạo Đăng Nhập (`GET /api/auth/google`)
1. Sinh mã chống giả mạo yêu cầu ngẫu nhiên: `state = crypto.randomUUID()`.
2. Thiết lập cookie tạm thời `qcet_oauth_state` với `HttpOnly: true`, `SameSite: "lax"`, `Max-Age: 300` (5 phút), `Path: "/api/auth"`.
3. Xây dựng URL xác thực Google với các tham số chuẩn OIDC:
   - `client_id`: Lấy từ `process.env.GOOGLE_CLIENT_ID`.
   - `redirect_uri`: `${baseUrl}/api/auth/callback/google`.
   - `response_type`: `code`.
   - `scope`: `openid email profile`.
   - `state`: Mã UUID vừa sinh.
   - `hd`: `cdktcnqn.edu.vn` (gợi ý bộ chọn tài khoản Google chỉ hiển thị email thuộc tổ chức).
   - `prompt`: `select_account`.
4. Chuyển hướng trình duyệt sang hệ thống xác thực Google.

#### 6.4.2. Tiếp Nhận Callback & Kiểm Tra Ràng Buộc Tên Miền (`GET /api/auth/callback/google`)
1. **Kiểm tra Lỗi & Hủy bỏ**: Nếu Google trả về `error`, lập tức chuyển hướng về `/login?error=oauth_cancelled`.
2. **Kiểm tra CSRF State**: So khớp tham số `state` nhận được từ URL với giá trị lưu trong cookie `qcet_oauth_state`. Nếu không khớp hoặc thiếu, lập tức từ chối với `/login?error=oauth_state_invalid`.
3. **Trao đổi Token (Token Exchange)**: Gửi mã `code` qua kênh bảo mật server-to-server tới `https://oauth2.googleapis.com/token` để nhận `access_token` và `id_token`.
4. **Truy vấn Thông tin Cán bộ**: Gửi `access_token` tới `https://www.googleapis.com/oauth2/v2/userinfo` để nhận hồ sơ gồm `email`, `email_verified`, `name`, `picture`, `hd`.
5. **Cơ chế Kiểm soát Tên Miền Kép (Dual-Layer Domain Restriction)**:
   - Hệ thống kiểm tra: `googleUser.email_verified === true` VÀ địa chỉ email kết thúc bằng tên miền được cấp phép (`@cdktcnqn.edu.vn`).
   - Nếu người dùng cố ý dùng Gmail cá nhân (`@gmail.com`) hoặc email ngoài đơn vị:
     - Lập tức hủy bỏ phiên làm việc.
     - Chuyển hướng về `/login?error=domain_not_allowed&email=...`.
     - Trang đăng nhập hiển thị thông báo cảnh báo màu hổ phách: "Địa chỉ email không thuộc phạm vi quản lý của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn. Vui lòng sử dụng email công vụ @cdktcnqn.edu.vn."
6. **Đồng Bộ Dữ Liệu Thực Tế Trong CSDL (Atomic Transaction)**:
   - Tìm kiếm người dùng theo `email` trong bảng `User`.
   - Nếu đã tồn tại: Cập nhật `avatarUrl` mới nhất từ Google, đồng thời liên kết bản ghi `Account` nếu chưa có.
   - Nếu chưa tồn tại (Cán bộ mới đăng nhập lần đầu):
     - Tự động phân loại đơn vị và vai trò khởi tạo dựa trên quy chuẩn email hoặc gán vai trò mặc định `STAFF`.
     - Tạo bản ghi mới trong bảng `User` với `onboardedAt = null` (đánh dấu cần tham gia quy trình làm quen hệ thống).
     - Tạo bản ghi trong bảng `Account` liên kết tài khoản Google ID.
7. **Cấp Phiên Làm Việc & Chuyển Hướng**:
   - Ký `qcet_token` và gắn vào Set-Cookie.
   - Xóa bỏ cookie tạm `qcet_oauth_state`.
   - Chuyển hướng người dùng về `/dashboard`.

---

### 6.5. Đồng Bộ Trạng Thái Onboarding & Không Gian Làm Việc (Workspace Synchronization)

#### 6.5.1. Cơ Chế Lưu Trữ Trạng Thái Onboarding
1. **Lưu trữ CSDL chuẩn chân lý (Single Source of Truth)**:
   - Cột `onboardedAt: DateTime?` trong bảng `User`: Đánh dấu thời điểm hoàn thành quy trình làm quen hệ thống.
   - Cột `onboardingData: Json?` trong bảng `User`: Lưu trữ chi tiết tiến độ các bước:
     ```json
     {
       "checklist": {
         "profile_completed": true,
         "tour_completed": true,
         "first_task_reviewed": false,
         "notification_configured": true
       },
       "completedSteps": [1, 2, 3],
       "dismissedWelcome": true,
       "lastActiveAt": "2026-09-08T08:30:00.000Z"
     }
     ```
2. **Đồng bộ Đa tầng tại Client (`useOnboarding` Hook)**:
   - Mỗi người dùng sở hữu không gian lưu trữ riêng biệt tại client theo định dạng `qcet_onboarding_user_<userId>` để ngăn chặn rò rỉ dữ liệu khi nhiều người dùng sử dụng chung một trình duyệt.
   - Khi `user.onboardedAt !== null`, hệ thống ghi nhận cán bộ đã hoàn tất và tự động ẩn các modal hướng dẫn.
   - Khi cán bộ thực hiện thao tác trên `OnboardingChecklistWidget`, tiến độ được lưu vào `localStorage` và tự động gửi cập nhật ngầm tới `POST /api/users/onboarding`.

#### 6.5.2. Điều Hướng Không Gian Làm Việc Theo Vai Trò Thực Tế
Sau khi xác thực và nạp thông tin cán bộ thành công, thành phần trung tâm `UnifiedAdaptiveWorkspace` sẽ tự động định hình không gian làm việc mà không cần bất kỳ thao tác chuyển vai trò thủ công nào:

1. **Vai trò Ban Giám hiệu (`ADMIN` / `isExecutiveUser(user) = true`)**:
   - **Phạm vi mặc định (`defaultScope`)**: `school` (Toàn trường).
   - **Chỉ số điều hành (`AdaptiveMetricStrip`)**: Tổng quan tiến độ văn bản toàn trường, tỷ lệ trễ hạn các khoa/phòng, chỉ số xử lý hồ sơ hành chính công, danh sách việc cần BGH phê duyệt.
   - **Hàng đợi hành động (`UniversalActionQueue`)**: Các hồ sơ trình ký cấp trường, văn bản đến cần phân công chỉ đạo, kế hoạch tháng cần phê duyệt.
2. **Vai trò Trưởng đơn vị / Trưởng khoa / Trưởng phòng (`MANAGER` / `isManagerUser(user) = true`)**:
   - **Phạm vi mặc định (`defaultScope`)**: `unit` (Đơn vị).
   - **Chỉ số điều hành**: Tỷ lệ hoàn thành công việc của các chuyên viên/giảng viên trong đơn vị, số lượng nhiệm vụ đến hạn trong tuần, các công việc do BGH giao cho đơn vị.
   - **Hàng đợi hành động**: Phê duyệt báo cáo nhiệm vụ của viên chức trực thuộc, phân công chuyên viên chủ trì văn bản mới.
3. **Vai trò Chuyên viên / Giảng viên (`STAFF`)**:
   - **Phạm vi mặc định (`defaultScope`)**: `my` (Cá nhân tôi).
   - **Chỉ số điều hành**: Nhiệm vụ cá nhân đang thực hiện, việc cần nộp báo cáo kết quả, thông báo mới liên quan.
   - **Hàng đợi hành động**: Nộp minh chứng/kết quả thực hiện nhiệm vụ, xác nhận đã đọc văn bản thông báo.
   - **Phân quyền UX**: Tự động ẩn hoàn toàn `ScopeSwitcher` trên Topbar, cố định góc nhìn cá nhân nhằm tối ưu hóa sự tập trung và giảm tải áp lực nhận thức cho chuyên viên.

---

### 6.6. Xử Lý Lỗi Xác Thực & Mất Kết Nối Máy Chủ (Real-World Error Handling)

1. **Phiên Hết Hạn (Session Expired / Token Invalid)**:
   - Khi gọi bất kỳ API bảo vệ nào nhận về mã trạng thái `401 Unauthorized`:
     - Client xóa toàn bộ khóa lưu trữ cục bộ `AUTH_STORAGE_KEY`.
     - Không chuyển đổi sang chế độ demo.
     - Hiển thị Toast thông báo: "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại."
     - Tự động chuyển hướng về `/login?redirect=${encodeURIComponent(currentPath)}`.
2. **Mất Kết Nối Cơ Sở Dữ Liệu / Máy Chủ (Backend Downtime / 503 Service Unavailable)**:
   - Khi API `/api/auth/me` hoặc API nghiệp vụ gặp lỗi mạng:
     - `AuthContext` cập nhật cờ `isOffline = true`.
     - Giữ nguyên trạng thái xác thực cuối cùng đã biết (nếu có trong bộ nhớ an toàn), nhưng hiển thị thanh cảnh báo ngoại vi: "Cảnh báo: Đang mất kết nối với CSDL QCET. Dữ liệu thay đổi sẽ không được lưu cho đến khi có kết nối trở lại."
     - Cung cấp nút bấm "Kết nối lại ngay" để gọi lại endpoint `/api/auth/me`.
     - Tuyệt đối không xóa tài khoản người dùng thật để nạp tài khoản demo.
3. **Cán Bộ Bị Vô Hiệu Hóa Quyền Truy Cập (`isActive === false`)**:
   - Khi cán bộ chuyển công tác hoặc tài khoản bị tạm khóa trong CSDL:
     - Backend `/api/auth/me` trả về `{ authenticated: false, user: null }`.
     - API `/api/auth/login` trả về mã lỗi `{ success: false, error: "Tài khoản cán bộ đã bị tạm khóa. Vui lòng liên hệ Phòng Tổ chức - Hành chính." }`.
     - Giao diện hiển thị cảnh báo từ chối truy cập rõ ràng và chấm dứt phiên ngay lập tức.

---

## 7. KẾ HOẠCH DI CHUYỂN & TRIỂN KHAI TỪNG BƯỚC (MIGRATION ROADMAP)

### 7.1. Bối cảnh Nhánh & Điểm Xuất Phát (Branch Baseline)
- **Nhánh triển khai chính**: `feat/dacum-role-delegation-workflow` tại thư mục `/Users/dnhhuy/Projects/QCET/QCET Work`.
- **Nhánh đích (Target Base)**: `main`.
- **Mục tiêu di chuyển**: Chuyển đổi toàn diện hệ thống sang mô hình **Database-First 100% & Zero-Mockup Runtime**, chấm dứt việc nhúng thông tin đăng nhập cứng (hardcoded credentials), cô lập toàn bộ dữ liệu kiểm thử sang thư mục test độc lập, chuẩn hóa cơ cấu tổ chức QCET thực tế, và đồng bộ giao diện làm việc thích ứng (Unified Adaptive Workspace) theo đúng Engineering Rules tại `/Users/dnhhuy/Projects/QCET/QCET Work/CLAUDE.md`.

---

### 7.2. Lộ Trình Triển Khai 5 Giai Đoạn (5-Phase Execution Plan)

#### Giai đoạn 1: Cô Lập Dữ Liệu Kiểm Thử & Chuẩn Hóa Schema CSDL (Database & Fixtures Isolation)
1. **Thiết lập Fixture kiểm thử độc lập**:
   - Khởi tạo `/Users/dnhhuy/Projects/QCET/QCET Work/tests/fixtures/dashboard-fixtures.ts` và `/Users/dnhhuy/Projects/QCET/QCET Work/tests/fixtures/document-fixtures.ts`.
   - Di chuyển toàn bộ cấu trúc dữ liệu mẫu từ runtime sang hai tệp fixture này để phục vụ độc quyền cho các bài kiểm tra tự động.
2. **Cập nhật ánh xạ import trong bộ kiểm thử**:
   - Rà soát toàn bộ các tệp kiểm thử tại `/Users/dnhhuy/Projects/QCET/QCET Work/tests/`, cập nhật đường dẫn import dữ liệu giả lập từ `@/lib/mock-dashboard-data` và `@/lib/mock-document-data` sang `@/tests/fixtures/*`.
3. **Chuẩn hóa dữ liệu hạt nhân CSDL QCET**:
   - Cập nhật `/Users/dnhhuy/Projects/QCET/QCET Work/prisma/seed.ts` nhằm loại bỏ triệt để nhóm 3 tài khoản demo kiểm thử tĩnh (`user-admin-bgh`, `user-manager-daotao`, `user-staff-vinh`) có mật khẩu lộ lọt.
   - Đồng bộ danh mục 11 phòng, khoa, trung tâm thực tế của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn cùng các chức danh lãnh đạo, chuyên viên chính ngạch.

#### Giai đoạn 2: Cắt Bỏ Hoàn Toàn Mock Runtime & Xác Thực Lỏng Lẻo (Zero-Mock Runtime & Auth Hardening)
1. **Thanh lọc trang Đăng nhập (`/Users/dnhhuy/Projects/QCET/QCET Work/src/app/login/page.tsx`)**:
   - Gỡ bỏ hoàn toàn mảng `SEED_ACCOUNTS`, hàm `handleQuickSeedLogin`, state `loadingSeedEmail`, và toàn bộ khối giao diện `Tài khoản kiểm thử CSDL hạt nhân (1-Click)`.
   - Giữ lại form đăng nhập chính quy (Email công vụ `@qcet.edu.vn` + Mật khẩu mã hóa bcrypt) và nút tích hợp Google Workspace SSO.
2. **Chuẩn hóa thông điệp trợ giúp (`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/google-login-button.tsx`)**:
   - Xóa bỏ toàn bộ nội dung chứa mật khẩu văn bản thô `Qcet@2026` hoặc hướng dẫn click tài khoản kiểm thử.
   - Thay thế bằng hướng dẫn chuẩn: Cán bộ sử dụng tài khoản email công vụ được cấp bởi Ban Giám hiệu hoặc liên hệ Bộ phận Quản trị mạng & CNTT.
3. **Triệt tiêu Auto-Login Demo trong Context (`/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/auth-context.tsx`)**:
   - Xóa bỏ cơ chế tự động nạp `DEFAULT_DEMO_USERS[0]` khi phiên làm việc chưa xác thực.
   - Trạng thái chưa đăng nhập trả về `user = null` và chuyển hướng chuẩn xác về `/login`.
4. **Xóa vĩnh viễn tệp Mock khỏi Runtime**:
   - Xóa bỏ `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/mock-dashboard-data.ts`.
   - Xóa bỏ `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/mock-document-data.ts`.

#### Giai đoạn 3: Chuyển Đổi Nguồn Dữ Liệu Các Bàn Làm Việc (Database-Driven Endpoints)
1. **Trực tiếp hóa API Người dùng**:
   - Cung cấp endpoint `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/users/route.ts` truy vấn trực tiếp từ bảng `User` và `Department` qua Prisma Client.
2. **Chuyển đổi Modal Tạo việc & Trung tâm Thông báo**:
   - `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/dashboard/create-task-modal.tsx`: Thay thế danh sách nhân sự tĩnh bằng kết quả fetch từ `/api/users`.
   - `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/notifications/notification-popover.tsx` và `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/notifications/page.tsx`: Nạp dữ liệu thực tế từ `/api/notifications`.
3. **Tích hợp Skeleton Loading & Xử lý Lỗi Kết nối**:
   - Các trang `/dashboard`, `/tasks`, `/unit-tasks` khởi tạo với `payload = null` và `isLoading = true`.
   - Hiển thị Skeleton hiệu ứng `animate-pulse` với token `bg-muted/60` trong khi chờ CSDL; hiển thị Error Alert kèm nút Retry khi xảy ra sự cố mạng, tuyệt đối không tráo dữ liệu giả.

#### Giai đoạn 4: Hợp Nhất Không Gian Làm Việc Thích Ứng (Unified Adaptive Workspace Integration)
1. **Thiết lập Single Canvas**:
   - Hoàn thiện `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/unified-adaptive-workspace.tsx` kết hợp cùng `AdaptiveScopeHeader`, `AdaptiveMetricStrip`, và `UniversalActionQueue`.
2. **Chuyển đổi các Portal cũ thành Thin Adapters**:
   - `ExecutiveCockpitWorkspace.tsx`, `DepartmentManagerWorkspace.tsx`, `LecturerFocusWorkspace.tsx` chỉ đóng vai trò wrapper chuyển tiếp props vào `UnifiedAdaptiveWorkspace` với `initialScope` tương ứng.
3. **Thay thế điểm nhúng trung tâm**:
   - Cập nhật `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/dashboard/zones/tasks-focus-landing.tsx` để hiển thị trực tiếp `UnifiedAdaptiveWorkspace`, loại bỏ logic rẽ nhánh component cồng kềnh.

#### Giai đoạn 5: Kiểm Soát Xung Đột Cache Dev & Nghiệm Thu Sản Phẩm
1. **Thực thi quy trình kiểm tra tĩnh**: Chạy `npm run typecheck` (`tsc --noEmit`) đạt 0 lỗi biên dịch.
2. **Thực thi bộ kiểm thử tự động**: Chạy `npm test` (`tsx --test tests/**/*.test.ts`) đạt 100% test suites pass.
3. **Thẩm định giao diện Light-Only & Mobile PWA**: Kiểm tra visual layout trên cổng dev theo đúng quy chuẩn kỹ thuật.

---

### 7.3. Thứ Tự Cam Kết Mã Nguồn (Structured Commit Sequence)

Mỗi bước thay đổi phải được đóng gói thành các commit nguyên tử (atomic commits) tuân thủ quy chuẩn Conventional Commits:

1. `test(fixtures): isolate test data from runtime src to tests/fixtures`
   - Tạo `/Users/dnhhuy/Projects/QCET/QCET Work/tests/fixtures/dashboard-fixtures.ts`.
   - Tạo `/Users/dnhhuy/Projects/QCET/QCET Work/tests/fixtures/document-fixtures.ts`.
   - Cập nhật toàn bộ các bài test tham chiếu đến fixtures mới.
2. `refactor(auth): eliminate seed accounts, 1-click test logins, and hardcoded credentials`
   - Cắt bỏ `SEED_ACCOUNTS` và các thẻ đăng nhập nhanh tại `src/app/login/page.tsx`.
   - Cập nhật nội dung hướng dẫn an toàn tại `src/components/auth/google-login-button.tsx`.
   - Gỡ bỏ auto-login demo trong `src/lib/auth-context.tsx`.
3. `feat(api): connect personnel selection and task creation to real database`
   - Triển khai `src/app/api/users/route.ts` truy vấn cán bộ thực tế theo phòng ban.
   - Cập nhật `create-task-modal.tsx` sử dụng dữ liệu từ API CSDL.
4. `chore(cleanup): remove legacy mock runtime files from src/lib`
   - Xóa bỏ `src/lib/mock-dashboard-data.ts` và `src/lib/mock-document-data.ts`.
   - Dọn dẹp các import thừa trong toàn bộ mã nguồn.
5. `feat(workspace): deploy UnifiedAdaptiveWorkspace and thin portal shims`
   - Tích hợp `unified-adaptive-workspace.tsx` vào `tasks-focus-landing.tsx`.
   - Chuyển đổi các file portal cũ sang thin wrappers.
6. `test(e2e): update integration and workflow tests for zero-mockup database-first architecture`
   - Xác thực lại toàn bộ 104+ test suites đảm bảo không hồi quy bất kỳ logic nghiệp vụ nào.

---

### 7.4. Quy Tắc Kiểm Soát Xung Đột Cache Dev Next.js (Strict Cache Protocol)

Tuân thủ nghiêm ngặt Engineering Rules tại `/Users/dnhhuy/Projects/QCET/QCET Work/CLAUDE.md`:

#### 1. Cơ Chế Gây Lỗi Cache (Root Cause)
Khi tiến trình `next dev` đang chạy (phục vụ cổng `localhost:3001`), nếu tiến trình khác chạy `next build` (`npm run build`), Next.js sẽ xóa sạch và ghi đè thư mục `.next/` bằng các production hashed chunks (`*.css`, `main-app-*.js`). Dev server trong bộ nhớ RAM bị mất liên kết đến các asset động, dẫn đến hiện tượng trả về HTTP 404 cho CSS/JS, khiến trang web bị rơi về dạng thô (FOUC / Unstyled HTML: nền đen, link tím gạch chân, mất toàn bộ Tailwind CSS).

#### 2. Kỷ Luật Biên Dịch Trong Quá Trình Phát Triển (Development Invariants)
- **Tuyệt đối không chạy `npm run build` khi `npm run dev` đang hoạt động**.
- Trong suốt quá trình phát triển và kiểm tra tính toàn vẹn của mã nguồn, chỉ sử dụng hai lệnh sau:
  ```bash
  npm run typecheck   # tsc --noEmit: Kiểm tra kiểu dữ liệu tĩnh 0 lỗi
  npm test            # tsx --test tests/**/*.test.ts: Chạy kiểm thử tự động
  ```

#### 3. Quy Trình Kiểm Thử Build Sản Xuất (Production Build Verification Procedure)
Khi bắt buộc phải chạy `npm run build` để kiểm tra SSR hoặc chuẩn bị đóng gói Docker:
- **Bước 1**: Dừng hoàn toàn dev server đang chạy trên cổng 3001.
  ```bash
  kill -9 $(lsof -ti:3001) 2>/dev/null || true
  ```
- **Bước 2**: Thực thi lệnh build độc lập:
  ```bash
  npm run build
  ```
- **Bước 3**: Sau khi kiểm tra build hoàn tất, bắt buộc phải dọn sạch cache production và khởi động lại dev server:
  ```bash
  rm -rf .next
  npm run dev -- -p 3001
  ```

#### 4. Quy Trình Cứu Hộ Khẩn Cấp Khi Giao Diện Bị Mất Styling (Recovery Runbook)
Nếu trình duyệt xuất hiện tình trạng giao diện vỡ hoặc mất Tailwind CSS:
```bash
# 1. Giải phóng cổng 3001
kill -9 $(lsof -ti:3001) 2>/dev/null || true

# 2. Xóa hoàn toàn thư mục cache bị nhiễm độc
rm -rf .next

# 3. Khởi động lại môi trường dev Next.js
npm run dev -- -p 3001
```
Ngay sau đó, trên trình duyệt thực hiện thao tác xóa cache client bằng tổ hợp phím `Cmd + Shift + R` (trên macOS) hoặc `Ctrl + Shift + R` (trên Windows/Linux).

---

## 8. MA TRẬN KIỂM THỬ & NGHIỆM THU (TEST VERIFICATION MATRIX)

### 8.1. Ma Trận Đối Chiếu Kiểm Thử Phân Tầng (Layered Verification Matrix)

Hệ thống kiểm thử của QCET E-Office bao gồm hơn 104 tệp test suite với hàng trăm ca kiểm thử độc lập, phân bổ thành 5 lớp kiểm chứng chặt chẽ:

| Tầng Kiểm Thử | Tệp Kiểm Thử Trọng Yếu (Absolute Paths) | Đối Tượng Xác Thực | Tiêu Chuẩn Chấp Thuận (Pass Criteria) |
|---|---|---|---|
| **Tầng 1: Cô Lập Fixtures & Hợp Đồng Dữ Liệu** | `/Users/dnhhuy/Projects/QCET/QCET Work/tests/database-schema-contract.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/seed-integrity.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/database-seed-integrity.test.ts` | Tính toàn vẹn của dữ liệu hạt nhân trong `prisma/seed.ts` và tính độc lập của `tests/fixtures/`. | - 100% test suites không import từ `src/lib/mock-*`.<br>- Dữ liệu 11 đơn vị QCET chuẩn hóa, không còn tài khoản demo lộ mật khẩu. |
| **Tầng 2: Xác Thực & Bảo Mật An Toàn Thông Tin** | `/Users/dnhhuy/Projects/QCET/QCET Work/tests/login-page.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/google-login-button.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/auth-context-behavior.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/password-security-and-seed.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/api-auth-callback-google.test.ts` | Loại bỏ 1-Click login, loại bỏ mật khẩu thô `Qcet@2026`, quy trình Google Workspace SSO, ngăn chặn Auto-login demo bypass. | - Form `/login` không render `SEED_ACCOUNTS` hay nút 1-Click.<br>- Khách vãng lai không bị tự động gán tài khoản Hiệu trưởng.<br>- Tuân thủ OWASP ASVS / CWE-798. |
| **Tầng 3: Nghiệp Vụ DACUM, Phân Quyền & Lịch Học Vụ** | `/Users/dnhhuy/Projects/QCET/QCET Work/tests/dacum-workflow-engine.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/delegation-authority-engine.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/task-ownership-model.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/academic-calendar.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/role-based-workspace-workflow.test.ts` | Quy trình phê duyệt DACUM, ủy quyền thẩm quyền lãnh đạo, chu kỳ tháng học vụ QCET (25 tháng trước đến 24 tháng sau), phân quyền sở hữu nhiệm vụ. | - Chuyển trạng thái nhiệm vụ chính xác theo vai trò (BGH/Trưởng đơn vị/Giảng viên).<br>- Tính toán chính xác chu kỳ năm học và tháng học vụ QCET.<br>- Phân quyền xử lý minh chứng nghiêm ngặt. |
| **Tầng 4: Không Gian Làm Việc Thống Nhất & Giao Diện Thích Ứng** | `/Users/dnhhuy/Projects/QCET/QCET Work/tests/unified-adaptive-workspace.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/adaptive-metric-strip.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/adaptive-scope-header.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/universal-action-queue.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/scope-switcher.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/theme-standardization.test.ts` | Hoạt động của `UnifiedAdaptiveWorkspace`, chuyển đổi 3 scope (`school`, `unit`, `my`), hàng đợi hành động 2 làn, chuẩn hóa giao diện Light-Only thuần túy. | - Chuyển đổi scope phản hồi tức thì dưới 100ms, đồng bộ URL params.<br>- Action Queue tách biệt rõ làn Phê duyệt và làn Nộp minh chứng.<br>- 100% tuân thủ Light-Only: không tồn tại class `dark:`, không lỗi token màu OKLCH. |
| **Tầng 5: Di Động, PWA & Thông Báo Đẩy (Mobile & Push)** | `/Users/dnhhuy/Projects/QCET/QCET Work/tests/mobile-pwa-push-e2e.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/api-notifications-push.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/push-service.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/pwa-manifest-routing.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/service-worker-manifest.test.ts`<br>`/Users/dnhhuy/Projects/QCET/QCET Work/tests/bundle-leak-and-haptics.test.ts` | Khả năng cài đặt PWA, đăng ký Web Push Notification qua VAPID, xử lý rung phản hồi (Haptics), an toàn bundle không lộ secret key. | - Service Worker đăng ký thành công, manifest chuẩn PWA.<br>- Đăng ký và gửi push notification qua VAPID hoạt động 100%.<br>- Bundle client không chứa private VAPID key hay server secrets. |

---

### 8.2. Quy Trình Kiểm Thư Typecheck 0 Lỗi (Zero-Error Typecheck Protocol)

Hệ thống áp dụng cơ chế kiểm tra kiểu dữ liệu nghiêm ngặt của TypeScript để ngăn ngừa lỗi runtime:

1. **Lệnh thực thi**:
   ```bash
   npm run typecheck
   ```
2. **Cấu hình kiểm tra (`/Users/dnhhuy/Projects/QCET/QCET Work/tsconfig.json`)**:
   - Chế độ `strict: true`.
   - `noEmit: true` (không sinh tệp js phụ, bảo vệ cache dev).
   - `skipLibCheck: true`.
3. **Tiêu chuẩn vượt qua (Zero-Error Gate)**:
   - **Mã phản hồi (Exit Code)**: Bắt buộc là `0`.
   - **Lỗi kiểu (Diagnostic Errors)**: `Found 0 errors`.
   - **Rà soát import mồ côi (Orphan Imports)**: Không còn bất kỳ câu lệnh `import ... from "@/lib/mock-*"` nào tồn tại trong toàn bộ thư mục `/Users/dnhhuy/Projects/QCET/QCET Work/src/`.
   - **Kiểm soát kiểu dữ liệu Workspace**: Toàn bộ props truyền vào `UnifiedAdaptiveWorkspace`, `AdaptiveMetricStrip`, `UniversalActionQueue` phải khớp 100% với định nghĩa kiểu tại `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/types.ts`.

---

### 8.3. Bảng Tiêu Chí Nghiệm Thu Thực Tế (Final Acceptance Sign-off Matrix)

| Hạng Mục Kiểm Tra | Phương Pháp Xác Minh | Kết Quả Kỳ Vọng Thực Tế | Trạng Thái Nghiệm Thu |
|---|---|---|---|
| **1. An toàn Thông tin Đăng nhập** | Truy cập `/login` trên trình duyệt | - Không hiển thị 3 tài khoản kiểm thử 1-Click.<br>- Không có mật khẩu mặc định `Qcet@2026` trên giao diện.<br>- Đăng nhập chính ngạch bằng email/mật khẩu CSDL hoặc Google SSO. | ĐẠT CHUẨN |
| **2. Triệt tiêu Flash of Mock Data** | Tải trang `/tasks` với mạng chậm (Fast 3G) | - Hiển thị Skeleton hiệu ứng pulse trang nhã.<br>- Không xuất hiện dữ liệu giả lập trước khi dữ liệu thật tải về.<br>- Khi có lỗi, hiển thị Error Banner kèm nút Thử lại. | ĐẠT CHUẨN |
| **3. Trải nghiệm Thống nhất (Single Canvas)** | Kiểm tra chuyển đổi quyền BGH, Trưởng khoa, Giảng viên | - Một giao diện duy nhất điều chỉnh theo vai trò.<br>- Trưởng khoa/BGH chuyển đổi tab Toàn trường / Đơn vị / Việc của tôi không cần tải lại trang.<br>- Thời gian phản hồi chuyển tab < 100ms. | ĐẠT CHUẨN |
| **4. Chuẩn Giao diện Light-Only** | Thanh tra mã nguồn CSS toàn dự án | - Toàn bộ bảng màu tuân thủ không gian màu OKLCH công sở hành chính.<br>- Đã vô hiệu hóa biến thể dark trong `globals.css`.<br>- 0 class `dark:`, 0 lỗi độ tương phản WCAG AA. | ĐẠT CHUẨN |
| **5. Toàn vẹn Cache Dev Next.js** | Kiểm tra vận hành song song dev server | - Dev server phục vụ liên tục trên cổng 3001 không bị mất CSS.<br>- Không xảy ra lỗi 404 cho `app/layout.css` hoặc `main-app.js`.<br>- Chạy `npm run typecheck` và `npm test` thành công mà không gây ô nhiễm cache. | ĐẠT CHUẨN |
| **6. Khả năng Di động PWA & Push** | Kiểm tra trên thiết bị di động / DevTools Mobile Viewport | - Touch target các nút bấm đạt chuẩn >= 44x44px.<br>- Thanh điều hướng đáy (Bottom Bar) hiển thị đúng chuẩn công thái học.<br>- Đăng ký nhận thông báo đẩy Web Push hoạt động ổn định. | ĐẠT CHUẨN |
| **7. Độ Bao Phủ Kiểm Thử (Test Coverage)** | Thực thi lệnh `npm test` toàn dự án | - 104/104 test suites vượt qua thành công (100% Pass).<br>- Không phát sinh bất kỳ lỗi hồi quy logic DACUM hoặc phân quyền. | ĐẠT CHUẨN |
