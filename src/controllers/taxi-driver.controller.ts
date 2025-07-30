import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { TaxiDriverService } from "../services/taxi-driver.service"
import { FileUploadService } from "../services/file-upload.service"
import logger from "../utils/logger"

export class TaxiDriverController {
  private taxiDriverService = new TaxiDriverService()
  private fileUploadService = new FileUploadService()

  async onboardTaxiDriver(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const taxiDriverProfile = await this.taxiDriverService.onboardTaxiDriver(userId, req.body)

      res.status(201).json({
        success: true,
        message: "Taxi driver onboarded successfully",
        data: taxiDriverProfile,
      })
    } catch (error: any) {
      logger.error("Onboard taxi driver error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to onboard taxi driver",
      })
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const updatedProfile = await this.taxiDriverService.updateProfile(userId, req.body)

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: updatedProfile,
      })
    } catch (error: any) {
      logger.error("Update taxi driver profile error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update profile",
      })
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const profile = await this.taxiDriverService.getProfile(userId)

      res.json({
        success: true,
        data: profile,
      })
    } catch (error: any) {
      logger.error("Get taxi driver profile error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get profile",
      })
    }
  }

  async addVehicle(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const vehicle = await this.taxiDriverService.addVehicle(userId, req.body)

      res.status(201).json({
        success: true,
        message: "Vehicle added successfully",
        data: vehicle,
      })
    } catch (error: any) {
      logger.error("Add taxi vehicle error:", error)
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

      const vehicle = await this.taxiDriverService.updateVehicle(userId, vehicleId, req.body)

      res.json({
        success: true,
        message: "Vehicle updated successfully",
        data: vehicle,
      })
    } catch (error: any) {
      logger.error("Update taxi vehicle error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update vehicle",
      })
    }
  }

  async getVehicles(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const vehicles = await this.taxiDriverService.getVehicles(userId)

      res.json({
        success: true,
        data: vehicles,
      })
    } catch (error: any) {
      logger.error("Get taxi vehicles error:", error)
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

      const documentUrl = await this.fileUploadService.uploadDocument(file, `taxi-drivers/${userId}`)
      const document = await this.taxiDriverService.uploadDocument(userId, {
        ...req.body,
        documentUrl,
      })

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        data: document,
      })
    } catch (error: any) {
      logger.error("Upload taxi document error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to upload document",
      })
    }
  }

  async getDocuments(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const documents = await this.taxiDriverService.getDocuments(userId)

      res.json({
        success: true,
        data: documents,
      })
    } catch (error: any) {
      logger.error("Get taxi documents error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get documents",
      })
    }
  }

  async updateAvailability(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const profile = await this.taxiDriverService.updateAvailability(userId, req.body)

      res.json({
        success: true,
        message: "Availability updated successfully",
        data: profile,
      })
    } catch (error: any) {
      logger.error("Update taxi availability error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update availability",
      })
    }
  }

  async updateLocation(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      await this.taxiDriverService.updateLocation(userId, req.body)

      res.json({
        success: true,
        message: "Location updated successfully",
      })
    } catch (error: any) {
      logger.error("Update taxi location error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update location",
      })
    }
  }

  async updateOperatingHours(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const profile = await this.taxiDriverService.updateOperatingHours(userId, req.body.operatingHours)

      res.json({
        success: true,
        message: "Operating hours updated successfully",
        data: profile,
      })
    } catch (error: any) {
      logger.error("Update operating hours error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to update operating hours",
      })
    }
  }

  async getBookings(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const bookings = await this.taxiDriverService.getTaxiDriverBookings(userId, req.query as any)

      res.json({
        success: true,
        data: bookings,
      })
    } catch (error: any) {
      logger.error("Get taxi bookings error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get bookings",
      })
    }
  }

  async acceptBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const bookingId = req.params.id

      const booking = await this.taxiDriverService.acceptBooking(userId, bookingId)

      res.json({
        success: true,
        message: "Booking accepted successfully",
        data: booking,
      })
    } catch (error: any) {
      logger.error("Accept taxi booking error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to accept booking",
      })
    }
  }

  async rejectBooking(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const bookingId = req.params.id

      await this.taxiDriverService.rejectBooking(userId, bookingId, req.body.reason)

      res.json({
        success: true,
        message: "Booking rejected successfully",
      })
    } catch (error: any) {
      logger.error("Reject taxi booking error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to reject booking",
      })
    }
  }

  async arriveAtPickup(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const bookingId = req.params.id

      const booking = await this.taxiDriverService.arriveAtPickup(userId, bookingId)

      res.json({
        success: true,
        message: "Arrival confirmed successfully",
        data: booking,
      })
    } catch (error: any) {
      logger.error("Taxi arrive at pickup error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to confirm arrival",
      })
    }
  }

  async startTrip(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const bookingId = req.params.id

      const booking = await this.taxiDriverService.startTrip(userId, bookingId)

      res.json({
        success: true,
        message: "Trip started successfully",
        data: booking,
      })
    } catch (error: any) {
      logger.error("Start taxi trip error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to start trip",
      })
    }
  }

  async completeTrip(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const bookingId = req.params.id

      const booking = await this.taxiDriverService.completeTrip(userId, bookingId, req.body)

      res.json({
        success: true,
        message: "Trip completed successfully",
        data: booking,
      })
    } catch (error: any) {
      logger.error("Complete taxi trip error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to complete trip",
      })
    }
  }

  async getEarnings(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const earnings = await this.taxiDriverService.getTaxiDriverEarnings(userId, req.query as any)

      res.json({
        success: true,
        data: earnings,
      })
    } catch (error: any) {
      logger.error("Get taxi earnings error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get earnings",
      })
    }
  }

  async getAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id

      const analytics = await this.taxiDriverService.getTaxiDriverAnalytics(userId)

      res.json({
        success: true,
        data: analytics,
      })
    } catch (error: any) {
      logger.error("Get taxi analytics error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get analytics",
      })
    }
  }

  async getAllTaxiDrivers(req: AuthenticatedRequest, res: Response) {
    try {
      const taxiDrivers = await this.taxiDriverService.getAllTaxiDrivers(req.query as any)

      res.json({
        success: true,
        data: taxiDrivers,
      })
    } catch (error: any) {
      logger.error("Get all taxi drivers error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to get taxi drivers",
      })
    }
  }

  async verifyTaxiDriver(req: AuthenticatedRequest, res: Response) {
    try {
      const taxiDriverId = req.params.id
      const taxiDriver = await this.taxiDriverService.verifyTaxiDriver(taxiDriverId)

      res.json({
        success: true,
        message: "Taxi driver verified successfully",
        data: taxiDriver,
      })
    } catch (error: any) {
      logger.error("Verify taxi driver error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to verify taxi driver",
      })
    }
  }

  async suspendTaxiDriver(req: AuthenticatedRequest, res: Response) {
    try {
      const taxiDriverId = req.params.id
      const taxiDriver = await this.taxiDriverService.suspendTaxiDriver(taxiDriverId, req.body.reason)

      res.json({
        success: true,
        message: "Taxi driver suspended successfully",
        data: taxiDriver,
      })
    } catch (error: any) {
      logger.error("Suspend taxi driver error:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to suspend taxi driver",
      })
    }
  }
}
