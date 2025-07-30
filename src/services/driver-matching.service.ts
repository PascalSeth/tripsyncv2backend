import prisma from "../config/database"
import { LocationService } from "./location.service"
import { NotificationService } from "./notification.service"
import logger from "../utils/logger"

export class DriverMatchingService {
  private locationService = new LocationService()
  private notificationService = new NotificationService()

  /**
   * Find nearby drivers for immediate bookings
   */
  async findNearbyDrivers(params: {
    latitude: number
    longitude: number
    serviceType?: string
    rideType?: string
    radius?: number
    maxDrivers?: number
  }) {
    try {
      // Increased default radius from 10km to 15km
      const { latitude, longitude, serviceType = "RIDE", rideType, radius = 15000, maxDrivers = 10 } = params

      console.log("🔍 FINDING NEARBY DRIVERS:")
      console.log(`📍 Search location: ${latitude}, ${longitude}`)
      console.log(`📏 Search radius: ${radius}m (${radius / 1000}km)`)
      console.log(`🚗 Max drivers: ${maxDrivers}`)
      console.log(`🏷️ Service type: ${serviceType}`)
      console.log(`🎯 Ride type: ${rideType || "ANY"}`)

      // Get available drivers
      const availableDrivers = await prisma.driverProfile.findMany({
        where: {
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          driverType: "REGULAR",
          currentLatitude: { not: null },
          currentLongitude: { not: null },
          user: {
            isActive: true,
            isCommissionCurrent: true,
          },
        },
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
          rideTypes: true,
        },
      })

      console.log(`📊 Total drivers in database: ${availableDrivers.length}`)
      console.log("🔍 Available drivers found:")
      availableDrivers.forEach((driver, index) => {
        console.log(`   ${index + 1}. ${driver.user.firstName} ${driver.user.lastName} (${driver.user.id})`)
        console.log(`      📍 Location: ${driver.currentLatitude}, ${driver.currentLongitude}`)
        console.log(`      ✅ Available: ${driver.isAvailable}, Online: ${driver.isOnline}`)
        console.log(`      ✅ Verified: ${driver.isVerified}, Type: ${driver.driverType}`)
        console.log(`      🚗 Ride types: ${driver.rideTypes.map((rt) => `${rt.rideType}(${rt.isActive})`).join(", ")}`)
      })

      // Filter by distance and service compatibility
      const nearbyDrivers = availableDrivers
        .map((driver) => {
          const distance = this.locationService.calculateDistance(
            latitude,
            longitude,
            driver.currentLatitude!,
            driver.currentLongitude!,
          )

          console.log(`📏 Distance to ${driver.user.firstName}: ${distance}m (${(distance / 1000).toFixed(2)}km)`)

          return {
            ...driver,
            distance,
          }
        })
        .filter((driver) => {
          // Check distance
          if (driver.distance > radius) {
            console.log(`❌ ${driver.user.firstName} filtered out: distance ${driver.distance}m > radius ${radius}m`)
            return false
          }

          // Check ride type compatibility
          if (rideType && driver.rideTypes.length > 0) {
            const hasCompatibleRideType = driver.rideTypes.some((rt) => rt.rideType === rideType && rt.isActive)
            if (!hasCompatibleRideType) {
              console.log(`❌ ${driver.user.firstName} filtered out: no compatible ride type for ${rideType}`)
              return false
            }
          }

          console.log(`✅ ${driver.user.firstName} passed all filters`)
          return true
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxDrivers)

      console.log(`🎯 Final nearby drivers count: ${nearbyDrivers.length}`)
      console.log("📋 Final driver list:")
      nearbyDrivers.forEach((driver, index) => {
        console.log(`   ${index + 1}. ${driver.user.firstName} - ${(driver.distance / 1000).toFixed(2)}km away`)
      })

      // Calculate ETA for each driver
      const driversWithETA = await Promise.all(
        nearbyDrivers.map(async (driver) => {
          const eta = await this.locationService.calculateETA(
            driver.currentLatitude!,
            driver.currentLongitude!,
            latitude,
            longitude,
          )

          return {
            driverId: driver.user.id,
            driverName: `${driver.user.firstName} ${driver.user.lastName}`,
            phone: driver.user.phone,
            avatar: driver.user.avatar,
            rating: driver.rating,
            vehicle: driver.vehicle,
            distance: driver.distance,
            eta: eta.eta,
            location: {
              latitude: driver.currentLatitude,
              longitude: driver.currentLongitude,
            },
          }
        }),
      )

      console.log(`🏁 FINAL RESULT: ${driversWithETA.length} drivers with ETA calculated`)
      driversWithETA.forEach((driver, index) => {
        console.log(
          `   ${index + 1}. ${driver.driverName} - ${(driver.distance / 1000).toFixed(2)}km away, ETA: ${driver.eta}min`,
        )
      })

      return driversWithETA
    } catch (error) {
      logger.error("Find nearby drivers error:", error)
      throw error
    }
  }

