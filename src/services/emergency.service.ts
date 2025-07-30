import prisma from "../config/database"
import { LocationService } from "./location.service"
import { NotificationService } from "./notification.service"
import logger from "../utils/logger"

export class EmergencyService {
  private locationService = new LocationService()
  private notificationService = new NotificationService()

  async createEmergencyBooking(data: {
    customerId: string
    emergencyType: string
    latitude: number
    longitude: number
    description: string
    severity: string
    contactPhone: string
    additionalInfo?: any
  }) {
    try {
      const booking = await prisma.booking.create({
        data: {
          bookingNumber: await this.generateEmergencyNumber(),
          customerId: data.customerId,
          serviceTypeId: await this.getEmergencyServiceTypeId(data.emergencyType),
          status: "PENDING",
          type: "IMMEDIATE",
          pickupLatitude: data.latitude,
          pickupLongitude: data.longitude,
          estimatedPrice: 0, // Emergency services are typically free
          currency: "NGN",
          serviceData: {
            emergencyType: data.emergencyType,
            severity: data.severity,
            description: data.description,
            contactPhone: data.contactPhone,
            additionalInfo: data.additionalInfo,
            dispatchTime: new Date(),
          },
          notes: data.description,
        },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          serviceType: true,
        },
      })

      return booking
    } catch (error) {
      logger.error("Create emergency booking error:", error)
      throw error
    }
  }

  async dispatchEmergencyResponders(
    bookingId: string,
    data: {
      emergencyType: string
      latitude: number
      longitude: number
      severity: string
    },
  ) {
    try {
      // Find nearby emergency responders
      const responders = await this.findNearbyResponders({
        emergencyType: data.emergencyType,
        latitude: data.latitude,
        longitude: data.longitude,
        radius: 20000, // 20km radius
      })

      // Dispatch to the closest available responders
      const dispatchPromises = responders.slice(0, 3).map(async (responder) => {
        await this.notificationService.notifyCustomer(responder.userId, {
          type: "EMERGENCY_DISPATCH",
          title: `${data.emergencyType} Emergency`,
          body: `Emergency dispatch - ${data.severity} severity`,
          data: {
            bookingId,
            emergencyType: data.emergencyType,
            severity: data.severity,
            latitude: data.latitude,
            longitude: data.longitude,
            distance: responder.distance,
          },
          priority: "CRITICAL",
        })

        // Log dispatch
        await prisma.auditLog.create({
          data: {
            userId: responder.userId,
            action: "EMERGENCY_DISPATCHED",
            resource: "emergency_booking",
            resourceId: bookingId,
            newValues: JSON.stringify({
              emergencyType: data.emergencyType,
              severity: data.severity,
            }),
          },
        })
      })

      await Promise.all(dispatchPromises)

      return { dispatchedCount: Math.min(responders.length, 3) }
    } catch (error) {
      logger.error("Dispatch emergency responders error:", error)
      throw error
    }
  }

  async findNearbyResponders(params: {
    emergencyType: string
    latitude: number
    longitude: number
    radius: number
  }) {
    try {
      const responders = await prisma.emergencyProfile.findMany({
        where: {
          serviceType: params.emergencyType as any,
          isOnDuty: true,
          isVerified: true,
          currentLatitude: { not: null },
          currentLongitude: { not: null },
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      })

      // Calculate distances and filter by radius
      const respondersWithDistance = responders
        .map((responder) => {
          if (!responder.currentLatitude || !responder.currentLongitude) return null

          const distance = this.locationService.calculateDistance(
            params.latitude,
            params.longitude,
            responder.currentLatitude,
            responder.currentLongitude,
          )

          return {
            ...responder,
            distance,
          }
        })
        .filter(
          (responder): responder is NonNullable<typeof responder> =>
            responder !== null && responder.distance <= params.radius,
        )
        .sort((a, b) => a.distance - b.distance)

      return respondersWithDistance
    } catch (error) {
      logger.error("Find nearby responders error:", error)
      throw error
    }
  }

  async acceptEmergencyCall(bookingId: string, responderId: string) {
    try {
      // Check if responder is eligible
      const responder = await prisma.emergencyProfile.findUnique({
        where: { userId: responderId },
      })

      if (!responder || !responder.isOnDuty || !responder.isVerified) {
        throw new Error("Responder not eligible to accept emergency calls")
      }

      // Update booking
      const booking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          providerId: responderId,
          status: "DRIVER_ASSIGNED",
          acceptedAt: new Date(),
        },
        include: {
          customer: true,
          provider: true,
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "EMERGENCY_RESPONDER_ASSIGNED",
        title: "Emergency Responder Assigned",
        body: `${booking.provider?.firstName} ${booking.provider?.lastName} is responding to your emergency`,
        data: {
          bookingId,
          responderName: `${booking.provider?.firstName} ${booking.provider?.lastName}`,
          responderPhone: booking.provider?.phone,
        },
        priority: "CRITICAL",
      })

      return booking
    } catch (error) {
      logger.error("Accept emergency call error:", error)
      throw error
    }
  }

  async updateEmergencyStatus(
    bookingId: string,
    data: {
      status: string
      notes?: string
      estimatedArrival?: string
      responderId: string
    },
  ) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true },
      })

      if (!booking || booking.providerId !== data.responderId) {
        throw new Error("Unauthorized to update this emergency")
      }

      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: data.status as any,
          notes: data.notes,
        },
      })

      // Add tracking update
      await prisma.trackingUpdate.create({
        data: {
          bookingId,
          latitude: 0, // Default values
          longitude: 0,
          status: data.status,
          message: data.notes || `Status updated to ${data.status}`,
        },
      })

      // Notify customer of status update
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "EMERGENCY_STATUS_UPDATE",
        title: "Emergency Status Update",
        body: data.notes || `Status: ${data.status}`,
        data: {
          bookingId,
          status: data.status,
          estimatedArrival: data.estimatedArrival,
        },
        priority: "STANDARD",
      })

      return updatedBooking
    } catch (error) {
      logger.error("Update emergency status error:", error)
      throw error
    }
  }

  async completeEmergencyCall(
    bookingId: string,
    data: {
      resolution: string
      notes?: string
      followUpRequired: boolean
      responderId: string
    },
  ) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { customer: true },
      })

      if (!booking || booking.providerId !== data.responderId) {
        throw new Error("Unauthorized to complete this emergency")
      }

      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          serviceData: {
            ...(booking.serviceData as any),
            resolution: data.resolution,
            completionNotes: data.notes,
            followUpRequired: data.followUpRequired,
          },
        },
      })

      // Notify customer
      await this.notificationService.notifyCustomer(booking.customerId, {
        type: "EMERGENCY_COMPLETED",
        title: "Emergency Response Completed",
        body: `Emergency response completed. ${data.followUpRequired ? "Follow-up may be required." : ""}`,
        data: {
          bookingId,
          resolution: data.resolution,
          followUpRequired: data.followUpRequired,
        },
        priority: "STANDARD",
      })

      return updatedBooking
    } catch (error) {
      logger.error("Complete emergency call error:", error)
      throw error
    }
  }

  async getEmergencyBookings(
    userId: string,
    filters: {
      page: number
      limit: number
      status?: string
      emergencyType?: string
    },
  ) {
    try {
      const { page, limit, status, emergencyType } = filters
      const skip = (page - 1) * limit

      const where: any = {
        OR: [{ customerId: userId }, { providerId: userId }],
        serviceType: {
          category: "EMERGENCY",
        },
      }

      if (status) where.status = status
      if (emergencyType) {
        where.serviceData = {
          path: ["emergencyType"],
          equals: emergencyType,
        }
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
      logger.error("Get emergency bookings error:", error)
      throw error
    }
  }

  async getNearbyEmergencies(params: {
    latitude: number
    longitude: number
    radius: number
    emergencyType?: string
    responderId: string
  }) {
    try {
      // Check if responder is on duty
      const responder = await prisma.emergencyProfile.findUnique({
        where: { userId: params.responderId },
      })

      if (!responder || !responder.isOnDuty) {
        return []
      }

      const where: any = {
        status: "PENDING",
        serviceType: {
          category: "EMERGENCY",
        },
        pickupLatitude: { not: null },
        pickupLongitude: { not: null },
      }

      if (params.emergencyType) {
        where.serviceData = {
          path: ["emergencyType"],
          equals: params.emergencyType,
        }
      }

      const emergencies = await prisma.booking.findMany({
        where,
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          serviceType: true,
        },
        orderBy: { createdAt: "asc" },
      })

      // Filter by distance
      const nearbyEmergencies = emergencies
        .map((emergency) => {
          const distance = this.locationService.calculateDistance(
            params.latitude,
            params.longitude,
            emergency.pickupLatitude!,
            emergency.pickupLongitude!,
          )

          return {
            ...emergency,
            distance,
          }
        })
        .filter((emergency) => emergency.distance <= params.radius)
        .sort((a, b) => a.distance - b.distance)

      return nearbyEmergencies
    } catch (error) {
      logger.error("Get nearby emergencies error:", error)
      throw error
    }
  }

  async updateResponderLocation(
    responderId: string,
    data: {
      latitude: number
      longitude: number
      isOnDuty: boolean
    },
  ) {
    try {
      await prisma.emergencyProfile.updateMany({
        where: { userId: responderId },
        data: {
          currentLatitude: data.latitude,
          currentLongitude: data.longitude,
          isOnDuty: data.isOnDuty,
        },
      })

      // Broadcast location update for active emergencies
      const activeEmergencies = await prisma.booking.findMany({
        where: {
          providerId: responderId,
          status: { in: ["DRIVER_ASSIGNED", "IN_PROGRESS"] },
        },
      })

      // Here you would broadcast via WebSocket to customers
      // This is a placeholder for the actual implementation
      logger.info(`Location updated for responder ${responderId}`)

      return { success: true }
    } catch (error) {
      logger.error("Update responder location error:", error)
      throw error
    }
  }

