import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AuthenticatedUser } from '@/server/api/request-context';
import {
  canReadDocument,
  canCreateDocument,
  canUpdateDocument,
  canDirectDocument,
  canDeleteDocument,
  type DocumentEntity,
} from '@/server/policies/document-policy';
import { canReadNotification, type NotificationEntity } from '@/server/policies/notification-policy';
import * as PoliciesIndex from '@/server/policies';

// Sample Users representing different roles & departments
const adminUser: AuthenticatedUser = {
  id: 'u-admin-1',
  email: 'admin@qcet.edu.vn',
  name: 'Admin User',
  role: 'ADMIN',
  departmentId: null,
};

const bghUser: AuthenticatedUser = {
  id: 'u-bgh-1',
  email: 'bgh@qcet.edu.vn',
  name: 'Hiệu Trưởng BGH',
  role: 'BAN_GIAM_HIEU',
  departmentId: null,
};

const managerDeptA: AuthenticatedUser = {
  id: 'u-mgr-a',
  email: 'truongphong.cntt@qcet.edu.vn',
  name: 'Trưởng Phòng CNTT',
  role: 'TRUONG_PHONG',
  departmentId: 'dept-cntt',
};

const managerDeptB: AuthenticatedUser = {
  id: 'u-mgr-b',
  email: 'truongphong.dt@qcet.edu.vn',
  name: 'Trưởng Phòng Đào Tạo',
  role: 'MANAGER',
  departmentId: 'dept-daotao',
};

const staffDeptA: AuthenticatedUser = {
  id: 'u-staff-a1',
  email: 'chuyenvien1@qcet.edu.vn',
  name: 'Chuyên Viên CNTT 1',
  role: 'CHUYEN_VIEN',
  departmentId: 'dept-cntt',
};

const staffDeptA2: AuthenticatedUser = {
  id: 'u-staff-a2',
  email: 'chuyenvien2@qcet.edu.vn',
  name: 'Chuyên Viên CNTT 2',
  role: 'STAFF',
  departmentId: 'dept-cntt',
};

const staffDeptB: AuthenticatedUser = {
  id: 'u-staff-b1',
  email: 'chuyenvien.dt@qcet.edu.vn',
  name: 'Chuyên Viên Đào Tạo',
  role: 'STAFF',
  departmentId: 'dept-daotao',
};

const clerkUser: AuthenticatedUser = {
  id: 'u-clerk-1',
  email: 'vanthu@qcet.edu.vn',
  name: 'Văn Thư Trường',
  role: 'VAN_THU',
  departmentId: 'dept-hanhchinh',
};

