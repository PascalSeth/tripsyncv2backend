"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const review_controller_1 = require("../controllers/review.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const review_validation_1 = require("../validations/review.validation");
const validation_middleware_1 = require("../middleware/validation.middleware");
const router = (0, express_1.Router)();
const reviewController = new review_controller_1.ReviewController();
// Review submission and management
router.post("/", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(review_validation_1.reviewValidation.submitReview), reviewController.submitReview);
// Specific driver rating endpoint
router.post("/driver-rating", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(review_validation_1.reviewValidation.submitDriverRating), reviewController.submitDriverRating);
router.get("/", reviewController.getReviews);
router.get("/:id", reviewController.getReviewById);
router.put("/:id", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(review_validation_1.reviewValidation.updateReview), reviewController.updateReview);
router.delete("/:id", auth_middleware_1.authMiddleware, reviewController.deleteReview);
// User reviews
router.get("/user/my-reviews", auth_middleware_1.authMiddleware, reviewController.getUserReviews);
// Review interactions
router.post("/:id/helpful", auth_middleware_1.authMiddleware, reviewController.markReviewHelpful);
router.post("/:id/report", auth_middleware_1.authMiddleware, (0, validation_middleware_1.validateRequest)(review_validation_1.reviewValidation.reportReview), reviewController.reportReview);
// Review statistics
router.get("/stats/overview", reviewController.getReviewStats);
// Admin routes
router.get("/admin/all", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), reviewController.getAllReviews);
router.put("/admin/:id/moderate", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), (0, validation_middleware_1.validateRequest)(review_validation_1.reviewValidation.moderateReview), reviewController.moderateReview);
router.get("/admin/analytics", auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)(["SUPER_ADMIN", "CITY_ADMIN"]), reviewController.getReviewAnalytics);
exports.default = router;
