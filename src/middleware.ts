import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  verifySessionTokenEdge,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from '@/lib/jwt-edge';
import { verifySessionTokenAsync } from '@/lib/jwt-session';
import { sanitizeRedirectUrl } from '@/lib/login-helpers';

/**
 * Next.js Middleware runtime (official API for the installed Next.js 15.5:
 * `export const config = { runtime: 'nodejs', matcher: [...] }`).
 *
 * Verified against the installed compiler (node_modules/next@15.5.25):
 * - `dist/build/index.js` registers Node middleware only when the
 *   middleware file's static info resolves `runtime === 'nodejs'`
 *   (`functionsConfigManifest.functions['/_middleware']`, `hasNodeMiddleware`).
 * - `dist/build/analysis/get-page-static-info.js` resolves it as
 *   `config.runtime ?? config.config?.runtime`, i.e. from this `config`
 *   object, and emits `.next/server/middleware.js` (Node) instead of an
 *   Edge bundle.
 *
 * Issue #27: production login uses Auth.js + PrismaAdapter with
 * `session.strategy === "database"` (opaque `sessionToken` stored in the
 * `sessions` table). The previous Edge-only crypto verification
 * (`verifySessionTokenEdge`) could not resolve those sessions, so valid
 * database sessions were rejected with 401 before reaching Route Handlers
 * even though `resolveCurrentSession()` / `getApiContext()` accept them.
 *
 * This middleware therefore runs on the Node.js runtime and reuses the
 * canonical server-side session resolver (`verifySessionTokenAsync`:
 * opaque DB session + HMAC JWT + Auth.js JWE, with expiry / revocation /
 * isActive checks, fail-closed).
 */

/**
 * Extracts session token from HTTP request (Authorization header or cookies).
 */
