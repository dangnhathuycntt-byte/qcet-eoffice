import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent, AuditAction, AuditEntityType } from "@/lib/db/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Vui lòng cung cấp địa chỉ email hợp lệ" },
        { status: 400 }
      );
    }

    // Record audit event for access request
    try {
      await logAuditEvent({
        action: AuditAction.USER_ROLE_CHANGED,
        entityType: AuditEntityType.USER,
        entityId: email,
        metadata: {
          type: "ACCESS_REQUEST",
          email,
          name: name || undefined,
          timestamp: new Date().toISOString(),
          source: "LOGIN_FLOW",
        },
      });
    } catch {
      // Non-blocking if audit recording encounters DB issues in test or dev
    }

    return NextResponse.json({
      success: true,
      message: "Đã gửi yêu cầu cấp quyền. Quản trị viên sẽ xem và phản hồi qua email.",
    });
  } catch {
    return NextResponse.json(
      { error: "Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
