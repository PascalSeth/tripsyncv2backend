"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovingController = void 0;
const database_1 = __importDefault(require("../config/database"));
const moving_service_1 = require("../services/moving.service");
const pricing_service_1 = require("../services/pricing.service");
const notification_service_1 = require("../services/notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
const bcrypt_1 = __importDefault(require("bcrypt"));
class MovingController {
    constructor() {
        this.movingService = new moving_service_1.MovingService();
        this.pricingService = new pricing_service_1.PricingService();
        this.notificationService = new notification_service_1.NotificationService();
        this.onboardMover = async (req, res) => {
            try {
                const { 
                // User data for new user creation
                firstName, lastName, email, phone, password, 
                // Mover profile data
                companyName, teamSize, hasEquipment, hourlyRate, maxWeight, hasPackingService, hasStorageService, hasDisassemblyService, equipment, serviceAreas, certifications, 
                // Optional: if user is already authenticated
                userId: existingUserId, } = req.body;
                let userId = existingUserId || req.user?.id;
                // If no userId provided, create a new user
                if (!userId) {
                    if (!firstName || !lastName || !email || !phone || !password) {
                        return res.status(400).json({
                            success: false,
                            message: "User details (firstName, lastName, email, phone, password) are required for new user creation",
                        });
                    }
                    // Validate user data
                    const userValidation = this.validateUserData({ firstName, lastName, email, phone, password });
                    if (!userValidation.isValid) {
                        return res.status(400).json({
                            success: false,
                            message: "Invalid user data",
                            errors: userValidation.errors,
                        });
                    }
                    // Check if user already exists
                    const existingUser = await database_1.default.user.findFirst({
                        where: {
                            OR: [{ email }, { phone }],
                        },
                    });
                    if (existingUser) {
                        return res.status(400).json({
                            success: false,
                            message: "User with this email or phone already exists",
                        });
                    }
                    // Hash password
                    const hashedPassword = await bcrypt_1.default.hash(password, 10);
                    // Generate referral code
                    const referralCode = this.generateReferralCode();
                    // Create new user
                    const newUser = await database_1.default.user.create({
                        data: {
                            firstName,
                            lastName,
                            email,
                            phone,
                            passwordHash: hashedPassword,
                            role: "HOUSE_MOVER", // Set as DRIVER role for service providers
                            isVerified: false,
                            isActive: true,
                            referralCode,
                        },
                    });
                    userId = newUser.id;
                    // Send welcome notification
                    await this.notificationService.notifyCustomer(userId, {
                        type: "WELCOME",
                        title: "Welcome to Our Platform",
                        body: "Your account has been created successfully. Complete your mover profile to start accepting jobs.",
                        priority: "STANDARD",
                    });
                }
                // Check if mover profile already exists
                const existingProfile = await database_1.default.moverProfile.findUnique({
                    where: { userId },
                });
                if (existingProfile) {
                    return res.status(400).json({
                        success: false,
                        message: "Mover profile already exists for this user",
                    });
                }
                // Validate mover profile data
                const profileValidation = this.validateMoverProfileData({ companyName, teamSize, hourlyRate, maxWeight });
                if (!profileValidation.isValid) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid mover profile data",
                        errors: profileValidation.errors,
                    });
                }
                // Create mover profile
                const moverProfile = await database_1.default.moverProfile.create({
                    data: {
                        userId,
                        companyName,
                        teamSize: Number.parseInt(teamSize),
                        hasEquipment: hasEquipment || false,
                        isAvailable: false,
                        isOnline: false,
                        rating: 5.0,
                        totalMoves: 0,
                        totalEarnings: 0,
                        isVerified: false,
                        verificationStatus: "PENDING",
                        hourlyRate: Number.parseFloat(hourlyRate),
                        maxWeight: maxWeight ? Number.parseFloat(maxWeight) : null,
                        hasPackingService: hasPackingService || false,
                        hasStorageService: hasStorageService || false,
                        hasDisassemblyService: hasDisassemblyService || false,
                        equipment: equipment ? JSON.stringify(equipment) : undefined,
                        monthlyEarnings: 0,
                        monthlyCommissionDue: 0,
                        commissionStatus: "CURRENT",
                    },
                });
                // Update user role to ensure it's set correctly
                await database_1.default.user.update({
                    where: { id: userId },
                    data: { role: "DRIVER" },
                });
                // Create service areas if provided
                // if (serviceAreas && Array.isArray(serviceAreas)) {
                //   for (const area of serviceAreas) {
                //     // Note: Assuming you have a serviceArea table or similar
                //     // This would need to be adjusted based on your actual schema
                //     await prisma.location.create({
                //       data: {
                //         name: area.name,
                //         coordinates: area.coordinates ? JSON.stringify(area.coordinates) : null,
                //         isActive: true,
                //         // Add other required fields based on your schema
                //       },
                //     })
                //   }
                // }
                // Send verification notification
                await this.notificationService.notifyCustomer(userId, {
                    type: "MOVER_ONBOARDING",
                    title: "Mover Application Submitted",
                    body: "Your mover application has been submitted for review. You will be notified once approved.",
                    priority: "STANDARD",
                });
                // Get the complete profile with user data for response
                const completeProfile = await database_1.default.moverProfile.findUnique({
                    where: { id: moverProfile.id },
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true,
                                role: true,
                                isVerified: true,
                                isActive: true,
                            },
                        },
                    },
                });
                res.status(201).json({
                    success: true,
                    message: "Mover onboarded successfully",
                    data: {
                        profile: completeProfile,
                        isNewUser: !existingUserId && !req.user?.id,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Mover onboarding error:", error);
                // Handle specific database errors
                if (error.code === "P2002") {
                    return res.status(400).json({
                        success: false,
                        message: "A user with this email or phone already exists",
                    });
                }
                res.status(500).json({
                    success: false,
                    message: "Mover onboarding failed",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createMovingBooking = async (req, res) => {
            try {
                const userId = req.user.id;
                const { pickupAddress, dropoffAddress, movingDate, inventoryItems, serviceTier, specialRequirements, movingCompanyId, estimatedWeight, estimatedVolume, requiresPacking, requiresStorage, requiresDisassembly, } = req.body;
                // Calculate moving quote
                const quote = await this.movingService.calculateMovingQuote({
                    pickupAddress,
                    dropoffAddress,
                    inventoryItems,
                    serviceTier,
                    estimatedWeight,
                    estimatedVolume,
                    requiresPacking,
                    requiresStorage,
                    requiresDisassembly,
                    movingDate: new Date(movingDate),
                });
                // Create moving booking
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
                        estimatedPrice: quote.totalPrice,
                        finalPrice: quote.totalPrice,
                        currency: "NGN",
                        serviceData: {
                            serviceTier,
                            specialRequirements,
                            inventorySummary: inventoryItems.length,
                            estimatedWeight,
                            estimatedVolume,
                            requiresPacking,
                            requiresStorage,
                            requiresDisassembly,
                            pricingBreakdown: quote.breakdown,
                            estimatedDuration: quote.estimatedDuration,
                            crewSize: quote.crewSize,
                            truckSize: quote.truckSize,
                        },
                        platformCommission: quote.totalPrice * 0.15,
                        providerEarning: quote.totalPrice * 0.85,
                    },
                    include: {
                        provider: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                            },
                        },
                    },
                });
                // Create inventory items
                for (const item of inventoryItems) {
                    await database_1.default.movingInventoryItem.create({
                        data: {
                            bookingId: booking.id,
                            name: item.name,
                            description: item.description,
                            quantity: item.quantity,
                            weight: item.weight,
                            dimensions: item.dimensions ? JSON.stringify(item.dimensions) : undefined,
                            isFragile: item.isFragile || false,
                            isValuable: item.isValuable || false,
                            estimatedValue: item.estimatedValue,
                        },
                    });
                }
                // Notify moving company
                if (movingCompanyId) {
                    await this.notificationService.notifyCustomer(movingCompanyId, {
                        type: "NEW_MOVING_JOB",
                        title: "New Moving Job Assigned",
                        body: `New moving job scheduled for ${new Date(movingDate).toDateString()}`,
                        data: {
                            bookingId: booking.id,
                            movingDate,
                            estimatedValue: quote.totalPrice,
                        },
                        priority: "STANDARD",
                    });
                }
                res.status(201).json({
                    success: true,
                    message: "Moving booking created successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Create moving booking error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create moving booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getMovingQuote = async (req, res) => {
            try {
                const quoteData = req.body;
                const quote = await this.movingService.calculateMovingQuote(quoteData);
                res.json({
                    success: true,
                    message: "Moving quote calculated successfully",
                    data: quote,
                });
            }
            catch (error) {
                logger_1.default.error("Get moving quote error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to calculate moving quote",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getAvailableMovers = async (req, res) => {
            try {
                const { latitude, longitude, movingDate, serviceTier, estimatedWeight, radius = 50000 } = req.query;
                if (!latitude || !longitude || !movingDate) {
                    return res.status(400).json({
                        success: false,
                        message: "Latitude, longitude, and moving date are required",
                    });
                }
                const movers = await this.movingService.getAvailableMovers({
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    movingDate: new Date(movingDate),
                    serviceTier: serviceTier,
                    estimatedWeight: estimatedWeight ? Number(estimatedWeight) : undefined,
                    radius: Number(radius),
                });
                res.json({
                    success: true,
                    message: "Available movers retrieved successfully",
                    data: movers,
                });
            }
            catch (error) {
                logger_1.default.error("Get available movers error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve available movers",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateMoverAvailability = async (req, res) => {
            try {
                const userId = req.user.id;
                const { isAvailable, isOnline } = req.body;
                const moverProfile = await database_1.default.moverProfile.updateMany({
                    where: { userId },
                    data: {
                        isAvailable,
                        isOnline,
                    },
                });
                if (moverProfile.count === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Mover profile not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Mover availability updated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Update mover availability error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update mover availability",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.acceptMovingJob = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const moverId = req.user.id;
                const booking = await this.movingService.acceptMovingJob(bookingId, moverId);
                res.json({
                    success: true,
                    message: "Moving job accepted successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Accept moving job error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to accept moving job",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.startMovingJob = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const moverId = req.user.id;
                const { crewMembers, equipmentUsed } = req.body;
                const booking = await this.movingService.startMovingJob(bookingId, {
                    moverId,
                    crewMembers,
                    equipmentUsed,
                });
                res.json({
                    success: true,
                    message: "Moving job started successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Start moving job error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to start moving job",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.completeMovingJob = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const moverId = req.user.id;
                const { actualDuration, finalPrice, damageReport, customerSignature, additionalServices } = req.body;
                const booking = await this.movingService.completeMovingJob(bookingId, {
                    moverId,
                    actualDuration,
                    finalPrice,
                    damageReport,
                    customerSignature,
                    additionalServices,
                });
                res.json({
                    success: true,
                    message: "Moving job completed successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Complete moving job error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to complete moving job",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getMovingBookings = async (req, res) => {
            try {
                const userId = req.user.id;
                const { page = 1, limit = 10, status, dateFrom, dateTo, role = "customer" } = req.query;
                const bookings = await this.movingService.getMovingBookings(userId, {
                    page: Number(page),
                    limit: Number(limit),
                    status: status,
                    dateFrom: dateFrom,
                    dateTo: dateTo,
                    role: role,
                });
                res.json({
                    success: true,
                    message: "Moving bookings retrieved successfully",
                    data: bookings,
                });
            }
            catch (error) {
                logger_1.default.error("Get moving bookings error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve moving bookings",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getMoverProfile = async (req, res) => {
            try {
                const userId = req.user.id;
                const profile = await database_1.default.moverProfile.findUnique({
                    where: { userId },
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true,
                                avatar: true,
                            },
                        },
                    },
                });
                if (!profile) {
                    return res.status(404).json({
                        success: false,
                        message: "Mover profile not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Mover profile retrieved successfully",
                    data: profile,
                });
            }
            catch (error) {
                logger_1.default.error("Get mover profile error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve mover profile",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateMoverProfile = async (req, res) => {
            try {
                const userId = req.user.id;
                const updateData = req.body;
                const profile = await database_1.default.moverProfile.updateMany({
                    where: { userId },
                    data: updateData,
                });
                if (profile.count === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Mover profile not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Mover profile updated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Update mover profile error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update mover profile",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getMoverEarnings = async (req, res) => {
            try {
                const userId = req.user.id;
                const { period = "month", startDate, endDate } = req.query;
                const earnings = await this.movingService.getMoverEarnings(userId, {
                    period: period,
                    startDate: startDate,
                    endDate: endDate,
                });
                res.json({
                    success: true,
                    message: "Mover earnings retrieved successfully",
                    data: earnings,
                });
            }
            catch (error) {
                logger_1.default.error("Get mover earnings error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve mover earnings",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getMoverAnalytics = async (req, res) => {
            try {
                const userId = req.user.id;
                const analytics = await this.movingService.getMoverAnalytics(userId);
                res.json({
                    success: true,
                    message: "Mover analytics retrieved successfully",
                    data: analytics,
                });
            }
            catch (error) {
                logger_1.default.error("Get mover analytics error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve mover analytics",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Admin functions
        this.getAllMovers = async (req, res) => {
            try {
                const { page = 1, limit = 20, verificationStatus, isAvailable } = req.query;
                const where = {};
                if (verificationStatus)
                    where.verificationStatus = verificationStatus;
                if (isAvailable !== undefined)
                    where.isAvailable = isAvailable === "true";
                const movers = await database_1.default.moverProfile.findMany({
                    where,
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                email: true,
                                phone: true,
                                avatar: true,
                            },
                        },
                    },
                    skip: (Number(page) - 1) * Number(limit),
                    take: Number(limit),
                    orderBy: { id: "desc" },
                });
                const total = await database_1.default.moverProfile.count({ where });
                res.json({
                    success: true,
                    message: "Movers retrieved successfully",
                    data: movers,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        totalPages: Math.ceil(total / Number(limit)),
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Get all movers error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve movers",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.verifyMover = async (req, res) => {
            try {
                const moverId = req.params.id;
                const mover = await database_1.default.moverProfile.update({
                    where: { id: moverId },
                    data: {
                        isVerified: true,
                        verificationStatus: "APPROVED",
                    },
                    include: { user: true },
                });
                // Send verification notification
                await this.notificationService.notifyCustomer(mover.userId, {
                    type: "MOVER_VERIFIED",
                    title: "Mover Application Approved",
                    body: "Your mover application has been approved. You can now accept moving jobs.",
                    priority: "STANDARD",
                });
                res.json({
                    success: true,
                    message: "Mover verified successfully",
                    data: mover,
                });
            }
            catch (error) {
                logger_1.default.error("Verify mover error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to verify mover",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.suspendMover = async (req, res) => {
            try {
                const moverId = req.params.id;
                const { reason } = req.body;
                const mover = await database_1.default.moverProfile.update({
                    where: { id: moverId },
                    data: {
                        isVerified: false,
                        verificationStatus: "REJECTED",
                        isAvailable: false,
                        isOnline: false,
                    },
                    include: { user: true },
                });
                // Send suspension notification
                await this.notificationService.notifyCustomer(mover.userId, {
                    type: "MOVER_SUSPENDED",
                    title: "Account Suspended",
                    body: `Your mover account has been suspended. Reason: ${reason}`,
                    priority: "CRITICAL",
                });
                res.json({
                    success: true,
                    message: "Mover suspended successfully",
                    data: mover,
                });
            }
            catch (error) {
                logger_1.default.error("Suspend mover error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to suspend mover",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
    async generateBookingNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `MOV${timestamp}${random}`;
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
    generateReferralCode() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    // Helper method to validate mover profile data
    validateMoverProfileData(data) {
        const errors = [];
        if (!data.companyName || data.companyName.trim().length < 2) {
            errors.push("Company name must be at least 2 characters long");
        }
        if (!data.teamSize || data.teamSize < 1 || data.teamSize > 50) {
            errors.push("Team size must be between 1 and 50");
        }
        if (data.hourlyRate === undefined || data.hourlyRate < 1000 || data.hourlyRate > 100000) {
            errors.push("Hourly rate must be between ₦1,000 and ₦100,000");
        }
        if (data.maxWeight && (data.maxWeight < 10 || data.maxWeight > 10000)) {
            errors.push("Maximum weight capacity must be between 10kg and 10,000kg");
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    // Helper method to validate user data
    validateUserData(data) {
        const errors = [];
        if (!data.firstName || data.firstName.trim().length < 2) {
            errors.push("First name must be at least 2 characters long");
        }
        if (!data.lastName || data.lastName.trim().length < 2) {
            errors.push("Last name must be at least 2 characters long");
        }
        if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push("Valid email address is required");
        }
        if (!data.phone || !/^\+?[\d\s\-()]{10,}$/.test(data.phone)) {
            errors.push("Valid phone number is required");
        }
        if (!data.password || data.password.length < 6) {
            errors.push("Password must be at least 6 characters long");
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}
exports.MovingController = MovingController;
