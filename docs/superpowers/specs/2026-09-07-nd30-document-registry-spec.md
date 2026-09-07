# ĐẶC TẢ THIẾT KẾ KỸ THUẬT: PHÂN HỆ SỔ VĂN BẢN ĐẾN / ĐI & BÚT PHÊ ĐIỆN TỬ
**Tài liệu:** Technical Specification - Document Registry & Electronic Endorsement (Nghị định 30/2020/NĐ-CP)  
**Dự án:** QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)  
**Ngày lập:** 07/09/2026  
**Trạng thái:** FINAL SPECIFICATION - SẴN SÀNG TRIỂN KHAI  

---

## 1. CĂN CỨ PHÁP LÝ & MỤC TIÊU PHÂN HỆ

### 1.1. Căn cứ Pháp lý Bắt buộc
Thiết kế tuân thủ nghiêm ngặt **Nghị định số 30/2020/NĐ-CP ngày 05/03/2020 của Chính phủ về công tác văn thư**:
* **Điều 14, 15, 16:** Quy định trình tự quản lý, nguyên tắc cấp số, thời gian ban hành và đăng ký văn bản đi bằng Hệ thống quản lý tài liệu điện tử. Đánh số bắt đầu từ số 01 vào ngày 01/01 và kết thúc vào ngày 31/12 hàng năm.
* **Điều 20, 21, 22:** Quy định trình tự tiếp nhận, số hóa và đăng ký văn bản đến. Mọi văn bản đến cơ quan bắt buộc phải được đăng ký vào Hệ thống mới có giá trị giao giải quyết.
* **Điều 23 & Điều 24:** Quy định trình tự Lãnh đạo cơ quan cho ý kiến phân phối, chỉ đạo giải quyết (Bút phê) và theo dõi, đôn đốc tiến độ giải quyết văn bản đến.
* **Phụ lục IV:** Quy định mẫu biểu Sổ đăng ký văn bản đến (9 cột bắt buộc) và Sổ đăng ký văn bản đi (10 cột bắt buộc), sẵn sàng kết xuất file hoặc in giấy đóng sổ lưu trữ.
* **Phụ lục VI:** Bảng danh mục chuẩn các trường thông tin đầu vào (Metadata) của dữ liệu quản lý văn bản trên môi trường mạng.

### 1.2. Điểm nghẽn Thực tế tại QCET & Mục tiêu Giải quyết
* **Hiện trạng tại Trường:** Văn thư trường vẫn ghi chép sổ giấy thủ công; khi có công văn hỏa tốc từ Tổng cục GDNN, Bộ LĐTBXH hoặc UBND Tỉnh Bình Định, văn thư photo giấy chuyển tay cho Hiệu trưởng, Hiệu trưởng bút phê tay rồi chuyển lại các phòng/khoa, gây chậm trễ từ 1 đến 3 ngày, dễ thất lạc văn bản và khó kiểm soát hạn xử lý.
* **Mục tiêu Giải quyết:**
  1. **Vào sổ điện tử trong 60 giây:** Giao diện tối ưu công thái học, bàn phím nhanh, tự động nhảy số đến/số đi liên tục theo năm, upload tệp PDF quét màu có dấu đỏ.
  2. **Bút phê điện tử tức thì (Electronic Endorsement):** Ban Giám hiệu nhận thông báo đẩy tức thì, mở xem văn bản PDF trực tiếp trên Split-View (máy tính/di động), ghi ý kiến chỉ đạo hoặc chọn mẫu chỉ đạo nhanh 1 chạm (Quick Presets).
  3. **Tự động liên thông sinh Nhiệm vụ (Document-to-Task Pipeline):** Ý kiến chỉ đạo của BGH tự động tạo ra một `Task` cấp trường (`scope: SCHOOL`) trong Hệ thống Quản lý công việc (Unified Task Hub) với đơn vị chủ trì, hạn xử lý và đính kèm link PDF gốc.
  4. **Xuất Sổ Excel chuẩn Phụ lục IV:** Kết xuất bảng tính chuẩn xác 100% theo quy định Phục lục IV NĐ 30 phục vụ thanh tra, kiểm tra và lưu trữ cuối năm.

---

## 2. MÔ HÌNH DỮ LIỆU (PRISMA SCHEMA SPECIFICATION)

