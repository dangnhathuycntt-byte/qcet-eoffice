"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatBroadcaster = exports.SSEBroadcaster = exports.chatRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
exports.chatRouter = (0, express_1.Router)();
// ==========================================
// SSE Broadcaster
// ==========================================
class SSEBroadcaster {
    clients = new Map();
    addClient(userId, res) {
        if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
        }
        this.clients.get(userId).add(res);
    }
    removeClient(userId, res) {
        const userClients = this.clients.get(userId);
        if (userClients) {
            userClients.delete(res);
            if (userClients.size === 0) {
                this.clients.delete(userId);
            }
        }
    }
    sendToUser(userId, event, data) {
        const userClients = this.clients.get(userId);
        if (userClients) {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            userClients.forEach((res) => {
                try {
                    res.write(payload);
                }
                catch {
                    // Socket closed or error writing
                }
            });
        }
    }
    broadcastToUsers(userIds, event, data) {
        for (const userId of userIds) {
            this.sendToUser(userId, event, data);
        }
    }
    getConnectedCount(userId) {
        if (userId) {
            return this.clients.get(userId)?.size || 0;
        }
        let total = 0;
        this.clients.forEach((set) => {
            total += set.size;
        });
        return total;
    }
    clear() {
        this.clients.clear();
    }
}
exports.SSEBroadcaster = SSEBroadcaster;
exports.chatBroadcaster = new SSEBroadcaster();
// ==========================================
// Validation Schemas
// ==========================================
const channelTypeEnum = zod_1.z.enum(["DIRECT", "DEPARTMENT", "TASK_CONTEXT", "DOCUMENT_CONTEXT"]);
const getChannelsQuerySchema = zod_1.z.object({
    type: channelTypeEnum.optional(),
    taskId: zod_1.z.string().optional(),
    documentId: zod_1.z.string().optional(),
});
const createChannelSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    type: channelTypeEnum.default("DIRECT"),
    departmentId: zod_1.z.string().optional(),
    taskId: zod_1.z.string().optional(),
    documentId: zod_1.z.string().optional(),
    memberIds: zod_1.z.array(zod_1.z.string()).default([]),
});
const getMessagesQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
});
const attachmentSchema = zod_1.z.object({
    fileUrl: zod_1.z.string().min(1, "fileUrl is required"),
    fileName: zod_1.z.string().min(1, "fileName is required"),
    fileSize: zod_1.z.number().int().nonnegative("fileSize must be non-negative"),
    mimeType: zod_1.z.string().min(1, "mimeType is required"),
});
const sendMessageSchema = zod_1.z.object({
    content: zod_1.z.string().trim().min(1, "Content must not be empty"),
    attachments: zod_1.z.array(attachmentSchema).optional(),
    mentions: zod_1.z.array(zod_1.z.string()).optional(),
});
// ==========================================
// Routes
// ==========================================
/**
 * @openapi
 * /api/chat/stream:
 *   get:
 *     summary: Server-Sent Events (SSE) live chat stream
 *     description: Mở kết nối SSE theo dõi tin nhắn và thông báo mới thời gian thực. Giữ kết nối qua heartbeat định kỳ.
 *     tags:
 *       - Chat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: JWT token dự phòng khi không truyền header Authorization (EventSource standard)
 *     responses:
 *       200:
 *         description: SSE event stream opened
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       401:
 *         description: Chưa xác thực
 */
