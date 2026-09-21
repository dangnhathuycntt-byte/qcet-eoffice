import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  verifySessionTokenEdge,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from '@/lib/jwt-edge';
import { sanitizeRedirectUrl } from '@/lib/login-helpers';

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
 * Next.js Edge Middleware for Coarse-Grained Authentication & Route Protection.
 *
 * Requirements & Invariants:
 * 1. Centralized API route protection (defense in depth):
 *    - Reject unauthenticated requests to protected /api routes (401 JSON)
 *    - Reject non-ADMIN users accessing /api/admin/* (403 JSON)
 *    - Reject non-BGH users accessing /api/executive/* (403 JSON)
 *    - Allow public endpoints: /api/health, /api/auth/*, /api/csp-report, /api/runtime-config
 * 2. Unauthenticated users accessing protected UI routes -> redirect to /login with returnTo.
 * 3. Authenticated users opening /login -> redirect to /tasks only if verified.
 * 4. Root '/' -> /tasks for authenticated users, /login for unauthenticated users.
 * 5. Public assets, static chunks, and PWA manifest: Always accessible.
 * 6. Canonical singular to plural redirects (/task -> /tasks).
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

    // 2c. Cryptographic verification on Edge Runtime
    let session = null;
    try {
      session = await verifySessionTokenEdge(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session || !session.id || !session.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.role || '').trim().toUpperCase();

    // 2d. Coarse-grained Role Check: /api/admin/* requires ADMIN
    if (pathname === '/api/admin' || pathname.startsWith('/api/admin/')) {
      const isAdmin = role === 'ADMIN' || role === 'SYSTEM_ADMIN';
      if (!isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // 2e. Coarse-grained Role Check: /api/executive/* requires BGH leadership
    if (pathname === '/api/executive' || pathname.startsWith('/api/executive/')) {
      const isBgh = [
        'BGH',
        'BAN_GIAM_HIEU',
        'HIEU_TRUONG',
        'PHO_HIEU_TRUONG',
        'ADMIN',
        'SYSTEM_ADMIN',
      ].includes(role);
      if (!isBgh) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

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
