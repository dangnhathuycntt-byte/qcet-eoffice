# ADR-007: REST API Standard với Chuẩn Báo Lỗi RFC 9457 Problem Details

- **Status**: ACCEPTED
- **Date**: 2026-09-22
- **Deciders**: Owner (Approved at Architecture Review Gate)

## Context

Hệ thống QCET E-Office hiện có **86 API route files** với **~118 handlers** (59 POST, 45 GET, 6 PATCH, 6 DELETE), phân bố trên 10 domain nghiệp vụ.

### 1. Hiện trạng triển khai tại CURRENT HEAD

Rà soát mã nguồn thực tế cho thấy hệ thống đã có **một số chuẩn bảo vệ quan trọng được triển khai một phần nhưng chưa nhất quán (Partial / Inconsistent Existing Standards)**:

- **Optimistic Concurrency Control (OCC) và ETag**:
  - Tại `src/app/api/tasks/[id]/route.ts` (dòng 109–121), handler `PATCH` đã kiểm tra `If-Match` header và trả mã lỗi `412 Precondition Failed` khi version không khớp.
  - Một số route khác cũng có sử dụng ETag hoặc cache validation headers, nhưng **độ phủ là bán phần và không nhất quán (partial and inconsistent coverage)**: Nhiều mutation endpoints của Document, Meeting, Dossier và Delegation hoàn toàn vắng bóng cơ chế kiểm tra concurrency này.
- **Business Command Endpoints đã dùng HTTP POST**:
  - Toàn bộ các endpoint hành động như `src/app/api/tasks/[id]/actions/update-status/route.ts`, `approve/route.ts`, `submit-result/route.ts` đều đã được thiết kế dưới dạng `export async function POST` và ủy nhiệm xử lý nghiệp vụ (delegate) sang `taskDomainActionService` hoặc `taskCommandService`, trong đó có thực thi FSM transition guards và kiểm tra quyền ReBAC.
- **CSRF và Rate Limiting trên Task mutations**:
  - Task API đã tích hợp `assertCsrf(req)` và `assertRateLimit(authUser.id, 'MUTATIONS_SENSITIVE')`, tuy nhiên 21 mutation routes thuộc Document/Meeting/Dossier chưa có kiểm tra CSRF và Rate-limit đồng bộ.

### 2. Các khoảng cách và bất nhất thực tế (Gaps & Inconsistencies)

1. **Định dạng lỗi không nhất quán (Thiếu RFC 9457)**:
   - Task API trả về: `{ success: false, error: string, code?: string, requestId: string }`
   - Document API trả về: `{ error: string }` hoặc `{ message: string }`
   - Auth API trả về: `{ error: string }` hoặc raw Zod error object
   - Chưa có endpoint nào trả về chuẩn quốc tế **RFC 9457 Problem Details (`application/problem+json`)**.

2. **Chuẩn Phân trang (Pagination) bị phân mảnh**:
   - Một số route dùng `{ data: [], total: number, page: number, limit: number }`
   - Một số route dùng `{ items: [], totalCount: number, pageSize: number }`
   - Thiếu cấu trúc phân trang dựa trên con trỏ (cursor-based pagination) thống nhất cho các danh sách có lưu lượng lớn.

## Decision

Thiết lập Chuẩn API Doanh nghiệp (Enterprise REST API Standard) đồng bộ hóa toàn bộ hệ thống:

### 1. Chuẩn Báo lỗi RFC 9457 Problem Details
Mọi phản hồi lỗi HTTP (4xx, 5xx) trên toàn bộ 86 API routes bắt buộc phải sử dụng Content-Type `application/problem+json` theo định dạng RFC 9457:
```json
{
  "type": "https://qcet.edu.vn/errors/sod-violation",
  "title": "Separation of Duties Violation",
  "status": 403,
  "detail": "Người tạo nhiệm vụ không được tự phê duyệt kết quả hoàn thành.",
  "instance": "/api/tasks/clxyz/actions/approve",
  "code": "SOD_CREATOR_CANNOT_APPROVE",
  "requestId": "req_8f1a2c3d",
  "invalidParams": []
}
```

### 2. Chuẩn hóa Phân trang (Cursor-Based Pagination Standard)
Các danh sách tài nguyên lớn chuyển dần sang cấu trúc phân trang con trỏ chuẩn tắc:
```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6ImNseHl6In0=",
    "hasMore": true,
    "total": 142
  }
}
```

