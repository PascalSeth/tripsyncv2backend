import cron from "node-cron"
import prisma from "../config/database"
import { PaymentService } from "./payment.service"
import { NotificationService } from "./notification.service"
import { RBACService } from "./rbac.service"
import logger from "../utils/logger"

export function startCronJobs() {
  const paymentService = new PaymentService()
  const notificationService = new NotificationService()
  const rbacService = new RBACService()

  // Generate monthly commission bills (runs on 1st of every month at 00:00)
  cron.schedule("0 0 1 * *", async () => {
    logger.info("Starting monthly commission bill generation...")

    try {
      await generateMonthlyCommissionBills()
      logger.info("Monthly commission bills generated successfully")
    } catch (error) {
      logger.error("Monthly commission bill generation failed:", error)
    }
  })

  // Send commission payment reminders (runs daily at 09:00)
  cron.schedule("0 9 * * *", async () => {
    logger.info("Sending commission payment reminders...")

    try {
      await sendCommissionReminders()
      logger.info("Commission payment reminders sent successfully")
    } catch (error) {
      logger.error("Commission payment reminders failed:", error)
    }
  })

  // Process pending payouts (runs every hour)
  cron.schedule("0 * * * *", async () => {
    logger.info("Processing pending payouts...")

    try {
      await paymentService.processPendingPayouts()
      logger.info("Pending payouts processed successfully")
    } catch (error) {
      logger.error("Pending payouts processing failed:", error)
    }
  })

  // Clean up expired sessions (runs daily at 02:00)
  cron.schedule("0 2 * * *", async () => {
    logger.info("Cleaning up expired sessions...")

    try {
      await cleanupExpiredSessions()
      logger.info("Expired sessions cleaned up successfully")
    } catch (error) {
      logger.error("Session cleanup failed:", error)
    }
  })

  // Update provider ratings (runs daily at 03:00)
  cron.schedule("0 3 * * *", async () => {
    logger.info("Updating provider ratings...")

    try {
      await updateProviderRatings()
      logger.info("Provider ratings updated successfully")
    } catch (error) {
      logger.error("Provider ratings update failed:", error)
    }
  })

  // Clear RBAC cache (runs every 6 hours)
  cron.schedule("0 */6 * * *", async () => {
    logger.info("Clearing RBAC cache...")
    rbacService.clearCache()
    logger.info("RBAC cache cleared successfully")
  })

  logger.info("✅ Cron jobs started successfully")
}

async function generateMonthlyCommissionBills() {
  const lastMonth = new Date()
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  const billingMonth = lastMonth.getMonth() + 1
  const billingYear = lastMonth.getFullYear()

  // Get all service providers with earnings last month
  const providersWithEarnings = await prisma.booking.groupBy({
    by: ["providerId"],
    where: {
      status: "COMPLETED",
      completedAt: {
        gte: new Date(billingYear, billingMonth - 1, 1),
        lt: new Date(billingYear, billingMonth, 1),
      },
      providerId: { not: null },
    },
    _sum: {
      providerEarning: true,
      platformCommission: true,
    },
    _count: {
      id: true,
    },
  })

  for (const provider of providersWithEarnings) {
    if (!provider.providerId) continue

    // Check if bill already exists
    const existingBill = await prisma.monthlyCommissionBill.findUnique({
      where: {
        userId_billingMonth_billingYear: {
          userId: provider.providerId,
          billingMonth,
          billingYear,
        },
      },
    })

    if (existingBill) continue

    // Create new bill
    const totalEarnings = provider._sum.providerEarning || 0
    const calculatedCommission = totalEarnings * 0.18
    const dueDate = new Date(billingYear, billingMonth, 15) // Due on 15th of current month

    await prisma.monthlyCommissionBill.create({
      data: {
        userId: provider.providerId,
        billingMonth,
        billingYear,
        totalEarnings,
        totalRides: provider._count.id,
        calculatedCommission,
        finalCommissionDue: calculatedCommission,
        status: "PENDING",
        dueDate,
      },
    })
  }
}

async function sendCommissionReminders() {
  const today = new Date()
  const reminderDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000) // 3 days from now

  const upcomingBills = await prisma.monthlyCommissionBill.findMany({
    where: {
      status: "PENDING",
      dueDate: {
        lte: reminderDate,
        gte: today,
      },
    },
    include: {
      user: true,
    },
  })

  const notificationService = new NotificationService()

  for (const bill of upcomingBills) {
    await notificationService.notifyCustomer(bill.userId, {
      type: "COMMISSION_DUE",
      title: "Commission Payment Due",
      body: `Your monthly commission payment of ₦${bill.finalCommissionDue} is due on ${bill.dueDate.toDateString()}`,
      data: {
        billId: bill.id,
        amount: bill.finalCommissionDue,
        dueDate: bill.dueDate,
      },
      priority: "CRITICAL",
    })
  }
}

async function cleanupExpiredSessions() {
  const expiredSessions = await prisma.userSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })

  logger.info(`Cleaned up ${expiredSessions.count} expired sessions`)
}

async function updateProviderRatings() {
  // Update driver ratings
  const drivers = await prisma.driverProfile.findMany({
    include: {
      user: {
        include: {
          reviewsReceived: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          },
        },
      },
    },
  })

  for (const driver of drivers) {
    const reviews = driver.user.reviewsReceived
    if (reviews.length > 0) {
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length

      await prisma.driverProfile.update({
        where: { id: driver.id },
        data: { rating: averageRating },
      })
    }
  }

  // Update delivery profile ratings
  const deliveryProfiles = await prisma.deliveryProfile.findMany({
    include: {
      user: {
        include: {
          reviewsReceived: {
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      },
    },
  })

  for (const profile of deliveryProfiles) {
    const reviews = profile.user.reviewsReceived
    if (reviews.length > 0) {
      const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length

      await prisma.deliveryProfile.update({
        where: { id: profile.id },
        data: { rating: averageRating },
      })
    }
  }
}
