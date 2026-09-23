/**
 * QCET E-Office: PostgreSQL Native Full-Text Search (FTS) & Search Utilities
 *
 * Implements hardened, database-native search capabilities for Tasks, Documents, and Users:
 * 1. searchTasks: Exact code (B-tree) or Full-Text / Trigram similarity search on title & description
 * 2. searchDocuments: Exact original number/registration number or FTS on summary
 * 3. searchUsers: Exact email/phone/id or FTS on name, email & title
 *
 * ARCHITECTURAL INVARIANTS:
 * - Server Truth Wins: Database engine handles all filtering, ranking, and pagination directly.
 * - Zero In-Memory Dataset Dumps: Never pull entire tables into Node.js memory to perform Array.filter().
 * - SQL Injection Immunity: Every dynamic parameter is strictly bound via Prisma.sql / Prisma.join.
 * - Progressive Fallback: Leverages PostgreSQL to_tsvector, ts_rank, and pg_trgm when available,
 *   with an automatic parameterized ILIKE fallback if extensions are missing or queries are simulated.
 */

import {
  Prisma,
  PrismaClient,
  TaskStatus,
  TaskScope,
  DocumentType,
  DocumentStatus,
  UserRole,
} from "@prisma/client";
import type { DbClient } from "./occ";

export type { DbClient };

// ----------------------------------------------------------------------
// Types & Parameter Contracts
// ----------------------------------------------------------------------

export interface SearchTasksParams {
  query: string;
  status?: string | TaskStatus;
  /** Đơn vị chủ trì canonical — lọc trên `tasks.lead_unit_id` (Phase 9). */
  leadUnitId?: string;
  scope?: string | TaskScope;
  limit?: number;
  offset?: number;
  exactCode?: boolean;
}

export interface TaskSearchResultItem {
  id: string;
  code: string;
  title: string;
  description: string | null;
  scope: string;
  status: string;
  priority: string;
  progressPercent: number;
  dueDate: Date | string | null;
  academicMonth: number | null;
  academicYear: string | null;
  leadUnitId: string | null;
  rank?: number;
}

export interface SearchDocumentsParams {
  query: string;
  type?: string | DocumentType;
  status?: string | DocumentStatus;
  limit?: number;
  offset?: number;
  exactCode?: boolean;
}

export interface DocumentSearchResultItem {
  id: string;
  type: string;
  registrationNumber: number;
  documentYear: number;
  originalNumber: string;
  summary: string;
  category: string;
  issuingAuthority: string;
  status: string;
  urgency: string;
  dueDate: Date | string | null;
  /**
   * Đơn vị chủ trì canonical. Phase 9 đã drop `documents.lead_department_id`;
   * giá trị này đọc từ `document_incoming_workflows.lead_unit_id`.
   */
  leadUnitId: string | null;
  rank?: number;
}

export interface SearchUsersParams {
  query: string;
  role?: string | UserRole;
  /**
   * Đơn vị công tác canonical. Phase 9 đã drop `users.department_id`; giá trị này
   * đọc từ phân công vị trí việc làm chính đang hiệu lực
   * (`position_assignments.unit_id`).
   */
  leadUnitId?: string;
  limit?: number;
  offset?: number;
  exactCode?: boolean;
}

export interface UserSearchResultItem {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  phone: string | null;
  avatarUrl: string | null;
  leadUnitId: string | null;
  rank?: number;
}

// ----------------------------------------------------------------------
// Heuristics & Code Detection
// ----------------------------------------------------------------------

const KNOWN_CODE_PREFIX_REGEX = /^(TASK|QCET|NV|VB|CV|TB|QD|HD|BC|KH|DA|TT)-/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_WITH_DIGITS_REGEX = /^[A-Za-z0-9\-_/.@]*\d[A-Za-z0-9\-_/.@]*$/;
const PURE_ALPHABETIC_REGEX = /^[A-Za-zÀ-ỹ]+$/u;

/**
 * Determines whether a user query represents an exact identifier/code lookup
 * (e.g. "TASK-2026", "NV-001", "#128", "19/UBND", or single code token with digits).
 * Pure words like "Subtask", "baocao", "report", "plan" return false so they are
 * searched across title and description via Full-Text / Trigram index search.
 */
