# Thiết Kế Chi Tiết: Hệ Thống Web Push Notification PWA & Điều Hành Công Việc Di Động (Senior-Friendly)

- **Mã tài liệu:** QCET-SPEC-2026-09-07-PUSH-PWA
- **Dự án:** QCET E-Office
- **Trạng thái:** Bản thảo đề xuất (Draft Proposal)
- **Tác giả:** Đội ngũ Kiến trúc Hệ thống QCET & Antigravity
- **Phân loại kiến trúc:** Architectural Specification

---

## 1. Bối Cảnh & Mục Tiêu (Context & Objectives)

### 1.1. Bối cảnh nghiệp vụ
Hệ thống QCET E-Office phục vụ Ban Giám hiệu (BGH), Trưởng các Đơn vị/Phòng/Khoa, và đội ngũ Cán bộ - Giảng viên. Phần lớn nhân sự quản lý cấp cao là Thầy/Cô lớn tuổi, có thói quen sử dụng điện thoại thông minh (iPhone hoặc Android) nhưng:
- Thường tắt trình duyệt sau khi tra cứu xong.
- Rất ngại cài đặt ứng dụng phức tạp qua kho ứng dụng App Store / Google Play hoặc các bước cấu hình bảo mật rườm rà.
- Đòi hỏi thông báo phải đến **ngay trên màn hình khóa (Lock Screen)** như tin nhắn Zalo/SMS khi có nhiệm vụ khẩn, giao việc mới, hoặc hồ sơ trình duyệt.

### 1.2. Quyết định định hướng kiến trúc
- **Tập trung phân hệ Quản lý & Điều hành Công việc:** Tạm ẩn phân hệ Quản lý Văn bản (gắn nhãn badge `"Đang phát triển"`) để dồn toàn bộ nguồn lực trải nghiệm cho luồng giao nhận, xử lý, và phê duyệt công việc.
- **Không dùng Native App riêng biệt (React Native/Capacitor):** Giữ nguyên kiến trúc Next.js 15 PWA nhẹ nhàng, tuân thủ nghiêm ngặt Apple Human Interface Guidelines (HIG) và W3C Web Push Standards.
- **Trải nghiệm kích hoạt thân thiện tối đa với người lớn tuổi:**
  - **Android:** Hỗ trợ cài đặt biểu tượng ra màn hình chính dạng **1-Click** thông qua sự kiện `beforeinstallprompt`.
  - **iPhone (iOS 16.4 - 18+):** Do Apple nghiêm cấm 1-click vì lý do bảo mật, hệ thống cung cấp **Bottom Sheet hướng dẫn 3 bước trực quan** (có biểu tượng và mũi tên nhấp nháy chỉ thẳng vào nút Chia sẻ của Safari).
  - **Cơ chế Soft Prompt 2 bước:** Không bao giờ mở hộp thoại cấp quyền trình duyệt đột ngột; luôn giải thích lợi ích công việc trước bằng tiếng Việt rõ ràng với cỡ chữ lớn ($\ge 16\text{px}$) và nút bấm chuẩn ngón tay cái ($\ge 48\text{px}$).
- **Hiệu năng cao, 0ms trễ phản hồi người dùng:** Áp dụng API `after()` của Next.js 15 để việc đẩy tin Web Push và dọn dẹp token rác chạy ngầm hoàn toàn sau khi API trả kết quả.

---

## 2. Kiến Trúc Tổng Thể (System Architecture)

