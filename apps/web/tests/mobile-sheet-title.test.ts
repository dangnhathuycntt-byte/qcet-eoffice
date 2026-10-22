/**
 * Menu/popover có `mobileSheet sheetTitle="X"` hiện X ở đầu sheet trên điện thoại. Tiêu đề X đặt thêm bên trong (MenuSubmenuTitle,
 * PopoverTitle) phải ẩn ở khổ đó (`max-md:hidden`, `sr-only`, `max-md:sr-only`), kẻo sheet hiện X hai lần (menu Kích thước trang,
 * gặp 22/10/2026).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC_DIR = join(import.meta.dirname, "../src");
const HIDDEN_ON_MOBILE = /\b(max-md:hidden|sr-only|max-md:sr-only)\b/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

test("tiêu đề bên trong sheet điện thoại không lặp sheetTitle", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC_DIR)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      const title = /sheetTitle="([^"]+)"/.exec(line)?.[1];
      if (!title) return;
      // Nội dung của chính popup đó: các dòng sau cho tới thẻ đóng MenuContent/PopoverContent
      for (const inner of lines.slice(index + 1, index + 40)) {
        if (/<\/(MenuContent|PopoverContent)>/.test(inner)) break;
        const titleTag = new RegExp(`<(MenuSubmenuTitle|PopoverTitle)\\b([^>]*)>\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<`).exec(inner);
        if (titleTag && !HIDDEN_ON_MOBILE.test(titleTag[2])) offenders.push(`${relative(SRC_DIR, file)}:${index + 1} "${title}"`);
      }
    });
  }
  assert.deepEqual(offenders, []);
});
