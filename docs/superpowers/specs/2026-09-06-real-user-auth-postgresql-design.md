# Tài liệu Thiết kế Kiến trúc: Hệ thống Người dùng Thật với PostgreSQL & NextAuth v5

- **Ngày ban hành**: 2026-09-06
- **Dự án**: QCET E-Office v1.2 Enterprise
- **Trạng thái**: Draft / Đã thông qua thảo luận thiết kế
- **Tác giả**: Claude & Đội ngũ Kỹ thuật QCET

---

## 1. Bối cảnh & Mục tiêu

### 1.1. Hiện trạng
Hệ thống QCET E-Office hiện đang hoạt động ở chế độ mô phỏng dữ liệu người dùng (mock data):
- Tài khoản người dùng lưu trữ trong bộ nhớ tạm và `localStorage` phía trình duyệt (`qcet_active_user`, `qcet_registered_users`).
- Dữ liệu vai trò và thông tin cá nhân dựa trên danh sách tĩnh `DEFAULT_DEMO_USERS`.
- Đăng nhập Google hiện tại là modal giả lập (`GoogleLoginButton`) chỉ tạo user giả lưu vào trình duyệt.
- Chưa có cơ chế lưu trữ bền vững (persistent database), chưa mã hóa mật khẩu và chưa hỗ trợ phiên đăng nhập server-side bảo mật.

### 1.2. Mục tiêu
1. **Chuyển đổi sang CSDL thật**: Cài đặt và tích hợp PostgreSQL 16 cục bộ (qua Homebrew) kết hợp Prisma ORM.
2. **Cơ chế xác thực an toàn**: Sử dụng NextAuth v5 (Auth.js) hoặc JWT HTTP-only Cookie với mã hóa mật khẩu chuẩn `bcrypt`.
3. **Quản lý danh tính & Phân quyền (RBAC)**: Hỗ trợ tạo tài khoản thật, đăng nhập bằng Email/Mật khẩu thật, liên kết phòng ban (`Department`) và vai trò (`BAN_GIAM_HIEU`, `TRUONG_PHONG`, `CHUYEN_VIEN`, `ADMIN`).
4. **Sẵn sàng Google SSO**: Tích hợp sẵn kiến trúc Google OAuth Provider, chỉ cần bổ sung `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` là vận hành tức thì.

---

## 2. Kiến trúc Hạ tầng & Cơ sở dữ liệu

### 2.1. Hạ tầng PostgreSQL Local
- **Công cụ**: PostgreSQL 16 (cài đặt và quản lý qua `brew services`).
- **Database Name**: `qcet_eoffice`.
- **Cổng mặc định**: `5432`.
- **Cấu hình môi trường (`.env.local`)**:
  ```env
  DATABASE_URL="postgresql://dnhhuy@localhost:5432/qcet_eoffice?schema=public"
  NEXTAUTH_SECRET="qcet_eoffice_enterprise_secret_key_2026_jwt_session"
  NEXTAUTH_URL="http://localhost:3000"
  
  # Google OAuth (Tùy chọn - kích hoạt tự động khi có key)
  GOOGLE_CLIENT_ID=""
  GOOGLE_CLIENT_SECRET=""
  ```

### 2.2. Lược đồ CSDL (Prisma Schema)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum UserRole {
  BAN_GIAM_HIEU
  TRUONG_PHONG
  CHUYEN_VIEN
  ADMIN
}

model Department {
  id          String   @id @db.VarChar(50) // VD: CNTT, TCHC, KHTC
  name        String   @db.VarChar(255)
  shortName   String?  @db.VarChar(50)
  color       String?  @db.VarChar(20)
  users       User[]
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("departments")
}

