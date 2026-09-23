# CƠ SỞ TRI THỨC PHÁP LÝ & QUY CHẾ ĐIỀU HÀNH TỔ CHỨC
## QCET E-OFFICE REGULATORY & INSTITUTIONAL KNOWLEDGE BASE

**Cơ quan chủ quản:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn  (QCET)  
**Tên giao dịch quốc tế:** Quy Nhon College of Engineering and Technology  
**Hệ thống:** Hệ điều hành Quản lý Văn bản, Tác nghiệp & Điều hành điện tử (QCET E-Office)  
**Tình trạng tài liệu:** Văn bản chuẩn tắc (Canonical Reference Specification)  
**Phiên bản:** 1.0.0 (Cập nhật tháng 09/2026)  
**Phạm vi áp dụng:** Toàn bộ kiến trúc phần mềm, mô hình dữ liệu Prisma, phân quyền RBAC, luồng văn thư và giao diện tác nghiệp.

---

## LỜI NÓI ĐẦU & NGUYÊN TẮC THIẾT KẾ HỆ THỐNG

Hệ thống QCET E-Office không chỉ là một công cụ công nghệ thông tin đơn thuần mà là hiện thân số hóa của thể chế quản lý nhà nước, quy chế làm việc nội bộ và các chuẩn mực pháp lý về văn thư, lưu trữ, giao dịch điện tử và an toàn thông tin.

Mọi thực thể dữ liệu (Entity), dịch vụ miền (Domain Service), đường dẫn API (API Route Handler) và thành phần giao diện (UI Component) trong hệ thống đều phải xuất phát từ và tuân thủ tuyệt đối các căn cứ pháp lý sau đây:

1. **Hiến pháp, Luật và Nghị định của Chính phủ**: Thiết lập khung khổ pháp lý tối thượng về thẩm quyền, trách nhiệm công vụ, giá trị pháp lý của văn bản số, bảo vệ bí mật nhà nước và dữ liệu cá nhân.
2. **Thông tư của Bộ Giáo dục và Đào tạo / Bộ Lao động - Thương binh và Xã hội**: Quy định điều lệ trường cao đẳng, chuẩn chức danh nghề nghiệp, định mức giảng dạy và vị trí việc làm.
3. **Quyết định, Quy chế, Phương án nội bộ của Nhà trường**: Cụ thể hóa thẩm quyền của Ban Giám hiệu, quy trình phối hợp giữa các Khoa/Phòng/Trung tâm, phương án tinh gọn bộ máy và phương thức truyền thông chỉ đạo điều hành.

---

## DANH MỤC CĂN CỨ PHÁP LÝ VÀ QUY ĐỊNH THỂ CHẾ

| STT | Ký hiệu / Số hiệu văn bản | Ngày ban hành | Cơ quan ban hành | Tên gọi văn bản / Trích yếu nội dung |
|:---:|---|:---:|---|---|
| 01 | **Quyết định số 283/QĐ-CĐKTCNQN** | 19/08/2026 | Hiệu trưởng QCET | Quy chế làm việc của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn . |
| 02 | **Quyết định số 282/QĐ-CĐKTCNQN** | 19/08/2026 | Hiệu trưởng QCET | Sửa đổi, bổ sung Quy chế tổ chức và hoạt động của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn . |
| 03 | **Phương án số 690/ĐA-CĐKTCNQN** | 19/08/2026 | Hiệu trưởng QCET | Phương án sắp xếp, tinh gọn tổ chức bộ máy và bố trí nhân sự giai đoạn 2026-2030. |
| 04 | **Quyết định số 420/QĐ-CĐKTCNQN** | 03/12/2025 | Hiệu trưởng QCET | Phân công nhiệm vụ cụ thể của Ban Giám hiệu (Hiệu trưởng và các Phó Hiệu trưởng theo từng lĩnh vực phụ trách). |
| 05 | **Quyết định số 203/QĐ-CĐKTCNQN** | 15/05/2025 | Hiệu trưởng QCET | Quy chế làm việc, chức năng nhiệm vụ cụ thể cho từng Khoa, Phòng và Trung tâm trực thuộc. |
| 06 | **Quyết định số 93/QĐ-CĐKTCNQN & Kế hoạch số 227/KH-CĐKTCNQN** | 2026 | Hiệu trưởng QCET | Quy chế công tác văn thư, lưu trữ cơ quan và Kế hoạch thực hiện công tác lưu trữ năm 2026. |
| 07 | **Nghị định số 232/2026/NĐ-CP** | 2026 | Chính phủ | Quy định về Vị trí việc làm và định mức biên chế viên chức trong đơn vị sự nghiệp công lập. |
| 08 | **Nghị định số 30/2020/NĐ-CP** | 05/03/2020 | Chính phủ | Về công tác văn thư (Quy trình văn bản đi, văn bản đến, lập hồ sơ công việc, lưu trữ, ký số, phát hành). |
| 09 | **Thông tư số 63/2026/TT-BGDĐT** | 2026 | Bộ Giáo dục và Đào tạo | Ban hành Điều lệ trường trung cấp, trường cao đẳng (Phân cấp thẩm quyền Hội đồng trường, Hiệu trưởng, Phó Hiệu trưởng, Trưởng khoa). |
| 10 | **Luật Giao dịch điện tử số 20/2023/QH15 & Nghị định số 68/2024/NĐ-CP** | 22/06/2023 & 2024 | Quốc hội & Chính phủ | Luật Giao dịch điện tử và Nghị định quy định về chữ ký số chuyên dùng công vụ. |
| 11 | **Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 & Nghị định số 356/2025/NĐ-CP** | 2025 | Quốc hội & Chính phủ | Luật Bảo vệ dữ liệu cá nhân và Nghị định quy định chi tiết thi hành Luật Bảo vệ dữ liệu cá nhân. |
| 12 | **Luật Bảo vệ bí mật nhà nước số 117/2025/QH15 & Luật Dữ liệu năm 2025** | 2025 | Quốc hội | Quy định về phân loại, bảo vệ, quản trị bí mật nhà nước và vòng đời dữ liệu số quốc gia. |
| 13 | **Thông báo số 593/TB-CĐKTCNQN** | 10/07/2026 | Hiệu trưởng QCET | Về việc sử dụng ứng dụng Telegram trong công tác thông báo, nhắc việc và điều hành nội bộ tại Nhà trường. |

---

## CHƯƠNG I: QUY CHẾ TỔ CHỨC VÀ NGUYÊN TẮC LÀM VIỆC NỘI BỘ (QĐ 283, QĐ 282, PHƯƠNG ÁN 690)

### Điều 1. Quyết định số 283/QĐ-CĐKTCNQN: Quy chế làm việc của Nhà trường

#### 1.1. Căn cứ và Phạm vi điều chỉnh
Quy chế làm việc ban hành kèm theo Quyết định số 283/QĐ-CĐKTCNQN ngày 19/08/2026 quy định nguyên tắc làm việc, chế độ trách nhiệm, quan hệ công tác, quy trình giải quyết công việc, chế độ hội họp, thông tin báo cáo và kỷ luật hành chính của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn .

