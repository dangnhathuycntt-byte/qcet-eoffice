# QCET WORK — TASK & DASHBOARD UX CONSOLIDATION PLAN

**Status:** Active  
**Date:** 2026-09-11  
**Target Subsystems:** Tasks Workspace (`/tasks`), Executive Dashboard (`/`), Attention Engine, URL State  

---

## 1. Mục tiêu cuối

Sau đợt chỉnh sửa này, hệ thống phải có hai surface rõ ràng:

```text
/
BÀN LÀM VIỆC
Decision / Attention View
        │
        ├── Tôi cần xử lý gì?
        ├── Có gì bất thường?
        ├── Đơn vị nào đang có vấn đề?
        └── Chỉ số nào cần chú ý?

/tasks
KHO NHIỆM VỤ
Operational / Management View
        │
        ├── Search
        ├── Filter
        ├── Sort
        ├── Table
        ├── Task detail
        └── Kanban khi cần
```

Carbon khuyến nghị data table cho chính trường hợp người dùng phải duyệt nhiều resource, tìm một record để hành động, sorting/filtering và mở chi tiết theo progressive disclosure. Toolbar của table cũng nên dành cho một số ít global actions, Carbon khuyến nghị tối đa khoảng 5 action trước khi đẩy phần dư vào overflow.

Vì vậy:
- **Dashboard không phải phiên bản khác của `/tasks`.**
- **`/tasks` cũng không phải dashboard có thêm Kanban.**

---

## 2. Các ràng buộc bắt buộc

Không thay:
```text
Next.js 15
React 19
TypeScript
Tailwind CSS 4
PostgreSQL
Prisma
```

- Không thay schema database nếu không phát hiện defect dữ liệu thật.
- Không đổi API contract ngoài những nơi chứng minh được API hiện tại sai.
- Không tạo `AttentionReason` hoặc một hệ thống semantic mới song song với Gate G0.
- Không làm redesign mỹ thuật trước khi hoàn tất hierarchy và semantics.

---

## 3. Kiến trúc semantic đích

Repo thực tế đã có contract rất tốt:
```ts
WorkspaceFilterState {
  scope
  unitId
  month
  date
  status
  attention
  view
  query
  selectedTaskId
}
```

và đã tách rõ:
```text
status    = objective lifecycle
attention = subjective user action backlog
```

Đây phải trở thành **contract canonical duy nhất của UI**.

Hiện `attention-resolver.ts` cũng đã giải quyết:
```text
requires_my_approval
requires_my_action
blocked
overdue
due_soon
```
có cả Separation of Duties: maker không được tự trở thành approver của chính task.

Do đó kiến trúc đích là:
```text
DB TASK STATUS
      │
      ▼
canonical-semantics.ts
      │
      ├──────────────► TaskLifecycleStatus
      │
      ▼
attention-resolver.ts
      │
      └──────────────► UserAttentionType
                             │
                             ▼
                    WorkspaceFilterState
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
          Dashboard                    /tasks
        attention view              operational view
```
Không để component tự invent thêm semantics.

---

## 4. PHASE 0 — Baseline và bảo vệ regression

Tạo branch:
```bash
git checkout -b refactor/task-workspace-attention-first
```

Snapshot behavioral baseline:
| Route | Role | Xác nhận |
| --- | --- | --- |
| `/` | BGH | Dashboard toàn trường |
| `/` | Manager | Dashboard đơn vị |
| `/` | Staff | Dashboard cá nhân |
| `/tasks` | BGH | school/unit/my |
| `/tasks` | Manager | unit/my |
| `/tasks` | Staff | my |
| `/tasks?scope=school` | Staff | phải downgrade, không được xem school |
| `/tasks?view=kanban` | BGH | Kanban vẫn hoạt động |
| `/tasks?month=9` | mọi role | lọc tháng đúng |
| `/tasks?taskId=*` | mọi role | mở task detail đúng |

---

## 5. PHASE 1 — Quick Wins P0

### 5.1 `/tasks` mặc định Table
- File: `src/components/tasks/task-management-workspace.tsx`
- Sửa `initialViewMode = "table"` (giữ hỗ trợ Kanban qua query `view=kanban`).

### 5.2 Xóa lỗi `+ + Giao việc`
- Files: `src/components/workspace/unified-adaptive-workspace.tsx`, `src/components/dashboard/unified-task-toolbar.tsx`
- Sửa label thành `"Giao việc"`, không duplicate dấu `+` khi Lucide `Plus` đã render.

### 5.3 Không tự render 12 tháng
- File: `src/components/dashboard/unified-task-toolbar.tsx`
- Trên `/tasks`, mặc định `showAcademicMonthBar = false`. Month nằm trong Filter popover.
- Khi user chọn tháng (e.g. `month=9`), hiện filter chip `Tháng 9 ×`.

