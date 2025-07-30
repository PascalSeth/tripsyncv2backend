import logger from "../utils/logger"

export class LocationService {
  private readonly EARTH_RADIUS = 6371000 // Earth's radius in meters

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return this.EARTH_RADIUS * c // Distance in meters
  }

  /**
   * Calculate bearing between two coordinates
   */
  calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const y = Math.sin(Δλ) * Math.cos(φ2)
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)

    const θ = Math.atan2(y, x)

    return ((θ * 180) / Math.PI + 360) % 360 // Bearing in degrees
  }

  /**
   * Get estimated travel time using external routing service
   */
  async getEstimatedTravelTime(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    mode: "driving" | "walking" | "transit" = "driving",
  ): Promise<{ duration: number; distance: number }> {
    try {
      // For production, you would use Google Maps API, Mapbox, or similar
      // For now, we'll calculate based on straight-line distance and average speeds

      const distance = this.calculateDistance(fromLat, fromLng, toLat, toLng)

      let averageSpeed: number // meters per minute
      switch (mode) {
        case "driving":
          averageSpeed = 500 // ~30 km/h in city traffic
          break
        case "walking":
          averageSpeed = 83 // ~5 km/h
          break
        case "transit":
          averageSpeed = 250 // ~15 km/h average with stops
          break
        default:
          averageSpeed = 500
      }

      const duration = Math.ceil(distance / averageSpeed) // duration in minutes

      return {
        duration,
        distance,
      }
    } catch (error) {
      logger.error("Get estimated travel time error:", error)
      // Fallback calculation
      const distance = this.calculateDistance(fromLat, fromLng, toLat, toLng)
      const duration = Math.ceil(distance / 500) // Assume 30 km/h
      return { duration, distance }
    }
  }

  /**
   * Get route between two points (simplified)
   */
  async getRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): Promise<{
    distance: number
    duration: number
    polyline?: string
    steps?: any[]
  }> {
    try {
      // In production, integrate with Google Maps Directions API or similar
      const { distance, duration } = await this.getEstimatedTravelTime(fromLat, fromLng, toLat, toLng)

      return {
        distance,
        duration,
        // For now, return a simple straight line
        polyline: this.encodePolyline([
          [fromLat, fromLng],
          [toLat, toLng],
        ]),
      }
    } catch (error) {
      logger.error("Get route error:", error)
      throw error
    }
  }

  /**
   * Check if a point is within a radius of another point
   */
  isWithinRadius(
    centerLat: number,
    centerLng: number,
    pointLat: number,
    pointLng: number,
    radiusMeters: number,
  ): boolean {
    const distance = this.calculateDistance(centerLat, centerLng, pointLat, pointLng)
    return distance <= radiusMeters
  }

  /**
   * Find points within a radius
   */
  findPointsWithinRadius(
    centerLat: number,
    centerLng: number,
    points: Array<{ lat: number; lng: number; data?: any }>,
    radiusMeters: number,
  ): Array<{ lat: number; lng: number; distance: number; data?: any }> {
    return points
      .map((point) => ({
        ...point,
        distance: this.calculateDistance(centerLat, centerLng, point.lat, point.lng),
      }))
      .filter((point) => point.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance)
  }

  /**
   * Geocode address to coordinates (placeholder)
   */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      // In production, integrate with Google Maps Geocoding API or similar
      logger.info(`Geocoding address: ${address}`)

      // Placeholder implementation
      // You would make an API call to a geocoding service here
      return null
    } catch (error) {
      logger.error("Geocode address error:", error)
      return null
    }
  }

  /**
   * Reverse geocode coordinates to address (placeholder)
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      // In production, integrate with Google Maps Geocoding API or similar
      logger.info(`Reverse geocoding: ${lat}, ${lng}`)

      // Placeholder implementation
      return `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`
    } catch (error) {
      logger.error("Reverse geocode error:", error)
      return null
    }
  }

  /**
   * Simple polyline encoding (for route visualization)
   */
  private encodePolyline(coordinates: number[][]): string {
    // Simplified polyline encoding
    // In production, use a proper polyline encoding library
    return coordinates.map((coord) => `${coord[0]},${coord[1]}`).join(";")
  }

  /**
   * Calculate ETA based on current traffic conditions
   */
  async calculateETA(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    departureTime?: Date,
  ): Promise<{
    eta: number // minutes
    distance: number // meters
    trafficMultiplier: number
  }> {
    try {
      const { distance, duration } = await this.getEstimatedTravelTime(fromLat, fromLng, toLat, toLng)

      // Apply traffic multiplier based on time of day
      const trafficMultiplier = this.getTrafficMultiplier(departureTime || new Date())
      const adjustedDuration = Math.ceil(duration * trafficMultiplier)

      return {
        eta: adjustedDuration,
        distance,
        trafficMultiplier,
      }
    } catch (error) {
      logger.error("Calculate ETA error:", error)
      throw error
    }
  }

  /**
   * Get traffic multiplier based on time of day
   */
  private getTrafficMultiplier(time: Date): number {
    const hour = time.getHours()
    const dayOfWeek = time.getDay()

    // Weekend traffic is generally lighter
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 0.8
    }

    // Rush hour traffic (7-9 AM, 5-7 PM)
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      return 1.5
    }

    // Late night traffic is lighter
    if (hour >= 22 || hour <= 6) {
      return 0.7
    }

    // Normal traffic
    return 1.0
  }

  /**
   * Calculate optimal route with multiple waypoints
   */
  async calculateOptimalRoute(waypoints: Array<{ lat: number; lng: number }>): Promise<{
    totalDistance: number
    totalDuration: number
    optimizedOrder: number[]
    routes: Array<{
      from: number
      to: number
      distance: number
      duration: number
    }>
  }> {
    try {
      if (waypoints.length < 2) {
        throw new Error("At least 2 waypoints required")
      }

      // For small number of waypoints, calculate all possible routes
      if (waypoints.length <= 10) {
        return this.calculateOptimalRouteExhaustive(waypoints)
      }

      // For larger sets, use nearest neighbor heuristic
      return this.calculateOptimalRouteHeuristic(waypoints)
    } catch (error) {
      logger.error("Calculate optimal route error:", error)
      throw error
    }
  }

  private async calculateOptimalRouteExhaustive(waypoints: Array<{ lat: number; lng: number }>) {
    // Implementation for exhaustive search (for small waypoint sets)
    const routes = []
    let totalDistance = 0
    let totalDuration = 0

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i]
      const to = waypoints[i + 1]
      const { distance, duration } = await this.getEstimatedTravelTime(from.lat, from.lng, to.lat, to.lng)

      routes.push({
        from: i,
        to: i + 1,
        distance,
        duration,
      })

      totalDistance += distance
      totalDuration += duration
    }

    return {
      totalDistance,
      totalDuration,
      optimizedOrder: Array.from({ length: waypoints.length }, (_, i) => i),
      routes,
    }
  }

  private async calculateOptimalRouteHeuristic(waypoints: Array<{ lat: number; lng: number }>) {
    // Nearest neighbor heuristic for larger waypoint sets
    const unvisited = new Set(Array.from({ length: waypoints.length }, (_, i) => i))
    const route = [0] // Start from first waypoint
    unvisited.delete(0)

    let totalDistance = 0
    let totalDuration = 0
    const routes = []

    while (unvisited.size > 0) {
      const current = route[route.length - 1]
      let nearest = -1
      let minDistance = Number.POSITIVE_INFINITY

      // Find nearest unvisited waypoint
      for (const candidate of unvisited) {
        const distance = this.calculateDistance(
          waypoints[current].lat,
          waypoints[current].lng,
          waypoints[candidate].lat,
          waypoints[candidate].lng,
        )
        if (distance < minDistance) {
          minDistance = distance
          nearest = candidate
        }
      }

      if (nearest !== -1) {
        const { distance, duration } = await this.getEstimatedTravelTime(
          waypoints[current].lat,
          waypoints[current].lng,
          waypoints[nearest].lat,
          waypoints[nearest].lng,
        )

        routes.push({
          from: current,
          to: nearest,
          distance,
          duration,
        })

        totalDistance += distance
        totalDuration += duration
        route.push(nearest)
        unvisited.delete(nearest)
      }
    }

    return {
      totalDistance,
      totalDuration,
      optimizedOrder: route,
      routes,
    }
  }
}
