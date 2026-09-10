---
status: completed
domain: architecture
created: 2026-09-07
---

# Kế Hoạch Triển Khai: Hệ Thống Web Push Notification PWA & Điều Hành Công Việc Di Động (Senior-Friendly)

> **Dành cho Agentic Workers:** YÊU CẦU SUB-SKILL: Sử dụng `superpowers:subagent-driven-development` (khuyến nghị) hoặc `superpowers:executing-plans` để thực thi từng nhiệm vụ theo thứ tự. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Xây dựng hệ thống Web Push Notification đạt chuẩn PWA cho QCET E-Office, tối ưu 100% trải nghiệm 1-click và hướng dẫn 3 bước cho Thầy/Cô lớn tuổi trên Android & iOS, phản hồi 0ms trễ với Next.js 15 `after()`, đồng thời tạm ẩn phân hệ Văn bản với nhãn "Đang phát triển" để tập trung tối đa cho phân hệ Công việc.

**Kiến trúc:** 
- Tầng cơ sở dữ liệu: Thêm 2 bảng `PushSubscription` và `Notification` trong Prisma.
- Tầng backend: Thư viện `web-push` xử lý mã hóa VAPID (Node.js runtime bắt buộc `export const runtime = 'nodejs'`), tích hợp hàm chuẩn `after()` của Next.js 15 trong các API nghiệp vụ (`/api/tasks`, `/api/executive/resolutions`) để đẩy tin ngầm không gây trễ giao diện; bọc `try/catch` và `AbortSignal.timeout(5000)` phòng vệ; tự động dọn dẹp token hết hạn (404/410 Gone).
- Tầng PWA & Service Worker: Cấu hình `src/app/manifest.ts` chuẩn mực, `public/sw.js` nhận push và điều hướng tab; React hook `usePWAInstall` và `usePushNotification` tuân thủ quy tắc User Gesture của iOS WebKit (gọi `Notification.requestPermission()` đồng bộ ngay đầu sự kiện click, pre-register service worker trước).
- Tầng trải nghiệm người lớn tuổi: Bottom Sheet `PushOnboardingSheet` hiển thị 1-click cho Android, hướng dẫn 3 bước trực quan cho iPhone Safari; menu gạt thông báo và thử chuông trong `MobileMenuDrawer`; gắn nhãn "Đang phát triển" cho phân hệ Văn bản.

**Công nghệ:** Next.js 15.2+ (App Router, Server Actions, `after()`), Prisma 6, PostgreSQL, `web-push`, Service Worker API, Push API, Tailwind CSS v4, Lucide React, `node:test` + `tsx`.

**Tài liệu Spec:** `docs/superpowers/specs/2026-09-07-mobile-task-push-pwa-design.md`

## Quy Chuẩn Toàn Cục & Phòng Vệ Kỹ Thuật (Global Constraints & Hardening Invariants)
- **Quy tắc iOS WebKit User Gesture:** Tuyệt đối không đặt `await fetch()` hoặc `await navigator.serviceWorker.ready` trước `Notification.requestPermission()`. Phải gọi xin quyền ngay dòng đầu tiên của sự kiện click để không làm mất token Transient Activation của Apple WebKit.
- **Node.js Runtime Invariant:** Mọi route handler gọi `web-push` phải có `export const runtime = 'nodejs'` và `export const dynamic = 'force-dynamic'`.
- **VAPID Subject Invariant:** Định dạng subject RFC 8292 bắt buộc có scheme: `mailto:admin@qcet.edu.vn`.
- **Giới hạn số ký tự Màn hình khóa:** Tiêu đề tối đa 35 ký tự, Nội dung tối đa 85-90 ký tự.
- **Quy tắc Icon iOS:** `apple-touch-icon` phải là PNG 180x180 px vuông phẳng, nền đặc 100% (không dùng alpha/transparency), vùng an toàn 130x130 px ở tâm.
- **Quy tắc Icon Android:** Maskable icon 512x512 px với vùng an toàn tròn đường kính 409.6 px (80% tâm hình).
- **Quy tắc Build (CLAUDE.md):** Tuyệt đối không chạy `next build` khi dev server đang chạy; dùng `npm run typecheck` và `npm test` để kiểm tra.
- **Quy chuẩn chất lượng:** 100% test pass, 0 lỗi TypeScript.

