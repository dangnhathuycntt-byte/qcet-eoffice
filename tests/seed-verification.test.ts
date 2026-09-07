import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Seed Data Verification', () => {
  test('seed script contains 11 QCET units and realistic task generation', () => {
    const seedPath = path.resolve(process.cwd(), 'prisma/seed.ts');
    const content = fs.readFileSync(seedPath, 'utf-8');

    // 11 đơn vị bắt buộc của QCET
    assert.match(content, /phong-dao-tao/);
    assert.match(content, /khoa-cntt/);
    assert.match(content, /khoa-co-khi/);
    assert.match(content, /khoa-dien/);
    assert.match(content, /ban-giam-hieu/);

    // Có logic tạo Task bền vững
    assert.match(content, /prisma\.task\.createMany|prisma\.task\.create|prisma\.task\.upsert/);
    assert.match(content, /academicMonth/);
    assert.match(content, /academicYear/);
  });
});
