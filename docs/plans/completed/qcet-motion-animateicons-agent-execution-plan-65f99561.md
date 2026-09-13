# QCET Work — Motion + AnimateIcons Execution Plan for Coding Agent

**Status:** Completed
**Completed Date:** 2026-09-13
**Repository snapshot audited:** `main` @ `65f99561`  
**Primary goal:** Introduce a restrained, canonical motion system that improves state continuity and feedback without turning QCET into an animation-heavy interface.  
**Secondary goal:** Pilot a very small set of semantic animated icons without replacing the existing Lucide visual language.

---

## 0. Execution directive for the agent

Execute this plan against the **current source**, not against assumptions in this document.

Before editing:

1. Read repository instructions:
   - `AGENTS.md`
   - `ARCHITECTURE.md`
   - relevant files under `docs/product/`
   - relevant files under `docs/architecture/`
   - active plans under `docs/plans/active/`, if any.
2. Inspect every target file before modifying it.
3. Compare this plan with current implementation and skip any step already correctly implemented.
4. Preserve unrelated user work.
5. Do not rewrite the application or introduce a second UI/motion system.
6. Do not weaken tests, accessibility, or security to make the patch pass.
7. Do not stop after summarizing the plan. Implement it.
8. Run real verification commands before claiming success.
9. Keep changes scoped to motion, presence, micro-interactions, and the small icon pilot described here.
10. If current source has moved since the audited snapshot, adapt to the current canonical implementation rather than recreating an old structure.

### Canonical repository invariants that apply

The repository already defines:

- **One Capability, One Canonical Implementation**
- **Preserve Unrelated Changes**
- **Never Claim Verification That Was Not Run**
- **Git Safety**
- **Light-only administrative UI**
- **Lucide iconography with restrained 1.5px strokes**
- **Vaul as the mobile bottom-sheet primitive**

This plan must respect all of them.

---

# 1. Decision summary

## Add

```bash
npm install motion
```

Use:

```ts
import { ... } from "motion/react"
```

For lightweight animated elements under `LazyMotion`:

```ts
import * as m from "motion/react-m"
```

## Do not add

```bash
npm install framer-motion
```

Do not introduce Motion+.

Do not install `@animateicons/react` across the app during the first rollout.

## AnimateIcons strategy

If the pilot is reached and still justified, copy only selected icons into the repository using the official CLI:

```bash
npx animateicons add <icon-name> --dir src/components/icons
```

The CLI copies source-owned components and matches the project's existing `@/lib/utils` convention.

---

# 2. Why this is needed in the current source

The source already contains a large amount of motion-like behavior implemented through CSS/Tailwind:

- approximately **78 `animate-in` usages**
- approximately **115 `active:scale*` usages**
- many `transition-all`, `duration-*`, `fade-in`, `zoom-in`, `slide-in-*`
- several overlays that mount/unmount immediately
- custom manual animation orchestration in the shared Drawer
- existing `tw-animate-css`
- existing Vaul mobile sheets
- existing reduced-motion CSS

Therefore this task is **not** “add animations”.

It is:

> **Consolidate stateful animation, presence, and layout continuity into one restrained motion system while keeping simple visual transitions in CSS.**

---

# 3. Verified external guidance

This plan was cross-checked against current official documentation.

## Motion installation and Next.js support

Motion supports React 18.2+ and Next.js App Router.

```bash
npm install motion
```

Source: https://motion.dev/docs/react-installation

## CSS versus Motion

Use ordinary CSS transitions for simple, self-contained effects such as hover color. Use Motion for React-state-driven presence, layout, sequencing, and complex interaction.

Source: https://motion.dev/docs/react

## AnimatePresence

`AnimatePresence` allows removed children to remain long enough to run exit animation.

Source: https://motion.dev/docs/react-animate-presence

## Reduced motion

`MotionConfig reducedMotion="user"` respects the user's OS preference.

Sources:
- https://motion.dev/docs/react-motion-config
- https://motion.dev/docs/react-accessibility

## Bundle strategy

Official Motion guidance states:

- full `motion` component API is much heavier than the minimal `m` layer
- `m` + `LazyMotion` can reduce initial Motion component cost substantially
- `domAnimation` supports standard animation, variants, exit, hover/tap/focus
- **`domMax` is required for layout animation and drag/pan**

