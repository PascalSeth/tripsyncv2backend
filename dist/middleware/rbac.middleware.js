"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacMiddleware = exports.requireOwnership = exports.requireRole = exports.checkAllPermissions = exports.checkAnyPermission = exports.checkPermission = void 0;
const client_1 = require("@prisma/client");
const rbac_service_1 = require("../services/rbac.service");
const logger_1 = __importDefault(require("../utils/logger"));
const rbacService = new rbac_service_1.RBACService();
const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }
            const hasPermission = await rbacService.hasPermission(req.user.role, requiredPermission);
            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: "Insufficient permissions",
                });
            }
            next();
        }
        catch (error) {
            logger_1.default.error("Permission check error:", error);
            return res.status(500).json({
                success: false,
                message: "Permission check failed",
            });
        }
    };
};
exports.checkPermission = checkPermission;
const checkAnyPermission = (requiredPermissions) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }
            const hasAnyPermission = await rbacService.hasAnyPermission(req.user.role, requiredPermissions);
            if (!hasAnyPermission) {
                return res.status(403).json({
                    success: false,
                    message: "Insufficient permissions",
                });
            }
            next();
        }
        catch (error) {
            logger_1.default.error("Permission check error:", error);
            return res.status(500).json({
                success: false,
                message: "Permission check failed",
            });
        }
    };
};
exports.checkAnyPermission = checkAnyPermission;
const checkAllPermissions = (requiredPermissions) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }
            // Fix: Pass user.role to match the service method signature
            const hasPermissions = await rbacService.hasPermissions(req.user.role, requiredPermissions);
            if (!hasPermissions) {
                return res.status(403).json({
                    success: false,
                    message: "Insufficient permissions",
                });
            }
            next();
        }
        catch (error) {
            logger_1.default.error("Permission check error:", error);
            return res.status(500).json({
                success: false,
                message: "Permission check failed",
            });
        }
    };
};
exports.checkAllPermissions = checkAllPermissions;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Insufficient role permissions",
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
const requireOwnership = (resourceIdParam = "id") => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }
            const resourceId = req.params[resourceIdParam];
            const userId = req.user.id;
            // Fix: Use proper comparison for admin roles
            if (req.user.role === client_1.UserRole.SUPER_ADMIN || req.user.role === client_1.UserRole.CITY_ADMIN || resourceId === userId) {
                return next();
            }
            return res.status(403).json({
                success: false,
                message: "Access denied - resource ownership required",
            });
        }
        catch (error) {
            logger_1.default.error("Ownership check error:", error);
            return res.status(500).json({
                success: false,
                message: "Ownership check failed",
            });
        }
    };
};
exports.requireOwnership = requireOwnership;
// Alias for compatibility
exports.rbacMiddleware = exports.requireRole;
