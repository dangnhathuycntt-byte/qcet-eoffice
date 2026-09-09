import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AuthenticatedUser } from '@/server/api/request-context';
import {
  canReadTask,
  canCreateTask,
  canUpdateTask,
  canChangeTaskStatus,
  canApproveTask,
  canSubmitDeliverable,
  canDeleteTask,
  type TaskEntity,
} from '@/server/policies/task-policy';
import {
  canReadDocument,
  canCreateDocument,
  canUpdateDocument,
  canDirectDocument,
  canDeleteDocument,
  type DocumentEntity,
} from '@/server/policies/document-policy';
import {
  canReadNotification,
  canDeleteNotification,
  type NotificationEntity,
} from '@/server/policies/notification-policy';
import {
  canViewUser,
  canUpdateUserRole,
  canOnboardUser,
} from '@/server/policies/user-policy';
import {
  canAccessExecutiveResolutions,
  canCreateResolution,
  canManageResolution,
} from '@/server/policies/executive-policy';
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

describe('Task Authorization Policy (task-policy.ts)', () => {
  const taskDeptA: TaskEntity = {
    id: 'task-101',
    departmentId: 'dept-cntt',
    creatorId: 'u-mgr-a',
    assigneeId: 'u-staff-a1',
    collaboratorIds: ['u-staff-a2'],
    status: 'IN_PROGRESS',
    scope: 'DEPARTMENT',
  };

  const personalTaskDeptA: TaskEntity = {
    id: 'task-102',
    departmentId: null,
    creatorId: 'u-staff-a1',
    assigneeId: 'u-staff-a1',
    collaboratorIds: null,
    status: 'IN_PROGRESS',
    scope: 'PERSONAL',
  };

  describe('canReadTask', () => {
    it('allows ADMIN and BAN_GIAM_HIEU to read any task', () => {
      assert.strictEqual(canReadTask(adminUser, taskDeptA), true);
      assert.strictEqual(canReadTask(bghUser, taskDeptA), true);
      assert.strictEqual(canReadTask(adminUser, personalTaskDeptA), true);
    });

    it('allows creator, assignee, and collaborators to read their task', () => {
      assert.strictEqual(canReadTask(managerDeptA, taskDeptA), true); // creator
      assert.strictEqual(canReadTask(staffDeptA, taskDeptA), true); // assignee
      assert.strictEqual(canReadTask(staffDeptA2, taskDeptA), true); // collaborator
    });

    it('allows collaborator when collaboratorIds is a comma-separated string or JSON string', () => {
      const taskWithCsvCollabs: TaskEntity = {
        id: 'task-csv',
        departmentId: 'dept-cntt',
        creatorId: 'u-mgr-a',
        assigneeId: 'u-staff-a1',
        collaboratorIds: 'u-staff-a2, u-other',
      };
      assert.strictEqual(canReadTask(staffDeptA2, taskWithCsvCollabs), true);

      const taskWithJsonCollabs: TaskEntity = {
        id: 'task-json',
        departmentId: 'dept-cntt',
        creatorId: 'u-mgr-a',
        assigneeId: 'u-staff-a1',
        collaboratorIds: JSON.stringify(['u-staff-a2']),
      };
      assert.strictEqual(canReadTask(staffDeptA2, taskWithJsonCollabs), true);
    });

    it('allows department manager to read tasks of their department', () => {
      assert.strictEqual(canReadTask(managerDeptA, taskDeptA), true);
    });

    it('allows department staff to read department tasks in their department', () => {
      // staff in dept-cntt not assigned directly can read department task
      const unassignedStaffInDeptA: AuthenticatedUser = {
        id: 'u-staff-unassigned',
        email: 'unassigned@qcet.edu.vn',
        name: 'Unassigned Dept A Staff',
        role: 'STAFF',
        departmentId: 'dept-cntt',
      };
      assert.strictEqual(canReadTask(unassignedStaffInDeptA, taskDeptA), true);
    });

    it('BOLA: rejects user/manager from another department accessing task (Manager A -> Task B)', () => {
      assert.strictEqual(canReadTask(managerDeptB, taskDeptA), false);
      assert.strictEqual(canReadTask(staffDeptB, taskDeptA), false);
    });

    it('BOLA: rejects unrelated users from reading personal tasks', () => {
      assert.strictEqual(canReadTask(staffDeptA2, personalTaskDeptA), false);
      assert.strictEqual(canReadTask(managerDeptA, personalTaskDeptA), false);
      assert.strictEqual(canReadTask(managerDeptB, personalTaskDeptA), false);
    });
  });

  describe('canCreateTask', () => {
    it('allows ADMIN to create task for any department or null', () => {
      assert.strictEqual(canCreateTask(adminUser, 'dept-cntt'), true);
      assert.strictEqual(canCreateTask(adminUser, 'dept-daotao'), true);
      assert.strictEqual(canCreateTask(adminUser, null), true);
    });

    it('allows MANAGER to create task for their own department or personal', () => {
      assert.strictEqual(canCreateTask(managerDeptA, 'dept-cntt'), true);
      assert.strictEqual(canCreateTask(managerDeptA, null), true);
    });

    it('BOLA: rejects MANAGER creating task for another department', () => {
      assert.strictEqual(canCreateTask(managerDeptA, 'dept-daotao'), false);
    });

    it('allows STAFF to create task for their own department or personal', () => {
      assert.strictEqual(canCreateTask(staffDeptA, 'dept-cntt'), true);
      assert.strictEqual(canCreateTask(staffDeptA, null), true);
    });

    it('BOLA: rejects STAFF creating task for another department', () => {
      assert.strictEqual(canCreateTask(staffDeptA, 'dept-daotao'), false);
    });
  });

  describe('canUpdateTask', () => {
    it('allows ADMIN and BAN_GIAM_HIEU to update any task', () => {
      assert.strictEqual(canUpdateTask(adminUser, taskDeptA), true);
      assert.strictEqual(canUpdateTask(bghUser, taskDeptA), true);
    });

    it('allows creator and assignee to update task', () => {
      assert.strictEqual(canUpdateTask(managerDeptA, taskDeptA), true); // creator
      assert.strictEqual(canUpdateTask(staffDeptA, taskDeptA), true); // assignee
    });

    it('allows department manager to update task of their department', () => {
      assert.strictEqual(canUpdateTask(managerDeptA, taskDeptA), true);
    });

    it('BOLA: rejects manager from another department (Manager B -> Task A)', () => {
      assert.strictEqual(canUpdateTask(managerDeptB, taskDeptA), false);
    });

    it('BOLA: rejects unrelated staff from updating task', () => {
      assert.strictEqual(canUpdateTask(staffDeptB, taskDeptA), false);
      // staffDeptA2 is collaborator only, canUpdateTask is for core task updates
      assert.strictEqual(canUpdateTask(staffDeptA2, taskDeptA), false);
    });
  });

  describe('canApproveTask (Separation of Duties & Authorization)', () => {
    it('allows ADMIN and BAN_GIAM_HIEU to approve tasks', () => {
      assert.strictEqual(canApproveTask(adminUser, taskDeptA), true);
      assert.strictEqual(canApproveTask(bghUser, taskDeptA), true);
    });

    it('allows department manager to approve tasks in their department (when not the assignee)', () => {
      assert.strictEqual(canApproveTask(managerDeptA, taskDeptA), true);
    });

    it('BOLA: rejects manager from another department from approving task', () => {
      assert.strictEqual(canApproveTask(managerDeptB, taskDeptA), false);
    });

    it('Separation of Duties: rejects STAFF from approving task', () => {
      assert.strictEqual(canApproveTask(staffDeptA, taskDeptA), false);
      assert.strictEqual(canApproveTask(staffDeptA2, taskDeptA), false);
      assert.strictEqual(canApproveTask(staffDeptB, taskDeptA), false);
    });

    it('Separation of Duties: rejects MANAGER from self-approving if they are the assignee', () => {
      const managerAssignedTask: TaskEntity = {
        id: 'task-mgr-assigned',
        departmentId: 'dept-cntt',
        creatorId: 'u-admin-1',
        assigneeId: 'u-mgr-a', // manager is assignee
        status: 'IN_PROGRESS',
      };
      assert.strictEqual(canApproveTask(managerDeptA, managerAssignedTask), false);
    });
  });

  describe('canChangeTaskStatus', () => {
    it('delegates to canApproveTask when transitioning to COMPLETED or DONE', () => {
      assert.strictEqual(canChangeTaskStatus(adminUser, taskDeptA, 'COMPLETED'), true);
      assert.strictEqual(canChangeTaskStatus(managerDeptA, taskDeptA, 'COMPLETED'), true);
      // Staff cannot complete
      assert.strictEqual(canChangeTaskStatus(staffDeptA, taskDeptA, 'COMPLETED'), false);
      // Foreign manager cannot complete
      assert.strictEqual(canChangeTaskStatus(managerDeptB, taskDeptA, 'COMPLETED'), false);
    });

    it('allows assignee, creator, dept manager, and admin to change status to IN_PROGRESS', () => {
      assert.strictEqual(canChangeTaskStatus(staffDeptA, taskDeptA, 'IN_PROGRESS'), true);
      assert.strictEqual(canChangeTaskStatus(managerDeptA, taskDeptA, 'IN_PROGRESS'), true);
      assert.strictEqual(canChangeTaskStatus(adminUser, taskDeptA, 'IN_PROGRESS'), true);
      assert.strictEqual(canChangeTaskStatus(managerDeptB, taskDeptA, 'IN_PROGRESS'), false);
    });

    it('allows creator, dept manager, and admin to cancel task', () => {
      assert.strictEqual(canChangeTaskStatus(managerDeptA, taskDeptA, 'CANCELLED'), true);
      assert.strictEqual(canChangeTaskStatus(adminUser, taskDeptA, 'CANCELLED'), true);
      assert.strictEqual(canChangeTaskStatus(staffDeptA, taskDeptA, 'CANCELLED'), false);
      assert.strictEqual(canChangeTaskStatus(managerDeptB, taskDeptA, 'CANCELLED'), false);
    });
  });

  describe('canSubmitDeliverable', () => {
    it('allows assignee and collaborator to submit deliverable', () => {
      assert.strictEqual(canSubmitDeliverable(staffDeptA, taskDeptA), true);
      assert.strictEqual(canSubmitDeliverable(staffDeptA2, taskDeptA), true);
    });

    it('allows department manager and admin to submit deliverable', () => {
      assert.strictEqual(canSubmitDeliverable(managerDeptA, taskDeptA), true);
      assert.strictEqual(canSubmitDeliverable(adminUser, taskDeptA), true);
    });

    it('rejects deliverable submission when task is CANCELLED', () => {
      const cancelledTask: TaskEntity = { ...taskDeptA, status: 'CANCELLED' };
      assert.strictEqual(canSubmitDeliverable(staffDeptA, cancelledTask), false);
      assert.strictEqual(canSubmitDeliverable(adminUser, cancelledTask), false);
    });

    it('rejects unrelated users from submitting deliverable', () => {
      assert.strictEqual(canSubmitDeliverable(staffDeptB, taskDeptA), false);
      assert.strictEqual(canSubmitDeliverable(managerDeptB, taskDeptA), false);
    });
  });

  describe('canDeleteTask', () => {
    it('allows ADMIN to delete any task', () => {
      assert.strictEqual(canDeleteTask(adminUser, taskDeptA), true);
      assert.strictEqual(canDeleteTask(bghUser, taskDeptA), true);
    });

    it('allows creator to delete their task', () => {
      assert.strictEqual(canDeleteTask(managerDeptA, taskDeptA), true);
      assert.strictEqual(canDeleteTask(staffDeptA, personalTaskDeptA), true);
    });

    it('allows department manager to delete task in their department', () => {
      const taskCreatedByStaff: TaskEntity = {
        id: 'task-by-staff',
        departmentId: 'dept-cntt',
        creatorId: 'u-staff-a1',
      };
      assert.strictEqual(canDeleteTask(managerDeptA, taskCreatedByStaff), true);
    });

    it('BOLA: rejects manager from another department from deleting task', () => {
      assert.strictEqual(canDeleteTask(managerDeptB, taskDeptA), false);
    });

    it('rejects staff from deleting tasks they did not create', () => {
      assert.strictEqual(canDeleteTask(staffDeptA2, taskDeptA), false);
      assert.strictEqual(canDeleteTask(staffDeptB, taskDeptA), false);
    });
  });
});

