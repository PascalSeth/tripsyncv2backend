import Joi from "joi"

export const storeValidation = {
  onboardStoreOwner: Joi.object({
    body: Joi.object({
      // User data (for new user creation)
      email: Joi.string().email().optional(),
      phone: Joi.string().optional(),
      password: Joi.string().min(6).optional(),
      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      gender: Joi.string().valid("MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY").optional(),
      dateOfBirth: Joi.date().optional(),

      // Store owner profile details
      businessLicense: Joi.string().required(),
      taxId: Joi.string().optional(),
      businessType: Joi.string().required(),

      // Store details (optional)
      storeInfo: Joi.object({
        name: Joi.string().required(),
        type: Joi.string().required(),
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
        address: Joi.string().required(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        country: Joi.string().optional(),
        postalCode: Joi.string().optional(),
        contactPhone: Joi.string().required(),
        contactEmail: Joi.string().email().optional(),
        description: Joi.string().optional(),
        operatingHours: Joi.string().optional(),
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
      }).optional(),
    }),
  }),

  updateStoreOwnerProfile: Joi.object({
    body: Joi.object({
      businessLicense: Joi.string().optional(),
      taxId: Joi.string().optional(),
      businessType: Joi.string().optional(),
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
      country: Joi.string().optional(),
      postalCode: Joi.string().optional(),
      contactPhone: Joi.string().required(),
      contactEmail: Joi.string().email().optional(),
      description: Joi.string().optional(),
      operatingHours: Joi.string().optional(),
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
      country: Joi.string().optional(),
      postalCode: Joi.string().optional(),
      contactPhone: Joi.string().optional(),
      contactEmail: Joi.string().email().optional(),
      description: Joi.string().optional(),
      operatingHours: Joi.string().optional(),
      isActive: Joi.boolean().optional(),
    }),
  }),

  createSubcategory: Joi.object({
    body: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),
      category: Joi.string().valid("FOOD", "GROCERY", "PHARMACY").required(),
      imageUrl: Joi.string().uri().optional(),
    }),
  }),

  updateSubcategory: Joi.object({
    body: Joi.object({
      name: Joi.string().optional(),
      description: Joi.string().optional(),
      category: Joi.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
      imageUrl: Joi.string().uri().optional(),
    }),
  }),

  addProduct: Joi.object({
    body: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),
      price: Joi.number().min(0).required(),
      category: Joi.string().valid("FOOD", "GROCERY", "PHARMACY").required(),
      subcategoryId: Joi.string().uuid().optional(),
      inStock: Joi.boolean().optional(),
      stockQuantity: Joi.number().min(0).optional(),
    }),
  }),

  updateProduct: Joi.object({
    body: Joi.object({
      name: Joi.string().optional(),
      description: Joi.string().optional(),
      price: Joi.number().min(0).optional(),
      category: Joi.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
      subcategoryId: Joi.string().uuid().optional(),
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

  bulkUpdateProducts: Joi.object({
    body: Joi.object({
      productIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
      updateData: Joi.object({
        price: Joi.number().min(0).optional(),
        category: Joi.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
        subcategoryId: Joi.string().uuid().optional(),
        inStock: Joi.boolean().optional(),
        stockQuantity: Joi.number().min(0).optional(),
      })
        .min(1)
        .required(),
    }),
  }),

  rejectStoreOwner: Joi.object({
    body: Joi.object({
      reason: Joi.string().required(),
    }),
  }),

  // Query parameter validations
  getStores: Joi.object({
    query: Joi.object({
      page: Joi.number().min(1).optional(),
      limit: Joi.number().min(1).max(100).optional(),
      search: Joi.string().optional(),
      type: Joi.string().optional(),
      category: Joi.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
      subcategoryId: Joi.string().uuid().optional(),
      latitude: Joi.number().optional(),
      longitude: Joi.number().optional(),
      radius: Joi.number().min(0).optional(),
      isActive: Joi.boolean().optional(),
    }),
  }),

  getProducts: Joi.object({
    query: Joi.object({
      page: Joi.number().min(1).optional(),
      limit: Joi.number().min(1).max(100).optional(),
      search: Joi.string().optional(),
      category: Joi.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
      subcategoryId: Joi.string().uuid().optional(),
      inStock: Joi.boolean().optional(),
    }),
  }),

  getSubcategories: Joi.object({
    query: Joi.object({
      page: Joi.number().min(1).optional(),
      limit: Joi.number().min(1).max(100).optional(),
      search: Joi.string().optional(),
      category: Joi.string().valid("FOOD", "GROCERY", "PHARMACY").optional(),
    }),
  }),

  getStoreAnalytics: Joi.object({
    query: Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().optional(),
    }),
  }),

  getLowStockProducts: Joi.object({
    query: Joi.object({
      threshold: Joi.number().min(0).optional(),
    }),
  }),
}
