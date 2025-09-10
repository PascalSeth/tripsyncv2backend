import Joi from "joi"

export const reviewValidation = {
  submitReview: Joi.object({
    body: Joi.object({
      receiverId: Joi.string().optional(),
      bookingId: Joi.string().optional(),
      businessId: Joi.string().optional(),
      rating: Joi.number().min(1).max(5).required(),
      comment: Joi.string().optional(),
      serviceRating: Joi.number().min(1).max(5).optional(),
      timelinessRating: Joi.number().min(1).max(5).optional(),
      cleanlinessRating: Joi.number().min(1).max(5).optional(),
      communicationRating: Joi.number().min(1).max(5).optional(),
    }).custom((value, helpers) => {
      // At least one of receiverId, bookingId, or businessId must be provided
      if (!value.receiverId && !value.bookingId && !value.businessId) {
        return helpers.error("any.custom", {
          message: "At least one of receiverId, bookingId, or businessId must be provided",
        })
      }
      return value
    }),
  }),

  submitDriverRating: Joi.object({
    body: Joi.object({
      driverId: Joi.string().required(),
      bookingId: Joi.string().required(),
      rating: Joi.number().min(1).max(5).required(),
      comment: Joi.string().optional(),
      serviceRating: Joi.number().min(1).max(5).optional(),
      timelinessRating: Joi.number().min(1).max(5).optional(),
      cleanlinessRating: Joi.number().min(1).max(5).optional(),
      communicationRating: Joi.number().min(1).max(5).optional(),
    }),
  }),

  updateReview: Joi.object({
    body: Joi.object({
      rating: Joi.number().min(1).max(5).optional(),
      comment: Joi.string().optional(),
      serviceRating: Joi.number().min(1).max(5).optional(),
      timelinessRating: Joi.number().min(1).max(5).optional(),
      cleanlinessRating: Joi.number().min(1).max(5).optional(),
      communicationRating: Joi.number().min(1).max(5).optional(),
    }),
  }),

  reportReview: Joi.object({
    body: Joi.object({
      reason: Joi.string()
        .valid("INAPPROPRIATE_CONTENT", "SPAM", "FAKE_REVIEW", "HARASSMENT", "OFFENSIVE_LANGUAGE", "OTHER")
        .required(),
      description: Joi.string().required(),
    }),
  }),

  moderateReview: Joi.object({
    body: Joi.object({
      action: Joi.string().valid("approve", "reject", "flag").required(),
      reason: Joi.string().optional(),
    }),
  }),
}
