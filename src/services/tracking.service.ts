import prisma from "../config/database"
import logger from "../utils/logger"

export class TrackingService {
  async startTracking(bookingId: string, providerId: string) {
    try {
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values, will be updated with actual location
          longitude: 0,
          status: "TRACKING_STARTED",
          message: "Tracking started",
          timestamp: new Date(),
        },
      })

      logger.info(`Tracking started for booking ${bookingId} by provider ${providerId}`)
    } catch (error) {
      logger.error("Start tracking error:", error)
      throw error
    }
  }

  async addTrackingUpdate(
    bookingId: string,
    updateData: {
      latitude?: number
      longitude?: number
      heading?: number
      speed?: number
      status?: string
      message?: string
    },
  ) {
    try {
      const trackingUpdate = await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: updateData.latitude || 0,
          longitude: updateData.longitude || 0,
          status: updateData.status || "LOCATION_UPDATE",
          message: updateData.message || "Location updated",
          timestamp: new Date(),
        },
      })

      return trackingUpdate
    } catch (error) {
      logger.error("Add tracking update error:", error)
      throw error
    }
  }

  async getTrackingHistory(bookingId: string) {
    try {
      const trackingUpdates = await prisma.trackingUpdate.findMany({
        where: { bookingId },
        orderBy: { timestamp: "desc" },
      })

      return trackingUpdates
    } catch (error) {
      logger.error("Get tracking history error:", error)
      throw error
    }
  }
}
