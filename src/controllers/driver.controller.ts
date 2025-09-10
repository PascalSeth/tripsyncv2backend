import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import prisma from "../config/database"
import { DriverService } from "../services/driver.service"
import { LocationService } from "../services/location.service"
import { NotificationService } from "../services/notification.service"
import { FileUploadService } from "../services/file-upload.service"
import { ServiceZoneService } from "../services/service-zone.service"
import logger from "../utils/logger"
import bcrypt from "bcryptjs"
import { ServiceCategory, ServiceZoneType } from "@prisma/client"

export class DriverController {
  private driverService = new DriverService()
  private locationService = new LocationService()
  private notificationService = new NotificationService()
  private fileUploadService = new FileUploadService()
  private serviceZoneService = new ServiceZoneService()

  onboardDriver = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Log incoming request data for debugging
      console.log("=== DRIVER ONBOARDING REQUEST RECEIVED ===")
      console.log("Timestamp:", new Date().toISOString())
      console.log("Method:", req.method)
      console.log("URL:", req.url)
      console.log("Headers:", JSON.stringify(req.headers, null, 2))
      console.log("Raw Body:", JSON.stringify(req.body, null, 2))
      console.log("Body Keys:", Object.keys(req.body || {}))
      console.log("User from auth:", req.user)
      console.log("Content-Type:", req.headers['content-type'])
      console.log("Content-Length:", req.headers['content-length'])
      console.log("=====================================")

      // Log specific fields that might be causing issues
      console.log("=== SPECIFIC FIELD ANALYSIS ===")
      console.log("licenseExpiry received:", req.body?.licenseExpiry)
      console.log("licenseExpiry type:", typeof req.body?.licenseExpiry)
      console.log("dateOfBirth received:", req.body?.dateOfBirth)
      console.log("dateOfBirth type:", typeof req.body?.dateOfBirth)
      console.log("vehicleInfo received:", req.body?.vehicleInfo)
      console.log("preferredServiceZones received:", req.body?.preferredServiceZones)
      console.log("preferredServiceZones type:", typeof req.body?.preferredServiceZones)
      console.log("preferredServiceZones length:", Array.isArray(req.body?.preferredServiceZones) ? req.body.preferredServiceZones.length : 'N/A')
      console.log("=====================================")

      // Ensure default service zones exist
      await this.ensureDefaultServiceZones()

      const {
        // User data
        email,
        phone,
        firstName,
        lastName,
        password,
        confirmPassword,
        gender,
        dateOfBirth,
        // Driver data
        licenseNumber,
        licenseExpiry,
        licenseClass,
        driverType,
        vehicleInfo,
        // bankDetails,
        // emergencyContact,
        preferredServiceZones, // Array of service zone IDs
        // Location for zone detection
        currentLatitude,
        currentLongitude,
        // Mobile money details
        // mobileMoneyProvider,
        // mobileMoneyNumber,
        // mobileMoneyAccountName,
        // Preferences
        acceptsSharedRides = true,
        acceptsCash = true,
        maxRideDistance,
        isAvailableForDayBooking = false,
        dayBookingPrice,
        // Zone preferences
        canAcceptInterRegional = false,
        interRegionalRate,
      } = req.body

      // Validate password confirmation
      if (password && confirmPassword && password !== confirmPassword) {
        console.log("❌ PASSWORD VALIDATION FAILED: Passwords do not match")
        return res.status(400).json({
          success: false,
          message: "Passwords do not match",
        })
      }

      console.log("✅ Password validation passed")

      // Route to appropriate controller based on driverType
      if (driverType === "TAXI") {
        console.log("=== HANDLING TAXI DRIVER ONBOARDING ===")
        // Handle taxi driver onboarding directly
        return await this.handleTaxiDriverOnboarding(req, res)
      } else if (driverType === "DISPATCH_RIDER") {
        // Route to dispatch rider controller
        const { DispatchRiderController } = await import("./dispatch-rider.controller")
        const dispatchController = new DispatchRiderController()
        return await dispatchController.onboardDispatchRider(req, res)
      }

      // Continue with regular driver onboarding for "REGULAR" or default
      // Log extracted data
      console.log("=== EXTRACTED DATA ===")
      console.log("preferredServiceZones:", preferredServiceZones)
      console.log("currentLatitude:", currentLatitude)
      console.log("currentLongitude:", currentLongitude)
      console.log("driverType:", driverType)
      console.log("canAcceptInterRegional:", canAcceptInterRegional)
      console.log("licenseExpiry:", licenseExpiry)
      console.log("dateOfBirth:", dateOfBirth)
      console.log("vehicleInfo:", vehicleInfo)
      console.log("=====================")

      // Validate required fields
      console.log("=== VALIDATION CHECKS ===")
      const requiredFields = {
        email, phone, firstName, lastName, licenseNumber, licenseExpiry, licenseClass, driverType,
        vehicleInfo: { make: vehicleInfo?.make, model: vehicleInfo?.model, year: vehicleInfo?.year, licensePlate: vehicleInfo?.licensePlate, color: vehicleInfo?.color, type: vehicleInfo?.type },
        currentLatitude, currentLongitude
      }
      console.log("Required fields check:", JSON.stringify(requiredFields, null, 2))

      // Check for missing required fields
      const missingFields = []
      if (!email) missingFields.push('email')
      if (!phone) missingFields.push('phone')
      if (!firstName) missingFields.push('firstName')
      if (!lastName) missingFields.push('lastName')
      if (!licenseNumber) missingFields.push('licenseNumber')
      if (!licenseExpiry) missingFields.push('licenseExpiry')
      if (!licenseClass) missingFields.push('licenseClass')
      if (!driverType) missingFields.push('driverType')
      if (!vehicleInfo?.make) missingFields.push('vehicleInfo.make')
      if (!vehicleInfo?.model) missingFields.push('vehicleInfo.model')
      if (!vehicleInfo?.year) missingFields.push('vehicleInfo.year')
      if (!vehicleInfo?.licensePlate) missingFields.push('vehicleInfo.licensePlate')
      if (!vehicleInfo?.color) missingFields.push('vehicleInfo.color')
      if (!currentLatitude) missingFields.push('currentLatitude')
      if (!currentLongitude) missingFields.push('currentLongitude')

