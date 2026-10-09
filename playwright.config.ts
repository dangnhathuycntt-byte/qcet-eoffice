import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { E2E_AUTH_FILE, E2E_AUTH_SECRET, E2E_BASE_URL, E2E_PORT, E2E_UPLOADS, resolveE2eDatabaseUrl } from "./e2e/env";

loadEnvConfig(process.cwd());

// Ghi đè cho cả tiến trình test lẫn server con: DB tách biệt, secret cố định, thư mục tệp tạm.
process.env.DATABASE_URL = resolveE2eDatabaseUrl();
process.env.AUTH_SECRET = E2E_AUTH_SECRET;
process.env.UPLOADS_DIR = E2E_UPLOADS;
process.env.QCET_ALLOW_DB_TESTS = "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  outputDir: "./test-results",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  // Lần chạy đầu biên dịch trang theo yêu cầu (next dev) nên cần dư thời gian
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: E2E_BASE_URL,
    channel: "chrome",
    storageState: E2E_AUTH_FILE,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NEXT_DIST_DIR: ".next-e2e" },
  },
});
