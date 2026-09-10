# R6 Accessibility (WCAG 2.2 AA), Keyboard Navigation, Target Size & Responsive Parity Audit

**Document**: `docs/agent-work/audits/R6-a11y-responsive.md`  
**Auditor**: Agent R6 (QCET Work UI Semantic Consolidation — Accessibility & Responsive Architecture)  
**Date**: 2026-09-10  
**Status**: COMPLETE — AUTHORITATIVE RECONNAISSANCE AUDIT  
**Contract Standards**:
- **WCAG 2.2 Level AA**: SC 2.1.1 (Keyboard), SC 2.4.3 (Focus Order), SC 2.4.7 (Focus Visible), SC 2.4.11 (Focus Appearance), SC 2.4.12 (Focus Not Obscured - Minimum), SC 2.5.7 (Dragging Movements), SC 2.5.8 (Target Size - Minimum), SC 1.4.1 (Use of Color), SC 1.4.3 (Contrast - Minimum), SC 4.1.2 (Name, Role, Value)
- **Vietnamese Institutional Accessibility Standards**: Thông tư 26/2020/TT-BTTTT (Quy định áp dụng tiêu chuẩn, quy chuẩn kỹ thuật cho cổng/trang thông tin điện tử cơ quan nhà nước và đơn vị sự nghiệp công lập) & Nghị định 130/2018/NĐ-CP
- **QCET Engineering Invariants**:
  - Rule 00 (Core System Invariants - Never Invent Operational Data)
  - Rule 10 (UI & Component Invariants - Light-Only Standard, Accessibility, Typography Floor)
  - Rule 11 (Mobile Experience & Layout Invariants - 44x44px Touch Targets, Keyboard Safety, Adaptive Layout)
  - Rule 20 (Task Domain Invariants - Canonical Engine, Single Filter Truth)
  - Rule 21 (Document Domain Invariants - Canonical Registry & Detail)
  - Rule 22 (Calendar Domain Invariants - Adaptive Calendar Layout, ICT UTC+7 Local Timezone Safety)
  - Rule 40 (Data Dignity & Institutional Grounding)

**Scope of File Inspection**:
- `src/app/globals.css`
- `src/components/tasks/table/components/task-row.tsx`
- `src/components/tasks/table/components/subtask-inline-row.tsx`
- `src/components/tasks/table/components/task-table-header.tsx`
- `src/components/tasks/mobile-task-card.tsx`
- `src/components/tasks/task-kanban-board.tsx`
- `src/components/calendar/calendar-workspace.tsx`
- `src/components/calendar/calendar-month-grid.tsx`
- `src/components/calendar/calendar-day-sheet.tsx`
- `src/components/documents/document-registry-view.tsx`
- `src/components/dashboard/workbench-mobile-feed.tsx`
- `src/components/dashboard/create-task-modal.tsx`
- `src/components/dashboard/task-detail-side-sheet.tsx`
- `src/components/navigation/mobile-bottom-nav.tsx`
- `src/components/layout/app-topbar.tsx`
- `src/components/layout/app-shell.tsx`

---

## 1. Executive Summary

This forensic audit evaluates the desktop and mobile interface of **QCET E-Office** against **WCAG 2.2 AA**, **Vietnamese administrative digital accessibility standards (Thông tư 26/2020/TT-BTTTT)**, and the operational ergonomics required by senior leadership (Ban Giám hiệu), department deans (Trưởng phòng, Trưởng khoa), and elderly faculty members navigating institutional operations on mobile phones, tablets, and desktop workstations.

### Key Systemic Audit Discoveries

1. **Focus Visibility & Focus Suppression (WCAG 2.2 SC 2.4.7 & SC 2.4.11)**:
   - `src/components/tasks/table/components/task-row.tsx` explicitly specifies `focus-visible:outline-hidden` on `tr[role="row"]` without supplying any replacement focus ring (`ring-2 ring-primary`). Keyboard users tabbing through hundreds of institutional tasks navigate completely blind.
   - `src/components/tasks/mobile-task-card.tsx` attaches `tabIndex={0}` and `role="button"` to `article` elements, but omits focus indicators entirely, failing focus appearance criteria.
2. **Sticky Header & Bottom Navigation Focus Obstruction (WCAG 2.2 SC 2.4.11 / SC 2.4.12 & SC 2.4.3)**:
   - `src/app/globals.css` omits `scroll-padding-top` and `scroll-padding-bottom` on root elements (`html`, `body`).
   - When keyboard tabbing scrolls to interactive elements near the viewport bounds, the sticky topbar (`app-topbar.tsx` with `sticky top-0 z-30 h-[52px]`) or fixed bottom navigation (`mobile-bottom-nav.tsx` with `fixed bottom-0 z-50 h-16`) completely obscures the focused element and its focus ring, violating WCAG 2.2 SC 2.4.12 (*Focus Not Obscured - Minimum*).
3. **Modal & Side-Sheet Focus Leakage (WCAG 2.2 SC 2.4.3 - Focus Order)**:
   - Custom overlay sheets (`TaskDetailSideSheet` in `task-detail-side-sheet.tsx`, `CreateTaskModal` in `create-task-modal.tsx`, and `CalendarEventDetailModal` in `calendar-workspace.tsx`) lack focus trapping. Pressing `Tab` leaks keyboard focus out of the modal into background DOM elements behind the dark backdrop.
   - None of these overlays implement programmatic focus shift on mount (initial focus) or return-focus to trigger elements on dismissal.
