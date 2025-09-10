"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.driverValidation = {
    onboard: joi_1.default.object({
        // Personal Information
        email: joi_1.default.string().email().required(),
        phone: joi_1.default.string().required(),
        firstName: joi_1.default.string().required(),
        lastName: joi_1.default.string().required(),
        password: joi_1.default.string().min(6).required(),
        confirmPassword: joi_1.default.string().required(),
        gender: joi_1.default.string().valid("MALE", "FEMALE").optional(),
        dateOfBirth: joi_1.default.date().optional(),
        // Driver License Information
        licenseNumber: joi_1.default.string().required(),
        licenseExpiry: joi_1.default.date().greater("now").required(),
        licenseClass: joi_1.default.string().required(),
        driverType: joi_1.default.string().valid("REGULAR", "TAXI", "DISPATCH_RIDER").required(),
        // Taxi-specific fields (optional for routing)
        taxiLicenseNumber: joi_1.default.string().optional(),
        taxiLicenseExpiry: joi_1.default.date().optional(),
        taxiPermitNumber: joi_1.default.string().optional(),
        taxiPermitExpiry: joi_1.default.date().optional(),
        taxiZone: joi_1.default.string().optional(),
        meterNumber: joi_1.default.string().optional(),
        // Operating hours for taxi drivers
        operatingHours: joi_1.default.object({
            monday: joi_1.default.object({
                isActive: joi_1.default.boolean().optional(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            tuesday: joi_1.default.object({
                isActive: joi_1.default.boolean().optional(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            wednesday: joi_1.default.object({
                isActive: joi_1.default.boolean().optional(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            thursday: joi_1.default.object({
                isActive: joi_1.default.boolean().optional(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            friday: joi_1.default.object({
                isActive: joi_1.default.boolean().optional(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            saturday: joi_1.default.object({
                isActive: joi_1.default.boolean().optional(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
            sunday: joi_1.default.object({
                isActive: joi_1.default.boolean().optional(),
                startTime: joi_1.default.string().optional(),
                endTime: joi_1.default.string().optional(),
            }).optional(),
        }).optional(),
        // Vehicle Information
        vehicleInfo: joi_1.default.object({
            make: joi_1.default.string().required(),
            model: joi_1.default.string().required(),
            year: joi_1.default.string().required(),
            licensePlate: joi_1.default.string().required(),
            color: joi_1.default.string().required(),
            type: joi_1.default.string().valid("SEDAN", "SUV", "HATCHBACK", "MOTORCYCLE", "VAN", "PICKUP", "CAR").required(),
        }).required(),
        // Location Information
        currentLatitude: joi_1.default.number().min(-90).max(90).required(),
        currentLongitude: joi_1.default.number().min(-180).max(180).required(),
        // Service Zones
        preferredServiceZones: joi_1.default.array().items(joi_1.default.string()).optional(),
        // Preferences
        acceptsSharedRides: joi_1.default.boolean().default(true),
        acceptsCash: joi_1.default.boolean().default(true),
        maxRideDistance: joi_1.default.number().min(1).max(500).optional(),
        isAvailableForDayBooking: joi_1.default.boolean().default(false),
        canAcceptInterRegional: joi_1.default.boolean().default(false),
        // Optional fields for existing users
        bankDetails: joi_1.default.object({
            bankName: joi_1.default.string().required(),
            accountNumber: joi_1.default.string().required(),
            accountName: joi_1.default.string().required(),
        }).optional(),
        emergencyContact: joi_1.default.object({
            name: joi_1.default.string().required(),
            phone: joi_1.default.string().required(),
            relationship: joi_1.default.string().required(),
        }).optional(),
    }),
    setupDayBooking: joi_1.default.object({
        isAvailable: joi_1.default.boolean().required(),
        hourlyRate: joi_1.default.number().min(500).max(10000).required(),
        minimumHours: joi_1.default.number().min(2).max(8).default(4),
        maximumHours: joi_1.default.number().min(8).max(24).default(12),
        serviceAreas: joi_1.default.array().items(joi_1.default.string()).required(),
        availableDays: joi_1.default.array().items(joi_1.default.number().min(0).max(6)).required(),
        availableTimeSlots: joi_1.default.array()
            .items(joi_1.default.object({
            start: joi_1.default.string()
                .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
                .required(),
            end: joi_1.default.string()
                .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
                .required(),
        }))
            .required(),
        specialRequirements: joi_1.default.string().max(500).optional(),
        vehicleFeatures: joi_1.default.array().items(joi_1.default.string()).optional(),
    }),
    updateDayBookingAvailability: joi_1.default.object({
        date: joi_1.default.date().min("now").required(),
        timeSlots: joi_1.default.array()
            .items(joi_1.default.object({
            start: joi_1.default.string()
                .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
                .required(),
            end: joi_1.default.string()
                .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
                .required(),
            isAvailable: joi_1.default.boolean().required(),
        }))
            .required(),
        isAvailable: joi_1.default.boolean().required(),
    }),
    updateDayBookingPricing: joi_1.default.object({
        hourlyRate: joi_1.default.number().min(500).max(10000).required(),
        minimumHours: joi_1.default.number().min(2).max(8).optional(),
        maximumHours: joi_1.default.number().min(8).max(24).optional(),
        surgeMultiplier: joi_1.default.number().min(1).max(3).optional(),
    }),
    updateAvailability: joi_1.default.object({
        isAvailable: joi_1.default.boolean().required(),
        isOnline: joi_1.default.boolean().required(),
        currentLatitude: joi_1.default.number().min(-90).max(90).optional(),
        currentLongitude: joi_1.default.number().min(-180).max(180).optional(),
    }),
    updateLocation: joi_1.default.object({
        latitude: joi_1.default.number().min(-90).max(90).required(),
        longitude: joi_1.default.number().min(-180).max(180).required(),
        heading: joi_1.default.number().min(0).max(360).optional(),
        speed: joi_1.default.number().min(0).optional(),
    }),
    rejectBooking: joi_1.default.object({
        reason: joi_1.default.string().max(200).optional(),
    }),
    completeTrip: joi_1.default.object({
        actualDistance: joi_1.default.number().min(0).optional(),
        actualDuration: joi_1.default.number().min(0).optional(),
        finalPrice: joi_1.default.number().min(0).optional(),
        endLatitude: joi_1.default.number().min(-90).max(90).optional(),
        endLongitude: joi_1.default.number().min(-180).max(180).optional(),
    }),
    getBookings: joi_1.default.object({
        status: joi_1.default.string()
            .valid("PENDING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED")
            .optional(),
        page: joi_1.default.number().min(1).default(1),
        limit: joi_1.default.number().min(1).max(50).default(10),
        dateFrom: joi_1.default.date().optional(),
        dateTo: joi_1.default.date().optional(),
    }),
    getEarnings: joi_1.default.object({
        period: joi_1.default.string().valid("today", "week", "month", "custom").default("week"),
        startDate: joi_1.default.date().optional(),
        endDate: joi_1.default.date().optional(),
    }),
    addVehicle: joi_1.default.object({
        make: joi_1.default.string().required(),
        model: joi_1.default.string().required(),
        year: joi_1.default.number()
            .min(2000)
            .max(new Date().getFullYear() + 1)
            .required(),
        color: joi_1.default.string().required(),
        licensePlate: joi_1.default.string().required(),
        type: joi_1.default.string().valid("SEDAN", "SUV", "HATCHBACK", "MOTORCYCLE", "VAN", "PICKUP", "CAR", "TRUCK").required(),
        category: joi_1.default.string().valid("ECONOMY", "COMFORT", "PREMIUM", "SUV").required(),
        capacity: joi_1.default.number().min(1).max(50).default(4),
        fuelType: joi_1.default.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID").default("GASOLINE"),
        transmission: joi_1.default.string().valid("MANUAL", "AUTOMATIC").default("AUTOMATIC"),
        hasAC: joi_1.default.boolean().default(true),
        hasWifi: joi_1.default.boolean().default(false),
        hasCharger: joi_1.default.boolean().default(false),
        isAccessible: joi_1.default.boolean().default(false),
    }),
    updateVehicle: joi_1.default.object({
        make: joi_1.default.string().optional(),
        model: joi_1.default.string().optional(),
        year: joi_1.default.number()
            .min(2000)
            .max(new Date().getFullYear() + 1)
            .optional(),
        color: joi_1.default.string().optional(),
        type: joi_1.default.string().valid("SEDAN", "SUV", "HATCHBACK", "MOTORCYCLE", "VAN", "PICKUP", "CAR", "TRUCK").optional(),
        category: joi_1.default.string().valid("ECONOMY", "COMFORT", "PREMIUM", "SUV").optional(),
        capacity: joi_1.default.number().min(1).max(50).optional(),
        fuelType: joi_1.default.string().valid("GASOLINE", "DIESEL", "ELECTRIC", "HYBRID").optional(),
        transmission: joi_1.default.string().valid("MANUAL", "AUTOMATIC").optional(),
        hasAC: joi_1.default.boolean().optional(),
        hasWifi: joi_1.default.boolean().optional(),
        hasCharger: joi_1.default.boolean().optional(),
        isAccessible: joi_1.default.boolean().optional(),
        isActive: joi_1.default.boolean().optional(),
    }),
    uploadDocument: joi_1.default.object({
        documentType: joi_1.default.string()
            .valid("DRIVERS_LICENSE", "VEHICLE_REGISTRATION", "INSURANCE_CERTIFICATE", "VEHICLE_INSPECTION")
            .required(),
        documentNumber: joi_1.default.string().optional(),
        expiryDate: joi_1.default.date().greater("now").optional(),
    }),
    updateProfile: joi_1.default.object({
        acceptsSharedRides: joi_1.default.boolean().optional(),
        acceptsCash: joi_1.default.boolean().optional(),
        maxRideDistance: joi_1.default.number().min(1).max(100).optional(),
        preferredPayoutMethod: joi_1.default.string().valid("BANK_TRANSFER", "MOBILE_MONEY").optional(),
        payoutSchedule: joi_1.default.string().valid("DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY").optional(),
        minimumPayoutAmount: joi_1.default.number().min(100).max(10000).optional(),
    }),
};
