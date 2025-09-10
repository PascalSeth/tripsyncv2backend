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
            // User data (for new user creation)
            email: joi_1.default.string().email().optional(),
            phone: joi_1.default.string().optional(),
            password: joi_1.default.string().min(6).optional(),
            firstName: joi_1.default.string().optional(),
            lastName: joi_1.default.string().optional(),
            gender: joi_1.default.string().valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY").optional(),
            dateOfBirth: joi_1.default.date().optional(),
            // Store owner profile details
            businessLicense: joi_1.default.string().required(),
            taxId: joi_1.default.string().optional(),
            businessType: joi_1.default.string().required(),
            // Store details (optional)
            storeInfo: joi_1.default.object({
                name: joi_1.default.string().required(),
                type: joi_1.default.string().required(),
                latitude: joi_1.default.number().required(),
                longitude: joi_1.default.number().required(),
                address: joi_1.default.string().required(),
                city: joi_1.default.string().optional(),
                state: joi_1.default.string().optional(),
                country: joi_1.default.string().optional(),
                postalCode: joi_1.default.string().optional(),
                contactPhone: joi_1.default.string().required(),
                contactEmail: joi_1.default.string().email().optional(),
                description: joi_1.default.string().optional(),
                operatingHours: joi_1.default.string().optional(),
                businessHours: joi_1.default.array()
                    .items(joi_1.default.object({
                    dayOfWeek: joi_1.default.number().min(0).max(6).required(),
                    openTime: joi_1.default.string().required(),
                    closeTime: joi_1.default.string().required(),
                    isClosed: joi_1.default.boolean().optional(),
                }))
                    .optional(),
            }).optional(),
        }),
    }),
    updateStoreOwnerProfile: joi_1.default.object({
        body: joi_1.default.object({
            businessLicense: joi_1.default.string().optional(),
            taxId: joi_1.default.string().optional(),
            businessType: joi_1.default.string().optional(),
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
            country: joi_1.default.string().optional(),
            postalCode: joi_1.default.string().optional(),
            contactPhone: joi_1.default.string().required(),
            contactEmail: joi_1.default.string().email().optional(),
            description: joi_1.default.string().optional(),
            operatingHours: joi_1.default.string().optional(),
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
            country: joi_1.default.string().optional(),
            postalCode: joi_1.default.string().optional(),
            contactPhone: joi_1.default.string().optional(),
            contactEmail: joi_1.default.string().email().optional(),
            description: joi_1.default.string().optional(),
            operatingHours: joi_1.default.string().optional(),
            isActive: joi_1.default.boolean().optional(),
        }),
    }),
    createSubcategory: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().required(),
            description: joi_1.default.string().optional(),
            category: joi_1.default.string().valid("FOOD", "GROCERY", "PHARMACY").required(),
            imageUrl: joi_1.default.string().uri().optional(),
        }),
    }),
    updateSubcategory: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().optional(),
            description: joi_1.default.string().optional(),
            category: joi_1.default.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
            imageUrl: joi_1.default.string().uri().optional(),
        }),
    }),
    addProduct: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().required(),
            description: joi_1.default.string().optional(),
            price: joi_1.default.number().min(0).required(),
            category: joi_1.default.string().valid("FOOD", "GROCERY", "PHARMACY").required(),
            subcategoryId: joi_1.default.string().uuid().optional(),
            inStock: joi_1.default.boolean().optional(),
            stockQuantity: joi_1.default.number().min(0).optional(),
        }),
    }),
    updateProduct: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().optional(),
            description: joi_1.default.string().optional(),
            price: joi_1.default.number().min(0).optional(),
            category: joi_1.default.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
            subcategoryId: joi_1.default.string().uuid().optional(),
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
    bulkUpdateProducts: joi_1.default.object({
        body: joi_1.default.object({
            productIds: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).required(),
            updateData: joi_1.default.object({
                price: joi_1.default.number().min(0).optional(),
                category: joi_1.default.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
                subcategoryId: joi_1.default.string().uuid().optional(),
                inStock: joi_1.default.boolean().optional(),
                stockQuantity: joi_1.default.number().min(0).optional(),
            })
                .min(1)
                .required(),
        }),
    }),
    rejectStoreOwner: joi_1.default.object({
        body: joi_1.default.object({
            reason: joi_1.default.string().required(),
        }),
    }),
    // Query parameter validations
    getStores: joi_1.default.object({
        query: joi_1.default.object({
            page: joi_1.default.number().min(1).optional(),
            limit: joi_1.default.number().min(1).max(100).optional(),
            search: joi_1.default.string().optional(),
            type: joi_1.default.string().optional(),
            category: joi_1.default.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
            subcategoryId: joi_1.default.string().uuid().optional(),
            latitude: joi_1.default.number().optional(),
            longitude: joi_1.default.number().optional(),
            radius: joi_1.default.number().min(0).optional(),
            isActive: joi_1.default.boolean().optional(),
        }),
    }),
    getProducts: joi_1.default.object({
        query: joi_1.default.object({
            page: joi_1.default.number().min(1).optional(),
            limit: joi_1.default.number().min(1).max(100).optional(),
            search: joi_1.default.string().optional(),
            category: joi_1.default.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
            subcategoryId: joi_1.default.string().uuid().optional(),
            inStock: joi_1.default.boolean().optional(),
        }),
    }),
    getSubcategories: joi_1.default.object({
        query: joi_1.default.object({
            page: joi_1.default.number().min(1).optional(),
            limit: joi_1.default.number().min(1).max(100).optional(),
            search: joi_1.default.string().optional(),
            category: joi_1.default.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
        }),
    }),
    getStoreAnalytics: joi_1.default.object({
        query: joi_1.default.object({
            startDate: joi_1.default.date().iso().optional(),
            endDate: joi_1.default.date().iso().optional(),
        }),
    }),
    getLowStockProducts: joi_1.default.object({
        query: joi_1.default.object({
            threshold: joi_1.default.number().min(0).optional(),
        }),
    }),
};
