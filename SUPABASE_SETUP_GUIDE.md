# Supabase Setup Guide

Step-by-step guide to configure Supabase for the Legal Transcript application.

## 📋 Prerequisites

- Supabase account (https://supabase.com)
- Supabase project created
- Project reference ID: `nmllrewdfkpuhchkeogh`

## 🗄️ Database Setup

### Step 1: Run Migrations

You need to run 10 migration files in order. Each migration builds on the previous one.

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project: `nmllrewdfkpuhchkeogh`
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste each migration file content below
6. Click **RUN** for each migration

**Migration Order:**

**1. Initial Schema** (`001_initial_schema.sql`)
```bash
# Creates core tables: matters, sessions, transcript_segments, users
# Open: supabase/migrations/001_initial_schema.sql
# Copy entire contents and run in SQL Editor
```

**2. AI Usage Tracking** (`002_ai_usage.sql`)
```bash
# Creates ai_usage table for tracking AI API usage
# Open: supabase/migrations/002_ai_usage.sql
# Copy and run
```

**3. API Keys** (`003_add_api_key_fields.sql`)
```bash
# Creates encrypted_api_keys table
# Open: supabase/migrations/003_add_api_key_fields.sql
# Copy and run
```

**4. Audit Logs** (`create_audit_logs_table.sql`)
```bash
# Creates audit_logs table for compliance
# Open: supabase/migrations/create_audit_logs_table.sql
# Copy and run
```

**5. Version Control** (`004_transcript_versions.sql`)
```bash
# Creates transcript_versions table
# Open: supabase/migrations/004_transcript_versions.sql
# Copy and run
```

**6. Timestamp Verification** (`005_timestamp_proofs.sql`)
```bash
# Creates timestamp_proofs table for NTP verification
# Open: supabase/migrations/005_timestamp_proofs.sql
# Copy and run
```

**7. Speaker Diarization** (`006_speakers.sql`)
```bash
# Creates speakers table and related functions
# Open: supabase/migrations/006_speakers.sql
# Copy and run (large file ~280 lines)
```

**8. PII Redaction** (`007_redactions.sql`)
```bash
# Creates redactions table with encryption
# Open: supabase/migrations/007_redactions.sql
# Copy and run (large file ~360 lines)
```

**9. Conflict Detection** (`008_conflict_checks.sql`)
```bash
# Creates conflict_checks table and helper functions
# Open: supabase/migrations/008_conflict_checks.sql
# Copy and run
```

**10. Backup System** (`009_backups.sql`)
```bash
# Creates backups table and storage bucket
# Open: supabase/migrations/009_backups.sql
# Copy and run (large file ~250 lines)
```

#### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref nmllrewdfkpuhchkeogh

# Run all migrations
supabase db push

# Or run individually
cd supabase/migrations
supabase db execute --file 001_initial_schema.sql
supabase db execute --file 002_ai_usage.sql
supabase db execute --file 003_add_api_key_fields.sql
supabase db execute --file create_audit_logs_table.sql
supabase db execute --file 004_transcript_versions.sql
supabase db execute --file 005_timestamp_proofs.sql
supabase db execute --file 006_speakers.sql
supabase db execute --file 007_redactions.sql
supabase db execute --file 008_conflict_checks.sql
supabase db execute --file 009_backups.sql
```

### Step 2: Verify Tables Created

Run this query in SQL Editor:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected output (should see these tables):**
- `ai_usage`
- `audit_logs`
- `backups`
- `billable_time`
- `citations`
- `conflict_checks`
- `encrypted_api_keys`
- `export_jobs`
- `generated_documents`
- `matters`
- `redactions`
- `sessions`
- `speakers`
- `timestamp_proofs`
- `transcript_segments`
- `transcript_versions`

### Step 3: Verify RLS Policies

Check Row Level Security is enabled:

```sql
-- Check RLS is enabled on all tables
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

All tables should show `rowsecurity = true`.

### Step 4: Enable Database Extensions

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- If using embeddings/vector search (optional)
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- Verify extensions
SELECT extname FROM pg_extension;
```

## 🗂️ Storage Setup

### Step 1: Create Storage Buckets

#### Audio Files Bucket

1. Go to **Storage** in Supabase Dashboard
2. Click **New Bucket**
3. Configure:
   - **Name:** `audio-files`
   - **Public:** ❌ No (Private)
   - **File size limit:** 100 MB (or as needed)
   - **Allowed MIME types:** `audio/*` (optional)
4. Click **Create Bucket**

#### Backups Bucket

1. Click **New Bucket**
2. Configure:
   - **Name:** `backups`
   - **Public:** ❌ No (Private)
   - **File size limit:** 500 MB (or as needed)
3. Click **Create Bucket**

### Step 2: Configure Storage Policies

The migrations already created RLS policies for storage, but verify they exist:

```sql
-- Check storage policies
SELECT
  policyname,
  tablename,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
ORDER BY tablename, policyname;
```

If policies don't exist, run:

```sql
-- Audio files policies
CREATE POLICY "Users can upload audio files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view audio files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete audio files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Backups policies (same pattern)
CREATE POLICY "Users can upload backups"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'backups' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view backups"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'backups' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete backups"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'backups' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## 🔐 Authentication Setup

### Step 1: Enable Email Authentication

1. Go to **Authentication** → **Providers**
2. Find **Email** provider
3. Toggle **Enable Email provider** to ON
4. Configure settings:
   - ✅ Enable email confirmations (recommended)
   - ✅ Enable secure email change
   - Set minimum password length (e.g., 8)
5. Click **Save**

### Step 2: Configure Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Customize templates:

**Confirm Signup:**
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

**Reset Password:**
```html
<h2>Reset Password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>
```

**Magic Link:**
```html
<h2>Magic Link</h2>
<p>Follow this link to sign in:</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
```

### Step 3: Configure Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL:** `https://your-app.vercel.app`
3. Add **Redirect URLs:**
   - `https://your-app.vercel.app/**`
   - `http://localhost:3000/**` (for development)
4. Click **Save**

### Step 4: Enable OAuth Providers (Optional)

#### Google OAuth

1. Go to **Authentication** → **Providers**
2. Find **Google** provider
3. Toggle **Enable**
4. Enter credentials:
   - **Client ID:** from Google Cloud Console
   - **Client Secret:** from Google Cloud Console
5. Set **Authorized redirect URI:** Copy from Supabase
6. Click **Save**

**Get Google credentials:**
- https://console.cloud.google.com/
- Create OAuth 2.0 credentials
- See: https://supabase.com/docs/guides/auth/social-login/auth-google

#### Microsoft OAuth

1. Similar steps for Microsoft
2. Get credentials from Azure Portal
3. See: https://supabase.com/docs/guides/auth/social-login/auth-microsoft

## 🔑 Get API Keys

### Step 1: Copy Project URL and Keys

1. Go to **Settings** → **API**
2. Copy the following:

**Project URL:**
```
https://nmllrewdfkpuhchkeogh.supabase.co
```

**Project API Keys:**
- **anon/public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ **Keep secret!**

### Step 2: Copy Connection Strings

1. Go to **Settings** → **Database**
2. Under **Connection string**, select:
   - **Session mode** (Direct connection) for `DIRECT_URL`
   - **Transaction mode** (Connection pooling) for `DATABASE_URL`

**Connection Pooling (for DATABASE_URL):**
```
postgresql://postgres.nmllrewdfkpuhchkeogh:PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Direct Connection (for DIRECT_URL):**
```
postgresql://postgres.nmllrewdfkpuhchkeogh:PASSWORD@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

## ✅ Verification Checklist

### Database
- [ ] All 10 migrations run successfully
- [ ] 16+ tables created
- [ ] RLS enabled on all tables
- [ ] Database extensions enabled
- [ ] Functions created (check with `\df` in psql)

### Storage
- [ ] `audio-files` bucket created
- [ ] `backups` bucket created
- [ ] Storage policies configured
- [ ] Buckets are private (not public)

### Authentication
- [ ] Email authentication enabled
- [ ] Site URL configured
- [ ] Email templates customized (optional)
- [ ] OAuth providers configured (optional)

### API Keys
- [ ] Project URL copied
- [ ] Anon key copied
- [ ] Service role key copied (and kept secret!)
- [ ] Connection strings copied

## 🧪 Test Your Setup

### Test Database Connection

```sql
-- In Supabase SQL Editor

-- 1. Test a simple query
SELECT 1;

-- 2. Check user can be created
INSERT INTO auth.users (email, encrypted_password)
VALUES ('test@example.com', crypt('password123', gen_salt('bf')));

-- 3. Test RLS (should return nothing if no user context)
SELECT * FROM matters;
```

### Test Storage Upload

```javascript
// In your app or browser console
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://nmllrewdfkpuhchkeogh.supabase.co',
  'YOUR_ANON_KEY'
)

// Test upload
const file = new File(['test'], 'test.txt', { type: 'text/plain' })
const { data, error } = await supabase.storage
  .from('audio-files')
  .upload('test-user-id/test.txt', file)

console.log(data, error)
```

### Test Authentication

```javascript
// Test signup
const { data, error } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password123'
})

console.log(data, error)

// Test login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password123'
})

console.log(data, error)
```

## 🚨 Troubleshooting

### Issue: "relation does not exist"
**Solution:** Migration didn't run. Re-run the specific migration file.

### Issue: "permission denied for table"
**Solution:** RLS is blocking. Use service role key for admin operations, or check RLS policies.

### Issue: Storage upload fails with 403
**Solution:** Check storage policies exist and bucket is created. Verify user is authenticated.

### Issue: Can't connect to database
**Solution:** Check connection string is correct. Verify project is not paused. Check IP allowlist (Supabase allows all by default).

### Issue: Functions not found
**Solution:** Migrations may not have run completely. Check SQL Editor for errors during migration.

## 📚 Additional Resources

- [Supabase Quickstart](https://supabase.com/docs/guides/getting-started)
- [Database Migrations](https://supabase.com/docs/guides/cli/managing-environments)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage](https://supabase.com/docs/guides/storage)
- [Authentication](https://supabase.com/docs/guides/auth)

## 🎉 Setup Complete!

Once all checklist items are complete, your Supabase project is ready for deployment!

Next step: [Vercel Deployment](VERCEL_DEPLOYMENT.md)
