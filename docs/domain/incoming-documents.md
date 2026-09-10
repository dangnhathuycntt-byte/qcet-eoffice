# CANONICAL DOMAIN WORKFLOW: VĂN BẢN ĐẾN (INCOMING DOCUMENTS)
## HỆ THỐNG ĐIỀU HÀNH & TÁC NGHIỆP ĐIỆN TỬ Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn  (QCET E-OFFICE)

**Tình trạng tài liệu:** Đặc tả chuẩn tắc nghiệp vụ miền (Canonical Domain Specification)  
**Căn cứ pháp lý cốt lõi:**
- Nghị định số 30/2020/NĐ-CP ngày 05/03/2020 của Chính phủ về công tác văn thư (Điều 20 - Điều 27 & Phụ lục IV).
- Luật Giao dịch điện tử số 20/2023/QH15 ngày 22/06/2023 của Quốc hội.
- Luật Bảo vệ bí mật nhà nước số 117/2025/QH15 & Luật Dữ liệu năm 2025.
- Quyết định số 283/QĐ-CĐKTCNQN ngày 19/08/2026 của Hiệu trưởng QCET ban hành Quy chế làm việc.
- Quyết định số 420/QĐ-CĐKTCNQN ngày 03/12/2025 của Hiệu trưởng QCET về phân công nhiệm vụ Ban Giám hiệu.
- Quyết định số 93/QĐ-CĐKTCNQN & Kế hoạch số 227/KH-CĐKTCNQN về công tác văn thư, lưu trữ cơ quan.

---

## 1. NGUYÊN TẮC VẬN HÀNH BẮT BUỘC (CORE INVARIANTS)

1. **Nguyên tắc Tập trung Văn thư (Clerical Centralization Invariant)**:
   Mọi văn bản, tài liệu gửi đến Nhà trường qua bất kỳ kênh nào (bưu chính, trực tiếp, fax, thư điện tử công vụ, hoặc Trục liên thông văn bản quốc gia VDXP / LGSP ) đều phải được tiếp nhận, xử lý sơ bộ và đăng ký vào Sổ văn bản đến điện tử tại Bộ phận Văn thư thuộc Phòng Hành chính - Quản trị trước khi chuyển giao. Cá nhân, đơn vị không được tự ý tiếp nhận và xử lý văn bản đến ngoài luồng hệ thống.

2. **Nguyên tắc Cấp số Liên tục Bất biến (Continuous Numbering Invariant)**:
   Số văn bản đến được cấp tự động, tăng dần bắt đầu từ số 01 vào 00:00:00 ngày 01 tháng 01 và kết thúc vào 23:59:59 ngày 31 tháng 12 hàng năm. Tuyệt đối không nhảy số, lùi số, trùng số hoặc sửa số đã cấp. Cấp số thực hiện qua cơ chế giao dịch khóa hàng (Atomic Database Locking) trên thực thể `DocumentNumberSequence`.

3. **Nguyên tắc Chỉ đạo Hai cấp Chuẩn tắc (Two-Tier Directive Model)**:
   Luồng chỉ đạo văn bản đến tại QCET tuân thủ mô hình 2 cấp:
   - Cấp 1 (Trường -> Đơn vị): Lãnh đạo có thẩm quyền (Ban Giám hiệu) ghi bút phê chỉ định Đơn vị chủ trì (`leadDepartmentId`), Đơn vị phối hợp (`collaboratorIds`), thời hạn xử lý của Trường (`dueDate`).
   - Cấp 2 (Đơn vị -> Cá nhân): Trưởng đơn vị chủ trì (`TRUONG_PHONG`) phân công Cán bộ thụ lý chính (`leadUserId`), các thành viên phối hợp và giao hạn xử lý chi tiết của đơn vị (`subDueDate` <= `dueDate`).

