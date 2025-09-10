"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingController = void 0;
const database_1 = __importDefault(require("../config/database"));
const booking_service_1 = require("../services/booking.service");
const pricing_service_1 = require("../services/pricing.service");
const driver_matching_service_1 = require("../services/driver-matching.service");
const notification_service_1 = require("../services/notification.service");
const tracking_service_1 = require("../services/tracking.service");
const service_zone_service_1 = require("../services/service-zone.service");
const webhook_service_1 = require("../services/webhook.service");
const logger_1 = __importDefault(require("../utils/logger"));
const location_service_1 = require("../services/location.service");
const day_booking_service_1 = require("../services/day-booking.service");
class BookingController {
    constructor() {
        this.bookingService = new booking_service_1.BookingService();
        this.pricingService = new pricing_service_1.PricingService();
        this.driverMatchingService = new driver_matching_service_1.DriverMatchingService();
        this.notificationService = new notification_service_1.NotificationService();
        this.trackingService = new tracking_service_1.TrackingService();
        this.locationService = new location_service_1.LocationService();
        this.serviceZoneService = new service_zone_service_1.ServiceZoneService();
        this.dayBookingService = new day_booking_service_1.DayBookingService();
        this.webhookService = new webhook_service_1.WebhookService();
        this.createBooking = async (req, res) => {
            try {
                const userId = req.user.id;
                const bookingData = req.body;
                // Create booking based on service type
                const booking = await this.bookingService.createBooking(userId, bookingData);
                res.status(201).json({
                    success: true,
                    message: "Booking created successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Create booking error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createRideBooking = async (req, res) => {
            try {
                // ENHANCED: More detailed authentication debugging
                logger_1.default.info("createRideBooking called - Full request context:", {
                    hasUser: !!req.user,
                    userObject: req.user
                        ? {
                            id: req.user.id,
                            email: req.user.email,
                            role: req.user.role,
                            isVerified: req.user.isVerified,
                            isActive: req.user.isActive,
                        }
                        : null,
                    authHeader: req.headers.authorization ? "Present" : "Missing",
                    contentType: req.headers["content-type"],
                    userAgent: req.headers["user-agent"],
                    requestBody: {
                        hasPickupCoords: !!(req.body.pickupLatitude && req.body.pickupLongitude),
                        hasDropoffCoords: !!(req.body.dropoffLatitude && req.body.dropoffLongitude),
                        rideType: req.body.rideType,
                    },
                });
                // FIXED: Better authentication check with detailed logging
                if (!req.user || !req.user.id) {
                    logger_1.default.error("Authentication failed in createRideBooking:", {
                        hasUser: !!req.user,
                        userId: req.user?.id,
                        userEmail: req.user?.email,
                        userRole: req.user?.role,
                        headers: req.headers.authorization ? "Bearer token present" : "No auth header",
                        requestPath: req.path,
                        requestMethod: req.method,
                    });
                    return res.status(401).json({
                        success: false,
                        message: "User authentication required - please login again",
                        debug: {
                            hasUser: !!req.user,
                            hasUserId: !!req.user?.id,
                            authHeaderPresent: !!req.headers.authorization,
                        },
                    });
                }
                const userId = req.user.id;
                const { pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, rideType, scheduledAt, paymentMethodId, notes, shareLocationWithEmergencyContacts = false,
                // FIXED: Remove userId from body since we get it from authenticated user
                 } = req.body;
                logger_1.default.info("Creating ride booking with authenticated user:", {
                    userId,
                    userEmail: req.user.email,
                    userRole: req.user.role,
                    rideType,
                    pickup: { lat: pickupLatitude, lng: pickupLongitude },
                    dropoff: { lat: dropoffLatitude, lng: pickupLongitude },
                });
                // Check if this is an inter-regional booking
                const interRegionalCheck = await this.serviceZoneService.canCreateInterRegionalBooking(pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude);
                let booking;
                if (interRegionalCheck.canBook && interRegionalCheck.route) {
                    // Create inter-regional booking
                    booking = await this.createInterRegionalRideBooking({
                        userId,
                        pickupLatitude,
                        pickupLongitude,
                        dropoffLatitude,
                        dropoffLongitude,
                        rideType,
                        scheduledAt,
                        notes,
                        interRegionalData: interRegionalCheck,
                    });
                }
                else {
                    // Create regular booking
                    booking = await this.createRegularRideBooking({
                        userId,
                        pickupLatitude,
                        pickupLongitude,
                        dropoffLatitude,
                        dropoffLongitude,
                        rideType,
                        scheduledAt,
                        notes,
                    });
                }
                // For immediate bookings, start driver matching process
                if (!scheduledAt) {
                    try {
                        await this.driverMatchingService.matchDriverToBooking(booking.id);
                    }
                    catch (matchingError) {
                        logger_1.default.error("Driver matching failed:", matchingError);
                        // Don't fail the booking creation, just log the error
                    }
                }
                // Share location with emergency contacts if requested
                if (shareLocationWithEmergencyContacts) {
                    try {
                        const { EmergencyService } = await Promise.resolve().then(() => __importStar(require("../services/emergency.service")));
                        const emergencyService = new EmergencyService();
                        await emergencyService.shareLocationWithEmergencyContacts(userId, {
                            latitude: pickupLatitude,
                            longitude: pickupLongitude,
                            address: `Ride pickup location`,
                        }, true, // Real-time sharing
                        booking.id);
                        logger_1.default.info(`Location sharing enabled for booking ${booking.id} with emergency contacts`);
                    }
                    catch (locationShareError) {
                        logger_1.default.error("Failed to enable location sharing:", locationShareError);
                        // Don't fail the booking creation, just log the error
                    }
                }
                res.status(201).json({
                    success: true,
                    message: interRegionalCheck.route
                        ? "Inter-regional ride booking created successfully"
                        : "Ride booking created successfully",
                    data: {
                        ...booking,
                        locationSharingEnabled: shareLocationWithEmergencyContacts,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Create ride booking error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create ride booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createSharedRide = async (req, res) => {
            try {
                // ENHANCED: More detailed authentication debugging
                logger_1.default.info("createSharedRide called - Full request context:", {
                    hasUser: !!req.user,
                    userObject: req.user
                        ? {
                            id: req.user.id,
                            email: req.user.email,
                            role: req.user.role,
                            isVerified: req.user.isVerified,
                            isActive: req.user.isActive,
                        }
                        : null,
                    authHeader: req.headers.authorization ? "Present" : "Missing",
                });
                // FIXED: Better authentication check
                if (!req.user || !req.user.id) {
                    logger_1.default.error("Authentication failed in createSharedRide:", {
                        hasUser: !!req.user,
                        userId: req.user?.id,
                        userEmail: req.user?.email,
                        userRole: req.user?.role,
                        headers: req.headers.authorization ? "Bearer token present" : "No auth header",
                        requestPath: req.path,
                        requestMethod: req.method,
                    });
                    return res.status(401).json({
                        success: false,
                        message: "User authentication required - please login again",
                        debug: {
                            hasUser: !!req.user,
                            hasUserId: !!req.user?.id,
                            authHeaderPresent: !!req.headers.authorization,
                        },
                    });
                }
                const userId = req.user.id;
                const { pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, maxWaitTime = 10, maxDetour = 5, } = req.body;
                logger_1.default.info("Creating shared ride booking with authenticated user:", {
                    userId,
                    userEmail: req.user.email,
                    userRole: req.user.role,
                    pickup: { lat: pickupLatitude, lng: pickupLongitude },
                    dropoff: { lat: dropoffLatitude, lng: dropoffLongitude },
                    maxWaitTime,
                    maxDetour,
                });
                // Find compatible existing shared rides along the same route
                const compatibleRides = await this.findCompatibleSharedRides({
                    pickupLatitude,
                    pickupLongitude,
                    dropoffLatitude,
                    dropoffLongitude,
                    maxDetour,
                });
                let booking;
                if (compatibleRides.length > 0) {
                    // Join existing shared ride along the same route
                    const bestMatchRide = compatibleRides[0]; // Already sorted by similarity
                    const sharedRideGroup = bestMatchRide.serviceData?.sharedRideGroup;
                    logger_1.default.info(`🎯 Found compatible shared ride: ${bestMatchRide.id} (similarity: ${(bestMatchRide.routeSimilarity * 100).toFixed(1)}%)`);
                    // Fetch all current bookings in this shared ride group
                    const existingGroupBookings = await database_1.default.booking.findMany({
                        where: {
                            serviceData: {
                                path: ["sharedRideGroup"],
                                equals: sharedRideGroup,
                            },
                            status: { in: ["PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] }, // Only active bookings
                        },
                    });
                    const newTotalPassengers = existingGroupBookings.length + 1;
                    const totalEstimatedPriceForGroup = bestMatchRide.serviceData?.totalEstimatedPrice || bestMatchRide.estimatedPrice;
                    if (!totalEstimatedPriceForGroup) {
                        throw new Error("Total estimated price for shared ride group not found.");
                    }
                    // Calculate even cost sharing among all passengers
                    const perPassengerCost = Math.round(totalEstimatedPriceForGroup / newTotalPassengers);
                    const originalSingleRideCost = await this.pricingService.calculateRideEstimate({
                        pickupLatitude,
                        pickupLongitude,
                        dropoffLatitude,
                        dropoffLongitude,
                        rideType: "ECONOMY", // Compare with regular economy ride
                    });
                    const savings = originalSingleRideCost.estimatedPrice - perPassengerCost;
                    logger_1.default.info(`🤝 Joining shared ride group: ${sharedRideGroup}`, {
                        groupLeaderBookingId: bestMatchRide.id,
                        currentPassengers: existingGroupBookings.length,
                        newTotalPassengers,
                        totalEstimatedPriceForGroup,
                        perPassengerCost,
                        savings,
                        routeSimilarity: `${(bestMatchRide.routeSimilarity * 100).toFixed(1)}%`
                    });
                    // Create new booking for the joining user
                    booking = await database_1.default.booking.create({
                        data: {
                            bookingNumber: await this.generateBookingNumber(),
                            customerId: userId,
                            serviceTypeId: await this.getServiceTypeId("SHARED_RIDE"),
                            status: "PENDING",
                            type: "IMMEDIATE",
                            pickupLatitude,
                            pickupLongitude,
                            dropoffLatitude,
                            dropoffLongitude,
                            estimatedPrice: perPassengerCost, // Evenly shared cost
                            currency: "GHS",
                            serviceData: {
                                sharedRideGroup,
                                isGroupLeader: false,
                                maxPassengers: 4,
                                estimatedSavings: savings, // Savings compared to single ride
                                totalEstimatedPrice: totalEstimatedPriceForGroup,
                                routeSimilarity: bestMatchRide.routeSimilarity,
                                joinedAt: new Date(),
                            },
                        },
                    });
                    // Update all existing bookings in the group with the new evenly shared cost
                    for (const existingBooking of existingGroupBookings) {
                        await database_1.default.booking.update({
                            where: { id: existingBooking.id },
                            data: {
                                estimatedPrice: perPassengerCost,
                                serviceData: {
                                    ...existingBooking.serviceData,
                                    totalEstimatedPrice: totalEstimatedPriceForGroup,
                                    updatedCostSharing: new Date(), // Track when cost was updated
                                },
                            },
                        });
                        logger_1.default.info(`💰 Updated existing booking ${existingBooking.id} to new shared cost: GH₵${perPassengerCost}`);
                    }
                    // Update the group leader's serviceData to reflect the new passenger count
                    await database_1.default.booking.update({
                        where: { id: bestMatchRide.id },
                        data: {
                            serviceData: {
                                ...bestMatchRide.serviceData,
                                currentPassengers: newTotalPassengers,
                                sharedPassengers: [
                                    ...(bestMatchRide.serviceData?.sharedPassengers || []),
                                    {
                                        passengerId: userId,
                                        bookingId: booking.id,
                                        joinedAt: new Date(),
                                        routeSimilarity: bestMatchRide.routeSimilarity,
                                    },
                                ],
                                lastUpdated: new Date(),
                            },
                        },
                    });
                    logger_1.default.info(`✅ Successfully joined shared ride. Cost per passenger: GH₵${perPassengerCost} (${newTotalPassengers} passengers total)`);
                }
                else {
                    // No compatible rides found - create new shared ride group and wait for partners
                    logger_1.default.info(`🚫 No compatible shared rides found along the same route. Creating new group and waiting for partners.`);
                    const sharedRideGroup = `shared_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const estimate = await this.pricingService.calculateRideEstimate({
                        pickupLatitude,
                        pickupLongitude,
                        dropoffLatitude,
                        dropoffLongitude,
                        rideType: "SHARED",
                    });
                    const totalEstimatedPrice = estimate.estimatedPrice;
                    logger_1.default.info(`🆕 Creating new shared ride group: ${sharedRideGroup}`, {
                        totalEstimatedPrice,
                        waitingForPartners: true,
                    });
                    booking = await database_1.default.booking.create({
                        data: {
                            bookingNumber: await this.generateBookingNumber(),
                            customerId: userId,
                            serviceTypeId: await this.getServiceTypeId("SHARED_RIDE"),
                            status: "PENDING",
                            type: "IMMEDIATE",
                            pickupLatitude,
                            pickupLongitude,
                            dropoffLatitude,
                            dropoffLongitude,
                            estimatedPrice: totalEstimatedPrice, // Initially pay full price, will be adjusted when partners join
                            currency: "GHS",
                            serviceData: {
                                sharedRideGroup,
                                isGroupLeader: true,
                                maxPassengers: 4,
                                waitingForMorePassengers: true,
                                totalEstimatedPrice: totalEstimatedPrice,
                                currentPassengers: 1,
                                sharedPassengers: [
                                    {
                                        passengerId: userId,
                                        bookingId: null, // This booking itself is the group leader
                                        joinedAt: new Date(),
                                    },
                                ],
                                partnerSearchStarted: new Date(),
                                noPartnersFoundMessage: "Waiting for passengers going along the same route...",
                            },
                        },
                    });
                    logger_1.default.info(`⏳ Shared ride created. Waiting for compatible passengers along the same route.`);
                }
                // Prepare response based on whether partners were found
                const hasPartners = compatibleRides.length > 0;
                const responseMessage = hasPartners
                    ? `Shared ride booking created successfully. Joined existing ride with ${compatibleRides[0].currentPassengers} other passenger(s).`
                    : "Shared ride booking created successfully. Waiting for passengers going along the same route...";
                res.status(201).json({
                    success: true,
                    message: responseMessage,
                    data: {
                        ...booking,
                        sharedRideStatus: {
                            hasPartners,
                            partnerCount: hasPartners ? compatibleRides[0].currentPassengers : 0,
                            routeSimilarity: hasPartners ? compatibleRides[0].routeSimilarity : null,
                            waitingForPartners: !hasPartners,
                            estimatedSavings: hasPartners ? booking.serviceData?.estimatedSavings : 0,
                        }
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Create shared ride error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create shared ride booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createDayBooking = async (req, res) => {
            try {
                const userId = req.user.id;
                const { scheduledAt, duration, serviceArea, driverId, specialRequirements, contactPhone, pickupLatitude, pickupLongitude } = req.body;
                logger_1.default.info(`🚐 Enhanced day booking request from user ${userId} for driver ${driverId}`);
                // Validate user subscription tier
                const customerProfile = await database_1.default.customerProfile.findUnique({
                    where: { userId },
                });
                if (!customerProfile || !["PREMIUM", "ENTERPRISE"].includes(customerProfile.subscriptionTier)) {
                    return res.status(403).json({
                        success: false,
                        message: "Day booking requires Premium or Enterprise subscription",
                    });
                }
                // Use enhanced DayBookingService with webhook integration
                const booking = await this.dayBookingService.createDayBooking({
                    customerId: userId,
                    driverId,
                    scheduledAt: new Date(scheduledAt),
                    duration,
                    serviceArea,
                    specialRequirements,
                    contactPhone,
                    pickupLatitude,
                    pickupLongitude,
                });
                logger_1.default.info(`✅ Enhanced day booking ${booking.id} created successfully with webhook integration`);
                res.status(201).json({
                    success: true,
                    message: "Enhanced day booking created successfully with real-time monitoring",
                    data: {
                        ...booking,
                        webhookEnabled: true,
                        realTimeTracking: true,
                        automaticReassignment: true,
                        safetyFeatures: true,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Enhanced day booking creation error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create enhanced day booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createStoreDelivery = async (req, res) => {
            try {
                const userId = req.user.id;
                const { storeId, deliveryAddress, orderItems, deliveryInstructions, paymentMethodId } = req.body;
                // Get store information
                const store = await database_1.default.store.findUnique({
                    where: { id: storeId },
                    include: {
                        location: true,
                        products: true,
                    },
                });
                if (!store || !store.isActive) {
                    return res.status(404).json({
                        success: false,
                        message: "Store not found or inactive",
                    });
                }
                // Calculate order total and delivery fee
                let orderTotal = 0;
                const validatedItems = [];
                for (const item of orderItems) {
                    const product = store.products.find((p) => p.id === item.productId);
                    if (!product) {
                        return res.status(400).json({
                            success: false,
                            message: `Product ${item.productId} not available`,
                        });
                    }
                    const itemTotal = product.price * item.quantity;
                    orderTotal += itemTotal;
                    validatedItems.push({
                        productId: product.id,
                        name: product.name,
                        quantity: item.quantity,
                        unitPrice: product.price,
                        totalPrice: itemTotal,
                    });
                }
                // Calculate delivery fee using delivery estimate
                const deliveryEstimate = await this.pricingService.calculateDeliveryEstimate({
                    pickupLatitude: store.location.latitude,
                    pickupLongitude: store.location.longitude,
                    dropoffLatitude: deliveryAddress.latitude,
                    dropoffLongitude: deliveryAddress.longitude,
                });
                const totalAmount = orderTotal + deliveryEstimate.estimatedPrice;
                // Create store delivery booking
                const booking = await database_1.default.booking.create({
                    data: {
                        bookingNumber: await this.generateBookingNumber(),
                        customerId: userId,
                        serviceTypeId: await this.getServiceTypeId("STORE_DELIVERY"),
                        status: "CONFIRMED",
                        type: "IMMEDIATE",
                        pickupLatitude: store.location.latitude,
                        pickupLongitude: store.location.longitude,
                        dropoffLatitude: deliveryAddress.latitude,
                        dropoffLongitude: deliveryAddress.longitude,
                        estimatedPrice: totalAmount,
                        finalPrice: totalAmount,
                        currency: "GHS",
                        serviceData: {
                            storeId,
                            storeName: store.name,
                            orderItems: validatedItems,
                            deliveryInstructions,
                            orderTotal,
                            deliveryFee: deliveryEstimate.estimatedPrice,
                            preparationTime: 20,
                        },
                        platformCommission: totalAmount * 0.18,
                        providerEarning: deliveryEstimate.estimatedPrice * 0.82,
                    },
                });
                // Create order items
                for (const item of validatedItems) {
                    await database_1.default.orderItem.create({
                        data: {
                            bookingId: booking.id,
                            name: item.name,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice,
                        },
                    });
                }
                // Update product stock
                for (const item of orderItems) {
                    await database_1.default.product.update({
                        where: { id: item.productId },
                        data: {
                            stockQuantity: {
                                decrement: item.quantity,
                            },
                        },
                    });
                }
                // Notify store owner
                await this.notificationService.notifyCustomer(store.ownerId, {
                    type: "NEW_ORDER",
                    title: "New Order Received",
                    body: `New order worth GH₵${totalAmount}`,
                    data: {
                        bookingId: booking.id,
                        orderTotal: totalAmount,
                    },
                });
                res.status(201).json({
                    success: true,
                    message: "Store delivery booking created successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Create store delivery error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create store delivery booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getBookings = async (req, res) => {
            try {
                const userId = req.user.id;
                const { status, serviceType, dateFrom, dateTo, page = 1, limit = 10, role = "customer" } = req.query;
                const skip = (Number(page) - 1) * Number(limit);
                const where = {};
                if (role === "customer") {
                    where.customerId = userId;
                }
                else {
                    where.providerId = userId;
                }
                if (status) {
                    where.status = status;
                }
                if (serviceType) {
                    where.serviceType = { name: serviceType };
                }
                if (dateFrom || dateTo) {
                    where.createdAt = {};
                    if (dateFrom)
                        where.createdAt.gte = new Date(dateFrom);
                    if (dateTo)
                        where.createdAt.lte = new Date(dateTo);
                }
                const [bookings, total] = await Promise.all([
                    database_1.default.booking.findMany({
                        where,
                        include: {
                            serviceType: true,
                            customer: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    phone: true,
                                    avatar: true,
                                },
                            },
                            provider: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    phone: true,
                                    avatar: true,
                                },
                            },
                        },
                        orderBy: { createdAt: "desc" },
                        skip,
                        take: Number(limit),
                    }),
                    database_1.default.booking.count({ where }),
                ]);
                res.json({
                    success: true,
                    message: "Bookings retrieved successfully",
                    data: bookings,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        totalPages: Math.ceil(total / Number(limit)),
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Get bookings error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve bookings",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getBookingById = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const userId = req.user.id;
                const booking = await database_1.default.booking.findUnique({
                    where: { id: bookingId },
                    include: {
                        serviceType: true,
                        customer: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                                avatar: true,
                            },
                        },
                        provider: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                                avatar: true,
                            },
                        },
                        trackingUpdates: {
                            orderBy: { timestamp: "desc" },
                            take: 10,
                        },
                        orderItems: true,
                        transactions: true,
                    },
                });
                if (!booking) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found",
                    });
                }
                // Check if user has access to this booking
                if (booking.customerId !== userId && booking.providerId !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: "Access denied",
                    });
                }
                res.json({
                    success: true,
                    message: "Booking retrieved successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Get booking by ID error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getBookingEstimate = async (req, res) => {
            try {
                const { serviceType, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, rideType, scheduledAt } = req.body;
                console.log("📡 Backend: Received estimate request:", {
                    serviceType,
                    pickupLatitude,
                    pickupLongitude,
                    dropoffLatitude,
                    dropoffLongitude,
                    rideType,
                    scheduledAt,
                    userId: req.user?.id
                });
                let estimate;
                switch (serviceType) {
                    case "RIDE":
                    case "TAXI":
                        const finalRideType = serviceType === "TAXI" ? "TAXI" : rideType;
                        console.log("📡 Backend: Calculating ride estimate with rideType:", finalRideType);
                        estimate = await this.pricingService.calculateRideEstimate({
                            pickupLatitude,
                            pickupLongitude,
                            dropoffLatitude,
                            dropoffLongitude,
                            rideType: finalRideType,
                            scheduledAt,
                        });
                        console.log("📡 Backend: Ride estimate calculated:", estimate);
                        break;
                    case "DAY_BOOKING":
                        console.log("📡 Backend: Calculating day booking estimate");
                        // For day booking, we need driverId and duration from the request body
                        const { driverId, duration } = req.body;
                        if (!driverId || !duration) {
                            return res.status(400).json({
                                success: false,
                                message: "Driver ID and duration are required for day booking estimation",
                            });
                        }
                        const dayBookingEstimate = await this.pricingService.calculateDayBookingPrice({
                            duration,
                            scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
                            serviceArea: req.body.serviceArea,
                            driverId,
                        });
                        // Convert day booking estimate to ServiceEstimate format
                        estimate = {
                            estimatedPrice: dayBookingEstimate.totalPrice,
                            estimatedDuration: duration * 60, // Convert hours to minutes
                            estimatedDistance: 0, // Not applicable for day booking
                            surgePricing: 1.0, // Day booking uses time multipliers instead
                            availableProviders: 1, // Single driver for day booking
                            breakdown: {
                                basePrice: dayBookingEstimate.breakdown.baseAmount,
                                distancePrice: 0, // No distance cost for day booking
                                timePrice: dayBookingEstimate.breakdown.hourlyRate * dayBookingEstimate.breakdown.duration,
                                surgeAmount: dayBookingEstimate.breakdown.weekendPremium +
                                    dayBookingEstimate.breakdown.peakHoursPremium +
                                    dayBookingEstimate.breakdown.lateNightPremium,
                                serviceFee: 0, // No additional service fee for day booking
                            },
                            stabilityMetrics: dayBookingEstimate.stabilityMetrics,
                        };
                        console.log("📡 Backend: Day booking estimate calculated:", estimate);
                        break;
                    case "STORE_DELIVERY":
                        estimate = await this.pricingService.calculateDeliveryEstimate({
                            pickupLatitude,
                            pickupLongitude,
                            dropoffLatitude,
                            dropoffLongitude,
                        });
                        break;
                    default:
                        return res.status(400).json({
                            success: false,
                            message: "Unsupported service type for estimation",
                        });
                }
                console.log("📡 Backend: Sending estimate response:", {
                    success: true,
                    data: estimate
                });
                res.json({
                    success: true,
                    message: "Estimate calculated successfully",
                    data: estimate,
                });
            }
            catch (error) {
                console.error("📡 Backend: Get booking estimate error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to calculate estimate",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.cancelBooking = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const userId = req.user.id;
                const { reason } = req.body;
                const booking = await database_1.default.booking.findUnique({
                    where: { id: bookingId },
                    include: {
                        customer: true,
                        provider: true,
                    },
                });
                if (!booking) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found",
                    });
                }
                // Check if user can cancel this booking
                if (booking.customerId !== userId && booking.providerId !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: "Access denied",
                    });
                }
                // Check if booking can be cancelled
                if (!["PENDING", "CONFIRMED", "DRIVER_ASSIGNED"].includes(booking.status)) {
                    return res.status(400).json({
                        success: false,
                        message: "Booking cannot be cancelled at this stage",
                    });
                }
                // Calculate cancellation fee if applicable
                const cancellationFee = await this.calculateCancellationFee(booking, userId);
                // Update booking
                const updatedBooking = await database_1.default.booking.update({
                    where: { id: bookingId },
                    data: {
                        status: "CANCELLED",
                        cancelledAt: new Date(),
                        cancellationReason: reason,
                        cancelledBy: userId,
                        cancellationFee,
                    },
                });
                // Update provider availability if assigned
                if (booking.providerId) {
                    await this.updateProviderAvailability(booking.providerId, true);
                }
                // Notify relevant parties
                const isCustomerCancelling = booking.customerId === userId;
                if (isCustomerCancelling && booking.providerId) {
                    await this.notificationService.notifyProvider(booking.providerId, {
                        type: "BOOKING_CANCELLED",
                        title: "Booking Cancelled",
                        body: "A booking has been cancelled by the customer",
                        data: { bookingId: booking.id, reason },
                    });
                }
                else if (!isCustomerCancelling) {
                    await this.notificationService.notifyCustomer(booking.customerId, {
                        type: "BOOKING_CANCELLED",
                        title: "Booking Cancelled",
                        body: "Your booking has been cancelled by the service provider",
                        data: { bookingId: booking.id, reason },
                    });
                }
                res.json({
                    success: true,
                    message: "Booking cancelled successfully",
                    data: updatedBooking,
                });
            }
            catch (error) {
                logger_1.default.error("Cancel booking error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to cancel booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getBookingTracking = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const userId = req.user.id;
                const booking = await database_1.default.booking.findUnique({
                    where: { id: bookingId },
                    include: {
                        trackingUpdates: {
                            orderBy: { timestamp: "desc" },
                        },
                    },
                });
                if (!booking) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found",
                    });
                }
                // Check access
                if (booking.customerId !== userId && booking.providerId !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: "Access denied",
                    });
                }
                res.json({
                    success: true,
                    message: "Tracking data retrieved successfully",
                    data: {
                        bookingId: booking.id,
                        status: booking.status,
                        trackingUpdates: booking.trackingUpdates,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Get booking tracking error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve tracking data",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createTaxiBooking = async (req, res) => {
            try {
                const userId = req.user.id;
                const { pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, taxiZone, pricingType = "METERED", } = req.body;
                // Find available licensed taxi drivers
                const availableTaxis = await this.findAvailableTaxis({
                    latitude: pickupLatitude,
                    longitude: pickupLongitude,
                    radius: 10000,
                });
                if (availableTaxis.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "No taxis available in your area",
                    });
                }
                // Calculate estimated fare using ride estimate
                const estimatedFare = await this.pricingService.calculateRideEstimate({
                    pickupLatitude,
                    pickupLongitude,
                    dropoffLatitude,
                    dropoffLongitude,
                    rideType: "TAXI",
                });
                // Create taxi booking
                const booking = await database_1.default.booking.create({
                    data: {
                        bookingNumber: `TAXI-${await this.generateTaxiNumber()}`,
                        customerId: userId,
                        serviceTypeId: await this.getServiceTypeId("TAXI"),
                        status: "PENDING",
                        type: "IMMEDIATE",
                        pickupLatitude,
                        pickupLongitude,
                        dropoffLatitude,
                        dropoffLongitude,
                        estimatedPrice: estimatedFare.estimatedPrice,
                        currency: "GHS",
                        serviceData: {
                            serviceType: "TAXI",
                            taxiZone,
                            pricingType,
                            regulatoryCompliance: {
                                licenseRequired: true,
                                meterRequired: pricingType === "METERED",
                                receiptRequired: true,
                            },
                            estimatedWaitTime: Math.min(...availableTaxis.map((t) => t.estimatedArrival)),
                        },
                    },
                });
                // Dispatch to nearest taxi
                const nearestTaxi = availableTaxis[0];
                await this.dispatchTaxi(booking.id, nearestTaxi.userId);
                // Send webhook notification for taxi booking request
                try {
                    const driverProfile = await database_1.default.driverProfile.findFirst({
                        where: { userId: nearestTaxi.userId },
                        include: { user: true }
                    });
                    if (driverProfile) {
                        await this.webhookService.notifyTaxiBookingRequest(booking.id, booking, driverProfile);
                    }
                }
                catch (webhookError) {
                    logger_1.default.warn("Failed to send taxi booking request webhook:", webhookError);
                }
                res.status(201).json({
                    success: true,
                    message: "Taxi booking created successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Create taxi booking error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create taxi booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createPackageDelivery = async (req, res) => {
            try {
                const userId = req.user.id;
                const { pickupAddress, dropoffAddress, packageDetails, recipientInfo, scheduledPickup, deliveryInstructions } = req.body;
                // Calculate delivery pricing using delivery estimate
                const pricing = await this.pricingService.calculateDeliveryEstimate({
                    pickupLatitude: pickupAddress.latitude,
                    pickupLongitude: pickupAddress.longitude,
                    dropoffLatitude: dropoffAddress.latitude,
                    dropoffLongitude: dropoffAddress.longitude,
                });
                // Create package delivery booking
                const booking = await database_1.default.booking.create({
                    data: {
                        bookingNumber: await this.generateBookingNumber(),
                        customerId: userId,
                        serviceTypeId: await this.getServiceTypeId("PACKAGE_DELIVERY"),
                        status: "CONFIRMED",
                        type: scheduledPickup ? "SCHEDULED" : "IMMEDIATE",
                        scheduledAt: scheduledPickup ? new Date(scheduledPickup) : null,
                        pickupLatitude: pickupAddress.latitude,
                        pickupLongitude: pickupAddress.longitude,
                        dropoffLatitude: dropoffAddress.latitude,
                        dropoffLongitude: dropoffAddress.longitude,
                        estimatedPrice: pricing.estimatedPrice,
                        finalPrice: pricing.estimatedPrice,
                        currency: "GHS",
                        serviceData: {
                            packageDetails,
                            recipientInfo,
                            deliveryInstructions,
                            trackingNumber: this.generateTrackingNumber(),
                            requiresSignature: packageDetails.requiresSignature || false,
                            isFragile: packageDetails.isFragile || false,
                        },
                    },
                });
                res.status(201).json({
                    success: true,
                    message: "Package delivery booking created successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Create package delivery error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create package delivery booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createFoodDelivery = async (req, res) => {
            try {
                const userId = req.user.id;
                const { restaurantId, deliveryAddress, orderItems, deliveryInstructions, paymentMethodId } = req.body;
                // Get restaurant information from store (assuming restaurants are stores)
                const restaurant = await database_1.default.store.findUnique({
                    where: { id: restaurantId },
                    include: {
                        location: true,
                        products: true, // Using products as menu items
                    },
                });
                if (!restaurant || !restaurant.isActive) {
                    return res.status(404).json({
                        success: false,
                        message: "Restaurant not found or inactive",
                    });
                }
                // Validate and calculate order total
                let orderTotal = 0;
                const validatedItems = [];
                for (const item of orderItems) {
                    const menuItem = restaurant.products.find((mi) => mi.id === item.menuItemId);
                    if (!menuItem) {
                        return res.status(400).json({
                            success: false,
                            message: `Menu item ${item.menuItemId} not available`,
                        });
                    }
                    const itemTotal = menuItem.price * item.quantity;
                    orderTotal += itemTotal;
                    validatedItems.push({
                        menuItemId: menuItem.id,
                        name: menuItem.name,
                        quantity: item.quantity,
                        unitPrice: menuItem.price,
                        totalPrice: itemTotal,
                        specialInstructions: item.specialInstructions,
                    });
                }
                // Calculate delivery fee using delivery estimate
                const deliveryEstimate = await this.pricingService.calculateDeliveryEstimate({
                    pickupLatitude: restaurant.location.latitude,
                    pickupLongitude: restaurant.location.longitude,
                    dropoffLatitude: deliveryAddress.latitude,
                    dropoffLongitude: deliveryAddress.longitude,
                });
                const totalAmount = orderTotal + deliveryEstimate.estimatedPrice;
                // Create food delivery booking
                const booking = await database_1.default.booking.create({
                    data: {
                        bookingNumber: await this.generateBookingNumber(),
                        customerId: userId,
                        serviceTypeId: await this.getServiceTypeId("FOOD_DELIVERY"),
                        status: "CONFIRMED",
                        type: "IMMEDIATE",
                        pickupLatitude: restaurant.location.latitude,
                        pickupLongitude: restaurant.location.longitude,
                        dropoffLatitude: deliveryAddress.latitude,
                        dropoffLongitude: deliveryAddress.longitude,
                        estimatedPrice: totalAmount,
                        finalPrice: totalAmount,
                        currency: "GHS",
                        serviceData: {
                            restaurantId,
                            restaurantName: restaurant.name,
                            orderItems: validatedItems,
                            deliveryInstructions,
                            orderTotal,
                            deliveryFee: deliveryEstimate.estimatedPrice,
                            preparationTime: 25,
                        },
                    },
                });
                // Create order items
                for (const item of validatedItems) {
                    await database_1.default.orderItem.create({
                        data: {
                            bookingId: booking.id,
                            name: item.name,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            instructions: item.specialInstructions,
                            totalPrice: item.totalPrice,
                        },
                    });
                }
                // Notify restaurant
                await this.notificationService.notifyCustomer(restaurant.ownerId, {
                    type: "NEW_FOOD_ORDER",
                    title: "New Food Order",
                    body: `New order worth GH₵${totalAmount}`,
                    data: {
                        bookingId: booking.id,
                        orderTotal: totalAmount,
                        preparationTime: 25,
                    },
                });
                res.status(201).json({
                    success: true,
                    message: "Food delivery booking created successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Create food delivery error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create food delivery booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createHouseMoving = async (req, res) => {
            try {
                const userId = req.user.id;
                const { pickupAddress, dropoffAddress, movingDate, inventoryItems, serviceTier, specialRequirements, movingCompanyId, } = req.body;
                // Calculate comprehensive pricing using day booking price
                const pricing = await this.pricingService.calculateDayBookingPrice({
                    duration: 8, // Assume 8 hours for moving
                    scheduledAt: new Date(movingDate),
                    serviceArea: "CITY",
                    driverId: movingCompanyId,
                });
                // Create house moving booking
                const booking = await database_1.default.booking.create({
                    data: {
                        bookingNumber: await this.generateBookingNumber(),
                        customerId: userId,
                        providerId: movingCompanyId,
                        serviceTypeId: await this.getServiceTypeId("HOUSE_MOVING"),
                        status: "CONFIRMED",
                        type: "SCHEDULED",
                        scheduledAt: new Date(movingDate),
                        pickupLatitude: pickupAddress.latitude,
                        pickupLongitude: pickupAddress.longitude,
                        dropoffLatitude: dropoffAddress.latitude,
                        dropoffLongitude: dropoffAddress.longitude,
                        estimatedPrice: pricing.totalPrice,
                        finalPrice: pricing.totalPrice,
                        currency: "GHS",
                        serviceData: {
                            serviceTier,
                            specialRequirements,
                            inventorySummary: inventoryItems.length,
                            pricingBreakdown: pricing.breakdown,
                            estimatedDuration: 8,
                            crewSize: 4,
                            truckSize: "LARGE",
                        },
                    },
                });
                // Notify moving company
                await this.notificationService.notifyCustomer(movingCompanyId, {
                    type: "NEW_MOVING_JOB",
                    title: "New Moving Job Assigned",
                    body: `New moving job scheduled for ${new Date(movingDate).toDateString()}`,
                    data: {
                        bookingId: booking.id,
                        movingDate,
                        estimatedValue: pricing.totalPrice,
                    },
                });
                res.status(201).json({
                    success: true,
                    message: "House moving booking created successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Create house moving error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create house moving booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getBookingStatus = async (req, res) => {
            try {
                console.log("=== GET BOOKING STATUS REQUEST ===");
                console.log("Request user:", req.user);
                console.log("Request params:", req.params);
                console.log("==================================");
                if (!req.user?.id) {
                    return res.status(401).json({
                        success: false,
                        message: "Authentication required",
                    });
                }
                const userId = req.user.id;
                const bookingId = req.params.id;
                const booking = await database_1.default.booking.findFirst({
                    where: {
                        id: bookingId,
                        customerId: userId,
                    },
                    include: {
                        provider: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                                avatar: true,
                            },
                        },
                        serviceType: true,
                        trackingUpdates: {
                            orderBy: { timestamp: "desc" },
                            take: 10,
                        },
                    },
                });
                if (!booking) {
                    return res.status(404).json({
                        success: false,
                        message: "Booking not found",
                    });
                }
                // Get driver's current location if assigned
                let driverLocation = null;
                if (booking.providerId) {
                    const driverProfile = await database_1.default.driverProfile.findFirst({
                        where: { userId: booking.providerId },
                        select: {
                            currentLatitude: true,
                            currentLongitude: true,
                            rating: true,
                        },
                    });
                    if (driverProfile?.currentLatitude && driverProfile?.currentLongitude) {
                        driverLocation = {
                            latitude: driverProfile.currentLatitude,
                            longitude: driverProfile.currentLongitude,
                        };
                    }
                }
                // Get vehicle details if driver is assigned
                let vehicle = null;
                if (booking.providerId) {
                    const driverProfile = await database_1.default.driverProfile.findFirst({
                        where: { userId: booking.providerId },
                        include: { vehicle: true },
                    });
                    vehicle = driverProfile?.vehicle;
                }
                res.json({
                    success: true,
                    message: "Booking status retrieved successfully",
                    data: {
                        ...booking,
                        driverLocation,
                        vehicle,
                        isDriverAssigned: !!booking.providerId,
                        canCancel: ["PENDING", "DRIVER_ASSIGNED"].includes(booking.status),
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Get booking status error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve booking status",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
    async createInterRegionalRideBooking(params) {
        const { userId, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, rideType, scheduledAt, notes, interRegionalData, } = params;
        // Get service estimate with inter-regional pricing
        const estimate = await this.pricingService.calculateRideEstimate({
            pickupLatitude,
            pickupLongitude,
            dropoffLatitude,
            dropoffLongitude,
            rideType,
        });
        // Add inter-regional fee
        const totalPrice = estimate.estimatedPrice + interRegionalData.additionalFee;
        // Create inter-regional booking using service zone service
        const booking = await this.serviceZoneService.createInterRegionalBooking({
            customerId: userId,
            serviceTypeId: await this.getServiceTypeId("RIDE"),
            pickupLatitude,
            pickupLongitude,
            dropoffLatitude,
            dropoffLongitude,
            originZoneId: interRegionalData.originZone.id,
            destinationZoneId: interRegionalData.destinationZone.id,
            interRegionalFee: interRegionalData.additionalFee,
            estimatedPrice: totalPrice,
            estimatedDistance: estimate.estimatedDistance,
            estimatedDuration: estimate.estimatedDuration,
            requiresApproval: interRegionalData.requiresApproval,
        });
        // Find inter-regional drivers if not requiring approval
        if (!interRegionalData.requiresApproval && !scheduledAt) {
            const availableDrivers = await this.serviceZoneService.findInterRegionalDrivers({
                originZoneId: interRegionalData.originZone.id,
                destinationZoneId: interRegionalData.destinationZone.id,
                latitude: pickupLatitude,
                longitude: pickupLongitude,
                serviceType: rideType,
            });
            // Notify drivers about inter-regional booking
            for (const driver of availableDrivers.slice(0, 3)) {
                await this.notificationService.notifyDriver(driver.driverId, {
                    type: "INTER_REGIONAL_BOOKING_REQUEST",
                    title: "Inter-Regional Ride Request",
                    body: `Inter-regional ${rideType} ride from ${interRegionalData.originZone.name} to ${interRegionalData.destinationZone.name}`,
                    data: {
                        bookingId: booking.id,
                        estimatedEarning: booking.providerEarning,
                        distance: estimate.estimatedDistance,
                        isInterRegional: true,
                        originZone: interRegionalData.originZone.name,
                        destinationZone: interRegionalData.destinationZone.name,
                        interRegionalFee: interRegionalData.additionalFee,
                    },
                });
            }
        }
        return booking;
    }
    async createRegularRideBooking(params) {
        const { userId, pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, rideType, scheduledAt, notes } = params;
        // Get service estimate
        const estimate = await this.pricingService.calculateRideEstimate({
            pickupLatitude,
            pickupLongitude,
            dropoffLatitude,
            dropoffLongitude,
            rideType,
        });
        // Create ride booking
        const booking = await database_1.default.booking.create({
            data: {
                bookingNumber: await this.generateBookingNumber(),
                customerId: userId,
                serviceTypeId: await this.getServiceTypeId("RIDE"),
                status: "PENDING",
                type: scheduledAt ? "SCHEDULED" : "IMMEDIATE",
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                pickupLatitude,
                pickupLongitude,
                dropoffLatitude,
                dropoffLongitude,
                estimatedDistance: estimate.estimatedDistance,
                estimatedDuration: estimate.estimatedDuration,
                estimatedPrice: estimate.estimatedPrice,
                surgePricing: estimate.surgePricing,
                currency: "GHS",
                serviceData: {
                    rideType,
                    surgePricing: estimate.surgePricing,
                    availableDrivers: estimate.availableProviders,
                },
                notes,
                platformCommission: estimate.estimatedPrice * 0.18,
                providerEarning: estimate.estimatedPrice * 0.82,
            },
            include: {
                serviceType: true,
                customer: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                    },
                },
            },
        });
        // Find and notify available drivers
        if (!scheduledAt) {
            const availableDrivers = await this.driverMatchingService.findNearbyDrivers({
                latitude: pickupLatitude,
                longitude: pickupLongitude,
                serviceType: rideType,
            });
            // Notify drivers about new booking
            for (const driver of availableDrivers.slice(0, 5)) {
                await this.notificationService.notifyDriver(driver.driverId, {
                    type: "NEW_BOOKING_REQUEST",
                    title: "New Ride Request",
                    body: `New ${rideType} ride request nearby`,
                    data: {
                        bookingId: booking.id,
                        estimatedEarning: booking.providerEarning,
                        distance: driver.distance,
                    },
                });
                // Send webhook notification for taxi booking request
                try {
                    const driverProfile = await database_1.default.driverProfile.findFirst({
                        where: { userId: driver.driverId },
                        include: { user: true }
                    });
                    if (driverProfile) {
                        await this.webhookService.notifyTaxiBookingRequest(booking.id, booking, driverProfile);
                    }
                }
                catch (webhookError) {
                    logger_1.default.warn("Failed to send taxi booking request webhook:", webhookError);
                }
            }
        }
        return booking;
    }
    // Helper methods
    async generateBookingNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `TRP${timestamp}${random}`;
    }
    async generateTaxiNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 4).toUpperCase();
        return `${timestamp}${random}`;
    }
    generateTrackingNumber() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `TRK${timestamp}${random}`;
    }
    async getServiceTypeId(serviceName) {
        const serviceType = await database_1.default.serviceType.findUnique({
            where: { name: serviceName },
        });
        if (!serviceType) {
            throw new Error(`Service type ${serviceName} not found`);
        }
        return serviceType.id;
    }
    async updateProviderAvailability(providerId, isAvailable) {
        // Update driver profile
        await database_1.default.driverProfile.updateMany({
            where: { userId: providerId },
            data: { isAvailable },
        });
        // Update delivery profile
        await database_1.default.deliveryProfile.updateMany({
            where: { userId: providerId },
            data: { isAvailable },
        });
        // Update mover profile
        await database_1.default.moverProfile.updateMany({
            where: { userId: providerId },
            data: { isAvailable },
        });
    }
    async updateProviderStats(providerId, serviceType, earning) {
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
        switch (serviceType) {
            case "RIDE":
            case "TAXI":
                await database_1.default.driverProfile.updateMany({
                    where: { userId: providerId },
                    data: {
                        totalRides: { increment: 1 },
                        totalEarnings: { increment: earning },
                        monthlyEarnings: { increment: earning },
                        monthlyCommissionDue: { increment: earning * 0.18 },
                    },
                });
                // Create driver earning record
                const driverProfile = await database_1.default.driverProfile.findFirst({
                    where: { userId: providerId },
                });
                if (driverProfile) {
                    await database_1.default.driverEarning.create({
                        data: {
                            driverProfileId: driverProfile.id,
                            amount: earning,
                            commission: earning * 0.18,
                            netEarning: earning * 0.82,
                            date: new Date(),
                            weekStarting: this.getWeekStart(new Date()),
                            monthYear: currentMonth,
                        },
                    });
                }
                break;
            case "STORE_DELIVERY":
            case "FOOD_DELIVERY":
            case "PACKAGE_DELIVERY":
                await database_1.default.deliveryProfile.updateMany({
                    where: { userId: providerId },
                    data: {
                        totalDeliveries: { increment: 1 },
                        totalEarnings: { increment: earning },
                        monthlyEarnings: { increment: earning },
                        monthlyCommissionDue: { increment: earning * 0.18 },
                    },
                });
                // Create delivery earning record
                const deliveryProfile = await database_1.default.deliveryProfile.findFirst({
                    where: { userId: providerId },
                });
                if (deliveryProfile) {
                    await database_1.default.deliveryEarning.create({
                        data: {
                            deliveryProfileId: deliveryProfile.id,
                            amount: earning,
                            commission: earning * 0.18,
                            netEarning: earning * 0.82,
                            date: new Date(),
                            weekStarting: this.getWeekStart(new Date()),
                            monthYear: currentMonth,
                        },
                    });
                }
                break;
            case "HOUSE_MOVING":
                await database_1.default.moverProfile.updateMany({
                    where: { userId: providerId },
                    data: {
                        totalMoves: { increment: 1 },
                        totalEarnings: { increment: earning },
                        monthlyEarnings: { increment: earning },
                        monthlyCommissionDue: { increment: earning * 0.18 },
                    },
                });
                // Create mover earning record
                const moverProfile = await database_1.default.moverProfile.findFirst({
                    where: { userId: providerId },
                });
                if (moverProfile) {
                    await database_1.default.moverEarning.create({
                        data: {
                            moverProfileId: moverProfile.id,
                            amount: earning,
                            commission: earning * 0.18,
                            netEarning: earning * 0.82,
                            date: new Date(),
                            weekStarting: this.getWeekStart(new Date()),
                            monthYear: currentMonth,
                        },
                    });
                }
                break;
        }
    }
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    }
    async calculateCancellationFee(booking, cancelledBy) {
        // No fee for cancellations before driver assignment
        if (booking.status === "PENDING") {
            return 0;
        }
        // Customer cancellation after driver assignment
        if (booking.customerId === cancelledBy && booking.status === "DRIVER_ASSIGNED") {
            return booking.estimatedPrice * 0.1; // 10% cancellation fee
        }
        // Provider cancellation - no fee to customer
        return 0;
    }
    async findCompatibleSharedRides(params) {
        // Find shared rides that are pending and waiting for more passengers
        const availableSharedRides = await database_1.default.booking.findMany({
            where: {
                serviceType: { name: "SHARED_RIDE" },
                status: "PENDING", // Only consider pending shared rides for new joins
                createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, // Last 15 minutes
                serviceData: {
                    path: ["waitingForMorePassengers"],
                    equals: true,
                },
            },
            include: { serviceType: true },
        });
        console.log(`🔍 Found ${availableSharedRides.length} available shared rides`);
        // Filter by route similarity and capacity
        const compatibleRides = [];
        for (const ride of availableSharedRides) {
            const routeSimilarity = this.calculateRouteSimilarity(params.pickupLatitude, params.pickupLongitude, params.dropoffLatitude, params.dropoffLongitude, ride.pickupLatitude, ride.pickupLongitude, ride.dropoffLatitude, ride.dropoffLongitude);
            // Only accept rides with high route similarity (same direction, similar path)
            if (routeSimilarity >= 0.7) { // 70% similarity threshold
                // Check capacity
                const currentPassengers = ride.serviceData?.currentPassengers || 1;
                const maxPassengers = ride.serviceData?.maxPassengers || 4;
                if (currentPassengers < maxPassengers) {
                    compatibleRides.push({
                        ...ride,
                        routeSimilarity,
                        currentPassengers,
                        maxPassengers
                    });
                    console.log(`✅ Compatible ride found: ${ride.id} (similarity: ${(routeSimilarity * 100).toFixed(1)}%)`);
                }
                else {
                    console.log(`❌ Ride ${ride.id} at capacity (${currentPassengers}/${maxPassengers})`);
                }
            }
            else {
                console.log(`❌ Ride ${ride.id} route similarity too low: ${(routeSimilarity * 100).toFixed(1)}%`);
            }
        }
        // Sort by route similarity (best matches first)
        return compatibleRides.sort((a, b) => b.routeSimilarity - a.routeSimilarity);
    }
    /**
     * Calculate route similarity between two routes
     * Returns a value between 0-1 where 1 means identical routes
     */
    calculateRouteSimilarity(pickup1Lat, pickup1Lng, dropoff1Lat, dropoff1Lng, pickup2Lat, pickup2Lng, dropoff2Lat, dropoff2Lng) {
        // Calculate bearing (direction) for both routes
        const bearing1 = this.calculateBearing(pickup1Lat, pickup1Lng, dropoff1Lat, dropoff1Lng);
        const bearing2 = this.calculateBearing(pickup2Lat, pickup2Lng, dropoff2Lat, dropoff2Lng);
        // Calculate bearing difference (0-180 degrees)
        const bearingDiff = Math.abs(bearing1 - bearing2);
        const normalizedBearingDiff = Math.min(bearingDiff, 360 - bearingDiff) / 180; // 0-1 scale
        // Calculate distance between pickup points
        const pickupDistance = this.calculateDistance(pickup1Lat, pickup1Lng, pickup2Lat, pickup2Lng);
        // Calculate distance between dropoff points
        const dropoffDistance = this.calculateDistance(dropoff1Lat, dropoff1Lng, dropoff2Lat, dropoff2Lng);
        // Calculate route lengths
        const route1Length = this.calculateDistance(pickup1Lat, pickup1Lng, dropoff1Lat, dropoff1Lng);
        const route2Length = this.calculateDistance(pickup2Lat, pickup2Lng, dropoff2Lat, dropoff2Lng);
        // Routes should be similar in length (within 50%)
        const lengthRatio = Math.min(route1Length, route2Length) / Math.max(route1Length, route2Length);
        const lengthSimilarity = lengthRatio >= 0.5 ? 1 : lengthRatio * 2;
        // Pickup points should be close (within 2km)
        const pickupSimilarity = pickupDistance <= 2000 ? 1 - (pickupDistance / 2000) : 0;
        // Dropoff points should be close (within 3km)
        const dropoffSimilarity = dropoffDistance <= 3000 ? 1 - (dropoffDistance / 3000) : 0;
        // Bearing should be similar (within 45 degrees)
        const bearingSimilarity = normalizedBearingDiff <= 0.25 ? 1 - (normalizedBearingDiff / 0.25) : 0;
        // Calculate overall similarity (weighted average)
        const similarity = (pickupSimilarity * 0.3 + // 30% weight on pickup proximity
            dropoffSimilarity * 0.3 + // 30% weight on dropoff proximity
            bearingSimilarity * 0.25 + // 25% weight on direction similarity
            lengthSimilarity * 0.15 // 15% weight on route length similarity
        );
        console.log(`🔍 Route similarity calculation:`);
        console.log(`   - Pickup similarity: ${(pickupSimilarity * 100).toFixed(1)}% (${pickupDistance.toFixed(0)}m apart)`);
        console.log(`   - Dropoff similarity: ${(dropoffSimilarity * 100).toFixed(1)}% (${dropoffDistance.toFixed(0)}m apart)`);
        console.log(`   - Bearing similarity: ${(bearingSimilarity * 100).toFixed(1)}% (${(normalizedBearingDiff * 180).toFixed(1)}° difference)`);
        console.log(`   - Length similarity: ${(lengthSimilarity * 100).toFixed(1)}%`);
        console.log(`   - Overall similarity: ${(similarity * 100).toFixed(1)}%`);
        return similarity;
    }
    /**
     * Calculate bearing (direction) between two points in degrees
     */
    calculateBearing(lat1, lng1, lat2, lng2) {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360; // Normalize to 0-360 degrees
    }
    async findAvailableTaxis(params) {
        // Implementation for finding available licensed taxis
        const availableTaxis = await database_1.default.driverProfile.findMany({
            where: {
                isAvailable: true,
                isOnline: true,
                isVerified: true,
                user: {
                    role: "DRIVER",
                },
            },
            include: {
                user: true,
                vehicle: true,
            },
        });
        // Filter by distance and add estimated arrival time
        return availableTaxis
            .map((taxi) => {
            const distance = this.calculateDistance(params.latitude, params.longitude, taxi.currentLatitude || 0, taxi.currentLongitude || 0);
            return {
                ...taxi,
                distance,
                estimatedArrival: Math.ceil(distance / 500), // Assuming 30km/h average speed
            };
        })
            .filter((taxi) => taxi.distance <= params.radius)
            .sort((a, b) => a.distance - b.distance);
    }
    async dispatchTaxi(bookingId, driverId) {
        // Update booking with assigned driver
        await database_1.default.booking.update({
            where: { id: bookingId },
            data: {
                providerId: driverId,
                status: "DRIVER_ASSIGNED",
                acceptedAt: new Date(),
            },
        });
        // Update driver availability
        await database_1.default.driverProfile.updateMany({
            where: { userId: driverId },
            data: {
                isAvailable: false,
            },
        });
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
exports.BookingController = BookingController;
