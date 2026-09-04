"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.taskRouter = (0, express_1.Router)();
const createTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, "Title is required"),
    description: zod_1.z.string().nullable().optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]).optional().default("MEDIUM"),
    deadline: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid date format for deadline",
    })
        .nullable()
        .optional(),
    departmentId: zod_1.z.string().nullable().optional(),
    assigneeIds: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
const updateTaskStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE", "CANCELLED"]),
});
const createCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1, "Comment content cannot be empty"),
});
const getTasksQuerySchema = zod_1.z.object({
    status: zod_1.z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE", "CANCELLED"]).optional(),
    departmentId: zod_1.z.string().optional(),
    assignedToMe: zod_1.z
        .union([zod_1.z.enum(["true", "false"]), zod_1.z.boolean()])
        .transform((val) => val === true || val === "true")
        .optional(),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});
/**
 * @openapi
 * /api/tasks:
 *   get:
 *     summary: Lấy danh sách nhiệm vụ
 *     description: Lấy danh sách công việc/nhiệm vụ với bộ lọc theo trạng thái, phòng ban, phân công cho tôi và độ ưu tiên.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [TODO, IN_PROGRESS, REVIEW, DONE, CANCELLED]
 *         description: Lọc theo trạng thái nhiệm vụ
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Lọc theo phòng ban
 *       - in: query
 *         name: assignedToMe
 *         schema:
 *           type: boolean
 *         description: Lọc nhiệm vụ được giao cho người dùng hiện tại
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH]
 *         description: Lọc theo mức độ ưu tiên
 *     responses:
 *       200:
 *         description: Danh sách nhiệm vụ kèm thông tin người tạo, người nhận, số bình luận và file đính kèm
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Tham số query không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
exports.taskRouter.get("/", auth_middleware_1.requireAuth, async (req, res) => {
    const queryResult = getTasksQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: queryResult.error.issues,
        });
        return;
    }
    const { status, departmentId, assignedToMe, priority } = queryResult.data;
    const where = {};
    if (status) {
        where.status = status;
    }
    if (departmentId) {
        where.departmentId = departmentId;
    }
    if (priority) {
        where.priority = priority;
    }
    if (assignedToMe) {
        where.assignees = {
            some: {
                userId: req.user.id,
            },
        };
    }
    try {
        const tasks = await prisma_1.default.task.findMany({
            where,
            include: {
                creator: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        fullName: true,
                        role: true,
                    },
                },
                assignees: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                username: true,
                                fullName: true,
                                role: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        comments: true,
                        attachments: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        const formattedTasks = tasks.map((task) => ({
            ...task,
            commentsCount: task._count.comments,
            attachmentsCount: task._count.attachments,
        }));
        res.status(200).json(formattedTasks);
    }
    catch (error) {
        console.error("Fetch tasks error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/tasks:
 *   post:
 *     summary: Tạo nhiệm vụ mới
 *     description: Tạo một nhiệm vụ mới, liên kết người được giao, ghi nhật ký TaskHistory và tạo thông báo cho người được giao.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Soạn thảo đề cương môn học Kỹ thuật phần mềm
 *               description:
 *                 type: string
 *                 nullable: true
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH]
 *                 default: MEDIUM
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *               assigneeIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Tạo nhiệm vụ thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
exports.taskRouter.post("/", auth_middleware_1.requireAuth, async (req, res) => {
    const result = createTaskSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            error: "Validation error",
            details: result.error.issues,
        });
        return;
    }
    const { title, description, priority, deadline, departmentId, assigneeIds } = result.data;
    const uniqueAssigneeIds = Array.from(new Set(assigneeIds || []));
    try {
        const createdTask = await prisma_1.default.$transaction(async (tx) => {
            const task = await tx.task.create({
                data: {
                    title,
                    description: description ?? null,
                    priority: priority,
                    deadline: deadline ? new Date(deadline) : null,
                    departmentId: departmentId ?? null,
                    creatorId: req.user.id,
                    assignees: uniqueAssigneeIds.length > 0
                        ? {
                            create: uniqueAssigneeIds.map((userId) => ({
                                userId,
                            })),
                        }
                        : undefined,
                },
                include: {
                    creator: {
                        select: {
                            id: true,
                            email: true,
                            username: true,
                            fullName: true,
                            role: true,
                        },
                    },
                    assignees: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    username: true,
                                    fullName: true,
                                    role: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            comments: true,
                            attachments: true,
                        },
                    },
                },
            });
            await tx.taskHistory.create({
                data: {
                    taskId: task.id,
                    actorId: req.user.id,
                    action: "TASK_CREATED",
                    oldValue: null,
                    newValue: task.title,
                },
            });
            if (uniqueAssigneeIds.length > 0) {
                await tx.notification.createMany({
                    data: uniqueAssigneeIds.map((userId) => ({
                        userId,
                        title: "Nhiệm vụ mới được giao",
                        message: `Bạn đã được phân công vào nhiệm vụ: ${task.title}`,
                        link: `/tasks/${task.id}`,
                    })),
                });
            }
            return task;
        });
        res.status(201).json({
            ...createdTask,
            commentsCount: createdTask._count.comments,
            attachmentsCount: createdTask._count.attachments,
        });
    }
    catch (error) {
        console.error("Create task error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/tasks/{id}:
 *   get:
 *     summary: Chi tiết nhiệm vụ
 *     description: Lấy thông tin chi tiết một nhiệm vụ kèm người tạo, người được giao, bình luận, lịch sử và tài liệu đính kèm.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID nhiệm vụ
 *     responses:
 *       200:
 *         description: Chi tiết nhiệm vụ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy nhiệm vụ
 */
