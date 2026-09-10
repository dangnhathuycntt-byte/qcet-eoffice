import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Sprint 8: Canonical Routing Middleware
 * Intercepts legacy query parameters (e.g., ?zone=tasks, ?zone=documents, ?zone=calendar, ?zone=org)
 * and permanently redirects (308) to their canonical route URLs.
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const zone = searchParams.get('zone');

  if (zone) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('zone');

    let targetPath = '/';
    if (zone === 'tasks') {
      targetPath = '/tasks';
    } else if (zone === 'documents') {
      targetPath = '/documents';
    } else if (zone === 'calendar') {
      targetPath = '/calendar';
    } else if (zone === 'org') {
      targetPath = '/org';
    } else if (zone === 'portal') {
      targetPath = '/';
    }

    url.pathname = targetPath;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)'],
};