### 2.1. Chuẩn hóa Enums Nghiệp vụ

```prisma
enum UserRole {
  BAN_GIAM_HIEU
  TRUONG_PHONG
  CHUYEN_VIEN
  VAN_THU         // Cán bộ Văn phòng phụ trách vào sổ, cấp số và phát hành
  ADMIN
}

enum DocumentType {
  VAN_BAN_DEN     // Văn bản đến từ cơ quan bên ngoài hoặc cấp trên
  VAN_BAN_DI      // Văn bản do trường ban hành gửi đi bên ngoài/nội bộ
  TO_TRINH_NOI_BO // Tờ trình, phiếu xin ý kiến nội bộ các đơn vị trình BGH
}

enum DocumentUrgency {
  THUONG          // Văn bản thường
  KHAN            // Khẩn
  THUONG_KHAN     // Thượng khẩn
  HOA_TOC         // Hỏa tốc / Hỏa tốc hẹn giờ
}

enum DocumentSecurityLevel {
  THUONG          // Công khai / Nội bộ
  MAT             // Mật (Cấp dải số riêng)
  TOI_MAT         // Tối mật
  TUYET_MAT       // Tuyệt mật
}

enum DocumentStatus {
  CHO_PHAN_CONG   // Mới vào sổ, chờ BGH bút phê chỉ đạo
  DANG_XU_LY      // Đã phân công đơn vị chủ trì, đang trong hạn giải quyết
  CHO_PHE_DUYET   // Đơn vị đã hoàn thành văn bản trả lời, chờ BGH ký duyệt
  DA_HOAN_THANH   // Đã giải quyết xong / Đã ban hành văn bản đi
  LUU_THEO_DOI    // Văn bản chỉ để biết, không yêu cầu báo cáo/sinh task
}
```

### 2.2. Chi tiết Mô hình Các Bảng trong PostgreSQL

