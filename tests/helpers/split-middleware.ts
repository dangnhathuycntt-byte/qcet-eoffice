/**
 * Định tuyến như cloudflared sau khi tách web/api (D6): `/api` và `/api/*` tới middleware của API, đường dẫn
 * khác tới middleware của web. Test middleware viết từ khi còn một ứng dụng gọi một hàm cho cả hai loại đường dẫn.
 */
import type { NextRequest } from "next/server";
import { proxy as apiMiddleware } from "../../apps/api/src/proxy";
import { proxy as webMiddleware } from "../../apps/web/src/proxy";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  return /^\/api(\/|$)/.test(pathname) ? apiMiddleware(request) : webMiddleware(request);
}
