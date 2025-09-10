"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const driver_controller_1 = require("../controllers/driver.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const driver_validation_1 = require("../validations/driver.validation");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const driverController = new driver_controller_1.DriverController();
// Driver onboarding (no auth required for new drivers)
router.post("/onboard", (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.onboard), driverController.onboardDriver);
// All other routes require authentication
router.use(auth_middleware_1.authenticateToken);
router.get("/booking-updates", driverController.getBookingUpdates);
// Driver profile management
router.put("/profile", (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.updateProfile), driverController.updateProfile);
router.get("/profile", driverController.getProfile);
// Vehicle management
router.post("/vehicle", (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.addVehicle), driverController.addVehicle);
router.put("/vehicle/:id", (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.updateVehicle), driverController.updateVehicle);
router.get("/vehicles", driverController.getVehicles);
// Document management
router.post("/documents", (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.uploadDocument), driverController.uploadDocument);
router.get("/documents", driverController.getDocuments);
// Availability and location (require driver role)
router.put("/availability", auth_middleware_1.requireDriverRole, (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.updateAvailability), driverController.updateAvailability);
router.put("/location", auth_middleware_1.requireDriverRole, (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.updateLocation), driverController.updateLocation);
// Day booking setup (require driver role)
router.post("/day-booking/setup", auth_middleware_1.requireDriverRole, (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.setupDayBooking), driverController.setupDayBooking);
router.put("/day-booking/availability", auth_middleware_1.requireDriverRole, (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.updateDayBookingAvailability), driverController.updateDayBookingAvailability);
router.get("/day-booking/schedule", auth_middleware_1.requireDriverRole, driverController.getDayBookingSchedule);
router.put("/day-booking/pricing", auth_middleware_1.requireDriverRole, (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.updateDayBookingPricing), driverController.updateDayBookingPricing);
// Booking management (require driver role)
router.get("/bookings", auth_middleware_1.requireDriverRole, (0, validation_middleware_1.validateQuery)(driver_validation_1.driverValidation.getBookings), driverController.getBookings);
// Booking request management (require driver role)
router.get("/bookings/pending", auth_middleware_1.requireDriverRole, driverController.getPendingBookings);
router.get("/bookings/active", auth_middleware_1.requireDriverRole, driverController.getActiveBooking);
router.post("/bookings/:bookingId/accept", auth_middleware_1.requireDriverRole, driverController.acceptBookingRequest);
router.post("/bookings/:bookingId/reject", auth_middleware_1.requireDriverRole, driverController.rejectBookingRequest);
// Update existing routes to use bookingId parameter consistently
router.put("/bookings/:bookingId/arrive", auth_middleware_1.requireDriverRole, driverController.arriveAtPickup);
router.put("/bookings/:bookingId/start", auth_middleware_1.requireDriverRole, driverController.startTrip);
router.put("/bookings/:bookingId/complete", auth_middleware_1.requireDriverRole, (0, validation_middleware_1.validateRequest)(driver_validation_1.driverValidation.completeTrip), driverController.completeTrip);
// Earnings and analytics (require driver role)
router.get("/earnings", auth_middleware_1.requireDriverRole, (0, validation_middleware_1.validateQuery)(driver_validation_1.driverValidation.getEarnings), driverController.getEarnings);
router.get("/analytics", auth_middleware_1.requireDriverRole, driverController.getAnalytics);
// Service zones management (require driver role)
router.get("/service-zones", auth_middleware_1.requireDriverRole, driverController.getServiceZones);
router.put("/service-zones", auth_middleware_1.requireDriverRole, driverController.updateServiceZones);
router.post("/service-zones/transfer", auth_middleware_1.requireDriverRole, driverController.requestZoneTransfer);
router.get("/service-zones/statistics", auth_middleware_1.requireDriverRole, driverController.getZoneStatistics);
// Admin routes (for driver management)
router.get("/all", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), driverController.getAllDrivers);
router.put("/:id/verify", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), driverController.verifyDriver);
router.put("/:id/suspend", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), driverController.suspendDriver);
exports.default = router;
