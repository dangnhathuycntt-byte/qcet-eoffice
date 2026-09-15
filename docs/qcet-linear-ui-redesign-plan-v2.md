# QCET Work --- Linear-Inspired Task UX Redesign Plan v2

> Mục tiêu: tái cấu trúc trải nghiệm quản lý nhiệm vụ của QCET Work theo
> các nguyên tắc tương tác hiệu quả của Linear, nhưng giữ đúng mô hình
> nghiệp vụ QCET, tiếng Việt tự nhiên, 100% light theme, accessibility
> và kiến trúc hiện có.
>
> Phạm vi: `/tasks`, task detail, create-task flow, keyboard
> interaction, context menu, peek preview và lớp shell liên quan. Không
> biến QCET thành bản sao Linear; ưu tiên workflow của trường.

------------------------------------------------------------------------

## 0. Kết luận kiến trúc trước khi triển khai

### 0.1. Những quyết định giữ nguyên

-   100% light theme.
-   Bảng nhiệm vụ phẳng, giảm card/container.
-   Click/Enter mở task detail đầy đủ thay cho drawer.
-   Context menu cho thao tác nhanh.
-   Peek preview bằng `Space`.
-   Modal tạo nhiệm vụ gọn, có AI hỗ trợ.
-   Team → Đơn vị/phòng ban; Member → Nhân sự; Lead → Người chủ trì.
-   Không mở rộng thêm nghiệp vụ BGH trong đợt redesign này.
-   Xác thực cuối bằng `npm run build`.

### 0.2. Những điểm sửa so với plan cũ

1.  **Không hard-code shortcut `n → p` ngay từ đầu.** Shortcut phải đi
    qua một `ShortcutRegistry`, không kích hoạt khi đang nhập liệu, hỗ
    trợ Windows/macOS và có khả năng đổi mapping sau này.
2.  **Không dùng hover làm "selection".** Tách rõ `hoveredTaskId`,
    `focusedTaskId`, `selectedTaskIds`, `previewTaskId`, `openedTaskId`.
3.  **Không render detail chỉ bằng local `selectedTask`.** Task detail
    phải có URL canonical để refresh/deep-link/back-forward hoạt động
    đúng.
4.  **Không gọi mọi danh sách là ARIA grid nếu chưa implement đầy đủ
    keyboard contract.** Nếu bảng chủ yếu để đọc + mở task, ưu tiên
    semantic `<table>`; chỉ dùng `role="grid"` nếu thật sự cần
    cell-level navigation/editing.
5.  **Context menu không được là đường duy nhất để thao tác.** Các
    action quan trọng phải có keyboard/overflow equivalent.
6.  **Peek không được phá hành vi Space của checkbox/button/input.**
7.  **AI Agent là enhancement, không chặn create-task flow.** Form thủ
    công phải hoạt động hoàn chỉnh kể cả AI lỗi/chậm/tắt.
8.  **Không làm một "big-bang component rewrite".** Triển khai theo
    vertical slices có acceptance criteria và rollback rõ ràng.
9.  **Bổ sung responsive/mobile strategy.** Context menu, keyboard và
    bảng desktop không thể được bê nguyên sang mobile.
10. **Bổ sung performance budget, accessibility acceptance và telemetry
    UX.**

------------------------------------------------------------------------

# 1. Product principles

## P1 --- Content first

Canvas dành cho dữ liệu và quyết định công việc, không dành cho lớp bọc
trang trí.

-   Không card lồng card.
-   Không shadow cho vùng dữ liệu chính.
-   Divider hairline thay cho container.
-   Khoảng trắng dùng để tạo hierarchy, không dùng box.
-   `max-width` chỉ đặt ở cấp shell; child page không tiếp tục lồng
    nhiều `max-w-*`.

## P2 --- One task, one canonical state

Một nhiệm vụ chỉ có một nguồn trạng thái UI rõ ràng:

