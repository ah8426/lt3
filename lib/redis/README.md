# Redis Integration (Upstash)

Complete Redis setup for Law Transcribed using Upstash Redis for caching, rate limiting, and usage tracking.

## Setup

### 1. Install Dependencies

```bash
pnpm install @upstash/redis @upstash/ratelimit
```

### 2. Environment Variables

Add to your `.env.local`:

```env
UPSTASH_REDIS_REST_URL=your_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_redis_rest_token
```

Get these from your [Upstash Console](https://console.upstash.com/).

### 3. Upstash Console Setup

1. Create a new Redis database at [console.upstash.com](https://console.upstash.com/)
2. Choose a region close to your deployment (e.g., us-east-1 for Vercel US)
3. Copy the REST URL and REST Token to your `.env.local`

## Architecture

```
lib/redis/
├── client.ts       # Singleton Redis client with type-safe operations
├── rate-limit.ts   # Rate limiting configurations
├── cache.ts        # Caching utilities for sessions, users, API usage
├── keys.ts         # Key naming constants and TTL values
├── index.ts        # Clean exports
└── README.md       # This file
```

## Usage

### Basic Redis Operations

```typescript
import { redisClient } from '@/lib/redis'

// Set a value with TTL (in seconds)
await redisClient.set('key', 'value', 3600) // 1 hour

// Get a value
const value = await redisClient.get<string>('key')

// Delete a key
await redisClient.del('key')

// Check if key exists
const exists = await redisClient.exists('key') // Returns 1 or 0
```

### Rate Limiting

#### IP-based Rate Limiting (Public Routes)

```typescript
import { checkIpRateLimit, getRateLimitHeaders } from '@/lib/redis'

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  const { success, limit, remaining, reset } = await checkIpRateLimit(ip)

  if (!success) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: getRateLimitHeaders({ limit, remaining, reset }),
    })
  }

  // Continue with request...
}
```

**Limit:** 100 requests per minute per IP

#### User-based Rate Limiting (Authenticated Routes)

```typescript
import { checkUserRateLimit } from '@/lib/redis'

export async function POST(request: Request) {
  const userId = await getUserId() // Your auth function
  const { success } = await checkUserRateLimit(userId)

  if (!success) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

  // Continue with request...
}
```

**Limit:** 1000 requests per minute per user

#### Available Rate Limiters

| Rate Limiter | Limit | Use Case |
|--------------|-------|----------|
| `ipRateLimit` | 100/min | Public API endpoints |
| `userRateLimit` | 1000/min | Authenticated users |
| `shareLinkRateLimit` | 50/hour | Share link access |
| `asrRateLimit` | 60/min | ASR/transcription API |
| `aiRateLimit` | 100/hour | AI/LLM API calls |
| `authRateLimit` | 5/15min | Authentication attempts |
| `uploadRateLimit` | 20/hour | File uploads |
| `exportRateLimit` | 10/hour | Document exports |

#### Custom Rate Limiting

```typescript
import { asrRateLimit } from '@/lib/redis'

const identifier = `${userId}:${provider}`
const { success, limit, reset, remaining } = await asrRateLimit.limit(identifier)
```

### Session Caching

```typescript
import { sessionCache } from '@/lib/redis'

// Cache session metadata
await sessionCache.setMetadata('session_123', {
  matterId: 'matter_456',
  userId: 'user_789',
  status: 'active',
})

// Get cached metadata
const metadata = await sessionCache.getMetadata('session_123')

// Cache transcript
await sessionCache.setTranscript('session_123', transcriptData)

// Get cached transcript
const transcript = await sessionCache.getTranscript('session_123')

// Invalidate all session caches
await sessionCache.invalidate('session_123')
```

**TTL:**
- Session metadata: 1 hour
- Session transcript: 1 day

### Share Token Management

```typescript
import { shareTokenCache } from '@/lib/redis'

// Create share token
const token = 'abc123'
await shareTokenCache.set(token, {
  sessionId: 'session_123',
  expiresAt: Date.now() + 86400000, // 1 day
  permissions: ['view', 'comment'],
})

// Validate token
const isValid = await shareTokenCache.validate(token)

// Get token data
const data = await shareTokenCache.get(token)

// Log access
await shareTokenCache.logAccess(token, '192.168.1.1')

// Get access log
const accessLog = await shareTokenCache.getAccessLog(token)

// Invalidate token
await shareTokenCache.invalidate(token)
```

**TTL:** 1 day (configurable)

### API Usage Tracking

```typescript
import { apiUsageCache } from '@/lib/redis'

// Track ASR usage
await apiUsageCache.trackAsrUsage(
  'user_123',
  'deepgram',
  15.5, // minutes
  0.25  // cost in dollars
)

// Track AI usage
await apiUsageCache.trackAiUsage(
  'user_123',
  'anthropic',
  1500, // tokens
  0.045 // cost in dollars
)

// Get usage for current month
const period = '2025-10' // YYYY-MM format
const asrMinutes = await apiUsageCache.getAsrUsage('user_123', 'deepgram', period)
const aiTokens = await apiUsageCache.getAiUsage('user_123', 'anthropic', period)

// Get total cost
const totalCost = await apiUsageCache.getTotalCost('user_123', period)
```

**TTL:** 30 days for current month

### User Caching

```typescript
import { userCache } from '@/lib/redis'

// Cache user settings
await userCache.setSettings('user_123', {
  theme: 'dark',
  language: 'en',
  notifications: true,
})

// Get cached settings
const settings = await userCache.getSettings('user_123')

// Cache subscription
await userCache.setSubscription('user_123', {
  planId: 'professional',
  status: 'active',
  expiresAt: '2025-12-31',
})

// Get cached subscription
const subscription = await userCache.getSubscription('user_123')

// Invalidate all user caches
await userCache.invalidate('user_123')
```

**TTL:** 1 hour

### Generic Caching

```typescript
import { cache } from '@/lib/redis'

// Set cache with TTL
await cache.set('custom:key', { data: 'value' }, 3600)

// Get from cache
const data = await cache.get<{ data: string }>('custom:key')

// Delete from cache
await cache.delete('custom:key')

// Check existence
const exists = await cache.exists('custom:key')
```

## Key Naming Conventions

All Redis keys follow a consistent naming pattern for organization:

```typescript
import { REDIS_KEYS } from '@/lib/redis'

// Session keys
REDIS_KEYS.SESSION.METADATA('session_123')    // "session:session_123:metadata"
REDIS_KEYS.SESSION.TRANSCRIPT('session_123')  // "session:session_123:transcript"
REDIS_KEYS.SESSION.SPEAKERS('session_123')    // "session:session_123:speakers"

// User keys
REDIS_KEYS.USER.SETTINGS('user_123')          // "user:user_123:settings"
REDIS_KEYS.USER.SUBSCRIPTION('user_123')      // "user:user_123:subscription"

// Share keys
REDIS_KEYS.SHARE.TOKEN('abc123')              // "share:abc123"
REDIS_KEYS.SHARE.ACCESS_LOG('abc123')         // "share:abc123:access"

// Usage tracking
REDIS_KEYS.USAGE.ASR('user_123', 'deepgram', '2025-10')
// "usage:asr:user_123:deepgram:2025-10"

REDIS_KEYS.USAGE.AI('user_123', 'anthropic', '2025-10')
// "usage:ai:user_123:anthropic:2025-10"

// Cost tracking
REDIS_KEYS.COST.ASR('user_123', '2025-10')
// "cost:asr:user_123:2025-10"
```

See [keys.ts](keys.ts) for the complete list of key naming patterns.

## TTL (Time-To-Live) Constants

```typescript
import { REDIS_TTL } from '@/lib/redis'

// Short-lived (minutes)
REDIS_TTL.ONE_MINUTE       // 60 seconds
REDIS_TTL.FIVE_MINUTES     // 300 seconds
REDIS_TTL.FIFTEEN_MINUTES  // 900 seconds
REDIS_TTL.THIRTY_MINUTES   // 1800 seconds

// Medium-lived (hours)
REDIS_TTL.ONE_HOUR         // 3600 seconds
REDIS_TTL.SIX_HOURS        // 21600 seconds
REDIS_TTL.TWELVE_HOURS     // 43200 seconds

// Long-lived (days)
REDIS_TTL.ONE_DAY          // 86400 seconds
REDIS_TTL.ONE_WEEK         // 604800 seconds
REDIS_TTL.ONE_MONTH        // 2592000 seconds

// Specific use cases
REDIS_TTL.SESSION_METADATA     // 1 hour
REDIS_TTL.SESSION_TRANSCRIPT   // 1 day
REDIS_TTL.SHARE_TOKEN          // 1 day
REDIS_TTL.CACHE_SHORT          // 5 minutes
REDIS_TTL.CACHE_MEDIUM         // 1 hour
REDIS_TTL.CACHE_LONG           // 1 day
```

## Advanced Usage

### Period-based Keys for Analytics

```typescript
import { getPeriodKey, getDailyPeriodKey, getHourlyPeriodKey } from '@/lib/redis'

// Monthly period (YYYY-MM)
const monthlyPeriod = getPeriodKey()           // "2025-10"
const lastMonth = getPeriodKey(new Date(2024, 8, 1))  // "2024-09"

// Daily period (YYYY-MM-DD)
const dailyPeriod = getDailyPeriodKey()        // "2025-10-06"

// Hourly period (YYYY-MM-DD-HH)
const hourlyPeriod = getHourlyPeriodKey()      // "2025-10-06-14"
```

### Sorted Sets for Access Logs

```typescript
import { redisClient } from '@/lib/redis'

// Add timestamped entry
const timestamp = Date.now()
await redisClient.zadd('log:key', timestamp, `event:${timestamp}`)

// Get entries since timestamp
const since = Date.now() - 86400000 // Last 24 hours
const entries = await redisClient.zrangebyscore('log:key', since, '+inf')

// Clean up old entries
await redisClient.zremrangebyscore('log:key', 0, since)
```

### Hash Operations for Complex Data

```typescript
import { redisClient } from '@/lib/redis'

// Set hash field
await redisClient.hset('user:123', 'email', 'user@example.com')

// Get hash field
const email = await redisClient.hget<string>('user:123', 'email')

// Get all hash fields
const user = await redisClient.hgetall('user:123')

// Increment hash field
await redisClient.hincrby('usage:123', 'requests', 1)
```

## Best Practices

### 1. Always Use TTL

Set appropriate TTL values to prevent memory bloat:

```typescript
// Bad - no TTL
await redisClient.set('key', 'value')

// Good - with TTL
await redisClient.set('key', 'value', REDIS_TTL.ONE_HOUR)
```

### 2. Use Constants for Keys

Always use `REDIS_KEYS` constants instead of hardcoding:

```typescript
// Bad - hardcoded
await redisClient.get(`session:${id}:metadata`)

// Good - using constants
await redisClient.get(REDIS_KEYS.SESSION.METADATA(id))
```

### 3. Handle Cache Misses

Always handle null returns from cache:

```typescript
const cached = await cache.get<UserData>('user:123')
if (!cached) {
  // Fetch from database
  const data = await fetchFromDB()
  // Cache for next time
  await cache.set('user:123', data, REDIS_TTL.ONE_HOUR)
  return data
}
return cached
```

### 4. Implement Cache Invalidation

Invalidate caches when data changes:

```typescript
// After updating user in database
await prisma.user.update({ where: { id }, data })

// Invalidate cached data
await userCache.invalidate(id)
```

### 5. Rate Limit Headers

Always include rate limit headers in API responses:

```typescript
const result = await checkUserRateLimit(userId)
const headers = getRateLimitHeaders(result)

return new Response(JSON.stringify(data), {
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
})
```

## Monitoring

### Check Rate Limit Analytics

Upstash provides analytics in the console for rate limiting:

1. Go to [console.upstash.com](https://console.upstash.com/)
2. Select your Redis database
3. Check the "Analytics" tab for rate limiting metrics

### Monitor Cache Hit Rates

Track cache effectiveness in your application:

```typescript
import { cache } from '@/lib/redis'

async function getCachedData(key: string) {
  const cached = await cache.get(key)

  if (cached) {
    // Log cache hit
    console.log('Cache hit:', key)
    return cached
  }

  // Log cache miss
  console.log('Cache miss:', key)

  // Fetch and cache
  const data = await fetchData()
  await cache.set(key, data, REDIS_TTL.ONE_HOUR)
  return data
}
```

## Error Handling

```typescript
import { redisClient } from '@/lib/redis'

try {
  const data = await redisClient.get('key')
  // Handle data
} catch (error) {
  console.error('Redis error:', error)
  // Fallback to database or return error
}
```

## Testing

For testing, you can mock the Redis client:

```typescript
// __mocks__/lib/redis/client.ts
export const redisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  // ... other methods
}
```

## Additional Resources

- [Upstash Redis Documentation](https://docs.upstash.com/redis)
- [Upstash Ratelimit Documentation](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Redis Commands Reference](https://redis.io/commands/)
