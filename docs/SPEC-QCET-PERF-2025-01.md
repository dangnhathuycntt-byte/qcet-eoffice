---
status: completed
domain: architecture
created: 2026-09-08
---

# TÀI LIỆU ĐẶC TẢ KỸ THUẬT & KẾ HOẠCH TRIỂN KHAI TỐI ƯU HÓA HIỆU NĂNG WEB (TECHNICAL SPECIFICATION)

**Dự án**: Hệ thống Điều hành Tác nghiệp Điện tử QCET E-Office  
**Mã tài liệu**: SPEC-QCET-PERF-2025-01  
**Phiên bản**: 1.0 (Trình duyệt thực thi)  
**Cơ quan ban hành**: Ban Kỹ thuật & Hội đồng Kiến trúc Hệ thống QCET  
**Ngày ban hành**: 2026-09-08  
**Tình trạng phê duyệt**: Phê duyệt chính thức theo Quyết định Thẩm định Kỹ thuật số 01/QĐ-TĐKT  

---

## 1. THÔNG TIN CHUNG & QUY CHUẨN KỸ THUẬT

### 1.1. Bối cảnh & Mục tiêu Hiệu năng (Service Level Agreement - SLA)
Hệ thống QCET E-Office phục vụ quản trị điều hành, quản lý nhiệm vụ, giám sát KPI và lưu trữ văn bản hành chính cho Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn. Với việc mở rộng dữ liệu tác nghiệp lên hàng ngàn đầu việc và văn bản mỗi năm học, hệ thống gặp các điểm nghẽn hiệu năng:
- Render waterfall tại layout chính do context notification badge gây re-render toàn bộ AppShell.
- Gõ từ khóa tìm kiếm kích hoạt re-render đồng bộ trên Main Thread làm đơ giao diện.
- Tải bundle dư thừa do nạp trước thư viện tạo mã QR khi chưa mở modal.
- Tranh chấp mã số nhiệm vụ khi nhiều đơn vị tạo việc cùng thời điểm (Prisma Error P2002).
- DOM tree phình to vượt quá 3.000 nodes khi mở rộng accordion danh sách phòng ban.

**Chỉ số SLA Core Web Vitals mục tiêu (đo lường trên thiết bị di động cấu hình trung bình và mạng 4G/Wifi tiêu chuẩn):**
- **Interaction to Next Paint (INP)**: Nhỏ hơn hoặc bằng 50ms (ngưỡng xuất sắc của Google là <200ms; mục tiêu nội bộ cho thao tác gõ phím/lọc là <12ms).
- **Largest Contentful Paint (LCP)**: Nhỏ hơn hoặc bằng 1.2s trên mạng băng thông rộng và <1.8s trên 4G.
- **Cumulative Layout Shift (CLS)**: Tuyệt đối bằng 0.00 (không dịch chuyển layout khi load font, render badge hoặc mount modal).
- **Time to First Byte (TTFB)**: Nhỏ hơn hoặc bằng 120ms đối với API `/api/tasks` và `/api/documents`.
- **Dung lượng DOM Tree**: Nhỏ hơn 800 DOM nodes ở trạng thái mở rộng toàn bộ danh sách phòng ban.
- **Total Blocking Time (TBT)**: Nhỏ hơn 50ms trong toàn bộ chu kỳ khởi tạo trang chủ.

### 1.2. Nguyên tắc Tuân thủ Kỹ thuật (CLAUDE.md & Architecture Governance)
Mọi can thiệp mã nguồn trong tài liệu này bắt buộc tuân thủ 5 nguyên tắc nền tảng:
1. **Tiêu chuẩn Giao diện Light-Only (OKLCH Color Space)**:
   - Hệ thống vận hành thuần túy trên Light Mode chuẩn công sở hành chính giáo dục.
   - Tuyệt đối không thêm class `dark:`, không bổ sung khối CSS `.dark`, không sử dụng hook `useTheme` hoặc bọc `ThemeProvider`.
   - Vô hiệu hóa biến thể dark mode được khóa chặt qua chỉ thị `@custom-variant dark (&:not(*));` tại `/Users/dnhhuy/Projects/QCET/QCET Work/src/app/globals.css`.
2. **Kỷ luật Cache Build & Tránh Nhiễm độc Dev Server (Zero Dev Cache Poisoning)**:
   - Trong quá trình phát triển khi dev server đang chạy cổng 3001, tuyệt đối không chạy lệnh `next build`.
   - Mọi kiểm thử tính đúng đắn và type safety chỉ được sử dụng:
     ```bash
     npm run typecheck
     npm test
     ```
3. **Quy chuẩn Anti-Slop (Không Emoji)**:
   - Toàn bộ codebase (code, UI label, badge, thông báo lỗi, icon) không sử dụng ký tự emoji. Mọi chỉ báo trạng thái phải sử dụng vector icon chuẩn từ gói `lucide-react` hoặc CSS indicators.
4. **Tương thích Ngược Tuyệt đối (Strict Backward Compatibility)**:
   - Mọi thay đổi cấu trúc dữ liệu trả về từ REST API phải bảo toàn các trường cũ (legacy aliases) để không làm gãy các client/component hiện hữu.
   - Các API context hook phải cung cấp adapter/facade để các component chưa kịp cập nhật vẫn hoạt động ổn định.
5. **Atomic Database Operations**:
   - Không sử dụng vòng lặp kiểm tra trùng mã `while (findUnique)`. Mọi thao tác sinh số thứ tự phải dùng atomic increment cấp độ database engine thông qua Prisma Client.

---

