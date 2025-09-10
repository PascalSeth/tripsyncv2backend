"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const database_1 = __importDefault(require("../config/database"));
const admin_service_1 = require("../services/admin.service");
const verification_service_1 = require("../services/verification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class AdminController {
    constructor() {
        this.adminService = new admin_service_1.AdminService();
        this.verificationService = new verification_service_1.VerificationService();
        this.getDashboard = async (req, res) => {
            try {
                const dashboardData = await this.adminService.getDashboardData();
                res.json({
                    success: true,
                    data: dashboardData,
                });
            }
            catch (error) {
                logger_1.default.error("Get admin dashboard error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve dashboard data",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.approveDriver = async (req, res) => {
            try {
                const adminId = req.user.id;
                const { driverId } = req.params;
                await this.adminService.approveDriver(driverId, adminId);
                res.json({
                    success: true,
                    message: "Driver approved successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Approve driver error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to approve driver",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.suspendUser = async (req, res) => {
            try {
                const adminId = req.user.id;
                const { userId } = req.params;
                const { reason } = req.body;
                await this.adminService.suspendUser(userId, adminId, reason);
                res.json({
                    success: true,
                    message: "User suspended successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Suspend user error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to suspend user",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getSystemMetrics = async (req, res) => {
            try {
                const { from, to } = req.query;
                const dateRange = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
                const metrics = await this.adminService.getSystemMetrics(dateRange);
                res.json({
                    success: true,
                    message: "System metrics retrieved successfully",
                    data: metrics,
                });
            }
            catch (error) {
                logger_1.default.error("Get system metrics error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve system metrics",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getPendingVerifications = async (req, res) => {
            try {
                const { page = 1, limit = 20 } = req.query;
                const verifications = await this.verificationService.getPendingVerifications(Number(page), Number(limit));
                res.json({
                    success: true,
                    message: "Pending verifications retrieved successfully",
                    data: verifications,
                });
            }
            catch (error) {
                logger_1.default.error("Get pending verifications error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve pending verifications",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.reviewDocument = async (req, res) => {
            try {
                const adminId = req.user.id;
                const { documentId } = req.params;
                const { decision, rejectionReason } = req.body;
                await this.verificationService.reviewDocument(documentId, adminId, decision, rejectionReason);
                res.json({
                    success: true,
                    message: "Document reviewed successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Review document error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to review document",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getUsersByType = async (req, res) => {
            try {
                const { type, page = 1, limit = 20, search, status, sortBy = "createdAt", sortOrder = "desc" } = req.query;
                const pageNum = Number(page);
                const limitNum = Number(limit);
                const skip = (pageNum - 1) * limitNum;
                // Build where clause
                const where = {};
                // Filter by user type/role
                if (type && type !== "all") {
                    where.role = type;
                }
                // Filter by active status
                if (status) {
                    if (status === "active") {
                        where.isActive = true;
                    }
                    else if (status === "inactive") {
                        where.isActive = false;
                    }
                }
                // Search functionality
                if (search) {
                    where.OR = [
                        { firstName: { contains: search, mode: "insensitive" } },
                        { lastName: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                        { phone: { contains: search, mode: "insensitive" } },
                    ];
                }
                // Get total count for pagination
                const total = await database_1.default.user.count({ where });
                // Get users with related data based on role
                const users = await database_1.default.user.findMany({
                    where,
                    select: {
                        id: true,
                        email: true,
                        phone: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                        isActive: true,
                        isVerified: true,
                        avatar: true,
                        createdAt: true,
                        updatedAt: true,
                        lastLoginAt: true,
                        // Include role-specific data
                        customerProfile: type === "USER" || type === "all" ? {
                            select: {
                                loyaltyPoints: true,
                                totalSpent: true,
                                totalRides: true,
                                averageRating: true,
                                subscriptionTier: true,
                            }
                        } : false,
                        driverProfile: type === "DRIVER" || type === "all" ? {
                            select: {
                                rating: true,
                                totalRides: true,
                                totalEarnings: true,
                                isAvailable: true,
                                isOnline: true,
                                vehicleId: true,
                                licenseNumber: true,
                                verificationStatus: true,
                            }
                        } : false,
                        taxiDriverProfile: type === "TAXI_DRIVER" || type === "all" ? {
                            select: {
                                rating: true,
                                totalRides: true,
                                totalEarnings: true,
                                isAvailable: true,
                                isOnline: true,
                                vehicleId: true,
                                taxiLicenseNumber: true,
                                verificationStatus: true,
                            }
                        } : false,
                        deliveryProfile: type === "DISPATCHER" || type === "all" ? {
                            select: {
                                rating: true,
                                totalDeliveries: true,
                                totalEarnings: true,
                                isAvailable: true,
                                isOnline: true,
                                vehicleId: true,
                                verificationStatus: true,
                            }
                        } : false,
                        storeOwnerProfile: type === "STORE_OWNER" || type === "all" ? {
                            select: {
                                businessLicense: true,
                                verificationStatus: true,
                            }
                        } : false,
                        placeOwnerProfile: type === "PLACE_OWNER" || type === "all" ? {
                            select: {
                                businessLicense: true,
                                verificationStatus: true,
                                subscriptionTier: true,
                            }
                        } : false,
                        businessProfile: type === "STORE_OWNER" || type === "PLACE_OWNER" || type === "all" ? {
                            select: {
                                businessId: true,
                                canManageOrders: true,
                                canManageMenu: true,
                            }
                        } : false,
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip,
                    take: limitNum,
                });
                // Get user statistics
                const stats = await this.getUserTypeStats();
                res.json({
                    success: true,
                    message: "Users retrieved successfully",
                    data: {
                        users,
                        pagination: {
                            page: pageNum,
                            limit: limitNum,
                            total,
                            totalPages: Math.ceil(total / limitNum),
                        },
                        stats,
                        filters: {
                            type: type || "all",
                            search: search || null,
                            status: status || null,
                        }
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Get users by type error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve users",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
    async getUserTypeStats() {
        try {
            const [totalUsers, activeUsers, verifiedUsers, roleStats] = await Promise.all([
                database_1.default.user.count(),
                database_1.default.user.count({ where: { isActive: true } }),
                database_1.default.user.count({ where: { isVerified: true } }),
                database_1.default.user.groupBy({
                    by: ["role"],
                    _count: true,
                    where: { isActive: true },
                }),
            ]);
            return {
                total: totalUsers,
                active: activeUsers,
                verified: verifiedUsers,
                byRole: roleStats.reduce((acc, stat) => {
                    acc[stat.role] = stat._count;
                    return acc;
                }, {}),
            };
        }
        catch (error) {
            logger_1.default.error("Get user type stats error:", error);
            return {
                total: 0,
                active: 0,
                verified: 0,
                byRole: {},
            };
        }
    }
}
exports.AdminController = AdminController;
