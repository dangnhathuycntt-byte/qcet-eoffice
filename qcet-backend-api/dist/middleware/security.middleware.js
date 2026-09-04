"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signatureRateLimiter = exports.authRateLimiter = exports.createRateLimiter = exports.resetAllRateLimiters = exports.securityHeaders = void 0;
/**
 * Middleware thiết lập các security headers chuẩn (OWASP recommendations)
 */
const securityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env.NODE_ENV === "production") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
};
exports.securityHeaders = securityHeaders;
const allRateLimitStores = [];
/**
 * Reset toàn bộ in-memory store cho unit tests
 */
const resetAllRateLimiters = () => {
    for (const store of allRateLimitStores) {
        store.clear();
    }
};
exports.resetAllRateLimiters = resetAllRateLimiters;
/**
 * Lightweight in-memory rate limiter middleware factory
 */
const createRateLimiter = (options) => {
    const store = new Map();
    allRateLimitStores.push(store);
    const defaultKeyGen = (req) => {
        const forwarded = req.headers["x-forwarded-for"];
        if (typeof forwarded === "string") {
            return forwarded.split(",")[0].trim();
        }
        return req.ip || req.socket.remoteAddress || "127.0.0.1";
    };
    const limiter = (req, res, next) => {
        const now = Date.now();
        const keyGen = options.keyGenerator || defaultKeyGen;
        const key = keyGen(req);
        const record = store.get(key);
        if (!record || now >= record.resetTime) {
            store.set(key, {
                count: 1,
                resetTime: now + options.windowMs,
            });
            res.setHeader("X-RateLimit-Limit", options.maxRequests);
            res.setHeader("X-RateLimit-Remaining", options.maxRequests - 1);
            res.setHeader("X-RateLimit-Reset", Math.ceil((now + options.windowMs) / 1000));
            next();
            return;
        }
        record.count += 1;
        const remaining = Math.max(0, options.maxRequests - record.count);
        const resetTimeSec = Math.ceil(record.resetTime / 1000);
        res.setHeader("X-RateLimit-Limit", options.maxRequests);
        res.setHeader("X-RateLimit-Remaining", remaining);
        res.setHeader("X-RateLimit-Reset", resetTimeSec);
        if (record.count > options.maxRequests) {
            const retryAfterSec = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
            res.setHeader("Retry-After", retryAfterSec);
            res.status(429).json({
                error: "Too Many Requests",
                message: options.message ||
                    "Tần suất yêu cầu vượt quá giới hạn cho phép. Vui lòng thử lại sau.",
            });
            return;
        }
        next();
    };
    limiter.reset = () => {
        store.clear();
    };
    return limiter;
};
exports.createRateLimiter = createRateLimiter;
/**
 * Rate limiter cho endpoint đăng nhập (/api/auth/login)
 * Ngăn chặn brute-force attacks: tối đa 60 lượt / 15 phút (mặc định)
 */
exports.authRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 15 * 60 * 1000,
    maxRequests: process.env.NODE_ENV === "test" ? 1000 : 60,
    message: "Quá nhiều yêu cầu đăng nhập. Vui lòng thử lại sau 15 phút.",
});
/**
 * Rate limiter cho endpoint ký số điện tử (/api/documents/:id/sign)
 * Ngăn chặn lạm dụng tài nguyên tính toán mật mã: tối đa 30 lượt / 1 phút (mặc định)
 */
exports.signatureRateLimiter = (0, exports.createRateLimiter)({
    windowMs: 60 * 1000,
    maxRequests: process.env.NODE_ENV === "test" ? 1000 : 30,
    message: "Quá nhiều yêu cầu ký số điện tử. Vui lòng thử lại sau 1 phút.",
});
