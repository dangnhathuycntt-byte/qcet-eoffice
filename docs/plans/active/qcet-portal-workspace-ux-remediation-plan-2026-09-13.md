QCET WORK — Portal & Workspace UX/UI Remediation Plan

Date: 2026-09-13
Status: Ready for implementation
Branch: feat/uiux-source-remediation
Primary routes: /portal (+ the workspace components it mounts)
Scope: portal entry surface + the three role workspaces (executive cockpit, department manager, lecturer focus) + the portal metric formatter
Implementation strategy: incremental remediation on existing components, no rewrite
Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, PostgreSQL/Prisma
Design direction: Authoritative, restrained, high-density executive cockpit — per DESIGN.md
Do not merge automatically to main.

0. Why this plan exists

The portal surface and its three workspace components are functionally complete and architecturally sound (canonical delegation, real server metrics, strict light-only compliance). The remaining defects are not missing features — they are craft and conformance gaps that a source audit surfaced across five dimensions: accessibility, touch ergonomics, Vietnamese typographic integrity, semantic token drift, and metric denominator transparency.

Two independent audit passes were run against these files:

Pass 1 — direct source inspection of all five in-scope files.
Pass 2 — an independent adversarial UX review across the same files.
Pass 3 — mechanical detector (`.claude/skills/impeccable/scripts/impeccable detect`) over the four UI files, which returned zero findings. All findings below therefore come from source reading and are individually verified with file and line evidence; none rest on the detector alone.

Both passes converged on the same top-severity cluster (undersized touch targets, missing tab semantics, missing accessible names on search inputs) and diverged on specifics; the union is recorded here. Every line number in this document was re-read from source during authoring.

1. Audit result baseline

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 3/4 | Search inputs carry no accessible name; custom tabs carry no ARIA tab semantics |
| 2 | Performance | 4/4 | No layout thrash; `animate-spin` correctly gated on refresh state |
| 3 | Responsive Design | 2/4 | Pagination `size-7` (28px) and multiple `h-7`/`h-8` controls under the 44px floor |
| 4 | Theming | 3/4 | Zero `dark:` classes; `portal/page.tsx` uses hardcoded `blue-600` instead of `primary` |
| 5 | Implementation Integrity | 3/4 | `uppercase` on Vietnamese diacritics; `strokeWidth` 1.75/2.2 vs the 1.5 standard |
| **Total** | | **15/20** | **Good — address weak dimensions** |

Rating bands: 18–20 Excellent · 14–17 Good · 10–13 Acceptable · 6–9 Poor · 0–5 Critical.

2. Mandatory repository invariants

Read before changing code:

- `.claude/rules/00-core.md`
- `.claude/rules/05-domain-freeze.md`
- `.claude/rules/10-ui.md`
- `.claude/rules/11-mobile.md`
- `.claude/rules/40-data-integrity.md`
- `DESIGN.md`
- `.claude/rules/60-docs.md`

The implementation MUST preserve these rules:

2.1 Light-only standard
Never introduce `dark:` variants, `.dark` classes, or theme-switching logic. The project enforces this at the CSS layer via `@custom-variant dark (&:not(*))` in `src/app/globals.css`. This plan changes no theme behaviour.

2.2 One capability, one implementation
Do not create a second tab component, a second search input pattern, a second metric formatter, or a parallel workspace. Remediate the existing components in place. If a shared primitive is genuinely indicated, it must replace the current inline pattern — not sit beside it.

2.3 Role is not scope
The `activeTab` / `activeFilter` / `ownershipFilter` state in these components is a display filter, not an authorization model. This plan touches presentation only. It must not add, widen, narrow, or re-derive any access rule.

2.4 Domain freeze
This plan adds no value to the `UserRole` enum, adds no client-side role branch, and introduces no viewpoint facade or role masquerading component. The workspace components are mounted per authenticated role by the existing canonical router; that routing is out of scope and stays untouched.

2.5 Data integrity — denominator separation
`.claude/rules/40-data-integrity.md` rule 2 requires that parent tasks and subtasks never mix silently in a completion denominator. Task 4.1 exists solely to close that gap on the portal metric. The canonical computation already lives in `src/lib/task-metrics.ts` (`calculateTaskMetrics`, which defaults `onlyParentTasks` to `true` at line 65 and returns `isDenominatorSeparated` at line 114); the portal must not introduce a second formula, only a correctly named, correctly labelled projection of the canonical one.

