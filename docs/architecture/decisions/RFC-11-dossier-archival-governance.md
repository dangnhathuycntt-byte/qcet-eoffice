# RFC-11: Work Dossier Archival Governance, Retention Schedule, and Archivist SoD (Quy chế Quản trị Lưu trữ Hồ sơ Công việc, Bảng Thời hạn Bảo quản và Phân tách Trách nhiệm Lưu trữ)

- **Status**: PROPOSED
- **Date**: 2026-09-22
- **Author**: Enterprise Architecture & Security Architecture Team (WI-6.2b / Issue #78)
- **Deciders**: Ban Giám hiệu, Trưởng phòng Hành chính - Tổng hợp, Hội đồng Khoa học & Đào tạo, Trưởng các Khoa/Phòng
- **Target Implementation**: WI-6.2c / Phase 7 (Work Dossier & Archival Domain)
- **Affects**:
  - `src/lib/services/dossier-service.ts` (`closeDossier`, `markReadyForArchive`, `submitArchive`, `acceptArchive`, `finalizeArchive`)
  - `src/server/policies/dossier-policy.ts` (Archival Authorization & SoD Policy Rules)
  - `src/domain/dossiers/state-machine.ts` (Dossier Finite State Machine & Guard Contracts)
  - `src/lib/auth/hybrid-authorization.ts` (Archival Permissions & Scoped Resources)
  - `prisma/schema.prisma` (`WorkDossier`, `DossierItem`, `RetentionRule`, `DossierStatus`)
  - `src/app/api/dossiers/` (Archival Lifecycle REST Endpoints)

---

## 1. Bối cảnh & Đặt vấn đề (Context & Statutory Background)

Trong hoạt động quản trị đại học và giáo dục nghề nghiệp tại Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET), **Hồ sơ công việc (`WorkDossier`)** là tập hợp các văn bản, tài liệu, nhiệm vụ, biên bản họp và tài liệu chứng minh có liên quan chặt chẽ với nhau về một vấn đề, một sự việc, một đối tượng cụ th�� hoặc có đặc điểm chung, hình thành trong quá trình theo dõi, giải quyết công việc thuộc phạm vi chức năng, nhiệm vụ của cơ quan và các đơn vị.

Công tác quản lý hồ sơ và nộp lưu tài liệu vào Lưu trữ cơ quan không chỉ là một tính năng phần mềm thuần túy, mà là một **nghĩa vụ pháp lý bắt buộc** được điều chỉnh nghiêm ngặt bởi các văn bản quy phạm pháp luật của Nhà nước:

### 1.1. Căn cứ pháp lý cốt lõi (Statutory Framework)
1. **Nghị định số 30/2020/NĐ-CP ngày 05/3/2020 của Chính phủ về công tác văn thư (Chương IV: Quản lý công tác văn thư, lưu trữ cơ quan)**:
   - **Điều 28 (Lập hồ sơ công việc)**: Mọi cán bộ, công chức, viên chức khi được phân công theo dõi, giải quyết công việc đều có trách nhiệm mở hồ sơ, thu thập đầy đủ văn bản đến, văn bản đi, dự thảo và tài liệu liên quan vào hồ sơ công việc ngay từ khi công việc bắt đầu thực hiện.
   - **Điều 29 (Nộp lưu hồ sơ, tài liệu vào Lưu trữ cơ quan)**:
     * Cán bộ thụ lý công việc có trách nhiệm hoàn chỉnh hồ sơ công việc sau khi hoàn thành nhiệm vụ, sắp xếp văn bản theo trình tự thời gian hoặc diễn biến vụ việc.
     * Thời hạn nộp lưu: Trong thời hạn 01 năm kể từ ngày công việc kết thúc, hồ sơ phải được giao nộp vào Lưu trữ cơ quan (trừ các hồ sơ xây dựng cơ bản, đề tài nghiên cứu khoa học có quy định thời hạn riêng).
     * Trách nhiệm giao nộp: Phải lập **Mục lục hồ sơ nộp lưu** và **Biên bản bàn giao tài liệu** có chữ ký xác nhận của bên giao (Cán bộ lập hồ sơ / Đại diện đơn vị) và bên nhận (Lưu trữ viên cơ quan).
   - **Điều 30 (Trách nhiệm của Lưu trữ cơ quan)**: Lưu trữ cơ quan (thuộc Phòng Hành chính - Tổng hợp) có trách nhiệm hướng dẫn lập hồ sơ, thẩm định hồ sơ nộp lưu, tiếp nhận, vào sổ đăng ký, bảo quản an toàn và phục vụ khai thác, sử dụng tài liệu theo quy chế.
2. **Luật Lưu trữ số 01/2011/QH13 và Luật Lưu trữ số 33/2024/QH15 (có hiệu lực từ 01/07/2025)**:
   - Quy định nguyên tắc tập trung, thống nhất trong quản lý tài liệu lưu trữ của các cơ quan nhà nước, đơn vị sự nghiệp công lập.
   - Quy định việc phân loại tài liệu theo giá trị lịch sử, chính trị, kinh tế, khoa học và thực tiễn để xác định thời h��n bảo quản: **Bảo quản vĩnh viễn** hoặc **Bảo quản có thời hạn**.
   - Quy định nghiêm cấm việc tự ý hủy hoại, sửa đổi, làm sai lệch hoặc chiếm đoạt tài liệu lưu trữ cơ quan.
