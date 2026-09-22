# Báo Cáo Đánh Giá An Toàn Xác Thực Tệp Tin & Tham Chiếu Đối Tượng Trực Tiếp (IDOR)
## File Authorization & Direct Object Reference Assessment

- **Mã công việc**: WI-1.3 (Issue #36)
- **Hệ thống**: QCET E-Office Platform
- **Mục tiêu**: `src/app/api/files/[...path]/route.ts` và các chính sách phân quyền liên quan
- **Ngày đánh giá**: 22/09/2026
- **Trạng thái**: Hoàn thành đánh giá với các phát hiện rủi ro liên kết tài nguyên (Audit Completed with Identified Resource-Binding Risks)

---

## 1. Tổng Quan & Mục Tiêu Đánh Giá (Executive Summary)

Báo cáo này đánh giá mức độ an toàn kiến trúc và phân quyền kiểm soát truy cập đối với toàn bộ luồng phục vụ tệp tin tại endpoint `src/app/api/files/[...path]/route.ts` và endpoint phụ trợ `src/app/api/documents/download/route.ts`.

Hệ thống được đối chiếu trực tiếp với các tiêu chuẩn pháp lý Việt Nam và kiến trúc phân quyền trường học:
1. **Luật Bảo vệ bí mật nhà nước số 117/2025/QH15**: Tuyệt đối nghiêm cấm lưu trữ, truyền đưa, xử lý văn bản, tài liệu mang dấu mật (TUYỆT MẬT, TỐI MẬT, MẬT) trên mạng thông tin dân sự thông thường khi chưa có chính sách đặc thù được cấp thẩm quyền phê duyệt.
2. **Nghị định số 30/2020/NĐ-CP về công tác văn thư**: Quy định về quyền đăng ký, theo dõi, vào sổ văn bản, phân quyền theo đơn vị soạn thảo, chủ trì và phối hợp.
3. **Nghị định số 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân**: Kiểm soát nghiêm ngặt các tệp tin chứa dữ liệu cá nhân (PERSONAL_DATA), yêu cầu căn cứ pháp lý hoặc chấp thuận hợp lệ.
4. **Quyết định 283/QĐ-CĐKTCNQN & 420/QĐ-CĐKTCNQN**: Quy chế tổ chức hoạt động và phân quyền trách nhiệm giữa Ban Giám hiệu, Trưởng đơn vị và Chuyên viên.
5. **OWASP Top 10 (A01: Broken Access Control & IDOR, A04: Insecure Design)**: Kiểm soát truy cập và phát hiện các rủi ro tham chiếu đối tượng trực tiếp (IDOR) cũng như rò rỉ dữ liệu giữa các đơn vị (Cross-Unit Access).

---

## 2. Đánh Giá Phòng Thủ Vòng Ngoài (Perimeter Defense Assessment)

Endpoint `src/app/api/files/[...path]/route.ts` triển khai mô hình phòng thủ nhiều lớp (Defense-in-Depth) trước khi cho phép truy xuất dữ liệu từ đĩa cứng:

```
[HTTP Request]
       │
       ▼
[1. requireAuthenticated(context)] ────► (Chưa đăng nhập / Tài khoản bị khóa) ──► 401 Unauthorized
       │
       ▼
[2. assertRateLimit(userId, 'FILE_DOWNLOAD')] ────► (> 60 req/min) ──────────────► 429 Too Many Requests
       │
       ▼
[3. isAllowedFileExtension(fileName)] ────► (Phần mở rộng nguy hiểm / lạ) ──────► 403 Forbidden
       │
       ▼
[4. resolveSafeFilePath(relativePath)] ───► (Path Traversal: ../, %00, absolute) ─► 403 Forbidden
       │
       ▼
[5. Object-Level Policy Evaluation] ──────► (IDOR / Sai thẩm quyền đơn vị) ───────► 403 Forbidden
       │
       ▼
[6. Default Deny Check] ──────────────────► (Tệp mồ côi / Không có liên kết) ────► 404 Not Found
       │
       ▼
[7. Byte-Range File Streaming (200/206)]
```

### 2.1. Xác thực Danh tính (Authentication Enforcement)
- **Cơ chế**: Sử dụng `requireAuthenticated(context)` từ `@/server/api/request-context`.
- **Hành vi**:
  - Yêu cầu JWT session hợp lệ được ký bởi server (`signSessionToken`).
  - Kiểm tra trạng thái kích hoạt của người dùng: Nếu `ctx.session.user.isActive === false`, lập tức trả về lỗi `AuthenticationError` với mã `ACCOUNT_DISABLED` (HTTP 401).
  - Không cho phép bất kỳ truy cập nặc danh (anonymous) nào đến kho tệp nội bộ.
- **Đánh giá**: **Vững chắc (HIGH)**.

### 2.2. Kiểm soát Tần suất & Chống Từ chối Dịch vụ (DoS Defense)
- **Cơ chế**: `assertRateLimit(authUser.id, "FILE_DOWNLOAD")` từ `@/server/security/rate-limit`.
- **Thông số cấu hình**:
  - Hạn ngạch: 60 yêu cầu / 60 giây (bình quân 1 yêu cầu/giây cho một người dùng).
  - Khóa lưu trữ: `qcet:eoffice:ratelimit:FILE_DOWNLOAD:<userId>` trên Redis cluster (hoặc in-memory fallback).
  - Header phản hồi khi vượt ngưỡng: `Retry-After`, mã lỗi HTTP 429 `RateLimitError`.
- **Đánh giá**: **Vững chắc (HIGH)**. Ngăn ngừa các kịch bản script tự động vét cạn (scraping) kho tài liệu.

### 2.3. Phòng chống Tấn công Vượt Thư mục (Path Traversal Protection)
- **Hàm cốt lõi**: `resolveSafeFilePath(relativePath)` trong `src/lib/storage.ts`.
- **Các tầng lọc kiểm tra**:
  1. *Kiểm tra Null Byte*: Loại bỏ triệt để ký tự byte rỗng `\0` và URL-encoded `%00`.
  2. *Giải mã URL Component*: Gọi `decodeURIComponent(relativePath)` để phòng chống tấn công mã hóa 2 lần (Double URL-encoding, ví dụ: `%252e%252e`).
  3. *Chặn chuỗi thoát thư mục*: Bắt buộc cả chuỗi gốc và chuỗi sau giải mã không được chứa `..`.
  4. *Chặn đường dẫn tuyệt đối*: Bác bỏ nếu `path.isAbsolute()` trả về true hoặc bắt đầu bằng dấu `/`, `\\`, ký tự ổ đĩa `C:`.
  5. *Ràng buộc biên thư mục gốc*: Tính toán `safeResolvedPath = path.resolve(uploadsRoot, decoded)` và so khớp điều kiện:
     `safeResolvedPath === uploadsRoot || !safeResolvedPath.startsWith(uploadsRoot + path.sep)`
     Nếu vượt khỏi thư mục `UPLOADS_DIR`, lập tức ném ra `ForbiddenError("Path traversal detected: Access Denied")`.
- **Đánh giá**: **Rất vững chắc (EXCELLENT)**. Không phát hiện vector khai thác traversal nào có thể vượt qua tầng kiểm tra này.

### 2.4. Kiểm soát Định dạng & Chống Giả mạo MIME (Extension & MIME Spoofing)
- **Danh sách cho phép (Whitelist)**:
  - Chỉ chấp nhận chính xác **9 phần mở rộng** (theo `ALLOWED_FILE_EXTENSIONS` tại `src/lib/storage.ts`):
    1. `.pdf`
    2. `.png`
    3. `.jpg`
    4. `.jpeg`
    5. `.webp`
    6. `.docx`
    7. `.xlsx`
    8. `.txt`
    9. `.csv`
  - Nghiêm cấm các tệp thực thi và mã nguồn động: `.exe`, `.bat`, `.sh`, `.php`, `.jsp`, `.html`, `.js`, `.py`.
  - **Loại trừ `.svg`**: Tệp SVG có khả năng chứa mã JavaScript độc hại (Stored XSS qua XML/SVG DOM) bị loại khỏi danh sách cho phép tải xuống.
- **Tiêu đề an ninh HTTP (Security Response Headers)**:
  - `X-Content-Type-Options: nosniff`: Ngăn trình duyệt tự ý đoán định dạng nội dung (MIME sniffing).
  - `X-Frame-Options: DENY`: Ngăn chặn nhúng tệp trong `<iframe>` để phòng chống Clickjacking.
  - `Content-Disposition: inline; filename="..."`: Tên tệp được chuẩn hóa qua `sanitizeDownloadFilename` (loại bỏ ký tự điều khiển, dấu nháy kép, CRLF chống HTTP Header Injection).
- **Đánh giá**: **Vững chắc (HIGH)**.

### 2.5. Cơ chế Default Deny Đối với Tệp Mồ Côi (Orphan / Unregistered Files)
- **Nguyên tắc thiết kế (Invariant F07)**:
  - Tệp tồn tại vật lý trên ổ cứng nhưng không có bản ghi liên kết hợp lệ trong cơ sở dữ liệu (`!attachment && !deliverable && !dossierItem && !meeting`) sẽ bị từ chối với HTTP 404 `NotFoundError` và ghi log cảnh báo an ninh `security.file_access_denied`.
  - Ngăn ngừa rò rỉ các tệp đã xóa bản ghi nghiệp vụ nhưng ch��a dọn dẹp đĩa cứng, hoặc các tệp tạm của hệ thống.
- **Đánh giá**: **Vững chắc (HIGH)**.

---

## 3. Ma Trận Phân Quyền Theo Tài Nguyên & Đánh Giá Rủi Ro IDOR

Hệ thống quản lý 5 nhánh tài nguyên tệp tin. Dưới đây là phân tích chi tiết cơ chế phân quyền đối tượng trực tiếp:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          MA TRẬN PHÂN QUYỀN TÀI NGUYÊN TỆP                             │
├──────────────────────┬─────────────────────────────┬───────────────────────────────────┤
│ Loại Tài Nguyên       │ Chính Sách Kiểm Soát        │ Trạng Thái Đánh Giá IDOR & Binding │
├──────────────────────┼─────────────────────────────┼───────────────────────────────────┤
│ 1. TASK_DELIVERABLE  │ buildTaskReadWhere(authCtx) │ Cách ly theo phạm vi nhiệm vụ     │
│ 2. DOCUMENT_ATTACH.  │ canAccessClassification     │ Cách ly theo phân loại văn bản    │
│ 3. DOSSIER_ITEM      │ canReadDossier              │ RỦI RO BINDING CHƯA GIẢI QUYẾT   │
│ 4. MEETING_ATTACH.   │ canViewMeeting              │ RỦI RO BINDING CHƯA GIẢI QUYẾT   │
│ 5. AVATAR            │ Chưa ánh xạ trong route     │ Default Deny (404)                │
└──────────────────────┴─────────────────────────────┴───────────────────────────────────┘
```

### 3.1. Tài nguyên Minh chứng Nhiệm vụ (`TASK_DELIVERABLE`)
- **Mô hình dữ liệu**: Bảng `TaskDeliverable` liên kết với `Task`.
- **Cơ chế xác thực**:
  ```typescript
  const authCtx = await loadAuthorizationContext(authUser.id, new Date(), { useCache: true });
  const taskAuthWhere = buildTaskReadWhere(authCtx);
  const authorizedDeliverable = await prisma.taskDeliverable.findFirst({
    where: {
      id: deliverable.id,
      task: taskAuthWhere,
    },
  });
  ```
- **Nguyên tắc phân quyền**:
  - *Quản trị viên kỹ thuật (SYSTEM_ADMIN)*: Bị từ chối truy cập dữ liệu tác nghiệp của nhiệm vụ (`__DENY_SYSTEM_ADMIN_OPERATIONAL_TASKS__`), đảm bảo nguyên tắc phân lập quyền lực (Separation of Duties).
  - *Lãnh đạo trường (Hiệu trưởng, Phó Hiệu trưởng, BGH)*: Quyền giám sát toàn trường.
  - *Trưởng đơn vị / Chuyên viên*: Chỉ được truy cập nhiệm vụ mà bản thân là Assignee, Actor, hoặc nhiệm vụ thuộc về đơn vị công tác của mình (`task.departmentId === user.departmentId`).
- **Đánh giá IDOR / Cross-Unit Access**:
  - Chuyên viên thuộc Đơn vị A khi đoán URL minh chứng nhiệm vụ của Đơn vị B sẽ bị lọc bởi `taskAuthWhere`, truy vấn `findFirst` trả về `null` và hệ thống trả về `403 Forbidden`.
  - Phân quyền IDOR trên `TaskDeliverable` được bảo đảm nhờ cơ chế ràng buộc chính xác `where: { id: deliverable.id, task: taskAuthWhere }` và sử dụng `candidateUrls` đối soát đầy đủ.

### 3.2. Tài nguyên Tệp đính kèm Văn bản (`DOCUMENT_ATTACHMENT`)
- **Mô hình dữ liệu**: Bảng `DocumentAttachment` liên kết với `Document`.
- **Cơ chế xác thực**:
  ```typescript
  if (!attachment.document || !canReadDocument(authUser, attachment.document)) {
    throw new ForbiddenError("Bạn không có quyền truy cập tệp đính kèm của văn bản này");
  }
  ```
  Hàm `canReadDocument` ủy nhiệm hoàn toàn cho `canAccessClassification(user, doc)`.
- **Nguyên tắc phân loại văn bản**:
  1. *Văn bản chứa Bí mật Nhà nước (`MAT`, `TOI_MAT`, `TUYET_MAT`)*:
     - Tuân thủ Luật 117/2025/QH15: **MẶC ĐỊNH TỪ CHỐI (Default Deny)** trên hệ thống dân sự thông thường nếu không có cờ `hasApprovedStatutorySecretPolicy === true`.
  2. *Văn bản Giới hạn / Dữ liệu cá nhân (`RESTRICTED`, `PERSONAL_DATA`)*:
     - Tuân thủ Nghị định 13/2023/NĐ-CP: Bắt buộc phải có quan hệ trực tiếp (người tạo, người ký, người soạn thảo, đối tượng thụ hưởng) hoặc ủy quyền còn hiệu lực.
     - **Thành viên cùng đơn vị không đương nhiên được xem văn bản giới hạn.**
  3. *Văn bản Nội bộ (`INTERNAL`)*:
     - Cho phép người liên quan trực tiếp, thành viên đơn vị chủ trì/soạn thảo/xử lý/phối hợp (`extractDocumentUnitIds`), Văn thư trường, hoặc Ban Giám hiệu.
  4. *Văn bản Công khai (`PUBLIC`)*:
     - Cho phép mọi cán bộ, giảng viên trong trường truy cập.
- **Đánh giá IDOR / Cross-Unit Access**:
  - Chuyên viên Đơn vị A truy cập tệp đính kèm văn bản nội bộ của Đơn vị B sẽ bị từ chối do không có ID đơn vị A trong danh sách đơn vị liên quan (`extractDocumentUnitIds`).
  - Phân quyền đối tượng trên `DocumentAttachment` sử dụng `fileUrl: { in: candidateUrls }` để tìm đúng bản ghi cụ thể.

### 3.3. Tài nguyên Hồ sơ Công việc (`DOSSIER_ITEM`) & Rủi Ro Liên Kết Mờ (Unresolved Resource-Binding Risk)
- **Mô hình dữ liệu**: Bảng `DossierItem` liên kết với `WorkDossier`.
- **Cơ chế truy vấn hiện hành**:
  ```typescript
  const dossierItem = await prisma.dossierItem.findFirst({
    where: {
      OR: [
        { itemId: { in: candidateUrls } },
        { notes: { in: candidateUrls } },
        { itemId: { contains: normalizedRelative } }, // <--- NGUY CƠ VA CHẠM SO KHỚP MỜ
        { notes: { contains: normalizedRelative } },  // <--- NGUY CƠ VA CHẠM SO KHỚP MỜ
      ],
    },
    include: {
      dossier: { include: { items: true } },
    },
  });
  ```
- **Phân tích Rủi ro Liên kết Tài nguyên (Resource-Path Mismatch / Storage-Key Binding Collision)**:
  - **Cơ chế lỗi (Confused Deputy / Authorization Decoupling)**:
    1. Người dùng gửi yêu cầu HTTP đến đường dẫn cụ thể, ví dụ: `/api/files/dossier/sensitive-report.pdf`. Tệp thực tế sẽ được phân giải thành `safeResolvedPath = /uploads/dossier/sensitive-report.pdf`.
    2. Trong cơ sở dữ liệu, lệnh tìm kiếm `dossierItem` sử dụng toán tử `{ contains: normalizedRelative }` (với `normalizedRelative = "dossier/sensitive-report.pdf"` hoặc chuỗi con).
    3. Nếu có một bản ghi `DossierItem` khác (ví dụ thuộc Hồ sơ X công khai mà người dùng có quyền đọc) chứa chuỗi con này trong trường `itemId` hoặc `notes`, `prisma.findFirst` có thể khớp nhầm bản ghi của Hồ sơ X.
    4. Hàm `canReadDossier(authUser, dossierItem.dossier)` kiểm tra quyền đối với Hồ sơ X và trả về **cho phép truy cập** (`allowed: true`).
    5. Sau khi vượt qua kiểm tra, mã nguồn tại dòng 242 tiếp tục đọc và phát luồng tệp tin **`safeResolvedPath`** (vốn là tệp nhạy cảm trên đĩa thuộc một hồ sơ hạn chế khác)!
  - **Kết luận**: **Tồn tại rủi ro IDOR / Resource-Path Mismatch chưa được giải quyết**. Quyền truy cập được đánh giá trên một tài nguyên được chọn bởi so khớp mờ trong khi tệp tin thực tế được stream về cho người dùng lại là một tệp khác. Không thể coi IDOR đã được ngăn chặn triệt để ở nhánh này.

### 3.4. Tài nguyên Tài liệu Cuộc họp (`MEETING_ATTACHMENT`) & Rủi Ro So Khớp Mờ
- **Mô hình dữ liệu**: Bảng `Meeting` với thuộc tính `materialsUrl`.
- **Cơ chế truy vấn hiện hành**:
  ```typescript
  const meeting = await prisma.meeting.findFirst({
    where: {
      OR: [
        { materialsUrl: { in: candidateUrls } },
        { materialsUrl: { contains: normalizedRelative } }, // <--- NGUY CƠ VA CHẠM SO KHỚP MỜ
      ],
    },
    include: {
      participants: { include: { user: true } },
      body: { include: { memberships: true } },
    },
  });
  ```
- **Phân tích Rủi ro**:
  - Tương tự như `DossierItem`, việc sử dụng `{ materialsUrl: { contains: normalizedRelative } }` dẫn đến rủi ro va chạm khóa lưu trữ (Storage-Key Binding Collision).
  - Nếu `normalizedRelative` vô tình là chuỗi con của tài liệu một cuộc họp thông thường mà người dùng có tên tham gia (`participants`), truy vấn `findFirst` sẽ chọn cuộc họp thông thường đó. Hàm `canViewMeeting` trả về `true`, và endpoint sẽ stream tệp `safeResolvedPath` (có thể là tài liệu của cuộc họp kín Ban Giám hiệu nếu tên đường dẫn bị trùng chuỗi con).
  - **Kết luận**: Đây là rủi ro liên kết tài nguyên chưa được khắc phục, cần loại bỏ hoàn toàn cơ chế so khớp `contains`.

### 3.5. Tài nguyên Ảnh đại diện (`AVATAR`)
- **Hiện trạng thực tế**:
  - Trong `src/app/api/files/[...path]/route.ts`, **chưa có** nhánh kiểm tra bản ghi `User.avatarUrl`.
  - Nếu tệp ảnh đại diện nằm trong thư mục `uploads/` cục bộ, yêu cầu gửi tới `/api/files/...` sẽ bị nhánh Default Deny từ chối và trả về `404 Not Found`.
  - Hiện tại, hệ thống sử dụng URL ảnh đại diện từ nhà cung cấp danh tính bên ngoài (Google OAuth `profile.picture`) hoặc avatar ký tự khởi tạo trên giao diện client.
  - Khi triển khai tính năng tải lên ảnh đại diện cá nhân cục bộ trong tương lai, cần bổ sung rõ quy tắc phân quyền cho tài nguyên này.

---

## 4. Kịch Bản Kiểm Thử & Bằng Chứng Thực Nghiệm (Test Evidence)

Tiến hành rà soát và thực thi các bộ kiểm thử tự động liên quan đến tệp tin và an ninh phân quyền:

### 4.1. Bằng chứng thực nghiệm từ `tests/api-files-streaming.test.ts`
- **Tập kiểm thử**: 6/6 kịch bản vượt qua thành công (PASS):
  1. `should serve existing PDF with 200 OK and correct headers`: Xác thực trả về 200 OK, `Content-Type: application/pdf`, `Accept-Ranges: bytes`.
  2. `should support HTTP 206 Byte-Range streaming for PDF inspection`: Xác thực phân đoạn byte (Range: `bytes=0-9`), trả về HTTP 206 Partial Content chính xác.
  3. `should block path traversal attempts with 403 Forbidden`: Gửi payload `../etc/passwd`, hệ thống chặn đứng với mã lỗi 403. Log an ninh ghi nhận:
     ```json
     {"level":"warn","event":"security.file_access_denied","reason":"Disallowed file extension"}
     ```
  4. `should return 404 for non-existent files`: Gửi yêu cầu tệp không tồn tại, trả về 404 Not Found theo nguyên tắc Default Deny:
     ```json
     {"level":"warn","event":"security.file_access_denied","reason":"Unregistered or orphan file not associated with any authorized resource"}
     ```
  5. `should serve dossier item attachment for authorized user and return 403 for unauthorized user`:
     - Người có thẩm quyền (chủ sở hữu/quản trị): HTTP 200 OK.
     - Chuyên viên đơn vị khác: HTTP 403 Forbidden:
     ```json
     {"level":"warn","event":"security.file_access_denied","resourceType":"DossierItem","reason":"User lacks permission to read associated work dossier"}
     ```
  6. `should serve meeting materials for authorized participant/organizer and return 403 for unauthorized user`:
     - Người tổ chức cuộc họp: HTTP 200 OK.
     - Người không thuộc cuộc họp: HTTP 403 Forbidden:
     ```json
     {"level":"warn","event":"security.file_access_denied","resourceType":"Meeting","reason":"User lacks permission to view associated meeting"}
     ```

### 4.2. Bằng chứng thực nghiệm từ `tests/storage/file-storage-boundary.test.ts`
- **Tập kiểm thử**: 12/12 kịch bản ranh giới lưu trữ riêng tư vượt qua thành công (PASS):
  - Kiểm tra thư mục `public/`: Xác nhận không tồn tại `public/documents`, không có bất kỳ tệp nghiệp vụ nhạy cảm nào (`.doc`, `.docx`, `.pdf`, `.xls`) trong thư mục tĩnh công cộng.
  - Xác nhận tệp công tác tháng nằm an toàn trong vùng bảo mật `storage/private/documents/...`.
  - Xác thực xử lý vòng đời tệp tạm và cơ chế tự động dọn dẹp (TTL expiration).

---

## 5. Các Vấn Đề Phát Hiện & Phân Loại Rủi Ro (Identified Gaps)

| STT | Vấn Đề Phát Hiện | Mức Độ Rủi Ro | Phân Loại |
|:---:|:-----------------|:-------------:|:----------|
| G1 | Rủi ro liên kết tài nguyên (Resource-Path Mismatch / Binding Collision) do so khớp `contains` | **HIGH** | Lỗ hổng liên kết phân quyền (Authorization Decoupling) |
| G2 | Bất đối xứng ngữ cảnh phân quyền tệp đính kèm văn bản | **MEDIUM** | Hoạt động phân quyền (Fails closed) |
| G3 | Tồn tại song song hai endpoint tải tệp (`/api/files` và `/api/documents/download`) | **MEDIUM** | Phân mảnh kiến trúc |
| G4 | Chưa ánh xạ tài nguyên `AVATAR` trong `/api/files/[...path]` | **LOW** | Kiến trúc / Khả năng mở rộng |
| G5 | Thiếu kiểm tra Magic Number khi phát tệp (Chỉ kiểm tra phần mở rộng) | **LOW** | Phòng thủ chuyên sâu |

### Chi tiết các vấn đề:

#### Gap 1: Rủi ro liên kết tài nguyên do so khớp mờ `contains` trong DossierItem và Meeting (HIGH)
- **Mô tả**: Trong `src/app/api/files/[...path]/route.ts`, tệp vật lý được mở luồng (`openByteRangeStream`) dựa trên `safeResolvedPath` (tính từ tham số URL người dùng yêu cầu). Tuy nhiên, việc kiểm tra phân quyền đối tượng lại dựa trên thực thể tìm thấy qua `prisma.dossierItem.findFirst` và `prisma.meeting.findFirst` bằng toán tử `{ contains: normalizedRelative }`.
- **Hệ quả**:
  1. Nếu chuỗi `normalizedRelative` xuất hiện dưới dạng chuỗi con trong bất kỳ bản ghi tài liệu cuộc họp hoặc hồ sơ công việc nào mà kẻ tấn công có quyền xem, truy vấn `findFirst` có thể chọn thực thể đó.
  2. Hàm chính sách (`canReadDossier` hoặc `canViewMeeting`) đánh giá quyền trên thực thể được chọn và trả về `allowed: true`.
  3. Endpoint tiếp tục thực thi và truyền toàn bộ dữ liệu của tệp nhạy cảm `safeResolvedPath` (vốn không thuộc thực thể được cấp quyền) tới kẻ tấn công.
  Đây là **rủi ro liên kết tài nguyên chưa được khắc phục (Unresolved Resource-Binding Risk)**.

#### Gap 2: Bất đối xứng ngữ cảnh phân quyền tệp đính kèm văn bản (`DocumentAttachment`) (MEDIUM)
- **Mô tả**: Tại dòng 119 (`TaskDeliverable`), route gọi `loadAuthorizationContext(authUser.id)` để nạp đầy đủ danh sách chức vụ kiêm nhiệm (`positions`) và giấy ủy quyền đang hoạt động (`delegations`). Ngược lại, tại dòng 94 (`DocumentAttachment`), route truyền trực tiếp đối tượng `authUser` vào `canReadDocument(authUser, attachment.document)`.
- **Tác động**: Trong `canAccessClassification`, việc chỉ nhận `authUser` khiến hàm chuyển đổi chỉ gán đơn vị chính (`primaryUnitIds: [user.departmentId]`) và không nạp các chức vụ phụ hoặc ủy quyền hợp lệ từ cơ sở dữ liệu. Mặc dù điều này không gây rò rỉ dữ liệu (Fails closed / an toàn), nhưng người được ủy quyền hợp lệ hoặc kiêm nhiệm tại đơn vị khác có thể bị từ chối xem tệp đính kèm của văn bản mà họ có quyền xem.

#### Gap 3: Tồn tại song song hai endpoint tải tệp bị phân mảnh (MEDIUM)
- **Mô tả**: Hệ thống hiện có cả `src/app/api/files/[...path]/route.ts` (RESTful path, hỗ trợ byte-range, 4 loại tài nguyên) và `src/app/api/documents/download/route.ts` (Query params `?file=` hoặc `?attachmentId=`, chỉ hỗ trợ 2 loại tài nguyên là văn bản và nhiệm vụ).
- **Tác động**: Người dùng gọi `/api/documents/download` với tài liệu cuộc họp hoặc hồ sơ công việc sẽ luôn nhận mã lỗi 404 vì route này chưa được cập nhật chính sách cho Dossier và Meeting. Cần thống nhất về một endpoint duy nhất.

#### Gap 4: Chưa ánh xạ tài nguyên `AVATAR` trong `/api/files/[...path]` (LOW)
- **Mô tả**: Endpoint `/api/files/[...path]` kiểm tra 4 nguồn: `DocumentAttachment`, `TaskDeliverable`, `DossierItem`, `Meeting`. Trường hợp người dùng tải ảnh đại diện lên máy chủ nội bộ (`User.avatarUrl`), tệp sẽ bị Default Deny chặn (HTTP 404).
- **Tác động**: Hiện tại chưa có tác động tiêu cực vì ứng dụng đang sử dụng avatar qua Google OAuth URL. Tuy nhiên, nếu bổ sung tính năng tải avatar nội bộ, hệ thống sẽ gặp lỗi không hiển thị được tệp.

#### Gap 5: Thiếu kiểm tra Magic Number ở tầng phát luồng tệp tin (LOW)
- **Mô tả**: Tại `src/storage/private-files.ts`, hàm `detectMimeType` có kiểm tra magic bytes của buffer tệp. Tuy nhiên trong `src/app/api/files/[...path]/route.ts`, loại MIME chỉ được suy ra từ phần mở rộng tệp (`path.extname`).
- **Tác động**: Dù đã có tiêu đề `X-Content-Type-Options: nosniff` và whitelist phần mở rộng ngăn chặn thực thi mã độc, việc kiểm tra magic bytes lúc tải tệp lên (upload time) là bắt buộc để ngăn chặn giả mạo phần mở rộng ngay từ đầu.

---

## 6. Đề Xuất Các Đầu Việc Thực Thi Tiếp Theo (Proposed Follow-up Issues)

Nhằm khắc phục triệt để các rủi ro phát hiện trong đợt đánh giá, khuyến nghị mở các issue triển khai tiếp theo:

1. **Issue WI-1.3.1 (SECURITY-CRITICAL)**: *fix(security): enforce exact canonical storage-key binding and add collision regression tests*
   - **Mục tiêu**: Khắc phục triệt để rủi ro liên kết tài nguyên (Resource-Path Mismatch) và va chạm khóa lưu trữ trong `src/app/api/files/[...path]/route.ts`.
   - **Hành động cụ thể**:
     1. Loại bỏ hoàn toàn toán tử so khớp mờ chuỗi con `{ contains: normalizedRelative }` trong cả truy vấn `DossierItem` và `Meeting`.
     2. Bắt buộc so khớp chính xác tuyệt đối (Strict Exact Match) theo khóa định danh lưu trữ chuẩn hóa (`canonicalStorageKey` hoặc danh sách URL chuẩn hóa `candidateUrls`).
     3. Xây dựng bộ kiểm thử hồi quy va chạm (Collision Regression Test Suite):
        - Mô phỏng 2 hồ sơ/cuộc họp: Thực thể A (Công khai, chứa `item-a.pdf`) và Thực thể B (Hạn chế, chứa `sub/item-a.pdf` hoặc tên tệp có chuỗi con trùng lặp).
        - Kiểm chứng người dùng chỉ có quyền đọc Thực thể A khi gửi request tới tệp của Thực thể B phải bị từ chối dứt khoát với 403 Forbidden hoặc 404 Not Found, không bao giờ được stream nội dung tệp của Thực thể B.

2. **Issue WI-1.3.2**: *refactor(storage): unify file download endpoints and deprecate legacy download route*
   - Chuyển hướng toàn bộ các liên kết tải tệp sang `/api/files/[...path]`.
   - Đánh dấu `@deprecated` và loại bỏ `src/app/api/documents/download/route.ts` sau khi di chuyển các client gọi cũ.

3. **Issue WI-1.3.3**: *fix(security): hydrate full AuthorizationContext for DocumentAttachment authorization*
   - Đồng bộ việc gọi `loadAuthorizationContext(authUser.id)` trước khi kiểm tra `canReadDocument` tại `/api/files/[...path]`, đảm bảo tính nhất quán giữa kiểm tra nhiệm vụ và kiểm tra văn bản đối với người dùng có ủy quyền/kiêm nhiệm.

4. **Issue WI-1.3.4**: *feat(security): register explicit AVATAR resource authorization policy*
   - Xây dựng quy chế truy cập cho ảnh đại diện người dùng: Cho phép mọi người dùng đã xác thực trong trường được xem avatar của cán bộ khác (`PUBLIC_WITHIN_INSTITUTION`), ngăn chặn truy cập nặc danh trái phép hoặc rò rỉ ra ngoài.
