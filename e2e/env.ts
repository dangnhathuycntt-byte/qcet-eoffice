import path from "node:path";

// Môi trường E2E dùng chung cho server (webServer) và global setup. Chỉ cho phép DB tách biệt.
export const E2E_PORT = Number(process.env.E2E_PORT || 3101);
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_TMP = path.resolve(__dirname, ".tmp");
export const E2E_UPLOADS = path.join(E2E_TMP, "uploads");
export const E2E_AUTH_FILE = path.resolve(__dirname, "../playwright/.auth/user.json");
export const E2E_AUTH_SECRET = "qcet_e2e_secret_key_not_for_production_0123456789";

const ALLOWED_DB = /\/qcet_(test|ci)(\?.*)?$/;

/** URL DB cho E2E: ưu tiên E2E_DATABASE_URL; nếu không thì suy từ DATABASE_URL sang qcet_test. Từ chối mọi DB khác. */
export function resolveE2eDatabaseUrl(): string {
  const raw = process.env.E2E_DATABASE_URL || (process.env.DATABASE_URL || "").replace(/\/qcet_(?:eoffice|ci)(\?.*)?$/, "/qcet_test$1");
  if (!raw || !ALLOWED_DB.test(raw)) {
    throw new Error("E2E chỉ chạy trên DB qcet_test hoặc qcet_ci; đặt E2E_DATABASE_URL trỏ tới DB kiểm thử.");
  }
  return raw;
}
