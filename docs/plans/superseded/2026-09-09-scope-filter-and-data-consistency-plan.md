---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Kế Hoạch Tái Cấu Trúc Bộ Lọc Phạm Vi (Scope Switcher) & Chuẩn Hóa Dữ Liệu Lọc Đơn Vị

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xóa bỏ hoàn toàn hardcode "Khoa CNTT" trong Scope Switcher, thay thế accordion lồng nhau bằng Searchable Combobox 3 tầng chuẩn B2B SaaS, đồng bộ số lượng đơn vị (16 đơn vị trực thuộc) và sửa triệt để lỗi ánh xạ mã đơn vị khiến KPI "Công việc Đơn vị" trả về 0.

**Architecture:** 
1. Cập nhật `QCET_DEPARTMENT_DEFINITIONS` trong `src/lib/executive-matrix-aggregator.ts` bổ sung toàn bộ biến thể mã đơn vị (`alternateCodes`: `"khoa-cntt"`, `"dept-k-cntt"`, v.v.) và đồng bộ với 17 đơn vị chuẩn từ `QCET_DEPARTMENTS`.
2. Tái cấu trúc `ScopeSwitcher` (`src/components/layout/scope-switcher.tsx`): Áp dụng mô hình 3 tầng (Vĩ mô: Toàn trường -> Tác nghiệp: Đơn vị của tôi & Combobox tìm kiếm 16 đơn vị -> Vi mô: Cá nhân), loại bỏ việc truncate cụt tên trường, thêm fuzzy search tiếng Việt không dấu.
3. Động hóa số lượng đơn vị trên tiêu đề `DashboardZone` (`16 đơn vị`) và tinh chỉnh logic tính toán số liệu KPI đơn vị trong `dashboard-aggregator.ts`.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, Lucide React (`strokeWidth={1.5}`), Node.js Test Runner (`node:test`).

**Spec:** Phân tích kỹ thuật từ Exa Benchmark và Codebase Audit (2026-09-09).

## Global Constraints

- Tuân thủ quy tắc Light-Only: Không dùng class `dark:`, khối `.dark`, hoặc logic chuyển đổi theme.
- Không chạy `next build` đè lên `.next` khi dev server đang hoạt động (tránh cache poisoning). Dùng `npm run typecheck` và `npm test`.
- 0% Emojis trong code và giao diện (QCET Anti-slop engineering rule).
- Các icon Lucide chuẩn hóa `strokeWidth={1.5}`.
- Touch target trên mobile đạt tối thiểu 44x44px.
- Giữ nguyên cơ chế dispatch custom event `qcet:open-delegation-modal` cho nút Quản lý ủy quyền.

---

### Task 1: Chuẩn Hóa Ánh Xạ Mã Đơn Vị & Khắc Phục Lỗi Lọc KPI Bằng 0

**Files:**
- Modify: `src/lib/executive-matrix-aggregator.ts`
- Modify: `prisma/seed.ts`
- Test: `tests/department-resolution-consistency.test.ts`

**Interfaces:**
- Consumes: `QCET_DEPARTMENTS` từ `src/components/org/organization-tree.tsx`
- Produces: `resolveDepartmentId(deptCodeOrName?: string)` nhận diện chính xác 100% các mã legacy như `"khoa-cntt"`, `"dept-k-cntt"`, `"phong-dao-tao"`, `"K_CNTT"` về mã chuẩn `CNTT`, `DAO_TAO`, v.v.

- [ ] **Step 1: Viết failing test kiểm tra ánh xạ mã đơn vị trong `tests/department-resolution-consistency.test.ts`**

