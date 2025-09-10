"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreDeliveryService = void 0;
const database_1 = __importDefault(require("../config/database"));
const pricing_service_1 = require("./pricing.service");
const dispatch_rider_service_1 = require("./dispatch-rider.service");
const payment_service_1 = require("./payment.service");
const notification_service_1 = require("./notification.service");
const location_service_1 = require("./location.service");
const webhook_service_1 = require("./webhook.service");
const purchase_confirmation_service_1 = require("./purchase-confirmation.service");
const logger_1 = __importDefault(require("../utils/logger"));
const client_1 = require("@prisma/client");
class StoreDeliveryService {
    constructor() {
        this.pricingService = new pricing_service_1.PricingService();
        this.dispatchRiderService = new dispatch_rider_service_1.DispatchRiderService();
        this.paymentService = new payment_service_1.PaymentService();
        this.notificationService = new notification_service_1.NotificationService();
        this.locationService = new location_service_1.LocationService();
        this.webhookService = new webhook_service_1.WebhookService();
        this.purchaseConfirmationService = new purchase_confirmation_service_1.PurchaseConfirmationService();
    }
    /**
     * Check if store is currently open
     */
    async isStoreOpen(storeId) {
        try {
            const store = await database_1.default.store.findUnique({
                where: { id: storeId },
                include: { businessHours: true }
            });
            if (!store) {
                return false;
            }
            // If store is not active, it's closed
            if (!store.isActive) {
                return false;
            }
            const now = new Date();
            const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format
            // Find business hours for current day
            const todayHours = store.businessHours.find(hours => hours.dayOfWeek === currentDay);
            if (!todayHours || todayHours.isClosed) {
                return false;
            }
            // Convert opening and closing times to minutes since midnight
            const openTime = this.timeToMinutes(todayHours.openTime);
            const closeTime = this.timeToMinutes(todayHours.closeTime);
            return currentTime >= openTime && currentTime <= closeTime;
        }
        catch (error) {
            logger_1.default.error("Error checking store hours:", error);
            return false;
        }
    }
    /**
     * Convert time string (HH:MM) to minutes since midnight
     */
    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }
    /**
     * Calculate delivery estimate for store purchase
     */
    async calculateStorePurchaseDeliveryEstimate(params) {
        try {
            // Get store location
            const store = await database_1.default.store.findUnique({
                where: { id: params.storeId },
                include: { location: true }
            });
            if (!store || !store.location) {
                throw new Error("Store not found or location not available");
            }
            // Check if store is open
            const isOpen = await this.isStoreOpen(params.storeId);
            if (!isOpen) {
                throw new Error("Store is currently closed. Please try again during business hours.");
            }
            // Calculate delivery estimate
            const estimate = await this.pricingService.calculateDeliveryEstimate({
                pickupLatitude: store.location.latitude,
                pickupLongitude: store.location.longitude,
                dropoffLatitude: params.customerLatitude,
                dropoffLongitude: params.customerLongitude,
                deliveryType: "PACKAGE"
            });
            // Calculate total order value
            let orderTotal = 0;
            for (const item of params.items) {
                const product = await database_1.default.product.findUnique({
                    where: { id: item.productId }
                });
                if (product) {
                    orderTotal += product.price * item.quantity;
                }
            }
            return {
                deliveryFee: estimate.estimatedPrice,
                estimatedDuration: estimate.estimatedDuration,
                estimatedDistance: estimate.estimatedDistance,
                orderTotal,
                totalCost: orderTotal + estimate.estimatedPrice,
                availableCouriers: estimate.availableProviders,
                breakdown: estimate.breakdown
            };
        }
        catch (error) {
            logger_1.default.error("Calculate store purchase delivery estimate error:", error);
            throw error;
        }
    }
    /**
     * Create store purchase delivery request with confirmation system
     */
    async createStorePurchaseDelivery(request) {
        try {
            console.log("🛒 CREATING STORE PURCHASE DELIVERY WITH CONFIRMATION");
            console.log(`📦 Customer: ${request.customerId}`);
            console.log(`🏪 Store: ${request.storeId}`);
            console.log(`📋 Items: ${request.items.length}`);
            // Get store and customer details
            const [store, customer] = await Promise.all([
                database_1.default.store.findUnique({
                    where: { id: request.storeId },
                    include: { location: true, owner: { include: { user: true } } }
                }),
                database_1.default.user.findUnique({
                    where: { id: request.customerId }
                })
            ]);
            if (!store || !store.location) {
                throw new Error("Store not found or location not available");
            }
            if (!customer) {
                throw new Error("Customer not found");
            }
            // Check if store is open
            const isOpen = await this.isStoreOpen(request.storeId);
            if (!isOpen) {
                throw new Error("Store is currently closed. Please try again during business hours.");
            }
            // Calculate delivery fee
            const estimate = await this.pricingService.calculateDeliveryEstimate({
                pickupLatitude: store.location.latitude,
                pickupLongitude: store.location.longitude,
                dropoffLatitude: request.deliveryAddress.latitude,
                dropoffLongitude: request.deliveryAddress.longitude,
                deliveryType: "PACKAGE"
            });
            const deliveryFee = estimate.estimatedPrice;
            // Calculate order total
            let orderTotal = 0;
            const orderItems = [];
            for (const item of request.items) {
                const product = await database_1.default.product.findUnique({
                    where: { id: item.productId }
                });
                if (product) {
                    const itemTotal = product.price * item.quantity;
                    orderTotal += itemTotal;
                    orderItems.push({
                        productId: item.productId,
                        name: product.name,
                        description: product.description,
                        quantity: item.quantity,
                        unitPrice: product.price,
                        totalPrice: itemTotal
                    });
                }
            }
            const totalAmount = orderTotal + deliveryFee;
            console.log(`💰 Order Total: GH₵${orderTotal}`);
            console.log(`🚚 Delivery Fee: GH₵${deliveryFee}`);
            console.log(`💵 Total Amount: GH₵${totalAmount}`);
            // Create order
            const order = await database_1.default.order.create({
                data: {
                    orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    customerId: request.customerId,
                    storeId: request.storeId,
                    status: "PENDING",
                    totalAmount: orderTotal,
                    deliveryFee,
                    preparationNotes: JSON.stringify({
                        specialInstructions: request.specialInstructions,
                        items: orderItems
                    })
                }
            });
            // Process payment if payment method provided
            let transaction = null;
            if (request.paymentMethodId) {
                transaction = await this.paymentService.processPayment({
                    userId: request.customerId,
                    bookingId: order.id, // Using order ID as booking ID for compatibility
                    amount: totalAmount,
                    paymentMethodId: request.paymentMethodId,
                    description: `Store purchase delivery - Order ${order.orderNumber}`
                });
            }
            // Create purchase confirmation
            const confirmation = await this.purchaseConfirmationService.createPurchaseConfirmation(order.id);
            console.log("✅ Store purchase delivery created with confirmation system");
            console.log(`📦 Order ID: ${order.id}`);
            console.log(`⏰ Confirmation expires: ${confirmation.expiresAt}`);
            console.log(`🔗 Confirmation token: ${confirmation.confirmationToken}`);
            // Notify customer about pending confirmation
            await this.notificationService.notifyCustomer(request.customerId, {
                type: client_1.NotificationType.ORDER_READY,
                title: "Order Placed - Awaiting Store Confirmation",
                body: `Your order ${order.orderNumber} has been placed and is awaiting store confirmation. You'll receive updates soon.`,
                data: {
                    orderId: order.id,
                    totalAmount,
                    confirmationExpiresAt: confirmation.expiresAt
                },
                priority: client_1.PriorityLevel.STANDARD
            });
            return {
                order,
                transaction,
                confirmation,
                totalAmount,
                deliveryFee,
                estimatedDeliveryTime: new Date(Date.now() + (estimate.estimatedDuration + 30) * 60 * 1000)
            };
        }
        catch (error) {
            logger_1.default.error("Create store purchase delivery error:", error);
            throw error;
        }
    }
    /**
     * Confirm purchase and create delivery
     */
    async confirmPurchase(confirmationToken, storeOwnerId) {
        try {
            console.log("✅ CONFIRMING PURCHASE");
            console.log(`🔗 Token: ${confirmationToken}`);
            console.log(`👤 Store Owner: ${storeOwnerId}`);
            // Confirm the purchase
            const confirmation = await this.purchaseConfirmationService.confirmPurchase(confirmationToken, storeOwnerId);
            // Get order details
            const order = await database_1.default.order.findUnique({
                where: { id: confirmation.orderId },
                include: {
                    customer: true,
                    store: {
                        include: { location: true, owner: { include: { user: true } } }
                    }
                }
            });
            if (!order || !order.store) {
                throw new Error("Order or store not found");
            }
            // Calculate delivery estimate
            const estimate = await this.pricingService.calculateDeliveryEstimate({
                pickupLatitude: order.store.location.latitude,
                pickupLongitude: order.store.location.longitude,
                dropoffLatitude: 0, // Will be updated with actual delivery address
                dropoffLongitude: 0,
                deliveryType: "PACKAGE"
            });
            // Create delivery location (placeholder - should be updated with actual address)
            const deliveryLocation = await database_1.default.location.create({
                data: {
                    latitude: 0, // Placeholder
                    longitude: 0, // Placeholder
                    address: "To be updated", // Placeholder
                    city: "Unknown",
                    state: "Unknown",
                    country: "Ghana"
                }
            });
            // Generate tracking code
            const trackingCode = this.generateTrackingCode();
            // Create delivery record
            const delivery = await database_1.default.delivery.create({
                data: {
                    orderId: order.id,
                    pickupLocationId: order.store.locationId,
                    deliveryLocationId: deliveryLocation.id,
                    deliveryFee: order.deliveryFee,
                    estimatedPickupTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
                    estimatedDeliveryTime: new Date(Date.now() + (estimate.estimatedDuration + 30) * 60 * 1000),
                    specialInstructions: JSON.parse(order.preparationNotes || '{}').specialInstructions,
                    status: "PENDING",
                    trackingCode,
                    recipientName: order.customer.firstName + " " + order.customer.lastName
                }
            });
            // Find and notify dispatch riders
            await this.dispatchRiderService.notifyNearbyDispatchRiders(delivery);
            // Send webhook notification for delivery creation
            await this.webhookService.notifyDeliveryCreated(delivery.id, trackingCode, {
                orderId: order.id,
                customerId: order.customerId,
                storeId: order.storeId,
                totalAmount: order.totalAmount + order.deliveryFee,
                deliveryFee: order.deliveryFee,
                items: JSON.parse(order.preparationNotes || '{}').items?.length || 0,
                estimatedDeliveryTime: delivery.estimatedDeliveryTime
            });
            console.log("✅ Purchase confirmed and delivery created");
            console.log(`🚚 Delivery ID: ${delivery.id}`);
            console.log(`📊 Tracking Code: ${trackingCode}`);
            return {
                order,
                delivery,
                trackingCode,
                confirmation
            };
        }
        catch (error) {
            logger_1.default.error("Confirm purchase error:", error);
            throw error;
        }
    }
    /**
     * Create user-to-user delivery request
     */
    async createUserToUserDelivery(request) {
        try {
            console.log("👥 CREATING USER-TO-USER DELIVERY");
            console.log(`📤 Sender: ${request.senderId}`);
            console.log(`📥 Recipient: ${request.recipientId}`);
            // Get sender and recipient details
            const [sender, recipient] = await Promise.all([
                database_1.default.user.findUnique({ where: { id: request.senderId } }),
                database_1.default.user.findUnique({ where: { id: request.recipientId } })
            ]);
            if (!sender || !recipient) {
                throw new Error("Sender or recipient not found");
            }
            // Calculate delivery fee
            const estimate = await this.pricingService.calculateDeliveryEstimate({
                pickupLatitude: request.pickupAddress.latitude,
                pickupLongitude: request.pickupAddress.longitude,
                dropoffLatitude: request.deliveryAddress.latitude,
                dropoffLongitude: request.deliveryAddress.longitude,
                deliveryType: "PACKAGE"
            });
            const deliveryFee = estimate.estimatedPrice;
            // Generate tracking code
            const trackingCode = this.generateTrackingCode();
            console.log(`🚚 Delivery Fee: GH₵${deliveryFee}`);
            console.log(`📊 Tracking Code: ${trackingCode}`);
            // Create pickup location
            const pickupLocation = await database_1.default.location.create({
                data: {
                    latitude: request.pickupAddress.latitude,
                    longitude: request.pickupAddress.longitude,
                    address: request.pickupAddress.address,
                    city: "Unknown",
                    state: "Unknown",
                    country: "Ghana"
                }
            });
            // Create delivery location
            const deliveryLocation = await database_1.default.location.create({
                data: {
                    latitude: request.deliveryAddress.latitude,
                    longitude: request.deliveryAddress.longitude,
                    address: request.deliveryAddress.address,
                    city: "Unknown",
                    state: "Unknown",
                    country: "Ghana"
                }
            });
            // Create order for user-to-user delivery
            const order = await database_1.default.order.create({
                data: {
                    orderNumber: `U2U-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                    customerId: request.senderId,
                    status: "PENDING",
                    totalAmount: 0, // Items value not charged, only delivery fee
                    deliveryFee,
                    preparationNotes: JSON.stringify({
                        specialInstructions: request.specialInstructions,
                        items: request.items
                    })
                }
            });
            // Create delivery record
            const delivery = await database_1.default.delivery.create({
                data: {
                    orderId: order.id,
                    pickupLocationId: pickupLocation.id,
                    deliveryLocationId: deliveryLocation.id,
                    deliveryFee,
                    estimatedPickupTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
                    estimatedDeliveryTime: new Date(Date.now() + (estimate.estimatedDuration + 15) * 60 * 1000),
                    specialInstructions: request.specialInstructions,
                    status: "PENDING",
                    trackingCode,
                    recipientName: request.recipientName,
                    recipientPhone: request.recipientPhone
                }
            });
            // Process payment for delivery fee
            let transaction = null;
            if (request.paymentMethodId) {
                transaction = await this.paymentService.processPayment({
                    userId: request.senderId,
                    bookingId: order.id,
                    amount: deliveryFee,
                    paymentMethodId: request.paymentMethodId,
                    description: `User-to-user delivery - Tracking ${trackingCode}`
                });
            }
            // Notify recipient
            await this.notificationService.notifyCustomer(request.recipientId, {
                type: client_1.NotificationType.DELIVERY_UPDATE,
                title: "Package Incoming",
                body: `${sender.firstName} is sending you a package. Tracking code: ${trackingCode}`,
                data: {
                    deliveryId: delivery.id,
                    trackingCode,
                    senderName: sender.firstName + " " + sender.lastName,
                    estimatedDeliveryTime: delivery.estimatedDeliveryTime
                },
                priority: client_1.PriorityLevel.STANDARD
            });
            // Notify sender
            await this.notificationService.notifyCustomer(request.senderId, {
                type: client_1.NotificationType.ORDER_READY,
                title: "Delivery Request Created",
                body: `Your delivery request has been created. Tracking code: ${trackingCode}`,
                data: {
                    deliveryId: delivery.id,
                    trackingCode,
                    recipientName: request.recipientName,
                    deliveryFee
                },
                priority: client_1.PriorityLevel.STANDARD
            });
            // Send webhook notification for delivery creation
            await this.webhookService.notifyDeliveryCreated(delivery.id, trackingCode, {
                orderId: order.id,
                senderId: request.senderId,
                recipientId: request.recipientId,
                deliveryFee,
                items: request.items.length,
                estimatedDeliveryTime: delivery.estimatedDeliveryTime,
                deliveryType: "user-to-user"
            });
            console.log("✅ User-to-user delivery created successfully");
            console.log(`🚚 Delivery ID: ${delivery.id}`);
            console.log(`📊 Tracking Code: ${trackingCode}`);
            console.log(`📡 Webhook notification sent`);
            return {
                order,
                delivery,
                transaction,
                trackingCode,
                deliveryFee,
                estimatedDeliveryTime: delivery.estimatedDeliveryTime
            };
        }
        catch (error) {
            logger_1.default.error("Create user-to-user delivery error:", error);
            throw error;
        }
    }
    /**
     * Get delivery tracking information
     */
    async getDeliveryTracking(trackingCode) {
        try {
            const delivery = await database_1.default.delivery.findUnique({
                where: { trackingCode },
                include: {
                    order: {
                        include: {
                            customer: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    phone: true
                                }
                            },
                            store: {
                                select: {
                                    name: true,
                                    contactPhone: true
                                }
                            },
                            orderItems: true
                        }
                    },
                    dispatchRider: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    phone: true,
                                    avatar: true
                                }
                            },
                            vehicle: true
                        }
                    },
                    pickupLocation: true,
                    deliveryLocation: true,
                    trackingUpdates: {
                        orderBy: { timestamp: "desc" }
                    }
                }
            });
            if (!delivery) {
                throw new Error("Delivery not found");
            }
            return {
                trackingCode,
                status: delivery.status,
                recipientName: delivery.recipientName,
                recipientPhone: delivery.recipientPhone,
                estimatedDeliveryTime: delivery.estimatedDeliveryTime,
                actualDeliveryTime: delivery.deliveredAt,
                dispatchRider: delivery.dispatchRider ? {
                    name: `${delivery.dispatchRider.user.firstName} ${delivery.dispatchRider.user.lastName}`,
                    phone: delivery.dispatchRider.user.phone,
                    avatar: delivery.dispatchRider.user.avatar,
                    vehicle: delivery.dispatchRider.vehicle
                } : null,
                pickupLocation: delivery.pickupLocation,
                deliveryLocation: delivery.deliveryLocation,
                trackingUpdates: delivery.trackingUpdates,
                order: {
                    orderNumber: delivery.order.orderNumber,
                    customer: delivery.order.customer,
                    store: delivery.order.store,
                    items: delivery.order.orderItems
                }
            };
        }
        catch (error) {
            logger_1.default.error("Get delivery tracking error:", error);
            throw error;
        }
    }
    /**
     * Generate unique tracking code
     */
    generateTrackingCode() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `TSP${timestamp}${random}`;
    }
    /**
     * Get delivery statistics for admin
     */
    async getDeliveryStatistics(params) {
        try {
            const where = {};
            if (params.startDate || params.endDate) {
                where.createdAt = {};
                if (params.startDate)
                    where.createdAt.gte = params.startDate;
                if (params.endDate)
                    where.createdAt.lte = params.endDate;
            }
            if (params.storeId) {
                where.order = {
                    storeId: params.storeId
                };
            }
            const [totalDeliveries, completedDeliveries, pendingDeliveries, inTransitDeliveries] = await Promise.all([
                database_1.default.delivery.count({ where }),
                database_1.default.delivery.count({ where: { ...where, status: "DELIVERED" } }),
                database_1.default.delivery.count({ where: { ...where, status: "PENDING" } }),
                database_1.default.delivery.count({ where: { ...where, status: "IN_TRANSIT" } })
            ]);
            const completionRate = totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;
            return {
                totalDeliveries,
                completedDeliveries,
                pendingDeliveries,
                inTransitDeliveries,
                completionRate: Math.round(completionRate * 100) / 100
            };
        }
        catch (error) {
            logger_1.default.error("Get delivery statistics error:", error);
            throw error;
        }
    }
}
exports.StoreDeliveryService = StoreDeliveryService;