``` ts
type TaskInteractionState = {
  focusedTaskId: string | null
  previewTaskId: string | null
  selectedTaskIds: Set<string>
  contextTaskId: string | null
}
```

Task đang mở đầy đủ được suy ra từ route, không lưu như một bản sao
state riêng.

## P3 --- URL is navigation state

Đề xuất canonical route:

``` text
/tasks
/tasks/[taskId]
/tasks/[taskId]?tab=activity
/tasks/[taskId]?tab=subtasks
```

Filter/sort/view quan trọng của `/tasks` được encode trong query params
để refresh, back/forward và share link không làm mất ngữ cảnh.

Ví dụ:

``` text
/tasks?scope=unit&status=in_progress&sort=due_date
```

## P4 --- Progressive disclosure

-   Hành động thường xuyên: hiện trực tiếp.
-   Hành động ít dùng: overflow/context menu.
-   Metadata quan trọng: hiện ở table/detail.
-   Metadata phụ: properties sidebar.
-   AI: mở khi người dùng chủ động gọi.

## P5 --- Keyboard-first, not keyboard-only

Mọi chức năng phải dùng được bằng keyboard, nhưng shortcut không thay
thế control hiển thị.

## P6 --- QCET language, Linear interaction quality

Không bê nguyên thuật ngữ tiếng Anh của Linear nếu tiếng Việt có cách
gọi tự nhiên.

-   Team → Đơn vị
-   Lead → Người chủ trì
-   Members → Người phối hợp
-   Target date → Hạn hoàn thành
-   Health → Tình trạng
-   Issues → Đầu việc con
-   Activity → Nhật ký
-   Create with Agent → Soạn cùng AI

------------------------------------------------------------------------

# 2. Information architecture

## 2.1. `/tasks` --- Task repository

Page hierarchy:

``` text
Page header
├── Breadcrumb / title
├── Search
├── Scope switcher
├── Filter
├── Sort / display
└── Primary CTA: Giao việc

Optional active-filter row
└── removable filter chips

Task table
├── table header
├── task rows
└── empty/loading/error states
```

Không thêm KPI cards phía trên table trong redesign này. Nếu KPI không
giúp quyết định trực tiếp trong task repository, để dashboard xử lý.

## 2.2. `/tasks/[taskId]` --- Task detail

``` text
Detail topbar
├── Back to tasks
├── task code
├── title
├── copy link
└── more actions

Detail tabs
├── Tổng quan
├── Nhật ký
└── Đầu việc con

Main layout
├── content column
│   ├── summary
│   ├── description
│   ├── progress update
│   ├── resources/evidence
│   └── subtasks/milestones
└── properties rail
    ├── status
    ├── priority
    ├── owner
    ├── department
    ├── collaborators
    ├── dates
    └── labels
```

Không lặp cùng một property strip ở cả đầu cột trái và sidebar nếu không
có lý do thao tác rõ ràng. Mặc định properties chỉ có một nguồn hiển
thị/edit ở rail; phần đầu nội dung chỉ giữ 2--4 tín hiệu quan trọng nếu
cần.

------------------------------------------------------------------------

# 3. Task list specification

## 3.1. Desktop columns

Thứ tự ưu tiên:

  Column             Priority Notes
  ---------------- ---------- --------------------------------
  Task                     P0 Mã + tên; chiếm phần lớn width
  Tình trạng               P0 trạng thái sức khỏe công việc
  Ưu tiên                  P1 icon + accessible label
  Chủ trì                  P0 avatar + tên
  Hạn hoàn thành           P0 ngày VN, overdue emphasis
  Đầu việc                 P2 count
  Tiến độ                  P1 icon/progress + số %

Không để tất cả cột co đều. `Task` phải có min-width lớn; metadata
columns có width ổn định.

## 3.2. Row states

Phải thiết kế riêng:

-   default
-   hover
-   keyboard focus
-   selected
-   context-menu-open
-   overdue
-   disabled/read-only

