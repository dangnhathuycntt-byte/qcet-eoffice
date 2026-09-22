# Báo cáo Kiểm toán Thẩm quyền & An ninh Tác vụ Văn bản và Hồ sơ (Document & Dossier Action Authorization Audit)

> **Mã công việc**: Issue #39 (WI-1.6)  
> **Phạm vi kiểm toán**: 
> - **17 Action Route Files hiện hữu**: 14 Routes tác vụ Văn bản (`src/app/api/documents/[id]/actions/*`) + 3 Routes tác vụ Hồ sơ (`src/app/api/dossiers/[id]/actions/*`)
> - **3 Hành vi nghiệp vụ bị gộp / thiếu endpoint chuyên biệt**: `assign-person`, `start`, `archive` (đang bị gộp vào `assign-unit` và `file`)
> - **2 Bypass Routes liên quan**: `src/app/api/documents/[id]/directives/route.ts` (POST) và `src/app/api/documents/outgoing/route.ts` (GET)
>
> **Căn cứ pháp lý & kiến trúc**:
> - Nghị định 30/2020/NĐ-CP về công tác văn thư
> - Nghị định 68/2024/NĐ-CP về chữ ký số và giao dịch điện tử trong cơ quan nhà nước
> - Luật Lưu trữ (Luật số 33/2024/QH15)
> - [ADR-001: Hợp nhất Maker-Checker / Separation of Duties Guard](docs/architecture/decisions/ADR-001-single-canonical-maker-checker-guard.md)
> - [ADR-002: Contextual Authorization Policy Engine](docs/architecture/decisions/ADR-002-contextual-authorization-policy-engine.md)
> - [ADR-004: Document Status Two-Tier Sync](docs/architecture/decisions/ADR-004-document-status-two-tier-sync.md)
> - [Enterprise Product Architecture](docs/architecture/enterprise-product-architecture.md)

---

## 1. Tóm tắt Kiểm toán Cấp cao (Executive Summary)

Đợt kiểm toán này rà soát toàn diện hiện trạng bảo mật, kiểm soát truy cập và kiến trúc phân quyền trên toàn bộ 17 tệp route action hiện hữu và các hành vi nghiệp vụ của phân hệ Văn bản (Document) và Hồ sơ công việc (Work Dossier).

### Các phát hiện trọng yếu (Critical & High Findings)

1. **Tầng 4 (Layer 4 - Request Context & Perimeter Security)**: **100% (17/17) action route files hoàn toàn thiếu vắng cơ chế bảo vệ CSRF (`assertCsrf`) và giới hạn tần suất (`assertRateLimit`)**. Kẻ tấn công có thể lợi dụng phiên duyệt web của người dùng để thực thi các tác vụ công vụ mang tính pháp lý (ký số, cấp số, ban hành, lưu trữ) qua tấn công CSRF; hoặc tấn công vét cạn làm cạn kiệt bộ đếm số đến/số đi liên tục.
2. **Tầng 5 (Layer 5 - Authorization Engine Drift & Split-Brain)**: Tồn tại sự phân mảnh nghiêm trọng giữa **Canonical Policy Engine** (`src/server/authorization/authorization-engine.ts` - 10-step pipeline theo ADR-002), **Hybrid Authorization Adapter** (`src/lib/auth/hybrid-authorization.ts`), và **Legacy Procedural Policies** (`src/server/policies/document-policy.ts`, `dossier-policy.ts`). Toàn bộ 17 action routes tại tầng HTTP không thực thi kiểm tra thẩm quyền ranh giới (Route-level Guard) mà phó mặc hoàn toàn cho tầng Domain Service. Đồng thời, `dossier-policy.ts` chỉ có `canReadDossier`, thiếu 100% mutation policies.
3. **Tầng 6 (Layer 6 - Domain Service Delegation vs Direct Prisma Bypass)**:
   - Route `src/app/api/documents/outgoing/route.ts:8-62` (GET) thực hiện truy vấn Prisma trực tiếp, không áp dụng bộ lọc ACL phân quyền (`buildDocumentReadWhere`) hay kiểm tra độ mật, gây rò rỉ toàn bộ danh sách văn bản đi liên đơn vị.
   - Route `src/app/api/documents/[id]/directives/route.ts:111-321` (POST) tự ý khởi tạo transaction trực tiếp trên Prisma để tạo `DocumentDirective` và `Task`, bỏ qua hoàn toàn Domain Service của văn bản đến và dịch vụ tác vụ, gây xung đột trực tiếp với route chuẩn `src/app/api/documents/[id]/actions/direct/route.ts`.