#### 1.2. Các nguyên tắc hoạt động cốt lõi
1. **Tập trung dân chủ và Đề cao trách nhiệm người đứng đầu**: Nhà trường hoạt động theo chế độ thủ trưởng kết hợp bàn bạc tập thể. Hiệu trưởng là người đứng đầu, chịu trách nhiệm toàn diện trước Bộ Giáo dục và Đào tạo, Tỉnh ủy, Ủy ban nhân dân Tỉnh  và trước pháp luật về mọi mặt hoạt động của Nhà trường.
2. **Phân công, phân cấp và Ủy quyền rõ ràng**: Mỗi công việc chỉ được giao cho một đơn vị hoặc một cá nhân chủ trì, chịu trách nhiệm chính. Cấp trên không làm thay công việc của cấp dưới, cấp dưới chủ động giải quyết công việc trong phạm vi thẩm quyền được phân cấp.
3. **Giải quyết công việc theo đúng quy trình, thẩm quyền và thời hạn**: Mọi nhiệm vụ đều phải có thời hạn hoàn thành (Deadline), có tiêu chí nghiệm thu rõ ràng và được giám sát qua hồ sơ điện tử.
4. **Kỷ luật kỷ cương hành chính và Bảo đảm chế độ thông tin báo cáo**: Chế độ giao ban định kỳ (Thứ Hai hàng tuần), báo cáo tháng (trước ngày 25 hàng tháng), báo cáo sơ kết học kỳ và tổng kết năm học.

#### 1.3. Hệ quả vận hành phần mềm (Software Domain Implications)
- **Role Decoupling Invariant (Role Is Not Scope)**: Người dùng có vai trò lãnh đạo (`BAN_GIAM_HIEU`) có thẩm quyền chỉ đạo, phê duyệt trên toàn trường nhưng khi làm việc cá nhân có thể chuyển Scope sang `my` (Cá nhân) mà không làm suy giảm quyền lực xử lý.
- **Single DRI Invariant (Directly Responsible Individual)**: Mỗi nhiệm vụ (`Task`) trong hệ thống chỉ có duy nhất một `TaskActor` với `role: DRI` và `isPrimaryDRI: true`; các thành viên khác dùng vai trò `COLLABORATOR`, `REVIEWER`, `APPROVER` hoặc `OBSERVER` theo quan hệ thực tế. Đơn vị chuẩn tắc của Task là `Task.leadUnitId` trỏ tới `OrganizationalUnit`.
- **Maker-Checker Separation**: Cán bộ tạo nhiệm vụ hoặc chuyên viên nộp sản phẩm minh chứng (`TaskDeliverable`) không được phép tự phê duyệt sản phẩm của chính mình. Phê duyệt bắt buộc phải do Trưởng đơn vị (`TRUONG_PHONG`) hoặc Ban Giám hiệu (`BAN_GIAM_HIEU`) thực hiện.

---

### Điều 2. Quyết định số 282/QĐ-CĐKTCNQN: Sửa đổi, bổ sung Quy chế tổ chức và hoạt động

#### 2.1. Căn cứ pháp lý và Nội dung sửa đổi
Ban hành ngày 19/08/2026 nhằm cập nhật cơ cấu tổ chức theo mô hình quản trị số hiện đại, sáp nhập và kiện toàn chức năng của các phòng ban, khoa đào tạo và trung tâm phục vụ.

#### 2.2. Khung tổ chức bộ máy chuẩn mực
1. **Hội đồng trường**: Cơ quan quản trị, quyết định chiến lược, quy hoạch phát triển, ban hành quy chế tài chính và giám sát các hoạt động của Nhà trường.
2. **Ban Giám hiệu**: Cơ quan điều hành gồm Hiệu trưởng và các Phó Hiệu trưởng.
3. **Khối Phòng và Trung tâm chức năng**: Thực hiện chức năng tham mưu, tổng hợp, bảo đảm nguồn lực và điều hành nghiệp vụ (Phòng Quản lý Đào tạo, Phòng Hành chính - Quản trị, Phòng Tổ chức - Đảm bảo chất lượng, Phòng Tài chính, Phòng Tuyển sinh - Hợp tác quốc tế, Trung tâm Số - Truyền thông, Trung tâm Ngoại ngữ - Tin học).
4. **Khối Khoa chuyên môn**: Thực hiện chức năng đào tạo, nghiên cứu ứng dụng, chuyển giao công nghệ và quản lý người học trực thuộc ngành (Khoa Công nghệ thông tin, Khoa Cơ khí, Khoa Công nghệ Ô tô, Khoa Điện, Khoa Du lịch - Dịch vụ, Khoa Kinh tế - Quản trị, Khoa Văn hóa Nghệ thuật, Khoa Văn hóa THPT / Đại cương, Khoa Kỹ thuật Nông nghiệp).

#### 2.3. Hệ quả vận hành phần mềm (Software Domain Implications)
- Mô hình thực thể `OrganizationalUnit` trong Prisma Schema là nguồn chuẩn tắc cho đơn vị, với `id`, `code`, `name`, `type`, quan hệ cây `parentId` và trạng thái hiệu lực. Các quan hệ Task/văn bản Phase 9 dùng định danh unit, không dùng `Department` làm foreign key.
- Tích hợp từ điển ánh xạ tương thích ngược (`QCET_UNIT_CANONICAL_MAP`) giúp hệ thống tự động chuẩn hóa các mã phòng ban cũ trong tài liệu lịch sử hoặc dữ liệu di trú sang mã chuẩn tắc của QĐ 282.

---

### Điều 3. Phương án số 690/ĐA-CĐKTCNQN: Sắp xếp, tinh gọn tổ chức bộ máy và nhân sự (2026-2030)

#### 3.1. Mục tiêu và Nguyên tắc tinh gọn
- Giảm đầu mối trung gian, khắc phục tình trạng chồng chéo chức năng giữa các đơn vị hành chính và chuyên môn.
- Thực hiện nguyên tắc "Một đơn vị thực hiện nhiều việc, một việc chỉ giao một đơn vị chủ trì".
- Cơ cấu lại đội ngũ viên chức và người lao động theo vị trí việc làm; tối ưu hóa biên chế hành chính phục vụ, ưu tiên định mức giảng viên trực tiếp đứng lớp và nghiên cứu khoa học.

#### 3.2. Lộ trình triển khai giai đoạn 2026-2030
1. **Giai đoạn 1 (2026 - 2027)**: Hợp nhất các đơn vị có chức năng tương đồng; tinh gọn quy trình phê duyệt từ 4 cấp xuống còn tối đa 2 cấp thông qua nền tảng số hóa E-Office.
2. **Giai đoạn 2 (2028 - 2030)**: Tự động hóa 80% thủ tục hành chính nội bộ, triển khai đánh giá hiệu suất công việc (KPI/DACUM) theo thời gian thực dựa trên sản phẩm đầu ra đã được kiểm định.

#### 3.3. Hệ quả vận hành phần mềm (Software Domain Implications)
- **Lifecycle & Archival Fields**: Để đáp ứng việc giải thể, sáp nhập đơn vị hoặc thuyên chuyển nhân sự mà không làm mất liên kết dữ liệu lịch sử, các thực thể `User`, `OrganizationalUnit`, `Task`, `Document` dùng các trường trạng thái/lưu trữ tương ứng trong schema; không còn giả định bảng `Department` là nguồn đơn vị của Task hoặc văn bản.
- **Handling of Unassigned Staff**: Khi đơn vị bị sáp nhập, các tài khoản người dùng rơi vào trạng thái chưa có `PositionAssignment`/`OrganizationalUnit` hiệu lực vẫn có thể đăng nhập bằng Google Workspace nhưng giao diện tự động chuyển hướng vào quy trình Onboarding / cập nhật vị trí công tác mới.

