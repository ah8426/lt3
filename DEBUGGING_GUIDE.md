# Law Transcribed - Comprehensive Debugging Guide

## Executive Summary

This guide provides detailed debugging scenarios, root cause analysis, and solutions for common issues in the Law Transcribed Next.js application with Prisma, Supabase, Redis, and AI/ASR integrations.

---

## Table of Contents

1. [Database Connection Issues](#1-database-connection-issues)
2. [Authentication/Authorization Failures](#2-authenticationauthorization-failures)
3. [API Route Errors](#3-api-route-errors)
4. [Provider Manager Failures](#4-provider-manager-failures)
5. [Encryption/Decryption Errors](#5-encryptiondecryption-errors)
6. [Rate Limiting Issues](#6-rate-limiting-issues)
7. [Streaming/WebSocket Failures](#7-streamingwebsocket-failures)
8. [Environment Configuration Problems](#8-environment-configuration-problems)
9. [Type Safety Issues](#9-type-safety-issues)
10. [Performance/Memory Issues](#10-performancememory-issues)

---

## 1. Database Connection Issues

### Issue 1.1: Prisma Client Not Generated

#### Error Message
```
Error: @prisma/client did not initialize yet. Please run "prisma generate"
```

#### Root Cause
The Prisma Client is generated at build time but not available at runtime, typically occurring when:
- Dependencies installed but `prisma generate` not run
- Build cache includes stale generated client
- Multiple Prisma schema versions conflict

#### Reproduction Steps
1. Clone repository
2. Run `pnpm install` without post-install hooks
3. Start dev server with `pnpm dev`
4. Access any database-dependent route
5. Error occurs on first Prisma query

#### Evidence
**File:** `C:\lt3.0\lib\prisma\client.ts`
```typescript
// Singleton pattern - client may not be initialized
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()
```

**File:** `C:\lt3.0\lib\server\db.ts`
```typescript
// Duplicate Prisma client export - potential initialization conflict
export const prisma = globalForPrisma.prisma ?? new PrismaClient({...})
```

#### Solution Approaches

**Solution A: Add Post-Install Hook (Recommended)**
```json
// package.json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```
**Pros:** Automatic, works in all environments
**Cons:** Adds ~2-3s to install time

**Solution B: Manual Generation in Build Process**
```json
{
  "scripts": {
    "build": "prisma generate && node --require ./node-preload.js ./node_modules/next/dist/bin/next build"
  }
}
```
**Pros:** Explicit control, no install overhead
**Cons:** Developers must remember to run manually

**Solution C: Dynamic Import with Error Handling**
```typescript
// lib/prisma/client.ts
import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  } catch (error) {
    console.error('Prisma Client initialization failed:', error)
    throw new Error(
      'Prisma Client not generated. Run "pnpm db:generate" or "prisma generate"'
    )
  }
}
```
**Pros:** Better error messaging
**Cons:** Still requires manual intervention

#### Recommended Fix
**Implement Solution A + C** for robustness:

```json
// package.json
{
  "scripts": {
    "postinstall": "prisma generate",
    "dev": "prisma generate && next dev",
    "build": "prisma generate && node --require ./node-preload.js ./node_modules/next/dist/bin/next build"
  }
}
```

#### Prevention
- Add pre-commit hook to verify Prisma client generation
- Include Prisma generate check in CI/CD pipeline
- Document in README.md

---

### Issue 1.2: Database Connection Pool Exhaustion

#### Error Message
```
Error: Connection pool timeout. Unable to acquire connection from pool
```

#### Root Cause
Multiple causes identified in codebase:

1. **Dual Prisma Client Instances**
   - `C:\lt3.0\lib\prisma\client.ts` exports `prisma`
   - `C:\lt3.0\lib\server\db.ts` also exports `prisma`
   - Different imports may create separate connection pools

2. **Missing Connection Limits**
   ```typescript
   // Current implementation lacks explicit pool configuration
   new PrismaClient({
     log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
   })
   ```

3. **Middleware Session Refreshes**
   Every request through middleware potentially creates Supabase client

#### Evidence
**File:** `C:\lt3.0\.env.example` (Line 7)
```bash
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true&connection_limit=1"
```
Note: `connection_limit=1` is too restrictive for application load

#### Solution Approaches

**Solution A: Consolidate Prisma Exports**
```typescript
// lib/prisma/index.ts (NEW FILE)
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Export as default and named
export default prisma
```

Delete `lib/server/db.ts` and update all imports:
```typescript
// Before
import { prisma } from '@/lib/server/db'

// After
import { prisma } from '@/lib/prisma'
```

**Solution B: Configure Connection Pool Limits**
```typescript
// lib/prisma/index.ts
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
}).$extends({
  query: {
    $allModels: {
      async $allOperations({ operation, model, args, query }) {
        const start = performance.now()
        const result = await query(args)
        const end = performance.now()

        if (end - start > 1000) {
          console.warn(`Slow query detected: ${model}.${operation} took ${end - start}ms`)
        }

        return result
      },
    },
  },
})
```

**Solution C: Update Environment Configuration**
```bash
# .env.local
# Connection pooling with pgbouncer (for serverless environments)
DATABASE_URL="postgresql://user:password@host:6543/postgres?pgbouncer=true&connection_limit=10&pool_timeout=10"

# Direct connection (for migrations)
DIRECT_URL="postgresql://user:password@host:5432/postgres"
```

#### Recommended Fix
**Implement All Three Solutions:**

1. **Immediate:** Update `.env.local`
2. **Short-term:** Consolidate Prisma exports (Solution A)
3. **Long-term:** Add connection monitoring (Solution B)

#### Testing Approach
```typescript
// tests/database-connections.test.ts
import { prisma } from '@/lib/prisma'

describe('Database Connection Pool', () => {
  it('should handle concurrent queries without exhaustion', async () => {
    const promises = Array.from({ length: 20 }, (_, i) =>
      prisma.user.count()
    )

    await expect(Promise.all(promises)).resolves.toBeDefined()
  })

  it('should reuse connections efficiently', async () => {
    const start = Date.now()

    for (let i = 0; i < 100; i++) {
      await prisma.$queryRaw`SELECT 1`
    }

    const duration = Date.now() - start
    expect(duration).toBeLessThan(5000) // Should complete in <5s
  })
})
```

---

## 2. Authentication/Authorization Failures

### Issue 2.1: Middleware Redirect Loop

#### Error Message
```
ERR_TOO_MANY_REDIRECTS
The page isn't redirecting properly
```

#### Root Cause
Middleware at `C:\lt3.0\middleware.ts` causes infinite redirect when:
- User is authenticated but accessing `/login`
- Protected route redirects to `/login` which redirects to `/dashboard`
- Session refresh fails in middleware

#### Reproduction Steps
1. User logs in successfully
2. Browser navigates to `/login` directly
3. Middleware checks `isAuthPath && user` (line 83)
4. Redirects to `/dashboard`
5. If user session expired during redirect, redirects back to `/login`
6. Loop continues

#### Evidence
**File:** `C:\lt3.0\lib\supabase\middleware.ts` (Lines 74-88)
```typescript
// Redirect logic
if (isProtectedPath && !user) {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('redirectTo', request.nextUrl.pathname)
  return NextResponse.redirect(url)
}

if (isAuthPath && user) {
  const url = request.nextUrl.clone()
  url.pathname = '/dashboard'
  return NextResponse.redirect(url)
}
```

**Potential Issue:** No check for existing `redirectTo` parameter in redirect loop

#### Solution Approaches

**Solution A: Add Redirect Loop Detection**
```typescript
// lib/supabase/middleware.ts
export async function updateSession(request: NextRequest) {
  // Check for redirect loop
  const redirectCount = parseInt(request.cookies.get('redirect_count')?.value || '0', 10)

  if (redirectCount > 5) {
    console.error('Redirect loop detected, breaking cycle')
    const url = request.nextUrl.clone()
    url.pathname = '/'
    const response = NextResponse.redirect(url)
    response.cookies.set('redirect_count', '0', { maxAge: 0 })
    return response
  }

  let supabaseResponse = NextResponse.next({ request })

  // ... existing code ...

  // Increment redirect counter on redirects
  if (isProtectedPath && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    const response = NextResponse.redirect(url)
    response.cookies.set('redirect_count', String(redirectCount + 1), {
      maxAge: 60,
      httpOnly: true
    })
    return response
  }

  if (isAuthPath && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    const response = NextResponse.redirect(url)
    response.cookies.set('redirect_count', '0', { maxAge: 0 })
    return response
  }

  // Reset counter on successful navigation
  supabaseResponse.cookies.set('redirect_count', '0', { maxAge: 0 })
  return supabaseResponse
}
```

**Solution B: Improve Session Validation**
```typescript
// lib/supabase/middleware.ts
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Try to refresh session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  // If session refresh fails, clear all auth state
  if (sessionError) {
    console.error('Session refresh failed:', sessionError)
    await supabase.auth.signOut()

    if (isProtectedPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  // If user fetch fails but session exists, there's an issue
  if (userError && session) {
    console.error('User fetch failed despite valid session:', userError)
    await supabase.auth.signOut()
  }

  // Protected routes
  const protectedPaths = ['/dashboard', '/dictation', '/matters', '/sessions', '/settings']
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Auth routes (login, signup)
  const authPaths = ['/login', '/signup']
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Redirect logic with safety checks
  if (isProtectedPath && !user) {
    // Check if we're already in a redirect loop
    if (request.headers.get('referer')?.includes('/login')) {
      console.warn('Potential redirect loop detected from login page')
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthPath && user) {
    // Check if redirectTo parameter exists
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    const url = request.nextUrl.clone()

    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('/login')) {
      url.pathname = redirectTo
      url.searchParams.delete('redirectTo')
    } else {
      url.pathname = '/dashboard'
    }

    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

**Solution C: Client-Side Redirect Prevention**
```typescript
// app/(auth)/login/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const redirectTo = new URLSearchParams(window.location.search).get('redirectTo')
        router.replace(redirectTo || '/dashboard')
      }
    }

    checkAuth()
  }, [router])

  // ... rest of component
}
```

#### Recommended Fix
**Implement Solution B** - Most comprehensive, addresses root causes

#### Testing Approach
```typescript
// tests/middleware-redirects.test.ts
import { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

describe('Middleware Redirect Safety', () => {
  it('should not create redirect loops for authenticated users', async () => {
    const request = new NextRequest('http://localhost:3000/login', {
      headers: {
        cookie: 'sb-access-token=valid-token',
      },
    })

    const response = await updateSession(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/dashboard')
  })

  it('should handle expired sessions gracefully', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'sb-access-token=expired-token',
      },
    })

    const response = await updateSession(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })
})
```

---

### Issue 2.2: getUser() Returns Null Despite Valid Session

#### Error Message
```
Error: Unauthorized
User is null after successful authentication
```

#### Root Cause
Race condition between session creation and user fetch, especially with:
- Supabase session refresh timing
- Cookie synchronization delays in middleware
- Next.js server component caching

#### Evidence
**File:** `C:\lt3.0\lib\supabase\auth.ts` (Lines 69-82)
```typescript
export async function getUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    throw error
  }

  return user  // Can be null even if session exists
}
```

**File:** `C:\lt3.0\lib\supabase\server.ts` (Lines 13-24)
```typescript
get(name: string) {
  return cookieStore.get(name)?.value
},
set(name: string, value: string, options: any) {
  try {
    cookieStore.set(name, value, options)
  } catch {
    // The `set` method was called from a Server Component.
    // This can be ignored if you have middleware refreshing user sessions.
  }
},
```

**Issue:** Silent cookie set failures in Server Components

#### Solution Approaches

**Solution A: Add Session Validation**
```typescript
// lib/supabase/auth.ts
export async function getUser() {
  const supabase = await createClient()

  // First check if we have a session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    console.error('Session error:', sessionError)
    throw sessionError
  }

  if (!session) {
    return null
  }

  // Then get user data
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError) {
    console.error('User fetch error:', userError)

    // If we have a session but can't get user, try refreshing
    const { data: { session: refreshedSession } } = await supabase.auth.refreshSession()

    if (refreshedSession) {
      const { data: { user: refreshedUser } } = await supabase.auth.getUser()
      return refreshedUser
    }

    throw userError
  }

  return user
}
```

**Solution B: Implement Retry Logic**
```typescript
// lib/supabase/auth.ts
export async function getUser(retries = 2): Promise<User | null> {
  const supabase = await createClient()

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        if (attempt < retries) {
          console.warn(`getUser attempt ${attempt + 1} failed, retrying...`)
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
          continue
        }
        throw error
      }

      return user
    } catch (error) {
      if (attempt === retries) {
        console.error('getUser failed after retries:', error)
        throw error
      }
    }
  }

  return null
}
```

**Solution C: Add Logging and Diagnostics**
```typescript
// lib/supabase/auth.ts
export async function getUser() {
  const supabase = await createClient()

  // Log session state for debugging
  const { data: { session } } = await supabase.auth.getSession()

  if (process.env.NODE_ENV === 'development') {
    console.log('Auth state:', {
      hasSession: !!session,
      sessionExpiry: session?.expires_at,
      currentTime: Math.floor(Date.now() / 1000),
    })
  }

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    console.error('getUser error:', {
      message: error.message,
      status: error.status,
      hasSession: !!session,
    })
    throw error
  }

  if (!user && session) {
    console.warn('Session exists but user is null - possible race condition')
  }

  return user
}
```

#### Recommended Fix
**Implement Solution A + C** for robustness and visibility

---

## 3. API Route Errors

### Issue 3.1: API Key Decryption Failure

#### Error Message
```
Error: Failed to decrypt API key
Decryption error: Invalid encrypted key format
```

#### Root Cause
Multiple failure points identified:

1. **Missing Environment Variable**
   ```typescript
   // File: C:\lt3.0\lib\server\encryption\key-manager.ts (Line 33)
   if (!masterKeyHex) {
     throw new Error(
       'ENCRYPTION_MASTER_KEY not found in environment variables. ' +
       'Generate one using: openssl rand -hex 32'
     )
   }
   ```

2. **Version Mismatch**
   ```typescript
   // File: C:\lt3.0\lib\server\encryption\key-manager.ts (Line 113)
   if (version !== ENCRYPTION_VERSION) {
     throw new Error(`Unsupported encryption version: ${version}`)
   }
   ```

3. **Invalid Key Format**
   ```typescript
   // File: C:\lt3.0\lib\server\encryption\key-manager.ts (Line 106)
   if (parts.length !== 3) {
     throw new Error('Invalid encrypted key format')
   }
   ```

#### Evidence
**File:** `C:\lt3.0\app\api\api-keys\[provider]\route.ts` (Lines 49-56)
```typescript
// Decrypt the API key
const decryptedKey = await decryptAPIKey(apiKey.encryptedKey, user.id);