```
+-----------------------------------------------------------------------------------+
|                            NGƯỜI DÙNG / THIẾT BỊ DI ĐỘNG                         |
|                                                                                   |
|  +---------------------------+                +--------------------------------+  |
|  |     Màn hình khóa /       |                |     Ứng dụng PWA QCET E-Office |  |
|  |  Trung tâm thông báo OS   |                |  - usePWAInstall (1-Click)     |  |
|  |  - Chuông / Rung / Badge  |                |  - PushOnboardingSheet         |  |
|  +-------------^-------------+                |  - MobileMenuDrawer Toggle     |  |
|                |                              +---------------^----------------+  |
+----------------|----------------------------------------------|-------------------+
                 |                                              |
     (Web Push Notification)                            (Subscription Token)
                 |                                              |
+----------------|--------------------+                         |
|      MẠNG PUSH TRUNG GIAN           |                         |
|  - Apple Push Service (APNs cho iOS)|                         |
|  - Google FCM (cho Android/Chrome)  |                         |
+----------------^--------------------+                         |
                 |                                              |
     (Gói tin VAPID mã hóa)                                     |
                 |                                              |
+----------------|----------------------------------------------v-------------------+
|                                 MÁY CHỦ QCET (BACKEND)                            |
|                                                                                   |
|  [ API Routes ]                                                                   |
|   - POST /api/notifications/push/subscribe   <--- Lưu / Hủy token đăng ký         |
|   - POST /api/notifications/push/test        <--- Thử chuông điện thoại           |
|   - GET  /api/notifications                  <--- Lịch sử thông báo in-app        |
|   - POST /api/tasks (Giao việc mới)          \                                    |
|   - POST /api/tasks/[id]/deliverables (Nộp)   +--> Next.js 15 after()             |
|   - PATCH /api/tasks/[id]/deliverables (Duyệt)/    (Bắn Push ngầm 0ms trễ UI)     |
|                                                            |                      |
|  [ Dịch vụ Push & Dọn dẹp: src/lib/push-service.ts ]       |                      |
|   - Mã hóa VAPID (web-push)                                |                      |
|   - Tự động xóa token lỗi 404 / 410 Gone                   v                      |
|                                                   +------------------+            |
|                                                   |  SQLite Database |            |
|                                                   |  - PushSub       |            |
|                                                   |  - Notification  |            |
|                                                   +------------------+            |
+-----------------------------------------------------------------------------------+
```

---

## 3. Thiết Kế Cơ Sở Dữ Liệu (Prisma Schema Updates)

Cập nhật `prisma/schema.prisma` với 2 thực thể mới và liên kết với bảng `User`:

```prisma
// Trạng thái của thiết bị đăng ký
enum PushSubscriptionStatus {
  ACTIVE
  REVOKED
}

// Bảng lưu thông tin thiết bị nhận Push Notification
model PushSubscription {
  id               String                 @id @default(uuid())
  userId           String                 @map("user_id")
  endpoint         String                 @unique
  p256dh           String
  auth             String
  userAgent        String?                @map("user_agent")
  deviceType       String?                @map("device_type") // 'ios-standalone' | 'android' | 'desktop'
  status           PushSubscriptionStatus @default(ACTIVE)
  failureCount     Int                    @default(0) @map("failure_count")
  lastFailureCode  Int?                   @map("last_failure_code")
  createdAt        DateTime               @default(now()) @map("created_at")
  updatedAt        DateTime               @updatedAt @map("updated_at")

  user             User                   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@map("push_subscriptions")
}

// Bảng lưu lịch sử thông báo in-app (chuông và trang /notifications)
model Notification {
  id          String   @id @default(uuid())
  userId      String   @map("user_id")
  actorName   String   @map("actor_name")
  title       String
  body        String
  category    String   @default("task") // 'task' | 'directive' | 'system'
  type        String   // 'assigned' | 'submitted' | 'reviewed' | 'deadline' | 'directive'
  linkHref    String   @map("link_href")
  isRead      Boolean  @default(false) @map("is_read")
  createdAt   DateTime @default(now()) @map("created_at")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}
```

---

## 4. Đặc Tả Dịch Vụ Máy Chủ & API Routes

### 4.1. Thư viện & Biến môi trường
- Thư viện backend: `web-push`
- File môi trường `.env`:
  ```env
  NEXT_PUBLIC_VAPID_PUBLIC_KEY=BH...
  VAPID_PRIVATE_KEY=...
  VAPID_SUBJECT=mailto:admin@qcet.edu.vn
  ```

