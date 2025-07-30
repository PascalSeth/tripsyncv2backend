import { Server as SocketIOServer, type Socket } from "socket.io"
import type { Server as HTTPServer } from "http"
import jwt from "jsonwebtoken"
import prisma from "../config/database"
import { EmailService } from "./email.service" // Import EmailService
import logger from "../utils/logger"
import type { BookingStatus } from "@prisma/client"

interface AuthenticatedSocket extends Socket {
  userId?: string
  userRole?: string
  isAuthenticated?: boolean
}

interface LocationUpdate {
  latitude: number
  longitude: number
  heading?: number
  speed?: number
  accuracy?: number
  timestamp: Date
}

interface ChatMessage {
  id: string
  bookingId: string
  senderId: string
  receiverId: string
  message: string
  messageType: "TEXT" | "IMAGE" | "LOCATION" | "SYSTEM"
  timestamp: Date
  isRead: boolean
}

interface BookingUpdate {
  bookingId: string
  status: BookingStatus
  location?: LocationUpdate
  estimatedArrival?: Date
  message?: string
}

interface EmergencyAlert {
  id: string
  userId: string
  location: LocationUpdate
  emergencyType: string
  description: string
  timestamp: Date
  isActive: boolean
}

export class WebSocketService {
  private io: SocketIOServer
  private emailService = new EmailService() // Instantiate EmailService
  private connectedUsers = new Map<string, string>() // userId -> socketId
  private userSockets = new Map<string, AuthenticatedSocket>() // socketId -> socket
  private chatMessages: ChatMessage[] = [] // Memory storage for missing model

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    })

    this.setupMiddleware()
    this.setupEventHandlers()
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1]

        if (!token) {
          return next(new Error("Authentication token required"))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          include: {
            customerProfile: true,
            driverProfile: true,
            moverProfile: true,
            emergencyProfile: true,
          },
        })

        if (!user) {
          return next(new Error("User not found"))
        }

        socket.userId = user.id
        socket.userRole = user.role
        socket.isAuthenticated = true

        next()
      } catch (error) {
        logger.error("Socket authentication error:", error)
        next(new Error("Authentication failed"))
      }
    })
  }

  private setupEventHandlers(): void {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      logger.info(`User connected: ${socket.userId} (${socket.id})`)
      console.log(`🔌 NEW CONNECTION: User ${socket.userId} with socket ${socket.id}`)

      // Store connection
      if (socket.userId) {
        this.connectedUsers.set(socket.userId, socket.id)
        this.userSockets.set(socket.id, socket)

        // Join multiple room formats for compatibility
        socket.join(`user:${socket.userId}`)
        socket.join(`user_${socket.userId}`)

        console.log(`🏠 User ${socket.userId} joined rooms: user:${socket.userId}, user_${socket.userId}`)

        // Join role-specific rooms
        if (socket.userRole) {
          socket.join(`role:${socket.userRole}`)
          console.log(`🎭 User ${socket.userId} joined role room: role:${socket.userRole}`)
        }

        // Send connection confirmation
        socket.emit("connection_confirmed", {
          userId: socket.userId,
          socketId: socket.id,
          timestamp: new Date(),
        })

        console.log(`✅ Connection setup complete for user ${socket.userId}`)
      }

      // Location tracking
      socket.on("location:update", (data: LocationUpdate) => {
        this.handleLocationUpdate(socket, data)
      })

      // Real-time booking updates
      socket.on("booking:join", (bookingId: string) => {
        this.handleBookingJoin(socket, bookingId)
      })

      socket.on("booking:leave", (bookingId: string) => {
        this.handleBookingLeave(socket, bookingId)
      })

      socket.on("booking:update", (data: BookingUpdate) => {
        this.handleBookingUpdate(socket, data)
      })

      // Chat functionality
      socket.on("chat:join", (bookingId: string) => {
        this.handleChatJoin(socket, bookingId)
      })

      socket.on("chat:message", (data: Omit<ChatMessage, "id" | "timestamp" | "isRead">) => {
        this.handleChatMessage(socket, data)
      })

      socket.on("chat:typing", (data: { bookingId: string; isTyping: boolean }) => {
        this.handleTypingIndicator(socket, data)
      })

      socket.on("chat:read", (messageId: string) => {
        this.handleMessageRead(socket, messageId)
      })

      // Emergency alerts
      socket.on("emergency:alert", (data: Omit<EmergencyAlert, "id" | "timestamp" | "isActive">) => {
        this.handleEmergencyAlert(socket, data)
      })

      socket.on("emergency:response", (data: { alertId: string; responderId: string; eta?: number }) => {
        this.handleEmergencyResponse(socket, data)
      })

      // Driver/Provider status updates
      socket.on("provider:status", (data: { isOnline: boolean; isAvailable: boolean }) => {
        this.handleProviderStatusUpdate(socket, data)
      })

      // Disconnect handling
      socket.on("disconnect", (reason) => {
        this.handleDisconnect(socket, reason)
      })

      // Error handling
      socket.on("error", (error) => {
        logger.error(`Socket error for user ${socket.userId}:`, error)
      })
    })
  }

  /**
   * Send notification to specific user
   */
  async notifyUser(userId: string, event: string, data: any): Promise<boolean> {
    try {
      console.log(`🔌 WEBSOCKET NOTIFY USER: ${userId}`)
      console.log(`📡 Event: ${event}`)
      console.log(`📊 Data:`, JSON.stringify(data, null, 2))

      const socketId = this.connectedUsers.get(userId)
      console.log(`🔍 Socket ID for user ${userId}: ${socketId || "NOT FOUND"}`)
      console.log(`👥 Total connected users: ${this.connectedUsers.size}`)
      console.log(`🗂️ Connected users:`, Array.from(this.connectedUsers.entries()))

      if (socketId) {
        // Send to specific socket
        this.io.to(socketId).emit(event, data)

        // Also send to user room
        this.io.to(`user:${userId}`).emit(event, data)
        this.io.to(`user_${userId}`).emit(event, data) // Alternative room format

        console.log(`✅ WebSocket notification sent to user ${userId}`)
        return true
      }

      // User not connected via WebSocket, send email as fallback
      console.log(`⚠️ User ${userId} is not online via WebSocket. Attempting to send email notification.`)
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (user?.email) {
        await this.emailService.sendNotificationEmail(
          user.email,
          data.title || "New Update from TripSync",
          data.body || "You have a new update in your app. Please check for details.",
        )
        console.log(`📧 Email fallback sent to user ${userId}`)
        return true // Email sent
      }
      console.warn(`❌ User ${userId} is offline and has no email to send fallback notification.`)
      return false // Neither WebSocket nor email sent
    } catch (error) {
      logger.error("Notify user error:", error)
      console.error(`❌ WEBSOCKET NOTIFY USER FAILED: ${userId}`, error)
      return false
    }
  }

  /**
   * Send notification to multiple users
   */
  async notifyUsers(userIds: string[], event: string, data: any): Promise<number> {
    try {
      let notifiedCount = 0

      for (const userId of userIds) {
        const success = await this.notifyUser(userId, event, data)
        if (success) notifiedCount++
      }

      return notifiedCount
    } catch (error) {
      logger.error("Notify users error:", error)
      return 0
    }
  }

  /**
   * Broadcast to all users with specific role
   */
  async broadcastToRole(role: string, event: string, data: any): Promise<void> {
    try {
      this.io.to(`role:${role}`).emit(event, data)
      logger.info(`Broadcasted ${event} to role: ${role}`)
    } catch (error) {
      logger.error("Broadcast to role error:", error)
    }
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount(): number {
    return this.connectedUsers.size
  }

  /**
   * Get online users by role
   */
  async getOnlineUsersByRole(role: string): Promise<string[]> {
    try {
      const sockets = await this.io.in(`role:${role}`).fetchSockets()
      return sockets.map((socket: any) => socket.userId).filter(Boolean)
    } catch (error) {
      logger.error("Get online users by role error:", error)
      return []
    }
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId)
  }

  private async handleLocationUpdate(socket: AuthenticatedSocket, data: LocationUpdate): Promise<void> {
    try {
      if (!socket.userId) return

      // Update user location in database
      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        include: {
          driverProfile: true,
          moverProfile: true,
          emergencyProfile: true,
        },
      })

      if (!user) return

      // Update location based on user role
      if (user.driverProfile) {
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: {
            currentLatitude: data.latitude,
            currentLongitude: data.longitude,
          },
        })
      }

      if (user.moverProfile) {
        await prisma.moverProfile.update({
          where: { userId: socket.userId },
          data: {
            // Remove non-existent fields
            // currentLatitude: data.latitude,
            // currentLongitude: data.longitude,
          },
        })
      }

      if (user.emergencyProfile) {
        await prisma.emergencyProfile.update({
          where: { userId: socket.userId },
          data: {
            currentLatitude: data.latitude,
            currentLongitude: data.longitude,
          },
        })
      }

      // Broadcast location to relevant parties (active bookings)
      const activeBookings = await prisma.booking.findMany({
        where: {
          OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
          status: { in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"] },
        },
      })

      for (const booking of activeBookings) {
        const otherUserId = booking.customerId === socket.userId ? booking.providerId : booking.customerId
        if (otherUserId) {
          await this.notifyUser(otherUserId, "location:update", {
            bookingId: booking.id,
            userId: socket.userId,
            location: data,
          })
        }
      }
    } catch (error) {
      logger.error("Handle location update error:", error)
    }
  }

  private async handleBookingJoin(socket: AuthenticatedSocket, bookingId: string): Promise<void> {
    try {
      // Verify user has access to this booking
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
        },
      })

      if (booking) {
        socket.join(`booking:${bookingId}`)
        logger.info(`User ${socket.userId} joined booking room: ${bookingId}`)
      }
    } catch (error) {
      logger.error("Handle booking join error:", error)
    }
  }

  private handleBookingLeave(socket: AuthenticatedSocket, bookingId: string): void {
    socket.leave(`booking:${bookingId}`)
    logger.info(`User ${socket.userId} left booking room: ${bookingId}`)
  }

  private async handleBookingUpdate(socket: AuthenticatedSocket, data: BookingUpdate): Promise<void> {
    try {
      // Verify user has permission to update this booking
      const booking = await prisma.booking.findFirst({
        where: {
          id: data.bookingId,
          providerId: socket.userId, // Only providers can send updates
        },
      })

      if (!booking) return

      // Update booking status if provided
      if (data.status) {
        await prisma.booking.update({
          where: { id: data.bookingId },
          data: { status: data.status },
        })
      }

      // Broadcast update to booking room
      this.io.to(`booking:${data.bookingId}`).emit("booking:update", {
        ...data,
        timestamp: new Date(),
      })

      // Send email to customer if they are not online
      if (booking.customerId && !this.isUserOnline(booking.customerId)) {
        const customer = await prisma.user.findUnique({ where: { id: booking.customerId } })
        if (customer?.email) {
          await this.emailService.sendNotificationEmail(
            customer.email,
            "Booking Update",
            data.message || `Your booking status has been updated to ${data.status}`,
          )
        }
      }
    } catch (error) {
      logger.error("Handle booking update error:", error)
    }
  }

  private handleChatJoin(socket: AuthenticatedSocket, bookingId: string): void {
    socket.join(`chat:${bookingId}`)
    logger.info(`User ${socket.userId} joined chat room: ${bookingId}`)
  }

  private async handleChatMessage(
    socket: AuthenticatedSocket,
    data: Omit<ChatMessage, "id" | "timestamp" | "isRead">,
  ): Promise<void> {
    try {
      // Verify user has access to this booking's chat
      const booking = await prisma.booking.findFirst({
        where: {
          id: data.bookingId,
          OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
        },
      })

      if (!booking) return

      const message: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random()}`,
        ...data,
        senderId: socket.userId!,
        timestamp: new Date(),
        isRead: false,
      }

      // Store message in memory (would be database in production)
      this.chatMessages.push(message)

      // Broadcast message to chat room
      this.io.to(`chat:${data.bookingId}`).emit("chat:message", message)

      // Send email to receiver if they're offline
      if (!this.isUserOnline(data.receiverId)) {
        const receiver = await prisma.user.findUnique({ where: { id: data.receiverId } })
        if (receiver?.email) {
          await this.emailService.sendNotificationEmail(
            receiver.email,
            "New Message",
            data.messageType === "TEXT" ? data.message : "You received a new message",
          )
        }
      }
    } catch (error) {
      logger.error("Handle chat message error:", error)
    }
  }

  private handleTypingIndicator(socket: AuthenticatedSocket, data: { bookingId: string; isTyping: boolean }): void {
    socket.to(`chat:${data.bookingId}`).emit("chat:typing", {
      userId: socket.userId,
      isTyping: data.isTyping,
    })
  }

  private handleMessageRead(socket: AuthenticatedSocket, messageId: string): void {
    // Update message read status in memory
    const messageIndex = this.chatMessages.findIndex((msg) => msg.id === messageId)
    if (messageIndex >= 0) {
      this.chatMessages[messageIndex].isRead = true
    }

    // Notify sender that message was read
    const message = this.chatMessages[messageIndex]
    if (message) {
      this.notifyUser(message.senderId, "chat:read", { messageId })
    }
  }

  private async handleEmergencyAlert(
    socket: AuthenticatedSocket,
    data: Omit<EmergencyAlert, "id" | "timestamp" | "isActive">,
  ): Promise<void> {
    try {
      const alert: EmergencyAlert = {
        id: `alert_${Date.now()}_${Math.random()}`,
        ...data,
        userId: socket.userId!,
        timestamp: new Date(),
        isActive: true,
      }

      // Find nearby emergency responders
      const nearbyResponders = await this.findNearbyEmergencyResponders(
        data.location.latitude,
        data.location.longitude,
        10, // 10km radius
      )

      // Broadcast alert to emergency responders
      for (const responder of nearbyResponders) {
        await this.notifyUser(responder.userId, "emergency:alert", alert)
      }

      // Also broadcast to emergency role
      this.broadcastToRole("EMERGENCY", "emergency:alert", alert)

      logger.info(`Emergency alert created: ${alert.id}`)
    } catch (error) {
      logger.error("Handle emergency alert error:", error)
    }
  }

  private async handleEmergencyResponse(
    socket: AuthenticatedSocket,
    data: { alertId: string; responderId: string; eta?: number },
  ): Promise<void> {
    try {
      // Notify alert creator about the response
      this.io.emit("emergency:response", {
        ...data,
        timestamp: new Date(),
      })

      logger.info(`Emergency response received for alert: ${data.alertId}`)
    } catch (error) {
      logger.error("Handle emergency response error:", error)
    }
  }

  private async handleProviderStatusUpdate(
    socket: AuthenticatedSocket,
    data: { isOnline: boolean; isAvailable: boolean },
  ): Promise<void> {
    try {
      if (!socket.userId) return

      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        include: {
          driverProfile: true,
          moverProfile: true,
          emergencyProfile: true,
        },
      })

      if (!user) return

      // Update provider status based on role
      if (user.driverProfile) {
        await prisma.driverProfile.update({
          where: { userId: socket.userId },
          data: {
            isOnline: data.isOnline,
            isAvailable: data.isAvailable,
          },
        })
      }

      if (user.moverProfile) {
        await prisma.moverProfile.update({
          where: { userId: socket.userId },
          data: {
            isOnline: data.isOnline,
            isAvailable: data.isAvailable,
          },
        })
      }

      if (user.emergencyProfile) {
        await prisma.emergencyProfile.updateMany({
          where: { userId: socket.userId },
          data: {
            isOnDuty: data.isOnline,
          },
        })
      }

      // Broadcast status update to admin dashboard
      this.broadcastToRole("ADMIN", "provider:status", {
        userId: socket.userId,
        ...data,
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error("Handle provider status update error:", error)
    }
  }

  private handleDisconnect(socket: AuthenticatedSocket, reason: string): void {
    logger.info(`User disconnected: ${socket.userId} (${socket.id}) - Reason: ${reason}`)

    if (socket.userId) {
      this.connectedUsers.delete(socket.userId)
    }
    this.userSockets.delete(socket.id)
  }

  private async findNearbyEmergencyResponders(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<Array<{ userId: string; distance: number }>> {
    try {
      const responders = await prisma.emergencyProfile.findMany({
        where: {
          isOnDuty: true,
          currentLatitude: { not: null },
          currentLongitude: { not: null },
        },
        include: {
          user: true,
        },
      })

      const nearby = responders
        .map((responder) => {
          if (!responder.currentLatitude || !responder.currentLongitude) return null

          const distance = this.calculateDistance(
            latitude,
            longitude,
            responder.currentLatitude,
            responder.currentLongitude,
          )

          return {
            userId: responder.userId,
            distance,
          }
        })
        .filter((item): item is { userId: string; distance: number } => item !== null && item.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance)

      return nearby
    } catch (error) {
      logger.error("Find nearby emergency responders error:", error)
      return []
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }
}
