# Executive Department Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng Trung Tâm Chỉ Huy Đơn Vị Ban Giám Hiệu (Executive Department Command Center) tại `?zone=tasks`, hiển thị lưới 12 Thẻ Chỉ Huy Đơn Vị với Việc trọng tâm (Focus Initiative), cảnh báo RAG, và 3 lăng kính điều hành cấp tốc giúp Hiệu trưởng nắm bắt ngay tình hình toàn trường.

**Architecture:** Tạo bộ tổng hợp dữ liệu `computeExecutiveDepartmentSummaries` từ `SchoolTask[]` phân nhóm theo 12 đơn vị trường QCET, tính toán RAG tự động và trích xuất Focus Initiative. Xây dựng component `ExecutiveDepartmentCommandCenter` với 3 tầng: Triage Bar, Command Cards Grid, và Inline Drill-down Task Panel. Tích hợp trực tiếp vào Zone 3 của `src/app/page.tsx` làm chế độ xem ưu tiên cho BGH.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Lucide React (`strokeWidth={1.5}`), TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-executive-department-command-center-design.md`

## Global Constraints

- **0% Decorative Emoji:** Toàn bộ biểu tượng sử dụng thư viện `lucide-react` ngữ nghĩa, không dùng emoji trong mã nguồn và nhãn giao diện.
- **Icon Stroke Width:** Toàn bộ Lucide icon sử dụng `strokeWidth={1.5}`.
- **Typography Số Liệu:** Mọi con số (tiến độ %, số lượng task, ngày deadline) sử dụng `font-mono tabular-nums`.
- **Semantic Color Tokens:** Dùng semantic Tailwind classes (`bg-destructive/10 text-destructive`, `bg-amber-500/10 text-amber-600 dark:text-amber-400`, `bg-primary/10 text-primary`, `border-border/60`).
- **Performance:** Dynamic import SSR-safe cho các view điều hành cấp cao.

---

### Task 1: Định nghĩa Types và Thuật toán Aggregator & Trích xuất Việc Trọng Tâm

**Files:**
- Create: `src/types/executive-command.ts`
- Create: `src/lib/tasks/executive-department-aggregator.ts`
- Create: `tests/executive-department-aggregator.test.ts`

**Interfaces:**
- Produces:
  - `ExecutiveRAGStatus`, `ExecutiveTriageFilter`, `FocusInitiative`, `ExecutiveDepartmentSummary`
  - `computeExecutiveDepartmentSummaries(tasks: SchoolTask[]): ExecutiveDepartmentSummary[]`

- [ ] **Step 1: Viết test kiểm tra tính toán RAG và trích xuất Việc trọng tâm**

```typescript
// tests/executive-department-aggregator.test.ts
import { describe, it, expect } from "vitest";
import { computeExecutiveDepartmentSummaries } from "@/lib/tasks/executive-department-aggregator";
import type { SchoolTask } from "@/types/dashboard";

