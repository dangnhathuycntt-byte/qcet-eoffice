"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const security_middleware_1 = require("../middleware/security.middleware");
const workflow_routes_1 = require("./workflow.routes");
const signature_routes_1 = require("./signature.routes");
exports.documentRouter = (0, express_1.Router)();
const getDocumentsQuerySchema = zod_1.z.object({
    type: zod_1.z.enum(["INCOMING", "OUTGOING", "INTERNAL"]).optional(),
    security: zod_1.z.enum(["NORMAL", "CONFIDENTIAL", "STRICT"]).optional(),
    status: zod_1.z
        .enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PUBLISHED", "ARCHIVED"])
        .optional(),
    departmentId: zod_1.z.string().optional(),
    search: zod_1.z.string().optional(),
});
const createDocumentSchema = zod_1.z
    .object({
    documentNumber: zod_1.z.string().min(1, "Document number is required"),
    title: zod_1.z.string().min(1, "Title is required"),
    abstract: zod_1.z.string().nullable().optional(),
    type: zod_1.z.enum(["INCOMING", "OUTGOING", "INTERNAL"]).optional().default("INTERNAL"),
    security: zod_1.z.enum(["NORMAL", "CONFIDENTIAL", "STRICT"]).optional().default("NORMAL"),
    status: zod_1.z
        .enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "PUBLISHED", "ARCHIVED"])
        .optional()
        .default("DRAFT"),
    departmentId: zod_1.z.string().nullable().optional(),
    publishDate: zod_1.z
        .string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid publishDate format",
    })
        .nullable()
        .optional(),
    fileUrl: zod_1.z.string().min(1, "File URL is required").optional(),
    fileName: zod_1.z.string().min(1, "File name is required").optional(),
    fileSize: zod_1.z.number().int().nonnegative("File size must be non-negative").optional(),
    mimeType: zod_1.z.string().min(1, "MIME type is required").optional(),
    changeSummary: zod_1.z.string().nullable().optional(),
    file: zod_1.z
        .object({
        fileUrl: zod_1.z.string().min(1, "File URL is required"),
        fileName: zod_1.z.string().min(1, "File name is required"),
        fileSize: zod_1.z.number().int().nonnegative("File size must be non-negative"),
        mimeType: zod_1.z.string().min(1, "MIME type is required"),
        changeSummary: zod_1.z.string().nullable().optional(),
    })
        .optional(),
})
    .refine((data) => {
    const hasTop = Boolean(data.fileUrl && data.fileName && data.mimeType && data.fileSize !== undefined);
    const hasNested = Boolean(data.file);
    return hasTop || hasNested;
}, {
    message: "Initial file attachment details (fileUrl, fileName, fileSize, mimeType) are required",
    path: ["fileUrl"],
});
const createVersionSchema = zod_1.z.object({
    fileUrl: zod_1.z.string().min(1, "File URL is required"),
    fileName: zod_1.z.string().min(1, "File name is required"),
    fileSize: zod_1.z.number().int().nonnegative("File size must be non-negative"),
    mimeType: zod_1.z.string().min(1, "MIME type is required"),
    changeSummary: zod_1.z.string().nullable().optional(),
});
/**
 * @openapi
 * /api/documents:
 *   get:
 *     summary: Danh sách văn bản (DMS)
 *     description: Lấy danh sách văn bản trong hệ thống hỗ trợ lọc theo loại, độ mật, trạng thái, phòng ban và từ khóa tìm kiếm.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOMING, OUTGOING, INTERNAL]
 *         description: Loại văn bản (Văn bản đến, Văn bản đi, Nội bộ)
 *       - in: query
 *         name: security
 *         schema:
 *           type: string
 *           enum: [NORMAL, CONFIDENTIAL, STRICT]
 *         description: Độ bảo mật (Thường, Mật, Tuyệt mật)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PUBLISHED, ARCHIVED]
 *         description: Trạng thái văn bản
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Lọc theo mã phòng ban ban hành / xử lý
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm trong số văn bản, tiêu đề và trích yếu
 *     responses:
 *       200:
 *         description: Danh sách văn bản kèm thông tin người tạo, phòng ban và các phiên bản
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       400:
 *         description: Tham số truy vấn không hợp lệ
 *       401:
 *         description: Chưa xác thực
 */