Tạo file `tests/department-resolution-consistency.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { resolveDepartmentId, QCET_DEPARTMENT_DEFINITIONS } from "../src/lib/executive-matrix-aggregator";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

describe("QCET Department Resolution & Consistency Suite", () => {
  test("resolveDepartmentId maps both canonical and legacy kebab-case department IDs for CNTT", () => {
    assert.strictEqual(resolveDepartmentId("K_CNTT"), "CNTT");
    assert.strictEqual(resolveDepartmentId("khoa-cntt"), "CNTT");
    assert.strictEqual(resolveDepartmentId("dept-k-cntt"), "CNTT");
    assert.strictEqual(resolveDepartmentId("Khoa Công nghệ thông tin"), "CNTT");
  });

  test("resolveDepartmentId maps legacy and canonical codes for Dao Tao", () => {
    assert.strictEqual(resolveDepartmentId("P_QLDT"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("phong-dao-tao"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("dept-p-qldt"), "DAO_TAO");
    assert.strictEqual(resolveDepartmentId("P_DTQLKH"), "DAO_TAO");
  });

  test("QCET_DEPARTMENTS defines 17 total units (1 BGH + 16 subordinate units)", () => {
    const bgh = QCET_DEPARTMENTS.filter((d) => d.code === "BGH" || d.category === "BGH");
    const subordinateUnits = QCET_DEPARTMENTS.filter((d) => d.code !== "BGH" && d.category !== "BGH");
    assert.strictEqual(bgh.length, 1, "Must have exactly 1 BGH unit");
    assert.strictEqual(subordinateUnits.length, 16, "Must have exactly 16 subordinate operational units");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red Phase)**

Run: `npx tsx --test tests/department-resolution-consistency.test.ts`
Expected: FAIL với `assert.strictEqual(resolveDepartmentId("khoa-cntt"), "CNTT")` trả về `null`.

- [ ] **Step 3: Cập nhật `QCET_DEPARTMENT_DEFINITIONS` trong `src/lib/executive-matrix-aggregator.ts`**

Mở rộng `alternateCodes` trong `src/lib/executive-matrix-aggregator.ts` để bổ sung `"khoa-cntt"`, `"dept-k-cntt"`, `"phong-dao-tao"`, `"dept-p-qldt"`, `"khoa-co-khi"`, `"phong-cthssv"`, v.v.

- [ ] **Step 4: Chạy lại test suite để kiểm tra tính đúng đắn (Green Phase)**

Run: `npx tsx --test tests/department-resolution-consistency.test.ts`
Expected: PASS (100% tests pass).

- [ ] **Step 5: Commit thay đổi Task 1**

```bash
git add tests/department-resolution-consistency.test.ts src/lib/executive-matrix-aggregator.ts
git commit -m "fix(departments): normalize alternateCodes to resolve legacy kebab-case department IDs"
```

---

### Task 2: Tái Cấu Trúc `ScopeSwitcher` Với Searchable Combobox & Bỏ Hardcode Khoa CNTT

**Files:**
- Modify: `src/components/layout/scope-switcher.tsx`
- Test: `tests/scope-switcher-combobox.test.ts`

**Interfaces:**
- Consumes: `useAuth()`, `QCET_DEPARTMENTS`, `formatDepartmentLabel()`, `resolveDepartment()`
- Produces: Popover Dropdown 3 tầng chuẩn B2B SaaS:
  1. Trọng tâm truy cập: Toàn trường (BGH), Đơn vị của tôi (được resolve động từ user), Cá nhân.
  2. Ô tìm kiếm nhanh với bộ lọc tiếng Việt không dấu.
  3. Danh sách phân nhóm 16 đơn vị (`Khoa chuyên môn`, `Phòng chức năng`, `Trung tâm`).
  4. Sticky Footer: Quản lý & Ủy quyền điều hành kèm icon Shield.

- [ ] **Step 1: Viết test suite kiểm thử cấu trúc và chức năng `tests/scope-switcher-combobox.test.ts`**

Tạo file `tests/scope-switcher-combobox.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { formatDepartmentLabel, resolveDepartment } from "../src/components/layout/scope-switcher";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

