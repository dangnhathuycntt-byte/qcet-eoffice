import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from '@qcet/contracts/session';
import { sanitizeRedirectUrl } from '@qcet/shared/lib/login-helpers';

/**
 * Middleware của web (D4). Chỉ kiểm có cookie/Bearer phiên để chuyển trang cần đăng nhập về /login sớm,
 * giữ các chuyển hướng chuẩn và gắn x-request-id. Không xác minh phiên: trang hỏi GET /api/auth/me và
 * API là nơi quyết định (phiên hết hạn, thu hồi, tài khoản khóa).
 *
 * Yêu cầu /api/* chỉ được gắn x-request-id rồi đi tiếp tới rewrite (API_INTERNAL_URL); middleware của API
 * xác thực. Chạy Node runtime như bản trước khi tách (giới hạn đệm body ở next.config).
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
 * Requirements & Invariants (phần giao diện của Issue #27):
 * 1. Unauthenticated users accessing protected UI routes -> redirect to /login with returnTo.
 * 2. Authenticated users opening /login -> page asks /api/auth/me for server truth.
 * 3. Root '/' (Tổng quan) -> /login for unauthenticated users; any session passes through to
 *    app/page.tsx, which verifies it via /api/auth/me.
 * 4. Public assets, static chunks, PWA manifest, /portal and /docs (user guide): Always accessible.
 * 5. Canonical singular to plural redirects (/task -> /tasks).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware for static assets, next internal files, and public assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') || // Static files like favicon.ico, images, manifest.json
    pathname === '/portal' ||
    pathname.startsWith('/portal/') ||
    // Tài liệu hướng dẫn: nội dung tĩnh, ai cũng đọc được (người dùng duyệt 14/10/2026), không gọi API cần đăng nhập.
    pathname === '/docs' ||
    pathname.startsWith('/docs/') ||
    // Bảng mẫu thành phần: chỉ tồn tại ở môi trường phát triển (production trả 404).
    (process.env.NODE_ENV !== 'production' && pathname === '/design')
  ) {
    return NextResponse.next();
  }

  // 1b. Correlation ID propagation: extract from inbound header or generate a
  // fresh UUID. The ID is forwarded to Route Handlers via a request header and
  // echoed back to the caller via a response header for end-to-end tracing.
  const inboundRequestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    request.headers.get('x-trace-id');
  const requestId = inboundRequestId?.trim() || crypto.randomUUID();
  // Attach to request so downstream getRequestId() picks it up automatically.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  /** Forward correlation ID on request headers and echo it in the response. */
  function nextWithCorrelation() {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  /** Redirect response that echoes the correlation ID header. */
  function redirectWithCorrelation(url: URL | string, statusCode?: number) {
    const res = statusCode
      ? NextResponse.redirect(url, statusCode)
      : NextResponse.redirect(url);
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // 2. API: xác thực ở middleware và route của API; ở đây chỉ chuyển tiếp kèm x-request-id
  if (pathname.startsWith('/api')) {
    return nextWithCorrelation();
  }

  // 3. Canonical redirects (e.g. /task -> /tasks, /onboarding -> /tasks)
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
    const url = request.nextUrl.clone();
    url.pathname = '/tasks';
    url.search = '';
    return redirectWithCorrelation(url, 307);
  }
  if (pathname === '/task') {
    const url = request.nextUrl.clone();
    url.pathname = '/tasks';
    return redirectWithCorrelation(url, 308);
  }
  if (pathname.startsWith('/task/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/task\//, '/tasks/');
    return redirectWithCorrelation(url, 308);
  }

  // 4. Extract session token cookie for UI routes
  const token = extractTokenFromRequest(request);
  const hasToken = Boolean(token && token.trim().length > 0);

  // 5-6. Root '/' = trang Tổng quan (từ 15/10/2026; trước đó chuyển thẳng sang /tasks). Chưa có phiên thì về /login;
  // có phiên (JWT hay phiên DB) thì app/page.tsx kiểm phiên phía máy chủ rồi hiện Tổng quan hoặc chuyển ?zone= cũ tới trang tương ứng.
  if (pathname === '/') {
    if (!hasToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      return redirectWithCorrelation(url);
    }
    return nextWithCorrelation();
  }

  // 7. Handle /login route
  if (pathname === '/login') {
    // Middleware cannot check DB revocation or account status. Always let the login page
    // ask /api/auth/me for server truth; an active session is redirected client-side.
    return nextWithCorrelation();
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
    return redirectWithCorrelation(loginUrl);
  }

  // If hasToken is true, let request through so Server Component / AppShell verifies DB session truth
  return nextWithCorrelation();
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
