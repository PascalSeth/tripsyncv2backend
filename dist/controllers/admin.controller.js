"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
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
                    message: "Dashboard data retrieved successfully",
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
    }
}
exports.AdminController = AdminController;