`hover` không đồng nghĩa `focus`; `focus` phải có indicator nhìn thấy
rõ.

## 3.3. Row interactions

-   Click tên/dòng → `/tasks/[taskId]`.
-   `Enter` trên row đang focus → mở detail.
-   `↑` / `↓` → đổi focused row khi table đang ở navigation mode.
-   `Space` → peek task đang focus, chỉ khi event target không phải
    input/textarea/select/button/link/contenteditable/checkbox.
-   Context menu → thao tác nhanh.
-   Multi-select checkbox độc lập với focused row.

## 3.4. Semantic strategy

**Mặc định dùng semantic table** nếu row navigation là nhu cầu chính.

Chỉ chuyển sang ARIA `grid` khi có yêu cầu rõ ràng về cell-level
keyboard navigation/editing và implement đầy đủ roving tabindex/ARIA
contract.

------------------------------------------------------------------------

# 4. Context menu specification

## 4.1. Actions

``` text
Đánh dấu quan trọng
────────────
Đổi trạng thái…        S
Đổi ưu tiên…           P
Đổi người chủ trì…     A
Đổi hạn hoàn thành…    D
────────────
Sao chép liên kết
Sao chép mã nhiệm vụ
Mở chi tiết            Enter
────────────
Xóa nhiệm vụ…
```

Không dùng emoji/star text như một icon production; dùng Lucide icon
thống nhất `strokeWidth={1.5}`.

## 4.2. Accessibility contract

-   Focus chuyển vào menu khi menu mở.
-   Arrow keys di chuyển menu item.
-   `Enter`/`Space` activate.
-   `Escape` đóng và trả focus về row đã gọi menu.
-   Menu không bị clip bởi scroll container.
-   Destructive action có confirm phù hợp.
-   Action không đủ quyền phải disabled hoặc không xuất hiện theo
    permission policy hiện có.

## 4.3. Touch/mobile fallback

Mobile không có right-click. Dùng: - nút `…` ở row/card; - hoặc
long-press chỉ như enhancement, không phải đường duy nhất.

------------------------------------------------------------------------

# 5. Peek preview specification

## 5.1. Purpose

Peek chỉ trả lời nhanh:

1.  Đây là việc gì?
2.  Ai chịu trách nhiệm?
3.  Hạn khi nào?
4.  Đang ở trạng thái nào?
5.  Cần mở full detail không?

Không biến Peek thành một detail page thứ hai.

## 5.2. Content budget

Peek gồm:

-   mã + tên;
-   tình trạng;
-   ưu tiên;
-   chủ trì;
-   hạn hoàn thành;
-   đơn vị;
-   summary/description excerpt;
-   progress;
-   tối đa 3 đầu việc gần nhất hoặc quan trọng.

Không đưa editor đầy đủ, activity feed dài hoặc mọi properties vào Peek.

## 5.3. Keyboard

-   `Space`: open/close khi table focus hợp lệ.
-   `Esc`: close.
-   `↑/↓`: đổi preview task, giữ modal mở.
-   `Enter`: navigate tới canonical detail URL.
-   Khi đóng, focus quay về row nguồn.

Peek phải có focus management rõ ràng; không bắt `Space` toàn cục.

------------------------------------------------------------------------

# 6. Task detail specification

## 6.1. Route behavior

`/tasks/[taskId]` là canonical detail.

Back behavior: 1. Nếu đến từ `/tasks?...`, browser Back giữ nguyên
filters/scroll. 2. Nếu mở deep link trực tiếp, nút "Nhiệm vụ" điều hướng
về `/tasks`.

Không dùng `Escape` để luôn navigate back khỏi full page detail; Escape
dành cho transient surfaces như menu/modal/peek. Điều này tránh thoát
trang ngoài ý muốn.

## 6.2. Layout

Desktop: - content: `minmax(0, 1fr)` - rail: khoảng 300--360 px, không
hard-code 32% nếu gây lãng phí. - sticky rail chỉ khi viewport đủ
cao/rộng và không tạo nested-scroll khó dùng.

