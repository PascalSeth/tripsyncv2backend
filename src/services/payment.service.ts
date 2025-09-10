import axios from "axios"
import prisma from "../config/database"
import type { PaystackResponse } from "../types"
import logger from "../utils/logger"

export class PaymentService {
  private paystackSecretKey = process.env.PAYSTACK_SECRET_KEY!
  private paystackBaseUrl = "https://api.paystack.co"

  async processPayment(paymentData: {
    userId: string
    bookingId: string
    amount: number
    paymentMethodId?: string
    description: string
    paymentMethod?: "CASH" | "CARD" | "MOBILE_MONEY"
  }) {
    try {
      console.log(`💳 PROCESSING PAYMENT:`, {
        userId: paymentData.userId,
        bookingId: paymentData.bookingId,
        amount: paymentData.amount,
        paymentMethod: paymentData.paymentMethod,
        paymentMethodId: paymentData.paymentMethodId,
      })

      // Get booking to check payment method
      const booking = await prisma.booking.findUnique({
        where: { id: paymentData.bookingId },
        select: { paymentMethodId: true },
      })

      const paymentMethod = paymentData.paymentMethod || (booking?.paymentMethodId ? "CARD" : "CASH")

      // Handle cash payments
      if (paymentMethod === "CASH") {
        console.log(`💵 Processing CASH payment for booking ${paymentData.bookingId}`)

        // Create transaction record for cash payment
        const transaction = await prisma.transaction.create({
          data: {
            userId: paymentData.userId,
            bookingId: paymentData.bookingId,
            amount: paymentData.amount,
            currency: "GHS",
            type: "PAYMENT",
            status: "COMPLETED", // Cash payments are immediately completed
            description: paymentData.description,
            platformCommission: paymentData.amount * 0.18,
            serviceFee: 0, // No service fee for cash
            paystackReference: null,
          },
        })

        console.log(`✅ Cash payment processed successfully:`, transaction.id)
        return transaction
      }

      // Handle card/mobile money payments
      if (!paymentData.paymentMethodId) {
        throw new Error("Payment method ID is required for non-cash payments")
      }

      // Get payment method for card/mobile money
      const savedPaymentMethod = await prisma.paymentMethod.findUnique({
        where: { id: paymentData.paymentMethodId },
        include: { user: true },
      })

      if (!savedPaymentMethod) {
        throw new Error("Payment method not found")
      }

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId: paymentData.userId,
          bookingId: paymentData.bookingId,
          paymentMethodId: paymentData.paymentMethodId,
          amount: paymentData.amount,
          currency: "GHS",
          type: "PAYMENT",
          status: "PENDING",
          description: paymentData.description,
          platformCommission: paymentData.amount * 0.18,
          serviceFee: paymentData.amount * 0.025,
          paystackReference: this.generateReference(),
        },
      })

      // Process with Paystack for card payments
      if (paymentMethod === "CARD") {
        const paystackResponse = await this.chargeCard({
          email: savedPaymentMethod.user.email || savedPaymentMethod.user.phone + "@tripsync.com",
          amount: paymentData.amount * 100, // Convert to kobo
          authorization_code: savedPaymentMethod.paystackAuthCode!,
          reference: transaction.paystackReference!,
        })

        // Update transaction status
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            status: paystackResponse.status ? "COMPLETED" : "FAILED",
            paystackResponse: paystackResponse,
            paystackTransactionId: paystackResponse.data?.id,
            paystackStatus: paystackResponse.data?.status,
          },
        })
      }

      return transaction
    } catch (error) {
      logger.error("Process payment error:", error)
      throw error
    }
  }

  async initializePayment(data: {
    email: string
    amount: number
    reference: string
    callback_url?: string
  }): Promise<PaystackResponse> {
    try {
      const response = await axios.post(`${this.paystackBaseUrl}/transaction/initialize`, data, {
        headers: {
          Authorization: `Bearer ${this.paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      })

      return response.data
    } catch (error: any) {
      logger.error("Initialize payment error:", error.response?.data || error.message)
      throw new Error("Payment initialization failed")
    }
  }

  async chargeCard(data: {
    email: string
    amount: number
    authorization_code: string
    reference: string
  }): Promise<PaystackResponse> {
    try {
      const response = await axios.post(`${this.paystackBaseUrl}/transaction/charge_authorization`, data, {
        headers: {
          Authorization: `Bearer ${this.paystackSecretKey}`,
          "Content-Type": "application/json",
        },
      })

      return response.data
    } catch (error: any) {
      logger.error("Charge card error:", error.response?.data || error.message)
      throw new Error("Card charge failed")
    }
  }

  async verifyTransaction(reference: string): Promise<PaystackResponse> {
    try {
      const response = await axios.get(`${this.paystackBaseUrl}/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${this.paystackSecretKey}`,
        },
      })

      return response.data
    } catch (error: any) {
      logger.error("Verify transaction error:", error.response?.data || error.message)
      throw new Error("Transaction verification failed")
    }
  }

  async processPendingPayouts() {
    try {
      const pendingPayouts = await prisma.providerPayout.findMany({
        where: {
          status: "PENDING",
          scheduledFor: {
            lte: new Date(),
          },
        },
        include: {
          provider: true,
        },
      })

      for (const payout of pendingPayouts) {
        try {
          await this.processSinglePayout(payout)
        } catch (error) {
          logger.error(`Failed to process payout ${payout.id}:`, error)

          // Update retry count
          await prisma.providerPayout.update({
            where: { id: payout.id },
            data: {
              retryCount: { increment: 1 },
              failureReason: error instanceof Error ? error.message : "Unknown error",
              status: payout.retryCount >= payout.maxRetries ? "FAILED" : "PENDING",
            },
          })
        }
      }
    } catch (error) {
      logger.error("Process pending payouts error:", error)
      throw error
    }
  }

  private async processSinglePayout(payout: any) {
    // Implementation for processing individual payouts
    // This would integrate with Paystack transfers or mobile money APIs
    logger.info(`Processing payout ${payout.id} for provider ${payout.providerId}`)

    // Update payout status
    await prisma.providerPayout.update({
      where: { id: payout.id },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
      },
    })
  }

  private generateReference(): string {
    return `trp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }
}
