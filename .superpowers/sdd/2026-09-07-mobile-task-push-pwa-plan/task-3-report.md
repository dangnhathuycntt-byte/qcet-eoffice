# Báo Cáo Thực Hiện Task 3: API Endpoints Cho Push & Thông Báo

## 1. Mục Tiêu & Phạm Vi Công Việc
Xây dựng toàn bộ hệ thống API endpoints chuyên trách quản lý khóa VAPID, đăng ký / hủy đăng ký nhận thông báo đẩy qua Service Worker (PWA Web Push), gửi thử nghiệm thông báo chuông/rung, và truy vấn / cập nhật trạng thái thông báo in-app phục vụ trung tâm thông báo.

## 2. Danh Sách Routes Đã Triển Khai
Tất cả các route đều định nghĩa:
- `export const runtime = 'nodejs';`
- `export const dynamic = 'force-dynamic';`
- Xác thực phiên làm việc qua JWT Token (hỗ trợ cả Cookie `qcet_session` và header `Authorization: Bearer <token>`).

1. `src/app/api/notifications/push/key/route.ts`:
   - `GET`: Trả về `{ success: true, publicKey: getVapidPublicKey() }`.
2. `src/app/api/notifications/push/subscribe/route.ts`:
   - `POST`: Xác thực người dùng (401 nếu chưa đăng nhập). Kiểm tra dữ liệu bắt buộc (`endpoint`, `p256dh`, `auth`). Upsert vào `prisma.pushSubscription` theo `endpoint` duy nhất: kích hoạt lại trạng thái `ACTIVE`, đặt `failureCount = 0`, cập nhật `userAgent`, `deviceType`, và `updatedAt`.
   - `DELETE`: Xác thực người dùng. Nhận `{ endpoint }` và chuyển trạng thái thiết bị thành `REVOKED`.
3. `src/app/api/notifications/push/test/route.ts`:
   - `POST`: Xác thực người dùng. Định dạng payload thông báo theo tiêu chuẩn tiếng Việt (ngân sách ký tự tiêu đề <= 35, nội dung <= 90), tạo bản ghi `Notification` trong cơ sở dữ liệu và gửi thông báo đẩy đến tất cả thiết bị `ACTIVE` của người dùng qua `sendPushNotificationToUser()`.
4. `src/app/api/notifications/route.ts`:
   - `GET`: Xác thực người dùng. Lấy danh sách thông báo của `session.id` (`take: limit` hoặc 50, sắp xếp theo thời gian tạo mới nhất). Đếm số lượng chưa đọc (`isRead: false`). Hỗ trợ bộ lọc `unreadOnly=true` và `category`.
   - `PATCH`: Đánh dấu tất cả thông báo của người dùng là đã đọc (`isRead: true`, `readAt: now`).
5. `src/app/api/notifications/[id]/read/route.ts`:
   - `PATCH`: Xác thực người dùng và kiểm tra quyền sở hữu thông báo (`userId === session.id`). Cập nhật `isRead: true` và `readAt: new Date()`.
6. `src/app/api/notifications/read-all/route.ts`:
   - `POST`: Hỗ trợ đánh dấu toàn bộ thông báo của người dùng hiện tại là đã đọc.

## 3. Cập Nhật Thư Viện Hỗ Trợ
- Bổ sung hàm tiện ích `getSessionFromRequest(request)` trong `src/lib/jwt-session.ts` để trích xuất và giải mã phiên JWT đồng nhất từ cả cookie NextRequest, raw cookie header, và Authorization Bearer header.

## 4. Kết Quả Kiểm Thử (Unit & Integration Tests)
- File kiểm thử: `tests/api-notifications-push.test.ts`
- Tổng số test case: 17/17 tests PASS (100%)
  - `GET /api/notifications/push/key`: Trả về 200 và VAPID public key hợp lệ.
  - `POST /api/notifications/push/subscribe`: Trả về 401 khi thiếu auth; trả về 400 khi thiếu trường; upsert thành công và không tạo bản ghi trùng lặp khi đăng ký nhiều lần.
  - `DELETE /api/notifications/push/subscribe`: Trả về 401 khi thiếu auth; chuyển trạng thái `REVOKED` thành công.
  - `POST /api/notifications/push/test`: Trả về 401 khi thiếu auth; gửi push test và lưu bản ghi in-app notification thành công.
  - `GET /api/notifications`: Trả về danh sách thông báo, đúng số lượng unreadCount, cô lập hoàn toàn giữa các user, hỗ trợ lọc `unreadOnly`.
  - `PATCH /api/notifications/[id]/read`: Cập nhật trạng thái đọc của 1 thông báo; từ chối (404) nếu thông báo thuộc về user khác.
  - `PATCH /api/notifications` & `POST /api/notifications/read-all`: Đánh dấu đã đọc tất cả thông báo của người dùng.
- TypeScript check (`npm run typecheck`): 0 lỗi.
