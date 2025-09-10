"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const database_1 = __importDefault(require("../config/database"));
const notification_service_1 = require("../services/notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class OrderController {
    constructor() {
        this.notificationService = new notification_service_1.NotificationService();
        // Get orders for store owner
        this.getStoreOrders = async (req, res) => {
            try {
                const userId = req.user.id;
                const { page = 1, limit = 20, status, startDate, endDate } = req.query;
                // Get store owner profile
                const storeOwnerProfile = await database_1.default.storeOwnerProfile.findUnique({
                    where: { userId },
                    include: { stores: true }
                });
                if (!storeOwnerProfile) {
                    return res.status(403).json({
                        success: false,
                        message: "Store owner profile not found"
                    });
                }
                const storeIds = storeOwnerProfile.stores.map(store => store.id);
                const where = {
                    storeId: { in: storeIds }
                };
                if (status) {
                    where.status = status;
                }
                if (startDate || endDate) {
                    where.createdAt = {};
                    if (startDate)
                        where.createdAt.gte = new Date(startDate);
                    if (endDate)
                        where.createdAt.lte = new Date(endDate);
                }
                const [orders, total] = await Promise.all([
                    database_1.default.order.findMany({
                        where,
                        include: {
                            customer: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    phone: true
                                }
                            },
                            store: {
                                select: {
                                    id: true,
                                    name: true,
                                    contactPhone: true
                                }
                            },
                            orderItems: {
                                select: {
                                    id: true,
                                    name: true,
                                    description: true,
                                    quantity: true,
                                    unitPrice: true,
                                    totalPrice: true,
                                    instructions: true
                                }
                            },
                            delivery: {
                                select: {
                                    id: true,
                                    status: true,
                                    trackingCode: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' },
                        skip: (Number(page) - 1) * Number(limit),
                        take: Number(limit)
                    }),
                    database_1.default.order.count({ where })
                ]);
                res.json({
                    success: true,
                    message: "Store orders retrieved successfully",
                    data: orders,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        totalPages: Math.ceil(total / Number(limit))
                    }
                });
            }
            catch (error) {
                logger_1.default.error("Get store orders error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve store orders",
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        // Get order by ID for store owner
        this.getOrderById = async (req, res) => {
            try {
                const userId = req.user.id;
                const { orderId } = req.params;
                // Get store owner profile
                const storeOwnerProfile = await database_1.default.storeOwnerProfile.findUnique({
                    where: { userId },
                    include: { stores: true }
                });
                if (!storeOwnerProfile) {
                    return res.status(403).json({
                        success: false,
                        message: "Store owner profile not found"
                    });
                }
                const storeIds = storeOwnerProfile.stores.map(store => store.id);
                const order = await database_1.default.order.findFirst({
                    where: {
                        id: orderId,
                        storeId: { in: storeIds }
                    },
                    include: {
                        customer: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                                email: true
                            }
                        },
                        store: {
                            select: {
                                id: true,
                                name: true,
                                contactPhone: true,
                                contactEmail: true
                            }
                        },
                        deliveryLocation: true,
                        serviceLocation: true,
                        orderItems: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                quantity: true,
                                unitPrice: true,
                                totalPrice: true,
                                instructions: true
                            }
                        },
                        delivery: {
                            include: {
                                dispatchRider: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                firstName: true,
                                                lastName: true,
                                                phone: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
                if (!order) {
                    return res.status(404).json({
                        success: false,
                        message: "Order not found or access denied"
                    });
                }
                res.json({
                    success: true,
                    message: "Order retrieved successfully",
                    data: order
                });
            }
            catch (error) {
                logger_1.default.error("Get order by ID error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve order",
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        // Update order status
        this.updateOrderStatus = async (req, res) => {
            try {
                const userId = req.user.id;
                const { orderId } = req.params;
                const { status, notes } = req.body;
                // Get store owner profile
                const storeOwnerProfile = await database_1.default.storeOwnerProfile.findUnique({
                    where: { userId },
                    include: { stores: true }
                });
                if (!storeOwnerProfile) {
                    return res.status(403).json({
                        success: false,
                        message: "Store owner profile not found"
                    });
                }
                const storeIds = storeOwnerProfile.stores.map(store => store.id);
                // Get current order
                const currentOrder = await database_1.default.order.findFirst({
                    where: {
                        id: orderId,
                        storeId: { in: storeIds }
                    },
                    include: {
                        customer: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                phone: true
                            }
                        },
                        store: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                });
                if (!currentOrder) {
                    return res.status(404).json({
                        success: false,
                        message: "Order not found or access denied"
                    });
                }
                // Validate status transition
                const validStatuses = [
                    'ORDER_PROCESSING',
                    'ORDER_CONFIRMED',
                    'WAITING_COURIER',
                    'COURIER_PICKING_UP',
                    'COURIER_ON_WAY',
                    'COURIER_ARRIVED',
                    'PREPARING',
                    'READY_FOR_PICKUP',
                    'PICKED_UP',
                    'IN_TRANSIT',
                    'DELIVERED',
                    'ORDER_REJECTED',
                    'CANCELLED'
                ];
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid order status"
                    });
                }
                // Update order status
                const updatedOrder = await database_1.default.order.update({
                    where: { id: orderId },
                    data: {
                        status: status,
                        ...(status === 'READY_FOR_PICKUP' && { readyForPickupAt: new Date() }),
                        ...(notes && { preparationNotes: notes })
                    },
                    include: {
                        customer: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        },
                        store: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                });
                // Send notification to customer
                const statusMessages = {
                    ORDER_PROCESSING: "Your order is now being processed",
                    ORDER_CONFIRMED: "Your order has been confirmed",
                    WAITING_COURIER: "Waiting for courier assignment",
                    COURIER_PICKING_UP: "Courier is picking up your order",
                    COURIER_ON_WAY: "Courier is on the way with your order",
                    COURIER_ARRIVED: "Courier has arrived at your location",
                    PREPARING: "Your order is being prepared",
                    READY_FOR_PICKUP: "Your order is ready for pickup",
                    PICKED_UP: "Your order has been picked up",
                    IN_TRANSIT: "Your order is in transit",
                    DELIVERED: "Your order has been delivered",
                    ORDER_REJECTED: "Your order has been rejected",
                    CANCELLED: "Your order has been cancelled"
                };
                await this.notificationService.notifyCustomer(currentOrder.customerId, {
                    type: "ORDER_STATUS_UPDATE",
                    title: "Order Status Update",
                    body: statusMessages[status] || "Order status updated",
                    data: {
                        orderId: currentOrder.id,
                        orderNumber: currentOrder.orderNumber,
                        status: status,
                        storeName: currentOrder.store?.name
                    }
                });
                res.json({
                    success: true,
                    message: "Order status updated successfully",
                    data: updatedOrder
                });
            }
            catch (error) {
                logger_1.default.error("Update order status error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update order status",
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        // Get order statistics for store owner
        this.getOrderStatistics = async (req, res) => {
            try {
                const userId = req.user.id;
                const { startDate, endDate } = req.query;
                // Get store owner profile
                const storeOwnerProfile = await database_1.default.storeOwnerProfile.findUnique({
                    where: { userId },
                    include: { stores: true }
                });
                if (!storeOwnerProfile) {
                    return res.status(403).json({
                        success: false,
                        message: "Store owner profile not found"
                    });
                }
                const storeIds = storeOwnerProfile.stores.map(store => store.id);
                const dateFilter = startDate || endDate ? {
                    createdAt: {
                        ...(startDate && { gte: new Date(startDate) }),
                        ...(endDate && { lte: new Date(endDate) })
                    }
                } : {};
                const [totalOrders, pendingOrders, processingOrders, deliveredOrders, rejectedOrders, totalRevenue] = await Promise.all([
                    database_1.default.order.count({
                        where: {
                            storeId: { in: storeIds },
                            ...dateFilter
                        }
                    }),
                    database_1.default.order.count({
                        where: {
                            storeId: { in: storeIds },
                            status: 'PENDING',
                            ...dateFilter
                        }
                    }),
                    database_1.default.order.count({
                        where: {
                            storeId: { in: storeIds },
                            status: { in: ['ORDER_PROCESSING', 'ORDER_CONFIRMED', 'PREPARING'] },
                            ...dateFilter
                        }
                    }),
                    database_1.default.order.count({
                        where: {
                            storeId: { in: storeIds },
                            status: 'DELIVERED',
                            ...dateFilter
                        }
                    }),
                    database_1.default.order.count({
                        where: {
                            storeId: { in: storeIds },
                            status: { in: ['ORDER_REJECTED', 'CANCELLED'] },
                            ...dateFilter
                        }
                    }),
                    database_1.default.order.aggregate({
                        where: {
                            storeId: { in: storeIds },
                            status: 'DELIVERED',
                            ...dateFilter
                        },
                        _sum: {
                            totalAmount: true
                        }
                    })
                ]);
                res.json({
                    success: true,
                    message: "Order statistics retrieved successfully",
                    data: {
                        totalOrders,
                        pendingOrders,
                        processingOrders,
                        deliveredOrders,
                        rejectedOrders,
                        totalRevenue: totalRevenue._sum.totalAmount || 0
                    }
                });
            }
            catch (error) {
                logger_1.default.error("Get order statistics error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve order statistics",
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        // Get customer orders (for customer to view their orders)
        this.getCustomerOrders = async (req, res) => {
            try {
                const userId = req.user.id;
                const { page = 1, limit = 20, status } = req.query;
                const where = {
                    customerId: userId
                };
                if (status) {
                    where.status = status;
                }
                const [orders, total] = await Promise.all([
                    database_1.default.order.findMany({
                        where,
                        include: {
                            store: {
                                select: {
                                    id: true,
                                    name: true,
                                    contactPhone: true
                                }
                            },
                            orderItems: {
                                select: {
                                    id: true,
                                    name: true,
                                    description: true,
                                    quantity: true,
                                    unitPrice: true,
                                    totalPrice: true,
                                    instructions: true
                                }
                            },
                            delivery: {
                                select: {
                                    id: true,
                                    status: true,
                                    trackingCode: true
                                }
                            }
                        },
                        orderBy: { createdAt: 'desc' },
                        skip: (Number(page) - 1) * Number(limit),
                        take: Number(limit)
                    }),
                    database_1.default.order.count({ where })
                ]);
                res.json({
                    success: true,
                    message: "Customer orders retrieved successfully",
                    data: orders,
                    pagination: {
                        page: Number(page),
                        limit: Number(limit),
                        total,
                        totalPages: Math.ceil(total / Number(limit))
                    }
                });
            }
            catch (error) {
                logger_1.default.error("Get customer orders error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve customer orders",
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
        // Get customer order by ID
        this.getCustomerOrderById = async (req, res) => {
            try {
                const userId = req.user.id;
                const { orderId } = req.params;
                const order = await database_1.default.order.findFirst({
                    where: {
                        id: orderId,
                        customerId: userId
                    },
                    include: {
                        store: {
                            select: {
                                id: true,
                                name: true,
                                contactPhone: true,
                                contactEmail: true
                            }
                        },
                        deliveryLocation: true,
                        serviceLocation: true,
                        orderItems: {
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                quantity: true,
                                unitPrice: true,
                                totalPrice: true,
                                instructions: true
                            }
                        },
                        delivery: {
                            include: {
                                dispatchRider: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                firstName: true,
                                                lastName: true,
                                                phone: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
                if (!order) {
                    return res.status(404).json({
                        success: false,
                        message: "Order not found"
                    });
                }
                res.json({
                    success: true,
                    message: "Order retrieved successfully",
                    data: order
                });
            }
            catch (error) {
                logger_1.default.error("Get customer order by ID error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve order",
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        };
    }
}
exports.OrderController = OrderController;
