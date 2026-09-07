# ĐẶC TẢ THIẾT KẾ KỸ THUẬT: PHÂN HỆ SỔ VĂN BẢN ĐẾN / ĐI & BÚT PHÊ ĐIỆN TỬ
**Tài liệu:** Technical Specification - Document Registry & Electronic Endorsement (Nghị định 30/2020/NĐ-CP)  
**Dự án:** QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)  
**Ngày lập:** 07/09/2026  
**Trạng thái:** DRAFT - CHỜ PHÊ DUYỆT  

---

## 1. CĂN CỨ PHÁP LÝ & MỤC TIÊU PHÂN HỆ

### 1.1. Căn cứ Pháp lý Bắt buộc
Thiết kế tuân thủ nghiêm ngặt **Nghị định số 30/2020/NĐ-CP ngày 05/03/2020 của Chính phủ về công tác văn thư**:
* **Điều 16 & Điều 22:** Quy định việc đăng ký văn bản đi và văn bản đến bằng Hệ thống quản lý tài liệu điện tử; quy định nguyên tắc cấp số liên tục từ ngày 01 tháng 01 đến ngày 31 tháng 12 hàng năm.
* **Phụ lục IV:** Mẫu Sổ đăng ký văn bản đến và Mẫu Sổ đăng ký văn bản đi (bắt buộc phải có khả năng in ra giấy hoặc xuất file để đóng sổ lưu trữ quản lý).
* **Phụ lục VI:** Bảng quy chuẩn các trường thông tin đầu vào (Metadata) của dữ liệu quản lý văn bản trên môi trường mạng.
* **Điều 24:** Quy định về trình tự Lãnh đạo cơ quan cho ý kiến phân phối, chỉ đạo giải quyết và theo dõi, đôn đốc việc giải quyết văn bản đến.

### 1.2. Điểm nghẽn Thực tế tại QCET & Mục tiêu Giải quyết
* **Hiện trạng:** Văn thư trường vẫn ghi chép sổ giấy thủ công; khi có công văn hỏa tốc từ Tổng cục GDNN hoặc UBND Tỉnh Bình Định, văn thư phải photo giấy chuyển tay cho Hiệu trưởng, sau đó Hiệu trưởng bút phê rồi chuyển lại cho các phòng/khoa liên quan, gây chậm trễ từ 1 đến 3 ngày.
* **Mục tiêu:**
  1. **Vào sổ điện t�� trong 60 giây:** Văn thư nhập thông tin, hệ thống tự động nhảy số đến/số đi liên tục, upload tệp PDF quét màu.
  2. **Bút phê điện tử tức thì (Electronic Endorsement):** Ban Giám hiệu nhận thông báo, mở xem PDF trực tiếp trên điện thoại/máy tính, ghi ý kiến chỉ đạo (bút phê) và giao đơn vị chủ trì.
  3. **Tự động liên thông sinh Nhiệm vụ (Document-to-Task Pipeline):** Ý kiến chỉ đạo của BGH tự động tạo ra một `Task` trong Hệ thống Quản lý công việc (Unified Task Hub) với đầy đủ thời hạn giải quyết và đơn vị chịu trách nhiệm.
  4. **Xuất Sổ Excel chuẩn Phụ lục IV:** Hỗ trợ kết xuất dữ liệu ra file Excel phục vụ thanh tra, kiểm tra và đóng sổ lưu trữ cuối năm.

---

## 2. MÔ HÌNH CƠ SỞ DỮ LIỆU (DATABASE SCHEMA - PRISMA)

### 2.1. Định nghĩa Enums Phục vụ Nghiệp vụ Văn thư
```prisma
enum DocumentType {
  VAN_BAN_DEN     // Văn bản đến từ cơ quan ngoài hoặc nội bộ gửi lên
  VAN_BAN_DI      // Văn bản do trường ban hành gửi đi
  TO_TRINH_NOI_BO // Tờ trình, phiếu xin ý kiến nội bộ
}

enum DocumentUrgency {
  THUONG          // Văn bản thường
  KHAN            // Khẩn
  THUONG_KHAN     // Thượng khẩn
  HOA_TOC         // Hỏa tốc / Hỏa tốc hẹn giờ
}

enum DocumentSecurityLevel {
  THUONG          // Công khai / Nội bộ
  MAT             // Mật
  TOI_MAT         // Tối mật
  TUYET_MAT       // Tuyệt mật
}

enum DocumentStatus {
  CHO_PHAN_CONG   // Mới vào sổ, chờ BGH cho ý kiến phân công
  DANG_XU_LY      // Đã phân công về đơn vị, đang giải quyết
  CHO_PHE_DUYET   // Đã có dự thảo trả lời, chờ duyệt
  DA_HOAN_THANH   // Đã giải quyết xong / Đã ban hành văn bản đi
  LUU_THEO_DOI    // Văn bản chỉ để biết, lưu theo dõi không sinh task
}
```

