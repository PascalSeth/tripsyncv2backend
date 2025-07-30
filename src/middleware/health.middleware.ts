import type { Request, Response, NextFunction } from "express"
import prisma from "../config/database"
import { supabase } from "../config/supabase"
// import admin from "../config/firebase" // Removed Firebase import
import logger from "../utils/logger"

interface HealthCheck {
  service: string
  status: "healthy" | "unhealthy" | "degraded"
  responseTime?: number
  error?: string
  details?: any
}

interface HealthStatus {
  status: "healthy" | "unhealthy" | "degraded"
  timestamp: string
  uptime: number
  version: string
  environment: string
  services: HealthCheck[]
  summary: {
    total: number
    healthy: number
    unhealthy: number
    degraded: number
  }
}

export async function healthCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const startTime = Date.now()
    const checks: HealthCheck[] = []

    // Database health check
    const dbCheck = await checkDatabase()
    checks.push(dbCheck)

    // Supabase health check
    const supabaseCheck = await checkSupabase()
    checks.push(supabaseCheck)

    // Firebase health check (Removed as Firebase is no longer used for auth)
    // const firebaseCheck = await checkFirebase()
    // checks.push(firebaseCheck)

    // Redis health check (if configured)
    if (process.env.REDIS_URL) {
      const redisCheck = await checkRedis()
      checks.push(redisCheck)
    }

    // External services health check
    const externalChecks = await checkExternalServices()
    checks.push(...externalChecks)

    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter((c) => c.status === "healthy").length,
      unhealthy: checks.filter((c) => c.status === "unhealthy").length,
      degraded: checks.filter((c) => c.status === "degraded").length,
    }

    // Determine overall status
    let overallStatus: "healthy" | "unhealthy" | "degraded" = "healthy"
    if (summary.unhealthy > 0) {
      overallStatus = "unhealthy"
    } else if (summary.degraded > 0) {
      overallStatus = "degraded"
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      services: checks,
      summary,
    }

    const statusCode = overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503

    res.status(statusCode).json(healthStatus)

    // Log health check results
    const totalTime = Date.now() - startTime
    logger.info(`Health check completed in ${totalTime}ms - Status: ${overallStatus}`)

    if (overallStatus !== "healthy") {
      logger.warn("Health check issues detected:", {
        unhealthy: checks.filter((c) => c.status === "unhealthy"),
        degraded: checks.filter((c) => c.status === "degraded"),
      })
    }
  } catch (error) {
    logger.error("Health check failed:", error)
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check system failure",
      details: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      service: "database",
      status: "healthy",
      responseTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      service: "database",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Database connection failed",
    }
  }
}

async function checkSupabase(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) throw error

    return {
      service: "supabase",
      status: "healthy",
      responseTime: Date.now() - startTime,
      details: { buckets: data?.length || 0 },
    }
  } catch (error) {
    return {
      service: "supabase",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Supabase connection failed",
    }
  }
}

// Removed Firebase health check as Firebase is no longer used for auth
/*
async function checkFirebase(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    // Test Firebase Auth
    await admin.auth().listUsers(1)
    
    return {
      service: 'firebase',
      status: 'healthy',
      responseTime: Date.now() - startTime
    }
  } catch (error) {
    return {
      service: 'firebase',
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Firebase connection failed'
    }
  }
}
*/

async function checkRedis(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    // This would check Redis if properly configured
    // For now, return degraded since we're using memory cache
    return {
      service: "redis",
      status: "degraded",
      responseTime: Date.now() - startTime,
      error: "Using memory cache fallback",
    }
  } catch (error) {
    return {
      service: "redis",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Redis connection failed",
    }
  }
}

async function checkExternalServices(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = []

  // Google Maps API check
  const mapsCheck = await checkGoogleMaps()
  checks.push(mapsCheck)

  // Paystack API check
  const paystackCheck = await checkPaystack()
  checks.push(paystackCheck)

  return checks
}

async function checkGoogleMaps(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return {
        service: "google_maps",
        status: "degraded",
        responseTime: Date.now() - startTime,
        error: "API key not configured",
      }
    }

    // Simple API test - geocode a known location
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=Lagos,Nigeria&key=${process.env.GOOGLE_MAPS_API_KEY}`,
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    if (data.status !== "OK") {
      throw new Error(`API Error: ${data.status}`)
    }

    return {
      service: "google_maps",
      status: "healthy",
      responseTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      service: "google_maps",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Google Maps API failed",
    }
  }
}

async function checkPaystack(): Promise<HealthCheck> {
  const startTime = Date.now()
  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return {
        service: "paystack",
        status: "degraded",
        responseTime: Date.now() - startTime,
        error: "API key not configured",
      }
    }

    // Test Paystack API
    const response = await fetch("https://api.paystack.co/bank", {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return {
      service: "paystack",
      status: "healthy",
      responseTime: Date.now() - startTime,
    }
  } catch (error) {
    return {
      service: "paystack",
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Paystack API failed",
    }
  }
}

// Detailed health check for monitoring systems
export async function detailedHealthCheck(req: Request, res: Response) {
  try {
    const checks = await Promise.allSettled([
      checkSystemResources(),
      checkDatabasePerformance(),
      checkMemoryUsage(),
      checkDiskSpace(),
    ])

    const systemHealth = {
      timestamp: new Date().toISOString(),
      system: checks.map((check, index) => ({
        name: ["resources", "database_performance", "memory", "disk"][index],
        status: check.status === "fulfilled" ? "healthy" : "unhealthy",
        data: check.status === "fulfilled" ? check.value : { error: check.reason },
      })),
    }

    res.json(systemHealth)
  } catch (error) {
    logger.error("Detailed health check failed:", error)
    res.status(500).json({
      error: "Detailed health check failed",
      timestamp: new Date().toISOString(),
    })
  }
}

async function checkSystemResources() {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: process.version,
    platform: process.platform,
  }
}

async function checkDatabasePerformance() {
  const startTime = Date.now()
  try {
    // Test query performance
    await prisma.$queryRaw`SELECT COUNT(*) FROM "User"`
    const queryTime = Date.now() - startTime

    return {
      queryTime,
      connectionPool: {
        // These would be actual pool stats in production
        active: 1,
        idle: 0,
        total: 1,
      },
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Database performance check failed",
      queryTime: Date.now() - startTime,
    }
  }
}

async function checkMemoryUsage() {
  const usage = process.memoryUsage()
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
    heapUsedPercentage: (usage.heapUsed / usage.heapTotal) * 100,
  }
}

async function checkDiskSpace() {
  // This would check actual disk space in production
  return {
    available: "N/A",
    used: "N/A",
    total: "N/A",
    percentage: "N/A",
  }
}
