"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const user_validation_1 = require("../validations/user.validation");
const router = (0, express_1.Router)();
const userController = new user_controller_1.UserController();
// User profile management
router.get("/profile", auth_middleware_1.authenticateToken, userController.getProfile);
router.put("/profile", auth_middleware_1.authenticateToken, (0, validation_middleware_1.validateRequest)(user_validation_1.userValidation.updateProfile), userController.updateProfile);
router.patch("/profile/email", auth_middleware_1.authenticateToken, (0, validation_middleware_1.validateRequest)(user_validation_1.userValidation.updateEmail), userController.updateEmail);
router.patch("/profile/phone", auth_middleware_1.authenticateToken, (0, validation_middleware_1.validateRequest)(user_validation_1.userValidation.updatePhoneNumber), userController.updatePhoneNumber);
router.patch("/profile/password", auth_middleware_1.authenticateToken, (0, validation_middleware_1.validateRequest)(user_validation_1.userValidation.changePassword), userController.changePassword);
// Two-Factor Authentication (2FA)
router.post("/2fa/enable", auth_middleware_1.authenticateToken, userController.enableTwoFactorAuth);
router.post("/2fa/verify-setup", auth_middleware_1.authenticateToken, (0, validation_middleware_1.validateRequest)(user_validation_1.userValidation.verifyTwoFactorAuthSetup), userController.verifyTwoFactorAuthSetup);
router.post("/2fa/disable", auth_middleware_1.authenticateToken, (0, validation_middleware_1.validateRequest)(user_validation_1.userValidation.disableTwoFactorAuth), userController.disableTwoFactorAuth);
exports.default = router;
