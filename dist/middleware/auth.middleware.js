"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthMiddleware = exports.authMiddleware = exports.requireDriverRole = exports.requireVerification = exports.requirePermission = exports.requireRole = exports.authenticateOptional = exports.authenticateToken = void 0;
const database_1 = __importDefault(require("../config/database"));
const rbac_service_1 = require("../services/rbac.service");
const logger_1 = __importDefault(require("../utils/logger"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const rbacService = new rbac_service_1.RBACService();
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];
        logger_1.default.info("Authentication attempt:", {
            hasAuthHeader: !!authHeader,
            authHeaderValue: authHeader ? `${authHeader.substring(0, 20)}...` : null,
            hasToken: !!token,
            tokenLength: token?.length,
            userAgent: req.headers["user-agent"],
            ip: req.ip,
        });
        if (!token) {
            logger_1.default.warn("No token provided in request");
            return res.status(401).json({
                success: false,
                message: "Access token required",
            });
        }
        // Verify JWT token
        let decodedToken;
        try {
            decodedToken = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            logger_1.default.info("JWT token verified successfully:", {
                userId: decodedToken.userId,
                role: decodedToken.role,
            });
        }
        catch (jwtError) {
            logger_1.default.error("JWT verification failed:", {
                error: jwtError instanceof Error ? jwtError.message : "Unknown JWT error",
                tokenPrefix: token ? token.substring(0, 10) : null,
            });
            return res.status(401).json({
                success: false,
                message: "Invalid or expired token",
            });
        }
        // Check if the token is active in the database
        const session = await database_1.default.userSession.findUnique({
            where: { token: token },
            select: {
                isActive: true,
                expiresAt: true,
                userId: true,
                createdAt: true,
            },
        });
        logger_1.default.info("Session lookup result:", {
            hasSession: !!session,
            sessionUserId: session?.userId,
            tokenUserId: decodedToken.userId,
            isActive: session?.isActive,
            expiresAt: session?.expiresAt,
            isExpired: session ? session.expiresAt < new Date() : null,
        });
        if (!session) {
            logger_1.default.warn("No session found for token", {
                tokenUserId: decodedToken.userId,
                tokenPrefix: token.substring(0, 10),
            });
            return res.status(401).json({
                success: false,
                message: "Session not found - please login again",
            });
        }
        if (!session.isActive) {
            logger_1.default.warn("Session is inactive:", {
                sessionUserId: session.userId,
                tokenUserId: decodedToken.userId,
            });
            return res.status(401).json({
                success: false,
                message: "Session is inactive - please login again",
            });
        }
        if (session.expiresAt < new Date()) {
            logger_1.default.warn("Session has expired:", {
                sessionUserId: session.userId,
                expiresAt: session.expiresAt,
                currentTime: new Date(),
            });
            await database_1.default.userSession.update({
                where: { token: token },
                data: { isActive: false },
            });
            return res.status(401).json({
                success: false,
                message: "Session has expired - please login again",
            });
        }
        if (session.userId !== decodedToken.userId) {
            logger_1.default.error("Session userId mismatch:", {
                sessionUserId: session.userId,
                tokenUserId: decodedToken.userId,
            });
            return res.status(401).json({
                success: false,
                message: "Token session mismatch",
            });
        }
        // Get user from database
        const user = await database_1.default.user.findUnique({
            where: { id: decodedToken.userId },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                isVerified: true,
                isActive: true,
            },
        });
        if (!user) {
            logger_1.default.error("User not found for valid token:", {
                userId: decodedToken.userId,
            });
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        if (!user.isActive) {
            logger_1.default.warn("Inactive user attempted access:", {
                userId: user.id,
                email: user.email,
            });
            return res.status(403).json({
                success: false,
                message: "Account is deactivated",
            });
        }
        // Get user permissions
        const permissions = await rbacService.getUserPermissions(user.role);
        const userPayload = {
            id: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            permissions,
            isVerified: user.isVerified,
            isActive: true,
        };
        req.user = userPayload;
        if (!req.user) {
            logger_1.default.error("CRITICAL: User failed to attach to request after assignment", {
                userPayload,
                requestId: req.headers["x-request-id"],
            });
            return res.status(500).json({
                success: false,
                message: "Authentication system error",
            });
        }
        logger_1.default.info("Authentication successful - User attached to request:", {
            userId: user.id,
            role: user.role,
            permissionsCount: permissions.length,
            hasUserInRequest: !!req.user,
            userIdInRequest: req.user.id,
        });
        next();
    }
    catch (error) {
        logger_1.default.error("Authentication error:", {
            error: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : null,
        });
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
        });
    }
};
exports.authenticateToken = authenticateToken;
const authenticateOptional = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];
        if (!token) {
            logger_1.default.info("Optional auth: No token provided, continuing without authentication");
            return next();
        }
        let decodedToken;
        try {
            decodedToken = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (jwtError) {
            logger_1.default.warn("Optional auth: JWT verification failed, continuing without user context:", {
                error: jwtError instanceof Error ? jwtError.message : "Unknown JWT error",
            });
            return next();
        }
        const session = await database_1.default.userSession.findUnique({
            where: { token: token },
            select: { isActive: true, expiresAt: true, userId: true },
        });
        if (!session || !session.isActive || session.expiresAt < new Date()) {
            logger_1.default.warn("Optional authentication: Invalid or expired token, continuing without user context.");
            return next();
        }
        if (session.userId !== decodedToken.userId) {
            logger_1.default.warn("Optional auth: Session userId mismatch, continuing without user context");
            return next();
        }
        const user = await database_1.default.user.findUnique({
            where: { id: decodedToken.userId },
            select: {
                id: true,
                email: true,
                phone: true,
                role: true,
                isVerified: true,
                isActive: true,
            },
        });
        if (user && user.isActive) {
            const permissions = await rbacService.getUserPermissions(user.role);
            const userPayload = {
                id: user.id,
                email: user.email,
                phone: user.phone,
                role: user.role,
                permissions,
                isVerified: user.isVerified,
                isActive: true,
            };
            req.user = userPayload;
            logger_1.default.info("Optional authentication successful:", {
                userId: user.id,
                role: user.role,
            });
        }
        else {
            logger_1.default.warn("Optional auth: User not found or inactive, continuing without user context");
        }
        next();
    }
    catch (error) {
        logger_1.default.warn("Optional authentication failed:", {
            error: error instanceof Error ? error.message : "Unknown error",
        });
        next();
    }
};
exports.authenticateOptional = authenticateOptional;
const requireRole = (roles) => {
    return (req, res, next) => {
        logger_1.default.info("Role check:", {
            hasUser: !!req.user,
            userRole: req.user?.role,
            requiredRoles: roles,
        });
        if (!req.user) {
            logger_1.default.warn("Role check failed: No authenticated user");
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        if (!roles.includes(req.user.role)) {
            logger_1.default.warn("Role check failed: Insufficient permissions", {
                userRole: req.user.role,
                requiredRoles: roles,
            });
            return res.status(403).json({
                success: false,
                message: "Insufficient permissions",
            });
        }
        logger_1.default.info("Role check passed");
        next();
    };
};
exports.requireRole = requireRole;
const requirePermission = (permission) => {
    return (req, res, next) => {
        logger_1.default.info("Permission check:", {
            hasUser: !!req.user,
            userPermissions: req.user?.permissions,
            requiredPermission: permission,
        });
        if (!req.user) {
            logger_1.default.warn("Permission check failed: No authenticated user");
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        if (!req.user.permissions.includes(permission)) {
            logger_1.default.warn("Permission check failed: Insufficient permissions", {
                userPermissions: req.user.permissions,
                requiredPermission: permission,
            });
            return res.status(403).json({
                success: false,
                message: "Insufficient permissions",
            });
        }
        logger_1.default.info("Permission check passed");
        next();
    };
};
exports.requirePermission = requirePermission;
const requireVerification = (req, res, next) => {
    logger_1.default.info("Verification check:", {
        hasUser: !!req.user,
        isVerified: req.user?.isVerified,
    });
    if (!req.user) {
        logger_1.default.warn("Verification check failed: No authenticated user");
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }
    if (!req.user.isVerified) {
        logger_1.default.warn("Verification check failed: Account not verified", {
            userId: req.user.id,
        });
        return res.status(403).json({
            success: false,
            message: "Account verification required",
        });
    }
    logger_1.default.info("Verification check passed");
    next();
};
exports.requireVerification = requireVerification;
// NEW: Driver-specific authentication middleware
const requireDriverRole = (req, res, next) => {
    logger_1.default.info("Driver role check:", {
        hasUser: !!req.user,
        userRole: req.user?.role,
    });
    if (!req.user) {
        logger_1.default.warn("Driver role check failed: No authenticated user");
        return res.status(401).json({
            success: false,
            message: "Authentication required",
        });
    }
    if (!["DRIVER", "TAXI_DRIVER"].includes(req.user.role)) {
        logger_1.default.warn("Driver role check failed: Not a driver", {
            userRole: req.user.role,
        });
        return res.status(403).json({
            success: false,
            message: "Driver access required",
            code: "NOT_A_DRIVER",
        });
    }
    logger_1.default.info("Driver role check passed");
    next();
};
exports.requireDriverRole = requireDriverRole;
// Aliases for compatibility
exports.authMiddleware = exports.authenticateToken;
exports.optionalAuthMiddleware = exports.authenticateOptional;