Because this plan uses `layout` / `layoutId`, use **`domMax`**, ideally lazy-loaded.

Sources:
- https://motion.dev/docs/react-reduce-bundle-size
- https://motion.dev/docs/react-lazy-motion

## Animation performance

Favor compositor-friendly motion (`transform`, `opacity`). Motion layout animation internally uses transforms.

Sources:
- https://web.dev/articles/animations-overview
- https://motion.dev/docs/react-layout-animations

## Next.js package optimization

Current Next.js docs already list `lucide-react` among libraries optimized by default. Keep the project's existing config, but do not add Motion to `optimizePackageImports` without measured evidence.

Sources:
- https://nextjs.org/docs/pages/api-reference/config/next-config-js/optimizePackageImports
- https://nextjs.org/docs/pages/guides/package-bundling

## AnimateIcons CLI

AnimateIcons provides a first-party CLI to copy selected icons directly into a project.

Source: https://animateicons.in/icons/docs/cli

---

# 4. Current source findings

## Package baseline

Current `package.json` contains:

```text
Next.js
React 19
Tailwind CSS v4
lucide-react
tw-animate-css
vaul
```

Motion is not installed.

## Next config

Current:

```ts
experimental: {
  optimizePackageImports: ["lucide-react", "qrcode", "vaul"],
}
```

Do not modify this merely because Motion is being introduced.

## Existing reduced-motion behavior

`src/app/globals.css` already includes a `prefers-reduced-motion: reduce` reset. Keep it.

The final stack should be:

```text
CSS reduced-motion
+
MotionConfig reducedMotion="user"
```

## Shared Drawer

`src/components/ui/drawer.tsx` currently uses:

```ts
const [visible, setVisible] = React.useState(false)
```

plus nested `requestAnimationFrame` calls and manual opacity/translate classes.

This is the first canonical migration candidate.

## Enter-only overlays

High-value targets:

```text
src/components/layout/command-search-modal.tsx
src/components/dashboard/task-detail-side-sheet.tsx
src/components/dashboard/create-task-modal.tsx
src/components/notifications/notification-popover.tsx
src/components/calendar/calendar-day-sheet.tsx
src/components/tasks/mobile-task-filter-sheet.tsx
src/components/ui/feedback-layer.tsx
```

---

# 5. Final architecture

```text
QCET interaction system
│
├── CSS / Tailwind
│   ├── hover colors
│   ├── focus states
│   ├── borders
│   ├── shadows
│   ├── simple opacity
│   ├── button press scale
│   └── simple chevron rotation
│
├── Vaul
│   ├── mobile bottom sheets
│   ├── drag/swipe
│   └── gesture physics
│
├── Motion
│   ├── enter/exit presence
│   ├── modal continuity
│   ├── popover continuity
│   ├── desktop drawer / side sheet
│   ├── toast insertion/removal
│   ├── small list insertion/removal
│   └── shared layout indicators
│
├── Lucide
│   └── canonical static icon system
│
└── src/components/icons
    └── a few source-owned AnimateIcons for semantic feedback
```

---

# 6. Non-goals

Do **not** implement:

- page transition animations
- full-dashboard fade-in
- staggered dashboard cards
- staggered table rows
- large translation animations
- bouncing controls
- elastic UI
- perpetual icon loops
- animated icons for all navigation entries
- hover scaling for every card
- a parallel second Drawer/Modal system
- replacement of Vaul
- replacement of Lucide
- Motion on every button
- Motion around server components that do not need client behavior
- broad UI redesign unrelated to motion

---

# 7. Motion design rules

## Timing

```text
instant feedback       80–120ms
micro state            120–160ms
popover / toast        140–180ms
dialog                  160–200ms
drawer / side sheet     180–240ms
```

Routine interactions should generally remain under `300ms`.

## Spatial distance

```text
popover y: 4–6px
dialog y: 4–8px
toast y: 6–10px
```

Full side sheets may travel from their edge because the movement communicates spatial origin.

## Preferred properties

```text
opacity
transform
```

Use Motion layout animation instead of manually tweening geometry where possible.

---

