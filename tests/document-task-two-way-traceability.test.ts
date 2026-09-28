import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toTaskDetailDTO } from '@/server/dto/task-dto';
import { mapPrismaTaskToSchoolTask, mapPrismaTaskToStaffTask } from '@/lib/adapters/task-db-adapter';
import { mapPrismaDocumentToItem } from '@/lib/documents/document-service';

describe('Document-Task Two-Way Traceability', () => {
  const mockLinkedDocument = {
    id: 'doc-123',
    originalNumber: '128/TCGDNN-VP',
    summary: 'V/v triển khai công tác chuyển đổi số năm học 2026-2027',
    type: 'VAN_BAN_DEN',
    issuedDate: new Date('2026-09-01T00:00:00.000Z'),
    issuingAuthority: 'Tổng cục Giáo dục nghề nghiệp',
    registrationNumber: 42,
    documentYear: 2026,
    status: 'DANG_XU_LY',
  };

  const mockPrismaTask: any = {
    id: 'task-456',
    code: 'TSK-2026-001',
    title: 'Xây dựng kế hoạch chuyển đổi số',
    description: 'Chi tiết kế hoạch triển khai',
    scope: 'SCHOOL',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    progressPercent: 50,
    academicMonth: 9,
    academicYear: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    dueDate: new Date('2026-09-30T00:00:00.000Z'),
    version: 1,
    actors: [
      {
        userId: 'user-1',
        role: 'DRI',
        isPrimaryDRI: true,
        user: { id: 'user-1', name: 'Nguyễn Văn A', avatarUrl: null },
      },
    ],
    leadUnit: {
      id: 'unit-cntt',
      code: 'CNTT',
      name: 'Khoa Công nghệ thông tin',
    },
    linkedDocument: mockLinkedDocument,
  };

  it('toTaskDetailDTO maps linkedDocument to sourceDocument correctly', () => {
    const dto = toTaskDetailDTO(mockPrismaTask);
    assert.ok(dto !== null);
    assert.ok(dto.sourceDocument !== null && dto.sourceDocument !== undefined);
    assert.equal(dto.sourceDocument.id, 'doc-123');
    assert.equal(dto.sourceDocument.originalNumber, '128/TCGDNN-VP');
    assert.equal(dto.sourceDocument.summary, 'V/v triển khai công tác chuyển đổi số năm học 2026-2027');
    assert.equal(dto.sourceDocument.type, 'VAN_BAN_DEN');
    assert.equal(dto.sourceDocument.issuingAuthority, 'Tổng cục Giáo dục nghề nghiệp');
    assert.equal(dto.sourceDocument.registrationNumber, 42);
    assert.equal(dto.sourceDocument.documentYear, 2026);
    assert.equal(dto.sourceDocument.status, 'DANG_XU_LY');
    assert.ok(dto.sourceDocument.issuedDate.includes('2026-09-01'));
  });

  it('toTaskDetailDTO returns null sourceDocument when linkedDocument is null or missing', () => {
    const taskWithoutDoc = { ...mockPrismaTask, linkedDocument: null };
    const dto = toTaskDetailDTO(taskWithoutDoc);
    assert.ok(dto !== null);
    assert.equal(dto.sourceDocument, null);
  });

  it('mapPrismaTaskToSchoolTask maps linkedDocument to sourceDocument', () => {
    const schoolTask = mapPrismaTaskToSchoolTask(mockPrismaTask);
    assert.ok(schoolTask.sourceDocument !== null && schoolTask.sourceDocument !== undefined);
    assert.equal(schoolTask.sourceDocument.id, 'doc-123');
    assert.equal(schoolTask.sourceDocument.originalNumber, '128/TCGDNN-VP');
    assert.equal(schoolTask.sourceDocument.summary, 'V/v triển khai công tác chuyển đổi số năm học 2026-2027');
    assert.equal(schoolTask.sourceDocument.type, 'VAN_BAN_DEN');
    assert.equal(schoolTask.sourceDocument.registrationNumber, 42);
    assert.equal(schoolTask.sourceDocument.documentYear, 2026);
    assert.equal(schoolTask.sourceDocument.status, 'DANG_XU_LY');
  });

  it('mapPrismaTaskToStaffTask maps linkedDocument to sourceDocument', () => {
    const staffTask = mapPrismaTaskToStaffTask(mockPrismaTask);
    assert.ok(staffTask.sourceDocument !== null && staffTask.sourceDocument !== undefined);
    assert.equal(staffTask.sourceDocument.id, 'doc-123');
    assert.equal(staffTask.sourceDocument.originalNumber, '128/TCGDNN-VP');
    assert.equal(staffTask.sourceDocument.type, 'VAN_BAN_DEN');
    assert.equal(staffTask.sourceDocument.status, 'DANG_XU_LY');
  });

  it('maps linked task status and progress onto the document detail model', () => {
    const document = mapPrismaDocumentToItem({
      id: 'doc-123',
      type: 'VAN_BAN_DEN',
      registrationNumber: 42,
      documentYear: 2026,
      registeredDate: new Date('2026-09-01T00:00:00.000Z'),
      originalNumber: '128/TCGDNN-VP',
      issuedDate: new Date('2026-09-01T00:00:00.000Z'),
      issuingAuthority: 'Tổng cục Giáo dục nghề nghiệp',
      category: 'Công văn',
      summary: 'V/v triển khai công tác chuyển đổi số',
      urgency: 'THUONG',
      securityLevel: 'THUONG',
      status: 'DANG_XU_LY',
      registeredById: 'clerk-1',
      linkedTaskId: 'task-456',
      linkedTask: {
        id: 'task-456',
        code: 'TSK-2026-001',
        title: 'Xây dựng kế hoạch chuyển đổi số',
        status: 'IN_PROGRESS',
        progressPercent: 50,
        dueDate: new Date('2026-09-30T00:00:00.000Z'),
      },
    });

    assert.deepEqual(document.linkedTask, {
      id: 'task-456',
      code: 'TSK-2026-001',
      title: 'Xây dựng kế hoạch chuyển đổi số',
      status: 'IN_PROGRESS',
      progressPercent: 50,
      dueDate: '2026-09-30T00:00:00.000Z',
    });
  });

  it('mapPrismaTaskToSchoolTask handles null linkedDocument gracefully', () => {
    const taskWithoutDoc = { ...mockPrismaTask, linkedDocument: null };
    const schoolTask = mapPrismaTaskToSchoolTask(taskWithoutDoc);
    assert.equal(schoolTask.sourceDocument, null);
  });
});
