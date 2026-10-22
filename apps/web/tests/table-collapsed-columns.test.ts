import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TASK_COLUMN_CLASS, TASK_COL_WIDTH_CLASS } from "../src/components/tasks/table/constants";

/**
 * Bảng `table-fixed` bớt cột theo container query (bảng Nhiệm vụ, danh bạ /org): cột bớt đi giữ chỗ trong lưới, `<col>` thu
 * về `w-0` và ô `cell-collapse`, không `display:none`. `<col>` ẩn thì hàng nhóm `colSpan` vẫn giữ cột đó và bảng chia đều phần
 * còn lại với cột tên (22/10/2026: Tiêu đề 371px → 124px ở 1000px, tên /org 358px → 119px ở 390px); ô ẩn thì rút khỏi lưới,
 * ô sau dồn sang chỗ cột đã thu về 0.
 */
describe("cột thu gọn của bảng có hàng colSpan", () => {
  const widthOf = (cls: string) => cls.match(/(?:^|\s)(w-\[\d+px\])/)?.[1] ?? null;
  const breakpointOf = (cls: string) => cls.match(/@max-\[(\d+)px\]:/)?.[1] ?? null;

  test("<col> của bảng Nhiệm vụ cùng bề rộng, cùng mốc với ô và thu về 0 thay vì ẩn", () => {
    assert.deepEqual(Object.keys(TASK_COL_WIDTH_CLASS), Object.keys(TASK_COLUMN_CLASS));
    for (const key of Object.keys(TASK_COLUMN_CLASS) as (keyof typeof TASK_COLUMN_CLASS)[]) {
      const cell = TASK_COLUMN_CLASS[key];
      const col = TASK_COL_WIDTH_CLASS[key];
      assert.ok(!col.includes("hidden"), `${key}: <col> không được ẩn`);
      assert.ok(!cell.includes(":hidden"), `${key}: ô dùng cell-collapse, không hidden`);
      if (key === "title") continue;
      assert.equal(widthOf(col), widthOf(cell), `${key}: bề rộng`);
      assert.equal(breakpointOf(col), breakpointOf(cell), `${key}: mốc thu gọn`);
      if (breakpointOf(cell)) assert.match(col, new RegExp(`@max-\\[${breakpointOf(cell)}px\\]:w-0`), `${key}: thu về 0`);
    }
  });

  test("bảng có <colgroup> trong web không ẩn <col> hay ô bằng display:none", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith(".tsx")) files.push(path);
      }
    };
    walk(join(import.meta.dirname, "../src"));
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<col\b[^>]*className=\{?["'`]?([^}>]*)/g)) {
        const expr = match[1];
        // Lớp chữ trực tiếp có "hidden", hoặc dùng hằng lớp của ô (`*_COLUMN_CLASS`, `*_CELL_CLASS`) vốn có `:hidden`
        if (/\bhidden\b/.test(expr) || /\b\w+_(?:COLUMN|CELL)_CLASS\b/.test(expr)) offenders.push(`${file.split("/src/")[1]}: ${match[0]}`);
      }
      if (source.includes("<colgroup>")) {
        for (const match of source.matchAll(/@max-\[\d+px\]:hidden/g)) offenders.push(`${file.split("/src/")[1]}: ${match[0]}`);
      }
    }
    assert.deepEqual(offenders, []);
  });
});
