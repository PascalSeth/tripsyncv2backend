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
exports.TaxiDriverController = void 0;
const taxi_driver_service_1 = require("../services/taxi-driver.service");
const file_upload_service_1 = require("../services/file-upload.service");
const webhook_service_1 = require("../services/webhook.service");
const logger_1 = __importDefault(require("../utils/logger"));
class TaxiDriverController {
    constructor() {
        this.taxiDriverService = new taxi_driver_service_1.TaxiDriverService();
        this.fileUploadService = new file_upload_service_1.FileUploadService();
        this.webhookService = new webhook_service_1.WebhookService();
    }
    async onboardTaxiDriver(req, res) {
        try {
            // Handle both authenticated and unauthenticated cases
            let userId = req.user?.id;
            // If no authenticated user, this is a new user signup
            if (!userId) {
                console.log("=== NEW TAXI DRIVER SIGNUP ===");
                console.log("Creating new user for taxi driver onboarding");
                const { email, phone, firstName, lastName, password, dateOfBirth, gender, licenseNumber, licenseExpiry, licenseClass, vehicleInfo, currentLatitude, currentLongitude, preferredServiceZones, acceptsSharedRides = true, acceptsCash = true, maxRideDistance, isAvailableForDayBooking = false, canAcceptInterRegional = false, } = req.body;
                // Validate required fields
                if (!email || !phone || !firstName || !lastName) {
                    return res.status(400).json({
                        success: false,
                        message: "Email, phone, firstName, and lastName are required for new taxi driver registration",
                    });
                }
                // Check if user already exists
                const existingUser = await Promise.resolve().then(() => __importStar(require("../config/database"))).then(({ default: prisma }) => prisma.user.findFirst({
                    where: {
                        OR: [{ email }, { phone }],
                    },
                }));
                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: "User already exists with this email or phone",
                    });
                }
                // Create new user
                const prisma = (await Promise.resolve().then(() => __importStar(require("../config/database")))).default;
                const bcrypt = (await Promise.resolve().then(() => __importStar(require("bcryptjs")))).default;
                const referralCode = `TAXI${Date.now().toString().slice(-6)}`;
                const newUser = await prisma.user.create({
                    data: {
                        email,
                        phone,
                        firstName,
                        lastName,
                        passwordHash: password ? await bcrypt.hash(password, 12) : null,
                        gender: gender || null,
                        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                        role: "TAXI_DRIVER",
                        referralCode,
                        isActive: true,
                        isVerified: false,
                        subscriptionStatus: "ACTIVE",
                        subscriptionTier: "BASIC",
                        nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        commissionBalance: 0,
                        isCommissionCurrent: true,
                    },
                });
                userId = newUser.id;
                console.log("✅ New user created for taxi driver:", userId);
            }
            const taxiDriverProfile = await this.taxiDriverService.onboardTaxiDriver(userId, req.body);
            res.status(201).json({
                success: true,
                message: userId === req.user?.id
                    ? "Taxi driver profile added to existing user successfully"
                    : "Taxi driver onboarded successfully",
                data: taxiDriverProfile,
            });
        }
        catch (error) {
            console.log("=== TAXI DRIVER ONBOARDING ERROR ===");
            console.log("Error details:", error);
            logger_1.default.error("Onboard taxi driver error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to onboard taxi driver",
            });
        }
    }
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const updatedProfile = await this.taxiDriverService.updateProfile(userId, req.body);
            res.json({
                success: true,
                message: "Profile updated successfully",
                data: updatedProfile,
            });
        }
        catch (error) {
            logger_1.default.error("Update taxi driver profile error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to update profile",
            });
        }
    }
    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            const profile = await this.taxiDriverService.getProfile(userId);
            res.json({
                success: true,
                data: profile,
            });
        }
        catch (error) {
            logger_1.default.error("Get taxi driver profile error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to get profile",
            });
        }
    }
    async addVehicle(req, res) {
        try {
            const userId = req.user.id;
            const vehicle = await this.taxiDriverService.addVehicle(userId, req.body);
            res.status(201).json({
                success: true,
                message: "Vehicle added successfully",
                data: vehicle,
            });
        }
        catch (error) {
            logger_1.default.error("Add taxi vehicle error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to add vehicle",
            });
        }
    }
    async updateVehicle(req, res) {
        try {
            const userId = req.user.id;
            const vehicleId = req.params.id;
            const vehicle = await this.taxiDriverService.updateVehicle(userId, vehicleId, req.body);
            res.json({
                success: true,
                message: "Vehicle updated successfully",
                data: vehicle,
            });
        }
        catch (error) {
            logger_1.default.error("Update taxi vehicle error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to update vehicle",
            });
        }
    }
    async getVehicles(req, res) {
        try {
            const userId = req.user.id;
            const vehicles = await this.taxiDriverService.getVehicles(userId);
            res.json({
                success: true,
                data: vehicles,
            });
        }
        catch (error) {
            logger_1.default.error("Get taxi vehicles error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to get vehicles",
            });
        }
    }
    async uploadDocument(req, res) {
        try {
            const userId = req.user.id;
            // Handle file upload
            const file = req.file;
            if (!file) {
                return res.status(400).json({
                    success: false,
                    message: "Document file is required",
                });
            }
            const documentUrl = await this.fileUploadService.uploadDocument(file, `taxi-drivers/${userId}`);
            const document = await this.taxiDriverService.uploadDocument(userId, {
                ...req.body,
                documentUrl,
            });
            res.status(201).json({
                success: true,
                message: "Document uploaded successfully",
                data: document,
            });
        }
        catch (error) {
            logger_1.default.error("Upload taxi document error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to upload document",
            });
        }
    }
    async getDocuments(req, res) {
        try {
            const userId = req.user.id;
            const documents = await this.taxiDriverService.getDocuments(userId);
            res.json({
                success: true,
                data: documents,
            });
        }
        catch (error) {
            logger_1.default.error("Get taxi documents error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to get documents",
            });
        }
    }
    async updateAvailability(req, res) {
        try {
            const userId = req.user.id;
            const profile = await this.taxiDriverService.updateAvailability(userId, req.body);
            // Send webhook notification for availability change
            try {
                await this.webhookService.notifyTaxiDriverAvailabilityChange(userId, profile.isAvailable || false, profile.isOnline || false);
            }
            catch (webhookError) {
                logger_1.default.warn("Failed to send taxi driver availability webhook:", webhookError);
            }
            res.json({
                success: true,
                message: "Availability updated successfully",
                data: profile,
            });
        }
        catch (error) {
            logger_1.default.error("Update taxi availability error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to update availability",
            });
        }
    }
    async updateLocation(req, res) {
        try {
            const userId = req.user.id;
            await this.taxiDriverService.updateLocation(userId, req.body);
            // Send webhook notification for location update
            try {
                await this.webhookService.notifyTaxiDriverLocationUpdate(userId, req.body);
            }
            catch (webhookError) {
                logger_1.default.warn("Failed to send taxi driver location webhook:", webhookError);
            }
            res.json({
                success: true,
                message: "Location updated successfully",
            });
        }
        catch (error) {
            logger_1.default.error("Update taxi location error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to update location",
            });
        }
    }
    async updateOperatingHours(req, res) {
        try {
            const userId = req.user.id;
            const profile = await this.taxiDriverService.updateOperatingHours(userId, req.body.operatingHours);
            res.json({
                success: true,
                message: "Operating hours updated successfully",
                data: profile,
            });
        }
        catch (error) {
            logger_1.default.error("Update operating hours error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to update operating hours",
            });
        }
    }
    async getBookings(req, res) {
        try {
            const userId = req.user.id;
            const bookings = await this.taxiDriverService.getTaxiDriverBookings(userId, req.query);
            res.json({
                success: true,
                data: bookings,
            });
        }
        catch (error) {
            logger_1.default.error("Get taxi bookings error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to get bookings",
            });
        }
    }
    async acceptBooking(req, res) {
        try {
            const userId = req.user.id;
            const bookingId = req.params.id;
            const booking = await this.taxiDriverService.acceptBooking(userId, bookingId);
            // Emit WebSocket events
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                // Get the booking with driver information
                const prisma = (await Promise.resolve().then(() => __importStar(require("../config/database")))).default;
                const bookingWithDriver = await prisma.booking.findUnique({
                    where: { id: bookingId },
                    include: {
                        provider: {
                            include: {
                                taxiDriverProfile: {
                                    include: {
                                        vehicle: true,
                                    },
                                },
                            },
                        },
                    },
                });
                // Emit role-specific booking accepted event to driver
                await io.notifyUser(userId, "taxi_booking_accepted", {
                    bookingId: bookingId,
                    customer: {
                        name: "Customer Name", // You can get this from booking.customer
                    },
                    message: "Booking accepted successfully",
                    timestamp: new Date(),
                });
                // Emit booking_update with DRIVER_ASSIGNED to booking room for customer
                const updateData = {
                    bookingId: bookingId,
                    status: "DRIVER_ASSIGNED",
                    message: "Driver has been assigned to your booking",
                    timestamp: new Date(),
                };
                if (bookingWithDriver?.provider) {
                    const driverProfile = bookingWithDriver.provider.taxiDriverProfile;
                    if (driverProfile) {
                        updateData.driver = {
                            id: bookingWithDriver.provider.id,
                            name: `${bookingWithDriver.provider.firstName} ${bookingWithDriver.provider.lastName}`,
                            phone: bookingWithDriver.provider.phone,
                            rating: driverProfile.rating,
                            currentLocation: {
                                latitude: driverProfile.currentLatitude,
                                longitude: driverProfile.currentLongitude,
                            },
                            photoUrl: bookingWithDriver.provider.avatar,
                        };
                        updateData.vehicle = driverProfile.vehicle ? {
                            model: driverProfile.vehicle.model,
                            licensePlate: driverProfile.vehicle.licensePlate,
                        } : null;
                        updateData.bookingNumber = bookingWithDriver.bookingNumber;
                        updateData.pickupLocation = {
                            address: "Pickup Location",
                            latitude: bookingWithDriver.pickupLatitude,
                            longitude: bookingWithDriver.pickupLongitude,
                        };
                        updateData.dropoffLocation = {
                            address: "Dropoff Location",
                            latitude: bookingWithDriver.dropoffLatitude,
                            longitude: bookingWithDriver.dropoffLongitude,
                        };
                        updateData.estimatedPrice = bookingWithDriver.estimatedPrice;
                        updateData.estimatedDuration = bookingWithDriver.estimatedDuration;
                    }
                }
                await io.emitToRoom(`booking:${bookingId}`, "booking_update", updateData);
            }
            catch (error) {
                logger_1.default.warn("Failed to emit WebSocket events:", error);
            }
            // Send webhook notification for booking acceptance
            try {
                const driverProfile = await this.taxiDriverService.getProfile(userId);
                await this.webhookService.notifyTaxiBookingAccepted(bookingId, booking, driverProfile);
            }
            catch (webhookError) {
                logger_1.default.warn("Failed to send taxi booking acceptance webhook:", webhookError);
            }
            res.json({
                success: true,
                message: "Booking accepted successfully",
                data: booking,
            });
        }
        catch (error) {
            logger_1.default.error("Accept taxi booking error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to accept booking",
            });
        }
    }
    async rejectBooking(req, res) {
        try {
            const userId = req.user.id;
            const bookingId = req.params.id;
            await this.taxiDriverService.rejectBooking(userId, bookingId, req.body.reason);
            res.json({
                success: true,
                message: "Booking rejected successfully",
            });
        }
        catch (error) {
            logger_1.default.error("Reject taxi booking error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to reject booking",
            });
        }
    }
    async arriveAtPickup(req, res) {
        try {
            const userId = req.user.id;
            const bookingId = req.params.id;
            const booking = await this.taxiDriverService.arriveAtPickup(userId, bookingId);
            // Emit WebSocket events
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                // Emit role-specific event to driver
                await io.notifyUser(userId, "taxi_driver_arrived", {
                    bookingId: bookingId,
                    message: "You have arrived at the pickup location",
                    timestamp: new Date(),
                });
                // Emit booking_update to booking room for customer
                await io.emitToRoom(`booking:${bookingId}`, "booking_update", {
                    bookingId: bookingId,
                    status: "DRIVER_ARRIVED",
                    message: "Driver has arrived at pickup location",
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to emit WebSocket events:", error);
            }
            // Send webhook notification for arrival
            try {
                const driverProfile = await this.taxiDriverService.getProfile(userId);
                await this.webhookService.notifyTaxiBookingStatusUpdate(bookingId, "DRIVER_ARRIVED", booking, driverProfile, { message: "Driver has arrived at pickup location" });
            }
            catch (webhookError) {
                logger_1.default.warn("Failed to send taxi driver arrival webhook:", webhookError);
            }
            res.json({
                success: true,
                message: "Arrival confirmed successfully",
                data: booking,
            });
        }
        catch (error) {
            logger_1.default.error("Taxi arrive at pickup error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to confirm arrival",
            });
        }
    }
    async startTrip(req, res) {
        try {
            const userId = req.user.id;
            const bookingId = req.params.id;
            const booking = await this.taxiDriverService.startTrip(userId, bookingId);
            // Emit WebSocket events
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                // Emit role-specific event to driver
                await io.notifyUser(userId, "taxi_trip_started", {
                    bookingId: bookingId,
                    message: "Trip has started successfully",
                    timestamp: new Date(),
                });
                // Emit booking_update to booking room for customer
                await io.emitToRoom(`booking:${bookingId}`, "booking_update", {
                    bookingId: bookingId,
                    status: "IN_PROGRESS",
                    message: "Trip has started",
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to emit WebSocket events:", error);
            }
            // Send webhook notification for trip start
            try {
                const driverProfile = await this.taxiDriverService.getProfile(userId);
                await this.webhookService.notifyTaxiBookingStatusUpdate(bookingId, "TRIP_STARTED", booking, driverProfile, { message: "Trip has started successfully" });
            }
            catch (webhookError) {
                logger_1.default.warn("Failed to send taxi trip start webhook:", webhookError);
            }
            res.json({
                success: true,
                message: "Trip started successfully",
                data: booking,
            });
        }
        catch (error) {
            logger_1.default.error("Start taxi trip error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to start trip",
            });
        }
    }
    async completeTrip(req, res) {
        try {
            const userId = req.user.id;
            const bookingId = req.params.id;
            const booking = await this.taxiDriverService.completeTrip(userId, bookingId, req.body);
            // Send webhook notification for trip completion
            try {
                const driverProfile = await this.taxiDriverService.getProfile(userId);
                await this.webhookService.notifyTaxiBookingStatusUpdate(bookingId, "TRIP_COMPLETED", booking, driverProfile, {
                    message: "Trip completed successfully"
                });
            }
            catch (webhookError) {
                logger_1.default.warn("Failed to send taxi trip completion webhook:", webhookError);
            }
            res.json({
                success: true,
                message: "Trip completed successfully",
                data: booking,
            });
        }
        catch (error) {
            logger_1.default.error("Complete taxi trip error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to complete trip",
            });
        }
    }
    async getEarnings(req, res) {
        try {
            const userId = req.user.id;
            const earnings = await this.taxiDriverService.getTaxiDriverEarnings(userId, req.query);
            res.json({
                success: true,
                data: earnings,
            });
        }
        catch (error) {
            logger_1.default.error("Get taxi earnings error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to get earnings",
            });
        }
    }
    async getAnalytics(req, res) {
        try {
            const userId = req.user.id;
            const analytics = await this.taxiDriverService.getTaxiDriverAnalytics(userId);
            res.json({
                success: true,
                data: analytics,
            });
        }
        catch (error) {
            logger_1.default.error("Get taxi analytics error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to get analytics",
            });
        }
    }
    async getAllTaxiDrivers(req, res) {
        try {
            const taxiDrivers = await this.taxiDriverService.getAllTaxiDrivers(req.query);
            res.json({
                success: true,
                data: taxiDrivers,
            });
        }
        catch (error) {
            logger_1.default.error("Get all taxi drivers error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to get taxi drivers",
            });
        }
    }
    async verifyTaxiDriver(req, res) {
        try {
            const taxiDriverId = req.params.id;
            const taxiDriver = await this.taxiDriverService.verifyTaxiDriver(taxiDriverId);
            res.json({
                success: true,
                message: "Taxi driver verified successfully",
                data: taxiDriver,
            });
        }
        catch (error) {
            logger_1.default.error("Verify taxi driver error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to verify taxi driver",
            });
        }
    }
    async suspendTaxiDriver(req, res) {
        try {
            const taxiDriverId = req.params.id;
            const taxiDriver = await this.taxiDriverService.suspendTaxiDriver(taxiDriverId, req.body.reason);
            res.json({
                success: true,
                message: "Taxi driver suspended successfully",
                data: taxiDriver,
            });
        }
        catch (error) {
            logger_1.default.error("Suspend taxi driver error:", error);
            res.status(400).json({
                success: false,
                message: error.message || "Failed to suspend taxi driver",
            });
        }
    }
}
exports.TaxiDriverController = TaxiDriverController;
