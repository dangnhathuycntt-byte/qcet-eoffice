# QCET E-Office — Đặc Tả Nghiệp Vụ Hồ Sơ Công Việc & Lưu Trữ Điện Tử (Work Dossier & Records Archive Specification)

**Cơ quan ban hành:** Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn  (QCET)  
**Tình trạng tài liệu:** Văn bản Chuẩn tắc Miền Nghiệp vụ (Canonical Domain Specification)  
**Phạm vi áp dụng:** Mô hình dữ liệu Prisma, Quản trị Vòng đời Hồ sơ Số (Digital Dossier Lifecycle), Quy trình Nộp lưu Lưu trữ Cơ quan, và Hệ thống Kiểm soát Trách nhiệm Viên chức.  
**Căn cứ pháp lý:**
- Nghị định số 30/2020/NĐ-CP ngày 05/03/2020 của Chính phủ về công tác văn thư (Chương IV: Lập hồ sơ và nộp lưu hồ sơ, tài liệu vào Lưu trữ cơ quan);
- Quyết định số 93/QĐ-CĐKTCNQN của Hiệu trưởng QCET ban hành Quy chế công tác văn thư, lưu trữ cơ quan;
- Kế hoạch số 227/KH-CĐKTCNQN của Hiệu trưởng QCET về Kế hoạch thực hiện công tác lưu trữ năm 2026;
- Luật Lưu trữ số 33/2024/QH15 của Quốc hội nước Cộng hòa xã hội chủ nghĩa Việt Nam;
- Luật Giao dịch điện tử số 20/2023/QH15 & Nghị định số 68/2024/NĐ-CP quy định về chữ ký số chuyên dùng công vụ;
- Nghị định số 90/2020/NĐ-CP về đánh giá, xếp loại chất lượng cán bộ, công chức, viên chức.

---

## 1. NGUYÊN TẮC VÀ NGHĨA VỤ PHÁP LÝ TỐI THƯỢNG (THE INSTITUTIONAL MANDATE)

### 1.1 Nguyên Tắc "Người Nào Giải Quyết Việc Nào Thì Lập Hồ Sơ Việc Đó"

Theo quy định tại **Khoản 1 Điều 29 Nghị định số 30/2020/NĐ-CP** và **Điều 12 Quy chế Lưu trữ ban hành kèm theo Quyết định số 93/QĐ-CĐKTCNQN**:

> *"Cá nhân được giao nhiệm vụ giải quyết công việc có trách nhiệm lập hồ sơ về công việc đó và nộp lưu hồ sơ, tài liệu vào Lưu trữ cơ quan đúng thời hạn quy định."*

Hệ thống QCET E-Office thể chế hóa nguyên tắc này thành **Bất biến vận hành bắt buộc (Mandatory Operational Invariant)**:
1. **Nghĩa vụ không thể ủy nhiệm**: Viên chức, giảng viên hoặc chuyên viên được giao chủ trì thực hiện một nhiệm vụ (`DRI`), hoặc được phân công thụ lý một văn bản đến, bắt buộc phải mở một **Hồ sơ công việc điện tử (`WorkDossier`)** tương ứng.
2. **Không nộp lưu, không hoàn thành**: Một nhiệm vụ hoặc một văn bản chỉ được xem là hoàn thành trọn vẹn về mặt pháp lý hành chính khi Hồ sơ công việc điện tử đã được đóng gói, biên mục đầy đủ và thực hiện nộp lưu vào Kho Lưu trữ cơ quan (thuộc Phòng Hành chính - Quản trị).
3. **Chống thất thoát tri thức thể chế (Zero Institutional Memory Loss)**: Toàn bộ quá trình từ văn bản chỉ đạo, bút phê, trao đổi, biên bản họp, sản phẩm dự thảo đến văn bản phát hành chính thức phải được gom tụ toàn vẹn trong cùng một hồ sơ số, loại bỏ hoàn toàn tình trạng tài liệu lưu trữ rải rác trên máy tính cá nhân hoặc biến mất khi nhân sự chuyển đổi vị trí công tác.

