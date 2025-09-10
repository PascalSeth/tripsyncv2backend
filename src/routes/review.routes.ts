import { Router } from "express"
import { ReviewController } from "../controllers/review.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import { reviewValidation } from "../validations/review.validation"
import { validateRequest } from "../middleware/validation.middleware"

const router = Router()
const reviewController = new ReviewController()

// Review submission and management
router.post("/", authMiddleware, validateRequest(reviewValidation.submitReview), reviewController.submitReview)

// Specific driver rating endpoint
router.post("/driver-rating", authMiddleware, validateRequest(reviewValidation.submitDriverRating), reviewController.submitDriverRating)

router.get("/", reviewController.getReviews)

router.get("/:id", reviewController.getReviewById)

router.put("/:id", authMiddleware, validateRequest(reviewValidation.updateReview), reviewController.updateReview)

router.delete("/:id", authMiddleware, reviewController.deleteReview)

// User reviews
router.get("/user/my-reviews", authMiddleware, reviewController.getUserReviews)

// Review interactions
router.post("/:id/helpful", authMiddleware, reviewController.markReviewHelpful)

router.post("/:id/report", authMiddleware, validateRequest(reviewValidation.reportReview), reviewController.reportReview)

// Review statistics
router.get("/stats/overview", reviewController.getReviewStats)

// Admin routes
router.get("/admin/all", authMiddleware, rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), reviewController.getAllReviews)

router.put(
  "/admin/:id/moderate",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  validateRequest(reviewValidation.moderateReview),
  reviewController.moderateReview,
)

router.get(
  "/admin/analytics",
  authMiddleware,
  rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]),
  reviewController.getReviewAnalytics,
)

export default router