---

## CHƯƠNG II: PHÂN CÔNG NHIỆM VỤ LÃNH ĐẠO & THẨM QUYỀN ĐIỀU HÀNH (QĐ 420, THÔNG TƯ 63/2026/TT-BGDĐT)

### Điều 4. Quyết định số 420/QĐ-CĐKTCNQN: Phân công nhiệm vụ cụ thể của Ban Giám hiệu

Ban hành ngày 03/12/2025 xác định chi tiết ranh giới quản lý, trách nhiệm cá nhân và thẩm quyền ký duyệt văn bản của từng thành viên Ban Giám hiệu:

#### 4.1. Hiệu trưởng (ThS. Phạm Văn Tường) - Mã định danh: `BGH_HT`
- **Thẩm quyền chung**: Lãnh đạo, quản lý và điều hành toàn diện mọi mặt hoạt động của Nhà trường; là đại diện pháp luật và Chủ tài khoản cơ quan.
- **Lĩnh vực trực tiếp phụ trách**:
  - Chiến lược, quy hoạch và kế hoạch phát triển dài hạn của Nhà trường.
  - Công tác tổ chức cán bộ, vị trí việc làm, bảo vệ chính trị nội bộ, thi đua khen thưởng và kỷ luật.
  - Công tác tài chính, kế hoạch ngân sách, phê duyệt dự toán, quyết toán các nguồn vốn ngân sách và nguồn thu hợp pháp.
  - Công tác đầu tư xây dựng cơ bản, các dự án chương trình mục tiêu và trang thiết bị đào tạo lớn.
  - Công tác thanh tra, kiểm tra nội bộ, tiếp công dân, giải quyết khiếu nại, tố cáo và phòng chống tham nhũng, lãng phí.
  - Trực tiếp chỉ đạo các đơn vị: Phòng Tổ chức - Đảm bảo chất lượng, Phòng Tài chính.
  - Giữ chức Chủ tịch Hội đồng Thi đua - Khen thưởng, Hội đồng Tuyển dụng, Hội đồng Khoa học và Đào tạo.

#### 4.2. Phó Hiệu trưởng Đào tạo (ThS. Trần Trọng Kiệm) - Mã định danh: `BGH_PHT_DT`
- **Trách nhiệm điều hành**: Giúp Hiệu trưởng phụ trách và chỉ đạo các mảng công tác chuyên môn học thuật và chuyển đổi số.
- **Lĩnh vực trực tiếp phụ trách**:
  - Kế hoạch đào tạo, chương trình giáo dục, giáo trình, học liệu các hệ Cao đẳng, Trung cấp, Sơ cấp.
  - Quản lý công tác thi, kiểm tra, công nhận tốt nghiệp và cấp phát văn bằng, chứng chỉ.
  - Công tác chuyển đổi số, công nghệ thông tin, ứng dụng AI, quản trị mạng và bảo đảm an toàn thông tin cơ quan.
  - Công tác học sinh - sinh viên, quản lý ký túc xá, giáo dục lý tưởng cách mạng, đạo đức lối sống cho người học.
  - Trực tiếp phụ trách và chỉ đạo: Phòng Quản lý Đào tạo, Trung tâm Số - Truyền thông, Trung tâm Ngoại ngữ - Tin học, cùng toàn bộ 09 Khoa chuyên môn về mặt hoạt động giảng dạy.
  - Ký thay Hiệu trưởng (KT. HIỆU TRƯỞNG) các văn bản hướng dẫn chuyên môn đào tạo, lịch đào tạo, thông báo học vụ, quyết định thành lập hội đồng chấm thi/tiểu ban chuyên môn.

#### 4.3. Phó Hiệu trưởng Hành chính - Cơ sở vật chất (ThS. Lê Xuân Nguyên) - Mã định danh: `BGH_PHT_CSVC`
- **Trách nhiệm điều hành**: Giúp Hiệu trưởng phụ trách các mảng công tác hậu cần, tài sản, đối ngoại và tuyển sinh.
- **Lĩnh vực trực tiếp phụ trách**:
  - Công tác hành chính, tổng hợp, văn thư, lưu trữ, quản lý con dấu và bảo vệ cơ quan.
  - Quản trị tài sản công, đất đai, cơ sở vật chất, bảo dưỡng, sửa chữa, vệ sinh môi trường, an toàn lao động và phòng cháy chữa cháy.
  - Công tác tuyển sinh các hệ, hướng nghiệp và phát triển thương hiệu Nhà trường.
  - Hợp tác doanh nghiệp, giải quyết việc làm cho sinh viên tốt nghiệp, quan hệ đối ngoại và dự án hợp tác quốc tế.
  - Nghiên cứu khoa học, sáng kiến cải tiến kỹ thuật, phong trào tự làm thiết bị đào tạo.
  - Trực tiếp phụ trách và chỉ đạo: Phòng Hành chính - Quản trị, Phòng Tuyển sinh - Hợp tác quốc tế.
  - Ký thay Hiệu trưởng (KT. HIỆU TRƯỞNG) các hợp đồng kinh tế mua sắm tài sản thường xuyên theo ủy quyền, công văn giao dịch hành chính thông thường, giấy mời, lịch công tác tuần.

#### 4.4. Hệ quả vận hành phần mềm (Software Domain Implications)
- **Executive Cockpit Routing**: Khi Văn thư trình văn bản đến cấp trường, hệ thống căn cứ vào lĩnh vực trích yếu để gợi ý chuyển đúng đồng chí phụ trách:
  - Tài chính, nhân sự, quy chế -> Gợi ý chuyển `tuongpv@cdktcnqn.edu.vn`.
  - Chương trình học, thi cử, CNTT -> Gợi ý chuyển `kiemtt@cdktcnqn.edu.vn`.
  - Mua sắm, sửa chữa, tuyển sinh, văn thư -> Gợi ý chuyển `nguyenlx@cdktcnqn.edu.vn`.
- **Executive Bottleneck Resolution (`ExecutiveResolution`)**: Cho phép thành viên BGH ban hành quyết định gỡ nghẽn với 4 loại hành động nghiệp vụ được quy định rõ trong model:
  1. `EXTEND_DEADLINE`: Gia hạn thời gian hoàn thành công việc.
  2. `REASSIGN_OWNER`: Điều chuyển giao việc cho cán bộ khác khi có sự chậm trễ hoặc quá tải.
  3. `DIRECTIVE_NOTE`: Ban hành văn bản ý kiến chỉ đạo bổ sung.
  4. `DISMISS_BOTTLENECK`: Hủy cảnh báo tắc nghẽn sau khi đã thẩm tra thực tế.

---

### Điều 5. Thông tư số 63/2026/TT-BGDĐT: Điều lệ trường cao đẳng & Phân cấp thẩm quyền

