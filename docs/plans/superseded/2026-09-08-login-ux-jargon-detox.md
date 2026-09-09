---
status: superseded
domain: ux
created: 2026-09-08
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Chuẩn Hóa UX Writing & Loại Bỏ Thuật Ngữ Kỹ Thuật Trang Đăng Nhập QCET E-Office

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ toàn bộ thuật ngữ công nghệ thừa thãi (SSO, Google Identity, Google Workspace, PWA, Onboarding, OAuth) trên giao diện Đăng nhập, Topbar và Sidebar; thay bằng văn phong hành chính sư phạm thân thiện, dễ hiểu cho Cán bộ, Giảng viên trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn; bảo toàn 100% hợp đồng backend và test suite.

**Architecture:** Giữ nguyên kiến trúc xác thực Google OAuth 2.0 và các mã lỗi enum backend (`domain_not_allowed`, `account_disabled`, `oauth_not_configured`, v.v.). Tách bạch tầng kỹ thuật (mã code) và tầng trình diễn (UX Writing/Microcopy). Tinh chỉnh trực tiếp các chuỗi hiển thị trên client components và cập nhật đồng bộ các assertion trong test suite.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4 (Light-Only), Lucide React, Node.js Native Test Runner (`node:test`).

## Global Constraints
- **Tuân thủ quy tắc Build Cache (CLAUDE.md):** Tuyệt đối KHÔNG chạy `npm run build` hay `next build` khi dev server đang chạy. Mọi kiểm thử phải dùng `npm run typecheck` (`tsc --noEmit`) và `npm test` (`tsx --test tests/**/*.test.ts`).
- **Chuẩn hóa giao diện Light-Only:** Hệ thống thuần Light mode (OKLCH). Không thêm class `dark:`, khối `.dark`, hoặc logic chuyển đổi theme.
- **Quy chuẩn Anti-Slop (0% Emoji trang trí):** Tuyệt đối không dùng emoji trong nhãn nút bấm, thông báo, tooltip. Sử dụng icon Lucide với nét vẽ đồng nhất (`strokeWidth={1.5}` đến `2`).
- **Bảo toàn Contract Layer:** Không thay đổi các mã lỗi query params (`domain_not_allowed`, `account_disabled`, `oauth_cancelled`, `oauth_state_invalid`, `oauth_not_configured`, `missing_code`, `oauth_failed`).

---

### Task 1: Chuẩn hóa Microcopy Thông báo Lỗi trong `src/lib/login-helpers.ts`

**Files:**
- Modify: `src/lib/login-helpers.ts:133-196`
- Test: `tests/login-page.test.ts`

**Interfaces:**
- Consumes: `resolveOAuthError(error: string | null | undefined, email?: string | null): OAuthErrorInfo | null`
- Produces: `OAuthErrorInfo` với tiêu đề và nội dung thông báo chuẩn công sở giáo dục, bảo toàn từ khóa cho test assertion (`@cdktcnqn.edu.vn`, `Thử lại bằng tài khoản trường`, `Phòng Quản trị Mạng và CNTT`, `Hệ thống chưa cấu hình Google OAuth`, `Đã xảy ra lỗi trong quá trình xác thực với Google`).

- [ ] **Step 1: Viết lại các thông báo trong `resolveOAuthError`**
  Cập nhật hàm `resolveOAuthError` trong `src/lib/login-helpers.ts`:
  - `domain_not_allowed`:
    - `title: "Email không thuộc hệ thống Nhà trường"`
    - `message:`
      - Có email: `Tài khoản không thuộc miền @cdktcnqn.edu.vn (email của Thầy/Cô: ${email}). Vui lòng sử dụng địa chỉ email do Nhà trường cấp để đăng nhập.`
      - Không có email: `Tài khoản không thuộc miền @cdktcnqn.edu.vn được cấp phép. Vui lòng sử dụng email công vụ nhà trường được cấp để đăng nhập.`
    - `actionText: "Thử lại bằng tài khoản trường"`
  - `account_disabled`:
    - `title: "Tài khoản bị tạm khóa"`
    - `message: "Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa. Vui lòng liên hệ Phòng Quản trị Mạng và CNTT (email: qtm@cdktcnqn.edu.vn) để được hỗ trợ."`
  - `oauth_cancelled`:
    - `title: "Đã dừng thao tác đăng nhập"`
    - `message: "Bạn đã hủy quá trình đăng nhập bằng Google. Vui lòng thử lại khi sẵn sàng."`
  - `oauth_not_configured`:
    - `title: "Hệ thống đăng nhập chưa kích hoạt"`
    - `message: "Hệ thống chưa cấu hình Google OAuth. Thầy/Cô vui lòng liên hệ Trung tâm Số & Truyền thông hoặc Quản trị mạng Nhà trường để được hỗ trợ."`
  - `oauth_failed` / default:
    - `title: "Đăng nhập không thành công"`
    - `message: "Đã xảy ra lỗi trong quá trình xác thực với Google. Thầy/Cô vui lòng thử lại sau hoặc liên hệ hỗ trợ."`