---

## 2. THỰC THỂ HỒ SƠ CÔNG VIỆC (WORK DOSSIER ENTITY SPECIFICATION)

Hồ sơ công việc điện tử (`WorkDossier`) là tập hợp các văn bản, tài liệu, dữ liệu điện tử có giá trị pháp lý, được hình thành trong quá trình theo dõi, giải quyết một công việc cụ thể thuộc chức năng, nhiệm vụ của cơ quan hoặc đơn vị.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WORK DOSSIER (HỒ SƠ CÔNG VIỆC)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Mã hồ sơ (code)        : 2026.01.HCQT-05                                   │
│  Tiêu đề (title)        : Hồ sơ tổ chức Hội thảo Khoa học Quốc tế năm 2026  │
│  Chủ hồ sơ (owner)      : ThS. Nguyễn Văn A (DRI / Chuyên viên thụ lý)      │
│  Đơn vị lập (unit)      : Phòng Quản lý Đào tạo (P_QLDT)                    │
│  Thời điểm mở (openedAt): 15/01/2026                                        │
│  Thời điểm đóng(closedAt): 30/03/2026                                       │
│  Thời hạn (retention)   : 20_NAM (Theo Bảng thời hạn bảo quản QCET)        │
│  Trạng thái (status)    : CLOSED (Đã kết thúc xử lý)                        │
│  Nộp lưu (archiveStatus): ACCEPTED (Đã tiếp nhận vào Lưu trữ cơ quan)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Các Trường Thông Tin Bắt Buộc (Mandatory Metadata Fields)

1. **`code` (Mã hồ sơ)**:
   - Cấu trúc mã hóa chuẩn tắc theo Danh mục hồ sơ cơ quan hàng năm (Khoản 2 Điều 28 NĐ 30/2020):
     $$\text{Code} = \text{Năm} \;. \; \text{Mã nhóm việc} \;. \; \text{Mã đơn vị} - \text{Số thứ tự hồ sơ}$$
     *Ví dụ:* `2026.02.QLDT-18` (Năm 2026, Nhóm 02: Quản lý Đào tạo, Phòng QLĐT, Hồ sơ số 18).
   - Mã hồ sơ là duy nhất (`unique`) trên toàn hệ thống trong một năm học vụ.
2. **`title` (Tiêu đề hồ sơ)**:
   - Tên gọi của hồ sơ phản ánh ngắn gọn, rõ ràng và chuẩn xác nội dung vấn đề, sự việc, tên đối tượng, địa danh và thời gian hình thành hồ sơ.
   - *Ví dụ chuẩn:* "Hồ sơ thẩm định và phê duyệt chương trình đào tạo ngành Công nghệ thông tin trình độ Cao đẳng khóa 2026-2029".
   - *Cấm đặt tên mơ hồ:* "Hồ sơ công việc", "Tài liệu đào tạo", "Tài liệu gửi thầy Kiệm".
3. **`ownerId` / `owner` (Chủ hồ sơ / Người lập hồ sơ)**:
   - Viên chức giữ vai trò `DRI` của nhiệm vụ hoặc chuyên viên chính được phân công giải quyết văn bản.
   - Chịu trách nhiệm trực tiếp trước Lãnh đạo đơn vị và Pháp luật về tính xác thực, toàn vẹn và bảo mật của các tài liệu trong hồ sơ.
4. **`departmentId` / `unit` (Đơn vị lập hồ sơ)**:
   - Phòng ban, Khoa đào tạo hoặc Trung tâm nơi chủ hồ sơ công tác và chịu sự phân công nhiệm vụ.
5. **`openedAt` (Thời điểm mở hồ sơ)**:
   - Dấu thời gian (Timestamp ICT, UTC+7) khi văn bản đến đầu tiên được đăng ký vào hồ sơ hoặc khi nhiệm vụ liên kết được bấm bắt đầu triển khai (`IN_PROGRESS`).