4. **Tầng 6 (Layer 6 - Separation of Duties & State Machine Gaps)**:
   - **Lỗ hổng vượt rào SoD trong `fileDocument`**: Khi gọi action `file` với tham số `archiveNow: true`, hệ thống cho phép chuyên viên xử lý tự lưu trữ văn bản đến vào trạng thái `ARCHIVED` mà **không kiểm tra nguyên tắc Phân lập trách nhiệm (SoD: Submitter != Archivist)**.
   - **Thiếu kiểm tra SoD Signer != Issuer**: Quy trình ban hành văn bản đi (`issue`) không có rào chắn ngăn người ký tự phát hành văn bản trái với quy chế phân công văn thư theo Nghị định 30/2020/NĐ-CP.
   - **Các hành vi nghiệp vụ bị gộp / thiếu endpoint độc lập**: Các tác vụ nghiệp vụ chuẩn `assign-person`, `start`, `archive` chưa có API route file độc lập mà bị gộp cưỡng bức vào `assign-unit` và `file`, làm mờ ranh giới thẩm quyền giữa Trưởng đơn vị và Chuyên viên thụ lý (Single DRI).

---

## 2. Ma trận Kiểm toán Thẩm quyền 17 Action Route Files Hiện hữu

### 2.1. Bảng Kiểm toán 17 Action Route Files Đang Tồn Tại trên Đĩa

