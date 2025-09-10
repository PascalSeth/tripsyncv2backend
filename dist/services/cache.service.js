"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheService = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = __importDefault(require("../utils/logger"));
class CacheService {
    constructor() {
        this.redis = null;
        this.memoryCache = new Map();
        this.DEFAULT_TTL = 3600; // 1 hour
        this.MEMORY_CACHE_SIZE = 1000;
        this.keyCount = 0;
        this.isConnected = false;
        this.initializeRedis();
    }
    async initializeRedis() {
        try {
            if (process.env.REDIS_URL) {
                this.redis = new ioredis_1.default(process.env.REDIS_URL, {
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    connectTimeout: 10000,
                    commandTimeout: 5000,
                });
                // Event handlers
                this.redis.on("connect", () => {
                    logger_1.default.info("Redis connected successfully");
                    this.isConnected = true;
                });
                this.redis.on("error", (error) => {
                    logger_1.default.error("Redis connection error:", error);
                    this.isConnected = false;
                });
                this.redis.on("close", () => {
                    logger_1.default.warn("Redis connection closed");
                    this.isConnected = false;
                });
                this.redis.on("reconnecting", () => {
                    logger_1.default.info("Redis reconnecting...");
                });
                // Connect to Redis
                await this.redis.connect();
            }
            else {
                logger_1.default.warn("Redis URL not configured. Using memory cache only.");
            }
        }
        catch (error) {
            logger_1.default.error("Redis initialization error:", error);
            this.redis = null;
            this.isConnected = false;
        }
    }
    /**
     * Set cache value
     */
    async set(key, value, options = {}) {
        try {
            const { ttl = this.DEFAULT_TTL, prefix = "", serialize = true } = options;
            const fullKey = prefix ? `${prefix}:${key}` : key;
            const serializedValue = serialize ? JSON.stringify(value) : value;
            if (this.redis && this.isConnected) {
                await this.redis.setex(fullKey, ttl, serializedValue);
            }
            else {
                // Fallback to memory cache
                this.setMemoryCache(fullKey, value, ttl);
            }
            return true;
        }
        catch (error) {
            logger_1.default.error("Cache set error:", error);
            // Fallback to memory cache on Redis error
            if (this.redis) {
                const { ttl = this.DEFAULT_TTL, prefix = "" } = options;
                const fullKey = prefix ? `${prefix}:${key}` : key;
                this.setMemoryCache(fullKey, value, ttl);
            }
            return false;
        }
    }
    /**
     * Get cache value
     */
    async get(key, options = {}) {
        try {
            const { prefix = "", serialize = true } = options;
            const fullKey = prefix ? `${prefix}:${key}` : key;
            let value = null;
            if (this.redis && this.isConnected) {
                value = await this.redis.get(fullKey);
            }
            else {
                // Fallback to memory cache
                const memoryValue = this.getMemoryCache(fullKey);
                if (memoryValue !== null) {
                    value = serialize ? JSON.stringify(memoryValue) : memoryValue;
                }
            }
            if (value === null)
                return null;
            return serialize ? JSON.parse(value) : value;
        }
        catch (error) {
            logger_1.default.error("Cache get error:", error);
            // Try memory cache as fallback
            if (this.redis) {
                const { prefix = "" } = options;
                const fullKey = prefix ? `${prefix}:${key}` : key;
                return this.getMemoryCache(fullKey);
            }
            return null;
        }
    }
    /**
     * Delete cache value
     */
    async delete(key, options = {}) {
        try {
            const { prefix = "" } = options;
            const fullKey = prefix ? `${prefix}:${key}` : key;
            if (this.redis && this.isConnected) {
                await this.redis.del(fullKey);
            }
            else {
                this.memoryCache.delete(fullKey);
            }
            return true;
        }
        catch (error) {
            logger_1.default.error("Cache delete error:", error);
            return false;
        }
    }
    /**
     * Check if key exists
     */
    async exists(key, options = {}) {
        try {
            const { prefix = "" } = options;
            const fullKey = prefix ? `${prefix}:${key}` : key;
            if (this.redis && this.isConnected) {
                const result = await this.redis.exists(fullKey);
                return result === 1;
            }
            else {
                return this.memoryCache.has(fullKey) && !this.isMemoryCacheExpired(fullKey);
            }
        }
        catch (error) {
            logger_1.default.error("Cache exists error:", error);
            return false;
        }
    }
    /**
     * Get multiple cache values
     */
    async mget(keys, options = {}) {
        try {
            const { prefix = "", serialize = true } = options;
            const fullKeys = keys.map((key) => (prefix ? `${prefix}:${key}` : key));
            if (this.redis && this.isConnected) {
                const values = await this.redis.mget(...fullKeys);
                return values.map((value) => {
                    if (value === null)
                        return null;
                    return serialize ? JSON.parse(value) : value;
                });
            }
            else {
                return fullKeys.map((key) => {
                    const value = this.getMemoryCache(key);
                    return value;
                });
            }
        }
        catch (error) {
            logger_1.default.error("Cache mget error:", error);
            return keys.map(() => null);
        }
    }
    /**
     * Set multiple cache values
     */
    async mset(keyValuePairs, options = {}) {
        try {
            const { ttl = this.DEFAULT_TTL, prefix = "", serialize = true } = options;
            if (this.redis && this.isConnected) {
                const pipeline = this.redis.pipeline();
                keyValuePairs.forEach(({ key, value }) => {
                    const fullKey = prefix ? `${prefix}:${key}` : key;
                    const serializedValue = serialize ? JSON.stringify(value) : value;
                    pipeline.setex(fullKey, ttl, serializedValue);
                });
                await pipeline.exec();
            }
            else {
                keyValuePairs.forEach(({ key, value }) => {
                    const fullKey = prefix ? `${prefix}:${key}` : key;
                    this.setMemoryCache(fullKey, value, ttl);
                });
            }
            return true;
        }
        catch (error) {
            logger_1.default.error("Cache mset error:", error);
            return false;
        }
    }
    /**
     * Increment counter
     */
    async increment(key, options = {}) {
        try {
            const { prefix = "", ttl } = options;
            const fullKey = prefix ? `${prefix}:${key}` : key;
            if (this.redis && this.isConnected) {
                const value = await this.redis.incr(fullKey);
                if (ttl && value === 1) {
                    await this.redis.expire(fullKey, ttl);
                }
                return value;
            }
            else {
                const current = this.getMemoryCache(fullKey) || 0;
                const newValue = current + 1;
                this.setMemoryCache(fullKey, newValue, ttl || this.DEFAULT_TTL);
                return newValue;
            }
        }
        catch (error) {
            logger_1.default.error("Cache increment error:", error);
            return 0;
        }
    }
    /**
     * Rate limiting
     */
    async checkRateLimit(identifier, options) {
        try {
            const { windowMs, maxRequests, keyGenerator } = options;
            const key = keyGenerator ? keyGenerator(identifier) : `rate_limit:${identifier}`;
            const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
            if (this.redis && this.isConnected) {
                const pipeline = this.redis.pipeline();
                pipeline.zremrangebyscore(key, 0, Date.now() - windowMs);
                pipeline.zcard(key);
                pipeline.zadd(key, Date.now(), `${Date.now()}-${Math.random()}`);
                pipeline.expire(key, Math.ceil(windowMs / 1000));
                const results = await pipeline.exec();
                const currentCount = results?.[1]?.[1] || 0;
                const allowed = currentCount < maxRequests;
                const remaining = Math.max(0, maxRequests - currentCount - 1);
                const resetTime = windowStart + windowMs;
                return { allowed, remaining, resetTime };
            }
            else {
                // Memory-based rate limiting
                const requests = this.getMemoryCache(key) || [];
                const now = Date.now();
                const validRequests = requests.filter((timestamp) => now - timestamp < windowMs);
                const allowed = validRequests.length < maxRequests;
                if (allowed) {
                    validRequests.push(now);
                    this.setMemoryCache(key, validRequests, Math.ceil(windowMs / 1000));
                }
                return {
                    allowed,
                    remaining: Math.max(0, maxRequests - validRequests.length - (allowed ? 1 : 0)),
                    resetTime: windowStart + windowMs,
                };
            }
        }
        catch (error) {
            logger_1.default.error("Rate limit check error:", error);
            return { allowed: true, remaining: options.maxRequests, resetTime: Date.now() + options.windowMs };
        }
    }
    /**
     * Session storage
     */
    async setSession(sessionId, data, ttl = 86400) {
        return this.set(sessionId, data, { prefix: "session", ttl });
    }
    async getSession(sessionId) {
        return this.get(sessionId, { prefix: "session" });
    }
    async deleteSession(sessionId) {
        return this.delete(sessionId, { prefix: "session" });
    }
    /**
     * Cache with automatic refresh
     */
    async getOrSet(key, fetcher, options = {}) {
        try {
            const cached = await this.get(key, options);
            if (cached !== null) {
                return cached;
            }
            const fresh = await fetcher();
            await this.set(key, fresh, options);
            return fresh;
        }
        catch (error) {
            logger_1.default.error("Cache getOrSet error:", error);
            throw error;
        }
    }
    /**
     * Clear cache by pattern
     */
    async clearByPattern(pattern) {
        try {
            if (this.redis && this.isConnected) {
                const keys = await this.redis.keys(pattern);
                if (keys.length > 0) {
                    await this.redis.del(...keys);
                    return keys.length;
                }
                return 0;
            }
            else {
                let count = 0;
                const regex = new RegExp(pattern.replace(/\*/g, ".*"));
                for (const key of this.memoryCache.keys()) {
                    if (regex.test(key)) {
                        this.memoryCache.delete(key);
                        count++;
                    }
                }
                return count;
            }
        }
        catch (error) {
            logger_1.default.error("Clear cache by pattern error:", error);
            return 0;
        }
    }
    /**
     * Get cache statistics
     */
    async getStats() {
        try {
            if (this.redis && this.isConnected) {
                const info = await this.redis.info("memory");
                const keyCount = await this.redis.dbsize();
                return {
                    connected: true,
                    keyCount,
                    memoryUsage: this.parseRedisMemoryUsage(info),
                };
            }
            else {
                return {
                    connected: false,
                    keyCount: this.memoryCache.size,
                };
            }
        }
        catch (error) {
            logger_1.default.error("Get cache stats error:", error);
            return {
                connected: false,
                keyCount: 0,
            };
        }
    }
    /**
     * Flush all cache
     */
    async flush() {
        try {
            if (this.redis && this.isConnected) {
                await this.redis.flushdb();
            }
            else {
                this.memoryCache.clear();
            }
            return true;
        }
        catch (error) {
            logger_1.default.error("Cache flush error:", error);
            return false;
        }
    }
    /**
     * Close Redis connection
     */
    async close() {
        try {
            if (this.redis) {
                await this.redis.quit();
                this.isConnected = false;
            }
        }
        catch (error) {
            logger_1.default.error("Redis close error:", error);
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        const result = { redis: false, memory: true };
        try {
            if (this.redis && this.isConnected) {
                await this.redis.ping();
                result.redis = true;
            }
        }
        catch (error) {
            logger_1.default.error("Redis health check failed:", error);
        }
        return result;
    }
    setMemoryCache(key, value, ttl) {
        // Implement LRU eviction if cache is full
        if (this.memoryCache.size >= this.MEMORY_CACHE_SIZE) {
            const firstKey = this.memoryCache.keys().next().value;
            if (firstKey) {
                this.memoryCache.delete(firstKey);
            }
        }
        this.memoryCache.set(key, {
            data: value,
            expires: Date.now() + ttl * 1000,
        });
    }
    getMemoryCache(key) {
        const cached = this.memoryCache.get(key);
        if (!cached)
            return null;
        if (Date.now() > cached.expires) {
            this.memoryCache.delete(key);
            return null;
        }
        return cached.data;
    }
    isMemoryCacheExpired(key) {
        const cached = this.memoryCache.get(key);
        return !cached || Date.now() > cached.expires;
    }
    parseRedisMemoryUsage(info) {
        const match = info.match(/used_memory:(\d+)/);
        return match ? Number.parseInt(match[1]) : 0;
    }
}
exports.CacheService = CacheService;
