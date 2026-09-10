---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Role Scope Navigation & Unassigned Department Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chấm dứt triệt để việc nhầm lẫn giữa tab Đơn vị và Toàn trường khi cán bộ chưa chọn Khoa/Phòng, chuẩn hóa hiển thị cảnh báo `[⚠️ Chưa chọn đơn vị]` và cung cấp Actionable Empty State để người dùng cập nhật hồ sơ trong 1-click.

**Architecture:** Mở rộng AuthContext và Scope Switcher với logic nhận diện `isUserUnassignedDepartment()`. Cập nhật `AdaptiveScopeHeader` để gắn cờ warning khi chưa gán đơn vị, đồng thời thay thế màn hình rỗng 0 việc thụ động bằng component `UnassignedDepartmentState` kết nối trực tiếp với `UserProfileModal`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Lucide Icons, Node.js Test Runner (`node:test`, `tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-09-role-scope-navigation-and-unassigned-department-spec.md`

## Global Constraints

- **Light-Only Standard:** Tuyệt đối không thêm class `dark:`, khối `.dark`, hoặc logic chuyển đổi dark theme (tuân thủ mục 2 trong CLAUDE.md).
- **Anti-Slop UI & Icons:** Sử dụng Lucide Icons với `strokeWidth={1.5}` chuẩn mực.
- **Strict Build Rule:** Không chạy `next build` khi dev server đang chạy. Kiểm tra bằng `npm run typecheck` và `npx tsx --test`.
- **Role Isolation:** Chỉ tài khoản Executive (BGH/Admin) mới thấy và truy cập tab "Toàn trường". Nhân sự chưa chọn đơn vị không bao giờ bị fallback về tên toàn trường `"Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"`.

---

### Task 1: Core Domain Logic & Unassigned Department Detection

**Files:**
- Modify: `src/lib/auth-context.tsx:80-110,390-410`
- Modify: `src/components/layout/scope-switcher.tsx:115-205`
- Test: `tests/unassigned-department-scope.test.ts`

**Interfaces:**
- Produces: `isUserUnassignedDepartment(user?: { role?: string; department?: string | null; departmentCode?: string | null } | null): boolean`
- Updates: `resolveScopeDetails(scopeParam, deptParam, fallbackUser)` to return `isUnassigned: boolean` and appropriate labels.

- [ ] **Step 1: Write the failing tests in `tests/unassigned-department-scope.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isUserUnassignedDepartment } from "../src/lib/auth-context";
import { resolveScopeDetails } from "../src/components/layout/scope-switcher";

describe("Unassigned Department Detection & Scope Details", () => {
  test("identifies unassigned staff with null/empty or fallback departmentCode", () => {
    assert.equal(isUserUnassignedDepartment(null), false);
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "Chưa cập nhật đơn vị", departmentCode: "QCET" }), true);
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn", departmentCode: "QCET" }), true);
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "", departmentCode: "" }), true);
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "Chưa chọn đơn vị", departmentCode: "UNASSIGNED" }), true);
  });

  test("does NOT mark executive (BGH/ADMIN) as unassigned", () => {
    assert.equal(isUserUnassignedDepartment({ role: "ADMIN", departmentCode: "BGH" }), false);
    assert.equal(isUserUnassignedDepartment({ role: "BAN_GIAM_HIEU", departmentCode: "QCET" }), false);
  });

  test("does NOT mark staff with valid assigned department as unassigned", () => {
    assert.equal(isUserUnassignedDepartment({ role: "STAFF", department: "Khoa Công nghệ Thông tin", departmentCode: "CNTT" }), false);
    assert.equal(isUserUnassignedDepartment({ role: "MANAGER", department: "Phòng Quản lý Đào tạo", departmentCode: "P_QLDT" }), false);
  });

  test("resolveScopeDetails returns warning state and friendly label when user is unassigned", () => {
    const unassignedUser = { role: "STAFF", department: "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn", departmentCode: "QCET" };
    const details = resolveScopeDetails("unit", null, unassignedUser);
    assert.equal(details.scope, "unit");
    assert.equal(details.label, "Chưa chọn đơn vị");
    assert.equal(details.shortLabel, "Chưa chọn đ/vị");
    assert.equal(details.isWarning, true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unassigned-department-scope.test.ts`
Expected: FAIL (`isUserUnassignedDepartment is not a function` or assertions fail).

- [ ] **Step 3: Implement `isUserUnassignedDepartment` and update `resolveScopeDetails`**

In `src/lib/auth-context.tsx`:
Add and export `isUserUnassignedDepartment`:
```typescript
export function isUserUnassignedDepartment(
  user?: { role?: string; department?: string | null; departmentCode?: string | null } | null
): boolean {
  if (!user) return false;
  const role = (user.role || "").toUpperCase();
  const isExecutive =
    role === "ADMIN" ||
    role === "BGH" ||
    role === "BAN_GIAM_HIEU" ||
    role === "HIEU_TRUONG" ||
    role === "PHO_HIEU_TRUONG";
  if (isExecutive) return false;

  const dept = (user.department || "").trim();
  const code = (user.departmentCode || "").trim().toUpperCase();

  if (!dept || !code) return true;
  if (code === "QCET" || code === "UNASSIGNED") return true;
  if (
    dept === "Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn" ||
    dept === "Chưa cập nhật đơn vị" ||
    dept === "Chưa chọn đơn vị"
  ) {
    return true;
  }
  return false;
}
```

In `src/components/layout/scope-switcher.tsx`:
Update `ScopeDetails` type to include `isWarning?: boolean;`
In `resolveScopeDetails`:
Check `isUserUnassignedDepartment(fallbackUser)` when resolving `scope === "unit"`. If true and no specific `deptParam` is present, return:
```typescript
if (isUserUnassignedDepartment(fallbackUser)) {
  return {
    scope: "unit",
    label: "Chưa chọn đơn vị",
    shortLabel: "Chưa chọn đ/vị",
    triggerLabel: "Phạm vi: Chưa chọn đơn vị",
    iconType: "Building2",
    isWarning: true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unassigned-department-scope.test.ts`
Expected: PASS (all 4 tests pass).

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/auth-context.tsx src/components/layout/scope-switcher.tsx tests/unassigned-department-scope.test.ts
git commit -m "feat(auth): add isUserUnassignedDepartment helper and scope resolution warning"
```

---

### Task 2: Actionable Empty State Component (`UnassignedDepartmentState`)

**Files:**
- Create: `src/components/workspace/components/unassigned-department-state.tsx`
- Test: `tests/unassigned-department-scope.test.ts`

**Interfaces:**
- Produces: `UnassignedDepartmentState({ onOpenProfile }: { onOpenProfile?: () => void })`

- [ ] **Step 1: Write test for `UnassignedDepartmentState` in `tests/unassigned-department-scope.test.ts`**

```typescript
import { readFileSync } from "node:fs";

test("UnassignedDepartmentState file exists and contains accessible actionable CTA", () => {
  const content = readFileSync("src/components/workspace/components/unassigned-department-state.tsx", "utf-8");
  assert.ok(content.includes("UnassignedDepartmentState"));
  assert.ok(content.includes("onOpenProfile"));
  assert.ok(content.includes("Building2"));
  assert.ok(content.includes("Cập nhật Khoa / Phòng công tác ngay"));
  assert.ok(!content.includes("dark:")); // Light-only compliance
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unassigned-department-scope.test.ts`
Expected: FAIL (file does not exist).

- [ ] **Step 3: Implement `UnassignedDepartmentState` component**

Create `src/components/workspace/components/unassigned-department-state.tsx`:
```tsx
"use client";

import * as React from "react";
import { Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UnassignedDepartmentStateProps {
  onOpenProfile?: () => void;
}

export function UnassignedDepartmentState({ onOpenProfile }: UnassignedDepartmentStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-amber-300/80 bg-amber-50/40 my-6 shadow-xs animate-in fade-in-50 duration-200">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 border border-amber-200/80 mb-4 shadow-xs">
        <Building2 className="size-7" strokeWidth={1.5} />
      </div>

      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100/80 text-amber-800 border border-amber-200 mb-2">
        Hồ sơ chưa hoàn tất
      </span>

      <h3 className="text-base sm:text-lg font-bold text-foreground mb-1.5">
        Tài khoản chưa liên kết Khoa / Phòng công tác
      </h3>

      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
        Bạn đang đăng nhập với tư cách Cán bộ / Giảng viên nhưng chưa được xếp vào Khoa hoặc Phòng ban cụ thể. Vui lòng cập nhật đơn vị để hệ thống đồng bộ và hiển thị công việc của đơn vị bạn.
      </p>

      {onOpenProfile && (
        <Button
          type="button"
          onClick={onOpenProfile}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all active:scale-98"
        >
          <Building2 className="size-4" strokeWidth={1.5} />
          <span>Cập nhật Khoa / Phòng công tác ngay</span>
          <ArrowRight className="size-3.5" strokeWidth={1.5} />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unassigned-department-scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/workspace/components/unassigned-department-state.tsx tests/unassigned-department-scope.test.ts
git commit -m "feat(ui): create UnassignedDepartmentState actionable empty state component"
```

---

### Task 3: Adaptive Scope Header & Workspace View Integration

**Files:**
- Modify: `src/components/workspace/components/adaptive-scope-header.tsx:11-125`
- Modify: `src/components/tasks/task-management-workspace.tsx:210-310,750-850`
- Test: `tests/unassigned-department-scope.test.ts`

**Interfaces:**
- `AdaptiveScopeHeader`: displays `[⚠️ Chưa chọn đơn vị]` with warning styles when `isUserUnassignedDepartment(user)`.
- `TaskManagementWorkspace`: renders `<UnassignedDepartmentState>` when in unit scope and user is unassigned.

- [ ] **Step 1: Write integration tests in `tests/unassigned-department-scope.test.ts`**

```typescript
test("AdaptiveScopeHeader and TaskManagementWorkspace integration contract verified", () => {
  const headerContent = readFileSync("src/components/workspace/components/adaptive-scope-header.tsx", "utf-8");
  assert.ok(headerContent.includes("isUserUnassignedDepartment"));
  assert.ok(headerContent.includes("Chưa chọn đơn vị"));

  const workspaceContent = readFileSync("src/components/tasks/task-management-workspace.tsx", "utf-8");
  assert.ok(workspaceContent.includes("UnassignedDepartmentState"));
  assert.ok(workspaceContent.includes("setIsProfileModalOpen"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unassigned-department-scope.test.ts`
Expected: FAIL.

- [ ] **Step 3: Modify `adaptive-scope-header.tsx` and `task-management-workspace.tsx`**

In `src/components/workspace/components/adaptive-scope-header.tsx`:
- Import `isUserUnassignedDepartment` from `@/lib/auth-context`.
- Compute:
```typescript
const isUnassigned = isUserUnassignedDepartment(user);
const unitLabel = isUnassigned
  ? "Chưa chọn đơn vị"
  : (user.department || user.departmentCode || "Đơn vị");
```
- For the `unit` scope tab:
  - If `isUnassigned`, show a warning badge or subtle amber highlight.

In `src/components/tasks/task-management-workspace.tsx`:
- Import `isUserUnassignedDepartment` from `@/lib/auth-context`.
- Import `UnassignedDepartmentState` from `@/components/workspace/components/unassigned-department-state`.
- Connect `setIsProfileModalOpen` from `useAuth()`.
- When rendering tasks table/list:
  If `scope === "unit" && isUserUnassignedDepartment(user)`, render:
  ```tsx
  <UnassignedDepartmentState onOpenProfile={() => setIsProfileModalOpen(true)} />
  ```
  instead of the generic empty state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unassigned-department-scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full project test suite and typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/workspace/components/adaptive-scope-header.tsx src/components/tasks/task-management-workspace.tsx tests/unassigned-department-scope.test.ts
git commit -m "feat(tasks): integrate unassigned department warning and actionable empty state"
```

---

### Task 4: First-Login Profile Modal Prompt Trigger

**Files:**
- Modify: `src/components/dashboard/dashboard-modals-host.tsx` or `src/components/auth/user-profile-modal.tsx`
- Test: `tests/unassigned-department-scope.test.ts`

- [ ] **Step 1: Write test for first-login unassigned prompt**

```typescript
test("first login check triggers user profile modal if unassigned", () => {
  const hostContent = readFileSync("src/components/dashboard/dashboard-modals-host.tsx", "utf-8");
  assert.ok(hostContent.includes("isUserUnassignedDepartment"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/unassigned-department-scope.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement automatic profile prompt in `dashboard-modals-host.tsx`**

In `src/components/dashboard/dashboard-modals-host.tsx`:
Add an effect checking if `user && isUserUnassignedDepartment(user) && !sessionStorage.getItem("qcet_dept_prompt_dismissed")`:
If true, set `setIsProfileModalOpen(true)` so the staff is guided to pick their department on first visit, then save the flag to sessionStorage so it doesn't aggressively reopen on every click.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/unassigned-department-scope.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/dashboard/dashboard-modals-host.tsx tests/unassigned-department-scope.test.ts
git commit -m "feat(auth): auto-prompt department selection for unassigned staff on first login"
```
