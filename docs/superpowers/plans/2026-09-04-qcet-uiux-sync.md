# QCET Work UI/UX Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove legacy minimalist UI and synchronize 100% of the UI/UX, Design System tokens, typography, executive header shell, and component styling with `dashboard-chamcong` (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn) while preserving all existing business logic and RBAC.

**Architecture:** Replace the global CSS tokens with the authentic OKLCH color palette, multi-layer radial background gradients, and shadow system from `dashboard-chamcong`. Standardize layout on Plus Jakarta Sans & JetBrains Mono, and build an executive navigation shell featuring the QCET logo, LiveClock, ZoomToggle (100% ⇋ 120%), glassmorphism `RoleSwitcherPill`, and responsive Bento widgets across all views.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4, OKLCH Color Space, `next/font/google`, Lucide React, class-variance-authority, Node.js test runner (`tsx --test`).

**Spec:** [docs/superpowers/specs/2026-09-04-qcet-uiux-sync-design.md](docs/superpowers/specs/2026-09-04-qcet-uiux-sync-design.md)

## Global Constraints

- Do not alter or break existing RBAC types or logic in `src/types/auth.ts`, `src/lib/auth-context.tsx`, and `src/lib/role-task-filter.ts`.
- Retain all mock and API data aggregation functions in `src/lib/dashboard-aggregator.ts` and `src/lib/mock-dashboard-data.ts`.
- Maintain test coverage across all existing suites, updating design system token expectations to match the new QCET design system.
- Ensure all numbers and metric KPIs retain `.tabular-nums` for rock-solid visual scannability.
- All styles must support both Light and Dark modes seamlessly.

---

### Task 1: Assets & Core Design System Tokens

**Files:**
- Create: `public/logo-qcet.png` (copied from `/Users/dnhhuy/Projects/QCET/dashboard-chamcong/public/logo-qcet.png`)
- Modify: `src/lib/tokens.ts`
- Modify: `src/app/globals.css`
- Modify/Test: `tests/smoke-qcet-design-system.test.ts` (migrated from `tests/smoke-twenty-design-system.test.ts`)

**Interfaces:**
- Produces: OKLCH color tokens (`--background`, `--foreground`, `--card`, `--primary`, `--border`, `--muted`), status tokens (Sapphire, Emerald, Rose, Amber, Violet), shadow utilities (`shadow-card`, `shadow-card-hover`, `shadow-premium`, `shadow-glow-primary`), and `QCET_TOKENS` object in `src/lib/tokens.ts`.

- [ ] **Step 1: Copy logo-qcet.png asset to public directory**

Copy `logo-qcet.png` from `/Users/dnhhuy/Projects/QCET/dashboard-chamcong/public/logo-qcet.png` to `public/logo-qcet.png`.
Verify file exists: `ls -la public/logo-qcet.png`.

- [ ] **Step 2: Update Design System tokens in `src/lib/tokens.ts`**

Update `src/lib/tokens.ts` with the QCET Executive design system tokens:
- Primary: Sapphire Blue (`#2563EB` / `oklch(0.42 0.18 250)`)
- Status colors:
  - `inProgress`: Sapphire Blue (`bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20`)
  - `completed`: Emerald Green (`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20`)
  - `overdue`: Crimson Rose (`bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20`)
  - `needsReview`: Warm Amber (`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`)
  - `new`: Purple Violet (`bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20`)
- Radius: `0.75rem` (12px rounded-xl) for cards, `0.5rem` (8px rounded-lg) for controls.

- [ ] **Step 3: Replace `src/app/globals.css` with OKLCH & Glassmorphism styles**

Replace `src/app/globals.css` with the full CSS specification from `dashboard-chamcong`:
- Include OKLCH variables for `:root` and `.dark`.
- Include `radial-gradient` fixed body backgrounds for Light and Dark modes.
- Include custom shadow classes: `.shadow-card`, `.shadow-card-hover`, `.shadow-premium`, `.shadow-glow-primary`.
- Include `.thin-scrollbar`, `.safe-area-bottom`, and `.tabular-nums`.

