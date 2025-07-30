import { Router } from "express"
import { MovingController } from "../controllers/moving.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import {  validateRequest } from "../middleware/validation.middleware"
import { movingValidation } from "../validations/moving.validation"

const router = Router()
const movingController = new MovingController()

// Mover onboarding
router.post("/movers/onboard", authMiddleware, validateRequest(movingValidation.onboardMover), movingController.onboardMover)

router.get(
  "/movers/profile",
  authMiddleware,
  rbacMiddleware(["HOUSE_MOVER"]), // Using HOUSE_MOVER role for service providers
  movingController.getMoverProfile,
)

router.put(
  "/movers/profile",
  authMiddleware,
  rbacMiddleware(["HOUSE_MOVER"]),
  validateRequest(movingValidation.updateMoverProfile),
  movingController.updateMoverProfile,
)

// Moving booking routes
router.post(
  "/bookings",
  authMiddleware,
  validateRequest(movingValidation.createMovingBooking),
  movingController.createMovingBooking,
)

router.post("/quote", authMiddleware, validateRequest(movingValidation.getMovingQuote), movingController.getMovingQuote)

router.get("/bookings", authMiddleware, movingController.getMovingBookings)

router.get("/available-movers", authMiddleware, movingController.getAvailableMovers)

// Mover job management
router.put(
  "/movers/availability",
  authMiddleware,
  rbacMiddleware(["HOUSE_MOVER"]),
  validateRequest(movingValidation.updateMoverAvailability),
  movingController.updateMoverAvailability,
)

router.post("/bookings/:id/accept", authMiddleware, rbacMiddleware(["HOUSE_MOVER"]), movingController.acceptMovingJob)

router.post(
  "/bookings/:id/start",
  authMiddleware,
  rbacMiddleware(["HOUSE_MOVER"]),
  validateRequest(movingValidation.startMovingJob),
  movingController.startMovingJob,
)

router.post(
  "/bookings/:id/complete",
  authMiddleware,
  rbacMiddleware(["HOUSE_MOVER"]),
  validateRequest(movingValidation.completeMovingJob),
  movingController.completeMovingJob,
)

// Mover earnings and analytics
router.get("/movers/earnings", authMiddleware, rbacMiddleware(["HOUSE_MOVER"]), movingController.getMoverEarnings)

router.get("/movers/analytics", authMiddleware, rbacMiddleware(["HOUSE_MOVER"]), movingController.getMoverAnalytics)

// Admin routes
router.get("/movers/all", authMiddleware, rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), movingController.getAllMovers)

router.put(
  "/movers/:id/verify",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  movingController.verifyMover,
)

router.put(
  "/movers/:id/suspend",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  validateRequest(movingValidation.suspendMover),
  movingController.suspendMover,
)

export default router
