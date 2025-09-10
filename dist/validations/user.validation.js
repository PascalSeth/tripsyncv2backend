"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.userValidation = {
    updateProfile: joi_1.default.object({
        firstName: joi_1.default.string().min(2).max(50).optional(),
        lastName: joi_1.default.string().min(2).max(50).optional(),
        gender: joi_1.default.string().valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY").optional(),
        dateOfBirth: joi_1.default.date().max("now").optional(),
        avatar: joi_1.default.string().uri().optional(),
        phone: joi_1.default.string().optional(),
    }),
    updateEmail: joi_1.default.object({
        newEmail: joi_1.default.string().email().required(),
        currentPassword: joi_1.default.string().required(),
    }),
    updatePhoneNumber: joi_1.default.object({
        newPhone: joi_1.default.string().required(),
        currentPassword: joi_1.default.string().required(),
    }),
    changePassword: joi_1.default.object({
        currentPassword: joi_1.default.string().required(),
        newPassword: joi_1.default.string().min(6).required(),
    }),
    verifyTwoFactorAuthSetup: joi_1.default.object({
        token: joi_1.default.string()
            .length(6)
            .pattern(/^[0-9]+$/)
            .required(),
    }),
    disableTwoFactorAuth: joi_1.default.object({
        token: joi_1.default.string()
            .length(6)
            .pattern(/^[0-9]+$/)
            .required(),
    }),
};
