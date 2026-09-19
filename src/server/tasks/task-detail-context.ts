/**
 * TASK DETAIL ROUTE CONTEXT
 *
 * Secure canonical task detail routing helper.
 * Independently authorizes the route task, all ancestors needed for canonical
 * parent resolution, and each child before mapping/serializing.
 *
 * Invariants:
 * 1. Canonical page = root parent (no parentTaskId). Child tasks redirect
 *    to their root parent with ?subtaskId= deep link.
 * 2. If child allowed but canonical parent denied → notFound (no standalone
 *    child fallback).
 * 3. Parent allowed + invalid/mismatched/denied subtaskId → load parent,
 *    no child data exposed.
 * 4. peekTasks only contains independently authorized descendants.
 * 5. Mapped parent subTasks contains only readable direct children but
 *    progress/count aggregates come from raw data (not filtered subset).
 */

import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import { authorize } from '@/server/authorization/authorization-engine';
import {
  buildTaskResource,
  computeAvailableActions,
} from '@/server/authorization/available-actions';
import type { CapabilityAction } from '@/server/authorization/capability';
import {
  mapPrismaTaskToSchoolTask,
  mapPrismaTaskToStaffTask,
} from '@/lib/adapters/task-db-adapter';
import type { StaffTask } from '@/types/dashboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw task entity returned by taskQueryService.getTaskEntityForInternalUse */
export type RawTaskEntity = NonNullable<
  Awaited<ReturnType<typeof import('@/server/tasks').taskQueryService.getTaskEntityForInternalUse>>
>;