### 2.2. Chi tiết Mô hình Các Bảng Quản lý Văn bản

```prisma
// ===================================================
// 1. SỔ VĂN BẢN ĐẾN & ĐI (DOCUMENT REGISTRY)
// ===================================================
model Document {
  id                 String                @id @default(cuid())
  type               DocumentType          @map("type")
  
  // Thông tin đăng ký sổ (Chuẩn Phụ lục IV NĐ 30)
  registrationNumber Int                   @map("registration_number") // Số đến hoặc Số đi (liên tục 1, 2, 3...)
  documentYear       Int                   @map("document_year")       // Năm văn bản (ví dụ: 2026)
  registeredDate     DateTime              @default(now()) @map("registered_date")
  
  // Thông tin văn bản gốc
  originalNumber     String                @map("original_number") @db.VarChar(100) // Ví dụ: "125/TCGDNN-VP" hoặc "89/CĐKTCN-ĐT"
  issuedDate         DateTime              @map("issued_date")                     // Ngày tháng trên văn bản gốc
  issuingAuthority   String                @map("issuing_authority") @db.VarChar(255)// Nơi ban hành (Bộ LĐTBXH, Tỉnh, Doanh nghiệp...)
  
  // Trích yếu nội dung & Phân loại
  category           String                @db.VarChar(100)                        // Nghị quyết, Quyết định, Công văn, Kế hoạch...
  summary            String                @db.Text                                // Trích yếu nội dung văn bản
  urgency            DocumentUrgency       @default(THUONG)
  securityLevel      DocumentSecurityLevel @default(THUONG) @map("security_level")
  
  // Hạn giải quyết văn bản (nếu có yêu cầu trả lời)
  dueDate            DateTime?             @map("due_date")
  status             DocumentStatus        @default(CHO_PHAN_CONG)
  
  // Đơn vị & Người phụ trách chính
  leadDepartmentId   String?               @map("lead_department_id") @db.VarChar(50)
  leadDepartment     Department?           @relation("LeadDepartmentDocs", fields: [leadDepartmentId], references: [id])
  leadUserId         String?               @map("lead_user_id")
  leadUser           User?                 @relation("LeadUserDocs", fields: [leadUserId], references: [id])
  
  // Văn thư tiếp nhận / vào sổ
  registeredById     String                @map("registered_by_id")
  registeredBy       User                  @relation("DocRegisteredBy", fields: [registeredById], references: [id])
  
  // Tệp đính kèm số hóa & Ý kiến chỉ đạo (Bút phê)
  attachments        DocumentAttachment[]
  directives         DocumentDirective[]
  
  // Nhiệm vụ liên kết được sinh ra từ văn bản này
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
// ===================================================
model DocumentAttachment {
  id         String   @id @default(cuid())
  documentId String   @map("document_id")
  fileName   String   @map("file_name") @db.VarChar(255)
  fileUrl    String   @map("file_url") @db.Text
  fileSize   Int      @map("file_size") // Dung lượng bytes
  mimeType   String   @map("mime_type") @db.VarChar(100) // application/pdf
  sha256Hash String?  @map("sha256_hash") @db.VarChar(64) // Toàn vẹn dữ liệu
  isOriginal Boolean  @default(true) @map("is_original") // Bản chính có dấu đỏ
  
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([documentId])
  @@map("document_attachments")
}

// ===================================================
// 4. BÚT PH�� & Ý KIẾN CHỈ ĐẠO BGH (DIRECTIVES)
// ===================================================
model DocumentDirective {
  id               String      @id @default(cuid())
  documentId       String      @map("document_id")
  leaderId         String      @map("leader_id") // Thành viên BGH cho ý kiến
  instruction      String      @db.Text          // Nội dung bút phê chỉ đạo
  deadline         DateTime?                     // Hạn chót BGH yêu cầu báo cáo
  assignedDeptId   String      @map("assigned_dept_id") @db.VarChar(50)
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

## 3. ENGINE CẤP SỐ TỰ ĐỘNG & QUY TRÌNH BÚT PHÊ (CORE LOGIC)

### 3.1. Engine Cấp số Tự động Atomic (Concurrency Safe)
Để đảm bảo không bao giờ bị trùng số hoặc nhảy cách số ngay cả khi nhiều nhân viên văn thư cùng vào sổ một lúc:
```typescript
// src/lib/documents/numbering-engine.ts
import prisma from '@/lib/prisma';
import { DocumentType } from '@prisma/client';

