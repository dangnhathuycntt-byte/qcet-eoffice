# QCET E-Office — Mobile Architecture & Adaptive Layout

**Document Status**: Canonical Reference  
**Scope**: Mobile Ergonomics, Safe Area Clearances, Virtual Keyboard Handling, Touch Targets  
**Last Updated**: 2026-09-09  

---

## 1. Core Philosophy: Restructure, Don't Merely Shrink

Mobile devices in QCET E-Office are primary tools for administrators, deans, and faculty on campus. The mobile interface is not a truncated desktop view; it is an **adaptive layout** engineered around touch ergonomics:

```
┌─────────────────────────────────────────────��────────────┐
│ DESKTOP (> 768px)          │ MOBILE (< 768px)            │
├────────────────────────────┼─────────────────────────────┤
│ Collapsible table rows     │ Card list / Agenda cards    │
│ Multi-column data grid     │ Bottom sheet detail drawer  │
│ Fixed left sidebar (248px) │ Persistent 4-item bottom bar│
│ Persistent hover actions   │ Swipe / Tap action sheets   │
└────────────────────────────┴─────────────────────────────┘
```

Never force users to horizontally scroll wide desktop tables on mobile viewports.

---

## 2. Centralized Safe-Area Clearance (`AppShell`)

A critical anti-pattern in responsive design is child views independently guessing bottom offsets, resulting in conflicting `pb-16`, `pb-20`, or `pb-24` utilities that waste vertical screen estate.

### Canonical Rule: AppShell Owns Bottom Clearance
In `src/components/layout/app-shell.tsx`, the main layout wrapper calculates the definitive viewport clearance:

```tsx
<main
  id="main-content"
  className="flex-1 py-4 md:py-8 pb-[calc(56px+env(safe-area-inset-bottom,0px)+12px)] md:pb-8"
  tabIndex={-1}
>
  {children}
</main>
```

- **56px**: Fixed height of the `MobileBottomNav` bar.
- `env(safe-area-inset-bottom, 0px)`: Hardware home indicator clearance on modern iOS and Android devices.
- **12px**: Visual breathing room between the lowest scrollable content and the navigation bar.
- **Child Component Rule**: Child views, tables, and lists must **never** append standalone bottom padding for navigation clearance.

---

## 3. Virtual Keyboard Avoidance (`useVirtualKeyboard`)

On mobile browsers, the on-screen software keyboard shifts and shrinks the viewport, frequently concealing active form inputs or submit buttons.

### 3.1 Hook Implementation
`src/hooks/use-virtual-keyboard.ts` subscribes to the `window.visualViewport` API:
1. Detects height differential (`window.innerHeight - viewport.height > 150px`).
2. Publishes `--keyboard-height` CSS variable to `document.documentElement`.
3. Returns `{ isKeyboardOpen: boolean, keyboardHeight: number }`.

### 3.2 Form Ergonomics & Auto-Scroll
When a form field receives focus inside a modal or drawer:
```typescript
import { scrollActiveInputIntoView } from "@/hooks/use-virtual-keyboard";

// Triggered on input focus
onFocus={(e) => scrollActiveInputIntoView(e.currentTarget)}
```
The helper smoothly centers the active element within the visible portion of the viewport above the virtual keyboard.

---

## 4. Touch Target Ergonomics & Tap Areas

All interactive elements on mobile viewports must meet or exceed WCAG 2.1 Level AA touch target requirements:

1. **Minimum Tap Area**: Interactive targets (buttons, icon triggers, tabs, filter chips, dropdown items) must measure at least **44x44px** (`min-h-[44px] min-w-[44px]` or adequate surrounding padding).
2. **Spacing**: Minimum 8px gap between adjacent touch targets to eliminate accidental taps.
3. **No Hidden Actions**: Critical operations (e.g., submitting deliverable, approving task, opening details) must be directly accessible via large tap zones rather than hidden behind desktop hover states (`group-hover:`).

---

## 5. Bottom Sheets & Drawer Overlays

Mobile detail views (e.g., `TaskDetailSideSheet`, deliverable reviews, filter trays) adaptively render as bottom sheets using **Vaul**:

- **Drag Handle**: Visible tactile pill handle at top center (`w-12 h-1.5 rounded-full bg-muted-foreground/30`).
- **Dismiss Ergonomics**: Supports downward swipe gesture to dismiss, alongside an explicit, accessible close button.
- **Max Height**: Constrained to `max-h-[90dvh]` with internal scrolling (`overflow-y-auto`) to preserve visual context of the underlying application.
- **Backdrop Blur**: Semi-transparent dark overlay (`bg-black/40 backdrop-blur-xs`) focusing attention on the active sheet.

---

## 6. Mobile Quality Checklist

Before completing mobile-facing features:
- [ ] Verify view on 375px (iPhone SE) and 390px viewports in Chrome DevTools / Browser Preview.
- [ ] Confirm no horizontal scrollbar appears on the root page body (`overflow-x: hidden`).
- [ ] Verify bottom navigation bar does not obscure the lowest button or card.
- [ ] Confirm modal dialogs and bottom sheets adjust smoothly when software keyboard appears.