4. **Nguyên tắc Tự động Hóa Văn bản - Nhiệm vụ (Document-to-Task Automation)**:
   Ngay khi Lãnh đạo có thẩm quyền hoàn tất bút phê xác định đơn vị chủ trì, hệ thống tự động sinh một bản ghi `Task` cấp trường (`scope: SCHOOL`) liên kết 2 chiều với văn bản (`Document.linkedTaskId` <-> `Task.documentId`). Trưởng đơn vị chủ trì chịu trách nhiệm quản lý Task này.

5. **Nguyên tắc Toàn vẹn & An toàn Dữ liệu (Integrity & Security Invariant)**:
   Tệp đính kèm số hóa từ văn bản giấy bắt buộc scan màu định dạng PDF/A, độ phân giải tối thiểu 200 dpi, rõ con dấu đỏ và chữ ký. Mỗi tệp được hệ thống gắn mã băm SHA-256 chống chối bỏ. Tuyệt đối cấm số hóa và đăng tải văn bản thuộc danh mục bí mật nhà nước (Mật, Tối mật, Tuyệt mật) lên hệ thống Internet thông thường.

---

## 2. VÒNG ĐỜI VĂN BẢN ĐẾN (CANONICAL LIFECYCLE STATE MACHINE)

Vòng đời chuẩn tắc của văn bản đến gồm 11 trạng thái tuần tự và các nhánh rẽ nghiệp vụ:

```
[TIẾP NHẬN]
     │
     ▼
  RECEIVED ─────────────────────────┐ (Từ chối / Chuyển trả văn bản sai nơi nhận)
     │                              │
     ▼ (Văn thư bóc bì, scan số hóa)
 REGISTERED                         │
     │                              │
     ▼ (Văn thư lập phiếu trình)    │
 PRESENTED                          │
     │                              │
     ▼ (Bút phê BGH cấp 1)          │
  DIRECTED                          │
     │                              │
     ▼ (Tự động kích hoạt Task)     │
LEAD_UNIT_ASSIGNED                  │
     │                              │
     ▼ (Trưởng đơn vị phân công)    │
PERSON_ASSIGNED                     │
     │                              │
     ▼ (Chuyên viên bắt đầu xử lý)  │
IN_PROGRESS                         │
     │                              │
     ▼ (Nộp báo cáo/dự thảo)        │
RESULT_SUBMITTED                    │
     │                              │
     ▼ (Lãnh đạo đơn vị & BGH duyệt)│
  RESOLVED                          │
     │                              │
     ▼ (Đóng gói hồ sơ điện tử)     │
   FILED                            │
     │                              │
     ▼ (Nộp lưu trữ cơ quan)        │
  ARCHIVED                          ▼
                               [REJECTED / RETURNED]
```

### Chi tiết 11 Trạng thái Vòng đời

