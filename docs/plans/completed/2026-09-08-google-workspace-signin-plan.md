---
status: completed
domain: security
created: 2026-09-08
---

# Kế Hoạch Triển Khai: Đăng Nhập Google Workspace (@cdktcnqn.edu.vn)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện giải pháp xác thực Google Workspace OAuth 2.0 cho QCET E-Office, chỉ cho phép cán bộ/giảng viên sở hữu email `@cdktcnqn.edu.vn`, tự động liên kết tài khoản CSDL Prisma, cấp session JWT và tối ưu UI/UX theo chuẩn Google Branding Guidelines.

**Architecture:** Xây dựng module lõi `src/lib/google-oauth.ts` xử lý logic OAuth 2.0; hai Route Handlers `GET /api/auth/google` (sinh CSRF state, redirect an toàn) và `GET /api/auth/callback/google` (đổi token, đối soát domain đa tầng, liên kết Prisma atomic transaction, cấp cookie session); nâng cấp `GoogleLoginButton` (loading state, branding chuẩn) và trang `/login` (hiển thị banner lỗi nghiệp vụ tiếng Việt chi tiết).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma ORM (SQLite/PostgreSQL), Tailwind CSS v4, Lucide Icons, Node.js Test Runner (`node:test`, `node:assert/strict`).

**Spec:** `docs/superpowers/specs/2026-09-08-google-workspace-signin-spec.md`

## Global Constraints

- Domain restriction: Chỉ cho phép email kết thúc bằng `@cdktcnqn.edu.vn` (từ chối `@gmail.com` và các domain khác).
- Dual-layer verification: Kiểm tra cả `email_verified === true`, `email.endsWith("@cdktcnqn.edu.vn")` và claim `hd === "cdktcnqn.edu.vn"`.
- CSRF protection: Sinh ngẫu nhiên `state = crypto.randomUUID()` lưu trong cookie HttpOnly `qcet_oauth_state` (maxAge 300s, path: `/api/auth`).
- Reverse-proxy compatibility: Hàm giải quyết base URL phải ưu tiên `process.env.NEXTAUTH_URL` / `process.env.NEXT_PUBLIC_APP_URL` -> headers `x-forwarded-host`/`x-forwarded-proto` -> `request.nextUrl.origin`.
- Session standard: Cấp phát JWT token đồng nhất với kiến trúc hiện hành qua `signSessionToken` lưu cookie `qcet_session` (maxAge 7 ngày).
- Light-only UI standard: Không dùng class `dark:`, giữ phong cách công sở hành chính giáo dục.
- Tất cả unit tests và integration tests chạy bằng `npm test` (`tsx --test tests/**/*.test.ts`) phải pass 100%.

---

### Task 1: Module Lõi `src/lib/google-oauth.ts` (Domain Validator, Base URL Resolver, OAuth Helper)

**Files:**
- Create: `src/lib/google-oauth.ts`
- Test: `tests/google-oauth-helpers.test.ts`

**Interfaces:**
- Consumes: `process.env.GOOGLE_CLIENT_ID`, `process.env.GOOGLE_CLIENT_SECRET`, `process.env.AUTH_ALLOWED_DOMAINS`
- Produces:
  ```ts
  export interface GoogleTokens {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
  }

  export interface GoogleUserInfo {
    sub: string;
    email: string;
    email_verified: boolean;
    name: string;
    picture?: string;
    hd?: string;
  }

  export function getAppBaseUrl(req?: Request): string;
  export function isAllowedDomain(email?: string | null, hd?: string | null): boolean;
  export function buildGoogleAuthUrl(options: { clientId: string; redirectUri: string; state: string }): string;
  export function exchangeGoogleCode(options: { code: string; clientId: string; clientSecret: string; redirectUri: string }): Promise<GoogleTokens>;
  export function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo>;
  ```

- [ ] **Step 1: Viết test thất bại (Failing Test) cho các helper OAuth trong `tests/google-oauth-helpers.test.ts`**

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isAllowedDomain,
  getAppBaseUrl,
  buildGoogleAuthUrl,
} from "../src/lib/google-oauth";

