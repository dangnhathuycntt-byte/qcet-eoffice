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
      },
    });

    assert.ok(doc, 'Văn bản đi 09/KH-CĐKTCNQN phải tồn tại trong cơ sở dữ liệu');
    assert.equal(doc.type, DocumentType.VAN_BAN_DI, 'Phải thuộc loại Sổ Văn bản đi');
    assert.equal(doc.signerName, 'ThS. Phạm Văn Tường', 'Người ký phải là Hiệu trưởng ThS. Phạm Văn Tường');
    assert.equal(doc.draftingDeptId, 'P_TCDBCL', 'Đơn vị soạn thảo là Phòng TC-ĐBCL');
    assert.equal(doc.documentYear, 2026, 'Năm văn bản là 2026');

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
        academicMonth: 9,
        academicYear: '2026-2027',
      },
      orderBy: { code: 'asc' },
      include: {
        assignees: true,
        department: true,
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
      assert.ok(task.departmentId, `Nhiệm vụ ${task.code} phải có đơn vị phụ trách`);
      assert.ok(task.assignees.length >= 1, `Nhiệm vụ ${task.code} phải có ít nhất 1 người được phân công (PRIMARY_OWNER)`);
      assert.ok(task.dueDate, `Nhiệm vụ ${task.code} phải có hạn hoàn thành (dueDate)`);

      const dueMonth = new Date(task.dueDate).getUTCMonth() + 1;
      assert.equal(dueMonth, 9, `Nhiệm vụ ${task.code} phải có hạn chót trong tháng 9`);
    }

    // Kiểm tra sự hiện diện của các đơn vị chủ chốt
    const deptIds = new Set(planTasks.map(t => t.departmentId));
    assert.ok(deptIds.has('P_TCDBCL'), 'Phải có nhiệm vụ của Phòng TC-ĐBCL');
    assert.ok(deptIds.has('P_QLDT'), 'Phải có nhiệm vụ của Phòng Quản lý Đào tạo');
    assert.ok(deptIds.has('P_TC'), 'Phải có nhiệm vụ của Phòng Tài chính');
    assert.ok(deptIds.has('P_HCQT'), 'Phải có nhiệm vụ của Phòng Hành chính - Quản trị');
    assert.ok(deptIds.has('P_TSHTQT'), 'Phải có nhiệm vụ của Phòng Tuyển sinh - HTQT');
    assert.ok(deptIds.has('TT_STT'), 'Phải có nhiệm vụ của Trung tâm Số - Truyền thông');
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