4. **Severe Touch Target Violations (WCAG 2.2 SC 2.5.8 & QCET Rule 11 44x44px Ergonomics)**:
   - Subtask inline quick action buttons ("Tiếp nhận", "Hoàn thành") in `subtask-inline-row.tsx` measure only `h-5.5 px-2` ($22\text{px}$ height), failing both the absolute $24\text{px}$ WCAG minimum and the $44\text{px}$ touch target threshold.
   - The subtask deliverable submission button ("Nộp minh chứng") hides its text label on screens $< 640\text{px}$ (`hidden sm:inline`), shrinking the interactive touch target to a minuscule $22 \times 22\text{px}$ box.
   - Document registry table action buttons (`document-registry-view.tsx`) measure `size-7` ($28 \times 28\text{px}$).
   - Calendar navigation arrows measure $32 \times 32\text{px}$ (`h-8 w-8`), and view switcher pills measure $\sim 28\text{px}$ height.
5. **Kanban Interaction Ergonomics & Status Transition Accessibility (WCAG 2.2 SC 2.5.7, SC 2.1.1 & SC 4.1.2)**:
   - The canonical Kanban implementation in `src/components/tasks/task-kanban-board.tsx` provides single-pointer chevron buttons (`ChevronLeft`, `ChevronRight`) rather than drag-and-drop movements, satisfying the core single-pointer mandate of WCAG 2.2 SC 2.5.7 (*Dragging Movements*).
   - However, the canonical Kanban implementation exhibits severe keyboard navigation and touch ergonomics barriers:
     - The quick-move chevron buttons measure only $28 \times 28\text{px}$ (`size-7 min-w-[28px] min-h-[28px]`), violating QCET's mandatory $44\times 44\text{px}$ touch target threshold (Rule 11).
     - Chevron buttons lack accessible names (`aria-label` is missing, relying solely on hover `title` tooltips that screen readers frequently ignore).
     - Kanban task cards (L.472-482) lack keyboard accessibility entirely (`tabIndex={0}`, `role="button"`, and `onKeyDown` listeners are absent), preventing keyboard-only users from focusing or selecting tasks.
     - The board lacks roving tabindex keyboard navigation across columns and cards, and chevron transitions restrict movement to strict linear stepping (`NEW` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `NEEDS_REVIEW` $\rightarrow$ `COMPLETED`) with no direct column jumping.
6. **Desktop/Mobile Semantic Divergence & Rule 00/40 Invariant Breach**:
   - `workbench-mobile-feed.tsx` injects hardcoded synthetic meeting arrays (`DEFAULT_SCHEDULE_ITEMS`) and notices (`DEFAULT_NOTICES`) when props are empty. On desktop `/dashboard`, authentic data or clean empty states are rendered; on mobile, fake BGH meetings and notices are fabricated.
   - `document-registry-view.tsx` switches from mobile cards to desktop table at `sm:` ($640\text{px}$). The desktop table has a fixed column footprint of $1180\text{px}$, causing severe horizontal truncation and unscrollable layout breakage on tablet viewports ($640\text{px} - 1024\text{px}$).

---

## 2. Keyboard Navigation & Visible Focus Architecture

### 2.1 Tab Traversal & Focus Ring Evaluation Matrix

| Component & File Path | Element | Current Behavior | WCAG 2.2 Criterion | Severity | Remediation Requirement |
|---|---|---|---|---|---|
| `src/components/tasks/table/components/task-row.tsx` (L.240-256) | Table Row `tr[role="row"]` | `tabIndex={0}` is present, but class includes `focus-visible:outline-hidden` without any ring replacement. | **SC 2.4.7 (Focus Visible)**<br>**SC 2.4.11 (Focus Appearance)** | **CRITICAL** | Remove `focus-visible:outline-hidden` and apply `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset`. |
| `src/components/tasks/mobile-task-card.tsx` (L.258-270) | Mobile Card `article[role="button"]` | Has `role="button"` and `tabIndex={0}`, handles `Enter`/`Space`, but has no `focus-visible:ring-*` or outline styling. | **SC 2.4.7 (Focus Visible)** | **HIGH** | Add `focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden`. |
| `src/components/tasks/task-kanban-board.tsx` (L.472-482) | Kanban Task Card `div` | Has `onClick` but NO `tabIndex`, NO `role="button"`, NO `onKeyDown`. Keyboard users cannot select cards. | **SC 2.1.1 (Keyboard Accessible)** | **CRITICAL** | Add `tabIndex={0}`, `role="button"`, `onKeyDown` (Enter/Space), and `focus-visible:ring-2 focus-visible:ring-primary`. |
| `src/components/tasks/task-kanban-board.tsx` (L.600-649) | Quick Move Chevrons (`ChevronLeft`/`ChevronRight`) | Has `title` attribute but NO `aria-label`. Button measures only $28\text{px}$ (`size-7`). | **SC 4.1.2 (Name, Role, Value)**<br>**SC 2.5.8 (Target Size)** | **HIGH** | Add `aria-label="Chuyển nhiệm vụ về..."`, increase to `min-h-[36px] min-w-[36px]` with `touch-target-expand-44`. |
| `src/components/dashboard/workbench-mobile-feed.tsx` (L.465-478, L.554-567) | Urgent / Key Task Cards | Cards have `tabIndex={0}` and `role="button"`, but lack visible focus indicators on keyboard focus. | **SC 2.4.7 (Focus Visible)** | **HIGH** | Add `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`. |
| `src/components/dashboard/workbench-mobile-feed.tsx` (L.707-728) | Notice Links `<Link>` | Plain anchor tags with `min-h-[48px]`, no `focus-visible:ring` defined. Focus halo is browser default or clipped by container overflow. | **SC 2.4.7 (Focus Visible)** | **MEDIUM** | Add `focus-visible:ring-2 focus-visible:ring-primary rounded-xl`. |
| `src/components/calendar/calendar-workspace.tsx` (L.872-881) | Day Time-Grid Slot `div` | Has `onClick={() => handleAddSlotClick()}` but NO `tabIndex`, NO `role="button"`, NO `onKeyDown`. | **SC 2.1.1 (Keyboard Accessible)** | **CRITICAL** | Add `tabIndex={0}`, `role="button"`, `aria-label="Thêm lịch công tác ngày..."`, and `onKeyDown` supporting `Enter`/`Space`. |
| `src/components/calendar/calendar-workspace.tsx` (L.895-920, L.925-947) | Calendar Event Cards in Grid | Event cards have `onClick` but NO `tabIndex`, NO keyboard listener, and no focus styling. | **SC 2.1.1 (Keyboard Accessible)** | **CRITICAL** | Ensure event cards are keyboard focusable (`tabIndex={0}`) with activation via `Enter`/`Space` and visible focus rings. |
| `src/components/calendar/calendar-workspace.tsx` (L.654-715) | Calendar View Switcher Buttons | Segmented control buttons lack `role="radio"`, `aria-checked`, and `focus-visible:ring-2`. | **SC 4.1.2 (Name, Role, Value)**<br>**SC 2.4.7 (Focus Visible)** | **MEDIUM** | Wrap in `role="radiogroup"` with `role="radio"`, set `aria-checked={viewMode === ...}`, add `focus-visible:ring-2`. |
| `src/components/workspace/smart-workbox.tsx` (L.285-330) | Workbox Filter Tiles | Tiles act as single-click filter selectors; focus order is linear, missing arrow-key roving tabindex navigation across filter set. | **SC 2.1.1 (Keyboard Accessible)** | **LOW** | Implement roving tabindex or standard segmented toggle group. |

