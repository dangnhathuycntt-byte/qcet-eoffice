import { NextRequest, NextResponse } from "next/server";
import { getLiveDashboardData } from "@/lib/server/dashboard-service";
import { getSessionFromRequest } from "@/lib/jwt-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest): Promise<NextResponse>;
export async function GET(): Promise<NextResponse>;
export async function GET(request?: NextRequest): Promise<NextResponse> {
  try {
    if (request) {
      const session = getSessionFromRequest(request);
      if (!session) {
        return NextResponse.json(
          { success: false, error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const data = await getLiveDashboardData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    });
  } catch (err: any) {
    console.error("Database query failed in /api/dashboard/overview:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Không thể kết nối cơ sở dữ liệu hệ thống",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