---

### Task 1: Nhiệm Vụ 1: Nâng Cấp Cơ Sở Dữ Liệu Prisma (PushSubscription & Notification)

**Files:**
- Sửa đổi: `prisma/schema.prisma`
- Kiểm thử: `tests/prisma-push-schema.test.ts`

**Giao diện (Interfaces):**
- Sản sinh: Model `PushSubscription` với trường `id`, `userId`, `endpoint`, `p256dh`, `auth`, `deviceType`, `status`, `failureCount`.
- Sản sinh: Model `Notification` với trường `id`, `userId`, `actorName`, `title`, `body`, `category`, `type`, `linkHref`, `isRead`, `createdAt`.
- Cập nhật: Model `User` liên kết quan hệ `pushSubscriptions` và `notifications`.

- [ ] **Bước 1: Viết test kiểm tra cấu trúc schema và quan hệ**

Tạo file `tests/prisma-push-schema.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Prisma Push & Notification Schema", () => {
  test("schema.prisma defines PushSubscription and Notification models with User relations", () => {
    const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");

    assert.ok(schemaContent.includes("model PushSubscription"), "PushSubscription model must be present");
    assert.ok(schemaContent.includes("model Notification"), "Notification model must be present");
    assert.ok(schemaContent.includes("enum PushSubscriptionStatus"), "PushSubscriptionStatus enum must be present");
    assert.ok(schemaContent.includes("pushSubscriptions PushSubscription[]"), "User must have pushSubscriptions relation");
    assert.ok(schemaContent.includes("notifications     Notification[]"), "User must have notifications relation");
    assert.ok(schemaContent.includes("endpoint         String                 @unique"), "endpoint must be unique");
  });
});
```

- [ ] **Bước 2: Chạy test để xác nhận test thất bại**

Chạy lệnh: `npx tsx --test tests/prisma-push-schema.test.ts`
Kết quả mong muốn: FAIL vì schema chưa có các model này.

- [ ] **Bước 3: Cập nhật `prisma/schema.prisma`**

Thêm enum `PushSubscriptionStatus`, 2 model `PushSubscription`, `Notification`, và cập nhật quan hệ trong model `User`:
```prisma
enum PushSubscriptionStatus {
  ACTIVE
  REVOKED
}

model PushSubscription {
  id               String                 @id @default(cuid())
  userId           String                 @map("user_id")
  endpoint         String                 @unique
  p256dh           String
  auth             String
  userAgent        String?                @map("user_agent")
  deviceType       String?                @map("device_type")
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

model Notification {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  actorName   String   @map("actor_name")
  title       String
  body        String
  category    String   @default("task")
  type        String
  linkHref    String   @map("link_href")
  isRead      Boolean  @default(false) @map("is_read")
  createdAt   DateTime @default(now()) @map("created_at")

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}
```
Và sinh Prisma Client: `npx prisma generate`

- [ ] **Bước 4: Chạy lại test để xác nhận test pass**

Chạy lệnh: `npx tsx --test tests/prisma-push-schema.test.ts`
Kết quả mong muốn: PASS (1 test passed).

- [ ] **Bước 5: Commit**

```bash
git add prisma/schema.prisma tests/prisma-push-schema.test.ts
git commit -m "feat(db): add push_subscriptions and notifications models to schema"
```

---

### Task 2: Nhiệm Vụ 2: Dịch Vụ Web Push Server & Copywriting Matrix (`src/lib/push-service.ts`)

