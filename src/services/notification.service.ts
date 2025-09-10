import prisma from "../config/database"
import logger from "../utils/logger"
import { EmailService } from "./email.service"
import { NotificationType, PriorityLevel } from "@prisma/client"

export class NotificationService {
  private emailService: EmailService

  constructor() {
    this.emailService = new EmailService()
  }

  /**
   * Sends an email notification to a user.
   * This is typically used as a fallback when real-time notifications are not possible,
   * or for critical notifications that require email delivery.
   * @param userId The ID of the user to notify.
   * @param type The type of notification (e.g., 'BOOKING_CONFIRMED', 'ACCOUNT_ALERT').
   * @param data The notification payload, containing details for the email content.
   */
  public async sendEmailNotification(userId: string, type: NotificationType, data: Record<string, any>): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, lastName: true },
      })

      if (!user || !user.email) {
        logger.warn(`Cannot send email notification: User ${userId} not found or has no email.`)
        return
      }

      let subject: string
      let htmlContent: string

      switch (type) {
        case NotificationType.BOOKING_UPDATE:
          subject = `TripSync Booking #${data.bookingNumber} Update: ${data.status}`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your booking <strong>#${data.bookingNumber}</strong> has been updated to status: <strong>${data.status}</strong>.</p>
            ${data.providerName ? `<p>Your ${data.serviceType} provider is ${data.providerName}.</p>` : ""}
            ${data.eta ? `<p>Estimated arrival time: ${data.eta}.</p>` : ""}
            <p>For more details, please check the app.</p>
          `
          break
        case NotificationType.PAYMENT_UPDATE:
          subject = `TripSync Payment Update`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your payment of ${data.amount} ${data.currency} for ${data.description} has been ${data.status}.</p>
            <p>Transaction Reference: ${data.transactionRef}</p>
          `
          break
        case NotificationType.PROMOTION:
          subject = `TripSync Special Offer: ${data.title}`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>We have a special promotion for you!</p>
            <p>${data.body}</p>
            <p>Valid until: ${data.expiryDate}</p>
          `
          break
        case NotificationType.SYSTEM_ALERT:
          subject = `TripSync System Alert`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Important message from TripSync:</p>
            <p>${data.message}</p>
          `
          break
        case NotificationType.EMERGENCY_ALERT:
          subject = `URGENT: TripSync Emergency Alert`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>An emergency alert has been issued:</p>
            <p>${data.message}</p>
            <p>Location: ${data.location}</p>
            <p>Please stay safe and follow local authorities' instructions.</p>
          `
          break
        case NotificationType.REVIEW_REQUEST:
          subject = `Rate Your Recent TripSync Experience!`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>We hope you enjoyed your recent ${data.serviceType} with TripSync.</p>
            <p>Please take a moment to rate your experience: <a href="${data.reviewLink}">${data.reviewLink}</a></p>
            <p>Your feedback helps us improve!</p>
          `
          break
        case NotificationType.DRIVER_NEARBY:
          subject = `Your TripSync Driver is Nearby!`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your driver for booking #${data.bookingNumber} is now nearby your pickup location.</p>
            <p>Vehicle: ${data.vehicleMake} ${data.vehicleModel} (${data.licensePlate})</p>
            <p>Driver: ${data.driverName}</p>
          `
          break
        case NotificationType.RIDE_REMINDER:
          subject = `Reminder: Your Scheduled TripSync Ride`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Just a friendly reminder about your scheduled ${data.serviceType} for booking #${data.bookingNumber} at ${data.scheduledTime} today.</p>
            <p>Pickup: ${data.pickupLocation}</p>
            <p>Dropoff: ${data.dropoffLocation}</p>
          `
          break
        case NotificationType.DELIVERY_UPDATE:
          subject = `TripSync Delivery Update: Order #${data.orderNumber}`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your delivery for order <strong>#${data.orderNumber}</strong> has been updated to status: <strong>${data.status}</strong>.</p>
            <p>Estimated arrival: ${data.eta}</p>
          `
          break
        case NotificationType.PLACE_RECOMMENDATION:
          subject = `New Place Recommendation from TripSync!`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Based on your preferences, we recommend you check out <strong>${data.placeName}</strong>!</p>
            <p>${data.placeDescription}</p>
            <p>Learn more: <a href="${data.placeLink}">${data.placeLink}</a></p>
          `
          break
        case NotificationType.SAFETY_ALERT:
          subject = `TripSync Safety Alert`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Important safety information from TripSync:</p>
            <p>${data.message}</p>
            <p>Always prioritize your safety. If you need assistance, please contact support.</p>
          `
          break
        case NotificationType.MAINTENANCE:
          subject = `TripSync System Maintenance Notice`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>We will be performing scheduled maintenance on the TripSync system on ${data.date} from ${data.startTime} to ${data.endTime}.</p>
            <p>During this time, some services may be temporarily unavailable. We apologize for any inconvenience.</p>
          `
          break
        case NotificationType.COMMISSION_DUE:
          subject = `TripSync Commission Payment Due`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your commission payment of ${data.amount} ${data.currency} is due on ${data.dueDate}.</p>
            <p>Please ensure your payment method is up to date to avoid service interruption.</p>
          `
          break
        case NotificationType.COMMISSION_PAID:
          subject = `TripSync Commission Payment Received`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>We have successfully received your commission payment of ${data.amount} ${data.currency}.</p>
            <p>Thank you for your prompt payment!</p>
          `
          break
        case NotificationType.PAYOUT_PROCESSED:
          subject = `TripSync Payout Processed`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your payout of ${data.amount} ${data.currency} has been successfully processed and sent to your ${data.payoutMethod} account.</p>
            <p>Reference: ${data.payoutReference}</p>
          `
          break
        case NotificationType.WELCOME:
          subject = `Welcome to TripSync!`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Welcome to TripSync! Your account has been created successfully. Complete your profile to get started.</p>
            <p>We're excited to have you on board!</p>
          `
          break
        default:
          subject = `TripSync Notification: ${type}`
          htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>You have a new notification from TripSync:</p>
            <p>${data.message || JSON.stringify(data)}</p>
            <p>Please check the app for more details.</p>
          `
          break
      }

      await this.emailService.sendEmail(user.email, subject, htmlContent)
      logger.info(`Email notification sent to ${user.email} for type ${type}.`)
    } catch (error) {
      logger.error(`Error sending email notification to user ${userId} for type ${type}:`, error)
      // Depending on criticality, you might want to log to a separate system or retry
    }
  }

  /**
   * Sends an in-app notification (via WebSocket).
   * This method is primarily called by the IntegrationService as part of its logic.
   * @param userId The ID of the user to notify.
   * @param type The type of notification.
   * @param data The notification payload.
   */
  public async sendInAppNotification(userId: string, type: NotificationType, data: Record<string, any>): Promise<void> {
    // This method is now primarily handled by IntegrationService which decides between WebSocket and Email.
    // If direct in-app notification logic is needed here (e.g., saving to DB for later retrieval), it would go here.
    logger.info(`In-app notification for user ${userId}, type ${type} would be handled by WebSocket.`)
    // Example: Save notification to database for user's notification history
    await prisma.notification.create({
      data: {
        userId: userId,
        type: type,
        title: data.title || `New notification of type ${type}`, // Assuming title is part of data
        body: data.body || `New notification of type ${type}`, // Assuming body is part of data
        data: JSON.stringify(data),
        isRead: false,
        priority: data.priority || PriorityLevel.STANDARD, // Assuming priority is part of data
      },
    })
  }

  /**
   * Notifies a customer by creating a notification record and potentially sending an email.
   * This method is used by controllers and services to trigger notifications.
   * @param userId The ID of the user to notify.
   * @param notification The notification details.
   */
  async notifyCustomer(
    userId: string,
    notification: {
      type: NotificationType // Now explicitly NotificationType enum
      title: string
      body: string
      data?: any
      priority?: PriorityLevel // Now explicitly PriorityLevel enum
    },
  ) {
    try {
      // Create notification record
      const notificationRecord = await prisma.notification.create({
        data: {
          userId,
          title: notification.title,
          body: notification.body,
          type: notification.type, // No more 'as any'
          data: JSON.stringify(notification.data || {}),
          priority: notification.priority || PriorityLevel.STANDARD, // No more 'as any'
        },
      })

      // Send email for critical notifications or emergency types
      if (notification.priority === PriorityLevel.CRITICAL || notification.type.includes("EMERGENCY")) {
        // The includes check might need refinement if NotificationType is strictly enum
        // For now, it works because enum values are strings.
        await this.sendEmailNotification(userId, notification.type, {
          title: notification.title,
          body: notification.body,
          ...notification.data,
        })
      }

      return notificationRecord
    } catch (error) {
      logger.error("Notify customer error:", error)
      throw error
    }
  }

  async notifyDriver(
    userId: string,
    notification: {
      type: NotificationType
      title: string
      body: string
      data?: any
      priority?: PriorityLevel
    },
  ) {
    try {
      console.log(`🔔 NOTIFYING DRIVER: ${userId}`)
      console.log(`📋 Notification Type: ${notification.type}`)
      console.log(`📝 Title: ${notification.title}`)
      console.log(`💬 Body: ${notification.body}`)
      console.log(`📊 Data:`, JSON.stringify(notification.data, null, 2))

      // Create notification record in database
      const notificationRecord = await prisma.notification.create({
        data: {
          userId,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          data: JSON.stringify(notification.data || {}),
          priority: notification.priority || PriorityLevel.STANDARD,
        },
      })

      console.log(`✅ Database notification created: ${notificationRecord.id}`)

      // Send real-time notification via WebSocket
      try {
        // Import the WebSocket service from server
        const { io } = await import("../server")
        
        // Use the WebSocket service's notifyUser method
        const notificationSent = await io.notifyUser(userId, "notification", {
          id: notificationRecord.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: notification.data,
          priority: notification.priority || PriorityLevel.STANDARD,
          timestamp: new Date(),
        })

        console.log(`📡 WebSocket notification sent to user_${userId}: ${notificationSent}`)

        // Also emit specific event for booking requests
        if (notification.type === "NEW_BOOKING_REQUEST" && notification.data?.bookingId) {
          await io.notifyUser(userId, "new_booking_request", {
            notificationId: notificationRecord.id,
            bookingId: notification.data.bookingId,
            ...notification.data,
            timestamp: new Date(),
          })
          console.log(`🚗 Booking request event sent to user_${userId}`)
        }
      } catch (socketError) {
        console.error(`❌ WebSocket notification failed for user ${userId}:`, socketError)
      }

      // Send email for critical notifications or emergency types
      if (notification.priority === PriorityLevel.CRITICAL || notification.type.includes("EMERGENCY")) {
        try {
          await this.sendEmailNotification(userId, notification.type, {
            title: notification.title,
            body: notification.body,
            ...notification.data,
          })
          console.log(`📧 Email notification sent to user ${userId}`)
        } catch (emailError) {
          console.error(`❌ Email notification failed for user ${userId}:`, emailError)
        }
      }

      console.log(`🔔 DRIVER NOTIFICATION COMPLETE: ${userId}\n`)
      return notificationRecord
    } catch (error) {
      logger.error("Notify driver error:", error)
      console.error(`❌ DRIVER NOTIFICATION FAILED: ${userId}`, error)
      throw error
    }
  }

  async notifyProvider(
    userId: string,
    notification: {
      type: NotificationType
      title: string
      body: string
      data?: any
      priority?: PriorityLevel
    },
  ) {
    return this.notifyCustomer(userId, notification)
  }

  async sendBulkNotification(
    userIds: string[],
    notification: {
      type: NotificationType
      title: string
      body: string
      data?: any
    },
  ) {
    try {
      const notifications = userIds.map((userId) => ({
        userId,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        data: JSON.stringify(notification.data || {}),
        priority: PriorityLevel.STANDARD,
      }))

      // Create all notifications
      await prisma.notification.createMany({
        data: notifications,
      })

      // Note: Real-time notifications for bulk are handled by WebSocketService if users are online.
      // Email notifications for bulk are not sent by default here, but can be added if needed.
    } catch (error) {
      logger.error("Send bulk notification error:", error)
      throw error
    }
  }

  async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.updateMany({
        where: {
          id: notificationId,
          userId,
        },
        data: {
          isRead: true,
        },
      })

      return notification
    } catch (error) {
      logger.error("Mark notification as read error:", error)
      throw error
    }
  }

  async getUserNotifications(
    userId: string,
    options: {
      page?: number
      limit?: number
      unreadOnly?: boolean
    } = {},
  ) {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = options
      const skip = (page - 1) * limit

      const where: any = { userId }
      if (unreadOnly) {
        where.isRead = false
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.notification.count({ where }),
      ])

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get user notifications error:", error)
      throw error
    }
  }

  async notifyAdmins(notification: {
    type: NotificationType
    title: string
    body: string
    data?: any
    priority?: PriorityLevel
  }) {
    try {
      // Get all admin users
      const admins = await prisma.user.findMany({
        where: {
          role: { in: ["SUPER_ADMIN", "CITY_ADMIN"] },
          isActive: true,
        },
        select: { id: true },
      })

      // Send notification to all admins
      for (const admin of admins) {
        await this.notifyCustomer(admin.id, notification)
      }

      return { notifiedAdmins: admins.length }
    } catch (error) {
      logger.error("Notify admins error:", error)
      throw error
    }
  }
}
