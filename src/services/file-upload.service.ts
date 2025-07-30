import { supabase } from "../config/supabase"
import { v4 as uuidv4 } from "uuid"
import logger from "../utils/logger"
import type { Express } from "express"

export class FileUploadService {
  /**
   * Upload document to Supabase storage
   */
  async uploadDocument(file: Express.Multer.File, folder: string): Promise<string> {
    try {
      const fileExtension = file.originalname.split(".").pop()
      const fileName = `${uuidv4()}.${fileExtension}`
      const filePath = `${folder}/${fileName}`

      const { data, error } = await supabase.storage.from("documents").upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      })

      if (error) {
        throw new Error(`Upload failed: ${error.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(filePath)

      return urlData.publicUrl
    } catch (error) {
      logger.error("Upload document error:", error)
      throw error
    }
  }

  /**
   * Upload and optimize image
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    options?: { width?: number; height?: number },
  ): Promise<string> {
    try {
      const processedBuffer = file.buffer

      // For now, just use the original buffer without sharp processing
      // You can add sharp processing later when the package is available

      const fileExtension = file.mimetype.startsWith("image/") ? "jpg" : file.originalname.split(".").pop()
      const fileName = `${uuidv4()}.${fileExtension}`
      const filePath = `${folder}/${fileName}`

      const { data, error } = await supabase.storage.from("images").upload(filePath, processedBuffer, {
        contentType: file.mimetype.startsWith("image/") ? "image/jpeg" : file.mimetype,
        upsert: false,
      })

      if (error) {
        throw new Error(`Upload failed: ${error.message}`)
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from("images").getPublicUrl(filePath)

      return urlData.publicUrl
    } catch (error) {
      logger.error("Upload image error:", error)
      throw error
    }
  }

  /**
   * Upload avatar image
   */
  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<string> {
    return this.uploadImage(file, `avatars/${userId}`, { width: 300, height: 300 })
  }

  /**
   * Upload vehicle photo
   */
  async uploadVehiclePhoto(file: Express.Multer.File, vehicleId: string): Promise<string> {
    return this.uploadImage(file, `vehicles/${vehicleId}`, { width: 800, height: 600 })
  }

  /**
   * Delete file from storage
   */
  async deleteFile(bucket: string, filePath: string): Promise<void> {
    try {
      const { error } = await supabase.storage.from(bucket).remove([filePath])

      if (error) {
        throw new Error(`Delete failed: ${error.message}`)
      }
    } catch (error) {
      logger.error("Delete file error:", error)
      throw error
    }
  }
}