      if (missingFields.length > 0) {
        console.log("❌ MISSING REQUIRED FIELDS:", missingFields)
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`,
          missingFields
        })
      }
      console.log("✅ All required fields present")
      console.log("=====================")

      // Check if this is for an existing user or creating a new one
      let userId = req.user?.id
      let user = null

      if (!userId) {
        // Create new user for driver onboarding
        if (!email || !phone || !firstName || !lastName) {
          return res.status(400).json({
            success: false,
            message: "Email, phone, firstName, and lastName are required for new driver registration",
          })
        }

        // Check if user already exists by email OR phone
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ email }, { phone }],
          },
        })

        if (existingUser) {
          // User exists, check if they already have a driver profile
          const existingDriverProfile = await prisma.driverProfile.findUnique({
            where: { userId: existingUser.id },
          })

          if (existingDriverProfile) {
            return res.status(400).json({
              success: false,
              message: "User already has a driver profile",
            })
          }

          // User exists but no driver profile, use existing user
          userId = existingUser.id
          user = existingUser

          // Update existing user with additional driver info if provided
          user = await prisma.user.update({
            where: { id: userId },
            data: {
              role: "DRIVER",
              // Update mobile money details if provided
              // ...(mobileMoneyProvider && { mobileMoneyProvider }),
              // ...(mobileMoneyNumber && { mobileMoneyNumber }),
              // ...(mobileMoneyAccountName && { mobileMoneyAccountName }),
              // Update other fields if they're different/missing
              ...(firstName && firstName !== existingUser.firstName && { firstName }),
              ...(lastName && lastName !== existingUser.lastName && { lastName }),
              ...(phone && phone !== existingUser.phone && { phone }),
              ...(gender && !existingUser.gender && { gender }),
              ...(dateOfBirth && !existingUser.dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
              // Update commission settings
              subscriptionStatus: "ACTIVE",
              subscriptionTier: "BASIC",
              nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              commissionBalance: 0,
              isCommissionCurrent: true,
            },
          })
        } else {
          // Generate referral code
          const referralCode = `DR${Date.now().toString().slice(-6)}`

          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              phone,
              firstName,
              lastName,
              passwordHash: password ? await bcrypt.hash(password, 12) : null,
              gender: gender || null,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
              role: "DRIVER",
              referralCode,
              isActive: true,
              isVerified: false,
              // Mobile money details
              // mobileMoneyProvider: mobileMoneyProvider || null,
              // mobileMoneyNumber: mobileMoneyNumber || null,
              // mobileMoneyAccountName: mobileMoneyAccountName || null,
              // mobileMoneyVerified: false,
              // Commission settings
              subscriptionStatus: "ACTIVE",
              subscriptionTier: "BASIC",
              nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              commissionBalance: 0,
              isCommissionCurrent: true,
            },
          })

          userId = user.id
        }
      } else {
        // Check if driver profile already exists for existing authenticated user
        const existingProfile = await prisma.driverProfile.findUnique({
          where: { userId },
        })

        if (existingProfile) {
          return res.status(400).json({
            success: false,
            message: "Driver profile already exists for this user",
          })
        }

        // Update existing authenticated user role to DRIVER
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            role: "DRIVER",
            // Update mobile money details if provided
            // ...(mobileMoneyProvider && { mobileMoneyProvider }),
            // ...(mobileMoneyNumber && { mobileMoneyNumber }),
            // ...(mobileMoneyAccountName && { mobileMoneyAccountName }),
          },
        })
      }

      // Auto-detect service zone based on location
      let detectedZone = null
      if (currentLatitude && currentLongitude) {
        detectedZone = await this.serviceZoneService.findZoneByCoordinates(currentLatitude, currentLongitude)
      }

      // Create driver profile
      const driverProfile = await prisma.driverProfile.create({
        data: {
          userId,
          driverType: driverType as any,
          licenseNumber,
          licenseExpiry: new Date(licenseExpiry),
          licenseClass,
          isAvailable: false,
          isOnline: false,
          rating: 5.0,
          totalRides: 0,
          totalEarnings: 0,
          isVerified: false,
          verificationStatus: "PENDING",
          dayBookingPrice: dayBookingPrice || null,
          // Location data
          currentLatitude: currentLatitude || null,
          currentLongitude: currentLongitude || null,
          // Monthly Commission Tracking
          monthlyEarnings: 0,
          monthlyCommissionDue: 0,
          lastCommissionPaid: null,
          commissionStatus: "CURRENT",
          // Payout Preferences
          preferredPayoutMethod: "MOBILE_MONEY",
          payoutSchedule: "WEEKLY",
          minimumPayoutAmount: 1000, // ₦10
          // Driver preferences
          acceptsSharedRides,
          acceptsCash,
          maxRideDistance: maxRideDistance || null,
          isAvailableForDayBooking,
          // Background check
          backgroundCheckStatus: "PENDING",
        },
      })

      // Handle service zones - validate zones exist before assignment
      const zonesToAssign =
        preferredServiceZones && Array.isArray(preferredServiceZones)
          ? preferredServiceZones
          : detectedZone
            ? [detectedZone.id]
            : []

      console.log("=== ZONE ASSIGNMENT ===")
      console.log("zonesToAssign:", zonesToAssign)
      console.log("detectedZone:", detectedZone)
      console.log("=======================")

      if (zonesToAssign.length > 0) {
        // Validate that all service zones exist
        const existingZones = await prisma.serviceZone.findMany({
          where: {
            id: { in: zonesToAssign },
            isActive: true,
          },
          select: { id: true, name: true, displayName: true },
        })

        console.log("=== ZONE VALIDATION ===")
        console.log("existingZones found:", existingZones)
        console.log("existingZones count:", existingZones.length)
        console.log("=======================")

        if (existingZones.length === 0) {
          // No valid zones found, create a default zone or skip zone assignment
          logger.warn(`No valid service zones found for driver ${userId}. Zones requested: ${zonesToAssign.join(", ")}`)
          console.log("WARNING: No valid service zones found!")
        } else {
          // Only create relationships for existing zones
          const validZoneIds = existingZones.map((zone) => zone.id)
          const serviceZoneRecords = validZoneIds.map((serviceZoneId) => ({
            driverProfileId: driverProfile.id,
            serviceZoneId: serviceZoneId,
            canAcceptInterRegional: canAcceptInterRegional || false,
            interRegionalRate: interRegionalRate || null,
            isActive: true,
          }))

          console.log("=== SERVICE ZONE RECORDS ===")
          console.log("serviceZoneRecords to create:", JSON.stringify(serviceZoneRecords, null, 2))
          console.log("============================")

          await prisma.driverServiceZone.createMany({
            data: serviceZoneRecords,
            skipDuplicates: true,
          })

          // Log which zones were assigned
          logger.info(
            `Assigned driver ${userId} to zones: ${existingZones.map((z) => z.displayName || z.name).join(", ")}`,
          )
          console.log(
            `Successfully assigned driver to zones: ${existingZones.map((z) => z.displayName || z.name).join(", ")}`,
          )
        }
      }

      // Create vehicle if provided
      if (vehicleInfo) {
        console.log("=== CREATING VEHICLE ===")
        console.log("vehicleInfo:", JSON.stringify(vehicleInfo, null, 2))
        console.log("driverProfile.id:", driverProfile.id)

        try {
          const vehicle = await prisma.vehicle.create({
            data: {
              make: vehicleInfo.make,
              model: vehicleInfo.model,
              year: vehicleInfo.year ? Number.parseInt(vehicleInfo.year.toString()) : new Date().getFullYear(),
              licensePlate: vehicleInfo.licensePlate,
              color: vehicleInfo.color,
              type: vehicleInfo.type || "CAR",
              // category: ,
              isActive: true,
              isVerified: false,
              // Additional fields that might be required
              capacity: vehicleInfo.capacity || 4,
              category: "ECONOMY", // Default category, can be changed later
              fuelType: vehicleInfo.fuelType || "DIESEL",
              transmission: vehicleInfo.transmission || "AUTOMATIC",
            },
          })

          console.log("Vehicle created successfully:", vehicle)

          // Link vehicle to driver profile
          await prisma.driverProfile.update({
            where: { id: driverProfile.id },
            data: { vehicleId: vehicle.id },
          })

          console.log("Vehicle linked to driver profile successfully")
        } catch (vehicleError) {
          console.error("Error creating vehicle:", vehicleError)
          logger.error("Error creating vehicle during driver onboarding:", vehicleError)
          // Don't throw error here, just log it so onboarding can continue
        }

        console.log("========================")
      }

      // Update bank details if provided
      // if (bankDetails) {
      //   await prisma.user.update({
      //     where: { id: userId },
      //     data: {
      //       bankName: bankDetails.bankName,
      //       bankAccountNumber: bankDetails.accountNumber,
      //       bankAccountName: bankDetails.accountName,
      //       bankCode: bankDetails.bankCode,
      //     },
      //   })
      // }

      // Create emergency contact if provided
      // if (emergencyContact) {
      //   await prisma.emergencyContact.create({
      //     data: {
      //       userId,
      //       name: emergencyContact.name,
      //       phone: emergencyContact.phone,
      //       relationship: emergencyContact.relationship,
      //       isPrimary: true,
      //     },
      //   })
      // }

      // Send verification notification
      await this.notificationService.notifyDriver(userId, {
        type: "SYSTEM_ALERT",
        title: "Driver Application Submitted",
        body: `Your driver application has been submitted for review${detectedZone ? ` in ${detectedZone.displayName}` : ""}. We'll notify you once it's approved.`,
        priority: "STANDARD",
      })

      // Get complete profile data to return
      const completeProfile = await prisma.driverProfile.findUnique({
        where: { id: driverProfile.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              avatar: true,
              role: true,
              isVerified: true,
              // bankName: true,
              // bankAccountNumber: true,
              // bankAccountName: true,
              // mobileMoneyProvider: true,
              // mobileMoneyNumber: true,
              // mobileMoneyAccountName: true,
            },
          },
          vehicle: true,
          serviceZones: {
            include: {
              serviceZone: true,
            },
          },
          dayBookingConfig: true,
        },
      })

      res.status(201).json({
        success: true,
        message:
          user?.email === email
            ? "Driver profile added to existing user successfully"
            : "Driver onboarding completed successfully",
        data: {
          user: completeProfile?.user,
          driverProfile: completeProfile,
          detectedZone,
          isExistingUser: user?.email === email,
        },
      })
    } catch (error) {
      console.log("=== DRIVER ONBOARDING ERROR ===")
      console.log("Error type:", typeof error)
      console.log("Error instanceof Error:", error instanceof Error)
      console.log("Error message:", error instanceof Error ? error.message : "Unknown error")
      console.log("Error stack:", error instanceof Error ? error.stack : "No stack")
      console.log("Full error object:", JSON.stringify(error, null, 2))
      console.log("=====================================")

      logger.error("Driver onboarding error:", error)
      res.status(500).json({
        success: false,
        message: "Driver onboarding failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      })
    }
  }

  private async handleTaxiDriverOnboarding(req: AuthenticatedRequest, res: Response) {
    try {
      console.log("=== TAXI DRIVER ONBOARDING START ===")

      const {
        // User data
        email,
        phone,
        firstName,
        lastName,
        password,
        dateOfBirth,
        gender,
        // Driver data
        licenseNumber,
        licenseExpiry,
        licenseClass,
        taxiLicenseNumber,
        taxiLicenseExpiry,
        taxiPermitNumber,
        taxiPermitExpiry,
        taxiZone,
        meterNumber,
        operatingHours,
        // Vehicle Information
        vehicleInfo,
        // Location for zone detection
        currentLatitude,
        currentLongitude,
        // Preferences
        acceptsSharedRides = true,
        acceptsCash = true,
        maxRideDistance,
        canAcceptInterRegional = false,
      } = req.body

      // Check if this is for an existing user or creating a new one
      let userId = req.user?.id
      let user = null

      if (!userId) {
        // Create new user for taxi driver onboarding
        if (!email || !phone || !firstName || !lastName) {
          return res.status(400).json({
            success: false,
            message: "Email, phone, firstName, and lastName are required for new taxi driver registration",
          })
        }

        // Check if user already exists by email OR phone
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ email }, { phone }],
          },
        })

        if (existingUser) {
          // User exists, check if they already have a taxi driver profile
          const existingTaxiDriverProfile = await prisma.taxiDriverProfile.findUnique({
            where: { userId: existingUser.id },
          })

          if (existingTaxiDriverProfile) {
            return res.status(400).json({
              success: false,
              message: "User already has a taxi driver profile",
            })
          }

          // User exists but no taxi driver profile, use existing user
          userId = existingUser.id
          user = existingUser

          // Update existing user with additional taxi driver info if provided
          user = await prisma.user.update({
            where: { id: userId },
            data: {
              role: "TAXI_DRIVER",
              ...(firstName && firstName !== existingUser.firstName && { firstName }),
              ...(lastName && lastName !== existingUser.lastName && { lastName }),
              ...(phone && phone !== existingUser.phone && { phone }),
              ...(gender && !existingUser.gender && { gender }),
              ...(dateOfBirth && !existingUser.dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
              subscriptionStatus: "ACTIVE",
              subscriptionTier: "BASIC",
              nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              commissionBalance: 0,
              isCommissionCurrent: true,
            },
          })
        } else {
          // Generate referral code
          const referralCode = `TAXI${Date.now().toString().slice(-6)}`

          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              phone,
              firstName,
              lastName,
              passwordHash: password ? await bcrypt.hash(password, 12) : null,
              gender: gender || null,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
              role: "TAXI_DRIVER",
              referralCode,
              isActive: true,
              isVerified: false,
              subscriptionStatus: "ACTIVE",
              subscriptionTier: "BASIC",
              nextCommissionDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              commissionBalance: 0,
              isCommissionCurrent: true,
            },
          })

          userId = user.id
        }
      } else {
        // Check if driver profile already exists for existing authenticated user
        const existingProfile = await prisma.taxiDriverProfile.findUnique({
          where: { userId },
        })

        if (existingProfile) {
          return res.status(400).json({
            success: false,
            message: "Taxi driver profile already exists for this user",
          })
        }

        // Update existing authenticated user role to TAXI_DRIVER
        user = await prisma.user.update({
          where: { id: userId },
          data: {
            role: "TAXI_DRIVER",
          },
        })
      }

      console.log("✅ User setup complete for taxi driver:", userId)

      // Create taxi driver profile
      const taxiDriverProfile = await prisma.taxiDriverProfile.create({
        data: {
          userId,
          licenseNumber,
          licenseExpiry: new Date(licenseExpiry),
          licenseClass,
          taxiLicenseNumber: taxiLicenseNumber || licenseNumber,
          taxiLicenseExpiry: taxiLicenseExpiry ? new Date(taxiLicenseExpiry) : new Date(licenseExpiry),
          taxiPermitNumber,
          taxiPermitExpiry: taxiPermitExpiry ? new Date(taxiPermitExpiry) : null,
          taxiZone,
          meterNumber,
          operatingHours: operatingHours ? JSON.stringify(operatingHours) : undefined,
          isAvailable: false,
          isOnline: false,
          rating: 5.0,
          totalRides: 0,
          totalEarnings: 0,
          isVerified: false,
          verificationStatus: "PENDING",
          acceptsCash,
          maxRideDistance: maxRideDistance || null,
          backgroundCheckStatus: "PENDING",
        },
      })

      console.log("✅ Taxi driver profile created:", taxiDriverProfile.id)

      // Create vehicle if provided
      if (vehicleInfo) {
        console.log("=== CREATING TAXI VEHICLE ===")
        console.log("vehicleInfo:", JSON.stringify(vehicleInfo, null, 2))

        const vehicle = await prisma.vehicle.create({
          data: {
            make: vehicleInfo.make,
            model: vehicleInfo.model,
            year: vehicleInfo.year ? Number.parseInt(vehicleInfo.year.toString()) : new Date().getFullYear(),
            licensePlate: vehicleInfo.licensePlate,
            color: vehicleInfo.color,
            type: "TAXI",
            category: "TAXI",
            isTaxi: true,
            taxiMeterInstalled: vehicleInfo.taxiMeterInstalled || true,
            taxiTopLightInstalled: vehicleInfo.taxiTopLightInstalled || true,
            isActive: true,
            isVerified: false,
            capacity: vehicleInfo.capacity || 4,
            fuelType: vehicleInfo.fuelType || "GASOLINE",
            transmission: vehicleInfo.transmission || "AUTOMATIC",
          },
        })

        // Link vehicle to taxi driver profile
        await prisma.taxiDriverProfile.update({
          where: { id: taxiDriverProfile.id },
          data: { vehicleId: vehicle.id },
        })

        console.log("✅ Taxi vehicle created and linked:", vehicle.id)
      }

      // Send verification notification
      await this.notificationService.notifyDriver(userId, {
        type: "SYSTEM_ALERT",
        title: "Taxi Driver Application Submitted",
        body: `Your taxi driver application has been submitted for review. We'll notify you once it's approved.`,
        priority: "STANDARD",
      })

      // Get complete profile data to return
      const completeProfile = await prisma.taxiDriverProfile.findUnique({
        where: { id: taxiDriverProfile.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              firstName: true,
              lastName: true,
              avatar: true,
              role: true,
              isVerified: true,
            },
          },
          vehicle: true,
        },
      })

      console.log("=== TAXI DRIVER ONBOARDING COMPLETE ===")
      console.log("Profile ID:", taxiDriverProfile.id)
      console.log("User ID:", userId)
      console.log("=====================================")

      res.status(201).json({
        success: true,
        message: user?.email === email
          ? "Taxi driver profile added to existing user successfully"
          : "Taxi driver onboarding completed successfully",
        data: {
          user: completeProfile?.user,
          taxiDriverProfile: completeProfile,
        },
      })
    } catch (error) {
      console.log("=== TAXI DRIVER ONBOARDING ERROR ===")
      console.log("Error details:", error)
      logger.error("Taxi driver onboarding error:", error)
      res.status(500).json({
        success: false,
        message: "Taxi driver onboarding failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      })
    }
  }

  updateAvailability = async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Add comprehensive logging for debugging
      console.log("=== UPDATE AVAILABILITY REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("Request headers:", req.headers)
      console.log("===================================")

      if (!req.user) {
        logger.error("Update availability: No user in request")
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "No user found in request",
        })
      }

      if (!req.user.id) {
        logger.error("Update availability: User ID is undefined", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Invalid user data",
          error: "User ID is undefined",
        })
      }

      const userId = req.user.id
      const { isAvailable, isOnline, currentLatitude, currentLongitude } = req.body

      // Detect current zone if location provided
      let detectedZone = null
      let zoneChanged = false

      if (currentLatitude && currentLongitude) {
        detectedZone = await this.serviceZoneService.findZoneByCoordinates(currentLatitude, currentLongitude)

        // Check if driver moved to a different zone by comparing coordinates
        const currentProfile = await prisma.driverProfile.findFirst({
          where: { userId },
          select: { currentLatitude: true, currentLongitude: true },
        })

        // Simple zone change detection based on significant coordinate change
        if (currentProfile?.currentLatitude && currentProfile?.currentLongitude) {
          const latDiff = Math.abs(currentProfile.currentLatitude - currentLatitude)
          const lngDiff = Math.abs(currentProfile.currentLongitude - currentLongitude)
          zoneChanged = latDiff > 0.1 || lngDiff > 0.1 // Rough zone change detection
        }
      }

      const driverProfile = await prisma.driverProfile.updateMany({
        where: { userId },
        data: {
          isAvailable,
          isOnline,
          currentLatitude,
          currentLongitude,
        },
      })

      if (driverProfile.count === 0) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      // Notify about zone change
      if (zoneChanged && detectedZone) {
        await this.notificationService.notifyDriver(userId, {
          type: "SYSTEM_ALERT",
          title: "Service Zone Updated",
          body: `You've entered ${detectedZone.displayName}. Make sure you're authorized to operate in this zone.`,
          priority: "STANDARD",
        })
      }

      // Broadcast availability update via WebSocket
      try {
        const { io } = await import("../server")
        await io.broadcastToRole("USER", "driver_availability_update", {
          driverId: userId,
          isAvailable,
          isOnline,
          location: currentLatitude && currentLongitude ? { currentLatitude, currentLongitude } : null,
          zone: detectedZone,
          zoneChanged,
        })
      } catch (error) {
        logger.warn("Failed to broadcast availability update:", error)
      }

      res.json({
        success: true,
        message: "Availability updated successfully",
        data: {
          zoneChanged,
          detectedZone,
        },
      })
    } catch (error) {
      logger.error("Update availability error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update availability",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateLocation = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== UPDATE LOCATION REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("===============================")

      if (!req.user?.id) {
        logger.error("Update location: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { latitude, longitude, heading, speed } = req.body

      // Detect current zone
      const detectedZone = await this.serviceZoneService.findZoneByCoordinates(latitude, longitude)

      // Check for zone change by comparing with previous location
      const currentProfile = await prisma.driverProfile.findFirst({
        where: { userId },
        select: {
          currentLatitude: true,
          currentLongitude: true,
          serviceZones: { include: { serviceZone: true } },
        },
      })

      let zoneChanged = false
      if (currentProfile?.currentLatitude && currentProfile?.currentLongitude) {
        const latDiff = Math.abs(currentProfile.currentLatitude - latitude)
        const lngDiff = Math.abs(currentProfile.currentLongitude - longitude)
        zoneChanged = latDiff > 0.1 || lngDiff > 0.1
      }

      const isAuthorizedInZone = detectedZone
        ? currentProfile?.serviceZones.some((sz: any) => sz.serviceZoneId === detectedZone.id && sz.isActive)
        : true

      // Update driver location
      await prisma.driverProfile.updateMany({
        where: { userId },
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          heading,
        },
      })

      // Warn if driver is in unauthorized zone
      if (detectedZone && !isAuthorizedInZone && zoneChanged) {
        await this.notificationService.notifyDriver(userId, {
          type: "SAFETY_ALERT",
          title: "Unauthorized Service Zone",
          body: `You're in ${detectedZone.displayName} but not authorized to operate here. Please contact support to add this zone.`,
          priority: "CRITICAL",
        })
      }

      // Get active bookings for this driver
      const activeBookings = await prisma.booking.findMany({
        where: {
          providerId: userId,
          status: { in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"] },
        },
      })

      // Broadcast location to customers with active bookings
      try {
        const { io } = await import("../server")
        for (const booking of activeBookings) {
          await io.notifyUser(booking.customerId, "driver_location_update", {
            bookingId: booking.id,
            latitude,
            longitude,
            heading,
            speed,
            zone: detectedZone,
            timestamp: new Date(),
          })
        }
      } catch (error) {
        logger.warn("Failed to broadcast location updates:", error)
      }

      res.json({
        success: true,
        message: "Location updated successfully",
        data: {
          currentZone: detectedZone,
          zoneChanged,
          isAuthorizedInZone,
        },
      })
    } catch (error) {
      logger.error("Update location error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update location",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  acceptBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== ACCEPT BOOKING REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("Request body:", req.body)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Accept booking: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const bookingId = req.params.id

      // Get booking details to check if it's inter-regional
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          originZone: true,
          destinationZone: true,
        },
      })

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        })
      }

      // Check if driver can accept inter-regional bookings
      if (booking.isInterRegional) {
        const driverProfile = await prisma.driverProfile.findFirst({
          where: { userId },
          include: {
            serviceZones: {
              where: {
                OR: [{ serviceZoneId: booking.originZoneId || "" }, { serviceZoneId: booking.destinationZoneId || "" }],
                canAcceptInterRegional: true,
                isActive: true,
              },
            },
          },
        })

        if (!driverProfile?.serviceZones.length) {
          return res.status(403).json({
            success: false,
            message: "You're not authorized to accept inter-regional bookings for these zones",
          })
        }
      }

      const result = await this.driverService.acceptBooking(userId, bookingId)

      res.json({
        success: true,
        message: booking.isInterRegional
          ? `Inter-regional booking accepted from ${booking.originZone?.displayName} to ${booking.destinationZone?.displayName}`
          : "Booking accepted successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Accept booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to accept booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  rejectBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== REJECT BOOKING REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("Request body:", req.body)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Reject booking: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const bookingId = req.params.id
      const { reason } = req.body

      const result = await this.driverService.rejectBooking(userId, bookingId, reason)

      res.json({
        success: true,
        message: "Booking rejected successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Reject booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to reject booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  arriveAtPickup = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== ARRIVE AT PICKUP REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("================================")

      if (!req.user?.id) {
        logger.error("Arrive at pickup: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const bookingId = req.params.bookingId || req.params.id // Support both parameter names

      const result = await this.driverService.arriveAtPickup(userId, bookingId)

      // Emit WebSocket events
      try {
        const { io } = await import("../server")

        // Get role-specific event name
        const userRole = req.user?.role || "DRIVER"
        let driverArrivedEvent = "driver_arrived"
        if (userRole === "TAXI_DRIVER") {
          driverArrivedEvent = "taxi_driver_arrived"
        } else if (userRole === "DISPATCHER") {
          driverArrivedEvent = "dispatch_driver_arrived"
        }

        // Emit role-specific event to driver
        await io.notifyUser(userId, driverArrivedEvent, {
          bookingId: bookingId,
          message: "You have arrived at the pickup location",
          timestamp: new Date(),
        })

        // Emit booking_update to booking room for customer
        await io.emitToRoom(`booking:${bookingId}`, "booking_update", {
          bookingId: bookingId,
          status: "DRIVER_ARRIVED",
          message: "Driver has arrived at pickup location",
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to emit WebSocket events:", error)
      }

      res.json({
        success: true,
        message: "Arrival confirmed successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Arrive at pickup error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to confirm arrival",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  startTrip = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== START TRIP REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("==========================")

      if (!req.user?.id) {
        logger.error("Start trip: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const bookingId = req.params.bookingId || req.params.id // Support both parameter names

      const result = await this.driverService.startTrip(userId, bookingId)

      // Emit WebSocket events
      try {
        const { io } = await import("../server")

        // Get role-specific event name
        const userRole = req.user?.role || "DRIVER"
        let tripStartedEvent = "trip_started"
        if (userRole === "TAXI_DRIVER") {
          tripStartedEvent = "taxi_trip_started"
        } else if (userRole === "DISPATCHER") {
          tripStartedEvent = "dispatch_trip_started"
        }

        // Emit role-specific event to driver
        await io.notifyUser(userId, tripStartedEvent, {
          bookingId: bookingId,
          message: "Trip has started successfully",
          timestamp: new Date(),
        })

        // Emit booking_update to booking room for customer
        await io.emitToRoom(`booking:${bookingId}`, "booking_update", {
          bookingId: bookingId,
          status: "IN_PROGRESS",
          message: "Trip has started",
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to emit WebSocket events:", error)
      }

      res.json({
        success: true,
        message: "Trip started successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Start trip error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to start trip",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  completeTrip = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== COMPLETE TRIP REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("Request body:", req.body)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Complete trip: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const bookingId = req.params.bookingId || req.params.id // Support both parameter names
      const { actualDistance, actualDuration, finalPrice, endLatitude, endLongitude } = req.body

      const result = await this.driverService.completeTrip(userId, bookingId, {
        actualDistance,
        actualDuration,
        finalPrice,
        endLatitude,
        endLongitude,
      })

      // Emit WebSocket events
      try {
        const { io } = await import("../server")

        // Get role-specific event name
        const userRole = req.user?.role || "DRIVER"
        let tripCompletedEvent = "trip_completed"
        if (userRole === "TAXI_DRIVER") {
          tripCompletedEvent = "taxi_trip_completed"
        } else if (userRole === "DISPATCHER") {
          tripCompletedEvent = "dispatch_trip_completed"
        }

        // Emit role-specific event to driver
        await io.notifyUser(userId, tripCompletedEvent, {
          bookingId: bookingId,
          earnings: result.providerEarning || 0,
          message: "Trip completed successfully",
          timestamp: new Date(),
        })

        // Emit booking_update to booking room for customer
        await io.emitToRoom(`booking:${bookingId}`, "booking_update", {
          bookingId: bookingId,
          status: "COMPLETED",
          message: "Trip completed successfully",
          timestamp: new Date(),
        })
      } catch (error) {
        logger.warn("Failed to emit WebSocket events:", error)
      }

      res.json({
        success: true,
        message: "Trip completed successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Complete trip error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to complete trip",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getBookings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET BOOKINGS REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request query:", req.query)
      console.log("Request headers:", req.headers)
      console.log("============================")

      // Check if user exists and has ID
      if (!req.user) {
        logger.error("Get bookings: No user in request object")
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "No user found in request",
        })
      }

      if (!req.user.id) {
        logger.error("Get bookings: User ID is undefined", {
          user: req.user,
          userKeys: Object.keys(req.user || {}),
          userType: typeof req.user,
        })
        return res.status(401).json({
          success: false,
          message: "Invalid user data",
          error: "User ID is undefined",
        })
      }

      const userId = req.user.id
      const { status, page = 1, limit = 10, dateFrom, dateTo } = req.query

      console.log("=== EXTRACTED PARAMETERS ===")
      console.log("userId:", userId)
      console.log("status:", status)
      console.log("page:", page)
      console.log("limit:", limit)
      console.log("dateFrom:", dateFrom)
      console.log("dateTo:", dateTo)
      console.log("============================")

      const bookings = await this.driverService.getDriverBookings(userId, {
        status: status as string,
        page: Number(page),
        limit: Number(limit),
        dateFrom: dateFrom as string,
        dateTo: dateTo as string,
      })

      console.log("=== BOOKINGS RESULT ===")
      console.log("bookings:", bookings)
      console.log("======================")

      res.json({
        success: true,
        message: "Bookings retrieved successfully",
        data: bookings,
      })
    } catch (error) {
      logger.error("Get driver bookings error:", error)
      console.log("=== GET BOOKINGS ERROR ===")
      console.log("Error:", error)
      console.log("Error message:", error instanceof Error ? error.message : "Unknown error")
      console.log("Error stack:", error instanceof Error ? error.stack : "No stack")
      console.log("==========================")

      res.status(500).json({
        success: false,
        message: "Failed to retrieve bookings",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getEarnings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET EARNINGS REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request query:", req.query)
      console.log("============================")

      if (!req.user?.id) {
        logger.error("Get earnings: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { period = "week", startDate, endDate } = req.query

      const earnings = await this.driverService.getDriverEarnings(userId, {
        period: period as string,
        startDate: startDate as string,
        endDate: endDate as string,
      })

      res.json({
        success: true,
        message: "Earnings retrieved successfully",
        data: earnings,
      })
    } catch (error) {
      logger.error("Get driver earnings error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve earnings",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET ANALYTICS REQUEST ===")
      console.log("Request user:", req.user)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Get analytics: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id

      const analytics = await this.driverService.getDriverAnalytics(userId)

      res.json({
        success: true,
        message: "Analytics retrieved successfully",
        data: analytics,
      })
    } catch (error) {
      logger.error("Get driver analytics error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET PROFILE REQUEST ===")
      console.log("Request user:", req.user)
      console.log("===========================")

      if (!req.user?.id) {
        logger.error("Get profile: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id

      const profile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          vehicle: true,
          dayBookingConfig: true,
          serviceZones: {
            include: {
              serviceZone: true,
            },
          },
        },
      })

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      // Get current zone based on location
      let currentZone = null
      if (profile.currentLatitude && profile.currentLongitude) {
        currentZone = await this.serviceZoneService.findZoneByCoordinates(
          profile.currentLatitude,
          profile.currentLongitude,
        )
      }

      res.json({
        success: true,
        message: "Driver profile retrieved successfully",
        data: {
          ...profile,
          currentZone,
        },
      })
    } catch (error) {
      logger.error("Get driver profile error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve driver profile",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateProfile = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== UPDATE PROFILE REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Update profile: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const updateData = req.body

      const profile = await prisma.driverProfile.updateMany({
        where: { userId },
        data: updateData,
      })

      if (profile.count === 0) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      res.json({
        success: true,
        message: "Driver profile updated successfully",
      })
    } catch (error) {
      logger.error("Update driver profile error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update driver profile",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  addVehicle = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== ADD VEHICLE REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("===========================")

      if (!req.user?.id) {
        logger.error("Add vehicle: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const vehicleData = req.body

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      const vehicle = await this.driverService.addVehicle(driverProfile.id, vehicleData)

      res.status(201).json({
        success: true,
        message: "Vehicle added successfully",
        data: vehicle,
      })
    } catch (error) {
      logger.error("Add vehicle error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to add vehicle",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateVehicle = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== UPDATE VEHICLE REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("Request body:", req.body)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Update vehicle: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const vehicleId = req.params.id
      const updateData = req.body

      const vehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: updateData,
      })

      res.json({
        success: true,
        message: "Vehicle updated successfully",
        data: vehicle,
      })
    } catch (error) {
      logger.error("Update vehicle error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update vehicle",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getVehicles = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET VEHICLES REQUEST ===")
      console.log("Request user:", req.user)
      console.log("============================")

      if (!req.user?.id) {
        logger.error("Get vehicles: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: {
          vehicle: true,
        },
      })

      if (!driverProfile) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      res.json({
        success: true,
        message: "Vehicles retrieved successfully",
        data: driverProfile.vehicle ? [driverProfile.vehicle] : [],
      })
    } catch (error) {
      logger.error("Get vehicles error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve vehicles",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  uploadDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== UPLOAD DOCUMENT REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("Request file:", req.file)
      console.log("===============================")

      if (!req.user?.id) {
        logger.error("Upload document: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { documentType, documentNumber, expiryDate } = req.body
      const file = req.file

      if (!file) {
        return res.status(400).json({
          success: false,
          message: "Document file is required",
        })
      }

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      // Upload file to Supabase
      const documentUrl = await this.fileUploadService.uploadDocument(file, `drivers/${userId}`)

      // Save document record
      const document = await prisma.driverDocument.create({
        data: {
          driverProfileId: driverProfile.id,
          type: documentType,
          documentNumber,
          documentUrl,
          expiryDate: expiryDate ? new Date(expiryDate) : null,
          status: "PENDING",
        },
      })

      res.status(201).json({
        success: true,
        message: "Document uploaded successfully",
        data: document,
      })
    } catch (error) {
      logger.error("Upload document error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to upload document",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET DOCUMENTS REQUEST ===")
      console.log("Request user:", req.user)
      console.log("=============================")

      if (!req.user?.id) {
        logger.error("Get documents: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      const documents = await prisma.driverDocument.findMany({
        where: { driverProfileId: driverProfile.id },
        orderBy: { id: "desc" },
      })

      res.json({
        success: true,
        message: "Documents retrieved successfully",
        data: documents,
      })
    } catch (error) {
      logger.error("Get documents error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve documents",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Zone Management Methods
  getServiceZones = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET SERVICE ZONES REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request query:", req.query)
      console.log("=================================")

      const { type, includeInactive = false } = req.query

      const where: any = {}
      if (type) where.type = type
      if (!includeInactive) where.isActive = true

      const serviceZones = await prisma.serviceZone.findMany({
        where,
        include: {
          _count: {
            select: {
              driverServiceZones: {
                where: { isActive: true },
              },
            },
          },
        },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      })

      res.json({
        success: true,
        message: "Service zones retrieved successfully",
        data: serviceZones,
      })
    } catch (error) {
      logger.error("Get service zones error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve service zones",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateServiceZones = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== UPDATE SERVICE ZONES REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("====================================")

      if (!req.user?.id) {
        logger.error("Update service zones: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { serviceZones } = req.body // Array of { zoneId, canAcceptInterRegional, interRegionalRate }

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      // Remove existing service zones
      await prisma.driverServiceZone.deleteMany({
        where: { driverProfileId: driverProfile.id },
      })

      // Add new service zones
      if (serviceZones && Array.isArray(serviceZones)) {
        const serviceZoneRecords = serviceZones.map((zone: any) => ({
          driverProfileId: driverProfile.id,
          serviceZoneId: zone.zoneId,
          canAcceptInterRegional: zone.canAcceptInterRegional || false,
          interRegionalRate: zone.interRegionalRate || null,
          isActive: true,
        }))

        await prisma.driverServiceZone.createMany({
          data: serviceZoneRecords,
          skipDuplicates: true,
        })
      }

      res.json({
        success: true,
        message: "Service zones updated successfully",
      })
    } catch (error) {
      logger.error("Update service zones error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update service zones",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  requestZoneTransfer = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== REQUEST ZONE TRANSFER REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("=====================================")

      if (!req.user?.id) {
        logger.error("Request zone transfer: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { fromZoneId, toZoneId, reason } = req.body

      const transferRequest = await this.serviceZoneService.requestZoneTransfer({
        driverId: userId,
        fromZoneId,
        toZoneId,
        reason,
      })

      res.json({
        success: true,
        message: "Zone transfer request submitted successfully",
        data: transferRequest,
      })
    } catch (error) {
      logger.error("Request zone transfer error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to request zone transfer",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getZoneStatistics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET ZONE STATISTICS REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request query:", req.query)
      console.log("===================================")

      if (!req.user?.id) {
        logger.error("Get zone statistics: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { zoneId, period = "month" } = req.query

      // Get driver's current zone if not specified
      let targetZoneId = zoneId as string
      if (!targetZoneId) {
        const driverProfile = await prisma.driverProfile.findFirst({
          where: { userId },
          select: { currentLatitude: true, currentLongitude: true },
        })

        if (driverProfile?.currentLatitude && driverProfile?.currentLongitude) {
          const currentZone = await this.serviceZoneService.findZoneByCoordinates(
            driverProfile.currentLatitude,
            driverProfile.currentLongitude,
          )
          targetZoneId = currentZone?.id || ""
        }
      }

      if (!targetZoneId) {
        return res.status(400).json({
          success: false,
          message: "Zone ID is required",
        })
      }

      // Calculate date range
      const now = new Date()
      const startDate = new Date()

      switch (period) {
        case "week":
          startDate.setDate(now.getDate() - 7)
          break
        case "month":
          startDate.setMonth(now.getMonth() - 1)
          break
        case "year":
          startDate.setFullYear(now.getFullYear() - 1)
          break
        default:
          startDate.setMonth(now.getMonth() - 1)
      }

      const statistics = await this.serviceZoneService.getZoneStatistics(targetZoneId, {
        from: startDate,
        to: now,
      })

      res.json({
        success: true,
        message: "Zone statistics retrieved successfully",
        data: statistics,
      })
    } catch (error) {
      logger.error("Get zone statistics error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve zone statistics",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Day Booking Methods (updated for zones)
  setupDayBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== SETUP DAY BOOKING REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("=================================")

      if (!req.user?.id) {
        logger.error("Setup day booking: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const {
        isAvailable,
        hourlyRate,
        minimumHours,
        maximumHours,
        serviceAreas, // Now zone-based
        availableDays,
        availableTimeSlots,
        specialRequirements,
        vehicleFeatures,
        allowInterRegional = false,
      } = req.body

      // Get driver profile
      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: {
          serviceZones: {
            include: { serviceZone: true },
          },
        },
      })

      if (!driverProfile || !driverProfile.isVerified) {
        return res.status(400).json({
          success: false,
          message: "Driver profile not found or not verified",
        })
      }

      // Update driver profile for day booking
      const updatedProfile = await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          isAvailableForDayBooking: isAvailable,
          dayBookingPrice: hourlyRate,
        },
      })

      // Create or update day booking configuration
      await prisma.dayBookingConfig.upsert({
        where: { driverProfileId: driverProfile.id },
        update: {
          hourlyRate,
          minimumHours,
          maximumHours,
          serviceAreas: JSON.stringify(serviceAreas),
          availableDays: JSON.stringify(availableDays),
          availableTimeSlots: JSON.stringify(availableTimeSlots),
          specialRequirements,
          vehicleFeatures: JSON.stringify(vehicleFeatures),
          isActive: isAvailable,
        },
        create: {
          driverProfileId: driverProfile.id,
          hourlyRate,
          minimumHours: minimumHours || 4,
          maximumHours: maximumHours || 12,
          serviceAreas: JSON.stringify(serviceAreas),
          availableDays: JSON.stringify(availableDays),
          availableTimeSlots: JSON.stringify(availableTimeSlots),
          specialRequirements,
          vehicleFeatures: JSON.stringify(vehicleFeatures),
          isActive: isAvailable,
        },
      })

      res.json({
        success: true,
        message: "Day booking setup completed successfully",
        data: updatedProfile,
      })
    } catch (error) {
      logger.error("Day booking setup error:", error)
      res.status(500).json({
        success: false,
        message: "Day booking setup failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateDayBookingAvailability = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== UPDATE DAY BOOKING AVAILABILITY REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("===============================================")

      if (!req.user?.id) {
        logger.error("Update day booking availability: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { date, timeSlots, isAvailable } = req.body

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      // Create or update day booking availability
      await prisma.dayBookingAvailability.upsert({
        where: {
          driverProfileId_date: {
            driverProfileId: driverProfile.id,
            date: new Date(date),
          },
        },
        update: {
          timeSlots: JSON.stringify(timeSlots),
          isAvailable,
        },
        create: {
          driverProfileId: driverProfile.id,
          date: new Date(date),
          timeSlots: JSON.stringify(timeSlots),
          isAvailable,
        },
      })

      res.json({
        success: true,
        message: "Day booking availability updated successfully",
      })
    } catch (error) {
      logger.error("Update day booking availability error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update day booking availability",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateDayBookingPricing = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== UPDATE DAY BOOKING PRICING REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request body:", req.body)
      console.log("==========================================")

      if (!req.user?.id) {
        logger.error("Update day booking pricing: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { hourlyRate, minimumHours, maximumHours, surgeMultiplier } = req.body

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
        include: { dayBookingConfig: true },
      })

      if (!driverProfile || !driverProfile.dayBookingConfig) {
        return res.status(404).json({
          success: false,
          message: "Day booking configuration not found",
        })
      }

      // Update pricing
      await prisma.dayBookingConfig.update({
        where: { id: driverProfile.dayBookingConfig.id },
        data: {
          hourlyRate,
          minimumHours,
          maximumHours,
          surgeMultiplier: surgeMultiplier || 1.0,
        },
      })

      // Update driver profile
      await prisma.driverProfile.update({
        where: { id: driverProfile.id },
        data: {
          dayBookingPrice: hourlyRate,
        },
      })

      res.json({
        success: true,
        message: "Day booking pricing updated successfully",
      })
    } catch (error) {
      logger.error("Update day booking pricing error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update day booking pricing",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getDayBookingSchedule = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET DAY BOOKING SCHEDULE REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request query:", req.query)
      console.log("========================================")

      if (!req.user?.id) {
        logger.error("Get day booking schedule: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const { startDate, endDate } = req.query

      const driverProfile = await prisma.driverProfile.findUnique({
        where: { userId },
      })

      if (!driverProfile) {
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      // Get day booking schedule
      const schedule = await prisma.dayBookingAvailability.findMany({
        where: {
          driverProfileId: driverProfile.id,
          date: {
            gte: startDate ? new Date(startDate as string) : new Date(),
            lte: endDate ? new Date(endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { date: "asc" },
      })

      // Get existing bookings
      const bookings = await prisma.booking.findMany({
        where: {
          providerId: userId,
          status: { in: ["CONFIRMED", "IN_PROGRESS"] },
          scheduledAt: {
            gte: startDate ? new Date(startDate as string) : new Date(),
            lte: endDate ? new Date(endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          originZone: true,
          destinationZone: true,
        },
      })

      res.json({
        success: true,
        message: "Day booking schedule retrieved successfully",
        data: {
          availability: schedule,
          bookings,
        },
      })
    } catch (error) {
      logger.error("Get day booking schedule error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve day booking schedule",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Admin functions
  getAllDrivers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET ALL DRIVERS REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request query:", req.query)
      console.log("===============================")

      const { page = 1, limit = 20, status, zoneId, canAcceptInterRegional } = req.query

      const where: any = {}
      if (status) where.verificationStatus = status
      if (zoneId) {
        where.serviceZones = {
          some: {
            serviceZoneId: zoneId,
            isActive: true,
          },
        }
      }
      if (canAcceptInterRegional !== undefined) {
        where.serviceZones = {
          some: {
            canAcceptInterRegional: canAcceptInterRegional === "true",
            isActive: true,
          },
        }
      }

      const drivers = await prisma.driverProfile.findMany({
        where,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          vehicle: true,
          serviceZones: {
            include: {
              serviceZone: true,
            },
          },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { id: "desc" },
      })

      const total = await prisma.driverProfile.count({ where })

      // Add current zone info for each driver
      const driversWithZones = await Promise.all(
        drivers.map(async (driver) => {
          let currentZone = null
          if (driver.currentLatitude && driver.currentLongitude) {
            currentZone = await this.serviceZoneService.findZoneByCoordinates(
              driver.currentLatitude,
              driver.currentLongitude,
            )
          }
          return {
            ...driver,
            currentZone,
          }
        }),
      )

      res.json({
        success: true,
        message: "Drivers retrieved successfully",
        data: driversWithZones,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get all drivers error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve drivers",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  verifyDriver = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== VERIFY DRIVER REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("=============================")

      if (!req.user?.id) {
        logger.error("Verify driver: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const driverId = req.params.id

      const driver = await prisma.driverProfile.update({
        where: { id: driverId },
        data: {
          isVerified: true,
          verificationStatus: "APPROVED",
        },
        include: {
          user: true,
        },
      })

      // Send verification notification
      await this.notificationService.notifyDriver(driver.userId, {
        type: "SYSTEM_ALERT",
        title: "Driver Application Approved",
        body: "Congratulations! Your driver application has been approved. You can now start accepting rides.",
        priority: "STANDARD",
      })

      res.json({
        success: true,
        message: "Driver verified successfully",
        data: driver,
      })
    } catch (error) {
      logger.error("Verify driver error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to verify driver",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  suspendDriver = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== SUSPEND DRIVER REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("Request body:", req.body)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Suspend driver: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const driverId = req.params.id
      const { reason } = req.body

      const driver = await prisma.driverProfile.update({
        where: { id: driverId },
        data: {
          isVerified: false,
          verificationStatus: "REJECTED",
          isAvailable: false,
          isOnline: false,
        },
        include: {
          user: true,
        },
      })

      // Send suspension notification
      await this.notificationService.notifyDriver(driver.userId, {
        type: "SAFETY_ALERT",
        title: "Account Suspended",
        body: `Your driver account has been suspended. Reason: ${reason}`,
        priority: "CRITICAL",
      })

      res.json({
        success: true,
        message: "Driver suspended successfully",
        data: driver,
      })
    } catch (error) {
      logger.error("Suspend driver error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to suspend driver",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  private async ensureDefaultServiceZones() {
    try {
      console.log("=== ENSURING DEFAULT SERVICE ZONES ===")

      // Check if any service zones exist
      const existingZones = await prisma.serviceZone.count()
      console.log("Existing service zones count:", existingZones)

      if (existingZones === 0) {
        console.log("No service zones found, creating default zones...")

        // Create default service zones

        const defaultZones = [
          {
            name: "accra_central",
            displayName: "Accra Central",
            type: ServiceZoneType.LOCAL,
            category: ServiceCategory.TRANSPORTATION,
            centerLat: 5.6037,
            centerLng: -0.187,
            radius: 10000, // 10km radius
            isActive: true,
            timezone: "Africa/Accra",
            currency: "GHS",
            language: "en",
            description: "Central Accra service zone",
            priority: 1,
          },
          {
            name: "kumasi_central",
            displayName: "Kumasi Central",
            type: ServiceZoneType.LOCAL,
            category: ServiceCategory.TRANSPORTATION,
            centerLat: 6.6885,
            centerLng: -1.6244,
            radius: 10000,
            isActive: true,
            timezone: "Africa/Accra",
            currency: "GHS",
            language: "en",
            description: "Central Kumasi service zone",
            priority: 1,
          },
          {
            name: "takoradi_central",
            displayName: "Takoradi Central",
            type: ServiceZoneType.LOCAL,
            category: ServiceCategory.TRANSPORTATION,
            centerLat: 4.8845,
            centerLng: -1.7554,
            radius: 10000,
            isActive: true,
            timezone: "Africa/Accra",
            currency: "GHS",
            language: "en",
            description: "Central Takoradi service zone",
            priority: 1,
          },
        ]

        console.log("Creating default zones:", JSON.stringify(defaultZones, null, 2))

        await prisma.serviceZone.createMany({
          data: defaultZones,
          skipDuplicates: true,
        })

        logger.info("Created default service zones")
        console.log("Successfully created default service zones")

        const createdZones = await prisma.serviceZone.findMany({ where: { isActive: true } })
        console.log("Created zones:", createdZones)
        return createdZones
      }

      const allZones = await prisma.serviceZone.findMany({ where: { isActive: true } })
      console.log("Found existing service zones:", allZones)
      console.log("=====================================")
      return allZones
    } catch (error) {
      console.error("Error ensuring default service zones:", error)
      logger.error("Error ensuring default service zones:", error)
      return []
    }
  }

  getPendingBookings = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET PENDING BOOKINGS REQUEST ===")
      console.log("Request user:", req.user)
      console.log("====================================")

      if (!req.user?.id) {
        logger.error("Get pending bookings: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      console.log(`🔍 Getting pending bookings for driver: ${userId}`)

      // Get driver's current location to calculate distances
      const driverProfile = await prisma.driverProfile.findFirst({
        where: { userId },
        select: {
          currentLatitude: true,
          currentLongitude: true,
          isAvailable: true,
          isOnline: true,
          serviceZones: {
            include: { serviceZone: true },
          },
        },
      })

      if (!driverProfile) {
        console.log(`❌ Driver profile not found for user: ${userId}`)
        return res.status(404).json({
          success: false,
          message: "Driver profile not found",
        })
      }

      console.log(`👤 Driver Profile:`)
      console.log(`   - Available: ${driverProfile.isAvailable}`)
      console.log(`   - Online: ${driverProfile.isOnline}`)
      console.log(`   - Location: ${driverProfile.currentLatitude}, ${driverProfile.currentLongitude}`)

      // Get pending bookings that were sent to this driver
      const driverNotifications = await prisma.driverNotification.findMany({
        where: {
          driverId: userId,
          status: "SENT",
          booking: {
            status: "PENDING",
          },
        },
        include: {
          booking: {
            include: {
              customer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                  avatar: true,
                },
              },
              serviceType: true,
              originZone: true,
              destinationZone: true,
            },
          },
        },
        orderBy: { notifiedAt: "desc" },
        take: 10,
      })

      console.log(`📋 Found ${driverNotifications.length} pending notifications`)

      // Calculate distances and add additional info
      const pendingBookings = await Promise.all(
        driverNotifications.map(async (notification) => {
          const booking = notification.booking
          let distance = 0
          let eta = 0

          if (
            driverProfile.currentLatitude &&
            driverProfile.currentLongitude &&
            booking.pickupLatitude &&
            booking.pickupLongitude
          ) {
            distance = this.locationService.calculateDistance(
              driverProfile.currentLatitude,
              driverProfile.currentLongitude,
              booking.pickupLatitude,
              booking.pickupLongitude,
            )

            const etaResult = await this.locationService.calculateETA(
              driverProfile.currentLatitude,
              driverProfile.currentLongitude,
              booking.pickupLatitude,
              booking.pickupLongitude,
            )
            eta = etaResult.eta
          }

          const timeRemaining = Math.max(0, 60 - Math.floor((Date.now() - notification.notifiedAt.getTime()) / 1000))

          console.log(`📍 Booking ${booking.id}:`)
          console.log(`   - Distance: ${(distance / 1000).toFixed(2)}km`)
          console.log(`   - ETA: ${eta}min`)
          console.log(`   - Time Remaining: ${timeRemaining}s`)

          return {
            notificationId: notification.id,
            booking: {
              ...booking,
              distance,
              eta,
              timeRemaining,
            },
          }
        }),
      )

      console.log(`✅ Returning ${pendingBookings.length} pending bookings`)

      res.json({
        success: true,
        message: "Pending bookings retrieved successfully",
        data: pendingBookings,
      })
    } catch (error) {
      logger.error("Get pending bookings error:", error)
      console.error("❌ GET PENDING BOOKINGS ERROR:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve pending bookings",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getActiveBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET ACTIVE BOOKING REQUEST ===")
      console.log("Request user:", req.user)
      console.log("==================================")

      if (!req.user?.id) {
        logger.error("Get active booking: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id

      // Get current active booking for this driver
      const activeBooking = await prisma.booking.findFirst({
        where: {
          providerId: userId,
          status: {
            in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"],
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
            },
          },
          serviceType: true,
          originZone: true,
          destinationZone: true,
          trackingUpdates: {
            orderBy: { timestamp: "desc" },
            take: 5,
          },
        },
        orderBy: { acceptedAt: "desc" },
      })

      if (!activeBooking) {
        return res.json({
          success: true,
          message: "No active booking found",
          data: null,
        })
      }

      res.json({
        success: true,
        message: "Active booking retrieved successfully",
        data: activeBooking,
      })
    } catch (error) {
      logger.error("Get active booking error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve active booking",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  acceptBookingRequest = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== ACCEPT BOOKING REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Accept booking request: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const bookingId = req.params.bookingId

      // Check if driver has an active booking
      const existingActiveBooking = await prisma.booking.findFirst({
        where: {
          providerId: userId,
          status: {
            in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"],
          },
        },
      })

      if (existingActiveBooking) {
        return res.status(400).json({
          success: false,
          message: "You already have an active booking. Complete it before accepting a new one.",
        })
      }

      // Use the existing acceptBooking method from DriverService
      const result = await this.driverService.acceptBooking(userId, bookingId)

      // Get the booking with driver information for WebSocket events
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          provider: {
            include: {
              driverProfile: {
                include: {
                  vehicle: true,
                },
              },
            },
          },
        },
      })

      // Emit WebSocket events
      try {
        const { io } = await import("../server")

        // Get role-specific event name
        const userRole = req.user?.role || "DRIVER"
        let bookingAcceptedEvent = "booking_accepted"
        if (userRole === "TAXI_DRIVER") {
          bookingAcceptedEvent = "taxi_booking_accepted"
        } else if (userRole === "DISPATCHER") {
          bookingAcceptedEvent = "dispatch_booking_accepted"
        }

        // Emit role-specific booking accepted event to driver
        await io.notifyUser(userId, bookingAcceptedEvent, {
          bookingId: bookingId,
          customer: {
            name: "Customer Name", // You can get this from booking.customer
          },
          message: "Booking accepted successfully",
          timestamp: new Date(),
        })

        // Emit booking_update with DRIVER_ASSIGNED to booking room for customer
        const updateData: any = {
          bookingId: bookingId,
          status: "DRIVER_ASSIGNED",
          message: "Driver has been assigned to your booking",
          timestamp: new Date(),
        }

        if (booking?.provider) {
          const driverProfile = booking.provider.driverProfile
          if (driverProfile) {
            updateData.driver = {
              id: booking.provider.id,
              name: `${booking.provider.firstName} ${booking.provider.lastName}`,
              phone: booking.provider.phone,
              rating: driverProfile.rating,
              currentLocation: {
                latitude: driverProfile.currentLatitude,
                longitude: driverProfile.currentLongitude,
              },
              photoUrl: booking.provider.avatar,
            }
            updateData.vehicle = driverProfile.vehicle ? {
              model: driverProfile.vehicle.model,
              licensePlate: driverProfile.vehicle.licensePlate,
            } : null
            updateData.bookingNumber = booking.bookingNumber
            updateData.pickupLocation = {
              address: "Pickup Location",
              latitude: booking.pickupLatitude,
              longitude: booking.pickupLongitude,
            }
            updateData.dropoffLocation = {
              address: "Dropoff Location",
              latitude: booking.dropoffLatitude,
              longitude: booking.dropoffLongitude,
            }
            updateData.estimatedPrice = booking.estimatedPrice
            updateData.estimatedDuration = booking.estimatedDuration
          }
        }

        await io.emitToRoom(`booking:${bookingId}`, "booking_update", updateData)
      } catch (error) {
        logger.warn("Failed to emit WebSocket events:", error)
      }

      // Update driver notification status
      await prisma.driverNotification.updateMany({
        where: {
          driverId: userId,
          bookingId,
          status: "SENT",
        },
        data: {
          status: "READ",
        },
      })

      // Reject other pending notifications for this booking
      await prisma.driverNotification.updateMany({
        where: {
          bookingId,
          driverId: { not: userId },
          status: "SENT",
        },
        data: {
          status: "EXPIRED",
        },
      })

      res.json({
        success: true,
        message: "Booking request accepted successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Accept booking request error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to accept booking request",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  rejectBookingRequest = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== REJECT BOOKING REQUEST ===")
      console.log("Request user:", req.user)
      console.log("Request params:", req.params)
      console.log("Request body:", req.body)
      console.log("==============================")

      if (!req.user?.id) {
        logger.error("Reject booking request: No user ID in request", { user: req.user })
        return res.status(401).json({
          success: false,
          message: "Authentication required",
          error: "User ID is missing",
        })
      }

      const userId = req.user.id
      const bookingId = req.params.bookingId
      const { reason } = req.body

      // Update driver notification status
      await prisma.driverNotification.updateMany({
        where: {
          driverId: userId,
          bookingId,
          status: "SENT",
        },
        data: {
          status: "EXPIRED",
        },
      })

      // Use the existing rejectBooking method from DriverService
      const result = await this.driverService.rejectBooking(userId, bookingId, reason)

      res.json({
        success: true,
        message: "Booking request rejected successfully",
        data: result,
      })
    } catch (error) {
      logger.error("Reject booking request error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to reject booking request",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getBookingUpdates = async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("=== GET BOOKING UPDATES REQUEST ===")
      console.log("Request user:", req.user)
      console.log("===================================")

      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        })
      }

      const userId = req.user.id

      // Get current active booking
      const activeBooking = await prisma.booking.findFirst({
        where: {
          providerId: userId,
          status: {
            in: ["DRIVER_ASSIGNED", "DRIVER_ARRIVED", "IN_PROGRESS"],
          },
        },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
            },
          },
          serviceType: true,
          trackingUpdates: {
            orderBy: { timestamp: "desc" },
            take: 5,
          },
        },
        orderBy: { acceptedAt: "desc" },
      })

      // Get pending notifications
      const pendingNotifications = await prisma.driverNotification.findMany({
        where: {
          driverId: userId,
          status: "SENT",
          booking: {
            status: "PENDING",
          },
        },
        include: {
          booking: {
            include: {
              customer: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              serviceType: true,
            },
          },
        },
        orderBy: { notifiedAt: "desc" },
        take: 5,
      })

      res.json({
        success: true,
        message: "Booking updates retrieved successfully",
        data: {
          activeBooking,
          pendingRequests: pendingNotifications.map((notification) => ({
            notificationId: notification.id,
            booking: notification.booking,
            timeRemaining: Math.max(0, 60 - Math.floor((Date.now() - notification.notifiedAt.getTime()) / 1000)),
          })),
        },
      })
    } catch (error) {
      logger.error("Get booking updates error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve booking updates",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
