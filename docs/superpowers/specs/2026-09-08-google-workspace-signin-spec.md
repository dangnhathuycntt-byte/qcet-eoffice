# Thiết Kế Kỹ Thuật: Đăng Nhập Google Workspace (@cdktcnqn.edu.vn) Cho QCET E-Office

- **Tài liệu:** Kế hoạch kiến trúc & đặc tả kỹ thuật
- **Ngày lập:** 2026-09-08
- **Phiên bản:** 1.0.0
- **Trạng thái:** Đã phê duyệt (Approved)
- **Cơ quan:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)

---

## 1. Tổng Quan & Mục Tiêu (Executive Summary)

### 1.1. Bối cảnh
Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET) sử dụng nền tảng **Google Workspace for Education** làm hạ tầng định danh và thư điện tử chính thức của toàn bộ cán bộ, giảng viên, nhân viên với tên miền `@cdktcnqn.edu.vn`. (Đã được xác thực qua hệ thống bản ghi DNS MX: `ASPMX.L.GOOGLE.COM`, `ALT1.ASPMX.L.GOOGLE.COM`).

Hiện tại, giao diện đăng nhập của QCET E-Office đã có nút *"Đăng nhập với Google Workspace"*, nhưng backend chưa có route xử lý callback OAuth 2.0, chưa liên kết dữ liệu với Prisma `User`/`Account`, và chưa có cơ chế kiểm tra tên miền trường học nghiêm ngặt.

### 1.2. Mục tiêu kỹ thuật
1. **Bảo mật tuyệt đối (Security First):** Triển khai luồng OAuth 2.0 Authorization Code Grant với tham số `state` chống CSRF (RFC 6749 Section 10.12).
2. **Kiểm soát định danh công vụ (Domain Restriction):** Chỉ cho phép duy nhất các tài khoản Google thuộc tên miền chính thức `@cdktcnqn.edu.vn`. Từ chối toàn bộ email cá nhân (`@gmail.com`) hoặc email ngoài tổ chức.
3. **Liên kết tài khoản thông minh (Seamless Account Linking):**
   - Nếu cán bộ đã có tài khoản mật khẩu nội bộ: Tự động liên kết Google `Account` mà không làm thay đổi phân quyền hay dữ liệu công việc.
   - Nếu cán bộ đăng nhập lần đầu: Tự động khởi tạo `User` mới với vai trò `CHUYEN_VIEN` và cập nhật ảnh đại diện từ Google.
4. **Chuẩn hóa UI/UX theo Google Branding Guidelines:** Đáp ứng bộ quy chuẩn thương hiệu chính thức của Google (nút 48px, Super G logo, typography chuẩn, trạng thái loading mượt mà, thông báo lỗi bằng tiếng Việt rõ ràng, hỗ trợ PWA mobile).

---

## 2. Kiến Trúc Xác Thực (OAuth 2.0 Architecture)

```
[ Trình duyệt Cán bộ ]
         │
         │  1. Bấm "Đăng nhập với Google Workspace"
         ▼
[ Next.js API: GET /api/auth/google ]
         │
         │  2. Sinh state = crypto.randomUUID()
         │  3. Ghi cookie HttpOnly: qcet_oauth_state
         │  4. HTTP 302 Redirect sang Google (kèm hd=cdktcnqn.edu.vn)
         ▼
[ Google OAuth 2.0 Authorization Server ]
         │
         │  5. Cán bộ chọn tài khoản @cdktcnqn.edu.vn & cấp quyền
         │  6. Chuyển hướng về /api/auth/callback/google?code=...&state=...
         ▼
[ Next.js API: GET /api/auth/callback/google ]
         │
         │  7. Xác thực state chống CSRF
         │  8. POST https://oauth2.googleapis.com/token (đổi code lấy tokens)
         │  9. GET https://www.googleapis.com/oauth2/v3/userinfo
         │  10. KIỂM TRA TÊN MIỀN: email.endsWith("@cdktcnqn.edu.vn")
         │      - Thất bại -> 302 Redirect /login?error=domain_not_allowed
         │  11. Đối soát Prisma DB (User & Account):
         │      - Tìm Account(provider='google', providerAccountId=sub)
         │      - Hoặc tìm User(email) -> Tạo Account liên kết
         │      - Hoặc tạo mới User(CHUYEN_VIEN) + Account
         │  12. Kiểm tra user.isActive === true
         │  13. Ký JWT qcet_session & xóa qcet_oauth_state
         │  14. 302 Redirect về "/" (Trang điều hành E-Office)
         ▼
[ Trang Chủ E-Office / ]
```