2.6 Never weaken security to pass tests
No RBAC check, scope filter, or server-side validation is modified by this plan.

2.7 Verification honesty
`npm run typecheck` and the affected test files must be run and their real output inspected before any task is marked complete. See section 7.

3. Findings register

Severity: P0 blocking · P1 major (WCAG AA or ergonomics violation) · P2 minor · P3 polish.

### 3.1 P1 — Touch target violations (Responsive)

Verified instances of interactive controls below the 44px mobile floor (`DESIGN.md` §4 specifies `min-h-[44px] sm:min-h-[36px]`):

| File | Line | Current | Computed height |
|---|---|---|---|
| `lecturer-focus-workspace.tsx` | 1577 | `size-7 rounded-lg text-xs` | 28×28px — worst violation |
| `lecturer-focus-workspace.tsx` | 1539 | `px-2 py-1 text-xs` (`<select>`) | ~28px |
| `lecturer-focus-workspace.tsx` | 1189, 1488, 1505 | `text-xs h-7` | 28px |
| `lecturer-focus-workspace.tsx` | 793, 895, 1061, 1091 | `h-8` | 32px |
| `lecturer-focus-workspace.tsx` | 877 | `w-full h-8 … text-xs` (search) | 32px |
| `executive-cockpit-workspace.tsx` | 2114, 2131 | `text-xs h-7` | 28px |
| `executive-cockpit-workspace.tsx` | 1463, 1546, 1765, 1955 | `text-xs h-7.5` | 30px |
| `executive-cockpit-workspace.tsx` | 1909, 1982 | `text-xs h-7` | 28px |
| `executive-cockpit-workspace.tsx` | 1862, 1873 | `min-h-[40px] h-10 sm:h-8` | 40px → 32px (regresses on `sm`) |
| `executive-cockpit-workspace.tsx` | 1039, 1051, 1062, 1075, 2217, 2348 | `h-8` | 32px |
| `executive-cockpit-workspace.tsx` | 1652, 1661 | `min-h-[40px] h-10` | 40px |
| `department-manager-workspace.tsx` | 602, 618, 1019, 1417 | `h-8` | 32px |
| `department-manager-workspace.tsx` | 862 | `h-8` (search) | 32px |
| `department-manager-workspace.tsx` | 1135, 1143, 1268, 1277 | `text-xs h-7` | 28px |

WCAG 2.5.8 Target Size (Minimum) — AA. On a 375–430px viewport these are the primary interactive controls of the screen.

### 3.2 P1 — Missing ARIA tab semantics (Accessibility)

Three independent custom tab implementations, all built from raw `<button>` elements, none carrying `role="tablist"`, `role="tab"`, or `aria-selected`:

| File | Line | Tab group | State variable |
|---|---|---|---|
| `executive-cockpit-workspace.tsx` | 1362 | `BOTTLENECKS` / `APPROVAL_QUEUE` / `HEALTH_RADAR` / `STRATEGIC_TASKS` | `activeTab` |
| `department-manager-workspace.tsx` | 788 | `APPROVAL_QUEUE` / `UNIT_PROGRESS` / `MY_TASKS` | `activeTab` |
| `lecturer-focus-workspace.tsx` | 813 | `ALL` / `LEADING` / `PARTICIPATING` | `ownershipFilter` |

WCAG 4.1.2 Name, Role, Value.

### 3.3 P1 — Missing accessible names on search inputs and selects (Accessibility)

Every search control relies on `placeholder` alone as its accessible name. A placeholder is not an accessible name: it is not reliably announced, and it disappears on input.

| File | Line | Element | Current placeholder |
|---|---|---|---|
| `department-manager-workspace.tsx` | 857 | `<input type="text">` | "Tìm theo mã, tên nhiệm vụ, cán bộ thực hiện..." |
| `executive-cockpit-workspace.tsx` | 1732 | `<input type="text">` | "Tìm tờ trình theo tên, đơn vị, người trình..." |
| `executive-cockpit-workspace.tsx` | 2184 | `<input type="text">` | "Tìm nhiệm vụ chiến lược, mã số, chủ trì nhiệm vụ..." |
| `lecturer-focus-workspace.tsx` | 872 | `<input type="text">` | "Tìm việc, mã số..." |
| `lecturer-focus-workspace.tsx` | 1539 | `<select>` | (page size; no label of any kind) |

