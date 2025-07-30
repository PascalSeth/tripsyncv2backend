import { Router } from "express"
import { DriverController } from "../controllers/driver.controller"
import { validateRequest, validateQuery } from "../middleware/validation.middleware"
import { driverValidation } from "../validations/driver.validation"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import { authenticateToken, requireDriverRole } from "../middleware/auth.middleware"

const router = Router()
const driverController = new DriverController()

// Driver onboarding (no auth required for new drivers)
router.post("/onboard", driverController.onboardDriver)

// All other routes require authentication
router.use(authenticateToken)

// Driver profile management
router.put("/profile", validateRequest(driverValidation.updateProfile), driverController.updateProfile)
router.get("/profile", driverController.getProfile)

// Vehicle management
router.post("/vehicle", validateRequest(driverValidation.addVehicle), driverController.addVehicle)
router.put("/vehicle/:id", validateRequest(driverValidation.updateVehicle), driverController.updateVehicle)
router.get("/vehicles", driverController.getVehicles)

// Document management
router.post("/documents", validateRequest(driverValidation.uploadDocument), driverController.uploadDocument)
router.get("/documents", driverController.getDocuments)

// Availability and location (require driver role)
router.put(
  "/availability",
  requireDriverRole,
  validateRequest(driverValidation.updateAvailability),
  driverController.updateAvailability,
)
router.put(
  "/location",
  requireDriverRole,
  validateRequest(driverValidation.updateLocation),
  driverController.updateLocation,
)

// Day booking setup (require driver role)
router.post(
  "/day-booking/setup",
  requireDriverRole,
  validateRequest(driverValidation.setupDayBooking),
  driverController.setupDayBooking,
)
router.put(
  "/day-booking/availability",
  requireDriverRole,
  validateRequest(driverValidation.updateDayBookingAvailability),
  driverController.updateDayBookingAvailability,
)
router.get("/day-booking/schedule", requireDriverRole, driverController.getDayBookingSchedule)
router.put(
  "/day-booking/pricing",
  requireDriverRole,
  validateRequest(driverValidation.updateDayBookingPricing),
  driverController.updateDayBookingPricing,
)

// Booking management (require driver role)
router.get("/bookings", requireDriverRole, validateQuery(driverValidation.getBookings), driverController.getBookings)

// Booking request management (require driver role)
router.get("/bookings/pending", requireDriverRole, driverController.getPendingBookings)
router.get("/bookings/active", requireDriverRole, driverController.getActiveBooking)
router.post("/bookings/:bookingId/accept", requireDriverRole, driverController.acceptBookingRequest)
router.post("/bookings/:bookingId/reject", requireDriverRole, driverController.rejectBookingRequest)

// Update existing routes to use bookingId parameter consistently
router.put("/bookings/:bookingId/arrive", requireDriverRole, driverController.arriveAtPickup)
router.put("/bookings/:bookingId/start", requireDriverRole, driverController.startTrip)
router.put(
  "/bookings/:bookingId/complete",
  requireDriverRole,
  validateRequest(driverValidation.completeTrip),
  driverController.completeTrip,
)

// Earnings and analytics (require driver role)
router.get("/earnings", requireDriverRole, validateQuery(driverValidation.getEarnings), driverController.getEarnings)
router.get("/analytics", requireDriverRole, driverController.getAnalytics)

// Service zones management (require driver role)
router.get("/service-zones", requireDriverRole, driverController.getServiceZones)
router.put("/service-zones", requireDriverRole, driverController.updateServiceZones)
router.post("/service-zones/transfer", requireDriverRole, driverController.requestZoneTransfer)
router.get("/service-zones/statistics", requireDriverRole, driverController.getZoneStatistics)

// Admin routes (for driver management)
router.get("/all", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), driverController.getAllDrivers)
router.put("/:id/verify", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), driverController.verifyDriver)
router.put("/:id/suspend", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), driverController.suspendDriver)

export default router
