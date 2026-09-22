# Component & Identifier Naming Conventions

## Nguyên tắc cốt lõi

Tên component, hook, type, interface phải mô tả **chức năng** (domain + role), không tham chiếu tên sản phẩm/thương hiệu bên ngoài.

## 1. Không dùng tên brand bên ngoài làm prefix

❌ **KHÔNG LÀM:**
```
LinearPropertiesSidebar    → dùng tên sản phẩm Linear
NotionBlockContent         → dùng tên sản phẩm Notion
TwentyDashboard            → dùng tên sản phẩm Twenty
```

✅ **ĐÚNG CÁCH — Domain + Role:**
```
TaskPropertiesSidebar      → Task (domain) + PropertiesSidebar (role)
TaskBlockEditor            → Task (domain) + BlockEditor (role)
TaskHubDashboard           → TaskHub (domain) + Dashboard (role)
```

### Ngoại lệ hợp lệ
- **Tích hợp thực sự**: `GoogleLoginButton`, `PrismaClient`, `NotionApiClient` — component IS the integration
- **Dữ liệu tổ chức**: `QCET_DEPARTMENTS`, `QCETNotification` — QCET là tên sản phẩm/tổ chức của dự án
- **Thuật ngữ generic**: `KanbanBoard`, `ZoomToggle` — kanban là methodology, zoom là hành động UI

## 2. Pattern đặt tên

### Components: `[Domain][Role]`
| Domain | Role | Tên |
|--------|------|-----|
| Task | PropertiesSidebar | `TaskPropertiesSidebar` |
| Task | DetailView | `TaskDetailView` |
| Task | BlockEditor | `TaskBlockEditor` |
| Task | PeekPreviewModal | `TaskPeekPreviewModal` |
| Create | TaskModal | `CreateTaskModal` |
| Inbox | View | `InboxView` |

### Hooks: `use[Domain][Action]`
```
useTaskShortcuts           ✅ (không phải useLinearTaskShortcuts)
usePersonnelList           ✅
useDepartmentList          ✅
```

### Types/Interfaces: `[Domain][Noun]`
```
ContentBlockType           ✅ (không phải NotionBlockType)
ContentBlockItem           ✅ (không phải NotionBlockItem)
TaskDetailViewProps         ✅
CreateTaskModalProps        ✅
```

### File: kebab-case khớp tên component
```
TaskPropertiesSidebar  → task-properties-sidebar.tsx
TaskBlockEditor        → task-block-editor.tsx
CreateTaskModal        → create-task-modal.tsx
useTaskShortcuts       → use-task-shortcuts.ts
```

## 3. data-slot: kebab-case, không brand
```
data-slot="task-properties-sidebar"    ✅
data-slot="task-block-editor"          ✅
data-slot="create-task-modal"          ✅

data-slot="linear-properties-sidebar"  ❌
data-slot="twenty-dashboard"           ❌
```

## 4. CSS custom properties: không brand prefix
```
--subtask-peek-width       ✅
--qcet-subtask-peek-width  ❌ (trừ khi là product-wide namespace)
```

> **localStorage keys đã deploy**: Giữ nguyên giá trị hiện tại (VD: `qcet_subtask_peek_width`) để không mất data người dùng.

## 5. Comments: Không tham chiếu design inspiration
```
// Compact column header          ✅
// Linear Column Header           ❌

// Minimal flat style             ✅
// Linear Flat Style              ❌

{/* Quick Create Task Button */}  ✅
{/* Linear-style Quick Create */} ❌
```

## 6. Domain utilities: Dùng canonical, không duplicate

Khi cần logic nghiệp vụ, **import từ domain layer**, không copy inline:

| Nhu cầu | Import từ | KHÔNG tự viết |
|---------|-----------|---------------|
| Status normalization | `normalizeDisplayStatus` từ `@/domain/tasks/canonical-semantics` | Inline if/switch |
| Due date status | `computeDueStatus` từ `@/domain/tasks/deadlines` | Copy function |
| Status/Priority display | `CORE_STATUS_OPTIONS`, `PRIORITY_DISPLAY_CONFIG` từ `@/domain/tasks/display-config` | Hardcoded arrays |
| FSM guard | `taskStateMachine` từ `@/domain/tasks/state-machine` | Không guard |
| Personnel list | `usePersonnelList` từ `@/hooks/use-personnel-list` | Inline fetch |
| Department list | `useDepartmentList` từ `@/hooks/use-department-list` | Inline fetch |
