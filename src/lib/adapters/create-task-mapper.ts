/**
 * Canonical Task Create Adapter (T05 / §5 C1)
 *
 * Single mapper that carries a UI create draft through to the canonical API
 * contract and reconciles the server response back into client state:
 *
 *   CreateTaskDraft (UI) -> buildCreateTaskPayload -> CreateTaskInput (strict)
 *     -> submitCreateTask (POST /api/tasks) -> TaskDetailDTO -> reconcileCreatedTask
 *
 * Invariants upheld:
 * - One capability, one implementation: this is the only UI->API create mapper.
 *   Callers must not POST a raw form payload.
 * - T24 "identity by ID": assignee identity is persisted as a stable ID resolved
 *   from an injected personnel list. Names are never forwarded to the API.
 * - T27 "unknown result is not proven failure": create submissions carry a stable
 *   idempotency key (header) that is reused across retries, so a lost response is
 *   reconciled/replayed rather than double-submitted with a fresh key.
 * - C14 "creation cost": the adapter never sources system-derived fields
 *   (id, status, code, creatorId, createdById, progress, version, approvedAt).
 * - The strict `CreateTaskInputSchema` is consumed as-is and never widened.
 */

import { CreateTaskInputSchema, type CreateTaskInput, type TaskPriorityInput } from '@/contracts/tasks';
import type { TaskDetailDTO } from '@/server/dto/task-dto';

/** Visual/creation level exposed by the create-task UI. */
export type CreateTaskLevel = 'TRUONG' | 'DON_VI' | 'STAFF';

/**
 * Deliberate mapping from the UI creation level to the canonical task scope.
 *
 * TRUONG (cấp Trường, school-wide directive) -> SCHOOL
 * DON_VI (cấp đơn vị/khoa phòng)             -> DEPARTMENT
 * STAFF  (cá nhân)                           -> INDIVIDUAL
 *
 * `level` is a UI concept and must never be forwarded verbatim to the API.
 */
export const TASK_LEVEL_TO_SCOPE = {
  TRUONG: 'SCHOOL',
  DON_VI: 'DEPARTMENT',
  STAFF: 'INDIVIDUAL',
} as const satisfies Record<CreateTaskLevel, 'SCHOOL' | 'DEPARTMENT' | 'INDIVIDUAL'>;

/**
 * Canonical UI create draft.
 *
 * Structurally compatible with `CreateTaskFormData` (the create-task modal) so
 * existing callers can pass their draft through unchanged, but it also accepts
 * an optional `priority`.
 *
 * The legacy-only fields below are retained purely for structural compatibility;
 * they are intentionally NOT persisted through POST /api/tasks because the strict
 * canonical schema rejects them (widening it is forbidden without domain proof).
 */
export interface CreateTaskDraft {
  level: CreateTaskLevel;
  title: string;
  startDate?: string;
  dueDate: string;
  description?: string;
  /** Initial DRI, expressed as a display name. Resolved to a stable ID. */
  leadAssigneeName?: string;
  /** Collaborators, expressed as display names. Resolved to stable IDs. */
  coAssignees?: string[];
  parentTaskId?: string;
  priority?: TaskPriorityInput;
  /* Legacy / UI-only fields — deliberately not persisted by this adapter. */
  category?: string;
  internalDueDate?: string;
  requiredDeliverables?: string;
  vtvlRole?: string;
  isBypassWarning?: boolean;
  requiresReview?: boolean;
}

/** Minimal personnel reference required to resolve a display name to a stable ID. */
export interface CreateTaskPersonnelRef {
  id: string;
  name: string;
  departmentId?: string | null;
}

export type PersonnelIndex = ReadonlyMap<string, CreateTaskPersonnelRef>;

export interface MapCreateTaskDraftOptions {
  /** Personnel directory used to resolve names to stable IDs. */
  personnel?: readonly CreateTaskPersonnelRef[];
  /** Explicit department scope for unit (DON_VI) tasks. */
  departmentId?: string | null;
  /** Pre-resolved DRI ID. Takes precedence over name resolution when provided. */
  assigneeId?: string | null;
  /** Pre-resolved collaborator IDs. Takes precedence over name resolution when provided. */
  collaboratorIds?: readonly string[];
}

const MAX_COLLABORATORS = 50;

function trimOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Normalizes a display name for exact, whitespace/diacritic-insensitive matching. */
export function normalizePersonnelName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Builds a lookup index from a personnel directory. First entry wins on collisions. */
export function buildPersonnelIndex(
  personnel: readonly CreateTaskPersonnelRef[] | undefined
): PersonnelIndex {
  const index = new Map<string, CreateTaskPersonnelRef>();
  if (!Array.isArray(personnel)) return index;
  for (const person of personnel) {
    if (!person || typeof person.id !== 'string' || typeof person.name !== 'string') continue;
    const id = person.id.trim();
    const key = normalizePersonnelName(person.name);
    if (!id || !key || index.has(key)) continue;
    index.set(key, { ...person, id });
  }
  return index;
}

/**
 * Resolves a display name to a stable ID using an injected personnel index.
 * Returns undefined when the name is unknown — the adapter never invents IDs.
 */
export function resolvePersonnelId(
  name: string | null | undefined,
  index: PersonnelIndex
): string | undefined {
  const normalized = typeof name === 'string' ? normalizePersonnelName(name) : '';
  if (!normalized) return undefined;
  return index.get(normalized)?.id;
}

function resolveCollaboratorNames(
  names: readonly string[] | undefined,
  index: PersonnelIndex
): string[] {
  if (!Array.isArray(names)) return [];
  const ids: string[] = [];
  for (const name of names) {
    const id = resolvePersonnelId(name, index);
    if (id) ids.push(id);
  }
  return ids;
}

function dedupeCollaboratorIds(ids: readonly string[], primaryAssigneeId?: string): string[] {
  const seen = new Set<string>();
  const resolved: string[] = [];
  for (const raw of ids) {
    const id = trimOrUndefined(raw);
    if (!id) continue;
    if (primaryAssigneeId && id === primaryAssigneeId) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    resolved.push(id);
    if (resolved.length >= MAX_COLLABORATORS) break;
  }
  return resolved;
}

/**
 * Pure CreateTaskDraft -> canonical CreateTaskInput mapper.
 *
 * The returned object is validated against the strict `CreateTaskInputSchema`
 * (zero unknown keys, defaults applied — e.g. priority falls back to 'MEDIUM').
 */
export function buildCreateTaskPayload(
  draft: CreateTaskDraft,
  options: MapCreateTaskDraftOptions = {}
): CreateTaskInput {
  if (!draft || typeof draft !== 'object') {
    throw new Error('buildCreateTaskPayload requires a CreateTaskDraft.');
  }

  const scope = TASK_LEVEL_TO_SCOPE[draft.level];
  if (!scope) {
    throw new Error(`Unsupported create-task level: ${String(draft.level)}`);
  }

  const dueDate = trimOrUndefined(draft.dueDate);
  if (!dueDate) {
    throw new Error('CreateTaskDraft.dueDate is required to create a task.');
  }

  const index = buildPersonnelIndex(options.personnel);
  const leadRef = typeof draft.leadAssigneeName === 'string'
    ? index.get(normalizePersonnelName(draft.leadAssigneeName))
    : undefined;

  const assigneeId = trimOrUndefined(options.assigneeId) ?? leadRef?.id;
  const departmentId =
    trimOrUndefined(options.departmentId) ?? trimOrUndefined(leadRef?.departmentId);

  const collaboratorIds = dedupeCollaboratorIds(
    options.collaboratorIds ?? resolveCollaboratorNames(draft.coAssignees, index),
    assigneeId
  );

  const payload: Record<string, unknown> = {
    title: draft.title,
    dueDate,
    scope,
  };

  const startDate = trimOrUndefined(draft.startDate);
  if (startDate) payload.startDate = startDate;

  const description = trimOrUndefined(draft.description);
  if (description) payload.description = description;
  if (draft.priority) payload.priority = draft.priority;
  if (departmentId) payload.departmentId = departmentId;
  if (assigneeId) payload.assigneeId = assigneeId;
  if (collaboratorIds.length > 0) payload.collaboratorIds = collaboratorIds;
  const parentTaskId = trimOrUndefined(draft.parentTaskId);
  if (parentTaskId) payload.parentTaskId = parentTaskId;

  return CreateTaskInputSchema.parse(payload);
}

export interface ReconcileCreatedTaskResult {
  /** Server truth, keyed by stable identifiers. */
  task: TaskDetailDTO;
  id: string;
  code: string;
  /** The optimistic temp id that this server task replaces, when one was supplied. */
  replacedTempId: string | null;
}

/**
 * Reconciles a returned server task DTO (server truth) against optional optimistic state.
 *
 * The optimistic entry (e.g. `task-temp-*`) is keyed by stable server `id`/`code`,
 * never by display name. Throws when the server DTO carries no stable id, because
 * an unidentified server record cannot be safely reconciled.
 */