### 4.2. Dịch vụ gửi Push trung tâm (`src/lib/push-service.ts`)
1. **Khởi tạo VAPID:** Cấu hình VAPID một lần duy nhất.
2. **Hàm `sendPushNotificationToUser(userId, payload)`:**
   - Tìm kiếm toàn bộ `PushSubscription` có trạng thái `ACTIVE` của người dùng.
   - Gửi đồng loạt bằng `Promise.allSettled()`.
   - **Xử lý lỗi tự động (Self-healing):**
     - Nếu nhận HTTP `404 Not Found` hoặc `410 Gone`: Cập nhật `status = REVOKED`, xóa hoặc đánh dấu thiết bị không còn tồn tại.
     - Nếu gặp lỗi mạng tạm thời: Tăng `failureCount`.
3. **Cấu hình độ ưu tiên tin gửi:**
   - Các việc khẩn/hỏa tốc: Thiết lập `headers: { Urgency: "high", TTL: 86400 }`.
   - Thông báo nhắc việc thông thường: `headers: { Urgency: "normal", TTL: 172800 }`.

### 4.3. Danh sách API Endpoints
1. `POST /api/notifications/push/subscribe`
   - **Body:** `{ endpoint, p256dh, auth, deviceType, userAgent }`
   - **Xử lý:** Upsert vào bảng `PushSubscription` theo `endpoint`.
2. `DELETE /api/notifications/push/subscribe`
   - **Body:** `{ endpoint }`
   - **Xử lý:** Đổi `status = REVOKED` hoặc xóa record.
3. `POST /api/notifications/push/test`
   - **Xử lý:** Gửi ngay 1 tin push mẫu đến các thiết bị đang active của user hiện tại để kiểm tra chuông/rung.
4. `GET /api/notifications`
   - **Query:** `?limit=20&unreadOnly=true|false`
   - **Response:** Danh sách thông báo in-app thực tế từ DB kèm `unreadCount`.
5. `PATCH /api/notifications` & `PATCH /api/notifications/[id]/read`
   - Đánh dấu 1 thông báo hoặc tất cả thông báo là đã đọc.

### 4.4. Tích hợp gửi Push vào các sự kiện Quản lý Công việc
Tận dụng API `after()` của Next.js 15 trong các route xử lý công việc:

1. **Giao việc mới (`POST /api/tasks`):**
   - Khi tạo việc và phân công cho `assigneeId`:
     - Tạo bản ghi `Notification` trong DB.
     - Trong khối `after()`: Gọi `sendPushNotificationToUser(assigneeId, { title: "Nhiệm vụ mới", body: "...", linkHref: "/?zone=tasks&taskId=..." })`.
2. **Nộp báo cáo kết quả (`POST /api/tasks/[id]/deliverables`):**
   - Khi cán bộ nộp kết quả:
     - Báo cho người giao việc / Trưởng phòng: *"[Tên cán bộ] vừa nộp kết quả công việc [Tên việc]"*.
3. **Phê duyệt kết quả (`PATCH /api/tasks/[id]/deliverables`):**
   - Khi lãnh đạo duyệt:
     - Báo cho cán bộ thực hiện: *"Báo cáo kết quả [Tên việc] đã được Phê duyệt (hoặc Yêu cầu chỉnh sửa)"*.
4. **Chỉ đạo điều hành BGH (`POST /api/executive/resolutions`):**
   - Bắn thông báo khẩn đến các Trưởng phòng/Trưởng khoa của đơn vị nhận chỉ đạo.

---

## 5. Thiết Kế Client, Service Worker & Trải Nghiệm Người Lớn Tuổi (Senior UX)

### 5.1. Service Worker (`public/sw.js`)
Service Worker xử lý 2 sự kiện chính:
1. **Sự kiện `push`:**
   - Trích xuất JSON payload `{ title, body, icon, data: { linkHref } }`.
   - Cập nhật số đếm badge icon bằng `navigator.setAppBadge(count)` nếu trình duyệt hỗ trợ.
   - Hiển th�� thông báo với logo trường QCET:
     ```javascript
     self.registration.showNotification(data.title, {
       body: data.body,
       icon: '/icons/icon-192.png',
       badge: '/icons/badge-72.png',
       data: { linkHref: data.linkHref || '/?zone=tasks' },
       tag: data.tag || 'qcet-task-alert',
       renotify: true,
     });
     ```