- [ ] **Step 2: Chạy kiểm thử logic lỗi login**
  Run: `npx tsx --test tests/login-page.test.ts`
  Expected: Vẫn PASS các test `resolveOAuthError` vì bảo toàn các từ khóa kiểm tra.

---

### Task 2: Chuẩn hóa Nhãn & Trợ Năng trong `src/components/auth/google-login-button.tsx`

**Files:**
- Modify: `src/components/auth/google-login-button.tsx:86-234`
- Test: `tests/google-login-button.test.ts`

**Interfaces:**
- Consumes: Component `GoogleLoginButton({ className }: GoogleLoginButtonProps)`
- Produces: Nút bấm đăng nhập rõ ràng, nhãn thân thiện cho Giảng viên; modal cảnh báo dev chuẩn mực không dùng từ dev khó hiểu.

- [ ] **Step 1: Cập nhật nhãn nút bấm và aria-label trong `GoogleLoginButton`**
  Trong `src/components/auth/google-login-button.tsx`:
  - `aria-label`: Đổi từ `"Đăng nhập bằng tài khoản Google Workspace trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (@cdktcnqn.edu.vn)"` ➔ `"Đăng nhập bằng email trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (@cdktcnqn.edu.vn)"`.
  - Trạng thái loading: Đổi từ `"Đang kết nối Google Workspace..."` ➔ `"Đang chuyển hướng đăng nhập..."`.
  - Trạng thái bình thường: Đổi từ `"Đăng nhập với Google Workspace"` ➔ `"Đăng nhập bằng Email trường"`.

- [ ] **Step 2: Cập nhật nội dung modal dev hướng dẫn cấu hình (Development Guidance Modal)**
  - Dòng 148: Tiêu đề `"Cấu hình dịch vụ đăng nhập Google"` (thay cho `"Cấu hình Google Workspace OAuth"`).
  - Dòng 150: `"Dịch vụ xác thực tài khoản tập trung dành cho Nhà trường"` (thay cho `"Dịch vụ xác thực định danh tập trung..."`).
  - Dòng 198: `"Quy định tài khoản đăng nhập:"` (thay cho `"Chính sách định danh tài khoản:"`).
  - Dòng 202: `"Đăng nhập bằng tài khoản email trường do Nhà trường quản lý."`.
  - Dòng 205: `"Tài khoản cán bộ, giảng viên có đuôi @cdktcnqn.edu.vn được tự động phân quyền theo đơn vị công tác."`.

- [ ] **Step 3: Cập nhật assertion trong `tests/google-login-button.test.ts`**
  - Cập nhật dòng 33 khớp với `aria-label` mới:
    ```typescript
    assert.ok(
      content.includes(
        'aria-label="Đăng nhập bằng email trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (@cdktcnqn.edu.vn)"'
      )
    );
    ```

- [ ] **Step 4: Chạy kiểm thử GoogleLoginButton**
  Run: `npx tsx --test tests/google-login-button.test.ts`
  Expected: PASS 100%.

---

### Task 3: Chuẩn hóa Giao diện Đăng nhập `src/app/login/page.tsx`

**Files:**
- Modify: `src/app/login/page.tsx:135-255`
- Test: `tests/login-page.test.ts`

**Interfaces:**
- Consumes: `LoginPage()` và `LoginFormContent()`
- Produces: Giao diện Đăng nhập chuẩn công sở sư phạm, sạch sẽ, không chứa thuật ngữ kỹ thuật SSO / Google Identity.

