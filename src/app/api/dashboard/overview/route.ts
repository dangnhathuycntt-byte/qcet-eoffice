import { NextResponse } from "next/server";
import { fetchNotionDashboardData } from "@/lib/notion-client";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";

export async function GET() {
  try {
    const data = await fetchNotionDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    const fallback = getMockDashboardPayload();
    return NextResponse.json({ ...fallback, source: "mock-fallback" });
  }
}
