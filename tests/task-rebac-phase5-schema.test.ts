import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  TaskActorRole,
  TaskOriginLevel,
  ApprovalProcessStatus,
  ApprovalStepStatus,
  TaskRelationType,
  Prisma,
} from '@prisma/client';

describe('Phase 5.1: Task ReBAC, Approval & Relation Schema Verification', () => {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  test('prisma/schema.prisma defines all 5 Phase 5 required enums', () => {
    const requiredEnums = [
      'enum TaskActorRole',
      'enum TaskOriginLevel',
      'enum ApprovalProcessStatus',
      'enum ApprovalStepStatus',
      'enum TaskRelationType',
    ];

    for (const enumDef of requiredEnums) {
      assert.ok(
        schemaContent.includes(enumDef),
        `Schema must include enum definition: ${enumDef}`
      );
    }
  });

  test('TaskActorRole enum contains all 9 canonical ReBAC roles', () => {
    const expectedRoles = [
      'ASSIGNER',
      'LEAD_UNIT',
      'COORDINATING_UNIT',
      'DRI',
      'COLLABORATOR',
      'FOLLOWER',
      'REVIEWER',
      'APPROVER',
      'OBSERVER',
    ];

    for (const role of expectedRoles) {
      assert.ok(
        role in TaskActorRole,
        `TaskActorRole must contain ${role}`
      );
    }
    assert.equal(Object.keys(TaskActorRole).length, 9);
  });

  test('TaskOriginLevel enum contains SCHOOL, UNIT, PERSONAL', () => {
    const expectedLevels = ['SCHOOL', 'UNIT', 'PERSONAL'];

    for (const level of expectedLevels) {
      assert.ok(
        level in TaskOriginLevel,
        `TaskOriginLevel must contain ${level}`
      );
    }
    assert.equal(Object.keys(TaskOriginLevel).length, 3);
  });

  test('ApprovalProcessStatus enum contains all process lifecycle statuses', () => {
    const expectedStatuses = [
      'NOT_STARTED',
      'IN_REVIEW',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
    ];

    for (const status of expectedStatuses) {
      assert.ok(
        status in ApprovalProcessStatus,
        `ApprovalProcessStatus must contain ${status}`
      );
    }
    assert.equal(Object.keys(ApprovalProcessStatus).length, 5);
  });

  test('ApprovalStepStatus enum contains all step statuses', () => {
    const expectedStepStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'BYPASSED'];

    for (const status of expectedStepStatuses) {
      assert.ok(
        status in ApprovalStepStatus,
        `ApprovalStepStatus must contain ${status}`
      );
    }
    assert.equal(Object.keys(ApprovalStepStatus).length, 4);
  });

  test('TaskRelationType enum contains all relation types', () => {
    const expectedRelationTypes = [
      'BLOCKS',
      'DEPENDS_ON',
      'PARENT_CHILD',
      'DUPLICATE_OF',
      'DERIVED_FROM',
    ];

    for (const relType of expectedRelationTypes) {
      assert.ok(
        relType in TaskRelationType,
        `TaskRelationType must contain ${relType}`
      );
    }
    assert.equal(Object.keys(TaskRelationType).length, 5);
  });

  test('prisma/schema.prisma defines all 5 Phase 5 required models', () => {
    const requiredModels = [
      'model TaskActor',
      'model TaskApprovalProcess',
      'model TaskApprovalStep',
      'model TaskResult',
      'model TaskRelation',
    ];

    for (const modelDef of requiredModels) {
      assert.ok(
        schemaContent.includes(modelDef),
        `Schema must include model definition: ${modelDef}`
      );
    }
  });

  test('TaskActor model has required fields, relations, and indexes', () => {
    const actorSection = schemaContent.match(/model TaskActor\s*\{([^}]+)\}/);
    assert.ok(actorSection, 'model TaskActor must be present');
    const fields = actorSection[1];

    assert.ok(fields.includes('taskId'), 'TaskActor must have taskId');
    assert.ok(fields.includes('userId'), 'TaskActor must have userId');
    assert.ok(fields.includes('unitId'), 'TaskActor must have unitId');
    assert.ok(fields.includes('role'), 'TaskActor must have role');
    assert.ok(fields.includes('isPrimaryDRI'), 'TaskActor must have isPrimaryDRI');
    assert.ok(fields.includes('assignedById'), 'TaskActor must have assignedById');
    assert.ok(fields.includes('appointedAt'), 'TaskActor must have appointedAt');
    assert.ok(fields.includes('notes'), 'TaskActor must have notes');

    assert.ok(fields.includes('@@index([taskId, role])'), 'TaskActor must index [taskId, role]');
    assert.ok(fields.includes('@@index([userId])'), 'TaskActor must index [userId]');
    assert.ok(fields.includes('@@index([unitId])'), 'TaskActor must index [unitId]');
    assert.ok(fields.includes('@@map("task_actors")'), 'TaskActor must map to task_actors table');
  });

  test('TaskApprovalProcess and TaskApprovalStep define multi-step review pipeline', () => {
    const processSection = schemaContent.match(/model TaskApprovalProcess\s*\{([^}]+)\}/);
    assert.ok(processSection, 'model TaskApprovalProcess must be present');
    const pFields = processSection[1];
    assert.ok(pFields.includes('taskId'), 'TaskApprovalProcess must have taskId');
    assert.ok(pFields.includes('status'), 'TaskApprovalProcess must have status');
    assert.ok(pFields.includes('totalSteps'), 'TaskApprovalProcess must have totalSteps');
    assert.ok(pFields.includes('currentStepIndex'), 'TaskApprovalProcess must have currentStepIndex');
    assert.ok(pFields.includes('steps'), 'TaskApprovalProcess must have steps relation');

    const stepSection = schemaContent.match(/model TaskApprovalStep\s*\{([^}]+)\}/);
    assert.ok(stepSection, 'model TaskApprovalStep must be present');
    const sFields = stepSection[1];
    assert.ok(sFields.includes('processId'), 'TaskApprovalStep must have processId');
    assert.ok(sFields.includes('stepOrder'), 'TaskApprovalStep must have stepOrder');
    assert.ok(sFields.includes('title'), 'TaskApprovalStep must have title');
    assert.ok(sFields.includes('reviewerAssignmentId'), 'TaskApprovalStep must have reviewerAssignmentId');
    assert.ok(sFields.includes('reviewerUserId'), 'TaskApprovalStep must have reviewerUserId');
    assert.ok(sFields.includes('status'), 'TaskApprovalStep must have status');
    assert.ok(sFields.includes('decisionNote'), 'TaskApprovalStep must have decisionNote');
    assert.ok(sFields.includes('decidedAt'), 'TaskApprovalStep must have decidedAt');
  });

  test('TaskResult defines deliverable summary and audit verifier', () => {
    const resultSection = schemaContent.match(/model TaskResult\s*\{([^}]+)\}/);
    assert.ok(resultSection, 'model TaskResult must be present');
    const fields = resultSection[1];

    assert.ok(fields.includes('taskId'), 'TaskResult must have taskId');
    assert.ok(fields.includes('submittedByUserId'), 'TaskResult must have submittedByUserId');
    assert.ok(fields.includes('summary'), 'TaskResult must have summary');
    assert.ok(fields.includes('reportUrl'), 'TaskResult must have reportUrl');
    assert.ok(fields.includes('submittedAt'), 'TaskResult must have submittedAt');
    assert.ok(fields.includes('verifiedByUserId'), 'TaskResult must have verifiedByUserId');
    assert.ok(fields.includes('verifiedAt'), 'TaskResult must have verifiedAt');
  });

  test('TaskRelation defines directional dependencies with unique constraint', () => {
    const relSection = schemaContent.match(/model TaskRelation\s*\{([^}]+)\}/);
    assert.ok(relSection, 'model TaskRelation must be present');
    const fields = relSection[1];

    assert.ok(fields.includes('sourceTaskId'), 'TaskRelation must have sourceTaskId');
    assert.ok(fields.includes('targetTaskId'), 'TaskRelation must have targetTaskId');
    assert.ok(fields.includes('relationType'), 'TaskRelation must have relationType');
    assert.ok(
      fields.includes('@@unique([sourceTaskId, targetTaskId, relationType])'),
      'TaskRelation must define @@unique([sourceTaskId, targetTaskId, relationType])'
    );
  });

  test('Task model incorporates additive Phase 5 fields and relations', () => {
    const taskSection = schemaContent.match(/model Task\s*\{([^}]+)\}/);
    assert.ok(taskSection, 'model Task must be present');
    const fields = taskSection[1];

    assert.ok(fields.includes('originLevel'), 'Task must have originLevel');
    assert.ok(fields.includes('leadUnitId'), 'Task must have leadUnitId');
    assert.ok(fields.includes('leadUnit'), 'Task must have leadUnit relation');
    assert.ok(fields.includes('primaryAssignmentId'), 'Task must have primaryAssignmentId');
    assert.ok(fields.includes('primaryAssignment'), 'Task must have primaryAssignment relation');
    assert.ok(fields.includes('actors'), 'Task must have actors relation');
    assert.ok(fields.includes('approvalProcesses'), 'Task must have approvalProcesses relation');
    assert.ok(fields.includes('taskResults'), 'Task must have taskResults relation');
    assert.ok(fields.includes('sourceRelations'), 'Task must have sourceRelations relation');
    assert.ok(fields.includes('targetRelations'), 'Task must have targetRelations relation');
  });

  test('User, OrganizationalUnit, and PositionAssignment have reciprocal relations', () => {
    const userSection = schemaContent.match(/model User\s*\{([^}]+)\}/);
    assert.ok(userSection, 'model User must be present');
    assert.ok(userSection[1].includes('taskActors'), 'User must have taskActors');
    assert.ok(userSection[1].includes('assignedActors'), 'User must have assignedActors');
    assert.ok(userSection[1].includes('taskApprovalSteps'), 'User must have taskApprovalSteps');
    assert.ok(userSection[1].includes('taskResultsSubmitted'), 'User must have taskResultsSubmitted');
    assert.ok(userSection[1].includes('taskResultsVerified'), 'User must have taskResultsVerified');

    const orgSection = schemaContent.match(/model OrganizationalUnit\s*\{([^}]+)\}/);
    assert.ok(orgSection, 'model OrganizationalUnit must be present');
    assert.ok(orgSection[1].includes('leadTasks'), 'OrganizationalUnit must have leadTasks');
    assert.ok(orgSection[1].includes('taskActors'), 'OrganizationalUnit must have taskActors');

    const posSection = schemaContent.match(/model PositionAssignment\s*\{([^}]+)\}/);
    assert.ok(posSection, 'model PositionAssignment must be present');
    assert.ok(posSection[1].includes('primaryTasks'), 'PositionAssignment must have primaryTasks');
    assert.ok(posSection[1].includes('taskApprovalSteps'), 'PositionAssignment must have taskApprovalSteps');
  });

  test('Prisma Client exports all Phase 5 models and scalar field enums', () => {
    assert.ok(Prisma.TaskActorScalarFieldEnum.taskId === 'taskId');
    assert.ok(Prisma.TaskActorScalarFieldEnum.role === 'role');
    assert.ok(Prisma.TaskActorScalarFieldEnum.isPrimaryDRI === 'isPrimaryDRI');

    assert.ok(Prisma.TaskApprovalProcessScalarFieldEnum.status === 'status');
    assert.ok(Prisma.TaskApprovalStepScalarFieldEnum.processId === 'processId');
    assert.ok(Prisma.TaskResultScalarFieldEnum.submittedByUserId === 'submittedByUserId');
    assert.ok(Prisma.TaskRelationScalarFieldEnum.relationType === 'relationType');
    assert.ok(Prisma.TaskScalarFieldEnum.originLevel === 'originLevel');
    assert.ok(Prisma.TaskScalarFieldEnum.leadUnitId === 'leadUnitId');
    assert.ok(Prisma.TaskScalarFieldEnum.primaryAssignmentId === 'primaryAssignmentId');
  });
});
