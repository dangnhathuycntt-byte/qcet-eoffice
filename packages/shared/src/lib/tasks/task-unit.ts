/**
 * Đơn vị chủ trì của nhiệm vụ (đơn vị nào giao việc đơn vị đó): ưu tiên đơn vị chủ trì,
 * rồi mã đơn vị, rồi `department.id`. Không có thì trả `undefined` (không giới hạn theo đơn vị).
 */
export function getTaskUnitId(task: unknown): string | undefined {
  const t = task as { leadDepartmentId?: string; departmentId?: string; department?: unknown } | null | undefined;
  return (
    t?.leadDepartmentId ??
    t?.departmentId ??
    (typeof t?.department === "object" ? (t.department as { id?: string } | null)?.id : undefined) ??
    undefined
  );
}
