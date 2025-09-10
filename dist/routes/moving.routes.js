"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const moving_controller_1 = require("../controllers/moving.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const moving_validation_1 = require("../validations/moving.validation");
const router = (0, express_1.Router)();
const movingController = new moving_controller_1.MovingController();
// Mover onboarding
router.post("/movers/onboard", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(moving_validation_1.movingValidation.onboardMover), movingController.onboardMover);
router.get("/movers/profile", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["HOUSE_MOVER"]), // Using HOUSE_MOVER role for service providers
movingController.getMoverProfile);
router.put("/movers/profile", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["HOUSE_MOVER"]), (0, validation_middleware_1.validateRequest)(moving_validation_1.movingValidation.updateMoverProfile), movingController.updateMoverProfile);
// Moving booking routes
router.post("/bookings", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(moving_validation_1.movingValidation.createMovingBooking), movingController.createMovingBooking);
router.post("/quote", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(moving_validation_1.movingValidation.getMovingQuote), movingController.getMovingQuote);
router.get("/bookings", auth_middleware_1.authMiddleware, movingController.getMovingBookings);
router.get("/available-movers", auth_middleware_1.authMiddleware, movingController.getAvailableMovers);
// Mover job management
router.put("/movers/availability", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["HOUSE_MOVER"]), (0, validation_middleware_1.validateRequest)(moving_validation_1.movingValidation.updateMoverAvailability), movingController.updateMoverAvailability);
router.post("/bookings/:id/accept", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["HOUSE_MOVER"]), movingController.acceptMovingJob);
router.post("/bookings/:id/start", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["HOUSE_MOVER"]), (0, validation_middleware_1.validateRequest)(moving_validation_1.movingValidation.startMovingJob), movingController.startMovingJob);
router.post("/bookings/:id/complete", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["HOUSE_MOVER"]), (0, validation_middleware_1.validateRequest)(moving_validation_1.movingValidation.completeMovingJob), movingController.completeMovingJob);
// Mover earnings and analytics
router.get("/movers/earnings", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["HOUSE_MOVER"]), movingController.getMoverEarnings);
router.get("/movers/analytics", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["HOUSE_MOVER"]), movingController.getMoverAnalytics);
// Admin routes
router.get("/movers/all", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), movingController.getAllMovers);
router.put("/movers/:id/verify", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), movingController.verifyMover);
router.put("/movers/:id/suspend", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), (0, validation_middleware_1.validateRequest)(moving_validation_1.movingValidation.suspendMover), movingController.suspendMover);
exports.default = router;
