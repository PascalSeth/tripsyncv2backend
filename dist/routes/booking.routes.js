"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const booking_controller_1 = require("../controllers/booking.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const bookingController = new booking_controller_1.BookingController();
// Apply authentication middleware to all routes
router.use(auth_middleware_1.authenticateToken);
// Booking management routes
router.post("/", bookingController.createBooking);
router.get("/", bookingController.getBookings);
router.get("/:id", bookingController.getBookingById);
router.put("/:id/cancel", bookingController.cancelBooking);
// Service-specific booking routes
router.post("/ride", (0, auth_middleware_1.requireRole)(["USER"]), bookingController.createRideBooking);
router.post("/day-booking", (0, auth_middleware_1.requireRole)(["USER"]), bookingController.createDayBooking);
router.post("/store-delivery", (0, auth_middleware_1.requireRole)(["USER"]), bookingController.createStoreDelivery);
router.post("/house-moving", (0, auth_middleware_1.requireRole)(["USER"]), bookingController.createHouseMoving);
router.post("/shared-ride", (0, auth_middleware_1.requireRole)(["USER"]), bookingController.createSharedRide);
router.post("/taxi", (0, auth_middleware_1.requireRole)(["USER"]), bookingController.createTaxiBooking);
router.post("/package-delivery", (0, auth_middleware_1.requireRole)(["USER"]), bookingController.createPackageDelivery);
router.post("/food-delivery", (0, auth_middleware_1.requireRole)(["USER"]), bookingController.createFoodDelivery);
// Booking estimates
router.post("/estimate", bookingController.getBookingEstimate);
// Tracking
router.get("/:id/tracking", bookingController.getBookingTracking);
router.get("/:id/status", bookingController.getBookingStatus);
exports.default = router;
