---
name: "QCET E-Office"
description: "An executive cockpit for vocational-college governance — light-only, token-bound, and built for Vietnamese institutional work."
colors:
  canvas: "oklch(0.985 0.003 250)"
  surface: "oklch(1 0 0)"
  surface-muted: "oklch(0.965 0.005 250)"
  surface-sidebar: "oklch(0.985 0 0)"
  surface-overlay: "oklch(0 0 0 / 0.40)"
  text-primary: "oklch(0.145 0.015 250)"
  text-secondary: "oklch(0.205 0.015 250)"
  text-muted: "oklch(0.38 0.015 250)"
  text-on-accent: "oklch(0.985 0 0)"
  primary-accent: "oklch(0.42 0.18 250)"
  secondary-accent: "oklch(0.965 0.005 250)"
  accent-surface: "oklch(0.96 0.008 250)"
  border-subtle: "oklch(0.915 0.006 250)"
  border-strong: "oklch(0.915 0.006 250 / 0.60)"
  input-border: "oklch(0.915 0.006 250)"
  focus-ring: "oklch(0.45 0.12 250)"
  semantic-danger: "oklch(0.577 0.245 27.325)"
  semantic-flash: "#b91c1c"
  semantic-urgent: "#be123c"
  semantic-urgent-fill: "#e11d48"
  semantic-warning: "#d97706"
  semantic-warning-strong: "#b45309"
  semantic-warning-fill: "#f59e0b"
  semantic-success: "#059669"
  semantic-success-strong: "#047857"
  semantic-success-fill: "#10b981"
  semantic-info: "#2563eb"
  semantic-info-fill: "#3b82f6"
  semantic-violet: "#7c3aed"
  semantic-violet-fill: "#8b5cf6"
  semantic-peer: "#4f46e5"
  semantic-neutral: "#52525b"
  chart-emerald: "oklch(0.68 0.17 150)"
  chart-sapphire: "oklch(0.58 0.19 250)"
  chart-amber: "oklch(0.74 0.17 75)"
  chart-violet: "oklch(0.65 0.20 300)"
  chart-crimson: "oklch(0.63 0.22 25)"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  heading:
    fontFamily: "Plus Jakarta Sans, Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  caption:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.375
    letterSpacing: "0"
rounded:
  sm: "0.51rem"
  md: "0.68rem"
  lg: "0.85rem"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-accent}"
    textColor: "{colors.text-on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  badge-default:
    backgroundColor: "{colors.primary-accent}"
    textColor: "{colors.text-on-accent}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  badge-warning:
    backgroundColor: "{colors.semantic-warning}"
    textColor: "{colors.semantic-warning-strong}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  badge-urgent:
    backgroundColor: "{colors.semantic-urgent}"
    textColor: "{colors.semantic-urgent}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  badge-success:
    backgroundColor: "{colors.semantic-success}"
    textColor: "{colors.semantic-success-strong}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "4px 10px"
  stat-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
    height: "auto"
  nav-item-active:
    backgroundColor: "{colors.accent-surface}"
    textColor: "{colors.primary-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    height: "36px"
  nav-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    height: "36px"
---

## Overview

QCET E-Office is the institutional operating system of Quy Nhơn College of Engineering and Technology (Bình Định, Việt Nam). Its users are not "shoppers" — they are Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Trưởng khoa, Chuyên viên, Giảng viên, and Văn thư, working against statutory deadlines, approval chains, and public-accountability obligations. The interface is therefore not a marketing surface and not a consumer product. It is an **executive cockpit**: an instrument panel that answers, at a glance, what is due, what is late, what needs signing, and who is accountable.

**The design thesis.** Authority without decoration. Every pixel either carries operational information or gets out of the way. Where a consumer app would add a gradient, an illustration, or an animation, this system adds a hairline border, a tabular figure, or nothing at all. The result reads as institutional dignity — calm, dense, legible under fluorescent office light on a 1366px laptop and under a construction-site sun on a phone.

**What makes the system distinct:**

1. **Light-only by construction.** Dark mode is not "unsupported" — it is *disabled at the variant level*. `globals.css` declares `@custom-variant dark (&:not(*));`, a selector that matches nothing, so a `dark:` class anywhere in the tree is inert. The `<html>` element carries a literal `light` class and `colorScheme: "light"` in the viewport. This is deliberate: government offices print, project, and screen-share in light environments, and a half-supported dark theme produces the worst outcome — inconsistent contrast indoors and unreadable reports on paper.
2. **Two voices, one system.** Desktop speaks in a dense cockpit (KPI strip, filter bars, cascading table, kanban, matrix). Mobile speaks in an attention-first feed. Both are the *same* components re-composed, never a separate mobile app.
3. **Semantic restraint under status pressure.** A system handling overdue, urgent, and flash documents is tempted to scream in red everywhere. QCET reserves saturation for genuine exception states and holds the institutional blue as the single accent.

**The Light-Only Rule.** The product renders in light mode exclusively; no component may introduce a `dark:` variant, a theme toggle, or a `prefers-color-scheme` branch.

**The Instrument-Panel Rule.** Every element on a surface must answer a governance question (What is due? Who owns it? Is it late?). If it answers none, it is removed.

