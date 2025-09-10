"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
// import bcrypt from "bcrypt"
const bcrypt = {
    hash: async (password, rounds) => password, // Placeholder
    compare: async (password, hash) => password === hash, // Placeholder
};
const logger_1 = __importDefault(require("../utils/logger"));
class EncryptionService {
    constructor() {
        this.ALGORITHM = "aes-256-gcm";
        this.KEY_LENGTH = 32;
        this.IV_LENGTH = 16;
        this.SALT_ROUNDS = 12;
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
            throw new Error("ENCRYPTION_KEY environment variable is required");
        }
        // Derive a consistent key from the environment variable
        this.encryptionKey = crypto_1.default.scryptSync(key, "salt", this.KEY_LENGTH);
    }
    /**
     * Encrypt sensitive data
     */
    encrypt(data) {
        try {
            const iv = crypto_1.default.randomBytes(this.IV_LENGTH);
            const cipher = crypto_1.default.createCipher(this.ALGORITHM, this.encryptionKey);
            cipher.setAAD(Buffer.from("additional-data"));
            let encrypted = cipher.update(data, "utf8", "hex");
            encrypted += cipher.final("hex");
            const tag = cipher.getAuthTag();
            return {
                encrypted,
                iv: iv.toString("hex"),
                tag: tag.toString("hex"),
            };
        }
        catch (error) {
            logger_1.default.error("Encryption error:", error);
            throw new Error("Failed to encrypt data");
        }
    }
    /**
     * Decrypt sensitive data
     */
    decrypt(input) {
        try {
            const { encrypted, iv, tag } = input;
            const decipher = crypto_1.default.createDecipher(this.ALGORITHM, this.encryptionKey);
            decipher.setAAD(Buffer.from("additional-data"));
            if (tag) {
                decipher.setAuthTag(Buffer.from(tag, "hex"));
            }
            let decrypted = decipher.update(encrypted, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        }
        catch (error) {
            logger_1.default.error("Decryption error:", error);
            throw new Error("Failed to decrypt data");
        }
    }
    /**
     * Hash password
     */
    async hashPassword(password) {
        try {
            return await bcrypt.hash(password, this.SALT_ROUNDS);
        }
        catch (error) {
            logger_1.default.error("Password hashing error:", error);
            throw new Error("Failed to hash password");
        }
    }
    /**
     * Verify password
     */
    async verifyPassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        }
        catch (error) {
            logger_1.default.error("Password verification error:", error);
            return false;
        }
    }
    /**
     * Generate secure random token
     */
    generateToken(length = 32) {
        return crypto_1.default.randomBytes(length).toString("hex");
    }
    /**
     * Generate API key
     */
    generateApiKey() {
        const timestamp = Date.now().toString();
        const randomBytes = crypto_1.default.randomBytes(16).toString("hex");
        return `${timestamp}_${randomBytes}`;
    }
    /**
     * Hash data with SHA-256
     */
    hash(data) {
        return crypto_1.default.createHash("sha256").update(data).digest("hex");
    }
    /**
     * Create HMAC signature
     */
    createSignature(data, secret) {
        return crypto_1.default.createHmac("sha256", secret).update(data).digest("hex");
    }
    /**
     * Verify HMAC signature
     */
    verifySignature(data, signature, secret) {
        const expectedSignature = this.createSignature(data, secret);
        return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    /**
     * Encrypt PII (Personally Identifiable Information)
     */
    encryptPII(data) {
        const piiFields = ["email", "phone", "address", "nationalId", "bankAccount"];
        const encrypted = { ...data };
        for (const field of piiFields) {
            if (encrypted[field]) {
                encrypted[field] = this.encrypt(encrypted[field].toString());
            }
        }
        return encrypted;
    }
    /**
     * Decrypt PII
     */
    decryptPII(data) {
        const piiFields = ["email", "phone", "address", "nationalId", "bankAccount"];
        const decrypted = { ...data };
        for (const field of piiFields) {
            if (decrypted[field] && typeof decrypted[field] === "object") {
                try {
                    decrypted[field] = this.decrypt(decrypted[field]);
                }
                catch (error) {
                    logger_1.default.error(`Failed to decrypt PII field ${field}:`, error);
                    decrypted[field] = "[ENCRYPTED]";
                }
            }
        }
        return decrypted;
    }
    /**
     * Generate encryption key for new tenant
     */
    generateTenantKey() {
        return crypto_1.default.randomBytes(this.KEY_LENGTH).toString("hex");
    }
    /**
     * Encrypt file content
     */
    encryptFile(buffer) {
        try {
            const key = crypto_1.default.randomBytes(this.KEY_LENGTH);
            const iv = crypto_1.default.randomBytes(this.IV_LENGTH);
            const cipher = crypto_1.default.createCipher(this.ALGORITHM, key);
            const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
            return {
                encrypted,
                key: key.toString("hex"),
                iv: iv.toString("hex"),
            };
        }
        catch (error) {
            logger_1.default.error("File encryption error:", error);
            throw new Error("Failed to encrypt file");
        }
    }
    /**
     * Decrypt file content
     */
    decryptFile(encrypted, key, iv) {
        try {
            const keyBuffer = Buffer.from(key, "hex");
            const ivBuffer = Buffer.from(iv, "hex");
            const decipher = crypto_1.default.createDecipher(this.ALGORITHM, keyBuffer);
            return Buffer.concat([decipher.update(encrypted), decipher.final()]);
        }
        catch (error) {
            logger_1.default.error("File decryption error:", error);
            throw new Error("Failed to decrypt file");
        }
    }
    /**
     * Mask sensitive data for logging
     */
    maskSensitiveData(data) {
        if (typeof data !== "object" || data === null) {
            return data;
        }
        const sensitiveFields = [
            "password",
            "token",
            "secret",
            "key",
            "phone",
            "email",
            "address",
            "nationalId",
            "bankAccount",
            "creditCard",
        ];
        const masked = Array.isArray(data) ? [...data] : { ...data };
        for (const [key, value] of Object.entries(masked)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveFields.some((field) => lowerKey.includes(field));
            if (isSensitive && typeof value === "string") {
                masked[key] = this.maskString(value);
            }
            else if (typeof value === "object" && value !== null) {
                masked[key] = this.maskSensitiveData(value);
            }
        }
        return masked;
    }
    maskString(str) {
        if (str.length <= 4) {
            return "*".repeat(str.length);
        }
        return str.substring(0, 2) + "*".repeat(str.length - 4) + str.substring(str.length - 2);
    }
}
exports.EncryptionService = EncryptionService;
// Export singleton instance
exports.encryptionService = new EncryptionService();
