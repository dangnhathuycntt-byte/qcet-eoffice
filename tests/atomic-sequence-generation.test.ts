import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  generateTaskCodeAtomic,
  resetTaskCodeMemorySequences,
} from '../src/lib/task-code-generator';

describe('Atomic Sequence Generation & Race-Free Numbering', () => {
  const testYear = 2088; // Isolated test year to prevent collision with actual operational data

  before(async () => {
    // Clean up test sequences in case of previous interrupted test runs
    await prisma.taskSequence.deleteMany({
      where: { year: { in: [testYear, 2089, 2090] } },
    });
    resetTaskCodeMemorySequences();
  });

  after(async () => {
    // Clean up test sequences after suite execution
    await prisma.taskSequence.deleteMany({
      where: { year: { in: [testYear, 2089, 2090] } },
    });
    resetTaskCodeMemorySequences();
  });

  describe('TaskSequence: Race-Free Atomic Task Code Generation', () => {
    test('concurrency: 30 simultaneous calls generate strictly monotonic, non-colliding NV codes', async () => {
      const month = 4;
      const count = 30;

      const promises = Array.from({ length: count }, () =>
        generateTaskCodeAtomic(prisma, {
          year: testYear,
          month,
          format: 'NV',
        })
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, count, `Expected ${count} task codes`);

      // Check uniqueness
      const uniqueCodes = new Set(results);
      assert.strictEqual(
        uniqueCodes.size,
        count,
        `All ${count} codes must be distinct with zero collisions. Found duplicates: ${JSON.stringify(results)}`
      );

      // Verify format
      for (const code of results) {
        assert.match(code, /^NV-2088-04-\d{3}$/);
      }

      // Verify consecutive sequence from 1 to 30
      const sequenceNumbers = results
        .map((code) => parseInt(code.split('-')[3], 10))
        .sort((a, b) => a - b);

      const expected = Array.from({ length: count }, (_, i) => i + 1);
      assert.deepStrictEqual(
        sequenceNumbers,
        expected,
        'Sequence numbers must be strictly consecutive 1..30 without gaps or duplicates'
      );
    });

    test('concurrency: 20 simultaneous calls for department CV format generate consecutive codes', async () => {
      const dept = 'KHTC';
      const count = 20;

      const promises = Array.from({ length: count }, () =>
        generateTaskCodeAtomic(prisma, {
          year: testYear,
          departmentCode: dept,
          format: 'CV',
        })
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, count);

      const uniqueCodes = new Set(results);
      assert.strictEqual(uniqueCodes.size, count, 'All department codes must be unique');

      const sequenceNumbers = results
        .map((code) => parseInt(code.split('-')[3], 10))
        .sort((a, b) => a - b);

      const expected = Array.from({ length: count }, (_, i) => i + 1);
      assert.deepStrictEqual(sequenceNumbers, expected);
      assert.strictEqual(results[0].startsWith(`CV-${dept}-${testYear}-`), true);
    });

    test('concurrency: works inside Prisma interactive transactions tx', async () => {
      const count = 10;
      const month = 11;

      const promises = Array.from({ length: count }, () =>
        prisma.$transaction(async (tx) => {
          return await generateTaskCodeAtomic(tx, {
            year: testYear,
            month,
            format: 'NV',
          });
        })
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, count);

      const uniqueCodes = new Set(results);
      assert.strictEqual(uniqueCodes.size, count);

      const seqs = results
        .map((c) => parseInt(c.split('-')[3], 10))
        .sort((a, b) => a - b);
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      assert.deepStrictEqual(seqs, expected);
    });

    test('in-memory fallback produces monotonic sequence when database model is unavailable', async () => {
      resetTaskCodeMemorySequences();
      const mockClient = {};
      const count = 25;

      const promises = Array.from({ length: count }, () =>
        generateTaskCodeAtomic(mockClient, {
          year: 2090,
          month: 1,
          format: 'NV',
        })
      );

      const results = await Promise.all(promises);
      assert.strictEqual(new Set(results).size, count);

      const seqs = results
        .map((c) => parseInt(c.split('-')[3], 10))
        .sort((a, b) => a - b);
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      assert.deepStrictEqual(seqs, expected);
    });
  });

});
