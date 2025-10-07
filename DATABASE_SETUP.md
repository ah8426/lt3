# Database Setup Guide

## Overview

Complete database schema setup for Law Transcribed application with Supabase PostgreSQL. This guide covers all tables, indexes, RLS policies, and storage configuration.

## Prerequisites

- Supabase project created
- Database connection details available
- `.env` file configured with `DATABASE_URL` and `DIRECT_URL`

## Quick Setup

### Option 1: Automated Setup (Recommended)

Run the consolidated setup script:

```bash
# From project root
npm run db:setup
```

This will execute all migration scripts in order.

### Option 2: Manual Setup via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the SQL scripts below in order
4. Execute each script

### Option 3: Prisma Migration (Partial)

```bash
npx prisma db push
```

Note: This only creates some tables. You'll need to manually create cross-schema tables.

---

## Database Schema

### 1. Core Tables

#### Sessions Table

```sql
-- Sessions table for dictation sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id TEXT REFERENCES public.matters(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  transcript TEXT,
  audio_url TEXT,
  duration_ms INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('recording', 'paused', 'stopped', 'completed', 'error')) DEFAULT 'recording',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_matter ON public.sessions(matter_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON public.sessions(created_at DESC);

-- RLS Policies
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Update trigger
CREATE OR REPLACE FUNCTION update_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_sessions_updated_at();
```

#### Transcription Segments Table

```sql
-- Transcription segments table
CREATE TABLE IF NOT EXISTS public.transcription_segments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  speaker INTEGER,
  confidence DECIMAL(5,4),
  start_time INTEGER NOT NULL, -- milliseconds
  end_time INTEGER NOT NULL,   -- milliseconds
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_segments_session ON public.transcription_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_segments_speaker ON public.transcription_segments(speaker);
CREATE INDEX IF NOT EXISTS idx_segments_time ON public.transcription_segments(start_time);
CREATE INDEX IF NOT EXISTS idx_segments_final ON public.transcription_segments(is_final);

-- RLS Policies
ALTER TABLE public.transcription_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own segments"
  ON public.transcription_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = transcription_segments.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own segments"
  ON public.transcription_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = transcription_segments.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own segments"
  ON public.transcription_segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = transcription_segments.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own segments"
  ON public.transcription_segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = transcription_segments.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- Update trigger
CREATE TRIGGER segments_updated_at
  BEFORE UPDATE ON public.transcription_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_sessions_updated_at();
```

#### Segment Edit History Table

```sql
-- Segment edit history for tracking changes
CREATE TABLE IF NOT EXISTS public.segment_edit_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  segment_id TEXT NOT NULL REFERENCES public.transcription_segments(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_text TEXT NOT NULL,
  new_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_history_segment ON public.segment_edit_history(segment_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON public.segment_edit_history(edited_by);
CREATE INDEX IF NOT EXISTS idx_history_created ON public.segment_edit_history(created_at DESC);

-- RLS Policies
ALTER TABLE public.segment_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view edit history for own segments"
  ON public.segment_edit_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transcription_segments ts
      JOIN public.sessions s ON s.id = ts.session_id
      WHERE ts.id = segment_edit_history.segment_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create edit history"
  ON public.segment_edit_history FOR INSERT
  WITH CHECK (auth.uid() = edited_by);
```

#### Matters Table

```sql
-- Matters (cases) table
CREATE TABLE IF NOT EXISTS public.matters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  adverse_party TEXT,
  jurisdiction TEXT CHECK (jurisdiction IN ('michigan', 'federal', 'other')),
  court_type TEXT CHECK (court_type IN ('circuit', 'district', 'probate', 'appeals', 'bankruptcy', 'family', 'other')),
  case_number TEXT,
  status TEXT CHECK (status IN ('active', 'pending', 'closed', 'archived')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_matters_user ON public.matters(user_id);
CREATE INDEX IF NOT EXISTS idx_matters_status ON public.matters(status);
CREATE INDEX IF NOT EXISTS idx_matters_client ON public.matters(client_name);

-- RLS Policies
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own matters"
  ON public.matters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own matters"
  ON public.matters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own matters"
  ON public.matters FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own matters"
  ON public.matters FOR DELETE
  USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER matters_updated_at
  BEFORE UPDATE ON public.matters
  FOR EACH ROW
  EXECUTE FUNCTION update_sessions_updated_at();
```

#### Encrypted API Keys Table

```sql
-- Encrypted API keys table
CREATE TABLE IF NOT EXISTS public.encrypted_api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('deepgram', 'assemblyai', 'google-ai', 'anthropic', 'openai', 'openrouter')),
  encrypted_key TEXT NOT NULL,
  masked_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.encrypted_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON public.encrypted_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.encrypted_api_keys(is_active);

-- RLS Policies
ALTER TABLE public.encrypted_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON public.encrypted_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON public.encrypted_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON public.encrypted_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON public.encrypted_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Update trigger
CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON public.encrypted_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_sessions_updated_at();
```

#### Profiles Table

```sql
-- User profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Update trigger
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_sessions_updated_at();
```

---

### 2. Storage Configuration

#### Create Audio Recordings Bucket

```sql
-- Create storage bucket for audio recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', false)
ON CONFLICT (id) DO NOTHING;
```

#### Storage Policies

```sql
-- Policy: Users can upload own recordings
CREATE POLICY "Users can upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view own recordings
CREATE POLICY "Users can view own recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update own recordings
CREATE POLICY "Users can update own recordings"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audio-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete own recordings
CREATE POLICY "Users can delete own recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

### 3. Functions and Triggers

#### Auto-create Profile on User Signup

```sql
-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

