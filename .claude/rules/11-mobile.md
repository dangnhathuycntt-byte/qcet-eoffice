---
paths:
  - "src/components/layout/**/*"
  - "src/components/**/*mobile*.tsx"
  - "src/components/pwa/**/*"
  - "src/hooks/use-virtual-keyboard.ts"
  - "tests/*mobile*.test.ts"
---
# Mobile Experience & Layout Invariants

1. **Adaptive, Not Shrunk**: Compact UI must adapt structure (e.g. cards, agenda, sheets), not merely squeeze desktop table layouts horizontally.
2. **Centralized Spacing**: `AppShell` owns global mobile safe-area padding and bottom-navigation offset. Never stack ad-hoc `pb-20`/`pb-24` padding in child views.
3. **Touch Ergonomics**: All primary tap targets (buttons, inputs, tabs) must provide minimum 44x44px touch boundaries (`min-h-[44px]`).
4. **No Horizontal Desktop Tables**: Do not expose multi-column desktop tables as the primary mobile interaction; prefer modular cards or expandable summaries.
5. **Keyboard Safety**: Never obscure focused inputs with virtual keyboards or sticky bottom bars; use `use-virtual-keyboard.ts` offset guards.
6. **Mobile Surfaces**: Use dedicated slide-up sheets or full-viewport overlays with explicit dismiss controls for detail views and action sheets.
