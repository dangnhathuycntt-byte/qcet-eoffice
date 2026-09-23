/**
 * Comprehensive Domain & Database Integrity Test Suite for ReBAC Task Models & Migration
 *
 * Verified Systems:
 * 1. Schema relational integrity (TaskActor, TaskApprovalProcess, TaskApprovalStep, TaskResult, TaskRelation)
 * 2. Single DRI Invariant at database & service levels (cannot assign multiple active DRIs)
 * 3. Cascade deletion: deleting a Task cascades to TaskActor, TaskApprovalProcess, TaskResult, and TaskRelations
 * 4. Backward compatibility: existing Task queries without new relations continue to function
 * 5. Backfill script idempotency: running migrate-task-relations multiple times produces consistent, non-duplicated records
 */

import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  setTaskDRI,
  addTaskCollaborator,
  addTaskObserver,
  getTaskActors,
  validateSingleDRI,
  submitTaskResult,
  verifyTaskResult,
  initiateApprovalProcess,
  executeApprovalStep,
  TaskActorAuthorizationError,
  MakerCheckerError,
  SegregationOfDutiesError,
} from "../src/lib/services/task-actor-service";
import { migrateTaskRelations } from "../prisma/seeds/migrate-task-relations";
import {
  TaskActorRole,
  TaskOriginLevel,
  TaskStatus,
  TaskPriority,
  TaskScope,
  TaskRelationType,
  ApprovalProcessStatus,
  ApprovalStepStatus,
  UserRole,
  // AssigneeRole removed — Phase 9: TaskAssignee table dropped
  Prisma,
} from "@prisma/client";


