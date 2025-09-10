"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const store_controller_1 = require("../controllers/store.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const store_validation_1 = require("../validations/store.validation");
const validation_middleware_1 = require("../middleware/validation.middleware");
const router = (0, express_1.Router)();
const storeController = new store_controller_1.StoreController();
// Store owner onboarding
router.post("/owners/onboard", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.onboardStoreOwner), storeController.onboardStoreOwner);
router.get("/owners/profile", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), storeController.getStoreOwnerProfile);
router.put("/owners/profile", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.updateStoreOwnerProfile), storeController.updateStoreOwnerProfile);
// SPECIFIC ROUTES FIRST - These must come before parameterized routes
// Category management routes
router.get("/categories", storeController.getCategories);
router.post("/categories", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN"]), storeController.uploadCategoryImage, // Using controller method instead of imported middleware
(0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.createCategory), storeController.createCategory);
router.put("/categories/:categoryId", // Changed from :id to :categoryId for clarity
auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN"]), (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.updateCategory), storeController.updateCategory);
router.delete("/categories/:categoryId", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN"]), storeController.deleteCategory);
// Subcategory management routes
router.get("/subcategories", storeController.getSubcategories);
router.post("/subcategories", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN"]), storeController.uploadSubcategoryImage, // Added image upload middleware for subcategory creation
(0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.createSubcategory), storeController.createSubcategory);
router.put("/subcategories/:subcategoryId", // Changed from :id to :subcategoryId for clarity
auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN"]), storeController.uploadSubcategoryImage, // Added image upload middleware for subcategory updates
(0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.updateSubcategory), storeController.updateSubcategory);
router.delete("/subcategories/:subcategoryId", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN"]), storeController.deleteSubcategory);
// Admin routes for store owners
router.get("/owners/all", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), storeController.getAllStoreOwners);
// Admin product management - get all products across all stores
router.get("/admin/products", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), storeController.getAllProducts);
router.put("/owners/:ownerId/verify", // Changed from :id to :ownerId for clarity
auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), storeController.verifyStoreOwner);
router.put("/owners/:ownerId/reject", // Changed from :id to :ownerId for clarity
auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.rejectStoreOwner), storeController.rejectStoreOwner);
// Store management - PARAMETERIZED ROUTES COME AFTER SPECIFIC ROUTES
router.post("/", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER", "SUPER_ADMIN"]), storeController.uploadStoreImage, (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.createStore), storeController.createStore);
router.get("/", storeController.getStores);
// This parameterized route must come AFTER all specific routes
router.get("/:id", storeController.getStoreById);
router.put("/:id", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER", "SUPER_ADMIN", "CITY_ADMIN"]), (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.updateStore), storeController.updateStore);
router.delete("/:id", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER", "SUPER_ADMIN", "CITY_ADMIN"]), storeController.deleteStore);
// Product management
router.post("/:id/products", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER", "SUPER_ADMIN"]), (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.addProduct), storeController.addProduct);
router.get("/:id/products", storeController.getProducts);
router.put("/:id/products/:productId", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER", "SUPER_ADMIN"]), (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.updateProduct), storeController.updateProduct);
router.delete("/:id/products/:productId", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER", "SUPER_ADMIN"]), storeController.deleteProduct);
// Business hours
router.put("/:id/business-hours", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.updateBusinessHours), storeController.updateBusinessHours);
router.get("/:id/business-hours", storeController.getBusinessHours);
// Analytics
router.get("/:id/analytics", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), storeController.getStoreAnalytics);
// Inventory management
router.put("/:id/products/:productId/inventory", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER", "SUPER_ADMIN"]), (0, validation_middleware_1.validateRequest)(store_validation_1.storeValidation.updateInventory), storeController.updateInventory);
router.get("/:id/low-stock", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER", "SUPER_ADMIN"]), storeController.getLowStockProducts);
exports.default = router;
