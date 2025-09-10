import Joi from "joi"

export const storeValidation = {
  onboardStoreOwner: Joi.object({
    body: Joi.object({
      // Required for all onboarding
      businessLicense: Joi.string().required(),
      businessType: Joi.string()
        .valid("GROCERY", "RESTAURANT", "PHARMACY", "ELECTRONICS", "CLOTHING", "BOOKS", "HARDWARE", "OTHER")
        .required(),

      // Optional business details
      taxId: Joi.string().optional(),

      // Required only for new users (not authenticated)
      email: Joi.string().email().optional(),
      phone: Joi.string().optional(),
      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      password: Joi.string().min(6).optional(),
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
    businessHours: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            dayOfWeek: Joi.number().min(0).max(6).required(),
            openTime: Joi.string().required(),
            closeTime: Joi.string().required(),
            isClosed: Joi.boolean().optional(),
          }),
        ),
        Joi.string().custom((value, helpers) => {
          try {
            const parsed = JSON.parse(value)
            if (!Array.isArray(parsed)) {
              return helpers.error('any.invalid')
            }
            // Validate each item
            for (const item of parsed) {
              if (typeof item !== 'object' || item === null) {
                return helpers.error('any.invalid')
              }
              if (typeof item.dayOfWeek !== 'number' || item.dayOfWeek < 0 || item.dayOfWeek > 6) {
                return helpers.error('any.invalid')
              }
              if (typeof item.openTime !== 'string' || typeof item.closeTime !== 'string') {
                return helpers.error('any.invalid')
              }
              if (item.isClosed !== undefined && typeof item.isClosed !== 'boolean') {
                return helpers.error('any.invalid')
              }
            }
            return parsed
          } catch {
            return helpers.error('any.invalid')
          }
        })
      )
      .optional(),
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
      categoryId: Joi.string().required(), // Changed from category to categoryId to reference Category model
      subcategoryId: Joi.string().optional(), // Added subcategoryId validation
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
      categoryId: Joi.string().optional(), // Changed from category to categoryId to reference Category model
      subcategoryId: Joi.string().optional(), // Added subcategoryId validation
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

  createCategory: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    storeTypes: Joi.any().custom((value, helpers) => {
      let arr;
      if (Array.isArray(value)) {
        arr = value;
      } else if (typeof value === 'string') {
        try {
          arr = JSON.parse(value);
          if (!Array.isArray(arr)) {
            arr = [arr];
          }
        } catch {
          arr = [value];
        }
      } else {
        return helpers.error('any.invalid');
      }

      if (arr.length === 0) {
        return helpers.error('any.invalid');
      }

      const validTypes = ["GROCERY", "PHARMACY", "RESTAURANT", "RETAIL", "ELECTRONICS", "OTHER"];
      for (const item of arr) {
        if (!validTypes.includes(item)) {
          return helpers.error('any.invalid');
        }
      }

      return arr;
    }).required(),
  }),

  updateCategory: Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    storeTypes: Joi.any().custom((value, helpers) => {
      let arr;
      if (Array.isArray(value)) {
        arr = value;
      } else if (typeof value === 'string') {
        try {
          arr = JSON.parse(value);
          if (!Array.isArray(arr)) {
            arr = [arr];
          }
        } catch {
          arr = [value];
        }
      } else {
        return helpers.error('any.invalid');
      }

      if (arr.length === 0) {
        return helpers.error('any.invalid');
      }

      const validTypes = ["GROCERY", "PHARMACY", "RESTAURANT", "RETAIL", "ELECTRONICS", "OTHER"];
      for (const item of arr) {
        if (!validTypes.includes(item)) {
          return helpers.error('any.invalid');
        }
      }

      return arr;
    }).optional(),
  }),

  createSubcategory: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    categoryId: Joi.string().required(),
    imageUrl: Joi.string().optional(), // Added imageUrl validation for subcategories
  }),

  updateSubcategory: Joi.object({
    name: Joi.string().optional(),
    description: Joi.string().optional(),
    categoryId: Joi.string().optional(),
    imageUrl: Joi.string().optional(), // Added imageUrl validation for subcategory updates
  }),
}
