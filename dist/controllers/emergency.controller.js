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
exports.EmergencyController = void 0;
const database_1 = __importDefault(require("../config/database"));
const emergency_service_1 = require("../services/emergency.service");
const location_service_1 = require("../services/location.service");
const notification_service_1 = require("../services/notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class EmergencyController {
    constructor() {
        this.emergencyService = new emergency_service_1.EmergencyService();
        this.locationService = new location_service_1.LocationService();
        this.notificationService = new notification_service_1.NotificationService();
        this.createEmergencyBooking = async (req, res) => {
            try {
                const userId = req.user.id;
                const { emergencyType, latitude, longitude, description, severity, contactPhone, additionalInfo } = req.body;
                // Create emergency booking
                const booking = await this.emergencyService.createEmergencyBooking({
                    customerId: userId,
                    emergencyType,
                    latitude,
                    longitude,
                    description,
                    severity,
                    contactPhone,
                    additionalInfo,
                });
                // Dispatch emergency responders
                await this.emergencyService.dispatchEmergencyResponders(booking.id, {
                    emergencyType,
                    latitude,
                    longitude,
                    severity,
                });
                res.status(201).json({
                    success: true,
                    message: "Emergency booking created and responders dispatched",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Create emergency booking error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create emergency booking",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getEmergencyBookings = async (req, res) => {
            try {
                const userId = req.user.id;
                const { page = 1, limit = 10, status, emergencyType } = req.query;
                const bookings = await this.emergencyService.getEmergencyBookings(userId, {
                    page: Number(page),
                    limit: Number(limit),
                    status: status,
                    emergencyType: emergencyType,
                });
                res.json({
                    success: true,
                    message: "Emergency bookings retrieved successfully",
                    data: bookings,
                });
            }
            catch (error) {
                logger_1.default.error("Get emergency bookings error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve emergency bookings",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateEmergencyStatus = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const { status, notes, estimatedArrival } = req.body;
                const responderId = req.user.id;
                const booking = await this.emergencyService.updateEmergencyStatus(bookingId, {
                    status,
                    notes,
                    estimatedArrival,
                    responderId,
                });
                res.json({
                    success: true,
                    message: "Emergency status updated successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Update emergency status error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update emergency status",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.acceptEmergencyCall = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const responderId = req.user.id;
                const booking = await this.emergencyService.acceptEmergencyCall(bookingId, responderId);
                // Notify customer via WebSocket about responder assignment
                try {
                    const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                    await io.notifyUser(booking.customerId, "emergency_responder_assigned", {
                        bookingId,
                        responderId,
                        responderName: booking.provider?.firstName + " " + booking.provider?.lastName,
                        responderPhone: booking.provider?.phone,
                        timestamp: new Date(),
                    });
                    // Notify responder to join emergency booking room
                    await io.notifyUser(responderId, "emergency_booking_joined", {
                        bookingId,
                        customerId: booking.customerId,
                        customerName: booking.customer?.firstName + " " + booking.customer?.lastName,
                        timestamp: new Date(),
                    });
                }
                catch (error) {
                    logger_1.default.warn("Failed to send WebSocket notifications for emergency call acceptance:", error);
                }
                res.json({
                    success: true,
                    message: "Emergency call accepted successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Accept emergency call error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to accept emergency call",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.completeEmergencyCall = async (req, res) => {
            try {
                const bookingId = req.params.id;
                const { resolution, notes, followUpRequired } = req.body;
                const responderId = req.user.id;
                const booking = await this.emergencyService.completeEmergencyCall(bookingId, {
                    resolution,
                    notes,
                    followUpRequired,
                    responderId,
                });
                res.json({
                    success: true,
                    message: "Emergency call completed successfully",
                    data: booking,
                });
            }
            catch (error) {
                logger_1.default.error("Complete emergency call error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to complete emergency call",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getNearbyEmergencies = async (req, res) => {
            try {
                const { latitude, longitude, radius = 10000, emergencyType } = req.query;
                const responderId = req.user.id;
                if (!latitude || !longitude) {
                    return res.status(400).json({
                        success: false,
                        message: "Latitude and longitude are required",
                    });
                }
                const emergencies = await this.emergencyService.getNearbyEmergencies({
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    radius: Number(radius),
                    emergencyType: emergencyType,
                    responderId,
                });
                res.json({
                    success: true,
                    message: "Nearby emergencies retrieved successfully",
                    data: emergencies,
                });
            }
            catch (error) {
                logger_1.default.error("Get nearby emergencies error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve nearby emergencies",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateResponderLocation = async (req, res) => {
            try {
                const { latitude, longitude, isOnDuty } = req.body;
                const responderId = req.user.id;
                await this.emergencyService.updateResponderLocation(responderId, {
                    latitude,
                    longitude,
                    isOnDuty,
                });
                // Broadcast location update via WebSocket
                try {
                    const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                    await io.broadcastToRole("USER", "emergency_responder_location_update", {
                        responderId,
                        latitude,
                        longitude,
                        isOnDuty,
                        timestamp: new Date(),
                    });
                }
                catch (error) {
                    logger_1.default.warn("Failed to broadcast emergency responder location update:", error);
                }
                res.json({
                    success: true,
                    message: "Responder location updated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Update responder location error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update responder location",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getEmergencyAnalytics = async (req, res) => {
            try {
                const { startDate, endDate, emergencyType } = req.query;
                const analytics = await this.emergencyService.getEmergencyAnalytics({
                    startDate: startDate,
                    endDate: endDate,
                    emergencyType: emergencyType,
                });
                res.json({
                    success: true,
                    message: "Emergency analytics retrieved successfully",
                    data: analytics,
                });
            }
            catch (error) {
                logger_1.default.error("Get emergency analytics error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve emergency analytics",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Emergency responder management
        this.onboardEmergencyResponder = async (req, res) => {
            try {
                const { 
                // Organization details
                organizationName, organizationId, serviceType, // POLICE, AMBULANCE, FIRE_DEPARTMENT, etc.
                department, headquarters, contactPhone, emergencyHotline, serviceAreas, operatingHours, serviceCapacity, equipmentList, certifications, emergencyContacts, 
                // Representative details
                representativeName, representativeTitle, representativeEmail, representativePhone, badgeNumber, rank, 
                // Service configuration
                responseRadius = 10, notes, } = req.body;
                // Handle both new user creation and existing user onboarding
                let userId = req.user?.id;
                let user = req.user;
                if (!userId) {
                    // Create new user for organization representative
                    const userData = {
                        email: representativeEmail,
                        phone: representativePhone,
                        firstName: representativeName?.split(' ')[0] || '',
                        lastName: representativeName?.split(' ').slice(1).join(' ') || '',
                        role: 'EMERGENCY_RESPONDER',
                        isVerified: false,
                    };
                    const newUser = await database_1.default.user.create({
                        data: {
                            ...userData,
                            referralCode: `ER-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        }
                    });
                    // Get user permissions for the EMERGENCY_RESPONDER role
                    const rolePermissions = await database_1.default.rolePermission.findMany({
                        where: {
                            role: 'EMERGENCY_RESPONDER',
                            isActive: true
                        },
                        select: { permission: true }
                    });
                    // Create the authenticated user object with permissions
                    user = {
                        id: newUser.id,
                        email: newUser.email,
                        phone: newUser.phone,
                        role: newUser.role,
                        permissions: rolePermissions.map(rp => rp.permission),
                        isVerified: newUser.isVerified,
                        isActive: newUser.isActive,
                    };
                    userId = newUser.id;
                }
                else {
                    // Update existing user role if needed
                    const updatedUser = await database_1.default.user.update({
                        where: { id: userId },
                        data: { role: 'EMERGENCY_RESPONDER' }
                    });
                    // Get updated permissions for the new role
                    const rolePermissions = await database_1.default.rolePermission.findMany({
                        where: {
                            role: 'EMERGENCY_RESPONDER',
                            isActive: true
                        },
                        select: { permission: true }
                    });
                    // Update the user object with new permissions - ensure all required fields are present
                    user = {
                        id: updatedUser.id,
                        email: updatedUser.email,
                        phone: updatedUser.phone,
                        role: updatedUser.role,
                        permissions: rolePermissions.map(rp => rp.permission),
                        isVerified: updatedUser.isVerified,
                        isActive: updatedUser.isActive,
                    };
                }
                // Ensure user is defined before proceeding
                if (!user || !user.id) {
                    return res.status(400).json({
                        success: false,
                        message: "Failed to create or update user",
                    });
                }
                // Create emergency profile for the organization
                const emergencyProfile = await database_1.default.emergencyProfile.create({
                    data: {
                        userId: user.id,
                        organizationName,
                        organizationId: organizationId || `ORG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        serviceType,
                        department,
                        headquarters,
                        contactPhone,
                        emergencyHotline,
                        serviceAreas,
                        operatingHours,
                        serviceCapacity,
                        equipmentList,
                        certifications,
                        emergencyContacts,
                        badgeNumber,
                        rank,
                        title: representativeTitle,
                        responseRadius,
                        notes,
                        isOnDuty: false,
                        isVerified: false,
                    }
                });
                res.status(201).json({
                    success: true,
                    message: "Emergency responder organization onboarded successfully",
                    data: {
                        user,
                        emergencyProfile,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Onboard emergency responder error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to onboard emergency responder",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getResponderProfile = async (req, res) => {
            try {
                const userId = req.user.id;
                const profile = await database_1.default.emergencyProfile.findUnique({
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
                        message: "Emergency responder profile not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Responder profile retrieved successfully",
                    data: profile,
                });
            }
            catch (error) {
                logger_1.default.error("Get responder profile error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve responder profile",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateResponderProfile = async (req, res) => {
            try {
                const userId = req.user.id;
                const updateData = req.body;
                const profile = await database_1.default.emergencyProfile.updateMany({
                    where: { userId },
                    data: updateData,
                });
                if (profile.count === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Emergency responder profile not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Responder profile updated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Update responder profile error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update responder profile",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Admin functions
        this.getAllEmergencyResponders = async (req, res) => {
            try {
                const { page = 1, limit = 20, serviceType, department, isOnDuty } = req.query;
                const where = {};
                if (serviceType)
                    where.serviceType = serviceType;
                if (department)
                    where.department = department;
                if (isOnDuty !== undefined)
                    where.isOnDuty = isOnDuty === "true";
                const responders = await database_1.default.emergencyProfile.findMany({
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
                const total = await database_1.default.emergencyProfile.count({ where });
                res.json({
                    success: true,
                    message: "Emergency responders retrieved successfully",
                    data: responders,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        totalPages: Math.ceil(total / Number(limit)),
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Get all emergency responders error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve emergency responders",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.verifyEmergencyResponder = async (req, res) => {
            try {
                const responderId = req.params.id;
                const responder = await database_1.default.emergencyProfile.update({
                    where: { id: responderId },
                    data: { isVerified: true },
                    include: { user: true },
                });
                // Send verification notification
                await this.notificationService.notifyCustomer(responder.userId, {
                    type: "EMERGENCY_RESPONDER_VERIFIED",
                    title: "Emergency Responder Verified",
                    body: "Your emergency responder application has been approved",
                    priority: "STANDARD",
                });
                res.json({
                    success: true,
                    message: "Emergency responder verified successfully",
                    data: responder,
                });
            }
            catch (error) {
                logger_1.default.error("Verify emergency responder error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to verify emergency responder",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Emergency contacts management
        this.addEmergencyContact = async (req, res) => {
            try {
                const userId = req.user.id;
                const { name, phone, email, relationship } = req.body;
                const contact = await this.emergencyService.addEmergencyContact(userId, {
                    name,
                    phone,
                    email,
                    relationship,
                });
                res.status(201).json({
                    success: true,
                    message: "Emergency contact added successfully",
                    data: contact,
                });
            }
            catch (error) {
                logger_1.default.error("Add emergency contact error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to add emergency contact",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getEmergencyContacts = async (req, res) => {
            try {
                const userId = req.user.id;
                const contacts = await this.emergencyService.getEmergencyContacts(userId);
                res.json({
                    success: true,
                    message: "Emergency contacts retrieved successfully",
                    data: contacts,
                });
            }
            catch (error) {
                logger_1.default.error("Get emergency contacts error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve emergency contacts",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.removeEmergencyContact = async (req, res) => {
            try {
                const userId = req.user.id;
                const contactId = req.params.contactId;
                await this.emergencyService.removeEmergencyContact(userId, contactId);
                res.json({
                    success: true,
                    message: "Emergency contact removed successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Remove emergency contact error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to remove emergency contact",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Location sharing functionality
        this.shareLocation = async (req, res) => {
            try {
                const userId = req.user.id;
                const { latitude, longitude, accuracy, address, isRealTime = false, bookingId } = req.body;
                const result = await this.emergencyService.shareLocationWithEmergencyContacts(userId, {
                    latitude,
                    longitude,
                    accuracy,
                    address,
                }, isRealTime, bookingId);
                res.json({
                    success: true,
                    message: `Location shared with ${result.sharedCount} emergency contacts`,
                    data: result,
                });
            }
            catch (error) {
                logger_1.default.error("Share location error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to share location",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getLocationSharingHistory = async (req, res) => {
            try {
                const userId = req.user.id;
                const { limit = 50 } = req.query;
                const history = await this.emergencyService.getLocationSharingHistory(userId, Number(limit));
                res.json({
                    success: true,
                    message: "Location sharing history retrieved successfully",
                    data: history,
                });
            }
            catch (error) {
                logger_1.default.error("Get location sharing history error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve location sharing history",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.stopLocationSharing = async (req, res) => {
            try {
                const userId = req.user.id;
                const { bookingId } = req.body;
                const result = await this.emergencyService.stopLocationSharing(userId, bookingId);
                res.json({
                    success: true,
                    message: `Location sharing stopped for ${result.stoppedCount} active shares`,
                    data: result,
                });
            }
            catch (error) {
                logger_1.default.error("Stop location sharing error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to stop location sharing",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Track user location during emergency
        this.trackUserLocation = async (req, res) => {
            try {
                const userId = req.user.id;
                const { latitude, longitude, accuracy, heading, speed, bookingId } = req.body;
                // Store location update
                await database_1.default.emergencyLocationUpdate.create({
                    data: {
                        userId,
                        bookingId,
                        latitude,
                        longitude,
                        accuracy,
                        heading,
                        speed,
                        timestamp: new Date(),
                    },
                });
                // Broadcast location update via WebSocket
                try {
                    const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                    await io.emitToRoom(`emergency_booking:${bookingId}`, "emergency_user_location_update", {
                        userId,
                        bookingId,
                        latitude,
                        longitude,
                        accuracy,
                        heading,
                        speed,
                        timestamp: new Date(),
                    });
                    // Also notify emergency contacts if real-time sharing is active
                    const contacts = await this.emergencyService.getEmergencyContacts(userId);
                    for (const contact of contacts) {
                        await io.notifyUser(contact.id, "emergency_user_location_update", {
                            userId,
                            bookingId,
                            latitude,
                            longitude,
                            accuracy,
                            heading,
                            speed,
                            timestamp: new Date(),
                        });
                    }
                }
                catch (error) {
                    logger_1.default.warn("Failed to broadcast user location update:", error);
                }
                res.json({
                    success: true,
                    message: "User location updated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Track user location error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to track user location",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
}
exports.EmergencyController = EmergencyController;