// Update last used timestamp
await prisma.encryptedApiKey.update({
  where: { id: apiKey.id },
  data: { lastUsedAt: new Date() },
});
```

**No error handling** around decryption call

#### Solution Approaches

**Solution A: Add Comprehensive Error Handling**
```typescript
// app/api/api-keys/[provider]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider } = await params;

    // Fetch encrypted API key
    const apiKey = await prisma.encryptedApiKey.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
        isActive: true,
      },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found', provider },
        { status: 404 }
      );
    }

    // Validate encryption format before attempting decryption
    const parts = apiKey.encryptedKey.split(':');
    if (parts.length !== 3) {
      console.error('Invalid encrypted key format:', {
        provider,
        userId: user.id,
        format: `${parts.length} parts`,
      });

      return NextResponse.json(
        {
          error: 'API key corrupted. Please re-enter your API key.',
          code: 'INVALID_FORMAT',
        },
        { status: 422 }
      );
    }

    // Attempt decryption with detailed error handling
    let decryptedKey: string;
    try {
      decryptedKey = await decryptAPIKey(apiKey.encryptedKey, user.id);
    } catch (decryptError) {
      console.error('Decryption failed:', {
        provider,
        userId: user.id,
        error: decryptError instanceof Error ? decryptError.message : 'Unknown',
      });

      // Check specific error types
      if (decryptError instanceof Error) {
        if (decryptError.message.includes('ENCRYPTION_MASTER_KEY')) {
          return NextResponse.json(
            {
              error: 'Server configuration error. Contact administrator.',
              code: 'MISSING_MASTER_KEY',
            },
            { status: 500 }
          );
        }

        if (decryptError.message.includes('version')) {
          return NextResponse.json(
            {
              error: 'API key encrypted with old version. Please re-enter.',
              code: 'VERSION_MISMATCH',
            },
            { status: 422 }
          );
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to decrypt API key. Please re-enter.',
          code: 'DECRYPTION_FAILED',
        },
        { status: 500 }
      );
    }

    // Update last used timestamp (non-blocking)
    prisma.encryptedApiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch((err) => {
      console.error('Failed to update lastUsedAt:', err);
    });

    return NextResponse.json({
      provider,
      apiKey: decryptedKey,
    });
  } catch (error) {
    console.error('API key retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
```

**Solution B: Implement Key Validation on Storage**
```typescript
// app/api/api-keys/route.ts (POST handler)
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, apiKey } = body;

    // Validate API key format before encryption
    if (!validateAPIKeyFormat(apiKey, provider)) {
      return NextResponse.json(
        {
          error: `Invalid ${provider} API key format`,
          code: 'INVALID_KEY_FORMAT',
        },
        { status: 400 }
      );
    }

    // Encrypt the API key
    let encryptedKey: string;
    try {
      encryptedKey = await encryptAPIKey(apiKey, user.id);
    } catch (encryptError) {
      console.error('Encryption failed:', encryptError);
      return NextResponse.json(
        {
          error: 'Failed to encrypt API key',
          code: 'ENCRYPTION_FAILED',
        },
        { status: 500 }
      );
    }

    // Test decryption immediately after encryption
    try {
      const testDecrypted = await decryptAPIKey(encryptedKey, user.id);
      if (testDecrypted !== apiKey) {
        throw new Error('Encryption/decryption mismatch');
      }
    } catch (testError) {
      console.error('Encryption verification failed:', testError);
      return NextResponse.json(
        {
          error: 'Encryption verification failed. Try again.',
          code: 'VERIFICATION_FAILED',
        },
        { status: 500 }
      );
    }

    // Store in database
    const storedKey = await prisma.encryptedApiKey.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider,
        },
      },
      update: {
        encryptedKey,
        maskedKey: maskAPIKey(apiKey),
        testStatus: 'pending',
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider,
        encryptedKey,
        maskedKey: maskAPIKey(apiKey),
        isActive: true,
        testStatus: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      provider,
      maskedKey: storedKey.maskedKey,
    });
  } catch (error) {
    console.error('API key storage error:', error);
    return NextResponse.json(
      {
        error: 'Failed to store API key',
        code: 'STORAGE_FAILED',
      },
      { status: 500 }
    );
  }
}
```

**Solution C: Add Environment Variable Validation on Startup**
```typescript
// instrumentation.ts (or new file: lib/startup-checks.ts)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'DIRECT_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ENCRYPTION_MASTER_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
    ];

    const missing = requiredEnvVars.filter(
      (key) => !process.env[key]
    );

    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);

      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Missing required environment variables: ${missing.join(', ')}`
        );
      } else {
        console.warn('⚠️  Application may not function correctly');
      }
    } else {
      console.log('✅ All required environment variables present');
    }

    // Validate ENCRYPTION_MASTER_KEY format
    if (process.env.ENCRYPTION_MASTER_KEY) {
      const keyLength = process.env.ENCRYPTION_MASTER_KEY.length;
      if (keyLength !== 64) {
        console.error(
          `❌ ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes), got ${keyLength}`
        );

        if (process.env.NODE_ENV === 'production') {
          throw new Error('Invalid ENCRYPTION_MASTER_KEY format');
        }
      }
    }
  }
}
```

