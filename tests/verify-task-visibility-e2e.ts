import { prisma } from '../src/lib/prisma';
import { signSessionToken, SESSION_COOKIE_NAME } from '../src/lib/jwt-session';
import { GET as dashboardOverviewGET } from '../src/app/api/dashboard/overview/route';
import { POST as taskPostRoute, GET as taskGetRoute } from '../src/app/api/tasks/route';
import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';

async function main() {
  console.log('=== VERIFY E2E: Task Creation and Visibility for Chuyên viên ===');

  // 1. Tìm user Đặng Nhật Huy hoặc user có position assignment hoạt động
  let user = await prisma.user.findFirst({
    where: { email: 'dangnhathuy@cdktcnqn.edu.vn' },
    include: {
      positionAssignments: {
        where: { status: 'ACTIVE' },
        include: { unit: true, positionDefinition: true },
      },
    },
  });

  if (!user || user.positionAssignments.length === 0) {
    user = await prisma.user.findFirst({
      where: { positionAssignments: { some: { status: 'ACTIVE' } } },
      include: {
        positionAssignments: {
          where: { status: 'ACTIVE' },
          include: { unit: true, positionDefinition: true },
        },
      },
    });
  }

  if (!user) {
    console.log('Không có user trong test DB, bỏ qua test E2E.');
    return;
  }

  console.log(`User: ${user.name} (${user.email})`);
  console.log(`Role: ${user.role}, Title: ${user.title}`);
  console.log(`Assignments: ${user.positionAssignments.map((p) => `${p.positionDefinition.code} tại ${p.unit.name} (${p.unit.code})`).join(', ')}`);

  const primaryAssignment = user.positionAssignments.find((p) => p.type === 'PRIMARY') || user.positionAssignments[0];
  const unitId = primaryAssignment?.unitId;
  const unitCode = primaryAssignment?.unit?.code;

  console.log(`Primary Unit: ${unitCode} (ID: ${unitId})`);

  // 2. Tạo Session Token
  const token = signSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: unitId,
  });

  // 3. Tạo nhiệm vụ mới qua POST /api/tasks
  const taskTitle = `[Kiểm thử E2E] Triển khai hệ thống E-Office ngày ${Date.now()}`;
  const createPayload = {
    title: taskTitle,
    description: 'Nhiệm vụ kiểm thử tạo và hiển thị tức thì sau khi tạo cho chuyên viên.',
    leadUnitId: unitId,
    departmentId: unitId,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    priority: 'HIGH',
    scope: 'DEPARTMENT',
    academicMonth: 9,
    academicYear: '2026-2027',
  };

  const createReq = new NextRequest('http://localhost:3000/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(createPayload),
  });

  console.log('\n--- 1. Gửi POST /api/tasks ---');
  const createRes = await taskPostRoute(createReq);
  const createData = await createRes.json();
  console.log(`Status: ${createRes.status}`);
  console.log(`Created Task Code: ${createData.data?.code || createData.task?.code}`);
  console.log(`Created Task ID: ${createData.data?.id || createData.task?.id}`);

  assert.equal(createRes.status, 201, 'Task creation must return 201 Created');
  const createdTaskId = createData.data?.id || createData.task?.id;
  assert.ok(createdTaskId, 'Created task ID must exist');

  // 4. Kiểm tra TaskActor trong Database
  const actors = await prisma.taskActor.findMany({
    where: { taskId: createdTaskId },
    include: { user: true },
  });
  console.log('\n--- 2. Kiểm tra TaskActor trong DB ---');
  console.log(`Tổng số TaskActor: ${actors.length}`);
  for (const a of actors) {
    console.log(`- Role: ${a.role}, User: ${a.user?.name} (${a.user?.email}), isPrimaryDRI: ${a.isPrimaryDRI}`);
  }
  const creatorActor = actors.find((a) => a.userId === user.id);
  assert.ok(creatorActor, 'Creator must be recorded as a TaskActor');

  // 5. Kiểm tra GET /api/dashboard/overview (Endpoint workspace gọi khi refresh)
  console.log('\n--- 3. Gửi GET /api/dashboard/overview ---');
  const overviewReq = new NextRequest('http://localhost:3000/api/dashboard/overview', {
    method: 'GET',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      Authorization: `Bearer ${token}`,
    },
  });

  const overviewRes = await dashboardOverviewGET(overviewReq);
  const overviewData = await overviewRes.json();
  console.log(`Status: ${overviewRes.status}`);
  console.log('Overview response keys:', Object.keys(overviewData));
  console.log('Overview data keys:', overviewData.data ? Object.keys(overviewData.data) : 'no data');
  console.log('Overview direct tasks:', overviewData.tasks?.length);
  console.log('Overview data.tasks:', overviewData.data?.tasks?.length);

  const returnedTasks = overviewData.tasks || overviewData.data?.tasks || [];
  console.log(`Tổng số tasks trên Dashboard: ${returnedTasks.length}`);

  const foundInOverview = returnedTasks.some((t: any) => t.id === createdTaskId || t.title === taskTitle);
  console.log(`=> Nhiệm vụ mới có xuất hiện trong Dashboard Overview không? ${foundInOverview ? 'CÓ (THÀNH CÔNG)' : 'KHÔNG (THẤT BẠI)'}`);
  assert.equal(foundInOverview, true, 'Created task MUST be visible in Dashboard Overview');

  // 6. Kiểm tra GET /api/tasks?view=related
  console.log('\n--- 4. Gửi GET /api/tasks?view=related ---');
  const taskListReq = new NextRequest('http://localhost:3000/api/tasks?view=related', {
    method: 'GET',
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      Authorization: `Bearer ${token}`,
    },
  });
  const taskListRes = await taskGetRoute(taskListReq);
  const taskListData = await taskListRes.json();
  console.log(`Status: ${taskListRes.status}`);
  const relatedTasks = taskListData.data?.tasks || taskListData.tasks || taskListData.data || [];
  console.log(`Tổng số tasks trả về trong view=related: ${relatedTasks.length}`);

  const foundInRelated = relatedTasks.some((t: any) => t.id === createdTaskId || t.title === taskTitle);
  console.log(`=> Nhiệm vụ mới có xuất hiện trong view=related không? ${foundInRelated ? 'CÓ (THÀNH CÔNG)' : 'KHÔNG (THẤT BẠI)'}`);
  assert.equal(foundInRelated, true, 'Created task MUST be visible in view=related task list');

  // Cleanup task kiểm thử
  await prisma.taskActor.deleteMany({ where: { taskId: createdTaskId } });
  await prisma.task.delete({ where: { id: createdTaskId } });
  console.log('\n✓ Đã dọn dẹp task kiểm thử an toàn.');
  console.log('=== KẾT QUẢ: TOÀN BỘ VERIFY E2E ĐÃ THÀNH CÔNG 100% ===');
}

main()
  .catch((err) => {
    console.error('Lỗi verify:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