**The Server-Truth Rule.** The database and the authenticated session are the only sources of operational fact. The UI may not fabricate a count, a date, a status, or a signature state to fill a gap.

---

## Colors

The palette is anchored in OKLCH so that lightness stays perceptually even across hues — critical when a rose "overdue" chip must read at the *same visual weight* as an amber "pending" chip on the same table row.

### Canvas & Surface

| Name | Value | Where | Why |
|---|---|---|---|
| Canvas | `oklch(0.985 0.003 250)` · `#FAFBFC` | `body` via `bg-background` | A whisper of blue-grey, not pure white. Cards can lift off it with a border alone, no shadow required. |
| Surface | `oklch(1 0 0)` · `#FFFFFF` | Card, popover, drawer, modal | The "paper" of the system. Pure white signals *content*, so any white region is understood as a document or panel. |
| Surface Muted | `oklch(0.965 0.005 250)` · `#F2F4F7` | Secondary buttons, toolbar wells, disabled fills, `bg-muted` | Recedes one step from the card without becoming a "colour". |
| Surface Sidebar | `oklch(0.985 0 0)` · `#FAFAFA` | Sidebar panel | Deliberately neutral (no blue chroma) so navigation reads as chrome, not content. |
| Overlay Scrim | `rgba(0,0,0,0.40)` | Modal/sheet backdrop (blur `sm`) | Dims but never hides the surface behind — the operator keeps context. |
| Accent Surface | `oklch(0.96 0.008 250)` · `#EFF2F7` | `hover:bg-accent`, sidebar hover | The universal hover wash. Barely perceptible; it says "you may click this" without a tooltip. |

### Text

| Name | Value | Where | Contrast on Canvas |
|---|---|---|---|
| Text Primary | `oklch(0.145 0.015 250)` · `#1A1D23` | Body, headings, table cells | **≈16:1** — AAA at every size |
| Text Secondary | `oklch(0.205 0.015 250)` · `#252830` | Card titles, text on secondary surfaces | **≈14:1** — AAA |
| Text Muted | `oklch(0.38 0.015 250)` · `#555C67` | Captions, helper text, placeholders, inactive nav | **≈7:1** — AA at all sizes, AAA at ≥14px bold |
| Text on Accent | `oklch(0.985 0 0)` · `#FAFAFA` | Text on primary fills | **≈6.5:1** on primacy blue — AA |

*(Contrast ratios computed from the OKLCH lightness values against the canvas token; treated as the design budget, re-verified with a checker in CI.)*

### Accent

| Name | Value | Where | Why |
|---|---|---|---|
| Primary Accent | `oklch(0.42 0.18 250)` · `#1D4EA8` (approx.) | Primary buttons, links, active nav, active tab, focus fills | Deep institutional blue. Dark enough to carry white text at AA, saturated enough to read as *the* action colour on a projector. |
| Focus Ring | `oklch(0.45 0.12 250)` · `#2C5089` (approx.) | `ring-ring`, `outline-ring/50` on `*` | A *slightly desaturated, slightly lighter* blue than primary. The ring must read as "keyboard focus", never as "this is the action" — so it is deliberately not identical to primary. |
| Secondary Accent | `oklch(0.965 0.005 250)` | Secondary surfaces/buttons | The neutral counterpart; no chroma competition with primary. |

**The One-Blue Rule.** There is exactly one action blue in the system. Every "click me to proceed" affordance uses `--primary`; no second brand hue, no per-module accent colour.

### Semantic

Semantics use the Tailwind 500/600/700 ladder because these states are *not* part of the brand palette — they are universal alert conventions that operators already read fluently.

| Name | Value | Where |
|---|---|---|
| Danger / Destructive | `oklch(0.577 0.245 27.325)` · `#EF4444` (approx.) | Delete actions, destructive buttons and rings |
| Flash | `#B91C1C` (red-700) on `red-500/15` | `HOA_TOC` — flash directive |
| Urgent | `#BE123C` (rose-700) on `rose-500/10` | `OVERDUE`, `THUONG_KHAN`, overdue stat card, `NEW` badge |
| Warning | `#D97706` (amber-600) on `amber-500/10` | `pending_assignment`, `NEEDS_REVIEW`, `WAITING_APPROVAL`, pending stat card |
| Success | `#059669` (emerald-600) on `emerald-500/10` | `COMPLETED`, `delegated`, progress fills at 100% |
| Info | `#2563EB` (blue-600) on `blue-500/10` | `IN_PROGRESS`, `processing` |
| Violet | `#7C3AED` (violet-600) on `violet-500/10` | Draft/misc task state |
| Neutral | `#52525B` (zinc-600) on `zinc-500/10` | `CANCELLED`, `NOT_STARTED`, `BLOCKED`, `completed` archive |

**The Tinted-Fill Rule.** Status chips are a **10–15% tinted fill** with a matching **20% border** and a **600/700 text** of the same hue — never a solid saturated block. A page of solid red badges is an alarm; a page of tinted chips is a *reading surface* that still escalates when one goes flash-red.

