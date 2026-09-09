import { prisma } from '@/lib/prisma';
import {
  TaskScope,
  TaskStatus,
  TaskPriority,
  AssigneeRole,
  DeliverableReviewStatus,
  Prisma,
} from '@prisma/client';
import type { ApiRequestContext, AuthenticatedUser } from '@/server/api/request-context';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '@/server/api/errors';
import { safeAfter, dispatchTaskAssignedPush } from '@/lib/push-dispatch';
import { generateTaskCodeAtomic } from '@/lib/task-code-generator';
import { getAcademicYear, getSystemReferenceDate } from '@/lib/academic-calendar';
import {
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
  SubmitDeliverableInputSchema,
  ReviewDeliverableInputSchema,
  ApproveTaskInputSchema,
} from '@/contracts/tasks';
import {
  canUserCreateTask,
  canUserUpdateTask,
  canUserDeleteTask,
  canUserSubmitDeliverable,
  canUserReviewDeliverable,
  canUserTransitionStatus,
  checkActiveDelegation,
  isPrivilegedUser,
} from './task-policy';

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  departmentId?: string | null;
  dueDate: string | Date;
  priority?: string | TaskPriority;
  scope?: string | TaskScope;
  academicMonth?: number | string;
  academicYear?: string;
  creatorId?: string;
  assigneeId?: string | null;
  parentTaskId?: string | null;
  collaboratorIds?: string[];
  code?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  progressPercent?: number;
  progress?: number;
  status?: string | TaskStatus;
  priority?: string | TaskPriority;
  dueDate?: string | Date;
  departmentId?: string | null;
  assigneeId?: string | null;
  parentTaskId?: string | null;
  collaboratorIds?: string[];
}

export interface SubmitDeliverableInput {
  title: string;
  fileUrl: string;
  fileType?: string | null;
  fileSize?: number | null;
  uploadedById?: string | null;
}

export interface ReviewDeliverableInput {
  deliverableId: string;
  reviewStatus: 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED' | string;
  reviewNote?: string | null;
}

function resolveUser(
  ctx: ApiRequestContext | { user: AuthenticatedUser | null }
): AuthenticatedUser {
  if (!ctx.user) {
    throw new AuthenticationError('Unauthorized');
  }
  return ctx.user;
}

