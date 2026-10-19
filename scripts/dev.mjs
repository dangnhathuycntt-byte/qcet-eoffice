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
const mode = args.includes("--start") ? ["start"] : ["dev", "--turbopack"];
const env = { ...process.env, API_PORT: apiPort, API_INTERNAL_URL: process.env.API_INTERNAL_URL || `http://127.0.0.1:${apiPort}` };

const children = [
  ["qcet-api", "apps/api", apiPort],
  ["qcet-web", "apps/web", webPort],
].map(([service, dir, port]) => {
  const child = spawn("npx", ["next", ...mode, dir, "-p", port], { stdio: "inherit", env: { ...env, SERVICE_NAME: service } });
  child.on("exit", (code) => {
    for (const other of children) if (other !== child && other.exitCode === null) other.kill("SIGTERM");
    process.exitCode = code ?? 0;
  });
  return child;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => children.forEach((c) => c.kill(signal)));
