# ADR-008: FileObject Canonical Model, Deduplication, Upload Constraints & Metadata Architecture

- **Status**: ACCEPTED
- **Date**: 2026-09-23
- **Deciders**: Architecture Review Board / Owner
- **Work Item**: WI-7.5 (Issue #90)
- **Tham chiếu**: WI-1.3 (Báo cáo Kiểm toán An toàn Tệp tin), Nghị định 30/2020/NĐ-CP (Công tác văn thư), Luật Bảo vệ bí mật nhà nước 117/2025/QH15

---

## 1. Bối cảnh & V��n đề Kỹ thuật (Context & Problem Statement)

Trong kiến trúc ban đầu của QCET E-Office, việc quản lý tệp tin nhị phân (binary assets) và tài liệu đính kèm bị phân mảnh trên nhiều thực thể nghiệp vụ riêng biệt:
1. `TaskDeliverable.fileUrl`: Lưu đường dẫn tương đối của tài liệu minh chứng nhiệm vụ.
2. `DocumentAttachment.fileUrl`: Lưu đường dẫn tệp đính kèm văn bản đến và văn bản đi.
3. `Meeting.materialsUrl`: Lưu đường dẫn tài liệu phục vụ phiên họp.
4. `DossierItem.itemId` / `notes`: Lưu trữ hỗn hợp đường dẫn tệp hồ sơ công việc dưới dạng chuỗi văn bản tự do.
5. `User.avatarUrl`: Ảnh đại diện người dùng.

### Những bất cập và rủi ro kiến trúc nghiêm trọng:

1. **Rủi ro Tham chiếu Đối tượng & So khớp mờ (Storage-Key Binding Collision / IDOR)**:
   - Tại Báo cáo Kiểm toán WI-1.3 (`docs/architecture/audits/file-authorization-audit.md`), các chuyên gia bảo mật đã chỉ ra lỗ hổng: Do không có bảng quản lý tệp tập trung với khóa chính định danh duy nhất, endpoint tải tệp `/api/files/[...path]` phải dùng toán tử so khớp chuỗi con (`{ contains: normalizedRelative }`) trên bảng `DossierItem` và `Meeting`.
   - Điều này tạo ra rủi ro **Confused Deputy**: Người dùng có thể yêu cầu tải một tệp nhạy cảm trên đĩa nhưng hệ thống lại khớp nhầm với một bản ghi công khai có tên chứa chuỗi con đó, dẫn đến việc cấp quyền truy cập trái phép.
2. **Thiếu cơ chế Chống trùng lặp (Zero Deduplication)**:
   - Các văn bản chỉ đạo của Bộ GD&ĐT hoặc thông báo chung của Nhà trường thường được đính kèm vào hàng chục nhiệm vụ và hồ sơ khác nhau. Hệ thống hiện tại lưu trữ trùng lặp các tệp vật lý giống hệt nhau, gây lãng phí từ 40% đến 60% dung lượng đĩa cứng.
3. **Thiếu Metadata Kiểm soát & An toàn Tệp (Lack of Metadata & Safety Controls)**:
   - Không có trường băm toàn vẹn dữ liệu (SHA-256 checksum) để kiểm tra tính toàn vẹn của văn bản pháp lý.
   - Không có trường ghi nhận dung lượng byte chuẩn xác (`byteSize`) và MIME type chuẩn hóa.
   - Thiếu trạng thái quét an ninh/mã độc (`scanStatus`).
4. **Không thể phân tách Storage Backend**:
   - Đường dẫn gắn chặt vào cấu trúc thư mục máy chủ cục bộ (`uploads/...`), cản trở việc mở rộng sang hạ tầng lưu trữ đối tượng đám mây (S3/MinIO) hoặc mạng phân tán khi trường mở rộng quy mô.

---

## 2. Quyết định Kiến trúc (Decision)

Thiết lập mô hình **FileObject Canonical Model** tập trung, chuẩn hóa toàn bộ vòng đời tiếp nhận, kiểm tra, lưu trữ, và phân quyền tệp tin trong toàn hệ thống QCET E-Office:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           CANONICAL FILEOBJECT MODEL                             │
│                                                                                  │
│   id             : UUID (Primary Key)                                            │
│   storageKey     : String (Unique content-addressed or secure slug)              │
│   storageProvider: Enum (LOCAL_DISK, S3_COMPATIBLE, MINIO)                       │
│   contentHash    : String (SHA-256 digest for deduplication & integrity)         │
│   byteSize       : BigInt (Exact file size in bytes)                             │
│   mimeType       : String (Standardized MIME type)                               │
│   extension      : String (Whitelisted file extension)                           │
│   scanStatus     : Enum (PENDING, CLEAN, INFECTED, FAILED)                       │
│   uploadedById   : UUID (Reference to User)                                      │
└──────────────────────────────────────────────────────────────────────────────────┘
            │                                 │                            │
            ▼                                 ▼                            ▼
  [TaskDeliverable]                 [DocumentAttachment]             [DossierItem]
  (task_deliverables)               (document_attachments)           (dossier_items)
```

---

### 2.1. Thiết kế Schema Chuẩn tắc (Canonical Schema Specification)

Đặc tả Prisma Schema định nghĩa cho `FileObject`:

```prisma
enum FileScanStatus {
  PENDING
  CLEAN
  INFECTED
  FAILED
}

enum StorageProvider {
  LOCAL_DISK
  S3_COMPATIBLE
  MINIO
}

enum FileClassification {
  PUBLIC
  INTERNAL
  RESTRICTED
  CONFIDENTIAL
}

model FileObject {
  id              String             @id @default(uuid())
  storageKey      String             @unique @map("storage_key")
  storageProvider StorageProvider    @default(LOCAL_DISK) @map("storage_provider")
  originalName    String             @map("original_name")
  mimeType        String             @map("mime_type")
  extension       String             @map("extension")
  byteSize        BigInt             @map("byte_size")
  contentHash     String             @map("content_hash") // SHA-256 hex digest
  classification  FileClassification @default(INTERNAL) @map("classification")
  scanStatus      FileScanStatus     @default(PENDING) @map("scan_status")
  scanResult      String?            @map("scan_result")
  referenceCount  Int                @default(1) @map("reference_count")
  uploadedById    String             @map("uploaded_by_id")
  uploadedBy      User               @relation(fields: [uploadedById], references: [id])
  isArchived      Boolean            @default(false) @map("is_archived")
  metadata        Json?              @map("metadata")
  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt @map("updated_at")

  // Quan hệ tham chiếu từ các phân hệ
  deliverables    TaskDeliverable[]
  attachments     DocumentAttachment[]
  dossierItems    DossierItem[]

  @@index([contentHash])
  @@index([uploadedById])
  @@index([mimeType])
  @@index([classification])
  @@index([scanStatus])
  @@map("file_objects")
}
```

---

### 2.2. Cơ chế Chống Trùng lặp Dữ liệu (Content-Addressed Deduplication)

Quy trình tải lên tệp áp dụng nguyên tắc **Single-Instance Storage**:

1. Khi máy chủ nhận luồng tải lên (`multipart/form-data` hoặc chunked upload):
   - Tính toán hàm băm an toàn **SHA-256** của toàn bộ nội dung byte: `hash = crypto.createHash('sha256').update(buffer).digest('hex')`.
2. Kiểm tra trong cơ sở dữ liệu:
   ```typescript
   const existingFile = await prisma.fileObject.findFirst({
     where: { contentHash: hash, scanStatus: "CLEAN" },
   });
   ```
3. Nếu tìm thấy tệp trùng lặp:
   - **Không ghi thêm tệp vật lý mới vào ổ cứng**.
   - Tăng `referenceCount` của `FileObject` hiện có.
   - Tạo bản ghi liên kết nghiệp vụ (`TaskDeliverable`, `DocumentAttachment`...) trỏ trực tiếp đến `existingFile.id`.
   - Trả về ngay lập tức với thời gian phản hồi dưới 50ms (Zero Disk I/O).
4. Nếu là tệp mới:
   - Tạo `storageKey` chuẩn hóa: `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${extension}`.
   - Ghi tệp vào bộ nhớ lưu trữ an toàn.
   - Lưu bản ghi `FileObject` với `scanStatus = 'PENDING'`.

---

### 2.3. Ràng buộc Tải lên & Hạn ngạch (Upload Constraints & Quotas)

Áp dụng bảng ma trận hạn mức nghiêm ngặt trên toàn hệ thống:

| Nhóm Tài nguyên | Phần mở rộng cho phép | Kích thước tối đa | Hạn ngạch tối đa/yêu cầu | Yêu cầu đặc thù |
| :--- | :--- | :---: | :---: | :--- |
| **Văn bản & Hồ sơ** (`DOCUMENT_ATTACHMENT`, `DOSSIER_ITEM`) | `.pdf`, `.docx`, `.xlsx`, `.txt`, `.csv` | 100 MB | 5 tệp / lần | Bắt buộc kiểm tra chữ ký số PDF/A nếu là văn bản ban hành chính thức. |
| **Minh chứng Nhiệm vụ** (`TASK_DELIVERABLE`) | `.pdf`, `.docx`, `.xlsx`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.zip` | 50 MB | 10 tệp / lần | Giới hạn dung lượng ảnh tối đa 10 MB/ảnh. |
| **Tài liệu Cuộc họp** (`MEETING_ATTACHMENT`) | `.pdf`, `.docx`, `.pptx`, `.xlsx` | 50 MB | 10 tệp / lần | Tự động chuyển đổi PDF preview cho trình duyệt di động. |
| **Ảnh đại diện** (`AVATAR`) | `.jpg`, `.jpeg`, `.png`, `.webp` | 5 MB | 1 tệp / lần | Tự động crop và chuẩn hóa kích thước 256x256 pixel. |

- **Quy tắc An ninh Bất biến**:
  - **TUYỆT ĐỐI CẤM** các phần mở rộng thực thi: `.exe`, `.bat`, `.sh`, `.php`, `.js`, `.py`, `.html`, `.svg`.
  - Tệp tải lên phải được kiểm tra "Magic Bytes" ở đầu tệp (file signature) để xác nhận MIME type thực tế, ngăn chặn tấn công giả mạo phần mở rộng.

---

### 2.4. Loại bỏ Triệt để Rủi ro So khớp Mờ (Zero Fuzzy Matching)

Để giải quyết tận gốc rủi ro IDOR và Resource-Binding Collision đã nêu trong Báo cáo Kiểm toán WI-1.3:
1. Endpoint tải tệp `/api/files/[fileId]` hoặc `/api/files/download` **chỉ chấp nhận `fileId` (UUID) hoặc `storageKey` chính xác tuyệt đối**.
2. **Loại bỏ 100% các câu lệnh truy vấn dùng `{ contains: ... }`** trên đường dẫn tệp.
3. Việc kiểm tra quyền truy cập được thực hiện qua quan hệ chuẩn hóa:
   ```typescript
   // Kiểm tra quyền thông qua liên kết trực tiếp
   const file = await prisma.fileObject.findUnique({
     where: { id: fileId },
     include: {
       attachments: { include: { document: true } },
       deliverables: { include: { task: true } },
       dossierItems: { include: { dossier: true } },
     },
   });
   ```
   Nếu người dùng có quyền hợp lệ trên ít nhất một thực thể nghiệp vụ liên kết $\to$ Cấp quyền tải luồng tệp tin (`200 OK` hoặc `206 Partial Content`). Ngược lại $\to$ Trả về `403 Forbidden`.

---

## 3. Lộ trình Triển khai & Chuyển đổi (Migration Roadmap)

Quá trình chuyển đổi tuân thủ chiến lược an toàn Expand & Contract:

- **Giai đoạn 1 (Phase 7 - Expand)**:
  - Bổ sung model `FileObject` và các quan hệ vào `prisma/schema.prisma`.
  - Cập nhật service upload mới lưu song song cả `FileObject` và trường legacy `fileUrl`.
- **Giai đoạn 2 (Phase 8 - Backfill & Cutover)**:
  - Chạy script di trú nền quét toàn bộ các bảng `TaskDeliverable`, `DocumentAttachment`, tính toán SHA-256 và sinh bản ghi `FileObject`.
  - Cập nhật route `/api/files/[...path]` ưu tiên tra cứu qua `FileObject.storageKey`.
- **Giai đoạn 3 (Phase 9 - Contract)**:
  - Xóa bỏ các trường `fileUrl` legacy dạng chuỗi tự do, hoàn thiện mô hình quan hệ khóa ngoại toàn vẹn (`foreign key constraint`).

---

## 4. Hệ quả & Đánh giá (Consequences)

### Tích cực (Positive):
1. **Bảo mật tuyệt đối**: Triệt tiêu hoàn toàn lỗ hổng IDOR do so khớp mờ đường dẫn.
2. **Tiết kiệm tài nguyên**: Giảm 40–60% dung lượng đĩa cứng nhờ cơ chế Content-Addressed Deduplication bằng SHA-256.
3. **Toàn vẹn pháp lý**: Lưu trữ giá trị băm cryptographic phục vụ kiểm toán chữ ký số và đối soát hồ sơ lưu trữ theo Nghị định 30/2020/NĐ-CP.
4. **Sẵn sàng cho Cloud Storage**: Dễ dàng chuyển dịch từ đĩa cứng cục bộ sang AWS S3, MinIO, hoặc Cloudflare R2 thông qua trường `storageProvider`.

### Tiêu cực & Biện pháp giảm thiểu (Trade-offs & Mitigations):
- **Phụ phí tính toán (Hashing Overhead)**: Việc tính toán SHA-256 trên luồng dữ liệu tệp tiêu tốn thêm m���t lượng nhỏ CPU.
  - *Biện pháp*: Sử dụng stream pipeline native của Node.js `crypto` song song với quá trình ghi đĩa, độ trễ tăng thêm không quá 5ms cho tệp 10MB.
