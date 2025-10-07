/**
 * Redis key naming constants for organization and consistency
 */

export const REDIS_KEYS = {
  // Session caching
  SESSION: {
    METADATA: (sessionId: string) => `session:${sessionId}:metadata`,
    TRANSCRIPT: (sessionId: string) => `session:${sessionId}:transcript`,
    SPEAKERS: (sessionId: string) => `session:${sessionId}:speakers`,
    LOCK: (sessionId: string) => `session:${sessionId}:lock`,
  },

  // User data
  USER: {
    PROFILE: (userId: string) => `user:${userId}:profile`,
    SETTINGS: (userId: string) => `user:${userId}:settings`,
    API_KEYS: (userId: string) => `user:${userId}:api-keys`,
    SUBSCRIPTION: (userId: string) => `user:${userId}:subscription`,
  },

  // Share links
  SHARE: {
    TOKEN: (token: string) => `share:${token}`,
    METADATA: (token: string) => `share:${token}:metadata`,
    ACCESS_LOG: (token: string) => `share:${token}:access`,
  },

  // API usage tracking
  USAGE: {
    ASR: (userId: string, provider: string, period: string) =>
      `usage:asr:${userId}:${provider}:${period}`,
    AI: (userId: string, provider: string, period: string) =>
      `usage:ai:${userId}:${provider}:${period}`,
    STORAGE: (userId: string, period: string) => `usage:storage:${userId}:${period}`,
    TOTAL: (userId: string, period: string) => `usage:total:${userId}:${period}`,
  },

  // Cost tracking
  COST: {
    ASR: (userId: string, period: string) => `cost:asr:${userId}:${period}`,
    AI: (userId: string, period: string) => `cost:ai:${userId}:${period}`,
    TOTAL: (userId: string, period: string) => `cost:total:${userId}:${period}`,
  },

  // Feature flags
  FEATURE: {
    FLAG: (flagName: string) => `feature:${flagName}`,
    USER: (userId: string) => `feature:user:${userId}`,
  },

  // Temporary locks
  LOCK: {
    EXPORT: (exportId: string) => `lock:export:${exportId}`,
    BACKUP: (backupId: string) => `lock:backup:${backupId}`,
    DOCUMENT: (documentId: string) => `lock:document:${documentId}`,
  },

  // Cache
  CACHE: {
    MATTER: (matterId: string) => `cache:matter:${matterId}`,
    CITATION: (citationId: string) => `cache:citation:${citationId}`,
    TEMPLATE: (templateId: string) => `cache:template:${templateId}`,
  },

  // Job queues
  QUEUE: {
    TRANSCRIPTION: 'queue:transcription',
    EXPORT: 'queue:export',
    BACKUP: 'queue:backup',
    AI_PROCESSING: 'queue:ai-processing',
  },

  // Analytics
  ANALYTICS: {
    PAGE_VIEW: (path: string, period: string) => `analytics:pageview:${path}:${period}`,
    EVENT: (event: string, period: string) => `analytics:event:${event}:${period}`,
    USER_ACTIVITY: (userId: string) => `analytics:user:${userId}:activity`,
  },
} as const

/**
 * TTL constants (in seconds)
 */
export const REDIS_TTL = {
  // Short-lived (minutes)
  ONE_MINUTE: 60,
  FIVE_MINUTES: 300,
  FIFTEEN_MINUTES: 900,
  THIRTY_MINUTES: 1800,

  // Medium-lived (hours)
  ONE_HOUR: 3600,
  SIX_HOURS: 21600,
  TWELVE_HOURS: 43200,

  // Long-lived (days)
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
  ONE_MONTH: 2592000,

  // Session-specific
  SESSION_METADATA: 3600, // 1 hour
  SESSION_TRANSCRIPT: 86400, // 1 day
  SESSION_LOCK: 300, // 5 minutes

  // Share links
  SHARE_TOKEN: 86400, // 1 day (or custom)

  // Cache
  CACHE_SHORT: 300, // 5 minutes
  CACHE_MEDIUM: 3600, // 1 hour
  CACHE_LONG: 86400, // 1 day

  // Usage tracking
  USAGE_CURRENT_MONTH: 2592000, // 30 days
  USAGE_PREVIOUS_MONTH: 2592000, // 30 days
} as const

/**
 * Helper to generate period keys for time-based tracking
 */
export function getPeriodKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Helper to generate daily period keys
 */
export function getDailyPeriodKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Helper to generate hourly period keys
 */
export function getHourlyPeriodKey(date: Date = new Date()): string {
  const daily = getDailyPeriodKey(date)
  const hour = String(date.getHours()).padStart(2, '0')
  return `${daily}-${hour}`
}