- [ ] **Step 4: Update token smoke test and run test**

Update `tests/smoke-twenty-design-system.test.ts` (or rename to `tests/smoke-qcet-design-system.test.ts`) to assert the new QCET Design System variables in `globals.css` and `tokens.ts`.
Run: `npm test tests/smoke-qcet-design-system.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add public/logo-qcet.png src/lib/tokens.ts src/app/globals.css tests/
git commit -m "feat(design-system): implement OKLCH color tokens, assets, and glassmorphism styles"
```

---

### Task 2: Typography & Root Layout Configuration

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: Google Fonts (`Plus_Jakarta_Sans`, `JetBrains_Mono` via `next/font/google`), `public/logo-qcet.png`, `src/components/theme-provider.tsx`, `src/lib/auth-context.tsx`.
- Produces: Root HTML and Body structure configured with `--font-sans`, `--font-mono`, standard max-width container (`max-w-[1440px]`), and accessible skip links.

- [ ] **Step 1: Update `src/app/layout.tsx` fonts and viewport**

Configure `Plus_Jakarta_Sans` (`variable: "--font-sans"`, subsets `["latin", "vietnamese"]`) and `JetBrains_Mono` (`variable: "--font-mono"`) in `src/app/layout.tsx`.
Update metadata to official QCET Executive title:
`Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn - Hệ thống Quản trị & Điều hành Văn phòng Điện tử (E-Office)`.
Set `suppressHydrationWarning` on `html` and apply font variables.

- [ ] **Step 2: Run typecheck to verify layout integration**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): apply Plus Jakarta Sans typography and QCET executive metadata"
```

---

### Task 3: Base UI Component Library Overhaul

**Files:**
- Modify: `src/components/ui/card.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/button.tsx`
- Create: `src/components/ui/drawer.tsx`
- Create: `src/components/ui/progress.tsx`
- Create: `src/components/ui/tabs.tsx`

**Interfaces:**
- Produces:
  - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` with `--card-spacing` and `shadow-card`.
  - `Badge` with variants: `default`, `secondary`, `destructive`, `outline`, `sapphire`, `emerald`, `amber`, `rose`, `violet`.
  - `Button` with variants: `default` (Sapphire Blue), `secondary`, `outline`, `ghost`, `destructive`, `premium`.
  - `Drawer` component supporting right-slide sheet, ESC dismissal, backdrop blur, and lock body scroll.
  - `Progress` bar component with smooth transitions.
  - `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` component.

- [ ] **Step 1: Write Card, Badge, and Button components**

Update `src/components/ui/card.tsx` with rounded-xl, subtle border, and card shadows.
Update `src/components/ui/badge.tsx` with all QCET task status variants.
Update `src/components/ui/button.tsx` with sapphire default styling and modern rounded-xl geometry.

- [ ] **Step 2: Implement Drawer and Progress components**

Create `src/components/ui/drawer.tsx` based on `dashboard-chamcong/src/components/ui/drawer.tsx` using `createPortal`.
Create `src/components/ui/progress.tsx` using native animated indicator div or clean CSS indicator.
Create `src/components/ui/tabs.tsx`.

- [ ] **Step 3: Verify with existing tests**

Run: `npm test`
Expected: All suites pass.

- [ ] **Step 4: Commit changes**

```bash
git add src/components/ui/
git commit -m "feat(ui): overhaul Card, Badge, Button and add Drawer, Progress, Tabs"
```

---

### Task 4: Executive Header, LiveClock, ZoomToggle, and RoleSwitcherPill

**Files:**
- Modify: `src/components/navigation.tsx`
- Modify: `src/components/auth/role-switcher-pill.tsx`
- Modify: `src/components/auth/role-viewpoint-banner.tsx`