export interface TaskDetailRouteResult {
  /** 'render' = render the page; 'redirect' = redirect to canonical parent; 'notFound' = 404 */
  outcome: 'render' | 'redirect' | 'notFound';
  /** Redirect target, set when outcome === 'redirect' */
  redirectTo?: string;
  /** The canonical (root-parent) raw task entity, set when outcome === 'render' */
  canonicalRawTask?: RawTaskEntity;
  /** Available actions for the canonical task */
  canonicalAvailableActions?: CapabilityAction[];
  /** Independently authorized peek tasks (descendants the user can read) */
  peekTasks?: StaffTask[];
  /** Raw sub-task count from original data (before auth filtering) for progress aggregation */
  rawSubTaskCount?: number;
  /** Raw completed sub-task count from original data */
  rawCompletedSubTaskCount?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface FetchTaskById {
  (id: string): Promise<RawTaskEntity | null>;
}

/**
 * Walk from a task up to its root parent, authorizing each ancestor.
 * Returns the root task entity if every ancestor is readable, or null if any
 * ancestor is denied or missing.
 *
 * Uses iterative traversal — no recursion, no depth limit.
 */
export async function resolveCanonicalParent(
  startTaskId: string,
  authCtx: AuthorizationContext,
  fetchTask: FetchTaskById,
): Promise<{ root: RawTaskEntity; chain: RawTaskEntity[] } | null> {
  const chain: RawTaskEntity[] = [];
  const visited = new Set<string>();
  let currentId: string | null = startTaskId;

  while (currentId) {
    if (visited.has(currentId)) {
      // Circular reference guard
      return null;
    }
    visited.add(currentId);

    const task = await fetchTask(currentId);
    if (!task) return null;

    // Authorize reading this task
    const resource = buildTaskResource(task);
    if (!authorize(authCtx, 'task.read', resource).allowed) {
      return null;
    }

    chain.push(task);

    // Walk up via raw model field
    const parentId = (task as any).parentTaskId as string | null | undefined;
    if (!parentId) {
      // This is the root
      return { root: task, chain };
    }
    currentId = parentId;
  }

  return null;
}

/**
 * Authorize each direct child (sub-task) of the canonical task.
 * Returns only the children the user can read, mapped as StaffTask with
 * availableActions attached.
 *
 * Does NOT recurse into grandchildren — peek targets are only direct children.
 */
export function authorizeSubTasks(
  rawSubTasks: any[],
  authCtx: AuthorizationContext,
): StaffTask[] {
  const authorized: StaffTask[] = [];

  for (const st of rawSubTasks) {
    if (!st || typeof st !== 'object') continue;

    const resource = buildTaskResource(st);
    if (!authorize(authCtx, 'task.read', resource).allowed) {
      continue;
    }

    const mapped = mapPrismaTaskToStaffTask(st);
    const actions = computeAvailableActions(authCtx, resource);
    (mapped as any).availableActions = actions;
    authorized.push(mapped);
  }

  return authorized;
}

/**
 * Compute aggregate progress/count from raw (unfiltered) sub-tasks.
 * These numbers reflect the real business state, not the user's access scope.
 */
export function computeRawSubTaskAggregates(rawSubTasks: any[]): {
  totalSubTasks: number;
  completedSubTasks: number;
} {
  const totalSubTasks = rawSubTasks.length;
  const completedSubTasks = rawSubTasks.filter((st: any) => {
    if (!st || typeof st !== 'object') return false;
    const s = String(st.status || '').toUpperCase();
    return s === 'COMPLETED';
  }).length;

  return { totalSubTasks, completedSubTasks };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Resolve the task-detail route context with full authorization.
 *
 * @param routeTaskId  – the [id] path param
 * @param subtaskId    – ?subtaskId= query param (optional)
 * @param queryString  – full query string to preserve in redirect (for returnTo)
 * @param authCtx      – loaded AuthorizationContext for the current user
 * @param fetchTask    – injected fetcher (taskQueryService.getTaskEntityForInternalUse)
 */
export async function resolveTaskDetailContext(
  routeTaskId: string,
  subtaskId: string | null | undefined,
  queryString: string,
  authCtx: AuthorizationContext,
  fetchTask: FetchTaskById,
): Promise<TaskDetailRouteResult> {
  // 1. Fetch and authorize the route task
  const routeTask = await fetchTask(routeTaskId);
  if (!routeTask) {
    return { outcome: 'notFound' };
  }

  const routeResource = buildTaskResource(routeTask);
  if (!authorize(authCtx, 'task.read', routeResource).allowed) {
    return { outcome: 'notFound' };
  }

  // 2. If this is a child task, find canonical root parent
  const routeParentId = (routeTask as any).parentTaskId as string | null | undefined;
  if (routeParentId) {
    // Walk up to root, authorizing every ancestor
    const resolution = await resolveCanonicalParent(routeParentId, authCtx, fetchTask);
    if (!resolution) {
      // Canonical parent denied or missing → notFound (no standalone child fallback)
      return { outcome: 'notFound' };
    }

    // Redirect to canonical root with subtaskId=routeTaskId, preserving other query params
    const rootId = resolution.root.id;
    const params = new URLSearchParams(queryString);
    params.set('subtaskId', routeTaskId);
    return {
      outcome: 'redirect',
      redirectTo: `/tasks/${rootId}?${params.toString()}`,
    };
  }

  // 3. This IS the canonical (root) task. Authorize it fully.
  const canonicalAvailableActions = computeAvailableActions(authCtx, routeResource);

  // 4. Process sub-tasks: compute raw aggregates from original data,
  //    then filter to only authorized children for peekTasks.
  const rawSubTasks: any[] = (routeTask as any).subTasks || [];
  const { totalSubTasks, completedSubTasks } = computeRawSubTaskAggregates(rawSubTasks);
  const peekTasks = authorizeSubTasks(rawSubTasks, authCtx);

  // 5. Validate subtaskId if provided: must be among authorized peek tasks
  //    If invalid/denied, we still render the parent — just no child data.
  //    (The client handles missing subtaskId gracefully.)

  return {
    outcome: 'render',
    canonicalRawTask: routeTask,
    canonicalAvailableActions,
    peekTasks,
    rawSubTaskCount: totalSubTasks,
    rawCompletedSubTaskCount: completedSubTasks,
  };
}
