import prisma from "../config/database"
import { LocationService } from "./location.service"
import { CacheService } from "./cache.service"
import { AnalyticsService } from "./analytics.service"
import logger from "../utils/logger"

interface SurgeZoneData {
  id: string
  name: string
  centerLatitude: number
  centerLongitude: number
  radius: number
  currentSurge: number
  demandLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  supplyLevel: "LOW" | "MEDIUM" | "HIGH"
  activeBookings: number
  availableDrivers: number
  historicalMultiplier: number
  weatherImpact: number
  eventImpact: number
}

interface DemandPrediction {
  zoneId: string
  predictedDemand: number
  confidence: number
  factors: {
    historical: number
    weather: number
    events: number
    timeOfDay: number
    dayOfWeek: number
  }
  recommendedSurge: number
}

interface PriceOptimization {
  currentPrice: number
  optimizedPrice: number
  expectedDemand: number
  expectedRevenue: number
  competitorPricing: number
  elasticity: number
}

export class SurgePricingService {
  private locationService = new LocationService()
  private cacheService = new CacheService()
  private analyticsService = new AnalyticsService()

  private readonly SURGE_UPDATE_INTERVAL = 60000 // 1 minute
  private readonly MAX_SURGE_MULTIPLIER = 5.0
  private readonly MIN_SURGE_MULTIPLIER = 0.8
  private readonly DEMAND_THRESHOLD_HIGH = 10
  private readonly DEMAND_THRESHOLD_CRITICAL = 20
  private readonly SUPPLY_THRESHOLD_LOW = 5

  constructor() {
    this.startSurgeUpdater()
  }

  /**
   * Calculate dynamic surge pricing for a location
   */
  async calculateSurgePricing(
    latitude: number,
    longitude: number,
    serviceType = "RIDE",
    scheduledAt?: Date,
  ): Promise<{
    surgeMultiplier: number
    zoneName: string
    demandLevel: string
    supplyLevel: string
    factors: Record<string, number>
    estimatedWaitTime: number
  }> {
    try {
      const cacheKey = `surge:${latitude}:${longitude}:${serviceType}`
      const cached = await this.cacheService.get(cacheKey)

      if (cached) {
        return JSON.parse(cached)
      }

      // Find applicable surge zone
      const surgeZone = await this.findSurgeZone(latitude, longitude)

      if (!surgeZone) {
        // Create dynamic zone if none exists
        const dynamicSurge = await this.calculateDynamicSurge(latitude, longitude, serviceType, scheduledAt)
        await this.cacheService.set(cacheKey, JSON.stringify(dynamicSurge), { ttl: 300 }) // 5 minutes
        return dynamicSurge
      }

      // Get current demand and supply
      const [demandData, supplyData] = await Promise.all([
        this.getCurrentDemand(surgeZone.id, serviceType),
        this.getCurrentSupply(surgeZone.id, serviceType),
      ])

      // Calculate surge factors
      const factors = await this.calculateSurgeFactors(surgeZone, demandData, supplyData, scheduledAt)

      // Apply machine learning prediction if available
      const mlPrediction = await this.getMachineLearningPrediction(surgeZone.id, factors)

      let surgeMultiplier = this.calculateBaseSurge(factors)

      if (mlPrediction) {
        surgeMultiplier = (surgeMultiplier + mlPrediction.recommendedSurge) / 2
      }

      // Apply bounds
      surgeMultiplier = Math.max(this.MIN_SURGE_MULTIPLIER, Math.min(this.MAX_SURGE_MULTIPLIER, surgeMultiplier))

      // Determine levels
      const demandLevel = this.getDemandLevel(demandData.activeBookings, demandData.pendingBookings)
      const supplyLevel = this.getSupplyLevel(supplyData.availableDrivers, supplyData.totalDrivers)

      // Estimate wait time
      const estimatedWaitTime = this.calculateEstimatedWaitTime(demandData, supplyData, surgeMultiplier)

      const result = {
        surgeMultiplier,
        zoneName: surgeZone.name,
        demandLevel,
        supplyLevel,
        factors,
        estimatedWaitTime,
      }

      // Cache result
      await this.cacheService.set(cacheKey, JSON.stringify(result), { ttl: 300 })

      // Update surge zone
      await this.updateSurgeZone(surgeZone.id, surgeMultiplier, demandLevel, supplyLevel)

      return result
    } catch (error) {
      logger.error("Calculate surge pricing error:", error)
      return {
        surgeMultiplier: 1.0,
        zoneName: "Default",
        demandLevel: "MEDIUM",
        supplyLevel: "MEDIUM",
        factors: {},
        estimatedWaitTime: 5,
      }
    }
  }

