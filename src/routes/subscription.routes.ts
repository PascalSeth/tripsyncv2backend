import { Router } from "express"
import { SubscriptionController } from "../controllers/subscription.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { validateRequest } from "../middleware/validation.middleware"
import { body } from "express-validator"

const router = Router()
const subscriptionController = new SubscriptionController()

// Get subscription plans
router.get("/plans", subscriptionController.getPlans)

// Subscribe to a plan
router.post(
  "/subscribe",
  authMiddleware,
  [
    body("planId").notEmpty().withMessage("Plan ID is required"),
    body("paymentMethodId").notEmpty().withMessage("Payment method ID is required"),
  ],
  validateRequest,
  subscriptionController.subscribe,
)

// Get subscription benefits
router.get("/benefits", authMiddleware, subscriptionController.getBenefits)

// Renew subscription
router.post("/renew", authMiddleware, subscriptionController.renewSubscription)

export default router
