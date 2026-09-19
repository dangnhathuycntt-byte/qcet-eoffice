/**
 * Canonical URL helpers for task detail navigation.
 *
 * The canonical detail page is always the root parent task.
 * Child tasks are addressed as query params on their parent:
 *   /tasks/{parentId}?subtaskId={childId}
 *
 * These helpers centralise the convention so copy-link, redirect,
 * notification-href, and route builders all share the same shape.
 */

/**
 * Build a relative href to a task detail page.
 *
 * @param taskId   – the parent (or standalone) task id
 * @param childId  – optional child id to deep-link into the peek
 * @returns e.g. "/tasks/abc123" or "/tasks/abc123?subtaskId=def456"
 */
export function getTaskDetailHref(
  taskId: string,
  childId?: string | null,
): string {
  const base = `/tasks/${taskId}`;
  if (!childId) return base;
  return `${base}?subtaskId=${childId}`;
}

/**
 * Build an absolute URL to a task detail page using the current origin.
 * Safe to call only in browser context.
 */
export function getTaskDetailUrl(
  taskId: string,
  childId?: string | null,
): string {
  if (typeof window === "undefined") return getTaskDetailHref(taskId, childId);
  return `${window.location.origin}${getTaskDetailHref(taskId, childId)}`;
}
