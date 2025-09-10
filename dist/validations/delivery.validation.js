"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryStatisticsSchema = exports.deliveryTrackingSchema = exports.userToUserDeliverySchema = exports.storePurchaseDeliverySchema = exports.storePurchaseDeliveryEstimateSchema = void 0;
const joi_1 = __importDefault(require("joi"));
// Store purchase delivery estimate validation
exports.storePurchaseDeliveryEstimateSchema = joi_1.default.object({
    storeId: joi_1.default.string().required(),
    customerLatitude: joi_1.default.number().min(-90).max(90).required(),
    customerLongitude: joi_1.default.number().min(-180).max(180).required(),
    items: joi_1.default.array()
        .items(joi_1.default.object({
        productId: joi_1.default.string().required(),
        quantity: joi_1.default.number().integer().min(1).required()
    }))
        .min(1)
        .required()
});
// Store purchase delivery request validation
exports.storePurchaseDeliverySchema = joi_1.default.object({
    storeId: joi_1.default.string().required(),
    items: joi_1.default.array()
        .items(joi_1.default.object({
        productId: joi_1.default.string().required(),
        quantity: joi_1.default.number().integer().min(1).required(),
        unitPrice: joi_1.default.number().min(0).required(),
        name: joi_1.default.string().required()
    }))
        .min(1)
        .required(),
    deliveryAddress: joi_1.default.object({
        latitude: joi_1.default.number().min(-90).max(90).required(),
        longitude: joi_1.default.number().min(-180).max(180).required(),
        address: joi_1.default.string().required(),
        instructions: joi_1.default.string().optional()
    }).required(),
    specialInstructions: joi_1.default.string().optional(),
    recipientName: joi_1.default.string().optional(),
    recipientPhone: joi_1.default.string().optional(),
    paymentMethodId: joi_1.default.string().optional()
});
// User-to-user delivery request validation
exports.userToUserDeliverySchema = joi_1.default.object({
    recipientId: joi_1.default.string().required(),
    items: joi_1.default.array()
        .items(joi_1.default.object({
        name: joi_1.default.string().required(),
        description: joi_1.default.string().optional(),
        quantity: joi_1.default.number().integer().min(1).required(),
        value: joi_1.default.number().min(0).optional()
    }))
        .min(1)
        .required(),
    pickupAddress: joi_1.default.object({
        latitude: joi_1.default.number().min(-90).max(90).required(),
        longitude: joi_1.default.number().min(-180).max(180).required(),
        address: joi_1.default.string().required(),
        instructions: joi_1.default.string().optional()
    }).required(),
    deliveryAddress: joi_1.default.object({
        latitude: joi_1.default.number().min(-90).max(90).required(),
        longitude: joi_1.default.number().min(-180).max(180).required(),
        address: joi_1.default.string().required(),
        instructions: joi_1.default.string().optional()
    }).required(),
    specialInstructions: joi_1.default.string().optional(),
    recipientName: joi_1.default.string().required(),
    recipientPhone: joi_1.default.string().required(),
    paymentMethodId: joi_1.default.string().optional()
});
// Delivery tracking validation
exports.deliveryTrackingSchema = joi_1.default.object({
    trackingCode: joi_1.default.string().required()
});
// Delivery statistics validation
exports.deliveryStatisticsSchema = joi_1.default.object({
    startDate: joi_1.default.string().optional(),
    endDate: joi_1.default.string().optional(),
    storeId: joi_1.default.string().optional()
});