3. **Quy định của Bộ Giáo dục & Đào tạo, Bộ Lao động - Thương binh & Xã hội và Bộ Nội vụ về Thời hạn bảo quản tài liệu**:
   - Thông tư số 09/2011/TT-BNV (Quy định thời hạn bảo quản tài liệu hình thành phổ biến trong hoạt động của các cơ quan, tổ chức).
   - Thông tư số 27/2016/TT-BGDĐT (Quy định thời hạn bảo quản tài liệu chuyên môn nghiệp vụ ngành giáo dục).
   - Bảng thời hạn bảo quản quy định cụ thể từng nhóm tài liệu: từ 5 năm, 10 năm, 20 năm, 50 năm, 70 năm cho đến vĩnh viễn.

### 1.2. Thách thức kiến trúc và Lỗ hổng quản trị hiện tại (Architectural Problem Statement)
Mặc dù hệ thống QCET E-Office đã thiết kế thực thể `WorkDossier`, `DossierItem` và `RetentionRule` trong cơ sở dữ liệu (`prisma/schema.prisma`), quá trình vận hành kỹ thuật và triển khai thực tế đang đối mặt với các vấn đề kiến trúc cần chuẩn hóa qua RFC:
1. **Thiếu sự tách bạch giữa 2 giai đoạn vòng đời hồ sơ**: Chưa phân định rõ ràng giữa **Lưu trữ hiện hành tại đơn vị (Unit Current Filing)** và **Lưu trữ lịch sử tại trường (Institutional Archival)**, dẫn đến tình trạng hồ sơ đã đóng (`CLOSED`) vẫn bị nhầm lẫn là đã hoàn tất lưu trữ cơ quan.
2. **Nguy cơ vi phạm nguyên tắc Phân tách trách nhiệm (Separation of Duties - SoD)**: Nếu không có rào chắn cấp domain/policy, một cán bộ lập hồ sơ hoặc Trưởng đơn vị có thể tự nộp lưu rồi tự mình duyệt tiếp nhận hồ sơ vào Lưu trữ trường, xóa bỏ tính giám sát độc lập, vi phạm quy trình kiểm soát nội bộ.
3. **Tính bất biến (Immutability) chưa được bảo đảm toàn diện**: Tài liệu lưu trữ sau khi đã tiếp nhận vào kho cơ quan phải là chứng tích pháp lý bất biến. Việc chưa có cơ chế đóng băng cứng (Hard WORM constraint) ở cấp domain engine có thể tạo kẽ hở cho việc chỉnh sửa, chèn thêm hoặc xóa bớt tài liệu sau khi đã vào sổ lưu trữ.
4. **Mối quan hệ bắt buộc với Bảng thời hạn bảo quản (`RetentionRule`)**: Nhiều hồ sơ được tạo lập tự do mà không gán `retentionRuleId`, gây khó khăn nghiêm trọng cho công tác phân loại, định kỳ rà soát hết hạn lưu trữ và thẩm định tiêu hủy hồ sơ theo quy định của Luật Lưu trữ.

---

## 2. Vòng đời Hồ sơ Công việc & Quy trình Nộp lưu Lưu trữ Cơ quan (Dossier Lifecycle & Archival Handover)

Hệ thống QCET chuẩn hóa vòng đời của Hồ sơ công việc theo mô hình hữu hạn trạng thái (Finite State Machine - FSM) gồm **7 trạng thái chuẩn tắc**, phân tách làm 2 phân hệ quản lý:

```
[ GIAI ĐOẠN 1: TẠI ĐƠN VỊ TẠO LẬP / CHUYÊN VIÊN ]
        │
   (Tạo hồ sơ)
        ▼
     [ OPEN ] ──────────────► [ ACTIVE ]
        │ (Thêm tài liệu/NV)      │
        │                         │ (Hoàn thành nhiệm vụ/xử lý xong văn bản)
        └─────────────────────────┼────────────────────────► [ CLOSED ]
                                                           (Đóng hồ sơ)
                                                                 │
                                                                 ▼
                                                      [ READY_FOR_ARCHIVE ]
                                                      (Chuẩn bị nộp lưu)
                                                                 │
                                                                 │ (Biên bản nộp lưu)
                                                                 ▼
                                                    [ SUBMITTED_TO_ARCHIVE ]
                                                    (Đã gửi Lưu trữ trường)
═════════════════════════════════════════════════════════════════╪═════════════════════
[ GIAI ĐOẠN 2: TẠI LƯU TRỮ CƠ QUAN / PHÒNG HÀNH CHÍNH - TỔNG HỢP ] │
                                                                 ▼
                                                            [ ACCEPTED ]
                                                      (Nghiệm thu hồ sơ lưu trữ)
                                                                 │
                                                                 │ (Xếp kho, cấp mã vị trí)
                                                                 ▼
                                                            [ ARCHIVED ]
                                                      (Lưu trữ vĩnh viễn/chính thức)
                                                      [BẤT BIẾN - READ-ONLY WORM]
```

### 2.1. Chi tiết các trạng thái vòng đời (State Definitions)

