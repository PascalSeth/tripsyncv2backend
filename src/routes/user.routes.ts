import { Router } from "express"
import { UserController } from "../controllers/user.controller"
import { authenticateToken } from "../middleware/auth.middleware"
import { validateRequest } from "../middleware/validation.middleware"
import { userValidation } from "../validations/user.validation"

const router = Router()
const userController = new UserController()

// User profile management
router.get("/profile", authenticateToken, userController.getProfile)
router.put("/profile", authenticateToken, validateRequest(userValidation.updateProfile), userController.updateProfile)
router.patch(
  "/profile/email",
  authenticateToken,
  validateRequest(userValidation.updateEmail),
  userController.updateEmail,
)
router.patch(
  "/profile/phone",
  authenticateToken,
  validateRequest(userValidation.updatePhoneNumber),
  userController.updatePhoneNumber,
)
router.patch(
  "/profile/password",
  authenticateToken,
  validateRequest(userValidation.changePassword),
  userController.changePassword,
)

// Two-Factor Authentication (2FA)
router.post("/2fa/enable", authenticateToken, userController.enableTwoFactorAuth)
router.post(
  "/2fa/verify-setup",
  authenticateToken,
  validateRequest(userValidation.verifyTwoFactorAuthSetup),
  userController.verifyTwoFactorAuthSetup,
)
router.post(
  "/2fa/disable",
  authenticateToken,
  validateRequest(userValidation.disableTwoFactorAuth),
  userController.disableTwoFactorAuth,
)

export default router
