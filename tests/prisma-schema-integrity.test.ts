import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Prisma Schema Integrity Verification', () => {
  test('schema.prisma contains all required e-office models and enums', () => {
    const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const content = fs.readFileSync(schemaPath, 'utf-8');

    // Kiểm tra các Enums bắt buộc
    assert.match(content, /enum TaskScope\s*\{[\s\S]*?SCHOOL[\s\S]*?DEPARTMENT[\s\S]*?INDIVIDUAL/);
    assert.match(content, /enum TaskStatus\s*\{[\s\S]*?NOT_STARTED[\s\S]*?IN_PROGRESS[\s\S]*?WAITING_APPROVAL[\s\S]*?COMPLETED[\s\S]*?OVERDUE/);
    assert.match(content, /enum AssigneeRole\s*\{[\s\S]*?PRIMARY_OWNER[\s\S]*?COLLABORATOR[\s\S]*?SUPERVISOR/);
    assert.match(content, /enum DeliverableReviewStatus\s*\{[\s\S]*?PENDING[\s\S]*?APPROVED[\s\S]*?REVISION_REQUIRED/);
    assert.match(content, /enum ResolutionType\s*\{[\s\S]*?EXTEND_DEADLINE[\s\S]*?REASSIGN_OWNER[\s\S]*?DIRECTIVE_NOTE/);

    // Kiểm tra các Models bắt buộc
    assert.match(content, /model Task\s*\{/);
    assert.match(content, /model TaskAssignee\s*\{/);
    assert.match(content, /model TaskDeliverable\s*\{/);
    assert.match(content, /model DacumDelegation\s*\{/);
    assert.match(content, /model ExecutiveResolution\s*\{/);

    // Kiểm tra khóa ngoại và quan hệ
    assert.match(content, /department\s+Department\?\s+@relation/);
    assert.match(content, /createdBy\s+User\s+@relation\("TaskCreatedBy"/);
    assert.match(content, /assignees\s+TaskAssignee\[\]/);
    assert.match(content, /deliverables\s+TaskDeliverable\[\]/);
  });
});
