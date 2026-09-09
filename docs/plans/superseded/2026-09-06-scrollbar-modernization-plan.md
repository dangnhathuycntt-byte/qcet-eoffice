---
status: superseded
domain: ux
created: 2026-09-06
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Scrollbar Modernization & Anti-Slop Plan

## Context
The notification popover currently displays a harsh, thick, black native browser scrollbar (`overflow-y-auto`) on desktop browsers, ruining the visual refinement and executive aesthetics of the QCET dashboard.

## Global Constraints
- Zero decorative emojis in src directory.
- Icon stroke widths strictly adhere to 1.5 standard.
- Tabular numerals applied to numeric metrics and dates.
- CSS design tokens define OKLCH/sRGB color spaces and elevation levels.
- Scrollbars must be ultra-thin (4-5px), transparent track, subtle rounded pill thumb with gentle contrast in both light and dark mode.

## Tasks

### Task 1: Refine Global Scrollbar Design Tokens & Notification Popover
- Update `src/app/globals.css` with modernized `.thin-scrollbar` rules that work across WebKit (Chrome, Safari, Edge) and Firefox (`scrollbar-width: thin`, `scrollbar-color`).
- Thumb color uses `color-mix(in srgb, var(--foreground) 20%, transparent)` and hover `color-mix(in srgb, var(--foreground) 35%, transparent)` with transparent track.
- Apply `thin-scrollbar` to `src/components/notifications/notification-popover.tsx` list container.
- Apply `thin-scrollbar` to `src/app/notifications/page.tsx` and scrollable side sheets/menus if applicable.
- Verify with `npm run typecheck` and `npm test`.

### Task 2: Visual Verification & End-to-End Test Suite
- Run test suite `npm test` to ensure 100% passing tests and anti-slop compliance.
- Use `preview_eval` and `preview_screenshot` on the dev server to visually confirm that the scrollbar in the Notification Popover is sleek, semi-transparent, unobtrusive, and matches the light/dark theme.