describe('Document Authorization Policy (document-policy.ts)', () => {
  const publicDoc: DocumentEntity = {
    id: 'doc-pub-1',
    // Phase 9: DocumentEntity dùng `leadUnitId` (OrganizationalUnit canonical).
    leadUnitId: 'dept-cntt',
    creatorId: 'u-mgr-a',
    scope: 'SCHOOL',
    isPublic: true,
  };

  const internalDeptADoc: DocumentEntity = {
    id: 'doc-priv-a',
    leadUnitId: 'dept-cntt',
    creatorId: 'u-mgr-a',
    scope: 'DEPARTMENT',
    isPublic: false,
  };

  describe('canReadDocument', () => {
    it('allows all authenticated users to read public documents', () => {
      assert.strictEqual(canReadDocument(adminUser, publicDoc), true);
      assert.strictEqual(canReadDocument(staffDeptA, publicDoc), true);
      assert.strictEqual(canReadDocument(staffDeptB, publicDoc), true);
      assert.strictEqual(canReadDocument(clerkUser, publicDoc), true);
    });

    it('allows BAN_GIAM_HIEU and VAN_THU to read internal documents, while ADMIN without business relation is restricted', () => {
      assert.strictEqual(canReadDocument(bghUser, internalDeptADoc), true);
      assert.strictEqual(canReadDocument(clerkUser, internalDeptADoc), true);
      assert.strictEqual(canReadDocument(adminUser, internalDeptADoc), false, 'System Admin cannot access internal business documents (Separation of Powers)');
    });

    it('allows creator and users from same department to read internal documents', () => {
      assert.strictEqual(canReadDocument(managerDeptA, internalDeptADoc), true);
      assert.strictEqual(canReadDocument(staffDeptA, internalDeptADoc), true);
    });

    it('BOLA: rejects users from other departments from reading private documents', () => {
      assert.strictEqual(canReadDocument(managerDeptB, internalDeptADoc), false);
      assert.strictEqual(canReadDocument(staffDeptB, internalDeptADoc), false);
    });
  });

  describe('canCreateDocument', () => {
    it('allows authenticated users to create documents', () => {
      assert.strictEqual(canCreateDocument(adminUser), true);
      assert.strictEqual(canCreateDocument(managerDeptA), true);
      assert.strictEqual(canCreateDocument(staffDeptA), true);
      assert.strictEqual(canCreateDocument(clerkUser), true);
    });

    it('refuses incoming documents for everyone, clerk included (ADR-015)', () => {
      for (const user of [adminUser, managerDeptA, staffDeptA, clerkUser]) {
        assert.strictEqual(canCreateDocument(user, 'VAN_BAN_DEN'), false);
        assert.strictEqual(canCreateDocument(user, 'TO_TRINH_NOI_BO'), true);
      }
    });
  });

  describe('canUpdateDocument', () => {
    it('allows VAN_THU and department manager to update document, while foreign admin is restricted', () => {
      assert.strictEqual(canUpdateDocument(clerkUser, internalDeptADoc), true);
      assert.strictEqual(canUpdateDocument(managerDeptA, internalDeptADoc), true);
      assert.strictEqual(canUpdateDocument(adminUser, internalDeptADoc), false, 'System Admin cannot update internal business documents (Separation of Powers)');
    });

    it('allows staff creator to update their document', () => {
      const staffDoc: DocumentEntity = {
        id: 'doc-staff',
        leadUnitId: 'dept-cntt',
        creatorId: 'u-staff-a1',
        isPublic: false,
      };
      assert.strictEqual(canUpdateDocument(staffDeptA, staffDoc), true);
    });

    it('BOLA: rejects users from another department or non-creator staff', () => {
      assert.strictEqual(canUpdateDocument(managerDeptB, internalDeptADoc), false);
      assert.strictEqual(canUpdateDocument(staffDeptB, internalDeptADoc), false);
      assert.strictEqual(canUpdateDocument(staffDeptA, internalDeptADoc), false);
    });
  });

  describe('canDirectDocument (Bút phê / Chỉ đạo)', () => {
    it('allows BAN_GIAM_HIEU to direct documents, while ADMIN without statutory authority is restricted', () => {
      assert.strictEqual(canDirectDocument(bghUser, internalDeptADoc), true);
      assert.strictEqual(canDirectDocument(adminUser, internalDeptADoc), false, 'System Admin cannot direct documents without statutory leadership assignment');
    });

    it('allows department manager (TRUONG_PHONG) to direct documents in their department', () => {
      assert.strictEqual(canDirectDocument(managerDeptA, internalDeptADoc), true);
    });

    it('BOLA: rejects department manager from directing document of another department', () => {
      assert.strictEqual(canDirectDocument(managerDeptB, internalDeptADoc), false);
    });

    it('rejects STAFF and VAN_THU from directing documents', () => {
      assert.strictEqual(canDirectDocument(staffDeptA, internalDeptADoc), false);
      assert.strictEqual(canDirectDocument(clerkUser, internalDeptADoc), false);
    });
  });

  describe('canDeleteDocument', () => {
    it('allows creator and department manager to delete document, while foreign admin is restricted', () => {
      assert.strictEqual(canDeleteDocument(managerDeptA, internalDeptADoc), true);
      assert.strictEqual(canDeleteDocument(adminUser, internalDeptADoc), false, 'System Admin cannot delete unit documents without creator or manager role');
    });

    it('BOLA: rejects foreign department manager and non-creator staff', () => {
      assert.strictEqual(canDeleteDocument(managerDeptB, internalDeptADoc), false);
      assert.strictEqual(canDeleteDocument(staffDeptA, internalDeptADoc), false);
    });
  });
});

describe('Notification Authorization Policy (notification-policy.ts)', () => {
  const notifUserA: NotificationEntity = {
    id: 'notif-1',
    userId: 'u-staff-a1',
    title: 'Nhiệm vụ mới',
  };

  describe('canReadNotification (Strict BOLA Protection)', () => {
    it('allows the notification recipient to read their notification', () => {
      assert.strictEqual(canReadNotification(staffDeptA, notifUserA), true);
    });

    it('BOLA: strictly rejects other users, managers, and even admin from reading another users notification', () => {
      assert.strictEqual(canReadNotification(staffDeptA2, notifUserA), false);
      assert.strictEqual(canReadNotification(managerDeptA, notifUserA), false);
      assert.strictEqual(canReadNotification(adminUser, notifUserA), false);
    });
  });
});
