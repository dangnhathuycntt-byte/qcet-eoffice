/**
 * Định tuyến như cloudflared sau khi tách web/api (D6): `/api` và `/api/*` tới middleware của API, đường dẫn
 * khác tới middleware của web. Test middleware viết từ khi còn một ứng dụng gọi một hàm cho cả hai loại đường dẫn.
 */
import type { NextRequest } from "next/server";
import { middleware as apiMiddleware } from "../../apps/api/src/middleware";
import { middleware as webMiddleware } from "../../apps/web/src/middleware";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  return /^\/api(\/|$)/.test(pathname) ? apiMiddleware(request) : webMiddleware(request);
}