# 8. Phase 0 — Baseline and safety

Before edits:

```bash
git status --short
npm run typecheck
npm run lint
npm test
npm run build
```

Record actual output.

Current audit showed source clean apart from:

```text
.claude/settings.local.json
```

Do not touch, stage, or commit it.

---

# 9. Phase 1 — Install Motion

Run:

```bash
npm install motion
```

Expected changes:

```text
package.json
package-lock.json
```

Then:

```bash
npm run typecheck
```

Do not proceed if dependency installation itself breaks the baseline.

---

# 10. Phase 2 — Canonical Motion foundation

Create:

```text
src/lib/motion/
├── tokens.ts
├── variants.ts
└── features.ts

src/components/motion/
└── motion-provider.tsx
```

Do not create parallel motion config files elsewhere.

---

# 11. Motion tokens

Create:

```text
src/lib/motion/tokens.ts
```

Suggested contract:

```ts
export const motionDuration = {
  instant: 0.1,
  fast: 0.14,
  normal: 0.18,
  panel: 0.22,
} as const

export const motionEase = {
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
} as const

export const motionTransition = {
  micro: {
    duration: motionDuration.fast,
    ease: motionEase.enter,
  },
  enter: {
    duration: motionDuration.normal,
    ease: motionEase.enter,
  },
  exit: {
    duration: motionDuration.fast,
    ease: motionEase.exit,
  },
  panel: {
    duration: motionDuration.panel,
    ease: motionEase.enter,
  },
} as const
```

Keep the token set small.

---

# 12. Reusable variants

Create:

```text
src/lib/motion/variants.ts
```

Canonical variants:

```text
fadeVariants
popoverVariants
dialogVariants
sideSheetVariants
toastVariants
listItemVariants
```

Suggested behavior:

```text
fade       opacity 0 → 1
popover    opacity 0 → 1, y -4 → 0, scale .985 → 1
dialog     opacity 0 → 1, y 6 → 0, scale .99 → 1
sideSheet  x 100% → 0
toast      opacity 0 → 1, y 8 → 0
```

Exit should usually be faster than enter.

---

# 13. Feature bundle — critical requirement

Create:

```text
src/lib/motion/features.ts
```

Use:

```ts
import { domMax } from "motion/react"

export default domMax
```

Do **not** use `domAnimation` if later phases implement `layout` / `layoutId`.

---

# 14. Motion Provider

Create:

```text
src/components/motion/motion-provider.tsx
```

Suggested structure:

```tsx
"use client"

import * as React from "react"
import { LazyMotion, MotionConfig } from "motion/react"

const loadFeatures = () =>
  import("@/lib/motion/features").then((module) => module.default)

export function MotionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  )
}
```

Under this provider, animated DOM nodes should use:

```ts
import * as m from "motion/react-m"
```

`LazyMotion strict` should prevent accidental full `motion.*` usage.

---

# 15. Root integration

Modify:

```text
src/app/layout.tsx
```

Do **not** make the root layout a client component.

Target composition:

```tsx
<body>
  <MotionProvider>
    <AuthProvider>
      <DisplayDensityProvider>
        <AppShell>{children}</AppShell>
      </DisplayDensityProvider>
    </AuthProvider>
  </MotionProvider>
</body>
```

Preserve all current fonts, metadata, viewport, skip-link, PWA and telemetry behavior.

Run:

```bash
npm run typecheck
```

---

# 16. Architectural tests

Create:

```text
tests/motion-system.test.ts
```

Minimum assertions:

```text
package.json contains motion
package.json does not contain framer-motion
MotionProvider exists
MotionConfig is used
reducedMotion="user"
LazyMotion exists
LazyMotion strict enabled
features.ts uses domMax
src/app/layout.tsx renders MotionProvider
```

Preserve existing reduced-motion coverage in:

```text
tests/viewport-accessibility.test.ts
```

Also guard against accidental:

```ts
from "framer-motion"
```

Do not reject infrastructure imports such as `AnimatePresence`, `LayoutGroup`, `MotionConfig`, or `LazyMotion` from `motion/react`.

---

# 17. Phase 3 — Shared Drawer pilot

Target:

```text
src/components/ui/drawer.tsx
```

## Remove

