# API Key Management System - Implementation Guide

This guide walks you through implementing the secure API key management system in your Law Transcribed application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Step-by-Step Implementation](#step-by-step-implementation)
3. [Integration Examples](#integration-examples)
4. [Best Practices](#best-practices)
5. [Testing](#testing)
6. [Deployment](#deployment)

---

## Quick Start

### 1. Generate Master Key

```bash
# Generate a secure 256-bit encryption key
openssl rand -hex 32
```

### 2. Configure Environment

Create or update `.env.local`:

```env
# Database (if not already configured)
DATABASE_URL="postgresql://user:password@localhost:5432/lawtranscribed"
DIRECT_URL="postgresql://user:password@localhost:5432/lawtranscribed"

# Supabase (if not already configured)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# API Key Encryption (NEW - REQUIRED)
ENCRYPTION_MASTER_KEY="paste-your-64-character-hex-key-here"
```

### 3. Update Database

```bash
# Push schema changes to database
npx prisma db push

# Or create a migration
npx prisma migrate dev --name add_encrypted_api_keys
```

### 4. Restart Development Server

```bash
npm run dev
```

### 5. Test the System

1. Navigate to `http://localhost:3000/settings/api-keys`
2. Add an API key
3. Click "Test" to verify

---

## Step-by-Step Implementation

### Phase 1: Database Setup

#### 1.1 Verify Schema

The `EncryptedApiKey` model should already be in your `prisma/schema.prisma`. Verify it looks like this:

```prisma
model EncryptedApiKey {
  id              String   @id @default(cuid())
  userId          String
  provider        String   // 'deepgram', 'assemblyai', 'anthropic', 'openai', 'google', 'openrouter'
  encryptedKey    String   @db.Text // Format: version:nonce:ciphertext
  maskedKey       String?  // For display: "sk-12••••••3456"
  isActive        Boolean  @default(true)
  lastTestedAt    DateTime?
  testStatus      String?  // 'success', 'failed', 'pending'
  testError       String?  @db.Text
  createdAt       DateTime @default(now())
  lastUsedAt      DateTime?
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId, isActive])
}
```

#### 1.2 Run Migration

```bash
npx prisma db push
```

Or for production-ready migrations:

```bash
npx prisma migrate dev --name add_encrypted_api_keys
npx prisma generate
```

### Phase 2: Environment Configuration

#### 2.1 Development Environment

**.env.local**:
```env
ENCRYPTION_MASTER_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

#### 2.2 Production Environment

**Vercel**:
1. Go to Project Settings → Environment Variables
2. Add `ENCRYPTION_MASTER_KEY` with your production key
3. Set scope to "Production"

**AWS/Other**:
- Use AWS Secrets Manager, Parameter Store, or equivalent
- Inject at runtime, never commit to code

#### 2.3 Security Checklist

- [ ] Different keys for dev/staging/production
- [ ] Keys are 64 hexadecimal characters (32 bytes)
- [ ] `.env.local` is in `.gitignore`
- [ ] Production key stored in secrets manager
- [ ] Key access is logged/audited

### Phase 3: Using API Keys in Your Services

#### 3.1 Create a Service Helper

Create `lib/server/services/api-key-service.ts`:

```typescript
import { prisma } from '@/lib/server/db';
import { decryptAPIKey } from '@/lib/server/encryption/key-manager';

export type Provider = 'deepgram' | 'assemblyai' | 'anthropic' | 'openai' | 'google' | 'openrouter';

/**
 * Get decrypted API key for a user and provider
 * IMPORTANT: Only call this from server-side code
 */
export async function getAPIKey(userId: string, provider: Provider): Promise<string | null> {
  try {
    const record = await prisma.encryptedApiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
        isActive: true,
      },
    });

    if (!record) {
      return null;
    }

    // Decrypt the key
    const decryptedKey = await decryptAPIKey(record.encryptedKey, userId);

    // Update last used timestamp (optional, can be done async)
    prisma.encryptedApiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    }).catch((err) => console.error('Failed to update lastUsedAt:', err));

    return decryptedKey;
  } catch (error) {
    console.error(`Error retrieving ${provider} API key for user ${userId}:`, error);
    return null;
  }
}

/**
 * Check if user has configured an API key for a provider
 */
export async function hasAPIKey(userId: string, provider: Provider): Promise<boolean> {
  const count = await prisma.encryptedApiKey.count({
    where: {
      userId,
      provider,
      isActive: true,
    },
  });

  return count > 0;
}

