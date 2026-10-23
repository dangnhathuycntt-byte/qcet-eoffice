import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERSONAL_NOTE_COLORS } from "@qcet/contracts/personal-notes";
import { NOTE_COLOR_LABELS } from "../src/components/notes/note-color-picker";

/**
 * Màu nền ghi chú (23/10/2026): khóa màu ở hợp đồng, nhãn ở ô chọn và token + quy tắc `data-note-color` ở `globals.css` phải
 * đi cùng nhau. Thêm khóa mà quên CSS thì thẻ hiện nền trắng như không có màu, nên kiểm bằng máy.
 */
describe("màu nền ghi chú", () => {
  const css = readFileSync(join(import.meta.dirname, "../src/app/globals.css"), "utf8");

  test("mỗi khóa màu có nhãn tiếng Việt, token --note-* và quy tắc nền", () => {
    assert.deepEqual(Object.keys(NOTE_COLOR_LABELS).sort(), [...PERSONAL_NOTE_COLORS].sort(), "nhãn đủ và không thừa");
    for (const color of PERSONAL_NOTE_COLORS) {
      assert.ok(NOTE_COLOR_LABELS[color].trim(), `${color}: nhãn`);
      assert.match(css, new RegExp(`--note-${color}:\\s*#[0-9A-Fa-f]{6}`), `${color}: token --note-${color}`);
      assert.ok(css.includes(`[data-note-color="${color}"] { --note-bg: var(--note-${color}); }`), `${color}: quy tắc nền`);
    }
  });

  test("chữ phụ trên thẻ có màu sẫm lại và đạt ≥ 4,5:1 trên mọi màu nền", () => {
    const hex = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? assert.fail(`thiếu --${name}`);
    const luminance = (value: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const muted = hex("note-muted");
    for (const color of PERSONAL_NOTE_COLORS) {
      const ratio = contrast(hex(`note-${color}`), muted);
      assert.ok(ratio >= 4.5, `${color}: chữ phụ ${muted} chỉ đạt ${ratio.toFixed(2)}:1`);
    }
    assert.ok(css.includes("--muted-foreground: var(--note-muted);") && css.includes("--gray-8: var(--note-muted);"), "ghi đè chữ phụ và placeholder trong [data-note-color]");
  });
});
