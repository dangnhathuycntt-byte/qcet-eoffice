# MASTER AUDIT REPORT & REMEDIATION ROADMAP: QCET E-OFFICE
**Evaluation Standard:** Institutional Governance (Decree 30/2020/ND-CP), DACUM Vocational Methodology, W3C Mobile Web & Web App Manifest Standards, Apple Human Interface Guidelines (HIG 44x44px), and Anti-AI Slop Design Principles.

---

## 1. EXECUTIVE SUMMARY

### System Assessment & Overall Grade: **B- (74/100)**

| Dimension | Grade | Core Status |
| :--- | :--- | :--- |
| **Visual Design & Design System** | **B** | Solid OKLCH paper palette and strict Light-Mode adherence; degraded by generic AI gradients, neon glows, and unmotivated pulsing dots. |
| **Mobile Ergonomics & Layout** | **C+** | Strong tap-delay mitigation (touch-action), but compromised by center-screen modal keyboard collision, sub-44px touch targets, and viewport jitter. |
| **Academic Microcopy & Tone** | **C** | Good foundations in legal citations, heavily diluted by tech jargon ("Radar", "Web Push"), SaaS clichés ("45 seconds"), and disrespectful pronouns ("bạn"). |
| **PWA & Offline Resilience** | **B+** | Clean offline mutation queue (`qcet_offline_mutations_v1`) and structured push onboarding, hindered by WebKit scope registration bugs and precache vulnerabilities. |

### Key Architectural Strengths
1. **Light-Only Theme Discipline:** Zero leaked `dark:` utility variants across the entire codebase. Root canvas is anchored to OKLCH light paper tone (`oklch(0.985 0.003 250)`) via `@custom-variant dark (&:not(*));` in `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css`.
2. **Robust Offline Mutation Engine:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/offline-sync.ts` provides a structured transaction queue (`qcet_offline_mutations_v1`) with exponential backoff (max 5 retries), optimistic UI dispatch, and automated flush upon network reconnection.
3. **PWA Push Permission Ergonomics:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/pwa/push-onboarding-sheet.tsx` enforces a 1,200ms initial stabilization delay, a 7-day dismissal cooldown in `localStorage`, and an illustrated 3-step iOS Safari "Add to Home Screen" guide complying with iOS 16.4+ Web Push requirements.
4. **Mobile Form Zoom Protection:** Viewports below 640px enforce `font-size: 16px !important` on interactive inputs with `touch-action: manipulation`, eliminating mobile safari auto-zoom and double-tap latency.

### Highest-Risk Flaws
1. **Virtual Keyboard Occlusion on Mobile Modals (P0):** Approval and submission dialogues (`ReviewActionDialog`, `SubmitDeliverableModal`) are configured as centered desktop popups. Opening virtual keyboards on mobile viewports completely hides the primary submission actions.
2. **iOS Safari Viewport Jitter & Missing Dynamic Units (P0):** Usage of `min-h-screen` (`100vh`) in `globals.css` and `app-shell.tsx` causes visible layout shifts whenever Safari's dynamic URL bar expands or contracts.
3. **Sub-44px Interactive Touch Targets (P1):** Mission-critical action buttons in `UniversalActionQueue` measure 30px high, inducing frequent mis-taps between row selection and task approval.
4. **Service Worker URL Scope Mismatch (P1):** Passing `'/sw.js'` to `navigator.serviceWorker.getRegistration()` causes silent registration failures on WebKit/iOS Safari.
5. **Loss of Institutional Credibility via AI Slop (P1):** Pulsing status dots, decorative em-dashes (`—`), marketing buzzwords ("Radar", "toàn năng"), and generic blue-purple button gradients undermine the authority of a state vocational college platform.

---

## 2. TOP 5 CRITICAL MOBILE UX VULNERABILITIES (P0 - IMMEDIATE RESOLUTION REQUIRED)

### Vulnerability 1: Desktop Modal Keyboard Occlusion on Mobile Forms
* **Files:**
  * `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/review-action-dialog.tsx` (Lines 304-307, 551-593)
  * `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/submit-deliverable-modal.tsx` (Lines 402-411, 647-678)