| Mã trạng thái (`DossierStatus`) | Tên hành chính | Phân hệ quản lý | Mô tả nghiệp vụ & Điều kiện tiên quyết |
| :--- | :--- | :--- | :--- |
| **`OPEN`** | Khởi tạo / Mới mở | Đơn vị tạo lập | Hồ sơ được khởi tạo bởi cán bộ thụ lý hoặc Trưởng đơn vị. Xác định tiêu đề, mã hồ sơ tạm thời, đơn vị sở hữu (`owningUnitId`), người phụ trách (`responsiblePersonId`). Chưa bắt buộc có tài liệu. |
| **`ACTIVE`** | Đang hoạt động / Đang xử lý | Đơn vị tạo lập | Hồ sơ đã có ít nhất một tài liệu (`DossierItem`), văn bản đến/đi hoặc nhiệm vụ liên kết. Cán bộ liên tục cập nhật tài liệu phát sinh trong quá trình giải quyết công việc. |
| **`CLOSED`** | Đã kết thúc / Đã đóng | Đơn vị tạo lập | Công việc đã giải quyết xong. Hồ sơ được đóng lại. Không cho phép bổ sung thêm tài liệu thông thường. Điều kiện: Toàn bộ nhiệm vụ trọng tâm liên kết phải hoàn thành (`COMPLETED` hoặc `CANCELLED`). |
| **`READY_FOR_ARCHIVE`** | Sẵn sàng nộp lưu | Đơn vị tạo lập | Cán bộ hoàn chỉnh hồ sơ: đánh số trang (`pageCount`), sắp xếp trình tự văn bản (`sequence`), lập mục lục văn bản trong hồ sơ, và **bắt buộc gán Bảng thời hạn bảo quản (`RetentionRule`)**. |
| **`SUBMITTED_TO_ARCHIVE`** | Đã nộp lưu trữ cơ quan | Chuyển giao liên đơn vị | Cán bộ lập hồ sơ thực hiện nộp lưu vào Lưu trữ trường. Hệ thống ghi nhận `submittedById`, `submittedArchiveAt`. Hồ sơ rời khỏi quyền kiểm soát biên tập của đơn vị tạo lập và chuyển vào hàng đợi thẩm định của Lưu trữ cơ quan. |
| **`ACCEPTED`** | Đã tiếp nhận / Nghiệm thu | Lưu trữ cơ quan | Lưu trữ viên kiểm tra thực tế (hoặc đối chiếu số hóa): tính toàn vẹn của tài liệu, tính chính xác của thời hạn bảo quản. Ký biên bản giao nhận điện tử. Hồ sơ được chấp thuận đưa vào hệ thống kho lưu trữ. |
| **`ARCHIVED`** | Đã lưu trữ chính thức | Lưu trữ cơ quan | Hồ sơ được xếp vào kho lưu trữ (vật lý hoặc số hóa chuyên dụng), cấp mã vị trí lưu trữ (`storageLocation`: Hộp số, Giá số, Tầng số, Ngăn số). Đóng băng vĩnh viễn toàn diện. |

### 2.2. Thủ tục Chuyển giao Lưu trữ (Archival Handover Protocol)
Theo Điều 29 Nghị định 30/2020/NĐ-CP, việc nộp lưu vào Lưu trữ trường không phải là một thao tác đổi cờ trạng thái đơn lẻ mà là một **giao dịch pháp lý nội bộ (Institutional Archival Transaction)**:
1. **Lập Mục lục tài liệu nộp lưu (Dossier Inventory Manifest)**:
   - Hệ thống tự động sinh bản kê toàn bộ danh mục `DossierItem` thuộc hồ sơ, sắp xếp tuần tự theo `sequence`, hiển thị: Số ký hiệu văn bản, Ngày tháng ban hành, Tác giả/Cơ quan ban hành, Trích yếu nội dung, Số trang, Tên tệp đính kèm và Mã băm xác thực toàn vẹn (SHA-256 Checksum).
2. **Ký nộp điện tử (Submission Sign-off)**:
   - Cán bộ chịu trách nhiệm hồ sơ (`responsiblePersonId`) hoặc người được ủy quyền của đơn vị thực hiện lệnh `dossier.submit_archive`.
   - Hệ thống khóa quyền thay đổi của đơn vị tạo lập, ghi nhận dấu thời gian `submittedArchiveAt`.
3. **Thẩm định & Nghiệm thu (Appraisal & Acceptance Inspection)**:
   - Lưu trữ viên chuyên trách thuộc Phòng Hành chính - Tổng hợp mở giao diện thẩm định hồ sơ nộp lưu.
   - Kiểm tra các tiêu chuẩn:
     * Sự đầy đủ của tài liệu (văn bản đi kèm văn bản đến chỉ đạo, dự thảo kèm bản ký duyệt, biên bản họp kèm biểu quyết...).
     * Phân loại bảo mật (`classification`) có chính xác không (không để lọt bí mật nhà nước trên hệ thống thông thường).
     * Bảng thời hạn bảo quản (`retentionRuleId`) có đúng theo danh mục quy định của Nhà nước và Trường không.
   - Nếu không đạt yêu cầu: Lưu trữ viên trả lại hồ sơ về trạng thái `CLOSED` kèm văn bản/ý kiến từ chối rõ lý do (Reject with Reasons).
   - Nếu đạt yêu cầu: Lưu trữ viên thực hiện `acceptArchive` $\to$ chuyển sang `ACCEPTED` hoặc trực tiếp `ARCHIVED`.

---

## 3. Bảng Thời hạn Bảo quản Hồ sơ (Retention Schedule & RetentionRule)

### 3.1. Cấu trúc Mô hình Dữ liệu `RetentionRule`
Mô hình `RetentionRule` được thiết kế nhằm chuẩn hóa danh mục thời hạn bảo quản thống nhất toàn trường, tuân thủ Thông tư 09/2011/TT-BNV và Thông tư 27/2016/TT-BGDĐT:

```prisma
model RetentionRule {
  id            String        @id @default(cuid())
  code          String        @unique @db.VarChar(50)   // VD: "RET-PERM-STRAT", "RET-10Y-FIN"
  name          String        @db.VarChar(255)          // Tên bảng quy định thời hạn bảo quản
  durationYears Int?          @map("duration_years")    // null = VĨNH VIỄN (PERMANENT)
  legalBasis    String?       @map("legal_basis")       // Căn cứ pháp lý (Điều/Khoản Thông tư)
  description   String?       @db.Text                  // Hướng dẫn áp dụng chi tiết
  dossiers      WorkDossier[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@map("retention_rules")
}
```

