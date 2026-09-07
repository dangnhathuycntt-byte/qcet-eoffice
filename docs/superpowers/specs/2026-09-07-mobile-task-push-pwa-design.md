# Thiết Kế Chi Tiết: Hệ Thống Web Push Notification PWA & Điều Hành Công Việc Di Động (Senior-Friendly)

- **Mã tài liệu:** QCET-SPEC-2026-09-07-PUSH-PWA
- **Dự án:** QCET E-Office
- **Trạng thái:** Bản thảo hoàn thiện (Final Comprehensive Spec)
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
     - Trong khối `after()`: Gọi `sendPushNotificationToUser(assigneeId, { title: "[GIAO VIỆC] " + task.title, body: "...", linkHref: "/?zone=tasks&taskId=..." })`.
2. **Nộp báo cáo kết quả (`POST /api/tasks/[id]/deliverables`):**
   - Khi cán bộ nộp kết quả:
     - Báo cho người giao việc / Trưởng phòng: *"[NỘP KẾT QUẢ] [Tên cán bộ] vừa nộp kết quả công việc [Tên việc]"*.
3. **Phê duyệt kết quả (`PATCH /api/tasks/[id]/deliverables`):**
   - Khi lãnh đạo duyệt:
     - Báo cho cán bộ thực hiện: *"[ĐÃ DUYỆT] B��o cáo kết quả [Tên việc] đã được Phê duyệt (hoặc [YÊU CẦU SỬA])"*.
4. **Chỉ đạo điều hành BGH (`POST /api/executive/resolutions`):**
   - Bắn thông báo khẩn `[HỎA TỐC] Chỉ đạo điều hành BGH` đến các Trưởng phòng/Trưởng khoa của đơn vị nhận chỉ đạo.

---

## 5. Quy Chuẩn Hiển Thị Trên Màn Hình Khóa & Ngôn Ngữ Hành Chính (Copywriting Matrix)

### 5.1. Giới hạn hiển thị trên Màn hình khóa (Lock Screen Budget)
- **Tiêu đề (Title):** Tối đa **35 ký tự** (đảm bảo không bị cắt chữ `...` trên màn hình khóa iPhone/Android).
- **Nội dung (Body):** Tối đa **85 - 90 ký tự** (hiển thị trọn vẹn trong 2 dòng, dễ đọc trong 3 giây cho Thầy/Cô lớn tuổi).
- **Rich Media & Nút bấm trên iOS:** iOS WebKit không hỗ trợ ảnh đính kèm hoặc nút phụ trong push; toàn bộ thông điệp cốt lõi phải nằm ở `title` và `body`.

### 5.2. Công thức câu từ hành chính chuẩn mực (Vietnamese Copywriting Matrix)
* **Cấu trúc Tiêu đề:** `[TAG] + [Tên nhiệm vụ rút gọn]`
* **Cấu trúc Nội dung:** `[Chủ thể giao/thực hiện] → [Hành động] • [Hạn chót / Trạng thái]`

| Sự kiện nghiệp vụ | Tiêu đề mẫu (<= 35 ký tự) | Nội dung mẫu (<= 90 ký tự) |
| :--- | :--- | :--- |
| **Giao việc mới** | `[GIAO VIỆC] Tuyển sinh ĐH 2026` | `BGH giao nhiệm vụ • Hạn chót: 17h00 15/09 • Chạm để xem` |
| **Nộp kết quả** | `[NỘP KẾT QUẢ] Đề án mở ngành CNTT` | `TS. Nguyễn Văn A vừa nộp báo cáo kết quả • Chờ Trưởng phòng duyệt` |
| **Phê duyệt kết quả** | `[ĐÃ DUYỆT] Kế hoạch thực tập` | `Hiệu trưởng đã phê duyệt kết quả nhiệm vụ của đồng chí` |
| **Yêu cầu chỉnh sửa** | `[YÊU CẦU SỬA] Báo cáo tài chính` | `Trưởng phòng yêu cầu bổ sung chứng từ số liệu trước 12h00` |
| **Nhắc hạn (24h)** | `[SẮP HẾT HẠN] Khảo sát việc làm` | `Còn 24 giờ để nộp báo cáo • Hạn: 17h00 ngày mai` |
| **Chỉ đạo khẩn BGH** | `[HỎA TỐC] Chỉ đạo phòng Đào tạo` | `Hiệu trưởng ban hành chỉ đạo khẩn về công tác thanh tra` |