exports.chatRouter.get("/stream", auth_middleware_1.requireAuth, (req, res) => {
    const userId = req.user.id;
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    });
    // Gửi sự kiện ban đầu xác nhận kết nối
    res.write(`event: connected\ndata: ${JSON.stringify({ userId, connectedAt: new Date().toISOString() })}\n\n`);
    exports.chatBroadcaster.addClient(userId, res);
    // Heartbeat ping mỗi 15 giây
    const heartbeat = setInterval(() => {
        try {
            res.write(": heartbeat\n\n");
        }
        catch {
            clearInterval(heartbeat);
            exports.chatBroadcaster.removeClient(userId, res);
        }
    }, 15000);
    if (heartbeat.unref) {
        heartbeat.unref();
    }
    req.on("close", () => {
        clearInterval(heartbeat);
        exports.chatBroadcaster.removeClient(userId, res);
    });
});
/**
 * @openapi
 * /api/chat/channels:
 *   get:
 *     summary: Danh sách kênh chat của người dùng
 *     description: Lấy danh sách các kênh chat mà người dùng tham gia kèm tin nhắn cuối cùng (lastMessage) và số lượng tin nhắn chưa đọc (unreadCount).
 *     tags:
 *       - Chat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [DIRECT, DEPARTMENT, TASK_CONTEXT, DOCUMENT_CONTEXT]
 *         description: Lọc theo loại kênh
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: string
 *         description: Lọc theo ngữ cảnh Task
 *       - in: query
 *         name: documentId
 *         schema:
 *           type: string
 *         description: Lọc theo ngữ cảnh Document
 *     responses:
 *       200:
 *         description: Danh sách kênh chat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channels:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Chưa xác thực
 */
