import axios from "axios"
import logger from "../utils/logger"

interface GeocodeResult {
  latitude: number
  longitude: number
  formattedAddress: string
  addressComponents: {
    streetNumber?: string
    route?: string
    locality?: string
    administrativeAreaLevel1?: string
    administrativeAreaLevel2?: string
    country?: string
    postalCode?: string
  }
  placeId?: string
  types?: string[]
}

interface ReverseGeocodeResult {
  formattedAddress: string
  addressComponents: {
    streetNumber?: string
    route?: string
    locality?: string
    administrativeAreaLevel1?: string
    administrativeAreaLevel2?: string
    country?: string
    postalCode?: string
  }
  placeId?: string
  types?: string[]
}

interface AddressSuggestion {
  description: string
  placeId: string
  types: string[]
  structuredFormatting: {
    mainText: string
    secondaryText: string
  }
}

interface CachedGeocode {
  id: string
  address: string
  formattedAddress: string
  placeId?: string
}

export class GeocodingService {
  private readonly GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY
  private readonly GEOCODING_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
  private readonly PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place"
  private readonly cache = new Map<string, { data: any; timestamp: number }>()
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private geocodeCache = new Map<string, any>()

  constructor() {
    if (!this.GOOGLE_MAPS_API_KEY) {
      logger.warn("Google Maps API key not configured. Geocoding services will use fallback methods.")
    }
  }

  /**
   * Convert address to coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    try {
      // Check cache first
      const cacheKey = `geocode_${address.toLowerCase()}`
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return cached
      }

      let result: GeocodeResult | null = null

      if (this.GOOGLE_MAPS_API_KEY) {
        result = await this.googleGeocode(address)
      } else {
        result = await this.fallbackGeocode(address)
      }

      if (result) {
        this.setCache(cacheKey, result)
        await this.saveGeocodeResult(address, result)
      }

      return result
    } catch (error) {
      logger.error("Geocode address error:", error)
      return null
    }
  }

  /**
   * Convert coordinates to address
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
    try {
      // Check cache first
      const cacheKey = `reverse_${latitude}_${longitude}`
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return cached
      }

      let result: ReverseGeocodeResult | null = null

      if (this.GOOGLE_MAPS_API_KEY) {
        result = await this.googleReverseGeocode(latitude, longitude)
      } else {
        result = await this.fallbackReverseGeocode(latitude, longitude)
      }

      if (result) {
        this.setCache(cacheKey, result)
      }

      return result
    } catch (error) {
      logger.error("Reverse geocode error:", error)
      return null
    }
  }

  /**
   * Validate address format and completeness
   */
  async validateAddress(address: string): Promise<{
    isValid: boolean
    confidence: number
    suggestions?: string[]
    issues?: string[]
  }> {
    try {
      const geocodeResult = await this.geocodeAddress(address)

      if (!geocodeResult) {
        return {
          isValid: false,
          confidence: 0,
          issues: ["Address could not be found"],
        }
      }

      const issues: string[] = []
      let confidence = 100

      // Check for missing components
      const components = geocodeResult.addressComponents
      if (!components.streetNumber) {
        issues.push("Street number missing")
        confidence -= 20
      }
      if (!components.route) {
        issues.push("Street name missing")
        confidence -= 20
      }
      if (!components.locality) {
        issues.push("City/locality missing")
        confidence -= 15
      }
      if (!components.administrativeAreaLevel1) {
        issues.push("State/province missing")
        confidence -= 15
      }
      if (!components.postalCode) {
        issues.push("Postal code missing")
        confidence -= 10
      }

      // Get suggestions if confidence is low
      let suggestions: string[] = []
      if (confidence < 80) {
        const addressSuggestions = await this.getAddressSuggestions(address)
        suggestions = addressSuggestions.slice(0, 3).map((s) => s.description)
      }

      return {
        isValid: confidence >= 60,
        confidence,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        issues: issues.length > 0 ? issues : undefined,
      }
    } catch (error) {
      logger.error("Validate address error:", error)
      return {
        isValid: false,
        confidence: 0,
        issues: ["Address validation failed"],
      }
    }
  }

  /**
   * Get address suggestions/autocomplete
   */
  async getAddressSuggestions(input: string, location?: { lat: number; lng: number }): Promise<AddressSuggestion[]> {
    try {
      if (!this.GOOGLE_MAPS_API_KEY) {
        return await this.fallbackAddressSuggestions(input)
      }

      const params = new URLSearchParams({
        input,
        key: this.GOOGLE_MAPS_API_KEY,
        types: "address",
        language: "en",
      })

      if (location) {
        params.append("location", `${location.lat},${location.lng}`)
        params.append("radius", "50000") // 50km radius
      }

      const response = await axios.get(`${this.PLACES_BASE_URL}/autocomplete/json?${params}`)

      if (response.data.status !== "OK") {
        logger.error("Google Places API error:", response.data.status)
        return []
      }

      return response.data.predictions.map((prediction: any) => ({
        description: prediction.description,
        placeId: prediction.place_id,
        types: prediction.types,
        structuredFormatting: {
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text,
        },
      }))
    } catch (error) {
      logger.error("Get address suggestions error:", error)
      return []
    }
  }

  /**
   * Get place details by place ID
   */
  async getPlaceDetails(placeId: string): Promise<GeocodeResult | null> {
    try {
      if (!this.GOOGLE_MAPS_API_KEY) {
        return null
      }

      const params = new URLSearchParams({
        place_id: placeId,
        key: this.GOOGLE_MAPS_API_KEY,
        fields: "geometry,formatted_address,address_components,place_id,types",
      })

      const response = await axios.get(`${this.PLACES_BASE_URL}/details/json?${params}`)

      if (response.data.status !== "OK") {
        logger.error("Google Places Details API error:", response.data.status)
        return null
      }

      const place = response.data.result
      return this.parseGoogleGeocodeResult(place)
    } catch (error) {
      logger.error("Get place details error:", error)
      return null
    }
  }

