/**
 * Phạm vi đọc nhiệm vụ của người thường theo từng mã nhiệm vụ (D07, spec task-document-gap-spec.md).
 *
 * Danh sách đã lọc bằng `buildTaskReadWhere`: người thường chỉ thấy phần mình tham gia (và việc cha, con
 * của nó). Quyền đọc nhiệm vụ theo mã trong engine vẫn cho mọi viên chức cùng đơn vị (quyền cơ bản
 * `STEP_5_STAFF_BASE_AUTHORITY`), nên đường đọc theo mã áp lại đúng điều kiện của danh sách, chỉ với những
 * ca được mở bởi quyền cơ bản đó. Ủy quyền, người duyệt chỉ định, truy cập qua văn bản liên kết không bị ảnh hưởng.
 */
import type { AuthorizationContext } from "@/server/authorization/authorization-context";
import { authorize } from "@/server/authorization/authorization-engine";
import { buildTaskResource } from "@/server/authorization/available-actions";
import { prisma } from "@/lib/prisma";
import { buildTaskReadWhere } from "./task-query-service";

export type ReadScope = (ids: string[]) => Promise<Set<string>>;

/** Quyền đọc của nhiệm vụ này đến từ quyền cơ bản của viên chức (cần áp phạm vi D07). */
export function readsViaStaffBase(ctx: AuthorizationContext, task: unknown): boolean {
  const decision = authorize(ctx, "task.read", buildTaskResource(task));
  return decision.allowed && (decision.auditRecord as { policyMatched?: string } | undefined)?.policyMatched === "STEP_5_STAFF_BASE_AUTHORITY";
}

/** Bộ kiểm phạm vi đọc dựa trên DB, dùng cùng điều kiện với danh sách. */
export function dbReadScope(ctx: AuthorizationContext): ReadScope {
  return async (ids) => {
    if (ids.length === 0) return new Set();
    const rows = await prisma.task.findMany({ where: { AND: [{ id: { in: ids } }, buildTaskReadWhere(ctx)] }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  };
}

/** Nhiệm vụ này có được đọc không, tính cả phạm vi D07. `readScope` vắng thì chỉ theo engine. */
export async function canReadTask(ctx: AuthorizationContext, task: { id: string }, readScope?: ReadScope): Promise<boolean> {
  if (!authorize(ctx, "task.read", buildTaskResource(task)).allowed) return false;
  if (!readScope || !readsViaStaffBase(ctx, task)) return true;
  return (await readScope([task.id])).has(task.id);
}