| Mã trạng thái | Tên trạng thái | Diễn giải nghiệp vụ | Tác nhân chính | Trạng thái Prisma DocumentStatus |
|---|---|---|---|---|
| `RECEIVED` | Đã tiếp nhận | Văn thư nhận bản giấy từ bưu tá hoặc nhận gói tin điện tử từ Trục liên thông (VDXP/LGSP). Chưa vào sổ. | Văn thư (`VAN_THU`) | `CHO_PHAN_CONG` |
| `REGISTERED` | Đã vào sổ | Đã trích xuất thông tin, scan tệp PDF/A, cấp Số đến chính thức trong Sổ văn bản đến của năm. | Văn thư (`VAN_THU`) | `CHO_PHAN_CONG` |
| `PRESENTED` | Đã trình lãnh đạo | Đã lập phiếu trình điện tử gửi tới Hiệu trưởng hoặc Phó Hiệu trưởng phụ trách lĩnh vực. | Văn thư (`VAN_THU`) | `CHO_PHAN_CONG` |
| `DIRECTED` | Đã có bút phê chỉ đạo | Lãnh đạo Nhà trường đã ghi ý kiến chỉ đạo, chọn đơn vị chủ trì, đơn vị phối hợp và hạn xử lý. | Ban Giám hiệu (`BAN_GIAM_HIEU`) | `CHO_PHAN_CONG` |
| `LEAD_UNIT_ASSIGNED` | Đã giao đơn vị chủ trì | Hệ thống kích hoạt tạo Task liên kết; văn bản xuất hiện trong hộp thư đến xử lý của Trưởng đơn vị. | Hệ thống / Trưởng đơn vị | `DANG_XU_LY` |
| `PERSON_ASSIGNED` | Đã phân công cán bộ | Trưởng đơn vị đã giao đích danh chuyên viên/giảng viên thụ lý chính và người phối hợp trong đơn vị. | Trưởng đơn vị (`TRUONG_PHONG`) | `DANG_XU_LY` |
| `IN_PROGRESS` | Đang giải quyết | Chuyên viên thụ lý đang thực hiện các bước nghiệp vụ, thu thập tài liệu, lấy ý kiến chuyên môn. | Chuyên viên (`CHUYEN_VIEN`) | `DANG_XU_LY` |
| `RESULT_SUBMITTED` | Đã nộp kết quả xử lý | Chuyên viên hoàn thành dự thảo văn bản trả lời, báo cáo kết quả hoặc đề xuất, nộp lên Trưởng phòng duyệt. | Chuyên viên (`CHUYEN_VIEN`) | `CHO_PHE_DUYET` |
| `RESOLVED` | Đã giải quyết xong | Kết quả xử lý được Lãnh đạo đơn vị và Ban Giám hiệu nghiệm thu (hoặc ban hành văn bản đi trả lời). | Lãnh đạo đơn vị / BGH | `DA_HOAN_THANH` |
| `FILED` | Đã lập hồ sơ công việc | Chuyên viên thu thập đầy đủ văn bản đến, chỉ đạo, dự thảo, sản phẩm đầu ra vào Mã hồ sơ công việc điện tử. | Chuyên viên (`CHUYEN_VIEN`) | `LUU_THEO_DOI` |
| `ARCHIVED` | Đã nộp lưu trữ cơ quan | Đơn vị bàn giao hồ sơ điện tử đóng gói cho Lưu trữ lịch sử Nhà trường (Phòng HC-QT) kèm biên bản nộp lưu. | Lưu trữ viên (`VAN_THU`) | `LUU_THEO_DOI` |

---

## 3. TRÁCH NHIỆM VÀ QUYỀN HẠN CỦA CÁC TÁC NHÂN (RACI MATRIX)

### 3.1. Phân định vai trò và trách nhiệm chi tiết

#### A. Bộ phận Văn thư (`VAN_THU` - Phòng Hành chính - Quản trị)
- **Tiếp nhận & Kiểm tra sơ bộ**: Kiểm tra bì thư, dấu niêm phong, tính nguyên vẹn của văn bản giấy; kiểm tra chữ ký số, chứng thư số của cơ quan gửi đối với văn bản điện tử qua Trục liên thông.
- **Xử lý phong bì riêng**: Nếu bì thư ghi tên cá nhân hoặc các tổ chức đoàn thể (Đảng ủy, Công đoàn, Đoàn Thanh niên), Văn thư chuyển thẳng người nhận không bóc bì, trừ trường hợp có quy định khác.
- **Scan & Số hóa chuẩn mực**: Bóc bì văn bản gửi chung cho Nhà trường, thực hiện scan màu 100% tài liệu kèm dấu và chữ ký theo định dạng PDF/A, độ phân giải tối thiểu 200 dpi.
- **Đăng ký vào Sổ điện tử**: Nhập đầy đủ 09 trường thông tin bắt buộc theo Phụ lục IV NĐ 30/2020/NĐ-CP. Thực hiện lệnh cấp Số đến tự động.
- **Trình văn bản**: Chuyển giao văn bản điện tử đến Ban Giám hiệu ngay trong ngày làm việc; đối với văn bản có dấu độ khẩn (`HOA_TOC`, `THUONG_KHAN`, `KHAN`) phải trình ngay trong vòng 30 phút kể từ khi tiếp nhận.
- **Đôn đốc & Theo dõi**: Giám sát tiến độ giải quyết chung toàn trường, cảnh báo văn bản sắp đến hạn hoặc quá hạn qua Dashboard và hệ thống thông báo.