WCAG 4.1.2 Name, Role, Value; WCAG 1.3.1 Info and Relationships.

### 3.4 P1 — No visible focus ring on custom interactive controls (Accessibility)

The `Button` primitive (`src/components/ui/button.tsx:6`) correctly ships `focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50`. The custom tab buttons and metric-card buttons are raw `<button>` elements with inline `className` and bypass that primitive entirely. Combined with the global `-webkit-tap-highlight-color: transparent` (`src/app/globals.css:391`), keyboard focus is invisible on the primary navigation controls of all three workspaces.

Additionally `executive-cockpit-workspace.tsx:1737` hardcodes `focus:ring-indigo-500/30` — both a token violation and a non-`focus-visible` ring that fires on mouse click.

WCAG 2.4.7 Focus Visible; WCAG 2.4.11 Focus Not Obscured (Minimum).

### 3.5 P2 — Uppercase applied to Vietnamese diacritics (Implementation Integrity)

`DESIGN.md` §7 bans `uppercase tracking-wider` on Vietnamese headings. Vietnamese uses stacked diacritics (`ể ễ ệ ở ỡ ợ ứ ừ`); `text-transform: uppercase` combined with expanded tracking pushes combining marks away from their base glyphs and degrades legibility at small sizes.

| File | Line | Text affected |
|---|---|---|
| `department-manager-workspace.tsx` | 650, 689, 719, 757 | "Nhiệm vụ trực tiếp", "Đơn vị đang chạy", "Chờ thẩm định", "Tiến độ đơn vị" |
| `lecturer-focus-workspace.tsx` | 1124, 1282 | Section group labels |
| `executive-cockpit-workspace.tsx` | 1603 | "QUÁ HẠN n NGÀY", "ĐANG BỊ TẮC NGHẼN", "ĐÃ QUÁ HẠN", "ĐIỂM NGHẼN CẤP THIẾT" |
| `portal/page.tsx` | 147 | "TRƯỜNG CĐ KTCN QUY NHƠN" |
| `portal/page.tsx` | 237 | "KHỞI CHẠY DASHBOARD ĐIỀU HÀNH" |

Note `desktop` vs `mobile` divergence at `executive-cockpit-workspace.tsx:1603`: the mobile bottleneck card uppercases Vietnamese status text while the desktop path does not — the same string renders two different ways depending on viewport.

### 3.6 P2 — Semantic token drift (Theming)

| File | Line | Hardcoded | Should be |
|---|---|---|---|
| `portal/page.tsx` | 237 | `text-blue-600` | `text-primary` |
| `portal/page.tsx` | 239 | `bg-blue-600`, `hover:bg-blue-700` | `bg-primary`, `hover:bg-primary/90` |
| `portal/page.tsx` | 190, 194, 210 | `bg-blue-500/10`, `text-blue-600`, `border-blue-500/20` | `primary` token family |
| `executive-cockpit-workspace.tsx` | 1737 | `focus:ring-indigo-500/30` | `focus-visible:ring-ring/50` |

`DESIGN.md` §2 names Administrative Navy as "Singular primary accent". These instances bypass `--primary` and will not follow a future institutional retheme. Semantic status hues (`rose` / `amber` / `emerald`) are legitimate per `DESIGN.md` §2 and are **not** in scope here.

### 3.7 P2 — Lucide `strokeWidth` inconsistency (Implementation Integrity)

`.claude/rules/10-ui.md` rule 3 and `DESIGN.md` §7 both require `strokeWidth={1.5}`. All violations are in a single file:

- `portal/page.tsx:195, 211, 223, 256, 260, 286, 290` — `strokeWidth={1.75}`
- `portal/page.tsx:241, 274, 304` — `strokeWidth={2.2}`

The identifiers at 241/274/304 are `ArrowUpRight` at the card footers; the heavier stroke makes them read as a different icon weight from identical affordances elsewhere on the same screen.

### 3.8 P2 — Metric denominator not declared (Data Integrity)

`src/lib/portal-metrics.ts:15` renders:

```
`${stats.completionRate}% hoàn thành (${stats.total} việc)`
```