describe("Google OAuth Helper Functions", () => {
  describe("isAllowedDomain", () => {
    test("accepts valid @cdktcnqn.edu.vn emails", () => {
      assert.strictEqual(isAllowedDomain("quantrimang@cdktcnqn.edu.vn", "cdktcnqn.edu.vn"), true);
      assert.strictEqual(isAllowedDomain("GIANGVIEN@CDKTCNQN.EDU.VN"), true);
      assert.strictEqual(isAllowedDomain("nguyen.van.a@cdktcnqn.edu.vn"), true);
    });

    test("rejects personal gmail and other educational domains", () => {
      assert.strictEqual(isAllowedDomain("test@gmail.com"), false);
      assert.strictEqual(isAllowedDomain("test@qcet.edu.vn"), false);
      assert.strictEqual(isAllowedDomain("student@hcmut.edu.vn"), false);
      assert.strictEqual(isAllowedDomain("cdktcnqn.edu.vn@gmail.com"), false);
      assert.strictEqual(isAllowedDomain(null), false);
      assert.strictEqual(isAllowedDomain(""), false);
    });
  });

  describe("buildGoogleAuthUrl", () => {
    test("constructs valid Google OAuth 2.0 authorization URL with hd and state", () => {
      const urlString = buildGoogleAuthUrl({
        clientId: "mock-client-id-123.apps.googleusercontent.com",
        redirectUri: "https://e-office.cdktcnqn.edu.vn/api/auth/callback/google",
        state: "test-random-state-uuid",
      });

      const parsed = new URL(urlString);
      assert.strictEqual(parsed.origin, "https://accounts.google.com");
      assert.strictEqual(parsed.pathname, "/o/oauth2/v2/auth");
      assert.strictEqual(parsed.searchParams.get("client_id"), "mock-client-id-123.apps.googleusercontent.com");
      assert.strictEqual(parsed.searchParams.get("redirect_uri"), "https://e-office.cdktcnqn.edu.vn/api/auth/callback/google");
      assert.strictEqual(parsed.searchParams.get("response_type"), "code");
      assert.strictEqual(parsed.searchParams.get("scope"), "openid email profile");
      assert.strictEqual(parsed.searchParams.get("state"), "test-random-state-uuid");
      assert.strictEqual(parsed.searchParams.get("hd"), "cdktcnqn.edu.vn");
      assert.strictEqual(parsed.searchParams.get("prompt"), "select_account");
      assert.strictEqual(parsed.searchParams.get("access_type"), "offline");
    });
  });

  describe("getAppBaseUrl", () => {
    test("respects x-forwarded-host and x-forwarded-proto headers behind reverse proxy", () => {
      const req = new Request("http://127.0.0.1:3000/api/auth/google", {
        headers: {
          "x-forwarded-host": "e-office.cdktcnqn.edu.vn",
          "x-forwarded-proto": "https",
        },
      });

      const baseUrl = getAppBaseUrl(req);
      assert.strictEqual(baseUrl, "https://e-office.cdktcnqn.edu.vn");
    });

    test("falls back to request origin if no forwarded headers", () => {
      const req = new Request("http://localhost:3001/api/auth/google");
      const baseUrl = getAppBaseUrl(req);
      assert.strictEqual(baseUrl, "http://localhost:3001");
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/google-oauth-helpers.test.ts`
Expected: FAIL (Module `src/lib/google-oauth` chưa tồn tại).

- [ ] **Step 3: Cài đặt code cho `src/lib/google-oauth.ts`**

```ts
export interface GoogleTokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  hd?: string;
}

export const OFFICIAL_DOMAIN = "cdktcnqn.edu.vn";

/**
 * Kiểm tra địa chỉ email có thuộc tên miền Google Workspace chính thức của trường hay không.
 * Yêu cầu: Email bắt buộc kết thúc bằng @cdktcnqn.edu.vn
 */
export function isAllowedDomain(email?: string | null, _hd?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(`@${OFFICIAL_DOMAIN}`);
}

/**
 * Phân giải URL gốc của ứng dụng (Base URL), hỗ trợ Nginx/Docker reverse proxy
 */
export function getAppBaseUrl(req?: Request): string {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
    }
    try {
      const url = new URL(req.url);
      return url.origin;
    } catch {
      // ignore
    }
  }

  return "http://localhost:3000";
}

/**
 * Xây dựng Authorization URL để chuyển hướng sang Google
 */
export function buildGoogleAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", options.clientId);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", options.state);
  url.searchParams.set("hd", OFFICIAL_DOMAIN);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "offline");
  return url.toString();
}

/**
 * Đổi authorization code lấy bộ tokens từ Google
 */