#### B. Lãnh đạo có thẩm quyền / Ban Giám hiệu (`BAN_GIAM_HIEU`)
- **Xem xét & Định hướng**: Căn cứ Quyết định 420/QĐ-CĐKTCNQN về phân công lĩnh vực công tác, Hiệu trưởng hoặc Phó Hiệu trưởng phụ trách trực tiếp xem xét văn bản đến.
- **Ghi Bút phê điện tử (`DocumentDirective`)**:
  - Xác định đơn vị chủ trì (`assignedDeptId`): Duy nhất 01 đơn vị chịu trách nhiệm chính (Phòng, Khoa, hoặc Trung tâm).
  - Xác định đơn vị phối hợp (`collaboratorIds`): Danh sách các phòng/khoa có trách nhiệm cung cấp thông tin, tham gia thẩm định.
  - Xác định hạn xử lý (`deadline`): Căn cứ vào tính chất công việc hoặc thời hạn cơ quan cấp trên yêu cầu.
  - Nội dung chỉ đạo cụ thể (`instruction`): Nêu rõ mục tiêu, yêu cầu chuyên môn, cách thức giải quyết.

#### C. Trưởng đơn vị chủ trì (`TRUONG_PHONG` - Trưởng phòng/Trưởng khoa/Giám đốc trung tâm)
- **Tiếp nhận chỉ đạo cấp 1**: Nhận thông báo văn bản chuyển về đơn vị kèm Task tự động phát sinh.
- **Phân công cấp 2 trong đơn vị**:
  - Chọn Cán bộ thụ lý chính (`leadUserId`): Một chuyên viên hoặc giảng viên thuộc đơn vị.
  - Chọn cán bộ phối hợp nội bộ: Phân bổ nếu nhiệm vụ phức tạp cần nhiều người.
  - Thiết lập hạn xử lý nội bộ (`subDueDate`): Bắt buộc thời hạn này phải trước hoặc bằng thời hạn Ban Giám hiệu giao cho đơn vị ít nhất 01 ngày làm việc để Trưởng đơn vị có thời gian thẩm định kết quả.
  - Ghi chỉ đạo nội bộ: Hướng dẫn nghiệp vụ chi tiết cho cán bộ thụ lý.
- **Kiểm tra, đôn đốc & Thẩm tra kết quả**: Đánh giá sản phẩm dự thảo, báo cáo do chuyên viên nộp trước khi trình Ban Giám hiệu phê duyệt.

#### D. Chuyên viên / Giảng viên thụ lý chính (`CHUYEN_VIEN`)
- **Thực thi nhiệm vụ**: Nghiên cứu hồ sơ gốc, phối hợp với các đơn vị liên quan thu thập số liệu, xây dựng văn bản trả lời hoặc phương án triển khai.
- **Cập nhật tiến độ**: Báo cáo tình hình xử lý trên Task Hub, yêu cầu gia hạn nếu gặp vướng mắc khách quan có lý do chính đáng.
- **Trình kết quả**: Tải lên sản phẩm hoàn thành (`TaskDeliverable`), liên kết dự thảo văn bản đi (nếu có) để Trưởng đơn vị kiểm tra.
- **Lập hồ sơ công việc điện tử (`FILED`)**: Đưa toàn bộ tài liệu phát sinh trong quá trình xử lý vào Hồ sơ công việc theo danh mục hồ sơ cơ quan quy định tại Quyết định 93/QĐ-CĐKTCNQN.

### 3.2. Bảng Ma trận RACI theo từng bước vòng đời

