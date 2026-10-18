/**
 * Ranh giới FE/BE trong một repo (chuẩn bị tách apps/web và apps/api).
 * Dùng chung cho scripts/lint.mjs và tests/architecture-fitness.test.ts.
 *
 * Import được đọc từ AST (`ts.createSourceFile`): import, import type, export…from
 * (kể cả `export * as`), import x = require(), import(), require() và kiểu
 * `import("…")`; comment và chuỗi thường không tính. Đường dẫn tương đối được quy
 * về dạng `@/…` trước khi so luật.
 */

import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const DB_MODULE = /^(?:@prisma\/client(?:\/|$)|@qcet\/db(?:\/|$)|@\/lib\/prisma$|@\/lib\/db(?:\/|$))/;
const SERVER_MODULE = /^@\/server(?:\/|$)/;
const UI_OR_APP_MODULE = /^@\/(?:components|app)(?:\/|$)/;
/**
 * Dấu hiệu file chỉ chạy ở server: DB, bí mật server (`@/config/env.server`), mọi module Node có
 * tiền tố `node:`, thư viện server và mọi import vào src/server. Built-in không tiền tố (`crypto`)
 * không tính: file isomorphic có fallback (digital-signature-service) vẫn nằm trong src/lib.
 */
const SERVER_ONLY_MODULE =
  /^(?:@prisma\/client(?:\/|$)|@qcet\/db(?:\/|$)|@\/lib\/prisma$|@\/lib\/db(?:\/|$)|@\/config\/env\.server$|ioredis$|web-push$|jsonwebtoken$|bcryptjs$|node:[a-z0-9_]+(?:\/|$)|@\/server(?:\/|$))/;

const APP_LAYER = /^src\/app\//;
const UI_LAYER = /^src\/(?:components|hooks)\//;
const CORE_LAYER = /^src\/(?:lib|domain|server)\//;
/** Package dùng chung: mã nguồn trong packages/<tên>/src và script của package (vd. packages/db/prisma). */
const PACKAGE_FILE = /^packages\/[^/]+\//;
/** @qcet/shared và @qcet/contracts chạy cả ở trình duyệt: không DB, không module Node, không bí mật server. */
const PURE_PACKAGE_FILE = /^packages\/(?:shared|contracts)\//;

/** File server-only còn được nằm trong src/lib. Gỡ ở bước 3. */
export const SERVER_ONLY_LIB_ALLOWLIST = [
  "src/lib/jwt-session.ts", // gỡ ở bước 3
];

/** Chuỗi module của một node import/export/require, nếu có. */
function moduleSpecifierNode(node) {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
    return node.moduleSpecifier;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return node.moduleReference.expression;
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    const isImportCall = callee.kind === ts.SyntaxKind.ImportKeyword;
    const isRequire = ts.isIdentifier(callee) && callee.text === "require";
    if (isImportCall || isRequire) return node.arguments[0];
  }
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
    return node.argument.literal;
  }
  return undefined;
}

/** Module specifier của mọi import trong file, kèm số dòng; tương đối → `@/…`. */
export function importSpecifiers(relPath, content) {
  const kind = relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, false, kind);
  const out = [];
  const visit = (node) => {
    const specNode = moduleSpecifierNode(node);
    if (specNode && ts.isStringLiteralLike(specNode)) {
      let spec = specNode.text;
      if (spec.startsWith(".")) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(relPath), spec));
        if (target.startsWith("src/")) spec = `@/${target.slice(4)}`;
        else if (target.startsWith("apps/")) spec = target;
      }
      const line = sourceFile.getLineAndCharacterOfPosition(specNode.getStart(sourceFile)).line + 1;
      out.push({ spec, line });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

/** Vi phạm ranh giới của một file (`relPath` dạng `src/…` với dấu `/`). */
export function boundaryViolations(relPath, content) {
  if (PACKAGE_FILE.test(relPath) && /\.tsx?$/.test(relPath)) return packageViolations(relPath, content);
  if (!/^src\/.+\.tsx?$/.test(relPath)) return [];
  const isApp = APP_LAYER.test(relPath);
  const isUi = UI_LAYER.test(relPath);
  const isCore = CORE_LAYER.test(relPath);
  const checkServerOnly = relPath.startsWith("src/lib/") && !SERVER_ONLY_LIB_ALLOWLIST.includes(relPath);
  const out = [];
  for (const { spec, line } of importSpecifiers(relPath, content)) {
    if (isApp && DB_MODULE.test(spec)) {
      out.push({ rule: "app-no-db", line, spec, message: `File trong src/app không import '${spec}'. Đọc/ghi DB qua service trong src/server.` });
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

/** Vi phạm của file trong packages/: không import app (alias @/ hoặc đường dẫn ra apps/, src/); shared/contracts phải thuần. */
function packageViolations(relPath, content) {
  const out = [];
  const pure = PURE_PACKAGE_FILE.test(relPath);
  for (const { spec, line } of importSpecifiers(relPath, content)) {
    if (/^@\//.test(spec) || /^apps\//.test(spec)) {
      out.push({ rule: "package-no-app", line, spec, message: `Package không import code của app ('${spec}'). Đưa phần dùng chung vào package.` });
    }
    if (pure && SERVER_ONLY_MODULE.test(spec)) {
      out.push({ rule: "package-pure", line, spec, message: `@qcet/shared và @qcet/contracts chạy cả ở trình duyệt, không import '${spec}'. Phần server đặt trong @qcet/db hoặc app api.` });
    }
  }
  return out;
}
