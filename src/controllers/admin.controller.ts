import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import prisma from "../config/database"
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

  getUsersByType = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        type,
        page = 1,
        limit = 20,
        search,
        status,
        sortBy = "createdAt",
        sortOrder = "desc"
      } = req.query

      const pageNum = Number(page)
      const limitNum = Number(limit)
      const skip = (pageNum - 1) * limitNum

      // Build where clause
      const where: any = {}

      // Filter by user type/role
      if (type && type !== "all") {
        where.role = type
      }

      // Filter by active status
      if (status) {
        if (status === "active") {
          where.isActive = true
        } else if (status === "inactive") {
          where.isActive = false
        }
      }

      // Search functionality
      if (search) {
        where.OR = [
          { firstName: { contains: search as string, mode: "insensitive" } },
          { lastName: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
          { phone: { contains: search as string, mode: "insensitive" } },
        ]
      }

      // Get total count for pagination
      const total = await prisma.user.count({ where })

      // Get users with related data based on role
      const users = await prisma.user.findMany({
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
          [sortBy as string]: sortOrder
        },
        skip,
        take: limitNum,
      })

      // Get user statistics
      const stats = await this.getUserTypeStats()

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
      })
    } catch (error) {
      logger.error("Get users by type error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve users",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  private async getUserTypeStats() {
    try {
      const [
        totalUsers,
        activeUsers,
        verifiedUsers,
        roleStats
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isVerified: true } }),
        prisma.user.groupBy({
          by: ["role"],
          _count: true,
          where: { isActive: true },
        }),
      ])

      return {
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        byRole: roleStats.reduce((acc, stat) => {
          acc[stat.role] = stat._count
          return acc
        }, {} as Record<string, number>),
      }
    } catch (error) {
      logger.error("Get user type stats error:", error)
      return {
        total: 0,
        active: 0,
        verified: 0,
        byRole: {},
      }
    }
  }
}