`PortalStatsSummary.total` is populated at `src/app/portal/page.tsx:80` from `data.stats.totalTasks ?? data.stats.totalSchoolTasks ?? 0` and written into state at line 93. Nothing in the type, the formatter, or the UI states whether that count is parent-only or includes subtasks. The canonical engine (`src/lib/task-metrics.ts:65`) defaults to parent-only and exposes `isDenominatorSeparated` (line 114) precisely so callers can assert this — the portal drops that signal on the floor.

Consequence: if `totalTasks` includes subtasks while `completionRate` is computed parent-only, the percentage and the "N việc" figure describe different populations, and the UI presents them in the same sentence as one fact.

Violates `.claude/rules/40-data-integrity.md` rule 2 (Denominator Integrity) and rule 6 (Query-Stat Derivation Symmetry).

### 3.9 P2 — Loading state causes layout shift (Implementation Integrity)

`portal-metrics.ts:12, 23` return the literal string `"Đang tải..."`, rendered into metric chips at `portal/page.tsx:216, 228` where a number belongs. The chip reflows from prose to digits on load with no reserved space.

### 3.10 P3 — Per-tab accent color fragmentation (Implementation Integrity)

`executive-cockpit-workspace.tsx:1368–1429` assigns each tab its own active color: `border-rose-600` (BOTTLENECKS), `border-indigo-600` (APPROVAL_QUEUE), `border-emerald-600` (HEALTH_RADAR), `border-primary` (STRATEGIC_TASKS). The active state therefore encodes severity rather than selection — a tab that happens to hold urgent work looks alarming even when merely selected. Severity is already carried by the count badge inside each tab, which is the correct place for it.

### 3.11 P3 — Horizontal tab overflow with no scroll affordance

Five containers use `overflow-x-auto no-scrollbar` (`executive-cockpit-workspace.tsx:1362, 1533, 1751, 1941, 2201`). `src/app/globals.css:155–163` hides the scrollbar entirely. On touch this is acceptable; on pointer devices there is no signal that tabs continue past the visible edge.

### 3.12 Confirmed correct — do not regress

These were verified as working and must survive the remediation:

- Light-only: zero `dark:` occurrences across all four UI files.
- `animate-spin` on the refresh icon is correctly gated behind `isRefreshing` (`executive-cockpit-workspace.tsx:1079`, `department-manager-workspace.tsx:624`, `lecturer-focus-workspace.tsx:799`).
- The two `animate-pulse` dots (`executive-cockpit-workspace.tsx:1214, 1602`) mark live bottleneck state; they are semantic, not decorative.
- Safe-area handling on the mobile action bar: `bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]` (`executive-cockpit-workspace.tsx:1091`).
- Global mobile ergonomics: `touch-action: manipulation` and 16px form inputs (`src/app/globals.css:391–399`).
- Selection theming on the portal root (`portal/page.tsx:122`).
- Denominator separation already enforced at the engine layer (`src/lib/task-metrics.ts:68`).
- Backward-compatibility shims `executive-workspace.tsx` and `staff-workspace.tsx` are 4-line delegations; `bento-portal-hub.tsx` is intentionally neutralized. Leave all three alone.

4. Non-goals

Explicitly out of scope. Do not expand into these:

- No new design tokens, no palette change, no `DESIGN.md` edit.
- No dark mode, no theme switcher.
- No role logic, no `UserRole` enum change, no scope-model change (see §2.3–2.4).
- No change to `src/app/api/dashboard/overview/route.ts` or any server route. Where §3.8 needs server-side confirmation, it is raised as an open question in §6, not fixed here.
- No new tab component abstraction. If a shared `Tabs` primitive is introduced it must replace all three inline implementations in the same change, per §2.2.
- No change to `src/components/ui/*` primitives. They are already conformant; the inline call sites are the problem.
- No touching `/tasks`, `/calendar`, `/documents`, or their components.

5. Implementation plan

Each phase is independently shippable and independently verifiable. Run phases in order; within a phase, tasks are unordered unless stated.

### Phase 1 — Touch targets (P1)

Goal: every interactive control in the four files is ≥44px on mobile and no control shrinks below 40px on any breakpoint.

