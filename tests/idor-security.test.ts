import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as getTask, PATCH as patchTask, DELETE as deleteTask } from '../src/app/api/tasks/[id]/route';
import { GET as getFile } from '../src/app/api/files/[...path]/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { TaskScope, TaskPriority, TaskStatus, TaskActorRole } from '@prisma/client';

const TEST_UPLOADS_DIR = path.resolve('./test_idor_sandbox');

describe('IDOR & Resource-Level Authorization Security Tests (Issue #28)', () => {
  let userA: any;
  let userB: any;
  let rectorUser: any;

  let tokenA: string;
  let tokenB: string;
  let tokenRector: string;

  let deptA: any;
  let deptB: any;

  let orgUnitRector: any;
  let posDefRector: any;
  let posAssignRector: any;

  let taskB: any;
  let taskA: any;
  let fileBUrl: string;

  const originalUploadsDir = process.env.UPLOADS_DIR;

  before(async () => {
    process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
    fs.mkdirSync(path.join(TEST_UPLOADS_DIR, 'tasks/2026'), { recursive: true });

    const rand = crypto.randomBytes(4).toString('hex');

    // Tạo hai phòng ban độc lập
    deptA = await prisma.department.create({
      data: {
        id: `DEPT_A_${rand}`,
        name: 'Phòng Tổ chức Cán bộ A',
      },
    });

    deptB = await prisma.department.create({
      data: {
        id: `DEPT_B_${rand}`,
        name: 'Phòng Kế hoạch Tài chính B',
      },
    });

    // Tạo User A (Chuyên viên phòng A)
    userA = await prisma.user.create({
      data: {
        email: `user_a_${rand}@qcet.edu.vn`,
        name: 'Chuyên viên User A',
        role: 'CHUYEN_VIEN',
        departmentId: deptA.id,
        isActive: true,
      },
    });

    // Tạo User B (Chuyên viên phòng B)
    userB = await prisma.user.create({
      data: {
        email: `user_b_${rand}@qcet.edu.vn`,
        name: 'Chuyên viên User B',
        role: 'CHUYEN_VIEN',
        departmentId: deptB.id,
        isActive: true,
      },
    });

    // Tạo Lãnh đạo cấp cao (Hiệu trưởng / Ban Giám Hiệu) với PositionAssignment hợp lệ
    orgUnitRector = await prisma.organizationalUnit.create({
      data: {
        code: `BGH_UNIT_${rand}`,
        name: 'Ban Giám Hiệu Trường',
        type: 'SCHOOL',
        status: 'ACTIVE',
      },
    });

    posDefRector = await prisma.positionDefinition.upsert({
      where: { code: 'HIEU_TRUONG' },
      update: { isLeadership: true },
      create: {
        code: 'HIEU_TRUONG',
        title: 'Hiệu trưởng',
        group: 'LDPU',
        isLeadership: true,
      },
    });

    rectorUser = await prisma.user.create({
      data: {
        email: `rector_${rand}@qcet.edu.vn`,
        name: 'Hiệu trưởng Trường',
        role: 'BAN_GIAM_HIEU',
        isActive: true,
      },
    });

    posAssignRector = await prisma.positionAssignment.create({
      data: {
        userId: rectorUser.id,
        positionDefinitionId: posDefRector.id,
        unitId: orgUnitRector.id,
        type: 'PRIMARY',
        status: 'ACTIVE',
        effectiveFrom: new Date('2020-01-01'),
      },
    });

    tokenA = signSessionToken({
      id: userA.id,
      email: userA.email,
      name: userA.name,
      role: userA.role,
      departmentId: userA.departmentId,
    });

    tokenB = signSessionToken({
      id: userB.id,
      email: userB.email,
      name: userB.name,
      role: userB.role,
      departmentId: userB.departmentId,
    });

    tokenRector = signSessionToken({
      id: rectorUser.id,
      email: rectorUser.email,
      name: rectorUser.name,
      role: rectorUser.role,
    });

    // Tạo Task A của User A
    taskA = await prisma.task.create({
      data: {
        code: `NV-A-${rand}`,
        title: 'Nhiệm vụ riêng của User A',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.IN_PROGRESS,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-11-01'),
        createdById: userA.id,
        departmentId: deptA.id,
        actors: {
          create: [
            {
              userId: userA.id,
              role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(),
            },
          ],
        },
      },
    });

    // Tạo Task B của User B
    taskB = await prisma.task.create({
      data: {
        code: `NV-B-${rand}`,
        title: 'Nhiệm vụ riêng của User B',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.HIGH,
        status: TaskStatus.IN_PROGRESS,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-11-15'),
        createdById: userB.id,
        departmentId: deptB.id,
        actors: {
          create: [
            {
              userId: userB.id,
              role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date(),
            },
          ],
        },
      },
    });

    // Tạo Task Deliverable của Task B kèm file vật lý
    const fileNameB = `deliverable_b_${rand}.pdf`;
    const relFilePath = `tasks/2026/${fileNameB}`;
    fs.writeFileSync(
      path.join(TEST_UPLOADS_DIR, relFilePath),
      '%PDF-1.4 Secret Deliverable of User B'
    );
    fileBUrl = relFilePath;

    await prisma.taskDeliverable.create({
      data: {
        taskId: taskB.id,
        title: 'Minh chứng bảo mật của User B',
        fileUrl: relFilePath,
        fileType: 'application/pdf',
        fileSize: 36,
        uploadedById: userB.id,
      },
    });
  });

  after(async () => {
    fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
    if (originalUploadsDir !== undefined) {
      process.env.UPLOADS_DIR = originalUploadsDir;
    } else {
      delete process.env.UPLOADS_DIR;
    }

    // Dọn dẹp dữ liệu
    if (taskA?.id || taskB?.id) {
      const taskIds = [taskA?.id, taskB?.id].filter(Boolean);
      await prisma.taskDeliverable.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.taskActor.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.taskActor.deleteMany({ where: { taskId: { in: taskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
    }

    if (posAssignRector?.id) {
      await prisma.positionAssignment.delete({ where: { id: posAssignRector.id } });
    }
    if (orgUnitRector?.id) {
      await prisma.organizationalUnit.delete({ where: { id: orgUnitRector.id } });
    }

    const userIds = [userA?.id, userB?.id, rectorUser?.id].filter(Boolean);
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    const deptIds = [deptA?.id, deptB?.id].filter(Boolean);
    if (deptIds.length > 0) {
      await prisma.department.deleteMany({ where: { id: { in: deptIds } } });
    }
  });

  test('1. User A không thể GET /api/tasks/<id_of_user_B> → expect 403 hoặc 404', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${taskB.id}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
      },
    });

    const res = await getTask(req, { params: Promise.resolve({ id: taskB.id }) });
    assert.ok(res.status === 403 || res.status === 404, `Expected 403 or 404 but got ${res.status}`);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test('2. User A không thể PATCH /api/tasks/<id_of_user_B> → expect 403 hoặc 404', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${taskB.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
      },
      body: JSON.stringify({
        title: 'User A sửa tiêu đề của User B',
      }),
    });

    const res = await patchTask(req, { params: Promise.resolve({ id: taskB.id }) });
    assert.ok(res.status === 403 || res.status === 404, `Expected 403 or 404 but got ${res.status}`);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test('3. User A không thể DELETE /api/tasks/<id_of_user_B> → expect 403 hoặc 404', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${taskB.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
      },
      body: JSON.stringify({
        reason: 'User A muốn xóa nhiệm vụ của User B',
        expectedVersion: taskB.version ?? 1,
      }),
    });

    const res = await deleteTask(req, { params: Promise.resolve({ id: taskB.id }) });
    assert.ok(res.status === 403 || res.status === 404, `Expected 403 or 404 but got ${res.status}`);
    const body = await res.json();
    assert.strictEqual(body.success, false);
  });

  test('4. Task không tồn tại → expect 404 (không leak thông tin)', async () => {
    const nonExistentId = 'non_existent_task_id_12345';
    const req = new NextRequest(`http://localhost:3000/api/tasks/${nonExistentId}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
      },
    });

    const res = await getTask(req, { params: Promise.resolve({ id: nonExistentId }) });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /Không tìm thấy/i);
  });

  test('5. User A GET task của chính mình → expect 200', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${taskA.id}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
      },
    });

    const res = await getTask(req, { params: Promise.resolve({ id: taskA.id }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.task.id, taskA.id);
  });

  test('6. Institutional Leadership (Hiệu trưởng/BGH) truy cập task bất kỳ → expect 200', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tasks/${taskB.id}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${tokenRector}`,
      },
    });

    const res = await getTask(req, { params: Promise.resolve({ id: taskB.id }) });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.task.id, taskB.id);
  });

  test('7. User A download file của User B → expect 403', async () => {
    const segments = fileBUrl.split('/');
    const req = new NextRequest(`http://localhost:3000/api/files/${fileBUrl}`, {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
      },
    });

    const res = await getFile(req, { params: Promise.resolve({ path: segments }) });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.match(body.error, /không có quyền|Forbidden/i);
  });

  test('8. Path traversal: /api/files/../../etc/passwd → expect 403 hoặc 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/files/../../etc/passwd', {
      method: 'GET',
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${tokenA}`,
      },
    });

    const res = await getFile(req, { params: Promise.resolve({ path: ['..', '..', 'etc', 'passwd'] }) });
    assert.ok(res.status === 403 || res.status === 400, `Expected 403 or 400 but got ${res.status}`);
  });
});
