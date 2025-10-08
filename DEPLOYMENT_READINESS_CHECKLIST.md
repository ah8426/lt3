# Deployment Readiness Checklist

Complete checklist of all implementations needed in Supabase and Vercel before adding new features.

## 📊 Current Implementation Status

### ✅ Completed Features
- [x] Audit Logging
- [x] Version Control
- [x] Timestamp Verification (NTP)
- [x] Speaker Diarization
- [x] PII Redaction
- [x] Conflict of Interest Detection
- [x] Automated Backup & Disaster Recovery

### 📁 Database Migrations Created
- [x] `001_initial_schema.sql` - Core tables (matters, sessions, transcripts)
- [x] `002_ai_usage.sql` - AI usage tracking
- [x] `003_add_api_key_fields.sql` - API key management
- [x] `004_transcript_versions.sql` - Version control
- [x] `005_timestamp_proofs.sql` - NTP timestamp verification
- [x] `006_speakers.sql` - Speaker diarization
- [x] `007_redactions.sql` - PII redaction
- [x] `008_conflict_checks.sql` - Conflict detection
- [x] `009_backups.sql` - Backup system
- [x] `create_audit_logs_table.sql` - Audit logging

## 🔧 Supabase Setup Required

### 1. Database Migrations

**Status:** ⚠️ **Need to run migrations in Supabase**

#### Steps to Run Migrations:

**Option A: Via Supabase Dashboard (Recommended)**
```sql
-- Go to Supabase Dashboard → SQL Editor
-- Run each migration file in order:

-- 1. Initial Schema
-- Copy contents of 001_initial_schema.sql and execute

-- 2. AI Usage
-- Copy contents of 002_ai_usage.sql and execute

-- 3. API Keys
-- Copy contents of 003_add_api_key_fields.sql and execute

-- 4. Audit Logs
-- Copy contents of create_audit_logs_table.sql and execute

-- 5. Version Control
-- Copy contents of 004_transcript_versions.sql and execute

-- 6. Timestamp Proofs
-- Copy contents of 005_timestamp_proofs.sql and execute

-- 7. Speaker Diarization
-- Copy contents of 006_speakers.sql and execute

-- 8. PII Redaction
-- Copy contents of 007_redactions.sql and execute

-- 9. Conflict Checks
-- Copy contents of 008_conflict_checks.sql and execute

-- 10. Backups
-- Copy contents of 009_backups.sql and execute
```

**Option B: Via Supabase CLI**
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref nmllrewdfkpuhchkeogh

# Run migrations
supabase db push

# Or run individually
supabase db execute --file supabase/migrations/001_initial_schema.sql
supabase db execute --file supabase/migrations/002_ai_usage.sql
# ... etc
```

**Verification:**
```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables:
-- matters, sessions, transcript_segments, speakers
-- redactions, timestamp_proofs, transcript_versions
-- audit_logs, conflict_checks, backups
-- ai_usage, encrypted_api_keys, generated_documents
-- billable_time, export_jobs, citations
```

### 2. Storage Buckets

**Status:** ⚠️ **Need to create storage buckets**

#### Required Buckets:

**1. Audio Files Bucket**
```sql
-- Go to Supabase Dashboard → Storage → New Bucket
-- Name: audio-files
-- Public: No (private)

-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', false)
ON CONFLICT (id) DO NOTHING;
```

**RLS Policies for Audio Files:**
```sql
-- Already included in migration files, but verify:

-- Users can upload to their folder
CREATE POLICY "Users can upload audio files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their files
CREATE POLICY "Users can view audio files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their files
CREATE POLICY "Users can delete audio files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**2. Backups Bucket**
```sql
-- Name: backups
-- Public: No (private)

-- Already created in 009_backups.sql migration
-- Verify it exists in Storage dashboard
```

**Verification:**
```bash
# Go to Supabase Dashboard → Storage
# Should see:
# - audio-files (private)
# - backups (private)
```

### 3. Authentication Setup

**Status:** ⚠️ **Need to configure auth providers**

#### Enable Email Authentication:
1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Configure email templates (optional)

#### Enable OAuth (Optional):
- **Google OAuth**: Configure in Supabase → Auth → Providers → Google
- **Microsoft OAuth**: Configure in Supabase → Auth → Providers → Microsoft

**Email Templates:**
```
Confirmation Email:
Subject: Confirm Your Email
Body: Click the link to confirm: {{ .ConfirmationURL }}

Reset Password:
Subject: Reset Your Password
Body: Click the link to reset: {{ .ConfirmationURL }}
```

### 4. Row Level Security (RLS)

**Status:** ✅ **Already included in migrations**

Verify RLS is enabled on all tables:
```sql
-- Check RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;

-- Should return all main tables with RLS enabled
```

### 5. Database Extensions

**Status:** ⚠️ **Need to enable extensions**

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For encryption
CREATE EXTENSION IF NOT EXISTS "vector"; -- If using embeddings