```text
visible state
double requestAnimationFrame
manual opacity state
manual translate state
```

## Preserve

```text
portal
Escape close
backdrop click
scroll lock
ARIA
responsive widths
content
progress/stat UI
```

## Implement

Use:

```text
AnimatePresence
m.div backdrop
m.div or m.aside panel
```

Backdrop:

```text
initial opacity 0
animate opacity 1
exit opacity 0
```

Panel:

```text
initial x "100%"
animate x 0
exit x "100%"
```

Acceptance:

```text
no flicker
no stuck backdrop
exit completes
Escape works
scroll unlocks
reduced motion works
```

---

# 18. Phase 4 — Command Search Modal

Target:

```text
src/components/layout/command-search-modal.tsx
```

Replace enter-only conditional animation with proper presence.

Suggested panel:

```text
opacity 0 → 1
y -6 → 0
scale .985 → 1
```

Preserve:

```text
focus
keyboard navigation
ArrowUp/ArrowDown
Enter
Escape
selected-item scroll
click-outside
ARIA
search logic
```

Do not refactor command search behavior.

---

# 19. Phase 5 — Task Detail Side Sheet

Target:

```text
src/components/dashboard/task-detail-side-sheet.tsx
```

Replace CSS-only `slide-in-from-right` presence with canonical side-sheet motion.

Desktop:

```text
x 100% → 0
```

Mobile:

```text
opacity + small translation
or restrained full-screen spatial transition
```

Preserve **all** domain logic:

```text
task status
approvals
manager rejection
executive closure
permissions
callbacks
mutations
ARIA
mobile back
```

This phase is presentation/motion only.

---

# 20. Phase 6 — Create Task Modal

Target:

```text
src/components/dashboard/create-task-modal.tsx
```

Desktop:

```text
opacity 0 → 1
scale .985/.99 → 1
y 4–6 → 0
```

Mobile:

```text
opacity
small translation at most
```

Preserve:

```text
form state
validation
scope
permissions
assignees
dates
advanced options
creation flow
callbacks
```

No business-logic refactor.

---

# 21. Phase 7 — Notification Popover

Target:

```text
src/components/notifications/notification-popover.tsx
```

Use enter + exit:

```text
opacity 0 → 1
scale .985 → 1
y -4 → 0
```

Keep around 140–180ms.

Preserve notification state and read/unread behavior.

---

# 22. Phase 8 — Calendar Day Sheet

Target:

```text
src/components/calendar/calendar-day-sheet.tsx
```

Reuse the canonical side-sheet variant.

Do not invent a calendar-specific motion language.

Preserve event state and calendar semantics.

---

# 23. Phase 9 — Scope Switcher

Target:

```text
src/components/layout/scope-switcher.tsx
```

Migrate only desktop popover presence.

Suggested:

```text
opacity 0 → 1
y -4 → 0
scale .985 → 1
```

Keep the existing ChevronDown rotation in CSS.

Do not alter:

```text
role authorization
school/unit/my semantics
department selection
URL behavior
delegation actions
```

Remember: **Role is not Scope**.

---

# 24. Phase 10 — Toast / Feedback

Target:

```text
src/components/ui/feedback-layer.tsx
```

Wrap toast collection:

```tsx
<AnimatePresence initial={false} mode="popLayout">
```

Per toast:

```text
layout
initial opacity 0, y 8
animate opacity 1, y 0
exit opacity 0, y 4
```

Preserve:

```text
aria-live
role=status
timer
manual dismiss
action callback
variant styling
```

---

# 25. Phase 11 — Optional Tabs shared indicator

Target:

```text
src/components/ui/tabs.tsx
```

Only implement after overlay migration is stable.

Make it opt-in, e.g.:

```tsx
<TabsList motionIndicator>
```

Use a scoped `layoutId`, optionally with `LayoutGroup`, to avoid collisions between independent tab groups.

Candidate consumers:

```text
List / Kanban
Month / Agenda
document views
scope/view switches
```

Do not animate tab content pages by default.

---

# 26. Phase 12 — Small list insertion/removal

Candidates:

```text
src/components/workspace/components/universal-action-queue.tsx
src/components/tasks/table/components/batch-action-bar.tsx
src/components/tasks/saved-views-selector.tsx
```

