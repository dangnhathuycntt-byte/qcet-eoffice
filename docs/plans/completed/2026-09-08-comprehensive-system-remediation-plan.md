---
status: completed
domain: architecture
created: 2026-09-08
---

# Comprehensive System Remediation & Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triệt để vá các lỗ hổng bảo mật (BOLA/IDOR, Session Binding), loại bỏ triệt để nguy cơ treo deadlock PWA/Service Worker, xóa bỏ các cơ chế phê duyệt/lọc dữ liệu hardcoded theo tên người và chuẩn hóa WCAG 2.1 AA Light-Only Design System.

**Architecture:** Áp dụng mô hình phòng thủ theo chiều sâu (Defense-in-Depth): (1) Enforce phiên đăng nhập `jwt-session` và ma trận quyền hạn cấp API cho toàn bộ các endpoint văn bản và công việc; (2) Thiết lập PWA Non-blocking với `Promise.race([..., 4000ms])` cùng cơ chế tự đối soát VAPID key rotation và circuit breaker cho Web Push; (3) Hợp nhất bảng công việc `CascadingTaskTable` thành Single Source of Truth dựa trên quan hệ `departmentId`; (4) Chuẩn hóa bảng màu token đạt tương phản WCAG 2.1 AA (≥ 4.5:1) và gắn neo điều hướng trợ năng `#main-content`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v4 (@tailwindcss/postcss), Prisma ORM (SQLite / PostgreSQL), Web Push API, Service Worker API, Node.js Native Test Runner (`node:test`, `node:assert/strict`).

**Spec:** `docs/superpowers/specs/2026-09-08-comprehensive-system-remediation-spec.md`

## Global Constraints

- **Session Binding Invariant:** Mọi route tác vụ bắt buộc trích xuất danh tính từ token `qcet_session` (hoặc `Authorization: Bearer <jwt>`), cấm sử dụng `userId`, `leaderId`, `registeredById` do client tự truyền lên payload.
- **Deterministic Error Responses:** Chuẩn hóa mã phản hồi RFC 7807: `401 Unauthorized` khi thiếu/sai token, `403 Forbidden` khi không đủ thẩm quyền ma trận, `404 Not Found` khi tài nguyên không tồn tại.
- **PWA Non-Blocking Invariant:** Mọi tác vụ gọi Service Worker hoặc PushManager bắt buộc bọc trong `Promise.race` với timeout tối đa 4.000ms, không được làm treo Main Thread hoặc UI.
- **VAPID Production Integrity:** Cấm fallback sang dummy key (`FALLBACK_VAPID_PUBLIC_KEY`) khi chạy ở môi trường `NODE_ENV === "production"`.
- **DACUM Accountability:** Nghiêm cấm mọi hành vi "Duyệt nhanh" tự động điền danh tính khuyết danh mạo nhận BGH; bắt buộc mở `ReviewActionDialog` để thẩm định có trách nhiệm.
- **Relational Filtering:** Lọc phạm vi công việc 100% qua `departmentId` và vai trò hệ thống, cấm lọc qua chuỗi so sánh tên riêng (như "Xuân", "Huy", "Thanh").
- **Light-Only Standard:** Tuyệt đối không thêm class `dark:`, khối `.dark`, hoặc logic chuyển đổi theme `useTheme`/`ThemeProvider` theo QCET Engineering Rules.
- **Test Invariant:** Chạy kiểm thử qua `npm run typecheck` và `npm test` (`tsx --test tests/**/*.test.ts`). Tuyệt đối không chạy `npm run build` khi dev server đang chạy.

---

### Task 1: Security & Session Binding for Document Endpoints

**Files:**
- Modify: `src/app/api/documents/route.ts:1-105`
- Modify: `src/app/api/documents/[id]/route.ts:1-80`
- Modify: `src/app/api/documents/export-excel/route.ts:1-40`
- Modify: `src/app/api/documents/download/route.ts:1-50`
- Test: `tests/security-regression.test.ts`

**Interfaces:**
- Consumes: `verifySessionToken(token: string): SessionPayload | null` from `@/lib/jwt-session`
- Produces: Enforced session verification on all `/api/documents/**` endpoints returning RFC 7807 401 on unauthenticated calls and binding `registeredById = session.id`.

