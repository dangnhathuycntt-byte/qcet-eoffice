---
status: superseded
domain: ux
created: 2026-09-07
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Single-Tier Sidebar (248px) & Topbar Scope Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the cluttered Dual-Rail sidebar by unifying navigation into a sleek Single-Tier 248px Sidebar (collapsible to 64px via [⌘B]) and moving operational scope switching to a context-aware Scope Switcher on the Header Topbar.

**Architecture:** Transition from `Module ➔ Section ➔ Page` to a flat `Section ➔ Page` model organized into 3 clear groups: `CÁ NHÂN`, `TOÀN TRƯỜNG & ĐƠN VỊ`, and `VĂN BẢN & ĐIỀU HÀNH`. Decouple user identity from operational scope by placing a `ScopeSwitcher` component on the Topbar that synchronizes bidirectionally with URL query parameters (`?scope=school|unit|my&dept=...`).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Node.js test runner (`tsx --test`).

**Spec:** [docs/superpowers/specs/2026-09-07-single-tier-sidebar-scope-switcher-spec.md](docs/superpowers/specs/2026-09-07-single-tier-sidebar-scope-switcher-spec.md)

## Global Constraints

- **Build Rule (CRITICAL):** Never run `npm run build` while `npm run dev` is running on port 3001. Check code correctness using `npm run typecheck` (`tsc --noEmit`) and `npm test` (`tsx --test tests/**/*.test.ts`).
- **Sidebar Dimensions:** Expanded width: `248px` (`w-[248px]`, `md:pl-[248px]`); Collapsed width: `64px` (`w-16`, `md:pl-16`).
- **Header Height:** Sidebar brand header fixed at `48px` (`h-12`).
- **Design Tokens:** Active states must use subtle tinting (`bg-primary/10 text-primary font-semibold`) with an accent indicator bar, avoiding solid neon blue backgrounds.

---

### Task 1: Navigation Data Structure & Types (`sidebar-context.tsx`)

**Files:**
- Modify: `src/components/layout/sidebar-context.tsx`
- Modify/Rename: `tests/dual-rail-navigation.test.ts` $\rightarrow$ `tests/single-tier-navigation.test.ts`

**Interfaces:**
- Produces:
  - `export type NavigationSection = "personal" | "workspace" | "operations";`
  - `export const SINGLE_TIER_NAV_ITEMS: SidebarItem[]`
  - Updated `sidebarWidth` computation (248px expanded, 64px collapsed)

- [ ] **Step 1: Write the failing unit tests for Single-Tier Navigation**

Rename `tests/dual-rail-navigation.test.ts` to `tests/single-tier-navigation.test.ts` and write tests verifying the new single-tier flat structure and section mapping:

```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  SINGLE_TIER_NAV_ITEMS,
  type NavigationSection,
  type SidebarItem,
  resolveBreadcrumb,
} from "@/components/layout/sidebar-context";

describe("Single-Tier Navigation Architecture Test Suite", () => {
  describe("Single-Tier Nav Items Specification", () => {
    test("Contains required items across 3 sections: personal, workspace, operations", () => {
      assert.ok(Array.isArray(SINGLE_TIER_NAV_ITEMS), "SINGLE_TIER_NAV_ITEMS must be an array");
      
      const sections = new Set(SINGLE_TIER_NAV_ITEMS.map((item) => item.section));
      assert.ok(sections.has("personal"), "Must have personal section");
      assert.ok(sections.has("workspace"), "Must have workspace section");
      assert.ok(sections.has("operations"), "Must have operations section");
    });

    test("Personal section includes Desk (/), Calendar (/calendar), Notifications (/notifications)", () => {
      const personalItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "personal");
      const hrefs = personalItems.map((i) => i.href);
      assert.ok(hrefs.includes("/"), "Personal section must include '/'");
      assert.ok(hrefs.includes("/calendar"), "Personal section must include '/calendar'");
      assert.ok(hrefs.includes("/notifications"), "Personal section must include '/notifications'");
    });

    test("Workspace section includes Tasks (/tasks)", () => {
      const workspaceItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "workspace");
      const hrefs = workspaceItems.map((i) => i.href);
      assert.ok(hrefs.includes("/tasks"), "Workspace section must include '/tasks'");
    });

    test("Operations section includes Documents (/documents) and Org (/org)", () => {
      const opItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "operations");
      const hrefs = opItems.map((i) => i.href);
      assert.ok(hrefs.includes("/documents"), "Operations section must include '/documents'");
      assert.ok(hrefs.includes("/org"), "Operations section must include '/org'");
    });
  });

  describe("Breadcrumbs resolution contract", () => {
    test("Resolves default root and page titles cleanly", () => {
      const [rootTitle, pageTitle] = resolveBreadcrumb("/");
      assert.strictEqual(rootTitle, "QCET E-Office");
      assert.strictEqual(pageTitle, "Quản lý công việc");
    });

    test("Resolves documents breadcrumb correctly", () => {
      const [rootTitle, pageTitle] = resolveBreadcrumb("/documents");
      assert.strictEqual(rootTitle, "QCET E-Office");
      assert.strictEqual(pageTitle, "Văn bản & Công văn");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/single-tier-navigation.test.ts`  
