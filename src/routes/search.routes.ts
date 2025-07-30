import { Router } from "express"
import { SearchController } from "../controllers/search.controller"
import { authMiddleware } from "../middleware/auth.middleware"

const router = Router()
const searchController = new SearchController()

// Search endpoint
router.get("/", authMiddleware, searchController.search)

// Get popular searches
router.get("/popular", searchController.getPopularSearches)

export default router
