import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/jwt-session';
import { sanitizeRedirectUrl } from '@/lib/login-helpers';

/**
 * QCET E-Office Canonical Authentication & Routing Middleware
 *
 * Enforces server-side authentication boundaries:
 * 1. Unauthenticated users accessing protected routes -> redirect to /login with returnTo.
 * 2. Authenticated users opening /login -> redirect to /tasks.
 * 3. Root '/' -> /tasks for authenticated users, /login for unauthenticated users.
 * 4. Intercepts legacy query params (?zone=...) and redirects to canonical URLs.
 * 5. Strictly sanitizes returnTo to prevent Open Redirect attacks.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Check user authentication via session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? verifySessionToken(sessionCookie) : null;
  const isAuthenticated = Boolean(session);

  // 2. Intercept legacy zone parameters (?zone=...)
  const zone = searchParams.get('zone');
  if (zone) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('zone');

    let targetPath = '/tasks';
    if (zone === 'documents') {
      targetPath = '/documents';
    } else if (zone === 'calendar') {
      targetPath = '/calendar';
    } else if (zone === 'org') {
      targetPath = '/org';
    } else if (zone === 'tasks' || zone === 'portal' || zone === 'dashboard') {
      targetPath = '/tasks';
    }

    url.pathname = targetPath;
    return NextResponse.redirect(url, 308);
  }

  // 3. Handle /dashboard and /portal legacy routes -> /tasks
  if (pathname === '/dashboard' || pathname === '/portal') {
    const url = request.nextUrl.clone();
    url.pathname = '/tasks';
    return NextResponse.redirect(url, 308);
  }

  // 4. Handle /login route
  if (pathname === '/login') {
    if (isAuthenticated) {
      // Authenticated users opening /login -> redirect to /tasks
      const url = request.nextUrl.clone();
      url.pathname = '/tasks';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 5. Handle Root '/' route
  if (pathname === '/') {
    const url = request.nextUrl.clone();
    if (isAuthenticated) {
      url.pathname = '/tasks';
      return NextResponse.redirect(url);
    } else {
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // 6. Handle all other protected routes
  if (!isAuthenticated) {
    const originalPath = `${pathname}${request.nextUrl.search}`;
    const safeReturnTo = sanitizeRedirectUrl(originalPath);

    const loginUrl = new URL('/login', request.nextUrl.origin);
    if (safeReturnTo && safeReturnTo !== '/tasks' && safeReturnTo !== '/') {
      loginUrl.searchParams.set('returnTo', safeReturnTo);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (/api/*)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo-qcet.png, manifest, service worker
     * - static image and asset extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico|logo-qcet.png|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)$).*)',
  ],
};
