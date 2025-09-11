import prisma from "../config/database"
import { LocationService } from "./location.service"
import { NotificationService } from "./notification.service"
import { PaymentService } from "./payment.service"
import logger from "../utils/logger"

export class DriverService {
  private locationService = new LocationService()
  private notificationService = new NotificationService()
  private paymentService = new PaymentService()

  async acceptBooking(driverId: string, bookingId: string) {
    try {
      console.log(`🎯 DRIVER ACCEPTING BOOKING: ${driverId} -> ${bookingId}`)

      // Get driver profile
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId: driverId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
            },
          },
          vehicle: true,
        },
      })

      if (!driverProfile || !driverProfile.isVerified || !driverProfile.isAvailable) {
        throw new Error("Driver not available or not verified")
      }

      // Get booking with customer details
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          serviceType: true,
        },
      })

      if (!booking || booking.status !== "PENDING") {
        throw new Error("Booking not available for acceptance")
      }

      // Check if driver is within reasonable distance (for immediate bookings)
      if (booking.type === "IMMEDIATE" && driverProfile.currentLatitude && driverProfile.currentLongitude) {
        const distance = this.locationService.calculateDistance(
          driverProfile.currentLatitude,
          driverProfile.currentLongitude,
          booking.pickupLatitude!,
          booking.pickupLongitude!,
        )

        if (distance > 15000) {
          throw new Error("Driver too far from pickup location")
        }
      }

      // Update booking with driver assignment
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          providerId: driverId,
          status: "DRIVER_ASSIGNED",
          acceptedAt: new Date(),
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
            },
          },
          serviceType: true,
        },
      })

      // Update driver availability
      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          isAvailable: false,
        },
      })

      // Mark all driver notifications for this booking as expired except the accepted one
      await prisma.driverNotification.updateMany({
        where: {
          bookingId,
          driverId: { not: driverId },
          status: "SENT",
        },
        data: {
          status: "EXPIRED",
        },
      })

      // Mark the accepted driver's notification as read
      await prisma.driverNotification.updateMany({
        where: {
          bookingId,
          driverId,
          status: "SENT",
        },
        data: {
          status: "READ",
        },
      })

      // Calculate ETA
      const eta = await this.calculateETA(
        driverProfile.currentLatitude!,
        driverProfile.currentLongitude!,
        booking.pickupLatitude!,
        booking.pickupLongitude!,
      )

      console.log(`✅ Booking ${bookingId} accepted by driver ${driverId}, ETA: ${eta} minutes`)

      // Notify customer with driver details
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "BOOKING_ACCEPTED",
        title: "Driver Found!",
        body: `${driverProfile.user.firstName} is on the way. ETA: ${eta} minutes`,
        data: {
          bookingId: booking.id,
          driver: {
            id: driverProfile.user.id,
            name: `${driverProfile.user.firstName} ${driverProfile.user.lastName}`,
            phone: driverProfile.user.phone,
            avatar: driverProfile.user.avatar,
            rating: driverProfile.rating,
          },
          vehicle: driverProfile.vehicle
            ? {
                make: driverProfile.vehicle.make,
                model: driverProfile.vehicle.model,
                color: driverProfile.vehicle.color,
                licensePlate: driverProfile.vehicle.licensePlate,
              }
            : null,
          eta,
          status: "DRIVER_ASSIGNED",
        },
        priority: "URGENT",
      })

      // Send real-time update via WebSocket
      try {
        const { io } = await import("../server")

        // Notify customer
        await io.notifyUser(booking.customerId, "booking_update", {
          bookingId: booking.id,
          status: "DRIVER_ASSIGNED",
          driver: {
            id: driverProfile.user.id,
            name: `${driverProfile.user.firstName} ${driverProfile.user.lastName}`,
            phone: driverProfile.user.phone,
            avatar: driverProfile.user.avatar,
            rating: driverProfile.rating,
          },
          vehicle: driverProfile.vehicle,
          eta,
          timestamp: new Date(),
        })

        // Notify driver
        await io.notifyUser(driverId, "booking_accepted", {
          bookingId: booking.id,
          customer: {
            name: `${booking.customer?.firstName} ${booking.customer?.lastName}`,
            phone: booking.customer?.phone,
          },
          pickup: {
            latitude: booking.pickupLatitude,
            longitude: booking.pickupLongitude,
          },
          dropoff: booking.dropoffLatitude
            ? {
                latitude: booking.dropoffLatitude,
                longitude: booking.dropoffLongitude,
              }
            : null,
          estimatedEarning: booking.providerEarning,
          timestamp: new Date(),
        })

        console.log(`📡 Real-time updates sent to customer and driver`)
      } catch (socketError) {
        console.error(`❌ WebSocket notification failed:`, socketError)
      }

      // Start tracking
      await this.startBookingTracking(bookingId, driverId)

      console.log(`🎯 BOOKING ACCEPTANCE COMPLETE: ${bookingId}`)
      return updatedBooking
    } catch (error) {
      logger.error("Accept booking error:", error)
      console.error(`❌ BOOKING ACCEPTANCE FAILED: ${driverId} -> ${bookingId}`, error)
      throw error
    }
  }

  async rejectBooking(driverId: string, bookingId: string, reason?: string) {
    try {
      // Log rejection for analytics
      await prisma.bookingRejection.create({
        data: {
          bookingId,
          driverId,
          reason: reason || "No reason provided",
          rejectedAt: new Date(),
        },
      })

      // Find next available driver
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      })

      if (booking) {
        await this.findAndNotifyNextDriver(booking)
      }

      return { success: true }
    } catch (error) {
      logger.error("Reject booking error:", error)
      throw error
    }
  }

  async arriveAtPickup(driverId: string, bookingId: string) {
    try {
      // First, let's log what we're looking for
      console.log(`🔍 ArriveAtPickup: Looking for booking ${bookingId} for driver ${driverId}`)

      let booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          providerId: driverId,
          status: "DRIVER_ASSIGNED",
        },
        include: { customer: true },
      })

      // If not found with DRIVER_ASSIGNED, let's check what the actual status is
      if (!booking) {
        console.log(`⚠️ Booking ${bookingId} not found with status DRIVER_ASSIGNED, checking all statuses...`)

        const bookingWithAnyStatus = await prisma.booking.findFirst({
          where: {
            id: bookingId,
            providerId: driverId,
          },
          include: { customer: true },
        })

        if (bookingWithAnyStatus) {
          console.log(`📊 Found booking ${bookingId} with status: ${bookingWithAnyStatus.status}`)

          // Allow arriveAtPickup for bookings that are in valid "en route" states
          const validStatuses = ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE"]
          const alreadyArrivedStatuses = ["DRIVER_ARRIVED"]

          if (validStatuses.includes(bookingWithAnyStatus.status)) {
            console.log(`✅ Allowing arriveAtPickup for booking with status: ${bookingWithAnyStatus.status}`)
            booking = bookingWithAnyStatus
          } else if (alreadyArrivedStatuses.includes(bookingWithAnyStatus.status)) {
            console.log(`ℹ️ Driver has already arrived at pickup for booking ${bookingId} (status: ${bookingWithAnyStatus.status})`)
            // Return the existing booking without updating status
            return bookingWithAnyStatus
          } else {
            throw new Error(`Booking found but has invalid status: ${bookingWithAnyStatus.status}. Expected one of: ${validStatuses.join(", ")}`)
          }
        } else {
          console.log(`❌ Booking ${bookingId} not found for driver ${driverId}`)
          throw new Error("Booking not found or invalid status")
        }
      }

      console.log(`✅ Found booking ${bookingId} with status: ${booking.status}`)

      // Update booking status
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "DRIVER_ARRIVED",
        },
      })

      // Notify customer via WebSocket
      const { io } = await import("../server")
      await io.notifyUser(booking.customerId, "booking_update", {
        bookingId: booking.id,
        status: "DRIVER_ARRIVED",
        message: "Your driver has arrived at the pickup location.",
        timestamp: new Date(),
      })
      // Notify driver (confirmation that they've marked arrival)
      await io.notifyUser(driverId, "driver_status_update", {
        bookingId: booking.id,
        status: "DRIVER_ARRIVED",
        message: "You have marked arrival at pickup location.",
        nextAction: "START_TRIP",
        timestamp: new Date(),
      })
      // Notify driver (optional, but good for confirmation)
      await io.notifyUser(driverId, "driver_booking_status_update", {
        bookingId: booking.id,
        status: "DRIVER_ARRIVED",
        message: "You have arrived at the pickup location.",
        timestamp: new Date(),
      })

      // Add tracking update
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values since they're required
          longitude: 0,
          status: "DRIVER_ARRIVED",
          message: "Driver has arrived at pickup location",
          timestamp: new Date(),
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "DRIVER_ARRIVED",
        title: "Driver Arrived",
        body: "Your driver has arrived at the pickup location",
        data: { bookingId },
        priority: "STANDARD",
      })

      return updatedBooking
    } catch (error) {
      logger.error("Arrive at pickup error:", error)
      throw error
    }
  }

  async startTrip(driverId: string, bookingId: string) {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          providerId: driverId,
          status: { in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED"] },
        },
        include: { customer: true },
      })

      if (!booking) {
        throw new Error("Booking not found or invalid status")
      }

      // Update booking status
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      })

      // Notify customer via WebSocket
      const { io } = await import("../server")
      await io.notifyUser(booking.customerId, "booking_update", {
        bookingId: booking.id,
        status: "IN_PROGRESS",
        message: "Your trip has started.",
        timestamp: new Date(),
      })
      // Notify driver (confirmation that trip has started)
      await io.notifyUser(driverId, "driver_status_update", {
        bookingId: booking.id,
        status: "TRIP_STARTED",
        message: "Trip has started successfully.",
        nextAction: "COMPLETE_TRIP",
        timestamp: new Date(),
      })
      // Notify driver (optional)
      await io.notifyUser(driverId, "driver_booking_status_update", {
        bookingId: booking.id,
        status: "TRIP_STARTED",
        message: "Trip has started.",
        timestamp: new Date(),
      })

      // Add tracking update
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values since they're required
          longitude: 0,
          status: "TRIP_STARTED",
          message: "Trip has started",
          timestamp: new Date(),
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "TRIP_STARTED",
        title: "Trip Started",
        body: "Your trip has started",
        data: { bookingId },
        priority: "STANDARD",
      })

      return updatedBooking
    } catch (error) {
      logger.error("Start trip error:", error)
      throw error
    }
  }

  async completeTrip(
    driverId: string,
    bookingId: string,
    completionData: {
      actualDistance?: number
      actualDuration?: number
      finalPrice?: number
      endLatitude?: number
      endLongitude?: number
    },
  ) {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          providerId: driverId,
          status: "IN_PROGRESS",
        },
        include: {
          customer: true,
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          serviceType: true,
        },
      })

      if (!booking) {
        throw new Error("Booking not found or invalid status")
      }

      // Calculate final pricing if not provided
      let finalPrice = completionData.finalPrice
      if (!finalPrice) {
        finalPrice = await this.calculateFinalPrice(booking, completionData.actualDistance)
      }

      const commission = finalPrice * (booking.serviceType.commissionRate || 0.18)
      const providerEarning = finalPrice - commission

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          actualDistance: completionData.actualDistance,
          actualDuration: completionData.actualDuration,
          finalPrice,
          platformCommission: commission,
          providerEarning,
        },
      })

      // Update driver availability
      const driverProfile = await prisma.driverProfile.updateMany({
        where: { userId: driverId },
        data: {
          isAvailable: true,
          totalRides: { increment: 1 },
          totalEarnings: { increment: providerEarning },
          monthlyEarnings: { increment: providerEarning },
          monthlyCommissionDue: { increment: commission },
        },
      })

      const updatedDriverProfile = await prisma.driverProfile.findFirst({
        where: { userId: driverId },
      })

      // Notify customer via WebSocket
      const { io } = await import("../server")
      await io.notifyUser(booking.customerId, "booking_update", {
        bookingId: booking.id,
        status: "COMPLETED",
        message: `Your trip has been completed. Total: GH₵${finalPrice}`,
        finalPrice,
        distance: completionData.actualDistance,
        duration: completionData.actualDuration,
        totalEarnings: updatedDriverProfile?.totalEarnings, // Pass updated earnings
        totalRides: updatedDriverProfile?.totalRides, // Pass updated rides
        rating: updatedDriverProfile?.rating, // Pass updated rating
        timestamp: new Date(),
      })
      // Notify driver (trip completion confirmation with earnings)
      await io.notifyUser(driverId, "driver_status_update", {
        bookingId: booking.id,
        status: "TRIP_COMPLETED",
        message: `Trip completed! You earned GH₵${finalPrice}`,
        earnings: {
          tripEarning: providerEarning,
          totalEarnings: updatedDriverProfile?.totalEarnings,
          totalRides: updatedDriverProfile?.totalRides,
        },
        nextAction: "GO_ONLINE",
        timestamp: new Date(),
      })
      // Notify driver (optional)
      await io.notifyUser(driverId, "driver_booking_status_update", {
        bookingId: booking.id,
        status: "TRIP_COMPLETED",
        message: "Trip completed successfully.",
        finalPrice,
        totalEarnings: updatedDriverProfile?.totalEarnings,
        totalRides: updatedDriverProfile?.totalRides,
        rating: updatedDriverProfile?.rating,
        timestamp: new Date(),
      })

      // Create earning record
      const driverProfileRecord = await prisma.driverProfile.findFirst({
        where: { userId: driverId },
      })

      if (driverProfileRecord) {
        await prisma.driverEarning.create({
          data: {
            driverProfileId: driverProfileRecord.id,
            bookingId,
            amount: providerEarning,
            commission,
            netEarning: providerEarning,
            date: new Date(),
            weekStarting: this.getWeekStart(new Date()),
            monthYear: new Date().toISOString().slice(0, 7),
          },
        })
      }

      // Add tracking update
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: completionData.endLatitude || 0,
          longitude: completionData.endLongitude || 0,
          status: "TRIP_COMPLETED",
          message: "Trip completed successfully",
          timestamp: new Date(),
        },
      })

      // Process payment
      await this.paymentService.processPayment({
        userId: booking.customerId,
        bookingId,
        amount: finalPrice,
        paymentMethodId: "default", // This should come from booking data
        description: "Trip payment",
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "TRIP_COMPLETED",
        title: "Trip Completed",
        body: `Your trip has been completed. Total: GH₵${finalPrice}`,
        data: {
          bookingId,
          finalPrice,
          distance: completionData.actualDistance,
          duration: completionData.actualDuration,
        },
        priority: "STANDARD",
      })

      // Send review request notification for driver rating
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "REVIEW_REQUEST",
        title: "Rate Your Driver",
        body: `How was your experience with your driver? Please rate your driver.`,
        data: {
          bookingId,
          driverId: booking.providerId,
          reviewType: "SERVICE_PROVIDER",
          promptType: "DRIVER_RATING",
        },
        priority: "STANDARD",
      })

      return updatedBooking
    } catch (error) {
      logger.error("Complete trip error:", error)
      throw error
    }
  }

  async getDriverBookings(
    driverId: string,
    filters: {
      status?: string
      page: number
      limit: number
      dateFrom?: string
      dateTo?: string
    },
  ) {
    try {
      const { status, page, limit, dateFrom, dateTo } = filters
      const skip = (page - 1) * limit

      const where: any = { providerId: driverId }
      if (status) where.status = status
      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = new Date(dateFrom)
        if (dateTo) where.createdAt.lte = new Date(dateTo)
      }

      const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          include: {
            customer: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
              },
            },
            serviceType: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.booking.count({ where }),
      ])

      return {
        bookings,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get driver bookings error:", error)
      throw error
    }
  }

  async getDriverEarnings(
    driverId: string,
    filters: {
      period: string
      startDate?: string
      endDate?: string
    },
  ) {
    try {
      const driverProfile = await prisma.driverProfile.findFirst({
        where: { userId: driverId },
      })

      if (!driverProfile) {
        throw new Error("Driver profile not found")
      }

      let startDate: Date
      let endDate: Date = new Date()

      // Calculate date range based on period
      switch (filters.period) {
        case "today":
          startDate = new Date()
          startDate.setHours(0, 0, 0, 0)
          break
        case "week":
          startDate = this.getWeekStart(new Date())
          break
        case "month":
          startDate = new Date()
          startDate.setDate(1)
          startDate.setHours(0, 0, 0, 0)
          break
        case "custom":
          startDate = filters.startDate ? new Date(filters.startDate) : new Date()
          endDate = filters.endDate ? new Date(filters.endDate) : new Date()
          break
        default:
          startDate = this.getWeekStart(new Date())
      }

      // Get earnings data
      const earnings = await prisma.driverEarning.findMany({
        where: {
          driverProfileId: driverProfile.id,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: "desc" },
      })

      // Calculate totals
      const totalEarnings = earnings.reduce((sum, earning) => sum + earning.amount, 0)
      const totalCommission = earnings.reduce((sum, earning) => sum + earning.commission, 0)
      const netEarnings = earnings.reduce((sum, earning) => sum + earning.netEarning, 0)
      const totalTrips = earnings.length

      return {
        period: filters.period,
        startDate,
        endDate,
        summary: {
          totalEarnings,
          totalCommission,
          netEarnings,
          totalTrips,
          averagePerTrip: totalTrips > 0 ? totalEarnings / totalTrips : 0,
        },
        earnings,
      }
    } catch (error) {
      logger.error("Get driver earnings error:", error)
      throw error
    }
  }

  async getDriverAnalytics(driverId: string) {
    try {
      const driverProfile = await prisma.driverProfile.findFirst({
        where: { userId: driverId },
      })

      if (!driverProfile) {
        throw new Error("Driver profile not found")
      }

      // Get current month data
      const currentMonth = new Date()
      currentMonth.setDate(1)
      currentMonth.setHours(0, 0, 0, 0)

      const [monthlyStats, weeklyStats, recentBookings] = await Promise.all([
        // Monthly stats
        prisma.driverEarning.aggregate({
          where: {
            driverProfileId: driverProfile.id,
            date: { gte: currentMonth },
          },
          _sum: {
            amount: true,
            commission: true,
            netEarning: true,
          },
          _count: true,
        }),

        // Weekly stats
        prisma.driverEarning.aggregate({
          where: {
            driverProfileId: driverProfile.id,
            date: { gte: this.getWeekStart(new Date()) },
          },
          _sum: {
            amount: true,
            commission: true,
            netEarning: true,
          },
          _count: true,
        }),

        // Recent bookings
        prisma.booking.findMany({
          where: {
            providerId: driverId,
            status: "COMPLETED",
          },
          orderBy: { completedAt: "desc" },
          take: 10,
          include: {
            customer: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            serviceType: true,
          },
        }),
      ])

      return {
        profile: {
          rating: driverProfile.rating,
          totalRides: driverProfile.totalRides,
          totalEarnings: driverProfile.totalEarnings,
          isVerified: driverProfile.isVerified,
          joinedDate: new Date(), // Use current date as fallback
        },
        monthly: {
          earnings: monthlyStats._sum.amount || 0,
          commission: monthlyStats._sum.commission || 0,
          netEarnings: monthlyStats._sum.netEarning || 0,
          trips: monthlyStats._count,
        },
        weekly: {
          earnings: weeklyStats._sum.amount || 0,
          commission: weeklyStats._sum.commission || 0,
          netEarnings: weeklyStats._sum.netEarning || 0,
          trips: weeklyStats._count,
        },
        recentBookings,
      }
    } catch (error) {
      logger.error("Get driver analytics error:", error)
      throw error
    }
  }

  async addVehicle(driverProfileId: string, vehicleData: any) {
    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          ...vehicleData,
          isActive: true,
          isVerified: false,
        },
      })

      // Link vehicle to driver
      await prisma.driverProfile.update({
        where: { id: driverProfileId },
        data: { vehicleId: vehicle.id },
      })

      return vehicle
    } catch (error) {
      logger.error("Add vehicle error:", error)
      throw error
    }
  }

  private async calculateETA(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<number> {
    try {
      const distance = this.locationService.calculateDistance(fromLat, fromLng, toLat, toLng)
      // Assume average speed of 30 km/h in city traffic
      const timeInHours = distance / 30000 // distance in meters, speed in m/h
      return Math.ceil(timeInHours * 60) // return minutes
    } catch (error) {
      logger.error("Calculate ETA error:", error)
      return 15 // default 15 minutes
    }
  }

  private async calculateFinalPrice(booking: any, actualDistance?: number): Promise<number> {
    try {
      const serviceType = booking.serviceType
      let finalPrice = serviceType.basePrice || 0

      if (actualDistance && serviceType.pricePerKm) {
        finalPrice += (actualDistance / 1000) * serviceType.pricePerKm
      }

      // Apply surge pricing if applicable
      if (booking.surgePricing && booking.surgePricing > 1) {
        finalPrice *= booking.surgePricing
      }

      return Math.round(finalPrice)
    } catch (error) {
      logger.error("Calculate final price error:", error)
      return booking.estimatedPrice || 0
    }
  }

  private async startBookingTracking(bookingId: string, driverId: string) {
    try {
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values since they're required
          longitude: 0,
          status: "DRIVER_ASSIGNED",
          message: "Driver assigned and tracking started",
          timestamp: new Date(),
        },
      })
    } catch (error) {
      logger.error("Start booking tracking error:", error)
    }
  }

  private async findAndNotifyNextDriver(booking: any) {
    try {
      // Implementation for finding next available driver
      // This would use the driver matching service
      logger.info(`Finding next driver for booking ${booking.id}`)
    } catch (error) {
      logger.error("Find next driver error:", error)
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }
}
