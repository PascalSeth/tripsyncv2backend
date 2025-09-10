"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StoreController = void 0;
const database_1 = __importDefault(require("../config/database"));
const store_service_1 = require("../services/store.service");
const location_service_1 = require("../services/location.service");
const notification_service_1 = require("../services/notification.service");
const file_upload_service_1 = require("../services/file-upload.service");
const logger_1 = __importDefault(require("../utils/logger"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error("Only image files are allowed"));
        }
    },
});
class StoreController {
    constructor() {
        this.storeService = new store_service_1.StoreService();
        this.locationService = new location_service_1.LocationService();
        this.notificationService = new notification_service_1.NotificationService();
        this.fileUploadService = new file_upload_service_1.FileUploadService();
        // File upload middleware
        this.uploadProductImages = upload.array("images", 5); // Allow up to 5 images
        this.uploadStoreImage = upload.single("image");
        this.uploadCategoryImage = upload.single("image");
        this.uploadSubcategoryImage = upload.single("image");
        // Middleware to debug raw multipart data
        this.debugMultipart = (req, res, next) => {
            console.log("[v0] debugMultipart - Content-Type:", req.headers["content-type"]);
            console.log("[v0] debugMultipart - Content-Length:", req.headers["content-length"]);
            console.log("[v0] debugMultipart - Raw body type:", typeof req.body);
            console.log("[v0] debugMultipart - Raw body:", req.body);
            next();
        };
        this.onboardStoreOwner = async (req, res) => {
            try {
                const { businessLicense, businessType, taxId } = req.body;
                // Check if this is for an existing authenticated user
                let userId = req.user?.id;
                let user = null;
                if (!userId) {
                    // For new users, require basic user info
                    const { email, phone, firstName, lastName, password } = req.body;
                    if (!email || !phone || !firstName || !lastName) {
                        return res.status(400).json({
                            success: false,
                            message: "Email, phone, firstName, and lastName are required for new users",
                        });
                    }
                    // Check if user already exists
                    const existingUser = await database_1.default.user.findFirst({
                        where: { OR: [{ email }, { phone }] },
                    });
                    if (existingUser) {
                        const existingProfile = await database_1.default.storeOwnerProfile.findUnique({
                            where: { userId: existingUser.id },
                        });
                        if (existingProfile) {
                            return res.status(400).json({
                                success: false,
                                message: "User already has a store owner profile",
                            });
                        }
                        userId = existingUser.id;
                        user = existingUser;
                    }
                    else {
                        // Create new user
                        const referralCode = `SO${Date.now().toString().slice(-6)}`;
                        user = await database_1.default.user.create({
                            data: {
                                email,
                                phone,
                                firstName,
                                lastName,
                                passwordHash: password ? await bcrypt_1.default.hash(password, 12) : null,
                                role: "STORE_OWNER",
                                referralCode,
                                isActive: true,
                                subscriptionStatus: "ACTIVE",
                                subscriptionTier: "BASIC",
                                nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                commissionBalance: 0,
                                isCommissionCurrent: true,
                            },
                        });
                        userId = user.id;
                    }
                }
                else {
                    // Check if authenticated user already has store owner profile
                    const existingProfile = await database_1.default.storeOwnerProfile.findUnique({
                        where: { userId },
                    });
                    if (existingProfile) {
                        return res.status(400).json({
                            success: false,
                            message: "Store owner profile already exists",
                        });
                    }
                    // Update existing user role
                    user = await database_1.default.user.update({
                        where: { id: userId },
                        data: {
                            role: "STORE_OWNER",
                            subscriptionStatus: "ACTIVE",
                            subscriptionTier: "BASIC",
                            nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                            isCommissionCurrent: true,
                        },
                    });
                }
                // Create store owner profile
                const storeOwnerProfile = await database_1.default.storeOwnerProfile.create({
                    data: {
                        userId,
                        businessLicense,
                        taxId: taxId || null,
                        businessType,
                        verificationStatus: "PENDING",
                        monthlyCommissionDue: 0,
                        commissionStatus: "CURRENT",
                    },
                });
                // Create customer profile if it doesn't exist
                const existingCustomerProfile = await database_1.default.customerProfile.findUnique({
                    where: { userId },
                });
                if (!existingCustomerProfile) {
                    await database_1.default.customerProfile.create({
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
                    });
                }
                // Send notification
                await this.notificationService.notifyCustomer(userId, {
                    type: "STORE_OWNER_ONBOARDING",
                    title: "Store Owner Application Submitted",
                    body: "Your store owner application has been submitted for review.",
                    priority: "STANDARD",
                });
                // Get complete profile data
                const completeProfile = await database_1.default.storeOwnerProfile.findUnique({
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
                });
                res.status(201).json({
                    success: true,
                    message: "Store owner onboarding completed successfully",
                    data: completeProfile,
                });
            }
            catch (error) {
                logger_1.default.error("Store owner onboarding error:", error);
                res.status(500).json({
                    success: false,
                    message: "Store owner onboarding failed",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.createStore = async (req, res) => {
            try {
                const userId = req.user.id;
                const storeData = req.body;
                // Handle image upload if present
                if (req.file) {
                    const imageUrl = await this.fileUploadService.uploadImage(req.file, "stores");
                    storeData.image = imageUrl;
                }
                const storeOwnerProfile = await database_1.default.storeOwnerProfile.findUnique({
                    where: { userId },
                });
                if (!storeOwnerProfile || storeOwnerProfile.verificationStatus !== "APPROVED") {
                    return res.status(403).json({
                        success: false,
                        message: "Store owner profile not found or not verified",
                    });
                }
                const store = await this.storeService.createStore(storeOwnerProfile.id, storeData);
                res.status(201).json({
                    success: true,
                    message: "Store created successfully",
                    data: store,
                });
            }
            catch (error) {
                logger_1.default.error("Create store error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create store",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getStores = async (req, res) => {
            try {
                const { page = 1, limit = 20, search, type, category, subcategoryId, latitude, longitude, radius = 10000, isActive = true, } = req.query;
                const stores = await this.storeService.getStores({
                    page: Number(page),
                    limit: Number(limit),
                    search: search,
                    type: type,
                    categoryId: category, // This will be the category ID from the Category model
                    subcategoryId: subcategoryId,
                    latitude: latitude ? Number(latitude) : undefined,
                    longitude: longitude ? Number(longitude) : undefined,
                    radius: Number(radius),
                    isActive: isActive === "true",
                });
                res.json({
                    success: true,
                    message: "Stores retrieved successfully",
                    data: stores,
                });
            }
            catch (error) {
                logger_1.default.error("Get stores error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve stores",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getStoreById = async (req, res) => {
            try {
                const storeId = req.params.id;
                const store = await this.storeService.getStoreById(storeId);
                if (!store) {
                    return res.status(404).json({
                        success: false,
                        message: "Store not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Store retrieved successfully",
                    data: store,
                });
            }
            catch (error) {
                logger_1.default.error("Get store by ID error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve store",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateStore = async (req, res) => {
            try {
                const storeId = req.params.id;
                const userId = req.user.id;
                const updateData = req.body;
                // Handle image upload if present
                if (req.file) {
                    const imageUrl = await this.fileUploadService.uploadImage(req.file, "stores");
                    updateData.image = imageUrl;
                }
                const store = await this.storeService.updateStore(storeId, updateData, userId);
                res.json({
                    success: true,
                    message: "Store updated successfully",
                    data: store,
                });
            }
            catch (error) {
                logger_1.default.error("Update store error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update store",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.deleteStore = async (req, res) => {
            try {
                const storeId = req.params.id;
                const userId = req.user.id;
                await this.storeService.deleteStore(storeId, userId);
                res.json({
                    success: true,
                    message: "Store deleted successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Delete store error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to delete store",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Subcategory Management (Super Admin only)
        this.createSubcategory = async (req, res) => {
            try {
                console.log("[v0] createSubcategory - req.body:", req.body);
                console.log("[v0] createSubcategory - req.file:", req.file);
                const name = req.body.name;
                const description = req.body.description;
                const categoryId = req.body.categoryId;
                const imageFile = req.file;
                const userId = req.user.id;
                console.log("[v0] createSubcategory - extracted name:", name);
                console.log("[v0] createSubcategory - extracted description:", description);
                console.log("[v0] createSubcategory - extracted categoryId:", categoryId);
                if (!name) {
                    console.log("[v0] createSubcategory - name validation failed");
                    return res.status(400).json({
                        success: false,
                        message: "Subcategory name is required",
                    });
                }
                if (!categoryId) {
                    console.log("[v0] createSubcategory - categoryId validation failed");
                    return res.status(400).json({
                        success: false,
                        message: "Category ID is required",
                    });
                }
                const user = await database_1.default.user.findUnique({
                    where: { id: userId },
                });
                if (!user || user.role !== "SUPER_ADMIN") {
                    return res.status(403).json({
                        success: false,
                        message: "Only super admins can create subcategories",
                    });
                }
                const category = await database_1.default.category.findUnique({
                    where: { id: categoryId },
                });
                if (!category) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid category ID. Category does not exist.",
                    });
                }
                const existingSubcategory = await database_1.default.subcategory.findFirst({
                    where: {
                        name: name.trim(),
                        categoryId: categoryId,
                    },
                });
                if (existingSubcategory) {
                    return res.status(400).json({
                        success: false,
                        message: "Subcategory with this name already exists in this category",
                    });
                }
                let imageUrl = null;
                if (imageFile) {
                    imageUrl = await this.fileUploadService.uploadImage(imageFile, "subcategories");
                }
                const subcategory = await database_1.default.subcategory.create({
                    data: {
                        name: name.trim(),
                        description: description?.trim() || null,
                        imageUrl,
                        categoryId,
                    },
                    include: {
                        category: true,
                    },
                });
                res.status(201).json({
                    success: true,
                    message: "Subcategory created successfully",
                    data: subcategory,
                });
            }
            catch (error) {
                console.log("[v0] createSubcategory - error occurred:", error);
                logger_1.default.error("Create subcategory error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create subcategory",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getSubcategories = async (req, res) => {
            try {
                const { page = 1, limit = 50, search, category } = req.query;
                const where = {};
                if (category)
                    where.category = category;
                if (search) {
                    where.OR = [
                        { name: { contains: search, mode: "insensitive" } },
                        { description: { contains: search, mode: "insensitive" } },
                    ];
                }
                const [subcategories, total] = await Promise.all([
                    database_1.default.subcategory.findMany({
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
                    database_1.default.subcategory.count({ where }),
                ]);
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
                });
            }
            catch (error) {
                logger_1.default.error("Get subcategories error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve subcategories",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateSubcategory = async (req, res) => {
            try {
                const { subcategoryId } = req.params;
                const name = req.body.name;
                const description = req.body.description;
                const categoryId = req.body.categoryId;
                const imageFile = req.file;
                const userId = req.user.id;
                console.log("[v0] updateSubcategory - req.body:", req.body);
                console.log("[v0] updateSubcategory - req.file:", req.file);
                const user = await database_1.default.user.findUnique({
                    where: { id: userId },
                });
                if (!user || user.role !== "SUPER_ADMIN") {
                    return res.status(403).json({
                        success: false,
                        message: "Only super admins can update subcategories",
                    });
                }
                if (categoryId) {
                    const category = await database_1.default.category.findUnique({
                        where: { id: categoryId },
                    });
                    if (!category) {
                        return res.status(400).json({
                            success: false,
                            message: "Invalid category ID. Category does not exist.",
                        });
                    }
                }
                const updateData = {};
                if (name)
                    updateData.name = name.trim();
                if (description !== undefined)
                    updateData.description = description?.trim() || null;
                if (categoryId)
                    updateData.categoryId = categoryId;
                if (imageFile) {
                    updateData.imageUrl = await this.fileUploadService.uploadImage(imageFile, "subcategories");
                }
                const updatedSubcategory = await database_1.default.subcategory.update({
                    where: { id: subcategoryId },
                    data: updateData,
                    include: {
                        category: true,
                    },
                });
                res.json({
                    success: true,
                    message: "Subcategory updated successfully",
                    data: updatedSubcategory,
                });
            }
            catch (error) {
                console.log("[v0] updateSubcategory - error occurred:", error);
                logger_1.default.error("Update subcategory error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update subcategory",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.deleteSubcategory = async (req, res) => {
            try {
                const subcategoryId = req.params.id;
                const userId = req.user.id;
                const user = await database_1.default.user.findUnique({
                    where: { id: userId },
                });
                if (!user || user.role !== "SUPER_ADMIN") {
                    return res.status(403).json({
                        success: false,
                        message: "Only super admins can delete subcategories",
                    });
                }
                const subcategory = await database_1.default.subcategory.findUnique({
                    where: { id: subcategoryId },
                    include: {
                        _count: {
                            select: {
                                products: true,
                            },
                        },
                    },
                });
                if (!subcategory) {
                    return res.status(404).json({
                        success: false,
                        message: "Subcategory not found",
                    });
                }
                if (subcategory._count.products > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot delete subcategory with existing products",
                    });
                }
                await database_1.default.subcategory.delete({
                    where: { id: subcategoryId },
                });
                res.json({
                    success: true,
                    message: "Subcategory deleted successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Delete subcategory error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to delete subcategory",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Get categories
        this.getCategories = async (req, res) => {
            try {
                const categories = await database_1.default.category.findMany({
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
                });
                const categoriesWithStoreCounts = await Promise.all(categories.map(async (category) => {
                    const storeCount = await database_1.default.store.count({
                        where: {
                            products: {
                                some: {
                                    categoryId: category.id,
                                },
                            },
                        },
                    });
                    return {
                        ...category,
                        storeCount,
                    };
                }));
                res.json({
                    success: true,
                    data: categoriesWithStoreCounts,
                });
            }
            catch (error) {
                logger_1.default.error("Get categories error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to get categories",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Product Management
        this.addProduct = async (req, res) => {
            try {
                const storeId = req.params.id;
                const userId = req.user.id;
                const productData = req.body;
                const images = [];
                if (req.files && Array.isArray(req.files)) {
                    for (const file of req.files) {
                        const imageUrl = await this.fileUploadService.uploadImage(file, "products");
                        images.push(imageUrl);
                    }
                }
                if (images.length > 0) {
                    productData.images = images;
                    productData.image = images[0];
                }
                const product = await this.storeService.addProduct(storeId, productData, userId);
                res.status(201).json({
                    success: true,
                    message: "Product added successfully",
                    data: product,
                });
            }
            catch (error) {
                logger_1.default.error("Add product error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to add product",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getProducts = async (req, res) => {
            try {
                const storeId = req.params.id;
                const { page = 1, limit = 20, search, category, subcategoryId, inStock } = req.query;
                const products = await this.storeService.getProducts(storeId, {
                    page: Number(page),
                    limit: Number(limit),
                    search: search,
                    categoryId: category,
                    subcategoryId: subcategoryId,
                    inStock: inStock === "true",
                });
                res.json({
                    success: true,
                    message: "Products retrieved successfully",
                    data: products,
                });
            }
            catch (error) {
                logger_1.default.error("Get products error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve products",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateProduct = async (req, res) => {
            try {
                const productId = req.params.productId;
                const userId = req.user.id;
                const updateData = req.body;
                if (req.files && Array.isArray(req.files)) {
                    const images = [];
                    for (const file of req.files) {
                        const imageUrl = await this.fileUploadService.uploadImage(file, "products");
                        images.push(imageUrl);
                    }
                    if (images.length > 0) {
                        updateData.images = images;
                        updateData.image = images[0];
                    }
                }
                const product = await this.storeService.updateProduct(productId, updateData, userId);
                res.json({
                    success: true,
                    message: "Product updated successfully",
                    data: product,
                });
            }
            catch (error) {
                logger_1.default.error("Update product error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update product",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.deleteProduct = async (req, res) => {
            try {
                const productId = req.params.productId;
                const userId = req.user.id;
                await this.storeService.deleteProduct(productId, userId);
                res.json({
                    success: true,
                    message: "Product deleted successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Delete product error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to delete product",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Business Hours Management
        this.updateBusinessHours = async (req, res) => {
            try {
                const storeId = req.params.id;
                const userId = req.user.id;
                const { businessHours } = req.body;
                const updatedHours = await this.storeService.updateBusinessHours(storeId, businessHours, userId);
                res.json({
                    success: true,
                    message: "Business hours updated successfully",
                    data: updatedHours,
                });
            }
            catch (error) {
                logger_1.default.error("Update business hours error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update business hours",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getBusinessHours = async (req, res) => {
            try {
                const storeId = req.params.id;
                const businessHours = await database_1.default.businessHours.findMany({
                    where: { storeId },
                    orderBy: { dayOfWeek: "asc" },
                });
                res.json({
                    success: true,
                    message: "Business hours retrieved successfully",
                    data: businessHours,
                });
            }
            catch (error) {
                logger_1.default.error("Get business hours error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve business hours",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Store Analytics
        this.getStoreAnalytics = async (req, res) => {
            try {
                const storeId = req.params.id;
                const userId = req.user.id;
                const { startDate, endDate } = req.query;
                const analytics = await this.storeService.getStoreAnalytics(storeId, {
                    startDate: startDate,
                    endDate: endDate,
                    userId,
                });
                res.json({
                    success: true,
                    message: "Store analytics retrieved successfully",
                    data: analytics,
                });
            }
            catch (error) {
                logger_1.default.error("Get store analytics error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve store analytics",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Inventory Management
        this.updateInventory = async (req, res) => {
            try {
                const productId = req.params.productId;
                const userId = req.user.id;
                const { stockQuantity, operation } = req.body;
                const product = await this.storeService.updateInventory(productId, {
                    stockQuantity,
                    operation,
                    userId,
                });
                res.json({
                    success: true,
                    message: "Inventory updated successfully",
                    data: product,
                });
            }
            catch (error) {
                logger_1.default.error("Update inventory error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update inventory",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getLowStockProducts = async (req, res) => {
            try {
                const storeId = req.params.id;
                const userId = req.user.id;
                const { threshold = 10 } = req.query;
                const products = await this.storeService.getLowStockProducts(storeId, {
                    threshold: Number(threshold),
                    userId,
                });
                res.json({
                    success: true,
                    message: "Low stock products retrieved successfully",
                    data: products,
                });
            }
            catch (error) {
                logger_1.default.error("Get low stock products error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve low stock products",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Store Owner Profile Management
        this.getStoreOwnerProfile = async (req, res) => {
            try {
                const userId = req.user.id;
                const profile = await database_1.default.storeOwnerProfile.findUnique({
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
                });
                if (!profile) {
                    return res.status(404).json({
                        success: false,
                        message: "Store owner profile not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Store owner profile retrieved successfully",
                    data: profile,
                });
            }
            catch (error) {
                logger_1.default.error("Get store owner profile error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve store owner profile",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateStoreOwnerProfile = async (req, res) => {
            try {
                const userId = req.user.id;
                const updateData = req.body;
                const profile = await database_1.default.storeOwnerProfile.updateMany({
                    where: { userId },
                    data: updateData,
                });
                if (profile.count === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Store owner profile not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Store owner profile updated successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Update store owner profile error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update store owner profile",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Admin functions
        this.getAllStoreOwners = async (req, res) => {
            try {
                const { page = 1, limit = 20, verificationStatus, businessType } = req.query;
                const where = {};
                if (verificationStatus)
                    where.verificationStatus = verificationStatus;
                if (businessType)
                    where.businessType = businessType;
                const storeOwners = await database_1.default.storeOwnerProfile.findMany({
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
                });
                const total = await database_1.default.storeOwnerProfile.count({ where });
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
                });
            }
            catch (error) {
                logger_1.default.error("Get all store owners error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve store owners",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.verifyStoreOwner = async (req, res) => {
            try {
                const storeOwnerId = req.params.id;
                const storeOwner = await database_1.default.storeOwnerProfile.update({
                    where: { id: storeOwnerId },
                    data: {
                        verificationStatus: "APPROVED",
                        verifiedAt: new Date(),
                    },
                    include: { user: true },
                });
                await this.notificationService.notifyCustomer(storeOwner.userId, {
                    type: "STORE_OWNER_VERIFIED",
                    title: "Store Owner Verified",
                    body: "Your store owner application has been approved. You can now create stores.",
                    priority: "STANDARD",
                });
                res.json({
                    success: true,
                    message: "Store owner verified successfully",
                    data: storeOwner,
                });
            }
            catch (error) {
                logger_1.default.error("Verify store owner error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to verify store owner",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.rejectStoreOwner = async (req, res) => {
            try {
                const storeOwnerId = req.params.id;
                const { reason } = req.body;
                const storeOwner = await database_1.default.storeOwnerProfile.update({
                    where: { id: storeOwnerId },
                    data: { verificationStatus: "REJECTED" },
                    include: { user: true },
                });
                await this.notificationService.notifyCustomer(storeOwner.userId, {
                    type: "STORE_OWNER_REJECTED",
                    title: "Store Owner Application Rejected",
                    body: `Your store owner application has been rejected. Reason: ${reason}`,
                    priority: "STANDARD",
                });
                res.json({
                    success: true,
                    message: "Store owner rejected successfully",
                    data: storeOwner,
                });
            }
            catch (error) {
                logger_1.default.error("Reject store owner error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to reject store owner",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Bulk operations
        this.bulkUpdateProducts = async (req, res) => {
            try {
                const storeId = req.params.id;
                const userId = req.user.id;
                const { productIds, updateData } = req.body;
                const store = await database_1.default.store.findUnique({
                    where: { id: storeId },
                    include: { owner: true },
                });
                if (!store) {
                    return res.status(404).json({
                        success: false,
                        message: "Store not found",
                    });
                }
                if (store.owner.userId !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: "Unauthorized to update products in this store",
                    });
                }
                const updatedProducts = await database_1.default.product.updateMany({
                    where: {
                        id: { in: productIds },
                        storeId,
                    },
                    data: updateData,
                });
                res.json({
                    success: true,
                    message: `${updatedProducts.count} products updated successfully`,
                    data: { updatedCount: updatedProducts.count },
                });
            }
            catch (error) {
                logger_1.default.error("Bulk update products error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to bulk update products",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Store statistics
        this.getStoreStatistics = async (req, res) => {
            try {
                const userId = req.user.id;
                const storeOwnerProfile = await database_1.default.storeOwnerProfile.findUnique({
                    where: { userId },
                });
                if (!storeOwnerProfile) {
                    return res.status(403).json({
                        success: false,
                        message: "Store owner profile not found",
                    });
                }
                const [totalStores, activeStores, totalProducts, lowStockProducts] = await Promise.all([
                    database_1.default.store.count({
                        where: { ownerId: storeOwnerProfile.id },
                    }),
                    database_1.default.store.count({
                        where: { ownerId: storeOwnerProfile.id, isActive: true },
                    }),
                    database_1.default.product.count({
                        where: {
                            store: { ownerId: storeOwnerProfile.id },
                        },
                    }),
                    database_1.default.product.count({
                        where: {
                            store: { ownerId: storeOwnerProfile.id },
                            stockQuantity: { lt: 10 },
                            inStock: true,
                        },
                    }),
                ]);
                res.json({
                    success: true,
                    message: "Store statistics retrieved successfully",
                    data: {
                        totalStores,
                        activeStores,
                        totalProducts,
                        lowStockProducts,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Get store statistics error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve store statistics",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Category Management (Super Admin only)
        this.createCategory = async (req, res) => {
            try {
                console.log("[v0] createCategory - req.body:", req.body);
                console.log("[v0] createCategory - req.body keys:", Object.keys(req.body));
                console.log("[v0] createCategory - req.file:", req.file);
                console.log("[v0] createCategory - req.query:", req.query);
                console.log("[v0] createCategory - req.params:", req.params);
                const name = req.body.name;
                const description = req.body.description;
                const imageFile = req.file;
                console.log("[v0] createCategory - extracted name:", name);
                console.log("[v0] createCategory - extracted description:", description);
                const userId = req.user.id;
                console.log("[v0] createCategory - userId:", userId);
                if (!name) {
                    console.log("[v0] createCategory - name validation failed");
                    res.status(400).json({
                        success: false,
                        message: "Category name is required",
                    });
                    return;
                }
                const user = await database_1.default.user.findUnique({
                    where: { id: userId },
                });
                if (!user || user.role !== "SUPER_ADMIN") {
                    res.status(403).json({
                        success: false,
                        message: "Only super admins can create categories",
                    });
                    return;
                }
                const existingCategory = await database_1.default.category.findUnique({
                    where: { name: name.trim() },
                });
                if (existingCategory) {
                    res.status(400).json({
                        success: false,
                        message: "Category with this name already exists",
                    });
                    return;
                }
                let imageUrl = null;
                if (imageFile) {
                    imageUrl = await this.fileUploadService.uploadImage(imageFile, "categories");
                }
                const category = await database_1.default.category.create({
                    data: {
                        name: name.trim(),
                        description: description?.trim() || null,
                        imageUrl,
                    },
                });
                res.status(201).json({
                    success: true,
                    message: "Category created successfully",
                    data: category,
                });
            }
            catch (error) {
                console.log("[v0] createCategory - error occurred:", error);
                logger_1.default.error("Create category error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create category",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateCategory = async (req, res) => {
            try {
                const { id } = req.params;
                const { name, description } = req.body;
                const userId = req.user.id;
                const user = await database_1.default.user.findUnique({
                    where: { id: userId },
                });
                if (!user || user.role !== "SUPER_ADMIN") {
                    return res.status(403).json({
                        success: false,
                        message: "Only super admins can update categories",
                    });
                }
                const existingCategory = await database_1.default.category.findUnique({
                    where: { id },
                });
                if (!existingCategory) {
                    return res.status(404).json({
                        success: false,
                        message: "Category not found",
                    });
                }
                const updateData = { name, description };
                if (req.file) {
                    updateData.imageUrl = await this.fileUploadService.uploadImage(req.file, "categories");
                }
                const category = await database_1.default.category.update({
                    where: { id },
                    data: updateData,
                });
                res.json({
                    success: true,
                    message: "Category updated successfully",
                    data: category,
                });
            }
            catch (error) {
                logger_1.default.error("Update category error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update category",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.deleteCategory = async (req, res) => {
            try {
                const categoryId = req.params.id;
                const userId = req.user.id;
                const user = await database_1.default.user.findUnique({
                    where: { id: userId },
                });
                if (!user || user.role !== "SUPER_ADMIN") {
                    return res.status(403).json({
                        success: false,
                        message: "Only super admins can delete categories",
                    });
                }
                const category = await database_1.default.category.findUnique({
                    where: { id: categoryId },
                    include: {
                        _count: {
                            select: {
                                products: true,
                                subcategories: true,
                            },
                        },
                    },
                });
                if (!category) {
                    return res.status(404).json({
                        success: false,
                        message: "Category not found",
                    });
                }
                if (category._count.products > 0 || category._count.subcategories > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot delete category with existing products or subcategories",
                    });
                }
                await database_1.default.category.delete({
                    where: { id: categoryId },
                });
                res.json({
                    success: true,
                    message: "Category deleted successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Delete category error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to delete category",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
}
exports.StoreController = StoreController;
