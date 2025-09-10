"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.placeValidation = {
    createPlace: joi_1.default.object({
        name: joi_1.default.string().min(2).max(100).required(),
        description: joi_1.default.string().max(1000).optional(),
        categoryId: joi_1.default.string().uuid().required(),
        latitude: joi_1.default.number().min(-90).max(90).required(),
        longitude: joi_1.default.number().min(-180).max(180).required(),
        address: joi_1.default.string().max(200).required(),
        contactInfo: joi_1.default.string().max(200).optional(),
        websiteUrl: joi_1.default.string().uri().optional(),
        openingHours: joi_1.default.string().max(500).optional(),
        priceLevel: joi_1.default.string().valid("BUDGET", "MODERATE", "EXPENSIVE", "LUXURY").optional(),
        tags: joi_1.default.string().max(200).optional(),
        imageUrl: joi_1.default.string().uri().optional(),
    }),
    updatePlace: joi_1.default.object({
        name: joi_1.default.string().min(2).max(100).optional(),
        description: joi_1.default.string().max(1000).optional(),
        categoryId: joi_1.default.string().uuid().optional(),
        contactInfo: joi_1.default.string().max(200).optional(),
        websiteUrl: joi_1.default.string().uri().optional(),
        openingHours: joi_1.default.string().max(500).optional(),
        priceLevel: joi_1.default.string().valid("BUDGET", "MODERATE", "EXPENSIVE", "LUXURY").optional(),
        tags: joi_1.default.string().max(200).optional(),
        imageUrl: joi_1.default.string().uri().optional(),
    }),
    getPlaces: joi_1.default.object({
        page: joi_1.default.number().min(1).default(1),
        limit: joi_1.default.number().min(1).max(100).default(20),
        search: joi_1.default.string().max(100).optional(),
        categoryId: joi_1.default.string().uuid().optional(),
        priceLevel: joi_1.default.string().valid("BUDGET", "MODERATE", "EXPENSIVE", "LUXURY").optional(),
        latitude: joi_1.default.number().min(-90).max(90).optional(),
        longitude: joi_1.default.number().min(-180).max(180).optional(),
        radius: joi_1.default.number().min(100).max(100000).default(10000),
        sortBy: joi_1.default.string().valid("name", "rating", "newest", "oldest", "distance").default("name"),
    }),
    getPlacesByCategory: joi_1.default.object({
        page: joi_1.default.number().min(1).default(1),
        limit: joi_1.default.number().min(1).max(100).default(20),
        latitude: joi_1.default.number().min(-90).max(90).optional(),
        longitude: joi_1.default.number().min(-180).max(180).optional(),
        radius: joi_1.default.number().min(100).max(100000).default(10000),
    }),
    getNearbyPlaces: joi_1.default.object({
        latitude: joi_1.default.number().min(-90).max(90).required(),
        longitude: joi_1.default.number().min(-180).max(180).required(),
        radius: joi_1.default.number().min(100).max(50000).default(5000),
        limit: joi_1.default.number().min(1).max(50).default(20),
        categoryId: joi_1.default.string().uuid().optional(),
    }),
    anonymousVote: joi_1.default.object({
        placeId: joi_1.default.string().uuid().required(),
        username: joi_1.default.string().min(2).max(50).required(),
        gender: joi_1.default.string().valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY").required(),
        isLiked: joi_1.default.boolean().required(),
        suggestedCategoryId: joi_1.default.string().uuid().optional(),
    }),
    userVote: joi_1.default.object({
        placeId: joi_1.default.string().uuid().required(),
        isLiked: joi_1.default.boolean().required(),
        suggestedCategoryId: joi_1.default.string().uuid().optional(),
    }),
    uploadPhoto: joi_1.default.object({
        caption: joi_1.default.string().max(200).optional(),
    }),
    createCategory: joi_1.default.object({
        name: joi_1.default.string().min(2).max(50).required(),
        description: joi_1.default.string().max(200).optional(),
        icon: joi_1.default.string().max(50).optional(),
        sortOrder: joi_1.default.number().min(0).default(0),
    }),
    updateCategory: joi_1.default.object({
        name: joi_1.default.string().min(2).max(50).optional(),
        description: joi_1.default.string().max(200).optional(),
        icon: joi_1.default.string().max(50).optional(),
        sortOrder: joi_1.default.number().min(0).optional(),
        isActive: joi_1.default.boolean().optional(),
    }),
};