### 5.4 Sửa Suspense fallback theo quyền
- File: `src/domain/tasks/workspace-scope-policy.ts` (canonical helper mới hoặc hợp nhất)
- Cung cấp `resolveDefaultWorkspaceScope(user)` và `authorizeWorkspaceScope(requestedScope, user)`.
- Áp dụng thống nhất cho `page.tsx`, `TasksPageClient`, và `UnifiedAdaptiveWorkspace`.

---

## 6. PHASE 2 — Rút toolbar từ “control wall” thành query bar

- Cấu trúc component: Tách `UnifiedTaskToolbar` thành các sub-components gọn: `TaskScopeSwitcher`, `TaskSearchField`, `TaskAttentionTabs`, `TaskFilterPopover`, `TaskViewMenu`, `TaskPrimaryAction`.
- Primary surface: Chỉ giữ visible trực tiếp: Scope, Search, Giao việc, Attention tabs, Bộ lọc, View toggle compact (`[Bảng ▾]`).
- Month, Department, Category, Priority đưa vào `TaskFilterPopover`.
- Mật độ và Saved Views đưa vào menu phụ (`⋯`).

---

## 7. PHASE 3 — Hợp nhất URL/filter state

- Một URL owner duy nhất: `src/hooks/use-task-workspace-query.ts` (hoặc refactor `use-task-filters.ts`).
- URL canonical contract: `scope`, `dept`, `month`, `date`, `status`, `attention`, `view`, `q`, `taskId`, `viewId`.
- Backward compatibility: Tự động normalize legacy params (`SCHOOL_TASKS`, `workbox=review`, `workbox=my_pending_approval`, `urgent_overdue`, etc.) về canonical keys.

---

## 8. PHASE 4 — UI dùng canonical attention engine

- Không tạo engine mới; sử dụng `resolveUserAttention(task, user)` và `UserAttentionType`.
- Phân biệt rõ `status` (vòng đời khách quan) và `attention` (việc người dùng cần can thiệp).
- Smart pills thích ứng theo quyền: BGH (Tất cả, Chờ tôi duy���t, Quá hạn, Vướng mắc, Sắp đến hạn), Manager (+ Cần tôi xử lý), Staff (Cần tôi xử lý, Quá hạn, Sắp đến hạn).
- Aggregator đếm duy nhất cho Attention counts để các surface (Pills, Queue, Dashboard, Badges) luôn đồng bộ tuyệt đối.

---

## 9. PHASE 5 — Redesign `/tasks` thành operational table

- Tận dụng `ModularCascadingTaskTable`.
- Hierarchy cột: Nhiệm vụ (P0), Phụ trách (P0), Đơn vị (P0), Hạn (P0), Trạng thái (P0), Tiến độ (P1), Hành động (contextual).
- Task row hierarchy rõ nét: Tên nhiệm vụ nổi bật, mã công việc thứ cấp, màu sắc chỉ nhấn mạnh trường hợp ngoại lệ (overdue, blocked, requires_approval).
- Progressive disclosure: Dùng `TaskDetailSideSheet` khi click row, không điều hướng sang trang mới.
- Kanban vẫn hoạt động tốt khi chọn `view=kanban`.

---

## 10. PHASE 6 — Dashboard BGH: Exception-first

- `ExecutiveActionCenter` đóng vai trò primary attention surface, đặt trước analytics khi có việc cần can thiệp.
- Zero-state: Nếu không có việc cần xử lý, hiển thị trạng thái "Hoạt động đang trong tầm kiểm soát" ngắn gọn, không hiển thị hàng loạt số 0.
- `PersonalWorkbench`: Tách theo vai trò (`ExecutiveDashboardContent`, `ManagerWorkbench`, `PersonalWorkbench`). BGH không lặp lại nội dung đã có trong Action Center.

---

## 11. PHASE 7 & 8 — Refactor UnifiedAdaptiveWorkspace & Mobile Alignment

- Thu nhỏ `UnifiedAdaptiveWorkspace` bằng cách extract hooks và composition components sạch sẽ.
- Mobile giữ cùng mental model với Desktop, tinh chỉnh geometry responsive, duy trì touch target >= 44px và tuân thủ WCAG 2.2 AA.

---

## 12. Test Plan & Regression Gates

- `task-workspace-default-view.test.ts`
- `task-toolbar-period-disclosure.test.ts`
- `task-toolbar-primary-action.test.ts`
- `workspace-scope-policy.test.ts`
- `workspace-query-canonicalization.test.ts`
- `workspace-attention-filter.test.ts`
- `workspace-attention-count-consistency.test.ts`
- `executive-dashboard-attention-first.test.ts`
- `executive-dashboard-zero-state.test.ts`
- `workspace-role-boundary.test.ts`