---

## 3. Đặc Tả Chi Tiết Các Endpoint

### 3.1. Endpoint Khởi Tạo: `GET /api/auth/google`
- **Mục đích:** Khởi tạo phiên OAuth 2.0 an toàn từ server, b��o vệ Secret và sinh tham số chống giả mạo.
- **Quy trình:**
  1. Đọc biến môi trường `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`.
  2. Nếu thiếu cấu hình: Trả về HTTP 302 Redirect `/login?error=oauth_not_configured`.
  3. Sinh `state = crypto.randomUUID()`.
  4. Lưu cookie `qcet_oauth_state`:
     - `value`: `state`
     - `httpOnly`: `true`
     - `sameSite`: `"lax"`
     - `secure`: `process.env.NODE_ENV === "production"`
     - `maxAge`: `300` (5 phút)
     - `path`: `/api/auth`
  5. Xây dựng Google Authorization URL:
     ```
     https://accounts.google.com/o/oauth2/v2/auth?
       client_id=${GOOGLE_CLIENT_ID}&
       redirect_uri=${BASE_URL}/api/auth/callback/google&
       response_type=code&
       scope=openid%20email%20profile&
       state=${state}&
       hd=cdktcnqn.edu.vn&
       prompt=select_account&
       access_type=offline
     ```
  6. Phản hồi HTTP 302 Redirect tới URL trên.

### 3.2. Endpoint Tiếp Nhận Callback: `GET /api/auth/callback/google`
- **Mục đích:** Xử lý kết quả trả về từ Google, xác minh thông tin, liên kết dữ liệu và cấp phát phiên đăng nhập.
- **Các bước xác thực:**
  1. **Kiểm tra lỗi từ Google:** Nếu query có `error` (ví dụ `access_denied`):
     - Xóa cookie `qcet_oauth_state`.
     - Redirect `/login?error=oauth_cancelled`.
  2. **Kiểm tra CSRF State:**
     - So sánh `query.state` với cookie `qcet_oauth_state`.
     - Nếu không khớp hoặc thiếu: Xóa cookie, redirect `/login?error=invalid_state`.
  3. **Trao đổi Authorization Code:**
     - Gọi `POST https://oauth2.googleapis.com/token`:
       - Body: `code`, `client_id`, `client_secret`, `redirect_uri`, `grant_type: "authorization_code"`.
     - Nhận về: `access_token`, `id_token`, `refresh_token`, `expires_in`.
     - Nếu thất bại: Redirect `/login?error=oauth_token_exchange_failed`.
  4. **Lấy thông tin người dùng:**
     - Gọi `GET https://www.googleapis.com/oauth2/v3/userinfo` với `Authorization: Bearer ${access_token}`.
     - Dữ liệu nhận về:
       - `sub` (Google Account ID)
       - `email` (Email người dùng)
       - `email_verified` (Boolean)
       - `name` (Họ và tên đầy đủ)
       - `picture` (Ảnh đại diện Google)
       - `hd` (Hosted domain)
  5. **Thẩm định Tên miền & Trạng thái email:**
     - Yêu cầu: `email_verified === true`.
     - Yêu cầu: `email.toLowerCase().endsWith("@cdktcnqn.edu.vn")`.
     - Nếu vi phạm (ví dụ dùng `@gmail.com` hoặc trường khác):
       - Redirect: `/login?error=domain_not_allowed&email=${encodeURIComponent(email)}`.
  6. **Cập nhật & Đồng bộ CSDL (Prisma Transaction):**
     - Bước A: Kiểm tra xem đã có bản ghi `Account` với `provider = "google"` và `providerAccountId = sub` chưa.
     - Bước B: Nếu chưa có `Account`, kiểm tra `User` qua `email.toLowerCase()`:
       - **Nếu đã có User:** Tạo bản ghi `Account` mới trỏ đến `userId = user.id`. Nếu `user.avatarUrl` rỗng thì cập nhật bằng `picture`.
       - **Nếu chưa có User:** Tạo mới `User`:
         - `email`: `email.toLowerCase()`
         - `name`: `googleUserInfo.name || email.split("@")[0]`
         - `role`: `UserRole.CHUYEN_VIEN`
         - `avatarUrl`: `googleUserInfo.picture`
         - `provider`: `"google"`
         - `isActive`: `true`
         - Đồng thời tạo bản ghi `Account` liên kết.
  7. **Kiểm tra trạng thái kích hoạt:**
     - Nếu `user.isActive === false`: Redirect `/login?error=account_disabled`.
  8. **Cấp phát Session:**
     - Ký JWT qua `signSessionToken({ id, email, name, role, departmentId, title })`.
     - Ghi cookie `qcet_session` (maxAge 7 ngày, HttpOnly, SameSite lax).
     - Xóa cookie `qcet_oauth_state`.
     - Redirect về `/`.