- [ ] **Step 1: Write the failing test**

Thêm test suites vào `tests/security-regression.test.ts` để kiểm tra bảo mật của các endpoint văn bản:
```typescript
// tests/security-regression.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getDocs, POST as postDocs } from "../src/app/api/documents/route";
import { GET as getDocById, PATCH as patchDocById } from "../src/app/api/documents/[id]/route";
import { GET as exportExcel } from "../src/app/api/documents/export-excel/route";

describe("Task 1: Security & Session Binding on Document Endpoints", () => {
  it("GET /api/documents returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents");
    const res = await getDocs(req);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /Unauthorized|Đăng nhập/i);
  });

  it("POST /api/documents returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents", {
      method: "POST",
      body: JSON.stringify({ title: "Test Doc", type: "VAN_BAN_DEN" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postDocs(req);
    assert.equal(res.status, 401);
  });

  it("GET /api/documents/[id] returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents/doc-123");
    const res = await getDocById(req, { params: Promise.resolve({ id: "doc-123" }) });
    assert.equal(res.status, 401);
  });

  it("PATCH /api/documents/[id] returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents/doc-123", {
      method: "PATCH",
      body: JSON.stringify({ title: "Updated Title" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await patchDocById(req, { params: Promise.resolve({ id: "doc-123" }) });
    assert.equal(res.status, 401);
  });

  it("GET /api/documents/export-excel returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3001/api/documents/export-excel?type=VAN_BAN_DEN");
    const res = await exportExcel(req);
    assert.equal(res.status, 401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/security-regression.test.ts`
Expected: FAIL với assertion errors (nhận 200 hoặc 404 thay vì 401 do chưa gắn session guard).

- [ ] **Step 3: Write minimal implementation**

Cập nhật `src/app/api/documents/route.ts`:
```typescript
// Trong GET:
export async function GET(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Vui lòng đăng nhập để truy cập tài liệu" },
        { status: 401 }
      );
    }
    // ... logic đọc văn bản tiếp tục
```
Trong `POST`:
```typescript
export async function POST(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Vui lòng đăng nhập để tạo văn bản" },
        { status: 401 }
      );
    }
    const body = await request.json();
    // Luôn ghi đè registeredById từ session.id để chống mạo danh
    body.registeredById = session.id;
```

Cập nhật `src/app/api/documents/[id]/route.ts`:
Thêm `getSessionPayload` helper và kiểm tra `if (!session) return 401` ở cả `GET` và `PATCH`.

Cập nhật `src/app/api/documents/export-excel/route.ts` và `src/app/api/documents/download/route.ts`:
Bảo vệ bằng `getSessionPayload(request)` trả về 401 nếu chưa đăng nhập.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/security-regression.test.ts`
Expected: PASS (toàn bộ 5 test cases của Task 1 chuyển sang xanh).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/documents/ tests/security-regression.test.ts
git commit -m "fix(security): enforce session binding and authentication on document endpoints"
```

---

### Task 2: Task BOLA/IDOR Prevention, Directive Role Enforcement & Network Info Shielding

**Files:**
- Modify: `src/app/api/tasks/[id]/route.ts:70-270`
- Modify: `src/app/api/documents/[id]/directives/route.ts:30-80`
- Modify: `src/app/api/system/network-info/route.ts:1-49`
- Test: `tests/security-regression.test.ts`

**Interfaces:**
- Consumes: `SessionPayload` from `@/lib/jwt-session`, Prisma `Task`, `TaskAssignee`, `User`
- Produces: Authorization check enforcing: (1) Only task creator, assigned users, unit lead, or BGH/ADMIN can update task; (2) Only task creator or BGH/ADMIN can delete task; (3) Directives strictly require `BAN_GIAM_HIEU` or `ADMIN` role with zero fallback to stranger; (4) `/api/system/network-info` completely disabled in production.

- [ ] **Step 1: Write the failing test**

