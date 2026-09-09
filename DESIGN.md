# Design System: QCET E-Office Executive Cockpit

## 1. Visual Theme & Atmosphere
An authoritative, restrained, and high-density executive command center engineered for higher education administration (QCET - Quy Nhơn College of Engineering and Technology). The visual atmosphere exudes administrative dignity and institutional trust — strictly light-only, balanced in hierarchy, and free from superficial AI decoration or consumer SaaS gamification.
- **Density:** 8/10 (Cockpit Dense) — Maximum signal-to-noise ratio, tight spatial economics, and immediate executive decision clarity.
- **Variance:** 5/10 (Balanced Administrative Hierarchy) — Macro KPIs on top, tactical queue in the center, granular cascading tables underneath.
- **Motion:** 3/10 (Subtle & Restrained) — Quiet, purposeful micro-transitions (150ms–200ms) with zero distracting theatrics.

## 2. Color Palette & Roles
Strictly calibrated Light-Only palette conforming to OKLCH color space and WCAG 2.2 AA standards (contrast >= 4.5:1).
- **Canvas White** (`#F8FAFC`, `slate-50`) — Primary background ground
- **Pure Surface** (`#FFFFFF`, `white`) — Card, stat container, and table row fills
- **Charcoal Ink** (`#0F172A`, `slate-900`) — Primary text, KPI values, and headings
- **Muted Steel** (`#64748B`, `slate-500`) — Secondary text, department metadata, and subtitles
- **Subtle Border** (`#E2E8F0` / `rgba(226,232,240,0.8)`) — Structural 1px cards and dividers
- **Administrative Navy** (`#0284C7`, `sky-600`) — Singular primary accent for active scopes, main CTAs, and focus indicators
- **Semantic Warning** (`#D97706`, `amber-600`) — Review queues and pending appraisals (`bg-amber-500/10 text-amber-700`)
- **Semantic Urgent** (`#E11D48`, `rose-600`) — Bottlenecks, overdue deadlines, and escalation items (`bg-rose-500/10 text-rose-700`)
- **Semantic Success** (`#059669`, `emerald-600`) — Accomplished missions and smooth operation metrics (`bg-emerald-500/10 text-emerald-700`)

*(Saturation strictly below 80%. Neon blues/purples, glows, and dark mode variants are completely BANNED).*

## 3. Typography Rules
- **Display / Heading:** `Be Vietnam Pro` (`font-heading`) — Bold/semibold, normal tracking (`tracking-normal` or max `-0.01em` on large titles). Explicitly preserves complex Vietnamese tone diacritics (`ể`, `ễ`, `ệ`, `ở`, `ỡ`, `ợ`, `ứ`, `ừ`).
- **Body & Controls:** `Be Vietnam Pro` (`font-sans`) — Regular/medium, line-height 1.5–1.6, clean legibility at 12px–14px.
- **KPI Metrics:** `font-heading tabular-nums text-2xl sm:text-3xl font-bold` — Fixed-width digits preventing layout twitch during data updates.
- **Banned:** `Inter` font, generic serif fonts (`Times New Roman`, `Georgia`), and `font-mono` on standard Vietnamese badge labels.

## 4. Component Stylings
- **Buttons:** Tactile, clean borders, minimum 44px touch targets on mobile/tablet (`min-h-[44px] sm:min-h-[36px]`). Flat surfaces with subtle 1px border or solid administrative primary fill. No neon gradients or heavy drop shadows.
- **Metric Cards (`ExecutiveStatStrip`):** Semantic `<button type="button">` wrappers with explicit `aria-pressed` and `aria-label`. Icons rendered bare with `size-4 text-muted-foreground strokeWidth={1.5}` (no gray square enclosure boxes). Zero colored top accent stripes.
- **Action Filters (`ExecutiveActionCenter`):** Clean, full-width responsive trigger cards. Visual selection confirmed via subtle tinted background (`bg-primary/[0.04]`) and subtle border ring (`ring-2 ring-primary/20`), never thick colored bars.
- **Queue Lists:** Initial display capped at `INITIAL_LIMIT = 5` items. Scroll container capped at `max-h-[460px] overflow-y-auto pr-1` with expand/collapse toggle for long queues.
- **Empty States:** "Verified Clear Horizon" pattern featuring `ShieldCheck` icon, institutional subtext, and zero childish cartoon illustrations or emojis.

## 5. Layout Principles
- **Container Architecture:** Max-width contained workspace (`max-w-7xl` or responsive fluid cockpit).
- **Spatial Rhythm:** Strict 4px/8px grid cadence (`space-y-5 sm:space-y-6`). Eliminates arbitrary floating decimal paddings (e.g., no `py-0.2`).
- **Responsive Collapse:**
  - Desktop (>= 1024px): 4-column connected KPI strip, 3-column action filters.
  - Tablet (640px–1023px): 2-column KPI grid, stacked filters.
  - Mobile (< 640px): 1-column vertically connected flow with horizontal touch scrollbars where appropriate.

## 6. Motion & Interaction
- **Transition Duration:** Strict 150ms–200ms `ease-out` on interactive states.
- **State Feedback:** Subtle translate (`hover:-translate-y-0.5`) and focus-visible rings (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset`).
- **Hardware Accelerated:** Animations restricted to `transform` and `opacity`. Heavy canvas background effects, confetti, and unconstrained loop pulses are banned.

## 7. Anti-Patterns (Banned)
- NO emojis anywhere in the user interface (use standardized Lucide icons with strokeWidth 1.5).
- NO colored top accent lines or bars on cards (`h-[2px]`, `h-[3px]`, `border-t-4`).
- NO gray square box wrappers behind Lucide icons (`size-7 rounded-md bg-muted/60`).
- NO Dark Mode classes (`dark:`) or theme switching logic.
- NO uppercase shouting on long Vietnamese headings (`uppercase tracking-wider`).
- NO infinite queue overflow that bloats page scroll length.
- NO neon glows, saturated gradients, or consumer game-like confetti.
- NO hardcoded mock data in production components.
