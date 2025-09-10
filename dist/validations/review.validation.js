"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.reviewValidation = {
    submitReview: joi_1.default.object({
        body: joi_1.default.object({
            receiverId: joi_1.default.string().optional(),
            bookingId: joi_1.default.string().optional(),
            businessId: joi_1.default.string().optional(),
            rating: joi_1.default.number().min(1).max(5).required(),
            comment: joi_1.default.string().optional(),
            serviceRating: joi_1.default.number().min(1).max(5).optional(),
            timelinessRating: joi_1.default.number().min(1).max(5).optional(),
            cleanlinessRating: joi_1.default.number().min(1).max(5).optional(),
            communicationRating: joi_1.default.number().min(1).max(5).optional(),
        }).custom((value, helpers) => {
            // At least one of receiverId, bookingId, or businessId must be provided
            if (!value.receiverId && !value.bookingId && !value.businessId) {
                return helpers.error("any.custom", {
                    message: "At least one of receiverId, bookingId, or businessId must be provided",
                });
            }
            return value;
        }),
    }),
    submitDriverRating: joi_1.default.object({
        body: joi_1.default.object({
            driverId: joi_1.default.string().required(),
            bookingId: joi_1.default.string().required(),
            rating: joi_1.default.number().min(1).max(5).required(),
            comment: joi_1.default.string().optional(),
            serviceRating: joi_1.default.number().min(1).max(5).optional(),
            timelinessRating: joi_1.default.number().min(1).max(5).optional(),
            cleanlinessRating: joi_1.default.number().min(1).max(5).optional(),
            communicationRating: joi_1.default.number().min(1).max(5).optional(),
        }),
    }),
    updateReview: joi_1.default.object({
        body: joi_1.default.object({
            rating: joi_1.default.number().min(1).max(5).optional(),
            comment: joi_1.default.string().optional(),
            serviceRating: joi_1.default.number().min(1).max(5).optional(),
            timelinessRating: joi_1.default.number().min(1).max(5).optional(),
            cleanlinessRating: joi_1.default.number().min(1).max(5).optional(),
            communicationRating: joi_1.default.number().min(1).max(5).optional(),
        }),
    }),
    reportReview: joi_1.default.object({
        body: joi_1.default.object({
            reason: joi_1.default.string()
                .valid("INAPPROPRIATE_CONTENT", "SPAM", "FAKE_REVIEW", "HARASSMENT", "OFFENSIVE_LANGUAGE", "OTHER")
                .required(),
            description: joi_1.default.string().required(),
        }),
    }),
    moderateReview: joi_1.default.object({
        body: joi_1.default.object({
            action: joi_1.default.string().valid("approve", "reject", "flag").required(),
            reason: joi_1.default.string().optional(),
        }),
    }),
};