#### 5.1. Thẩm quyền quyết định của Ban Giám hiệu đối với Khoa/Phòng
- Hiệu trưởng có quyền bổ nhiệm, miễn nhiệm Trưởng/Phó đơn vị; giao dự toán ngân sách và chỉ tiêu tuyển sinh, đào tạo cho các đơn vị.
- Phó Hiệu trưởng được Hiệu trưởng ủy quyền bằng văn bản để giải quyết các công việc thuộc lĩnh vực phụ trách và chịu trách nhiệm liên đới trước Hiệu trưởng và pháp luật về quyết định của mình.

#### 5.2. Thẩm quyền và Trách nhiệm của Trưởng khoa, Trưởng phòng
- **Trưởng khoa / Trưởng phòng**: Là người đứng đầu đơn vị, chịu trách nhiệm trực tiếp trước Hiệu trưởng và Phó Hiệu trưởng phụ trách về toàn bộ kết quả thực thi nhiệm vụ của đơn vị mình.
- Có thẩm quyền phân công nhiệm vụ cụ thể cho từng Phó Trưởng khoa/Phó Trưởng phòng, Trưởng bộ môn, giảng viên, chuyên viên trong nội bộ đơn vị.
- Có trách nhiệm ký duyệt đề xuất, bảng chấm công, phiếu đánh giá tiến độ trước khi trình cấp Ban Giám hiệu.
- Không được vượt cấp ban hành các văn bản mang tính ràng buộc pháp lý ra bên ngoài Nhà trường mà không có ủy quyền của Hiệu trưởng.

---

## CHƯƠNG III: TỔ CHỨC CÔNG TÁC ĐƠN VỊ & MA TRẬN VỊ TRÍ VIỆC LÀM DACUM (QĐ 203, NGHỊ ĐỊNH 232/2026/NĐ-CP)

### Điều 6. Quyết định số 203/QĐ-CĐKTCNQN: Quy chế làm việc cụ thể của Khoa, Phòng, Trung tâm

#### 6.1. Quy trình giao việc và phân rã nhiệm vụ nội bộ (Work Decomposition)
1. Khi tiếp nhận văn bản chỉ đạo hoặc nhiệm vụ cấp trường giao cho đơn vị (`scope: DEPARTMENT`), Trưởng đơn vị có trách nhiệm trong vòng 24 giờ phải tạo `UnitWorkAssignment` cho một viên chức chủ trì (`driUserId`) và các viên chức phối hợp (`collaboratorUserIds`); nếu có Task, quan hệ được ghi bằng `TaskActor` với một DRI duy nhất (`role: DRI`, `isPrimaryDRI: true`).
2. Nhiệm vụ phức tạp phải được phân rã thành các nhiệm vụ con (`parentTaskId` -> `subTasks`), xác định rõ thời hạn bắt đầu (`startDate`) và thời hạn kết thúc (`dueDate`).
3. Sản phẩm của nhiệm vụ phải được số hóa thành tệp minh chứng (`TaskDeliverable`) kèm theo mô tả tiêu chuẩn chất lượng.

#### 6.2. Cơ chế giám sát và Báo cáo tiến độ
- Định kỳ chiều Thứ Năm hàng tuần, Trưởng đơn vị rà soát tỷ lệ hoàn thành nhiệm vụ của các bộ môn/chuyên viên.
- Mọi trường hợp nguy cơ trễ hạn phải có báo cáo giải trình nêu rõ nguyên nhân khách quan, chủ quan và đề xuất biện pháp khắc phục gửi Phó Hiệu trưởng phụ trách.

---

### Điều 7. Nghị định số 232/2026/NĐ-CP: Vị trí việc làm và Định mức viên chức

#### 7.1. Nguyên tắc pháp lý bất biến về Vị trí việc làm
- **Vị trí gắn với chức danh nghề nghiệp**: Vị trí việc làm là công việc gắn với chức danh nghề nghiệp hoặc chức vụ lãnh đạo, quản lý để xác định số lượng người làm việc, cơ cấu viên chức trong đơn vị sự nghiệp công lập.
- **Phân công lĩnh vực không làm thay đổi vị trí việc làm**: Việc người đứng đầu đơn vị phân công viên chức tạm thời phụ trách thêm một số nhiệm vụ đột xuất, nhiệm vụ theo dự án hoặc kiêm nhiệm đề án cải cách KHÔNG làm thay đổi bản chất vị trí việc làm đã được phê duyệt và không làm căn cứ chuyển ngạch tự phát.

#### 7.2. Bốn nhóm vị trí việc làm trong trường cao đẳng (Điều 4)
Hệ thống QCET E-Office mã hóa 4 nhóm vị trí việc làm theo enum `JobCatalogGroup` trong Prisma:
1. `LDPU` (Lãnh đạo, quản lý): Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Phó Trưởng phòng, Trưởng khoa, Phó Trưởng khoa, Giám đốc trung tâm.
2. `VCMN` (Viên chức chức danh nghề nghiệp chuyên ngành): Giảng viên giáo dục nghề nghiệp (Hạng I, II, III), Giáo viên thực hành, Kỹ thuật viên xưởng thực hành.
3. `VCDC` (Viên chức chức danh nghề nghiệp chuyên môn dùng chung): Chuyên viên quản lý đào tạo, Chuyên viên tổ chức cán bộ, Kế toán viên, Chuyên viên quản trị mạng và CNTT, Chuyên viên hành chính tổng hợp.
4. `HTPV` (Nhân viên hỗ trợ, phục vụ): Nhân viên văn thư, thủ quỹ, nhân viên lái xe, bảo vệ, tạp vụ, bảo trì điện nước.

#### 7.3. Ánh xạ kiến trúc phần mềm: Ma trận DACUM và Bảng Danh mục vị trí việc làm
Hệ thống chuẩn hóa mối quan hệ giữa Vị trí việc làm pháp lý và Tác nghiệp thực tế thông qua 3 bảng:
- `JobCatalogItem`: Lưu danh mục vị trí việc làm chuẩn hóa theo Đề án VTVL của Trường (mã ngạch, tên vị trí, tiêu chuẩn năng lực `competencyReq`).
- `DacumDuty`: Cụm nhiệm vụ chức năng theo phương pháp DACUM (Developing A Curriculum / Developing An Operational Matrix), thuộc về một phòng ban và liên kết với một Vị trí việc làm.
- `DacumTaskDef`: Định nghĩa công việc cụ thể chuẩn hóa (mã công việc, tiêu chí đánh giá `criteria`, công cụ sử dụng `tools`, sản phẩm giao nộp bắt buộc `requiredDeliverables`, định mức giờ chuẩn `standardHours`).
- Khi người dùng tạo một `Task` thực tế, task có thể gắn với `dacumTaskDefId` để phục vụ tự động hóa tính toán định mức lao động và xếp loại thi đua cuối năm mà không vi phạm quy định của Nghị định 232/2026/NĐ-CP.

