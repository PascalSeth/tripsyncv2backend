import type { Request, Response, NextFunction } from "express"
import type { AuthenticatedRequest } from "../types"
import prisma from "../config/database"
import { StoreService } from "../services/store.service"
import { LocationService } from "../services/location.service"
import { NotificationService } from "../services/notification.service"
import { FileUploadService } from "../services/file-upload.service"
import logger from "../utils/logger"
import bcrypt from "bcrypt"
import multer from "multer"
import path from "path"

// Configure multer for file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'images' || file.fieldname === 'image') {
      const allowedTypes = /jpeg|jpg|png|gif|webp/
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
      const mimetype = allowedTypes.test(file.mimetype)

      if (mimetype && extname) {
        return cb(null, true)
      } else {
        cb(new Error("Only image files are allowed"))
      }
    } else {
      cb(null, true) // Allow other fields
    }
  },
})

export class StoreController {
  private storeService = new StoreService()
  private locationService = new LocationService()
  private notificationService = new NotificationService()
  private fileUploadService = new FileUploadService()

  // File upload middleware
  uploadProductImages = upload.fields([
    { name: 'name', maxCount: 1 },
    { name: 'price', maxCount: 1 },
    { name: 'categoryId', maxCount: 1 },
    { name: 'description', maxCount: 1 },
    { name: 'subcategoryId', maxCount: 1 },
    { name: 'inStock', maxCount: 1 },
    { name: 'stockQuantity', maxCount: 1 },
    { name: 'images', maxCount: 5 },
  ])
  uploadStoreImage = upload.single("image")
  uploadCategoryImage = upload.single("image")
  uploadSubcategoryImage = upload.single("image")

  // Middleware to debug raw multipart data
  debugMultipart = (req: Request, res: Response, next: NextFunction) => {
    console.log("[v0] debugMultipart - Content-Type:", req.headers["content-type"])
    console.log("[v0] debugMultipart - Content-Length:", req.headers["content-length"])
    console.log("[v0] debugMultipart - Raw body type:", typeof req.body)
    console.log("[v0] debugMultipart - Raw body:", req.body)
    next()
  }