**Interfaces:**
- Consumes: `useAuth` (`src/lib/auth-context.tsx`), `useTheme` (`src/components/theme-provider.tsx`), `logo-qcet.png`.
- Produces: Topbar with:
  - QCET School Logo and College name badge + live pulse indicator.
  - `LiveClock` component updating every second.
  - `ZoomToggle` component supporting 100% ⇋ 120% magnification saved to `localStorage`.
  - Glassmorphic `RoleSwitcherPill` with role badge and dropdown.
  - `CreateTaskModal` trigger button ("Giao việc nhanh").
  - `ThemeToggle` light/dark switch.
  - Sticky SubNav pill bar with 5 routes (`/`, `/tasks`, `/unit-tasks`, `/calendar`, `/org`).
  - Mobile bottom navigation bar (`MobileNav`) for `< 768px` screens.

- [ ] **Step 1: Implement LiveClock and ZoomToggle in `src/components/navigation.tsx`**

Write `LiveClock` component using local time formatting (`vi-VN`, `HH:mm:ss`, font-mono).
Write `ZoomToggle` component reading and writing `qcet_ui_zoom` in `localStorage` and toggling `document.documentElement.style.zoom`.

- [ ] **Step 2: Update Header layout and SubNav**

Rebuild `Navigation` in `src/components/navigation.tsx`:
- Header top container: `max-w-[1440px] mx-auto px-3.5 sm:px-6 py-2.5 flex items-center justify-between`.
- Brand section with `logo-qcet.png`, uppercase college title, and green ping badge.
- Right section with `LiveClock`, `ZoomToggle`, `RoleSwitcherPill`, `CreateTaskModal` button, `ThemeToggle`, and User Avatar.
- SubNav horizontal scrolling pill links with active glass highlight.
- Mobile bottom navigation bar at `fixed bottom-0 left-0 right-0 z-50 md:hidden`.

- [ ] **Step 3: Update `src/components/auth/role-switcher-pill.tsx` and banner styling**

Restyle `RoleSwitcherPill` and `RoleViewpointBanner` to match QCET glassmorphic theme (`bg-card/80 backdrop-blur-xl border border-border/60 shadow-xs`).

- [ ] **Step 4: Run typecheck and navigation tests**

Run: `npm run typecheck && npm test tests/sprint-2-integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/navigation.tsx src/components/auth/
git commit -m "feat(navigation): implement Executive Header with LiveClock, ZoomToggle, and QCET branding"
```

---

### Task 5: Dashboard Overview & Widgets Redesign

**Files:**
- Modify: `src/components/dashboard/executive-stat-strip.tsx`
- Modify: `src/components/dashboard/cascading-task-table.tsx`
- Modify: `src/components/dashboard/upcoming-deadlines-widget.tsx`
- Modify: `src/components/dashboard/activity-feed-widget.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `DashboardStats`, `SchoolTask`, `ActivityEvent` (`src/types/dashboard.ts`), `useAuth` (`src/lib/auth-context.tsx`).
- Produces: High-density Executive Bento Grid layout on `/` with:
  - 4 Stat Cards (Tổng nhiệm vụ, Đang làm, Hoàn thành, Cảnh báo quá hạn). Overdue alert activates rose-tinted background, red border, and warning badge when count > 0.
  - Cascading Task Table with slim borders, category pills, progress meters, and task delegation actions.
  - Upcoming deadlines widget with date badges.
  - Activity feed widget with category icons.

- [ ] **Step 1: Redesign `ExecutiveStatStrip` to Bento Stat Cards**

Update `src/components/dashboard/executive-stat-strip.tsx`:
- Grid layout: `grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4`.
- Large metrics `text-2xl sm:text-3xl font-extrabold tabular-nums`.
- Overdue alert state: if `overdueTasksCount > 0`, card applies `border-rose-500/40 bg-rose-500/[0.03]` with warning pill.
- Ensure all helper functions (`getStatCardData`, `formatNumber`) continue returning expected values for unit tests.

- [ ] **Step 2: Redesign `CascadingTaskTable`**

Update `src/components/dashboard/cascading-task-table.tsx`:
- Card container with `bg-card border border-border/50 shadow-card rounded-2xl`.
- Search and filter bar with category pills and department filters.
- Segmented progress bar for parent tasks (Emerald for completed %, Sapphire for remaining).
- Status badges using standard QCET colors.

- [ ] **Step 3: Redesign `UpcomingDeadlinesWidget` & `ActivityFeedWidget`**

Update both widgets to match Bento style with `rounded-2xl border border-border/50 shadow-card bg-card`.

- [ ] **Step 4: Update `src/app/page.tsx` layout and spacing**

Ensure page container uses `max-w-[1440px] mx-auto space-y-6 pb-20 md:pb-8`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: All tests pass, 0 typecheck errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/components/dashboard/ src/app/page.tsx
git commit -m "feat(dashboard): redesign overview page with executive Bento cards and cascading table"
```

