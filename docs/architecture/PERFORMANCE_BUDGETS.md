# QCET E-Office - Performance Budgets & Web Vitals Specification

## Mission
QCET E-Office operates across varied client hardware and network environments across the campuses of Trường Cao đẳng Kinh tế và Công nghệ Quy Nhơn . Performance is a foundational quality invariant, not an afterthought.

---

## 1. Core Performance Thresholds (Budgets)

| Metric | Category | Budget Threshold | Target (Good) | Enforcement Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **INP** (Interaction to Next Paint) | Core Web Vital | **&le; 200 ms** | &le; 100 ms | React transition decoupling, deferred value, client telemetry |
| **LCP** (Largest Contentful Paint) | Core Web Vital | **&le; 2500 ms** | &le; 1800 ms | SSR/RSC streaming, font preloading, priority image tags |
| **CLS** (Cumulative Layout Shift) | Core Web Vital | **&le; 0.1** | &le; 0.05 | Explicit aspect ratios, skeleton reserved layout slots |
| **Route Initial JS Budget** | Bundle Size | **&le; 150 KB** | &le; 120 KB | Next.js dynamic code-splitting for heavy surfaces, tree-shaking |
| **API Latency (p95)** | Backend SLA | **&le; 300 ms** | &le; 150 ms | Edge caching, index optimization, lean payload shaping |
| **Database Query Latency (p95)** | Database SLA | **&le; 100 ms** | &le; 50 ms | Prisma query optimization, compound indexes, lean selects |

---

## 2. Core Web Vitals Definition & Strategy

### Interaction to Next Paint (INP &le; 200ms)
- **Problem**: Large UI trees re-rendering on every keystroke or tab switch block the browser main thread.
- **Remediation**:
  - Context slicing: Separated navigation, data, actions, and modal contexts (`useDashboardNav`, `useDashboardData`, `useDashboardActions`, `useDashboardModal`). Filter state changes do not trigger re-renders in action bars or navigation bars.
  - Granular hooks: `useTaskFilters` uses `React.useDeferredValue(searchQuery)` so typing in search inputs does not freeze the UI.
  - Heavy modal closures use `React.startTransition` or state isolation.

### Largest Contentful Paint (LCP &le; 2500ms)
- **Problem**: Bulky JavaScript bundles delaying initial DOM paint and hero element rendering.
- **Remediation**:
  - Critical shell elements (Topbar, Sidebar skeleton) render immediately.
  - Fonts loaded via `next/font` with `display: swap` and local fallbacks.
  - Above-the-fold layout avoids nested client-side waterfalls.

### Cumulative Layout Shift (CLS &le; 0.1)
- **Problem**: Modals, banners, or late-loaded PDF viewers shifting layout content abruptly.
- **Remediation**:
  - Heavy viewers (such as `DocumentPdfViewer`) provide reserved skeleton loading states (`animate-pulse` containers with fixed or min-height layout).
  - Modals and drawers render in portal overlays outside the normal document flow.

---

## 3. Bundle Slicing & Code Splitting (`next/dynamic`)

To maintain the **Route Initial JS budget &le; 150KB**, all heavy interactive surfaces that are not required for initial render are code-split using `next/dynamic` with `{ ssr: false }`:

1. **`CommandSearchModal`**:
   - Location: `src/components/layout/app-shell.tsx`
   - Trigger: User presses `Ctrl+K` / `Cmd+K` or taps search button.
2. **`DocumentPdfViewer`**:
   - Locations: `src/components/documents/document-split-view.tsx`, `src/components/documents/document-registry-view.tsx`
   - Loaded with explicit placeholder: `loading: () => <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Đang tải trình xem PDF...</div>`
3. **Modal Dialogs in Task Workspaces**:
   - `CreateTaskModal`: Loaded on task creation trigger.
   - `ReviewActionDialog`: Loaded on deliverable review trigger.
   - `SubmitDeliverableModal`: Loaded on deliverable submission trigger.

---

## 4. Web Vitals Telemetry Integration

Client telemetry streams real-world field metrics to `/api/telemetry`:
- `WebVitalsReporter` in `src/components/telemetry/web-vitals-reporter.tsx` listens via `useReportWebVitals` from `next/web-vitals`.
- Forwarded metrics include: `LCP`, `INP`, `CLS`, `FCP`, `TTFB`.
- Metrics are buffered, deduplicated, and dispatched asynchronously via `navigator.sendBeacon` or fetch with `keepalive: true` to prevent any main thread degradation.
