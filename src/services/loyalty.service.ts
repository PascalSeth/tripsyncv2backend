import prisma from "../config/database"
import { NotificationService } from "./notification.service"
import { AnalyticsService } from "./analytics.service"
import logger from "../utils/logger"

interface LoyaltyPoints {
  earned: number
  spent: number
  balance: number
  tier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND"
  nextTierPoints: number
  tierBenefits: string[]
}

interface RewardItem {
  id: string
  name: string
  description: string
  pointsCost: number
  category: "DISCOUNT" | "FREE_RIDE" | "UPGRADE" | "MERCHANDISE" | "CASHBACK"
  value: number
  isActive: boolean
  expiryDays?: number
  usageLimit?: number
  tierRequirement?: string
}

interface LoyaltyTransaction {
  id: string
  userId: string
  type: "EARNED" | "SPENT" | "EXPIRED" | "BONUS" | "PENALTY"
  points: number
  description: string
  bookingId?: string
  rewardId?: string
  expiresAt?: Date
  createdAt: Date
}

interface MockLoyaltyTransaction {
  userId: string
  type: "EARNED" | "SPENT" | "EXPIRED" | "BONUS" | "PENALTY"
  points: number
  description: string
  bookingId?: string
  rewardId?: string
  expiresAt?: Date
  createdAt: Date
}

interface MockLoyaltyReward {
  id: string
  name: string
  description: string
  pointsCost: number
  category: string
  value: number
  isActive: boolean
  expiryDays?: number | null
  usageLimit?: number | null
  tierRequirement?: string | null
}

interface MockRewardRedemption {
  userId: string
  rewardId: string
  rewardCode: string
  pointsSpent: number
  status: string
  expiresAt?: Date | null
  reward: MockLoyaltyReward
}

export class LoyaltyService {
  private notificationService = new NotificationService()
  private analyticsService = new AnalyticsService()

  // Memory storage for missing models
  private loyaltyTransactions: MockLoyaltyTransaction[] = []
  private loyaltyRewards: MockLoyaltyReward[] = []
  private rewardRedemptions: MockRewardRedemption[] = []

  private readonly TIER_THRESHOLDS = {
    BRONZE: 0,
    SILVER: 1000,
    GOLD: 5000,
    PLATINUM: 15000,
    DIAMOND: 50000,
  }

  private readonly TIER_MULTIPLIERS = {
    BRONZE: 1.0,
    SILVER: 1.2,
    GOLD: 1.5,
    PLATINUM: 2.0,
    DIAMOND: 3.0,
  }

  private readonly POINTS_EXPIRY_DAYS = 365 // Points expire after 1 year

  constructor() {
    this.initializeDefaultRewards()
  }

  private initializeDefaultRewards() {
    this.loyaltyRewards = [
      {
        id: "1",
        name: "10% Discount",
        description: "Get 10% off your next ride",
        pointsCost: 500,
        category: "DISCOUNT",
        value: 10,
        isActive: true,
        expiryDays: 30,
        usageLimit: 1,
        tierRequirement: null,
      },
      {
        id: "2",
        name: "Free Ride",
        description: "Get a free ride up to ₦2000",
        pointsCost: 2000,
        category: "FREE_RIDE",
        value: 2000,
        isActive: true,
        expiryDays: 60,
        usageLimit: 1,
        tierRequirement: "SILVER",
      },
    ]
  }