| STT | Tác vụ (Action) | Endpoint & Method | File & Line | Thẩm quyền / Capability | Hiện trạng bảo vệ (Existing Protections) | Lỗ hổng & Khoảng cách (Gaps) | Mức độ rủi ro |
|---|---|---|---|---|---|---|---|
| **A** | **VĂN BẢN ĐẾN (INCOMING - 5 Action Route Files)** | | | | | | |
| 1 | `present` (Trình chỉ đạo) | `POST /api/documents/[id]/actions/present` | `src/app/api/documents/[id]/actions/present/route.ts:10-37` | `document.incoming.present` | `requireAuthenticated(apiCtx)` -> Service gọi `assertAuthorized(user, "document.incoming.present", resource)` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Không Zod validation ở route<br>❌ Không kiểm tra thẩm quyền ở Layer 5 trước khi gọi service | **HIGH** |
| 2 | `direct` (Cho ý kiến/Bút phê) | `POST /api/documents/[id]/actions/direct` | `src/app/api/documents/[id]/actions/direct/route.ts:10-41` | `document.incoming.direct` | `requireAuthenticated(apiCtx)` -> Service gọi `assertAuthorized(user, "document.incoming.direct", resource)` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>⚠️ Xung đột kiến trúc với `directives/route.ts` (xem Mục 5) | **HIGH** |
| 3 | `assign-unit` (Giao đơn vị chủ trì) | `POST /api/documents/[id]/actions/assign-unit` | `src/app/api/documents/[id]/actions/assign-unit/route.ts:10-41` | `document.incoming.assign_person` | `requireAuthenticated(apiCtx)` -> Service gọi `assertAuthorized(user, "document.incoming.assign_person", resource)` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>⚠️ Đặt tên route `assign-unit` nhưng bên trong lại đòi hỏi gán chuyên viên `driUserId` (gộp 2 bước) | **HIGH** |
| 4 | `resolve` (Giải quyết văn bản) | `POST /api/documents/[id]/actions/resolve` | `src/app/api/documents/[id]/actions/resolve/route.ts:10-38` | `document.incoming.resolve` | `requireAuthenticated(apiCtx)` -> Service gọi `assertAuthorized(user, "document.incoming.resolve", resource)` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Không kiểm tra ràng buộc hoàn thành nhiệm vụ liên kết (Linked Task completion guard) | **HIGH** |
| 5 | `file` (Đưa vào hồ sơ theo dõi) | `POST /api/documents/[id]/actions/file` | `src/app/api/documents/[id]/actions/file/route.ts:10-39` | `document.incoming.file` | `requireAuthenticated(apiCtx)` -> Service gọi `assertAuthorized(user, "document.incoming.file", resource)` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>⚠️ Không xác thực `dossierId` có tồn tại trong bảng `work_dossiers` không (cho phép gán chuỗi giả) | **HIGH** |
| **B** | **VĂN BẢN ĐI (OUTGOING - 9 Action Route Files)** | | | | | | |
| 6 | `submit-content-review` (Trình duyệt nội dung) | `POST /api/documents/[id]/actions/submit-content-review` | `src/app/api/documents/[id]/actions/submit-content-review/route.ts:10-37` | `document.outgoing.submit_content_review` | `requireAuthenticated(apiCtx)` -> Service gọi `assertAuthorized` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Thiếu Zod schema validation ở route layer | **HIGH** |
| 7 | `approve-content` (Phê duyệt nội dung) | `POST /api/documents/[id]/actions/approve-content` | `src/app/api/documents/[id]/actions/approve-content/route.ts:10-36` | `document.outgoing.approve_content` | Kiểm tra SoD `OutgoingDocumentStateMachine.assertDrafterNotContentReviewer` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>⚠️ SoD chỉ so khớp với `registeredById`, bỏ sót trường hợp draft chuyển giao | **HIGH** |
| 8 | `submit-format-check` (Gửi kiểm tra thể thức) | `POST /api/documents/[id]/actions/submit-format-check` | `src/app/api/documents/[id]/actions/submit-format-check/route.ts:10-37` | `document.outgoing.submit_format_check` | Service gọi `assertAuthorized(user, "document.outgoing.submit_format_check", resource)` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>⚠️ Tên endpoint là `submit-format-check` (cần chuẩn hóa đồng nhất với spec) | **HIGH** |
| 9 | `approve-format` (Phê duyệt thể thức) | `POST /api/documents/[id]/actions/approve-format` | `src/app/api/documents/[id]/actions/approve-format/route.ts:10-36` | `document.outgoing.approve_format` | Service gọi `assertAuthorized(user, "document.outgoing.approve_format", resource)` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Không kiểm tra SoD Format Reviewer != Drafter | **HIGH** |
| 10 | `sign` (Ký số thẩm quyền) | `POST /api/documents/[id]/actions/sign` | `src/app/api/documents/[id]/actions/sign/route.ts:10-39` | `document.outgoing.authorized_sign` / `sign_kt` | Kiểm tra SoD Format Reviewer != Signer; Tạo bản ghi `SignatureRecord` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Thiếu xác thực cryptographic signature token hợp lệ tại API | **CRITICAL** |
| 11 | `assign-number` (Cấp số văn bản đi) | `POST /api/documents/[id]/actions/assign-number` | `src/app/api/documents/[id]/actions/assign-number/route.ts:10-38` | `document.outgoing.assign_number` | Kiểm tra SoD Signer != Numberer; Kiểm tra văn bản đã ký chưa | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>⚠️ Thiếu rate-limit có thể gây race condition cạn bộ đếm số đi | **HIGH** |
| 12 | `organization-sign` (Đóng dấu cơ quan) | `POST /api/documents/[id]/actions/organization-sign` | `src/app/api/documents/[id]/actions/organization-sign/route.ts:10-37` | `document.outgoing.organization_sign` | Kiểm tra SoD Signer != OrgSigner; Trạng thái bắt buộc `NUMBERED` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Không kiểm tra vai trò Văn thư cơ quan tại HTTP layer | **HIGH** |
| 13 | `issue` (Phát hành văn bản) | `POST /api/documents/[id]/actions/issue` | `src/app/api/documents/[id]/actions/issue/route.ts:10-37` | `document.outgoing.issue` | Trạng thái bắt buộc `ORGANIZATION_SIGNED`; Cập nhật `Document.status = DA_HOAN_THANH` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ **Thiếu SoD Signer != Issuer**: Người ký có thể tự phát hành | **HIGH** |
| 14 | `revision` (Tạo bản sửa đổi văn bản) | `POST /api/documents/[id]/actions/revision` | `src/app/api/documents/[id]/actions/revision/route.ts:10-42` | `document.outgoing.draft` | Service gọi `createDocumentRevision` -> `assertAuthorized` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>⚠️ Cần kiểm tra chặt chẽ điều kiện chỉ sửa đổi trước khi ban hành | **HIGH** |
| **C** | **HỒ SƠ CÔNG VIỆC (DOSSIER - 3 Action Route Files)** | | | | | | |
| 15 | `close` (Đóng hồ sơ) | `POST /api/dossiers/[id]/actions/close` | `src/app/api/dossiers/[id]/actions/close/route.ts:10-34` | `dossier.close` | `requireAuthenticated(apiCtx)` -> `DossierService.closeDossier` -> `assertAuthorized` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Không có kiểm tra thẩm quyền ở Layer 5 `dossier-policy.ts` | **HIGH** |
| 16 | `submit-archive` (Nộp lưu trữ cơ quan) | `POST /api/dossiers/[id]/actions/submit-archive` | `src/app/api/dossiers/[id]/actions/submit-archive/route.ts:10-34` | `dossier.submit_archive` | Yêu cầu hồ sơ phải `CLOSED`; Phải có `retentionRuleId`; Hồ sơ không được rỗng | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Thiếu xác nhận của Trưởng đơn vị trước khi nộp lưu trữ cơ quan | **HIGH** |
| 17 | `accept-archive` (Tiếp nhận lưu trữ) | `POST /api/dossiers/[id]/actions/accept-archive` | `src/app/api/dossiers/[id]/actions/accept-archive/route.ts:10-34` | `dossier.accept_archive` | Kiểm tra nghiêm ngặt SoD Submitter != Archivist; Kiểm tra `retentionRuleId` | ❌ Thiếu `assertCsrf`<br>❌ Thiếu `assertRateLimit`<br>❌ Thiếu route-level validation | **HIGH** |

