import type { Server } from "socket.io"
import prisma from "../config/database"
import logger from "../utils/logger"
import jwt, { type Secret } from "jsonwebtoken"

const JWT_SECRET: Secret = process.env.JWT_SECRET || "your_super_secret_jwt_key"

export function initializeSocketHandlers(io: Server) {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token

      if (!token) {
        return next(new Error("Authentication error: Token missing"))
      }

      // Verify JWT token
      const decodedToken = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; permissions: string[] }

      // Check if the token is active in the database
      const session = await prisma.userSession.findUnique({
        where: { token: token },
        select: { isActive: true, expiresAt: true },
      })

      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return next(new Error("Authentication error: Invalid or expired token"))
      }

      const user = await prisma.user.findUnique({
        where: { id: decodedToken.userId },
        select: {
          id: true,
          role: true,
          isActive: true,
        },
      })

      if (!user || !user.isActive) {
        return next(new Error("Authentication error: User not found or inactive"))
      }

      socket.data.userId = user.id
      socket.data.userRole = user.role
      next()
    } catch (error) {
      logger.error("Socket authentication error:", error)
      next(new Error("Authentication error: Invalid token"))
    }
  })

  io.on("connection", (socket) => {
    const userId = socket.data.userId
    const userRole = socket.data.userRole

    logger.info(`User ${userId} (${userRole}) connected via Socket.IO`)

    // Join user-specific room
    socket.join(`user_${userId}`)

    // Join role-specific rooms
    if (userRole === "DRIVER") {
      socket.join("drivers")
    } else if (userRole === "USER") {
      socket.join("customers")
    } else if (userRole === "EMERGENCY_RESPONDER") {
      socket.join("emergency_responders")
    }

    // Handle location updates from drivers
    socket.on("location_update", async (data) => {
      try {
        if (!["DRIVER", "EMERGENCY_RESPONDER"].includes(userRole)) return

        const { latitude, longitude, heading, speed } = data

        // Update driver location in database
        if (userRole === "DRIVER") {
          await prisma.driverProfile.updateMany({
            where: { userId },
            data: {
              currentLatitude: latitude,
              currentLongitude: longitude,
              heading,
            },
          })
        }

        // Broadcast location to customers with active bookings
        const activeBookings = await prisma.booking.findMany({
          where: {
            providerId: userId,
            status: {
              in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"],
            },
          },
        })

        activeBookings.forEach((booking) => {
          socket.to(`user_${booking.customerId}`).emit("driver_location_update", {
            bookingId: booking.id,
            latitude,
            longitude,
            heading,
            speed,
            timestamp: new Date(),
          })
        })
      } catch (error) {
        logger.error("Location update error:", error)
      }
    })

    // Handle booking status updates
    socket.on("booking_status_update", async (data) => {
      try {
        const { bookingId, status, message } = data

        // Verify user has access to this booking
        const booking = await prisma.booking.findFirst({
          where: {
            id: bookingId,
            OR: [{ customerId: userId }, { providerId: userId }],
          },
        })

        if (!booking) return

        // Create tracking update
        await prisma.trackingUpdate.create({
          data: {
            bookingId,
            latitude: data.latitude || 0,
            longitude: data.longitude || 0,
            status,
            message,
            timestamp: new Date(),
          },
        })

        // Notify relevant parties
        const targetUserId = booking.customerId === userId ? booking.providerId : booking.customerId

        if (targetUserId) {
          socket.to(`user_${targetUserId}`).emit("booking_update", {
            bookingId,
            status,
            message,
            timestamp: new Date(),
          })
        }
      } catch (error) {
        logger.error("Booking status update error:", error)
      }
    })

    // Handle driver availability updates
    socket.on("availability_update", async (data) => {
      try {
        if (userRole !== "DRIVER") return

        const { isAvailable, isOnline } = data

        await prisma.driverProfile.updateMany({
          where: { userId },
          data: {
            isAvailable,
            isOnline,
          },
        })

        logger.info(`Driver ${userId} availability updated: available=${isAvailable}, online=${isOnline}`)
      } catch (error) {
        logger.error("Availability update error:", error)
      }
    })

    // Handle emergency alerts
    socket.on("emergency_alert", async (data) => {
      try {
        const { latitude, longitude, emergencyType, description } = data

        // Create emergency booking
        const serviceType = await prisma.serviceType.findFirst({
          where: { name: "EMERGENCY" },
        })

        if (!serviceType) {
          logger.error("Emergency service type not found")
          return
        }

        const emergencyBooking = await prisma.booking.create({
          data: {
            bookingNumber: `EMG-${Date.now()}`,
            customerId: userId,
            serviceTypeId: serviceType.id,
            status: "PENDING",
            type: "IMMEDIATE",
            pickupLatitude: latitude,
            pickupLongitude: longitude,
            estimatedPrice: 0,
            currency: "NGN",
            serviceData: {
              emergencyType,
              description,
              emergencyActivatedAt: new Date(),
            },
          },
        })

        // Notify emergency responders
        socket.to("emergency_responders").emit("emergency_alert", {
          bookingId: emergencyBooking.id,
          latitude,
          longitude,
          emergencyType,
          description,
          timestamp: new Date(),
        })

        // Notify emergency contacts
        const emergencyContacts = await prisma.emergencyContact.findMany({
          where: { userId },
        })

        // Send SMS to emergency contacts (implementation would depend on SMS service)
        logger.warn(`Emergency alert from user ${userId}: ${emergencyType}`)
      } catch (error) {
        logger.error("Emergency alert error:", error)
      }
    })

    // Handle chat messages
    socket.on("chat_message", async (data) => {
      try {
        const { bookingId, message, recipientId } = data

        // Verify booking access
        const booking = await prisma.booking.findFirst({
          where: {
            id: bookingId,
            OR: [{ customerId: userId }, { providerId: userId }],
          },
        })

        if (!booking) return

        // Send message to recipient
        socket.to(`user_${recipientId}`).emit("chat_message", {
          bookingId,
          senderId: userId,
          message,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.error("Chat message error:", error)
      }
    })

    // Handle disconnection
    socket.on("disconnect", () => {
      logger.info(`User ${userId} disconnected from Socket.IO`)
    })
  })
}