Expected: FAIL with `SINGLE_TIER_NAV_ITEMS is not defined`.

- [ ] **Step 3: Update `src/components/layout/sidebar-context.tsx`**

Implement `NavigationSection = "personal" | "workspace" | "operations"` and export `SINGLE_TIER_NAV_ITEMS`:

```typescript
export type NavigationSection = "personal" | "workspace" | "operations";

export const SINGLE_TIER_NAV_ITEMS: SidebarItem[] = [
  // SECTION 1: CÁ NHÂN
  {
    id: "desk",
    label: "Bàn làm việc",
    href: "/",
    icon: LayoutDashboard,
    section: "personal",
    badgeKey: "myFocus",
  },
  {
    id: "calendar",
    label: "Lịch công tác",
    href: "/calendar",
    icon: Calendar,
    section: "personal",
    badgeKey: "calendar",
  },
  {
    id: "notifications",
    label: "Thông báo",
    href: "/notifications",
    icon: Bell,
    section: "personal",
    badgeKey: "notifications",
  },
  // SECTION 2: TOÀN TRƯỜNG & ĐƠN VỊ
  {
    id: "tasks",
    label: "Kho nhiệm vụ",
    href: "/tasks",
    icon: CheckSquare,
    section: "workspace",
    badgeKey: "allTasks",
  },
  // SECTION 3: VĂN BẢN & ĐIỀU HÀNH
  {
    id: "documents",
    label: "Sổ văn bản đến/đi",
    href: "/documents",
    icon: FileText,
    section: "operations",
    badgeKey: "docsInbox",
  },
  {
    id: "org",
    label: "Cơ cấu & Danh bạ",
    href: "/org",
    icon: Building2,
    section: "operations",
  },
];
```

Update `sidebarWidth` logic in `SidebarProvider`:
```typescript
const sidebarWidth = effectiveCollapsed ? 64 : 248;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/single-tier-navigation.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/layout/sidebar-context.tsx tests/single-tier-navigation.test.ts
git rm tests/dual-rail-navigation.test.ts 2>/dev/null || true
git commit -m "feat(nav): define single-tier navigation items and update sidebar dimensions"
```

---

### Task 2: Layout Shell Padding & Responsive Container (`app-shell.tsx`)

**Files:**
- Modify: `src/components/layout/app-shell.tsx`

**Interfaces:**
- Consumes: `useSidebar().isCollapsed` from `src/components/layout/sidebar-context.tsx`
- Adjusts: `md:pl-[248px]` (expanded) and `md:pl-16` (collapsed, 64px)

- [ ] **Step 1: Check existing `app-shell.tsx` implementation**

Review lines 20-35 of `src/components/layout/app-shell.tsx` where `pl-28` and `pl-[280px]` are currently hardcoded.

- [ ] **Step 2: Update padding classes in `app-shell.tsx`**

Modify `src/components/layout/app-shell.tsx`:
```tsx
<React.Suspense fallback={<aside className="hidden md:flex w-[248px] shrink-0 border-r border-border/50 bg-card" />}>
  <AppSidebar />
</React.Suspense>
<div
  className={cn(
    "min-h-screen flex flex-col transition-all duration-200 ease-in-out",
    isCollapsed ? "md:pl-16" : "md:pl-[248px]"
  )}
>
```

- [ ] **Step 3: Run typecheck to verify no regression**

Run: `npm run typecheck`  
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "refactor(layout): update AppShell padding for 248px expanded and 64px collapsed sidebar"
```

---

### Task 3: Single-Tier Sidebar Component & Rail Deprecation (`app-sidebar.tsx`)

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`
- Delete: `src/components/layout/app-primary-rail.tsx`

**Interfaces:**
- Consumes: `SINGLE_TIER_NAV_ITEMS`, `useSidebar`
- Implements:
  - Header: 48px height, Logo QCET + Title `QUẢN LÝ CÔNG VIỆC` & `Năm học 2026–2027`
  - Grouped items: `CÁ NHÂN`, `TOÀN TRƯỜNG & ĐƠN VỊ`, `VĂN BẢN & ĐIỀU HÀNH`
  - Subtle tinted active indicator (`bg-primary/10 text-primary font-semibold` + `border-l-[3px] border-primary`)
  - Clean mono badge counters
  - Footer: `/settings` and Collapse trigger button `[⌘B]`