6. **`closedAt` (Thời điểm đóng hồ sơ)**:
   - Dấu thời gian khi công việc kết thúc, sản phẩm nghiệm thu được phê duyệt, văn bản đi phúc đáp được phát hành và chủ hồ sơ ấn nút "Đóng hồ sơ" (`Close Dossier`).
7. **`retentionPeriod` (Thời hạn bảo quản)**:
   - Căn cứ theo Bảng thời hạn bảo quản tài liệu chuyên môn của Bộ GD&ĐT/Bộ LĐ-TB&XH và Quyết định số 93/QĐ-CĐKTCNQN:
     * `VINH_VIEN` (Bảo quản vĩnh viễn): Văn bản quy phạm nội bộ, chiến lược phát triển trường, hồ sơ cấp phát văn bằng gốc, hồ sơ Đại hội Đảng bộ trường, hồ sơ thanh tra tài chính định kỳ.
     * `70_NAM` (Bảo quản 70 năm): Hồ sơ gốc của viên chức, hồ sơ kỷ luật cán bộ, bảng điểm tốt nghiệp toàn khóa của học sinh sinh viên.
     * `20_NAM` (Bảo quản 20 năm): Hồ sơ xây dựng, sửa chữa lớn cơ sở vật chất; hồ sơ đề tài nghiên cứu khoa học cấp trường; hồ sơ tuyển sinh các khóa.
     * `10_NAM` (Bảo quản 10 năm): Báo cáo tài chính năm, hồ sơ đấu thầu mua sắm thiết bị xưởng thực hành thường niên, hồ sơ kiểm tra học vụ định kỳ.
     * `5_NAM` (Bảo quản 5 năm): Kế hoạch công tác tháng/quý, biên bản sinh hoạt bộ môn, văn bản hành chính thông thường không quan trọng.
8. **`status` (Trạng thái tác nghiệp hồ sơ)**:
   - `OPEN` (Đang mở): Đang trong quá trình thu thập tài liệu, nhiệm vụ đang giải quyết.
   - `IN_REVIEW` (Đang rà soát): Đã kết thúc nghiệp vụ, Trưởng đơn vị hoặc Tổ trưởng rà soát thành phần tài liệu trước khi đóng.
   - `CLOSED` (Đã đóng): Hồ sơ đã hoàn tất, không cho phép bổ sung chỉnh sửa tài liệu tùy tiện, sẵn sàng bàn giao lưu trữ.
9. **`archiveStatus` (Trạng thái nộp lưu cơ quan)**:
   - `NOT_ARCHIVED` (Chưa nộp lưu): Hồ sơ nằm tại đơn vị công tác.
   - `TRANSFERRED` (Đã nộp lưu): Đã gửi lệnh bàn giao điện tử sang Lưu trữ cơ quan (Phòng Hành chính - Quản trị).
   - `ACCEPTED` (Đã tiếp nhận): Lưu trữ cơ quan đã thẩm định đạt chuẩn và nhập vào Kho Lưu trữ điện tử chính thức.
   - `RETURNED` (Bị trả lại): Lưu trữ cơ quan từ chối tiếp nhận do thiếu thành phần minh chứng hoặc lỗi định dạng, yêu cầu chỉnh lý.
   - `DESTROYED` (Đã tiêu hủy): Tài liệu đã hết thời hạn bảo quản và được tiêu hủy theo Quyết định của Hội đồng tiêu hủy tài liệu Nhà trường.

---

## 3. CÁC THÀNH PHẦN TÀI LIỆU TRONG HỒ SƠ (DOSSIER ITEMS SPECIFICATION)