### 3.2. Quy tắc Phân loại Thời hạn Bảo quản (Retention Taxonomy)

Hệ thống phân định rõ hai nhóm bảo quản:

#### Nhóm 1: Bảo quản Vĩnh viễn (`durationYears = null`)
- **Đặc trưng**: Tài liệu có giá trị đặc biệt về chính trị, lịch sử, văn hóa, khoa học và thực tiễn, phản ánh sự hình thành, phát triển và hoạt động trọng yếu của Nhà trường.
- **Áp dụng bắt buộc cho các nhóm hồ sơ**:
  1. Hồ sơ thành lập trường, điều lệ hoạt động, chiến lược phát triển dài hạn của Nhà trường.
  2. Nghị quyết Đại hội Đảng bộ trường, Nghị quyết Hội đồng trường, Quyết định của Ban Giám hiệu về cơ cấu tổ chức và nhân sự chủ chốt.
  3. Hồ sơ gốc cấp phát văn bằng tốt nghiệp, chứng chỉ đào tạo, sổ bộ cấp bằng tốt nghiệp các hệ đào tạo.
  4. Hồ sơ quy hoạch tổng thể mặt bằng đất đai, giấy chứng nhận quyền sử dụng đất, hồ sơ xây dựng các công trình trọng điểm.
  5. Đề án mở ngành đào tạo mới, kết quả kiểm định chất lượng giáo dục nghề nghiệp cấp quốc gia/quốc tế.
  6. Hồ sơ bổ nhiệm, miễn nhiệm cán bộ lãnh đạo chủ chốt từ cấp Trưởng khoa/phòng trở lên.

#### Nhóm 2: Bảo quản Có thời hạn (`durationYears = N`, $N \in \{5, 10, 15, 20, 30, 50, 70\}$)
- **Đặc trưng**: Tài liệu phản ánh các hoạt động thường xuyên, có giá trị pháp lý, quản lý, nghiệp vụ trong một khoảng thời gian nhất định.
- **Bảng danh mục tiêu chuẩn áp dụng tại QCET**:
  - **70 năm**: Hồ sơ lý lịch cán bộ, viên chức, người lao động; hồ sơ kỷ luật từ cảnh cáo trở lên.
  - **50 năm**: Hồ sơ khen thưởng cấp Nhà nước, cấp Bộ/Tỉnh; hồ sơ thanh tra toàn diện Nhà trường.
  - **20 năm**: Hồ sơ tuyển sinh hàng năm; hồ sơ xây dựng kế hoạch đào tạo toàn khóa; biên bản thi tốt nghiệp và bảng điểm tổng hợp.
  - **10 năm**: Hồ sơ dự toán, quyết toán ngân sách tài chính hàng năm; hồ sơ mua sắm thiết bị thực hành lớn; báo cáo tổng kết năm học các đơn vị.
  - **05 năm**: Hồ sơ kiểm tra chuyên môn học kỳ; các thông báo điều hành tác nghiệp thường kỳ; giấy mời họp và tài liệu tham khảo nội bộ.

### 3.3. Ràng buộc bất biến cấp Hệ thống (Hard Invariant of Retention Assignment)
1. **Bắt buộc gán trước khi nộp lưu**:
   - Một hồ sơ công việc **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP** chuyển sang trạng thái `READY_FOR_ARCHIVE` hoặc `SUBMITTED_TO_ARCHIVE` nếu trường `retentionRuleId` là `null` hoặc không hợp lệ.
   - Thao tác `markReadyForArchive()` và `submitArchive()` trong `DossierService` bắt buộc kiểm tra:
     ```typescript
     if (!currentDossier.retentionRuleId) {
       throw new ValidationError(
         "Hồ sơ phải xác định Bảng thời hạn bảo quản (RetentionRule) trước khi nộp lưu trữ cơ quan theo Luật Lưu trữ"
       );
     }
     ```
2. **Tính toán Thời điểm Đáo hạn Lưu trữ (Retention Expiration Calculation)**:
   - Đối với hồ sơ có thời hạn (`durationYears !== null`):
     $$\text{retentionExpiredAt} = \text{archivedAt} + \text{durationYears} \times 365.25 \text{ ngày}$$
   - Trước thời điểm đáo hạn 06 tháng, hệ thống tự động đưa hồ sơ vào Danh mục rà soát đánh giá lại của Hội đồng Thẩm định & Hủy tài liệu lưu trữ cơ quan.
   - **Tuyệt đối không tự động tiêu hủy hồ sơ trong cơ sở dữ liệu**: Việc tiêu hủy tài liệu hết hạn lưu trữ bắt buộc phải lập Hội đồng Thẩm định theo Điều 28 Luật Lưu trữ, ban hành Quyết định tiêu hủy của Hiệu trưởng và có Biên bản tiêu hủy theo luật định.

---

## 4. Nguyên tắc Phân tách Trách nhiệm (Separation of Duties - SoD) & Maker-Checker Guard

### 4.1. Bản chất Pháp lý & Quản trị rủi ro của Nguyên tắc SoD
Trong quản lý hành chính công và kiểm soát tuân thủ, **Phân tách trách nhiệm (Separation of Duties - SoD)** là nguyên tắc cốt lõi nhằm ngăn chặn xung đột lợi ích, gian lận, làm sạch hồ sơ giả tạo và xóa nhòa dấu vết sai phạm.

