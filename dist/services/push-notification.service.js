"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const email_service_1 = require("./email.service"); // Import EmailService
const logger_1 = __importDefault(require("../utils/logger"));
class WebSocketService {
    constructor(server) {
        this.emailService = new email_service_1.EmailService(); // Instantiate EmailService
        this.connectedUsers = new Map(); // userId -> socketId
        this.userSockets = new Map(); // socketId -> socket
        this.chatMessages = []; // Memory storage for missing model
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
    }
    setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];
                if (!token) {
                    return next(new Error("Authentication token required"));
                }
                const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
                const user = await database_1.default.user.findUnique({
                    where: { id: decoded.userId },
                    include: {
                        customerProfile: true,
                        driverProfile: true,
                        moverProfile: true,
                        emergencyProfile: true,
                    },
                });
                if (!user) {
                    return next(new Error("User not found"));
                }
                socket.userId = user.id;
                socket.userRole = user.role;
                socket.isAuthenticated = true;
                next();
            }
            catch (error) {
                logger_1.default.error("Socket authentication error:", error);
                next(new Error("Authentication failed"));
            }
        });
    }
    setupEventHandlers() {
        this.io.on("connection", (socket) => {
            logger_1.default.info(`User connected: ${socket.userId} (${socket.id})`);
            // Store connection
            if (socket.userId) {
                this.connectedUsers.set(socket.userId, socket.id);
                this.userSockets.set(socket.id, socket);
                // Join user-specific room
                socket.join(`user:${socket.userId}`);
                // Join role-specific rooms
                if (socket.userRole) {
                    socket.join(`role:${socket.userRole}`);
                }
            }
            // Location tracking
            socket.on("location:update", (data) => {
                this.handleLocationUpdate(socket, data);
            });
            // Real-time booking updates
            socket.on("booking:join", (bookingId) => {
                this.handleBookingJoin(socket, bookingId);
            });
            socket.on("booking:leave", (bookingId) => {
                this.handleBookingLeave(socket, bookingId);
            });
            socket.on("booking:update", (data) => {
                this.handleBookingUpdate(socket, data);
            });
            // Chat functionality
            socket.on("chat:join", (bookingId) => {
                this.handleChatJoin(socket, bookingId);
            });
            socket.on("chat:message", (data) => {
                this.handleChatMessage(socket, data);
            });
            socket.on("chat:typing", (data) => {
                this.handleTypingIndicator(socket, data);
            });
            socket.on("chat:read", (messageId) => {
                this.handleMessageRead(socket, messageId);
            });
            // Emergency alerts
            socket.on("emergency:alert", (data) => {
                this.handleEmergencyAlert(socket, data);
            });
            socket.on("emergency:response", (data) => {
                this.handleEmergencyResponse(socket, data);
            });
            // Driver/Provider status updates
            socket.on("provider:status", (data) => {
                this.handleProviderStatusUpdate(socket, data);
            });
            // Disconnect handling
            socket.on("disconnect", (reason) => {
                this.handleDisconnect(socket, reason);
            });
            // Error handling
            socket.on("error", (error) => {
                logger_1.default.error(`Socket error for user ${socket.userId}:`, error);
            });
        });
    }
    /**
     * Send notification to specific user
     */
    async notifyUser(userId, event, data) {
        try {
            const socketId = this.connectedUsers.get(userId);
            if (socketId) {
                this.io.to(`user:${userId}`).emit(event, data);
                return true;
            }
            // User not connected via WebSocket, send email as fallback
            logger_1.default.info(`User ${userId} is not online via WebSocket. Attempting to send email notification.`);
            const user = await database_1.default.user.findUnique({ where: { id: userId } });
            if (user?.email) {
                await this.emailService.sendNotificationEmail(user.email, data.title || "New Update from TripSync", data.body || "You have a new update in your app. Please check for details.");
                return true; // Email sent
            }
            logger_1.default.warn(`User ${userId} is offline and has no email to send fallback notification.`);
            return false; // Neither WebSocket nor email sent
        }
        catch (error) {
            logger_1.default.error("Notify user error:", error);
            return false;
        }
    }
    /**
     * Send notification to multiple users
     */
    async notifyUsers(userIds, event, data) {
        try {
            let notifiedCount = 0;
            for (const userId of userIds) {
                const success = await this.notifyUser(userId, event, data);
                if (success)
                    notifiedCount++;
            }
            return notifiedCount;
        }
        catch (error) {
            logger_1.default.error("Notify users error:", error);
            return 0;
        }
    }
    /**
     * Broadcast to all users with specific role
     */
    async broadcastToRole(role, event, data) {
        try {
            this.io.to(`role:${role}`).emit(event, data);
            logger_1.default.info(`Broadcasted ${event} to role: ${role}`);
        }
        catch (error) {
            logger_1.default.error("Broadcast to role error:", error);
        }
    }
    /**
     * Get online users count
     */
    getOnlineUsersCount() {
        return this.connectedUsers.size;
    }
    /**
     * Get online users by role
     */
    async getOnlineUsersByRole(role) {
        try {
            const sockets = await this.io.in(`role:${role}`).fetchSockets();
            return sockets.map((socket) => socket.userId).filter(Boolean);
        }
        catch (error) {
            logger_1.default.error("Get online users by role error:", error);
            return [];
        }
    }
    /**
     * Check if user is online
     */
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
    async handleLocationUpdate(socket, data) {
        try {
            if (!socket.userId)
                return;
            // Update user location in database
            const user = await database_1.default.user.findUnique({
                where: { id: socket.userId },
                include: {
                    driverProfile: true,
                    moverProfile: true,
                    emergencyProfile: true,
                },
            });
            if (!user)
                return;
            // Update location based on user role
            if (user.driverProfile) {
                await database_1.default.driverProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        currentLatitude: data.latitude,
                        currentLongitude: data.longitude,
                    },
                });
            }
            if (user.moverProfile) {
                await database_1.default.moverProfile.update({
                    where: { userId: socket.userId },
                    data: {
                    // Remove non-existent fields
                    // currentLatitude: data.latitude,
                    // currentLongitude: data.longitude,
                    },
                });
            }
            if (user.emergencyProfile) {
                await database_1.default.emergencyProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        currentLatitude: data.latitude,
                        currentLongitude: data.longitude,
                    },
                });
            }
            // Broadcast location to relevant parties (active bookings)
            const activeBookings = await database_1.default.booking.findMany({
                where: {
                    OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
                    status: { in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"] },
                },
            });
            for (const booking of activeBookings) {
                const otherUserId = booking.customerId === socket.userId ? booking.providerId : booking.customerId;
                if (otherUserId) {
                    await this.notifyUser(otherUserId, "location:update", {
                        bookingId: booking.id,
                        userId: socket.userId,
                        location: data,
                    });
                }
            }
        }
        catch (error) {
            logger_1.default.error("Handle location update error:", error);
        }
    }
    async handleBookingJoin(socket, bookingId) {
        try {
            // Verify user has access to this booking
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: bookingId,
                    OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
                },
            });
            if (booking) {
                socket.join(`booking:${bookingId}`);
                logger_1.default.info(`User ${socket.userId} joined booking room: ${bookingId}`);
            }
        }
        catch (error) {
            logger_1.default.error("Handle booking join error:", error);
        }
    }
    handleBookingLeave(socket, bookingId) {
        socket.leave(`booking:${bookingId}`);
        logger_1.default.info(`User ${socket.userId} left booking room: ${bookingId}`);
    }
    async handleBookingUpdate(socket, data) {
        try {
            // Verify user has permission to update this booking
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: data.bookingId,
                    providerId: socket.userId, // Only providers can send updates
                },
            });
            if (!booking)
                return;
            // Update booking status if provided
            if (data.status) {
                await database_1.default.booking.update({
                    where: { id: data.bookingId },
                    data: { status: data.status },
                });
            }
            // Broadcast update to booking room
            this.io.to(`booking:${data.bookingId}`).emit("booking:update", {
                ...data,
                timestamp: new Date(),
            });
            // Send email to customer if they are not online
            if (booking.customerId && !this.isUserOnline(booking.customerId)) {
                const customer = await database_1.default.user.findUnique({ where: { id: booking.customerId } });
                if (customer?.email) {
                    await this.emailService.sendNotificationEmail(customer.email, "Booking Update", data.message || `Your booking status has been updated to ${data.status}`);
                }
            }
        }
        catch (error) {
            logger_1.default.error("Handle booking update error:", error);
        }
    }
    handleChatJoin(socket, bookingId) {
        socket.join(`chat:${bookingId}`);
        logger_1.default.info(`User ${socket.userId} joined chat room: ${bookingId}`);
    }
    async handleChatMessage(socket, data) {
        try {
            // Verify user has access to this booking's chat
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: data.bookingId,
                    OR: [{ customerId: socket.userId }, { providerId: socket.userId }],
                },
            });
            if (!booking)
                return;
            const message = {
                id: `msg_${Date.now()}_${Math.random()}`,
                ...data,
                senderId: socket.userId,
                timestamp: new Date(),
                isRead: false,
            };
            // Store message in memory (would be database in production)
            this.chatMessages.push(message);
            // Broadcast message to chat room
            this.io.to(`chat:${data.bookingId}`).emit("chat:message", message);
            // Send email to receiver if they're offline
            if (!this.isUserOnline(data.receiverId)) {
                const receiver = await database_1.default.user.findUnique({ where: { id: data.receiverId } });
                if (receiver?.email) {
                    await this.emailService.sendNotificationEmail(receiver.email, "New Message", data.messageType === "TEXT" ? data.message : "You received a new message");
                }
            }
        }
        catch (error) {
            logger_1.default.error("Handle chat message error:", error);
        }
    }
    handleTypingIndicator(socket, data) {
        socket.to(`chat:${data.bookingId}`).emit("chat:typing", {
            userId: socket.userId,
            isTyping: data.isTyping,
        });
    }
    handleMessageRead(socket, messageId) {
        // Update message read status in memory
        const messageIndex = this.chatMessages.findIndex((msg) => msg.id === messageId);
        if (messageIndex >= 0) {
            this.chatMessages[messageIndex].isRead = true;
        }
        // Notify sender that message was read
        const message = this.chatMessages[messageIndex];
        if (message) {
            this.notifyUser(message.senderId, "chat:read", { messageId });
        }
    }
    async handleEmergencyAlert(socket, data) {
        try {
            const alert = {
                id: `alert_${Date.now()}_${Math.random()}`,
                ...data,
                userId: socket.userId,
                timestamp: new Date(),
                isActive: true,
            };
            // Find nearby emergency responders
            const nearbyResponders = await this.findNearbyEmergencyResponders(data.location.latitude, data.location.longitude, 10);
            // Broadcast alert to emergency responders
            for (const responder of nearbyResponders) {
                await this.notifyUser(responder.userId, "emergency:alert", alert);
            }
            // Also broadcast to emergency role
            this.broadcastToRole("EMERGENCY", "emergency:alert", alert);
            logger_1.default.info(`Emergency alert created: ${alert.id}`);
        }
        catch (error) {
            logger_1.default.error("Handle emergency alert error:", error);
        }
    }
    async handleEmergencyResponse(socket, data) {
        try {
            // Notify alert creator about the response
            this.io.emit("emergency:response", {
                ...data,
                timestamp: new Date(),
            });
            logger_1.default.info(`Emergency response received for alert: ${data.alertId}`);
        }
        catch (error) {
            logger_1.default.error("Handle emergency response error:", error);
        }
    }
    async handleProviderStatusUpdate(socket, data) {
        try {
            if (!socket.userId)
                return;
            const user = await database_1.default.user.findUnique({
                where: { id: socket.userId },
                include: {
                    driverProfile: true,
                    moverProfile: true,
                    emergencyProfile: true,
                },
            });
            if (!user)
                return;
            // Update provider status based on role
            if (user.driverProfile) {
                await database_1.default.driverProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        isOnline: data.isOnline,
                        isAvailable: data.isAvailable,
                    },
                });
            }
            if (user.moverProfile) {
                await database_1.default.moverProfile.update({
                    where: { userId: socket.userId },
                    data: {
                        isOnline: data.isOnline,
                        isAvailable: data.isAvailable,
                    },
                });
            }
            if (user.emergencyProfile) {
                await database_1.default.emergencyProfile.updateMany({
                    where: { userId: socket.userId },
                    data: {
                        isOnDuty: data.isOnline,
                    },
                });
            }
            // Broadcast status update to admin dashboard
            this.broadcastToRole("ADMIN", "provider:status", {
                userId: socket.userId,
                ...data,
                timestamp: new Date(),
            });
        }
        catch (error) {
            logger_1.default.error("Handle provider status update error:", error);
        }
    }
    handleDisconnect(socket, reason) {
        logger_1.default.info(`User disconnected: ${socket.userId} (${socket.id}) - Reason: ${reason}`);
        if (socket.userId) {
            this.connectedUsers.delete(socket.userId);
        }
        this.userSockets.delete(socket.id);
    }
    async findNearbyEmergencyResponders(latitude, longitude, radiusKm) {
        try {
            const responders = await database_1.default.emergencyProfile.findMany({
                where: {
                    isOnDuty: true,
                    currentLatitude: { not: null },
                    currentLongitude: { not: null },
                },
                include: {
                    user: true,
                },
            });
            const nearby = responders
                .map((responder) => {
                if (!responder.currentLatitude || !responder.currentLongitude)
                    return null;
                const distance = this.calculateDistance(latitude, longitude, responder.currentLatitude, responder.currentLongitude);
                return {
                    userId: responder.userId,
                    distance,
                };
            })
                .filter((item) => item !== null && item.distance <= radiusKm)
                .sort((a, b) => a.distance - b.distance);
            return nearby;
        }
        catch (error) {
            logger_1.default.error("Find nearby emergency responders error:", error);
            return [];
        }
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }
}
exports.WebSocketService = WebSocketService;
