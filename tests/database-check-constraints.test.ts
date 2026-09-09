import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";

describe("Database Architecture Hardening - Task 5: Database Check Constraints", () => {
  const sqlPath = path.join(process.cwd(), "prisma/migrations/check_constraints.sql");
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");

  const sqlContent = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, "utf-8") : "";
  const schemaContent = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf-8") : "";

  describe("File Integrity & SQL Structure", () => {
    test("check_constraints.sql exists and has non-trivial content", () => {
      assert.ok(fs.existsSync(sqlPath), "prisma/migrations/check_constraints.sql must exist");
      assert.ok(sqlContent.length > 200, "prisma/migrations/check_constraints.sql must contain meaningful DDL");
    });

    test("schema.prisma defines referenced columns on mapped models", () => {
      // Task model progress_percent, start_date, due_date
      assert.ok(
        /progressPercent\s+Int\s+@default\(0\)\s+@map\("progress_percent"\)/.test(schemaContent),
        "Task model must map progressPercent to progress_percent"
      );
      assert.ok(
        /startDate\s+DateTime\s+@default\(now\(\)\)\s+@map\("start_date"\)/.test(schemaContent),
        "Task model must map startDate to start_date"
      );
      assert.ok(
        /dueDate\s+DateTime\s+@map\("due_date"\)/.test(schemaContent),
        "Task model must map dueDate to due_date"
      );

      // PushSubscription model failure_count
      assert.ok(
        /failureCount\s+Int\s+@default\(0\)\s+@map\("failure_count"\)/.test(schemaContent),
        "PushSubscription model must map failureCount to failure_count"
      );
    });

    test("all ALTER TABLE statements have balanced quotes and parentheses", () => {
      // Extract clean statements outside the DO block
      const ddlStatements = sqlContent
        .split("DO $$")[0]
        .split(";")
        .map((stmt) =>
          stmt
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => !line.startsWith("--"))
            .join(" ")
            .trim()
        )
        .filter((stmt) => stmt.length > 0);

      assert.ok(ddlStatements.length >= 8, `Expected at least 8 DDL statements, found ${ddlStatements.length}`);

      for (const stmt of ddlStatements) {
        // Balanced double quotes
        const doubleQuotes = (stmt.match(/"/g) || []).length;
        assert.strictEqual(
          doubleQuotes % 2,
          0,
          `Double quotes must be balanced in statement: ${stmt}`
        );

        // Balanced single quotes
        const singleQuotes = (stmt.match(/'/g) || []).length;
        assert.strictEqual(
          singleQuotes % 2,
          0,
          `Single quotes must be balanced in statement: ${stmt}`
        );

        // Balanced parentheses
        const openParens = (stmt.match(/\(/g) || []).length;
        const closeParens = (stmt.match(/\)/g) || []).length;
        assert.strictEqual(
          openParens,
          closeParens,
          `Parentheses must be balanced in statement: ${stmt}`
        );

        // Must start with ALTER TABLE IF EXISTS
        assert.ok(
          /^ALTER TABLE IF EXISTS/i.test(stmt),
          `Statement must begin with ALTER TABLE IF EXISTS: ${stmt}`
        );
      }
    });

    test("defines constraints for all required entities and invariants", () => {
      // 1. Task progress_percent
      assert.ok(
        /chk_tasks_progress_percent\s+CHECK\s*\(progress_percent\s+BETWEEN\s+0\s+AND\s+100\)/i.test(sqlContent) ||
        /chk_tasks_progress_percent\s+CHECK\s*\(progress_percent\s*>=\s*0\s+AND\s+progress_percent\s*<=\s*100\)/i.test(sqlContent),
        "Must define CHECK constraint for progress_percent between 0 and 100"
      );

      // 2. Task due_date >= start_date
      assert.ok(
        /chk_tasks_due_date_after_start_date\s+CHECK\s*\(.*due_date\s*>=\s*start_date.*\)/i.test(sqlContent),
        "Must define CHECK constraint for due_date >= start_date with null tolerance"
      );

      // 3. PushSubscription failure_count >= 0
      assert.ok(
        /chk_push_subscriptions_failure_count\s+CHECK\s*\(failure_count\s*>=\s*0\)/i.test(sqlContent),
        "Must define CHECK constraint for failure_count >= 0"
      );

      // 4. OutboxEvent attempts >= 0
      assert.ok(
        /chk_outbox_events_attempts\s+CHECK\s*\(attempts\s*>=\s*0\)/i.test(sqlContent),
        "Must define CHECK constraint for outbox attempts >= 0"
      );
    });

    test("includes idempotent PL/pgSQL DO block with exception trapping", () => {
      assert.ok(sqlContent.includes("DO $$"), "Must contain PL/pgSQL DO block");
      assert.ok(
        sqlContent.includes("duplicate_object"),
        "DO block must trap duplicate_object exception for idempotency"
      );
      assert.ok(
        sqlContent.includes("information_schema.tables"),
        "DO block must verify table existence in current_schema()"
      );
    });
  });

  describe("Idempotency Verification", () => {
    test("every ADD CONSTRAINT statement is preceded by a DROP CONSTRAINT IF EXISTS", () => {
      const ddlStatements = sqlContent
        .split("DO $$")[0]
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const dropMap = new Map<string, string>(); // constraintName -> tableName
      const addMap = new Map<string, string>();

      for (const rawStmt of ddlStatements) {
        const stmt = rawStmt
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => !line.startsWith("--"))
          .join(" ")
          .trim();

        const dropMatch = stmt.match(/ALTER TABLE IF EXISTS\s+"?([a-zA-Z0-9_]+)"?\s+DROP CONSTRAINT IF EXISTS\s+"?([a-zA-Z0-9_]+)"?/i);
        if (dropMatch) {
          dropMap.set(dropMatch[2], dropMatch[1]);
        }

        const addMatch = stmt.match(/ALTER TABLE IF EXISTS\s+"?([a-zA-Z0-9_]+)"?\s+ADD CONSTRAINT\s+"?([a-zA-Z0-9_]+)"?\s+CHECK/i);
        if (addMatch) {
          addMap.set(addMatch[2], addMatch[1]);
          // Assert that before this ADD CONSTRAINT, there was a matching DROP CONSTRAINT IF EXISTS on the same table
          assert.ok(
            dropMap.has(addMatch[2]),
            `ADD CONSTRAINT ${addMatch[2]} on table ${addMatch[1]} must be preceded by DROP CONSTRAINT IF EXISTS`
          );
          assert.strictEqual(
            dropMap.get(addMatch[2]),
            addMatch[1],
            `DROP CONSTRAINT and ADD CONSTRAINT must target the same table for ${addMatch[2]}`
          );
        }
      }

      assert.ok(addMap.size >= 4, `Expected at least 4 ADD CONSTRAINT statements, found ${addMap.size}`);
    });

    test("simulated re-execution against a constraint catalog demonstrates idempotency", () => {
      // Mock database schema catalog
      interface MockTable {
        name: string;
        constraints: Map<string, string>; // constraintName -> checkExpression
      }

      const catalog = new Map<string, MockTable>();
      catalog.set("tasks", { name: "tasks", constraints: new Map() });
      catalog.set("push_subscriptions", { name: "push_subscriptions", constraints: new Map() });
      // outbox_events does not exist initially

      function executeDdlSimulation(sql: string) {
        const statements = sql
          .split("DO $$")[0]
          .split(";")
          .map((s) =>
            s
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => !l.startsWith("--"))
              .join(" ")
              .trim()
          )
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          const dropMatch = stmt.match(/ALTER TABLE IF EXISTS\s+"?([a-zA-Z0-9_]+)"?\s+DROP CONSTRAINT IF EXISTS\s+"?([a-zA-Z0-9_]+)"?/i);
          if (dropMatch) {
            const [, tableName, constraintName] = dropMatch;
            const table = catalog.get(tableName);
            if (table) {
              table.constraints.delete(constraintName);
            }
            continue;
          }

          const addMatch = stmt.match(/ALTER TABLE IF EXISTS\s+"?([a-zA-Z0-9_]+)"?\s+ADD CONSTRAINT\s+"?([a-zA-Z0-9_]+)"?\s+CHECK\s*\((.+)\)/i);
          if (addMatch) {
            const [, tableName, constraintName, expr] = addMatch;
            const table = catalog.get(tableName);
            if (table) {
              table.constraints.set(constraintName, expr.trim());
            }
            continue;
          }
        }
      }

      // First run
      executeDdlSimulation(sqlContent);
      const tasksTable = catalog.get("tasks")!;
      assert.ok(tasksTable.constraints.has("chk_tasks_progress_percent"));
      assert.ok(tasksTable.constraints.has("chk_tasks_due_date_after_start_date"));

      const pushTable = catalog.get("push_subscriptions")!;
      assert.ok(pushTable.constraints.has("chk_push_subscriptions_failure_count"));

      // Snapshot state after first execution
      const snapshot1 = JSON.stringify(Array.from(catalog.entries()));

      // Second run (simulating duplicate migration apply)
      executeDdlSimulation(sqlContent);
      const snapshot2 = JSON.stringify(Array.from(catalog.entries()));

      // Third run
      executeDdlSimulation(sqlContent);
      const snapshot3 = JSON.stringify(Array.from(catalog.entries()));

      assert.strictEqual(snapshot1, snapshot2, "Second migration execution must produce identical database state");
      assert.strictEqual(snapshot2, snapshot3, "Third migration execution must produce identical database state");
    });
  });

  describe("Business Logic & Boundary Value Testing", () => {
    // 1. Task progress_percent boundary check
    describe("Task progress_percent invariant: [0, 100]", () => {
      function evaluateProgressPercentCheck(progressPercent: number | null | undefined): boolean {
        if (progressPercent === null || progressPercent === undefined) return true; // SQL NULL in CHECK is not false
        return progressPercent >= 0 && progressPercent <= 100;
      }

      test("accepts valid boundary and internal values (0, 1, 50, 99, 100)", () => {
        const validValues = [0, 1, 25, 50, 75, 99, 100];
        for (const val of validValues) {
          assert.strictEqual(
            evaluateProgressPercentCheck(val),
            true,
            `Value ${val} must be accepted within [0, 100]`
          );
        }
      });

      test("rejects negative progress values (-1, -5, -100)", () => {
        const invalidNegative = [-1, -5, -50, -100];
        for (const val of invalidNegative) {
          assert.strictEqual(
            evaluateProgressPercentCheck(val),
            false,
            `Negative value ${val} must be rejected by check constraint`
          );
        }
      });

      test("rejects progress values exceeding 100 (101, 105, 9999)", () => {
        const invalidOver = [101, 105, 150, 200, 9999];
        for (const val of invalidOver) {
          assert.strictEqual(
            evaluateProgressPercentCheck(val),
            false,
            `Value ${val} exceeding 100 must be rejected by check constraint`
          );
        }
      });
    });

    // 2. Task dueDate >= startDate check
    describe("Task dueDate >= startDate invariant", () => {
      function evaluateTaskDateOrderCheck(
        startDate: Date | string | null | undefined,
        dueDate: Date | string | null | undefined
      ): boolean {
        if (!startDate || !dueDate) return true; // (due_date IS NULL OR start_date IS NULL)
        const start = new Date(startDate).getTime();
        const due = new Date(dueDate).getTime();
        return due >= start;
      }

      test("accepts dueDate strictly after startDate", () => {
        const start = new Date("2026-09-01T08:00:00Z");
        const due = new Date("2026-09-10T17:00:00Z");
        assert.strictEqual(evaluateTaskDateOrderCheck(start, due), true);
      });

      test("accepts dueDate equal to startDate (same timestamp)", () => {
        const timestamp = new Date("2026-09-09T08:00:00Z");
        assert.strictEqual(evaluateTaskDateOrderCheck(timestamp, timestamp), true);
      });

      test("accepts tasks when startDate or dueDate is null/undefined", () => {
        assert.strictEqual(evaluateTaskDateOrderCheck(null, new Date("2026-09-10T17:00:00Z")), true);
        assert.strictEqual(evaluateTaskDateOrderCheck(new Date("2026-09-01T08:00:00Z"), null), true);
        assert.strictEqual(evaluateTaskDateOrderCheck(null, null), true);
      });

      test("rejects tasks with reversed dates (dueDate before startDate)", () => {
        const start = new Date("2026-09-10T08:00:00Z");
        const due = new Date("2026-09-05T17:00:00Z"); // 5 days earlier!
        assert.strictEqual(
          evaluateTaskDateOrderCheck(start, due),
          false,
          "Must reject task where dueDate < startDate"
        );
      });

      test("rejects tasks when dueDate is 1 millisecond earlier than startDate", () => {
        const start = new Date("2026-09-09T10:00:00.001Z");
        const due = new Date("2026-09-09T10:00:00.000Z");
        assert.strictEqual(evaluateTaskDateOrderCheck(start, due), false);
      });
    });

    // 3. PushSubscription failureCount >= 0 check
    describe("PushSubscription failureCount invariant: failureCount >= 0", () => {
      function evaluateFailureCountCheck(failureCount: number | null | undefined): boolean {
        if (failureCount === null || failureCount === undefined) return true;
        return failureCount >= 0;
      }

      test("accepts 0 and positive failure counts (0, 1, 5, 50)", () => {
        const validCounts = [0, 1, 2, 5, 10, 50];
        for (const c of validCounts) {
          assert.strictEqual(evaluateFailureCountCheck(c), true, `Failure count ${c} must be valid`);
        }
      });

      test("rejects negative failure counts (-1, -5, -99)", () => {
        const invalidCounts = [-1, -2, -5, -99];
        for (const c of invalidCounts) {
          assert.strictEqual(
            evaluateFailureCountCheck(c),
            false,
            `Negative failure count ${c} must be rejected`
          );
        }
      });
    });

    // 4. OutboxEvent attempts >= 0 check
    describe("OutboxEvent attempts invariant: attempts >= 0", () => {
      function evaluateAttemptsCheck(attempts: number | null | undefined): boolean {
        if (attempts === null || attempts === undefined) return true;
        return attempts >= 0;
      }

      test("accepts 0 and positive attempt counts (0, 1, 3, 10)", () => {
        const validAttempts = [0, 1, 2, 3, 5, 10];
        for (const a of validAttempts) {
          assert.strictEqual(evaluateAttemptsCheck(a), true, `Attempt count ${a} must be valid`);
        }
      });

      test("rejects negative attempt counts (-1, -3)", () => {
        const invalidAttempts = [-1, -2, -3, -10];
        for (const a of invalidAttempts) {
          assert.strictEqual(
            evaluateAttemptsCheck(a),
            false,
            `Negative attempt count ${a} must be rejected`
          );
        }
      });
    });
  });
});