#### Recommended Fix
**Implement All Three Solutions**

1. **Immediate:** Add Solution A to API routes
2. **Short-term:** Add Solution C for startup validation
3. **Long-term:** Implement Solution B for data integrity

#### Testing Approach
```typescript
// tests/api-key-encryption.test.ts
import { encryptAPIKey, decryptAPIKey, validateAPIKeyFormat } from '@/lib/server/encryption/key-manager'

describe('API Key Encryption', () => {
  const userId = 'test-user-id'
  const testKeys = {
    openai: 'sk-' + 'a'.repeat(48),
    anthropic: 'sk-ant-' + 'a'.repeat(95),
    deepgram: 'a'.repeat(40),
  }

  beforeAll(() => {
    // Ensure ENCRYPTION_MASTER_KEY is set for tests
    if (!process.env.ENCRYPTION_MASTER_KEY) {
      process.env.ENCRYPTION_MASTER_KEY = '0'.repeat(64)
    }
  })

  describe('Format Validation', () => {
    it('should validate OpenAI key format', () => {
      expect(validateAPIKeyFormat(testKeys.openai, 'openai')).toBe(true)
      expect(validateAPIKeyFormat('invalid', 'openai')).toBe(false)
    })

    it('should validate Anthropic key format', () => {
      expect(validateAPIKeyFormat(testKeys.anthropic, 'anthropic')).toBe(true)
    })
  })

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt successfully', async () => {
      const encrypted = await encryptAPIKey(testKeys.openai, userId)
      const decrypted = await decryptAPIKey(encrypted, userId)

      expect(decrypted).toBe(testKeys.openai)
    })

    it('should fail with wrong user ID', async () => {
      const encrypted = await encryptAPIKey(testKeys.openai, userId)

      await expect(
        decryptAPIKey(encrypted, 'wrong-user-id')
      ).rejects.toThrow()
    })

    it('should handle invalid format gracefully', async () => {
      await expect(
        decryptAPIKey('invalid:format', userId)
      ).rejects.toThrow('Invalid encrypted key format')
    })

    it('should handle missing master key', async () => {
      const originalKey = process.env.ENCRYPTION_MASTER_KEY
      delete process.env.ENCRYPTION_MASTER_KEY

      await expect(
        encryptAPIKey(testKeys.openai, userId)
      ).rejects.toThrow('ENCRYPTION_MASTER_KEY not found')

      process.env.ENCRYPTION_MASTER_KEY = originalKey
    })
  })
})
```

---

## 4. Provider Manager Failures

### Issue 4.1: ASR Provider Manager Failover Not Working

#### Error Message
```
Error: No ASR providers available
Provider deepgram failed: Connection timeout
Failover to assemblyai failed
```

#### Root Cause Analysis

**File:** `C:\lt3.0\lib\asr\provider-manager.ts`

**Problem 1: Silent Provider Initialization Failures** (Lines 67-89)
```typescript
private initializeProviders(): void {
  for (const config of this.providerConfigs) {
    if (!config.enabled) continue;

    switch (config.type) {
      case 'deepgram':
        this.providers.set(config.type, new DeepgramProvider({ apiKey: config.apiKey }));
        break;
      // ... other cases
    }
  }
}
```
**Issue:** No try-catch, initialization errors silently fail

**Problem 2: Failover Logic Issue** (Lines 173-192)
```typescript
onError: async (error: Error) => {
  console.error(`Error from ${providerType}:`, error);

  // Record failed attempt
  this.recordFailure(providerType, error.message);

  // Attempt failover
  if (this.failoverAttempts < this.maxFailoverAttempts) {
    this.failoverAttempts++;

    const nextProvider = this.getNextProvider(providerType);
    if (nextProvider) {
      console.log(`Failing over from ${providerType} to ${nextProvider}`);

      if (callbacks.onProviderSwitch) {
        callbacks.onProviderSwitch(providerType, nextProvider);
      }

      // Stop current provider
      await provider.stopStream();

      // Start with next provider
      await this.startStreamWithProvider(nextProvider, callbacks);
      return;
    }
  }
}
```
**Issue:** Failover attempts counter shared across all providers, not per-provider

#### Evidence from Usage
**File:** `C:\lt3.0\app\api\transcription\stream\route.ts` (Lines 90-101)
```typescript
for (const key of apiKeys) {
  try {
    const decrypted = await decryptAPIKey(key.encryptedKey, user.id);
    decryptedKeys.push({
      provider: key.provider as ASRProviderType,
      apiKey: decrypted,
      priority: providerPriority[key.provider] ?? 99,
    });
  } catch (error) {
    console.error(`Failed to decrypt ${key.provider} key:`, error);
  }
}
```
**Issue:** Decryption failures are logged but provider still might be added to manager with invalid key

#### Solution Approaches

