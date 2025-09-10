import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import prisma from "../config/database"
import { PlaceService } from "../services/place.service"
import { LocationService } from "../services/location.service"
import { FileUploadService } from "../services/file-upload.service"
import { NotificationService } from "../services/notification.service"
import logger from "../utils/logger"

export class PlaceController {
  private placeService = new PlaceService()
  private locationService = new LocationService()
  private fileUploadService = new FileUploadService()
  private notificationService = new NotificationService()

  createPlace = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      const {
        name,
        description,
        categoryId,
        latitude,
        longitude,
        address,
        contactInfo,
        websiteUrl,
        openingHours,
        priceLevel,
        tags,
      } = req.body

      // Handle image file upload
      let imageUrl = null
      if (req.file) {
        try {
          imageUrl = await this.fileUploadService.uploadImage(
            req.file,
            `places/${Date.now()}`,
            {
              width: 800,
              height: 600,
            }
          )
        } catch (uploadError) {
          logger.error("Image upload error:", uploadError)
          // Continue without image rather than failing the entire request
        }
      }

      // Check if user can create places
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required to create places",
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      const canCreatePlace = ["SUPER_ADMIN", "CITY_ADMIN", "PLACE_OWNER"].includes(user?.role || "")

      if (!canCreatePlace) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions to create places",
        })
      }

      // Create location with geocoding
      let locationData: any = {
        latitude,
        longitude,
        address,
      }

      // Try to geocode the coordinates to get city and country
      try {
        const geocodedData = await this.locationService.reverseGeocode(latitude, longitude)
        if (geocodedData) {
          locationData.city = geocodedData.city
          locationData.state = geocodedData.state
          locationData.country = geocodedData.country
          locationData.postalCode = geocodedData.postalCode

          // Update address if we got a better formatted address
          if (geocodedData.formattedAddress && geocodedData.formattedAddress !== address) {
            locationData.address = geocodedData.formattedAddress
          }

          logger.info(`Geocoded location: ${geocodedData.city}, ${geocodedData.country}`)
        } else {
          // Fallback to defaults
          locationData.city = "Unknown"
          locationData.country = "Unknown"
          logger.warn(`Failed to geocode coordinates: ${latitude}, ${longitude}`)
        }
      } catch (geocodeError) {
        logger.error("Geocoding error:", geocodeError)
        // Fallback to defaults
        locationData.city = "Unknown"
        locationData.country = "Unknown"
      }

      const location = await prisma.location.create({
        data: locationData,
      })

      // Create place
      const place = await prisma.place.create({
        data: {
          name,
          description,
          categoryId,
          locationId: location.id,
          ownerId: user?.role === "PLACE_OWNER" ? userId : null,
          contactInfo,
          websiteUrl,
          openingHours,
          priceLevel: priceLevel as any,
          tags,
          imageUrl,
          isActive: true,
          isApproved: user?.role === "SUPER_ADMIN", // Auto-approve for super admin
        },
        include: {
          category: true,
          location: true,
        },
      })

      // Send notification for approval if not auto-approved
      if (!place.isApproved) {
        await this.notificationService.notifyAdmins({
          type: "PLACE_APPROVAL_REQUIRED",
          title: "New Place Requires Approval",
          body: `${name} has been submitted for approval`,
          data: { placeId: place.id },
        })
      }

      res.status(201).json({
        success: true,
        message: "Place created successfully",
        data: place,
      })
    } catch (error) {
      logger.error("Create place error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create place",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getPlaces = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        categoryId,
        priceLevel,
        latitude,
        longitude,
        radius = 10000,
        sortBy = "name",
      } = req.query

      const places = await this.placeService.getPlaces({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        categoryId: categoryId as string,
        priceLevel: priceLevel as string,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        radius: Number(radius),
        sortBy: sortBy as string,
        includeVotes: true,
      })

      res.json({
        success: true,
        message: "Places retrieved successfully",
        data: places,
      })
    } catch (error) {
      logger.error("Get places error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve places",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getPlaceById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const placeId = req.params.id

      const place = await this.placeService.getPlaceById(placeId, req.user?.id)

      if (!place) {
        return res.status(404).json({
          success: false,
          message: "Place not found",
        })
      }

      res.json({
        success: true,
        message: "Place retrieved successfully",
        data: place,
      })
    } catch (error) {
      logger.error("Get place by ID error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve place",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getPlacesByCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const categoryId = req.params.categoryId
      const { page = 1, limit = 20, latitude, longitude, radius = 10000 } = req.query

      const places = await this.placeService.getPlacesByCategory(categoryId, {
        page: Number(page),
        limit: Number(limit),
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        radius: Number(radius),
      })

      res.json({
        success: true,
        message: "Places retrieved successfully",
        data: places,
      })
    } catch (error) {
      logger.error("Get places by category error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve places",
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

      const places = await this.placeService.getNearbyPlaces({
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

  submitAnonymousVote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { placeId, username, gender, isLiked, suggestedCategoryId } = req.body

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

      // Check if place exists
      const place = await prisma.place.findUnique({
        where: { id: placeId },
      })

      if (!place) {
        return res.status(404).json({
          success: false,
          message: "Place not found",
        })
      }

      // Create or update survey
      let survey = await prisma.survey.findFirst({
        where: {
          anonymousUserId: anonymousUser.id,
          status: "IN_PROGRESS",
        },
      })

      if (!survey) {
        survey = await prisma.survey.create({
          data: {
            anonymousUserId: anonymousUser.id,
            status: "IN_PROGRESS",
          },
        })
      }

      // Check if user already voted for this place
      const existingVote = await prisma.placeVote.findFirst({
        where: {
          surveyId: survey.id,
          placeId,
          anonymousUserId: anonymousUser.id,
        },
      })

      if (existingVote) {
        return res.status(400).json({
          success: false,
          message: "You have already voted for this place",
        })
      }

      // Create vote
      const vote = await prisma.placeVote.create({
        data: {
          surveyId: survey.id,
          placeId,
          isLiked,
          anonymousUserId: anonymousUser.id,
        },
      })

      // Create category suggestion if provided
      if (suggestedCategoryId && suggestedCategoryId !== place.categoryId) {
        await prisma.placeCategorySuggestion.create({
          data: {
            placeId,
            suggestedCategoryId,
            anonymousUserId: anonymousUser.id,
            reason: "User suggestion",
          },
        })
      }

      res.status(201).json({
        success: true,
        message: "Vote submitted successfully",
        data: {
          vote,
          anonymousUserId: anonymousUser.id,
        },
      })
    } catch (error) {
      logger.error("Submit anonymous vote error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to submit vote",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  submitUserVote = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      const { placeId, isLiked, suggestedCategoryId } = req.body

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      // Check if place exists
      const place = await prisma.place.findUnique({
        where: { id: placeId },
      })

      if (!place) {
        return res.status(404).json({
          success: false,
          message: "Place not found",
        })
      }

      // Create or update survey
      let survey = await prisma.survey.findFirst({
        where: {
          userId,
          status: "IN_PROGRESS",
        },
      })

      if (!survey) {
        survey = await prisma.survey.create({
          data: {
            userId,
            status: "IN_PROGRESS",
          },
        })
      }

      // Check if user already voted for this place
      const existingVote = await prisma.placeVote.findFirst({
        where: {
          surveyId: survey.id,
          placeId,
          userId,
        },
      })

      if (existingVote) {
        return res.status(400).json({
          success: false,
          message: "You have already voted for this place",
        })
      }

      // Create vote
      const vote = await prisma.placeVote.create({
        data: {
          surveyId: survey.id,
          placeId,
          isLiked,
          userId,
        },
      })

      // Create category suggestion if provided
      if (suggestedCategoryId && suggestedCategoryId !== place.categoryId) {
        await prisma.placeCategorySuggestion.create({
          data: {
            placeId,
            suggestedCategoryId,
            userId,
            reason: "User suggestion",
          },
        })
      }

      res.status(201).json({
        success: true,
        message: "Vote submitted successfully",
        data: vote,
      })
    } catch (error) {
      logger.error("Submit user vote error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to submit vote",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getPlaceVotes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const placeId = req.params.id

      const votes = await this.placeService.getPlaceVotes(placeId)

      res.json({
        success: true,
        message: "Place votes retrieved successfully",
        data: votes,
      })
    } catch (error) {
      logger.error("Get place votes error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve place votes",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getCategorySuggestions = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const placeId = req.params.id

      const suggestions = await this.placeService.getCategorySuggestions(placeId)

      res.json({
        success: true,
        message: "Category suggestions retrieved successfully",
        data: suggestions,
      })
    } catch (error) {
      logger.error("Get category suggestions error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve category suggestions",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getUserVotes = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      const votes = await prisma.placeVote.findMany({
        where: { userId },
        include: {
          place: {
            include: {
              category: true,
              location: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })

      res.json({
        success: true,
        message: "User votes retrieved successfully",
        data: votes,
      })
    } catch (error) {
      logger.error("Get user votes error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user votes",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updatePlace = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const placeId = req.params.id
      const userId = req.user?.id
      const updateData = req.body

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      // Check if user can update this place
      const place = await prisma.place.findUnique({
        where: { id: placeId },
      })

      if (!place) {
        return res.status(404).json({
          success: false,
          message: "Place not found",
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      const canUpdate = ["SUPER_ADMIN", "CITY_ADMIN"].includes(user?.role || "") || place.ownerId === userId

      if (!canUpdate) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions to update this place",
        })
      }

      // Update place
      const updatedPlace = await prisma.place.update({
        where: { id: placeId },
        data: {
          ...updateData,
          isApproved: user?.role === "SUPER_ADMIN" ? true : place.isApproved,
        },
        include: {
          category: true,
          location: true,
        },
      })

      res.json({
        success: true,
        message: "Place updated successfully",
        data: updatedPlace,
      })
    } catch (error) {
      logger.error("Update place error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update place",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  deletePlace = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const placeId = req.params.id
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      // Check if user can delete this place
      const place = await prisma.place.findUnique({
        where: { id: placeId },
      })

      if (!place) {
        return res.status(404).json({
          success: false,
          message: "Place not found",
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      const canDelete = ["SUPER_ADMIN", "CITY_ADMIN"].includes(user?.role || "") || place.ownerId === userId

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions to delete this place",
        })
      }

      // Soft delete
      await prisma.place.update({
        where: { id: placeId },
        data: { isActive: false },
      })

      res.json({
        success: true,
        message: "Place deleted successfully",
      })
    } catch (error) {
      logger.error("Delete place error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to delete place",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  uploadPhoto = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const placeId = req.params.id
      const userId = req.user?.id
      const { caption } = req.body
      const file = req.file

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      if (!file) {
        return res.status(400).json({
          success: false,
          message: "Photo file is required",
        })
      }

      // Check if place exists
      const place = await prisma.place.findUnique({
        where: { id: placeId },
      })

      if (!place) {
        return res.status(404).json({
          success: false,
          message: "Place not found",
        })
      }

      // Upload photo
      const photoUrl = await this.fileUploadService.uploadImage(file, `places/${placeId}`, {
        width: 800,
        height: 600,
      })

      // Create photo record
      const photo = await prisma.placePhoto.create({
        data: {
          placeId,
          photoUrl,
          caption,
          uploadedBy: userId,
          isApproved: false,
        },
      })

      res.status(201).json({
        success: true,
        message: "Photo uploaded successfully",
        data: photo,
      })
    } catch (error) {
      logger.error("Upload photo error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to upload photo",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  deletePhoto = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const photoId = req.params.photoId
      const userId = req.user?.id

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      const photo = await prisma.placePhoto.findUnique({
        where: { id: photoId },
        include: { place: true },
      })

      if (!photo) {
        return res.status(404).json({
          success: false,
          message: "Photo not found",
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      const canDelete =
        ["SUPER_ADMIN", "CITY_ADMIN"].includes(user?.role || "") ||
        photo.uploadedBy === userId ||
        photo.place.ownerId === userId

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions to delete this photo",
        })
      }

      await prisma.placePhoto.delete({
        where: { id: photoId },
      })

      res.json({
        success: true,
        message: "Photo deleted successfully",
      })
    } catch (error) {
      logger.error("Delete photo error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to delete photo",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Admin functions
  getAllPlaces = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, status, categoryId, ownerId } = req.query

      const where: any = {}
      if (status) where.isApproved = status === "approved"
      if (categoryId) where.categoryId = categoryId
      if (ownerId) where.ownerId = ownerId

      const places = await prisma.place.findMany({
        where,
        include: {
          category: true,
          location: true,
          _count: {
            select: {
              placeVotes: true,
              placePhotos: true,
            },
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      })

      const total = await prisma.place.count({ where })

      res.json({
        success: true,
        message: "Places retrieved successfully",
        data: places,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get all places error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve places",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  approvePlace = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const placeId = req.params.id

      const place = await prisma.place.update({
        where: { id: placeId },
        data: { isApproved: true },
      })

      // Notify place owner
      if (place.ownerId) {
        await this.notificationService.notifyCustomer(place.ownerId, {
          type: "PLACE_APPROVED",
          title: "Place Approved",
          body: `Your place "${place.name}" has been approved and is now live`,
          data: { placeId: place.id },
          priority: "STANDARD",
        })
      }

      res.json({
        success: true,
        message: "Place approved successfully",
        data: place,
      })
    } catch (error) {
      logger.error("Approve place error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to approve place",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  rejectPlace = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const placeId = req.params.id
      const { reason } = req.body

      const place = await prisma.place.update({
        where: { id: placeId },
        data: {
          isApproved: false,
          isActive: false,
        },
      })

      // Notify place owner
      if (place.ownerId) {
        await this.notificationService.notifyCustomer(place.ownerId, {
          type: "PLACE_REJECTED",
          title: "Place Rejected",
          body: `Your place "${place.name}" has been rejected. Reason: ${reason}`,
          data: { placeId: place.id, reason },
          priority: "STANDARD",
        })
      }

      res.json({
        success: true,
        message: "Place rejected successfully",
        data: place,
      })
    } catch (error) {
      logger.error("Reject place error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to reject place",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getPendingPlaces = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query

      const places = await prisma.place.findMany({
        where: {
          isApproved: false,
          isActive: true,
        },
        include: {
          category: true,
          location: true,
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: "asc" },
      })

      const total = await prisma.place.count({
        where: {
          isApproved: false,
          isActive: true,
        },
      })

      res.json({
        success: true,
        message: "Pending places retrieved successfully",
        data: places,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get pending places error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve pending places",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Categories
  getCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const categories = await prisma.placeCategory.findMany({
        where: { isActive: true },
        include: {
          _count: {
            select: {
              places: {
                where: {
                  isActive: true,
                  isApproved: true,
                },
              },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      })

      res.json({
        success: true,
        message: "Categories retrieved successfully",
        data: categories,
      })
    } catch (error) {
      logger.error("Get categories error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve categories",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, icon, sortOrder } = req.body

      const category = await prisma.placeCategory.create({
        data: {
          name,
          description,
          icon,
          sortOrder: sortOrder || 0,
          isActive: true,
        },
      })

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      })
    } catch (error) {
      logger.error("Create category error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create category",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const categoryId = req.params.id
      const updateData = req.body

      const category = await prisma.placeCategory.update({
        where: { id: categoryId },
        data: updateData,
      })

      res.json({
        success: true,
        message: "Category updated successfully",
        data: category,
      })
    } catch (error) {
      logger.error("Update category error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update category",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