**Files:**
- Cài đặt: `npm install web-push && npm install -D @types/web-push`
- Tạo mới: `src/lib/push-service.ts`
- Kiểm thử: `tests/push-service.test.ts`

**Giao diện (Interfaces):**
- Tiêu thụ: `prisma` từ `@/lib/prisma`
- Sản sinh: `sendPushNotificationToUser(userId: string, payload: PushNotificationPayload): Promise<PushResult>`
- Sản sinh: `formatTaskPushPayload(input: TaskPushInput): PushNotificationPayload`
- Sản sinh: `getVapidPublicKey(): string`

- [ ] **Bước 1: Cài đặt thư viện `web-push`**

Chạy lệnh: `npm install web-push && npm install -D @types/web-push`

- [ ] **Bước 2: Viết test kiểm tra định dạng thông điệp & giới hạn ký tự**

Tạo file `tests/push-service.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { formatTaskPushPayload, truncatePushText } from "@/lib/push-service";

describe("Push Notification Copywriting & Truncation Suite", () => {
  test("truncatePushText enforces character budget strictly", () => {
    const longTitle = "[GIAO VIỆC] Kế hoạch triển khai đào tạo năm học mới 2026-2027 cho toàn bộ các khoa chuyên ngành";
    const truncated = truncatePushText(longTitle, 35);
    assert.ok(truncated.length <= 35, `Title length ${truncated.length} exceeds 35 chars`);
    assert.ok(truncated.endsWith("…") || truncated.length <= 35);
  });

  test("formatTaskPushPayload formats GIAO_VIEC correctly within budget", () => {
    const payload = formatTaskPushPayload({
      event: "TASK_ASSIGNED",
      taskTitle: "Tuyển sinh ĐH 2026",
      actorName: "BGH QCET",
      dueDateStr: "17h00 15/09",
      taskId: "t-101",
    });

    assert.ok(payload.title.includes("[GIAO VIỆC]"));
    assert.ok(payload.title.length <= 35, "Title must be <= 35 chars");
    assert.ok(payload.body.length <= 90, "Body must be <= 90 chars");
    assert.strictEqual(payload.tag, "task-t-101-assign");
    assert.ok(payload.data.linkHref.includes("t-101"));
  });

  test("formatTaskPushPayload formats PHÊ DUYỆT and YÊU CẦU SỬA correctly", () => {
    const approvedPayload = formatTaskPushPayload({
      event: "DELIVERABLE_APPROVED",
      taskTitle: "Kế hoạch thực tập",
      actorName: "Hiệu trưởng",
      taskId: "t-102",
    });
    assert.ok(approvedPayload.title.includes("[ĐÃ DUYỆT]"));
    assert.ok(approvedPayload.title.length <= 35);

    const revisionPayload = formatTaskPushPayload({
      event: "DELIVERABLE_REVISION",
      taskTitle: "Báo cáo tài chính",
      actorName: "Trưởng phòng",
      taskId: "t-103",
    });
    assert.ok(revisionPayload.title.includes("[YÊU CẦU SỬA]"));
  });
});
```

- [ ] **Bước 3: Chạy test để xác nhận test thất bại**

Chạy lệnh: `npx tsx --test tests/push-service.test.ts`
Kết quả: FAIL vì `push-service.ts` chưa tồn tại.

- [ ] **Bước 4: Viết mã triển khai `src/lib/push-service.ts`**

Tạo file `src/lib/push-service.ts` với đầy đủ:
- Khai báo cấu hình VAPID (`mailto:admin@qcet.edu.vn`).
- Hàm `truncatePushText(text, maxChars)`.
- Hàm `formatTaskPushPayload(input)` tuân thủ bảng Copywriting Matrix.
- Hàm `sendPushNotificationToUser(userId, payload)` quét các subscription `ACTIVE`, gửi qua `webpush.sendNotification` với timeout 5000ms, bắt lỗi 404/410 để cập nhật `status = REVOKED`.

