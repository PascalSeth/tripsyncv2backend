"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadService = void 0;
const supabase_1 = require("../config/supabase");
const uuid_1 = require("uuid");
const logger_1 = __importDefault(require("../utils/logger"));
class FileUploadService {
    /**
     * Upload document to Supabase storage
     */
    async uploadDocument(file, folder) {
        try {
            const fileExtension = file.originalname.split(".").pop();
            const fileName = `${(0, uuid_1.v4)()}.${fileExtension}`;
            const filePath = `${folder}/${fileName}`;
            const { data, error } = await supabase_1.supabase.storage.from("documents").upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });
            if (error) {
                throw new Error(`Upload failed: ${error.message}`);
            }
            // Get public URL
            const { data: urlData } = supabase_1.supabase.storage.from("documents").getPublicUrl(filePath);
            return urlData.publicUrl;
        }
        catch (error) {
            logger_1.default.error("Upload document error:", error);
            throw error;
        }
    }
    /**
     * Upload and optimize image
     */
    async uploadImage(file, folder, options) {
        try {
            const processedBuffer = file.buffer;
            // For now, just use the original buffer without sharp processing
            // You can add sharp processing later when the package is available
            const fileExtension = file.mimetype.startsWith("image/") ? "jpg" : file.originalname.split(".").pop();
            const fileName = `${(0, uuid_1.v4)()}.${fileExtension}`;
            const filePath = `${folder}/${fileName}`;
            const { data, error } = await supabase_1.supabase.storage.from("images").upload(filePath, processedBuffer, {
                contentType: file.mimetype.startsWith("image/") ? "image/jpeg" : file.mimetype,
                upsert: false,
            });
            if (error) {
                throw new Error(`Upload failed: ${error.message}`);
            }
            // Get public URL
            const { data: urlData } = supabase_1.supabase.storage.from("images").getPublicUrl(filePath);
            return urlData.publicUrl;
        }
        catch (error) {
            logger_1.default.error("Upload image error:", error);
            throw error;
        }
    }
    /**
     * Upload avatar image
     */
    async uploadAvatar(file, userId) {
        return this.uploadImage(file, `avatars/${userId}`, { width: 300, height: 300 });
    }
    /**
     * Upload vehicle photo
     */
    async uploadVehiclePhoto(file, vehicleId) {
        return this.uploadImage(file, `vehicles/${vehicleId}`, { width: 800, height: 600 });
    }
    /**
     * Delete file from storage
     */
    async deleteFile(bucket, filePath) {
        try {
            const { error } = await supabase_1.supabase.storage.from(bucket).remove([filePath]);
            if (error) {
                throw new Error(`Delete failed: ${error.message}`);
            }
        }
        catch (error) {
            logger_1.default.error("Delete file error:", error);
            throw error;
        }
    }
}
exports.FileUploadService = FileUploadService;
