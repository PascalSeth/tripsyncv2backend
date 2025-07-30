import { Router } from "express"
import { AuthController } from "../controllers/auth.controller"
import { validateRequest } from "../middleware/validation.middleware"
import { authValidation } from "../validations/auth.validation"
import { authenticateToken } from "../middleware/auth.middleware"

const router = Router()
const authController = new AuthController()

// User authentication routes
router.post("/register", validateRequest(authValidation.register), authController.register)
router.post("/login", validateRequest(authValidation.login), authController.login)

// NEW: Driver-specific login route
router.post("/driver-login", validateRequest(authValidation.login), authController.driverLogin)

router.post("/logout", authController.logout)

// Profile management (requires authentication)
router.post(
  "/complete-profile",
  authenticateToken,
  validateRequest(authValidation.completeProfile),
  authController.completeProfile,
)
router.get("/get-profile", authenticateToken, authController.getProfile)

// Utility routes
router.post("/check-email", authController.checkEmailAvailability)

export default router