  /**
   * Calculate and award points for a completed booking
   */
  async awardBookingPoints(bookingId: string): Promise<{
    pointsEarned: number
    bonusPoints: number
    newBalance: number
    tierUpdated: boolean
    newTier?: string
  }> {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: {
            include: { customerProfile: true },
          },
          serviceType: true,
        },
      })

      if (!booking || booking.status !== "COMPLETED") {
        throw new Error("Invalid booking for points calculation")
      }

      const userId = booking.customerId
      const finalPrice = booking.finalPrice || booking.estimatedPrice || 0

      // Calculate base points (1 point per ₦10 spent)
      const basePoints = Math.floor(finalPrice / 10)

      // Get current tier and multiplier
      const currentTier = await this.getUserTier(userId)
      const tierMultiplier = this.TIER_MULTIPLIERS[currentTier]

      // Calculate tier bonus points
      const tierBonusPoints = Math.floor(basePoints * (tierMultiplier - 1))

      // Calculate service-specific bonus
      const serviceBonusPoints = await this.calculateServiceBonus(booking.serviceType.name, basePoints)

      // Calculate streak bonus
      const streakBonusPoints = await this.calculateStreakBonus(userId, basePoints)

      // Calculate time-based bonus (off-peak hours)
      const timeBonusPoints = await this.calculateTimeBonus(booking.createdAt, basePoints)

      const totalBonusPoints = tierBonusPoints + serviceBonusPoints + streakBonusPoints + timeBonusPoints
      const totalPointsEarned = basePoints + totalBonusPoints

      // Award points
      await this.addLoyaltyTransaction({
        userId,
        type: "EARNED",
        points: totalPointsEarned,
        description: `Points earned from ${booking.serviceType.displayName} booking`,
        bookingId,
        expiresAt: new Date(Date.now() + this.POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      })

      // Update customer profile
      const updatedProfile = await prisma.customerProfile.update({
        where: { userId },
        data: {
          loyaltyPoints: {
            increment: totalPointsEarned,
          },
        },
      })

      // Check for tier upgrade
      const newTier = this.calculateTier(updatedProfile.loyaltyPoints)
      const tierUpdated = newTier !== currentTier

      if (tierUpdated) {
        await this.processTierUpgrade(userId, currentTier, newTier)
      }

      // Send notification
      await this.notificationService.notifyCustomer(userId, {
        type: "LOYALTY_POINTS",
        title: "Points Earned! 🎉",
        body: `You earned ${totalPointsEarned} loyalty points from your recent trip!`,
        data: {
          pointsEarned: totalPointsEarned,
          newBalance: updatedProfile.loyaltyPoints,
          tier: newTier,
        },
        priority: "STANDARD",
      })

      // Track analytics
      await this.analyticsService.trackEvent({
        userId,
        eventType: "LOYALTY_POINTS_EARNED",
        eventData: {
          bookingId,
          basePoints,
          bonusPoints: totalBonusPoints,
          totalPoints: totalPointsEarned,
          tier: newTier,
          tierUpdated,
        },
        timestamp: new Date(),
      })

      return {
        pointsEarned: totalPointsEarned,
        bonusPoints: totalBonusPoints,
        newBalance: updatedProfile.loyaltyPoints,
        tierUpdated,
        newTier: tierUpdated ? newTier : undefined,
      }
    } catch (error) {
      logger.error("Award booking points error:", error)
      throw error
    }
  }

  /**
   * Get user's loyalty status
   */
  async getLoyaltyStatus(userId: string): Promise<LoyaltyPoints> {
    try {
      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId },
      })

      if (!customerProfile) {
        throw new Error("Customer profile not found")
      }

      const balance = customerProfile.loyaltyPoints
      const tier = this.calculateTier(balance)
      const nextTier = this.getNextTier(tier)
      const nextTierPoints = nextTier ? this.TIER_THRESHOLDS[nextTier] - balance : 0

      // Get points breakdown from memory storage
      const transactions = this.loyaltyTransactions.filter((t) => t.userId === userId)

      const earned = transactions
        .filter((t: MockLoyaltyTransaction) => t.type === "EARNED" || t.type === "BONUS")
        .reduce((sum: number, t: MockLoyaltyTransaction) => sum + t.points, 0)

      const spent = transactions.filter((t) => t.type === "SPENT").reduce((sum, t) => sum + Math.abs(t.points), 0)

      return {
        earned,
        spent,
        balance,
        tier,
        nextTierPoints: Math.max(0, nextTierPoints),
        tierBenefits: this.getTierBenefits(tier),
      }
    } catch (error) {
      logger.error("Get loyalty status error:", error)
      throw error
    }
  }

  /**
   * Get available rewards
   */
  async getAvailableRewards(userId: string): Promise<RewardItem[]> {
    try {
      const loyaltyStatus = await this.getLoyaltyStatus(userId)

      const rewards = this.loyaltyRewards.filter(
        (reward) =>
          reward.isActive &&
          reward.pointsCost <= loyaltyStatus.balance &&
          (!reward.tierRequirement || reward.tierRequirement === loyaltyStatus.tier),
      )

      return rewards.map((reward: MockLoyaltyReward) => ({
        id: reward.id,
        name: reward.name,
        description: reward.description,
        pointsCost: reward.pointsCost,
        category: reward.category as any,
        value: reward.value,
        isActive: reward.isActive,
        expiryDays: reward.expiryDays || undefined,
        usageLimit: reward.usageLimit || undefined,
        tierRequirement: reward.tierRequirement || undefined,
      }))
    } catch (error) {
      logger.error("Get available rewards error:", error)
      throw error
    }
  }

  /**
   * Redeem a reward
   */
  async redeemReward(
    userId: string,
    rewardId: string,
  ): Promise<{
    success: boolean
    rewardCode?: string
    expiresAt?: Date
    newBalance: number
  }> {
    try {
      const reward = this.loyaltyRewards.find((r) => r.id === rewardId)
      const loyaltyStatus = await this.getLoyaltyStatus(userId)

      if (!reward || !reward.isActive) {
        throw new Error("Reward not found or inactive")
      }

      if (reward.pointsCost > loyaltyStatus.balance) {
        throw new Error("Insufficient points")
      }

      if (reward.tierRequirement && reward.tierRequirement !== loyaltyStatus.tier) {
        const tierIndex = Object.keys(this.TIER_THRESHOLDS).indexOf(loyaltyStatus.tier)
        const requiredTierIndex = Object.keys(this.TIER_THRESHOLDS).indexOf(reward.tierRequirement)

        if (tierIndex < requiredTierIndex) {
          throw new Error("Tier requirement not met")
        }
      }

      // Check usage limit
      if (reward.usageLimit) {
        const usageCount = this.loyaltyTransactions.filter(
          (t) => t.userId === userId && t.rewardId === rewardId && t.type === "SPENT",
        ).length

        if (usageCount >= reward.usageLimit) {
          throw new Error("Usage limit exceeded")
        }
      }

      // Generate reward code
      const rewardCode = this.generateRewardCode(reward.category as any)
      const expiresAt = reward.expiryDays ? new Date(Date.now() + reward.expiryDays * 24 * 60 * 60 * 1000) : undefined

      // Deduct points
      await this.addLoyaltyTransaction({
        userId,
        type: "SPENT",
        points: -reward.pointsCost,
        description: `Redeemed: ${reward.name}`,
        rewardId,
        expiresAt,
        createdAt: new Date(),
      })

      // Update customer profile
      const updatedProfile = await prisma.customerProfile.update({
        where: { userId },
        data: {
          loyaltyPoints: {
            decrement: reward.pointsCost,
          },
        },
      })

      // Store redemption
      this.rewardRedemptions.push({
        userId,
        rewardId,
        rewardCode,
        pointsSpent: reward.pointsCost,
        status: "ACTIVE",
        expiresAt,
        reward,
      })

      // Send notification
      await this.notificationService.notifyCustomer(userId, {
        type: "REWARD_REDEEMED",
        title: "Reward Redeemed! 🎁",
        body: `You've successfully redeemed ${reward.name}`,
        data: {
          rewardName: reward.name,
          rewardCode,
          pointsSpent: reward.pointsCost,
          newBalance: updatedProfile.loyaltyPoints,
        },
        priority: "STANDARD",
      })

      // Track analytics
      await this.analyticsService.trackEvent({
        userId,
        eventType: "REWARD_REDEEMED",
        eventData: {
          rewardId,
          rewardName: reward.name,
          pointsSpent: reward.pointsCost,
          rewardCode,
          category: reward.category,
        },
        timestamp: new Date(),
      })

      return {
        success: true,
        rewardCode,
        expiresAt,
        newBalance: updatedProfile.loyaltyPoints,
      }
    } catch (error) {
      logger.error("Redeem reward error:", error)
      throw error
    }
  }

  /**
   * Get loyalty analytics
   */
  async getLoyaltyAnalytics(dateRange?: { from: Date; to: Date }): Promise<{
    totalPointsEarned: number
    totalPointsSpent: number
    activeUsers: number
    tierDistribution: Record<string, number>
    topRewards: Array<{ name: string; redemptions: number }>
    averagePointsPerUser: number
    pointsExpiryRate: number
  }> {
    try {
      const where: any = {}
      if (dateRange) {
        where.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to,
        }
      }

      const [profiles] = await Promise.all([
        prisma.customerProfile.findMany({
          where: { loyaltyPoints: { gt: 0 } },
        }),
      ])

      // Filter transactions by date range
      const transactions = this.loyaltyTransactions.filter((t) => {
        if (!dateRange) return true
        return t.createdAt >= dateRange.from && t.createdAt <= dateRange.to
      })

      const redemptions = this.rewardRedemptions.filter((r) => {
        if (!dateRange) return true
        // Assuming createdAt exists on redemptions
        return true // Simplified for now
      })

      const totalPointsEarned = transactions
        .filter((t: MockLoyaltyTransaction) => t.type === "EARNED" || t.type === "BONUS")
        .reduce((sum: number, t: MockLoyaltyTransaction) => sum + t.points, 0)

      const totalPointsSpent = transactions
        .filter((t) => t.type === "SPENT")
        .reduce((sum, t) => sum + Math.abs(t.points), 0)

      const activeUsers = profiles.length

      // Tier distribution
      const tierDistribution: Record<string, number> = {
        BRONZE: 0,
        SILVER: 0,
        GOLD: 0,
        PLATINUM: 0,
        DIAMOND: 0,
      }

      profiles.forEach((profile: any) => {
        const tier = this.calculateTier(profile.loyaltyPoints)
        tierDistribution[tier]++
      })

      // Top rewards
      const rewardCounts = new Map<string, { name: string; count: number }>()
      redemptions.forEach((redemption: MockRewardRedemption) => {
        const existing = rewardCounts.get(redemption.rewardId)
        if (existing) {
          existing.count++
        } else {
          rewardCounts.set(redemption.rewardId, {
            name: redemption.reward.name,
            count: 1,
          })
        }
      })

      const topRewards = Array.from(rewardCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((item) => ({ name: item.name, redemptions: item.count }))

      const averagePointsPer = profiles.reduce((sum: number, p: any) => sum + p.loyaltyPoints, 0)
      const averagePointsPerUser = activeUsers > 0 ? averagePointsPer / activeUsers : 0

      // Calculate expiry rate (simplified)
      const expiredTransactions = transactions.filter(
        (t) => t.expiresAt && t.expiresAt < new Date() && t.type === "EARNED",
      )
      const pointsExpiryRate = totalPointsEarned > 0 ? (expiredTransactions.length / transactions.length) * 100 : 0

      return {
        totalPointsEarned,
        totalPointsSpent,
        activeUsers,
        tierDistribution,
        topRewards,
        averagePointsPerUser,
        pointsExpiryRate,
      }
    } catch (error) {
      logger.error("Get loyalty analytics error:", error)
      throw error
    }
  }

  /**
   * Process tier upgrade
   */
  private async processTierUpgrade(userId: string, oldTier: string, newTier: string): Promise<void> {
    try {
      // Award tier upgrade bonus
      const bonusPoints = this.getTierUpgradeBonus(newTier as keyof typeof this.TIER_THRESHOLDS)

      if (bonusPoints > 0) {
        await this.addLoyaltyTransaction({
          userId,
          type: "BONUS",
          points: bonusPoints,
          description: `Tier upgrade bonus: ${oldTier} → ${newTier}`,
          expiresAt: new Date(Date.now() + this.POINTS_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        })

        await prisma.customerProfile.update({
          where: { userId },
          data: {
            loyaltyPoints: {
              increment: bonusPoints,
            },
          },
        })
      }

      // Send congratulations notification
      await this.notificationService.notifyCustomer(userId, {
        type: "TIER_UPGRADE",
        title: `Congratulations! You're now ${newTier}! 🌟`,
        body: `You've been upgraded to ${newTier} tier and earned ${bonusPoints} bonus points!`,
        data: {
          oldTier,
          newTier,
          bonusPoints,
          benefits: this.getTierBenefits(newTier as keyof typeof this.TIER_THRESHOLDS),
        },
        priority: "STANDARD",
      })

      // Track analytics
      await this.analyticsService.trackEvent({
        userId,
        eventType: "TIER_UPGRADE",
        eventData: {
          oldTier,
          newTier,
          bonusPoints,
        },
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error("Process tier upgrade error:", error)
    }
  }

  private calculateTier(points: number): keyof typeof this.TIER_THRESHOLDS {
    if (points >= this.TIER_THRESHOLDS.DIAMOND) return "DIAMOND"
    if (points >= this.TIER_THRESHOLDS.PLATINUM) return "PLATINUM"
    if (points >= this.TIER_THRESHOLDS.GOLD) return "GOLD"
    if (points >= this.TIER_THRESHOLDS.SILVER) return "SILVER"
    return "BRONZE"
  }

  private getNextTier(currentTier: keyof typeof this.TIER_THRESHOLDS): keyof typeof this.TIER_THRESHOLDS | null {
    const tiers = Object.keys(this.TIER_THRESHOLDS) as Array<keyof typeof this.TIER_THRESHOLDS>
    const currentIndex = tiers.indexOf(currentTier)
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null
  }

  private getTierBenefits(tier: keyof typeof this.TIER_THRESHOLDS): string[] {
    const benefits = {
      BRONZE: ["Earn 1x points", "Basic customer support"],
      SILVER: ["Earn 1.2x points", "Priority customer support", "Exclusive offers"],
      GOLD: ["Earn 1.5x points", "Premium customer support", "Free cancellation", "Exclusive rewards"],
      PLATINUM: ["Earn 2x points", "VIP customer support", "Free upgrades", "Premium rewards", "Birthday bonus"],
      DIAMOND: [
        "Earn 3x points",
        "Dedicated account manager",
        "Complimentary upgrades",
        "Exclusive events",
        "Maximum rewards access",
      ],
    }
    return benefits[tier]
  }

  private getTierUpgradeBonus(tier: keyof typeof this.TIER_THRESHOLDS): number {
    const bonuses = {
      BRONZE: 0,
      SILVER: 200,
      GOLD: 500,
      PLATINUM: 1000,
      DIAMOND: 2500,
    }
    return bonuses[tier]
  }

  private async calculateServiceBonus(serviceType: string, basePoints: number): Promise<number> {
    // Different services can have different bonus multipliers
    const serviceBonuses: Record<string, number> = {
      "Premium Ride": 0.5,
      "Luxury Ride": 1.0,
      "Moving Service": 0.3,
      "Emergency Service": 0.2,
    }

    return Math.floor(basePoints * (serviceBonuses[serviceType] || 0))
  }

  private async calculateStreakBonus(userId: string, basePoints: number): Promise<number> {
    try {
      // Get recent bookings to calculate streak
      const recentBookings = await prisma.booking.findMany({
        where: {
          customerId: userId,
          status: "COMPLETED",
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })

      // Simple streak calculation - consecutive days with bookings
      const streak = this.calculateConsecutiveDays(recentBookings.map((b) => b.createdAt))

      if (streak >= 7) return Math.floor(basePoints * 0.5) // 50% bonus for 7+ day streak
      if (streak >= 3) return Math.floor(basePoints * 0.2) // 20% bonus for 3+ day streak

      return 0
    } catch (error) {
      logger.error("Calculate streak bonus error:", error)
      return 0
    }
  }

  private async calculateTimeBonus(bookingTime: Date, basePoints: number): Promise<number> {
    const hour = bookingTime.getHours()

    // Off-peak hours bonus (10 PM - 6 AM)
    if (hour >= 22 || hour <= 6) {
      return Math.floor(basePoints * 0.1) // 10% bonus for off-peak
    }

    return 0
  }

  private calculateConsecutiveDays(dates: Date[]): number {
    if (dates.length === 0) return 0

    const uniqueDays = Array.from(new Set(dates.map((date) => date.toISOString().split("T")[0]))).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    )

    let streak = 1
    for (let i = 1; i < uniqueDays.length; i++) {
      const current = new Date(uniqueDays[i])
      const previous = new Date(uniqueDays[i - 1])
      const diffDays = (previous.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)

      if (diffDays === 1) {
        streak++
      } else {
        break
      }
    }

    return streak
  }

  private generateRewardCode(category: string): string {
    const prefix = category.substring(0, 3).toUpperCase()
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${prefix}${timestamp}${random}`
  }

  private async getUserTier(userId: string): Promise<keyof typeof this.TIER_THRESHOLDS> {
    try {
      const profile = await prisma.customerProfile.findUnique({
        where: { userId },
      })

      if (!profile) return "BRONZE"

      return this.calculateTier(profile.loyaltyPoints)
    } catch (error) {
      logger.error("Get user tier error:", error)
      return "BRONZE"
    }
  }

  private async addLoyaltyTransaction(transaction: MockLoyaltyTransaction): Promise<void> {
    this.loyaltyTransactions.push(transaction)
  }
}
