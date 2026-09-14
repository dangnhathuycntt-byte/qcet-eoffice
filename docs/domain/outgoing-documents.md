# CANONICAL DOMAIN WORKFLOW: VĂN BẢN ĐI (OUTGOING DOCUMENTS)
## HỆ THỐNG ĐIỀU HÀNH & TÁC NGHIỆP ĐIỆN TỬ Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn  (QCET E-OFFICE)

**Tình trạng tài liệu:** Đặc tả chuẩn tắc nghiệp vụ miền (Canonical Domain Specification)  
**Căn cứ pháp lý cốt lõi:**
- Nghị định số 30/2020/NĐ-CP ngày 05/03/2020 của Chính phủ về công tác văn thư (Điều 14 - Điều 19; Phụ lục I & Phụ lục IV).
- Luật Giao dịch điện tử số 20/2023/QH15 ngày 22/06/2023 của Quốc hội (Điều 12, Điều 22, Điều 23).
- Nghị định số 68/2024/NĐ-CP ngày 25/06/2024 của Chính phủ quy định về chữ ký số chuyên dùng công vụ.
- Quyết định số 283/QĐ-CĐKTCNQN ngày 19/08/2026 của Hiệu trưởng QCET ban hành Quy chế làm việc.
- Quyết định số 420/QĐ-CĐKTCNQN ngày 03/12/2025 của Hiệu trưởng QCET về phân công nhiệm vụ Ban Giám hiệu.
- Quyết định số 93/QĐ-CĐKTCNQN & Kế hoạch số 227/KH-CĐKTCNQN về công tác văn thư, lưu trữ cơ quan.

---

## 1. NGUYÊN TẮC VẬN HÀNH BẮT BUỘC (CORE INVARIANTS)

1. **Nguyên tắc Tách bạch Bốn Hành vi Pháp lý (Four Distinct Legal Acts Invariant)**:
   Hệ thống phân định rạch ròi, độc lập và tuyệt đối không gộp 04 hành vi pháp lý sau trong quy trình văn bản đi:
   - (1) *Phê duyệt nội dung bản thảo* (`CONTENT_REVIEW`) != 
   - (2) *Thẩm tra thể thức, kỹ thuật trình bày* (`FORMAT_RECORDS_REVIEW`) != 
   - (3) *Ký số của người có thẩm quyền* (`AUTHORIZED_SIGN`) != 
   - (4) *Cấp số và Đóng dấu số cơ quan* (`NUMBERED` & `ORGANIZATION_DIGITAL_SIGN`).

2. **Vai trò Gác cổng Thể thức của Văn thư (Clerical Functional Gatekeeper Invariant)**:
   Bộ phận Văn thư thuộc Phòng Hành chính - Quản trị là người gác cổng thể thức, kỹ thuật trình bày (Phụ lục I NĐ 30/2020/NĐ-CP), thẩm quyền ký, danh sách nơi nhận và tính đầy đủ của hồ sơ trình ký. **Văn thư KHÔNG PHẢI là người phê duyệt nội dung chuyên môn**, không được can thiệp sửa đổi các điều khoản hoặc nội dung nghiệp vụ do đơn vị soạn thảo chịu trách nhiệm.

3. **Nguyên tắc Ký số Chuyên dùng Công vụ (Official Digital Signature Invariant)**:
   Tuân thủ Luật Giao dịch điện tử 2023 và Nghị định 68/2024/NĐ-CP:
   - Chữ ký của Lãnh đạo có thẩm quyền bắt buộc sử dụng Chứng thư số cá nhân chuyên dùng công vụ do Ban Cơ yếu Chính phủ (VGCA) cấp.
   - Chữ ký số của cơ quan (Con dấu điện tử của Trường) do Bộ phận Văn thư quản lý và áp ký sau khi văn bản đã được Lãnh đạo ký số và đã được cấp Số đi chính thức.