---

## 6. Thiết Kế PWA Manifest & Icon Chống Lỗi Hiển Thị

### 6.1. Cấu hình `src/app/manifest.ts` (Next.js 15 App Router Type-Safe)
Sử dụng chuẩn `manifest.ts` của Next.js 15:
- `display: 'standalone'`
- `start_url: '/portal'`
- `theme_color: '#1e3a8a'` (Màu xanh chủ đạo QCET)
- `background_color: '#ffffff'`

### 6.2. Quy chuẩn Apple Touch Icon (`public/apple-touch-icon.png` & `src/app/apple-icon.png`)
- Kích thước nghiêm ngặt: **180x180 px**, PNG 24-bit.
- **Tuyệt đối không dùng nền trong suốt (Zero Transparency):** Nền phải đổ đặc 100% (Màu xanh thương hiệu QCET `#1e3a8a` hoặc màu trắng `#ffffff`) để tránh iPhone hiển thị nền đen xì hoặc viền xám xấu.
- **Không tự bo tròn góc:** Phải giữ hình vuông phẳng 90 độ; iOS sẽ tự động áp dụng mặt nạ bo góc (squircle).
- **Vùng an toàn (Safe Zone):** Biểu tượng logo QCET nằm trong vùng vuông **130x130 px** ở chính giữa, cách viền 25px để không bị Apple cắt mép.

### 6.3. Quy chuẩn Android Maskable Icon (`public/icons/icon-maskable-512x512.png`)
- Kích thước: **512x512 px**.
- Vùng an toàn hình tròn đường kính **409.6 px** (80% tâm hình) để hiển thị trọn vẹn trên mọi giao diện Samsung One UI, Xiaomi HyperOS, Google Pixel.

---

## 7. Thiết Kế Client & Trải Nghiệm Người Lớn Tuổi (Senior UX)

### 7.1. Service Worker (`public/sw.js`)
Service Worker xử lý 2 sự kiện chính:
1. **Sự kiện `push`:**
   - Trích xuất JSON payload `{ title, body, icon, data: { linkHref }, tag }`.
   - Cập nhật số đếm badge icon bằng `navigator.setAppBadge(count)` n���u trình duyệt hỗ trợ.
   - Hiển thị thông báo với logo trường QCET:
     ```javascript
     self.registration.showNotification(data.title, {
       body: data.body,
       icon: '/icons/icon-192x192.png',
       badge: '/icons/badge-72x72.png',
       data: { linkHref: data.linkHref || '/?zone=tasks' },
       tag: data.tag || 'qcet-task-alert',
       renotify: true,
     });
     ```
2. **Sự kiện `notificationclick`:**
   - Đóng notification.
   - Duyệt qua các cửa sổ (`clients.matchAll`). Nếu app đang mở, focus vào tab và điều hướng (`navigate(linkHref)`). Nếu app đang đóng, gọi `clients.openWindow(linkHref)`.

### 7.2. React Hook: `usePWAInstall` (`src/hooks/use-pwa-install.ts`)
- Lắng nghe `beforeinstallprompt` trên Android/Chromium.
- Cung cấp hàm `installApp()` thực thi 1-click install.
- Lắng nghe `appinstalled` để tự động ẩn nút cài đặt.
- Cung cấp cờ `isIOS`, `isStandalone`, `isInstallable`.

### 7.3. React Hook: `usePushNotification` (`src/hooks/use-push-notification.ts`)
- Kiểm tra quyền hiện tại (`Notification.permission`).
- Cung cấp hàm `subscribeToPush()`, `unsubscribeFromPush()`, `sendTestNotification()`.

