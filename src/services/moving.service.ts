import prisma from "../config/database"
import { LocationService } from "./location.service"
import { NotificationService } from "./notification.service"
import logger from "../utils/logger"

export class MovingService {
  private locationService = new LocationService()
  private notificationService = new NotificationService()

  async calculateMovingQuote(data: {
    pickupAddress: any
    dropoffAddress: any
    inventoryItems: any[]
    serviceTier: string
    estimatedWeight?: number
    estimatedVolume?: number
    requiresPacking?: boolean
    requiresStorage?: boolean
    requiresDisassembly?: boolean
    movingDate: Date
  }) {
    try {
      // Calculate distance
      const distance = this.locationService.calculateDistance(
        data.pickupAddress.latitude,
        data.pickupAddress.longitude,
        data.dropoffAddress.latitude,
        data.dropoffAddress.longitude,
      )

      // Base pricing structure
      const basePrices = {
        BASIC: 15000, // ₦150 per hour
        STANDARD: 25000, // ₦250 per hour
        PREMIUM: 40000, // ₦400 per hour
      }

      const basePrice = basePrices[data.serviceTier as keyof typeof basePrices] || basePrices.STANDARD

      // Calculate estimated duration based on inventory and distance
      const estimatedDuration = this.calculateMovingDuration({
        inventoryItems: data.inventoryItems,
        distance,
        serviceTier: data.serviceTier,
        requiresPacking: data.requiresPacking,
        requiresDisassembly: data.requiresDisassembly,
      })

      // Calculate pricing breakdown
      const laborCost = basePrice * estimatedDuration
      const transportCost = Math.max(5000, distance * 0.5) // ₦0.5 per meter, minimum ₦50
      const packingCost = data.requiresPacking ? data.inventoryItems.length * 500 : 0
      const disassemblyCost = data.requiresDisassembly
        ? data.inventoryItems.filter((item) => item.requiresDisassembly).length * 2000
        : 0
      const storageCost = data.requiresStorage ? 10000 : 0

      // Weekend/holiday surcharge
      const isWeekend = data.movingDate.getDay() === 0 || data.movingDate.getDay() === 6
      const weekendSurcharge = isWeekend ? laborCost * 0.2 : 0

      const subtotal = laborCost + transportCost + packingCost + disassemblyCost + storageCost + weekendSurcharge
      const tax = subtotal * 0.075 // 7.5% VAT
      const totalPrice = subtotal + tax

      // Determine crew size and truck size
      const crewSize = this.determineCrewSize(data.serviceTier, data.inventoryItems.length)
      const truckSize = this.determineTruckSize(data.estimatedVolume, data.inventoryItems.length)

      return {
        totalPrice: Math.round(totalPrice),
        estimatedDuration,
        crewSize,
        truckSize,
        breakdown: {
          laborCost,
          transportCost,
          packingCost,
          disassemblyCost,
          storageCost,
          weekendSurcharge,
          tax,
          subtotal,
        },
      }
    } catch (error) {
      logger.error("Calculate moving quote error:", error)
      throw error
    }
  }

  async getAvailableMovers(params: {
    latitude: number
    longitude: number
    movingDate: Date
    serviceTier?: string
    estimatedWeight?: number
    radius: number
  }) {
    try {
      const movers = await prisma.moverProfile.findMany({
        where: {
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
            },
          },
        },
      })

      // Filter movers based on criteria
      const availableMovers = movers
        .filter((mover) => {
          // Check weight capacity if specified
          if (params.estimatedWeight && mover.maxWeight && params.estimatedWeight > mover.maxWeight) {
            return false
          }

          // Check service tier compatibility
          if (params.serviceTier === "PREMIUM" && !mover.hasPackingService) {
            return false
          }

          return true
        })
        .map((mover) => {
          // Calculate distance (assuming mover location is available)
          const distance = 0 // Placeholder - would need mover location

          return {
            ...mover,
            distance,
            estimatedArrival: Math.ceil(distance / 500), // Rough estimate
            hourlyRate: mover.hourlyRate,
            services: {
              packing: mover.hasPackingService,
              storage: mover.hasStorageService,
              disassembly: mover.hasDisassemblyService,
            },
          }
        })
        .sort((a, b) => a.distance - b.distance)

