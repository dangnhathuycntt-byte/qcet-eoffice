/**
 * Trang/khung đang tải hiện khung giữ chỗ (`Skeleton` trong khối `aria-busy`), không phải một dòng chữ "Đang tải…" trần
 * (người dùng báo trang Yêu cầu phối hợp có chữ "Đang tải…" nằm chênh vênh 22/10/2026). Chữ trên nút "Tải thêm" không tính.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_DIR = join(import.meta.dirname, "../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("không có đoạn văn chỉ gồm chữ Đang tải… làm trạng thái đang tải", () => {
  const offenders = sourceFiles(SRC_DIR).flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((line, index) => (/<p\b[^>]*>\s*Đang tải(…|\.\.\.)?\s*<\/p>/.test(line) ? [`${relative(SRC_DIR, file)}:${index + 1}`] : []))
  );
  assert.deepEqual(offenders, []);
});
