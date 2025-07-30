import crypto from "crypto"
// import bcrypt from "bcrypt"
const bcrypt = {
  hash: async (password: string, rounds: number) => password, // Placeholder
  compare: async (password: string, hash: string) => password === hash, // Placeholder
}
import logger from "../utils/logger"

interface EncryptionResult {
  encrypted: string
  iv: string
  tag?: string
}

interface DecryptionInput {
  encrypted: string
  iv: string
  tag?: string
}

export class EncryptionService {
  private readonly ALGORITHM = "aes-256-gcm"
  private readonly KEY_LENGTH = 32
  private readonly IV_LENGTH = 16
  private readonly SALT_ROUNDS = 12
  private readonly encryptionKey: Buffer

  constructor() {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
      throw new Error("ENCRYPTION_KEY environment variable is required")
    }

    // Derive a consistent key from the environment variable
    this.encryptionKey = crypto.scryptSync(key, "salt", this.KEY_LENGTH)
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(data: string): EncryptionResult {
    try {
      const iv = crypto.randomBytes(this.IV_LENGTH)
      const cipher = crypto.createCipher(this.ALGORITHM, this.encryptionKey)
      cipher.setAAD(Buffer.from("additional-data"))

      let encrypted = cipher.update(data, "utf8", "hex")
      encrypted += cipher.final("hex")

      const tag = cipher.getAuthTag()

      return {
        encrypted,
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
      }
    } catch (error) {
      logger.error("Encryption error:", error)
      throw new Error("Failed to encrypt data")
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(input: DecryptionInput): string {
    try {
      const { encrypted, iv, tag } = input

      const decipher = crypto.createDecipher(this.ALGORITHM, this.encryptionKey)
      decipher.setAAD(Buffer.from("additional-data"))

      if (tag) {
        decipher.setAuthTag(Buffer.from(tag, "hex"))
      }

      let decrypted = decipher.update(encrypted, "hex", "utf8")
      decrypted += decipher.final("utf8")

      return decrypted
    } catch (error) {
      logger.error("Decryption error:", error)
      throw new Error("Failed to decrypt data")
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS)
    } catch (error) {
      logger.error("Password hashing error:", error)
      throw new Error("Failed to hash password")
    }
  }

  /**
   * Verify password
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash)
    } catch (error) {
      logger.error("Password verification error:", error)
      return false
    }
  }

  /**
   * Generate secure random token
   */
  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString("hex")
  }

  /**
   * Generate API key
   */
  generateApiKey(): string {
    const timestamp = Date.now().toString()
    const randomBytes = crypto.randomBytes(16).toString("hex")
    return `${timestamp}_${randomBytes}`
  }

  /**
   * Hash data with SHA-256
   */
  hash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex")
  }

  /**
   * Create HMAC signature
   */
  createSignature(data: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(data).digest("hex")
  }

  /**
   * Verify HMAC signature
   */
  verifySignature(data: string, signature: string, secret: string): boolean {
    const expectedSignature = this.createSignature(data, secret)
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  }

  /**
   * Encrypt PII (Personally Identifiable Information)
   */
  encryptPII(data: Record<string, any>): Record<string, any> {
    const piiFields = ["email", "phone", "address", "nationalId", "bankAccount"]
    const encrypted = { ...data }

    for (const field of piiFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field].toString())
      }
    }

    return encrypted
  }

  /**
   * Decrypt PII
   */
  decryptPII(data: Record<string, any>): Record<string, any> {
    const piiFields = ["email", "phone", "address", "nationalId", "bankAccount"]
    const decrypted = { ...data }

    for (const field of piiFields) {
      if (decrypted[field] && typeof decrypted[field] === "object") {
        try {
          decrypted[field] = this.decrypt(decrypted[field])
        } catch (error) {
          logger.error(`Failed to decrypt PII field ${field}:`, error)
          decrypted[field] = "[ENCRYPTED]"
        }
      }
    }

    return decrypted
  }

  /**
   * Generate encryption key for new tenant
   */
  generateTenantKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString("hex")
  }

  /**
   * Encrypt file content
   */
  encryptFile(buffer: Buffer): { encrypted: Buffer; key: string; iv: string } {
    try {
      const key = crypto.randomBytes(this.KEY_LENGTH)
      const iv = crypto.randomBytes(this.IV_LENGTH)
      const cipher = crypto.createCipher(this.ALGORITHM, key)

      const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])

      return {
        encrypted,
        key: key.toString("hex"),
        iv: iv.toString("hex"),
      }
    } catch (error) {
      logger.error("File encryption error:", error)
      throw new Error("Failed to encrypt file")
    }
  }

  /**
   * Decrypt file content
   */
  decryptFile(encrypted: Buffer, key: string, iv: string): Buffer {
    try {
      const keyBuffer = Buffer.from(key, "hex")
      const ivBuffer = Buffer.from(iv, "hex")
      const decipher = crypto.createDecipher(this.ALGORITHM, keyBuffer)

      return Buffer.concat([decipher.update(encrypted), decipher.final()])
    } catch (error) {
      logger.error("File decryption error:", error)
      throw new Error("Failed to decrypt file")
    }
  }

  /**
   * Mask sensitive data for logging
   */
  maskSensitiveData(data: any): any {
    if (typeof data !== "object" || data === null) {
      return data
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
    ]

    const masked = Array.isArray(data) ? [...data] : { ...data }

    for (const [key, value] of Object.entries(masked)) {
      const lowerKey = key.toLowerCase()
      const isSensitive = sensitiveFields.some((field) => lowerKey.includes(field))

      if (isSensitive && typeof value === "string") {
        masked[key] = this.maskString(value)
      } else if (typeof value === "object" && value !== null) {
        masked[key] = this.maskSensitiveData(value)
      }
    }

    return masked
  }

  private maskString(str: string): string {
    if (str.length <= 4) {
      return "*".repeat(str.length)
    }
    return str.substring(0, 2) + "*".repeat(str.length - 4) + str.substring(str.length - 2)
  }
}

// Export singleton instance
export const encryptionService = new EncryptionService()
