---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Tái Cấu Trúc UI/UX Bàn Làm Việc & Lịch Làm Việc (Anti-Slop Enterprise Redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ triệt để AI slop, tái cấu trúc Bàn làm việc (Dashboard Zone) với dải KPI 4 cột bất biến không vỡ layout, xử lý dứt điểm Dead Click, và xây dựng Lịch làm việc (Executive Calendar) toàn trang với lưới tuần chuẩn Notion Calendar/Cron.

**Architecture:** 
- Khử mã nguồn rác bento AI slop và fake comment trong `src/app/page.tsx`.
- Chuẩn hóa `ExecutiveStatStrip` thành Single Source of Truth cố định 4 cột, nhúng các chỉ báo việc chờ duyệt/thẩm định vào bên trong card, sửa filter key chính xác.
- Kết nối bộ lọc từ Stat Strip và Ma trận đơn vị trực tiếp tới bảng tác vụ trên `DashboardZone`, giải quyết dead click và dọn dẹp các banner cảnh báo quá hạn 3 tầng.
- Xây dựng component Lịch điều hành mới `ExecutiveCalendarWorkspace` với Week Time-Grid (mốc giờ monospaced 56px, phân phút, xử lý xung đột 2 khối trùng giờ) và Executive Agenda view.
- Nâng cấp route `/calendar` thành trang độc lập hạng nhất, chấm dứt redirect client-side chớp màn hình.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4 (`@theme inline`), Lucide React, OKLCH Color Tokens, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-09-workspace-calendar-ux-redesign.md`

## Global Constraints

- **Dev/Build Cache Invariant**: Tuyệt đối không chạy `npm run build` khi dev server đang chạy trên port 3001. Chỉ dùng `npm run typecheck` và `npm test`.
- **Strict Light-Only**: `@custom-variant dark (&:not(*));` khóa compiler. Không dùng class `dark:`, khối `.dark`, hoặc `ThemeProvider`.
- **Typography Floor**: Sàn font tối thiểu là 12px (`text-xs`). Tuyệt đối cấm `text-[9px]`, `text-[10px]`, `text-[11px]`.
- **Vietnamese Diacritics**: Headings dùng `Plus_Jakarta_Sans` với `letter-spacing: -0.01em;` và `line-height: 1.35;`. Cấm dùng `letter-spacing: -0.025em;` hoặc `tracking-tighter`.
- **Numerals**: Mọi số liệu KPI, thời gian, mốc giờ phải dùng `JetBrains_Mono` kèm `.tabular-nums`.

---

### Task 1: Dọn Dẹp AI Slop & Code Rác Tại Root Router

**Files:**
- Modify: `src/app/page.tsx:40-97`
- Modify: `src/components/portal/bento-portal-hub.tsx` (hoặc thay thế bằng minimal placeholder sạch)
- Test: `tests/page-routing-clean.test.ts`

**Interfaces:**
- Consumes: Route params và context hiện có của `src/app/page.tsx`.
- Produces: `src/app/page.tsx` sạch sẽ, không còn comment marker giả regex, không render stub null.

- [ ] **Step 1: Viết test kiểm tra tính sạch sẽ và cấu trúc routing của `src/app/page.tsx`**

```typescript
// tests/page-routing-clean.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("src/app/page.tsx does not contain AI slop fake comments", () => {
  const pageContent = fs.readFileSync(
    path.join(process.cwd(), "src/app/page.tsx"),
    "utf-8"
  );
  // Must not have the 25-line fake AST comment block
  assert.equal(pageContent.includes("// Test AST compatibility markers:"), false);
  assert.equal(pageContent.includes("PortalHubView"), false);
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/page-routing-clean.test.ts`
Expected: FAIL vì `src/app/page.tsx` đang chứa fake AST comments và `PortalHubView`.

- [ ] **Step 3: Dọn dẹp `src/app/page.tsx` và tinh gọn `bento-portal-hub.tsx`**
  - Xóa bỏ định nghĩa `PortalHubView() { return null; }` và nhánh `activeZone === "portal"`.
  - Xóa bỏ hoàn toàn khối 25 dòng comment rác ở cuối tệp `src/app/page.tsx`.
  - Thu gọn `src/components/portal/bento-portal-hub.tsx` thành component export an toàn để không gãy các import cũ nếu có.

- [ ] **Step 4: Chạy test để xác nhận test vượt qua (Green)**

Run: `npx tsx --test tests/page-routing-clean.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/portal/bento-portal-hub.tsx tests/page-routing-clean.test.ts
git commit -m "refactor(shell): eradicate bento AI slop stub and fake AST comments from root page"
```

---

### Task 2: Tái Cấu Trúc Dải KPI `ExecutiveStatStrip` Thành 4 Cột Cố Định Bất Biến

**Files:**
- Modify: `src/components/dashboard/executive-stat-strip.tsx`
- Test: `tests/executive-stat-strip-resilience.test.ts`

**Interfaces:**
- Consumes: `DashboardStats` từ `@/types/dashboard`.
- Produces: `getStatCardData(stats)` luôn trả về đúng 4 thẻ:
  1. `school-tasks` (`filterKey: "ALL"`)
  2. `unit-tasks` (`filterKey: "MY_ACTION"`)
  3. `urgent-tasks` (`filterKey: "URGENT_OVERDUE"`, nhúng số lượng `pendingTriageCount` và `escalatedReviewCount` vào subtext và badge)
  4. `overall-progress` (`filterKey: "COMPLETED"`)

- [ ] **Step 1: Viết test kiểm chứng cấu trúc 4 thẻ bất biến không bị vỡ layout**

```typescript
// tests/executive-stat-strip-resilience.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { getStatCardData } from "../src/components/dashboard/executive-stat-strip";
import type { DashboardStats } from "../src/types/dashboard";

test("getStatCardData always returns exactly 4 cards even with triage and escalated items", () => {
  const statsWithQueues: DashboardStats = {
    totalSchoolTasks: 45,
    schoolTasksInProgress: 30,
    schoolTasksCompleted: 15,
    totalStaffTasks: 120,
    staffTasksInProgress: 80,
    staffTasksCompleted: 40,
    needsReviewTasksCount: 5,
    overdueTasksCount: 3,
    averageSchoolProgressPercent: 68,
    pendingTriageCount: 4,
    escalatedReviewCount: 2,
  };

  const cards = getStatCardData(statsWithQueues);
  assert.equal(cards.length, 4, "Must strictly maintain 4 cards to prevent layout shift");

  // Check correct filterKey mapping
  assert.equal(cards[0].filterKey, "ALL");
  assert.equal(cards[1].filterKey, "MY_ACTION");
  assert.equal(cards[2].filterKey, "URGENT_OVERDUE");
  assert.equal(cards[3].filterKey, "COMPLETED");

  // Check that urgent card integrates triage and escalated information
  const urgentCard = cards[2];
  assert.ok(urgentCard.subtext.includes("chờ tiếp nhận") || urgentCard.subtext.includes("quá hạn"));
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/executive-stat-strip-resilience.test.ts`
Expected: FAIL vì code cũ trả về 6 cards khi có triage & escalated counts, và sai filterKey.

- [ ] **Step 3: Cập nhật `src/components/dashboard/executive-stat-strip.tsx`**
  - Xóa bỏ `cards.push(...)` cho triage và escalated.
  - Cập nhật card `school-tasks` với `filterKey: "ALL"`.
  - Cập nhật card `urgent-tasks` với `filterKey: "URGENT_OVERDUE"` và format subtext thông minh gộp cả triage/escalated.
  - Cập nhật `WorkboxFilter` type nếu cần để hỗ trợ `"ALL"`.
  - Đảm bảo lưới bao bọc luôn giữ `grid grid-cols-2 lg:grid-cols-4 divide-x divide-border`.

- [ ] **Step 4: Chạy test để xác nhận test vượt qua (Green)**

Run: `npx tsx --test tests/executive-stat-strip-resilience.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/executive-stat-strip.tsx tests/executive-stat-strip-resilience.test.ts
git commit -m "fix(dashboard): lock executive stat strip to 4 immutable columns and correct filter keys"
```

---

### Task 3: Kết Nối Reactive Filter Trên Bàn Làm Việc & Xóa Bỏ Dead Click

**Files:**
- Modify: `src/components/dashboard/zones/dashboard-zone.tsx`
- Test: `tests/dashboard-zone-reactivity.test.ts`

**Interfaces:**
- Consumes: `activeWorkbox`, `selectedDepartment` từ hook `useDashboardData`.
- Produces: `DashboardZone` kích hoạt lọc tác vụ thực tế ngay tr��n màn hình khi người dùng click thẻ KPI hoặc phòng ban trong ma trận.

- [ ] **Step 1: Viết test cho hành vi phản hồi của DashboardZone**

```typescript
// tests/dashboard-zone-reactivity.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("DashboardZone connects stat strip filter and department matrix to active task list", () => {
  const content = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx"),
    "utf-8"
  );
  // Verify that activeWorkbox or filter changes reflect on the displayed task container
  assert.ok(content.includes("CascadingTaskTable") || content.includes("UnifiedAdaptiveWorkspace") || content.includes("filteredTasks"));
  // Ensure dead-click items prop is passed to ExecutiveActionCenter if present
  assert.equal(content.includes("DEFAULT_ACTION_ITEMS"), false);
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/dashboard-zone-reactivity.test.ts`
Expected: FAIL do `DashboardZone` hiện tại không mount bảng tác vụ phản hồi khi click thẻ KPI.

- [ ] **Step 3: Cập nhật `src/components/dashboard/zones/dashboard-zone.tsx`**
  - Tích hợp bảng công việc liên thông (`CascadingTaskTable` hoặc phân vùng tác vụ tập trung) ngay dưới ma trận điều hành.
  - Khi người dùng click vào thẻ trong `ExecutiveStatStrip` (`onFilterChange`), state `activeWorkbox` tự động lọc danh sách tác vụ hiển thị bên dưới.
  - Khi chọn đơn vị trong `DepartmentProgressMatrix`, truyền `selectedDepartment` vào bộ lọc tác vụ để dữ liệu đồng bộ tức thì.
  - Gom bớt các cảnh báo trùng lặp (chỉ giữ `PriorOverdueBacklogBanner` khi thực sự có việc quá hạn của kỳ học thuật đang chọn).

- [ ] **Step 4: Chạy test để xác nhận test vượt qua (Green)**

Run: `npx tsx --test tests/dashboard-zone-reactivity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/zones/dashboard-zone.tsx tests/dashboard-zone-reactivity.test.ts
git commit -m "feat(dashboard): connect KPI stat strip and department matrix to reactive task table"
```

---

### Task 4: Xây Dựng `ExecutiveCalendarWorkspace` Với Lưới Thời Gian Tuần Chuẩn Cron/Notion Calendar

**Files:**
- Create: `src/components/calendar/executive-calendar-workspace.tsx`
- Test: `tests/executive-calendar-workspace.test.ts`

**Interfaces:**
- Consumes: Danh sách sự kiện/nhiệm vụ có mốc giờ bắt đầu, kết thúc, ngày đến hạn từ `src/lib/academic-calendar.ts` và task service.
- Produces:
  - Header thanh điều hướng tuần/tháng (Tuần hiện tại, Nút Hôm nay, Chuyển tuần Trước/Sau).
  - All-day Milestones Bar: Hạn nộp sản phẩm DACUM & mốc năm học.
  - 7 cột thời gian (Thứ Hai đến Chủ Nhật) với Time Gutter 56px (`JetBrains Mono`, `.tabular-nums`).
  - Thuật toán giải quyết xung đột lịch họp (collision detection: tự động co chiều rộng khi trùng khung giờ).
  - Chuyển đổi linh hoạt giữa chế độ `week_grid` (Lưới tuần) và `agenda_list` (Nghị sự điều hành).

- [ ] **Step 1: Viết test cho thuật toán phân bổ mốc giờ và phát hiện xung đột lịch**

```typescript
// tests/executive-calendar-workspace.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateEventLayout, type CalendarTimeEvent } from "../src/components/calendar/executive-calendar-workspace";

test("calculateEventLayout computes correct top and height percentages", () => {
  // Start of day: 07:00 (420 mins), End: 18:00 (1080 mins) -> 660 mins total
  const event: CalendarTimeEvent = {
    id: "evt-1",
    title: "Họp Giao ban Ban Giám hiệu",
    startTime: "08:00",
    endTime: "09:30",
    date: "2026-09-14",
    type: "meeting",
  };

  const layout = calculateEventLayout(event, 7, 18);
  // 08:00 is 60 mins from 07:00. 60 / 660 = ~9.09%
  assert.ok(Math.abs(layout.topPercent - 9.09) < 0.2);
  // Duration: 90 mins. 90 / 660 = ~13.64%
  assert.ok(Math.abs(layout.heightPercent - 13.64) < 0.2);
});

test("calculateEventLayout handles simultaneous event collisions", () => {
  const eventA: CalendarTimeEvent = {
    id: "evt-a",
    title: "Tiếp đoàn chuyên gia ĐBCL",
    startTime: "09:00",
    endTime: "10:30",
    date: "2026-09-14",
    type: "meeting",
  };
  const eventB: CalendarTimeEvent = {
    id: "evt-b",
    title: "Họp Thẩm định DACUM Khoa CNTT",
    startTime: "09:30",
    endTime: "11:00",
    date: "2026-09-14",
    type: "meeting",
  };

  const [layoutA, layoutB] = [
    calculateEventLayout(eventA, 7, 18, [eventB]),
    calculateEventLayout(eventB, 7, 18, [eventA]),
  ];

  assert.equal(layoutA.hasCollision, true);
  assert.equal(layoutB.hasCollision, true);
  assert.equal(layoutA.widthPercent, 50);
  assert.equal(layoutB.widthPercent, 50);
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/executive-calendar-workspace.test.ts`
Expected: FAIL vì `src/components/calendar/executive-calendar-workspace.tsx` chưa được tạo.

- [ ] **Step 3: Xây dựng `src/components/calendar/executive-calendar-workspace.tsx`**
  - Cài đặt `calculateEventLayout` tính toán vị trí `topPercent`, `heightPercent`, `widthPercent`, `leftPercent`, `hasCollision`.
  - Cài đặt giao diện Lưới tuần (Week Time-Grid) với gutter 56px (`w-14`), mốc từ `07:00` đến `18:00`.
  - Tích hợp mốc hôm nay (đường kẻ đỏ mốc giờ thời gian thực `CurrentTimeIndicator`).
  - Tích hợp chế độ xem danh sách nghị sự (Agenda View) mật độ cao cho Ban Giám hiệu.
  - Tích hợp All-day Milestones bar cho hạn chót đề án và lịch năm học.
  - Đảm bảo tuân thủ Light-Only và sàn font 12px.

- [ ] **Step 4: Chạy test để xác nhận test vượt qua (Green)**

Run: `npx tsx --test tests/executive-calendar-workspace.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/calendar/executive-calendar-workspace.tsx tests/executive-calendar-workspace.test.ts
git commit -m "feat(calendar): implement executive week time-grid with collision detection and agenda view"
```

---

### Task 5: Nâng Cấp Tuyến Đường `/calendar` Thành Standalone Route Hạng Nhất

**Files:**
- Modify: `src/app/calendar/page.tsx`
- Test: `tests/calendar-route.test.ts`

**Interfaces:**
- Consumes: `ExecutiveCalendarWorkspace`.
- Produces: Trang `/calendar` chạy trực tiếp SSR, không chuyển hướng, đồng bộ trạng thái đầy đủ.

- [ ] **Step 1: Viết test cho route `/calendar`**

```typescript
// tests/calendar-route.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("src/app/calendar/page.tsx renders ExecutiveCalendarWorkspace directly without redirect", () => {
  const content = fs.readFileSync(
    path.join(process.cwd(), "src/app/calendar/page.tsx"),
    "utf-8"
  );
  assert.equal(content.includes("router.replace"), false, "Must not perform client redirect");
  assert.ok(content.includes("ExecutiveCalendarWorkspace"), "Must render ExecutiveCalendarWorkspace directly");
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npx tsx --test tests/calendar-route.test.ts`
Expected: FAIL vì trang hiện tại đang dùng `router.replace` chuyển hướng.

- [ ] **Step 3: Cập nhật `src/app/calendar/page.tsx`**
  - Loại bỏ component chuyển hướng `CalendarRedirectContent`.
  - Render trực tiếp `ExecutiveCalendarWorkspace` bọc trong `Suspense` v���i loading skeleton trang nhã.
  - Cung cấp tiêu đề trang và breadcrumb chuẩn mực hành chính công sở.

- [ ] **Step 4: Chạy test để xác nhận test vượt qua (Green)**

Run: `npx tsx --test tests/calendar-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/calendar/page.tsx tests/calendar-route.test.ts
git commit -m "feat(calendar): promote /calendar to first-class standalone route without client redirects"
```

---

### Task 6: Kiểm Thử Toàn Diện & Đảm Bảo Zero Lỗi TypeScript / Hồi Quy

**Files:**
- Test: Toàn bộ test suite `npm test` và kiểm tra kiểu `npm run typecheck`.

- [ ] **Step 1: Chạy Typecheck toàn dự án**

Run: `npm run typecheck`
Expected: Không có lỗi TypeScript (Exit code 0).

- [ ] **Step 2: Chạy Theme Standardization Test & Typography Floors Test**

Run: `npx tsx --test tests/theme-standardization.test.ts tests/typography-micro-classes.test.ts`
Expected: PASS (không có class dark: rò rỉ, không có cỡ chữ <12px).

- [ ] **Step 3: Chạy Toàn Bộ Test Suite**

Run: `npm test`
Expected: Tất cả các bài kiểm thử đều đạt màu xanh (PASS).

- [ ] **Step 4: Commit tổng kết**

```bash
git commit --allow-empty -m "chore(qa): verify full typecheck and green test suite across workspace and calendar"
```
