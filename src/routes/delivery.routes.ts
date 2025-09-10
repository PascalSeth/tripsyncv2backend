import { Router } from "express"
import { DeliveryController } from "../controllers/delivery.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { validateRequest, validateParams, validateQuery } from "../middleware/validation.middleware"
import {
  storePurchaseDeliveryEstimateSchema,
  storePurchaseDeliverySchema,
  userToUserDeliverySchema,
  deliveryTrackingSchema,
  deliveryStatisticsSchema
} from "../validations/delivery.validation"

const router = Router()
const deliveryController = new DeliveryController()

/**
 * @route POST /api/delivery/estimate
 * @desc Calculate delivery estimate for store purchase
 * @access Private
 */
router.post(
  "/estimate",
  authMiddleware,
  validateRequest(storePurchaseDeliveryEstimateSchema),
  deliveryController.calculateStorePurchaseDeliveryEstimate.bind(deliveryController)
)

/**
 * @route POST /api/delivery/store-purchase
 * @desc Create store purchase delivery request
 * @access Private
 */
router.post(
  "/store-purchase",
  authMiddleware,
  validateRequest(storePurchaseDeliverySchema),
  deliveryController.createStorePurchaseDelivery.bind(deliveryController)
)

/**
 * @route POST /api/delivery/user-to-user
 * @desc Create user-to-user delivery request
 * @access Private
 */
router.post(
  "/user-to-user",
  authMiddleware,
  validateRequest(userToUserDeliverySchema),
  deliveryController.createUserToUserDelivery.bind(deliveryController)
)

/**
 * @route GET /api/delivery/track/:trackingCode
 * @desc Get delivery tracking information
 * @access Public (for recipients to track)
 */
router.get(
  "/track/:trackingCode",
  validateParams(deliveryTrackingSchema),
  deliveryController.getDeliveryTracking.bind(deliveryController)
)

/**
 * @route GET /api/delivery/statistics
 * @desc Get delivery statistics (Admin only)
 * @access Private (Admin)
 */
router.get(
  "/statistics",
  authMiddleware,
  validateQuery(deliveryStatisticsSchema),
  deliveryController.getDeliveryStatistics.bind(deliveryController)
)

/**
 * @route POST /api/delivery/confirm-purchase
 * @desc Confirm a purchase (Store owner only)
 * @access Private
 */
router.post(
  "/confirm-purchase",
  authMiddleware,
  deliveryController.confirmPurchase.bind(deliveryController)
)

/**
 * @route GET /api/delivery/confirmation/:token
 * @desc Get purchase confirmation details
 * @access Public
 */
router.get(
  "/confirmation/:token",
  deliveryController.getPurchaseConfirmation.bind(deliveryController)
)

/**
 * @route POST /api/delivery/send-reminders
 * @desc Send reminder emails for pending confirmations (Admin only)
 * @access Private (Admin)
 */
router.post(
  "/send-reminders",
  authMiddleware,
  deliveryController.sendReminderEmails.bind(deliveryController)
)

export default router