**Solution A: Robust Provider Initialization**
```typescript
// lib/asr/provider-manager.ts
private initializeProviders(): void {
  const initErrors: Array<{ provider: ASRProviderType; error: string }> = [];

  for (const config of this.providerConfigs) {
    if (!config.enabled) continue;

    try {
      let providerInstance: DeepgramProvider | AssemblyAIProvider | GoogleSpeechProvider;

      switch (config.type) {
        case 'deepgram':
          providerInstance = new DeepgramProvider({ apiKey: config.apiKey });
          break;
        case 'assemblyai':
          providerInstance = new AssemblyAIProvider({ apiKey: config.apiKey });
          break;
        case 'google-speech':
          providerInstance = new GoogleSpeechProvider({ apiKey: config.apiKey });
          break;
        default:
          throw new Error(`Unknown provider type: ${config.type}`);
      }

      // Validate provider can be initialized
      if (!providerInstance) {
        throw new Error('Provider initialization returned null');
      }

      this.providers.set(config.type, providerInstance);

      console.log(`✅ Initialized ASR provider: ${config.type}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      initErrors.push({ provider: config.type, error: errorMessage });

      console.error(`❌ Failed to initialize ${config.type}:`, errorMessage);
    }
  }

  // Log summary
  console.log(`ASR Provider initialization: ${this.providers.size} succeeded, ${initErrors.length} failed`);

  if (initErrors.length > 0) {
    console.warn('Failed providers:', initErrors);
  }

  if (this.providers.size === 0) {
    throw new Error(
      `No ASR providers could be initialized. Errors: ${JSON.stringify(initErrors)}`
    );
  }
}
```

**Solution B: Per-Provider Failover Tracking**
```typescript
// lib/asr/provider-manager.ts
export class ASRProviderManager {
  // ... existing properties
  private providerFailoverAttempts: Map<ASRProviderType, number> = new Map();
  private maxFailoverAttemptsPerProvider: number = 2;

  /**
   * Start stream with specific provider
   */
  private async startStreamWithProvider(
    providerType: ASRProviderType,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not initialized`);
    }

    this.currentProvider = providerType;

    // Initialize failover counter for this provider
    if (!this.providerFailoverAttempts.has(providerType)) {
      this.providerFailoverAttempts.set(providerType, 0);
    }

    // Wrap callbacks with failover logic
    const wrappedCallbacks = {
      ...callbacks,
      onError: async (error: Error) => {
        console.error(`Error from ${providerType}:`, error);

        // Record failed attempt
        this.recordFailure(providerType, error.message);

        // Get current attempt count for this provider
        const attempts = this.providerFailoverAttempts.get(providerType) || 0;

        // Attempt failover
        if (attempts < this.maxFailoverAttemptsPerProvider) {
          this.providerFailoverAttempts.set(providerType, attempts + 1);

          const nextProvider = this.getNextProvider(providerType);
          if (nextProvider) {
            console.log(
              `Failing over from ${providerType} (attempt ${attempts + 1}) to ${nextProvider}`
            );

            if (callbacks.onProviderSwitch) {
              callbacks.onProviderSwitch(providerType, nextProvider);
            }

            // Stop current provider
            try {
              await provider.stopStream();
            } catch (stopError) {
              console.error('Error stopping provider during failover:', stopError);
            }

            // Start with next provider
            await this.startStreamWithProvider(nextProvider, callbacks);
            return;
          } else {
            console.error('No alternative providers available for failover');
          }
        } else {
          console.error(
            `Max failover attempts (${this.maxFailoverAttemptsPerProvider}) reached for ${providerType}`
          );
        }

        // Call original error callback if failover exhausted
        if (callbacks.onError) {
          callbacks.onError(error);
        }
      },
      onOpen: () => {
        console.log(`Stream opened with ${providerType}`);
        // Reset failover counter on successful connection
        this.providerFailoverAttempts.set(providerType, 0);

        if (callbacks.onOpen) {
          callbacks.onOpen();
        }
      },
    };

    // Start stream with provider
    try {
      await provider.startStream(wrappedCallbacks);
    } catch (error) {
      console.error(`Failed to start stream with ${providerType}:`, error);
      // Trigger failover through error callback
      if (wrappedCallbacks.onError) {
        wrappedCallbacks.onError(
          error instanceof Error ? error : new Error('Stream start failed')
        );
      }
    }
  }

  /**
   * Reset failover counters
   */
  resetFailoverCounters(): void {
    this.providerFailoverAttempts.clear();
  }
}
```

**Solution C: Add Health Checks Before Provider Selection**
```typescript
// lib/asr/provider-manager.ts
export class ASRProviderManager {
  // ... existing code

  /**
   * Check if provider is healthy before using
   */
  private async isProviderHealthy(providerType: ASRProviderType): Promise<boolean> {
    const stats = this.providerStats.get(providerType);
    if (!stats) return true; // No history yet, assume healthy

    // If never used, it's healthy
    if (stats.totalCalls === 0) return true;

    // Calculate recent success rate (last hour)
    const recentMetrics = this.usageMetrics.filter(
      (m) =>
        m.provider === providerType &&
        m.timestamp > new Date(Date.now() - 60 * 60 * 1000)
    );

    if (recentMetrics.length === 0) return true;

    const recentSuccesses = recentMetrics.filter((m) => m.success).length;
    const recentSuccessRate = recentSuccesses / recentMetrics.length;

    // Consider unhealthy if success rate below 30% in last hour
    return recentSuccessRate >= 0.3;
  }

  /**
   * Get the best available provider based on priority and health
   */
  private async getBestProvider(): Promise<ASRProviderType | null> {
    // Try providers in priority order
    for (const config of this.providerConfigs) {
      if (!config.enabled) continue;

      const provider = this.providers.get(config.type);
      if (!provider) continue;

      // Check health before selecting
      const isHealthy = await this.isProviderHealthy(config.type);
      if (!isHealthy) {
        console.warn(`Provider ${config.type} skipped due to poor health`);
        continue;
      }

      return config.type;
    }

    // If all providers are unhealthy, try highest priority anyway
    const firstEnabled = this.providerConfigs.find((c) => c.enabled && this.providers.has(c.type));
    if (firstEnabled) {
      console.warn('All providers unhealthy, using highest priority:', firstEnabled.type);
      return firstEnabled.type;
    }

    return null;
  }
}
```

#### Recommended Fix
**Implement All Three Solutions** for comprehensive failover handling

#### Testing Approach
```typescript
// tests/asr-provider-failover.test.ts
import { ASRProviderManager, ProviderConfig } from '@/lib/asr/provider-manager'

describe('ASR Provider Failover', () => {
  const mockConfigs: ProviderConfig[] = [
    {
      type: 'deepgram',
      apiKey: 'mock-deepgram-key',
      priority: 0,
      enabled: true,
    },
    {
      type: 'assemblyai',
      apiKey: 'mock-assemblyai-key',
      priority: 1,
      enabled: true,
    },
  ]

  it('should initialize multiple providers', () => {
    const manager = new ASRProviderManager(mockConfigs)

    expect(manager.getAvailableProviders()).toContain('deepgram')
    expect(manager.getAvailableProviders()).toContain('assemblyai')
  })

  it('should failover to next provider on error', async () => {
    const manager = new ASRProviderManager(mockConfigs)

    const switchEvents: Array<{ from: string; to: string }> = []

    await manager.startStream({
      onProviderSwitch: (from, to) => {
        switchEvents.push({ from, to })
      },
      onError: (error) => {
        console.log('Final error:', error)
      },
    })

    // Simulate error in first provider
    // (requires mocking provider methods)

    expect(switchEvents.length).toBeGreaterThan(0)
  })

  it('should skip unhealthy providers', async () => {
    const manager = new ASRProviderManager(mockConfigs)

    // Record multiple failures for first provider
    for (let i = 0; i < 10; i++) {
      manager.recordUsage('deepgram', 1000, false, 'Test failure')
    }

    const bestProvider = await (manager as any).getBestProvider()
    expect(bestProvider).toBe('assemblyai')
  })
})
```

---

## 5. Encryption/Decryption Errors

### Issue 5.1: ENCRYPTION_MASTER_KEY Not Set

#### Error Message
```
Error: ENCRYPTION_MASTER_KEY not found in environment variables.
Generate one using: openssl rand -hex 32
```

#### Root Cause
Environment variable not configured in deployment environments:
- Missing from `.env.local`
- Not set in Vercel/deployment platform
- Key rotation scenario where old keys needed

#### Reproduction Steps
1. Deploy application without ENCRYPTION_MASTER_KEY
2. User attempts to save API key in settings
3. Encryption fails on key manager initialization
4. All encrypted API key operations fail

#### Solution Approaches

**Solution A: Startup Validation** (Already covered in Section 3.1, Solution C)

**Solution B: Graceful Degradation**
```typescript
// lib/server/encryption/key-manager.ts
function getMasterKey(): Uint8Array {
  const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterKeyHex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_MASTER_KEY not found in environment variables. ' +
        'This is required in production. Generate one using: openssl rand -hex 32'
      );
    } else {
      console.warn(
        '⚠️  ENCRYPTION_MASTER_KEY not set. Using development key. ' +
        'NEVER use this in production!'
      );
      // Use deterministic dev key (DO NOT use in production)
      return hexToBytes('0'.repeat(64));
    }
  }

  if (masterKeyHex.length !== 64) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex characters), got ${masterKeyHex.length}`
    );
  }

  return hexToBytes(masterKeyHex);
}
```

**Solution C: Key Rotation Support**
```typescript
// lib/server/encryption/key-manager.ts
/**
 * Support for multiple master keys (for rotation)
 */
