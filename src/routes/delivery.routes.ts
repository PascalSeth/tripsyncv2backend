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
 *
 * API Example:
 * POST /api/delivery/estimate
 * Headers: Authorization: Bearer <token>
 * Body: {
 *   "storeId": "store_456",
 *   "customerLatitude": 40.7128,
 *   "customerLongitude": -74.0060,
 *   "items": [
 *     { "productId": "prod_123", "quantity": 2 }
 *   ]
 * }
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Delivery estimate calculated successfully",
 *   "data": {
 *     "deliveryFee": 5.99,
 *     "estimatedDuration": 25,
 *     "estimatedDistance": 3.2,
 *     "orderTotal": 59.98,
 *     "totalCost": 65.97,
 *     "serviceFee": 1.50,
 *     "taxAmount": 3.30
 *   }
 * }
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
 *
 * API Example:
 * POST /api/delivery/store-purchase
 * Headers: Authorization: Bearer <token>
 * Body: {
 *   "storeId": "store_456",
 *   "customerId": "user_123",
 *   "pickupLocation": {
 *     "latitude": 40.7589,
 *     "longitude": -73.9851,
 *     "address": "123 Store St, New York, NY"
 *   },
 *   "deliveryLocation": {
 *     "latitude": 40.7128,
 *     "longitude": -74.0060,
 *     "address": "456 Customer Ave, New York, NY"
 *   },
 *   "items": [
 *     {
 *       "productId": "prod_123",
 *       "quantity": 2,
 *       "unitPrice": 29.99
 *     }
 *   ],
 *   "deliveryFee": 5.99,
 *   "specialInstructions": "Handle with care"
 * }
 * Response: 201 Created
 * {
 *   "success": true,
 *   "message": "Store purchase delivery created successfully",
 *   "data": {
 *     "order": {
 *       "id": "ord_123",
 *       "orderNumber": "ORD-2024-001",
 *       "totalAmount": 65.97,
 *       "status": "PENDING"
 *     },
 *     "delivery": {
 *       "id": "del_456",
 *       "trackingCode": "TRK123456789",
 *       "status": "PENDING",
 *       "estimatedDeliveryTime": "2024-09-11T08:00:00.000Z"
 *     }
 *   }
 * }
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
 *
 * API Example:
 * POST /api/delivery/user-to-user
 * Headers: Authorization: Bearer <token>
 * Body: {
 *   "senderId": "user_123",
 *   "recipientName": "John Doe",
 *   "recipientPhone": "+1234567890",
 *   "pickupLocation": {
 *     "latitude": 40.7589,
 *     "longitude": -73.9851,
 *     "address": "123 Sender St, New York, NY"
 *   },
 *   "deliveryLocation": {
 *     "latitude": 40.7128,
 *     "longitude": -74.0060,
 *     "address": "456 Recipient Ave, New York, NY"
 *   },
 *   "packageDescription": "Documents and small items",
 *   "packageValue": 150.00,
 *   "deliveryFee": 8.99,
 *   "specialInstructions": "Call recipient before delivery"
 * }
 * Response: 201 Created
 * {
 *   "success": true,
 *   "message": "User-to-user delivery created successfully",
 *   "data": {
 *     "order": {
 *       "id": "ord_124",
 *       "orderNumber": "ORD-2024-002",
 *       "totalAmount": 8.99,
 *       "status": "PENDING"
 *     },
 *     "delivery": {
 *       "id": "del_457",
 *       "trackingCode": "TRK987654321",
 *       "status": "PENDING",
 *       "recipientName": "John Doe",
 *       "recipientPhone": "+1234567890"
 *     }
 *   }
 * }
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
 *
 * API Example:
 * GET /api/delivery/track/TRK123456789
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Delivery tracking retrieved successfully",
 *   "data": {
 *     "id": "del_456",
 *     "trackingCode": "TRK123456789",
 *     "status": "IN_TRANSIT",
 *     "estimatedDeliveryTime": "2024-09-11T08:00:00.000Z",
 *     "currentLocation": {
 *       "latitude": 40.7128,
 *       "longitude": -74.0060,
 *       "address": "Manhattan, NY"
 *     },
 *     "dispatchRider": {
 *       "name": "John Rider",
 *       "phone": "+1234567890",
 *       "vehicleType": "motorcycle"
 *     },
 *     "order": {
 *       "orderNumber": "ORD-2024-001",
 *       "storeName": "Pizza Palace"
 *     }
 *   }
 * }
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
 *
 * API Example:
 * POST /api/delivery/confirm-purchase
 * Headers: Authorization: Bearer <token>
 * Body: {
 *   "confirmationToken": "conf_abc123def456"
 * }
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Purchase confirmed successfully",
 *   "data": {
 *     "orderId": "ord_123",
 *     "orderNumber": "ORD-2024-001",
 *     "status": "DELIVERED",
 *     "confirmedAt": "2024-09-11T06:25:00.000Z",
 *     "confirmationToken": "conf_abc123def456"
 *   }
 * }
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

