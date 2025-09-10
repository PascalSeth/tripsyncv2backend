"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_validation_1 = require("../validations/auth.validation");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const authController = new auth_controller_1.AuthController();
// User authentication routes
router.post("/register", (0, validation_middleware_1.validateRequest)(auth_validation_1.authValidation.register), authController.register);
router.post("/login", (0, validation_middleware_1.validateRequest)(auth_validation_1.authValidation.login), authController.login);
// NEW: Driver-specific login route
router.post("/driver-login", (0, validation_middleware_1.validateRequest)(auth_validation_1.authValidation.login), authController.driverLogin);
router.post("/logout", authController.logout);
// Profile management (requires authentication)
router.post("/complete-profile", auth_middleware_1.authenticateToken, (0, validation_middleware_1.validateRequest)(auth_validation_1.authValidation.completeProfile), authController.completeProfile);
router.get("/get-profile", auth_middleware_1.authenticateToken, authController.getProfile);
// Utility routes
router.post("/check-email", authController.checkEmailAvailability);
exports.default = router;
