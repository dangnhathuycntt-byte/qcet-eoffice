/**
 * SECURITY SPECIFICATION TEST SUITE: CANONICAL DOSSIER READ POLICY (RFC-09 OPTION B)
 *
 * Statutory & Architectural Basis:
 * - RFC-09: Canonical Dossier Read Policy Reconciliation (Option B - Scoped Item-Level Read Only)
 * - Decree 30/2020/NĐ-CP (Records Management & Clerical Work)
 * - Decree 13/2023/NĐ-CP (Personal Data Protection)
 * - ADR-002 (Hybrid 10-Step Authorization Engine)
 *
 * Invariants Verified:
 * 1. Contributor Scoped Read: canReadDossierItem => true for own item.
 * 2. Contributor Scoped Isolation: canReadDossierItem => false for other items.
 * 3. Dossier Invariant: DossierItem.addedById MUST NOT grant whole-dossier access (canReadDossier => false).
 * 4. Classification Boundary: RESTRICTED / PERSONAL_DATA dossiers deny same-unit members without direct role.
 * 5. Direct Relations Access: responsiblePersonId, submittedById, and archivedById have whole-dossier access.
 * 6. Executive & Archival Access: Institutional leaders and archivists have appropriate institutional access.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canReadDossier,
  canReadDossierItem,
  type DossierEntity,
  type DossierItemEntity,
} from '@/server/policies/dossier-policy';
import type { AuthenticatedUser } from '@/server/api/request-context';

describe('RFC-09 Option B: Canonical Dossier Read Policy Security Specification', () => {
  // Test Actors
  const contributorUser: AuthenticatedUser = {
    id: 'user_contributor_01',
    email: 'contributor@cdktcnqn.edu.vn',
    name: 'Nguyễn Văn Đóng Góp',
    role: 'CHUYEN_VIEN',
    departmentId: 'unit_training',
  };

  const otherOfficerUser: AuthenticatedUser = {
    id: 'user_officer_02',
    email: 'officer2@cdktcnqn.edu.vn',
    name: 'Trần Thị Chuyên Viên',
    role: 'CHUYEN_VIEN',
    departmentId: 'unit_admin',
  };

  const sameUnitMember: AuthenticatedUser = {
    id: 'user_same_unit_03',
    email: 'sameunit@cdktcnqn.edu.vn',
    name: 'Lê Văn Cùng Khoa',
    role: 'GIANG_VIEN',
    departmentId: 'unit_it',
  };

  const responsibleUser: AuthenticatedUser = {
    id: 'user_responsible_04',
    email: 'responsible@cdktcnqn.edu.vn',
    name: 'Phạm Văn Chủ Trì',
    role: 'CHUYEN_VIEN',
    departmentId: 'unit_it',
  };

  const submitterUser: AuthenticatedUser = {
    id: 'user_submitter_05',
    email: 'submitter@cdktcnqn.edu.vn',
    name: 'Hoàng Văn Nộp Lưu',
    role: 'CHUYEN_VIEN',
    departmentId: 'unit_it',
  };

  const archiverUser: AuthenticatedUser = {
    id: 'user_archiver_06',
    email: 'archiver@cdktcnqn.edu.vn',
    name: 'Đỗ Thị Tiếp Nhận',
    role: 'VAN_THU',
    positionCode: 'LUU_TRU',
    departmentId: 'unit_archives',
  };

  const rectorUser: AuthenticatedUser = {
    id: 'user_rector_07',
    email: 'rector@cdktcnqn.edu.vn',
    name: 'Hiệu Trưởng Nhà Trường',
    role: 'BAN_GIAM_HIEU',
    positionCode: 'HIEU_TRUONG',
    departmentId: 'unit_board',
  };

  // Test Items
  const itemA: DossierItemEntity = {
    id: 'item_a',
    itemId: '/files/dossiers/hs-01/report-contributor.pdf',
    addedById: 'user_contributor_01',
    dossierId: 'dossier_collab_01',
  };

  const itemB: DossierItemEntity = {
    id: 'item_b',
    itemId: '/files/dossiers/hs-01/financial-plan-confidential.pdf',
    addedById: 'user_other_officer_99',
    dossierId: 'dossier_collab_01',
  };

  // Baseline Collaborative Dossier
  const collaborativeDossier: DossierEntity = {
    id: 'dossier_collab_01',
    code: 'HS-2026-IT-001',
    title: 'Hồ sơ nâng cấp phòng thực hành máy tính',
    owningUnitId: 'unit_it',
    responsiblePersonId: 'user_responsible_04',
    submittedById: 'user_submitter_05',
    archivedById: 'user_archiver_06',
    status: 'ACTIVE',
    classification: 'INTERNAL',
    items: [itemA, itemB],
  };

  // Restricted Dossiers
  const restrictedDossier: DossierEntity = {
    id: 'dossier_restricted_02',
    code: 'HS-2026-IT-RESTRICTED',
    title: 'Hồ sơ kỷ luật cán bộ nội bộ đơn vị',
    owningUnitId: 'unit_it',
    responsiblePersonId: 'user_responsible_04',
    submittedById: 'user_submitter_05',
    archivedById: 'user_archiver_06',
    status: 'ACTIVE',
    classification: 'RESTRICTED',
    items: [itemA, itemB],
  };

  const personalDataDossier: DossierEntity = {
    id: 'dossier_personal_03',
    code: 'HS-2026-IT-PERSONAL',
    title: 'Hồ sơ bảo hiểm y tế và sức khỏe cán bộ',
    owningUnitId: 'unit_it',
    responsiblePersonId: 'user_responsible_04',
    submittedById: 'user_submitter_05',
    archivedById: 'user_archiver_06',
    status: 'ACTIVE',
    classification: 'PERSONAL_DATA',
    items: [itemA, itemB],
  };

  // --------------------------------------------------------------------------
  // 1. Contributor Scoped Read vs Whole Dossier Read (RFC-09 Invariant)
  // --------------------------------------------------------------------------
  describe('1. Contributor Scoped Item-Level Read Only (Option B Invariant)', () => {
    test('Contributor CANNOT read whole dossier via canReadDossier', () => {
      // Contributor added itemA to collaborativeDossier, but is not responsiblePerson,
      // not submitter, not archiver, and belongs to unit_training (owning unit is unit_it).
      const canRead = canReadDossier(contributorUser, collaborativeDossier);
      assert.strictEqual(
        canRead,
        false,
        'DossierItem.addedById MUST NOT grant whole-dossier read access'
      );
    });

    test('Contributor can access own item (item A) via canReadDossierItem => true', () => {
      const canReadOwn = canReadDossierItem(contributorUser, itemA, collaborativeDossier);
      assert.strictEqual(
        canReadOwn,
        true,
        'Item contributor must be allowed to read and download their own contributed item'
      );
    });

    test('Contributor CANNOT access other items (item B) via canReadDossierItem => false', () => {
      const canReadOther = canReadDossierItem(contributorUser, itemB, collaborativeDossier);
      assert.strictEqual(
        canReadOther,
        false,
        'Item contributor must NOT have access to items added by other users'
      );
    });

    test('Unrelated user CANNOT access item A or item B', () => {
      assert.strictEqual(canReadDossierItem(otherOfficerUser, itemA, collaborativeDossier), false);
      assert.strictEqual(canReadDossierItem(otherOfficerUser, itemB, collaborativeDossier), false);
      assert.strictEqual(canReadDossier(otherOfficerUser, collaborativeDossier), false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Data Classification: RESTRICTED & PERSONAL_DATA Boundaries
  // --------------------------------------------------------------------------
  describe('2. Data Classification Isolation (Nghị định 13/2023/NĐ-CP & ADR-002)', () => {
    test('RESTRICTED dossier denies same-unit members without direct role', () => {
      // sameUnitMember belongs to unit_it (owningUnitId), but is NOT responsiblePerson,
      // NOT submitter, NOT archiver, and NOT executive.
      const canRead = canReadDossier(sameUnitMember, restrictedDossier);
      assert.strictEqual(
        canRead,
        false,
        'Unit membership alone is NOT enough for RESTRICTED dossiers'
      );
    });

    test('PERSONAL_DATA dossier denies same-unit members without direct role', () => {
      const canRead = canReadDossier(sameUnitMember, personalDataDossier);
      assert.strictEqual(
        canRead,
        false,
        'Unit membership alone is NOT enough for PERSONAL_DATA dossiers'
      );
    });

    test('Non-restricted INTERNAL dossier allows same-unit members', () => {
      const canRead = canReadDossier(sameUnitMember, collaborativeDossier);
      assert.strictEqual(
        canRead,
        true,
        'Same-unit members should be allowed to read non-restricted INTERNAL dossiers'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 3. Direct Relationships: Responsible Person, Submitter, Archiver
  // --------------------------------------------------------------------------
  describe('3. Direct Role Authority across All Classifications', () => {
    test('responsiblePersonId has whole-dossier access (including RESTRICTED)', () => {
      assert.strictEqual(canReadDossier(responsibleUser, collaborativeDossier), true);
      assert.strictEqual(canReadDossier(responsibleUser, restrictedDossier), true);
      assert.strictEqual(canReadDossier(responsibleUser, personalDataDossier), true);

      // Responsible person can also read all items in the dossier
      assert.strictEqual(canReadDossierItem(responsibleUser, itemA, collaborativeDossier), true);
      assert.strictEqual(canReadDossierItem(responsibleUser, itemB, collaborativeDossier), true);
    });

    test('submittedById has whole-dossier access (including RESTRICTED)', () => {
      assert.strictEqual(canReadDossier(submitterUser, collaborativeDossier), true);
      assert.strictEqual(canReadDossier(submitterUser, restrictedDossier), true);
      assert.strictEqual(canReadDossier(submitterUser, personalDataDossier), true);

      // Submitter can also read all items in the dossier
      assert.strictEqual(canReadDossierItem(submitterUser, itemA, collaborativeDossier), true);
      assert.strictEqual(canReadDossierItem(submitterUser, itemB, collaborativeDossier), true);
    });

    test('archivedById has whole-dossier access (including RESTRICTED)', () => {
      assert.strictEqual(canReadDossier(archiverUser, collaborativeDossier), true);
      assert.strictEqual(canReadDossier(archiverUser, restrictedDossier), true);
      assert.strictEqual(canReadDossier(archiverUser, personalDataDossier), true);

      // Archiver can also read all items in the dossier
      assert.strictEqual(canReadDossierItem(archiverUser, itemA, collaborativeDossier), true);
      assert.strictEqual(canReadDossierItem(archiverUser, itemB, collaborativeDossier), true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Institutional Leadership (Executive / Rector)
  // --------------------------------------------------------------------------
  describe('4. Institutional Executive Supervision', () => {
    test('Institutional Executive (Rector) has whole-dossier read access across the school', () => {
      assert.strictEqual(canReadDossier(rectorUser, collaborativeDossier), true);
      assert.strictEqual(canReadDossier(rectorUser, restrictedDossier), true);
      assert.strictEqual(canReadDossier(rectorUser, personalDataDossier), true);

      // Executive can also read all items
      assert.strictEqual(canReadDossierItem(rectorUser, itemA, collaborativeDossier), true);
      assert.strictEqual(canReadDossierItem(rectorUser, itemB, collaborativeDossier), true);
    });
  });
});