| Bước / Hoạt động | Văn thư cơ quan | Ban Giám hiệu | Trưởng đơn vị | Chuyên viên thụ lý | Đơn vị phối hợp |
|---|:---:|:---:|:---:|:---:|:---:|
| 1. Tiếp nhận văn bản, kiểm tra tính hợp lệ | **R**, **A** | I | I | I | I |
| 2. Scan số hóa, cấp Số đến vào sổ Phụ lục IV | **R**, **A** | I | I | I | I |
| 3. Lập phiếu trình lãnh đạo (bản giấy/điện tử) | **R** | **A** | I | I | I |
| 4. Bút phê cấp 1: Giao đơn vị chủ trì & hạn xử lý | I | **R**, **A** | C | I | C |
| 5. Phân công cấp 2: Giao cán bộ thụ lý trực tiếp | I | I | **R**, **A** | I | I |
| 6. Nghiên cứu văn bản, triển khai giải quyết | I | I | A | **R** | C |
| 7. Lấy ý kiến tham gia của đơn vị phối hợp | I | I | I | **R** | **R**, C |
| 8. Trình kết quả giải quyết (Báo cáo/Dự thảo) | I | I | A | **R** | I |
| 9. Thẩm định kết quả và Phê duyệt hoàn thành | I | **A** | **R** | I | I |
| 10. Lập hồ sơ công việc điện tử (`FILED`) | C | I | A | **R** | I |
| 11. Đóng gói, nộp lưu trữ cơ quan (`ARCHIVED`) | **R**, **A** | I | I | **R** | I |

*Chú giải: R (Responsible - Thực hiện), A (Accountable - Chịu trách nhiệm chính/Phê duyệt), C (Consulted - Tham vấn/Phối hợp), I (Informed - Nhận thông báo).*

---

## 4. MÔ HÌNH CHỈ ĐẠO HAI CẤP (TWO-TIER DIRECTIVE MODEL)

Hệ thống QCET E-Office thiết kế luồng chỉ đạo phân tầng bảo đảm nguyên tắc cấp bậc hành chính nhà nước nhưng tối ưu hóa tốc độ xử lý:

```
[VĂN BẢN ĐẾN ĐÃ VÀO SỔ] (Document: REGISTERED)
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 1: CHỈ ĐẠO CẤP TRƯỜNG (School Leader -> Unit)          │
│ Tác nhân: Hiệu trưởng / Phó Hiệu trưởng theo QĐ 420         │
│ Hành động: Ghi nhận Bút phê điện tử (DocumentDirective)     │
│  - Đơn vị chủ trì: Department ID (Khoa/Phòng/Trung tâm)    │
│  - Đơn vị phối hợp: Array of Department IDs                 │
│  - Hạn xử lý của trường: Deadline (ICT Date)                │
│  - Nội dung chỉ đạo: Directive text                         │
│                                                             │
│ HỆ QUẢ HỆ THỐNG:                                            │
│  - Tự động sinh Task: scope=SCHOOL, linkedTaskId            │
│  - Document.status -> DANG_XU_LY                            │
│  - Notification gửi tới Trưởng đơn vị chủ trì               │
└─────────────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ TIER 2: CHỈ ĐẠO CẤP ĐƠN VỊ (Unit Head -> Specialist)        │
│ Tác nhân: Trưởng phòng / Trưởng khoa chủ trì                │
│ Hành động: Cập nhật điều phối trên Task Hub & Document      │
│  - Cán bộ thụ lý chính: User ID (Document.leadUserId)       │
│  - Cán bộ phối hợp nội bộ: Collaborator User IDs            │
│  - Hạn xử lý nội bộ: subDueDate <= School Deadline          │
│  - Hướng dẫn chuyên môn: Internal instructions              │
│                                                             │
│ HỆ QU�� HỆ THỐNG:                                            │
│  - Task.primaryOwnerId = leadUserId                         │
│  - Task.status = IN_PROGRESS                                │
│  - Notification gửi tới Cán bộ thụ lý qua Web App & Telegram│
└─────────────────────────────────────────────────────────────┘
             │
             ▼
[CHUYÊN VIÊN THỰC THI & LẬP HỒ SƠ CÔNG VIỆC]
```

