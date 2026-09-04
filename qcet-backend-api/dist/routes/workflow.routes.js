"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowRouter = void 0;
exports.calculateStepSla = calculateStepSla;
exports.startDocumentWorkflowHandler = startDocumentWorkflowHandler;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.workflowRouter = (0, express_1.Router)();
const createWorkflowStepSchema = zod_1.z.object({
    stepOrder: zod_1.z.number().int().positive("stepOrder must be a positive integer"),
    stepName: zod_1.z.string().min(1, "stepName is required"),
    roleRequired: zod_1.z.nativeEnum(client_1.Role),
    slaHours: zod_1.z.number().int().positive().optional().default(24),
    isFinal: zod_1.z.boolean().optional().default(false),
});
const createWorkflowDefinitionSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Workflow definition name is required"),
    description: zod_1.z.string().nullable().optional(),
    departmentId: zod_1.z.string().nullable().optional(),
    steps: zod_1.z
        .array(createWorkflowStepSchema)
        .min(1, "At least one step is required in workflow definition"),
});
const startWorkflowSchema = zod_1.z.object({
    workflowDefinitionId: zod_1.z.string().optional(),
});
const transitionWorkflowSchema = zod_1.z.object({
    action: zod_1.z.nativeEnum(client_1.WorkflowActionType),
    comment: zod_1.z.string().nullable().optional(),
});
/**
 * Calculate SLA metadata for a given workflow step and instance
 */
function calculateStepSla(step, stepStartedAt) {
    const slaDeadline = new Date(stepStartedAt.getTime() + step.slaHours * 60 * 60 * 1000);
    const now = new Date();
    const isOverdue = now.getTime() > slaDeadline.getTime();
    const remainingMs = slaDeadline.getTime() - now.getTime();
    const slaHoursRemaining = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60)));
    return {
        stepStartedAt,
        slaDeadline,
        isOverdue,
        slaHoursRemaining,
    };
}
/**
 * Shared handler for starting a workflow on a document
 */
