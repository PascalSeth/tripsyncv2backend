"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchController = void 0;
const search_service_1 = require("../services/search.service");
const logger_1 = __importDefault(require("../utils/logger"));
class SearchController {
    constructor() {
        this.searchService = new search_service_1.SearchService();
        this.search = async (req, res) => {
            try {
                const { q: query, latitude, longitude, category, priceMin, priceMax, rating, distance, isOpen, page = 1, limit = 20, } = req.query;
                if (!query) {
                    return res.status(400).json({
                        success: false,
                        message: "Search query is required",
                    });
                }
                if (!latitude || !longitude) {
                    return res.status(400).json({
                        success: false,
                        message: "User location is required",
                    });
                }
                const userLocation = {
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                };
                const filters = {};
                if (category)
                    filters.category = category;
                if (priceMin || priceMax) {
                    filters.priceRange = {
                        min: priceMin ? Number(priceMin) : 0,
                        max: priceMax ? Number(priceMax) : Number.MAX_SAFE_INTEGER,
                    };
                }
                if (rating)
                    filters.rating = Number(rating);
                if (distance)
                    filters.distance = Number(distance);
                if (isOpen !== undefined)
                    filters.isOpen = isOpen === "true";
                const results = await this.searchService.searchAll(query, userLocation, filters, Number(page), Number(limit));
                // Save search query for analytics
                if (req.user?.id) {
                    await this.searchService.saveSearchQuery(req.user.id, query, results.results.length);
                }
                res.json({
                    success: true,
                    message: "Search completed successfully",
                    data: results,
                });
            }
            catch (error) {
                logger_1.default.error("Search error:", error);
                res.status(500).json({
                    success: false,
                    message: "Search failed",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getPopularSearches = async (req, res) => {
            try {
                const popularSearches = await this.searchService.getPopularSearches();
                res.json({
                    success: true,
                    message: "Popular searches retrieved successfully",
                    data: popularSearches,
                });
            }
            catch (error) {
                logger_1.default.error("Get popular searches error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve popular searches",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
}
exports.SearchController = SearchController;
