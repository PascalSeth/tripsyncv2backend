"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.movingValidation = void 0;
const joi_1 = __importDefault(require("joi"));
exports.movingValidation = {
    onboardMover: joi_1.default.object({
        body: joi_1.default.object({
            companyName: joi_1.default.string().required(),
            teamSize: joi_1.default.number().min(1).required(),
            hasEquipment: joi_1.default.boolean().required(),
            hourlyRate: joi_1.default.number().min(0).required(),
            maxWeight: joi_1.default.number().min(0).optional(),
            serviceRadius: joi_1.default.number().min(0).optional(),
            specializations: joi_1.default.array().items(joi_1.default.string()).optional(),
            equipment: joi_1.default.array().items(joi_1.default.string()).optional(),
            insurance: joi_1.default.object({
                provider: joi_1.default.string().required(),
                policyNumber: joi_1.default.string().required(),
                expiryDate: joi_1.default.date().required(),
            }).optional(),
            certifications: joi_1.default.array().items(joi_1.default.string()).optional(),
        }),
    }),
    updateMoverProfile: joi_1.default.object({
        body: joi_1.default.object({
            companyName: joi_1.default.string().optional(),
            teamSize: joi_1.default.number().min(1).optional(),
            hasEquipment: joi_1.default.boolean().optional(),
            hourlyRate: joi_1.default.number().min(0).optional(),
            maxWeight: joi_1.default.number().min(0).optional(),
            serviceRadius: joi_1.default.number().min(0).optional(),
            specializations: joi_1.default.array().items(joi_1.default.string()).optional(),
            equipment: joi_1.default.array().items(joi_1.default.string()).optional(),
        }),
    }),
    createMovingBooking: joi_1.default.object({
        body: joi_1.default.object({
            pickupAddress: joi_1.default.object({
                latitude: joi_1.default.number().required(),
                longitude: joi_1.default.number().required(),
                address: joi_1.default.string().required(),
                city: joi_1.default.string().optional(),
                state: joi_1.default.string().optional(),
            }).required(),
            dropoffAddress: joi_1.default.object({
                latitude: joi_1.default.number().required(),
                longitude: joi_1.default.number().required(),
                address: joi_1.default.string().required(),
                city: joi_1.default.string().optional(),
                state: joi_1.default.string().optional(),
            }).required(),
            scheduledDate: joi_1.default.date().required(),
            estimatedDuration: joi_1.default.number().min(1).required(),
            roomCount: joi_1.default.number().min(1).required(),
            hasHeavyItems: joi_1.default.boolean().required(),
            hasFragileItems: joi_1.default.boolean().required(),
            floorLevel: joi_1.default.number().min(0).required(),
            hasElevator: joi_1.default.boolean().required(),
            packingRequired: joi_1.default.boolean().optional(),
            storageRequired: joi_1.default.boolean().optional(),
            specialInstructions: joi_1.default.string().optional(),
            requiresDisassembly: joi_1.default.boolean().optional(),
        }),
    }),
    getMovingQuote: joi_1.default.object({
        body: joi_1.default.object({
            pickupAddress: joi_1.default.object({
                latitude: joi_1.default.number().required(),
                longitude: joi_1.default.number().required(),
            }).required(),
            dropoffAddress: joi_1.default.object({
                latitude: joi_1.default.number().required(),
                longitude: joi_1.default.number().required(),
            }).required(),
            scheduledDate: joi_1.default.date().required(),
            estimatedDuration: joi_1.default.number().min(1).required(),
            roomCount: joi_1.default.number().min(1).required(),
            hasHeavyItems: joi_1.default.boolean().required(),
            hasFragileItems: joi_1.default.boolean().required(),
            floorLevel: joi_1.default.number().min(0).required(),
            hasElevator: joi_1.default.boolean().required(),
            requiresDisassembly: joi_1.default.boolean().optional(),
        }),
    }),
    updateMoverAvailability: joi_1.default.object({
        body: joi_1.default.object({
            isAvailable: joi_1.default.boolean().required(),
            isOnline: joi_1.default.boolean().required(),
        }),
    }),
    startMovingJob: joi_1.default.object({
        body: joi_1.default.object({
            crewMembers: joi_1.default.array().items(joi_1.default.string()).optional(),
            equipmentUsed: joi_1.default.array().items(joi_1.default.string()).optional(),
        }),
    }),
    completeMovingJob: joi_1.default.object({
        body: joi_1.default.object({
            actualDuration: joi_1.default.number().min(0).optional(),
            finalPrice: joi_1.default.number().min(0).optional(),
            damageReport: joi_1.default.object({
                hasDamage: joi_1.default.boolean().required(),
                items: joi_1.default.array().items(joi_1.default.string()).optional(),
                photos: joi_1.default.array().items(joi_1.default.string()).optional(),
            }).optional(),
            customerSignature: joi_1.default.string().optional(),
            additionalServices: joi_1.default.array()
                .items(joi_1.default.object({
                service: joi_1.default.string().required(),
                cost: joi_1.default.number().min(0).required(),
            }))
                .optional(),
        }),
    }),
    suspendMover: joi_1.default.object({
        body: joi_1.default.object({
            reason: joi_1.default.string().required(),
        }),
    }),
};