- [ ] **Bước 5: Chạy lại test để xác nhận test pass**

Chạy lệnh: `npx tsx --test tests/push-service.test.ts`
Kết quả: PASS (3 tests passed).

- [ ] **Bước 6: Commit**

```bash
git add package.json package-lock.json src/lib/push-service.ts tests/push-service.test.ts
git commit -m "feat(push): implement web-push service with vietnamese copywriting matrix and stale token purge"
```

---

### Task 3: Nhiệm Vụ 3: Xây Dựng Các API Routes Cho Push & Thông Báo

**Files:**
- Tạo mới: `src/app/api/notifications/push/subscribe/route.ts`
- Tạo mới: `src/app/api/notifications/push/test/route.ts`
- Tạo mới: `src/app/api/notifications/route.ts`
- Tạo mới: `src/app/api/notifications/[id]/read/route.ts`
- Kiểm thử: `tests/api-notifications-push.test.ts`

**Giao diện (Interfaces):**
- Khai báo: `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';`
- `POST /api/notifications/push/subscribe`: Nhận `{ endpoint, p256dh, auth, deviceType, userAgent }`, upsert vào `PushSubscription`.
- `DELETE /api/notifications/push/subscribe`: Nhận `{ endpoint }`, cập nhật `status = REVOKED`.
- `POST /api/notifications/push/test`: Gửi 1 tin mẫu đến thiết bị active của user hiện tại.
- `GET /api/notifications`: Trả về danh sách thông báo từ bảng `Notification` kèm `unreadCount`.
- `PATCH /api/notifications/[id]/read`: Đánh dấu đã đọc.

- [ ] **Bước 1: Viết test cho các API routes**

Tạo file `tests/api-notifications-push.test.ts` kiểm thử payload validation, response codes và upsert logic.

- [ ] **Bước 2: Chạy test để xác nhận test thất bại**

Chạy lệnh: `npx tsx --test tests/api-notifications-push.test.ts`
Kết quả: FAIL vì các routes chưa tồn tại.

- [ ] **Bước 3: Viết mã triển khai các route handlers**

Triển khai các route với đầy đủ runtime `nodejs`, dynamic `force-dynamic`, và xử lý session người dùng.

- [ ] **Bước 4: Chạy lại test để xác nhận test pass**

Chạy lệnh: `npx tsx --test tests/api-notifications-push.test.ts`
Kết quả: PASS.

- [ ] **Bước 5: Commit**

```bash
git add src/app/api/notifications/ tests/api-notifications-push.test.ts
git commit -m "feat(api): add push subscription, test notification, and notification query endpoints"
```

---

### Task 4: Nhiệm Vụ 4: Tích Hợp Next.js 15 `after()` Bắn Push Ngầm Khi Có Biến Động Công Việc

**Files:**
- Sửa đổi: `src/app/api/tasks/route.ts` (khi giao việc mới)
- Sửa đổi: `src/app/api/executive/resolutions/route.ts` (khi BGH ban hành chỉ đ��o)
- Kiểm thử: `tests/task-push-dispatch.test.ts`

**Giao diện (Interfaces):**
- Tiêu thụ: `after` từ `next/server`
- Tiêu thụ: `sendPushNotificationToUser`, `formatTaskPushPayload` từ `@/lib/push-service`

- [ ] **Bước 1: Viết test cho luồng dispatch push ngầm**

Tạo file `tests/task-push-dispatch.test.ts` kiểm tra hàm tạo thông báo và kích hoạt gửi push trong `after()`.

- [ ] **Bước 2: Chạy test để xác nhận test thất bại**

Chạy lệnh: `npx tsx --test tests/task-push-dispatch.test.ts`
Kết quả: FAIL.

- [ ] **Bước 3: Tích hợp `after()` với bọc `try/catch` phòng vệ**

