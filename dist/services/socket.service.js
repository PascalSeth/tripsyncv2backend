"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketHandlers = initializeSocketHandlers;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_jwt_key";
function initializeSocketHandlers(io) {
    // Authentication middleware for Socket.IO
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error("Authentication error: Token missing"));
            }
            // Verify JWT token
            const decodedToken = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            // Check if the token is active in the database
            const session = await database_1.default.userSession.findUnique({
                where: { token: token },
                select: { isActive: true, expiresAt: true },
            });
            if (!session || !session.isActive || session.expiresAt < new Date()) {
                return next(new Error("Authentication error: Invalid or expired token"));
            }
            const user = await database_1.default.user.findUnique({
                where: { id: decodedToken.userId },
                select: {
                    id: true,
                    role: true,
                    isActive: true,
                },
            });
            if (!user || !user.isActive) {
                return next(new Error("Authentication error: User not found or inactive"));
            }
            socket.data.userId = user.id;
            socket.data.userRole = user.role;
            next();
        }
        catch (error) {
            logger_1.default.error("Socket authentication error:", error);
            next(new Error("Authentication error: Invalid token"));
        }
    });
    io.on("connection", (socket) => {
        const userId = socket.data.userId;
        const userRole = socket.data.userRole;
        logger_1.default.info(`User ${userId} (${userRole}) connected via Socket.IO`);
        // Join user-specific room
        socket.join(`user_${userId}`);
        // Join role-specific rooms
        if (userRole === "DRIVER") {
            socket.join("drivers");
        }
        else if (userRole === "USER") {
            socket.join("customers");
        }
        else if (userRole === "EMERGENCY_RESPONDER") {
            socket.join("emergency_responders");
        }
        // Handle location updates from drivers
        socket.on("location_update", async (data) => {
            try {
                if (!["DRIVER", "EMERGENCY_RESPONDER"].includes(userRole))
                    return;
                const { latitude, longitude, heading, speed } = data;
                // Update driver location in database
                if (userRole === "DRIVER") {
                    await database_1.default.driverProfile.updateMany({
                        where: { userId },
                        data: {
                            currentLatitude: latitude,
                            currentLongitude: longitude,
                            heading,
                        },
                    });
                }
                // Broadcast location to customers with active bookings
                const activeBookings = await database_1.default.booking.findMany({
                    where: {
                        providerId: userId,
                        status: {
                            in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"],
                        },
                    },
                });
                activeBookings.forEach((booking) => {
                    socket.to(`user_${booking.customerId}`).emit("driver_location_update", {
                        bookingId: booking.id,
                        latitude,
                        longitude,
                        heading,
                        speed,
                        timestamp: new Date(),
                    });
                });
            }
            catch (error) {
                logger_1.default.error("Location update error:", error);
            }
        });
        // Handle booking status updates
        socket.on("booking_status_update", async (data) => {
            try {
                const { bookingId, status, message } = data;
                // Verify user has access to this booking
                const booking = await database_1.default.booking.findFirst({
                    where: {
                        id: bookingId,
                        OR: [{ customerId: userId }, { providerId: userId }],
                    },
                });
                if (!booking)
                    return;
                // Create tracking update
                await database_1.default.trackingUpdate.create({
                    data: {
                        bookingId,
                        latitude: data.latitude || 0,
                        longitude: data.longitude || 0,
                        status,
                        message,
                        timestamp: new Date(),
                    },
                });
                // Notify relevant parties
                const targetUserId = booking.customerId === userId ? booking.providerId : booking.customerId;
                if (targetUserId) {
                    socket.to(`user_${targetUserId}`).emit("booking_update", {
                        bookingId,
                        status,
                        message,
                        timestamp: new Date(),
                    });
                }
            }
            catch (error) {
                logger_1.default.error("Booking status update error:", error);
            }
        });
        // Handle driver availability updates
        socket.on("availability_update", async (data) => {
            try {
                if (userRole !== "DRIVER")
                    return;
                const { isAvailable, isOnline } = data;
                await database_1.default.driverProfile.updateMany({
                    where: { userId },
                    data: {
                        isAvailable,
                        isOnline,
                    },
                });
                logger_1.default.info(`Driver ${userId} availability updated: available=${isAvailable}, online=${isOnline}`);
            }
            catch (error) {
                logger_1.default.error("Availability update error:", error);
            }
        });
        // Handle emergency alerts
        socket.on("emergency_alert", async (data) => {
            try {
                const { latitude, longitude, emergencyType, description } = data;
                // Create emergency booking
                const serviceType = await database_1.default.serviceType.findFirst({
                    where: { name: "EMERGENCY" },
                });
                if (!serviceType) {
                    logger_1.default.error("Emergency service type not found");
                    return;
                }
                const emergencyBooking = await database_1.default.booking.create({
                    data: {
                        bookingNumber: `EMG-${Date.now()}`,
                        customerId: userId,
                        serviceTypeId: serviceType.id,
                        status: "PENDING",
                        type: "IMMEDIATE",
                        pickupLatitude: latitude,
                        pickupLongitude: longitude,
                        estimatedPrice: 0,
                        currency: "NGN",
                        serviceData: {
                            emergencyType,
                            description,
                            emergencyActivatedAt: new Date(),
                        },
                    },
                });
                // Notify emergency responders
                socket.to("emergency_responders").emit("emergency_alert", {
                    bookingId: emergencyBooking.id,
                    latitude,
                    longitude,
                    emergencyType,
                    description,
                    timestamp: new Date(),
                });
                // Notify emergency contacts
                const emergencyContacts = await database_1.default.emergencyContact.findMany({
                    where: { userId },
                });
                // Send SMS to emergency contacts (implementation would depend on SMS service)
                logger_1.default.warn(`Emergency alert from user ${userId}: ${emergencyType}`);
            }
            catch (error) {
                logger_1.default.error("Emergency alert error:", error);
            }
        });
        // Handle chat messages
        socket.on("chat_message", async (data) => {
            try {
                const { bookingId, message, recipientId } = data;
                // Verify booking access
                const booking = await database_1.default.booking.findFirst({
                    where: {
                        id: bookingId,
                        OR: [{ customerId: userId }, { providerId: userId }],
                    },
                });
                if (!booking)
                    return;
                // Send message to recipient
                socket.to(`user_${recipientId}`).emit("chat_message", {
                    bookingId,
                    senderId: userId,
                    message,
                    timestamp: new Date(),
                });
            }
            catch (error) {
                logger_1.default.error("Chat message error:", error);
            }
        });
        // Handle disconnection
        socket.on("disconnect", () => {
            logger_1.default.info(`User ${userId} disconnected from Socket.IO`);
        });
    });
}
