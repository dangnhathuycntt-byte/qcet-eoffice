import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [total, incoming, outgoing, internal, pending, urgent] = await Promise.all([
      prisma.document.count(),
      prisma.document.count({ where: { type: "VAN_BAN_DEN" } }),
      prisma.document.count({ where: { type: "VAN_BAN_DI" } }),
      prisma.document.count({ where: { type: "TO_TRINH_NOI_BO" } }),
      prisma.document.count({ where: { status: "CHO_PHAN_CONG" } }),
      prisma.document.count({ where: { urgency: { in: ["KHAN", "THUONG_KHAN", "HOA_TOC"] } } }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          total,
          incoming,
          outgoing,
          internal,
          pending,
          urgent,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    console.error("Error fetching document stats:", err);
    return NextResponse.json(
      { success: false, error: "Lỗi tổng hợp số liệu sổ văn bản" },
      { status: 500 }
    );
  }
}
