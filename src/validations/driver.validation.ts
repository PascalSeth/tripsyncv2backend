import Joi from "joi"

export const driverValidation = {
  onboard: Joi.object({
    licenseNumber: Joi.string().required(),
    licenseExpiry: Joi.date().greater("now").required(),
    licenseClass: Joi.string().required(),
    vehicleInfo: Joi.object({
      make: Joi.string().required(),
      model: Joi.string().required(),
      year: Joi.number()
        .min(2000)
        .max(new Date().getFullYear() + 1)
        .required(),
      color: Joi.string().required(),
      licensePlate: Joi.string().required(),
      type: Joi.string().valid("CAR", "MOTORCYCLE", "VAN", "TRUCK").required(),
      category: Joi.string().valid("ECONOMY", "COMFORT", "PREMIUM", "SUV").required(),
    }).optional(),
    bankDetails: Joi.object({
      bankName: Joi.string().required(),
      accountNumber: Joi.string().required(),
      accountName: Joi.string().required(),
    }).optional(),
    emergencyContact: Joi.object({
      name: Joi.string().required(),
      phone: Joi.string().required(),
      relationship: Joi.string().required(),
    }).optional(),
    preferredServiceZones: Joi.array().items(Joi.string()).optional(),
  }),

  setupDayBooking: Joi.object({
    isAvailable: Joi.boolean().required(),
    hourlyRate: Joi.number().min(500).max(10000).required(),
    minimumHours: Joi.number().min(2).max(8).default(4),
    maximumHours: Joi.number().min(8).max(24).default(12),
    serviceAreas: Joi.array().items(Joi.string()).required(),
    availableDays: Joi.array().items(Joi.number().min(0).max(6)).required(),
    availableTimeSlots: Joi.array()
      .items(
        Joi.object({
          start: Joi.string()
            .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .required(),
          end: Joi.string()
            .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .required(),
        }),
      )
      .required(),
    specialRequirements: Joi.string().max(500).optional(),
    vehicleFeatures: Joi.array().items(Joi.string()).optional(),
  }),

  updateDayBookingAvailability: Joi.object({
    date: Joi.date().min("now").required(),
    timeSlots: Joi.array()
      .items(
        Joi.object({
          start: Joi.string()
            .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .required(),
          end: Joi.string()
            .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
            .required(),
          isAvailable: Joi.boolean().required(),
        }),
      )
      .required(),
    isAvailable: Joi.boolean().required(),
  }),

  updateDayBookingPricing: Joi.object({
    hourlyRate: Joi.number().min(500).max(10000).required(),
    minimumHours: Joi.number().min(2).max(8).optional(),
    maximumHours: Joi.number().min(8).max(24).optional(),
    surgeMultiplier: Joi.number().min(1).max(3).optional(),
  }),

  updateAvailability: Joi.object({
    isAvailable: Joi.boolean().required(),
    isOnline: Joi.boolean().required(),
    currentLatitude: Joi.number().min(-90).max(90).optional(),
    currentLongitude: Joi.number().min(-180).max(180).optional(),
  }),

  updateLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    heading: Joi.number().min(0).max(360).optional(),
    speed: Joi.number().min(0).optional(),
  }),

  rejectBooking: Joi.object({
    reason: Joi.string().max(200).optional(),
  }),

  completeTrip: Joi.object({
    actualDistance: Joi.number().min(0).optional(),
    actualDuration: Joi.number().min(0).optional(),
    finalPrice: Joi.number().min(0).optional(),
    endLatitude: Joi.number().min(-90).max(90).optional(),
    endLongitude: Joi.number().min(-180).max(180).optional(),
  }),

  getBookings: Joi.object({
    status: Joi.string()
      .valid("PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED")
      .optional(),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(50).default(10),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
  }),

  getEarnings: Joi.object({
    period: Joi.string().valid("today", "week", "month", "custom").default("week"),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
  }),

  addVehicle: Joi.object({
    make: Joi.string().required(),
    model: Joi.string().required(),
    year: Joi.number()
      .min(2000)
      .max(new Date().getFullYear() + 1)
      .required(),
    color: Joi.string().required(),
    licensePlate: Joi.string().required(),
    type: Joi.string().valid("CAR", "MOTORCYCLE", "VAN", "TRUCK").required(),
    category: Joi.string().valid("ECONOMY", "COMFORT", "PREMIUM", "SUV").required(),
    capacity: Joi.number().min(1).max(50).default(4),
    fuelType: Joi.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID").default("GASOLINE"),
    transmission: Joi.string().valid("MANUAL", "AUTOMATIC").default("AUTOMATIC"),
    hasAC: Joi.boolean().default(true),
    hasWifi: Joi.boolean().default(false),
    hasCharger: Joi.boolean().default(false),
    isAccessible: Joi.boolean().default(false),
  }),

  updateVehicle: Joi.object({
    make: Joi.string().optional(),
    model: Joi.string().optional(),
    year: Joi.number()
      .min(2000)
      .max(new Date().getFullYear() + 1)
      .optional(),
    color: Joi.string().optional(),
    type: Joi.string().valid("CAR", "MOTORCYCLE", "VAN", "TRUCK").optional(),
    category: Joi.string().valid("ECONOMY", "COMFORT", "PREMIUM", "SUV").optional(),
    capacity: Joi.number().min(1).max(50).optional(),
    fuelType: Joi.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID").optional(),
    transmission: Joi.string().valid("MANUAL", "AUTOMATIC").optional(),
    hasAC: Joi.boolean().optional(),
    hasWifi: Joi.boolean().optional(),
    hasCharger: Joi.boolean().optional(),
    isAccessible: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
  }),

  uploadDocument: Joi.object({
    documentType: Joi.string()
      .valid("DRIVERS_LICENSE", "VEHICLE_REGISTRATION", "INSURANCE_CERTIFICATE", "VEHICLE_INSPECTION")
      .required(),
    documentNumber: Joi.string().optional(),
    expiryDate: Joi.date().greater("now").optional(),
  }),

  updateProfile: Joi.object({
    acceptsSharedRides: Joi.boolean().optional(),
    acceptsCash: Joi.boolean().optional(),
    maxRideDistance: Joi.number().min(1).max(100).optional(),
    preferredPayoutMethod: Joi.string().valid("BANK_TRANSFER", "MOBILE_MONEY").optional(),
    payoutSchedule: Joi.string().valid("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY").optional(),
    minimumPayoutAmount: Joi.number().min(100).max(10000).optional(),
  }),
}
