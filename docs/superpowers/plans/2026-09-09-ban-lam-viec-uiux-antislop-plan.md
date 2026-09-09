# Kế Hoạch Triển Khai Nâng Cấp UI/UX & Khử AI-Slop Bàn Làm Việc (Executive Workbench UI/UX Anti-Slop Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa toàn diện giao diện và công thái học của Bàn làm việc (Executive Workbench) theo đặc tả `docs/SPEC_BAN_LAM_VIEC_UIUX_STANDARD.md` và `DESIGN.md`, đảm bảo 100% tuân thủ Light-Only, loại bỏ AI-slop, bảo toàn dấu thanh tiếng Việt và hỗ trợ WCAG 2.2 AA.

**Architecture:** Refactor các thành phần `ExecutiveStatStrip`, `ExecutiveActionCenter`, và `DashboardZone` theo nguyên tắc Semantic Design System: chuyển đổi container sang thẻ HTML ngữ nghĩa `<button>`, giải phóng Lucide icons thành bare element với `strokeWidth={1.5}`, loại bỏ viền màu sặc sỡ và khối xám bao bọc icon, thiết lập phân trang giới hạn 5 mục cho hàng đợi công việc, và xây dựng bộ kiểm thử tự động xác thực các Anti-Patterns.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind CSS v4, Lucide React, Node.js Test Runner (`node:test`, `node:assert/strict`).

**Spec:** `docs/SPEC_BAN_LAM_VIEC_UIUX_STANDARD.md` và `DESIGN.md`

## Global Constraints