#### 7.4. Cơ chế Ủy quyền phê duyệt DACUM (`DacumDelegation`)
Tuân thủ chuẩn mực quản trị đại học tiên tiến (Stanford Authority Manager / MIT Atlas):
- Trưởng phòng/Trưởng khoa có thể ủy quyền quyền duyệt công việc (`authorityScope`) cho Phó Trưởng phòng/Phó Trưởng khoa trong thời gian công tác hoặc vắng mặt.
- **Ràng buộc kiểm soát (Delegation Invariants)**:
  - Bắt buộc phải có ngày bắt đầu (`startDate`) và ngày hết hạn (`expiresAt`).
  - Phải ghi nhận căn cứ văn bản giao quyền (`documentRef`).
  - **Chống tự phê duyệt (Self-Approval Prevention)**: Người được ủy quyền tuyệt đối không được phê duyệt sản phẩm minh chứng do chính mình tải lên hoặc nhiệm vụ mà mình là `TaskActor` DRI (`role: DRI`, `isPrimaryDRI: true`). Hệ thống tự động từ chối giao dịch và báo lỗi `403 Forbidden`.
  - Mọi giao dịch duyệt qua ủy quyền phải ghi nhận vết kiểm toán rõ ràng: `grantorId`, `delegateId`, `timestamp`.

---

## CHƯƠNG IV: QUY CHẾ VĂN THƯ, LƯU TRỮ VÀ VÒNG ĐỜI VĂN BẢN (NĐ 30/2020/NĐ-CP, QĐ 93, KH 227)

### Điều 8. Nghị định số 30/2020/NĐ-CP: Chuẩn mực tối thượng về Công tác Văn thư

Hệ thống quản trị văn bản của QCET E-Office tuân thủ 100% các điều khoản của Nghị định số 30/2020/NĐ-CP ngày 05/03/2020 của Chính phủ:

#### 8.1. Quy trình quản lý Văn bản Đến (Điều 20 - Điều 27)
1. **Tiếp nhận & Kiểm tra (Điều 21)**: Bộ phận Văn thư (`VAN_THU`) tiếp nhận tất cả văn bản, tài liệu gửi đến trường (qua bưu chính, trực tiếp hoặc trục liên thông điện tử). Kiểm tra tính toàn vẹn, xác thực chữ ký số (nếu có).
2. **Đăng ký văn bản đến (Điều 22 & Phụ lục IV)**:
   - Tất cả văn bản đến phải được đăng ký vào Sổ đăng ký văn bản đến điện tử.
   - **Nguyên tắc cấp số đến**: Số văn bản đến phải được đánh liên tục bắt đầu từ số 01 vào ngày 01 tháng 01 và kết thúc vào ngày 31 tháng 12 hàng năm. Không được nhảy số, trùng số hoặc lùi số.
   - Sổ đăng ký văn bản đến trên hệ thống gồm 09 trường thông tin bắt buộc theo Phụ lục IV: Ngày đến, Số đến, Tác giả (Nơi gửi), Số ký hiệu gốc, Ngày ban hành gốc, Tên loại và trích yếu, Đơn vị/Người nhận, Hạn giải quyết, Ghi chú.
3. **Trình và Chuyển giao văn bản đến (Điều 23 & Điều 24)**:
   - Văn bản đến phải được Văn thư trình Ban Giám hiệu trong ngày làm việc (văn bản khẩn phải trình ngay).
   - Ban Giám hiệu xem xét, ghi ý kiến chỉ đạo trên `DocumentIncomingWorkflow`, xác định đơn vị chủ trì (`leadUnitId`), đơn vị phối hợp (`coordinatingUnitIds`), thời hạn xử lý (`deadline`) và nội dung chỉ đạo cụ thể.
4. **Tự động hóa Văn bản thành Nhiệm vụ (Document-to-Task Pipeline)**:
   - Khi Ban Giám hiệu hoàn tất bút phê có chỉ định đơn vị chủ trì, hệ thống tự động sinh ra một `Task` cấp trường (`scope: SCHOOL`) liên kết với văn bản (`linkedTaskId`), tự động chuyển trạng thái văn bản sang `DANG_XU_LY`.

#### 8.2. Quy trình quản lý Văn bản Đi (Điều 14 - Điều 19)
1. **Soạn thảo và Thẩm tra (Điều 14 & Điều 16)**:
   - Đơn vị được giao soạn thảo khởi tạo hồ sơ văn bản đi trên hệ thống; tài liệu này không quyết định mô hình hay nguồn dữ liệu của drafting unit.
   - Lãnh đạo đơn vị duyệt bản thảo, gửi Phòng Hành chính - Quản trị và Văn thư kiểm tra thể thức, kỹ thuật trình bày theo quy định tại Phụ lục I NĐ 30/2020/NĐ-CP.
2. **Trình ký văn bản (Điều 17)**:
   - Chuyển văn bản điện tử lên Hiệu trưởng hoặc Phó Hiệu trưởng được ủy quyền để ký số chuyên dùng công vụ.
3. **Cấp số, Đóng dấu và Phát hành (Điều 15, Điều 18 & Phụ lục IV)**:
   - Sau khi văn bản được ký duyệt, Văn thư thực hiện cấp số văn bản đi.
   - **Nguyên tắc cấp số đi**: Số văn bản đi được đánh liên tục từ số 01 cho mỗi thể loại văn bản (hoặc nhóm văn bản quy phạm/hành chính) bắt đầu từ ngày 01/01 đến hết 31/12.
   - Áp dụng con dấu điện tử (chữ ký số cơ quan) và phát hành qua mạng hoặc bưu chính theo danh sách nơi nhận (`recipientList`).
   - Sổ văn bản đi gồm 10 trường thông tin chuẩn Phụ lục IV: Số ký hiệu, Ngày ban hành, Tên loại và trích yếu, Người ký, Nơi nhận, Đơn vị soạn thảo, Người nhận bản lưu, Số lượng bản, Ngày chuyển, Ghi chú.

#### 8.3. Độ khẩn và Độ mật (Điều 9)
- **Độ khẩn (`DocumentUrgency`)**: `THUONG` (Thường), `KHAN` (Khẩn), `THUONG_KHAN` (Thượng khẩn), `HOA_TOC` (Hỏa tốc). Văn bản hỏa tốc, thượng khẩn được hệ thống ưu tiên hiển thị banner cảnh báo màu đỏ và kích hoạt push notification tức thời đến thiết bị lãnh đạo.
- **Độ mật (`DocumentSecurityLevel`)**: `THUONG` (Thường), `MAT` (Mật), `TOI_MAT` (Tối mật), `TUYET_MAT` (Tuyệt mật). Tuyệt đối cấm số hóa và lưu trữ văn bản thuộc danh mục Mật, Tối mật, Tuyệt mật trên các máy chủ kết nối Internet công cộng khi chưa qua hệ thống mã hóa chuyên dụng của Ban Cơ yếu Chính phủ.

#### 8.4. Tiêu chuẩn tệp đính kèm số hóa (Phụ lục I)
- Tệp đính kèm văn bản đến scan từ văn bản giấy phải là định dạng PDF hoặc PDF/A, độ phân giải tối thiểu 200 dpi, hiển thị đầy đủ màu sắc nguyên bản của con dấu đỏ và chữ ký mực tươi.
- Hệ thống tính toán và lưu trữ mã băm SHA-256 (`sha256Hash`) cho từng tệp đính kèm (`DocumentAttachment`) để bảo đảm tính toàn vẹn và chống chối bỏ.

---

### Điều 9. Quyết định số 93/QĐ-CĐKTCNQN & Kế hoạch số 227/KH-CĐKTCNQN: Quy chế và Kế hoạch công tác Lưu trữ