- [ ] **Step 1: Inspect and prepare `app-sidebar.tsx`**

Replace Dual-Rail nesting with Single-Tier markup:
1. Remove `<AppPrimaryRail />` import and JSX element.
2. Structure the main desktop `<aside>` as a single container of width `isCollapsed ? "w-16" : "w-[248px]"`.
3. Add clean Brand Header (48px) with Logo and Academic Year.
4. Render sections grouped from `SINGLE_TIER_NAV_ITEMS`:
   - `personal`: "CÁ NHÂN"
   - `workspace`: "TOÀN TRƯỜNG & ĐƠN VỊ"
   - `operations`: "VĂN BẢN & ĐIỀU HÀNH"
5. In collapsed mode (64px / `w-16`):
   - Center logo at the top (32x32px).
   - Display icons with tooltips on the right.
   - Display small mono badge dots or indicators.
   - Place Settings and Expand buttons at the bottom.

- [ ] **Step 2: Delete deprecated `app-primary-rail.tsx`**

Remove `src/components/layout/app-primary-rail.tsx` from git:
```bash
git rm src/components/layout/app-primary-rail.tsx
```

- [ ] **Step 3: Write the new Single-Tier `app-sidebar.tsx` implementation**

Update `src/components/layout/app-sidebar.tsx`:
- Include keyboard listener for `⌘B` / `Ctrl+B` toggle.
- Integrate tooltips when collapsed.
- Include maintenance dialog fallback for pending features.
- Keep mobile drawer functionality with clean responsive styling.

- [ ] **Step 4: Run typecheck and navigation tests**

Run: `npm run typecheck && npx tsx --test tests/single-tier-navigation.test.ts`  
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat(sidebar): implement single-tier 248px sidebar and remove dual-rail component"
```

---

### Task 4: Topbar Scope Switcher Component (`scope-switcher.tsx`)

**Files:**
- Create: `src/components/layout/scope-switcher.tsx`
- Test: `tests/scope-switcher.test.ts`

**Interfaces:**
- Consumes:
  - `useSearchParams()`, `useRouter()`, `usePathname()`
  - `QCET_DEPARTMENTS` from `@/components/org/organization-tree`
  - `parseScopeParam`, `scopeToParam`, `TaskScope` from `@/lib/unified-task-hub`
- Produces:
  - `<ScopeSwitcher />` component with Trigger button & Dropdown menu.

- [ ] **Step 1: Write unit tests for scope resolution & parameter handling**

Create `tests/scope-switcher.test.ts`:

```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { parseScopeParam, scopeToParam, type TaskScope } from "@/lib/unified-task-hub";