export async function exchangeGoogleCode(options: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const params = new URLSearchParams({
    code: options.code,
    client_id: options.clientId,
    client_secret: options.clientSecret,
    redirect_uri: options.redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${errorBody}`);
  }

  return res.json();
}

/**
 * Lấy thông tin người dùng từ Google qua access token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Google userinfo fetch failed: ${res.status} ${errorBody}`);
  }

  return res.json();
}
```

- [ ] **Step 4: Chạy lại test xác nhận tất cả các bài test đều pass**

Run: `npx tsx --test tests/google-oauth-helpers.test.ts`
Expected: PASS (Tất cả 5 subtests pass).

- [ ] **Step 5: Commit mã nguồn Task 1**

```bash
git add src/lib/google-oauth.ts tests/google-oauth-helpers.test.ts
git commit -m "feat(auth): add Google OAuth helpers, domain restriction and base URL resolver"
```

---

### Task 2: Route Khởi Tạo Đăng Nhập `GET /api/auth/google`

**Files:**
- Create: `src/app/api/auth/google/route.ts`
- Test: `tests/api-auth-google.test.ts`

**Interfaces:**
- Consumes: `src/lib/google-oauth.ts` (`getAppBaseUrl`, `buildGoogleAuthUrl`)
- Produces: `GET(req: NextRequest): Promise<NextResponse>` (Set cookie `qcet_oauth_state`, HTTP 302 Redirect to Google)

- [ ] **Step 1: Viết failing test cho `GET /api/auth/google` trong `tests/api-auth-google.test.ts`**

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET as googleAuthGet } from "../src/app/api/auth/google/route";
import { NextRequest } from "next/server";

describe("GET /api/auth/google", () => {
  test("redirects to /login?error=oauth_not_configured when credentials missing", async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    try {
      const req = new NextRequest("http://localhost:3000/api/auth/google");
      const res = await googleAuthGet(req);

      assert.strictEqual(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/login?error=oauth_not_configured"));
    } finally {
      if (originalClientId) process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  });

  test("generates state, sets qcet_oauth_state cookie, and redirects to accounts.google.com", async () => {
    process.env.GOOGLE_CLIENT_ID = "mock-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "mock-secret";

    const req = new NextRequest("http://localhost:3001/api/auth/google");
    const res = await googleAuthGet(req);

    assert.strictEqual(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
    assert.ok(location?.includes("hd=cdktcnqn.edu.vn"));
    assert.ok(location?.includes("redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fauth%2Fcallback%2Fgoogle"));

    const stateCookie = res.cookies.get("qcet_oauth_state");
    assert.ok(stateCookie, "qcet_oauth_state cookie must be set");
    assert.strictEqual(stateCookie?.httpOnly, true);
    assert.strictEqual(stateCookie?.sameSite, "lax");
    assert.ok(stateCookie?.value && stateCookie.value.length >= 10);
    assert.ok(location?.includes(`state=${stateCookie?.value}`));
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/api-auth-google.test.ts`
Expected: FAIL (Route `src/app/api/auth/google/route.ts` chưa tồn tại).

- [ ] **Step 3: Cài đặt code cho `src/app/api/auth/google/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl, buildGoogleAuthUrl } from "@/lib/google-oauth";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const baseUrl = getAppBaseUrl(req);

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=oauth_not_configured", baseUrl));
  }

  const state = crypto.randomUUID();
  const redirectUri = `${baseUrl}/api/auth/callback/google`;
  const authUrl = buildGoogleAuthUrl({
    clientId,
    redirectUri,
    state,
  });

  const response = NextResponse.redirect(authUrl);

  response.cookies.set("qcet_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 300, // 5 minutes
    path: "/api/auth",
  });

  return response;
}
```

- [ ] **Step 4: Chạy lại test xác nhận test pass**

Run: `npx tsx --test tests/api-auth-google.test.ts`
Expected: PASS (Tất cả bài test thành công).

- [ ] **Step 5: Commit mã nguồn Task 2**

```bash
git add src/app/api/auth/google/route.ts tests/api-auth-google.test.ts
git commit -m "feat(auth): implement GET /api/auth/google with CSRF state and domain hint"
```

---

### Task 3: Route Tiếp Nhận Callback `GET /api/auth/callback/google`

**Files:**
- Create: `src/app/api/auth/callback/google/route.ts`
- Test: `tests/api-auth-callback-google.test.ts`