Allowed:

```text
insert
remove
reorder
batch action bar appear/disappear
small filter-chip/saved-view changes
```

Forbidden:

```text
layout animation on hundreds of task rows
staggering large task datasets
```

---

# 27. Phase 13 — Targeted CSS cleanup

Only in files already being migrated:

Replace overly broad:

```text
transition-all
```

with narrower transitions when safe:

```text
transition-colors
transition-opacity
transition-shadow
transition-transform
```

Do not perform repository-wide style cleanup.

---

# 28. Phase 14 — AnimateIcons pilot

Only after Motion foundation and presence migrations pass verification.

Lucide remains canonical.

Expected steady state:

```text
95%+ static Lucide
<5% animated semantic icons
```

Potential semantic events:

```text
Bell       unread notification arrives
Check      task/approval/save succeeds
Refresh    actual async refresh is running
```

Never loop decorative icons.

---

# 29. AnimateIcons source ownership

Do not guess IDs.

Search:

```bash
npx animateicons search notification
npx animateicons search refresh
npx animateicons search check
```

Inspect actual results, then copy approved icons:

```bash
npx animateicons add <approved-id> --dir src/components/icons
```

Expected folder:

```text
src/components/icons/
```

Do not create an application-wide animated-icon wrapper unless multiple real use cases prove it necessary.

---

# 30. Animated icon visual rules

Maintain QCET's visual language:

```text
14–18px typical product chrome
Lucide-family visual weight close to stroke 1.5
semantic color only
no decorative enclosure
no emoji
no looping
```

Explicitly keep static icons in:

```text
AppSidebar
MobileBottomNav
main navigation
organization tree
large task tables
document registry rows
most toolbar controls
```

---

# 31. Preserve Vaul ownership

`src/components/ui/bottom-sheet.tsx` remains Vaul-powered.

Do not double-animate a Vaul sheet with Motion.

Ownership:

```text
Vaul   -> gesture-driven mobile sheet movement
Motion -> non-Vaul stateful overlays
```

---

# 32. Base Button policy

Target:

```text
src/components/ui/button.tsx
```

Do not turn it into:

```tsx
<m.button whileTap={...} />
```

Current CSS press feedback is sufficient.

Avoid making every button depend on Motion.

---

# 33. `tw-animate-css` policy

Keep it during this rollout.

Do not migrate every legacy `animate-in`.

A later cleanup can reassess removal after Motion adoption stabilizes.

---

# 34. Performance guardrails

Prefer:

```text
transform
opacity
```

Avoid manual continuous animation of:

```text
width
height
top
left
margin
padding
paint-heavy backgrounds
```

Use Motion layout animation rather than manually tweening geometry.

Do not increase blur effects as part of this task.

---

# 35. Bundle guardrails

1. `LazyMotion`
2. dynamically loaded `domMax`
3. `LazyMotion strict`
4. `m` components
5. no arbitrary Motion entry in `optimizePackageImports`
6. source-own a few AnimateIcons instead of installing a broad icon dependency if only a few are needed
7. preserve existing `next/dynamic` usage in AppShell

Compare final production build with baseline.

Unexpected route-JS growth must be investigated before completion.

---

# 36. Accessibility guardrails

Preserve:

```text
CSS prefers-reduced-motion
MotionConfig reducedMotion="user"
keyboard navigation
focus visibility
Escape close
aria-modal
role=dialog
aria-live
44px touch targets where already required
```

Motion must never be the only state signal.

---

# 37. Test matrix

## Foundation

```text
dependency
provider
feature bundle
reduced motion
root integration
import policy
```

## Drawer

```text
open
close
backdrop
Escape
scroll lock
exit
```

## Command Search

```text
open/close
focus
keyboard nav
Enter
Escape
search
```

## Task Detail

```text
open/close
status logic unchanged
permissions unchanged
mobile
desktop
```

## Create Task

```text
open/close
validation
creation
mobile
desktop
```

## Notification

```text
popover
read/unread
focus
```

## Feedback

```text
enter
timer dismiss
manual dismiss
action
reflow
```

---

# 38. Verification gates

After each wave:

```bash
npm run typecheck
npm run lint
npm test
```

