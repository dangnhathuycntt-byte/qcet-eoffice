---
status: completed
domain: ux
created: 2026-09-09
---

# Hệ Thống Onboarding & Tăng Tốc Kích Hoạt Người Dùng (Next-Gen Onboarding Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai nâng cấp toàn diện hệ thống Onboarding theo chuẩn SPEC-2026-09-09-ONBOARDING-ENHANCEMENT: bảo vệ toàn vẹn dữ liệu đa thiết bị với Set Union, bổ sung tính năng tạm hoãn Snooze 24h, liên kết hành động 1-click theo vai trò (Role-based Deep-links), hiệu ứng khen thưởng (Celebration Confetti), phòng vệ Spotlight Tour khi thiếu phần tử DOM, và giao diện hướng dẫn khôi phục quyền Web Push khi bị chặn.

**Architecture:** Nâng cấp backend `PATCH /api/users/onboarding` với giải thuật Atomic Set Union; mở rộng `useOnboarding` hook với các hàm kiểm tra và hành động `snoozeOnboarding`; cập nhật `OnboardingChecklistWidget` bổ sung nút Snooze 24h, deep-link theo vai trò và hiệu ứng mốc thành tựu; hoàn thiện `SpotlightTour` với cơ chế Centered Fallback Card; bổ sung màn hình hướng dẫn phục hồi quyền Web Push trong `PushOnboardingSheet`.

**Tech Stack:** Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4 (Light-Only OKLCH), Zod, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-09-onboarding-enhancement-spec.md`

## Global Constraints

- Tuân thủ nghiêm ngặt chuẩn Tailwind CSS v4 Light-Only: Không thêm class `dark:`, khối `.dark`, hoặc logic chuyển đổi giao diện `ThemeProvider`.
- Tuyệt đối không chạy `npm run build` khi `npm run dev` đang chạy (để tránh xung đột cache `.next`). Chỉ kiểm tra bằng `npm run typecheck` và `npm test`.
- Bảo toàn nguyên tắc Endowed Progress: Bước `step-profile` luôn được cấp sẵn 25% hoàn thành ngay từ lần đầu khởi tạo.
- Phòng vệ chống IDOR: Endpoint Onboarding chỉ đọc ghi dữ liệu dựa trên session token của người dùng hiện tại, không nhận `userId` từ client.
- Đảm bảo 100% test cases xanh trước khi hoàn tất mỗi task.

---

### Task 1: Backend API Atomic Set Union & Concurrency Safety

**Files:**
- Modify: `src/app/api/users/onboarding/route.ts`
- Test: `tests/onboarding-api.test.ts`

**Interfaces:**
- Consumes:
  - `updateOnboardingSchema`, `UpdateOnboardingInput` từ `@/lib/onboarding-schema`
  - `prisma` từ `@/lib/prisma`
  - `getSessionFromRequest` từ `@/lib/auth-audit`
- Produces:
  - Atomic Set Union cho `completedSteps` trong `PATCH /api/users/onboarding`
  - Cơ chế đánh giá hoàn tất tự động: gán `onboardedAt = new Date()` khi hoàn thành đủ các bước yêu cầu (`step-profile`, `step-push`, `step-action`, `step-search`) mà không làm mất timestamp cũ.

- [ ] **Step 1: Bổ sung test kiểm tra Concurrent Step Updates và Set Union**

Cập nhật `tests/onboarding-api.test.ts` thêm test case:
1. Gửi request PATCH với `completedSteps: ["step-profile", "step-push"]`.
2. Gửi request PATCH tiếp theo chỉ với `completedSteps: ["step-action"]`.
3. Kiểm tra kết quả trong cơ sở dữ liệu phải chứa đầy đủ cả 3 bước `["step-profile", "step-push", "step-action"]` (không bị ghi đè chỉ còn 1 bước).
4. Kiểm tra trường `snoozedUntil` được lưu trữ chính xác dạng ISO 8601 string và chấp nhận `null`.

- [ ] **Step 2: Cập nhật logic PATCH trong `src/app/api/users/onboarding/route.ts`**

Áp dụng thuật toán Set Union:
```typescript
const currentSteps = Array.isArray(existingData.completedSteps)
  ? (existingData.completedSteps as string[])
  : [];
const incomingSteps = Array.isArray(parsed.data.completedSteps)
  ? parsed.data.completedSteps
  : [];
const mergedSteps = Array.from(new Set([...currentSteps, ...incomingSteps]));

const mergedData = {
  ...existingData,
  ...parsed.data,
  completedSteps: mergedSteps,
};

