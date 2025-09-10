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
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const email_service_1 = require("./email.service");
const logger_1 = __importDefault(require("../utils/logger"));
class WebSocketService {
    constructor(server) {
        this.emailService = new email_service_1.EmailService();
        this.connectedUsers = new Map(); // userId -> socketId
        this.userSockets = new Map(); // socketId -> socket
        // In-memory cache for driver locations (in production, use Redis)
        this.driverLocations = new Map();
        // In a real application, chat messages would be stored in a database.
        // This is a simple in-memory store for demonstration.
        this.chatMessages = [];
        this.io = new socket_io_1.Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "*",
                methods: ["GET", "POST"],
                credentials: true,
            },
            transports: ["websocket", "polling"],
        });
        this.setupMiddleware();
        this.setupEventHandlers();
        logger_1.default.info("WebSocketService initialized.");
        // Broadcast available drivers every 15 seconds
        setInterval(() => {
            this.broadcastAvailableDrivers();
        }, 15000);
        // Clean up stale driver locations every 2 minutes
        setInterval(() => {
            this.cleanupStaleDriverLocations();
        }, 120000);
    }
    /**
     * Socket.IO Authentication Middleware
     */
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
            logger_1.default.info(`WS Auth: Received connection attempt. Token present: ${!!token}`);
            if (!token) {
                logger_1.default.warn("WS Auth: No token provided. Rejecting connection.");
                return next(new Error("Authentication token required"));
            }
            const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";
            try {
                const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
                logger_1.default.info(`WS Auth: Token decoded for userId: ${decoded.userId}, role: ${decoded.role}`);
                const user = await database_1.default.user.findUnique({
                    where: { id: decoded.userId },
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        phone: true,
                        avatar: true,
                        role: true,
                        isVerified: true,
                        isActive: true,
                        customerProfile: true,
                        driverProfile: true,
                        moverProfile: true,
                        emergencyProfile: true,
                        taxiDriverProfile: true,
                        deliveryProfile: true,
                    },
                });
                if (!user || !user.isActive) {
                    logger_1.default.warn(`WS Auth: User ${decoded.userId} not found or inactive. Rejecting connection.`);
                    return next(new Error("User not found or inactive"));
                }
                socket.userId = user.id;
                socket.userRole = user.role;
                socket.isAuthenticated = true;
                socket.userPayload = {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    role: user.role,
                    isVerified: user.isVerified,
                    isActive: user.isActive,
                    permissions: (decoded.permissions || []),
                };
                // Store user info for later use
                socket.userInfo = {
                    firstName: user.firstName ?? undefined,
                    lastName: user.lastName ?? undefined,
                    avatar: user.avatar ?? undefined,
                };
                logger_1.default.info(`WS Auth: User ${user.id} (${user.firstName} ${user.lastName}) authenticated successfully.`);
                next();
            }
            catch (error) {
                logger_1.default.error("WS Auth: Authentication failed:", {
                    error: error instanceof Error ? error.message : "Unknown error",
                    tokenPrefix: token ? token.substring(0, 10) : null,
                });
                next(new Error("Authentication failed: Invalid or expired token"));
            }
        });
    }
    /**
     * Sets up all event handlers for connected sockets.
     */
    setupEventHandlers() {
        this.io.on("connection", (socket) => {
            logger_1.default.info(`🔌 Socket Connected: User ${socket.userId} (${socket.id}) - Role: ${socket.userRole}`);
            if (socket.userId) {
                this.connectedUsers.set(socket.userId, socket.id);
                this.userSockets.set(socket.id, socket);
                // Join user-specific rooms
                socket.join(`user:${socket.userId}`);
                socket.join(`user_${socket.userId}`);
                // Join role-specific rooms
                if (socket.userRole) {
                    socket.join(`role:${socket.userRole}`);
                    logger_1.default.info(`🔌 User ${socket.userId} joined role room: role:${socket.userRole}`);
                }
                // Send connection confirmation
                socket.emit("connection_confirmed", {
                    userId: socket.userId,
                    socketId: socket.id,
                    timestamp: new Date(),
                });
                // Send current available drivers to new customer and driver connections
                if (socket.userRole === 'USER' || socket.userRole === 'DRIVER') {
                    this.sendAvailableDriversToUser(socket.userId);
                }
            }
            // Add wildcard listener to catch all events for debugging
            socket.onAny((eventName, ...args) => {
                logger_1.default.info(`🌟 WebSocket Event Received: ${eventName} from user ${socket.userId}`, args);
            });
            // Enhanced location tracking handler
            socket.on("location:update", (data) => {
                logger_1.default.info(`📍 Received location:update from ${socket.userId}:`, data);
                this.handleLocationUpdate(socket, data);
            });
            // Enhanced provider status handler (for mobile driver apps)
            socket.on("provider:status", (data) => {
                logger_1.default.info(`👤 Received provider:status from ${socket.userId} (${socket.userRole}):`, data);
                this.handleProviderStatusUpdate(socket, data);
            });
            // Room management
            socket.on("join_room", (roomName) => {
                socket.join(roomName);
                logger_1.default.info(`🔌 User ${socket.userId} joined room: ${roomName}`);
            });
            socket.on("leave_room", (roomName) => {
                socket.leave(roomName);
                logger_1.default.info(`🔌 User ${socket.userId} left room: ${roomName}`);
            });
            // Booking events
            socket.on("booking:join", (bookingId) => {
                logger_1.default.info(`📚 Received booking:join from ${socket.userId} for booking ${bookingId}`);
                this.handleBookingJoin(socket, bookingId);
            });
            socket.on("booking:leave", (bookingId) => {
                logger_1.default.info(`📚 Received booking:leave from ${socket.userId} for booking ${bookingId}`);
                this.handleBookingLeave(socket, bookingId);
            });
            // Emergency booking events
            socket.on("emergency_booking:join", (bookingId) => {
                logger_1.default.info(`🚨 Received emergency_booking:join from ${socket.userId} for booking ${bookingId}`);
                this.handleEmergencyBookingJoin(socket, bookingId);
            });
            socket.on("emergency_booking:leave", (bookingId) => {
                logger_1.default.info(`🚨 Received emergency_booking:leave from ${socket.userId} for booking ${bookingId}`);
                this.handleEmergencyBookingLeave(socket, bookingId);
            });
            socket.on("booking:update", (data) => {
                logger_1.default.info(`📚 Received booking:update from ${socket.userId} for booking ${data.bookingId}:`, data);
                this.handleBookingUpdate(socket, data);
            });
            // Chat events
            socket.on("chat:join", (bookingId) => {
                logger_1.default.info(`💬 Received chat:join from ${socket.userId} for booking ${bookingId}`);
                this.handleChatJoin(socket, bookingId);
            });
            socket.on("chat:message", (data) => {
                logger_1.default.info(`💬 Received chat:message from ${socket.userId} for booking ${data.bookingId}:`, data);
                this.handleChatMessage(socket, data);
            });
            socket.on("chat:typing", (data) => {
                logger_1.default.info(`💬 Received chat:typing from ${socket.userId} for booking ${data.bookingId}:`, data);
                this.handleTypingIndicator(socket, data);
            });
            socket.on("chat:read", (messageId) => {
                logger_1.default.info(`💬 Received chat:read from ${socket.userId} for message ${messageId}`);
                this.handleMessageRead(socket, messageId);
            });
            // Emergency events
            socket.on("emergency:alert", (data) => {
                logger_1.default.info(`🚨 Received emergency:alert from ${socket.userId}:`, data);
                this.handleEmergencyAlert(socket, data);
            });
            socket.on("emergency:response", (data) => {
                logger_1.default.info(`🚨 Received emergency:response from ${socket.userId} for alert ${data.alertId}:`, data);
                this.handleEmergencyResponse(socket, data);
            });
            // Emergency location sharing events
            socket.on("emergency:share_location", (data) => {
                logger_1.default.info(`📍 Received emergency:share_location from ${socket.userId}:`, data);
                this.handleEmergencyLocationShare(socket, data);
            });
            socket.on("emergency:stop_location_sharing", (data) => {
                logger_1.default.info(`📍 Received emergency:stop_location_sharing from ${socket.userId}:`, data);
                this.handleStopEmergencyLocationSharing(socket, data);
            });
            socket.on("emergency:track_location", (data) => {
                logger_1.default.info(`📍 Received emergency:track_location from ${socket.userId}:`, data);
                this.handleEmergencyLocationTrack(socket, data);
            });
            // Disconnect handling
            socket.on("disconnect", (reason) => {
                this.handleDisconnect(socket, reason);
            });
            // Error handling
            socket.on("error", (error) => {
                logger_1.default.error(`❌ Socket error for user ${socket.userId} (${socket.id}):`, error);
            });
        });
    }
    /**
     * Enhanced location update handler with database persistence and broadcasting
     */
    async handleLocationUpdate(socket, data) {
        try {
            if (!socket.userId) {
                logger_1.default.warn(`📍 Location update received from unauthenticated socket ${socket.id}. Ignoring.`);
                return;
            }
            logger_1.default.info(`📍 Processing location update for user ${socket.userId}: Lat ${data.latitude}, Lon ${data.longitude}`);
            // Get user info for cache
            const userInfo = socket.userInfo || {};
            // Update in-memory driver location cache
            this.driverLocations.set(socket.userId, {
                latitude: data.latitude,
                longitude: data.longitude,
                heading: data.heading,
                timestamp: new Date(),
                isOnline: true,
                isAvailable: true,
                role: socket.userRole || 'UNKNOWN',
                name: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Driver',
                avatar: userInfo.avatar,
                rating: 5.0, // Default rating, should be fetched from profile
            });
            logger_1.default.info(`📍 Updated in-memory location cache for user ${socket.userId}`);
            // Get user with profiles to determine which profile to update
            const user = await database_1.default.user.findUnique({
                where: { id: socket.userId },
                include: {
                    driverProfile: true,
                    taxiDriverProfile: true,
                    deliveryProfile: true,
                    emergencyProfile: true,
                },
            });
            if (!user) {
                logger_1.default.warn(`📍 User ${socket.userId} not found for location update. Ignoring.`);
                return;
            }
            // Update location in database based on user profile type
            const updatePromises = [];
            if (user.driverProfile) {
                updatePromises.push(database_1.default.driverProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        currentLatitude: data.latitude,
                        currentLongitude: data.longitude,
                        heading: data.heading,
                    },
                }));
                logger_1.default.info(`📍 Updating driver profile location for user ${socket.userId}`);
            }
            if (user.taxiDriverProfile) {
                updatePromises.push(database_1.default.taxiDriverProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        currentLatitude: data.latitude,
                        currentLongitude: data.longitude,
                        heading: data.heading,
                    },
                }));
                logger_1.default.info(`📍 Updating taxi driver profile location for user ${socket.userId}`);
            }
            if (user.deliveryProfile) {
                updatePromises.push(database_1.default.deliveryProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        currentLatitude: data.latitude,
                        currentLongitude: data.longitude,
                        heading: data.heading,
                    },
                }));
                logger_1.default.info(`📍 Updating delivery profile location for user ${socket.userId}`);
            }
            if (user.emergencyProfile) {
                updatePromises.push(database_1.default.emergencyProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        currentLatitude: data.latitude,
                        currentLongitude: data.longitude,
                    },
                }));
                logger_1.default.info(`📍 Updating emergency profile location for user ${socket.userId}`);
            }
            // Execute all updates
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                logger_1.default.info(`📍 Database location updated for user ${socket.userId}`);
            }
            // Store location history
            try {
                await database_1.default.driverLocationHistory.create({
                    data: {
                        driverId: socket.userId,
                        latitude: data.latitude,
                        longitude: data.longitude,
                        heading: data.heading,
                        speed: data.speed || null,
                    },
                });
                logger_1.default.info(`📍 Location history stored for user ${socket.userId}`);
            }
            catch (historyError) {
                logger_1.default.warn(`📍 Could not store location history for user ${socket.userId}:`, historyError);
            }
            // Send confirmation back to the driver
            socket.emit("location_update_confirmed", {
                userId: socket.userId,
                latitude: data.latitude,
                longitude: data.longitude,
                timestamp: new Date(),
            });
            // Broadcast location to customers in active bookings
            const activeBookings = await database_1.default.booking.findMany({
                where: {
                    OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
                    status: { in: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "IN_PROGRESS"] },
                },
            });
            for (const booking of activeBookings) {
                const otherUserId = booking.customerId === socket.userId ? booking.providerId : booking.customerId;
                if (otherUserId) {
                    logger_1.default.info(`📍 Broadcasting location update for booking ${booking.id} to user ${otherUserId}`);
                    await this.notifyUser(otherUserId, "driver_location_update", {
                        bookingId: booking.id,
                        driverId: socket.userId,
                        latitude: data.latitude,
                        longitude: data.longitude,
                        heading: data.heading,
                        speed: data.speed,
                        timestamp: data.timestamp,
                    });
                }
            }
            logger_1.default.info(`📍 Location update processed successfully for user ${socket.userId}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling location update for user ${socket.userId}:`, error);
            socket.emit("location_update_error", {
                error: "Failed to update location",
                timestamp: new Date(),
            });
        }
    }
    /**
     * Enhanced provider status update handler (handles provider:status events from mobile apps)
     */
    async handleProviderStatusUpdate(socket, data) {
        try {
            if (!socket.userId) {
                logger_1.default.warn(`👤 Provider status update received from unauthenticated socket ${socket.id}. Ignoring.`);
                return;
            }
            logger_1.default.info(`👤 Processing provider status update for user ${socket.userId}:`, {
                isOnline: data.isOnline,
                isAvailable: data.isAvailable,
                hasLocation: !!(data.currentLatitude && data.currentLongitude),
                driverStatus: data.driverStatus
            });
            // Get user info for cache
            const userInfo = socket.userInfo || {};
            // Update in-memory driver location cache if location is provided
            if (data.currentLatitude && data.currentLongitude) {
                const existingData = this.driverLocations.get(socket.userId);
                this.driverLocations.set(socket.userId, {
                    latitude: data.currentLatitude,
                    longitude: data.currentLongitude,
                    heading: data.heading,
                    timestamp: new Date(),
                    isOnline: data.isOnline,
                    isAvailable: data.isAvailable,
                    role: socket.userRole || 'UNKNOWN',
                    name: `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || 'Driver',
                    avatar: userInfo.avatar,
                    rating: existingData?.rating || 5.0,
                    vehicleModel: existingData?.vehicleModel,
                    licensePlate: existingData?.licensePlate,
                });
                logger_1.default.info(`👤 Updated in-memory location cache for user ${socket.userId} - Online: ${data.isOnline}, Available: ${data.isAvailable}`);
            }
            else {
                // Update status only if no location provided
                const existingData = this.driverLocations.get(socket.userId);
                if (existingData) {
                    existingData.isOnline = data.isOnline;
                    existingData.isAvailable = data.isAvailable;
                    existingData.timestamp = new Date();
                    this.driverLocations.set(socket.userId, existingData);
                    logger_1.default.info(`👤 Updated status in cache for user ${socket.userId} - Online: ${data.isOnline}, Available: ${data.isAvailable}`);
                }
            }
            const user = await database_1.default.user.findUnique({
                where: { id: socket.userId },
                include: {
                    driverProfile: { include: { vehicle: true } },
                    taxiDriverProfile: { include: { vehicle: true } },
                    deliveryProfile: { include: { vehicle: true } },
                    moverProfile: true,
                    emergencyProfile: true,
                },
            });
            if (!user) {
                logger_1.default.warn(`👤 User ${socket.userId} not found for provider status update. Ignoring.`);
                return;
            }
            // Update provider status in database based on user profile type
            const updatePromises = [];
            if (user.driverProfile) {
                const updateData = {
                    isOnline: data.isOnline,
                    isAvailable: data.isAvailable,
                };
                if (data.currentLatitude && data.currentLongitude) {
                    updateData.currentLatitude = data.currentLatitude;
                    updateData.currentLongitude = data.currentLongitude;
                    updateData.heading = data.heading;
                }
                updatePromises.push(database_1.default.driverProfile.update({
                    where: { userId: socket.userId },
                    data: updateData,
                }));
                // Update cache with vehicle info
                if (user.driverProfile.vehicle) {
                    const cacheData = this.driverLocations.get(socket.userId);
                    if (cacheData) {
                        cacheData.vehicleModel = user.driverProfile.vehicle.model;
                        cacheData.licensePlate = user.driverProfile.vehicle.licensePlate;
                        cacheData.rating = user.driverProfile.rating || 5.0;
                        this.driverLocations.set(socket.userId, cacheData);
                    }
                }
                logger_1.default.info(`👤 Updating driver profile status for user ${socket.userId}`);
            }
            if (user.taxiDriverProfile) {
                const updateData = {
                    isOnline: data.isOnline,
                    isAvailable: data.isAvailable,
                };
                if (data.currentLatitude && data.currentLongitude) {
                    updateData.currentLatitude = data.currentLatitude;
                    updateData.currentLongitude = data.currentLongitude;
                    updateData.heading = data.heading;
                }
                updatePromises.push(database_1.default.taxiDriverProfile.update({
                    where: { userId: socket.userId },
                    data: updateData,
                }));
                // Update cache with vehicle info
                if (user.taxiDriverProfile.vehicle) {
                    const cacheData = this.driverLocations.get(socket.userId);
                    if (cacheData) {
                        cacheData.vehicleModel = user.taxiDriverProfile.vehicle.model;
                        cacheData.licensePlate = user.taxiDriverProfile.vehicle.licensePlate;
                        cacheData.rating = user.taxiDriverProfile.rating || 5.0;
                        this.driverLocations.set(socket.userId, cacheData);
                    }
                }
                logger_1.default.info(`👤 Updating taxi driver profile status for user ${socket.userId}`);
            }
            if (user.deliveryProfile) {
                const updateData = {
                    isOnline: data.isOnline,
                    isAvailable: data.isAvailable,
                };
                if (data.currentLatitude && data.currentLongitude) {
                    updateData.currentLatitude = data.currentLatitude;
                    updateData.currentLongitude = data.currentLongitude;
                    updateData.heading = data.heading;
                }
                updatePromises.push(database_1.default.deliveryProfile.update({
                    where: { userId: socket.userId },
                    data: updateData,
                }));
                // Update cache with vehicle info
                if (user.deliveryProfile.vehicle) {
                    const cacheData = this.driverLocations.get(socket.userId);
                    if (cacheData) {
                        cacheData.vehicleModel = user.deliveryProfile.vehicle.model;
                        cacheData.licensePlate = user.deliveryProfile.vehicle.licensePlate;
                        cacheData.rating = user.deliveryProfile.rating || 5.0;
                        this.driverLocations.set(socket.userId, cacheData);
                    }
                }
                logger_1.default.info(`👤 Updating delivery profile status for user ${socket.userId}`);
            }
            if (user.moverProfile) {
                updatePromises.push(database_1.default.moverProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        isOnline: data.isOnline,
                        isAvailable: data.isAvailable,
                    },
                }));
                logger_1.default.info(`👤 Updating mover profile status for user ${socket.userId}`);
            }
            if (user.emergencyProfile) {
                const updateData = {
                    isOnDuty: data.isOnline,
                };
                if (data.currentLatitude && data.currentLongitude) {
                    updateData.currentLatitude = data.currentLatitude;
                    updateData.currentLongitude = data.currentLongitude;
                }
                updatePromises.push(database_1.default.emergencyProfile.update({
                    where: { userId: socket.userId },
                    data: updateData,
                }));
                logger_1.default.info(`👤 Updating emergency profile status for user ${socket.userId}`);
            }
            // Execute all updates
            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
                logger_1.default.info(`👤 Database status updated for user ${socket.userId}`);
            }
            // Send confirmation back to the provider
            socket.emit("provider_status_confirmed", {
                userId: socket.userId,
                isOnline: data.isOnline,
                isAvailable: data.isAvailable,
                timestamp: new Date(),
            });
            // Broadcast status update to admin dashboard
            this.broadcastToRole("ADMIN", "provider_status_update", {
                userId: socket.userId,
                userRole: socket.userRole,
                isOnline: data.isOnline,
                isAvailable: data.isAvailable,
                location: data.currentLatitude && data.currentLongitude ? {
                    latitude: data.currentLatitude,
                    longitude: data.currentLongitude
                } : null,
                timestamp: new Date(),
            });
            // If driver went offline, remove from cache
            if (!data.isOnline) {
                this.driverLocations.delete(socket.userId);
                logger_1.default.info(`👤 Removed user ${socket.userId} from driver locations cache (went offline)`);
            }
            logger_1.default.info(`👤 Provider status update processed successfully for user ${socket.userId}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling provider status update for user ${socket.userId}:`, error);
            socket.emit("provider_status_error", {
                error: "Failed to update provider status",
                timestamp: new Date(),
            });
        }
    }
    /**
     * Send notification to specific user via WebSocket or email fallback.
     */
    async notifyUser(userId, event, data) {
        try {
            logger_1.default.info(`🔔 Attempting to notify user ${userId} with event '${event}'`);
            const socketId = this.connectedUsers.get(userId);
            if (socketId) {
                logger_1.default.info(`🔔 User ${userId} is online. Sending via WebSocket.`);
                this.io.to(socketId).emit(event, data);
                this.io.to(`user:${userId}`).emit(event, data);
                this.io.to(`user_${userId}`).emit(event, data);
                logger_1.default.info(`✅ WebSocket notification sent to user ${userId} for event '${event}'.`);
                return true;
            }
            // Fallback to email
            logger_1.default.warn(`⚠️ User ${userId} is not online via WebSocket. Attempting email fallback.`);
            const user = await database_1.default.user.findUnique({ where: { id: userId } });
            if (user?.email) {
                await this.emailService.sendNotificationEmail(user.email, data.title || "New Update from TripSync", data.body || "You have a new update in your app. Please check for details.");
                logger_1.default.info(`📧 Email fallback sent to user ${userId} for event '${event}'.`);
                return true;
            }
            logger_1.default.warn(`❌ User ${userId} is offline and has no email for event '${event}'.`);
            return false;
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to notify user ${userId} for event '${event}':`, error);
            return false;
        }
    }
    /**
     * Send notification to multiple users.
     */
    async notifyUsers(userIds, event, data) {
        logger_1.default.info(`🔔 Attempting to notify ${userIds.length} users with event '${event}'.`);
        let notifiedCount = 0;
        for (const userId of userIds) {
            const success = await this.notifyUser(userId, event, data);
            if (success)
                notifiedCount++;
        }
        logger_1.default.info(`🔔 Notified ${notifiedCount} out of ${userIds.length} users for event '${event}'.`);
        return notifiedCount;
    }
    /**
     * Broadcast to all users with specific role.
     */
    async broadcastToRole(role, event, data) {
        try {
            logger_1.default.info(`📢 Broadcasting event '${event}' to role: ${role}`);
            this.io.to(`role:${role}`).emit(event, data);
            logger_1.default.info(`✅ Broadcasted event '${event}' to role: ${role}.`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to broadcast event '${event}' to role '${role}':`, error);
        }
    }
    /**
     * Emit to a specific room.
     */
    async emitToRoom(roomName, event, data) {
        try {
            logger_1.default.info(`🏠 Emitting event '${event}' to room: ${roomName}`);
            this.io.to(roomName).emit(event, data);
            logger_1.default.info(`✅ Emitted event '${event}' to room: ${roomName}.`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to emit event '${event}' to room '${roomName}':`, error);
        }
    }
    /**
     * Get online users count.
     */
    getOnlineUsersCount() {
        return this.connectedUsers.size;
    }
    /**
     * Get online users by role.
     */
    async getOnlineUsersByRole(role) {
        try {
            const sockets = await this.io.in(`role:${role}`).fetchSockets();
            const userIds = sockets.map((socket) => socket.userId).filter(Boolean);
            logger_1.default.info(`👥 Found ${userIds.length} online users for role '${role}'.`);
            return userIds;
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to get online users by role '${role}':`, error);
            return [];
        }
    }
    /**
     * Check if user is online.
     */
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
    /**
     * Send available drivers to a specific customer
     */
    async sendAvailableDriversToUser(userId) {
        try {
            const driversData = this.getAvailableDriversData();
            await this.notifyUser(userId, "available_drivers_update", driversData);
            logger_1.default.info(`📍 Sent ${driversData.length} available drivers to user ${userId}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error sending available drivers to user ${userId}:`, error);
        }
    }
    /**
     * Get available drivers data from cache and database
     */
    getAvailableDriversData() {
        const driversData = [];
        // Get from in-memory cache first (for real-time data)
        this.driverLocations.forEach((location, userId) => {
            if (location.isOnline && location.isAvailable) {
                driversData.push({
                    id: userId,
                    name: location.name || 'Driver',
                    photoUrl: location.avatar,
                    rating: location.rating || 5.0,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    heading: location.heading,
                    vehicleModel: location.vehicleModel,
                    licensePlate: location.licensePlate,
                    type: location.role,
                    timestamp: location.timestamp,
                });
            }
        });
        logger_1.default.info(`📍 Found ${driversData.length} available drivers in cache`);
        return driversData;
    }
    /**
     * Broadcasts the locations of all available drivers to all connected customers and drivers.
     */
    async broadcastAvailableDrivers() {
        try {
            // Get available drivers from cache
            const driversData = this.getAvailableDriversData();
            if (driversData.length === 0) {
                logger_1.default.info(`📢 No available drivers to broadcast`);
                return;
            }
            logger_1.default.info(`📢 Broadcasting ${driversData.length} available drivers to all customers and drivers`);
            // Broadcast to all customers
            this.broadcastToRole("USER", "available_drivers_update", driversData);
            // Broadcast to all drivers (so they can see other drivers on the map)
            this.broadcastToRole("DRIVER", "available_drivers_update", driversData);
            // Also broadcast to web dashboard and any other connected clients
            this.io.emit("available_drivers_update", driversData);
            logger_1.default.info(`✅ Broadcasted ${driversData.length} available drivers successfully`);
        }
        catch (error) {
            logger_1.default.error("❌ Error broadcasting available drivers:", error);
        }
    }
    /**
     * Clean up stale driver locations from cache (older than 5 minutes)
     */
    cleanupStaleDriverLocations() {
        const now = new Date();
        const staleThreshold = 5 * 60 * 1000; // 5 minutes
        let cleanedCount = 0;
        this.driverLocations.forEach((location, userId) => {
            if (now.getTime() - location.timestamp.getTime() > staleThreshold) {
                this.driverLocations.delete(userId);
                cleanedCount++;
            }
        });
        if (cleanedCount > 0) {
            logger_1.default.info(`🧹 Cleaned up ${cleanedCount} stale driver locations from cache`);
        }
    }
    /**
     * Handle booking join
     */
    async handleBookingJoin(socket, bookingId) {
        try {
            if (!socket.userId)
                return;
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: bookingId,
                    OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
                },
            });
            if (booking) {
                socket.join(`booking:${bookingId}`);
                logger_1.default.info(`📚 User ${socket.userId} joined booking room: ${bookingId}`);
            }
            else {
                logger_1.default.warn(`📚 User ${socket.userId} attempted to join unauthorized booking room: ${bookingId}`);
            }
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling booking join:`, error);
        }
    }
    /**
     * Handle booking leave
     */
    handleBookingLeave(socket, bookingId) {
        socket.leave(`booking:${bookingId}`);
        logger_1.default.info(`📚 User ${socket.userId} left booking room: ${bookingId}`);
    }
    /**
     * Handle emergency booking join
     */
    async handleEmergencyBookingJoin(socket, bookingId) {
        try {
            if (!socket.userId)
                return;
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: bookingId,
                    OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
                    serviceType: {
                        category: "EMERGENCY",
                    },
                },
            });
            if (booking) {
                socket.join(`emergency_booking:${bookingId}`);
                logger_1.default.info(`🚨 User ${socket.userId} joined emergency booking room: ${bookingId}`);
            }
            else {
                logger_1.default.warn(`🚨 User ${socket.userId} attempted to join unauthorized emergency booking room: ${bookingId}`);
            }
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling emergency booking join:`, error);
        }
    }
    /**
     * Handle emergency booking leave
     */
    handleEmergencyBookingLeave(socket, bookingId) {
        socket.leave(`emergency_booking:${bookingId}`);
        logger_1.default.info(`🚨 User ${socket.userId} left emergency booking room: ${bookingId}`);
    }
    /**
     * Handle booking update
     */
    async handleBookingUpdate(socket, data) {
        try {
            if (!socket.userId)
                return;
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: data.bookingId,
                    providerId: socket.userId,
                },
                include: {
                    customer: true,
                    provider: true,
                },
            });
            if (!booking) {
                logger_1.default.warn(`📚 Unauthorized booking update attempt by ${socket.userId}`);
                return;
            }
            await database_1.default.booking.update({
                where: { id: data.bookingId },
                data: { status: data.status },
            });
            const updateData = {
                bookingId: data.bookingId,
                status: data.status,
                message: data.message,
                timestamp: new Date(),
            };
            this.io.to(`booking:${data.bookingId}`).emit("booking_update", updateData);
            // Send email if customer is offline
            if (!this.isUserOnline(booking.customerId) && booking.customer?.email) {
                await this.emailService.sendNotificationEmail(booking.customer.email, "Booking Update", data.message || `Your booking status has been updated to ${data.status}`);
            }
            logger_1.default.info(`📚 Booking ${data.bookingId} updated to ${data.status}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling booking update:`, error);
        }
    }
    /**
     * Handle chat join
     */
    handleChatJoin(socket, bookingId) {
        socket.join(`chat:${bookingId}`);
        logger_1.default.info(`💬 User ${socket.userId} joined chat room: ${bookingId}`);
    }
    /**
     * Handle chat message
     */
    async handleChatMessage(socket, data) {
        try {
            if (!socket.userId)
                return;
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: data.bookingId,
                    OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
                },
            });
            if (!booking) {
                logger_1.default.warn(`💬 Unauthorized chat message from ${socket.userId}`);
                return;
            }
            const message = {
                id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                ...data,
                senderId: socket.userId,
                timestamp: new Date(),
                isRead: false,
            };
            this.chatMessages.push(message);
            this.io.to(`chat:${data.bookingId}`).emit("chat:message", message);
            // Send email if receiver is offline
            if (!this.isUserOnline(data.receiverId)) {
                const receiver = await database_1.default.user.findUnique({ where: { id: data.receiverId } });
                if (receiver?.email) {
                    await this.emailService.sendNotificationEmail(receiver.email, "New Message", data.messageType === "TEXT" ? data.message : "You received a new message");
                }
            }
            logger_1.default.info(`💬 Chat message sent in booking ${data.bookingId}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling chat message:`, error);
        }
    }
    /**
     * Handle typing indicator
     */
    handleTypingIndicator(socket, data) {
        socket.to(`chat:${data.bookingId}`).emit("chat:typing", {
            userId: socket.userId,
            isTyping: data.isTyping,
        });
    }
    /**
     * Handle message read
     */
    handleMessageRead(socket, messageId) {
        const messageIndex = this.chatMessages.findIndex((msg) => msg.id === messageId);
        if (messageIndex >= 0) {
            this.chatMessages[messageIndex].isRead = true;
            const message = this.chatMessages[messageIndex];
            this.notifyUser(message.senderId, "chat:read", { messageId });
        }
    }
    /**
     * Handle emergency alert
     */
    async handleEmergencyAlert(socket, data) {
        try {
            if (!socket.userId)
                return;
            const alert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                ...data,
                userId: socket.userId,
                timestamp: new Date(),
                isActive: true,
            };
            const nearbyResponders = await this.findNearbyEmergencyResponders(data.location.latitude, data.location.longitude, 10);
            for (const responder of nearbyResponders) {
                await this.notifyUser(responder.userId, "emergency:alert", alert);
            }
            this.broadcastToRole("EMERGENCY", "emergency:alert", alert);
            logger_1.default.info(`🚨 Emergency alert ${alert.id} broadcast to responders`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling emergency alert:`, error);
        }
    }
    /**
     * Handle emergency response
     */
    async handleEmergencyResponse(socket, data) {
        try {
            if (!socket.userId)
                return;
            this.io.emit("emergency:response", {
                ...data,
                timestamp: new Date(),
            });
            logger_1.default.info(`🚨 Emergency response recorded for alert ${data.alertId}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling emergency response:`, error);
        }
    }
    /**
     * Handle emergency location sharing
     */
    async handleEmergencyLocationShare(socket, data) {
        try {
            if (!socket.userId)
                return;
            // Import emergency service dynamically to avoid circular dependency
            const { EmergencyService } = await Promise.resolve().then(() => __importStar(require("./emergency.service")));
            const emergencyService = new EmergencyService();
            const result = await emergencyService.shareLocationWithEmergencyContacts(socket.userId, {
                latitude: data.latitude,
                longitude: data.longitude,
                accuracy: data.accuracy,
                address: data.address,
            }, data.isRealTime || false, data.bookingId);
            // Send confirmation back to the user
            socket.emit("emergency_location_share_confirmed", {
                userId: socket.userId,
                sharedCount: result.sharedCount,
                locationShareId: result.locationShareId,
                timestamp: new Date(),
            });
            logger_1.default.info(`📍 Emergency location shared by ${socket.userId} with ${result.sharedCount} contacts`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling emergency location share:`, error);
            socket.emit("emergency_location_share_error", {
                error: "Failed to share location",
                timestamp: new Date(),
            });
        }
    }
    /**
     * Handle stop emergency location sharing
     */
    async handleStopEmergencyLocationSharing(socket, data) {
        try {
            if (!socket.userId)
                return;
            // Import emergency service dynamically to avoid circular dependency
            const { EmergencyService } = await Promise.resolve().then(() => __importStar(require("./emergency.service")));
            const emergencyService = new EmergencyService();
            const result = await emergencyService.stopLocationSharing(socket.userId, data.bookingId);
            // Send confirmation back to the user
            socket.emit("emergency_location_sharing_stopped_confirmed", {
                userId: socket.userId,
                stoppedCount: result.stoppedCount,
                timestamp: new Date(),
            });
            logger_1.default.info(`📍 Emergency location sharing stopped by ${socket.userId} for ${result.stoppedCount} shares`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling stop emergency location sharing:`, error);
            socket.emit("emergency_location_sharing_stop_error", {
                error: "Failed to stop location sharing",
                timestamp: new Date(),
            });
        }
    }
    /**
     * Handle emergency location tracking
     */
    async handleEmergencyLocationTrack(socket, data) {
        try {
            if (!socket.userId)
                return;
            // Store location update in database
            await database_1.default.emergencyLocationUpdate.create({
                data: {
                    userId: socket.userId,
                    bookingId: data.bookingId,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    accuracy: data.accuracy,
                    heading: data.heading,
                    speed: data.speed,
                    timestamp: new Date(),
                },
            });
            // Broadcast location update to emergency booking room
            if (data.bookingId) {
                await this.emitToRoom(`emergency_booking:${data.bookingId}`, "emergency_user_location_update", {
                    userId: socket.userId,
                    bookingId: data.bookingId,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    accuracy: data.accuracy,
                    heading: data.heading,
                    speed: data.speed,
                    timestamp: new Date(),
                });
            }
            // Send confirmation back to the user
            socket.emit("emergency_location_track_confirmed", {
                userId: socket.userId,
                latitude: data.latitude,
                longitude: data.longitude,
                timestamp: new Date(),
            });
            logger_1.default.info(`📍 Emergency location tracked for user ${socket.userId}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Error handling emergency location track:`, error);
            socket.emit("emergency_location_track_error", {
                error: "Failed to track location",
                timestamp: new Date(),
            });
        }
    }
    /**
     * Handle disconnect
     */
    handleDisconnect(socket, reason) {
        logger_1.default.info(`🔌 User disconnected: ${socket.userId} (${socket.id}) - Reason: ${reason}`);
        if (socket.userId) {
            this.connectedUsers.delete(socket.userId);
            // Remove from driver locations cache
            this.driverLocations.delete(socket.userId);
            logger_1.default.info(`🔌 Removed user ${socket.userId} from caches`);
        }
        this.userSockets.delete(socket.id);
    }
    /**
     * Find nearby emergency responders
     */
    async findNearbyEmergencyResponders(latitude, longitude, radiusKm) {
        try {
            const responders = await database_1.default.emergencyProfile.findMany({
                where: {
                    isOnDuty: true,
                    currentLatitude: { not: null },
                    currentLongitude: { not: null },
                },
                include: { user: true },
            });
            const nearby = responders
                .map((responder) => {
                if (!responder.currentLatitude || !responder.currentLongitude)
                    return null;
                const distance = this.calculateDistance(latitude, longitude, responder.currentLatitude, responder.currentLongitude);
                return { userId: responder.userId, distance };
            })
                .filter((item) => item !== null && item.distance <= radiusKm)
                .sort((a, b) => a.distance - b.distance);
            return nearby;
        }
        catch (error) {
            logger_1.default.error("❌ Error finding nearby emergency responders:", error);
            return [];
        }
    }
    /**
     * Calculate distance between two points
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}
exports.WebSocketService = WebSocketService;