1.1 `lecturer-focus-workspace.tsx:1577` — pagination number buttons. Replace `size-7` with `size-11 sm:size-8`. This is the highest-priority single edit in the plan (28px → 44px).
1.2 `lecturer-focus-workspace.tsx:1539` — page-size `<select>`. Add `min-h-[44px] sm:min-h-[32px]`.
1.3 `lecturer-focus-workspace.tsx:1189, 1488, 1505` — `h-7` → `min-h-[44px] sm:min-h-[32px] sm:h-8`.
1.4 `lecturer-focus-workspace.tsx:793, 895, 1061, 1091` — `h-8` → `min-h-[44px] sm:h-8`.
1.5 `lecturer-focus-workspace.tsx:872` — search input `h-8` → `min-h-[44px] sm:h-8`.
1.6 `executive-cockpit-workspace.tsx:2114, 2131` — `h-7` → `min-h-[44px] sm:min-h-[32px] sm:h-8`.
1.7 `executive-cockpit-workspace.tsx:1463, 1546, 1765, 1955` — `h-7.5` → `min-h-[44px] sm:min-h-[32px] sm:h-8`.
1.8 `executive-cockpit-workspace.tsx:1909, 1982` — `h-7` → `min-h-[44px] sm:min-h-[32px] sm:h-8`.
1.9 `executive-cockpit-workspace.tsx:1862, 1873` — remove the `sm:h-8` regression; set `min-h-[44px] h-11 sm:min-h-[36px] sm:h-9`.
1.10 `executive-cockpit-workspace.tsx:1039, 1051, 1062, 1075, 2217, 2348` — `h-8` → `min-h-[44px] sm:h-8`.
1.11 `executive-cockpit-workspace.tsx:1652, 1661` — `min-h-[40px] h-10` → `min-h-[44px] h-11 sm:min-h-[40px] sm:h-10`.
1.12 `department-manager-workspace.tsx:602, 618, 1019, 1417` — `h-8` → `min-h-[44px] sm:h-8`.
1.13 `department-manager-workspace.tsx:862` — search input `h-8` → `min-h-[44px] sm:h-8`.
1.14 `department-manager-workspace.tsx:1135, 1143, 1268, 1277` — `h-7` → `min-h-[44px] sm:min-h-[32px] sm:h-8`.

Acceptance: `grep -rn "size-7\b" src/components/portal/` returns nothing; no interactive element in the four files lacks either `min-h-[44px]` or a documented exception.

### Phase 2 — Accessibility (P1)

2.1 Tab semantics — `executive-cockpit-workspace.tsx:1362`
  - Container: add `role="tablist"` and `aria-label="Danh mục chỉ đạo điều hành Ban Giám hiệu"`.
  - Each button: add `role="tab"`, `id={`tab-${id}`}`, `aria-controls={`panel-${id}`}`, `aria-selected={activeTab === id}`, plus `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50`.
  - Each panel (the `activeTab === "…" &&` branch blocks at 1236, 1293, 1333, 1440): add `role="tabpanel"`, `id={`panel-${id}`}`, `aria-labelledby={`tab-${id}`}`.
  - Keyboard: implement arrow-key traversal across the tablist per WAI-ARIA APG (Left/Right move focus, Home/End jump to ends). The existing `onClick` handlers already do the selection; add `onKeyDown` for focus movement.

2.2 Tab semantics — `department-manager-workspace.tsx:788` — same treatment, `aria-label="Danh mục công việc đơn vị"`. Note this component also has clickable metric cards at 640–760 that call `setActiveTab`; per `DESIGN.md` §4 those are already `<button type="button">` with `title` — **convert their `title` to `aria-label`** and add `aria-pressed` so their selected state is announced.

2.3 Tab semantics — `lecturer-focus-workspace.tsx:813` — same treatment, `aria-label="Lọc theo vai trò tham gia nhiệm vụ"`.

2.4 Accessible names on search controls. Add `aria-label` to each input, exactly one per row:

| File | Line | `aria-label` |
|---|---|---|
| `department-manager-workspace.tsx` | 857 | `Tìm kiếm nhiệm vụ đơn vị theo mã số, tên nhiệm vụ, hoặc cán bộ thực hiện` |
| `executive-cockpit-workspace.tsx` | 1732 | `Tìm kiếm tờ trình chờ phê duyệt theo tên, đơn vị, hoặc người trình` |
| `executive-cockpit-workspace.tsx` | 2184 | `Tìm kiếm nhiệm vụ chiến lược cấp trường` |
| `lecturer-focus-workspace.tsx` | 872 | `Tìm kiếm nhiệm vụ cá nhân theo tiêu đề hoặc mã số` |
| `lecturer-focus-workspace.tsx` | 1539 | `Số lượng nhiệm vụ hiển thị trên mỗi trang` |

