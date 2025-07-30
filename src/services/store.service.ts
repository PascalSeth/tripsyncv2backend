import prisma from "../config/database"
import { LocationService } from "./location.service"
import logger from "../utils/logger"

export class StoreService {
  private locationService = new LocationService()

  async createStore(ownerId: string, storeData: any) {
    try {
      // Create location first
      const location = await prisma.location.create({
        data: {
          latitude: storeData.latitude,
          longitude: storeData.longitude,
          address: storeData.address,
          city: storeData.city || "Unknown",
          state: storeData.state,
          country: storeData.country || "Nigeria",
          postalCode: storeData.postalCode,
        },
      })

      // Create store
      const store = await prisma.store.create({
        data: {
          name: storeData.name,
          type: storeData.type,
          locationId: location.id,
          ownerId,
          contactPhone: storeData.contactPhone,
          contactEmail: storeData.contactEmail,
          operatingHours: storeData.operatingHours || "9:00 AM - 9:00 PM",
          description: storeData.description,
          isActive: true,
        },
        include: {
          location: true,
          owner: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      })

      // Create default business hours if provided
      if (storeData.businessHours) {
        await this.createBusinessHours(store.id, storeData.businessHours)
      }

      return store
    } catch (error) {
      logger.error("Create store error:", error)
      throw error
    }
  }

  async getStores(params: {
    page: number
    limit: number
    search?: string
    type?: string
    category?: string // Category enum value
    subcategoryId?: string
    latitude?: number
    longitude?: number
    radius?: number
    isActive?: boolean
  }) {
    try {
      const {
        page,
        limit,
        search,
        type,
        category,
        subcategoryId,
        latitude,
        longitude,
        radius = 10000,
        isActive = true,
      } = params
      const skip = (page - 1) * limit

      const where: any = { isActive }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      if (type) {
        where.type = type
      }

      // Filter by category or subcategory through products
      if (category || subcategoryId) {
        where.products = {
          some: {
            ...(category && { category }),
            ...(subcategoryId && { subcategoryId }),
          },
        }
      }

      let stores = await prisma.store.findMany({
        where,
        include: {
          location: true,
          owner: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          products: {
            take: 5, // Get first 5 products for preview
            include: {
              subcategory: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
            },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { name: "asc" },
      })

      // Filter by location if coordinates provided
      if (latitude && longitude) {
        stores = stores.filter((store) => {
          if (!store.location) return false
          const distance = this.locationService.calculateDistance(
            latitude,
            longitude,
            store.location.latitude,
            store.location.longitude,
          )
          return distance <= radius
        })
      }

      const total = await prisma.store.count({ where })

      return {
        stores,
        pagination: {
          page,
          limit,
          total: latitude && longitude ? stores.length : total,
          totalPages: Math.ceil((latitude && longitude ? stores.length : total) / limit),
        },
      }
    } catch (error) {
      logger.error("Get stores error:", error)
      throw error
    }
  }

  async getStoreById(storeId: string) {
    try {
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: {
          location: true,
          owner: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
          products: {
            where: { inStock: true },
            include: {
              subcategory: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
            },
            orderBy: { name: "asc" },
          },
          businessHours: {
            orderBy: { dayOfWeek: "asc" },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      return store
    } catch (error) {
      logger.error("Get store by ID error:", error)
      throw error
    }
  }

  async updateStore(storeId: string, updateData: any, userId: string) {
    try {
      // Check ownership
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      if (store.owner.userId !== userId) {
        // Check if user is admin
        const user = await prisma.user.findUnique({
          where: { id: userId },
        })

        if (!user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(user.role)) {
          throw new Error("Unauthorized to update this store")
        }
      }

      // Update location if provided
      if (updateData.latitude || updateData.longitude || updateData.address) {
        await prisma.location.update({
          where: { id: store.locationId },
          data: {
            ...(updateData.latitude && { latitude: updateData.latitude }),
            ...(updateData.longitude && { longitude: updateData.longitude }),
            ...(updateData.address && { address: updateData.address }),
            ...(updateData.city && { city: updateData.city }),
            ...(updateData.state && { state: updateData.state }),
            ...(updateData.postalCode && { postalCode: updateData.postalCode }),
          },
        })
      }

      // Update store
      const updatedStore = await prisma.store.update({
        where: { id: storeId },
        data: {
          ...(updateData.name && { name: updateData.name }),
          ...(updateData.type && { type: updateData.type }),
          ...(updateData.contactPhone && { contactPhone: updateData.contactPhone }),
          ...(updateData.contactEmail && { contactEmail: updateData.contactEmail }),
          ...(updateData.operatingHours && { operatingHours: updateData.operatingHours }),
          ...(updateData.description && { description: updateData.description }),
          ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
        },
        include: {
          location: true,
          owner: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      })

      return updatedStore
    } catch (error) {
      logger.error("Update store error:", error)
      throw error
    }
  }

  async deleteStore(storeId: string, userId: string) {
    try {
      // Check ownership
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      if (store.owner.userId !== userId) {
        // Check if user is admin
        const user = await prisma.user.findUnique({
          where: { id: userId },
        })

        if (!user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(user.role)) {
          throw new Error("Unauthorized to delete this store")
        }
      }

      // Soft delete
      await prisma.store.update({
        where: { id: storeId },
        data: { isActive: false },
      })

      return { success: true }
    } catch (error) {
      logger.error("Delete store error:", error)
      throw error
    }
  }

  async addProduct(storeId: string, productData: any, userId: string) {
    try {
      // Check store ownership
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      if (store.owner.userId !== userId) {
        throw new Error("Unauthorized to add products to this store")
      }

      // Validate category enum
      const validCategories = ["FOOD", "GROCERY", "PHARMACY"]
      if (productData.category && !validCategories.includes(productData.category)) {
        throw new Error("Invalid category. Must be one of: FOOD, GROCERY, PHARMACY")
      }

      // Validate subcategory if provided
      if (productData.subcategoryId) {
        const subcategory = await prisma.subcategory.findUnique({
          where: { id: productData.subcategoryId },
        })

        if (!subcategory) {
          throw new Error("Subcategory not found")
        }

        // Ensure subcategory matches the product category
        if (productData.category && subcategory.category !== productData.category) {
          throw new Error("Subcategory does not match the product category")
        }
      }

      const product = await prisma.product.create({
        data: {
          storeId,
          name: productData.name,
          description: productData.description,
          price: productData.price,
          category: productData.category,
          subcategoryId: productData.subcategoryId,
          image: productData.image,
          inStock: productData.inStock !== false,
          stockQuantity: productData.stockQuantity || 0,
        },
        include: {
          subcategory: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
      })

      return product
    } catch (error) {
      logger.error("Add product error:", error)
      throw error
    }
  }

  async getProducts(
    storeId: string,
    filters: {
      page: number
      limit: number
      search?: string
      category?: string
      subcategoryId?: string
      inStock?: boolean
    },
  ) {
    try {
      const { page, limit, search, category, subcategoryId, inStock } = filters
      const skip = (page - 1) * limit

      const where: any = { storeId }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      if (category) {
        where.category = category
      }

      if (subcategoryId) {
        where.subcategoryId = subcategoryId
      }

      if (inStock !== undefined) {
        where.inStock = inStock
      }

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            subcategory: {
              select: {
                id: true,
                name: true,
                category: true,
              },
            },
          },
          orderBy: { name: "asc" },
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
      ])

      return {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get products error:", error)
      throw error
    }
  }

  async updateProduct(productId: string, updateData: any, userId: string) {
    try {
      // Check ownership through store
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          store: {
            include: { owner: true },
          },
        },
      })

      if (!product) {
        throw new Error("Product not found")
      }

      if (product.store.owner.userId !== userId) {
        throw new Error("Unauthorized to update this product")
      }

      // Validate category enum if provided
      if (updateData.category) {
        const validCategories = ["FOOD", "GROCERY", "PHARMACY"]
        if (!validCategories.includes(updateData.category)) {
          throw new Error("Invalid category. Must be one of: FOOD, GROCERY, PHARMACY")
        }
      }

      // Validate subcategory if provided
      if (updateData.subcategoryId) {
        const subcategory = await prisma.subcategory.findUnique({
          where: { id: updateData.subcategoryId },
        })

        if (!subcategory) {
          throw new Error("Subcategory not found")
        }

        // Ensure subcategory matches the product category
        const categoryToCheck = updateData.category || product.category
        if (categoryToCheck && subcategory.category !== categoryToCheck) {
          throw new Error("Subcategory does not match the product category")
        }
      }

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: updateData,
        include: {
          subcategory: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
      })

      return updatedProduct
    } catch (error) {
      logger.error("Update product error:", error)
      throw error
    }
  }

  async deleteProduct(productId: string, userId: string) {
    try {
      // Check ownership through store
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          store: {
            include: { owner: true },
          },
        },
      })

