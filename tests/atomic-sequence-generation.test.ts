import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  generateTaskCodeAtomic,
  generateTaskCode,
  generateTaskCodeRawSql,
  resetTaskCodeMemorySequences,
} from '../src/lib/task-code-generator';
import {
  getNextRegistrationNumber,
  getNextRegistrationNumberRawSql,
  formatDocumentDisplayNumber,
  formatRegistrationNumber,
  generateDocumentCode,
  resetDocumentMemorySequences,
  simulateAtomicNumbering,
} from '../src/lib/document-numbering';

describe('Atomic Sequence Generation & Race-Free Numbering', () => {
  const testYear = 2088; // Isolated test year to prevent collision with actual operational data

  before(async () => {
    // Clean up test sequences in case of previous interrupted test runs
    await prisma.taskSequence.deleteMany({
      where: { year: { in: [testYear, 2089, 2090] } },
    });
    await prisma.documentNumberSequence.deleteMany({
      where: { year: { in: [testYear, 2089, 2090] } },
    });
    resetTaskCodeMemorySequences();
    resetDocumentMemorySequences();
  });

  after(async () => {
    // Clean up test sequences after suite execution
    await prisma.taskSequence.deleteMany({
      where: { year: { in: [testYear, 2089, 2090] } },
    });
    await prisma.documentNumberSequence.deleteMany({
      where: { year: { in: [testYear, 2089, 2090] } },
    });
    resetTaskCodeMemorySequences();
    resetDocumentMemorySequences();
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

    test('concurrency: raw SQL atomic sequence generation works concurrently', async () => {
      const month = 8;
      const count = 15;

      const promises = Array.from({ length: count }, () =>
        generateTaskCodeRawSql(prisma, {
          year: testYear,
          month,
          format: 'NV',
        })
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, count);

      const uniqueCodes = new Set(results);
      assert.strictEqual(uniqueCodes.size, count, 'All raw SQL generated codes must be unique');

      const seqs = results
        .map((c) => parseInt(c.split('-')[3], 10))
        .sort((a, b) => a - b);
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      assert.deepStrictEqual(seqs, expected);
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

  describe('DocumentNumberSequence: Race-Free Document Numbering (ND 30/2020)', () => {
    test('concurrency: 30 simultaneous calls for VAN_BAN_DEN produce strictly unique numbers 1..30', async () => {
      const count = 30;

      const promises = Array.from({ length: count }, () =>
        getNextRegistrationNumber('VAN_BAN_DEN', testYear, prisma)
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, count);

      const uniqueNumbers = new Set(results);
      assert.strictEqual(
        uniqueNumbers.size,
        count,
        `All ${count} registration numbers must be distinct under concurrent load`
      );

      const sorted = [...results].sort((a, b) => a - b);
      const expected = Array.from({ length: count }, (_, i) => i + 1);
      assert.deepStrictEqual(
        sorted,
        expected,
        'Sequence numbers must be strictly monotonic 1..30'
      );
    });

    test('concurrency: distinct document types maintain independent monotonic sequences', async () => {
      const count = 15;

      const [inboxResults, outboxResults, submissionResults] = await Promise.all([
        Promise.all(
          Array.from({ length: count }, () =>
            getNextRegistrationNumber('VAN_BAN_DEN', testYear, prisma)
          )
        ),
        Promise.all(
          Array.from({ length: count }, () =>
            getNextRegistrationNumber('VAN_BAN_DI', testYear, prisma)
          )
        ),
        Promise.all(
          Array.from({ length: count }, () =>
            getNextRegistrationNumber('TO_TRINH_NOI_BO', testYear, prisma)
          )
        ),
      ]);

      // Inbox was already at 30 from previous test, so it should be 31..45
      const inboxSorted = [...inboxResults].sort((a, b) => a - b);
      assert.deepStrictEqual(
        inboxSorted,
        Array.from({ length: count }, (_, i) => 31 + i)
      );

      // Outbox and submission start fresh at 1..15
      const outboxSorted = [...outboxResults].sort((a, b) => a - b);
      const submissionSorted = [...submissionResults].sort((a, b) => a - b);

      const expectedFresh = Array.from({ length: count }, (_, i) => 1 + i);
      assert.deepStrictEqual(outboxSorted, expectedFresh);
      assert.deepStrictEqual(submissionSorted, expectedFresh);
    });

    test('concurrency: getNextRegistrationNumber executes safely inside interactive transaction tx', async () => {
      const count = 10;

      const promises = Array.from({ length: count }, () =>
        prisma.$transaction(async (tx) => {
          // tx has no tx.$transaction, so getNextRegistrationNumber must operate directly on tx
          return await getNextRegistrationNumber('VAN_BAN_DI', testYear, tx);
        })
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, count);

      const uniqueNumbers = new Set(results);
      assert.strictEqual(uniqueNumbers.size, count);

      // Outbox was at 15, so these 10 must be 16..25
      const sorted = [...results].sort((a, b) => a - b);
      assert.deepStrictEqual(
        sorted,
        Array.from({ length: count }, (_, i) => 16 + i)
      );
    });

    test('concurrency: raw SQL atomic document numbering works without race conditions', async () => {
      const count = 10;

      const promises = Array.from({ length: count }, () =>
        getNextRegistrationNumberRawSql('TO_TRINH_NOI_BO', testYear, prisma)
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, count);

      const uniqueNumbers = new Set(results);
      assert.strictEqual(uniqueNumbers.size, count);

      // TO_TRINH_NOI_BO was at 15, so these 10 must be 16..25
      const sorted = [...results].sort((a, b) => a - b);
      assert.deepStrictEqual(
        sorted,
        Array.from({ length: count }, (_, i) => 16 + i)
      );
    });

    test('in-memory fallback generates unique monotonic sequence numbers', async () => {
      resetDocumentMemorySequences();
      const count = 20;

      const promises = Array.from({ length: count }, () =>
        simulateAtomicNumbering('VAN_BAN_DEN', 2090)
      );

      const results = await Promise.all(promises);
      assert.strictEqual(new Set(results).size, count);

      const sorted = [...results].sort((a, b) => a - b);
      assert.deepStrictEqual(
        sorted,
        Array.from({ length: count }, (_, i) => 1 + i)
      );
    });
  });

  describe('Document Numbering Formatting (Decree 30/2020/ND-CP)', () => {
    test('formats incoming and outgoing documents with correct padding and authority', () => {
      assert.strictEqual(formatDocumentDisplayNumber('VAN_BAN_DEN', 1, 2026), '01');
      assert.strictEqual(formatDocumentDisplayNumber('VAN_BAN_DEN', 9, 2026), '09');
      assert.strictEqual(formatDocumentDisplayNumber('VAN_BAN_DEN', 10, 2026), '10');
      assert.strictEqual(formatDocumentDisplayNumber('VAN_BAN_DEN', 125, 2026), '125');

      assert.strictEqual(formatDocumentDisplayNumber('VAN_BAN_DI', 89, 2026, 'CĐKTCN-ĐT'), '89/CĐKTCN-ĐT');
      assert.strictEqual(formatDocumentDisplayNumber('VAN_BAN_DI', 12, 2026), '12/CĐKTCN');

      assert.strictEqual(formatDocumentDisplayNumber('TO_TRINH_NOI_BO', 5, 2026), 'TT-5/2026');
      assert.strictEqual(formatRegistrationNumber('TO_TRINH_NOI_BO', 5, 2026), 'TT-5/2026');
    });

    test('generates standardized document reference codes', () => {
      assert.strictEqual(generateDocumentCode('VAN_BAN_DEN', 2026, 1), 'VBDEN-2026-0001');
      assert.strictEqual(generateDocumentCode('VAN_BAN_DI', 2026, 89), 'VBDI-2026-0089');
      assert.strictEqual(generateDocumentCode('TO_TRINH_NOI_BO', 2026, 5), 'TTNB-2026-0005');
    });
  });
});
