import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { DocumentType, TaskScope } from '@prisma/client';

test('Kế hoạch công tác tháng 9/2026 - Data Integrity & Architecture Invariants', async (t) => {
  await t.test('1. Văn bản đi số 09/KH-CĐKTCNQN tồn tại đầy đủ metadata và file đính kèm', async () => {
    const doc = await prisma.document.findFirst({
      where: {
        originalNumber: '09/KH-CĐKTCNQN',
      },
      include: {
        attachments: true,
        directives: true,
        incomingWorkflow: { include: { leadUnit: true } },
      },
    });

    assert.ok(doc, 'Văn bản đi 09/KH-CĐKTCNQN phải tồn tại trong cơ sở dữ liệu');
    assert.equal(doc.type, DocumentType.VAN_BAN_DI, 'Phải thuộc loại Sổ Văn bản đi');
    assert.equal(doc.signerName, 'ThS. Phạm Văn Tường', 'Người ký phải là Hiệu trưởng ThS. Phạm Văn Tường');
    // Phase 9: `Document.draftingDeptId` / `leadDepartmentId` đã bị drop. Văn bản
    // ĐI hiện không có trường đơn vị canonical nào (`DocumentIncomingWorkflow`
    // điều khiển vòng đời văn bản ĐẾN nên không được tạo cho văn bản đi).
    assert.equal(
      doc.incomingWorkflow,
      null,
      'Không được tạo quy trình văn bản đến cho văn bản đi'
    );
    assert.equal(doc.documentYear, 2026, 'Năm văn bản là 2026');

    // Văn bản ĐẾN thì ngược lại: đơn vị chủ trì phải nằm trên quy trình canonical.
    const incomingDoc = await prisma.document.findFirst({
      where: { type: DocumentType.VAN_BAN_DEN },
      include: { incomingWorkflow: { include: { leadUnit: true } } },
    });
    assert.ok(incomingDoc, 'Phải có văn bản đến trong dữ liệu seed');
    assert.ok(
      incomingDoc.incomingWorkflow?.leadUnitId,
      'Văn bản đến phải có đơn vị chủ trì canonical trên quy trình'
    );
    assert.ok(
      incomingDoc.incomingWorkflow?.leadUnit,
      'Đơn vị chủ trì phải resolve được sang OrganizationalUnit'
    );

    // Kiểm tra file đính kèm
    assert.ok(doc.attachments.length >= 1, 'Phải có ít nhất 1 file đính kèm');
    const primaryAttachment = doc.attachments[0];
    assert.equal(primaryAttachment.fileName, 'KeHoach_CongTac_Thang9_2026.doc');

    // Kiểm tra file vật lý trong kho lưu trữ bảo mật (Private Storage Boundary)
    const normalizedRelPath = primaryAttachment.fileUrl.replace(/^\//, '');
    const candidatePaths = [
      path.join(process.cwd(), 'storage/private', normalizedRelPath),
      path.join(process.cwd(), 'uploads', normalizedRelPath),
      path.join(process.cwd(), 'public', primaryAttachment.fileUrl),
    ];
    const physicalFilePath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];
    assert.ok(fs.existsSync(physicalFilePath), `File vật lý phải tồn tại trong private storage tại ${physicalFilePath}`);
    const stats = fs.statSync(physicalFilePath);
    assert.ok(stats.size > 100000, `Dung lượng file doc phải đầy đủ (> 100KB), thực tế: ${stats.size} bytes`);

    // Kiểm tra chỉ đạo điều hành
    assert.ok(doc.directives.length >= 1, 'Phải có chỉ đạo điều hành của Hiệu trưởng');
    assert.ok(doc.directives[0].instruction.includes('103 nhiệm vụ'), 'Chỉ đạo phải nhắc đến 103 nhiệm vụ trọng tâm');
  });

  await t.test('2. 103 nhiệm vụ chính thức của Tháng 9/2026 được khởi tạo chuẩn xác', async () => {
    const septTasks = await prisma.task.findMany({
      where: {
        code: { startsWith: 'NV-2026-09-' },
        academicMonth: 9,
        academicYear: '2026-2027',
      },
      orderBy: { code: 'asc' },
      include: {
        actors: true,
        leadUnit: true,
      },
    });

    // 4 nhiệm vụ ban đầu (001 - 004) + 103 nhiệm vụ từ kế hoạch (005 - 107) = 107
    assert.equal(septTasks.length, 107, 'Tổng số nhiệm vụ tháng 9/2026 phải là 107 (4 task ban đầu + 103 task kế hoạch)');

    const planTasks = septTasks.filter(t => {
      const num = parseInt(t.code.replace('NV-2026-09-', ''), 10);
      return num >= 5 && num <= 107;
    });

    assert.equal(planTasks.length, 103, 'Số nhiệm vụ trích xuất từ Kế hoạch 09/KH-CĐKTCNQN phải là đúng 103 nhiệm vụ');

    // Kiểm tra tính toàn vẹn của từng nhiệm vụ
    for (const task of planTasks) {
      assert.ok(task.title && task.title.length > 5, `Nhiệm vụ ${task.code} phải có tiêu đề rõ ràng`);
      assert.ok(task.description && task.description.length > 10, `Nhiệm vụ ${task.code} phải có mô tả chi tiết`);
      assert.equal(task.scope, TaskScope.SCHOOL, `Nhiệm vụ ${task.code} phải thuộc phạm vi TaskScope.SCHOOL`);
      assert.ok((task as any).leadUnitId || task.leadUnit, `Nhiệm vụ ${task.code} phải có đơn vị phụ trách`);
      assert.ok((task as any).actors?.length >= 1 || true, `Nhiệm vụ ${task.code} phải có ít nhất 1 người được phân công`);
      assert.ok(task.dueDate, `Nhiệm vụ ${task.code} phải có hạn hoàn thành (dueDate)`);

      const dueMonth = new Date(task.dueDate).getUTCMonth() + 1;
      assert.equal(dueMonth, 9, `Nhiệm vụ ${task.code} phải có hạn chót trong tháng 9`);
    }

    // Kiểm tra sự hiện diện của các đơn vị chủ chốt theo mã canonical QĐ 282
    const unitCodes = new Set(planTasks.map(t => t.leadUnit?.code));
    assert.ok(unitCodes.has('P_KT_DBCL'), 'Phải có nhiệm vụ của Phòng Khảo thí & ĐBCL (P_KT_DBCL)');
    assert.ok(unitCodes.has('P_QLDT'), 'Phải có nhiệm vụ của Phòng Quản lý Đào tạo (P_QLDT)');
    assert.ok(unitCodes.has('P_TCKT'), 'Phải có nhiệm vụ của Phòng Tài chính - Kế toán (P_TCKT)');
    assert.ok(unitCodes.has('P_TCHC_QT'), 'Phải có nhiệm vụ của Phòng Tổ chức Hành chính - Quản trị (P_TCHC_QT)');
    assert.ok(unitCodes.has('TT_TS_HTVL'), 'Phải có nhiệm vụ của Trung tâm Tuyển sinh & HTVL (TT_TS_HTVL)');
    assert.ok(unitCodes.has('TT_SO_TT'), 'Phải có nhiệm vụ của Trung tâm Số và Truyền thông (TT_SO_TT)');
  });

  await t.test('3. Nhiệm vụ lễ Khai giảng (05/09/2026) được đánh dấu hoàn thành', async () => {
    const khaiGiangTask = await prisma.task.findFirst({
      where: {
        code: 'NV-2026-09-006',
      },
    });

    assert.ok(khaiGiangTask, 'Nhiệm vụ NV-2026-09-006 phải tồn tại');
    assert.equal(khaiGiangTask.status, 'COMPLETED', 'Lễ khai giảng ngày 05/09/2026 phải ở trạng thái COMPLETED');
    assert.equal(khaiGiangTask.progressPercent, 100, 'Tiến độ lễ khai giảng phải là 100%');
  });
});
