"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const path_1 = __importDefault(require("path"));
const security_middleware_1 = require("./middleware/security.middleware");
const auth_routes_1 = require("./routes/auth.routes");
const department_routes_1 = require("./routes/department.routes");
const task_routes_1 = require("./routes/task.routes");
const notification_routes_1 = require("./routes/notification.routes");
const document_routes_1 = require("./routes/document.routes");
const workflow_routes_1 = require("./routes/workflow.routes");
const signature_routes_1 = require("./routes/signature.routes");
const chat_routes_1 = require("./routes/chat.routes");
const analytics_routes_1 = require("./routes/analytics.routes");
const search_routes_1 = require("./routes/search.routes");
const audit_routes_1 = require("./routes/audit.routes");
exports.app = (0, express_1.default)();
exports.app.use(security_middleware_1.securityHeaders);
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "QCET Core Enterprise API",
            version: "1.0.0",
            description: "Hệ thống API dùng chung cho E-Office, Chấm công và Đào tạo QCET",
        },
        servers: [{ url: process.env.API_BASE_URL || "http://localhost:4000" }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },
    apis: [
        path_1.default.join(__dirname, "routes/*.{ts,js}"),
        path_1.default.join(__dirname, "routes/**/*.{ts,js}"),
    ],
};
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
exports.app.use("/api/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(exports.swaggerSpec));
exports.app.get("/api/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(exports.swaggerSpec);
});
exports.app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "qcet-backend-api" });
});
exports.app.use("/api/auth", auth_routes_1.authRouter);
exports.app.use("/api/departments", department_routes_1.departmentRouter);
exports.app.use("/api/tasks", task_routes_1.taskRouter);
exports.app.use("/api/notifications", notification_routes_1.notificationRouter);
exports.app.use("/api/documents", document_routes_1.documentRouter);
exports.app.use("/api/documents", signature_routes_1.signatureRouter);
exports.app.use("/api/signatures", signature_routes_1.signatureRouter);
exports.app.use("/api/workflows", workflow_routes_1.workflowRouter);
exports.app.use("/api/chat", chat_routes_1.chatRouter);
exports.app.use("/api/analytics", analytics_routes_1.analyticsRouter);
exports.app.use("/api/search", search_routes_1.searchRouter);
exports.app.use("/api/audit", audit_routes_1.auditRouter);
