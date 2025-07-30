import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { AdminService } from "../services/admin.service"
import { VerificationService } from "../services/verification.service"
import logger from "../utils/logger"

export class AdminController {
  private adminService = new AdminService()
  private verificationService = new VerificationService()

  getDashboard = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const dashboardData = await this.adminService.getDashboardData()

      res.json({
        success: true,
        message: "Dashboard data retrieved successfully",
        data: dashboardData,
      })
    } catch (error) {
      logger.error("Get admin dashboard error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve dashboard data",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  approveDriver = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const adminId = req.user!.id
      const { driverId } = req.params

      await this.adminService.approveDriver(driverId, adminId)

      res.json({
        success: true,
        message: "Driver approved successfully",
      })
    } catch (error) {
      logger.error("Approve driver error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to approve driver",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  suspendUser = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const adminId = req.user!.id
      const { userId } = req.params
      const { reason } = req.body

      await this.adminService.suspendUser(userId, adminId, reason)

      res.json({
        success: true,
        message: "User suspended successfully",
      })
    } catch (error) {
      logger.error("Suspend user error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to suspend user",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getSystemMetrics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { from, to } = req.query
      const dateRange = from && to ? { from: new Date(from as string), to: new Date(to as string) } : undefined

      const metrics = await this.adminService.getSystemMetrics(dateRange)

      res.json({
        success: true,
        message: "System metrics retrieved successfully",
        data: metrics,
      })
    } catch (error) {
      logger.error("Get system metrics error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve system metrics",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getPendingVerifications = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query

      const verifications = await this.verificationService.getPendingVerifications(Number(page), Number(limit))

      res.json({
        success: true,
        message: "Pending verifications retrieved successfully",
        data: verifications,
      })
    } catch (error) {
      logger.error("Get pending verifications error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve pending verifications",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  reviewDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const adminId = req.user!.id
      const { documentId } = req.params
      const { decision, rejectionReason } = req.body

      await this.verificationService.reviewDocument(documentId, adminId, decision, rejectionReason)

      res.json({
        success: true,
        message: "Document reviewed successfully",
      })
    } catch (error) {
      logger.error("Review document error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to review document",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
