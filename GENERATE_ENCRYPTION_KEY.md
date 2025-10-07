# How to Generate Encryption Master Key

The API Key Management System requires a secure 256-bit (32-byte) encryption key. Here are multiple ways to generate it:

---

## Method 1: Node.js Script (Easiest)

This method works on all platforms (Windows, Mac, Linux).

### Step 1: Use the included script

```bash
node generate-key.js
```

This will output:
```
=================================================
ENCRYPTION MASTER KEY GENERATED
=================================================

Copy this key to your .env.local file:

ENCRYPTION_MASTER_KEY=29c48d8b95e7a0dd1fd8dd360732b9c6e2bec2f79a6b3beaf6eead908a6fb893

=================================================
```

### Step 2: Copy to `.env.local`

Add the line to your `.env.local` file:
```env
ENCRYPTION_MASTER_KEY=29c48d8b95e7a0dd1fd8dd360732b9c6e2bec2f79a6b3beaf6eead908a6fb893
```

---

## Method 2: Browser Console (Quick)

### Step 1: Open browser console

1. Open any browser (Chrome, Firefox, Edge)
2. Press `F12` or right-click → Inspect
3. Go to the **Console** tab

### Step 2: Run this code

```javascript
Array.from(crypto.getRandomValues(new Uint8Array(32)))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('')
```

### Step 3: Copy the output

You'll get a 64-character hex string like:
```
29c48d8b95e7a0dd1fd8dd360732b9c6e2bec2f79a6b3beaf6eead908a6fb893
```

Add it to your `.env.local`:
```env
ENCRYPTION_MASTER_KEY=29c48d8b95e7a0dd1fd8dd360732b9c6e2bec2f79a6b3beaf6eead908a6fb893
```

---

## Method 3: PowerShell (Windows)

### Option A: Simple Random Bytes

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
-join ($bytes | ForEach-Object { $_.ToString("x2") })
```

### Option B: Using .NET Crypto

```powershell
$key = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
[System.BitConverter]::ToString($key) -replace '-',''
```

### Option C: One-liner

```powershell
-join ((1..32 | ForEach-Object { [byte](Get-Random -Maximum 256) }) | ForEach-Object { $_.ToString("x2") })
```

---

## Method 4: Python (If installed)

```python
import secrets
print(secrets.token_hex(32))
```

Save as `generate_key.py` and run:
```bash
python generate_key.py
```

---

## Method 5: Online Tools (Use with Caution)

⚠️ **WARNING**: Only use for development, never for production!

1. Go to: https://www.random.org/bytes/
2. Set:
   - Generate: **32** bytes
   - Format: **Hexadecimal**
3. Click **Get Bytes**
4. Copy the result (remove spaces)

**Security Note**: For production, always generate keys locally using methods 1-4.

---

## Method 6: OpenSSL (If Available)

### Windows (Git Bash, WSL, or if OpenSSL installed):
```bash
openssl rand -hex 32
```

### Mac/Linux:
```bash
openssl rand -hex 32
```

---

## Verify Your Key

After generating, verify it's correct:

1. Length should be **64 characters**
2. Only contains hexadecimal characters (0-9, a-f)
3. Is different every time you generate

Example valid key:
```
29c48d8b95e7a0dd1fd8dd360732b9c6e2bec2f79a6b3beaf6eead908a6fb893
```

### Quick verification script:

```javascript
const key = "YOUR_KEY_HERE";

console.log("Length:", key.length); // Should be 64
console.log("Valid hex:", /^[0-9a-f]{64}$/i.test(key)); // Should be true
console.log("Entropy:", new Set(key).size); // Should be > 10
```

---

## Adding to Environment

### Development (.env.local)

```env
ENCRYPTION_MASTER_KEY=your-64-character-hex-key-here
```

### Production

**Vercel:**
```bash
vercel env add ENCRYPTION_MASTER_KEY production
# Paste your key when prompted
```

**Docker:**
```yaml
environment:
  - ENCRYPTION_MASTER_KEY=${ENCRYPTION_MASTER_KEY}
```

**AWS:**
```bash
aws ssm put-parameter \
  --name /law-transcribed/encryption-key \
  --value "your-key-here" \
  --type SecureString
```

**Railway/Render/Fly.io:**
Add via the dashboard under Environment Variables

---

## Security Best Practices

1. ✅ **Different keys** for dev/staging/production
2. ✅ **Never commit** to git (add to .gitignore)
3. ✅ **Use secrets manager** in production
4. ✅ **Rotate periodically** (every 6-12 months)
5. ✅ **Backup securely** (encrypted backup)
6. ❌ **Never share** via email/chat
7. ❌ **Never log** in plain text
8. ❌ **Never hardcode** in source code

---

## Troubleshooting

### "Command not found" errors

**Solution**: Use Method 1 (Node.js) or Method 2 (Browser Console)

### Key not working

**Check**:
1. No spaces or newlines in the key
2. Exactly 64 characters
3. Only hexadecimal characters (0-9, a-f)
4. Variable name is `ENCRYPTION_MASTER_KEY` (not `MASTER_ENCRYPTION_KEY`)

### Need to regenerate

1. Generate a new key using any method above
2. Replace in `.env.local`
3. Restart your dev server
4. Re-add all API keys (old ones won't decrypt with new key)

---

## Key Rotation

When rotating keys:

1. Generate new key
2. Keep old key temporarily as `ENCRYPTION_MASTER_KEY_V1`
3. Update code to support both versions
4. Re-encrypt all keys with new key
5. Remove old key after migration

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md#key-rotation) for details.

---

## Questions?

- Setup issues: See [API_KEY_SETUP.md](./API_KEY_SETUP.md)
- Implementation: See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- Quick reference: See [API_KEY_QUICK_REFERENCE.md](./API_KEY_QUICK_REFERENCE.md)
