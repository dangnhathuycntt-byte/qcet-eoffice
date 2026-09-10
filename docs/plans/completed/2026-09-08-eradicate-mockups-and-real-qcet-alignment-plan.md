---
status: completed
domain: data
created: 2026-09-08
---

# Plan: Bỏ Hoàn Toàn Mockup, Dev Shims & Đồng Bộ Dữ Liệu Thực Tế QCET

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ 100% dữ liệu mock, các đối tượng người dùng giả lập (fallback fake users), các dev shims/role switchers (như trong ảnh đính kèm), đồng bộ hóa toàn bộ danh mục 15 đơn vị và nhân sự thực tế của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn theo Cổng thông tin `cdktcnqn.edu.vn`.

**Architecture:** Database-First 100% kết hợp Google Workspace SSO. Toàn bộ API truy xuất trực tiếp từ Prisma ORM (PostgreSQL/SQLite). Khi không có dữ liệu, trả về Empty State chuẩn hóa (`tasks: []`, `stats: { total: 0, ... }`), cấm mọi hình thức tự động tráo đổi dữ liệu giả.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Prisma ORM, JWT Session, Node Test Runner.

**Spec:** `docs/SPEC_ERADICATE_MOCKUPS_AND_REAL_QCET_ALIGNMENT.md`

## Global Constraints

- **Real Data Only Invariant:** Không được để sót bất kỳ mảng dữ liệu giả lập (`MOCK_*`), tài khoản demo tự cấp (`DEMO_USERS`), hay hàm sinh user ảo (`fallbackUser = fallback-${Date.now()}`).
- **Zero Backdoor & Single Identity Authority:** Xóa bỏ vĩnh viễn endpoint `/api/auth/demo-session` và các query `?source=mock` hoặc `?demoRole=`.
- **Light-Only Design Invariant:** Tuân thủ triệt để QCET Engineering Rules, không sử dụng class `dark:`, không thêm ThemeProvider.
- **Next.js Dev Server Protection:** Tuyệt đối không chạy `npm run build` khi dev server đang chạy. Kiểm tra bằng `npm run typecheck` và `npm test`.

---

### Task 1: Dọn sạch API Routes & Backend Services (Eliminate Demo-Session, Fake Fallback Users, Mock Endpoints)

**Files:**
- Delete: `src/app/api/auth/demo-session/route.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/dashboard/overview/route.ts`
- Modify: `src/lib/server/dashboard-service.ts`
- Modify: `src/lib/login-helpers.ts`
- Modify: `src/lib/auth-context.tsx`
- Test: `tests/zero-mock-backend.test.ts`

**Interfaces:**
- `POST /api/auth/login`: Xác thực 100% qua Prisma + bcrypt. Nếu sai tài khoản hoặc mật khẩu, trả về 401 Unauthorized `{ error: "Email hoặc mật khẩu không chính xác" }`.
- `GET /api/dashboard/overview`: Không nhận `?source=mock`. Trả về số liệu thật từ Prisma; nếu count == 0 thì trả về Empty State hợp lệ.

- [ ] **Step 1: Write tests verifying zero mockups in backend**
Tạo test `tests/zero-mock-backend.test.ts` kiểm tra:
1. Endpoint `/api/auth/demo-session` trả về 404 (hoặc module đã bị xóa).
2. Login với email demo không tồn tại trong DB trả về 401 chứ không sinh user ảo.
3. Dashboard service trả về empty data sạch thay vì mock tasks khi DB trống.

- [ ] **Step 2: Remove `/api/auth/demo-session/route.ts`**
Xóa hoàn toàn tệp `src/app/api/auth/demo-session/route.ts`.

- [ ] **Step 3: Refactor `/api/auth/login/route.ts` and `/api/auth/register/route.ts`**
- Loại bỏ đoạn bypass demo accounts (lines 52-73) và logic sinh `user-${role}-demo`.
- Trong `register/route.ts`, loại bỏ `fallbackUser` trong khối `catch`. Trả về 500 RFC 7807 khi lỗi database.

- [ ] **Step 4: Clean `dashboard-service.ts` and `/api/dashboard/overview/route.ts`**
- Xóa bỏ `MOCK_STATS`, `MOCK_UPCOMING_ITEMS`, `MOCK_ACTIVITIES`, `getMockDashboardData()`, `generateDefaultSchoolTasks()`, `generateDefaultDepartmentSummaries()`.
- Bỏ tham số `?source=mock`. Trả về empty payload chuẩn khi database chưa có dữ liệu.

- [ ] **Step 5: Clean `login-helpers.ts` and `auth-context.tsx`**
- Bỏ `DEMO_LOGIN_CARDS` và logic sinh `user-custom-${Date.now()}`.
- Bỏ fallback về `DEFAULT_DEMO_USERS` trong `switchUser`, `loginWithGoogle` và `auth-context.tsx`.