  onboardStoreOwner = async (req: AuthenticatedRequest | Request, res: Response) => {
    try {
      const { businessLicense, businessType, taxId } = req.body

      // Check if this is for an existing authenticated user
      let userId = (req as AuthenticatedRequest).user?.id
      let user = null

      if (!userId) {
        // For new users, require basic user info
        const { email, phone, firstName, lastName, password } = req.body

        if (!email || !phone || !firstName || !lastName) {
          return res.status(400).json({
            success: false,
            message: "Email, phone, firstName, and lastName are required for new users",
          })
        }

        // Check if user already exists
        const existingUser = await prisma.user.findFirst({
          where: { OR: [{ email }, { phone }] },
        })

        if (existingUser) {
          const existingProfile = await prisma.storeOwnerProfile.findUnique({
            where: { userId: existingUser.id },
          })

          if (existingProfile) {
            return res.status(400).json({
              success: false,
              message: "User already has a store owner profile",
            })
          }

          userId = existingUser.id
          user = existingUser
        } else {
          // Create new user
          const referralCode = `SO${Date.now().toString().slice(-6)}`
          user = await prisma.user.create({
            data: {
              email,
              phone,
              firstName,
              lastName,
              passwordHash: password ? await bcrypt.hash(password, 12) : null,
              role: "STORE_OWNER",
              referralCode,
              isActive: true,
              subscriptionStatus: "ACTIVE",
              subscriptionTier: "BASIC",
              nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              commissionBalance: 0,
              isCommissionCurrent: true,
            },
          })
          userId = user.id
        }
      } else {
        // Check if authenticated user already has store owner profile
        const existingProfile = await prisma.storeOwnerProfile.findUnique({
          where: { userId },
        })

        if (existingProfile) {
          return res.status(400).json({
            success: false,
            message: "Store owner profile already exists",
          })
        }

        // Update existing user role
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            role: "STORE_OWNER",
            subscriptionStatus: "ACTIVE",
            subscriptionTier: "BASIC",
            nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            isCommissionCurrent: true,
          },
        })
      }

      // Create store owner profile
      const storeOwnerProfile = await prisma.storeOwnerProfile.create({
        data: {
          userId,
          businessLicense,
          taxId: taxId || null,
          businessType,
          verificationStatus: "PENDING",
          monthlyCommissionDue: 0,
          commissionStatus: "CURRENT",
        },
      })

      // Create customer profile if it doesn't exist
      const existingCustomerProfile = await prisma.customerProfile.findUnique({
        where: { userId },
      })

      if (!existingCustomerProfile) {
        await prisma.customerProfile.create({
          data: {
            userId,
            preferredLanguage: "en",
            loyaltyPoints: 0,
            subscriptionTier: "BASIC",
            totalSpent: 0,
            totalRides: 0,
            totalOrders: 0,
            averageRating: 5.0,
            monthlyCommissionDue: 0,
            commissionStatus: "CURRENT",
          },
        })
      }

      // Send notification
      await this.notificationService.notifyCustomer(userId, {
        type: "STORE_OWNER_ONBOARDING",
        title: "Store Owner Application Submitted",
        body: "Your store owner application has been submitted for review.",
        priority: "STANDARD",
      })

      // Get complete profile data
      const completeProfile = await prisma.storeOwnerProfile.findUnique({
        where: { id: storeOwnerProfile.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              avatar: true,
              role: true,
              isVerified: true,
            },
          },
        },
      })

      res.status(201).json({
        success: true,
        message: "Store owner onboarding completed successfully",
        data: completeProfile,
      })
    } catch (error) {
      logger.error("Store owner onboarding error:", error)
      res.status(500).json({
        success: false,
        message: "Store owner onboarding failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  createStore = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const storeData = req.body

      // Handle image upload if present
      if (req.file) {
        const imageUrl = await this.fileUploadService.uploadImage(req.file, "stores")
        storeData.image = imageUrl
      }

      // Get user details to check role
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      let storeOwnerProfileId: string

      if (user.role === "SUPER_ADMIN") {
        // Super admin can create stores without store owner profile requirements
        let storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
          where: { userId },
        })

        if (!storeOwnerProfile) {
          // Create store owner profile for super admin if it doesn't exist
          storeOwnerProfile = await prisma.storeOwnerProfile.create({
            data: {
              userId,
              businessLicense: "SUPER_ADMIN_AUTO_GENERATED",
              taxId: null,
              businessType: "OTHER",
              verificationStatus: "APPROVED",
              monthlyCommissionDue: 0,
              commissionStatus: "CURRENT",
            },
          })
        }

        storeOwnerProfileId = storeOwnerProfile.id
      } else {
        // Regular store owner flow
        const storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
          where: { userId },
        })

        if (!storeOwnerProfile || storeOwnerProfile.verificationStatus !== "APPROVED") {
          return res.status(403).json({
            success: false,
            message: "Store owner profile not found or not verified",
          })
        }

        storeOwnerProfileId = storeOwnerProfile.id
      }

      const store = await this.storeService.createStore(storeOwnerProfileId, storeData)

      res.status(201).json({
        success: true,
        message: "Store created successfully",
        data: store,
      })
    } catch (error) {
      logger.error("Create store error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create store",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getStores = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id // Get user ID from authenticated request
      const {
        page = 1,
        limit = 20,
        search,
        type,
        category,
        subcategoryId,
        latitude,
        longitude,
        radius = 10000,
        isActive,
      } = req.query

      logger.info(`GetStores request - userId: ${userId}, params:`, {
        page, limit, search, type, category, subcategoryId, latitude, longitude, radius, isActive
      })

      const { stores, pagination } = await this.storeService.getStores({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        type: type as string,
        categoryId: (category && category !== "undefined" && category !== "") ? category as string : undefined,
        subcategoryId: (subcategoryId && subcategoryId !== "undefined" && subcategoryId !== "") ? subcategoryId as string : undefined,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        radius: Number(radius),
        isActive: userId ? (isActive === "true") : undefined, // Only apply isActive filter for authenticated users
        userId, // Pass user ID for role-based filtering
      })

      // Disable caching for this endpoint
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      })

      res.json({
        success: true,
        message: "Stores retrieved successfully",
        data: {
          stores,
          pagination,
        },
      })
    } catch (error) {
      logger.error("Get stores error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve stores",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getStoreById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id

      const store = await this.storeService.getStoreById(storeId)

      if (!store) {
        return res.status(404).json({
          success: false,
          message: "Store not found",
        })
      }

      res.json({
        success: true,
        message: "Store retrieved successfully",
        data: store,
      })
    } catch (error) {
      logger.error("Get store by ID error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve store",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateStore = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id
      const userId = req.user!.id
      const updateData = req.body

      // Handle image upload if present
      if (req.file) {
        const imageUrl = await this.fileUploadService.uploadImage(req.file, "stores")
        updateData.image = imageUrl
      }

      const store = await this.storeService.updateStore(storeId, updateData, userId)

      res.json({
        success: true,
        message: "Store updated successfully",
        data: store,
      })
    } catch (error) {
      logger.error("Update store error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update store",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  deleteStore = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id
      const userId = req.user!.id

      await this.storeService.deleteStore(storeId, userId)

      res.json({
        success: true,
        message: "Store deleted successfully",
      })
    } catch (error) {
      logger.error("Delete store error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to delete store",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Subcategory Management (Super Admin only)
  createSubcategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("[v0] createSubcategory - req.body:", req.body)
      console.log("[v0] createSubcategory - req.file:", req.file)

      const name = req.body.name
      const description = req.body.description
      const categoryId = req.body.categoryId
      const imageFile = req.file
      const userId = req.user!.id

      console.log("[v0] createSubcategory - extracted name:", name)
      console.log("[v0] createSubcategory - extracted description:", description)
      console.log("[v0] createSubcategory - extracted categoryId:", categoryId)

      if (!name) {
        console.log("[v0] createSubcategory - name validation failed")
        return res.status(400).json({
          success: false,
          message: "Subcategory name is required",
        })
      }

      if (!categoryId) {
        console.log("[v0] createSubcategory - categoryId validation failed")
        return res.status(400).json({
          success: false,
          message: "Category ID is required",
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can create subcategories",
        })
      }

      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      })

      if (!category) {
        return res.status(400).json({
          success: false,
          message: "Invalid category ID. Category does not exist.",
        })
      }

      const existingSubcategory = await prisma.subcategory.findFirst({
        where: {
          name: name.trim(),
          categoryId: categoryId,
        },
      })

      if (existingSubcategory) {
        return res.status(400).json({
          success: false,
          message: "Subcategory with this name already exists in this category",
        })
      }

      let imageUrl = null
      if (imageFile) {
        imageUrl = await this.fileUploadService.uploadImage(imageFile, "subcategories")
      }

      const subcategory = await prisma.subcategory.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          imageUrl,
          categoryId,
        },
        include: {
          category: true,
        },
      })

      res.status(201).json({
        success: true,
        message: "Subcategory created successfully",
        data: subcategory,
      })
    } catch (error) {
      console.log("[v0] createSubcategory - error occurred:", error)
      logger.error("Create subcategory error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create subcategory",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getSubcategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 50, search, category } = req.query

      const where: any = {}
      if (category) where.category = category as string
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
        ]
      }

      const [subcategories, total] = await Promise.all([
        prisma.subcategory.findMany({
          where,
          include: {
            _count: {
              select: {
                products: true,
              },
            },
          },
          orderBy: { name: "asc" },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        prisma.subcategory.count({ where }),
      ])

      res.json({
        success: true,
        message: "Subcategories retrieved successfully",
        data: subcategories,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get subcategories error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve subcategories",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateSubcategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { subcategoryId } = req.params
      const name = req.body.name
      const description = req.body.description
      const categoryId = req.body.categoryId
      const imageFile = req.file
      const userId = req.user!.id

      console.log("[v0] updateSubcategory - req.body:", req.body)
      console.log("[v0] updateSubcategory - req.file:", req.file)

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can update subcategories",
        })
      }

      if (categoryId) {
        const category = await prisma.category.findUnique({
          where: { id: categoryId },
        })

        if (!category) {
          return res.status(400).json({
            success: false,
            message: "Invalid category ID. Category does not exist.",
          })
        }
      }

      const updateData: any = {}
      if (name) updateData.name = name.trim()
      if (description !== undefined) updateData.description = description?.trim() || null
      if (categoryId) updateData.categoryId = categoryId

      if (imageFile) {
        updateData.imageUrl = await this.fileUploadService.uploadImage(imageFile, "subcategories")
      }

      const updatedSubcategory = await prisma.subcategory.update({
        where: { id: subcategoryId },
        data: updateData,
        include: {
          category: true,
        },
      })

      res.json({
        success: true,
        message: "Subcategory updated successfully",
        data: updatedSubcategory,
      })
    } catch (error) {
      console.log("[v0] updateSubcategory - error occurred:", error)
      logger.error("Update subcategory error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update subcategory",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  deleteSubcategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const subcategoryId = req.params.subcategoryId
      const userId = req.user!.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can delete subcategories",
        })
      }

      const subcategory = await prisma.subcategory.findUnique({
        where: { id: subcategoryId },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      })

      if (!subcategory) {
        return res.status(404).json({
          success: false,
          message: "Subcategory not found",
        })
      }

      if (subcategory._count.products > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete subcategory with existing products",
        })
      }

      await prisma.subcategory.delete({
        where: { id: subcategoryId },
      })

      res.json({
        success: true,
        message: "Subcategory deleted successfully",
      })
    } catch (error) {
      logger.error("Delete subcategory error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to delete subcategory",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Get categories
  getCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { storeType } = req.query // Add storeType parameter

      const categories = await prisma.category.findMany({
        where: storeType ? {
          storeTypes: {
            has: storeType as any
          }
        } : {},
        include: {
          subcategories: {
            include: {
              _count: {
                select: {
                  products: true,
                },
              },
            },
            orderBy: { name: "asc" },
          },
          _count: {
            select: {
              products: true,
            },
          },
        },
        orderBy: { name: "asc" },
      })

      const categoriesWithStoreCounts = await Promise.all(
        categories.map(async (category) => {
          const storeCount = await prisma.store.count({
            where: {
              type: storeType ? { in: category.storeTypes } : undefined,
              products: {
                some: {
                  categoryId: category.id,
                },
              },
            },
          })

          return {
            ...category,
            storeCount,
          }
        }),
      )

      res.json({
        success: true,
        data: categoriesWithStoreCounts,
      })
    } catch (error) {
      logger.error("Get categories error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to get categories",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Product Management
  addProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id
      const userId = req.user!.id
      const productData = req.body

      const images: string[] = []
      if (req.files && typeof req.files === 'object' && !Array.isArray(req.files) && req.files.images && Array.isArray(req.files.images)) {
        for (const file of req.files.images) {
          const imageUrl = await this.fileUploadService.uploadImage(file, "products")
          images.push(imageUrl)
        }
      }

      if (images.length > 0) {
        productData.images = images
        productData.image = images[0]
      }

      const product = await this.storeService.addProduct(storeId, productData, userId)

      res.status(201).json({
        success: true,
        message: "Product added successfully",
        data: product,
      })
    } catch (error) {
      logger.error("Add product error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to add product",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getProducts = async (req: Request, res: Response) => {
    try {
      const storeId = req.params.id
      const { page = 1, limit = 20, search, category, subcategoryId, inStock } = req.query

      const products = await this.storeService.getProducts(storeId, {
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        categoryId: category as string,
        subcategoryId: subcategoryId as string,
        inStock: inStock !== undefined ? inStock === "true" : undefined,
      })
      console.log('profuc', products)
      res.json({
        success: true,
        message: "Products retrieved successfully",
        data: products,
      })
    } catch (error) {
      logger.error("Get products error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve products",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = req.params.productId
      const userId = req.user!.id
      const updateData = req.body

      if (req.files && typeof req.files === 'object' && !Array.isArray(req.files) && req.files.images && Array.isArray(req.files.images)) {
        const images: string[] = []
        for (const file of req.files.images) {
          const imageUrl = await this.fileUploadService.uploadImage(file, "products")
          images.push(imageUrl)
        }

        if (images.length > 0) {
          updateData.images = images
          updateData.image = images[0]
        }
      }

      const product = await this.storeService.updateProduct(productId, updateData, userId)

      res.json({
        success: true,
        message: "Product updated successfully",
        data: product,
      })
    } catch (error) {
      logger.error("Update product error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update product",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  deleteProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = req.params.productId
      const userId = req.user!.id

      await this.storeService.deleteProduct(productId, userId)

      res.json({
        success: true,
        message: "Product deleted successfully",
      })
    } catch (error) {
      logger.error("Delete product error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to delete product",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Business Hours Management
  updateBusinessHours = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id
      const userId = req.user!.id
      const { businessHours } = req.body

      const updatedHours = await this.storeService.updateBusinessHours(storeId, businessHours, userId)

      res.json({
        success: true,
        message: "Business hours updated successfully",
        data: updatedHours,
      })
    } catch (error) {
      logger.error("Update business hours error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update business hours",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getBusinessHours = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id

      const businessHours = await prisma.businessHours.findMany({
        where: { storeId },
        orderBy: { dayOfWeek: "asc" },
      })

      res.json({
        success: true,
        message: "Business hours retrieved successfully",
        data: businessHours,
      })
    } catch (error) {
      logger.error("Get business hours error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve business hours",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Store Analytics
  getStoreAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id
      const userId = req.user!.id
      const { startDate, endDate } = req.query

      const analytics = await this.storeService.getStoreAnalytics(storeId, {
        startDate: startDate as string,
        endDate: endDate as string,
        userId,
      })

      res.json({
        success: true,
        message: "Store analytics retrieved successfully",
        data: analytics,
      })
    } catch (error) {
      logger.error("Get store analytics error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve store analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Inventory Management
  updateInventory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const productId = req.params.productId
      const userId = req.user!.id
      const { stockQuantity, operation } = req.body

      const product = await this.storeService.updateInventory(productId, {
        stockQuantity,
        operation,
        userId,
      })

      res.json({
        success: true,
        message: "Inventory updated successfully",
        data: product,
      })
    } catch (error) {
      logger.error("Update inventory error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update inventory",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getLowStockProducts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id
      const userId = req.user!.id
      const { threshold = 10 } = req.query

      const products = await this.storeService.getLowStockProducts(storeId, {
        threshold: Number(threshold),
        userId,
      })

      res.json({
        success: true,
        message: "Low stock products retrieved successfully",
        data: products,
      })
    } catch (error) {
      logger.error("Get low stock products error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve low stock products",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Store Owner Profile Management
  getStoreOwnerProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id

      const profile = await prisma.storeOwnerProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
              mobileMoneyProvider: true,
              mobileMoneyNumber: true,
              mobileMoneyAccountName: true,
              bankName: true,
              bankAccountNumber: true,
              bankAccountName: true,
              bankCode: true,
            },
          },
          stores: {
            include: {
              location: true,
              _count: {
                select: {
                  products: true,
                },
              },
            },
          },
        },
      })

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Store owner profile not found",
        })
      }

      res.json({
        success: true,
        message: "Store owner profile retrieved successfully",
        data: profile,
      })
    } catch (error) {
      logger.error("Get store owner profile error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve store owner profile",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateStoreOwnerProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const updateData = req.body

      const profile = await prisma.storeOwnerProfile.updateMany({
        where: { userId },
        data: updateData,
      })

      if (profile.count === 0) {
        return res.status(404).json({
          success: false,
          message: "Store owner profile not found",
        })
      }

      res.json({
        success: true,
        message: "Store owner profile updated successfully",
      })
    } catch (error) {
      logger.error("Update store owner profile error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update store owner profile",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Admin functions
  getAllStoreOwners = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, verificationStatus, businessType } = req.query

      const where: any = {}
      if (verificationStatus) where.verificationStatus = verificationStatus
      if (businessType) where.businessType = businessType

      const storeOwners = await prisma.storeOwnerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          stores: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
            },
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { id: "desc" },
      })

      const total = await prisma.storeOwnerProfile.count({ where })

      res.json({
        success: true,
        message: "Store owners retrieved successfully",
        data: storeOwners,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get all store owners error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve store owners",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  verifyStoreOwner = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeOwnerId = req.params.id

      const storeOwner = await prisma.storeOwnerProfile.update({
        where: { id: storeOwnerId },
        data: {
          verificationStatus: "APPROVED",
          verifiedAt: new Date(),
        },
        include: { user: true },
      })

      await this.notificationService.notifyCustomer(storeOwner.userId, {
        type: "STORE_OWNER_VERIFIED",
        title: "Store Owner Verified",
        body: "Your store owner application has been approved. You can now create stores.",
        priority: "STANDARD",
      })

      res.json({
        success: true,
        message: "Store owner verified successfully",
        data: storeOwner,
      })
    } catch (error) {
      logger.error("Verify store owner error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to verify store owner",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  rejectStoreOwner = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeOwnerId = req.params.id
      const { reason } = req.body

      const storeOwner = await prisma.storeOwnerProfile.update({
        where: { id: storeOwnerId },
        data: { verificationStatus: "REJECTED" },
        include: { user: true },
      })

      await this.notificationService.notifyCustomer(storeOwner.userId, {
        type: "STORE_OWNER_REJECTED",
        title: "Store Owner Application Rejected",
        body: `Your store owner application has been rejected. Reason: ${reason}`,
        priority: "STANDARD",
      })

      res.json({
        success: true,
        message: "Store owner rejected successfully",
        data: storeOwner,
      })
    } catch (error) {
      logger.error("Reject store owner error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to reject store owner",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Bulk operations
  bulkUpdateProducts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id
      const userId = req.user!.id
      const { productIds, updateData } = req.body

      const store = await prisma.store.findUnique({
        where: { id: storeId },
        include: { owner: true },
      })

      if (!store) {
        return res.status(404).json({
          success: false,
          message: "Store not found",
        })
      }

      if (store.owner.userId !== userId) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized to update products in this store",
        })
      }

      const updatedProducts = await prisma.product.updateMany({
        where: {
          id: { in: productIds },
          storeId,
        },
        data: updateData,
      })

      res.json({
        success: true,
        message: `${updatedProducts.count} products updated successfully`,
        data: { updatedCount: updatedProducts.count },
      })
    } catch (error) {
      logger.error("Bulk update products error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to bulk update products",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Store statistics
  getStoreStatistics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id

      const storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
        where: { userId },
      })

      if (!storeOwnerProfile) {
        return res.status(403).json({
          success: false,
          message: "Store owner profile not found",
        })
      }

      const [totalStores, activeStores, totalProducts, lowStockProducts] = await Promise.all([
        prisma.store.count({
          where: { ownerId: storeOwnerProfile.id },
        }),
        prisma.store.count({
          where: { ownerId: storeOwnerProfile.id, isActive: true },
        }),
        prisma.product.count({
          where: {
            store: { ownerId: storeOwnerProfile.id },
          },
        }),
        prisma.product.count({
          where: {
            store: { ownerId: storeOwnerProfile.id },
            stockQuantity: { lt: 10 },
            inStock: true,
          },
        }),
      ])

      res.json({
        success: true,
        message: "Store statistics retrieved successfully",
        data: {
          totalStores,
          activeStores,
          totalProducts,
          lowStockProducts,
        },
      })
    } catch (error) {
      logger.error("Get store statistics error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve store statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Category Management (Super Admin only)
  createCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      console.log("[v0] createCategory - req.body:", req.body)
      console.log("[v0] createCategory - req.body keys:", Object.keys(req.body))
      console.log("[v0] createCategory - req.file:", req.file)
      console.log("[v0] createCategory - req.query:", req.query)
      console.log("[v0] createCategory - req.params:", req.params)

      const name = req.body.name
      const description = req.body.description
      const imageFile = req.file
      const storeTypes = req.body.storeTypes // Array of StoreType enums (already validated and converted)

      console.log("[v0] createCategory - extracted name:", name)
      console.log("[v0] createCategory - extracted description:", description)
      console.log("[v0] createCategory - extracted storeTypes:", storeTypes)

      const userId = req.user!.id
      console.log("[v0] createCategory - userId:", userId)

      if (!name) {
        console.log("[v0] createCategory - name validation failed")
        res.status(400).json({
          success: false,
          message: "Category name is required",
        })
        return
      }


      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        res.status(403).json({
          success: false,
          message: "Only super admins can create categories",
        })
        return
      }

      const existingCategory = await prisma.category.findUnique({
        where: { name: name.trim() },
      })

      if (existingCategory) {
        res.status(400).json({
          success: false,
          message: "Category with this name already exists",
        })
        return
      }

      let imageUrl = null
      if (imageFile) {
        imageUrl = await this.fileUploadService.uploadImage(imageFile, "categories")
      }

      const category = await prisma.category.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          imageUrl,
          storeTypes,
        },
      })

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: category,
      })
    } catch (error) {
      console.log("[v0] createCategory - error occurred:", error)
      logger.error("Create category error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to create category",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params
      const { name, description, storeTypes } = req.body
      const userId = req.user!.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can update categories",
        })
      }

      const existingCategory = await prisma.category.findUnique({
        where: { id },
      })

      if (!existingCategory) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        })
      }


      const updateData: any = { name, description }
      if (storeTypes) updateData.storeTypes = storeTypes
      if (req.file) {
        updateData.imageUrl = await this.fileUploadService.uploadImage(req.file, "categories")
      }

      const category = await prisma.category.update({
        where: { id },
        data: updateData,
      })

      res.json({
        success: true,
        message: "Category updated successfully",
        data: category,
      })
    } catch (error) {
      logger.error("Update category error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update category",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const categoryId = req.params.categoryId
      const userId = req.user!.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can delete categories",
        })
      }

      const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
          _count: {
            select: {
              products: true,
              subcategories: true,
            },
          },
        },
      })

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        })
      }

      if (category._count.products > 0 || category._count.subcategories > 0) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete category with existing products or subcategories",
        })
      }

      await prisma.category.delete({
        where: { id: categoryId },
      })

      res.json({
        success: true,
        message: "Category deleted successfully",
      })
    } catch (error) {
      logger.error("Delete category error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to delete category",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Admin: Get all products across all stores
  getAllProducts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        storeId,
        categoryId,
        subcategoryId,
        inStock,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query

      const where: any = {}

      // Filter by store
      if (storeId && storeId !== "undefined" && storeId !== "") {
        where.storeId = storeId
      }

      // Filter by category
      if (categoryId && categoryId !== "undefined" && categoryId !== "") {
        where.categoryId = categoryId
      }

      // Filter by subcategory
      if (subcategoryId && subcategoryId !== "undefined" && subcategoryId !== "") {
        where.subcategoryId = subcategoryId
      }

      // Filter by stock status
      if (inStock !== undefined) {
        where.inStock = inStock === "true"
      }

      // Search in product name or description
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { description: { contains: search as string, mode: "insensitive" } },
        ]
      }

      const skip = (Number(page) - 1) * Number(limit)

      // Build order by
      const orderBy: any = {}
      orderBy[sortBy as string] = sortOrder === "asc" ? "asc" : "desc"

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            store: {
              select: {
                id: true,
                name: true,
                type: true,
                isActive: true,
                location: {
                  select: {
                    city: true,
                    state: true,
                  },
                },
                owner: {
                  include: {
                    user: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
            subcategory: {
              select: {
                id: true,
                name: true,
                description: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy,
          skip,
          take: Number(limit),
        }),
        prisma.product.count({ where }),
      ])

      res.json({
        success: true,
        message: "Products retrieved successfully",
        data: {
          products,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
          },
          filters: {
            search: search as string,
            storeId: storeId as string,
            categoryId: categoryId as string,
            subcategoryId: subcategoryId as string,
            inStock: inStock === "true",
            sortBy: sortBy as string,
            sortOrder: sortOrder as string,
          },
        },
      })
    } catch (error) {
      logger.error("Get all products error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve products",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