function getMasterKeys(): { current: Uint8Array; old: Uint8Array[] } {
  const currentKey = process.env.ENCRYPTION_MASTER_KEY;
  const oldKeys = process.env.ENCRYPTION_MASTER_KEY_OLD?.split(',') || [];

  if (!currentKey) {
    throw new Error('ENCRYPTION_MASTER_KEY not found');
  }

  return {
    current: hexToBytes(currentKey),
    old: oldKeys.map((k) => hexToBytes(k.trim())),
  };
}

/**
 * Decrypt with key rotation support
 */
export async function decryptAPIKey(
  encryptedKey: string,
  userId: string
): Promise<string> {
  const keys = getMasterKeys();

  // Try current key first
  try {
    return await decryptWithKey(encryptedKey, userId, keys.current);
  } catch (currentKeyError) {
    // Try old keys if current fails
    for (const oldKey of keys.old) {
      try {
        const decrypted = await decryptWithKey(encryptedKey, userId, oldKey);

        // Re-encrypt with current key
        console.log('Re-encrypting with current key after old key success');
        const reEncrypted = await encryptAPIKey(decrypted, userId);

        // Update database with new encryption
        // (caller should handle this)

        return decrypted;
      } catch (oldKeyError) {
        continue;
      }
    }

    // All keys failed
    throw currentKeyError;
  }
}

async function decryptWithKey(
  encryptedKey: string,
  userId: string,
  masterKey: Uint8Array
): Promise<string> {
  const parts = encryptedKey.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }

  const [versionStr, nonceHex, ciphertextHex] = parts;
  const version = parseInt(versionStr, 10);

  const nonce = hexToBytes(nonceHex);
  const ciphertext = hexToBytes(ciphertextHex);

  // Derive user-specific key
  const info = utf8ToBytes(`api-key-encryption-v${version}`);
  const salt = utf8ToBytes(`user:${userId}`);
  const key = hkdf(sha256, masterKey, salt, info, KEY_LENGTH);

  // Decrypt
  const decipher = gcm(key, nonce);
  const plaintext = decipher.decrypt(ciphertext);

  return bytesToUtf8Custom(plaintext);
}
```

#### Recommended Fix
**Implement Solution A + C** for production safety and rotation support

#### Environment Setup
```bash
# Generate master key
openssl rand -hex 32

# Add to .env.local
ENCRYPTION_MASTER_KEY=your-64-character-hex-string

# For key rotation, add old key
ENCRYPTION_MASTER_KEY_OLD=old-64-character-hex-string
```

---

## 6. Rate Limiting Issues

### Issue 6.1: Redis Connection Failures

#### Error Message
```
Error: UPSTASH_REDIS_REST_URL is not defined
Failed to connect to Redis
```

#### Root Cause
**File:** `C:\lt3.0\lib\redis\client.ts` (Lines 3-9)
```typescript
if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error('UPSTASH_REDIS_REST_URL is not defined')
}

if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_TOKEN is not defined')
}
```

Application crashes on startup if Redis not configured, even if rate limiting not used

#### Solution Approaches

**Solution A: Lazy Initialization**
```typescript
// lib/redis/client.ts
import { Redis } from '@upstash/redis'

let redisInstance: Redis | null = null
let initError: Error | null = null

/**
 * Get Redis instance with lazy initialization
 */
export function getRedis(): Redis {
  if (initError) {
    throw initError
  }

  if (!redisInstance) {
    try {
      if (!process.env.UPSTASH_REDIS_REST_URL) {
        throw new Error('UPSTASH_REDIS_REST_URL is not defined')
      }

      if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('UPSTASH_REDIS_REST_TOKEN is not defined')
      }

      redisInstance = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })

      console.log('✅ Redis client initialized')
    } catch (error) {
      initError = error instanceof Error ? error : new Error('Redis initialization failed')
      console.error('❌ Redis initialization failed:', initError.message)
      throw initError
    }
  }

  return redisInstance
}

// Backwards compatibility
export const redis = new Proxy({} as Redis, {
  get(target, prop) {
    const instance = getRedis()
    return instance[prop as keyof Redis]
  },
})

// Export client wrapper
export const redisClient = {
  async get<T = string>(key: string): Promise<T | null> {
    try {
      return await getRedis().get<T>(key)
    } catch (error) {
      console.error('Redis GET error:', error)
      return null
    }
  },

  async set(key: string, value: any, ttl?: number): Promise<'OK' | null> {
    try {
      if (ttl) {
        return await getRedis().set(key, value, { ex: ttl })
      }
      return await getRedis().set(key, value)
    } catch (error) {
      console.error('Redis SET error:', error)
      return null
    }
  },

  // ... other methods with error handling
}
```

**Solution B: Optional Rate Limiting**
```typescript
// lib/redis/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from './client'

let rateLimitersInitialized = false
let ipRateLimitInstance: Ratelimit | null = null
// ... other rate limiters

/**
 * Initialize rate limiters (lazy)
 */
function initializeRateLimiters() {
  if (rateLimitersInitialized) return

  try {
    const redis = getRedis()

    ipRateLimitInstance = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'ratelimit:ip',
    })

    // ... initialize other limiters

    rateLimitersInitialized = true
    console.log('✅ Rate limiters initialized')
  } catch (error) {
    console.error('❌ Rate limiter initialization failed:', error)
    // Don't throw - allow app to function without rate limiting
  }
}

/**
 * Helper function to check rate limit by IP (with fallback)
 */
export async function checkIpRateLimit(ip: string) {
  try {
    if (!rateLimitersInitialized) {
      initializeRateLimiters()
    }

    if (!ipRateLimitInstance) {
      // Fallback: allow request if rate limiting unavailable
      console.warn('Rate limiting unavailable, allowing request')
      return {
        success: true,
        limit: 0,
        reset: 0,
        remaining: 0,
      }
    }

    const { success, limit, reset, remaining } = await ipRateLimitInstance.limit(ip)

    return {
      success,
      limit,
      reset,
      remaining,
    }
  } catch (error) {
    console.error('Rate limit check failed:', error)
    // Fail open - allow request
    return {
      success: true,
      limit: 0,
      reset: 0,
      remaining: 0,
    }
  }
}
```

**Solution C: Environment Variable Validation with Warning**
```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // ... other validations ...

    // Check Redis configuration
    const hasRedis =
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN

    if (!hasRedis) {
      console.warn('⚠️  Redis not configured. Rate limiting will be disabled.')
      console.warn('   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable.')
    } else {
      console.log('✅ Redis configured')
    }
  }
}
```

#### Recommended Fix
**Implement Solution A + B + C** for graceful degradation

---

### Issue 6.2: Rate Limit False Positives

#### Error Message
```
429 Too Many Requests
Rate limit exceeded
```

#### Root Cause
**File:** `C:\lt3.0\lib\redis\rate-limit.ts` (Lines 137-147)
```typescript
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
```

Issues:
1. Same user with multiple sessions hits limit quickly
2. No distinction between streaming (continuous) vs batch requests
3. Rate limits too aggressive for real-time transcription

#### Solution Approaches

**Solution A: Token Bucket for Streaming**
```typescript
// lib/redis/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from './client'

/**
 * Rate limiter for ASR streaming (token bucket algorithm)
 * More suitable for continuous streams
 */
export const asrStreamRateLimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.tokenBucket(
    10, // refill rate (tokens per interval)
    '10 s', // interval
    100 // maximum burst size
  ),
  analytics: true,
  prefix: 'ratelimit:asr:stream',
})

/**
 * Rate limiter for ASR batch requests (sliding window)
 */
export const asrBatchRateLimit = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
  prefix: 'ratelimit:asr:batch',
})

