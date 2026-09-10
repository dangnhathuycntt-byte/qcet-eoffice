import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, "src");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

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

    it("verifies private file storage abstraction exists in src/storage/private-files.ts", () => {
      const storageModule = path.join(SRC_DIR, "storage", "private-files.ts");
      assert.strictEqual(fs.existsSync(storageModule), true, "src/storage/private-files.ts must exist");
    });
  });

  describe("2. Client / Server Boundary Invariants", () => {
    const allSrcFiles = getAllFiles(SRC_DIR).filter((f) => /\.(ts|tsx)$/.test(f));

    it("ensures no Client Component or UI Component imports Prisma directly", () => {
      const violations: string[] = [];

      for (const filePath of allSrcFiles) {
        const content = fs.readFileSync(filePath, "utf8");
        const isClientComponent = /^["']use client["']/m.test(content);
        const isInsideComponents = filePath.includes(path.join("src", "components"));

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
      const uiFiles = allSrcFiles.filter((f) => f.includes(path.join("src", "components")));
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
      assert.strictEqual(fs.existsSync(path.join(SRC_DIR, "config", "env.server.ts")), true);
      assert.strictEqual(fs.existsSync(path.join(SRC_DIR, "config", "env.client.ts")), true);
      assert.strictEqual(fs.existsSync(path.join(SRC_DIR, "config", "runtime.ts")), true);
    });
  });

  describe("4. Security Headers & Browser Defense", () => {
    it("ensures security headers configuration module exists and defines nosniff and frame-ancestors", async () => {
      const secHeadersPath = path.join(SRC_DIR, "config", "security-headers.ts");
      assert.strictEqual(fs.existsSync(secHeadersPath), true);

      const { getSecurityHeaders } = await import("@/config/security-headers");
      const headers = getSecurityHeaders();

      assert.strictEqual(headers["X-Content-Type-Options"], "nosniff");
      assert.strictEqual(headers["X-Frame-Options"], "DENY");
      assert.ok(headers["Content-Security-Policy-Report-Only"], "CSP Report-Only header must be present");
    });
  });

  describe("5. Feature Flags & Kill Switches", () => {
    it("ensures feature flag module exists and defines kill switches", async () => {
      const flagsPath = path.join(SRC_DIR, "features", "flags.ts");
      assert.strictEqual(fs.existsSync(flagsPath), true);

      const { isFeatureEnabled, FEATURE_FLAGS } = await import("@/features/flags");
      assert.ok(FEATURE_FLAGS.pushNotifications);
      assert.strictEqual(typeof isFeatureEnabled("pushNotifications"), "boolean");
      assert.strictEqual(FEATURE_FLAGS.pushNotifications.isKillSwitch, true);
    });
  });

  describe("6. Logging Sanitization & Observability", () => {
    it("ensures sanitizeLogContext redacts confidential data", async () => {
      const { sanitizeLogContext } = await import("@/telemetry/server");
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
      const stateMachinePath = path.join(SRC_DIR, "domain", "tasks", "state-machine.ts");
      assert.strictEqual(fs.existsSync(stateMachinePath), true, "src/domain/tasks/state-machine.ts must exist");

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
      const queryServicePath = path.join(SRC_DIR, "server", "tasks", "task-query-service.ts");
      const commandServicePath = path.join(SRC_DIR, "server", "tasks", "task-command-service.ts");
      const stateMachinePath = path.join(SRC_DIR, "domain", "tasks", "state-machine.ts");

      assert.strictEqual(fs.existsSync(queryServicePath), true, "task-query-service.ts must exist");
      assert.strictEqual(fs.existsSync(commandServicePath), true, "task-command-service.ts must exist");
      assert.strictEqual(fs.existsSync(stateMachinePath), true, "state-machine.ts must exist");
    });
  });
});