## 2. KIẾN TRÚC & ĐẶC TẢ CHI TIẾT TỪNG PHÂN HỆ

### 2.1. Phân hệ 1: Frontend State & Re-render Isolation

#### 2.1.1. Tách biệt Ngữ cảnh Điều hướng và Badge (`sidebar-context.tsx`)
- **Vấn đề**: `SidebarContext` hiện tại gộp chung trạng thái co giãn menu (`isCollapsed`, `isMobileOpen`, `currentModule`) với bộ đếm thông báo (`badgeCounts`). Khi service worker hoặc polling cập nhật số thông báo mới, toàn bộ component con tiêu thụ `useSidebar()`—bao gồm cả khung sườn layout `AppShellInner`—bị kích hoạt re-render không cần thiết.
- **Giải pháp**:
  - Tách thành 2 Context độc lập: `SidebarLayoutContext` (quản lý trạng thái khung layout) và `SidebarBadgeContext` (quản lý số lượng badge thông báo).
  - Cung cấp hook chuyên biệt `useSidebarLayout()` cho `AppShellInner`, `AppSidebar`, `AppTopbar`.
  - Cung cấp hook `useSidebarBadges()` cho các thành phần hiển thị số đếm.
  - Giữ lại hook tổng hợp `useSidebar()` làm facade tương thích ngược cho các màn hình phụ.

#### 2.1.2. Phân rã Vai trò Người dùng Siêu nhẹ (`auth-context.tsx`)
- **Vấn đề**: Các component kiểm tra quyền hạn thường gọi `const { user } = useAuth()`. Khi đối tượng `user` thay đổi các trường không liên quan đến vai trò (ví dụ cập nhật `avatarUrl`, `phone`, `onboardingData`), các khối logic phân quyền trên trang chủ bị re-render đồng loạt.
- **Giải pháp**:
  - Định nghĩa kiểu dữ liệu chuẩn hóa `UserRoleFlags`:
    ```typescript
    export interface UserRoleFlags {
      role: UserRole;
      isBGH: boolean;
      isDean: boolean;
      isStaff: boolean;
      isAdmin: boolean;
      departmentId: string;
    }
    ```
  - Cung cấp hàm chuyển đổi thuần túy `resolveRoleFlags(user: AuthUser | null): UserRoleFlags`.
  - Cung cấp hook chuyên biệt `useAuthRole()` trả về cờ vai trò được memoize sâu, ngăn chặn kích hoạt re-render ngoài ý muốn.

#### 2.1.3. Trì hoãn Tính toán Lọc Nhiệm vụ (`use-task-filters.ts`)
- **Vấn đề**: Khi người dùng gõ từ khóa tìm kiếm nhiệm vụ trong `UnifiedTaskToolbar`, giá trị `searchQuery` lập tức kích hoạt hàm tính toán `filterTasksHub()` trên mảng dữ liệu lớn, làm nghẽn Main Thread và gây trễ gõ phím (INP > 150ms).
- **Giải pháp**:
  - Tích hợp hook primitive `useDeferredValue` của React 19 vào `useTaskFilters`:
    ```typescript
    const deferredSearchQuery = React.useDeferredValue(searchQuery);
    ```
  - `filteredTasks` phụ thuộc vào `deferredSearchQuery`. Input text phản hồi ngay lập tức (<12ms), trong khi tác vụ lọc dữ liệu được Main Thread thực hiện khi rảnh.
  - Xuất thêm cờ `isFilteringDeferred: searchQuery !== deferredSearchQuery` để hiển thị spinner nhẹ nhàng khi đang xử lý danh sách lớn.

---

### 2.2. Phân hệ 2: Asset, Bundle & CSS Optimization

#### 2.2.1. Chuyển đổi và Tối ưu Định dạng Hình ảnh
- **Vấn đề**: File `/logo-qcet.png` dung lượng gốc lớn, đồng thời tồn tại file trùng lặp `qcet-logo.png`. Việc tải file PNG nặng làm chậm chỉ số LCP.
- **Giải pháp**:
  - Chuyển đổi logo trường sang định dạng WebP hiện đại: `/logo-qcet.webp` (chất lượng 90%, nén lossless/near-lossless, giảm >75% dung lượng).
  - Nén tối ưu tệp `/logo-qcet.png` hiện hữu xuống mức tối thiểu (dưới 35KB) nhằm đảm bảo tương thích các thiết bị cũ không hỗ trợ WebP và đáp ứng test suite `tests/service-worker-manifest.test.ts`.
  - Xóa bỏ tệp dư thừa không sử dụng `/qcet-logo.png`.

#### 2.2.2. Nâng cấp Service Worker Cache v4 (`public/sw.js`)
- **Vấn đề**: Khác biệt giữa danh sách precache và các assertion kiểm thử tự động; cần đảm bảo cache hỗ trợ cả WebP mới và PNG tương thích ngược.
- **Giải pháp**:
  - Nâng cấp `CACHE_NAME` lên `qcet-eoffice-v4`.
  - Khai báo song song `/logo-qcet.webp` và `/logo-qcet.png` trong mảng `PRECACHE_ASSETS`.

#### 2.2.3. Loại bỏ Composite Layer Dư thừa trên GPU (`src/app/globals.css`)
- **Vấn đề**: Khối `body::before` trong `globals.css` chứa:
  ```css
  transform: translateZ(0);
  will-change: transform;
  ```
  Hai thuộc tính này ép trình duyệt tạo một Graphics Layer riêng biệt có kích thước bằng toàn bộ màn hình viewport. Trên màn hình Retina 4K/2K của macOS hoặc màn hình điện thoại mật độ điểm ảnh cao, layer này chiếm dụng từ 15MB đến 35MB VRAM GPU một cách vô ích vì background là tĩnh.
