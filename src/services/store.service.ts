import prisma from "../config/database"
import { LocationService } from "./location.service"
import { PricingService } from "./pricing.service"
import logger from "../utils/logger"

export class StoreService {
  private locationService = new LocationService()
  private pricingService = new PricingService()

  async createStore(ownerId: string, storeData: any) {
    try {
      // Create location first
      const location = await prisma.location.create({
        data: {
          latitude: storeData.latitude , // Default to Nigeria's approximate center latitude
          longitude: storeData.longitude, // Default to Nigeria's approximate center longitude
          address: storeData.address || "Unknown",
          city: storeData.city || "Unknown",
          state: storeData.state || "Unknown",
          country: storeData.country || "Nigeria",
          postalCode: storeData.zipCode || "000000",
        },
      })

      // Create store
      const store = await prisma.store.create({
        data: {
          name: storeData.name,
          type: storeData.type,
          locationId: location.id,
          ownerId,
          contactPhone: storeData.phone,
          contactEmail: storeData.email,
          operatingHours: storeData.operatingHours || "9:00 AM - 9:00 PM",
          description: storeData.description,
          image: storeData.image,
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
    categoryId?: string // Changed from category to categoryId
    subcategoryId?: string
    latitude?: number
    longitude?: number
    radius?: number
    isActive?: boolean
    userId?: string // Add userId for role-based filtering
  }): Promise<{
    stores: any[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    try {
      const {
        page,
        limit,
        search,
        type,
        categoryId, // Updated parameter name
        subcategoryId,
        latitude,
        longitude,
        radius = 10000,
        isActive,
        userId,
      } = params
      const skip = (page - 1) * limit

      const where: any = {}

      // Role-based filtering
      if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })

        if (user?.role === "STORE_OWNER") {
          // Store owners can only see their own stores
          const storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
            where: { userId },
            select: { id: true },
          })

          if (storeOwnerProfile) {
            where.ownerId = storeOwnerProfile.id
          } else {
            // If no store owner profile, return empty result
            return {
              stores: [],
              pagination: {
                page,
                limit,
                total: 0,
                totalPages: 0,
              },
            }
          }
        }
        // SUPER_ADMIN and CITY_ADMIN can see all stores (no additional filtering)
      }

      // Apply other filters
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      if (type) {
        logger.info(`Applying type filter: ${type}`)
        where.type = type
      } else {
        logger.info(`No type filter applied`)
      }

      // Only apply isActive filter for authenticated users
      // Unauthenticated users can see all stores
      if (userId && isActive !== undefined) {
        where.isActive = isActive
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
              category: true, // Include category model instead of subcategory.category
              subcategory: {
                include: {
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

      // Get total count before location filtering
      let total = await prisma.store.count({ where })

      // Apply location-based filtering if coordinates are provided
      if (latitude !== undefined && longitude !== undefined && radius !== undefined) {
        // For location filtering, we need to get all stores first to filter by distance
        const allStores = await prisma.store.findMany({
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
              take: 5,
              include: {
                category: true,
                subcategory: {
                  include: {
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
        })

        logger.info(`Location filtering: center (${latitude}, ${longitude}), radius: ${radius}m`)
        logger.info(`Found ${allStores.length} stores before location filtering`)
        logger.info(`Store details before filtering:`)
        allStores.forEach(store => {
          logger.info(`- ${store.name} (${store.type}): (${store.location?.latitude}, ${store.location?.longitude})`)
        })

        // Filter by distance and add distance to store objects
        const storesWithDistance = await Promise.all(
          allStores
            .filter((store) => {
              if (!store.location?.latitude || !store.location?.longitude) {
                logger.info(`Store ${store.id} (${store.name}) has no location data`)
                return false
              }
              return true
            })
            .map(async (store) => {
              // Calculate driving distance using Google Maps
              const distance = await this.locationService.calculateDrivingDistance(
                latitude,
                longitude,
                store.location.latitude,
                store.location.longitude
              )

              const withinRadius = distance <= radius
              logger.info(`Store ${store.id} (${store.name}): location (${store.location.latitude}, ${store.location.longitude}), driving distance: ${distance.toFixed(2)}m, within radius: ${withinRadius}`)

              if (!withinRadius) {
                return null // Will be filtered out
              }

              // Calculate delivery fee using pricing service
              const deliveryEstimate = await this.pricingService.calculateDeliveryEstimate({
                pickupLatitude: store.location.latitude,
                pickupLongitude: store.location.longitude,
                dropoffLatitude: latitude,
                dropoffLongitude: longitude,
                deliveryType: "PACKAGE"
              })

              // Calculate delivery time based on distance
              const deliveryTimeMinutes = Math.max(15, Math.min(60, Math.round(distance / 1000 * 2) + 15)) // 2 min per km + 15 min base, capped at 15-60 min

              return {
                ...store,
                distance: Math.round(distance / 1000 * 10) / 10, // Convert to km and round to 1 decimal place
                deliveryTime: `${deliveryTimeMinutes} min`, // Dynamic delivery time based on distance
                deliveryFee: deliveryEstimate.estimatedPrice, // Dynamic delivery fee calculation
              }
            })
        )

        // Filter out null values (stores outside radius)
        stores = storesWithDistance.filter(store => store !== null)

        logger.info(`After location filtering: ${stores.length} stores`)
        logger.info(`Filtered store details:`)
        stores.forEach(store => {
          logger.info(`- ${store.name} (${store.type}): (${store.location?.latitude}, ${store.location?.longitude})`)
        })

        // Update total to reflect filtered count
        total = stores.length

        // Apply pagination to filtered results
        stores = stores.slice(skip, skip + limit)
      }

      return {
        stores,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
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
      logger.info(`Adding product to store ${storeId} by user ${userId}`)
      logger.info(`Product data:`, productData)

      // Check store ownership
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
          throw new Error("Unauthorized to add products to this store")
        }
      }

      logger.info(`Store ownership check passed for store ${storeId}`)

      if (productData.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: productData.categoryId },
        })

        if (!category) {
          throw new Error("Invalid category ID. Category does not exist.")
        }
      }

      // Validate subcategory if provided
      if (productData.subcategoryId) {
        const subcategory = await prisma.subcategory.findUnique({
          where: { id: productData.subcategoryId },
          include: { category: true },
        })

        if (!subcategory) {
          throw new Error("Subcategory not found")
        }

        // Ensure subcategory matches the product category
        if (productData.categoryId && subcategory.categoryId !== productData.categoryId) {
          throw new Error("Subcategory does not match the product category")
        }
      }

      const product = await prisma.product.create({
        data: {
          storeId,
          name: productData.name,
          description: productData.description,
          price: productData.price,
          categoryId: productData.categoryId,
          subcategoryId: productData.subcategoryId,
          image: productData.image,
          inStock: productData.inStock !== false,
          stockQuantity: productData.stockQuantity || 0,
        },
        include: {
          category: true,
          subcategory: {
            include: {
              category: true,
            },
          },
        },
      })

      logger.info(`Product created successfully with ID ${product.id} for store ${storeId}`)

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
      categoryId?: string // Changed from category to categoryId
      subcategoryId?: string
      inStock?: boolean
    },
  ) {
    try {
      // Check if store exists
      const store = await prisma.store.findUnique({
        where: { id: storeId },
      })

      if (!store) {
        throw new Error("Store not found")
      }

      const { page, limit, search, categoryId, subcategoryId, inStock } = filters // Updated parameter name
      const skip = (page - 1) * limit

      const where: any = { storeId }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ]
      }

      if (categoryId) {
        // Updated to use categoryId
        where.categoryId = categoryId
      }

      if (subcategoryId) {
        where.subcategoryId = subcategoryId
      }

      if (inStock !== undefined) {
        where.inStock = inStock
      }

      logger.info(`Get products for store ${storeId} with filters:`, { search, categoryId, subcategoryId, inStock, page, limit })

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: true, // Include category model
            subcategory: {
              include: {
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

      logger.info(`Found ${total} products for store ${storeId}`)

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
        // Check if user is admin
        const user = await prisma.user.findUnique({
          where: { id: userId },
        })

        if (!user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(user.role)) {
          throw new Error("Unauthorized to update this product")
        }
      }

      if (updateData.categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: updateData.categoryId },
        })