4. **Nguyên tắc Cấp số Đi Bất biến (Continuous Outgoing Numbering Invariant)**:
   Số văn bản đi được lấy tự động từ hệ thống đếm số nguyên tử (`DocumentNumberSequence`), liên tục từ số 01 ngày 01/01 đến hết ngày 31/12 của năm ban hành cho từng thể loại hoặc nhóm thể loại văn bản. Tuyệt đối cấm cấp số khống, lùi số, trùng số hoặc giữ số trước khi văn bản được ký duyệt chính thức.

5. **Nguyên tắc Bất biến Toàn vẹn & Chống Chối bỏ (Non-Repudiation Invariant)**:
   Văn bản điện tử sau khi đã áp con dấu điện tử cơ quan là bất biến (`immutable`). Mọi sự thay đổi nội dung sau khi đóng dấu đều làm mất tính hợp lệ của chữ ký số. Hệ thống lưu trữ `SignatureRecord` chứa toàn bộ chứng chỉ X.509, mã băm SHA-256 và dấu thời gian TSA (RFC 3161).

---

## 2. VÒNG ĐỜI VĂN BẢN ĐI (CANONICAL LIFECYCLE STATE MACHINE)

Quy trình văn bản đi bao gồm 10 trạng thái chuẩn tắc trải qua 4 cổng kiểm soát (Gates):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CỔNG 1: ĐƠN VỊ SOẠN THẢO (DRAFTING UNIT)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
  DRAFT ──────────────┐ (Chuyên viên soạn thảo, đính kèm căn cứ)
    │                 │
    ▼                 │ (Trưởng đơn vị trả về yêu cầu sửa nội dung)
  CONTENT_REVIEW ◄────┘
    │
    ▼ (Trưởng đơn vị phê duyệt nội dung chuyên môn)
┌─────────────────────────────────────────────────────────────────────────────┐
│ CỔNG 2: VĂN THƯ CƠ QUAN THẨM TRA (CLERICAL GATEKEEPER)                       │
└─────────────────────────────────────────────────────────────────────────────┘
  FORMAT_RECORDS_REVIEW ────┐ (Văn thư từ chối thể thức / thiếu hồ sơ)
    │                       │
    │ ──────────────────────┴────────► [TRẢ VỀ ĐƠN VỊ SỬA THỂ THỨC / BỔ SUNG]
    │
    ▼ (Thể thức chuẩn Phụ lục I NĐ 30, đủ hồ sơ trình)
┌─────────────────────────────────────────────────────────────────────────────┐
│ CỔNG 3: BAN GIÁM HIỆU PHÊ DUYỆT & KÝ SỐ (EXECUTIVE SIGNATURE)               │
└─────────────────────────────────────────────────────────────────────────────┘
  AUTHORIZED_SIGN ──────────┐ (Lãnh đạo từ chối ký, yêu cầu giải trình thêm)
    │                       ▼
    │                 [REJECTED_BY_LEADER]
    ▼ (Ký số cá nhân VGCA hợp lệ, đính kèm TSA)
┌─────────────────────────────────────────────────────────────────────────────┐
│ CỔNG 4: VĂN THƯ CẤP SỐ, ĐÓNG DẤU CƠ QUAN & PHÁT HÀNH (ISSUANCE & DISPATCH) │
└─────────────────────────────────────────────────────────────────────────────┘
  NUMBERED (Cấp số đi liên tục từ DocumentNumberSequence)
    │
    ▼
  ORGANIZATION_DIGITAL_SIGN (Áp chữ ký số cơ quan / Dấu đỏ QCET)
    │
    ▼
  ISSUED (Chính thức có hiệu lực pháp lý)
    │
    ▼
  DELIVERED (Gửi qua Trục liên thông VDXP/LGSP, email công vụ hoặc bưu chính)
    │
    ▼
  FILED (Đơn vị soạn thảo đưa vào Hồ sơ công việc điện tử)
    │
    ▼
  ARCHIVED (Nộp lưu trữ lịch sử cơ quan theo QĐ 93)
