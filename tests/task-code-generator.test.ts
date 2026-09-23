import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  generateTaskCodeAtomic,
  generateTaskCode,
  resetTaskCodeMemorySequences,
} from '../src/lib/task-code-generator';

describe('Task Code Generator (Atomic O(1) Sequencing)', () => {
  const testYear = 2026;
  const testMonth = 9;

  before(async () => {
    // Clean up test sequences before testing
    await prisma.taskSequence.deleteMany({
      where: { year: { in: [testYear, 2025, 2099] } },
    });
    resetTaskCodeMemorySequences();
  });

  after(async () => {
    // Clean up test sequences after testing
    await prisma.taskSequence.deleteMany({
      where: { year: { in: [testYear, 2025, 2099] } },
    });
  });

  test('generates sequential task codes in NV format (NV-YYYY-MM-XXX)', async () => {
    // Month 9 might have existing seeded tasks (e.g. NV-2026-09-001..004)
    const code1 = await generateTaskCodeAtomic(prisma, {
      year: testYear,
      month: testMonth,
      format: 'NV',
    });

    const code2 = await generateTaskCodeAtomic(prisma, {
      year: testYear,
      month: testMonth,
      format: 'NV',
    });

    assert.match(code1, /^NV-2026-09-\d{3,}$/);
    assert.match(code2, /^NV-2026-09-\d{3,}$/);

    const seq1 = parseInt(code1.split('-')[3], 10);
    const seq2 = parseInt(code2.split('-')[3], 10);
    assert.strictEqual(seq2, seq1 + 1, 'Subsequent code must increment sequence by 1');
  });

  test('generates task codes in CV format (CV-DEPT-YYYY-XXX)', async () => {
    const dept = 'KHTV';
    const code1 = await generateTaskCodeAtomic(prisma, {
      year: 2099,
      departmentCode: dept,
      format: 'CV',
    });

    const code2 = await generateTaskCodeAtomic(prisma, {
      year: 2099,
      departmentCode: dept,
      format: 'CV',
    });

    assert.strictEqual(code1, 'CV-KHTV-2099-001');
    assert.strictEqual(code2, 'CV-KHTV-2099-002');
  });

  test('concurrency: 10 simultaneous calls generate strictly unique codes with zero duplicates', async () => {
    const concurrentMonth = 12;
    const promises = Array.from({ length: 10 }, () =>
      generateTaskCodeAtomic(prisma, {
        year: 2099,
        month: concurrentMonth,
        format: 'NV',
      })
    );

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 10);

    const uniqueCodes = new Set(results);
    assert.strictEqual(
      uniqueCodes.size,
      10,
      `All 10 codes must be unique, got duplicates: ${JSON.stringify(results)}`
    );

    // Verify all codes conform to format
    for (const code of results) {
      assert.match(code, /^NV-2099-12-\d{3}$/);
    }

    // Verify sequences are strictly 1 to 10
    const sequenceNumbers = results
      .map((c) => parseInt(c.split('-')[3], 10))
      .sort((a, b) => a - b);

    assert.deepStrictEqual(
      sequenceNumbers,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      'Sequences generated under concurrency must span 1 to 10 consecutively'
    );
  });

  test('synchronizes with existing seeded tasks to prevent code collisions', async () => {
    // In year 2026, month 10, existing tasks NV-2026-10-005..008 exist
    // Ensure at least one task with code NV-2026-10-008 exists to verify synchronization
    const existingTask = await prisma.task.findUnique({
      where: { code: 'NV-2026-10-008' },
    });
    let createdTestTask = false;
    if (!existingTask) {
      const dept = await prisma.organizationalUnit.findFirst();
      const user = await prisma.user.findFirst();
      if (dept && user) {
        await prisma.task.create({
          data: {
            code: 'NV-2026-10-008',
            title: 'Test Seed Task for Code Sync',
            leadUnitId: dept.id,
            createdById: user.id,
            academicMonth: 10,
            academicYear: '2026-2027',
            dueDate: new Date('2026-10-31T17:00:00Z'),
          },
        });
        createdTestTask = true;
      }
    }

    // Reset sequence for month 10 to ensure fresh initialization
    await prisma.taskSequence.deleteMany({
      where: {
        year: 2026,
        scope: 'NV',
        departmentCode: 'M10',
      },
    });
    resetTaskCodeMemorySequences();

    try {
      const code = await generateTaskCodeAtomic(prisma, {
        year: 2026,
        month: 10,
        format: 'NV',
      });

      const seq = parseInt(code.split('-')[3], 10);
      assert.ok(
        seq > 8,
        `Generated code seq (${seq}) must be greater than existing seeded tasks (max 8)`
      );
      assert.match(code, /^NV-2026-10-\d{3}$/);
    } finally {
      if (createdTestTask) {
        await prisma.task.deleteMany({ where: { code: 'NV-2026-10-008' } });
      }
    }
  });

  test('performance: execution is O(1) and executes fast (< 25ms per call)', async () => {
    const start = Date.now();
    for (let i = 0; i < 5; i++) {
      await generateTaskCodeAtomic(prisma, {
        year: 2099,
        month: 1,
        format: 'NV',
      });
    }
    const duration = Date.now() - start;
    const avgDuration = duration / 5;
    assert.ok(
      avgDuration < 25,
      `Average duration per atomic generation was ${avgDuration}ms, expected < 25ms`
    );
  });

  test('in-memory fallback works when client has no database taskSequence model', async () => {
    resetTaskCodeMemorySequences();
    const mockClient = {};

    const code1 = await generateTaskCodeAtomic(mockClient, {
      year: 2025,
      month: 5,
      format: 'NV',
    });
    const code2 = await generateTaskCodeAtomic(mockClient, {
      year: 2025,
      month: 5,
      format: 'NV',
    });

    assert.strictEqual(code1, 'NV-2025-05-001');
    assert.strictEqual(code2, 'NV-2025-05-002');
  });

  test('backward-compatible generateTaskCode alias works', async () => {
    const code = await generateTaskCode(prisma, 2099, 3);
    assert.match(code, /^NV-2099-03-\d{3}$/);
  });
});
