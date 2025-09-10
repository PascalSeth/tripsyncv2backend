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

// SPECIFIC ROUTES FIRST - These must come before parameterized routes

// Category management routes
router.get("/categories", storeController.getCategories)

router.post(
  "/categories",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN"]),
  storeController.uploadCategoryImage, // Using controller method instead of imported middleware
  validateRequest(storeValidation.createCategory),
  storeController.createCategory,
)

router.put(
  "/categories/:categoryId", // Changed from :id to :categoryId for clarity
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN"]),
  validateRequest(storeValidation.updateCategory),
  storeController.updateCategory,
)

router.delete(
  "/categories/:categoryId",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN"]),
  storeController.deleteCategory,
)

// Subcategory management routes
router.get("/subcategories", storeController.getSubcategories)

router.post(
  "/subcategories",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN"]),
  storeController.uploadSubcategoryImage, // Added image upload middleware for subcategory creation
  validateRequest(storeValidation.createSubcategory),
  storeController.createSubcategory,
)

router.put(
  "/subcategories/:subcategoryId", // Changed from :id to :subcategoryId for clarity
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN"]),
  storeController.uploadSubcategoryImage, // Added image upload middleware for subcategory updates
  validateRequest(storeValidation.updateSubcategory),
  storeController.updateSubcategory,
)

router.delete(
  "/subcategories/:subcategoryId",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN"]),
  storeController.deleteSubcategory,
)

// Admin routes for store owners
router.get(
  "/owners/all",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  storeController.getAllStoreOwners,
)

// Admin product management - get all products across all stores
router.get(
  "/admin/products",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  storeController.getAllProducts,
)

router.put(
  "/owners/:ownerId/verify", // Changed from :id to :ownerId for clarity
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  storeController.verifyStoreOwner,
)

router.put(
  "/owners/:ownerId/reject", // Changed from :id to :ownerId for clarity
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  validateRequest(storeValidation.rejectStoreOwner),
  storeController.rejectStoreOwner,
)

// Store management - PARAMETERIZED ROUTES COME AFTER SPECIFIC ROUTES
router.post(
  "/",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER", "SUPER_ADMIN"]),
  storeController.uploadStoreImage,
  validateRequest(storeValidation.createStore),
  storeController.createStore,
)

router.get("/", storeController.getStores)

// This parameterized route must come AFTER all specific routes
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
  rbacMiddleware(["STORE_OWNER", "SUPER_ADMIN"]),
  storeController.uploadProductImages,
  validateRequest(storeValidation.addProduct),
  storeController.addProduct,
)

router.get("/:id/products", storeController.getProducts)

router.put(
  "/:id/products/:productId",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER", "SUPER_ADMIN"]),
  storeController.uploadProductImages,
  validateRequest(storeValidation.updateProduct),
  storeController.updateProduct,
)

router.delete(
  "/:id/products/:productId",
  authMiddleware,
  rbacMiddleware(["STORE_OWNER", "SUPER_ADMIN"]),
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
  rbacMiddleware(["STORE_OWNER", "SUPER_ADMIN"]),
  validateRequest(storeValidation.updateInventory),
  storeController.updateInventory,
)

router.get("/:id/low-stock", authMiddleware, rbacMiddleware(["STORE_OWNER", "SUPER_ADMIN"]), storeController.getLowStockProducts)

export default router