Hồ sơ công việc điện tử là một **thực thể đa hình (Polymorphic Aggregator)** chứa tất cả các dấu vết và sản phẩm sinh ra trong suốt vòng đời giải quyết công việc. Mỗi tài liệu trong hồ sơ được định danh l�� một `WorkDossierItem` với thứ tự sắp xếp (`itemOrder`), số thứ tự trang (`pageIndex`) và mã băm kiểm tra tính toàn vẹn.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CẤU TRÚC THÀNH PHẦN HỒ SƠ CÔNG VIỆC                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  [1. Tasks]              Nhiệm vụ cấp trường, Subtasks phân rã nội bộ       │
│  [2. Documents]          Văn bản đến khởi xướng, Văn bản đi phát hành       │
│  [3. Directives]         Bút phê điện tử BGH, Ý kiến chỉ đạo Trưởng đơn vị  │
│  [4. Meeting Minutes]    Biên bản họp giao ban, Biên bản thẩm định          │
│  [5. Deliverables]       Báo cáo kết quả, Kế hoạch, Giáo trình hoàn chỉnh   │
│  [6. Verification]       Biên bản nghiệm thu, Chứng thư ký số, Hash SHA-256 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Chi Tiết 6 Loại Thành Phần Tài Liệu

#### 1. Nhiệm Vụ Liên Quan (`tasks`)
- Liên kết với thực thể `Task` mẹ và các `subTasks` con.
- Ghi nhận toàn bộ diễn biến lịch sử: Ngày bắt đầu, hạn chót, tỷ lệ tiến độ, cán bộ DRI, danh sách cộng tác viên (`COLLABORATOR`) và toàn bộ nhật ký trao đổi công việc.

#### 2. Văn Bản Đi và Văn Bản Đến (`incoming/outgoing documents`)
- **Văn bản Đến (Incoming Document)**: Văn bản của cấp trên hoặc đối tác gửi đến là căn cứ phát sinh công việc; số đến, ngày đến, trích yếu, bản scan màu định dạng PDF/A có dấu đỏ nguyên bản.
- **Văn bản Đi (Outgoing Document)**: Văn bản do đơn vị soạn thảo để phúc đáp hoặc báo cáo cấp trên; có số ký hiệu, ngày ban hành, chữ ký số của Ban Giám hiệu và con dấu số điện tử của Nhà trường.
- Bảo đảm chuẩn Phụ lục IV và Phụ lục I Nghị định số 30/2020/NĐ-CP.

#### 3. Bút Phê và Ý Kiến Chỉ Đạo (`directives`)
- Thực thể `DocumentDirective`: Toàn bộ ý kiến phân công, thời hạn giao phó và chỉ đạo chuyên môn của Hiệu trưởng, các Phó Hiệu trưởng hoặc Trưởng đơn vị.
- Dấu thời gian bút phê và chữ ký điện tử xác thực của người ra lệnh.

#### 4. Biên Bản Cuộc Họp (`meeting minutes`)
- Biên bản các cuộc họp triển khai, họp giao ban, họp bàn bạc tập thể, họp hội đồng chuyên môn liên quan đến vụ việc.
- Ghi nhận đầy đủ: Thời gian, thành phần tham dự, người chủ trì, thư ký cuộc họp, tóm tắt ý kiến phát biểu và kết luận cuối cùng.
- Có chữ ký số hoặc văn bản ký tươi scan màu của Thư ký và Chủ tọa cuộc họp.

#### 5. Sản Phẩm Đầu Ra và Báo Cáo (`deliverables`)
- Thực thể `TaskDeliverable`: Toàn bộ kết quả thực hiện nhiệm vụ (Báo cáo tổng kết, Đề án, Chương trình đào tạo, Bảng dự toán quyết toán, Ngân hàng đề thi, Kỷ yếu hội thảo, Tệp mã nguồn phần mềm...).
- Phải được lưu trữ ở các định dạng chuẩn mở bảo đảm khả năng truy xuất lâu dài (PDF, DOCX, XLSX, MP4, PNG).

#### 6. Bằng Chứng Thẩm Tra & Kiểm Định (`verification evidence`)
- Biên bản họp nghiệm thu chuyên môn của Hội đồng;
- Bản thẩm tra tính pháp lý của Phòng Tổ chức - Đảm bảo chất lượng hoặc Phòng Tài chính;
- Vết kiểm toán chữ ký số điện tử (X.509 Certificate Chain, Signing Timestamp từ TSA Server);
- Mã băm an toàn **SHA-256 (`sha256Hash`)** của từng tệp tài liệu được chốt cố định tại thời điểm nộp lưu, bảo đảm chống can thiệp, chống chối bỏ và chống chỉnh sửa trái phép trong suốt thời gian bảo quản.