export class TaskCommandService {
  /**
   * Tạo nhiệm vụ mới với sinh mã nguyên tử O(1) và kiểm tra toàn vẹn phân cấp.
   */
  async createTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    input: CreateTaskInput
  ) {
    const user = resolveUser(ctx);

    const validationResult = CreateTaskInputSchema.safeParse(input);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      if (!input?.title || !input?.dueDate || (!input?.departmentId && !input?.parentTaskId)) {
        throw new ValidationError('Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)', fieldErrors);
      }
      throw new ValidationError('Dữ liệu tạo nhiệm vụ không hợp lệ', fieldErrors);
    }

    const {
      title,
      description,
      departmentId,
      dueDate,
      priority,
      scope,
      academicMonth,
      academicYear,
      creatorId,
      assigneeId,
      parentTaskId,
      collaboratorIds,
      code: customCode,
    } = input;

    let parentTask: {
      id: string;
      departmentId: string | null;
      academicMonth: number;
      academicYear: string;
      scope: TaskScope;
    } | null = null;

    if (parentTaskId) {
      parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { id: true, departmentId: true, academicMonth: true, academicYear: true, scope: true },
      });
      if (!parentTask) {
        throw new NotFoundError('Không tìm thấy nhiệm vụ cha');
      }
    }

    const effectiveDepartmentId = departmentId || parentTask?.departmentId || null;
    const monthNum = academicMonth
      ? Number(academicMonth)
      : (parentTask?.academicMonth ?? (new Date(dueDate).getMonth() + 1 || 9));
    const yearStr =
      academicYear ||
      parentTask?.academicYear ||
      getAcademicYear(dueDate || getSystemReferenceDate());

    if (!title || !dueDate || !effectiveDepartmentId) {
      throw new ValidationError('Thiếu thông tin bắt buộc (Tiêu đề, Hạn chót, Đơn vị)');
    }

    const curYear = new Date().getFullYear();

    let taskScope: TaskScope = parentTask?.scope || TaskScope.SCHOOL;
    if (scope) {
      const s = String(scope).toLowerCase();
      if (s === 'department') taskScope = TaskScope.DEPARTMENT;
      else if (s === 'individual') taskScope = TaskScope.INDIVIDUAL;
      else if (s === 'school') taskScope = TaskScope.SCHOOL;
    }

    const createCheck = canUserCreateTask(user, {
      scope: taskScope,
      departmentId: effectiveDepartmentId,
    });
    if (!createCheck.allowed) {
      throw new AuthorizationError(
        createCheck.reason || 'Forbidden: Insufficient authority to create task'
      );
    }

    let taskPriority: TaskPriority = TaskPriority.NORMAL;
    if (priority) {
      const p = String(priority).toLowerCase();
      if (p === 'urgent') taskPriority = TaskPriority.URGENT;
      else if (p === 'high') taskPriority = TaskPriority.HIGH;
      else if (p === 'low') taskPriority = TaskPriority.LOW;
    }

    const validAssigneeId =
      typeof assigneeId === 'string' && assigneeId.trim() ? assigneeId.trim() : null;
    const validCollaboratorIds = Array.isArray(collaboratorIds)
      ? Array.from(new Set(collaboratorIds)).filter(
          (id): id is string =>
            typeof id === 'string' && Boolean(id.trim()) && id.trim() !== validAssigneeId
        )
      : [];

    const assigneesToCreate: { userId: string; roleInTask: AssigneeRole }[] = [];
    if (validAssigneeId) {
      assigneesToCreate.push({
        userId: validAssigneeId,
        roleInTask: AssigneeRole.PRIMARY_OWNER,
      });
    }
    for (const cId of validCollaboratorIds) {
      assigneesToCreate.push({
        userId: cId,
        roleInTask: AssigneeRole.COLLABORATOR,
      });
    }

    // Thực hiện trong transaction
    const newTask = await prisma.$transaction(async (tx) => {
      const effectiveCreatorId = isPrivilegedUser(user) && creatorId ? creatorId : user.id;

      // Sinh mã tự động atomic O(1)
      const code =
        customCode ||
        (await generateTaskCodeAtomic(tx, {
          year: curYear,
          month: monthNum,
          scope: taskScope,
          departmentCode: effectiveDepartmentId,
        }));

      const task = await tx.task.create({
        data: {
          code,
          title,
          description: description || null,
          departmentId: effectiveDepartmentId,
          dueDate: new Date(dueDate),
          academicMonth: monthNum,
          academicYear: yearStr,
          scope: taskScope,
          priority: taskPriority,
          createdById: effectiveCreatorId,
          parentTaskId: parentTaskId || null,
          ...(assigneesToCreate.length > 0
            ? {
                assignees: {
                  create: assigneesToCreate,
                },
              }
            : {}),
        },
        include: {
          department: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          deliverables: true,
          parentTask: {
            select: { id: true, code: true, title: true, scope: true },
          },
          subTasks: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              progressPercent: true,
              assignees: {
                include: {
                  user: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      });

      return task;
    });

    // Background push notification dispatch via Next.js 15 after()
    safeAfter(async () => {
      const start = Date.now();
      try {
        await dispatchTaskAssignedPush({
          task: newTask,
          assigneeId: validAssigneeId || undefined,
          actorName: user.name,
          actorId: user.id,
        });
      } catch (error) {
        console.error('[after() Task Push Error]', {
          taskId: newTask.id,
          durationMs: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return newTask;
  }

  /**
   * Cập nhật nhiệm vụ với kiểm tra thẩm quyền, phân tách nhiệm vụ (SoD) và đồng bộ quan hệ.
   */
  async updateTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    input: UpdateTaskInput
  ) {
    const user = resolveUser(ctx);

    const validationResult = UpdateTaskInputSchema.safeParse(input);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      throw new ValidationError('Dữ liệu cập nhật không hợp lệ', fieldErrors);
    }

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { select: { userId: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    const updateCheck = canUserUpdateTask(user, existing);
    if (!updateCheck.allowed) {
      throw new AuthorizationError(
        updateCheck.reason || 'Bạn không có quyền chỉnh sửa nhiệm vụ này'
      );
    }

    const {
      title,
      description,
      progressPercent,
      progress,
      status,
      priority,
      dueDate,
      departmentId,
      assigneeId,
      parentTaskId,
      collaboratorIds,
    } = input;

    const updateData: Prisma.TaskUpdateInput = {};

    if (parentTaskId !== undefined) {
      if (parentTaskId === null || parentTaskId === '' || parentTaskId === 'none') {
        updateData.parentTask = { disconnect: true };
      } else if (typeof parentTaskId === 'string') {
        const trimmedParentId = parentTaskId.trim();
        if (trimmedParentId === taskId) {
          throw new ValidationError('Nhiệm vụ không thể là nhiệm vụ cha của chính nó');
        }
        const parentTask = await prisma.task.findUnique({
          where: { id: trimmedParentId },
          select: { id: true },
        });
        if (!parentTask) {
          throw new NotFoundError('Không tìm thấy nhiệm vụ cha');
        }
        updateData.parentTask = { connect: { id: trimmedParentId } };
      }
    }

    if (typeof title === 'string' && title.trim()) {
      updateData.title = title.trim();
    }
    if (description !== undefined) {
      updateData.description = description || null;
    }
    if (typeof progressPercent === 'number') {
      updateData.progressPercent = Math.min(100, Math.max(0, progressPercent));
    } else if (typeof progress === 'number') {
      updateData.progressPercent = Math.min(100, Math.max(0, progress));
    }
    if (dueDate) {
      updateData.dueDate = new Date(dueDate);
    }
    if (departmentId) {
      updateData.department = { connect: { id: departmentId } };
    }

    if (status) {
      const statusMap: Record<string, TaskStatus> = {
        not_started: TaskStatus.NOT_STARTED,
        in_progress: TaskStatus.IN_PROGRESS,
        waiting_approval: TaskStatus.WAITING_APPROVAL,
        completed: TaskStatus.COMPLETED,
        overdue: TaskStatus.OVERDUE,
        cancelled: TaskStatus.CANCELLED,
        NOT_STARTED: TaskStatus.NOT_STARTED,
        IN_PROGRESS: TaskStatus.IN_PROGRESS,
        WAITING_APPROVAL: TaskStatus.WAITING_APPROVAL,
        COMPLETED: TaskStatus.COMPLETED,
        OVERDUE: TaskStatus.OVERDUE,
        CANCELLED: TaskStatus.CANCELLED,
      };

      const mappedStatus = statusMap[status];
      if (mappedStatus) {
        const hasDelegation = await checkActiveDelegation(
          prisma,
          user.id,
          taskId,
          existing.departmentId
        );

        const transitionCheck = canUserTransitionStatus(
          user,
          existing,
          mappedStatus,
          {
            activeDelegation: hasDelegation,
            newAssigneeId: assigneeId !== undefined ? assigneeId : undefined,
          }
        );

        if (!transitionCheck.allowed) {
          throw new AuthorizationError(
            transitionCheck.reason || 'Bạn không có quyền thực hiện chuyển đổi trạng thái này'
          );
        }

        updateData.status = mappedStatus;
        if (mappedStatus === TaskStatus.COMPLETED) {
          updateData.completedAt = new Date();
          if (updateData.progressPercent === undefined) {
            updateData.progressPercent = 100;
          }
        } else if (existing.status === TaskStatus.COMPLETED) {
          updateData.completedAt = null;
        }
      }
    }

    if (priority) {
      const priorityMap: Record<string, TaskPriority> = {
        urgent: TaskPriority.URGENT,
        high: TaskPriority.HIGH,
        medium: TaskPriority.NORMAL,
        normal: TaskPriority.NORMAL,
        low: TaskPriority.LOW,
        URGENT: TaskPriority.URGENT,
        HIGH: TaskPriority.HIGH,
        NORMAL: TaskPriority.NORMAL,
        LOW: TaskPriority.LOW,
      };
      const mappedPriority = priorityMap[priority];
      if (mappedPriority) {
        updateData.priority = mappedPriority;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      let effectivePrimaryOwnerId: string | null = null;

      if (assigneeId !== undefined) {
        const validAssigneeId =
          typeof assigneeId === 'string' && assigneeId.trim() ? assigneeId.trim() : null;
        if (validAssigneeId) {
          effectivePrimaryOwnerId = validAssigneeId;
          await tx.taskAssignee.deleteMany({
            where: { taskId, roleInTask: AssigneeRole.PRIMARY_OWNER },
          });
          await tx.taskAssignee.deleteMany({
            where: { taskId, userId: validAssigneeId },
          });
          await tx.taskAssignee.create({
            data: {
              taskId,
              userId: validAssigneeId,
              roleInTask: AssigneeRole.PRIMARY_OWNER,
            },
          });
        } else if (assigneeId === null) {
          await tx.taskAssignee.deleteMany({
            where: { taskId, roleInTask: AssigneeRole.PRIMARY_OWNER },
          });
        }
      } else {
        const existingOwner = await tx.taskAssignee.findFirst({
          where: { taskId, roleInTask: AssigneeRole.PRIMARY_OWNER },
          select: { userId: true },
        });
        effectivePrimaryOwnerId = existingOwner?.userId || null;
      }

      if (collaboratorIds !== undefined) {
        const validCollabIds = Array.isArray(collaboratorIds)
          ? Array.from(new Set(collaboratorIds)).filter(
              (cId): cId is string =>
                typeof cId === 'string' &&
                Boolean(cId.trim()) &&
                cId.trim() !== effectivePrimaryOwnerId
            )
          : [];

        await tx.taskAssignee.deleteMany({
          where: { taskId, roleInTask: AssigneeRole.COLLABORATOR },
        });

        if (validCollabIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: validCollabIds.map((cId) => ({
              taskId,
              userId: cId,
              roleInTask: AssigneeRole.COLLABORATOR,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
          department: true,
          assignees: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          deliverables: {
            include: {
              uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
              reviewer: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          parentTask: {
            select: { id: true, code: true, title: true, scope: true },
          },
          subTasks: {
            include: {
              assignees: {
                include: { user: true },
              },
              deliverables: true,
            },
          },
        },
      });
    });

    return updated;
  }

  /**
   * Xóa nhiệm vụ và dọn dẹp an toàn cây phân cấp subtasks, văn bản liên kết, phân công.
   */
  async deleteTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string
  ) {
    const user = resolveUser(ctx);

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, createdById: true },
    });

    if (!existing) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    const deleteCheck = canUserDeleteTask(user, existing);
    if (!deleteCheck.allowed) {
      throw new AuthorizationError(
        deleteCheck.reason || 'Bạn không có quyền xóa nhiệm vụ này'
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Tìm toàn bộ subtasks đệ quy
      const allSubtaskIds: string[] = [];
      let parentIds = [taskId];
      while (parentIds.length > 0) {
        const children = await tx.task.findMany({
          where: { parentTaskId: { in: parentIds } },
          select: { id: true },
        });
        if (children.length === 0) break;
        const childIds = children.map((c) => c.id);
        allSubtaskIds.push(...childIds);
        parentIds = childIds;
      }

      if (allSubtaskIds.length > 0) {
        await tx.document.updateMany({
          where: { linkedTaskId: { in: allSubtaskIds } },
          data: { linkedTaskId: null },
        });

        await tx.taskAssignee.deleteMany({ where: { taskId: { in: allSubtaskIds } } });
        await tx.taskDeliverable.deleteMany({ where: { taskId: { in: allSubtaskIds } } });
        await tx.dacumDelegation.deleteMany({ where: { taskId: { in: allSubtaskIds } } });
        await tx.executiveResolution.deleteMany({ where: { taskId: { in: allSubtaskIds } } });

        await tx.task.deleteMany({ where: { id: { in: allSubtaskIds } } });
      }

      // 2. Gỡ liên kết văn bản của nhiệm vụ gốc
      await tx.document.updateMany({
        where: { linkedTaskId: taskId },
        data: { linkedTaskId: null },
      });

      // 3. Dọn dẹp quan hệ
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      await tx.taskDeliverable.deleteMany({ where: { taskId } });
      await tx.dacumDelegation.deleteMany({ where: { taskId } });
      await tx.executiveResolution.deleteMany({ where: { taskId } });

      // 4. Xóa nhiệm vụ chính
      await tx.task.delete({ where: { id: taskId } });
    });

    return {
      success: true,
      message: 'Đã xóa nhiệm vụ thành công',
    };
  }

  /**
   * Nộp minh chứng nhiệm vụ và tự động chuyển trạng thái sang WAITING_APPROVAL.
   */
  async submitDeliverable(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    input: SubmitDeliverableInput
  ) {
    const user = resolveUser(ctx);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        createdById: true,
        departmentId: true,
        assignees: { select: { userId: true } },
      },
    });

    if (!task) {
      throw new NotFoundError('Không tìm thấy nhiệm vụ');
    }

    const authCheck = canUserSubmitDeliverable(user, task);
    if (!authCheck.allowed) {
      throw new AuthorizationError(
        authCheck.reason || 'Forbidden: Insufficient authority to submit deliverable'
      );
    }

    const validationResult = SubmitDeliverableInputSchema.safeParse(input);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      if (!input?.title || !input?.fileUrl) {
        throw new ValidationError('Tiêu đề và đường dẫn file minh chứng là bắt buộc', fieldErrors);
      }
      throw new ValidationError('Dữ liệu nộp minh chứng không hợp lệ', fieldErrors);
    }

    const { title, fileUrl, fileType, fileSize } = input;

    const uploadedById = user.id;

    const result = await prisma.$transaction(async (tx) => {
      const deliverable = await tx.taskDeliverable.create({
        data: {
          taskId,
          title,
          fileUrl,
          fileType: fileType || 'LINK',
          fileSize: typeof fileSize === 'number' ? fileSize : null,
          uploadedById,
          reviewStatus: DeliverableReviewStatus.PENDING,
        },
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      // Chuyển trạng thái sang WAITING_APPROVAL khi nộp minh chứng nếu task chưa bị hủy
      if (task.status !== TaskStatus.CANCELLED) {
        await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.WAITING_APPROVAL },
        });
      }

      return deliverable;
    });

    return result;
  }

  /**
   * Nghiệm thu minh chứng với kiểm tra phân lập nhiệm vụ (SoD) và cập nhật trạng thái nhiệm vụ.
   */
  async reviewDeliverable(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string,
    input: ReviewDeliverableInput
  ) {
    const user = resolveUser(ctx);

    const validationResult = ReviewDeliverableInputSchema.safeParse(input);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.') || '_root';
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      if (!input?.deliverableId || !input?.reviewStatus) {
        throw new ValidationError('deliverableId và reviewStatus là bắt buộc', fieldErrors);
      }
      throw new ValidationError('Dữ liệu duyệt minh chứng không hợp lệ', fieldErrors);
    }

    const { deliverableId, reviewStatus, reviewNote } = input;

    const deliverable = await prisma.taskDeliverable.findUnique({
      where: { id: deliverableId },
      include: {
        task: {
          include: {
            assignees: true,
          },
        },
      },
    });

    if (!deliverable || deliverable.taskId !== taskId) {
      throw new NotFoundError('Không tìm thấy minh chứng cho nhiệm vụ này');
    }

    const hasDelegation = await checkActiveDelegation(
      prisma,
      user.id,
      taskId,
      deliverable.task.departmentId
    );

    const reviewCheck = canUserReviewDeliverable(
      user,
      deliverable,
      deliverable.task,
      { activeDelegation: hasDelegation }
    );

    if (!reviewCheck.allowed) {
      throw new AuthorizationError(
        reviewCheck.reason || 'Bạn không có thẩm quyền nghiệm thu minh chứng này'
      );
    }

    const validStatus =
      reviewStatus === 'APPROVED'
        ? DeliverableReviewStatus.APPROVED
        : reviewStatus === 'REJECTED' || reviewStatus === 'REVISION_REQUIRED'
        ? DeliverableReviewStatus.REVISION_REQUIRED
        : DeliverableReviewStatus.PENDING;

    const result = await prisma.$transaction(async (tx) => {
      const updatedDeliverable = await tx.taskDeliverable.update({
        where: { id: deliverableId },
        data: {
          reviewStatus: validStatus,
          reviewNote: reviewNote || null,
          reviewerId: user.id,
          reviewedAt: new Date(),
        },
        include: {
          uploadedBy: { select: { id: true, name: true, avatarUrl: true } },
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      if (validStatus === DeliverableReviewStatus.APPROVED) {
        // Kiểm tra xem tất cả minh chứng của nhiệm vụ này đã được duyệt hay chưa
        const allDeliverables = await tx.taskDeliverable.findMany({
          where: { taskId },
        });
        const allApproved = allDeliverables.every(
          (d) => d.id === deliverableId || d.reviewStatus === DeliverableReviewStatus.APPROVED
        );

        if (allApproved) {
          await tx.task.update({
            where: { id: taskId },
            data: {
              status: TaskStatus.COMPLETED,
              progressPercent: 100,
              completedAt: new Date(),
            },
          });
        }
      } else if (validStatus === DeliverableReviewStatus.REVISION_REQUIRED) {
        // Bị yêu cầu chỉnh sửa, đưa nhiệm vụ về lại IN_PROGRESS
        await tx.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.IN_PROGRESS,
          },
        });
      }

      return updatedDeliverable;
    });

    return result;
  }

  /**
   * Lệnh nghiệm thu nhiệm vụ nguyên tử (chuyển sang COMPLETED).
   */
  async approveTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string
  ) {
    return this.updateTask(ctx, taskId, {
      status: TaskStatus.COMPLETED,
      progressPercent: 100,
    });
  }

  /**
   * Lệnh từ chối / trả về yêu cầu làm lại (chuyển về IN_PROGRESS).
   */
  async rejectTask(
    ctx: ApiRequestContext | { user: AuthenticatedUser | null },
    taskId: string
  ) {
    return this.updateTask(ctx, taskId, {
      status: TaskStatus.IN_PROGRESS,
    });
  }
}

export const taskCommandService = new TaskCommandService();
