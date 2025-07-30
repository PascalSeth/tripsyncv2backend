import type { Response } from "express"
import type { AuthenticatedRequest, ServiceEstimate } from "../types"
import prisma from "../config/database"
import { BookingService } from "../services/booking.service"
import { PricingService } from "../services/pricing.service"
import { DriverMatchingService } from "../services/driver-matching.service"
import { NotificationService } from "../services/notification.service"
import { TrackingService } from "../services/tracking.service"
import { ServiceZoneService } from "../services/service-zone.service"
import logger from "../utils/logger"
import { LocationService } from "../services/location.service"

export class BookingController {
  private bookingService = new BookingService()
  private pricingService = new PricingService()
  private driverMatchingService = new DriverMatchingService()
  private notificationService = new NotificationService()
  private trackingService = new TrackingService()
  private locationService = new LocationService()
  private serviceZoneService = new ServiceZoneService()

  createBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const bookingData = req.body

      // Create booking based on service type
      const booking = await this.bookingService.createBooking(userId, bookingData)

      res.status(201).json({
        success: true,
        message: "Booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createRideBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // ENHANCED: More detailed authentication debugging
      logger.info("createRideBooking called - Full request context:", {
        hasUser: !!req.user,
        userObject: req.user
          ? {
              id: req.user.id,
              email: req.user.email,
              role: req.user.role,
              isVerified: req.user.isVerified,
              isActive: req.user.isActive,
            }
          : null,
        authHeader: req.headers.authorization ? "Present" : "Missing",
        contentType: req.headers["content-type"],
        userAgent: req.headers["user-agent"],
        requestBody: {
          hasPickupCoords: !!(req.body.pickupLatitude && req.body.pickupLongitude),
          hasDropoffCoords: !!(req.body.dropoffLatitude && req.body.dropoffLongitude),
          rideType: req.body.rideType,
        },
      })

      // FIXED: Better authentication check with detailed logging
      if (!req.user || !req.user.id) {
        logger.error("Authentication failed in createRideBooking:", {
          hasUser: !!req.user,
          userId: req.user?.id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          headers: req.headers.authorization ? "Bearer token present" : "No auth header",
          requestPath: req.path,
          requestMethod: req.method,
        })
        return res.status(401).json({
          success: false,
          message: "User authentication required - please login again",
          debug: {
            hasUser: !!req.user,
            hasUserId: !!req.user?.id,
            authHeaderPresent: !!req.headers.authorization,
          },
        })
      }

      const userId = req.user.id
      const {
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        rideType,
        scheduledAt,
        paymentMethodId,
        notes,
        // FIXED: Remove userId from body since we get it from authenticated user
      } = req.body

      logger.info("Creating ride booking with authenticated user:", {
        userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        rideType,
        pickup: { lat: pickupLatitude, lng: pickupLongitude },
        dropoff: { lat: dropoffLatitude, lng: dropoffLongitude },
      })

      // Check if this is an inter-regional booking
      const interRegionalCheck = await this.serviceZoneService.canCreateInterRegionalBooking(
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
      )

      let booking

      if (interRegionalCheck.canBook && interRegionalCheck.route) {
        // Create inter-regional booking
        booking = await this.createInterRegionalRideBooking({
          userId,
          pickupLatitude,
          pickupLongitude,
          dropoffLatitude,
          dropoffLongitude,
          rideType,
          scheduledAt,
          notes,
          interRegionalData: interRegionalCheck,
        })
      } else {
        // Create regular booking
        booking = await this.createRegularRideBooking({
          userId,
          pickupLatitude,
          pickupLongitude,
          dropoffLatitude,
          dropoffLongitude,
          rideType,
          scheduledAt,
          notes,
        })
      }

      // For immediate bookings, start driver matching process
      if (!scheduledAt) {
        try {
          await this.driverMatchingService.matchDriverToBooking(booking.id)
        } catch (matchingError) {
          logger.error("Driver matching failed:", matchingError)
          // Don't fail the booking creation, just log the error
        }
      }

      res.status(201).json({
        success: true,
        message: interRegionalCheck.route
          ? "Inter-regional ride booking created successfully"
          : "Ride booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create ride booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create ride booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  private async createInterRegionalRideBooking(params: {
    userId: string
    pickupLatitude: number
    pickupLongitude: number
    dropoffLatitude: number
    dropoffLongitude: number
    rideType: string
    scheduledAt?: string
    notes?: string
    interRegionalData: any
  }) {
    const {
      userId,
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      rideType,
      scheduledAt,
      notes,
      interRegionalData,
    } = params

    // Get service estimate with inter-regional pricing
    const estimate = await this.pricingService.calculateRideEstimate({
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      rideType,
    })

    // Add inter-regional fee
    const totalPrice = estimate.estimatedPrice + interRegionalData.additionalFee

    // Create inter-regional booking using service zone service
    const booking = await this.serviceZoneService.createInterRegionalBooking({
      customerId: userId,
      serviceTypeId: await this.getServiceTypeId("RIDE"),
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      originZoneId: interRegionalData.originZone.id,
      destinationZoneId: interRegionalData.destinationZone.id,
      interRegionalFee: interRegionalData.additionalFee,
      estimatedPrice: totalPrice,
      estimatedDistance: estimate.estimatedDistance,
      estimatedDuration: estimate.estimatedDuration,
      requiresApproval: interRegionalData.requiresApproval,
    })

    // Find inter-regional drivers if not requiring approval
    if (!interRegionalData.requiresApproval && !scheduledAt) {
      const availableDrivers = await this.serviceZoneService.findInterRegionalDrivers({
        originZoneId: interRegionalData.originZone.id,
        destinationZoneId: interRegionalData.destinationZone.id,
        latitude: pickupLatitude,
        longitude: pickupLongitude,
        serviceType: rideType,
      })

      // Notify drivers about inter-regional booking
      for (const driver of availableDrivers.slice(0, 3)) {
        await this.notificationService.notifyDriver(driver.driverId, {
          type: "INTER_REGIONAL_BOOKING_REQUEST",
          title: "Inter-Regional Ride Request",
          body: `Inter-regional ${rideType} ride from ${interRegionalData.originZone.name} to ${interRegionalData.destinationZone.name}`,
          data: {
            bookingId: booking.id,
            estimatedEarning: booking.providerEarning,
            distance: estimate.estimatedDistance,
            isInterRegional: true,
            originZone: interRegionalData.originZone.name,
            destinationZone: interRegionalData.destinationZone.name,
            interRegionalFee: interRegionalData.additionalFee,
          },
        })
      }
    }

    return booking
  }

  private async createRegularRideBooking(params: {
    userId: string
    pickupLatitude: number
    pickupLongitude: number
    dropoffLatitude: number
    dropoffLongitude: number
    rideType: string
    scheduledAt?: string
    notes?: string
  }) {
    const { userId, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, rideType, scheduledAt, notes } =
      params

    // Get service estimate
    const estimate = await this.pricingService.calculateRideEstimate({
      pickupLatitude,
      pickupLongitude,
      dropoffLatitude,
      dropoffLongitude,
      rideType,
    })

    // Create ride booking
    const booking = await prisma.booking.create({
      data: {
        bookingNumber: await this.generateBookingNumber(),
        customerId: userId,
        serviceTypeId: await this.getServiceTypeId("RIDE"),
        status: "PENDING",
        type: scheduledAt ? "SCHEDULED" : "IMMEDIATE",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        estimatedDistance: estimate.estimatedDistance,
        estimatedDuration: estimate.estimatedDuration,
        estimatedPrice: estimate.estimatedPrice,
        surgePricing: estimate.surgePricing,
        currency: "GHS",
        serviceData: {
          rideType,
          surgePricing: estimate.surgePricing,
          availableDrivers: estimate.availableProviders,
        },
        notes,
        platformCommission: estimate.estimatedPrice * 0.18,
        providerEarning: estimate.estimatedPrice * 0.82,
      },
      include: {
        serviceType: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    })

    // Find and notify available drivers
    if (!scheduledAt) {
      const availableDrivers = await this.driverMatchingService.findNearbyDrivers({
        latitude: pickupLatitude,
        longitude: pickupLongitude,
        serviceType: rideType,
      })

      // Notify drivers about new booking
      for (const driver of availableDrivers.slice(0, 5)) {
        await this.notificationService.notifyDriver(driver.driverId, {
          type: "NEW_BOOKING_REQUEST",
          title: "New Ride Request",
          body: `New ${rideType} ride request nearby`,
          data: {
            bookingId: booking.id,
            estimatedEarning: booking.providerEarning,
            distance: driver.distance,
          },
        })
      }
    }

    return booking
  }

  createSharedRide = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // ENHANCED: More detailed authentication debugging
      logger.info("createSharedRide called - Full request context:", {
        hasUser: !!req.user,
        userObject: req.user
          ? {
              id: req.user.id,
              email: req.user.email,
              role: req.user.role,
              isVerified: req.user.isVerified,
              isActive: req.user.isActive,
            }
          : null,
        authHeader: req.headers.authorization ? "Present" : "Missing",
      })

      // FIXED: Better authentication check
      if (!req.user || !req.user.id) {
        logger.error("Authentication failed in createSharedRide:", {
          hasUser: !!req.user,
          userId: req.user?.id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          headers: req.headers.authorization ? "Bearer token present" : "No auth header",
          requestPath: req.path,
          requestMethod: req.method,
        })
        return res.status(401).json({
          success: false,
          message: "User authentication required - please login again",
          debug: {
            hasUser: !!req.user,
            hasUserId: !!req.user?.id,
            authHeaderPresent: !!req.headers.authorization,
          },
        })
      }

      const userId = req.user.id
      const {
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        maxWaitTime = 10,
        maxDetour = 5,
        // FIXED: Remove userId from body since we get it from authenticated user
      } = req.body

      logger.info("Creating shared ride booking with authenticated user:", {
        userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        pickup: { lat: pickupLatitude, lng: pickupLongitude },
        dropoff: { lat: dropoffLatitude, lng: dropoffLongitude },
        maxWaitTime,
        maxDetour,
      })

      // Find compatible existing shared rides
      const compatibleRides = await this.findCompatibleSharedRides({
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        maxDetour,
      })

      let booking

      if (compatibleRides.length > 0) {
        // Join existing shared ride
        const sharedRideGroup = (compatibleRides[0].serviceData as any)?.sharedRideGroup

        booking = await prisma.booking.create({
          data: {
            bookingNumber: await this.generateBookingNumber(),
            customerId: userId,
            serviceTypeId: await this.getServiceTypeId("SHARED_RIDE"),
            status: "PENDING",
            type: "IMMEDIATE",
            pickupLatitude,
            pickupLongitude,
            dropoffLatitude,
            dropoffLongitude,
            estimatedPrice: compatibleRides[0].estimatedPrice * 0.7, // 30% discount
            currency: "GHS",
            serviceData: {
              sharedRideGroup,
              isGroupLeader: false,
              maxPassengers: 4,
              estimatedSavings: compatibleRides[0].estimatedPrice * 0.3,
            },
          },
        })

        // Update existing shared ride
        await prisma.booking.update({
          where: { id: compatibleRides[0].id },
          data: {
            serviceData: {
              ...(compatibleRides[0].serviceData as any),
              sharedPassengers: [
                ...((compatibleRides[0].serviceData as any)?.sharedPassengers || []),
                {
                  passengerId: userId,
                  bookingId: booking.id,
                  joinedAt: new Date(),
                },
              ],
            },
          },
        })
      } else {
        // Create new shared ride group
        const sharedRideGroup = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const estimate = await this.pricingService.calculateRideEstimate({
          pickupLatitude,
          pickupLongitude,
          dropoffLatitude,
          dropoffLongitude,
          rideType: "SHARED",
        })

        booking = await prisma.booking.create({
          data: {
            bookingNumber: await this.generateBookingNumber(),
            customerId: userId,
            serviceTypeId: await this.getServiceTypeId("SHARED_RIDE"),
            status: "PENDING",
            type: "IMMEDIATE",
            pickupLatitude,
            pickupLongitude,
            dropoffLatitude,
            dropoffLongitude,
            estimatedPrice: estimate.estimatedPrice,
            currency: "GHS",
            serviceData: {
              sharedRideGroup,
              isGroupLeader: true,
              maxPassengers: 4,
              waitingForMorePassengers: true,
            },
          },
        })
      }

      res.status(201).json({
        success: true,
        message: "Shared ride booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create shared ride error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create shared ride booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createDayBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { scheduledAt, duration, serviceArea, driverId, specialRequirements, contactPhone } = req.body

      // Validate user subscription tier
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId },
      })

      if (!customerProfile || !["PREMIUM", "ENTERPRISE"].includes(customerProfile.subscriptionTier)) {
        return res.status(403).json({
          success: false,
          message: "Day booking requires Premium or Enterprise subscription",
        })
      }

      // Calculate pricing
      const pricing = await this.pricingService.calculateDayBookingPrice({
        duration,
        scheduledAt: new Date(scheduledAt),
        serviceArea,
        driverId,
      })

      // Create day booking
      const booking = await prisma.booking.create({
        data: {
          bookingNumber: await this.generateBookingNumber(),
          customerId: userId,
          providerId: driverId,
          serviceTypeId: await this.getServiceTypeId("DAY_BOOKING"),
          status: "CONFIRMED",
          type: "SCHEDULED",
          scheduledAt: new Date(scheduledAt),
          estimatedPrice: pricing.totalPrice,
          finalPrice: pricing.totalPrice,
          currency: "GHS",
          serviceData: {
            duration,
            serviceArea,
            specialRequirements,
            contactPhone,
            pricingBreakdown: pricing.breakdown,
          },
          platformCommission: pricing.totalPrice * 0.15,
          providerEarning: pricing.totalPrice * 0.85,
        },
        include: {
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      })

      // Notify driver
      await this.notificationService.notifyDriver(driverId, {
        type: "DAY_BOOKING_ASSIGNED",
        title: "New Day Booking",
        body: `You have a new day booking for ${duration} hours`,
        data: {
          bookingId: booking.id,
          scheduledAt,
          duration,
          estimatedEarning: booking.providerEarning,
        },
      })

      res.status(201).json({
        success: true,
        message: "Day booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create day booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create day booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createStoreDelivery = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { storeId, deliveryAddress, orderItems, deliveryInstructions, paymentMethodId } = req.body

      // Get store information
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: {
          location: true,
          products: true,
        },
      })

      if (!store || !store.isActive) {
        return res.status(404).json({
          success: false,
          message: "Store not found or inactive",
        })
      }

      // Calculate order total and delivery fee
      let orderTotal = 0
      const validatedItems = []

      for (const item of orderItems) {
        const product = store.products.find((p) => p.id === item.productId)
        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product ${item.productId} not available`,
          })
        }

        const itemTotal = product.price * item.quantity
        orderTotal += itemTotal
        validatedItems.push({
          productId: product.id,
          name: product.name,
          quantity: item.quantity,
          unitPrice: product.price,
          totalPrice: itemTotal,
        })
      }

      // Calculate delivery fee using delivery estimate
      const deliveryEstimate = await this.pricingService.calculateDeliveryEstimate({
        pickupLatitude: store.location!.latitude,
        pickupLongitude: store.location!.longitude,
        dropoffLatitude: deliveryAddress.latitude,
        dropoffLongitude: deliveryAddress.longitude,
      })

      const totalAmount = orderTotal + deliveryEstimate.estimatedPrice

      // Create store delivery booking
      const booking = await prisma.booking.create({
        data: {
          bookingNumber: await this.generateBookingNumber(),
          customerId: userId,
          serviceTypeId: await this.getServiceTypeId("STORE_DELIVERY"),
          status: "CONFIRMED",
          type: "IMMEDIATE",
          pickupLatitude: store.location!.latitude,
          pickupLongitude: store.location!.longitude,
          dropoffLatitude: deliveryAddress.latitude,
          dropoffLongitude: deliveryAddress.longitude,
          estimatedPrice: totalAmount,
          finalPrice: totalAmount,
          currency: "GHS",
          serviceData: {
            storeId,
            storeName: store.name,
            orderItems: validatedItems,
            deliveryInstructions,
            orderTotal,
            deliveryFee: deliveryEstimate.estimatedPrice,
            preparationTime: 20,
          },
          platformCommission: totalAmount * 0.18,
          providerEarning: deliveryEstimate.estimatedPrice * 0.82,
        },
      })

      // Create order items
      for (const item of validatedItems) {
        await prisma.orderItem.create({
          data: {
            bookingId: booking.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        })
      }

      // Update product stock
      for (const item of orderItems) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        })
      }

      // Notify store owner
      await this.notificationService.notifyCustomer(store.ownerId, {
        type: "NEW_ORDER",
        title: "New Order Received",
        body: `New order worth GH₵${totalAmount}`,
        data: {
          bookingId: booking.id,
          orderTotal: totalAmount,
        },
      })

      res.status(201).json({
        success: true,
        message: "Store delivery booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create store delivery error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create store delivery booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  acceptBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const providerId = req.user!.id

      // Validate booking exists and is pending
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          serviceType: true,
        },
      })

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        })
      }

      if (booking.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          message: "Booking is not available for acceptance",
        })
      }

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          providerId,
          status: "DRIVER_ASSIGNED",
          acceptedAt: new Date(),
        },
        include: {
          customer: true,
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
              driverProfile: {
                select: {
                  rating: true,
                  vehicle: {
                    select: {
                      make: true,
                      model: true,
                      licensePlate: true,
                    },
                  },
                  currentLatitude: true,
                  currentLongitude: true,
                },
              },
            },
          },
          serviceType: true,
        },
      })

      // Calculate ETA for the customer to display
      let estimatedArrivalForCustomer: number | undefined
      if (
        updatedBooking.provider?.driverProfile?.currentLatitude &&
        updatedBooking.provider?.driverProfile?.currentLongitude &&
        updatedBooking.pickupLatitude &&
        updatedBooking.pickupLongitude
      ) {
        const etaResult = await this.locationService.calculateETA(
          updatedBooking.provider.driverProfile.currentLatitude,
          updatedBooking.provider.driverProfile.currentLongitude,
          updatedBooking.pickupLatitude,
          updatedBooking.pickupLongitude,
        )
        estimatedArrivalForCustomer = etaResult.eta
      }

      // Update provider availability
      await this.updateProviderAvailability(providerId, false)

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "BOOKING_ACCEPTED",
        title: "Booking Accepted",
        body: "Your booking has been accepted by a service provider",
        data: {
          bookingId: booking.id,
          providerName: `${updatedBooking.provider?.firstName} ${updatedBooking.provider?.lastName}`,
          providerPhone: updatedBooking.provider?.phone,
          providerAvatar: updatedBooking.provider?.avatar,
          providerRating: updatedBooking.provider?.driverProfile?.rating,
          vehicleMake: updatedBooking.provider?.driverProfile?.vehicle?.make,
          vehicleModel: updatedBooking.provider?.driverProfile?.vehicle?.model,
          licensePlate: updatedBooking.provider?.driverProfile?.vehicle?.licensePlate,
          estimatedArrival: estimatedArrivalForCustomer,
        },
      })

      // Start tracking
      await this.trackingService.startTracking(bookingId, providerId)

      res.json({
        success: true,
        message: "Booking accepted successfully",
        data: updatedBooking,
      })
    } catch (error) {
      logger.error("Accept booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to accept booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  startBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const providerId = req.user!.id

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true },
      })

      if (!booking || booking.providerId !== providerId) {
        return res.status(404).json({
          success: false,
          message: "Booking not found or unauthorized",
        })
      }

      if (booking.status !== "DRIVER_ASSIGNED" && booking.status !== "DRIVER_ARRIVED") {
        return res.status(400).json({
          success: false,
          message: "Booking cannot be started at this time",
        })
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
      await this.trackingService.addTrackingUpdate(bookingId, {
        status: "TRIP_STARTED",
        message: "Service has started",
        latitude: req.body.latitude || 0,
        longitude: req.body.longitude || 0,
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "BOOKING_STARTED",
        title: "Service Started",
        body: "Your service has started",
        data: { bookingId: booking.id },
      })

      res.json({
        success: true,
        message: "Booking started successfully",
        data: updatedBooking,
      })
    } catch (error) {
      logger.error("Start booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to start booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  completeBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const providerId = req.user!.id
      const { actualDistance, actualDuration, finalPrice } = req.body

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          serviceType: true,
        },
      })

      if (!booking || booking.providerId !== providerId) {
        return res.status(404).json({
          success: false,
          message: "Booking not found or unauthorized",
        })
      }

      if (booking.status !== "IN_PROGRESS") {
        return res.status(400).json({
          success: false,
          message: "Booking is not in progress",
        })
      }

      // Calculate final pricing if not provided
      const calculatedFinalPrice = finalPrice || booking.estimatedPrice
      const commission = calculatedFinalPrice * (booking.serviceType.commissionRate || 0.18)
      const providerEarning = calculatedFinalPrice - commission

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          actualDistance,
          actualDuration,
          finalPrice: calculatedFinalPrice,
          platformCommission: commission,
          providerEarning,
        },
      })

      // Update provider availability
      await this.updateProviderAvailability(providerId, true)

      // Process payment
      await this.bookingService.processBookingPayment(bookingId)

      // Update provider stats
      await this.updateProviderStats(providerId, booking.serviceType.name, providerEarning)

      // Add tracking update
      await this.trackingService.addTrackingUpdate(bookingId, {
        status: "COMPLETED",
        message: "Service completed successfully",
        latitude: req.body.latitude || 0,
        longitude: req.body.longitude || 0,
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "BOOKING_COMPLETED",
        title: "Service Completed",
        body: "Your service has been completed successfully",
        data: {
          bookingId: booking.id,
          finalPrice: calculatedFinalPrice,
        },
      })

      res.json({
        success: true,
        message: "Booking completed successfully",
        data: updatedBooking,
      })
    } catch (error) {
      logger.error("Complete booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to complete booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getBookings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { status, serviceType, dateFrom, dateTo, page = 1, limit = 10, role = "customer" } = req.query

      const skip = (Number(page) - 1) * Number(limit)
      const where: any = {}

      if (role === "customer") {
        where.customerId = userId
      } else {
        where.providerId = userId
      }

      if (status) {
        where.status = status
      }

      if (serviceType) {
        where.serviceType = { name: serviceType }
      }

      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = new Date(dateFrom as string)
        if (dateTo) where.createdAt.lte = new Date(dateTo as string)
      }

      const [bookings, total] = await Promise.all([
        prisma.booking.findMany({
          where,
          include: {
            serviceType: true,
            customer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                avatar: true,
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
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: Number(limit),
        }),
        prisma.booking.count({ where }),
      ])

      res.json({
        success: true,
        message: "Bookings retrieved successfully",
        data: bookings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get bookings error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve bookings",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getBookingById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const userId = req.user!.id

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          serviceType: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
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
          trackingUpdates: {
            orderBy: { timestamp: "desc" },
            take: 10,
          },
          orderItems: true,
          transactions: true,
        },
      })

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        })
      }

      // Check if user has access to this booking
      if (booking.customerId !== userId && booking.providerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        })
      }

      res.json({
        success: true,
        message: "Booking retrieved successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Get booking by ID error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getBookingEstimate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serviceType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, rideType, scheduledAt } =
        req.body

      let estimate: ServiceEstimate

      switch (serviceType) {
        case "RIDE":
          estimate = await this.pricingService.calculateRideEstimate({
            pickupLatitude,
            pickupLongitude,
            dropoffLatitude,
            dropoffLongitude,
            rideType,
            scheduledAt,
          })
          break
        case "STORE_DELIVERY":
          estimate = await this.pricingService.calculateDeliveryEstimate({
            pickupLatitude,
            pickupLongitude,
            dropoffLatitude,
            dropoffLongitude,
          })
          break
        default:
          return res.status(400).json({
            success: false,
            message: "Unsupported service type for estimation",
          })
      }

      res.json({
        success: true,
        message: "Estimate calculated successfully",
        data: estimate,
      })
    } catch (error) {
      logger.error("Get booking estimate error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to calculate estimate",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  cancelBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const userId = req.user!.id
      const { reason } = req.body

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: true,
          provider: true,
        },
      })

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        })
      }

      // Check if user can cancel this booking
      if (booking.customerId !== userId && booking.providerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        })
      }

      // Check if booking can be cancelled
      if (!["PENDING", "CONFIRMED", "DRIVER_ASSIGNED"].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: "Booking cannot be cancelled at this stage",
        })
      }

      // Calculate cancellation fee if applicable
      const cancellationFee = await this.calculateCancellationFee(booking, userId)

      // Update booking
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancellationReason: reason,
          cancelledBy: userId,
          cancellationFee,
        },
      })

      // Update provider availability if assigned
      if (booking.providerId) {
        await this.updateProviderAvailability(booking.providerId, true)
      }

      // Notify relevant parties
      const isCustomerCancelling = booking.customerId === userId
      if (isCustomerCancelling && booking.providerId) {
        await this.notificationService.notifyProvider(booking.providerId, {
          type: "BOOKING_CANCELLED",
          title: "Booking Cancelled",
          body: "A booking has been cancelled by the customer",
          data: { bookingId: booking.id, reason },
        })
      } else if (!isCustomerCancelling) {
        await this.notificationService.notifyCustomer(booking.customerId, {
          type: "BOOKING_CANCELLED",
          title: "Booking Cancelled",
          body: "Your booking has been cancelled by the service provider",
          data: { bookingId: booking.id, reason },
        })
      }

      res.json({
        success: true,
        message: "Booking cancelled successfully",
        data: updatedBooking,
      })
    } catch (error) {
      logger.error("Cancel booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to cancel booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getBookingTracking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const userId = req.user!.id

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          trackingUpdates: {
            orderBy: { timestamp: "desc" },
          },
        },
      })

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        })
      }

      // Check access
      if (booking.customerId !== userId && booking.providerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        })
      }

      res.json({
        success: true,
        message: "Tracking data retrieved successfully",
        data: {
          bookingId: booking.id,
          status: booking.status,
          trackingUpdates: booking.trackingUpdates,
        },
      })
    } catch (error) {
      logger.error("Get booking tracking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve tracking data",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateBookingTracking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const providerId = req.user!.id
      const { latitude, longitude, heading, speed, status, message } = req.body

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      })

      if (!booking || booking.providerId !== providerId) {
        return res.status(404).json({
          success: false,
          message: "Booking not found or unauthorized",
        })
      }

      // Add tracking update
      const trackingUpdate = await this.trackingService.addTrackingUpdate(bookingId, {
        latitude,
        longitude,
        heading,
        speed,
        status,
        message,
      })

      res.json({
        success: true,
        message: "Tracking updated successfully",
        data: trackingUpdate,
      })
    } catch (error) {
      logger.error("Update booking tracking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update tracking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createTaxiBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const {
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        taxiZone,
        pricingType = "METERED",
      } = req.body

      // Find available licensed taxi drivers
      const availableTaxis = await this.findAvailableTaxis({
        latitude: pickupLatitude,
        longitude: pickupLongitude,
        radius: 10000,
      })

      if (availableTaxis.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No taxis available in your area",
        })
      }

      // Calculate estimated fare using ride estimate
      const estimatedFare = await this.pricingService.calculateRideEstimate({
        pickupLatitude,
        pickupLongitude,
        dropoffLatitude,
        dropoffLongitude,
        rideType: "TAXI",
      })

      // Create taxi booking
      const booking = await prisma.booking.create({
        data: {
          bookingNumber: `TAXI-${await this.generateTaxiNumber()}`,
          customerId: userId,
          serviceTypeId: await this.getServiceTypeId("TAXI"),
          status: "PENDING",
          type: "IMMEDIATE",
          pickupLatitude,
          pickupLongitude,
          dropoffLatitude,
          dropoffLongitude,
          estimatedPrice: estimatedFare.estimatedPrice,
          currency: "GHS",
          serviceData: {
            taxiZone,
            pricingType,
            regulatoryCompliance: {
              licenseRequired: true,
              meterRequired: pricingType === "METERED",
              receiptRequired: true,
            },
            estimatedWaitTime: Math.min(...availableTaxis.map((t) => t.estimatedArrival)),
          },
        },
      })

      // Dispatch to nearest taxi
      const nearestTaxi = availableTaxis[0]
      await this.dispatchTaxi(booking.id, nearestTaxi.userId)

      res.status(201).json({
        success: true,
        message: "Taxi booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create taxi booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create taxi booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createPackageDelivery = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { pickupAddress, dropoffAddress, packageDetails, recipientInfo, scheduledPickup, deliveryInstructions } =
        req.body

      // Calculate delivery pricing using delivery estimate
      const pricing = await this.pricingService.calculateDeliveryEstimate({
        pickupLatitude: pickupAddress.latitude,
        pickupLongitude: pickupAddress.longitude,
        dropoffLatitude: dropoffAddress.latitude,
        dropoffLongitude: dropoffAddress.longitude,
      })

      // Create package delivery booking
      const booking = await prisma.booking.create({
        data: {
          bookingNumber: await this.generateBookingNumber(),
          customerId: userId,
          serviceTypeId: await this.getServiceTypeId("PACKAGE_DELIVERY"),
          status: "CONFIRMED",
          type: scheduledPickup ? "SCHEDULED" : "IMMEDIATE",
          scheduledAt: scheduledPickup ? new Date(scheduledPickup) : null,
          pickupLatitude: pickupAddress.latitude,
          pickupLongitude: pickupAddress.longitude,
          dropoffLatitude: dropoffAddress.latitude,
          dropoffLongitude: dropoffAddress.longitude,
          estimatedPrice: pricing.estimatedPrice,
          finalPrice: pricing.estimatedPrice,
          currency: "GHS",
          serviceData: {
            packageDetails,
            recipientInfo,
            deliveryInstructions,
            trackingNumber: this.generateTrackingNumber(),
            requiresSignature: packageDetails.requiresSignature || false,
            isFragile: packageDetails.isFragile || false,
          },
        },
      })

      res.status(201).json({
        success: true,
        message: "Package delivery booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create package delivery error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create package delivery booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createFoodDelivery = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { restaurantId, deliveryAddress, orderItems, deliveryInstructions, paymentMethodId } = req.body

      // Get restaurant information from store (assuming restaurants are stores)
      const restaurant = await prisma.store.findUnique({
        where: { id: restaurantId },
        include: {
          location: true,
          products: true, // Using products as menu items
        },
      })

      if (!restaurant || !restaurant.isActive) {
        return res.status(404).json({
          success: false,
          message: "Restaurant not found or inactive",
        })
      }

      // Validate and calculate order total
      let orderTotal = 0
      const validatedItems = []

      for (const item of orderItems) {
        const menuItem = restaurant.products.find((mi: any) => mi.id === item.menuItemId)
        if (!menuItem) {
          return res.status(400).json({
            success: false,
            message: `Menu item ${item.menuItemId} not available`,
          })
        }

        const itemTotal = menuItem.price * item.quantity
        orderTotal += itemTotal
        validatedItems.push({
          menuItemId: menuItem.id,
          name: menuItem.name,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          totalPrice: itemTotal,
          specialInstructions: item.specialInstructions,
        })
      }

      // Calculate delivery fee using delivery estimate
      const deliveryEstimate = await this.pricingService.calculateDeliveryEstimate({
        pickupLatitude: restaurant.location!.latitude,
        pickupLongitude: restaurant.location!.longitude,
        dropoffLatitude: deliveryAddress.latitude,
        dropoffLongitude: deliveryAddress.longitude,
      })

      const totalAmount = orderTotal + deliveryEstimate.estimatedPrice

      // Create food delivery booking
      const booking = await prisma.booking.create({
        data: {
          bookingNumber: await this.generateBookingNumber(),
          customerId: userId,
          serviceTypeId: await this.getServiceTypeId("FOOD_DELIVERY"),
          status: "CONFIRMED",
          type: "IMMEDIATE",
          pickupLatitude: restaurant.location!.latitude,
          pickupLongitude: restaurant.location!.longitude,
          dropoffLatitude: deliveryAddress.latitude,
          dropoffLongitude: deliveryAddress.longitude,
          estimatedPrice: totalAmount,
          finalPrice: totalAmount,
          currency: "GHS",
          serviceData: {
            restaurantId,
            restaurantName: restaurant.name,
            orderItems: validatedItems,
            deliveryInstructions,
            orderTotal,
            deliveryFee: deliveryEstimate.estimatedPrice,
            preparationTime: 25,
          },
        },
      })

      // Create order items
      for (const item of validatedItems) {
        await prisma.orderItem.create({
          data: {
            bookingId: booking.id,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            instructions: item.specialInstructions,
            totalPrice: item.totalPrice,
          },
        })
      }

      // Notify restaurant
      await this.notificationService.notifyCustomer(restaurant.ownerId, {
        type: "NEW_FOOD_ORDER",
        title: "New Food Order",
        body: `New order worth GH₵${totalAmount}`,
        data: {
          bookingId: booking.id,
          orderTotal: totalAmount,
          preparationTime: 25,
        },
      })

      res.status(201).json({
        success: true,
        message: "Food delivery booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create food delivery error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create food delivery booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createHouseMoving = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const {
        pickupAddress,
        dropoffAddress,
        movingDate,
        inventoryItems,
        serviceTier,
        specialRequirements,
        movingCompanyId,
      } = req.body

      // Calculate comprehensive pricing using day booking price
      const pricing = await this.pricingService.calculateDayBookingPrice({
        duration: 8, // Assume 8 hours for moving
        scheduledAt: new Date(movingDate),
        serviceArea: "CITY",
        driverId: movingCompanyId,
      })

      // Create house moving booking
      const booking = await prisma.booking.create({
        data: {
          bookingNumber: await this.generateBookingNumber(),
          customerId: userId,
          providerId: movingCompanyId,
          serviceTypeId: await this.getServiceTypeId("HOUSE_MOVING"),
          status: "CONFIRMED",
          type: "SCHEDULED",
          scheduledAt: new Date(movingDate),
          pickupLatitude: pickupAddress.latitude,
          pickupLongitude: pickupAddress.longitude,
          dropoffLatitude: dropoffAddress.latitude,
          dropoffLongitude: dropoffAddress.longitude,
          estimatedPrice: pricing.totalPrice,
          finalPrice: pricing.totalPrice,
          currency: "GHS",
          serviceData: {
            serviceTier,
            specialRequirements,
            inventorySummary: inventoryItems.length,
            pricingBreakdown: pricing.breakdown,
            estimatedDuration: 8,
            crewSize: 4,
            truckSize: "LARGE",
          },
        },
      })

      // Notify moving company
      await this.notificationService.notifyCustomer(movingCompanyId, {
        type: "NEW_MOVING_JOB",
        title: "New Moving Job Assigned",
        body: `New moving job scheduled for ${new Date(movingDate).toDateString()}`,
        data: {
          bookingId: booking.id,
          movingDate,
          estimatedValue: pricing.totalPrice,
        },
      })

      res.status(201).json({
        success: true,
        message: "House moving booking created successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Create house moving error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create house moving booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Helper methods
  private async generateBookingNumber(): Promise<string> {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 5).toUpperCase()
    return `TRP${timestamp}${random}`
  }

  private async generateTaxiNumber(): Promise<string> {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 4).toUpperCase()
    return `${timestamp}${random}`
  }

  private generateTrackingNumber(): string {
    const timestamp = Date.now().toString()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `TRK${timestamp}${random}`
  }

  private async getServiceTypeId(serviceName: string): Promise<string> {
    const serviceType = await prisma.serviceType.findUnique({
      where: { name: serviceName },
    })
    if (!serviceType) {
      throw new Error(`Service type ${serviceName} not found`)
    }
    return serviceType.id
  }

  private async updateProviderAvailability(providerId: string, isAvailable: boolean): Promise<void> {
    // Update driver profile
    await prisma.driverProfile.updateMany({
      where: { userId: providerId },
      data: { isAvailable },
    })

    // Update delivery profile
    await prisma.deliveryProfile.updateMany({
      where: { userId: providerId },
      data: { isAvailable },
    })

    // Update mover profile
    await prisma.moverProfile.updateMany({
      where: { userId: providerId },
      data: { isAvailable },
    })
  }

  private async updateProviderStats(providerId: string, serviceType: string, earning: number): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

    switch (serviceType) {
      case "RIDE":
      case "TAXI":
        await prisma.driverProfile.updateMany({
          where: { userId: providerId },
          data: {
            totalRides: { increment: 1 },
            totalEarnings: { increment: earning },
            monthlyEarnings: { increment: earning },
            monthlyCommissionDue: { increment: earning * 0.18 },
          },
        })

        // Create driver earning record
        const driverProfile = await prisma.driverProfile.findFirst({
          where: { userId: providerId },
        })
        if (driverProfile) {
          await prisma.driverEarning.create({
            data: {
              driverProfileId: driverProfile.id,
              amount: earning,
              commission: earning * 0.18,
              netEarning: earning * 0.82,
              date: new Date(),
              weekStarting: this.getWeekStart(new Date()),
              monthYear: currentMonth,
            },
          })
        }
        break

      case "STORE_DELIVERY":
      case "FOOD_DELIVERY":
      case "PACKAGE_DELIVERY":
        await prisma.deliveryProfile.updateMany({
          where: { userId: providerId },
          data: {
            totalDeliveries: { increment: 1 },
            totalEarnings: { increment: earning },
            monthlyEarnings: { increment: earning },
            monthlyCommissionDue: { increment: earning * 0.18 },
          },
        })

        // Create delivery earning record
        const deliveryProfile = await prisma.deliveryProfile.findFirst({
          where: { userId: providerId },
        })
        if (deliveryProfile) {
          await prisma.deliveryEarning.create({
            data: {
              deliveryProfileId: deliveryProfile.id,
              amount: earning,
              commission: earning * 0.18,
              netEarning: earning * 0.82,
              date: new Date(),
              weekStarting: this.getWeekStart(new Date()),
              monthYear: currentMonth,
            },
          })
        }
        break

      case "HOUSE_MOVING":
        await prisma.moverProfile.updateMany({
          where: { userId: providerId },
          data: {
            totalMoves: { increment: 1 },
            totalEarnings: { increment: earning },
            monthlyEarnings: { increment: earning },
            monthlyCommissionDue: { increment: earning * 0.18 },
          },
        })

        // Create mover earning record
        const moverProfile = await prisma.moverProfile.findFirst({
          where: { userId: providerId },
        })
        if (moverProfile) {
          await prisma.moverEarning.create({
            data: {
              moverProfileId: moverProfile.id,
              amount: earning,
              commission: earning * 0.18,
              netEarning: earning * 0.82,
              date: new Date(),
              weekStarting: this.getWeekStart(new Date()),
              monthYear: currentMonth,
            },
          })
        }
        break
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

  private async calculateCancellationFee(booking: any, cancelledBy: string): Promise<number> {
    // No fee for cancellations before driver assignment
    if (booking.status === "PENDING") {
      return 0
    }

    // Customer cancellation after driver assignment
    if (booking.customerId === cancelledBy && booking.status === "DRIVER_ASSIGNED") {
      return booking.estimatedPrice * 0.1 // 10% cancellation fee
    }

    // Provider cancellation - no fee to customer
    return 0
  }

  private async findCompatibleSharedRides(params: {
    pickupLatitude: number
    pickupLongitude: number
    dropoffLatitude: number
    dropoffLongitude: number
    maxDetour: number
  }): Promise<any[]> {
    // Implementation for finding compatible shared rides
    const compatibleRides = await prisma.booking.findMany({
      where: {
        serviceType: { name: "SHARED_RIDE" },
        status: "PENDING",
        createdAt: { gte: new Date(Date.now() - 20 * 60 * 1000) }, // Last 20 minutes
      },
      include: { serviceType: true },
    })

    // Filter by distance compatibility
    return compatibleRides.filter((ride) => {
      const pickupDistance = this.calculateDistance(
        params.pickupLatitude,
        params.pickupLongitude,
        ride.pickupLatitude!,
        ride.pickupLongitude!,
      )
      const dropoffDistance = this.calculateDistance(
        params.dropoffLatitude,
        params.dropoffLongitude,
        ride.dropoffLatitude!,
        ride.dropoffLongitude!,
      )
      return pickupDistance <= 3000 && dropoffDistance <= params.maxDetour * 1000 // Convert km to meters
    })
  }

  private async findAvailableTaxis(params: {
    latitude: number
    longitude: number
    radius: number
  }): Promise<any[]> {
    // Implementation for finding available licensed taxis
    const availableTaxis = await prisma.driverProfile.findMany({
      where: {
        isAvailable: true,
        isOnline: true,
        isVerified: true,
        user: {
          role: "DRIVER",
        },
      },
      include: {
        user: true,
        vehicle: true,
      },
    })

    // Filter by distance and add estimated arrival time
    return availableTaxis
      .map((taxi) => {
        const distance = this.calculateDistance(
          params.latitude,
          params.longitude,
          taxi.currentLatitude || 0,
          taxi.currentLongitude || 0,
        )
        return {
          ...taxi,
          distance,
          estimatedArrival: Math.ceil(distance / 500), // Assuming 30km/h average speed
        }
      })
      .filter((taxi) => taxi.distance <= params.radius)
      .sort((a, b) => a.distance - b.distance)
  }

  private async dispatchTaxi(bookingId: string, driverId: string): Promise<void> {
    // Update booking with assigned driver
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        providerId: driverId,
        status: "DRIVER_ASSIGNED",
        acceptedAt: new Date(),
      },
    })

    // Update driver availability
    await prisma.driverProfile.updateMany({
      where: { userId: driverId },
      data: {
        isAvailable: false,
      },
    })
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }
}
