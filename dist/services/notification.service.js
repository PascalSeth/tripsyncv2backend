"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
const email_service_1 = require("./email.service");
const client_1 = require("@prisma/client");
class NotificationService {
    constructor() {
        this.emailService = new email_service_1.EmailService();
    }
    /**
     * Sends an email notification to a user.
     * This is typically used as a fallback when real-time notifications are not possible,
     * or for critical notifications that require email delivery.
     * @param userId The ID of the user to notify.
     * @param type The type of notification (e.g., 'BOOKING_CONFIRMED', 'ACCOUNT_ALERT').
     * @param data The notification payload, containing details for the email content.
     */
    async sendEmailNotification(userId, type, data) {
        try {
            const user = await database_1.default.user.findUnique({
                where: { id: userId },
                select: { email: true, firstName: true, lastName: true },
            });
            if (!user || !user.email) {
                logger_1.default.warn(`Cannot send email notification: User ${userId} not found or has no email.`);
                return;
            }
            let subject;
            let htmlContent;
            switch (type) {
                case client_1.NotificationType.BOOKING_UPDATE:
                    subject = `TripSync Booking #${data.bookingNumber} Update: ${data.status}`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your booking <strong>#${data.bookingNumber}</strong> has been updated to status: <strong>${data.status}</strong>.</p>
            ${data.providerName ? `<p>Your ${data.serviceType} provider is ${data.providerName}.</p>` : ""}
            ${data.eta ? `<p>Estimated arrival time: ${data.eta}.</p>` : ""}
            <p>For more details, please check the app.</p>
          `;
                    break;
                case client_1.NotificationType.PAYMENT_UPDATE:
                    subject = `TripSync Payment Update`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your payment of ${data.amount} ${data.currency} for ${data.description} has been ${data.status}.</p>
            <p>Transaction Reference: ${data.transactionRef}</p>
          `;
                    break;
                case client_1.NotificationType.PROMOTION:
                    subject = `TripSync Special Offer: ${data.title}`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>We have a special promotion for you!</p>
            <p>${data.body}</p>
            <p>Valid until: ${data.expiryDate}</p>
          `;
                    break;
                case client_1.NotificationType.SYSTEM_ALERT:
                    subject = `TripSync System Alert`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Important message from TripSync:</p>
            <p>${data.message}</p>
          `;
                    break;
                case client_1.NotificationType.EMERGENCY_ALERT:
                    subject = `URGENT: TripSync Emergency Alert`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>An emergency alert has been issued:</p>
            <p>${data.message}</p>
            <p>Location: ${data.location}</p>
            <p>Please stay safe and follow local authorities' instructions.</p>
          `;
                    break;
                case client_1.NotificationType.REVIEW_REQUEST:
                    subject = `Rate Your Recent TripSync Experience!`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>We hope you enjoyed your recent ${data.serviceType} with TripSync.</p>
            <p>Please take a moment to rate your experience: <a href="${data.reviewLink}">${data.reviewLink}</a></p>
            <p>Your feedback helps us improve!</p>
          `;
                    break;
                case client_1.NotificationType.DRIVER_NEARBY:
                    subject = `Your TripSync Driver is Nearby!`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your driver for booking #${data.bookingNumber} is now nearby your pickup location.</p>
            <p>Vehicle: ${data.vehicleMake} ${data.vehicleModel} (${data.licensePlate})</p>
            <p>Driver: ${data.driverName}</p>
          `;
                    break;
                case client_1.NotificationType.RIDE_REMINDER:
                    subject = `Reminder: Your Scheduled TripSync Ride`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Just a friendly reminder about your scheduled ${data.serviceType} for booking #${data.bookingNumber} at ${data.scheduledTime} today.</p>
            <p>Pickup: ${data.pickupLocation}</p>
            <p>Dropoff: ${data.dropoffLocation}</p>
          `;
                    break;
                case client_1.NotificationType.DELIVERY_UPDATE:
                    subject = `TripSync Delivery Update: Order #${data.orderNumber}`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your delivery for order <strong>#${data.orderNumber}</strong> has been updated to status: <strong>${data.status}</strong>.</p>
            <p>Estimated arrival: ${data.eta}</p>
          `;
                    break;
                case client_1.NotificationType.PLACE_RECOMMENDATION:
                    subject = `New Place Recommendation from TripSync!`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Based on your preferences, we recommend you check out <strong>${data.placeName}</strong>!</p>
            <p>${data.placeDescription}</p>
            <p>Learn more: <a href="${data.placeLink}">${data.placeLink}</a></p>
          `;
                    break;
                case client_1.NotificationType.SAFETY_ALERT:
                    subject = `TripSync Safety Alert`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Important safety information from TripSync:</p>
            <p>${data.message}</p>
            <p>Always prioritize your safety. If you need assistance, please contact support.</p>
          `;
                    break;
                case client_1.NotificationType.MAINTENANCE:
                    subject = `TripSync System Maintenance Notice`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>We will be performing scheduled maintenance on the TripSync system on ${data.date} from ${data.startTime} to ${data.endTime}.</p>
            <p>During this time, some services may be temporarily unavailable. We apologize for any inconvenience.</p>
          `;
                    break;
                case client_1.NotificationType.COMMISSION_DUE:
                    subject = `TripSync Commission Payment Due`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your commission payment of ${data.amount} ${data.currency} is due on ${data.dueDate}.</p>
            <p>Please ensure your payment method is up to date to avoid service interruption.</p>
          `;
                    break;
                case client_1.NotificationType.COMMISSION_PAID:
                    subject = `TripSync Commission Payment Received`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>We have successfully received your commission payment of ${data.amount} ${data.currency}.</p>
            <p>Thank you for your prompt payment!</p>
          `;
                    break;
                case client_1.NotificationType.PAYOUT_PROCESSED:
                    subject = `TripSync Payout Processed`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Your payout of ${data.amount} ${data.currency} has been successfully processed and sent to your ${data.payoutMethod} account.</p>
            <p>Reference: ${data.payoutReference}</p>
          `;
                    break;
                case client_1.NotificationType.WELCOME:
                    subject = `Welcome to TripSync!`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>Welcome to TripSync! Your account has been created successfully. Complete your profile to get started.</p>
            <p>We're excited to have you on board!</p>
          `;
                    break;
                default:
                    subject = `TripSync Notification: ${type}`;
                    htmlContent = `
            <p>Dear ${user.firstName},</p>
            <p>You have a new notification from TripSync:</p>
            <p>${data.message || JSON.stringify(data)}</p>
            <p>Please check the app for more details.</p>
          `;
                    break;
            }
            await this.emailService.sendEmail(user.email, subject, htmlContent);
            logger_1.default.info(`Email notification sent to ${user.email} for type ${type}.`);
        }
        catch (error) {
            logger_1.default.error(`Error sending email notification to user ${userId} for type ${type}:`, error);
            // Depending on criticality, you might want to log to a separate system or retry
        }
    }
    /**
     * Sends an in-app notification (via WebSocket).
     * This method is primarily called by the IntegrationService as part of its logic.
     * @param userId The ID of the user to notify.
     * @param type The type of notification.
     * @param data The notification payload.
     */
    async sendInAppNotification(userId, type, data) {
        // This method is now primarily handled by IntegrationService which decides between WebSocket and Email.
        // If direct in-app notification logic is needed here (e.g., saving to DB for later retrieval), it would go here.
        logger_1.default.info(`In-app notification for user ${userId}, type ${type} would be handled by WebSocket.`);
        // Example: Save notification to database for user's notification history
        await database_1.default.notification.create({
            data: {
                userId: userId,
                type: type,
                title: data.title || `New notification of type ${type}`, // Assuming title is part of data
                body: data.body || `New notification of type ${type}`, // Assuming body is part of data
                data: JSON.stringify(data),
                isRead: false,
                priority: data.priority || client_1.PriorityLevel.STANDARD, // Assuming priority is part of data
            },
        });
    }
    /**
     * Notifies a customer by creating a notification record and potentially sending an email.
     * This method is used by controllers and services to trigger notifications.
     * @param userId The ID of the user to notify.
     * @param notification The notification details.
     */
    async notifyCustomer(userId, notification) {
        try {
            // Create notification record
            const notificationRecord = await database_1.default.notification.create({
                data: {
                    userId,
                    title: notification.title,
                    body: notification.body,
                    type: notification.type, // No more 'as any'
                    data: JSON.stringify(notification.data || {}),
                    priority: notification.priority || client_1.PriorityLevel.STANDARD, // No more 'as any'
                },
            });
            // Send email for critical notifications or emergency types
            if (notification.priority === client_1.PriorityLevel.CRITICAL || notification.type.includes("EMERGENCY")) {
                // The includes check might need refinement if NotificationType is strictly enum
                // For now, it works because enum values are strings.
                await this.sendEmailNotification(userId, notification.type, {
                    title: notification.title,
                    body: notification.body,
                    ...notification.data,
                });
            }
            return notificationRecord;
        }
        catch (error) {
            logger_1.default.error("Notify customer error:", error);
            throw error;
        }
    }
    async notifyDriver(userId, notification) {
        try {
            console.log(`🔔 NOTIFYING DRIVER: ${userId}`);
            console.log(`📋 Notification Type: ${notification.type}`);
            console.log(`📝 Title: ${notification.title}`);
            console.log(`💬 Body: ${notification.body}`);
            console.log(`📊 Data:`, JSON.stringify(notification.data, null, 2));
            // Create notification record in database
            const notificationRecord = await database_1.default.notification.create({
                data: {
                    userId,
                    title: notification.title,
                    body: notification.body,
                    type: notification.type,
                    data: JSON.stringify(notification.data || {}),
                    priority: notification.priority || client_1.PriorityLevel.STANDARD,
                },
            });
            console.log(`✅ Database notification created: ${notificationRecord.id}`);
            // Send real-time notification via WebSocket
            try {
                // Import the WebSocket service from server
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                // Use the WebSocket service's notifyUser method
                const notificationSent = await io.notifyUser(userId, "notification", {
                    id: notificationRecord.id,
                    type: notification.type,
                    title: notification.title,
                    body: notification.body,
                    data: notification.data,
                    priority: notification.priority || client_1.PriorityLevel.STANDARD,
                    timestamp: new Date(),
                });
                console.log(`📡 WebSocket notification sent to user_${userId}: ${notificationSent}`);
                // Also emit specific event for booking requests
                if (notification.type === "NEW_BOOKING_REQUEST" && notification.data?.bookingId) {
                    await io.notifyUser(userId, "new_booking_request", {
                        notificationId: notificationRecord.id,
                        bookingId: notification.data.bookingId,
                        ...notification.data,
                        timestamp: new Date(),
                    });
                    console.log(`🚗 Booking request event sent to user_${userId}`);
                }
            }
            catch (socketError) {
                console.error(`❌ WebSocket notification failed for user ${userId}:`, socketError);
            }
            // Send email for critical notifications or emergency types
            if (notification.priority === client_1.PriorityLevel.CRITICAL || notification.type.includes("EMERGENCY")) {
                try {
                    await this.sendEmailNotification(userId, notification.type, {
                        title: notification.title,
                        body: notification.body,
                        ...notification.data,
                    });
                    console.log(`📧 Email notification sent to user ${userId}`);
                }
                catch (emailError) {
                    console.error(`❌ Email notification failed for user ${userId}:`, emailError);
                }
            }
            console.log(`🔔 DRIVER NOTIFICATION COMPLETE: ${userId}\n`);
            return notificationRecord;
        }
        catch (error) {
            logger_1.default.error("Notify driver error:", error);
            console.error(`❌ DRIVER NOTIFICATION FAILED: ${userId}`, error);
            throw error;
        }
    }
    async notifyProvider(userId, notification) {
        return this.notifyCustomer(userId, notification);
    }
    async sendBulkNotification(userIds, notification) {
        try {
            const notifications = userIds.map((userId) => ({
                userId,
                title: notification.title,
                body: notification.body,
                type: notification.type,
                data: JSON.stringify(notification.data || {}),
                priority: client_1.PriorityLevel.STANDARD,
            }));
            // Create all notifications
            await database_1.default.notification.createMany({
                data: notifications,
            });
            // Note: Real-time notifications for bulk are handled by WebSocketService if users are online.
            // Email notifications for bulk are not sent by default here, but can be added if needed.
        }
        catch (error) {
            logger_1.default.error("Send bulk notification error:", error);
            throw error;
        }
    }
    async markAsRead(notificationId, userId) {
        try {
            const notification = await database_1.default.notification.updateMany({
                where: {
                    id: notificationId,
                    userId,
                },
                data: {
                    isRead: true,
                },
            });
            return notification;
        }
        catch (error) {
            logger_1.default.error("Mark notification as read error:", error);
            throw error;
        }
    }
    async getUserNotifications(userId, options = {}) {
        try {
            const { page = 1, limit = 20, unreadOnly = false } = options;
            const skip = (page - 1) * limit;
            const where = { userId };
            if (unreadOnly) {
                where.isRead = false;
            }
            const [notifications, total] = await Promise.all([
                database_1.default.notification.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
                database_1.default.notification.count({ where }),
            ]);
            return {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get user notifications error:", error);
            throw error;
        }
    }
    async notifyAdmins(notification) {
        try {
            // Get all admin users
            const admins = await database_1.default.user.findMany({
                where: {
                    role: { in: ["SUPER_ADMIN", "CITY_ADMIN"] },
                    isActive: true,
                },
                select: { id: true },
            });
            // Send notification to all admins
            for (const admin of admins) {
                await this.notifyCustomer(admin.id, notification);
            }
            return { notifiedAdmins: admins.length };
        }
        catch (error) {
            logger_1.default.error("Notify admins error:", error);
            throw error;
        }
    }
}
exports.NotificationService = NotificationService;
