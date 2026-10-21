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

// API chạy dev bằng webpack: Next 15.5 + Turbopack không ghi `route/react-loadable-manifest.json` cho route handler mà vẫn đọc
// thử 3 lần cách 100ms, nên mọi request API ở dev chậm thêm ~200ms (đo 22/10/2026: 250–280ms so với 24–54ms bằng webpack,
// bộ nhớ ngang nhau). Next 16 đã sửa (vercel/next.js#82739, #82903): lên Next 16 thì trả API về `--turbopack`. Chỉ ảnh hưởng dev,
// `next start` đọc manifest một lần.
const children = [
  ["qcet-api", "apps/api", apiPort, ["dev"]],
  ["qcet-web", "apps/web", webPort, ["dev", "--turbopack"]],
].map(([service, dir, port, devMode]) => {
  const mode = start ? ["start"] : devMode;
  const child = spawn("npx", ["next", ...mode, dir, "-p", port], { stdio: "inherit", env: { ...env, SERVICE_NAME: service } });
  child.on("exit", (code) => {
    for (const other of children) if (other !== child && other.exitCode === null) other.kill("SIGTERM");
    process.exitCode = code ?? 0;
  });
  return child;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => children.forEach((c) => c.kill(signal)));
