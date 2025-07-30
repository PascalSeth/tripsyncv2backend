import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { DispatchRiderService } from "../services/dispatch-rider.service"
import { FileUploadService } from "../services/file-upload.service"
import logger from "../utils/logger"

export class DispatchRiderController {
  private dispatchRiderService = new DispatchRiderService()
  private fileUploadService = new FileUploadService()

  async onboardDispatchRider(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const dispatchRiderProfile = await this.dispatchRiderService.onboardDispatchRider(userId, req.body)

      res.status(201).json({
        success: true,
        message: "Dispatch rider onboarded successfully",
        data: dispatchRiderProfile,
      })
    } catch (error: any) {
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
      const userId = req.user!.id

      const profile = await this.dispatchRiderService.updateAvailability(userId, req.body)

      res.json({
        success: true,
        message: "Availability updated successfully",
        data: profile,
      })
    } catch (error: any) {
      logger.error("Update dispatch availability error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update availability",
      })
    }
  }

  async updateLocation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      await this.dispatchRiderService.updateLocation(userId, req.body)

      res.json({
        success: true,
        message: "Location updated successfully",
      })
    } catch (error: any) {
      logger.error("Update dispatch location error:", error)
      res.status(400).json({
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
}
