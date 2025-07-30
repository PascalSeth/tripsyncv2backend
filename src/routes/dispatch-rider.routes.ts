import { Router } from "express"
import { DispatchRiderController } from "../controllers/dispatch-rider.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import { validateRequest } from "../middleware/validation.middleware"
import {
  onboardDispatchRiderValidation,
  updateDispatchRiderProfileValidation,
  addVehicleValidation,
  updateVehicleValidation,
  uploadDocumentValidation,
  updateAvailabilityValidation,
  updateLocationValidation,
  acceptDeliveryValidation,
  rejectDeliveryValidation,
  confirmPickupValidation,
  completeDeliveryValidation,
  reportIssueValidation,
  markOrderReadyValidation,
  updateTrackingValidation,
} from "../validations/dispatch-rider.validation"

const router = Router()
const dispatchRiderController = new DispatchRiderController()

// Dispatch Rider Routes
router.post(
  "/onboard",
  // authMiddleware,
  validateRequest(onboardDispatchRiderValidation),
  dispatchRiderController.onboardDispatchRider,
)

router.get("/profile", authMiddleware, rbacMiddleware(["DRIVER", "DISPATCHER"]), dispatchRiderController.getProfile)

router.put(
  "/profile",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(updateDispatchRiderProfileValidation),
  dispatchRiderController.updateProfile,
)

// Vehicle Management
router.post(
  "/vehicles",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(addVehicleValidation),
  dispatchRiderController.addVehicle,
)

router.get(
  "/vehicles",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  dispatchRiderController.getVehicles,
)

router.put(
  "/vehicles/:vehicleId",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(updateVehicleValidation),
  dispatchRiderController.updateVehicle,
)

// Document Management
router.post(
  "/documents",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(uploadDocumentValidation),
  dispatchRiderController.uploadDocument,
)

router.get(
  "/documents",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  dispatchRiderController.getDocuments,
)

// Availability and Location
router.put(
  "/availability",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(updateAvailabilityValidation),
  dispatchRiderController.updateAvailability,
)

router.put(
  "/location",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(updateLocationValidation),
  dispatchRiderController.updateLocation,
)

// Delivery Requests
router.get(
  "/delivery-requests",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  dispatchRiderController.getDeliveryRequests,
)

router.post(
  "/delivery-requests/:deliveryId/accept",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(acceptDeliveryValidation),
  dispatchRiderController.acceptDeliveryRequest,
)

router.post(
  "/delivery-requests/:deliveryId/reject",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(rejectDeliveryValidation),
  dispatchRiderController.rejectDeliveryRequest,
)

// Delivery Process
router.post(
  "/deliveries/:deliveryId/start-pickup",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  dispatchRiderController.startPickup,
)

router.post(
  "/deliveries/:deliveryId/confirm-pickup",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(confirmPickupValidation),
  dispatchRiderController.confirmPickup,
)

router.post(
  "/deliveries/:deliveryId/start-delivery",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  dispatchRiderController.startDelivery,
)

router.post(
  "/deliveries/:deliveryId/complete",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(completeDeliveryValidation),
  dispatchRiderController.completeDelivery,
)

router.post(
  "/deliveries/:deliveryId/report-issue",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(reportIssueValidation),
  dispatchRiderController.reportIssue,
)

// Analytics and History
router.get(
  "/deliveries",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  dispatchRiderController.getDeliveries,
)

router.get(
  "/earnings",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  dispatchRiderController.getEarnings,
)

router.get(
  "/analytics",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  dispatchRiderController.getAnalytics,
)

// Store Owner Routes
router.post(
  "/orders/:orderId/ready",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(markOrderReadyValidation),
  dispatchRiderController.markOrderReady,
)

router.get(
  "/stores/:storeId/orders",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  dispatchRiderController.getStoreOrders,
)

// Tracking Routes (Public for customers)
router.get("/tracking/:deliveryId", dispatchRiderController.getDeliveryTracking)

router.put(
  "/tracking/:deliveryId",
  authMiddleware,
  rbacMiddleware(["DRIVER", "DISPATCHER"]),
  validateRequest(updateTrackingValidation),
  dispatchRiderController.updateDeliveryTracking,
)

// Admin Routes
router.get(
  "/admin/dispatch-riders",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  dispatchRiderController.getAllDispatchRiders,
)

router.post(
  "/admin/dispatch-riders/:dispatchRiderId/verify",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  dispatchRiderController.verifyDispatchRider,
)

router.post(
  "/admin/dispatch-riders/:dispatchRiderId/suspend",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  dispatchRiderController.suspendDispatchRider,
)

export default router
