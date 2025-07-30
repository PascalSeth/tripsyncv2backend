import type { Response } from "express"
import prisma from "../config/database"
import { RBACService } from "../services/rbac.service"
import { NotificationService } from "../services/notification.service"
import { EmailService } from "../services/email.service"
import logger from "../utils/logger"
import bcrypt from "bcryptjs"
import speakeasy from "speakeasy"
import qrcode from "qrcode"
import { NotificationType, PriorityLevel } from "@prisma/client"
import type { AuthenticatedRequest } from "../types"

export class UserController {
  private rbacService = new RBACService()
  private notificationService = new NotificationService()
  private emailService = new EmailService()

  // Get user profile by authenticated user ID
  getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phone: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          avatar: true,
          gender: true,
          dateOfBirth: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          isCommissionCurrent: true,
          twoFactorEnabled: true, // Include 2FA status
        },
      })

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        })
      }

      const permissions = await this.rbacService.getUserPermissions(user.role)

      res.json({
        success: true,
        message: "Profile retrieved successfully",
        data: {
          user: {
            ...user,
            permissions,
          },
        },
      })
    } catch (error) {
      logger.error("Get profile error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve profile",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Update user profile (name, gender, dateOfBirth, avatar, phone)
  updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const { firstName, lastName, gender, dateOfBirth, avatar, phone } = req.body

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          gender: gender || undefined,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          avatar: avatar || undefined,
          phone: phone || undefined,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          gender: true,
          dateOfBirth: true,
          avatar: true,
        },
      })

      res.json({
        success: true,
        message: "Profile updated successfully",
        data: { user },
      })
    } catch (error) {
      logger.error("Update profile error:", error)
      res.status(500).json({
        success: false,
        message: "Profile update failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Update user email
  updateEmail = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const { newEmail, currentPassword } = req.body

      const user = await prisma.user.findUnique({ where: { id: userId } })

      if (!user || !user.passwordHash) {
        return res.status(404).json({ success: false, message: "User not found" })
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Invalid current password" })
      }

      const existingUserWithNewEmail = await prisma.user.findUnique({ where: { email: newEmail } })
      if (existingUserWithNewEmail && existingUserWithNewEmail.id !== userId) {
        return res.status(400).json({ success: false, message: "Email already in use by another account" })
      }

      await prisma.user.update({
        where: { id: userId },
        data: { email: newEmail },
      })

      await this.notificationService.notifyCustomer(userId, {
        type: NotificationType.ACCOUNT_UPDATE,
        title: "Email Updated",
        body: `Your email has been successfully changed to ${newEmail}.`,
        priority: PriorityLevel.STANDARD,
      })

      await this.emailService.sendNotificationEmail(user.email, newEmail, user.firstName || "User")

      res.json({ success: true, message: "Email updated successfully" })
    } catch (error) {
      logger.error("Update email error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update email",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Update user phone number
  updatePhoneNumber = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const { newPhone, currentPassword } = req.body

      const user = await prisma.user.findUnique({ where: { id: userId } })

      if (!user || !user.passwordHash) {
        return res.status(404).json({ success: false, message: "User not found" })
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Invalid current password" })
      }

      const existingUserWithNewPhone = await prisma.user.findFirst({ where: { phone: newPhone } })
      if (existingUserWithNewPhone && existingUserWithNewPhone.id !== userId) {
        return res.status(400).json({ success: false, message: "Phone number already in use by another account" })
      }

      await prisma.user.update({
        where: { id: userId },
        data: { phone: newPhone },
      })

      await this.notificationService.notifyCustomer(userId, {
        type: NotificationType.ACCOUNT_UPDATE,
        title: "Phone Number Updated",
        body: `Your phone number has been successfully changed to ${newPhone}.`,
        priority: PriorityLevel.STANDARD,
      })

      // In a real app, you might send an OTP to the new phone number for verification
      // await this.smsService.sendOtp(newPhone, 'Your new phone number has been updated.');

      res.json({ success: true, message: "Phone number updated successfully" })
    } catch (error) {
      logger.error("Update phone number error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update phone number",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Change user password
  changePassword = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const { currentPassword, newPassword } = req.body

      const user = await prisma.user.findUnique({ where: { id: userId } })

      if (!user || !user.passwordHash) {
        return res.status(404).json({ success: false, message: "User not found" })
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: "Invalid current password" })
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10)

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      })

      await this.notificationService.notifyCustomer(userId, {
        type: NotificationType.ACCOUNT_UPDATE,
        title: "Password Changed",
        body: "Your password has been successfully changed.",
        priority: PriorityLevel.STANDARD,
      })

      res.json({ success: true, message: "Password changed successfully" })
    } catch (error) {
      logger.error("Change password error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to change password",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Enable Two-Factor Authentication (2FA)
  enableTwoFactorAuth = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" })
      }

      if (user.twoFactorEnabled) {
        return res.status(400).json({ success: false, message: "Two-factor authentication is already enabled" })
      }

      const secret = speakeasy.generateSecret({
        length: 20,
        name: `TripSync (${user.email})`,
        issuer: "TripSync",
      })

      // Store the secret temporarily until verified
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret.base32 },
      })

      const otpauthUrl = secret.otpauth_url
      if (!otpauthUrl) {
        throw new Error("Failed to generate OTPAuth URL")
      }

      const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl)

      res.json({
        success: true,
        message: "Scan QR code to enable 2FA. Verify with a token.",
        data: {
          secret: secret.base32,
          otpauthUrl: otpauthUrl,
          qrCodeDataUrl: qrCodeDataUrl,
        },
      })
    } catch (error) {
      logger.error("Enable 2FA error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to enable 2FA",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Verify 2FA setup
  verifyTwoFactorAuthSetup = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const { token } = req.body

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ success: false, message: "2FA setup not initiated or secret missing" })
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: token,
        window: 1, // Allow a 30-second window (1 step before or after current)
      })

      if (verified) {
        await prisma.user.update({
          where: { id: userId },
          data: { twoFactorEnabled: true },
        })

        await this.notificationService.notifyCustomer(userId, {
          type: NotificationType.SECURITY_ALERT,
          title: "2FA Enabled",
          body: "Two-factor authentication has been successfully enabled on your account.",
          priority: PriorityLevel.STANDARD,
        })

        res.json({ success: true, message: "Two-factor authentication enabled successfully" })
      } else {
        res.status(400).json({ success: false, message: "Invalid 2FA token" })
      }
    } catch (error) {
      logger.error("Verify 2FA setup error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to verify 2FA setup",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Disable Two-Factor Authentication (2FA)
  disableTwoFactorAuth = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const { token } = req.body

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
        return res.status(400).json({ success: false, message: "Two-factor authentication is not enabled" })
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: token,
        window: 1,
      })

      if (verified) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            twoFactorEnabled: false,
            twoFactorSecret: null, // Clear the secret
          },
        })

        await this.notificationService.notifyCustomer(userId, {
          type: NotificationType.SECURITY_ALERT,
          title: "2FA Disabled",
          body: "Two-factor authentication has been successfully disabled on your account.",
          priority: PriorityLevel.CRITICAL,
        })

        res.json({ success: true, message: "Two-factor authentication disabled successfully" })
      } else {
        res.status(400).json({ success: false, message: "Invalid 2FA token" })
      }
    } catch (error) {
      logger.error("Disable 2FA error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to disable 2FA",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