### 3. Đồng bộ hóa OCC (ETag / If-Match) trên Toàn bộ Mutation Routes
Khắc phục tình trạng phủ sóng bán phần/không nhất quán hiện tại bằng cách áp dụng bắt buộc cơ chế OCC (kế thừa pattern từ `tasks/[id]/route.ts`) sang:
- `PATCH /api/documents/[id]` (kiểm tra `version` của Document)
- `PATCH /api/meetings/[id]`
- `PATCH /api/dossiers/[id]`

### 4. Kiên định mô hình Explicit Business Commands
Tiếp tục duy trì và nhân rộng mẫu hình `POST /api/<resource>/[id]/actions/<verb>` (đang chạy tốt tại Task action routes) sang toàn bộ các thao tác chuyển trạng thái của Văn bản, Cuộc họp và Hồ sơ.

### 5. Chính sách Quản lý Phiên bản API (API Versioning Policy)
- **Mặc định bảo toàn tương thích ngược (Preserve backward compatibility by default)**: Mọi sự thay đổi trên API contract phải ưu tiên thiết kế theo hướng mở rộng không gây phá vỡ (non-breaking additions: thêm trường tùy chọn, thêm endpoint mới, mở rộng enum chấp nhận).
- **Chưa áp dụng tiền tố phiên bản bắt buộc trên URL (No mandatory URL version prefix at present)**: Giữ nguyên cấu trúc định tuyến `/api/...` hiện tại; không tạo biến thể `/api/v1/...` tràn lan gây phân mảnh routing.
- **Ranh giới phiên bản chỉ áp dụng khi phá vỡ hợp đồng**: Nếu một thay đổi cấu trúc là bắt buộc và không thể duy trì tương thích ngược, đội ngũ phát triển bắt buộc phải xây dựng **Chiến lược Cảnh báo Loại bỏ (Deprecation Strategy)** và **Kế hoạch Chuyển đổi (Migration Plan)** rõ ràng trước khi thiết lập ranh giới phiên bản mới (version boundary) cho tài nguyên đó.

## Alternatives Considered

1. **Giữ nguyên hiện trạng (Status quo)**:
   - Client phải viết 4 adapter phân tích lỗi khác nhau cho 4 phân hệ; rủi ro xung đột dữ liệu trên Document/Meeting do thiếu OCC nhất quán.

2. **Bắt buộc URL Versioning `/api/v1/...` ngay lập tức**:
   - Bị bác bỏ: Gây chi phí rewrite toàn bộ 86 route files và toàn bộ frontend client calls trong khi API nội bộ có thể quản lý tương thích ngược qua schema evolution an toàn hơn.

3. **JSON:API Standard**:
   - Quá nặng nề và phức tạp, đòi hỏi bọc toàn bộ payload vào `{ data: { type, attributes, relationships } }`, không phù hợp với kiến trúc Next.js App Router hiện hữu.

## Consequences

### Tích cực
- Client có một contract xử lý lỗi duy nhất, tự động trích xuất `code`, `detail` và `requestId` để hiển thị thông báo chính xác cho người dùng.
- Ngăn chặn hoàn toàn lỗi ghi đè dữ liệu (lost updates) trên Văn bản và Hồ sơ khi áp dụng OCC đồng bộ.
- Chính sách versioning rõ ràng, bảo vệ hệ thống khỏi các breaking changes đột ngột.

### Tiêu cực
- Cần refactor helper tạo phản hồi lỗi (`src/server/api/response.ts` và các route handlers).
- Cần cập nhật client API layer để đọc payload theo schema RFC 9457.

## Evidence

| Bằng chứng | File:Line | Mô tả |
|------------|-----------|-------|
| Task API đã có OCC ETag/If-Match | `src/app/api/tasks/[id]/route.ts:109-121` | Kiểm tra If-Match, trả 412 |
| Task actions đã dùng POST | `src/app/api/tasks/[id]/actions/update-status/route.ts:10` | `export async function POST` |
| Task actions delegate domain service | `src/app/api/tasks/[id]/actions/update-status/route.ts:13` | `taskDomainActionService.updateStatus` |
| Document API lỗi đơn giản | `src/app/api/documents/[id]/route.ts:35` | Trả `{ error: string }` |
| Tổng số route files | `src/app/api/` | 86 route files, ~118 handlers |

## Related ADRs

- [ADR-001](ADR-001-single-canonical-maker-checker-guard.md) — Phản hồi lỗi SoD trả về RFC 9457 với `violationCode`.
- [ADR-002](ADR-002-contextual-authorization-policy-engine.md) — Phản hồi lỗi ủy quyền với 15+ rejection codes theo chuẩn RFC 9457.