exports.chatRouter.get("/channels", auth_middleware_1.requireAuth, async (req, res) => {
    const queryResult = getChannelsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        res.status(400).json({ error: "Validation error", details: queryResult.error.issues });
        return;
    }
    const { type, taskId, documentId } = queryResult.data;
    const currentUserId = req.user.id;
    try {
        const whereCondition = {
            members: {
                some: {
                    userId: currentUserId,
                },
            },
        };
        if (type)
            whereCondition.type = type;
        if (taskId)
            whereCondition.taskId = taskId;
        if (documentId)
            whereCondition.documentId = documentId;
        const channels = await prisma_1.default.chatChannel.findMany({
            where: whereCondition,
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                fullName: true,
                                role: true,
                                departmentId: true,
                            },
                        },
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    },
                },
                document: {
                    select: {
                        id: true,
                        title: true,
                        documentNumber: true,
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    include: {
                        sender: {
                            select: {
                                id: true,
                                username: true,
                                fullName: true,
                                role: true,
                            },
                        },
                        attachments: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        const channelsWithMeta = await Promise.all(channels.map(async (channel) => {
            const callerMember = channel.members.find((m) => m.userId === currentUserId);
            const lastReadAt = callerMember?.lastReadAt || new Date(0);
            const unreadCount = await prisma_1.default.chatMessage.count({
                where: {
                    channelId: channel.id,
                    createdAt: { gt: lastReadAt },
                    senderId: { not: currentUserId },
                },
            });
            const lastMessage = channel.messages[0] || null;
            const { messages, ...channelDetails } = channel;
            return {
                ...channelDetails,
                lastMessage,
                unreadCount,
            };
        }));
        res.status(200).json({ channels: channelsWithMeta });
    }
    catch (error) {
        console.error("Fetch chat channels error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/chat/channels:
 *   post:
 *     summary: Tạo kênh chat mới
 *     description: Tạo kênh chat trực tiếp (DIRECT), phòng ban (DEPARTMENT), hoặc luồng thảo luận ngữ cảnh gắn với Task/Document.
 *     tags:
 *       - Chat
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên kênh chat
 *               type:
 *                 type: string
 *                 enum: [DIRECT, DEPARTMENT, TASK_CONTEXT, DOCUMENT_CONTEXT]
 *                 default: DIRECT
 *               departmentId:
 *                 type: string
 *               taskId:
 *                 type: string
 *               documentId:
 *                 type: string
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Kênh chat được tạo thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       404:
 *         description: Không tìm thấy thực thể liên kết (phòng ban, task, document)
 */
exports.chatRouter.post("/channels", auth_middleware_1.requireAuth, async (req, res) => {
    const parseResult = createChannelSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: "Validation error", details: parseResult.error.issues });
        return;
    }
    const { name, type, departmentId, taskId, documentId, memberIds } = parseResult.data;
    const currentUserId = req.user.id;
    try {
        const allMemberIds = Array.from(new Set([currentUserId, ...memberIds]));
        let resolvedName = name;
        if (type === "DIRECT") {
            if (memberIds.length !== 1) {
                res.status(400).json({
                    error: memberIds.length === 0
                        ? "Direct channel requires another member"
                        : "Direct channel requires exactly 1 recipient",
                });
                return;
            }
            const uniqueMembers = Array.from(new Set([currentUserId, ...memberIds]));
            if (uniqueMembers.length !== 2) {
                res.status(400).json({ error: "Direct channel must have exactly 2 members" });
                return;
            }
            const otherMemberId = memberIds[0];
            // Kiểm tra người dùng đối tác tồn tại
            const otherUser = await prisma_1.default.user.findUnique({
                where: { id: otherMemberId },
            });
            if (!otherUser) {
                res.status(404).json({ error: "Recipient user not found" });
                return;
            }
            // Kiểm tra xem đã có kênh DIRECT giữa 2 người này chưa
            const existingChannel = await prisma_1.default.chatChannel.findFirst({
                where: {
                    type: "DIRECT",
                    AND: [
                        { members: { some: { userId: currentUserId } } },
                        { members: { some: { userId: otherMemberId } } },
                    ],
                },
                include: {
                    members: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    username: true,
                                    fullName: true,
                                    role: true,
                                    departmentId: true,
                                },
                            },
                        },
                    },
                },
            });
            if (existingChannel) {
                res.status(200).json({ channel: existingChannel });
                return;
            }
        }
        else if (type === "DEPARTMENT") {
            if (!departmentId) {
                res.status(400).json({ error: "departmentId is required for DEPARTMENT channel" });
                return;
            }
            const department = await prisma_1.default.department.findUnique({
                where: { id: departmentId },
            });
            if (!department) {
                res.status(404).json({ error: "Department not found" });
                return;
            }
            if (!resolvedName) {
                resolvedName = `Phòng ${department.name}`;
            }
            // Tự động thêm toàn bộ thành viên trong phòng ban nếu memberIds rỗng hoặc không truyền
            if (!memberIds || memberIds.length === 0) {
                const deptUsers = (await prisma_1.default.user.findMany({
                    where: { departmentId },
                    select: { id: true },
                })) || [];
                deptUsers.forEach((u) => allMemberIds.push(u.id));
            }
        }
        else if (type === "TASK_CONTEXT") {
            if (!taskId) {
                res.status(400).json({ error: "taskId is required for TASK_CONTEXT channel" });
                return;
            }
            const task = await prisma_1.default.task.findUnique({
                where: { id: taskId },
                include: {
                    assignees: true,
                },
            });
            if (!task) {
                res.status(404).json({ error: "Task not found" });
                return;
            }
            if (!resolvedName) {
                resolvedName = `Thảo luận công việc: ${task.title}`;
            }
            // Tự động bổ sung người tạo task và người thực hiện vào danh sách thành viên nếu chưa có
            allMemberIds.push(task.creatorId);
            task.assignees.forEach((a) => allMemberIds.push(a.userId));
        }
        else if (type === "DOCUMENT_CONTEXT") {
            if (!documentId) {
                res.status(400).json({ error: "documentId is required for DOCUMENT_CONTEXT channel" });
                return;
            }
            const doc = await prisma_1.default.document.findUnique({
                where: { id: documentId },
            });
            if (!doc) {
                res.status(404).json({ error: "Document not found" });
                return;
            }
            if (!resolvedName) {
                resolvedName = `Thảo luận văn bản: ${doc.title}`;
            }
            allMemberIds.push(doc.creatorId);
        }
        const uniqueMembers = Array.from(new Set(allMemberIds));
        const channel = await prisma_1.default.chatChannel.create({
            data: {
                name: resolvedName,
                type,
                departmentId: type === "DEPARTMENT" ? departmentId : undefined,
                taskId: type === "TASK_CONTEXT" ? taskId : undefined,
                documentId: type === "DOCUMENT_CONTEXT" ? documentId : undefined,
                members: {
                    create: uniqueMembers.map((userId) => ({
                        userId,
                    })),
                },
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                fullName: true,
                                role: true,
                                departmentId: true,
                            },
                        },
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                task: {
                    select: {
                        id: true,
                        title: true,
                        status: true,
                    },
                },
                document: {
                    select: {
                        id: true,
                        title: true,
                        documentNumber: true,
                    },
                },
            },
        });
        res.status(201).json({ channel });
    }
    catch (error) {
        console.error("Create chat channel error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/chat/channels/{id}/messages:
 *   get:
 *     summary: Lấy tin nhắn trong kênh chat
 *     description: Lấy danh sách tin nhắn phân trang của kênh chat, bao gồm thông tin người gửi và file đính kèm. Đồng thời cập nhật `lastReadAt` của người gọi.
 *     tags:
 *       - Chat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID kênh chat
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Số lượng tin nhắn cần lấy
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Độ lệch phân trang
 *     responses:
 *       200:
 *         description: Danh sách tin nhắn phân trang
 *       403:
 *         description: Bạn không phải thành viên của kênh này
 *       404:
 *         description: Kênh chat không tồn tại
 */
exports.chatRouter.get("/channels/:id/messages", auth_middleware_1.requireAuth, async (req, res) => {
    const queryResult = getMessagesQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        res.status(400).json({ error: "Validation error", details: queryResult.error.issues });
        return;
    }
    const { limit, offset } = queryResult.data;
    const { id: channelId } = req.params;
    const currentUserId = req.user.id;
    try {
        const channel = await prisma_1.default.chatChannel.findUnique({
            where: { id: channelId },
            include: {
                members: true,
            },
        });
        if (!channel) {
            res.status(404).json({ error: "Channel not found" });
            return;
        }
        const isMember = channel.members.some((m) => m.userId === currentUserId);
        if (!isMember) {
            res.status(403).json({ error: "Forbidden: You are not a member of this channel" });
            return;
        }
        const [messages, total] = await Promise.all([
            prisma_1.default.chatMessage.findMany({
                where: { channelId },
                include: {
                    sender: {
                        select: {
                            id: true,
                            username: true,
                            fullName: true,
                            role: true,
                        },
                    },
                    attachments: true,
                },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
            }),
            prisma_1.default.chatMessage.count({
                where: { channelId },
            }),
        ]);
        // Cập nhật lastReadAt cho caller
        await prisma_1.default.channelMember.update({
            where: {
                channelId_userId: {
                    channelId,
                    userId: currentUserId,
                },
            },
            data: {
                lastReadAt: new Date(),
            },
        });
        res.status(200).json({
            messages,
            total,
            limit,
            offset,
        });
    }
    catch (error) {
        console.error("Fetch channel messages error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
/**
 * @openapi
 * /api/chat/channels/{id}/messages:
 *   post:
 *     summary: Gửi tin nhắn mới vào kênh chat
 *     description: Gửi tin nhắn mới kèm file đính kèm nếu có. Nguyên tử tạo tin nhắn và file trong transaction, cập nhật lastReadAt, phát sự kiện qua SSE broadcaster và tạo Notification cho các thành viên khác.
 *     tags:
 *       - Chat
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID kênh chat
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
 *               mentions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách ID người dùng được nhắc đến
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - fileUrl
 *                     - fileName
 *                     - fileSize
 *                     - mimeType
 *                   properties:
 *                     fileUrl:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     fileSize:
 *                       type: integer
 *                     mimeType:
 *                       type: string
 *     responses:
 *       201:
 *         description: Tin nhắn được tạo và gửi thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Bạn không phải thành viên của kênh này
 *       404:
 *         description: Kênh chat không tồn tại
 */
exports.chatRouter.post("/channels/:id/messages", auth_middleware_1.requireAuth, async (req, res) => {
    const parseResult = sendMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
        res.status(400).json({ error: "Validation error", details: parseResult.error.issues });
        return;
    }
    const { content, attachments, mentions } = parseResult.data;
    const { id: channelId } = req.params;
    const currentUserId = req.user.id;
    const senderUsername = req.user.username;
    try {
        const channel = await prisma_1.default.chatChannel.findUnique({
            where: { id: channelId },
            include: {
                members: true,
            },
        });
        if (!channel) {
            res.status(404).json({ error: "Channel not found" });
            return;
        }
        const isMember = channel.members.some((m) => m.userId === currentUserId);
        if (!isMember) {
            res.status(403).json({ error: "Forbidden: You are not a member of this channel" });
            return;
        }
        const message = await prisma_1.default.$transaction(async (tx) => {
            const createdMessage = await tx.chatMessage.create({
                data: {
                    channelId,
                    senderId: currentUserId,
                    content,
                    attachments: attachments && attachments.length > 0
                        ? {
                            create: attachments.map((att) => ({
                                fileUrl: att.fileUrl,
                                fileName: att.fileName,
                                fileSize: att.fileSize,
                                mimeType: att.mimeType,
                            })),
                        }
                        : undefined,
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            username: true,
                            fullName: true,
                            role: true,
                        },
                    },
                    attachments: true,
                },
            });
            // Cập nhật updatedAt của kênh chat
            await tx.chatChannel.update({
                where: { id: channelId },
                data: { updatedAt: new Date() },
            });
            // Cập nhật lastReadAt của người gửi
            await tx.channelMember.update({
                where: {
                    channelId_userId: {
                        channelId,
                        userId: currentUserId,
                    },
                },
                data: {
                    lastReadAt: new Date(),
                },
            });
            // Tạo thông báo cho các thành viên khác trong kênh và người được nhắc đến
            const otherMembers = channel.members.filter((m) => m.userId !== currentUserId);
            const mentionIds = (mentions || []).filter((id) => id !== currentUserId);
            const mentionSet = new Set(mentionIds);
            if (otherMembers.length > 0 || mentionIds.length > 0) {
                const title = channel.name ? `Tin nhắn mới từ ${senderUsername} (${channel.name})` : `Tin nhắn mới từ ${senderUsername}`;
                const previewContent = content.length > 100 ? content.substring(0, 97) + "..." : content;
                const notifications = [];
                for (const m of otherMembers) {
                    const isMentioned = mentionSet.has(m.userId);
                    notifications.push({
                        userId: m.userId,
                        title: isMentioned
                            ? `${senderUsername} đã nhắc đến bạn trong tin nhắn`
                            : title,
                        message: isMentioned
                            ? `${senderUsername} đã nhắc đến bạn trong tin nhắn`
                            : previewContent,
                        link: `/chat?channelId=${channelId}`,
                        isRead: false,
                    });
                }
                const otherMemberUserIds = new Set(otherMembers.map((m) => m.userId));
                for (const mentionId of mentionIds) {
                    if (!otherMemberUserIds.has(mentionId)) {
                        notifications.push({
                            userId: mentionId,
                            title: `${senderUsername} đã nhắc đến bạn trong tin nhắn`,
                            message: `${senderUsername} đã nhắc đến bạn trong tin nhắn`,
                            link: `/chat?channelId=${channelId}`,
                            isRead: false,
                        });
                    }
                }
                if (notifications.length > 0) {
                    await tx.notification.createMany({
                        data: notifications,
                    });
                }
            }
            return createdMessage;
        });
        const messageWithMentions = {
            ...message,
            mentions: mentions || [],
        };
        // Phát sự kiện realtime qua SSE broadcaster cho tất cả các thành viên trong kênh
        const memberUserIds = channel.members.map((m) => m.userId);
        exports.chatBroadcaster.broadcastToUsers(memberUserIds, "new_message", {
            channelId,
            message: messageWithMentions,
        });
        res.status(201).json({ message: messageWithMentions });
    }
    catch (error) {
        console.error("Send channel message error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
