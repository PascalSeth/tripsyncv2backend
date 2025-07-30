import type { Request, Response } from "express"
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
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"))
    }
  },
})

export class StoreController {
  private storeService = new StoreService()
  private locationService = new LocationService()
  private notificationService = new NotificationService()
  private fileUploadService = new FileUploadService()

  // File upload middleware
  uploadProductImages = upload.array("images", 5) // Allow up to 5 images
  uploadStoreImage = upload.single("image")

  // UNIFIED: Handle both new user creation and existing user onboarding
  onboardStoreOwner = async (req: AuthenticatedRequest | Request, res: Response) => {
    try {
      // Log incoming request data for debugging
      console.log("=== STORE OWNER ONBOARDING REQUEST ===")
      console.log("Request body:", JSON.stringify(req.body, null, 2))
      console.log("Request user:", (req as AuthenticatedRequest).user)
      console.log("=========================================")

      const {
        // User data (for new user creation)
        email,
        phone,
        password,
        firstName,
        lastName,
        gender,
        dateOfBirth,
        // Store owner profile details
        businessLicense,
        taxId,
        businessType,
        // Store details (optional)
        storeInfo,
      } = req.body

      // Log extracted data
      console.log("=== EXTRACTED DATA ===")
      console.log("email:", email)
      console.log("phone:", phone)
      console.log("businessLicense:", businessLicense)
      console.log("businessType:", businessType)
      console.log("hasAuthenticatedUser:", !!(req as AuthenticatedRequest).user?.id)
      console.log("=====================")

      // Check if this is for an existing user or creating a new one
      let userId = (req as AuthenticatedRequest).user?.id
      let user = null
      let isExistingUser = false

      if (!userId) {
        // Create new user for store owner onboarding
        if (!email || !phone || !firstName || !lastName || !businessLicense || !businessType) {
          return res.status(400).json({
            success: false,
            message:
              "Email, phone, firstName, lastName, businessLicense, and businessType are required for new store owner registration",
          })
        }

        // Check if user already exists by email OR phone
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ email }, { phone }],
          },
        })

        if (existingUser) {
          // User exists, check if they already have a store owner profile
          const existingStoreOwnerProfile = await prisma.storeOwnerProfile.findUnique({
            where: { userId: existingUser.id },
          })

          if (existingStoreOwnerProfile) {
            return res.status(400).json({
              success: false,
              message: "User already has a store owner profile",
            })
          }

          // User exists but no store owner profile, use existing user
          userId = existingUser.id
          user = existingUser
          isExistingUser = true

          // Update existing user with additional store owner info if provided
          user = await prisma.user.update({
            where: { id: userId },
            data: {
              role: "STORE_OWNER",
              // Update other fields if they're different/missing
              ...(firstName && firstName !== existingUser.firstName && { firstName }),
              ...(lastName && lastName !== existingUser.lastName && { lastName }),
              ...(phone && phone !== existingUser.phone && { phone }),
              ...(gender && !existingUser.gender && { gender }),
              ...(dateOfBirth && !existingUser.dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
              // Update commission settings
              subscriptionStatus: "ACTIVE",
              subscriptionTier: "BASIC",
              nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              commissionBalance: 0,
              isCommissionCurrent: true,
            },
          })
        } else {
          // Generate referral code
          const referralCode = `SO${Date.now().toString().slice(-6)}`

          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              phone,
              firstName,
              lastName,
              passwordHash: password ? await bcrypt.hash(password, 12) : null,
              gender: gender || null,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
              role: "STORE_OWNER",
              referralCode,
              isActive: true,
              isVerified: false,
              mobileMoneyVerified: false,
              bankAccountVerified: false,
              // Commission settings
              subscriptionStatus: "ACTIVE",
              subscriptionTier: "BASIC",
              nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              commissionBalance: 0,
              isCommissionCurrent: true,
            },
          })

          userId = user.id
        }
      } else {
        // Check if store owner profile already exists for existing authenticated user
        const existingProfile = await prisma.storeOwnerProfile.findUnique({
          where: { userId },
        })

        if (existingProfile) {
          return res.status(400).json({
            success: false,
            message: "Store owner profile already exists for this user",
          })
        }

        // Update existing authenticated user role to STORE_OWNER
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            role: "STORE_OWNER",
            // Update commission settings
            subscriptionStatus: "ACTIVE",
            subscriptionTier: "BASIC",
            nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            isCommissionCurrent: true,
          },
        })

        isExistingUser = true
      }

      // Create store owner profile
      const storeOwnerProfile = await prisma.storeOwnerProfile.create({
        data: {
          userId,
          businessLicense,
          taxId,
          businessType,
          verificationStatus: "PENDING",
          monthlyCommissionDue: 0,
          commissionStatus: "CURRENT",
        },
      })

      // Create customer profile (for flexibility - users can be both customers and store owners)
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

      // Create initial store if provided
      let store = null
      if (storeInfo) {
        console.log("=== CREATING STORE ===")
        console.log("storeInfo:", JSON.stringify(storeInfo, null, 2))
        console.log("storeOwnerProfile.id:", storeOwnerProfile.id)

        try {
          store = await this.storeService.createStore(storeOwnerProfile.id, storeInfo)
          console.log("Store created successfully:", store)
        } catch (storeError) {
          console.error("Error creating store:", storeError)
          logger.error("Error creating store during onboarding:", storeError)
          // Don't throw error here, just log it so onboarding can continue
        }

        console.log("======================")
      }

      // Send appropriate notifications
      if (isExistingUser) {
        await this.notificationService.notifyCustomer(userId, {
          type: "STORE_OWNER_ONBOARDING",
          title: "Store Owner Application Submitted",
          body: "Your store owner application has been submitted for review. We'll notify you once it's approved.",
          priority: "STANDARD",
        })
      } else {
        // Send welcome notification for new users
        await this.notificationService.notifyCustomer(userId, {
          type: "STORE_OWNER_ONBOARDING",
          title: "Welcome to TripSync Store!",
          body: "Your store owner account has been created successfully. Please verify your email and phone number.",
          priority: "STANDARD",
        })

        await this.notificationService.notifyCustomer(userId, {
          type: "VERIFICATION_APPROVED",
          title: "Account Verification Required",
          body: "Please complete your account verification to start creating stores.",
          priority: "URGENT",
        })
      }

      // Get complete profile data to return
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

      res.status(201).json({
        success: true,
        message: isExistingUser
          ? "Store owner profile added to existing user successfully"
          : "Store owner onboarding completed successfully",
        data: {
          user: completeProfile?.user,
          storeOwnerProfile: completeProfile,
          store,
          isExistingUser,
        },
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

      const storeOwnerProfile = await prisma.storeOwnerProfile.findUnique({
        where: { userId },
      })

      if (!storeOwnerProfile || storeOwnerProfile.verificationStatus !== "APPROVED") {
        return res.status(403).json({
          success: false,
          message: "Store owner profile not found or not verified",
        })
      }

      const store = await this.storeService.createStore(storeOwnerProfile.id, storeData)

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
        isActive = true,
      } = req.query

      const stores = await this.storeService.getStores({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        type: type as string,
        category: category as string, // This will be the enum value (FOOD, GROCERY, PHARMACY)
        subcategoryId: subcategoryId as string,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        radius: Number(radius),
        isActive: isActive === "true",
      })

      res.json({
        success: true,
        message: "Stores retrieved successfully",
        data: stores,
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
      const userId = req.user!.id
      const { name, description, category, imageUrl } = req.body

      // Check if user is super admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can create subcategories",
        })
      }

      // Validate category enum
      const validCategories = ["FOOD", "GROCERY", "PHARMACY"]
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid category. Must be one of: FOOD, GROCERY, PHARMACY",
        })
      }

      // Check if subcategory already exists in this category
      const existingSubcategory = await prisma.subcategory.findFirst({
        where: {
          name,
          category,
        },
      })

      if (existingSubcategory) {
        return res.status(400).json({
          success: false,
          message: "Subcategory already exists in this category",
        })
      }

      const subcategory = await prisma.subcategory.create({
        data: {
          name,
          description,
          category,
          imageUrl,
        },
      })

      res.status(201).json({
        success: true,
        message: "Subcategory created successfully",
        data: subcategory,
      })
    } catch (error) {
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
      const subcategoryId = req.params.id
      const userId = req.user!.id
      const updateData = req.body

      // Check if user is super admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can update subcategories",
        })
      }

      // Validate category enum if provided
      if (updateData.category) {
        const validCategories = ["FOOD", "GROCERY", "PHARMACY"]
        if (!validCategories.includes(updateData.category)) {
          return res.status(400).json({
            success: false,
            message: "Invalid category. Must be one of: FOOD, GROCERY, PHARMACY",
          })
        }
      }

      const subcategory = await prisma.subcategory.update({
        where: { id: subcategoryId },
        data: updateData,
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      })

      res.json({
        success: true,
        message: "Subcategory updated successfully",
        data: subcategory,
      })
    } catch (error) {
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
      const subcategoryId = req.params.id
      const userId = req.user!.id

      // Check if user is super admin
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user || user.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only super admins can delete subcategories",
        })
      }

      // Check if subcategory has products
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

  // Get categories (enum values with subcategories)
  getCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const categories = ["FOOD", "GROCERY", "PHARMACY"]

      const categoriesWithSubcategories = await Promise.all(
        categories.map(async (category) => {
          const subcategories = await prisma.subcategory.findMany({
            where: { category: category as any },
            include: {
              _count: {
                select: {
                  products: true,
                },
              },
            },
            orderBy: { name: "asc" },
          })

          const storeCount = await prisma.store.count({
            where: {
              products: {
                some: {
                  category: category as any,
                },
              },
            },
          })

          return {
            name: category,
            subcategories,
            storeCount,
            subcategoryCount: subcategories.length,
          }
        }),
      )

      res.json({
        success: true,
        message: "Categories retrieved successfully",
        data: categoriesWithSubcategories,
      })
    } catch (error) {
      logger.error("Get categories error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve categories",
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

      // Handle multiple image uploads
      const images: string[] = []
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          const imageUrl = await this.fileUploadService.uploadImage(file, "products")
          images.push(imageUrl)
        }
      }

      if (images.length > 0) {
        productData.images = images
        productData.image = images[0] // Set first image as primary
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

  getProducts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storeId = req.params.id
      const { page = 1, limit = 20, search, category, subcategoryId, inStock } = req.query

      const products = await this.storeService.getProducts(storeId, {
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        category: category as string,
        subcategoryId: subcategoryId as string,
        inStock: inStock === "true",
      })

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

      // Handle multiple image uploads
      if (req.files && Array.isArray(req.files)) {
        const images: string[] = []
        for (const file of req.files) {
          const imageUrl = await this.fileUploadService.uploadImage(file, "products")
          images.push(imageUrl)
        }

        if (images.length > 0) {
          updateData.images = images
          updateData.image = images[0] // Set first image as primary
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

      // Send verification notification
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

      // Send rejection notification
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

      // Check store ownership
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

      // Check if user is store owner
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
}
