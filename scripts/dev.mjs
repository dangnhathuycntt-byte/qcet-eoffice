// Chạy hai app từ gốc repo (cwd gốc giữ nguyên đường dẫn ./uploads, storage/ như trước khi tách):
// API ở cổng API_PORT (mặc định 3100), web ở cổng `-p`/PORT (mặc định 3000), web gọi API qua API_INTERNAL_URL.
//   npm run dev               next dev cả hai
//   npm run dev -- -p 3001    đổi cổng web
//   npm start                 next start cả hai (sau npm run build)
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const portIdx = args.findIndex((a) => a === "-p" || a === "--port");
const webPort = portIdx >= 0 ? args[portIdx + 1] : process.env.PORT || "3000";
const apiPort = process.env.API_PORT || "3100";
const start = args.includes("--start");
const env = { ...process.env, API_PORT: apiPort, API_INTERNAL_URL: process.env.API_INTERNAL_URL || `http://127.0.0.1:${apiPort}` };

// Giới hạn heap cho server dev. Next dev tự đặt giới hạn bằng 50% RAM (8GB trên máy 16GB) và chỉ tự khởi động lại server khi
// heap dùng quá 80% giới hạn đó (6,4GB). Đo 22/10/2026: heap server api dev tăng 0,27 → 4,3GB sau 8 giờ sửa code, phần lớn bị đẩy
// ra swap nên mỗi lần GC làm request chậm 5–8 giây. Giới hạn 3GB thì GC dọn sớm hơn, heap chạm ~2,4GB Next tự khởi động lại server
// (lần đầu mở mỗi route sau đó mất vài giây biên dịch lại) thay vì phình vào swap. NODE_OPTIONS có sẵn giới hạn thì giữ nguyên.
const DEV_MAX_HEAP_MB = 3072;
const devNodeOptions = /--max[-_]old[-_]space[-_]size/.test(process.env.NODE_OPTIONS ?? "")
  ? process.env.NODE_OPTIONS
  : [process.env.NODE_OPTIONS, `--max-old-space-size=${DEV_MAX_HEAP_MB}`].filter(Boolean).join(" ");

// Next 16: `next dev` dùng Turbopack mặc định cho cả hai app (API từng chạy webpack ở Next 15.5 vì Turbopack đọc thử manifest
// của route handler 3 lần, đã sửa ở vercel/next.js#82739, #82903).
const children = [
  ["qcet-api", "apps/api", apiPort],
  ["qcet-web", "apps/web", webPort],
].map(([service, dir, port]) => {
  const mode = start ? ["start"] : ["dev"];
  const childEnv = { ...env, SERVICE_NAME: service, ...(start ? {} : { NODE_OPTIONS: devNodeOptions }) };
  const child = spawn("npx", ["next", ...mode, dir, "-p", port], { stdio: "inherit", env: childEnv });
  child.on("exit", (code) => {
    for (const other of children) if (other !== child && other.exitCode === null) other.kill("SIGTERM");
    process.exitCode = code ?? 0;
  });
  return child;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => children.forEach((c) => c.kill(signal)));