- **Giải pháp**:
  - Loại bỏ hoàn toàn `transform: translateZ(0)` và `will-change: transform` khỏi khối `body::before`.
  - Định nghĩa font-family system monospace cho biến `--font-mono` thay vì phụ thuộc web font bên ngoài.
  - Định nghĩa utility class `@utility content-visibility-auto` chuẩn cú pháp Tailwind CSS v4.

#### 2.2.4. Cắt giảm Trọng số Font Chữ (`src/app/layout.tsx`)
- **Vấn đề**: `layout.tsx` đang nạp đồng thời 12 file font woff2:
  - `Be_Vietnam_Pro`: 6 trọng số (300, 400, 500, 600, 700, 800).
  - `Plus_Jakarta_Sans`: 3 trọng số (600, 700, 800).
  - `JetBrains_Mono`: 3 trọng số (400, 500, 600).
  Tổng dung lượng font nạp vào khởi đầu vượt quá 220KB và phát sinh 12 HTTP requests.
- **Giải pháp**:
  - Tinh giản `Be_Vietnam_Pro` xuống còn 4 trọng số thiết yếu: `["400", "500", "600", "700"]`.
  - Tinh giản `Plus_Jakarta_Sans` xuống còn 2 trọng số tiêu đề: `["600", "700"]`.
  - Loại bỏ hoàn toàn việc tải web font `JetBrains_Mono`. Chuyển biến `--font-mono` sang sử dụng System Monospace Font Stack (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`).
  - Giảm số lượng request font từ 12 xuống còn 6 requests, tiết kiệm ~130KB payload khởi đầu và triệt tiêu nguy cơ FOIT/FOUT.

#### 2.2.5. Lazy Loading On-Demand cho Modal Cài đặt App (`src/components/layout/app-shell.tsx`)
- **Vấn đề**: `MobileAppInstallModal` được bọc `next/dynamic` với `ssr: false`, tuy nhiên vẫn được render trực tiếp vào cây component của `AppShellInner`. Do đó, chunk JavaScript chứa thư viện mã QR (`qrcode`) nặng ~65KB vẫn được trình duyệt tải về ngay khi tải trang chủ.
- **Giải pháp**:
  - Chuyển `MobileAppInstallModal` sang chế độ conditional rendering: chỉ mount component vào DOM khi có yêu cầu mở modal thông qua Custom Event `qcet:open-install-modal` hoặc tương tác từ người dùng.
  - Trình duyệt chỉ nạp chunk QR Code khi người dùng thực sự bấm vào nút cài đặt ứng dụng.

---

### 2.3. Phân hệ 3: API & Database Performance

#### 2.3.1. Debounce 300ms và Tách rời Thống kê tại Sổ Văn bản (`document-registry-view.tsx`)
- **Vấn đề**: Component đang chạy `useEffect` kích hoạt đồng thời cả `fetchDocuments()` và `fetchStats()` mỗi khi `searchQuery` thay đổi. Khi người dùng nhập một chuỗi gồm 18 ký tự, hệ thống phát sinh 36 request HTTP đồng thời đến backend, gây lãng phí tài nguyên máy chủ và nghẽn network queue.
- **Giải pháp**:
  - Tách rời hàm `fetchStats()`: chỉ thực thi một lần khi component mount hoặc khi chuyển tab phân loại văn bản.
  - Áp dụng cơ chế debounce 300ms cho tham số tìm kiếm trước khi gọi `fetchDocuments()`.
  - Bổ sung `AbortController` để hủy bỏ (abort) ngay lập tức các request trước đó nếu có request mới phát sinh, ngăn ngừa tình trạng Race Condition khi kết quả của request chậm ghi đè lên kết quả mới nhất.

#### 2.3.2. Thuật toán Sinh Mã Nhiệm vụ O(1) Độc quyền Cấp Database (`task-code-generator.ts`)
- **Vấn đề**: Đoạn mã tạo mã nhiệm vụ trong `src/app/api/tasks/route.ts`:
  ```typescript
  const count = await prisma.task.count({ where: { academicMonth, academicYear } });
  let seq = count + 1;
  let code = `NV-...`;
  while (await prisma.task.findUnique({ where: { code } })) { seq++; code = `NV-...`; }
  ```
  Đây là thuật toán có độ phức tạp O(N) với N là số lần xung đột. Khi có từ 2 giao dịch tạo task đồng thời, cơ chế này gây xung đột khóa duy nhất (Unique Constraint Violation P2002) và làm nghẽn I/O database.
- **Giải pháp**:
  - Thêm model `TaskSequence` vào `/Users/dnhhuy/Projects/QCET/QCET Work/prisma/schema.prisma`:
    ```prisma
    model TaskSequence {
      sequenceKey  String   @id
      currentValue Int      @default(0)
      updatedAt    DateTime @updatedAt

      @@map("task_sequences")
    }
    ```
  - Viết module `/Users/dnhhuy/Projects/QCET/QCET Work/src/lib/task-code-generator.ts` sử dụng hàm `upsert` atomic của Prisma:
    ```typescript
    export async function generateTaskCode(
      tx: Prisma.TransactionClient,
      year: number,
      month: number
    ): Promise<string> {
      const sequenceKey = `TASK_${year}_${String(month).padStart(2, '0')}`;
      const seq = await tx.taskSequence.upsert({
        where: { sequenceKey },
        create: { sequenceKey, currentValue: 1 },
        update: { currentValue: { increment: 1 } },
      });
      return `NV-${year}-${String(month).padStart(2, '0')}-${String(seq.currentValue).padStart(3, '0')}`;
    }
    ```
  - Độ phức tạp đạt O(1) tuyệt đối, vận hành hoàn toàn an toàn trong môi trường chịu tải đồng thời cao.

#### 2.3.3. Phân trang và Bảo toàn Hợp đồng Dữ liệu tại `GET /api/tasks`
- **Vấn đề**: Endpoint `/api/tasks` nạp toàn bộ danh sách task trong cơ sở dữ liệu lên bộ nhớ mà không có giới hạn `limit/skip`.
- **Giải pháp**:
  - Bổ sung tham số phân trang chuẩn: `page` (mặc định 1), `limit` (mặc định 50, tối đa 200).
  - Áp dụng `prisma.$transaction` để truy vấn song song `findMany` (với `take` và `skip`) cùng `prisma.task.count()`.
  - **Bắt buộc tuân thủ hợp đồng dữ liệu**: Payload trả về chứa cả các khóa chuẩn hóa mới và các bí danh tương thích ngược:
    ```typescript
    return NextResponse.json({
      success: true,
      data: formattedTasks,
      tasks: formattedTasks, // Alias tương thích ngược bắt buộc
      totalCount,
      total: totalCount,     // Alias tương thích ngược bắt buộc
      page,
      limit,
      hasMore: skip + formattedTasks.length < totalCount,
    });
    ```

#### 2.3.4. Bảo toàn Toàn vẹn Nghiệp vụ tại `DELETE /api/tasks/[id]`
- **Vấn đề**: Rủi ro mất mát method `DELETE` khi tái cấu trúc file `src/app/api/tasks/[id]/route.ts` dẫn tới lỗi 405 Method Not Allowed và làm rò rỉ dữ liệu quan hệ liên kết.
- **Giải pháp**:
  - Giữ nguyên và củng cố phương thức `DELETE` trong transaction an toàn:
    1. Hủy liên kết văn bản: `tx.document.updateMany({ where: { linkedTaskId: id }, data: { linkedTaskId: null } })`.
    2. Xóa cascade các bản ghi liên quan: `taskAssignee`, `taskDeliverable`, `dacumDelegation`, `executiveResolution`.
    3. Xóa bản ghi chính: `tx.task.delete({ where: { id } })`.
  - Đối với `GET /api/tasks/[id]`, trả về cả `task` và `data` chứa thông tin nhiệm vụ đã chuyển đổi.

---

### 2.4. Phân hệ 4: DOM Rendering & Accordion Optimization

#### 2.4.1. Phân trang Nội bộ Đệm (Local Progressive Pagination)
- **Vấn đề**: Tại component `/Users/dnhhuy/Projects/QCET/QCET Work/src/components/dashboard/department-grouped-task-view.tsx`, khi Ban Giám hiệu chọn "Mở rộng tất cả" 11 phòng ban, nếu mỗi phòng ban có từ 30 đến 50 nhiệm vụ, hơn 3.500 DOM elements (table rows, badges, buttons, tooltips) được tạo lập cùng một lúc, gây giật khung hình nghiêm trọng (Frame Drop > 400ms).
- **Giải pháp**:
  - Thiết lập trạng thái hiển thị lũy tiến theo từng đơn vị: `visibleCounts: Record<string, number>`.
  - Mỗi khi mở rộng accordion, số lượng item hiển thị ban đầu được giới hạn ở mức 5 items.
  - Nếu tổng số việc lớn hơn 5, hiển thị thanh điều khiển tinh gọn "Xem thêm 5 việc (còn lại N việc)" hoặc "Hiển thị toàn bộ".
  - Giảm ngay lập tức số lượng node khởi tạo ban đầu xuống dưới 400 nodes.

#### 2.4.2. Ứng dụng CSS `content-visibility: auto` Chuẩn Tailwind CSS v4
- **Vấn đề**: Các hàng bảng (`<tr>`) nằm ngoài khung nhìn (off-screen) vẫn bị trình duyệt tính toán Layout và Paint đầy đủ.
- **Giải pháp**:
  - Bổ sung chỉ thị tiện ích Tailwind v4 vào `src/app/globals.css`:
    ```css
    @utility content-visibility-auto {
      content-visibility: auto;
      contain-intrinsic-size: 0 52px;
    }
    ```
  - Gắn class `content-visibility-auto` vào từng hàng `<tr>` trong danh sách nhiệm vụ.
  - Trình duyệt sẽ bỏ qua toàn bộ công đoạn tính toán kích thước và vẽ pixel của các hàng nằm ngoài màn hình cuộn, giải phóng hơn 70% CPU time của Main Thread khi cuộn trang.

---

## 3. MA TRẬN PHÂN CÔNG & THỨ TỰ TRIỂN KHAI (PHASED EXECUTION PLAN)

### 3.1. Phase 1: P0 Quick Wins (Ngày 1 - Ngày 2) - Triển khai Ngay
Mục tiêu: Đạt hiệu quả giải phóng VRAM GPU, tối ưu kích thước bundle, chuẩn hóa font và dập tắt lỗi spam API mà không làm thay đổi kiến trúc cốt lõi.

#### File Diff 1.1: Tối ưu Composite Layer GPU & Khai báo Utility (`src/app/globals.css`)
```diff
--- a/src/app/globals.css
+++ b/src/app/globals.css
@@ -10,7 +10,7 @@
   --color-foreground: var(--foreground);
   --font-sans: var(--font-sans);
-  --font-mono: var(--font-mono);
+  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
   --font-heading: var(--font-heading);
   --color-sidebar-ring: var(--sidebar-ring);
   --color-sidebar-border: var(--sidebar-border);
@@ -135,8 +135,11 @@
     background-image:
       radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.03) 0px, transparent 40%),
       radial-gradient(at 100% 100%, rgba(37, 99, 235, 0.02) 0px, transparent 40%);
