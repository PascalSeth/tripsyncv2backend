import type { Request } from "express"
import type { UserRole } from "@prisma/client"

/**
 * Represents a user's role in the system.
 * Extend this union type as more roles are introduced.
 */

// Define Permission type as a string for now, assuming it's a simple string array from JWT.
// If you have specific, known permissions, you should define them as a union of literal strings:
// export type Permission = "admin:full" | "user:read" | "booking:create" | "driver:update_status";
export type Permission = string

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    phone: string | null // Changed to allow null
    role: UserRole
    permissions: Permission[]
    isVerified: boolean
    isActive: boolean
  }
}

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface BookingFilters {
  status?: string
  serviceType?: string
  dateFrom?: string
  dateTo?: string
  customerId?: string
  providerId?: string
}

export interface LocationCoordinates {
  latitude: number
  longitude: number
}

export interface ServiceEstimate {
  estimatedPrice: number
  estimatedDuration: number
  estimatedDistance: number
  surgePricing: number
  availableProviders: number
  breakdown?: {
    basePrice: number
    distancePrice: number
    timePrice: number
    surgeAmount: number
    serviceFee: number
  }
  stabilityMetrics?: {
    // Made optional as it's not always present in base ServiceEstimate
    isStable: boolean
    expectedRange: { min: number; max: number }
    supplyCount?: number
    providerCount?: number
    actualHourlyRate?: number
  }
}

// NEW: Extended interface for ride estimates
export interface RideServiceEstimate extends ServiceEstimate {
  isFirstSharedRideBooking?: boolean
  totalSharedRidePriceForGroup?: number
}

export interface PaystackResponse {
  status: boolean
  message: string
  data?: any
  [key: string]: any
}

export interface UploadedFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  buffer: Buffer
  size: number
}

// Removed FirebaseUser interface

export interface RBACContext {
  userId: string
  role: UserRole
  permissions: Permission[]
  resourceId?: string
  resourceType?: string
}

export interface DayBookingRequest {
  date: string
  startTime: string
  endTime: string
  pickupLocation: LocationCoordinates
  dropoffLocation?: LocationCoordinates
  specialRequirements?: string
  estimatedDistance?: number
}

export interface DriverMatchingCriteria {
  location: LocationCoordinates
  serviceType: string
  radius: number
  maxDrivers: number
  requirements?: string[]
}

export interface PlaceVoteData {
  placeId: string
  isLiked: boolean
  suggestedCategoryId?: string
  reason?: string
}

export interface AnonymousUserData {
  name: string
  gender: "MALE" | "FEMALE" | "OTHER"
  sessionId?: string
}

/**
 * Represents the decoded payload from a JWT, containing essential user information.
 */
export interface UserPayload {
  id: string
  email: string
  phone: string | null
  role: UserRole
  isVerified: boolean
  isActive: boolean
  permissions: Permission[]
}

export interface NotificationData {
  type: string
  title: string
  body: string
  data?: any
  priority: "LOW" | "STANDARD" | "HIGH" | "CRITICAL"
}

// NEW: Interface for available driver locations broadcast from backend
export interface AvailableDriverLocation {
  id: string;
  latitude: number;
  longitude: number;
  name?: string;
  vehicleModel?: string;
  licensePlate?: string;
  heading?: number; // If backend sends this
}
