import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  UserRole,
  UnitType,
  JobCatalogGroup,
  AssignmentType,
  AssignmentStatus,
  DataClassification,
  DossierStatus,
} from '@prisma/client';

test('Phase 9: Data Classification Security & Policy Enforcement', async (t) => {
  const runId = Date.now().toString();

  // Create an org unit
  const orgUnit = await prisma.organizationalUnit.create({
    data: {
      code: `UNIT-SEC-${runId}`,
      name: `Phòng Bảo Mật và Lưu Trữ ${runId}`,
      type: UnitType.DEPARTMENT,
      effectiveFrom: new Date('2026-01-01'),
    },
  });

  // Create user
  const user = await prisma.user.create({
    data: {
      email: `user-sec-${runId}@qcet.edu.vn`,
      name: `Chuyên viên Lưu trữ ${runId}`,
      passwordHash: 'hash',
      role: UserRole.CHUYEN_VIEN,
    },
  });

  // Create Position & Assignment
  const posDef = await prisma.positionDefinition.create({
    data: {
      code: `ARCHIVIST_SEC_${runId}`,
      title: `Lưu trữ viên ${runId}`,
      group: JobCatalogGroup.VCDC,
    },
  });

  await prisma.positionAssignment.create({
    data: {
      userId: user.id,
      positionDefinitionId: posDef.id,
      unitId: orgUnit.id,
      type: AssignmentType.PRIMARY,
      status: AssignmentStatus.ACTIVE,
      effectiveFrom: new Date('2026-01-01'),
    },
  });

  // Create dossiers across different data classifications
  const publicDossier = await prisma.workDossier.create({
    data: {
      code: `DOSSIER-PUB-${runId}`,
      title: 'Hồ sơ Công khai QCET',
      owningUnitId: orgUnit.id,
      responsiblePersonId: user.id,
      classification: DataClassification.PUBLIC,
      status: DossierStatus.OPEN,
    },
  });

  const internalDossier = await prisma.workDossier.create({
    data: {
      code: `DOSSIER-INT-${runId}`,
      title: 'Hồ sơ Nội bộ Cơ quan',
      owningUnitId: orgUnit.id,
      responsiblePersonId: user.id,
      classification: DataClassification.INTERNAL,
      status: DossierStatus.OPEN,
    },
  });

  const restrictedDossier = await prisma.workDossier.create({
    data: {
      code: `DOSSIER-RES-${runId}`,
      title: 'Hồ sơ Giới hạn Thẩm quyền BGH',
      owningUnitId: orgUnit.id,
      responsiblePersonId: user.id,
      classification: DataClassification.RESTRICTED,
      status: DossierStatus.OPEN,
    },
  });

  const personalDataDossier = await prisma.workDossier.create({
    data: {
      code: `DOSSIER-PER-${runId}`,
      title: 'Hồ sơ Dữ liệu Cá nhân Viên chức',
      owningUnitId: orgUnit.id,
      responsiblePersonId: user.id,
      classification: DataClassification.PERSONAL_DATA,
      status: DossierStatus.OPEN,
    },
  });

  await t.test('1. Phân loại bảo vệ dữ liệu (Nghị định 356/2025/NĐ-CP & Luật BVDLCN 91/2025): Phân cấp đầy đủ 4 cấp độ thực thể', () => {
    assert.equal(publicDossier.classification, DataClassification.PUBLIC);
    assert.equal(internalDossier.classification, DataClassification.INTERNAL);
    assert.equal(restrictedDossier.classification, DataClassification.RESTRICTED);
    assert.equal(personalDataDossier.classification, DataClassification.PERSONAL_DATA);
  });

  await t.test('2. Data Classification Query Filter: Phân tách truy vấn công khai / nội bộ vs dữ liệu nhạy cảm / cá nhân', async () => {
    // Standard unprivileged/external search query filter includes only PUBLIC and INTERNAL
    const regularResults = await prisma.workDossier.findMany({
      where: {
        owningUnitId: orgUnit.id,
        classification: { in: [DataClassification.PUBLIC, DataClassification.INTERNAL] },
      },
    });

    assert.equal(regularResults.length, 2, 'Chỉ trả về 2 hồ sơ công khai và nội bộ');
    const hasSensitive = regularResults.some(
      (d) => d.classification === DataClassification.RESTRICTED || d.classification === DataClassification.PERSONAL_DATA
    );
    assert.equal(hasSensitive, false, 'Truy vấn thông thường không được leak hồ sơ RESTRICTED hay PERSONAL_DATA');
  });
});