#### 9.1. Trách nhiệm lập hồ sơ công việc điện tử
- Mọi cán bộ, chuyên viên, giảng viên khi giải quyết công việc có trách nhiệm thu thập toàn bộ văn bản đi, đến, phiếu trình, biên bản họp, sản phẩm dự thảo vào một Hồ sơ công việc điện tử.
- Kết thúc năm học hoặc kết thúc sự việc, cá nhân có trách nhiệm đóng gói hồ sơ và thực hiện nộp lưu hồ sơ điện tử vào Lưu trữ cơ quan (Phòng Hành chính - Quản trị).

#### 9.2. Tiêu chuẩn phân loại và Thời hạn bảo quản
- **Hồ sơ bảo quản vĩnh viễn**: Các văn bản quy phạm nội bộ, chiến lược phát triển, hồ sơ cấp văn bằng tốt nghiệp, hồ sơ đại hội Đảng bộ, bổ nhiệm cán bộ chủ chốt.
- **Hồ sơ bảo quản có thời hạn (5 năm, 10 năm, 20 năm, 70 năm)**: Hồ sơ tài chính, giáo trình, bảng điểm học kỳ, kế hoạch công tác định kỳ.
- Không được tùy tiện xóa bỏ bản ghi trong cơ sở dữ liệu. Khi hết thời hạn lưu trữ, việc tiêu hủy tài nguyên số phải thành lập Hội đồng tiêu hủy và có biên bản quyết định của Hiệu trưởng, đồng thời cập nhật trường `archivedAt`, `archivedById`, `archiveReason`.

---

## CHƯƠNG V: CHỮ KÝ SỐ CHUYÊN DÙNG CÔNG VỤ & GIAO DỊCH ĐIỆN TỬ (LUẬT 20/2023/QH15, NGHỊ ĐỊNH 68/2024/NĐ-CP)

### Điều 10. Luật Giao dịch điện tử số 20/2023/QH15 & Nghị định số 68/2024/NĐ-CP

#### 10.1. Giá trị pháp lý của Thông điệp dữ liệu và Chữ ký điện tử
- Điều 12 Luật Giao dịch điện tử 2023 khẳng định: Thông điệp dữ liệu có giá trị như văn bản gốc nếu thông tin trong đó có thể truy cập và sử dụng được để tham chiếu khi cần thiết và bảo đảm tính toàn vẹn từ thời điểm khởi tạo lần đầu.
- Điều 23 quy định chữ ký điện tử dùng trong cơ quan nhà nước phải là Chữ ký số chuyên dùng công vụ do Ban Cơ yếu Chính phủ cấp hoặc chữ ký số đáp ứng đầy đủ tiêu chuẩn an toàn kỹ thuật theo quy định.

#### 10.2. Quy cách ký số trên văn bản điện tử hành chính
- **Chữ ký số cá nhân của người có thẩm quyền (Hiệu trưởng / Phó Hiệu trưởng)**:
  - Hình thức thể hiện: Hình ảnh chữ ký tươi của người ký, màu xanh, định dạng PNG nền trong suốt.
  - Vị trí: Đặt chính giữa chức danh người ký và họ tên người ký.
  - Metadata: Kèm chứng thư số cá nhân, tên cơ quan chủ quản, thời gian ký (Signing Time) lấy từ máy chủ cấp dấu thời gian (TSA - Time Stamping Authority).
- **Chữ ký số cơ quan (Con dấu điện tử Nhà trường)**:
  - Hình thức thể hiện: Hình ảnh con dấu màu đỏ của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn , định dạng PNG nền trong suốt.
  - Vị trí: Trùm lên 1/3 hình ảnh chữ ký của người có thẩm quyền về phía bên trái.
  - Ký sau khi văn bản đã được người có thẩm quyền ký duyệt và Văn thư đã cấp số văn bản đi.

#### 10.3. Yêu cầu kiến trúc đối với QCET E-Office
- **Cryptographic Verification**: Hệ thống hỗ trợ tích hợp với Plugin ký số của Ban Cơ yếu Chính phủ (VGCA Signer) và kiểm tra chứng thư số X.509 hợp lệ (chưa hết hạn, không nằm trong danh sách thu hồi CRL/OCSP).
- **Non-Repudiation Audit Trail**: Mỗi hành động phê duyệt, ký số phải ghi lại bản ghi kiểm toán bất biến chứa: `userId`, `timestamp`, `ipAddress`, `userAgent`, `sha256Hash` của tài liệu tại thời điểm ký.

---

## CHƯƠNG VI: BẢO VỆ DỮ LIỆU CÁ NHÂN, AN TOÀN DỮ LIỆU & BÍ MẬT NHÀ NƯỚC (LUẬT 91/2025/QH15, NĐ 356/2025/NĐ-CP, LUẬT 117/2025/QH15, LUẬT DỮ LIỆU 2025)

### Điều 11. Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 & Nghị định số 356/2025/NĐ-CP

#### 11.1. Dữ liệu cá nhân trong môi trường giáo dục cao đẳng
1. **Dữ liệu cá nhân cơ bản**: Họ và tên, ngày tháng năm sinh, số Căn cước công dân / Định danh cá nhân, số điện thoại, địa chỉ cư trú, email công vụ, ảnh chân dung, chức vụ, đơn vị công tác.
2. **Dữ liệu cá nhân nhạy cảm**: Thông tin tài khoản ngân hàng nhận lương, dữ liệu sức khỏe viên chức/sinh viên, thông tin kỷ luật hoặc đánh giá năng lực nội bộ.

#### 11.2. Nguyên tắc xử lý dữ liệu và Tuân thủ hệ thống
- **Nguyên tắc giới hạn mục đích (Purpose Limitation)**: Dữ liệu cá nhân thu thập qua hệ thống chỉ được dùng cho mục đích quản lý hành chính, đào tạo, xếp thời khóa biểu và thanh toán chế độ công tác.
- **Nguyên tắc tối thiểu hóa (Data Minimization)**: API Routes và Client State chỉ tải về các trường dữ liệu cần thiết cho tác vụ hiện tại. Tuyệt đối không để lộ mã băm mật khẩu (`passwordHash`), dữ liệu phiên nội bộ (`sessionToken`), hoặc thông tin CCCD trong payload của các API công khai hoặc bảng danh sách chung.
- **Biện pháp kỹ thuật bảo vệ**:
  - Mã hóa đường truyền bằng giao thức TLS 1.3 đối với toàn bộ truy cập web và API.
  - Định danh đơn kênh (Single Identity Authority) qua tài khoản Google Workspace `@cdktcnqn.edu.vn`.
  - Phân quyền theo vai trò (RBAC) nghiêm ngặt; chuyên viên đơn vị này không thể tra cứu thông tin cá nhân chi tiết của chuyên viên đơn vị khác khi không có thẩm quyền.

---

### Điều 12. Luật Bảo vệ bí mật nhà nước số 117/2025/QH15 & Luật Dữ liệu năm 2025

