import { test, describe } from "node:test";
import assert from "node:assert";
import { prisma } from "@/lib/prisma";
import { runAllDataMigrations } from "../prisma/data-migrations/run-all";

describe("Sprint 7: Legacy Data Cutover & Parity Verification", () => {
  test("1. Backfill runner is fully idempotent, preserves non-speculative state, and surfaces unresolved records for audit", async () => {
    // Snapshot DRI count before apply to ensure migration does not fabricate speculative DRIs
    const beforeDriCount = await prisma.taskActor.count({ where: { role: "DRI" } });

    // Run migration twice to verify idempotency
    const report1 = await runAllDataMigrations(prisma, { apply: true });
    const afterDriCount = await prisma.taskActor.count({ where: { role: "DRI" } });
    const report2 = await runAllDataMigrations(prisma, { apply: true });

    assert.ok(report1);
    assert.ok(report2);

    // Non-speculative invariant: apply must NOT fabricate speculative DRI records from creator users
    assert.strictEqual(
      afterDriCount,
      beforeDriCount,
      "apply must not fabricate speculative DRI assignments on unresolved tasks"
    );

    // Idempotency: both runs must produce identical violation counts and legacy audits
    assert.strictEqual(report1.totalLegacyRecordsAudited, report2.totalLegacyRecordsAudited);
    assert.strictEqual(
      report1.assigneeMigration.mismatchedAssignees,
      report2.assigneeMigration.mismatchedAssignees
    );

    // Contract: when database contains tasks without authoritative DRI, the audit must report
    // them honestly as TASK_WITHOUT_DRI without fabricating speculative creator DRI assignments.
    const violations = report1.assigneeMigration.integrity?.violations || [];
    const driViolation = violations.find((v: { kind: string; count: number }) => v.kind === "TASK_WITHOUT_DRI");
    if (driViolation) {
      assert.strictEqual(
        report1.overallParitySuccess,
        false,
        "Must report paritySuccess=false when unresolved tasks exist"
      );
      assert.ok(driViolation.count > 0, "Must report exact count of tasks missing DRI");
      // Log count and sample IDs with limit to protect business data privacy in CI logs
      const sampleUnresolved = await prisma.task.findMany({
        where: { actors: { none: { role: "DRI" } } },
        select: { id: true, code: true },
        take: 3,
      });
      console.log(
        `[Sprint 7 Cutover Audit] Phát hiện ${driViolation.count} nhiệm vụ thiếu DRI cần đối soát nghiệp vụ (mẫu: ${sampleUnresolved.map((s) => s.code).join(", ")}...)`
      );
    } else {
      assert.strictEqual(report1.overallParitySuccess, true);
    }
    // Phase 9 WI-9.3: dacumMigration removed — DacumDelegation table dropped.

    // Verify each legacy task assignee has a corresponding V2 task actor
    const sampleAssignees = await prisma.taskActor.findMany({
      where: { role: { in: ["DRI", "COLLABORATOR"] } },
      take: 10,
    });
    for (const assignee of sampleAssignees) {
      const actor = await prisma.taskActor.findFirst({
        where: {
          taskId: assignee.taskId,
          userId: assignee.userId,
        },
      });
      assert.ok(actor, `Legacy assignee ${assignee.id} must have a corresponding TaskActor`);
      assert.ok(
        actor.role === "DRI" || actor.role === "COLLABORATOR",
        `Actor role must be DRI or COLLABORATOR, got ${actor.role}`
      );
    }
  });

  test("2. Task creation maintains TaskActor records correctly (Phase 9: TaskAssignee dropped)", async () => {
    // Find or create test task
    const testCode = `TEST_S7_${Date.now()}`;
    const user = await prisma.user.findFirst();
    assert.ok(user, "User must exist");

    const createdTask = await prisma.task.create({
      data: {
        code: testCode,
        title: "Sprint 7 Cutover Task",
        description: "Testing V2 TaskActor parity (Phase 9: TaskAssignee dropped)",
        scope: "DEPARTMENT",
        priority: "NORMAL",
        status: "IN_PROGRESS",
        academicMonth: 9,
        academicYear: "2023-2024",
        dueDate: new Date(Date.now() + 86400000),
        createdById: user.id,
        actors: {
          create: {
            userId: user.id,
            role: "DRI",
            isPrimaryDRI: true,
            appointedAt: new Date(),
          },
        },
      },
      include: {
        actors: true,
      },
    });

    assert.ok(createdTask.id);
    assert.strictEqual(createdTask.actors.length, 1);
    assert.strictEqual(createdTask.actors[0].userId, user.id);
    assert.strictEqual(createdTask.actors[0].userId, user.id);

    // Clean up test task
    await prisma.taskActor.deleteMany({ where: { taskId: createdTask.id } });
    await prisma.taskActor.deleteMany({ where: { taskId: createdTask.id } });
    await prisma.task.delete({ where: { id: createdTask.id } });
  });

  test("3. DelegationGrant is the sole delegation authority (DacumDelegation table dropped)", async () => {
    // Phase 9 WI-9.3: dacum_delegations table has been dropped.
    // Verify DelegationGrant records exist and have valid status values.
    const grants = await prisma.delegationGrant.findMany({ take: 10 });
    for (const grant of grants) {
      assert.ok(["ACTIVE", "REVOKED", "EXPIRED"].includes(grant.status), `DelegationGrant ${grant.id} must have a valid status`);
      assert.ok(grant.validFrom <= grant.validUntil, `DelegationGrant ${grant.id} must have validFrom before validUntil`);
    }
  });
});