Tablet: - rail có thể chuyển thành collapsible section.

Mobile: - single column; - properties đặt sau summary hoặc trong
accordion; - không giữ 2 cột.

## 6.3. Avoid duplication

Plan cũ lặp properties ở inline strip và sidebar. V2: - Header: status +
owner + due date tối đa. - Sidebar: full editable properties. - Nội
dung: không lặp lại cùng metadata.

------------------------------------------------------------------------

# 7. Create task flow

## 7.1. Core form

P0 fields: - Tên nhiệm vụ - Đơn vị - Người chủ trì - Hạn hoàn thành

P1: - Trạng thái - Ưu tiên - Người phối hợp - Ngày bắt đầu - Lĩnh vực -
Mô tả

P2: - Mốc/đầu việc con - tài liệu/minh chứng

Không ép người dùng điền toàn bộ metadata trước khi tạo nếu business
rules không yêu cầu.

## 7.2. Draft safety

Modal cần: - dirty-state tracking; - confirm khi đóng form có thay đổi
chưa lưu; - preserve draft trong session nếu modal vô tình đóng/reload
phù hợp với kiến trúc hiện tại; - disable double submit; -
loading/success/error states.

## 7.3. AI panel

AI là optional assistant:

``` text
User prompt
→ AI proposes structured draft
→ show changed fields
→ user accepts/rejects
→ form remains editable
→ user explicitly creates task
```

Không để AI tự tạo task hoặc silently overwrite dữ liệu người dùng đã
chỉnh.

Các chip: - Xác định mục tiêu & phạm vi - Đề xuất mốc thời gian - Phân
rã đầu việc - Đề xuất người phụ trách

"Đề xuất người phụ trách" chỉ dùng dữ liệu/permission mà hệ thống hiện
có; không suy đoán nhân sự ngoài dữ liệu được phép.

## 7.4. AI failure states

Bắt buộc có: - loading; - timeout; - retry; - malformed response; -
partial suggestion; - AI unavailable.

Mọi failure phải giữ nguyên draft thủ công.

------------------------------------------------------------------------

# 8. Shortcut architecture

Tạo một lớp quản lý shortcut thay vì rải
`window.addEventListener("keydown")` trong nhiều component.

Đề xuất:

``` text
src/lib/shortcuts/
├── registry.ts
├── guards.ts
├── platform.ts
└── task-shortcuts.ts
```

Guard chung:

``` ts
shouldIgnoreShortcut(event)
```

True khi: - input/textarea/select; - contenteditable; - dialog/editor
đang chiếm keyboard; - modifier combination không phù hợp; -
IME/composition đang hoạt động.

Shortcut registry chịu trách nhiệm: - collision detection; - platform
labels (`⌘` vs `Ctrl`); - enable/disable theo route/surface; -
discoverability; - unit tests.

Không mô tả `n → p` là "giữ n rồi bấm p". Chọn một contract duy nhất: -
sequence `N`, sau đó `P` trong timeout ngắn; **hoặc** - chord có
modifier.

Với người dùng phổ thông của QCET, ưu tiên shortcut dễ nhớ nhưng không
xung đột nhập liệu. Shortcut phải là enhancement, không phải
requirement.

------------------------------------------------------------------------

# 9. Responsive strategy

## Desktop ≥ 1280

-   full table;
-   context menu;
-   keyboard navigation;
-   2-column detail;
-   create modal + optional AI side panel.

## Tablet 768--1279

-   hide low-priority columns;
-   detail rail collapsible;
-   create AI panel có thể thành second step/tab.

## Mobile \< 768

Không cố nhét desktop table.

Dùng compact task list: - task name/code; - status; - owner; - due
date; - progress; - overflow `…`.

Detail single-column. Create form full-screen sheet/page. AI assistant
mở như tab/step riêng. Không phụ thuộc right-click/hover/keyboard
shortcut.

------------------------------------------------------------------------

