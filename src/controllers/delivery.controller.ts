import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { StoreDeliveryService } from "../services/store-delivery.service"
import { PurchaseConfirmationService } from "../services/purchase-confirmation.service"
import { WebhookService } from "../services/webhook.service"
import { NotificationService } from "../services/notification.service"
import { Delivery, Prisma } from "@prisma/client"
import prisma from "../config/database"
import logger from "../utils/logger"

export class DeliveryController {
  private deliveryService = new StoreDeliveryService()
  private purchaseConfirmationService = new PurchaseConfirmationService()
  private webhookService = new WebhookService()
  private notificationService = new NotificationService()

  /**
   * Calculate delivery estimate for store purchase
   */
  async calculateStorePurchaseDeliveryEstimate(req: AuthenticatedRequest, res: Response) {
    try {
      const { storeId, customerLatitude, customerLongitude, items } = req.body

      if (!storeId || !customerLatitude || !customerLongitude || !items) {
        return res.status(400).json({
          success: false,
          message: "storeId, customerLatitude, customerLongitude, and items are required"
        })
      }

      const estimate = await this.deliveryService.calculateStorePurchaseDeliveryEstimate({
        storeId,
        customerLatitude: Number(customerLatitude),
        customerLongitude: Number(customerLongitude),
        items
      })

      res.json({
        success: true,
        message: "Delivery estimate calculated successfully",
        data: estimate
      })
    } catch (error: any) {
      logger.error("Calculate delivery estimate error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to calculate delivery estimate"
      })
    }
  }

  /**
   * Create store purchase delivery request
   */
  async createStorePurchaseDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryData = req.body

      // Add customer ID from authenticated user
      deliveryData.customerId = userId

      const result = await this.deliveryService.createStorePurchaseDelivery(deliveryData)

      // Send webhook notification for delivery request
      try {
        // For now, just send a generic webhook for delivery creation
        await this.webhookService.notifyDeliveryCreated(
          result.order.id,
          result.order.id,
          {
            deliveryData: result,
            customerId: userId,
            type: "store_purchase"
          }
        )
      } catch (webhookError) {
        logger.warn("Failed to send delivery creation webhook:", webhookError)
      }

      res.status(201).json({
        success: true,
        message: "Store purchase delivery created successfully",
        data: result
      })
    } catch (error: any) {
      logger.error("Create store purchase delivery error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create delivery"
      })
    }
  }

  /**
   * Create user-to-user delivery request
   */
  async createUserToUserDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryData = req.body

      // Add sender ID from authenticated user
      deliveryData.senderId = userId

      const result = await this.deliveryService.createUserToUserDelivery(deliveryData)

      // Send webhook notification for delivery request
      try {
        await this.webhookService.notifyDeliveryCreated(
          result.order.id,
          result.order.id,
          {
            deliveryData: result,
            senderId: userId,
            type: "user_to_user"
          }
        )
      } catch (webhookError) {
        logger.warn("Failed to send user-to-user delivery creation webhook:", webhookError)
      }

      res.status(201).json({
        success: true,
        message: "User-to-user delivery created successfully",
        data: result
      })
    } catch (error: any) {
      logger.error("Create user-to-user delivery error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to create delivery"
      })
    }
  }

  /**
   * Get delivery tracking information
   */
  async getDeliveryTracking(req: AuthenticatedRequest, res: Response) {
    try {
      const { trackingCode } = req.params

      if (!trackingCode) {
        return res.status(400).json({
          success: false,
          message: "Tracking code is required"
        })
      }

      const tracking = await this.deliveryService.getDeliveryTracking(trackingCode)

      res.json({
        success: true,
        message: "Delivery tracking retrieved successfully",
        data: tracking
      })
    } catch (error: any) {
      logger.error("Get delivery tracking error:", error)
      res.status(404).json({
        success: false,
        message: error.message || "Delivery not found"
      })
    }
  }

  /**
   * Get delivery statistics (Admin only)
   */
  async getDeliveryStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      const { startDate, endDate, storeId } = req.query

      const stats = await this.deliveryService.getDeliveryStatistics({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        storeId: storeId as string
      })

      res.json({
        success: true,
        message: "Delivery statistics retrieved successfully",
        data: stats
      })
    } catch (error: any) {
      logger.error("Get delivery statistics error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get delivery statistics"
      })
    }
  }

  /**
   * Confirm a purchase (Store owner only)
   */
  async confirmPurchase(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const { confirmationToken } = req.body

      if (!confirmationToken) {
        return res.status(400).json({
          success: false,
          message: "Confirmation token is required"
        })
      }

      const result = await this.deliveryService.confirmPurchase(confirmationToken, userId)

      res.json({
        success: true,
        message: "Purchase confirmed successfully",
        data: result
      })
    } catch (error: any) {
      logger.error("Confirm purchase error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to confirm purchase"
      })
    }
  }

  /**
   * Get purchase confirmation details
   */
  async getPurchaseConfirmation(req: AuthenticatedRequest, res: Response) {
    try {
      const { token } = req.params

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Confirmation token is required"
        })
      }

      const confirmation = await this.purchaseConfirmationService.getPurchaseConfirmation(token)

      if (!confirmation) {
        return res.status(404).json({
          success: false,
          message: "Purchase confirmation not found"
        })
      }

      res.json({
        success: true,
        message: "Purchase confirmation retrieved successfully",
        data: confirmation
      })
    } catch (error: any) {
      logger.error("Get purchase confirmation error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get purchase confirmation"
      })
    }
  }

  /**
   * Send reminder emails for pending confirmations (Admin only)
   */
  async sendReminderEmails(req: AuthenticatedRequest, res: Response) {
    try {
      await this.purchaseConfirmationService.sendReminderEmails()

      res.json({
        success: true,
        message: "Reminder emails sent successfully"
      })
    } catch (error: any) {
      logger.error("Send reminder emails error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to send reminder emails"
      })
    }
  }

  /**
   * Get pending deliveries for dispatch riders or super admin
   */
  async getPendingDeliveries(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const userRole = req.user!.role

      let dispatchRiderProfile: any = null

      // Check if user is super admin
      if (userRole === 'SUPER_ADMIN') {
        console.log('Super admin accessing all pending deliveries')
      } else {
        // Regular dispatch rider - check their profile
        dispatchRiderProfile = await prisma.deliveryProfile.findUnique({
          where: { userId },
          include: { user: true }
        })

        if (!dispatchRiderProfile || !dispatchRiderProfile.isVerified || !dispatchRiderProfile.isAvailable) {
          return res.status(403).json({
            success: false,
            message: "Dispatch rider not verified or not available"
          })
        }
      }

      // Find pending deliveries within rider's service area
      const pendingDeliveries = await prisma.delivery.findMany({
        where: {
          status: "PENDING",
          dispatchRiderId: null, // Not yet assigned
        },
        include: {
          order: {
            include: {
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true
                }
              },
              store: {
                select: {
                  name: true,
                  contactPhone: true
                },
                include: {
                  location: true
                }
              }
            }
          },
          pickupLocation: true,
          deliveryLocation: true
        },
        orderBy: { createdAt: "desc" },
        take: 20
      })

      // Filter by distance if rider has location (skip for super admin)
      let filteredDeliveries = pendingDeliveries
      if (userRole !== 'SUPER_ADMIN' && dispatchRiderProfile?.currentLatitude && dispatchRiderProfile?.currentLongitude) {
        filteredDeliveries = pendingDeliveries.filter((delivery: Prisma.DeliveryGetPayload<{
          include: {
            pickupLocation: true,
            deliveryLocation: true,
            order: {
              include: {
                customer: { select: { firstName: true, lastName: true, phone: true } },
                store: { select: { name: true, contactPhone: true }, include: { location: true } }
              }
            }
          }
        }>) => {
          if (!delivery.pickupLocation) return false

          const distance = this.calculateDistance(
            dispatchRiderProfile.currentLatitude!,
            dispatchRiderProfile.currentLongitude!,
            delivery.pickupLocation.latitude,
            delivery.pickupLocation.longitude
          )

          return distance <= (dispatchRiderProfile.maxDeliveryDistance || 50000)
        })
      }

      res.json({
        success: true,
        message: "Pending deliveries retrieved successfully",
        data: filteredDeliveries
      })
    } catch (error: any) {
      logger.error("Get pending deliveries error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get pending deliveries"
      })
    }
  }

  /**
   * Accept a delivery request for dispatch rider or super admin
   */
  async acceptDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const userRole = req.user!.role
      const deliveryId = req.params.deliveryId

      let dispatchRiderProfile: any = null

      // Check if user is super admin
      if (userRole !== 'SUPER_ADMIN') {
        // Regular dispatch rider - check their profile
        dispatchRiderProfile = await prisma.deliveryProfile.findUnique({
          where: { userId },
          include: { user: true }
        })

        if (!dispatchRiderProfile || !dispatchRiderProfile.isVerified || !dispatchRiderProfile.isAvailable) {
          return res.status(403).json({
            success: false,
            message: "Dispatch rider not verified or not available"
          })
        }
      }

      // Check if rider already has an active delivery
      const activeDelivery = await prisma.delivery.findFirst({
        where: {
          dispatchRiderId: userId,
          status: {
            in: ["ASSIGNED", "PICKUP_IN_PROGRESS", "PICKED_UP", "IN_TRANSIT"]
          }
        }
      })

      if (activeDelivery) {
        return res.status(400).json({
          success: false,
          message: "You already have an active delivery"
        })
      }

      // Get delivery details
      const delivery = await prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: {
          order: {
            include: {
              customer: true,
              store: true
            }
          },
          pickupLocation: true,
          deliveryLocation: true
        }
      })

      if (!delivery || delivery.status !== "PENDING") {
        return res.status(404).json({
          success: false,
          message: "Delivery not found or not available"
        })
      }

      // Update delivery
      const updatedDelivery = await prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          dispatchRiderId: userId,
          status: "ASSIGNED",
          assignedAt: new Date()
        },
        include: {
          order: {
            include: {
              customer: true,
              store: true
            }
          }
        }
      })

      // Update rider availability (only for regular dispatch riders)
      if (dispatchRiderProfile) {
        await prisma.deliveryProfile.update({
          where: { id: dispatchRiderProfile.id },
          data: { isAvailable: false }
        })
      }

      // Notify customer and store
      const riderInfo = dispatchRiderProfile ?
        {
          name: `${dispatchRiderProfile.user.firstName} ${dispatchRiderProfile.user.lastName}`,
          phone: dispatchRiderProfile.user.phone
        } :
        {
          name: "Super Admin",
          phone: "Platform Support"
        }

      await this.notificationService.notifyCustomer(delivery.order.customerId, {
        type: "DISPATCH_RIDER_ASSIGNED",
        title: "Delivery Rider Assigned",
        body: `${riderInfo.name} will deliver your order`,
        data: {
          deliveryId,
          dispatchRiderName: riderInfo.name,
          dispatchRiderPhone: riderInfo.phone
        }
      })

      res.json({
        success: true,
        message: "Delivery accepted successfully",
        data: updatedDelivery
      })
    } catch (error: any) {
      logger.error("Accept delivery error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to accept delivery"
      })
    }
  }

  /**
   * Reject a delivery request
   */
  async rejectDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const deliveryId = req.params.deliveryId
      const { reason } = req.body

      // Log rejection
      await prisma.deliveryRejection.create({
        data: {
          deliveryId,
          dispatchRiderId: userId,
          reason: reason || "No reason provided"
        }
      })

      res.json({
        success: true,
        message: "Delivery rejected successfully"
      })
    } catch (error: any) {
      logger.error("Reject delivery error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to reject delivery"
      })
    }
  }

  /**
   * Update delivery status for dispatch rider or super admin
   */
  async updateDeliveryStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const userRole = req.user!.role
      const deliveryId = req.params.deliveryId
      const { status, notes, location } = req.body

      let where: any = { id: deliveryId }

      // Check if user is super admin
      if (userRole !== 'SUPER_ADMIN') {
        // Regular dispatch rider - verify ownership
        where.dispatchRiderId = userId
      }

      // Verify delivery ownership
      const delivery = await prisma.delivery.findFirst({
        where
      })

      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found or not assigned to you"
        })
      }

      const updateData: any = { status }

      // Add timestamps based on status
      if (status === "PICKUP_IN_PROGRESS") {
        updateData.pickupStartedAt = new Date()
      } else if (status === "PICKED_UP") {
        updateData.pickedUpAt = new Date()
        updateData.pickupNotes = notes
      } else if (status === "IN_TRANSIT") {
        updateData.deliveryStartedAt = new Date()
      } else if (status === "DELIVERED") {
        updateData.deliveredAt = new Date()
        updateData.deliveryNotes = notes
      }

      const updatedDelivery = await prisma.delivery.update({
        where: { id: deliveryId },
        data: updateData
      })

      // Add tracking update
      if (location) {
        await prisma.deliveryTracking.create({
          data: {
            deliveryId,
            latitude: location.latitude,
            longitude: location.longitude,
            status,
            message: notes || `Status updated to ${status}`
          }
        })
      }

      res.json({
        success: true,
        message: "Delivery status updated successfully",
        data: updatedDelivery
      })
    } catch (error: any) {
      logger.error("Update delivery status error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update delivery status"
      })
    }
  }

  /**
   * Get active delivery for dispatch rider or super admin
   */
  async getActiveDelivery(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user!.id
      const userRole = req.user!.role

      let where: any = {
        status: {
          in: ["ASSIGNED", "PICKUP_IN_PROGRESS", "PICKED_UP", "IN_TRANSIT"]
        }
      }

      // Check if user is super admin
      if (userRole !== 'SUPER_ADMIN') {
        // Regular dispatch rider - filter by their deliveries
        where.dispatchRiderId = userId
      }

      const activeDelivery = await prisma.delivery.findFirst({
        where,
        include: {
          order: {
            include: {
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                  phone: true
                }
              },
              store: {
                select: {
                  name: true,
                  contactPhone: true
                }
              }
            }
          },
          pickupLocation: true,
          deliveryLocation: true
        }
      })

      if (!activeDelivery) {
        return res.json({
          success: true,
          message: "No active delivery found",
          data: null
        })
      }

      res.json({
        success: true,
        message: "Active delivery retrieved successfully",
        data: activeDelivery
      })
    } catch (error: any) {
      logger.error("Get active delivery error:", error)
      res.status(500).json({
        success: false,
        message: error.message || "Failed to get active delivery"
      })
    }
  }

  /**
   * Calculate distance between two points (helper method)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371 // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1)
    const dLon = this.deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d * 1000 // Convert to meters
  }

  /**
   * Convert degrees to radians (helper method)
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180)
  }
}