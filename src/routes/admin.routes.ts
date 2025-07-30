import { Router } from "express"
import { AdminController } from "../controllers/admin.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import { validateRequest } from "../middleware/validation.middleware"
import { body, param } from "express-validator"

const router = Router()
const adminController = new AdminController()

// Apply auth and admin role check to all routes
router.use(authMiddleware)
router.use(rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]))

// Get admin dashboard
router.get("/dashboard", adminController.getDashboard)

// Approve driver
router.put(
  "/drivers/:driverId/approve",
  [param("driverId").isUUID().withMessage("Valid driver ID is required")],
  validateRequest,
  adminController.approveDriver,
)

// Suspend user
router.put(
  "/users/:userId/suspend",
  [
    param("userId").isUUID().withMessage("Valid user ID is required"),
    body("reason").notEmpty().withMessage("Suspension reason is required"),
  ],
  validateRequest,
  adminController.suspendUser,
)

// Get system metrics
router.get("/metrics", adminController.getSystemMetrics)

// Get pending verifications
router.get("/verifications/pending", adminController.getPendingVerifications)

// Review document
router.put(
  "/documents/:documentId/review",
  [
    param("documentId").isUUID().withMessage("Valid document ID is required"),
    body("decision").isIn(["APPROVED", "REJECTED"]).withMessage("Decision must be APPROVED or REJECTED"),
    body("rejectionReason").optional().isString(),
  ],
  validateRequest,
  adminController.reviewDocument,
)

export default router
