import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Seed Data Integrity and Verification', () => {
  test('seed script contains 11 QCET units, user accounts, and 40 realistic tasks', () => {
    const seedPath = path.resolve(process.cwd(), 'prisma/seed.ts');
    const content = fs.readFileSync(seedPath, 'utf-8');

    // 11 compulsory QCET units
    const requiredDepartments = [
      'ban-giam-hieu',
      'phong-dao-tao',
      'khoa-cntt',
      'khoa-co-khi',
      'khoa-dien',
      'khoa-oto',
      'phong-cthssv',
      'phong-qctb',
      'phong-tckt',
      'tt-laixe',
      'tt-tuyensinh',
    ];

    for (const deptId of requiredDepartments) {
      assert.match(
        content,
        new RegExp(deptId),
        `Seed script must contain department ID: ${deptId}`
      );
    }

    // Must have sample users for roles
    assert.match(content, /hieutruong@qcet\.edu\.vn|bgh@qcet\.edu\.vn/);
    assert.match(content, /truongphong\.daotao@qcet\.edu\.vn/);
    assert.match(content, /truongkhoa\.cntt@qcet\.edu\.vn/);
    assert.match(content, /giangvien\.cntt@qcet\.edu\.vn/);

    // Must contain task creation logic
    assert.match(content, /prisma\.task\.createMany|prisma\.task\.create|prisma\.task\.upsert/);
    assert.match(content, /academicMonth/);
    assert.match(content, /academicYear/);

    // Verify task count is at least 40
    // Count occurrences of task codes like 'NV-2026-...' or 'NV-2027-...' in sampleTasks array
    const taskCodeMatches = content.match(/code:\s*['"`]NV-(?:2026|2027)-[^'"`]+['"`]/g);
    assert.ok(
      taskCodeMatches && taskCodeMatches.length >= 40,
      `Seed script must contain at least 40 tasks, but found ${taskCodeMatches ? taskCodeMatches.length : 0}`
    );
  });
});
