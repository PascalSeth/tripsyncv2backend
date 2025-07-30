import { Router } from "express"
import { ServiceController } from "../controllers/service.controller"

const router = Router()
const serviceController = new ServiceController()

// Service type routes
router.get("/types", serviceController.getServiceTypes)
router.get("/types/:id", serviceController.getServiceTypeById)
router.get("/ride-types", serviceController.getRideTypes) 
// Driver/Provider routes
router.get("/drivers/nearby", serviceController.getNearbyDrivers)
router.get("/drivers/available", serviceController.getAvailableDrivers)
router.put("/drivers/availability", serviceController.updateDriverAvailability)
router.put("/drivers/location", serviceController.updateDriverLocation)

// Store routes
router.get("/stores/nearby", serviceController.getNearbyStores)
router.get("/stores/:id", serviceController.getStoreById)
router.get("/stores/:id/products", serviceController.getStoreProducts)

// Restaurant routes
router.get("/restaurants/nearby", serviceController.getNearbyRestaurants)
router.get("/restaurants/:id/menu", serviceController.getRestaurantMenu)

// Place recommendation routes
router.get("/places/recommendations", serviceController.getPlaceRecommendations)
router.get("/places/nearby", serviceController.getNearbyPlaces)
router.post("/places/survey", serviceController.submitPlaceSurvey)

// Service zones
router.get("/zones", serviceController.getServiceZones)
router.get("/zones/coverage", serviceController.checkServiceCoverage)

export default router