---

### 2.2. Nhận diện các Hành vi Nghiệp vụ bị Gộp hoặc Thiếu Route Độc lập (Missing & Embedded Business Operations)

Trong quá trình đối chiếu quy trình nghiệp vụ hành chính theo Nghị định 30/2020/NĐ-CP và máy trạng thái `IncomingDocumentStateMachine`, kiểm toán phát hiện **3 hành vi nghiệp vụ công vụ chuẩn tắc hiện không có tệp route chuyên biệt**, mà đang bị gộp hoặc kích hoạt ngầm trong các handler khác:

| Hành vi nghiệp vụ (Operation) | Vị trí cài đặt hiện tại | Cơ chế hoạt động ngầm / bị gộp | Lỗ hổng & Rủi ro kiến trúc | Mức độ rủi ro |
|---|---|---|---|---|
| **`assign-person`** (Trưởng đơn vị phân công chuyên viên chủ trì) | Nhúng trong `src/app/api/documents/[id]/actions/assign-unit/route.ts` & `src/lib/services/incoming-document-service.ts:641-760` | Route `assign-unit` không chỉ giao đơn vị mà bắt buộc phải truyền `driUserId` (chuyên viên chủ trì). Logic giao đơn vị (`ASSIGNED_TO_LEAD_UNIT`) và giao cá nhân (`UNIT_ASSIGNED_PERSON`) bị trộn lẫn làm một. | ❌ **Thiếu route độc lập `POST /api/documents/[id]/actions/assign-person`**: Ban Giám hiệu phân công đơn vị chủ trì nhưng không thể giao việc nếu không biết chuyên viên cụ thể; ngược lại, Trưởng phòng không thể phân công lại chuyên viên trong phòng mà không gọi lại route giao đơn vị. | **MEDIUM** |
| **`start`** (Chuyên viên xác nhận bắt đầu xử lý) | Kích hoạt ngầm trong `src/lib/services/incoming-document-service.ts:692-699` | Trạng thái `IN_PROGRESS` chỉ được thiết lập nếu trong payload của `assignUnitWork` có cờ `createTask: true`. | ❌ **Thiếu route độc lập `POST /api/documents/[id]/actions/start`**: Chuyên viên thụ lý (DRI) không có endpoint chủ động bấm "Tiếp nhận & Bắt đầu xử lý" văn bản. Quy trình State Machine có bước chuyển `UNIT_ASSIGNED_PERSON -> IN_PROGRESS` nhưng không có API trigger trực tiếp cho cán bộ thực hiện. | **MEDIUM** |
| **`archive`** (Lưu trữ văn bản đến vào kho lưu trữ) | Nhúng trong `src/app/api/documents/[id]/actions/file/route.ts` & `src/lib/services/incoming-document-service.ts:1027-1056` | Được kích hoạt qua tham số `body.archiveNow: true` khi gọi `actions/file`. Thao tác này lập tức chuyển trạng thái sang `ARCHIVED` và tự gán `archivedById = user.id`. | ❌ **Lỗ hổng nghiêm trọng (Critical SoD Bypass)**: Bỏ qua hoàn toàn quy trình bàn giao lưu trữ cơ quan. Chuyên viên tự nộp hồ sơ và tự ký xác nhận lưu trữ (Submitter = Archivist) mà không qua Lưu trữ viên theo Luật Lưu trữ. Thiếu route chuyên trách `POST /api/documents/[id]/actions/archive`. | **CRITICAL** |

---

## 3. Đánh giá Chuyên sâu Tầng 4: Lỗ hổng CSRF & Rate Limiting (Layer 4 Perimeter)

### 3.1. Sự vắng bóng 100% của `assertCsrf` (17/17 Action Route Files)
Toàn bộ 17 tệp route action tại `src/app/api/documents/[id]/actions/*` và `src/app/api/dossiers/[id]/actions/*` hiện **chỉ** gọi:
```typescript
const apiCtx = await getApiContext(req);
requestId = apiCtx.requestId;
const authUser = requireAuthenticated(apiCtx);
```
và hoàn toàn **KHÔNG CÓ** lời gọi `assertCsrf(req)`!

