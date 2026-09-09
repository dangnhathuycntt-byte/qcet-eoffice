---
status: completed
domain: security
created: 2026-09-06
---

# Kế hoạch Triển khai: Hệ thống Người dùng Thật với PostgreSQL & Xác thực Session

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn bộ hệ thống quản lý danh tính và người dùng từ mock data/localStorage sang cơ sở dữ liệu PostgreSQL 16 cục bộ thật với Prisma ORM, mã hóa mật khẩu bcrypt, phiên đăng nhập an toàn (HTTP-Only Cookie) và sẵn sàng tích hợp Google OAuth.

**Architecture:** Sử dụng PostgreSQL 16 (Homebrew) làm CSDL chính. Prisma ORM ánh xạ các bảng `departments` và `users`. Phía server cung cấp các Route Handler `/api/auth/*` với mã hóa bcrypt và JWT Session Cookie. Phía client, `AuthProvider` đồng bộ trực tiếp với CSDL qua API thật, thay thế hoàn toàn `localStorage`.

**Tech Stack:** Next.js 15 App Router, React 19, PostgreSQL 16, Prisma ORM, bcryptjs, jsonwebtoken, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-06-real-user-auth-postgresql-design.md`

## Global Constraints

- Zero decorative emojis in src directory (Anti-slop rule).
- Icon stroke widths strictly adhere to 1.5 standard.
- Tabular numerals (`tabular-nums font-mono`) applied to numeric metrics and dates.
- CSS design tokens define OKLCH/sRGB color spaces and elevation levels.
- Mật khẩu lưu trong CSDL bắt buộc phải băm qua `bcryptjs` (salt rounds: 10), tuyệt đối không lưu plain text.
- Cookie session phải có cờ `HttpOnly`, `SameSite=Lax`, `Path=/`.

---

### Task 1: Thiết lập PostgreSQL 16 Local, Prisma ORM & Schema CSDL

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Modify: `.env.local`
- Modify: `package.json`
- Test: `tests/database-schema-contract.test.ts`

**Interfaces:**
- Produces: `prisma` client instance exported from `src/lib/prisma.ts`
- Models: `Department`, `User`, `UserRole`, `Account`, `Session`

- [ ] **Step 1: Viết test hợp đồng CSDL ban đầu (Failing test)**

Tạo file `tests/database-schema-contract.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Database & Prisma Schema Contract", () => {
  test("schema.prisma must define PostgreSQL datasource and User model", () => {
    const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
    assert.ok(fs.existsSync(schemaPath), "prisma/schema.prisma must exist");

    const content = fs.readFileSync(schemaPath, "utf-8");
    assert.match(content, /provider\s*=\s*"postgresql"/, "datasource provider must be postgresql");
    assert.match(content, /model\s+User/, "User model must be defined");
    assert.match(content, /model\s+Department/, "Department model must be defined");
    assert.match(content, /enum\s+UserRole/, "UserRole enum must be defined");
    assert.match(content, /BAN_GIAM_HIEU/, "UserRole must contain BAN_GIAM_HIEU");
    assert.match(content, /TRUONG_PHONG/, "UserRole must contain TRUONG_PHONG");
    assert.match(content, /CHUYEN_VIEN/, "UserRole must contain CHUYEN_VIEN");
  });

  test("src/lib/prisma.ts singleton must exist", () => {
    const prismaFilePath = path.resolve(process.cwd(), "src/lib/prisma.ts");
    assert.ok(fs.existsSync(prismaFilePath), "src/lib/prisma.ts must exist");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test fail**

Run: `npx tsx --test tests/database-schema-contract.test.ts`
Expected: FAIL do chưa có `prisma/schema.prisma` và `src/lib/prisma.ts`.

- [ ] **Step 3: Cài đặt PostgreSQL 16 và các thư viện cần thiết**

Khởi chạy service PostgreSQL local:
```bash
brew install postgresql@16 && brew services start postgresql@16
/opt/homebrew/opt/postgresql@16/bin/createdb qcet_eoffice || true
```

Cài đặt Prisma & Auth dependencies:
```bash
npm install @prisma/client bcryptjs jsonwebtoken
npm install -D prisma @types/bcryptjs @types/jsonwebtoken
```

- [ ] **Step 4: Cấu hình biến môi trường & tạo Prisma Schema**

Cập nhật `.env.local`:
```env
DATABASE_URL="postgresql://dnhhuy@localhost:5432/qcet_eoffice?schema=public"
JWT_SECRET="qcet_eoffice_enterprise_jwt_secret_key_2026_super_safe"
```

Tạo `prisma/schema.prisma`:
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
  id          String   @id @db.VarChar(50)
  name        String   @db.VarChar(255)
  shortName   String?  @map("short_name") @db.VarChar(50)
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
  passwordHash   String?     @map("password_hash")
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

Tạo `src/lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Đẩy schema vào CSDL:
```bash
npx prisma db push
```

- [ ] **Step 5: Chạy lại test hợp đồng CSDL**

Run: `npx tsx --test tests/database-schema-contract.test.ts`
Expected: PASS (2/2 tests pass).

- [ ] **Step 6: Commit Task 1**

```bash
git add prisma/schema.prisma src/lib/prisma.ts tests/database-schema-contract.test.ts package.json package-lock.json
git commit -m "feat(db): setup postgresql schema and prisma client integration"
```

---

### Task 2: Tiện ích Bảo mật Mật khẩu & Kịch bản Nạp Dữ liệu Mồi (Seed Script)

**Files:**
- Create: `src/lib/password.ts`
- Create: `prisma/seed.ts`
- Modify: `package.json`
- Test: `tests/password-security-and-seed.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`
- Produces: `verifyPassword(password: string, hash: string): Promise<boolean>`
- Produces: `seedDatabase(): Promise<void>` in `prisma/seed.ts`

- [ ] **Step 1: Viết test bảo mật băm mật khẩu (Failing test)**

Tạo file `tests/password-security-and-seed.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password";

describe("Password Security Utilities", () => {
  test("hashPassword should produce a valid bcrypt hash different from plain text", async () => {
    const raw = "Qcet@2026";
    const hashed = await hashPassword(raw);

    assert.notEqual(hashed, raw);
    assert.match(hashed, /^\$2[aby]\$\d+\$/, "Must be a valid bcrypt hash signature");
  });

  test("verifyPassword should return true for correct password and false for incorrect", async () => {
    const raw = "Qcet@2026";
    const hashed = await hashPassword(raw);

    const isMatch = await verifyPassword(raw, hashed);
    assert.strictEqual(isMatch, true);

    const isWrong = await verifyPassword("WrongPassword", hashed);
    assert.strictEqual(isWrong, false);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test fail**

Run: `npx tsx --test tests/password-security-and-seed.test.ts`
Expected: FAIL do chưa có file `src/lib/password.ts`.

- [ ] **Step 3: Triển khai `src/lib/password.ts`**

```typescript
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 4: Triển khai kịch bản nạp dữ liệu `prisma/seed.ts`**

Tạo `prisma/seed.ts`:
```typescript
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { id: "BGH", name: "Ban Giám hiệu Nhà trường", shortName: "BGH", color: "amber" },
  { id: "CNTT", name: "Phòng Quản trị Mạng và CNTT", shortName: "QTM-CNTT", color: "blue" },
  { id: "TCHC", name: "Phòng Tổ chức Hành chính", shortName: "TCHC", color: "emerald" },
  { id: "KHTC", name: "Phòng Kế hoạch Tài chính", shortName: "KHTC", color: "indigo" },
  { id: "DT_QLKH", name: "Phòng Đào tạo & Quản lý Khoa học", shortName: "ĐT-QLKH", color: "cyan" },
];

async function main() {
  console.log("Starting database seed...");

  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: { name: dept.name, shortName: dept.shortName, color: dept.color },
      create: dept,
    });
  }

  const defaultPasswordHash = await bcrypt.hash("Qcet@2026", 10);

  const SEED_USERS = [
    {
      email: "bgh@qcet.edu.vn",
      name: "TS. Nguyễn Văn Hiệu",
      role: UserRole.BAN_GIAM_HIEU,
      departmentId: "BGH",
      title: "Hiệu trưởng",
      phone: "028.3896.8641",
    },
    {
      email: "cntt.lead@qcet.edu.vn",
      name: "ThS. Lê Hoàng Nam",
      role: UserRole.TRUONG_PHONG,
      departmentId: "CNTT",
      title: "Trưởng phòng QTM & CNTT",
      phone: "0908.123.456",
    },
    {
      email: "chuyenvien@qcet.edu.vn",
      name: "Kỹ sư Trần Hùng",
      role: UserRole.CHUYEN_VIEN,
      departmentId: "CNTT",
      title: "Chuyên viên mạng & ATTT",
      phone: "0912.345.678",
    },
  ];

  for (const user of SEED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
        title: user.title,
        phone: user.phone,
        passwordHash: defaultPasswordHash,
      },
      create: {
        ...user,
        passwordHash: defaultPasswordHash,
      },
    });
  }

  console.log("Database seeded successfully with 5 departments and 3 seed users.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Cập nhật `package.json`:
Thêm script `"db:seed": "tsx prisma/seed.ts"`.

Chạy nạp dữ liệu:
```bash
npm run db:seed
```

- [ ] **Step 5: Chạy lại test mật khẩu và dữ liệu seed**

Run: `npx tsx --test tests/password-security-and-seed.test.ts`
Expected: PASS (2/2 tests pass).

- [ ] **Step 6: Commit Task 2**

```bash
git add src/lib/password.ts prisma/seed.ts package.json tests/password-security-and-seed.test.ts
git commit -m "feat(auth): implement password hashing utilities and database seed script"
```

---

### Task 3: Xây dựng API Xác thực Session (Login, Register, Me, Logout)

**Files:**
- Create: `src/lib/jwt-session.ts`
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/me/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Test: `tests/auth-api-routes.test.ts`

**Interfaces:**
- `POST /api/auth/register`: `{ email, password, name, departmentId?, title? }` -> `{ success: true, user }`
- `POST /api/auth/login`: `{ email, password }` -> `{ success: true, user }` (gán cookie `qcet_session`)
- `GET /api/auth/me`: Cookie -> `{ authenticated: boolean, user: AuthUser | null }`
- `POST /api/auth/logout`: Xóa cookie `qcet_session` -> `{ success: true }`

- [ ] **Step 1: Viết test hợp đồng cho các API routes (Failing test)**

Tạo `tests/auth-api-routes.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { signSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";

describe("JWT Session Utilities", () => {
  test("sign and verify session token", () => {
    const payload = {
      id: "usr_123",
      email: "test@qcet.edu.vn",
      role: "CHUYEN_VIEN" as const,
      name: "Nguyễn Văn Test",
    };

    const token = signSessionToken(payload);
    assert.ok(typeof token === "string" && token.length > 20);

    const verified = verifySessionToken(token);
    assert.ok(verified);
    assert.strictEqual(verified?.id, payload.id);
    assert.strictEqual(verified?.email, payload.email);
    assert.strictEqual(verified?.role, payload.role);
  });

  test("verifySessionToken returns null on invalid or tampered token", () => {
    const invalid = verifySessionToken("invalid.token.payload");
    assert.strictEqual(invalid, null);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test fail**

Run: `npx tsx --test tests/auth-api-routes.test.ts`
Expected: FAIL do chưa có `src/lib/jwt-session.ts`.

- [ ] **Step 3: Triển khai `src/lib/jwt-session.ts`**

```typescript
import jwt from "jsonwebtoken";
import { UserRole } from "@/types/auth";

export const SESSION_COOKIE_NAME = "qcet_session";
const JWT_SECRET = process.env.JWT_SECRET || "qcet_fallback_secret_key_2026";

export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId?: string | null;
  title?: string | null;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Triển khai các API Route Handlers**

1. `src/app/api/auth/register/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { UserRole as PrismaUserRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, departmentId, title, role } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp đầy đủ email, mật khẩu và họ tên" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email này đã được đăng ký trong hệ thống" },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const validRole = (role && Object.values(PrismaUserRole).includes(role))
      ? (role as PrismaUserRole)
      : PrismaUserRole.CHUYEN_VIEN;

    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name.trim(),
        passwordHash: hashedPassword,
        role: validRole,
        departmentId: departmentId || "CNTT",
        title: title?.trim() || "Chuyên viên",
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        title: true,
      },
    });

    return NextResponse.json({ success: true, user: newUser }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi tạo tài khoản" },
      { status: 500 }
    );
  }
}
```

2. `src/app/api/auth/login/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { signSessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { UserRole } from "@/types/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập email và mật khẩu" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không chính xác" },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Email hoặc mật khẩu không chính xác" },
        { status: 401 }
      );
    }

    const sessionPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      departmentId: user.departmentId,
      title: user.title,
    };

    const token = signSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi trong quá trình đăng nhập" },
      { status: 500 }
    );
  }
}
```

3. `src/app/api/auth/me/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      departmentId: true,
      title: true,
      avatarUrl: true,
      phone: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user: dbUser,
  });
}
```

4. `src/app/api/auth/logout/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/jwt-session";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
  });
  return response;
}
```

- [ ] **Step 5: Chạy lại test suite API Auth**

Run: `npx tsx --test tests/auth-api-routes.test.ts`
Expected: PASS (2/2 tests pass).

- [ ] **Step 6: Commit Task 3**

```bash
git add src/lib/jwt-session.ts src/app/api/auth/ tests/auth-api-routes.test.ts
git commit -m "feat(api): implement session-based authentication routes with http-only cookies"
```

---

### Task 4: Nâng cấp `AuthProvider` & Giao diện Đăng nhập Thật

**Files:**
- Modify: `src/lib/auth-context.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/auth/google-login-button.tsx`
- Test: `tests/client-auth-context.test.ts`

**Interfaces:**
- Consumes: `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/logout`
- Produces: `login(email, password): Promise<{ success: boolean; error?: string }>`
- Produces: `register(data): Promise<{ success: boolean; error?: string }>`
- Produces: `logout(): Promise<void>`

- [ ] **Step 1: Viết test cho client auth interface contract (Failing test)**

Tạo file `tests/client-auth-context.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Client Auth Context & Login Contract", () => {
  test("src/lib/auth-context.tsx provides login and register async functions", () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/auth-context.tsx"),
      "utf-8"
    );
    assert.match(content, /login:\s*\(email:\s*string,\s*password:\s*string\)\s*=>\s*Promise/, "Must declare async login");
    assert.match(content, /logout:\s*\(\)\s*=>\s*Promise/, "Must declare async logout");
    assert.match(content, /\/api\/auth\/me/, "Must call /api/auth/me to sync persistent session");
  });

  test("src/app/login/page.tsx calls real login endpoint", () => {
    const content = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/login/page.tsx"),
      "utf-8"
    );
    assert.match(content, /await login\(/, "Must call login with real credentials");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test fail**

Run: `npx tsx --test tests/client-auth-context.test.ts`
Expected: FAIL do các hàm trong `auth-context.tsx` hiện tại là synchronous mock.

- [ ] **Step 3: Cập nhật `src/lib/auth-context.tsx`**

Thay thế cơ chế đọc `localStorage` thuần bằng việc nạp session từ `/api/auth/me`:
- Khi mount, gọi `fetch("/api/auth/me")`.
- Nếu server trả về `authenticated: true`, set `user` bằng user thật trong DB.
- Hàm `login(email, password)`: gọi `fetch("/api/auth/login", { method: "POST", body: ... })`.
- Hàm `register(data)`: gọi `fetch("/api/auth/register", { method: "POST", body: ... })`.
- Hàm `logout()`: gọi `fetch("/api/auth/logout", { method: "POST" })`, sau đó redirect về `/login`.

- [ ] **Step 4: Cập nhật `src/app/login/page.tsx` & Google SSO Card**

- Form Đăng nhập chính: Gửi email & mật khẩu tới `login(email, password)`. Hiển thị thông báo lỗi trực quan từ server nếu sai mật khẩu hoặc chưa có tài khoản.
- Thêm Tab / Nút "Đăng ký tài khoản mới" kết nối với `register()`.
- Giữ các nút Quick Login demo thuận tiện để tester có thể click đăng nhập ngay vào 3 tài khoản seed (`bgh@qcet.edu.vn`, `cntt.lead@qcet.edu.vn`, `chuyenvien@qcet.edu.vn`).
- `GoogleLoginButton`: Khi click, kiểm tra cấu hình Google OAuth. Nếu chưa có `GOOGLE_CLIENT_ID`, mở Dialog thông báo rõ ràng "Hệ thống đang chạy CSDL PostgreSQL nội bộ. Để kích hoạt đăng nhập Google Workspace trường, vui lòng cấu hình GOOGLE_CLIENT_ID trong .env.local".

- [ ] **Step 5: Chạy lại test hợp đồng Client Auth**

Run: `npx tsx --test tests/client-auth-context.test.ts`
Expected: PASS (2/2 tests pass).

- [ ] **Step 6: Commit Task 4**

```bash
git add src/lib/auth-context.tsx src/app/login/page.tsx src/components/auth/google-login-button.tsx tests/client-auth-context.test.ts
git commit -m "feat(auth): connect client auth context and login page to real postgresql api"
```

---

### Task 5: Kiểm thử Tổng thể Toàn Diện, Audit Anti-Slop & Xác thực Trực quan

**Files:**
- Test: `tests/**/*.test.ts`
- Audit: All `src/` directory files

**Interfaces:**
- Full test runner passing (280+ tests)
- TypeScript compilation clean (`npm run typecheck`)
- End-to-end browser verification via Claude Browser preview tools

- [ ] **Step 1: Chạy toàn bộ test suites**

Run: `npm test`
Expected: Tất cả các bài test (286+ tests qua 65+ suites) đều pass, 0 fail.

- [ ] **Step 2: Chạy kiểm tra TypeScript**

Run: `npm run typecheck`
Expected: Zero TypeScript errors.

- [ ] **Step 3: Chạy Audit Anti-Slop**

Kiểm tra toàn bộ thư mục `src/`:
- Zero decorative emojis trong mã nguồn UI.
- Tất cả các icon Lucide sử dụng `strokeWidth={1.5}`.
- Số liệu hiển thị dùng `tabular-nums` và `font-mono`.

- [ ] **Step 4: Xác thực End-to-End trên trình duyệt**

- Mở preview server: truy cập `http://localhost:3000/login`.
- Đăng nhập bằng tài khoản seed `bgh@qcet.edu.vn` / `Qcet@2026` -> Kiểm tra chuyển hướng về trang chủ `/` với vai trò Ban Giám hiệu.
- Đăng xuất -> Đăng nhập bằng `cntt.lead@qcet.edu.vn` / `Qcet@2026` -> Kiểm tra giao diện chuyển thành Trưởng phòng QTM & CNTT.
- Thử đăng ký 1 tài khoản mới `giangvien.test@qcet.edu.vn` -> Kiểm tra lưu thành công vào PostgreSQL.
- Chụp ảnh màn hình (screenshot) và báo cáo minh chứng trực quan.

- [ ] **Step 5: Commit hoàn tất**

```bash
git add .
git commit -m "test(auth): verify end-to-end real user postgresql authentication workflow"
```