```prisma
// ===================================================
// 1. BẢNG SỔ VĂN BẢN (DOCUMENTS)
// Đáp ứng đồng thời Phụ lục IV và Phụ lục VI NĐ 30/2020
// ===================================================
model Document {
  id                 String                @id @default(cuid())
  type               DocumentType          @map("type")
  
  // Thông tin đăng ký sổ (Số đến hoặc Số đi liên tục theo năm)
  registrationNumber Int                   @map("registration_number")
  documentYear       Int                   @map("document_year")       // Ví dụ: 2026
  registeredDate     DateTime              @default(now()) @map("registered_date")
  
  // Thông tin văn bản gốc
  originalNumber     String                @map("original_number") @db.VarChar(100) // "125/TCGDNN-VP" hoặc "89/CĐKTCN-ĐT"
  issuedDate         DateTime              @map("issued_date")                     // Ngày tháng ký trên văn bản
  issuingAuthority   String                @map("issuing_authority") @db.VarChar(255)// Nơi ban hành (Bộ, Tỉnh, Trường...)
  
  // Trích yếu nội dung & Phân loại hành chính
  category           String                @db.VarChar(100)                        // Nghị quyết, Quyết định, Công văn, Kế hoạch...
  summary            String                @db.Text                                // Trích yếu nội dung văn bản
  urgency            DocumentUrgency       @default(THUONG)
  securityLevel      DocumentSecurityLevel @default(THUONG) @map("security_level")
  
  // Các trường đặc thù Văn bản Đi (Phụ lục IV Mẫu Sổ Văn bản Đi)
  signerName         String?               @map("signer_name") @db.VarChar(150)    // Người ký ban hành (Hiệu trưởng/Phó HT)
  signerTitle        String?               @map("signer_title") @db.VarChar(100)   // Chức vụ người ký (Hiệu trưởng)
  draftingDeptId     String?               @map("drafting_dept_id") @db.VarChar(50)// Đơn vị soạn thảo
  draftingDept       Department?           @relation("DraftingDeptDocs", fields: [draftingDeptId], references: [id])
  recipientList      String?               @map("recipient_list") @db.Text         // Nơi nhận văn bản
  distributedCopies  Int?                  @default(1) @map("distributed_copies")  // Số lượng bản phát hành
  
  // Các trường đặc thù Văn bản Đến (Phụ lục IV Mẫu Sổ Văn bản Đến)
  dueDate            DateTime?             @map("due_date")                        // Hạn giải quyết
  leadDepartmentId   String?               @map("lead_department_id") @db.VarChar(50)// Đơn vị chủ trì giải quyết
  leadDepartment     Department?           @relation("LeadDepartmentDocs", fields: [leadDepartmentId], references: [id])
  leadUserId         String?               @map("lead_user_id")                    // Cán bộ chịu trách nhiệm chính
  leadUser           User?                 @relation("LeadUserDocs", fields: [leadUserId], references: [id])
  
  // Trạng thái vòng đời văn bản
  status             DocumentStatus        @default(CHO_PHAN_CONG)
  notes              String?               @db.Text                                // Ghi chú lưu sổ
  
  // Văn thư thực hiện vào sổ
  registeredById     String                @map("registered_by_id")
  registeredBy       User                  @relation("DocRegisteredBy", fields: [registeredById], references: [id])
  
  // Quan hệ tệp đính kèm & Bút phê BGH
  attachments        DocumentAttachment[]
  directives         DocumentDirective[]
  
  // Liên thông Unified Task Hub
  linkedTaskId       String?               @unique @map("linked_task_id")
  linkedTask         Task?                 @relation(fields: [linkedTaskId], references: [id])

  createdAt          DateTime              @default(now()) @map("created_at")
  updatedAt          DateTime              @updatedAt @map("updated_at")

  @@unique([type, documentYear, registrationNumber])
  @@index([type, documentYear, registeredDate])
  @@index([status, urgency, dueDate])
  @@map("documents")
}

// ===================================================
// 2. BỘ ĐẾM SỐ TỰ ĐỘNG ATOMIC (NUMBER SEQUENCE)
// Đảm bảo nguyên tắc cấp số liên tục Điều 15 & Điều 22
// ===================================================
model DocumentNumberSequence {
  id         String       @id @default(cuid())
  type       DocumentType
  year       Int
  lastNumber Int          @default(0) @map("last_number")
  updatedAt  DateTime     @updatedAt @map("updated_at")

  @@unique([type, year])
  @@map("document_number_sequences")
}

// ===================================================
// 3. TỆP ĐÍNH KÈM SỐ HÓA (ATTACHMENTS)
// Tiêu chuẩn scan màu PDF/A có dấu đỏ (Phụ lục I NĐ 30)
// ===================================================
model DocumentAttachment {
  id         String   @id @default(cuid())
  documentId String   @map("document_id")
  fileName   String   @map("file_name") @db.VarChar(255)
  fileUrl    String   @map("file_url") @db.Text
  fileSize   Int      @map("file_size") // Bytes
  mimeType   String   @map("mime_type") @db.VarChar(100) // application/pdf
  sha256Hash String?  @map("sha256_hash") @db.VarChar(64)
  isOriginal Boolean  @default(true) @map("is_original") // Bản chính có dấu đỏ
  
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([documentId])
  @@map("document_attachments")
}

// ===================================================
// 4. BÚT PHÊ & Ý KIẾN CHỈ ĐẠO BGH (DIRECTIVES)
// Quy chuẩn Điều 24 NĐ 30
// ===================================================
model DocumentDirective {
  id               String      @id @default(cuid())
  documentId       String      @map("document_id")
  leaderId         String      @map("leader_id") // Thành viên BGH cho bút phê
  instruction      String      @db.Text          // Nội dung bút phê chỉ đạo
  deadline         DateTime?                     // Hạn chót BGH yêu cầu báo cáo
  assignedDeptId   String      @map("assigned_dept_id") @db.VarChar(50)
  collaboratorIds  String?     @map("collaborator_ids") @db.Text // JSON danh sách đơn vị phối hợp
  isTaskGenerated  Boolean     @default(false) @map("is_task_generated")
  
  document         Document    @relation(fields: [documentId], references: [id], onDelete: Cascade)
  leader           User        @relation("LeaderDirectives", fields: [leaderId], references: [id])
  assignedDept     Department  @relation("DirectiveDepartments", fields: [assignedDeptId], references: [id])
  
  createdAt        DateTime    @default(now()) @map("created_at")

  @@index([documentId, leaderId])
  @@map("document_directives")
}
```

---

## 3. ENGINE CẤP SỐ TỰ ĐỘNG & BÚT PHÊ ĐIỆN TỬ (CORE LOGIC)