/**
 * Get all configured providers for a user
 */
export async function getConfiguredProviders(userId: string): Promise<Provider[]> {
  const keys = await prisma.encryptedApiKey.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      provider: true,
    },
  });

  return keys.map((k) => k.provider as Provider);
}
```

#### 3.2 Integration Examples

##### Example 1: Transcription Service (Deepgram)

Create `lib/server/services/transcription-service.ts`:

```typescript
import { getAPIKey } from './api-key-service';
import { createClient } from '@deepgram/sdk';

export async function transcribeAudio(
  userId: string,
  audioUrl: string
): Promise<{ transcript: string; duration: number }> {
  // Get user's Deepgram API key
  const apiKey = await getAPIKey(userId, 'deepgram');

  if (!apiKey) {
    throw new Error('Deepgram API key not configured. Please add it in Settings → API Keys.');
  }

  // Use the API key
  const deepgram = createClient(apiKey);

  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: 'nova-2',
      smart_format: true,
      diarize: true,
    }
  );

  if (error) {
    throw new Error(`Transcription failed: ${error.message}`);
  }

  const transcript = result.results.channels[0].alternatives[0].transcript;
  const duration = result.metadata.duration;

  return { transcript, duration };
}
```

##### Example 2: AI Chat Service (Anthropic Claude)

Create `lib/server/services/ai-service.ts`:

```typescript
import { getAPIKey } from './api-key-service';
import Anthropic from '@anthropic-ai/sdk';

export async function chatWithClaude(
  userId: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  // Get user's Anthropic API key
  const apiKey = await getAPIKey(userId, 'anthropic');

  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Please add it in Settings → API Keys.');
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey,
  });

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages,
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
```

##### Example 3: Multi-Provider AI Service

Create `lib/server/services/ai-orchestrator.ts`:

```typescript
import { getAPIKey, getConfiguredProviders } from './api-key-service';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

type AIProvider = 'anthropic' | 'openai' | 'google';

export async function generateCompletion(
  userId: string,
  prompt: string,
  preferredProvider?: AIProvider
): Promise<{ text: string; provider: AIProvider; cost: number }> {
  // Get configured providers
  const configuredProviders = await getConfiguredProviders(userId);

  // Filter to AI providers
  const availableProviders = configuredProviders.filter((p) =>
    ['anthropic', 'openai', 'google'].includes(p)
  ) as AIProvider[];

  if (availableProviders.length === 0) {
    throw new Error('No AI provider configured. Please add at least one in Settings → API Keys.');
  }

  // Choose provider (preferred or first available)
  const provider = preferredProvider && availableProviders.includes(preferredProvider)
    ? preferredProvider
    : availableProviders[0];

  // Get API key
  const apiKey = await getAPIKey(userId, provider);

  if (!apiKey) {
    throw new Error(`${provider} API key not found`);
  }

  // Generate completion based on provider
  switch (provider) {
    case 'anthropic': {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });
      return {
        text: response.content[0].type === 'text' ? response.content[0].text : '',
        provider: 'anthropic',
        cost: (response.usage.input_tokens * 0.003 + response.usage.output_tokens * 0.015) / 1000,
      };
    }

    case 'openai': {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
      });
      return {
        text: response.choices[0].message.content || '',
        provider: 'openai',
        cost: (response.usage?.total_tokens || 0) * 0.01 / 1000,
      };
    }

    case 'google': {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(prompt);
      return {
        text: result.response.text(),
        provider: 'google',
        cost: 0, // Google pricing varies
      };
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
```

#### 3.3 API Route Integration

Create `app/api/transcribe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/auth';
import { transcribeAudio } from '@/lib/server/services/transcription-service';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request
    const { audioUrl } = await request.json();

    if (!audioUrl) {
      return NextResponse.json(
        { error: 'audioUrl is required' },
        { status: 400 }
      );
    }

    // Transcribe using user's API key
    const result = await transcribeAudio(user.id, audioUrl);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Transcription error:', error);

    const message = error instanceof Error ? error.message : 'Transcription failed';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
```

### Phase 4: Frontend Integration

#### 4.1 Show API Key Status in UI

```typescript
'use client';

import { useAPIKeys } from '@/hooks/useAPIKeys';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export function APIKeyWarning({ provider }: { provider: string }) {
  const { getKeyByProvider } = useAPIKeys();
  const key = getKeyByProvider(provider as any);

  if (key) {
    return null; // Key is configured
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        {provider} API key is not configured.{' '}
        <Link href="/settings/api-keys" className="underline font-medium">
          Add it now
        </Link>
      </AlertDescription>
    </Alert>
  );
}
```

#### 4.2 Provider Status Badge

```typescript
'use client';

import { useAPIKeys } from '@/hooks/useAPIKeys';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle } from 'lucide-react';

