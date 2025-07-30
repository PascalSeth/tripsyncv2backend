import Joi from "joi"

export const authValidation = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().optional(),
    role: Joi.string().valid("USER", "DRIVER", "STORE_OWNER", "PLACE_OWNER").default("USER"),
    referralCode: Joi.string().optional(),
  }),

  // Removed verifyPhone as it was tied to Firebase phone verification.
  // A new non-Firebase phone verification mechanism would be needed if this functionality is still desired.

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  completeProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    gender: Joi.string().valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY").optional(),
    dateOfBirth: Joi.date().max("now").optional(),
    avatar: Joi.string().uri().optional(),
    phone: Joi.string().optional(), // Added phone as it's a core user attribute
    address: Joi.object({
      street: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      zipCode: Joi.string().optional(),
      country: Joi.string().optional(),
      latitude: Joi.number().optional(),
      longitude: Joi.number().optional(),
    }).optional(),
  }),

  getProfile: Joi.object({
    // No specific fields needed for getting profile, as it relies on authenticated user context
  }),

  checkPhone: Joi.object({
    phone: Joi.string().required(),
  }),

  refreshToken: Joi.object({
    // Assuming a custom refresh token mechanism, not Firebase token
    refreshToken: Joi.string().required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(), // Changed from oobCode to a generic token
    newPassword: Joi.string().min(6).required(),
  }),

  socialAuth: Joi.object({
    // Removed firebaseToken. This endpoint would require a new social authentication strategy
    // (e.g., direct OAuth integration with providers like Google/Facebook)
    provider: Joi.string().valid("GOOGLE", "FACEBOOK").required(),
    accessToken: Joi.string().required(), // Access token from the social provider
    role: Joi.string().valid("USER", "DRIVER", "STORE_OWNER", "PLACE_OWNER").default("USER"),
  }),
}