exports.documentRouter.get("/", auth_middleware_1.requireAuth, async (req, res) => {
    const queryResult = getDocumentsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: queryResult.error.issues,
        });
        return;
    }
    const { type, security, status, departmentId, search } = queryResult.data;
    try {
        const where = {};
        if (type)
            where.type = type;
        if (security)
            where.security = security;
        if (status)
            where.status = status;
        if (departmentId)
            where.departmentId = departmentId;
        if (search && search.trim() !== "") {
            const trimmedSearch = search.trim();
            where.OR = [
                { title: { contains: trimmedSearch, mode: "insensitive" } },
                { documentNumber: { contains: trimmedSearch, mode: "insensitive" } },
                { abstract: { contains: trimmedSearch, mode: "insensitive" } },
            ];
        }
        const documents = await prisma_1.default.document.findMany({
            where,
            include: {
                creator: {
                    select: { id: true, fullName: true, username: true, email: true },
                },
                department: {
                    select: { id: true, name: true, code: true },
                },
                versions: {
                    orderBy: { versionNumber: "desc" },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json(documents);
    }
    catch (error) {
        console.error("Fetch documents error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/documents/{id}:
 *   get:
 *     summary: Chi tiết văn bản
 *     description: Lấy chi tiết thông tin văn bản bao gồm toàn bộ phiên bản tệp đính kèm và nhật ký kiểm toán (audit logs).
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID văn bản
 *     responses:
 *       200:
 *         description: Chi tiết văn bản
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy văn bản
 */
exports.documentRouter.get("/:id", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const document = await prisma_1.default.document.findUnique({
            where: { id },
            include: {
                creator: {
                    select: { id: true, fullName: true, username: true, email: true },
                },
                department: {
                    select: { id: true, name: true, code: true },
                },
                versions: {
                    include: {
                        uploadedBy: {
                            select: { id: true, fullName: true, username: true },
                        },
                    },
                    orderBy: { versionNumber: "desc" },
                },
                auditLogs: {
                    include: {
                        user: {
                            select: { id: true, fullName: true, username: true },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                },
            },
        });
        if (!document) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        res.status(200).json(document);
    }
    catch (error) {
        console.error("Fetch document detail error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/documents:
 *   post:
 *     summary: Tạo văn bản mới
 *     description: Tạo mới một văn bản kèm tệp đính kèm phiên bản 1 và ghi nhận nhật ký kiểm toán DOCUMENT_CREATED trong một transaction.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentNumber
 *               - title
 *             properties:
 *               documentNumber:
 *                 type: string
 *                 example: 125/QĐ-QCET
 *               title:
 *                 type: string
 *                 example: Quyết định ban hành Quy chế Đào tạo năm 2026
 *               abstract:
 *                 type: string
 *                 example: Quy định về quy trình đào tạo và cấp chứng chỉ tại QCET
 *               type:
 *                 type: string
 *                 enum: [INCOMING, OUTGOING, INTERNAL]
 *                 default: INTERNAL
 *               security:
 *                 type: string
 *                 enum: [NORMAL, CONFIDENTIAL, STRICT]
 *                 default: NORMAL
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PUBLISHED, ARCHIVED]
 *                 default: DRAFT
 *               departmentId:
 *                 type: string
 *               publishDate:
 *                 type: string
 *                 format: date-time
 *               fileUrl:
 *                 type: string
 *                 example: /uploads/docs/quy-che-2026.pdf
 *               fileName:
 *                 type: string
 *                 example: quy-che-2026.pdf
 *               fileSize:
 *                 type: integer
 *                 example: 1048576
 *               mimeType:
 *                 type: string
 *                 example: application/pdf
 *               changeSummary:
 *                 type: string
 *                 example: Khởi tạo văn bản lần đầu
 *     responses:
 *       201:
 *         description: Văn bản được tạo thành công kèm phiên bản đầu tiên và nhật ký
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Phòng ban không tồn tại
 *       409:
 *         description: Số hiệu văn bản đã tồn tại
 */
exports.documentRouter.post("/", auth_middleware_1.requireAuth, async (req, res) => {
    const result = createDocumentSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            error: "Validation error",
            details: result.error.issues,
        });
        return;
    }
    const { documentNumber, title, abstract, type, security, status, departmentId, publishDate, changeSummary, } = result.data;
    const fileUrl = result.data.file?.fileUrl ?? result.data.fileUrl;
    const fileName = result.data.file?.fileName ?? result.data.fileName;
    const fileSize = result.data.file?.fileSize ?? result.data.fileSize;
    const mimeType = result.data.file?.mimeType ?? result.data.mimeType;
    const finalChangeSummary = result.data.file?.changeSummary ?? changeSummary ?? "Initial version";
    try {
        const existing = await prisma_1.default.document.findUnique({
            where: { documentNumber },
        });
        if (existing) {
            res.status(409).json({ error: "Document number already exists" });
            return;
        }
        if (departmentId) {
            const dept = await prisma_1.default.department.findUnique({
                where: { id: departmentId },
            });
            if (!dept) {
                res.status(404).json({ error: "Department not found" });
                return;
            }
        }
        const createdDocument = await prisma_1.default.$transaction(async (tx) => {
            const doc = await tx.document.create({
                data: {
                    documentNumber,
                    title,
                    abstract: abstract || null,
                    type: type,
                    security: security,
                    status: status,
                    departmentId: departmentId || null,
                    creatorId: req.user.id,
                    publishDate: publishDate ? new Date(publishDate) : null,
                },
            });
            const version = await tx.documentVersion.create({
                data: {
                    documentId: doc.id,
                    versionNumber: 1,
                    fileUrl,
                    fileName,
                    fileSize,
                    mimeType,
                    changeSummary: finalChangeSummary,
                    uploadedById: req.user.id,
                },
                include: {
                    uploadedBy: {
                        select: { id: true, fullName: true, username: true },
                    },
                },
            });
            const auditLog = await tx.documentAuditLog.create({
                data: {
                    documentId: doc.id,
                    userId: req.user.id,
                    action: "DOCUMENT_CREATED",
                    details: `Document ${doc.documentNumber} created with initial version 1`,
                    ipAddress: req.ip || req.socket.remoteAddress || null,
                },
                include: {
                    user: {
                        select: { id: true, fullName: true, username: true },
                    },
                },
            });
            return {
                ...doc,
                versions: [version],
                auditLogs: [auditLog],
            };
        });
        res.status(201).json(createdDocument);
    }
    catch (error) {
        console.error("Create document error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/documents/{id}/versions:
 *   post:
 *     summary: Tải lên phiên bản mới của văn bản
 *     description: Tải lên tệp đính kèm phiên bản mới (nextVersion = currentMaxVersion + 1) và ghi nhật ký kiểm toán VERSION_UPLOADED trong một transaction.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID văn bản cần cập nhật phiên bản
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileUrl
 *               - fileName
 *               - fileSize
 *               - mimeType
 *             properties:
 *               fileUrl:
 *                 type: string
 *                 example: /uploads/docs/quy-che-2026-v2.pdf
 *               fileName:
 *                 type: string
 *                 example: quy-che-2026-v2.pdf
 *               fileSize:
 *                 type: integer
 *                 example: 1084200
 *               mimeType:
 *                 type: string
 *                 example: application/pdf
 *               changeSummary:
 *                 type: string
 *                 example: Điều chỉnh Điều 5 về thời gian nộp hồ sơ
 *     responses:
 *       201:
 *         description: Phiên bản mới được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Dữ liệu phiên bản không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy văn bản
 */
exports.documentRouter.post("/:id/versions", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    const result = createVersionSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            error: "Validation error",
            details: result.error.issues,
        });
        return;
    }
    const { fileUrl, fileName, fileSize, mimeType, changeSummary } = result.data;
    try {
        const document = await prisma_1.default.document.findUnique({
            where: { id },
            include: {
                versions: {
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                },
            },
        });
        if (!document) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        const currentMaxVersion = document.versions[0]?.versionNumber ?? 0;
        const nextVersion = currentMaxVersion + 1;
        const newVersion = await prisma_1.default.$transaction(async (tx) => {
            const version = await tx.documentVersion.create({
                data: {
                    documentId: document.id,
                    versionNumber: nextVersion,
                    fileUrl,
                    fileName,
                    fileSize,
                    mimeType,
                    changeSummary: changeSummary || null,
                    uploadedById: req.user.id,
                },
                include: {
                    uploadedBy: {
                        select: { id: true, fullName: true, username: true },
                    },
                },
            });
            await tx.documentAuditLog.create({
                data: {
                    documentId: document.id,
                    userId: req.user.id,
                    action: "VERSION_UPLOADED",
                    details: `Uploaded version ${nextVersion}: ${fileName}`,
                    ipAddress: req.ip || req.socket.remoteAddress || null,
                },
            });
            return version;
        });
        res.status(201).json(newVersion);
    }
    catch (error) {
        console.error("Upload version error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/documents/{id}/workflow/start:
 *   post:
 *     summary: Khởi chạy quy trình phê duyệt văn bản
 *     description: Khởi tạo phiên phê duyệt (WorkflowInstance) cho văn bản, chuyển trạng thái sang PENDING_APPROVAL và ghi nhật ký kiểm toán.
 *     tags:
 *       - Documents
 *       - Workflows
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID văn bản cần phê duyệt
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workflowDefinitionId:
 *                 type: string
 *                 description: Tùy chọn chỉ định ID quy trình cụ thể
 *     responses:
 *       201:
 *         description: Khởi chạy quy trình phê duyệt thành công
 *       400:
 *         description: Văn bản đã được duyệt hoặc đang có quy trình xử lý
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy văn bản hoặc quy trình
 */
exports.documentRouter.post("/:id/workflow/start", auth_middleware_1.requireAuth, workflow_routes_1.startDocumentWorkflowHandler);
exports.documentRouter.post("/:id/sign", auth_middleware_1.requireAuth, security_middleware_1.signatureRateLimiter, signature_routes_1.signDocumentHandler);
exports.documentRouter.get("/:id/signatures", auth_middleware_1.requireAuth, signature_routes_1.getDocumentSignaturesHandler);
exports.documentRouter.get("/:id/verify-signature", auth_middleware_1.requireAuth, signature_routes_1.verifyDocumentSignatureHandler);
