import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { DispatchRiderService } from "../services/dispatch-rider.service"
import { FileUploadService } from "../services/file-upload.service"
import { WebhookService } from "../services/webhook.service"
import logger from "../utils/logger"

export class DispatchRiderController {
  private dispatchRiderService = new DispatchRiderService()
  private fileUploadService = new FileUploadService()
  private webhookService = new WebhookService()

  async onboardDispatchRider(req: AuthenticatedRequest, res: Response) {
    try {
      // Handle both authenticated and unauthenticated cases
      let userId = req.user?.id

      // If no authenticated user, this is a new user signup
      if (!userId) {
        console.log("=== NEW DISPATCH RIDER SIGNUP ===")
        console.log("Creating new user for dispatch rider onboarding")

        const {
          email,
          phone,
          firstName,
          lastName,
          password,
          dateOfBirth,
          gender,
          licenseNumber,
          licenseExpiry,
          licenseClass,
          vehicleInfo,
          currentLatitude,
          currentLongitude,
          preferredServiceZones,
          acceptsSharedRides = true,
          acceptsCash = true,
          maxRideDistance,
          isAvailableForDayBooking = false,
          canAcceptInterRegional = false,
        } = req.body

        // Validate required fields
        if (!email || !phone || !firstName || !lastName) {
          return res.status(400).json({
            success: false,
            message: "Email, phone, firstName, and lastName are required for new dispatch rider registration",
          })
        }

        // Check if user already exists
        const prisma = (await import("../config/database")).default
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ email }, { phone }],
          },
        })

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: "User already exists with this email or phone",
          })
        }

        // Create new user
        const bcrypt = (await import("bcryptjs")).default
        const referralCode = `DISPATCH${Date.now().toString().slice(-6)}`

        const newUser = await prisma.user.create({
          data: {
            email,
            phone,
            firstName,
            lastName,
            passwordHash: password ? await bcrypt.hash(password, 12) : null,
            gender: gender || null,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            role: "DISPATCHER",
            referralCode,
            isActive: true,
            isVerified: false,
            subscriptionStatus: "ACTIVE",
            subscriptionTier: "BASIC",
            nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            commissionBalance: 0,
            isCommissionCurrent: true,
          },
        })

        userId = newUser.id
        console.log("✅ New user created for dispatch rider:", userId)
      }

      const dispatchRiderProfile = await this.dispatchRiderService.onboardDispatchRider(userId, req.body)

      res.status(201).json({
        success: true,
        message: userId === req.user?.id
          ? "Dispatch rider profile added to existing user successfully"
          : "Dispatch rider onboarded successfully",
        data: dispatchRiderProfile,
      })
    } catch (error: any) {
      console.log("=== DISPATCH RIDER ONBOARDING ERROR ===")
      console.log("Error details:", error)
      logger.error("Onboard dispatch rider error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to onboard dispatch rider",
      })
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const updatedProfile = await this.dispatchRiderService.updateProfile(userId, req.body)

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: updatedProfile,
      })
    } catch (error: any) {
      logger.error("Update dispatch rider profile error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update profile",
      })
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const profile = await this.dispatchRiderService.getProfile(userId)

      res.json({
        success: true,
        data: profile,
      })
    } catch (error: any) {
      logger.error("Get dispatch rider profile error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get profile",
      })
    }
  }

  async addVehicle(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const vehicle = await this.dispatchRiderService.addVehicle(userId, req.body)

      res.status(201).json({
        success: true,
        message: "Vehicle added successfully",
        data: vehicle,
      })
    } catch (error: any) {
      logger.error("Add dispatch vehicle error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to add vehicle",
      })
    }
  }

  async updateVehicle(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const vehicleId = req.params.id

      const vehicle = await this.dispatchRiderService.updateVehicle(userId, vehicleId, req.body)

      res.json({
        success: true,
        message: "Vehicle updated successfully",
        data: vehicle,
      })
    } catch (error: any) {
      logger.error("Update dispatch vehicle error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update vehicle",
      })
    }
  }

  async getVehicles(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const vehicles = await this.dispatchRiderService.getVehicles(userId)

      res.json({
        success: true,
        data: vehicles,
      })
    } catch (error: any) {
      logger.error("Get dispatch vehicles error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get vehicles",
      })
    }
  }

  async uploadDocument(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      // Handle file upload
      const file = req.file
      if (!file) {
        return res.status(400).json({
          success: false,
          message: "Document file is required",
        })
      }

      const documentUrl = await this.fileUploadService.uploadDocument(file, `dispatch-riders/${userId}`)
      const document = await this.dispatchRiderService.uploadDocument(userId, {
        ...req.body,
        documentUrl,
      })

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        data: document,
      })
    } catch (error: any) {
      logger.error("Upload dispatch document error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to upload document",
      })
    }
  }

  async getDocuments(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const documents = await this.dispatchRiderService.getDocuments(userId)

      res.json({
        success: true,
        data: documents,
      })
    } catch (error: any) {
      logger.error("Get dispatch documents error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get documents",
      })
    }
  }

  async updateAvailability(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("=== UPDATE DISPATCH AVAILABILITY REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("===========================================")

      if (!req.user) {
        logger.error("Update availability: No user in request")
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "No user found in request",
        })
      }

      if (!req.user.id) {
        logger.error("Update availability: User ID is undefined", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Invalid user data",
          error: "User ID is undefined",
        })
      }

      const userId = req.user.id
      const { isAvailable, isOnline, currentLatitude, currentLongitude } = req.body

      const profile = await this.dispatchRiderService.updateAvailability(userId, req.body)

      // Broadcast availability update via WebSocket
      try {
        const { io } = await import("../server")
        await io.broadcastToRole("USER", "dispatch_rider_availability_update", {
          dispatchRiderId: userId,
          isAvailable,
          isOnline,
          location: currentLatitude && currentLongitude ? { currentLatitude, currentLongitude } : null,
        })
      } catch (error) {
        logger.warn("Failed to broadcast dispatch rider availability update:", error)
      }

      // Send webhook notification for availability change
      try {
        await this.webhookService.notifyDispatchRiderAvailabilityChange(
          userId,
          isAvailable || false,
          isOnline || false
        )
      } catch (webhookError) {
        logger.warn("Failed to send dispatch rider availability webhook:", webhookError)
      }

      res.json({
        success: true,
        message: "Availability updated successfully",
        data: profile,
      })
    } catch (error: any) {
      logger.error("Update dispatch availability error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update availability",
      })
    }
  }

  async updateLocation(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("=== UPDATE DISPATCH LOCATION REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("=======================================")

      if (!req.user?.id) {
        logger.error("Update location: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { latitude, longitude, heading, speed } = req.body

      await this.dispatchRiderService.updateLocation(userId, req.body)

      // Get active deliveries for this dispatch rider
      const activeDeliveries = await this.dispatchRiderService.getActiveDeliveries(userId)

      // Broadcast location to customers with active deliveries
      try {
        const { io } = await import("../server")
        for (const delivery of activeDeliveries) {
          await io.notifyUser(delivery.customerId, "dispatch_rider_location_update", {
            deliveryId: delivery.id,
            latitude,
            longitude,
            heading,
            speed,
            timestamp: new Date(),
          })
        }
      } catch (error) {
        logger.warn("Failed to broadcast dispatch rider location updates:", error)
      }

      // Send webhook notification for location update
      try {
        await this.webhookService.notifyDispatchRiderLocationUpdate(
          userId,
          { latitude, longitude, heading, speed, timestamp: new Date() }
        )
      } catch (webhookError) {
        logger.warn("Failed to send dispatch rider location webhook:", webhookError)
      }

      res.json({
        success: true,
        message: "Location updated successfully",
      })
    } catch (error: any) {
      logger.error("Update dispatch location error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update location",
      })
    }
  }

  async getDeliveryRequests(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const deliveryRequests = await this.dispatchRiderService.getDeliveryRequests(userId, req.query as any)

      res.json({
        success: true,
        data: deliveryRequests,
      })
    } catch (error: any) {
      logger.error("Get delivery requests error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get delivery requests",
      })
    }
  }

  async acceptDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.id

      const delivery = await this.dispatchRiderService.acceptDeliveryRequest(userId, deliveryId)

      // Send webhook notification for delivery acceptance
      try {
        const riderProfile = await this.dispatchRiderService.getProfile(userId)
        await this.webhookService.notifyDispatchDeliveryAccepted(deliveryId, delivery, riderProfile)
      } catch (webhookError) {
        logger.warn("Failed to send dispatch delivery acceptance webhook:", webhookError)
      }

      res.json({
        success: true,
        message: "Delivery request accepted successfully",
        data: delivery,
      })
    } catch (error: any) {
      logger.error("Accept delivery request error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to accept delivery request",
      })
    }
  }

  async rejectDeliveryRequest(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.id

      await this.dispatchRiderService.rejectDeliveryRequest(userId, deliveryId, req.body.reason)

      res.json({
        success: true,
        message: "Delivery request rejected successfully",
      })
    } catch (error: any) {
      logger.error("Reject delivery request error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to reject delivery request",
      })
    }
  }

  async startPickup(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.id

      const delivery = await this.dispatchRiderService.startPickup(userId, deliveryId)

      // Send webhook notification for pickup start
      try {
        const riderProfile = await this.dispatchRiderService.getProfile(userId)
        await this.webhookService.notifyDispatchDeliveryStatusUpdate(
          deliveryId,
          "PICKUP_STARTED",
          delivery,
          riderProfile,
          { message: "Pickup has started" }
        )
      } catch (webhookError) {
        logger.warn("Failed to send dispatch pickup start webhook:", webhookError)
      }

      res.json({
        success: true,
        message: "Pickup started successfully",
        data: delivery,
      })
    } catch (error: any) {
      logger.error("Start pickup error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to start pickup",
      })
    }
  }

  async confirmPickup(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.id

      const delivery = await this.dispatchRiderService.confirmPickup(userId, deliveryId, req.body)

      // Send webhook notification for pickup confirmation
      try {
        const riderProfile = await this.dispatchRiderService.getProfile(userId)
        await this.webhookService.notifyDispatchDeliveryStatusUpdate(
          deliveryId,
          "PICKUP_CONFIRMED",
          delivery,
          riderProfile,
          { message: "Pickup confirmed successfully" }
        )
      } catch (webhookError) {
        logger.warn("Failed to send dispatch pickup confirmation webhook:", webhookError)
      }

      res.json({
        success: true,
        message: "Pickup confirmed successfully",
        data: delivery,
      })
    } catch (error: any) {
      logger.error("Confirm pickup error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to confirm pickup",
      })
    }
  }

  async startDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.id

      const delivery = await this.dispatchRiderService.startDelivery(userId, deliveryId)

      // Send webhook notification for delivery start
      try {
        const riderProfile = await this.dispatchRiderService.getProfile(userId)
        await this.webhookService.notifyDispatchDeliveryStatusUpdate(
          deliveryId,
          "DELIVERY_STARTED",
          delivery,
          riderProfile,
          { message: "Delivery has started" }
        )
      } catch (webhookError) {
        logger.warn("Failed to send dispatch delivery start webhook:", webhookError)
      }

      res.json({
        success: true,
        message: "Delivery started successfully",
        data: delivery,
      })
    } catch (error: any) {
      logger.error("Start delivery error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to start delivery",
      })
    }
  }

  async completeDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.id

      const delivery = await this.dispatchRiderService.completeDelivery(userId, deliveryId, req.body)

      // Send webhook notification for delivery completion
      try {
        const riderProfile = await this.dispatchRiderService.getProfile(userId)
        await this.webhookService.notifyDispatchDeliveryStatusUpdate(
          deliveryId,
          "DELIVERY_COMPLETED",
          delivery,
          riderProfile,
          {
            message: "Delivery completed successfully",
            earnings: (delivery as any).earnings || {}
          }
        )
      } catch (webhookError) {
        logger.warn("Failed to send dispatch delivery completion webhook:", webhookError)
      }

      res.json({
        success: true,
        message: "Delivery completed successfully",
        data: delivery,
      })
    } catch (error: any) {
      logger.error("Complete delivery error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to complete delivery",
      })
    }
  }

  async reportIssue(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.id

      const issue = await this.dispatchRiderService.reportIssue(userId, deliveryId, req.body)

      res.status(201).json({
        success: true,
        message: "Issue reported successfully",
        data: issue,
      })
    } catch (error: any) {
      logger.error("Report delivery issue error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to report issue",
      })
    }
  }

  async getDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const deliveries = await this.dispatchRiderService.getDispatchRiderDeliveries(userId, req.query as any)

      res.json({
        success: true,
        data: deliveries,
      })
    } catch (error: any) {
      logger.error("Get dispatch deliveries error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get deliveries",
      })
    }
  }

  async getEarnings(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const earnings = await this.dispatchRiderService.getDispatchRiderEarnings(userId, req.query as any)

      res.json({
        success: true,
        data: earnings,
      })
    } catch (error: any) {
      logger.error("Get dispatch earnings error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get earnings",
      })
    }
  }

  async getAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const analytics = await this.dispatchRiderService.getDispatchRiderAnalytics(userId)

      res.json({
        success: true,
        data: analytics,
      })
    } catch (error: any) {
      logger.error("Get dispatch analytics error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get analytics",
      })
    }
  }

  async getAllDispatchRiders(req: AuthenticatedRequest, res: Response) {
    try {
      const dispatchRiders = await this.dispatchRiderService.getAllDispatchRiders(req.query as any)

      res.json({
        success: true,
        data: dispatchRiders,
      })
    } catch (error: any) {
      logger.error("Get all dispatch riders error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get dispatch riders",
      })
    }
  }

  async verifyDispatchRider(req: AuthenticatedRequest, res: Response) {
    try {
      const dispatchRiderId = req.params.id
      const dispatchRider = await this.dispatchRiderService.verifyDispatchRider(dispatchRiderId)

      res.json({
        success: true,
        message: "Dispatch rider verified successfully",
        data: dispatchRider,
      })
    } catch (error: any) {
      logger.error("Verify dispatch rider error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to verify dispatch rider",
      })
    }
  }

  async suspendDispatchRider(req: AuthenticatedRequest, res: Response) {
    try {
      const dispatchRiderId = req.params.id
      const dispatchRider = await this.dispatchRiderService.suspendDispatchRider(dispatchRiderId, req.body.reason)

      res.json({
        success: true,
        message: "Dispatch rider suspended successfully",
        data: dispatchRider,
      })
    } catch (error: any) {
      logger.error("Suspend dispatch rider error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to suspend dispatch rider",
      })
    }
  }

  // Store-related delivery endpoints
  async markOrderReady(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const orderId = req.params.orderId

      const delivery = await this.dispatchRiderService.markOrderReady(orderId, userId, req.body)

      res.json({
        success: true,
        message: "Order marked as ready for pickup",
        data: delivery,
      })
    } catch (error: any) {
      logger.error("Mark order ready error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to mark order as ready",
      })
    }
  }

  async getStoreOrders(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const storeId = req.params.storeId

      const orders = await this.dispatchRiderService.getStoreOrders(storeId, userId, req.query as any)

      res.json({
        success: true,
        data: orders,
      })
    } catch (error: any) {
      logger.error("Get store orders error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get store orders",
      })
    }
  }

  async getDeliveryTracking(req: AuthenticatedRequest, res: Response) {
    try {
      const deliveryId = req.params.id

      const tracking = await this.dispatchRiderService.getDeliveryTracking(deliveryId)

      res.json({
        success: true,
        data: tracking,
      })
    } catch (error: any) {
      logger.error("Get delivery tracking error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get delivery tracking",
      })
    }
  }

  async updateDeliveryTracking(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.id

      await this.dispatchRiderService.updateDeliveryTracking(deliveryId, userId, req.body)

      res.json({
        success: true,
        message: "Delivery tracking updated successfully",
      })
    } catch (error: any) {
      logger.error("Update delivery tracking error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update delivery tracking",
      })
    }
  }

  async getPendingDeliveryRequests(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("=== GET PENDING DELIVERY REQUESTS ===")
      console.log("Request user:", req.user)
      console.log("====================================")

      if (!req.user?.id) {
        logger.error("Get pending delivery requests: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      console.log(`🔍 Getting pending delivery requests for dispatch rider: ${userId}`)

      const pendingRequests = await this.dispatchRiderService.getPendingDeliveryRequests(userId)

      console.log(`✅ Returning ${pendingRequests.length} pending delivery requests`)

      res.json({
        success: true,
        message: "Pending delivery requests retrieved successfully",
        data: pendingRequests,
      })
    } catch (error: any) {
      logger.error("Get pending delivery requests error:", error)
      console.error("❌ GET PENDING DELIVERY REQUESTS ERROR:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve pending delivery requests",
        error: error.message || "Unknown error",
      })
    }
  }

  async getActiveDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("=== GET ACTIVE DELIVERY REQUEST ===")
      console.log("Request user:", req.user)
      console.log("==================================")

      if (!req.user?.id) {
        logger.error("Get active delivery: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id

      const activeDelivery = await this.dispatchRiderService.getActiveDelivery(userId)

      if (!activeDelivery) {
        return res.json({
          success: true,
          message: "No active delivery found",
          data: null,
        })
      }

      res.json({
        success: true,
        message: "Active delivery retrieved successfully",
        data: activeDelivery,
      })
    } catch (error: any) {
      logger.error("Get active delivery error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve active delivery",
        error: error.message || "Unknown error",
      })
    }
  }

  async acceptDeliveryRequestEnhanced(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("=== ACCEPT DELIVERY REQUEST ENHANCED ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("=======================================")

      if (!req.user?.id) {
        logger.error("Accept delivery request: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const deliveryId = req.params.deliveryId

      // Check if dispatch rider has an active delivery
      const existingActiveDelivery = await this.dispatchRiderService.getActiveDelivery(userId)

      if (existingActiveDelivery) {
        return res.status(400).json({
          success: false,
          message: "You already have an active delivery. Complete it before accepting a new one.",
        })
      }

      // Use the existing acceptDeliveryRequest method with websocket functionality
      const result = await this.dispatchRiderService.acceptDeliveryRequest(userId, deliveryId)

      res.json({
        success: true,
        message: "Delivery request accepted successfully",
        data: result,
      })
    } catch (error: any) {
      logger.error("Accept delivery request enhanced error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to accept delivery request",
        error: error.message || "Unknown error",
      })
    }
  }

  async rejectDeliveryRequestEnhanced(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("=== REJECT DELIVERY REQUEST ENHANCED ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("=======================================")

      if (!req.user?.id) {
        logger.error("Reject delivery request: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const deliveryId = req.params.deliveryId
      const { reason } = req.body

      await this.dispatchRiderService.rejectDeliveryRequest(userId, deliveryId, reason)

      // Broadcast rejection via WebSocket for real-time updates
      try {
        const { io } = await import("../server")
        await io.broadcastToRole("ADMIN", "delivery_request_rejected", {
          deliveryId,
          dispatchRiderId: userId,
          reason,
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to broadcast delivery rejection:", error)
      }

      res.json({
        success: true,
        message: "Delivery request rejected successfully",
      })
    } catch (error: any) {
      logger.error("Reject delivery request enhanced error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to reject delivery request",
        error: error.message || "Unknown error",
      })
    }
  }
}
