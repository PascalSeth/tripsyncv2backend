import prisma from "../config/database"
import logger from "../utils/logger"
import { encryptionService } from "./encryption.service"

interface AuditLogEntry {
  userId?: string
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  timestamp?: Date
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

interface SecurityEvent {
  type:
    | "LOGIN_ATTEMPT"
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILURE"
    | "PERMISSION_DENIED"
    | "DATA_ACCESS"
    | "DATA_MODIFICATION"
    | "SUSPICIOUS_ACTIVITY"
  userId?: string
  details: Record<string, any>
  ipAddress?: string
  userAgent?: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}

interface ComplianceReport {
  period: { from: Date; to: Date }
  totalEvents: number
  securityEvents: number
  dataAccessEvents: number
  failedLoginAttempts: number
  suspiciousActivities: number
  topUsers: Array<{ userId: string; eventCount: number }>
  topActions: Array<{ action: string; count: number }>
}

export class AuditService {
  private eventBuffer: AuditLogEntry[] = []
  private readonly BUFFER_SIZE = 100
  private readonly FLUSH_INTERVAL = 30000 // 30 seconds

  constructor() {
    this.startAuditProcessor()
  }

  /**
   * Log audit event
   */
  async logEvent(entry: AuditLogEntry): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        ...entry,
        timestamp: entry.timestamp || new Date(),
        details: entry.details ? encryptionService.maskSensitiveData(entry.details) : undefined,
      }

      // Add to buffer for batch processing
      this.eventBuffer.push(auditEntry)

      // Flush buffer if it's full or if it's a critical event
      if (this.eventBuffer.length >= this.BUFFER_SIZE || entry.severity === "CRITICAL") {
        await this.flushEventBuffer()
      }

