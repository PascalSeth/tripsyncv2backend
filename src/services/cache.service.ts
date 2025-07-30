import Redis from "ioredis"
import logger from "../utils/logger"

interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
  serialize?: boolean
}

interface RateLimitOptions {
  windowMs: number
  maxRequests: number
  keyGenerator?: (identifier: string) => string
}

export class CacheService {
  private redis: Redis | null = null
  private memoryCache = new Map<string, { data: any; expires: number }>()
  private readonly DEFAULT_TTL = 3600 // 1 hour
  private readonly MEMORY_CACHE_SIZE = 1000
  private keyCount = 0
  private isConnected = false

  constructor() {
    this.initializeRedis()
  }

  private async initializeRedis(): Promise<void> {
    try {
      if (process.env.REDIS_URL) {
        this.redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          connectTimeout: 10000,
          commandTimeout: 5000,
        })

        // Event handlers
        this.redis.on("connect", () => {
          logger.info("Redis connected successfully")
          this.isConnected = true
        })

        this.redis.on("error", (error) => {
          logger.error("Redis connection error:", error)
          this.isConnected = false
        })

        this.redis.on("close", () => {
          logger.warn("Redis connection closed")
          this.isConnected = false
        })

        this.redis.on("reconnecting", () => {
          logger.info("Redis reconnecting...")
        })

        // Connect to Redis
        await this.redis.connect()
      } else {
        logger.warn("Redis URL not configured. Using memory cache only.")
      }
    } catch (error) {
      logger.error("Redis initialization error:", error)
      this.redis = null
      this.isConnected = false
    }
  }

  /**
   * Set cache value
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const { ttl = this.DEFAULT_TTL, prefix = "", serialize = true } = options
      const fullKey = prefix ? `${prefix}:${key}` : key
      const serializedValue = serialize ? JSON.stringify(value) : value

      if (this.redis && this.isConnected) {
        await this.redis.setex(fullKey, ttl, serializedValue)
      } else {
        // Fallback to memory cache
        this.setMemoryCache(fullKey, value, ttl)
      }

      return true
    } catch (error) {
      logger.error("Cache set error:", error)
      // Fallback to memory cache on Redis error
      if (this.redis) {
        const { ttl = this.DEFAULT_TTL, prefix = "" } = options
        const fullKey = prefix ? `${prefix}:${key}` : key
        this.setMemoryCache(fullKey, value, ttl)
      }
      return false
    }
  }

  /**
   * Get cache value
   */
  async get<T = any>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const { prefix = "", serialize = true } = options
      const fullKey = prefix ? `${prefix}:${key}` : key

      let value: string | null = null

      if (this.redis && this.isConnected) {
        value = await this.redis.get(fullKey)
      } else {
        // Fallback to memory cache
        const memoryValue = this.getMemoryCache(fullKey)
        if (memoryValue !== null) {
          value = serialize ? JSON.stringify(memoryValue) : memoryValue
        }
      }

      if (value === null) return null

      return serialize ? (JSON.parse(value) as T) : (value as T)
    } catch (error) {
      logger.error("Cache get error:", error)
      // Try memory cache as fallback
      if (this.redis) {
        const { prefix = "" } = options
        const fullKey = prefix ? `${prefix}:${key}` : key
        return this.getMemoryCache(fullKey)
      }
      return null
    }
  }

  /**
   * Delete cache value
   */
  async delete(key: string, options: { prefix?: string } = {}): Promise<boolean> {
    try {
      const { prefix = "" } = options
      const fullKey = prefix ? `${prefix}:${key}` : key

      if (this.redis && this.isConnected) {
        await this.redis.del(fullKey)
      } else {
        this.memoryCache.delete(fullKey)
      }

      return true
    } catch (error) {
      logger.error("Cache delete error:", error)
      return false
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options: { prefix?: string } = {}): Promise<boolean> {
    try {
      const { prefix = "" } = options
      const fullKey = prefix ? `${prefix}:${key}` : key

      if (this.redis && this.isConnected) {
        const result = await this.redis.exists(fullKey)
        return result === 1
      } else {
        return this.memoryCache.has(fullKey) && !this.isMemoryCacheExpired(fullKey)
      }
    } catch (error) {
      logger.error("Cache exists error:", error)
      return false
    }
  }

  /**
   * Get multiple cache values
   */
  async mget<T = any>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const { prefix = "", serialize = true } = options
      const fullKeys = keys.map((key) => (prefix ? `${prefix}:${key}` : key))

      if (this.redis && this.isConnected) {
        const values = await this.redis.mget(...fullKeys)
        return values.map((value) => {
          if (value === null) return null
          return serialize ? JSON.parse(value) : value
        })
      } else {
        return fullKeys.map((key) => {
          const value = this.getMemoryCache(key)
          return value
        })
      }
    } catch (error) {
      logger.error("Cache mget error:", error)
      return keys.map(() => null)
    }
  }

  /**
   * Set multiple cache values
   */
  async mset(keyValuePairs: Array<{ key: string; value: any }>, options: CacheOptions = {}): Promise<boolean> {
    try {
      const { ttl = this.DEFAULT_TTL, prefix = "", serialize = true } = options

      if (this.redis && this.isConnected) {
        const pipeline = this.redis.pipeline()
        keyValuePairs.forEach(({ key, value }) => {
          const fullKey = prefix ? `${prefix}:${key}` : key
          const serializedValue = serialize ? JSON.stringify(value) : value
          pipeline.setex(fullKey, ttl, serializedValue)
        })
        await pipeline.exec()
      } else {
        keyValuePairs.forEach(({ key, value }) => {
          const fullKey = prefix ? `${prefix}:${key}` : key
          this.setMemoryCache(fullKey, value, ttl)
        })
      }

      return true
    } catch (error) {
      logger.error("Cache mset error:", error)
      return false
    }
  }

  /**
   * Increment counter
   */
  async increment(key: string, options: { prefix?: string; ttl?: number } = {}): Promise<number> {
    try {
      const { prefix = "", ttl } = options
      const fullKey = prefix ? `${prefix}:${key}` : key

      if (this.redis && this.isConnected) {
        const value = await this.redis.incr(fullKey)
        if (ttl && value === 1) {
          await this.redis.expire(fullKey, ttl)
        }
        return value
      } else {
        const current = this.getMemoryCache(fullKey) || 0
        const newValue = current + 1
        this.setMemoryCache(fullKey, newValue, ttl || this.DEFAULT_TTL)
        return newValue
      }
    } catch (error) {
      logger.error("Cache increment error:", error)
      return 0
    }
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(
    identifier: string,
    options: RateLimitOptions,
  ): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
  }> {
    try {
      const { windowMs, maxRequests, keyGenerator } = options
      const key = keyGenerator ? keyGenerator(identifier) : `rate_limit:${identifier}`
      const windowStart = Math.floor(Date.now() / windowMs) * windowMs

      if (this.redis && this.isConnected) {
        const pipeline = this.redis.pipeline()
        pipeline.zremrangebyscore(key, 0, Date.now() - windowMs)
        pipeline.zcard(key)
        pipeline.zadd(key, Date.now(), `${Date.now()}-${Math.random()}`)
        pipeline.expire(key, Math.ceil(windowMs / 1000))

        const results = await pipeline.exec()
        const currentCount = (results?.[1]?.[1] as number) || 0

        const allowed = currentCount < maxRequests
        const remaining = Math.max(0, maxRequests - currentCount - 1)
        const resetTime = windowStart + windowMs

        return { allowed, remaining, resetTime }
      } else {
        // Memory-based rate limiting
        const requests = this.getMemoryCache(key) || []
        const now = Date.now()
        const validRequests = requests.filter((timestamp: number) => now - timestamp < windowMs)

        const allowed = validRequests.length < maxRequests
        if (allowed) {
          validRequests.push(now)
          this.setMemoryCache(key, validRequests, Math.ceil(windowMs / 1000))
        }

        return {
          allowed,
          remaining: Math.max(0, maxRequests - validRequests.length - (allowed ? 1 : 0)),
          resetTime: windowStart + windowMs,
        }
      }
    } catch (error) {
      logger.error("Rate limit check error:", error)
      return { allowed: true, remaining: options.maxRequests, resetTime: Date.now() + options.windowMs }
    }
  }

  /**
   * Session storage
   */
  async setSession(sessionId: string, data: any, ttl = 86400): Promise<boolean> {
    return this.set(sessionId, data, { prefix: "session", ttl })
  }

  async getSession<T = any>(sessionId: string): Promise<T | null> {
    return this.get<T>(sessionId, { prefix: "session" })
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.delete(sessionId, { prefix: "session" })
  }

  /**
   * Cache with automatic refresh
   */
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    try {
      const cached = await this.get<T>(key, options)
      if (cached !== null) {
        return cached
      }

      const fresh = await fetcher()
      await this.set(key, fresh, options)
      return fresh
    } catch (error) {
      logger.error("Cache getOrSet error:", error)
      throw error
    }
  }

  /**
   * Clear cache by pattern
   */
  async clearByPattern(pattern: string): Promise<number> {
    try {
      if (this.redis && this.isConnected) {
        const keys = await this.redis.keys(pattern)
        if (keys.length > 0) {
          await this.redis.del(...keys)
          return keys.length
        }
        return 0
      } else {
        let count = 0
        const regex = new RegExp(pattern.replace(/\*/g, ".*"))
        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            this.memoryCache.delete(key)
            count++
          }
        }
        return count
      }
    } catch (error) {
      logger.error("Clear cache by pattern error:", error)
      return 0
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean
    memoryUsage?: number
    keyCount: number
    hitRate?: number
  }> {
    try {
      if (this.redis && this.isConnected) {
        const info = await this.redis.info("memory")
        const keyCount = await this.redis.dbsize()

        return {
          connected: true,
          keyCount,
          memoryUsage: this.parseRedisMemoryUsage(info),
        }
      } else {
        return {
          connected: false,
          keyCount: this.memoryCache.size,
        }
      }
    } catch (error) {
      logger.error("Get cache stats error:", error)
      return {
        connected: false,
        keyCount: 0,
      }
    }
  }

  /**
   * Flush all cache
   */
  async flush(): Promise<boolean> {
    try {
      if (this.redis && this.isConnected) {
        await this.redis.flushdb()
      } else {
        this.memoryCache.clear()
      }
      return true
    } catch (error) {
      logger.error("Cache flush error:", error)
      return false
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit()
        this.isConnected = false
      }
    } catch (error) {
      logger.error("Redis close error:", error)
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ redis: boolean; memory: boolean }> {
    const result = { redis: false, memory: true }
    
    try {
      if (this.redis && this.isConnected) {
        await this.redis.ping()
        result.redis = true
      }
    } catch (error) {
      logger.error("Redis health check failed:", error)
    }
    
    return result
  }

  private setMemoryCache(key: string, value: any, ttl: number): void {
    // Implement LRU eviction if cache is full
    if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
      const firstKey = this.memoryCache.keys().next().value
      if (firstKey) {
        this.memoryCache.delete(firstKey)
      }
    }

    this.memoryCache.set(key, {
      data: value,
      expires: Date.now() + ttl * 1000,
    })
  }

  private getMemoryCache(key: string): any {
    const cached = this.memoryCache.get(key)
    if (!cached) return null

    if (Date.now() > cached.expires) {
      this.memoryCache.delete(key)
      return null
    }

    return cached.data
  }

  private isMemoryCacheExpired(key: string): boolean {
    const cached = this.memoryCache.get(key)
    return !cached || Date.now() > cached.expires
  }

  private parseRedisMemoryUsage(info: string): number {
    const match = info.match(/used_memory:(\d+)/)
    return match ? Number.parseInt(match[1]) : 0
  }
}
