/**
 * Ai được mở tài liệu cộng tác nào (ADR-014). Chạy ở `onAuthenticate` của Hocuspocus cho từng tài liệu: provider v3 luôn gửi
 * bản tin xác thực khi mở kết nối (token rỗng), còn phiên đọc từ cookie của yêu cầu upgrade như REST. Thứ tự: tên tài liệu,
 * Origin (cùng cách chống CSRF của REST, vì cookie tự đi kèm WebSocket), phiên, quyền đọc nhiệm vụ như GET /api/tasks/{id};
 * sửa được khi có `task.update_metadata` và nhiệm vụ chưa lưu trữ, không thì chỉ đọc.
 */
import type { IncomingHttpHeaders } from "node:http";
import { getSessionFromRequest } from "@/lib/jwt-session";
import { loadAuthorizationContext } from "@/server/authorization/authorization-context-service";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildTaskResource } from "@/server/authorization/available-actions";
import { getAllowedOrigins, parseHttpOrigin } from "@/server/security/csrf";
import { readTaskForUser } from "@/server/tasks/read-task-for-user";

const DOCUMENT_NAME = /^task:([a-z0-9]{20,40})$/;

export interface CollabAccess {
  userId: string;
  userName: string;
  taskId: string;
  readOnly: boolean;
}

/** Lỗi từ chối kết nối; Hocuspocus gửi `reason` về client trong bản tin permission-denied. */
export class CollabAccessError extends Error {
  constructor(readonly reason: "invalid-document" | "origin-not-allowed" | "unauthenticated" | "forbidden") {
    super(reason);
    this.name = "CollabAccessError";
  }
}

/** `task:<id>` → id nhiệm vụ; sai định dạng → null (không tra CSDL). */
export function parseCollabDocumentName(documentName: string): string | null {
  return DOCUMENT_NAME.exec(documentName)?.[1] ?? null;
}

export function collabDocumentName(taskId: string): string {
  return `task:${taskId}`;
}

function headerReader(raw: IncomingHttpHeaders) {
  return {
    get(name: string): string | null {
      const value = raw[name.toLowerCase()];
      if (Array.isArray(value)) return value.join(", ");
      return value ?? null;
    },
  };
}

/**
 * Origin của yêu cầu upgrade phải là chính trang (Host hoặc X-Forwarded-Host qua rewrite của web, cùng giao thức) hoặc
 * APP_URL đã cấu hình, như `validateCsrf`. Thiếu Origin thì từ chối: trình duyệt luôn gửi khi mở WebSocket.
 */
export function isAllowedCollabOrigin(requestHeaders: IncomingHttpHeaders): boolean {
  const headers = headerReader(requestHeaders);
  const origin = parseHttpOrigin(headers.get("origin") ?? "");
  if (!origin) return false;
  const host = headers.get("host") ?? "localhost";
  const allowed = getAllowedOrigins({ url: `http://${host}/`, headers } as unknown as Request);
  return allowed.has(origin);
}

export async function authorizeCollabConnection(input: {
  documentName: string;
  requestHeaders: IncomingHttpHeaders;
}): Promise<CollabAccess> {
  const taskId = parseCollabDocumentName(input.documentName);
  if (!taskId) throw new CollabAccessError("invalid-document");
  if (!isAllowedCollabOrigin(input.requestHeaders)) throw new CollabAccessError("origin-not-allowed");

  const session = await getSessionFromRequest({ headers: headerReader(input.requestHeaders) });
  if (!session?.id) throw new CollabAccessError("unauthenticated");

  const authContext = await loadAuthorizationContext(session.id);
  let rawTask: Awaited<ReturnType<typeof readTaskForUser>>["rawTask"];
  try {
    ({ rawTask } = await readTaskForUser(authContext, taskId));
  } catch {
    throw new CollabAccessError("forbidden");
  }
  const canEdit =
    !rawTask.archivedAt && authorize(authContext, "task.update_metadata", buildTaskResource(rawTask)).allowed;
  return { userId: session.id, userName: session.name, taskId, readOnly: !canEdit };
}
