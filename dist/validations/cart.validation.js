"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.cartValidation = {
    addToCart: joi_1.default.object({
        body: joi_1.default.object({
            productId: joi_1.default.string().required(),
            quantity: joi_1.default.number().integer().min(1).required()
        })
    }),
    updateCartItem: joi_1.default.object({
        params: joi_1.default.object({
            itemId: joi_1.default.string().required()
        }),
        body: joi_1.default.object({
            quantity: joi_1.default.number().integer().min(0).required()
        })
    }),
    removeFromCart: joi_1.default.object({
        params: joi_1.default.object({
            itemId: joi_1.default.string().required()
        })
    }),
    checkoutFromCart: joi_1.default.object({
        body: joi_1.default.object({
            deliveryAddress: joi_1.default.object({
                latitude: joi_1.default.number().required(),
                longitude: joi_1.default.number().required(),
                address: joi_1.default.string().required(),
                city: joi_1.default.string().optional(),
                state: joi_1.default.string().optional(),
                instructions: joi_1.default.string().optional()
            }).required(),
            paymentMethodId: joi_1.default.string().required(),
            specialInstructions: joi_1.default.string().optional()
        })
    })
};