describe("Domain & Database Integrity: ReBAC Task Models and Migration", () => {
  const timestamp = Date.now();
  const testRunId = `dta_${timestamp}`;

  // Test entities
  let executiveUser: any;
  let deptHeadUser: any;
  let creatorUser: any;
  let driUser1: any;
  let driUser2: any;
  let collaboratorUser: any;
  let observerUser: any;
  let auditorUser: any;

  let orgUnit: any;
  let positionDef: any;
  let positionAssignment: any;

  // Track created tasks for foolproof teardown
  const createdTaskIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdOrgUnitIds: string[] = [];
  const createdPositionDefIds: string[] = [];

  before(async () => {
    // 1. Create or ensure canonical test Organizational Unit
    orgUnit = await prisma.organizationalUnit.findFirst({
      where: { code: "P_QLDT" },
    });
    if (!orgUnit) {
      orgUnit = await prisma.organizationalUnit.create({
        data: {
          code: `P_QLDT_${testRunId}`,
          name: "Phòng Quản lý Đào tạo (QA Test)",
          type: "DEPARTMENT",
        },
      });
      createdOrgUnitIds.push(orgUnit.id);
    }

    // 2. Create distinct test users
    executiveUser = await prisma.user.create({
      data: {
        name: `QA Executive ${testRunId}`,
        email: `qa_exec_${testRunId}@qcet.edu.vn`,
        role: UserRole.BAN_GIAM_HIEU,
      },
    });
    createdUserIds.push(executiveUser.id);

    deptHeadUser = await prisma.user.create({
      data: {
        name: `QA Dept Head ${testRunId}`,
        email: `qa_head_${testRunId}@qcet.edu.vn`,
        role: UserRole.TRUONG_PHONG,

      },
    });
    createdUserIds.push(deptHeadUser.id);

    creatorUser = await prisma.user.create({
      data: {
        name: `QA Task Creator ${testRunId}`,
        email: `qa_creator_${testRunId}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,

      },
    });
    createdUserIds.push(creatorUser.id);

    driUser1 = await prisma.user.create({
      data: {
        name: `QA Primary DRI 1 ${testRunId}`,
        email: `qa_dri1_${testRunId}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,

      },
    });
    createdUserIds.push(driUser1.id);

    driUser2 = await prisma.user.create({
      data: {
        name: `QA Primary DRI 2 ${testRunId}`,
        email: `qa_dri2_${testRunId}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,

      },
    });
    createdUserIds.push(driUser2.id);

    collaboratorUser = await prisma.user.create({
      data: {
        name: `QA Collaborator ${testRunId}`,
        email: `qa_collab_${testRunId}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,

      },
    });
    createdUserIds.push(collaboratorUser.id);

    observerUser = await prisma.user.create({
      data: {
        name: `QA Observer ${testRunId}`,
        email: `qa_observer_${testRunId}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
      },
    });
    createdUserIds.push(observerUser.id);

    auditorUser = await prisma.user.create({
      data: {
        name: `QA Independent Auditor ${testRunId}`,
        email: `qa_auditor_${testRunId}@qcet.edu.vn`,
        role: UserRole.CHUYEN_VIEN,
      },
    });
    createdUserIds.push(auditorUser.id);

    // 3. Create Position Definition and Assignment for Department Head
    positionDef = await prisma.positionDefinition.create({
      data: {
        code: `QA_POS_LEAD_${testRunId}`,
        title: "Trưởng phòng Đào tạo (QA Test)",
        group: "LDPU",
        isLeadership: true,
      },
    });
    createdPositionDefIds.push(positionDef.id);

    positionAssignment = await prisma.positionAssignment.create({
      data: {
        userId: deptHeadUser.id,
        positionDefinitionId: positionDef.id,
        unitId: orgUnit.id,
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    // 1. Delete all tasks created during this test suite (cascade will clean ReBAC relations)
    if (createdTaskIds.length > 0) {
      // Clean relations first to prevent any potential circular FK blocking
      await prisma.taskRelation.deleteMany({
        where: {
          OR: [
            { sourceTaskId: { in: createdTaskIds } },
            { targetTaskId: { in: createdTaskIds } },
          ],
        },
      });

      await prisma.taskResult.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      await prisma.taskApprovalStep.deleteMany({
        where: { process: { taskId: { in: createdTaskIds } } },
      });

      await prisma.taskApprovalProcess.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      await prisma.taskActor.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });

      await prisma.task.deleteMany({
        where: { id: { in: createdTaskIds } },
      });
    }

    // 2. Teardown position assignments and definitions
    if (positionAssignment) {
      await prisma.positionAssignment.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
    }

    for (const defId of createdPositionDefIds) {
      await prisma.positionDefinition.delete({ where: { id: defId } }).catch(() => {});
    }

    // 3. Teardown test users
    for (const uid of createdUserIds) {
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }

    // 4. Teardown test org unit if created
    for (const ouId of createdOrgUnitIds) {
      await prisma.organizationalUnit.delete({ where: { id: ouId } }).catch(() => {});
    }
  });

  // =========================================================================
  // SUB-SUITE 1: Schema Relational Integrity
  // =========================================================================
  describe("1. Schema Relational Integrity", () => {
    test("1.1 TaskActor: verifies foreign keys and bidirectional relations with Task, User, OrgUnit, and AssignedBy", async () => {
      const task = await prisma.task.create({
        data: {
          code: `QA-ACTOR-INT-${testRunId}`,
          title: "Kiểm tra toàn vẹn quan hệ TaskActor",
          createdById: creatorUser.id,
          leadUnitId: orgUnit.id,
          originLevel: TaskOriginLevel.UNIT,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(task.id);

      // Create TaskActors representing DRI, ASSIGNER, LEAD_UNIT, COLLABORATOR, and OBSERVER
      const driActor = await prisma.taskActor.create({
        data: {
          taskId: task.id,
          userId: driUser1.id,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
          assignedById: creatorUser.id,
          notes: "Chỉ định DRI chính",
        },
      });

      const assignerActor = await prisma.taskActor.create({
        data: {
          taskId: task.id,
          userId: creatorUser.id,
          role: TaskActorRole.ASSIGNER,
          isPrimaryDRI: false,
          assignedById: creatorUser.id,
        },
      });

      const leadUnitActor = await prisma.taskActor.create({
        data: {
          taskId: task.id,
          unitId: orgUnit.id,
          role: TaskActorRole.LEAD_UNIT,
          isPrimaryDRI: false,
          assignedById: creatorUser.id,
        },
      });

      // Verify querying Task includes all actors
      const fetchedTask = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
          actors: {
            include: {
              user: true,
              unit: true,
              assignedBy: true,
            },
          },
        },
      });

      assert.ok(fetchedTask);
      assert.equal(fetchedTask.actors.length, 3);

      const foundDri = fetchedTask.actors.find((a) => a.role === TaskActorRole.DRI);
      assert.ok(foundDri);
      assert.equal(foundDri.userId, driUser1.id);
      assert.equal(foundDri.user?.email, driUser1.email);
      assert.equal(foundDri.isPrimaryDRI, true);
      assert.equal(foundDri.assignedById, creatorUser.id);
      assert.equal(foundDri.assignedBy?.id, creatorUser.id);

      const foundLeadUnit = fetchedTask.actors.find((a) => a.role === TaskActorRole.LEAD_UNIT);
      assert.ok(foundLeadUnit);
      assert.equal(foundLeadUnit.unitId, orgUnit.id);
      assert.equal(foundLeadUnit.unit?.code, orgUnit.code);

      // Verify reverse relation: User.taskActors and User.assignedActors
      const userWithActors = await prisma.user.findUnique({
        where: { id: driUser1.id },
        include: { taskActors: true },
      });
      assert.ok(userWithActors?.taskActors.some((a) => a.id === driActor.id));

      const assignerUser = await prisma.user.findUnique({
        where: { id: creatorUser.id },
        include: { assignedActors: true },
      });
      assert.ok(assignerUser?.assignedActors.some((a) => a.id === driActor.id));

      // Verify reverse relation: OrganizationalUnit.taskActors
      const unitWithActors = await prisma.organizationalUnit.findUnique({
        where: { id: orgUnit.id },
        include: { taskActors: true },
      });
      assert.ok(unitWithActors?.taskActors.some((a) => a.id === leadUnitActor.id));
    });

    test("1.2 TaskApprovalProcess & TaskApprovalStep: verifies multi-step hierarchy and reviewer assignments", async () => {
      const task = await prisma.task.create({
        data: {
          code: `QA-APPROVAL-INT-${testRunId}`,
          title: "Kiểm tra toàn vẹn quy trình phê duyệt",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(task.id);

      const process = await prisma.taskApprovalProcess.create({
        data: {
          taskId: task.id,
          status: ApprovalProcessStatus.IN_REVIEW,
          totalSteps: 2,
          currentStepIndex: 1,
        },
      });

      const step1 = await prisma.taskApprovalStep.create({
        data: {
          processId: process.id,
          stepOrder: 1,
          title: "Trưởng phòng xét duyệt",
          reviewerUserId: deptHeadUser.id,
          reviewerAssignmentId: positionAssignment.id,
          status: ApprovalStepStatus.APPROVED,
          decisionNote: "Hồ sơ đạt yêu cầu",
          decidedAt: new Date(),
        },
      });

      const step2 = await prisma.taskApprovalStep.create({
        data: {
          processId: process.id,
          stepOrder: 2,
          title: "Ban Giám Hiệu phê duyệt",
          reviewerUserId: executiveUser.id,
          status: ApprovalStepStatus.PENDING,
        },
      });

      // Query from Task through Process to Steps and Reviewers
      const taskWithApproval = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
          approvalProcesses: {
            include: {
              steps: {
                orderBy: { stepOrder: "asc" },
                include: {
                  reviewerUser: true,
                  reviewerAssignment: {
                    include: { positionDefinition: true },
                  },
                },
              },
            },
          },
        },
      });

      assert.ok(taskWithApproval);
      assert.equal(taskWithApproval.approvalProcesses.length, 1);
      const proc = taskWithApproval.approvalProcesses[0];
      assert.equal(proc.totalSteps, 2);
      assert.equal(proc.steps.length, 2);

      assert.equal(proc.steps[0].id, step1.id);
      assert.equal(proc.steps[0].reviewerUserId, deptHeadUser.id);
      assert.equal(proc.steps[0].reviewerAssignment?.positionDefinition.group, "LDPU");
      assert.equal(proc.steps[0].status, ApprovalStepStatus.APPROVED);

      assert.equal(proc.steps[1].id, step2.id);
      assert.equal(proc.steps[1].reviewerUserId, executiveUser.id);
      assert.equal(proc.steps[1].status, ApprovalStepStatus.PENDING);

      // Verify reverse relation: PositionAssignment.taskApprovalSteps
      const paWithSteps = await prisma.positionAssignment.findUnique({
        where: { id: positionAssignment.id },
        include: { taskApprovalSteps: true },
      });
      assert.ok(paWithSteps?.taskApprovalSteps.some((s) => s.id === step1.id));
    });

    test("1.3 TaskResult: verifies submission, audit verifier relation, and timestamps", async () => {
      const task = await prisma.task.create({
        data: {
          code: `QA-RESULT-INT-${testRunId}`,
          title: "Kiểm tra toàn vẹn TaskResult",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(task.id);

      const result = await prisma.taskResult.create({
        data: {
          taskId: task.id,
          submittedByUserId: driUser1.id,
          summary: "Hoàn tất báo cáo thống kê tuyển sinh",
          reportUrl: "https://qcet.edu.vn/reports/tuyensinh.pdf",
          verifiedByUserId: auditorUser.id,
          verifiedAt: new Date(),
        },
      });

      const fetchedResult = await prisma.taskResult.findUnique({
        where: { id: result.id },
        include: {
          task: true,
          submittedByUser: true,
          verifiedByUser: true,
        },
      });

      assert.ok(fetchedResult);
      assert.equal(fetchedResult.taskId, task.id);
      assert.equal(fetchedResult.submittedByUserId, driUser1.id);
      assert.equal(fetchedResult.submittedByUser.name, driUser1.name);
      assert.equal(fetchedResult.verifiedByUserId, auditorUser.id);
      assert.equal(fetchedResult.verifiedByUser?.name, auditorUser.name);
      assert.ok(fetchedResult.verifiedAt instanceof Date);

      // Reverse user relation check
      const submitter = await prisma.user.findUnique({
        where: { id: driUser1.id },
        include: { taskResultsSubmitted: true },
      });
      assert.ok(submitter?.taskResultsSubmitted.some((r) => r.id === result.id));

      const verifier = await prisma.user.findUnique({
        where: { id: auditorUser.id },
        include: { taskResultsVerified: true },
      });
      assert.ok(verifier?.taskResultsVerified.some((r) => r.id === result.id));
    });

    test("1.4 TaskRelation: verifies directional graph dependencies and compound unique constraint", async () => {
      const taskAlpha = await prisma.task.create({
        data: {
          code: `QA-REL-ALPHA-${testRunId}`,
          title: "Nhiệm vụ nguồn Alpha",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(taskAlpha.id);

      const taskBeta = await prisma.task.create({
        data: {
          code: `QA-REL-BETA-${testRunId}`,
          title: "Nhiệm vụ đích Beta",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(taskBeta.id);

      // Create relation: Alpha BLOCKS Beta
      const relationBlocks = await prisma.taskRelation.create({
        data: {
          sourceTaskId: taskAlpha.id,
          targetTaskId: taskBeta.id,
          relationType: TaskRelationType.BLOCKS,
        },
      });

      // Create relation: Beta DEPENDS_ON Alpha
      const relationDepends = await prisma.taskRelation.create({
        data: {
          sourceTaskId: taskBeta.id,
          targetTaskId: taskAlpha.id,
          relationType: TaskRelationType.DEPENDS_ON,
        },
      });

      assert.ok(relationBlocks.id);
      assert.ok(relationDepends.id);

      // Test bidirectional querying
      const alphaWithRelations = await prisma.task.findUnique({
        where: { id: taskAlpha.id },
        include: {
          sourceRelations: true,
          targetRelations: true,
        },
      });

      assert.equal(alphaWithRelations?.sourceRelations.length, 1);
      assert.equal(alphaWithRelations?.sourceRelations[0].targetTaskId, taskBeta.id);
      assert.equal(alphaWithRelations?.targetRelations.length, 1);
      assert.equal(alphaWithRelations?.targetRelations[0].sourceTaskId, taskBeta.id);

      // Compound unique constraint enforcement: @@unique([sourceTaskId, targetTaskId, relationType])
      // Attempting to create duplicate (taskAlpha, taskBeta, BLOCKS) must throw P2002
      await assert.rejects(
        async () => {
          await prisma.taskRelation.create({
            data: {
              sourceTaskId: taskAlpha.id,
              targetTaskId: taskBeta.id,
              relationType: TaskRelationType.BLOCKS,
            },
          });
        },
        (err: any) => {
          assert.equal(err.code, "P2002", "Must throw Prisma unique constraint violation (P2002)");
          return true;
        }
      );
    });
  });

  // =========================================================================
  // SUB-SUITE 2: Single DRI Invariant at Database & Service Levels
  // =========================================================================
  describe("2. Single DRI Invariant at Database & Service Levels", () => {
    let driTask: any;

    before(async () => {
      driTask = await prisma.task.create({
        data: {
          code: `QA-SINGLE-DRI-${testRunId}`,
          title: "Kiểm tra Single DRI Invariant",
          createdById: creatorUser.id,
          leadUnitId: orgUnit.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(driTask.id);

      // Initialize ASSIGNER
      await prisma.taskActor.create({
        data: {
          taskId: driTask.id,
          userId: creatorUser.id,
          role: TaskActorRole.ASSIGNER,
          isPrimaryDRI: false,
        },
      });
    });

    test("2.1 Service Level: Initial DRI appointment establishes single active primary DRI", async () => {
      // Creator appoints driUser1 as primary DRI
      const driActor = await setTaskDRI(
        driTask.id,
        driUser1.id,
        { requestedById: creatorUser.id },
        orgUnit.id
      );

      assert.equal(driActor.role, TaskActorRole.DRI);
      assert.equal(driActor.isPrimaryDRI, true);
      assert.equal(driActor.userId, driUser1.id);

      const isSingleDRI = await validateSingleDRI(driTask.id);
      assert.equal(isSingleDRI, true, "validateSingleDRI must return true when exactly 1 primary DRI exists");
    });

    test("2.2 Service Level: Reassigning DRI atomically demotes previous DRI to COLLABORATOR", async () => {
      // Dept Head reassigns DRI to driUser2
      const newDriActor = await setTaskDRI(
        driTask.id,
        driUser2.id,
        { requestedById: deptHeadUser.id },
        orgUnit.id
      );

      assert.equal(newDriActor.userId, driUser2.id);
      assert.equal(newDriActor.isPrimaryDRI, true);

      // Previous DRI (driUser1) must now be COLLABORATOR and not primary
      const oldDri = await prisma.taskActor.findFirst({
        where: {
          taskId: driTask.id,
          userId: driUser1.id,
        },
      });

      assert.ok(oldDri);
      assert.equal(oldDri.role, TaskActorRole.COLLABORATOR);
      assert.equal(oldDri.isPrimaryDRI, false);

      const isSingleDRI = await validateSingleDRI(driTask.id);
      assert.equal(isSingleDRI, true, "Single DRI invariant must hold post-reassignment");
    });

    test("2.3 Service Level: Unauthorized actors cannot reassign or alter DRI", async () => {
      // Collaborator (collaboratorUser) is forbidden from calling setTaskDRI
      await addTaskCollaborator(driTask.id, collaboratorUser.id, {
        requestedById: creatorUser.id,
      });

      await assert.rejects(
        async () => {
          await setTaskDRI(
            driTask.id,
            driUser1.id,
            { requestedById: collaboratorUser.id }
          );
        },
        (err: any) => {
          assert.ok(err instanceof TaskActorAuthorizationError);
          assert.ok(err.message.includes("Collaborators cannot reassign DRI"));
          return true;
        }
      );
    });

    test("2.4 Service Level: Cannot add primary DRI as a collaborator without prior reassignment", async () => {
      // driUser2 is currently primary DRI
      await assert.rejects(
        async () => {
          await addTaskCollaborator(driTask.id, driUser2.id, {
            requestedById: creatorUser.id,
          });
        },
        (err: any) => {
          assert.ok(err instanceof TaskActorAuthorizationError);
          assert.ok(err.message.includes("Cannot add primary DRI as collaborator"));
          return true;
        }
      );
    });

    test("2.5 Database/Validation Level: Detects invariant breach if multiple primary DRIs exist directly in DB", async () => {
      const corruptedTask = await prisma.task.create({
        data: {
          code: `QA-CORRUPTED-DRI-${testRunId}`,
          title: "Kiểm tra phát hiện vi phạm Single DRI",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(corruptedTask.id);

      // Initially 0 DRIs
      const zeroDriCheck = await validateSingleDRI(corruptedTask.id);
      assert.equal(zeroDriCheck, false, "Task with 0 DRIs must fail Single DRI validation");

      // Insert 2 primary DRIs directly via DB
      await prisma.taskActor.create({
        data: {
          taskId: corruptedTask.id,
          userId: driUser1.id,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
        },
      });

      await prisma.taskActor.create({
        data: {
          taskId: corruptedTask.id,
          userId: driUser2.id,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
        },
      });

      // Invariant check must detect violation and return false
      const multipleDriCheck = await validateSingleDRI(corruptedTask.id);
      assert.equal(multipleDriCheck, false, "Task with multiple primary DRIs must fail Single DRI validation");

      // Clean up corrupted task immediately so it does not pollute subsequent tests
      await prisma.taskActor.deleteMany({ where: { taskId: corruptedTask.id } });
      await prisma.task.delete({ where: { id: corruptedTask.id } });
      const idx = createdTaskIds.indexOf(corruptedTask.id);
      if (idx !== -1) createdTaskIds.splice(idx, 1);
    });

    test("2.6 Database & Service Levels: Multiple DRI assignment attempts maintain Single DRI Invariant in DB", async () => {
      // Create a dedicated task for sequential DRI assignment verification
      const multiAssignTask = await prisma.task.create({
        data: {
          code: `QA-MULTI-ASSIGN-DRI-${testRunId}`,
          title: "Kiểm tra gán DRI nhiều lần duy trì Single DRI",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(multiAssignTask.id);

      // Attempt 1: Assign driUser1 as primary DRI
      await setTaskDRI(
        multiAssignTask.id,
        driUser1.id,
        { requestedById: creatorUser.id }
      );

      // Verify exactly 1 primary DRI in DB
      let activeDris = await prisma.taskActor.findMany({
        where: {
          taskId: multiAssignTask.id,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
        },
      });
      assert.equal(activeDris.length, 1);
      assert.equal(activeDris[0].userId, driUser1.id);
      assert.equal(await validateSingleDRI(multiAssignTask.id), true);

      // Attempt 2: Assign driUser2 as primary DRI
      await setTaskDRI(
        multiAssignTask.id,
        driUser2.id,
        { requestedById: creatorUser.id }
      );

      // Verify still exactly 1 primary DRI in DB, and previous DRI is COLLABORATOR
      activeDris = await prisma.taskActor.findMany({
        where: {
          taskId: multiAssignTask.id,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
        },
      });
      assert.equal(activeDris.length, 1);
      assert.equal(activeDris[0].userId, driUser2.id);
      assert.equal(await validateSingleDRI(multiAssignTask.id), true);

      // Attempt 3: Assign deptHeadUser as primary DRI
      await setTaskDRI(
        multiAssignTask.id,
        deptHeadUser.id,
        { requestedById: creatorUser.id }
      );

      activeDris = await prisma.taskActor.findMany({
        where: {
          taskId: multiAssignTask.id,
          role: TaskActorRole.DRI,
          isPrimaryDRI: true,
        },
      });
      assert.equal(activeDris.length, 1);
      assert.equal(activeDris[0].userId, deptHeadUser.id);
      assert.equal(await validateSingleDRI(multiAssignTask.id), true);

      // Database-level SQL invariant check: verify no task in task_actors has > 1 active primary DRI
      const violationCount = await prisma.$queryRaw<Array<{ task_id: string; count: bigint }>>`
        SELECT task_id, COUNT(*) as count
        FROM task_actors
        WHERE role = 'DRI'::"TaskActorRole" AND is_primary_dri = true
        GROUP BY task_id
        HAVING COUNT(*) > 1
      `;
      assert.equal(
        violationCount.length,
        0,
        "Database integrity assertion: No task may ever have more than 1 active primary DRI"
      );
    });
  });

  // =========================================================================
  // SUB-SUITE 3: Cascade Deletion
  // =========================================================================
  describe("3. Cascade Deletion", () => {
    test("3.1 Deleting a Task cascades to TaskActor, TaskApprovalProcess, TaskApprovalStep, TaskResult, and TaskRelations", async () => {
      // Create main task to be deleted
      const targetCascadeTask = await prisma.task.create({
        data: {
          code: `QA-CASCADE-TARGET-${testRunId}`,
          title: "Nhiệm vụ kiểm thử cascade delete",
          createdById: creatorUser.id,
          leadUnitId: orgUnit.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      // Do NOT push to createdTaskIds because it will be deleted within the test

      // Create neighboring tasks for relation verification
      const upstreamTask = await prisma.task.create({
        data: {
          code: `QA-CASCADE-UPSTREAM-${testRunId}`,
          title: "Nhiệm vụ phía trước",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(upstreamTask.id);

      const downstreamTask = await prisma.task.create({
        data: {
          code: `QA-CASCADE-DOWNSTREAM-${testRunId}`,
          title: "Nhiệm vụ phía sau",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(downstreamTask.id);

      const taskId = targetCascadeTask.id;

      // 1. Create multiple TaskActors
      await prisma.taskActor.createMany({
        data: [
          {
            taskId,
            userId: creatorUser.id,
            role: TaskActorRole.ASSIGNER,
            isPrimaryDRI: false,
          },
          {
            taskId,
            userId: driUser1.id,
            role: TaskActorRole.DRI,
            isPrimaryDRI: true,
          },
          {
            taskId,
            userId: collaboratorUser.id,
            role: TaskActorRole.COLLABORATOR,
            isPrimaryDRI: false,
          },
        ],
      });

      // 2. Create TaskApprovalProcess with 2 TaskApprovalSteps
      const process = await prisma.taskApprovalProcess.create({
        data: {
          taskId,
          status: ApprovalProcessStatus.IN_REVIEW,
          totalSteps: 2,
        },
      });
      const processId = process.id;

      await prisma.taskApprovalStep.createMany({
        data: [
          {
            processId,
            stepOrder: 1,
            title: "Bước xét duyệt 1",
            reviewerUserId: deptHeadUser.id,
            status: ApprovalStepStatus.APPROVED,
          },
          {
            processId,
            stepOrder: 2,
            title: "Bước xét duyệt 2",
            reviewerUserId: executiveUser.id,
            status: ApprovalStepStatus.PENDING,
          },
        ],
      });

      // 3. Create TaskResults
      await prisma.taskResult.createMany({
        data: [
          {
            taskId,
            submittedByUserId: driUser1.id,
            summary: "Báo cáo tiến độ sơ bộ",
          },
          {
            taskId,
            submittedByUserId: driUser1.id,
            summary: "Báo cáo nghiệm thu hoàn chỉnh",
            verifiedByUserId: deptHeadUser.id,
            verifiedAt: new Date(),
          },
        ],
      });

      // 4. Create TaskRelations:
      // Upstream -> BLOCKS -> Target
      await prisma.taskRelation.create({
        data: {
          sourceTaskId: upstreamTask.id,
          targetTaskId: taskId,
          relationType: TaskRelationType.BLOCKS,
        },
      });

      // Target -> BLOCKS -> Downstream
      await prisma.taskRelation.create({
        data: {
          sourceTaskId: taskId,
          targetTaskId: downstreamTask.id,
          relationType: TaskRelationType.BLOCKS,
        },
      });

      // Pre-deletion checks: confirm records exist
      const preActors = await prisma.taskActor.count({ where: { taskId } });
      const preProcesses = await prisma.taskApprovalProcess.count({ where: { taskId } });
      const preSteps = await prisma.taskApprovalStep.count({ where: { processId } });
      const preResults = await prisma.taskResult.count({ where: { taskId } });
      const preRelSource = await prisma.taskRelation.count({ where: { sourceTaskId: taskId } });
      const preRelTarget = await prisma.taskRelation.count({ where: { targetTaskId: taskId } });

      assert.equal(preActors, 3);
      assert.equal(preProcesses, 1);
      assert.equal(preSteps, 2);
      assert.equal(preResults, 2);
      assert.equal(preRelSource, 1);
      assert.equal(preRelTarget, 1);

      // EXECUTE CASCADE DELETION
      await prisma.task.delete({
        where: { id: taskId },
      });

      // Post-deletion verifications
      const postActors = await prisma.taskActor.count({ where: { taskId } });
      assert.equal(postActors, 0, "TaskActors must be completely removed by cascade deletion");

      const postProcesses = await prisma.taskApprovalProcess.count({ where: { taskId } });
      assert.equal(postProcesses, 0, "TaskApprovalProcesses must be completely removed by cascade deletion");

      const postSteps = await prisma.taskApprovalStep.count({ where: { processId } });
      assert.equal(postSteps, 0, "TaskApprovalSteps must be cascaded through TaskApprovalProcess");

      const postResults = await prisma.taskResult.count({ where: { taskId } });
      assert.equal(postResults, 0, "TaskResults must be completely removed by cascade deletion");

      const postRelSource = await prisma.taskRelation.count({ where: { sourceTaskId: taskId } });
      assert.equal(postRelSource, 0, "Outgoing TaskRelations must be completely removed by cascade deletion");

      const postRelTarget = await prisma.taskRelation.count({ where: { targetTaskId: taskId } });
      assert.equal(postRelTarget, 0, "Incoming TaskRelations must be completely removed by cascade deletion");

      // Neighboring tasks and users must remain completely unharmed
      const survivingUpstream = await prisma.task.findUnique({ where: { id: upstreamTask.id } });
      const survivingDownstream = await prisma.task.findUnique({ where: { id: downstreamTask.id } });
      assert.ok(survivingUpstream, "Upstream task must survive deletion");
      assert.ok(survivingDownstream, "Downstream task must survive deletion");

      const survivingUser = await prisma.user.findUnique({ where: { id: driUser1.id } });
      assert.ok(survivingUser, "Related users must remain unaffected");
    });
  });

  // =========================================================================
  // SUB-SUITE 4: Backward Compatibility
  // =========================================================================
  describe("4. Backward Compatibility for Existing Task Queries", () => {
    let legacyTask: any;

    before(async () => {
      legacyTask = await prisma.task.create({
        data: {
          code: `QA-COMPAT-${testRunId}`,
          title: "Nhiệm vụ kiểm tra tương thích ngược",
          description: "Mô tả nhiệm vụ kiểm thử hồi quy",
          createdById: creatorUser.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.HIGH,
          progressPercent: 45,
          dueDate: new Date(Date.now() + 86400000 * 3),
        },
      });
      createdTaskIds.push(legacyTask.id);

      // Legacy assignee link
      await prisma.taskActor.create({
        data: {
          taskId: legacyTask.id,
          userId: driUser1.id,
          role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(),
        },
      });
    });

    test("4.1 Simple Task findUnique and findMany return expected fields without ReBAC includes", async () => {
      const task = await prisma.task.findUnique({
        where: { id: legacyTask.id },
      });

      assert.ok(task);
      assert.equal(task.code, legacyTask.code);
      assert.equal(task.title, legacyTask.title);
      assert.equal(task.status, TaskStatus.IN_PROGRESS);
      assert.equal(task.priority, TaskPriority.HIGH);
      assert.equal(task.progressPercent, 45);
      assert.equal(task.academicMonth, 9);
      assert.equal(task.academicYear, "2026-2027");
      assert.equal(task.originLevel, TaskOriginLevel.SCHOOL); // Schema default check
    });

    test("4.2 Task actors include succeeds (Phase 9: assignees replaced by actors)", async () => {
      const taskWithActors = await prisma.task.findUnique({
        where: { id: legacyTask.id },
        include: {
          actors: {
            include: { user: true },
          },
          createdBy: true,
        },
      });

      assert.ok(taskWithLegacyIncludes);
      assert.equal(taskWithLegacyIncludes.createdBy.id, creatorUser.id);
      assert.equal(taskWithLegacyIncludes.assignees.length, 1);
      assert.equal(taskWithLegacyIncludes.assignees[0].userId, driUser1.id);
      assert.equal(taskWithLegacyIncludes.assignees[0].roleInTask.PRIMARY_OWNER);
      assert.equal((taskWithLegacyIncludes as any).leadUnit?.id ?? taskWithLegacyIncludes.leadUnitId, "P_QLDT");
    });

    test("4.3 Standard CRUD updates on Task operate without requiring ReBAC relations", async () => {
      const updated = await prisma.task.update({
        where: { id: legacyTask.id },
        data: {
          progressPercent: 80,
          status: TaskStatus.IN_PROGRESS,
          title: "Nhiệm vụ kiểm tra tương thích ngược (Đã cập nhật)",
        },
      });

      assert.equal(updated.progressPercent, 80);
      assert.equal(updated.title, "Nhiệm vụ kiểm tra tương thích ngược (Đã cập nhật)");
    });

    test("4.4 Filtering tasks by standard operational parameters yields correct results", async () => {
      const matchedTasks = await prisma.task.findMany({
        where: {
          academicMonth: 9,
          academicYear: "2026-2027",

          code: legacyTask.code,
        },
      });

      assert.equal(matchedTasks.length, 1);
      assert.equal(matchedTasks[0].id, legacyTask.id);
    });
  });

  // =========================================================================
  // SUB-SUITE 5: Backfill Script Idempotency
  // =========================================================================
  describe("5. Backfill Script Idempotency (migrateTaskRelations)", () => {
    let taskWithAssigneeAndDept: any;
    let taskWithLeadUnitOnly: any;
    let taskWithoutAssignee: any;

    before(async () => {
      // 1. Task with legacy assignee, createdById, and departmentId ("P_QLDT")
      taskWithAssigneeAndDept = await prisma.task.create({
        data: {
          code: `QA-MIG-1-${testRunId}`,
          title: "Nhiệm vụ di chuyển 1: Có assignee và phòng ban",
          createdById: creatorUser.id,

          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(taskWithAssigneeAndDept.id);

      await prisma.taskActor.create({
        data: {
          taskId: taskWithAssigneeAndDept.id,
          userId: driUser1.id,
          role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(),
        },
      });

      // 2. Task with createdById and leadUnitId already populated
      taskWithLeadUnitOnly = await prisma.task.create({
        data: {
          code: `QA-MIG-2-${testRunId}`,
          title: "Nhiệm vụ di chuyển 2: Đã có leadUnitId",
          createdById: creatorUser.id,
          leadUnitId: orgUnit.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(taskWithLeadUnitOnly.id);

      // 3. Task with createdById only (no assignee, no dept)
      taskWithoutAssignee = await prisma.task.create({
        data: {
          code: `QA-MIG-3-${testRunId}`,
          title: "Nhiệm vụ di chuyển 3: Chỉ có creator",
          createdById: creatorUser.id,
          academicMonth: 9,
          academicYear: "2026-2027",
          dueDate: new Date(Date.now() + 86400000),
        },
      });
      createdTaskIds.push(taskWithoutAssignee.id);
    });

    test("5.1 First backfill execution correctly materializes DRI, ASSIGNER, and LEAD_UNIT actors", async () => {
      // Run first pass
      const summary1 = await migrateTaskRelations(prisma);
      assert.ok(summary1.totalTasks >= 3, "Scanned tasks count must include test tasks");

      // Verify taskWithAssigneeAndDept
      const actors1 = await prisma.taskActor.findMany({
        where: { taskId: taskWithAssigneeAndDept.id },
      });

      const dri = actors1.find((a) => a.role === TaskActorRole.DRI);
      assert.ok(dri, "Task 1 must have DRI actor");
      assert.equal(dri.userId, driUser1.id);
      assert.equal(dri.isPrimaryDRI, true);

      const assigner = actors1.find((a) => a.role === TaskActorRole.ASSIGNER);
      assert.ok(assigner, "Task 1 must have ASSIGNER actor");
      assert.equal(assigner.userId, creatorUser.id);

      const leadUnit = actors1.find((a) => a.role === TaskActorRole.LEAD_UNIT);
      assert.ok(leadUnit, "Task 1 must have LEAD_UNIT actor");
      assert.equal(leadUnit.unitId, orgUnit.id);

      // Verify leadUnitId was mapped on Task 1
      const updatedTask1 = await prisma.task.findUnique({
        where: { id: taskWithAssigneeAndDept.id },
      });
      assert.equal(updatedTask1?.leadUnitId, orgUnit.id);

      // Verify taskWithLeadUnitOnly has ASSIGNER and LEAD_UNIT
      const actors2 = await prisma.taskActor.findMany({
        where: { taskId: taskWithLeadUnitOnly.id },
      });
      assert.ok(actors2.some((a) => a.role === TaskActorRole.ASSIGNER));
      assert.ok(actors2.some((a) => a.role === TaskActorRole.LEAD_UNIT));

      // Verify taskWithoutAssignee has ASSIGNER
      const actors3 = await prisma.taskActor.findMany({
        where: { taskId: taskWithoutAssignee.id },
      });
      assert.ok(actors3.some((a) => a.role === TaskActorRole.ASSIGNER));
      assert.equal(actors3.length, 1);
    });

    test("5.2 Second and third backfill executions are completely idempotent and produce zero duplicates", async () => {
      // Count actors across test tasks after pass 1
      const testTasksList = [
        taskWithAssigneeAndDept.id,
        taskWithLeadUnitOnly.id,
        taskWithoutAssignee.id,
      ];

      const actorCountAfterPass1 = await prisma.taskActor.count({
        where: { taskId: { in: testTasksList } },
      });

      // RUN PASS 2 (scoped to test tasks for deterministic idempotency)
      const summary2 = await migrateTaskRelations(prisma, { taskIds: testTasksList });
      assert.equal(summary2.driCreatedOrUpdated, 0, "Pass 2 must create/update 0 DRIs");
      assert.equal(summary2.assignerCreated, 0, "Pass 2 must create 0 ASSIGNERs");
      assert.equal(summary2.leadUnitCreated, 0, "Pass 2 must create 0 LEAD_UNITs");
      assert.equal(summary2.tasksUpdatedWithLeadUnit, 0, "Pass 2 must update 0 leadUnitIds");

      // Verify actor count for test tasks is unchanged
      const actorCountAfterPass2 = await prisma.taskActor.count({
        where: { taskId: { in: testTasksList } },
      });
      assert.equal(
        actorCountAfterPass2,
        actorCountAfterPass1,
        "Total actors count must remain identical after Pass 2"
      );

      // RUN PASS 3
      const summary3 = await migrateTaskRelations(prisma, { taskIds: testTasksList });
      assert.equal(summary3.driCreatedOrUpdated, 0, "Pass 3 must create/update 0 DRIs");
      assert.equal(summary3.assignerCreated, 0, "Pass 3 must create 0 ASSIGNERs");
      assert.equal(summary3.leadUnitCreated, 0, "Pass 3 must create 0 LEAD_UNITs");
      assert.equal(summary3.tasksUpdatedWithLeadUnit, 0, "Pass 3 must update 0 leadUnitIds");

      const actorCountAfterPass3 = await prisma.taskActor.count({
        where: { taskId: { in: testTasksList } },
      });
      assert.equal(
        actorCountAfterPass3,
        actorCountAfterPass1,
        "Total actors count must remain identical after Pass 3"
      );

      // Verify no duplicate roles exist per task
      for (const tId of testTasksList) {
        const actors = await prisma.taskActor.findMany({ where: { taskId: tId } });
        const roles = actors.map((a) => a.role);
        const uniqueRoles = new Set(roles);
        assert.equal(
          roles.length,
          uniqueRoles.size,
          `Task ${tId} must have no duplicate actor roles`
        );
      }
    });
  });
});
