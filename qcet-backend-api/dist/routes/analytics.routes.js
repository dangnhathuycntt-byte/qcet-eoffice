"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
exports.calculateTaskMetrics = calculateTaskMetrics;
exports.calculateDocumentMetrics = calculateDocumentMetrics;
exports.calculateSignatureMetrics = calculateSignatureMetrics;
exports.calculateWorkflowMetrics = calculateWorkflowMetrics;
exports.calculateDepartmentMetrics = calculateDepartmentMetrics;
exports.generateExecutiveCsv = generateExecutiveCsv;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.analyticsRouter = (0, express_1.Router)();
// Zod schemas for query validation
const dateFilterSchema = zod_1.z
    .object({
    startDate: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid startDate ISO format",
    })
        .optional(),
    endDate: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid endDate ISO format",
    })
        .optional(),
    departmentId: zod_1.z.string().optional(),
})
    .refine((data) => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
}, {
    message: "startDate cannot be later than endDate",
    path: ["startDate"],
});
const exportQuerySchema = zod_1.z
    .object({
    format: zod_1.z.enum(["json", "csv"]).optional().default("json"),
    startDate: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid startDate ISO format",
    })
        .optional(),
    endDate: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid endDate ISO format",
    })
        .optional(),
    departmentId: zod_1.z.string().optional(),
})
    .refine((data) => {
    if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
}, {
    message: "startDate cannot be later than endDate",
    path: ["startDate"],
});
// Calculation Helpers with zero-division protection
function calculateTaskMetrics(tasks, referenceTime) {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === client_1.TaskStatus.DONE).length;
    const inProgress = tasks.filter((t) => t.status === client_1.TaskStatus.IN_PROGRESS).length;
    const now = referenceTime ?? Date.now();
    const overdue = tasks.filter((t) => {
        if (t.status === client_1.TaskStatus.DONE || t.status === client_1.TaskStatus.CANCELLED)
            return false;
        if (!t.deadline)
            return false;
        const dl = new Date(t.deadline).getTime();
        return !isNaN(dl) && dl < now;
    }).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const overdueRate = total > 0 ? Math.round((overdue / total) * 100) : 0;
    return {
        total,
        completed,
        inProgress,
        overdue,
        completionRate,
        overdueRate,
    };
}
function calculateDocumentMetrics(documents) {
    const total = documents.length;
    const byType = {
        INCOMING: documents.filter((d) => d.type === client_1.DocType.INCOMING).length,
        OUTGOING: documents.filter((d) => d.type === client_1.DocType.OUTGOING).length,
        INTERNAL: documents.filter((d) => d.type === client_1.DocType.INTERNAL).length,
    };
    const byStatus = {
        DRAFT: documents.filter((d) => d.status === client_1.DocStatus.DRAFT).length,
        PENDING_APPROVAL: documents.filter((d) => d.status === client_1.DocStatus.PENDING_APPROVAL).length,
        APPROVED: documents.filter((d) => d.status === client_1.DocStatus.APPROVED).length,
        REJECTED: documents.filter((d) => d.status === client_1.DocStatus.REJECTED).length,
    };
    return {
        total,
        byType,
        byStatus,
    };
}
function calculateSignatureMetrics(signatures) {
    const total = signatures.length;
    const byType = {
        INITIAL: signatures.filter((s) => s.signatureType === client_1.SignatureType.INITIAL).length,
        OFFICIAL: signatures.filter((s) => s.signatureType === client_1.SignatureType.OFFICIAL).length,
        STAMP: signatures.filter((s) => s.signatureType === client_1.SignatureType.STAMP).length,
    };
    return {
        total,
        byType,
    };
}
function calculateWorkflowMetrics(workflowInstances) {
    const totalInstances = workflowInstances.length;
    const activeInstances = workflowInstances.filter((w) => w.status === client_1.WorkflowStatus.IN_PROGRESS).length;
    const approvedInstancesList = workflowInstances.filter((w) => w.status === client_1.WorkflowStatus.APPROVED);
    const approvedInstances = approvedInstancesList.length;
    const rejectedInstances = workflowInstances.filter((w) => w.status === client_1.WorkflowStatus.REJECTED).length;
    let totalApprovalHours = 0;
    for (const inst of approvedInstancesList) {
        const approveActions = (inst.actions || []).filter((a) => a.action === client_1.WorkflowActionType.APPROVE);
        const lastApprove = approveActions.length > 0 ? approveActions[approveActions.length - 1] : null;
        const finishedAt = lastApprove
            ? new Date(lastApprove.createdAt).getTime()
            : new Date(inst.updatedAt).getTime();
        const startedAt = new Date(inst.createdAt).getTime();
        const diffHours = Math.max(0, (finishedAt - startedAt) / (1000 * 60 * 60));
        totalApprovalHours += diffHours;
    }
    const averageApprovalHours = approvedInstances > 0
        ? Number((totalApprovalHours / approvedInstances).toFixed(2))
        : 0;
    return {
        totalInstances,
        activeInstances,
        approvedInstances,
        rejectedInstances,
        averageApprovalHours,
    };
}
function calculateDepartmentMetrics(departments, tasks, documents, workflowInstances, referenceTime) {
    const now = referenceTime ?? Date.now();
    return departments.map((dept) => {
        const deptTasks = tasks.filter((t) => t.departmentId === dept.id);
        const taskStats = calculateTaskMetrics(deptTasks, now);
        const deptDocs = documents.filter((d) => d.departmentId === dept.id);
        const totalDocuments = deptDocs.length;
        const approvedDocuments = deptDocs.filter((d) => d.status === client_1.DocStatus.APPROVED).length;
        const deptWorkflows = workflowInstances.filter((w) => w.document?.departmentId === dept.id ||
            w.workflowDefinition?.departmentId === dept.id);
        const wfStats = calculateWorkflowMetrics(deptWorkflows);
        // Calculate SLA breaches count for this department
        let slaBreachesCount = 0;
        for (const inst of deptWorkflows) {
            const steps = inst.workflowDefinition?.steps || [];
            // 1. If currently in progress, check if current step exceeded SLA
            if (inst.status === client_1.WorkflowStatus.IN_PROGRESS) {
                const currentStep = steps.find((s) => s.stepOrder === inst.currentStepOrder);
                if (currentStep) {
                    const lastAction = inst.actions && inst.actions.length > 0
                        ? inst.actions[inst.actions.length - 1]
                        : null;
                    const stepStartedAt = lastAction
                        ? new Date(lastAction.createdAt).getTime()
                        : new Date(inst.createdAt).getTime();
                    const slaDeadline = stepStartedAt + currentStep.slaHours * 60 * 60 * 1000;
                    if (now > slaDeadline) {
                        slaBreachesCount++;
                    }
                }
            }
            // 2. Check completed historical actions for SLA breaches
            if (inst.actions && inst.actions.length > 0) {
                let prevTime = new Date(inst.createdAt).getTime();
                for (const act of inst.actions) {
                    const actStep = steps.find((s) => s.stepOrder === act.stepOrder);
                    const actTime = new Date(act.createdAt).getTime();
                    if (actStep &&
                        actTime - prevTime > actStep.slaHours * 60 * 60 * 1000) {
                        slaBreachesCount++;
                    }
                    prevTime = actTime;
                }
            }
        }
        return {
            department: {
                id: dept.id,
                name: dept.name,
                code: dept.code,
            },
            totalTasks: taskStats.total,
            completedTasks: taskStats.completed,
            completionRate: taskStats.completionRate,
            overdueTasks: taskStats.overdue,
            overdueRate: taskStats.overdueRate,
            totalDocuments,
            approvedDocuments,
            slaBreachesCount,
            averageApprovalHours: wfStats.averageApprovalHours,
        };
    });
}
function escapeCsvCell(val) {
    if (val === null || val === undefined)
        return "";
    const str = String(val);
    if (str.includes(",") ||
        str.includes('"') ||
        str.includes("\n") ||
        str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
function generateExecutiveCsv(executive, departments) {
    const lines = [];
    // Header & Title
    lines.push("QCET Executive BI Analytics & Compliance Report");
    lines.push(`Generated At,${escapeCsvCell(new Date().toISOString())}`);
    lines.push("");
    // Section 1: Executive KPI Summary
    lines.push("EXECUTIVE KPI SUMMARY");
    lines.push("Category,Metric,Value");
    lines.push(`Tasks,Total,${executive.tasks.total}`);
    lines.push(`Tasks,Completed,${executive.tasks.completed}`);
    lines.push(`Tasks,In Progress,${executive.tasks.inProgress}`);
    lines.push(`Tasks,Overdue,${executive.tasks.overdue}`);
    lines.push(`Tasks,Completion Rate (%),${executive.tasks.completionRate}`);
    lines.push(`Tasks,Overdue Rate (%),${executive.tasks.overdueRate}`);
    lines.push(`Documents,Total,${executive.documents.total}`);
    lines.push(`Documents,Incoming,${executive.documents.byType.INCOMING}`);
    lines.push(`Documents,Outgoing,${executive.documents.byType.OUTGOING}`);
    lines.push(`Documents,Internal,${executive.documents.byType.INTERNAL}`);
    lines.push(`Documents,Draft,${executive.documents.byStatus.DRAFT}`);
    lines.push(`Documents,Pending Approval,${executive.documents.byStatus.PENDING_APPROVAL}`);
    lines.push(`Documents,Approved,${executive.documents.byStatus.APPROVED}`);
    lines.push(`Documents,Rejected,${executive.documents.byStatus.REJECTED}`);
    lines.push(`Signatures,Total,${executive.signatures.total}`);
    lines.push(`Signatures,Initial,${executive.signatures.byType.INITIAL}`);
    lines.push(`Signatures,Official,${executive.signatures.byType.OFFICIAL}`);
    lines.push(`Signatures,Stamp,${executive.signatures.byType.STAMP}`);
    lines.push(`Workflows,Total Instances,${executive.workflows.totalInstances}`);
    lines.push(`Workflows,Active Instances,${executive.workflows.activeInstances}`);
    lines.push(`Workflows,Approved Instances,${executive.workflows.approvedInstances}`);
    lines.push(`Workflows,Rejected Instances,${executive.workflows.rejectedInstances}`);
    lines.push(`Workflows,Average Approval Hours,${executive.workflows.averageApprovalHours}`);
    lines.push("");
    // Section 2: Department Comparison Breakdown
    lines.push("DEPARTMENT PERFORMANCE COMPARISON");
    lines.push([
        "Department ID",
        "Department Name",
        "Department Code",
        "Total Tasks",
        "Completed Tasks",
        "Completion Rate (%)",
        "Overdue Tasks",
        "Overdue Rate (%)",
        "Total Documents",
        "Approved Documents",
        "SLA Breaches",
        "Average Approval Hours",
    ].join(","));
    for (const dept of departments) {
        lines.push([
            escapeCsvCell(dept.department.id),
            escapeCsvCell(dept.department.name),
            escapeCsvCell(dept.department.code),
            escapeCsvCell(dept.totalTasks),
            escapeCsvCell(dept.completedTasks),
            escapeCsvCell(dept.completionRate),
            escapeCsvCell(dept.overdueTasks),
            escapeCsvCell(dept.overdueRate),
            escapeCsvCell(dept.totalDocuments),
            escapeCsvCell(dept.approvedDocuments),
            escapeCsvCell(dept.slaBreachesCount),
            escapeCsvCell(dept.averageApprovalHours),
        ].join(","));
    }
    // Prepend UTF-8 BOM (\uFEFF)
    return "\uFEFF" + lines.join("\r\n");
}
function buildExecutiveObject(tasks, documents, signatures, workflowInstances) {
    return {
        tasks: calculateTaskMetrics(tasks),
        documents: calculateDocumentMetrics(documents),
        signatures: calculateSignatureMetrics(signatures),
        workflows: calculateWorkflowMetrics(workflowInstances),
    };
}
/**
 * @openapi
 * /api/analytics/executive:
 *   get:
 *     summary: Tổng hợp chỉ số KPI điều hành toàn hệ thống (Executive BI)
 *     description: Cung cấp bức tranh toàn cảnh về tiến độ công việc, văn bản xử lý, chữ ký số và thời gian luân chuyển phê duyệt quy trình. Hỗ trợ lọc theo khoảng thời gian và phòng ban.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày bắt đầu lọc (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày kết thúc lọc (ISO 8601)
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: ID phòng ban cần lọc
 *     responses:
 *       200:
 *         description: Dữ liệu KPI điều hành tổng hợp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     completed: { type: integer }
 *                     inProgress: { type: integer }
 *                     overdue: { type: integer }
 *                     completionRate: { type: number }
 *                     overdueRate: { type: number }
 *                 documents:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     byType:
 *                       type: object
 *                       properties:
 *                         INCOMING: { type: integer }
 *                         OUTGOING: { type: integer }
 *                         INTERNAL: { type: integer }
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         DRAFT: { type: integer }
 *                         PENDING_APPROVAL: { type: integer }
 *                         APPROVED: { type: integer }
 *                         REJECTED: { type: integer }
 *                 signatures:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     byType:
 *                       type: object
 *                       properties:
 *                         INITIAL: { type: integer }
 *                         OFFICIAL: { type: integer }
 *                         STAMP: { type: integer }
 *                 workflows:
 *                   type: object
 *                   properties:
 *                     totalInstances: { type: integer }
 *                     activeInstances: { type: integer }
 *                     approvedInstances: { type: integer }
 *                     rejectedInstances: { type: integer }
 *                     averageApprovalHours: { type: number }
 *       400:
 *         description: Tham số ngày tháng không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi máy chủ nội bộ
 */
exports.analyticsRouter.get("/executive", auth_middleware_1.requireAuth, async (req, res) => {
    const parseResult = dateFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: parseResult.error.issues,
        });
        return;
    }
    const { startDate, endDate, departmentId } = parseResult.data;
    try {
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const hasDateFilter = Boolean(startDate || endDate);
        // Tasks Query
        const taskWhere = {};
        if (hasDateFilter)
            taskWhere.createdAt = dateFilter;
        if (departmentId)
            taskWhere.departmentId = departmentId;
        const tasksPromise = prisma_1.default.task.findMany({
            where: taskWhere,
            select: {
                id: true,
                status: true,
                deadline: true,
                departmentId: true,
                createdAt: true,
            },
        });
        // Documents Query
        const docWhere = {};
        if (hasDateFilter)
            docWhere.createdAt = dateFilter;
        if (departmentId)
            docWhere.departmentId = departmentId;
        const docsPromise = prisma_1.default.document.findMany({
            where: docWhere,
            select: {
                id: true,
                type: true,
                status: true,
                departmentId: true,
                createdAt: true,
            },
        });
        // Digital Signatures Query
        const sigWhere = {};
        if (hasDateFilter)
            sigWhere.signedAt = dateFilter;
        if (departmentId)
            sigWhere.document = { departmentId };
        const sigsPromise = prisma_1.default.digitalSignature.findMany({
            where: sigWhere,
            select: {
                id: true,
                signatureType: true,
                signedAt: true,
            },
        });
        // Workflow Instances Query
        const wfWhere = {};
        if (hasDateFilter)
            wfWhere.createdAt = dateFilter;
        if (departmentId) {
            wfWhere.OR = [
                { document: { departmentId } },
                { workflowDefinition: { departmentId } },
            ];
        }
        const wfPromise = prisma_1.default.workflowInstance.findMany({
            where: wfWhere,
            include: {
                actions: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        action: true,
                        createdAt: true,
                    },
                },
            },
        });
        const [tasks, documents, signatures, workflows] = await Promise.all([
            tasksPromise,
            docsPromise,
            sigsPromise,
            wfPromise,
        ]);
        const executiveData = buildExecutiveObject(tasks, documents, signatures, workflows);
        res.status(200).json(executiveData);
    }
    catch (error) {
        console.error("Executive analytics error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/analytics/departments:
 *   get:
 *     summary: So sánh hiệu suất hoạt động giữa các phòng ban
 *     description: Thống kê và so sánh tỷ lệ hoàn thành công việc, số lượng công việc quá hạn, văn bản được duyệt, số lần vi phạm SLA và thời gian xử lý phê duyệt trung bình giữa tất cả các đơn vị.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày bắt đầu lọc (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày kết thúc lọc (ISO 8601)
 *     responses:
 *       200:
 *         description: Danh sách thống kê hiệu suất theo từng phòng ban
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   department:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       code: { type: string }
 *                   totalTasks: { type: integer }
 *                   completedTasks: { type: integer }
 *                   completionRate: { type: number }
 *                   overdueTasks: { type: integer }
 *                   overdueRate: { type: number }
 *                   totalDocuments: { type: integer }
 *                   approvedDocuments: { type: integer }
 *                   slaBreachesCount: { type: integer }
 *                   averageApprovalHours: { type: number }
 *       400:
 *         description: Tham số ngày tháng không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       500:
 *         description: Lỗi máy chủ nội bộ
 */
exports.analyticsRouter.get("/departments", auth_middleware_1.requireAuth, async (req, res) => {
    const parseResult = dateFilterSchema.safeParse(req.query);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: parseResult.error.issues,
        });
        return;
    }
    const { startDate, endDate } = parseResult.data;
    try {
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const hasDateFilter = Boolean(startDate || endDate);
        const deptsPromise = prisma_1.default.department.findMany({
            select: { id: true, name: true, code: true },
            orderBy: { code: "asc" },
        });
        const taskWhere = {};
        if (hasDateFilter)
            taskWhere.createdAt = dateFilter;
        const tasksPromise = prisma_1.default.task.findMany({
            where: taskWhere,
            select: {
                id: true,
                status: true,
                deadline: true,
                departmentId: true,
            },
        });
        const docWhere = {};
        if (hasDateFilter)
            docWhere.createdAt = dateFilter;
        const docsPromise = prisma_1.default.document.findMany({
            where: docWhere,
            select: {
                id: true,
                status: true,
                departmentId: true,
            },
        });
        const wfWhere = {};
        if (hasDateFilter)
            wfWhere.createdAt = dateFilter;
        const wfPromise = prisma_1.default.workflowInstance.findMany({
            where: wfWhere,
            include: {
                document: {
                    select: { id: true, departmentId: true },
                },
                workflowDefinition: {
                    include: {
                        steps: {
                            orderBy: { stepOrder: "asc" },
                            select: { stepOrder: true, slaHours: true },
                        },
                    },
                },
                actions: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        stepOrder: true,
                        action: true,
                        createdAt: true,
                    },
                },
            },
        });
        const [departments, tasks, documents, workflows] = await Promise.all([
            deptsPromise,
            tasksPromise,
            docsPromise,
            wfPromise,
        ]);
        const comparison = calculateDepartmentMetrics(departments, tasks, documents, workflows);
        res.status(200).json(comparison);
    }
    catch (error) {
        console.error("Department analytics error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/analytics/export:
 *   get:
 *     summary: Xuất báo cáo quản trị tổng hợp và tuân thủ (CSV/JSON)
 *     description: Xuất báo cáo KPI điều hành và so sánh phòng ban dưới định dạng CSV (hỗ trợ tiếng Việt với UTF-8 BOM) hoặc JSON phục vụ ban giám hiệu và trưởng đơn vị. Yêu cầu quyền ADMIN hoặc MANAGER.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Định dạng xuất dữ liệu (json hoặc csv)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày bắt đầu lọc
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày kết thúc lọc
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Lọc theo mã phòng ban
 *     responses:
 *       200:
 *         description: Dữ liệu báo cáo xuất theo định dạng yêu cầu
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 generatedAt: { type: string }
 *                 executive: { type: object }
 *                 departments: { type: array }
 *       400:
 *         description: Định dạng format hoặc tham số không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập (chỉ dành cho ADMIN hoặc MANAGER)
 *       500:
 *         description: Lỗi máy chủ nội bộ
 */
exports.analyticsRouter.get("/export", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRoles)(client_1.Role.ADMIN, client_1.Role.MANAGER), async (req, res) => {
    const parseResult = exportQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: parseResult.error.issues,
        });
        return;
    }
    const { format, startDate, endDate, departmentId } = parseResult.data;
    try {
        const dateFilter = {};
        if (startDate)
            dateFilter.gte = new Date(startDate);
        if (endDate)
            dateFilter.lte = new Date(endDate);
        const hasDateFilter = Boolean(startDate || endDate);
        // Fetch Departments
        const deptsPromise = prisma_1.default.department.findMany({
            where: departmentId ? { id: departmentId } : undefined,
            select: { id: true, name: true, code: true },
            orderBy: { code: "asc" },
        });
        // Fetch Tasks
        const taskWhere = {};
        if (hasDateFilter)
            taskWhere.createdAt = dateFilter;
        if (departmentId)
            taskWhere.departmentId = departmentId;
        const tasksPromise = prisma_1.default.task.findMany({
            where: taskWhere,
            select: {
                id: true,
                status: true,
                deadline: true,
                departmentId: true,
                createdAt: true,
            },
        });
        // Fetch Documents
        const docWhere = {};
        if (hasDateFilter)
            docWhere.createdAt = dateFilter;
        if (departmentId)
            docWhere.departmentId = departmentId;
        const docsPromise = prisma_1.default.document.findMany({
            where: docWhere,
            select: {
                id: true,
                type: true,
                status: true,
                departmentId: true,
                createdAt: true,
            },
        });
        // Fetch Signatures
        const sigWhere = {};
        if (hasDateFilter)
            sigWhere.signedAt = dateFilter;
        if (departmentId)
            sigWhere.document = { departmentId };
        const sigsPromise = prisma_1.default.digitalSignature.findMany({
            where: sigWhere,
            select: {
                id: true,
                signatureType: true,
                signedAt: true,
            },
        });
        // Fetch Workflows
        const wfWhere = {};
        if (hasDateFilter)
            wfWhere.createdAt = dateFilter;
        if (departmentId) {
            wfWhere.OR = [
                { document: { departmentId } },
                { workflowDefinition: { departmentId } },
            ];
        }
        const wfPromise = prisma_1.default.workflowInstance.findMany({
            where: wfWhere,
            include: {
                document: {
                    select: { id: true, departmentId: true },
                },
                workflowDefinition: {
                    include: {
                        steps: {
                            orderBy: { stepOrder: "asc" },
                            select: { stepOrder: true, slaHours: true },
                        },
                    },
                },
                actions: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        stepOrder: true,
                        action: true,
                        createdAt: true,
                    },
                },
            },
        });
        const [departments, tasks, documents, signatures, workflows] = await Promise.all([
            deptsPromise,
            tasksPromise,
            docsPromise,
            sigsPromise,
            wfPromise,
        ]);
        const executive = buildExecutiveObject(tasks, documents, signatures, workflows);
        const deptComparison = calculateDepartmentMetrics(departments, tasks, documents, workflows);
        if (format === "csv") {
            const csvContent = generateExecutiveCsv(executive, deptComparison);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", "attachment; filename=qcet-executive-report.csv");
            res.status(200).send(csvContent);
            return;
        }
        // JSON format response
        res.status(200).json({
            generatedAt: new Date().toISOString(),
            filters: {
                startDate: startDate || null,
                endDate: endDate || null,
                departmentId: departmentId || null,
            },
            executive,
            departments: deptComparison,
        });
    }
    catch (error) {
        console.error("Export analytics error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