Final:

```bash
npm run verify
npm run build
```

Never claim a command passed unless it actually ran.

---

# 39. Manual QA

Desktop:

```text
Drawer
Task Detail
Create Task
Command Search
Notification Popover
Scope Switcher
Calendar Day Sheet
Toast
Tabs if implemented
```

Mobile:

```text
Task Detail
Create Task
mobile filter sheet
Vaul sheets
bottom nav
safe areas
keyboard
viewport resize
```

Stress:

```text
open-close-open rapidly
Escape during enter
backdrop click during enter
scope change then close
dismiss several toasts
open sequential overlays
```

No stuck backdrop, body lock, or invisible modal is acceptable.

---

# 40. Parallel execution strategy

Do not parallelize foundation files.

## Wave 1 — Agent A: Foundation

Exclusive ownership:

```text
package.json
package-lock.json
src/lib/motion/*
src/components/motion/motion-provider.tsx
src/app/layout.tsx
tests/motion-system.test.ts
```

Responsibilities:

```text
dependency
tokens
variants
domMax loader
provider
root integration
architecture tests
```

Wave 1 must pass typecheck before Wave 2.

---

# 41. Wave 2 — parallel feature agents

## Agent B — Overlay Foundation

Own:

```text
src/components/ui/drawer.tsx
src/components/layout/command-search-modal.tsx
src/components/notifications/notification-popover.tsx
```

Goal:

```text
presence + exit
remove manual animation orchestration
preserve behavior
```

## Agent C — Task Surfaces

Own:

```text
src/components/dashboard/task-detail-side-sheet.tsx
src/components/dashboard/create-task-modal.tsx
src/components/tasks/mobile-task-filter-sheet.tsx
```

Goal:

```text
canonical modal/side-sheet motion
zero domain semantic change
```

## Agent D — Calendar / Scope / Tabs

Own:

```text
src/components/calendar/calendar-day-sheet.tsx
src/components/layout/scope-switcher.tsx
src/components/ui/tabs.tsx
```

Goal:

```text
shared side-sheet variant
scope popover presence
optional layout indicator
```

## Agent E — Feedback / Icon Pilot

Own:

```text
src/components/ui/feedback-layer.tsx
src/components/icons/*
```

Only touch `src/components/layout/app-topbar.tsx` if the notification icon pilot is explicitly justified and does not overlap another agent.

---

# 42. Wave 3 — integration agent

Responsibilities:

```text
inspect all diffs
resolve conflicts
remove duplicate variants
check import policy
check reduced motion
check Vaul ownership
check bundle
run full verification
```

Do not add new UX features during integration.

---

# 43. Suggested commit structure

```text
feat(ui): add canonical motion foundation
refactor(ui): migrate drawer and command palette presence
refactor(tasks): add motion presence to task surfaces
refactor(calendar): unify side-sheet motion
refactor(ui): add toast layout transitions
feat(ui): pilot semantic animated icons
test(ui): enforce motion architecture
```

Keep commits focused and atomic.

---

# 44. Stop conditions

Stop and report rather than improvising when:

```text
target component was replaced by another canonical owner
same file is concurrently owned by another agent
animation requires business/domain changes
implementation conflicts with Vaul gesture ownership
bundle regression is unexpectedly large
baseline tests already fail for unrelated reasons
```

Do not create a V2/facade replacement to bypass the issue.

---

# 45. Definition of Done

```text
[x] motion installed
[x] no framer-motion
[x] one canonical MotionProvider
[x] reducedMotion="user"
[x] LazyMotion configured
[x] domMax used for layout capability
[x] strict LazyMotion discipline
[x] CSS reduced-motion preserved
[x] Drawer double requestAnimationFrame removed
[x] key overlays have exit animation
[x] Task Detail uses canonical side-sheet motion
[x] Create Task uses restrained modal motion
[x] Command Search uses presence
[x] Notification Popover uses presence
[x] Calendar Day Sheet reuses side-sheet variants
[x] Toast removal/reflow motion works
[x] simple Chevron rotation remains CSS
[x] Vaul remains mobile gesture-sheet owner
[x] Lucide remains default icon system
[x] AnimateIcons sparse/source-owned if used
[x] no page-wide stagger
[x] no large task-table animation
[x] no decorative looping motion
[x] no business-logic changes
[x] npm run typecheck passes
[x] npm run lint passes
[x] npm test passes
[x] npm run build passes
```

