import type { Response, NextFunction } from "express"
import type { AuthenticatedRequest, UserPayload } from "../types"
import prisma from "../config/database"
import { RBACService } from "../services/rbac.service"
import logger from "../utils/logger"
import jwt, { type Secret } from "jsonwebtoken"

const rbacService = new RBACService()
const JWT_SECRET: Secret = process.env.JWT_SECRET || "your_super_secret_jwt_key"

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(" ")[1]

    logger.info("Authentication attempt:", {
      hasAuthHeader: !!authHeader,
      authHeaderValue: authHeader ? `${authHeader.substring(0, 20)}...` : null,
      hasToken: !!token,
      tokenLength: token?.length,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    })

    if (!token) {
      logger.warn("No token provided in request")
      return res.status(401).json({
        success: false,
        message: "Access token required",
      })
    }

    // Verify JWT token
    let decodedToken: { userId: string; role: string; permissions: string[] }
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; permissions: string[] }
      logger.info("JWT token verified successfully:", {
        userId: decodedToken.userId,
        role: decodedToken.role,
      })
    } catch (jwtError) {
      logger.error("JWT verification failed:", {
        error: jwtError instanceof Error ? jwtError.message : "Unknown JWT error",
        tokenPrefix: token ? token.substring(0, 10) : null,
      })
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      })
    }

    // Check if the token is active in the database
    const session = await prisma.userSession.findUnique({
      where: { token: token },
      select: {
        isActive: true,
        expiresAt: true,
        userId: true,
        createdAt: true,
      },
    })

    logger.info("Session lookup result:", {
      hasSession: !!session,
      sessionUserId: session?.userId,
      tokenUserId: decodedToken.userId,
      isActive: session?.isActive,
      expiresAt: session?.expiresAt,
      isExpired: session ? session.expiresAt < new Date() : null,
    })

    if (!session) {
      logger.warn("No session found for token", {
        tokenUserId: decodedToken.userId,
        tokenPrefix: token.substring(0, 10),
      })
      return res.status(401).json({
        success: false,
        message: "Session not found - please login again",
      })
    }

    if (!session.isActive) {
      logger.warn("Session is inactive:", {
        sessionUserId: session.userId,
        tokenUserId: decodedToken.userId,
      })
      return res.status(401).json({
        success: false,
        message: "Session is inactive - please login again",
      })
    }

    if (session.expiresAt < new Date()) {
      logger.warn("Session has expired:", {
        sessionUserId: session.userId,
        expiresAt: session.expiresAt,
        currentTime: new Date(),
      })

      await prisma.userSession.update({
        where: { token: token },
        data: { isActive: false },
      })

      return res.status(401).json({
        success: false,
        message: "Session has expired - please login again",
      })
    }

    if (session.userId !== decodedToken.userId) {
      logger.error("Session userId mismatch:", {
        sessionUserId: session.userId,
        tokenUserId: decodedToken.userId,
      })
      return res.status(401).json({
        success: false,
        message: "Token session mismatch",
      })
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isActive: true,
      },
    })

    if (!user) {
      logger.error("User not found for valid token:", {
        userId: decodedToken.userId,
      })
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (!user.isActive) {
      logger.warn("Inactive user attempted access:", {
        userId: user.id,
        email: user.email,
      })
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      })
    }

    // Get user permissions
    const permissions = await rbacService.getUserPermissions(user.role)

    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      permissions,
      isVerified: user.isVerified,
      isActive: true,
    }

    req.user = userPayload

    if (!req.user) {
      logger.error("CRITICAL: User failed to attach to request after assignment", {
        userPayload,
        requestId: req.headers["x-request-id"],
      })
      return res.status(500).json({
        success: false,
        message: "Authentication system error",
      })
    }

    logger.info("Authentication successful - User attached to request:", {
      userId: user.id,
      role: user.role,
      permissionsCount: permissions.length,
      hasUserInRequest: !!req.user,
      userIdInRequest: req.user.id,
    })

    next()
  } catch (error) {
    logger.error("Authentication error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : null,
    })
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    })
  }
}

