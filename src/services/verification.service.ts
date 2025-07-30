import prisma from "../config/database"
import { NotificationService } from "./notification.service"
import { FileUploadService } from "./file-upload.service"
import logger from "../utils/logger"
import { DocumentType } from "@prisma/client"

interface VerificationDocument {
  id: string
  type: "NATIONAL_ID" | "DRIVER_LICENSE" | "VEHICLE_REGISTRATION" | "INSURANCE" | "BACKGROUND_CHECK"
  frontImageUrl?: string
  backImageUrl?: string
  documentNumber: string
  expiryDate?: Date
  status: "PENDING" | "APPROVED" | "REJECTED"
  rejectionReason?: string
}

interface FileUpload {
  buffer: Buffer
  originalname: string
  mimetype: string
}

export class VerificationService {
  private notificationService = new NotificationService()
  private fileUploadService = new FileUploadService()

  async submitDocumentForVerification(
    userId: string,
    documentType: string,
    documentData: {
      documentNumber: string
      frontImage: Buffer
      backImage?: Buffer
      expiryDate?: Date
    },
  ): Promise<string> {
    try {
      // Upload images to Supabase storage
      const frontImageFile: FileUpload = {
        buffer: documentData.frontImage,
        originalname: `${documentType}_front_${Date.now()}.jpg`,
        mimetype: "image/jpeg",
      }

      const frontImageUrl = await this.fileUploadService.uploadDocument(frontImageFile as any, `documents/${userId}`)

      let backImageUrl: string | undefined
      if (documentData.backImage) {
        const backImageFile: FileUpload = {
          buffer: documentData.backImage,
          originalname: `${documentType}_back_${Date.now()}.jpg`,
          mimetype: "image/jpeg",
        }
        backImageUrl = await this.fileUploadService.uploadDocument(backImageFile as any, `documents/${userId}`)
      }

      // Get or create driver profile
      let driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        // Create basic driver profile if it doesn't exist - only include fields that exist in schema
        driverProfile = await prisma.driverProfile.create({
          data: {
            userId,
            licenseNumber: documentData.documentNumber,
            licenseExpiry: documentData.expiryDate || new Date(),
            licenseClass: "B",
            isAvailable: false,
            isOnline: false,
            rating: 0,
            totalRides: 0,
            totalEarnings: 0,
            // Remove completionRate as it doesn't exist in schema
          },
        })
      }

      // Create document record with proper DocumentType enum
      const document = await prisma.driverDocument.create({
        data: {
          driverProfileId: driverProfile.id,
          type: documentType as DocumentType,
          documentNumber: documentData.documentNumber || "",
          documentUrl: frontImageUrl,
          expiryDate: documentData.expiryDate,
          status: "PENDING",
        },
      })

      // Notify user
      await this.notificationService.notifyCustomer(userId, {
        type: "DOCUMENT_SUBMITTED",
        title: "Document Submitted",
        body: `Your ${documentType} has been submitted for verification. We'll review it within 24 hours.`,
        data: { documentId: document.id, documentType },
        priority: "STANDARD",
      })

      logger.info(`Document ${documentType} submitted for user ${userId}`)
      return document.id
    } catch (error) {
      logger.error("Submit document for verification error:", error)
      throw error
    }
  }

  async reviewDocument(
    documentId: string,
    adminId: string,
    decision: "APPROVED" | "REJECTED",
    rejectionReason?: string,
  ): Promise<void> {
    try {
      const document = await prisma.driverDocument.findUnique({
        where: { id: documentId },
      })

      if (!document) {
        throw new Error("Document not found")
      }

      // Get driver profile and user
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { id: document.driverProfileId },
        include: { user: true },
      })

      if (!driverProfile) {
        throw new Error("Driver profile not found")
      }

      // Update document status
      await prisma.driverDocument.update({
        where: { id: documentId },
        data: {
          status: decision,
          verifiedAt: decision === "APPROVED" ? new Date() : null,
          verifiedBy: decision === "APPROVED" ? adminId : null,
          rejectionReason: decision === "REJECTED" ? rejectionReason : null,
        },
      })

      // Check if user is fully verified
      if (decision === "APPROVED") {
        await this.checkUserVerificationStatus(driverProfile.userId)
      }

      // Send notification
      const notificationType = decision === "APPROVED" ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED"
      const title = decision === "APPROVED" ? "Document Approved" : "Document Rejected"
      const body =
        decision === "APPROVED"
          ? `Your ${document.type} has been approved.`
          : `Your ${document.type} was rejected. Reason: ${rejectionReason}`

      await this.notificationService.notifyCustomer(driverProfile.userId, {
        type: notificationType,
        title,
        body,
        data: { documentId, documentType: document.type },
        priority: decision === "REJECTED" ? "URGENT" : "STANDARD",
      })

      logger.info(`Document ${documentId} ${decision.toLowerCase()} by admin ${adminId}`)
    } catch (error) {
      logger.error("Review document error:", error)
      throw error
    }
  }

  async getUserDocuments(userId: string): Promise<VerificationDocument[]> {
    try {
      // Get driver profile first
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        return []
      }

      const documents = await prisma.driverDocument.findMany({
        where: { driverProfileId: driverProfile.id },
        // Remove updatedAt from orderBy as it doesn't exist in schema
        orderBy: { verifiedAt: "desc" },
      })

      return documents.map((doc) => ({
        id: doc.id,
        type: doc.type as any,
        frontImageUrl: doc.documentUrl,
        backImageUrl: undefined, // Schema doesn't have backImageUrl
        documentNumber: doc.documentNumber || "",
        expiryDate: doc.expiryDate || undefined,
        status: doc.status as any,
        rejectionReason: doc.rejectionReason || undefined,
      }))
    } catch (error) {
      logger.error("Get user documents error:", error)
      throw error
    }
  }

  async getPendingVerifications(page = 1, limit = 20): Promise<any> {
    try {
      const skip = (page - 1) * limit

      const [documents, total] = await Promise.all([
        prisma.driverDocument.findMany({
          where: { status: "PENDING" },
          // Remove updatedAt from orderBy as it doesn't exist in schema
          orderBy: { verifiedAt: "asc" },
          skip,
          take: limit,
        }),
        prisma.driverDocument.count({ where: { status: "PENDING" } }),
      ])

      // Get driver profiles and users for each document
      const tasksWithUsers = await Promise.all(
        documents.map(async (doc) => {
          const driverProfile = await prisma.driverProfile.findUnique({
            where: { id: doc.driverProfileId },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          })

          return {
            id: doc.id,
            userId: driverProfile?.userId || "",
            user: driverProfile?.user || null,
            document: doc,
            // Use verifiedAt instead of updatedAt/createdAt since they don't exist
            createdAt: doc.verifiedAt || new Date(),
            status: "PENDING",
          }
        }),
      )

      return {
        tasks: tasksWithUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    } catch (error) {
      logger.error("Get pending verifications error:", error)
      throw error
    }
  }

  private async checkUserVerificationStatus(userId: string): Promise<void> {
    try {
      // Get driver profile
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        return
      }

      // Get all documents for this driver
      const documents = await prisma.driverDocument.findMany({
        where: { driverProfileId: driverProfile.id },
      })

      // Check if user has all required documents approved
      const requiredDocs: DocumentType[] = ["IDENTITY_DOCUMENT"]
      const approvedDocs = documents.filter((doc) => doc.status === "APPROVED").map((doc) => doc.type)

      const isFullyVerified = requiredDocs.every((reqDoc) => approvedDocs.includes(reqDoc))

      if (isFullyVerified) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            isVerified: true,
          },
        })

        await this.notificationService.notifyCustomer(userId, {
          type: "ACCOUNT_VERIFIED",
          title: "Account Verified",
          body: "Congratulations! Your account has been fully verified. You now have access to all features.",
          priority: "STANDARD",
        })

        logger.info(`User ${userId} is now fully verified`)
      }
    } catch (error) {
      logger.error("Check user verification status error:", error)
    }
  }
}
