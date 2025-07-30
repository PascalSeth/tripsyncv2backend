import prisma from "../config/database"
import { LocationService } from "./location.service"
import { NotificationService } from "./notification.service"
import { PaymentService } from "./payment.service"
import logger from "../utils/logger"
import { NotificationType, PriorityLevel } from "@prisma/client"

export class DispatchRiderService {
  private locationService = new LocationService()
  private notificationService = new NotificationService()
  private paymentService = new PaymentService()

  async onboardDispatchRider(userId: string, onboardingData: any) {
    try {
      // Check if user exists - THIS CONFIRMS WE USE EXISTING USER
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        throw new Error("User not found")
      }

      // Check if user already has a delivery profile
      const existingProfile = await prisma.deliveryProfile.findUnique({
        where: { userId },
      })

      if (existingProfile) {
        throw new Error("User already has a delivery profile")
      }

      // Update user role to DRIVER (since DISPATCH_RIDER doesn't exist in enum)
      await prisma.user.update({
        where: { id: userId },
        data: { role: "DRIVER" },
      })

      // Create delivery profile - Fixed acceptsCard to acceptsCash
      const deliveryProfile = await prisma.deliveryProfile.create({
        data: {
          userId,
          licenseNumber: onboardingData.licenseNumber,
          licenseExpiry: onboardingData.licenseExpiry ? new Date(onboardingData.licenseExpiry) : undefined,
          licenseClass: onboardingData.licenseClass,
          deliveryZones: onboardingData.deliveryZones ? JSON.stringify(onboardingData.deliveryZones) : undefined,
          maxDeliveryDistance: onboardingData.maxDeliveryDistance || 50000, // 50km default
          vehicleType: onboardingData.vehicleType || "MOTORCYCLE",
          operatingHours: onboardingData.operatingHours ? JSON.stringify(onboardingData.operatingHours) : undefined,
          acceptsCash: onboardingData.acceptsCash ?? true,
          isVerified: false,
          verificationStatus: "PENDING",
          isAvailable: false,
          isOnline: false,
          totalDeliveries: 0,
          totalEarnings: 0,
          monthlyEarnings: 0,
          monthlyCommissionDue: 0,
          rating: 5.0,
          insurancePolicyNumber: onboardingData.insurancePolicyNumber,
          insuranceExpiry: onboardingData.insuranceExpiry ? new Date(onboardingData.insuranceExpiry) : undefined,
        },
      })

      // Add vehicle if provided
      if (onboardingData.vehicleInfo) {
        const vehicle = await prisma.vehicle.create({
          data: {
            ...onboardingData.vehicleInfo,
            type: onboardingData.vehicleType || "MOTORCYCLE",
            category: "DELIVERY",
          },
        })

        await prisma.deliveryProfile.update({
          where: { id: deliveryProfile.id },
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

      // Send welcome notification
      await this.notificationService.notifyCustomer(userId, {
        type: NotificationType.WELCOME,
        title: "Welcome to TripSync Delivery!",
        body: "Your dispatch rider profile has been created. Please upload required documents for verification.",
        priority: PriorityLevel.STANDARD,
      })

      return deliveryProfile
    } catch (error) {
      logger.error("Onboard dispatch rider error:", error)
      throw error
    }
  }

  async updateProfile(userId: string, updateData: any) {
    try {
      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId },
      })

      if (!deliveryProfile) {
        throw new Error("Delivery profile not found")
      }

      const updatedProfile = await prisma.deliveryProfile.update({
        where: { userId },
        data: {
          deliveryZones: updateData.deliveryZones ? JSON.stringify(updateData.deliveryZones) : undefined,
          maxDeliveryDistance: updateData.maxDeliveryDistance,
          vehicleType: updateData.vehicleType,
          operatingHours: updateData.operatingHours ? JSON.stringify(updateData.operatingHours) : undefined,
          acceptsCash: updateData.acceptsCash,
          insurancePolicyNumber: updateData.insurancePolicyNumber,
          insuranceExpiry: updateData.insuranceExpiry ? new Date(updateData.insuranceExpiry) : undefined,
        },
      })

      return updatedProfile
    } catch (error) {
      logger.error("Update delivery profile error:", error)
      throw error
    }
  }

  async getProfile(userId: string) {
    try {
      const profile = await prisma.deliveryProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
              bankName: true,
              bankAccountNumber: true,
              bankAccountName: true,
            },
          },
          vehicle: true,
          documents: true,
        },
      })

      if (!profile) {
        throw new Error("Delivery profile not found")
      }

      return profile
    } catch (error) {
      logger.error("Get delivery profile error:", error)
      throw error
    }
  }

  async addVehicle(userId: string, vehicleData: any) {
    try {
      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId },
      })

      if (!deliveryProfile) {
        throw new Error("Delivery profile not found")
      }

      const vehicle = await prisma.vehicle.create({
        data: {
          ...vehicleData,
          category: "DELIVERY",
        },
      })

      // Link vehicle to delivery profile
      await prisma.deliveryProfile.update({
        where: { id: deliveryProfile.id },
        data: { vehicleId: vehicle.id },
      })

      return vehicle
    } catch (error) {
      logger.error("Add delivery vehicle error:", error)
      throw error
    }
  }

  async updateVehicle(userId: string, vehicleId: string, updateData: any) {
    try {
      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId },
      })

      if (!deliveryProfile || deliveryProfile.vehicleId !== vehicleId) {
        throw new Error("Vehicle not found or not owned by dispatch rider")
      }

      const vehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: updateData,
      })

      return vehicle
    } catch (error) {
      logger.error("Update delivery vehicle error:", error)
      throw error
    }
  }

  async getVehicles(userId: string) {
    try {
      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId },
        include: {
          vehicle: true,
        },
      })

      if (!deliveryProfile) {
        throw new Error("Delivery profile not found")
      }

      return deliveryProfile.vehicle ? [deliveryProfile.vehicle] : []
    } catch (error) {
      logger.error("Get delivery vehicles error:", error)
      throw error
    }
  }

  async uploadDocument(userId: string, documentData: any) {
    try {
      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId },
      })

      if (!deliveryProfile) {
        throw new Error("Delivery profile not found")
      }

      const document = await prisma.deliveryDocument.create({
        data: {
          deliveryProfileId: deliveryProfile.id,
          type: documentData.documentType,
          documentNumber: documentData.documentNumber,
          documentUrl: documentData.documentUrl,
          expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate) : null,
          status: "PENDING",
        },
      })

      return document
    } catch (error) {
      logger.error("Upload delivery document error:", error)
      throw error
    }
  }

  async getDocuments(userId: string) {
    try {
      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId },
        include: {
          documents: true,
        },
      })

      if (!deliveryProfile) {
        throw new Error("Delivery profile not found")
      }

      return deliveryProfile.documents
    } catch (error) {
      logger.error("Get delivery documents error:", error)
      throw error
    }
  }

  async updateAvailability(userId: string, availabilityData: any) {
    try {
      const profile = await prisma.deliveryProfile.update({
        where: { userId },
        data: {
          isAvailable: availabilityData.isAvailable,
          isOnline: availabilityData.isOnline,
          currentLatitude: availabilityData.currentLatitude,
          currentLongitude: availabilityData.currentLongitude,
        },
      })

      return profile
    } catch (error) {
      logger.error("Update delivery availability error:", error)
      throw error
    }
  }

  async updateLocation(userId: string, locationData: any) {
    try {
      await prisma.deliveryProfile.update({
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
    } catch (error) {
      logger.error("Update delivery location error:", error)
      throw error
    }
  }

  async getDeliveryRequests(userId: string, filters: any) {
    try {
      const { status = "PENDING", page = 1, limit = 20 } = filters
      const skip = (page - 1) * limit

      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId },
      })

      if (!deliveryProfile) {
        throw new Error("Delivery profile not found")
      }

      // Find delivery requests within the rider's delivery zones
      const where: any = {
        status,
        dispatchRiderId: null, // Not yet assigned
      }

      const [deliveryRequests, total] = await Promise.all([
        prisma.delivery.findMany({
          where,
          include: {
            order: {
              include: {
                customer: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                    avatar: true,
                  },
                },
                store: {
                  select: {
                    name: true,
                    contactPhone: true,
                  },
                },
                orderItems: true,
              },
            },
            pickupLocation: true,
            deliveryLocation: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.delivery.count({ where }),
      ])

      // Filter by distance if rider has location
      let filteredRequests = deliveryRequests
      if (deliveryProfile.currentLatitude && deliveryProfile.currentLongitude) {
        filteredRequests = deliveryRequests.filter((request) => {
          const distance = this.locationService.calculateDistance(
            deliveryProfile.currentLatitude!,
            deliveryProfile.currentLongitude!,
            request.pickupLocation.latitude,
            request.pickupLocation.longitude,
          )

          return distance <= (deliveryProfile.maxDeliveryDistance || 50000)
        })
      }

      return {
        deliveryRequests: filteredRequests,
        pagination: {
          page,
          limit,
          total: filteredRequests.length,
          totalPages: Math.ceil(filteredRequests.length / limit),
        },
      }
    } catch (error) {
      logger.error("Get delivery requests error:", error)
      throw error
    }
  }

  async acceptDeliveryRequest(dispatchRiderId: string, deliveryId: string) {
    try {
      // Get delivery profile
      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId: dispatchRiderId },
        include: { vehicle: true },
      })

      if (!deliveryProfile || !deliveryProfile.isVerified || !deliveryProfile.isAvailable) {
        throw new Error("Dispatch rider not available or not verified")
      }

      // Get delivery
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          order: {
            include: {
              customer: true,
              store: true,
            },
          },
          pickupLocation: true,
          deliveryLocation: true,
        },
      })

      if (!delivery || delivery.status !== "PENDING") {
        throw new Error("Delivery not available for acceptance")
      }

      // Check distance
      if (deliveryProfile.currentLatitude && deliveryProfile.currentLongitude) {
        const distance = this.locationService.calculateDistance(
          deliveryProfile.currentLatitude,
          deliveryProfile.currentLongitude,
          delivery.pickupLocation.latitude,
          delivery.pickupLocation.longitude,
        )

        if (distance > (deliveryProfile.maxDeliveryDistance || 50000)) {
          throw new Error("Delivery location is outside your delivery range")
        }
      }

      // Update delivery
      const updatedDelivery = await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          dispatchRiderId,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
        include: {
          order: {
            include: {
              customer: true,
              store: true,
            },
          },
          dispatchRider: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  avatar: true,
                },
              },
              vehicle: true,
            },
          },
        },
      })

      // Update delivery profile availability
      await prisma.deliveryProfile.update({
        where: { id: deliveryProfile.id },
        data: {
          isAvailable: false,
        },
      })

      // Calculate ETA to pickup
      const eta = await this.calculateETA(
        deliveryProfile.currentLatitude!,
        deliveryProfile.currentLongitude!,
        delivery.pickupLocation.latitude,
        delivery.pickupLocation.longitude,
      )

      // Notify store owner
      if (delivery.order.store?.ownerId) {
        await this.notificationService.notifyCustomer(delivery.order.store.ownerId, {
          type: NotificationType.DISPATCH_RIDER_ASSIGNED,
          title: "Dispatch Rider Assigned",
          body: `${updatedDelivery.dispatchRider?.user.firstName} has been assigned to pick up order #${delivery.order.orderNumber}. ETA: ${eta} minutes`,
          data: {
            deliveryId: delivery.id,
            orderId: delivery.orderId,
            dispatchRiderName: `${updatedDelivery.dispatchRider?.user.firstName} ${updatedDelivery.dispatchRider?.user.lastName}`,
            dispatchRiderPhone: updatedDelivery.dispatchRider?.user.phone,
            eta,
            vehicleInfo: deliveryProfile.vehicle,
          },
          priority: PriorityLevel.STANDARD,
        })
      }

      // Notify customer
      await this.notificationService.notifyCustomer(delivery.order.customerId, {
        type: NotificationType.DISPATCH_RIDER_ASSIGNED,
        title: "Your Order is Being Prepared",
        body: `${updatedDelivery.dispatchRider?.user.firstName} will deliver your order once it's ready for pickup.`,
        data: {
          deliveryId: delivery.id,
          orderId: delivery.orderId,
          dispatchRiderName: `${updatedDelivery.dispatchRider?.user.firstName} ${updatedDelivery.dispatchRider?.user.lastName}`,
          dispatchRiderPhone: updatedDelivery.dispatchRider?.user.phone,
          vehicleInfo: deliveryProfile.vehicle,
        },
        priority: PriorityLevel.STANDARD,
      })

      // Start tracking
      await this.startDeliveryTracking(deliveryId, dispatchRiderId)

      return updatedDelivery
    } catch (error) {
      logger.error("Accept delivery request error:", error)
      throw error
    }
  }

  async rejectDeliveryRequest(dispatchRiderId: string, deliveryId: string, reason?: string) {
    try {
      // Log rejection for analytics
      await prisma.deliveryRejection.create({
        data: {
          deliveryId,
          dispatchRiderId,
          reason: reason || "No reason provided",
          rejectedAt: new Date(),
        },
      })

      // Find next available dispatch rider
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          pickupLocation: true,
        },
      })

      if (delivery) {
        await this.findAndNotifyNextDispatchRider(delivery)
      }

      return { success: true }
    } catch (error) {
      logger.error("Reject delivery request error:", error)
      throw error
    }
  }

  async startPickup(dispatchRiderId: string, deliveryId: string) {
    try {
      const delivery = await prisma.delivery.findFirst({
        where: {
          id: deliveryId,
          dispatchRiderId,
          status: "ASSIGNED",
        },
        include: {
          order: {
            include: {
              customer: true,
              store: true,
            },
          },
        },
      })

      if (!delivery) {
        throw new Error("Delivery not found or invalid status")
      }

      // Update delivery status
      const updatedDelivery = await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: "PICKUP_IN_PROGRESS",
          pickupStartedAt: new Date(),
        },
      })

      // Add tracking update
      await prisma.deliveryTracking.create({
        data: {
          deliveryId,
          latitude: 0, // Will be updated with actual location
          longitude: 0,
          status: "PICKUP_STARTED",
          message: "Dispatch rider is heading to pickup location",
          timestamp: new Date(),
        },
      })

      // Notify store and customer
      if (delivery.order.store?.ownerId) {
        await this.notificationService.notifyCustomer(delivery.order.store.ownerId, {
          type: NotificationType.PICKUP_STARTED,
          title: "Pickup Started",
          body: "The dispatch rider is on the way to pick up the order",
          data: { deliveryId },
          priority: PriorityLevel.STANDARD,
        })
      }

      await this.notificationService.notifyCustomer(delivery.order.customerId, {
        type: NotificationType.PICKUP_STARTED,
        title: "Pickup Started",
        body: "Your order is being picked up from the store",
        data: { deliveryId },
        priority: PriorityLevel.STANDARD,
      })

      return updatedDelivery
    } catch (error) {
      logger.error("Start pickup error:", error)
      throw error
    }
  }

  async confirmPickup(dispatchRiderId: string, deliveryId: string, confirmationData: any) {
    try {
      const delivery = await prisma.delivery.findFirst({
        where: {
          id: deliveryId,
          dispatchRiderId,
          status: "PICKUP_IN_PROGRESS",
        },
        include: {
          order: {
            include: {
              customer: true,
              store: true,
            },
          },
        },
      })

      if (!delivery) {
        throw new Error("Delivery not found or invalid status")
      }

      // Update delivery status
      const updatedDelivery = await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: "PICKED_UP",
          pickedUpAt: new Date(),
          pickupNotes: confirmationData.notes,
          pickupPhoto: confirmationData.photo,
        },
      })

      // Add tracking update
      await prisma.deliveryTracking.create({
        data: {
          deliveryId,
          latitude: confirmationData.latitude || 0,
          longitude: confirmationData.longitude || 0,
          status: "PICKUP_COMPLETED",
          message: "Order has been picked up from the store",
          timestamp: new Date(),
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(delivery.order.customerId, {
        type: NotificationType.ORDER_PICKED_UP,
        title: "Order Picked Up",
        body: "Your order has been picked up and is on the way to you",
        data: { deliveryId },
        priority: PriorityLevel.STANDARD,
      })

      return updatedDelivery
    } catch (error) {
      logger.error("Confirm pickup error:", error)
      throw error
    }
  }

  async startDelivery(dispatchRiderId: string, deliveryId: string) {
    try {
      const delivery = await prisma.delivery.findFirst({
        where: {
          id: deliveryId,
          dispatchRiderId,
          status: "PICKED_UP",
        },
        include: {
          order: {
            include: {
              customer: true,
            },
          },
        },
      })

      if (!delivery) {
        throw new Error("Delivery not found or invalid status")
      }

      // Update delivery status
      const updatedDelivery = await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: "IN_TRANSIT",
          deliveryStartedAt: new Date(),
        },
      })

      // Add tracking update
      await prisma.deliveryTracking.create({
        data: {
          deliveryId,
          latitude: 0, // Will be updated with actual location
          longitude: 0,
          status: "DELIVERY_STARTED",
          message: "Order is on the way to delivery location",
          timestamp: new Date(),
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(delivery.order.customerId, {
        type: NotificationType.DELIVERY_STARTED,
        title: "Order On The Way",
        body: "Your order is on the way to your delivery location",
        data: { deliveryId },
        priority: PriorityLevel.STANDARD,
      })

      return updatedDelivery
    } catch (error) {
      logger.error("Start delivery error:", error)
      throw error
    }
  }

  async completeDelivery(dispatchRiderId: string, deliveryId: string, completionData: any) {
    try {
      const delivery = await prisma.delivery.findFirst({
        where: {
          id: deliveryId,
          dispatchRiderId,
          status: "IN_TRANSIT",
        },
        include: {
          order: {
            include: {
              customer: true,
              store: true,
            },
          },
        },
      })

      if (!delivery) {
        throw new Error("Delivery not found or invalid status")
      }

      const deliveryFee = delivery.deliveryFee || 0
      const commission = deliveryFee * 0.15 // 15% commission
      const riderEarning = deliveryFee - commission

      // Update delivery
      const updatedDelivery = await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: "DELIVERED",
          deliveredAt: new Date(),
          deliveryNotes: completionData.notes,
          deliveryPhoto: completionData.photo,
          customerSignature: completionData.signature,
          recipientName: completionData.recipientName,
          finalDeliveryFee: deliveryFee,
          dispatchRiderEarning: riderEarning,
          platformCommission: commission,
        },
      })

      // Update order status
      await prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: "DELIVERED" },
      })

      // Update delivery profile stats and availability
      const deliveryProfile = await prisma.deliveryProfile.findUnique({
        where: { userId: dispatchRiderId },
      })

      if (deliveryProfile) {
        await prisma.deliveryProfile.update({
          where: { id: deliveryProfile.id },
          data: {
            isAvailable: true,
            totalDeliveries: { increment: 1 },
            totalEarnings: { increment: riderEarning },
            monthlyEarnings: { increment: riderEarning },
            monthlyCommissionDue: { increment: commission },
          },
        })

        // Create earning record
        await prisma.deliveryEarning.create({
          data: {
            deliveryProfileId: deliveryProfile.id,
            deliveryId,
            amount: riderEarning,
            commission,
            netEarning: riderEarning,
            date: new Date(),
            weekStarting: this.getWeekStart(new Date()),
            monthYear: new Date().toISOString().slice(0, 7),
          },
        })
      }

      // Add final tracking update
      await prisma.deliveryTracking.create({
        data: {
          deliveryId,
          latitude: completionData.latitude || 0,
          longitude: completionData.longitude || 0,
          status: "DELIVERY_COMPLETED",
          message: "Order has been delivered successfully",
          timestamp: new Date(),
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(delivery.order.customerId, {
        type: NotificationType.ORDER_DELIVERED,
        title: "Order Delivered",
        body: "Your order has been delivered successfully",
        data: {
          deliveryId,
          orderId: delivery.orderId,
          recipientName: completionData.recipientName,
        },
        priority: PriorityLevel.STANDARD,
      })

      return updatedDelivery
    } catch (error) {
      logger.error("Complete delivery error:", error)
      throw error
    }
  }

  async reportIssue(dispatchRiderId: string, deliveryId: string, issueData: any) {
    try {
      const issue = await prisma.deliveryIssue.create({
        data: {
          deliveryId,
          dispatchRiderId,
          issueType: issueData.issueType,
          description: issueData.description,
          severity: issueData.severity || "MEDIUM",
          location: issueData.location ? JSON.stringify(issueData.location) : null,
          photos: issueData.photos ? JSON.stringify(issueData.photos) : null,
          status: "REPORTED",
        },
      })

      // Notify admin
      await this.notificationService.notifyAdmins({
        type: NotificationType.DELIVERY_ISSUE_REPORTED,
        title: "Delivery Issue Reported",
        body: `Issue reported for delivery ${deliveryId}: ${issueData.issueType}`,
        data: {
          deliveryId,
          issueId: issue.id,
          issueType: issueData.issueType,
          severity: issueData.severity,
        },
        priority: issueData.severity === "HIGH" ? PriorityLevel.URGENT : PriorityLevel.STANDARD,
      })

      return issue
    } catch (error) {
      logger.error("Report delivery issue error:", error)
      throw error
    }
  }

  async getDispatchRiderDeliveries(dispatchRiderId: string, filters: any) {
    try {
      const { status, page = 1, limit = 20, dateFrom, dateTo } = filters
      const skip = (page - 1) * limit

      const where: any = { dispatchRiderId }
      if (status) where.status = status
      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = new Date(dateFrom)
        if (dateTo) where.createdAt.lte = new Date(dateTo)
      }

      const [deliveries, total] = await Promise.all([
        prisma.delivery.findMany({
          where,
          include: {
            order: {
              include: {
                customer: {
                  select: {
                    firstName: true,
                    lastName: true,
                    phone: true,
                    avatar: true,
                  },
                },
                store: {
                  select: {
                    name: true,
                    contactPhone: true,
                  },
                },
                orderItems: true,
              },
            },
            pickupLocation: true,
            deliveryLocation: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.delivery.count({ where }),
      ])

      return {
        deliveries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get dispatch rider deliveries error:", error)
      throw error
    }
  }

  async getDispatchRiderEarnings(dispatchRiderId: string, filters: any) {
    try {
      const { period = "week", startDate, endDate } = filters

      const deliveryProfile = await prisma.deliveryProfile.findFirst({
        where: { userId: dispatchRiderId },
      })

      if (!deliveryProfile) {
        throw new Error("Delivery profile not found")
      }

      let filterStartDate: Date
      let filterEndDate: Date = new Date()

      switch (period) {
        case "today":
          filterStartDate = new Date()
          filterStartDate.setHours(0, 0, 0, 0)
          break
        case "week":
          filterStartDate = this.getWeekStart(new Date())
          break
        case "month":
          filterStartDate = new Date()
          filterStartDate.setDate(1)
          filterStartDate.setHours(0, 0, 0, 0)
          break
        case "custom":
          filterStartDate = startDate ? new Date(startDate) : new Date()
          filterEndDate = endDate ? new Date(endDate) : new Date()
          break
        default:
          filterStartDate = this.getWeekStart(new Date())
      }

      const earnings = await prisma.deliveryEarning.findMany({
        where: {
          deliveryProfileId: deliveryProfile.id,
          date: {
            gte: filterStartDate,
            lte: filterEndDate,
          },
        },
        orderBy: { date: "desc" },
      })

      const totalEarnings = earnings.reduce((sum, earning) => sum + earning.amount, 0)
      const totalCommission = earnings.reduce((sum, earning) => sum + earning.commission, 0)
      const netEarnings = earnings.reduce((sum, earning) => sum + earning.netEarning, 0)
      const totalDeliveries = earnings.length

      return {
        period,
        startDate: filterStartDate,
        endDate: filterEndDate,
        summary: {
          totalEarnings,
          totalCommission,
          netEarnings,
          totalDeliveries,
          averagePerDelivery: totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0,
        },
        earnings,
      }
    } catch (error) {
      logger.error("Get dispatch rider earnings error:", error)
      throw error
    }
  }

  async getDispatchRiderAnalytics(dispatchRiderId: string) {
    try {
      const deliveryProfile = await prisma.deliveryProfile.findFirst({
        where: { userId: dispatchRiderId },
      })

      if (!deliveryProfile) {
        throw new Error("Delivery profile not found")
      }

      const currentMonth = new Date()
      currentMonth.setDate(1)
      currentMonth.setHours(0, 0, 0, 0)

      const [monthlyStats, weeklyStats, recentDeliveries] = await Promise.all([
        prisma.deliveryEarning.aggregate({
          where: {
            deliveryProfileId: deliveryProfile.id,
            date: { gte: currentMonth },
          },
          _sum: {
            amount: true,
            commission: true,
            netEarning: true,
          },
          _count: true,
        }),

        prisma.deliveryEarning.aggregate({
          where: {
            deliveryProfileId: deliveryProfile.id,
            date: { gte: this.getWeekStart(new Date()) },
          },
          _sum: {
            amount: true,
            commission: true,
            netEarning: true,
          },
          _count: true,
        }),

        prisma.delivery.findMany({
          where: {
            dispatchRiderId,
            status: "DELIVERED",
          },
          include: {
            order: {
              include: {
                customer: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
                store: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { deliveredAt: "desc" },
          take: 10,
        }),
      ])

      return {
        profile: {
          rating: deliveryProfile.rating,
          totalDeliveries: deliveryProfile.totalDeliveries,
          totalEarnings: deliveryProfile.totalEarnings,
          isVerified: deliveryProfile.isVerified,
          vehicleType: deliveryProfile.vehicleType,
          deliveryZones: deliveryProfile.deliveryZones,
          joinedDate: deliveryProfile.createdAt,
        },
        monthly: {
          earnings: monthlyStats._sum.amount || 0,
          commission: monthlyStats._sum.commission || 0,
          netEarnings: monthlyStats._sum.netEarning || 0,
          deliveries: monthlyStats._count,
        },
        weekly: {
          earnings: weeklyStats._sum.amount || 0,
          commission: weeklyStats._sum.commission || 0,
          netEarnings: weeklyStats._sum.netEarning || 0,
          deliveries: weeklyStats._count,
        },
        recentDeliveries,
      }
    } catch (error) {
      logger.error("Get dispatch rider analytics error:", error)
      throw error
    }
  }

  async getAllDispatchRiders(filters: any) {
    try {
      const { page = 1, limit = 20, status, vehicleType, zone } = filters
      const skip = (page - 1) * limit

      const where: any = {}
      if (status) where.verificationStatus = status
      if (vehicleType) where.vehicleType = vehicleType
      if (zone) {
        where.deliveryZones = {
          contains: zone,
        }
      }

      const [dispatchRiders, total] = await Promise.all([
        prisma.deliveryProfile.findMany({
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
          skip,
          take: limit,
        }),
        prisma.deliveryProfile.count({ where }),
      ])

      return {
        dispatchRiders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get all dispatch riders error:", error)
      throw error
    }
  }

  async verifyDispatchRider(dispatchRiderId: string) {
    try {
      const dispatchRider = await prisma.deliveryProfile.update({
        where: { userId: dispatchRiderId },
        data: {
          isVerified: true,
          verificationStatus: "APPROVED",
        },
      })

      await this.notificationService.notifyCustomer(dispatchRiderId, {
        type: NotificationType.VERIFICATION_APPROVED,
        title: "Verification Approved",
        body: "Your dispatch rider account has been verified and approved",
        priority: PriorityLevel.URGENT,
      })

      return dispatchRider
    } catch (error) {
      logger.error("Verify dispatch rider error:", error)
      throw error
    }
  }

  async suspendDispatchRider(dispatchRiderId: string, reason: string) {
    try {
      const dispatchRider = await prisma.deliveryProfile.update({
        where: { userId: dispatchRiderId },
        data: {
          isVerified: false,
          verificationStatus: "REJECTED",
          isAvailable: false,
          isOnline: false,
        },
      })

      await this.notificationService.notifyCustomer(dispatchRiderId, {
        type: NotificationType.ACCOUNT_SUSPENDED,
        title: "Account Suspended",
        body: `Your dispatch rider account has been suspended. Reason: ${reason}`,
        priority: PriorityLevel.CRITICAL,
      })

      return dispatchRider
    } catch (error) {
      logger.error("Suspend dispatch rider error:", error)
      throw error
    }
  }

  // Store-related methods
  async markOrderReady(orderId: string, storeOwnerId: string, orderData: any) {
    try {
      // Verify store ownership
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          store: {
            include: {
              owner: true,
            },
          },
          customer: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          deliveryLocation: true,
        },
      })

      if (!order) {
        throw new Error("Order not found")
      }

      if (order.store.owner.userId !== storeOwnerId) {
        throw new Error("Unauthorized to manage this order")
      }

      if (order.status !== "CONFIRMED") {
        throw new Error("Order must be confirmed before marking as ready")
      }

      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "READY_FOR_PICKUP",
          readyForPickupAt: new Date(),
          preparationNotes: orderData.notes,
        },
      })

      // Create delivery record
      const delivery = await prisma.delivery.create({
        data: {
          orderId,
          pickupLocationId: order.store.locationId,
          deliveryLocationId: order.deliveryLocationId!,
          deliveryFee: orderData.deliveryFee || 0,
          estimatedPickupTime: orderData.estimatedPickupTime ? new Date(orderData.estimatedPickupTime) : new Date(),
          estimatedDeliveryTime: orderData.estimatedDeliveryTime
            ? new Date(orderData.estimatedDeliveryTime)
            : new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          specialInstructions: orderData.specialInstructions,
          status: "PENDING",
        },
      })

      // Find and notify nearby dispatch riders
      await this.findAndNotifyDispatchRiders(delivery)

      // Notify customer
      await this.notificationService.notifyCustomer(order.customerId, {
        type: NotificationType.ORDER_READY,
        title: "Order Ready for Pickup",
        body: `Your order from ${order.store.name} is ready and we're finding a dispatch rider to deliver it to you.`,
        data: {
          orderId,
          deliveryId: delivery.id,
          storeName: order.store.name,
        },
        priority: PriorityLevel.STANDARD,
      })

      return delivery
    } catch (error) {
      logger.error("Mark order ready error:", error)
      throw error
    }
  }

  async getStoreOrders(storeId: string, storeOwnerId: string, filters: any) {
    try {
      // Verify store ownership
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      if (store.owner.userId !== storeOwnerId) {
        throw new Error("Unauthorized to view orders for this store")
      }

      const { status, page = 1, limit = 20, dateFrom, dateTo } = filters
      const skip = (page - 1) * limit

      const where: any = { storeId }
      if (status) where.status = status
      if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = new Date(dateFrom)
        if (dateTo) where.createdAt.lte = new Date(dateTo)
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
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
            orderItems: true,
            deliveryLocation: true,
            delivery: {
              include: {
                dispatchRider: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                        phone: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.order.count({ where }),
      ])

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get store orders error:", error)
      throw error
    }
  }

  async getDeliveryTracking(deliveryId: string) {
    try {
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          order: {
            include: {
              store: {
                select: {
                  name: true,
                  contactPhone: true,
                },
              },
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
          dispatchRider: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true,
                  avatar: true,
                },
              },
              vehicle: true,
            },
          },
          pickupLocation: true,
          deliveryLocation: true,
          trackingUpdates: {
            orderBy: { timestamp: "asc" },
          },
        },
      })

      if (!delivery) {
        throw new Error("Delivery not found")
      }

      return delivery
    } catch (error) {
      logger.error("Get delivery tracking error:", error)
      throw error
    }
  }

  async updateDeliveryTracking(deliveryId: string, dispatchRiderId: string, trackingData: any) {
    try {
      // Verify dispatch rider owns this delivery
      const delivery = await prisma.delivery.findFirst({
        where: {
          id: deliveryId,
          dispatchRiderId,
        },
      })

      if (!delivery) {
        throw new Error("Delivery not found or not owned by dispatch rider")
      }

      // Create tracking update
      await prisma.deliveryTracking.create({
        data: {
          deliveryId,
          latitude: trackingData.latitude,
          longitude: trackingData.longitude,
          status: trackingData.status || delivery.status,
          message: trackingData.message || "Location update",
          timestamp: new Date(),
        },
      })

      // Update dispatch rider location
      await prisma.deliveryProfile.update({
        where: { userId: dispatchRiderId },
        data: {
          currentLatitude: trackingData.latitude,
          currentLongitude: trackingData.longitude,
          heading: trackingData.heading,
        },
      })
    } catch (error) {
      logger.error("Update delivery tracking error:", error)
      throw error
    }
  }

  private async calculateETA(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<number> {
    try {
      const distance = this.locationService.calculateDistance(fromLat, fromLng, toLat, toLng)
      // Assume average speed of 30 km/h for dispatch riders
      const timeInHours = distance / 30000 // distance in meters, speed in m/h
      return Math.ceil(timeInHours * 60) // return minutes
    } catch (error) {
      logger.error("Calculate ETA error:", error)
      return 15 // default 15 minutes
    }
  }

  private async startDeliveryTracking(deliveryId: string, dispatchRiderId: string) {
    try {
      await prisma.deliveryTracking.create({
        data: {
          deliveryId,
          latitude: 0, // Default values
          longitude: 0,
          status: "DISPATCH_RIDER_ASSIGNED",
          message: "Dispatch rider assigned and tracking started",
          timestamp: new Date(),
        },
      })
    } catch (error) {
      logger.error("Start delivery tracking error:", error)
    }
  }

  private async findAndNotifyDispatchRiders(delivery: any) {
    try {
      // Find nearby available dispatch riders
      const nearbyRiders = await prisma.deliveryProfile.findMany({
        where: {
          isAvailable: true,
          isOnline: true,
          isVerified: true,
          currentLatitude: { not: null },
          currentLongitude: { not: null },
        },
        include: {
          user: true,
        },
      })

      // Filter by distance and notify closest ones
      const pickupLocation = await prisma.location.findUnique({
        where: { id: delivery.pickupLocationId },
      })

      if (!pickupLocation) return

      const ridersWithDistance = nearbyRiders
        .map((rider) => {
          const distance = this.locationService.calculateDistance(
            rider.currentLatitude!,
            rider.currentLongitude!,
            pickupLocation.latitude,
            pickupLocation.longitude,
          )
          return { ...rider, distance }
        })
        .filter((rider) => rider.distance <= (rider.maxDeliveryDistance || 50000))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5) // Notify top 5 closest riders

      // Notify dispatch riders
      for (const rider of ridersWithDistance) {
        await this.notificationService.notifyCustomer(rider.user.id, {
          type: NotificationType.NEW_DELIVERY_REQUEST,
          title: "New Delivery Request",
          body: `New delivery request ${(rider.distance / 1000).toFixed(1)}km away`,
          data: {
            deliveryId: delivery.id,
            orderId: delivery.orderId,
            pickupLocation: {
              latitude: pickupLocation.latitude,
              longitude: pickupLocation.longitude,
            },
            distance: rider.distance,
            estimatedEarning: delivery.deliveryFee * 0.85, // 85% to rider
            autoRejectIn: 120, // 2 minutes
          },
          priority: PriorityLevel.URGENT,
        })
      }
    } catch (error) {
      logger.error("Find and notify dispatch riders error:", error)
    }
  }

  private async findAndNotifyNextDispatchRider(delivery: any) {
    try {
      // Implementation for finding next available dispatch rider
      logger.info(`Finding next dispatch rider for delivery ${delivery.id}`)
      // This would use similar logic to findAndNotifyDispatchRiders
    } catch (error) {
      logger.error("Find next dispatch rider error:", error)
    }
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }
}