-    transform: translateZ(0);
-    will-change: transform;
   }
 }
+
+@utility content-visibility-auto {
+  content-visibility: auto;
+  contain-intrinsic-size: 0 52px;
+}
```

#### File Diff 1.2: Tinh giản Web Font Requests (`src/app/layout.tsx`)
```diff
--- a/src/app/layout.tsx
+++ b/src/app/layout.tsx
@@ -1,6 +1,6 @@
 import type { Metadata, Viewport } from "next";
-import { Be_Vietnam_Pro, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
+import { Be_Vietnam_Pro, Plus_Jakarta_Sans } from "next/font/google";
 import "./globals.css";
 import { AuthProvider } from "@/lib/auth-context";
 import { DisplayDensityProvider } from "@/components/density-provider";
@@ -8,22 +8,15 @@
 const fontSans = Be_Vietnam_Pro({
   variable: "--font-sans",
   subsets: ["latin", "vietnamese"],
-  weight: ["300", "400", "500", "600", "700", "800"],
+  weight: ["400", "500", "600", "700"],
   fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
   display: "swap",
 });
 
 const fontHeading = Plus_Jakarta_Sans({
   variable: "--font-heading",
   subsets: ["latin", "vietnamese"],
-  weight: ["600", "700", "800"],
-  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
-  display: "swap",
-});
-
-const fontMono = JetBrains_Mono({
-  variable: "--font-mono",
-  subsets: ["latin"],
-  weight: ["400", "500", "600"],
-  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
+  weight: ["600", "700"],
   fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
   display: "swap",
 });
```

#### File Diff 1.3: Nâng cấp Cache v4 và Precache Song song WebP/PNG (`public/sw.js`)
```diff
--- a/public/sw.js
+++ b/public/sw.js
@@ -1,7 +1,7 @@
 // QCET E-Office Service Worker
-// Version: 2.0.0 - Unified Mobile PWA Modernization
+// Version: 2.1.0 - Performance & Dual Logo Precache
 // Handles push notifications, badge counts, client navigation, and two-tier offline caching
 
-const CACHE_NAME = 'qcet-eoffice-v3';
+const CACHE_NAME = 'qcet-eoffice-v4';
 const API_CACHE_NAME = 'qcet-api-v1';
 const OFFLINE_FALLBACK_URL = '/?zone=tasks';
 const API_TIMEOUT_MS = 2500;
@@ -16,6 +16,7 @@
   '/icons/icon-192x192.png',
   '/icons/icon-512x512.png',
   '/logo-qcet.png',
+  '/logo-qcet.webp',
 ];
