"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaceService = void 0;
const database_1 = __importDefault(require("../config/database"));
const location_service_1 = require("./location.service");
const logger_1 = __importDefault(require("../utils/logger"));
class PlaceService {
    constructor() {
        this.locationService = new location_service_1.LocationService();
    }
    async getPlaces(params) {
        try {
            const { page, limit, search, categoryId, priceLevel, latitude, longitude, radius = 10000, sortBy = "name", includeVotes = false, } = params;
            const skip = (page - 1) * limit;
            const where = {
                isActive: true,
                isApproved: true,
            };
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ];
            }
            if (categoryId) {
                where.categoryId = categoryId;
            }
            if (priceLevel) {
                where.priceLevel = priceLevel;
            }
            let orderBy = { name: "asc" };
            if (sortBy === "rating") {
                orderBy = { createdAt: "desc" };
            }
            else if (sortBy === "newest") {
                orderBy = { createdAt: "desc" };
            }
            const [places, total] = await Promise.all([
                database_1.default.place.findMany({
                    where,
                    include: {
                        location: true,
                        category: true,
                        placePhotos: {
                            take: 3,
                            where: { isApproved: true },
                        },
                        ...(includeVotes && {
                            placeVotes: {
                                select: {
                                    isLiked: true,
                                },
                            },
                        }),
                        _count: {
                            select: {
                                placeVotes: true,
                            },
                        },
                    },
                    skip,
                    take: limit,
                    orderBy,
                }),
                database_1.default.place.count({ where }),
            ]);
            // Filter by location if coordinates provided
            let filteredPlaces = places;
            if (latitude && longitude) {
                filteredPlaces = places.filter((place) => {
                    if (!place.location)
                        return false;
                    const distance = this.locationService.calculateDistance(latitude, longitude, place.location.latitude, place.location.longitude);
                    return distance <= radius;
                });
            }
            // Add vote statistics if requested
            const placesWithStats = filteredPlaces.map((place) => {
                if (includeVotes && "placeVotes" in place) {
                    const totalVotes = place._count.placeVotes;
                    const likes = place.placeVotes.filter((vote) => vote.isLiked).length;
                    const likePercentage = totalVotes > 0 ? (likes / totalVotes) * 100 : 0;
                    return {
                        ...place,
                        likePercentage: Math.round(likePercentage),
                        totalVotes,
                    };
                }
                return place;
            });
            return {
                places: placesWithStats,
                pagination: {
                    page,
                    limit,
                    total: latitude && longitude ? filteredPlaces.length : total,
                    totalPages: Math.ceil((latitude && longitude ? filteredPlaces.length : total) / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get places error:", error);
            throw error;
        }
    }
    async getNearbyPlaces(params) {
        try {
            const { latitude, longitude, radius = 5000, limit = 20, categoryId } = params;
            const where = {
                isActive: true,
                isApproved: true,
                location: {
                    isNot: null,
                },
            };
            if (categoryId) {
                where.categoryId = categoryId;
            }
            // Get places with location data
            const places = await database_1.default.place.findMany({
                where,
                include: {
                    location: true,
                    category: true,
                    placePhotos: {
                        take: 3,
                        where: { isApproved: true },
                    },
                    placeVotes: {
                        select: {
                            isLiked: true,
                        },
                    },
                    _count: {
                        select: {
                            placeVotes: true,
                        },
                    },
                },
                take: limit * 2, // Get more to filter by distance
            });
            // Calculate distances and filter
            const placesWithDistance = places
                .map((place) => {
                if (!place.location)
                    return null;
                const distance = this.locationService.calculateDistance(latitude, longitude, place.location.latitude, place.location.longitude);
                if (distance > radius)
                    return null;
                // Calculate like percentage
                const totalVotes = place._count.placeVotes;
                const likes = place.placeVotes.filter((vote) => vote.isLiked).length;
                const likePercentage = totalVotes > 0 ? (likes / totalVotes) * 100 : 0;
                return {
                    ...place,
                    distance: Math.round(distance),
                    likePercentage: Math.round(likePercentage),
                    totalVotes,
                };
            })
                .filter((place) => place !== null)
                .sort((a, b) => a.distance - b.distance)
                .slice(0, limit);
            return placesWithDistance;
        }
        catch (error) {
            logger_1.default.error("Get nearby places error:", error);
            throw error;
        }
    }
    async getPlaceById(placeId, userId) {
        try {
            const place = await database_1.default.place.findUnique({
                where: { id: placeId },
                include: {
                    location: true,
                    category: true,
                    owner: true,
                    placePhotos: {
                        where: { isApproved: true },
                    },
                    _count: {
                        select: {
                            placeVotes: true,
                        },
                    },
                },
            });
            if (!place) {
                throw new Error("Place not found");
            }
            // Get vote statistics
            const voteStats = await database_1.default.placeVote.groupBy({
                by: ["isLiked"],
                where: { placeId },
                _count: true,
            });
            const likes = voteStats.find((stat) => stat.isLiked)?._count || 0;
            const dislikes = voteStats.find((stat) => !stat.isLiked)?._count || 0;
            const totalVotes = likes + dislikes;
            // Get user's vote if authenticated
            let userVote = null;
            if (userId) {
                userVote = await database_1.default.placeVote.findFirst({
                    where: {
                        placeId,
                        userId,
                    },
                    select: {
                        isLiked: true,
                    },
                });
            }
            return {
                ...place,
                voteStats: {
                    likes,
                    dislikes,
                    totalVotes,
                    likePercentage: totalVotes > 0 ? Math.round((likes / totalVotes) * 100) : 0,
                },
                userVote: userVote?.isLiked,
            };
        }
        catch (error) {
            logger_1.default.error("Get place by ID error:", error);
            throw error;
        }
    }
    async createPlace(placeData, ownerId) {
        try {
            const place = await database_1.default.place.create({
                data: {
                    ...placeData,
                    ownerId,
                    isActive: true,
                    isApproved: false, // Requires approval
                },
            });
            return place;
        }
        catch (error) {
            logger_1.default.error("Create place error:", error);
            throw error;
        }
    }
    async updatePlace(placeId, updateData, userId) {
        try {
            // Check ownership or admin rights
            const place = await database_1.default.place.findUnique({
                where: { id: placeId },
            });
            if (!place) {
                throw new Error("Place not found");
            }
            if (place.ownerId !== userId) {
                // Check if user is admin
                const user = await database_1.default.user.findUnique({
                    where: { id: userId },
                });
                if (!user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(user.role)) {
                    throw new Error("Unauthorized to update this place");
                }
            }
            const updatedPlace = await database_1.default.place.update({
                where: { id: placeId },
                data: updateData,
            });
            return updatedPlace;
        }
        catch (error) {
            logger_1.default.error("Update place error:", error);
            throw error;
        }
    }
    async submitVote(voteData) {
        try {
            // Check if user already voted
            const existingVote = await database_1.default.placeVote.findFirst({
                where: {
                    placeId: voteData.placeId,
                    OR: [
                        { userId: voteData.userId || undefined },
                        { anonymousUserId: voteData.anonymousUserId || undefined },
                    ].filter((condition) => Object.values(condition).some((value) => value !== undefined)),
                },
            });
            if (existingVote) {
                // Update existing vote
                return await database_1.default.placeVote.update({
                    where: { id: existingVote.id },
                    data: {
                        isLiked: voteData.isLiked,
                    },
                });
            }
            else {
                // Create new vote
                return await database_1.default.placeVote.create({
                    data: {
                        placeId: voteData.placeId,
                        isLiked: voteData.isLiked,
                        surveyId: voteData.surveyId,
                        ...(voteData.userId && { userId: voteData.userId }),
                        ...(voteData.anonymousUserId && { anonymousUserId: voteData.anonymousUserId }),
                    },
                });
            }
        }
        catch (error) {
            logger_1.default.error("Submit vote error:", error);
            throw error;
        }
    }
    async getPlacesByCategory(categoryId, params) {
        try {
            const { page, limit, latitude, longitude, radius = 10000 } = params;
            const skip = (page - 1) * limit;
            const where = {
                categoryId,
                isActive: true,
                isApproved: true,
            };
            let places = await database_1.default.place.findMany({
                where,
                include: {
                    location: true,
                    category: true,
                    placePhotos: {
                        take: 1,
                        where: { isApproved: true },
                    },
                    _count: {
                        select: {
                            placeVotes: true,
                        },
                    },
                },
                skip,
                take: limit,
                orderBy: { name: "asc" },
            });
            // Filter by location if coordinates provided
            if (latitude && longitude) {
                places = places.filter((place) => {
                    if (!place.location)
                        return false;
                    const distance = this.locationService.calculateDistance(latitude, longitude, place.location.latitude, place.location.longitude);
                    return distance <= radius;
                });
            }
            const total = await database_1.default.place.count({ where });
            return {
                places,
                pagination: {
                    page,
                    limit,
                    total: latitude && longitude ? places.length : total,
                    totalPages: Math.ceil((latitude && longitude ? places.length : total) / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get places by category error:", error);
            throw error;
        }
    }
    async getCategories() {
        try {
            const categories = await database_1.default.placeCategory.findMany({
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
            });
            return categories;
        }
        catch (error) {
            logger_1.default.error("Get categories error:", error);
            throw error;
        }
    }
    async searchPlaces(query, params) {
        try {
            const { page, limit } = params;
            const skip = (page - 1) * limit;
            const where = {
                isActive: true,
                isApproved: true,
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { description: { contains: query, mode: "insensitive" } },
                ],
            };
            const [places, total] = await Promise.all([
                database_1.default.place.findMany({
                    where,
                    include: {
                        location: true,
                        category: true,
                        placePhotos: {
                            take: 1,
                            where: { isApproved: true },
                        },
                        _count: {
                            select: {
                                placeVotes: true,
                            },
                        },
                    },
                    skip,
                    take: limit,
                    orderBy: { name: "asc" },
                }),
                database_1.default.place.count({ where }),
            ]);
            return {
                places,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Search places error:", error);
            throw error;
        }
    }
    async getPlaceVotes(placeId) {
        try {
            const votes = await database_1.default.placeVote.findMany({
                where: { placeId },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    anonymousUser: {
                        select: {
                            id: true,
                            name: true,
                            gender: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
            const stats = await database_1.default.placeVote.groupBy({
                by: ["isLiked"],
                where: { placeId },
                _count: true,
            });
            const likes = stats.find((stat) => stat.isLiked)?._count || 0;
            const dislikes = stats.find((stat) => !stat.isLiked)?._count || 0;
            const totalVotes = likes + dislikes;
            return {
                votes,
                stats: {
                    likes,
                    dislikes,
                    totalVotes,
                    likePercentage: totalVotes > 0 ? Math.round((likes / totalVotes) * 100) : 0,
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get place votes error:", error);
            throw error;
        }
    }
    async getCategorySuggestions(placeId) {
        try {
            const suggestions = await database_1.default.placeCategorySuggestion.findMany({
                where: { placeId },
                include: {
                    suggestedCategory: true,
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                    anonymousUser: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
            // Group by suggested category
            const groupedSuggestions = suggestions.reduce((acc, suggestion) => {
                const categoryId = suggestion.suggestedCategoryId;
                if (!acc[categoryId]) {
                    acc[categoryId] = {
                        category: suggestion.suggestedCategory,
                        count: 0,
                        suggestions: [],
                    };
                }
                acc[categoryId].count++;
                acc[categoryId].suggestions.push(suggestion);
                return acc;
            }, {});
            return Object.values(groupedSuggestions);
        }
        catch (error) {
            logger_1.default.error("Get category suggestions error:", error);
            throw error;
        }
    }
}
exports.PlaceService = PlaceService;