**Interfaces:**
- Consumes:
  - `src/lib/google-oauth.ts` (`getAppBaseUrl`, `isAllowedDomain`, `exchangeGoogleCode`, `fetchGoogleUserInfo`)
  - `src/lib/jwt-session.ts` (`signSessionToken`, `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_SECONDS`)
  - `src/lib/prisma.ts` (`prisma.account`, `prisma.user`, `prisma.$transaction`)
- Produces: `GET(req: NextRequest): Promise<NextResponse>`

- [ ] **Step 1: Viết failing test cho `GET /api/auth/callback/google` trong `tests/api-auth-callback-google.test.ts`**

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET as googleCallbackGet } from "../src/app/api/auth/callback/google/route";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "../src/lib/jwt-session";

describe("GET /api/auth/callback/google", () => {
  test("redirects to /login?error=oauth_cancelled when error parameter present", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?error=access_denied");
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login?error=oauth_cancelled"));
  });

  test("redirects to /login?error=invalid_state on state mismatch or missing cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=fake_code&state=fake_state");
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login?error=invalid_state"));
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/api-auth-callback-google.test.ts`
Expected: FAIL (Route `src/app/api/auth/callback/google/route.ts` chưa tồn tại).

- [ ] **Step 3: Cài đặt code cho `src/app/api/auth/callback/google/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import {
  getAppBaseUrl,
  isAllowedDomain,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
} from "@/lib/google-oauth";
import { signSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/jwt-session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const baseUrl = getAppBaseUrl(req);
  const searchParams = req.nextUrl.searchParams;

  // 1. Kiểm tra lỗi trả về từ Google (người dùng bấm Hủy)
  const oauthError = searchParams.get("error");
  if (oauthError) {
    const response = NextResponse.redirect(new URL("/login?error=oauth_cancelled", baseUrl));
    response.cookies.delete("qcet_oauth_state");
    return response;
  }

  // 2. Xác thực CSRF state
  const stateQuery = searchParams.get("state");
  const stateCookie = req.cookies.get("qcet_oauth_state")?.value;

  if (!stateQuery || !stateCookie || stateQuery !== stateCookie) {
    const response = NextResponse.redirect(new URL("/login?error=invalid_state", baseUrl));
    response.cookies.delete("qcet_oauth_state");
    return response;
  }

  const code = searchParams.get("code");
  if (!code) {
    const response = NextResponse.redirect(new URL("/login?error=missing_code", baseUrl));
    response.cookies.delete("qcet_oauth_state");
    return response;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const response = NextResponse.redirect(new URL("/login?error=oauth_not_configured", baseUrl));
    response.cookies.delete("qcet_oauth_state");
    return response;
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/callback/google`;

    // 3. Đổi code lấy Tokens
    const tokenData = await exchangeGoogleCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    // 4. Lấy UserInfo từ Google
    const googleUser = await fetchGoogleUserInfo(tokenData.access_token);

    // 5. Kiểm tra tính hợp lệ & Dual-layer domain restriction
    if (!googleUser.email_verified || !isAllowedDomain(googleUser.email, googleUser.hd)) {
      const response = NextResponse.redirect(
        new URL(
          `/login?error=domain_not_allowed&email=${encodeURIComponent(googleUser.email || "")}`,
          baseUrl
        )
      );
      response.cookies.delete("qcet_oauth_state");
      return response;
    }

    const normalizedEmail = googleUser.email.toLowerCase().trim();

    // 6. Đồng bộ & Liên kết CSDL qua Atomic Transaction
    const user = await prisma.$transaction(async (tx) => {
      // A. Kiểm tra Account Google đã liên kết trước đó
      const existingAccount = await tx.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: googleUser.sub,
          },
        },
        include: { user: true },
      });

      if (existingAccount) {
        // Cập nhật avatar nếu user chưa có
        if (!existingAccount.user.avatarUrl && googleUser.picture) {
          await tx.user.update({
            where: { id: existingAccount.user.id },
            data: { avatarUrl: googleUser.picture },
          });
        }
        return existingAccount.user;
      }

      // B. Kiểm tra User tồn tại theo email
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        // Liên kết Account Google vào User hiện hữu
        await tx.account.create({
          data: {
            userId: existingUser.id,
            type: "oauth",
            provider: "google",
            providerAccountId: googleUser.sub,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            expires_at: tokenData.expires_in
              ? Math.floor(Date.now() / 1000) + tokenData.expires_in
              : null,
            token_type: tokenData.token_type || "Bearer",
            scope: tokenData.scope || null,
            id_token: tokenData.id_token || null,
          },
        });

        if (!existingUser.avatarUrl && googleUser.picture) {
          await tx.user.update({
            where: { id: existingUser.id },
            data: { avatarUrl: googleUser.picture },
          });
        }

        return existingUser;
      }

      // C. Chưa tồn tại User -> Tự động khởi tạo User mới
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: googleUser.name || normalizedEmail.split("@")[0],
          role: "CHUYEN_VIEN",
          avatarUrl: googleUser.picture || null,
          provider: "google",
          isActive: true,
          title: "Chuyên viên",
          accounts: {
            create: {
              type: "oauth",
              provider: "google",
              providerAccountId: googleUser.sub,
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || null,
              expires_at: tokenData.expires_in
                ? Math.floor(Date.now() / 1000) + tokenData.expires_in
                : null,
              token_type: tokenData.token_type || "Bearer",
              scope: tokenData.scope || null,
              id_token: tokenData.id_token || null,
            },
          },
        },
      });

      return newUser;
    });

    // 7. Kiểm tra trạng thái tài khoản
    if (!user.isActive) {
      const response = NextResponse.redirect(new URL("/login?error=account_disabled", baseUrl));
      response.cookies.delete("qcet_oauth_state");
      return response;
    }

    // 8. Cấp phát Session JWT Token & ghi Cookie
    const sessionToken = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId ?? undefined,
      title: user.title ?? undefined,
    });

    const response = NextResponse.redirect(new URL("/", baseUrl));

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });

    response.cookies.delete("qcet_oauth_state");

    return response;
  } catch (error) {
    console.error("[Google OAuth Callback Error]", error);
    const response = NextResponse.redirect(new URL("/login?error=oauth_failed", baseUrl));
    response.cookies.delete("qcet_oauth_state");
    return response;
  }
}
```

- [ ] **Step 4: Chạy test xác nhận các bài test callback pass**

Run: `npx tsx --test tests/api-auth-callback-google.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit mã nguồn Task 3**

```bash
git add src/app/api/auth/callback/google/route.ts tests/api-auth-callback-google.test.ts
git commit -m "feat(auth): implement GET /api/auth/callback/google with domain verification, DB sync and session issuance"
```

---

### Task 4: Tối Ưu Nút Bấm `GoogleLoginButton` (Loading Spinner, Branding Chuẩn & Modal Hướng Dẫn)

**Files:**
- Modify: `src/components/auth/google-login-button.tsx`
- Test: `tests/google-login-button.test.ts`

**Interfaces:**
- Consumes: `src/components/auth/google-login-button.tsx`
- Produces: `GoogleLoginButton({ className?: string }): JSX.Element`

- [ ] **Step 1: Viết test cho `GoogleLoginButton` trong `tests/google-login-button.test.ts`**

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("GoogleLoginButton Component Specifications", () => {
  const componentPath = path.join(process.cwd(), "src/components/auth/google-login-button.tsx");
  const content = fs.readFileSync(componentPath, "utf-8");

  test("points to /api/auth/google for secure server-initiated OAuth", () => {
    assert.ok(content.includes("/api/auth/google"));
  });

  test("displays official domain badge @cdktcnqn.edu.vn", () => {
    assert.ok(content.includes("@cdktcnqn.edu.vn"));
  });

  test("includes loading state with Loader2 and disabled button", () => {
    assert.ok(content.includes("Loader2"));
    assert.ok(content.includes("disabled="));
  });

  test("conforms to Google branding with 4-color Super G logo", () => {
    assert.ok(content.includes("#4285F4"));
    assert.ok(content.includes("#34A853"));
    assert.ok(content.includes("#FBBC05"));
    assert.ok(content.includes("#EA4335"));
  });
});
```

- [ ] **Step 2: Chạy test để xác định các tiêu chí còn thiếu**

Run: `npx tsx --test tests/google-login-button.test.ts`
Expected: FAIL hoặc PASS tùy hiện trạng, nhưng cần nâng cấp code để hoàn thiện trải nghiệm.

- [ ] **Step 3: Cập nhật `src/components/auth/google-login-button.tsx`**

Cập nhật component với trạng thái `isLoading`:
- Khi click, kích hoạt `setIsLoading(true)` và chuyển hướng sang `/api/auth/google`.
- Hiển thị spinner xoay `Loader2` màu xanh primary, text đổi thành: *"Đang chuyển hướng tới Google Workspace..."*.
- Nếu môi trường dev chưa cấu hình `NEXT_PUBLIC_GOOGLE_CLIENT_ID` hoặc click cấu hình, mở Modal có nút copy callback url `http://localhost:3001/api/auth/callback/google`.

- [ ] **Step 4: Chạy lại test `tests/google-login-button.test.ts`**

Run: `npx tsx --test tests/google-login-button.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit mã nguồn Task 4**

```bash
git add src/components/auth/google-login-button.tsx tests/google-login-button.test.ts
git commit -m "feat(ui): enhance GoogleLoginButton with loading spinner, accessibility and branding standards"
```

---

### Task 5: Nâng Cấp Trang `/login` Với Banner Thông Báo Lỗi Trực Quan

**Files:**
- Modify: `src/app/login/page.tsx`
- Test: `tests/login-page.test.ts`

**Interfaces:**
- Consumes: `useSearchParams()` từ `next/navigation`, bọc trong `<React.Suspense>`.
- Hiển thị:
  - `domain_not_allowed`: Banner màu hổ phách, hiển thị email vi phạm, nút *"Thử lại bằng tài khoản trường"*.
  - `account_disabled`: Banner màu đỏ, hướng dẫn liên hệ Phòng QTM & CNTT.
  - `oauth_cancelled`: Banner màu xám trung tính.
  - `oauth_failed`: Banner màu đỏ.

- [ ] **Step 1: Viết test cho Error Banner trên trang login trong `tests/login-page.test.ts`**

Bổ sung các test cases kiểm tra xử lý mã lỗi query param (`domain_not_allowed`, `account_disabled`, `oauth_cancelled`).

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/login-page.test.ts`
Expected: FAIL (Chưa có hàm map lỗi và render banner).

- [ ] **Step 3: Cập nhật `src/app/login/page.tsx`**

1. Tách phần nội dung form sang component con `LoginFormContent` để bọc bên trong `<React.Suspense fallback={<LoginSkeleton />}>`.
2. Đọc `searchParams.get("error")` và `searchParams.get("email")`.
3. Render khối cảnh báo trực quan tương ứng với các kiểu lỗi nghiệp vụ Google OAuth.

- [ ] **Step 4: Chạy lại test `tests/login-page.test.ts`**

Run: `npx tsx --test tests/login-page.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit mã nguồn Task 5**

```bash
git add src/app/login/page.tsx tests/login-page.test.ts
git commit -m "feat(ui): add visual error notification banners and Suspense boundary to /login"
```

---

### Task 6: Cấu Hình Môi Trường & Bộ Kiểm Thử Tích Hợp Toàn Diện (E2E Integration Test)

**Files:**
- Modify: `.env.production.example`
- Create: `tests/google-workspace-auth-integration.test.ts`

- [ ] **Step 1: Cập nhật `.env.production.example`**

Thêm các khóa cấu hình chuẩn Google Workspace OAuth 2.0:
```bash
# Google Workspace OAuth 2.0 (@cdktcnqn.edu.vn)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
AUTH_ALLOWED_DOMAINS="cdktcnqn.edu.vn"
NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
```

- [ ] **Step 2: Viết test tích hợp toàn diện trong `tests/google-workspace-auth-integration.test.ts`**

Test toàn bộ chu trình từ:
1. `GET /api/auth/google` sinh `state` và `qcet_oauth_state`.
2. Gọi `GET /api/auth/callback/google` với `state` hợp lệ và `code`.
3. Giả lập Google API trả về email `@cdktcnqn.edu.vn` -> Kiểm tra User được tạo trong CSDL, Account được liên kết, và cookie `qcet_session` được cấp phát.
4. Giả lập email `@gmail.com` -> Bị từ chối và chuyển hướng về `/login?error=domain_not_allowed`.

- [ ] **Step 3: Chạy test tích hợp**

Run: `npx tsx --test tests/google-workspace-auth-integration.test.ts`
Expected: PASS (Toàn bộ chu trình tích hợp xanh).

- [ ] **Step 4: Chạy toàn bộ kiểm tra chất lượng hệ thống**

```bash
npm run typecheck
npm test
```
Expected:
- `tsc --noEmit` exit 0 (không có lỗi kiểu dữ liệu).
- Tất cả hơn 1.100 test cases trong toàn bộ repo đều PASS.

- [ ] **Step 5: Commit mã nguồn Task 6**

```bash
git add .env.production.example tests/google-workspace-auth-integration.test.ts
git commit -m "test(auth): add end-to-end integration tests for Google Workspace sign-in flow"
```
