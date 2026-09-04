"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = exports.requireAuth = exports.JWT_SECRET = exports.DEFAULT_JWT_SECRET = void 0;
exports.validateProductionSecret = validateProductionSecret;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.DEFAULT_JWT_SECRET = "qcet-secret-jwt-key-2026";
exports.JWT_SECRET = process.env.JWT_SECRET || exports.DEFAULT_JWT_SECRET;
function validateProductionSecret() {
    if (process.env.NODE_ENV === "production" &&
        (!process.env.JWT_SECRET || process.env.JWT_SECRET === exports.DEFAULT_JWT_SECRET)) {
        console.error("FATAL SECURITY VULNERABILITY: Application is running in PRODUCTION mode without a secure JWT_SECRET or with the default development fallback key! Exiting immediately to protect security.");
        process.exit(1);
    }
}
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader) {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        token = match ? match[1] : null;
        if (!token) {
            res.status(401).json({ error: "Unauthorized: Invalid authorization header format" });
            return;
        }
    }
    else if (typeof req.query?.token === "string") {
        token = req.query.token;
    }
    if (!token) {
        res.status(401).json({ error: "Unauthorized: No token provided" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, exports.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
        return;
    }
};
exports.requireAuth = requireAuth;
const requireRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized: Authentication required" });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: "Forbidden: Insufficient permissions" });
            return;
        }
        next();
    };
};
exports.requireRoles = requireRoles;