  /**
   * Find available taxi drivers
   */
  async findNearbyTaxiDrivers(params: {
    latitude: number
    longitude: number
    serviceType?: string
    radius?: number
    maxDrivers?: number
  }) {
    try {
      // Increased default radius from 10km to 15km
      const { latitude, longitude, serviceType = "TAXI", radius = 15000, maxDrivers = 10 } = params

      // Get available taxi drivers
      const availableTaxiDrivers = await prisma.taxiDriverProfile.findMany({
        where: {
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          currentLatitude: { not: null },
          currentLongitude: { not: null },
          user: {
            isActive: true,
            isCommissionCurrent: true,
          },
        },
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

      // Filter by distance
      const nearbyTaxiDrivers = availableTaxiDrivers
        .map((driver) => {
          const distance = this.locationService.calculateDistance(
            latitude,
            longitude,
            driver.currentLatitude!,
            driver.currentLongitude!,
          )

          return {
            ...driver,
            distance,
          }
        })
        .filter((driver) => driver.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxDrivers)

      // Calculate ETA for each taxi driver
      const taxiDriversWithETA = await Promise.all(
        nearbyTaxiDrivers.map(async (driver) => {
          const eta = await this.locationService.calculateETA(
            driver.currentLatitude!,
            driver.currentLongitude!,
            latitude,
            longitude,
          )

          return {
            driverId: driver.user.id,
            driverName: `${driver.user.firstName} ${driver.user.lastName}`,
            phone: driver.user.phone,
            avatar: driver.user.avatar,
            rating: driver.rating,
            vehicle: driver.vehicle,
            distance: driver.distance,
            eta: eta.eta,
            taxiLicense: driver.taxiLicenseNumber,
            taxiZone: driver.taxiZone,
            location: {
              latitude: driver.currentLatitude,
              longitude: driver.currentLongitude,
            },
          }
        }),
      )

      return taxiDriversWithETA
    } catch (error) {
      logger.error("Find nearby taxi drivers error:", error)
      throw error
    }
  }

  /**
   * Notify drivers about new booking requests
   */
  async notifyDriversAboutBooking(bookingId: string, driverIds: string[], bookingData: any) {
    try {
      console.log(`📢 NOTIFYING DRIVERS ABOUT BOOKING: ${bookingId}`)
      console.log(`👥 Driver IDs: ${driverIds.join(", ")}`)

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          serviceType: true,
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      if (!booking) {
        console.log(`❌ Booking not found: ${bookingId}`)
        throw new Error("Booking not found")
      }

      console.log(`📋 Booking Details:`)
      console.log(`   - Service: ${booking.serviceType.displayName}`)
      console.log(`   - Customer: ${booking.customer?.firstName} ${booking.customer?.lastName}`)
      console.log(`   - Pickup: ${booking.pickupLatitude}, ${booking.pickupLongitude}`)

      // Create driver notifications in database
      const notifications = driverIds.map((driverId) => ({
        driverId,
        bookingId,
        notifiedAt: new Date(),
        status: "SENT" as const,
      }))

      await prisma.driverNotification.createMany({
        data: notifications,
        skipDuplicates: true,
      })

      console.log(`✅ Database notifications created for ${driverIds.length} drivers`)

      // Send real-time notifications to drivers
      let notificationsSent = 0
      for (const driverId of driverIds) {
        try {
          console.log(`📱 Sending notification to driver: ${driverId}`)

          await this.notificationService.notifyDriver(driverId, {
            type: "NEW_BOOKING_REQUEST",
            title: "New Booking Request",
            body: `New ${booking.serviceType.displayName} request from ${booking.customer?.firstName}`,
            data: {
              bookingId: booking.id,
              bookingNumber: booking.bookingNumber,
              serviceType: booking.serviceType.name,
              serviceTypeName: booking.serviceType.displayName,
              estimatedEarning: booking.providerEarning,
              pickupLocation: {
                latitude: booking.pickupLatitude,
                longitude: booking.pickupLongitude,
              },
              dropoffLocation: booking.dropoffLatitude
                ? {
                    latitude: booking.dropoffLatitude,
                    longitude: booking.dropoffLongitude,
                  }
                : null,
              customerName: `${booking.customer?.firstName} ${booking.customer?.lastName}`,
              estimatedPrice: booking.estimatedPrice,
              estimatedDistance: booking.estimatedDistance,
              estimatedDuration: booking.estimatedDuration,
              autoRejectIn: 60, // seconds
              createdAt: booking.createdAt,
            },
            priority: "URGENT",
          })

          notificationsSent++
          console.log(`✅ Notification sent to driver: ${driverId}`)
        } catch (error) {
          console.error(`❌ Failed to notify driver ${driverId}:`, error)
        }
      }

      console.log(`📊 Notifications Summary:`)
      console.log(`   - Total drivers: ${driverIds.length}`)
      console.log(`   - Notifications sent: ${notificationsSent}`)
      console.log(`   - Success rate: ${((notificationsSent / driverIds.length) * 100).toFixed(1)}%`)

      // Set auto-reject timer
      setTimeout(async () => {
        console.log(`⏰ Auto-reject timer triggered for booking: ${bookingId}`)
        await this.handleBookingTimeout(bookingId)
      }, 60000) // 60 seconds

      console.log(`📢 DRIVER NOTIFICATION COMPLETE\n`)
      return { notifiedDrivers: notificationsSent }
    } catch (error) {
      logger.error("Notify drivers about booking error:", error)
      console.error(`❌ NOTIFY DRIVERS FAILED:`, error)
      throw error
    }
  }

  /**
   * Handle booking timeout when no driver accepts
   */
  private async handleBookingTimeout(bookingId: string) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      })

