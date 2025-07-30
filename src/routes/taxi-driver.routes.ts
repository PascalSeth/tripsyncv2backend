import { Router } from "express"
import { TaxiDriverController } from "../controllers/taxi-driver.controller"
import { validateRequest, validateQuery } from "../middleware/validation.middleware"
import { taxiDriverValidation } from "../validations/taxi-driver.validation"
import { rbacMiddleware } from "../middleware/rbac.middleware"

const router = Router()
const taxiDriverController = new TaxiDriverController()

// Taxi driver onboarding and profile
router.post("/onboard", validateRequest(taxiDriverValidation.onboard), taxiDriverController.onboardTaxiDriver)
router.put("/profile", validateRequest(taxiDriverValidation.updateProfile), taxiDriverController.updateProfile)
router.get("/profile", taxiDriverController.getProfile)

// Vehicle management
router.post("/vehicle", validateRequest(taxiDriverValidation.addVehicle), taxiDriverController.addVehicle)
router.put("/vehicle/:id", validateRequest(taxiDriverValidation.updateVehicle), taxiDriverController.updateVehicle)
router.get("/vehicles", taxiDriverController.getVehicles)

// Document management
router.post("/documents", validateRequest(taxiDriverValidation.uploadDocument), taxiDriverController.uploadDocument)
router.get("/documents", taxiDriverController.getDocuments)

// Availability and location
router.put(
  "/availability",
  validateRequest(taxiDriverValidation.updateAvailability),
  taxiDriverController.updateAvailability,
)
router.put("/location", validateRequest(taxiDriverValidation.updateLocation), taxiDriverController.updateLocation)

// Operating hours
router.put(
  "/operating-hours",
  validateRequest(taxiDriverValidation.updateOperatingHours),
  taxiDriverController.updateOperatingHours,
)

// Booking management
router.get("/bookings", validateQuery(taxiDriverValidation.getBookings), taxiDriverController.getBookings)
router.put("/bookings/:id/accept", taxiDriverController.acceptBooking)
router.put(
  "/bookings/:id/reject",
  validateRequest(taxiDriverValidation.rejectBooking),
  taxiDriverController.rejectBooking,
)
router.put("/bookings/:id/arrive", taxiDriverController.arriveAtPickup)
router.put("/bookings/:id/start", taxiDriverController.startTrip)
router.put(
  "/bookings/:id/complete",
  validateRequest(taxiDriverValidation.completeTrip),
  taxiDriverController.completeTrip,
)

// Earnings and analytics
router.get("/earnings", validateQuery(taxiDriverValidation.getEarnings), taxiDriverController.getEarnings)
router.get("/analytics", taxiDriverController.getAnalytics)

// Admin routes (for taxi driver management)
router.get("/all", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), taxiDriverController.getAllTaxiDrivers)
router.put("/:id/verify", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), taxiDriverController.verifyTaxiDriver)
router.put("/:id/suspend", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), taxiDriverController.suspendTaxiDriver)

export default router
