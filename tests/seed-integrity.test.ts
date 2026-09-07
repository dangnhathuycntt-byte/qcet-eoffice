import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { AssigneeRole } from '@prisma/client';

describe('Seed Data Integrity and Verification', () => {
  test('seed script contains 11 QCET units, user accounts, and 40 realistic tasks with COLLABORATOR support', () => {
    const seedPath = path.join(process.cwd(), 'prisma', 'seed.ts');
    assert.strictEqual(fs.existsSync(seedPath), true, 'seed.ts must exist');

    const content = fs.readFileSync(seedPath, 'utf8');

    // 1. Verify all 11 compulsory units exist
    const compulsoryUnits = [
      'ban-giam-hieu',
      'phong-dao-tao',
      'phong-cthssv',
      'phong-tckt',
      'phong-qctb',
      'khoa-cntt',
      'khoa-co-khi',
      'khoa-dien',
      'khoa-oto',
      'tt-laixe',
      'tt-tuyensinh'
    ];
    for (const unit of compulsoryUnits) {
      assert.ok(content.includes(unit), `Seed should include compulsory unit: ${unit}`);
    }

    // 2. Verify Key User Accounts
    const keyUsers = [
      'admin@qcet.edu.vn',
      'hieutruong@qcet.edu.vn',
      'truongphong.daotao@qcet.edu.vn',
      'truongkhoa.cntt@qcet.edu.vn',
      'giangvien.cntt@qcet.edu.vn',
      'chuyenvien@qcet.edu.vn'
    ];
    for (const user of keyUsers) {
      assert.ok(content.includes(user), `Seed should include key user account: ${user}`);
    }

    // 3. Verify task count requirement (40 tasks)
    assert.ok(content.includes('NV-2026-09-001'), 'Should contain initial seed task');
    assert.ok(content.includes('NV-2027-08-040'), 'Should contain final seed task (at least 40 tasks)');

    // 4. Verify multi-role assignee support in seed code
    assert.ok(content.includes('collaboratorIds?: string[]'), 'Should support optional collaboratorIds array');
    assert.ok(content.includes('AssigneeRole.COLLABORATOR'), 'Should insert AssigneeRole.COLLABORATOR records');
  });

  test('database contains persisted tasks with PRIMARY_OWNER and COLLABORATOR assignees', async () => {
    // Verify database has tasks
    const taskCount = await prisma.task.count();
    assert.ok(taskCount >= 40, `Expected at least 40 tasks, got ${taskCount}`);

    // Verify database has COLLABORATOR assignees
    const collaboratorCount = await prisma.taskAssignee.count({
      where: { roleInTask: AssigneeRole.COLLABORATOR }
    });
    assert.ok(collaboratorCount >= 10, `Expected at least 10 collaborator assignees, got ${collaboratorCount}`);

    // Verify key collaborative tasks have both PRIMARY_OWNER and COLLABORATOR
    const collaborativeCodes = [
      'NV-2026-09-002', // Cross-department preparation
      'NV-2026-09-003', // DACUM review
      'NV-2026-09-004', // Entrance ceremony
      'NV-2026-10-005', // Maintenance safety audit
      'NV-2026-11-009', // Teaching contest
      'NV-2026-12-015', // Asset audit
      'NV-2027-01-019', // Fire safety audit
      'NV-2027-04-027', // QCET Job Fair
      'NV-2027-07-036', // Commencement ceremony
    ];

    for (const code of collaborativeCodes) {
      const task = await prisma.task.findUnique({
        where: { code },
        include: { assignees: true }
      });
      assert.ok(task, `Task with code ${code} must exist in database`);

      const hasPrimary = task.assignees.some(a => a.roleInTask === AssigneeRole.PRIMARY_OWNER);
      const hasCollab = task.assignees.some(a => a.roleInTask === AssigneeRole.COLLABORATOR);

      assert.strictEqual(hasPrimary, true, `Task ${code} must have a PRIMARY_OWNER`);
      assert.strictEqual(hasCollab, true, `Task ${code} must have at least one COLLABORATOR`);
    }
  });
});
