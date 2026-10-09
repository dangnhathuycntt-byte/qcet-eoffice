// Gắn `/* @kind other */` sau các biến token không thuộc nhóm màu/cỡ chữ/bo góc/đổ bóng/khoảng cách,
// để Claude Design phân loại đúng. Chạy sau Tailwind CLI, idempotent.
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2] ?? ".design-sync/styles.css";
const PREFIXES = [
  "--ease-",
  "--animate-",
  "--aspect-video",
  "--default-transition-",
  "--tw-translate-",
  "--tw-rotate-",
  "--tw-scale-",
  "--tw-skew-",
  "--tw-space-",
  "--tw-divide-",
  "--table-",
];
const KIND = "/* @kind other */";

const css = readFileSync(file, "utf8");
let count = 0;
const out = css
  .split("\n")
  .map((line) => {
    const m = /^(\s*)(--[a-z0-9-]+)\s*:\s*[^;]*;(.*)$/.exec(line);
    if (!m) return line;
    if (!PREFIXES.some((p) => m[2].startsWith(p))) return line;
    if (m[3].includes("@kind")) return line;
    count++;
    return `${line.trimEnd()} ${KIND}`;
  })
  .join("\n");
writeFileSync(file, out);
console.log(`annotate-kinds: ${count} declaration(s) annotated in ${file}`);
