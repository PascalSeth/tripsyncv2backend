import { Router } from "express"
import { StoreController } from "../controllers/store.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import { storeValidation } from "../validations/store.validation"
import { validateRequest } from "../middleware/validation.middleware"

const router = Router()
const storeController = new StoreController()

// Store owner onboarding
router.post(
  "/owners/onboard",
  authMiddleware,
  validateRequest(storeValidation.onboardStoreOwner),
  storeController.onboardStoreOwner,
)

router.get("/owners/profile", authMiddleware, rbacMiddleware(["STORE_OWNER"]), storeController.getStoreOwnerProfile)

router.put(
  "/owners/profile",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(storeValidation.updateStoreOwnerProfile),
  storeController.updateStoreOwnerProfile,
)

// Store management
router.post(
  "/",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(storeValidation.createStore),
  storeController.createStore,
)

router.get("/", storeController.getStores)

router.get("/:id", storeController.getStoreById)

router.put(
  "/:id",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER", "SUPER_ADMIN", "CITY_ADMIN"]),
  validateRequest(storeValidation.updateStore),
  storeController.updateStore,
)

router.delete(
  "/:id",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER", "SUPER_ADMIN", "CITY_ADMIN"]),
  storeController.deleteStore,
)

// Product management
router.post(
  "/:id/products",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(storeValidation.addProduct),
  storeController.addProduct,
)

router.get("/:id/products", storeController.getProducts)

router.put(
  "/:id/products/:productId",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(storeValidation.updateProduct),
  storeController.updateProduct,
)

router.delete(
  "/:id/products/:productId",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  storeController.deleteProduct,
)

// Business hours
router.put(
  "/:id/business-hours",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(storeValidation.updateBusinessHours),
  storeController.updateBusinessHours,
)

router.get("/:id/business-hours", storeController.getBusinessHours)

// Analytics
router.get("/:id/analytics", authMiddleware, rbacMiddleware(["STORE_OWNER"]), storeController.getStoreAnalytics)

// Inventory management
router.put(
  "/:id/products/:productId/inventory",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(storeValidation.updateInventory),
  storeController.updateInventory,
)

router.get("/:id/low-stock", authMiddleware, rbacMiddleware(["STORE_OWNER"]), storeController.getLowStockProducts)

// Admin routes
router.get(
  "/owners/all",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  storeController.getAllStoreOwners,
)

router.put(
  "/owners/:id/verify",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  storeController.verifyStoreOwner,
)

router.put(
  "/owners/:id/reject",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  validateRequest(storeValidation.rejectStoreOwner),
  storeController.rejectStoreOwner,
)

export default router
