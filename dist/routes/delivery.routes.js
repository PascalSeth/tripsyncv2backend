"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const delivery_controller_1 = require("../controllers/delivery.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const delivery_validation_1 = require("../validations/delivery.validation");
const router = (0, express_1.Router)();
const deliveryController = new delivery_controller_1.DeliveryController();
/**
 * @route POST /api/delivery/estimate
 * @desc Calculate delivery estimate for store purchase
 * @access Private
 */
router.post("/estimate", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(delivery_validation_1.storePurchaseDeliveryEstimateSchema), deliveryController.calculateStorePurchaseDeliveryEstimate.bind(deliveryController));
/**
 * @route POST /api/delivery/store-purchase
 * @desc Create store purchase delivery request
 * @access Private
 */
router.post("/store-purchase", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(delivery_validation_1.storePurchaseDeliverySchema), deliveryController.createStorePurchaseDelivery.bind(deliveryController));
/**
 * @route POST /api/delivery/user-to-user
 * @desc Create user-to-user delivery request
 * @access Private
 */
router.post("/user-to-user", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(delivery_validation_1.userToUserDeliverySchema), deliveryController.createUserToUserDelivery.bind(deliveryController));
/**
 * @route GET /api/delivery/track/:trackingCode
 * @desc Get delivery tracking information
 * @access Public (for recipients to track)
 */
router.get("/track/:trackingCode", (0, validation_middleware_1.validateParams)(delivery_validation_1.deliveryTrackingSchema), deliveryController.getDeliveryTracking.bind(deliveryController));
/**
 * @route GET /api/delivery/statistics
 * @desc Get delivery statistics (Admin only)
 * @access Private (Admin)
 */
router.get("/statistics", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateQuery)(delivery_validation_1.deliveryStatisticsSchema), deliveryController.getDeliveryStatistics.bind(deliveryController));
/**
 * @route POST /api/delivery/confirm-purchase
 * @desc Confirm a purchase (Store owner only)
 * @access Private
 */
router.post("/confirm-purchase", auth_middleware_1.authMiddleware, deliveryController.confirmPurchase.bind(deliveryController));
/**
 * @route GET /api/delivery/confirmation/:token
 * @desc Get purchase confirmation details
 * @access Public
 */
router.get("/confirmation/:token", deliveryController.getPurchaseConfirmation.bind(deliveryController));
/**
 * @route POST /api/delivery/send-reminders
 * @desc Send reminder emails for pending confirmations (Admin only)
 * @access Private (Admin)
 */
router.post("/send-reminders", auth_middleware_1.authMiddleware, deliveryController.sendReminderEmails.bind(deliveryController));
exports.default = router;
