/**
 * Hộp xác nhận dùng chung (ConfirmHost / DestructiveConfirmDialog): nút hủy luôn là "Hủy",
 * không còn hộp xác nhận gốc của trình duyệt (window.confirm).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test("không file nào dùng window.confirm hoặc đặt lại nhãn nút hủy của hộp xác nhận", () => {
  for (const file of sourceFiles("src")) {
    const text = readFileSync(file, "utf8");
    assert.ok(!/window\.confirm\(/.test(text), `${file} còn dùng window.confirm`);
    assert.ok(!/\bcancelLabel\b/.test(text), `${file} còn truyền cancelLabel`);
  }
});