### 2.2 Detailed Inspection of Focus Suppression in `task-row.tsx`

In `src/components/tasks/table/components/task-row.tsx`:
```tsx
// Lines 240-256
<tr
  role="row"
  tabIndex={0}
  onClick={handleRowClick}
  onKeyDown={handleKeyDown}
  data-task-id={task.id}
  data-task-tier="1"
  aria-selected={isSelected}
  className={cn(
    "group cursor-pointer transition-colors border-b border-slate-200/70 select-none hover:bg-slate-50/80 focus-visible:outline-hidden",
    rowHeightClass,
    isSelected && "bg-primary/[0.04]",
    isExpanded && "bg-slate-50/50",
    isActive && "ring-1 ring-inset ring-indigo-500/40 bg-indigo-50/20",
    className
  )}
>
```
**Defect Proof**:
1. `focus-visible:outline-hidden` strips the user agent's default outline ring completely.
2. No Tailwind `focus-visible:ring-*` rule is declared on the `<tr>` element.
3. When a user presses `Tab` through the tasks table, focus lands on the row, but zero visual change occurs unless `isActive` is true (which only happens after selection). This directly violates **WCAG 2.2 SC 2.4.7 (Focus Visible)** and **SC 2.4.11 (Focus Appearance)**.

**Required Remediation**:
```tsx
className={cn(
  "group cursor-pointer transition-colors border-b border-slate-200/70 select-none hover:bg-slate-50/80",
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
  rowHeightClass,
  ...
)}
```

### 2.3 Modal & Side-Sheet Focus Management (Dialog Patterns)

| Component | File Path | Focus Trap Status | Initial Focus Status | Return Focus Status | ESC Key Handling |
|---|---|---|---|---|---|
| `TaskDetailSideSheet` | `src/components/dashboard/task-detail-side-sheet.tsx` (L.445-467) | **FAIL**: No focus trap. Tabbing escapes to background document behind backdrop. | **FAIL**: Focus remains on whatever was active prior to opening; not shifted to drawer header or close button. | **FAIL**: When drawer closes, focus defaults to `body` rather than returning to opening row or card. | **PASS**: Listens to `Escape` key and locks `body.style.overflow`. |
| `CreateTaskModal` | `src/components/dashboard/create-task-modal.tsx` (L.604-626) | **FAIL**: No focus trap. Tabbing leaks outside modal boundary. | **FAIL**: Focus not programmatically directed to Title input upon modal mount. | **FAIL**: Focus not restored to trigger button on close. | **PASS**: Listens to `Escape` and `Ctrl+Enter` / `Cmd+Enter`. |
| `CalendarEventDetailModal` | `src/components/calendar/calendar-workspace.tsx` (L.175-225) | **FAIL**: Pure custom div overlay (`role="dialog"`), no focus trap. | **FAIL**: No initial focus assigned. | **FAIL**: No focus restoration. | **PASS**: Closes on `Escape`. |

---

## 3. Sticky UI Positioning, Obstruction & Scroll Padding Audit

### 3.1 `src/app/globals.css` Root Scroll-Padding Deficiencies

Inspection of `src/app/globals.css` reveals the root HTML configuration:
```css
/* src/app/globals.css (L.125-134) */
body {
  @apply bg-background text-foreground tracking-normal selection:bg-primary/20 selection:text-primary relative min-h-[100dvh] font-sans;
  overscroll-behavior-y: none;
}

html {
  @apply font-sans scroll-smooth;
  overscroll-behavior-y: none;
}
```

**Defect Analysis (WCAG 2.2 SC 2.4.12 Focus Not Obscured - Minimum)**:
1. **Missing `scroll-padding-top`**: QCET E-Office has a persistent sticky topbar:
   - `src/components/layout/app-topbar.tsx` declares `className="sticky top-0 z-30 w-full h-[calc(52px+env(safe-area-inset-top,0px))] ..."`
   - When a keyboard user tabs forward down the page, the browser auto-scrolls newly focused elements to `y = 0`.
   - Because `html` does not specify `scroll-padding-top: calc(52px + env(safe-area-inset-top, 0px))`, the focused element is scrolled directly **underneath** the sticky topbar (`z-30`). The top $52\text{px}$ of the interactive card, table row, or heading is completely invisible.
