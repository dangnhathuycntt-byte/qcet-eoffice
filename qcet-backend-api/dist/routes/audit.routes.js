"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRouter = void 0;
exports.escapeCsvCell = escapeCsvCell;
exports.generateAuditCsv = generateAuditCsv;
exports.fetchUnifiedAuditLogs = fetchUnifiedAuditLogs;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.auditRouter = (0, express_1.Router)();
const auditQuerySchema = zod_1.z
    .object({
    entityType: zod_1.z
        .enum(["all", "user", "document", "signature"])
        .optional()
        .default("all"),
    userId: zod_1.z.string().optional(),
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
    page: zod_1.z.coerce.number().int().min(1).optional().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
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
const auditExportQuerySchema = zod_1.z
    .object({
    format: zod_1.z.enum(["csv", "json"]).optional().default("csv"),
    entityType: zod_1.z
        .enum(["all", "user", "document", "signature"])
        .optional()
        .default("all"),
    userId: zod_1.z.string().optional(),
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
    limit: zod_1.z.coerce.number().int().min(1).max(5000).optional().default(1000),
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
function generateAuditCsv(logs) {
    const lines = [];
    // Report Header & Metadata
    lines.push("QCET Enterprise Audit & Compliance Report");
    lines.push(`Generated At,${escapeCsvCell(new Date().toISOString())}`);
    lines.push("");
    // Table Columns
    lines.push([
        "Log ID",
        "Timestamp",
        "Entity Type",
        "Action",
        "User ID",
        "User Name",
        "Document Number",
        "Document Title",
        "IP Address",
        "Details",
    ].join(","));
    // Data Rows
    for (const log of logs) {
        const timestamp = typeof log.createdAt === "string"
            ? log.createdAt
            : log.createdAt.toISOString();
        lines.push([
            escapeCsvCell(log.id),
            escapeCsvCell(timestamp),
            escapeCsvCell(log.entityType),
            escapeCsvCell(log.action),
            escapeCsvCell(log.userId || log.user?.id || ""),
            escapeCsvCell(log.user?.fullName || log.user?.username || ""),
            escapeCsvCell(log.document?.documentNumber || ""),
            escapeCsvCell(log.document?.title || ""),
            escapeCsvCell(log.ipAddress || ""),
            escapeCsvCell(log.details || ""),
        ].join(","));
    }
    // Prepend UTF-8 BOM (\uFEFF)
    return "\uFEFF" + lines.join("\r\n");
}
async function fetchUnifiedAuditLogs(params) {
    const entityType = params.entityType || "all";
    const userId = params.userId;
    const startDate = params.startDate;
    const endDate = params.endDate;
    const page = params.page || 1;
    const limit = params.limit || 20;
    const queryAuditLog = entityType === "all" || entityType === "user";
    const queryDocAuditLog = entityType === "all" ||
        entityType === "document" ||
        entityType === "signature";
    // Build filter for AuditLog
    const auditWhere = {};
    if (userId)
        auditWhere.userId = userId;
    if (startDate || endDate) {
        const createdAtFilter = {};
        if (startDate)
            createdAtFilter.gte = new Date(startDate);
        if (endDate)
            createdAtFilter.lte = new Date(endDate);
        auditWhere.createdAt = createdAtFilter;
    }
    // Build filter for DocumentAuditLog
    const docAuditWhere = {};
    if (userId)
        docAuditWhere.userId = userId;
    if (startDate || endDate) {
        const createdAtFilter = {};
        if (startDate)
            createdAtFilter.gte = new Date(startDate);
        if (endDate)
            createdAtFilter.lte = new Date(endDate);
        docAuditWhere.createdAt = createdAtFilter;
    }
    if (entityType === "signature") {
        docAuditWhere.action = { contains: "SIGN", mode: "insensitive" };
    }
    else if (entityType === "document") {
        docAuditWhere.action = { not: { contains: "SIGN", mode: "insensitive" } };
    }
    const fetchCount = page * limit;
    const [auditLogs, docAuditLogs, auditTotal, docAuditTotal] = await Promise.all([
        queryAuditLog
            ? prisma_1.default.auditLog.findMany({
                where: auditWhere,
                take: fetchCount,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            username: true,
                            role: true,
                        },
                    },
                },
            })
            : Promise.resolve([]),
        queryDocAuditLog
            ? prisma_1.default.documentAuditLog.findMany({
                where: docAuditWhere,
                take: fetchCount,
                orderBy: { createdAt: "desc" },
                include: {
                    user: {
                        select: {
                            id: true,
                            fullName: true,
                            username: true,
                            role: true,
                        },
                    },
                    document: {
                        select: { id: true, title: true, documentNumber: true },
                    },
                },
            })
            : Promise.resolve([]),
        queryAuditLog
            ? prisma_1.default.auditLog.count({ where: auditWhere })
            : Promise.resolve(0),
        queryDocAuditLog
            ? prisma_1.default.documentAuditLog.count({ where: docAuditWhere })
            : Promise.resolve(0),
    ]);
    const formattedAuditLogs = auditLogs.map((l) => ({
        id: l.id,
        entityType: "user",
        action: l.action,
        details: l.details,
        userId: l.userId,
        user: l.user,
        documentId: null,
        document: null,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        createdAt: l.createdAt,
    }));
    const formattedDocAuditLogs = docAuditLogs.map((l) => {
        const isSig = l.action.toUpperCase().includes("SIGN");
        return {
            id: l.id,
            entityType: isSig ? "signature" : "document",
            action: l.action,
            details: l.details,
            userId: l.userId,
            user: l.user,
            documentId: l.documentId,
            document: l.document,
            ipAddress: l.ipAddress,
            userAgent: null,
            createdAt: l.createdAt,
        };
    });
    const unified = [...formattedAuditLogs, ...formattedDocAuditLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = auditTotal + docAuditTotal;
    const startIndex = (page - 1) * limit;
    const paginatedLogs = unified.slice(startIndex, startIndex + limit);
    return {
        logs: paginatedLogs,
        total,
        page,
        limit,
    };
}
/**
 * @openapi
 * /api/audit/export:
 *   get:
 *     summary: Xuất báo cáo nhật ký kiểm toán tuân thủ (Audit Compliance Export)
 *     description: Xuất báo cáo lịch sử kiểm toán tuân thủ theo định dạng CSV (hỗ trợ UTF-8 BOM hiển thị chuẩn tiếng Việt trên Excel) hoặc JSON. Yêu cầu quyền ADMIN hoặc MANAGER.
 *     tags:
 *       - Audit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json]
 *           default: csv
 *         description: Định dạng xuất (csv hoặc json)
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [all, user, document, signature]
 *           default: all
 *         description: Lọc theo loại thực thể
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Lọc theo ID người thực hiện
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
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 5000
 *           default: 1000
 *         description: Giới hạn số lượng bản ghi xuất
 *     responses:
 *       200:
 *         description: Dữ liệu xuất kiểm toán tuân thủ
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 generatedAt: { type: string }
 *                 total: { type: integer }
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Tham số truy vấn không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Quyền truy cập bị từ chối (Chỉ dành cho ADMIN hoặc MANAGER)
 *       500:
 *         description: Lỗi máy chủ nội bộ
 */
exports.auditRouter.get("/export", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRoles)(client_1.Role.ADMIN, client_1.Role.MANAGER), async (req, res) => {
    try {
        const parsed = auditExportQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid query parameters",
                details: parsed.error.issues,
            });
            return;
        }
        const { format, entityType, userId, startDate, endDate, limit } = parsed.data;
        const { logs, total } = await fetchUnifiedAuditLogs({
            entityType,
            userId,
            startDate,
            endDate,
            page: 1,
            limit,
        });
        if (format === "csv") {
            const csvContent = generateAuditCsv(logs);
            res.setHeader("Content-Type", "text/csv; charset=utf-8");
            res.setHeader("Content-Disposition", "attachment; filename=qcet-audit-compliance-report.csv");
            res.status(200).send(csvContent);
            return;
        }
        res.status(200).json({
            generatedAt: new Date().toISOString(),
            total,
            logs,
        });
    }
    catch (error) {
        console.error("Audit export error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/audit:
 *   get:
 *     summary: Truy vấn nhật ký kiểm toán hợp nhất (Unified Audit Trail)
 *     description: Lấy danh sách lịch sử kiểm toán hợp nhất từ AuditLog và DocumentAuditLog (hành động người dùng, vòng đời văn bản, ký số điện tử) sắp xếp giảm dần theo thời gian và phân trang. Yêu cầu quyền ADMIN hoặc MANAGER.
 *     tags:
 *       - Audit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [all, user, document, signature]
 *           default: all
 *         description: Lọc theo loại thực thể
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Lọc theo ID người dùng tác động
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
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Trang kết quả
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Số lượng kết quả mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách nhật ký kiểm toán phân trang
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 logs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       entityType: { type: string, enum: [user, document, signature] }
 *                       action: { type: string }
 *                       details: { type: string, nullable: true }
 *                       userId: { type: string, nullable: true }
 *                       documentId: { type: string, nullable: true }
 *                       ipAddress: { type: string, nullable: true }
 *                       userAgent: { type: string, nullable: true }
 *                       createdAt: { type: string, format: date-time }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       400:
 *         description: Tham số truy vấn không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Quyền truy cập bị từ chối (Chỉ dành cho ADMIN hoặc MANAGER)
 *       500:
 *         description: Lỗi máy chủ nội bộ
 */
exports.auditRouter.get("/", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRoles)(client_1.Role.ADMIN, client_1.Role.MANAGER), async (req, res) => {
    try {
        const parsed = auditQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid query parameters",
                details: parsed.error.issues,
            });
            return;
        }
        const { entityType, userId, startDate, endDate, page, limit } = parsed.data;
        const result = await fetchUnifiedAuditLogs({
            entityType,
            userId,
            startDate,
            endDate,
            page,
            limit,
        });
        res.status(200).json(result);
    }
    catch (error) {
        console.error("Audit query error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