2.5 Focus rings on custom controls. Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1` to: every tab button from 2.1–2.3, the metric-card buttons at `department-manager-workspace.tsx:638, 675, 707`, and the clickable div at `department-manager-workspace.tsx:744`.

2.6 `executive-cockpit-workspace.tsx:744` note: that element is a `<div onClick>` with a conditional `cursor-pointer` — it is not keyboard reachable at all. Convert it to `<button type="button">` consistent with the three siblings above it, applying `disabled={metrics.overdueCount === 0}` in place of the conditional cursor styling.

2.7 `portal/page.tsx` — the three bento navigation `<Link>` cards (185, 250, 280) contain no text that describes their destination beyond the heading itself, and their trailing `ArrowUpRight` affordances are decorative. Add `aria-label` naming the destination to each `<Link>`, and `aria-hidden="true"` to the three `ArrowUpRight` icons (241, 274, 304) plus the `Activity`/`CheckCircle2` chips (211, 223).

Acceptance: `grep -rn "role=\"tab\"" src/components/portal/` returns ≥ 10 matches (4 + 3 + 3); every `<input type="text">` and `<select>` in the four files has an `aria-label`. Keyboard-only traversal of each workspace reaches every tab, every metric card, and every search field with a visible ring.

### Phase 3 — Vietnamese typography and tokens (P2)

3.1 Remove `uppercase` (and the paired `tracking-wider` / `tracking-widest`) from the nine Vietnamese label sites listed in §3.5. Preserve hierarchy by keeping `text-xs font-semibold text-muted-foreground`. Keep `tracking-wide` only where the content is a numeric `tabular-nums` sequence.

3.2 `executive-cockpit-workspace.tsx:1603` — additionally remove the hardcoded all-caps string literals (`QUÁ HẠN`, `ĐANG BỊ TẮC NGHẼN`, `ĐÃ QUÁ HẠN`, `ĐIỂM NGHẼN CẤP THIẾT`) and use sentence case matching the desktop path, so both viewports render identical copy.

3.3 Icon strokes — `portal/page.tsx`: replace all seven `strokeWidth={1.75}` (195, 211, 223, 256, 260, 286, 290) and all three `strokeWidth={2.2}` (241, 274, 304) with `strokeWidth={1.5}`.

3.4 Token substitution — `portal/page.tsx`: `text-blue-600` → `text-primary`, `bg-blue-600` → `bg-primary`, `hover:bg-blue-700` → `hover:bg-primary/90`. The `bg-blue-500/10` / `border-blue-500/20` decorative tints at 190/194/210 become `bg-primary/10` / `border-primary/20`.

3.5 `executive-cockpit-workspace.tsx:1737` — `focus:ring-indigo-500/30` → `focus-visible:ring-2 focus-visible:ring-ring/50`.

Acceptance: `grep -rn "uppercase" src/components/portal/ src/app/portal/` returns only `executive-cockpit-workspace.tsx:1603`'s removal target gone and the `tabular-nums` sites if any legitimately remain; `grep -rn "strokeWidth={1.75}\|strokeWidth={2.2}" src/app/portal/` returns nothing; `grep -rn "blue-600\|indigo-500" src/app/portal/page.tsx` returns nothing.

### Phase 4 — Data integrity and loading state (P2)

4.1 Denominator declaration — `src/lib/portal-metrics.ts`

Rename `total` to `parentTaskTotal` and make the contract explicit:

```typescript
export interface PortalStatsSummary {
  completionRate: number;
  /** Parent tasks only — subtasks are excluded so the denominator matches completionRate. */
  parentTaskTotal: number;
  schoolTasks: number;
  /** Mirrors isDenominatorSeparated from src/lib/task-metrics.ts. */
  isDenominatorSeparated: boolean;
}
```

Update the formatter to name the population in the UI:
`${stats.completionRate}% hoàn thành (${stats.parentTaskTotal} việc gốc)`.

Update the call site at `src/app/portal/page.tsx:80, 91–95` to map into the renamed field.

4.2 Confirm the server contract — see open question O1 in §6. If `totalTasks` is not parent-only, do not silently relabel it; escalate before merging Phase 4.

4.3 Loading skeleton — `portal/page.tsx:216, 228`. When `isLoading` is true, render `<Skeleton className="h-4 w-24 rounded" />` in the metric slot instead of the `"Đang tải..."` string. Have `formatProgressMetric` / `formatSchoolTasksMetric` return `null` for the loading branch so the chip can branch on it, or branch in the component and leave the formatters returning the authenticated/empty strings only. Reserve the chip height so no reflow occurs.

4.4 Add a regression test in the existing portal-metrics test file (locate via `grep -rl "formatProgressMetric" src/tests/ src/**/*.test.ts` before creating anything new — per `.claude/rules/60-docs.md` rule 1) asserting that the rendered string names the parent-only population and that the loading branch produces no numeric text.

Acceptance: `npm run typecheck` clean; the portal-metrics test asserts the renamed field and the loading branch.

### Phase 5 — Tab uniformity and overflow affordance (P3)

5.1 `executive-cockpit-workspace.tsx:1368–1429` — collapse the four per-tab active colors to one: `border-primary text-primary font-semibold` for every tab. Leave the count badges untouched; they already carry severity (`bg-rose-500` for bottlenecks, `bg-indigo-600` for pending approvals).

5.2 Overflow affordance — for each of the five `overflow-x-auto no-scrollbar` containers (`executive-cockpit-workspace.tsx:1362, 1533, 1751, 1941, 2201`), add a right-edge fade so pointer users can see that content continues:

```
[mask-image:linear-gradient(to_right,white_calc(100%-2rem),transparent)]
```

Apply only where the container is genuinely scrollable at the current breakpoint; on containers that never overflow, prefer leaving them unmasked rather than masking unconditionally. If a shared utility is wanted, add it once to `src/app/globals.css` — do not duplicate the arbitrary-value class five times.

Acceptance: visual check at 375px and 1440px; all four tabs share one active treatment.

6. Open questions

O1 — `parentTaskTotal` semantics. Confirm which population `data.stats.totalTasks` from `/api/dashboard/overview` describes, and whether it is computed through `calculateTaskMetrics` (parent-only) or by a raw count. If it is a raw count including subtasks, either the endpoint or the portal projection must change — but that decision is outside this plan's scope (§4) and must be raised with the owner rather than silently resolved. Do not rename the field to `parentTaskTotal` until this is answered.

O2 — Shared `Tabs` primitive. Three inline tab implementations are being patched three times in Phase 2. A shared primitive would be the canonical answer under `.claude/rules/00-core.md` rule 1, but introducing it here would expand scope across three large components. Recommendation: land Phase 2 as-is, then open a separate consolidation plan if the duplication proves costly. Flag for the owner; do not do it inside this plan.

7. Verification gates

Run after each phase, not once at the end.

7.1 Static
```
npm run typecheck
```
Must be clean. Inspect the real output; do not infer.

7.2 Invariant greps — all must return the stated result
```
grep -rn "dark:" src/app/portal/ src/components/portal/            # expect: empty
grep -rn "size-7\b" src/components/portal/                         # expect: empty
grep -rn "strokeWidth={1.75}\|strokeWidth={2.2}" src/app/portal/   # expect: empty
grep -rn "role=\"tablist\"" src/components/portal/                 # expect: 3
grep -rn "aria-label" src/components/portal/                       # expect: ≥ 15
```

7.3 Tests — affected files only, per AGENTS.md
```
npm test -- --run <portal-metrics and workspace test paths discovered in 4.4>
```
Run the full suite only at the integration gate.

7.4 Manual
- Keyboard-only pass through each of the three workspaces: Tab reaches every control, focus ring always visible, arrow keys traverse each tablist, no keyboard trap.
- 375px viewport: every interactive control ≥ 44px; no horizontal page scroll; the pagination row is usable with a thumb.
- 1440px viewport: no control below 36px; the four executive tabs share one active treatment.
- Screen reader spot check on `/portal` and the two search inputs.

7.5 Honesty requirement
No task in this plan is complete until its gate has actually been run and its output read. Per `.claude/rules/00-core.md` rule 7, do not report a phase as verified on the strength of the edit alone.

8. Execution order

| Phase | Severity | Depends on | Ships independently |
|---|---|---|---|
| 1 — Touch targets | P1 | — | yes |
| 2 — Accessibility | P1 | — | yes |
| 3 — Typography & tokens | P2 | — | yes |
| 4 — Data integrity & skeleton | P2 | O1 answered | blocking on O1 |
| 5 — Tab uniformity & overflow | P3 | Phase 2 (same elements) | after 2 |

Phases 1 and 2 are the release blockers (WCAG AA + ergonomics). Phase 4 is blocked on O1 and must not be merged on a guess. Phases 3 and 5 are quality improvements.

9. Supersession

This plan supersedes nothing. No existing active plan targets `/portal`, `src/app/portal/page.tsx`, `src/components/portal/*-workspace.tsx`, or `src/lib/portal-metrics.ts` — verified by grep across `docs/plans/active/` during authoring. `qcet-source-uiux-remediation-plan-65f99561.md` mentions "bàn làm việc" only as one screen inside its review scope; it prescribes no change to these files.

10. Execution record — 2026-09-13

O1 RESOLVED — the rename is truthful. `src/lib/server/dashboard-service.ts:37-41` constrains the task query with `parentTaskId: null`, so `dbTasks` contains only parent tasks. `total = mappedTasks.length` (line 222) and `completionRate = completed / total` (line 261) therefore share the same parent-only denominator. Renaming the field to `parentTaskTotal` and labelling it "việc gốc" is accurate. No server change was needed.

Phases 1, 2, 3 and 5 applied to all four UI files by four parallel agents, each followed by an independent adversarial verifier. Three of the four groups returned PASS with only P3 notes. Phases 4.1 and 4.3 were applied to `portal-metrics.ts` and `portal/page.tsx`.

Gate results, all run and read directly:

| Gate | Result |
|---|---|
| `npm run typecheck` | clean |
| `grep -rn "dark:" src/app/portal src/components/portal` | empty |
| `grep -rn "size-7\b" src/components/portal` | empty |
| `grep -rn "strokeWidth={1.75}\|strokeWidth={2.2}" src/app/portal` | empty |
| `role="tablist"` count | 3, as specified |
| `role="tab"` count | 10 (4 + 3 + 3), as specified |
| `aria-label` count in `src/components/portal` | 34 |
| `tests/portal-real-data-and-zoom-eradication.test.ts` | 21 pass / 0 fail |

Three deviations from the literal spec, all accepted:

1. Task 4.3 specified `<Skeleton className="h-4 w-24 rounded" />`. No shared `Skeleton` component exists anywhere in this repository — the project's canonical convention is an inline `animate-pulse` element (see `src/app/dashboard/loading.tsx`). The metric slot renders an inline `<span aria-hidden="true" className="inline-block h-4 w-24 rounded bg-muted/60 animate-pulse" />` with `min-h-4` on the container to reserve height. The substantive requirement — no `"Đang tải..."` prose, no layout shift, formatters return `null` on the loading branch — is met.

2. Task 4.4 was not assigned to any agent because the implementation agents were constrained to their own file lists. The interface rename broke `tests/portal-real-data-and-zoom-eradication.test.ts` (5× TS2353, 6 failing tests), leaving the branch red. This was fixed in the same session: the test now constructs `parentTaskTotal` + `isDenominatorSeparated`, asserts the `(N việc gốc)` string, asserts the loading branch returns `null`, and asserts the render emits a skeleton rather than `"Đang tải..."` prose.

3. Task 3.1 asked to keep hierarchy via `text-xs font-semibold`; the implementer also converted the two `group-hover:text-blue-600` sites and one `bg-blue-600` dot, which belong to the same hardcoded token family. The emerald and slate semantic hues were deliberately left intact.

Known gap in this plan's scope — recorded, not fixed. Section 3.5 named four UI files. The portal component family actually contains thirteen: `executive-briefing-modal.tsx`, `executive-resolution-drawer.tsx`, `executive-bottleneck-card.tsx`, `executive-unit-radar.tsx` and `review-action-dialog.tsx` still carry twelve `uppercase` + `tracking-wider` sites on Vietnamese text that this audit never inspected, and `executive-briefing-modal.tsx:375,441` use hardcoded `text-rose-600` / `text-indigo-600`. These are live components in the same directory and should be picked up by a follow-up pass; this plan does not cover them.
