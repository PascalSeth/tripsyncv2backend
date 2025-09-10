"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingService = void 0;
const database_1 = __importDefault(require("../config/database"));
const payment_service_1 = require("./payment.service");
const notification_service_1 = require("./notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class BookingService {
    constructor() {
        this.paymentService = new payment_service_1.PaymentService();
        this.notificationService = new notification_service_1.NotificationService();
    }
    async createBooking(userId, bookingData) {
        try {
            // Validate user eligibility
            await this.validateUserEligibility(userId);
            // Create booking based on service type
            const booking = await database_1.default.booking.create({
                data: {
                    ...bookingData,
                    customerId: userId,
                    bookingNumber: await this.generateBookingNumber(),
                    status: "PENDING",
                    requestedAt: new Date(),
                },
                include: {
                    serviceType: true,
                    customer: true,
                },
            });
            // Log booking creation
            await this.logBookingActivity(booking.id, "CREATED", userId);
            return booking;
        }
        catch (error) {
            logger_1.default.error("Create booking error:", error);
            throw error;
        }
    }
    async processBookingPayment(bookingId) {
        try {
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: {
                    customer: {
                        include: {
                            paymentMethods: {
                                where: { isDefault: true },
                            },
                        },
                    },
                    serviceType: true,
                },
            });
            if (!booking) {
                throw new Error("Booking not found");
            }
            const paymentMethod = booking.customer.paymentMethods[0];
            if (!paymentMethod) {
                throw new Error("No payment method found");
            }
            // Process payment
            const transaction = await this.paymentService.processPayment({
                userId: booking.customerId,
                bookingId: booking.id,
                amount: booking.finalPrice || booking.estimatedPrice || 0,
                paymentMethodId: paymentMethod.id,
                description: `Payment for ${booking.serviceType?.displayName} service`,
            });
            // Update booking payment status
            await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    paymentStatus: transaction.status === "COMPLETED" ? "COMPLETED" : "PENDING",
                },
            });
            return transaction;
        }
        catch (error) {
            logger_1.default.error("Process booking payment error:", error);
            throw error;
        }
    }
    async validateUserEligibility(userId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                customerProfile: true,
            },
        });
        if (!user || !user.isActive) {
            throw new Error("User not found or inactive");
        }
        if (!user.isVerified) {
            throw new Error("User account not verified");
        }
        // Check commission status
        if (user.customerProfile && !user.isCommissionCurrent) {
            throw new Error("Account suspended due to outstanding commission payments");
        }
        // Check active bookings limit
        const activeBookings = await database_1.default.booking.count({
            where: {
                customerId: userId,
                status: {
                    in: ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"],
                },
            },
        });
        if (activeBookings >= 3) {
            throw new Error("Maximum active bookings limit reached");
        }
    }
    async generateBookingNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `TRP${timestamp}${random}`;
    }
    async logBookingActivity(bookingId, action, userId) {
        await database_1.default.auditLog.create({
            data: {
                userId,
                action,
                resource: "booking",
                resourceId: bookingId,
                timestamp: new Date(),
            },
        });
    }
}
exports.BookingService = BookingService;