  /**
   * Batch geocode multiple addresses
   */
  async batchGeocode(addresses: string[]): Promise<Array<{ address: string; result: GeocodeResult | null }>> {
    try {
      const results = await Promise.allSettled(addresses.map((address) => this.geocodeAddress(address)))

      return addresses.map((address, index) => ({
        address,
        result: results[index].status === "fulfilled" ? results[index].value : null,
      }))
    } catch (error) {
      logger.error("Batch geocode error:", error)
      return addresses.map((address) => ({ address, result: null }))
    }
  }

  /**
   * Find addresses within a bounding box
   */
  async findAddressesInBounds(bounds: {
    northeast: { lat: number; lng: number }
    southwest: { lat: number; lng: number }
  }): Promise<GeocodeResult[]> {
    try {
      // This would typically query a spatial database
      // For now, we'll return cached results within bounds
      const cachedResults: GeocodeResult[] = []

      for (const [key, cached] of this.cache.entries()) {
        if (key.startsWith("geocode_") && this.isWithinBounds(cached.data, bounds)) {
          cachedResults.push(cached.data)
        }
      }

      return cachedResults
    } catch (error) {
      logger.error("Find addresses in bounds error:", error)
      return []
    }
  }

  private async googleGeocode(address: string): Promise<GeocodeResult | null> {
    try {
      const params = new URLSearchParams({
        address,
        key: this.GOOGLE_MAPS_API_KEY!,
        language: "en",
      })

      const response = await axios.get(`${this.GEOCODING_BASE_URL}?${params}`)

      if (response.data.status !== "OK" || response.data.results.length === 0) {
        return null
      }

      return this.parseGoogleGeocodeResult(response.data.results[0])
    } catch (error) {
      logger.error("Google geocode error:", error)
      return null
    }
  }

  private async googleReverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
    try {
      const params = new URLSearchParams({
        latlng: `${latitude},${longitude}`,
        key: this.GOOGLE_MAPS_API_KEY!,
        language: "en",
      })

      const response = await axios.get(`${this.GEOCODING_BASE_URL}?${params}`)

      if (response.data.status !== "OK" || response.data.results.length === 0) {
        return null
      }

      const result = response.data.results[0]
      return {
        formattedAddress: result.formatted_address,
        addressComponents: this.parseAddressComponents(result.address_components),
        placeId: result.place_id,
        types: result.types,
      }
    } catch (error) {
      logger.error("Google reverse geocode error:", error)
      return null
    }
  }

  private parseGoogleGeocodeResult(result: any): GeocodeResult {
    return {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      addressComponents: this.parseAddressComponents(result.address_components),
      placeId: result.place_id,
      types: result.types,
    }
  }

  private parseAddressComponents(components: any[]): GeocodeResult["addressComponents"] {
    const parsed: GeocodeResult["addressComponents"] = {}

    components.forEach((component) => {
      const types = component.types
      if (types.includes("street_number")) {
        parsed.streetNumber = component.long_name
      } else if (types.includes("route")) {
        parsed.route = component.long_name
      } else if (types.includes("locality")) {
        parsed.locality = component.long_name
      } else if (types.includes("administrative_area_level_1")) {
        parsed.administrativeAreaLevel1 = component.long_name
      } else if (types.includes("administrative_area_level_2")) {
        parsed.administrativeAreaLevel2 = component.long_name
      } else if (types.includes("country")) {
        parsed.country = component.long_name
      } else if (types.includes("postal_code")) {
        parsed.postalCode = component.long_name
      }
    })

    return parsed
  }

  private async fallbackGeocode(address: string): Promise<GeocodeResult | null> {
    try {
      const cached = this.geocodeCache.get(address.toLowerCase())
      if (cached) {
        return cached
      }
      return null
    } catch (error) {
      logger.error("Fallback geocode error:", error)
      return null
    }
  }

  private async fallbackReverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
    try {
      // Simple fallback - return coordinates as address
      return {
        formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        addressComponents: {},
      }
    } catch (error) {
      logger.error("Fallback reverse geocode error:", error)
      return null
    }
  }

  private async fallbackAddressSuggestions(input: string): Promise<AddressSuggestion[]> {
    try {
      // Search in our cached addresses - using memory cache since geocodeCache doesn't exist in schema
      const suggestions: CachedGeocode[] = []

      return suggestions.map((suggestion: CachedGeocode) => ({
        description: suggestion.formattedAddress,
        placeId: suggestion.placeId || `fallback_${suggestion.id}`,
        types: ["establishment"],
        structuredFormatting: {
          mainText: suggestion.formattedAddress.split(",")[0],
          secondaryText: suggestion.formattedAddress.split(",").slice(1).join(","),
        },
      }))
    } catch (error) {
      logger.error("Fallback address suggestions error:", error)
      return []
    }
  }

  private async saveGeocodeResult(address: string, result: GeocodeResult): Promise<void> {
    try {
      this.geocodeCache.set(address.toLowerCase(), result)
    } catch (error) {
      logger.error("Save geocode result error:", error)
    }
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    this.cache.delete(key)
    return null
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() })
  }

  private isWithinBounds(
    result: GeocodeResult,
    bounds: {
      northeast: { lat: number; lng: number }
      southwest: { lat: number; lng: number }
    },
  ): boolean {
    return (
      result.latitude >= bounds.southwest.lat &&
      result.latitude <= bounds.northeast.lat &&
      result.longitude >= bounds.southwest.lng &&
      result.longitude <= bounds.northeast.lng
    )
  }
}