---

## 4. QUY TRÌNH NỘP LƯU ĐIỆN TỬ VÀO LƯU TRỮ CƠ QUAN (ELECTRONIC TRANSFER WORKFLOW)

Quy trình nộp lưu hồ sơ công việc điện tử vào Lưu trữ cơ quan (Phòng Hành chính - Quản trị) tuân thủ nghiêm ngặt **Điều 30, 31, 32 Nghị định 30/2020/NĐ-CP** và **Kế hoạch số 227/KH-CĐKTCNQN**.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: MỞ HỒ SƠ & TỰ ĐỘNG THU THẬP TÀI LIỆU (During Execution)                                 │
│ • Khi nhận nhiệm vụ/văn bản: Hệ thống tự sinh WorkDossier (Mã, Tiêu đề, Chủ hồ sơ, Đơn vị).          │
│ • Trong quá trình tác nghiệp: Tự động gom Documents, Directives, Subtasks, Deliverables.              │
└───────────────────────────────────┬───────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: ĐÓNG HỒ SƠ & BIÊN MỤC ĐIỆN TỬ (Dossier Completion)                                      │
│ • Nghiệm thu công việc hoàn tất: DRI thực hiện lệnh Đóng hồ sơ (closedAt).                             │
│ • Lập Mục lục hồ sơ điện tử: Đánh số thứ tự tài liệu, rà soát tính đầy đủ của chữ ký số.              │
│ • Trưởng đơn vị kiểm tra và xác nhận đồng ý nộp lưu.                                                  │
└───────────────────────────────────┬───────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: BÀN GIAO ĐIỆN TỬ SANG LƯU TRỮ CƠ QUAN (Electronic Transfer)                             │
│ • DRI ấn "Nộp Lưu Trữ Cơ Quan" -> Trạng thái: TRANSFERRED.                                            │
│ • Sinh Gói nộp lưu số (SIP - Submission Information Package) kèm mã băm SHA-256 toàn vẹn.            │
│ • Thông báo gửi đến Cán bộ Lưu trữ cơ quan (Phòng Hành chính - Quản trị).                             │
└───────────────────────────────────┬───────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 4: THẨM ĐỊNH & TIẾP NHẬN TẠI PHÒNG HC-QT (Verification & Acceptance)                         │
│ • Cán bộ Lưu trữ kiểm tra Checklist 5 bước:                                                           │
│   [1] Đầy đủ văn bản đến, đi, bút phê?                                                                │
│   [2] Định dạng file chuẩn PDF/A scan màu?                                                            │
│   [3] Chữ ký số hợp lệ và nguyên vẹn?                                                                 │
│   [4] Sản phẩm nghiệm thu đầy đủ?                                                                     │
│   [5] Mục lục hồ sơ chuẩn xác?                                                                        │
│                                   │                                                                   │
│       ┌───────────────────────────┴───────────────────────────┐                                       │
│       ▼ Đạt yêu cầu                                           ▼ Không đạt (Thiếu sót)                 │
│ ┌──────────────────────────────┐                       ┌──────────────────────────────┐               │
│ │ archiveStatus = ACCEPTED     │                       │ archiveStatus = RETURNED     │               │
│ │ Cấp số lưu trữ chính thức    │                       │ Ghi rõ lý do trả lời chỉnh lý│               │
│ │ Khóa vĩnh viễn hồ sơ         │                       │ Trả lại DRI bổ sung trong 3d │               │
│ └──────────────────────────────┘                       └──────────────────────────────┘               │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Quy Định Thời Hạn Nộp Lưu (Khoản 1 Điều 31 NĐ 30/2020)
- **Hồ sơ hành chính - nghiệp vụ thường xuyên**: Phải nộp lưu vào Lưu trữ cơ quan trong thời hạn **01 năm** kể từ ngày công việc kết thúc.
- **Hồ sơ nghiên cứu khoa học, đề án xây dựng cơ sở vật chất**: Phải nộp lưu trong thời hạn **03 tháng** kể từ ngày công trình được nghiệm thu chính thức.
- **QCET SLA nội bộ**: Hệ thống E-Office khuyến nghị và thiết lập mốc cảnh báo nộp lưu số trong vòng **15 ngày làm việc** kể từ khi nhiệm vụ được phê duyệt `COMPLETED`.