### Các ràng buộc nghiệp vụ của mô hình 2 cấp:
1. **Ràng buộc thời hạn (Deadline Monotonicity)**: `subDueDate` (Hạn giao chuyên viên) không bao giờ được phép lớn hơn `dueDate` (Hạn Lãnh đạo trường giao). Hệ thống tự động từ chối nếu Trưởng đơn vị đặt hạn vượt quá hạn cấp Trường.
2. **Ràng buộc thẩm quyền giao việc**: Chỉ Lãnh đạo trường mới có quyền đổi Đơn vị chủ trì. Nếu đơn vị nhận thấy văn bản không thuộc chức năng nhiệm vụ, Trưởng đơn vị phải làm Phiếu chuyển trả hoặc báo cáo Ban Giám hiệu điều chỉnh bút phê, không được tự ý chuyển sang đơn vị khác.
3. **Ràng buộc ủy quyền (Delegation Safety)**: Trong trường hợp Trưởng phòng ủy quyền cho Phó Trưởng phòng điều phối theo module `DelegationGrant` (hoặc `DacumDelegation`), người được ủy quyền có toàn quyền thực hiện Tier 2 nhưng không được tự phân công chính mình thành cán bộ thụ lý chính nhằm né tránh kiểm soát (Self-Assignment Prevention).
4. **Cơ chế Xin gia hạn thời hạn giải quyết văn bản đến (`RequestExtension`)**:
   - Khi phát sinh lý do khách quan (thu thập số liệu phức tạp từ nhiều đơn vị, chờ hướng dẫn của cấp trên, giải trình liên ngành...), Cán bộ thụ lý hoặc Trưởng đơn vị chủ trì có quyền tạo "Phiếu xin gia hạn thời hạn giải quyết" (`ExtensionRequest`).
   - Phiếu gia hạn bao gồm: Thời hạn hiện tại (`currentDeadline`), thời hạn đề xuất mới (`requestedDeadline`), lý do giải trình chi tiết và tài liệu minh chứng đính kèm.
   - **Thẩm quyền phê duyệt**: Bắt buộc phải do đúng Lãnh đạo Ban Giám hiệu (người ký Bút phê chỉ đạo ban đầu hoặc Hiệu trưởng) ký duyệt điện tử. Trưởng đơn vị chủ trì tuyệt đối không được tự ý gia hạn thời hạn cấp trường.
   - Khi BGH chấp thuận: Hệ thống tự động cập nhật `Document.dueDate` và `Task.dueDate`, ghi nhật ký kiểm toán bất biến và gửi thông báo cho Văn thư cơ quan để cập nhật tiến độ đôn đốc. Nếu bị từ chối, đơn vị chủ trì phải tiếp tục hoàn thành đúng hạn gốc.

---

## 5. CƠ CHẾ LIÊN THÔNG VĂN BẢN VỚI TÁC NGHIỆP (DOCUMENT-TO-TASK PIPELINE)

Khi Lãnh đạo Ban Giám hiệu lưu bút phê cấp 1, hệ thống thực thi giao dịch nguyên khối (Prisma Transaction) để chuyển hóa văn bản hành chính thành thực thể tác nghiệp có thể theo dõi tiến độ:

