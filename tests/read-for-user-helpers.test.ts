/**
 * Hàm đọc dùng chung: readTaskForUser, findTaskIdByCode (nhiệm vụ) và readDocumentForUser (văn bản).
 * Chạy trên qcet_test; dữ liệu có runId riêng và chỉ xóa bản ghi do test tạo.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  AssignmentStatus,
  AssignmentType,
  DocumentSecurityLevel,
  DocumentStatus,
  DocumentType,
  JobCatalogGroup,
  TaskActorRole,
  TaskPriority,
  TaskScope,
  TaskStatus,
  UnitStatus,
  UnitType,
  UserRole,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { readTaskForUser, findTaskIdByCode } from '@/server/tasks/read-task-for-user';
import { readDocumentForUser } from '@/server/documents/read-document-for-user';
import { ForbiddenError, NotFoundError } from '@/server/api/errors';

describe('Hàm đọc dùng chung cho nhiệm vụ và văn bản', () => {
  const rand = crypto.randomBytes(4).toString('hex');
  const RAND = rand.toUpperCase();
  const created = {
    unitIds: [] as string[],
    positionId: '',
    userIds: [] as string[],
    taskIds: [] as string[],
    docIds: [] as string[],
  };
  let parentId = '';
  let parentCode = '';
  let childReadableId = '';
  let docId = '';
  let parentSharedId = '';
  let sameUnitChildId = '';
  let responsibleSiblingId = '';
  let toTrinhId = '';
  let toTrinhNoFlowId = '';
  let ctxResponsible: Awaited<ReturnType<typeof loadAuthorizationContext>>;
  let ctxSameUnit: Awaited<ReturnType<typeof loadAuthorizationContext>>;
  let ctxOtherUnit: Awaited<ReturnType<typeof loadAuthorizationContext>>;

  before(async () => {
    const unitU = await prisma.organizationalUnit.create({
      data: { id: `rd_u_${rand}`, code: `RD_U_${RAND}`, name: 'Đơn vị đọc A', type: UnitType.DEPARTMENT, status: UnitStatus.ACTIVE },
    });
    created.unitIds.push(unitU.id);
    const unitV = await prisma.organizationalUnit.create({
      data: { id: `rd_v_${rand}`, code: `RD_V_${RAND}`, name: 'Đơn vị đọc B', type: UnitType.DEPARTMENT, status: UnitStatus.ACTIVE },
    });
    created.unitIds.push(unitV.id);

    // Mã chức danh bắt đầu bằng CHUYEN_VIEN để có quyền công tác cơ bản (STEP_5_STAFF_BASE_AUTHORITY).
    const position = await prisma.positionDefinition.create({
      data: { code: `CHUYEN_VIEN_RD_${RAND}`, title: 'Chuyên viên kiểm thử đọc', group: JobCatalogGroup.HTPV },
    });
    created.positionId = position.id;

    const makeUser = async (tag: string) => {
      const user = await prisma.user.create({
        data: { email: `rd_${tag}_${rand}@rd.qcet.test`, name: `Đọc ${tag} ${RAND}`, role: UserRole.CHUYEN_VIEN, isActive: true },
      });
      created.userIds.push(user.id);
      return user;
    };
    const responsible = await makeUser('r');
    const sameUnit = await makeUser('s');
    const outsider = await makeUser('o');

    const assign = (userId: string, unitId: string) =>
      prisma.positionAssignment.create({
        data: {
          userId,
          positionDefinitionId: position.id,
          unitId,
          type: AssignmentType.PRIMARY,
          status: AssignmentStatus.ACTIVE,
          effectiveFrom: new Date('2026-01-01'),
        },
      });
    await assign(responsible.id, unitU.id);
    await assign(sameUnit.id, unitU.id);
    await assign(outsider.id, unitV.id);

    const parent = await prisma.task.create({
      data: {
        code: `NVRD${RAND}`,
        title: 'Nhiệm vụ cha đọc',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.IN_PROGRESS,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-11-01'),
        createdById: responsible.id,
        leadUnitId: unitU.id,
        actors: {
          create: [{ userId: responsible.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    created.taskIds.push(parent.id);
    parentId = parent.id;
    parentCode = parent.code;

    const childReadable = await prisma.task.create({
      data: {
        code: `NVRDC1${RAND}`,
        title: 'Việc con người phụ trách đọc được',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.NOT_STARTED,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30'),
        createdById: responsible.id,
        leadUnitId: unitU.id,
        parentTaskId: parent.id,
        actors: {
          create: [{ userId: responsible.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    created.taskIds.push(childReadable.id);
    childReadableId = childReadable.id;

    // Việc con cá nhân của người khác đơn vị: không được lộ trong subTasks của người phụ trách.
    const childOther = await prisma.task.create({
      data: {
        code: `NVRDC2${RAND}`,
        title: 'Việc con của người khác',
        scope: TaskScope.INDIVIDUAL,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.NOT_STARTED,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-31'),
        createdById: outsider.id,
        leadUnitId: unitV.id,
        parentTaskId: parent.id,
        actors: {
          create: [{ userId: outsider.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    created.taskIds.push(childOther.id);

    // Nhiệm vụ cha thứ hai: người cùng đơn vị đọc được nhờ việc con của chính họ, còn việc con của
    // người phụ trách (cùng đơn vị, không liên quan tới họ) phải bị D07 loại khỏi subTasks.
    const parentShared = await prisma.task.create({
      data: {
        code: `NVRDS${RAND}`,
        title: 'Nhiệm vụ cha có hai việc con cùng đơn vị',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.IN_PROGRESS,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-11-01'),
        createdById: responsible.id,
        leadUnitId: unitU.id,
      },
    });
    created.taskIds.push(parentShared.id);
    parentSharedId = parentShared.id;

    const sameUnitChild = await prisma.task.create({
      data: {
        code: `NVRDS1${RAND}`,
        title: 'Việc con của người cùng đơn vị',
        scope: TaskScope.INDIVIDUAL,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.NOT_STARTED,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-30'),
        createdById: sameUnit.id,
        leadUnitId: unitU.id,
        parentTaskId: parentShared.id,
        actors: {
          create: [{ userId: sameUnit.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    created.taskIds.push(sameUnitChild.id);
    sameUnitChildId = sameUnitChild.id;

    const responsibleSibling = await prisma.task.create({
      data: {
        code: `NVRDS2${RAND}`,
        title: 'Việc con của người phụ trách, cùng đơn vị',
        scope: TaskScope.DEPARTMENT,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.NOT_STARTED,
        academicMonth: 10,
        academicYear: '2026-2027',
        dueDate: new Date('2026-10-31'),
        createdById: responsible.id,
        leadUnitId: unitU.id,
        parentTaskId: parentShared.id,
        actors: {
          create: [{ userId: responsible.id, role: TaskActorRole.DRI, isPrimaryDRI: true, appointedAt: new Date() }],
        },
      },
    });
    created.taskIds.push(responsibleSibling.id);
    responsibleSiblingId = responsibleSibling.id;

    const doc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: 100000 + (parseInt(rand, 16) % 800000),
        documentYear: 2026,
        originalNumber: `RD-${RAND}`,
        issuedDate: new Date('2026-10-01'),
        issuingAuthority: 'Sở đọc thử',
        category: 'Công văn',
        summary: `Văn bản kiểm thử đọc ${RAND}`,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById: responsible.id,
        status: DocumentStatus.CHO_PHAN_CONG,
      },
    });
    created.docIds.push(doc.id);
    docId = doc.id;

    // Tờ trình có luồng duyệt: outsider là người duyệt bước 1, nên được đọc theo nhánh người tham gia.
    const toTrinhNumber = 900000 + (parseInt(rand, 16) % 90000);
    const toTrinh = await prisma.document.create({
      data: {
        type: DocumentType.TO_TRINH_NOI_BO,
        registrationNumber: toTrinhNumber,
        documentYear: 2026,
        originalNumber: `TT-${RAND}`,
        issuedDate: new Date('2026-10-02'),
        issuingAuthority: 'Đơn vị đọc A',
        category: 'Tờ trình',
        summary: `Tờ trình kiểm thử đọc ${RAND}`,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById: responsible.id,
        status: DocumentStatus.CHO_PHAN_CONG,
        approvalWorkflow: {
          create: {
            submittedById: responsible.id,
            round: 1,
            steps: {
              create: [{ round: 1, stage: 'UNIT_HEAD', unitId: unitU.id, approverUserId: outsider.id }],
            },
          },
        },
      },
    });
    created.docIds.push(toTrinh.id);
    toTrinhId = toTrinh.id;

    // Tờ trình không có luồng duyệt liên quan tới người ngoài: người này phải bị từ chối.
    const toTrinhNoFlow = await prisma.document.create({
      data: {
        type: DocumentType.TO_TRINH_NOI_BO,
        registrationNumber: toTrinhNumber + 1,
        documentYear: 2026,
        originalNumber: `TT2-${RAND}`,
        issuedDate: new Date('2026-10-03'),
        issuingAuthority: 'Đơn vị đọc A',
        category: 'Tờ trình',
        summary: `Tờ trình không luồng duyệt ${RAND}`,
        securityLevel: DocumentSecurityLevel.THUONG,
        registeredById: responsible.id,
        status: DocumentStatus.CHO_PHAN_CONG,
      },
    });
    created.docIds.push(toTrinhNoFlow.id);
    toTrinhNoFlowId = toTrinhNoFlow.id;


    ctxResponsible = await loadAuthorizationContext(responsible.id);
    ctxSameUnit = await loadAuthorizationContext(sameUnit.id);
    ctxOtherUnit = await loadAuthorizationContext(outsider.id);
  });

  after(async () => {
    // Xóa đúng bản ghi đã tạo, theo thứ tự phụ thuộc khóa ngoại.
    await prisma.document.deleteMany({ where: { id: { in: created.docIds } } });
    for (const id of [...created.taskIds].reverse()) {
      await prisma.task.deleteMany({ where: { id } });
    }
    await prisma.positionAssignment.deleteMany({ where: { userId: { in: created.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
    if (created.positionId) {
      await prisma.positionDefinition.deleteMany({ where: { id: created.positionId } });
    }
    await prisma.organizationalUnit.deleteMany({ where: { id: { in: created.unitIds } } });
  });

  describe('readTaskForUser', () => {
    it('người phụ trách đọc được nhiệm vụ; việc con chỉ gồm việc con người đó đọc được', async () => {
      const { task, availableActions } = await readTaskForUser(ctxResponsible, parentId);
      assert.equal(task.id, parentId);
      assert.equal(task.code, parentCode);
      assert.ok(availableActions);
      assert.deepEqual((task.subTasks ?? []).map((s) => s.id), [childReadableId]);
    });

    it('người cùng đơn vị nhưng không tham gia bị từ chối theo phạm vi D07', async () => {
      await assert.rejects(
        readTaskForUser(ctxSameUnit, parentId),
        (err: unknown) =>
          err instanceof ForbiddenError && err.message === 'Bạn chỉ xem được phần nhiệm vụ mình tham gia'
      );
    });

    it('người cùng đơn vị: việc con cùng đơn vị của người khác bị D07 loại khỏi subTasks', async () => {
      const { task } = await readTaskForUser(ctxSameUnit, parentSharedId);
      assert.deepEqual((task.subTasks ?? []).map((s) => s.id), [sameUnitChildId]);
      assert.ok(!(task.subTasks ?? []).some((s) => s.id === responsibleSiblingId));
    });

    it('người thuộc đơn vị khác bị từ chối bằng ForbiddenError', async () => {
      await assert.rejects(readTaskForUser(ctxOtherUnit, parentId), (err: unknown) => err instanceof ForbiddenError);
    });

    it('id không có trong hệ thống → NotFoundError', async () => {
      await assert.rejects(
        readTaskForUser(ctxResponsible, `missing_${rand}`),
        (err: unknown) => err instanceof NotFoundError && err.message === 'Không tìm thấy nhiệm vụ'
      );
    });
  });

  describe('findTaskIdByCode', () => {
    it('không phân biệt hoa thường, bỏ khoảng trắng đầu cuối; mã lạ → null', async () => {
      assert.equal(await findTaskIdByCode(parentCode), parentId);
      assert.equal(await findTaskIdByCode(`  ${parentCode.toLowerCase()} `), parentId);
      assert.equal(await findTaskIdByCode(`NVRD_KHONG_CO_${RAND}`), null);
      assert.equal(await findTaskIdByCode('   '), null);
    });
  });

  describe('readDocumentForUser', () => {
    it('người lập văn bản đọc được; không phải người tham gia tờ trình', async () => {
      const result = await readDocumentForUser(ctxResponsible, docId);
      assert.equal(result.document.id, docId);
      assert.equal(result.docResource.id, docId);
      assert.equal(result.isParticipant, false);
    });

    it('người không liên quan bị từ chối bằng ForbiddenError', async () => {
      await assert.rejects(readDocumentForUser(ctxOtherUnit, docId), (err: unknown) => err instanceof ForbiddenError);
    });

    it('người tham gia luồng duyệt tờ trình đọc được dù không liên quan theo chính sách chung', async () => {
      const result = await readDocumentForUser(ctxOtherUnit, toTrinhId);
      assert.equal(result.document.id, toTrinhId);
      assert.equal(result.isParticipant, true);
    });

    it('tờ trình không có luồng duyệt liên quan: người ngoài bị từ chối', async () => {
      await assert.rejects(readDocumentForUser(ctxOtherUnit, toTrinhNoFlowId), (err: unknown) => err instanceof ForbiddenError);
    });

    it('văn bản không có → NotFoundError với mã DOCUMENT_NOT_FOUND', async () => {
      await assert.rejects(
        readDocumentForUser(ctxResponsible, `missing_${rand}`),
        (err: unknown) => err instanceof NotFoundError && err.code === 'DOCUMENT_NOT_FOUND'
      );
    });
  });
});