```

#### File Diff 1.4: Tích hợp `useDeferredValue` cho Search Query (`src/hooks/use-task-filters.ts`)
```diff
--- a/src/hooks/use-task-filters.ts
+++ b/src/hooks/use-task-filters.ts
@@ -62,6 +62,7 @@
   isSchoolView: boolean;
   effectiveManagerUser: AuthUser | null;
+  isFilteringDeferred: boolean;
 
   // Computed memoized outputs
   scopedBaseTasks: SchoolTask[];
@@ -194,6 +195,8 @@
     () => (isExecutive && activeZone === "dashboard" ? computeDepartmentHealthMatrix(tasks) : []),
     [tasks, isExecutive, activeZone]
   );
+
+  const deferredSearchQuery = React.useDeferredValue(searchQuery);
 
   const filteredTasks = React.useMemo(() => {
     if (activeZone === "portal" || activeZone === "org") return [];
@@ -204,7 +207,7 @@
       category: selectedCategory,
       priority: selectedPriority,
       department: selectedDepartment,
-      searchQuery,
+      searchQuery: deferredSearchQuery,
       user,
       academicMonth: selectedAcademicMonth,
       academicYear: currentAcademicYear,
@@ -221,7 +224,7 @@
       selectedCategory,
       selectedPriority,
       selectedDepartment,
-      searchQuery,
+      deferredSearchQuery,
       user,
       isExecutive,
       executiveFilter,
@@ -282,5 +285,6 @@
     isSchoolView,
     effectiveManagerUser,
+    isFilteringDeferred: searchQuery !== deferredSearchQuery,
     scopedBaseTasks,
     monthlyTaskCounts,
     selectedMonthPeriod,
```

---

### 3.2. Phase 2: P1 Structural Refactoring (Ngày 3 - Ngày 5)
Mục tiêu: Cô lập re-render thông qua việc phân tách Context, tối ưu database concurrency, hoàn thiện API pagination và debounce tìm kiếm văn bản.

#### 3.2.1. Phân rã `SidebarContext` thành Layout và Badge (`src/components/layout/sidebar-context.tsx`)
```typescript
// Cấu trúc phân rã chuẩn trong src/components/layout/sidebar-context.tsx
export interface SidebarLayoutContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  currentModule: NavigationModule;
  setCurrentModule: (module: NavigationModule) => void;
  isMounted: boolean;
  sidebarWidth: number;
}

export interface SidebarBadgeContextType {
  badgeCounts: SidebarBadgeCounts;
  setBadgeCounts: React.Dispatch<React.SetStateAction<SidebarBadgeCounts>>;
}

const SidebarLayoutContext = React.createContext<SidebarLayoutContextType | undefined>(undefined);
const SidebarBadgeContext = React.createContext<SidebarBadgeContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState<boolean>(false);
  const [isMounted, setIsMounted] = React.useState<boolean>(false);
  const [badgeCounts, setBadgeCounts] = React.useState<SidebarBadgeCounts>(DEFAULT_SIDEBAR_BADGES);
  const [currentModule, setCurrentModule] = React.useState<NavigationModule>(() =>
    resolveModuleFromPathname(pathname || "")
  );

  React.useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) setIsCollapsed(saved === "true");
    } catch {}
  }, []);

  const toggleCollapse = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  const setCollapsed = React.useCallback((val: boolean) => {
    setIsCollapsed(val);
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(val)); } catch {}
  }, []);

  const toggleMobile = React.useCallback(() => setIsMobileOpen((prev) => !prev), []);
  const effectiveCollapsed = isMounted ? isCollapsed : false;
  const sidebarWidth = effectiveCollapsed ? 64 : 248;

  const layoutValue = React.useMemo<SidebarLayoutContextType>(() => ({
    isCollapsed: effectiveCollapsed,
    toggleCollapse,
    setCollapsed,
    isMobileOpen,
    setIsMobileOpen,
    toggleMobile,
    currentModule,
    setCurrentModule,
    isMounted,
    sidebarWidth,
  }), [effectiveCollapsed, toggleCollapse, setCollapsed, isMobileOpen, toggleMobile, currentModule, isMounted, sidebarWidth]);

  const badgeValue = React.useMemo<SidebarBadgeContextType>(() => ({
    badgeCounts,
    setBadgeCounts,
  }), [badgeCounts]);

  return (
    <SidebarLayoutContext.Provider value={layoutValue}>
      <SidebarBadgeContext.Provider value={badgeValue}>
        {children}
      </SidebarBadgeContext.Provider>
    </SidebarLayoutContext.Provider>
  );
}