---

### Task 6: Sub-pages Modernization

**Files:**
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/app/unit-tasks/page.tsx`
- Modify: `src/app/calendar/page.tsx`
- Modify: `src/app/org/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/tasks/task-kanban-board.tsx`
- Modify: `src/components/calendar/calendar-month-view.tsx`
- Modify: `src/components/org/organization-tree.tsx`
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx`

**Interfaces:**
- Consumes: Task data, calendar data, org hierarchy, login credentials.
- Produces: Modernized sub-pages with QCET card styling, glassmorphism filters, status color coding, and responsive layouts.

- [ ] **Step 1: Modernize Task Kanban Board & Pages (`/tasks`, `/unit-tasks`)**

Update `src/components/tasks/task-kanban-board.tsx`:
- Column headers with colored accent borders (Sapphire for Đang làm, Emerald for Hoàn thành, Amber for Chờ duyệt, Violet for Mới).
- Cards with `rounded-xl border border-border/50 shadow-xs hover:shadow-card bg-card`.
- Update `src/app/tasks/page.tsx` and `src/app/unit-tasks/page.tsx` headers.

- [ ] **Step 2: Modernize Calendar Month View (`/calendar`)**

Update `src/components/calendar/calendar-month-view.tsx` and `src/app/calendar/page.tsx`:
- Modern month grid with subtle borders `border-border/40`.
- Highlight current day cell with `bg-primary/5 font-bold border-primary/40`.
- Event chips styled with category and status colors.

- [ ] **Step 3: Modernize Organization Tree (`/org`)**

Update `src/components/org/organization-tree.tsx` and `src/app/org/page.tsx`:
- Department cards and personnel cards styled with avatar circles and role badges.

- [ ] **Step 4: Modernize Login Page (`/login`) & Task Detail Drawer**

Update `src/app/login/page.tsx`:
- QCET branding, logo card with `shadow-glow-primary`, role shortcut cards.
Update `src/components/dashboard/task-detail-side-sheet.tsx`:
- Modern sheet with slide-over animation and metadata grid.

- [ ] **Step 5: Run test suite**

Run: `npm test && npm run typecheck`
Expected: 100% tests passing, 0 TypeScript errors.

- [ ] **Step 6: Commit changes**

```bash
git add src/app/ src/components/
git commit -m "feat(pages): modernize tasks, calendar, org, and login pages to QCET styling"
```

---

### Task 7: Verification & Build Validation

**Files:**
- All modified files across the project.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All 20+ suites and 80+ tests PASS.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 0 TypeScript errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: Next.js production build succeeds with clean output.

- [ ] **Step 4: Visual verification via browser preview**

Verify:
- LiveClock running in header.
- ZoomToggle changes font zoom between 100% and 120%.
- ThemeToggle toggles Light and Dark modes.
- RoleSwitcherPill switches viewpoints dynamically.
- Logo QCET displays properly.
- Bento cards and task tables display with QCET OKLCH color palettes.

- [ ] **Step 5: Final commit & wrap-up**

```bash
git commit --allow-empty -m "chore: complete UI/UX synchronization with dashboard-chamcong"
```
