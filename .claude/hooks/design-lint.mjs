#!/usr/bin/env node
// PostToolUse hook: chạy design lint trên file agent vừa sửa. Vi phạm mới (không có
// trong baseline) trả về exit 2 để agent nhận phản hồi và sửa ngay trong lượt đó.
import { spawnSync } from "node:child_process";
import path from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const filePath = JSON.parse(raw || "{}")?.tool_input?.file_path;
if (!filePath) process.exit(0);

const rel = path.relative(projectDir, path.resolve(projectDir, filePath));
if (!rel.startsWith("src/") || !/\.(ts|tsx)$/.test(rel)) process.exit(0);

const result = spawnSync(process.execPath, ["scripts/lint.mjs", "--files", rel], {
  cwd: projectDir,
  encoding: "utf8",
});
if (result.status === 0) process.exit(0);

// Bỏ mã màu ANSI để phản hồi đọc được trong transcript.
const output = `${result.stdout}\n${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
const findings = output
  .split("\n")
  .filter((line) => /^\[(DESIGN|LINT ERROR)\]|^\s+> /.test(line))
  .join("\n");
process.stderr.write(
  `Design lint: ${rel} có vi phạm mới. Dùng component trong src/components/ui/ và token (bảng "Cần gì, dùng gì" trong AGENTS.md); vùng bấm tùy biến dùng Pressable.\n${findings}\n`
);
process.exit(2);
