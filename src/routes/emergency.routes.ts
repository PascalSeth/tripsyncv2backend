import { Router } from "express"
import { EmergencyController } from "../controllers/emergency.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import { emergencyValidation } from "../validations/emergency.validation"
import { validateRequest } from "../middleware/validation.middleware"

const router = Router()
const emergencyController = new EmergencyController()

// Emergency booking routes
router.post(
  "/bookings",
  authMiddleware,
  validateRequest(emergencyValidation.createEmergencyBooking),
  emergencyController.createEmergencyBooking,
)

router.get("/bookings", authMiddleware, emergencyController.getEmergencyBookings)

router.put(
  "/bookings/:id/status",
  authMiddleware,
  rbacMiddleware(["EMERGENCY_RESPONDER"]),
  validateRequest(emergencyValidation.updateEmergencyStatus),
  emergencyController.updateEmergencyStatus,
)

router.post(
  "/bookings/:id/accept",
  authMiddleware,
  rbacMiddleware(["EMERGENCY_RESPONDER"]),
  emergencyController.acceptEmergencyCall,
)

router.post(
  "/bookings/:id/complete",
  authMiddleware,
  rbacMiddleware(["EMERGENCY_RESPONDER"]),
  validateRequest(emergencyValidation.completeEmergencyCall),
  emergencyController.completeEmergencyCall,
)

// Emergency responder routes
router.post(
  "/responders/onboard",
  authMiddleware,
  validateRequest(emergencyValidation.onboardEmergencyResponder),
  emergencyController.onboardEmergencyResponder,
)

router.get(
  "/responders/profile",
  authMiddleware,
  rbacMiddleware(["EMERGENCY_RESPONDER"]),
  emergencyController.getResponderProfile,
)

router.put(
  "/responders/profile",
  authMiddleware,
  rbacMiddleware(["EMERGENCY_RESPONDER"]),
  validateRequest(emergencyValidation.updateResponderProfile),
  emergencyController.updateResponderProfile,
)

router.get("/nearby", authMiddleware, rbacMiddleware(["EMERGENCY_RESPONDER"]), emergencyController.getNearbyEmergencies)

router.put(
  "/responders/location",
  authMiddleware,
  rbacMiddleware(["EMERGENCY_RESPONDER"]),
  validateRequest(emergencyValidation.updateResponderLocation),
  emergencyController.updateResponderLocation,
)

// Analytics routes
router.get(
  "/analytics",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  emergencyController.getEmergencyAnalytics,
)

// Admin routes
router.get(
  "/responders",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  emergencyController.getAllEmergencyResponders,
)

router.put(
  "/responders/:id/verify",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  emergencyController.verifyEmergencyResponder,
)

export default router
