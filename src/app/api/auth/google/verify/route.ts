import { NextResponse } from "next/server";

/**
 * Retired Google Identity Services endpoint.
 *
 * OAuth sessions must be created exclusively by Auth.js so callback validation,
 * PKCE/state checks, account linking, and database sessions follow one path.
 */
export async function POST(_request?: Request) {
  return NextResponse.json(
    {
      success: false,
      error: "Endpoint xác thực cũ đã ngừng hoạt động. Vui lòng đăng nhập lại bằng Google.",
      code: "legacy_auth_endpoint_retired",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