2. **Missing `scroll-padding-bottom`**: On mobile devices:
   - `src/components/navigation/mobile-bottom-nav.tsx` renders `fixed bottom-0 z-50 h-16 (64px)`.
   - When tabbing or navigating through long forms or task cards, elements scrolled into view at the bottom of the screen are covered by the mobile bottom navigation bar.

**Remediation in `globals.css`**:
```css
html {
  @apply font-sans scroll-smooth;
  overscroll-behavior-y: none;
  scroll-padding-top: calc(56px + env(safe-area-inset-top, 0px));
  scroll-padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 768px) {
  html {
    scroll-padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```

### 3.2 Sticky Stacking Context & Virtual Keyboard Collisions

| Sticky / Fixed Surface | Element | Height | z-index | Potential Obstruction Scenario | Remediation Requirement |
|---|---|---|---|---|---|
| `app-topbar.tsx` (L.163) | Global Topbar | $52\text{px} + \text{safe-top}$ | `z-30` | Obscures table headers and focused rows on scroll. | Set `scroll-padding-top` on document root. |
| `task-table-header.tsx` (L.96) | Table Column Header | $\sim 44\text{px}$ | `z-10` | When scrolling table rows, sticky table header correctly pins, but if `top-0` is used inside non-offset container, collides with topbar (`z-30`). | Ensure table header uses `top-[52px]` or container is `overflow-y-auto`. |
| `mobile-bottom-nav.tsx` (L.150) | Bottom Navigation Bar | $64\text{px} + \text{safe-bottom}$ | `z-50` | Blocks bottom cards. When virtual keyboard opens, fixed bar jumps and covers inputs if not guarded by `useVirtualKeyboard`. | Confirm `useVirtualKeyboard` hides or offsets `MobileBottomNav` when keyboard is active. |
| `task-detail-side-sheet.tsx` (L.691, L.1857) | Drawer Sticky Header & Footer | Header: $52\text{px}$, Footer: $64\text{px}$ | Header `z-10`, Footer `z-20` | On short mobile screens ($< 600\text{px}$ height or landscape), sticky header and footer consume $> 40\%$ of viewport, leaving $< 300\text{px}$ for scrollable content. | Use `max-h-[85vh]` with compact header padding on landscape/mobile viewports. |
| `create-task-modal.tsx` (L.749, L.1518) | Modal Sticky Header & Footer | Header: $52\text{px}$, Footer: $60\text{px}$ | `z-20` | Sticky action footer blocks dropdown combobox results that open downward. | Ensure combobox menus render in a portal or open upward (`side="top"`) when close to the sticky footer. |

### 3.3 Evaluation of `.touch-target-expand-44` in `globals.css`

`src/app/globals.css` defines a pseudo-element expansion utility:
```css
/* src/app/globals.css (L.399-409) */
.touch-target-expand-44 {
  position: relative;
}
.touch-target-expand-44::after {
  content: "";
  position: absolute;
  inset: -10px;
  min-width: 44px;
  min-height: 44px;
  z-index: 1;
}
```
**Audit Finding**:
- While `.touch-target-expand-44` is well-constructed, it is **currently unused** in dense administrative components (`subtask-inline-row.tsx`, `task-kanban-board.tsx`, `document-registry-view.tsx`).
- When applied to adjacent buttons in a tight horizontal row (e.g., the 3 subtask action buttons in `subtask-inline-row.tsx` spaced by `gap-1.5`), their pseudo-element hitboxes overlap (`inset: -10px` overlaps a `6px` gap), creating pointer hit collisions where clicking one button activates the neighbor.
- **Architectural Principle**: For dense tables, target expansion must either use non-overlapping asymmetric padding (`min-h-[32px] md:min-h-[32px]` with touch gutters) or full responsive height expansion on touch screens (`h-8 md:h-6 sm:min-h-[44px]`).

---

## 4. Target Size Assessment (WCAG 2.2 SC 2.5.8 & Senior Ergonomics)

### 4.1 Comparative Standard
- **WCAG 2.2 SC 2.5.8 (Target Size - Minimum - Level AA)**: The size of the target for pointer inputs is at least $24 \times 24\text{ CSS pixels}$, except where spacing provides equivalent area, inline text, or user-agent determined.
- **QCET Senior Administrative Touch Ergonomics (Rule 11 / AGENTS.md)**: Primary interactive controls on mobile and touch devices must satisfy $\ge 44 \times 44\text{ px}$ (`min-h-[44px]`) to accommodate senior faculty, department deans, and executive leadership operating mobile viewports.

### 4.2 Comprehensive Target Size Defect Inventory