export function useSidebarLayout(): SidebarLayoutContextType {
  const ctx = React.useContext(SidebarLayoutContext);
  if (!ctx) throw new Error("useSidebarLayout must be used within SidebarProvider");
  return ctx;
}

export function useSidebarBadges(): SidebarBadgeContextType {
  const ctx = React.useContext(SidebarBadgeContext);
  if (!ctx) throw new Error("useSidebarBadges must be used within SidebarProvider");
  return ctx;
}

// Facade tương thích ngược hoàn toàn
export function useSidebar(): SidebarContextType {
  const layout = useSidebarLayout();
  const badges = useSidebarBadges();
  return { ...layout, ...badges };
}
```

#### 3.2.2. Bổ sung Model `TaskSequence` và Migration (`prisma/schema.prisma`)
```prisma
// Bổ sung vào cuối file prisma/schema.prisma:
model TaskSequence {
  sequenceKey  String   @id
  currentValue Int      @default(0)
  updatedAt    DateTime @updatedAt

  @@map("task_sequences")
}
```

#### 3.2.3. Trình Sinh Mã O(1) Độc quyền Database (`src/lib/task-code-generator.ts`)
```typescript
import { Prisma } from '@prisma/client';

/**
 * Sinh mã nhiệm vụ tự động O(1) đảm bảo an toàn tuyệt đối khi có nhiều giao dịch đồng thời.
 * Định dạng: NV-YYYY-MM-XXX (Ví dụ: NV-2026-09-001)
 */
