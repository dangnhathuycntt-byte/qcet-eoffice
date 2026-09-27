# Domain & Codebase Invariants

Tổng hợp từ các `AGENTS.md` — quy tắc bắt buộc khi làm việc với từng layer.

## Lib & Domain (`src/lib/`, `src/domain/`)
- Dùng canonical domain helpers trong `src/lib/`; không viết utility trùng lặp hoặc cạnh tranh.
- Không bịa dữ liệu nghiệp vụ: metadata, số lượng placeholder, hoặc entity giả.
- Ngày tháng dùng `src/lib/academic-calendar.ts` và múi giờ ICT (UTC+7).
- Mỗi metric tổ chức chỉ có đúng một định nghĩa toán học và nghiệp vụ.
- Hàm domain phải pure, deterministic, không có side effect ẩn.

## API Routes (`src/app/api/`)
- Xác thực bắt buộc cho mọi route bảo vệ bằng server session token.
- Phân quyền RBAC trên server; không tin client-claimed roles hoặc headers.
- Validate mọi payload mutation và query parameters trước khi xử lý.
- Không cho phép demo mode, mock bypass, hoặc guest escalation trên production.
- Trả lỗi theo format JSON chuẩn với HTTP status code nhất quán.

## Task Components (`src/components/tasks/`)
- Dùng `UnifiedAdaptiveWorkspace` và `ModularCascadingTaskTable` duy nhất; không tạo workspace hoặc table song song.
- Role ≠ Scope: scope (`school`, `unit`, `personal`) lọc dữ liệu; role kiểm soát quyền.
- Giữ nguyên ngữ nghĩa parent/subtask và quan hệ cascading khi lọc, nhóm, mutation.
- Dùng canonical task toolbar duy nhất; không tạo filter controls hoặc search box trùng lặp.
- Filter state, badge counters, table views, URL query parameters phải đồng bộ chính xác.

## Tests (`tests/`)
- Test phải encode yêu cầu thật, không phải quirks của implementation.
- Dùng date/time mock deterministic, pin vào ICT (UTC+7).
- Không làm yếu assertion hoặc nới lỏng bounds để pass test.
- Test rõ ràng authentication, role-based access, và scope boundaries.
