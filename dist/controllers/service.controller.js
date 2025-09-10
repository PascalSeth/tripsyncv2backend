"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceController = void 0;
const place_service_1 = require("../services/place.service");
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
class ServiceController {
    constructor() {
        this.getPlaceRecommendations = async (req, res) => {
            try {
                const { latitude, longitude, radius = 5000, limit = 10, categoryId } = req.query;
                if (!latitude || !longitude) {
                    return res.status(400).json({
                        success: false,
                        message: "Latitude and longitude are required",
                    });
                }
                const placeService = new place_service_1.PlaceService();
                const places = await placeService.getNearbyPlaces({
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    radius: Number(radius),
                    limit: Number(limit),
                    categoryId: categoryId,
                });
                res.json({
                    success: true,
                    message: "Place recommendations retrieved successfully",
                    data: places,
                });
            }
            catch (error) {
                logger_1.default.error("Get place recommendations error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve place recommendations",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.submitPlaceSurvey = async (req, res) => {
            try {
                const { votes, username, gender } = req.body;
                const userId = req.user?.id;
                const surveyData = {};
                if (userId) {
                    // Authenticated user
                    surveyData.userId = userId;
                }
                else {
                    // Anonymous user
                    if (!username || !gender) {
                        return res.status(400).json({
                            success: false,
                            message: "Username and gender are required for anonymous surveys",
                        });
                    }
                    // Create or get anonymous user
                    const sessionId = `anon_${Date.now()}_${Math.random()}`;
                    let anonymousUser = await database_1.default.anonymousUser.findUnique({
                        where: { sessionId },
                    });
                    if (!anonymousUser) {
                        anonymousUser = await database_1.default.anonymousUser.create({
                            data: {
                                name: username,
                                gender: gender,
                                sessionId,
                            },
                        });
                    }
                    surveyData.anonymousUserId = anonymousUser.id;
                }
                // Create survey
                const survey = await database_1.default.survey.create({
                    data: {
                        ...surveyData,
                        status: "COMPLETED",
                        completedAt: new Date(),
                    },
                });
                // Create votes
                const votePromises = votes.map((vote) => database_1.default.placeVote.create({
                    data: {
                        surveyId: survey.id,
                        placeId: vote.placeId,
                        isLiked: vote.isLiked,
                        userId: surveyData.userId,
                        anonymousUserId: surveyData.anonymousUserId,
                    },
                }));
                await Promise.all(votePromises);
                res.status(201).json({
                    success: true,
                    message: "Survey submitted successfully",
                    data: { surveyId: survey.id },
                });
            }
            catch (error) {
                logger_1.default.error("Submit place survey error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to submit survey",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getServiceTypes = async (req, res) => {
            try {
                const serviceTypes = await database_1.default.serviceType.findMany({
                    where: { isActive: true },
                    orderBy: { name: "asc" },
                });
                res.json({
                    success: true,
                    message: "Service types retrieved successfully",
                    data: serviceTypes,
                });
            }
            catch (error) {
                logger_1.default.error("Get service types error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve service types",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getServiceTypeById = async (req, res) => {
            try {
                const { id } = req.params;
                const serviceType = await database_1.default.serviceType.findUnique({
                    where: { id },
                });
                if (!serviceType) {
                    return res.status(404).json({
                        success: false,
                        message: "Service type not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Service type retrieved successfully",
                    data: serviceType,
                });
            }
            catch (error) {
                logger_1.default.error("Get service type by ID error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve service type",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getNearbyDrivers = async (req, res) => {
            try {
                const { latitude, longitude, radius = 10000, serviceType } = req.query;
                if (!latitude || !longitude) {
                    return res.status(400).json({
                        success: false,
                        message: "Latitude and longitude are required",
                    });
                }
                // This would need to be implemented based on your driver matching logic
                res.json({
                    success: true,
                    message: "Nearby drivers retrieved successfully",
                    data: [],
                });
            }
            catch (error) {
                logger_1.default.error("Get nearby drivers error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve nearby drivers",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getAvailableDrivers = async (req, res) => {
            try {
                const { serviceType = "RIDE" } = req.query;
                // Base query for available drivers
                const baseWhere = {
                    isAvailable: true,
                    isOnline: true,
                    isVerified: true,
                };
                // Add day booking specific filters if requested
                if (serviceType === "DAY_BOOKING") {
                    baseWhere.isAvailableForDayBooking = true;
                }
                const drivers = await database_1.default.driverProfile.findMany({
                    where: baseWhere,
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
                        dayBookingConfig: serviceType === "DAY_BOOKING" ? {
                            select: {
                                hourlyRate: true,
                                minimumHours: true,
                                maximumHours: true,
                                serviceAreas: true,
                                availableDays: true,
                                availableTimeSlots: true,
                                specialRequirements: true,
                                isActive: true,
                            }
                        } : false,
                        dayBookingAvailability: serviceType === "DAY_BOOKING" ? {
                            where: {
                                date: {
                                    gte: new Date(),
                                },
                                isAvailable: true,
                            },
                            select: {
                                date: true,
                                timeSlots: true,
                            },
                            orderBy: {
                                date: 'asc',
                            },
                            take: 7, // Next 7 days availability
                        } : false,
                    },
                });
                // Transform the data to include service area information
                const transformedDrivers = drivers.map(driver => {
                    const driverData = {
                        userId: driver.userId,
                        user: driver.user,
                        vehicle: driver.vehicle,
                        rating: driver.rating,
                        totalRides: driver.totalRides,
                        totalEarnings: driver.totalEarnings,
                        isAvailable: driver.isAvailable,
                        isOnline: driver.isOnline,
                        currentLatitude: driver.currentLatitude,
                        currentLongitude: driver.currentLongitude,
                        heading: driver.heading,
                        isAvailableForDayBooking: driver.isAvailableForDayBooking,
                    };
                    // Add day booking specific data if available
                    if (serviceType === "DAY_BOOKING" && driver.dayBookingConfig) {
                        driverData.dayBookingConfig = {
                            ...driver.dayBookingConfig,
                            serviceAreas: driver.dayBookingConfig.serviceAreas ? JSON.parse(driver.dayBookingConfig.serviceAreas) : [],
                            availableDays: driver.dayBookingConfig.availableDays ? JSON.parse(driver.dayBookingConfig.availableDays) : [],
                            availableTimeSlots: driver.dayBookingConfig.availableTimeSlots ? JSON.parse(driver.dayBookingConfig.availableTimeSlots) : [],
                        };
                        driverData.dayBookingAvailability = driver.dayBookingAvailability;
                    }
                    return driverData;
                });
                res.json({
                    success: true,
                    message: "Available drivers retrieved successfully",
                    data: transformedDrivers,
                });
            }
            catch (error) {
                logger_1.default.error("Get available drivers error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve available drivers",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateDriverAvailability = async (req, res) => {
            try {
                const userId = req.user.id;
                const { isAvailable, isOnline } = req.body;
                await database_1.default.driverProfile.updateMany({
                    where: { userId },
                    data: {
                        isAvailable,
                        isOnline,
                    },
                });
                res.json({
                    success: true,
                    message: "Driver availability updated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Update driver availability error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update driver availability",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateDriverLocation = async (req, res) => {
            try {
                const userId = req.user.id;
                const { latitude, longitude, heading } = req.body;
                await database_1.default.driverProfile.updateMany({
                    where: { userId },
                    data: {
                        currentLatitude: latitude,
                        currentLongitude: longitude,
                        heading,
                    },
                });
                res.json({
                    success: true,
                    message: "Driver location updated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Update driver location error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update driver location",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getNearbyStores = async (req, res) => {
            try {
                const { latitude, longitude, radius = 10000 } = req.query;
                if (!latitude || !longitude) {
                    return res.status(400).json({
                        success: false,
                        message: "Latitude and longitude are required",
                    });
                }
                const stores = await database_1.default.store.findMany({
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
                });
                res.json({
                    success: true,
                    message: "Nearby stores retrieved successfully",
                    data: stores,
                });
            }
            catch (error) {
                logger_1.default.error("Get nearby stores error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve nearby stores",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getStoreById = async (req, res) => {
            try {
                const { id } = req.params;
                const store = await database_1.default.store.findUnique({
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
                });
                if (!store) {
                    return res.status(404).json({
                        success: false,
                        message: "Store not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Store retrieved successfully",
                    data: store,
                });
            }
            catch (error) {
                logger_1.default.error("Get store by ID error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve store",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getStoreProducts = async (req, res) => {
            try {
                const { id } = req.params;
                const products = await database_1.default.product.findMany({
                    where: {
                        storeId: id,
                    },
                    orderBy: { name: "asc" },
                });
                res.json({
                    success: true,
                    message: "Store products retrieved successfully",
                    data: products,
                });
            }
            catch (error) {
                logger_1.default.error("Get store products error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve store products",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getNearbyRestaurants = async (req, res) => {
            try {
                const { latitude, longitude, radius = 10000 } = req.query;
                if (!latitude || !longitude) {
                    return res.status(400).json({
                        success: false,
                        message: "Latitude and longitude are required",
                    });
                }
                // This would need to be implemented based on your restaurant schema
                res.json({
                    success: true,
                    message: "Nearby restaurants retrieved successfully",
                    data: [],
                });
            }
            catch (error) {
                logger_1.default.error("Get nearby restaurants error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve restaurant menu",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getRestaurantMenu = async (req, res) => {
            try {
                const { id } = req.params;
                // This would need to be implemented based on your restaurant/menu schema
                res.json({
                    success: true,
                    message: "Restaurant menu retrieved successfully",
                    data: [],
                });
            }
            catch (error) {
                logger_1.default.error("Get restaurant menu error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve restaurant menu",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getNearbyPlaces = async (req, res) => {
            try {
                const { latitude, longitude, radius = 5000, limit = 20, categoryId } = req.query;
                if (!latitude || !longitude) {
                    return res.status(400).json({
                        success: false,
                        message: "Latitude and longitude are required",
                    });
                }
                const placeService = new place_service_1.PlaceService();
                const places = await placeService.getNearbyPlaces({
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    radius: Number(radius),
                    limit: Number(limit),
                    categoryId: categoryId,
                });
                res.json({
                    success: true,
                    message: "Nearby places retrieved successfully",
                    data: places,
                });
            }
            catch (error) {
                logger_1.default.error("Get nearby places error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve nearby places",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getServiceZones = async (req, res) => {
            try {
                const zones = await database_1.default.serviceZone.findMany({
                    where: { isActive: true },
                    orderBy: { name: "asc" },
                });
                res.json({
                    success: true,
                    message: "Service zones retrieved successfully",
                    data: zones,
                });
            }
            catch (error) {
                logger_1.default.error("Get service zones error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve service zones",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.checkServiceCoverage = async (req, res) => {
            try {
                const { latitude, longitude } = req.query;
                if (!latitude || !longitude) {
                    return res.status(400).json({
                        success: false,
                        message: "Latitude and longitude are required",
                    });
                }
                // This would need to implement actual coverage checking logic
                res.json({
                    success: true,
                    message: "Service coverage checked successfully",
                    data: {
                        covered: true,
                        zones: [],
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Check service coverage error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to check service coverage",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getRideTypes = async (req, res) => {
            try {
                const rideTypes = [
                    { name: "Economy", type: "ECONOMY", description: "Affordable rides for everyday travel." },
                    { name: "Comfort", type: "COMFORT", description: "Spacious and comfortable vehicles." },
                    { name: "Premium", type: "PREMIUM", description: "Luxury vehicles for a premium experience." },
                ];
                res.json({
                    success: true,
                    message: "Ride types retrieved successfully",
                    data: rideTypes,
                });
            }
            catch (error) {
                logger_1.default.error("Get ride types error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve ride types",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
}
exports.ServiceController = ServiceController;