| File & Location | UI Element | Declared Dimensions | Effective Pixel Area | WCAG 2.2 (24px) Status | Senior Ergonomics (44px) Status | Defect Description & Remediation |
|---|---|---|---|---|---|---|
| `src/components/tasks/table/components/subtask-inline-row.tsx` (L.182, 200, 215) | Quick Status Transition Buttons ("Tiếp nhận", "Hoàn thành") | `h-5.5 px-2` | $22\text{px} \times \sim 70\text{px}$ | **FAIL** (< 24px height) | **FAIL** (< 44px) | $22\text{px}$ vertical height fails the absolute $24\text{px}$ WCAG minimum. When stacked or adjacent, risk of accidental trigger is high. Upgrade to `min-h-[32px] md:min-h-[30px]` on desktop and `min-h-[44px]` on touch devices. |
| `src/components/tasks/table/components/subtask-inline-row.tsx` (L.182) | Submit Deliverable Button ("Nộp minh chứng") | `h-5.5 px-2` (text hidden on small screens) | $22\text{px} \times 22\text{px}$ (mobile icon only) | **FAIL** (< 24px) | **FAIL** (< 44px) | On `< sm` viewports, the label is hidden (`hidden sm:inline`), reducing the button to a tiny $22 \times 22\text{px}$ square target. Maintain `min-w-[44px] min-h-[44px]` touch footprint. |
| `src/components/tasks/table/components/task-row.tsx` (L.283) | Caret Expand/Collapse Button | `size-6` | $24\text{px} \times 24\text{px}$ | **PASS** (borderline) | **FAIL** (< 44px) | Exactly $24\text{px}$ meets WCAG AA technical minimum, but causes touch inaccuracies on iPads and mobile tables. Expand hit area with `p-2` or `touch-target-expand-44`. |
| `src/components/documents/document-registry-view.tsx` (L.1138) | Document Table Detail Button | `size-7` | $28\text{px} \times 28\text{px}$ | **PASS** (> 24px) | **FAIL** (< 44px) | Row action icon button measures only $28\text{px}$. Increase to `size-9` ($36\text{px}$) with `min-h-[44px] min-w-[44px]` on touch devices. |
| `src/components/calendar/calendar-workspace.tsx` (L.613, 631) | Calendar Date Prev/Next Buttons | `h-8 w-8 p-0` | $32\text{px} \times 32\text{px}$ | **PASS** (> 24px) | **FAIL** (< 44px) | Date navigation arrows on mobile touchscreens fail the $44\text{px}$ target standard. Upgrade to `h-10 w-10` or `min-h-[44px] min-w-[44px]`. |
| `src/components/calendar/calendar-workspace.tsx` (L.658-715) | Calendar View Switcher Buttons (Tháng / Tuần / Ngày / Lịch) | `px-2.5 py-1.5` | $\sim 28\text{px} \text{ height}$ | **PASS** (> 24px) | **FAIL** (< 44px) | Segmented view selector buttons are too cramped for touch interaction on phones. Provide `min-h-[40px] md:min-h-[32px]`. |
| `src/components/tasks/task-kanban-board.tsx` (L.450) | Kanban Column Quick Add Button | `size-6` / `size-7` | $24\text{px} - 28\text{px}$ | **PASS** (borderline) | **FAIL** (< 44px) | Column header plus button requires delicate pointer precision. |
| `src/components/tasks/task-kanban-board.tsx` (L.616, L.643) | Kanban Card Chevron Move Buttons | `size-7` | $28\text{px} \times 28\text{px}$ | **PASS** (> 24px) | **FAIL** (< 44px) | Quick shift chevrons measure only $28\text{px}$, lack `aria-label`, and cannot jump columns directly. |
| `src/components/dashboard/task-detail-side-sheet.tsx` (L.1947, 1962, 1987) | Drawer Actions Overflow Menu Items | `min-h-[36px]` | $36\text{px} \text{ height}$ | **PASS** (> 24px) | **FAIL** (< 44px) | Overflow actions inside side sheet dropdown do not meet $44\text{px}$ touch ergonomics. Increase item padding to `min-h-[44px]`. |

### 4.3 Desktop Density vs Touch Ergonomics Reconciliation

**The Engineering Tension**:
In dense administrative tables (e.g., `CascadingTaskTable` displaying $400+$ academic tasks across departments), applying a blanket `min-h-[44px]` to all inline subtask buttons would inflate table row height by $40\%$, reducing screen information density and causing faculty dissatisfaction.

**The Canonical Resolution Pattern**:
Use responsive class scoping and target expansion pseudo-elements:
```tsx
// Example for SubTaskInlineRow quick action buttons:
<button
  type="button"
  className={cn(
    // Desktop density: compact 28px height
    "h-7 px-2 text-xs font-medium rounded-md",
    // Mobile/touch ergonomics: 44px tap target via pseudo-element expansion or min-h-[44px]
    "touch:min-h-[44px] touch:min-w-[44px] sm:h-7 sm:px-2",
    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
  )}
  aria-label={`Tiếp nhận công việc ${subTask.title}`}
>
  ...
</button>
```

---

## 5. Kanban Interaction Architecture & Single-Pointer Ergonomics (WCAG 2.2 SC 2.5.7, SC 2.1.1 & SC 2.5.8)

### 5.1 Requirement Analysis
- **WCAG 2.2 Success Criterion 2.5.7 (Dragging Movements - Level AA)**:  
  *All functionality that uses a dragging movement for operation must be achievable by a single pointer without dragging, unless dragging is essential or the functionality is determined by the user agent and not modified by the author.*
- **WCAG 2.2 Success Criterion 2.1.1 (Keyboard Accessible - Level A)**:  
  *All functionality of the content is operable through a keyboard interface without requiring specific timings for individual keystrokes.*
- **WCAG 2.2 Success Criterion 4.1.2 (Name, Role, Value - Level A)**:  
  *For all user interface components, the name and role can be programmatically determined; states, properties, and values that can be set by the user can be programmatically set.*
- **QCET Touch Ergonomics (Rule 11 / AGENTS.md)**:  
  Interactive controls on mobile and touch devices must satisfy $\ge 44 \times 44\text{px}$ (`min-h-[44px] min-w-[44px]`) to accommodate senior faculty and leadership.

### 5.2 Forensic Audit of Canonical Kanban (`src/components/tasks/task-kanban-board.tsx`)

Forensic inspection confirms `src/components/tasks/task-kanban-board.tsx` is the sole canonical Kanban implementation in the codebase. It does not utilize drag-and-drop libraries (`@hello-pangea/dnd` and `react-beautiful-dnd` are entirely absent from the repository). Instead, it implements discrete status transition buttons (`ChevronLeft` and `ChevronRight`) alongside a mobile-friendly snap carousel (`overflow-x-auto snap-x snap-mandatory`).

