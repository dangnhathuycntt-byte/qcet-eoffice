---
status: completed
domain: architecture
created: 2026-09-08
---

# Web Performance Optimization Implementation Plan (QCET-PERF-2025-01)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triệt để giải quyết các nút thắt cổ chai về hiệu suất Web (LCP > 2.5s, INP > 200ms, TBT cao, tràn bộ nhớ GPU di động, O(N) DB sequence lock, và re-render diện rộng) theo đúng đặc tả kỹ thuật `docs/SPEC-QCET-PERF-2025-01.md`.

**Architecture:** 
1. **Frontend Rendering & CSS:** Loại bỏ GPU layer explosion (`transform: translateZ(0)`, `will-change`) trên các selector bao quát, thay thế bằng CSS utility `content-visibility: auto` và hardware-acceleration có chủ đích; Pruning Google Fonts từ 18 biến thể xuống còn 6 trọng số thiết yếu kết hợp System Monospace stack.
2. **PWA & Asset Delivery:** Tối ưu hóa Logo QCET qua dual WebP/PNG, nâng cấp Service Worker Cache v4 loại bỏ font bloat; lazy mount `MobileAppInstallModal` theo nhu cầu.
3. **State & React 19 Concurrency:** Áp dụng `useDeferredValue` cho bộ lọc tác vụ; Debounce 300ms + `AbortController` + tách biệt API count cho sổ văn bản; tách `SidebarBadgeContext` độc lập khỏi `SidebarLayoutContext` để triệt tiêu re-render layout khi có thông báo; tạo hook `useAuthRole` siêu nhẹ thay thế context nặng cho root landing.
4. **Database & API Scale:** Thay thế $O(N)$ In-Memory code generation bằng $O(1)$ Atomic Sequence table `TaskSequence` với Raw SQL upsert (`ON CONFLICT DO UPDATE`); hỗ trợ phân trang Cursor & Offset cho `/api/tasks` giữ nguyên alias tương thích ngược (`tasks`, `total`); phân trang lũy tiến 25 mục cho Department Task View.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v4 (@tailwindcss/postcss), Prisma ORM (SQLite / PostgreSQL), Service Worker API, Node.js Native Test Runner (`node:test`, `node:assert/strict`).

**Spec:** `docs/SPEC-QCET-PERF-2025-01.md`

## Global Constraints

- **Tailwind CSS v4 & Light-Only Standard:** Điểm vào duy nhất `src/app/globals.css` với `@import "tailwindcss";`. Nghiêm cấm mọi class `dark:`, khối `.dark`, hoặc logic chuyển đổi theme `useTheme`/`ThemeProvider`.
- **No `next build` during Dev:** Không chạy `next build` khi dev server đang chạy. Kiểm tra bằng `npm run typecheck` và `npm test` (`tsx --test tests/**/*.test.ts`).
- **Strict Backward Compatibility:** Toàn bộ API endpoint (`/api/tasks`, `/api/documents`) bắt buộc bảo toàn schema phản hồi cũ (như `tasks`, `total` song song với `data`, `pagination`) để không làm gãy bất kỳ frontend client hoặc bài test hiện hữu nào.
- **Concurrent React 19 Invariant:** Ưu tiên native `useDeferredValue` và state decoupling; không tự ý chèn `scheduler.yield()` rải rác trong component render cycle.
- **Anti-Slop & Professional Typography:** Không sử dụng emoji trong mã nguồn, nhãn UI, trạng thái badge; tuân thủ typographic scale và WCAG 2.1 AA.

---

# Task 1: CSS GPU Composite Layer Removal & Tailwind v4 Utility

**Files:**
- Modify: `src/app/globals.css`
- Test: `tests/theme-standardization.test.ts`

**Interfaces:**
- Input: `src/app/globals.css` chứa `* { transform: translateZ(0); }` hoặc `will-change` gây tràn bộ nhớ VRAM GPU.
- Output: Xóa bỏ composite layer cưỡng bức toàn cục. Bổ sung utility class `.content-auto` (`content-visibility: auto; contain-intrinsic-size: 1px 64px;`).

- [x] **Step 1: Write failing test**
Thêm bài test vào `tests/theme-standardization.test.ts` xác minh `src/app/globals.css` không còn chứa `transform: translateZ(0)` trên wildcard hoặc selector toàn cục, và có định nghĩa utility class `.content-auto`.