      return availableMovers
    } catch (error) {
      logger.error("Get available movers error:", error)
      throw error
    }
  }

  async acceptMovingJob(bookingId: string, moverId: string) {
    try {
      // Validate mover eligibility
      const moverProfile = await prisma.moverProfile.findUnique({
        where: { userId: moverId },
      })

      if (!moverProfile || !moverProfile.isVerified || !moverProfile.isAvailable) {
        throw new Error("Mover not available or not verified")
      }

      // Get booking
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          serviceType: true,
        },
      })

      if (!booking || booking.status !== "CONFIRMED") {
        throw new Error("Booking not available for acceptance")
      }

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          providerId: moverId,
          status: "DRIVER_ASSIGNED",
          acceptedAt: new Date(),
        },
        include: {
          customer: true,
          provider: true,
          serviceType: true,
        },
      })

      // Update mover availability
      await prisma.moverProfile.update({
        where: { id: moverProfile.id },
        data: {
          isAvailable: false,
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "MOVING_JOB_ACCEPTED",
        title: "Moving Job Accepted",
        body: `${updatedBooking.provider?.firstName} has accepted your moving job`,
        data: {
          bookingId: booking.id,
          moverName: `${updatedBooking.provider?.firstName} ${updatedBooking.provider?.lastName}`,
          moverPhone: updatedBooking.provider?.phone,
        },
        priority: "STANDARD",
      })

      return updatedBooking
    } catch (error) {
      logger.error("Accept moving job error:", error)
      throw error
    }
  }

  async startMovingJob(
    bookingId: string,
    data: {
      moverId: string
      crewMembers?: string[]
      equipmentUsed?: string[]
    },
  ) {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          providerId: data.moverId,
          status: "DRIVER_ASSIGNED",
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
          serviceData: {
            ...(booking.serviceData as any),
            crewMembers: data.crewMembers,
            equipmentUsed: data.equipmentUsed,
            startTime: new Date(),
          },
        },
      })

      // Add tracking update
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values
          longitude: 0,
          status: "MOVING_STARTED",
          message: "Moving job has started",
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "MOVING_JOB_STARTED",
        title: "Moving Job Started",
        body: "Your moving job has started",
        data: { bookingId },
        priority: "STANDARD",
      })

      return updatedBooking
    } catch (error) {
      logger.error("Start moving job error:", error)
      throw error
    }
  }

  async completeMovingJob(
    bookingId: string,
    data: {
      moverId: string
      actualDuration?: number
      finalPrice?: number
      damageReport?: any
      customerSignature?: string
      additionalServices?: any[]
    },
  ) {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          providerId: data.moverId,
          status: "IN_PROGRESS",
        },
        include: {
          customer: true,
          serviceType: true,
        },
      })

      if (!booking) {
        throw new Error("Booking not found or invalid status")
      }

      // Calculate final pricing if not provided
      let finalPrice = data.finalPrice
      if (!finalPrice) {
        finalPrice = booking.estimatedPrice || 0

        // Add additional services cost
        if (data.additionalServices && data.additionalServices.length > 0) {
          const additionalCost = data.additionalServices.reduce((sum, service) => sum + (service.cost || 0), 0)
          finalPrice += additionalCost
        }
      }

      const commission = finalPrice * 0.15 // 15% commission for moving services
      const providerEarning = finalPrice - commission

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          actualDuration: data.actualDuration,
          finalPrice,
          platformCommission: commission,
          providerEarning,
          serviceData: {
            ...(booking.serviceData as any),
            damageReport: data.damageReport,
            customerSignature: data.customerSignature,
            additionalServices: data.additionalServices,
            completionTime: new Date(),
          },
        },
      })

      // Update mover availability and stats
      await prisma.moverProfile.updateMany({
        where: { userId: data.moverId },
        data: {
          isAvailable: true,
          totalMoves: { increment: 1 },
          totalEarnings: { increment: providerEarning },
          monthlyEarnings: { increment: providerEarning },
          monthlyCommissionDue: { increment: commission },
        },
      })

      // Create earning record
      const moverProfile = await prisma.moverProfile.findFirst({
        where: { userId: data.moverId },
      })

      if (moverProfile) {
        await prisma.moverEarning.create({
          data: {
            moverProfileId: moverProfile.id,
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
          latitude: 0,
          longitude: 0,
          status: "COMPLETED",
          message: "Moving job completed successfully",
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "MOVING_JOB_COMPLETED",
        title: "Moving Job Completed",
        body: "Your moving job has been completed successfully",
        data: {
          bookingId,
          finalPrice,
          damageReport: data.damageReport,
        },
        priority: "STANDARD",
      })

      return updatedBooking
    } catch (error) {
      logger.error("Complete moving job error:", error)
      throw error
    }
  }

  async getMovingBookings(
    userId: string,
    filters: {
      page: number
      limit: number
      status?: string
      dateFrom?: string
      dateTo?: string
      role: string
    },
  ) {
    try {
      const { page, limit, status, dateFrom, dateTo, role } = filters
      const skip = (page - 1) * limit

      const where: any = {
        serviceType: {
          category: "MOVING",
        },
      }

      // Filter by user role
      if (role === "customer") {
        where.customerId = userId
      } else if (role === "mover") {
        where.providerId = userId
      }

      if (status) {
        where.status = status
      }

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
              },
            },
            provider: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            serviceType: true,
            movingInventory: true, // Change from movingInventoryItems
            trackingUpdates: {
              orderBy: { timestamp: "desc" },
              take: 5,
            },
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
      logger.error("Get moving bookings error:", error)
      throw error
    }
  }

  async getMoverEarnings(
    userId: string,
    params: {
      period: string
      startDate?: string
      endDate?: string
    },
  ) {
    try {
      const moverProfile = await prisma.moverProfile.findFirst({
        where: { userId },
      })

      if (!moverProfile) {
        throw new Error("Mover profile not found")
      }

      const where: any = { moverProfileId: moverProfile.id }

      // Set date filters based on period
      if (params.period === "week") {
        const weekStart = this.getWeekStart(new Date())
        where.weekStarting = weekStart
      } else if (params.period === "month") {
        const monthYear = new Date().toISOString().slice(0, 7)
        where.monthYear = monthYear
      } else if (params.startDate || params.endDate) {
        where.date = {}
        if (params.startDate) where.date.gte = new Date(params.startDate)
        if (params.endDate) where.date.lte = new Date(params.endDate)
      }

      const earnings = await prisma.moverEarning.findMany({
        where,
        // Remove booking include from moverEarning
        orderBy: { date: "desc" },
      })

      const totalEarnings = earnings.reduce((sum, earning) => sum + earning.netEarning, 0)
      const totalCommission = earnings.reduce((sum, earning) => sum + earning.commission, 0)

      return {
        earnings,
        summary: {
          totalEarnings,
          totalCommission,
          totalJobs: earnings.length,
          averageEarning: earnings.length > 0 ? totalEarnings / earnings.length : 0,
        },
      }
    } catch (error) {
      logger.error("Get mover earnings error:", error)
      throw error
    }
  }

  async getMoverAnalytics(userId: string) {
    try {
      const moverProfile = await prisma.moverProfile.findFirst({
        where: { userId },
      })

      if (!moverProfile) {
        throw new Error("Mover profile not found")
      }

      // Get current month stats
      const currentMonth = new Date().toISOString().slice(0, 7)
      const monthlyEarnings = await prisma.moverEarning.findMany({
        where: {
          moverProfileId: moverProfile.id,
          monthYear: currentMonth,
        },
      })

      // Get recent bookings
      const recentBookings = await prisma.booking.findMany({
        where: {
          providerId: userId,
          serviceType: {
            category: "MOVING",
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      // Calculate ratings
      const reviews = await prisma.review.findMany({
        where: {
          receiverId: userId,
          type: "BUSINESS", // Use existing enum value instead of "MOVER"
        },
      })

      const averageRating =
        reviews.length > 0 ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0

      return {
        profile: moverProfile,
        monthlyStats: {
          earnings: monthlyEarnings.reduce((sum, earning) => sum + earning.netEarning, 0),
          jobs: monthlyEarnings.length,
          commission: monthlyEarnings.reduce((sum, earning) => sum + earning.commission, 0),
        },
        recentBookings,
        rating: {
          average: averageRating,
          count: reviews.length,
        },
      }
    } catch (error) {
      logger.error("Get mover analytics error:", error)
      throw error
    }
  }

  private calculateMovingDuration(params: {
    inventoryItems: any[]
    distance: number
    serviceTier: string
    requiresPacking?: boolean
    requiresDisassembly?: boolean
  }): number {
    // Base duration calculation
    let baseDuration = 2 // Minimum 2 hours

    // Add time based on inventory
    const itemCount = params.inventoryItems.length
    baseDuration += Math.ceil(itemCount / 10) // 1 hour per 10 items

    // Add time for distance (loading/unloading + travel)
    const travelTime = Math.max(0.5, params.distance / 30000) // 30km/h average speed
    baseDuration += travelTime

    // Service tier adjustments
    const tierMultipliers = {
      BASIC: 1.2, // Less efficient
      STANDARD: 1.0,
      PREMIUM: 0.8, // More efficient
    }

    baseDuration *= tierMultipliers[params.serviceTier as keyof typeof tierMultipliers] || 1.0

    // Additional services
    if (params.requiresPacking) {
      baseDuration += itemCount * 0.1 // 6 minutes per item for packing
    }

    if (params.requiresDisassembly) {
      const disassemblyItems = params.inventoryItems.filter((item) => item.requiresDisassembly).length
      baseDuration += disassemblyItems * 0.5 // 30 minutes per item for disassembly
    }

    return Math.ceil(baseDuration)
  }

  private determineCrewSize(serviceTier: string, itemCount: number): number {
    const baseCrew = {
      BASIC: 2,
      STANDARD: 3,
      PREMIUM: 4,
    }

    let crewSize = baseCrew[serviceTier as keyof typeof baseCrew] || 2

    // Adjust based on item count
    if (itemCount > 50) crewSize += 1
    if (itemCount > 100) crewSize += 1

    return Math.min(crewSize, 6) // Maximum 6 crew members
  }

  private determineTruckSize(estimatedVolume?: number, itemCount?: number): string {
    if (estimatedVolume) {
      if (estimatedVolume <= 10) return "SMALL_VAN"
      if (estimatedVolume <= 25) return "MEDIUM_TRUCK"
      if (estimatedVolume <= 50) return "LARGE_TRUCK"
      return "EXTRA_LARGE_TRUCK"
    }

    if (itemCount) {
      if (itemCount <= 20) return "SMALL_VAN"
      if (itemCount <= 50) return "MEDIUM_TRUCK"
      if (itemCount <= 100) return "LARGE_TRUCK"
      return "EXTRA_LARGE_TRUCK"
    }

    return "MEDIUM_TRUCK"
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
    return new Date(d.setDate(diff))
  }
}