* **Root Cause:** Both modals use `fixed inset-0 z-50 flex items-center justify-center p-4` and `max-h-[92vh]`. When users focus on `<textarea id="review-comment-input">` or `<input id="deliverable-name-input">`, the soft keyboard consumes ~300px. The centered modal overflows the top and bottom of the visible screen, trapping the primary CTA buttons beneath the keyboard.
* **Target Architecture:** On viewports `< sm`, morph into a native **Bottom Sheet** (`items-end sm:items-center`), anchor action buttons to the bottom with full width (`w-full sm:w-auto min-h-[48px]`), add a pull-down handle, and include `pb-safe`.

### Vulnerability 2: iOS Dynamic Viewport Layout Jitter & Safe-Area Fallback Failure
* **Files:**
  * `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css` (Lines 126, 194-208)
  * `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/layout/app-shell.tsx` (Lines 108, 114)
* **Root Cause:** `min-h-screen` compiles to `100vh`, which references the maximum viewport height with hidden browser navigation. Scrolling down collapses Safari's bottom address bar, causing the page to snap and jump. Furthermore, `.pb-safe` lacks a fallback (`env(safe-area-inset-bottom)` instead of `env(safe-area-inset-bottom, 0px)`), causing CSS expressions to evaluate as invalid in standard desktop or non-notched mobile browsers.
* **Target Architecture:** Replace `min-h-screen` with `min-h-[100dvh]`. Enforce `env(safe-area-inset-bottom, 0px)` and `env(safe-area-inset-top, 0px)` across all layout declarations.

### Vulnerability 3: Sub-44px Touch Targets in Emergency Workflow Queues
* **File:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/universal-action-queue.tsx` (Lines 206, 316)
* **Root Cause:** Critical buttons ("Duyệt nhanh", "Nộp minh chứng") are hardcoded to `h-7.5 min-h-[30px] px-2.5`. In one-handed thumb interaction (Steven Hoober 49% thumb zone), touch accuracy drops significantly, resulting in accidental task navigation rather than action execution.
* **Target Architecture:** Set mobile touch targets to `min-h-[44px]` with `touch-manipulation`, converting the desktop single-row layout into an adaptive two-line layout on small screens.

### Vulnerability 4: Missing Root Overscroll Lock & Pull-to-Refresh Gesture Collision
* **File:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css` (Lines 125-145)
* **Root Cause:** Neither `html` nor `body` defines `overscroll-behavior-y: none`. In Chrome on Android, swiping downward at the top of task tables triggers the browser's native page reload spinner, clashing with the in-app `usePullToRefresh` hook in `cascading-task-table.tsx`. On iOS standalone PWAs, the entire window rubber-bands.
* **Target Architecture:** Apply `overscroll-behavior-y: none;` to `html, body`, and preserve `overscroll-behavior-y: contain;` on nested scroll containers.

### Vulnerability 5: Service Worker Registration Scope Bug in Push Hook
* **File:** `/Users/dnhhuy/Projects/QCET/QCET Work/src/hooks/use-push-notification.ts` (Lines 99, 159)
* **Root Cause:** Calls `navigator.serviceWorker.getRegistration('/sw.js')`. According to the W3C Service Worker specification, `getRegistration()` accepts a client URL scope, not a script filename. Passing `'/sw.js'` searches for a worker registered specifically for that file URL, returning `undefined` on WebKit / Safari iOS and blocking push subscription sync.
* **Target Architecture:** Refactor to `navigator.serviceWorker.getRegistration('/')` or bare `navigator.serviceWorker.getRegistration()`.

---

## 3. ANTI-AI SLOP REMEDIATION MATRIX