export async function getNextRegistrationNumber(type: DocumentType, year: number): Promise<number> {
  return await prisma.$transaction(async (tx) => {
    // Sử dụng upsert kết hợp increment atomic trong transaction của PostgreSQL
    const sequence = await tx.documentNumberSequence.upsert({
      where: { type_year: { type, year } },
      create: { type, year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return sequence.lastNumber;
  });
}
```

### 3.2. Cơ chế Tự động Chuyển Bút phê thành Nhiệm vụ (Document-to-Task Automation)
Khi Lãnh đạo BGH hoàn tất bút phê trên giao diện:
1. Ghi bản ghi vào bảng `document_directives`.
2. Kiểm tra nếu có `assignedDeptId`:
   * Tự động gọi hàm tạo Task mới trong bảng `tasks` với:
     * `title`: `"[Xử lý văn bản " + doc.originalNumber + "] " + doc.summary.substring(0, 100)`.
     * `description`: `"Ý kiến chỉ đạo của BGH: " + directive.instruction`.
     * `scope`: `SCHOOL`.
     * `priority`: Ánh xạ tương ứng từ mức độ khẩn của văn bản (HOA_TOC -> URGENT, KHAN -> HIGH).
     * `dueDate`: Theo hạn chỉ đạo của BGH, hoặc hạn xử lý trên văn bản.
     * `departmentId`: Đơn vị được giao chủ trì.
   * Cập nhật trường `linkedTaskId` trên bảng `documents` và đánh dấu `isTaskGenerated = true`.
   * Chuyển trạng thái văn b���n sang `DANG_XU_LY`.

---

## 4. GIAO DIỆN NGƯỜI DÙNG & XUẤT SỔ EXCEL (UI & EXPORT)

### 4.1. Màn hình Sổ Văn bản Đến / Đi
* **Bộ lọc chuẩn:** Lọc theo Năm, Sổ (Đến/Đi), Mức độ khẩn, Đơn vị chủ trì, Trạng thái giải quyết.
* **Bảng dữ liệu công thái học:** Sử dụng font *JetBrains Mono tabular-nums* cho Số đến, Số ký hiệu gốc và Ngày ban hành.
* **Khung xem PDF tích hợp:** Sử dụng trình xem PDF trực tiếp trong trang (Split View 50/50: Nửa trái hiển thị bản scan PDF, nửa phải hiển thị thông tin trích yếu và khung bút phê của BGH).

### 4.2. Xuất Sổ Excel Chuẩn Phụ lục IV (Nghị định 30/2020/NĐ-CP)
* Xây dựng API route `GET /api/documents/export-excel?type=VAN_BAN_DEN&year=2026`.
* Định dạng file Excel xuất ra có tiêu đề Quốc hiệu, Tên trường, Tên sổ ("SỔ ĐĂNG KÝ VĂN BẢN ĐẾN NĂM 2026") và đầy đủ 9 cột quy định:
  1. Số đến
  2. Ngày đến
  3. Tác giả (Nơi gửi)
  4. Số và ký hiệu văn bản đến
  5. Ngày tháng văn bản
  6. Tên loại và trích yếu nội dung
  7. Đơn vị hoặc người nhận
  8. Hạn giải quyết
  9. Ghi chú / Ký nhận

---

## 5. KẾ HOẠCH TRIỂN KHAI & NGHIỆM THU

1. **Giai đoạn phát triển:** 02 tuần (Triển khai song song với kiểm thử thí điểm Task Hub).
2. **Tiêu chí hoàn thành (DoD):**
   * Đăng ký thành công văn bản đến và văn bản đi với số tự động tăng liên tục.
   * Thử nghiệm đồng thời 5 phiên vào sổ cùng 1 giây không bị xung đột số (Unique Constraint Pass).
   * Bút phê của BGH tự động kích hoạt tạo nhiệm vụ mới xuất hiện tức thì trên Dashboard của Trưởng phòng Đào tạo / Trưởng khoa CNTT.
   * Xuất file Excel mở được trên Microsoft Excel và LibreOffice, hiển thị đúng mẫu kẻ bảng theo Phụ lục IV Nghị định 30.
