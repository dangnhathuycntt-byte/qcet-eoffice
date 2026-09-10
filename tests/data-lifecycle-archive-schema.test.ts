import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";

describe("Data Lifecycle & Archive Policy Schema", () => {
  const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");

  test("User model defines isActive, deactivatedAt, and archiver inverse relations", () => {
    assert.ok(
      /isActive\s+Boolean\s+@default\(true\)/.test(schemaContent),
      "User model must define isActive Boolean with default true"
    );
    assert.ok(
      /deactivatedAt\s+DateTime\?/.test(schemaContent),
      "User model must define deactivatedAt DateTime?"
    );
    assert.ok(
      /archivedTasks\s+Task\[\]\s+@relation\("TaskArchiver"\)/.test(schemaContent),
      "User model must define archivedTasks relation to Task"
    );
    assert.ok(
      /archivedDocuments\s+Document\[\]\s+@relation\("DocumentArchiver"\)/.test(schemaContent),
      "User model must define archivedDocuments relation to Document"
    );
  });

  test("Task model defines archivedAt, archivedById, archiveReason, and TaskArchiver relation", () => {
    assert.ok(
      /archivedAt\s+DateTime\?/.test(schemaContent),
      "Task model must define archivedAt DateTime?"
    );
    assert.ok(
      /archivedById\s+String\?/.test(schemaContent),
      "Task model must define archivedById String?"
    );
    assert.ok(
      /archiveReason\s+String\?/.test(schemaContent),
      "Task model must define archiveReason String?"
    );
    assert.ok(
      /archivedBy\s+User\?\s+@relation\("TaskArchiver",\s*fields:\s*\[archivedById\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/.test(
        schemaContent
      ),
      "Task model must define archivedBy User relation with onDelete: SetNull"
    );
  });

  test("Document model defines archivedAt, archivedById, archiveReason, and DocumentArchiver relation", () => {
    assert.ok(
      /archivedAt\s+DateTime\?/.test(schemaContent),
      "Document model must define archivedAt DateTime?"
    );
    assert.ok(
      /archivedById\s+String\?/.test(schemaContent),
      "Document model must define archivedById String?"
    );
    assert.ok(
      /archiveReason\s+String\?/.test(schemaContent),
      "Document model must define archiveReason String?"
    );
    assert.ok(
      /archivedBy\s+User\?\s+@relation\("DocumentArchiver",\s*fields:\s*\[archivedById\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/.test(
        schemaContent
      ),
      "Document model must define archivedBy User relation with onDelete: SetNull"
    );
  });

  test("Prisma scalar field enums include archival fields for Task, Document, and User", () => {
    assert.ok(
      Prisma.TaskScalarFieldEnum.archivedAt === "archivedAt",
      "TaskScalarFieldEnum must include archivedAt"
    );
    assert.ok(
      Prisma.TaskScalarFieldEnum.archivedById === "archivedById",
      "TaskScalarFieldEnum must include archivedById"
    );
    assert.ok(
      Prisma.TaskScalarFieldEnum.archiveReason === "archiveReason",
      "TaskScalarFieldEnum must include archiveReason"
    );

    assert.ok(
      Prisma.DocumentScalarFieldEnum.archivedAt === "archivedAt",
      "DocumentScalarFieldEnum must include archivedAt"
    );
    assert.ok(
      Prisma.DocumentScalarFieldEnum.archivedById === "archivedById",
      "DocumentScalarFieldEnum must include archivedById"
    );
    assert.ok(
      Prisma.DocumentScalarFieldEnum.archiveReason === "archiveReason",
      "DocumentScalarFieldEnum must include archiveReason"
    );

    assert.ok(
      Prisma.UserScalarFieldEnum.deactivatedAt === "deactivatedAt",
      "UserScalarFieldEnum must include deactivatedAt"
    );
    assert.ok(
      Prisma.UserScalarFieldEnum.isActive === "isActive",
      "UserScalarFieldEnum must include isActive"
    );
  });
});
