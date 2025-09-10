"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.orderValidation = {
    updateOrderStatus: joi_1.default.object({
        params: joi_1.default.object({
            orderId: joi_1.default.string().required()
        }),
        body: joi_1.default.object({
            status: joi_1.default.string()
                .valid("ORDER_PROCESSING", "ORDER_CONFIRMED", "WAITING_COURIER", "COURIER_PICKING_UP", "COURIER_ON_WAY", "COURIER_ARRIVED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "ORDER_REJECTED", "CANCELLED")
                .required(),
            notes: joi_1.default.string().max(500).optional()
        })
    }),
    getOrders: joi_1.default.object({
        query: joi_1.default.object({
            page: joi_1.default.number().integer().min(1).optional(),
            limit: joi_1.default.number().integer().min(1).max(100).optional(),
            status: joi_1.default.string()
                .valid("PENDING", "ORDER_PROCESSING", "ORDER_CONFIRMED", "WAITING_COURIER", "COURIER_PICKING_UP", "COURIER_ON_WAY", "COURIER_ARRIVED", "PREPARING", "READY_FOR_PICKUP", "PICKED_UP", "IN_TRANSIT", "DELIVERED", "ORDER_REJECTED", "CANCELLED", "REFUNDED")
                .optional(),
            startDate: joi_1.default.date().iso().optional(),
            endDate: joi_1.default.date().iso().optional()
        })
    })
};
