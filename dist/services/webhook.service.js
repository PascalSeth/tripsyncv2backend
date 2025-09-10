"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../utils/logger"));
class WebhookService {
    constructor() {
        this.webhookUrl = process.env.WEBHOOK_URL;
        this.webhookSecret = process.env.WEBHOOK_SECRET;
    }
    /**
     * Send webhook notification for delivery status update
     */
    async notifyDeliveryStatusUpdate(deliveryId, status, trackingCode, additionalData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "delivery.status_update",
            data: {
                deliveryId,
                status,
                trackingCode,
                ...additionalData
            },
            timestamp: new Date(),
            deliveryId,
            trackingCode
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for delivery ${deliveryId} status update: ${status}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for delivery ${deliveryId}:`, error);
        }
    }
    /**
     * Send webhook notification for delivery creation
     */
    async notifyDeliveryCreated(deliveryId, trackingCode, additionalData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "delivery.created",
            data: {
                deliveryId,
                trackingCode,
                ...additionalData
            },
            timestamp: new Date(),
            deliveryId,
            trackingCode
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for delivery ${deliveryId} creation`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for delivery ${deliveryId} creation:`, error);
        }
    }
    /**
     * Send webhook notification for delivery completion
     */
    async notifyDeliveryCompleted(deliveryId, trackingCode, additionalData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "delivery.completed",
            data: {
                deliveryId,
                trackingCode,
                ...additionalData
            },
            timestamp: new Date(),
            deliveryId,
            trackingCode
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for delivery ${deliveryId} completion`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for delivery ${deliveryId} completion:`, error);
        }
    }
    /**
     * Send webhook notification for delivery issue
     */
    async notifyDeliveryIssue(deliveryId, trackingCode, issueData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "delivery.issue_reported",
            data: {
                deliveryId,
                trackingCode,
                issue: issueData
            },
            timestamp: new Date(),
            deliveryId,
            trackingCode
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for delivery ${deliveryId} issue`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for delivery ${deliveryId} issue:`, error);
        }
    }
    /**
     * Send webhook notification for dispatch rider assignment
     */
    async notifyDispatchRiderAssigned(deliveryId, trackingCode, dispatchRiderData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "delivery.dispatch_rider_assigned",
            data: {
                deliveryId,
                trackingCode,
                dispatchRider: dispatchRiderData
            },
            timestamp: new Date(),
            deliveryId,
            trackingCode
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for delivery ${deliveryId} dispatch rider assignment`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for delivery ${deliveryId} dispatch rider assignment:`, error);
        }
    }
    /**
     * Send webhook notification for day booking creation
     */
    async notifyDayBookingCreated(bookingId, driverData, bookingData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "day_booking.created",
            data: {
                bookingId,
                driver: driverData,
                booking: bookingData,
                status: "CONFIRMED"
            },
            timestamp: new Date(),
            deliveryId: bookingId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for day booking ${bookingId} creation`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for day booking ${bookingId} creation:`, error);
        }
    }
    /**
     * Send webhook notification for day booking status update
     */
    async notifyDayBookingStatusUpdate(bookingId, status, driverData, additionalData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "day_booking.status_update",
            data: {
                bookingId,
                status,
                driver: driverData,
                ...additionalData
            },
            timestamp: new Date(),
            deliveryId: bookingId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for day booking ${bookingId} status update: ${status}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for day booking ${bookingId} status update:`, error);
        }
    }
    /**
     * Send webhook notification for driver availability change
     */
    async notifyDriverAvailabilityChange(driverId, isAvailable, bookingId) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "driver.availability_changed",
            data: {
                driverId,
                isAvailable,
                bookingId,
                timestamp: new Date()
            },
            timestamp: new Date(),
            deliveryId: bookingId || driverId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for driver ${driverId} availability change: ${isAvailable}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for driver ${driverId} availability change:`, error);
        }
    }
    /**
     * Send webhook notification for day booking payment
     */
    async notifyDayBookingPayment(bookingId, paymentData, driverData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "day_booking.payment_processed",
            data: {
                bookingId,
                payment: paymentData,
                driver: driverData
            },
            timestamp: new Date(),
            deliveryId: bookingId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for day booking ${bookingId} payment`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for day booking ${bookingId} payment:`, error);
        }
    }
    /**
      * Send webhook notification for day booking location update
      */
    async notifyDayBookingLocationUpdate(bookingId, locationData, driverData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "day_booking.location_update",
            data: {
                bookingId,
                location: locationData,
                driver: driverData,
                timestamp: new Date()
            },
            timestamp: new Date(),
            deliveryId: bookingId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for day booking ${bookingId} location update`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for day booking ${bookingId} location update:`, error);
        }
    }
    /**
      * Send webhook notification for taxi booking request
      */
    async notifyTaxiBookingRequest(bookingId, bookingData, driverData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "taxi.booking_request",
            data: {
                bookingId,
                booking: bookingData,
                driver: driverData,
                status: "REQUESTED"
            },
            timestamp: new Date(),
            deliveryId: bookingId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for taxi booking ${bookingId} request`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for taxi booking ${bookingId} request:`, error);
        }
    }
    /**
      * Send webhook notification for taxi booking acceptance
      */
    async notifyTaxiBookingAccepted(bookingId, bookingData, driverData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "taxi.booking_accepted",
            data: {
                bookingId,
                booking: bookingData,
                driver: driverData,
                status: "ACCEPTED"
            },
            timestamp: new Date(),
            deliveryId: bookingId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for taxi booking ${bookingId} acceptance`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for taxi booking ${bookingId} acceptance:`, error);
        }
    }
    /**
      * Send webhook notification for taxi booking status update
      */
    async notifyTaxiBookingStatusUpdate(bookingId, status, bookingData, driverData, additionalData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "taxi.booking_status_update",
            data: {
                bookingId,
                status,
                booking: bookingData,
                driver: driverData,
                ...additionalData
            },
            timestamp: new Date(),
            deliveryId: bookingId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for taxi booking ${bookingId} status update: ${status}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for taxi booking ${bookingId} status update:`, error);
        }
    }
    /**
      * Send webhook notification for taxi driver location update
      */
    async notifyTaxiDriverLocationUpdate(driverId, locationData, bookingId) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "taxi.driver_location_update",
            data: {
                driverId,
                location: locationData,
                bookingId,
                timestamp: new Date()
            },
            timestamp: new Date(),
            deliveryId: bookingId || driverId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for taxi driver ${driverId} location update`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for taxi driver ${driverId} location update:`, error);
        }
    }
    /**
      * Send webhook notification for taxi driver availability change
      */
    async notifyTaxiDriverAvailabilityChange(driverId, isAvailable, isOnline, bookingId) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "taxi.driver_availability_changed",
            data: {
                driverId,
                isAvailable,
                isOnline,
                bookingId,
                timestamp: new Date()
            },
            timestamp: new Date(),
            deliveryId: bookingId || driverId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for taxi driver ${driverId} availability change: ${isAvailable}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for taxi driver ${driverId} availability change:`, error);
        }
    }
    /**
      * Send webhook notification for dispatch rider delivery request
      */
    async notifyDispatchDeliveryRequest(deliveryId, deliveryData, riderData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "dispatch.delivery_request",
            data: {
                deliveryId,
                delivery: deliveryData,
                rider: riderData,
                status: "REQUESTED"
            },
            timestamp: new Date(),
            deliveryId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for dispatch delivery ${deliveryId} request`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for dispatch delivery ${deliveryId} request:`, error);
        }
    }
    /**
      * Send webhook notification for dispatch rider delivery acceptance
      */
    async notifyDispatchDeliveryAccepted(deliveryId, deliveryData, riderData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "dispatch.delivery_accepted",
            data: {
                deliveryId,
                delivery: deliveryData,
                rider: riderData,
                status: "ACCEPTED"
            },
            timestamp: new Date(),
            deliveryId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for dispatch delivery ${deliveryId} acceptance`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for dispatch delivery ${deliveryId} acceptance:`, error);
        }
    }
    /**
      * Send webhook notification for dispatch rider delivery status update
      */
    async notifyDispatchDeliveryStatusUpdate(deliveryId, status, deliveryData, riderData, additionalData) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "dispatch.delivery_status_update",
            data: {
                deliveryId,
                status,
                delivery: deliveryData,
                rider: riderData,
                ...additionalData
            },
            timestamp: new Date(),
            deliveryId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for dispatch delivery ${deliveryId} status update: ${status}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for dispatch delivery ${deliveryId} status update:`, error);
        }
    }
    /**
      * Send webhook notification for dispatch rider location update
      */
    async notifyDispatchRiderLocationUpdate(riderId, locationData, deliveryId) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "dispatch.rider_location_update",
            data: {
                riderId,
                location: locationData,
                deliveryId,
                timestamp: new Date()
            },
            timestamp: new Date(),
            deliveryId: deliveryId || riderId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for dispatch rider ${riderId} location update`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for dispatch rider ${riderId} location update:`, error);
        }
    }
    /**
      * Send webhook notification for dispatch rider availability change
      */
    async notifyDispatchRiderAvailabilityChange(riderId, isAvailable, isOnline, deliveryId) {
        if (!this.webhookUrl) {
            logger_1.default.warn("Webhook URL not configured, skipping webhook notification");
            return;
        }
        const payload = {
            event: "dispatch.rider_availability_changed",
            data: {
                riderId,
                isAvailable,
                isOnline,
                deliveryId,
                timestamp: new Date()
            },
            timestamp: new Date(),
            deliveryId: deliveryId || riderId
        };
        try {
            await this.sendWebhook(payload);
            logger_1.default.info(`✅ Webhook sent for dispatch rider ${riderId} availability change: ${isAvailable}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to send webhook for dispatch rider ${riderId} availability change:`, error);
        }
    }
    /**
     * Private method to send webhook
     */
    async sendWebhook(payload) {
        const headers = {
            "Content-Type": "application/json",
            "User-Agent": "TripSync-Delivery-Webhook/1.0"
        };
        // Add signature if secret is configured
        if (this.webhookSecret) {
            const signature = this.generateSignature(JSON.stringify(payload));
            headers["X-Webhook-Signature"] = signature;
        }
        const response = await axios_1.default.post(this.webhookUrl, payload, {
            headers,
            timeout: 10000 // 10 second timeout
        });
        if (response.status !== 200) {
            throw new Error(`Webhook returned status ${response.status}`);
        }
    }
    /**
     * Generate webhook signature for security
     */
    generateSignature(payload) {
        return crypto_1.default
            .createHmac("sha256", this.webhookSecret)
            .update(payload)
            .digest("hex");
    }
    /**
     * Verify webhook signature (for incoming webhooks)
     */
    verifySignature(payload, signature) {
        if (!this.webhookSecret) {
            return true; // If no secret configured, accept all
        }
        const expectedSignature = this.generateSignature(payload);
        try {
            return crypto_1.default.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"));
        }
        catch (error) {
            // If timingSafeEqual fails (different lengths), signatures don't match
            return false;
        }
    }
}
exports.WebhookService = WebhookService;