---

## 4. Đặc Tả Giao Diện & Trải Nghiệm Người Dùng (UI/UX)

### 4.1. Nút Bấm Đăng Nhập Google (`GoogleLoginButton`)
- **Vị trí:** Trang `/login`, nằm phía trên khối đăng nhập mật khẩu nội bộ.
- **Đặc điểm hiển thị:**
  - Nền trắng `bg-background`, viền mềm `border-border/80`, bo góc `rounded-xl`.
  - Chiều cao 48px, căn giữa nội dung.
  - Biểu tượng Google Super G chuẩn 4 màu (20x20px).
  - Nhãn nút: **"Đăng nhập với Google Workspace"** (font-semibold, màu `text-foreground`).
  - Huy hiệu (Badge) tên miền: Nền xanh nhạt `bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5 rounded-md font-mono` với nội dung `@cdktcnqn.edu.vn`.
- **Trạng thái Loading:**
  - Khi bấm, nút tự động khóa `disabled={isLoading}`.
  - Hiển thị spinner xoay `Loader2` màu xanh primary.
  - Nhãn đổi sang: *"Đang chuyển hướng tới Google Workspace..."*.
- **Trạng thái chưa cấu hình (Local Dev/Admin Modal):**
  - Nếu `GOOGLE_CLIENT_ID` chưa có trong môi trường máy chủ: Hiển thị Modal hỗ trợ cấu hình với nút sao chép `Authorized Redirect URI`:
    `http://localhost:3001/api/auth/callback/google`.

### 4.2. Khối Thông Báo Lỗi Trực Quan Trên `/login`
Trang `/login` sẽ đọc query param `?error=...` và render khung cảnh báo chuyên nghiệp:
1. **Lỗi `domain_not_allowed`:**
   - Hộp màu hổ phách/cam (Amber Alert): `border-amber-300 bg-amber-50 text-amber-950`.
   - Icon: `ShieldAlert` (20px, màu `text-amber-600`).
   - Tiêu đề: **"Tên miền email không được phép"**.
   - Nội dung: *"Tài khoản **[email]** không thuộc tổ chức Google Workspace của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (`@cdktcnqn.edu.vn`)."*
   - Hành động: Nút bấm *"Thử lại bằng tài khoản công vụ trường"* (kích hoạt lại luồng Google OAuth với tài khoản khác).
2. **Lỗi `account_disabled`:**
   - Hộp màu đỏ (Red Alert): `border-red-300 bg-red-50 text-red-950`.
   - Icon: `Lock` (20px, màu `text-red-600`).
   - Tiêu đề: **"Tài khoản cán bộ bị tạm khóa"**.
   - Nội dung: *"Tài khoản của bạn đang bị tạm ngưng hoặc chưa kích hoạt. Vui lòng liên hệ Bộ phận Quản trị mạng & CNTT."*
3. **Lỗi `oauth_cancelled`:**
   - Hộp màu xám trung tính (Slate Alert): `border-slate-200 bg-slate-50 text-slate-800`.
   - Tiêu đề: **"Đã hủy đăng nhập"**.
   - Nội dung: *"Quá trình xác thực với tài khoản Google đã dừng lại."*