  /**
   * Predict demand for the next few hours
   */
  async predictDemand(zoneId: string, hoursAhead = 4): Promise<DemandPrediction[]> {
    try {
      const predictions: DemandPrediction[] = []
      const currentTime = new Date()

      for (let i = 1; i <= hoursAhead; i++) {
        const targetTime = new Date(currentTime.getTime() + i * 60 * 60 * 1000)

        // Get historical data for same time period
        const historicalData = await this.getHistoricalDemand(zoneId, targetTime)

        // Get weather forecast impact
        const weatherImpact = await this.getWeatherImpact(zoneId, targetTime)

        // Get scheduled events impact
        const eventImpact = await this.getEventImpact(zoneId, targetTime)

        // Calculate time-based factors
        const timeFactors = this.getTimeBasedFactors(targetTime)

        // Combine factors
        const factors = {
          historical: historicalData.averageDemand,
          weather: weatherImpact,
          events: eventImpact,
          timeOfDay: timeFactors.timeOfDay,
          dayOfWeek: timeFactors.dayOfWeek,
        }

        // Calculate predicted demand
        const baseDemand = historicalData.averageDemand
        const weatherMultiplier = 1 + weatherImpact / 100
        const eventMultiplier = 1 + eventImpact / 100
        const timeMultiplier = timeFactors.timeOfDay * timeFactors.dayOfWeek

        const predictedDemand = Math.round(baseDemand * weatherMultiplier * eventMultiplier * timeMultiplier)

        // Calculate confidence based on data quality
        const confidence = this.calculatePredictionConfidence(historicalData, weatherImpact, eventImpact)

        // Recommend surge multiplier
        const recommendedSurge = this.calculateRecommendedSurge(predictedDemand, historicalData.averageSupply)

        predictions.push({
          zoneId,
          predictedDemand,
          confidence,
          factors,
          recommendedSurge,
        })
      }

      return predictions
    } catch (error) {
      logger.error("Predict demand error:", error)
      return []
    }
  }

  /**
   * Optimize pricing for maximum revenue
   */
  async optimizePricing(
    zoneId: string,
    currentPrice: number,
    demandData: any,
    supplyData: any,
  ): Promise<PriceOptimization> {
    try {
      // Get price elasticity data
      const elasticity = await this.getPriceElasticity(zoneId)

      // Get competitor pricing
      const competitorPricing = await this.getCompetitorPricing(zoneId)

      // Calculate optimal price using elasticity model
      const demandSupplyRatio = demandData.activeBookings / Math.max(supplyData.availableDrivers, 1)

      // Base optimization on revenue maximization
      const priceRange = this.generatePriceRange(currentPrice, 0.5, 3.0, 0.1)
      let bestPrice = currentPrice
      let maxRevenue = 0

      for (const testPrice of priceRange) {
        const priceMultiplier = testPrice / currentPrice
        const expectedDemand = demandData.activeBookings * Math.pow(priceMultiplier, elasticity)
        const expectedRevenue = testPrice * expectedDemand

        if (expectedRevenue > maxRevenue) {
          maxRevenue = expectedRevenue
          bestPrice = testPrice
        }
      }

      // Consider competitor pricing
      const competitorAdjustment = this.calculateCompetitorAdjustment(bestPrice, competitorPricing)
      const optimizedPrice = bestPrice * competitorAdjustment

      // Calculate expected metrics
      const priceMultiplier = optimizedPrice / currentPrice
      const expectedDemand = demandData.activeBookings * Math.pow(priceMultiplier, elasticity)
      const expectedRevenue = optimizedPrice * expectedDemand

      return {
        currentPrice,
        optimizedPrice: Math.round(optimizedPrice * 100) / 100,
        expectedDemand: Math.round(expectedDemand),
        expectedRevenue: Math.round(expectedRevenue * 100) / 100,
        competitorPricing,
        elasticity,
      }
    } catch (error) {
      logger.error("Optimize pricing error:", error)
      return {
        currentPrice,
        optimizedPrice: currentPrice,
        expectedDemand: demandData.activeBookings,
        expectedRevenue: currentPrice * demandData.activeBookings,
        competitorPricing: currentPrice,
        elasticity: -1.0,
      }
    }
  }

