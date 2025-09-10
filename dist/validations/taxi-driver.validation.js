"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taxiDriverValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.taxiDriverValidation = {
    onboard: joi_1.default.object({
        licenseNumber: joi_1.default.string().required().messages({
            "string.empty": "License number is required",
            "any.required": "License number is required",
        }),
        licenseExpiry: joi_1.default.string().required().messages({
            "string.empty": "License expiry date is required",
            "any.required": "License expiry date is required",
        }),
        licenseClass: joi_1.default.string().required().messages({
            "string.empty": "License class is required",
            "any.required": "License class is required",
        }),
        taxiLicenseNumber: joi_1.default.string().required().messages({
            "string.empty": "Taxi license number is required",
            "any.required": "Taxi license number is required",
        }),
        taxiLicenseExpiry: joi_1.default.string().required().messages({
            "string.empty": "Taxi license expiry date is required",
            "any.required": "Taxi license expiry date is required",
        }),
        taxiPermitNumber: joi_1.default.string().optional(),
        taxiPermitExpiry: joi_1.default.string().optional(),
        taxiZone: joi_1.default.string().optional(),
        meterNumber: joi_1.default.string().optional(),
        vehicleInfo: joi_1.default.object({
            make: joi_1.default.string().required().messages({
                "string.empty": "Vehicle make is required",
                "any.required": "Vehicle make is required",
            }),
            model: joi_1.default.string().required().messages({
                "string.empty": "Vehicle model is required",
                "any.required": "Vehicle model is required",
            }),
            year: joi_1.default.number().min(1900).max(new Date().getFullYear() + 1).required(),
            color: joi_1.default.string().required().messages({
                "string.empty": "Vehicle color is required",
                "any.required": "Vehicle color is required",
            }),
            licensePlate: joi_1.default.string().required().messages({
                "string.empty": "License plate is required",
                "any.required": "License plate is required",
            }),
            capacity: joi_1.default.number().min(1).max(8).default(4),
            fuelType: joi_1.default.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG").default("GASOLINE"),
            transmission: joi_1.default.string().valid("MANUAL", "AUTOMATIC", "CVT").default("AUTOMATIC"),
            hasAC: joi_1.default.boolean().default(true),
            hasWifi: joi_1.default.boolean().default(false),
            hasCharger: joi_1.default.boolean().default(false),
            isAccessible: joi_1.default.boolean().default(false),
            taxiMeterInstalled: joi_1.default.boolean().default(true),
            taxiTopLightInstalled: joi_1.default.boolean().default(true),
        }).optional(),
        bankDetails: joi_1.default.object({
            bankName: joi_1.default.string().optional(),
            accountNumber: joi_1.default.string().optional(),
            accountName: joi_1.default.string().optional(),
            bankCode: joi_1.default.string().optional(),
        }).optional(),
        emergencyContact: joi_1.default.object({
            name: joi_1.default.string().required().messages({
                "string.empty": "Emergency contact name is required",
                "any.required": "Emergency contact name is required",
            }),
            phone: joi_1.default.string().required().messages({
                "string.empty": "Emergency contact phone is required",
                "any.required": "Emergency contact phone is required",
            }),
            relationship: joi_1.default.string().required().messages({
                "string.empty": "Relationship is required",
                "any.required": "Relationship is required",
            }),
        }).optional(),
        operatingHours: joi_1.default.object({
            monday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            tuesday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            wednesday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            thursday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            friday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            saturday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            sunday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
        }).optional(),
    }),
    updateProfile: joi_1.default.object({
        taxiZone: joi_1.default.string().optional(),
        meterNumber: joi_1.default.string().optional(),
        insurancePolicyNumber: joi_1.default.string().optional(),
        insuranceExpiry: joi_1.default.string().optional(),
        acceptsCash: joi_1.default.boolean().optional(),
        acceptsCard: joi_1.default.boolean().optional(),
        maxRideDistance: joi_1.default.number().positive().optional(),
        preferredPayoutMethod: joi_1.default.string()
            .valid("BANK_TRANSFER", "MOBILE_MONEY", "PAYSTACK_TRANSFER", "CASH", "CHECK")
            .optional(),
        payoutSchedule: joi_1.default.string().valid("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "ON_DEMAND").optional(),
        minimumPayoutAmount: joi_1.default.number().positive().optional(),
    }),
    updateAvailability: joi_1.default.object({
        isAvailable: joi_1.default.boolean().required(),
        isOnline: joi_1.default.boolean().optional(),
        currentLatitude: joi_1.default.number().optional(),
        currentLongitude: joi_1.default.number().optional(),
    }),
    updateLocation: joi_1.default.object({
        latitude: joi_1.default.number().required(),
        longitude: joi_1.default.number().required(),
        heading: joi_1.default.number().optional(),
        speed: joi_1.default.number().optional(),
    }),
    updateOperatingHours: joi_1.default.object({
        operatingHours: joi_1.default.object({
            monday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            tuesday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            wednesday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            thursday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            friday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            saturday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            sunday: joi_1.default.object({
                isActive: joi_1.default.boolean().required(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
        }).required(),
    }),
    addVehicle: joi_1.default.object({
        make: joi_1.default.string().required().messages({
            "string.empty": "Vehicle make is required",
            "any.required": "Vehicle make is required",
        }),
        model: joi_1.default.string().required().messages({
            "string.empty": "Vehicle model is required",
            "any.required": "Vehicle model is required",
        }),
        year: joi_1.default.number().min(1900).max(new Date().getFullYear() + 1).required(),
        color: joi_1.default.string().required().messages({
            "string.empty": "Vehicle color is required",
            "any.required": "Vehicle color is required",
        }),
        licensePlate: joi_1.default.string().required().messages({
            "string.empty": "License plate is required",
            "any.required": "License plate is required",
        }),
        capacity: joi_1.default.number().min(1).max(8).default(4),
        fuelType: joi_1.default.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG").default("GASOLINE"),
        transmission: joi_1.default.string().valid("MANUAL", "AUTOMATIC", "CVT").default("AUTOMATIC"),
        hasAC: joi_1.default.boolean().default(true),
        hasWifi: joi_1.default.boolean().default(false),
        hasCharger: joi_1.default.boolean().default(false),
        isAccessible: joi_1.default.boolean().default(false),
        taxiMeterInstalled: joi_1.default.boolean().default(true),
        taxiTopLightInstalled: joi_1.default.boolean().default(true),
        registration: joi_1.default.string().optional(),
        insurance: joi_1.default.string().optional(),
        inspection: joi_1.default.string().optional(),
    }),
    updateVehicle: joi_1.default.object({
        make: joi_1.default.string().optional(),
        model: joi_1.default.string().optional(),
        year: joi_1.default.number().min(1900).max(new Date().getFullYear() + 1).optional(),
        color: joi_1.default.string().optional(),
        capacity: joi_1.default.number().min(1).max(8).optional(),
        fuelType: joi_1.default.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG").optional(),
        transmission: joi_1.default.string().valid("MANUAL", "AUTOMATIC", "CVT").optional(),
        hasAC: joi_1.default.boolean().optional(),
        hasWifi: joi_1.default.boolean().optional(),
        hasCharger: joi_1.default.boolean().optional(),
        isAccessible: joi_1.default.boolean().optional(),
        taxiMeterInstalled: joi_1.default.boolean().optional(),
        taxiTopLightInstalled: joi_1.default.boolean().optional(),
        registration: joi_1.default.string().optional(),
        insurance: joi_1.default.string().optional(),
        inspection: joi_1.default.string().optional(),
    }),
    uploadDocument: joi_1.default.object({
        documentType: joi_1.default.string()
            .valid("DRIVERS_LICENSE", "TAXI_LICENSE", "TAXI_PERMIT", "VEHICLE_REGISTRATION", "INSURANCE_CERTIFICATE", "VEHICLE_INSPECTION", "METER_CALIBRATION", "BACKGROUND_CHECK", "IDENTITY_DOCUMENT", "PROOF_OF_ADDRESS", "BANK_STATEMENT", "TAX_DOCUMENT", "TAXI_ZONE_PERMIT")
            .required(),
        documentNumber: joi_1.default.string().optional(),
        expiryDate: joi_1.default.string().optional(),
    }),
    rejectBooking: joi_1.default.object({
        reason: joi_1.default.string().optional(),
    }),
    completeTrip: joi_1.default.object({
        actualDistance: joi_1.default.number().positive().optional(),
        actualDuration: joi_1.default.number().positive().optional(),
        finalPrice: joi_1.default.number().positive().optional(),
        endLatitude: joi_1.default.number().optional(),
        endLongitude: joi_1.default.number().optional(),
        meterReading: joi_1.default.number().positive().optional(),
    }),
    getBookings: joi_1.default.object({
        status: joi_1.default.string()
            .valid("PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "FAILED")
            .optional(),
        page: joi_1.default.number().min(1).default(1),
        limit: joi_1.default.number().min(1).max(100).default(10),
        dateFrom: joi_1.default.string().optional(),
        dateTo: joi_1.default.string().optional(),
    }),
    getEarnings: joi_1.default.object({
        period: joi_1.default.string().valid("today", "week", "month", "custom").default("week"),
        startDate: joi_1.default.string().optional(),
        endDate: joi_1.default.string().optional(),
    }),
};