- Tuân thủ chuẩn **Light-Only** (OKLCH color space, cấm tuyệt đối thêm class `dark:`, khối `.dark` hoặc logic `useTheme`).
- Cấm chạy `next build` đè lên `.next/` khi dev server đang hoạt động (chỉ dùng `npm run typecheck` và `npm test`).
- Tuyệt đối không dùng Emoji ở bất kỳ thành phần giao diện nào trên Bàn làm việc.
- Toàn bộ icon Lucide sử dụng độ dày nét `strokeWidth={1.5}` đồng nhất.
- Nút thao tác tương tác phải đạt diện tích chạm tối thiểu `min-h-[44px]` trên màn hình cảm ứng/mobile.
- Kết thúc commit message bằng:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`

---

### Task 1: Xây Dựng Bộ Kiểm Thử Xác Thực Anti-Pattern & Tiêu Chuẩn Thiết Kế Bàn Làm Việc

**Files:**
- Create: `tests/executive-uiux-antislop-compliance.test.ts`
- Test: `tests/executive-uiux-antislop-compliance.test.ts`

**Interfaces:**
- Consumes: `src/components/dashboard/executive-stat-strip.tsx`, `src/components/dashboard/executive-action-center.tsx`, `src/components/dashboard/zones/dashboard-zone.tsx`
- Produces: Test suite kiểm tra tự động 7 tiêu chí Anti-Pattern và A11y theo `DESIGN.md`.

- [ ] **Step 1: Viết test suite kiểm tra Anti-Patterns và quy chuẩn thiết kế**

Tạo file `tests/executive-uiux-antislop-compliance.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Executive Workbench UI/UX Anti-Slop Compliance", async (t) => {
  const statStripPath = path.resolve(process.cwd(), "src/components/dashboard/executive-stat-strip.tsx");
  const actionCenterPath = path.resolve(process.cwd(), "src/components/dashboard/executive-action-center.tsx");
  const dashboardZonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  const statStripContent = fs.readFileSync(statStripPath, "utf-8");
  const actionCenterContent = fs.readFileSync(actionCenterPath, "utf-8");
  const dashboardZoneContent = fs.readFileSync(dashboardZonePath, "utf-8");

  await t.test("Criterion 1: Zero emojis in Executive components", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.equal(emojiRegex.test(statStripContent), false, "ExecutiveStatStrip must not contain emojis");
    assert.equal(emojiRegex.test(actionCenterContent), false, "ExecutiveActionCenter must not contain emojis");
    assert.equal(emojiRegex.test(dashboardZoneContent), false, "DashboardZone must not contain emojis");
  });

  await t.test("Criterion 2: No dark: variants (Strict Light-Only Standard)", () => {
    assert.equal(statStripContent.includes("dark:"), false, "ExecutiveStatStrip must not contain dark: variants");
    assert.equal(actionCenterContent.includes("dark:"), false, "ExecutiveActionCenter must not contain dark: variants");
    assert.equal(dashboardZoneContent.includes("dark:"), false, "DashboardZone must not contain dark: variants");
  });

  await t.test("Criterion 3: No top accent colored lines (Anti-Slop)", () => {
    assert.equal(statStripContent.includes("accentLineColor"), false, "ExecutiveStatStrip must not have accentLineColor");
    assert.equal(actionCenterContent.includes("activeTopBar"), false, "ExecutiveActionCenter must not have activeTopBar");
  });

  await t.test("Criterion 4: Semantic interactive button elements with A11y", () => {
    assert.match(statStripContent, /<button[\s\S]*?type="button"/, "ExecutiveStatStrip must render semantic button elements");
    assert.match(statStripContent, /aria-pressed=/, "ExecutiveStatStrip buttons must include aria-pressed");
    assert.match(actionCenterContent, /<button[\s\S]*?type="button"/, "ExecutiveActionCenter must render semantic button cards");
    assert.match(actionCenterContent, /aria-pressed=/, "ExecutiveActionCenter cards must include aria-pressed");
  });

  await t.test("Criterion 5: Action queue pagination limit and touch targets", () => {
    assert.match(actionCenterContent, /INITIAL_LIMIT\s*=\s*5/, "ExecutiveActionCenter must export INITIAL_LIMIT = 5");
    assert.match(actionCenterContent, /min-h-\[44px\]/, "Action buttons must meet min 44px touch target on mobile");
  });

  await t.test("Criterion 6: Standardized Lucide icon strokeWidth 1.5 without gray box wrapper", () => {
    assert.match(statStripContent, /strokeWidth=\{1\.5\}/, "ExecutiveStatStrip must use strokeWidth 1.5");
    assert.equal(statStripContent.includes("bg-muted/60"), false, "ExecutiveStatStrip must not wrap icons in gray boxes");
    assert.equal(actionCenterContent.includes("bg-muted/60"), false, "ExecutiveActionCenter must not wrap icons in gray boxes");
  });
});
```

- [ ] **Step 2: Chạy test để xác minh các tiêu chí tuân thủ**

Run: `npx tsx --test tests/executive-uiux-antislop-compliance.test.ts`
Expected: PASS (tất cả các tiêu chí đều đạt chuẩn).

- [ ] **Step 3: Commit**

```bash
git add tests/executive-uiux-antislop-compliance.test.ts
git commit -m "test(dashboard): add anti-slop and a11y compliance verification test suite"
```

---

### Task 2: Xác Thực & Chuẩn Hóa Typography Dấu Tiếng Việt & Header Hierarchy

**Files:**
- Modify: `src/components/dashboard/zones/dashboard-zone.tsx`
- Test: `tests/executive-uiux-antislop-compliance.test.ts`

**Interfaces:**
- Consumes: `DashboardZone`
- Produces: Giao diện tiêu đề chuẩn hành chính không dùng `font-mono` cho nhãn danh xưng tiếng Việt và có `line-height >= 1.35`.

- [ ] **Step 1: Viết test kiểm tra tiêu đề và font nhãn tiếng Việt**

Thêm test case vào `tests/executive-uiux-antislop-compliance.test.ts`:
```typescript
test("Criterion 7: Vietnamese typography clearance and proper font pairing", () => {
  const dashboardZoneContent = fs.readFileSync(dashboardZonePath, "utf-8");
  assert.equal(dashboardZoneContent.includes("font-mono font-semibold text-xs text-primary"), false, "Phân khu badge must not use font-mono");
  assert.match(dashboardZoneContent, /font-heading font-bold/, "Dashboard title must use font-heading font-bold");
});
```

- [ ] **Step 2: Chạy test để xác nhận**

Run: `npx tsx --test tests/executive-uiux-antislop-compliance.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/executive-uiux-antislop-compliance.test.ts
git commit -m "test(dashboard): assert typography clearance and vietnamese heading standards"
```

---

### Task 3: Chạy Toàn Bộ Kiểm Định Hệ Thống & Đồng Bộ Spec

**Files:**
- Test: All suites (`tests/dashboard*.test.ts`, `tests/executive*.test.ts`)
- Docs: `docs/SPEC_BAN_LAM_VIEC_UIUX_STANDARD.md`, `DESIGN.md`

- [ ] **Step 1: Chạy TypeScript typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 2: Chạy toàn bộ test suites của Dashboard và Executive**

Run: `npx tsx --test tests/dashboard*.test.ts tests/executive*.test.ts tests/executive-uiux-antislop-compliance.test.ts`
Expected: Toàn bộ tests pass.

- [ ] **Step 3: Commit hoàn tất**

```bash
git add docs/SPEC_BAN_LAM_VIEC_UIUX_STANDARD.md DESIGN.md docs/superpowers/plans/2026-09-09-ban-lam-viec-uiux-antislop-plan.md
git commit -m "docs(uiux): finalize executive workbench uiux specification and anti-slop plan"
```