### 3.1. Engine Cấp số Atomic Tự động (Concurrency Safe)
Để đảm bảo không bao giờ bị trùng số hoặc cách quãng số ngay cả khi 10 cán bộ văn thư đồng thời vào sổ:

```typescript
// src/lib/documents/numbering-engine.ts
import prisma from '@/lib/prisma';
import { DocumentType } from '@prisma/client';

export async function getNextRegistrationNumber(type: DocumentType, year: number): Promise<number> {
  return await prisma.$transaction(async (tx) => {
    const sequence = await tx.documentNumberSequence.upsert({
      where: {
        type_year: { type, year },
      },
      create: {
        type,
        year,
        lastNumber: 1,
      },
      update: {
        lastNumber: { increment: 1 },
      },
    });
    return sequence.lastNumber;
  });
}
```

### 3.2. Đường ống Tự động Bút phê Sinh Nhiệm vụ (Document-to-Task Pipeline)
Khi Lãnh đạo BGH ký nhận bút phê trên giao diện:
1. **Lưu Bút phê:** Tạo bản ghi mới trong `DocumentDirective`.
2. **Khởi tạo Task Liên thông:**
   * `title`: `"[Văn bản " + doc.originalNumber + "] " + doc.summary.substring(0, 100)`
   * `description`: `doc.summary + "\n\n--- Ý KIẾN CHỈ ĐẠO BGH ---\n" + directive.instruction`
   * `scope`: `SCHOOL` (Nhiệm vụ trọng tâm cấp trường)
   * `departmentId`: Đơn vị được giao chủ trì (`assignedDeptId`)
   * `priority`: Ánh xạ trực tiếp từ `urgency` (HOA_TOC -> URGENT, THUONG_KHAN -> HIGH, KHAN -> HIGH, THUONG -> NORMAL)
   * `dueDate`: Hạn do BGH ấn định trong bút phê (hoặc hạn trên văn bản gốc nếu BGH không chỉnh sửa)
3. **Đồng bộ Vòng đời 2 chiều:**
   * Cập nhật `linkedTaskId` trên bảng `Document`, đổi trạng thái sang `DANG_XU_LY`.
   * Khi đơn vị chủ trì nộp sản phẩm hoàn thành trên Task Hub và BGH duyệt nghiệm thu -> Hệ thống tự động cập nhật trạng thái văn bản sang `DA_HOAN_THANH`.

---

## 4. ĐẶC TẢ GIAO TIẾP API (RESTFUL API ROUTES)

