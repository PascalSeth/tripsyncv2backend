"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.authValidation = {
    register: joi_1.default.object({
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().min(6).required(),
        firstName: joi_1.default.string().min(2).max(50).required(),
        lastName: joi_1.default.string().min(2).max(50).required(),
        phone: joi_1.default.string().optional(),
        role: joi_1.default.string().valid("USER", "DRIVER", "STORE_OWNER", "PLACE_OWNER").default("USER"),
        referralCode: joi_1.default.string().optional(),
    }),
    // Removed verifyPhone as it was tied to Firebase phone verification.
    // A new non-Firebase phone verification mechanism would be needed if this functionality is still desired.
    login: joi_1.default.object({
        email: joi_1.default.string().email().required(),
        password: joi_1.default.string().required(),
    }),
    completeProfile: joi_1.default.object({
        firstName: joi_1.default.string().min(2).max(50).optional(),
        lastName: joi_1.default.string().min(2).max(50).optional(),
        email: joi_1.default.string().email().optional(),
        gender: joi_1.default.string().valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY").optional(),
        dateOfBirth: joi_1.default.date().max("now").optional(),
        avatar: joi_1.default.string().uri().optional(),
        phone: joi_1.default.string().optional(), // Added phone as it's a core user attribute
        address: joi_1.default.object({
            street: joi_1.default.string().optional(),
            city: joi_1.default.string().optional(),
            state: joi_1.default.string().optional(),
            zipCode: joi_1.default.string().optional(),
            country: joi_1.default.string().optional(),
            latitude: joi_1.default.number().optional(),
            longitude: joi_1.default.number().optional(),
        }).optional(),
    }),
    getProfile: joi_1.default.object({
    // No specific fields needed for getting profile, as it relies on authenticated user context
    }),
    checkPhone: joi_1.default.object({
        phone: joi_1.default.string().required(),
    }),
    refreshToken: joi_1.default.object({
        // Assuming a custom refresh token mechanism, not Firebase token
        refreshToken: joi_1.default.string().required(),
    }),
    forgotPassword: joi_1.default.object({
        email: joi_1.default.string().email().required(),
    }),
    resetPassword: joi_1.default.object({
        token: joi_1.default.string().required(), // Changed from oobCode to a generic token
        newPassword: joi_1.default.string().min(6).required(),
    }),
    socialAuth: joi_1.default.object({
        // Removed firebaseToken. This endpoint would require a new social authentication strategy
        // (e.g., direct OAuth integration with providers like Google/Facebook)
        provider: joi_1.default.string().valid("GOOGLE", "FACEBOOK").required(),
        accessToken: joi_1.default.string().required(), // Access token from the social provider
        role: joi_1.default.string().valid("USER", "DRIVER", "STORE_OWNER", "PLACE_OWNER").default("USER"),
    }),
};
