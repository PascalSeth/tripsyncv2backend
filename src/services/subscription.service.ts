import prisma from "../config/database"
import { PaymentService } from "./payment.service"
import { NotificationService } from "./notification.service"
import logger from "../utils/logger"

interface SubscriptionPlan {
  id: string
  name: string
  tier: "BASIC" | "PREMIUM" | "ENTERPRISE"
  price: number
  duration: number // in days
  features: string[]
  isActive: boolean
}

interface SubscriptionBenefit {
  tier: string
  maxActiveBookings: number
  commissionDiscount: number
  prioritySupport: boolean
  advancedFeatures: string[]
}

export class SubscriptionService {
  private paymentService = new PaymentService()
  private notificationService = new NotificationService()

  private readonly SUBSCRIPTION_BENEFITS: Record<string, SubscriptionBenefit> = {
    BASIC: {
      tier: "BASIC",
      maxActiveBookings: 3,
      commissionDiscount: 0,
      prioritySupport: false,
      advancedFeatures: [],
    },
    PREMIUM: {
      tier: "PREMIUM",
      maxActiveBookings: 10,
      commissionDiscount: 0.05, // 5% discount
      prioritySupport: true,
      advancedFeatures: ["DAY_BOOKING", "PRIORITY_MATCHING"],
    },
    ENTERPRISE: {
      tier: "ENTERPRISE",
      maxActiveBookings: 50,
      commissionDiscount: 0.15, // 15% discount
      prioritySupport: true,
      advancedFeatures: ["DAY_BOOKING", "PRIORITY_MATCHING", "BULK_BOOKING", "ANALYTICS_DASHBOARD"],
    },
  }

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      return [
        {
          id: "basic",
          name: "Basic Plan",
          tier: "BASIC",
          price: 0,
          duration: 30,
          features: ["Standard ride booking", "Basic support", "3 active bookings"],
          isActive: true,
        },
        {
          id: "premium",
          name: "Premium Plan",
          tier: "PREMIUM",
          price: 5000,
          duration: 30,
          features: [
            "All Basic features",
            "Day booking",
            "Priority support",
            "10 active bookings",
            "5% commission discount",
          ],
          isActive: true,
        },
        {
          id: "enterprise",
          name: "Enterprise Plan",
          tier: "ENTERPRISE",
          price: 15000,
          duration: 30,
          features: [
            "All Premium features",
            "Bulk booking",
            "Analytics dashboard",
            "50 active bookings",
            "15% commission discount",
            "Dedicated account manager",
          ],
          isActive: true,
        },
      ]
    } catch (error) {
      logger.error("Get subscription plans error:", error)
      throw error
    }
  }

  async subscribeUser(userId: string, planId: string, paymentMethodId: string): Promise<any> {
    try {
      const plans = await this.getSubscriptionPlans()
      const plan = plans.find((p) => p.id === planId)

      if (!plan) {
        throw new Error("Subscription plan not found")
      }

      // Process payment if not free plan
      if (plan.price > 0) {
        await this.paymentService.processPayment({
          userId,
          bookingId: "", // Not applicable for subscriptions
          amount: plan.price,
          paymentMethodId,
          description: `Subscription to ${plan.name}`,
        })
      }

      // Update user subscription
      await prisma.customerProfile.update({
        where: { userId },
        data: {
          subscriptionTier: plan.tier,
          // Remove subscriptionStartDate and subscriptionEndDate as they don't exist in schema
        },
      })

      // Send confirmation notification
      await this.notificationService.notifyCustomer(userId, {
        type: "SUBSCRIPTION_ACTIVATED",
        title: "Subscription Activated",
        body: `Your ${plan.name} subscription has been activated successfully!`,
        data: { planId, tier: plan.tier },
        priority: "STANDARD",
      })

      return { success: true, plan }
    } catch (error) {
      logger.error("Subscribe user error:", error)
      throw error
    }
  }

  async checkSubscriptionBenefits(userId: string): Promise<SubscriptionBenefit> {
    try {
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId },
      })

      if (!customerProfile) {
        return this.SUBSCRIPTION_BENEFITS.BASIC
      }

      return this.SUBSCRIPTION_BENEFITS[customerProfile.subscriptionTier] || this.SUBSCRIPTION_BENEFITS.BASIC
    } catch (error) {
      logger.error("Check subscription benefits error:", error)
      return this.SUBSCRIPTION_BENEFITS.BASIC
    }
  }

  async renewSubscription(userId: string): Promise<void> {
    try {
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId },
      })

      if (!customerProfile) {
        throw new Error("Customer profile not found")
      }

      const plans = await this.getSubscriptionPlans()
      const currentPlan = plans.find((p) => p.tier === customerProfile.subscriptionTier)

      if (!currentPlan) {
        throw new Error("Current subscription plan not found")
      }

      // Update subscription (without date fields since they don't exist in schema)
      await prisma.customerProfile.update({
        where: { userId },
        data: {
          subscriptionTier: currentPlan.tier,
        },
      })

      await this.notificationService.notifyCustomer(userId, {
        type: "SUBSCRIPTION_RENEWED",
        title: "Subscription Renewed",
        body: `Your ${currentPlan.name} subscription has been renewed for another ${currentPlan.duration} days.`,
        data: { planId: currentPlan.id },
        priority: "STANDARD",
      })
    } catch (error) {
      logger.error("Renew subscription error:", error)
      throw error
    }
  }
}
