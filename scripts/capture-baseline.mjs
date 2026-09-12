import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = "http://localhost:3000";
const OUT_DIR = path.resolve("artifacts/ux-reconstruction/baseline");

const targets = [
  { name: "dashboard", path: "/" },
  { name: "tasks-kanban", path: "/tasks?view=kanban" },
  { name: "tasks-table", path: "/tasks?view=table" },
  { name: "calendar", path: "/calendar" },
  { name: "notifications", path: "/notifications" },
];

const viewports = [
  { suffix: "desktop", width: 1440, height: 900 },
  { suffix: "mobile", width: 390, height: 844 },
];

async function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('close', (code) => {
      resolve(code);
    });
  });
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Record baseline SHA
  const gitSha = "5abd205e91d327b331808bae44cf6a5727b1eefe";
  fs.writeFileSync(path.join(OUT_DIR, "baseline-sha.txt"), gitSha);

  console.log("Starting server for capture...");
  const server = spawn("node", [".next/standalone/server.js"], {
    env: { ...process.env, PORT: "3000" },
    stdio: 'ignore'
  });

  // Wait for server to be responsive
  await new Promise(r => setTimeout(r, 2000));

  console.log("Capturing screenshots...");
  for (const t of targets) {
    for (const v of viewports) {
      const filename = `${t.name}-${v.suffix}.png`;
      const outPath = path.join(OUT_DIR, filename);
      const url = `${BASE_URL}${t.path}`;
      console.log(`Capturing ${url} (${v.width}x${v.height}) -> ${filename}`);
      await runCommand(CHROME_PATH, [
        "--headless",
        "--disable-gpu",
        "--no-sandbox",
        `--window-size=${v.width},${v.height}`,
        `--screenshot=${outPath}`,
        url
      ]);
    }
  }

  console.log("Killing server...");
  server.kill('SIGTERM');

  console.log("Baseline captures completed!");
}

main().catch(console.error);
