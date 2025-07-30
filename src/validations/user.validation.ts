import Joi from "joi"

export const userValidation = {
  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    gender: Joi.string().valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY").optional(),
    dateOfBirth: Joi.date().max("now").optional(),
    avatar: Joi.string().uri().optional(),
    phone: Joi.string().optional(),
  }),

  updateEmail: Joi.object({
    newEmail: Joi.string().email().required(),
    currentPassword: Joi.string().required(),
  }),

  updatePhoneNumber: Joi.object({
    newPhone: Joi.string().required(),
    currentPassword: Joi.string().required(),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
  }),

  verifyTwoFactorAuthSetup: Joi.object({
    token: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required(),
  }),

  disableTwoFactorAuth: Joi.object({
    token: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required(),
  }),
}
