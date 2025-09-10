"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const subscriptionController = new subscription_controller_1.SubscriptionController();
// Get subscription plans
router.get("/plans", subscriptionController.getPlans);
// Subscribe to a plan
router.post("/subscribe", auth_middleware_1.authMiddleware, [
    (0, express_validator_1.body)("planId").notEmpty().withMessage("Plan ID is required"),
    (0, express_validator_1.body)("paymentMethodId").notEmpty().withMessage("Payment method ID is required"),
], validation_middleware_1.validateRequest, subscriptionController.subscribe);
// Get subscription benefits
router.get("/benefits", auth_middleware_1.authMiddleware, subscriptionController.getBenefits);
// Renew subscription
router.post("/renew", auth_middleware_1.authMiddleware, subscriptionController.renewSubscription);
exports.default = router;
