import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import prisma from "../config/database"
import { EmergencyService } from "../services/emergency.service"
import { LocationService } from "../services/location.service"
import { NotificationService } from "../services/notification.service"
import logger from "../utils/logger"

export class EmergencyController {
  private emergencyService = new EmergencyService()
  private locationService = new LocationService()
  private notificationService = new NotificationService()

  createEmergencyBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { emergencyType, latitude, longitude, description, severity, contactPhone, additionalInfo } = req.body

      // Create emergency booking
      const booking = await this.emergencyService.createEmergencyBooking({
        customerId: userId,
        emergencyType,
        latitude,
        longitude,
        description,
        severity,
        contactPhone,
        additionalInfo,
      })

      // Dispatch emergency responders
      await this.emergencyService.dispatchEmergencyResponders(booking.id, {
        emergencyType,
        latitude,
        longitude,
        severity,
      })

      res.status(201).json({
        success: true,
        message: "Emergency booking created and responders dispatched",
        data: booking,
      })
    } catch (error) {
      logger.error("Create emergency booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create emergency booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getEmergencyBookings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { page = 1, limit = 10, status, emergencyType } = req.query

      const bookings = await this.emergencyService.getEmergencyBookings(userId, {
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        emergencyType: emergencyType as string,
      })

      res.json({
        success: true,
        message: "Emergency bookings retrieved successfully",
        data: bookings,
      })
    } catch (error) {
      logger.error("Get emergency bookings error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve emergency bookings",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateEmergencyStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const { status, notes, estimatedArrival } = req.body
      const responderId = req.user!.id

      const booking = await this.emergencyService.updateEmergencyStatus(bookingId, {
        status,
        notes,
        estimatedArrival,
        responderId,
      })

      res.json({
        success: true,
        message: "Emergency status updated successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Update emergency status error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update emergency status",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  acceptEmergencyCall = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const responderId = req.user!.id

      const booking = await this.emergencyService.acceptEmergencyCall(bookingId, responderId)

      // Notify customer via WebSocket about responder assignment
      try {
        const { io } = await import("../server")
        await io.notifyUser(booking.customerId, "emergency_responder_assigned", {
          bookingId,
          responderId,
          responderName: booking.provider?.firstName + " " + booking.provider?.lastName,
          responderPhone: booking.provider?.phone,
          timestamp: new Date(),
        })

        // Notify responder to join emergency booking room
        await io.notifyUser(responderId, "emergency_booking_joined", {
          bookingId,
          customerId: booking.customerId,
          customerName: booking.customer?.firstName + " " + booking.customer?.lastName,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to send WebSocket notifications for emergency call acceptance:", error)
      }

      res.json({
        success: true,
        message: "Emergency call accepted successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Accept emergency call error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to accept emergency call",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  completeEmergencyCall = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bookingId = req.params.id
      const { resolution, notes, followUpRequired } = req.body
      const responderId = req.user!.id

      const booking = await this.emergencyService.completeEmergencyCall(bookingId, {
        resolution,
        notes,
        followUpRequired,
        responderId,
      })

      res.json({
        success: true,
        message: "Emergency call completed successfully",
        data: booking,
      })
    } catch (error) {
      logger.error("Complete emergency call error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to complete emergency call",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getNearbyEmergencies = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { latitude, longitude, radius = 10000, emergencyType } = req.query
      const responderId = req.user!.id

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
        })
      }

      const emergencies = await this.emergencyService.getNearbyEmergencies({
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: Number(radius),
        emergencyType: emergencyType as string,
        responderId,
      })

      res.json({
        success: true,
        message: "Nearby emergencies retrieved successfully",
        data: emergencies,
      })
    } catch (error) {
      logger.error("Get nearby emergencies error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve nearby emergencies",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateResponderLocation = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { latitude, longitude, isOnDuty } = req.body
      const responderId = req.user!.id

      await this.emergencyService.updateResponderLocation(responderId, {
        latitude,
        longitude,
        isOnDuty,
      })

      // Broadcast location update via WebSocket
      try {
        const { io } = await import("../server")
        await io.broadcastToRole("USER", "emergency_responder_location_update", {
          responderId,
          latitude,
          longitude,
          isOnDuty,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to broadcast emergency responder location update:", error)
      }

      res.json({
        success: true,
        message: "Responder location updated successfully",
      })
    } catch (error) {
      logger.error("Update responder location error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update responder location",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getEmergencyAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, emergencyType } = req.query

      const analytics = await this.emergencyService.getEmergencyAnalytics({
        startDate: startDate as string,
        endDate: endDate as string,
        emergencyType: emergencyType as string,
      })

      res.json({
        success: true,
        message: "Emergency analytics retrieved successfully",
        data: analytics,
      })
    } catch (error) {
      logger.error("Get emergency analytics error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve emergency analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Emergency responder management
  onboardEmergencyResponder = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        // Organization details
        organizationName,
        organizationId,
        serviceType, // POLICE, AMBULANCE, FIRE_DEPARTMENT, etc.
        department,
        headquarters,
        contactPhone,
        emergencyHotline,
        serviceAreas,
        operatingHours,
        serviceCapacity,
        equipmentList,
        certifications,
        emergencyContacts,
       
        // Representative details
        representativeName,
        representativeTitle,
        representativeEmail,
        representativePhone,
        badgeNumber,
        rank,
       
        // Service configuration
        responseRadius = 10,
        notes,
      } = req.body

      // Handle both new user creation and existing user onboarding
      let userId = req.user?.id
      let user = req.user

      if (!userId) {
        // Create new user for organization representative
        const userData = {
          email: representativeEmail,
          phone: representativePhone,
          firstName: representativeName?.split(' ')[0] || '',
          lastName: representativeName?.split(' ').slice(1).join(' ') || '',
          role: 'EMERGENCY_RESPONDER' as const,
          isVerified: false,
        }

        const newUser = await prisma.user.create({
          data: {
            ...userData,
            referralCode: `ER-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          }
        })

        // Get user permissions for the EMERGENCY_RESPONDER role
        const rolePermissions = await prisma.rolePermission.findMany({
          where: { 
            role: 'EMERGENCY_RESPONDER',
            isActive: true 
          },
          select: { permission: true }
        })

        // Create the authenticated user object with permissions
        user = {
          id: newUser.id,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          permissions: rolePermissions.map(rp => rp.permission),
          isVerified: newUser.isVerified,
          isActive: newUser.isActive,
        }
        
        userId = newUser.id
      } else {
        // Update existing user role if needed
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { role: 'EMERGENCY_RESPONDER' }
        })

        // Get updated permissions for the new role
        const rolePermissions = await prisma.rolePermission.findMany({
          where: { 
            role: 'EMERGENCY_RESPONDER',
            isActive: true 
          },
          select: { permission: true }
        })

        // Update the user object with new permissions - ensure all required fields are present
        user = {
          id: updatedUser.id,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
          permissions: rolePermissions.map(rp => rp.permission),
          isVerified: updatedUser.isVerified,
          isActive: updatedUser.isActive,
        }
      }

      // Ensure user is defined before proceeding
      if (!user || !user.id) {
        return res.status(400).json({
          success: false,
          message: "Failed to create or update user",
        })
      }

      // Create emergency profile for the organization
      const emergencyProfile = await prisma.emergencyProfile.create({
        data: {
          userId: user.id,
          organizationName,
          organizationId: organizationId || `ORG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          serviceType,
          department,
          headquarters,
          contactPhone,
          emergencyHotline,
          serviceAreas,
          operatingHours,
          serviceCapacity,
          equipmentList,
          certifications,
          emergencyContacts,
          badgeNumber,
          rank,
          title: representativeTitle,
          responseRadius,
          notes,
          isOnDuty: false,
          isVerified: false,
        }
      })

      res.status(201).json({
        success: true,
        message: "Emergency responder organization onboarded successfully",
        data: {
          user,
          emergencyProfile,
        },
      })
    } catch (error) {
      logger.error("Onboard emergency responder error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to onboard emergency responder",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getResponderProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id

      const profile = await prisma.emergencyProfile.findUnique({
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
        },
      })

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Emergency responder profile not found",
        })
      }

      res.json({
        success: true,
        message: "Responder profile retrieved successfully",
        data: profile,
      })
    } catch (error) {
      logger.error("Get responder profile error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve responder profile",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateResponderProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const updateData = req.body

      const profile = await prisma.emergencyProfile.updateMany({
        where: { userId },
        data: updateData,
      })

      if (profile.count === 0) {
        return res.status(404).json({
          success: false,
          message: "Emergency responder profile not found",
        })
      }

      res.json({
        success: true,
        message: "Responder profile updated successfully",
      })
    } catch (error) {
      logger.error("Update responder profile error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update responder profile",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Admin functions
  getAllEmergencyResponders = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, serviceType, department, isOnDuty } = req.query

      const where: any = {}
      if (serviceType) where.serviceType = serviceType
      if (department) where.department = department
      if (isOnDuty !== undefined) where.isOnDuty = isOnDuty === "true"

      const responders = await prisma.emergencyProfile.findMany({
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
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { id: "desc" },
      })

      const total = await prisma.emergencyProfile.count({ where })

      res.json({
        success: true,
        message: "Emergency responders retrieved successfully",
        data: responders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get all emergency responders error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve emergency responders",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  verifyEmergencyResponder = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const responderId = req.params.id

      const responder = await prisma.emergencyProfile.update({
        where: { id: responderId },
        data: { isVerified: true },
        include: { user: true },
      })

      // Send verification notification
      await this.notificationService.notifyCustomer(responder.userId, {
        type: "EMERGENCY_RESPONDER_VERIFIED",
        title: "Emergency Responder Verified",
        body: "Your emergency responder application has been approved",
        priority: "STANDARD",
      })

      res.json({
        success: true,
        message: "Emergency responder verified successfully",
        data: responder,
      })
    } catch (error) {
      logger.error("Verify emergency responder error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to verify emergency responder",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Emergency contacts management
  addEmergencyContact = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { name, phone, email, relationship } = req.body

      const contact = await this.emergencyService.addEmergencyContact(userId, {
        name,
        phone,
        email,
        relationship,
      })

      res.status(201).json({
        success: true,
        message: "Emergency contact added successfully",
        data: contact,
      })
    } catch (error) {
      logger.error("Add emergency contact error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to add emergency contact",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getEmergencyContacts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id

      const contacts = await this.emergencyService.getEmergencyContacts(userId)

      res.json({
        success: true,
        message: "Emergency contacts retrieved successfully",
        data: contacts,
      })
    } catch (error) {
      logger.error("Get emergency contacts error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve emergency contacts",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  removeEmergencyContact = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const contactId = req.params.contactId

      await this.emergencyService.removeEmergencyContact(userId, contactId)

      res.json({
        success: true,
        message: "Emergency contact removed successfully",
      })
    } catch (error) {
      logger.error("Remove emergency contact error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to remove emergency contact",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Location sharing functionality
  shareLocation = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { latitude, longitude, accuracy, address, isRealTime = false, bookingId } = req.body

      const result = await this.emergencyService.shareLocationWithEmergencyContacts(
        userId,
        {
          latitude,
          longitude,
          accuracy,
          address,
        },
        isRealTime,
        bookingId
      )

      res.json({
        success: true,
        message: `Location shared with ${result.sharedCount} emergency contacts`,
        data: result,
      })
    } catch (error) {
      logger.error("Share location error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to share location",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getLocationSharingHistory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { limit = 50 } = req.query

      const history = await this.emergencyService.getLocationSharingHistory(userId, Number(limit))

      res.json({
        success: true,
        message: "Location sharing history retrieved successfully",
        data: history,
      })
    } catch (error) {
      logger.error("Get location sharing history error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve location sharing history",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  stopLocationSharing = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { bookingId } = req.body

      const result = await this.emergencyService.stopLocationSharing(userId, bookingId)

      res.json({
        success: true,
        message: `Location sharing stopped for ${result.stoppedCount} active shares`,
        data: result,
      })
    } catch (error) {
      logger.error("Stop location sharing error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to stop location sharing",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Track user location during emergency
  trackUserLocation = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { latitude, longitude, accuracy, heading, speed, bookingId } = req.body

      // Store location update
      await prisma.emergencyLocationUpdate.create({
        data: {
          userId,
          bookingId,
          latitude,
          longitude,
          accuracy,
          heading,
          speed,
          timestamp: new Date(),
        },
      })

      // Broadcast location update via WebSocket
      try {
        const { io } = await import("../server")
        await io.emitToRoom(`emergency_booking:${bookingId}`, "emergency_user_location_update", {
          userId,
          bookingId,
          latitude,
          longitude,
          accuracy,
          heading,
          speed,
          timestamp: new Date(),
        })

        // Also notify emergency contacts if real-time sharing is active
        const contacts = await this.emergencyService.getEmergencyContacts(userId)
        for (const contact of contacts) {
          await io.notifyUser(contact.id, "emergency_user_location_update", {
            userId,
            bookingId,
            latitude,
            longitude,
            accuracy,
            heading,
            speed,
            timestamp: new Date(),
          })
        }
      } catch (error) {
        logger.warn("Failed to broadcast user location update:", error)
      }

      res.json({
        success: true,
        message: "User location updated successfully",
      })
    } catch (error) {
      logger.error("Track user location error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to track user location",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}