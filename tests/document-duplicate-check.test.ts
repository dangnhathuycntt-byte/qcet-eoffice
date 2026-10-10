/**
 * V-02 (spec task-document-gap-spec.md): cảnh báo văn bản đến trùng số ký hiệu và
 * cơ quan ban hành. Phần DB chạy trên qcet_test và chỉ xóa bản ghi do test tạo.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentType } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import {
  isPlaceholderDocumentNumber,
  isSameIncomingDocument,
  normalizeDocumentNumber,
  normalizeIssuingAuthority,
} from '../src/domain/documents/duplicate-key';
import {
  assertNoSuspectedDuplicate,
  findSuspectedDuplicates,
  DUPLICATE_SUSPECT_CODE,
} from '../src/lib/documents/duplicate-check';
import { ConflictError } from '../src/server/api/errors';

describe('V-02 chuẩn hóa khóa trùng', () => {
  test('bỏ khác biệt hoa thường, khoảng trắng thừa, khoảng trắng quanh dấu /', () => {
    assert.equal(normalizeDocumentNumber('  214 / cv-đt '), '214/CV-ĐT');
    assert.equal(normalizeIssuingAuthority('  Sở  Giáo dục  '), 'sở giáo dục');
  });

  test('số mặc định không bao giờ trùng', () => {
    assert.equal(isPlaceholderDocumentNumber('CHƯA_CÓ_SỐ'), true);
    assert.equal(
      isSameIncomingDocument(
        { originalNumber: 'CHƯA_CÓ_SỐ', issuingAuthority: 'A' },
        { originalNumber: 'CHƯA_CÓ_SỐ', issuingAuthority: 'A' }
      ),
      false
    );
  });

  test('khác cơ quan ban hành thì không trùng', () => {
    assert.equal(
      isSameIncomingDocument(
        { originalNumber: '12/QĐ', issuingAuthority: 'UBND tỉnh' },
        { originalNumber: '12/QĐ', issuingAuthority: 'Sở Tài chính' }
      ),
      false
    );
  });
});

describe('V-02 truy vấn trùng có lọc quyền đọc', () => {
  const runId = `v02_${Date.now()}`;
  const number = `${runId}/CV-ĐT`;
  const authority = 'Sở Giáo dục và Đào tạo';
  let registrarId = '';
  let docId = '';

  const clerk = () => ({ id: `${runId}_clerk`, email: 'c@x', name: 'Văn thư', role: 'VAN_THU' });
  const outsider = () => ({ id: `${runId}_staff`, email: 's@x', name: 'Chuyên viên', role: 'CHUYEN_VIEN' });

  before(async () => {
    const user = await prisma.user.create({
      data: { email: `${runId}@cdktcnqn.edu.vn`, name: `${runId} registrar`, role: 'VAN_THU' },
    });
    registrarId = user.id;
    const doc = await prisma.document.create({
      data: {
        type: DocumentType.VAN_BAN_DEN,
        registrationNumber: 900000 + Math.floor(Math.random() * 99999),
        documentYear: 2026,
        originalNumber: number,
        issuedDate: new Date('2026-10-01'),
        issuingAuthority: authority,
        category: 'Công văn',
        summary: 'Kế hoạch tuyển sinh',
        registeredById: registrarId,
      },
    });
    docId = doc.id;
  });

  after(async () => {
    if (docId) await prisma.document.delete({ where: { id: docId } });
    if (registrarId) await prisma.user.delete({ where: { id: registrarId } });
  });

  test('văn thư thấy văn bản trùng dù khác hoa thường ở cơ quan ban hành', async () => {
    const matches = await findSuspectedDuplicates(clerk(), {
      originalNumber: number.toLowerCase(),
      issuingAuthority: '  sở giáo dục và đào tạo ',
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0].id, docId);
  });

  test('người không có quyền đọc không thấy văn bản trùng', async () => {
    const matches = await findSuspectedDuplicates(outsider(), { originalNumber: number, issuingAuthority: authority });
    assert.equal(matches.length, 0);
  });

  test('chặn bằng 409 DUPLICATE_SUSPECT, cho qua khi đã xác nhận', async () => {
    await assert.rejects(
      assertNoSuspectedDuplicate(clerk(), { originalNumber: number, issuingAuthority: authority }),
      (err: unknown) => err instanceof ConflictError && err.code === DUPLICATE_SUSPECT_CODE && err.statusCode === 409
    );
    await assertNoSuspectedDuplicate(clerk(), {
      originalNumber: number,
      issuingAuthority: authority,
      acknowledgeDuplicate: true,
    });
  });

  test('loại trừ chính văn bản đang sửa', async () => {
    const matches = await findSuspectedDuplicates(
      clerk(),
      { originalNumber: number, issuingAuthority: authority },
      { excludeId: docId }
    );
    assert.equal(matches.length, 0);
  });
});
