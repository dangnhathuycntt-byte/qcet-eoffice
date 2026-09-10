---
status: completed
domain: data
created: 2026-09-09
---

# QCET E-Office — Data Trust, Correctness & Additional UI/UX Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triệt tiêu 8 lỗi dữ liệu và tương tác P0 nghiêm trọng (Data Trust & Correctness) được phát hiện trong Additional UI/UX Source Audit, bảo đảm toàn bộ số liệu, bộ lọc, thời hạn, năm học và trạng thái người dùng tuân theo Một Nguồn Sự Thật Duy Nhất (Single Source of Truth).

**Architecture:** Thiết lập hợp đồng dữ liệu chuẩn `WorkspaceMetrics` phân tách rõ ràng mẫu số đo lường; hợp nhất bộ máy lọc `filterTaskTree` trong `UnifiedAdaptiveWorkspace` xử lý trung thực `currentOverdue` và `currentWorkbox`; xóa bỏ dropdown chọn tháng trùng lặp trong `task-table-toolbar.tsx`; chuẩn hóa năm học động qua `getCurrentAcademicPeriod()`; xóa bỏ toàn bộ dữ liệu giả lập/tổng hợp suy diễn trong `dashboard-service.ts`; kết nối số liệu thật cho `/portal` và xóa bỏ `document.documentElement.style.zoom`; bảo đảm tính nhất quán phiên đăng nhập giữa server và client trong `auth-context.tsx`.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4 (Light-Only Standard OKLCH), Lucide Icons, Node.js Test Runner (`tsx --test`).

**Spec:** `# QCET E-Office — Additional UI/UX Source Audit` (P0-1 to P0-8, P1-9 to P1-17).

## Global Constraints

- **Chuẩn Light-Only bất biến:** Toàn bộ giao diện sử dụng thuần túy Light Mode (OKLCH color system). Cấm class `dark:`, cấm selector `.dark`, cấm `ThemeProvider`.
- **An toàn Build & Dev Cache:** Tuyệt đối không chạy `next build` khi dev server đang chạy. Kiểm tra bằng `npm run typecheck` và `npm test`.
- **Zero Mock & Zero Synthesized Fallback:** Tuyệt đối không tạo dữ liệu giả lập hay category suy diễn để "lấp đầy UI". Không có dữ liệu hiển thị "Chưa có dữ liệu".
- **Toán học & Metric Nhất Quán (1 Metric = 1 Định nghĩa):** Tuyệt đối không cộng gộp parent task và subtask vào cùng một mẫu số tính tỉ lệ hoàn thành.
- **Một Hệ Quy Chiếu Ngày Hệ Thống (1 Deadline = 1 Date Engine):** Toàn bộ phép tính quá hạn dùng `getSystemReferenceDate()` và `isTaskPastDue()`. Cấm `new Date().toISOString().split('T')[0]`.
- **Một Nguồn Năm Học Duy Nhất (1 Academic Period = 1 Source):** Toàn bộ năm học và học kỳ lấy từ `academic-calendar.ts`.
- **Một Bộ Máy Lọc Đồng Bộ (1 Filter = UI State = Data State = URL State):** Khi breadcrumb hoặc state ghi "Quá hạn" hay "Chờ tôi duyệt", danh sách task bắt buộc phải lọc chính xác.

---

## File Structure & Module Map

| File Path | Role & Responsibility |
| :--- | :--- |
| `src/components/workspace/hooks/use-adaptive-workspace-data.ts` | Khởi tạo hợp đồng `WorkspaceMetrics` phân tách parent tasks, work items và subtasks; dùng `isTaskPastDue` |
| `src/components/workspace/unified-adaptive-workspace.tsx` | Kết nối bộ lọc canonical cho `currentOverdue` và `currentWorkbox` khớp tuyệt đối với Breadcrumb |
| `src/components/tasks/table/components/task-table-toolbar.tsx` | Loại bỏ Month Selector trùng lặp, chuẩn hóa một component bộ lọc thời gian học vụ duy nhất |
| `src/lib/academic-calendar.ts` | Bổ sung hàm `getCurrentAcademicPeriod()`, xuất thông tin năm học hiện tại (2026-2027) chuẩn xác |
| `src/lib/server/dashboard-service.ts` | Xóa bỏ mapping category giả lập (`CHUYEN_DOI_SO`/`CNTT`) và `leadName: d.name`, trả về dữ liệu thật hoặc null |
| `src/app/portal/page.tsx` | Loại bỏ số liệu hardcode (32%, 94 việc), kết nối API tổng quan thật, xóa bỏ CSS `style.zoom` |
| `src/contexts/auth-context.tsx` | Tách biệt trạng thái `offlineReadOnly` khi server trả về 401 thay vì giả định session hợp lệ |

---

### Task 1: Workspace Metrics Contract & Denominator Separation (P0-1 & P0-5)

**Files:**
- Modify: `src/components/workspace/hooks/use-adaptive-workspace-data.ts:130-170`
- Test: `tests/workspace-metrics-contract.test.ts`