- [ ] **Step 6: Run tests and verify**
Chạy `npx tsx --test tests/zero-mock-backend.test.ts` đảm bảo pass 100%.

---

### Task 2: Chuẩn Hóa Mô Hình Tổ Chức Thực Tế QCET & CSDL Seed 100% Sạch (Real QCET Organizational Schema & Seed)

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `src/lib/departments.ts`
- Modify: `src/components/org/organization-tree.tsx`
- Modify: `src/lib/role-task-filter.ts`
- Test: `tests/qcet-organization-alignment.test.ts`

**Interfaces:**
- 15 đơn vị chuẩn: BGH, 6 Phòng/Trung tâm (`P_QLDT`, `P_TC`, `P_TCDBCL`, `P_HCQT`, `P_TSHTQT`, `TT_STT`), 9 Khoa (`K_CNTT`, `K_CK`, `K_DIEN`, `K_CNOTO`, `K_DULICH`, `K_KTQT`, `K_KTNN`, `K_VHNT`, `K_DAICUONG`).
- Domain email cán bộ 100%: `@cdktcnqn.edu.vn`.
- Ban Giám hiệu: ThS. Phạm Văn Tường (Hiệu trưởng), ThS. Trần Trọng Kiệm (PHT), ThS. Lê Xuân Nguyên (PHT).

- [ ] **Step 1: Write tests for real QCET organizational structure**
Tạo test `tests/qcet-organization-alignment.test.ts` kiểm định:
1. Danh sách phòng ban và mã đơn vị chuẩn hóa theo `cdktcnqn.edu.vn`.
2. Không còn tồn tại domain `@qcet.edu.vn` trong seed.
3. Ban Giám hiệu đúng tên và chức danh thực tế.

- [ ] **Step 2: Update `prisma/seed.ts`**
Cập nhật `prisma/seed.ts`:
- Định nghĩa đúng 15 đơn vị theo bảng mã chuẩn (`BGH`, `P_QLDT`, `P_TC`, `P_TCDBCL`, `P_HCQT`, `P_TSHTQT`, `TT_STT`, và 9 khoa).
- Cán bộ thật: ThS. Phạm Văn Tường (`tuongpv@cdktcnqn.edu.vn`), ThS. Trần Trọng Kiệm (`kiemtt@cdktcnqn.edu.vn`), ThS. Lê Xuân Nguyên (`nguyenlx@cdktcnqn.edu.vn`), ThS. Lê Văn Thí (`levanthi@cdktcnqn.edu.vn`), ThS. Lê Phương Thúy Oanh (`lephuongthuyoanh@cdktcnqn.edu.vn`), KS. Nguyễn Ngọc Vinh (`vinhnn@cdktcnqn.edu.vn`), ...
- Tạo mật khẩu hash bcrypt an toàn.
- Chạy `npx prisma db seed` để cập nhật database.

- [ ] **Step 3: Update `src/lib/departments.ts` & `src/components/org/organization-tree.tsx`**
Đồng bộ các hằng số frontend với đúng 15 đơn vị và danh bạ lãnh đạo thực tế.

- [ ] **Step 4: Update `src/lib/role-task-filter.ts`**
Cập nhật danh sách tài khoản sang thông tin định danh thật (ThS. Phạm Văn Tường, ThS. Lê Văn Thí, KS. Nguyễn Ngọc Vinh).

- [ ] **Step 5: Run test and seed verification**
Chạy `npx tsx --test tests/qcet-organization-alignment.test.ts`.

---

### Task 3: Loại Bỏ Dev Shims & Mock Switchers trên Giao Diện (Remove Role Switchers & Dev Controls from UI)

**Files:**
- Modify: `src/components/layout/app-topbar.tsx`
- Modify: `src/components/auth/role-switcher-pill.tsx`
- Modify: `src/components/auth/role-viewpoint-banner.tsx`
- Modify: `src/components/layout/mobile-menu-drawer.tsx`
- Modify: `src/components/navigation.tsx`
- Modify: `src/app/login/page.tsx`
- Test: `tests/ui-zero-shim.test.ts`

**Interfaces:**
- Profile Dropdown trong `AppTopbar`: Gỡ bỏ hoàn toàn mục "Chế độ kiểm thử vai trò (Dev)" và 3 lựa chọn BGH/Trưởng đơn vị/Chuyên viên (hình ảnh người dùng phản ánh).
- Trang `/login`: Gỡ bỏ các thẻ demo 1-click accounts. Hiển thị nút đăng nhập Google Workspace chính thức và form chuẩn.

- [ ] **Step 1: Write UI tests for zero dev shims**
Tạo test `tests/ui-zero-shim.test.ts` kiểm tra:
1. `RoleSwitcherPill` trả về `null`.
2. Không còn text "Chế độ kiểm thử vai trò" trong components.
3. Profile menu chỉ hiển thị các action thật (Hồ sơ cán bộ, Cài đặt PWA, Onboarding, Đăng xuất).

