"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeocodingService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../utils/logger"));
class GeocodingService {
    constructor() {
        this.GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
        this.GEOCODING_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
        this.PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";
        this.cache = new Map();
        this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
        this.geocodeCache = new Map();
        if (!this.GOOGLE_MAPS_API_KEY) {
            logger_1.default.warn("Google Maps API key not configured. Geocoding services will use fallback methods.");
        }
    }
    /**
     * Convert address to coordinates
     */
    async geocodeAddress(address) {
        try {
            // Check cache first
            const cacheKey = `geocode_${address.toLowerCase()}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            let result = null;
            if (this.GOOGLE_MAPS_API_KEY) {
                result = await this.googleGeocode(address);
            }
            else {
                result = await this.fallbackGeocode(address);
            }
            if (result) {
                this.setCache(cacheKey, result);
                await this.saveGeocodeResult(address, result);
            }
            return result;
        }
        catch (error) {
            logger_1.default.error("Geocode address error:", error);
            return null;
        }
    }
    /**
     * Convert coordinates to address
     */
    async reverseGeocode(latitude, longitude) {
        try {
            // Check cache first
            const cacheKey = `reverse_${latitude}_${longitude}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                return cached;
            }
            let result = null;
            if (this.GOOGLE_MAPS_API_KEY) {
                result = await this.googleReverseGeocode(latitude, longitude);
            }
            else {
                result = await this.fallbackReverseGeocode(latitude, longitude);
            }
            if (result) {
                this.setCache(cacheKey, result);
            }
            return result;
        }
        catch (error) {
            logger_1.default.error("Reverse geocode error:", error);
            return null;
        }
    }
    /**
     * Validate address format and completeness
     */
    async validateAddress(address) {
        try {
            const geocodeResult = await this.geocodeAddress(address);
            if (!geocodeResult) {
                return {
                    isValid: false,
                    confidence: 0,
                    issues: ["Address could not be found"],
                };
            }
            const issues = [];
            let confidence = 100;
            // Check for missing components
            const components = geocodeResult.addressComponents;
            if (!components.streetNumber) {
                issues.push("Street number missing");
                confidence -= 20;
            }
            if (!components.route) {
                issues.push("Street name missing");
                confidence -= 20;
            }
            if (!components.locality) {
                issues.push("City/locality missing");
                confidence -= 15;
            }
            if (!components.administrativeAreaLevel1) {
                issues.push("State/province missing");
                confidence -= 15;
            }
            if (!components.postalCode) {
                issues.push("Postal code missing");
                confidence -= 10;
            }
            // Get suggestions if confidence is low
            let suggestions = [];
            if (confidence < 80) {
                const addressSuggestions = await this.getAddressSuggestions(address);
                suggestions = addressSuggestions.slice(0, 3).map((s) => s.description);
            }
            return {
                isValid: confidence >= 60,
                confidence,
                suggestions: suggestions.length > 0 ? suggestions : undefined,
                issues: issues.length > 0 ? issues : undefined,
            };
        }
        catch (error) {
            logger_1.default.error("Validate address error:", error);
            return {
                isValid: false,
                confidence: 0,
                issues: ["Address validation failed"],
            };
        }
    }
    /**
     * Get address suggestions/autocomplete
     */
    async getAddressSuggestions(input, location) {
        try {
            if (!this.GOOGLE_MAPS_API_KEY) {
                return await this.fallbackAddressSuggestions(input);
            }
            const params = new URLSearchParams({
                input,
                key: this.GOOGLE_MAPS_API_KEY,
                types: "address",
                language: "en",
            });
            if (location) {
                params.append("location", `${location.lat},${location.lng}`);
                params.append("radius", "50000"); // 50km radius
            }
            const response = await axios_1.default.get(`${this.PLACES_BASE_URL}/autocomplete/json?${params}`);
            if (response.data.status !== "OK") {
                logger_1.default.error("Google Places API error:", response.data.status);
                return [];
            }
            return response.data.predictions.map((prediction) => ({
                description: prediction.description,
                placeId: prediction.place_id,
                types: prediction.types,
                structuredFormatting: {
                    mainText: prediction.structured_formatting.main_text,
                    secondaryText: prediction.structured_formatting.secondary_text,
                },
            }));
        }
        catch (error) {
            logger_1.default.error("Get address suggestions error:", error);
            return [];
        }
    }
    /**
     * Get place details by place ID
     */
    async getPlaceDetails(placeId) {
        try {
            if (!this.GOOGLE_MAPS_API_KEY) {
                return null;
            }
            const params = new URLSearchParams({
                place_id: placeId,
                key: this.GOOGLE_MAPS_API_KEY,
                fields: "geometry,formatted_address,address_components,place_id,types",
            });
            const response = await axios_1.default.get(`${this.PLACES_BASE_URL}/details/json?${params}`);
            if (response.data.status !== "OK") {
                logger_1.default.error("Google Places Details API error:", response.data.status);
                return null;
            }
            const place = response.data.result;
            return this.parseGoogleGeocodeResult(place);
        }
        catch (error) {
            logger_1.default.error("Get place details error:", error);
            return null;
        }
    }
    /**
     * Batch geocode multiple addresses
     */
    async batchGeocode(addresses) {
        try {
            const results = await Promise.allSettled(addresses.map((address) => this.geocodeAddress(address)));
            return addresses.map((address, index) => ({
                address,
                result: results[index].status === "fulfilled" ? results[index].value : null,
            }));
        }
        catch (error) {
            logger_1.default.error("Batch geocode error:", error);
            return addresses.map((address) => ({ address, result: null }));
        }
    }
    /**
     * Find addresses within a bounding box
     */
    async findAddressesInBounds(bounds) {
        try {
            // This would typically query a spatial database
            // For now, we'll return cached results within bounds
            const cachedResults = [];
            for (const [key, cached] of this.cache.entries()) {
                if (key.startsWith("geocode_") && this.isWithinBounds(cached.data, bounds)) {
                    cachedResults.push(cached.data);
                }
            }
            return cachedResults;
        }
        catch (error) {
            logger_1.default.error("Find addresses in bounds error:", error);
            return [];
        }
    }
    async googleGeocode(address) {
        try {
            const params = new URLSearchParams({
                address,
                key: this.GOOGLE_MAPS_API_KEY,
                language: "en",
            });
            const response = await axios_1.default.get(`${this.GEOCODING_BASE_URL}?${params}`);
            if (response.data.status !== "OK" || response.data.results.length === 0) {
                return null;
            }
            return this.parseGoogleGeocodeResult(response.data.results[0]);
        }
        catch (error) {
            logger_1.default.error("Google geocode error:", error);
            return null;
        }
    }
    async googleReverseGeocode(latitude, longitude) {
        try {
            const params = new URLSearchParams({
                latlng: `${latitude},${longitude}`,
                key: this.GOOGLE_MAPS_API_KEY,
                language: "en",
            });
            const response = await axios_1.default.get(`${this.GEOCODING_BASE_URL}?${params}`);
            if (response.data.status !== "OK" || response.data.results.length === 0) {
                return null;
            }
            const result = response.data.results[0];
            return {
                formattedAddress: result.formatted_address,
                addressComponents: this.parseAddressComponents(result.address_components),
                placeId: result.place_id,
                types: result.types,
            };
        }
        catch (error) {
            logger_1.default.error("Google reverse geocode error:", error);
            return null;
        }
    }
    parseGoogleGeocodeResult(result) {
        return {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            formattedAddress: result.formatted_address,
            addressComponents: this.parseAddressComponents(result.address_components),
            placeId: result.place_id,
            types: result.types,
        };
    }
    parseAddressComponents(components) {
        const parsed = {};
        components.forEach((component) => {
            const types = component.types;
            if (types.includes("street_number")) {
                parsed.streetNumber = component.long_name;
            }
            else if (types.includes("route")) {
                parsed.route = component.long_name;
            }
            else if (types.includes("locality")) {
                parsed.locality = component.long_name;
            }
            else if (types.includes("administrative_area_level_1")) {
                parsed.administrativeAreaLevel1 = component.long_name;
            }
            else if (types.includes("administrative_area_level_2")) {
                parsed.administrativeAreaLevel2 = component.long_name;
            }
            else if (types.includes("country")) {
                parsed.country = component.long_name;
            }
            else if (types.includes("postal_code")) {
                parsed.postalCode = component.long_name;
            }
        });
        return parsed;
    }
    async fallbackGeocode(address) {
        try {
            const cached = this.geocodeCache.get(address.toLowerCase());
            if (cached) {
                return cached;
            }
            return null;
        }
        catch (error) {
            logger_1.default.error("Fallback geocode error:", error);
            return null;
        }
    }
    async fallbackReverseGeocode(latitude, longitude) {
        try {
            // Simple fallback - return coordinates as address
            return {
                formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                addressComponents: {},
            };
        }
        catch (error) {
            logger_1.default.error("Fallback reverse geocode error:", error);
            return null;
        }
    }
    async fallbackAddressSuggestions(input) {
        try {
            // Search in our cached addresses - using memory cache since geocodeCache doesn't exist in schema
            const suggestions = [];
            return suggestions.map((suggestion) => ({
                description: suggestion.formattedAddress,
                placeId: suggestion.placeId || `fallback_${suggestion.id}`,
                types: ["establishment"],
                structuredFormatting: {
                    mainText: suggestion.formattedAddress.split(",")[0],
                    secondaryText: suggestion.formattedAddress.split(",").slice(1).join(","),
                },
            }));
        }
        catch (error) {
            logger_1.default.error("Fallback address suggestions error:", error);
            return [];
        }
    }
    async saveGeocodeResult(address, result) {
        try {
            this.geocodeCache.set(address.toLowerCase(), result);
        }
        catch (error) {
            logger_1.default.error("Save geocode result error:", error);
        }
    }
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }
    setCache(key, data) {
        this.cache.set(key, { data, timestamp: Date.now() });
    }
    isWithinBounds(result, bounds) {
        return (result.latitude >= bounds.southwest.lat &&
            result.latitude <= bounds.northeast.lat &&
            result.longitude >= bounds.southwest.lng &&
            result.longitude <= bounds.northeast.lng);
    }
}
exports.GeocodingService = GeocodingService;