**Interfaces:**
- Produces: `WorkspaceMetrics`:
  ```ts
  export interface WorkspaceMetrics {
    totalParentTasks: number;
    completedParentTasks: number;
    parentCompletionRate: number;
    waitingApprovalCount: number; // Chỉ tính nhiệm vụ cần duyệt trong phạm vi
    urgentOverdueCount: number;   // Chỉ tính nhiệm vụ quá hạn dựa theo isTaskPastDue
    totalSubtasks: number;
    completedSubtasks: number;
    totalWorkItems: number; // totalParentTasks + totalSubtasks
  }
  ```

- [ ] **Step 1: Viết test cho WorkspaceMetrics Contract**
Tạo `tests/workspace-metrics-contract.test.ts` kiểm thử tính đúng đắn của mẫu số: tỉ lệ hoàn thành tính trên parent tasks hoặc hiển thị rõ phân tách subtask; tính overdue bằng `isTaskPastDue(t.dueDate)`.
- [ ] **Step 2: Chạy test để xác nhận test fails**
Run: `npx tsx --test tests/workspace-metrics-contract.test.ts`
- [ ] **Step 3: Cập nhật use-adaptive-workspace-data.ts**
Cập nhật phép tính thống kê: dùng `isTaskPastDue` từ `@/lib/academic-calendar`, xuất đầy đủ `WorkspaceMetrics` chuẩn mực, không cộng dồn sai mẫu số.
- [ ] **Step 4: Chạy test để xác nhận test passes**
Run: `npx tsx --test tests/workspace-metrics-contract.test.ts`
- [ ] **Step 5: Commit**
```bash
git add src/components/workspace/hooks/use-adaptive-workspace-data.ts tests/workspace-metrics-contract.test.ts
git commit -m "fix(workspace): enforce workspace metrics contract and reference date evaluation"
```

---

### Task 2: Canonical Filter Engine & Workbox/Overdue Consistency (P0-2 & P0-5)

**Files:**
- Modify: `src/components/workspace/unified-adaptive-workspace.tsx:270-300`
- Test: `tests/canonical-filter-engine-sync.test.ts`

**Interfaces:**
- Consumes: `scopedTasks`, `currentOverdue`, `currentWorkbox`, `currentStatus`, `currentSearch`
- Produces: `displayedTasks` được lọc thực sự theo cả `currentOverdue` (dùng `isTaskPastDue`) và `currentWorkbox` (`my_pending_approval`, `my_pending_submission`, `my_tasks`, `overdue`).

- [ ] **Step 1: Viết test kiểm tra filter đồng bộ giữa breadcrumb và displayedTasks**
Tạo `tests/canonical-filter-engine-sync.test.ts` kiểm thử khi `currentOverdue = true` hoặc `currentWorkbox = "my_pending_approval"`, `displayedTasks` phải loại bỏ các task không thỏa điều kiện.
- [ ] **Step 2: Chạy test để xác nhận test fails**
Run: `npx tsx --test tests/canonical-filter-engine-sync.test.ts`
- [ ] **Step 3: Cập nhật displayedTasks logic trong unified-adaptive-workspace.tsx**
Áp dụng bộ lọc `isTaskPastDue(t.dueDate, getSystemReferenceDate())` và xử lý triệt để nhánh `currentWorkbox`.
- [ ] **Step 4: Chạy test để xác nhận test passes**
Run: `npx tsx --test tests/canonical-filter-engine-sync.test.ts`
- [ ] **Step 5: Commit**
```bash
git add src/components/workspace/unified-adaptive-workspace.tsx tests/canonical-filter-engine-sync.test.ts
git commit -m "fix(workspace): harmonize overdue and workbox filters with task tree display"
```

---

### Task 3: Unify Month Selector in TaskTableToolbar & Dynamic Academic Period (P0-3 & P0-4)

**Files:**
- Modify: `src/lib/academic-calendar.ts`
- Modify: `src/components/tasks/table/components/task-table-toolbar.tsx:315-430`
- Test: `tests/academic-period-selector-unification.test.ts`

**Interfaces:**
- Produces: `getCurrentAcademicPeriod(): { academicYear: string; semester: number; month: number; label: string }`
- Produces: Single Academic Month dropdown in `task-table-toolbar.tsx` (loại bỏ dropdown thứ hai trùng lặp).

