import type { NextRequest } from "next/server";
import { serverEnv } from "@/config/env.server";

/**
 * Xác thực lời gọi cron: yêu cầu `Authorization: Bearer <CRON_SECRET>` hoặc header `x-cron-secret`.
 * Có CRON_SECRET thì bắt buộc khớp; production không có CRON_SECRET thì từ chối; môi trường
 * phát triển/kiểm thử không cấu hình thì cho gọi cục bộ. Cùng quy tắc với document-deadline-check.
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET || serverEnv.CRON_SECRET;
  if (cronSecret) {
    return (
      request.headers.get("authorization") === `Bearer ${cronSecret}` ||
      request.headers.get("x-cron-secret") === cronSecret
    );
  }
  return process.env.NODE_ENV !== "production";
}
