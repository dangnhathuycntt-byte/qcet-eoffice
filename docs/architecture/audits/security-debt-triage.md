# Báo Cáo Phân Loại & Đánh Giá Nợ Kiểm Thử Bảo Mật (Security Baseline Test Debt Triage)

**Mã công việc:** WI-1.7 (Issue #40)  
**Ngày thực hiện:** 22/09/2026 (Cập nhật sau phản hồi PR #46)  
**Phạm vi:** Toàn bộ test suite bảo mật thuộc hệ thống QCET E-Office (`tests/security/*`, các bài test RBAC, SoD, Authorization, Rate Limit, Session, Data Classification).  
**Nguyên tắc thực hiện:** Strictly Triage Only — Không chỉnh sửa mã nguồn sản phẩm (`src/`) trong đợt phân loại này.

---

## 1. Tổng Quan Thực Thi (Executive Summary)

Đợt phân loại và đánh giá nợ kiểm thử bảo mật (Security Debt Triage) được thực hiện nhằm rà soát toàn bộ các bài kiểm thử liên quan đến an ninh, phân quyền (RBAC/ReBAC), phân lập nhiệm vụ (SoD), kiểm soát phiên làm việc và bảo vệ luồng dữ liệu.

### 1.1. Thống Kê Tổng Hợp

| Chỉ số | Số lượng | Ghi chú |
| :--- | :--- | :--- |
| **Tổng số file test quét** | **66** | 62 file theo pattern `security` + 4 file kiểm thử hợp đồng bảo mật bổ sung |
| **Số file test PASSED** | **59** | 89.4% số file đạt chuẩn an ninh |
| **Số file test FAILED** | **7** | 10.6% số file có trường hợp kiểm thử thất bại |
| **Tổng số subtest trong các file lỗi** | **82** | 69 passed, 13 failed |
| **File kiểm thử bị thiếu (Gap)** | **1** | `tests/security/api/mutation-protection.test.ts` (được nhắc đến trong yêu cầu nhưng chưa tồn tại) |
| **Số lỗi Critical (SoD bypass / Privilege escalation)** | **0** | Hệ thống tuân thủ nghiêm ngặt nguyên tắc **Fail-Closed** (từ chối khi nghi ngờ) |
| **Số lỗi High (Lỗi logic phân quyền thực tế trong code - Category A)** | **2** | Lỗi ReBAC `document.read` và DTO collaborator stripping |
| **Số lỗi Medium (Lệch dữ liệu seed / Khoảng trống test - Category C)** | **2** | Thiếu PositionAssignment tường minh cho BGH trong seed/fixture, thiếu test mutation-protection |
| **Số lỗi Low (Nợ kiểm thử / Kỳ vọng cũ / Fixture giòn gãy - Category B)** | **5** | Kỳ vọng cũ SoD bypass theo delegation, kỳ vọng cũ System Admin xem task, mã lỗi cũ, regex cứng |

---

## 2. Bảng Tổng Hợp Thực Thi Kiểm Thử (Test Execution Summary Table)

Dưới đây là danh sách chi tiết 7 file kiểm thử có lỗi cần phân loại:

| STT | File Kiểm Thử | Tổng Test | Pass | Fail | Trạng Thái | Nhóm Nguyên Nhân | Mức Độ |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | `tests/api-rbac-and-sod.test.ts` | 7 | 4 | 3 | FAILED | Category B (2), Category C (1) | Medium / Low |
| 2 | `tests/file-streaming-security.test.ts` | 12 | 10 | 2 | FAILED | Category B (Fixture thiếu DB attachment) | Low |
| 3 | `tests/security/document-classification.test.ts` | 19 | 18 | 1 | FAILED | Category A (Thiếu ReBAC direct relation cho `document.read`) | **High** |
| 4 | `tests/security/master-cutover-gate0.test.ts` | 15 | 14 | 1 | FAILED | Category B (Kỳ vọng cũ System Admin xem task nghiệp vụ) | Low |
| 5 | `tests/security/session-revocation.test.ts` | 10 | 9 | 1 | FAILED | Category A (DTO loại bỏ Collaborator, làm mất `roleInTask`) | **High** |
| 6 | `tests/security/task-canonical-cutover.test.ts` | 5 | 3 | 2 | FAILED | Category B (Regex/string matching kiểm tra code cứng) | Low |
| 7 | `tests/security/task-read-v2-parity.test.ts` | 14 | 11 | 3 | FAILED | Category B (Kỳ vọng cũ System Admin query unconstrained `{}`) | Low |

---

## 3. Danh Mục Chi Tiết Các Trường Hợp Thất Bại (Detailed Failure Inventory)

### 3.1. `tests/api-rbac-and-sod.test.ts`

- **Vị trí 1:** Dòng 149 — `PATCH /api/tasks/[id] rejects direct status mutation (CANONICAL_COMMAND_REQUIRED)`
  - **Lỗi:** `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: 'VALIDATION_ERROR' !== 'CANONICAL_COMMAND_REQUIRED'`
  - **Hiện tượng:** Route `PATCH /api/tasks/[id]` sử dụng `UpdateTaskMetadataSchema.strict()`. Payload `{ status: "completed" }` bị Zod schema reject ngay tại tầng validation với mã `VALIDATION_ERROR` (HTTP 400), trong khi test kỳ vọng mã lỗi nghiệp vụ chuyên biệt `CANONICAL_COMMAND_REQUIRED`.
  - **Phân loại:** **Category B (Outdated Test Expectation)** | Mức độ: **Low** (Input boundary validation hoạt động an toàn, chỉ khác mã lỗi chi tiết).

- **Vị trí 2:** Dòng 196 — `taskCommandService allows assignee to complete task when possessing valid dacumDelegation`
  - **Lỗi:** `AuthorizationError: Người thực hiện chính (DRI) hoặc người tạo minh chứng không thể tự phê duyệt nghiệm thu nhiệm vụ (Vi phạm Maker-Checker / Segregation of Duties).`
  - **Hiện tượng & Đánh giá theo ADR-001 ACCEPTED:** Bài test giả định rằng khi có giấy ủy quyền (`dacumDelegation`), người thực hiện chính (Maker / Assignee) có thể tự phê duyệt hoàn thành nhiệm vụ của chính mình. Tuy nhiên, theo **ADR-001 ACCEPTED**, nguyên tắc phân lập nhiệm vụ (Segregation of Duties - SoD / Maker-Checker) là bất biến: **Người thực hiện/tạo sản phẩm tuyệt đối không được tự nghiệm thu/phê duyệt sản phẩm của chính mình, kể cả khi có ủy quyền**.
  - **Kết luận:** Mã nguồn sản phẩm chặn chuyển trạng thái `MAKER_CANNOT_BE_CHECKER` là **hoàn toàn chính xác theo thiết kế an ninh**. Kỳ vọng của bài test về việc dùng ủy quyền để vượt qua SoD là **nợ kiểm thử lỗi thời (Outdated Test Debt)**, không phải lỗi mã nguồn sản phẩm. Tuyệt đối không khôi phục cơ chế delegation bypass SoD.
  - **Phân loại:** **Category B (Outdated Test Expectation)** | Mức độ: **Low**.

- **Vị trí 3:** Dòng 220 — `taskCommandService allows BGH to complete SCHOOL task`
  - **Lỗi:** `AuthorizationError: Người dùng không có thẩm quyền thực hiện hành động này.` (tại `requireTaskAuthorization` dòng 138)
  - **Hiện tượng:** `requireTaskAuthorization` nạp context từ `loadAuthorizationContext(userId)`. Trong cơ sở dữ liệu mẫu/seed, tài khoản BGH có `role: "BAN_GIAM_HIEU"` nhưng chưa có bản ghi bổ nhiệm chức vụ trong bảng `PositionAssignment` (`positions: []`). Hệ thống ReBAC từ chối vì thiếu chức vụ lãnh đạo theo chuẩn F15/Phase 1.
  - **Nguyên tắc phân định chức vụ (Separation of Powers / Position Model):** Vai trò kế thừa `BAN_GIAM_HIEU` (legacy role) **tuyệt đối không được tự động suy diễn (blanket-mapping) thành một chức danh thể chế cụ thể** như `HIEU_TRUONG`. Theo mô hình vị trí việc làm (Position Model) và nguyên tắc phân quyền, mỗi thành viên Ban Giám hiệu nắm giữ một chức danh độc lập với thẩm quyền khác nhau (ví dụ: `HIEU_TRUONG` có thẩm quyền toàn diện cấp trường; `PHO_HIEU_TRUONG` phụ trách theo lĩnh vực đào tạo/hành chính). Do đó, test fixture và seed data phải khởi tạo rõ ràng bản ghi bổ nhiệm chức vụ cụ thể (`PositionAssignment`) cho từng chủ thể tác nhân (`HIEU_TRUONG`, `PHO_HIEU_TRUONG`, v.v.), thay vì giả định ngầm hay tự động ánh xạ hàng loạt từ trường `role`.
  - **Phân loại:** **Category C (Seed & Fixture Drift)** | Mức độ: **Medium**.

---

### 3.2. `tests/file-streaming-security.test.ts`

- **Vị trí 1:** Dòng 127 — `should serve requested file with download disposition`
  - **Lỗi:** `AssertionError [ERR_ASSERTION]: 404 !== 200`
- **Vị trí 2:** Dòng 166 — `should support byte-range requests for download route`
  - **Lỗi:** `AssertionError [ERR_ASSERTION]: 404 !== 206`
- **Hiện tượng:** Tuyến `/api/documents/download` đã được bổ sung cơ chế phòng thủ Default Deny (F07): tệp trên ổ đĩa vật lý phải liên kết với một bản ghi `DocumentAttachment` hoặc `TaskDeliverable` trong cơ sở dữ liệu thì mới cho phép tải. Test tạo file mẫu trực tiếp trong thư mục sandbox nhưng không insert bản ghi đính kèm vào database, do đó bị chặn bởi cơ chế chống rò rỉ file mồ côi (Orphan File Protection).
- **Phân loại:** **Category B (Outdated Test Fixture)** | Mức độ: **Low** (Bảo mật sản phẩm tốt hơn kỳ vọng của bài test cũ; fixture test bị nợ kỹ thuật).

---

### 3.3. `tests/security/document-classification.test.ts`

- **Vị trí:** Dòng 654 — `GET /api/documents/[id] allows authorized lead actor to access RESTRICTED document`
  - **Lỗi:** `AssertionError [ERR_ASSERTION]: 403 !== 200`
  - **Hiện tượng:** Tại `src/app/api/documents/[id]/route.ts` (dòng 63), route kiểm tra cả `readDecision.allowed` (từ `authorize(authContext, 'document.read', docResource)`) và `canReadDocument(authUser, document)`. 
    - `canReadDocument` trả về `true` vì User A là `leadUserId` của văn bản giới hạn.
    - Tuy nhiên, trong `src/server/authorization/authorization-engine.ts`, Bước 4 (Direct Relationship) hoàn toàn **không có nhánh xử lý cho hành động `document.read`** (chỉ có `meeting.read`, `task.read`, `document.outgoing.draft`, `document.sign`). Bước 5 (Position Capability) chỉ cấp `document.read` cho `VAN_THU` (Văn thư) và `HIEU_TRUONG` (Hiệu trưởng). Do đó, cán bộ chuyên viên (`CHUYEN_VIEN`) dù là người chủ trì (`leadUserId`) hay người tạo văn bản đều bị `DEFAULT_DENY` (403).
  - **Phân loại:** **Category A (Real Security / Authorization Bug)** | Mức độ: **High** (Lỗi logic ReBAC gây khóa nhầm quyền đọc văn bản của cán bộ xử lý chính).

---

### 3.4. `tests/security/master-cutover-gate0.test.ts`

- **Vị trí:** Dòng 355 — `admin user queryTasks is not restricted by department boundaries`
  - **Lỗi:** `AssertionError [ERR_ASSERTION]: 'Admin should see Task A' (expected: true, actual: false)`
  - **Hiện tượng:** Bài test giả định Quản trị hệ thống (`ADMIN`) có quyền xem tất cả các nhiệm vụ tác nghiệp của các phòng ban. Tuy nhiên, theo quyết định kiến trúc chuẩn hóa (ADR Phân quyền & commit `cf7a6dc2`), tài khoản kỹ thuật `SYSTEM_ADMIN` bị từ chối truy cập nhiệm vụ tác nghiệp phòng ban theo mặc định (`{ id: '__DENY_SYSTEM_ADMIN_OPERATIONAL_TASKS__' }`) để đảm bảo nguyên tắc phân quyền và bảo mật dữ liệu chuyên môn; chỉ lãnh đạo trường (`HIEU_TRUONG`) mới có phạm vi trường học toàn diện (`{}`). Bài test chưa cập nhật theo chính sách mới.
  - **Phân loại:** **Category B (Outdated Test Expectation)** | Mức độ: **Low** (Kỳ vọng kiểm thử lỗi thời so với quyết định kiến trúc đã phê duyệt).

---

### 3.5. `tests/security/session-revocation.test.ts`

- **Vị trí:** Dòng 240 — `when admin disables user (User.isActive=false), same token is immediately rejected with 401 ACCOUNT_DISABLED`
  - **Lỗi:** `AssertionError [ERR_ASSERTION]: 403 !== 200` (thất bại ngay ở bước kiểm tra ban đầu khi tài khoản còn active).
  - **Hiện tượng:** `dynamicUser` được giao nhiệm vụ với vai trò `roleInTask: "COLLABORATOR"`. Khi gọi `GET /api/tasks/[id]`, route gọi `taskQueryService.getTaskById`, hàm này chuyển đổi qua `toTaskDetailDTO` / `toTaskListDTO`. Trong `src/server/dto/task-dto.ts`, hàm `extractDerivedCollaborators` chỉ quét nhiệm vụ con (`subTasks`) mà bỏ quên danh sách `assignees` phối hợp trực tiếp trên nhiệm vụ cha. Đồng thời DTO chuyển đổi `assignees` thành `UserSummaryDTO` làm mất thuộc tính `roleInTask`. Khi `buildTaskResource` dựng tài nguyên ReBAC từ DTO, `collaboratorIds` bị rỗng và `dynamicUser` bị từ chối truy cập (403) ngay cả khi tài khoản đang hoạt động hợp lệ.
  - **Phân loại:** **Category A (Real Security / Authorization Bug)** | Mức độ: **High** (DTO mapper làm rò rỉ/mất mát metadata phân quyền khiến ReBAC từ chối sai cán bộ phối hợp).

---

### 3.6. `tests/security/task-canonical-cutover.test.ts`

- **Vị trí 1:** Dòng 8 — `generic PATCH uses the strict metadata-only contract`
  - **Lỗi:** `AssertionError: The input did not match the regular expression /parseAndValidateJson\(req, UpdateTaskMetadataSchema\)/`
  - **Nguyên nhân:** Mã nguồn sản phẩm đã được bổ sung tham số an toàn chống cạn kiệt bộ nhớ: `parseAndValidateJson(req, UpdateTaskMetadataSchema, { maxBytes: MAX_TASK_CONTENT_BYTES })`. Regex của test quá cứng nhắc, không bao quát tham số thứ ba.
- **Vị trí 2:** Dòng 34 — `shared action transport enforces every mutation guard`
  - **Lỗi:** `AssertionError: missing shared guard: loadAuthorizationContext(user.id)`
  - **Nguyên nhân:** Mã nguồn `shared.ts` được tối ưu hóa hiệu năng cache phân quyền: `loadAuthorizationContext(user.id, new Date(), { useCache: true, ttlMs: 10_000 })`. Test sử dụng `string.includes("loadAuthorizationContext(user.id)")` nên bị false positive.
- **Phân loại:** **Category B (Brittle String-Matching Test Debt)** | Mức độ: **Low** (Mã nguồn thực tế an toàn và tối ưu hơn; kiểm thử dạng string matching giòn gãy).

---

### 3.7. `tests/security/task-read-v2-parity.test.ts`

- **Vị trí 1:** Dòng 285 — `AuthenticatedUser System Admin returns unconstrained filter {}`
- **Vị trí 2:** Dòng 305 — `AuthorizationContext System Admin returns unconstrained filter {}`
- **Vị trí 3:** Dòng 551 — `System Admin context: sees all tasks`
  - **Lỗi chung:** `AssertionError: { id: '__DENY_SYSTEM_ADMIN_OPERATIONAL_TASKS__' } deepStrictEqual {}` và `'System Admin must see unit A task' (expected: true, actual: false)`
  - **Nguyên nhân:** Tương tự mục 3.4, bài test này kiểm tra tính tương đồng (parity) nhưng vẫn dựa trên quy tắc cũ coi `ADMIN` là "Superuser thấy toàn bộ task". Trong khi chính sách chuẩn hóa hiện hành đã áp dụng `{ id: '__DENY_SYSTEM_ADMIN_OPERATIONAL_TASKS__' }`.
  - **Phân loại:** **Category B (Outdated Test Expectation)** | Mức độ: **Low** (Cần cập nhật test assertion theo chính sách bảo mật đã duyệt).

---

## 4. Phân Loại Nguyên Nhân Gốc Rễ (Root Cause Classification)

### Nhóm A: Lỗi Logic Phân Quyền / Bảo Mật Thực Tế Trong Code (Category A - Real Bug: 2 lỗi)
1. **Thiếu ReBAC direct relation cho `document.read` (`src/server/authorization/authorization-engine.ts`):**
   - *Nguyên nhân:* Bước 4 của engine bỏ quên kiểm tra quan hệ trực tiếp (chủ trì `leadUserId`, người tạo `creatorId`, người nhận `recipientList`, người soạn thảo `drafterId`) cho hành động `document.read`. Bước 5 chỉ cấp quyền cho `VAN_THU` và `HIEU_TRUONG`. Dẫn đến cán bộ nghiệp vụ không đọc được chính văn bản mình đang thụ lý.
2. **DTO Mapper xóa bỏ quan hệ cộng tác viên (`src/server/dto/task-dto.ts`):**
   - *Nguyên nhân:* `extractDerivedCollaborators` chỉ quét từ subtask mà bỏ qua `assignees` có `roleInTask: "COLLABORATOR"` trên task cha, đồng thời làm mất `roleInTask` khi chuyển sang `UserSummaryDTO`. Khiến `buildTaskResource` không trích xuất được `collaboratorIds`, gây từ chối truy cập (403) sai đối với cán bộ phối hợp.

### Nhóm B: Kỳ Vọng Kiểm Thử Cũ / Lệch Mock Data / Fixture Giòn Gãy (Category B - Outdated Expectations: 5 lỗi)
1. **Kỳ vọng ủy quyền vượt qua SoD (`tests/api-rbac-and-sod.test.ts:196`):**
   - Test kỳ vọng Maker có giấy ủy quyền thì được tự phê duyệt nhiệm vụ của mình. Điều này vi phạm nguyên tắc SoD bất biến đã được phê duyệt trong **ADR-001 ACCEPTED**. Code sản phẩm chặn là đúng; test là nợ kỹ thuật cần cập nhật để kiểm thử hành vi từ chối (expect rejection).
2. **Chính sách phân quyền System Admin đối với nhiệm vụ tác nghiệp (`tests/security/task-read-v2-parity.test.ts`, `tests/security/master-cutover-gate0.test.ts`):**
   - Giữ giả định cũ rằng kỹ thuật viên hệ thống được xem mọi việc nội bộ phòng ban. Cần cập nhật theo chính sách `{ id: '__DENY_SYSTEM_ADMIN_OPERATIONAL_TASKS__' }`.
3. **Phòng thủ Default Deny cho tệp mồ côi (`tests/file-streaming-security.test.ts`):**
   - Tuyến tải tệp áp dụng chính sách F07 chặn file không có bản ghi đính kèm trong database. Test fixture thiếu bản ghi `DocumentAttachment`.
4. **Mã lỗi validation thay vì command error (`tests/api-rbac-and-sod.test.ts:149`):**
   - Route dùng schema `.strict()` nên trả về `VALIDATION_ERROR` thay vì mã lỗi cũ `CANONICAL_COMMAND_REQUIRED`.
5. **Kiểm tra tĩnh dạng String-Matching giòn gãy (`tests/security/task-canonical-cutover.test.ts`):**
   - Test gãy do mã nguồn sản phẩm bổ sung các tham số bảo vệ `{ maxBytes }` và cache `{ useCache }`.

### Nhóm C: Lệch Dữ Liệu Seed / Cơ Sở Dữ Liệu (Category C - Schema & Seed Drift: 2 lỗi)
1. **Thiếu bản ghi bổ nhiệm chức vụ cụ thể (`PositionAssignment`) cho tài khoản Lãnh đạo trong Seed Data & Test Fixture:**
   - Vai trò kế thừa `BAN_GIAM_HIEU` (legacy role) không được đồng nhất hay tự động ánh xạ hàng loạt sang `HIEU_TRUONG`. Theo nguyên tắc phân định quyền lực và mô hình vị trí việc làm (Separation of Powers / Position Model), hệ thống ReBAC yêu cầu bản ghi bổ nhiệm chức vụ thực tế và cụ thể (`HIEU_TRUONG`, `PHO_HIEU_TRUONG`, v.v.) trong bảng `PositionAssignment`. Cả dữ liệu mẫu (seed) và kịch bản test fixture trong `tests/api-rbac-and-sod.test.ts:220` cần gán tường minh chức danh cụ thể cho từng actor kiểm thử, tránh hoàn toàn việc blanket-mapping vai trò BGH sang Hiệu trưởng.
2. **Thiếu file kiểm thử `tests/security/api/mutation-protection.test.ts`:**
   - Nợ kiểm thử: file được quy hoạch trong checklist an ninh nhưng chưa được khởi tạo trong kho mã nguồn.

### Nhóm D: Môi Trường Thực Thi & Đồng Thời (Category D - Environment & Flakiness: 0 lỗi)
- Không phát hiện lỗi flakiness sau khi cấu hình môi trường test runner chuẩn xác.

---

## 5. Xếp Hạng Mức Độ Nghiêm Trọng (Severity Ranking)

```
[CRITICAL] (0 lỗi) 
  - Không phát hiện lỗ hổng bypass SoD hay leo thang đặc quyền (Privilege Escalation).
  - Hệ thống duy trì trạng thái Fail-Closed an toàn.

[HIGH] (2 lỗi - Category A)
  - ReBAC Document: Thiếu quy tắc direct relation cho document.read trong authorization-engine.ts.
  - ReBAC Task: DTO Mapper làm mất danh sách Collaborator trực tiếp trên Task trong task-dto.ts.

[MEDIUM] (2 lỗi - Category C)
  - Database Seed & Fixture: Thiếu PositionAssignment tường minh (HIEU_TRUONG, PHO_HIEU_TRUONG) cho lãnh đạo trong seed và test fixture (tuyệt đối không blanket-map BGH sang HIEU_TRUONG).
  - Test Suite Gap: Chưa khởi tạo file kiểm thử tests/security/api/mutation-protection.test.ts.

[LOW] (5 lỗi - Category B)
  - Cập nhật test api-rbac-and-sod.test.ts:196 để assert từ chối Maker tự duyệt theo ADR-001.
  - Cập nhật kỳ vọng test task-read-v2-parity & master-cutover-gate0 cho SYSTEM_ADMIN.
  - Cập nhật kỳ vọng mã lỗi VALIDATION_ERROR trong api-rbac-and-sod.test.ts:149.
  - Cập nhật fixture file-streaming-security (tạo DocumentAttachment hợp lệ).
  - Cập nhật regex kiểm tra tĩnh trong task-canonical-cutover.
```

---

## 6. Kế Hoạch Khắc Phục: Đề Xuất Các Issue Triển Khai Mới (Proposed Follow-up Issues)

Nhằm tuân thủ nguyên tắc phân định phạm vi (không gán việc sửa mã nguồn sản phẩm vào các work item kiểm toán như WI-1.6 hay work item chuyên biệt như WI-1.1), các khiếm khuyết được chuyển hóa thành **các đề xuất Issue triển khai mới** với phạm vi độc lập:

| Đề Xuất Issue Mới | Loại Nhiệm Vụ | Mục Tiêu & Phạm Vi Chi Tiết | File Liên Quan | Mức Độ |
| :--- | :--- | :--- | :--- | :---: |
| **Issue [NEW]: fix(auth): implement ReBAC direct relationship for document.read** | Production Fix | Bổ sung Bước 4 (Direct Relationship) cho `document.read` trong `authorization-engine.ts`, cho phép `leadUserId`, `drafterId`, `registeredById`, `recipientUserId` đọc văn bản hợp lệ theo F15. | `src/server/authorization/authorization-engine.ts` | **High** |
| **Issue [NEW]: fix(tasks): retain task-level collaborators and roleInTask in TaskDetailDTO** | Production Fix | Điều chỉnh `extractDerivedCollaborators` và `toTaskListDTO` trong `task-dto.ts` để giữ nguyên danh sách `assignees` có vai trò `COLLABORATOR` và thuộc tính `roleInTask`, đảm bảo ReBAC nhận diện đủ quyền. | `src/server/dto/task-dto.ts` | **High** |
| **Issue [NEW]: fix(seed): explicitly assign statutory positions in seed and test fixtures** | Database Seed & Fixture | Cập nhật `prisma/seed.ts` và test fixtures để gán tường minh chức vụ thực tế (`HIEU_TRUONG`, `PHO_HIEU_TRUONG`, v.v.) cho từng thành viên BGH theo mô hình Position Model, tuyệt đối không blanket-map vai trò BAN_GIAM_HIEU sang Hiệu trưởng. | `prisma/seed.ts`, `tests/api-rbac-and-sod.test.ts` | **Medium** |
| **Issue [NEW]: test(security): author mutation-protection test suite for API boundaries** | Test Suite | Khởi tạo file `tests/security/api/mutation-protection.test.ts` kiểm thử toàn diện các rào chắn CSRF, Content-Type, Request Body Size limit, Rate Limit và BOLA trên các endpoint đột biến. | `tests/security/api/mutation-protection.test.ts` | **Medium** |
| **Issue [NEW]: test(security): align outdated security test assertions with ADR-001 and canonical policies** | Test Debt Align | Cập nhật các bài test nợ kỹ thuật: (1) `api-rbac-and-sod`: assert từ chối Maker tự duyệt theo ADR-001 và chấp nhận `VALIDATION_ERROR`; (2) `task-read-v2-parity` & `master-cutover-gate0`: khớp với `{ id: '__DENY_SYSTEM_ADMIN_OPERATIONAL_TASKS__' }`; (3) `file-streaming-security`: tạo DB attachment; (4) `task-canonical-cutover`: nới lỏng regex. | `tests/api-rbac-and-sod.test.ts`, `tests/file-streaming-security.test.ts`, `tests/security/*.test.ts` | **Low** |

---
*Báo cáo được cập nhật và phê chuẩn theo kiến trúc ADR-001 và chính sách an ninh QCET E-Office.*