**The Semantic-Contrast Warning.** The audit found `text-amber-600` and `text-emerald-600` on tiny tinted fills, which fall below AA at 12px. The design intent is that status text uses the **600 level only where the label is ≥13px semibold**, and the **700 level (amber-700 `#B45309`, emerald-700 `#047857`, rose-700)** everywhere a chip is 12px. Treat the 600-level small chip as a defect to fix, not a pattern to copy.

**The Chart-Series Rule.** Data-series colour comes only from the five chart tokens (`chart-1..5`: emerald `oklch(0.68 0.17 150)`, sapphire `oklch(0.58 0.19 250)`, amber `oklch(0.74 0.17 75)`, violet `oklch(0.65 0.20 300)`, crimson `oklch(0.63 0.22 25)`). Charts never borrow the action blue or a status hue; mixing a categorical series with a semantic palette destroys both readings.

---

## Typography

### Why Be Vietnam Pro

Vietnamese is a diacritic-dense script: `ế ộ ữ ỡ ạ ả` stack marks above and below a single base glyph, and many Latin faces either clip those marks or collapse them into mush at 12–13px. **Be Vietnam Pro** was designed for exactly this problem — tall ascenders, generous vertical metrics, and a full `vietnamese` subset — so a task code like `NV-QCET-2026-0417` and a name like *Nguyễn Thị Hồng Vân* remain crisp in the same 13px row. It also carries the humanist, slightly formal register appropriate to a state institution: it is readable, not trendy.

**Plus Jakarta Sans** handles headings: geometric, confident, institutional, and — critically — also ships a `vietnamese` subset. **JetBrains Mono** handles everything numeric or identifier-like: task codes, `tabular-nums` figures, document hashes, dates.

**The Diacritic-Integrity Rule.** Both body and heading fonts MUST load the `vietnamese` subset. A font that renders `Nguyễn` with a dropped tilde is a bug, not a fallback.

### The Scale

| Role | Font | Size | Weight | Line height | Tracking |
|---|---|---|---|---|---|
| Display (KPI value, page hero) | Plus Jakarta Sans | `30px` (`text-3xl`) | 700 | 1.35 | −0.01em |
| Heading (h1–h6, card title) | Plus Jakarta Sans | `24px` / `16px` | 700 / 500 | 1.35 | −0.01em |
| Body | Be Vietnam Pro | `14px` (`text-sm`) | 400 | 1.5 | 0 |
| Label (nav, filter, table header) | Be Vietnam Pro | `13px` | 500–600 | 1.35 | 0 |
| Caption (helper, meta, badge) | Be Vietnam Pro | `12px` (`text-xs`) | 500–600 | 1.45 | 0 |
| Mono (figures, codes, dates) | JetBrains Mono | `13px` | 400/600 | 1.375 | 0 |
| Table compact | Be Vietnam Pro | `13px` (`0.8125rem`) | 400 | 1.125rem | 0 |

Headings use `text-wrap: balance`; paragraph and cell text use `text-wrap: pretty` — Vietnamese sentences wrap differently than English, and orphans in a two-line decree title look careless.

**The Tabular-Figure Rule.** Any number that is compared to another number — KPI values, counts, percentages, dates, task codes, pagination — MUST render in `font-mono tabular-nums`. Money, deadline, and progress figures align in a column or they are unreadable.

**The Two-Font Rule.** Plus Jakarta Sans is for headings only; Be Vietnam Pro is for all running text. Never set a body paragraph in the heading font, and never set a heading in the mono font.

**Mobile input floor.** At `max-width: 639px`, all `input`, `select`, and `textarea` elements are forced to `16px !important`. This is not a style choice — iOS Safari auto-zooms any focused field below 16px, which throws a Vietnamese IME user out of position mid-word.

**Print.** `@media print` resets body to `9pt`, `th` to `8.5pt`, `td` to `8pt`, line-height `1.2`, for A4 landscape issuance. Screen type is never relied on for paper output.

---

## Layout

### Container geometry

- **Content ceiling:** `max-w-[1440px] w-full mx-auto`, horizontal padding `px-3.5` (14px) on mobile → `sm:px-6` (24px). The ceiling exists because a 2560px ultrawide pushing a task table edge-to-edge makes the eye travel a metre per row.
- **4/8px grid:** every gap, pad, and margin resolves to a multiple of **4px**; component internals prefer **8px** steps. The system-level `spacing` tokens are `xs 4 / sm 8 / md 16 / lg 24 / xl 32`.
- **Vertical rhythm:** section stacks are `space-y-5 sm:space-y-6`; card internals `gap-3`/`gap-4`; dense chips `gap-1.5`.

### Shell

| Element | Mobile | Desktop |
|---|---|---|
| Sidebar | hidden (`hidden md:flex`) — replaced by bottom nav + drawer | `fixed left-0`, `w-[248px]` expanded / `w-16` collapsed, `bg-card/90 backdrop-blur-md`, `border-r` |
| Topbar | `h-[calc(52px+env(safe-area-inset-top))]`, sticky `top-0`, `bg-background/95` | same geometry, full width |
| Bottom nav | `h-14` (56px) + safe-area, `fixed`, `z-50`, 4 registry-driven items, hidden when virtual keyboard is open | hidden (`md:hidden`) |
| Main | `md:pl-[248px]` (or `md:pl-16`), owns `pb-[calc(56px+env(safe-area-inset-bottom)+12px)]` | `md:pb-8` |

