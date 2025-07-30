import type { Request } from "express"
import type { UserRole, Permission } from "@prisma/client"

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string // Changed to non-optional as per schema update
    phone: string
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
}

export interface PaystackResponse {
  status: boolean
  message: string
  data?: any
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

export interface UserPayload {
  id: string
  email: string // Changed to non-optional
  phone: string
  role: UserRole
  permissions: Permission[]
  isVerified: boolean
  isActive: boolean
}

export interface AuthenticatedRequest extends Request {
  user?: UserPayload
}

export interface PaystackResponse {
  status: boolean
  message: string
  data?: any
  [key: string]: any
}

export interface NotificationData {
  type: string
  title: string
  body: string
  data?: any
  priority: "LOW" | "STANDARD" | "HIGH" | "CRITICAL"
}
