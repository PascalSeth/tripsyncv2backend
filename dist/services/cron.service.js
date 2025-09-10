"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = startCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const database_1 = __importDefault(require("../config/database"));
const payment_service_1 = require("./payment.service");
const notification_service_1 = require("./notification.service");
const rbac_service_1 = require("./rbac.service");
const logger_1 = __importDefault(require("../utils/logger"));
function startCronJobs() {
    const paymentService = new payment_service_1.PaymentService();
    const notificationService = new notification_service_1.NotificationService();
    const rbacService = new rbac_service_1.RBACService();
    // Generate monthly commission bills (runs on 1st of every month at 00:00)
    node_cron_1.default.schedule("0 0 1 * *", async () => {
        logger_1.default.info("Starting monthly commission bill generation...");
        try {
            await generateMonthlyCommissionBills();
            logger_1.default.info("Monthly commission bills generated successfully");
        }
        catch (error) {
            logger_1.default.error("Monthly commission bill generation failed:", error);
        }
    });
    // Send commission payment reminders (runs daily at 09:00)
    node_cron_1.default.schedule("0 9 * * *", async () => {
        logger_1.default.info("Sending commission payment reminders...");
        try {
            await sendCommissionReminders();
            logger_1.default.info("Commission payment reminders sent successfully");
        }
        catch (error) {
            logger_1.default.error("Commission payment reminders failed:", error);
        }
    });
    // Process pending payouts (runs every hour)
    node_cron_1.default.schedule("0 * * * *", async () => {
        logger_1.default.info("Processing pending payouts...");
        try {
            await paymentService.processPendingPayouts();
            logger_1.default.info("Pending payouts processed successfully");
        }
        catch (error) {
            logger_1.default.error("Pending payouts processing failed:", error);
        }
    });
    // Clean up expired sessions (runs daily at 02:00)
    node_cron_1.default.schedule("0 2 * * *", async () => {
        logger_1.default.info("Cleaning up expired sessions...");
        try {
            await cleanupExpiredSessions();
            logger_1.default.info("Expired sessions cleaned up successfully");
        }
        catch (error) {
            logger_1.default.error("Session cleanup failed:", error);
        }
    });
    // Update provider ratings (runs daily at 03:00)
    node_cron_1.default.schedule("0 3 * * *", async () => {
        logger_1.default.info("Updating provider ratings...");
        try {
            await updateProviderRatings();
            logger_1.default.info("Provider ratings updated successfully");
        }
        catch (error) {
            logger_1.default.error("Provider ratings update failed:", error);
        }
    });
    // Clear RBAC cache (runs every 6 hours)
    node_cron_1.default.schedule("0 */6 * * *", async () => {
        logger_1.default.info("Clearing RBAC cache...");
        rbacService.clearCache();
        logger_1.default.info("RBAC cache cleared successfully");
    });
    logger_1.default.info("✅ Cron jobs started successfully");
}
async function generateMonthlyCommissionBills() {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const billingMonth = lastMonth.getMonth() + 1;
    const billingYear = lastMonth.getFullYear();
    // Get all service providers with earnings last month
    const providersWithEarnings = await database_1.default.booking.groupBy({
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
    });
    for (const provider of providersWithEarnings) {
        if (!provider.providerId)
            continue;
        // Check if bill already exists
        const existingBill = await database_1.default.monthlyCommissionBill.findUnique({
            where: {
                userId_billingMonth_billingYear: {
                    userId: provider.providerId,
                    billingMonth,
                    billingYear,
                },
            },
        });
        if (existingBill)
            continue;
        // Create new bill
        const totalEarnings = provider._sum.providerEarning || 0;
        const calculatedCommission = totalEarnings * 0.18;
        const dueDate = new Date(billingYear, billingMonth, 15); // Due on 15th of current month
        await database_1.default.monthlyCommissionBill.create({
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
        });
    }
}
async function sendCommissionReminders() {
    const today = new Date();
    const reminderDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const upcomingBills = await database_1.default.monthlyCommissionBill.findMany({
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
    });
    const notificationService = new notification_service_1.NotificationService();
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
        });
    }
}
async function cleanupExpiredSessions() {
    const expiredSessions = await database_1.default.userSession.deleteMany({
        where: {
            expiresAt: {
                lt: new Date(),
            },
        },
    });
    logger_1.default.info(`Cleaned up ${expiredSessions.count} expired sessions`);
}
async function updateProviderRatings() {
    // Update driver ratings
    const drivers = await database_1.default.driverProfile.findMany({
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
    });
    for (const driver of drivers) {
        const reviews = driver.user.reviewsReceived;
        if (reviews.length > 0) {
            const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
            await database_1.default.driverProfile.update({
                where: { id: driver.id },
                data: { rating: averageRating },
            });
        }
    }
    // Update delivery profile ratings
    const deliveryProfiles = await database_1.default.deliveryProfile.findMany({
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
    });
    for (const profile of deliveryProfiles) {
        const reviews = profile.user.reviewsReceived;
        if (reviews.length > 0) {
            const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
            await database_1.default.deliveryProfile.update({
                where: { id: profile.id },
                data: { rating: averageRating },
            });
        }
    }
}