async function startDocumentWorkflowHandler(req, res) {
    const { id: documentId } = req.params;
    const parseResult = startWorkflowSchema.safeParse(req.body || {});
    if (!parseResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: parseResult.error.issues,
        });
        return;
    }
    try {
        const document = await prisma_1.default.document.findUnique({
            where: { id: documentId },
            include: {
                creator: {
                    select: { id: true, fullName: true, username: true, role: true },
                },
            },
        });
        if (!document) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        if (document.status === client_1.DocStatus.APPROVED) {
            res.status(400).json({ error: "Document is already approved" });
            return;
        }
        // Check if an active workflow instance is already in progress
        const existingActiveInstance = await prisma_1.default.workflowInstance.findFirst({
            where: {
                documentId: document.id,
                status: client_1.WorkflowStatus.IN_PROGRESS,
            },
        });
        if (existingActiveInstance) {
            res.status(400).json({
                error: "Document already has an active workflow in progress",
                instanceId: existingActiveInstance.id,
            });
            return;
        }
        // Resolve workflow definition
        let workflowDef = null;
        const requestedDefId = parseResult.data.workflowDefinitionId;
        if (requestedDefId) {
            workflowDef = await prisma_1.default.workflowDefinition.findUnique({
                where: { id: requestedDefId },
                include: {
                    steps: { orderBy: { stepOrder: "asc" } },
                },
            });
            if (!workflowDef) {
                res.status(404).json({ error: "Workflow definition not found" });
                return;
            }
        }
        else {
            // Find matching definition by department or fallback to first definition
            if (document.departmentId) {
                workflowDef = await prisma_1.default.workflowDefinition.findFirst({
                    where: { departmentId: document.departmentId },
                    include: {
                        steps: { orderBy: { stepOrder: "asc" } },
                    },
                });
            }
            if (!workflowDef) {
                workflowDef = await prisma_1.default.workflowDefinition.findFirst({
                    include: {
                        steps: { orderBy: { stepOrder: "asc" } },
                    },
                });
            }
        }
        if (!workflowDef || workflowDef.steps.length === 0) {
            res.status(400).json({
                error: "No workflow definition available. Please specify a workflowDefinitionId or create a definition first.",
            });
            return;
        }
        const firstStep = workflowDef.steps[0];
        const result = await prisma_1.default.$transaction(async (tx) => {
            // 1. Create WorkflowInstance
            const instance = await tx.workflowInstance.create({
                data: {
                    documentId: document.id,
                    workflowDefinitionId: workflowDef.id,
                    currentStepOrder: firstStep.stepOrder,
                    status: client_1.WorkflowStatus.IN_PROGRESS,
                },
                include: {
                    document: true,
                    workflowDefinition: {
                        include: {
                            steps: { orderBy: { stepOrder: "asc" } },
                        },
                    },
                },
            });
            // 2. Set Document status to PENDING_APPROVAL
            await tx.document.update({
                where: { id: document.id },
                data: {
                    status: client_1.DocStatus.PENDING_APPROVAL,
                },
            });
            // 3. Write DocumentAuditLog
            await tx.documentAuditLog.create({
                data: {
                    documentId: document.id,
                    userId: req.user.id,
                    action: "WORKFLOW_STARTED",
                    details: JSON.stringify({
                        workflowInstanceId: instance.id,
                        workflowDefinitionId: workflowDef.id,
                        workflowDefinitionName: workflowDef.name,
                        initialStepOrder: firstStep.stepOrder,
                        initialStepName: firstStep.stepName,
                        roleRequired: firstStep.roleRequired,
                    }),
                    ipAddress: req.ip || null,
                },
            });
            // 4. Send Notification to users with the initial step's roleRequired
            const approverUsers = await tx.user.findMany({
                where: { role: firstStep.roleRequired },
                select: { id: true },
            });
            if (approverUsers.length > 0) {
                await tx.notification.createMany({
                    data: approverUsers.map((u) => ({
                        userId: u.id,
                        title: "Văn bản mới chờ phê duyệt",
                        message: `Văn bản "${document.title}" đang chờ phê duyệt tại bước: ${firstStep.stepName}.`,
                        link: `/documents/${document.id}`,
                    })),
                });
            }
            return instance;
        });
        const slaInfo = calculateStepSla(firstStep, result.createdAt);
        res.status(201).json({
            ...result,
            currentStep: {
                ...firstStep,
                ...slaInfo,
            },
        });
    }
    catch (error) {
        console.error("Start document workflow error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
/**
 * @openapi
 * /api/workflows/definitions:
 *   get:
 *     summary: Danh sách định nghĩa quy trình phê duyệt
 *     description: Lấy danh sách tất cả các quy trình phê duyệt kèm danh sách các bước có thứ tự.
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách quy trình phê duyệt
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Chưa xác thực
 */
exports.workflowRouter.get("/definitions", auth_middleware_1.requireAuth, async (req, res) => {
    try {
        const definitions = await prisma_1.default.workflowDefinition.findMany({
            include: {
                steps: {
                    orderBy: { stepOrder: "asc" },
                },
                department: {
                    select: { id: true, name: true, code: true },
                },
                _count: {
                    select: { instances: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json(definitions);
    }
    catch (error) {
        console.error("Fetch workflow definitions error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/workflows/definitions/{id}:
 *   get:
 *     summary: Chi tiết định nghĩa quy trình phê duyệt
 *     description: Lấy thông tin chi tiết một quy trình phê duyệt theo ID kèm các bước thực hiện.
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID quy trình phê duyệt
 *     responses:
 *       200:
 *         description: Chi tiết quy trình
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy quy trình
 */
exports.workflowRouter.get("/definitions/:id", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const definition = await prisma_1.default.workflowDefinition.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { stepOrder: "asc" },
                },
                department: {
                    select: { id: true, name: true, code: true },
                },
            },
        });
        if (!definition) {
            res.status(404).json({ error: "Workflow definition not found" });
            return;
        }
        res.status(200).json(definition);
    }
    catch (error) {
        console.error("Fetch workflow definition detail error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/workflows/definitions:
 *   post:
 *     summary: Tạo định nghĩa quy trình phê duyệt mới
 *     description: Tạo mới một quy trình phê duyệt văn bản với các bước thực hiện tuần tự và vai trò phụ trách (Chỉ dành cho ADMIN).
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - steps
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Quy trình phê duyệt công văn đi"
 *               description:
 *                 type: string
 *                 example: "Áp dụng cho toàn bộ văn bản phát hành ngoài đơn vị"
 *               departmentId:
 *                 type: string
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - stepOrder
 *                     - stepName
 *                     - roleRequired
 *                   properties:
 *                     stepOrder:
 *                       type: integer
 *                       example: 1
 *                     stepName:
 *                       type: string
 *                       example: "Trưởng phòng thẩm tra"
 *                     roleRequired:
 *                       type: string
 *                       enum: [ADMIN, MANAGER, STAFF, STUDENT]
 *                       example: "MANAGER"
 *                     slaHours:
 *                       type: integer
 *                       default: 24
 *                     isFinal:
 *                       type: boolean
 *                       default: false
 *     responses:
 *       201:
 *         description: Định nghĩa quy trình được tạo thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập (Yêu cầu ADMIN)
 */
exports.workflowRouter.post("/definitions", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRoles)(client_1.Role.ADMIN), async (req, res) => {
    const parseResult = createWorkflowDefinitionSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: parseResult.error.issues,
        });
        return;
    }
    const { name, description, departmentId, steps } = parseResult.data;
    try {
        if (departmentId) {
            const deptExists = await prisma_1.default.department.findUnique({
                where: { id: departmentId },
            });
            if (!deptExists) {
                res.status(400).json({ error: "Department not found" });
                return;
            }
        }
        const created = await prisma_1.default.workflowDefinition.create({
            data: {
                name,
                description: description || null,
                departmentId: departmentId || null,
                steps: {
                    create: steps.map((s) => ({
                        stepOrder: s.stepOrder,
                        stepName: s.stepName,
                        roleRequired: s.roleRequired,
                        slaHours: s.slaHours ?? 24,
                        isFinal: s.isFinal ?? false,
                    })),
                },
            },
            include: {
                steps: {
                    orderBy: { stepOrder: "asc" },
                },
                department: {
                    select: { id: true, name: true, code: true },
                },
            },
        });
        res.status(201).json(created);
    }
    catch (error) {
        console.error("Create workflow definition error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/workflows/pending-my-approval:
 *   get:
 *     summary: Hộp thư văn bản chờ phê duyệt
 *     description: Lấy danh sách các phiên phê duyệt đang chờ người dùng hiện tại xử lý theo vai trò (hoặc toàn bộ nếu là ADMIN), kèm thời hạn SLA.
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách văn bản chờ phê duyệt
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       401:
 *         description: Chưa xác thực
 */
exports.workflowRouter.get("/pending-my-approval", auth_middleware_1.requireAuth, async (req, res) => {
    try {
        const instances = await prisma_1.default.workflowInstance.findMany({
            where: {
                status: client_1.WorkflowStatus.IN_PROGRESS,
            },
            include: {
                document: {
                    include: {
                        creator: {
                            select: {
                                id: true,
                                fullName: true,
                                username: true,
                                email: true,
                            },
                        },
                        department: {
                            select: { id: true, name: true, code: true },
                        },
                        versions: {
                            orderBy: { versionNumber: "desc" },
                            take: 1,
                        },
                    },
                },
                workflowDefinition: {
                    include: {
                        steps: {
                            orderBy: { stepOrder: "asc" },
                        },
                    },
                },
                actions: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        actor: {
                            select: {
                                id: true,
                                fullName: true,
                                username: true,
                                role: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        const userRole = req.user.role;
        const filtered = [];
        for (const instance of instances) {
            const steps = instance.workflowDefinition.steps;
            const currentStep = steps.find((s) => s.stepOrder === instance.currentStepOrder);
            if (!currentStep)
                continue;
            // Role check: ADMIN can see all, otherwise current step role must match user role
            if (userRole !== client_1.Role.ADMIN && currentStep.roleRequired !== userRole) {
                continue;
            }
            // SLA calculation
            const lastAction = instance.actions[0];
            const stepStartedAt = lastAction
                ? new Date(lastAction.createdAt)
                : new Date(instance.createdAt);
            const slaInfo = calculateStepSla(currentStep, stepStartedAt);
            filtered.push({
                ...instance,
                currentStep: {
                    ...currentStep,
                    ...slaInfo,
                },
            });
        }
        res.status(200).json(filtered);
    }
    catch (error) {
        console.error("Fetch pending approval error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/workflows/instances/{id}:
 *   get:
 *     summary: Chi tiết phiên quy trình phê duyệt
 *     description: Lấy thông tin chi tiết phiên phê duyệt của văn bản, bao gồm các bước và toàn bộ lịch sử hành động phê duyệt.
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phiên phê duyệt (WorkflowInstance ID)
 *     responses:
 *       200:
 *         description: Chi tiết phiên phê duyệt
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy phiên phê duyệt
 */
exports.workflowRouter.get("/instances/:id", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const instance = await prisma_1.default.workflowInstance.findUnique({
            where: { id },
            include: {
                document: {
                    include: {
                        creator: {
                            select: {
                                id: true,
                                fullName: true,
                                username: true,
                                email: true,
                            },
                        },
                        department: {
                            select: { id: true, name: true, code: true },
                        },
                        versions: {
                            orderBy: { versionNumber: "desc" },
                        },
                    },
                },
                workflowDefinition: {
                    include: {
                        steps: {
                            orderBy: { stepOrder: "asc" },
                        },
                    },
                },
                actions: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        actor: {
                            select: {
                                id: true,
                                fullName: true,
                                username: true,
                                role: true,
                            },
                        },
                    },
                },
            },
        });
        if (!instance) {
            res.status(404).json({ error: "Workflow instance not found" });
            return;
        }
        const steps = instance.workflowDefinition.steps;
        const currentStep = steps.find((s) => s.stepOrder === instance.currentStepOrder);
        let currentStepWithSla = null;
        if (currentStep) {
            const lastAction = instance.actions[0];
            const stepStartedAt = lastAction
                ? new Date(lastAction.createdAt)
                : new Date(instance.createdAt);
            const slaInfo = calculateStepSla(currentStep, stepStartedAt);
            currentStepWithSla = {
                ...currentStep,
                ...slaInfo,
            };
        }
        res.status(200).json({
            ...instance,
            currentStep: currentStepWithSla,
        });
    }
    catch (error) {
        console.error("Fetch workflow instance detail error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/workflows/instances/{id}/transition:
 *   post:
 *     summary: Thực hiện hành động chuyển bước quy trình phê duyệt
 *     description: Người có thẩm quyền thực hiện duyệt (APPROVE), từ chối (REJECT) hoặc trả lại (RETURN) văn bản.
 *     tags:
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID phiên phê duyệt
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [APPROVE, REJECT, RETURN]
 *                 example: "APPROVE"
 *               comment:
 *                 type: string
 *                 example: "Đồng ý phê duyệt văn bản"
 *     responses:
 *       200:
 *         description: Chuyển bước thành công
 *       400:
 *         description: Yêu cầu không hợp lệ hoặc phiên không ở trạng thái IN_PROGRESS
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Người dùng không có vai trò phù hợp cho bước hiện tại
 *       404:
 *         description: Không tìm thấy phiên phê duyệt
 */
exports.workflowRouter.post("/instances/:id/transition", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const parseResult = transitionWorkflowSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: parseResult.error.issues,
        });
        return;
    }
    const { action, comment } = parseResult.data;
    try {
        const instance = await prisma_1.default.workflowInstance.findUnique({
            where: { id },
            include: {
                document: true,
                workflowDefinition: {
                    include: {
                        steps: {
                            orderBy: { stepOrder: "asc" },
                        },
                    },
                },
                actions: {
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!instance) {
            res.status(404).json({ error: "Workflow instance not found" });
            return;
        }
        if (instance.status !== client_1.WorkflowStatus.IN_PROGRESS) {
            res.status(400).json({
                error: `Workflow instance is not in progress (current status: ${instance.status})`,
            });
            return;
        }
        const steps = instance.workflowDefinition.steps;
        const currentStepIndex = steps.findIndex((s) => s.stepOrder === instance.currentStepOrder);
        const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;
        if (!currentStep) {
            res.status(400).json({
                error: `Current step order ${instance.currentStepOrder} not found in workflow definition`,
            });
            return;
        }
        // Check caller role authorization: Must have step.roleRequired or ADMIN
        const callerRole = req.user.role;
        if (callerRole !== client_1.Role.ADMIN && callerRole !== currentStep.roleRequired) {
            res.status(403).json({
                error: `Forbidden: Current step requires role ${currentStep.roleRequired}`,
            });
            return;
        }
        // Determine state transitions
        let nextStepOrder = instance.currentStepOrder;
        let nextInstanceStatus = client_1.WorkflowStatus.IN_PROGRESS;
        let nextDocStatus = client_1.DocStatus.PENDING_APPROVAL;
        if (action === client_1.WorkflowActionType.APPROVE) {
            const isFinalStep = currentStep.isFinal || currentStepIndex === steps.length - 1;
            if (isFinalStep) {
                nextInstanceStatus = client_1.WorkflowStatus.APPROVED;
                nextDocStatus = client_1.DocStatus.APPROVED;
            }
            else {
                const nextStep = steps[currentStepIndex + 1];
                nextStepOrder = nextStep.stepOrder;
                nextInstanceStatus = client_1.WorkflowStatus.IN_PROGRESS;
                nextDocStatus = client_1.DocStatus.PENDING_APPROVAL;
            }
        }
        else if (action === client_1.WorkflowActionType.REJECT) {
            nextInstanceStatus = client_1.WorkflowStatus.REJECTED;
            nextDocStatus = client_1.DocStatus.REJECTED;
        }
        else if (action === client_1.WorkflowActionType.RETURN) {
            // Decrement stepOrder by 1 or return to step 1
            const prevStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : steps[0];
            nextStepOrder = prevStep.stepOrder;
            nextInstanceStatus = client_1.WorkflowStatus.IN_PROGRESS;
            nextDocStatus = client_1.DocStatus.PENDING_APPROVAL;
        }
        const transitionResult = await prisma_1.default.$transaction(async (tx) => {
            // 1. Update WorkflowInstance
            const updatedInst = await tx.workflowInstance.update({
                where: { id: instance.id },
                data: {
                    currentStepOrder: nextStepOrder,
                    status: nextInstanceStatus,
                },
                include: {
                    document: true,
                    workflowDefinition: {
                        include: {
                            steps: { orderBy: { stepOrder: "asc" } },
                        },
                    },
                    actions: {
                        orderBy: { createdAt: "desc" },
                        include: {
                            actor: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    username: true,
                                    role: true,
                                },
                            },
                        },
                    },
                },
            });
            // 2. Update Document status
            await tx.document.update({
                where: { id: instance.documentId },
                data: {
                    status: nextDocStatus,
                },
            });
            // 3. Create WorkflowAction
            const recordedAction = await tx.workflowAction.create({
                data: {
                    workflowInstanceId: instance.id,
                    stepOrder: currentStep.stepOrder,
                    actorId: req.user.id,
                    action,
                    comment: comment || null,
                },
                include: {
                    actor: {
                        select: {
                            id: true,
                            fullName: true,
                            username: true,
                            role: true,
                        },
                    },
                },
            });
            // 4. Create DocumentAuditLog
            await tx.documentAuditLog.create({
                data: {
                    documentId: instance.documentId,
                    userId: req.user.id,
                    action: "WORKFLOW_TRANSITION",
                    details: JSON.stringify({
                        action,
                        previousStepOrder: currentStep.stepOrder,
                        previousStepName: currentStep.stepName,
                        newStepOrder: nextStepOrder,
                        workflowStatus: nextInstanceStatus,
                        documentStatus: nextDocStatus,
                        comment: comment || null,
                    }),
                    ipAddress: req.ip || null,
                },
            });
            // 5. Send Notifications
            const notifications = [];
            // Notify creator of document
            if (instance.document.creatorId) {
                let creatorTitle = "";
                let creatorMsg = "";
                if (action === client_1.WorkflowActionType.APPROVE &&
                    nextInstanceStatus === client_1.WorkflowStatus.APPROVED) {
                    creatorTitle = "Văn bản đã được phê duyệt hoàn tất";
                    creatorMsg = `Văn bản "${instance.document.title}" đã hoàn thành toàn bộ quy trình phê duyệt.`;
                }
                else if (action === client_1.WorkflowActionType.APPROVE) {
                    creatorTitle = `Văn bản được duyệt bước ${currentStep.stepOrder}`;
                    creatorMsg = `Văn bản "${instance.document.title}" đã được duyệt bước: ${currentStep.stepName}. Chuyển sang bước tiếp theo.`;
                }
                else if (action === client_1.WorkflowActionType.REJECT) {
                    creatorTitle = "Văn bản bị từ chối phê duyệt";
                    creatorMsg = `Văn bản "${instance.document.title}" đã bị từ chối.${comment ? ` Lý do: ${comment}` : ""}`;
                }
                else if (action === client_1.WorkflowActionType.RETURN) {
                    creatorTitle = "Văn bản bị trả lại";
                    creatorMsg = `Văn bản "${instance.document.title}" bị trả về bước ${nextStepOrder}.${comment ? ` Ghi chú: ${comment}` : ""}`;
                }
                if (creatorTitle) {
                    notifications.push({
                        userId: instance.document.creatorId,
                        title: creatorTitle,
                        message: creatorMsg,
                        link: `/documents/${instance.documentId}`,
                    });
                }
            }
            // Notify next step approvers if workflow remains in progress
            if (nextInstanceStatus === client_1.WorkflowStatus.IN_PROGRESS) {
                const nextStepDef = steps.find((s) => s.stepOrder === nextStepOrder);
                if (nextStepDef) {
                    const nextApprovers = await tx.user.findMany({
                        where: { role: nextStepDef.roleRequired },
                        select: { id: true },
                    });
                    for (const approver of nextApprovers) {
                        if (!notifications.some((n) => n.userId === approver.id)) {
                            notifications.push({
                                userId: approver.id,
                                title: "Văn bản chờ bạn phê duyệt",
                                message: `Văn bản "${instance.document.title}" cần phê duyệt tại bước: ${nextStepDef.stepName}`,
                                link: `/documents/${instance.documentId}`,
                            });
                        }
                    }
                }
            }
            if (notifications.length > 0) {
                await tx.notification.createMany({
                    data: notifications,
                });
            }
            return {
                instance: updatedInst,
                action: recordedAction,
            };
        });
        res.status(200).json(transitionResult);
    }
    catch (error) {
        console.error("Workflow transition error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * Route aliases on workflowRouter to support starting workflow directly via /api/workflows
 */
exports.workflowRouter.post("/documents/:id/start", auth_middleware_1.requireAuth, startDocumentWorkflowHandler);
exports.workflowRouter.post("/documents/:id/workflow/start", auth_middleware_1.requireAuth, startDocumentWorkflowHandler);