      // Log critical events immediately to console
      if (entry.severity === "CRITICAL") {
        logger.error("CRITICAL AUDIT EVENT:", auditEntry)
      }
    } catch (error) {
      logger.error("Audit log error:", error)
    }
  }

  /**
   * Log security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await this.logEvent({
        userId: event.userId,
        action: event.type,
        resource: "SECURITY",
        details: event.details,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        severity: event.severity,
      })

      // Additional processing for specific security events
      switch (event.type) {
        case "LOGIN_FAILURE":
          await this.handleFailedLogin(event)
          break
        case "SUSPICIOUS_ACTIVITY":
          await this.handleSuspiciousActivity(event)
          break
        case "PERMISSION_DENIED":
          await this.handlePermissionDenied(event)
          break
      }
    } catch (error) {
      logger.error("Security event log error:", error)
    }
  }

  /**
   * Log data access
   */
  async logDataAccess(
    userId: string,
    resource: string,
    resourceId: string,
    action: "READ" | "create" | "update" | "delete",
    details?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `DATA_${action.toUpperCase()}`,
      resource,
      resourceId,
      details,
      severity: action === "delete" ? "HIGH" : action === "update" ? "MEDIUM" : "LOW",
    })
  }

  /**
   * Log user action
   */
  async logUserAction(
    userId: string,
    action: string,
    resource: string,
    resourceId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const severity = this.determineSeverity(action, resource)

    await this.logEvent({
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress,
      userAgent,
      severity,
    })
  }

  /**
   * Log admin action
   */
  async logAdminAction(
    adminId: string,
    action: string,
    targetResource: string,
    targetId?: string,
    details?: Record<string, any>,
    ipAddress?: string,
  ): Promise<void> {
    await this.logEvent({
      userId: adminId,
      action: `ADMIN_${action}`,
      resource: targetResource,
      resourceId: targetId,
      details,
      ipAddress,
      severity: "HIGH",
    })
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(filters: {
    userId?: string
    action?: string
    resource?: string
    severity?: string
    dateRange?: { from: Date; to: Date }
    page?: number
    limit?: number
  }): Promise<{
    logs: any[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    try {
      const { userId, action, resource, severity, dateRange, page = 1, limit = 50 } = filters
      const skip = (page - 1) * limit

      const where: any = {}
      if (userId) where.userId = userId
      if (action) where.action = { contains: action }
      if (resource) where.resource = resource
      if (severity) where.severity = severity
      if (dateRange) {
        where.timestamp = {
          gte: dateRange.from,
          lte: dateRange.to,
        }
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ])

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get audit logs error:", error)
      throw error
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(period: { from: Date; to: Date }): Promise<ComplianceReport> {
    try {
      const where = {
        timestamp: {
          gte: period.from,
          lte: period.to,
        },
      }

      const [
        totalEvents,
        securityEvents,
        dataAccessEvents,
        failedLoginAttempts,
        suspiciousActivities,
        userStats,
        actionStats,
      ] = await Promise.all([
        prisma.auditLog.count({ where }),

        prisma.auditLog.count({
          where: { ...where, resource: "SECURITY" },
        }),

        prisma.auditLog.count({
          where: { ...where, action: { startsWith: "DATA_" } },
        }),

        prisma.auditLog.count({
          where: { ...where, action: "LOGIN_FAILURE" },
        }),

        prisma.auditLog.count({
          where: { ...where, action: "SUSPICIOUS_ACTIVITY" },
        }),

        prisma.auditLog.groupBy({
          by: ["userId"],
          where,
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),

        prisma.auditLog.groupBy({
          by: ["action"],
          where,
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
      ])

      const topUsers = userStats.map((stat) => ({
        userId: stat.userId || "unknown",
        eventCount: stat._count.id,
      }))

      const topActions = actionStats.map((stat) => ({
        action: stat.action,
        count: stat._count.id,
      }))

      const report: ComplianceReport = {
        period,
        totalEvents,
        securityEvents,
        dataAccessEvents,
        failedLoginAttempts,
        suspiciousActivities,
        topUsers,
        topActions,
      }

      // Save report to file system or external storage
      // await prisma.complianceReport.create({
      //   data: {
      //     period: period as any,
      //     reportData: report as any,
      //     generatedAt: new Date(),
      //   },
      // })

      return report
    } catch (error) {
      logger.error("Generate compliance report error:", error)
      throw error
    }
  }

  /**
   * Search audit logs
   */
  async searchAuditLogs(query: {
    searchTerm?: string
    filters?: Record<string, any>
    dateRange?: { from: Date; to: Date }
    page?: number
    limit?: number
  }): Promise<{
    logs: any[]
    pagination: any
    aggregations: {
      byAction: Array<{ action: string; count: number }>
      bySeverity: Array<{ severity: string; count: number }>
      byResource: Array<{ resource: string; count: number }>
    }
  }> {
    try {
      const { searchTerm, filters = {}, dateRange, page = 1, limit = 50 } = query
      const skip = (page - 1) * limit

      const where: any = { ...filters }
      if (dateRange) {
        where.timestamp = {
          gte: dateRange.from,
          lte: dateRange.to,
        }
      }
      if (searchTerm) {
        where.OR = [
          { action: { contains: searchTerm } },
          { resource: { contains: searchTerm } },
          { details: { path: ["searchableText"], string_contains: searchTerm } },
        ]
      }

      const [logs, total, actionAgg, severityAgg, resourceAgg] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: "desc" },
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
              },
            },
          },
        }),

        prisma.auditLog.count({ where }),

        prisma.auditLog.groupBy({
          by: ["action"],
          where,
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),

        [],

        prisma.auditLog.groupBy({
          by: ["resource"],
          where,
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
      ])

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        aggregations: {
          byAction: actionAgg.map((item) => ({
            action: item.action,
            count: item._count.id,
          })),
          bySeverity: [],
          byResource: resourceAgg.map((item) => ({
            resource: item.resource,
            count: item._count.id,
          })),
        },
      }
    } catch (error) {
      logger.error("Search audit logs error:", error)
      throw error
    }
  }

  private async flushEventBuffer(): Promise<void> {
    try {
      if (this.eventBuffer.length === 0) return

      const events = [...this.eventBuffer]
      this.eventBuffer = []

      await prisma.auditLog.createMany({
        data: events.map((event) => ({
          userId: event.userId,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId,
          details: event.details as any,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          timestamp: event.timestamp!,
          severity: event.severity as any,
        })),
      })

      logger.debug(`Flushed ${events.length} audit events to database`)
    } catch (error) {
      logger.error("Flush audit event buffer error:", error)
      // Re-add events to buffer if flush failed
      this.eventBuffer.unshift(...this.eventBuffer)
    }
  }

  private async handleFailedLogin(event: SecurityEvent): Promise<void> {
    try {
      const { userId, ipAddress } = event

      // Count recent failed attempts
      const recentFailures = await prisma.auditLog.count({
        where: {
          action: "LOGIN_FAILURE",
          OR: [{ userId }, { ipAddress }],
          timestamp: {
            gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
          },
        },
      })

      // If too many failures, log as suspicious activity
      if (recentFailures >= 5) {
        await this.logSecurityEvent({
          type: "SUSPICIOUS_ACTIVITY",
          userId,
          details: {
            reason: "Multiple failed login attempts",
            failureCount: recentFailures,
            ipAddress,
          },
          ipAddress,
          severity: "HIGH",
        })
      }
    } catch (error) {
      logger.error("Handle failed login error:", error)
    }
  }

  private async handleSuspiciousActivity(event: SecurityEvent): Promise<void> {
    try {
      // Log to external security monitoring system
      logger.warn("SUSPICIOUS ACTIVITY DETECTED:", {
        userId: event.userId,
        details: event.details,
        ipAddress: event.ipAddress,
        timestamp: new Date(),
      })

      // Could integrate with external security services here
    } catch (error) {
      logger.error("Handle suspicious activity error:", error)
    }
  }

  private async handlePermissionDenied(event: SecurityEvent): Promise<void> {
    try {
      // Count recent permission denials for this user
      const recentDenials = await prisma.auditLog.count({
        where: {
          userId: event.userId,
          action: "PERMISSION_DENIED",
          timestamp: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      })

      // If too many denials, flag as suspicious
      if (recentDenials >= 10) {
        await this.logSecurityEvent({
          type: "SUSPICIOUS_ACTIVITY",
          userId: event.userId,
          details: {
            reason: "Multiple permission denials",
            denialCount: recentDenials,
          },
          severity: "MEDIUM",
        })
      }
    } catch (error) {
      logger.error("Handle permission denied error:", error)
    }
  }

  private determineSeverity(action: string, resource: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
    // Critical actions
    if (action.includes("DELETE") || action.includes("ADMIN_")) {
      return "CRITICAL"
    }

    // High severity actions
    if (action.includes("UPDATE") || action.includes("PAYMENT") || resource === "USER") {
      return "HIGH"
    }

    // Medium severity actions
    if (action.includes("CREATE") || action.includes("LOGIN")) {
      return "MEDIUM"
    }

    // Default to low
    return "LOW"
  }

  private startAuditProcessor(): void {
    // Flush events periodically
    setInterval(async () => {
      await this.flushEventBuffer()
    }, this.FLUSH_INTERVAL)

    // Flush events on process exit
    process.on("SIGINT", async () => {
      await this.flushEventBuffer()
      process.exit(0)
    })

    process.on("SIGTERM", async () => {
      await this.flushEventBuffer()
      process.exit(0)
    })
  }
}

// Export singleton instance
export const auditService = new AuditService()