export function ProviderStatus({ provider }: { provider: string }) {
  const { getKeyByProvider } = useAPIKeys();
  const key = getKeyByProvider(provider as any);

  if (!key) {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Not configured
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="bg-green-600">
      <CheckCircle className="mr-1 h-3 w-3" />
      Active
    </Badge>
  );
}
```

---

## Best Practices

### Security

1. **Never Log Plaintext Keys**
   ```typescript
   // ❌ BAD
   console.log('API Key:', apiKey);

   // ✅ GOOD
   console.log('API Key retrieved for user:', userId);
   ```

2. **Use Try-Catch Blocks**
   ```typescript
   try {
     const apiKey = await getAPIKey(userId, provider);
     // Use key
   } catch (error) {
     console.error('Error:', error.message); // Log error, not key
     throw new Error('Service configuration error');
   }
   ```

3. **Validate User Ownership**
   ```typescript
   // Always verify the user owns the resource
   const session = await prisma.session.findUnique({
     where: { id: sessionId },
     select: { userId: true },
   });

   if (session.userId !== user.id) {
     throw new Error('Unauthorized');
   }
   ```

4. **Rate Limiting**
   ```typescript
   import { Ratelimit } from '@upstash/ratelimit';
   import { Redis } from '@upstash/redis';

   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(10, '1 m'),
   });

   const { success } = await ratelimit.limit(user.id);
   if (!success) {
     throw new Error('Rate limit exceeded');
   }
   ```

### Performance

1. **Cache Decrypted Keys (Request Scope)**
   ```typescript
   // Cache for the duration of a request
   const keyCache = new Map<string, string>();

   async function getAPIKeyCached(userId: string, provider: string): Promise<string | null> {
     const cacheKey = `${userId}:${provider}`;

     if (keyCache.has(cacheKey)) {
       return keyCache.get(cacheKey)!;
     }

     const key = await getAPIKey(userId, provider as any);
     if (key) {
       keyCache.set(cacheKey, key);
     }

     return key;
   }
   ```

2. **Batch Operations**
   ```typescript
   // Get multiple keys at once
   async function getMultipleKeys(userId: string, providers: Provider[]) {
     const keys = await prisma.encryptedApiKey.findMany({
       where: {
         userId,
         provider: { in: providers },
         isActive: true,
       },
     });

     return Promise.all(
       keys.map(async (key) => ({
         provider: key.provider,
         apiKey: await decryptAPIKey(key.encryptedKey, userId),
       }))
     );
   }
   ```

### Error Handling

1. **Provide User-Friendly Messages**
   ```typescript
   try {
     const apiKey = await getAPIKey(userId, 'deepgram');
     if (!apiKey) {
       return {
         error: 'Transcription service not configured',
         action: 'Please add your Deepgram API key in Settings',
         link: '/settings/api-keys',
       };
     }
   } catch (error) {
     return {
       error: 'Configuration error',
       action: 'Please check your API key settings',
       link: '/settings/api-keys',
     };
   }
   ```

2. **Graceful Degradation**
   ```typescript
   // Fall back to alternative provider if primary fails
   async function transcribeWithFallback(userId: string, audioUrl: string) {
     const providers: Provider[] = ['deepgram', 'assemblyai'];

     for (const provider of providers) {
       try {
         const apiKey = await getAPIKey(userId, provider);
         if (apiKey) {
           return await transcribe(provider, apiKey, audioUrl);
         }
       } catch (error) {
         console.error(`${provider} failed, trying next...`);
         continue;
       }
     }

     throw new Error('All transcription providers failed');
   }
   ```

---

## Testing

### Unit Tests

Create `tests/api-key-manager.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { encryptAPIKey, decryptAPIKey, maskAPIKey, validateAPIKeyFormat } from '@/lib/server/encryption/key-manager';