- [ ] **Step 1: Viết test cho Academic Period và Single Month Selector**
Tạo `tests/academic-period-selector-unification.test.ts` xác minh `getCurrentAcademicPeriod()` trả về đúng năm 2026-2027 và `task-table-toolbar.tsx` chỉ render đúng một bộ lọc tháng.
- [ ] **Step 2: Chạy test để xác nhận test fails**
Run: `npx tsx --test tests/academic-period-selector-unification.test.ts`
- [ ] **Step 3: Cập nhật academic-calendar.ts và task-table-toolbar.tsx**
Bổ sung `getCurrentAcademicPeriod()` trong `academic-calendar.ts`. Xóa khối selector thừa thứ hai (dòng 406) trong `task-table-toolbar.tsx`.
- [ ] **Step 4: Chạy test để xác nhận test passes**
Run: `npx tsx --test tests/academic-period-selector-unification.test.ts`
- [ ] **Step 5: Commit**
```bash
git add src/lib/academic-calendar.ts src/components/tasks/table/components/task-table-toolbar.tsx tests/academic-period-selector-unification.test.ts
git commit -m "fix(tasks): unify academic month selector and export dynamic academic period"
```

---

### Task 4: Eradicate Mockup & Synthesized Placeholder Semantics in Dashboard Service (P0-6)

**Files:**
- Modify: `src/lib/server/dashboard-service.ts:350-450`
- Test: `tests/dashboard-service-trust.test.ts`

**Interfaces:**
- Produces: Clean `DepartmentHealth` và Task distribution data mà không có synthetic mapping `isSchool ? "CHUYEN_DOI_SO" : "CNTT"` hay `leadName: d.name`.

- [ ] **Step 1: Viết test kiểm tra tính trung thực của dashboard service**
Tạo `tests/dashboard-service-trust.test.ts` kiểm thử service không được tự bịa category hoặc gán tên phòng ban vào tên trưởng đơn vị.
- [ ] **Step 2: Chạy test để xác nhận test fails**
Run: `npx tsx --test tests/dashboard-service-trust.test.ts`
- [ ] **Step 3: Cập nhật dashboard-service.ts**
Sử dụng category thực tế của task hoặc null/UNSPECIFIED; sử dụng tên trưởng đơn vị thực tế từ database hoặc null ("Chưa phân công").
- [ ] **Step 4: Chạy test để xác nhận test passes**
Run: `npx tsx --test tests/dashboard-service-trust.test.ts`
- [ ] **Step 5: Commit**
```bash
git add src/lib/server/dashboard-service.ts tests/dashboard-service-trust.test.ts
git commit -m "fix(dashboard): remove synthetic category fallbacks and placeholder lead names"
```

---

### Task 5: Real Data Binding for /portal & Eradicate CSS Zoom (P0-7 & P1-12)

**Files:**
- Modify: `src/app/portal/page.tsx`
- Test: `tests/portal-kpi-real-data.test.ts`

**Interfaces:**
- Produces: `/portal` hiển thị dữ liệu tổng quan thật hoặc redirect/liên kết đến Bàn làm việc chuẩn (`/`); xóa bỏ hoàn toàn `style.zoom`.

- [ ] **Step 1: Viết test cho /portal**
Tạo `tests/portal-kpi-real-data.test.ts` kiểm tra không có hardcoded string "32% hoàn thành (340 việc)" và không có `document.documentElement.style.zoom`.
- [ ] **Step 2: Chạy test để xác nhận test fails**
Run: `npx tsx --test tests/portal-kpi-real-data.test.ts`
- [ ] **Step 3: Cập nhật /portal/page.tsx**
Xóa hardcoded KPIs, kết nối API hoặc chuyển đổi thành landing view đồng bộ với hệ thống; loại bỏ CSS zoom.
- [ ] **Step 4: Chạy test để xác nhận test passes**
Run: `npx tsx --test tests/portal-kpi-real-data.test.ts`
- [ ] **Step 5: Commit**
```bash
git add src/app/portal/page.tsx tests/portal-kpi-real-data.test.ts
git commit -m "fix(portal): eliminate hardcoded KPIs and eradicate CSS zoom usage"
```

---

### Task 6: Session Consistency & Auth State Guard (P0-8)

**Files:**
- Modify: `src/contexts/auth-context.tsx`
- Test: `tests/auth-session-consistency.test.ts`

**Interfaces:**
- Produces: `isOfflineReadOnly: boolean` và cảnh báo rõ ràng khi session server 401 nhưng còn cached identity trong localStorage.

- [ ] **Step 1: Viết test cho auth session consistency**
Tạo `tests/auth-session-consistency.test.ts` kiểm tra khi `/api/auth/me` trả về 401/lỗi xác thực, hệ thống không coi người dùng là authenticated hợp lệ để thực hiện mutation.
- [ ] **Step 2: Chạy test để xác nhận test fails**
Run: `npx tsx --test tests/auth-session-consistency.test.ts`
- [ ] **Step 3: Cập nhật auth-context.tsx**
Đánh dấu `isOfflineReadOnly = true` khi dùng cached profile và server 401; ngăn ngừa hành động tạo/duyệt ngầm với session hết hạn.
- [ ] **Step 4: Chạy test để xác nhận test passes**
Run: `npx tsx --test tests/auth-session-consistency.test.ts`
- [ ] **Step 5: Commit**
```bash
git add src/contexts/auth-context.tsx tests/auth-session-consistency.test.ts
git commit -m "fix(auth): guard session state and enforce offline read-only mode on 401"
```