2. **Sự kiện `notificationclick`:**
   - Đóng notification.
   - Duyệt qua các cửa sổ (`clients.matchAll`). Nếu app đang mở, focus vào tab và điều hướng (`navigate(linkHref)`). Nếu app đang đóng, gọi `clients.openWindow(linkHref)`.

### 5.2. React Hook: `usePWAInstall` (`src/hooks/use-pwa-install.ts`)
- Lắng nghe `beforeinstallprompt` trên Android/Chromium.
- Lưu trữ đối tượng prompt tạm thời.
- Cung cấp hàm `installApp()` thực thi 1-click install.
- Lắng nghe sự kiện `appinstalled` để tự động ẩn các banner/nút cài đặt sau khi hoàn tất.
- Phát hiện môi trường iOS (`isIOS`) và chế độ Standalone (`isStandalone`).

### 5.3. React Hook: `usePushNotification` (`src/hooks/use-push-notification.ts`)
- Kiểm tra quyền hiện tại (`Notification.permission`).
- Cung cấp hàm `subscribeToPush()`:
  - Đăng ký Service Worker `/sw.js`.
  - Chuyển đổi VAPID public key (`urlBase64ToUint8Array`).
  - Gọi `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`.
  - Gửi dữ liệu subscription lên API server.
- Cung cấp hàm `unsubscribeFromPush()`.
- Cung cấp hàm `sendTestNotification()`.

### 5.4. Giao diện "Trợ Lý Kích Hoạt Thông Báo" (`PushOnboardingSheet.tsx`)
Dạng Bottom Sheet mở lên ở cạnh dưới màn hình:
1. **Thiết kế thân thiện cho người lớn tuổi:**
   - Cỡ chữ tiêu đề 20px, nội dung 16px, tương phản cao (phù hợp mắt Thầy/Cô lớn tuổi).
   - Nút hành động chính kích thước 52px, dễ bấm trúng bằng một tay.
2. **Trường hợp 1 - Android (1-Click):**
   - Tiêu đề: *"Cài đặt QCET E-Office lên điện thoại"*
   - Mô tả: *"Chỉ cần 1 chạm để nhận thông báo công việc tức thì và mở nhanh mọi lúc."*
   - Nút bấm: **[CÀI ĐẶT NGAY BẰNG 1-CHẠM]** (Kích hoạt `installApp()`).
3. **Trường hợp 2 - iPhone / iOS Safari (Hướng dẫn 3 bước):**
   - Xuất hiện khung hình minh họa rõ nét kèm mũi tên trỏ xuống dưới thanh Safari:
     - **Bước 1:** Bấm nút **Chia sẻ** (biểu tượng ô vuông có mũi tên ở dưới màn hình).
     - **Bước 2:** Chọn mục **"Thêm vào MH chính"** (biểu tượng dấu `+`).
     - **Bước 3:** Bấm **"Thêm"** ở góc phải trên.
4. **Trường hợp 3 - Đã ở trên PWA (Đã mở từ màn hình chính):**
   - Xuất hiện Soft Prompt:
     - Tiêu đề: *"Bật chuông thông báo công việc"*
     - Mô tả: *"Nhận chuông và rung thông báo ngay trên màn hình khóa khi có việc BGH giao hoặc hồ sơ cần duyệt."*
     - Nút: **[BẬT THÔNG BÁO]** và **[ĐỂ SAU 7 NGÀY]**.

### 5.5. Quản lý trạng thái trong Menu Di Động (`MobileMenuDrawer.tsx`)
- Thêm một khối riêng: **"Thông báo điện thoại"**.
- Có nút gạt (Switch) lớn:
  - Khi đang bật: Hiện chấm xanh `Đang hoạt động (Nhận chuông khi có việc mới)`.
  - Kèm nút bấm: `[🔔 Thử chuông ngay]` (gọi API test để Thầy/Cô kiểm tra điện thoại có rung và kêu chuông hay không).
  - Khi gạt tắt: Huỷ đăng ký subscription và chuyển sang chấm xám `Đang tắt`.