# 10. Accessibility acceptance criteria

Mục tiêu tối thiểu: WCAG 2.2 AA.

-   Mọi chức năng chính dùng được bằng keyboard.
-   Không keyboard trap.
-   Focus visible.
-   Focus không bị che hoàn toàn.
-   Pointer target tối thiểu phù hợp WCAG 2.2.
-   Dialog trap focus đúng và trả focus về trigger khi đóng.
-   Context menu có keyboard semantics.
-   Icon-only controls có accessible name.
-   Status/priority không truyền nghĩa chỉ bằng màu.
-   Table có header semantics.
-   Error form gắn với field bằng semantic/ARIA phù hợp.
-   Reduced motion được tôn trọng.
-   Screen-reader announcement cho create/update success/error khi cần.

------------------------------------------------------------------------

# 11. Visual system

## 11.1. Light-only tokens

Không hard-code hàng loạt `slate-*` trực tiếp nếu project đã có semantic
token.

Ưu tiên:

``` text
--background
--foreground
--muted
--muted-foreground
--border
--accent
--destructive
--focus-ring
```

Theme policy: - chỉ expose light theme; - không cần dark variants; -
contrast vẫn phải đạt accessibility.

## 11.2. Density

Task table desktop target: - compact nhưng không dưới
pointer/accessibility requirement; - text 13--14px cho metadata; -
body/task title 14px; - page title 20--24px; - avoid `font-bold` tràn
lan; - dùng weight để hierarchy, không dùng nhiều màu.

## 11.3. Motion

Motion chỉ dùng cho: - modal/panel enter-exit; - menu; - peek; - small
state transitions.

Không animate layout/table rows vô lý. Tôn trọng
`prefers-reduced-motion`.

------------------------------------------------------------------------

# 12. Component architecture

Đề xuất tổ chức theo capability:

``` text
src/components/tasks/
├── list/
│   ├── task-list-page.tsx
│   ├── task-table.tsx
│   ├── task-row.tsx
│   ├── task-list-toolbar.tsx
│   └── task-list-mobile.tsx
├── detail/
│   ├── task-detail-page.tsx
│   ├── task-detail-header.tsx
│   ├── task-detail-content.tsx
│   └── task-properties-rail.tsx
├── create/
│   ├── create-task-dialog.tsx
│   ├── create-task-form.tsx
│   └── create-task-ai-panel.tsx
├── preview/
│   └── task-peek-dialog.tsx
├── actions/
│   ├── task-context-menu.tsx
│   └── task-action-registry.ts
└── shared/
    ├── task-status.tsx
    ├── task-priority.tsx
    ├── task-owner.tsx
    └── task-progress.tsx
```

Tên `linear-*` không nên trở thành domain architecture lâu dài. Linear
là reference design, QCET mới là product. Component production nên mang
tên theo chức năng.

------------------------------------------------------------------------

# 13. State/data architecture

Không để từng surface tự implement mutation.

Tạo action layer dùng chung:

``` ts
updateTaskStatus(taskId, status)
updateTaskPriority(taskId, priority)
updateTaskOwner(taskId, userId)
updateTaskDueDate(taskId, date)
deleteTask(taskId)
```

Context menu, detail page và create/list đều gọi cùng mutation/action
path.

Yêu cầu: - permission check server-side; - optimistic update chỉ khi
rollback rõ; - invalidate/revalidate nhất quán; - toast/error nhất
quán; - không duplicate business rules ở client.

------------------------------------------------------------------------

# 14. Implementation phases

## Phase 0 --- Repository reconnaissance & baseline

Agent phải đọc code trước khi sửa.

Checklist: - xác định canonical task type/schema; - xác định route hiện
tại; - xác định side sheet hiện tại; - xác định task mutation
APIs/server actions; - xác định permission helpers; - xác định
query/filter state; - xác định design tokens/components hiện có; - xác
định test runner thật sự đang dùng; - chạy baseline test/build phù
hợp; - chụp baseline desktop/tablet/mobile.