While this architecture avoids drag-only barriers and aligns with the single-pointer principle of WCAG 2.2 SC 2.5.7, it introduces several severe accessibility, keyboard, and ergonomic deficiencies:

1. **Sub-Optimal Touch Target Size ($28 \times 28\text{px}$ Chevrons)**:
   - In `task-kanban-board.tsx` (L.600-649):
     ```tsx
     <button
       type="button"
       disabled={!prevStatus}
       onClick={(e) => { ... }}
       title={prevStatus ? `Chuyển về ${prevStatus}` : "Không thể lùi"}
       className={cn(
         "size-7 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer active:scale-95",
         !prevStatus && "opacity-30 cursor-not-allowed hover:bg-background hover:text-muted-foreground"
       )}
     >
       <ChevronLeft strokeWidth={1.5} className="size-3.5" />
     </button>
     ```
   - At `min-w-[28px] min-h-[28px]`, the buttons exceed the absolute $24\text{px}$ WCAG 2.5.8 floor, but fail the institutional $44\times 44\text{px}$ touch target requirement for mobile and tablet operation. On compact touch screens, tapping the tiny $28\text{px}$ chevrons frequently triggers accidental card selection or misses the hit target.

2. **Missing Accessible Names (`aria-label`)**:
   - The quick-move chevron buttons only declare `title` attributes (`title={prevStatus ? ... : "Không thể lùi"}`).
   - Tooltip `title` attributes are not consistently announced by screen readers (e.g., VoiceOver on Safari iOS or NVDA in virtual cursor mode) on icon-only buttons.
   - Remediation requires explicit `aria-label`: e.g., `aria-label={`Chuyển trạng thái lùi về ${prevStatus}`}` and `aria-label={`Chuyển trạng thái tiến sang ${nextStatus}`}`.

3. **Complete Absence of Keyboard Focus & Activation on Task Cards (WCAG SC 2.1.1)**:
   - In `task-kanban-board.tsx` (L.472-482):
     ```tsx
     <div
       key={item.id}
       onClick={() => onSelectTask?.(item.rawTask)}
       className={cn(
         "group relative flex flex-col justify-between rounded-lg border border-border/60 bg-card p-3.5 ... cursor-pointer ...",
         ...
       )}
     >
     ```
   - Cards are plain `div` elements with an `onClick` handler. They lack `tabIndex={0}`, `role="button"`, and `onKeyDown` event handling (`Enter` / `Space`).
   - Consequently, keyboard-only users tabbing through the Kanban board bypass all task cards entirely and can only focus on the column "Add task" and chevron buttons, rendering card selection completely inaccessible via keyboard.