  /**
   * Analyze market conditions
   */
  async analyzeMarket(dateRange?: { from: Date; to: Date }): Promise<{
    totalRevenue: number
    averageSurge: number
    peakHours: Array<{ hour: number; averageSurge: number }>
    topSurgeZones: Array<{ zoneName: string; averageSurge: number; revenue: number }>
    demandTrends: Array<{ date: string; demand: number; supply: number; surge: number }>
    priceElasticity: number
    marketShare: number
  }> {
    try {
      const where: any = {}
      if (dateRange) {
        where.createdAt = {
          gte: dateRange.from,
          lte: dateRange.to,
        }
      }

      // Get revenue data
      const revenueData = await prisma.booking.aggregate({
        where: { ...where, status: "COMPLETED" },
        _sum: { finalPrice: true },
        _avg: { surgePricing: true },
      })

      // Get peak hours analysis
      const bookings = await prisma.booking.findMany({
        where,
        select: {
          createdAt: true,
          surgePricing: true,
          finalPrice: true,
          pickupLatitude: true,
          pickupLongitude: true,
        },
      })

      const hourlyData = new Map<number, { surgeSum: number; count: number }>()
      const zoneData = new Map<string, { surgeSum: number; revenueSum: number; count: number }>()
      const dailyTrends: Array<{ date: string; demand: number; supply: number; surge: number }> = []

      bookings.forEach((booking) => {
        const hour = booking.createdAt.getHours()
        const hourData = hourlyData.get(hour) || { surgeSum: 0, count: 0 }
        hourData.surgeSum += booking.surgePricing
        hourData.count += 1
        hourlyData.set(hour, hourData)
      })

      // Calculate peak hours
      const peakHours = Array.from(hourlyData.entries())
        .map(([hour, data]) => ({
          hour,
          averageSurge: data.surgeSum / data.count,
        }))
        .sort((a, b) => b.averageSurge - a.averageSurge)
        .slice(0, 6)

      // Get surge zones data
      const surgeZones = await prisma.surgeZone.findMany({
        where: { isActive: true },
      })

      for (const zone of surgeZones) {
        const zoneBookings = bookings.filter((booking) => {
          if (!booking.pickupLatitude || !booking.pickupLongitude) return false
          const distance = this.locationService.calculateDistance(
            zone.centerLatitude,
            zone.centerLongitude,
            booking.pickupLatitude,
            booking.pickupLongitude,
          )
          return distance <= zone.radius
        })

        if (zoneBookings.length > 0) {
          const surgeSum = zoneBookings.reduce((sum, b) => sum + b.surgePricing, 0)
          const revenueSum = zoneBookings.reduce((sum, b) => sum + (b.finalPrice || 0), 0)

          zoneData.set(zone.name, {
            surgeSum,
            revenueSum,
            count: zoneBookings.length,
          })
        }
      }

      const topSurgeZones = Array.from(zoneData.entries())
        .map(([zoneName, data]) => ({
          zoneName,
          averageSurge: data.surgeSum / data.count,
          revenue: data.revenueSum,
        }))
        .sort((a, b) => b.averageSurge - a.averageSurge)
        .slice(0, 10)

      // Calculate price elasticity (simplified)
      const priceElasticity = await this.calculateMarketElasticity(bookings)

      // Estimate market share (simplified)
      const marketShare = await this.estimateMarketShare(revenueData._sum.finalPrice || 0)

      return {
        totalRevenue: revenueData._sum.finalPrice || 0,
        averageSurge: revenueData._avg.surgePricing || 1.0,
        peakHours,
        topSurgeZones,
        demandTrends: dailyTrends,
        priceElasticity,
        marketShare,
      }
    } catch (error) {
      logger.error("Analyze market error:", error)
      throw error
    }
  }