Mở rộng `tests/security-regression.test.ts` với các trường hợp phân quyền công việc và ban hành chỉ đạo:
```typescript
describe("Task 2: Task BOLA/IDOR & Directive Role Enforcement", () => {
  it("PATCH /api/tasks/[id] returns 403 when user belongs to different department and is not assigned", async () => {
    // Giả lập token của GIANG_VIEN thuộc Khoa CNTT
    const token = createTestToken({ id: "user-cntt", role: "GIANG_VIEN", departmentId: "dept-cntt" });
    const req = new NextRequest("http://localhost:3001/api/tasks/task-daotao-1", {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Hacked Task Title" }),
    });
    // Task thuộc Phòng Đào tạo, user-cntt không tham gia
    const res = await patchTask(req, { params: Promise.resolve({ id: "task-daotao-1" }) });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /không có quyền|Forbidden/i);
  });

  it("DELETE /api/tasks/[id] returns 403 when user is regular assignee (not creator or BGH/ADMIN)", async () => {
    const token = createTestToken({ id: "user-assignee", role: "GIANG_VIEN", departmentId: "dept-cntt" });
    const req = new NextRequest("http://localhost:3001/api/tasks/task-cntt-1", {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` },
    });
    const res = await deleteTask(req, { params: Promise.resolve({ id: "task-cntt-1" }) });
    assert.equal(res.status, 403);
  });

  it("POST /api/documents/[id]/directives returns 403 if role is not BAN_GIAM_HIEU or ADMIN", async () => {
    const token = createTestToken({ id: "user-gv", role: "GIANG_VIEN", departmentId: "dept-cntt" });
    const req = new NextRequest("http://localhost:3001/api/documents/doc-1/directives", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assignedDeptId: "dept-cntt", content: "Chỉ đạo mẫu" }),
    });
    const res = await postDirective(req, { params: Promise.resolve({ id: "doc-1" }) });
    assert.equal(res.status, 403);
  });

  it("GET /api/system/network-info returns 404 or 403 in production environment", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await getNetworkInfo();
      assert.ok([403, 404].includes(res.status));
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/security-regression.test.ts`
Expected: FAIL (nhận 200 vì code hiện tại cho phép mọi user đã đăng nhập cập nhật/xóa task và ban hành directive).

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/app/api/tasks/[id]/route.ts`:
Trong `PATCH`:
```typescript
const taskWithPermissions = await prisma.task.findUnique({
  where: { id },
  include: {
    assignees: { select: { userId: true } },
  },
});
if (!taskWithPermissions) {
  return NextResponse.json({ success: false, error: "Không tìm thấy nhiệm vụ" }, { status: 404 });
}

const isPrivileged = ["BAN_GIAM_HIEU", "ADMIN"].includes(session.role);
const isCreator = taskWithPermissions.createdById === session.id;
const isAssignee = taskWithPermissions.assignees.some(a => a.userId === session.id);
const isDepartmentLeader = session.role === "TRUONG_PHONG" && taskWithPermissions.departmentId === session.departmentId;

if (!isPrivileged && !isCreator && !isAssignee && !isDepartmentLeader) {
  return NextResponse.json(
    { success: false, error: "Bạn không có quyền chỉnh sửa nhiệm vụ này" },
    { status: 403 }
  );
}
```
Trong `DELETE`: Chỉ cho phép `isPrivileged || isCreator`, các vai trò khác trả về `403`.

2. Cập nhật `src/app/api/documents/[id]/directives/route.ts`:
- Bắt buộc kiểm tra `if (!session) return 401;`
- Bắt buộc kiểm tra `if (!["BAN_GIAM_HIEU", "ADMIN"].includes(session.role)) return 403;`
- Luôn gán `body.leaderId = session.id;`
- Xóa bỏ hoàn toàn khối code fallback `fallbackLeader` mạo danh BGH.

3. Cập nhật `src/app/api/system/network-info/route.ts`:
```typescript
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Endpoint not available in production" }, { status: 404 });
  }
  // ... debug logic
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/security-regression.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/tasks/ src/app/api/documents/ src/app/api/system/ tests/security-regression.test.ts
git commit -m "fix(security): prevent BOLA on tasks, enforce directive roles and shield network-info"
```

---

### Task 3: PWA & Service Worker Resilience

**Files:**
- Modify: `src/hooks/use-push-notification.ts:90-140`
- Modify: `src/app/layout.tsx:88-112`
- Modify: `src/app/manifest.ts:1-50`
- Test: `tests/push-resilience.test.ts`

**Interfaces:**
- Consumes: `navigator.serviceWorker`, `window.Notification`
- Produces: Non-blocking hook with 4,000ms safety timeout on registration/subscription, removal of localhost SW killer, and valid standalone iOS manifest scope & id.

- [ ] **Step 1: Write the failing test**

Tạo `tests/push-resilience.test.ts` để kiểm tra các hành vi PWA & SW:
```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifest from "../src/app/manifest";

describe("Task 3: PWA & Service Worker Resilience", () => {
  it("manifest() includes id and scope properties for iOS/Android standalone mode", () => {
    const m = manifest();
    assert.equal(m.id, "/");
    assert.equal(m.scope, "/");
    assert.equal(m.display, "standalone");
  });

  it("layout.tsx does NOT unregister ServiceWorker on localhost", () => {
    const layoutPath = path.resolve(__dirname, "../src/app/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    assert.ok(
      !content.includes("r.unregister()"),
      "layout.tsx must not unregister service workers on localhost"
    );
  });

  it("use-push-notification.ts wraps SW ready and getSubscription in 4000ms timeout", () => {
    const hookPath = path.resolve(__dirname, "../src/hooks/use-push-notification.ts");
    const content = fs.readFileSync(hookPath, "utf-8");
    assert.ok(
      content.includes("withTimeout") || content.includes("4000") || content.includes("Promise.race"),
      "use-push-notification.ts must use timeout on SW operations"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/push-resilience.test.ts`
Expected: FAIL (manifest thiếu id/scope; layout.tsx chứa `r.unregister()`).

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/app/manifest.ts`:
Thêm `id: "/"` và `scope: "/"` vào đối tượng trả về.

2. Cập nhật `src/app/layout.tsx`:
Xóa bỏ đoạn script gỡ cài đặt SW trên localhost:
```javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function(err) {
      console.error('ServiceWorker registration failed:', err);
    });
  });
}
```

3. Cập nhật `src/hooks/use-push-notification.ts`:
Tạo helper `runWithTimeout<T>(promise: Promise<T>, timeoutMs = 4000, fallbackVal: T): Promise<T>` và bọc các lệnh gọi `navigator.serviceWorker.register`, `reg.pushManager.getSubscription()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/push-resilience.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/manifest.ts src/app/layout.tsx src/hooks/use-push-notification.ts tests/push-resilience.test.ts
git commit -m "fix(pwa): stabilize service worker registration, add manifest scope and prevent deadlocks"
```

---

### Task 4: Push Subscription Circuit Breaker, 410 Pruning & VAPID Key Rotation

**Files:**
- Modify: `src/lib/push-service.ts:80-340`
- Modify: `src/hooks/use-push-notification.ts:180-220`
- Modify: `.env.production.example`
- Test: `tests/push-resilience.test.ts`

**Interfaces:**
- Consumes: Prisma `PushSubscription`, `webpush`
- Produces: Auto key-rotation detection in client hook, circuit breaker (`failureCount >= 5` transitions to `REVOKED`), hard requirement of VAPID in production.

- [ ] **Step 1: Write the failing test**

Thêm các test cases vào `tests/push-resilience.test.ts`:
```typescript
import {
  sendPushNotificationToUser,
  setPushSenderForTesting,
} from "../src/lib/push-service";
import prisma from "../src/lib/prisma";