export function isExactCodeQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  // Multi-word strings with whitespace are always natural text / keyword searches
  if (/\s/.test(trimmed)) return false;

  // Prefixed with hash identifier or user handle / email indicator
  if (trimmed.startsWith("#") || trimmed.startsWith("@") || trimmed.includes("@")) {
    return true;
  }

  // Common organizational institutional code prefixes (e.g. TASK-2026, QCET-DOC, NV-001)
  if (KNOWN_CODE_PREFIX_REGEX.test(trimmed)) {
    return true;
  }

  // Standard UUID identifier format
  if (UUID_REGEX.test(trimmed)) {
    return true;
  }

  // Pure alphabetic words (ASCII or Vietnamese diacritics) must NOT be treated as exact codes
  if (PURE_ALPHABETIC_REGEX.test(trimmed)) {
    return false;
  }

  // Code containing digits combined with separators or alphanumerics (e.g. 19/UBND, 2026-09, TASK-123, 128)
  if (CODE_WITH_DIGITS_REGEX.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Normalizes an exact code query by stripping leading `#` and trimming whitespace.
 */
export function cleanExactCode(query: string): string {
  return query.trim().replace(/^#/, "");
}

// ----------------------------------------------------------------------
// Task Query Builders
// ----------------------------------------------------------------------

const VALID_TASK_STATUSES = new Set(Object.values(TaskStatus));
const VALID_TASK_SCOPES = new Set(Object.values(TaskScope));

export function buildTaskSearchQuery(
  params: SearchTasksParams,
  forceExact?: boolean
): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);
  const isExact = forceExact ?? (params.exactCode ?? isExactCodeQuery(query));

  const conditions: Prisma.Sql[] = [Prisma.sql`d."archived_at" IS NULL`];

  if (params.status) {
    const statusVal = params.status.toUpperCase();
    if (VALID_TASK_STATUSES.has(statusVal as TaskStatus)) {
      conditions.push(Prisma.sql`"status" = ${statusVal}::"TaskStatus"`);
    } else {
      conditions.push(Prisma.sql`d."status"::text = ${params.status}`);
    }
  }

  if (params.leadUnitId) {
    conditions.push(Prisma.sql`"lead_unit_id" = ${params.leadUnitId}`);
  }

  if (params.scope) {
    const scopeVal = params.scope.toUpperCase();
    if (VALID_TASK_SCOPES.has(scopeVal as TaskScope)) {
      conditions.push(Prisma.sql`"scope" = ${scopeVal}::"TaskScope"`);
    } else {
      conditions.push(Prisma.sql`"scope"::text = ${params.scope}`);
    }
  }

  if (isExact) {
    const code = cleanExactCode(query);
    conditions.push(
      Prisma.sql`("code" = ${code} OR "code" ILIKE ${code + "%"} OR "id" = ${code})`
    );

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    return Prisma.sql`
      SELECT
        id, code, title, description, scope, status, priority,
        progress_percent, due_date, academic_month, academic_year,
        lead_unit_id, 1.0::float AS rank
      FROM "tasks"
      ${whereClause}
      ORDER BY
        CASE WHEN "code" = ${code} THEN 0 WHEN "code" ILIKE ${code + "%"} THEN 1 ELSE 2 END,
        "updated_at" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // Full-Text Search (to_tsvector) + pg_trgm ILIKE
  conditions.push(
    Prisma.sql`(
      to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')) @@ plainto_tsquery('simple', ${query})
      OR "title" ILIKE ${"%" + query + "%"}
    )`
  );

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      id, code, title, description, scope, status, priority,
      progress_percent, due_date, academic_month, academic_year,
      lead_unit_id,
      (
        ts_rank(to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')), plainto_tsquery('simple', ${query})) +
        coalesce(similarity("title", ${query}), 0)
      )::float AS rank
    FROM "tasks"
    ${whereClause}
    ORDER BY rank DESC, "updated_at" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export function buildTaskFallbackSearchQuery(params: SearchTasksParams): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`d."archived_at" IS NULL`,
    Prisma.sql`(
      "title" ILIKE ${"%" + query + "%"}
      OR coalesce("description", '') ILIKE ${"%" + query + "%"}
      OR "code" ILIKE ${"%" + query + "%"}
    )`,
  ];

  if (params.status) {
    const statusVal = params.status.toUpperCase();
    if (VALID_TASK_STATUSES.has(statusVal as TaskStatus)) {
      conditions.push(Prisma.sql`"status" = ${statusVal}::"TaskStatus"`);
    } else {
      conditions.push(Prisma.sql`d."status"::text = ${params.status}`);
    }
  }

  if (params.leadUnitId) {
    conditions.push(Prisma.sql`"lead_unit_id" = ${params.leadUnitId}`);
  }

  if (params.scope) {
    const scopeVal = params.scope.toUpperCase();
    if (VALID_TASK_SCOPES.has(scopeVal as TaskScope)) {
      conditions.push(Prisma.sql`"scope" = ${scopeVal}::"TaskScope"`);
    } else {
      conditions.push(Prisma.sql`"scope"::text = ${params.scope}`);
    }
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      id, code, title, description, scope, status, priority,
      progress_percent, due_date, academic_month, academic_year,
      lead_unit_id, 0.5::float AS rank
    FROM "tasks"
    ${whereClause}
    ORDER BY "updated_at" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

// ----------------------------------------------------------------------
// Document Query Builders
// ----------------------------------------------------------------------

const VALID_DOC_TYPES = new Set(Object.values(DocumentType));
const VALID_DOC_STATUSES = new Set(Object.values(DocumentStatus));

/**
 * `documents` không còn cột đơn vị (Phase 9 đã drop `lead_department_id`). Đơn vị
 * chủ trì canonical nằm trên quy trình văn bản đến, nên mọi truy vấn tìm kiếm văn
 * bản đều đi qua khung nhìn nối này.
 */
const DOCUMENTS_WITH_LEAD_UNIT = Prisma.sql`
  "documents" d
  LEFT JOIN "document_incoming_workflows" w ON w."document_id" = d."id"
`;

export function buildDocumentSearchQuery(
  params: SearchDocumentsParams,
  forceExact?: boolean
): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);
  const isExact = forceExact ?? (params.exactCode ?? isExactCodeQuery(query));

  const conditions: Prisma.Sql[] = [Prisma.sql`d."archived_at" IS NULL`];

  if (params.type) {
    const typeVal = params.type.toUpperCase();
    if (VALID_DOC_TYPES.has(typeVal as DocumentType)) {
      conditions.push(Prisma.sql`d."type" = ${typeVal}::"DocumentType"`);
    } else {
      conditions.push(Prisma.sql`d."type"::text = ${params.type}`);
    }
  }

  if (params.status) {
    const statusVal = params.status.toUpperCase();
    if (VALID_DOC_STATUSES.has(statusVal as DocumentStatus)) {
      conditions.push(Prisma.sql`d."status" = ${statusVal}::"DocumentStatus"`);
    } else {
      conditions.push(Prisma.sql`d."status"::text = ${params.status}`);
    }
  }

  if (isExact) {
    const code = cleanExactCode(query);
    const parsedNum = parseInt(code, 10);
    const isNum = !isNaN(parsedNum) && /^\d+$/.test(code);

    if (isNum) {
      conditions.push(
        Prisma.sql`(d."original_number" = ${code} OR d."original_number" ILIKE ${code + "%"} OR d."registration_number" = ${parsedNum} OR d."id" = ${code})`
      );
    } else {
      conditions.push(
        Prisma.sql`(d."original_number" = ${code} OR d."original_number" ILIKE ${code + "%"} OR d."id" = ${code})`
      );
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    return Prisma.sql`
      SELECT
        d.id, d.type, d.registration_number, d.document_year, d.original_number,
        d.summary, d.category, d.issuing_authority, d.status, d.urgency,
        d.due_date, w.lead_unit_id, 1.0::float AS rank
      FROM ${DOCUMENTS_WITH_LEAD_UNIT}
      ${whereClause}
      ORDER BY
        CASE WHEN d.original_number = ${code} THEN 0 WHEN d.original_number ILIKE ${code + "%"} THEN 1 ELSE 2 END,
        d.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // Full-Text Search on summary + pg_trgm ILIKE
  conditions.push(
    Prisma.sql`(
      to_tsvector('simple', coalesce(d."summary", '')) @@ plainto_tsquery('simple', ${query})
      OR d."summary" ILIKE ${"%" + query + "%"}
    )`
  );

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      d.id, d.type, d.registration_number, d.document_year, d.original_number,
      d.summary, d.category, d.issuing_authority, d.status, d.urgency,
      d.due_date, w.lead_unit_id,
      (
        ts_rank(to_tsvector('simple', coalesce(d.summary, '')), plainto_tsquery('simple', ${query})) +
        coalesce(similarity(d.summary, ${query}), 0)
      )::float AS rank
    FROM ${DOCUMENTS_WITH_LEAD_UNIT}
    ${whereClause}
    ORDER BY rank DESC, d.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export function buildDocumentFallbackSearchQuery(
  params: SearchDocumentsParams
): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`d."archived_at" IS NULL`,
    Prisma.sql`(
      d."summary" ILIKE ${"%" + query + "%"}
      OR d."original_number" ILIKE ${"%" + query + "%"}
      OR coalesce(d."issuing_authority", '') ILIKE ${"%" + query + "%"}
    )`,
  ];

  if (params.type) {
    const typeVal = params.type.toUpperCase();
    if (VALID_DOC_TYPES.has(typeVal as DocumentType)) {
      conditions.push(Prisma.sql`d."type" = ${typeVal}::"DocumentType"`);
    } else {
      conditions.push(Prisma.sql`d."type"::text = ${params.type}`);
    }
  }

  if (params.status) {
    const statusVal = params.status.toUpperCase();
    if (VALID_DOC_STATUSES.has(statusVal as DocumentStatus)) {
      conditions.push(Prisma.sql`d."status" = ${statusVal}::"DocumentStatus"`);
    } else {
      conditions.push(Prisma.sql`d."status"::text = ${params.status}`);
    }
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      d.id, d.type, d.registration_number, d.document_year, d.original_number,
      d.summary, d.category, d.issuing_authority, d.status, d.urgency,
      d.due_date, w.lead_unit_id, 0.5::float AS rank
    FROM ${DOCUMENTS_WITH_LEAD_UNIT}
    ${whereClause}
    ORDER BY d.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

// ----------------------------------------------------------------------
// User Query Builders
// ----------------------------------------------------------------------

const VALID_USER_ROLES = new Set(Object.values(UserRole));

/**
 * `users.department_id` đã bị drop (Phase 9). Đơn vị công tác canonical là phân
 * công vị trí việc làm chính đang hiệu lực (`position_assignments`).
 */
const USERS_WITH_LEAD_UNIT = Prisma.sql`
  "users"
  LEFT JOIN LATERAL (
    SELECT pa."unit_id"
    FROM "position_assignments" pa
    WHERE pa."user_id" = "users"."id"
      AND pa."type" = 'PRIMARY'
      AND pa."status" = 'ACTIVE'
    ORDER BY pa."effective_from" DESC
    LIMIT 1
  ) pa ON TRUE
`;

export function buildUserSearchQuery(
  params: SearchUsersParams,
  forceExact?: boolean
): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);
  const isExact = forceExact ?? (params.exactCode ?? isExactCodeQuery(query));

  const conditions: Prisma.Sql[] = [
    Prisma.sql`u."is_active" = true`,
    Prisma.sql`u."deactivated_at" IS NULL`,
  ];

  if (params.role) {
    const roleVal = params.role.toUpperCase();
    if (VALID_USER_ROLES.has(roleVal as UserRole)) {
      conditions.push(Prisma.sql`u."role" = ${roleVal}::"UserRole"`);
    } else {
      conditions.push(Prisma.sql`u."role"::text = ${params.role}`);
    }
  }

  if (params.leadUnitId) {
    conditions.push(Prisma.sql`pa."unit_id" = ${params.leadUnitId}`);
  }

  if (isExact) {
    const code = cleanExactCode(query);
    conditions.push(
      Prisma.sql`(u."email" = ${code} OR u."email" ILIKE ${code + "%"} OR u."phone" = ${code} OR u."id" = ${code})`
    );

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    return Prisma.sql`
      SELECT
        u.id, u.name, u.email, u.role, u.title, u.phone, u.avatar_url,
        pa."unit_id" AS lead_unit_id, 1.0::float AS rank
      FROM ${USERS_WITH_LEAD_UNIT} u
      ${whereClause}
      ORDER BY
        CASE WHEN u."email" = ${code} THEN 0 WHEN u."email" ILIKE ${code + "%"} THEN 1 ELSE 2 END,
        u."name" ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // Full-Text Search on name + email + title + pg_trgm ILIKE
  conditions.push(
    Prisma.sql`(
      to_tsvector('simple', coalesce(u."name", '') || ' ' || coalesce(u."email", '') || ' ' || coalesce(u."title", '')) @@ plainto_tsquery('simple', ${query})
      OR u."name" ILIKE ${"%" + query + "%"}
    )`
  );

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      u.id, u.name, u.email, u.role, u.title, u.phone, u.avatar_url,
      pa."unit_id" AS lead_unit_id,
      (
        ts_rank(to_tsvector('simple', coalesce(u."name", '') || ' ' || coalesce(u."email", '') || ' ' || coalesce(u."title", '')), plainto_tsquery('simple', ${query})) +
        coalesce(similarity(u."name", ${query}), 0)
      )::float AS rank
    FROM ${USERS_WITH_LEAD_UNIT} u
    ${whereClause}
    ORDER BY rank DESC, u."name" ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export function buildUserFallbackSearchQuery(params: SearchUsersParams): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`u."is_active" = true`,
    Prisma.sql`u."deactivated_at" IS NULL`,
    Prisma.sql`(
      u."name" ILIKE ${"%" + query + "%"}
      OR u."email" ILIKE ${"%" + query + "%"}
      OR coalesce(u."title", '') ILIKE ${"%" + query + "%"}
    )`,
  ];

  if (params.role) {
    const roleVal = params.role.toUpperCase();
    if (VALID_USER_ROLES.has(roleVal as UserRole)) {
      conditions.push(Prisma.sql`u."role" = ${roleVal}::"UserRole"`);
    } else {
      conditions.push(Prisma.sql`u."role"::text = ${params.role}`);
    }
  }

  if (params.leadUnitId) {
    conditions.push(Prisma.sql`pa."unit_id" = ${params.leadUnitId}`);
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      u.id, u.name, u.email, u.role, u.title, u.phone, u.avatar_url,
      pa."unit_id" AS lead_unit_id, 0.5::float AS rank
    FROM ${USERS_WITH_LEAD_UNIT} u
    ${whereClause}
    ORDER BY u."name" ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

// ----------------------------------------------------------------------
// Main Search Utilities
// ----------------------------------------------------------------------

/**
 * Searches tasks using PostgreSQL B-tree index (exact code/ID) or Full-Text Search (GIN + pg_trgm).
 */
export async function searchTasks(
  client: DbClient,
  params: SearchTasksParams
): Promise<TaskSearchResultItem[]> {
  const query = (params.query || "").trim();
  if (!query) return [];

  let rows: any[] = [];
  try {
    const sql = buildTaskSearchQuery(params);
    rows = await client.$queryRaw<any[]>(sql);
  } catch (primaryError) {
    // Fallback to safe parameterized ILIKE search if FTS / extensions are not ready
    try {
      const fallbackSql = buildTaskFallbackSearchQuery(params);
      rows = await client.$queryRaw<any[]>(fallbackSql);
    } catch {
      throw primaryError;
    }
  }

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    description: row.description ?? null,
    scope: row.scope,
    status: row.status,
    priority: row.priority,
    progressPercent: row.progress_percent ?? 0,
    dueDate: row.due_date ?? null,
    academicMonth: row.academic_month ?? null,
    academicYear: row.academic_year ?? null,
    leadUnitId: row.lead_unit_id ?? null,
    rank: typeof row.rank === "number" ? row.rank : parseFloat(row.rank) || 0,
  }));
}

/**
 * Searches documents using PostgreSQL B-tree index (exact original/registration number) or FTS on summary.
 */
export async function searchDocuments(
  client: DbClient,
  params: SearchDocumentsParams
): Promise<DocumentSearchResultItem[]> {
  const query = (params.query || "").trim();
  if (!query) return [];

  let rows: any[] = [];
  try {
    const sql = buildDocumentSearchQuery(params);
    rows = await client.$queryRaw<any[]>(sql);
  } catch (primaryError) {
    try {
      const fallbackSql = buildDocumentFallbackSearchQuery(params);
      rows = await client.$queryRaw<any[]>(fallbackSql);
    } catch {
      throw primaryError;
    }
  }

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    registrationNumber: row.registration_number,
    documentYear: row.document_year,
    originalNumber: row.original_number,
    summary: row.summary,
    category: row.category,
    issuingAuthority: row.issuing_authority,
    status: row.status,
    urgency: row.urgency,
    dueDate: row.due_date ?? null,
    leadUnitId: row.lead_unit_id ?? null,
    rank: typeof row.rank === "number" ? row.rank : parseFloat(row.rank) || 0,
  }));
}

/**
 * Searches users using PostgreSQL exact lookup (email/phone/id) or FTS on name, email & title.
 */
export async function searchUsers(
  client: DbClient,
  params: SearchUsersParams
): Promise<UserSearchResultItem[]> {
  const query = (params.query || "").trim();
  if (!query) return [];

  let rows: any[] = [];
  try {
    const sql = buildUserSearchQuery(params);
    rows = await client.$queryRaw<any[]>(sql);
  } catch (primaryError) {
    try {
      const fallbackSql = buildUserFallbackSearchQuery(params);
      rows = await client.$queryRaw<any[]>(fallbackSql);
    } catch {
      throw primaryError;
    }
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    title: row.title ?? null,
    phone: row.phone ?? null,
    avatarUrl: row.avatar_url ?? null,
    leadUnitId: row.lead_unit_id ?? null,
    rank: typeof row.rank === "number" ? row.rank : parseFloat(row.rank) || 0,
  }));
}