  private async findSurgeZone(latitude: number, longitude: number): Promise<SurgeZoneData | null> {
    try {
      const surgeZones = await prisma.surgeZone.findMany({
        where: { isActive: true },
      })

      for (const zone of surgeZones) {
        const distance = this.locationService.calculateDistance(
          zone.centerLatitude,
          zone.centerLongitude,
          latitude,
          longitude,
        )

        if (distance <= zone.radius) {
          return {
            id: zone.id,
            name: zone.name,
            centerLatitude: zone.centerLatitude,
            centerLongitude: zone.centerLongitude,
            radius: zone.radius,
            currentSurge: zone.currentSurge,
            demandLevel: "MEDIUM",
            supplyLevel: "MEDIUM",
            activeBookings: 0,
            availableDrivers: 0,
            historicalMultiplier: 1.0,
            weatherImpact: 0,
            eventImpact: 0,
          }
        }
      }

      return null
    } catch (error) {
      logger.error("Find surge zone error:", error)
      return null
    }
  }

  private async calculateDynamicSurge(
    latitude: number,
    longitude: number,
    serviceType: string,
    scheduledAt?: Date,
  ): Promise<any> {
    try {
      const currentTime = scheduledAt || new Date()
      const hour = currentTime.getHours()
      const dayOfWeek = currentTime.getDay()

      // Get nearby demand and supply
      const [demandCount, supplyCount] = await Promise.all([
        this.getNearbyDemand(latitude, longitude, 5000), // 5km radius
        this.getNearbySupply(latitude, longitude, 5000),
      ])

      // Calculate base surge
      let surgeMultiplier = 1.0

      // Demand/supply ratio
      if (supplyCount > 0) {
        const ratio = demandCount / supplyCount
        if (ratio > 2) surgeMultiplier += 0.8
        else if (ratio > 1.5) surgeMultiplier += 0.5
        else if (ratio > 1) surgeMultiplier += 0.3
      } else if (demandCount > 0) {
        surgeMultiplier += 1.5
      }

      // Time-based surge
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        surgeMultiplier += 0.4 // Rush hour
      }
      if (hour >= 22 || hour <= 6) {
        surgeMultiplier += 0.6 // Late night
      }

      // Weekend surge
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        surgeMultiplier += 0.3
      }

      // Apply bounds
      surgeMultiplier = Math.max(this.MIN_SURGE_MULTIPLIER, Math.min(this.MAX_SURGE_MULTIPLIER, surgeMultiplier))

