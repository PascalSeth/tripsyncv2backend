import Joi from "joi"

export const onboardDispatchRiderValidation = Joi.object({
  licenseNumber: Joi.string().required(),
  licenseExpiry: Joi.date().required(),
  licenseClass: Joi.string().required(),
  deliveryZones: Joi.array().items(Joi.string()).optional(),
  maxDeliveryDistance: Joi.number().positive().optional(),
  vehicleType: Joi.string().valid("MOTORCYCLE", "BICYCLE", "CAR", "VAN", "SCOOTER").optional(),
  operatingHours: Joi.object().optional(),
  acceptsCash: Joi.boolean().optional(),
  acceptsCard: Joi.boolean().optional(),
  preferredPayoutMethod: Joi.string().valid("BANK_TRANSFER", "MOBILE_MONEY", "PAYSTACK_TRANSFER").optional(),
  payoutSchedule: Joi.string().valid("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "ON_DEMAND").optional(),
  minimumPayoutAmount: Joi.number().positive().optional(),
  insurancePolicyNumber: Joi.string().optional(),
  insuranceExpiry: Joi.date().optional(),
  vehicleInfo: Joi.object({
    make: Joi.string().required(),
    model: Joi.string().required(),
    year: Joi.number()
      .integer()
      .min(1990)
      .max(new Date().getFullYear() + 1)
      .required(),
    color: Joi.string().required(),
    licensePlate: Joi.string().required(),
    registration: Joi.string().optional(),
    insurance: Joi.string().optional(),
    inspection: Joi.string().optional(),
  }).optional(),
  bankDetails: Joi.object({
    bankName: Joi.string().required(),
    accountNumber: Joi.string().required(),
    accountName: Joi.string().required(),
    bankCode: Joi.string().required(),
  }).optional(),
  emergencyContact: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    relationship: Joi.string().required(),
  }).optional(),
})

export const updateDispatchRiderProfileValidation = Joi.object({
  deliveryZones: Joi.array().items(Joi.string()).optional(),
  maxDeliveryDistance: Joi.number().positive().optional(),
  vehicleType: Joi.string().valid("MOTORCYCLE", "BICYCLE", "CAR", "VAN", "SCOOTER").optional(),
  operatingHours: Joi.object().optional(),
  acceptsCash: Joi.boolean().optional(),
  acceptsCard: Joi.boolean().optional(),
  preferredPayoutMethod: Joi.string().valid("BANK_TRANSFER", "MOBILE_MONEY", "PAYSTACK_TRANSFER").optional(),
  payoutSchedule: Joi.string().valid("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "ON_DEMAND").optional(),
  minimumPayoutAmount: Joi.number().positive().optional(),
  insurancePolicyNumber: Joi.string().optional(),
  insuranceExpiry: Joi.date().optional(),
})

export const addVehicleValidation = Joi.object({
  make: Joi.string().required(),
  model: Joi.string().required(),
  year: Joi.number()
    .integer()
    .min(1990)
    .max(new Date().getFullYear() + 1)
    .required(),
  color: Joi.string().required(),
  licensePlate: Joi.string().required(),
  type: Joi.string().valid("MOTORCYCLE", "BICYCLE", "CAR", "VAN", "SCOOTER").required(),
  capacity: Joi.number().positive().optional(),
  fuelType: Joi.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID").optional(),
  transmission: Joi.string().valid("MANUAL", "AUTOMATIC", "CVT").optional(),
  hasAC: Joi.boolean().optional(),
  hasWifi: Joi.boolean().optional(),
  hasCharger: Joi.boolean().optional(),
  isAccessible: Joi.boolean().optional(),
  registration: Joi.string().optional(),
  insurance: Joi.string().optional(),
  inspection: Joi.string().optional(),
})

export const updateVehicleValidation = Joi.object({
  make: Joi.string().optional(),
  model: Joi.string().optional(),
  year: Joi.number()
    .integer()
    .min(1990)
    .max(new Date().getFullYear() + 1)
    .optional(),
  color: Joi.string().optional(),
  licensePlate: Joi.string().optional(),
  capacity: Joi.number().positive().optional(),
  fuelType: Joi.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID").optional(),
  transmission: Joi.string().valid("MANUAL", "AUTOMATIC", "CVT").optional(),
  hasAC: Joi.boolean().optional(),
  hasWifi: Joi.boolean().optional(),
  hasCharger: Joi.boolean().optional(),
  isAccessible: Joi.boolean().optional(),
  registration: Joi.string().optional(),
  insurance: Joi.string().optional(),
  inspection: Joi.string().optional(),
})

export const uploadDocumentValidation = Joi.object({
  documentType: Joi.string()
    .valid(
      "DRIVERS_LICENSE",
      "VEHICLE_REGISTRATION",
      "INSURANCE_CERTIFICATE",
      "VEHICLE_INSPECTION",
      "BACKGROUND_CHECK",
      "IDENTITY_DOCUMENT",
      "PROOF_OF_ADDRESS",
      "BANK_STATEMENT",
    )
    .required(),
  documentNumber: Joi.string().optional(),
  documentUrl: Joi.string().uri().required(),
  expiryDate: Joi.date().optional(),
})

export const updateAvailabilityValidation = Joi.object({
  isAvailable: Joi.boolean().required(),
  isOnline: Joi.boolean().required(),
  currentLatitude: Joi.number().optional(),
  currentLongitude: Joi.number().optional(),
})

export const updateLocationValidation = Joi.object({
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  heading: Joi.number().optional(),
  speed: Joi.number().optional(),
})

export const acceptDeliveryValidation = Joi.object({
  // No additional validation needed for accepting delivery
})

export const rejectDeliveryValidation = Joi.object({
  reason: Joi.string().optional(),
})

export const confirmPickupValidation = Joi.object({
  notes: Joi.string().optional(),
  photo: Joi.string().uri().optional(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
})

export const completeDeliveryValidation = Joi.object({
  notes: Joi.string().optional(),
  photo: Joi.string().uri().optional(),
  signature: Joi.string().optional(),
  recipientName: Joi.string().required(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
})

export const reportIssueValidation = Joi.object({
  issueType: Joi.string()
    .valid(
      "CUSTOMER_NOT_AVAILABLE",
      "WRONG_ADDRESS",
      "DAMAGED_ITEM",
      "MISSING_ITEM",
      "PAYMENT_ISSUE",
      "VEHICLE_BREAKDOWN",
      "ACCIDENT",
      "WEATHER_CONDITION",
      "TRAFFIC_ISSUE",
      "OTHER",
    )
    .required(),
  description: Joi.string().required(),
  severity: Joi.string().valid("LOW", "MEDIUM", "HIGH").optional(),
  location: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
    address: Joi.string().optional(),
  }).optional(),
  photos: Joi.array().items(Joi.string().uri()).optional(),
})

export const markOrderReadyValidation = Joi.object({
  notes: Joi.string().optional(),
  deliveryFee: Joi.number().positive().optional(),
  estimatedPickupTime: Joi.date().optional(),
  estimatedDeliveryTime: Joi.date().optional(),
  specialInstructions: Joi.string().optional(),
})

export const updateTrackingValidation = Joi.object({
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  heading: Joi.number().optional(),
  status: Joi.string().optional(),
  message: Joi.string().optional(),
})