---

## 5. RÀNG BUỘC KỶ LUẬT HÀNH CHÍNH & ĐÁNH GIÁ VIÊN CHỨC (ADMINISTRATIVE SANCTIONS)

Việc mở, lập và nộp lưu hồ sơ công việc điện tử là một **chỉ số đo lường hiệu suất công tác (KPI) bắt buộc** tại QCET:

1. **Điều kiện tiên quyết để Xếp loại Thi đua (Nghị định 90/2020/NĐ-CP)**:
   - Viên chức, giảng viên có hồ sơ công việc quá hạn nộp lưu quá 30 ngày mà không có lý do chính đáng sẽ **không được xem xét đánh giá xếp loại "Hoàn thành xuất sắc nhiệm vụ"** trong năm học đó.
   - Trưởng đơn vị có tỷ lệ hồ sơ nộp lưu đúng hạn dưới 85% sẽ bị trừ điểm thi đua tập thể của đơn vị.
2. **Thủ tục chuyển công tác, thôi việc, nghỉ hưu**:
   - Cán bộ, viên chức khi chuyển công tác, điều động nội bộ, nghỉ chế độ hoặc chấm dứt hợp đồng lao động bắt buộc phải thực hiện bàn giao toàn bộ các hồ sơ công việc đang mở (`OPEN`) và nộp lưu các hồ sơ đã đóng (`CLOSED`) cho người tiếp nhận hoặc Lưu trữ cơ quan.
   - Phòng Hành chính - Quản trị và Phòng Tổ chức - Đảm bảo chất lượng chỉ ký xác nhận hoàn thành thủ tục hành chính khi hệ thống E-Office xác nhận người đó không còn tồn đọng hồ sơ chưa bàn giao.
3. **Tiêu hủy tài liệu số hết h��n (Điều 32 NĐ 30/2020)**:
   - Tuyệt đối nghiêm cấm cá nhân tự ý xóa bỏ hồ sơ công việc hoặc tài liệu đính kèm trên hệ thống.
   - Việc tiêu hủy tài liệu số hết giá trị bảo quản phải thực hiện theo quy trình pháp lý:
     1. Thành lập Hội đồng thẩm định và tiêu hủy tài liệu của Nhà trường (do Lãnh đạo Trường làm Chủ tịch);
     2. Lập Danh mục hồ sơ, tài liệu xin tiêu hủy;
     3. Báo cáo cơ quan có thẩm quyền thẩm định theo quy định của Luật Lưu trữ;
     4. Hiệu trưởng ban hành Quyết định tiêu hủy;
     5. Hệ thống thực hiện chuyển trạng thái `archiveStatus = DESTROYED`, xóa vật lý tệp nhị phân nhưng **lưu giữ vĩnh viễn siêu dữ liệu mục lục và biên bản tiêu hủy trong vết kiểm toán bất biến**.

---

## 6. ĐẶC TẢ MÔ HÌNH DỮ LIỆU PRISMA (DATA MODEL PRISMA EXTENSION)

