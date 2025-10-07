# API Key Management System - Setup Guide

This guide explains how to set up and use the secure API key management system.

## Overview

The API key management system provides:
- **AES-256-GCM encryption** for all API keys
- **User-specific key derivation** using HKDF
- **Server-side only** encryption/decryption
- **Secure storage** in PostgreSQL
- **API key testing** for validation
- **Provider support**: Deepgram, AssemblyAI, Anthropic, OpenAI, Google AI, OpenRouter

## Security Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Client Browser                       │
│  (Never sees plaintext API keys)                        │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │ HTTPS
                 │
┌────────────────▼─────────────────────────────────────────┐
│                   Next.js API Routes                     │
│  - Authenticate user                                     │
│  - Validate API key format                              │
│  - Encrypt/Decrypt using key-manager.ts                 │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │
┌────────────────▼─────────────────────────────────────────┐
│              Encryption Layer (Server)                   │
│  - Master key from env: ENCRYPTION_MASTER_KEY           │
│  - User-specific keys via HKDF                          │
│  - AES-256-GCM with random nonces                       │
└────────────────┬─────────────────────────────────────────┘
                 │
                 │
┌────────────────▼─────────────────────────────────────────┐
│                PostgreSQL Database                       │
│  - Stores: version:nonce:ciphertext                     │
│  - Never stores plaintext keys                          │
└──────────────────────────────────────────────────────────┘
```

## Step 1: Generate Master Encryption Key

**CRITICAL**: Generate a secure master key before deployment.

### Generate the key:

```bash
openssl rand -hex 32
```

This will output a 64-character hexadecimal string like:
```
a3f5c9d8e2b1a4f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
```

### Add to environment variables:

**.env.local** (Development):
```env
ENCRYPTION_MASTER_KEY=a3f5c9d8e2b1a4f6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
```

**Production** (Vercel, AWS, etc.):
Add as an environment variable in your hosting platform's dashboard.

### Security Best Practices:

1. **Never commit** the master key to version control
2. **Use different keys** for development and production
3. **Rotate keys** periodically (see Key Rotation section)
4. **Store securely** in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)

## Step 2: Update Database Schema

Run the Prisma migration to update the database:

```bash
npx prisma db push
```

Or create a migration:

```bash
npx prisma migrate dev --name add_api_key_encryption
```

This will create/update the `EncryptedApiKey` table with:
- `encryptedKey` (TEXT): Stores `version:nonce:ciphertext`
- `maskedKey` (VARCHAR): Stores display version like `sk-12••••••3456`
- `testStatus`, `testError`: Connection test results
- `lastTestedAt`, `lastUsedAt`: Usage timestamps

## Step 3: Usage in Your Application

### Access API Keys Settings Page

Navigate to: `/settings/api-keys`

### Add an API Key

1. Select a provider from the dropdown
2. Enter your API key
3. Click "Save API Key"
4. Optionally click "Test" to verify the connection

### Use API Keys in Your Code (Server-Side)

```typescript
import { prisma } from '@/lib/server/db';
import { decryptAPIKey } from '@/lib/server/encryption/key-manager';

// Get user's Deepgram API key
async function getDeepgramKey(userId: string): Promise<string | null> {
  const record = await prisma.encryptedApiKey.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: 'deepgram',
      },
      isActive: true,
    },
  });

  if (!record) {
    return null;
  }

  // Decrypt and return
  return await decryptAPIKey(record.encryptedKey, userId);
}

