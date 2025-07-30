import type { Request, Response, NextFunction } from "express"
import { CacheService } from "../services/cache.service"
import logger from "../utils/logger"
import type { AuthenticatedRequest } from "../types"

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message?: string
  statusCode?: number
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: Request) => string
  skip?: (req: Request) => boolean
  onLimitReached?: (req: Request, res: Response) => void
}

export class RateLimitMiddleware {
  private cacheService = new CacheService()

  /**
   * Create rate limiting middleware
   */
  createRateLimit(config: RateLimitConfig) {
    const {
      windowMs,
      maxRequests,
      message = "Too many requests, please try again later",
      statusCode = 429,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      keyGenerator = this.defaultKeyGenerator,
      skip,
      onLimitReached,
    } = config

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Skip if condition is met
        if (skip && skip(req)) {
          return next()
        }

        const key = keyGenerator(req)
        const { allowed, remaining, resetTime } = await this.cacheService.checkRateLimit(key, {
          windowMs,
          maxRequests,
        })

        // Set rate limit headers
        res.set({
          "X-RateLimit-Limit": maxRequests.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": new Date(resetTime).toISOString(),
        })

        if (!allowed) {
          if (onLimitReached) {
            onLimitReached(req, res)
          }

          logger.warn(`Rate limit exceeded for ${key}`)
          return res.status(statusCode).json({
            error: "Rate limit exceeded",
            message,
            retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
          })
        }

        // Track the request for rate limiting
        const originalSend = res.send
        res.send = function (body) {
          const shouldSkip =
            (skipSuccessfulRequests && res.statusCode < 400) || (skipFailedRequests && res.statusCode >= 400)

          if (!shouldSkip) {
            // Request is already counted in checkRateLimit
          }

          return originalSend.call(this, body)
        }

        next()
      } catch (error) {
        logger.error("Rate limit middleware error:", error)
        next() // Continue on error to avoid blocking requests
      }
    }
  }

  /**
   * Global rate limiting
   */
  globalRateLimit = this.createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // 1000 requests per 15 minutes
    message: "Too many requests from this IP, please try again later",
  })

  /**
   * API rate limiting
   */
  apiRateLimit = this.createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: "API rate limit exceeded",
    keyGenerator: (req) => `api:${this.getClientIP(req)}`,
  })

  /**
   * Authentication rate limiting
   */
  authRateLimit = this.createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    message: "Too many authentication attempts, please try again later",
    keyGenerator: (req) => `auth:${this.getClientIP(req)}`,
    skipSuccessfulRequests: true,
  })

  /**
   * User-specific rate limiting
   */
  userRateLimit = this.createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute per user
    message: "User rate limit exceeded",
    keyGenerator: (req: AuthenticatedRequest) => `user:${req.user?.id || this.getClientIP(req)}`,
  })

  /**
   * Booking rate limiting
   */
  bookingRateLimit = this.createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 booking attempts per minute
    message: "Too many booking attempts, please slow down",
    keyGenerator: (req: AuthenticatedRequest) => `booking:${req.user?.id || this.getClientIP(req)}`,
  })

  /**
   * Emergency rate limiting (more lenient)
   */
  emergencyRateLimit = this.createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 emergency requests per minute
    message: "Emergency rate limit exceeded",
    keyGenerator: (req: AuthenticatedRequest) => `emergency:${req.user?.id || this.getClientIP(req)}`,
  })

  /**
   * File upload rate limiting
   */
  uploadRateLimit = this.createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
    message: "Upload rate limit exceeded",
    keyGenerator: (req: AuthenticatedRequest) => `upload:${req.user?.id || this.getClientIP(req)}`,
  })

  /**
   * Admin rate limiting (higher limits)
   */
  adminRateLimit = this.createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200, // 200 requests per minute for admins
    message: "Admin rate limit exceeded",
    keyGenerator: (req: AuthenticatedRequest) => `admin:${req.user?.id || this.getClientIP(req)}`,
    skip: (req: AuthenticatedRequest) => !req.user || !["SUPER_ADMIN", "CITY_ADMIN"].includes(req.user.role),
  })

  private defaultKeyGenerator = (req: Request): string => {
    return this.getClientIP(req)
  }

  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      "unknown"
    )
  }
}

// Export singleton instance
export const rateLimitMiddleware = new RateLimitMiddleware()
