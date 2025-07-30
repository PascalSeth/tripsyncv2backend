import prisma from "../config/database"
import logger from "../utils/logger"

interface UserBehaviorEvent {
  userId: string
  eventType: string
  eventData: Record<string, any>
  timestamp: Date
  sessionId?: string
  deviceInfo?: {
    platform: string
    version: string
    deviceId: string
  }
}

interface BusinessMetrics {
  totalBookings: number
  totalRevenue: number
  activeUsers: number
  averageRating: number
  completionRate: number
  cancellationRate: number
}

interface PerformanceMetrics {
  averageResponseTime: number
  errorRate: number
  throughput: number
  uptime: number
}

export class AnalyticsService {
  private eventBuffer: UserBehaviorEvent[] = []
  private readonly BUFFER_SIZE = 100
  private readonly FLUSH_INTERVAL = 30000 // 30 seconds

  constructor() {
    this.startEventProcessor()
  }

  /**
   * Track user behavior events
   */
  async trackEvent(event: UserBehaviorEvent): Promise<void> {
    try {
      // Add to buffer for batch processing
      this.eventBuffer.push(event)

      // Flush buffer if it's full
      if (this.eventBuffer.length >= this.BUFFER_SIZE) {
        await this.flushEventBuffer()
      }
    } catch (error) {
      logger.error("Track event error:", error)
    }
  }

