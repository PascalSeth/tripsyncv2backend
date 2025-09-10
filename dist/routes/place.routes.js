"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const place_controller_1 = require("../controllers/place.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const place_validation_1 = require("../validations/place.validation");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
const placeController = new place_controller_1.PlaceController();
// Public routes (no authentication required)
router.get("/", (0, validation_middleware_1.validateQuery)(place_validation_1.placeValidation.getPlaces), placeController.getPlaces);
router.get("/:id", placeController.getPlaceById);
router.get("/category/:categoryId", (0, validation_middleware_1.validateQuery)(place_validation_1.placeValidation.getPlacesByCategory), placeController.getPlacesByCategory);
router.get("/nearby", (0, validation_middleware_1.validateQuery)(place_validation_1.placeValidation.getNearbyPlaces), placeController.getNearbyPlaces);
// Anonymous voting routes
router.post("/vote/anonymous", (0, validation_middleware_1.validateRequest)(place_validation_1.placeValidation.anonymousVote), placeController.submitAnonymousVote);
router.get("/:id/votes", placeController.getPlaceVotes);
router.get("/:id/category-suggestions", placeController.getCategorySuggestions);
// Authenticated routes
router.use(auth_middleware_1.authMiddleware);
// User voting (authenticated)
router.post("/vote", (0, validation_middleware_1.validateRequest)(place_validation_1.placeValidation.userVote), placeController.submitUserVote);
router.get("/user/votes", placeController.getUserVotes);
// Place management (Place owners and admins)
router.post("/", (0, validation_middleware_1.validateRequest)(place_validation_1.placeValidation.createPlace), placeController.createPlace);
router.put("/:id", (0, validation_middleware_1.validateRequest)(place_validation_1.placeValidation.updatePlace), placeController.updatePlace);
router.delete("/:id", placeController.deletePlace);
// Photo management
router.post("/:id/photos", (0, validation_middleware_1.validateRequest)(place_validation_1.placeValidation.uploadPhoto), placeController.uploadPhoto);
router.delete("/photos/:photoId", placeController.deletePhoto);
// Admin routes
router.get("/admin/all", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), placeController.getAllPlaces);
router.put("/:id/approve", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), placeController.approvePlace);
router.put("/:id/reject", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), placeController.rejectPlace);
router.get("/admin/pending", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), placeController.getPendingPlaces);
// Categories management
router.get("/categories/all", placeController.getCategories);
router.post("/categories", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN"]), (0, validation_middleware_1.validateRequest)(place_validation_1.placeValidation.createCategory), placeController.createCategory);
router.put("/categories/:id", (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN"]), (0, validation_middleware_1.validateRequest)(place_validation_1.placeValidation.updateCategory), placeController.updateCategory);
exports.default = router;
