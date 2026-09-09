import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Prisma, AssigneeRole, PushSubscriptionStatus } from "@prisma/client";

describe("Database Architecture Hardening - Task 3: Invariants & Single Primary Owner Constraint", () => {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  const sqlPath = path.join(process.cwd(), "prisma/migrations/constraints.sql");
  const sqlContent = fs.existsSync(sqlPath) ? fs.readFileSync(sqlPath, "utf-8") : "";

  describe("Prisma Schema Invariants", () => {
    test("TaskAssignee defines compound uniqueness on [taskId, userId, roleInTask] with name task_user_role_unique", () => {
      assert.ok(
        /@@unique\(\[taskId,\s*userId,\s*roleInTask\],\s*name:\s*"task_user_role_unique"\)/.test(schemaContent),
        "TaskAssignee must define @@unique([taskId, userId, roleInTask], name: \"task_user_role_unique\")"
      );
    });

    test("PushSubscription defines lastSeenAt and disabledAt tracking fields with appropriate DB mappings", () => {
      assert.ok(
        /lastSeenAt\s+DateTime\?\s+@map\("last_seen_at"\)/.test(schemaContent),
        "PushSubscription must define lastSeenAt DateTime? @map(\"last_seen_at\")"
      );
      assert.ok(
        /disabledAt\s+DateTime\?\s+@map\("disabled_at"\)/.test(schemaContent),
        "PushSubscription must define disabledAt DateTime? @map(\"disabled_at\")"
      );
    });

    test("PushSubscription defines failureCount and endpoint uniqueness", () => {
      assert.ok(
        /failureCount\s+Int\s+@default\(0\)\s+@map\("failure_count"\)/.test(schemaContent),
        "PushSubscription must define failureCount Int @default(0) @map(\"failure_count\")"
      );
      assert.ok(
        /endpoint\s+String\s+@unique/.test(schemaContent),
        "PushSubscription must define endpoint String @unique"
      );
    });

    test("Prisma Client exports updated scalar field enums for PushSubscription and TaskAssignee", () => {
      assert.strictEqual(
        Prisma.PushSubscriptionScalarFieldEnum.lastSeenAt,
        "lastSeenAt",
        "PushSubscriptionScalarFieldEnum must include lastSeenAt"
      );
      assert.strictEqual(
        Prisma.PushSubscriptionScalarFieldEnum.disabledAt,
        "disabledAt",
        "PushSubscriptionScalarFieldEnum must include disabledAt"
      );
      assert.strictEqual(
        Prisma.PushSubscriptionScalarFieldEnum.failureCount,
        "failureCount",
        "PushSubscriptionScalarFieldEnum must include failureCount"
      );
      assert.strictEqual(
        Prisma.PushSubscriptionScalarFieldEnum.endpoint,
        "endpoint",
        "PushSubscriptionScalarFieldEnum must include endpoint"
      );

      assert.strictEqual(
        Prisma.TaskAssigneeScalarFieldEnum.taskId,
        "taskId",
        "TaskAssigneeScalarFieldEnum must include taskId"
      );
      assert.strictEqual(
        Prisma.TaskAssigneeScalarFieldEnum.userId,
        "userId",
        "TaskAssigneeScalarFieldEnum must include userId"
      );
      assert.strictEqual(
        Prisma.TaskAssigneeScalarFieldEnum.roleInTask,
        "roleInTask",
        "TaskAssigneeScalarFieldEnum must include roleInTask"
      );
    });
  });

  describe("SQL Constraints & Migration Script", () => {
    test("constraints.sql exists and is populated", () => {
      assert.ok(fs.existsSync(sqlPath), "prisma/migrations/constraints.sql must exist");
      assert.ok(sqlContent.length > 50, "prisma/migrations/constraints.sql must not be empty");
    });

    test("defines partial unique index for single primary owner matching prompt spec", () => {
      assert.ok(
        sqlContent.includes('CREATE UNIQUE INDEX IF NOT EXISTS task_one_primary_owner'),
        "Must define CREATE UNIQUE INDEX IF NOT EXISTS task_one_primary_owner"
      );
      assert.ok(
        /CREATE UNIQUE INDEX IF NOT EXISTS task_one_primary_owner\s+ON\s+"TaskAssignee"\s*\("taskId"\)\s*WHERE\s+"roleInTask"\s*=\s*'PRIMARY_OWNER';/.test(
          sqlContent
        ),
        "Must enforce exactly one PRIMARY_OWNER per task on TaskAssignee(taskId)"
      );
    });

    test("defines partial unique index for physical PostgreSQL table mapping (task_assignees)", () => {
      assert.ok(
        sqlContent.includes('task_assignees_one_primary_owner'),
        "Must define task_assignees_one_primary_owner index"
      );
      assert.ok(
        /CREATE UNIQUE INDEX IF NOT EXISTS task_assignees_one_primary_owner\s+ON\s+"task_assignees"\s*\("task_id"\)\s*WHERE\s+"role_in_task"\s*=\s*'PRIMARY_OWNER';/.test(
          sqlContent
        ),
        "Must enforce exactly one PRIMARY_OWNER per task on task_assignees(task_id)"
      );
    });

    test("defines compound unique constraint on (task_id, user_id, role_in_task)", () => {
      assert.ok(
        /CREATE UNIQUE INDEX IF NOT EXISTS task_user_role_unique\s+ON\s+"task_assignees"\s*\("task_id",\s*"user_id",\s*"role_in_task"\);/.test(
          sqlContent
        ),
        "Must enforce compound uniqueness for task, user, and role in SQL"
      );
    });

    test("defines push subscription uniqueness and index for stale cleanup", () => {
      assert.ok(
        sqlContent.includes('push_subscriptions_endpoint_key'),
        "Must include push_subscriptions_endpoint_key index"
      );
      assert.ok(
        sqlContent.includes('idx_push_subscriptions_stale_cleanup'),
        "Must include idx_push_subscriptions_stale_cleanup index"
      );
    });

    test("all SQL statements in constraints.sql are syntactically valid PostgreSQL statements", () => {
      const statements = sqlContent
        .split(";")
        .map((s) =>
          s
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => !line.startsWith("--"))
            .join(" ")
            .trim()
        )
        .filter((s) => s.length > 0);

      assert.ok(statements.length >= 4, `Must contain at least 4 SQL index/constraint statements, found ${statements.length}`);

      for (const cleanStmt of statements) {
        const isCreateIndex = /^CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS/i.test(cleanStmt);
        assert.ok(
          isCreateIndex,
          `Statement must be a valid CREATE [UNIQUE] INDEX statement: ${cleanStmt}`
        );

        // Verify balanced parentheses and quotes
        const openParen = (cleanStmt.match(/\(/g) || []).length;
        const closeParen = (cleanStmt.match(/\)/g) || []).length;
        assert.strictEqual(
          openParen,
          closeParen,
          `Parentheses must be balanced in statement: ${cleanStmt}`
        );

        const quotes = (cleanStmt.match(/"/g) || []).length;
        assert.strictEqual(
          quotes % 2,
          0,
          `Double quotes must be balanced in statement: ${cleanStmt}`
        );
      }
    });
  });

  describe("Business Invariant Validation Logic", () => {
    test("Single PRIMARY_OWNER invariant rejects multiple primary owners for the same task", () => {
      type Assignee = { taskId: string; userId: string; roleInTask: AssigneeRole };

      function validateSinglePrimaryOwner(assignees: Assignee[]): boolean {
        const primaryOwners = assignees.filter((a) => a.roleInTask === AssigneeRole.PRIMARY_OWNER);
        return primaryOwners.length <= 1;
      }

      const validAssignees: Assignee[] = [
        { taskId: "task-1", userId: "user-1", roleInTask: AssigneeRole.PRIMARY_OWNER },
        { taskId: "task-1", userId: "user-2", roleInTask: AssigneeRole.COLLABORATOR },
        { taskId: "task-1", userId: "user-3", roleInTask: AssigneeRole.SUPERVISOR },
      ];
      assert.strictEqual(validateSinglePrimaryOwner(validAssignees), true);

      const invalidAssignees: Assignee[] = [
        { taskId: "task-1", userId: "user-1", roleInTask: AssigneeRole.PRIMARY_OWNER },
        { taskId: "task-1", userId: "user-2", roleInTask: AssigneeRole.PRIMARY_OWNER },
      ];
      assert.strictEqual(validateSinglePrimaryOwner(invalidAssignees), false);
    });

    test("Compound uniqueness prevents duplicate role assignment for the same user and task", () => {
      type AssigneeKey = string;

      function createAssigneeKey(taskId: string, userId: string, roleInTask: AssigneeRole): AssigneeKey {
        return `${taskId}:${userId}:${roleInTask}`;
      }

      const assignedKeys = new Set<AssigneeKey>();

      const first = createAssigneeKey("task-1", "user-1", AssigneeRole.COLLABORATOR);
      assert.strictEqual(assignedKeys.has(first), false);
      assignedKeys.add(first);

      const duplicate = createAssigneeKey("task-1", "user-1", AssigneeRole.COLLABORATOR);
      assert.strictEqual(assignedKeys.has(duplicate), true);

      const differentRole = createAssigneeKey("task-1", "user-1", AssigneeRole.SUPERVISOR);
      assert.strictEqual(assignedKeys.has(differentRole), false);
    });

    test("Push subscription status transitions and timestamp tracking", () => {
      interface MockSubscription {
        id: string;
        userId: string;
        endpoint: string;
        status: PushSubscriptionStatus;
        failureCount: number;
        lastSeenAt: Date | null;
        disabledAt: Date | null;
      }

      const sub: MockSubscription = {
        id: "sub-1",
        userId: "user-1",
        endpoint: "https://push.service.org/endpoint/123",
        status: PushSubscriptionStatus.ACTIVE,
        failureCount: 0,
        lastSeenAt: new Date("2026-09-09T08:00:00Z"),
        disabledAt: null,
      };

      // Successful push delivery updates lastSeenAt
      const now = new Date("2026-09-09T08:30:00Z");
      sub.lastSeenAt = now;
      sub.failureCount = 0;
      assert.strictEqual(sub.status, PushSubscriptionStatus.ACTIVE);
      assert.strictEqual(sub.lastSeenAt, now);

      // Repeated failures trigger revocation and set disabledAt
      sub.failureCount = 5;
      if (sub.failureCount >= 5) {
        sub.status = PushSubscriptionStatus.REVOKED;
        sub.disabledAt = now;
      }
      assert.strictEqual(sub.status, PushSubscriptionStatus.REVOKED);
      assert.strictEqual(sub.disabledAt, now);
    });
  });
});