```

### Chi tiết 10 Trạng thái Vòng đời

| Mã trạng thái | Tên trạng thái | Diễn giải nghiệp vụ | Tác nhân chính | Trạng thái Prisma DocumentStatus |
|---|---|---|---|---|
| `DRAFT` | Bản thảo khởi tạo | Chuyên viên đơn vị soạn thảo văn bản, đính kèm phiếu trình, dự thảo tệp PDF/Docx và các tài liệu tham chiếu. | Chuyên viên (`CHUYEN_VIEN`) | `DANG_XU_LY` |
| `CONTENT_REVIEW` | Duyệt nội dung bản thảo | Trưởng đơn vị kiểm tra sự cần thiết, cơ sở pháp lý, tính chính xác của số liệu và nội dung chuyên môn. | Trưởng đơn vị (`TRUONG_PHONG`) | `CHO_PHE_DUYET` |
| `FORMAT_RECORDS_REVIEW` | Thẩm tra thể thức & hồ sơ | Văn thư kiểm tra thể thức, kỹ thuật trình bày (Phụ lục I NĐ 30), thẩm quyền ký, danh sách nơi nhận. | Văn thư (`VAN_THU`) | `CHO_PHE_DUYET` |
| `AUTHORIZED_SIGN` | Lãnh đạo ký số | Hiệu trưởng / Phó Hiệu trưởng sử dụng chữ ký số cá nhân chuyên dùng công vụ ký xác nhận ban hành. | Ban Giám hiệu (`BAN_GIAM_HIEU`) | `CHO_PHE_DUYET` |
| `NUMBERED` | Đã cấp số văn bản đi | Sau khi có chữ ký lãnh đạo, Văn thư ấn định Số và ký hiệu văn bản đi chính thức vào Sổ đi của năm. | Văn thư (`VAN_THU`) | `CHO_PHE_DUYET` |
| `ORGANIZATION_DIGITAL_SIGN` | Đóng dấu số cơ quan | Văn thư dùng chứng thư số tổ chức (Con dấu điện tử QCET) ký trùm lên 1/3 chữ ký lãnh đạo về bên trái. | Văn thư (`VAN_THU`) | `DA_HOAN_THANH` |
| `ISSUED` | Đã ban hành chính thức | Văn bản hoàn tất thể thức pháp lý, sẵn sàng phân phối đến các đơn vị, cá nhân hoặc cơ quan ngoài trường. | Văn thư (`VAN_THU`) | `DA_HOAN_THANH` |
| `DELIVERED` | Đã gửi / Đã chuyển phát | Văn bản được gửi thành công qua Trục VDXP, LGSP, thông báo nội bộ E-Office hoặc chuyển giao bưu tá. | Văn thư (`VAN_THU`) | `DA_HOAN_THANH` |
| `FILED` | Đã lập hồ sơ công việc | Chuyên viên soạn thảo thu thập toàn bộ các bản thảo, phiếu trình, ý kiến thẩm định và bản lưu vào Hồ sơ. | Chuyên viên (`CHUYEN_VIEN`) | `LUU_THEO_DOI` |
| `ARCHIVED` | Đã nộp lưu trữ cơ quan | Hồ sơ văn bản đi được bàn giao cho Bộ phận Lưu trữ cơ quan để bảo quản theo quy định tại Quyết định 93. | Lưu trữ viên (`VAN_THU`) | `LUU_THEO_DOI` |

---

## 3. TÁCH BẠCH BỐN RANH GIỚI PHÁP LÝ ĐỘC LẬP

Để bảo đảm tính tuân thủ pháp lý cao nhất và tránh xung đột thẩm quyền, hệ thống thiết kế các ranh giới kiểm soát tuyệt đối:

### 3.1. Phê duyệt Nội dung Bản thảo (`CONTENT_REVIEW`)
- **Tác nhân:** Trưởng phòng, Trưởng khoa hoặc Giám đốc trung tâm nơi chủ trì soạn thảo.
- **Bản chất:** Trách nhiệm quản lý chuyên môn nghiệp vụ. Xác nhận rằng đề xuất, báo cáo hoặc quyết định phù hợp với thực tiễn, số liệu chính xác và đúng chức năng nhiệm vụ của đơn vị.
- **Hình thức thể hiện:** Ký nháy (Ký duyệt chuyên môn - Initial Signature) tại trang cuối của phần nội dung hoặc góc phải dưới cùng của trang cuối cùng bản thảo.
- **Ranh giới:** Phê duyệt này **chỉ có giá trị nội bộ** trong luồng chuẩn bị, không xác lập giá trị pháp lý ra bên ngoài Nhà trường.

### 3.2. Thẩm tra Thể thức, Kỹ thuật Trình bày & Hồ sơ (`FORMAT_RECORDS_REVIEW`)
- **Tác nhân:** Bộ phận Văn thư (Phòng Hành chính - Quản trị).
- **Bản chất:** Gác cổng hành chính nhà nước theo Điều 14, 16 và Phụ lục I Nghị định số 30/2020/NĐ-CP.
- **Nội dung kiểm tra bắt buộc:**
  1. *Thẩm quyền ký*: Văn bản đề xuất ai ký (Hiệu trưởng hay Phó Hiệu trưởng? Nếu Phó Hiệu trưởng ký thay (KT.) thì có đúng lĩnh vực phân công tại Quyết định 420/QĐ-CĐKTCNQN không).
  2. *Hình thức & Thể thức*: Quốc hiệu, Tiêu ngữ, Tên cơ quan ban hành, Địa danh và ngày tháng, Tên loại và trích yếu nội dung, Cỡ chữ, Kiểu chữ (Times New Roman), Căn lề trang (trên, dưới 20-25mm; trái 30-35mm; phải 15-20mm).
  3. *Nơi nhận*: Đầy đủ các cơ quan nhận để báo cáo, phối hợp, thực hiện và lưu văn thư.
  4. *Hồ sơ trình ký*: Phải có đầy đủ Phiếu trình, tệp dự thảo, ý kiến góp ý của các đơn vị liên quan (nếu có).
- **Ranh giới:** Nếu không đạt thể thức hoặc thiếu căn cứ pháp lý, Văn thư **có quyền từ chối tiếp nhận** và yêu cầu đơn vị chỉnh sửa. Tuy nhiên, Văn thư **tuyệt đối không được tự ý sửa nội dung chuyên môn** của văn bản.

### 3.3. Ký số của Người có Thẩm quyền (`AUTHORIZED_SIGN`)
- **Tác nhân:** Hiệu trưởng hoặc Phó Hiệu trưởng được giao quyền/ủy quyền ký thay.
- **Bản chất:** Hành vi pháp lý xác lập ý chí của người đứng đầu hoặc đại diện cơ quan đối với nội dung văn bản (Điều 12 Luật Giao dịch điện tử 2023).
- **Hình thức thể hiện theo Phụ lục I NĐ 30:**
  - Hình ảnh chữ ký tươi của cá nhân, màu xanh, định dạng PNG nền trong suốt.
  - Vị trí: Đặt chính giữa chức danh người ký và họ tên người ký.
  - Được bảo chứng bằng Chứng thư số cá nhân do Ban Cơ yếu Chính phủ (VGCA) cấp.
- **Ranh giới:** Tại thời điểm Lãnh đạo ký, văn bản **chưa có Số và Ngày ban hành chính thức**, vì số và ngày chỉ được ấn định khi Văn thư vào sổ và đóng dấu cơ quan.

### 3.4. Cấp số & Đóng dấu số Cơ quan (`NUMBERED` & `ORGANIZATION_DIGITAL_SIGN`)
- **Tác nhân:** Bộ phận Văn thư (được Hiệu trưởng giao quyền giữ và sử dụng con dấu điện tử).
- **Bản chất:** Xác thực văn bản chính thức thuộc thẩm quyền ban hành của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn , có giá trị giao dịch pháp lý công vụ (Điều 15, Điều 18 NĐ 30/2020/NĐ-CP và NĐ 68/2024/NĐ-CP).
- **Thứ tự thực hiện bắt buộc:**
  1. *Kiểm tra tính toàn vẹn của chữ ký Lãnh đạo*: Xác nhận chữ ký số của BGH còn nguyên vẹn, chứng thư số còn hạn.
  2. *Cấp Số đi*: Nhận số tự động từ hệ thống tăng dần cho năm công tác (ví dụ: 156/QĐ-CĐKTCNQN hoặc 89/CĐKTCNQN-HCQT).
  3. *Điền Ngày ban hành*: Ngày hệ thống ấn định đóng dấu chính thức.
  4. *Áp Chữ ký số Cơ quan (Con dấu điện tử)*:
     - Hình ảnh con dấu màu đỏ của Nhà trường, định dạng PNG nền trong suốt.
     - Vị trí: Trùm lên 1/3 hình ảnh ch��� ký của người có thẩm quyền về phía bên trái.
     - Metadata gắn kèm: Tên cơ quan, thời gian ký (lấy từ máy chủ TSA).

---

## 4. KHUNG DỮ LIỆU CHỮ KÝ SỐ (SIGNATURERECORD SCHEMA) & XÁC MINH KIỂM TOÁN

Để đáp ứng đầy đủ yêu cầu của Luật Giao dịch điện tử 2023 và NĐ 68/2024/NĐ-CP, hệ thống duy trì mô hình dữ liệu `SignatureRecord` theo chuẩn mật mã học:

### 4.1. Đặc tả Cấu trúc Dữ liệu `SignatureRecord`

```typescript
// src/types/signature.ts
export type SignatureRole = 
  | 'INITIAL_REVIEW'       // Ký nháy duyệt chuyên môn của Trưởng đơn vị
  | 'FORMAT_CONFIRM'       // Ký xác nhận thể thức của Văn thư
  | 'AUTHORIZED_LEADER'    // Ký số cá nhân của Hiệu trưởng / Phó Hiệu trưởng
  | 'ORGANIZATION_SEAL';   // Ký số tổ chức (Con dấu điện tử QCET)