| Phương thức | Endpoint | Mô tả chức năng | Quyền truy cập |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/documents` | Lấy danh sách văn bản (hỗ trợ lọc theo `type`, `year`, `urgency`, `status`, `dept`, `search`) | All authenticated |
| `POST` | `/api/documents` | Đăng ký vào sổ văn bản mới (Tự động cấp số atomic) | `VAN_THU`, `ADMIN` |
| `GET` | `/api/documents/[id]` | Lấy chi tiết văn bản kèm tệp đính kèm, danh sách bút phê và Task liên kết | All authenticated |
| `PATCH` | `/api/documents/[id]` | Cập nhật thông tin trích yếu, hạn xử lý, ghi chú | `VAN_THU`, `ADMIN` |
| `POST` | `/api/documents/[id]/directives` | BGH ghi bút phê chỉ đạo và kích hoạt tạo Task tự động | `BAN_GIAM_HIEU`, `ADMIN` |
| `POST` | `/api/documents/upload` | Tải lên tệp PDF scan văn bản gốc, tạo mã băm SHA-256 | `VAN_THU`, `ADMIN` |
| `GET` | `/api/documents/export-excel` | Xuất file Excel chuẩn Phụ lục IV NĐ 30 theo loại văn bản và năm | `VAN_THU`, `ADMIN`, `BAN_GIAM_HIEU` |

---

## 5. THIẾT KẾ GIAO DIỆN NGƯỜI DÙNG (UI/UX ERGONOMICS)

### 5.1. Bố cục Split-View 50/50 (Tối ưu Xem & Phê duyệt)
* **Khung bên trái (50%):** Trình xem PDF nhúng trực tiếp (Inline PDF Viewer) hỗ trợ phóng to/thu nhỏ, xoay trang, nhảy trang nhanh và tải file gốc có dấu đỏ.
* **Khung bên phải (50%):**
  * Thẻ tóm tắt thông tin: Số đến/đi, Số ký hiệu gốc, Cơ quan ban hành, Trích yếu nội dung (với huy hiệu màu cho độ khẩn).
  * Lịch sử luân chuyển & Các ý kiến chỉ đạo đã có.
  * Hộp công cụ Bút phê BGH với các mẫu chỉ đạo nhanh 1 chạm (Quick Presets):
    * *[Giao P.Đào tạo]*: "Giao Phòng Đào tạo chủ trì, phối hợp các đơn vị tham mưu trước ngày..."
    * *[Giao P.TCKT]*: "Giao Phòng Tài chính - Kế toán thẩm định dự toán và báo cáo BGH..."
    * *[Phổ biến toàn trường]*: "Chuyển các đơn vị phổ biến cán bộ, giảng viên thực hiện..."

### 5.2. Biểu mẫu Vào sổ Cực nhanh (Dưới 60 giây)
* Hỗ trợ phím tắt tab chuyển trường liên tục.
* Tự động đề xuất danh sách Cơ quan ban hành phổ biến (UBND Tỉnh Bình Định, Bộ LĐTBXH, Tổng cục GDNN, Sở LĐTBXH...).
* Kéo thả tệp PDF trực tiếp vào khung tải lên, hệ thống tự động đọc dung lượng và tính mã băm SHA-256 xác thực toàn vẹn dữ liệu.

### 5.3. Kết xuất Excel Chuẩn Phụ lục IV NĐ 30/2020/NĐ-CP
* **Định dạng file:** `.xlsx` với phông chữ Times New Roman chuẩn hành chính.
* **Đầu trang (Header):**
  * Tên cơ quan chủ quản: ỦY BAN NHÂN DÂN TỈNH BÌNH ĐỊNH.
  * Tên cơ sở: TRƯỜNG CAO ĐẲNG KỸ THUẬT CÔNG NGHỆ QUY NHƠN.
  * Tiêu đề: **SỔ ĐĂNG KÝ VĂN BẢN ĐẾN NĂM 2026** (hoặc **SỔ ĐĂNG KÝ VĂN BẢN ĐI NĂM 2026**).
* **Đúng cấu trúc 9 cột cho Văn bản Đến và 10 cột cho Văn bản Đi** theo quy định pháp lý.

---

## 6. KẾ HOẠCH KIỂM THỬ & TIÊU CHÍ NGHIỆM THU (DOD)

### 6.1. Kiểm thử Tự động (Automated Testing)
1. **Unit Test Cấp số Atomic (`tests/document-numbering.test.ts`):** Giả lập 10 giao dịch đồng thời yêu cầu cấp số đến trong cùng 1 năm 2026, kiểm tra tính duy nhất và liên tục từ 1 đến 10 mà không có xung đột khóa chính hay mất mát số.
2. **Integration Test Bút phê Sinh Nhiệm vụ (`tests/document-directive-pipeline.test.ts`):** Kiểm tra khi BGH gọi API tạo directive, 1 bản ghi Task hợp lệ được tạo ra với đúng `scope: SCHOOL`, đúng `departmentId` và đúng độ ưu tiên.
3. **Excel Export Validation (`tests/document-excel-export.test.ts`):** Kiểm tra file buffer xuất ra từ route `/api/documents/export-excel` chứa đủ các header và cột theo Phụ lục IV.

### 6.2. Tiêu chí Hoàn thành (Definition of Done)
* [ ] 100% các bảng văn bản và enums được cập nhật vào `prisma/schema.prisma`.
* [ ] Đăng ký thành công văn bản đến và văn bản đi với số tự động tăng liên tục.
* [ ] Split-View xem PDF hoạt động mượt mà, hỗ trợ cả giao diện desktop và mobile.
* [ ] Bút phê của BGH tự động tạo Task xuất hiện ngay trên Dashboard của Trưởng đơn vị được phân công.
* [ ] Xuất file Excel mở được trên Microsoft Excel, LibreOffice hiển thị chuẩn phông và kẻ bảng Phụ lục IV.
* [ ] Toàn bộ test suite chạy lệnh `npm test` và `npm run typecheck` đạt 100% xanh.
