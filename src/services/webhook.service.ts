import axios from "axios"
import crypto from "crypto"
import logger from "../utils/logger"

export interface WebhookPayload {
  event: string
  data: any
  timestamp: Date
  deliveryId: string
  trackingCode?: string
}

export class WebhookService {
  private webhookUrl?: string
  private webhookSecret?: string

  constructor() {
    this.webhookUrl = process.env.WEBHOOK_URL
    this.webhookSecret = process.env.WEBHOOK_SECRET
  }

  /**
   * Send webhook notification for delivery status update
   */
  async notifyDeliveryStatusUpdate(deliveryId: string, status: string, trackingCode?: string, additionalData?: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
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
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for delivery ${deliveryId} status update: ${status}`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for delivery ${deliveryId}:`, error)
    }
  }

  /**
   * Send webhook notification for delivery creation
   */
  async notifyDeliveryCreated(deliveryId: string, trackingCode: string, additionalData?: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "delivery.created",
      data: {
        deliveryId,
        trackingCode,
        ...additionalData
      },
      timestamp: new Date(),
      deliveryId,
      trackingCode
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for delivery ${deliveryId} creation`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for delivery ${deliveryId} creation:`, error)
    }
  }

  /**
   * Send webhook notification for delivery completion
   */
  async notifyDeliveryCompleted(deliveryId: string, trackingCode: string, additionalData?: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "delivery.completed",
      data: {
        deliveryId,
        trackingCode,
        ...additionalData
      },
      timestamp: new Date(),
      deliveryId,
      trackingCode
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for delivery ${deliveryId} completion`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for delivery ${deliveryId} completion:`, error)
    }
  }

  /**
   * Send webhook notification for delivery issue
   */
  async notifyDeliveryIssue(deliveryId: string, trackingCode: string, issueData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "delivery.issue_reported",
      data: {
        deliveryId,
        trackingCode,
        issue: issueData
      },
      timestamp: new Date(),
      deliveryId,
      trackingCode
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for delivery ${deliveryId} issue`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for delivery ${deliveryId} issue:`, error)
    }
  }

  /**
   * Send webhook notification for dispatch rider assignment
   */
  async notifyDispatchRiderAssigned(deliveryId: string, trackingCode: string, dispatchRiderData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "delivery.dispatch_rider_assigned",
      data: {
        deliveryId,
        trackingCode,
        dispatchRider: dispatchRiderData
      },
      timestamp: new Date(),
      deliveryId,
      trackingCode
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for delivery ${deliveryId} dispatch rider assignment`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for delivery ${deliveryId} dispatch rider assignment:`, error)
    }
  }

  /**
   * Send webhook notification for day booking creation
   */
  async notifyDayBookingCreated(bookingId: string, driverData: any, bookingData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "day_booking.created",
      data: {
        bookingId,
        driver: driverData,
        booking: bookingData,
        status: "CONFIRMED"
      },
      timestamp: new Date(),
      deliveryId: bookingId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for day booking ${bookingId} creation`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for day booking ${bookingId} creation:`, error)
    }
  }

  /**
   * Send webhook notification for day booking status update
   */
  async notifyDayBookingStatusUpdate(bookingId: string, status: string, driverData: any, additionalData?: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "day_booking.status_update",
      data: {
        bookingId,
        status,
        driver: driverData,
        ...additionalData
      },
      timestamp: new Date(),
      deliveryId: bookingId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for day booking ${bookingId} status update: ${status}`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for day booking ${bookingId} status update:`, error)
    }
  }

  /**
   * Send webhook notification for driver availability change
   */
  async notifyDriverAvailabilityChange(driverId: string, isAvailable: boolean, bookingId?: string) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "driver.availability_changed",
      data: {
        driverId,
        isAvailable,
        bookingId,
        timestamp: new Date()
      },
      timestamp: new Date(),
      deliveryId: bookingId || driverId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for driver ${driverId} availability change: ${isAvailable}`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for driver ${driverId} availability change:`, error)
    }
  }

  /**
   * Send webhook notification for day booking payment
   */
  async notifyDayBookingPayment(bookingId: string, paymentData: any, driverData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "day_booking.payment_processed",
      data: {
        bookingId,
        payment: paymentData,
        driver: driverData
      },
      timestamp: new Date(),
      deliveryId: bookingId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for day booking ${bookingId} payment`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for day booking ${bookingId} payment:`, error)
    }
  }

  /**
    * Send webhook notification for day booking location update
    */
  async notifyDayBookingLocationUpdate(bookingId: string, locationData: any, driverData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "day_booking.location_update",
      data: {
        bookingId,
        location: locationData,
        driver: driverData,
        timestamp: new Date()
      },
      timestamp: new Date(),
      deliveryId: bookingId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for day booking ${bookingId} location update`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for day booking ${bookingId} location update:`, error)
    }
  }

  /**
    * Send webhook notification for taxi booking request
    */
  async notifyTaxiBookingRequest(bookingId: string, bookingData: any, driverData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "taxi.booking_request",
      data: {
        bookingId,
        booking: bookingData,
        driver: driverData,
        status: "REQUESTED"
      },
      timestamp: new Date(),
      deliveryId: bookingId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for taxi booking ${bookingId} request`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for taxi booking ${bookingId} request:`, error)
    }
  }

  /**
    * Send webhook notification for taxi booking acceptance
    */
  async notifyTaxiBookingAccepted(bookingId: string, bookingData: any, driverData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "taxi.booking_accepted",
      data: {
        bookingId,
        booking: bookingData,
        driver: driverData,
        status: "ACCEPTED"
      },
      timestamp: new Date(),
      deliveryId: bookingId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for taxi booking ${bookingId} acceptance`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for taxi booking ${bookingId} acceptance:`, error)
    }
  }

  /**
    * Send webhook notification for taxi booking status update
    */
  async notifyTaxiBookingStatusUpdate(bookingId: string, status: string, bookingData: any, driverData: any, additionalData?: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
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
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for taxi booking ${bookingId} status update: ${status}`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for taxi booking ${bookingId} status update:`, error)
    }
  }

  /**
    * Send webhook notification for taxi driver location update
    */
  async notifyTaxiDriverLocationUpdate(driverId: string, locationData: any, bookingId?: string) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "taxi.driver_location_update",
      data: {
        driverId,
        location: locationData,
        bookingId,
        timestamp: new Date()
      },
      timestamp: new Date(),
      deliveryId: bookingId || driverId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for taxi driver ${driverId} location update`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for taxi driver ${driverId} location update:`, error)
    }
  }

  /**
    * Send webhook notification for taxi driver availability change
    */
  async notifyTaxiDriverAvailabilityChange(driverId: string, isAvailable: boolean, isOnline: boolean, bookingId?: string) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
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
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for taxi driver ${driverId} availability change: ${isAvailable}`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for taxi driver ${driverId} availability change:`, error)
    }
  }

  /**
    * Send webhook notification for dispatch rider delivery request
    */
  async notifyDispatchDeliveryRequest(deliveryId: string, deliveryData: any, riderData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "dispatch.delivery_request",
      data: {
        deliveryId,
        delivery: deliveryData,
        rider: riderData,
        status: "REQUESTED"
      },
      timestamp: new Date(),
      deliveryId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for dispatch delivery ${deliveryId} request`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for dispatch delivery ${deliveryId} request:`, error)
    }
  }

  /**
    * Send webhook notification for dispatch rider delivery acceptance
    */
  async notifyDispatchDeliveryAccepted(deliveryId: string, deliveryData: any, riderData: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "dispatch.delivery_accepted",
      data: {
        deliveryId,
        delivery: deliveryData,
        rider: riderData,
        status: "ACCEPTED"
      },
      timestamp: new Date(),
      deliveryId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for dispatch delivery ${deliveryId} acceptance`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for dispatch delivery ${deliveryId} acceptance:`, error)
    }
  }

  /**
    * Send webhook notification for dispatch rider delivery status update
    */
  async notifyDispatchDeliveryStatusUpdate(deliveryId: string, status: string, deliveryData: any, riderData: any, additionalData?: any) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
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
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for dispatch delivery ${deliveryId} status update: ${status}`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for dispatch delivery ${deliveryId} status update:`, error)
    }
  }

  /**
    * Send webhook notification for dispatch rider location update
    */
  async notifyDispatchRiderLocationUpdate(riderId: string, locationData: any, deliveryId?: string) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
      event: "dispatch.rider_location_update",
      data: {
        riderId,
        location: locationData,
        deliveryId,
        timestamp: new Date()
      },
      timestamp: new Date(),
      deliveryId: deliveryId || riderId
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for dispatch rider ${riderId} location update`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for dispatch rider ${riderId} location update:`, error)
    }
  }

  /**
    * Send webhook notification for dispatch rider availability change
    */
  async notifyDispatchRiderAvailabilityChange(riderId: string, isAvailable: boolean, isOnline: boolean, deliveryId?: string) {
    if (!this.webhookUrl) {
      logger.warn("Webhook URL not configured, skipping webhook notification")
      return
    }

    const payload: WebhookPayload = {
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
    }

    try {
      await this.sendWebhook(payload)
      logger.info(`✅ Webhook sent for dispatch rider ${riderId} availability change: ${isAvailable}`)
    } catch (error) {
      logger.error(`❌ Failed to send webhook for dispatch rider ${riderId} availability change:`, error)
    }
  }

  /**
   * Private method to send webhook
   */
  private async sendWebhook(payload: WebhookPayload) {
    const headers: any = {
      "Content-Type": "application/json",
      "User-Agent": "TripSync-Delivery-Webhook/1.0"
    }

    // Add signature if secret is configured
    if (this.webhookSecret) {
      const signature = this.generateSignature(JSON.stringify(payload))
      headers["X-Webhook-Signature"] = signature
    }

    const response = await axios.post(this.webhookUrl!, payload, {
      headers,
      timeout: 10000 // 10 second timeout
    })

    if (response.status !== 200) {
      throw new Error(`Webhook returned status ${response.status}`)
    }
  }

  /**
   * Generate webhook signature for security
   */
  private generateSignature(payload: string): string {
    return crypto
      .createHmac("sha256", this.webhookSecret!)
      .update(payload)
      .digest("hex")
  }

  /**
   * Verify webhook signature (for incoming webhooks)
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      return true // If no secret configured, accept all
    }

    const expectedSignature = this.generateSignature(payload)
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expectedSignature, "hex")
      )
    } catch (error) {
      // If timingSafeEqual fails (different lengths), signatures don't match
      return false
    }
  }
}