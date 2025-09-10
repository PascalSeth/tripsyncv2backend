import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { StoreDeliveryService } from "../services/store-delivery.service"
import { PurchaseConfirmationService } from "../services/purchase-confirmation.service"
import { WebhookService } from "../services/webhook.service"
import logger from "../utils/logger"

export class DeliveryController {
  private deliveryService = new StoreDeliveryService()
  private purchaseConfirmationService = new PurchaseConfirmationService()
  private webhookService = new WebhookService()

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
}