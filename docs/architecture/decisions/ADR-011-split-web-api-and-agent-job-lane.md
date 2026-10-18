# ADR-011: Tách ứng dụng web và api, làn việc nền của agent trên outbox

- **Status**: ACCEPTED cho phạm vi phát triển (nhánh `refactor/split-apps`, chưa triển khai). Người dùng giao bản đặc tả "tách QCET E-Office thành hai ứng dụng (web, api) và dựng nền cho module agent" kèm các quyết định D1–D12, và giao Claude tự quyết phần còn lại ("tự quyết hết đừng hỏi gì nữa làm toàn bộ đi", 18/10/2026).
- **Date**: 2026-10-19
- **Deciders**: Chủ sở hữu dự án (D1–D12); các mặc định tự quyết ghi ở mục cuối, đổi được khi người dùng duyệt lại.

## Context

Một ứng dụng Next.js vừa vẽ trang vừa giữ CSDL, Redis, ClamAV, uploads, migrate, worker outbox và cron. Module agent sắp tới cần chạy việc nền dài (gọi gateway, xử lý tệp) có thử lại, giới hạn thời gian và dấu vết, không chặn request. Trang chỉ cần dữ liệu đã kiểm quyền; giữ bí mật server và quyền vào CSDL trong tiến trình vẽ trang làm bề mặt rủi ro lớn hơn cần thiết. Outbox hiện có thiếu cơ chế thu hồi: worker chết giữa chừng để lại sự kiện `PROCESSING` mãi mãi.

## Decision

1. **Hai ứng dụng, ba package (D1, D2).** npm workspaces: `apps/web` (`@qcet/web`), `apps/api` (`@qcet/api`), `packages/contracts`, `packages/shared`, `packages/db`. Chia file theo import đo được: jwt-session ở api; tên cookie và kiểu phiên ở `@qcet/contracts/session`. Lint chặn import chéo hai app, module server trong web, Prisma trong route handler, package import app, `@qcet/db` trong shared/contracts.
2. **Giữ route handler của Next (D3).** API vẫn là App Router `/api/*` trong `apps/api`; không đổi framework, URL hay định dạng lỗi (ADR-007).
3. **Phiên và middleware (D4).** Web hỏi `GET /api/auth/me` (`getWebSession`). Middleware web chỉ kiểm có cookie phiên, gắn `x-request-id`, giữ các chuyển hướng giao diện và cho `/api` đi qua. Middleware api giữ toàn bộ logic `/api`.
4. **Dữ liệu trang qua API (D5).** Năm trang có dữ liệu ban đầu đọc `GET /api/page-data/{tasks, tasks/[id], calendar, meetings/[id], dossiers/[id]}` bằng `serverApiFetch`, cùng service và kiểm quyền như trước. Ngày là chuỗi ISO, schema Zod ở `@qcet/contracts/page-data`, 401/403/404 giữ nguyên.
5. **Cùng tên miền (D6).** Trình duyệt gọi `/api` cùng host. Production: cloudflared đặt rule `path: ^/api(/|$)` tới `qcet-api:3000` trước rule `qcet-web:3000` cho cả 3 hostname. Gọi thẳng vào web (dev, dự phòng): `rewrites` `/api/:path*` tới `API_INTERNAL_URL` (chốt khi build), `experimental.proxyTimeout` 340 s (> `maxDuration` 330 s của chat, ADR-009).
6. **Chỉ api chạm hạ tầng (D7).** CSDL, Redis, ClamAV, uploads, migrate, worker, cron chỉ trong `qcet-api`, đúng một bản (container_name cố định). Web không có `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL` (lệnh đo trong đặc tả = 0).
7. **Quay lại (D8).** `docs/operations/split-rollback.md`; không xóa image `qcet-eoffice-app:latest`, container cũ giữ tới khi ổn định.
8. **Việc nền của agent chạy trên outbox (D9).** Không thêm hàng đợi (pg-boss, BullMQ):
   - `enqueueAgentJob(tx, { type, payload, idempotencyKey, actorId })` ghi `eventType = AGENT_JOB_<type>`, `aggregateType = AgentJob`, `aggregateId = idempotencyKey` trong transaction của thao tác gây ra nó. Id tất định `ajob_<sha256(type, key)>`; ghi bằng `createMany … skipDuplicates` (ON CONFLICT DO NOTHING) nên ghi trùng trả `created: false` mà không làm hỏng transaction. Payload đã lưu không đổi khi ghi trùng.
   - `AGENT_JOB_HANDLERS` (bọc bởi `defineAgentJobHandlers`) gộp vào `OUTBOX_HANDLERS`. Handler nhận `{ id, type, payload, actorId, idempotencyKey, attempt, signal, client }`; `signal` hủy sau `AGENT_JOB_TIMEOUT_MS` (mặc định 5 phút) và outbox nhận lỗi `AgentJobTimeoutError` ngay cả khi handler không dừng.
   - Mỗi lần chạy ghi một `AuditEvent` (`AGENT_JOB_COMPLETED` / `AGENT_JOB_FAILED`, `entityType = AgentJob`, `entityId` = id việc) với `jobType`, `idempotencyKey`, `attempt`, `durationMs`, `outcome` (`completed`/`error`/`timeout`), lỗi rút gọn 500 ký tự; không ghi payload.
   - Thử lại, lùi lịch, dead letter theo outbox (`MAX_RETRIES` 5). Loại việc chưa có handler giữ `PENDING` như mọi sự kiện outbox. Hiện chưa đăng ký loại nào: đây là nền cho module agent.
