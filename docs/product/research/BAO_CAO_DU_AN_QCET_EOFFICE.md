# BÁO CÁO TỔNG QUAN DỰ ÁN VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Hệ thống Điều hành, Quản lý Công việc & Văn bản Điện tử Nội bộ**

---

* **Đơn vị chủ quản:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)
* **Đơn vị thực hiện:** Đội ngũ Kỹ thuật Nội bộ Trường
* **Mục đích tài liệu:** Báo cáo Ban Giám hiệu về Căn cứ pháp lý, Hiệu quả kinh tế, Kiến trúc hệ thống và Lộ trình triển khai.
* **Thời gian lập:** Tháng 09/2026

---

## MỤC LỤC
1. [Sự cần thiết & Mục tiêu Dự án](#1-sự-cần-thiết--mục-tiêu-dự-án)
2. [Căn cứ Pháp lý & Tiêu chuẩn Nhà nước](#2-căn-cứ-pháp-lý--tiêu-chuẩn-nhà-nước)
3. [Phân tích Hiệu quả Tài chính & Tự chủ Công nghệ](#3-phân-tích-hiệu-quả-tài-chính--tự-chủ-công-nghệ)
4. [Kiến trúc Chức năng & Hiện trạng Hệ thống](#4-kiến-trúc-chức-năng--hiện-trạng-hệ-thống)
5. [Lộ trình Triển khai 3 Giai đoạn (Phân kỳ Thực tế)](#5-lộ-trình-triển-khai-3-giai-đoạn-phân-kỳ-thực-tế)
6. [Đề xuất & Kiến nghị Ban Giám hiệu](#6-đề-xuất--kiến-nghị-ban-giám-hiệu)

---

## 1. SỰ CẦN THIẾT & MỤC TIÊU DỰ ÁN

### 1.1. Hiện trạng và Điểm nghẽn trong Vận hành
* **Giao việc và Báo cáo tản mát:** Việc chỉ đạo điều hành hiện nay phân tán qua nhiều kênh không chính thức (nhóm Zalo, tin nhắn riêng, trao đổi miệng). Dẫn đến tình trạng trôi tin nhắn, quên việc, khó xác định trách nhiệm khi công việc quá hạn.
* **Quy trình giấy tờ thủ công, tốn kém thời gian:** Cán bộ, giảng viên khi nộp tờ trình (mua sắm vật tư xưởng, phê duyệt đề cương, kế hoạch thi...) phải in ấn bản giấy, trực tiếp đi gõ cửa từng phòng ban để xin chữ ký nháy trước khi trình Lãnh đạo Trường.
* **Lãnh đạo thiếu công cụ giám sát thời gian thực:** Ban Giám hiệu chưa có bảng tổng hợp trực quan (Dashboard) để biết tức thì: Toàn trường đang có bao nhiêu nhiệm vụ tồn đọng? Khoa/Phòng nào đang bị quá tải hoặc chậm tiến độ?

### 1.2. Mục tiêu Tổng quát
Xây dựng một hệ thống **Văn phòng điện tử (E-Office) "May đo" chuẩn hóa theo đặc thù của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn**, đáp ứng:
* **"Một điểm đến duy nhất" (Single Workspace):** Quản lý toàn bộ công việc, văn bản đến/đi và tờ trình ký duyệt.
* **Minh bạch hóa & Đẩy nhanh tốc độ xử lý:** Giảm 70% thời gian xử lý thủ tục hành chính nội bộ; nâng cao tỷ lệ hoàn thành đúng hạn của các đơn vị.
* **Tự chủ công nghệ & Bảo mật tuyệt đối:** Lưu trữ dữ liệu trên máy chủ của trường, tiết kiệm hàng trăm triệu đồng ngân sách mua sắm phần mềm thương mại.

---

## 2. CĂN CỨ PHÁP LÝ & TIÊU CHUẨN NHÀ NƯỚC

Hệ thống được thiết kế bám sát các quy định pháp luật hiện hành của Chính phủ và các Bộ ngành:

| Văn bản Pháp lý | Nội dung Quy định Áp dụng vào Hệ thống |
| :--- | :--- |
| **Nghị định số 30/2020/NĐ-CP** *(Về công tác văn thư)* | - Quy chuẩn Sổ đăng ký văn bản đến và Sổ đăng ký văn bản đi (Phụ lục IV).<br>- Quy tắc cấp số và ký hiệu văn bản tự động, liên tục từ 01/01 đến 31/12.<br>- Yêu cầu trường dữ liệu hệ thống điện tử (Phụ lục VI) và xuất file in sổ. |
| **Văn bản 01/VBHN-VPCP** *(Hợp nhất QĐ 42/2014/QĐ-TTg & QĐ 23/2018/QĐ-TTg của Thủ tướng Chính phủ)* | - **Quy chế theo dõi, đôn đốc, kiểm tra nhiệm vụ** do Lãnh đạo giao.<br>- Nguyên tắc "5 Rõ": Rõ việc, Rõ người chủ trì, Rõ người phối hợp, Rõ hạn chót, Rõ sản phẩm.<br>- Phân loại 4 trạng thái nhiệm vụ chuẩn: Đúng hạn, Quá hạn, Đang làm trong hạn, Đang làm quá hạn. |
| **Nghị định số 90/2020/NĐ-CP & Nghị định 48/2023/NĐ-CP** | - **Đánh giá, xếp loại chất lượng viên chức** dựa trên kết quả công việc cụ thể.<br>- Tỷ lệ % hoàn thành công việc đúng hạn là căn cứ pháp lý để bình xét thi đua cuối năm (Hoàn thành xuất sắc, Tốt, Hoàn thành, Không hoàn thành). |
| **Thông tư số 02/2019/TT-BNV** *(Bộ Nội vụ)* | - Tiêu chuẩn kỹ thuật dữ liệu trao đổi văn bản điện tử (chuẩn EdXML), sẵn sàng tích hợp với Trục liên thông của Tỉnh Bình Định khi có yêu cầu. |

---

## 3. PHÂN TÍCH HIỆU QUẢ TÀI CHÍNH & TỰ CHỦ CÔNG NGHỆ

### 3.1. Bảng So sánh Đối đầu Chi phí Thực tế

Dựa trên khảo sát thực tế hồ sơ chào thầu của các đơn vị thương mại (1Office, VSS PortalOffice 10) so với phương án tự phát triển nội bộ:

| Hạng mục | 1Office (Gói Doanh nghiệp) | VSS PortalOffice 10 | Phương án Tự phát triển (QCET) |
| :--- | :---: | :---: | :---: |
| **Chi phí Bản quyền** | 648.000.000 đ *(3 năm)* | 720.000.000 đ *(Vĩnh viễn)* | **0 ĐỒNG** |
| **Chi phí Cài đặt & Đào tạo** | 70.000.000 đ | 200.000.000 đ | **0 ĐỒNG** |
| **Tổng chi phí ban đầu** | **718.000.000 đ** | **920.000.000 đ** | **0 ĐỒNG** |
| **Phí duy trì từ năm thứ 2** | ~77.000.000 đ / năm | Phí bảo trì phát sinh | **0 ĐỒNG** |
| **Giới hạn Người dùng** | Bị chặn ở **300 users** *(muốn mở rộng phải mua thêm)* | Trọn gói | **KHÔNG GIỚI HẠN** *(mở rộng cả giảng viên, sinh viên)* |
| **Bản quyền OS & CSDL** | Chạy Cloud hoặc Linux | Cần Windows Server + SQL Server *(tốn thêm 100-200tr)* | Linux + PostgreSQL *(100% mã nguồn mở, hợp pháp)* |
| **Nghiệp vụ Trường nghề (DACUM)** | **Không có** *(tính phí chỉnh sửa rất cao)* | **Không có** *(khung hành chính chung)* | **May đo 100%** theo chuẩn Giáo dục nghề nghiệp |

> 💰 **KẾT LUẬN HIỆU QUẢ TÀI CHÍNH:** 
> Việc trường tự làm giúp **tiết kiệm ngay từ 700 triệu đến gần 1 tỷ đồng ngân sách đầu tư ban đầu**, đồng thời không bị lệ thuộc vào nhà thầu ngoài về chi phí duy trì định kỳ hàng năm.

---

## 4. KIẾN TRÚC CHỨC NĂNG & HIỆN TRẠNG HỆ THỐNG

Dự án sử dụng công nghệ tiên tiến nhất hiện nay: **Next.js 15 (React 19), TypeScript, Tailwind CSS v4, Prisma ORM và CSDL PostgreSQL**.

Hệ thống được thiết kế gồm 3 phân hệ trụ cột:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    QCET E-OFFICE - KHUNG ĐIỀU HÀNH SỐ                       │
├───────────────────────────────┬─────────────────────────────┬───────────────┤
│   1. QUẢN LÝ CÔNG VIỆC        │   2. SỔ CÔNG VĂN (NĐ 30)    │ 3. TRÌNH KÝ   │
│   (Unified Task Hub)          │   (Document Registry)       │ (E-Approval)  │
├───────────────────────────────┼─────────────────────────────┼───────────────┤
│ • Giao việc đa cấp (BGH->Khoa)│ • Vào sổ Văn bản Đến/Đi     │ • Phiếu trình │
│ • Ma trận tiến độ BGH         │ • Bút phê điện tử           │ • Ký nháy     │
│ • Cơ chế ủy quyền DACUM       │ • Tự động sinh Task từ CV   │ • Duyệt điện  │
│ • Kanban & Bộ lọc vai trò     │ • Đính kèm PDF & Xuất Excel │   tử online   │
│ ➔ HIỆN TRẠNG: HOÀN THÀNH 85%  │ ➔ HIỆN TRẠNG: ĐANG DỰNG     │ ➔ PHASE 2     │
└───────────────────────────────┴─────────────────────────────┴───────────────┘
```

### 4.1. Những tính năng cốt lõi ĐÃ HOÀN THÀNH (Phase 1):
1. **Phân quyền theo vai trò (Role-based Workspace):**
   * *Góc nhìn Ban Giám hiệu:* Xem toàn cảnh tiến độ các đơn vị, duyệt công việc khẩn cấp.
   * *Góc nhìn Trưởng phòng/khoa:* Nhận chỉ đạo từ BGH, phân chia việc cho cán bộ trực thuộc, giám sát KPI phòng.
   * *Góc nhìn Giảng viên/Chuyên viên (Staff Focus View):* Tối giản hóa giao diện, chỉ tập trung vào các việc được giao, báo cáo tiến độ và đính kèm sản phẩm.
2. **Ma trận Tiến độ Điều hành BGH (Department Progress Matrix):**
   * Tự động quét và cảnh báo các phòng/khoa có số lượng việc quá hạn cao, phát hiện điểm nghẽn để BGH chỉ đạo ngay trong cuộc họp giao ban đầu tuần.
3. **Cơ chế Ủy quyền Nghiệp vụ Đặc thù (DACUM Workflow):**
   * Phân quyền linh hoạt cho Trưởng khoa, Tổ trưởng bộ môn chủ trì các hội đồng thẩm định chương trình đào tạo, đánh giá kỹ năng nghề mà không phá vỡ cấu trúc hành chính của trường.
4. **Bộ lọc công việc thông minh (Simplified Task Filter Bar) & Bảng Kanban:**
   * Lọc công việc theo mức độ khẩn (Hỏa tốc, Thượng khẩn), trạng thái, hạn chót và đơn vị phụ trách.

---

## 5. LỘ TRÌNH TRIỂN KHAI 3 GIAI ĐOẠN (PHÂN KỲ THỰC TẾ)

Để bảo đảm tính khả thi, tránh dàn trải gây lãng phí nguồn lực, dự án được phân rã thành **3 giai đoạn rõ ràng**:

### 🎯 Giai đoạn 1: Nền tảng Giao việc & Điều hành BGH (ĐANG HOÀN THIỆN)
* **Trọng tâm:** Giải quyết triệt để bài toán *"Quản lý việc làm - Kiểm soát hạn chót - Đánh giá KPI"*.
* **Kết quả:** Đã có giao diện Task Hub, ma trận BGH, ủy quyền DACUM; hoàn tất kết nối CSDL PostgreSQL trong tháng 09/2026.
* **Mục tiêu:** Đưa vào vận hành thử nghiệm tại 2 đơn vị: **Phòng Đào tạo** và **Khoa CNTT**.

### 🎯 Giai đoạn 2: Số hóa Công văn (NĐ 30) & Tờ trình Ký duyệt Online (1 - 2 THÁNG TỚI)
* **Trọng tâm:** Xóa bỏ việc ghi sổ giấy thủ công và loại bỏ quy trình vác hồ sơ giấy đi xin chữ ký nháy.
* **Nội dung:**
  1. Xây dựng Sổ văn bản Đến/Đi chuẩn Nghị định 30/2020/NĐ-CP (nhảy số tự động, upload PDF, in sổ Excel).
  2. Bút phê điện tử: Lãnh đạo ghi chỉ đạo trên PDF ➔ tự động biến thành Task phân về Khoa/Phòng.
  3. Quy trình Tờ trình online: Chuyên viên tạo phiếu trình ➔ Lãnh đạo duyệt trên web/điện thoại.

### 🎯 Giai đoạn 3: Mở rộng Tiện ích & Tích hợp (TÙY THEO NHU CẦU THỰC TẾ)
* **Nội dung:** Tích hợp chữ ký số SmartCA/Token USB, quản lý kho tài liệu số (có đóng dấu chìm Watermark chống lộ lọt), kiểm tra trùng phòng họp và cấu hình thông báo di động PWA.

---

## 6. ĐỀ XUẤT & KIẾN NGHỊ BAN GIÁM HIỆU

Để hệ thống nhanh chóng đi vào phục vụ công tác quản trị trường, đội ngũ kỹ thuật kính đề xuất Ban Giám hiệu xem xét:

1. **Về Hạ tầng kỹ thuật:** Cho phép sử dụng 01 máy chủ ảo hóa (hoặc máy chủ vật lý hiện có của trường) cài đặt hệ điều hành Linux (Ubuntu Server) và Docker để triển khai hệ sinh thái phần mềm nội bộ an toàn.
2. **Về Thử nghiệm Thực tế:** Cho phép triển khai thử nghiệm diện hẹp tại **Văn phòng trường, Phòng Đào tạo và Khoa CNTT** trong thời gian 03 - 04 tuần để lấy ý kiến đóng góp, hoàn thiện trải nghiệm người dùng trước khi nhân rộng toàn trường.
3. **Về Cơ chế phối hợp:** Ban hành thông báo tạm thời khuyến khích các đơn vị thí điểm cập nhật tiến độ công việc và phản hồi nghiệp vụ qua hệ thống thay cho việc báo cáo tản mát qua Zalo.

---
*Tài liệu được tổng hợp và chuẩn hóa bởi Đội ngũ Kỹ thuật Nội bộ QCET.*