**The Safe-Area Ownership Rule.** `AppShell` alone owns mobile bottom clearance. No child view may add its own `pb-20`/`pb-24`; the dozens of loading skeletons currently doing so are defects (double padding) to be removed.

### Responsive behaviour

| Breakpoint | Width | Behaviour |
|---|---|---|
| base (mobile) | < 640px | Attention-first feed; bottom nav; bottom-sheet filters; every control `min-h-[44px]`; 16px inputs |
| `sm` | ≥ 640px | Toolbar labels shorten; filter popovers replace bottom sheets; touch targets relax toward 36px |
| `md` | ≥ 768px | Sidebar appears (`md:pl-[248px]`); desktop table replaces mobile cards (`hidden md:block` / `md:hidden`); drawer-style side sheets |
| `lg` | ≥ 1024px | KPI strip goes 2×2 → 4-up (executive 5-up); cockpit 7/5 split; matrix 3-up |
| `2xl` | ≥ 1440px | Container caps; whitespace grows, line lengths do not |

**The Two-Voice Rule.** Desktop is a cockpit and mobile is a feed, but they are composed from the same primitives. A new feature that ships only a desktop layout, or that forks a "mobile version" of a component, is rejected.

**The Scope-Is-Not-Role Rule.** The scope switcher lives in the topbar and filters the *dataset* (`school` / `unit` / `personal`). It changes what data is shown, never what the user is authorised to do. Its trigger intentionally shows no colour shift between scopes — only the label changes — because scope is a lens, not a mode.

---

## Elevation & Depth

QCET is a **flat-surface system**. Depth is communicated by **borders and background layering first**, shadows second. A white card on the off-white canvas needs no shadow to be perceived as a card; the soft shadow that remains is a whisper, not a lift.

### Shadow ladder

| Token | Value | Used by |
|---|---|---|
| xs | `0 1px 2px 0 rgba(0,0,0,0.04)` | Buttons, chips, small tiles |
| subtle | `0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 3px 1px rgba(0,0,0,0.02)` | KPI strip, widget shells |
| card | `0 1px 3px 0 rgba(0,0,0,0.04), 0 4px 12px 0 rgba(0,0,0,0.03)` | Standard cards, premium buttons |
| card-hover | `0 4px 16px -2px rgba(0,0,0,0.06), 0 2px 6px -1px rgba(0,0,0,0.03)` | Hover lift on interactive cards |
| dropdown | `0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 24px -3px rgba(0,0,0,0.06)` | Popovers, menus, sheets |
| glow-primary | `0 0 20px -3px rgba(37,99,235,0.20)` | Reserved focus emphasis on primary |

**The Hairline Rule.** Surfaces are separated by a **1px border** (`border-border`, often at 30–60% alpha) rather than a shadow. Cards use `border-border/30`; toolbars `border-border/60`; table rows `divide-y divide-border/60`. Shadows never substitute for a missing border.

**The Elevation-Ladder Rule.** z-index is a fixed stack, never ad-hoc:

| Layer | z |
|---|---|
| Table sticky header | 10 |
| Sticky modal/toolbar header | 10–20 |
| Overflow menu scrim | 30 |
| Topbar | 30 |
| Desktop sidebar | 40 |
| Overflow menu / row action menu | 40 |
| Bottom nav, scope popover, profile menu, modals, sheets, toasts | 50 |

*(A known defect: the topbar sits at z-30 while the sidebar is z-40, leaving a gap a stray z-40 overlay could wrongly occupy. New overlays must claim z-50, never z-40.)*

---

## Shapes

Radius is derived from one unit, `--radius: 0.85rem`, so the whole system rounds in sympathy.

| Token | Value | Applied to |
|---|---|---|
| sm | `0.51rem` (`calc(var(--radius) * 0.6)`) | Badges, chips, tight controls |
| md | `0.68rem` (`calc(var(--radius) * 0.8)`) | Badges, xs icon buttons |
| lg | `0.85rem` (base) | **Buttons, inputs, nav items, list rows, KPI panel inner** |
| xl | `1rem` | **Cards, widgets, panels** |
| 2xl | `1rem` | Banners, workbench surfaces, sheet panels |
| 3xl | `1.87rem` (`×2.2`) | Pill containers, large media |
| full | `9999px` | Status/priority pills, avatars, dots, progress bars |

**The Radius Ladder Rule.** Radius encodes containment hierarchy: **inputs and buttons are `lg`**, **cards are `xl`**, **floating surfaces (sheets, banners) are `2xl`**, **pills and dots are `full`**. A card with `rounded-lg` corners, or a button with `rounded-full` corners, breaks the visual grammar and is a defect.

**Form field shape.** Inputs are `rounded-lg` (`rounded-xl` in modals), `h-10` desktop / `h-11` mobile, `border border-input`, `bg-card`. On focus: `ring-2 ring-ring` plus `border-ring`. Never square, never pill.

**Badge shape.** Badges are `rounded-md` (a rectangle with soft corners); *status pills* (priority, filter chips, count badges) are `rounded-full`. The distinction is load-bearing: rounded-full means "a live, togglable status"; rounded-md means "a static attribute".