Trong khi đó, tại các route chuẩn mẫu như `src/app/api/documents/[id]/route.ts:113` và `src/app/api/documents/[id]/directives/route.ts:132`, hàm `assertCsrf` được áp dụng bắt buộc:
```typescript
// 2. CSRF assertion on mutations
assertCsrf(request);
```

**Nguy cơ thực tế**:
- Tr��nh duyệt lưu giữ cookie xác thực của phiên đăng nhập (`auth-token` hoặc session cookie).
- Kẻ tấn công có thể tạo trang web độc hại hoặc gửi email lừa đảo (spear-phishing) chứa script tự động kích hoạt HTTP POST đến `https://eoffice.qcet.edu.vn/api/documents/{id}/actions/sign` hoặc `organization-sign`.
- Vì thiếu CSRF token và header xác nhận phía client (`x-csrf-token` / SameSite strict assertion), trình duyệt của Lãnh đạo hoặc Văn thư sẽ vô tình thực thi ký số hoặc đóng dấu văn bản ngoài ý muốn.

### 3.2. Sự vắng bóng 100% của `assertRateLimit` (17/17 Action Route Files)
Không có bất kỳ action route nào trong 17 route kiểm toán áp dụng rate limiting:
- `assertRateLimit(authUser.id, "MUTATION")` hoàn toàn vắng mặt.
- **Nguy cơ thực tế**:
  1. **Cạn kiệt và xung đột số văn bản (Number Allocation Race Condition)**: Kẻ tấn công hoặc lỗi script frontend gửi đồng thời hàng trăm request tới `actions/assign-number`. Dù CSDL có transaction lock, việc dồn nén request liên tục gây nghẽn pool kết nối Prisma và có thể gây nhảy cóc số văn bản lưu trữ.
  2. **Tấn công DoS dịch vụ ký số**: Thao tác `sign` và `organization-sign` tạo ra các bản ghi `SignatureRecord` gắn với metadata chứng thư số và hash nội dung. Thiếu rate limiting cho phép spam tạo chữ ký rác, làm phình bảng CSDL và quá tải dịch vụ kiểm tra OCSP/CRL.

### 3.3. Thiếu chuẩn hóa kích thước Payload và Zod Schema tại HTTP Boundary
- Các route action parse body bằng cú pháp không kiểm soát:
  ```typescript
  const body = await req.json().catch(() => ({}));
  ```
- Không gọi `assertJsonContentType(request)`.
- Không gọi `assertRequestBodySize(request, MAX_JSON_BODY_SIZE)`.
- Không sử dụng `zod` schema để validate dữ liệu đầu vào tại Controller layer trước khi chuyển sang Service layer.

---

## 4. Đánh giá Chuyên sâu Tầng 5: Phân mảnh Động cơ Phân quyền (Layer 5 Policy Drift)

Hệ thống hiện tại đang tồn tại **ba thế lực phân quyền song song (Three-headed Engine)** chưa được thống nhất:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             API ROUTE LAYER                                 │
│                   (Zero Layer 5 checks in Action Routes)                    ��
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
       ┌───────────────▼───────────────┐               │
       │       LEGACY POLICIES         │               │
       │   `document-policy.ts`        │               │
       │   `dossier-policy.ts`         │               │
       │ (canRead, canDirect, isAdmin) │               │
       └───────────────┬───────────────┘               │
                       │                               │
       ┌───────────────▼───────────────┐   ┌───────────▼───────────┐
       │   HYBRID AUTH ENGINE          │   │  CANONICAL ENGINE     │
       │ `hybrid-authorization.ts`     │   │`authorization-engine` │
       │  (Used by Services)           │   │ (10-Step Pipeline)    │
       │  AuthenticatedUserContext     │   │ AuthorizationContext  │
       └───────────────────────────────┘   └───────────────────────┘