export const authenticateOptional = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(" ")[1]

    if (!token) {
      logger.info("Optional auth: No token provided, continuing without authentication")
      return next()
    }

    let decodedToken: { userId: string; role: string; permissions: string[] }
    try {
      decodedToken = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; permissions: string[] }
    } catch (jwtError) {
      logger.warn("Optional auth: JWT verification failed, continuing without user context:", {
        error: jwtError instanceof Error ? jwtError.message : "Unknown JWT error",
      })
      return next()
    }

    const session = await prisma.userSession.findUnique({
      where: { token: token },
      select: { isActive: true, expiresAt: true, userId: true },
    })

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      logger.warn("Optional authentication: Invalid or expired token, continuing without user context.")
      return next()
    }

    if (session.userId !== decodedToken.userId) {
      logger.warn("Optional auth: Session userId mismatch, continuing without user context")
      return next()
    }

    const user = await prisma.user.findUnique({
      where: { id: decodedToken.userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        isActive: true,
      },
    })

    if (user && user.isActive) {
      const permissions = await rbacService.getUserPermissions(user.role)

      const userPayload: UserPayload = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions,
        isVerified: user.isVerified,
        isActive: true,
      }

      req.user = userPayload

      logger.info("Optional authentication successful:", {
        userId: user.id,
        role: user.role,
      })
    } else {
      logger.warn("Optional auth: User not found or inactive, continuing without user context")
    }

    next()
  } catch (error) {
    logger.warn("Optional authentication failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
    })
    next()
  }
}

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    logger.info("Role check:", {
      hasUser: !!req.user,
      userRole: req.user?.role,
      requiredRoles: roles,
    })

    if (!req.user) {
      logger.warn("Role check failed: No authenticated user")
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      })
    }

    if (!roles.includes(req.user.role)) {
      logger.warn("Role check failed: Insufficient permissions", {
        userRole: req.user.role,
        requiredRoles: roles,
      })
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      })
    }

    logger.info("Role check passed")
    next()
  }
}

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    logger.info("Permission check:", {
      hasUser: !!req.user,
      userPermissions: req.user?.permissions,
      requiredPermission: permission,
    })

    if (!req.user) {
      logger.warn("Permission check failed: No authenticated user")
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      })
    }

    if (!req.user.permissions.includes(permission as any)) {
      logger.warn("Permission check failed: Insufficient permissions", {
        userPermissions: req.user.permissions,
        requiredPermission: permission,
      })
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
      })
    }

    logger.info("Permission check passed")
    next()
  }
}

export const requireVerification = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  logger.info("Verification check:", {
    hasUser: !!req.user,
    isVerified: req.user?.isVerified,
  })

  if (!req.user) {
    logger.warn("Verification check failed: No authenticated user")
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    })
  }

  if (!req.user.isVerified) {
    logger.warn("Verification check failed: Account not verified", {
      userId: req.user.id,
    })
    return res.status(403).json({
      success: false,
      message: "Account verification required",
    })
  }

  logger.info("Verification check passed")
  next()
}

// NEW: Driver-specific authentication middleware
export const requireDriverRole = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  logger.info("Driver role check:", {
    hasUser: !!req.user,
    userRole: req.user?.role,
  })

  if (!req.user) {
    logger.warn("Driver role check failed: No authenticated user")
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    })
  }

  if (!["DRIVER", "TAXI_DRIVER"].includes(req.user.role)) {
    logger.warn("Driver role check failed: Not a driver", {
      userRole: req.user.role,
    })
    return res.status(403).json({
      success: false,
      message: "Driver access required",
      code: "NOT_A_DRIVER",
    })
  }

  logger.info("Driver role check passed")
  next()
}

// Aliases for compatibility
export const authMiddleware = authenticateToken
export const optionalAuthMiddleware = authenticateOptional