model User {
  id             String      @id @default(cuid())
  email          String      @unique @db.VarChar(255)
  name           String      @db.VarChar(255)
  passwordHash   String?     @map("password_hash") // Null nếu dùng SSO thuần
  role           UserRole    @default(CHUYEN_VIEN)
  departmentId   String?     @map("department_id") @db.VarChar(50)
  department     Department? @relation(fields: [departmentId], references: [id])
  title          String?     @db.VarChar(150)
  phone          String?     @db.VarChar(20)
  avatarUrl      String?     @map("avatar_url")
  provider       String      @default("credentials") @db.VarChar(50)
  isActive       Boolean     @default(true) @map("is_active")
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  accounts       Account[]
  sessions       Session[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

---

## 3. Kiến trúc Xác thực & Luồng dữ liệu (Auth Flow)

### 3.1. Luồng Đăng ký & Đăng nhập (Credentials)
1. **Đăng ký / Khởi tạo**:
   - Client gửi `POST /api/auth/register` với `{ email, password, name, departmentId, title }`.
   - Server kiểm tra tính duy nhất của `email`, băm mật khẩu bằng `bcryptjs` (salt rounds: 10).
   - Lưu bản ghi vào bảng `users`.
2. **Đăng nhập**:
   - Client gọi hàm login hoặc form submit `POST /api/auth/login`.
   - Server truy vấn người dùng trong PostgreSQL, kiểm tra `passwordHash`.
   - Thiết lập JWT session cookie bảo mật (HTTP-Only, Secure trên Production, SameSite: Lax).
   - Trả về payload người dùng đã chuẩn hóa.

### 3.2. Luồng Google OAuth (SSO)
- Thiết lập NextAuth Google Provider tại `src/auth.ts` hoặc `src/app/api/auth/[...nextauth]/route.ts`.
- Nếu cấu hình biến môi trường `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET`:
  - Nút "Đăng nhập bằng Google" điều hướng tới trang cấp quyền của Google Accounts.
  - Sau khi callback thành công, tự động liên kết hoặc tạo người dùng mới với domain `@qcet.edu.vn`.
- Nếu chưa có key:
  - Giao diện hiển thị hướng dẫn trực quan hoặc cho phép chuyển qua chế độ đăng nhập bằng tài khoản nội bộ thật.

### 3.3. Đồng bộ Client Context (`useAuth`)
- Cập nhật `src/lib/auth-context.tsx`:
  - Fetch thông tin session từ `/api/auth/session` (hoặc hook `useSession`).
  - Cung cấp các hàm `login(email, password)`, `register(data)`, `logout()` gọi trực tiếp API server thật.
  - Loại bỏ hoàn toàn sự phụ thuộc vào `localStorage` cho việc duy trì quyền hạn người dùng.

---

## 4. Kịch bản Dữ liệu Mồi (Seeding Data)

Tạo script `prisma/seed.ts` để tự động khởi tạo dữ liệu phòng ban chuẩn và 3 tài khoản mẫu ban đầu:

| Email | Mật khẩu mặc định | Họ tên | Vai trò | Phòng ban | Chức vụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `bgh@qcet.edu.vn` | `Qcet@2026` | TS. Nguyễn Văn Hiệu | `BAN_GIAM_HIEU` | `BGH` | Hiệu trưởng |
| `cntt.lead@qcet.edu.vn` | `Qcet@2026` | ThS. Lê Hoàng Nam | `TRUONG_PHONG` | `CNTT` | Trưởng phòng QTM & CNTT |
| `chuyenvien@qcet.edu.vn` | `Qcet@2026` | Kỹ sư Trần Hùng | `CHUYEN_VIEN` | `CNTT` | Chuyên viên mạng & an toàn thông tin |

---

## 5. Kế hoạch Kiểm thử & Tiêu chuẩn Chất lượng

1. **Kiểm thử Kết nối Database**:
   - Migration Prisma tạo đúng các bảng trên PostgreSQL local.
   - Script seed nạp dữ liệu thành công không lỗi.
2. **Kiểm thử Bảo mật & API**:
   - Mật khẩu lưu trong DB bắt buộc phải là chuỗi hash, không lưu plain-text.
   - Không thể đăng ký trùng email.
   - Sai mật khẩu từ chối truy cập với mã 401.
   - Đăng nhập thành công trả về cookie session hợp lệ.
3. **Quy chuẩn Anti-Slop & UI**:
   - Giao diện đăng nhập/đăng ký tuân thủ 100% quy chuẩn UI hiện tại (zero emoji, font-mono tabular-nums, stroke-width 1.5).
   - Chuyển đổi mượt mà giữa các trang, không làm gãy các components hiện có (`cascading-task-table`, `app-topbar`, `app-sidebar`).
