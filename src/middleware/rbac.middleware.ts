import type { Response, NextFunction } from "express"
import type { AuthenticatedRequest } from "../types"
import { UserRole } from "@prisma/client"
import { RBACService } from "../services/rbac.service"
import logger from "../utils/logger"

// Import the Permission type from the service file
type Permission =
  | "CREATE_USER"
  | "READ_USER"
  | "UPDATE_USER"
  | "DELETE_USER"
  | "MANAGE_USER_ROLES"
  | "APPROVE_DRIVER"
  | "SUSPEND_DRIVER"
  | "VIEW_DRIVER_ANALYTICS"
  | "MANAGE_DRIVER_SHIFTS"
  | "CREATE_STORE"
  | "UPDATE_STORE"
  | "MANAGE_STORE_PRODUCTS"
  | "VIEW_STORE_ANALYTICS"
  | "CREATE_PLACE"
  | "UPDATE_PLACE"
  | "APPROVE_PLACE"
  | "MANAGE_PLACE_PHOTOS"
  | "CREATE_SERVICE"
  | "UPDATE_SERVICE"
  | "ASSIGN_DRIVER"
  | "VIEW_PAYMENTS"
  | "PROCESS_REFUNDS"
  | "VIEW_FINANCIAL_REPORTS"
  | "MODERATE_REVIEWS"
  | "MANAGE_NOTIFICATIONS"
  | "HANDLE_REPORTS"
  | "DISPATCH_EMERGENCY"
  | "MANAGE_RESPONDERS"
  | "VIEW_EMERGENCY_ANALYTICS"
  | "COORDINATE_INCIDENTS"

const rbacService = new RBACService()

export const checkPermission = (requiredPermission: Permission) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      const hasPermission = await rbacService.hasPermission(req.user.role, requiredPermission)

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        })
      }

      next()
    } catch (error) {
      logger.error("Permission check error:", error)
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
      })
    }
  }
}

export const checkAnyPermission = (requiredPermissions: Permission[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      const hasAnyPermission = await rbacService.hasAnyPermission(req.user.role, requiredPermissions)

      if (!hasAnyPermission) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        })
      }

      next()
    } catch (error) {
      logger.error("Permission check error:", error)
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
      })
    }
  }
}

export const checkAllPermissions = (requiredPermissions: Permission[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      // Fix: Pass user.role to match the service method signature
      const hasPermissions = await rbacService.hasPermissions(req.user.role, requiredPermissions)

      if (!hasPermissions) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions",
        })
      }

      next()
    } catch (error) {
      logger.error("Permission check error:", error)
      return res.status(500).json({
        success: false,
        message: "Permission check failed",
      })
    }
  }
}

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      })
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient role permissions",
      })
    }

    next()
  }
}

export const requireOwnership = (resourceIdParam = "id") => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      const resourceId = req.params[resourceIdParam]
      const userId = req.user.id

      // Fix: Use proper comparison for admin roles
      if (req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.CITY_ADMIN || resourceId === userId) {
        return next()
      }

      return res.status(403).json({
        success: false,
        message: "Access denied - resource ownership required",
      })
    } catch (error) {
      logger.error("Ownership check error:", error)
      return res.status(500).json({
        success: false,
        message: "Ownership check failed",
      })
    }
  }
}

// Alias for compatibility
export const rbacMiddleware = requireRole