---

# 46. Priority if execution context is limited

```text
P0  Motion foundation + architecture tests
P0  Drawer
P0  Task Detail Side Sheet
P0  Create Task Modal

P1  Command Search
P1  Notification Popover
P1  Calendar Day Sheet
P1  Feedback Toast

P2  Scope Switcher
P2  optional Tabs indicator
P2  small list insertion/removal

P3  AnimateIcons pilot
```

Do not sacrifice P0 correctness to reach P3 polish.

---

# 47. Completion report format

```markdown
## Implemented
- ...

## Files changed
- ...

## Architectural decisions
- ...

## Verification
- `npm run typecheck`: PASS/FAIL
- `npm run lint`: PASS/FAIL
- `npm test`: PASS/FAIL
- `npm run build`: PASS/FAIL

## Bundle / performance observations
- ...

## Accessibility checks
- ...

## Remaining optional work
- ...

## Deviations from plan
- ...
```

---

# 48. Copy-paste execution prompt

> Thực thi plan Motion + AnimateIcons trên source QCET Work hiện tại.
>
> Đọc `AGENTS.md`, `ARCHITECTURE.md`, các canonical specs liên quan và file plan này trước. Đối chiếu source để xác định phần đã có, phần còn thiếu và canonical owner của từng capability.
>
> Sau đó triển khai trực tiếp; không dừng ở việc tóm tắt hay viết lại kế hoạch.
>
> Tuân thủ tuyệt đối các invariant của repository: One Capability One Canonical Implementation, preserve unrelated changes, Role Is Not Scope, không thay đổi business semantics, không làm yếu accessibility/security/tests.
>
> Motion chỉ dùng cho presence, enter/exit, layout continuity và stateful spatial transitions. CSS/Tailwind tiếp tục xử lý hover/focus/color/simple press. Vaul tiếp tục sở hữu gesture-driven mobile bottom sheets. Lucide vẫn là icon mặc định.
>
> Dùng `motion`, không dùng `framer-motion`. Foundation phải dùng `MotionConfig reducedMotion="user"` và `LazyMotion`; vì plan có `layout/layoutId`, feature bundle phải hỗ trợ layout (`domMax`). Ưu tiên `m` dưới `LazyMotion strict`.
>
> Không animate toàn page, không stagger dashboard/table rows, không bounce, không loop decorative icons, không biến mọi button thành Motion.
>
> Thực hiện theo wave/file ownership trong plan. Chạy verification thật sau mỗi wave và cuối cùng chạy `npm run verify` + `npm run build`.
>
> Nếu source hiện tại khác snapshot của plan, thích nghi với canonical implementation hiện tại thay vì dựng facade/V2 song song.
>
> Kết thúc bằng báo cáo: files changed, decisions, tests/typecheck/lint/build thực tế, bundle observations, accessibility checks, deviations và remaining optional work.

---

# 49. Sources

1. Motion — React installation  
   https://motion.dev/docs/react-installation
2. Motion — React overview  
   https://motion.dev/docs/react
3. Motion — AnimatePresence  
   https://motion.dev/docs/react-animate-presence
4. Motion — Layout animations  
   https://motion.dev/docs/react-layout-animations
5. Motion — MotionConfig  
   https://motion.dev/docs/react-motion-config
6. Motion — Accessibility  
   https://motion.dev/docs/react-accessibility
7. Motion — Reduce bundle size  
   https://motion.dev/docs/react-reduce-bundle-size
8. Motion — LazyMotion  
   https://motion.dev/docs/react-lazy-motion
9. AnimateIcons — CLI  
   https://animateicons.in/icons/docs/cli
10. AnimateIcons  
    https://animateicons.in/
11. Next.js — optimizePackageImports  
    https://nextjs.org/docs/pages/api-reference/config/next-config-js/optimizePackageImports
12. Next.js — Package bundling  
    https://nextjs.org/docs/pages/guides/package-bundling
13. web.dev — Animation performance  
    https://web.dev/articles/animations-overview