- [ ] **Step 2: Update `src/components/layout/app-topbar.tsx`**
Xóa bỏ hoàn toàn khối dropdown "Chế độ kiểm thử vai trò (Dev)" (dòng 296-368). Giữ lại hiển thị thông tin cán bộ thật, avatar họ tên viết tắt, huy hiệu tick xanh Google Workspace, nút "Hồ sơ cá nhân", "Cài đặt App Mobile (PWA)", "Hướng dẫn làm quen (Onboarding)", "Đổi tài khoản" và "Đăng xuất".

- [ ] **Step 3: Decommission `role-switcher-pill.tsx` & `role-viewpoint-banner.tsx`**
Chuyển `RoleSwitcherPill` trả về `null` hoặc xóa bỏ logic chuyển vai trò dev. Loại bỏ các nút test vai trò trong `role-viewpoint-banner.tsx`.

- [ ] **Step 4: Update `src/components/layout/mobile-menu-drawer.tsx` & `navigation.tsx`**
Xóa bỏ khối chuyển vai trò trải nghiệm trong Mobile Drawer.

- [ ] **Step 5: Clean `src/app/login/page.tsx`**
Gỡ bỏ các thẻ đăng nhập thử nghiệm (SEED_ACCOUNTS, quick seed login). Giữ lại nút đăng nhập Google Workspace chính thức của trường (`@cdktcnqn.edu.vn`) và form chuẩn.

- [ ] **Step 6: Run tests and verify**
Chạy `npx tsx --test tests/ui-zero-shim.test.ts`.

---

### Task 4: Đồng Bộ Không Gian Làm Việc Thích Ứng & Onboarding theo Dữ Liệu CSDL Thực (Workspace & Onboarding Real Sync)

**Files:**
- Modify: `src/components/workspace/unified-adaptive-workspace.tsx`
- Modify: `src/components/onboarding/welcome-modal.tsx`
- Modify: `src/components/onboarding/onboarding-checklist-widget.tsx`
- Modify: `src/hooks/use-onboarding.ts`
- Test: `tests/workspace-real-sync.test.ts`

**Interfaces:**
- Workspace tự động áp dụng `defaultScope` từ `user.role` thật trong database (`ADMIN` -> `school`, `MANAGER` -> `unit`, `STAFF` -> `my`).
- Onboarding lưu trạng thái vào CSDL (`onboardedAt`, `onboardingData`).
- Khi mất kết nối máy chủ, hiển thị thông báo offline/thử lại, không tự động fallback về demo.

- [ ] **Step 1: Write tests for real workspace & onboarding sync**
Tạo test `tests/workspace-real-sync.test.ts` kiểm tra:
1. Workspace gán default scope dựa trên user thật từ session.
2. Trạng thái onboarding gắn theo ID người dùng thật trong CSDL.
3. Không fallback về mock payload khi API trả về lỗi hoặc rỗng.

- [ ] **Step 2: Update `unified-adaptive-workspace.tsx`**
Đảm bảo workspace nạp dữ liệu từ endpoint thật, tự động gán scope theo vai trò cán bộ trong session, ẩn ScopeSwitcher đối với Chuyên viên.

- [ ] **Step 3: Update `welcome-modal.tsx` & `onboarding-checklist-widget.tsx`**
Gắn kết chặt chẽ với `user.id` thật và API `/api/users/onboarding`.

- [ ] **Step 4: Run tests and verify**
Chạy `npx tsx --test tests/workspace-real-sync.test.ts`.

---

### Task 5: Cập Nhật Toàn Bộ Test Suite & Kiểm Tra Typecheck (Full Regression & Verification)

**Files:**
- Modify: `tests/app-layout.test.ts`
- Modify: `tests/client-auth-context.test.ts`
- Modify: `tests/login-page.test.ts`
- Modify: `tests/role-based-workspace-workflow.test.ts`
- Modify: `tests/scope-switcher.test.ts`
- Modify: `tests/sprint2-integration.test.ts`
- Modify: `tests/task-ownership-model.test.ts`
- Run: `npm run typecheck`
- Run: `npm test`

- [ ] **Step 1: Update existing tests to align with zero-mockup contracts**
Cập nhật các test file cũ từng kỳ vọng demo accounts hoặc endpoint demo-session để chuyển sang dùng mock session hợp lệ hoặc database fixtures.

- [ ] **Step 2: Run `npm run typecheck`**
Đảm bảo TypeScript biên dịch thành công 0 lỗi (`tsc --noEmit`).

- [ ] **Step 3: Run full test suite `npm test`**
Đảm bảo 100% tests chạy thành công (`tsx --test tests/**/*.test.ts`).
