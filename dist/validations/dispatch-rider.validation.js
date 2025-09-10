"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTrackingValidation = exports.markOrderReadyValidation = exports.reportIssueValidation = exports.completeDeliveryValidation = exports.confirmPickupValidation = exports.rejectDeliveryValidation = exports.acceptDeliveryValidation = exports.updateLocationValidation = exports.updateAvailabilityValidation = exports.uploadDocumentValidation = exports.updateVehicleValidation = exports.addVehicleValidation = exports.updateDispatchRiderProfileValidation = exports.onboardDispatchRiderValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.onboardDispatchRiderValidation = joi_1.default.object({
    licenseNumber: joi_1.default.string().required(),
    licenseExpiry: joi_1.default.date().required(),
    licenseClass: joi_1.default.string().required(),
    deliveryZones: joi_1.default.array().items(joi_1.default.string()).optional(),
    maxDeliveryDistance: joi_1.default.number().positive().optional(),
    vehicleType: joi_1.default.string().valid("MOTORCYCLE", "BICYCLE", "CAR", "VAN", "SCOOTER").optional(),
    operatingHours: joi_1.default.object().optional(),
    acceptsCash: joi_1.default.boolean().optional(),
    acceptsCard: joi_1.default.boolean().optional(),
    preferredPayoutMethod: joi_1.default.string().valid("BANK_TRANSFER", "MOBILE_MONEY", "PAYSTACK_TRANSFER").optional(),
    payoutSchedule: joi_1.default.string().valid("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "ON_DEMAND").optional(),
    minimumPayoutAmount: joi_1.default.number().positive().optional(),
    insurancePolicyNumber: joi_1.default.string().optional(),
    insuranceExpiry: joi_1.default.date().optional(),
    vehicleInfo: joi_1.default.object({
        make: joi_1.default.string().required(),
        model: joi_1.default.string().required(),
        year: joi_1.default.number()
            .integer()
            .min(1990)
            .max(new Date().getFullYear() + 1)
            .required(),
        color: joi_1.default.string().required(),
        licensePlate: joi_1.default.string().required(),
        registration: joi_1.default.string().optional(),
        insurance: joi_1.default.string().optional(),
        inspection: joi_1.default.string().optional(),
    }).optional(),
    bankDetails: joi_1.default.object({
        bankName: joi_1.default.string().required(),
        accountNumber: joi_1.default.string().required(),
        accountName: joi_1.default.string().required(),
        bankCode: joi_1.default.string().required(),
    }).optional(),
    emergencyContact: joi_1.default.object({
        name: joi_1.default.string().required(),
        phone: joi_1.default.string().required(),
        relationship: joi_1.default.string().required(),
    }).optional(),
});
exports.updateDispatchRiderProfileValidation = joi_1.default.object({
    deliveryZones: joi_1.default.array().items(joi_1.default.string()).optional(),
    maxDeliveryDistance: joi_1.default.number().positive().optional(),
    vehicleType: joi_1.default.string().valid("MOTORCYCLE", "BICYCLE", "CAR", "VAN", "SCOOTER").optional(),
    operatingHours: joi_1.default.object().optional(),
    acceptsCash: joi_1.default.boolean().optional(),
    acceptsCard: joi_1.default.boolean().optional(),
    preferredPayoutMethod: joi_1.default.string().valid("BANK_TRANSFER", "MOBILE_MONEY", "PAYSTACK_TRANSFER").optional(),
    payoutSchedule: joi_1.default.string().valid("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "ON_DEMAND").optional(),
    minimumPayoutAmount: joi_1.default.number().positive().optional(),
    insurancePolicyNumber: joi_1.default.string().optional(),
    insuranceExpiry: joi_1.default.date().optional(),
});
exports.addVehicleValidation = joi_1.default.object({
    make: joi_1.default.string().required(),
    model: joi_1.default.string().required(),
    year: joi_1.default.number()
        .integer()
        .min(1990)
        .max(new Date().getFullYear() + 1)
        .required(),
    color: joi_1.default.string().required(),
    licensePlate: joi_1.default.string().required(),
    type: joi_1.default.string().valid("MOTORCYCLE", "BICYCLE", "CAR", "VAN", "SCOOTER").required(),
    capacity: joi_1.default.number().positive().optional(),
    fuelType: joi_1.default.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID").optional(),
    transmission: joi_1.default.string().valid("MANUAL", "AUTOMATIC", "CVT").optional(),
    hasAC: joi_1.default.boolean().optional(),
    hasWifi: joi_1.default.boolean().optional(),
    hasCharger: joi_1.default.boolean().optional(),
    isAccessible: joi_1.default.boolean().optional(),
    registration: joi_1.default.string().optional(),
    insurance: joi_1.default.string().optional(),
    inspection: joi_1.default.string().optional(),
});
exports.updateVehicleValidation = joi_1.default.object({
    make: joi_1.default.string().optional(),
    model: joi_1.default.string().optional(),
    year: joi_1.default.number()
        .integer()
        .min(1990)
        .max(new Date().getFullYear() + 1)
        .optional(),
    color: joi_1.default.string().optional(),
    licensePlate: joi_1.default.string().optional(),
    capacity: joi_1.default.number().positive().optional(),
    fuelType: joi_1.default.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID").optional(),
    transmission: joi_1.default.string().valid("MANUAL", "AUTOMATIC", "CVT").optional(),
    hasAC: joi_1.default.boolean().optional(),
    hasWifi: joi_1.default.boolean().optional(),
    hasCharger: joi_1.default.boolean().optional(),
    isAccessible: joi_1.default.boolean().optional(),
    registration: joi_1.default.string().optional(),
    insurance: joi_1.default.string().optional(),
    inspection: joi_1.default.string().optional(),
});
exports.uploadDocumentValidation = joi_1.default.object({
    documentType: joi_1.default.string()
        .valid("DRIVERS_LICENSE", "VEHICLE_REGISTRATION", "INSURANCE_CERTIFICATE", "VEHICLE_INSPECTION", "BACKGROUND_CHECK", "IDENTITY_DOCUMENT", "PROOF_OF_ADDRESS", "BANK_STATEMENT")
        .required(),
    documentNumber: joi_1.default.string().optional(),
    documentUrl: joi_1.default.string().uri().required(),
    expiryDate: joi_1.default.date().optional(),
});
exports.updateAvailabilityValidation = joi_1.default.object({
    isAvailable: joi_1.default.boolean().required(),
    isOnline: joi_1.default.boolean().required(),
    currentLatitude: joi_1.default.number().optional(),
    currentLongitude: joi_1.default.number().optional(),
});
exports.updateLocationValidation = joi_1.default.object({
    latitude: joi_1.default.number().required(),
    longitude: joi_1.default.number().required(),
    heading: joi_1.default.number().optional(),
    speed: joi_1.default.number().optional(),
});
exports.acceptDeliveryValidation = joi_1.default.object({
// No additional validation needed for accepting delivery
});
exports.rejectDeliveryValidation = joi_1.default.object({
    reason: joi_1.default.string().optional(),
});
exports.confirmPickupValidation = joi_1.default.object({
    notes: joi_1.default.string().optional(),
    photo: joi_1.default.string().uri().optional(),
    latitude: joi_1.default.number().optional(),
    longitude: joi_1.default.number().optional(),
});
exports.completeDeliveryValidation = joi_1.default.object({
    notes: joi_1.default.string().optional(),
    photo: joi_1.default.string().uri().optional(),
    signature: joi_1.default.string().optional(),
    recipientName: joi_1.default.string().required(),
    latitude: joi_1.default.number().optional(),
    longitude: joi_1.default.number().optional(),
});
exports.reportIssueValidation = joi_1.default.object({
    issueType: joi_1.default.string()
        .valid("CUSTOMER_NOT_AVAILABLE", "WRONG_ADDRESS", "DAMAGED_ITEM", "MISSING_ITEM", "PAYMENT_ISSUE", "VEHICLE_BREAKDOWN", "ACCIDENT", "WEATHER_CONDITION", "TRAFFIC_ISSUE", "OTHER")
        .required(),
    description: joi_1.default.string().required(),
    severity: joi_1.default.string().valid("LOW", "MEDIUM", "HIGH").optional(),
    location: joi_1.default.object({
        latitude: joi_1.default.number().required(),
        longitude: joi_1.default.number().required(),
        address: joi_1.default.string().optional(),
    }).optional(),
    photos: joi_1.default.array().items(joi_1.default.string().uri()).optional(),
});
exports.markOrderReadyValidation = joi_1.default.object({
    notes: joi_1.default.string().optional(),
    deliveryFee: joi_1.default.number().positive().optional(),
    estimatedPickupTime: joi_1.default.date().optional(),
    estimatedDeliveryTime: joi_1.default.date().optional(),
    specialInstructions: joi_1.default.string().optional(),
});
exports.updateTrackingValidation = joi_1.default.object({
    latitude: joi_1.default.number().required(),
    longitude: joi_1.default.number().required(),
    heading: joi_1.default.number().optional(),
    status: joi_1.default.string().optional(),
    message: joi_1.default.string().optional(),
});
