import { Router } from "express"
import { BookingController } from "../controllers/booking.controller"
import { authenticateToken, requireRole } from "../middleware/auth.middleware"

const router = Router()
const bookingController = new BookingController()

// Apply authentication middleware to all routes
router.use(authenticateToken)

// Booking management routes
router.post("/", bookingController.createBooking)
router.get("/", bookingController.getBookings)
router.get("/:id", bookingController.getBookingById)
router.put("/:id/cancel", bookingController.cancelBooking)

// Service-specific booking routes
router.post("/ride", requireRole(["USER"]), bookingController.createRideBooking)
router.post("/day-booking", requireRole(["USER"]), bookingController.createDayBooking)
router.post("/store-delivery", requireRole(["USER"]), bookingController.createStoreDelivery)
router.post("/house-moving", requireRole(["USER"]), bookingController.createHouseMoving)
router.post("/shared-ride", requireRole(["USER"]), bookingController.createSharedRide)
router.post("/taxi", requireRole(["USER"]), bookingController.createTaxiBooking)
router.post("/package-delivery", requireRole(["USER"]), bookingController.createPackageDelivery)
router.post("/food-delivery", requireRole(["USER"]), bookingController.createFoodDelivery)

// Booking estimates
router.post("/estimate", bookingController.getBookingEstimate)

// Tracking
router.get("/:id/tracking", bookingController.getBookingTracking)
router.get("/:id/status",  bookingController.getBookingStatus);


export default router