```typescript
// Đặc tả logic chuyển hóa Văn bản đến thành Nhiệm vụ (Document-to-Task)
async function executeDocumentDirectivePipeline(
  directive: DocumentDirectiveInput,
  actor: UserSession
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Lưu bản ghi Bút phê điện tử
    const createdDirective = await tx.documentDirective.create({
      data: {
        documentId: directive.documentId,
        leaderId: actor.userId,
        instruction: directive.instruction,
        deadline: directive.deadline ? new Date(directive.deadline) : null,
        assignedDeptId: directive.assignedDeptId,
        collaboratorIds: directive.collaboratorIds?.join(","),
        isTaskGenerated: true,
      },
    });

    // 2. Tự động sinh Nhiệm vụ cấp trường (Task) trong Task Hub
    const document = await tx.document.findUniqueOrThrow({
      where: { id: directive.documentId },
    });

    const generatedTask = await tx.task.create({
      data: {
        title: `[VB Đến ${document.registrationNumber}/${document.documentYear}] ${document.summary}`,
        description: `Ý KIẾN CHỈ ĐẠO CỦA LÃNH ĐẠO TRƯỜNG:\n${directive.instruction}\n\nTrích yếu văn bản: ${document.summary}\nCơ quan ban hành: ${document.issuingAuthority}\nSố ký hiệu gốc: ${document.originalNumber}`,
        scope: "SCHOOL",
        departmentId: directive.assignedDeptId,
        dueDate: directive.deadline ? new Date(directive.deadline) : document.dueDate,
        priority: mapUrgencyToPriority(document.urgency),
        status: "NOT_STARTED",
        documentId: document.id, // Liên kết Task -> Document
        createdById: actor.userId,
      },
    });

    // 3. Cập nhật liên kết ngược trên Document và chuyển trạng thái
    await tx.document.update({
      where: { id: document.id },
      data: {
        status: "DANG_XU_LY",
        leadDepartmentId: directive.assignedDeptId,
        dueDate: directive.deadline ? new Date(directive.deadline) : document.dueDate,
        linkedTaskId: generatedTask.id,
      },
    });

    // 4. Khởi tạo Thông báo đẩy (In-app Notification Queue) tới Trưởng đơn vị
    await tx.notification.create({
      data: {
        userId: await getDepartmentHeadUserId(tx, directive.assignedDeptId),
        title: `Văn bản đến cần chỉ đạo: Số ${document.registrationNumber}/${document.documentYear}`,
        body: `Lãnh đạo trường đã giao đơn vị chủ trì xử lý: "${document.summary}"`,
        category: "document",
        type: "DIRECTIVE_RECEIVED",
        linkHref: `/tasks?selectedTaskId=${generatedTask.id}`,
      },
    });

    return { createdDirective, generatedTask };
  });
}
```

---

## 6. SỔ ĐĂNG KÝ VĂN BẢN ĐẾN ĐIỆN TỬ (PHỤ LỤC IV NGHỊ ĐỊNH 30/2020/NĐ-CP)

Sổ đăng ký văn bản đến trên QCET E-Office tuân thủ đầy đủ 09 trường thông tin tiêu chuẩn theo Phụ lục IV NĐ 30/2020/NĐ-CP:

| Cột số | Tên trường hiển thị | Kiểu dữ liệu | Mô tả & Quy chuẩn Nghị định 30 | Ánh xạ Prisma Schema |
|:---:|---|---|---|---|
| **1** | Ngày đến | Date | Ngày văn thư tiếp nhận và vào sổ hệ thống (DD/MM/YYYY). | `Document.registeredDate` |
| **2** | Số đến | Integer | Số thứ tự tăng dần liên tục trong năm (bắt đầu từ số 01 ngày 01/01). | `Document.registrationNumber` |
| **3** | Tác giả | String (255) | Cơ quan, tổ chức hoặc cá nhân ban hành văn bản. | `Document.issuingAuthority` |
| **4** | Số ký hiệu gốc | String (100) | Số và ký hiệu văn bản ghi trên văn bản đến gốc (vd: 125/TCGDNN-VP). | `Document.originalNumber` |
| **5** | Ngày ban hành gốc | Date | Ngày ghi trên văn bản gốc của cơ quan ban hành. | `Document.issuedDate` |
| **6** | Tên loại & Trích yếu | Text | Tên loại văn bản (Công văn, Quyết định, Tờ trình...) và trích yếu nội dung. | `Document.category` & `Document.summary` |
| **7** | Đơn vị / Người nhận | String | Đơn vị chủ trì tiếp nhận hoặc Lãnh đạo Nhà trường được chuyển giao. | `Document.leadDepartmentId` & `Document.leadUserId` |
| **8** | Hạn giải quyết | Date | Thời hạn cuối cùng để xử lý văn bản theo chỉ đạo hoặc theo văn bản gốc. | `Document.dueDate` |
| **9** | Ghi chú | Text | Ký hiệu lưu hồ sơ, mức độ khẩn, tình trạng xử lý hoặc văn bản trả lời liên quan. | `Document.notes` & `Document.urgency` |