/**
 * Check ASR rate limit with request type
 */
export async function checkAsrRateLimit(
  userId: string,
  provider: string,
  requestType: 'stream' | 'batch' = 'stream'
) {
  const identifier = `${userId}:${provider}`

  const limiter = requestType === 'stream' ? asrStreamRateLimit : asrBatchRateLimit

  const { success, limit, reset, remaining } = await limiter.limit(identifier)

  return {
    success,
    limit,
    reset,
    remaining,
    requestType,
  }
}
```

**Solution B: Per-Session Rate Limiting**
```typescript
// lib/redis/rate-limit.ts
/**
 * Check rate limit per session (more granular)
 */
export async function checkSessionRateLimit(
  userId: string,
  sessionId: string,
  provider: string
) {
  const identifier = `${userId}:${sessionId}:${provider}`

  // More generous limits per session
  const sessionLimiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(300, '1 m'), // 300 requests per minute per session
    analytics: true,
    prefix: 'ratelimit:session:asr',
  })

  const { success, limit, reset, remaining } = await sessionLimiter.limit(identifier)

  return {
    success,
    limit,
    reset,
    remaining,
  }
}
```

**Solution C: Implement Rate Limit Headers**
```typescript
// app/api/transcription/stream/route.ts
export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check rate limit
  const rateLimitResult = await checkAsrRateLimit(user.id, 'deepgram', 'stream')

  if (!rateLimitResult.success) {
    return new NextResponse(
      JSON.stringify({
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.reset,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
          'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
        },
      }
    )
  }

  // ... rest of handler
}
```

#### Recommended Fix
**Implement Solution A + C** for better streaming support

---

## 7. Streaming/WebSocket Failures

### Issue 7.1: Transcription Stream Abruptly Closes

#### Error Message
```
WebSocket connection closed unexpectedly
Stream ended prematurely
Error: Connection lost
```

#### Root Cause
**File:** `C:\lt3.0\hooks\useTranscription.ts` (Lines 137-159)
```typescript
// Read stream
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();

  if (done) {
    break;
  }

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      handleStreamMessage(data);
    }
  }
}
```

**Issues:**
1. No error handling for malformed JSON
2. No timeout detection
3. No heartbeat/keepalive mechanism
4. Browser/network timeouts not handled

**File:** `C:\lt3.0\app\api\transcription\stream\route.ts` (Line 16)
```typescript
export const maxDuration = 300; // 5 minutes max
```

**Issue:** 5-minute timeout too short for long sessions

#### Solution Approaches

**Solution A: Add Stream Keepalive**
```typescript
// app/api/transcription/stream/route.ts
export async function POST(request: NextRequest) {
  // ... authentication and setup ...

  if (message.type === 'start') {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Keepalive mechanism - send heartbeat every 30 seconds
    let keepaliveInterval: NodeJS.Timeout | null = null;

    const startKeepalive = () => {
      keepaliveInterval = setInterval(async () => {
        try {
          const heartbeat = { type: 'heartbeat', timestamp: Date.now() };
          await writer.write(
            encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`)
          );
        } catch (error) {
          console.error('Keepalive failed:', error);
          if (keepaliveInterval) clearInterval(keepaliveInterval);
        }
      }, 30000); // 30 seconds
    };

    const stopKeepalive = () => {
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }
    };

    startKeepalive();

    // Start ASR stream
    manager
      .startStream({
        // ... existing callbacks ...
        onClose: async () => {
          stopKeepalive();
          // ... rest of onClose logic
        },
      })
      .catch(async (error) => {
        stopKeepalive();
        // ... error handling
      });

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  }

  // ... rest of handler
}
```

**Solution B: Client-Side Stream Recovery**
```typescript
// hooks/useTranscription.ts
export function useTranscription(options: UseTranscriptionOptions = {}): UseTranscriptionReturn {
  // ... existing state ...
  const [lastHeartbeat, setLastHeartbeat] = useState<number>(Date.now())
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Monitor heartbeat and reconnect if needed
   */
  useEffect(() => {
    if (!isTranscribing) return

    // Check heartbeat every 45 seconds
    heartbeatTimeoutRef.current = setInterval(() => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat

      if (timeSinceLastHeartbeat > 60000) {
        console.warn('No heartbeat received for 60s, reconnecting...')

        if (autoReconnect) {
          stopTranscription()
          attemptReconnect()
        }
      }
    }, 45000)

    return () => {
      if (heartbeatTimeoutRef.current) {
        clearInterval(heartbeatTimeoutRef.current)
      }
    }
  }, [isTranscribing, lastHeartbeat, autoReconnect])

  /**
   * Handle stream messages
   */
  const handleStreamMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case 'heartbeat':
          setLastHeartbeat(Date.now())
          break

        case 'ready':
          console.log('Transcription stream ready')
          setLastHeartbeat(Date.now())
          break

        // ... other cases ...
      }
    },
    [onSegment, onProviderSwitch, onMetrics, onError]
  )

  /**
   * Start transcription stream with error handling
   */
  const startTranscription = useCallback(async (): Promise<void> {
    try {
      setError(null)
      setIsReconnecting(false)
      reconnectAttemptsRef.current = 0
      setLastHeartbeat(Date.now())

      // ... existing code ...

      // Read stream with error handling
      const decoder = new TextDecoder()
      let buffer = ''

      const readLoop = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              console.log('Stream ended normally')
              break
            }

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  handleStreamMessage(data)
                } catch (parseError) {
                  console.error('Failed to parse stream message:', line, parseError)
                }
              }
            }
          }
        } catch (readError) {
          console.error('Stream read error:', readError)
          throw readError
        }
      }

      await readLoop()

      setIsTranscribing(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed'
      setError(errorMessage)
      setIsTranscribing(false)

      if (onError) {
        onError(errorMessage)
      }

      // Attempt reconnect if enabled
      if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
        attemptReconnect()
      }
    }
  }, [autoReconnect, maxReconnectAttempts, onError, handleStreamMessage])

  // ... rest of hook
}
```

**Solution C: Increase Timeout for Long Sessions**
```typescript
// app/api/transcription/stream/route.ts
export const runtime = 'nodejs'
export const maxDuration = 900 // 15 minutes (max for Vercel Pro)

// Or for self-hosted:
// export const maxDuration = 3600 // 1 hour
```

#### Recommended Fix
**Implement All Three Solutions** for robust streaming

---

## 8. Environment Configuration Problems

### Issue 8.1: Missing Environment Variables in Production

#### Error Message
```
Environment variable not found: DATABASE_URL
Failed to connect to Supabase
```

#### Root Cause
Environment variables not properly configured in deployment platform:
- Variables in `.env.local` not copied to deployment
- Platform-specific variable naming
- Build-time vs runtime variables confusion

#### Solution Approaches

**Solution A: Comprehensive Environment Validation**
```typescript
// lib/env-validation.ts
import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Security
  ENCRYPTION_MASTER_KEY: z.string().length(64),

  // Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // Optional but recommended
  CRON_SECRET: z.string().optional(),
  BACKUP_ENCRYPTION_SECRET: z.string().optional(),
})

type Env = z.infer<typeof envSchema>

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors
        .filter((e) => e.code === 'invalid_type')
        .map((e) => e.path.join('.'))

      const invalid = error.errors
        .filter((e) => e.code !== 'invalid_type')
        .map((e) => `${e.path.join('.')}: ${e.message}`)

      console.error('❌ Environment validation failed:')
      if (missing.length > 0) {
        console.error('  Missing variables:', missing.join(', '))
      }
      if (invalid.length > 0) {
        console.error('  Invalid variables:', invalid.join(', '))
      }

      throw new Error('Environment validation failed')
    }

    throw error
  }
}

// Validate on import in production
if (process.env.NODE_ENV === 'production') {
  validateEnv()
}
```

**Solution B: Environment Variable Documentation**
```bash
# .env.template (committed to repo)
# Copy this file to .env.local and fill in values

# =============================================================================
# REQUIRED: Database
# =============================================================================
DATABASE_URL="postgresql://..."           # From Supabase > Project Settings > Database > Connection String (Transaction)
DIRECT_URL="postgresql://..."             # From Supabase > Project Settings > Database > Connection String (Session)

# =============================================================================
# REQUIRED: Supabase
# =============================================================================
NEXT_PUBLIC_SUPABASE_URL="https://..."    # From Supabase > Project Settings > API > Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJh..."   # From Supabase > Project Settings > API > Project API keys > anon public
SUPABASE_SERVICE_ROLE_KEY="eyJh..."       # From Supabase > Project Settings > API > Project API keys > service_role (secret!)

# =============================================================================
# REQUIRED: Security
# =============================================================================
ENCRYPTION_MASTER_KEY=""                  # Generate: openssl rand -hex 32

# =============================================================================
# REQUIRED: Redis (for rate limiting and caching)
# =============================================================================
UPSTASH_REDIS_REST_URL="https://..."      # From Upstash Redis console
UPSTASH_REDIS_REST_TOKEN=""               # From Upstash Redis console

# =============================================================================
# OPTIONAL: Cron Jobs
# =============================================================================
CRON_SECRET=""                            # Generate: openssl rand -hex 32

# =============================================================================
# OPTIONAL: Backups
# =============================================================================
BACKUP_ENCRYPTION_SECRET=""               # Generate: openssl rand -hex 32
```

**Solution C: Deployment Checklist Script**
```typescript
// scripts/check-deployment.ts
import 'dotenv/config'

const requiredEnvVars = [
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ENCRYPTION_MASTER_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
]

const optionalEnvVars = [
  'CRON_SECRET',
  'BACKUP_ENCRYPTION_SECRET',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
]

console.log('🔍 Checking deployment readiness...\n')

// Check required
const missingRequired = requiredEnvVars.filter((key) => !process.env[key])
const presentRequired = requiredEnvVars.filter((key) => process.env[key])

console.log(`✅ Required variables: ${presentRequired.length}/${requiredEnvVars.length}`)
if (missingRequired.length > 0) {
  console.error(`❌ Missing required variables:\n   ${missingRequired.join('\n   ')}`)
}

// Check optional
const missingOptional = optionalEnvVars.filter((key) => !process.env[key])
const presentOptional = optionalEnvVars.filter((key) => process.env[key])

console.log(`ℹ️  Optional variables: ${presentOptional.length}/${optionalEnvVars.length}`)
if (missingOptional.length > 0) {
  console.log(`⚠️  Missing optional variables:\n   ${missingOptional.join('\n   ')}`)
}

// Check formats
console.log('\n🔍 Validating formats...')

// Database URLs
if (process.env.DATABASE_URL) {
  const dbUrl = new URL(process.env.DATABASE_URL)
  console.log(`✅ DATABASE_URL: ${dbUrl.protocol}//${dbUrl.host}${dbUrl.pathname}`)
}

// Encryption key
if (process.env.ENCRYPTION_MASTER_KEY) {
  if (process.env.ENCRYPTION_MASTER_KEY.length === 64) {
    console.log('✅ ENCRYPTION_MASTER_KEY: correct length (64 chars)')
  } else {
    console.error(
      `❌ ENCRYPTION_MASTER_KEY: incorrect length (${process.env.ENCRYPTION_MASTER_KEY.length} chars, should be 64)`
    )
  }
}

// Exit code
const exitCode = missingRequired.length > 0 ? 1 : 0
console.log(
  `\n${exitCode === 0 ? '✅ Ready for deployment' : '❌ Not ready for deployment'}`
)
process.exit(exitCode)
```

Add to package.json:
```json
{
  "scripts": {
    "check-deployment": "tsx scripts/check-deployment.ts",
    "predeploy": "pnpm check-deployment"
  }
}
```

#### Recommended Fix
**Implement All Three Solutions**

---

## 9. Type Safety Issues

### Issue 9.1: Prisma Type Mismatch with Supabase Tables

#### Error Message
```
Type 'string' is not assignable to type 'Json'
Argument of type is not assignable to parameter
```

#### Root Cause
Mismatch between Prisma schema types and actual database types:
- Prisma uses `Json` type, code expects `object`
- Date fields inconsistent (Date vs string vs DateTime)
- UUID fields (`@db.Uuid`) vs string IDs

#### Evidence
**File:** `C:\lt3.0\prisma\schema.prisma` (Lines 38, 216)
```prisma
settings Json @default("{}")
transcriptData Json? @map("transcript_data")
```

**File:** `C:\lt3.0\app\api\transcription\stream\route.ts` (Line 157)
```typescript
await supabase.from('transcription_segments').insert({
  session_id: sessionId,
  text: segment.text,
  speaker: segment.speaker,  // Type mismatch possible
  confidence: segment.confidence,
  start_time: segment.startTime,
  end_time: segment.endTime,
  is_final: segment.isFinal,
});
```

Mixing Prisma and Supabase client creates type confusion

#### Solution Approaches

**Solution A: Use Prisma Consistently**
```typescript
// app/api/transcription/stream/route.ts
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  // ... authentication ...

  if (message.type === 'start') {
    const sessionId = message.sessionId || crypto.randomUUID()

    // Create session using Prisma instead of Supabase
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        matterId: message.matterId, // Required by schema
        status: 'active',
        startedAt: new Date(),
      },
    })

    // ... stream setup ...

    manager.startStream({
      onTranscript: async (segment) => {
        // Save using Prisma with proper types
        await prisma.transcriptSegment.create({
          data: {
            sessionId,
            text: segment.text,
            speakerId: segment.speaker ? `speaker-${segment.speaker}` : null,
            startMs: Math.floor(segment.startTime),
            endMs: Math.floor(segment.endTime),
            confidence: segment.confidence,
            isFinal: segment.isFinal,
            provider: manager.getCurrentProvider() || undefined,
          },
        })

        // Send to client
        const response: StreamResponse = {
          type: 'transcript',
          segment,
        }

        await writer.write(
          encoder.encode(`data: ${JSON.stringify(response)}\n\n`)
        )
      },
      // ... other callbacks
    })

    return new NextResponse(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  // ... rest of handler
}
```

**Solution B: Create Type-Safe Wrappers**
```typescript
// lib/database/types.ts
import { Prisma } from '@prisma/client'

/**
 * Helper to convert Prisma Json to typed object
 */
export function jsonToObject<T>(json: Prisma.JsonValue | null): T | null {
  if (json === null || json === undefined) return null
  return json as T
}

/**
 * Helper to convert object to Prisma Json
 */
export function objectToJson<T extends object>(obj: T | null): Prisma.JsonValue {
  if (obj === null || obj === undefined) return Prisma.JsonNull
  return obj as Prisma.JsonValue
}

/**
 * User settings type
 */
export interface UserSettings {
  theme?: 'light' | 'dark' | 'system'
  language?: string
  notifications?: {
    email?: boolean
    push?: boolean
  }
  aiPreferences?: {
    defaultProvider?: string
    defaultModel?: string
  }
}

/**
 * Transcript data type
 */
export interface TranscriptData {
  segments: Array<{
    id: string
    text: string
    startMs: number
    endMs: number
    speaker?: string
  }>
  summary?: string
  keywords?: string[]
}

// Usage example
async function getUserSettings(userId: string): Promise<UserSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { settings: true },
  })

  return jsonToObject<UserSettings>(user?.settings ?? null) ?? {}
}

async function updateUserSettings(
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> {
  const currentSettings = await getUserSettings(userId)
  const newSettings = { ...currentSettings, ...settings }

  await prisma.user.update({
    where: { id: userId },
    data: {
      settings: objectToJson(newSettings),
    },
  })
}
```

**Solution C: Generate Supabase Types from Prisma**
```typescript
// scripts/generate-supabase-types.ts
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function generateTypes() {
  console.log('Generating Supabase types from database...')

  try {
    // Generate types from Supabase
    const { stdout, stderr } = await execAsync(
      'supabase gen types typescript --project-id <project-id> > types/supabase-generated.ts'
    )

    if (stderr) {
      console.error('Error:', stderr)
    } else {
      console.log('✅ Types generated successfully')
      console.log(stdout)
    }
  } catch (error) {
    console.error('Failed to generate types:', error)
    process.exit(1)
  }
}

generateTypes()
```

Add to package.json:
```json
{
  "scripts": {
    "types:generate": "tsx scripts/generate-supabase-types.ts",
    "postdb:push": "pnpm types:generate"
  }
}
```

#### Recommended Fix
**Implement Solution A + B** - Use Prisma consistently with type-safe wrappers

---

## 10. Performance/Memory Issues

### Issue 10.1: Memory Leak in Long-Running Sessions

#### Error Message
```
JavaScript heap out of memory
FATAL ERROR: Reached heap limit
```

#### Root Cause
**File:** `C:\lt3.0\lib\asr\provider-manager.ts` (Line 53)
```typescript
private usageMetrics: UsageMetrics[] = [];
```

Unbounded arrays accumulate over time:
- `usageMetrics` grows indefinitely
- Segment history never pruned
- Provider stats never reset

#### Evidence
**File:** `C:\lt3.0\hooks\useTranscription.ts` (Line 76)
```typescript
const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
```

Client-side segment accumulation in React state

#### Solution Approaches

**Solution A: Implement Metrics Rotation**
```typescript
// lib/asr/provider-manager.ts
export class ASRProviderManager {
  private usageMetrics: UsageMetrics[] = [];
  private maxMetricsSize = 1000; // Keep last 1000 metrics

  /**
   * Record usage metrics with size limit
   */
  recordUsage(
    provider: ASRProviderType,
    durationMs: number,
    success: boolean,
    errorMessage?: string
  ): void {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) return;

    const cost = providerInstance.calculateCost(durationMs, true);

    const metric: UsageMetrics = {
      provider,
      durationMs,
      cost,
      timestamp: new Date(),
      success,
      errorMessage,
    };

    this.usageMetrics.push(metric);

    // Rotate metrics if exceeds limit
    if (this.usageMetrics.length > this.maxMetricsSize) {
      const removeCount = this.usageMetrics.length - this.maxMetricsSize;
      this.usageMetrics.splice(0, removeCount);
      console.log(`Rotated ${removeCount} old metrics`);
    }

    // Update provider stats
    const stats = this.providerStats.get(provider);
    if (stats) {
      stats.totalCalls++;
      if (success) {
        stats.successfulCalls++;
      } else {
        stats.failedCalls++;
      }
      stats.totalDurationMs += durationMs;
      stats.totalCost += cost;
      stats.lastUsed = new Date();
    }
  }

  /**
   * Clear old metrics (older than retention period)
   */
  pruneMetrics(retentionMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - retentionMs);
    const beforeCount = this.usageMetrics.length;

    this.usageMetrics = this.usageMetrics.filter((m) => m.timestamp >= cutoff);

    const pruned = beforeCount - this.usageMetrics.length;
    if (pruned > 0) {
      console.log(`Pruned ${pruned} metrics older than ${retentionMs}ms`);
    }

    return pruned;
  }
}
```

**Solution B: Persist Metrics to Database**
```typescript
// lib/asr/metrics-persister.ts
import { prisma } from '@/lib/prisma'
import type { UsageMetrics, ASRProviderType } from './provider-manager'