```prisma
// ===================================================
// ENUMS FOR WORK DOSSIER & ARCHIVING
// ===================================================

enum RetentionPeriod {
  VINH_VIEN   // Bảo quản vĩnh viễn (Văn bản chiến lược, văn bằng, nhân sự cấp cao)
  NAM_70      // Bảo quản 70 năm (Hồ sơ gốc viên chức, bảng điểm tốt nghiệp)
  NAM_20      // Bảo quản 20 năm (Cơ sở vật chất, đề tài NCKH, hồ sơ tuyển sinh)
  NAM_10      // Bảo quản 10 năm (Báo cáo tài chính, đấu thầu thường niên)
  NAM_5       // Bảo quản 5 năm (Văn bản hành chính thường nhật, kế hoạch tuần)
}

enum DossierStatus {
  OPEN        // Đang mở, đang thu thập tài liệu giải quyết công việc
  IN_REVIEW   // Đang rà soát hoàn thiện hồ sơ trước khi đóng
  CLOSED      // Đã đóng gói hồ sơ, sẵn sàng nộp lưu
}

enum ArchiveStatus {
  NOT_ARCHIVED // Chưa nộp lưu (Đang ở đơn vị)
  TRANSFERRED  // Đã nộp lưu điện tử, chờ Lưu trữ cơ quan thẩm định
  ACCEPTED     // Đã tiếp nhận vào Kho Lưu trữ cơ quan chính thức
  RETURNED     // Bị trả lời chỉnh lý bổ sung
  DESTROYED    // Đã tiêu hủy theo Quyết định Hội đồng
}

enum DossierItemType {
  TASK                // Nhiệm vụ hoặc Subtask liên quan
  DOCUMENT_INCOMING   // Văn bản đến khởi xướng
  DOCUMENT_OUTGOING   // Văn bản đi báo cáo, phúc đáp
  DIRECTIVE           // Bút phê chỉ đạo của BGH / Trưởng đơn vị
  MEETING_MINUTES     // Biên bản cuộc họp / Hội đồng chuyên môn
  DELIVERABLE         // Báo cáo kết quả / Sản phẩm minh chứng hoàn chỉnh
  VERIFICATION_EVIDENCE // Chứng thư ký số, biên bản nghiệm thu, SHA-256
}

// ===================================================
// WORK DOSSIER (HỒ SƠ CÔNG VIỆC)
// ===================================================

model WorkDossier {
  id              String            @id @default(cuid())
  code            String            @unique @db.VarChar(50) // Cấu trúc: Năm.Nhóm.ĐơnVị-STT
  title           String            @db.VarChar(500)
  description     String?           @db.Text
  
  // Chủ sở hữu & Đơn vị lập
  ownerId         String            @map("owner_id")
  owner           User              @relation("DossierOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  departmentId    String            @map("department_id") @db.VarChar(50)
  department      Department        @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  
  // Thời gian vòng đời
  openedAt        DateTime          @default(now()) @map("opened_at")
  closedAt        DateTime?         @map("closed_at")
  
  // Thời hạn bảo quản & Trạng thái
  retentionPeriod RetentionPeriod   @default(NAM_10) @map("retention_period")
  status          DossierStatus     @default(OPEN)
  archiveStatus   ArchiveStatus     @default(NOT_ARCHIVED) @map("archive_status")
  
  // Thành phần hồ sơ
  items           WorkDossierItem[]
  
  // Thẩm định & Tiếp nhận Lưu trữ cơ quan
  archivedAt      DateTime?         @map("archived_at")
  archivistId     String?           @map("archivist_id")
  archivist       User?             @relation("DossierArchivist", fields: [archivistId], references: [id], onDelete: SetNull)
  archiveShelfNo  String?           @map("archive_shelf_no") @db.VarChar(100) // Vị trí kho số / hộp lưu trữ
  acceptanceNote  String?           @map("acceptance_note") @db.Text
  
  // Lịch sử bàn giao & kiểm toán
  transfers       DossierTransferHistory[]
  
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  @@index([departmentId, retentionPeriod, archiveStatus])
  @@index([ownerId, status])
  @@map("work_dossiers")
}

// ===================================================
// WORK DOSSIER ITEM (THÀNH PHẦN TÀI LIỆU TRONG HỒ SƠ)
// ===================================================

model WorkDossierItem {
  id              String            @id @default(cuid())
  dossierId       String            @map("dossier_id")
  itemType        DossierItemType   @map("item_type")
  title           String            @db.VarChar(500)
  itemOrder       Int               @default(1) @map("item_order")
  pageNumber      Int?              @map("page_number")
  
  // Liên kết đa hình sang các thực thể nguồn
  taskId          String?           @map("task_id")
  task            Task?             @relation(fields: [taskId], references: [id], onDelete: SetNull)
  documentId      String?           @map("document_id")
  document        Document?         @relation(fields: [documentId], references: [id], onDelete: SetNull)
  deliverableId   String?           @map("deliverable_id")
  deliverable     TaskDeliverable?  @relation(fields: [deliverableId], references: [id], onDelete: SetNull)
  
  // Siêu dữ liệu tệp & Tính toàn vẹn
  fileUrl         String?           @map("file_url") @db.Text
  fileName        String?           @map("file_name") @db.VarChar(255)
  fileSize        Int?              @map("file_size")
  mimeType        String?           @map("mime_type") @db.VarChar(100)
  sha256Hash      String?           @map("sha256_hash") @db.VarChar(64) // Băm SHA-256 bảo đảm toàn vẹn
  
  // Xác thực chữ ký số X.509
  isDigitallySigned Boolean         @default(false) @map("is_digitally_signed")
  signerInfo      String?           @map("signer_info") @db.VarChar(255)
  signedAt        DateTime?         @map("signed_at")
  
  dossier         WorkDossier       @relation(fields: [dossierId], references: [id], onDelete: Cascade)
  createdAt       DateTime          @default(now()) @map("created_at")

  @@index([dossierId, itemOrder])
  @@map("work_dossier_items")
}

// ===================================================
// DOSSIER TRANSFER HISTORY (NHẬT KÝ BÀN GIAO LƯU TRỮ)
// ===================================================

model DossierTransferHistory {
  id              String            @id @default(cuid())
  dossierId       String            @map("dossier_id")
  senderId        String            @map("sender_id")
  receiverId      String?           @map("receiver_id")
  status          ArchiveStatus
  decisionReason  String?           @map("decision_reason") @db.Text
  transferredAt   DateTime          @default(now()) @map("transferred_at")
  
  dossier         WorkDossier       @relation(fields: [dossierId], references: [id], onDelete: Cascade)
  sender          User              @relation("TransferSender", fields: [senderId], references: [id], onDelete: Restrict)
  receiver        User?             @relation("TransferReceiver", fields: [receiverId], references: [id], onDelete: SetNull)

  @@index([dossierId, transferredAt])
  @@map("dossier_transfer_histories")
}
```