Trong `POST /api/tasks` và `POST /api/executive/resolutions`:
```typescript
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushNotificationToUser, formatTaskPushPayload } from "@/lib/push-service";

after(async () => {
  const start = Date.now();
  try {
    if (task.assignees?.length > 0) {
      for (const assignee of task.assignees) {
        const payload = formatTaskPushPayload({
          event: "TASK_ASSIGNED",
          taskTitle: task.title,
          actorName: currentUser.name,
          dueDateStr: task.dueDate ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(task.dueDate)) : undefined,
          taskId: task.id,
        });

        await prisma.notification.create({
          data: {
            userId: assignee.userId,
            actorName: currentUser.name,
            title: payload.title,
            body: payload.body,
            category: "task",
            type: "assigned",
            linkHref: payload.data.linkHref,
          }
        });

        await sendPushNotificationToUser(assignee.userId, payload);
      }
    }
  } catch (error) {
    console.error("[after() Task Push Error]", {
      taskId: task.id,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
```

- [ ] **Bước 4: Chạy lại test để xác nhận test pass**

Chạy lệnh: `npx tsx --test tests/task-push-dispatch.test.ts`
Kết quả: PASS.

- [ ] **Bước 5: Commit**

```bash
git add src/app/api/tasks/route.ts src/app/api/executive/resolutions/route.ts tests/task-push-dispatch.test.ts
git commit -m "feat(tasks): integrate next.js 15 after() with defensive try-catch for non-blocking push dispatch"
```

---

### Task 5: Nhiệm Vụ 5: Xây Dựng Service Worker & Nâng Cấp PWA Manifest (`sw.js`, `manifest.ts`)

**Files:**
- Tạo mới: `public/sw.js`
- Sửa đổi: `src/app/manifest.ts`
- Sửa đổi: `src/app/layout.tsx` (thêm `<link rel="apple-touch-icon" href="/logo-qcet.png">` và đăng ký sw)
- Kiểm thử: `tests/service-worker-manifest.test.ts`

**Giao diện (Interfaces):**
- `public/sw.js`: Bắt sự kiện `push` hiển thị notification; bắt `notificationclick` focus hoặc mở tab; cập nhật `navigator.setAppBadge`.
- `src/app/manifest.ts`: Khai báo icon 192, 512, maskable 192, maskable 512, theme_color `#1e3a8a`, display `standalone`.

- [ ] **Bước 1: Viết test cho Service Worker và Manifest**

Tạo file `tests/service-worker-manifest.test.ts` kiểm tra cú pháp của `public/sw.js` và các thuộc tính trong `src/app/manifest.ts`.

- [ ] **Bước 2: Chạy test để xác nhận test thất bại**

Chạy lệnh: `npx tsx --test tests/service-worker-manifest.test.ts`
Kết quả: FAIL.

- [ ] **Bước 3: Viết `public/sw.js` và cập nhật `src/app/manifest.ts`**

Triển khai Service Worker bắt sự kiện `push` và `notificationclick`.
Cập nhật `src/app/manifest.ts` với đầy đủ chuẩn icon maskable và `theme_color: '#1e3a8a'`.

- [ ] **Bước 4: Chạy lại test để xác nhận test pass**

Chạy lệnh: `npx tsx --test tests/service-worker-manifest.test.ts`
Kết quả: PASS.

- [ ] **Bước 5: Commit**

```bash
git add public/sw.js src/app/manifest.ts src/app/layout.tsx tests/service-worker-manifest.test.ts
git commit -m "feat(pwa): add service worker for push and notification routing, update manifest configuration"
```

---

### Task 6: Nhiệm Vụ 6: Xây Dựng React Hooks: `usePWAInstall` & `usePushNotification`

**Files:**
- Tạo mới: `src/hooks/use-pwa-install.ts`
- Tạo mới: `src/hooks/use-push-notification.ts`
- Kiểm thử: `tests/use-pwa-push-hooks.test.ts`