        if (!category) {
          throw new Error("Invalid category ID. Category does not exist.")
        }
      }

      // Validate subcategory if provided
      if (updateData.subcategoryId) {
        const subcategory = await prisma.subcategory.findUnique({
          where: { id: updateData.subcategoryId },
          include: { category: true },
        })

        if (!subcategory) {
          throw new Error("Subcategory not found")
        }

        // Ensure subcategory matches the product category
        const categoryToCheck = updateData.categoryId || product.categoryId
        if (categoryToCheck && subcategory.categoryId !== categoryToCheck) {
          throw new Error("Subcategory does not match the product category")
        }
      }

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: updateData,
        include: {
          category: true, // Include category model
          subcategory: {
            include: {
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
        // Check if user is admin
        const user = await prisma.user.findUnique({
          where: { id: userId },
        })

        if (!user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(user.role)) {
          throw new Error("Unauthorized to delete this product")
        }
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
        by: ["categoryId"],
        where: { storeId },
        _count: {
          categoryId: true,
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
        // Check if user is admin
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
        })

        if (!user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(user.role)) {
          throw new Error("Unauthorized to update inventory for this product")
        }
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
        // Check if user is admin
        const user = await prisma.user.findUnique({
          where: { id: params.userId },
        })

        if (!user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(user.role)) {
          throw new Error("Unauthorized to view products for this store")
        }
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
