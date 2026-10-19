import { NextResponse } from "next/server";
import { getPublicRuntimeConfig } from "@/config/runtime";
import { logger } from "@/server/observability/logger";

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
    logger.error("runtime_config.generate_failed", { error }, error);
    return NextResponse.json(
      { error: "Internal Server Error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
