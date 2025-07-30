import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { SubscriptionService } from "../services/subscription.service"
import logger from "../utils/logger"

export class SubscriptionController {
  private subscriptionService = new SubscriptionService()

  getPlans = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const plans = await this.subscriptionService.getSubscriptionPlans()

      res.json({
        success: true,
        message: "Subscription plans retrieved successfully",
        data: plans,
      })
    } catch (error) {
      logger.error("Get subscription plans error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve subscription plans",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  subscribe = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { planId, paymentMethodId } = req.body

      const result = await this.subscriptionService.subscribeUser(userId, planId, paymentMethodId)

      res.json({
        success: true,
        message: "Subscription activated successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Subscribe user error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to activate subscription",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getBenefits = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id

      const benefits = await this.subscriptionService.checkSubscriptionBenefits(userId)

      res.json({
        success: true,
        message: "Subscription benefits retrieved successfully",
        data: benefits,
      })
    } catch (error) {
      logger.error("Get subscription benefits error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve subscription benefits",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  renewSubscription = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id

      await this.subscriptionService.renewSubscription(userId)

      res.json({
        success: true,
        message: "Subscription renewed successfully",
      })
    } catch (error) {
      logger.error("Renew subscription error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to renew subscription",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