Tại Lưu trữ cơ quan Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn:
- **Người lập / nộp lưu (Maker - Submitter)**: Là cán bộ trực tiếp giải quyết công việc (`responsiblePersonId`) hoặc người thực hiện giao nộp tài liệu (`submittedById`). Động lực của Maker là hoàn thành nghĩa vụ bàn giao hồ sơ của đơn vị.
- **Người tiếp nhận / vào sổ lưu trữ (Checker - Archivist)**: Là Lưu trữ viên chuyên trách hoặc Cán bộ văn thư cơ quan (`archivedById`). Trách nhiệm của Checker là giám sát độc lập, kiểm tra tính đầy đủ, tính chân thực và tính hợp thức của tài liệu theo quy chế văn thư lưu trữ của Trường.

### 4.2. Rào chắn bất biến cấp Domain (Domain-level Hard Invariant)

> **QUY TẮC BẤT BIẾN TOÀN HỆ THỐNG**:
> **Người nộp lưu hoặc người chịu trách nhiệm chính của hồ sơ (`responsiblePersonId` / `submittedById`) TUYỆT ĐỐI KHÔNG ĐƯỢC TỰ MÌNH thực hiện hành vi tiếp nhận nghiệm thu (`acceptArchive`) hoặc hoàn tất lưu trữ (`finalizeArchive`) cho chính hồ sơ đó.**
>
> $$\text{archivedById} \neq \text{submittedById} \quad \wedge \quad \text{archivedById} \neq \text{responsiblePersonId}$$

Quy tắc này được thực thi tại tầng lõi `DossierService.acceptArchive()` và `DossierService.finalizeArchive()`:
```typescript
// Enforce Maker-Checker Invariant (SoD Guard)
if (
  dossier.responsiblePersonId === user.id ||
  (dossier.submittedById && dossier.submittedById === user.id)
) {
  throw new ForbiddenError(
    "Người nộp lưu hồ sơ không được tự tiếp nhận hồ sơ vào lưu trữ cơ quan (Vi phạm nguyên tắc phân công độc lập SoD)"
  );
}
```

### 4.3. Thẩm quyền Thực thi Ti���p nhận Lưu trữ (Archivist Capability & Scope)
Không phải bất kỳ người dùng nào (kể cả Trưởng phòng chuyên môn khác) cũng có quyền tiếp nhận hồ sơ vào Lưu trữ trường. Quyền tiếp nhận nghiệm thu hồ sơ lưu trữ (`dossier.accept_archive`) chỉ được cấp cho người dùng thỏa mãn đồng thời 2 điều kiện:
1. **Thỏa mãn điều kiện SoD**: Người dùng không trùng với `responsiblePersonId` và `submittedById`.
2. **Có Năng lực Lưu trữ Toàn trường (School-Wide Archival Clearance)**:
   - Người dùng giữ chức danh chuyên trách lưu trữ: `ARCHIVIST`, `LUU_TRU`, hoặc `VAN_THU` (Văn thư cơ quan) thuộc Phòng Hành chính - Tổng hợp;
   - HOẶC là Lãnh đạo cấp trường: `HIEU_TRUONG`, `PHO_HIEU_TRUONG` phụ trách công tác văn thư lưu trữ;
   - HOẶC là Quản trị viên hệ thống cấp cao (`ADMIN`) thực hiện hỗ trợ kỹ thuật được ủy quyền đặc biệt.

---

## 5. Tính Bất biến Vĩnh viễn của Hồ sơ đã Lưu trữ (Permanent Immutability of ARCHIVED Dossiers)

### 5.1. Triết lý Thiết kế: Write Once, Read Many (WORM)
Tài liệu lưu trữ cơ quan là bằng chứng lịch sử và căn cứ pháp lý quan trọng nhất của Nhà trường. Khi một hồ sơ công việc chuyển sang trạng thái `ARCHIVED`:
1. **Khóa cứng toàn bộ cấu trúc hồ sơ (Structural Freeze)**:
   - Tuyệt đối cấm thêm tài liệu mới (`addItemToDossier`).
   - Tuyệt đối cấm xóa tài liệu hiện có (`removeItemFromDossier`).
   - Tuyệt đối cấm thay đổi vị trí, thứ tự tài liệu (`sequence`).
   - Tuyệt đối cấm thay đổi bảng thời hạn bảo quản (`retentionRuleId`), đơn vị sở hữu (`owningUnitId`), người phụ trách ban đầu (`responsiblePersonId`), hoặc ngày tháng nộp lưu.
2. **Khóa cứng nội dung tệp đính kèm (Binary Content Immutability)**:
   - Các tệp đính kèm vật lý liên kết với `DossierItem` (PDF, scan văn bản, biên bản) bị đóng băng quyền ghi và quyền xóa ở mức Storage Backend/File Authorization Handler (`/api/files/...`).
3. **Cơ chế phòng thủ đa tầng (Defense in Depth)**:
   - Rào chắn FSM: Ngăn chặn mọi transition xuất phát từ `ARCHIVED` (không có transition ra khỏi `ARCHIVED`).
   - Rào chắn Service Layer: Ném ngoại lệ `InvalidTransitionError` tại tất cả các phương thức chỉnh sửa nếu `status === ARCHIVED`.
   - Rào chắn Database Policy: Audit log ghi nhận mọi cố gắng tác động bất hợp pháp.

### 5.2. Nguyên tắc Không hoàn tác (No Unarchive / No Reopening Policy)
- Trong các hệ thống thông thường, người dùng thường có thói quen yêu cầu chức năng "Reopen" hoặc "Mở khóa hồ sơ".
- **QUY CHẾ QCET TUYỆT ĐỐI NGHIÊM CẤM TÍNH NĂNG REOPEN TRỰC TIẾP TRÊN HỒ SƠ ĐÃ ARCHIVED**:
  - Không tồn tại API `reopenArchivedDossier` hay `unarchiveDossier`.
  - Một khi hồ sơ đã vào sổ lưu trữ và mang trạng thái `ARCHIVED`, trạng thái này có giá trị vĩnh viễn trong cơ sở dữ liệu.

