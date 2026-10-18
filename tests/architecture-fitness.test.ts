import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { boundaryViolations } from "../scripts/architecture-boundaries.mjs";

const ROOT_DIR = process.cwd();
const WEB_SRC = path.join(ROOT_DIR, "apps", "web", "src");
const API_SRC = path.join(ROOT_DIR, "apps", "api", "src");
const PUBLIC_DIR = path.join(ROOT_DIR, "apps", "web", "public");

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next" && entry.name !== ".git") {
        getAllFiles(fullPath, fileList);
      }
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Architecture Fitness Invariants (QCET E-Office)", () => {
  describe("1. Public / Private File Boundary Invariant", () => {
    it("ensures public/ directory contains zero confidential user files or legacy documents directory", () => {
      const legacyDocDir = path.join(PUBLIC_DIR, "documents");
      assert.strictEqual(
        fs.existsSync(legacyDocDir),
        false,
        "public/documents must not exist (all private files must be in protected private storage or public-documents)"
      );
    });

    it("verifies all files in public/ are public static assets (images, icons, manifest, sw, public-documents)", () => {
      const publicFiles = getAllFiles(PUBLIC_DIR);
      for (const filePath of publicFiles) {
        const rel = path.relative(PUBLIC_DIR, filePath);
        // Ensure no private extensions or patterns
        assert.doesNotMatch(
          rel,
          /(confidential|secret|internal|user_upload|user_export)/i,
          `Public asset '${rel}' violates public/private data boundary`
        );
      }
    });

    it("verifies private file storage abstraction exists in apps/api/src/storage/private-files.ts", () => {
      const storageModule = path.join(API_SRC, "storage", "private-files.ts");
      assert.strictEqual(fs.existsSync(storageModule), true, "apps/api/src/storage/private-files.ts must exist");
    });
  });

  describe("2. Client / Server Boundary Invariants", () => {
    const allSrcFiles = [WEB_SRC, API_SRC, path.join(ROOT_DIR, "packages")].flatMap((dir) => getAllFiles(dir)).filter((f) => /\.(ts|tsx)$/.test(f));

    it("ensures no Client Component or UI Component imports Prisma directly", () => {
      const violations: string[] = [];

      for (const filePath of allSrcFiles) {
        const content = fs.readFileSync(filePath, "utf8");
        const isClientComponent = /^["']use client["']/m.test(content);
        const isInsideComponents = filePath.includes(path.join("web", "src", "components"));

        if (isClientComponent || isInsideComponents) {
          if (/from\s+["']@prisma\/client["']/.test(content)) {
            violations.push(path.relative(ROOT_DIR, filePath));
          }
        }
      }

      assert.deepStrictEqual(
        violations,
        [],
        `Client/UI components must never import @prisma/client directly: ${violations.join(", ")}`
      );
    });

    it("ensures UI components do not import server-only environment configuration", () => {
      const uiFiles = allSrcFiles.filter((f) => f.includes(path.join("web", "src", "components")));
      const violations: string[] = [];

      for (const filePath of uiFiles) {
        const content = fs.readFileSync(filePath, "utf8");
        if (/from\s+["'].*\/env\.server["']/.test(content)) {
          violations.push(path.relative(ROOT_DIR, filePath));
        }
      }

      assert.deepStrictEqual(
        violations,
        [],
        `UI components must not import server secrets config: ${violations.join(", ")}`
      );
    });

    it("ensures domain logic does not import UI components (layering isolation)", () => {
      const domainFiles = allSrcFiles.filter(
        (f) => f.includes(path.join("src", "domain")) || f.includes(path.join("src", "server", "domain"))
      );
      const violations: string[] = [];

      for (const filePath of domainFiles) {
        const content = fs.readFileSync(filePath, "utf8");
        if (/from\s+["'](@\/components\/|\.\.\/.*components\/)/.test(content)) {
          violations.push(path.relative(ROOT_DIR, filePath));
        }
      }

      assert.deepStrictEqual(
        violations,
        [],
        `Domain business logic must never import UI presentation components: ${violations.join(", ")}`
      );
    });

    // Ranh giới FE/BE (luật dùng chung với scripts/lint.mjs: scripts/architecture-boundaries.mjs).
    function boundaryViolationsFor(rule: string): string[] {
      const out: string[] = [];
      for (const filePath of allSrcFiles) {
        const relPath = path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
        for (const v of boundaryViolations(relPath, fs.readFileSync(filePath, "utf8"))) {
          if (v.rule === rule) out.push(`${relPath}:${v.line} ${v.spec}`);
        }
      }
      return out;
    }

    it("ensures API route handlers do not import Prisma or @qcet/db", () => {
      const violations = boundaryViolationsFor("app-no-db");
      assert.deepStrictEqual(violations, [], `Route handler phải đọc/ghi DB qua src/server: ${violations.join(", ")}`);
    });

    it("ensures apps/web imports no server-only module (DB, secrets, node:*, @/server)", () => {
      const violations = boundaryViolationsFor("web-no-server");
      assert.deepStrictEqual(violations, [], `Web không import mã server: ${violations.join(", ")}`);
    });

    it("ensures API lib, domain and server do not import components or app", () => {
      const violations = boundaryViolationsFor("core-no-ui");
      assert.deepStrictEqual(violations, [], `lib/domain/server không import UI/app: ${violations.join(", ")}`);
    });

    it("ensures no app imports another app (no allowlist left)", () => {
      const violations = boundaryViolationsFor("no-cross-app");
      assert.deepStrictEqual(violations, [], `App import app khác: ${violations.join(", ")}`);
    });

    it("packages do not import apps; @qcet/shared and @qcet/contracts stay pure", () => {
      const violations = [...boundaryViolationsFor("package-no-app"), ...boundaryViolationsFor("package-pure")];
      assert.deepStrictEqual(violations, [], `Package import app hoặc module server: ${violations.join(", ")}`);

      const rulesOf = (relPath: string, content: string) => boundaryViolations(relPath, content).map((v) => v.rule);
      assert.deepStrictEqual(rulesOf("packages/shared/src/lib/x.ts", 'import { y } from "@/lib/y";'), ["package-no-app"]);
      assert.deepStrictEqual(rulesOf("packages/shared/src/lib/x.ts", 'import { y } from "../../../../apps/web/src/lib/y";'), ["package-no-app"]);
      assert.deepStrictEqual(rulesOf("packages/contracts/src/x.ts", 'import { TaskStatus } from "@prisma/client";'), ["package-pure"]);
      assert.deepStrictEqual(rulesOf("packages/shared/src/x.ts", 'import { prisma } from "@qcet/db/prisma";'), ["package-pure"]);
      assert.deepStrictEqual(rulesOf("packages/shared/src/x.ts", 'import fs from "node:fs";'), ["package-pure"]);
      assert.deepStrictEqual(rulesOf("packages/shared/src/x.ts", 'import { z } from "@qcet/contracts/common";'), []);
      assert.deepStrictEqual(rulesOf("packages/db/src/audit.ts", 'import { Prisma } from "@prisma/client";'), []);
      assert.deepStrictEqual(rulesOf("packages/db/src/audit.ts", 'import { x } from "@/server/x";'), ["package-no-app"]);
    });

    it("detects every import form and ignores comments, strings and look-alike paths", () => {
      const rulesOf = (relPath: string, content: string) => boundaryViolations(relPath, content).map((v) => v.rule);

      for (const line of [
        'import { prisma } from "@/lib/prisma";',
        'import type { Prisma } from "@prisma/client";',
        'export { writeAudit } from "@/lib/db/audit";',
        'const m = await import("@/lib/db/outbox");',
        'const p = require("../../../../lib/prisma");',
        'export * as db from "@/lib/prisma";',
        'export type * as P from "@prisma/client";',
        'import prismaModule = require("@/lib/prisma");',
        'type Client = import("@/lib/prisma").PrismaClientLike;',
      ]) {
        assert.deepStrictEqual(rulesOf("apps/api/src/app/api/x/[id]/route.ts", line), ["app-no-db"], line);
      }
      // Web: mọi file trong apps/web/src (trang, component, hook, lib) không import module chỉ chạy server.
      assert.deepStrictEqual(rulesOf("apps/web/src/app/page.tsx", 'import "@/lib/prisma";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/app/a/(g)/layout.tsx", 'import { x } from "../../../lib/db/audit";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/hooks/use-x.ts", 'import type { T } from "@/server/tasks/t";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/components/a/b.tsx", 'import { y } from "../../server/x";'), ["web-no-server"]);
      assert.deepStrictEqual(
        rulesOf("apps/web/src/components/a/c.tsx", 'export function C() { return <div title="x">{1}</div>; }\nexport * as srv from "@/server/tasks";'),
        ["web-no-server"],
      );
      assert.deepStrictEqual(rulesOf("apps/api/src/server/x.ts", 'import { B } from "@/components/ui/button";'), ["core-no-ui"]);
      assert.deepStrictEqual(rulesOf("apps/api/src/domain/x.ts", 'export * from "../app/tasks/page";'), ["core-no-ui"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import fs from "node:fs";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import { s } from "@/server/api/route-error";'), ["web-no-server"]);
      // Prisma client và audit/outbox nằm ở @qcet/db: web import là vi phạm, lib/server của API thì được.
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/db/audit.ts", 'import { prisma } from "@/lib/prisma";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/api/src/lib/jwt-session.ts", 'import { prisma } from "@qcet/db/prisma";'), []);
      assert.deepStrictEqual(rulesOf("apps/web/src/app/x/page.tsx", 'import { prisma } from "@qcet/db/prisma";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import { writeAudit } from "@qcet/db/audit";'), ["web-no-server"]);
      // app-no-db áp cho mọi file trong src/app của API, kể cả helper không theo tên route.
      assert.deepStrictEqual(rulesOf("apps/api/src/app/api/x/[id]/actions/shared.ts", 'import { prisma } from "@/lib/prisma";'), ["app-no-db"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/app/x/foo-client.tsx", 'import { TaskStatus } from "@prisma/client";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/app/x/foo-client.tsx", 'import { x } from "@/lib/prisma-errors";'), []);
      // web-no-server: bí mật server và mọi module có tiền tố node:; built-in không tiền tố (file isomorphic) không tính.
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import { serverEnv } from "@/config/env.server";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/a/x.ts", 'import { serverEnv } from "../../config/env.server";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import { crc32 } from "node:zlib";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import http2 from "node:http2";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import { readFile } from "node:fs/promises";'), ["web-no-server"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import { clientEnv } from "@/config/env.client";'), []);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'const c = await import("crypto");\nimport { gzip } from "zlib";'), []);
      assert.deepStrictEqual(rulesOf("apps/api/src/lib/jwt-session.ts", 'import { serverEnv } from "@/config/env.server";'), []);
      assert.deepStrictEqual(rulesOf("apps/api/src/server/auth/x.ts", 'import { serverEnv } from "@/config/env.server";'), []);
      // Không app nào import app khác (đường dẫn tương đối ra khỏi app).
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import { j } from "../../../api/src/lib/jwt-session";'), ["no-cross-app"]);
      assert.deepStrictEqual(rulesOf("apps/api/src/server/x.ts", 'import { b } from "../../../web/src/components/ui/button";'), ["no-cross-app"]);
      assert.deepStrictEqual(rulesOf("apps/api/src/server/x.ts", 'import { b } from "../lib/jwt-session";'), []);

      assert.deepStrictEqual(rulesOf("apps/api/src/app/api/x/route.ts", '// import { prisma } from "@/lib/prisma";\nconst s = "@/lib/prisma";'), []);
      assert.deepStrictEqual(rulesOf("apps/api/src/app/api/x/route.ts", 'import { x } from "@/lib/prisma-errors";\nimport { y } from "@/lib/dbx";'), []);
      assert.deepStrictEqual(rulesOf("apps/api/src/app/api/x/shared.ts", 'import { prisma } from "@/lib/prisma";'), ["app-no-db"]);
      assert.deepStrictEqual(rulesOf("apps/web/src/components/x.tsx", 'import { z } from "@/server-utils";'), []);
      assert.deepStrictEqual(rulesOf("apps/web/src/lib/x.ts", 'import { z } from "@/lib/server-safe";'), []);
    });
  });

  describe("3. Secrets Management & Environment Security", () => {
    it(".env.example must exist and contain zero real secret credentials", () => {
      const envExamplePath = path.join(ROOT_DIR, ".env.example");
      assert.strictEqual(fs.existsSync(envExamplePath), true, ".env.example must exist");

      const content = fs.readFileSync(envExamplePath, "utf8");
      assert.doesNotMatch(content, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, "Must not contain real private keys");
      assert.doesNotMatch(content, /AIza[0-9A-Za-z-_]{35}/, "Must not contain real Google API keys");
      assert.doesNotMatch(content, /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, "Must not contain real JWT tokens");
    });

    it("verifies Central Environment Configuration modules exist", () => {
      assert.strictEqual(fs.existsSync(path.join(API_SRC, "config", "env.server.ts")), true);
      assert.strictEqual(fs.existsSync(path.join(WEB_SRC, "config", "env.client.ts")), true);
      assert.strictEqual(fs.existsSync(path.join(API_SRC, "config", "runtime.ts")), true);
    });
  });

  describe("4. Security Headers & Browser Defense", () => {
    it("ensures security headers configuration module exists and defines nosniff and frame-ancestors", async () => {
      const secHeadersPath = path.join(ROOT_DIR, "packages", "shared", "src", "config", "security-headers.ts");
      assert.strictEqual(fs.existsSync(secHeadersPath), true);

      const { getSecurityHeaders } = await import("@qcet/shared/config/security-headers");
      const headers = getSecurityHeaders();

      assert.strictEqual(headers["X-Content-Type-Options"], "nosniff");
      assert.strictEqual(headers["X-Frame-Options"], "DENY");
      assert.ok(headers["Content-Security-Policy-Report-Only"], "CSP Report-Only header must be present");
    });
  });

  describe("5. Feature Flags & Kill Switches", () => {
    it("ensures feature flag module exists and defines kill switches", async () => {
      const flagsPath = path.join(API_SRC, "features", "flags.ts");
      assert.strictEqual(fs.existsSync(flagsPath), true);

      const { isFeatureEnabled, FEATURE_FLAGS } = await import("../apps/api/src/features/flags");
      assert.ok(FEATURE_FLAGS.pushNotifications);
      assert.strictEqual(typeof isFeatureEnabled("pushNotifications"), "boolean");
      assert.strictEqual(FEATURE_FLAGS.pushNotifications.isKillSwitch, true);
    });
  });

  describe("6. Logging Sanitization & Observability", () => {
    it("ensures sanitizeLogContext redacts confidential data", async () => {
      const { sanitizeLogContext } = await import("../apps/api/src/telemetry/server");
      const sanitized = sanitizeLogContext({
        user: "admin",
        password: "super_secret_password",
        token: "jwt_bearer_token",
        secret: "app_secret",
      }) as Record<string, unknown>;

      assert.strictEqual(sanitized.password, "[REDACTED]");
      assert.strictEqual(sanitized.token, "[REDACTED]");
      assert.strictEqual(sanitized.secret, "[REDACTED]");
      assert.strictEqual(sanitized.user, "admin");
    });
  });

  describe("7. CI/CD Quality Gate Consistency", () => {
    it("ensures package.json scripts define lint, verify, test, and typecheck", () => {
      const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
      assert.ok(pkgJson.scripts.lint, "lint script must be defined");
      assert.ok(pkgJson.scripts.verify, "verify script must be defined");
      assert.ok(pkgJson.scripts.test, "test script must be defined");
      assert.ok(pkgJson.scripts.typecheck, "typecheck script must be defined");
    });

    it("verifies CI pipeline configuration files exist in .github/workflows", () => {
      assert.strictEqual(fs.existsSync(path.join(ROOT_DIR, ".github", "workflows", "ci.yml")), true);
      assert.strictEqual(fs.existsSync(path.join(ROOT_DIR, ".github", "workflows", "deploy.yml")), true);
      assert.strictEqual(fs.existsSync(path.join(ROOT_DIR, ".github", "workflows", "dependency-review.yml")), true);
    });

    it("verifies CODEOWNERS file exists", () => {
      assert.strictEqual(fs.existsSync(path.join(ROOT_DIR, ".github", "CODEOWNERS")), true);
    });
  });

  describe("8. Domain Layer Isolation & Canonical Services (Phase 28)", () => {
    it("verifies src/domain/tasks/state-machine.ts exists and has zero imports from react, next, or src/components/", () => {
      const stateMachinePath = path.join(ROOT_DIR, "packages", "shared", "src", "domain", "tasks", "state-machine.ts");
      assert.strictEqual(fs.existsSync(stateMachinePath), true, "packages/shared/src/domain/tasks/state-machine.ts must exist");

      const content = fs.readFileSync(stateMachinePath, "utf8");
      assert.doesNotMatch(
        content,
        /from\s+["'](react|react\/.*)["']/,
        "State machine must not import from react"
      );
      assert.doesNotMatch(
        content,
        /from\s+["'](next|next\/.*)["']/,
        "State machine must not import from next"
      );
      assert.doesNotMatch(
        content,
        /from\s+["'](@\/components\/|\.\.\/.*components\/)["']/,
        "State machine must not import from components"
      );
    });

    it("verifies canonical domain services layer exists", () => {
      const queryServicePath = path.join(API_SRC, "server", "tasks", "task-query-service.ts");
      const commandServicePath = path.join(API_SRC, "server", "tasks", "task-command-service.ts");
      const stateMachinePath = path.join(ROOT_DIR, "packages", "shared", "src", "domain", "tasks", "state-machine.ts");

      assert.strictEqual(fs.existsSync(queryServicePath), true, "task-query-service.ts must exist");
      assert.strictEqual(fs.existsSync(commandServicePath), true, "task-command-service.ts must exist");
      assert.strictEqual(fs.existsSync(stateMachinePath), true, "state-machine.ts must exist");
    });
  });
});