export class MetricsPersister {
  private buffer: UsageMetrics[] = []
  private bufferSize = 100
  private flushInterval: NodeJS.Timeout | null = null

  constructor() {
    // Auto-flush every 5 minutes
    this.startAutoFlush(5 * 60 * 1000)
  }

  /**
   * Add metric to buffer
   */
  add(metric: UsageMetrics): void {
    this.buffer.push(metric)

    if (this.buffer.length >= this.bufferSize) {
      this.flush()
    }
  }

  /**
   * Flush buffer to database
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return

    const toFlush = [...this.buffer]
    this.buffer = []

    try {
      // Batch insert
      await prisma.usageMetrics.createMany({
        data: toFlush.map((m) => ({
          userId: 'system', // Or get from context
          periodStart: m.timestamp,
          periodEnd: new Date(m.timestamp.getTime() + m.durationMs),
          transcriptionMinutes: m.durationMs / (1000 * 60),
          transcriptionCost: m.cost,
          totalCost: m.cost,
        })),
        skipDuplicates: true,
      })

      console.log(`Flushed ${toFlush.length} metrics to database`)
    } catch (error) {
      console.error('Failed to flush metrics:', error)
      // Add back to buffer
      this.buffer.unshift(...toFlush)
    }
  }

  /**
   * Start auto-flush timer
   */
  private startAutoFlush(intervalMs: number): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }

    this.flushInterval = setInterval(() => {
      this.flush()
    }, intervalMs)
  }

  /**
   * Stop auto-flush and flush remaining
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }

    await this.flush()
  }
}

// Singleton instance
export const metricsPersister = new MetricsPersister()
```

**Solution C: Client-Side Segment Windowing**
```typescript
// hooks/useTranscription.ts
export function useTranscription(options: UseTranscriptionOptions = {}): UseTranscriptionReturn {
  const [segments, setSegments] = useState<TranscriptionSegment[]>([])
  const maxSegments = 500 // Keep last 500 segments in memory

  /**
   * Handle stream messages with segment windowing
   */
  const handleStreamMessage = useCallback(
    (data: any) => {
      switch (data.type) {
        case 'transcript':
          if (data.segment) {
            const segment: TranscriptionSegment = data.segment

            setSegments((prev) => {
              let updated: TranscriptionSegment[]

              // Add or update segment
              if (segment.isFinal) {
                updated = [...prev, segment]
              } else {
                const lastSegment = prev[prev.length - 1]
                if (lastSegment && !lastSegment.isFinal) {
                  updated = [...prev.slice(0, -1), segment]
                } else {
                  updated = [...prev, segment]
                }
              }

              // Window segments if exceeds limit
              if (updated.length > maxSegments) {
                const excess = updated.length - maxSegments
                console.log(`Windowing ${excess} old segments`)

                // Persist excess segments to IndexedDB or sessionStorage
                persistSegments(updated.slice(0, excess))

                updated = updated.slice(excess)
              }

              return updated
            })

            if (onSegment) {
              onSegment(segment)
            }
          }
          break

        // ... other cases
      }
    },
    [onSegment, onProviderSwitch, onMetrics, onError]
  )

  // ... rest of hook
}