### 5.3. Xử lý nghiệp vụ khi phát hiện sai sót sau khi Lưu trữ (Post-Archival Correction Governance)
Trường hợp thực tế phát sinh khi một hồ sơ đã `ARCHIVED` nhưng sau đó phát hiện có tài liệu quan trọng bị thất lạc mới tìm thấy, hoặc có văn bản pháp lý cấp trên yêu cầu bổ sung chứng cứ:
1. **Quy trình Lập Hồ sơ Bổ sung (Addendum Dossier Protocol)**:
   - Không được mở hồ sơ gốc để chèn tài liệu vào giữa các trang đã đánh số.
   - Đơn vị chuyên môn lập một **Hồ sơ Phụ bản / Hồ sơ Bổ sung (Addendum Work Dossier)** mới.
   - Tiêu đề hồ sơ mới: `[Bổ sung] + Tiêu đề hồ sơ gốc`.
   - Thiết lập trường liên kết tham chiếu: `notes` hoặc quan hệ phụ bản trỏ rõ mã ID của hồ sơ gốc `ARCHIVED`.
2. **Quy trình Đính chính do Lỗi Thừa/Nhầm Tài liệu**:
   - Trường hợp phát hiện tài liệu bị đưa nhầm vào hồ sơ lưu trữ: Phải thành lập Hội đồng do Trưởng phòng Hành chính - Tổng hợp chủ trì, lập **Biên bản xác nhận sự cố tài liệu lưu trữ**, có phê duyệt bằng văn bản của Hiệu trưởng.
   - Bản ghi biên bản này được lưu thành một `DossierItem` chứng nhận đính chính có chữ ký số của Lưu trữ viên trưởng, tuyệt đối không được xóa vật lý bản ghi gốc nhằm bảo tồn tính toàn vẹn của Chuỗi Lưu vết Kiểm toán (Audit Trail Chain).

---

## 6. Các Phương án Kiến trúc & Đánh giá Đánh đổi (Alternatives & Trade-offs)

### 6.1. Đánh đổi 1: Cơ chế Đóng băng Lưu trữ (Soft Freeze vs. Hard Immutability)

| Tiêu chí | Phương án A: Soft Freeze (Đóng băng mềm, cho phép Admin/BGH mở lại) | Phương án B: Hard Immutability (Khóa cứng WORM, khuyến nghị của RFC-11) |
| :--- | :--- | :--- |
| **Bản chất kỹ thuật** | Cho phép vai trò `ADMIN` hoặc `HIEU_TRUONG` bấm nút "Mở lại hồ sơ" (`reopen`) để sửa hoặc thêm tệp. | Cấm hoàn toàn mọi nhánh code Reopen từ `ARCHIVED`. Bổ sung chỉ được thực hiện qua Hồ sơ Phụ bản. |
| **Tuân thủ pháp lý** | ❌ **Rủi ro rất cao**: Vi phạm Luật Lưu trữ về chống chỉnh sửa, ngụy tạo tài liệu sau khi bàn giao; không bảo đảm tính toàn vẹn pháp lý trước tòa án hoặc thanh tra nhà nước. | ✅ **Tuyệt đối tuân thủ**: Đảm bảo chứng cứ pháp lý nguyên vẹn, đáp ứng tiêu chuẩn kiểm toán quốc tế và quy định lưu trữ điện tử. |
| **Tính linh hoạt nghiệp vụ** | Cao, cán bộ dễ dàng sửa lỗi chính tả, thay thế file scan bị mờ. | Chặt chẽ, đòi hỏi cán bộ phải kiểm tra kỹ lưỡng ở giai đoạn `READY_FOR_ARCHIVE` trước khi nộp. |
| **Độ tin cậy của Audit Trail** | Thấp, chuỗi kiểm toán bị phân mảnh, khó xác minh văn bản nộp lưu ban đầu. | Rất cao, chuỗi kiểm toán bất biến, có thể chứng minh tính nguyên gốc của hồ sơ. |
| **Kết luận lựa chọn** | **BÁC BỎ (REJECTED)**. | **CHẤP THUẬN (ACCEPTED)**: Áp dụng Phương án B làm chuẩn tắc cho toàn trường. |

### 6.2. Đánh đổi 2: Thực thi Phân tách Trách nhiệm (Client-Side Check vs. Core Service Guard vs. Database Constraint)

| Tiêu chí | Phương án A: Kiểm tra tại Giao diện / API Route | Phương án B: Kiểm tra tại Core Service Layer (`dossier-service.ts`) | Phương án C: Ràng buộc Database Trigger / Check Constraint |
| :--- | :--- | :--- | :--- |
| **Bản chất** | Ẩn nút "Tiếp nhận" trên UI nếu người dùng là `responsiblePersonId`. | `assertAuthorized` + kiểm tra tường minh `if (dossier.responsiblePersonId === user.id) throw new ForbiddenError(...)` bên trong transaction. | Viết SQL Trigger trên bảng `work_dossiers` ngăn chặn update nếu `NEW.archived_by_id = NEW.submitted_by_id`. |
| **Ưu điểm** | Dễ triển khai nhanh trên frontend. | Độc lập với kênh truy cập (REST API, background job, CLI script); dễ viết unit test và integration test; thông báo lỗi nghiệp vụ thân thiện. | Bảo đảm ở tầng thấp nhất, không thể bị bypass kể cả qua Prisma raw query. |
| **Nhược điểm** | Dễ dàng bị vượt qua bằng Postman/curl hoặc thay đổi token. | Nếu có script chèn thẳng vào DB bằng SQL thuần sẽ không qua được check này (nhưng hệ thống QCET 100% qua Prisma). | Khó đồng bộ với Prisma schema migrations; logic thông báo lỗi tiếng Việt kém trực quan; phụ thuộc hệ quản trị CSDL. |
| **Kết luận lựa chọn** | Bác bỏ. | **CHẤP THUẬN (ACCEPTED)**: Kết hợp Phương án B làm chuẩn mực chính, kèm UI disable ở frontend để tối ưu trải nghiệm người dùng. |