**Giao diện (Interfaces):**
- `usePWAInstall()`:
  - `isInstallable: boolean`
  - `isInstalled: boolean`
  - `isIOS: boolean`
  - `installApp(): Promise<"accepted" | "dismissed" | null>`
- `usePushNotification()`:
  - Pre-register service worker in `useEffect` on mount.
  - Calling `subscribeToPush()` invokes `Notification.requestPermission()` synchronously at the very top of click handler.
  - Cung cấp `urlBase64ToUint8Array(base64String)`.

- [ ] **Bước 1: Viết test cho logic của 2 hooks**

Tạo file `tests/use-pwa-push-hooks.test.ts` kiểm tra các trạng thái và hàm tiện ích (`urlBase64ToUint8Array`, nhận diện user agent iOS).

- [ ] **Bước 2: Chạy test để xác nhận test thất bại**

Chạy lệnh: `npx tsx --test tests/use-pwa-push-hooks.test.ts`
Kết quả: FAIL.

- [ ] **Bước 3: Viết mã triển khai `usePWAInstall.ts` và `usePushNotification.ts`**

Tạo:
- `src/hooks/use-pwa-install.ts`: Lắng nghe `beforeinstallprompt`, `appinstalled`, nhận diện `(navigator as any).standalone`.
- `src/hooks/use-push-notification.ts`: Đăng ký service worker từ trước, xin quyền đồng bộ khi click, gọi API `/api/notifications/push/subscribe` và `/test`.

- [ ] **Bước 4: Chạy lại test để xác nhận test pass**

Chạy lệnh: `npx tsx --test tests/use-pwa-push-hooks.test.ts`
Kết quả: PASS.

- [ ] **Bước 5: Commit**

```bash
git add src/hooks/use-pwa-install.ts src/hooks/use-push-notification.ts tests/use-pwa-push-hooks.test.ts
git commit -m "feat(hooks): add usePWAInstall and usePushNotification hooks with ios gesture invariants"
```

---

### Task 7: Nhiệm Vụ 7: Xây Dựng Giao Diện Kích Hoạt Thân Thiện Người Lớn Tuổi & Cài Đặt Di Động

**Files:**
- Tạo mới: `src/components/pwa/push-onboarding-sheet.tsx`
- Sửa đổi: `src/components/layout/mobile-menu-drawer.tsx`
- Sửa đổi: `src/components/layout/app-shell.tsx`
- Kiểm thử: `tests/push-onboarding-ui.test.ts`

**Giao diện (Interfaces):**
- `PushOnboardingSheet`: Bottom Sheet tự động hiển thị với cỡ chữ to ($\ge 16\text{px}$), nút bấm $\ge 52\text{px}$:
  - Nếu Android: Hiện nút **[CÀI ĐẶT 1-CHẠM]**.
  - Nếu iOS Safari: Hiện khung hướng dẫn 3 bước trực quan kèm mũi tên trỏ vào nút Chia sẻ ở đáy màn hình.
  - Nếu Standalone PWA: Hiện Soft Prompt xin quyền thông báo công việc.
- `MobileMenuDrawer`: Thêm section "Thông báo điện thoại" có Switch bật/tắt và nút `[🔔 Thử chuông ngay]`.

- [ ] **Bước 1: Viết test cho logic hiển thị và bước hướng dẫn**

Tạo file `tests/push-onboarding-ui.test.ts` kiểm tra các bước hướng dẫn iOS, nút 1-click Android và nội dung copy thân thiện người cao tuổi.

- [ ] **Bước 2: Chạy test để xác nhận test thất bại**

Chạy lệnh: `npx tsx --test tests/push-onboarding-ui.test.ts`
Kết quả: FAIL.

- [ ] **Bước 3: Xây dựng `PushOnboardingSheet.tsx` và tích hợp vào `mobile-menu-drawer.tsx` & `app-shell.tsx`**

Triển khai component với Tailwind CSS v4, đảm bảo tương phản cao, nút to dễ bấm và chỉ dẫn trực quan.

