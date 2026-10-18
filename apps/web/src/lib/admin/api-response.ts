type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function readTotal(body: JsonObject, fallback: number): number {
  const pagination = asObject(body.pagination);
  const total = pagination.total;
  return typeof total === "number" && Number.isFinite(total) && total >= 0
    ? total
    : fallback;
}

export function readAuditLogResponse<T>(body: unknown): {
  entries: T[];
  total: number;
} {
  const response = asObject(body);
  const entries = Array.isArray(response.data) ? (response.data as T[]) : [];
  return { entries, total: readTotal(response, 0) };
}

export function readUserDirectoryResponse<T>(body: unknown): {
  users: T[];
  total: number;
} {
  const response = asObject(body);
  const users = Array.isArray(response.users) ? (response.users as T[]) : [];
  return { users, total: readTotal(response, users.length) };
}
