import Joi from "joi"

export const placeValidation = {
  createPlace: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(1000).optional(),
    categoryId: Joi.string().uuid().required(),
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().max(200).required(),
    contactInfo: Joi.string().max(200).optional(),
    websiteUrl: Joi.string().uri().optional(),
    openingHours: Joi.string().max(500).optional(),
    priceLevel: Joi.string().valid("BUDGET", "MODERATE", "EXPENSIVE", "LUXURY").optional(),
    tags: Joi.string().max(200).optional(),
    imageUrl: Joi.string().uri().optional(),
  }),

  updatePlace: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().max(1000).optional(),
    categoryId: Joi.string().uuid().optional(),
    contactInfo: Joi.string().max(200).optional(),
    websiteUrl: Joi.string().uri().optional(),
    openingHours: Joi.string().max(500).optional(),
    priceLevel: Joi.string().valid("BUDGET", "MODERATE", "EXPENSIVE", "LUXURY").optional(),
    tags: Joi.string().max(200).optional(),
    imageUrl: Joi.string().uri().optional(),
  }),

  getPlaces: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    search: Joi.string().max(100).optional(),
    categoryId: Joi.string().uuid().optional(),
    priceLevel: Joi.string().valid("BUDGET", "MODERATE", "EXPENSIVE", "LUXURY").optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    radius: Joi.number().min(100).max(100000).default(10000),
    sortBy: Joi.string().valid("name", "rating", "newest", "oldest", "distance").default("name"),
  }),

  getPlacesByCategory: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    radius: Joi.number().min(100).max(100000).default(10000),
  }),

  getNearbyPlaces: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(100).max(50000).default(5000),
    limit: Joi.number().min(1).max(50).default(20),
    categoryId: Joi.string().uuid().optional(),
  }),

  anonymousVote: Joi.object({
    placeId: Joi.string().uuid().required(),
    username: Joi.string().min(2).max(50).required(),
    gender: Joi.string().valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY").required(),
    isLiked: Joi.boolean().required(),
    suggestedCategoryId: Joi.string().uuid().optional(),
  }),

  userVote: Joi.object({
    placeId: Joi.string().uuid().required(),
    isLiked: Joi.boolean().required(),
    suggestedCategoryId: Joi.string().uuid().optional(),
  }),

  uploadPhoto: Joi.object({
    caption: Joi.string().max(200).optional(),
  }),

  createCategory: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(200).optional(),
    icon: Joi.string().max(50).optional(),
    sortOrder: Joi.number().min(0).default(0),
  }),

  updateCategory: Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    description: Joi.string().max(200).optional(),
    icon: Joi.string().max(50).optional(),
    sortOrder: Joi.number().min(0).optional(),
    isActive: Joi.boolean().optional(),
  }),
}
