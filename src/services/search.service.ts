import prisma from "../config/database"
import { LocationService } from "./location.service"
import logger from "../utils/logger"

interface SearchFilters {
  category?: string
  priceRange?: { min: number; max: number }
  rating?: number
  distance?: number
  isOpen?: boolean
  features?: string[]
}

interface SearchResult {
  id: string
  name: string
  type: "store" | "place" | "driver"
  description?: string
  rating: number
  distance: number
  isOpen: boolean
  imageUrl?: string
  priceRange?: string
}

export class SearchService {
  private locationService = new LocationService()

  async searchAll(
    query: string,
    userLocation: { latitude: number; longitude: number },
    filters: SearchFilters = {},
    page = 1,
    limit = 20,
  ): Promise<{
    results: SearchResult[]
    pagination: any
    suggestions: string[]
  }> {
    try {
      const skip = (page - 1) * limit

      // Search stores
      const stores = await this.searchStores(query, userLocation, filters, skip, limit)

      // Search places
      const places = await this.searchPlaces(query, userLocation, filters, skip, limit)

      // Combine and sort results by relevance
      const allResults = [...stores, ...places].sort((a, b) => {
        // Sort by rating first, then by distance
        if (a.rating !== b.rating) {
          return b.rating - a.rating
        }
        return a.distance - b.distance
      })

      // Generate search suggestions
      const suggestions = await this.generateSearchSuggestions(query)

      return {
        results: allResults.slice(0, limit),
        pagination: {
          page,
          limit,
          total: allResults.length,
          totalPages: Math.ceil(allResults.length / limit),
        },
        suggestions,
      }
    } catch (error) {
      logger.error("Search all error:", error)
      throw error
    }
  }

  private async searchStores(
    query: string,
    userLocation: { latitude: number; longitude: number },
    filters: SearchFilters,
    skip: number,
    limit: number,
  ): Promise<SearchResult[]> {
    try {
      const where: any = {
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      }

      if (filters.category) {
        where.type = filters.category
      }

      const stores = await prisma.store.findMany({
        where,
        include: {
          location: true,
          businessHours: {
            where: {
              dayOfWeek: new Date().getDay(),
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        skip,
        take: limit,
      })

      const results: SearchResult[] = []

      for (const store of stores) {
        if (!store.location) continue

        const distance = this.locationService.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          store.location.latitude,
          store.location.longitude,
        )

        // Apply distance filter
        if (filters.distance && distance > filters.distance * 1000) {
          continue
        }

        const isOpen = this.checkIfOpen(store.businessHours)

        // Apply open filter
        if (filters.isOpen !== undefined && filters.isOpen !== isOpen) {
          continue
        }

        results.push({
          id: store.id,
          name: store.name,
          type: "store",
          description: store.description || undefined, // Convert null to undefined
          rating: 4.5, // Default rating - would come from reviews
          distance: Math.round(distance),
          isOpen,
          imageUrl: undefined, // Would come from store images
          priceRange: "₦₦", // Would be calculated from products
        })
      }

      return results
    } catch (error) {
      logger.error("Search stores error:", error)
      return []
    }
  }

  private async searchPlaces(
    query: string,
    userLocation: { latitude: number; longitude: number },
    filters: SearchFilters,
    skip: number,
    limit: number,
  ): Promise<SearchResult[]> {
    try {
      const where: any = {
        isActive: true,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
        ],
      }

      if (filters.category) {
        where.category = filters.category
      }

      if (filters.rating) {
        where.rating = { gte: filters.rating }
      }

      const places = await prisma.place.findMany({
        where,
        include: {
          location: true,
        },
        skip,
        take: limit,
      })

      const results: SearchResult[] = []

      for (const place of places) {
        if (!place.location) continue

        const distance = this.locationService.calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          place.location.latitude,
          place.location.longitude,
        )

        // Apply distance filter
        if (filters.distance && distance > filters.distance * 1000) {
          continue
        }

        const isOpen = true // Default to open since we don't have business hours for places

        // Apply open filter
        if (filters.isOpen !== undefined && filters.isOpen !== isOpen) {
          continue
        }

        results.push({
          id: place.id,
          name: place.name,
          type: "place",
          description: place.description || undefined, // Convert null to undefined
          rating: place.rating || 0,
          distance: Math.round(distance),
          isOpen,
          imageUrl: place.imageUrl || undefined, // Convert null to undefined
          priceRange: "₦₦", // Default price range
        })
      }

      return results
    } catch (error) {
      logger.error("Search places error:", error)
      return []
    }
  }

  private checkIfOpen(businessHours: any[]): boolean {
    if (businessHours.length === 0) return true // Assume open if no hours specified

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes()

    for (const hours of businessHours) {
      if (hours.isClosed) return false

      const openTime = this.timeToMinutes(hours.openTime)
      const closeTime = this.timeToMinutes(hours.closeTime)

      if (currentTime >= openTime && currentTime <= closeTime) {
        return true
      }
    }

    return false
  }

  private timeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(":").map(Number)
    return hours * 60 + minutes
  }

  private async generateSearchSuggestions(query: string): Promise<string[]> {
    try {
      // Get popular search terms from stores and places
      const [storeNames, placeNames] = await Promise.all([
        prisma.store.findMany({
          where: {
            isActive: true,
            name: { contains: query, mode: "insensitive" },
          },
          select: { name: true },
          take: 5,
        }),
        prisma.place.findMany({
          where: {
            isActive: true,
            name: { contains: query, mode: "insensitive" },
          },
          select: { name: true },
          take: 5,
        }),
      ])

      const suggestions = [...storeNames.map((s) => s.name), ...placeNames.map((p) => p.name)]

      // Add some common search terms
      const commonTerms = ["restaurants", "hotels", "shopping", "gas stations", "hospitals", "banks"]
      const matchingCommonTerms = commonTerms.filter((term) => term.toLowerCase().includes(query.toLowerCase()))

      return [...new Set([...suggestions, ...matchingCommonTerms])].slice(0, 10)
    } catch (error) {
      logger.error("Generate search suggestions error:", error)
      return []
    }
  }

  async getPopularSearches(): Promise<string[]> {
    try {
      // This would typically come from search analytics
      // For now, return static popular searches
      return [
        "restaurants near me",
        "gas stations",
        "hotels",
        "shopping malls",
        "hospitals",
        "banks",
        "pharmacies",
        "supermarkets",
        "coffee shops",
        "fast food",
      ]
    } catch (error) {
      logger.error("Get popular searches error:", error)
      return []
    }
  }

  async saveSearchQuery(userId: string, query: string, resultsCount: number): Promise<void> {
    try {
      // Save search query for analytics (would need SearchQuery model)
      logger.info(`User ${userId} searched for "${query}" with ${resultsCount} results`)
    } catch (error) {
      logger.error("Save search query error:", error)
    }
  }
}