function extractTokenFromRequest(request: NextRequest): string | null {
  // 1. Authorization header (Bearer token)
  const authHeader =
    request.headers.get('authorization') ||
    request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.substring(7).trim();
    if (bearer) return bearer;
  }

  // 2. Cookie extraction (priority order)
  const cookieNames = [
    SESSION_COOKIE_NAME,
    SECURE_SESSION_COOKIE_NAME,
    LEGACY_SESSION_COOKIE_NAME,
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ];

  for (const name of cookieNames) {
    const val = request.cookies.get(name)?.value;
    if (val && val.trim().length > 0) {
      return val.trim();
    }
  }

  // 3. Fallback: parse raw Cookie header if request.cookies did not resolve
  const rawCookie = request.headers.get('cookie') || request.headers.get('Cookie');
  if (rawCookie) {
    const cookies = rawCookie.split(';');
    for (const cookie of cookies) {
      const [name, ...rest] = cookie.trim().split('=');
      if (cookieNames.includes(name)) {
        const val = rest.join('=').trim();
        if (val) {
          try {
            return decodeURIComponent(val);
          } catch {
            return val;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Next.js Middleware for Authentication & Technical Route Protection.
 *
 * Requirements & Invariants (Issue #27):
 * 1. Centralized API authentication (defense in depth, fail-closed):
 *    - Canonical session resolution via `verifySessionTokenAsync()` so that
 *      opaque Auth.js/PrismaAdapter database sessions, HMAC JWTs and Auth.js
 *      JWE tokens are all accepted when valid; invalid / expired / revoked /
 *      disabled-account sessions return 401 JSON.
 *    - Reject non-ADMIN users accessing /api/admin/* (403 JSON). This is a
 *      TECHNICAL administration boundary only.
 *    - /api/executive/* requires an authenticated session at the middleware
 *      layer; statutory / business authority (executive resolution, approval,
 *      signing, direction, ...) is decided exclusively by the canonical
 *      authorization layer in Route Handlers / Services
 *      (`loadAuthorizationContext()` + `authorize()`). The middleware MUST NOT
 *      treat technical ADMIN/SYSTEM_ADMIN as statutory executive authority.
 *    - Allow public endpoints: /api/health, /api/auth/*, /api/csp-report, /api/runtime-config
 * 2. Unauthenticated users accessing protected UI routes -> redirect to /login with returnTo.
 * 3. Authenticated users opening /login -> page asks /api/auth/me for server truth.
 * 4. Root '/' -> /tasks for verified JWT users, /login for unauthenticated users;
 *    opaque DB sessions pass through to app/page.tsx for server verification.
 * 5. Public assets, static chunks, and PWA manifest: Always accessible.
 * 6. Canonical singular to plural redirects (/task -> /tasks).
 * 7. Defense in depth: this middleware is an early barrier only. Route
 *    Handlers / Services MUST keep `requireAuthenticated()` and
 *    object/business `authorize()` checks as the source of truth.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware for static assets, next internal files, and public assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // Static files like favicon.ico, images, manifest.json
    pathname === '/portal' ||
    pathname.startsWith('/portal/')
  ) {
    return NextResponse.next();
  }

  // 2. Centralized API route defense-in-depth protection
  if (pathname.startsWith('/api')) {
    // 2a. Whitelisted public API endpoints
    const isPublicApi =
      pathname === '/api/health' ||
      pathname.startsWith('/api/health/') ||
      pathname === '/api/auth' ||
      pathname.startsWith('/api/auth/') ||
      pathname === '/api/csp-report' ||
      pathname.startsWith('/api/csp-report/') ||
      pathname === '/api/runtime-config' ||
      pathname.startsWith('/api/runtime-config/');

    if (isPublicApi) {
      return NextResponse.next();
    }

    // 2b. Extract session token
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2c. Canonical session verification (Node runtime).
    // verifySessionTokenAsync() resolves, in order: opaque Auth.js database
    // session (Prisma sessions table, with expires / revokedAt / revocation
    // store / user.isActive checks) -> HMAC JWT (with DB user refresh) ->
    // Auth.js JWE (all cookie salts, with DB user refresh). Returns null for
    // missing / invalid / expired / revoked sessions -> fail closed with 401.
    let session = null;
    try {
      session = await verifySessionTokenAsync(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session || !session.id || !session.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.role || '').trim().toUpperCase();

    // 2d. Technical administration boundary: /api/admin/* requires ADMIN.
    // This namespace is technical system administration, NOT statutory or
    // business authority.
    if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
      const isAdmin = role === 'ADMIN' || role === 'SYSTEM_ADMIN';
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 2e. Executive / business authorization boundary (Issue #27 §4).
    // The middleware intentionally performs NO role-string gate here:
    // - every authenticated session passes to the Route Handler;
    // - statutory / business authority for /api/executive/* (resolutions,
    //   approvals, signing, directives, ...) is enforced by the canonical
    //   authorization layer (`loadAuthorizationContext()` + `authorize()`)
    //   inside Route Handlers / Services;
    // - technical ADMIN/SYSTEM_ADMIN is NEVER treated as statutory
    //   executive (Hiệu trưởng / BGH) authority at this layer.

    // Valid authenticated API request passes to Route Handler
    return NextResponse.next();
  }

  // 3. Canonical singular to plural redirects (e.g. /task -> /tasks)
  if (pathname === '/task') {
    const url = request.nextUrl.clone();
    url.pathname = '/tasks';
    return NextResponse.redirect(url, 308);
  }
  if (pathname.startsWith('/task/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/task\//, '/tasks/');
    return NextResponse.redirect(url, 308);
  }

  // 4. Extract session token cookie for UI routes
  const token = extractTokenFromRequest(request);
  const hasToken = Boolean(token && token.trim().length > 0);

  // 5. Cryptographic JWT / JWE validation on Edge for UI routes
  let isVerifiedJwt = false;
  if (hasToken) {
    const trimmed = token!.trim();
    const parts = trimmed.split('.');
    if (parts.length === 3 || parts.length === 5) {
      const session = await verifySessionTokenEdge(trimmed);
      isVerifiedJwt = Boolean(session && session.id && session.email);
    }
  }

  // 6. Handle Root '/' route
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    if (isVerifiedJwt) {
      url.pathname = '/tasks';
      return NextResponse.redirect(url);
    } else if (!hasToken) {
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
    // If hasToken is true (opaque DB session), let request pass to app/page.tsx
    // which verifies the DB session on the server.
    return NextResponse.next();
  }

  // 7. Handle /login route
  if (pathname === '/login') {
    // Middleware cannot check DB revocation or account status. Always let the login page
    // ask /api/auth/me for server truth; an active session is redirected client-side.
    return NextResponse.next();
  }

  // 8. Protected UI routes (e.g. /tasks, /documents, /calendar, /org, etc.)
  if (!hasToken) {
    // Completely unauthenticated request -> redirect to /login with returnTo
    const originalPath = `${pathname}${request.nextUrl.search}`;
    const safeReturnTo = sanitizeRedirectUrl(originalPath);

    const loginUrl = new URL('/login', request.nextUrl.origin);
    if (safeReturnTo && safeReturnTo !== '/tasks' && safeReturnTo !== '/') {
      loginUrl.searchParams.set('returnTo', safeReturnTo);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If hasToken is true, let request through so Server Component / AppShell verifies DB session truth
  return NextResponse.next();
}

export default middleware;

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/api/:path*',
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
