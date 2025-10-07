import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './client'

/**
 * Rate limiter for public API endpoints (by IP address)
 * 100 requests per minute
 */
export const ipRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'ratelimit:ip',
})

/**
 * Rate limiter for authenticated users
 * 1000 requests per minute (more generous for authenticated users)
 */
export const userRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1000, '1 m'),
  analytics: true,
  prefix: 'ratelimit:user',
})

/**
 * Rate limiter for share links (by token)
 * 50 requests per hour to prevent abuse
 */
export const shareLinkRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 h'),
  analytics: true,
  prefix: 'ratelimit:share',
})

/**
 * Rate limiter for ASR (transcription) API calls
 * 60 requests per minute (1 per second)
 */
export const asrRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
  prefix: 'ratelimit:asr',
})

/**
 * Rate limiter for AI/LLM API calls
 * 100 requests per hour
 */
export const aiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 h'),
  analytics: true,
  prefix: 'ratelimit:ai',
})

/**
 * Rate limiter for authentication attempts
 * 5 attempts per 15 minutes
 */
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  analytics: true,
  prefix: 'ratelimit:auth',
})

/**
 * Rate limiter for file uploads
 * 20 uploads per hour
 */
export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  analytics: true,
  prefix: 'ratelimit:upload',
})

/**
 * Rate limiter for exports
 * 10 exports per hour
 */
export const exportRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
  prefix: 'ratelimit:export',
})

/**
 * Helper function to check rate limit by IP
 */
export async function checkIpRateLimit(ip: string) {
  const { success, limit, reset, remaining } = await ipRateLimit.limit(ip)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}

/**
 * Helper function to check rate limit by user ID
 */
export async function checkUserRateLimit(userId: string) {
  const { success, limit, reset, remaining } = await userRateLimit.limit(userId)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}

/**
 * Helper function to check rate limit for share links
 */
export async function checkShareLinkRateLimit(token: string) {
  const { success, limit, reset, remaining } = await shareLinkRateLimit.limit(token)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}

/**
 * Helper function to check rate limit for ASR calls
 */
export async function checkAsrRateLimit(userId: string, provider: string) {
  const identifier = `${userId}:${provider}`
  const { success, limit, reset, remaining } = await asrRateLimit.limit(identifier)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}

/**
 * Helper function to check rate limit for AI calls
 */
export async function checkAiRateLimit(userId: string, provider: string) {
  const identifier = `${userId}:${provider}`
  const { success, limit, reset, remaining } = await aiRateLimit.limit(identifier)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}

/**
 * Helper function to check rate limit for auth attempts
 */
export async function checkAuthRateLimit(ip: string) {
  const { success, limit, reset, remaining } = await authRateLimit.limit(ip)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}

/**
 * Helper function to check rate limit for uploads
 */
export async function checkUploadRateLimit(userId: string) {
  const { success, limit, reset, remaining } = await uploadRateLimit.limit(userId)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}

/**
 * Helper function to check rate limit for exports
 */
export async function checkExportRateLimit(userId: string) {
  const { success, limit, reset, remaining } = await exportRateLimit.limit(userId)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}

/**
 * Get rate limit headers for HTTP responses
 */
export function getRateLimitHeaders(result: {
  limit: number
  remaining: number
  reset: number
}) {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  }
}