describe("Executive Department Aggregator", () => {
  it("gán đúng RAG status RED khi có task quá hạn", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-cntt-1",
        title: "Kiểm định chất lượng CNTT",
        category: "DAO_TAO",
        categoryLabel: "Đào tạo",
        leadAssigneeName: "TS. Nguyễn Văn A (Khoa CNTT)",
        coAssignees: [],
        assignedDate: "2026-08-01",
        dueDate: "2026-08-20", // Overdue
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 2,
        completedSubTasks: 0,
        progressPercent: 20,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks);
    const cntt = summaries.find((s) => s.departmentId === "KHOA_CNTT");
    expect(cntt).toBeDefined();
    expect(cntt?.ragStatus).toBe("RED");
    expect(cntt?.metrics.overdue).toBe(1);
  });

  it("trích xuất chính xác Focus Initiative cho đơn vị", () => {
    const mockTasks: SchoolTask[] = [
      {
        id: "task-dt-1",
        title: "Xếp thời khóa biểu Học kỳ I",
        category: "DAO_TAO",
        categoryLabel: "Đào tạo",
        leadAssigneeName: "Phòng Đào tạo",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-15",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 3,
        completedSubTasks: 1,
        progressPercent: 33,
      },
    ];

    const summaries = computeExecutiveDepartmentSummaries(mockTasks);
    const dt = summaries.find((s) => s.departmentId === "PHONG_DT");
    expect(dt?.focusInitiative).toBeDefined();
    expect(dt?.focusInitiative?.title).toBe("Xếp thời khóa biểu Học kỳ I");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test fail**

Run: `npm test tests/executive-department-aggregator.test.ts`
Expected: FAIL vì file chưa được tạo.

- [ ] **Step 3: Khai báo types và hiện thực `computeExecutiveDepartmentSummaries`**

Tạo `src/types/executive-command.ts` và `src/lib/tasks/executive-department-aggregator.ts` đáp ứng logic RAG và trích xuất Focus Initiative theo spec.

- [ ] **Step 4: Chạy test để xác nhận test pass**

Run: `npm test tests/executive-department-aggregator.test.ts`
Expected: PASS 100%.

- [ ] **Step 5: Commit**

```bash
git add src/types/executive-command.ts src/lib/tasks/executive-department-aggregator.ts tests/executive-department-aggregator.test.ts
git commit -m "feat(tasks): implement executive department summaries and focus initiative extractor"
```

---

### Task 2: Xây dựng UI Component Thẻ Chỉ Huy Đơn Vị & Thanh Lăng Kính Điều Hành

**Files:**
- Create: `src/components/tasks/executive-department-command-center.tsx`
- Modify: `src/types/workspace.ts` (nếu cần mở rộng view modes)

**Interfaces:**
- Consumes: `ExecutiveDepartmentSummary`, `computeExecutiveDepartmentSummaries` từ Task 1
- Produces: `ExecutiveDepartmentCommandCenter` component

- [ ] **Step 1: Xây dựng component `ExecutiveDepartmentCommandCenter`**
- Thanh lọc 3 lăng kính (Quick Triage Tabs: Tất cả, Điểm nghẽn cần BGH chỉ đạo, Chờ BGH ký duyệt).
- Lưới 12 thẻ chỉ huy đơn vị `DepartmentCommandCard` hiển thị RAG badge, Avatar Trưởng đơn vị, khung Focus Initiative, tiến độ %, và bộ 3 chỉ số (`Đang làm | Sắp hạn | Trễ hạn`).
- Đảm bảo 100% icon có `strokeWidth={1.5}` và 0% emoji.

- [ ] **Step 2: Kiểm tra render component bằng test snapshot / render test**

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/executive-department-command-center.tsx
git commit -m "feat(tasks): create executive department command center component"
```

---

### Task 3: Tích hợp Drill-down Chi Tiết Nhiệm Vụ Đơn Vị

**Files:**
- Modify: `src/components/tasks/executive-department-command-center.tsx`

**Interfaces:**
- Thêm cơ chế chọn đơn vị (`selectedDeptId`) và hiển thị panel nhiệm vụ riêng của đơn vị đó ngay bên dưới hoặc inline drawer.
- Cho phép xem phân loại: *Nhiệm vụ Cấp Trường giao xuống* vs *Nhiệm vụ Nội bộ đơn vị*.
- Cho phép bấm vào từng nhiệm vụ để mở `TaskDetailSideSheet` đã có của hệ thống.

- [ ] **Step 1: Viết test cho hành vi chọn đơn vị và drill-down**
- [ ] **Step 2: Cập nhật component để bung panel drill-down khi click thẻ đơn vị**
- [ ] **Step 3: Chạy test để xác nhận pass**
- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/executive-department-command-center.tsx
git commit -m "feat(tasks): add inline department task drill-down panel"
```

---

### Task 4: Tích hợp vào `src/app/page.tsx` và Toolbar điều khiển

**Files:**
- Modify: `src/components/tasks/unified-task-toolbar.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Bổ sung chế độ xem `"executive"` trên `UnifiedTaskToolbar` cho user có quyền `ADMIN`/BGH.
- Khi user là ADMIN, mặc định hiển thị `ExecutiveDepartmentCommandCenter` trong `activeZone === "tasks"`.
- Liên kết callback `onSelectTask` mở `TaskDetailSideSheet`.

- [ ] **Step 1: Cập nhật `UnifiedTaskToolbar` để hỗ trợ chế độ "executive" ("Chỉ huy BGH")**
- [ ] **Step 2: Tích hợp vào Zone 3 của `src/app/page.tsx`**
- [ ] **Step 3: Chạy toàn bộ test suites**

Run: `npm test`
Expected: T��t cả suites đều pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/unified-task-toolbar.tsx src/app/page.tsx
git commit -m "feat(dashboard): integrate executive department command center into tasks zone"
```

---

### Task 5: Anti-Slop Audit & Design Token Compliance Test

**Files:**
- Create: `tests/executive-department-command-center.test.ts`

**Interfaces:**
- Quét mã nguồn component mới để kiểm tra:
  - 0 emoji trang trí.
  - 100% Lucide icon có `strokeWidth={1.5}`.
  - Toàn bộ chỉ số số học dùng `font-mono tabular-nums`.

- [ ] **Step 1: Viết test audit anti-slop**
- [ ] **Step 2: Chạy test xác nhận pass**
- [ ] **Step 3: Commit**

```bash
git add tests/executive-department-command-center.test.ts
git commit -m "test(audit): enforce anti-slop rules on executive command center"
```

---

### Task 6: Kiểm tra Full Build và Xác Nhận Trên Trình Duyệt

**Files:**
- Toàn bộ codebase

- [ ] **Step 1: Chạy Typecheck**

Run: `npm run typecheck`
Expected: 0 lỗi.

- [ ] **Step 2: Chạy Production Build**

Run: `npm run build`
Expected: Build thành công 100%.

- [ ] **Step 3: Kiểm thử trên browser preview tại `http://localhost:3001/?zone=tasks`**

Xác thực bằng `preview_snapshot`, `preview_click`, `preview_screenshot`.
- [ ] **Step 4: Commit kết thúc**