### 4. Additional Helper Tables (Optional)

#### Documents Table

```sql
-- Documents table
CREATE TABLE IF NOT EXISTS public.documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id TEXT REFERENCES public.matters(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES public.sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT,
  format TEXT CHECK (format IN ('txt', 'docx', 'pdf')) DEFAULT 'txt',
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_matter ON public.documents(matter_id);
CREATE INDEX IF NOT EXISTS idx_documents_session ON public.documents(session_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own documents"
  ON public.documents FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

#### Billable Time Table

```sql
-- Billable time table
CREATE TABLE IF NOT EXISTS public.billable_time (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id TEXT REFERENCES public.matters(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES public.sessions(id) ON DELETE SET NULL,
  description TEXT,
  billable_seconds INTEGER NOT NULL,
  amount INTEGER NOT NULL, -- in cents
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billable_user ON public.billable_time(user_id);
CREATE INDEX IF NOT EXISTS idx_billable_matter ON public.billable_time(matter_id);
CREATE INDEX IF NOT EXISTS idx_billable_session ON public.billable_time(session_id);

ALTER TABLE public.billable_time ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own billable time"
  ON public.billable_time FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## Setup Scripts

### Create Migration File

Create `supabase/migrations/001_initial_schema.sql`:

```sql
-- Copy all the SQL from above into this file
-- Then run:
-- npx supabase db push
```

### Or Use Individual Scripts

Create separate files for each table:

```
migrations/
  001_sessions.sql
  002_transcription_segments.sql
  003_segment_edit_history.sql
  004_matters.sql
  005_encrypted_api_keys.sql
  006_profiles.sql
  007_storage_buckets.sql
  008_storage_policies.sql
  009_functions_triggers.sql
  010_documents.sql
  011_billable_time.sql
```

Run each with:

```bash
psql $DATABASE_URL -f migrations/001_sessions.sql
```

---

## Verification

### Check Tables

```sql
-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Check Policies

```sql
-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check Indexes

```sql
-- List all indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Check Storage Buckets

```sql
-- List storage buckets
SELECT * FROM storage.buckets;

-- List storage policies
SELECT * FROM pg_policies WHERE schemaname = 'storage';
```

---

## Environment Variables

Ensure your `.env` and `.env.local` files have:

```env
# Database
DATABASE_URL="postgresql://postgres.xxx:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.xxx:password@aws-1-us-east-2.pooler.supabase.com:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"

# Encryption
ENCRYPTION_MASTER_KEY="your-32-byte-hex-key"
```

---

## Test Data (Optional)

### Create Test User Profile

```sql
-- Insert test profile (after creating user via Supabase Auth UI)
INSERT INTO public.profiles (id, email, full_name)
VALUES (
  'user-uuid-from-auth-users',
  'test@example.com',
  'Test User'
);
```

### Create Test Matter

```sql
INSERT INTO public.matters (user_id, name, client_name, jurisdiction, status)
VALUES (
  'user-uuid',
  'Smith v. Jones Contract Dispute',
  'John Smith',
  'michigan',
  'active'
);
```

### Create Test Session

```sql
INSERT INTO public.sessions (user_id, matter_id, title, status, duration_ms)
VALUES (
  'user-uuid',
  'matter-uuid',
  'Initial Client Interview',
  'completed',
  180000
);
```

---

## Troubleshooting

### Error: "relation does not exist"

**Solution:** Ensure you're running SQL in correct schema (public)

```sql
SET search_path TO public;
```

### Error: "permission denied for schema"

**Solution:** Check RLS policies are enabled and configured

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

### Error: "foreign key constraint"

**Solution:** Create tables in correct order (auth.users → profiles → matters → sessions → segments)

### Storage upload fails

**Solution:** Check storage policies and bucket exists

```sql
-- Verify bucket
SELECT * FROM storage.buckets WHERE id = 'audio-recordings';

-- Check policies
SELECT * FROM pg_policies WHERE schemaname = 'storage';
```

---

## Backup and Restore

### Backup Database

```bash
# Full backup
pg_dump $DATABASE_URL > backup.sql

# Schema only
pg_dump --schema-only $DATABASE_URL > schema.sql

# Data only
pg_dump --data-only $DATABASE_URL > data.sql
```

### Restore Database

```bash
psql $DATABASE_URL < backup.sql
```

---

## Performance Optimization

### Analyze Tables

```sql
ANALYZE public.sessions;
ANALYZE public.transcription_segments;
ANALYZE public.matters;
```

### Add Missing Indexes

```sql
-- If queries are slow, add composite indexes
CREATE INDEX idx_sessions_user_status ON public.sessions(user_id, status);
CREATE INDEX idx_segments_session_final ON public.transcription_segments(session_id, is_final);
```

### Enable Query Statistics

```sql
-- Show slow queries
SELECT * FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

---

## Next Steps

After database setup:

1. ✅ Verify all tables created
2. ✅ Check RLS policies active
3. ✅ Test storage bucket access
4. ✅ Create test data
5. ✅ Run application
6. ✅ Test authentication flow
7. ✅ Test session creation
8. ✅ Test audio upload

---

## Quick Reference

### Essential Commands

```bash
# Push schema with Prisma
npx prisma db push

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Run migrations
psql $DATABASE_URL -f migration.sql

# Check database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

### Connection URLs

```
Pooler (for serverless): port 6543 with ?pgbouncer=true
Direct (for migrations): port 5432 without pgbouncer
```

---

## Support

For issues:
- Check Supabase dashboard logs
- Review RLS policies
- Verify environment variables
- Check Prisma schema matches database
- Review migration history

Database setup complete! 🚀
