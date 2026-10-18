import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/jwt-session";
import { findActiveUserForDevLogin, listActiveUsersForDevLogin } from "@/server/auth/dev-login-service";

export const dynamic = "force-dynamic";

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Chỉ mở khi chạy `next dev` trên máy cục bộ: bản production (`NODE_ENV=production`) luôn 404,
 * và Host phải là localhost để một dev server lỡ mở ra mạng không thành cửa sau.
 */
function isLocalDev(req: NextRequest): boolean {
  return process.env.NODE_ENV === "development" && LOCAL_HOST.test(req.headers.get("host") ?? "");
}

const notFound = () => new NextResponse(null, { status: 404 });

/** GET /api/dev/login-as — danh sách tài khoản đang hoạt động để chọn vai trò thử (chỉ dev cục bộ). */
export async function GET(req: NextRequest) {
  if (!isLocalDev(req)) return notFound();
  const users = await listActiveUsersForDevLogin();
  return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/dev/login-as { userId } — cấp phiên như đăng nhập Google cho tài khoản đó (chỉ dev cục bộ). */
export async function POST(req: NextRequest) {
  if (!isLocalDev(req)) return notFound();
  const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const user = userId
    ? await findActiveUserForDevLogin(userId)
    : null;
  if (!user) return NextResponse.json({ error: "Không tìm thấy tài khoản" }, { status: 404 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role, title: user.title }),
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return res;
}
