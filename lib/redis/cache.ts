import { redisClient } from './client'
import { REDIS_KEYS, REDIS_TTL } from './keys'

/**
 * Session Caching
 */
export const sessionCache = {
  /**
   * Cache session metadata
   */
  async setMetadata(sessionId: string, metadata: any, ttl = REDIS_TTL.SESSION_METADATA) {
    const key = REDIS_KEYS.SESSION.METADATA(sessionId)
    await redisClient.set(key, JSON.stringify(metadata), ttl)
  },

  /**
   * Get cached session metadata
   */
  async getMetadata<T = any>(sessionId: string): Promise<T | null> {
    const key = REDIS_KEYS.SESSION.METADATA(sessionId)
    const data = await redisClient.get<string>(key)
    return data ? JSON.parse(data) : null
  },

  /**
   * Cache session transcript
   */
  async setTranscript(sessionId: string, transcript: any, ttl = REDIS_TTL.SESSION_TRANSCRIPT) {
    const key = REDIS_KEYS.SESSION.TRANSCRIPT(sessionId)
    await redisClient.set(key, JSON.stringify(transcript), ttl)
  },

  /**
   * Get cached session transcript
   */
  async getTranscript<T = any>(sessionId: string): Promise<T | null> {
    const key = REDIS_KEYS.SESSION.TRANSCRIPT(sessionId)
    const data = await redisClient.get<string>(key)
    return data ? JSON.parse(data) : null
  },

  /**
   * Invalidate session cache
   */
  async invalidate(sessionId: string) {
    await Promise.all([
      redisClient.del(REDIS_KEYS.SESSION.METADATA(sessionId)),
      redisClient.del(REDIS_KEYS.SESSION.TRANSCRIPT(sessionId)),
      redisClient.del(REDIS_KEYS.SESSION.SPEAKERS(sessionId)),
    ])
  },
}

/**
 * Share Token Validation & Caching
 */
export const shareTokenCache = {
  /**
   * Cache share token data
   */
  async set(token: string, data: any, ttl?: number) {
    const key = REDIS_KEYS.SHARE.TOKEN(token)
    await redisClient.set(key, JSON.stringify(data), ttl || REDIS_TTL.SHARE_TOKEN)
  },

  /**
   * Get share token data
   */
  async get<T = any>(token: string): Promise<T | null> {
    const key = REDIS_KEYS.SHARE.TOKEN(token)
    const data = await redisClient.get<string>(key)
    return data ? JSON.parse(data) : null
  },

  /**
   * Validate share token
   */
  async validate(token: string): Promise<boolean> {
    const key = REDIS_KEYS.SHARE.TOKEN(token)
    const exists = await redisClient.exists(key)
    return exists === 1
  },

  /**
   * Invalidate share token
   */
  async invalidate(token: string) {
    const key = REDIS_KEYS.SHARE.TOKEN(token)
    await redisClient.del(key)
  },

  /**
   * Log share token access
   */
  async logAccess(token: string, ip: string) {
    const key = REDIS_KEYS.SHARE.ACCESS_LOG(token)
    const timestamp = Date.now()
    await redisClient.zadd(key, timestamp, `${ip}:${timestamp}`)
    // Keep access logs for 30 days
    await redisClient.expire(key, REDIS_TTL.ONE_MONTH)
  },

  /**
   * Get access log for token
   */
  async getAccessLog(token: string, since?: number): Promise<string[]> {
    const key = REDIS_KEYS.SHARE.ACCESS_LOG(token)
    const min = since || 0
    return await redisClient.zrangebyscore(key, min, '+inf')
  },
}

/**
 * API Key Usage Tracking
 */
