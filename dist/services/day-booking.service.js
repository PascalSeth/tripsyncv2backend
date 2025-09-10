"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DayBookingService = void 0;
const database_1 = __importDefault(require("../config/database"));
const webhook_service_1 = require("./webhook.service");
const notification_service_1 = require("./notification.service");
const pricing_service_1 = require("./pricing.service");
const logger_1 = __importDefault(require("../utils/logger"));
class DayBookingService {
    constructor(websocketService) {
        this.websocketService = websocketService;
        this.webhookService = new webhook_service_1.WebhookService();
        this.notificationService = new notification_service_1.NotificationService();
        this.pricingService = new pricing_service_1.PricingService();
    }
    /**
     * Enhanced day booking creation with webhook integration
     */
    async createDayBooking(bookingData) {
        try {
            logger_1.default.info(`🚐 Creating enhanced day booking for customer ${bookingData.customerId}`);
            // Step 1: Validate driver availability with enhanced checks
            const availabilityCheck = await this.checkDriverAvailability(bookingData.driverId, bookingData.scheduledAt, bookingData.duration);
            if (!availabilityCheck.isAvailable || availabilityCheck.hasConflictingBookings) {
                throw new Error("Driver is not available for the selected time slot");
            }
            // Step 2: Calculate pricing with enhanced logic
            const pricing = await this.pricingService.calculateDayBookingPrice({
                duration: bookingData.duration,
                scheduledAt: bookingData.scheduledAt,
                serviceArea: bookingData.serviceArea,
                driverId: bookingData.driverId,
            });
            // Step 3: Create booking with enhanced data structure
            const booking = await database_1.default.booking.create({
                data: {
                    bookingNumber: await this.generateDayBookingNumber(),
                    customerId: bookingData.customerId,
                    providerId: bookingData.driverId,
                    serviceTypeId: await this.getServiceTypeId("DAY_BOOKING"),
                    status: "CONFIRMED",
                    type: "SCHEDULED",
                    scheduledAt: bookingData.scheduledAt,
                    estimatedPrice: pricing.totalPrice,
                    finalPrice: pricing.totalPrice,
                    currency: "GHS",
                    serviceData: {
                        duration: bookingData.duration,
                        serviceArea: bookingData.serviceArea,
                        specialRequirements: bookingData.specialRequirements,
                        contactPhone: bookingData.contactPhone,
                        pricingBreakdown: pricing.breakdown,
                        driverAvailability: {
                            driverId: availabilityCheck.driverId,
                            isAvailable: availabilityCheck.isAvailable,
                            hasConflictingBookings: availabilityCheck.hasConflictingBookings,
                            rating: availabilityCheck.rating,
                            experience: availabilityCheck.experience,
                            distance: availabilityCheck.distance,
                        },
                        webhookTracking: {
                            created: true,
                            lastStatusUpdate: new Date(),
                            notificationsSent: 0,
                        },
                        safetyFeatures: {
                            locationTrackingEnabled: true,
                            emergencyContactSharing: true,
                            realTimeUpdates: true,
                        },
                    },
                    platformCommission: pricing.totalPrice * 0.15,
                    providerEarning: pricing.totalPrice * 0.85,
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
            // Step 4: Send webhook notification for booking creation
            // Fetch booking with provider details for webhook
            const bookingWithProvider = await database_1.default.booking.findUnique({
                where: { id: booking.id },
                include: { provider: true },
            });
            if (bookingWithProvider && bookingWithProvider.provider) {
                await this.webhookService.notifyDayBookingCreated(booking.id, {
                    id: bookingWithProvider.provider.id,
                    name: `${bookingWithProvider.provider.firstName} ${bookingWithProvider.provider.lastName}`,
                    phone: bookingWithProvider.provider.phone,
                    rating: availabilityCheck.rating,
                    experience: availabilityCheck.experience,
                }, {
                    bookingNumber: booking.bookingNumber,
                    scheduledAt: booking.scheduledAt,
                    duration: bookingData.duration,
                    serviceArea: bookingData.serviceArea,
                    estimatedPrice: booking.estimatedPrice,
                    specialRequirements: bookingData.specialRequirements,
                });
            }
            // Step 5: Schedule automated status updates and monitoring
            await this.scheduleBookingMonitoring(booking.id, bookingData.scheduledAt, bookingData.duration);
            // Step 6: Send enhanced notifications
            await this.sendEnhancedBookingNotifications(booking, bookingData, bookingWithProvider);
            logger_1.default.info(`✅ Enhanced day booking ${booking.id} created successfully`);
            return booking;
        }
        catch (error) {
            logger_1.default.error("Create day booking error:", error);
            throw error;
        }
    }
    /**
     * Enhanced driver availability checking
     */
    async checkDriverAvailability(driverId, scheduledAt, duration) {
        try {
            // Check basic availability
            const driverProfile = await database_1.default.driverProfile.findFirst({
                where: { userId: driverId },
                include: {
                    user: true,
                    dayBookingConfig: true,
                },
            });
            if (!driverProfile || !driverProfile.isAvailable) {
                return {
                    driverId,
                    isAvailable: false,
                    hasConflictingBookings: false,
                    rating: 0,
                    experience: 0,
                };
            }
            // Check for conflicting bookings
            const bookingEndTime = new Date(scheduledAt.getTime() + duration * 60 * 60 * 1000);
            const conflictingBookings = await database_1.default.booking.findMany({
                where: {
                    providerId: driverId,
                    status: { in: ["CONFIRMED", "IN_PROGRESS"] },
                    OR: [
                        {
                            scheduledAt: { lte: scheduledAt },
                            AND: {
                                scheduledAt: {
                                    gte: new Date(scheduledAt.getTime() - duration * 60 * 60 * 1000),
                                },
                            },
                        },
                        {
                            scheduledAt: { lte: bookingEndTime },
                            AND: {
                                scheduledAt: { gte: scheduledAt },
                            },
                        },
                    ],
                },
            });
            // Get driver rating and experience
            const driverStats = await this.getDriverStats(driverId);
            return {
                driverId,
                isAvailable: driverProfile.isAvailable,
                hasConflictingBookings: conflictingBookings.length > 0,
                rating: driverStats.rating,
                experience: driverStats.experience,
            };
        }
        catch (error) {
            logger_1.default.error(`Error checking driver availability for ${driverId}:`, error);
            return {
                driverId,
                isAvailable: false,
                hasConflictingBookings: false,
                rating: 0,
                experience: 0,
            };
        }
    }
    /**
     * Get driver statistics for enhanced matching
     */
    async getDriverStats(driverId) {
        try {
            // Get completed day bookings
            const completedBookings = await database_1.default.booking.findMany({
                where: {
                    providerId: driverId,
                    serviceType: { name: "DAY_BOOKING" },
                    status: "COMPLETED",
                },
                include: {
                    reviews: true,
                },
            });
            const totalBookings = completedBookings.length;
            const totalRating = completedBookings.reduce((sum, booking) => {
                return sum + (booking.reviews[0]?.rating || 0);
            }, 0);
            const averageRating = totalBookings > 0 ? totalRating / totalBookings : 5.0;
            return {
                rating: Math.round(averageRating * 10) / 10,
                experience: totalBookings,
            };
        }
        catch (error) {
            logger_1.default.error(`Error getting driver stats for ${driverId}:`, error);
            return { rating: 5.0, experience: 0 };
        }
    }
    /**
     * Schedule automated booking monitoring
     */
    async scheduleBookingMonitoring(bookingId, scheduledAt, duration) {
        try {
            // Schedule pre-booking reminder (1 hour before)
            const reminderTime = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
            if (reminderTime > new Date()) {
                setTimeout(async () => {
                    await this.sendBookingReminder(bookingId, "REMINDER_1H");
                }, reminderTime.getTime() - Date.now());
            }
            // Schedule booking start notification
            setTimeout(async () => {
                await this.handleBookingStart(bookingId);
            }, scheduledAt.getTime() - Date.now());
            // Schedule periodic status updates during booking
            const updateInterval = 30 * 60 * 1000; // Every 30 minutes
            const totalUpdates = Math.floor(duration * 60 / 30); // Updates per booking
            for (let i = 1; i <= totalUpdates; i++) {
                setTimeout(async () => {
                    await this.sendPeriodicStatusUpdate(bookingId, i, totalUpdates);
                }, scheduledAt.getTime() + (i * updateInterval) - Date.now());
            }
            // Schedule booking completion
            const endTime = new Date(scheduledAt.getTime() + duration * 60 * 60 * 1000);
            setTimeout(async () => {
                await this.handleBookingCompletion(bookingId);
            }, endTime.getTime() - Date.now());
            logger_1.default.info(`📅 Scheduled monitoring for day booking ${bookingId}`);
        }
        catch (error) {
            logger_1.default.error(`Error scheduling monitoring for booking ${bookingId}:`, error);
        }
    }
    /**
     * Send enhanced booking notifications
     */
    async sendEnhancedBookingNotifications(booking, bookingData, bookingWithProvider) {
        try {
            // Notify driver with enhanced information
            await this.notificationService.notifyDriver(bookingData.driverId, {
                type: "DAY_BOOKING_ASSIGNED",
                title: "New Day Booking Confirmed",
                body: `You have a confirmed day booking for ${bookingData.duration} hours`,
                data: {
                    bookingId: booking.id,
                    bookingNumber: booking.bookingNumber,
                    scheduledAt: bookingData.scheduledAt,
                    duration: bookingData.duration,
                    serviceArea: bookingData.serviceArea,
                    estimatedEarning: booking.providerEarning,
                    customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
                    customerPhone: booking.customer.phone,
                    specialRequirements: bookingData.specialRequirements,
                    contactPhone: bookingData.contactPhone,
                },
            });
            // Notify customer
            await this.notificationService.notifyCustomer(bookingData.customerId, {
                type: "DAY_BOOKING_ASSIGNED",
                title: "Day Booking Confirmed",
                body: `Your day booking has been confirmed for ${bookingData.scheduledAt.toLocaleDateString()}`,
                data: {
                    bookingId: booking.id,
                    bookingNumber: booking.bookingNumber,
                    driverName: `${bookingWithProvider.provider.firstName} ${bookingWithProvider.provider.lastName}`,
                    driverPhone: bookingWithProvider.provider.phone,
                    scheduledAt: bookingData.scheduledAt,
                    duration: bookingData.duration,
                    totalPrice: booking.estimatedPrice,
                },
            });
            logger_1.default.info(`📤 Enhanced notifications sent for day booking ${booking.id}`);
        }
        catch (error) {
            logger_1.default.error(`Error sending notifications for booking ${booking.id}:`, error);
        }
    }
    /**
     * Handle booking start with webhook
     */
    async handleBookingStart(bookingId) {
        try {
            // Update booking status
            await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    status: "IN_PROGRESS",
                    startedAt: new Date(),
                    serviceData: {
                        status: "IN_PROGRESS",
                        startedAt: new Date(),
                    },
                },
            });
            // Send webhook notification
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: { provider: true },
            });
            if (booking && booking.provider) {
                await this.webhookService.notifyDayBookingStatusUpdate(bookingId, "IN_PROGRESS", {
                    id: booking.provider.id,
                    name: `${booking.provider.firstName} ${booking.provider.lastName}`,
                    phone: booking.provider.phone,
                }, {
                    startedAt: new Date(),
                    message: "Day booking has started",
                });
            }
            logger_1.default.info(`▶️ Day booking ${bookingId} started`);
        }
        catch (error) {
            logger_1.default.error(`Error handling booking start for ${bookingId}:`, error);
        }
    }
    /**
     * Handle booking completion with webhook
     */
    async handleBookingCompletion(bookingId) {
        try {
            // Update booking status
            await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    status: "COMPLETED",
                    completedAt: new Date(),
                    serviceData: {
                        status: "COMPLETED",
                        completedAt: new Date(),
                    },
                },
            });
            // Send webhook notification
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: { provider: true },
            });
            if (booking && booking.provider) {
                await this.webhookService.notifyDayBookingStatusUpdate(bookingId, "COMPLETED", {
                    id: booking.provider.id,
                    name: `${booking.provider.firstName} ${booking.provider.lastName}`,
                    phone: booking.provider.phone,
                }, {
                    completedAt: new Date(),
                    message: "Day booking completed successfully",
                });
            }
            logger_1.default.info(`✅ Day booking ${bookingId} completed`);
        }
        catch (error) {
            logger_1.default.error(`Error handling booking completion for ${bookingId}:`, error);
        }
    }
    /**
     * Send periodic status updates
     */
    async sendPeriodicStatusUpdate(bookingId, updateNumber, totalUpdates) {
        try {
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: { provider: true, customer: true },
            });
            if (!booking || booking.status !== "IN_PROGRESS") {
                return; // Skip if booking not active
            }
            // Send webhook with progress update
            await this.webhookService.notifyDayBookingStatusUpdate(bookingId, "PROGRESS_UPDATE", {
                id: booking.provider.id,
                name: `${booking.provider.firstName} ${booking.provider.lastName}`,
                phone: booking.provider.phone,
            }, {
                progress: `${updateNumber}/${totalUpdates}`,
                percentage: Math.round((updateNumber / totalUpdates) * 100),
                message: `Progress update: ${Math.round((updateNumber / totalUpdates) * 100)}% complete`,
            });
            logger_1.default.info(`📊 Progress update sent for day booking ${bookingId}: ${updateNumber}/${totalUpdates}`);
        }
        catch (error) {
            logger_1.default.error(`Error sending progress update for booking ${bookingId}:`, error);
        }
    }
    /**
     * Send booking reminder
     */
    async sendBookingReminder(bookingId, reminderType) {
        try {
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: { provider: true, customer: true },
            });
            if (!booking)
                return;
            // Send webhook notification
            await this.webhookService.notifyDayBookingStatusUpdate(bookingId, reminderType, {
                id: booking.provider.id,
                name: `${booking.provider.firstName} ${booking.provider.lastName}`,
                phone: booking.provider.phone,
            }, {
                reminderType,
                scheduledAt: booking.scheduledAt,
                message: `Reminder: Day booking starts in 1 hour`,
            });
            logger_1.default.info(`⏰ ${reminderType} sent for day booking ${bookingId}`);
        }
        catch (error) {
            logger_1.default.error(`Error sending reminder for booking ${bookingId}:`, error);
        }
    }
    /**
     * Handle driver availability change during booking
     */
    async handleDriverAvailabilityChange(driverId, isAvailable, bookingId) {
        try {
            // Send webhook notification
            await this.webhookService.notifyDriverAvailabilityChange(driverId, isAvailable, bookingId);
            if (!isAvailable && bookingId) {
                // Driver became unavailable during active booking
                await this.handleDriverUnavailableDuringBooking(bookingId, driverId);
            }
            logger_1.default.info(`🔄 Driver ${driverId} availability changed to ${isAvailable}`);
        }
        catch (error) {
            logger_1.default.error(`Error handling driver availability change for ${driverId}:`, error);
        }
    }
    /**
     * Handle driver becoming unavailable during active booking
     */
    async handleDriverUnavailableDuringBooking(bookingId, driverId) {
        try {
            // Find alternative driver
            const alternativeDriver = await this.findAlternativeDriver(bookingId, driverId);
            if (alternativeDriver) {
                // Reassign booking to alternative driver
                await database_1.default.booking.update({
                    where: { id: bookingId },
                    data: {
                        providerId: alternativeDriver.driverId,
                        serviceData: {
                            driverReassigned: true,
                            originalDriver: driverId,
                            reassignedAt: new Date(),
                            reassignmentReason: "Driver became unavailable",
                        },
                    },
                });
                // Notify new driver
                await this.notificationService.notifyDriver(alternativeDriver.driverId, {
                    type: "DAY_BOOKING_REASSIGNED",
                    title: "Emergency Booking Reassignment",
                    body: "You have been assigned an emergency day booking",
                    data: {
                        bookingId,
                        reason: "Original driver became unavailable",
                    },
                });
                // Send webhook notification
                await this.webhookService.notifyDayBookingStatusUpdate(bookingId, "DRIVER_REASSIGNED", {
                    id: alternativeDriver.driverId,
                    name: alternativeDriver.name,
                    phone: alternativeDriver.phone,
                }, {
                    reason: "Original driver became unavailable",
                    reassignedAt: new Date(),
                });
                logger_1.default.info(`🔄 Booking ${bookingId} reassigned from ${driverId} to ${alternativeDriver.driverId}`);
            }
            else {
                // No alternative driver available
                await this.handleNoAlternativeDriver(bookingId);
            }
        }
        catch (error) {
            logger_1.default.error(`Error handling driver unavailability for booking ${bookingId}:`, error);
        }
    }
    /**
     * Find alternative driver for reassignment
     */
    async findAlternativeDriver(bookingId, originalDriverId) {
        try {
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
            });
            if (!booking)
                return null;
            // Find available drivers in the same area
            const availableDrivers = await database_1.default.driverProfile.findMany({
                where: {
                    isAvailable: true,
                    isOnline: true,
                    userId: { not: originalDriverId }, // Exclude original driver
                    user: {
                        isActive: true,
                    },
                },
                include: {
                    user: true,
                },
                take: 5, // Get top 5 alternatives
            });
            if (availableDrivers.length === 0)
                return null;
            // Return the first available driver (could implement more sophisticated matching)
            const driver = availableDrivers[0];
            return {
                driverId: driver.userId,
                name: `${driver.user.firstName} ${driver.user.lastName}`,
                phone: driver.user.phone,
                rating: driver.rating || 5.0,
            };
        }
        catch (error) {
            logger_1.default.error(`Error finding alternative driver for booking ${bookingId}:`, error);
            return null;
        }
    }
    /**
     * Handle case when no alternative driver is available
     */
    async handleNoAlternativeDriver(bookingId) {
        try {
            // Update booking status
            await database_1.default.booking.update({
                where: { id: bookingId },
                data: {
                    status: "CANCELLED",
                    cancelledAt: new Date(),
                    cancellationReason: "No alternative driver available",
                    serviceData: {
                        emergencyCancellation: true,
                        cancellationReason: "No alternative driver available",
                    },
                },
            });
            // Send webhook notification
            await this.webhookService.notifyDayBookingStatusUpdate(bookingId, "CANCELLED", {}, {
                reason: "No alternative driver available",
                cancelledAt: new Date(),
            });
            logger_1.default.warn(`❌ Booking ${bookingId} cancelled - no alternative driver available`);
        }
        catch (error) {
            logger_1.default.error(`Error handling no alternative driver for booking ${bookingId}:`, error);
        }
    }
    /**
     * Generate unique day booking number
     */
    async generateDayBookingNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `DAY${timestamp}${random}`;
    }
    /**
     * Get service type ID for day booking
     */
    async getServiceTypeId(serviceName) {
        const serviceType = await database_1.default.serviceType.findUnique({
            where: { name: serviceName },
        });
        if (!serviceType) {
            throw new Error(`Service type ${serviceName} not found`);
        }
        return serviceType.id;
    }
}
exports.DayBookingService = DayBookingService;
