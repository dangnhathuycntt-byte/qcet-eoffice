import { logAuditEvent, AuditAction, AuditEntityType } from "@qcet/db/audit";

/** Ghi yêu cầu cấp quyền từ màn đăng nhập vào audit log (không transaction). */
export async function recordAccessRequest({
  email,
  name,
  ip,
}: {
  email: string;
  name?: string;
  ip?: string;
}) {
  await logAuditEvent({
    action: AuditAction.ACCESS_REQUESTED,
    entityType: AuditEntityType.USER,
    entityId: email,
    metadata: {
      type: "ACCESS_REQUEST",
      email,
      name: name || undefined,
      timestamp: new Date().toISOString(),
      source: "LOGIN_FLOW",
      ip,
    },
  });
}
