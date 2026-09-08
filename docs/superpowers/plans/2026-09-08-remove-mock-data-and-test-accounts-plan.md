# Kế Hoạch Triển Khai: Loại Bỏ Toàn Bộ Mock Data & Tài Khoản Kiểm Thử 1-Click

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện hệ thống QCET E-Office sang kiến trúc Database-First 100%, xóa bỏ toàn bộ mock data trong runtime `src/lib/`, loại bỏ khối tài khoản kiểm thử 1-Click trên trang đăng nhập, khắc phục lỗ hổng lộ mật khẩu theo CWE-798, và cô lập dữ liệu kiểm thử sang `tests/fixtures/`.

**Architecture:** 
1. Tách biệt dữ liệu kiểm thử sang thư mục `tests/fixtures/` để bảo toàn 100% test suites.
2. Dọn dẹp form đăng nhập (`/login`), gỡ bỏ hoàn toàn `SEED_ACCOUNTS`, hàm 1-click login và thẻ hướng dẫn lộ mật khẩu trong `google-login-button.tsx`.
3. Chuẩn hóa `AuthContext`: Loại bỏ cơ chế auto-login demo biến khách vãng lai thành Hiệu trưởng; điều hướng an toàn về `/login` khi truy cập trang nội bộ mà chưa xác thực.
4. Cung cấp API `GET /api/users` từ CSDL PostgreSQL/SQLite qua Prisma ORM và kết nối động vào Modal tạo công việc.
5. Cập nhật các trang `/dashboard`, `/tasks`, `/unit-tasks`, `/notifications` sang tải dữ liệu bất đồng bộ với Skeleton Loading Light-only (không dùng dữ liệu giả khởi tạo).
6. Xóa vĩnh viễn `src/lib/mock-dashboard-data.ts`, `src/lib/mock-document-data.ts`, và dọn dẹp các tài khoản demo kiểm thử trong `prisma/seed.ts`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 (Light-only mode), Prisma ORM, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-08-remove-mock-data-and-test-accounts-design.md`

## Global Constraints
- Tuân thủ quy tắc build trong `CLAUDE.md`: Không chạy `next build` đè lên `.next` khi dev server đang chạy; dùng `npm run typecheck` và `npm test` để kiểm tra chất lượng.
- Tuân thủ Light-Only: Tuyệt đối không thêm class `dark:` trong bất kỳ component nào được tạo mới hoặc chỉnh sửa.
- Không để sót bất kỳ tham chiếu mồ côi nào tới `src/lib/mock-dashboard-data` hoặc `src/lib/mock-document-data`.
- 100% bài kiểm thử tự động (`npm test`) phải chạy qua (PASS).

---

### Task 1: Thiết Lập Thư Mục Test Fixtures & Cô Lập Dữ Liệu Kiểm Thử

**Files:**
- Create: `tests/fixtures/dashboard-fixtures.ts`
- Create: `tests/fixtures/document-fixtures.ts`
- Modify: `tests/dashboard-api.test.ts`
- Modify: `tests/dashboard-integration.test.ts`
- Modify: `tests/dashboard-subhooks-logic.test.ts`
- Modify: `tests/department-task-view-integration.test.ts`
- Modify: `tests/document-management-workflow.test.ts`
- Modify: `tests/sprint2-integration.test.ts`
- Modify: `tests/task-ownership-model.test.ts`
- Modify: `tests/unified-hub-integration.test.ts`
- Modify: `tests/unified-task-hub.test.ts`
- Modify: `tests/unified-task-toolbar.test.ts`

**Interfaces:**
- Produces:
  - `getMockDashboardPayload(): DashboardPayload & { schoolTasks: SchoolTask[] }` in `tests/fixtures/dashboard-fixtures.ts`
  - `QCET_PERSONNEL: Personnel[]` in `tests/fixtures/dashboard-fixtures.ts`
  - `MOCK_DOCUMENTS: OfficialDocument[]` in `tests/fixtures/document-fixtures.ts`
  - `getDocumentStats(): DocumentStats` in `tests/fixtures/document-fixtures.ts`

- [ ] **Step 1: Tạo thư mục `tests/fixtures` và tệp `tests/fixtures/dashboard-fixtures.ts`**

Sao chép logic sinh payload test từ `src/lib/mock-dashboard-data.ts` vào `tests/fixtures/dashboard-fixtures.ts` và export `getMockDashboardPayload`, `QCET_PERSONNEL`, `CATEGORY_LABELS`.

- [ ] **Step 2: Tạo tệp `tests/fixtures/document-fixtures.ts`**

Sao chép các văn bản mẫu và hàm thống kê từ `src/lib/mock-document-data.ts` vào `tests/fixtures/document-fixtures.ts` và export `MOCK_DOCUMENTS`, `getDocumentStats`.

- [ ] **Step 3: Cập nhật đường dẫn import trong toàn bộ các file `tests/*.test.ts`**

Thay thế tất cả `import ... from "@/lib/mock-dashboard-data"` hoặc `from "../src/lib/mock-dashboard-data"` bằng `from "./fixtures/dashboard-fixtures"`.
Thay thế tất cả `import ... from "@/lib/mock-document-data"` hoặc `from "../src/lib/mock-document-data"` bằng `from "./fixtures/document-fixtures"`.

- [ ] **Step 4: Chạy kiểm thử tự động để xác nhận cô lập fixtures thành công**

Run: `npm test`
Expected: 100% test suites PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/ tests/*.test.ts
git commit -m "test(fixtures): isolate test data into tests/fixtures directory"
```

---

### Task 2: Dọn Dẹp Trang Đăng Nhập & Modal Google Login (Khắc phục CWE-798 & Xóa 1-Click Test Accounts)

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/auth/google-login-button.tsx`
- Modify: `src/components/layout/mobile-menu-drawer.tsx`

**Interfaces:**
- Consumes: `useAuth` from `@/lib/auth-context`
- Modifies: Loại bỏ hoàn toàn giao diện `SEED_ACCOUNTS`, hàm `handleQuickSeedLogin`, state `loadingSeedEmail`, và mật khẩu thô `Qcet@2026`.

- [ ] **Step 1: Cập nhật `src/app/login/page.tsx`**

Xóa bỏ:
1. Mảng `SEED_ACCOUNTS`.
2. State `const [loadingSeedEmail, setLoadingSeedEmail] = React.useState<string | null>(null);`.
3. Hàm `handleQuickSeedLogin`.
4. Khối UI divider "Tài khoản kiểm thử CSDL hạt nhân (1-Click)" và `SEED_ACCOUNTS.map(...)` cards.
Giữ lại: Header định danh QCET, Tab Đăng nhập công vụ (Google SSO + Form Email/Mật khẩu), Tab Đăng ký tài khoản nội bộ.

- [ ] **Step 2: Cập nhật `src/components/auth/google-login-button.tsx`**

Trong modal thông báo hướng dẫn đăng nhập khi chưa cấu hình Google OAuth:
- Xóa dòng text "Hoặc click trực tiếp các tài khoản kiểm thử hạt nhân...".
- Xóa dòng text "Mật khẩu mặc định cho toàn bộ tài khoản nội bộ là: Qcet@2026".
- Cập nhật thông điệp bảo mật: "Cán bộ, giảng viên sử dụng email công vụ nhà trường (@qcet.edu.vn) để đăng nhập hoặc liên hệ Bộ phận Quản trị mạng & CNTT để được cấp tài khoản".

- [ ] **Step 3: Cập nhật `src/components/layout/mobile-menu-drawer.tsx`**

Xóa khối "CHUYỂN VAI TRÒ TRẢI NGHIỆM" (`DEMO_USERS.map(...)`) trong menu di động để tránh chuyển vai trò giả lập không qua xác thực CSDL.

- [ ] **Step 4: Chạy kiểm tra tĩnh**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/components/auth/google-login-button.tsx src/components/layout/mobile-menu-drawer.tsx
git commit -m "fix(security): remove 1-click test accounts and hardcoded credentials from login flow"
```

---

### Task 3: Chuẩn Hóa Quản Lý Phiên Xác Thực (Loại Bỏ Auto-Login Demo)

**Files:**
- Modify: `src/lib/auth-context.tsx`
- Modify: `src/lib/login-helpers.ts`
- Modify: `src/lib/auth/roles.ts`
- Modify: `src/lib/role-task-filter.ts`

**Interfaces:**
- Consumes: `/api/auth/me`, `/api/auth/logout`
- Produces: `AuthContextType` với trạng thái `user: AuthUser | null`, `isLoading: boolean`.

- [ ] **Step 1: Viết test kiểm tra trạng thái unauthenticated không tự động cấp demo user**

Tạo/cập nhật test trong `tests/auth-context-behavior.test.ts`:
Kiểm tra rằng khi `/api/auth/me` trả về `{ authenticated: false }`, hệ thống không tự động gán tài khoản Hiệu trưởng.

- [ ] **Step 2: Cập nhật `src/lib/auth-context.tsx`**

1. Khởi tạo `user` ban đầu:
   - Thay vì `useState<AuthUser>(DEFAULT_DEMO_USERS[0])`, khởi tạo trạng thái null hoặc guest an toàn, `isLoading = true`.
2. Trong `useEffect` đồng bộ session:
   - Xóa bỏ đoạn mã tự động tạo session demo:
     ```typescript
     // XÓA ĐOẠN NÀY:
     // If still not authenticated on server, auto-establish demo session cookie
     // let activeTarget = DEFAULT_DEMO_USERS[0]; ...
     ```
   - Khi không xác thực được, kết thúc loading (`setIsLoading(false)`), giữ người dùng ở trạng thái chưa đăng nhập.
3. Trong hàm `logout()`:
   - Xóa bỏ `setUser(DEFAULT_DEMO_USERS[0]);`. Chuyển hướng sạch về `/login`.

- [ ] **Step 3: Dọn dẹp các fallback demo trong `src/lib/login-helpers.ts` và `src/lib/auth/roles.ts`**

Đảm bảo khi không tìm thấy user, trả về null hoặc lỗi xác thực thay vì tự động rơi về `DEFAULT_DEMO_USERS[0]`.

- [ ] **Step 4: Chạy kiểm tra tự động**

Run: `npm test` và `npm run typecheck`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-context.tsx src/lib/login-helpers.ts src/lib/auth/roles.ts src/lib/role-task-filter.ts tests/
git commit -m "refactor(auth): eliminate auto-login demo bypass and sanitize session lifecycle"
```

---

### Task 4: Xây Dựng API Danh Sách Cán Bộ Thực Tế (`/api/users`) & Kết Nối Modal Tạo Việc

**Files:**
- Create: `src/app/api/users/route.ts`
- Create: `tests/api-users.test.ts`
- Modify: `src/components/dashboard/create-task-modal.tsx`

**Interfaces:**
- Produces: `GET /api/users` -> `{ success: true, users: Array<{ id, name, email, role, departmentId, department, title, avatarUrl }> }`
- Consumes in `create-task-modal.tsx`: nạp danh sách cán bộ trực ti���p từ `/api/users` thay vì `QCET_PERSONNEL`.

- [ ] **Step 1: Viết test cho API `/api/users`**

Tạo `tests/api-users.test.ts`:
- Kiểm tra `GET /api/users` trả về danh sách người dùng với các trường thông tin cần thiết (`id`, `name`, `email`, `role`, `department`).
- Kiểm tra tham số lọc theo phòng ban `?departmentId=...` và tìm kiếm `?q=...`.

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `tsx --test tests/api-users.test.ts`
Expected: FAIL vì endpoint chưa được triển khai.

- [ ] **Step 3: Triển khai `src/app/api/users/route.ts`**

Sử dụng Prisma Client để truy vấn:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const departmentId = searchParams.get("departmentId");
    const q = searchParams.get("q")?.trim().toLowerCase();

    const where: any = {};
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        department: {
          select: { id: true, name: true, shortName: true },
        },
        title: true,
        avatarUrl: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ success: false, error: "Lỗi nạp danh sách cán bộ" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Chạy test để xác nhận API hoạt động (Green)**

Run: `tsx --test tests/api-users.test.ts`
Expected: PASS.

- [ ] **Step 5: Cập nhật `src/components/dashboard/create-task-modal.tsx`**

1. Gỡ bỏ `import { QCET_PERSONNEL } from "@/lib/mock-dashboard-data";`.
2. Định nghĩa interface cán bộ và nạp qua `useEffect` từ `/api/users`:
   ```typescript
   const [personnelList, setPersonnelList] = useState<Array<{ id: string; name: string; email: string; title?: string }>>([]);
   useEffect(() => {
     fetch("/api/users")
       .then(r => r.json())
       .then(data => {
         if (data.success && data.users) {
           setPersonnelList(data.users);
         }
       })
       .catch(err => console.error("Error loading assignees:", err));
   }, []);
   ```
3. Cập nhật các select box người chủ trì và người phối hợp sử dụng `personnelList`.

- [ ] **Step 6: Kiểm tra tĩnh & commit**

Run: `npm run typecheck`
Expected: 0 errors.

```bash
git add src/app/api/users/route.ts tests/api-users.test.ts src/components/dashboard/create-task-modal.tsx
git commit -m "feat(api): implement /api/users endpoint and connect dynamic personnel to task creation"
```

---

### Task 5: Chuyển Đổi Dashboard, Tasks, Unit-Tasks & Notifications Sang Database-First Với Skeletons & Next.js Streaming

**Files:**
- Create: `src/app/dashboard/loading.tsx`
- Create: `src/app/tasks/loading.tsx`
- Create: `src/app/unit-tasks/loading.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/app/unit-tasks/page.tsx`
- Modify: `src/components/documents/document-quick-entry-modal.tsx`
- Modify: `src/components/notifications/notification-popover.tsx`
- Modify: `src/app/notifications/page.tsx`
- Modify: `src/lib/notion-client.ts`

**Interfaces:**
- Consumes: `/api/dashboard/overview`, `/api/notifications`
- Produces: Loading Skeletons mượt mà (cả ở cấp route `loading.tsx` lẫn component state), Error State kèm retry button; loại bỏ 100% việc rơi về mock data.

- [ ] **Step 1: Tạo các tệp `loading.tsx` hỗ trợ Next.js App Router Streaming**

Tạo `src/app/dashboard/loading.tsx`, `src/app/tasks/loading.tsx`, `src/app/unit-tasks/loading.tsx` hiển thị Skeleton layout chuẩn Light-only để triệt tiêu hoàn toàn độ trễ điều hướng và hiện tượng nhấp nháy giao diện.

- [ ] **Step 2: Cập nhật `src/app/dashboard/page.tsx`**

1. Gỡ bỏ `import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";`.
2. Khởi tạo `useState<DashboardPayload | null>(null)` và `useState(true)` cho `isLoading`.
3. Khi `isLoading && !payload`: Render skeleton bảng điều hành (4 ô KPI pulse, khung bảng nhiệm vụ pulse) với các class Light-only sạch đẹp.
4. Khi có lỗi: Render card thông báo lỗi trang nhã kèm nút "Thử lại".

- [ ] **Step 3: Cập nhật `src/app/tasks/page.tsx` và `src/app/unit-tasks/page.tsx`**

Tương tự Dashboard:
1. Gỡ bỏ `getMockDashboardPayload()`.
2. Khởi tạo `payload: null`, `isLoading: true`.
3. Render Skeleton UI trong khi fetch dữ liệu từ `/api/dashboard/overview`.

- [ ] **Step 4: Cập nhật `document-quick-entry-modal.tsx`**

Thay thế `registeredById: "vt-auto-session"` bằng `user?.id` lấy từ `useAuth()`.

- [ ] **Step 5: Cập nhật `notification-popover.tsx` và `/notifications/page.tsx`**

1. Gỡ bỏ import `QCET_PERSONNEL` và `INITIAL_NOTIFICATIONS`.
2. Nạp dữ liệu thực qua fetch `/api/notifications`.
3. Nếu mảng thông báo rỗng: Render empty state: "Hiện tại Đồng chí không có thông báo mới nào".

- [ ] **Step 4: Cập nhật `src/lib/notion-client.ts`**

1. Xóa bỏ import `getMockDashboardPayload`.
2. Khi Notion Token không tồn tại hoặc lỗi kết nối, trả về đối tượng rỗng hợp chuẩn kèm log cảnh báo, không fallback về mock data.

- [ ] **Step 5: Kiểm tra biên dịch & kiểm thử**

Run: `npm run typecheck` && `npm test`
Expected: 0 type errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/tasks/page.tsx src/app/unit-tasks/page.tsx src/components/notifications/notification-popover.tsx src/app/notifications/page.tsx src/lib/notion-client.ts
git commit -m "refactor(views): migrate views to database-first with light-mode skeletons"
```

---

### Task 6: Xóa Vĩnh Viễn Mock Files Khỏi Runtime & Dọn Dẹp Kịch Bản Seed CSDL

**Files:**
- Delete: `src/lib/mock-dashboard-data.ts`
- Delete: `src/lib/mock-document-data.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Đảm bảo trong toàn bộ thư mục `src/` không còn bất kỳ tệp hay import nào trỏ tới mock data.
- Kịch bản `prisma/seed.ts` tuân thủ tiêu chuẩn an ninh CWE-798 & CWE-1188.

- [ ] **Step 1: Xóa bỏ 2 tệp mock trong `src/lib/`**

Run:
```bash
rm src/lib/mock-dashboard-data.ts
rm src/lib/mock-document-data.ts
```

- [ ] **Step 2: Rà soát và loại bỏ các tài khoản demo kiểm thử trong `prisma/seed.ts`**

Trong `prisma/seed.ts`:
- Xóa mục `2.1 Tạo tài khoản demo phục vụ chuyển đổi vai trò nhanh trên giao diện` (bao gồm `user-admin-bgh`, `user-manager-daotao`, `user-staff-vinh`).
- Giữ lại danh mục 11 phòng/khoa chuẩn của Nhà trường và danh bạ cán bộ chính thức.

- [ ] **Step 3: Kiểm tra toàn bộ mã nguồn `src/` để đảm bảo sạch 100% mock references**

Run: `git grep -i "mock-dashboard-data" src/`
Run: `git grep -i "mock-document-data" src/`
Run: `git grep -i "SEED_ACCOUNTS" src/`
Expected: Toàn bộ lệnh grep không trả về kết quả nào trong `src/`.

- [ ] **Step 4: Chạy Typecheck và Toàn bộ Test Suites**

Run: `npm run typecheck`
Run: `npm test`
Expected: 
- `npm run typecheck` exit 0 (0 errors).
- `npm test` exit 0 (100% tests PASS).

- [ ] **Step 5: Commit hoàn thành kế hoạch**

```bash
git add -u
git commit -m "chore(cleanup): permanently purge runtime mock files and sanitize prisma seed accounts"
```

---

## 5. Danh Mục Rà Soát Kế Hoạch (Self-Review Checklist)

1. **Độ bao phủ Spec (Spec coverage)**:
   - Xóa tài khoản 1-Click & mật khẩu cố định -> Đã phủ trong Task 2.
   - Xóa Auto-login demo -> Đã phủ trong Task 3.
   - Skeletons Light-only & Database-first views -> Đã phủ trong Task 5.
   - API Users thật & Task Creation -> Đã phủ trong Task 4.
   - Di chuyển test fixtures & Xóa tệp mock runtime -> Đã phủ trong Task 1 và Task 6.
   - Dọn dẹp seed script -> Đã phủ trong Task 6.
2. **Không chứa Placeholder**: Mỗi bước đều có đường dẫn tệp rõ ràng, code mẫu chi tiết, câu lệnh kiểm thử cụ thể.
3. **Tính nhất quán về Type**: Mọi hàm và interface (`DashboardPayload`, `AuthUser`, `OfficialDocument`) đều đồng nhất giữa client, server và test fixtures.
