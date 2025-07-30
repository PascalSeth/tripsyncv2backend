import Joi from "joi"

export const movingValidation = {
  onboardMover: Joi.object({
    body: Joi.object({
      companyName: Joi.string().required(),
      teamSize: Joi.number().min(1).required(),
      hasEquipment: Joi.boolean().required(),
      hourlyRate: Joi.number().min(0).required(),
      maxWeight: Joi.number().min(0).optional(),
      serviceRadius: Joi.number().min(0).optional(),
      specializations: Joi.array().items(Joi.string()).optional(),
      equipment: Joi.array().items(Joi.string()).optional(),
      insurance: Joi.object({
        provider: Joi.string().required(),
        policyNumber: Joi.string().required(),
        expiryDate: Joi.date().required(),
      }).optional(),
      certifications: Joi.array().items(Joi.string()).optional(),
    }),
  }),

  updateMoverProfile: Joi.object({
    body: Joi.object({
      companyName: Joi.string().optional(),
      teamSize: Joi.number().min(1).optional(),
      hasEquipment: Joi.boolean().optional(),
      hourlyRate: Joi.number().min(0).optional(),
      maxWeight: Joi.number().min(0).optional(),
      serviceRadius: Joi.number().min(0).optional(),
      specializations: Joi.array().items(Joi.string()).optional(),
      equipment: Joi.array().items(Joi.string()).optional(),
    }),
  }),

  createMovingBooking: Joi.object({
    body: Joi.object({
      pickupAddress: Joi.object({
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
        address: Joi.string().required(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
      }).required(),
      dropoffAddress: Joi.object({
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
        address: Joi.string().required(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
      }).required(),
      scheduledDate: Joi.date().required(),
      estimatedDuration: Joi.number().min(1).required(),
      roomCount: Joi.number().min(1).required(),
      hasHeavyItems: Joi.boolean().required(),
      hasFragileItems: Joi.boolean().required(),
      floorLevel: Joi.number().min(0).required(),
      hasElevator: Joi.boolean().required(),
      packingRequired: Joi.boolean().optional(),
      storageRequired: Joi.boolean().optional(),
      specialInstructions: Joi.string().optional(),
      requiresDisassembly: Joi.boolean().optional(),
    }),
  }),

  getMovingQuote: Joi.object({
    body: Joi.object({
      pickupAddress: Joi.object({
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
      }).required(),
      dropoffAddress: Joi.object({
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
      }).required(),
      scheduledDate: Joi.date().required(),
      estimatedDuration: Joi.number().min(1).required(),
      roomCount: Joi.number().min(1).required(),
      hasHeavyItems: Joi.boolean().required(),
      hasFragileItems: Joi.boolean().required(),
      floorLevel: Joi.number().min(0).required(),
      hasElevator: Joi.boolean().required(),
      requiresDisassembly: Joi.boolean().optional(),
    }),
  }),

  updateMoverAvailability: Joi.object({
    body: Joi.object({
      isAvailable: Joi.boolean().required(),
      isOnline: Joi.boolean().required(),
    }),
  }),

  startMovingJob: Joi.object({
    body: Joi.object({
      crewMembers: Joi.array().items(Joi.string()).optional(),
      equipmentUsed: Joi.array().items(Joi.string()).optional(),
    }),
  }),

  completeMovingJob: Joi.object({
    body: Joi.object({
      actualDuration: Joi.number().min(0).optional(),
      finalPrice: Joi.number().min(0).optional(),
      damageReport: Joi.object({
        hasDamage: Joi.boolean().required(),
        items: Joi.array().items(Joi.string()).optional(),
        photos: Joi.array().items(Joi.string()).optional(),
      }).optional(),
      customerSignature: Joi.string().optional(),
      additionalServices: Joi.array()
        .items(
          Joi.object({
            service: Joi.string().required(),
            cost: Joi.number().min(0).required(),
          }),
        )
        .optional(),
    }),
  }),

  suspendMover: Joi.object({
    body: Joi.object({
      reason: Joi.string().required(),
    }),
  }),
}
