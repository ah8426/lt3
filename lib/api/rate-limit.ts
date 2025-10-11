import { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limit configurations
export const RATE_LIMITS = {
  // Default API limits
  default: {
    requests: 100,
    window: 60, // 1 minute
  },

  // Authentication endpoints
  auth: {
    requests: 10,
    window: 60, // 1 minute
  },

  // Transcription endpoints (more restrictive)
  transcription: {
    requests: 20,
    window: 300, // 5 minutes
  },

  // AI/Chat endpoints
  ai: {
    requests: 50,
    window: 300, // 5 minutes
  },

  // Export endpoints
  export: {
    requests: 5,
    window: 300, // 5 minutes
  },

  // Subscription tier limits
  subscription: {
    free: {
      requests: 50,
      window: 3600, // 1 hour
    },
    starter: {
      requests: 200,
      window: 3600,
    },
    professional: {
      requests: 1000,
      window: 3600,
    },
    enterprise: {
      requests: -1, // unlimited
      window: 3600,
    },
  },
} as const;

// Create rate limiters
const rateLimiters = new Map<string, Ratelimit>();

function getRateLimiter(key: string, requests: number, window: number): Ratelimit {
  if (!rateLimiters.has(key)) {
    rateLimiters.set(key, new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, `${window} s`),
      analytics: true,
      prefix: `ratelimit:${key}`,
    }));
  }
  return rateLimiters.get(key)!;
}

export interface RateLimitConfig {
  requests: number;
  window: number;
  identifier?: (req: NextRequest) => string;
}

export interface RateLimitResult {
  success: boolean;
  remaining?: number;
  resetTime?: Date;
  error?: string;
}

export async function rateLimit(
  req: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    // Skip rate limiting in development
    if (process.env.NODE_ENV === 'development') {
      return { success: true };
    }

    // Skip if unlimited requests
    if (config.requests === -1) {
      return { success: true };
    }

    // Get identifier (IP or custom function)
    const identifier = config.identifier
      ? config.identifier(req)
      : getClientIdentifier(req);

    // Get rate limiter
    const limiter = getRateLimiter(
      `${identifier}:${config.requests}:${config.window}`,
      config.requests,
      config.window
    );

    // Check rate limit
    const result = await limiter.limit(identifier);

    if (!result.success) {
      return {
        success: false,
        remaining: result.remaining,
        resetTime: new Date(result.reset),
        error: 'Rate limit exceeded'
      };
    }

    return {
      success: true,
      remaining: result.remaining,
      resetTime: new Date(result.reset)
    };

  } catch (error) {
    console.error('Rate limit error:', error);
    // Allow request on error to avoid breaking the API
    return { success: true };
  }
}

// Get client identifier for rate limiting
function getClientIdentifier(req: NextRequest): string {
  // Try to get user ID from auth token
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      // This would need to be implemented with your auth system
      // For now, fall back to IP
    }
  } catch {
    // Fall back to IP
  }

  // Get IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';

  return ip;
}

// Apply rate limit based on subscription tier
export async function rateLimitBySubscription(
  req: NextRequest,
  userTier: string = 'free'
): Promise<RateLimitResult> {
  const tierConfig = RATE_LIMITS.subscription[userTier as keyof typeof RATE_LIMITS.subscription];

  if (!tierConfig) {
    return { success: false, error: 'Invalid subscription tier' };
  }

  return rateLimit(req, {
    requests: tierConfig.requests,
    window: tierConfig.window,
    identifier: (req) => `subscription:${userTier}:${getClientIdentifier(req)}`
  });
}

// Apply rate limit based on endpoint type
export async function rateLimitByEndpoint(
  req: NextRequest,
  endpointType: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[endpointType];

  if (!config) {
    return { success: false, error: 'Invalid endpoint type' };
  }

  return rateLimit(req, {
    requests: config.requests,
    window: config.window,
    identifier: (req) => `endpoint:${endpointType}:${getClientIdentifier(req)}`
  });
}

// Middleware helper for applying multiple rate limits
export async function applyRateLimits(
  req: NextRequest,
  limits: Array<{
    type: 'subscription' | 'endpoint' | 'custom';
    config: any;
  }>
): Promise<RateLimitResult> {
  for (const limit of limits) {
    let result: RateLimitResult;

    switch (limit.type) {
      case 'subscription':
        result = await rateLimitBySubscription(req, limit.config.tier);
        break;
      case 'endpoint':
        result = await rateLimitByEndpoint(req, limit.config.type);
        break;
      case 'custom':
        result = await rateLimit(req, limit.config);
        break;
      default:
        continue;
    }

    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}

// Reset rate limit for a specific identifier
export async function resetRateLimit(identifier: string, config: RateLimitConfig): Promise<void> {
  try {
    const limiter = getRateLimiter(
      `${identifier}:${config.requests}:${config.window}`,
      config.requests,
      config.window
    );

    await limiter.reset(identifier);
  } catch (error) {
    console.error('Error resetting rate limit:', error);
  }
}

// Get current rate limit status
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): Promise<{
  remaining: number;
  resetTime: Date;
  total: number;
}> {
  try {
    const limiter = getRateLimiter(
      `${identifier}:${config.requests}:${config.window}`,
      config.requests,
      config.window
    );

    const result = await limiter.getRemaining(identifier);

    return {
      remaining: result.remaining,
      resetTime: new Date(result.reset),
      total: config.requests
    };
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return {
      remaining: config.requests,
      resetTime: new Date(Date.now() + config.window * 1000),
      total: config.requests
    };
  }
}