describe("ScopeSwitcher Ergonomics & Zero-Hardcode Suite", () => {
  const filePath = path.join(process.cwd(), "src/components/layout/scope-switcher.tsx");

  test("scope-switcher.tsx exists and is readable", () => {
    assert.strictEqual(fs.existsSync(filePath), true);
  });

  test("scope-switcher.tsx does NOT hardcode Khoa CNTT as a static button", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    // Should not contain hardcoded exclusion `dept.code !== "K_CNTT"`
    assert.ok(
      !content.includes('dept.code !== "K_CNTT"'),
      "Must not exclude K_CNTT from standard departments list"
    );
    // Should not have a static JSX button hardcoded for K_CNTT
    assert.ok(
      !content.includes('handleSelectScope("unit", "K_CNTT")'),
      "Must not have hardcoded handleSelectScope for K_CNTT in trigger list"
    );
  });

  test("formatDepartmentLabel outputs clean non-truncating labels", () => {
    const cntt = QCET_DEPARTMENTS.find((d) => d.code === "K_CNTT");
    assert.ok(cntt);
    const label = formatDepartmentLabel(cntt);
    assert.strictEqual(label, "Khoa Công nghệ thông tin");
  });

  test("scope-switcher.tsx incorporates search filter input for departments", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      content.includes("searchQuery") || content.includes("Search"),
      "Must include searchable filter input in popover"
    );
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/scope-switcher-combobox.test.ts`
Expected: FAIL do code hiện tại vẫn chứa `dept.code !== "K_CNTT"` và `handleSelectScope("unit", "K_CNTT")`.

- [ ] **Step 3: Refactor `src/components/layout/scope-switcher.tsx`**

1. Bỏ `dept.code !== "K_CNTT"` và nút hardcode `Khoa CNTT`.
2. Tạo state `searchQuery` và hàm loại bỏ dấu tiếng Việt `normalizeVietnamese(str)`.
3. Phân chia danh mục 16 đơn vị trực thuộc thành 3 nhóm rõ ràng:
   - `KHOA_CHUYEN_MON` (9 khoa)
   - `PHONG_CHUC_NANG` (5 phòng)
   - `TRUNG_TAM` (2 trung tâm)
4. Xử lý hiển thị Toàn trường cho BGH/Admin: Nếu là BGH/Admin, nhãn hiển thị là `"Toàn trường (BGH)"` (thay vì bị tràn thành `"Trường Cao đẳng Kỹ thuật Công nghệ Quy..."`).
5. Thêm ô tìm kiếm trên đầu Popover.
6. Thiết kế Sticky Footer cho "Quản lý ủy quyền điều hành" với icon `Shield`.

- [ ] **Step 4: Chạy lại test suite để kiểm tra**

Run: `npx tsx --test tests/scope-switcher-combobox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit thay đổi Task 2**

```bash
git add tests/scope-switcher-combobox.test.ts src/components/layout/scope-switcher.tsx
git commit -m "feat(scope-switcher): implement searchable 3-tier combobox and eliminate hardcoded K_CNTT"
```

---

### Task 3: Động Hóa Số Đơn Vị Trên DashboardZone & Kiểm Tra Tích Hợp Toàn Diện

**Files:**
- Modify: `src/components/dashboard/zones/dashboard-zone.tsx`
- Test: `tests/dashboard-zone-dynamic-units.test.ts`

**Interfaces:**
- Consumes: `QCET_DEPARTMENTS`
- Produces: Header subtitle hiển thị chính xác số đơn vị thực tế (16 đơn vị) thay vì hardcode 11 đơn vị.

- [ ] **Step 1: Viết failing test `tests/dashboard-zone-dynamic-units.test.ts`**

Tạo file `tests/dashboard-zone-dynamic-units.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("DashboardZone Unit Count Invariant", () => {
  const filePath = path.join(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  test("dashboard-zone.tsx does NOT hardcode '11 đơn vị'", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      !content.includes("11 đơn vị"),
      "Must not hardcode '11 đơn vị' in dashboard header subtitle"
    );
  });

  test("dashboard-zone.tsx references dynamic unit count or 16 subordinate units", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      content.includes("QCET_DEPARTMENTS") || content.includes("16 đơn vị"),
      "Must reflect the true 16 subordinate operational units"
    );
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/dashboard-zone-dynamic-units.test.ts`
Expected: FAIL do dòng 48 trong `dashboard-zone.tsx` đang có `"11 đơn vị"`.

- [ ] **Step 3: Cập nhật `src/components/dashboard/zones/dashboard-zone.tsx`**

Thay thế dòng chữ tĩnh:
```tsx
const subordinateUnitsCount = QCET_DEPARTMENTS.filter((d) => d.code !== "BGH" && d.category !== "BGH").length;
```
Và trong JSX:
```tsx
<p className="text-xs text-muted-foreground mt-1 text-balance">
  Theo dõi toàn cảnh tiến độ, điểm nghẽn, và hàng đợi phê duyệt chiến lược của {subordinateUnitsCount} đơn vị
</p>
```

- [ ] **Step 4: Chạy toàn bộ test suite và typecheck**

Run:
```bash
npm run typecheck
npm test
```
Expected: Cả 2 lệnh đều trả về exit code 0 với 0 lỗi.

- [ ] **Step 5: Commit thay đổi Task 3**

```bash
git add tests/dashboard-zone-dynamic-units.test.ts src/components/dashboard/zones/dashboard-zone.tsx
git commit -m "fix(dashboard): make subordinate unit count dynamic and consistent across dashboard"
```
