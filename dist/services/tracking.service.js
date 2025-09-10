"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingService = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
class TrackingService {
    async startTracking(bookingId, providerId) {
        try {
            await database_1.default.trackingUpdate.create({
                data: {
                    bookingId,
                    latitude: 0, // Default values, will be updated with actual location
                    longitude: 0,
                    status: "TRACKING_STARTED",
                    message: "Tracking started",
                    timestamp: new Date(),
                },
            });
            logger_1.default.info(`Tracking started for booking ${bookingId} by provider ${providerId}`);
        }
        catch (error) {
            logger_1.default.error("Start tracking error:", error);
            throw error;
        }
    }
    async addTrackingUpdate(bookingId, updateData) {
        try {
            const trackingUpdate = await database_1.default.trackingUpdate.create({
                data: {
                    bookingId,
                    latitude: updateData.latitude || 0,
                    longitude: updateData.longitude || 0,
                    status: updateData.status || "LOCATION_UPDATE",
                    message: updateData.message || "Location updated",
                    timestamp: new Date(),
                },
            });
            return trackingUpdate;
        }
        catch (error) {
            logger_1.default.error("Add tracking update error:", error);
            throw error;
        }
    }
    async getTrackingHistory(bookingId) {
        try {
            const trackingUpdates = await database_1.default.trackingUpdate.findMany({
                where: { bookingId },
                orderBy: { timestamp: "desc" },
            });
            return trackingUpdates;
        }
        catch (error) {
            logger_1.default.error("Get tracking history error:", error);
            throw error;
        }
    }
}
exports.TrackingService = TrackingService;
