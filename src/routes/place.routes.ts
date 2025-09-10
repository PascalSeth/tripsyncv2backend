import { Router } from "express"
import multer from "multer"
import { PlaceController } from "../controllers/place.controller"
import { validateRequest, validateQuery } from "../middleware/validation.middleware"
import { placeValidation } from "../validations/place.validation"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import { authMiddleware } from "../middleware/auth.middleware"

// Configure multer for image uploads
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  },
})

const router = Router()
const placeController = new PlaceController()

// Public routes (no authentication required)
router.get("/", validateQuery(placeValidation.getPlaces), placeController.getPlaces)
router.get("/:id", placeController.getPlaceById)
router.get(
  "/category/:categoryId",
  validateQuery(placeValidation.getPlacesByCategory),
  placeController.getPlacesByCategory,
)
router.get("/nearby", validateQuery(placeValidation.getNearbyPlaces), placeController.getNearbyPlaces)

// Anonymous voting routes
router.post("/vote/anonymous", validateRequest(placeValidation.anonymousVote), placeController.submitAnonymousVote)
router.get("/:id/votes", placeController.getPlaceVotes)
router.get("/:id/category-suggestions", placeController.getCategorySuggestions)

// Authenticated routes
router.use(authMiddleware)

// User voting (authenticated)
router.post("/vote", validateRequest(placeValidation.userVote), placeController.submitUserVote)
router.get("/user/votes", placeController.getUserVotes)

// Place management (Place owners and admins)
router.post("/", upload.single('image'), validateRequest(placeValidation.createPlace), placeController.createPlace)
router.put("/:id", validateRequest(placeValidation.updatePlace), placeController.updatePlace)
router.delete("/:id", placeController.deletePlace)

// Photo management
router.post("/:id/photos", validateRequest(placeValidation.uploadPhoto), placeController.uploadPhoto)
router.delete("/photos/:photoId", placeController.deletePhoto)

// Admin routes
router.get("/admin/all", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), placeController.getAllPlaces)
router.put("/:id/approve", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), placeController.approvePlace)
router.put("/:id/reject", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), placeController.rejectPlace)
router.get("/admin/pending", rbacMiddleware(["SUPER_ADMIN", "CITY_ADMIN"]), placeController.getPendingPlaces)

// Categories management
router.get("/categories/all", placeController.getCategories)
router.post(
  "/categories",
  rbacMiddleware(["SUPER_ADMIN"]),
  validateRequest(placeValidation.createCategory),
  placeController.createCategory,
)
router.put(
  "/categories/:id",
  rbacMiddleware(["SUPER_ADMIN"]),
  validateRequest(placeValidation.updateCategory),
  placeController.updateCategory,
)
router.delete(
  "/categories/:id",
  rbacMiddleware(["SUPER_ADMIN"]),
  placeController.deleteCategory,
)

export default router
