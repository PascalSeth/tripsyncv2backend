"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.storeValidation = {
    onboardStoreOwner: joi_1.default.object({
        body: joi_1.default.object({
            // Required for all onboarding
            businessLicense: joi_1.default.string().required(),
            businessType: joi_1.default.string()
                .valid("GROCERY", "RESTAURANT", "PHARMACY", "ELECTRONICS", "CLOTHING", "BOOKS", "HARDWARE", "OTHER")
                .required(),
            // Optional business details
            taxId: joi_1.default.string().optional(),
            // Required only for new users (not authenticated)
            email: joi_1.default.string().email().optional(),
            phone: joi_1.default.string().optional(),
            firstName: joi_1.default.string().optional(),
            lastName: joi_1.default.string().optional(),
            password: joi_1.default.string().min(6).optional(),
        }),
    }),
    updateStoreOwnerProfile: joi_1.default.object({
        body: joi_1.default.object({
            businessLicense: joi_1.default.string().optional(),
            taxId: joi_1.default.string().optional(),
            businessType: joi_1.default.string()
                .valid("GROCERY", "RESTAURANT", "PHARMACY", "ELECTRONICS", "CLOTHING", "BOOKS", "HARDWARE", "OTHER")
                .optional(),
        }),
    }),
    createStore: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().required(),
            type: joi_1.default.string().required(),
            latitude: joi_1.default.number().required(),
            longitude: joi_1.default.number().required(),
            address: joi_1.default.string().required(),
            city: joi_1.default.string().optional(),
            state: joi_1.default.string().optional(),
            zipCode: joi_1.default.string().optional(),
            phone: joi_1.default.string().optional(),
            email: joi_1.default.string().email().optional(),
            description: joi_1.default.string().optional(),
            image: joi_1.default.string().optional(),
            businessHours: joi_1.default.array()
                .items(joi_1.default.object({
                dayOfWeek: joi_1.default.number().min(0).max(6).required(),
                openTime: joi_1.default.string().required(),
                closeTime: joi_1.default.string().required(),
                isClosed: joi_1.default.boolean().optional(),
            }))
                .optional(),
        }),
    }),
    updateStore: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().optional(),
            type: joi_1.default.string().optional(),
            latitude: joi_1.default.number().optional(),
            longitude: joi_1.default.number().optional(),
            address: joi_1.default.string().optional(),
            city: joi_1.default.string().optional(),
            state: joi_1.default.string().optional(),
            zipCode: joi_1.default.string().optional(),
            phone: joi_1.default.string().optional(),
            email: joi_1.default.string().email().optional(),
            description: joi_1.default.string().optional(),
            image: joi_1.default.string().optional(),
            isActive: joi_1.default.boolean().optional(),
        }),
    }),
    addProduct: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().required(),
            description: joi_1.default.string().optional(),
            price: joi_1.default.number().min(0).required(),
            categoryId: joi_1.default.string().required(), // Changed from category to categoryId to reference Category model
            subcategoryId: joi_1.default.string().optional(), // Added subcategoryId validation
            image: joi_1.default.string().optional(),
            inStock: joi_1.default.boolean().optional(),
            stockQuantity: joi_1.default.number().min(0).optional(),
        }),
    }),
    updateProduct: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().optional(),
            description: joi_1.default.string().optional(),
            price: joi_1.default.number().min(0).optional(),
            categoryId: joi_1.default.string().optional(), // Changed from category to categoryId to reference Category model
            subcategoryId: joi_1.default.string().optional(), // Added subcategoryId validation
            image: joi_1.default.string().optional(),
            inStock: joi_1.default.boolean().optional(),
            stockQuantity: joi_1.default.number().min(0).optional(),
        }),
    }),
    updateBusinessHours: joi_1.default.object({
        body: joi_1.default.object({
            businessHours: joi_1.default.array()
                .items(joi_1.default.object({
                dayOfWeek: joi_1.default.number().min(0).max(6).required(),
                openTime: joi_1.default.string().required(),
                closeTime: joi_1.default.string().required(),
                isClosed: joi_1.default.boolean().optional(),
            }))
                .required(),
        }),
    }),
    updateInventory: joi_1.default.object({
        body: joi_1.default.object({
            stockQuantity: joi_1.default.number().min(0).required(),
            operation: joi_1.default.string().valid("set", "add", "subtract").required(),
        }),
    }),
    rejectStoreOwner: joi_1.default.object({
        body: joi_1.default.object({
            reason: joi_1.default.string().required(),
        }),
    }),
    createCategory: joi_1.default.object({
        name: joi_1.default.string().required(),
        description: joi_1.default.string().optional(),
    }),
    updateCategory: joi_1.default.object({
        name: joi_1.default.string().optional(),
        description: joi_1.default.string().optional(),
    }),
    createSubcategory: joi_1.default.object({
        name: joi_1.default.string().required(),
        description: joi_1.default.string().optional(),
        categoryId: joi_1.default.string().required(),
        imageUrl: joi_1.default.string().optional(), // Added imageUrl validation for subcategories
    }),
    updateSubcategory: joi_1.default.object({
        name: joi_1.default.string().optional(),
        description: joi_1.default.string().optional(),
        categoryId: joi_1.default.string().optional(),
        imageUrl: joi_1.default.string().optional(), // Added imageUrl validation for subcategory updates
    }),
};