describe("Scope Switcher Logic Test Suite", () => {
  test("parseScopeParam correctly identifies school, unit, and my", () => {
    assert.strictEqual(parseScopeParam("school"), "SCHOOL_TASKS");
    assert.strictEqual(parseScopeParam("school_tasks"), "SCHOOL_TASKS");
    assert.strictEqual(parseScopeParam("unit"), "UNIT_TASKS");
    assert.strictEqual(parseScopeParam("unit_tasks"), "UNIT_TASKS");
    assert.strictEqual(parseScopeParam("my"), "MY_TASKS");
    assert.strictEqual(parseScopeParam("my_tasks"), "MY_TASKS");
  });

  test("scopeToParam maps TaskScope to shorthand query values", () => {
    assert.strictEqual(scopeToParam("SCHOOL_TASKS"), "school");
    assert.strictEqual(scopeToParam("UNIT_TASKS"), "unit");
    assert.strictEqual(scopeToParam("MY_TASKS"), "my");
  });

  test("Falls back to defaultScope when parameter is null or undefined", () => {
    assert.strictEqual(parseScopeParam(null, "SCHOOL_TASKS"), "SCHOOL_TASKS");
    assert.strictEqual(parseScopeParam(undefined, "MY_TASKS"), "MY_TASKS");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/scope-switcher.test.ts`  
Expected: PASS.

- [ ] **Step 3: Implement `src/components/layout/scope-switcher.tsx`**

Create `src/components/layout/scope-switcher.tsx`:
- Trigger button: Displays context icon (`School` / `Building2` / `User`), current scope label (`Toàn trường` / `[Tên khoa]` / `Cá nhân`), and `ChevronDown`.
- Dropdown Menu:
  - Macro scope: `Toàn trường (BGH QCET)` $\rightarrow$ sets `?scope=school`
  - Micro scope: `Cá nhân (Của tôi)` $\rightarrow$ sets `?scope=my`
  - Meso scope: `ĐƠN VỊ & KHOA PHÒNG` $\rightarrow$ maps over `QCET_DEPARTMENTS` (excluding BGH), sets `?scope=unit&dept=[deptCode]`
  - Footer Action: `Quản lý phân quyền & ủy quyền...` $\rightarrow$ dispatches event `qcet:open-delegation-modal`

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/layout/scope-switcher.tsx tests/scope-switcher.test.ts
git commit -m "feat(layout): add ScopeSwitcher dropdown component for Topbar"
```

---

### Task 5: Integrate Scope Switcher into `AppTopbar` (`app-topbar.tsx`)

**Files:**
- Modify: `src/components/layout/app-topbar.tsx`

**Interfaces:**
- Consumes: `ScopeSwitcher` from `@/components/layout/scope-switcher`
- Inserts: Next to Breadcrumbs in the Left Zone of `AppTopbar`

- [ ] **Step 1: Check existing Left Zone in `app-topbar.tsx`**

Review lines 188-216 of `src/components/layout/app-topbar.tsx`.

- [ ] **Step 2: Insert ScopeSwitcher into Left Zone**

Add a divider and the `<ScopeSwitcher />` component right after `<TopbarBreadcrumbs />`:

```tsx
{/* Dynamic Breadcrumbs */}
<React.Suspense fallback={<TopbarBreadcrumbsFallback pathname={pathname} />}>
  <TopbarBreadcrumbs pathname={pathname} />
</React.Suspense>

{/* Operational Scope Switcher */}
<div className="hidden sm:flex items-center ml-2 pl-2 border-l border-border/60">
  <React.Suspense fallback={<div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />}>
    <ScopeSwitcher />
  </React.Suspense>
</div>
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npm run typecheck && npm test`  
Expected: PASS with all tests passing.

- [ ] **Step 4: Commit changes**

```bash
git add src/components/layout/app-topbar.tsx
git commit -m "feat(topbar): integrate ScopeSwitcher into topbar header"
```

---

### Task 6: Remove Legacy Scope Button & Sync Workspaces (`page.tsx`)

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Removes: Old button `<LayoutGrid /> Chế độ xem toàn trường (Nâng cao)`
- Synchronizes: URL `scope` parameter (`school` $\rightarrow$ Executive Cockpit, `unit` $\rightarrow$ Unit Hub, `my` $\rightarrow$ My Focus)

- [ ] **Step 1: Locate and remove the old button in `src/app/page.tsx`**

Find lines 1061-1070:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleToggleStaffExpanded}
  className="gap-1.5 text-xs rounded-xl hover:bg-muted/80"
  title="Chuyển sang chế độ xem toàn trường để tra cứu bảng việc chi tiết"
>
  <LayoutGrid size={14} strokeWidth={1.5} />
  <span>Chế độ xem toàn trường (Nâng cao)</span>
</Button>
```
Remove this button and clean up any unused state/handlers.

- [ ] **Step 2: Verify scope-based workspace dispatching**

Ensure `page.tsx` respects the `scope` search parameter:
- When `scope === "SCHOOL_TASKS"`, display `ExecutiveCockpitWorkspace` (or Executive view).
- When `scope === "UNIT_TASKS"`, display the unit's tasks filtered by `selectedDepartment`.
- When `scope === "MY_TASKS"`, display the personal focus workspace.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS with 0 errors.

- [ ] **Step 4: Run full test suite**

Run: `npm test`  
Expected: PASS with all tests green.

- [ ] **Step 5: Commit changes**

```bash
git add src/app/page.tsx
git commit -m "refactor(home): remove legacy school-view button and harmonize scope switching with Topbar"
```

---

### Task 7: Visual & Functional Verification

**Files:**
- All touched components in `src/components/layout/*` and `src/app/page.tsx`

- [ ] **Step 1: Run comprehensive typecheck**

Run: `npm run typecheck`  
Expected: Exit code 0, 0 errors.

- [ ] **Step 2: Run all test suites**

Run: `npm test`  
Expected: All suites passing.

- [ ] **Step 3: Verify dev server preview**

Ensure `localhost:3001` renders cleanly without layout shifts or missing CSS. Verify:
1. Sidebar width is 248px, background and borders match design system tokens.
2. Brand header is compact (48px).
3. Clicking `[⌘B]` or Ctrl+B collapses the sidebar to 64px icon-only mode with tooltips.
4. Scope Switcher on the Topbar opens smoothly, changes scope query parameters, and updates the workspace view immediately.

- [ ] **Step 4: Final commit & cleanup**

```bash
git add -A
git commit -m "chore: complete single-tier sidebar and topbar scope switcher refactoring"
```