9. **Lease của outbox (D12, tự quyết chi tiết).** Migration duy nhất: cột `outbox_events.locked_at` timestamptz cho phép null. Nhận sự kiện ghi `locked_at`, kết thúc (COMPLETED, FAILED, lùi lịch) xóa nó. Đầu mỗi vòng worker, `recoverExpiredOutboxLeases` trả sự kiện `PROCESSING` có `locked_at` cũ hơn `OUTBOX_LEASE_MS` (mặc định 10 phút) về `PENDING`, tính là một lần thử và ghi `last_error`; lần thu hồi chạm giới hạn thì `FAILED` (không lặp mãi khi handler làm sập tiến trình). Dòng `PROCESSING` không có `locked_at` (do bản trước nhận) được coi là quá hạn khi `available_at` đã cũ hơn hạn lease. Chạy theo id (`runOutboxCycle({ ids })`) chỉ thu hồi các id đó. Không thêm chỉ mục: số dòng `PROCESSING` nhỏ và chỉ mục `(status, available_at)` có sẵn đã lọc theo trạng thái. Chu kỳ quét đọc `OUTBOX_POLL_INTERVAL_MS` (mặc định 60 s). Worker cảnh báo khi lease không dài hơn timeout của việc agent.
10. **Hoãn pgvector (D10).** Không thêm extension hay cột vector trong đợt này.
11. **Việc của chủ sở hữu (D11), chưa làm:** bật PITR cho PostgreSQL; quyết định PgBouncer (khi có nhiều tiến trình nối CSDL); DPIA/hồ sơ xử lý dữ liệu cá nhân cho module agent; chốt địa chỉ gateway agent cho production; lộ trình Prisma 7.

## Alternatives Considered

1. **Tách thành API riêng (Express/Fastify) hoặc viết lại route.** Bị bác (D3): đổi framework và mọi route, rủi ro hành vi lớn; route handler của Next đáp ứng được.
2. **Trang đọc CSDL trực tiếp qua `@qcet/db` trong web.** Bị bác: web giữ bí mật server và quyền vào CSDL, đúng điều cần bỏ.
3. **Hàng đợi riêng (pg-boss, BullMQ/Redis).** Bị bác cho giai đoạn này: thêm hạ tầng và một nơi lưu trạng thái thứ hai; outbox đã có giao dịch nguyên tử, thử lại, dead letter và nay có lease.
4. **Khóa idempotency bằng cột/unique index mới.** Bị bác (D12 chỉ cho một migration): id tất định từ loại + khóa đạt cùng hiệu quả nhờ khóa chính.
5. **Thu hồi bằng heartbeat định kỳ trong handler.** Bị bác: thêm ghi CSDL liên tục; một bản api duy nhất và timeout cứng của việc agent đủ để chọn lease tĩnh.

