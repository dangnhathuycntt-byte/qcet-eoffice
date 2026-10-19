/**
 * Ranh giới giữa apps/web, apps/api và packages/*.
 * Dùng chung cho scripts/lint.mjs và tests/architecture-fitness.test.ts.
 *
 * Import được đọc từ AST (`ts.createSourceFile`): import, import type, export…from
 * (kể cả `export * as`), import x = require(), import(), require() và kiểu
 * `import("…")`; comment và chuỗi thường không tính. Đường dẫn tương đối trong cùng app
 * được quy về `@/…`; ra ngoài app thì về dạng `apps/…` hoặc đường dẫn gốc repo.
 */

import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const DB_MODULE = /^(?:@prisma\/client(?:\/|$)|@qcet\/db(?:\/|$)|@\/lib\/prisma$|@\/lib\/db(?:\/|$))/;
const UI_OR_APP_MODULE = /^@\/(?:components|app)(?:\/|$)/;
/**
 * Dấu hiệu module chỉ chạy ở server: DB, bí mật server (`@/config/env.server`), mọi module Node có
 * tiền tố `node:`, thư viện server và mọi import vào src/server. Built-in không tiền tố (`crypto`)
 * không tính: file isomorphic có fallback vẫn được dùng ở web.
 */
const SERVER_ONLY_MODULE =
  /^(?:@prisma\/client(?:\/|$)|@qcet\/db(?:\/|$)|@\/lib\/prisma$|@\/lib\/db(?:\/|$)|@\/config\/env\.server$|ioredis$|web-push$|jsonwebtoken$|bcryptjs$|node:[a-z0-9_]+(?:\/|$)|@\/server(?:\/|$))/;

/** Web: giao diện, không chạm DB/Redis/bí mật/mã server; dữ liệu qua API. */
const WEB_FILE = /^apps\/web\/src\//;
/** Route handler của API: đọc/ghi DB qua dịch vụ trong src/server. */
const API_ROUTE_FILE = /^apps\/api\/src\/app\//;
const API_CORE_FILE = /^apps\/api\/src\/(?:lib|domain|server)\//;
const APP_FILE = /^apps\/([^/]+)\//;
/** Package dùng chung: mã nguồn trong packages/<tên>/src và script của package (vd. packages/db/prisma). */
const PACKAGE_FILE = /^packages\/[^/]+\//;
/** @qcet/shared và @qcet/contracts chạy cả ở trình duyệt: không DB, không module Node, không bí mật server. */
const PURE_PACKAGE_FILE = /^packages\/(?:shared|contracts)\//;

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
        const ownApp = relPath.match(APP_FILE)?.[1];
        const inApp = target.match(/^apps\/([^/]+)\/src\/(.*)$/);
        if (inApp && inApp[1] === ownApp) spec = `@/${inApp[2]}`;
        else if (target.startsWith("apps/") || target.startsWith("src/")) spec = target;
      }
      const line = sourceFile.getLineAndCharacterOfPosition(specNode.getStart(sourceFile)).line + 1;
      out.push({ spec, line });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

/** Vi phạm ranh giới của một file (`relPath` tính từ gốc repo, dấu `/`). */
export function boundaryViolations(relPath, content) {
  if (!/\.tsx?$/.test(relPath)) return [];
  if (PACKAGE_FILE.test(relPath)) return packageViolations(relPath, content);
  const ownApp = relPath.match(APP_FILE)?.[1];
  if (!ownApp || !/^apps\/[^/]+\/src\//.test(relPath)) return [];
  const isWeb = WEB_FILE.test(relPath);
  const isApiRoute = API_ROUTE_FILE.test(relPath);
  const isApiCore = API_CORE_FILE.test(relPath);
  const out = [];
  for (const { spec, line } of importSpecifiers(relPath, content)) {
    if (/^apps\//.test(spec) && !spec.startsWith(`apps/${ownApp}/`)) {
      out.push({ rule: "no-cross-app", line, spec, message: `App không import code của app khác ('${spec}'). Phần dùng chung đặt ở packages/; dữ liệu đi qua HTTP.` });
    }
    if (isWeb && SERVER_ONLY_MODULE.test(spec)) {
      out.push({ rule: "web-no-server", line, spec, message: `Web không import '${spec}' (DB, bí mật, module Node, mã server). Lấy dữ liệu qua API; kiểu dùng chung đặt ở @qcet/contracts.` });
    }
    if (isApiRoute && DB_MODULE.test(spec)) {
      out.push({ rule: "app-no-db", line, spec, message: `Route handler không import '${spec}'. Đọc/ghi DB qua dịch vụ trong src/server.` });
    }
    if (isApiCore && UI_OR_APP_MODULE.test(spec)) {
      out.push({ rule: "core-no-ui", line, spec, message: `lib/domain/server của API không import '${spec}'.` });
    }
  }
  return out;
}

/** Vi phạm của file trong packages/: không import app (alias @/ hoặc đường dẫn ra apps/); shared/contracts phải thuần. */
function packageViolations(relPath, content) {
  const out = [];
  const pure = PURE_PACKAGE_FILE.test(relPath);
  for (const { spec, line } of importSpecifiers(relPath, content)) {
    if (/^@\//.test(spec) || /^(?:apps|src)\//.test(spec)) {
      out.push({ rule: "package-no-app", line, spec, message: `Package không import code của app ('${spec}'). Đưa phần dùng chung vào package.` });
    }
    if (pure && SERVER_ONLY_MODULE.test(spec)) {
      out.push({ rule: "package-pure", line, spec, message: `@qcet/shared và @qcet/contracts chạy cả ở trình duyệt, không import '${spec}'. Phần server đặt trong @qcet/db hoặc app api.` });
    }
  }
  return out;
}
