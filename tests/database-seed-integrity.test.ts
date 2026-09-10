import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';

describe('Database Seed Integrity Contract', () => {
  test('cơ sở dữ liệu phải có đầy đủ người dùng, phòng ban, nhiệm vụ và sổ văn bản sau khi seed', async () => {
    const userCount = await prisma.user.count();
    const deptCount = await prisma.department.count();
    const taskCount = await prisma.task.count();
    const docCount = await prisma.document.count();
    const seqCount = await prisma.documentNumberSequence.count();

    assert.ok(userCount >= 18, `Số lượng người dùng (${userCount}) phải >= 18`);
    assert.ok(deptCount >= 11, `Số lượng phòng ban (${deptCount}) phải >= 11`);
    assert.ok(taskCount >= 40, `Số lượng nhiệm vụ (${taskCount}) phải >= 40`);
    assert.ok(docCount >= 10, `Số lượng văn bản (${docCount}) phải >= 10`);
    assert.ok(seqCount >= 2, `Số lượng bộ đếm số (${seqCount}) phải >= 2`);
  });

  test('văn bản đến phải có liên kết đơn vị chủ trì và ý kiến chỉ đạo', async () => {
    const incomingDoc = await prisma.document.findFirst({
      where: { type: 'VAN_BAN_DEN' },
      include: { leadDepartment: true, directives: true },
    });

    assert.ok(incomingDoc, 'Phải có ít nhất 1 văn bản đến trong DB');
    assert.ok(incomingDoc.leadDepartmentId, 'Văn bản đến phải có đơn vị chủ trì');
  });
});
