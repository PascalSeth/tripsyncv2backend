"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taxi_driver_controller_1 = require("../controllers/taxi-driver.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const taxi_driver_validation_1 = require("../validations/taxi-driver.validation");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
const taxiDriverController = new taxi_driver_controller_1.TaxiDriverController();
// Taxi driver onboarding and profile
router.post("/onboard", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.onboard), taxiDriverController.onboardTaxiDriver);
router.put("/profile", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.updateProfile), taxiDriverController.updateProfile);
router.get("/profile", taxiDriverController.getProfile);
// Vehicle management
router.post("/vehicle", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.addVehicle), taxiDriverController.addVehicle);
router.put("/vehicle/:id", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.updateVehicle), taxiDriverController.updateVehicle);
router.get("/vehicles", taxiDriverController.getVehicles);
// Document management
router.post("/documents", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.uploadDocument), taxiDriverController.uploadDocument);
router.get("/documents", taxiDriverController.getDocuments);
// Availability and location
router.put("/availability", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.updateAvailability), taxiDriverController.updateAvailability);
router.put("/location", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.updateLocation), taxiDriverController.updateLocation);
// Operating hours
router.put("/operating-hours", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.updateOperatingHours), taxiDriverController.updateOperatingHours);
// Booking management
router.get("/bookings", (0, validation_middleware_1.validateQuery)(taxi_driver_validation_1.taxiDriverValidation.getBookings), taxiDriverController.getBookings);
router.put("/bookings/:id/accept", taxiDriverController.acceptBooking);
router.put("/bookings/:id/reject", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.rejectBooking), taxiDriverController.rejectBooking);
router.put("/bookings/:id/arrive", taxiDriverController.arriveAtPickup);
router.put("/bookings/:id/start", taxiDriverController.startTrip);
router.put("/bookings/:id/complete", (0, validation_middleware_1.validateRequest)(taxi_driver_validation_1.taxiDriverValidation.completeTrip), taxiDriverController.completeTrip);
// Earnings and analytics
router.get("/earnings", (0, validation_middleware_1.validateQuery)(taxi_driver_validation_1.taxiDriverValidation.getEarnings), taxiDriverController.getEarnings);
router.get("/analytics", taxiDriverController.getAnalytics);
// Admin routes (for taxi driver management)
router.get("/all", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), taxiDriverController.getAllTaxiDrivers);
router.put("/:id/verify", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), taxiDriverController.verifyTaxiDriver);
router.put("/:id/suspend", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), taxiDriverController.suspendTaxiDriver);
exports.default = router;
