import Joi from "joi"

export const storeValidation = {
  onboardStoreOwner: Joi.object({
    body: Joi.object({
      businessLicense: Joi.string().required(),
      taxId: Joi.string().required(),
      businessType: Joi.string()
        .valid("GROCERY", "RESTAURANT", "PHARMACY", "ELECTRONICS", "CLOTHING", "BOOKS", "HARDWARE", "OTHER")
        .required(),
      storeInfo: Joi.object({
        name: Joi.string().required(),
        description: Joi.string().optional(),
        category: Joi.string().required(),
      }).optional(),
      bankDetails: Joi.object({
        accountName: Joi.string().required(),
        accountNumber: Joi.string().required(),
        bankName: Joi.string().required(),
        routingNumber: Joi.string().required(),
      }).optional(),
    }),
  }),

  updateStoreOwnerProfile: Joi.object({
    body: Joi.object({
      businessLicense: Joi.string().optional(),
      taxId: Joi.string().optional(),
      businessType: Joi.string()
        .valid("GROCERY", "RESTAURANT", "PHARMACY", "ELECTRONICS", "CLOTHING", "BOOKS", "HARDWARE", "OTHER")
        .optional(),
    }),
  }),

  createStore: Joi.object({
    body: Joi.object({
      name: Joi.string().required(),
      type: Joi.string().required(),
      latitude: Joi.number().required(),
      longitude: Joi.number().required(),
      address: Joi.string().required(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      zipCode: Joi.string().optional(),
      phone: Joi.string().optional(),
      email: Joi.string().email().optional(),
      description: Joi.string().optional(),
      image: Joi.string().optional(),
      businessHours: Joi.array()
        .items(
          Joi.object({
            dayOfWeek: Joi.number().min(0).max(6).required(),
            openTime: Joi.string().required(),
            closeTime: Joi.string().required(),
            isClosed: Joi.boolean().optional(),
          }),
        )
        .optional(),
    }),
  }),

  updateStore: Joi.object({
    body: Joi.object({
      name: Joi.string().optional(),
      type: Joi.string().optional(),
      latitude: Joi.number().optional(),
      longitude: Joi.number().optional(),
      address: Joi.string().optional(),
      city: Joi.string().optional(),
      state: Joi.string().optional(),
      zipCode: Joi.string().optional(),
      phone: Joi.string().optional(),
      email: Joi.string().email().optional(),
      description: Joi.string().optional(),
      image: Joi.string().optional(),
      isActive: Joi.boolean().optional(),
    }),
  }),

  addProduct: Joi.object({
    body: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),
      price: Joi.number().min(0).required(),
      category: Joi.string().required(),
      image: Joi.string().optional(),
      inStock: Joi.boolean().optional(),
      stockQuantity: Joi.number().min(0).optional(),
    }),
  }),

  updateProduct: Joi.object({
    body: Joi.object({
      name: Joi.string().optional(),
      description: Joi.string().optional(),
      price: Joi.number().min(0).optional(),
      category: Joi.string().optional(),
      image: Joi.string().optional(),
      inStock: Joi.boolean().optional(),
      stockQuantity: Joi.number().min(0).optional(),
    }),
  }),

  updateBusinessHours: Joi.object({
    body: Joi.object({
      businessHours: Joi.array()
        .items(
          Joi.object({
            dayOfWeek: Joi.number().min(0).max(6).required(),
            openTime: Joi.string().required(),
            closeTime: Joi.string().required(),
            isClosed: Joi.boolean().optional(),
          }),
        )
        .required(),
    }),
  }),

  updateInventory: Joi.object({
    body: Joi.object({
      stockQuantity: Joi.number().min(0).required(),
      operation: Joi.string().valid("set", "add", "subtract").required(),
    }),
  }),

  rejectStoreOwner: Joi.object({
    body: Joi.object({
      reason: Joi.string().required(),
    }),
  }),
}
