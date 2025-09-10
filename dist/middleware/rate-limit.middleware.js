"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitMiddleware = exports.RateLimitMiddleware = void 0;
const cache_service_1 = require("../services/cache.service");
const logger_1 = __importDefault(require("../utils/logger"));
class RateLimitMiddleware {
    constructor() {
        this.cacheService = new cache_service_1.CacheService();
        /**
         * Global rate limiting
         */
        this.globalRateLimit = this.createRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 1000, // 1000 requests per 15 minutes
            message: "Too many requests from this IP, please try again later",
        });
        /**
         * API rate limiting
         */
        this.apiRateLimit = this.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 60, // 60 requests per minute
            message: "API rate limit exceeded",
            keyGenerator: (req) => `api:${this.getClientIP(req)}`,
        });
        /**
         * Authentication rate limiting
         */
        this.authRateLimit = this.createRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            maxRequests: 5, // 5 attempts per 15 minutes
            message: "Too many authentication attempts, please try again later",
            keyGenerator: (req) => `auth:${this.getClientIP(req)}`,
            skipSuccessfulRequests: true,
        });
        /**
         * User-specific rate limiting
         */
        this.userRateLimit = this.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 100, // 100 requests per minute per user
            message: "User rate limit exceeded",
            keyGenerator: (req) => `user:${req.user?.id || this.getClientIP(req)}`,
        });
        /**
         * Booking rate limiting
         */
        this.bookingRateLimit = this.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 5, // 5 booking attempts per minute
            message: "Too many booking attempts, please slow down",
            keyGenerator: (req) => `booking:${req.user?.id || this.getClientIP(req)}`,
        });
        /**
         * Emergency rate limiting (more lenient)
         */
        this.emergencyRateLimit = this.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 10, // 10 emergency requests per minute
            message: "Emergency rate limit exceeded",
            keyGenerator: (req) => `emergency:${req.user?.id || this.getClientIP(req)}`,
        });
        /**
         * File upload rate limiting
         */
        this.uploadRateLimit = this.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 10, // 10 uploads per minute
            message: "Upload rate limit exceeded",
            keyGenerator: (req) => `upload:${req.user?.id || this.getClientIP(req)}`,
        });
        /**
         * Admin rate limiting (higher limits)
         */
        this.adminRateLimit = this.createRateLimit({
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 200, // 200 requests per minute for admins
            message: "Admin rate limit exceeded",
            keyGenerator: (req) => `admin:${req.user?.id || this.getClientIP(req)}`,
            skip: (req) => !req.user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(req.user.role),
        });
        this.defaultKeyGenerator = (req) => {
            return this.getClientIP(req);
        };
    }
    /**
     * Create rate limiting middleware
     */
    createRateLimit(config) {
        const { windowMs, maxRequests, message = "Too many requests, please try again later", statusCode = 429, skipSuccessfulRequests = false, skipFailedRequests = false, keyGenerator = this.defaultKeyGenerator, skip, onLimitReached, } = config;
        return async (req, res, next) => {
            try {
                // Skip if condition is met
                if (skip && skip(req)) {
                    return next();
                }
                const key = keyGenerator(req);
                const { allowed, remaining, resetTime } = await this.cacheService.checkRateLimit(key, {
                    windowMs,
                    maxRequests,
                });
                // Set rate limit headers
                res.set({
                    "X-RateLimit-Limit": maxRequests.toString(),
                    "X-RateLimit-Remaining": remaining.toString(),
                    "X-RateLimit-Reset": new Date(resetTime).toISOString(),
                });
                if (!allowed) {
                    if (onLimitReached) {
                        onLimitReached(req, res);
                    }
                    logger_1.default.warn(`Rate limit exceeded for ${key}`);
                    return res.status(statusCode).json({
                        error: "Rate limit exceeded",
                        message,
                        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
                    });
                }
                // Track the request for rate limiting
                const originalSend = res.send;
                res.send = function (body) {
                    const shouldSkip = (skipSuccessfulRequests && res.statusCode < 400) || (skipFailedRequests && res.statusCode >= 400);
                    if (!shouldSkip) {
                        // Request is already counted in checkRateLimit
                    }
                    return originalSend.call(this, body);
                };
                next();
            }
            catch (error) {
                logger_1.default.error("Rate limit middleware error:", error);
                next(); // Continue on error to avoid blocking requests
            }
        };
    }
    getClientIP(req) {
        return (req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection?.socket?.remoteAddress ||
            "unknown");
    }
}
exports.RateLimitMiddleware = RateLimitMiddleware;
// Export singleton instance
exports.rateLimitMiddleware = new RateLimitMiddleware();
