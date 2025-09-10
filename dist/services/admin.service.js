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
            const [totalBookings, activeDrivers, totalRevenue, avgRating, bookingGrowth, driverGrowth, revenueGrowth, ratingGrowth, bookingTrends, serviceTypes, dailyBookings, driverPerformance, recentActivity] = await Promise.all([
                database_1.default.booking.count(),
                database_1.default.driverProfile.count({
                    where: { isOnline: true, isAvailable: true },
                }),
                database_1.default.booking.aggregate({
                    where: { status: "COMPLETED" },
                    _sum: { finalPrice: true },
                }),
                this.getAverageRating(),
                this.calculateBookingGrowth(),
                this.calculateDriverGrowth(),
                this.calculateRevenueGrowth(),
                this.calculateRatingGrowth(),
                this.getBookingTrends(),
                this.getServiceTypeBreakdown(),
                this.getDailyBookings(),
                this.getDriverPerformance(),
                this.getRecentActivityFormatted(),
            ]);
            return {
                totalBookings,
                activeDrivers,
                totalRevenue: totalRevenue._sum.finalPrice || 0,
                avgRating,
                bookingGrowth,
                driverGrowth,
                revenueGrowth,
                ratingGrowth,
                bookingTrends,
                serviceTypes,
                dailyBookings,
                driverPerformance,
                recentActivity,
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
            const [bookingStats, userStats, revenueStats, userGrowth, revenueByService, hourlyActivity, conversionMetrics] = await Promise.all([
                // Booking statistics by status
                database_1.default.booking.groupBy({
                    by: ["status"],
                    where,
                    _count: true,
                }),
                // User statistics by role
                database_1.default.user.groupBy({
                    by: ["role"],
                    where,
                    _count: true,
                }),
                // Revenue statistics
                database_1.default.transaction.aggregate({
                    where: { ...where, status: "COMPLETED" },
                    _sum: { amount: true, platformCommission: true },
                }),
                // User growth trends (monthly)
                this.getUserGrowthTrends(dateRange),
                // Revenue by service type
                this.getRevenueByServiceType(dateRange),
                // Hourly activity patterns
                this.getHourlyActivityPatterns(dateRange),
                // Conversion and performance metrics
                this.getConversionMetrics(dateRange),
            ]);
            return {
                bookingStats,
                userStats,
                revenueStats,
                userGrowth,
                revenueByService,
                hourlyActivity,
                conversionMetrics,
            };
        }
        catch (error) {
            logger_1.default.error("Get system metrics error:", error);
            throw error;
        }
    }
    async getUserGrowthTrends(dateRange) {
        try {
            const months = [];
            const startDate = dateRange?.from || new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000); // 6 months ago
            for (let i = 0; i < 6; i++) {
                const date = new Date(startDate);
                date.setMonth(startDate.getMonth() + i);
                const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                const [users, drivers] = await Promise.all([
                    database_1.default.user.count({
                        where: {
                            createdAt: { gte: startOfMonth, lte: endOfMonth },
                        },
                    }),
                    database_1.default.driverProfile.count({
                        where: {
                            user: {
                                createdAt: { gte: startOfMonth, lte: endOfMonth },
                            },
                        },
                    }),
                ]);
                months.push({
                    month: startOfMonth.toLocaleDateString('en-US', { month: 'short' }),
                    users,
                    drivers,
                });
            }
            return months;
        }
        catch (error) {
            logger_1.default.error("Get user growth trends error:", error);
            return [];
        }
    }
    async getRevenueByServiceType(dateRange) {
        try {
            const where = { status: 'COMPLETED' };
            if (dateRange) {
                where.createdAt = {
                    gte: dateRange.from,
                    lte: dateRange.to,
                };
            }
            const serviceRevenue = await database_1.default.booking.groupBy({
                by: ['serviceTypeId'],
                where,
                _count: true,
                _sum: { finalPrice: true },
            });
            const result = await Promise.all(serviceRevenue.map(async (item) => {
                const serviceType = await database_1.default.serviceType.findUnique({
                    where: { id: item.serviceTypeId },
                    select: { displayName: true },
                });
                return {
                    service: serviceType?.displayName || 'Unknown',
                    revenue: item._sum.finalPrice || 0,
                    bookings: item._count,
                };
            }));
            return result;
        }
        catch (error) {
            logger_1.default.error("Get revenue by service type error:", error);
            return [];
        }
    }
    async getHourlyActivityPatterns(dateRange) {
        try {
            const hourlyData = [];
            for (let hour = 0; hour < 24; hour++) {
                const where = {};
                if (dateRange) {
                    where.createdAt = {
                        gte: dateRange.from,
                        lte: dateRange.to,
                    };
                }
                // Add hour filter
                const startHour = new Date();
                startHour.setHours(hour, 0, 0, 0);
                const endHour = new Date();
                endHour.setHours(hour + 1, 0, 0, 0);
                if (where.createdAt) {
                    where.createdAt.gte = new Date(Math.max(where.createdAt.gte.getTime(), startHour.getTime()));
                    where.createdAt.lte = new Date(Math.min(where.createdAt.lte?.getTime() || endHour.getTime(), endHour.getTime()));
                }
                else {
                    where.createdAt = { gte: startHour, lte: endHour };
                }
                const [rides, deliveries] = await Promise.all([
                    database_1.default.booking.count({
                        where: {
                            ...where,
                            serviceType: { name: { in: ['RIDE', 'TAXI'] } },
                        },
                    }),
                    database_1.default.booking.count({
                        where: {
                            ...where,
                            serviceType: { name: { in: ['STORE_DELIVERY', 'FOOD_DELIVERY', 'PACKAGE_DELIVERY'] } },
                        },
                    }),
                ]);
                hourlyData.push({
                    hour,
                    rides,
                    deliveries,
                });
            }
            return hourlyData;
        }
        catch (error) {
            logger_1.default.error("Get hourly activity patterns error:", error);
            return [];
        }
    }
    async getConversionMetrics(dateRange) {
        try {
            const where = {};
            if (dateRange) {
                where.createdAt = {
                    gte: dateRange.from,
                    lte: dateRange.to,
                };
            }
            const [totalBookings, completedBookings, avgRating, driverStats] = await Promise.all([
                database_1.default.booking.count({ where }),
                database_1.default.booking.count({ where: { ...where, status: 'COMPLETED' } }),
                database_1.default.review.aggregate({
                    where,
                    _avg: { rating: true },
                }),
                database_1.default.driverProfile.aggregate({
                    _avg: { rating: true },
                    _count: true,
                }),
            ]);
            // Conversion Rate: (completed bookings / total bookings) * 100
            const conversionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
            // Average Trip Duration (simplified - using estimated duration)
            const avgDurationResult = await database_1.default.booking.aggregate({
                where: { ...where, status: 'COMPLETED' },
                _avg: { estimatedDuration: true },
            });
            const avgTripDuration = avgDurationResult._avg.estimatedDuration || 0;
            // Customer Satisfaction: Average rating from reviews
            const customerSatisfaction = avgRating._avg.rating || 0;
            // Driver Utilization: Percentage of drivers who are active (simplified)
            const activeDrivers = await database_1.default.driverProfile.count({
                where: { isOnline: true, isAvailable: true },
            });
            const driverUtilization = driverStats._count > 0 ? (activeDrivers / driverStats._count) * 100 : 0;
            return {
                conversionRate,
                avgTripDuration,
                customerSatisfaction,
                driverUtilization,
            };
        }
        catch (error) {
            logger_1.default.error("Get conversion metrics error:", error);
            return {
                conversionRate: 0,
                avgTripDuration: 0,
                customerSatisfaction: 0,
                driverUtilization: 0,
            };
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
    async getAverageRating() {
        try {
            const result = await database_1.default.review.aggregate({
                _avg: { rating: true },
            });
            return result._avg.rating || 0;
        }
        catch (error) {
            logger_1.default.error("Get average rating error:", error);
            return 0;
        }
    }
    async calculateBookingGrowth() {
        try {
            const now = new Date();
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            const [currentBookings, lastMonthBookings] = await Promise.all([
                database_1.default.booking.count({
                    where: { createdAt: { gte: currentMonth } },
                }),
                database_1.default.booking.count({
                    where: {
                        createdAt: { gte: lastMonth, lt: currentMonth },
                    },
                }),
            ]);
            if (lastMonthBookings === 0)
                return 0;
            return ((currentBookings - lastMonthBookings) / lastMonthBookings) * 100;
        }
        catch (error) {
            logger_1.default.error("Calculate booking growth error:", error);
            return 0;
        }
    }
    async calculateDriverGrowth() {
        try {
            const now = new Date();
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const [currentDrivers, lastMonthDrivers] = await Promise.all([
                database_1.default.driverProfile.count({
                    where: {
                        user: {
                            createdAt: { gte: currentMonth }
                        }
                    },
                }),
                database_1.default.driverProfile.count({
                    where: {
                        user: {
                            createdAt: { gte: lastMonth, lt: currentMonth },
                        },
                    },
                }),
            ]);
            if (lastMonthDrivers === 0)
                return 0;
            return ((currentDrivers - lastMonthDrivers) / lastMonthDrivers) * 100;
        }
        catch (error) {
            logger_1.default.error("Calculate driver growth error:", error);
            return 0;
        }
    }
    async calculateRevenueGrowth() {
        try {
            const now = new Date();
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const [currentRevenue, lastMonthRevenue] = await Promise.all([
                database_1.default.booking.aggregate({
                    where: {
                        status: "COMPLETED",
                        createdAt: { gte: currentMonth },
                    },
                    _sum: { finalPrice: true },
                }),
                database_1.default.booking.aggregate({
                    where: {
                        status: "COMPLETED",
                        createdAt: { gte: lastMonth, lt: currentMonth },
                    },
                    _sum: { finalPrice: true },
                }),
            ]);
            const current = currentRevenue._sum.finalPrice || 0;
            const last = lastMonthRevenue._sum.finalPrice || 0;
            if (last === 0)
                return 0;
            return ((current - last) / last) * 100;
        }
        catch (error) {
            logger_1.default.error("Calculate revenue growth error:", error);
            return 0;
        }
    }
    async calculateRatingGrowth() {
        try {
            const now = new Date();
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const [currentRating, lastMonthRating] = await Promise.all([
                database_1.default.review.aggregate({
                    where: { createdAt: { gte: currentMonth } },
                    _avg: { rating: true },
                }),
                database_1.default.review.aggregate({
                    where: {
                        createdAt: { gte: lastMonth, lt: currentMonth },
                    },
                    _avg: { rating: true },
                }),
            ]);
            const current = currentRating._avg.rating || 0;
            const last = lastMonthRating._avg.rating || 0;
            if (last === 0)
                return 0;
            return ((current - last) / last) * 100;
        }
        catch (error) {
            logger_1.default.error("Calculate rating growth error:", error);
            return 0;
        }
    }
    async getBookingTrends() {
        try {
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                const [bookings, revenue] = await Promise.all([
                    database_1.default.booking.count({
                        where: {
                            createdAt: { gte: startOfMonth, lte: endOfMonth },
                        },
                    }),
                    database_1.default.booking.aggregate({
                        where: {
                            status: "COMPLETED",
                            createdAt: { gte: startOfMonth, lte: endOfMonth },
                        },
                        _sum: { finalPrice: true },
                    }),
                ]);
                months.push({
                    month: startOfMonth.toLocaleDateString('en-US', { month: 'short' }),
                    bookings,
                    revenue: revenue._sum.finalPrice || 0,
                });
            }
            return months;
        }
        catch (error) {
            logger_1.default.error("Get booking trends error:", error);
            return [];
        }
    }
    async getServiceTypeBreakdown() {
        try {
            const serviceTypes = await database_1.default.booking.groupBy({
                by: ['serviceTypeId'],
                where: { status: 'COMPLETED' },
                _count: true,
                _sum: { finalPrice: true },
            });
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
            const result = await Promise.all(serviceTypes.map(async (type, index) => {
                const serviceType = await database_1.default.serviceType.findUnique({
                    where: { id: type.serviceTypeId },
                    select: { displayName: true },
                });
                return {
                    name: serviceType?.displayName || 'Unknown',
                    value: type._sum.finalPrice || 0,
                    color: colors[index % colors.length],
                };
            }));
            return result;
        }
        catch (error) {
            logger_1.default.error("Get service type breakdown error:", error);
            return [];
        }
    }
    async getDailyBookings() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const hourlyBookings = [];
            for (let hour = 0; hour < 24; hour++) {
                const startHour = new Date(today);
                startHour.setHours(hour, 0, 0, 0);
                const endHour = new Date(today);
                endHour.setHours(hour + 1, 0, 0, 0);
                const count = await database_1.default.booking.count({
                    where: {
                        createdAt: { gte: startHour, lt: endHour },
                    },
                });
                hourlyBookings.push({
                    time: `${hour.toString().padStart(2, '0')}:00`,
                    bookings: count,
                });
            }
            return hourlyBookings;
        }
        catch (error) {
            logger_1.default.error("Get daily bookings error:", error);
            return [];
        }
    }
    async getDriverPerformance() {
        try {
            const ratingRanges = [
                { min: 4.5, max: 5.0, label: '4.5-5.0' },
                { min: 4.0, max: 4.5, label: '4.0-4.5' },
                { min: 3.5, max: 4.0, label: '3.5-4.0' },
                { min: 3.0, max: 3.5, label: '3.0-3.5' },
                { min: 0, max: 3.0, label: '0-3.0' },
            ];
            const result = await Promise.all(ratingRanges.map(async (range) => {
                const count = await database_1.default.driverProfile.count({
                    where: {
                        rating: {
                            gte: range.min,
                            lt: range.max,
                        },
                    },
                });
                return {
                    rating: range.label,
                    count,
                };
            }));
            return result;
        }
        catch (error) {
            logger_1.default.error("Get driver performance error:", error);
            return [];
        }
    }
    async getRecentActivityFormatted() {
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
                type: "booking",
                message: `New booking from ${booking.customer.firstName} ${booking.customer.lastName}`,
                time: this.getTimeAgo(booking.createdAt),
                status: booking.status,
            }));
        }
        catch (error) {
            logger_1.default.error("Get recent activity formatted error:", error);
            return [];
        }
    }
    getTimeAgo(date) {
        const now = new Date();
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        if (diffInMinutes < 1)
            return 'Just now';
        if (diffInMinutes < 60)
            return `${diffInMinutes} minutes ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24)
            return `${diffInHours} hours ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays} days ago`;
    }
}
exports.AdminService = AdminService;