---

## 7. KẾ HOẠCH BẢO VỆ DỮ LIỆU & AN TOÀN TRUY CẬP (SECURITY & DATA INTEGRITY)

1. **Tính bất biến sau khi nộp lưu (Post-Transfer Immutability)**:
   - Khi một hồ sơ công việc chuyển trạng thái `archiveStatus = ACCEPTED`, hệ thống kích hoạt cơ chế khóa ghi (`Read-Only Lock`).
   - Mọi nỗ lực chỉnh sửa tiêu đề, xóa tệp hoặc cập nhật nội dung văn bản bên trong hồ sơ sẽ bị chặn đứng tại tầng Middleware và Prisma Extension.
2. **Khai thác và mượn hồ sơ điện tử (Access & Borrowing Policy)**:
   - Cán bộ trong trường muốn khai thác hồ sơ lưu trữ của đơn vị khác phải gửi Phiếu yêu cầu khai thác tài liệu điện tử được Trưởng phòng Hành chính - Quản trị phê duyệt.
   - Quyền truy cập được cấp tạm thời có thời hạn (`accessExpiresAt`) và tự động thu hồi khi hết hạn.
3. **Đối chiếu mã băm định kỳ (Periodic Integrity Scrubbing)**:
   - Hệ thống tự động thực thi cronjob hàng quý tính toán lại mã băm SHA-256 của toàn bộ tệp lưu trữ trong kho và so sánh với giá trị `sha256Hash` gốc.
   - Nếu phát hiện bất kỳ sự sai lệch nào (bit rot hoặc can thiệp tệp ngoài ý muốn), cảnh báo an ninh lập tức được gửi đến Ban Giám hiệu và Bộ phận An toàn thông tin.