---

## Components

### 1. Stat card (KPI metric card)

The `ExecutiveStatStrip` is the top-of-view KPI band; each tile both reports a number and toggles a filter.

| Property | Default mode | Executive mode |
|---|---|---|
| Grid | `grid-cols-2 lg:grid-cols-4` | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5` |
| Shell | `divide-x divide-border rounded-xl border border-border bg-card shadow-subtle overflow-hidden` | same |
| Tile padding | `p-4 sm:p-5` | same |
| Value type | `font-heading tabular-nums text-2xl sm:text-3xl font-bold tracking-tight` | same |
| Title | `text-xs sm:text-sm font-semibold text-foreground/90 tracking-tight truncate` | same |
| Subtext | `text-xs sm:text-[13px] font-medium text-muted-foreground` | same |
| Icon | Lucide, `size-4`, `strokeWidth={1.5}`, `text-muted-foreground` | same |

**States.** Idle (white) → hover (`hover:bg-muted/30`) → active-filter (`ring-2 ring-primary ring-inset bg-primary/[0.04] shadow-xs`) → overdue-filter (`ring-2 ring-rose-500 ring-inset bg-rose-500/[0.04]`). Rendered as a `<button>` with `aria-pressed` and a computed `aria-label`. Disabled tiles use `disabled:cursor-default`.

**Icon rules.** One icon per tile, `size-4`, stroke `1.5`, muted by default, never coloured unless it *is* the status (an overdue tile may tint rose). The icon carries the category; the value carries the fact. Every tile pairs its number with a small coloured **badge** (`bg-rose-500/10 text-rose-700 border border-rose-500/20`) — the badge is the state, the big number is the count.

**Audit.** Render four executive tiles and assert each is a `<button>` with a non-empty `aria-label` of the form `Lọc theo {title}: {value} {subtext}`, and that activating one applies `aria-pressed="true"` plus the inset ring on exactly that tile.

### 2. Action-filter card (lens / action queue card)

Used by `ExecutiveActionCenter` and its queue lenses.

| State | Visual difference |
|---|---|
| Idle | `border-border/60 bg-card hover:bg-muted/15` |
| Selected | `border-indigo-500 ring-2 ring-indigo-500/20` (rose/emerald per lens), accent retained |
| Hover (idle) | `hover:-translate-y-0.5 hover:shadow-xs` — the only sanctioned micro-lift |
| Focus | `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1` |

Lens chips: `inline-flex items-center gap-1.5 rounded-lg border px-2.5 min-h-[44px] sm:min-h-[36px] text-xs font-medium`; active `border-primary/40 bg-primary/10 text-primary`, idle `border-border/60 text-muted-foreground hover:bg-muted/40`. Cards carry `role="group" + aria-labelledby`; the queue uses `aria-live="polite"`. The selected state is a **ring + accent border**, never a filled saturated block, so the card still reads as a card.

**Audit.** Assert the selected card has both a border colour change *and* a 2px ring, and that unselected siblings have neither; assert `aria-pressed` on each lens chip.

### 3. Status badge — full mapping

Base: `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold font-mono tabular-nums leading-none shrink-0`.

**Task status** (`task-row.tsx`):

| Status | Vietnamese label | bg | text | border |
|---|---|---|---|---|
| `NEW` | Mới | `bg-rose-500/10` | `text-rose-700` | `border-rose-500/20` |
| `IN_PROGRESS` | Đang thực hiện | `bg-blue-500/10` | `text-blue-700` | `border-blue-500/20` |
| `NEEDS_REVIEW` | Cần chỉnh sửa | `bg-amber-500/10` | `text-amber-700` | `border-amber-500/20` |
| `WAITING_APPROVAL` | Chờ phê duyệt | `bg-amber-500/10` | `text-amber-700` | `border-amber-500/20` |
| `PENDING_EXECUTIVE_APPROVAL` | Chờ BGH duyệt | `bg-purple-500/10` | `text-purple-700` | `border-purple-500/20` |
| `COMPLETED` | Hoàn thành | `bg-emerald-500/10` | `text-emerald-700` | `border-emerald-500/20` |
| `OVERDUE` | Quá hạn | `bg-rose-500/10` | `text-rose-700` | `border-rose-500/20` |
| `CANCELLED` / `NOT_STARTED` / `BLOCKED` | Đã hủy / Chưa bắt đầu / Tạm dừng | `bg-zinc-100` | `text-zinc-600` | `border-zinc-300` |

**Known collisions to resolve (defects, not canon):** `NEW` and `OVERDUE` share identical rose classes, so a not-yet-started task is indistinguishable from a breached one; and `NEEDS_REVIEW` / `WAITING_APPROVAL` share amber. `BLOCKED` renders zinc although `STATUS_BADGE_CONFIGS` elsewhere maps it amber — a dual source of truth. The canonical fix is a **single status→token map** exported from one module and consumed everywhere; `NEW` should move to neutral/info, `OVERDUE` keeps rose, and `BLOCKED` becomes amber.

**Document status** (`document-detail-dialog.tsx`), base `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border`:

| Status | Icon | Colours |
|---|---|---|
| `pending_assignment` (CHO_PHAN_CONG) | Clock | `bg-amber-500/10 text-amber-700 border-amber-500/20` |
| `processing` (DANG_XU_LY) | Clock | `bg-blue-500/10 text-blue-700 border-blue-500/20` |
| `delegated` (synthetic: processing + linkedTask) | CheckCircle2 | `bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-medium` |
| `approved` (CHO_PHE_DUYET) | ShieldCheck | `bg-indigo-500/10 text-indigo-700 border-indigo-500/20` |
| `completed` (DA_HOAN_THANH + LUU_THEO_DOI) | CheckCircle2 | `bg-zinc-500/10 text-zinc-700 border-zinc-500/20` |

*(Defect: `LUU_THEO_DOI` — monitoring archive — is collapsed into `completed` and is invisible in the UI, losing a distinct operational state.)*

**Audit.** `grep` the `StatusBadge`/`getStatusBadgeConfig` source; assert every enum value in the schema has exactly one entry, that no two *semantically distinct* values share identical colour triplets, and that the badge is rendered by a single component — not hand-rolled per file.

### 4. Urgency badge — full mapping

Base: `inline-flex items-center px-2 py-0.5 rounded-md text-xs border`.

| Level | Vietnamese | Colours | Notes |
|---|---|---|---|
| `HOA_TOC` (flash) | Hỏa tốc | `bg-red-500/15 text-red-700 border-red-500/30 font-bold animate-pulse` | The **only** pulsing element sanctioned — and it must be wrapped in a `prefers-reduced-motion` guard (currently missing). |
| `THUONG_KHAN` (top urgent) | Thượng khẩn | `bg-rose-500/15 text-rose-700 border-rose-500/30 font-semibold` | |
| `KHAN` (urgent) | Khẩn | `bg-amber-500/15 text-amber-700 border-amber-500/30 font-medium` | |
| `THUONG` (normal) | Thường | `bg-muted text-muted-foreground border-border/60` | The **only** urgency level built on semantic tokens. |

**The Escalation-Only-Motion Rule.** Motion is a scarce signal. A badge may pulse only when its state is *Hỏa tốc*, i.e. when ignoring it causes a legal breach — and only when `prefers-reduced-motion` is not set.

**Audit.** Assert `animate-pulse` appears on exactly one urgency variant, inside a `@media (prefers-reduced-motion: no-preference)` block.

### 5. Button

Base (all variants): `inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none cursor-pointer`, `[&_svg]:size-4`, `focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50`, `active:scale-[0.98]`, `disabled:pointer-events-none disabled:opacity-50`.

| Variant | Colours | Use |
|---|---|---|
| `default` (primary) | `border-primary bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs` | The single primary CTA per view |
| `secondary` | `border-border bg-secondary text-secondary-foreground hover:bg-secondary/80` | Neutral partner actions |
| `outline` | `border-border bg-card text-foreground hover:bg-muted` | Tertiary, on busy surfaces |
| `ghost` | `border-transparent text-foreground/80 hover:bg-muted hover:text-foreground` | Icon-adjacent, inline row actions |
| `destructive` | `border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20` | Delete/revoke; focus ring turns destructive |
| `link` | `text-primary underline-offset-4 hover:underline` | Inline navigation only |
| `premium` | `bg-gradient-to-r from-primary to-primary/90 shadow-card` | Reserved highlight CTA |

**Sizes.** `xs` `h-7 px-2.5 text-xs` · `sm` `h-8.5 px-3 text-xs font-semibold` · `default` `h-10 px-4 text-sm` · `lg` `h-11 px-6 text-base font-semibold` · `icon` `size-10` · `icon-sm` `size-8.5` · `icon-lg` `size-11` (the 44px touch floor).

**Audit.** Assert no button in a mobile viewport renders below 44px effective height (`h-9` CTAs and `px-2.5 py-1` density toggles are current offenders), and that `active:scale-[0.98]` is present on every interactive size.

### 6. Navigation item

| State | Classes |
|---|---|
| Base (all) | `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-h-9 text-[13px] transition-colors select-none` |
| Inactive | `text-muted-foreground hover:text-foreground hover:bg-accent/40` |
| Active | `bg-primary/10 text-primary` — icon `strokeWidth` bumps 1.5 → 2 |
| Collapsed rail | `size-9 rounded-lg flex items-center justify-center` |
| Mobile bottom nav item | `flex flex-col items-center justify-center min-h-[48px] min-w-[48px] touch-manipulation active:scale-95` |

**The Active-Icon-Weight Rule.** The active navigation item is signalled by **three** simultaneous cues — tinted background, primary text colour, and a heavier icon stroke — never colour alone. This survives greyscale printing and colour-blind viewing.

**Audit.** Assert active and inactive items differ in background, text colour, *and* icon stroke weight; assert every mobile nav item meets 48×48.

### 7. Queue list

Canonical pattern from `ExecutiveAttentionQueue` / `ExecutiveActionCenter` / `ActivityFeedWidget`.

- **Shell:** `rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex flex-col`.
- **Header:** `flex items-center justify-between gap-3 pb-3 border-b border-border/50`, with an icon tile (`h-7 w-7 rounded-lg bg-amber-500/10 text-amber-700`) and a count pill (`rounded-full bg-amber-100 text-amber-800 tabular-nums`).
- **Scroll container:** `overflow-y-auto max-h-[360px] pr-1` — the list scrolls *inside* its card, never the page.
- **Initial cap:** feeds show a bounded top-N (`ActivityFeedWidget` renders the top-5 most recent events) with an explicit **expand/collapse** footer toggle (`aria-expanded`) — "Xem thêm" / "Thu gọn". The cap protects the first screen from becoming a log.
- **Row:** `py-2.5 px-2 hover:bg-muted/40 rounded-xl flex items-center justify-between gap-3`; interactive rows use `role="button" + tabIndex + onKeyDown(Enter/Space)`.
- **Empty:** an explicit empty row, never a blank card.

**The Scroll-Container Rule.** A long queue scrolls within its own bounded box (`max-h-…`); the page body scrolls for navigation between surfaces. Nested page-level scroll on a cockpit is forbidden.

**Audit.** Assert the queue root has `max-height` + `overflow-y-auto`, and that the expand control maps to `aria-expanded` reflecting real state.

### 8. Empty state — the "Verified Clear Horizon" pattern

An empty surface must be *earned*: it renders only when the server has confirmed there is genuinely nothing in scope. It never appears while loading (that is a skeleton) and never fakes a zero.

Three sanctioned renderings, in order of preference:

1. **Positive clear (best).** `rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center` with a `size-14 rounded-full bg-emerald-500/10 text-emerald-600` icon tile and copy such as *"Không còn việc tồn đọng"*. Used by `WorkbenchMobileFeed` and `StaffFocusView`.
2. **Icon-tile neutral.** `flex items-center gap-3.5 ... min-h-[64px]` with a `size-9 rounded-lg bg-muted/50 border border-border/60` tile and a one-line explanation. Used by `ExecutiveActionCenter`, `PersonalWorkbench`.
3. **Dashed dormant.** `rounded-xl border border-dashed border-border/80 bg-muted/10 p-8 text-center`. Used for "no filter results" and unassigned slots.

Copy is a full Vietnamese sentence about *state*, never a bare "No data". The `NO_DATA` state of `DashboardSituationStrip` renders a muted sentence and **never** substitutes zeroes for unknown counts.

**The Verified-Clear Rule.** An empty state may assert "nothing is due" only when the underlying query returned an authoritative empty set. A failed fetch renders an error (`role="alert"`), and a slow fetch renders a skeleton — never an empty state that could be mistaken for "all clear".

**Audit.** Assert every empty state carries a `data-slot="*empty*"` marker and distinct copy; assert no empty state renders the literal string `0` or a placeholder date.

### 9. Document row

Registry list/card rendering (`document-registry-view.tsx`), desktop row / mobile card parity.

| Column | Content | Token |
|---|---|---|
| Type | Icon tile `p-2.5 rounded-xl border border-border/40` + label (Văn bản đến / đi / Tờ trình) | `text-sky-600 bg-sky-500/10` / `text-emerald-600` / `text-purple-600` |
| Title | Document title, `text-sm font-medium text-foreground truncate` | — |
| Urgency | Urgency badge (position: immediately before status) | see §4 |
| Status | Status badge | see §3 |
| Lead unit | `doc.leadDepartment` | `text-muted-foreground` |
| Due date | `font-mono tabular-nums`; absolute date in `sr-only` + `title`, relative distance in an amber/rose pill | status hue |
| Attachment | First attachment only, `p-3 rounded-xl border border-border/60 bg-muted/20`, file name `truncate`, meta `font-mono` | — |

**Status-indicator position.** The status badge is **right-aligned and always in the same column** across every row — position is as important as colour, because operators scan a vertical strip, not a horizontal one.

*(Defect: attachment meta hardcodes "Đã ký số cơ quan" regardless of the real signature record; the approval-flow directive section renders synthetic instruction text instead of `DocumentDirectiveItem` records; and the "Tải về" action calls `alert()`. All three violate Server-Truth and must be removed or wired to real data.)*

**Audit.** Assert the status badge occupies the same DOM column index in every row, and that no attachment row claims a signature state without a backing hash/record.

---

## Do's and Don'ts

### Icons

- ✓ Use **Lucide** exclusively, at `strokeWidth={1.5}`, via class tokens (`size-4`, `size-3.5`) rather than numeric props.
- ✓ Reserve `size-2.5`/`size-3` for *decorative* micro-badges only, never for a control a user must hit.
- ✗ Do not mix `strokeWidth={2}` into a toolbar while every other icon is `1.5` (current defect in `WorkspaceToolbar`).
- ✗ Do not use emoji as iconography anywhere — institutional surfaces use vector icons or words.

### Colour

- ✓ Route surfaces and text through semantic tokens (`bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`, `text-primary`).
- ✓ Express status through the shared status→token map, so `OVERDUE` and `NEW` cannot silently share one hue.
- ✗ Do not hardcode `bg-white`, `bg-slate-50`, `text-slate-900`, `bg-indigo-600`, `text-white`, or `bg-black/40` where a token exists — `WorkspaceToolbar`, `DirectiveActionPanel`, and the modals currently do.
- ✗ Do not use `text-amber-600`/`text-emerald-600` on a 12px tinted chip — it fails AA; use the 700 level instead.
- ✗ Do not introduce a second action colour. There is one blue.

### Scope & role

- ✓ Treat scope (`school` / `unit` / `personal`) purely as a dataset filter.
- ✓ Keep role checks server-side and authoritative.
- ✗ Do not use `TaskScope` to grant, widen, or restrict any write, approval, or workflow permission.
- ✗ Do not add `UserRole` enum values, client-side role switch statements, `forcedRole` selectors, or viewpoint facades — all frozen under the domain rules.
- ✗ Do not map statutory titles (Hiệu trưởng, Trưởng phòng, Trưởng khoa…) to a generic `ADMIN | MANAGER | STAFF` triad in UI copy or branches.
- ✗ Do not bind any permission to a DACUM duty code.

### Dark mode

- ✓ Build every colour decision for the light surface only; `@custom-variant dark (&:not(*))` already disables the variant.
- ✗ Do not add `dark:` classes, `prefers-color-scheme` branches, theme toggles, or dark tokens. There is no dark theme and there will not be one.
- ✗ Do not simulate depth for a "dark" aesthetic with heavy black scrims outside of modal backdrops.

### Data integrity

- ✓ Show an explicit empty ("Verified Clear Horizon") or error state when there is no data.
- ✓ Source every number from a real query; verify the denominator before rendering a percentage.
- ✗ Do not fabricate records, counts, metrics, fallback IDs, task codes (`"NV-QCET"`), initials (`"QC"`), or dates (`"Thứ Tư, ngày 09/09/2026"`).
- ✗ Do not render a static "Notion: Đang kết nối" pill, a hardcoded decree citation, or a "Đã ký số cơ quan" claim that no record backs.
- ✗ Do not ship `alert()` as an action handler ("Tải về"); wire the real download or remove the control.

### Motion

- ✓ Confine motion to press feedback (`active:scale-[0.98]`/`active:scale-95`), hover lifts (`-translate-y-0.5`), and progress transitions (`duration-300`–`500 ease-out`).
- ✓ Guard any looped animation behind `prefers-reduced-motion: no-preference`.
- ✗ Do not pulse or bounce a status chip except `HOA_TOC`, and never without the reduced-motion guard.
- ✗ Do not animate entry of table rows or KPI values — the cockpit must feel instantaneous.

### Layout & mobile

- ✓ Let `AppShell` own mobile bottom clearance; add no ad-hoc `pb-20`/`pb-24` in child views or skeletons.
- ✓ Enforce `min-h-[44px] min-w-[44px]` on every mobile control, relaxing only at `sm:`.
- ✓ Force 16px on mobile form inputs to protect Vietnamese IME entry from iOS auto-zoom.
- ✗ Do not ship a below-44px mobile control (current offenders: `h-9` table toolbar CTA, `px-2.5 py-1` density toggle, `min-h-[32px]` saved-view controls).
- ✗ Do not add a dark horizontal scrollbar to the page body; only tables, diagrams, and code scroll horizontally, inside their own container.

### Type & content

- ✓ Set `font-mono tabular-nums` on every compared figure, code, and date.
- ✓ Keep Vietnamese copy in full sentences about state; the register is administrative, not chatty.
- ✗ Do not use `text-[9px]`/`text-[10px]`/`text-[11px]`, arbitrary `h-4.5`/`py-0.2`/`w-88` spacing, or `text-2xs` — they escape the 4/8px grid and the type scale.
- ✗ Do not set body text in the heading font or a heading in the mono font.

### Enforced by the linter

These are not conventions. `scripts/lint.mjs` checks them on every `npm run lint` and `npm run verify`, and the build fails on any **new** violation:

| Rule id | What it blocks |
|---|---|
| `no-dark-variant` | `dark:` variant classes (Light-Only is structural) |
| `no-emoji` | Emoji pictographs in interface source |
| `icon-stroke-width` | Any Lucide `strokeWidth` other than `1.5` |
| `no-uppercase-heading` | `uppercase` combined with `tracking-wide`/`-wider`/`-widest` |
| `no-icon-box` | Icons wrapped in a rounded muted box |
| `no-raw-neutral-palette` | `slate` / `gray` / `zinc` / `neutral` / `stone` color utilities |
| `no-arbitrary-color-value` | `[#hex]`, `[rgb()]`, `[hsl()]` arbitrary color values |
| `no-card-accent-bar` | `h-[2px]` / `h-[3px]` / `border-t-4` accent bars |
| `focus-ring-width` | `focus-visible:ring-1` where `ring-2` is required |

Existing violations are recorded in `scripts/design-lint-baseline.json` — that file is **accepted debt, not a checklist**. Shrink it as you fix; never add to it. Regenerate it only as a deliberate act, with `node scripts/lint.mjs --update-baseline`.

**Final audit for any PR.** `npm run verify` passes; every new interactive element passes a 44px mobile check; every new number is backed by a real query; and no role/scope logic has widened. If any check fails, the change does not merge.