---

## 7. QUY CHUẨN ĐÓNG GÓI HỒ SƠ CÔNG VIỆC VÀ LƯU TRỮ (QĐ 93, KH 227)

### 7.1. Lập Hồ sơ Công việc Điện tử (`FILED`)
Mỗi văn bản đến khi giải quyết xong phải được liên kết vào một Hồ sơ công việc điện tử (`Electronic Work Dossier`). Cán bộ thụ lý có trách nhiệm thu thập đầy đủ các thành phần sau:
1. Bản scan văn bản đến gốc có dấu đến và chữ ký (PDF/A).
2. Phiếu trình giải quyết và ý kiến chỉ đạo bút phê của Lãnh đạo trường.
3. Kế hoạch hoặc biên bản họp, văn bản trao đổi ý kiến của các đơn vị phối hợp.
4. Dự thảo văn bản giải quyết, báo cáo kết quả thực hiện.
5. Bản phát hành chính thức của văn bản trả lời (nếu có Văn bản đi tương ứng).

### 7.2. Nộp Lưu trữ Cơ quan (`ARCHIVED`)
- **Thời hạn giao nộp**: Chậm nhất trong thời hạn 01 năm kể từ ngày công việc kết thúc, đơn vị và cá nhân phải hoàn tất việc đóng gói hồ sơ điện tử nộp về Bộ phận Lưu trữ (Phòng Hành chính - Quản trị).
- **Phân loại thời hạn bảo quản**:
  - *Vĩnh viễn*: Văn bản chủ trương của Đảng, Nhà nước, Tỉnh ủy; quy chế tổ chức; quy hoạch phát triển trường; đề án mở ngành đào tạo.
  - *Có thời h���n (70 năm, 20 năm, 10 năm, 05 năm)*: Kế hoạch công tác năm, báo cáo chuyên đề, hồ sơ thanh quyết toán kinh phí, văn bản hành chính thông thường.
- **Tính toàn vẹn**: Khi nộp lưu trữ, hồ sơ được đóng băng quyền ghi (`readOnly: true`). Mọi thao tác trích xuất, mượn đọc phải được ghi nhật ký kiểm toán. Tiêu hủy hồ sơ hết hạn phải qua Hội đồng thẩm tra và Quyết định của Hiệu trưởng theo quy định pháp luật.

---

## 8. BẢO MẬT DỮ LIỆU, VÙNG CẤM KỸ THUẬT & KIỂM TOÁN HỆ THỐNG

1. **Vùng cấm Văn bản Bí mật Nhà nước (State Secret Invariant)**:
   - Nghiêm cấm mọi hành vi scan, tải lên, lưu trữ hoặc chuyển tiếp văn bản có độ mật (`MAT`, `TOI_MAT`, `TUYET_MAT`) trên hệ thống QCET E-Office hoạt động trên môi trường Internet thông thường.
   - Khi phát hiện tải nhầm văn bản mật, Quản trị viên hệ thống (`ADMIN`) có quyền kích hoạt chế độ Thu hồi & Khóa cô lập ngay lập tức (`Emergency Quarantine`), đồng thời thông báo cho Lãnh đạo cơ quan xử lý theo Luật Bảo vệ bí mật nhà nước 117/2025/QH15.

2. **Chống chối bỏ bằng mã băm SHA-256**:
   Mọi tệp đính kèm văn bản đến tải lên hệ thống đều được máy chủ tính toán mã băm SHA-256 (`DocumentAttachment.sha256Hash`) ngay khi tiếp nhận. Mã băm này là bất biến và dùng để xác minh tệp không bị chỉnh sửa, thay thế trong suốt vòng đời.

3. **Nhật ký kiểm toán truy cập (Audit Trail)**:
   Ghi lại toàn bộ hành vi: ai tiếp nhận, ai sửa đổi thông tin trích yếu, ai đọc văn bản, ai ghi bút phê, địa chỉ IP và thời gian theo chuẩn ICT (UTC+7).