### 6.3. Đánh đổi 3: Cơ chế Gán Thời hạn Lưu trữ (Tự nhập số năm tự do vs. Bảng danh mục `RetentionRule`)

| Tiêu chí | Phương án A: Tự nhập số năm tự do (`durationYears: number`) | Phương án B: Bắt buộc chọn từ Bảng danh mục `RetentionRule` chuẩn |
| :--- | :--- | :--- |
| **Bản chất** | Người lập hồ sơ tự điền: 3 năm, 7 năm, 12 năm... | Người lập chỉ được chọn từ danh mục quy chuẩn ban hành sẵn (có mã, tên quy chuẩn, và căn cứ pháp lý Thông tư). |
| **Rủi ro** | Gây hỗn loạn dữ liệu; mỗi cán bộ hiểu một kiểu; không có căn cứ pháp lý bảo vệ khi tiêu hủy hồ sơ. | Cần công tác quản trị ban đầu để nạp đầy đủ danh mục Bảng thời hạn bảo quản theo quy định ngành giáo dục. |
| **Hiệu quả tự động hóa** | Khó lập báo cáo nhóm tài liệu hết hạn nộp lưu trữ lịch sử tỉnh/bộ. | Tự động hóa hoàn toàn quy trình rà soát, lập danh mục hồ sơ hết hạn lưu trữ định kỳ hàng năm. |
| **Kết luận lựa chọn** | Bác bỏ. | **CHẤP THUẬN (ACCEPTED)**: Bắt buộc áp dụng Phương án B. Trường `retentionRuleId` là khóa ngoại bắt buộc khi nộp lưu. |

---

## 7. Ma trận Thẩm quyền & Chuyển Trạng thái (State Transition & Authorization Matrix)

Bảng dưới đây quy định quyền hạn của từng nhóm vai trò đối với các hành động vòng đời hồ sơ:

| Hành động (`Action`) | Trạng thái nguồn | Trạng thái đích | Người phụ trách hồ sơ (`responsiblePerson`) | Lãnh đạo Đơn vị (`UnitLeader`) | Văn thư / Lưu trữ viên (`Archivist`) | Ban Giám hiệu (`Executive`) | Điều kiện nghiệp vụ bắt buộc |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Tạo hồ sơ (`create`)** | `[None]` | `OPEN` | ✅ | ✅ | ✅ | ✅ | Thuộc đơn vị được phân công hoặc được giao nhiệm vụ. |
| **Thêm tài liệu (`add_item`)** | `OPEN`, `ACTIVE` | `ACTIVE` | ✅ | ✅ (Cùng đơn vị) | ❌ | ❌ | Hồ sơ chưa bị đóng (`status < CLOSED`). |
| **Xóa tài liệu (`remove_item`)** | `OPEN`, `ACTIVE` | `ACTIVE` / `OPEN` | ✅ | ✅ (Cùng đơn vị) | ❌ | ❌ | Chỉ xóa được tài liệu khi hồ sơ chưa đóng. |
| **Đóng hồ sơ (`close`)** | `OPEN`, `ACTIVE` | `CLOSED` | ✅ | ✅ | ❌ | ✅ | Hồ sơ không rỗng (`items.length > 0`); nhiệm vụ liên kết phải hoàn tất. |
| **Chuẩn bị lưu trữ (`ready_for_archive`)** | `CLOSED` | `READY_FOR_ARCHIVE` | ✅ | ✅ | ❌ | ❌ | Bắt buộc đã gán `retentionRuleId` hợp lệ. |
| **Nộp lưu cơ quan (`submit_archive`)** | `CLOSED`, `READY_FOR_ARCHIVE` | `SUBMITTED_TO_ARCHIVE`| ✅ | ✅ | ❌ | ❌ | Bắt buộc có `retentionRuleId`; ghi nhận `submittedById = user.id`. |
| **Tiếp nhận nghiệm thu (`accept_archive`)** | `SUBMITTED_TO_ARCHIVE` | `ACCEPTED` / `ARCHIVED` | ❌ **(SoD Guard Chặn)** | ❌ **(SoD Guard Chặn nếu là Submitter)** | ✅ | ✅ | Người duyệt $\neq$ Người nộp; bắt buộc có quyền lưu trữ toàn trường. |
| **Hoàn tất lưu trữ (`finalize_archive`)** | `ACCEPTED` | `ARCHIVED` | ❌ | ❌ | ✅ | ✅ | Nhập vị trí lưu trữ thực tế (`storageLocation`). |

---

## 8. Nhật ký Kiểm toán Bất biến & Tích hợp Sự kiện Outbox (Audit Trail & Outbox Events)

Mọi biến động trong vòng đời lưu trữ hồ sơ đều phải được bảo đảm tính minh bạch và truy nguyên tuyệt đối:

### 8.1. Các hành động Kiểm toán Bắt buộc (`AuditAction`)
Ghi nhận qua `auditService.logEvent(tx, ...)` trong cùng database transaction:
1. `DOSSIER_CREATED`: Ghi nhận tạo mới, người tạo, đơn vị sở hữu ban đầu.
2. `DOSSIER_ITEM_ADDED` / `DOSSIER_ITEM_REMOVED`: Ghi nhận thêm/bớt tài liệu, số ký hiệu văn bản, ngày văn bản, người thực hiện.
3. `DOSSIER_CLOSED`: Ghi nhận đóng hồ sơ, dấu thời gian `closedAt`.
4. `DOSSIER_READY_FOR_ARCHIVE`: Ghi nhận hoàn tất chuẩn bị nộp lưu và mã `retentionRuleId`.
5. `DOSSIER_SUBMITTED_ARCHIVE`: Ghi nhận nộp lưu trữ trường, định danh `submittedById`.
6. `DOSSIER_ACCEPTED_ARCHIVE`: Ghi nhận Lưu trữ viên tiếp nhận, kiểm tra SoD thành công.
7. `DOSSIER_ARCHIVED`: Ghi nhận vào sổ lưu trữ chính thức, định danh `archivedById`, vị trí kho `storageLocation`.

### 8.2. Sự kiện Transactional Outbox (`publishOutboxEvent`)
Nhằm phục vụ thông báo thời gian thực và đồng bộ dữ liệu liên phân hệ:
1. `DOSSIER_CLOSED_NOTIFICATION`: Thông báo cho lãnh đạo đơn vị về việc hoàn thành hồ sơ công việc.
2. `DOSSIER_SUBMITTED_ARCHIVE_NOTIFICATION`: Gửi thông báo đến hàng đợi làm việc của Lưu trữ viên thuộc Phòng Hành chính - Tổng hợp.
3. `DOSSIER_ACCEPTED_ARCHIVE_NOTIFICATION`: Thông báo cho người nộp lưu và Trưởng đơn vị về việc hồ sơ đã được Lưu trữ trường nghiệm thu thành công.

---

## 9. Kế hoạch Triển khai & Tác động Hệ thống (Implementation Roadmap & System Impacts)

### 9.1. Giai đoạn 1: Chuẩn hóa Domain Service & Policy Engine (WI-6.2c)
1. Bổ sung `DossierStateMachine` tại `src/domain/dossiers/state-machine.ts` để kiểm soát chuyển đổi trạng thái tập trung.
2. Tích hợp chặt chẽ `assertAuthorized` với resource context bao gồm cả `submittedById` và `responsiblePersonId` để thẩm định SoD trước khi chạm vào DB.
3. Cập nhật các REST API routes tại `src/app/api/dossiers/` để trả về mã lỗi chuẩn RFC 9457 (theo quy định của ADR-007) khi vi phạm SoD hoặc vi phạm tính bất biến.

### 9.2. Giai đoạn 2: Khởi tạo Dữ liệu Danh mục Thời hạn Bảo quản (Seed Retention Rules)
1. Soạn thảo migration script khởi tạo các bản ghi `RetentionRule` chuẩn cho Trường:
   - Các nhóm vĩnh viễn: Điều lệ, Chiến lược, Văn bằng chứng chỉ, Hồ sơ Đảng - Đoàn thể, Quy hoạch đất đai.
   - Các nhóm có thời hạn: Hồ sơ nhân sự (70 năm), Tài chính - Kế toán (10-20 năm), Đào tạo - Tuyển sinh (10-20 năm), Hành chính thường kỳ (5 năm).
2. Rà soát và cập nhật dữ liệu hồ sơ công việc hiện có, đảm bảo không có hồ sơ nào bị mồ côi `retentionRuleId` khi bước vào giai đoạn nộp lưu.

### 9.3. Giai đoạn 3: Giao diện Lưu trữ & Bàn giao Điện tử
1. Xây dựng giao diện "Bàn giao hồ sơ lưu trữ" dành cho Chuyên viên: cho phép kiểm tra danh mục văn bản, chọn bảng thời hạn bảo quản và xác nhận nộp lưu.
2. Xây dựng giao diện "Bàn làm việc Lưu trữ viên" dành cho Phòng Hành chính - Tổng hợp: hiển thị danh sách hồ sơ chờ nghiệm thu, công cụ kiểm tra tài liệu và form phân bổ vị trí kho (`storageLocation`).

---

## 10. Kết luận & Khuyến nghị (Conclusion & Recommendations)

**RFC-11** thiết lập một khuôn khổ quản trị hoàn chỉnh, chuẩn mực và chặt chẽ cho toàn bộ vòng đời hồ sơ công việc tại Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET). Bằng việc:
1. Phân định rõ 2 giai đoạn vòng đời và chuẩn hóa 7 trạng thái FSM;
2. Bắt buộc liên kết Bảng thời hạn bảo quản (`RetentionRule`) theo quy định của pháp luật;
3. Thực thi nguyên tắc Phân tách trách nhiệm (Separation of Duties - SoD) cấp domain chống gian lận và xung đột lợi ích;
4. Khóa cứng tính bất bi��n vĩnh viễn (WORM) của hồ sơ đã vào kho lưu trữ cơ quan;

Hệ thống QCET E-Office đảm bảo tuân thủ đầy đủ Nghị định 30/2020/NĐ-CP và Luật Lưu trữ, đồng thời bảo vệ an toàn tối đa tài sản thông tin và chứng cứ lịch sử của Nhà trường.

Khuyến nghị Ban Giám hiệu và Hội đồng Kiến trúc phê duyệt thông qua RFC-11 để làm căn cứ thực hiện các bước triển khai kỹ thuật tiếp theo trong Work Item WI-6.2c.