export function reconcileCreatedTask(
  serverTask: TaskDetailDTO | null | undefined,
  optimisticTempId?: string | null
): ReconcileCreatedTaskResult {
  if (!serverTask || typeof serverTask !== 'object' || !trimOrUndefined(serverTask.id)) {
    throw new Error('Cannot reconcile created task: server task DTO is missing a stable id.');
  }
  const temp = trimOrUndefined(optimisticTempId);
  const replacedTempId = temp && temp !== serverTask.id ? temp : null;
  return {
    task: serverTask,
    id: serverTask.id,
    code: serverTask.code ?? '',
    replacedTempId,
  };
}

export const CREATE_TASK_ENDPOINT = '/api/tasks';
export const CREATE_TASK_IDEMPOTENCY_HEADER = 'idempotency-key';

export interface SubmitCreateTaskOptions extends MapCreateTaskDraftOptions {
  /** Injectable fetch (defaults to global fetch) for testability. */
  fetchImpl?: typeof fetch;
  endpoint?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Stable per-create key. Generated once when omitted and reused across retries. */
  idempotencyKey?: string;
  /** Total attempts (initial + safe replays with the same key). Default 2. */
  maxAttempts?: number;
  /** Optimistic temp id to reconcile against the returned server DTO. */
  optimisticTempId?: string;
  /** Override key generation (test seam). */
  createKey?: () => string;
}

export type CreateTaskSubmitResult =
  | {
      ok: true;
      task: TaskDetailDTO;
      idempotencyKey: string;
      attempts: number;
      replacedTempId: string | null;
    }
  | {
      ok: false;
      reason: 'validation' | 'rejected' | 'unknown';
      idempotencyKey: string;
      attempts: number;
      status?: number;
      error: string;
    };

function defaultCreateKey(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `task-create-${cryptoRef.randomUUID()}`;
  }
  return `task-create-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function extractServerTask(body: unknown): TaskDetailDTO | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const candidate = record.data ?? record.task;
  if (!candidate || typeof candidate !== 'object') return null;
  const task = candidate as TaskDetailDTO;
  return trimOrUndefined(task.id) ? task : null;
}

/**
 * Canonical create command: maps the draft, POSTs the strict payload to
 * /api/tasks with a stable idempotency key, and reconciles the returned
 * server DTO. A transport failure/timeout yields an `unknown` outcome carrying
 * the original key — callers must reconcile before any further retry.
 */
export async function submitCreateTask(
  draft: CreateTaskDraft,
  options: SubmitCreateTaskOptions = {}
): Promise<CreateTaskSubmitResult> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const endpoint = options.endpoint ?? CREATE_TASK_ENDPOINT;
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const idempotencyKey =
    trimOrUndefined(options.idempotencyKey) ?? (options.createKey ?? defaultCreateKey)();

  let payload: CreateTaskInput;
  try {
    payload = buildCreateTaskPayload(draft, options);
  } catch (error) {
    return {
      ok: false,
      reason: 'validation',
      idempotencyKey,
      attempts: 0,
      error: errorMessage(error),
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      reason: 'unknown',
      idempotencyKey,
      attempts: 0,
      error: 'No fetch implementation is available to submit the create-task request.',
    };
  }

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    [CREATE_TASK_IDEMPOTENCY_HEADER]: idempotencyKey,
    ...options.headers,
  };

  let attempts = 0;
  let lastError = 'Create task outcome is unknown.';

  while (attempts < maxAttempts) {
    attempts += 1;

    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
        credentials: 'same-origin',
        signal: options.signal,
      });
    } catch (error) {
      // Unknown outcome (network error / timeout / abort). Never retry with a
      // fresh key: reusing the SAME idempotency key makes the retry safe.
      lastError = errorMessage(error);
      continue;
    }

    if (!response.ok) {
      let message = `Create task rejected with status ${response.status}.`;
      try {
        const body = (await response.json()) as unknown;
        if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
          message = (body as { error: string }).error;
        }
      } catch {
        /* keep the status-derived message */
      }
      return {
        ok: false,
        reason: 'rejected',
        status: response.status,
        idempotencyKey,
        attempts,
        error: message,
      };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      lastError = errorMessage(error);
      continue;
    }

    const serverTask = extractServerTask(body);
    if (!serverTask) {
      lastError = 'Create task response did not contain a server task DTO with a stable id.';
      continue;
    }

    const reconciled = reconcileCreatedTask(serverTask, options.optimisticTempId);
    return {
      ok: true,
      task: reconciled.task,
      idempotencyKey,
      attempts,
      replacedTempId: reconciled.replacedTempId,
    };
  }

  return {
    ok: false,
    reason: 'unknown',
    idempotencyKey,
    attempts,
    error: lastError,
  };
}