4. **Lack of Roving Tabindex Across Kanban Grid**:
   - Standard WAI-ARIA grid/feed patterns for Kanban boards prescribe a roving `tabIndex` (`tabIndex={0}` for the active card, `tabIndex={-1}` for others) operable via directional arrow keys (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`).
   - Currently, focus follows the linear DOM order, forcing keyboard users to step through every control sequentially.

5. **Linear Stepping Restriction**:
   - Chevrons only transition sequentially along `STATUS_ORDER` (`NEW` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `NEEDS_REVIEW` $\rightarrow$ `COMPLETED`).
   - Users cannot transition directly to non-linear statuses (e.g., `BLOCKED`, `CANCELLED`, or jumping directly from `NEW` to `COMPLETED`) without opening task details or performing intermediate status cycles.

### 5.3 Mandatory Canonical Accessible Single-Pointer Pattern

To ensure complete keyboard operability, robust touch target ergonomics, and direct non-linear status transitions, every Kanban card in `task-kanban-board.tsx` must provide:
1. Keyboard operability on the card container (`tabIndex={0}`, `role="button"`, and `onKeyDown` for `Enter`/`Space`).
2. An accessible single-pointer `DropdownMenu` ("Chuyển trạng thái") providing direct status selection with $\ge 40\text{-}44\text{px}$ tap targets.
3. Enhanced chevrons with `aria-label` attributes and expanded touch target geometry (`touch:min-h-[44px] touch:min-w-[44px]` or `.touch-target-expand-44`).

```tsx
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function KanbanCardStatusMenu({
  task,
  currentStatus,
  onMoveStatus,
}: {
  task: SchoolTask | StaffTask;
  currentStatus: TaskStatus;
  onMoveStatus: (taskId: string, newStatus: TaskStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="size-8 min-w-[36px] min-h-[36px] p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer touch:min-h-[44px] touch:min-w-[44px]"
          aria-label={`Chuyển trạng thái nhiệm vụ: ${task.title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          Chuyển sang cột trạng thái
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {KANBAN_COLUMNS.filter((col) => col.id !== currentStatus).map((col) => (
          <DropdownMenuItem
            key={col.id}
            onClick={(e) => {
              e.stopPropagation();
              onMoveStatus(task.id, col.id);
            }}
            className="min-h-[40px] text-xs flex items-center gap-2 cursor-pointer"
          >
            <span className={cn("size-2 rounded-full", col.dotColor)} />
            <span>{col.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 6. Information Delivery & Color Independence (WCAG 2.2 SC 1.4.1)

### 6.1 Requirement Definition
**WCAG 2.2 Success Criterion 1.4.1 (Use of Color - Level A)**:  
*Color is not used as the only visual means of conveying information, indicating an action, prompting a response, or distinguishing a visual element.*

### 6.2 Identified Color-Alone Instances

| File & Location | UI Element | Current Presentation | Accessibility Barrier | Remediation Requirement |
|---|---|---|---|---|
| `src/components/dashboard/workbench-mobile-feed.tsx` (L.381) | Section Header: "CẦN XỬ LÝ NGAY" | `<div className="w-2 h-2 rounded-full bg-rose-500" />` | Color alone distinguishes urgency from other sections. Monochromatic or colorblind users cannot perceive priority level. | Replace colored dot with icon: `<AlertTriangle className="size-4 text-rose-600" strokeWidth={2} aria-hidden="true" />`. |
| `src/components/dashboard/workbench-mobile-feed.tsx` (L.538, 643, 695) | Section Headers: "Nhiệm vụ trọng tâm", "Lịch công tác", "Thông báo" | `<div className="w-2 h-2 rounded-full bg-primary" />`, `bg-indigo-500`, `bg-amber-500` | Section identity is signaled via colored dots. | Replace with semantic Lucide icons: `<CheckSquare />`, `<Calendar />`, `<Bell />`. |
| `src/components/calendar/calendar-workspace.tsx` (L.925-947) | Week Grid Non-Task Events | Box rendered with `bg-primary/10 border-primary/30 text-primary` without type icon or label badge. | Meeting vs deadline vs task milestone is differentiated only by color tint. | Add explicit text type badge (e.g., `[Lịch họp]`, `[Kế hoạch]`, `[Nhiệm vụ]`). |
| `src/components/tasks/table/components/task-row.tsx` (L.298-301) | Subtask Expansion Placeholder | Leaf tasks render `<span className="size-1.5 rounded-full bg-slate-300" />` | Dot color is subtle; no textual indicator that no subtasks exist. | Add `aria-hidden="true"` or visually hidden text `(Nhiệm vụ đơn lẻ, không có việc con)`. |
| `src/components/workspace/smart-workbox.tsx` (L.310-335) | Workbox Status Indicators | Colored badges (Rose for Overdue, Amber for Waiting) | Passable because text is present, but lacks associated status icons for low-vision clarity. | Add status icons (`AlertCircle`, `Clock`, `CheckCircle2`) alongside numeric badges. |

---

## 7. Responsive Architecture & Desktop/Mobile Semantic Parity

### 7.1 Critical Invariant Violation 1: Synthetic Mock Data Injection on Mobile
- **File**: `src/components/dashboard/workbench-mobile-feed.tsx` (L.167-204, L.305, L.324)
- **Defect Code**:
  ```ts
  const DEFAULT_SCHEDULE_ITEMS: WorkbenchMobileScheduleItem[] = [
    { id: "sched-1", time: "08:30 - 10:00", title: "Họp giao ban công tác Ban Giám hiệu...", location: "Phòng họp A1" },
    { id: "sched-2", time: "14:00 - 16:30", title: "Thẩm định hồ sơ chương trình đào tạo...", location: "Phòng họp B2" },
  ];
  const DEFAULT_NOTICES = [ ... ];
  ...
  const scheduleItems = props.scheduleItems ?? DEFAULT_SCHEDULE_ITEMS;
  ...
  return DEFAULT_NOTICES;
  ```
- **Architectural & Institutional Breach**:
  - Direct violation of **Rule 00 Universal Invariant 4 (Never Invent Operational Data)** and **Rule 40 (Data Dignity)**.
  - Causes severe **Desktop/Mobile Semantic Divergence**: When a Rector or Dean logs in on desktop, `/dashboard` displays genuine database schedules or empty notices. When the same user opens the mobile PWA on an iPhone, the application manufactures imaginary BGH meetings and DACUM curriculum evaluation sessions that do not exist.
- **Remediation**: Purge `DEFAULT_SCHEDULE_ITEMS` and `DEFAULT_NOTICES`. If `scheduleItems` or `notices` are empty, render an authentic empty state: `"Không có lịch công tác trong ngày"` or integrate with live `/api/calendar/events`.

### 7.2 Responsive Failure Mode 2: Table Breakpoint Mismatch in `document-registry-view.tsx`
- **File**: `src/components/documents/document-registry-view.tsx` (L.931-959, L.1153-1155)
- **Defect Analysis**:
  - The component switches between desktop table and mobile cards using Tailwind's `sm:` breakpoint ($640\text{px}$):
    ```tsx
    {/* Desktop Table View (>= 640px / sm:block) */}
    <div className="hidden sm:block">
      ...
      <th className="py-3 px-4 w-[160px]">Số / Ký hiệu</th>
      <th className="py-3 px-4 w-[120px]">Ngày BH / Đến</th>
      <th className="py-3 px-4 w-[200px]">Cơ quan &amp; Người ký</th>
      <th className="py-3 px-4 min-w-[280px]">Trích yếu nội dung</th>
      <th className="py-3 px-4 w-[160px]">Đơn vị &amp; Tiến độ</th>
      <th className="py-3 px-4 w-[180px]">Liên thông việc</th>
      <th className="py-3 px-4 w-[80px]">Chi tiết</th>
    </div>
    {/* Mobile Document Feed (< 640px / sm:hidden) */}
    <div className="block sm:hidden p-3 space-y-3">
    ```
  - Summing the explicit column widths:
    $$160\text{px} + 120\text{px} + 200\text{px} + 280\text{px} + 160\text{px} + 180\text{px} + 80\text{px} = 1180\text{px}$$
  - On viewports between $640\text{px}$ and $1024\text{px}$ (such as iPad Mini, iPad Air, Surface Pro portrait, and browser split-screen), the component renders an $1180\text{px}$ fixed-width table inside a $640\text{px}-768\text{px}$ container.
  - This forces severe horizontal scrolling, column squishing, and truncates essential administrative metadata (issuing authority and signatory).
- **Remediation**:
  - Elevate the table display toggle breakpoint from `sm:` ($640\text{px}$) to `lg:` ($1024\text{px}$), or provide an intermediate responsive table mode with collapsible columns on `md:` ($768\text{px}$).

### 7.3 Operational Action Asymmetry Matrix

| Operational Capability | Desktop Workspace (`CascadingTaskTable`) | Mobile Feed (`WorkbenchMobileFeed` / `MobileTaskCard`) | Parity Status | Severity | Remediation Requirement |
|---|---|---|---|---|---|
| **Batch Status Updates** | Supported via row checkbox selection and floating `TaskBulkActionBar`. | Completely absent. No multi-select checkbox affordance. | **DIVERGENCE** | **HIGH** | Add long-press card selection mode on mobile to trigger bulk operations. |
| **Hierarchical Subtask Exploration** | Direct inline accordion expansion (`ChevronDown` revealing subtask tree with progress and SLA). | Flat view only. Subtasks are either flattened into single cards or hidden until opening the side sheet. | **PARTIAL** | **MEDIUM** | Provide expandable subtask chip or collapsible subtask preview inside `MobileTaskCard`. |
| **Direct Proof Submission** | Direct inline button on subtask row (`Nộp minh chứng`). | Must tap card, wait for side-sheet animation, navigate to submission tab. | **ACCEPTABLE** (responsive disclosure) | **LOW** | Direct button is convenient on desktop; drawer on mobile prevents modal nesting. |
| **Department Filter Rollup** | Interactive table header sorting and multi-criteria department grouping. | Simplified dropdown or scope tab. | **ACCEPTABLE** | **LOW** | Preserves mobile information density. |

### 7.4 Calendar Viewport Adaptation (Rule 22 Compliance)
- **Rule 22 (Calendar Domain Invariants - Item 5)**: *"On compact mobile viewports, default to list/agenda views when multi-column month grids degrade readability."*
- **Audit Verification**:
  - `src/components/calendar/calendar-workspace.tsx` (L.329-341) listens to `window.innerWidth < 768` and sets `viewMode = "agenda_list"`.
  - **Result**: **COMPLIANT** with Invariant 5.
  - **Remaining Issue**: If the mobile user manually switches to `week_grid` or `month_grid`, the 7-column time grid overflows horizontally with cramped $32\text{px}$ day headers and unreadable event text.
  - **Recommendation**: Restrict the segmented view switcher on screens $< 640\text{px}$ to only `agenda_list` and `day_view`, or render a horizontal swipe carousel for weeks.

---

## 8. Prioritized Remediation Roadmap

```text
                                      REMEDIATION ROADMAP
  
  PHASE 1: CRITICAL A11Y & INVARIANT FIXES (Wave 1)
  ├── 1.1 Remove `focus-visible:outline-hidden` from TaskRow & add focus ring.
  ├── 1.2 Add `scroll-padding-top: 56px` and `scroll-padding-bottom: 68px` to globals.css.
  ├── 1.3 Add keyboard listeners & tabIndex to Calendar week-grid slots and event cards.
  ├── 1.4 Implement FocusTrap & return-focus logic in TaskDetailSideSheet & CreateTaskModal.
  ├── 1.5 Eliminate DEFAULT_SCHEDULE_ITEMS & DEFAULT_NOTICES from workbench-mobile-feed.tsx.
  └── 1.6 Increase SubTaskInlineRow quick action buttons from 22px (h-5.5) to min 28px desktop / 44px mobile.
  
  PHASE 2: WORKFLOW & ERGONOMICS (Wave 2)
  ├── 2.1 Add single-pointer dropdown status transition menu on Kanban cards (WCAG 2.5.7).
  ├── 2.2 Standardize document-registry-view breakpoint from sm: (640px) to lg: (1024px) for 1180px table.
  ├── 2.3 Replace color-alone dots with semantic Lucide icons in mobile headers and stat cards.
  ├── 2.4 Expand calendar prev/next and view switcher buttons to min-h-[44px] on mobile viewports.
  └── 2.5 Add ARIA radiogroup roles and states to calendar and toolbar segmented buttons.
  
  PHASE 3: CONTINUOUS VERIFICATION GATE (Wave 3)
  ├── 3.1 Install @axe-core/playwright for automated regression checks on /tasks, /calendar, /dashboard.
  └── 3.2 Add end-to-end keyboard walkthrough test asserting focus retention and modal trapping.
```

---

## 9. Verification & Continuous Testing Strategy

To ensure zero regression against accessibility and responsive parity invariants:

1. **Automated A11y Suite Integration**:
   - Introduce `@axe-core/playwright` accessibility assertions across `/tasks`, `/dashboard`, `/calendar`, and `/documents`:
     ```ts
     import { test, expect } from "@playwright/test";
     import AxeBuilder from "@axe-core/playwright";

     test("should not have any automatically detectable WCAG 2.2 AA violations", async ({ page }) => {
       await page.goto("/tasks");
       const results = await new AxeBuilder({ page })
         .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
         .analyze();
       expect(results.violations).toEqual([]);
     });
     ```
2. **Keyboard-Only Walkthrough Verification**:
   - Tab through `/tasks` table: verify visible primary blue ring surrounds each focused row and subtask.
   - Open `TaskDetailSideSheet`: verify focus moves to Close button, Tab cycles strictly inside drawer, `ESC` closes drawer and restores focus to original row.
   - Navigate `/calendar`: verify Space/Enter opens day slot add-task modal; Tab selects individual events.
3. **Touch Ergonomics & Screen Boundary Test**:
   - Emulate mobile viewports ($390\text{px}$ iPhone 14, $412\text{px}$ Pixel 7) in Chrome DevTools.
   - Verify every clickable action target bounding box measures $\ge 44 \times 44\text{px}$ (or $\ge 24 \times 24\text{px}$ with $\ge 12\text{px}$ clear gutter).
   - Confirm zero mock schedule items appear on mobile dashboard when database has no events.
