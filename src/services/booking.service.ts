import prisma from "../config/database"
import { PaymentService } from "./payment.service"
import { NotificationService } from "./notification.service"
import logger from "../utils/logger"

export class BookingService {
  private paymentService = new PaymentService()
  private notificationService = new NotificationService()

  async createBooking(userId: string, bookingData: any) {
    try {
      // Validate user eligibility
      await this.validateUserEligibility(userId)

      // Create booking based on service type
      const booking = await prisma.booking.create({
        data: {
          ...bookingData,
          customerId: userId,
          bookingNumber: await this.generateBookingNumber(),
          status: "PENDING",
          requestedAt: new Date(),
        },
        include: {
          serviceType: true,
          customer: true,
        },
      })

      // Log booking creation
      await this.logBookingActivity(booking.id, "CREATED", userId)

      return booking
    } catch (error) {
      logger.error("Create booking error:", error)
      throw error
    }
  }

  async processBookingPayment(bookingId: string) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: {
            include: {
              paymentMethods: {
                where: { isDefault: true },
              },
            },
          },
          serviceType: true,
        },
      })

      if (!booking) {
        throw new Error("Booking not found")
      }

      const paymentMethod = booking.customer.paymentMethods[0]
      if (!paymentMethod) {
        throw new Error("No payment method found")
      }

      // Process payment
      const transaction = await this.paymentService.processPayment({
        userId: booking.customerId,
        bookingId: booking.id,
        amount: booking.finalPrice || booking.estimatedPrice || 0,
        paymentMethodId: paymentMethod.id,
        description: `Payment for ${booking.serviceType?.displayName} service`,
      })

      // Update booking payment status
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: transaction.status === "COMPLETED" ? "COMPLETED" : "PENDING",
        },
      })

      return transaction
    } catch (error) {
      logger.error("Process booking payment error:", error)
      throw error
    }
  }

  private async validateUserEligibility(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customerProfile: true,
      },
    })

    if (!user || !user.isActive) {
      throw new Error("User not found or inactive")
    }

    if (!user.isVerified) {
      throw new Error("User account not verified")
    }

    // Check commission status
    if (user.customerProfile && !user.isCommissionCurrent) {
      throw new Error("Account suspended due to outstanding commission payments")
    }

    // Check active bookings limit
    const activeBookings = await prisma.booking.count({
      where: {
        customerId: userId,
        status: {
          in: ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"],
        },
      },
    })

    if (activeBookings >= 3) {
      throw new Error("Maximum active bookings limit reached")
    }
  }

  private async generateBookingNumber(): Promise<string> {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `TRP${timestamp}${random}`
  }

  private async logBookingActivity(bookingId: string, action: string, userId: string) {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource: "booking",
        resourceId: bookingId,
        timestamp: new Date(),
      },
    })
  }
}
