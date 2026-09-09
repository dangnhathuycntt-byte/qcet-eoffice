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
  departmentId?: string;
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
  departmentId: string | null;
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
  leadDepartmentId: string | null;
  rank?: number;
}

export interface SearchUsersParams {
  query: string;
  role?: string | UserRole;
  departmentId?: string;
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
  departmentId: string | null;
  rank?: number;
}

// ----------------------------------------------------------------------
// Heuristics & Code Detection
// ----------------------------------------------------------------------

const KNOWN_CODE_PREFIX_REGEX = /^(TASK|QCET|NV|VB|CV|TB|QD|HD|BC|KH|DA|TT)-/i;
const EXACT_CODE_PATTERN = /^[A-Za-z0-9\-_/.@]+$/;

/**
 * Determines whether a user query represents an exact identifier/code lookup
 * (e.g. "TASK-2026", "NV-001", "#128", "19/UBND", or single alphanumeric token without spaces).
 */
export function isExactCodeQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  // Prefixed with hash identifier
  if (trimmed.startsWith("#")) return true;

  // Common organizational institutional code prefixes
  if (KNOWN_CODE_PREFIX_REGEX.test(trimmed)) return true;

  // Single token without whitespace matching code/alphanumeric characters
  if (!/\s/.test(trimmed) && EXACT_CODE_PATTERN.test(trimmed)) {
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

  const conditions: Prisma.Sql[] = [Prisma.sql`"archived_at" IS NULL`];

  if (params.status) {
    const statusVal = params.status.toUpperCase();
    if (VALID_TASK_STATUSES.has(statusVal as TaskStatus)) {
      conditions.push(Prisma.sql`"status" = ${statusVal}::"TaskStatus"`);
    } else {
      conditions.push(Prisma.sql`"status"::text = ${params.status}`);
    }
  }

  if (params.departmentId) {
    conditions.push(Prisma.sql`"department_id" = ${params.departmentId}`);
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
        department_id, 1.0::float AS rank
      FROM "tasks"
      ${whereClause}
      ORDER BY
        CASE WHEN "code" = ${code} THEN 0 WHEN "code" ILIKE ${code + "%"} THEN 1 ELSE 2 END,
        "updated_at" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // Full-Text Search (to_tsvector) + pg_trgm similarity
  conditions.push(
    Prisma.sql`(
      to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')) @@ plainto_tsquery('simple', ${query})
      OR "title" ILIKE ${"%" + query + "%"}
      OR similarity("title", ${query}) > 0.15
    )`
  );

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      id, code, title, description, scope, status, priority,
      progress_percent, due_date, academic_month, academic_year,
      department_id,
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
    Prisma.sql`"archived_at" IS NULL`,
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
      conditions.push(Prisma.sql`"status"::text = ${params.status}`);
    }
  }

  if (params.departmentId) {
    conditions.push(Prisma.sql`"department_id" = ${params.departmentId}`);
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
      department_id, 0.5::float AS rank
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

export function buildDocumentSearchQuery(
  params: SearchDocumentsParams,
  forceExact?: boolean
): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);
  const isExact = forceExact ?? (params.exactCode ?? isExactCodeQuery(query));

  const conditions: Prisma.Sql[] = [Prisma.sql`"archived_at" IS NULL`];

  if (params.type) {
    const typeVal = params.type.toUpperCase();
    if (VALID_DOC_TYPES.has(typeVal as DocumentType)) {
      conditions.push(Prisma.sql`"type" = ${typeVal}::"DocumentType"`);
    } else {
      conditions.push(Prisma.sql`"type"::text = ${params.type}`);
    }
  }

  if (params.status) {
    const statusVal = params.status.toUpperCase();
    if (VALID_DOC_STATUSES.has(statusVal as DocumentStatus)) {
      conditions.push(Prisma.sql`"status" = ${statusVal}::"DocumentStatus"`);
    } else {
      conditions.push(Prisma.sql`"status"::text = ${params.status}`);
    }
  }

  if (isExact) {
    const code = cleanExactCode(query);
    const parsedNum = parseInt(code, 10);
    const isNum = !isNaN(parsedNum) && /^\d+$/.test(code);

    if (isNum) {
      conditions.push(
        Prisma.sql`("original_number" = ${code} OR "original_number" ILIKE ${code + "%"} OR "registration_number" = ${parsedNum} OR "id" = ${code})`
      );
    } else {
      conditions.push(
        Prisma.sql`("original_number" = ${code} OR "original_number" ILIKE ${code + "%"} OR "id" = ${code})`
      );
    }

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    return Prisma.sql`
      SELECT
        id, type, registration_number, document_year, original_number,
        summary, category, issuing_authority, status, urgency,
        due_date, lead_department_id, 1.0::float AS rank
      FROM "documents"
      ${whereClause}
      ORDER BY
        CASE WHEN "original_number" = ${code} THEN 0 WHEN "original_number" ILIKE ${code + "%"} THEN 1 ELSE 2 END,
        "updated_at" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // Full-Text Search on summary + pg_trgm similarity
  conditions.push(
    Prisma.sql`(
      to_tsvector('simple', coalesce("summary", '')) @@ plainto_tsquery('simple', ${query})
      OR "summary" ILIKE ${"%" + query + "%"}
      OR similarity("summary", ${query}) > 0.15
    )`
  );

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      id, type, registration_number, document_year, original_number,
      summary, category, issuing_authority, status, urgency,
      due_date, lead_department_id,
      (
        ts_rank(to_tsvector('simple', coalesce("summary", '')), plainto_tsquery('simple', ${query})) +
        coalesce(similarity("summary", ${query}), 0)
      )::float AS rank
    FROM "documents"
    ${whereClause}
    ORDER BY rank DESC, "updated_at" DESC
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
    Prisma.sql`"archived_at" IS NULL`,
    Prisma.sql`(
      "summary" ILIKE ${"%" + query + "%"}
      OR "original_number" ILIKE ${"%" + query + "%"}
      OR coalesce("issuing_authority", '') ILIKE ${"%" + query + "%"}
    )`,
  ];

  if (params.type) {
    const typeVal = params.type.toUpperCase();
    if (VALID_DOC_TYPES.has(typeVal as DocumentType)) {
      conditions.push(Prisma.sql`"type" = ${typeVal}::"DocumentType"`);
    } else {
      conditions.push(Prisma.sql`"type"::text = ${params.type}`);
    }
  }

  if (params.status) {
    const statusVal = params.status.toUpperCase();
    if (VALID_DOC_STATUSES.has(statusVal as DocumentStatus)) {
      conditions.push(Prisma.sql`"status" = ${statusVal}::"DocumentStatus"`);
    } else {
      conditions.push(Prisma.sql`"status"::text = ${params.status}`);
    }
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      id, type, registration_number, document_year, original_number,
      summary, category, issuing_authority, status, urgency,
      due_date, lead_department_id, 0.5::float AS rank
    FROM "documents"
    ${whereClause}
    ORDER BY "updated_at" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

// ----------------------------------------------------------------------
// User Query Builders
// ----------------------------------------------------------------------

const VALID_USER_ROLES = new Set(Object.values(UserRole));

export function buildUserSearchQuery(
  params: SearchUsersParams,
  forceExact?: boolean
): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);
  const isExact = forceExact ?? (params.exactCode ?? isExactCodeQuery(query));

  const conditions: Prisma.Sql[] = [
    Prisma.sql`"is_active" = true`,
    Prisma.sql`"deactivated_at" IS NULL`,
  ];

  if (params.role) {
    const roleVal = params.role.toUpperCase();
    if (VALID_USER_ROLES.has(roleVal as UserRole)) {
      conditions.push(Prisma.sql`"role" = ${roleVal}::"UserRole"`);
    } else {
      conditions.push(Prisma.sql`"role"::text = ${params.role}`);
    }
  }

  if (params.departmentId) {
    conditions.push(Prisma.sql`"department_id" = ${params.departmentId}`);
  }

  if (isExact) {
    const code = cleanExactCode(query);
    conditions.push(
      Prisma.sql`("email" = ${code} OR "email" ILIKE ${code + "%"} OR "phone" = ${code} OR "id" = ${code})`
    );

    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    return Prisma.sql`
      SELECT
        id, name, email, role, title, phone, avatar_url, department_id, 1.0::float AS rank
      FROM "users"
      ${whereClause}
      ORDER BY
        CASE WHEN "email" = ${code} THEN 0 WHEN "email" ILIKE ${code + "%"} THEN 1 ELSE 2 END,
        "name" ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  // Full-Text Search on name + email + title
  conditions.push(
    Prisma.sql`(
      to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("email", '') || ' ' || coalesce("title", '')) @@ plainto_tsquery('simple', ${query})
      OR "name" ILIKE ${"%" + query + "%"}
      OR "email" ILIKE ${"%" + query + "%"}
      OR similarity("name", ${query}) > 0.15
    )`
  );

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      id, name, email, role, title, phone, avatar_url, department_id,
      (
        ts_rank(to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("email", '')), plainto_tsquery('simple', ${query})) +
        coalesce(similarity("name", ${query}), 0)
      )::float AS rank
    FROM "users"
    ${whereClause}
    ORDER BY rank DESC, "name" ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export function buildUserFallbackSearchQuery(params: SearchUsersParams): Prisma.Sql {
  const query = (params.query || "").trim();
  const limit = Math.max(1, Math.min(100, params.limit ?? 20));
  const offset = Math.max(0, params.offset ?? 0);

  const conditions: Prisma.Sql[] = [
    Prisma.sql`"is_active" = true`,
    Prisma.sql`"deactivated_at" IS NULL`,
    Prisma.sql`(
      "name" ILIKE ${"%" + query + "%"}
      OR "email" ILIKE ${"%" + query + "%"}
      OR coalesce("title", '') ILIKE ${"%" + query + "%"}
    )`,
  ];

  if (params.role) {
    const roleVal = params.role.toUpperCase();
    if (VALID_USER_ROLES.has(roleVal as UserRole)) {
      conditions.push(Prisma.sql`"role" = ${roleVal}::"UserRole"`);
    } else {
      conditions.push(Prisma.sql`"role"::text = ${params.role}`);
    }
  }

  if (params.departmentId) {
    conditions.push(Prisma.sql`"department_id" = ${params.departmentId}`);
  }

  const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  return Prisma.sql`
    SELECT
      id, name, email, role, title, phone, avatar_url, department_id, 0.5::float AS rank
    FROM "users"
    ${whereClause}
    ORDER BY "name" ASC
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
    departmentId: row.department_id ?? null,
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
    leadDepartmentId: row.lead_department_id ?? null,
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
    departmentId: row.department_id ?? null,
    rank: typeof row.rank === "number" ? row.rank : parseFloat(row.rank) || 0,
  }));
}