-- Verify extensions
SELECT * FROM pg_extension;
```

### 6. Database Functions & Triggers

**Status:** ✅ **Already included in migrations**

Verify key functions exist:
```sql
-- List all functions
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Key functions should include:
-- - get_backup_stats
-- - cleanup_old_backups
-- - get_conflict_check_stats
-- - update_speaker_stats
-- - merge_speakers
-- etc.
```

## 🚀 Vercel Setup Required

### 1. Environment Variables

**Status:** ⚠️ **Need to add to Vercel Dashboard**

#### Required Variables:
```bash
# Use VERCEL_ENV_IMPORT.txt for copy/paste

# Critical - Must Set Before Deploy:
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ENCRYPTION_MASTER_KEY=...
BACKUP_ENCRYPTION_SECRET=...
CRON_SECRET=...
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Steps:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add each variable
3. Set scope: Production, Preview, Development
4. Mark secrets as "Sensitive"

### 2. Cron Jobs Configuration

**Status:** ✅ **vercel.json already created**

**Verify in Vercel Dashboard:**
1. After first deploy, go to Settings → Cron Jobs
2. Should see: `/api/cron/backup` running hourly
3. Test endpoint:
```bash
curl -X POST https://your-app.vercel.app/api/cron/backup \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 3. Build Settings

**Status:** ✅ **Already configured in package.json**

Verify build command in Vercel:
```
Build Command: npm run build
Output Directory: .next
Install Command: npm install
Development Command: npm run dev
```

**package.json scripts should include:**
```json
{
  "scripts": {
    "build": "prisma generate && next build",
    "postinstall": "prisma generate"
  }
}
```

### 4. Domain Configuration (Optional)

**Status:** ⏳ **Set up after deployment**

1. Add custom domain in Vercel → Settings → Domains
2. Update DNS records
3. Update `NEXT_PUBLIC_APP_URL` environment variable

### 5. Edge Configuration

**Status:** ℹ️ **Optional optimization**

Some API routes can be converted to Edge functions:
```typescript
// In API routes that don't use Prisma:
export const runtime = 'edge'
```

## 📋 Pre-Deployment Checklist

### Database Ready
- [ ] All 10 migrations run successfully in Supabase
- [ ] All tables exist and have correct schema
- [ ] RLS policies enabled on all tables
- [ ] Database extensions enabled
- [ ] Storage buckets created (audio-files, backups)
- [ ] Storage RLS policies configured
- [ ] Functions and triggers created
- [ ] Test query works: `SELECT * FROM matters LIMIT 1;`

### Supabase Configuration
- [ ] Authentication providers enabled
- [ ] Email templates configured
- [ ] Service role key copied to environment variables
- [ ] Anon key copied to environment variables
- [ ] Project URL copied to environment variables
- [ ] Connection strings (pooled and direct) copied

### Vercel Configuration
- [ ] All environment variables added
- [ ] Environment variable scopes set correctly
- [ ] Secrets marked as sensitive
- [ ] Build command configured
- [ ] Node version set (if needed)

### Application Ready
- [ ] `.env` file configured locally
- [ ] `prisma generate` runs successfully
- [ ] Local build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Tests pass (if any)

### Post-Deployment Verification
- [ ] First deployment succeeds
- [ ] Update `NEXT_PUBLIC_APP_URL` with actual URL
- [ ] Visit app and verify it loads
- [ ] Sign up works
- [ ] Login works
- [ ] Create test matter
- [ ] Upload test audio file
- [ ] Check database for test data
- [ ] Verify cron job appears in Vercel
- [ ] Check logs for errors

## 🔍 Verification Scripts

### Check Database Schema
```sql
-- Run in Supabase SQL Editor

-- 1. Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- 3. Check storage buckets
SELECT id, name, public
FROM storage.buckets;

-- 4. Check functions
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public';

-- 5. Test query
SELECT COUNT(*) FROM matters;
```

### Test Environment Variables
```bash
# Local test
node -e "require('dotenv').config(); console.log('DB:', !!process.env.DATABASE_URL, 'Supabase:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)"

# Should output: DB: true Supabase: true
```

### Test Prisma Connection
```bash
# Generate client
npx prisma generate

# Test connection
npx prisma db execute --stdin <<< "SELECT 1;"

# View database
npx prisma studio
```

## 🚨 Common Issues & Solutions

### Issue: Migrations fail with "relation already exists"
**Solution:** Tables may already exist. Drop and recreate, or modify migrations to use `IF NOT EXISTS`

### Issue: RLS blocks all queries
**Solution:** Check auth.uid() is set correctly. Service role key bypasses RLS.

### Issue: Storage bucket not accessible
**Solution:** Verify bucket exists and RLS policies are correct. Check bucket is private, not public.

### Issue: Cron job doesn't run
**Solution:** Verify `vercel.json` is committed, `CRON_SECRET` is set, and route exists.

### Issue: Build fails on Vercel
**Solution:** Check `postinstall` script runs `prisma generate`. Verify all dependencies are in `dependencies`, not `devDependencies`.

## 📚 Documentation Links

- [Supabase Database Migrations](https://supabase.com/docs/guides/cli/managing-environments)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

## ✅ Ready for New Features?

Before adding new features, ensure:
- ✅ All migrations run successfully
- ✅ All environment variables set
- ✅ Application deploys and runs
- ✅ Core features work (auth, matters, sessions)
- ✅ Backups system tested
- ✅ Cron jobs running

**Once all checkboxes are complete, you're ready to add new features!** 🚀
