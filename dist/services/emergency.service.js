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
exports.EmergencyService = void 0;
const database_1 = __importDefault(require("../config/database"));
const location_service_1 = require("./location.service");
const notification_service_1 = require("./notification.service");
const email_service_1 = require("./email.service");
const logger_1 = __importDefault(require("../utils/logger"));
class EmergencyService {
    constructor() {
        this.locationService = new location_service_1.LocationService();
        this.notificationService = new notification_service_1.NotificationService();
        this.emailService = new email_service_1.EmailService();
    }
    async createEmergencyBooking(data) {
        try {
            const booking = await database_1.default.booking.create({
                data: {
                    bookingNumber: await this.generateEmergencyNumber(),
                    customerId: data.customerId,
                    serviceTypeId: await this.getEmergencyServiceTypeId(data.emergencyType),
                    status: "PENDING",
                    type: "IMMEDIATE",
                    pickupLatitude: data.latitude,
                    pickupLongitude: data.longitude,
                    estimatedPrice: 0, // Emergency services are typically free
                    currency: "NGN",
                    serviceData: {
                        emergencyType: data.emergencyType,
                        severity: data.severity,
                        description: data.description,
                        contactPhone: data.contactPhone,
                        additionalInfo: data.additionalInfo,
                        dispatchTime: new Date(),
                    },
                    notes: data.description,
                },
                include: {
                    customer: {
                        select: {
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    serviceType: true,
                },
            });
            return booking;
        }
        catch (error) {
            logger_1.default.error("Create emergency booking error:", error);
            throw error;
        }
    }
    async dispatchEmergencyResponders(bookingId, data) {
        try {
            // Find nearby emergency responders
            const responders = await this.findNearbyResponders({
                emergencyType: data.emergencyType,
                latitude: data.latitude,
                longitude: data.longitude,
                radius: 20000, // 20km radius
            });
            // Dispatch to the closest available responders
            const dispatchPromises = responders.slice(0, 3).map(async (responder) => {
                await this.notificationService.notifyCustomer(responder.userId, {
                    type: "EMERGENCY_DISPATCH",
                    title: `${data.emergencyType} Emergency`,
                    body: `Emergency dispatch - ${data.severity} severity`,
                    data: {
                        bookingId,
                        emergencyType: data.emergencyType,
                        severity: data.severity,
                        latitude: data.latitude,
                        longitude: data.longitude,
                        distance: responder.distance,
                    },
                    priority: "CRITICAL",
                });
                // Log dispatch
                await database_1.default.auditLog.create({
                    data: {
                        userId: responder.userId,
                        action: "EMERGENCY_DISPATCHED",
                        resource: "emergency_booking",
                        resourceId: bookingId,
                        newValues: JSON.stringify({
                            emergencyType: data.emergencyType,
                            severity: data.severity,
                        }),
                    },
                });
            });
            await Promise.all(dispatchPromises);
            return { dispatchedCount: Math.min(responders.length, 3) };
        }
        catch (error) {
            logger_1.default.error("Dispatch emergency responders error:", error);
            throw error;
        }
    }
    async findNearbyResponders(params) {
        try {
            const responders = await database_1.default.emergencyProfile.findMany({
                where: {
                    serviceType: params.emergencyType,
                    isOnDuty: true,
                    isVerified: true,
                    currentLatitude: { not: null },
                    currentLongitude: { not: null },
                },
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                },
            });
            // Calculate distances and filter by radius
            const respondersWithDistance = responders
                .map((responder) => {
                if (!responder.currentLatitude || !responder.currentLongitude)
                    return null;
                const distance = this.locationService.calculateDistance(params.latitude, params.longitude, responder.currentLatitude, responder.currentLongitude);
                return {
                    ...responder,
                    distance,
                };
            })
                .filter((responder) => responder !== null && responder.distance <= params.radius)
                .sort((a, b) => a.distance - b.distance);
            return respondersWithDistance;
        }
        catch (error) {
            logger_1.default.error("Find nearby responders error:", error);
            throw error;
        }
    }
    async acceptEmergencyCall(bookingId, responderId) {
        try {
            // Check if responder is eligible
            const responder = await database_1.default.emergencyProfile.findUnique({
                where: { userId: responderId },
            });
            if (!responder || !responder.isOnDuty || !responder.isVerified) {
                throw new Error("Responder not eligible to accept emergency calls");
            }
            // Update booking
            const booking = await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    providerId: responderId,
                    status: "DRIVER_ASSIGNED",
                    acceptedAt: new Date(),
                },
                include: {
                    customer: true,
                    provider: true,
                },
            });
            // Notify customer
            await this.notificationService.notifyCustomer(booking.customerId, {
                type: "EMERGENCY_RESPONDER_ASSIGNED",
                title: "Emergency Responder Assigned",
                body: `${booking.provider?.firstName} ${booking.provider?.lastName} is responding to your emergency`,
                data: {
                    bookingId,
                    responderName: `${booking.provider?.firstName} ${booking.provider?.lastName}`,
                    responderPhone: booking.provider?.phone,
                },
                priority: "CRITICAL",
            });
            // Send WebSocket notification for real-time updates
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                await io.notifyUser(booking.customerId, "emergency_call_accepted", {
                    bookingId,
                    responderId,
                    responderName: `${booking.provider?.firstName} ${booking.provider?.lastName}`,
                    responderPhone: booking.provider?.phone,
                    acceptedAt: booking.acceptedAt,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to send WebSocket notification for emergency call acceptance:", error);
            }
            return booking;
        }
        catch (error) {
            logger_1.default.error("Accept emergency call error:", error);
            throw error;
        }
    }
    async updateEmergencyStatus(bookingId, data) {
        try {
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: { customer: true },
            });
            if (!booking || booking.providerId !== data.responderId) {
                throw new Error("Unauthorized to update this emergency");
            }
            const updatedBooking = await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    status: data.status,
                    notes: data.notes,
                },
            });
            // Add tracking update
            await database_1.default.trackingUpdate.create({
                data: {
                    bookingId,
                    latitude: 0, // Default values
                    longitude: 0,
                    status: data.status,
                    message: data.notes || `Status updated to ${data.status}`,
                },
            });
            // Notify customer of status update
            await this.notificationService.notifyCustomer(booking.customerId, {
                type: "EMERGENCY_STATUS_UPDATE",
                title: "Emergency Status Update",
                body: data.notes || `Status: ${data.status}`,
                data: {
                    bookingId,
                    status: data.status,
                    estimatedArrival: data.estimatedArrival,
                },
                priority: "STANDARD",
            });
            // Send WebSocket notification for real-time status updates
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                await io.notifyUser(booking.customerId, "emergency_status_update", {
                    bookingId,
                    status: data.status,
                    notes: data.notes,
                    estimatedArrival: data.estimatedArrival,
                    responderId: data.responderId,
                    timestamp: new Date(),
                });
                // Also broadcast to emergency booking room
                await io.emitToRoom(`emergency_booking:${bookingId}`, "emergency_status_update", {
                    bookingId,
                    status: data.status,
                    notes: data.notes,
                    estimatedArrival: data.estimatedArrival,
                    responderId: data.responderId,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.warn("Failed to send WebSocket notification for emergency status update:", error);
            }
            return updatedBooking;
        }
        catch (error) {
            logger_1.default.error("Update emergency status error:", error);
            throw error;
        }
    }
    async completeEmergencyCall(bookingId, data) {
        try {
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: { customer: true },
            });
            if (!booking || booking.providerId !== data.responderId) {
                throw new Error("Unauthorized to complete this emergency");
            }
            const updatedBooking = await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    serviceData: {
                        ...booking.serviceData,
                        resolution: data.resolution,
                        completionNotes: data.notes,
                        followUpRequired: data.followUpRequired,
                    },
                },
            });
            // Notify customer
            await this.notificationService.notifyCustomer(booking.customerId, {
                type: "EMERGENCY_COMPLETED",
                title: "Emergency Response Completed",
                body: `Emergency response completed. ${data.followUpRequired ? "Follow-up may be required." : ""}`,
                data: {
                    bookingId,
                    resolution: data.resolution,
                    followUpRequired: data.followUpRequired,
                },
                priority: "STANDARD",
            });
            return updatedBooking;
        }
        catch (error) {
            logger_1.default.error("Complete emergency call error:", error);
            throw error;
        }
    }
    async getEmergencyBookings(userId, filters) {
        try {
            const { page, limit, status, emergencyType } = filters;
            const skip = (page - 1) * limit;
            const where = {
                OR: [{ customerId: userId }, { providerId: userId }],
                serviceType: {
                    category: "EMERGENCY",
                },
            };
            if (status)
                where.status = status;
            if (emergencyType) {
                where.serviceData = {
                    path: ["emergencyType"],
                    equals: emergencyType,
                };
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
                            },
                        },
                        provider: {
                            select: {
                                firstName: true,
                                lastName: true,
                                phone: true,
                            },
                        },
                        serviceType: true,
                        trackingUpdates: {
                            orderBy: { timestamp: "desc" },
                            take: 5,
                        },
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
            logger_1.default.error("Get emergency bookings error:", error);
            throw error;
        }
    }
    async getNearbyEmergencies(params) {
        try {
            // Check if responder is on duty
            const responder = await database_1.default.emergencyProfile.findUnique({
                where: { userId: params.responderId },
            });
            if (!responder || !responder.isOnDuty) {
                return [];
            }
            const where = {
                status: "PENDING",
                serviceType: {
                    category: "EMERGENCY",
                },
                pickupLatitude: { not: null },
                pickupLongitude: { not: null },
            };
            if (params.emergencyType) {
                where.serviceData = {
                    path: ["emergencyType"],
                    equals: params.emergencyType,
                };
            }
            const emergencies = await database_1.default.booking.findMany({
                where,
                include: {
                    customer: {
                        select: {
                            firstName: true,
                            lastName: true,
                            phone: true,
                        },
                    },
                    serviceType: true,
                },
                orderBy: { createdAt: "asc" },
            });
            // Filter by distance
            const nearbyEmergencies = emergencies
                .map((emergency) => {
                const distance = this.locationService.calculateDistance(params.latitude, params.longitude, emergency.pickupLatitude, emergency.pickupLongitude);
                return {
                    ...emergency,
                    distance,
                };
            })
                .filter((emergency) => emergency.distance <= params.radius)
                .sort((a, b) => a.distance - b.distance);
            return nearbyEmergencies;
        }
        catch (error) {
            logger_1.default.error("Get nearby emergencies error:", error);
            throw error;
        }
    }
    async updateResponderLocation(responderId, data) {
        try {
            await database_1.default.emergencyProfile.updateMany({
                where: { userId: responderId },
                data: {
                    currentLatitude: data.latitude,
                    currentLongitude: data.longitude,
                    isOnDuty: data.isOnDuty,
                },
            });
            // Broadcast location update for active emergencies
            const activeEmergencies = await database_1.default.booking.findMany({
                where: {
                    providerId: responderId,
                    status: { in: ["DRIVER_ASSIGNED", "IN_PROGRESS"] },
                },
            });
            // Broadcast location update via WebSocket to customers
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                for (const booking of activeEmergencies) {
                    await io.notifyUser(booking.customerId, "emergency_responder_location_update", {
                        bookingId: booking.id,
                        responderId,
                        latitude: data.latitude,
                        longitude: data.longitude,
                        isOnDuty: data.isOnDuty,
                        timestamp: new Date(),
                    });
                }
                // Also broadcast to emergency booking room if it exists
                for (const booking of activeEmergencies) {
                    await io.emitToRoom(`emergency_booking:${booking.id}`, "emergency_responder_location_update", {
                        bookingId: booking.id,
                        responderId,
                        latitude: data.latitude,
                        longitude: data.longitude,
                        isOnDuty: data.isOnDuty,
                        timestamp: new Date(),
                    });
                }
            }
            catch (error) {
                logger_1.default.warn("Failed to broadcast emergency responder location update:", error);
            }
            logger_1.default.info(`Location updated for responder ${responderId}`);
            return { success: true };
        }
        catch (error) {
            logger_1.default.error("Update responder location error:", error);
            throw error;
        }
    }
    async onboardEmergencyResponder(data) {
        try {
            const responder = await database_1.default.emergencyProfile.create({
                data: {
                    userId: data.userId,
                    organizationName: data.organizationName,
                    organizationId: data.organizationId || `ORG-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    serviceType: data.serviceType,
                    department: data.department,
                    headquarters: data.headquarters,
                    contactPhone: data.contactPhone,
                    emergencyHotline: data.emergencyHotline,
                    serviceAreas: data.serviceAreas,
                    operatingHours: data.operatingHours,
                    serviceCapacity: data.serviceCapacity,
                    equipmentList: data.equipmentList,
                    certifications: data.certifications,
                    emergencyContacts: data.emergencyContacts,
                    badgeNumber: data.badgeNumber,
                    rank: data.rank,
                    title: data.title,
                    responseRadius: data.responseRadius || 10,
                    notes: data.notes,
                    isOnDuty: false,
                    isVerified: false,
                },
            });
            // Update user role
            await database_1.default.user.update({
                where: { id: data.userId },
                data: { role: "EMERGENCY_RESPONDER" },
            });
            return responder;
        }
        catch (error) {
            logger_1.default.error("Onboard emergency responder error:", error);
            throw error;
        }
    }
    async getEmergencyAnalytics(params) {
        try {
            const where = {
                serviceType: {
                    category: "EMERGENCY",
                },
            };
            if (params.startDate || params.endDate) {
                where.createdAt = {};
                if (params.startDate)
                    where.createdAt.gte = new Date(params.startDate);
                if (params.endDate)
                    where.createdAt.lte = new Date(params.endDate);
            }
            if (params.emergencyType) {
                where.serviceData = {
                    path: ["emergencyType"],
                    equals: params.emergencyType,
                };
            }
            const [totalEmergencies, completedEmergencies, averageResponseTime, emergenciesByType, emergenciesByStatus] = await Promise.all([
                database_1.default.booking.count({ where }),
                database_1.default.booking.count({
                    where: { ...where, status: "COMPLETED" },
                }),
                this.calculateAverageResponseTime(where),
                this.getEmergenciesByType(where),
                this.getEmergenciesByStatus(where),
            ]);
            return {
                totalEmergencies,
                completedEmergencies,
                completionRate: totalEmergencies > 0 ? (completedEmergencies / totalEmergencies) * 100 : 0,
                averageResponseTime,
                emergenciesByType,
                emergenciesByStatus,
            };
        }
        catch (error) {
            logger_1.default.error("Get emergency analytics error:", error);
            throw error;
        }
    }
    async generateEmergencyNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 4).toUpperCase();
        return `EMG${timestamp}${random}`;
    }
    async getEmergencyServiceTypeId(emergencyType) {
        const serviceType = await database_1.default.serviceType.findFirst({
            where: {
                category: "EMERGENCY",
                name: emergencyType,
            },
        });
        if (!serviceType) {
            // Create emergency service type if it doesn't exist
            const newServiceType = await database_1.default.serviceType.create({
                data: {
                    name: emergencyType,
                    displayName: emergencyType.replace("_", " "),
                    category: "EMERGENCY",
                    basePrice: 0,
                    isActive: true,
                },
            });
            return newServiceType.id;
        }
        return serviceType.id;
    }
    async calculateAverageResponseTime(where) {
        try {
            const emergencies = await database_1.default.booking.findMany({
                where: {
                    ...where,
                    acceptedAt: { not: null },
                },
                select: {
                    createdAt: true,
                    acceptedAt: true,
                },
            });
            if (emergencies.length === 0)
                return 0;
            const totalResponseTime = emergencies.reduce((sum, emergency) => {
                const responseTime = emergency.acceptedAt.getTime() - emergency.createdAt.getTime();
                return sum + responseTime;
            }, 0);
            return Math.round(totalResponseTime / emergencies.length / 1000 / 60); // Convert to minutes
        }
        catch (error) {
            logger_1.default.error("Calculate average response time error:", error);
            return 0;
        }
    }
    async getEmergenciesByType(where) {
        try {
            const emergencies = await database_1.default.booking.findMany({
                where,
                select: {
                    serviceData: true,
                },
            });
            const typeCount = {};
            emergencies.forEach((emergency) => {
                const emergencyType = emergency.serviceData?.emergencyType || "UNKNOWN";
                typeCount[emergencyType] = (typeCount[emergencyType] || 0) + 1;
            });
            return Object.entries(typeCount).map(([type, count]) => ({
                type,
                count,
            }));
        }
        catch (error) {
            logger_1.default.error("Get emergencies by type error:", error);
            return [];
        }
    }
    async getEmergenciesByStatus(where) {
        try {
            const statusCounts = await database_1.default.booking.groupBy({
                by: ["status"],
                where,
                _count: true,
            });
            return statusCounts.map((item) => ({
                status: item.status,
                count: item._count,
            }));
        }
        catch (error) {
            logger_1.default.error("Get emergencies by status error:", error);
            return [];
        }
    }
    // Emergency contacts and location sharing methods
    async addEmergencyContact(userId, contactData) {
        try {
            const contact = await database_1.default.emergencyContact.create({
                data: {
                    userId,
                    name: contactData.name,
                    phone: contactData.phone,
                    email: contactData.email,
                    relationship: contactData.relationship,
                },
            });
            return contact;
        }
        catch (error) {
            logger_1.default.error("Add emergency contact error:", error);
            throw error;
        }
    }
    async getEmergencyContacts(userId) {
        try {
            const contacts = await database_1.default.emergencyContact.findMany({
                where: { userId },
                // orderBy: { createdAt: "desc" },
            });
            return contacts;
        }
        catch (error) {
            logger_1.default.error("Get emergency contacts error:", error);
            throw error;
        }
    }
    async removeEmergencyContact(userId, contactId) {
        try {
            const contact = await database_1.default.emergencyContact.findFirst({
                where: { id: contactId, userId },
            });
            if (!contact) {
                throw new Error("Emergency contact not found");
            }
            await database_1.default.emergencyContact.delete({
                where: { id: contactId },
            });
            return { success: true };
        }
        catch (error) {
            logger_1.default.error("Remove emergency contact error:", error);
            throw error;
        }
    }
    async shareLocationWithEmergencyContacts(userId, locationData, isRealTime = false, bookingId) {
        try {
            // Get user's emergency contacts
            const contacts = await this.getEmergencyContacts(userId);
            if (contacts.length === 0) {
                logger_1.default.warn(`No emergency contacts found for user ${userId}`);
                return { sharedCount: 0 };
            }
            // Store location sharing record
            const locationShare = await database_1.default.emergencyLocationShare.create({
                data: {
                    userId,
                    bookingId,
                    latitude: locationData.latitude,
                    longitude: locationData.longitude,
                    accuracy: locationData.accuracy,
                    address: locationData.address,
                    isRealTime,
                    sharedWith: contacts.map(c => c.id),
                },
            });
            // Send real-time notifications via WebSocket if enabled
            if (isRealTime) {
                try {
                    const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                    for (const contact of contacts) {
                        await io.notifyUser(contact.id, "emergency_location_share", {
                            userId,
                            location: locationData,
                            timestamp: new Date(),
                            bookingId,
                        });
                    }
                }
                catch (error) {
                    logger_1.default.warn("Failed to send real-time location share notifications:", error);
                }
            }
            // Send email notifications to contacts with email addresses
            const emailPromises = contacts
                .filter(contact => contact.email)
                .map(contact => this.sendEmergencyLocationEmail(contact.email, contact.name, locationData, isRealTime, bookingId));
            await Promise.all(emailPromises);
            logger_1.default.info(`Location shared with ${contacts.length} emergency contacts for user ${userId}`);
            return {
                sharedCount: contacts.length,
                locationShareId: locationShare.id
            };
        }
        catch (error) {
            logger_1.default.error("Share location with emergency contacts error:", error);
            throw error;
        }
    }
    async sendEmergencyLocationEmail(email, contactName, locationData, isRealTime, bookingId) {
        try {
            const locationUrl = `https://maps.google.com/?q=${locationData.latitude},${locationData.longitude}`;
            const subject = isRealTime
                ? "Real-time Location Update - Emergency Contact"
                : "Last Known Location - Emergency Contact";
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
            .header { background: #dc3545; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .content { padding: 30px 20px; background: #ffffff; }
            .location-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .button { display: inline-block; padding: 15px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #eee; margin-top: 20px; }
            .emergency-notice { background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 20px 0; }
            @media (max-width: 600px) { .container { padding: 10px; } .header, .content { padding: 20px 15px; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">🚨 Emergency Alert</div>
              <h1>Location Update</h1>
            </div>
            <div class="content">
              <p>Dear ${contactName},</p>

              <div class="emergency-notice">
                <strong style="color: #721c24;">⚠️ Emergency Location Update</strong>
                <p style="color: #721c24; margin: 10px 0 0 0;">
                  ${isRealTime ? 'Real-time location sharing is active.' : 'This is the last known location.'}
                </p>
              </div>

              <div class="location-box">
                <h3 style="color: #856404; margin-top: 0;">📍 Current Location</h3>
                <p><strong>Coordinates:</strong> ${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}</p>
                ${locationData.address ? `<p><strong>Address:</strong> ${locationData.address}</p>` : ''}
                ${locationData.accuracy ? `<p><strong>Accuracy:</strong> ±${locationData.accuracy}m</p>` : ''}
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${locationUrl}" class="button" target="_blank">View on Google Maps</a>
              </div>

              <p>If you believe this is an emergency situation, please contact emergency services immediately.</p>
              ${bookingId ? `<p><strong>Related Booking:</strong> ${bookingId}</p>` : ''}
            </div>
            <div class="footer">
              <p>This is an automated emergency notification from TripSync.</p>
              <p>If you have any concerns, please contact support immediately.</p>
            </div>
          </div>
        </body>
        </html>
      `;
            await this.emailService.sendEmail(email, subject, html);
            logger_1.default.info(`Emergency location email sent to ${email}`);
        }
        catch (error) {
            logger_1.default.error("Send emergency location email error:", error);
            throw error;
        }
    }
    async getLocationSharingHistory(userId, limit = 50) {
        try {
            const history = await database_1.default.emergencyLocationShare.findMany({
                where: { userId },
                include: {
                    booking: {
                        select: {
                            id: true,
                            status: true,
                            serviceType: {
                                select: {
                                    name: true,
                                    category: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: limit,
            });
            return history;
        }
        catch (error) {
            logger_1.default.error("Get location sharing history error:", error);
            throw error;
        }
    }
    async stopLocationSharing(userId, bookingId) {
        try {
            // Update active location shares to mark them as stopped
            const updateData = {
                isRealTime: false,
                stoppedAt: new Date(),
            };
            if (bookingId) {
                updateData.bookingId = bookingId;
            }
            const result = await database_1.default.emergencyLocationShare.updateMany({
                where: {
                    userId,
                    isRealTime: true,
                    stoppedAt: null,
                    ...(bookingId && { bookingId }),
                },
                data: updateData,
            });
            // Notify emergency contacts that location sharing has stopped
            try {
                const { io } = await Promise.resolve().then(() => __importStar(require("../server")));
                const contacts = await this.getEmergencyContacts(userId);
                for (const contact of contacts) {
                    await io.notifyUser(contact.id, "emergency_location_sharing_stopped", {
                        userId,
                        bookingId,
                        timestamp: new Date(),
                    });
                }
            }
            catch (error) {
                logger_1.default.warn("Failed to send location sharing stopped notifications:", error);
            }
            logger_1.default.info(`Location sharing stopped for user ${userId}, affected ${result.count} shares`);
            return { stoppedCount: result.count };
        }
        catch (error) {
            logger_1.default.error("Stop location sharing error:", error);
            throw error;
        }
    }
}
exports.EmergencyService = EmergencyService;