- [ ] **Step 1: Thay thế các đoạn văn bản kỹ thuật trong `src/app/login/page.tsx`**
  - **Header góc phải (Dòng 140):**
    Đổi `"Cổng Đăng nhập Tập trung"` ➔ `"Cổng Thông tin Nội bộ"`
  - **Tiêu đề phụ Login Card (Dòng 226):**
    Đổi `"Cổng đăng nhập tập trung SSO duy nhất dành cho Cán bộ, Giảng viên & Nhân viên Nhà trường."`
    ➔ `"Cổng làm việc điện tử dành cho Cán bộ, Giảng viên và Nhân viên Nhà trường."`
  - **Dòng bảo mật (Dòng 239):**
    Đổi `"Xác thực an toàn qua Google Identity"`
    ➔ `"Đăng nhập an toàn bằng tài khoản Nhà trường"` (giữ nguyên icon `ShieldCheck` màu `text-emerald-600`).
  - **Nhắc nhở tên miền (Dòng 233-234):**
    Giữ nguyên `"Áp dụng cho tài khoản email @cdktcnqn.edu.vn"` vì đây là hướng dẫn nghiệp vụ chuẩn, rõ ràng.
  - **Footer trang (Dòng 248-253):**
    Giữ nguyên `"Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn"` và `"Hỗ trợ kỹ thuật: Trung tâm Số & Truyền thông"`.

- [ ] **Step 2: Cập nhật assertion trong `tests/login-page.test.ts`**
  - Cập nhật dòng 318 trong `tests/login-page.test.ts`:
    ```typescript
    assert.ok(
      loginContent.includes(
        "Cổng làm việc điện tử dành cho Cán bộ, Giảng viên và Nhân viên Nhà trường."
      )
    );
    ```

- [ ] **Step 3: Chạy kiểm thử Login Page**
  Run: `npx tsx --test tests/login-page.test.ts`
  Expected: PASS 100%.

---

### Task 4: Chuẩn hóa Topbar, Sidebar Menu & Microcopy

**Files:**
- Modify: `src/components/layout/app-topbar.tsx:345-425`
- Modify: `src/components/navigation.tsx:465-472`
- Test: `tests/app-layout.test.ts`, `tests/topbar-scope-switcher-integration.test.ts`

**Interfaces:**
- Consumes: Component `AppTopbar`, Component `Navigation`
- Produces: Thanh điều hướng và sidebar loại bỏ badge `PWA`, bỏ từ mượn tiếng Anh `(Onboarding)`, tooltip thân thiện.

- [ ] **Step 1: Cập nhật các văn bản trong `src/components/layout/app-topbar.tsx` và `src/components/navigation.tsx`**
  - `src/components/layout/app-topbar.tsx`:
    - Dòng 351: Tooltip huy hiệu email: Đổi `title="Đã xác thực Google Workspace"` ➔ `title="Tài khoản email trường đã xác minh"`.
    - Dòng 403: Bỏ huy hiệu `<span className="... text-[10px] ...">PWA</span>`, chỉ để nhãn mục là `"Cài đặt ứng dụng di động"`.
    - Dòng 418: Đổi `"Hướng dẫn làm quen (Onboarding)"` ➔ `"Hướng dẫn sử dụng hệ thống"`.
  - `src/components/navigation.tsx`:
    - Dòng 468: Tooltip huy hiệu email: Đổi `title="Đã xác thực Google Workspace"` ➔ `title="Tài khoản email trường đã xác minh"`.

- [ ] **Step 2: Chạy kiểm thử Topbar & Navigation**
  Run: `npx tsx --test tests/app-layout.test.ts tests/topbar-scope-switcher-integration.test.ts`
  Expected: PASS 100%.

---

### Task 5: Kiểm tra Toàn diện Hệ thống & Đảm bảo Không Lỗi Hồi Quy

**Files:**
- Toàn bộ các file kiểm thử liên quan:
  - `tests/login-page.test.ts`
  - `tests/google-login-button.test.ts`
  - `tests/api-auth-callback-google.test.ts`
  - `tests/app-layout.test.ts`
  - `tests/anti-slop-audit.test.ts`

- [ ] **Step 1: Kiểm tra lỗi TypeScript tĩnh**
  Run: `npm run typecheck`
  Expected: Exit code 0, không có lỗi kiểu dữ liệu.

- [ ] **Step 2: Chạy kiểm thử các bài test liên quan trực tiếp**
  Run: `npx tsx --test tests/login-page.test.ts tests/google-login-button.test.ts tests/api-auth-callback-google.test.ts tests/app-layout.test.ts`
  Expected: PASS toàn bộ subtests.

- [ ] **Step 3: Chạy toàn bộ test suite của dự án**
  Run: `npm test`
  Expected: Tất cả bài test đều xanh.