const REQUIRED_STEPS = ["step-profile", "step-push", "step-action", "step-search"];
const isFinished = REQUIRED_STEPS.every((step) => mergedSteps.includes(step));

const updated = await prisma.user.update({
  where: { id: payload.id },
  data: {
    onboardingData: mergedData,
    onboardedAt: isFinished ? (current?.onboardedAt || new Date()) : undefined,
  },
  select: {
    id: true,
    onboardedAt: true,
    onboardingData: true,
  },
});
```

- [ ] **Step 3: Chạy test kiểm thử API**

Chạy lệnh:
```bash
npx tsx --test tests/onboarding-api.test.ts
```
Xác nhận 100% test cases đều pass.

---

### Task 2: Client State Management & Snooze 24h Logic

**Files:**
- Modify: `src/lib/onboarding-constants.ts`
- Modify: `src/hooks/use-onboarding.ts`
- Test: `tests/onboarding-state.test.ts`

**Interfaces:**
- Consumes:
  - `OnboardingState` từ `@/types/auth`
  - `useAuth` từ `@/components/auth/auth-context`
- Produces:
  - Hàm tiện ích `isSnoozed(snoozedUntil: string | null | undefined): boolean`
  - Action `snoozeOnboarding(hours?: number): Promise<void>` trong hook `useOnboarding()`
  - Tính toán trạng thái hiển thị: nếu `isSnoozed(state.snoozedUntil) === true`, widget sẽ tạm ẩn tương tự `isDismissed` nhưng có thời hạn tự động phục hồi.

- [ ] **Step 1: Viết test cho `isSnoozed` và `snoozeOnboarding`**

Trong `tests/onboarding-state.test.ts`:
1. Test `isSnoozed(null)` -> trả về `false`.
2. Test `isSnoozed("2026-09-10T12:00:00Z")` với mock thời gian hiện tại sớm hơn -> trả về `true`.
3. Test `isSnoozed("2026-09-08T12:00:00Z")` với mock thời gian hiện tại trễ hơn -> trả về `false`.
4. Test cập nhật `snoozedUntil` trong state machine.

- [ ] **Step 2: Cập nhật `src/lib/onboarding-constants.ts` và `src/hooks/use-onboarding.ts`**

Export hàm helper `isSnoozed`:
```typescript
export function isSnoozed(snoozedUntil: string | null | undefined): boolean {
  if (!snoozedUntil) return false;
  const snoozeDate = new Date(snoozedUntil);
  return !isNaN(snoozeDate.getTime()) && snoozeDate.getTime() > Date.now();
}
```

Bổ sung `snoozeOnboarding` vào `useOnboarding`:
```typescript
const snoozeOnboarding = useCallback(async (hours = 24) => {
  const snoozeIso = new Date(Date.now() + hours * 3600 * 1000).toISOString();
  saveLocalState({ snoozedUntil: snoozeIso });
  if (user) {
    await updateServerState({ snoozedUntil: snoozeIso });
  }
}, [user, saveLocalState, updateServerState]);
```

- [ ] **Step 3: Chạy test xác nhận State Logic**

Chạy lệnh:
```bash
npx tsx --test tests/onboarding-state.test.ts
```
Đảm bảo các hàm tính toán phần trăm, endowed progress và snooze hoạt động chuẩn xác.

---

### Task 3: Checklist Widget Snooze Action, Role-Based Deep-Links & Celebration UX

**Files:**
- Modify: `src/components/onboarding/onboarding-checklist-widget.tsx`
- Test: `tests/onboarding-widget.test.ts`

**Interfaces:**
- Consumes:
  - `useOnboarding` từ `@/hooks/use-onboarding`
  - `useAuth` từ `@/components/auth/auth-context`
  - `isSnoozed` từ `@/lib/onboarding-constants`
- Produces:
  - Nút bấm *"Nhắc lại sau 24h"* bên cạnh nút Đóng widget.
  - Xử lý hành động 1-click cho `step-action` dựa theo vai trò (`user.role`):
    - `BAN_GIAM_HIEU`: Bắn sự kiện hoặc cuộn đến Cockpit / Radar điểm nghẽn.
    - `TRUONG_PHONG`: Bắn sự kiện `qcet:open-create-task`.
    - `CHUYEN_VIEN` / `GIANG_VIEN`: Điều hướng bàn làm việc cá nhân / nộp tờ trình.
    - `VAN_THU`: Điều hướng sổ văn bản.
  - Hiệu ứng Celebration (Confetti nhẹ nhàng / Milestone badge "Cán bộ số hóa tiêu biểu") khi `progress === 100`.

- [ ] **Step 1: Viết test cho các tương tác mới của Widget**

Cập nhật `tests/onboarding-widget.test.ts`:
1. Kiểm tra nếu `isSnoozed` trả về `true`, widget không render trên màn hình (hoặc ở trạng thái ẩn).
2. Kiểm tra click nút "Nhắc lại sau 24h" kích hoạt `snoozeOnboarding(24)`.
3. Kiểm tra click hành động `step-action` bắn đúng sự kiện theo vai trò.
4. Kiểm tra khi tiến trình đạt 100%, render banner chúc mừng kèm huy hiệu.

- [ ] **Step 2: Triển khai giao diện trong `onboarding-checklist-widget.tsx`**

1. Thêm nút Snooze 24h:
```tsx
<button
  onClick={() => {
    snoozeOnboarding(24);
  }}
  title="Nhắc lại sau 24 giờ"
  className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