```

### 4.1. Sự chênh lệch giữa Canonical Engine và Hybrid Adapter
- **Canonical Policy Engine** (`src/server/authorization/authorization-engine.ts`) được xây dựng theo chuẩn **ADR-002** với pipeline 10 bước nghiêm ngặt, hỗ trợ `AuthorizationContext` (nạp qua `loadAuthorizationContext`), tính toán ranh giới lĩnh vực phụ trách (`ResponsibilityArea` - Portfolio) và kiểm soát văn bản mật theo Luật 117/2025/QH15.
- Tuy nhiên, cả ba domain services (`incoming-document-service.ts`, `outgoing-document-service.ts`, `dossier-service.ts`) lại đang import và gọi `assertAuthorized` từ `src/lib/auth/hybrid-authorization.ts`.
- Engine trong `hybrid-authorization.ts` sử dụng `AuthenticatedUserContext` phái sinh từ session hoặc token, nạp quyền hạn theo cách thủ công qua `resolveUserContext()`, dẫn đến sự sai lệch:
  1. Quyết định phân quyền không ghi nhận đầy đủ các ràng buộc ủy quyền cấp phòng (`DacumDelegation`) theo chuẩn mới.
  2. Bỏ qua kiểm tra độ bảo mật theo chuẩn phân loại F15 đối với các hồ sơ hỗn hợp (Dossier chứa tài liệu mật).

### 4.2. Khoảng trống ở `dossier-policy.ts`
Khi kiểm tra `src/server/policies/dossier-policy.ts:66-152`, adapter này **chỉ có hàm `canReadDossier`**.
Hoàn toàn **không tồn tại**:
- `canCreateDossier`
- `canUpdateDossier`
- `canCloseDossier`
- `canSubmitArchiveDossier`
- `canAcceptArchiveDossier`
- `canManageDossierItems`

Hệ quả: Bất kỳ lập trình viên nào xây dựng route mới hoặc gọi trực tiếp policy adapter đều không có công cụ để kiểm tra quyền biến đổi hồ sơ, dẫn tới tình trạng thả nổi hoặc viết kiểm tra thủ công phân tán.

---

## 5. Đánh giá Chuyên sâu Tầng 6: Vượt mặt Domain Service & Bỏ sót State Machine / SoD

### 5.1. Direct Prisma Query Bypass (Vượt mặt Domain Service)

#### Lỗ hổng 1: Bypass ACL tại `src/app/api/documents/outgoing/route.ts:8-62` (GET)
```typescript
// src/app/api/documents/outgoing/route.ts
const [items, total] = await Promise.all([
  prisma.documentOutgoingWorkflow.findMany({
    where, // <-- where chỉ lọc status và search text!
    take: limit,
    skip: offset,
    ...
```
- **Phân tích**: Route này cho phép bất kỳ người dùng nào đăng nhập (`requireAuthenticated(context)`) có thể xem toàn bộ danh sách quy trình văn bản đi của toàn trường, kể cả văn bản dự thảo nội bộ của đơn vị khác, văn bản có tính chất mật hoặc nhạy cảm.
- **Vi phạm**: Bỏ qua hàm lọc bắt buộc `buildDocumentReadWhere()` tại `src/server/policies/document-policy.ts:198-245`.

#### Lỗ hổng 2: Xung đột kiến trúc và bypass toàn diện tại `src/app/api/documents/[id]/directives/route.ts:111-321` (POST)
- Route này cho phép lãnh đạo cho ý kiến chỉ đạo văn bản đến.
- Thay vì gọi `directDocument()` trong `src/lib/services/incoming-document-service.ts:490-639`, route này lại tự mở transaction Prisma trực tiếp:
  ```typescript
  // src/app/api/documents/[id]/directives/route.ts:199
  const { createdTask, savedDirective, updatedDocumentRecord } = await prisma.$transaction(
    async (tx) => {
      // Tự tính mã nhiệm vụ NV-YYYY-MM-XXX
      // tx.task.create(...)
      // tx.documentDirective.create(...)
      // tx.document.update(...)
    }
  );
  ```
- **Hậu quả nghiêm trọng**:
  1. Bỏ qua `IncomingDocumentStateMachine`: Trạng thái kỹ thuật của văn bản đến (`DocumentIncomingWorkflow.status`) không được kiểm tra hay chuyển đổi sang `DIRECTED`.
  2. Bỏ qua Outbox Notification: Không phát hành sự kiện outbox (`publishOutboxEvent`), khiến hệ thống thông báo thời gian thực và chuông thông báo không nhận được tin.
  3. Xung đột dữ liệu với `src/app/api/documents/[id]/actions/direct/route.ts`: Hai endpoint cùng thực hiện một nghiệp vụ nhưng ghi dữ liệu vào các bảng và trạng thái khác nhau (Split-Brain).

### 5.2. Đánh giá Phân lập Trách nhiệm (Separation of Duties - SoD Invariants)

Bảng đánh giá mức độ tuân thủ 5 quy tắc SoD cốt lõi theo Nghị định 30/2020/NĐ-CP và ADR-001:

```
┌──────────────────────────────────────┬────────────┬────────────────────────────────────────────────────────┐
│ Quy tắc Phân lập Trách nhiệm (SoD)   │ Tuân thủ   │ Vị trí cài đặt & Hiện trạng kiểm soát                  │
├──────────────────────────────────────┼────────────┼────────────────────────────────────────────────────────┤
│ 1. Drafter != Content Reviewer       │ ✅ ĐẠT     │ `OutgoingDocumentStateMachine.ts:176` & service:407    │
│ 2. Signer != Numberer                │ ✅ ĐẠT     │ `OutgoingDocumentStateMachine.ts:190` & service:783    │
│ 3. Signer != Organization Signer     │ ✅ ĐẠT     │ `OutgoingDocumentStateMachine.ts:204` & service:897    │
│ 4. Submitter != Archivist            │ ⚠️ LỖ HỔNG │ Đạt trong DossierService:862, nhưng LỌT trong FileDoc  │
│ 5. Signer != Issuer                  │ ❌ THIẾU   │ Chưa có kiểm tra phân lập giữa Người ký & Người phát   │
└──────────────────────────────────────┴────────────┴────────────────────────────────────────────────────────┘
```

#### Phân tích chi tiết Lỗ hổng SoD Submitter != Archivist trong `fileDocument`:
Tại `src/lib/services/incoming-document-service.ts:1027-1056`:
```typescript
const archiveNow = Boolean(input.archiveNow);
const targetStatus = archiveNow
  ? IncomingDocumentStatus.ARCHIVED
  : IncomingDocumentStatus.FILED;

IncomingDocumentStateMachine.assertTransition(currentStatus, targetStatus, input.documentId);

// Ghi trực tiếp người lưu trữ chính là người thực hiện gọi hàm (user.id)!
data: {
  status: targetStatus,
  filedAt: now,
  filedById: user.id,
  ...(archiveNow ? { archivedAt: now, archivedById: user.id } : {}),
}
```
- Khi chuyên viên xử lý văn bản gọi action `file` với `archiveNow: true`, văn bản nhảy cóc thẳng vào trạng thái `ARCHIVED`.
- Người nộp hồ sơ (`filedById`) và Người lưu trữ hồ sơ (`archivedById`) **trùng là một cá nhân (`user.id`)**.
- Thao tác này hoàn toàn **bỏ qua khâu thẩm tra, giao nộp và tiếp nhận của Lưu trữ viên cơ quan**, vi phạm nghiêm trọng Luật Lưu trữ và nguyên tắc kiểm soát quyền lực độc lập.

### 5.3. Đánh giá Đồng bộ Trạng thái 2 Tầng (ADR-004 Two-Tier Sync)
Theo ADR-004, `Document.status` phải được đồng bộ nguyên tử trong cùng transaction với `IncomingDocumentStatus` / `OutgoingDocumentStatus`.
- Trong `outgoing-document-service.ts:829`: Khi cấp số đi (`NUMBERED`), code cập nhật `Document.status = CHO_PHE_DUYET`. Tuy nhiên, theo bảng chuẩn tắc ADR-004 dòng 70:
  *Trạng thái `NUMBERED` và `ORGANIZATION_SIGNED` tương ứng với `Document.status = DANG_XU_LY` (vì đã ký xong, đang làm thủ tục hành chính).*
- Trong `incoming-document-service.ts:1064`: Khi lưu theo dõi, code cập nhật `status = LUU_THEO_DOI` là chuẩn tắc. Nhưng khi văn bản ở bước `PRESENTED`, `DIRECTED`, `ASSIGNED_TO_LEAD_UNIT`, trạng thái hành chính chưa được đồng bộ tự động về `CHO_PHAN_CONG`.

---

## 6. Đề xuất Kế hoạch Khắc phục & Các Issue Thực thi cho Phase 5 (Document Domain)

Dựa trên kết quả kiểm toán, đề xuất mở 6 issue kỹ thuật chuyên biệt cho Phase 5:

### Issue 5.1: Triển khai Layer 4 Security Hardening cho toàn bộ 17 Action Route Files
- **Mục tiêu**: Bổ sung rào chắn bảo vệ biên giới API.
- **Phạm vi thực hiện**:
  1. Thêm `assertCsrf(req)` vào đầu tất cả 14 route `documents/[id]/actions/*` và 3 route `dossiers/[id]/actions/*`.
  2. Bổ sung `await assertRateLimit(authUser.id, "MUTATION")`.
  3. Thêm kiểm tra `assertJsonContentType(req)` và `assertRequestBodySize(req, MAX_JSON_BODY_SIZE)`.
  4. Tạo Zod schemas tại `@/contracts/documents` và validate body bằng `.parse()`.

### Issue 5.2: Khắc phục Lỗ hổng SoD `Submitter != Archivist` và Bổ sung `Signer != Issuer`
- **Mục tiêu**: Đóng lỗ hổng phân lập trách nhiệm pháp lý.
- **Phạm vi thực hiện**:
  1. Loại bỏ cờ `archiveNow: true` khỏi `fileDocument` của văn bản đến. Buộc văn bản sau khi hoàn thành (`RESOLVED`) phải đưa vào Hồ sơ công việc (`WorkDossier`) và nộp lưu trữ theo quy trình chuẩn của Luật Lưu trữ.
  2. Bổ sung guard `OutgoingDocumentStateMachine.assertSignerNotIssuer(existing.authorizedSignerId, user.id)` tại `issueDocument()`.

### Issue 5.3: Hợp nhất Direct Prisma Bypasses & Loại bỏ Xung đột Directives Route
- **Mục tiêu**: Bảo đảm nguyên tắc độc quyền sở hữu nghiệp vụ của Domain Service.
- **Phạm vi thực hiện**:
  1. Tái cấu trúc `GET /api/documents/outgoing`: Áp dụng `buildDocumentReadWhere(authUser)` và chuyển logic truy vấn vào `OutgoingDocumentService.listOutgoingWorkflows()`.
  2. Xóa bỏ logic tự tạo task và cập nhật trực tiếp trong `src/app/api/documents/[id]/directives/route.ts`. Chuyển hướng endpoint này tái sử dụng canonical service `directDocument()` hoặc deprecate và thống nhất về `actions/direct`.

### Issue 5.4: Chuẩn hóa Action Routes còn thiếu (`assign-person`, `start`, `archive`)
- **Mục tiêu**: Tách bạch rõ ràng các bước trong State Machine.
- **Phạm vi thực hiện**:
  1. Tách `actions/assign-unit` (chỉ giao đơn vị chủ trì/phối hợp) và tạo mới `actions/assign-person` (Trưởng đơn vị giao chuyên viên chủ trì DRI).
  2. Tạo route `POST /api/documents/[id]/actions/start` để chuyên viên nhận việc xác nhận chuyển trạng thái sang `IN_PROGRESS`.
  3. Tạo route chuyên trách tiếp nhận lưu trữ văn bản độc lập.

### Issue 5.5: Di chuyển Domain Services sang Canonical Contextual Authorization Engine (ADR-002)
- **Mục tiêu**: Xóa bỏ hiện tượng "Tam đầu chế" phân quyền.
- **Phạm vi thực hiện**:
  1. Chuyển đổi các lời gọi `assertAuthorized` từ `src/lib/auth/hybrid-authorization.ts` sang `canonicalAssertAuthorized` từ `src/server/authorization/authorization-engine.ts`.
  2. Nạp ngữ cảnh đầy đủ qua `loadAuthorizationContext(userId)` để kích hoạt bảo vệ văn bản mật và danh mục phụ trách (Portfolio).

### Issue 5.6: Hoàn thiện `DossierPolicy` và Đồng bộ Trạng thái 2 Tầng (ADR-004)
- **Mục tiêu**: Chuẩn hóa quản lý vòng đời hồ sơ và trạng thái hành chính.
- **Phạm vi thực hiện**:
  1. Bổ sung các hàm kiểm tra thẩm quyền mutation trong `src/server/policies/dossier-policy.ts` (`canCloseDossier`, `canSubmitArchiveDossier`, `canAcceptArchiveDossier`).
  2. Hiệu chỉnh ánh xạ trạng thái trong `outgoing-document-service.ts` tại bước `NUMBERED` và `ORGANIZATION_SIGNED` theo đúng bảng chuẩn của ADR-004.

---

## 7. Kết luận

Phân hệ Văn bản và Hồ sơ công việc đã bước đầu thiết lập được các Domain Service xử lý logic nghiệp vụ và state machine cơ bản. Tuy nhiên, **tầng bảo vệ và phân quyền hiện đang có những lỗ hổng nghiêm trọng ở Layer 4 (thiếu 100% CSRF & Rate Limit trên toàn bộ 17 action route files) và Layer 6 (vượt mặt SoD trong lưu trữ, bypass Prisma trực tiếp)**.

Báo cáo kiểm toán này cung cấp cơ sở dữ liệu xác thực và lộ trình kỹ thuật chi tiết để triển khai ngay trong Phase 5, đảm bảo hệ thống QCET E-Office tuân thủ đầy đủ chuẩn mực kiến trúc bảo mật doanh nghiệp và hành lang pháp lý quốc gia.
