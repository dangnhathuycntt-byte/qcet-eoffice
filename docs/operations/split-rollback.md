# Tách web/api: triển khai và quay lại

Áp dụng cho lần chuyển từ một container `qcet-eoffice-app` sang hai container `qcet-eoffice-web` và `qcet-eoffice-api`
(nhánh `refactor/split-apps`). Nguyên tắc chung giữ như [rollback.md](rollback.md): quay lại bằng image cũ đã kiểm,
không hạ CSDL khi đang có sự cố.

## 1. Thay đổi so với bản một ứng dụng

| | Trước | Sau |
|---|---|---|
| Dịch vụ compose | `qcet-app` (container `qcet-eoffice-app`, image `qcet-eoffice-app:latest`) | `qcet-api` (`qcet-eoffice-api`, `qcet-eoffice-api:latest`) và `qcet-web` (`qcet-eoffice-web`, `qcet-eoffice-web:latest`) |
| Dockerfile | `Dockerfile` ở gốc | `apps/api/Dockerfile`, `apps/web/Dockerfile` (build từ gốc repo) |
| Migrate, worker outbox/quét tệp, cron, uploads, Redis, ClamAV | trong `qcet-app` | chỉ trong `qcet-api`, đúng một bản |
| Cổng host `127.0.0.1:${PORT:-3001}` | `qcet-app` | `qcet-web` (`/api` gọi vào cổng này được web chuyển tiếp tới api) |
| Tunnel | mọi đường dẫn tới `qcet-app:3000` | `^/api(/|$)` tới `qcet-api:3000`, còn lại tới `qcet-web:3000`, cho cả 3 hostname |
| Biến môi trường mới | | không có biến bắt buộc mới trong `.env.production`; compose tự đặt `API_INTERNAL_URL=http://qcet-api:3000` và `SERVICE_NAME` |
| CSDL | | một migration cộng thêm: cột `outbox_events.locked_at` (timestamptz, cho phép null) và chỉ mục, để thu hồi sự kiện kẹt ở `PROCESSING` |

Workflow vận hành (`migrate-production`, `host-diagnostics`, `db-inspect`, `file-object-expand`, `backfill-*`, `start-clamav`)
nay ghim container `qcet-eoffice-api`.

## 2. Trước khi triển khai

Trên máy chủ, trong thư mục compose:

```sh
git rev-parse HEAD > ~/qcet-pre-split.rev            # commit đang chạy, dùng khi quay lại
docker image inspect qcet-eoffice-app:latest --format '{{.Id}}' > ~/qcet-pre-split.image
docker tag qcet-eoffice-app:latest qcet-eoffice-app:pre-split   # giữ image cũ dưới tên cố định
```

- Sao lưu CSDL theo quy trình hiện hành ([recovery-paths.md](recovery-paths.md)) trước khi chạy migration.
- Không xóa image `qcet-eoffice-app:latest`/`:pre-split`, container `qcet-eoffice-app` và các volume cho tới khi bản mới chạy ổn định.

## 3. Triển khai

```sh
git pull                                              # lấy commit đã duyệt
docker compose build qcet-api qcet-web                # bản cũ vẫn phục vụ trong lúc build
docker stop qcet-eoffice-app                          # giải phóng cổng 3001; GIỮ container để quay lại
docker compose up -d qcet-api                         # chạy prisma migrate deploy rồi khởi động; chờ healthy
docker compose ps qcet-api
docker compose up -d qcet-web
docker compose up -d --force-recreate qcet-tunnel     # nạp cloudflared.yml mới
```

Không dùng `--remove-orphans` cho tới khi quyết định bỏ hẳn bản cũ (lệnh này xóa container `qcet-eoffice-app`).

## 4. Kiểm sau triển khai

1. Tunnel: `https://<hostname>/api/health` trả 200; trang `/login` mở được. Kiểm rule cục bộ:
   `cloudflared tunnel --config cloudflared.yml ingress rule https://qcet.dixxie.store/api/health` (khớp `qcet-api`).
2. Kiểm tay bằng script (cookie phiên lấy từ trình duyệt đã đăng nhập Google; script không in cookie):

   ```sh
   QCET_SMOKE_COOKIE='__Secure-authjs.session-token=…' \
     node scripts/smoke-split.mjs --base https://qcet.dixxie.store --write --chat
   ```

   Kiểm: trang đăng nhập, `/api/health`, Auth.js providers, `/api/auth/me`, trang `/tasks`, tạo nhiệm vụ `[SMOKE]…`,
   tải tệp, tải lại, lưu trữ nhiệm vụ, một lượt Trợ lý với sự kiện stream tới rải theo thời gian (không bị gom).
3. Log: `docker logs qcet-eoffice-api 2>&1 | grep '"service":"qcet-api"' | tail` và tương tự cho web.
4. Worker: chỉ `qcet-eoffice-api` ghi log outbox/quét tệp; `docker compose ps` chỉ có một `qcet-api`.

## 5. Quay lại bản một ứng dụng

Mục tiêu dưới 5 phút. Không cần build lại: dùng container/image cũ.

```sh
docker compose stop qcet-web qcet-api                 # dừng bản mới (không xóa)
git show "$(cat ~/qcet-pre-split.rev)":cloudflared.yml > cloudflared.yml   # cấu hình tunnel cũ (tới qcet-app:3000)
docker start qcet-eoffice-app                         # container cũ còn trong mạng qcet-network, tên dịch vụ qcet-app
docker restart qcet-eoffice-tunnel
```

Nếu container cũ đã bị xóa: lấy lại `docker-compose.yml` và `cloudflared.yml` của commit cũ rồi chạy image cũ, không build:

```sh
git show "$(cat ~/qcet-pre-split.rev)":docker-compose.yml > /tmp/compose.pre-split.yml
git show "$(cat ~/qcet-pre-split.rev)":cloudflared.yml > cloudflared.yml
docker tag qcet-eoffice-app:pre-split qcet-eoffice-app:latest
docker compose -f /tmp/compose.pre-split.yml --project-directory . up -d --no-build qcet-app qcet-tunnel
```

### CSDL khi quay lại

- Không hạ migration. Cột `outbox_events.locked_at` chỉ cộng thêm và cho phép null; bản cũ (Prisma chọn cột tường minh) bỏ qua nó.
- Sự kiện đang `PROCESSING` lúc dừng `qcet-api` sẽ không được bản cũ thu hồi (bản cũ không có lease). Trước khi bật bản cũ:

  ```sql
  UPDATE outbox_events SET status = 'PENDING', locked_at = NULL WHERE status = 'PROCESSING';
  ```

- Việc nền của agent (`eventType` bắt đầu bằng `AGENT_JOB_`) không có handler ở bản cũ; worker cũ chỉ lấy loại sự kiện nó có handler
  nên các dòng này nằm yên ở `PENDING` và chạy tiếp khi bật lại bản mới. Muốn hủy hẳn thì đánh dấu `FAILED` có ghi `last_error`.

## 6. Bỏ hẳn bản cũ (sau khi ổn định)

```sh
docker compose up -d --remove-orphans                 # xóa container qcet-eoffice-app
```

Giữ image `qcet-eoffice-app:pre-split` thêm ít nhất một chu kỳ phát hành.

## 7. Chưa cập nhật theo cấu trúc mới

- `iis/` và `vercel.json` vẫn mô tả một ứng dụng (ngoài phạm vi đợt tách).
- Mục 4 của [deployment.md](deployment.md) (lệnh `docker run` một container) là tài liệu cũ; dùng tài liệu này cho compose hai dịch vụ.