export type CertificateProvider = 'VGCA' | 'VNPT_CA' | 'VIETTEL_CA' | 'INTERNAL_DEV';

export type SignatureVerificationStatus = 
  | 'VALID'                // Chữ ký hợp lệ, toàn vẹn, chứng thư số tin cậy
  | 'INVALID_SIGNATURE'    // Chữ ký bị lỗi cấu trúc hoặc sai giải thuật
  | 'DOCUMENT_MODIFIED'    // Tài liệu bị sửa đổi sau khi ký (Hash mismatch)
  | 'CERTIFICATE_EXPIRED'  // Chứng thư số đã hết hạn tại thời điểm ký
  | 'CERTIFICATE_REVOKED'  // Chứng thư số đã bị thu hồi qua CRL/OCSP
  | 'UNTRUSTED_ROOT';      // CA gốc không nằm trong danh mục tin cậy quốc gia

export interface VisualPlacement {
  pageNumber: number;      // Trang ký (1, 2... hoặc trang cuối cùng: -1)
  llx: number;             // Lower Left X (toạ độ điểm bắt đầu)
  lly: number;             // Lower Left Y
  urx: number;             // Upper Right X (toạ độ điểm kết thúc)
  ury: number;             // Upper Right Y
  imagePngBase64?: string; // Dữ liệu ảnh chữ ký/con dấu nền trong suốt
}

