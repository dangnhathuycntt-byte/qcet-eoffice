/**
 * Layout gốc đặt `title.template` = "%s | QCET E-Office", nên tiêu đề trang chỉ ghi tên trang. Ghi thêm tên ứng dụng thì tab
 * hiện lặp, ví dụ "Trợ lý | QCET E-Office | QCET E-Office" (gặp ở 8 trang, sửa 22/10/2026).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const APP_DIR = join(import.meta.dirname, "../src/app");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [path] : [];
  });
}

test("tiêu đề trang không tự ghi tên ứng dụng (layout gốc đã thêm qua title.template)", () => {
  const rootLayout = readFileSync(join(APP_DIR, "layout.tsx"), "utf8");
  assert.match(rootLayout, /template: `%s \| \$\{INSTITUTION_CONFIG\.shortName\} E-Office`/);

  const offenders = sourceFiles(APP_DIR)
    .filter((file) => relative(APP_DIR, file) !== "layout.tsx")
    .flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\btitle:\s*["'`]([^"'`]*E-Office[^"'`]*)["'`]/g)].map(
        (match) => `${relative(APP_DIR, file)}: ${match[1]}`
      )
    );
  assert.deepEqual(offenders, []);
});
