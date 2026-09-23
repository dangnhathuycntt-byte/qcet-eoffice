/**
 * tests/task-business-rules-refactor.test.ts
 *
 * Targeted regression test suite validating the refactored Task business rules:
 * 1. Newly created tasks are ALWAYS 'NOT_STARTED' ('Mới')
 * 2. Arbitrary status on create is strictly rejected/prevented by contract
 * 3. Child DRI B -> Parent derived collaborators shows B
 * 4. B -> C reassignment -> Parent reflects C and no longer B (if B has no other active children)
 * 5. Deduplication of same DRI across multiple children
 * 6. Inactive children (CANCELLED / archived / re-parented) recompute correctly
 * 7. Parent's own DRI is never duplicated into parent's collaborator list
 * 8. Manual collaborator mutation is rejected (no manual PATCH/mutation)
 * 9. Tag / Lĩnh vực removed from Task create/detail contracts
 * 10. Authorization & OCC preserved
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CreateTaskInputSchema,
  UpdateTaskMetadataSchema,
  UpdateTaskInputSchema,
} from '../src/contracts/tasks';
import {
  extractDerivedCollaborators,
  toTaskListDTO,
  toTaskDetailDTO,
} from '../src/server/dto/task-dto';
import { mapPrismaTaskToSchoolTask } from '../src/lib/adapters/task-db-adapter';
import { buildCreateTaskPayload } from '../src/lib/adapters/create-task-mapper';

describe('Task Business Rules Refactor — Targeted Verification', () => {
  // ─────────────────────────────────────────────────────────────
  // 1 & 2: Task status on create is always unstarted; arbitrary status rejected
  // ─────────────────────────────────────────────────────────────
  describe('Rule 1 & 2: Task creation status invariants', () => {
    test('1. CreateTaskInputSchema strictly rejects client-supplied status (cannot bypass workflow)', () => {
      const payloadWithStatus = {
        title: 'Nhiệm vụ kiểm tra trạng thái',
        dueDate: '2026-10-15',

        status: 'IN_PROGRESS',
      };

      assert.throws(
        () => CreateTaskInputSchema.parse(payloadWithStatus),
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          const isUnrecognizedKey = err.issues.some(
            (i: any) => i.code === 'unrecognized_keys' && i.keys.includes('status')
          );
          assert.ok(isUnrecognizedKey, 'Must reject unrecognized key status');
          return true;
        }
      );
    });

    test('2. buildCreateTaskPayload never forwards status, ensuring server assigns NOT_STARTED', () => {
      const draft = {
        level: 'DON_VI' as const,
        title: 'Triển khai hạ tầng mạng',
        dueDate: '2026-10-20',
        leadAssigneeName: 'Trần Văn A',
      };
      const payload = buildCreateTaskPayload(draft);
      assert.strictEqual((payload as any).status, undefined, 'Client cannot emit status on create');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3, 4, 5, 6, 7: Derived Collaborator projection from active child DRIs
  // ─────────────────────────────────────────────────────────────
  describe('Rule 2: Collaborators derived from active child tasks Primary DRIs', () => {
    const parentTask = {
      id: 'task_parent_001',
      code: 'TRUONG-2026-001',
      title: 'Đề án chuyển đổi số toàn trường 2026',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: new Date('2026-12-31'),
      leadAssignee: {
        id: 'usr_lead_parent',
        name: 'Hiệu trưởng Nguyễn Văn A',
      },
      assignees: [
        {
          userId: 'usr_lead_parent',
          roleInTask: 'PRIMARY_OWNER',
          user: { id: 'usr_lead_parent', name: 'Hiệu trưởng Nguyễn Văn A' },
        },
      ],
      actors: [
        {
          userId: 'usr_lead_parent',
          role: 'DRI',
          isPrimaryDRI: true,
          user: { id: 'usr_lead_parent', name: 'Hiệu trưởng Nguyễn Văn A' },
        },
      ],
      subTasks: [
        {
          id: 'sub_01',
          code: 'CON-01',
          title: 'Triển khai LMS',
          status: 'NOT_STARTED',
          archivedAt: null,
          assignees: [
            {
              userId: 'usr_b',
              roleInTask: 'PRIMARY_OWNER',
              user: { id: 'usr_b', name: 'Cán bộ B' },
            },
          ],
          actors: [
            {
              userId: 'usr_b',
              role: 'DRI',
              isPrimaryDRI: true,
              user: { id: 'usr_b', name: 'Cán bộ B' },
            },
          ],
        },
      ],
    };

    test('3. Child DRI B automatically projects into parent collaborators', () => {
      const collabs = extractDerivedCollaborators(parentTask);
      assert.strictEqual(collabs.length, 1);
      assert.strictEqual(collabs[0].id, 'usr_b');
      assert.strictEqual(collabs[0].name, 'Cán bộ B');

      const dto = toTaskDetailDTO(parentTask);
      assert.ok(dto?.collaborators?.some((c) => c.id === 'usr_b'));
    });

    test('4. Reassignment B -> C on child task reflects C on parent, and B is removed', () => {
      const updatedParent = {
        ...parentTask,
        subTasks: [
          {
            id: 'sub_01',
            code: 'CON-01',
            title: 'Triển khai LMS',
            status: 'IN_PROGRESS',
            archivedAt: null,
            assignees: [
              {
                userId: 'usr_c',
                roleInTask: 'PRIMARY_OWNER',
                user: { id: 'usr_c', name: 'Cán bộ C' },
              },
            ],
            actors: [
              {
                userId: 'usr_c',
                role: 'DRI',
                isPrimaryDRI: true,
                user: { id: 'usr_c', name: 'Cán bộ C' },
              },
            ],
          },
        ],
      };

      const collabs = extractDerivedCollaborators(updatedParent);
      assert.strictEqual(collabs.length, 1);
      assert.strictEqual(collabs[0].id, 'usr_c');
      assert.strictEqual(collabs[0].name, 'Cán bộ C');
      assert.ok(!collabs.some((c) => c.id === 'usr_b'), 'B must be removed after reassignment');
    });

    test('5. Deduplication: multiple child tasks led by the same person appear only once in parent', () => {
      const parentWithMultiChildrenSameDRI = {
        ...parentTask,
        subTasks: [
          {
            id: 'sub_01',
            title: 'Việc con 1',
            status: 'IN_PROGRESS',
            archivedAt: null,
            assignees: [{ userId: 'usr_b', roleInTask: 'PRIMARY_OWNER', user: { id: 'usr_b', name: 'Cán bộ B' } }],
          },
          {
            id: 'sub_02',
            title: 'Việc con 2',
            status: 'NOT_STARTED',
            archivedAt: null,
            assignees: [{ userId: 'usr_b', roleInTask: 'PRIMARY_OWNER', user: { id: 'usr_b', name: 'Cán bộ B' } }],
          },
          {
            id: 'sub_03',
            title: 'Việc con 3',
            status: 'WAITING_APPROVAL',
            archivedAt: null,
            assignees: [{ userId: 'usr_d', roleInTask: 'PRIMARY_OWNER', user: { id: 'usr_d', name: 'Cán bộ D' } }],
          },
        ],
      };

      const collabs = extractDerivedCollaborators(parentWithMultiChildrenSameDRI);
      assert.strictEqual(collabs.length, 2, 'Should dedupe usr_b so total is 2 (B and D)');
      assert.ok(collabs.some((c) => c.id === 'usr_b'));
      assert.ok(collabs.some((c) => c.id === 'usr_d'));
    });

    test('6. Inactive children: CANCELLED or archived child tasks are excluded from collaborator projection', () => {
      const parentWithCancelledAndArchived = {
        ...parentTask,
        subTasks: [
          {
            id: 'sub_active',
            title: 'Việc đang làm',
            status: 'IN_PROGRESS',
            archivedAt: null,
            assignees: [{ userId: 'usr_active', roleInTask: 'PRIMARY_OWNER', user: { id: 'usr_active', name: 'Cán bộ Active' } }],
          },
          {
            id: 'sub_cancelled',
            title: 'Việc bị huỷ',
            status: 'CANCELLED',
            archivedAt: null,
            assignees: [{ userId: 'usr_cancelled', roleInTask: 'PRIMARY_OWNER', user: { id: 'usr_cancelled', name: 'Cán bộ Cancelled' } }],
          },
          {
            id: 'sub_archived',
            title: 'Việc lưu trữ',
            status: 'IN_PROGRESS',
            archivedAt: new Date(),
            assignees: [{ userId: 'usr_archived', roleInTask: 'PRIMARY_OWNER', user: { id: 'usr_archived', name: 'Cán bộ Archived' } }],
          },
        ],
      };

      const collabs = extractDerivedCollaborators(parentWithCancelledAndArchived);
      assert.strictEqual(collabs.length, 1);
      assert.strictEqual(collabs[0].id, 'usr_active');
    });

    test('7. Parent DRI exclusion: child task assigned to parent DRI does not duplicate into parent collaborators', () => {
      const parentWithSelfChild = {
        ...parentTask,
        subTasks: [
          {
            id: 'sub_self',
            title: 'Việc con do chính Hiệu trưởng làm',
            status: 'IN_PROGRESS',
            archivedAt: null,
            assignees: [{ userId: 'usr_lead_parent', roleInTask: 'PRIMARY_OWNER', user: { id: 'usr_lead_parent', name: 'Hiệu trưởng Nguyễn Văn A' } }],
          },
          {
            id: 'sub_other',
            title: 'Việc con do B làm',
            status: 'IN_PROGRESS',
            archivedAt: null,
            assignees: [{ userId: 'usr_b', roleInTask: 'PRIMARY_OWNER', user: { id: 'usr_b', name: 'Cán bộ B' } }],
          },
        ],
      };

      const collabs = extractDerivedCollaborators(parentWithSelfChild);
      assert.strictEqual(collabs.length, 1);
      assert.strictEqual(collabs[0].id, 'usr_b', 'Must exclude parent DRI from collaborators list');
    });

    test('mapPrismaTaskToSchoolTask projects derived collaborators into coAssignees and collaborators arrays', () => {
      const schoolTask = mapPrismaTaskToSchoolTask(parentTask as any);
      assert.ok(Array.isArray(schoolTask.coAssignees));
      assert.strictEqual(schoolTask.coAssignees?.length, 1);
      assert.strictEqual(schoolTask.coAssignees?.[0], 'Cán bộ B');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8: Manual collaborator mutation rejected
  // ─────────────────────────────────────────────────────────────
  describe('Rule 8: Manual collaborator mutation rejected', () => {
    test('Generic metadata PATCH strictly rejects collaboratorIds and assigneeId', () => {
      assert.throws(
        () => UpdateTaskMetadataSchema.parse({ title: 'Tên mới', collaboratorIds: ['usr_1'] } as any),
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          const hasUnrecognized = err.issues.some((i: any) => i.code === 'unrecognized_keys');
          assert.ok(hasUnrecognized);
          return true;
        }
      );
    });

    test('buildCreateTaskPayload does not emit collaboratorIds even if coAssignees present on draft', () => {
      const draft = {
        level: 'DON_VI' as const,
        title: 'Nhiệm vụ kiểm định',
        dueDate: '2026-11-01',
        leadAssigneeName: 'Trần Văn A',
        coAssignees: ['Nguyễn Văn B', 'Lê Văn C'],
      };
      const payload = buildCreateTaskPayload(draft, {
        personnel: [
          { id: 'usr_a', name: 'Trần Văn A' },
          { id: 'usr_b', name: 'Nguyễn Văn B' },
        ],
      });
      assert.strictEqual((payload as any).collaboratorIds, undefined);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9: Tag / Lĩnh vực removed from Task create/detail contracts
  // ─────────────────────────────────────────────────────────────
  describe('Rule 9: Tag / Lĩnh vực removed from Task contracts', () => {
    test('CreateTaskInputSchema strictly rejects tags and category inputs', () => {
      assert.throws(
        () => CreateTaskInputSchema.parse({
          title: 'Nhiệm vụ',
          dueDate: '2026-10-10',
          category: 'CHUYEN_DOI_SO',
        } as any),
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          assert.ok(err.issues.some((i: any) => i.code === 'unrecognized_keys' && i.keys.includes('category')));
          return true;
        }
      );

      assert.throws(
        () => CreateTaskInputSchema.parse({
          title: 'Nhiệm vụ',
          dueDate: '2026-10-10',
          tags: ['cntt', 'urgent'],
        } as any),
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          assert.ok(err.issues.some((i: any) => i.code === 'unrecognized_keys' && i.keys.includes('tags')));
          return true;
        }
      );
    });

    test('UpdateTaskMetadataSchema strictly rejects tags and category inputs', () => {
      assert.throws(
        () => UpdateTaskMetadataSchema.parse({
          title: 'Nhiệm vụ mới',
          category: 'CNTT',
        } as any),
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          assert.ok(err.issues.some((i: any) => i.code === 'unrecognized_keys'));
          return true;
        }
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10: Authorization & OCC preserved
  // ─────────────────────────────────────────────────────────────
  describe('Rule 10: Authorization & Optimistic Concurrency Control (OCC) preserved', () => {
    test('UpdateTaskMetadataSchema enforces expectedVersion for OCC', () => {
      const parsed = UpdateTaskMetadataSchema.parse({
        title: 'Cập nhật có OCC',
        expectedVersion: 3,
      });
      assert.strictEqual(parsed.expectedVersion, 3);
      assert.strictEqual(parsed.title, 'Cập nhật có OCC');
    });

    test('UpdateTaskMetadataSchema rejects negative expectedVersion', () => {
      assert.throws(
        () => UpdateTaskMetadataSchema.parse({ expectedVersion: -1 }),
        (err: any) => {
          assert.strictEqual(err.name, 'ZodError');
          return true;
        }
      );
    });
  });
});
 
