"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.departmentRouter = (0, express_1.Router)();
const createDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name cannot be empty"),
    code: zod_1.z.string().min(1, "Code cannot be empty"),
    parentId: zod_1.z.string().nullable().optional(),
});
/**
 * @openapi
 * /api/departments:
 *   get:
 *     summary: Lấy danh sách cây sơ đồ phòng ban
 *     description: Trả về cây phân cấp các phòng ban (root departments có parentId = null) cùng các phòng ban con và danh sách nhân sự. Yêu cầu xác thực.
 *     tags:
 *       - Department
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách cây phòng ban
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   code:
 *                     type: string
 *                   parentId:
 *                     type: string
 *                     nullable: true
 *                   children:
 *                     type: array
 *                     items:
 *                       type: object
 *                   users:
 *                     type: array
 *                     items:
 *                       type: object
 *       401:
 *         description: Chưa xác thực
 */
exports.departmentRouter.get("/", auth_middleware_1.requireAuth, async (_req, res) => {
    try {
        const departments = await prisma_1.default.department.findMany({
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        fullName: true,
                        role: true,
                        isDeptHead: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        });
        const deptMap = new Map();
        for (const dept of departments) {
            deptMap.set(dept.id, {
                ...dept,
                children: [],
            });
        }
        const tree = [];
        for (const dept of departments) {
            const node = deptMap.get(dept.id);
            if (dept.parentId && deptMap.has(dept.parentId)) {
                deptMap.get(dept.parentId).children.push(node);
            }
            else if (!dept.parentId) {
                tree.push(node);
            }
            else {
                // Handle orphaned nodes whose parent is not present
                tree.push(node);
            }
        }
        res.status(200).json(tree);
    }
    catch (error) {
        console.error("Fetch departments error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/departments:
 *   post:
 *     summary: Tạo phòng ban mới
 *     description: Tạo một phòng ban hoặc đơn vị trực thuộc mới trong hệ thống. Yêu cầu quyền ADMIN.
 *     tags:
 *       - Department
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
 *               - code
 *             properties:
 *               name:
 *                 type: string
 *                 example: Ban Giám Hiệu
 *               code:
 *                 type: string
 *                 example: BGH
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *     responses:
 *       201:
 *         description: Tạo phòng ban thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền ADMIN
 *       409:
 *         description: Mã phòng ban đã tồn tại
 */
exports.departmentRouter.post("/", auth_middleware_1.requireAuth, (0, auth_middleware_1.requireRoles)(client_1.Role.ADMIN), async (req, res) => {
    const result = createDepartmentSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            error: "Validation error",
            details: result.error.issues,
        });
        return;
    }
    const { name, code, parentId } = result.data;
    try {
        const existing = await prisma_1.default.department.findUnique({
            where: { code },
        });
        if (existing) {
            res.status(409).json({ error: "Department code already exists" });
            return;
        }
        if (parentId) {
            const parent = await prisma_1.default.department.findUnique({
                where: { id: parentId },
            });
            if (!parent) {
                res.status(404).json({ error: "Parent department not found" });
                return;
            }
        }
        const created = await prisma_1.default.department.create({
            data: {
                name,
                code,
                parentId: parentId ?? null,
            },
        });
        res.status(201).json(created);
    }
    catch (error) {
        console.error("Create department error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
