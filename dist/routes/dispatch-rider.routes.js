"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dispatch_rider_controller_1 = require("../controllers/dispatch-rider.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const dispatch_rider_validation_1 = require("../validations/dispatch-rider.validation");
const router = (0, express_1.Router)();
const dispatchRiderController = new dispatch_rider_controller_1.DispatchRiderController();
// Dispatch Rider Routes
router.post("/onboard", 
// authMiddleware,
(0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.onboardDispatchRiderValidation), dispatchRiderController.onboardDispatchRider);
router.get("/profile", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.getProfile);
router.put("/profile", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.updateDispatchRiderProfileValidation), dispatchRiderController.updateProfile);
// Vehicle Management
router.post("/vehicles", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.addVehicleValidation), dispatchRiderController.addVehicle);
router.get("/vehicles", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.getVehicles);
router.put("/vehicles/:vehicleId", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.updateVehicleValidation), dispatchRiderController.updateVehicle);
// Document Management
router.post("/documents", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.uploadDocumentValidation), dispatchRiderController.uploadDocument);
router.get("/documents", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.getDocuments);
// Availability and Location
router.put("/availability", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.updateAvailabilityValidation), dispatchRiderController.updateAvailability);
router.put("/location", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.updateLocationValidation), dispatchRiderController.updateLocation);
// Delivery Requests
router.get("/delivery-requests", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.getDeliveryRequests);
router.post("/delivery-requests/:deliveryId/accept", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.acceptDeliveryValidation), dispatchRiderController.acceptDeliveryRequest);
router.post("/delivery-requests/:deliveryId/reject", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.rejectDeliveryValidation), dispatchRiderController.rejectDeliveryRequest);
// Delivery Process
router.post("/deliveries/:deliveryId/start-pickup", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.startPickup);
router.post("/deliveries/:deliveryId/confirm-pickup", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.confirmPickupValidation), dispatchRiderController.confirmPickup);
router.post("/deliveries/:deliveryId/start-delivery", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.startDelivery);
router.post("/deliveries/:deliveryId/complete", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.completeDeliveryValidation), dispatchRiderController.completeDelivery);
router.post("/deliveries/:deliveryId/report-issue", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.reportIssueValidation), dispatchRiderController.reportIssue);
// Analytics and History
router.get("/deliveries", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.getDeliveries);
router.get("/earnings", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.getEarnings);
router.get("/analytics", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), dispatchRiderController.getAnalytics);
// Store Owner Routes
router.post("/orders/:orderId/ready", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.markOrderReadyValidation), dispatchRiderController.markOrderReady);
router.get("/stores/:storeId/orders", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), dispatchRiderController.getStoreOrders);
// Tracking Routes (Public for customers)
router.get("/tracking/:deliveryId", dispatchRiderController.getDeliveryTracking);
router.put("/tracking/:deliveryId", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["DRIVER", "DISPATCHER"]), (0, validation_middleware_1.validateRequest)(dispatch_rider_validation_1.updateTrackingValidation), dispatchRiderController.updateDeliveryTracking);
// Admin Routes
router.get("/admin/dispatch-riders", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), dispatchRiderController.getAllDispatchRiders);
router.post("/admin/dispatch-riders/:dispatchRiderId/verify", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), dispatchRiderController.verifyDispatchRider);
router.post("/admin/dispatch-riders/:dispatchRiderId/suspend", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), dispatchRiderController.suspendDispatchRider);
exports.default = router;