async onboardEmergencyResponder(data: {
  userId: string
  organizationName: string
  serviceType: string
  badgeNumber?: string
  department?: string
  rank?: string
  responseRadius?: number
  certifications?: any
  emergencyContacts?: any
  organizationId?: string
  headquarters?: string
  contactPhone?: string
  emergencyHotline?: string
  serviceAreas?: any
  operatingHours?: any
  serviceCapacity?: number
  equipmentList?: any
  title?: string
  notes?: string
}) {
  try {
    const responder = await prisma.emergencyProfile.create({
      data: {
        userId: data.userId,
        organizationName: data.organizationName,
        organizationId: data.organizationId || `ORG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        serviceType: data.serviceType as any,
        department: data.department,
        headquarters: data.headquarters,
        contactPhone: data.contactPhone,
        emergencyHotline: data.emergencyHotline,
        serviceAreas: data.serviceAreas,
        operatingHours: data.operatingHours,
        serviceCapacity: data.serviceCapacity,
        equipmentList: data.equipmentList,
        certifications: data.certifications,
        emergencyContacts: data.emergencyContacts,
        badgeNumber: data.badgeNumber,
        rank: data.rank,
        title: data.title,
        responseRadius: data.responseRadius || 10,
        notes: data.notes,
        isOnDuty: false,
        isVerified: false,
      },
    })

    // Update user role
    await prisma.user.update({
      where: { id: data.userId },
      data: { role: "EMERGENCY_RESPONDER" },
    })

    return responder
  } catch (error) {
    logger.error("Onboard emergency responder error:", error)
    throw error
  }
}
  async getEmergencyAnalytics(params: {
    startDate?: string
    endDate?: string
    emergencyType?: string
  }) {
    try {
      const where: any = {
        serviceType: {
          category: "EMERGENCY",
        },
      }

      if (params.startDate || params.endDate) {
        where.createdAt = {}
        if (params.startDate) where.createdAt.gte = new Date(params.startDate)
        if (params.endDate) where.createdAt.lte = new Date(params.endDate)
      }

      if (params.emergencyType) {
        where.serviceData = {
          path: ["emergencyType"],
          equals: params.emergencyType,
        }
      }

      const [totalEmergencies, completedEmergencies, averageResponseTime, emergenciesByType, emergenciesByStatus] =
        await Promise.all([
          prisma.booking.count({ where }),
          prisma.booking.count({
            where: { ...where, status: "COMPLETED" },
          }),
          this.calculateAverageResponseTime(where),
          this.getEmergenciesByType(where),
          this.getEmergenciesByStatus(where),
        ])

      return {
        totalEmergencies,
        completedEmergencies,
        completionRate: totalEmergencies > 0 ? (completedEmergencies / totalEmergencies) * 100 : 0,
        averageResponseTime,
        emergenciesByType,
        emergenciesByStatus,
      }
    } catch (error) {
      logger.error("Get emergency analytics error:", error)
      throw error
    }
  }

  private async generateEmergencyNumber(): Promise<string> {
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 4).toUpperCase()
    return `EMG${timestamp}${random}`
  }

  private async getEmergencyServiceTypeId(emergencyType: string): Promise<string> {
    const serviceType = await prisma.serviceType.findFirst({
      where: {
        category: "EMERGENCY",
        name: emergencyType,
      },
    })

    if (!serviceType) {
      // Create emergency service type if it doesn't exist
      const newServiceType = await prisma.serviceType.create({
        data: {
          name: emergencyType,
          displayName: emergencyType.replace("_", " "),
          category: "EMERGENCY",
          basePrice: 0,
          isActive: true,
        },
      })
      return newServiceType.id
    }

    return serviceType.id
  }

  private async calculateAverageResponseTime(where: any): Promise<number> {
    try {
      const emergencies = await prisma.booking.findMany({
        where: {
          ...where,
          acceptedAt: { not: null },
        },
        select: {
          createdAt: true,
          acceptedAt: true,
        },
      })

      if (emergencies.length === 0) return 0

      const totalResponseTime = emergencies.reduce((sum, emergency) => {
        const responseTime = emergency.acceptedAt!.getTime() - emergency.createdAt.getTime()
        return sum + responseTime
      }, 0)

      return Math.round(totalResponseTime / emergencies.length / 1000 / 60) // Convert to minutes
    } catch (error) {
      logger.error("Calculate average response time error:", error)
      return 0
    }
  }

  private async getEmergenciesByType(where: any) {
    try {
      const emergencies = await prisma.booking.findMany({
        where,
        select: {
          serviceData: true,
        },
      })

      const typeCount: Record<string, number> = {}
      emergencies.forEach((emergency) => {
        const emergencyType = (emergency.serviceData as any)?.emergencyType || "UNKNOWN"
        typeCount[emergencyType] = (typeCount[emergencyType] || 0) + 1
      })

      return Object.entries(typeCount).map(([type, count]) => ({
        type,
        count,
      }))
    } catch (error) {
      logger.error("Get emergencies by type error:", error)
      return []
    }
  }

  private async getEmergenciesByStatus(where: any) {
    try {
      const statusCounts = await prisma.booking.groupBy({
        by: ["status"],
        where,
        _count: true,
      })

      return statusCounts.map((item) => ({
        status: item.status,
        count: item._count,
      }))
    } catch (error) {
      logger.error("Get emergencies by status error:", error)
      return []
    }
  }
}