      return {
        surgeMultiplier,
        zoneName: "Dynamic Zone",
        demandLevel: this.getDemandLevel(demandCount, 0),
        supplyLevel: this.getSupplyLevel(supplyCount, supplyCount + 10),
        factors: {
          demandSupplyRatio: supplyCount > 0 ? demandCount / supplyCount : demandCount,
          timeOfDay: hour,
          dayOfWeek,
          nearbyDemand: demandCount,
          nearbySupply: supplyCount,
        },
        estimatedWaitTime: this.calculateEstimatedWaitTime(
          { activeBookings: demandCount, pendingBookings: 0 },
          { availableDrivers: supplyCount, totalDrivers: supplyCount + 10 },
          surgeMultiplier,
        ),
      }
    } catch (error) {
      logger.error("Calculate dynamic surge error:", error)
      return {
        surgeMultiplier: 1.0,
        zoneName: "Default",
        demandLevel: "MEDIUM",
        supplyLevel: "MEDIUM",
        factors: {},
        estimatedWaitTime: 5,
      }
    }
  }

  private async getCurrentDemand(
    zoneId: string,
    serviceType: string,
  ): Promise<{
    activeBookings: number
    pendingBookings: number
    averageWaitTime: number
  }> {
    try {
      const [activeBookings, pendingBookings] = await Promise.all([
        prisma.booking.count({
          where: {
            status: { in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"] },
            serviceType: { name: serviceType },
          },
        }),
        prisma.booking.count({
          where: {
            status: "PENDING",
            serviceType: { name: serviceType },
          },
        }),
      ])

      // Calculate average wait time from recent completed bookings
      const recentBookings = await prisma.booking.findMany({
        where: {
          status: "COMPLETED",
          serviceType: { name: serviceType },
          completedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
        },
        select: {
          requestedAt: true,
          acceptedAt: true,
        },
      })

      const waitTimes = recentBookings
        .filter((b) => b.acceptedAt)
        .map((b) => b.acceptedAt!.getTime() - b.requestedAt.getTime())

      const averageWaitTime =
        waitTimes.length > 0
          ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length / 1000 / 60 // minutes
          : 5

      return {
        activeBookings,
        pendingBookings,
        averageWaitTime,
      }
    } catch (error) {
      logger.error("Get current demand error:", error)
      return { activeBookings: 0, pendingBookings: 0, averageWaitTime: 5 }
    }
  }

  private async getCurrentSupply(
    zoneId: string,
    serviceType: string,
  ): Promise<{
    availableDrivers: number
    totalDrivers: number
    averageRating: number
  }> {
    try {
      const [availableDrivers, totalDrivers, ratingData] = await Promise.all([
        prisma.driverProfile.count({
          where: {
            isAvailable: true,
            isOnline: true,
            isVerified: true,
          },
        }),
        prisma.driverProfile.count({
          where: {
            isVerified: true,
          },
        }),
        prisma.driverProfile.aggregate({
          where: {
            isVerified: true,
          },
          _avg: { rating: true },
        }),
      ])

      return {
        availableDrivers,
        totalDrivers,
        averageRating: ratingData._avg.rating || 5.0,
      }
    } catch (error) {
      logger.error("Get current supply error:", error)
      return { availableDrivers: 0, totalDrivers: 0, averageRating: 5.0 }
    }
  }

  private async calculateSurgeFactors(
    zone: SurgeZoneData,
    demandData: any,
    supplyData: any,
    scheduledAt?: Date,
  ): Promise<Record<string, number>> {
    const currentTime = scheduledAt || new Date()
    const hour = currentTime.getHours()
    const dayOfWeek = currentTime.getDay()

    return {
      demandSupplyRatio:
        supplyData.availableDrivers > 0
          ? demandData.activeBookings / supplyData.availableDrivers
          : demandData.activeBookings,
      timeOfDay: this.getTimeOfDayMultiplier(hour),
      dayOfWeek: this.getDayOfWeekMultiplier(dayOfWeek),
      weatherImpact: await this.getWeatherImpact(zone.id, currentTime),
      eventImpact: await this.getEventImpact(zone.id, currentTime),
      historicalTrend: zone.historicalMultiplier,
      averageWaitTime: demandData.averageWaitTime / 10, // Normalize to 0-1 scale
    }
  }

  private calculateBaseSurge(factors: Record<string, number>): number {
    let surge = 1.0

    // Demand/supply ratio impact (most important factor)
    const ratio = factors.demandSupplyRatio || 0
    if (ratio > 3) surge += 1.5
    else if (ratio > 2) surge += 1.0
    else if (ratio > 1.5) surge += 0.7
    else if (ratio > 1) surge += 0.4
    else if (ratio > 0.5) surge += 0.2

    // Time-based factors
    surge *= factors.timeOfDay || 1.0
    surge *= factors.dayOfWeek || 1.0

    // External factors
    surge += (factors.weatherImpact || 0) / 100
    surge += (factors.eventImpact || 0) / 100

    // Historical trend
    surge *= factors.historicalTrend || 1.0

    // Wait time impact
    const waitTimeImpact = Math.min((factors.averageWaitTime || 0.5) * 0.5, 0.8)
    surge += waitTimeImpact

    return surge
  }

  private getTimeOfDayMultiplier(hour: number): number {
    // Peak hours: 7-9 AM, 5-7 PM
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 1.4
    }
    // Late night: 10 PM - 6 AM
    if (hour >= 22 || hour <= 6) {
      return 1.6
    }
    // Regular hours
    return 1.0
  }

  private getDayOfWeekMultiplier(dayOfWeek: number): number {
    // Weekend (Friday night, Saturday, Sunday)
    if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
      return 1.3
    }
    // Weekdays
    return 1.0
  }

  private async getWeatherImpact(zoneId: string, time: Date): Promise<number> {
    // Simplified weather impact - in production, integrate with weather API
    const hour = time.getHours()
    const month = time.getMonth()

    let impact = 0

    // Rainy season impact (example for Nigeria)
    if (month >= 3 && month <= 10) {
      impact += 20 // 20% increase during rainy season
    }

    // Rush hour weather impact
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      impact += 15
    }

    return impact
  }

  private async getEventImpact(zoneId: string, time: Date): Promise<number> {
    // Check for scheduled events that might impact demand
    // This would integrate with events calendar in production
    const dayOfWeek = time.getDay()
    const hour = time.getHours()

    let impact = 0

    // Weekend events
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      if (hour >= 20 && hour <= 23) {
        impact += 30 // Nightlife events
      }
    }

    // Business events during weekdays
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (hour >= 8 && hour <= 17) {
        impact += 10 // Business hours
      }
    }

    return impact
  }

  private getDemandLevel(activeBookings: number, pendingBookings: number): string {
    const totalDemand = activeBookings + pendingBookings

    if (totalDemand >= this.DEMAND_THRESHOLD_CRITICAL) return "CRITICAL"
    if (totalDemand >= this.DEMAND_THRESHOLD_HIGH) return "HIGH"
    if (totalDemand >= 5) return "MEDIUM"
    return "LOW"
  }

  private getSupplyLevel(availableDrivers: number, totalDrivers: number): string {
    const supplyRatio = totalDrivers > 0 ? availableDrivers / totalDrivers : 0

    if (availableDrivers <= this.SUPPLY_THRESHOLD_LOW || supplyRatio < 0.2) return "LOW"
    if (supplyRatio < 0.5) return "MEDIUM"
    return "HIGH"
  }

  private calculateEstimatedWaitTime(demandData: any, supplyData: any, surgeMultiplier: number): number {
    const baseWaitTime = 5 // 5 minutes base
    const demandSupplyRatio =
      supplyData.availableDrivers > 0
        ? demandData.activeBookings / supplyData.availableDrivers
        : demandData.activeBookings

    let waitTime = baseWaitTime

    // Adjust based on demand/supply ratio
    if (demandSupplyRatio > 2) waitTime += 10
    else if (demandSupplyRatio > 1.5) waitTime += 7
    else if (demandSupplyRatio > 1) waitTime += 4
    else if (demandSupplyRatio < 0.5) waitTime -= 2

    // Surge pricing reduces wait time (higher prices attract more drivers)
    if (surgeMultiplier > 1.5) waitTime *= 0.8
    else if (surgeMultiplier > 1.2) waitTime *= 0.9

    return Math.max(1, Math.round(waitTime))
  }

  private async getNearbyDemand(latitude: number, longitude: number, radius: number): Promise<number> {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ["PENDING", "DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"] },
        pickupLatitude: { not: null },
        pickupLongitude: { not: null },
      },
      select: {
        pickupLatitude: true,
        pickupLongitude: true,
      },
    })

    return bookings.filter((booking) => {
      if (!booking.pickupLatitude || !booking.pickupLongitude) return false
      const distance = this.locationService.calculateDistance(
        latitude,
        longitude,
        booking.pickupLatitude,
        booking.pickupLongitude,
      )
      return distance <= radius
    }).length
  }

  private async getNearbySupply(latitude: number, longitude: number, radius: number): Promise<number> {
    const drivers = await prisma.driverProfile.findMany({
      where: {
        isAvailable: true,
        isOnline: true,
        currentLatitude: { not: null },
        currentLongitude: { not: null },
      },
      select: {
        currentLatitude: true,
        currentLongitude: true,
      },
    })

    return drivers.filter((driver) => {
      if (!driver.currentLatitude || !driver.currentLongitude) return false
      const distance = this.locationService.calculateDistance(
        latitude,
        longitude,
        driver.currentLatitude,
        driver.currentLongitude,
      )
      return distance <= radius
    }).length
  }

  private async updateSurgeZone(
    zoneId: string,
    surgeMultiplier: number,
    demandLevel: string,
    supplyLevel: string,
  ): Promise<void> {
    try {
      await prisma.surgeZone.update({
        where: { id: zoneId },
        data: {
          currentSurge: surgeMultiplier,
          updatedAt: new Date(),
        },
      })

      // Log surge update for analytics
      await this.analyticsService.trackEvent({
        userId: "system",
        eventType: "SURGE_UPDATE",
        eventData: {
          zoneId,
          surgeMultiplier,
          demandLevel,
          supplyLevel,
        },
        timestamp: new Date(),
      })
    } catch (error) {
      logger.error("Update surge zone error:", error)
    }
  }

  private async getMachineLearningPrediction(
    zoneId: string,
    factors: Record<string, number>,
  ): Promise<DemandPrediction | null> {
    // Placeholder for ML prediction integration
    // In production, this would call your ML service
    return null
  }

  private async getHistoricalDemand(
    zoneId: string,
    targetTime: Date,
  ): Promise<{
    averageDemand: number
    averageSupply: number
    confidence: number
  }> {
    // Get historical data for same hour and day of week
    const hour = targetTime.getHours()
    const dayOfWeek = targetTime.getDay()

    // This is simplified - in production, you'd have more sophisticated historical analysis
    return {
      averageDemand: 10,
      averageSupply: 8,
      confidence: 0.7,
    }
  }

  private getTimeBasedFactors(time: Date): { timeOfDay: number; dayOfWeek: number } {
    return {
      timeOfDay: this.getTimeOfDayMultiplier(time.getHours()),
      dayOfWeek: this.getDayOfWeekMultiplier(time.getDay()),
    }
  }

  private calculatePredictionConfidence(historicalData: any, weatherImpact: number, eventImpact: number): number {
    // Simplified confidence calculation
    let confidence = 0.5

    if (historicalData.confidence > 0.8) confidence += 0.3
    else if (historicalData.confidence > 0.6) confidence += 0.2
    else if (historicalData.confidence > 0.4) confidence += 0.1

    if (Math.abs(weatherImpact) < 10) confidence += 0.1
    if (Math.abs(eventImpact) < 20) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  private calculateRecommendedSurge(predictedDemand: number, averageSupply: number): number {
    const ratio = averageSupply > 0 ? predictedDemand / averageSupply : predictedDemand

    let surge = 1.0
    if (ratio > 2.5) surge = 2.5
    else if (ratio > 2) surge = 2.0
    else if (ratio > 1.5) surge = 1.7
    else if (ratio > 1.2) surge = 1.4
    else if (ratio > 1) surge = 1.2
    else if (ratio < 0.8) surge = 0.9

    return Math.max(this.MIN_SURGE_MULTIPLIER, Math.min(this.MAX_SURGE_MULTIPLIER, surge))
  }

  private async getPriceElasticity(zoneId: string): Promise<number> {
    // Simplified price elasticity calculation
    // In production, this would use historical price/demand data
    return -1.2 // Typical elasticity for ride-sharing
  }

  private async getCompetitorPricing(zoneId: string): Promise<number> {
    // Placeholder for competitor pricing data
    // In production, this would integrate with competitor monitoring
    return 50 // Base price in GHS
  }

  private generatePriceRange(basePrice: number, minMultiplier: number, maxMultiplier: number, step: number): number[] {
    const prices: number[] = []
    for (let multiplier = minMultiplier; multiplier <= maxMultiplier; multiplier += step) {
      prices.push(basePrice * multiplier)
    }
    return prices
  }

  private calculateCompetitorAdjustment(ourPrice: number, competitorPrice: number): number {
    const ratio = ourPrice / competitorPrice

    // Stay competitive but don't undercut too much
    if (ratio > 1.2) return 0.95 // Reduce price slightly if we're too expensive
    if (ratio < 0.8) return 1.05 // Increase price slightly if we're too cheap
    return 1.0 // Keep current price
  }

  private async calculateMarketElasticity(bookings: any[]): Promise<number> {
    // Simplified market elasticity calculation
    // In production, this would use regression analysis on historical data
    return -1.0
  }

  private async estimateMarketShare(ourRevenue: number): Promise<number> {
    // Simplified market share estimation
    // In production, this would use market research data
    const estimatedMarketSize = ourRevenue * 5 // Assume we have 20% market share
    return (ourRevenue / estimatedMarketSize) * 100
  }

  private startSurgeUpdater(): void {
    setInterval(async () => {
      try {
        // Update all active surge zones
        const activeZones = await prisma.surgeZone.findMany({
          where: { isActive: true },
        })

        for (const zone of activeZones) {
          await this.calculateSurgePricing(zone.centerLatitude, zone.centerLongitude, "RIDE")
        }
      } catch (error) {
        logger.error("Surge updater error:", error)
      }
    }, this.SURGE_UPDATE_INTERVAL)
  }
}
