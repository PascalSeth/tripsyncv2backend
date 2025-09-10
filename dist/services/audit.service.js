"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
const encryption_service_1 = require("./encryption.service");
class AuditService {
    constructor() {
        this.eventBuffer = [];
        this.BUFFER_SIZE = 100;
        this.FLUSH_INTERVAL = 30000; // 30 seconds
        this.startAuditProcessor();
    }
    /**
     * Log audit event
     */
    async logEvent(entry) {
        try {
            const auditEntry = {
                ...entry,
                timestamp: entry.timestamp || new Date(),
                details: entry.details ? encryption_service_1.encryptionService.maskSensitiveData(entry.details) : undefined,
            };
            // Add to buffer for batch processing
            this.eventBuffer.push(auditEntry);
            // Flush buffer if it's full or if it's a critical event
            if (this.eventBuffer.length >= this.BUFFER_SIZE || entry.severity === "CRITICAL") {
                await this.flushEventBuffer();
            }
            // Log critical events immediately to console
            if (entry.severity === "CRITICAL") {
                logger_1.default.error("CRITICAL AUDIT EVENT:", auditEntry);
            }
        }
        catch (error) {
            logger_1.default.error("Audit log error:", error);
        }
    }
    /**
     * Log security event
     */
    async logSecurityEvent(event) {
        try {
            await this.logEvent({
                userId: event.userId,
                action: event.type,
                resource: "SECURITY",
                details: event.details,
                ipAddress: event.ipAddress,
                userAgent: event.userAgent,
                severity: event.severity,
            });
            // Additional processing for specific security events
            switch (event.type) {
                case "LOGIN_FAILURE":
                    await this.handleFailedLogin(event);
                    break;
                case "SUSPICIOUS_ACTIVITY":
                    await this.handleSuspiciousActivity(event);
                    break;
                case "PERMISSION_DENIED":
                    await this.handlePermissionDenied(event);
                    break;
            }
        }
        catch (error) {
            logger_1.default.error("Security event log error:", error);
        }
    }
    /**
     * Log data access
     */
    async logDataAccess(userId, resource, resourceId, action, details) {
        await this.logEvent({
            userId,
            action: `DATA_${action.toUpperCase()}`,
            resource,
            resourceId,
            details,
            severity: action === "delete" ? "HIGH" : action === "update" ? "MEDIUM" : "LOW",
        });
    }
    /**
     * Log user action
     */
    async logUserAction(userId, action, resource, resourceId, details, ipAddress, userAgent) {
        const severity = this.determineSeverity(action, resource);
        await this.logEvent({
            userId,
            action,
            resource,
            resourceId,
            details,
            ipAddress,
            userAgent,
            severity,
        });
    }
    /**
     * Log admin action
     */
    async logAdminAction(adminId, action, targetResource, targetId, details, ipAddress) {
        await this.logEvent({
            userId: adminId,
            action: `ADMIN_${action}`,
            resource: targetResource,
            resourceId: targetId,
            details,
            ipAddress,
            severity: "HIGH",
        });
    }
    /**
     * Get audit logs
     */
    async getAuditLogs(filters) {
        try {
            const { userId, action, resource, severity, dateRange, page = 1, limit = 50 } = filters;
            const skip = (page - 1) * limit;
            const where = {};
            if (userId)
                where.userId = userId;
            if (action)
                where.action = { contains: action };
            if (resource)
                where.resource = resource;
            if (severity)
                where.severity = severity;
            if (dateRange) {
                where.timestamp = {
                    gte: dateRange.from,
                    lte: dateRange.to,
                };
            }
            const [logs, total] = await Promise.all([
                database_1.default.auditLog.findMany({
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
                database_1.default.auditLog.count({ where }),
            ]);
            return {
                logs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get audit logs error:", error);
            throw error;
        }
    }
    /**
     * Generate compliance report
     */
    async generateComplianceReport(period) {
        try {
            const where = {
                timestamp: {
                    gte: period.from,
                    lte: period.to,
                },
            };
            const [totalEvents, securityEvents, dataAccessEvents, failedLoginAttempts, suspiciousActivities, userStats, actionStats,] = await Promise.all([
                database_1.default.auditLog.count({ where }),
                database_1.default.auditLog.count({
                    where: { ...where, resource: "SECURITY" },
                }),
                database_1.default.auditLog.count({
                    where: { ...where, action: { startsWith: "DATA_" } },
                }),
                database_1.default.auditLog.count({
                    where: { ...where, action: "LOGIN_FAILURE" },
                }),
                database_1.default.auditLog.count({
                    where: { ...where, action: "SUSPICIOUS_ACTIVITY" },
                }),
                database_1.default.auditLog.groupBy({
                    by: ["userId"],
                    where,
                    _count: { id: true },
                    orderBy: { _count: { id: "desc" } },
                    take: 10,
                }),
                database_1.default.auditLog.groupBy({
                    by: ["action"],
                    where,
                    _count: { id: true },
                    orderBy: { _count: { id: "desc" } },
                    take: 10,
                }),
            ]);
            const topUsers = userStats.map((stat) => ({
                userId: stat.userId || "unknown",
                eventCount: stat._count.id,
            }));
            const topActions = actionStats.map((stat) => ({
                action: stat.action,
                count: stat._count.id,
            }));
            const report = {
                period,
                totalEvents,
                securityEvents,
                dataAccessEvents,
                failedLoginAttempts,
                suspiciousActivities,
                topUsers,
                topActions,
            };
            // Save report to file system or external storage
            // await prisma.complianceReport.create({
            //   data: {
            //     period: period as any,
            //     reportData: report as any,
            //     generatedAt: new Date(),
            //   },
            // })
            return report;
        }
        catch (error) {
            logger_1.default.error("Generate compliance report error:", error);
            throw error;
        }
    }
    /**
     * Search audit logs
     */
    async searchAuditLogs(query) {
        try {
            const { searchTerm, filters = {}, dateRange, page = 1, limit = 50 } = query;
            const skip = (page - 1) * limit;
            const where = { ...filters };
            if (dateRange) {
                where.timestamp = {
                    gte: dateRange.from,
                    lte: dateRange.to,
                };
            }
            if (searchTerm) {
                where.OR = [
                    { action: { contains: searchTerm } },
                    { resource: { contains: searchTerm } },
                    { details: { path: ["searchableText"], string_contains: searchTerm } },
                ];
            }
            const [logs, total, actionAgg, severityAgg, resourceAgg] = await Promise.all([
                database_1.default.auditLog.findMany({
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
                database_1.default.auditLog.count({ where }),
                database_1.default.auditLog.groupBy({
                    by: ["action"],
                    where,
                    _count: { id: true },
                    orderBy: { _count: { id: "desc" } },
                    take: 10,
                }),
                [],
                database_1.default.auditLog.groupBy({
                    by: ["resource"],
                    where,
                    _count: { id: true },
                    orderBy: { _count: { id: "desc" } },
                    take: 10,
                }),
            ]);
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
            };
        }
        catch (error) {
            logger_1.default.error("Search audit logs error:", error);
            throw error;
        }
    }
    async flushEventBuffer() {
        try {
            if (this.eventBuffer.length === 0)
                return;
            const events = [...this.eventBuffer];
            this.eventBuffer = [];
            await database_1.default.auditLog.createMany({
                data: events.map((event) => ({
                    userId: event.userId,
                    action: event.action,
                    resource: event.resource,
                    resourceId: event.resourceId,
                    details: event.details,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                    timestamp: event.timestamp,
                    severity: event.severity,
                })),
            });
            logger_1.default.debug(`Flushed ${events.length} audit events to database`);
        }
        catch (error) {
            logger_1.default.error("Flush audit event buffer error:", error);
            // Re-add events to buffer if flush failed
            this.eventBuffer.unshift(...this.eventBuffer);
        }
    }
    async handleFailedLogin(event) {
        try {
            const { userId, ipAddress } = event;
            // Count recent failed attempts
            const recentFailures = await database_1.default.auditLog.count({
                where: {
                    action: "LOGIN_FAILURE",
                    OR: [{ userId }, { ipAddress }],
                    timestamp: {
                        gte: new Date(Date.now() - 15 * 60 * 1000), // Last 15 minutes
                    },
                },
            });
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
                });
            }
        }
        catch (error) {
            logger_1.default.error("Handle failed login error:", error);
        }
    }
    async handleSuspiciousActivity(event) {
        try {
            // Log to external security monitoring system
            logger_1.default.warn("SUSPICIOUS ACTIVITY DETECTED:", {
                userId: event.userId,
                details: event.details,
                ipAddress: event.ipAddress,
                timestamp: new Date(),
            });
            // Could integrate with external security services here
        }
        catch (error) {
            logger_1.default.error("Handle suspicious activity error:", error);
        }
    }
    async handlePermissionDenied(event) {
        try {
            // Count recent permission denials for this user
            const recentDenials = await database_1.default.auditLog.count({
                where: {
                    userId: event.userId,
                    action: "PERMISSION_DENIED",
                    timestamp: {
                        gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
                    },
                },
            });
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
                });
            }
        }
        catch (error) {
            logger_1.default.error("Handle permission denied error:", error);
        }
    }
    determineSeverity(action, resource) {
        // Critical actions
        if (action.includes("DELETE") || action.includes("ADMIN_")) {
            return "CRITICAL";
        }
        // High severity actions
        if (action.includes("UPDATE") || action.includes("PAYMENT") || resource === "USER") {
            return "HIGH";
        }
        // Medium severity actions
        if (action.includes("CREATE") || action.includes("LOGIN")) {
            return "MEDIUM";
        }
        // Default to low
        return "LOW";
    }
    startAuditProcessor() {
        // Flush events periodically
        setInterval(async () => {
            await this.flushEventBuffer();
        }, this.FLUSH_INTERVAL);
        // Flush events on process exit
        process.on("SIGINT", async () => {
            await this.flushEventBuffer();
            process.exit(0);
        });
        process.on("SIGTERM", async () => {
            await this.flushEventBuffer();
            process.exit(0);
        });
    }
}
exports.AuditService = AuditService;
// Export singleton instance
exports.auditService = new AuditService();
