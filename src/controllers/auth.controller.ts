import type { Request, Response } from "express"
import prisma from "../config/database"
import { RBACService } from "../services/rbac.service"
import { NotificationService } from "../services/notification.service"
import { EmailService } from "../services/email.service"
import logger from "../utils/logger"
import bcrypt from "bcryptjs"
import jwt, { type SignOptions, type Secret } from "jsonwebtoken"
import { NotificationType, PriorityLevel } from "@prisma/client"

const JWT_SECRET: Secret = process.env.JWT_SECRET || "your_super_secret_jwt_key"
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "1h"

export class AuthController {
  private rbacService = new RBACService()
  private notificationService = new NotificationService()
  private emailService = new EmailService()

  register = async (req: Request, res: Response) => {
    try {
      const { email, password, role = "USER", referralCode, firstName, lastName, phone } = req.body

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required for registration",
        })
      }

      // Check if user already exists with this email
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists with this email",
        })
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10)

      // Generate referral code
      const userReferralCode = this.generateReferralCode()

      // Handle referral
      let referredBy = null
      if (referralCode) {
        const referrer = await prisma.user.findUnique({
          where: { referralCode },
        })
        if (referrer) {
          referredBy = referrer.id
        }
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          phone: phone || "",
          firstName,
          lastName,
          role: role as any,
          referralCode: userReferralCode,
          referredBy,
          isActive: true,
          isVerified: true,
          subscriptionStatus: "ACTIVE",
          subscriptionTier: "BASIC",
          isCommissionCurrent: true,
        },
      })

      // Create role-specific profile
      await this.createUserProfile(user.id, role)

      // Generate JWT token
      const permissions = await this.rbacService.getUserPermissions(user.role)
      const token = jwt.sign({ userId: user.id, role: user.role, permissions }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      } as SignOptions)

      // Store session token
      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: token,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          isActive: true,
        },
      })

      // Send welcome notification
      await this.notificationService.notifyCustomer(user.id, {
        type: NotificationType.WELCOME,
        title: "Welcome to TripSync!",
        body: "Your account has been created successfully. Complete your profile to get started.",
        priority: PriorityLevel.STANDARD,
      })

      // Send welcome email
      await this.emailService.sendWelcomeEmail(user.email, user.firstName || "User")

      // Handle referral bonus
      if (referredBy) {
        await this.handleReferralBonus(referredBy, user.id)
      }

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          userId: user.id,
          email: user.email,
          role: user.role,
          referralCode: user.referralCode,
          isVerified: user.isVerified,
          token,
        },
      })
    } catch (error) {
      logger.error("Registration error:", error)
      res.status(500).json({
        success: false,
        message: "Registration failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        })
      }

      // Find user in database by email
      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user || !user.passwordHash || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials or account deactivated",
        })
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid PASSWORD",
        })
      }

      // Check commission status for service providers
      if (["DRIVER", "STORE_OWNER", "PLACE_OWNER"].includes(user.role) && !user.isCommissionCurrent) {
        return res.status(403).json({
          success: false,
          message: "Account suspended due to outstanding commission payments",
          code: "COMMISSION_OVERDUE",
        })
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      // Get user permissions
      const permissions = await this.rbacService.getUserPermissions(user.role)

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, role: user.role, permissions }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      } as SignOptions)

      // Store session token
      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: token,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          isActive: true,
        },
      })

      res.json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isVerified: user.isVerified,
            avatar: user.avatar,
            subscriptionTier: user.subscriptionTier,
            subscriptionStatus: user.subscriptionStatus,
            isCommissionCurrent: user.isCommissionCurrent,
            permissions,
          },
          token,
        },
      })
    } catch (error) {
      logger.error("Login error:", error)
      res.status(500).json({
        success: false,
        message: "Login failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // NEW: Driver-specific login endpoint
  driverLogin = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        })
      }

      // Find user in database by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          driverProfile: true,
          taxiDriverProfile: true,
          deliveryProfile: true // Include all driver profiles to check if user is actually a driver
        },
      })

      if (!user || !user.passwordHash || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials or account deactivated",
        })
      }

      // CRITICAL: Check if user has driver role AND driver profile
      if (!["DRIVER", "TAXI_DRIVER","DISPATCHER"].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. Driver account required.",
          code: "NOT_A_DRIVER",
        })
      }

      // Additional check: Ensure driver profile exists
      if ((user.role === "DRIVER" && !user.driverProfile) ||
          (user.role === "TAXI_DRIVER" && !user.taxiDriverProfile) ||
          (user.role === "DISPATCHER" && !user.deliveryProfile)) {
        return res.status(403).json({
          success: false,
          message: "Driver profile not found. Please complete driver onboarding.",
          code: "DRIVER_PROFILE_MISSING",
        })
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        })
      }

      // Check commission status for drivers
      if (!user.isCommissionCurrent) {
        return res.status(403).json({
          success: false,
          message: "Account suspended due to outstanding commission payments",
          code: "COMMISSION_OVERDUE",
        })
      }

      // Check if driver is approved (if you have approval system)
      const profile = user.role === "DRIVER" ? user.driverProfile :
                     user.role === "TAXI_DRIVER" ? user.taxiDriverProfile :
                     user.role === "DISPATCHER" ? user.deliveryProfile : null;

      if (profile && profile.verificationStatus !== "APPROVED") {
        return res.status(403).json({
          success: false,
          message: "Driver account pending approval",
          code: "DRIVER_NOT_APPROVED",
        })
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })

      // Get user permissions
      const permissions = await this.rbacService.getUserPermissions(user.role)

      // Generate JWT token
      const token = jwt.sign({ userId: user.id, role: user.role, permissions }, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
      } as SignOptions)

      // Store session token
      await prisma.userSession.create({
        data: {
          userId: user.id,
          token: token,
          expiresAt: new Date(Date.now() + 1000 * 60 * 60),
          isActive: true,
        },
      })

      res.json({
        success: true,
        message: "Driver login successful",
        data: {
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isVerified: user.isVerified,
            avatar: user.avatar,
            subscriptionTier: user.subscriptionTier,
            subscriptionStatus: user.subscriptionStatus,
            isCommissionCurrent: user.isCommissionCurrent,
            permissions,
            // Include driver-specific data based on role
            driverProfile: user.role === "DRIVER" ? {
              ...user.driverProfile,
              vehicle: user.driverProfile?.vehicleId
                ? await prisma.vehicle.findUnique({
                    where: { id: user.driverProfile.vehicleId },
                  })
                : null,
              documentStatus: user.driverProfile
                ? await prisma.driverDocument.findMany({
                    where: { driverProfileId: user.driverProfile.id },
                    select: {
                      type: true,
                      status: true,
                      expiryDate: true,
                      documentNumber: true,
                    },
                  })
                : [],
            } : null,
            taxiDriverProfile: user.role === "TAXI_DRIVER" ? {
              ...user.taxiDriverProfile,
              vehicle: user.taxiDriverProfile?.vehicleId
                ? await prisma.vehicle.findUnique({
                    where: { id: user.taxiDriverProfile.vehicleId },
                  })
                : null,
              documentStatus: user.taxiDriverProfile
                ? await prisma.taxiDriverDocument.findMany({
                    where: { taxiDriverProfileId: user.taxiDriverProfile.id },
                    select: {
                      type: true,
                      status: true,
                      expiryDate: true,
                      documentNumber: true,
                    },
                  })
                : [],
            } : null,
            deliveryProfile: user.role === "DISPATCHER" ? {
              ...user.deliveryProfile,
              vehicle: user.deliveryProfile?.vehicleId
                ? await prisma.vehicle.findUnique({
                    where: { id: user.deliveryProfile.vehicleId },
                  })
                : null,
              documentStatus: user.deliveryProfile
                ? await prisma.deliveryDocument.findMany({
                    where: { deliveryProfileId: user.deliveryProfile.id },
                    select: {
                      type: true,
                      status: true,
                      expiryDate: true,
                      documentNumber: true,
                    },
                  })
                : [],
            } : null,
          },
          token,
        },
      })
    } catch (error) {
      logger.error("Driver login error:", error)
      res.status(500).json({
        success: false,
        message: "Driver login failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  logout = async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization
      const token = authHeader && authHeader.split(" ")[1]

      if (token) {
        await prisma.userSession.updateMany({
          where: { token: token },
          data: { isActive: false },
        })
      }

      res.json({
        success: true,
        message: "Logged out successfully",
      })
    } catch (error) {
      logger.error("Logout error:", error)
      res.json({
        success: true,
        message: "Logged out successfully",
      })
    }
  }

  completeProfile = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" })
      }

      const { firstName, lastName, gender, dateOfBirth, avatar, phone } = req.body

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          gender: gender as any,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          avatar,
          phone: phone || undefined,
        },
      })

      res.json({
        success: true,
        message: "Profile completed successfully",
        data: {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            gender: user.gender,
            dateOfBirth: user.dateOfBirth,
            avatar: user.avatar,
          },
        },
      })
    } catch (error) {
      logger.error("Complete profile error:", error)
      res.status(500).json({
        success: false,
        message: "Profile completion failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  checkEmailAvailability = async (req: Request, res: Response) => {
    try {
      const { email } = req.body

      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      res.json({
        success: true,
        data: {
          available: !existingUser,
          message: existingUser ? "Email already registered" : "Email available",
        },
      })
    } catch (error) {
      logger.error("Check email availability error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to check email availability",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getProfile = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id
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
          subscriptionTier: true,
          subscriptionStatus: true,
          isCommissionCurrent: true,
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

  private async createUserProfile(userId: string, role: string) {
    try {
      switch (role) {
        case "USER":
          break
        case "DRIVER":
          break
        case "STORE_OWNER":
          break
        case "PLACE_OWNER":
          break
        default:
          break
      }
    } catch (error) {
      logger.error("Create user profile error:", error)
      throw error
    }
  }

  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  private async handleReferralBonus(referrerId: string, newUserId: string) {
    try {
      await this.notificationService.notifyCustomer(referrerId, {
        type: NotificationType.REFERRAL_BONUS,
        title: "Referral Bonus Earned!",
        body: "You've earned a bonus for referring a new user.",
        data: { newUserId },
        priority: PriorityLevel.STANDARD,
      })

      logger.info(`Referral bonus processed: ${referrerId} referred ${newUserId}`)
    } catch (error) {
      logger.error("Handle referral bonus error:", error)
    }
  }
}