>
  <Clock className="w-3.5 h-3.5" />
  <span>Nhắc lại sau 24h</span>
</button>
```
2. Thêm hiệu ứng chúc mừng (Celebration Banner & Badge) khi `progress === 100`.
3. Tích hợp Role-specific Action Dispatcher cho nút hành động của `step-action`.

- [ ] **Step 3: Chạy test Widget**

Chạy lệnh:
```bash
npx tsx --test tests/onboarding-widget.test.ts
```

---

### Task 4: Spotlight Tour Defensive Fallback & Push Notification Recovery Guide

**Files:**
- Modify: `src/components/onboarding/spotlight-tour.tsx`
- Modify: `src/components/pwa/push-onboarding-sheet.tsx`
- Test: `tests/spotlight-tour.test.ts`
- Test: `tests/push-onboarding-ui.test.ts`

**Interfaces:**
- Consumes:
  - `SpotlightTourProps` trong `spotlight-tour.tsx`
  - `Notification.permission` trong `push-onboarding-sheet.tsx`
- Produces:
  - Centered Fallback Card khi selector mục tiêu không tìm thấy trong DOM.
  - Nút "Để sau (Tự khám phá)" trong Spotlight Tour.
  - Tab / Card hướng dẫn mở lại quyền thông báo chi tiết cho Chrome Desktop và Safari iOS trong `PushOnboardingSheet`.

- [ ] **Step 1: Viết test cho Centered Fallback và Permission Denied Guide**

1. Cập nhật `tests/spotlight-tour.test.ts` kiểm tra trường hợp target DOM không tồn tại, tính toán cutout không gây crash và fallback sang card căn giữa.
2. Cập nhật `tests/push-onboarding-ui.test.ts` kiểm tra khi permission là `'denied'`, hiển thị giao diện hướng dẫn mở quyền 3 bước.

- [ ] **Step 2: Cập nhật `spotlight-tour.tsx` và `push-onboarding-sheet.tsx`**

1. Trong `spotlight-tour.tsx`: Khi `targetRect` là null hoặc selector không tìm thấy phần tử, hiển thị card căn giữa màn hình với thông báo rõ ràng kèm nút "Tiếp tục" và "Để sau".
2. Trong `push-onboarding-sheet.tsx`: Bổ sung khối UI `PermissionRecoveryGuide` với icon ổ khóa 🔒, hướng dẫn 3 bước thao tác trên Chrome và Safari iOS.

- [ ] **Step 3: Chạy test xác thực**

Chạy lệnh:
```bash
npx tsx --test tests/spotlight-tour.test.ts tests/push-onboarding-ui.test.ts
```

---

### Task 5: Kiểm Thử Tích Hợp Toàn Bộ & Xác Thực Chất Lượng (Quality Gate)

**Files:**
- Test: `tests/onboarding-integration.test.ts`
- Test: `tests/a11y-contrast-onboarding.test.ts`

- [ ] **Step 1: Chạy toàn bộ test suites liên quan đến Onboarding**

Chạy lệnh:
```bash
npx tsx --test tests/onboarding-*.test.ts tests/push-onboarding-ui.test.ts tests/a11y-contrast-onboarding.test.ts tests/spotlight-tour.test.ts
```

- [ ] **Step 2: Kiểm tra tính đúng đắn của kiểu dữ liệu TypeScript**

Chạy lệnh:
```bash
npm run typecheck
```
Xác nhận `tsc --noEmit` hoàn tất với exit code 0, không có bất kỳ lỗi type nào.

- [ ] **Step 3: Chạy toàn bộ test suite dự án**

Chạy lệnh:
```bash
npm test
```
Đảm bảo 0 regression trên toàn bộ hệ thống QCET E-Office.
