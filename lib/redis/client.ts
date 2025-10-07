import { Redis } from '@upstash/redis'

if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error('UPSTASH_REDIS_REST_URL is not defined')
}

if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_TOKEN is not defined')
}

// Singleton Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Type-safe Redis operations
export const redisClient = {
  /**
   * Get a value from Redis
   */
  async get<T = string>(key: string): Promise<T | null> {
    return await redis.get<T>(key)
  },

  /**
   * Set a value in Redis with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return await redis.set(key, value, { ex: ttl })
    }
    return await redis.set(key, value)
  },

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<number> {
    return await redis.del(key)
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    return await redis.exists(key)
  },

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    return await redis.incr(key)
  },

  /**
   * Increment a counter by a specific amount
   */
  async incrby(key: string, amount: number): Promise<number> {
    return await redis.incrby(key, amount)
  },

  /**
   * Set expiration time on a key
   */
  async expire(key: string, seconds: number): Promise<number> {
    return await redis.expire(key, seconds)
  },

  /**
   * Get time to live for a key
   */
  async ttl(key: string): Promise<number> {
    return await redis.ttl(key)
  },

  /**
   * Get multiple values at once
   */
  async mget<T = string>(...keys: string[]): Promise<(T | null)[]> {
    return await redis.mget<T>(...keys)
  },

  /**
   * Set multiple values at once
   */
  async mset(data: Record<string, any>): Promise<'OK'> {
    return await redis.mset(data)
  },

  /**
   * Add to a sorted set with score
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    return await redis.zadd(key, { score, member })
  },

  /**
   * Get sorted set range by score
   */
  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<string[]> {
    return await redis.zrangebyscore(key, min, max)
  },

  /**
   * Remove from sorted set by score
   */
  async zremrangebyscore(
    key: string,
    min: number | string,
    max: number | string
  ): Promise<number> {
    return await redis.zremrangebyscore(key, min, max)
  },

  /**
   * Add to a hash
   */
  async hset(key: string, field: string, value: any): Promise<number> {
    return await redis.hset(key, { [field]: value })
  },

  /**
   * Get from a hash
   */
  async hget<T = string>(key: string, field: string): Promise<T | null> {
    return await redis.hget<T>(key, field)
  },

  /**
   * Get all fields from a hash
   */
  async hgetall<T = Record<string, string>>(key: string): Promise<T> {
    return await redis.hgetall<T>(key)
  },

  /**
   * Delete field from hash
   */
  async hdel(key: string, ...fields: string[]): Promise<number> {
    return await redis.hdel(key, ...fields)
  },

  /**
   * Increment hash field
   */
  async hincrby(key: string, field: string, amount: number): Promise<number> {
    return await redis.hincrby(key, field, amount)
  },
}