- [x] **Step 2: Implement CSS optimization**
Trong `src/app/globals.css`:
- Loại bỏ mọi khai báo `transform: translateZ(0)` hoặc `will-change: transform` áp dụng bừa bãi.
- Khai báo utility class `@utility content-auto { content-visibility: auto; contain-intrinsic-size: 1px 64px; }` (hoặc utility CSS thuần tương thích Tailwind v4).

- [x] **Step 3: Verify and run tests**
Chạy `npx tsx --test tests/theme-standardization.test.ts` và `npm run typecheck`.

---

# Task 2: Web Font Preload Pruning to 6 Weights & System Monospace

**Files:**
- Modify: `src/app/layout.tsx`
- Test: `tests/app-layout.test.ts`

**Interfaces:**
- Input: `src/app/layout.tsx` import Google Fonts với 18 font weights (Inter: 100-900; Roboto Mono: 100-700) tiêu tốn 1.8MB tải mạng và chặn render.
- Output: Giới hạn Inter chỉ còn 4 weights (`[400, 500, 600, 700]`), Roboto Mono còn 2 weights (`[400, 600]`) hoặc chuyển sang System Monospace Font Stack (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`), thêm `display: 'swap'`.

- [x] **Step 1: Write failing test**
Cập nhật `tests/app-layout.test.ts` để assert danh sách font weights của Inter chỉ có tối đa 4 trọng số, font weights của font Mono không vượt quá 2 trọng số hoặc sử dụng system monospace, và có thuộc tính `display: "swap"`.

- [x] **Step 2: Implement font optimization**
Sửa `src/app/layout.tsx`:
- Cấu hình Inter với `weight: ['400', '500', '600', '700']` và `display: 'swap'`.
- Tối ưu Roboto Mono chỉ với `weight: ['400', '600']` hoặc cấu hình font-mono chuẩn hóa.

- [x] **Step 3: Verify and run tests**
Chạy `npx tsx --test tests/app-layout.test.ts` và `npm run typecheck`.

---

# Task 3: Dual-Logo WebP/PNG Asset & Service Worker Cache v4

**Files:**
- Create: `public/logo-qcet.webp`
- Modify: `public/sw.js`
- Test: `tests/service-worker-manifest.test.ts`

**Interfaces:**
- Input: `public/sw.js` cache danh sách tài nguyên nặng phiên bản cũ (`qcet-cache-v3`), thiếu asset WebP nhẹ.
- Output: Tạo `public/logo-qcet.webp` (kích thước < 20KB so với PNG 132KB), cập nhật `CACHE_NAME = 'qcet-cache-v4'` trong `public/sw.js`, đưa `logo-qcet.webp` vào danh sách pre-cache và xóa cache cũ `qcet-cache-v3`.

- [x] **Step 1: Create WebP logo asset**
Sử dụng công cụ chuyển đổi hoặc sharp/canvas để tạo `public/logo-qcet.webp` từ `public/logo-qcet.png`.

- [x] **Step 2: Write failing test**
Tạo hoặc cập nhật `tests/service-worker-manifest.test.ts` kiểm tra `public/sw.js` chứa cache name `qcet-cache-v4` và pre-cache `logo-qcet.webp`.

- [x] **Step 3: Update `public/sw.js`**
Cập nhật `public/sw.js`:
- `CACHE_NAME = 'qcet-cache-v4'`
- Danh sách URL pre-cache có `/logo-qcet.webp`
- Tự động xóa `qcet-cache-v3` khi activate.

- [x] **Step 4: Verify and run tests**
Chạy `npx tsx --test tests/service-worker-manifest.test.ts` và `npm run typecheck`.

---

# Task 4: React 19 `useDeferredValue` for Task Filtering

**Files:**
- Modify: `src/hooks/use-task-filters.ts`
- Test: `tests/use-task-filters-performance.test.ts`

**Interfaces:**
- Input: `useTaskFilters` thực hiện filter đồng bộ mỗi keystroke trên danh sách tác vụ lớn gây giật lag và giảm INP (Interaction to Next Paint).
- Output: Sử dụng `useDeferredValue` của React 19 để trì hoãn chuỗi tìm kiếm (`deferredSearch`), tách biệt input tức thì của người dùng với phép tính lọc dữ liệu, xuất `isPending` / `isStale` flag.

- [x] **Step 1: Write unit test**
Viết `tests/use-task-filters-performance.test.ts` kiểm tra `useTaskFilters` hỗ trợ lọc mượt mà, trả về `isStale` hoặc xử lý deferred search chính xác mà không làm sai lệch kết quả lọc hiện có.

- [x] **Step 2: Implement deferred value in `src/hooks/use-task-filters.ts`**
Cập nhật `src/hooks/use-task-filters.ts`:
- Import `useDeferredValue` từ React.
- Tạo `deferredSearch = useDeferredValue(filters.search)`.
- Áp dụng `deferredSearch` trong phép tính `useMemo` lọc danh sách tác vụ.
- Xuất cờ `isFilteringStale = filters.search !== deferredSearch`.

- [x] **Step 3: Verify and run tests**
Chạy `npx tsx --test tests/use-task-filters-performance.test.ts` và các test hiện có `tests/dashboard-subhooks-logic.test.ts`.

---

# Task 5: Search Debounce 300ms, AbortController & Stats Decoupling

**Files:**
- Modify: `src/components/documents/document-registry-view.tsx`
- Test: `tests/document-registry-performance.test.ts`

**Interfaces:**
- Input: `DocumentRegistryView` kích hoạt API call `/api/documents` liên tục ngay khi gõ phím mà không có debounce, không hủy request cũ, và fetch toàn bộ danh sách chỉ để đếm số lượng thống kê.
- Output: Triển khai debounce 300ms cho input tìm kiếm, tích hợp `AbortController` hủy bỏ request cũ khi có request m���i, và tối ưu hóa việc lấy số liệu thống kê.

- [x] **Step 1: Write test**
Tạo `tests/document-registry-performance.test.ts` kiểm tra mã nguồn `document-registry-view.tsx` có debounce, có xử lý signal/AbortController khi fetch documents, và không bị race condition khi tìm kiếm nhanh.

- [x] **Step 2: Refactor `src/components/documents/document-registry-view.tsx`**
Áp dụng:
- Debounce 300ms cho `searchQuery`.
- `AbortController` trong `useEffect` fetch data.
- Xử lý `DOMException (AbortError)` nhẹ nhàng không set error state.

- [x] **Step 3: Verify and run tests**
Chạy `npx tsx --test tests/document-registry-performance.test.ts` và `npm run typecheck`.

---

# Task 6: Conditional On-Demand Mount for `MobileAppInstallModal`

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Test: `tests/app-shell-performance.test.ts`

**Interfaces:**
- Input: `MobileAppInstallModal` luôn luôn được render vào DOM cây dù modal đang ở trạng thái ẩn (`isOpen === false`), gây lãng phí bộ nhớ DOM và hydration cost.
- Output: Thay thế việc render ngầm bằng conditional rendering `{showInstallModal && <MobileAppInstallModal ... />}` hoặc React 19 lazy dynamic import `next/dynamic` với `ssr: false`.

- [x] **Step 1: Write test**
Viết `tests/app-shell-performance.test.ts` xác minh `MobileAppInstallModal` chỉ mount vào DOM khi người dùng kích hoạt mở hoặc khi cờ hiển thị là `true`.

- [x] **Step 2: Update `src/components/layout/app-shell.tsx`**
Cập nhật `app-shell.tsx` để mount `MobileAppInstallModal` theo điều kiện (on-demand mount).

- [x] **Step 3: Verify and run tests**
Chạy `npx tsx --test tests/app-shell-performance.test.ts` và `npm run typecheck`.

---

# Task 7: Atomic $O(1)$ Task Code Generator & Sequence Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/task-code-generator.ts`
- Modify: `src/app/api/tasks/route.ts`
- Test: `tests/task-code-generator.test.ts`

**Interfaces:**
- Input: Hàm tạo mã công việc `generateTaskCode` hiện tại quét `findMany` toàn bộ bảng `Task` trong năm, sort in-memory rồi tính sequence tiếp theo -> $O(N)$ CPU & RAM, nguy cơ race condition trùng mã khi có nhiều request đồng thời.
- Output: Tạo model `TaskSequence` trong `prisma/schema.prisma` (`year Int`, `scope String`, `departmentCode String`, `lastValue Int`, `@id([year, scope, departmentCode])`). Xây dựng `generateTaskCodeAtomic(prisma, { scope, departmentCode, year })` sử dụng raw upsert atomic $O(1)$. Tích hợp vào `src/app/api/tasks/route.ts`.

- [x] **Step 1: Update `prisma/schema.prisma`**
Thêm model `TaskSequence`:
```prisma
model TaskSequence {
  year           Int
  scope          String
  departmentCode String
  lastValue      Int      @default(0)
  updatedAt      DateTime @updatedAt

  @@id([year, scope, departmentCode])
}
```
Chạy `npx prisma db push` hoặc cập nhật database client.

- [x] **Step 2: Write test for atomic generator**
Viết `tests/task-code-generator.test.ts` kiểm thử việc sinh mã tuần tự liên tiếp, concurrency check (đảm bảo không bị trùng mã khi gọi đồng thời 10 lần), và format chuẩn `CV-{DEPT}-{YEAR}-{SEQ}`.

- [x] **Step 3: Implement `src/lib/task-code-generator.ts`**
Viết hàm `generateTaskCodeAtomic`:
- Sử dụng Prisma transaction hoặc raw SQLite `INSERT INTO TaskSequence ... ON CONFLICT DO UPDATE SET lastValue = lastValue + 1 RETURNING lastValue;`
- Fallback an toàn nếu chưa có bản ghi.

- [x] **Step 4: Integrate into `src/app/api/tasks/route.ts`**
Thay thế logic tìm max mã công việc cũ trong POST `/api/tasks` bằng `generateTaskCodeAtomic`.

- [x] **Step 5: Verify and run tests**
Chạy `npx tsx --test tests/task-code-generator.test.ts` và `npm run typecheck`.

---

# Task 8: Decouple `SidebarLayoutContext` & `SidebarBadgeContext`

**Files:**
- Modify: `src/components/layout/sidebar-context.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Test: `tests/sidebar-context-isolation.test.ts`

**Interfaces:**
- Input: `SidebarContext` gộp chung cả trạng thái layout (isCollapsed, isMobileOpen) và badge count (unreadNotifications, pendingTasks, unreadChats). Mỗi khi số thông báo thay đổi (polling hoặc websocket/push), toàn bộ Sidebar và AppShell re-render.
- Output: Tách thành 2 context độc lập: `SidebarLayoutContext` (quản lý collapsed/mobile state) và `SidebarBadgeContext` (quản lý các chỉ số badge đếm số lượng).

- [x] **Step 1: Write test**
Tạo `tests/sidebar-context-isolation.test.ts` xác thực rằng component tiêu thụ `SidebarLayoutContext` không re-render khi `SidebarBadgeContext` cập nhật giá trị.

- [x] **Step 2: Refactor `src/components/layout/sidebar-context.tsx`**
Tách thành:
- `SidebarLayoutProvider` và hook `useSidebarLayout()`.
- `SidebarBadgeProvider` và hook `useSidebarBadges()`.
- Giữ lại hook `useSidebar()` bọc cả hai để tương thích ngược hoàn toàn với code cũ.

- [x] **Step 3: Update `src/components/layout/app-shell.tsx`**
Cập nhật `app-shell.tsx` để cung cấp cả hai provider.

- [x] **Step 4: Verify and run tests**
Chạy `npx tsx --test tests/sidebar-context-isolation.test.ts` và `npm run typecheck`.

---

# Task 9: Lightweight Role Flag Resolution Hook

**Files:**
- Create: `src/hooks/use-auth-role.ts`
- Modify: `src/app/page.tsx`
- Test: `tests/auth-role-isolation.test.ts`

**Interfaces:**
- Input: `src/app/page.tsx` import toàn bộ `useClientAuth` hoặc `useWorkspaceContext` cồng kềnh với hàng chục helper functions chỉ để kiểm tra 1 role flag chuyển hướng (isBGH, isLeader, isLecturer).
- Output: Tạo hook `useAuthRole` siêu nhẹ, chỉ trích xuất role và tính toán các boolean flags cơ bản (`isBGH`, `isLeader`, `isLecturer`, `isAdmin`) mà không đăng ký lắng nghe các state tác vụ nặng.

- [x] **Step 1: Write test**
Tạo `tests/auth-role-isolation.test.ts` kiểm thử các trường hợp chuyển hướng theo role của `useAuthRole`.

- [x] **Step 2: Implement `src/hooks/use-auth-role.ts`**
Cung cấp hook `useAuthRole()` trả về: `{ role, isBGH, isDepartmentHead, isLecturer, isAdmin, isReady }`.

- [x] **Step 3: Update `src/app/page.tsx`**
Sử dụng `useAuthRole` trong `src/app/page.tsx` để tối ưu thời gian First Contentful Paint (FCP).

- [x] **Step 4: Verify and run tests**
Chạy `npx tsx --test tests/auth-role-isolation.test.ts` và `npm run typecheck`.

---

# Task 10: Task API Pagination with Backward-Compatible Aliases & Cascade Delete

**Files:**
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/tasks/[id]/route.ts`
- Test: `tests/tasks-api-performance.test.ts`

**Interfaces:**
- Input: GET `/api/tasks` fetch toàn bộ tác vụ từ DB mà không có giới hạn phân trang mặc định; DELETE `/api/tasks/[id]` thiếu cascade clean up rõ ràng gây lỗi foreign key constraint.
- Output: Thêm phân trang `page` & `limit` (mặc định limit 50, tối đa 200), trả về dữ liệu chuẩn `{ success: true, data: tasks, pagination: { total, page, limit, totalPages }, tasks, total }` (bảo toàn alias `tasks` và `total` để không phá vỡ bất kỳ client/test nào). Hoàn thiện DELETE cascade an toàn.

- [x] **Step 1: Write test**
Tạo `tests/tasks-api-performance.test.ts` kiểm tra phân trang limit/page, kiểm tra các alias tương thích ngược `body.tasks` và `body.total`, và kiểm tra cascade delete.

- [x] **Step 2: Update `src/app/api/tasks/route.ts`**
Bổ sung:
- Phân trang trong GET: `const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));`
- `const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));`
- Response trả về cả `data`, `pagination`, và các alias `tasks`, `total`.

- [x] **Step 3: Verify and run tests**
Chạy `npx tsx --test tests/tasks-api-performance.test.ts`, `npx tsx --test tests/tasks-api-route.test.ts` và `npm run typecheck`.

---

# Task 11: Department Task View Progressive Local Pagination & `content-visibility: auto`

**Files:**
- Modify: `src/components/dashboard/department-grouped-task-view.tsx`
- Test: `tests/department-view-dom-performance.test.ts`

**Interfaces:**
- Input: `DepartmentGroupedTaskView` render toàn bộ hàng trăm công việc vào cây DOM một lúc, khiến DOM node count vượt quá 3.000 nodes và gây lag cuộn trang trên trình duyệt điện thoại.
- Output: Áp dụng phân trang lũy tiến local (hiển thị 25 items ban đầu + nút "Xem thêm 25 công việc" hoặc infinite scroll) kết hợp CSS class `.content-auto` (`content-visibility: auto`) cho từng nhóm phòng ban.

- [x] **Step 1: Write test**
Tạo `tests/department-view-dom-performance.test.ts` kiểm tra `DepartmentGroupedTaskView` cắt giảm số DOM node hiển thị ban đầu xuống 25 items mỗi phòng ban và chứa class `.content-auto`.

- [x] **Step 2: Update `src/components/dashboard/department-grouped-task-view.tsx`**
Cập nhật component với:
- State phân trang local per-department (mặc định 25 items).
- Nút "Xem thêm ... công việc" hiển thị số lượng còn lại.
- Thêm class `.content-auto` vào container card của từng nhóm công việc.

- [x] **Step 3: Verify and run tests**
Chạy `npx tsx --test tests/department-view-dom-performance.test.ts` và `npm run typecheck`.

---

## Final Health & Verification Gate
- [x] `npm run typecheck` - 0 TypeScript errors.
- [x] `npm test` - 100% test suites pass.
- [x] Verification checklist against `docs/SPEC-QCET-PERF-2025-01.md`.