export interface SignatureRecordItem {
  id: string;
  documentId: string;
  role: SignatureRole;
  signerId: string;
  signerFullName: string;
  signerPosition: string;

  // Metadata Chứng thư số X.509
  certificateSubject: string;       // CN=Nguyễn Văn A, O=QCET, C=VN
  certificateIssuer: string;        // CN=Ban Co yeu Chinh phu, O=VGCA, C=VN
  certificateSerial: string;        // Hex string số seri chứng thư
  certificateValidFrom: string;     // ISO 8601 UTC Date
  certificateValidTo: string;       // ISO 8601 UTC Date
  certificateProvider: CertificateProvider;

  // Dữ liệu Mật mã học & Dấu thời gian
  signingTime: string;              // Thời điểm ký chứng thực từ máy chủ TSA
  tsaServerUrl?: string;            // Máy chủ Time-Stamping Authority (RFC 3161)
  signedDocumentHash: string;       // Mã băm SHA-256 của tệp PDF ngay trước khi ký
  pkcs7Signature: string;           // Chuỗi chữ ký số PAdES-BES / CMS (Base64)
  
  // Trực quan hóa
  placement: VisualPlacement;

  // Vết kiểm toán môi trường ký
  clientIp: string;
  userAgent: string;
  verificationStatus: SignatureVerificationStatus;
  createdAt: string;
}
```

### 4.2. Khung Bảng Prisma Schema Đề xuất

```prisma
model SignatureRecord {
  id                     String                    @id @default(cuid())
  documentId             String                    @map("document_id")
  role                   String                    @db.VarChar(50) // AUTHORIZED_LEADER, ORGANIZATION_SEAL...
  signerId               String                    @map("signer_id")
  signerFullName         String                    @map("signer_full_name") @db.VarChar(150)
  signerPosition         String                    @map("signer_position") @db.VarChar(100)

  // X.509 Certificate Details
  certificateSubject     String                    @map("certificate_subject") @db.Text
  certificateIssuer      String                    @map("certificate_issuer") @db.VarChar(255)
  certificateSerial      String                    @map("certificate_serial") @db.VarChar(100)
  certificateValidFrom   DateTime                  @map("certificate_valid_from")
  certificateValidTo     DateTime                  @map("certificate_valid_to")
  certificateProvider    String                    @map("certificate_provider") @db.VarChar(50)

  // Cryptographic Proofs & TSA
  signingTime            DateTime                  @map("signing_time")
  tsaServerUrl           String?                   @map("tsa_server_url") @db.VarChar(255)
  signedDocumentHash     String                    @map("signed_document_hash") @db.VarChar(64)
  pkcs7Signature         String                    @map("pkcs7_signature") @db.Text

  // Visual Layout on PDF
  pageNumber             Int                       @map("page_number")
  coordsJson             String                    @map("coords_json") @db.Text

  // Audit Context
  clientIp               String                    @map("client_ip") @db.VarChar(45)
  userAgent              String                    @map("user_agent") @db.Text
  verificationStatus     String                    @default("VALID") @map("verification_status") @db.VarChar(30)

  document               Document                  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  signer                 User                      @relation(fields: [signerId], references: [id], onDelete: Restrict)
  createdAt              DateTime                  @default(now()) @map("created_at")

  @@index([documentId, role])
  @@index([certificateSerial])
  @@map("signature_records")
}
```

### 4.3. Quy trình Xác thực Tính Toàn vẹn (Signature Verification Pipeline)

Mỗi khi người dùng hoặc cơ quan nhận mở xem văn bản điện tử, hệ thống tự động kích hoạt tiến trình xác thực 5 bước:
1. **Kiểm tra Chuỗi Chứng chỉ (Certificate Chain Validation)**: Kiểm tra chứng thư số của người ký có được cấp bởi Root CA hợp chuẩn (Ban Cơ yếu Chính phủ hoặc Root CA quốc gia của Bộ TT&TT) hay không.
2. **Kiểm tra Danh sách Thu hồi (Revocation Check via CRL/OCSP)**: Truy vấn trực tuyến máy chủ OCSP của Ban Cơ yếu để đảm bảo chứng chỉ chưa bị thu hồi hoặc đình chỉ tại thời điểm ký.
3. **Kiểm tra Dấu thời gian Chuẩn xác (RFC 3161 Timestamp Verification)**: So sánh dấu thời gian TSA với thời hạn hiệu lực của chứng thư số tại thời điểm ký (Signing Time < ValidTo && Signing Time > ValidFrom).
4. **Kiểm tra Tính Toàn vẹn của Tệp (Document Integrity Check)**: Tính toán mã băm SHA-256 hiện tại của nội dung PDF (đã loại trừ phần metadata chữ ký) và so sánh với `signedDocumentHash` lưu trong `SignatureRecord`. Nếu sai khác, hệ thống lập tức hiển thị cảnh báo đỏ `DOCUMENT_MODIFIED` (Văn bản đã bị sửa đổi trái phép).
5. **Chứng nhận Chống chối bỏ (Non-repudiation Attestation)**: Nếu tất cả 4 bước đều thỏa mãn, hệ thống đóng dấu tích xanh xác thực tính pháp lý và cho phép trích xuất Phiếu chứng nhận chữ ký số.

---

## 5. SỔ ĐĂNG KÝ VĂN BẢN ĐI ĐIỆN TỬ (PHỤ LỤC IV NGHỊ ĐỊNH 30/2020/NĐ-CP)

Theo Phụ lục IV ban hành kèm theo Nghị định số 30/2020/NĐ-CP, Sổ đăng ký văn bản đi của Nhà trường bắt buộc phải có đầy đủ 10 cột chuẩn tắc:

| Cột số | Tên trường hiển thị | Kiểu dữ liệu | Mô tả chuẩn tắc Nghị định 30 | Ánh xạ Prisma Schema |
|:---:|---|---|---|---|
| **1** | Số và ký hiệu văn bản | String (100) | Số thứ tự tăng dần kèm ký hiệu loại văn bản và cơ quan (vd: 156/QĐ-CĐKTCNQN). | `Document.registrationNumber` & Số ký hiệu ghép |
| **2** | Ngày tháng năm ban hành | Date | Ngày, tháng, năm văn bản chính thức được đóng dấu phát hành. | `Document.issuedDate` |
| **3** | Tên loại & Trích yếu nội dung | Text | Tên loại văn bản và tóm tắt nội dung chính của văn bản đi. | `Document.category` & `Document.summary` |
| **4** | Người ký văn bản | String (150) | Chức vụ và họ tên của người có thẩm quyền ký ban hành. | `Document.signerTitle` & `Document.signerName` |
| **5** | Nơi nhận văn bản | Text | Danh sách các cơ quan, đơn vị, cá nhân nhận văn bản. | `Document.recipientList` |
| **6** | Đơn vị soạn thảo | String (50) | Tên Phòng, Khoa hoặc Trung tâm chủ trì dự thảo văn bản. | `Document.draftingDeptId` |
| **7** | Người nhận bản lưu | Text | Bộ phận Văn thư và cá nhân/đơn vị lưu bản gốc. | Lưu trong `Document.notes` |
| **8** | Số lượng bản phát hành | Integer | Số lượng bản giấy in phát hành (nếu có phát hành văn bản giấy song song). | `Document.distributedCopies` |
| **9** | Ngày chuyển văn bản | Date | Ngày Văn thư thực hiện gửi văn bản qua mạng hoặc chuyển bưu chính. | `Document.registeredDate` (hoặc Dispatch Time) |
| **10** | Ghi chú | Text | Ký hiệu hồ sơ lưu, độ khẩn, mã liên thông VDXP hoặc ghi chú nghiệp vụ. | `Document.notes` |

---

## 6. PHÂN PHỐI, PHÁT HÀNH VÀ CHUYỂN GIAO VĂN BẢN ĐI (`ISSUED` -> `DELIVERED`)

### 6.1. Các Kênh Phát hành Chuẩn tắc
1. **Trục Liên thông Văn bản Quốc gia (VDXP / LGSP )**: Tự động đóng gói gói tin chuẩn EdXML 2.0 (kèm tệp PDF đã ký 2 chữ ký số: Lãnh đạo và Con dấu QCET) gửi sang Hệ thống Quản lý Văn bản của UBND Tỉnh , Tổng cục Giáo dục Nghề nghiệp, Sở LĐ-TB&XH.
2. **Kênh Nội bộ Nhà trường (QCET E-Office Internal Feed)**: Ngay khi phát hành, văn bản tự động xuất hiện trên bàn làm việc của các Khoa, Phòng có tên trong danh sách "Nơi nhận: Như trên" hoặc gửi toàn thể cán bộ giảng viên nếu là văn bản phổ biến chung.
3. **Thư điện tử công vụ (`@cdktcnqn.edu.vn`)**: Gửi tệp văn bản chính thức có ký số đến email của các đơn vị đối tác, doanh nghiệp liên kết đào tạo.
4. **Bưu chính công ích**: Đối với các đơn vị chưa kết nối trục điện tử, Văn thư in văn bản ra giấy từ tệp điện tử, đóng dấu ướt (con dấu tươi) của Nhà trường và làm thủ tục chuyển phát qua Bưu điện theo quy định tại Điều 19 NĐ 30.

### 6.2. Kiểm soát Trạng thái Chuyển phát (`DeliveryStatus`)
Hệ thống theo dõi phản hồi trạng thái từ các kênh gửi:
- `SENT`: Gói tin đã rời khỏi máy chủ QCET E-Office.
- `DELIVERED`: Hệ thống đích (VDXP hoặc E-Office đơn vị) đã xác nhận nhận thành công.
- `ACKNOWLEDGED`: Cơ quan nhận đã vào Sổ văn bản đến của họ và gửi mã Số đến phản hồi.
- `BOUNCED / FAILED`: Lỗi đường truyền, hệ thống tự động cảnh báo để Văn thư xử lý theo Quy trình Chuyển đổi Bưu chính Công ích (Finding 5):
  * **Căn cứ pháp lý**: Điều 19 Nghị định số 30/2020/NĐ-CP (Xử lý khi phát hành qua môi trường mạng không thành công).
  * **Thủ tục chuyển đổi**:
    1. Văn thư in văn bản ra giấy từ b��n điện tử có chữ ký số hợp chuẩn.
    2. Đóng dấu ướt (con dấu vật lý của Nhà trường) và dấu chỉ dẫn phát hành theo quy định.
    3. Làm thủ tục chuyển phát qua dịch vụ bưu chính công ích (Bưu điện Việt Nam VNPost).
    4. Cập nhật vào hệ thống: Nhập **Mã vận đơn bưu chính (Postal Tracking / Waybill Code)**, ngày chuyển phát thực tế vào Cột số 9 và Cột số 10 (Ghi chú) của Sổ đăng ký văn bản đi điện tử để khép kín kiểm toán và giám sát trạng thái phát hành.

---

## 7. ĐÓNG GÓI HỒ SƠ VÀ NỘP LƯU TRỮ LỊCH SỬ (`FILED` -> `ARCHIVED`)

1. **Lập Hồ sơ Văn bản đi của Đơn vị Soạn thảo (`FILED`)**:
   - Cán bộ soạn thảo có trách nhiệm tập hợp toàn bộ tài liệu hình thành văn bản:
     - Tờ trình xin chủ trương ban hành văn bản.
     - Các bản thảo xin ý kiến (Draft v1, v2...).
     - Bản tổng hợp giải trình tiếp thu ý kiến đóng góp của các Khoa/Phòng.
     - Bản gốc văn bản đi đã được ký số và đóng dấu số hoàn chỉnh.
   - Nhập Mã hồ sơ công việc điện tử theo Danh mục hồ sơ cơ quan quy định tại Quyết định 93/QĐ-CĐKTCNQN.

2. **Nộp Lưu trữ Cơ quan (`ARCHIVED`)**:
   - Định kỳ hàng năm, cán bộ soạn thảo thực hiện thủ tục nộp lưu hồ sơ văn bản đi điện tử về Bộ phận Lưu trữ (Phòng HC-QT).
   - Lưu trữ viên kiểm tra tính đầy đủ, kiểm tra hiệu lực chữ ký số và xác nhận lưu trữ vĩnh viễn hoặc có thời hạn theo quy định.