---

## 5. Cấu Hình Biến Môi Trường (Environment Variables)

Cập nhật vào `.env.production.example` và hướng dẫn trong `.env.local`:
```bash
# ==============================================================================
# CẤU HÌNH GOOGLE WORKSPACE OAUTH 2.0 (@cdktcnqn.edu.vn)
# ==============================================================================
# Client ID được tạo từ Google Cloud Console (Web application)
GOOGLE_CLIENT_ID="xxxx-xxxx.apps.googleusercontent.com"

# Client Secret tương ứng
GOOGLE_CLIENT_SECRET="GOCSPX-xxxx"

# Tên miền bắt buộc của trường (mặc định: cdktcnqn.edu.vn)
AUTH_ALLOWED_DOMAINS="cdktcnqn.edu.vn"

# Client-side flag (tùy chọn để hiển thị trạng thái trên nút)
NEXT_PUBLIC_GOOGLE_CLIENT_ID="xxxx-xxxx.apps.googleusercontent.com"
```

---

## 6. Hướng Dẫn Thiết Lập Google Cloud Console (Dành Cho Quản Trị Viên)

1. Truy cập **Google Cloud Console** (`console.cloud.google.com`) bằng tài khoản Quản trị viên của trường (`... @cdktcnqn.edu.vn`).
2. Tạo dự án mới: `QCET E-Office`.
3. Vào mục **APIs & Services > OAuth consent screen**:
   - Chọn loại người dùng: **Internal (Nội bộ tổ chức)** *(Rất quan trọng: Bỏ qua hoàn toàn quy trình xét duyệt của Google, không bị cảnh báo Unverified app)*.
   - Tên ứng dụng: `QCET E-Office`.
   - Email hỗ trợ người dùng: `qcet@cdktcnqn.edu.vn` (hoặc email phòng CNTT).
4. Chọn phạm vi (Scopes): `openid`, `email`, `profile`.
5. Vào mục **Credentials > Create Credentials > OAuth client ID**:
   - Application type: **Web application**.
   - Name: `QCET E-Office Web Client`.
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `http://localhost:3001`
     - `https://e-office.cdktcnqn.edu.vn`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `http://localhost:3001/api/auth/callback/google`
     - `https://e-office.cdktcnqn.edu.vn/api/auth/callback/google`
6. Sao chép Client ID và Client Secret vào file cấu hình hệ thống.

---

## 7. Kế Hoạch Kiểm Thử Tự Động (Testing Strategy)

Xây dựng bộ kiểm thử `tests/google-oauth.test.ts` đảm bảo đạt 100% tỷ lệ pass:
1. **Kiểm thử logic xác thực tên miền (Domain Policy Test):**
   - `@cdktcnqn.edu.vn` -> Hợp lệ (Cho phép).
   - `@gmail.com` -> Bị từ chối (Domain not allowed).
   - `@qcet.edu.vn` hoặc `@yahoo.com` -> Bị từ chối (Chỉ chấp nhận `@cdktcnqn.edu.vn`).
2. **Kiểm thử Route `GET /api/auth/google`:**
   - Đảm bảo sinh cookie `qcet_oauth_state` với cờ `HttpOnly`, `SameSite=lax`.
   - URL chuyển hướng phải chứa `hd=cdktcnqn.edu.vn`, `prompt=select_account`, `state`.
3. **Kiểm thử Route `GET /api/auth/callback/google`:**
   - Trường hợp thiếu hoặc sai `state` -> Trả về lỗi `invalid_state`.
   - Trường hợp Google trả về `error=access_denied` -> Trả về lỗi `oauth_cancelled`.
   - Trường hợp email ngoài trường -> Trả về lỗi `domain_not_allowed`.
   - Trường hợp hợp lệ -> Tạo/liên kết tài khoản và cấp cookie `qcet_session`.
4. **Kiểm thử UI `/login` và `GoogleLoginButton`:**
   - Nút có nhãn, badge `@cdktcnqn.edu.vn`, và hỗ trợ trạng thái loading.
   - Bắt các tham số URL `?error=` để hiển thị thông báo tương ứng.
