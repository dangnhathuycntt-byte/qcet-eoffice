import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mapPrismaTaskToSchoolTask, mapSchoolTaskToPrismaCreateInput } from '../src/lib/adapters/task-db-adapter';

describe('TaskDbAdapter Unit Tests', () => {
  test('maps full Prisma Task record to SchoolTask without data loss', () => {
    const mockPrismaTask: any = {
      id: 'task-001',
      code: 'NV-2026-09-001',
      title: 'Soạn thảo Đề cương Chương trình đào tạo Nghề Kỹ thuật Máy lạnh',
      description: 'Thẩm định ma trận kỹ năng nghề theo tiêu chuẩn DACUM',
      scope: 'SCHOOL',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progressPercent: 65,
      academicMonth: 9,
      academicYear: '2026-2027',
      startDate: new Date('2026-09-01T00:00:00+07:00'),
      dueDate: new Date('2026-09-24T17:00:00+07:00'),
      departmentId: 'khoa-dien',
      department: {
        id: 'khoa-dien',
        name: 'Khoa Điện - Điện tử',
        shortName: 'K.Điện'
      },
      assignees: [
        {
          userId: 'user-01',
          roleInTask: 'PRIMARY_OWNER',
          user: { name: 'ThS. Nguyễn Văn A', avatarUrl: '/avatars/01.jpg' }
        },
        {
          userId: 'user-02',
          roleInTask: 'COLLABORATOR',
          user: { name: 'KS. Trần B', avatarUrl: null }
        }
      ],
      deliverables: [
        {
          id: 'del-01',
          title: 'Ma trận kỹ năng DACUM.pdf',
          fileUrl: 'https://storage.qcet.edu.vn/dacum.pdf',
          reviewStatus: 'PENDING'
        }
      ]
    };

    const schoolTask = mapPrismaTaskToSchoolTask(mockPrismaTask);

    assert.strictEqual(schoolTask.id, 'task-001');
    assert.strictEqual(schoolTask.title, 'Soạn thảo Đề cương Chương trình đào tạo Nghề Kỹ thuật Máy lạnh');
    assert.strictEqual(schoolTask.department, 'Khoa Điện - Điện tử');
    assert.strictEqual(schoolTask.assignedTo, 'ThS. Nguyễn Văn A');
    assert.strictEqual(schoolTask.dueDate, '2026-09-24');
    assert.strictEqual(schoolTask.status, 'in_progress');
    assert.strictEqual(schoolTask.priority, 'high');
    assert.strictEqual(schoolTask.academicMonth, 9);
    assert.strictEqual(schoolTask.progress, 65);
    assert.strictEqual(schoolTask.collaborators?.length, 1);
    assert.strictEqual(schoolTask.collaborators?.[0], 'KS. Trần B');
  });

  test('falls back gracefully when department or assignees are missing', () => {
    const rawMinimal: any = {
      id: 'task-002',
      code: 'NV-2026-09-002',
      title: 'Vệ sinh phòng máy tính số 3',
      description: null,
      scope: 'DEPARTMENT',
      status: 'NOT_STARTED',
      priority: 'NORMAL',
      progressPercent: 0,
      academicMonth: 9,
      academicYear: '2026-2027',
      startDate: new Date('2026-09-10T00:00:00Z'),
      dueDate: new Date('2026-09-20T00:00:00Z'),
      departmentId: null,
      department: null,
      assignees: [],
      deliverables: []
    };

    const result = mapPrismaTaskToSchoolTask(rawMinimal);
    assert.strictEqual(result.department, 'Chưa phân bổ');
    assert.strictEqual(result.assignedTo, 'Chưa phân công');
    assert.strictEqual(result.status, 'not_started');
    assert.strictEqual(result.priority, 'medium');
  });

  test('maps SchoolTask domain object to Prisma create input structure', () => {
    const domainTask = {
      id: 'task-new',
      title: 'Xây dựng kế hoạch tuyển sinh 2026',
      description: 'Chi tiết kế hoạch tuyển sinh',
      department: 'Trung tâm Tuyển sinh & Truyền thông',
      assignedTo: 'ThS. Nguyễn Văn A',
      dueDate: '2026-10-15',
      status: 'in_progress',
      priority: 'high',
      progress: 20,
      academicMonth: 10,
      category: 'Chỉ đạo cấp Trường'
    };

    const prismaInput = mapSchoolTaskToPrismaCreateInput(domainTask, 'user-creator-123', 'dept-01');

    assert.strictEqual(prismaInput.title, 'Xây dựng kế hoạch tuyển sinh 2026');
    assert.strictEqual(prismaInput.description, 'Chi tiết kế hoạch tuyển sinh');
    assert.strictEqual(prismaInput.createdById, 'user-creator-123');
    assert.strictEqual(prismaInput.departmentId, 'dept-01');
    assert.strictEqual(prismaInput.status, 'IN_PROGRESS');
    assert.strictEqual(prismaInput.priority, 'HIGH');
    assert.strictEqual(prismaInput.scope, 'SCHOOL');
    assert.strictEqual(prismaInput.progressPercent, 20);
    assert.strictEqual(prismaInput.academicMonth, 10);
  });
});