### 5.6. Tạm ẩn phân hệ Văn bản (Đang phát triển)
- **Topbar & Sidebar & Mobile Bottom Nav:**
  - Mục `Văn bản` vẫn xuất hiện ở vị trí quen thuộc nhưng gắn kèm Badge:
    ```tsx
    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
      Đang phát triển
    </Badge>
    ```
- **Trang `/documents`:**
  - Hiển thị Landing thông báo lộ trình (Roadmap Notice):
    - Tiêu đề: *"Phân hệ Quản lý Văn bản đang được số hóa & nâng cấp"*
    - Nội dung: *"Hiện tại QCET E-Office đang tập trung tối đa cho phân hệ Quản lý & Điều hành Công việc. Các tính năng Sổ văn bản điện tử và Điều phối văn bản số sẽ sớm ra mắt trong giai đoạn tiếp theo."*
    - Nút bấm điều hướng: **[QUAY VỀ BÀN LÀM VIỆC CÔNG VIỆC]**.

---

## 6. Chiến Lược Kiểm Thử (Testing & Quality Assurance)

Theo đúng quy tắc kỹ thuật trong `CLAUDE.md`, mọi tính năng mới phải có bài kiểm tra tự động trước khi xác nhận:
1. **Kiểm thử Unit & Service (`tests/push-service.test.ts`):**
   - Kiểm tra mã hóa và payload tạo bởi `push-service`.
   - Kiểm tra xử lý phản hồi lỗi 410/404 và tự động đổi trạng thái `REVOKED`.
2. **Kiểm thử API Endpoints (`tests/api-notifications-push.test.ts`):**
   - Kiểm tra đăng ký `POST /api/notifications/push/subscribe` thành công và cập nhật đúng `userId`.
   - Kiểm tra hủy đăng ký `DELETE /api/notifications/push/subscribe`.
   - Kiểm tra endpoint gửi thử `POST /api/notifications/push/test`.
3. **Ki���m thử Hook & UI Logic (`tests/pwa-install-push.test.ts`):**
   - Kiểm tra logic phát hiện iOS Standalone và bắt sự kiện `beforeinstallprompt`.
   - Kiểm tra hiển thị Badge "Đang phát triển" trên trang `/documents` và thanh điều hướng.
4. **Quy chuẩn chất lượng:**
   - Chạy `npm run typecheck` đạt 0 lỗi TypeScript.
   - Chạy `npm test` đạt 100% test pass.

---

## 7. Kế Hoạch Triển Khai (Phasing)

- **Giai đoạn 1 (Backend & DB Core):**
  - Cập nhật Prisma Schema (`PushSubscription`, `Notification`), tạo migration.
  - Cài đặt thư viện `web-push`, tạo helper `push-service.ts` và thiết lập VAPID.
  - Xây dựng các API `/api/notifications/push/*` và `/api/notifications`.
- **Giai đoạn 2 (PWA & Service Worker):**
  - Tạo `public/sw.js` xử lý `push` và `notificationclick`.
  - Viết hooks `usePWAInstall` và `usePushNotification`.
- **Giai đoạn 3 (Senior-Friendly UI & Event Triggers):**
  - Xây dựng component `PushOnboardingSheet` (1-click cho Android, hướng dẫn 3 bước cho iOS).
  - Tích hợp nút gạt và thử chuông vào `MobileMenuDrawer`.
  - Tích hợp hàm gửi push vào các API Task (`POST /api/tasks`, deliverables...).
  - Gắn badge "Đang phát triển" cho phân hệ Văn bản.
- **Giai đoạn 4 (Kiểm thử & Nghiệm thu):**
  - Viết và chạy toàn bộ test suites, typecheck, kiểm tra thực tế trên mobile preview.