| AI Slop Symptom | Detected File Location | Why It Degrades Credibility | Institutional Engineering Solution |
| :--- | :--- | :--- | :--- |
| **Generic Purple/Blue AI Gradient** | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/ui/button.tsx` (Lines 21-22) | "SaaS AI Copilot" template artifact; inappropriate for state educational governance. | Remove the `premium` variant entirely. Standardize on solid semantic tokens: `bg-primary text-primary-foreground`. |
| **Neon Glowing Shadows & Glassmorphism** | `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css` (Lines 255-275), `cascading-task-table.tsx` (Line 693), `portal/page.tsx` (Lines 156-159) | GPU-heavy decorative novelty that reduces contrast and conveys juvenile aesthetics. | Purge `.shadow-glow-*` and `.glass-*`. Replace with crisp administrative borders (`border-border` / `border-primary/20`) and subtle shadows (`shadow-xs` / `shadow-card`). |
| **Pulsing / Pinging Decorative Dots** | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/universal-action-queue.tsx` (Lines 161, 267), `activity-feed-widget.tsx` (Lines 118-124), `app-sidebar.tsx` (Line 547) | Constant CPU/GPU churn; mimics cryptocurrency dashboards rather than official document archives. | Strip all `animate-pulse` and `animate-ping` classes from badges and status indicators. Use solid, static semantic badges (`Badge` with explicit text). |
| **Decorative Em-Dash (`—`) Usage** | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/bento-portal-hub.tsx` (Lines 78-83), `role-viewpoint-banner.tsx` (Line 16), `create-task-modal.tsx` (Lines 552, 689) | Hallmarked pattern of LLM-generated UI text and Western markdown formatting. | Replace em-dashes in titles/greetings with standard colons (`:`) or commas (`,`). Use standard hyphens (`-`) or "Chưa xác định" in empty data table cells. |
| **Symmetric Bento Grid Monotony** | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/dashboard/executive-action-center.tsx` (Line 182), `executive-stat-strip.tsx` (Line 188) | Equal visual weight across all cards prevents users from parsing primary operational bottlenecks. | Break symmetry: highlight the primary driver ("Cần xử lý & Quá hạn") with prominent width/contrast, collapsing secondary stats into compact tabular rows. |
| **Unmotivated Row Scaling (`hover:scale-105`)** | `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/portal/page.tsx` (Lines 168, 210), `cascading-task-table.tsx` (Lines 969, 1032) | Causes blurry subpixel font rendering and layout stutter in dense data tables. | Replace scale transforms with clean background color transitions (`hover:bg-muted/50`) and crisp border shifts. |
| **Missing Accessibility Reduced Motion Reset** | `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css` | Fails WCAG 2.2 criteria 2.3.3 for vestibular motion sensitivity. | Insert a global `@media (prefers-reduced-motion: reduce)` block in `globals.css` zeroing out animation durations and transitions. |
| **Inconsistent Stroke Widths & Fake Badges** | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/navigation.tsx` (Line 359), `bento-portal-hub.tsx` (Line 115), `universal-action-queue.tsx` (Lines 222, 303) | "v1.2 Enterprise", "Sparkles", and mixed icon stroke widths (1.25, 1.5, 1.75, 2.2) signal an unvetted UI template kit. | Standardize all Lucide icons to `strokeWidth={1.5}`. Replace "v1.2 Enterprise" and `Sparkles` with the academic session: "Niên khóa 2025-2026". |

---

## 4. ACADEMIC TONE & MICROCOPY DETOX TABLE

**Administrative Benchmark:** Decree No. 30/2020/ND-CP on clerical work, QCET vocational governance regulations, and DACUM curriculum methodology.

| No. | File & Line Reference | Current Problematic String | Institutional Standard String | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/user-profile-modal.tsx`:145 | "Chào mừng bạn đến với QCET E-Office!" | "Kính chào Quý Thầy/Cô đến với QCET E-Office!" | Enforces academic deference ("Quý Thầy/Cô") and removes casual consumer pronoun ("bạn"). |
| 2 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/user-profile-modal.tsx`:281 | "Viên chức - Xem việc trực tiếp" | "Viên chức - Thực hiện nhiệm vụ & Nộp minh chứng" | Aligns with active DACUM operational duties (task execution and evidence submission). |
| 3 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/user-profile-modal.tsx`:296 | "Trưởng đơn vị - Quản trị khoa/phòng" | "Lãnh đạo đơn vị - Quản lý đơn vị & Phê duyệt" | Encompasses all academic units (Faculties, Divisions, Centers, Boards). |
| 4 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/user-profile-modal.tsx`:311 | "Ban Giám hiệu - Điều hành toàn trường" | "Ban Giám hiệu - Chỉ đạo & Điều hành toàn trường" | Reinstates the primary institutional governance prerogative of the Board of Rectors ("Chỉ đạo"). |
| 5 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/google-login-button.tsx`:107 | "Đăng nhập bằng Email trường" | "Đăng nhập bằng Email công vụ Nhà trường" | Conveys official administrative status for the `@cdktcnqn.edu.vn` Google Workspace domain. |
| 6 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/google-login-button.tsx`:183 | "Đã copy" | "Đã sao chép" | Removes colloquial loanword "copy". |
| 7 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/google-login-button.tsx`:220 | "Vẫn thử tới /api/auth/google" | "Tiếp tục kết nối xác thực Google" | Eliminates internal backend endpoint exposure from end-user UI. |
| 8 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/google-login-button.tsx`:228 | "Đã hiểu, đóng" | "Đóng thông báo" | Replaces conversational banter with direct modal dismissal. |
| 9 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/role-viewpoint-banner.tsx`:18 | "Góc nhìn Cá nhân: Nhiệm vụ & Công việc..." | "Nhiệm vụ trực tiếp: Các công việc được phân công..." | Connects individual work to the institutional hierarchy; removes tautology ("Nhiệm vụ & Công việc"). |
| 10 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/onboarding-constants.ts`:49-50 | "Radar & Điểm Nghẽn Đơn Vị" / "...ban hành Nghị quyết can thiệp." | "Tiến Độ & Hồ Sơ Tồn Đọng Đơn Vị" / "...kịp thời đôn đốc và chỉ đạo xử lý." | Eliminates tech metaphors ("Radar") and corrects governance scope (Rectors issue "Chỉ đạo", not "Nghị quyết"). |
| 11 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/onboarding-constants.ts`:57-58 | "Tìm Kiếm Toàn Năng" / "...tra cứu thần tốc..." | "Tra Cứu Nhanh" / "...tra cứu nhanh văn bản, tờ trình và hồ sơ..." | Removes exaggerated LLM promotional phrasing. |
| 12 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/onboarding-constants.ts`:75-76 | "Giao Việc & Phê Duyệt" / "...duyệt các minh chứng..." | "Phân Công & Nghiệm Thu" / "...thẩm định hồ sơ minh chứng hoàn thành." | Adopts rigorous vocational evaluation terminology ("Thẩm định", "Nghiệm thu"). |
| 13 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/onboarding-constants.ts`:102-103 | "Hệ sinh thái số hóa tự động sinh mã số..." | "Tự động cấp số văn bản và lưu trữ hồ sơ theo NĐ 30/2020/NĐ-CP" | Replaces vague marketing buzzwords with statutory regulatory citations. |
| 14 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/onboarding-constants.ts`:150 | "Đã nhận vai trò" | "Đã xác nhận vai trò" | Emphasizes administrative acknowledgment rather than passive receipt. |
| 15 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/onboarding-constants.ts`:156 | "Nhận Web Push tức thì..." | "Nhận thông báo trực tiếp khi có nhiệm vụ hoặc chỉ đạo mới" | Replaces technical browser jargon ("Web Push") with functional clarity. |
| 16 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/onboarding/welcome-modal.tsx`:135 | "Khám phá trong 45 giây" | "Xem hướng dẫn sử dụng" | Eliminates SaaS commercial conversion formulas. |
| 17 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/onboarding/onboarding-checklist-widget.tsx`:74 | "...để bạn tiếp tục." | "...để Thầy/Cô tiếp tục làm việc." | Maintains respectful address towards faculty. |
| 18 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/onboarding/onboarding-checklist-widget.tsx`:270 | "Xem hướng dẫn trực quan (Tour)" | "Xem hướng dẫn từng bước" | Eliminates unnecessary bracketed English loanword. |
| 19 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/universal-action-queue.tsx`:68 | "Không có tác vụ nào cần xử lý khẩn cấp" | "Không có nhiệm vụ cần xử lý gấp" | Replaces operating system process term ("tác vụ") with administrative "nhiệm vụ". |
| 20 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/universal-action-queue.tsx`:83 | "Duyệt nhanh" | "Phê duyệt" | Prevents perception of careless, rubber-stamp administrative approvals. |
| 21 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/universal-action-queue.tsx`:91 | "Giao việc" | "Phân công" | Upgrades colloquial phrasing to formal managerial assignment. |
| 22 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/universal-action-queue.tsx`:269 | "Nhiệm vụ cá nhân cần nộp" | "Nhiệm vụ cần nộp hồ sơ minh chứng" | Clarifies deliverable requirements under DACUM standards. |
| 23 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/adaptive-metric-strip.tsx`:121 | "Hồ sơ chờ bạn phê duyệt" | "Hồ sơ chờ Thầy/Cô phê duyệt" | Corrects pronoun tone in unit leadership view. |
| 24 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/adaptive-metric-strip.tsx`:132 | "Tiến độ khoa" | "Tiến độ đơn vị" | Accurately includes non-teaching departments (Finance, Admin, Library). |
| 25 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/adaptive-metric-strip.tsx`:146 | "Việc cần làm ngay" | "Nhiệm vụ được giao" | Replaces personal consumer to-do jargon with official dispatch terminology. |
| 26 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/tasks/cascading-task-table.tsx`:162 | "Đang làm" | "Đang thực hiện" | Replaces casual speech with formal state reporting terminology. |
| 27 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/tasks/cascading-task-table.tsx`:170 | "Cần duyệt" | "Chờ phê duyệt" | Standardizes passive waiting state across tables. |
| 28 | `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/submit-deliverable-modal.tsx`:673 | "Gửi Trưởng đơn vị duyệt" | "Gửi hồ sơ thẩm định" | Generalizes workflow target to cover both Department Heads and Board of Rectors. |