// Example: Use in transcription service
async function transcribeAudio(userId: string, audioUrl: string) {
  const apiKey = await getDeepgramKey(userId);

  if (!apiKey) {
    throw new Error('Deepgram API key not configured');
  }

  // Use the API key
  const response = await fetch('https://api.deepgram.com/v1/listen', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  return response.json();
}
```

### NEVER Expose to Client

```typescript
// ❌ BAD - Never do this
export async function GET(request: NextRequest) {
  const apiKey = await decryptAPIKey(encrypted, userId);
  return NextResponse.json({ apiKey }); // Never return plaintext!
}

// ✅ GOOD - Use server-side only
export async function transcribe(userId: string, audio: Buffer) {
  const apiKey = await decryptAPIKey(encrypted, userId);
  // Use internally, never return to client
  const result = await callAPI(apiKey, audio);
  return result;
}
```

## Step 4: Test Connection Feature

The system includes built-in connection testing:

```typescript
// Frontend
import { useAPIKeys } from '@/hooks/useAPIKeys';

function MyComponent() {
  const { testConnection } = useAPIKeys();

  const handleTest = async () => {
    const result = await testConnection('deepgram');
    if (result.success) {
      console.log('Connection successful!');
    } else {
      console.error('Connection failed:', result.error);
    }
  };

  return <button onClick={handleTest}>Test Connection</button>;
}
```

Supported test endpoints:
- **OpenAI**: `GET /v1/models`
- **Anthropic**: `POST /v1/messages` (minimal request)
- **Deepgram**: `GET /v1/projects`
- **AssemblyAI**: `POST /v2/transcript`
- **Google AI**: `GET /v1beta/models`
- **OpenRouter**: `GET /api/v1/auth/key`

## Step 5: Key Rotation

To rotate the master encryption key:

### 1. Generate a new master key:

```bash
openssl rand -hex 32
```

### 2. Update the version in key-manager.ts:

```typescript
const ENCRYPTION_VERSION = 2; // Increment version
```

### 3. Create a migration script:

```typescript
// scripts/rotate-keys.ts
import { prisma } from '@/lib/server/db';
import { rotateAPIKey } from '@/lib/server/encryption/key-manager';

async function rotateAllKeys() {
  const keys = await prisma.encryptedApiKey.findMany();

  for (const key of keys) {
    const rotated = await rotateAPIKey(key.encryptedKey, key.userId, 2);
    await prisma.encryptedApiKey.update({
      where: { id: key.id },
      data: { encryptedKey: rotated },
    });
  }
}

rotateAllKeys().then(() => console.log('Rotation complete'));
```

### 4. Update environment variable:

```env
ENCRYPTION_MASTER_KEY=<new-master-key>
ENCRYPTION_MASTER_KEY_V1=<old-master-key-for-migration>
```

## API Endpoints Reference

### `GET /api/api-keys`
List all API keys for authenticated user (masked)

**Response:**
```json
{
  "apiKeys": [
    {
      "id": "clx...",
      "provider": "deepgram",
      "maskedKey": "a3f5••••••9b0c",
      "lastUsedAt": "2025-01-15T10:30:00Z",
      "testStatus": "success",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### `POST /api/api-keys`
Add or update an API key

**Request:**
```json
{
  "provider": "deepgram",
  "apiKey": "your-api-key-here"
}
```

**Response:**
```json
{
  "message": "API key saved successfully",
  "apiKey": {
    "id": "clx...",
    "provider": "deepgram",
    "maskedKey": "a3f5••••••9b0c"
  }
}
```

### `DELETE /api/api-keys?provider=deepgram`
Delete (deactivate) an API key

**Response:**
```json
{
  "message": "API key deleted successfully"
}
```

### `POST /api/api-keys/test`
Test API key connection

**Request:**
```json
{
  "provider": "deepgram"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful"
}
```

### `GET /api/api-keys/[provider]`
**Server-side only!** Decrypt and return API key

**Response:**
```json
{
  "provider": "deepgram",
  "apiKey": "actual-plaintext-key"
}
```

⚠️ **WARNING**: This endpoint must only be called from server-side code.

## Troubleshooting

### Error: "ENCRYPTION_MASTER_KEY not found"

**Solution**: Add the master key to your `.env.local`:
```env
ENCRYPTION_MASTER_KEY=<your-64-character-hex-key>
```

### Error: "Failed to decrypt API key"

**Possible causes**:
1. Master key changed without re-encrypting
2. Database corruption
3. User ID mismatch

**Solution**: Delete and re-add the API key.

### Error: "Invalid API key format"

**Solution**: Check the API key format for your provider:
- OpenAI: `sk-...` (48 chars after prefix)
- Anthropic: `sk-ant-...` (95+ chars after prefix)
- Deepgram: 40 alphanumeric characters
- AssemblyAI: 32 hexadecimal characters
- Google: `AIza...` (40 total chars)
- OpenRouter: `sk-or-v1-...` (64 chars after prefix)

### Connection Test Fails

**Check**:
1. API key is valid
2. Account has credits/quota
3. Network connectivity
4. Provider's API is operational

## Security Audit Checklist

- [ ] Master key is 32 bytes (64 hex chars)
- [ ] Master key is stored in environment variables only
- [ ] Master key is different for dev/staging/production
- [ ] `.env.local` is in `.gitignore`
- [ ] Decryption only happens server-side
- [ ] Client never receives plaintext keys
- [ ] Database has proper RLS policies
- [ ] API routes require authentication
- [ ] Encryption uses AES-256-GCM
- [ ] Each encryption uses a random nonce
- [ ] User-specific key derivation via HKDF

## Performance Considerations

- **Encryption**: ~1-2ms per key
- **Decryption**: ~1-2ms per key
- **Caching**: Consider caching decrypted keys in memory for the duration of a request
- **Connection pooling**: Reuse database connections

## License & Attribution

This implementation uses:
- [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) for AES-256-GCM
- [@noble/hashes](https://github.com/paulmillr/noble-hashes) for HKDF and SHA-256

Both are MIT licensed and audit-friendly.
