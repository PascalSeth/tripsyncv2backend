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
exports.TaxiDriverService = void 0;
const database_1 = __importDefault(require("../config/database"));
const location_service_1 = require("./location.service");
const notification_service_1 = require("./notification.service");
const payment_service_1 = require("./payment.service");
const logger_1 = __importDefault(require("../utils/logger"));
class TaxiDriverService {
    constructor() {
        this.locationService = new location_service_1.LocationService();
        this.notificationService = new notification_service_1.NotificationService();
        this.paymentService = new payment_service_1.PaymentService();
    }
    async onboardTaxiDriver(userId, onboardingData) {
        try {
            // Check if user already has a taxi driver profile
            const existingProfile = await database_1.default.taxiDriverProfile.findUnique({
                where: { userId },
            });
            if (existingProfile) {
                throw new Error("User already has a taxi driver profile");
            }
            // Update user role
            await database_1.default.user.update({
                where: { id: userId },
                data: { role: "TAXI_DRIVER" },
            });
            // Create taxi driver profile
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.create({
                data: {
                    userId,
                    licenseNumber: onboardingData.licenseNumber,
                    licenseExpiry: new Date(onboardingData.licenseExpiry),
                    licenseClass: onboardingData.licenseClass,
                    taxiLicenseNumber: onboardingData.taxiLicenseNumber,
                    taxiLicenseExpiry: new Date(onboardingData.taxiLicenseExpiry),
                    taxiPermitNumber: onboardingData.taxiPermitNumber,
                    taxiPermitExpiry: onboardingData.taxiPermitExpiry ? new Date(onboardingData.taxiPermitExpiry) : null,
                    taxiZone: onboardingData.taxiZone,
                    meterNumber: onboardingData.meterNumber,
                    operatingHours: onboardingData.operatingHours ? JSON.stringify(onboardingData.operatingHours) : undefined,
                },
            });
            // Add vehicle if provided
            if (onboardingData.vehicleInfo) {
                const vehicle = await database_1.default.vehicle.create({
                    data: {
                        ...onboardingData.vehicleInfo,
                        type: "TAXI",
                        category: "TAXI",
                        isTaxi: true,
                        taxiMeterInstalled: onboardingData.vehicleInfo.taxiMeterInstalled || true,
                        taxiTopLightInstalled: onboardingData.vehicleInfo.taxiTopLightInstalled || true,
                    },
                });
                await database_1.default.taxiDriverProfile.update({
                    where: { id: taxiDriverProfile.id },
                    data: { vehicleId: vehicle.id },
                });
            }
            // Update bank details if provided
            if (onboardingData.bankDetails) {
                await database_1.default.user.update({
                    where: { id: userId },
                    data: {
                        bankName: onboardingData.bankDetails.bankName,
                        bankAccountNumber: onboardingData.bankDetails.accountNumber,
                        bankAccountName: onboardingData.bankDetails.accountName,
                        bankCode: onboardingData.bankDetails.bankCode,
                    },
                });
            }
            // Add emergency contact if provided
            if (onboardingData.emergencyContact) {
                await database_1.default.emergencyContact.create({
                    data: {
                        userId,
                        name: onboardingData.emergencyContact.name,
                        phone: onboardingData.emergencyContact.phone,
                        relationship: onboardingData.emergencyContact.relationship,
                        isPrimary: true,
                    },
                });
            }
            return taxiDriverProfile;
        }
        catch (error) {
            logger_1.default.error("Onboard taxi driver error:", error);
            throw error;
        }
    }
    async updateProfile(userId, updateData) {
        try {
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findUnique({
                where: { userId },
            });
            if (!taxiDriverProfile) {
                throw new Error("Taxi driver profile not found");
            }
            const updatedProfile = await database_1.default.taxiDriverProfile.update({
                where: { userId },
                data: {
                    taxiZone: updateData.taxiZone,
                    meterNumber: updateData.meterNumber,
                    insurancePolicyNumber: updateData.insurancePolicyNumber,
                    insuranceExpiry: updateData.insuranceExpiry ? new Date(updateData.insuranceExpiry) : undefined,
                    acceptsCash: updateData.acceptsCash,
                    acceptsCard: updateData.acceptsCard,
                    maxRideDistance: updateData.maxRideDistance,
                    preferredPayoutMethod: updateData.preferredPayoutMethod,
                    payoutSchedule: updateData.payoutSchedule,
                    minimumPayoutAmount: updateData.minimumPayoutAmount,
                },
            });
            return updatedProfile;
        }
        catch (error) {
            logger_1.default.error("Update taxi driver profile error:", error);
            throw error;
        }
    }
    async getProfile(userId) {
        try {
            const profile = await database_1.default.taxiDriverProfile.findUnique({
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
                    vehicle: true,
                    documents: true,
                },
            });
            if (!profile) {
                throw new Error("Taxi driver profile not found");
            }
            return profile;
        }
        catch (error) {
            logger_1.default.error("Get taxi driver profile error:", error);
            throw error;
        }
    }
    async addVehicle(userId, vehicleData) {
        try {
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findUnique({
                where: { userId },
            });
            if (!taxiDriverProfile) {
                throw new Error("Taxi driver profile not found");
            }
            const vehicle = await database_1.default.vehicle.create({
                data: {
                    ...vehicleData,
                    type: "TAXI",
                    category: "TAXI",
                    isTaxi: true,
                    taxiMeterInstalled: vehicleData.taxiMeterInstalled || true,
                    taxiTopLightInstalled: vehicleData.taxiTopLightInstalled || true,
                },
            });
            // Link vehicle to taxi driver
            await database_1.default.taxiDriverProfile.update({
                where: { id: taxiDriverProfile.id },
                data: { vehicleId: vehicle.id },
            });
            return vehicle;
        }
        catch (error) {
            logger_1.default.error("Add taxi vehicle error:", error);
            throw error;
        }
    }
    async updateVehicle(userId, vehicleId, updateData) {
        try {
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findUnique({
                where: { userId },
            });
            if (!taxiDriverProfile || taxiDriverProfile.vehicleId !== vehicleId) {
                throw new Error("Vehicle not found or not owned by taxi driver");
            }
            const vehicle = await database_1.default.vehicle.update({
                where: { id: vehicleId },
                data: updateData,
            });
            return vehicle;
        }
        catch (error) {
            logger_1.default.error("Update taxi vehicle error:", error);
            throw error;
        }
    }
    async getVehicles(userId) {
        try {
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findUnique({
                where: { userId },
                include: {
                    vehicle: true,
                },
            });
            if (!taxiDriverProfile) {
                throw new Error("Taxi driver profile not found");
            }
            return taxiDriverProfile.vehicle ? [taxiDriverProfile.vehicle] : [];
        }
        catch (error) {
            logger_1.default.error("Get taxi vehicles error:", error);
            throw error;
        }
    }
    async uploadDocument(userId, documentData) {
        try {
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findUnique({
                where: { userId },
            });
            if (!taxiDriverProfile) {
                throw new Error("Taxi driver profile not found");
            }
            const document = await database_1.default.taxiDriverDocument.create({
                data: {
                    taxiDriverProfileId: taxiDriverProfile.id,
                    type: documentData.documentType,
                    documentNumber: documentData.documentNumber,
                    documentUrl: documentData.documentUrl,
                    expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate) : null,
                    status: "PENDING",
                },
            });
            return document;
        }
        catch (error) {
            logger_1.default.error("Upload taxi document error:", error);
            throw error;
        }
    }
    async getDocuments(userId) {
        try {
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findUnique({
                where: { userId },
                include: {
                    documents: true,
                },
            });
            if (!taxiDriverProfile) {
                throw new Error("Taxi driver profile not found");
            }
            return taxiDriverProfile.documents;
        }
        catch (error) {
            logger_1.default.error("Get taxi documents error:", error);
            throw error;
        }
    }
    async updateAvailability(userId, availabilityData) {
        try {
            const profile = await database_1.default.taxiDriverProfile.update({
                where: { userId },
                data: {
                    isAvailable: availabilityData.isAvailable,
                    isOnline: availabilityData.isOnline,
                    currentLatitude: availabilityData.currentLatitude,
                    currentLongitude: availabilityData.currentLongitude,
                },
            });
            // Broadcast availability update via WebSocket
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                await io.broadcastToRole("USER", "taxi_driver_availability_update", {
                    driverId: userId,
                    isAvailable: availabilityData.isAvailable,
                    isOnline: availabilityData.isOnline,
                    location: availabilityData.currentLatitude && availabilityData.currentLongitude ? {
                        latitude: availabilityData.currentLatitude,
                        longitude: availabilityData.currentLongitude
                    } : null,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to broadcast taxi driver availability update:", error);
            }
            return profile;
        }
        catch (error) {
            logger_1.default.error("Update taxi availability error:", error);
            throw error;
        }
    }
    async updateLocation(userId, locationData) {
        try {
            await database_1.default.taxiDriverProfile.update({
                where: { userId },
                data: {
                    currentLatitude: locationData.latitude,
                    currentLongitude: locationData.longitude,
                    heading: locationData.heading,
                },
            });
            // Store location history
            await database_1.default.driverLocationHistory.create({
                data: {
                    driverId: userId,
                    latitude: locationData.latitude,
                    longitude: locationData.longitude,
                    heading: locationData.heading,
                    speed: locationData.speed,
                },
            });
            // Broadcast location update to active customers
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                const activeBookings = await database_1.default.booking.findMany({
                    where: {
                        providerId: userId,
                        status: { in: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "IN_PROGRESS"] },
                    },
                });
                for (const booking of activeBookings) {
                    await io.notifyUser(booking.customerId, "taxi_driver_location_update", {
                        bookingId: booking.id,
                        driverId: userId,
                        latitude: locationData.latitude,
                        longitude: locationData.longitude,
                        heading: locationData.heading,
                        speed: locationData.speed,
                        timestamp: new Date(),
                    });
                }
            }
            catch (error) {
                logger_1.default.warn("Failed to broadcast taxi driver location update:", error);
            }
        }
        catch (error) {
            logger_1.default.error("Update taxi location error:", error);
            throw error;
        }
    }
    async updateOperatingHours(userId, operatingHours) {
        try {
            const profile = await database_1.default.taxiDriverProfile.update({
                where: { userId },
                data: {
                    operatingHours: JSON.stringify(operatingHours),
                },
            });
            return profile;
        }
        catch (error) {
            logger_1.default.error("Update operating hours error:", error);
            throw error;
        }
    }
    async acceptBooking(taxiDriverId, bookingId) {
        try {
            // Get taxi driver profile
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findUnique({
                where: { userId: taxiDriverId },
                include: { vehicle: true },
            });
            if (!taxiDriverProfile || !taxiDriverProfile.isVerified || !taxiDriverProfile.isAvailable) {
                throw new Error("Taxi driver not available or not verified");
            }
            // Get booking
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: {
                    customer: true,
                    serviceType: true,
                },
            });
            if (!booking || booking.status !== "PENDING") {
                throw new Error("Booking not available for acceptance");
            }
            // Check if taxi driver is within reasonable distance (for immediate bookings)
            if (booking.type === "IMMEDIATE" && taxiDriverProfile.currentLatitude && taxiDriverProfile.currentLongitude) {
                const distance = this.locationService.calculateDistance(taxiDriverProfile.currentLatitude, taxiDriverProfile.currentLongitude, booking.pickupLatitude, booking.pickupLongitude);
                if (distance > 15000) {
                    // 15km limit
                    throw new Error("Taxi driver too far from pickup location");
                }
            }
            // Update booking
            const updatedBooking = await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    providerId: taxiDriverId,
                    status: "DRIVER_ASSIGNED",
                    acceptedAt: new Date(),
                },
                include: {
                    customer: true,
                    provider: true,
                    serviceType: true,
                },
            });
            // Update taxi driver availability
            await database_1.default.taxiDriverProfile.update({
                where: { id: taxiDriverProfile.id },
                data: {
                    isAvailable: false,
                },
            });
            // Calculate ETA
            const eta = await this.calculateETA(taxiDriverProfile.currentLatitude, taxiDriverProfile.currentLongitude, booking.pickupLatitude, booking.pickupLongitude);
            // Notify customer
            await this.notificationService.notifyCustomer(booking.customerId, {
                type: "BOOKING_ACCEPTED",
                title: "Taxi Driver Assigned",
                body: `${updatedBooking.provider?.firstName} is on the way. ETA: ${eta} minutes`,
                data: {
                    bookingId: booking.id,
                    driverName: `${updatedBooking.provider?.firstName} ${updatedBooking.provider?.lastName}`,
                    driverPhone: updatedBooking.provider?.phone,
                    eta,
                    vehicleInfo: taxiDriverProfile.vehicle,
                    taxiLicense: taxiDriverProfile.taxiLicenseNumber,
                },
                priority: "STANDARD",
            });
            // Send WebSocket notification for real-time updates
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                await io.notifyUser(booking.customerId, "taxi_booking_accepted", {
                    bookingId,
                    driverId: taxiDriverId,
                    driverName: `${updatedBooking.provider?.firstName} ${updatedBooking.provider?.lastName}`,
                    driverPhone: updatedBooking.provider?.phone,
                    eta,
                    vehicleInfo: taxiDriverProfile.vehicle,
                    taxiLicense: taxiDriverProfile.taxiLicenseNumber,
                    acceptedAt: updatedBooking.acceptedAt,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to send WebSocket notification for taxi booking acceptance:", error);
            }
            // Start tracking
            await this.startBookingTracking(bookingId, taxiDriverId);
            return updatedBooking;
        }
        catch (error) {
            logger_1.default.error("Accept taxi booking error:", error);
            throw error;
        }
    }
    async rejectBooking(taxiDriverId, bookingId, reason) {
        try {
            // Log rejection for analytics
            await database_1.default.bookingRejection.create({
                data: {
                    bookingId,
                    driverId: taxiDriverId,
                    reason: reason || "No reason provided",
                    rejectedAt: new Date(),
                },
            });
            // Find next available taxi driver
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
            });
            if (booking) {
                await this.findAndNotifyNextTaxiDriver(booking);
            }
            return { success: true };
        }
        catch (error) {
            logger_1.default.error("Reject taxi booking error:", error);
            throw error;
        }
    }
    async arriveAtPickup(taxiDriverId, bookingId) {
        try {
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: bookingId,
                    providerId: taxiDriverId,
                    status: "DRIVER_ASSIGNED",
                },
                include: { customer: true },
            });
            if (!booking) {
                throw new Error("Booking not found or invalid status");
            }
            // Update booking status
            const updatedBooking = await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    status: "DRIVER_ARRIVED",
                },
            });
            // Add tracking update
            await database_1.default.trackingUpdate.create({
                data: {
                    bookingId,
                    latitude: 0, // Default values since they're required
                    longitude: 0,
                    status: "DRIVER_ARRIVED",
                    message: "Taxi driver has arrived at pickup location",
                    timestamp: new Date(),
                },
            });
            // Notify customer
            await this.notificationService.notifyCustomer(booking.customerId, {
                type: "DRIVER_ARRIVED",
                title: "Taxi Driver Arrived",
                body: "Your taxi driver has arrived at the pickup location",
                data: { bookingId },
                priority: "URGENT",
            });
            // Send WebSocket notification for real-time updates
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                await io.notifyUser(booking.customerId, "taxi_driver_arrived", {
                    bookingId,
                    driverId: taxiDriverId,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to send WebSocket notification for taxi driver arrival:", error);
            }
            return updatedBooking;
        }
        catch (error) {
            logger_1.default.error("Taxi driver arrive at pickup error:", error);
            throw error;
        }
    }
    async startTrip(taxiDriverId, bookingId) {
        try {
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: bookingId,
                    providerId: taxiDriverId,
                    status: { in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED"] },
                },
                include: { customer: true },
            });
            if (!booking) {
                throw new Error("Booking not found or invalid status");
            }
            // Update booking status
            const updatedBooking = await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    status: "IN_PROGRESS",
                    startedAt: new Date(),
                },
            });
            // Add tracking update
            await database_1.default.trackingUpdate.create({
                data: {
                    bookingId,
                    latitude: 0, // Default values since they're required
                    longitude: 0,
                    status: "TRIP_STARTED",
                    message: "Taxi trip has started",
                    timestamp: new Date(),
                },
            });
            // Notify customer
            await this.notificationService.notifyCustomer(booking.customerId, {
                type: "TRIP_STARTED",
                title: "Taxi Trip Started",
                body: "Your taxi trip has started",
                data: { bookingId },
                priority: "STANDARD",
            });
            // Send WebSocket notification for real-time updates
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                await io.notifyUser(booking.customerId, "taxi_trip_started", {
                    bookingId,
                    driverId: taxiDriverId,
                    startedAt: updatedBooking.startedAt,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to send WebSocket notification for taxi trip start:", error);
            }
            return updatedBooking;
        }
        catch (error) {
            logger_1.default.error("Start taxi trip error:", error);
            throw error;
        }
    }
    async completeTrip(taxiDriverId, bookingId, completionData) {
        try {
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: bookingId,
                    providerId: taxiDriverId,
                    status: "IN_PROGRESS",
                },
                include: {
                    customer: true,
                    serviceType: true,
                },
            });
            if (!booking) {
                throw new Error("Booking not found or invalid status");
            }
            // Calculate final pricing if not provided
            let finalPrice = completionData.finalPrice;
            if (!finalPrice) {
                finalPrice = await this.calculateTaxiFinalPrice(booking, completionData.actualDistance, completionData.meterReading);
            }
            const commission = finalPrice * (booking.serviceType.commissionRate || 0.15); // Lower commission for taxis
            const providerEarning = finalPrice - commission;
            // Update booking
            const updatedBooking = await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    actualDistance: completionData.actualDistance,
                    actualDuration: completionData.actualDuration,
                    finalPrice,
                    platformCommission: commission,
                    providerEarning,
                    serviceData: {
                        ...booking.serviceData,
                        meterReading: completionData.meterReading,
                    },
                },
            });
            // Update taxi driver availability and stats
            await database_1.default.taxiDriverProfile.updateMany({
                where: { userId: taxiDriverId },
                data: {
                    isAvailable: true,
                    totalRides: { increment: 1 },
                    totalEarnings: { increment: providerEarning },
                    monthlyEarnings: { increment: providerEarning },
                    monthlyCommissionDue: { increment: commission },
                },
            });
            // Create earning record
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findFirst({
                where: { userId: taxiDriverId },
            });
            if (taxiDriverProfile) {
                await database_1.default.taxiDriverEarning.create({
                    data: {
                        taxiDriverProfileId: taxiDriverProfile.id,
                        bookingId,
                        amount: providerEarning,
                        commission,
                        netEarning: providerEarning,
                        date: new Date(),
                        weekStarting: this.getWeekStart(new Date()),
                        monthYear: new Date().toISOString().slice(0, 7),
                    },
                });
            }
            // Add tracking update
            await database_1.default.trackingUpdate.create({
                data: {
                    bookingId,
                    latitude: completionData.endLatitude || 0,
                    longitude: completionData.endLongitude || 0,
                    status: "TRIP_COMPLETED",
                    message: "Taxi trip completed successfully",
                    timestamp: new Date(),
                },
            });
            // Process payment
            await this.paymentService.processPayment({
                userId: booking.customerId,
                bookingId,
                amount: finalPrice,
                paymentMethodId: "default", // This should come from booking data
                description: "Taxi trip payment",
            });
            // Notify customer
            await this.notificationService.notifyCustomer(booking.customerId, {
                type: "TRIP_COMPLETED",
                title: "Taxi Trip Completed",
                body: `Your taxi trip has been completed. Total: ₦${finalPrice}`,
                data: {
                    bookingId,
                    finalPrice,
                    distance: completionData.actualDistance,
                    duration: completionData.actualDuration,
                    meterReading: completionData.meterReading,
                },
                priority: "STANDARD",
            });
            // Send WebSocket notification for real-time updates
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                await io.notifyUser(booking.customerId, "taxi_trip_completed", {
                    bookingId,
                    driverId: taxiDriverId,
                    finalPrice,
                    distance: completionData.actualDistance,
                    duration: completionData.actualDuration,
                    meterReading: completionData.meterReading,
                    completedAt: updatedBooking.completedAt,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to send WebSocket notification for taxi trip completion:", error);
            }
            return updatedBooking;
        }
        catch (error) {
            logger_1.default.error("Complete taxi trip error:", error);
            throw error;
        }
    }
    async getTaxiDriverBookings(taxiDriverId, filters) {
        try {
            const { status, page, limit, dateFrom, dateTo } = filters;
            const skip = (page - 1) * limit;
            const where = { providerId: taxiDriverId };
            if (status)
                where.status = status;
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
                        customer: {
                            select: {
                                firstName: true,
                                lastName: true,
                                phone: true,
                                avatar: true,
                            },
                        },
                        serviceType: true,
                    },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
                database_1.default.booking.count({ where }),
            ]);
            return {
                bookings,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get taxi driver bookings error:", error);
            throw error;
        }
    }
    async getTaxiDriverEarnings(taxiDriverId, filters) {
        try {
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findFirst({
                where: { userId: taxiDriverId },
            });
            if (!taxiDriverProfile) {
                throw new Error("Taxi driver profile not found");
            }
            let startDate;
            let endDate = new Date();
            // Calculate date range based on period
            switch (filters.period) {
                case "today":
                    startDate = new Date();
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case "week":
                    startDate = this.getWeekStart(new Date());
                    break;
                case "month":
                    startDate = new Date();
                    startDate.setDate(1);
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case "custom":
                    startDate = filters.startDate ? new Date(filters.startDate) : new Date();
                    endDate = filters.endDate ? new Date(filters.endDate) : new Date();
                    break;
                default:
                    startDate = this.getWeekStart(new Date());
            }
            // Get earnings data
            const earnings = await database_1.default.taxiDriverEarning.findMany({
                where: {
                    taxiDriverProfileId: taxiDriverProfile.id,
                    date: {
                        gte: startDate,
                        lte: endDate,
                    },
                },
                orderBy: { date: "desc" },
            });
            // Calculate totals
            const totalEarnings = earnings.reduce((sum, earning) => sum + earning.amount, 0);
            const totalCommission = earnings.reduce((sum, earning) => sum + earning.commission, 0);
            const netEarnings = earnings.reduce((sum, earning) => sum + earning.netEarning, 0);
            const totalTrips = earnings.length;
            return {
                period: filters.period,
                startDate,
                endDate,
                summary: {
                    totalEarnings,
                    totalCommission,
                    netEarnings,
                    totalTrips,
                    averagePerTrip: totalTrips > 0 ? totalEarnings / totalTrips : 0,
                },
                earnings,
            };
        }
        catch (error) {
            logger_1.default.error("Get taxi driver earnings error:", error);
            throw error;
        }
    }
    async getTaxiDriverAnalytics(taxiDriverId) {
        try {
            const taxiDriverProfile = await database_1.default.taxiDriverProfile.findFirst({
                where: { userId: taxiDriverId },
            });
            if (!taxiDriverProfile) {
                throw new Error("Taxi driver profile not found");
            }
            // Get current month data
            const currentMonth = new Date();
            currentMonth.setDate(1);
            currentMonth.setHours(0, 0, 0, 0);
            const [monthlyStats, weeklyStats, recentBookings] = await Promise.all([
                // Monthly stats
                database_1.default.taxiDriverEarning.aggregate({
                    where: {
                        taxiDriverProfileId: taxiDriverProfile.id,
                        date: { gte: currentMonth },
                    },
                    _sum: {
                        amount: true,
                        commission: true,
                        netEarning: true,
                    },
                    _count: true,
                }),
                // Weekly stats
                database_1.default.taxiDriverEarning.aggregate({
                    where: {
                        taxiDriverProfileId: taxiDriverProfile.id,
                        date: { gte: this.getWeekStart(new Date()) },
                    },
                    _sum: {
                        amount: true,
                        commission: true,
                        netEarning: true,
                    },
                    _count: true,
                }),
                // Recent bookings
                database_1.default.booking.findMany({
                    where: {
                        providerId: taxiDriverId,
                        status: "COMPLETED",
                    },
                    orderBy: { completedAt: "desc" },
                    take: 10,
                    include: {
                        customer: {
                            select: {
                                firstName: true,
                                lastName: true,
                            },
                        },
                        serviceType: true,
                    },
                }),
            ]);
            return {
                profile: {
                    rating: taxiDriverProfile.rating,
                    totalRides: taxiDriverProfile.totalRides,
                    totalEarnings: taxiDriverProfile.totalEarnings,
                    isVerified: taxiDriverProfile.isVerified,
                    taxiLicense: taxiDriverProfile.taxiLicenseNumber,
                    taxiZone: taxiDriverProfile.taxiZone,
                    joinedDate: new Date(), // Use current date as fallback
                },
                monthly: {
                    earnings: monthlyStats._sum.amount || 0,
                    commission: monthlyStats._sum.commission || 0,
                    netEarnings: monthlyStats._sum.netEarning || 0,
                    trips: monthlyStats._count,
                },
                weekly: {
                    earnings: weeklyStats._sum.amount || 0,
                    commission: weeklyStats._sum.commission || 0,
                    netEarnings: weeklyStats._sum.netEarning || 0,
                    trips: weeklyStats._count,
                },
                recentBookings,
            };
        }
        catch (error) {
            logger_1.default.error("Get taxi driver analytics error:", error);
            throw error;
        }
    }
    async getAllTaxiDrivers(filters) {
        try {
            const { page = 1, limit = 20, status, zone } = filters;
            const skip = (page - 1) * limit;
            const where = {};
            if (status)
                where.verificationStatus = status;
            if (zone)
                where.taxiZone = zone;
            const [taxiDrivers, total] = await Promise.all([
                database_1.default.taxiDriverProfile.findMany({
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
                        vehicle: true,
                    },
                    // orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
                database_1.default.taxiDriverProfile.count({ where }),
            ]);
            return {
                taxiDrivers,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get all taxi drivers error:", error);
            throw error;
        }
    }
    async verifyTaxiDriver(taxiDriverId) {
        try {
            const taxiDriver = await database_1.default.taxiDriverProfile.update({
                where: { userId: taxiDriverId },
                data: {
                    isVerified: true,
                    verificationStatus: "APPROVED",
                },
            });
            // Notify taxi driver
            await this.notificationService.notifyDriver(taxiDriverId, {
                type: "VERIFICATION_APPROVED",
                title: "Verification Approved",
                body: "Your taxi driver account has been verified and approved",
                priority: "URGENT",
            });
            return taxiDriver;
        }
        catch (error) {
            logger_1.default.error("Verify taxi driver error:", error);
            throw error;
        }
    }
    async suspendTaxiDriver(taxiDriverId, reason) {
        try {
            const taxiDriver = await database_1.default.taxiDriverProfile.update({
                where: { userId: taxiDriverId },
                data: {
                    isVerified: false,
                    verificationStatus: "REJECTED",
                    isAvailable: false,
                    isOnline: false,
                },
            });
            // Notify taxi driver
            await this.notificationService.notifyDriver(taxiDriverId, {
                type: "ACCOUNT_SUSPENDED",
                title: "Account Suspended",
                body: `Your taxi driver account has been suspended. Reason: ${reason}`,
                priority: "CRITICAL",
            });
            return taxiDriver;
        }
        catch (error) {
            logger_1.default.error("Suspend taxi driver error:", error);
            throw error;
        }
    }
    async addTaxiVehicle(taxiDriverProfileId, vehicleData) {
        try {
            const vehicle = await database_1.default.vehicle.create({
                data: {
                    ...vehicleData,
                    type: "TAXI",
                    category: "TAXI",
                    isTaxi: true,
                    taxiMeterInstalled: vehicleData.taxiMeterInstalled || true,
                    taxiTopLightInstalled: vehicleData.taxiTopLightInstalled || true,
                    isActive: true,
                    isVerified: false,
                },
            });
            // Link vehicle to taxi driver
            await database_1.default.taxiDriverProfile.update({
                where: { id: taxiDriverProfileId },
                data: { vehicleId: vehicle.id },
            });
            return vehicle;
        }
        catch (error) {
            logger_1.default.error("Add taxi vehicle error:", error);
            throw error;
        }
    }
    async calculateETA(fromLat, fromLng, toLat, toLng) {
        try {
            const distance = this.locationService.calculateDistance(fromLat, fromLng, toLat, toLng);
            // Assume average speed of 25 km/h in city traffic for taxis
            const timeInHours = distance / 25000; // distance in meters, speed in m/h
            return Math.ceil(timeInHours * 60); // return minutes
        }
        catch (error) {
            logger_1.default.error("Calculate ETA error:", error);
            return 15; // default 15 minutes
        }
    }
    async calculateTaxiFinalPrice(booking, actualDistance, meterReading) {
        try {
            const serviceType = booking.serviceType;
            let finalPrice = serviceType.basePrice || 0;
            // Use meter reading if available (for regulated taxi fares)
            if (meterReading) {
                finalPrice = meterReading;
            }
            else if (actualDistance && serviceType.pricePerKm) {
                finalPrice += (actualDistance / 1000) * serviceType.pricePerKm;
            }
            // Apply surge pricing if applicable (less common for taxis)
            if (booking.surgePricing && booking.surgePricing > 1) {
                finalPrice *= booking.surgePricing;
            }
            return Math.round(finalPrice);
        }
        catch (error) {
            logger_1.default.error("Calculate taxi final price error:", error);
            return booking.estimatedPrice || 0;
        }
    }
    async startBookingTracking(bookingId, taxiDriverId) {
        try {
            await database_1.default.trackingUpdate.create({
                data: {
                    bookingId,
                    latitude: 0, // Default values since they're required
                    longitude: 0,
                    status: "DRIVER_ASSIGNED",
                    message: "Taxi driver assigned and tracking started",
                    timestamp: new Date(),
                },
            });
        }
        catch (error) {
            logger_1.default.error("Start taxi booking tracking error:", error);
        }
    }
    async findAndNotifyNextTaxiDriver(booking) {
        try {
            // Implementation for finding next available taxi driver
            // This would use the taxi driver matching service
            logger_1.default.info(`Finding next taxi driver for booking ${booking.id}`);
        }
        catch (error) {
            logger_1.default.error("Find next taxi driver error:", error);
        }
    }
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    }
}
exports.TaxiDriverService = TaxiDriverService;