export async function generateAtomicTaskCode(
  tx: Prisma.TransactionClient,
  year: number,
  month: number
): Promise<string> {
  const sequenceKey = `TASK_${year}_${String(month).padStart(2, '0')}`;
  
  const seq = await tx.taskSequence.upsert({
    where: { sequenceKey },
    create: { sequenceKey, currentValue: 1 },
    update: { currentValue: { increment: 1 } },
  });

  const paddedMonth = String(month).padStart(2, '0');
  const paddedSeq = String(seq.currentValue).padStart(3, '0');
  return `NV-${year}-${paddedMonth}-${paddedSeq}`;
}
```

#### 3.2.4. Tái cấu trúc API Nhiệm vụ với Phân trang & Backward Compatibility (`src/app/api/tasks/route.ts`)
```typescript
// Trong src/app/api/tasks/route.ts
export async function GET(request: NextRequest) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const month = searchParams.get('academicMonth') || searchParams.get('month');
    const dept = searchParams.get('departmentId') || searchParams.get('dept');
    const scope = searchParams.get('scope');
    const year = searchParams.get('academicYear') || searchParams.get('year');
    const status = searchParams.get('status');

    const where: any = {};
    if (month && month !== 'all') where.academicMonth = parseInt(month, 10);
    if (dept && dept !== 'all') where.departmentId = dept;
    if (year && year !== 'all') where.academicYear = year;
    if (scope && scope !== 'all') {
      const s = scope.toLowerCase();
      if (s === 'school') where.scope = TaskScope.SCHOOL;
      else if (s === 'department') where.scope = TaskScope.DEPARTMENT;
      else if (s === 'individual') where.scope = TaskScope.INDIVIDUAL;
    }
    if (status && status !== 'all') {
      const statusMap: Record<string, TaskStatus> = {
        not_started: TaskStatus.NOT_STARTED,
        in_progress: TaskStatus.IN_PROGRESS,
        waiting_approval: TaskStatus.WAITING_APPROVAL,
        completed: TaskStatus.COMPLETED,
        overdue: TaskStatus.OVERDUE,
        cancelled: TaskStatus.CANCELLED,
      };
      const upper = status.toUpperCase();
      if (upper in TaskStatus) {
        where.status = TaskStatus[upper as keyof typeof TaskStatus];
      } else if (status in statusMap) {
        where.status = statusMap[status];
      }
    }

    const [totalCount, tasks] = await prisma.$transaction([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          department: true,
          assignees: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } }
          },
          deliverables: true
        },
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const formattedTasks = tasks.map(mapPrismaTaskToSchoolTask);

    return NextResponse.json({
      success: true,
      data: formattedTasks,
      tasks: formattedTasks, // Alias tương thích ngược bắt buộc
      totalCount,
      total: totalCount,     // Alias tương thích ngược bắt buộc
      page,
      limit,
      hasMore: skip + formattedTasks.length < totalCount,
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

#### 3.2.5. Bảo toàn Phương thức `DELETE` và Phản hồi Chi tiết (`src/app/api/tasks/[id]/route.ts`)
```typescript
// Bảo toàn hoàn toàn method DELETE trong src/app/api/tasks/[id]/route.ts
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const session = getSessionPayload(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await Promise.resolve(context.params);
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy nhiệm vụ' },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Giải phóng liên kết văn bản hành chính
      await tx.document.updateMany({
        where: { linkedTaskId: id },
        data: { linkedTaskId: null }
      });

      // 2. Dọn dẹp cascade toàn bộ quan hệ nghiệp vụ
      await tx.taskAssignee.deleteMany({ where: { taskId: id } });
      await tx.taskDeliverable.deleteMany({ where: { taskId: id } });
      await tx.dacumDelegation.deleteMany({ where: { taskId: id } });
      await tx.executiveResolution.deleteMany({ where: { taskId: id } });

      // 3. Xóa bản ghi nhiệm vụ chính
      await tx.task.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: 'Đã xóa nhiệm vụ thành công'
    });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

#### 3.2.6. Debounce và AbortController tại `document-registry-view.tsx`
```typescript
// Tối ưu hóa trong src/components/documents/document-registry-view.tsx
const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery);

React.useEffect(() => {
  const handler = setTimeout(() => {
    setDebouncedSearch(searchQuery);
  }, 300);
  return () => clearTimeout(handler);
}, [searchQuery]);

// Tách biệt fetchStats: chỉ chạy khi mount hoặc đổi tab chính
React.useEffect(() => {
  fetchStats();
}, [activeTab, fetchStats]);

// fetchDocuments sử dụng AbortController và debouncedSearch
React.useEffect(() => {
  const controller = new AbortController();
  
  async function loadData() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === "inbox") params.set("type", "VAN_BAN_DEN");
      else if (activeTab === "outbox") params.set("type", "VAN_BAN_DI");
      else if (activeTab === "pending") params.set("type", "TO_TRINH_NOI_BO");

      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (urgencyFilter !== "ALL") params.set("urgency", urgencyFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/documents?${params.toString()}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        const rawDocs = Array.isArray(json.data) ? json.data : Array.isArray(json.documents) ? json.documents : [];
        setDocuments(rawDocs.map(mapApiDocumentToOfficial));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error("Error fetching documents:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }

  loadData();
  return () => controller.abort();
}, [activeTab, debouncedSearch, urgencyFilter, statusFilter]);
```

---

### 3.3. Phase 3: P2 Advanced Optimization (Tùy chọn nâng cao)
Mục tiêu: Triệt tiêu tình trạng quá tải DOM khi duyệt danh mục lớn và chuẩn bị kiến trúc đồng bộ ngoại tuyến PWA hoàn chỉnh.

#### 3.3.1. Phân trang Đệm và Virtualization tại `department-grouped-task-view.tsx`
- Giới hạn hiển thị mặc định `ITEMS_PER_PAGE = 5` cho mỗi phòng ban khi mở rộng.
- Thêm nút bấm "Xem thêm 5 việc (còn N việc)" ở chân mỗi bảng.
- Thêm class `content-visibility-auto` vào các thẻ `tr` để tận dụng tối đa GPU culling của trình duyệt hiện đại.

#### 3.3.2. Chuẩn hóa Hàng đợi Đồng bộ Offline (Background Sync Engine)
- Lưu trữ các thao tác tạo/sửa task khi mất kết nối mạng vào IndexedDB `qcet_offline_queue`.
- Khi mạng khôi phục (`window.addEventListener('online')`), Service Worker kích hoạt `sync` event gửi dữ liệu về `/api/tasks/sync` theo cơ chế FIFO có exponential backoff.

---

## 4. QUY TRÌNH KIỂM THỬ, XÁC THỰC & ROLLBACK PLAN

### 4.1. Quy trình Kiểm thử & Xác thực Chất lượng (Quality Assurance)
Trước khi hợp nhất (merge) bất kỳ commit nào thuộc các giai đoạn trên vào nhánh chính `main`, kỹ sư thực hiện bắt buộc phải chạy quy trình kiểm thử 3 bước sau:

#### Bước 1: Kiểm tra Tính toàn vẹn Kiểu dữ liệu (TypeScript Strict Check)
```bash
npm run typecheck
```
*Yêu cầu*: Lệnh kết thúc với mã thoát 0 (Exit Code 0), tuyệt đối không còn bất kỳ lỗi TypeScript nào liên quan đến props Context, kiểu trả về của API hay schema Prisma.

#### Bước 2: Chạy Toàn diện Bộ Test Suite Hồi quy
```bash
npm test
```
*Các test case trọng điểm bắt buộc phải có kết quả XANH (PASS)*:
1. `tests/service-worker-manifest.test.ts`: Xác thực service worker nạp đúng cache `qcet-eoffice-v4` và có mặt cả `/logo-qcet.png` lẫn `/logo-qcet.webp`.
2. `tests/tasks-api-route.test.ts`: Xác thực endpoint `GET /api/tasks` trả về đúng cả 2 cấu trúc mảng `res.data` và `res.tasks`, số đếm `res.totalCount` và `res.total`.
3. `tests/task-details-api.test.ts`: Xác thực phương thức `DELETE /api/tasks/[id]` dọn dẹp sạch liên kết văn bản và các bảng phụ thuộc mà không báo lỗi 405.
4. `tests/app-layout.test.ts`: Xác thực cấu trúc layout chuẩn, không chứa emoji và giữ đúng Light Mode.
5. `tests/theme-standardization.test.ts`: Xác thực hệ thống màu OKLCH không bị pha tạp biến thể dark mode.

#### Bước 3: Xác thực Trực quan & Giám sát Performance trên Dev Preview
- Khởi động dev server: `npm run dev -- -p 3001`
- Sử dụng công cụ Chrome DevTools Performance & Lighthouse:
  - Kiểm tra tab **Rendering** > **Layer Borders**: Đảm bảo không còn layer màu xanh lá cây bao phủ toàn bộ màn hình từ `body::before`.
  - Kiểm tra tab **Network**: Đảm bảo khi gõ tìm kiếm chỉ phát sinh duy nhất 1 request sau khi ngừng gõ 300ms; không còn request tải `qrcode` hay font `JetBrains_Mono`.
  - Đo lường INP qua Interaction Tab: Gõ phím liên tục đạt INP < 12ms.

---

### 4.2. Kế hoạch Phục hồi & Rollback Khẩn cấp (Rollback Plan)

Trong trường hợp phát sinh sự cố bất khả kháng trên môi trường Production hoặc Staging, đội ngũ kỹ thuật tuân thủ quy trình rollback chuẩn sau:

#### Kịch bản 1: Dev Server bị mất CSS, hiển thị màn hình thô (Dev Cache Poisoning Recovery)
Nếu vô tình chạy `next build` khi dev server đang hoạt động dẫn tới mất dev chunks CSS:
```bash
# 1. Dừng ngay lập tức các tiến trình đang chiếm cổng 3001
kill -9 $(lsof -ti:3001) 2>/dev/null || true

# 2. Xóa sạch thư mục cache .next bị nhiễm độc
rm -rf .next

# 3. Khởi động lại dev server sạch
npm run dev -- -p 3001
```
*Thao tác trên Client*: Nhấn tổ hợp phím `Cmd + Shift + R` (macOS) hoặc `Ctrl + Shift + R` (Windows) để xóa sạch cache trình duyệt.

#### Kịch bản 2: Lỗi Migration Cơ sở dữ liệu Bảng `task_sequences`
Nếu database production chưa kịp chạy migration khiến `tx.taskSequence` báo lỗi bảng không tồn tại:
1. Kích hoạt cờ môi trường khẩn cấp: `TASK_CODE_LEGACY_FALLBACK=true`.
2. Trong `src/lib/task-code-generator.ts`, kích hoạt luồng fallback tạm thời dùng `nanoid(8)` hoặc timestamp microsecond `NV-${year}${month}-${Date.now().toString().slice(-4)}` để không làm gián đoạn việc tạo nhiệm vụ của người dùng.
3. Chạy lệnh đồng bộ database schema:
   ```bash
   npx prisma db push
   ```

#### Kịch bản 3: Rollback Mã nguồn qua Git
Mỗi Giai đoạn (Phase) được cô lập trong các commit riêng biệt có tiền tố rõ ràng. Nếu Phase 2 phát sinh lỗi logic, thực hiện hoàn nguyên commit mà không ảnh hưởng tới các cải tiến Asset và CSS của Phase 1:
```bash
# Xem lịch sử commit gần nhất
git log --oneline -n 5

# Revert commit gây lỗi an toàn
git revert <COMMIT_HASH> --no-edit

# Xác thực lại toàn bộ hệ thống
npm run typecheck
npm test
```

---

## 5. KẾT LUẬN & CHỮA LỖI ĐÃ PHÊ DUYỆT

Tài liệu Đặc tả Kỹ thuật **SPEC-QCET-PERF-2025-01** phiên bản 1.0 đã tích hợp đầy đủ 4 chỉ thị sửa đổi bắt buộc từ Hội đồng Thẩm định:
1. **API Contracts**: Bảo toàn tuyệt đối `tasks` và `total` tại `/api/tasks`; khôi phục đầy đủ method `DELETE` tại `/api/tasks/[id]`.
2. **Concurrency**: Sử dụng Prisma Client atomic upsert cho `TaskSequence`, loại bỏ hoàn toàn raw SQL không an toàn kiểu dữ liệu.
3. **PWA Assets**: Precache đồng thời cả WebP và PNG logo, nâng cấp cache version lên `qcet-eoffice-v4`.
4. **CSS Governance**: Áp dụng cú pháp Tailwind CSS v4 chuẩn xác (`@utility content-visibility-auto`) và giải phóng triệt để Graphics Layer trên GPU.

Toàn bộ tài liệu có hiệu lực thi hành ngay lập tức cho các nhóm phát triển Frontend và Backend thuộc dự án QCET E-Office.