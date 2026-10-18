/**
 * Ranh giới FE/BE trong một repo (chuẩn bị tách apps/web và apps/api).
 * Dùng chung cho scripts/lint.mjs và tests/architecture-fitness.test.ts.
 *
 * Import được đọc bằng `ts.preProcessFile`: gồm import, import type, export…from,
 * import() và require(); bỏ qua comment và chuỗi. Đường dẫn tương đối được quy
 * về dạng `@/…` trước khi so luật.
 */

import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const DB_MODULE = /^(?:@prisma\/client(?:\/|$)|@\/lib\/prisma$|@\/lib\/db(?:\/|$))/;
const SERVER_MODULE = /^@\/server(?:\/|$)/;
const UI_OR_APP_MODULE = /^@\/(?:components|app)(?:\/|$)/;
/** Dấu hiệu file chỉ chạy ở server: DB, thư viện Node/bí mật, và mọi import vào src/server. */
const SERVER_ONLY_MODULE =
  /^(?:@prisma\/client(?:\/|$)|@\/lib\/prisma$|@\/lib\/db(?:\/|$)|ioredis$|web-push$|jsonwebtoken$|bcryptjs$|node:(?:fs|crypto|path|child_process)(?:\/|$)|@\/server(?:\/|$))/;

const ROUTE_PAGE_LAYOUT = /^src\/app\/(?:api\/.+\/route|(?:.+\/)?(?:page|layout))\.tsx?$/;
const UI_LAYER = /^src\/(?:components|hooks)\//;
const CORE_LAYER = /^src\/(?:lib|domain|server)\//;

/** File server-only còn được nằm trong src/lib. Gỡ ở bước 3. */
export const SERVER_ONLY_LIB_ALLOWLIST = [
  "src/lib/prisma.ts", // gỡ ở bước 3
  "src/lib/jwt-session.ts", // gỡ ở bước 3
  "src/lib/db/audit.ts", // gỡ ở bước 3
  "src/lib/db/outbox.ts", // gỡ ở bước 3
];

/** Module specifier của mọi import trong file, kèm số dòng; tương đối → `@/…`. */
export function importSpecifiers(relPath, content) {
  const { importedFiles } = ts.preProcessFile(content, true, true);
  return importedFiles.map(({ fileName, pos }) => {
    let spec = fileName;
    if (spec.startsWith(".")) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(relPath), spec));
      if (target.startsWith("src/")) spec = `@/${target.slice(4)}`;
    }
    return { spec, line: content.slice(0, pos).split("\n").length };
  });
}

/** Vi phạm ranh giới của một file (`relPath` dạng `src/…` với dấu `/`). */
export function boundaryViolations(relPath, content) {
  if (!/^src\/.+\.tsx?$/.test(relPath)) return [];
  const isRoutePageLayout = ROUTE_PAGE_LAYOUT.test(relPath);
  const isUi = UI_LAYER.test(relPath);
  const isCore = CORE_LAYER.test(relPath);
  const checkServerOnly = relPath.startsWith("src/lib/") && !SERVER_ONLY_LIB_ALLOWLIST.includes(relPath);
  const out = [];
  for (const { spec, line } of importSpecifiers(relPath, content)) {
    if (isRoutePageLayout && DB_MODULE.test(spec)) {
      out.push({ rule: "app-no-db", line, spec, message: `Route/page/layout không import '${spec}'. Đọc/ghi DB qua service trong src/server.` });
    }
    if (isUi && SERVER_MODULE.test(spec)) {
      out.push({ rule: "ui-no-server", line, spec, message: `Component/hook không import '${spec}'. Lấy dữ liệu qua API; kiểu dùng chung đặt ở src/contracts.` });
    }
    if (isCore && UI_OR_APP_MODULE.test(spec)) {
      out.push({ rule: "core-no-ui", line, spec, message: `lib/domain/server không import '${spec}'. Đưa phần dùng chung xuống src/lib hoặc src/domain.` });
    }
    if (checkServerOnly && SERVER_ONLY_MODULE.test(spec)) {
      out.push({ rule: "server-only-in-lib", line, spec, message: `File server-only (import '${spec}') không nằm trong src/lib. Chuyển vào src/server/<domain>.` });
    }
  }
  return out;
}