describe('API Key Manager', () => {
  const userId = 'test-user-123';
  const testKey = 'sk-test1234567890abcdefghijklmnopqrstuvwxyz';

  it('should encrypt and decrypt correctly', async () => {
    const encrypted = await encryptAPIKey(testKey, userId);
    const decrypted = await decryptAPIKey(encrypted, userId);

    expect(decrypted).toBe(testKey);
  });

  it('should mask API keys properly', () => {
    const masked = maskAPIKey(testKey);
    expect(masked).toMatch(/^sk-t.*xyz$/);
    expect(masked).toContain('••••');
  });

  it('should validate OpenAI key format', () => {
    expect(validateAPIKeyFormat('sk-' + 'a'.repeat(48), 'openai')).toBe(true);
    expect(validateAPIKeyFormat('invalid', 'openai')).toBe(false);
  });

  it('should validate Anthropic key format', () => {
    expect(validateAPIKeyFormat('sk-ant-' + 'a'.repeat(95), 'anthropic')).toBe(true);
    expect(validateAPIKeyFormat('invalid', 'anthropic')).toBe(false);
  });
});
```

### Integration Tests

Create `tests/api-keys-api.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('API Keys API', () => {
  const baseUrl = 'http://localhost:3000/api/api-keys';

  it('should require authentication', async () => {
    const response = await fetch(baseUrl);
    expect(response.status).toBe(401);
  });

  // Add authenticated tests with test user token
  it.todo('should save and retrieve API key');
  it.todo('should delete API key');
  it.todo('should test connection');
});
```

### Manual Testing Checklist

- [ ] Can add API key for each provider
- [ ] Key is masked in UI
- [ ] Test connection works for valid keys
- [ ] Test connection fails for invalid keys
- [ ] Can delete API key
- [ ] Deleted key is not returned in list
- [ ] Cannot access another user's keys
- [ ] Key works in actual service (transcription, AI, etc.)
- [ ] Last used timestamp updates
- [ ] Test status updates after testing

---

## Deployment

### Pre-Deployment Checklist

- [ ] Generate production master key
- [ ] Add master key to production environment variables
- [ ] Run database migrations in production
- [ ] Test with production database
- [ ] Verify environment isolation (dev/staging/prod use different keys)
- [ ] Set up monitoring and alerts
- [ ] Document key rotation procedure
- [ ] Create backup/restore procedure

### Deployment Steps

#### Vercel

```bash
# 1. Set environment variable
vercel env add ENCRYPTION_MASTER_KEY production

# 2. Deploy
vercel --prod

# 3. Run migrations (if using Vercel Postgres)
npx prisma migrate deploy
```

#### AWS

```bash
# 1. Store key in Secrets Manager
aws secretsmanager create-secret \
  --name law-transcribed/encryption-key \
  --secret-string "your-master-key"

# 2. Update environment to read from Secrets Manager
# In your application code:
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getEncryptionKey() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'law-transcribed/encryption-key' })
  );
  return response.SecretString;
}

# 3. Deploy application
# 4. Run migrations
npm run db:migrate:deploy
```

### Post-Deployment Verification

```bash
# 1. Check health endpoint
curl https://your-app.com/api/health

# 2. Test API key management
# - Log in as test user
# - Add API key
# - Test connection
# - Verify it works in actual service

# 3. Monitor logs for errors
# - Check for decryption errors
# - Check for authentication issues
# - Verify encryption operations are fast (<10ms)
```

### Monitoring

Set up alerts for:
- Failed decryption attempts
- High API key usage
- Test failures
- Slow encryption operations (>100ms)

Example monitoring with Sentry:

```typescript
import * as Sentry from '@sentry/nextjs';

try {
  const key = await decryptAPIKey(encrypted, userId);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      operation: 'decrypt_api_key',
      provider,
    },
    user: { id: userId },
  });
  throw error;
}
```

---

## Troubleshooting

### Common Issues

**Issue**: "ENCRYPTION_MASTER_KEY not found"
- **Solution**: Add the environment variable and restart the server

**Issue**: "Failed to decrypt API key"
- **Cause**: Master key changed or database corruption
- **Solution**: Delete and re-add the API key

**Issue**: "Invalid API key format"
- **Cause**: Wrong key format for provider
- **Solution**: Check the provider's documentation for correct format

**Issue**: Connection test fails
- **Cause**: Invalid key, no quota, or network issue
- **Solution**: Verify key is correct, check account status, test network

**Issue**: Slow encryption/decryption
- **Cause**: Database connection issues or high load
- **Solution**: Check database performance, consider caching

---

## Support

- **Documentation**: See [API_KEY_SETUP.md](./API_KEY_SETUP.md)
- **Security Issues**: Report to security@lawtranscribed.com
- **Feature Requests**: Open a GitHub issue

---

## License

This implementation is part of Law Transcribed and uses MIT-licensed libraries.
