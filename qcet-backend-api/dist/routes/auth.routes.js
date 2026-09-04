"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const security_middleware_1 = require("../middleware/security.middleware");
exports.authRouter = (0, express_1.Router)();
const loginSchema = zod_1.z
    .object({
    username: zod_1.z.string().optional(),
    email: zod_1.z.string().optional(),
    password: zod_1.z.string().min(1, "Password is required"),
})
    .refine((data) => Boolean(data.username || data.email), {
    message: "Username or email is required",
    path: ["username"],
});
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập hệ thống
 *     description: Xác thực bằng tài khoản/email và mật khẩu, trả về JWT token và thông tin người dùng.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               email:
 *                 type: string
 *                 example: admin@qcet.edu.vn
 *               password:
 *                 type: string
 *                 format: password
 *                 example: admin123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       401:
 *         description: Sai thông tin đăng nhập
 */
exports.authRouter.post("/login", security_middleware_1.authRateLimiter, async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            error: "Validation error",
            details: result.error.issues,
        });
        return;
    }
    const { username, email, password } = result.data;
    try {
        const conditions = [];
        if (username)
            conditions.push({ username });
        if (email)
            conditions.push({ email });
        const user = await prisma_1.default.user.findFirst({
            where: { OR: conditions },
            include: {
                department: true,
            },
        });
        if (!user) {
            res.status(401).json({ error: "Invalid username/email or password" });
            return;
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValidPassword) {
            res.status(401).json({ error: "Invalid username/email or password" });
            return;
        }
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
            departmentId: user.departmentId,
        };
        const token = jsonwebtoken_1.default.sign(payload, auth_middleware_1.JWT_SECRET, { expiresIn: "24h" });
        const { passwordHash: _, ...safeUser } = user;
        res.status(200).json({
            token,
            user: safeUser,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin tài khoản hiện tại
 *     description: Trả về thông tin cá nhân và vai trò của người dùng đã xác thực qua Bearer token.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin người dùng hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *       401:
 *         description: Chưa xác thực hoặc token không hợp lệ
 *       404:
 *         description: Người dùng không tồn tại
 */
exports.authRouter.get("/me", auth_middleware_1.requireAuth, async (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            include: {
                department: true,
            },
        });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        const { passwordHash: _, ...safeUser } = user;
        res.status(200).json({ user: safeUser });
    }
    catch (error) {
        console.error("Fetch me error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