export const apiUsageCache = {
  /**
   * Track ASR usage
   */
  async trackAsrUsage(userId: string, provider: string, minutes: number, cost: number) {
    const period = getCurrentPeriod()
    const usageKey = REDIS_KEYS.USAGE.ASR(userId, provider, period)
    const costKey = REDIS_KEYS.COST.ASR(userId, period)

    await Promise.all([
      redisClient.incrby(usageKey, Math.round(minutes * 100)), // Store as centminutes
      redisClient.incrby(costKey, Math.round(cost * 100)), // Store as cents
      redisClient.expire(usageKey, REDIS_TTL.USAGE_CURRENT_MONTH),
      redisClient.expire(costKey, REDIS_TTL.USAGE_CURRENT_MONTH),
    ])
  },

  /**
   * Track AI usage
   */
  async trackAiUsage(userId: string, provider: string, tokens: number, cost: number) {
    const period = getCurrentPeriod()
    const usageKey = REDIS_KEYS.USAGE.AI(userId, provider, period)
    const costKey = REDIS_KEYS.COST.AI(userId, period)

    await Promise.all([
      redisClient.incrby(usageKey, tokens),
      redisClient.incrby(costKey, Math.round(cost * 100)), // Store as cents
      redisClient.expire(usageKey, REDIS_TTL.USAGE_CURRENT_MONTH),
      redisClient.expire(costKey, REDIS_TTL.USAGE_CURRENT_MONTH),
    ])
  },

  /**
   * Get ASR usage for period
   */
  async getAsrUsage(userId: string, provider: string, period: string): Promise<number> {
    const key = REDIS_KEYS.USAGE.ASR(userId, provider, period)
    const value = await redisClient.get<number>(key)
    return value ? value / 100 : 0 // Convert centminutes to minutes
  },

  /**
   * Get AI usage for period
   */
  async getAiUsage(userId: string, provider: string, period: string): Promise<number> {
    const key = REDIS_KEYS.USAGE.AI(userId, provider, period)
    const value = await redisClient.get<number>(key)
    return value || 0
  },

  /**
   * Get total cost for period
   */
  async getTotalCost(userId: string, period: string): Promise<number> {
    const [asrCost, aiCost] = await Promise.all([
      redisClient.get<number>(REDIS_KEYS.COST.ASR(userId, period)),
      redisClient.get<number>(REDIS_KEYS.COST.AI(userId, period)),
    ])

    const total = (asrCost || 0) + (aiCost || 0)
    return total / 100 // Convert cents to dollars
  },
}

/**
 * User Settings Cache
 */
export const userCache = {
  /**
   * Cache user settings
   */
  async setSettings(userId: string, settings: any, ttl = REDIS_TTL.ONE_HOUR) {
    const key = REDIS_KEYS.USER.SETTINGS(userId)
    await redisClient.set(key, JSON.stringify(settings), ttl)
  },

  /**
   * Get cached user settings
   */
  async getSettings<T = any>(userId: string): Promise<T | null> {
    const key = REDIS_KEYS.USER.SETTINGS(userId)
    const data = await redisClient.get<string>(key)
    return data ? JSON.parse(data) : null
  },

  /**
   * Cache user subscription data
   */
  async setSubscription(userId: string, subscription: any, ttl = REDIS_TTL.ONE_HOUR) {
    const key = REDIS_KEYS.USER.SUBSCRIPTION(userId)
    await redisClient.set(key, JSON.stringify(subscription), ttl)
  },

  /**
   * Get cached user subscription
   */
  async getSubscription<T = any>(userId: string): Promise<T | null> {
    const key = REDIS_KEYS.USER.SUBSCRIPTION(userId)
    const data = await redisClient.get<string>(key)
    return data ? JSON.parse(data) : null
  },

  /**
   * Invalidate user cache
   */
  async invalidate(userId: string) {
    await Promise.all([
      redisClient.del(REDIS_KEYS.USER.SETTINGS(userId)),
      redisClient.del(REDIS_KEYS.USER.SUBSCRIPTION(userId)),
      redisClient.del(REDIS_KEYS.USER.API_KEYS(userId)),
    ])
  },
}

/**
 * Generic cache utilities
 */
export const cache = {
  /**
   * Set cache with TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await redisClient.set(key, JSON.stringify(value), ttl)
  },

  /**
   * Get from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const data = await redisClient.get<string>(key)
    return data ? JSON.parse(data) : null
  },

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<void> {
    await redisClient.del(key)
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await redisClient.exists(key)
    return result === 1
  },
}

/**
 * Helper to get current period (YYYY-MM)
 */
function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