**Output:** dependency map + danh sách file thực tế cần sửa. Không tạo
component mới chỉ vì plan dự đoán tên file.

## Phase 1 --- Navigation/state foundation

Deliverables: - canonical `/tasks/[taskId]`; - URL-preserved list
filters; - back/forward behavior; - task interaction state model; -
shortcut registry skeleton.

Acceptance: - refresh detail không mất task; - copy URL mở đúng task; -
back về đúng list state; - không còn phụ thuộc `selectedTask` local để
xác định detail page.

## Phase 2 --- Flat task list

Deliverables: - simplified toolbar; - flush task table; - responsive
mobile list; - row focus/selection states; - loading/empty/error states.

Acceptance: - desktop hierarchy rõ; - không nested card; - không
duplicate search/filter; - keyboard focus visible; - mobile không
horizontal-scroll bắt buộc cho tác vụ chính.

## Phase 3 --- Task detail

Deliverables: - full-page detail; - properties rail; - tabs; -
progress/resources/subtasks integration; - remove/deprecate old side
sheet path.

Acceptance: - no duplicate property blocks; - deep link works; -
permission-safe mutations; - mobile single-column.

## Phase 4 --- Action system + context menu

Deliverables: - shared task action registry; - context menu; - overflow
fallback; - keyboard shortcuts `S/P/A/D` scoped đúng.

Acceptance: - mouse, keyboard và touch đều có equivalent; - focus
returns correctly; - destructive flow protected.

## Phase 5 --- Peek preview

Deliverables: - lightweight preview; - focus restoration; -
next/previous preview.

Acceptance: - Space không fire trong form/control; - Arrow navigation
predictable; - Enter opens canonical detail; - no duplicate data-fetch
explosion.

## Phase 6 --- Create task redesign

Deliverables: - simplified create form; - draft guard; - responsive
behavior; - validation/errors; - shortcut integration.

Acceptance: - manual create works without AI; - double submit
impossible; - dirty close protected; - required business fields only.

## Phase 7 --- AI assistant

Chỉ bắt đầu khi create form ổn định.

Deliverables: - AI side panel; - structured suggestions; - per-field
accept/reject or explicit apply; - retry/error states.

Acceptance: - AI never silently overwrites user edits; - AI failure
never destroys draft; - user explicitly submits final task.

## Phase 8 --- Cleanup

-   remove dead drawer/side-sheet code only after no call sites remain;
-   remove duplicate toolbar/filter implementations;
-   consolidate task status/priority/owner rendering;
-   remove obsolete tests tied to deleted UI;
-   update docs.

------------------------------------------------------------------------

# 15. Verification strategy

Không chạy toàn bộ test suite sau từng thay đổi nhỏ.

## During implementation

Theo slice: 1. typecheck/lint target nếu repo hỗ trợ; 2. test liên quan
trực tiếp; 3. browser/manual check surface vừa sửa.

## At phase boundary

-   relevant unit/component/integration tests;
-   accessibility smoke;
-   responsive smoke.

## Final gate

``` bash
npx tsc --noEmit
npm test -- <relevant task/workspace tests>
npm run build
```

Nếu repository có lint script chính thức, thêm `npm run lint`.

Không hard-code tên test file trong plan cho đến khi Phase 0 xác nhận
chúng tồn tại.

------------------------------------------------------------------------

# 16. Required automated tests

## Routing/state

-   detail deep link;
-   back preserves filters;
-   query params parse/serialize;
-   invalid task ID.

## Keyboard

-   shortcut ignored inside input/editor;
-   row up/down focus;
-   Space peek;
-   Enter detail;
-   Escape closes transient surface;
-   context-menu focus restoration.

## Task actions

-   permission denied;
-   mutation success;
-   mutation failure rollback;
-   destructive confirmation.

## Create

-   required validation;
-   dirty close;
-   double-submit guard;
-   create success/error;
-   AI unavailable still allows manual create.