describe('Document Authorization Policy (document-policy.ts)', () => {
  const publicDoc: DocumentEntity = {
    id: 'doc-pub-1',
    departmentId: 'dept-cntt',
    creatorId: 'u-mgr-a',
    scope: 'SCHOOL',
    isPublic: true,
  };

  const internalDeptADoc: DocumentEntity = {
    id: 'doc-priv-a',
    departmentId: 'dept-cntt',
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

    it('allows ADMIN, BAN_GIAM_HIEU, and VAN_THU to read private documents', () => {
      assert.strictEqual(canReadDocument(adminUser, internalDeptADoc), true);
      assert.strictEqual(canReadDocument(bghUser, internalDeptADoc), true);
      assert.strictEqual(canReadDocument(clerkUser, internalDeptADoc), true);
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
  });

  describe('canUpdateDocument', () => {
    it('allows ADMIN, VAN_THU, creator, and department manager to update document', () => {
      assert.strictEqual(canUpdateDocument(adminUser, internalDeptADoc), true);
      assert.strictEqual(canUpdateDocument(clerkUser, internalDeptADoc), true);
      assert.strictEqual(canUpdateDocument(managerDeptA, internalDeptADoc), true);
    });

    it('allows staff creator to update their document', () => {
      const staffDoc: DocumentEntity = {
        id: 'doc-staff',
        departmentId: 'dept-cntt',
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
    it('allows BAN_GIAM_HIEU and ADMIN to direct any document', () => {
      assert.strictEqual(canDirectDocument(adminUser, internalDeptADoc), true);
      assert.strictEqual(canDirectDocument(bghUser, internalDeptADoc), true);
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
    it('allows ADMIN, creator, and department manager to delete document', () => {
      assert.strictEqual(canDeleteDocument(adminUser, internalDeptADoc), true);
      assert.strictEqual(canDeleteDocument(managerDeptA, internalDeptADoc), true);
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

  describe('canDeleteNotification (Strict BOLA Protection)', () => {
    it('allows recipient to delete their notification', () => {
      assert.strictEqual(canDeleteNotification(staffDeptA, notifUserA), true);
    });

    it('BOLA: strictly rejects other users from deleting notification', () => {
      assert.strictEqual(canDeleteNotification(staffDeptA2, notifUserA), false);
      assert.strictEqual(canDeleteNotification(managerDeptA, notifUserA), false);
      assert.strictEqual(canDeleteNotification(adminUser, notifUserA), false);
    });
  });
});

describe('User Authorization Policy (user-policy.ts)', () => {
  describe('canViewUser', () => {
    it('allows authenticated users to view directory user', () => {
      assert.strictEqual(canViewUser(staffDeptA, 'u-staff-b1'), true);
      assert.strictEqual(canViewUser(managerDeptA, 'u-admin-1'), true);
    });
  });

  describe('canUpdateUserRole', () => {
    it('allows ADMIN and BAN_GIAM_HIEU to update roles', () => {
      assert.strictEqual(canUpdateUserRole(adminUser, 'u-staff-a1'), true);
      assert.strictEqual(canUpdateUserRole(bghUser, 'u-staff-a1'), true);
    });

    it('rejects MANAGER and STAFF from updating user roles', () => {
      assert.strictEqual(canUpdateUserRole(managerDeptA, 'u-staff-a1'), false);
      assert.strictEqual(canUpdateUserRole(staffDeptA, 'u-staff-a2'), false);
    });
  });

  describe('canOnboardUser', () => {
    it('allows users to onboard themselves', () => {
      assert.strictEqual(canOnboardUser(staffDeptA, 'u-staff-a1'), true);
    });

    it('allows ADMIN to onboard any user', () => {
      assert.strictEqual(canOnboardUser(adminUser, 'u-staff-a1'), true);
      assert.strictEqual(canOnboardUser(bghUser, 'u-staff-a1'), true);
    });

    it('rejects non-admin user from onboarding other users', () => {
      assert.strictEqual(canOnboardUser(staffDeptA, 'u-staff-a2'), false);
      assert.strictEqual(canOnboardUser(managerDeptA, 'u-staff-b1'), false);
    });
  });
});

describe('Executive Authorization Policy (executive-policy.ts)', () => {
  describe('canAccessExecutiveResolutions', () => {
    it('allows BAN_GIAM_HIEU and ADMIN to access executive resolutions', () => {
      assert.strictEqual(canAccessExecutiveResolutions(adminUser), true);
      assert.strictEqual(canAccessExecutiveResolutions(bghUser), true);
    });

    it('rejects MANAGER, STAFF, and VAN_THU from executive resolutions', () => {
      assert.strictEqual(canAccessExecutiveResolutions(managerDeptA), false);
      assert.strictEqual(canAccessExecutiveResolutions(staffDeptA), false);
      assert.strictEqual(canAccessExecutiveResolutions(clerkUser), false);
    });
  });

  describe('canCreateResolution', () => {
    it('allows BAN_GIAM_HIEU and ADMIN to create resolutions', () => {
      assert.strictEqual(canCreateResolution(adminUser), true);
      assert.strictEqual(canCreateResolution(bghUser), true);
    });

    it('rejects MANAGER and STAFF from creating resolutions', () => {
      assert.strictEqual(canCreateResolution(managerDeptA), false);
      assert.strictEqual(canCreateResolution(staffDeptA), false);
    });
  });

  describe('canManageResolution', () => {
    it('allows BAN_GIAM_HIEU and ADMIN to manage resolutions', () => {
      assert.strictEqual(canManageResolution(adminUser), true);
      assert.strictEqual(canManageResolution(bghUser), true);
    });

    it('rejects MANAGER and STAFF from managing resolutions', () => {
      assert.strictEqual(canManageResolution(managerDeptA), false);
      assert.strictEqual(canManageResolution(staffDeptA), false);
    });
  });
});

describe('Central Policies Index (policies/index.ts)', () => {
  it('re-exports all expected policy functions', () => {
    assert.strictEqual(typeof PoliciesIndex.canReadTask, 'function');
    assert.strictEqual(typeof PoliciesIndex.canCreateTask, 'function');
    assert.strictEqual(typeof PoliciesIndex.canUpdateTask, 'function');
    assert.strictEqual(typeof PoliciesIndex.canChangeTaskStatus, 'function');
    assert.strictEqual(typeof PoliciesIndex.canApproveTask, 'function');
    assert.strictEqual(typeof PoliciesIndex.canSubmitDeliverable, 'function');
    assert.strictEqual(typeof PoliciesIndex.canDeleteTask, 'function');

    assert.strictEqual(typeof PoliciesIndex.canReadDocument, 'function');
    assert.strictEqual(typeof PoliciesIndex.canCreateDocument, 'function');
    assert.strictEqual(typeof PoliciesIndex.canUpdateDocument, 'function');
    assert.strictEqual(typeof PoliciesIndex.canDirectDocument, 'function');
    assert.strictEqual(typeof PoliciesIndex.canDeleteDocument, 'function');

    assert.strictEqual(typeof PoliciesIndex.canReadNotification, 'function');
    assert.strictEqual(typeof PoliciesIndex.canDeleteNotification, 'function');

    assert.strictEqual(typeof PoliciesIndex.canViewUser, 'function');
    assert.strictEqual(typeof PoliciesIndex.canUpdateUserRole, 'function');
    assert.strictEqual(typeof PoliciesIndex.canOnboardUser, 'function');

    assert.strictEqual(typeof PoliciesIndex.canAccessExecutiveResolutions, 'function');
    assert.strictEqual(typeof PoliciesIndex.canCreateResolution, 'function');
    assert.strictEqual(typeof PoliciesIndex.canManageResolution, 'function');
  });
});
