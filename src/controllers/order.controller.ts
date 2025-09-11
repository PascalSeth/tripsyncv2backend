import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import prisma from "../config/database"
import { NotificationService } from "../services/notification.service"
import logger from "../utils/logger"

export class OrderController {
  private notificationService = new NotificationService()

  // Get orders for store owner or super admin
  getStoreOrders = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const userRole = req.user!.role
      const { page = 1, limit = 20, status, startDate, endDate } = req.query

      let where: any = {}

      // Check if user is super admin
      if (userRole === 'SUPER_ADMIN') {
        // Super admin can see all orders
        console.log('Super admin accessing all orders')
      } else {
        // Regular store owner - check their profile
        const storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
          where: { userId },
          include: { stores: true }
        })

        if (!storeOwnerProfile) {
          return res.status(403).json({
            success: false,
            message: "Store owner profile not found"
          })
        }

        const storeIds = storeOwnerProfile.stores.map(store => store.id)
        where.storeId = { in: storeIds }
      }

      if (status) {
        where.status = status
      }

      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = new Date(startDate as string)
        if (endDate) where.createdAt.lte = new Date(endDate as string)
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
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
        prisma.order.count({ where })
      ])

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
      })
    } catch (error) {
      logger.error("Get store orders error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve store orders",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Get order by ID for store owner or super admin
  getOrderById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const userRole = req.user!.role
      const { orderId } = req.params

      let where: any = { id: orderId }

      // Check if user is super admin
      if (userRole !== 'SUPER_ADMIN') {
        // Regular store owner - check their profile
        const storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
          where: { userId },
          include: { stores: true }
        })

        if (!storeOwnerProfile) {
          return res.status(403).json({
            success: false,
            message: "Store owner profile not found"
          })
        }

        const storeIds = storeOwnerProfile.stores.map(store => store.id)
        where.storeId = { in: storeIds }
      }

      const order = await prisma.order.findFirst({
        where,
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
      })

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found or access denied"
        })
      }

      res.json({
        success: true,
        message: "Order retrieved successfully",
        data: order
      })
    } catch (error) {
      logger.error("Get order by ID error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve order",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Update order status for store owner or super admin
  updateOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const userRole = req.user!.role
      const { orderId } = req.params
      const { status, notes } = req.body

      let where: any = { id: orderId }

      // Check if user is super admin
      if (userRole !== 'SUPER_ADMIN') {
        // Regular store owner - check their profile
        const storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
          where: { userId },
          include: { stores: true }
        })

        if (!storeOwnerProfile) {
          return res.status(403).json({
            success: false,
            message: "Store owner profile not found"
          })
        }

        const storeIds = storeOwnerProfile.stores.map(store => store.id)
        where.storeId = { in: storeIds }
      }

      // Get current order
      const currentOrder = await prisma.order.findFirst({
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
              name: true
            }
          }
        }
      })

      if (!currentOrder) {
        return res.status(404).json({
          success: false,
          message: "Order not found or access denied"
        })
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
      ]

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status"
        })
      }

      // Update order status
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          status: status as any,
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
      })

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
      }

      await this.notificationService.notifyCustomer(currentOrder.customerId, {
        type: "ORDER_STATUS_UPDATE",
        title: "Order Status Update",
        body: statusMessages[status as keyof typeof statusMessages] || "Order status updated",
        data: {
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          status: status,
          storeName: currentOrder.store?.name
        }
      })

      res.json({
        success: true,
        message: "Order status updated successfully",
        data: updatedOrder
      })
    } catch (error) {
      logger.error("Update order status error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update order status",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Get order statistics for store owner or super admin
  getOrderStatistics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const userRole = req.user!.role
      const { startDate, endDate } = req.query

      let storeFilter: any = {}

      // Check if user is super admin
      if (userRole !== 'SUPER_ADMIN') {
        // Regular store owner - check their profile
        const storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
          where: { userId },
          include: { stores: true }
        })

        if (!storeOwnerProfile) {
          return res.status(403).json({
            success: false,
            message: "Store owner profile not found"
          })
        }

        const storeIds = storeOwnerProfile.stores.map(store => store.id)
        storeFilter.storeId = { in: storeIds }
      }

      const dateFilter = startDate || endDate ? {
        createdAt: {
          ...(startDate && { gte: new Date(startDate as string) }),
          ...(endDate && { lte: new Date(endDate as string) })
        }
      } : {}

      const [
        totalOrders,
        pendingOrders,
        processingOrders,
        deliveredOrders,
        rejectedOrders,
        totalRevenue
      ] = await Promise.all([
        prisma.order.count({
          where: {
            ...storeFilter,
            ...dateFilter
          }
        }),
        prisma.order.count({
          where: {
            ...storeFilter,
            status: 'PENDING',
            ...dateFilter
          }
        }),
        prisma.order.count({
          where: {
            ...storeFilter,
            status: { in: ['ORDER_PROCESSING', 'ORDER_CONFIRMED', 'PREPARING'] },
            ...dateFilter
          }
        }),
        prisma.order.count({
          where: {
            ...storeFilter,
            status: 'DELIVERED',
            ...dateFilter
          }
        }),
        prisma.order.count({
          where: {
            ...storeFilter,
            status: { in: ['ORDER_REJECTED', 'CANCELLED'] },
            ...dateFilter
          }
        }),
        prisma.order.aggregate({
          where: {
            ...storeFilter,
            status: 'DELIVERED',
            ...dateFilter
          },
          _sum: {
            totalAmount: true
          }
        })
      ])

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
      })
    } catch (error) {
      logger.error("Get order statistics error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve order statistics",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Get customer orders (for customer to view their orders)
  getCustomerOrders = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { page = 1, limit = 20, status } = req.query

      const where: any = {
        customerId: userId
      }

      if (status) {
        where.status = status
      }

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
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
        prisma.order.count({ where })
      ])

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
      })
    } catch (error) {
      logger.error("Get customer orders error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve customer orders",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Get customer order by ID
  getCustomerOrderById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { orderId } = req.params

      const order = await prisma.order.findFirst({
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
      })

      if (!order) {
        return res.status(404).json({
          success: false,
          message: "Order not found"
        })
      }

      res.json({
        success: true,
        message: "Order retrieved successfully",
        data: order
      })
    } catch (error) {
      logger.error("Get customer order by ID error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve order",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }
}