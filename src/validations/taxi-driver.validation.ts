import Joi from "joi"

export const taxiDriverValidation = {
  onboard: Joi.object({
    licenseNumber: Joi.string().required().messages({
      "string.empty": "License number is required",
      "any.required": "License number is required",
    }),
    licenseExpiry: Joi.string().required().messages({
      "string.empty": "License expiry date is required",
      "any.required": "License expiry date is required",
    }),
    licenseClass: Joi.string().required().messages({
      "string.empty": "License class is required",
      "any.required": "License class is required",
    }),
    taxiLicenseNumber: Joi.string().required().messages({
      "string.empty": "Taxi license number is required",
      "any.required": "Taxi license number is required",
    }),
    taxiLicenseExpiry: Joi.string().required().messages({
      "string.empty": "Taxi license expiry date is required",
      "any.required": "Taxi license expiry date is required",
    }),
    taxiPermitNumber: Joi.string().optional(),
    taxiPermitExpiry: Joi.string().optional(),
    taxiZone: Joi.string().optional(),
    meterNumber: Joi.string().optional(),
    vehicleInfo: Joi.object({
      make: Joi.string().required().messages({
        "string.empty": "Vehicle make is required",
        "any.required": "Vehicle make is required",
      }),
      model: Joi.string().required().messages({
        "string.empty": "Vehicle model is required",
        "any.required": "Vehicle model is required",
      }),
      year: Joi.number().min(1900).max(new Date().getFullYear() + 1).required(),
      color: Joi.string().required().messages({
        "string.empty": "Vehicle color is required",
        "any.required": "Vehicle color is required",
      }),
      licensePlate: Joi.string().required().messages({
        "string.empty": "License plate is required",
        "any.required": "License plate is required",
      }),
      capacity: Joi.number().min(1).max(8).default(4),
      fuelType: Joi.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG").default("GASOLINE"),
      transmission: Joi.string().valid("MANUAL", "AUTOMATIC", "CVT").default("AUTOMATIC"),
      hasAC: Joi.boolean().default(true),
      hasWifi: Joi.boolean().default(false),
      hasCharger: Joi.boolean().default(false),
      isAccessible: Joi.boolean().default(false),
      taxiMeterInstalled: Joi.boolean().default(true),
      taxiTopLightInstalled: Joi.boolean().default(true),
    }).optional(),
    bankDetails: Joi.object({
      bankName: Joi.string().optional(),
      accountNumber: Joi.string().optional(),
      accountName: Joi.string().optional(),
      bankCode: Joi.string().optional(),
    }).optional(),
    emergencyContact: Joi.object({
      name: Joi.string().required().messages({
        "string.empty": "Emergency contact name is required",
        "any.required": "Emergency contact name is required",
      }),
      phone: Joi.string().required().messages({
        "string.empty": "Emergency contact phone is required",
        "any.required": "Emergency contact phone is required",
      }),
      relationship: Joi.string().required().messages({
        "string.empty": "Relationship is required",
        "any.required": "Relationship is required",
      }),
    }).optional(),
    operatingHours: Joi.object({
      monday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      tuesday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      wednesday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      thursday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      friday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      saturday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      sunday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
    }).optional(),
  }),

  updateProfile: Joi.object({
    taxiZone: Joi.string().optional(),
    meterNumber: Joi.string().optional(),
    insurancePolicyNumber: Joi.string().optional(),
    insuranceExpiry: Joi.string().optional(),
    acceptsCash: Joi.boolean().optional(),
    acceptsCard: Joi.boolean().optional(),
    maxRideDistance: Joi.number().positive().optional(),
    preferredPayoutMethod: Joi.string()
      .valid("BANK_TRANSFER", "MOBILE_MONEY", "PAYSTACK_TRANSFER", "CASH", "CHECK")
      .optional(),
    payoutSchedule: Joi.string().valid("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "ON_DEMAND").optional(),
    minimumPayoutAmount: Joi.number().positive().optional(),
  }),

  updateAvailability: Joi.object({
    isAvailable: Joi.boolean().required(),
    isOnline: Joi.boolean().optional(),
    currentLatitude: Joi.number().optional(),
    currentLongitude: Joi.number().optional(),
  }),

  updateLocation: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    heading: Joi.number().optional(),
    speed: Joi.number().optional(),
  }),

  updateOperatingHours: Joi.object({
    operatingHours: Joi.object({
      monday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      tuesday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      wednesday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      thursday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      friday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      saturday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
      sunday: Joi.object({
        isActive: Joi.boolean().required(),
        startTime: Joi.string().optional(),
        endTime: Joi.string().optional(),
      }).optional(),
    }).required(),
  }),

  addVehicle: Joi.object({
    make: Joi.string().required().messages({
      "string.empty": "Vehicle make is required",
      "any.required": "Vehicle make is required",
    }),
    model: Joi.string().required().messages({
      "string.empty": "Vehicle model is required",
      "any.required": "Vehicle model is required",
    }),
    year: Joi.number().min(1900).max(new Date().getFullYear() + 1).required(),
    color: Joi.string().required().messages({
      "string.empty": "Vehicle color is required",
      "any.required": "Vehicle color is required",
    }),
    licensePlate: Joi.string().required().messages({
      "string.empty": "License plate is required",
      "any.required": "License plate is required",
    }),
    capacity: Joi.number().min(1).max(8).default(4),
    fuelType: Joi.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG").default("GASOLINE"),
    transmission: Joi.string().valid("MANUAL", "AUTOMATIC", "CVT").default("AUTOMATIC"),
    hasAC: Joi.boolean().default(true),
    hasWifi: Joi.boolean().default(false),
    hasCharger: Joi.boolean().default(false),
    isAccessible: Joi.boolean().default(false),
    taxiMeterInstalled: Joi.boolean().default(true),
    taxiTopLightInstalled: Joi.boolean().default(true),
    registration: Joi.string().optional(),
    insurance: Joi.string().optional(),
    inspection: Joi.string().optional(),
  }),

  updateVehicle: Joi.object({
    make: Joi.string().optional(),
    model: Joi.string().optional(),
    year: Joi.number().min(1900).max(new Date().getFullYear() + 1).optional(),
    color: Joi.string().optional(),
    capacity: Joi.number().min(1).max(8).optional(),
    fuelType: Joi.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG").optional(),
    transmission: Joi.string().valid("MANUAL", "AUTOMATIC", "CVT").optional(),
    hasAC: Joi.boolean().optional(),
    hasWifi: Joi.boolean().optional(),
    hasCharger: Joi.boolean().optional(),
    isAccessible: Joi.boolean().optional(),
    taxiMeterInstalled: Joi.boolean().optional(),
    taxiTopLightInstalled: Joi.boolean().optional(),
    registration: Joi.string().optional(),
    insurance: Joi.string().optional(),
    inspection: Joi.string().optional(),
  }),

  uploadDocument: Joi.object({
    documentType: Joi.string()
      .valid(
        "DRIVERS_LICENSE",
        "TAXI_LICENSE",
        "TAXI_PERMIT",
        "VEHICLE_REGISTRATION",
        "INSURANCE_CERTIFICATE",
        "VEHICLE_INSPECTION",
        "METER_CALIBRATION",
        "BACKGROUND_CHECK",
        "IDENTITY_DOCUMENT",
        "PROOF_OF_ADDRESS",
        "BANK_STATEMENT",
        "TAX_DOCUMENT",
        "TAXI_ZONE_PERMIT",
      )
      .required(),
    documentNumber: Joi.string().optional(),
    expiryDate: Joi.string().optional(),
  }),

  rejectBooking: Joi.object({
    reason: Joi.string().optional(),
  }),

  completeTrip: Joi.object({
    actualDistance: Joi.number().positive().optional(),
    actualDuration: Joi.number().positive().optional(),
    finalPrice: Joi.number().positive().optional(),
    endLatitude: Joi.number().optional(),
    endLongitude: Joi.number().optional(),
    meterReading: Joi.number().positive().optional(),
  }),

  getBookings: Joi.object({
    status: Joi.string()
      .valid(
        "PENDING",
        "CONFIRMED",
        "DRIVER_ASSIGNED",
        "DRIVER_ARRIVED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
        "FAILED",
      )
      .optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(10),
    dateFrom: Joi.string().optional(),
    dateTo: Joi.string().optional(),
  }),

  getEarnings: Joi.object({
    period: Joi.string().valid("today", "week", "month", "custom").default("week"),
    startDate: Joi.string().optional(),
    endDate: Joi.string().optional(),
  }),
}
