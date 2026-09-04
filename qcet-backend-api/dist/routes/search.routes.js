"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.searchRouter = (0, express_1.Router)();
const searchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().optional().default(""),
    type: zod_1.z.enum(["all", "tasks", "documents", "users"]).optional().default("all"),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
});
/**
 * @openapi
 * /api/search:
 *   get:
 *     summary: Tìm kiếm hợp nhất doanh nghiệp (Enterprise Multi-entity Search)
 *     description: Tìm kiếm toàn văn xuyên suốt Công việc (Tasks), Văn bản (Documents) và Người dùng (Users) với cơ chế phân quyền bảo mật chặt chẽ (RBAC Scoping).
 *     tags:
 *       - Search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Từ khóa tìm kiếm toàn văn
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, tasks, documents, users]
 *           default: all
 *         description: Loại thực thể cần tìm kiếm
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Giới hạn số lượng kết quả cho mỗi loại thực thể
 *     responses:
 *       200:
 *         description: Kết quả tìm kiếm theo nhóm thực thể
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 query:
 *                   type: string
 *                   description: Từ khóa tìm kiếm đã xử lý
 *                 results:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           title: { type: string }
 *                           description: { type: string, nullable: true }
 *                           status: { type: string }
 *                           priority: { type: string }
 *                           deadline: { type: string, nullable: true }
 *                           departmentId: { type: string, nullable: true }
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           documentNumber: { type: string }
 *                           title: { type: string }
 *                           abstract: { type: string, nullable: true }
 *                           type: { type: string }
 *                           security: { type: string }
 *                           status: { type: string }
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           username: { type: string }
 *                           fullName: { type: string }
 *                           email: { type: string }
 *                           role: { type: string }
 *                 totalMatches:
 *                   type: integer
 *                   description: Tổng số mục tìm thấy khớp điều kiện
 *       400:
 *         description: Tham số truy vấn không hợp lệ
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       500:
 *         description: Lỗi máy chủ nội bộ
 */
exports.searchRouter.get("/", auth_middleware_1.requireAuth, async (req, res) => {
    try {
        const parsed = searchQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({
                error: "Invalid query parameters",
                details: parsed.error.issues,
            });
            return;
        }
        const { q: rawQ, type, limit } = parsed.data;
        const q = rawQ.trim();
        const user = req.user;
        if (!q) {
            res.status(200).json({
                query: "",
                results: {
                    tasks: [],
                    documents: [],
                    users: [],
                },
                totalMatches: 0,
            });
            return;
        }
        // 1. Task Search Conditions
        let taskWhere = {
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
            ],
        };
        if (user.role === client_1.Role.ADMIN) {
            // ADMIN: full access across all tasks
        }
        else if (user.role === client_1.Role.MANAGER) {
            // MANAGER: all tasks in their department, or created/assigned
            const managerConditions = [
                { creatorId: user.id },
                { assignees: { some: { userId: user.id } } },
            ];
            if (user.departmentId) {
                managerConditions.unshift({ departmentId: user.departmentId });
            }
            taskWhere = {
                AND: [taskWhere, { OR: managerConditions }],
            };
        }
        else {
            // STAFF & STUDENT: tasks they created or are assigned to
            taskWhere = {
                AND: [
                    taskWhere,
                    {
                        OR: [
                            { creatorId: user.id },
                            { assignees: { some: { userId: user.id } } },
                        ],
                    },
                ],
            };
        }
        // 2. Document Search Conditions
        let docWhere = {
            OR: [
                { title: { contains: q, mode: "insensitive" } },
                { abstract: { contains: q, mode: "insensitive" } },
                { documentNumber: { contains: q, mode: "insensitive" } },
            ],
        };
        if (user.role === client_1.Role.ADMIN) {
            // ADMIN: full access across all documents
        }
        else if (user.role === client_1.Role.MANAGER) {
            // MANAGER: all documents in their department, all public/internal documents, and created
            const managerDocConditions = [
                { creatorId: user.id },
                { type: client_1.DocType.INTERNAL },
                { status: client_1.DocStatus.PUBLISHED },
                { security: client_1.DocSecurity.NORMAL },
            ];
            if (user.departmentId) {
                managerDocConditions.unshift({ departmentId: user.departmentId });
            }
            docWhere = {
                AND: [docWhere, { OR: managerDocConditions }],
            };
        }
        else {
            // STAFF & STUDENT: only see published documents or documents in their department, preventing draft document exposure across departments
            const staffDocConditions = [
                { status: client_1.DocStatus.PUBLISHED },
                { creatorId: user.id },
            ];
            if (user.departmentId) {
                staffDocConditions.push({ departmentId: user.departmentId });
            }
            docWhere = {
                AND: [docWhere, { OR: staffDocConditions }],
            };
        }
        // 3. User Search Conditions
        const userWhere = {
            OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
            ],
        };
        // Execute queries according to entity type
        const shouldSearchTasks = type === "all" || type === "tasks";
        const shouldSearchDocuments = type === "all" || type === "documents";
        const shouldSearchUsers = type === "all" || type === "users";
        const tasksPromise = shouldSearchTasks
            ? prisma_1.default.task.findMany({
                where: taskWhere,
                take: limit,
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    status: true,
                    priority: true,
                    deadline: true,
                    departmentId: true,
                    department: { select: { id: true, name: true, code: true } },
                    creatorId: true,
                    creator: { select: { id: true, fullName: true, username: true } },
                    assignees: {
                        select: {
                            user: { select: { id: true, fullName: true, username: true } },
                        },
                    },
                    createdAt: true,
                    updatedAt: true,
                },
            })
            : Promise.resolve([]);
        const docsPromise = shouldSearchDocuments
            ? prisma_1.default.document.findMany({
                where: docWhere,
                take: limit,
                orderBy: { updatedAt: "desc" },
                select: {
                    id: true,
                    documentNumber: true,
                    title: true,
                    abstract: true,
                    type: true,
                    security: true,
                    status: true,
                    departmentId: true,
                    department: { select: { id: true, name: true, code: true } },
                    creatorId: true,
                    creator: { select: { id: true, fullName: true, username: true } },
                    publishDate: true,
                    createdAt: true,
                    updatedAt: true,
                },
            })
            : Promise.resolve([]);
        const usersPromise = shouldSearchUsers
            ? prisma_1.default.user.findMany({
                where: userWhere,
                take: limit,
                orderBy: { fullName: "asc" },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    email: true,
                    role: true,
                    departmentId: true,
                    department: { select: { id: true, name: true, code: true } },
                    isDeptHead: true,
                    createdAt: true,
                },
            })
            : Promise.resolve([]);
        const [tasks, documents, users] = await Promise.all([
            tasksPromise,
            docsPromise,
            usersPromise,
        ]);
        res.status(200).json({
            query: q,
            results: {
                tasks,
                documents,
                users,
            },
            totalMatches: tasks.length + documents.length + users.length,
        });
    }
    catch (error) {
        console.error("Enterprise search error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
