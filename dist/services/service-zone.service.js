"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceZoneService = void 0;
const database_1 = __importDefault(require("../config/database"));
const location_service_1 = require("./location.service");
const notification_service_1 = require("./notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class ServiceZoneService {
    constructor() {
        this.locationService = new location_service_1.LocationService();
        this.notificationService = new notification_service_1.NotificationService();
    }
    /**
     * Create a new service zone
     */
    async createServiceZone(zoneData) {
        try {
            const zone = await database_1.default.serviceZone.create({
                data: {
                    name: zoneData.name,
                    displayName: zoneData.displayName || zoneData.name,
                    type: zoneData.type || "LOCAL",
                    category: zoneData.category,
                    centerLat: zoneData.centerLat,
                    centerLng: zoneData.centerLng,
                    radius: zoneData.radius,
                    boundaries: zoneData.boundaries,
                    timezone: zoneData.timezone || "Africa/Accra",
                    currency: zoneData.currency || "GHS",
                    allowsInterRegional: zoneData.allowsInterRegional || false,
                    interRegionalFee: zoneData.interRegionalFee || 0,
                    connectedZones: zoneData.connectedZones || [],
                    basePriceMultiplier: zoneData.basePriceMultiplier || 1.0,
                    description: `${zoneData.type} service zone for ${zoneData.name}`,
                },
            });
            logger_1.default.info(`Service zone created: ${zone.name} (${zone.type})`);
            return zone;
        }
        catch (error) {
            logger_1.default.error("Create service zone error:", error);
            throw error;
        }
    }
    /**
     * Find service zone by coordinates
     */
    async findZoneByCoordinates(latitude, longitude) {
        try {
            const zones = await database_1.default.serviceZone.findMany({
                where: { isActive: true },
                orderBy: { priority: "desc" },
            });
            // Check circular zones first
            for (const zone of zones) {
                if (zone.radius) {
                    const distance = this.locationService.calculateDistance(latitude, longitude, zone.centerLat, zone.centerLng);
                    if (distance <= zone.radius) {
                        return zone;
                    }
                }
            }
            // Check polygon boundaries
            for (const zone of zones) {
                if (zone.boundaries && this.isPointInPolygon(latitude, longitude, zone.boundaries)) {
                    return zone;
                }
            }
            return null;
        }
        catch (error) {
            logger_1.default.error("Find zone by coordinates error:", error);
            return null;
        }
    }
    /**
     * Get all zones in hierarchy
     */
    async getZoneHierarchy(zoneId) {
        try {
            const where = zoneId ? { parentZoneId: zoneId } : { parentZoneId: null };
            const zones = await database_1.default.serviceZone.findMany({
                where: { ...where, isActive: true },
                include: {
                    childZones: {
                        where: { isActive: true },
                        include: {
                            childZones: {
                                where: { isActive: true },
                            },
                        },
                    },
                },
                orderBy: { priority: "desc" },
            });
            return zones;
        }
        catch (error) {
            logger_1.default.error("Get zone hierarchy error:", error);
            return [];
        }
    }
    /**
     * Check if inter-regional booking is possible
     */
    async canCreateInterRegionalBooking(originLat, originLng, destLat, destLng) {
        try {
            const [originZone, destinationZone] = await Promise.all([
                this.findZoneByCoordinates(originLat, originLng),
                this.findZoneByCoordinates(destLat, destLng),
            ]);
            if (!originZone || !destinationZone) {
                return {
                    canBook: false,
                    originZone,
                    destinationZone,
                    route: null,
                    additionalFee: 0,
                    estimatedDuration: 0,
                    requiresApproval: false,
                };
            }
            // Same zone booking
            if (originZone.id === destinationZone.id) {
                return {
                    canBook: true,
                    originZone,
                    destinationZone,
                    route: null,
                    additionalFee: 0,
                    estimatedDuration: 0,
                    requiresApproval: false,
                };
            }
            // Check if inter-regional booking is allowed
            const canBook = originZone.allowsInterRegional &&
                destinationZone.allowsInterRegional &&
                (originZone.connectedZones.includes(destinationZone.id) ||
                    destinationZone.connectedZones.includes(originZone.id));
            if (!canBook) {
                return {
                    canBook: false,
                    originZone,
                    destinationZone,
                    route: null,
                    additionalFee: 0,
                    estimatedDuration: 0,
                    requiresApproval: false,
                };
            }
            // Calculate route details
            const { distance, duration } = await this.locationService.getEstimatedTravelTime(originLat, originLng, destLat, destLng);
            const route = {
                originZoneId: originZone.id,
                destinationZoneId: destinationZone.id,
                distance,
                estimatedDuration: duration,
                baseFee: this.calculateInterRegionalFee(originZone, destinationZone, distance),
                isActive: true,
                requiresApproval: this.requiresApproval(originZone, destinationZone),
            };
            return {
                canBook: true,
                originZone,
                destinationZone,
                route,
                additionalFee: route.baseFee,
                estimatedDuration: duration,
                requiresApproval: route.requiresApproval,
            };
        }
        catch (error) {
            logger_1.default.error("Can create inter-regional booking error:", error);
            return {
                canBook: false,
                originZone: null,
                destinationZone: null,
                route: null,
                additionalFee: 0,
                estimatedDuration: 0,
                requiresApproval: false,
            };
        }
    }
    /**
     * Find drivers for inter-regional booking
     */
    async findInterRegionalDrivers(params) {
        try {
            const { originZoneId, destinationZoneId, latitude, longitude, serviceType, maxDrivers = 10 } = params;
            // Find drivers who can handle inter-regional trips
            const availableDrivers = await database_1.default.driverProfile.findMany({
                where: {
                    isAvailable: true,
                    isOnline: true,
                    isVerified: true,
                    currentLatitude: { not: null },
                    currentLongitude: { not: null },
                    user: {
                        isActive: true,
                        isCommissionCurrent: true,
                    },
                    serviceZones: {
                        some: {
                            serviceZoneId: originZoneId,
                            canAcceptInterRegional: true,
                            isActive: true,
                        },
                    },
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            phone: true,
                            avatar: true,
                        },
                    },
                    vehicle: true,
                    serviceZones: {
                        where: {
                            OR: [{ serviceZoneId: originZoneId }, { serviceZoneId: destinationZoneId }],
                        },
                        include: {
                            serviceZone: true,
                        },
                    },
                },
            });
            // Filter and sort by distance
            const nearbyDrivers = availableDrivers
                .map((driver) => {
                const distance = this.locationService.calculateDistance(latitude, longitude, driver.currentLatitude, driver.currentLongitude);
                // Get inter-regional rate if available
                const interRegionalZone = driver.serviceZones.find((sz) => sz.canAcceptInterRegional);
                const interRegionalRate = interRegionalZone?.interRegionalRate;
                return {
                    driverId: driver.user.id,
                    driverName: `${driver.user.firstName} ${driver.user.lastName}`,
                    phone: driver.user.phone,
                    avatar: driver.user.avatar,
                    rating: driver.rating,
                    vehicle: driver.vehicle,
                    distance,
                    interRegionalRate,
                    canAcceptInterRegional: true,
                    location: {
                        latitude: driver.currentLatitude,
                        longitude: driver.currentLongitude,
                    },
                };
            })
                .filter((driver) => driver.distance <= 15000) // 15km radius for inter-regional
                .sort((a, b) => a.distance - b.distance)
                .slice(0, maxDrivers);
            return nearbyDrivers;
        }
        catch (error) {
            logger_1.default.error("Find inter-regional drivers error:", error);
            return [];
        }
    }
    /**
     * Create inter-regional booking
     */
    async createInterRegionalBooking(bookingData) {
        try {
            const booking = await database_1.default.booking.create({
                data: {
                    bookingNumber: await this.generateInterRegionalBookingNumber(),
                    customerId: bookingData.customerId,
                    serviceTypeId: bookingData.serviceTypeId,
                    status: bookingData.requiresApproval ? "PENDING" : "CONFIRMED",
                    type: "IMMEDIATE",
                    pickupLatitude: bookingData.pickupLatitude,
                    pickupLongitude: bookingData.pickupLongitude,
                    dropoffLatitude: bookingData.dropoffLatitude,
                    dropoffLongitude: bookingData.dropoffLongitude,
                    estimatedDistance: bookingData.estimatedDistance,
                    estimatedDuration: bookingData.estimatedDuration,
                    estimatedPrice: bookingData.estimatedPrice,
                    currency: "GHS",
                    isInterRegional: true,
                    originZoneId: bookingData.originZoneId,
                    destinationZoneId: bookingData.destinationZoneId,
                    interRegionalFee: bookingData.interRegionalFee,
                    serviceData: {
                        isInterRegional: true,
                        requiresApproval: bookingData.requiresApproval,
                        routeType: "INTER_REGIONAL",
                    },
                    platformCommission: bookingData.estimatedPrice * 0.15, // Lower commission for inter-regional
                    providerEarning: bookingData.estimatedPrice * 0.85,
                },
                include: {
                    originZone: true,
                    destinationZone: true,
                    customer: true,
                },
            });
            // Notify relevant parties
            if (bookingData.requiresApproval) {
                await this.notificationService.notifyAdmins({
                    type: "INTER_REGIONAL_BOOKING_REQUEST",
                    title: "Inter-Regional Booking Approval Required",
                    body: `New inter-regional booking from ${booking.originZone?.name} to ${booking.destinationZone?.name}`,
                    data: { bookingId: booking.id },
                });
            }
            logger_1.default.info(`Inter-regional booking created: ${booking.bookingNumber}`);
            return booking;
        }
        catch (error) {
            logger_1.default.error("Create inter-regional booking error:", error);
            throw error;
        }
    }
    /**
     * Assign driver to zone
     */
    async assignDriverToZone(driverId, zoneId, canAcceptInterRegional = false) {
        try {
            const driverProfile = await database_1.default.driverProfile.findFirst({
                where: { userId: driverId },
            });
            if (!driverProfile) {
                throw new Error("Driver profile not found");
            }
            await database_1.default.driverServiceZone.upsert({
                where: {
                    driverProfileId_serviceZoneId: {
                        driverProfileId: driverProfile.id,
                        serviceZoneId: zoneId,
                    },
                },
                update: {
                    isActive: true,
                    canAcceptInterRegional,
                },
                create: {
                    driverProfileId: driverProfile.id,
                    serviceZoneId: zoneId,
                    canAcceptInterRegional,
                },
            });
            logger_1.default.info(`Driver ${driverId} assigned to zone ${zoneId}`);
        }
        catch (error) {
            logger_1.default.error("Assign driver to zone error:", error);
            throw error;
        }
    }
    /**
     * Request zone transfer for driver
     */
    async requestZoneTransfer(transferData) {
        try {
            // Check if driver is currently in the from zone
            const driverProfile = await database_1.default.driverProfile.findFirst({
                where: { userId: transferData.driverId },
                include: {
                    serviceZones: {
                        where: { serviceZoneId: transferData.fromZoneId },
                    },
                },
            });
            if (!driverProfile || driverProfile.serviceZones.length === 0) {
                throw new Error("Driver not found in specified zone");
            }
            // Create transfer request (would need a new model in production)
            const transferRequest = {
                driverId: transferData.driverId,
                fromZoneId: transferData.fromZoneId,
                toZoneId: transferData.toZoneId,
                reason: transferData.reason,
                requestedAt: new Date(),
                status: "PENDING",
            };
            // Notify zone administrators
            await this.notificationService.notifyAdmins({
                type: "ZONE_TRANSFER_INITIATED",
                title: "Zone Transfer Request",
                body: `Driver requests transfer from one zone to another`,
                data: transferRequest,
            });
            logger_1.default.info(`Zone transfer requested for driver ${transferData.driverId}`);
            return transferRequest;
        }
        catch (error) {
            logger_1.default.error("Request zone transfer error:", error);
            throw error;
        }
    }
    /**
     * Get zone statistics
     */
    async getZoneStatistics(zoneId, dateRange) {
        try {
            const where = {
                OR: [{ originZoneId: zoneId }, { destinationZoneId: zoneId }],
            };
            if (dateRange) {
                where.createdAt = {
                    gte: dateRange.from,
                    lte: dateRange.to,
                };
            }
            const [bookings, activeDrivers] = await Promise.all([
                database_1.default.booking.findMany({
                    where,
                    include: {
                        destinationZone: true,
                        originZone: true,
                    },
                }),
                database_1.default.driverServiceZone.count({
                    where: {
                        serviceZoneId: zoneId,
                        isActive: true,
                        driverProfile: {
                            isAvailable: true,
                            isOnline: true,
                        },
                    },
                }),
            ]);
            const totalBookings = bookings.length;
            const interRegionalBookings = bookings.filter((b) => b.isInterRegional).length;
            const totalRevenue = bookings.reduce((sum, b) => sum + (b.finalPrice || b.estimatedPrice || 0), 0);
            // Calculate top destinations
            const destinationCounts = new Map();
            bookings
                .filter((b) => b.originZoneId === zoneId && b.destinationZone)
                .forEach((b) => {
                const zoneName = b.destinationZone.name;
                destinationCounts.set(zoneName, (destinationCounts.get(zoneName) || 0) + 1);
            });
            const topDestinations = Array.from(destinationCounts.entries())
                .map(([zoneName, count]) => ({ zoneName, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);
            return {
                totalBookings,
                interRegionalBookings,
                activeDrivers,
                averageRating: 4.5, // Would calculate from actual reviews
                totalRevenue,
                topDestinations,
            };
        }
        catch (error) {
            logger_1.default.error("Get zone statistics error:", error);
            return {
                totalBookings: 0,
                interRegionalBookings: 0,
                activeDrivers: 0,
                averageRating: 0,
                totalRevenue: 0,
                topDestinations: [],
            };
        }
    }
    /**
     * Setup default zones for Ghana
     */
    async setupDefaultZones() {
        try {
            // Create regional zones
            const regions = [
                { name: "Greater Accra", centerLat: 5.6037, centerLng: -0.187, radius: 50000 },
                { name: "Ashanti", centerLat: 6.6885, centerLng: -1.6244, radius: 60000 },
                { name: "Western", centerLat: 5.2767, centerLng: -2.32, radius: 70000 },
                { name: "Central", centerLat: 5.4518, centerLng: -1.3955, radius: 45000 },
                { name: "Eastern", centerLat: 6.1248, centerLng: -0.8381, radius: 55000 },
                { name: "Northern", centerLat: 9.4034, centerLng: -0.8424, radius: 80000 },
            ];
            const createdRegions = [];
            for (const region of regions) {
                const existingZone = await database_1.default.serviceZone.findFirst({
                    where: { name: region.name },
                });
                if (!existingZone) {
                    const zone = await this.createServiceZone({
                        name: region.name,
                        displayName: `${region.name} Region`,
                        type: "REGIONAL",
                        category: "TRANSPORTATION",
                        centerLat: region.centerLat,
                        centerLng: region.centerLng,
                        radius: region.radius,
                        allowsInterRegional: true,
                        interRegionalFee: 50, // GHS 50 base inter-regional fee
                        connectedZones: [], // Will be updated after all zones are created
                    });
                    createdRegions.push(zone);
                }
            }
            // Connect all regions to each other
            const allZones = await database_1.default.serviceZone.findMany({
                where: { type: "REGIONAL" },
            });
            for (const zone of allZones) {
                const connectedZoneIds = allZones.filter((z) => z.id !== zone.id).map((z) => z.id);
                await database_1.default.serviceZone.update({
                    where: { id: zone.id },
                    data: { connectedZones: connectedZoneIds },
                });
            }
            logger_1.default.info(`Setup ${createdRegions.length} default zones for Ghana`);
        }
        catch (error) {
            logger_1.default.error("Setup default zones error:", error);
            throw error;
        }
    }
    // Private helper methods
    isPointInPolygon(lat, lng, polygon) {
        // Simplified point-in-polygon check
        // In production, use a proper geospatial library
        if (!polygon || !polygon.coordinates)
            return false;
        // This is a basic implementation - use turf.js or similar for production
        return false;
    }
    calculateInterRegionalFee(originZone, destinationZone, distance) {
        const baseFee = Math.max(originZone.interRegionalFee, destinationZone.interRegionalFee);
        const distanceFee = (distance / 1000) * 2; // GHS 2 per km
        return baseFee + distanceFee;
    }
    requiresApproval(originZone, destinationZone) {
        // Require approval for certain zone combinations
        const highRiskZones = ["Northern", "Upper East", "Upper West"];
        return (highRiskZones.includes(originZone.name) ||
            highRiskZones.includes(destinationZone.name) ||
            originZone.type === "INTERNATIONAL" ||
            destinationZone.type === "INTERNATIONAL");
    }
    async generateInterRegionalBookingNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `IRB${timestamp}${random}`;
    }
}
exports.ServiceZoneService = ServiceZoneService;
