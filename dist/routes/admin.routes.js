"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const adminController = new admin_controller_1.AdminController();
// Apply auth and admin role check to all routes
router.use(auth_middleware_1.authMiddleware);
router.use((0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]));
// Get admin dashboard
router.get("/dashboard", adminController.getDashboard);
// Approve driver
router.put("/drivers/:driverId/approve", [(0, express_validator_1.param)("driverId").isUUID().withMessage("Valid driver ID is required")], validation_middleware_1.validateRequest, adminController.approveDriver);
// Suspend user
router.put("/users/:userId/suspend", [
    (0, express_validator_1.param)("userId").isUUID().withMessage("Valid user ID is required"),
    (0, express_validator_1.body)("reason").notEmpty().withMessage("Suspension reason is required"),
], validation_middleware_1.validateRequest, adminController.suspendUser);
// Get system metrics
router.get("/metrics", adminController.getSystemMetrics);
// Get pending verifications
router.get("/verifications/pending", adminController.getPendingVerifications);
// Review document
router.put("/documents/:documentId/review", [
    (0, express_validator_1.param)("documentId").isUUID().withMessage("Valid document ID is required"),
    (0, express_validator_1.body)("decision").isIn(["APPROVED", "REJECTED"]).withMessage("Decision must be APPROVED or REJECTED"),
    (0, express_validator_1.body)("rejectionReason").optional().isString(),
], validation_middleware_1.validateRequest, adminController.reviewDocument);
exports.default = router;