exports.taskRouter.get("/:id", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const task = await prisma_1.default.task.findUnique({
            where: { id },
            include: {
                creator: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        fullName: true,
                        role: true,
                    },
                },
                assignees: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                username: true,
                                fullName: true,
                                role: true,
                            },
                        },
                    },
                },
                comments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                username: true,
                                fullName: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                },
                histories: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
                attachments: true,
                department: true,
                _count: {
                    select: {
                        comments: true,
                        attachments: true,
                    },
                },
            },
        });
        if (!task) {
            res.status(404).json({ error: "Task not found" });
            return;
        }
        res.status(200).json({
            ...task,
            commentsCount: task._count.comments,
            attachmentsCount: task._count.attachments,
        });
    }
    catch (error) {
        console.error("Fetch task details error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/tasks/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái nhiệm vụ
 *     description: Cập nhật trạng thái của nhiệm vụ (TODO, IN_PROGRESS, REVIEW, DONE, CANCELLED), ghi TaskHistory và thông báo cho người tạo cùng những người được giao.
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID nhiệm vụ
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, REVIEW, DONE, CANCELLED]
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái thành công
 *       400:
 *         description: Trạng thái không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền cập nhật trạng thái nhiệm vụ
 *       404:
 *         description: Không tìm thấy nhiệm vụ
 */
exports.taskRouter.patch("/:id/status", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const result = updateTaskStatusSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            error: "Validation error",
            details: result.error.issues,
        });
        return;
    }
    const { status: newStatus } = result.data;
    try {
        const existingTask = await prisma_1.default.task.findUnique({
            where: { id },
            include: {
                creator: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        fullName: true,
                        role: true,
                    },
                },
                assignees: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                username: true,
                                fullName: true,
                                role: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        comments: true,
                        attachments: true,
                    },
                },
            },
        });
        if (!existingTask) {
            res.status(404).json({ error: "Task not found" });
            return;
        }
        const canUpdate = req.user.role === client_1.Role.ADMIN ||
            req.user.role === client_1.Role.MANAGER ||
            existingTask.creatorId === req.user.id ||
            existingTask.assignees.some((a) => a.userId === req.user.id);
        if (!canUpdate) {
            res.status(403).json({ message: "You do not have permission to update this task status" });
            return;
        }
        if (newStatus === existingTask.status) {
            res.status(200).json({
                ...existingTask,
                commentsCount: existingTask._count?.comments ?? 0,
                attachmentsCount: existingTask._count?.attachments ?? 0,
            });
            return;
        }
        const oldStatus = existingTask.status;
        const updatedTask = await prisma_1.default.$transaction(async (tx) => {
            const task = await tx.task.update({
                where: { id },
                data: { status: newStatus },
                include: {
                    creator: {
                        select: {
                            id: true,
                            email: true,
                            username: true,
                            fullName: true,
                            role: true,
                        },
                    },
                    assignees: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true,
                                    username: true,
                                    fullName: true,
                                    role: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            comments: true,
                            attachments: true,
                        },
                    },
                },
            });
            await tx.taskHistory.create({
                data: {
                    taskId: id,
                    actorId: req.user.id,
                    action: "STATUS_CHANGED",
                    oldValue: oldStatus,
                    newValue: newStatus,
                },
            });
            const recipientIds = Array.from(new Set([existingTask.creatorId, ...existingTask.assignees.map((a) => a.userId)])).filter((userId) => userId !== req.user.id);
            if (recipientIds.length > 0) {
                await tx.notification.createMany({
                    data: recipientIds.map((userId) => ({
                        userId,
                        title: "Cập nhật trạng thái nhiệm vụ",
                        message: `Nhiệm vụ "${task.title}" đã chuyển sang trạng thái: ${newStatus}`,
                        link: `/tasks/${task.id}`,
                    })),
                });
            }
            return task;
        });
        res.status(200).json({
            ...updatedTask,
            commentsCount: updatedTask._count?.comments ?? 0,
            attachmentsCount: updatedTask._count?.attachments ?? 0,
        });
    }
    catch (error) {
        console.error("Update task status error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/tasks/{id}/comments:
 *   post:
 *     summary: Thêm bình luận vào nhiệm vụ
 *     description: Tạo bình luận mới cho nhiệm vụ và gửi thông báo đến người tạo và các thành viên được giao (trừ người bình luận).
 *     tags:
 *       - Tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID nhiệm vụ
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 example: Tiến độ phần này đã hoàn thành 80%, chờ review tài liệu.
 *     responses:
 *       201:
 *         description: Thêm bình luận thành công
 *       400:
 *         description: Nội dung không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy nhiệm vụ
 */
exports.taskRouter.post("/:id/comments", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const result = createCommentSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            error: "Validation error",
            details: result.error.issues,
        });
        return;
    }
    const { content } = result.data;
    try {
        const task = await prisma_1.default.task.findUnique({
            where: { id },
            include: {
                assignees: true,
            },
        });
        if (!task) {
            res.status(404).json({ error: "Task not found" });
            return;
        }
        const comment = await prisma_1.default.$transaction(async (tx) => {
            const createdComment = await tx.comment.create({
                data: {
                    content,
                    taskId: id,
                    userId: req.user.id,
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            username: true,
                            fullName: true,
                            role: true,
                        },
                    },
                },
            });
            const recipientIds = Array.from(new Set([task.creatorId, ...task.assignees.map((a) => a.userId)])).filter((userId) => userId !== req.user.id);
            if (recipientIds.length > 0) {
                await tx.notification.createMany({
                    data: recipientIds.map((userId) => ({
                        userId,
                        title: "Bình luận mới trong nhiệm vụ",
                        message: `${req.user.username} đã bình luận trong nhiệm vụ "${task.title}": ${content}`,
                        link: `/tasks/${task.id}`,
                    })),
                });
            }
            return createdComment;
        });
        res.status(201).json(comment);
    }
    catch (error) {
        console.error("Create comment error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