describe("Task 4: Push Circuit Breaker & Key Rotation", () => {
  it("revokes subscription immediately on 404 or 410 Gone", async () => {
    // Giả lập mock push sender trả về status 410
    setPushSenderForTesting(async () => {
      const err: any = new Error("Subscription expired");
      err.statusCode = 410;
      throw err;
    });

    const testSub = await prisma.pushSubscription.create({
      data: {
        userId: "user-push-test",
        endpoint: "https://fcm.googleapis.com/fcm/send/test-410",
        p256dh: "test-p256dh",
        auth: "test-auth",
        status: "ACTIVE",
      },
    });

    const res = await sendPushNotificationToUser("user-push-test", {
      title: "Test",
      body: "Test Body",
    });

    assert.equal(res.revokedCount, 1);
    const updated = await prisma.pushSubscription.findUnique({ where: { id: testSub.id } });
    assert.equal(updated?.status, "REVOKED");

    // Dọn dẹp
    await prisma.pushSubscription.delete({ where: { id: testSub.id } });
  });

  it("marks subscription as REVOKED when failureCount reaches 5", async () => {
    setPushSenderForTesting(async () => {
      const err: any = new Error("Server error");
      err.statusCode = 500;
      throw err;
    });

    const testSub = await prisma.pushSubscription.create({
      data: {
        userId: "user-push-circuit",
        endpoint: "https://fcm.googleapis.com/fcm/send/test-500",
        p256dh: "test-p256dh",
        auth: "test-auth",
        status: "ACTIVE",
        failureCount: 4, // Lần này fail nữa là 5
      },
    });

    await sendPushNotificationToUser("user-push-circuit", { title: "Test", body: "Test" });
    const updated = await prisma.pushSubscription.findUnique({ where: { id: testSub.id } });
    assert.equal(updated?.status, "REVOKED");

    await prisma.pushSubscription.delete({ where: { id: testSub.id } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/push-resilience.test.ts`
Expected: FAIL (subscription chưa được chuyển sang REVOKED khi failureCount đạt 5).

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/lib/push-service.ts`:
Trong `ensureVapidConfigured`:
```typescript
if (process.env.NODE_ENV === "production") {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error("Missing required VAPID credentials in production environment");
  }
}
```
Trong `sendPushNotificationToUser` (catch block):
```typescript
} else {
  failedCount++;
  const nextFailureCount = (sub.failureCount || 0) + 1;
  const isThresholdExceeded = nextFailureCount >= 5;
  await prisma.pushSubscription.update({
    where: { id: sub.id },
    data: {
      failureCount: nextFailureCount,
      lastFailureCode: statusCode ?? 500,
      status: isThresholdExceeded ? "REVOKED" : sub.status,
    },
  }).catch(() => {});
  if (isThresholdExceeded) revokedCount++;
}
```

2. Cập nhật `src/hooks/use-push-notification.ts`:
Trong `subscribeToPush`: So sánh `activeSub.options.applicationServerKey` với `urlBase64ToUint8Array(keyData.publicKey)`. Nếu khác nhau, thực hiện `await activeSub.unsubscribe()` trước khi `subscribe` lại với key mới.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/push-resilience.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/push-service.ts src/hooks/use-push-notification.ts tests/push-resilience.test.ts
git commit -m "fix(push): implement circuit breaker for push subscriptions and key rotation support"
```

---

### Task 5: Workspace Action Queue & DACUM Review Integration

**Files:**
- Modify: `src/components/workspace/components/universal-action-queue.tsx:200-230`
- Modify: `src/components/portal/submit-deliverable-modal.tsx:85-125`
- Modify: `src/components/workspace/unified-adaptive-workspace.tsx`
- Test: `tests/workspace-action-queue.test.ts`

**Interfaces:**
- Consumes: `ReviewActionDialog`, `SubmitDeliverableModal`, `UniversalActionQueueProps`
- Produces: Safe review workflow opening `ReviewActionDialog` for user input instead of auto-approving as "BGH", and strict non-dummy deliverable URL validation.

- [ ] **Step 1: Write the failing test**

Tạo `tests/workspace-action-queue.test.ts`:
```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateDeliverableSubmission } from "../src/components/portal/submit-deliverable-modal";

describe("Task 5: Workspace Action Queue & DACUM Review", () => {
  it("universal-action-queue.tsx does NOT contain hardcoded BGH approval string", () => {
    const filePath = path.resolve(__dirname, "../src/components/workspace/components/universal-action-queue.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      !content.includes('reviewedByName: "BGH"'),
      "Must not hardcode reviewedByName: 'BGH'"
    );
  });

  it("validateDeliverableSubmission rejects invalid URLs like '#' or 'javascript:'", () => {
    const res1 = validateDeliverableSubmission("Báo cáo", "#");
    assert.equal(res1.isValid, false);

    const res2 = validateDeliverableSubmission("Báo cáo", "javascript:alert(1)");
    assert.equal(res2.isValid, false);

    const res3 = validateDeliverableSubmission("Báo cáo", "https://drive.google.com/file/123");
    assert.equal(res3.isValid, true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/workspace-action-queue.test.ts`
Expected: FAIL (`reviewedByName: "BGH"` còn tồn tại; `#` chưa bị từ chối).

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/components/workspace/components/universal-action-queue.tsx`:
Sửa đổi handler `onClick` của nút duyệt trong Action Queue:
```typescript
onClick={() => {
  // Luôn chuyển sang chọn task để mở modal/sheet thẩm định chi tiết có danh tính thật
  onSelectTask(item.task);
}}
```

2. Cập nhật `src/components/portal/submit-deliverable-modal.tsx`:
Cập nhật hàm `validateDeliverableSubmission`:
```typescript
if (trimmedUrl) {
  try {
    const parsed = new URL(trimmedUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        isValid: false,
        error: "Đường dẫn liên kết phải sử dụng giao thức http:// hoặc https://",
      };
    }
  } catch {
    return {
      isValid: false,
      error: "Đường dẫn liên kết không đúng định dạng URL hợp lệ",
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/workspace-action-queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/ src/components/portal/ tests/workspace-action-queue.test.ts
git commit -m "fix(workspace): bind review actions to authenticated dialog and validate deliverable urls"
```

---

### Task 6: Cascading Task Table Single Source of Truth & Relational Filter

**Files:**
- Modify: `src/components/tasks/cascading-task-table.tsx`
- Modify: `src/components/dashboard/cascading-task-table.tsx`
- Test: `tests/cascading-task-table.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `departmentId`, `role-task-filter`
- Produces: Single source of truth for task cascading display, deprecating hardcoded name matching in favor of `resolveDepartmentId` and relational checks.

- [ ] **Step 1: Write the failing test**

Tạo `tests/cascading-task-table.test.ts`:
```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 6: Cascading Task Table Single Source of Truth", () => {
  it("neither task table component contains hardcoded personal name checks", () => {
    const tasksTable = path.resolve(__dirname, "../src/components/tasks/cascading-task-table.tsx");
    const dashboardTable = path.resolve(__dirname, "../src/components/dashboard/cascading-task-table.tsx");

    const content1 = fs.readFileSync(tasksTable, "utf-8");
    const content2 = fs.readFileSync(dashboardTable, "utf-8");

    const forbiddenNames = ["Xuân", "Huy", "Linh", "Thanh", "Nam", "Nhung", "Minh", "Hậu", "My"];
    for (const name of forbiddenNames) {
      assert.ok(
        !content1.includes(`"${name}"`) && !content2.includes(`"${name}"`),
        `Component must not filter by personal name '${name}'`
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/cascading-task-table.test.ts`
Expected: FAIL (tìm thấy các chuỗi tên riêng trong `cascading-task-table.tsx`).

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/components/tasks/cascading-task-table.tsx`:
Loại bỏ việc so sánh tên riêng; lọc theo `task.departmentId === canonicalDept` hoặc qua mapper `resolveDepartmentId`.
2. Biến `src/components/dashboard/cascading-task-table.tsx` thành re-export facade trỏ sang `@/components/tasks/cascading-task-table` để đảm bảo DRY và thống nhất 100% logic hiển thị.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/cascading-task-table.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/cascading-task-table.tsx src/components/dashboard/cascading-task-table.tsx tests/cascading-task-table.test.ts
git commit -m "refactor(tasks): consolidate cascading task table into single source of truth without name heuristics"
```

---

### Task 7: Design System Contrast (WCAG 2.1 AA), Typography Token & Accessibility Skip Links

**Files:**
- Modify: `src/lib/tokens.ts:25-90`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/portal/page.tsx`
- Modify: `.gitignore`
- Test: `tests/theme-standardization.test.ts`

**Interfaces:**
- Consumes: WCAG 2.1 AA contrast ratios (4.5:1 for normal text), QCET tokens
- Produces: Compliant `text-amber-700` and `text-emerald-700` token definitions, 'Be Vietnam Pro' as primary font token, `#main-content` accessibility anchors, and gitignore cleanup for database files.

- [ ] **Step 1: Write the failing test**

Mở rộng `tests/theme-standardization.test.ts`:
```typescript
describe("Task 7: Design System Contrast & Accessibility", () => {
  it("tokens.ts uses WCAG 2.1 AA compliant status text classes (700 shades)", () => {
    const tokensPath = path.resolve(__dirname, "../src/lib/tokens.ts");
    const content = fs.readFileSync(tokensPath, "utf-8");
    assert.ok(content.includes("text-emerald-700"), "Completed status should use text-emerald-700 (5.25:1)");
    assert.ok(content.includes("text-amber-700"), "NeedsReview status should use text-amber-700 (5.02:1)");
    assert.ok(
      content.includes("Be Vietnam Pro"),
      "QCET design tokens typography must include 'Be Vietnam Pro'"
    );
  });

  it("login and portal pages provide id='main-content' for keyboard skip-link", () => {
    const loginPath = path.resolve(__dirname, "../src/app/login/page.tsx");
    const portalPath = path.resolve(__dirname, "../src/app/portal/page.tsx");

    const loginContent = fs.readFileSync(loginPath, "utf-8");
    const portalContent = fs.readFileSync(portalPath, "utf-8");

    assert.ok(loginContent.includes('id="main-content"'), "login page must contain id='main-content'");
    assert.ok(portalContent.includes('id="main-content"'), "portal page must contain id='main-content'");
  });

  it(".gitignore ignores SQLite database artifacts", () => {
    const gitignorePath = path.resolve(__dirname, "../.gitignore");
    const content = fs.readFileSync(gitignorePath, "utf-8");
    assert.ok(content.includes("*.db"), ".gitignore must ignore *.db");
    assert.ok(content.includes("dev.db"), ".gitignore must ignore dev.db");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/theme-standardization.test.ts`
Expected: FAIL (tokens dùng 600, thiếu 'Be Vietnam Pro', trang login/portal thiếu id="main-content", .gitignore thiếu *.db).

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/lib/tokens.ts`:
- `statusColors.completed.text = "text-emerald-700"`, `classes = "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"`.
- `statusColors.needsReview.text = "text-amber-700"`, `classes = "bg-amber-500/10 text-amber-700 border-amber-500/20"`.
- `typography.fontSans = "var(--font-sans), 'Be Vietnam Pro', 'Plus Jakarta Sans', system-ui, sans-serif"`.
2. Cập nhật `src/app/login/page.tsx` và `src/app/portal/page.tsx`:
Gắn `id="main-content"` vào thẻ `<main>` chính của trang.
3. Cập nhật `.gitignore`:
Thêm `*.db`, `*.db-journal`, `dev.db`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/theme-standardization.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokens.ts src/app/login/page.tsx src/app/portal/page.tsx .gitignore tests/theme-standardization.test.ts
git commit -m "fix(ui): enforce WCAG 2.1 AA text contrast, add skip-link targets and update gitignore"
```

---

### Task 8: End-to-End Regression Verification & Quality Audit

**Files:**
- All modified and test files across Tasks 1–7.

- [ ] **Step 1: Run TypeScript full typecheck**

Run: `npm run typecheck`
Expected: `tsc --noEmit` hoàn thành với **0 errors**.

- [ ] **Step 2: Run complete test suite**

Run: `npm test`
Expected: Toàn bộ các test suites (cũ và mới) đều PASS 100% không có lỗi regression.

- [ ] **Step 3: Verify git status hygiene**

Run: `git status`
Expected: Cây làm việc sạch sẽ, không có tệp thừa ngoài ý muốn.

- [ ] **Step 4: Final commit & synchronization**

```bash
git commit --allow-empty -m "chore: complete system remediation and production hardening implementation"
```
