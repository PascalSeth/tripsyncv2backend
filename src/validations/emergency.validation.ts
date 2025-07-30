import Joi from "joi"

export const emergencyValidation = {
  createEmergencyBooking: Joi.object({
    body: Joi.object({
      emergencyType: Joi.string()
        .valid("MEDICAL", "FIRE", "POLICE", "RESCUE", "SECURITY", "ROADSIDE_ASSISTANCE", "OTHER")
        .required(),
      latitude: Joi.number().required(),
      longitude: Joi.number().required(),
      description: Joi.string().required(),
      severity: Joi.string().valid("LOW", "MEDIUM", "HIGH", "CRITICAL").required(),
      contactPhone: Joi.string().required(),
      additionalInfo: Joi.object().optional(),
    }),
  }),

  updateEmergencyStatus: Joi.object({
    body: Joi.object({
      status: Joi.string().valid("PENDING", "DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED").required(),
      notes: Joi.string().optional(),
      estimatedArrival: Joi.date().optional(),
    }),
  }),

  completeEmergencyCall: Joi.object({
    body: Joi.object({
      resolution: Joi.string().required(),
      notes: Joi.string().optional(),
      followUpRequired: Joi.boolean().required(),
    }),
  }),

  onboardEmergencyResponder: Joi.object({
    body: Joi.object({
      serviceType: Joi.string()
        .valid("MEDICAL", "FIRE", "POLICE", "RESCUE", "SECURITY", "ROADSIDE_ASSISTANCE", "OTHER")
        .required(),
      badgeNumber: Joi.string().optional(),
      department: Joi.string().optional(),
      rank: Joi.string().optional(),
      responseRadius: Joi.number().optional(),
      certifications: Joi.array().items(Joi.string()).optional(),
      emergencyContacts: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
            phone: Joi.string().required(),
            relationship: Joi.string().required(),
          }),
        )
        .optional(),
    }),
  }),

  updateResponderProfile: Joi.object({
    body: Joi.object({
      department: Joi.string().optional(),
      rank: Joi.string().optional(),
      responseRadius: Joi.number().optional(),
      certifications: Joi.array().items(Joi.string()).optional(),
      emergencyContacts: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().required(),
            phone: Joi.string().required(),
            relationship: Joi.string().required(),
          }),
        )
        .optional(),
    }),
  }),

  updateResponderLocation: Joi.object({
    body: Joi.object({
      latitude: Joi.number().required(),
      longitude: Joi.number().required(),
      isOnDuty: Joi.boolean().required(),
    }),
  }),
}
