import prisma from "../config/database"
import { NotificationService } from "./notification.service"
import { AnalyticsService } from "./analytics.service"
import logger from "../utils/logger"

interface AdminDashboardData {
  overview: {
    totalUsers: number
    totalBookings: number
    totalRevenue: number
    activeDrivers: number
  }
  recentActivity: any[]
  pendingApprovals: any[]
  systemHealth: {
    status: "healthy" | "warning" | "critical"
    uptime: number
    responseTime: number
  }
}

export class AdminService {
  private notificationService = new NotificationService()
  private analyticsService = new AnalyticsService()

  async getDashboardData(): Promise<AdminDashboardData> {
    try {
      const [totalUsers, totalBookings, totalRevenue, activeDrivers, recentActivity, pendingApprovals] =
        await Promise.all([
          prisma.user.count({ where: { isActive: true } }),
          prisma.booking.count(),
          prisma.transaction.aggregate({
            where: { status: "COMPLETED" },
            _sum: { amount: true },
          }),
          prisma.driverProfile.count({
            where: { isOnline: true, isAvailable: true },
          }),
          this.getRecentActivity(),
          this.getPendingApprovals(),
        ])

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
      }
    } catch (error) {
      logger.error("Get dashboard data error:", error)
      throw error
    }
  }

  async approveDriver(driverId: string, adminId: string): Promise<void> {
    try {
      await prisma.driverProfile.update({
        where: { userId: driverId },
        data: {
          isVerified: true,
          verificationStatus: "APPROVED",
        },
      })

      await this.notificationService.notifyCustomer(driverId, {
        type: "DRIVER_APPROVED",
        title: "Driver Application Approved",
        body: "Congratulations! Your driver application has been approved. You can now start accepting rides.",
        priority: "STANDARD",
      })

      logger.info(`Driver ${driverId} approved by admin ${adminId}`)
    } catch (error) {
      logger.error("Approve driver error:", error)
      throw error
    }
  }

  async suspendUser(userId: string, adminId: string, reason: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
        },
      })

      await this.notificationService.notifyCustomer(userId, {
        type: "ACCOUNT_SUSPENDED",
        title: "Account Suspended",
        body: `Your account has been suspended. Reason: ${reason}`,
        priority: "CRITICAL",
      })

      logger.info(`User ${userId} suspended by admin ${adminId}. Reason: ${reason}`)
    } catch (error) {
      logger.error("Suspend user error:", error)
      throw error
    }
  }

  async getSystemMetrics(dateRange?: { from: Date; to: Date }): Promise<any> {
    try {
      const where: any = {}
      if (dateRange) {
        where.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to,
        }
      }

      const [bookingStats, userStats, revenueStats] = await Promise.all([
        prisma.booking.groupBy({
          by: ["status"],
          where,
          _count: true,
        }),
        prisma.user.groupBy({
          by: ["role"],
          where,
          _count: true,
        }),
        prisma.transaction.aggregate({
          where: { ...where, status: "COMPLETED" },
          _sum: { amount: true, platformCommission: true },
        }),
      ])

      return {
        bookingStats,
        userStats,
        revenueStats,
      }
    } catch (error) {
      logger.error("Get system metrics error:", error)
      throw error
    }
  }

  private async getRecentActivity(): Promise<any[]> {
    try {
      const recentBookings = await prisma.booking.findMany({
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
      })

      return recentBookings.map((booking) => ({
        id: booking.id,
        type: "booking",
        description: `${booking.customer.firstName} ${booking.customer.lastName} booked ${booking.serviceType?.displayName}`,
        timestamp: booking.createdAt,
        status: booking.status,
      }))
    } catch (error) {
      logger.error("Get recent activity error:", error)
      return []
    }
  }

  private async getPendingApprovals(): Promise<any[]> {
    try {
      const pendingDrivers = await prisma.driverProfile.findMany({
        where: { verificationStatus: "PENDING" },
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        take: 10,
      })

      return pendingDrivers.map((driver) => ({
        id: driver.id,
        type: "driver_approval",
        name: `${driver.user.firstName} ${driver.user.lastName}`,
        email: driver.user.email,
        // submittedAt: driver.updatedAt, // Use updatedAt instead of createdAt
      }))
    } catch (error) {
      logger.error("Get pending approvals error:", error)
      return []
    }
  }
}
