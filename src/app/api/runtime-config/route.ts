import { NextResponse } from "next/server";
import { getPublicRuntimeConfig } from "@/config/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getPublicRuntimeConfig();

    return NextResponse.json(config, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[RuntimeConfigAPI] Failed to generate runtime config:", error);
    return NextResponse.json(
      { error: "Internal Server Error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
