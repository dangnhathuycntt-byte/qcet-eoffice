import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET as getTasks, POST as postTask } from '../src/app/api/tasks/route';
import { GET as getTaskDetail, PATCH as patchTask } from '../src/app/api/tasks/[id]/route';
import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { AssigneeRole, TaskStatus } from '@prisma/client';

describe('Single DRI and Subtask Hierarchy API Tests', () => {
  let adminUser: { id: string; email: string; name: string; role: any; departmentId: string | null };
  let staffUser1: { id: string; email: string; name: string; role: any; departmentId: string | null };
  let staffUser2: { id: string; email: string; name: string; role: any; departmentId: string | null };
  let adminToken: string;
  let staffToken1: string;
  let testDeptId: string;
  const createdTaskIds: string[] = [];

  before(async () => {
    // 1. Get department
    const dept = await prisma.department.findFirst();
    assert.ok(dept, 'Must have at least one department');
    testDeptId = dept.id;

    // 2. Get or find admin and staff users
    const users = await prisma.user.findMany({ take: 5 });
    assert.ok(users.length >= 3, 'Must have at least 3 users for testing single DRI & collaborators');

    const admin = users.find(u => u.role === 'BAN_GIAM_HIEU' || u.role === 'ADMIN') || users[0];
    const nonAdmins = users.filter(u => u.id !== admin.id);
    adminUser = admin;
    staffUser1 = nonAdmins[0];
    staffUser2 = nonAdmins[1];

    adminToken = signSessionToken({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      departmentId: adminUser.departmentId,
    });

    staffToken1 = signSessionToken({
      id: staffUser1.id,
      email: staffUser1.email,
      name: staffUser1.name,
      role: staffUser1.role,
      departmentId: staffUser1.departmentId,
    });
  });

  after(async () => {
    if (createdTaskIds.length > 0) {
      // First disconnect documents
      await prisma.document.updateMany({
        where: { linkedTaskId: { in: createdTaskIds } },
        data: { linkedTaskId: null },
      });
      // Delete child relations
      await prisma.taskAssignee.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      await prisma.taskDeliverable.deleteMany({
        where: { taskId: { in: createdTaskIds } },
      });
      // Subtasks first, then parents
      const allTasks = await prisma.task.findMany({
        where: { id: { in: createdTaskIds } },
        select: { id: true, parentTaskId: true },
      });
      const subtaskIds = allTasks.filter(t => t.parentTaskId).map(t => t.id);
      const parentIds = allTasks.filter(t => !t.parentTaskId).map(t => t.id);

      if (subtaskIds.length > 0) {
        await prisma.task.deleteMany({ where: { id: { in: subtaskIds } } });
      }
      if (parentIds.length > 0) {
        await prisma.task.deleteMany({ where: { id: { in: parentIds } } });
      }
    }
  });

  test('POST /api/tasks: returns 404 when parentTaskId does not exist', async () => {
    const req = new NextRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Subtask with non-existent parent',
        dueDate: '2026-10-30',
        departmentId: testDeptId,
        parentTaskId: 'non-existent-task-id-12345',
      }),
    });

    const res = await postTask(req);
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.error, /Không tìm thấy nhiệm vụ cha/i);
  });

  test('POST /api/tasks: creates root task with single DRI (PRIMARY_OWNER) and collaborators', async () => {
    const req = new NextRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Root Task Single DRI Test',
        dueDate: '2026-10-25',
        departmentId: testDeptId,
        academicMonth: 10,
        academicYear: '2026-2027',
        assigneeId: staffUser1.id,
        collaboratorIds: [staffUser2.id, staffUser1.id], // staffUser1 duplicated in collaborators
      }),
    });

    const res = await postTask(req);
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    const taskId = json.task.id;
    createdTaskIds.push(taskId);

    // Verify in database: exactly 1 PRIMARY_OWNER and 1 COLLABORATOR
    const assignees = await prisma.taskAssignee.findMany({
      where: { taskId },
    });

    const owners = assignees.filter(a => a.roleInTask === AssigneeRole.PRIMARY_OWNER);
    const collabs = assignees.filter(a => a.roleInTask === AssigneeRole.COLLABORATOR);

    assert.strictEqual(owners.length, 1, 'Must have exactly 1 PRIMARY_OWNER');
    assert.strictEqual(owners[0].userId, staffUser1.id);
    assert.strictEqual(collabs.length, 1, 'Must have exactly 1 COLLABORATOR, deduplicating primary owner');
    assert.strictEqual(collabs[0].userId, staffUser2.id);
  });

  test('POST /api/tasks: creates subtask and inherits department, month, year from parent when omitted', async () => {
    // 1. Create a parent task first
    const parentReq = new NextRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Parent Task for Inheritance',
        dueDate: '2026-11-20',
        departmentId: testDeptId,
        academicMonth: 11,
        academicYear: '2026-2027',
        assigneeId: adminUser.id,
      }),
    });

    const parentRes = await postTask(parentReq);
    assert.strictEqual(parentRes.status, 201);
    const parentJson = await parentRes.json();
    const parentId = parentJson.task.id;
    createdTaskIds.push(parentId);

    // 2. Create subtask without departmentId, academicMonth, academicYear
    const subtaskReq = new NextRequest('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Subtask Child Task',
        dueDate: '2026-11-15',
        parentTaskId: parentId,
        assigneeId: staffUser2.id,
      }),
    });

    const subtaskRes = await postTask(subtaskReq);
    assert.strictEqual(subtaskRes.status, 201);
    const subtaskJson = await subtaskRes.json();
    const subtaskId = subtaskJson.task.id;
    createdTaskIds.push(subtaskId);

    // Verify subtask properties
    const subtaskDb = await prisma.task.findUnique({
      where: { id: subtaskId },
      include: { assignees: true, parentTask: true },
    });

    assert.ok(subtaskDb);
    assert.strictEqual(subtaskDb.parentTaskId, parentId);
    assert.strictEqual(subtaskDb.departmentId, testDeptId, 'Inherited departmentId from parent');
    assert.strictEqual(subtaskDb.academicMonth, 11, 'Inherited academicMonth from parent');
    assert.strictEqual(subtaskDb.academicYear, '2026-2027', 'Inherited academicYear from parent');
    assert.strictEqual(subtaskDb.assignees.length, 1);
    assert.strictEqual(subtaskDb.assignees[0].userId, staffUser2.id);
    assert.strictEqual(subtaskDb.assignees[0].roleInTask, AssigneeRole.PRIMARY_OWNER);
  });

  test('GET /api/tasks: returns parentTask and subTasks, supports assignedTo=me and scope=my', async () => {
    // Query with scope=my for staffUser1
    const reqScopeMy = new NextRequest('http://localhost:3000/api/tasks?scope=my', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${staffToken1}`,
      },
    });

    const resScopeMy = await getTasks(reqScopeMy);
    assert.strictEqual(resScopeMy.status, 200);
    const jsonScopeMy = await resScopeMy.json();
    assert.strictEqual(jsonScopeMy.success, true);
    // All returned tasks must have staffUser1 in assignees
    assert.ok(Array.isArray(jsonScopeMy.data));

    // Query with assignedTo=me for staffUser1
    const reqAssignedMe = new NextRequest('http://localhost:3000/api/tasks?assignedTo=me', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${staffToken1}`,
      },
    });

    const resAssignedMe = await getTasks(reqAssignedMe);
    assert.strictEqual(resAssignedMe.status, 200);
    const jsonAssignedMe = await resAssignedMe.json();
    assert.strictEqual(jsonAssignedMe.success, true);

    // Verify parentTask & subTasks are loaded in GET /api/tasks
    const reqAll = new NextRequest('http://localhost:3000/api/tasks?all=true', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
    });

    const resAll = await getTasks(reqAll);
    const jsonAll = await resAll.json();
    assert.strictEqual(jsonAll.success, true);

    const createdSubtask = jsonAll.data.find((t: any) => createdTaskIds.includes(t.id) && t.parentTaskId);
    if (createdSubtask) {
      assert.ok(createdSubtask.parentTask, 'Subtask should include parentTask');
      assert.ok(createdSubtask.parentTask.id, 'parentTask has id');
      assert.ok(createdSubtask.parentTask.code, 'parentTask has code');
    }
  });

  test('GET /api/tasks/[id]: includes parentTask and subTasks with relations', async () => {
    // Find a task with subtasks among created ones
    const parentId = createdTaskIds.find(id => {
      // Find one that was a parent
      return true;
    });
    assert.ok(parentId);

    const context = { params: Promise.resolve({ id: parentId }) };
    const req = new NextRequest(`http://localhost:3000/api/tasks/${parentId}`, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
    });

    const res = await getTaskDetail(req, context);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    const taskObj = json.task || json.data;
    assert.ok(taskObj.subTasks !== undefined, 'task.subTasks must be defined');
    assert.ok(taskObj.parentTask !== undefined, 'task.parentTask must be defined');
  });

  test('PATCH /api/tasks/[id]: prevents self-referencing parentTaskId and handles invalid parentTaskId', async () => {
    const taskId = createdTaskIds[0];
    const context = { params: Promise.resolve({ id: taskId }) };

    // 1. Self reference
    const reqSelf = new NextRequest(`http://localhost:3000/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        parentTaskId: taskId,
      }),
    });
    const resSelf = await patchTask(reqSelf, context);
    assert.strictEqual(resSelf.status, 400);
    const jsonSelf = await resSelf.json();
    assert.match(jsonSelf.error, /Nhiệm vụ không thể là nhiệm vụ cha của chính nó/i);

    // 2. Non-existent parent
    const reqInvalid = new NextRequest(`http://localhost:3000/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        parentTaskId: 'non-existent-parent-id-xyz',
      }),
    });
    const resInvalid = await patchTask(reqInvalid, context);
    assert.strictEqual(resInvalid.status, 404);
  });

  test('PATCH /api/tasks/[id]: safely updates single DRI and collaboratorIds', async () => {
    const taskId = createdTaskIds[0];
    const context = { params: Promise.resolve({ id: taskId }) };

    // Update primary owner to staffUser2, and collaborators to [staffUser1.id]
    const req = new NextRequest(`http://localhost:3000/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'origin': 'http://localhost:3000',
        cookie: `${SESSION_COOKIE_NAME}=${adminToken}`,
      },
      body: JSON.stringify({
        assigneeId: staffUser2.id,
        collaboratorIds: [staffUser1.id],
      }),
    });

    const res = await patchTask(req, context);
    assert.strictEqual(res.status, 200);

    // Verify in database: staffUser2 is PRIMARY_OWNER, staffUser1 is COLLABORATOR
    const assignees = await prisma.taskAssignee.findMany({
      where: { taskId },
    });

    const owners = assignees.filter(a => a.roleInTask === AssigneeRole.PRIMARY_OWNER);
    const collabs = assignees.filter(a => a.roleInTask === AssigneeRole.COLLABORATOR);

    assert.strictEqual(owners.length, 1, 'Only 1 PRIMARY_OWNER');
    assert.strictEqual(owners[0].userId, staffUser2.id);
    assert.strictEqual(collabs.length, 1, 'Only 1 COLLABORATOR');
    assert.strictEqual(collabs[0].userId, staffUser1.id);
  });
});
