import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import { SearchService } from "../services/search.service"
import logger from "../utils/logger"

export class SearchController {
  private searchService = new SearchService()

  search = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        q: query,
        latitude,
        longitude,
        category,
        priceMin,
        priceMax,
        rating,
        distance,
        isOpen,
        page = 1,
        limit = 20,
      } = req.query

      if (!query) {
        return res.status(400).json({
          success: false,
          message: "Search query is required",
        })
      }

      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          message: "User location is required",
        })
      }

      const userLocation = {
        latitude: Number(latitude),
        longitude: Number(longitude),
      }

      const filters: any = {}
      if (category) filters.category = category as string
      if (priceMin || priceMax) {
        filters.priceRange = {
          min: priceMin ? Number(priceMin) : 0,
          max: priceMax ? Number(priceMax) : Number.MAX_SAFE_INTEGER,
        }
      }
      if (rating) filters.rating = Number(rating)
      if (distance) filters.distance = Number(distance)
      if (isOpen !== undefined) filters.isOpen = isOpen === "true"

      const results = await this.searchService.searchAll(
        query as string,
        userLocation,
        filters,
        Number(page),
        Number(limit),
      )

      // Save search query for analytics
      if (req.user?.id) {
        await this.searchService.saveSearchQuery(req.user.id, query as string, results.results.length)
      }

      res.json({
        success: true,
        message: "Search completed successfully",
        data: results,
      })
    } catch (error) {
      logger.error("Search error:", error)
      res.status(500).json({
        success: false,
        message: "Search failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getPopularSearches = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const popularSearches = await this.searchService.getPopularSearches()

      res.json({
        success: true,
        message: "Popular searches retrieved successfully",
        data: popularSearches,
      })
    } catch (error) {
      logger.error("Get popular searches error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve popular searches",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
