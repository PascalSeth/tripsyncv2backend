"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const database_1 = __importDefault(require("../config/database"));
const notification_service_1 = require("./notification.service");
const analytics_service_1 = require("./analytics.service");
const logger_1 = __importDefault(require("../utils/logger"));
class AdminService {
    constructor() {
        this.notificationService = new notification_service_1.NotificationService();
        this.analyticsService = new analytics_service_1.AnalyticsService();
    }
    async getDashboardData() {
        try {
            const [totalUsers, totalBookings, totalRevenue, activeDrivers, recentActivity, pendingApprovals] = await Promise.all([
                database_1.default.user.count({ where: { isActive: true } }),
                database_1.default.booking.count(),
                database_1.default.transaction.aggregate({
                    where: { status: "COMPLETED" },
                    _sum: { amount: true },
                }),
                database_1.default.driverProfile.count({
                    where: { isOnline: true, isAvailable: true },
                }),
                this.getRecentActivity(),
                this.getPendingApprovals(),
            ]);
            return {
                overview: {
                    totalUsers,
                    totalBookings,
                    totalRevenue: totalRevenue._sum.amount || 0,
                    activeDrivers,
                },
                recentActivity,
                pendingApprovals,
                systemHealth: {
                    status: "healthy",
                    uptime: 99.9,
                    responseTime: 150,
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get dashboard data error:", error);
            throw error;
        }
    }
    async approveDriver(driverId, adminId) {
        try {
            await database_1.default.driverProfile.update({
                where: { userId: driverId },
                data: {
                    isVerified: true,
                    verificationStatus: "APPROVED",
                },
            });
            await this.notificationService.notifyCustomer(driverId, {
                type: "DRIVER_APPROVED",
                title: "Driver Application Approved",
                body: "Congratulations! Your driver application has been approved. You can now start accepting rides.",
                priority: "STANDARD",
            });
            logger_1.default.info(`Driver ${driverId} approved by admin ${adminId}`);
        }
        catch (error) {
            logger_1.default.error("Approve driver error:", error);
            throw error;
        }
    }
    async suspendUser(userId, adminId, reason) {
        try {
            await database_1.default.user.update({
                where: { id: userId },
                data: {
                    isActive: false,
                },
            });
            await this.notificationService.notifyCustomer(userId, {
                type: "ACCOUNT_SUSPENDED",
                title: "Account Suspended",
                body: `Your account has been suspended. Reason: ${reason}`,
                priority: "CRITICAL",
            });
            logger_1.default.info(`User ${userId} suspended by admin ${adminId}. Reason: ${reason}`);
        }
        catch (error) {
            logger_1.default.error("Suspend user error:", error);
            throw error;
        }
    }
    async getSystemMetrics(dateRange) {
        try {
            const where = {};
            if (dateRange) {
                where.createdAt = {
                    gte: dateRange.from,
                    lte: dateRange.to,
                };
            }
            const [bookingStats, userStats, revenueStats] = await Promise.all([
                database_1.default.booking.groupBy({
                    by: ["status"],
                    where,
                    _count: true,
                }),
                database_1.default.user.groupBy({
                    by: ["role"],
                    where,
                    _count: true,
                }),
                database_1.default.transaction.aggregate({
                    where: { ...where, status: "COMPLETED" },
                    _sum: { amount: true, platformCommission: true },
                }),
            ]);
            return {
                bookingStats,
                userStats,
                revenueStats,
            };
        }
        catch (error) {
            logger_1.default.error("Get system metrics error:", error);
            throw error;
        }
    }
    async getRecentActivity() {
        try {
            const recentBookings = await database_1.default.booking.findMany({
                take: 10,
                orderBy: { createdAt: "desc" },
                include: {
                    customer: {
                        select: { firstName: true, lastName: true },
                    },
                    serviceType: {
                        select: { displayName: true },
                    },
                },
            });
            return recentBookings.map((booking) => ({
                id: booking.id,
                type: "booking",
                description: `${booking.customer.firstName} ${booking.customer.lastName} booked ${booking.serviceType?.displayName}`,
                timestamp: booking.createdAt,
                status: booking.status,
            }));
        }
        catch (error) {
            logger_1.default.error("Get recent activity error:", error);
            return [];
        }
    }
    async getPendingApprovals() {
        try {
            const pendingDrivers = await database_1.default.driverProfile.findMany({
                where: { verificationStatus: "PENDING" },
                include: {
                    user: {
                        select: { firstName: true, lastName: true, email: true },
                    },
                },
                take: 10,
            });
            return pendingDrivers.map((driver) => ({
                id: driver.id,
                type: "driver_approval",
                name: `${driver.user.firstName} ${driver.user.lastName}`,
                email: driver.user.email,
                // submittedAt: driver.updatedAt, // Use updatedAt instead of createdAt
            }));
        }
        catch (error) {
            logger_1.default.error("Get pending approvals error:", error);
            return [];
        }
    }
}
exports.AdminService = AdminService;
