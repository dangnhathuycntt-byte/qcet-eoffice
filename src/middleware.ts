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
 * Next.js Edge Middleware for Coarse-Grained Authentication & Route Protection.
 *
 * Requirements & Invariants:
 * 1. Unauthenticated users accessing protected routes -> redirect to /login with returnTo.
 * 2. Authenticated users opening /login -> redirect to /tasks only if verified.
 * 3. Root '/' -> /tasks for authenticated users, /login for unauthenticated users.
 * 4. API routes: Let through for Fine-Grained Server Auth Guards (request-context / 401 JSON).
 * 5. Public assets, static chunks, and PWA manifest: Always accessible.
 * 6. Never rely on unverified opaque token length alone to force /login -> /tasks redirects.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware for static assets, next internal files, and public assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api') || // Let API routes handle fine-grained 401s
    pathname.includes('.') || // Static files like favicon.ico, images, manifest.json
    pathname === '/portal' ||
    pathname.startsWith('/portal/')
  ) {
    return NextResponse.next();
  }

  // 1b. Canonical singular to plural redirects (e.g. /task -> /tasks)
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

  // 2. Extract session token cookie (Auth.js database session or JWT/JWE)
  const token =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ||
    request.cookies.get(SECURE_SESSION_COOKIE_NAME)?.value ||
    request.cookies.get(LEGACY_SESSION_COOKIE_NAME)?.value ||
    request.cookies.get('next-auth.session-token')?.value ||
    request.cookies.get('__Secure-next-auth.session-token')?.value;

  const hasToken = Boolean(token && token.trim().length > 0);

  // 3. Cryptographic JWT / JWE validation on Edge
  let isVerifiedJwt = false;
  if (hasToken) {
    const trimmed = token!.trim();
    const parts = trimmed.split('.');
    if (parts.length === 3 || parts.length === 5) {
      const session = await verifySessionTokenEdge(trimmed);
      isVerifiedJwt = Boolean(session && session.id && session.email);
    }
  }

  // 4. Handle Root '/' route
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

  // 5. Handle /login route
  if (pathname === '/login') {
    // Middleware cannot check DB revocation or account status. Always let the login page
    // ask /api/auth/me for server truth; an active session is redirected client-side.
    return NextResponse.next();
  }

  // 6. Protected routes (e.g. /tasks, /documents, /calendar, /org, etc.)
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

export const config = {
  matcher: [
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
