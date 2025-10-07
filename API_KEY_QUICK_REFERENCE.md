# API Key Management - Quick Reference Card

## 🚀 Quick Start

```bash
# 1. Generate master key
openssl rand -hex 32

# 2. Add to .env.local
echo "ENCRYPTION_MASTER_KEY=your_key_here" >> .env.local

# 3. Update database
npx prisma db push

# 4. Test at http://localhost:3000/settings/api-keys
```

---

## 📦 Common Imports

```typescript
// Server-side only
import { getAPIKey } from '@/lib/server/services/api-key-service';
import { encryptAPIKey, decryptAPIKey } from '@/lib/server/encryption/key-manager';
import { prisma } from '@/lib/server/db';

// Client-side
import { useAPIKeys } from '@/hooks/useAPIKeys';
```

---

## 🔐 Usage Examples

### Get API Key (Server-Side)

```typescript
import { getUser } from '@/lib/supabase/auth';
import { prisma } from '@/lib/server/db';
import { decryptAPIKey } from '@/lib/server/encryption/key-manager';

export async function POST(request: NextRequest) {
  const user = await getUser();

  // Get user's API key
  const apiKeyRecord = await prisma.encryptedApiKey.findUnique({
    where: {
      userId_provider: { userId: user.id, provider: 'deepgram' },
      isActive: true,
    },
  });

  if (!apiKeyRecord) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 404 });
  }

  // Decrypt
  const apiKey = await decryptAPIKey(apiKeyRecord.encryptedKey, user.id);

  // Use the key (never return it to client!)
  const result = await callExternalAPI(apiKey);
  return NextResponse.json(result);
}
```

### Use in Service

```typescript
// lib/server/services/my-service.ts
import { getAPIKey } from './api-key-service';

export async function transcribe(userId: string, audioUrl: string) {
  const apiKey = await getAPIKey(userId, 'deepgram');

  if (!apiKey) {
    throw new Error('Deepgram API key not configured');
  }

  // Use apiKey here
  return await callDeepgram(apiKey, audioUrl);
}
```

### Frontend Hook

```typescript
'use client';

import { useAPIKeys } from '@/hooks/useAPIKeys';

export function MyComponent() {
  const { apiKeys, addOrUpdateKey, testConnection } = useAPIKeys();

  const handleSave = async () => {
    const result = await addOrUpdateKey('deepgram', 'your-key');
    if (result.success) {
      console.log('Saved!');
    }
  };

  const handleTest = async () => {
    const result = await testConnection('deepgram');
    console.log(result.success ? 'Connected!' : 'Failed');
  };

  return (
    <div>
      {apiKeys.map(key => (
        <div key={key.id}>
          {key.provider}: {key.maskedKey}
        </div>
      ))}
    </div>
  );
}
```

---

## 🎯 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/api-keys` | List all keys (masked) |
| `POST` | `/api/api-keys` | Add/update key |
| `DELETE` | `/api/api-keys?provider=X` | Delete key |
| `POST` | `/api/api-keys/test` | Test connection |
| `GET` | `/api/api-keys/[provider]` | Get decrypted key (server only) |

---

## 🔧 Provider Details

| Provider | Format | Example |
|----------|--------|---------|
| OpenAI | `sk-[48 chars]` | `sk-proj1234...` |
| Anthropic | `sk-ant-[95+ chars]` | `sk-ant-api03-...` |
| Deepgram | `[40 alphanumeric]` | `a1b2c3d4e5...` |
| AssemblyAI | `[32 hex chars]` | `abc123def456...` |
| Google | `AIza[35 chars]` | `AIzaSyAbc123...` |
| OpenRouter | `sk-or-v1-[64 chars]` | `sk-or-v1-abc...` |

---

## ⚡ Common Patterns

### Check if Key Exists

```typescript
const hasKey = await prisma.encryptedApiKey.count({
  where: { userId, provider: 'deepgram', isActive: true }
}) > 0;
```

### Get All Configured Providers

```typescript
const providers = await prisma.encryptedApiKey.findMany({
  where: { userId, isActive: true },
  select: { provider: true },
});
```

### Multi-Provider Fallback

```typescript
async function transcribeWithFallback(userId: string, audio: string) {
  const providers = ['deepgram', 'assemblyai'];

  for (const provider of providers) {
    try {
      const key = await getAPIKey(userId, provider);
      if (key) return await transcribe(provider, key, audio);
    } catch (e) {
      continue; // Try next provider
    }
  }

  throw new Error('No transcription provider available');
}
```

---

## 🛡️ Security Rules

### ✅ DO

```typescript
// ✅ Decrypt server-side only
const key = await decryptAPIKey(encrypted, userId);

// ✅ Validate user ownership
if (resource.userId !== user.id) throw new Error('Unauthorized');

// ✅ Use try-catch
try {
  const key = await getAPIKey(userId, provider);
} catch (error) {
  // Handle error
}

// ✅ Mask in logs
console.log('Key loaded for provider:', provider); // Good
```

### ❌ DON'T

```typescript
// ❌ Never return plaintext to client
return NextResponse.json({ apiKey }); // BAD!

// ❌ Never log plaintext
console.log('API Key:', apiKey); // BAD!

// ❌ Never store in client state
const [apiKey, setApiKey] = useState(''); // BAD!

// ❌ Never send in URL
fetch(`/api/transcribe?key=${apiKey}`); // BAD!
```

---

## 🧪 Testing Checklist

- [ ] Can add API key
- [ ] Key is encrypted in database
- [ ] Key is masked in UI
- [ ] Can test connection
- [ ] Can delete key
- [ ] Works in actual service
- [ ] Cannot access other user's keys
- [ ] Timestamps update correctly

---

## 🚨 Troubleshooting

| Error | Solution |
|-------|----------|
| "ENCRYPTION_MASTER_KEY not found" | Add to `.env.local` |
| "Failed to decrypt" | Re-add the API key |
| "Invalid format" | Check provider format |
| "Connection test failed" | Verify key is valid |
| Slow performance | Check database connection |

---

## 📊 Database Schema

```prisma
model EncryptedApiKey {
  id            String   @id @default(cuid())
  userId        String
  provider      String   // Provider name
  encryptedKey  String   // version:nonce:ciphertext
  maskedKey     String?  // Display version
  isActive      Boolean  @default(true)
  lastTestedAt  DateTime?
  testStatus    String?  // success/failed/pending
  testError     String?
  createdAt     DateTime @default(now())
  lastUsedAt    DateTime?
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@index([userId, isActive])
}
```

---

## 🔑 Environment Variables

```env
# Required
ENCRYPTION_MASTER_KEY=64-char-hex-string

# Optional (for key rotation)
ENCRYPTION_MASTER_KEY_V1=old-key-for-migration
```

---

## 📚 Additional Resources

- Full Setup Guide: [API_KEY_SETUP.md](./API_KEY_SETUP.md)
- Implementation Guide: [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- UI: `/settings/api-keys`

---

## 🎓 Best Practices

1. **Different keys** for dev/staging/prod
2. **Never commit** keys to git
3. **Use try-catch** for all operations
4. **Validate ownership** before decryption
5. **Cache** decrypted keys per-request
6. **Rate limit** API key operations
7. **Monitor** failed decryption attempts
8. **Rotate** keys periodically

---

## 📞 Support

- Security issues: security@lawtranscribed.com
- Documentation: See linked guides above
- Settings UI: `/settings/api-keys`
