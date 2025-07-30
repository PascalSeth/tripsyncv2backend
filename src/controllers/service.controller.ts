import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { PlaceService } from "../services/place.service"
import prisma from "../config/database"
import logger from "../utils/logger"

export class ServiceController {
  getPlaceRecommendations = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { latitude, longitude, radius = 5000, limit = 10, categoryId } = req.query

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
        })
      }

      const placeService = new PlaceService()
      const places = await placeService.getNearbyPlaces({
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: Number(radius),
        limit: Number(limit),
        categoryId: categoryId as string,
      })

      res.json({
        success: true,
        message: "Place recommendations retrieved successfully",
        data: places,
      })
    } catch (error) {
      logger.error("Get place recommendations error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve place recommendations",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  submitPlaceSurvey = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { votes, username, gender } = req.body
      const userId = req.user?.id

      const surveyData: any = {}

      if (userId) {
        // Authenticated user
        surveyData.userId = userId
      } else {
        // Anonymous user
        if (!username || !gender) {
          return res.status(400).json({
            success: false,
            message: "Username and gender are required for anonymous surveys",
          })
        }

        // Create or get anonymous user
        const sessionId = `anon_${Date.now()}_${Math.random()}`
        let anonymousUser = await prisma.anonymousUser.findUnique({
          where: { sessionId },
        })

        if (!anonymousUser) {
          anonymousUser = await prisma.anonymousUser.create({
            data: {
              name: username,
              gender: gender as any,
              sessionId,
            },
          })
        }

        surveyData.anonymousUserId = anonymousUser.id
      }

      // Create survey
      const survey = await prisma.survey.create({
        data: {
          ...surveyData,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      })

      // Create votes
      const votePromises = votes.map((vote: any) =>
        prisma.placeVote.create({
          data: {
            surveyId: survey.id,
            placeId: vote.placeId,
            isLiked: vote.isLiked,
            userId: surveyData.userId,
            anonymousUserId: surveyData.anonymousUserId,
          },
        }),
      )

      await Promise.all(votePromises)

      res.status(201).json({
        success: true,
        message: "Survey submitted successfully",
        data: { surveyId: survey.id },
      })
    } catch (error) {
      logger.error("Submit place survey error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to submit survey",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getServiceTypes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const serviceTypes = await prisma.serviceType.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      })

      res.json({
        success: true,
        message: "Service types retrieved successfully",
        data: serviceTypes,
      })
    } catch (error) {
      logger.error("Get service types error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve service types",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getServiceTypeById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params

      const serviceType = await prisma.serviceType.findUnique({
        where: { id },
      })

      if (!serviceType) {
        return res.status(404).json({
          success: false,
          message: "Service type not found",
        })
      }

      res.json({
        success: true,
        message: "Service type retrieved successfully",
        data: serviceType,
      })
    } catch (error) {
      logger.error("Get service type by ID error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve service type",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getNearbyDrivers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { latitude, longitude, radius = 10000, serviceType } = req.query

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
        })
      }

      // This would need to be implemented based on your driver matching logic
      res.json({
        success: true,
        message: "Nearby drivers retrieved successfully",
        data: [],
      })
    } catch (error) {
      logger.error("Get nearby drivers error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve nearby drivers",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getAvailableDrivers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const drivers = await prisma.driverProfile.findMany({
        where: {
          isAvailable: true,
          isOnline: true,
          isVerified: true,
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
            },
          },
          vehicle: true,
        },
      })

      res.json({
        success: true,
        message: "Available drivers retrieved successfully",
        data: drivers,
      })
    } catch (error) {
      logger.error("Get available drivers error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve available drivers",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateDriverAvailability = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { isAvailable, isOnline } = req.body

      await prisma.driverProfile.updateMany({
        where: { userId },
        data: {
          isAvailable,
          isOnline,
        },
      })

      res.json({
        success: true,
        message: "Driver availability updated successfully",
      })
    } catch (error) {
      logger.error("Update driver availability error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update driver availability",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateDriverLocation = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { latitude, longitude, heading } = req.body

      await prisma.driverProfile.updateMany({
        where: { userId },
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          heading,
        },
      })

      res.json({
        success: true,
        message: "Driver location updated successfully",
      })
    } catch (error) {
      logger.error("Update driver location error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update driver location",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getNearbyStores = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { latitude, longitude, radius = 10000 } = req.query

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
        })
      }

      const stores = await prisma.store.findMany({
        where: {
          isActive: true,
        },
        include: {
          location: true,
          owner: {
            select: {
              id: true,
              // name: true,
            },
          },
        },
      })

      res.json({
        success: true,
        message: "Nearby stores retrieved successfully",
        data: stores,
      })
    } catch (error) {
      logger.error("Get nearby stores error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve nearby stores",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getStoreById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params

      const store = await prisma.store.findUnique({
        where: { id },
        include: {
          location: true,
          owner: {
            select: {
              id: true,
              // name: true,
            },
          },
          products: true,
        },
      })

      if (!store) {
        return res.status(404).json({
          success: false,
          message: "Store not found",
        })
      }

      res.json({
        success: true,
        message: "Store retrieved successfully",
        data: store,
      })
    } catch (error) {
      logger.error("Get store by ID error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve store",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getStoreProducts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params

      const products = await prisma.product.findMany({
        where: {
          storeId: id,
        },
        orderBy: { name: "asc" },
      })

      res.json({
        success: true,
        message: "Store products retrieved successfully",
        data: products,
      })
    } catch (error) {
      logger.error("Get store products error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve store products",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getNearbyRestaurants = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { latitude, longitude, radius = 10000 } = req.query

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
        })
      }

      // This would need to be implemented based on your restaurant schema
      res.json({
        success: true,
        message: "Nearby restaurants retrieved successfully",
        data: [],
      })
    } catch (error) {
      logger.error("Get nearby restaurants error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve restaurant menu",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getRestaurantMenu = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params

      // This would need to be implemented based on your restaurant/menu schema
      res.json({
        success: true,
        message: "Restaurant menu retrieved successfully",
        data: [],
      })
    } catch (error) {
      logger.error("Get restaurant menu error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve restaurant menu",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getNearbyPlaces = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { latitude, longitude, radius = 5000, limit = 20, categoryId } = req.query

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
        })
      }

      const placeService = new PlaceService()
      const places = await placeService.getNearbyPlaces({
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius: Number(radius),
        limit: Number(limit),
        categoryId: categoryId as string,
      })

      res.json({
        success: true,
        message: "Nearby places retrieved successfully",
        data: places,
      })
    } catch (error) {
      logger.error("Get nearby places error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve nearby places",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getServiceZones = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const zones = await prisma.serviceZone.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      })

      res.json({
        success: true,
        message: "Service zones retrieved successfully",
        data: zones,
      })
    } catch (error) {
      logger.error("Get service zones error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve service zones",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  checkServiceCoverage = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { latitude, longitude } = req.query

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "Latitude and longitude are required",
        })
      }

      // This would need to implement actual coverage checking logic
      res.json({
        success: true,
        message: "Service coverage checked successfully",
        data: {
          covered: true,
          zones: [],
        },
      })
    } catch (error) {
      logger.error("Check service coverage error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to check service coverage",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getRideTypes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rideTypes = [
        { name: "Economy", type: "ECONOMY", description: "Affordable rides for everyday travel." },
        { name: "Comfort", type: "COMFORT", description: "Spacious and comfortable vehicles." },
        { name: "Premium", type: "PREMIUM", description: "Luxury vehicles for a premium experience." },

      ]

      res.json({
        success: true,
        message: "Ride types retrieved successfully",
        data: rideTypes,
      })
    } catch (error) {
      logger.error("Get ride types error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve ride types",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