/**
 * @route GET /api/delivery/pending
 * @desc Get pending deliveries for dispatch riders
 * @access Private (Dispatch Rider)
 *
 * API Example:
 * GET /api/delivery/pending
 * Headers: Authorization: Bearer <token>
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Pending deliveries retrieved successfully",
 *   "data": [
 *     {
 *       "id": "del_456",
 *       "orderId": "ord_123",
 *       "pickupLocation": {
 *         "latitude": 40.7128,
 *         "longitude": -74.0060,
 *         "address": "123 Main St, New York, NY"
 *       },
 *       "deliveryLocation": {
 *         "latitude": 40.7589,
 *         "longitude": -73.9851,
 *         "address": "456 Broadway, New York, NY"
 *       },
 *       "deliveryFee": 5.99,
 *       "distance": 2.5
 *     }
 *   ]
 * }
 */
router.get(
  "/pending",
  authMiddleware,
  deliveryController.getPendingDeliveries.bind(deliveryController)
)

/**
 * @route POST /api/delivery/:deliveryId/accept
 * @desc Accept a delivery request
 * @access Private (Dispatch Rider)
 *
 * API Example:
 * POST /api/delivery/del_456/accept
 * Headers: Authorization: Bearer <token>
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Delivery accepted successfully",
 *   "data": {
 *     "id": "del_456",
 *     "status": "ASSIGNED",
 *     "dispatchRiderId": "rider_789",
 *     "assignedAt": "2024-09-11T06:30:00.000Z"
 *   }
 * }
 */
router.post(
  "/:deliveryId/accept",
  authMiddleware,
  deliveryController.acceptDelivery.bind(deliveryController)
)

/**
 * @route POST /api/delivery/:deliveryId/reject
 * @desc Reject a delivery request
 * @access Private (Dispatch Rider)
 *
 * API Example:
 * POST /api/delivery/del_456/reject
 * Headers: Authorization: Bearer <token>
 * Body: { "reason": "Too far" }
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Delivery rejected successfully"
 * }
 */
router.post(
  "/:deliveryId/reject",
  authMiddleware,
  deliveryController.rejectDelivery.bind(deliveryController)
)

/**
 * @route PUT /api/delivery/:deliveryId/status
 * @desc Update delivery status
 * @access Private (Dispatch Rider)
 *
 * API Example:
 * PUT /api/delivery/del_456/status
 * Headers: Authorization: Bearer <token>
 * Body: { "status": "PICKED_UP", "notes": "Picked up successfully" }
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Delivery status updated successfully",
 *   "data": {
 *     "id": "del_456",
 *     "status": "PICKED_UP",
 *     "pickedUpAt": "2024-09-11T07:00:00.000Z"
 *   }
 * }
 */
router.put(
  "/:deliveryId/status",
  authMiddleware,
  deliveryController.updateDeliveryStatus.bind(deliveryController)
)

/**
 * @route GET /api/delivery/active
 * @desc Get active delivery for dispatch rider
 * @access Private (Dispatch Rider)
 *
 * API Example:
 * GET /api/delivery/active
 * Headers: Authorization: Bearer <token>
 * Response: 200 OK
 * {
 *   "success": true,
 *   "message": "Active delivery retrieved successfully",
 *   "data": {
 *     "id": "del_456",
 *     "status": "IN_TRANSIT",
 *     "orderId": "ord_123",
 *     "customer": {
 *       "name": "John Doe",
 *       "phone": "+1234567890"
 *     },
 *     "pickupLocation": { ... },
 *     "deliveryLocation": { ... }
 *   }
 * }
 */
router.get(
  "/active",
  authMiddleware,
  deliveryController.getActiveDelivery.bind(deliveryController)
)

export default router