- [ ] **Bước 4: Chạy lại test để xác nhận test pass**

Chạy lệnh: `npx tsx --test tests/push-onboarding-ui.test.ts`
Kết quả: PASS.

- [ ] **Bước 5: Commit**

```bash
git add src/components/pwa/push-onboarding-sheet.tsx src/components/layout/mobile-menu-drawer.tsx src/components/layout/app-shell.tsx tests/push-onboarding-ui.test.ts
git commit -m "feat(ui): add senior-friendly push onboarding sheet and mobile settings drawer controls"
```

---

### Task 8: Nhiệm Vụ 8: Tạm Ẩn Phân Hệ Văn Bản Với Nhãn "Đang phát triển" & Landing Lộ Trình

**Files:**
- Sửa đổi: `src/components/layout/app-sidebar.tsx`
- Sửa đổi: `src/components/layout/app-topbar.tsx`
- Sửa đổi: `src/components/layout/mobile-bottom-nav.tsx`
- Sửa đổi: `src/app/documents/page.tsx`
- Kiểm thử: `tests/document-module-status.test.ts`

**Giao diện (Interfaces):**
- Hiển thị badge `Đang phát triển` (màu amber) bên cạnh tên mục "Văn bản" trên menu máy tính và di động.
- Trang `/documents` hiển thị thông báo lộ trình ưu tiên phân hệ Quản lý & Điều hành Công việc, kèm nút quay lại Task Hub.

- [ ] **Bước 1: Viết test kiểm tra nhãn và landing page**

Tạo file `tests/document-module-status.test.ts` kiểm tra badge và trang `/documents`.

- [ ] **Bước 2: Chạy test để xác nhận test thất bại**

Chạy lệnh: `npx tsx --test tests/document-module-status.test.ts`
Kết quả: FAIL.

- [ ] **Bước 3: Cập nhật badge và trang `src/app/documents/page.tsx`**

Thêm badge vào `app-sidebar.tsx`, `app-topbar.tsx`, `mobile-bottom-nav.tsx`, và thiết kế landing page roadmap trong `src/app/documents/page.tsx`.

- [ ] **Bước 4: Chạy lại test để xác nhận test pass**

Chạy lệnh: `npx tsx --test tests/document-module-status.test.ts`
Kết quả: PASS.

- [ ] **Bước 5: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/components/layout/app-topbar.tsx src/components/layout/mobile-bottom-nav.tsx src/app/documents/page.tsx tests/document-module-status.test.ts
git commit -m "feat(documents): attach 'Đang phát triển' roadmap badge and informative focus landing"
```

---

### Task 9: Nhiệm Vụ 9: Kiểm Thử Toàn Diện, Typecheck & Nghiệm Thu Chất Lượng

**Files:**
- Tạo mới: `tests/mobile-pwa-push-e2e.test.ts`

**Giao diện (Interfaces):**
- Toàn bộ hệ thống test suites chạy qua `npm test`.
- TypeScript kiểm tra qua `npm run typecheck`.

- [ ] **Bước 1: Viết bài test tích hợp E2E**

Tạo file `tests/mobile-pwa-push-e2e.test.ts` mô phỏng trọn vẹn luồng: Người dùng đăng ký subscription -> Giao việc kích hoạt `after()` -> Bản ghi Notification sinh ra -> Format tin chuẩn theo Copywriting Matrix.

- [ ] **Bước 2: Chạy `npm test`**

Chạy lệnh: `npm test`
Kết quả mong muốn: 100% tests pass.

- [ ] **Bước 3: Chạy `npm run typecheck`**

Chạy lệnh: `npm run typecheck`
Kết quả mong muốn: 0 errors.

- [ ] **Bước 4: Commit hoàn thiện**

```bash
git add tests/mobile-pwa-push-e2e.test.ts
git commit -m "test(e2e): verify end-to-end mobile pwa push notification lifecycle and task events"
```