#### 12.1. Phân loại mức độ bảo vệ dữ liệu số
Theo Luật Dữ liệu 2025 và Luật Bảo vệ bí mật nhà nước 117/2025/QH15, dữ liệu trong hệ thống thông tin của Nhà trường được phân thành 3 cấp độ:
1. **Dữ liệu công khai**: Thông báo tuyển sinh, chương trình đào tạo, lịch công tác tuần công khai, biểu mẫu hành chính.
2. **Dữ liệu nội bộ (Cấp độ 1 & 2)**: Văn bản chỉ đạo nội bộ, hồ sơ cán bộ viên chức, đề thi, đáp án, bảng điểm học vụ, hợp đồng kinh tế.
3. **Dữ liệu Bí mật nhà nước (Mật, Tối mật, Tuyệt mật)**: Văn bản quân sự, quốc phòng - an ninh, kế hoạch phòng chống bạo loạn, tài liệu chỉ đạo của Tỉnh ủy thuộc danh mục mật.

#### 12.2. Vùng cấm kỹ thuật (Hard System Invariants)
- **CẤM TUYỆT ĐỐI**: Không tiếp nhận, số hóa, đăng tải, lưu trữ hoặc luân chuyển văn bản có dấu MẬT, TỐI MẬT, TUYỆT MẬT lên hệ thống QCET E-Office khi hệ thống đang vận hành trên mạng diện rộng thông thường.
- Các văn bản mật phải được quản lý riêng bằng Sổ văn bản giấy bảo mật đặt tại phòng cơ mật của Văn thư cơ quan hoặc sử dụng mạng nội bộ cô lập (Air-gapped Network) đạt chuẩn an toàn thông tin cấp độ 3 trở lên.
- Trường hợp người dùng vô ý tải lên tài liệu chứa nội dung mật, Văn thư hoặc Quản trị hệ thống (`ADMIN`) có quyền lập tức kích hoạt tính năng khóa cô lập văn bản (`REVOKE / ISOLATE`) và báo cáo Hội đồng an toàn thông tin Nhà trường xử lý.

---

## CHƯƠNG VII: ĐIỀU HÀNH BẰNG ỨNG DỤNG TELEGRAM VÀ RÀNH GIỚI VẬN HÀNH (THÔNG BÁO SỐ 593/TB-CĐKTCNQN)

### Điều 13. Thông báo số 593/TB-CĐKTCNQN: Sử dụng Telegram trong thông báo/điều hành

Nhằm tăng cường tốc độ truyền thông nhưng vẫn giữ vững tính pháp lý và an toàn dữ liệu, Thông báo số 593/TB-CĐKTCNQN ngày 10/07/2026 của Hiệu trưởng Nhà trường quy định rõ:

#### 13.1. Định vị kỹ thuật: Telegram là Kênh chuyển tiếp thông báo (Notification Transport)
- Telegram (thông qua Telegram Bot và các nhóm điều hành chuyên đề) chỉ đóng vai trò là **kênh thông báo tức thời (Real-time Notification Transport)** và nhắc nhở công việc (Task Reminders).
- **Telegram KHÔNG PHẢI LÀ**:
  - Không phải là công cụ luồng công việc (Workflow Engine).
  - Không phải là kho lưu trữ văn bản chính thức (Document Repository).
  - Không phải là nơi phê duyệt, ký duyệt hay ban hành quyết định pháp lý.

#### 13.2. Quy định cấm trong sử dụng Telegram (Operational Restrictions)
1. **Không phê duyệt văn bản trên Telegram**: Mọi quyết định phê duyệt đề xuất, minh chứng DACUM, duyệt bản thảo văn bản phải được thực hiện trên giao diện web của QCET E-Office có xác thực phiên đăng nhập. Tin nhắn "Đồng ý", "Duyệt" trên nhóm chat Telegram không có giá trị pháp lý nghiệm thu công việc.
2. **Không gửi văn bản mật và dữ liệu nhạy cảm**: Nghiêm cấm chia sẻ tệp tài liệu nội bộ nhạy cảm, thông tin căn cước công dân, tài khoản ngân hàng hoặc văn bản có độ khẩn/mật lên nhóm chat Telegram.
3. **Cấu trúc tin nhắn Telegram chuẩn**: Tin nhắn gửi từ Bot hệ thống đến người dùng chỉ bao gồm tiêu đề thông báo vắn tắt, tên người giao việc, thời hạn và kèm theo **đường dẫn an toàn (`linkHref`)** trỏ trực tiếp về trang chi tiết tương ứng trên QCET E-Office (`https://e-office.cdktcnqn.edu.vn/...`).

#### 13.3. Ánh xạ kiến trúc phần mềm (Software Domain Mapping)
- Bảng `Notification` trong Prisma Schema đóng vai trò là hàng đợi (Queue) thông báo trong ứng dụng:
  ```prisma
  model Notification {
    id        String   @id @default(cuid())
    userId    String   @map("user_id")
    title     String
    body      String
    category  String   @default("task")
    type      String
    linkHref  String   @map("link_href")
    isRead    Boolean  @default(false)
    createdAt DateTime @default(now())
  }
  ```
- Dịch vụ gửi tin qua Telegram Webhook chỉ nhận dữ liệu tóm lược từ sự kiện hệ thống (Event-driven):
  - Payload gửi sang Telegram Bot API: `{ chat_id: user.telegramChatId, text: `${notification.title}\n${notification.body}\nXem chi tiết: ${APP_URL}${notification.linkHref}` }`.
  - Không truyền tải dữ liệu nhị phân của tệp đính kèm (`fileUrl`) qua Telegram.
  - Phục hồi trạng thái: Mọi thao tác cập nhật tiến độ phải gọi API E-Office để bảo đảm nguyên tắc **Server Truth Wins** (Dữ liệu cơ sở dữ liệu PostgreSQL luôn là chân lý tối thượng).

---

## CHƯƠNG VIII: MA TRẬN ÁNH XẠ THỂ CHẾ PHÁP LÝ SANG KIẾN TRÚC PHẦN MỀM

Bảng đối chiếu tổng hợp giữa quy định thể chế và các thành phần kỹ thuật mã nguồn:

| Căn cứ Pháp lý / Quy chế | Điều khoản / Nội dung thể chế | Thực thể / Module mã nguồn E-Office | Cơ chế thực thi kỹ thuật (Enforcement Mechanism) |
|---|---|---|---|
| **QĐ 283/QĐ-CĐKTCNQN** | Chế độ trách nhiệm người đứng đầu, một việc một người chủ trì | `TaskActor` (`role: DRI`, `isPrimaryDRI`) | Ràng buộc canonical `task_actors_one_primary_dri_idx` bảo đảm mỗi nhiệm vụ chỉ có đúng 1 DRI chính. |
| **QĐ 283/QĐ-CĐKTCNQN** | Nguyên tắc Maker-Checker: Người tạo không tự duyệt | `src/app/api/tasks/[id]/deliverables` | Kiểm tra server-side: `if (deliverable.uploadedById === session.user.id) throw 403 Forbidden`. |
| **QĐ 282/QĐ-CĐKTCNQN** | Cơ cấu chuẩn các đơn vị | `OrganizationalUnit` | Chuẩn hóa định danh, mã, loại và quan hệ cây đơn vị; không dùng `Department` làm foreign key canonical. |
| **PA 690/ĐA-CĐKTCNQN** | Tinh gọn bộ máy, sáp nhập đơn vị, giải quyết dôi dư nhân sự | `archivedAt`, `archiveReason`, `deactivatedAt` | Xóa mềm thực thể, giữ trọn vẹn vết liên kết khóa ngoại lịch sử và hỗ trợ điều hướng luồng Onboarding. |
| **QĐ 420/QĐ-CĐKTCNQN** | Phân công lĩnh vực lãnh đạo BGH (Hiệu trưởng & 2 Phó Hiệu trưởng) | `ExecutiveResolution`, `DocumentIncomingWorkflow` | Khoang chỉ huy BGH (`ExecutiveCockpit`) lọc theo lĩnh vực; workflow văn bản đến lưu `leadUnitId` và `responsibilityAreaId`. |
| **QĐ 203/QĐ-CĐKTCNQN** | Phân rã nhiệm vụ đơn vị, ủy quyền duyệt việc DACUM | `DacumDelegation`, `parentTaskId`, `subTasks` | Phân cấp Accordion theo đơn vị giám sát (`SupervisoryOrg`); ủy quyền có thời hạn, phạm vi và chống tự duyệt. |
| **QĐ 93 & KH 227** | Lập hồ sơ công việc điện tử, quy chế lưu trữ và tiêu hủy | `TaskDeliverable`, `DocumentAttachment`, `archivedBy` | Toàn bộ sản phẩm được gắn định danh minh chứng; lưu vết kiểm toán nộp lưu hồ sơ cuối năm. |
| **NĐ 232/2026/NĐ-CP** | Vị trí việc làm không đổi khi phân công công việc kiêm nhiệm | `JobCatalogItem`, `JobCatalogGroup`, `DacumDuty`, `TaskActor` | Tách biệt hoàn toàn Danh mục Vị trí việc làm chuẩn hóa (`JobCatalog`) với việc giao tác vụ động qua `TaskActor`. |
| **NĐ 30/2020/NĐ-CP** | Đăng ký văn bản đến/đi, số liên tục 01/01 - 31/12 | `DocumentNumberSequence`, `registrationNumber` | Prisma Transaction Atomic: Tăng số tuần tự chống race-condition, tách biệt bộ đếm theo từng năm `documentYear`. |
| **NĐ 30/2020/NĐ-CP** | Mẫu sổ chuẩn Phụ lục IV (9 cột văn bản đến, 10 cột văn bản đi) | `src/app/api/documents/export-excel` | Xuất file Excel chuẩn cấu trúc cột quy định tại Phụ lục IV phục vụ thanh tra lưu trữ. |
| **NĐ 30/2020/NĐ-CP** | Chỉ đạo BGH có đơn vị chủ trì và theo dõi tác nghiệp | `DocumentIncomingWorkflow.leadUnitId`, `Task.leadUnitId`, `TaskActor` | Workflow lưu đơn vị/chỉ đạo; khi tạo Task theo dõi, Task trỏ tới cùng `OrganizationalUnit`, liên kết văn bản qua `Document.linkedTaskId` và DRI qua `TaskActor`. |
| **Luật 20/2023 & NĐ 68/2024** | Tính toàn vẹn và chống chối bỏ của văn bản điện tử | `sha256Hash`, `DocumentAttachment` | Băm dữ liệu SHA-256 tệp PDF scan màu; lưu vết người tải lên, thời gian và chứng thư số. |
| **Luật 91/2025 & NĐ 356/2025** | Bảo vệ dữ liệu cá nhân, hạn chế lộ lọt thông tin nhạy cảm | `src/lib/auth-session.ts`, Zero-Mockup Standard | Đăng nhập Google OAuth qua domain `@cdktcnqn.edu.vn`, loại bỏ 100% tài khoản demo và dữ liệu giả lập. |
| **Luật 117/2025 & Luật Dữ liệu** | Nghiêm cấm xử lý bí mật nhà nước trên mạng công cộng | `DocumentSecurityLevel` (`MAT`, `TOI_MAT`, `TUYET_MAT`) | Cơ chế Validation chặn tải tệp mật lên hệ thống; cô lập tài liệu khi phát hiện dấu hiệu vi phạm. |
| **TB 593/TB-CĐKTCNQN** | Telegram chỉ là notification transport, không thay thế workflow | `Notification`, `PushSubscription` | Telegram Bot chỉ gửi tin vắn tắt kèm deep link; không lưu trữ tài liệu, không chấp nhận phê duyệt qua chat. |

---

## CHƯƠNG IX: BẢNG KIỂM TRA BẤT BIẾN DÀNH CHO KỸ SƯ PHÁT TRIỂN (DEVELOPER COMPLIANCE CHECKLIST)

Trước khi gửi bất kỳ Pull Request hoặc triển khai bản cập nhật nào trên QCET E-Office, kỹ sư phần mềm bắt buộc phải đối chiếu 10 tiêu chí kiểm tra sau:

- [ ] **1. Tuân thủ nguyên tắc Role Is Not Scope**: Không bao giờ suy luận vai trò người dùng từ phạm vi hiển thị (Không dùng `if (scope === "school")` để cấp quyền admin).
- [ ] **2. Tuân thủ chuẩn Light-Only**: Giao diện hành chính chuẩn mực, không chứa lớp CSS `dark:`, không có ThemeProvider, tôn trọng trải nghiệm công sở ban ngày.
- [ ] **3. Nguyên tắc Người chịu trách nhiệm chính duy nhất (Single DRI)**: Mọi nhiệm vụ có DRI phải có đúng một `TaskActor` với `role = DRI` và `isPrimaryDRI = true`; đơn vị chuẩn tắc của nhiệm vụ là `Task.leadUnitId`.
- [ ] **4. Ngăn chặn tự phê duyệt (Maker-Checker Invariant)**: Cấm chuyên viên tự duyệt minh chứng của mình; cấm người được ủy quyền tự duyệt task mình làm chủ trì.
- [ ] **5. Chuẩn mực cấp số văn bản NĐ 30**: Cấp số văn bản đến/đi tự động qua giao dịch nguyên tử (`DocumentNumberSequence`), reset về số 01 vào ngày 01/01 hàng năm.
- [ ] **6. Không tạo dữ liệu giả mạo (Zero Synthetic Data)**: Nếu không có bản ghi, hiển thị Empty State chân thực; cấm bịa số liệu KPI hoặc danh sách nhân sự ảo.
- [ ] **7. Chuẩn mực thời gian và lịch học vụ**: Toàn bộ ngày tháng, tuần học vụ, hạn chót phải tính theo múi giờ Đông Dương (ICT, UTC+7) thông qua `src/lib/academic-calendar.ts`.
- [ ] **8. Ranh giới an toàn Telegram**: Tin nhắn gửi sang Telegram Bot chỉ chứa trích yếu vắn tắt và `linkHref`; cấm gửi trực tiếp file đính kèm hoặc nội dung nhạy cảm.
- [ ] **9. Bảo vệ dữ liệu cá nhân & Bí mật nhà nước**: Không xuất trường dữ liệu nhạy cảm ra API payload công khai; chặn văn bản độ mật trên hạ tầng mạng thông thường.
- [ ] **10. Khắc phục sự cố không làm mất vết kiểm toán**: Mọi hành động can thiệp của BGH (`ExecutiveResolution`) đều phải ghi nhận rõ `actorId`, `timestamp` và lý do can thiệp.

---
*Tài liệu này được phê duyệt làm cơ sở chuẩn tắc cho toàn bộ hoạt động phát triển, kiểm thử và bàn giao hệ thống QCET E-Office.*
