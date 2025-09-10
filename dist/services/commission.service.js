"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionService = void 0;
const database_1 = __importDefault(require("../config/database"));
const payment_service_1 = require("./payment.service");
const notification_service_1 = require("./notification.service");
const email_service_1 = require("./email.service");
const logger_1 = __importDefault(require("../utils/logger"));
class CommissionService {
    constructor() {
        this.paymentService = new payment_service_1.PaymentService();
        this.notificationService = new notification_service_1.NotificationService();
        this.emailService = new email_service_1.EmailService();
    }
    async generateMonthlyCommissionBills() {
        try {
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
                    finalPrice: true,
                    platformCommission: true,
                },
                _count: true,
            });
            for (const provider of providersWithEarnings) {
                if (!provider.providerId)
                    continue;
                const totalEarnings = provider._sum.finalPrice || 0;
                const commissionAmount = provider._sum.platformCommission || 0;
                // Create commission bill using correct field names
                const bill = await database_1.default.monthlyCommissionBill.create({
                    data: {
                        userId: provider.providerId,
                        billingMonth,
                        billingYear,
                        totalBookings: provider._count,
                        totalEarnings,
                        baseCommissionRate: 0.18,
                        finalCommissionDue: commissionAmount, // Use correct field name
                        status: "PENDING",
                        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    },
                });
                // Get detailed bookings for bill items
                const bookings = await database_1.default.booking.findMany({
                    where: {
                        providerId: provider.providerId,
                        status: "COMPLETED",
                        completedAt: {
                            gte: new Date(billingYear, billingMonth - 1, 1),
                            lt: new Date(billingYear, billingMonth, 1),
                        },
                    },
                    include: {
                        serviceType: true,
                    },
                });
                // Create bill items
                for (const booking of bookings) {
                    await database_1.default.commissionBillItem.create({
                        data: {
                            billId: bill.id,
                            serviceType: booking.serviceType.name,
                            description: `${booking.serviceType.displayName} service on ${booking.completedAt?.toDateString()}`,
                            quantity: 1,
                            unitAmount: booking.finalPrice || 0,
                            totalAmount: booking.finalPrice || 0,
                            commissionRate: 0.18,
                            commissionAmount: booking.platformCommission || 0,
                            bookingId: booking.id,
                        },
                    });
                }
                // Send notification
                await this.notificationService.notifyCustomer(provider.providerId, {
                    type: "COMMISSION_BILL_GENERATED",
                    title: "Monthly Commission Bill",
                    body: `Your commission bill for ${billingMonth}/${billingYear} is ready. Amount: ₦${commissionAmount}`,
                    data: { billId: bill.id, amount: commissionAmount },
                    priority: "URGENT",
                });
                // Send email reminder
                const user = await database_1.default.user.findUnique({
                    where: { id: provider.providerId },
                });
                if (user?.email) {
                    await this.emailService.sendCommissionReminderEmail(user.email, commissionAmount, bill.dueDate);
                }
            }
            logger_1.default.info(`Generated commission bills for ${providersWithEarnings.length} providers`);
        }
        catch (error) {
            logger_1.default.error("Generate monthly commission bills error:", error);
            throw error;
        }
    }
    async getCommissionBill(billId) {
        try {
            // Get bill without include first to check what relations exist
            const bill = await database_1.default.monthlyCommissionBill.findUnique({
                where: { id: billId },
            });
            if (!bill)
                return null;
            // Get related items separately
            const items = await database_1.default.commissionBillItem.findMany({
                where: { billId },
            });
            return {
                id: bill.id,
                userId: bill.userId,
                billingMonth: bill.billingMonth,
                billingYear: bill.billingYear,
                totalEarnings: bill.totalEarnings,
                commissionRate: bill.baseCommissionRate,
                commissionAmount: bill.finalCommissionDue,
                status: bill.status,
                dueDate: bill.dueDate,
                items: items.map((item) => ({
                    serviceType: item.serviceType,
                    description: item.description,
                    quantity: item.quantity,
                    unitAmount: item.unitAmount,
                    totalAmount: item.totalAmount,
                    commissionAmount: item.commissionAmount,
                })),
            };
        }
        catch (error) {
            logger_1.default.error("Get commission bill error:", error);
            return null;
        }
    }
    async payCommissionBill(billId, paymentMethodId) {
        try {
            const bill = await database_1.default.monthlyCommissionBill.findUnique({
                where: { id: billId },
            });
            if (!bill) {
                throw new Error("Commission bill not found");
            }
            if (bill.status !== "PENDING") {
                throw new Error("Bill is not pending payment");
            }
            // Process payment
            await this.paymentService.processPayment({
                userId: bill.userId,
                bookingId: "", // Not applicable for commission bills
                amount: bill.finalCommissionDue,
                paymentMethodId,
                description: `Commission payment for ${bill.billingMonth}/${bill.billingYear}`,
            });
            // Update bill status
            await database_1.default.monthlyCommissionBill.update({
                where: { id: billId },
                data: {
                    status: "PAID",
                    paidAt: new Date(),
                },
            });
            // Update user commission status
            await database_1.default.user.update({
                where: { id: bill.userId },
                data: {
                    isCommissionCurrent: true,
                },
            });
            // Send confirmation
            await this.notificationService.notifyCustomer(bill.userId, {
                type: "COMMISSION_PAID",
                title: "Commission Payment Successful",
                body: `Your commission payment of ₦${bill.finalCommissionDue} has been processed successfully.`,
                data: { billId, amount: bill.finalCommissionDue },
                priority: "STANDARD",
            });
            logger_1.default.info(`Commission bill ${billId} paid successfully`);
        }
        catch (error) {
            logger_1.default.error("Pay commission bill error:", error);
            throw error;
        }
    }
    async checkOverdueBills() {
        try {
            const overdueBills = await database_1.default.monthlyCommissionBill.findMany({
                where: {
                    status: "PENDING",
                    dueDate: { lt: new Date() },
                },
                include: {
                    user: true,
                },
            });
            for (const bill of overdueBills) {
                // Update bill status
                await database_1.default.monthlyCommissionBill.update({
                    where: { id: bill.id },
                    data: { status: "OVERDUE" },
                });
                // Suspend user if commission is overdue
                await database_1.default.user.update({
                    where: { id: bill.userId },
                    data: { isCommissionCurrent: false },
                });
                // Send overdue notification
                await this.notificationService.notifyCustomer(bill.userId, {
                    type: "COMMISSION_OVERDUE",
                    title: "Commission Payment Overdue",
                    body: `Your commission payment of ₦${bill.finalCommissionDue} is overdue. Please pay immediately to avoid service suspension.`,
                    data: { billId: bill.id, amount: bill.finalCommissionDue },
                    priority: "CRITICAL",
                });
                logger_1.default.warn(`Commission bill ${bill.id} is overdue for user ${bill.userId}`);
            }
        }
        catch (error) {
            logger_1.default.error("Check overdue bills error:", error);
            throw error;
        }
    }
    async getUserCommissionHistory(userId, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;
            const [bills, total] = await Promise.all([
                database_1.default.monthlyCommissionBill.findMany({
                    where: { userId },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
                database_1.default.monthlyCommissionBill.count({ where: { userId } }),
            ]);
            // Get items for each bill separately
            const billsWithItems = await Promise.all(bills.map(async (bill) => {
                const items = await database_1.default.commissionBillItem.findMany({
                    where: { billId: bill.id },
                });
                return {
                    id: bill.id,
                    userId: bill.userId,
                    billingMonth: bill.billingMonth,
                    billingYear: bill.billingYear,
                    totalEarnings: bill.totalEarnings,
                    commissionRate: bill.baseCommissionRate,
                    commissionAmount: bill.finalCommissionDue,
                    status: bill.status,
                    dueDate: bill.dueDate,
                    items: items.map((item) => ({
                        serviceType: item.serviceType,
                        description: item.description,
                        quantity: item.quantity,
                        unitAmount: item.unitAmount,
                        totalAmount: item.totalAmount,
                        commissionAmount: item.commissionAmount,
                    })),
                };
            }));
            return {
                bills: billsWithItems,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get user commission history error:", error);
            throw error;
        }
    }
}
exports.CommissionService = CommissionService;
