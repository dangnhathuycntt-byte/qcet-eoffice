"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.notificationRouter = (0, express_1.Router)();
const getNotificationsQuerySchema = zod_1.z.object({
    unreadOnly: zod_1.z
        .union([zod_1.z.enum(["true", "false"]), zod_1.z.boolean()])
        .transform((val) => val === true || val === "true")
        .optional(),
});
/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Lấy danh sách thông báo của người dùng
 *     description: Trả về danh sách thông báo của người dùng hiện tại, sắp xếp mới nhất trước, hỗ trợ lọc thông báo chưa đọc và số lượng chưa đọc.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *         description: Chỉ lấy thông báo chưa đọc
 *     responses:
 *       200:
 *         description: Danh sách thông báo kèm tổng số chưa đọc
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                 unreadCount:
 *                   type: integer
 *       401:
 *         description: Chưa xác thực
 */
exports.notificationRouter.get("/", auth_middleware_1.requireAuth, async (req, res) => {
    const queryResult = getNotificationsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        res.status(400).json({
            error: "Validation error",
            details: queryResult.error.issues,
        });
        return;
    }
    const { unreadOnly } = queryResult.data;
    const where = {
        userId: req.user.id,
    };
    if (unreadOnly) {
        where.isRead = false;
    }
    try {
        const [notifications, unreadCount] = await Promise.all([
            prisma_1.default.notification.findMany({
                where,
                orderBy: {
                    createdAt: "desc",
                },
            }),
            prisma_1.default.notification.count({
                where: {
                    userId: req.user.id,
                    isRead: false,
                },
            }),
        ]);
        res.status(200).json({
            notifications,
            unreadCount,
        });
    }
    catch (error) {
        console.error("Fetch notifications error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Đánh dấu một thông báo là đã đọc
 *     description: Cập nhật trạng thái thông báo thành đã đọc (isRead = true), đảm bảo thông báo thuộc về người dùng hiện tại.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID thông báo
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Chưa xác thực
 *       403:
 *         description: Không có quyền truy cập thông báo của người khác
 *       404:
 *         description: Không tìm thấy thông báo
 */
exports.notificationRouter.patch("/:id/read", auth_middleware_1.requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const notification = await prisma_1.default.notification.findUnique({
            where: { id },
        });
        if (!notification) {
            res.status(404).json({ error: "Notification not found" });
            return;
        }
        if (notification.userId !== req.user.id) {
            res.status(403).json({ error: "Forbidden: You do not have access to this notification" });
            return;
        }
        const updated = await prisma_1.default.notification.update({
            where: { id },
            data: { isRead: true },
        });
        res.status(200).json(updated);
    }
    catch (error) {
        console.error("Mark notification read error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     summary: Đánh dấu tất cả thông báo là đã đọc
 *     description: Đánh dấu toàn bộ thông báo của người dùng hiện tại thành đã đọc.
 *     tags:
 *       - Notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tất cả thông báo đã được đánh dấu đã đọc
 *       401:
 *         description: Chưa xác thực
 */
exports.notificationRouter.patch("/read-all", auth_middleware_1.requireAuth, async (req, res) => {
    try {
        const result = await prisma_1.default.notification.updateMany({
            where: {
                userId: req.user.id,
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });
        res.status(200).json({
            message: "All notifications marked as read",
            count: result.count,
        });
    }
    catch (error) {
        console.error("Mark all notifications read error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
