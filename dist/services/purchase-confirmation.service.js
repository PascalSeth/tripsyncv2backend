"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseConfirmationService = void 0;
const database_1 = __importDefault(require("../config/database"));
const email_service_1 = require("./email.service");
const payment_service_1 = require("./payment.service");
const notification_service_1 = require("./notification.service");
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
const crypto_1 = __importDefault(require("crypto"));
class PurchaseConfirmationService {
    constructor() {
        this.emailService = new email_service_1.EmailService();
        this.paymentService = new payment_service_1.PaymentService();
        this.notificationService = new notification_service_1.NotificationService();
    }
    /**
     * Create a purchase confirmation request
     */
    async createPurchaseConfirmation(orderId) {
        try {
            // Get order details
            const order = await database_1.default.order.findUnique({
                where: { id: orderId },
                include: {
                    customer: true,
                    store: {
                        include: {
                            owner: {
                                include: { user: true }
                            }
                        }
                    }
                }
            });
            if (!order || !order.store) {
                throw new Error("Order or store not found");
            }
            // Generate confirmation token
            const confirmationToken = crypto_1.default.randomBytes(32).toString('hex');
            // Set expiration time (15 minutes from now)
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
            // Create purchase confirmation record
            const confirmation = await database_1.default.purchaseConfirmation.create({
                data: {
                    orderId,
                    storeId: order.store.id,
                    customerId: order.customerId,
                    expiresAt,
                    confirmationToken,
                }
            });
            // Send email notification to store owner
            await this.sendPurchaseConfirmationEmail(confirmation);
            // Schedule automatic expiration check
            this.scheduleExpirationCheck(confirmation.id);
            return confirmation;
        }
        catch (error) {
            logger_1.default.error("Create purchase confirmation error:", error);
            throw error;
        }
    }
    /**
     * Confirm a purchase
     */
    async confirmPurchase(confirmationToken, storeOwnerId) {
        try {
            // Find confirmation by token
            const confirmation = await database_1.default.purchaseConfirmation.findUnique({
                where: { confirmationToken },
                include: {
                    order: {
                        include: {
                            customer: true,
                            store: {
                                include: {
                                    owner: true
                                }
                            }
                        }
                    }
                }
            });
            if (!confirmation) {
                throw new Error("Purchase confirmation not found");
            }
            // Check if store owner matches
            if (confirmation.order.store?.owner.userId !== storeOwnerId) {
                throw new Error("Unauthorized to confirm this purchase");
            }
            // Check if confirmation is still valid
            if (confirmation.status !== client_1.PurchaseConfirmationStatus.PENDING) {
                throw new Error("Purchase confirmation is no longer valid");
            }
            if (new Date() > confirmation.expiresAt) {
                await this.expireConfirmation(confirmation.id);
                throw new Error("Purchase confirmation has expired");
            }
            // Update confirmation status
            await database_1.default.purchaseConfirmation.update({
                where: { id: confirmation.id },
                data: {
                    status: client_1.PurchaseConfirmationStatus.CONFIRMED,
                    confirmedAt: new Date()
                }
            });
            // Update order status
            await database_1.default.order.update({
                where: { id: confirmation.orderId },
                data: { status: "CONFIRMED" }
            });
            // Send confirmation email to customer
            await this.sendPurchaseConfirmedEmail(confirmation);
            // Notify customer via in-app notification
            await this.notificationService.notifyCustomer(confirmation.customerId, {
                type: "PURCHASE_CONFIRMED",
                title: "Purchase Confirmed",
                body: `Your purchase from ${confirmation.order.store?.name} has been confirmed and is being prepared.`,
                data: {
                    orderId: confirmation.orderId,
                    storeName: confirmation.order.store?.name
                },
                priority: "STANDARD"
            });
            return confirmation;
        }
        catch (error) {
            logger_1.default.error("Confirm purchase error:", error);
            throw error;
        }
    }
    /**
     * Expire a purchase confirmation and process refund
     */
    async expireConfirmation(confirmationId) {
        try {
            const confirmation = await database_1.default.purchaseConfirmation.findUnique({
                where: { id: confirmationId },
                include: {
                    order: {
                        include: {
                            customer: true,
                            store: true
                        }
                    }
                }
            });
            if (!confirmation || confirmation.status !== client_1.PurchaseConfirmationStatus.PENDING) {
                return;
            }
            // Update confirmation status
            await database_1.default.purchaseConfirmation.update({
                where: { id: confirmationId },
                data: {
                    status: client_1.PurchaseConfirmationStatus.EXPIRED
                }
            });
            // Update order status
            await database_1.default.order.update({
                where: { id: confirmation.orderId },
                data: { status: "CANCELLED" }
            });
            // Process refund
            await this.processRefund(confirmation.orderId);
            // Send expiration notification to customer
            await this.sendPurchaseExpiredEmail(confirmation);
            // Notify customer via in-app notification
            await this.notificationService.notifyCustomer(confirmation.customerId, {
                type: "PURCHASE_EXPIRED",
                title: "Purchase Expired",
                body: `Your purchase from ${confirmation.order.store?.name} was not confirmed in time and has been cancelled. A refund has been processed.`,
                data: {
                    orderId: confirmation.orderId,
                    storeName: confirmation.order.store?.name
                },
                priority: "STANDARD"
            });
            logger_1.default.info(`Purchase confirmation ${confirmationId} expired and refunded`);
        }
        catch (error) {
            logger_1.default.error("Expire confirmation error:", error);
            throw error;
        }
    }
    /**
     * Process refund for expired purchase
     */
    async processRefund(orderId) {
        try {
            // Find the original payment transaction
            const transaction = await database_1.default.transaction.findFirst({
                where: {
                    bookingId: orderId,
                    type: "PAYMENT",
                    status: "COMPLETED"
                }
            });
            if (!transaction) {
                logger_1.default.warn(`No payment transaction found for order ${orderId}`);
                return;
            }
            // Create refund transaction
            await database_1.default.transaction.create({
                data: {
                    userId: transaction.userId,
                    bookingId: orderId,
                    paymentMethodId: transaction.paymentMethodId,
                    amount: transaction.amount,
                    currency: transaction.currency,
                    type: "REFUND",
                    status: "COMPLETED",
                    description: `Refund for expired purchase confirmation - Order ${orderId}`,
                    parentTransactionId: transaction.id,
                    refundAmount: transaction.amount,
                    refundedAt: new Date()
                }
            });
            // Update original transaction status
            await database_1.default.transaction.update({
                where: { id: transaction.id },
                data: {
                    status: "REFUNDED",
                    refundAmount: transaction.amount,
                    refundedAt: new Date()
                }
            });
            logger_1.default.info(`Refund processed for order ${orderId}`);
        }
        catch (error) {
            logger_1.default.error("Process refund error:", error);
            throw error;
        }
    }
    /**
     * Send purchase confirmation email to store owner
     */
    async sendPurchaseConfirmationEmail(confirmation) {
        try {
            const storeOwner = confirmation.order.store.owner.user;
            const customer = confirmation.order.customer;
            const subject = `New Purchase Requires Confirmation - ${confirmation.order.orderNumber}`;
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { background: #007bff; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 30px 20px; background: #ffffff; }
            .button { display: inline-block; padding: 15px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .warning-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .order-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #eee; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>TripSync</h1>
            </div>
            <div class="content">
              <h2>New Purchase Requires Your Confirmation</h2>
              <p>Hello ${storeOwner.firstName},</p>
              <p>You have received a new purchase order that requires your confirmation within 15 minutes.</p>

              <div class="order-details">
                <h3>Order Details:</h3>
                <p><strong>Order Number:</strong> ${confirmation.order.orderNumber}</p>
                <p><strong>Customer:</strong> ${customer.firstName} ${customer.lastName}</p>
                <p><strong>Customer Email:</strong> ${customer.email}</p>
                <p><strong>Customer Phone:</strong> ${customer.phone}</p>
                <p><strong>Total Amount:</strong> ₦${confirmation.order.totalAmount.toLocaleString()}</p>
                <p><strong>Expires At:</strong> ${confirmation.expiresAt.toLocaleString()}</p>
              </div>

              <div class="warning-box">
                <strong style="color: #856404;">⚠️ Action Required:</strong>
                <p style="color: #856404; margin: 10px 0 0 0;">You must confirm this purchase within 15 minutes, otherwise it will be automatically cancelled and the customer will be refunded.</p>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://tripsync.com'}/store/orders/confirm/${confirmation.confirmationToken}" class="button">Confirm Purchase</a>
              </div>

              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #007bff; background: #f8f9fa; padding: 10px; border-radius: 4px; font-family: monospace;">
                ${process.env.FRONTEND_URL || 'https://tripsync.com'}/store/orders/confirm/${confirmation.confirmationToken}
              </p>
            </div>
            <div class="footer">
              <p>Best regards,<br><strong>The TripSync Team</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;
            await this.emailService.sendEmail(storeOwner.email, subject, html);
            // Update email tracking
            await database_1.default.purchaseConfirmation.update({
                where: { id: confirmation.id },
                data: {
                    emailSentAt: new Date(),
                    emailSentTo: storeOwner.email
                }
            });
            logger_1.default.info(`Purchase confirmation email sent to ${storeOwner.email}`);
        }
        catch (error) {
            logger_1.default.error("Send purchase confirmation email error:", error);
            throw error;
        }
    }
    /**
     * Send purchase confirmed email to customer
     */
    async sendPurchaseConfirmedEmail(confirmation) {
        try {
            const customer = confirmation.order.customer;
            const store = confirmation.order.store;
            const subject = `Purchase Confirmed - ${confirmation.order.orderNumber}`;
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { background: #28a745; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 30px 20px; background: #ffffff; }
            .success-box { background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .order-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #eee; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>TripSync</h1>
            </div>
            <div class="content">
              <h2>Purchase Confirmed!</h2>
              <p>Hello ${customer.firstName},</p>

              <div class="success-box">
                <strong style="color: #155724;">✅ Great News!</strong>
                <p style="color: #155724; margin: 10px 0 0 0;">Your purchase from ${store?.name} has been confirmed and is now being prepared for delivery.</p>
              </div>

              <div class="order-details">
                <h3>Order Details:</h3>
                <p><strong>Order Number:</strong> ${confirmation.order.orderNumber}</p>
                <p><strong>Store:</strong> ${store?.name}</p>
                <p><strong>Total Amount:</strong> ₦${confirmation.order.totalAmount.toLocaleString()}</p>
                <p><strong>Status:</strong> Confirmed & Being Prepared</p>
              </div>

              <p>You will receive updates on your order status. Our delivery team will contact you when your order is ready for pickup.</p>

              <p>Thank you for choosing TripSync!</p>
            </div>
            <div class="footer">
              <p>Best regards,<br><strong>The TripSync Team</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;
            await this.emailService.sendEmail(customer.email, subject, html);
            logger_1.default.info(`Purchase confirmed email sent to ${customer.email}`);
        }
        catch (error) {
            logger_1.default.error("Send purchase confirmed email error:", error);
            throw error;
        }
    }
    /**
     * Send purchase expired email to customer
     */
    async sendPurchaseExpiredEmail(confirmation) {
        try {
            const customer = confirmation.order.customer;
            const store = confirmation.order.store;
            const subject = `Purchase Expired - ${confirmation.order.orderNumber}`;
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { background: #dc3545; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 30px 20px; background: #ffffff; }
            .warning-box { background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .order-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #eee; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>TripSync</h1>
            </div>
            <div class="content">
              <h2>Purchase Expired</h2>
              <p>Hello ${customer.firstName},</p>

              <div class="warning-box">
                <strong style="color: #721c24;">⚠️ Purchase Not Confirmed</strong>
                <p style="color: #721c24; margin: 10px 0 0 0;">Your purchase from ${store?.name} was not confirmed within the 15-minute time limit and has been automatically cancelled.</p>
              </div>

              <div class="order-details">
                <h3>Order Details:</h3>
                <p><strong>Order Number:</strong> ${confirmation.order.orderNumber}</p>
                <p><strong>Store:</strong> ${store?.name}</p>
                <p><strong>Total Amount:</strong> ₦${confirmation.order.totalAmount.toLocaleString()}</p>
                <p><strong>Status:</strong> Cancelled - Refund Processed</p>
              </div>

              <p>A full refund has been processed to your original payment method. The refund should appear in your account within 3-5 business days.</p>

              <p>If you have any questions or would like to place a new order, please don't hesitate to contact us.</p>
            </div>
            <div class="footer">
              <p>Best regards,<br><strong>The TripSync Team</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;
            await this.emailService.sendEmail(customer.email, subject, html);
            logger_1.default.info(`Purchase expired email sent to ${customer.email}`);
        }
        catch (error) {
            logger_1.default.error("Send purchase expired email error:", error);
            throw error;
        }
    }
    /**
     * Schedule automatic expiration check
     */
    scheduleExpirationCheck(confirmationId) {
        // Schedule the expiration check for 15 minutes from now
        setTimeout(async () => {
            try {
                await this.expireConfirmation(confirmationId);
            }
            catch (error) {
                logger_1.default.error(`Failed to expire confirmation ${confirmationId}:`, error);
            }
        }, 15 * 60 * 1000); // 15 minutes
    }
    /**
     * Get purchase confirmation by token
     */
    async getPurchaseConfirmation(token) {
        try {
            return await database_1.default.purchaseConfirmation.findUnique({
                where: { confirmationToken: token },
                include: {
                    order: {
                        include: {
                            customer: true,
                            store: {
                                include: {
                                    owner: {
                                        include: { user: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }
        catch (error) {
            logger_1.default.error("Get purchase confirmation error:", error);
            throw error;
        }
    }
    /**
     * Send reminder email for pending confirmations
     */
    async sendReminderEmails() {
        try {
            const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
            const pendingConfirmations = await database_1.default.purchaseConfirmation.findMany({
                where: {
                    status: client_1.PurchaseConfirmationStatus.PENDING,
                    expiresAt: {
                        gt: new Date(),
                        lt: fiveMinutesFromNow
                    },
                    reminderSentAt: null
                },
                include: {
                    order: {
                        include: {
                            store: {
                                include: {
                                    owner: {
                                        include: { user: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            for (const confirmation of pendingConfirmations) {
                try {
                    await this.sendReminderEmail(confirmation);
                }
                catch (error) {
                    logger_1.default.error(`Failed to send reminder for confirmation ${confirmation.id}:`, error);
                }
            }
            logger_1.default.info(`Sent ${pendingConfirmations.length} reminder emails`);
        }
        catch (error) {
            logger_1.default.error("Send reminder emails error:", error);
            throw error;
        }
    }
    /**
     * Send reminder email
     */
    async sendReminderEmail(confirmation) {
        try {
            const storeOwner = confirmation.order.store.owner.user;
            const subject = `REMINDER: Purchase Confirmation Required - ${confirmation.order.orderNumber}`;
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { background: #ffc107; color: #333; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 30px 20px; background: #ffffff; }
            .button { display: inline-block; padding: 15px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .urgent-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #eee; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>TripSync</h1>
            </div>
            <div class="content">
              <h2>⏰ URGENT: Purchase Confirmation Required</h2>
              <p>Hello ${storeOwner.firstName},</p>
              <p>This is a reminder that you have a pending purchase that requires your confirmation.</p>

              <div class="urgent-box">
                <strong style="color: #856404;">⚠️ Only 5 Minutes Remaining!</strong>
                <p style="color: #856404; margin: 10px 0 0 0;">Order ${confirmation.order.orderNumber} will expire in approximately 5 minutes if not confirmed.</p>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'https://tripsync.com'}/store/orders/confirm/${confirmation.confirmationToken}" class="button">Confirm Purchase Now</a>
              </div>

              <p>If you do not confirm this purchase, it will be automatically cancelled and the customer will receive a full refund.</p>
            </div>
            <div class="footer">
              <p>Best regards,<br><strong>The TripSync Team</strong></p>
            </div>
          </div>
        </body>
        </html>
      `;
            await this.emailService.sendEmail(storeOwner.email, subject, html);
            // Update reminder tracking
            await database_1.default.purchaseConfirmation.update({
                where: { id: confirmation.id },
                data: {
                    reminderSentAt: new Date()
                }
            });
            logger_1.default.info(`Reminder email sent to ${storeOwner.email} for confirmation ${confirmation.id}`);
        }
        catch (error) {
            logger_1.default.error("Send reminder email error:", error);
            throw error;
        }
    }
}
exports.PurchaseConfirmationService = PurchaseConfirmationService;