### 7.4. Giao diện "Trợ Lý Kích Hoạt Thông Báo" (`PushOnboardingSheet.tsx`)
Dạng Bottom Sheet mở lên ở cạnh dưới màn hình:
1. **Thiết kế thân thiện cho người lớn tuổi:**
   - Cỡ chữ tiêu đề 20px, nội dung 16px, tương phản cao.
   - Nút hành động chính kích thước 52px, dễ bấm trúng bằng một tay.
2. **Trường hợp 1 - Android (1-Click):**
   - Tiêu đề: *"Cài đặt QCET E-Office lên điện thoại"*
   - Nút bấm: **[CÀI ĐẶT NGAY BẰNG 1-CHẠM]** (Kích hoạt `installApp()`).
3. **Trường hợp 2 - iPhone / iOS Safari (Hướng dẫn 3 bước):**
   - Khung hình minh họa kèm mũi tên trỏ xuống thanh Safari:
     - **Bước 1:** Bấm nút **Chia sẻ** (ô vuông có mũi tên ở thanh dưới Safari).
     - **Bước 2:** Chọn **"Thêm vào MH chính"** (icon dấu `+`).
     - **Bước 3:** Bấm **"Thêm"** ở góc phải trên.
4. **Trường hợp 3 - Đã ở trên PWA (Đã mở từ màn hình chính):**
   - Xuất hiện Soft Prompt:
     - Tiêu đề: *"Bật chuông thông báo công việc"*
     - Mô tả: *"Nhận chuông và rung thông báo ngay trên màn hình khóa khi có việc BGH giao hoặc hồ sơ cần duyệt."*
     - Nút: **[BẬT THÔNG BÁO NGAY]** và **[ĐỂ SAU 7 NGÀY]**.

### 7.5. Quản lý trạng thái trong Menu Di Động (`MobileMenuDrawer.tsx`)
- Thêm mục riêng: **"Thông báo điện thoại"**.
- Nút gạt Switch lớn kèm trạng thái xanh: `Đang hoạt động (Nhận chuông khi có việc mới)`.
- Nút bấm phụ: `[🔔 Thử chuông ngay]` (gửi 1 tin test để kiểm tra rung/chuông).

### 7.6. Tạm ẩn phân hệ Văn bản (Đang phát triển)
- **Topbar, Sidebar & Mobile Bottom Nav:**
  - Mục `Văn bản` gắn kèm Badge:
    ```tsx
    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
      Đang phát triển
    </Badge>
    ```
- **Trang `/documents`:**
  - Landing thông báo: *"Phân hệ Quản lý Văn bản đang được số hóa & nâng cấp. Hiện tại hệ thống đang ưu tiên phục vụ Phân hệ Quản lý & Điều hành Công việc."*
  - Nút bấm: **[QUAY VỀ BÀN LÀM VIỆC CÔNG VIỆC]**.

---

## 8. Chiến Lược Kiểm Thử (Testing & Quality Assurance)

Tuân thủ nghiêm ngặt Engineering Rules trong `CLAUDE.md`:
1. **Kiểm thử Service & Backend (`tests/push-service.test.ts`):**
   - Kiểm tra mã hóa VAPID và xử lý mã lỗi 410/404 tự động đổi trạng thái `REVOKED`.
2. **Kiểm thử API Endpoints (`tests/api-notifications-push.test.ts`):**
   - Kiểm tra đăng ký, hủy đăng ký và gửi tin push test.
3. **Kiểm thử Hook & UI Logic (`tests/pwa-install-push.test.ts`):**
   - Kiểm tra phát hiện iOS Standalone, bắt sự kiện `beforeinstallprompt`, và hiển thị Badge "Đang phát triển".
4. **Quy chuẩn chất lượng:**
   - `npm run typecheck` đạt 0 lỗi.
   - `npm test` đạt 100% pass.