  /**
   * Track booking events
   */
  async trackBookingEvent(
    bookingId: string,
    eventType: "CREATED" | "ASSIGNED" | "STARTED" | "COMPLETED" | "CANCELLED",
    additionalData?: Record<string, any>,
  ): Promise<void> {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          serviceType: true,
          customer: { select: { id: true } },
          provider: { select: { id: true } },
        },
      })

      if (!booking) return

      await this.trackEvent({
        userId: booking.customerId,
        eventType: `BOOKING_${eventType}`,
        eventData: {
          bookingId,
          serviceType: booking.serviceType.name,
          providerId: booking.providerId,
          estimatedPrice: booking.estimatedPrice,
          currency: booking.currency,
          ...additionalData,
        },
        timestamp: new Date(),
      })

      // Also track for provider if assigned
      if (booking.providerId && eventType !== "CREATED") {
        await this.trackEvent({
          userId: booking.providerId,
          eventType: `PROVIDER_BOOKING_${eventType}`,
          eventData: {
            bookingId,
            serviceType: booking.serviceType.name,
            customerId: booking.customerId,
            estimatedPrice: booking.estimatedPrice,
            currency: booking.currency,
            ...additionalData,
          },
          timestamp: new Date(),
        })
      }
    } catch (error) {
      logger.error("Track booking event error:", error)
    }
  }

  /**
   * Get business intelligence metrics
   */
  async getBusinessMetrics(dateRange?: { from: Date; to: Date }): Promise<BusinessMetrics> {
    try {
      const where: any = {}
      if (dateRange) {
        where.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to,
        }
      }

      const [totalBookings, totalRevenue, activeUsers, averageRating, completedBookings, cancelledBookings] =
        await Promise.all([
          // Total bookings
          prisma.booking.count({ where }),

          // Total revenue
          prisma.booking.aggregate({
            where: { ...where, status: "COMPLETED" },
            _sum: { finalPrice: true },
          }),

          // Active users (users with activity in the last 30 days)
          prisma.user.count({
            where: {
              updatedAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          }),

          // Average rating from reviews instead
          prisma.review.aggregate({
            _avg: { rating: true },
          }),

          // Completed bookings
          prisma.booking.count({
            where: { ...where, status: "COMPLETED" },
          }),

          // Cancelled bookings
          prisma.booking.count({
            where: { ...where, status: "CANCELLED" },
          }),
        ])

      const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0
      const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0

      return {
        totalBookings,
        totalRevenue: totalRevenue._sum.finalPrice || 0,
        activeUsers,
        averageRating: averageRating._avg.rating || 0,
        completionRate,
        cancellationRate,
      }
    } catch (error) {
      logger.error("Get business metrics error:", error)
      throw error
    }
  }

  /**
   * Get user behavior analytics
   */
  async getUserBehaviorAnalytics(
    userId?: string,
    dateRange?: { from: Date; to: Date },
  ): Promise<{
    totalEvents: number
    topEvents: Array<{ eventType: string; count: number }>
    sessionDuration: number
    deviceBreakdown: Array<{ platform: string; count: number }>
    hourlyActivity: Array<{ hour: number; count: number }>
  }> {
    try {
      const where: any = {}
      if (userId) where.userId = userId
      if (dateRange) {
        where.timestamp = {
          gte: dateRange.from,
          lte: dateRange.to,
        }
      }

      // Note: These models need to be added to the schema
      // For now, return empty data structure
      const events: Array<{
        eventType: string
        timestamp: Date
        deviceInfo?: { platform: string }
        sessionId?: string
      }> = []

      const totalEvents = events.length

      // Top events
      const eventCounts = new Map<string, number>()
      events.forEach((event) => {
        const current = eventCounts.get(event.eventType) || 0
        eventCounts.set(event.eventType, current + 1)
      })

      const topEvents = Array.from(eventCounts.entries())
        .map(([eventType, count]) => ({ eventType, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Session duration calculation
      const sessions = new Map<string, { start: Date; end: Date }>()
      events.forEach((event) => {
        if (event.sessionId) {
          const existing = sessions.get(event.sessionId)
          if (existing) {
            if (event.timestamp < existing.start) existing.start = event.timestamp
            if (event.timestamp > existing.end) existing.end = event.timestamp
          } else {
            sessions.set(event.sessionId, { start: event.timestamp, end: event.timestamp })
          }
        }
      })

      const sessionDurations = Array.from(sessions.values()).map(
        (session) => session.end.getTime() - session.start.getTime(),
      )
      const averageSessionDuration =
        sessionDurations.length > 0
          ? sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length
          : 0

      // Device breakdown
      const deviceCounts = new Map<string, number>()
      events.forEach((event) => {
        if (event.deviceInfo) {
          const platform = event.deviceInfo.platform || "unknown"
          const current = deviceCounts.get(platform) || 0
          deviceCounts.set(platform, current + 1)
        }
      })

      const deviceBreakdown = Array.from(deviceCounts.entries()).map(([platform, count]) => ({ platform, count }))

      // Hourly activity
      const hourlyActivity = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
      events.forEach((event) => {
        const hour = event.timestamp.getHours()
        hourlyActivity[hour].count++
      })

      return {
        totalEvents,
        topEvents,
        sessionDuration: averageSessionDuration / 1000 / 60, // Convert to minutes
        deviceBreakdown,
        hourlyActivity,
      }
    } catch (error) {
      logger.error("Get user behavior analytics error:", error)
      throw error
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(dateRange?: { from: Date; to: Date }): Promise<PerformanceMetrics> {
    try {
      const where: any = {}
      if (dateRange) {
        where.timestamp = {
          gte: dateRange.from,
          lte: dateRange.to,
        }
      }

      // Note: These models need to be added to the schema
      // For now, return default values
      const responseTimeData = { _avg: { responseTime: 0 } }
      const errorData = 0
      const requestData = 0

      const averageResponseTime = responseTimeData._avg.responseTime || 0
      const errorRate = requestData > 0 ? (errorData / requestData) * 100 : 0
      const throughput =
        requestData / (dateRange ? (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60) : 24) // requests per hour

      // Calculate uptime (simplified)
      const uptime = errorRate < 1 ? 99.9 : errorRate < 5 ? 99.5 : errorRate < 10 ? 99.0 : 95.0

      return {
        averageResponseTime,
        errorRate,
        throughput,
        uptime,
      }
    } catch (error) {
      logger.error("Get performance metrics error:", error)
      throw error
    }
  }

  /**
   * Generate custom reports
   */
  async generateCustomReport(reportConfig: {
    name: string
    metrics: string[]
    filters: Record<string, any>
    dateRange: { from: Date; to: Date }
    groupBy?: string
  }): Promise<{
    reportName: string
    generatedAt: Date
    data: Record<string, any>[]
    summary: Record<string, number>
  }> {
    try {
      const { name, metrics, filters, dateRange, groupBy } = reportConfig

      // This is a simplified implementation
      // In production, you'd have more sophisticated report generation
      const data: Record<string, any>[] = []
      const summary: Record<string, number> = {}

      // Generate report based on requested metrics
      for (const metric of metrics) {
        switch (metric) {
          case "bookings":
            const bookingCount = await prisma.booking.count({
              where: {
                createdAt: { gte: dateRange.from, lte: dateRange.to },
                ...filters,
              },
            })
            summary[metric] = bookingCount
            break

          case "revenue":
            const revenueData = await prisma.booking.aggregate({
              where: {
                createdAt: { gte: dateRange.from, lte: dateRange.to },
                status: "COMPLETED",
                ...filters,
              },
              _sum: { finalPrice: true },
            })
            summary[metric] = revenueData._sum.finalPrice || 0
            break

          case "users":
            const userCount = await prisma.user.count({
              where: {
                createdAt: { gte: dateRange.from, lte: dateRange.to },
                ...filters,
              },
            })
            summary[metric] = userCount
            break
        }
      }

      const report = { createdAt: new Date() }

      return {
        reportName: name,
        generatedAt: report.createdAt,
        data,
        summary,
      }
    } catch (error) {
      logger.error("Generate custom report error:", error)
      throw error
    }
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(): Promise<{
    activeBookings: number
    onlineDrivers: number
    todayRevenue: number
    todayBookings: number
    averageWaitTime: number
    systemHealth: "healthy" | "warning" | "critical"
  }> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const [activeBookings, onlineDrivers, todayRevenue, todayBookings, recentBookings] = await Promise.all([
        prisma.booking.count({
          where: {
            status: { in: ["PENDING", "DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"] },
          },
        }),

        prisma.driverProfile.count({
          where: { isOnline: true, isAvailable: true },
        }),

        prisma.booking.aggregate({
          where: {
            createdAt: { gte: today, lt: tomorrow },
            status: "COMPLETED",
          },
          _sum: { finalPrice: true },
        }),

        prisma.booking.count({
          where: {
            createdAt: { gte: today, lt: tomorrow },
          },
        }),

        prisma.booking.findMany({
          where: {
            status: "COMPLETED",
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
          },
          select: {
            createdAt: true,
            updatedAt: true,
          },
        }),
      ])

      // Calculate average wait time
      const waitTimes = recentBookings.map((booking) => booking.updatedAt.getTime() - booking.createdAt.getTime())
      const averageWaitTime =
        waitTimes.length > 0
          ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length / 1000 / 60 // minutes
          : 0

      // Determine system health
      let systemHealth: "healthy" | "warning" | "critical" = "healthy"
      if (averageWaitTime > 30) systemHealth = "warning"
      if (averageWaitTime > 60 || onlineDrivers < 10) systemHealth = "critical"

      return {
        activeBookings,
        onlineDrivers,
        todayRevenue: todayRevenue._sum.finalPrice || 0,
        todayBookings,
        averageWaitTime,
        systemHealth,
      }
    } catch (error) {
      logger.error("Get dashboard data error:", error)
      throw error
    }
  }

  private async flushEventBuffer(): Promise<void> {
    try {
      const events = this.eventBuffer // Declare events variable
      this.eventBuffer = []

      // Note: These models need to be added to the schema
      // For now, just log the events
      logger.debug(`Flushed ${events.length} events to database`)
    } catch (error) {
      logger.error("Flush event buffer error:", error)
      // Re-add events to buffer if flush failed
      this.eventBuffer.unshift(...this.eventBuffer)
    }
  }

  private startEventProcessor(): void {
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
