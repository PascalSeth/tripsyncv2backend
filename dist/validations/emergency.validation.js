"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emergencyValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.emergencyValidation = {
    createEmergencyBooking: joi_1.default.object({
        body: joi_1.default.object({
            emergencyType: joi_1.default.string()
                .valid("MEDICAL", "FIRE", "POLICE", "RESCUE", "SECURITY", "ROADSIDE_ASSISTANCE", "OTHER")
                .required(),
            latitude: joi_1.default.number().required(),
            longitude: joi_1.default.number().required(),
            description: joi_1.default.string().required(),
            severity: joi_1.default.string().valid("LOW", "MEDIUM", "HIGH", "CRITICAL").required(),
            contactPhone: joi_1.default.string().required(),
            additionalInfo: joi_1.default.object().optional(),
        }),
    }),
    updateEmergencyStatus: joi_1.default.object({
        body: joi_1.default.object({
            status: joi_1.default.string().valid("PENDING", "DRIVER_ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED").required(),
            notes: joi_1.default.string().optional(),
            estimatedArrival: joi_1.default.date().optional(),
        }),
    }),
    completeEmergencyCall: joi_1.default.object({
        body: joi_1.default.object({
            resolution: joi_1.default.string().required(),
            notes: joi_1.default.string().optional(),
            followUpRequired: joi_1.default.boolean().required(),
        }),
    }),
    onboardEmergencyResponder: joi_1.default.object({
        body: joi_1.default.object({
            serviceType: joi_1.default.string()
                .valid("MEDICAL", "FIRE", "POLICE", "RESCUE", "SECURITY", "ROADSIDE_ASSISTANCE", "OTHER")
                .required(),
            badgeNumber: joi_1.default.string().optional(),
            department: joi_1.default.string().optional(),
            rank: joi_1.default.string().optional(),
            responseRadius: joi_1.default.number().optional(),
            certifications: joi_1.default.array().items(joi_1.default.string()).optional(),
            emergencyContacts: joi_1.default.array()
                .items(joi_1.default.object({
                name: joi_1.default.string().required(),
                phone: joi_1.default.string().required(),
                relationship: joi_1.default.string().required(),
            }))
                .optional(),
        }),
    }),
    updateResponderProfile: joi_1.default.object({
        body: joi_1.default.object({
            department: joi_1.default.string().optional(),
            rank: joi_1.default.string().optional(),
            responseRadius: joi_1.default.number().optional(),
            certifications: joi_1.default.array().items(joi_1.default.string()).optional(),
            emergencyContacts: joi_1.default.array()
                .items(joi_1.default.object({
                name: joi_1.default.string().required(),
                phone: joi_1.default.string().required(),
                relationship: joi_1.default.string().required(),
            }))
                .optional(),
        }),
    }),
    updateResponderLocation: joi_1.default.object({
        body: joi_1.default.object({
            latitude: joi_1.default.number().required(),
            longitude: joi_1.default.number().required(),
            isOnDuty: joi_1.default.boolean().required(),
        }),
    }),
    addEmergencyContact: joi_1.default.object({
        body: joi_1.default.object({
            name: joi_1.default.string().required(),
            phone: joi_1.default.string().required(),
            email: joi_1.default.string().email().optional(),
            relationship: joi_1.default.string().required(),
        }),
    }),
    shareLocation: joi_1.default.object({
        body: joi_1.default.object({
            latitude: joi_1.default.number().required(),
            longitude: joi_1.default.number().required(),
            accuracy: joi_1.default.number().optional(),
            address: joi_1.default.string().optional(),
            isRealTime: joi_1.default.boolean().optional(),
            bookingId: joi_1.default.string().optional(),
        }),
    }),
    stopLocationSharing: joi_1.default.object({
        body: joi_1.default.object({
            bookingId: joi_1.default.string().optional(),
        }),
    }),
    trackUserLocation: joi_1.default.object({
        body: joi_1.default.object({
            latitude: joi_1.default.number().required(),
            longitude: joi_1.default.number().required(),
            accuracy: joi_1.default.number().optional(),
            heading: joi_1.default.number().optional(),
            speed: joi_1.default.number().optional(),
            bookingId: joi_1.default.string().optional(),
        }),
    }),
};