      if (!product) {
        throw new Error("Product not found")
      }

      if (product.store.owner.userId !== userId) {
        throw new Error("Unauthorized to delete this product")
      }

      await prisma.product.delete({
        where: { id: productId },
      })

      return { success: true }
    } catch (error) {
      logger.error("Delete product error:", error)
      throw error
    }
  }

  async updateBusinessHours(storeId: string, businessHours: any[], userId: string) {
    try {
      // Check store ownership
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      if (store.owner.userId !== userId) {
        throw new Error("Unauthorized to update business hours for this store")
      }

      // Delete existing business hours
      await prisma.businessHours.deleteMany({
        where: { storeId },
      })

      // Create new business hours
      const createdHours = await Promise.all(
        businessHours.map((hours) =>
          prisma.businessHours.create({
            data: {
              storeId,
              dayOfWeek: hours.dayOfWeek,
              openTime: hours.openTime,
              closeTime: hours.closeTime,
              isClosed: hours.isClosed || false,
            },
          }),
        ),
      )

      return createdHours
    } catch (error) {
      logger.error("Update business hours error:", error)
      throw error
    }
  }

  async getStoreAnalytics(
    storeId: string,
    params: {
      startDate?: string
      endDate?: string
      userId: string
    },
  ) {
    try {
      // Check store ownership
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      if (store.owner.userId !== params.userId) {
        throw new Error("Unauthorized to view analytics for this store")
      }

      const dateFilter: any = {}
      if (params.startDate) dateFilter.gte = new Date(params.startDate)
      if (params.endDate) dateFilter.lte = new Date(params.endDate)

      // Get orders from bookings
      const orders = await prisma.booking.findMany({
        where: {
          serviceData: {
            path: ["storeId"],
            equals: storeId,
          },
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        include: {
          orderItems: true,
        },
      })

      // Calculate analytics
      const totalOrders = orders.length
      const totalRevenue = orders.reduce((sum, order) => sum + (order.finalPrice || 0), 0)
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

      // Product analytics
      const productCount = await prisma.product.count({
        where: { storeId },
      })

      const lowStockProducts = await prisma.product.count({
        where: {
          storeId,
          stockQuantity: { lt: 10 },
          inStock: true,
        },
      })

      // Popular products
      const orderItems = orders.flatMap((order) => order.orderItems)
      const productSales: Record<string, number> = {}
      orderItems.forEach((item) => {
        productSales[item.name] = (productSales[item.name] || 0) + item.quantity
      })

      const popularProducts = Object.entries(productSales)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, quantity]) => ({ name, quantity }))

      // Category breakdown
      const categoryBreakdown = await prisma.product.groupBy({
        by: ["category"],
        where: { storeId },
        _count: {
          category: true,
        },
      })

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        productCount,
        lowStockProducts,
        popularProducts,
        categoryBreakdown,
        orders: orders.slice(0, 10), // Recent orders
      }
    } catch (error) {
      logger.error("Get store analytics error:", error)
      throw error
    }
  }

  async updateInventory(
    productId: string,
    data: {
      stockQuantity: number
      operation: "set" | "add" | "subtract"
      userId: string
    },
  ) {
    try {
      // Check ownership through store
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          store: {
            include: { owner: true },
          },
        },
      })

      if (!product) {
        throw new Error("Product not found")
      }

      if (product.store.owner.userId !== data.userId) {
        throw new Error("Unauthorized to update inventory for this product")
      }

      let newStockQuantity: number

      switch (data.operation) {
        case "set":
          newStockQuantity = data.stockQuantity
          break
        case "add":
          newStockQuantity = product.stockQuantity + data.stockQuantity
          break
        case "subtract":
          newStockQuantity = Math.max(0, product.stockQuantity - data.stockQuantity)
          break
        default:
          throw new Error("Invalid operation")
      }

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          stockQuantity: newStockQuantity,
          inStock: newStockQuantity > 0,
        },
        include: {
          subcategory: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
      })

      return updatedProduct
    } catch (error) {
      logger.error("Update inventory error:", error)
      throw error
    }
  }

  async getLowStockProducts(
    storeId: string,
    params: {
      threshold: number
      userId: string
    },
  ) {
    try {
      // Check store ownership
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      if (store.owner.userId !== params.userId) {
        throw new Error("Unauthorized to view products for this store")
      }

      const products = await prisma.product.findMany({
        where: {
          storeId,
          stockQuantity: { lt: params.threshold },
          inStock: true,
        },
        include: {
          subcategory: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: { stockQuantity: "asc" },
      })

      return products
    } catch (error) {
      logger.error("Get low stock products error:", error)
      throw error
    }
  }

  private async createBusinessHours(storeId: string, businessHours: any[]) {
    try {
      const createdHours = await Promise.all(
        businessHours.map((hours) =>
          prisma.businessHours.create({
            data: {
              storeId,
              dayOfWeek: hours.dayOfWeek,
              openTime: hours.openTime,
              closeTime: hours.closeTime,
              isClosed: hours.isClosed || false,
            },
          }),
        ),
      )

      return createdHours
    } catch (error) {
      logger.error("Create business hours error:", error)
      throw error
    }
  }
}
