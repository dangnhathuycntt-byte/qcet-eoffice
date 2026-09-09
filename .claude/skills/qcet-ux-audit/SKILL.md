---
name: qcet-ux-audit
description: "Audit QCET E-Office user interfaces for Information Architecture compliance, visual hierarchy, light-only design standards, mobile ergonomics, touch target compliance (>=44px), accessibility, and data trust."
---

# QCET UX & UI Audit Checklist (`qcet-ux-audit`)

This checklist guides a systematic audit of any user interface component, page, or layout in the QCET E-Office application. Every interface change must comply with these guidelines.

---

## 1. Information Architecture & Canonical Routes

- [ ] **Canonical Route Compliance**: Routes match `src/lib/navigation/canonical-navigation-registry.ts`:
  - Main dashboard & personal workbench: `/dashboard`
  - Unified task center: `/tasks`
  - Document management: `/documents`
  - Academic & institutional calendar: `/calendar`
  - Administrative management: `/admin`
  - Settings & profile: `/settings`
- [ ] **No Legacy Route Fragmentation**: Obsolete sub-paths (such as `/dashboard/executive`, `/dashboard/lead-board`, `/dashboard/tasks`) are permanently consolidated or redirected.
- [ ] **Navigation Symmetry**: Navigation state is synchronized across:
  - Desktop sidebar (`AppSidebar`)
  - Mobile bottom navigation (`MobileBottomNav`)
  - Scope and view switchers (`TopbarScopeSwitcher`)

---

## 2. Visual Hierarchy & Light-Only Standard

- [ ] **Strict Light-Only Mode**:
  - The UI uses Tailwind CSS v4 OKLCH light tokens exclusively.
  - Zero `dark:` variant classes in markup or components.
  - Zero `.dark` CSS selectors or rules in styling.
  - No theme toggle buttons, `useTheme`, or `ThemeProvider`.
- [ ] **Semantic Design Tokens**:
  - Backgrounds: `bg-background`, `bg-card`, `bg-muted`.
  - Borders: `border-border`, `border-input`.
  - Typography: `text-foreground`, `text-muted-foreground`.
  - Primary accents: Administrative OKLCH blues/teals defined in `globals.css`.
- [ ] **Action Hierarchy**:
  - Exactly **one** prominent primary action (CTA) per flow (`variant="default"` or `bg-primary`).
  - Secondary actions use `outline` or `ghost` variants.
  - Destructive actions are styled with explicit warning/destructive tokens.
- [ ] **Restrained Iconography**:
  - Lucide icons use standard stroke width (`strokeWidth={1.5}`).
  - No colored square background enclosures or emoji icons in production controls.
- [ ] **Typography Floor**:
  - Minimum text size is 12px (`text-xs`).
  - Font family is `Be Vietnam Pro` with proper Vietnamese diacritical marks.
  - Never use arbitrary sub-12px sizes (`text-[9px]`, `text-[10px]`).

---

## 3. Mobile Ergonomics & Responsive Behaviors

- [ ] **Touch Target Sizing**:
  - All interactive controls (buttons, links, icon buttons, checkboxes, tabs) have a minimum touch area of **44x44px** (`min-h-[44px] min-w-[44px]` or adequate surrounding touch padding).
- [ ] **Safe Area Clearance**:
  - Bottom content padded to clear mobile navigation: `pb-[calc(env(safe-area-inset-bottom)+4.5rem)]` on mobile layouts.
  - Notch and status bar clearance: `pt-[env(safe-area-inset-top)]`.
- [ ] **Responsive Data Presentation**:
  - Desktop multi-column tables gracefully transform into vertical cards or collapsible rows on mobile viewports (< 768px).
  - Heavy slide-over dialogs adapt to responsive bottom sheets (`BottomSheet` / `Vaul`).
- [ ] **Virtual Keyboard Safety**:
  - Modals and fixed action bars adjust position dynamically or use `position: sticky` above the keyboard.
  - Input fields remain visible and scrollable when focused on mobile devices.

---

## 4. Empty States, Error States & Loading Hygiene

- [ ] **Actionable Empty States**:
  - When collections (tasks, documents, notices) are empty, display an informative empty state with a clear call-to-action (e.g. "Tạo nhiệm vụ mới").
  - Never display raw blank containers or broken layout borders.
- [ ] **Administrative Vietnamese Microcopy**:
  - Friendly, professional administrative tone (e.g. "Không tìm thấy nhiệm vụ nào trong tháng này" instead of raw technical codes).
- [ ] **Skeleton Screens**:
  - Loading states use skeleton loaders (`Skeleton`) that match the exact dimension and layout of incoming cards or table rows, avoiding layout shifts (CLS).

---

## 5. Accessibility (a11y) & Focus Management

- [ ] **Accessible Names**:
  - Every icon-only button (`<button><LucideIcon /></button>`) includes an `aria-label` or `<span className="sr-only">`.
- [ ] **Visible Focus Rings**:
  - All interactive elements display a distinct focus indicator (`focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none`).
- [ ] **Color Contrast**:
  - Text-to-background contrast ratio meets WCAG AA (>= 4.5:1 for normal text, >= 3:1 for large text).
- [ ] **Keyboard Navigation**:
  - Logical tab order matching visual flow.
  - Esc key closes open dropdowns, popovers, and modals.

---

## 6. Data Trust & Anti-Slop Interface

- [ ] **Zero Synthetic Metrics**:
  - All counters, progress bars, and badges derive from real database values.
  - No dummy random percentages, fake user avatars, or placeholder mock data.
- [ ] **Derivation Symmetry**:
  - If a filter badge indicates "12 nhiệm vụ", the list beneath it must show exactly 12 items matching that filter.