## Consequences

### Tích cực
- Web không giữ bí mật server, không nối CSDL; lỗi ở trang không chạm hạ tầng.
- Module agent có làn việc nền nguyên tử với thao tác gốc, chống trùng, có giới hạn thời gian và dấu vết audit.
- Sự kiện kẹt sau khi worker chết tự trở lại hàng đợi.

### Tiêu cực
- Mỗi lần vẽ trang thêm 1–2 lời gọi HTTP nội bộ (auth/me, runtime-config, page-data).
- Rewrite chốt khi build: đổi địa chỉ api phải build lại image web. Web production bắt buộc `API_INTERNAL_URL`.
- Gọi thẳng web không qua tunnel thì XFF do web thêm (địa chỉ client theo web); rate limit chưa đăng nhập vẫn theo phần tử đầu XFF như trước.
- Hai tiến trình dev (`scripts/dev.mjs`) và hai image để build.
- Việc agent quá thời gian mà handler bỏ qua `signal` vẫn chạy nền tới khi tự xong; outbox đã ghi lỗi và có thể thử lại song song. Handler phải truyền `signal` xuống fetch/gateway.
- Lần thu hồi lease tính một lần thử: việc bị gián đoạn do khởi động lại tốn một lượt.

### Đã đo
- Proxy rewrite giữ path/query, cookie, Origin, `sec-fetch-site`, XFF, `x-forwarded-proto`; `x-forwarded-host` = Host gốc; thân 11 MB; stream ndjson không gom; 302 + Set-Cookie. CSRF qua rewrite: cùng origin qua, cross-site 403.
- Bản standalone chạy theo bố cục image; `cloudflared tunnel ingress validate` OK; `docker compose config` hợp lệ. Chưa chạy `docker build` (máy dev tắt Docker).
- Migration: `db:migrate:test-fresh`, `db:migrate:test-upgrade`, `db:drift:check` trên schema tạm đều sạch.

## Evidence

| Bằng chứng | File | Mô tả |
|------------|------|-------|
| Lease | `packages/db/src/outbox.ts`; `packages/db/prisma/migrations/20261019090000_outbox_locked_at` | `recoverExpiredOutboxLeases`, claim ghi `lockedAt` |
| Worker | `apps/api/src/server/outbox/outbox-worker.ts` | `outboxWorkerConfig`, thu hồi đầu vòng, gộp `AGENT_JOB_HANDLERS` |
| Việc agent | `apps/api/src/server/outbox/agent-jobs.ts` | `enqueueAgentJob`, `defineAgentJobHandlers`, `AgentJobTimeoutError` |
| Audit | `packages/db/src/audit.ts` | `AGENT_JOB_COMPLETED`, `AGENT_JOB_FAILED`, `AuditEntityType.AGENT_JOB` |
| Kiểm thử | `tests/outbox-lease.test.ts`; `apps/api/tests/agent-jobs.test.ts` | lease, thu hồi, dead letter, idempotency, rollback, timeout, audit, cấu hình env |
| Triển khai | `apps/{web,api}/Dockerfile`; `docker-compose.yml`; `cloudflared.yml`; `docs/operations/split-rollback.md` | hai dịch vụ, rule `/api`, quay lại |

## Related ADRs

- [ADR-007](ADR-007-rest-api-standard-rfc9457.md): định dạng lỗi giữ nguyên qua api.
- [ADR-009](ADR-009-assistant-read-only-tools.md): `maxDuration` 330 s của chat quyết định `proxyTimeout`.