---

## 5. CONCRETE IMPLEMENTATION CHECKLIST

### Phase 1: Critical Mobile Ergonomics & Viewport Stabilization (Priority: P0)
Target Completion: Immediate

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css`**
  - Change `min-h-screen` on `body` to `min-h-[100dvh]` (Line 126).
  - Add `overscroll-behavior-y: none;` to `html` and `body` (Lines 125-130).
  - Update `.pb-safe` and `.safe-area-bottom` to `padding-bottom: env(safe-area-inset-bottom, 0px)` (Line 196).
  - Update `.pt-safe` and `.safe-area-top` to `padding-top: env(safe-area-inset-top, 0px)` (Line 202).
  - Update mobile `body` padding to `calc(64px + env(safe-area-inset-bottom, 0px))` (Line 206).
  - Add global prefers-reduced-motion block (Lines 375+):
    ```css
    @media (prefers-reduced-motion: reduce) {
      *, ::before, ::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
    ```

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/layout/app-shell.tsx`**
  - Replace `min-h-screen` with `min-h-[100dvh]` on outer wrapper and main flex container (Lines 108, 114).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/review-action-dialog.tsx`**
  - Refactor dialog wrapper from `flex items-center justify-center p-4` to `flex items-end sm:items-center justify-center sm:p-4` (Line 305).
  - Update container to `rounded-t-2xl sm:rounded-2xl max-h-[90dvh] pb-safe` (Line 307).
  - Insert mobile drag handle `<div className="sm:hidden mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-muted-foreground/30 shrink-0" />`.
  - Expand footer buttons on mobile to `w-full sm:w-auto min-h-[48px]` (Lines 551-593).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/submit-deliverable-modal.tsx`**
  - Apply identical Bottom Sheet morphing: `items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`, and `max-h-[90dvh] pb-safe` (Lines 402-411).
  - Convert action buttons to vertical stack on mobile: `flex flex-col-reverse sm:flex-row gap-2` with `min-h-[48px]` (Lines 647-678).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/hooks/use-push-notification.ts`**
  - Replace `navigator.serviceWorker.getRegistration('/sw.js')` with `navigator.serviceWorker.getRegistration('/')` (Lines 99, 159).

---

### Phase 2: Touch Ergonomics & Anti-AI Slop Purge (Priority: P1)
Target Completion: Immediate Follow-up

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/universal-action-queue.tsx`**
  - Increase button touch target from `min-h-[30px]` to `min-h-[44px] px-3.5 rounded-xl` (Lines 206, 316).
  - Remove pulsing indicator spans (`animate-pulse`) from status indicators (Lines 161, 267).
  - Standardize Lucide icon stroke width to `1.5` (Lines 222, 224, 303, 305).
  - Update copy: "Duyệt nhanh" -> "Phê duyệt", "Giao việc" -> "Phân công", "tác vụ" -> "nhiệm vụ".

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/ui/button.tsx`**
  - Delete `premium` gradient variant (`from-blue-600 to-indigo-600`) (Lines 21-22).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css`**
  - Delete `.shadow-glow-primary`, `.shadow-glow-emerald`, `.shadow-glow-amber`, `.glass-panel`, `.glass-card` (Lines 255-275).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/layout/app-topbar.tsx`**
  - Increase Bell, PWA, and Avatar touch target wrappers to `min-h-[44px] min-w-[44px]` (Lines 271, 293, 308).
  - Fix profile dropdown mobile overflow: replace `w-72` with `w-[calc(100vw-2rem)] max-w-72` (Line 339).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/layout/offline-banner.tsx`**
  - Avoid collision with `MobileBottomNav`: change `bottom-20` to `bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:bottom-6` (Line 87).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/unified-adaptive-workspace.tsx`**
  - Adjust bottom padding: change `pb-20` to `pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8` (Line 137).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/public/sw.js`**
  - Change precache installation logic from atomic `cache.addAll()` to `Promise.allSettled(PRECACHE_ASSETS.map(...))` (Lines 20-31).
  - Change push notification badge icon from 636KB `/logo-qcet.png` to monochrome transparent `/icons/badge-72x72.png` (Line 238).

---

### Phase 3: Academic Microcopy Detox & PWA Optimization (Priority: P2)
Target Completion: Standard Sprint Cycle

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/onboarding-constants.ts`**
  - Execute full string replacements per the Microcopy Detox Table (Items 10-15).
  - Replace "Radar", "Toàn Năng", "Cmd+K", and "Web Push" with formal Vietnamese administrative terms.

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/user-profile-modal.tsx`**
  - Update greeting to "Kính chào Quý Thầy/Cô..." (Line 145).
  - Update role subheadings to professional designations (Lines 281, 296, 311).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/auth/google-login-button.tsx`**
  - Update button label to "Đăng nhập bằng Email công vụ Nhà trường" (Line 107).
  - Replace "Đã copy" with "Đã sao chép" (Line 183).
  - Replace technical route text with "Tiếp tục kết nối xác thực Google" (Line 220).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/tasks/cascading-task-table.tsx`**
  - Standardize status badge labels: "Đang làm" -> "Đang thực hiện", "Cần duyệt" -> "Chờ phê duyệt" (Lines 162, 170).
  - Remove `hover:scale-105` transformation from table cells (Lines 969, 1032).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/app/manifest.ts`**
  - Declare explicit manifest fields: `scope: "/"`, `id: "/?source=pwa"`, `lang: "vi"`, `dir: "ltr"`.

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/app/layout.tsx`**
  - Remove redundant 636KB `<link rel="apple-touch-icon" href="/logo-qcet.png" />` tag (Line 75). Rely strictly on `metadata.icons.apple`.

---

### Phase 4: Polish, Rhythm & Viewport Edge Cases (Priority: P3)
Target Completion: Final Polish

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/adaptive-metric-strip.tsx`**
  - Replace `truncate` with `line-clamp-2` or `line-clamp-1` with proper leading to prevent truncated titles on 360px viewports (Lines 235-240).
  - Update copy: "Hồ sơ chờ bạn phê duyệt" -> "Hồ sơ chờ Thầy/Cô phê duyệt", "Tiến độ khoa" -> "Tiến độ đơn vị".

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/workspace/components/adaptive-scope-header.tsx`**
  - Hide the redundant top-right "Giao nhiệm vụ" button on mobile viewports (`hidden sm:inline-flex`), prioritizing the centered (+) thumb button in `MobileBottomNav` (Line 244).
  - Increase scope pill touch targets to `min-h-[44px] sm:min-h-[36px]` (Line 147).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/ui/bottom-sheet.tsx`**
  - Change `max-h-[90vh]` to `max-h-[90dvh]` to eliminate clipping by Safari's bottom address bar (Line 48).

- [ ] **`/Users/dnhhuy/Projects/QCET/QCET Work/src/components/portal/bento-portal-hub.tsx`** & **`src/components/navigation.tsx`**
  - Remove "v1.2 Enterprise" badges and `Sparkles` icon. Replace with "Niên khóa 2025-2026".