/**
 * Persist segments to IndexedDB
 */
async function persistSegments(segments: TranscriptionSegment[]): Promise<void> {
  try {
    const { openDB } = await import('idb')

    const db = await openDB('transcription-segments', 1, {
      upgrade(db) {
        db.createObjectStore('segments', { keyPath: 'id', autoIncrement: true })
      },
    })

    const tx = db.transaction('segments', 'readwrite')
    const store = tx.objectStore('segments')

    for (const segment of segments) {
      await store.add(segment)
    }

    await tx.done
  } catch (error) {
    console.error('Failed to persist segments:', error)
  }
}
```

#### Recommended Fix
**Implement All Three Solutions** for comprehensive memory management

#### Monitoring
```typescript
// lib/monitoring/memory.ts
export function monitorMemoryUsage(): void {
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const usage = process.memoryUsage()

      console.log('Memory Usage:', {
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`,
        rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      })

      // Warn if approaching limit
      if (usage.heapUsed / usage.heapTotal > 0.9) {
        console.warn('⚠️  Heap usage above 90%')
      }
    }, 60000) // Every minute
  }
}
```

---

## Summary

This debugging guide covers the 10 most critical issue categories in the Law Transcribed application:

1. **Database Connection Issues** - Prisma client initialization and connection pooling
2. **Authentication/Authorization Failures** - Middleware redirects and session management
3. **API Route Errors** - API key decryption and error handling
4. **Provider Manager Failures** - ASR/AI provider failover and initialization
5. **Encryption/Decryption Errors** - Master key management and key rotation
6. **Rate Limiting Issues** - Redis connection and rate limit configuration
7. **Streaming/WebSocket Failures** - Stream keepalive and reconnection
8. **Environment Configuration** - Variable validation and deployment readiness
9. **Type Safety Issues** - Prisma/Supabase type compatibility
10. **Performance/Memory Issues** - Memory leaks and metrics management

### Quick Debugging Checklist

When encountering an issue:

1. **Check Environment Variables** - Run `pnpm check-deployment`
2. **Verify Database Connection** - Check Prisma client generation
3. **Review Logs** - Look for specific error messages
4. **Test Authentication** - Verify Supabase session validity
5. **Check Provider Status** - Ensure API keys are configured
6. **Monitor Memory Usage** - Watch for memory leaks
7. **Validate Types** - Ensure Prisma types match usage
8. **Test Rate Limits** - Check Redis connectivity
9. **Review Streaming** - Verify WebSocket/SSE connections
10. **Examine Recent Changes** - Check git history for related changes

### Next Steps

1. Implement recommended fixes based on priority
2. Add comprehensive error handling to all API routes
3. Set up monitoring and alerting for production
4. Create automated tests for critical paths
5. Document common issues and solutions in team wiki

---

**Generated:** 2025-10-11
**Version:** 1.0.0
**Codebase:** Law Transcribed v3.0
