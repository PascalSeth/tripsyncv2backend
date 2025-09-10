"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emergency_controller_1 = require("../controllers/emergency.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const emergency_validation_1 = require("../validations/emergency.validation");
const validation_middleware_1 = require("../middleware/validation.middleware");
const router = (0, express_1.Router)();
const emergencyController = new emergency_controller_1.EmergencyController();
// Emergency booking routes
router.post("/bookings", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.createEmergencyBooking), emergencyController.createEmergencyBooking);
router.get("/bookings", auth_middleware_1.authMiddleware, emergencyController.getEmergencyBookings);
router.put("/bookings/:id/status", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["EMERGENCY_RESPONDER"]), (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.updateEmergencyStatus), emergencyController.updateEmergencyStatus);
router.post("/bookings/:id/accept", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["EMERGENCY_RESPONDER"]), emergencyController.acceptEmergencyCall);
router.post("/bookings/:id/complete", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["EMERGENCY_RESPONDER"]), (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.completeEmergencyCall), emergencyController.completeEmergencyCall);
// Emergency responder routes
router.post("/responders/onboard", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.onboardEmergencyResponder), emergencyController.onboardEmergencyResponder);
router.get("/responders/profile", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["EMERGENCY_RESPONDER"]), emergencyController.getResponderProfile);
router.put("/responders/profile", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["EMERGENCY_RESPONDER"]), (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.updateResponderProfile), emergencyController.updateResponderProfile);
router.get("/nearby", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["EMERGENCY_RESPONDER"]), emergencyController.getNearbyEmergencies);
router.put("/responders/location", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["EMERGENCY_RESPONDER"]), (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.updateResponderLocation), emergencyController.updateResponderLocation);
// Analytics routes
router.get("/analytics", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), emergencyController.getEmergencyAnalytics);
// Admin routes
router.get("/responders", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), emergencyController.getAllEmergencyResponders);
router.put("/responders/:id/verify", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), emergencyController.verifyEmergencyResponder);
// Emergency contacts routes
router.post("/contacts", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.addEmergencyContact), emergencyController.addEmergencyContact);
router.get("/contacts", auth_middleware_1.authMiddleware, emergencyController.getEmergencyContacts);
router.delete("/contacts/:contactId", auth_middleware_1.authMiddleware, emergencyController.removeEmergencyContact);
// Location sharing routes
router.post("/location/share", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.shareLocation), emergencyController.shareLocation);
router.get("/location/history", auth_middleware_1.authMiddleware, emergencyController.getLocationSharingHistory);
router.post("/location/stop", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.stopLocationSharing), emergencyController.stopLocationSharing);
router.post("/location/track", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(emergency_validation_1.emergencyValidation.trackUserLocation), emergencyController.trackUserLocation);
exports.default = router;