      if (!booking || booking.status !== "PENDING") {
        return // Booking already handled
      }

      // Find more drivers in expanded radius - increased from 20km to 30km
      const expandedDrivers = await this.findNearbyDrivers({
        latitude: booking.pickupLatitude!,
        longitude: booking.pickupLongitude!,
        radius: 30000, // Expanded to 30km
        maxDrivers: 8, // Increased max drivers for timeout scenario
      })

      if (expandedDrivers.length > 0) {
        // Notify expanded set of drivers
        const driverIds = expandedDrivers.map((d) => d.driverId)
        await this.notifyDriversAboutBooking(bookingId, driverIds, booking)
      } else {
        // No drivers available, cancel booking
        await prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: "NO_DRIVER_AVAILABLE",
            cancelledAt: new Date(),
            cancellationReason: "No drivers available in the area",
          },
        })

        // Notify customer
        await this.notificationService.notifyCustomer(booking.customerId, {
          type: "BOOKING_CANCELLED",
          title: "Booking Cancelled",
          body: "Sorry, no drivers are available in your area at the moment. Please try again later.",
          data: { bookingId },
          priority: "URGENT",
        })
      }
    } catch (error) {
      logger.error("Handle booking timeout error:", error)
    }
  }

  /**
   * Match driver to booking based on service type
   */
  async matchDriverToBooking(bookingId: string) {
    try {
      console.log(`🎯 MATCHING DRIVER TO BOOKING: ${bookingId}`)

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          serviceType: true,
        },
      })

      if (!booking) {
        console.log(`❌ Booking not found: ${bookingId}`)
        throw new Error("Booking not found")
      }

      console.log(`📋 Booking details:`)
      console.log(`   📍 Pickup: ${booking.pickupLatitude}, ${booking.pickupLongitude}`)
      console.log(`   🏷️ Service: ${booking.serviceType.name} (${booking.serviceType.category})`)
      console.log(`   👤 Customer: ${booking.customer?.firstName} ${booking.customer?.lastName}`)

      let availableDrivers: any[] = []

      // Check if it's a taxi booking
      if (booking.serviceType.name === "TAXI" && booking.serviceType.category === "TRANSPORTATION") {
        console.log(`🚕 Looking for TAXI drivers...`)
        availableDrivers = await this.findNearbyTaxiDrivers({
          latitude: booking.pickupLatitude!,
          longitude: booking.pickupLongitude!,
          serviceType: booking.serviceTypeId,
          radius: 15000,
        })
      } else {
        console.log(`🚗 Looking for REGULAR drivers...`)
        availableDrivers = await this.findNearbyDrivers({
          latitude: booking.pickupLatitude!,
          longitude: booking.pickupLongitude!,
          serviceType: booking.serviceTypeId,
          radius: 15000,
        })
      }

      if (availableDrivers.length === 0) {
        console.log(`❌ NO DRIVERS AVAILABLE for booking ${bookingId}`)

        // Update booking status to indicate no drivers available
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: "NO_DRIVER_AVAILABLE" },
        })

        // Notify customer
        await this.notificationService.notifyCustomer(booking.customerId, {
          type: "NO_DRIVER_AVAILABLE",
          title: "No Drivers Available",
          body: "Sorry, no drivers are available in your area right now. Please try again later.",
          priority: "URGENT",
        })

        return null
      }

      console.log(`✅ Found ${availableDrivers.length} available drivers`)

      // Notify drivers in order of proximity
      const driverIds = availableDrivers.slice(0, 5).map((driver) => driver.driverId)
      console.log(`📢 Notifying ${driverIds.length} drivers: ${driverIds.join(", ")}`)

      // Create driver notifications in database
      const notifications = driverIds.map((driverId) => ({
        driverId,
        bookingId,
        notifiedAt: new Date(),
        status: "SENT" as const,
      }))

      await prisma.driverNotification.createMany({
        data: notifications,
        skipDuplicates: true,
      })

      // Send real-time notifications to drivers
      for (const driver of availableDrivers.slice(0, 5)) {
        await this.notificationService.notifyDriver(driver.driverId, {
          type: "NEW_BOOKING_REQUEST",
          title: "New Booking Request",
          body: `New ${booking.serviceType.displayName} request nearby`,
          data: {
            bookingId: booking.id,
            bookingNumber: booking.bookingNumber,
            serviceType: booking.serviceType.name,
            estimatedEarning: booking.providerEarning,
            pickupLocation: {
              latitude: booking.pickupLatitude,
              longitude: booking.pickupLongitude,
            },
            dropoffLocation: booking.dropoffLatitude
              ? {
                  latitude: booking.dropoffLatitude,
                  longitude: booking.dropoffLongitude,
                }
              : null,
            customerName: `${booking.customer?.firstName} ${booking.customer?.lastName}`,
            estimatedPrice: booking.estimatedPrice,
            distance: driver.distance,
            eta: driver.eta,
            autoRejectIn: 60, // seconds
          },
        })
      }

      // Set auto-reject timer for 60 seconds
      setTimeout(async () => {
        await this.handleBookingTimeout(bookingId)
      }, 60000)

      console.log(`🎯 Closest driver selected: ${availableDrivers[0].driverName}`)
      return availableDrivers[0]
    } catch (error) {
      logger.error("Match driver to booking error:", error)
      throw error
    }
  }
}