## Accessibility

Ưu tiên automated axe/component checks nếu stack hiện có hỗ trợ; manual
keyboard check vẫn bắt buộc cho composite interactions.

------------------------------------------------------------------------

# 17. Performance budget

Đặc biệt với danh sách hàng trăm nhiệm vụ:

-   không fetch full description/activity cho mọi row;
-   Peek fetch on demand hoặc prefetch có giới hạn;
-   detail fetch theo route;
-   avoid rerender toàn table khi hover/focus đổi;
-   memoization chỉ sau profiling;
-   virtualization chỉ thêm khi dữ liệu thực tế chứng minh cần;
-   AI bundle/panel không cần nằm trong initial critical path nếu có thể
    lazy-load.

Acceptance: - task list usable nhanh trước khi secondary features tải
xong; - mở context menu/peek không gây noticeable lag; - filter/sort
không reset scroll vô lý.

------------------------------------------------------------------------

# 18. Observability / UX telemetry

Nếu project đã có telemetry infrastructure, đo:

-   task list → detail open;
-   create started → create success;
-   create validation failure;
-   AI opened / suggestion applied / AI failed;
-   context menu action usage;
-   peek usage;
-   task mutation failure.

Không thêm analytics stack mới chỉ để phục vụ redesign nếu project chưa
có.

------------------------------------------------------------------------

# 19. Definition of Done

Redesign chỉ được coi là hoàn thành khi:

-   `/tasks` có hierarchy phẳng, rõ và responsive.
-   `/tasks/[taskId]` là canonical full-page detail.
-   Drawer cũ không còn là primary detail UX.
-   Context menu và overflow dùng chung action layer.
-   Peek hoạt động mà không phá keyboard semantics.
-   Create task manual flow hoàn chỉnh.
-   AI là optional enhancement, có failure handling.
-   URL/back/forward/refresh hoạt động đúng.
-   Desktop/tablet/mobile đều có interaction model hợp lý.
-   Accessibility keyboard/focus đạt acceptance criteria.
-   Server-side authorization không bị bypass bởi UI mới.
-   Không duplicate business rules/mutations.
-   Relevant tests pass.
-   TypeScript sạch.
-   Production build pass.
-   Dead UI paths được dọn sau migration.

------------------------------------------------------------------------

# 20. Prompt thực thi cho coding agent

``` text
Thực thi plan QCET Task UX Redesign v2 trên source hiện tại.

Bắt đầu bằng Phase 0 repository reconnaissance. Đọc repository instructions, task schema, routing, permissions, mutation/API paths, design tokens và test setup thực tế. Đối chiếu plan với code; không giả định tên file trong plan tồn tại.

Sau baseline, triển khai theo vertical slices Phase 1 → Phase 8. Mỗi phase phải:
1. xác định file ownership/dependencies;
2. tái sử dụng primitives/business logic hiện có trước khi tạo mới;
3. giữ server-side authorization;
4. chạy verification nhỏ nhất đủ chứng minh slice vừa sửa;
5. chỉ chuyển phase khi acceptance criteria của phase hiện tại đạt.

Ưu tiên:
- canonical route /tasks/[taskId] và URL state;
- flat task list;
- full-page detail;
- shared task action layer;
- context menu + keyboard accessibility;
- peek preview;
- create task;
- AI assistant cuối cùng.

Không big-bang rewrite. Không thêm dependency nếu primitive hiện có đáp ứng được. Không sao chép Linear pixel-for-pixel; áp dụng interaction principles vào nghiệp vụ QCET và tiếng Việt.

Không chạy full test suite sau từng edit. Chạy targeted tests trong phase; cuối cùng mới chạy typecheck, relevant test suite và npm run build.

Nếu plan mâu thuẫn source, source/domain invariants/authorization thắng; ghi lại deviation và lý do. Không dừng ở việc tóm tắt plan: triển khai code, test và cleanup đến Definition of Done.
```
