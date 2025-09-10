import prisma from "../config/database"
import { LocationService } from "./location.service"
import { NotificationService } from "./notification.service"
import { PaymentService } from "./payment.service"
import logger from "../utils/logger"

export class TaxiDriverService {
  private locationService = new LocationService()
  private notificationService = new NotificationService()
  private paymentService = new PaymentService()

  async onboardTaxiDriver(userId: string, onboardingData: any) {
    try {
      // Check if user already has a taxi driver profile
      const existingProfile = await prisma.taxiDriverProfile.findUnique({
        where: { userId },
      })

      if (existingProfile) {
        throw new Error("User already has a taxi driver profile")
      }

      // Update user role
      await prisma.user.update({
        where: { id: userId },
        data: { role: "TAXI_DRIVER" },
      })

      // Create taxi driver profile
      const taxiDriverProfile = await prisma.taxiDriverProfile.create({
        data: {
          userId,
          licenseNumber: onboardingData.licenseNumber,
          licenseExpiry: new Date(onboardingData.licenseExpiry),
          licenseClass: onboardingData.licenseClass,
          taxiLicenseNumber: onboardingData.taxiLicenseNumber,
          taxiLicenseExpiry: new Date(onboardingData.taxiLicenseExpiry),
          taxiPermitNumber: onboardingData.taxiPermitNumber,
          taxiPermitExpiry: onboardingData.taxiPermitExpiry ? new Date(onboardingData.taxiPermitExpiry) : null,
          taxiZone: onboardingData.taxiZone,
          meterNumber: onboardingData.meterNumber,
          operatingHours: onboardingData.operatingHours ? JSON.stringify(onboardingData.operatingHours) : undefined,
        },
      })

      // Add vehicle if provided
      if (onboardingData.vehicleInfo) {
        const vehicle = await prisma.vehicle.create({
          data: {
            ...onboardingData.vehicleInfo,
            type: "TAXI",
            category: "TAXI",
            isTaxi: true,
            taxiMeterInstalled: onboardingData.vehicleInfo.taxiMeterInstalled || true,
            taxiTopLightInstalled: onboardingData.vehicleInfo.taxiTopLightInstalled || true,
          },
        })

        await prisma.taxiDriverProfile.update({
          where: { id: taxiDriverProfile.id },
          data: { vehicleId: vehicle.id },
        })
      }

      // Update bank details if provided
      if (onboardingData.bankDetails) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            bankName: onboardingData.bankDetails.bankName,
            bankAccountNumber: onboardingData.bankDetails.accountNumber,
            bankAccountName: onboardingData.bankDetails.accountName,
            bankCode: onboardingData.bankDetails.bankCode,
          },
        })
      }

      // Add emergency contact if provided
      if (onboardingData.emergencyContact) {
        await prisma.emergencyContact.create({
          data: {
            userId,
            name: onboardingData.emergencyContact.name,
            phone: onboardingData.emergencyContact.phone,
            relationship: onboardingData.emergencyContact.relationship,
            isPrimary: true,
          },
        })
      }

      return taxiDriverProfile
    } catch (error) {
      logger.error("Onboard taxi driver error:", error)
      throw error
    }
  }

  async updateProfile(userId: string, updateData: any) {
    try {
      const taxiDriverProfile = await prisma.taxiDriverProfile.findUnique({
        where: { userId },
      })

      if (!taxiDriverProfile) {
        throw new Error("Taxi driver profile not found")
      }

      const updatedProfile = await prisma.taxiDriverProfile.update({
        where: { userId },
        data: {
          taxiZone: updateData.taxiZone,
          meterNumber: updateData.meterNumber,
          insurancePolicyNumber: updateData.insurancePolicyNumber,
          insuranceExpiry: updateData.insuranceExpiry ? new Date(updateData.insuranceExpiry) : undefined,
          acceptsCash: updateData.acceptsCash,
          acceptsCard: updateData.acceptsCard,
          maxRideDistance: updateData.maxRideDistance,
          preferredPayoutMethod: updateData.preferredPayoutMethod,
          payoutSchedule: updateData.payoutSchedule,
          minimumPayoutAmount: updateData.minimumPayoutAmount,
        },
      })

      return updatedProfile
    } catch (error) {
      logger.error("Update taxi driver profile error:", error)
      throw error
    }
  }

  async getProfile(userId: string) {
    try {
      const profile = await prisma.taxiDriverProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          vehicle: true,
          documents: true,
        },
      })

      if (!profile) {
        throw new Error("Taxi driver profile not found")
      }

      return profile
    } catch (error) {
      logger.error("Get taxi driver profile error:", error)
      throw error
    }
  }

  async addVehicle(userId: string, vehicleData: any) {
    try {
      const taxiDriverProfile = await prisma.taxiDriverProfile.findUnique({
        where: { userId },
      })

      if (!taxiDriverProfile) {
        throw new Error("Taxi driver profile not found")
      }

      const vehicle = await prisma.vehicle.create({
        data: {
          ...vehicleData,
          type: "TAXI",
          category: "TAXI",
          isTaxi: true,
          taxiMeterInstalled: vehicleData.taxiMeterInstalled || true,
          taxiTopLightInstalled: vehicleData.taxiTopLightInstalled || true,
        },
      })

      // Link vehicle to taxi driver
      await prisma.taxiDriverProfile.update({
        where: { id: taxiDriverProfile.id },
        data: { vehicleId: vehicle.id },
      })

      return vehicle
    } catch (error) {
      logger.error("Add taxi vehicle error:", error)
      throw error
    }
  }

  async updateVehicle(userId: string, vehicleId: string, updateData: any) {
    try {
      const taxiDriverProfile = await prisma.taxiDriverProfile.findUnique({
        where: { userId },
      })

      if (!taxiDriverProfile || taxiDriverProfile.vehicleId !== vehicleId) {
        throw new Error("Vehicle not found or not owned by taxi driver")
      }

      const vehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: updateData,
      })

      return vehicle
    } catch (error) {
      logger.error("Update taxi vehicle error:", error)
      throw error
    }
  }

  async getVehicles(userId: string) {
    try {
      const taxiDriverProfile = await prisma.taxiDriverProfile.findUnique({
        where: { userId },
        include: {
          vehicle: true,
        },
      })

      if (!taxiDriverProfile) {
        throw new Error("Taxi driver profile not found")
      }

      return taxiDriverProfile.vehicle ? [taxiDriverProfile.vehicle] : []
    } catch (error) {
      logger.error("Get taxi vehicles error:", error)
      throw error
    }
  }

  async uploadDocument(userId: string, documentData: any) {
    try {
      const taxiDriverProfile = await prisma.taxiDriverProfile.findUnique({
        where: { userId },
      })

      if (!taxiDriverProfile) {
        throw new Error("Taxi driver profile not found")
      }

      const document = await prisma.taxiDriverDocument.create({
        data: {
          taxiDriverProfileId: taxiDriverProfile.id,
          type: documentData.documentType,
          documentNumber: documentData.documentNumber,
          documentUrl: documentData.documentUrl,
          expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate) : null,
          status: "PENDING",
        },
      })

      return document
    } catch (error) {
      logger.error("Upload taxi document error:", error)
      throw error
    }
  }

  async getDocuments(userId: string) {
    try {
      const taxiDriverProfile = await prisma.taxiDriverProfile.findUnique({
        where: { userId },
        include: {
          documents: true,
        },
      })

      if (!taxiDriverProfile) {
        throw new Error("Taxi driver profile not found")
      }

      return taxiDriverProfile.documents
    } catch (error) {
      logger.error("Get taxi documents error:", error)
      throw error
    }
  }

  async updateAvailability(userId: string, availabilityData: any) {
    try {
      const profile = await prisma.taxiDriverProfile.update({
        where: { userId },
        data: {
          isAvailable: availabilityData.isAvailable,
          isOnline: availabilityData.isOnline,
          currentLatitude: availabilityData.currentLatitude,
          currentLongitude: availabilityData.currentLongitude,
        },
      })

      // Broadcast availability update via WebSocket
      try {
        const { io } = await import("../server")
        await io.broadcastToRole("USER", "taxi_driver_availability_update", {
          driverId: userId,
          isAvailable: availabilityData.isAvailable,
          isOnline: availabilityData.isOnline,
          location: availabilityData.currentLatitude && availabilityData.currentLongitude ? {
            latitude: availabilityData.currentLatitude,
            longitude: availabilityData.currentLongitude
          } : null,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to broadcast taxi driver availability update:", error)
      }

      return profile
    } catch (error) {
      logger.error("Update taxi availability error:", error)
      throw error
    }
  }

  async updateLocation(userId: string, locationData: any) {
    try {
      await prisma.taxiDriverProfile.update({
        where: { userId },
        data: {
          currentLatitude: locationData.latitude,
          currentLongitude: locationData.longitude,
          heading: locationData.heading,
        },
      })

      // Store location history
      await prisma.driverLocationHistory.create({
        data: {
          driverId: userId,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          heading: locationData.heading,
          speed: locationData.speed,
        },
      })

      // Broadcast location update to active customers
      try {
        const { io } = await import("../server")
        const activeBookings = await prisma.booking.findMany({
          where: {
            providerId: userId,
            status: { in: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "IN_PROGRESS"] },
          },
        })

        for (const booking of activeBookings) {
          await io.notifyUser(booking.customerId, "taxi_driver_location_update", {
            bookingId: booking.id,
            driverId: userId,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            heading: locationData.heading,
            speed: locationData.speed,
            timestamp: new Date(),
          })
        }
      } catch (error) {
        logger.warn("Failed to broadcast taxi driver location update:", error)
      }
    } catch (error) {
      logger.error("Update taxi location error:", error)
      throw error
    }
  }

  async updateOperatingHours(userId: string, operatingHours: any) {
    try {
      const profile = await prisma.taxiDriverProfile.update({
        where: { userId },
        data: {
          operatingHours: JSON.stringify(operatingHours),
        },
      })

      return profile
    } catch (error) {
      logger.error("Update operating hours error:", error)
      throw error
    }
  }

  async acceptBooking(taxiDriverId: string, bookingId: string) {
    try {
      // Get taxi driver profile
      const taxiDriverProfile = await prisma.taxiDriverProfile.findUnique({
        where: { userId: taxiDriverId },
        include: { vehicle: true },
      })

      if (!taxiDriverProfile || !taxiDriverProfile.isVerified || !taxiDriverProfile.isAvailable) {
        throw new Error("Taxi driver not available or not verified")
      }

      // Get booking
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          serviceType: true,
        },
      })

      if (!booking || booking.status !== "PENDING") {
        throw new Error("Booking not available for acceptance")
      }

      // Check if taxi driver is within reasonable distance (for immediate bookings)
      if (booking.type === "IMMEDIATE" && taxiDriverProfile.currentLatitude && taxiDriverProfile.currentLongitude) {
        const distance = this.locationService.calculateDistance(
          taxiDriverProfile.currentLatitude,
          taxiDriverProfile.currentLongitude,
          booking.pickupLatitude!,
          booking.pickupLongitude!,
        )

        if (distance > 15000) {
          // 15km limit
          throw new Error("Taxi driver too far from pickup location")
        }
      }

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          providerId: taxiDriverId,
          status: "DRIVER_ASSIGNED",
          acceptedAt: new Date(),
        },
        include: {
          customer: true,
          provider: true,
          serviceType: true,
        },
      })

      // Update taxi driver availability
      await prisma.taxiDriverProfile.update({
        where: { id: taxiDriverProfile.id },
        data: {
          isAvailable: false,
        },
      })

      // Calculate ETA
      const eta = await this.calculateETA(
        taxiDriverProfile.currentLatitude!,
        taxiDriverProfile.currentLongitude!,
        booking.pickupLatitude!,
        booking.pickupLongitude!,
      )

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "BOOKING_ACCEPTED",
        title: "Taxi Driver Assigned",
        body: `${updatedBooking.provider?.firstName} is on the way. ETA: ${eta} minutes`,
        data: {
          bookingId: booking.id,
          driverName: `${updatedBooking.provider?.firstName} ${updatedBooking.provider?.lastName}`,
          driverPhone: updatedBooking.provider?.phone,
          eta,
          vehicleInfo: taxiDriverProfile.vehicle,
          taxiLicense: taxiDriverProfile.taxiLicenseNumber,
        },
        priority: "STANDARD",
      })

      // Send WebSocket notification for real-time updates
      try {
        const { io } = await import("../server")
        await io.notifyUser(booking.customerId, "taxi_booking_accepted", {
          bookingId,
          driverId: taxiDriverId,
          driverName: `${updatedBooking.provider?.firstName} ${updatedBooking.provider?.lastName}`,
          driverPhone: updatedBooking.provider?.phone,
          eta,
          vehicleInfo: taxiDriverProfile.vehicle,
          taxiLicense: taxiDriverProfile.taxiLicenseNumber,
          acceptedAt: updatedBooking.acceptedAt,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to send WebSocket notification for taxi booking acceptance:", error)
      }

      // Start tracking
      await this.startBookingTracking(bookingId, taxiDriverId)

      return updatedBooking
    } catch (error) {
      logger.error("Accept taxi booking error:", error)
      throw error
    }
  }

  async rejectBooking(taxiDriverId: string, bookingId: string, reason?: string) {
    try {
      // Log rejection for analytics
      await prisma.bookingRejection.create({
        data: {
          bookingId,
          driverId: taxiDriverId,
          reason: reason || "No reason provided",
          rejectedAt: new Date(),
        },
      })

      // Find next available taxi driver
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      })

      if (booking) {
        await this.findAndNotifyNextTaxiDriver(booking)
      }

      return { success: true }
    } catch (error) {
      logger.error("Reject taxi booking error:", error)
      throw error
    }
  }

  async arriveAtPickup(taxiDriverId: string, bookingId: string) {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          providerId: taxiDriverId,
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
          status: "DRIVER_ARRIVED",
        },
      })

      // Add tracking update
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values since they're required
          longitude: 0,
          status: "DRIVER_ARRIVED",
          message: "Taxi driver has arrived at pickup location",
          timestamp: new Date(),
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "DRIVER_ARRIVED",
        title: "Taxi Driver Arrived",
        body: "Your taxi driver has arrived at the pickup location",
        data: { bookingId },
        priority: "URGENT",
      })

      // Send WebSocket notification for real-time updates
      try {
        const { io } = await import("../server")
        await io.notifyUser(booking.customerId, "taxi_driver_arrived", {
          bookingId,
          driverId: taxiDriverId,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to send WebSocket notification for taxi driver arrival:", error)
      }

      return updatedBooking
    } catch (error) {
      logger.error("Taxi driver arrive at pickup error:", error)
      throw error
    }
  }

  async startTrip(taxiDriverId: string, bookingId: string) {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          providerId: taxiDriverId,
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

      // Add tracking update
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values since they're required
          longitude: 0,
          status: "TRIP_STARTED",
          message: "Taxi trip has started",
          timestamp: new Date(),
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "TRIP_STARTED",
        title: "Taxi Trip Started",
        body: "Your taxi trip has started",
        data: { bookingId },
        priority: "STANDARD",
      })

      // Send WebSocket notification for real-time updates
      try {
        const { io } = await import("../server")
        await io.notifyUser(booking.customerId, "taxi_trip_started", {
          bookingId,
          driverId: taxiDriverId,
          startedAt: updatedBooking.startedAt,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to send WebSocket notification for taxi trip start:", error)
      }

      return updatedBooking
    } catch (error) {
      logger.error("Start taxi trip error:", error)
      throw error
    }
  }

  async completeTrip(
    taxiDriverId: string,
    bookingId: string,
    completionData: {
      actualDistance?: number
      actualDuration?: number
      finalPrice?: number
      endLatitude?: number
      endLongitude?: number
      meterReading?: number
    },
  ) {
    try {
      const booking = await prisma.booking.findFirst({
        where: {
          id: bookingId,
          providerId: taxiDriverId,
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
      let finalPrice = completionData.finalPrice
      if (!finalPrice) {
        finalPrice = await this.calculateTaxiFinalPrice(
          booking,
          completionData.actualDistance,
          completionData.meterReading,
        )
      }

      const commission = finalPrice * (booking.serviceType.commissionRate || 0.15) // Lower commission for taxis
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
          serviceData: {
            ...(booking.serviceData as any),
            meterReading: completionData.meterReading,
          },
        },
      })

      // Update taxi driver availability and stats
      await prisma.taxiDriverProfile.updateMany({
        where: { userId: taxiDriverId },
        data: {
          isAvailable: true,
          totalRides: { increment: 1 },
          totalEarnings: { increment: providerEarning },
          monthlyEarnings: { increment: providerEarning },
          monthlyCommissionDue: { increment: commission },
        },
      })

      // Create earning record
      const taxiDriverProfile = await prisma.taxiDriverProfile.findFirst({
        where: { userId: taxiDriverId },
      })

      if (taxiDriverProfile) {
        await prisma.taxiDriverEarning.create({
          data: {
            taxiDriverProfileId: taxiDriverProfile.id,
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
          message: "Taxi trip completed successfully",
          timestamp: new Date(),
        },
      })

      // Process payment
      await this.paymentService.processPayment({
        userId: booking.customerId,
        bookingId,
        amount: finalPrice,
        paymentMethodId: "default", // This should come from booking data
        description: "Taxi trip payment",
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "TRIP_COMPLETED",
        title: "Taxi Trip Completed",
        body: `Your taxi trip has been completed. Total: ₦${finalPrice}`,
        data: {
          bookingId,
          finalPrice,
          distance: completionData.actualDistance,
          duration: completionData.actualDuration,
          meterReading: completionData.meterReading,
        },
        priority: "STANDARD",
      })

      // Send WebSocket notification for real-time updates
      try {
        const { io } = await import("../server")
        await io.notifyUser(booking.customerId, "taxi_trip_completed", {
          bookingId,
          driverId: taxiDriverId,
          finalPrice,
          distance: completionData.actualDistance,
          duration: completionData.actualDuration,
          meterReading: completionData.meterReading,
          completedAt: updatedBooking.completedAt,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to send WebSocket notification for taxi trip completion:", error)
      }

      return updatedBooking
    } catch (error) {
      logger.error("Complete taxi trip error:", error)
      throw error
    }
  }

  async getTaxiDriverBookings(
    taxiDriverId: string,
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

      const where: any = { providerId: taxiDriverId }
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
      logger.error("Get taxi driver bookings error:", error)
      throw error
    }
  }

  async getTaxiDriverEarnings(
    taxiDriverId: string,
    filters: {
      period: string
      startDate?: string
      endDate?: string
    },
  ) {
    try {
      const taxiDriverProfile = await prisma.taxiDriverProfile.findFirst({
        where: { userId: taxiDriverId },
      })

      if (!taxiDriverProfile) {
        throw new Error("Taxi driver profile not found")
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
      const earnings = await prisma.taxiDriverEarning.findMany({
        where: {
          taxiDriverProfileId: taxiDriverProfile.id,
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
      logger.error("Get taxi driver earnings error:", error)
      throw error
    }
  }

  async getTaxiDriverAnalytics(taxiDriverId: string) {
    try {
      const taxiDriverProfile = await prisma.taxiDriverProfile.findFirst({
        where: { userId: taxiDriverId },
      })

      if (!taxiDriverProfile) {
        throw new Error("Taxi driver profile not found")
      }

      // Get current month data
      const currentMonth = new Date()
      currentMonth.setDate(1)
      currentMonth.setHours(0, 0, 0, 0)

      const [monthlyStats, weeklyStats, recentBookings] = await Promise.all([
        // Monthly stats
        prisma.taxiDriverEarning.aggregate({
          where: {
            taxiDriverProfileId: taxiDriverProfile.id,
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
        prisma.taxiDriverEarning.aggregate({
          where: {
            taxiDriverProfileId: taxiDriverProfile.id,
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
            providerId: taxiDriverId,
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
          rating: taxiDriverProfile.rating,
          totalRides: taxiDriverProfile.totalRides,
          totalEarnings: taxiDriverProfile.totalEarnings,
          isVerified: taxiDriverProfile.isVerified,
          taxiLicense: taxiDriverProfile.taxiLicenseNumber,
          taxiZone: taxiDriverProfile.taxiZone,
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
      logger.error("Get taxi driver analytics error:", error)
      throw error
    }
  }

  async getAllTaxiDrivers(filters: any) {
    try {
      const { page = 1, limit = 20, status, zone } = filters
      const skip = (page - 1) * limit

      const where: any = {}
      if (status) where.verificationStatus = status
      if (zone) where.taxiZone = zone

      const [taxiDrivers, total] = await Promise.all([
        prisma.taxiDriverProfile.findMany({
          where,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatar: true,
              },
            },
            vehicle: true,
          },
          // orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.taxiDriverProfile.count({ where }),
      ])

      return {
        taxiDrivers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get all taxi drivers error:", error)
      throw error
    }
  }

  async verifyTaxiDriver(taxiDriverId: string) {
    try {
      const taxiDriver = await prisma.taxiDriverProfile.update({
        where: { userId: taxiDriverId },
        data: {
          isVerified: true,
          verificationStatus: "APPROVED",
        },
      })

      // Notify taxi driver
      await this.notificationService.notifyDriver(taxiDriverId, {
        type: "VERIFICATION_APPROVED",
        title: "Verification Approved",
        body: "Your taxi driver account has been verified and approved",
        priority: "URGENT",
      })

      return taxiDriver
    } catch (error) {
      logger.error("Verify taxi driver error:", error)
      throw error
    }
  }

  async suspendTaxiDriver(taxiDriverId: string, reason: string) {
    try {
      const taxiDriver = await prisma.taxiDriverProfile.update({
        where: { userId: taxiDriverId },
        data: {
          isVerified: false,
          verificationStatus: "REJECTED",
          isAvailable: false,
          isOnline: false,
        },
      })

      // Notify taxi driver
      await this.notificationService.notifyDriver(taxiDriverId, {
        type: "ACCOUNT_SUSPENDED",
        title: "Account Suspended",
        body: `Your taxi driver account has been suspended. Reason: ${reason}`,
        priority: "CRITICAL",
      })

      return taxiDriver
    } catch (error) {
      logger.error("Suspend taxi driver error:", error)
      throw error
    }
  }

  async addTaxiVehicle(taxiDriverProfileId: string, vehicleData: any) {
    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          ...vehicleData,
          type: "TAXI",
          category: "TAXI",
          isTaxi: true,
          taxiMeterInstalled: vehicleData.taxiMeterInstalled || true,
          taxiTopLightInstalled: vehicleData.taxiTopLightInstalled || true,
          isActive: true,
          isVerified: false,
        },
      })

      // Link vehicle to taxi driver
      await prisma.taxiDriverProfile.update({
        where: { id: taxiDriverProfileId },
        data: { vehicleId: vehicle.id },
      })

      return vehicle
    } catch (error) {
      logger.error("Add taxi vehicle error:", error)
      throw error
    }
  }

  private async calculateETA(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<number> {
    try {
      const distance = this.locationService.calculateDistance(fromLat, fromLng, toLat, toLng)
      // Assume average speed of 25 km/h in city traffic for taxis
      const timeInHours = distance / 25000 // distance in meters, speed in m/h
      return Math.ceil(timeInHours * 60) // return minutes
    } catch (error) {
      logger.error("Calculate ETA error:", error)
      return 15 // default 15 minutes
    }
  }

  private async calculateTaxiFinalPrice(booking: any, actualDistance?: number, meterReading?: number): Promise<number> {
    try {
      const serviceType = booking.serviceType
      let finalPrice = serviceType.basePrice || 0

      // Use meter reading if available (for regulated taxi fares)
      if (meterReading) {
        finalPrice = meterReading
      } else if (actualDistance && serviceType.pricePerKm) {
        finalPrice += (actualDistance / 1000) * serviceType.pricePerKm
      }

      // Apply surge pricing if applicable (less common for taxis)
      if (booking.surgePricing && booking.surgePricing > 1) {
        finalPrice *= booking.surgePricing
      }

      return Math.round(finalPrice)
    } catch (error) {
      logger.error("Calculate taxi final price error:", error)
      return booking.estimatedPrice || 0
    }
  }

  private async startBookingTracking(bookingId: string, taxiDriverId: string) {
    try {
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values since they're required
          longitude: 0,
          status: "DRIVER_ASSIGNED",
          message: "Taxi driver assigned and tracking started",
          timestamp: new Date(),
        },
      })
    } catch (error) {
      logger.error("Start taxi booking tracking error:", error)
    }
  }

  private async findAndNotifyNextTaxiDriver(booking: any) {
    try {
      // Implementation for finding next available taxi driver
      // This would use the taxi driver matching service
      logger.info(`Finding next taxi driver for booking ${booking.id}`)
    } catch (error) {
      logger.error("Find next taxi driver error:", error)
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }
}
