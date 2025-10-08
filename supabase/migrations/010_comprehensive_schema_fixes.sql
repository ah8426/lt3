-- ============================================================================
-- MIGRATION 010: COMPREHENSIVE SCHEMA FIXES
-- ============================================================================
-- Description: Fixes all schema inconsistencies between migrations and Prisma
-- Created: 2025-10-08
-- IMPORTANT: Run this after all other migrations (001-009) are applied
-- ============================================================================

-- ============================================================================
-- PART 1: FIX SESSIONS TABLE
-- ============================================================================

-- Add missing columns to sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS share_token TEXT,
  ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS share_scope TEXT,
  ADD COLUMN IF NOT EXISTS total_cost DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS asr_provider TEXT,
  ADD COLUMN IF NOT EXISTS asr_cost DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_provider TEXT,
  ADD COLUMN IF NOT EXISTS ai_cost DECIMAL(10, 2) DEFAULT 0;

-- Rename columns to match Prisma (snake_case in DB)
DO $$
BEGIN
  -- Check if column exists before renaming
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='audio_url') THEN
    ALTER TABLE public.sessions RENAME COLUMN audio_url TO audio_storage_path;
  END IF;
END $$;

-- Convert transcript TEXT to transcript_data JSONB
DO $$
BEGIN
  -- Add new column
  ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS transcript_data JSONB;

  -- Migrate existing data (if transcript column exists)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sessions' AND column_name='transcript') THEN
    -- Only update if transcript_data is null and transcript has value
    UPDATE public.sessions
    SET transcript_data = jsonb_build_object('text', transcript)
    WHERE transcript IS NOT NULL AND transcript_data IS NULL;

    -- Drop old column
    ALTER TABLE public.sessions DROP COLUMN IF EXISTS transcript;
  END IF;
END $$;

-- Fix status check constraint to include 'active'
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('recording', 'paused', 'stopped', 'completed', 'error', 'active'));

-- Make title nullable
ALTER TABLE public.sessions
  ALTER COLUMN title DROP NOT NULL;

-- Make matter_id NOT NULL (Prisma expects required field)
-- First, handle any existing NULL values by creating a LEGACY matter for each user
DO $$
DECLARE
  user_record RECORD;
  legacy_matter_id TEXT;
BEGIN
  -- For each user with NULL matter_id sessions, create a LEGACY matter
  FOR user_record IN
    SELECT DISTINCT user_id
    FROM public.sessions
    WHERE matter_id IS NULL
  LOOP
    -- Create a LEGACY matter for this user
    INSERT INTO public.matters (id, user_id, name, client_name, status)
    VALUES (
      'legacy-' || user_record.user_id,
      user_record.user_id,
      'Legacy Matter (Auto-Created)',
      'Legacy Client',
      'archived'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Update sessions to point to this LEGACY matter
    UPDATE public.sessions
    SET matter_id = 'legacy-' || user_record.user_id
    WHERE matter_id IS NULL AND user_id = user_record.user_id;
  END LOOP;
END $$;

-- Fix foreign key constraint to CASCADE instead of SET NULL (incompatible with NOT NULL)
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS fk_sessions_matter;

ALTER TABLE public.sessions
  ADD CONSTRAINT fk_sessions_matter
  FOREIGN KEY (matter_id)
  REFERENCES public.matters(id)
  ON DELETE CASCADE;

-- Now set NOT NULL constraint (should be safe now)
ALTER TABLE public.sessions
  ALTER COLUMN matter_id SET NOT NULL;

-- Rename duration_ms to match Prisma expectations (keep snake_case for DB)
-- The Prisma @map directive will handle the camelCase conversion
-- DB column should be: duration_ms, Prisma will use: durationMs

-- Add unique constraint on share_token
ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_share_token_key;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_share_token_key UNIQUE (share_token);

-- Add new indexes for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_status_started
  ON public.sessions(user_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_matter_started
  ON public.sessions(matter_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_share_token
  ON public.sessions(share_token) WHERE share_token IS NOT NULL;

-- ============================================================================
-- PART 2: FIX TRANSCRIPTION_SEGMENTS TABLE
-- ============================================================================

-- Rename time columns if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transcription_segments' AND column_name='start_time') THEN
    ALTER TABLE public.transcription_segments RENAME COLUMN start_time TO start_ms;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transcription_segments' AND column_name='end_time') THEN
    ALTER TABLE public.transcription_segments RENAME COLUMN end_time TO end_ms;
  END IF;
END $$;

-- Add missing columns
ALTER TABLE public.transcription_segments
  ADD COLUMN IF NOT EXISTS speaker_name TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_by TEXT;

-- Fix speaker column: Migration 006 should have already added speaker_id
-- The old INTEGER speaker column should be migrated to speaker_number
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transcription_segments' AND column_name='speaker' AND data_type='integer') THEN
    -- Rename the integer speaker column to speaker_legacy
    ALTER TABLE public.transcription_segments RENAME COLUMN speaker TO speaker_legacy;
  END IF;
END $$;

-- Remove updated_at column (Prisma doesn't have it)
-- First drop the trigger that updates this column
DROP TRIGGER IF EXISTS segments_updated_at ON public.transcription_segments;
ALTER TABLE public.transcription_segments DROP COLUMN IF EXISTS updated_at;

-- Recreate speaker stats trigger after column renames
DROP TRIGGER IF EXISTS update_speaker_stats_trigger ON public.transcription_segments;
CREATE TRIGGER update_speaker_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.transcription_segments
  FOR EACH ROW
  WHEN (NEW.speaker_id IS NOT NULL OR OLD.speaker_id IS NOT NULL)
  EXECUTE FUNCTION trigger_update_speaker_stats();

-- Update indexes
CREATE INDEX IF NOT EXISTS idx_transcription_segments_session_start
  ON public.transcription_segments(session_id, start_ms);

-- Drop redundant index (new composite index covers it)
DROP INDEX IF EXISTS idx_segments_session;

-- ============================================================================
-- PART 3: DROP ORPHANED SEGMENT_EDIT_HISTORY TABLE
-- ============================================================================

-- This table is replaced by transcript_versions (migration 004)
DROP TABLE IF EXISTS public.segment_edit_history CASCADE;

-- ============================================================================
-- PART 4: FIX MATTERS TABLE
-- ============================================================================

-- Rename columns to snake_case
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matters' AND column_name='clientName') THEN
    ALTER TABLE public.matters RENAME COLUMN "clientName" TO client_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matters' AND column_name='adverseParty') THEN
    ALTER TABLE public.matters RENAME COLUMN "adverseParty" TO adverse_party;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matters' AND column_name='caseNumber') THEN
    ALTER TABLE public.matters RENAME COLUMN "caseNumber" TO case_number;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matters' AND column_name='courtType') THEN
    ALTER TABLE public.matters RENAME COLUMN "courtType" TO court_type;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matters' AND column_name='createdAt') THEN
    ALTER TABLE public.matters RENAME COLUMN "createdAt" TO created_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matters' AND column_name='updatedAt') THEN
    ALTER TABLE public.matters RENAME COLUMN "updatedAt" TO updated_at;
  END IF;
END $$;

-- ============================================================================
-- PART 5: FIX PROFILES (USER) TABLE - ADD MISSING FIELDS
-- ============================================================================

-- Add authentication columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_id TEXT,
  ADD COLUMN IF NOT EXISTS firm_id UUID,
  ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['user']::TEXT[];

-- Add subscription columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Add settings and tracking columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add unique constraints
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_key UNIQUE (email);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_stripe_customer_id_key;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_stripe_subscription_id_key;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_stripe_subscription_id_key UNIQUE (stripe_subscription_id);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_profiles_firm_id ON public.profiles(firm_id) WHERE firm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON public.profiles(subscription_tier, subscription_status);

-- ============================================================================
-- PART 6: FIX ENCRYPTED_API_KEYS TABLE
-- ============================================================================

-- Check if provider column is using an ENUM type or CHECK constraint
DO $$
BEGIN
  -- First, check if there's an ENUM type
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'encrypted_api_provider'
  ) THEN
    -- Check if 'google' value already exists in enum
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'encrypted_api_provider' AND e.enumlabel = 'google'
    ) THEN
      ALTER TYPE encrypted_api_provider ADD VALUE 'google';
    END IF;

    -- Only update if 'google-ai' exists as enum value
    IF EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'encrypted_api_provider' AND e.enumlabel = 'google-ai'
    ) THEN
      -- Temporarily convert to text, update, then back to enum
      ALTER TABLE public.encrypted_api_keys ALTER COLUMN provider TYPE TEXT;
      UPDATE public.encrypted_api_keys SET provider = 'google' WHERE provider = 'google-ai';
      ALTER TABLE public.encrypted_api_keys
        ALTER COLUMN provider TYPE encrypted_api_provider
        USING provider::encrypted_api_provider;
    END IF;

    -- Note: We can't remove enum values in PostgreSQL, but data is migrated
  ELSE
    -- It's a CHECK constraint, fix it
    ALTER TABLE public.encrypted_api_keys
      DROP CONSTRAINT IF EXISTS encrypted_api_keys_provider_check;
    ALTER TABLE public.encrypted_api_keys
      ADD CONSTRAINT encrypted_api_keys_provider_check
      CHECK (provider IN ('deepgram', 'assemblyai', 'anthropic', 'openai', 'google', 'openrouter'));
  END IF;
END $$;

-- ============================================================================
-- PART 7: CREATE MISSING TABLES
-- ============================================================================

-- Table: subscription_plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,

  -- Pricing (in cents)
  price_monthly INTEGER NOT NULL,
  price_yearly INTEGER NOT NULL,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,

  -- Limits
  max_sessions INTEGER DEFAULT -1,
  max_storage_gb INTEGER DEFAULT -1,
  max_ai_requests INTEGER DEFAULT -1,
  max_matters INTEGER DEFAULT -1,
  max_users INTEGER DEFAULT 1,

  -- Features
  features JSONB DEFAULT '{}'::jsonb,

  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active_sort
  ON public.subscription_plans(is_active, sort_order);

-- Table: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,

  amount_due INTEGER NOT NULL,
  amount_paid INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,

  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  invoice_pdf TEXT,
  hosted_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_created ON public.invoices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- Table: usage_metrics
CREATE TABLE IF NOT EXISTS public.usage_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,

  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  sessions_count INTEGER DEFAULT 0,
  transcription_minutes DECIMAL(10, 2) DEFAULT 0,
  ai_requests_count INTEGER DEFAULT 0,
  storage_used_gb DECIMAL(10, 2) DEFAULT 0,

  transcription_cost DECIMAL(10, 2) DEFAULT 0,
  ai_cost DECIMAL(10, 2) DEFAULT 0,
  storage_cost DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_user_period ON public.usage_metrics(user_id, period_end DESC);

-- Table: transcript_access_logs
CREATE TABLE IF NOT EXISTS public.transcript_access_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID,
  access_type TEXT NOT NULL,
  access_method TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_logs_session ON public.transcript_access_logs(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON public.transcript_access_logs(user_id, timestamp DESC);

-- Table: chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  role TEXT NOT NULL,
  content TEXT NOT NULL,

  provider TEXT,
  model TEXT,
  tokens INTEGER,
  cost DECIMAL(10, 6),

  context_used JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at DESC);

-- Table: citations
CREATE TABLE IF NOT EXISTS public.citations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_message_id TEXT REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  session_id TEXT,
  document_id TEXT,

  citation_type TEXT NOT NULL,
  full_citation TEXT NOT NULL,
  short_citation TEXT,

  jurisdiction TEXT,
  statute_code TEXT,
  section TEXT,

  case_name TEXT,
  reporter TEXT,
  volume INTEGER,
  page INTEGER,
  year INTEGER,
  court TEXT,

  is_verified BOOLEAN DEFAULT false,
  verification_status TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  verification_notes TEXT,

  treatment_status TEXT,
  treatment_notes TEXT,

  westlaw_url TEXT,
  lexis_url TEXT,
  public_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_session ON public.citations(session_id, citation_type);
CREATE INDEX IF NOT EXISTS idx_citations_jurisdiction ON public.citations(jurisdiction, statute_code, section);
CREATE INDEX IF NOT EXISTS idx_citations_verified ON public.citations(is_verified, verification_status);

-- Table: export_jobs
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  format TEXT NOT NULL,
  template TEXT,

  include_line_numbers BOOLEAN DEFAULT false,
  include_timestamps BOOLEAN DEFAULT true,
  include_page_numbers BOOLEAN DEFAULT true,
  include_certification BOOLEAN DEFAULT false,
  include_index_page BOOLEAN DEFAULT false,
  include_table_of_contents BOOLEAN DEFAULT false,

  certified_by TEXT,
  certification_date TIMESTAMPTZ,
  certification_text TEXT,
  bar_number TEXT,

  status TEXT DEFAULT 'pending',
  file_url TEXT,
  file_size INTEGER,

  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON public.export_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_session ON public.export_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON public.export_jobs(status);

-- Table: document_templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  file_url TEXT NOT NULL,
  fields JSONB NOT NULL,

  court_type TEXT,
  document_type TEXT,
  jurisdiction TEXT,

  use_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,

  is_public BOOLEAN DEFAULT false,
  shared_with TEXT[] DEFAULT ARRAY[]::TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_user_type ON public.document_templates(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_templates_public ON public.document_templates(is_public, jurisdiction);

-- Table: generated_documents
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id TEXT NOT NULL REFERENCES public.document_templates(id),
  session_id TEXT REFERENCES public.sessions(id) ON DELETE SET NULL,
  matter_id TEXT NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  format TEXT NOT NULL,

  field_values JSONB NOT NULL,

  version INTEGER DEFAULT 1,
  parent_id TEXT,

  status TEXT DEFAULT 'draft',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_docs_matter ON public.generated_documents(matter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_docs_template ON public.generated_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_user ON public.generated_documents(user_id, status);

-- Table: billable_time
CREATE TABLE IF NOT EXISTS public.billable_time (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  matter_id TEXT NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  billable_seconds INTEGER NOT NULL,

  hourly_rate DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,

  activity_type TEXT NOT NULL,
  description TEXT,

  status TEXT DEFAULT 'draft',
  invoice_id TEXT,
  invoice_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billable_time_matter ON public.billable_time(matter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billable_time_user ON public.billable_time(user_id, status);
CREATE INDEX IF NOT EXISTS idx_billable_time_invoice ON public.billable_time(invoice_id);

-- Table: feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percent INTEGER DEFAULT 0,
  enabled_for_users TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(is_enabled);

-- Table: system_logs
CREATE TABLE IF NOT EXISTS public.system_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  level TEXT NOT NULL,
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  error TEXT,
  stack TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON public.system_logs(service, timestamp DESC);

-- ============================================================================
-- PART 8: ADD RLS POLICIES FOR NEW TABLES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billable_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Subscription plans (public read)
CREATE POLICY "Anyone can view active subscription plans" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

-- Invoices (user-specific)
CREATE POLICY "Users can view own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);

-- Usage metrics (user-specific)
CREATE POLICY "Users can view own usage metrics" ON public.usage_metrics
  FOR SELECT USING (auth.uid() = user_id);

-- Transcript access logs (via session ownership)
CREATE POLICY "Users can view access logs for own sessions" ON public.transcript_access_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- Chat messages (via session ownership)
CREATE POLICY "Users can view chat messages for own sessions" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Users can create chat messages for own sessions" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- Citations (via session ownership)
CREATE POLICY "Users can view citations for own sessions" ON public.citations
  FOR SELECT USING (
    session_id IS NULL OR EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

-- Export jobs (user-specific)
CREATE POLICY "Users can view own export jobs" ON public.export_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own export jobs" ON public.export_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Document templates (user-specific or public)
CREATE POLICY "Users can view own or public templates" ON public.document_templates
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create own templates" ON public.document_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON public.document_templates
  FOR UPDATE USING (auth.uid() = user_id);

-- Generated documents (user-specific)
CREATE POLICY "Users can view own generated documents" ON public.generated_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own generated documents" ON public.generated_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Billable time (user-specific)
CREATE POLICY "Users can view own billable time" ON public.billable_time
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own billable time" ON public.billable_time
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own billable time" ON public.billable_time
  FOR UPDATE USING (auth.uid() = user_id);

-- Feature flags (public read)
CREATE POLICY "Anyone can view feature flags" ON public.feature_flags
  FOR SELECT USING (true);

-- System logs (service role only)
CREATE POLICY "Service role can manage system logs" ON public.system_logs
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- PART 9: ADD TRIGGERS FOR NEW TABLES
-- ============================================================================

-- Note: update_updated_at() function already exists from migration 001
-- No need to create it again

-- Add triggers (use existing update_updated_at function from migration 001)
CREATE TRIGGER subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER document_templates_updated_at BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER feature_flags_updated_at BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- PART 10: ADD HELPFUL COMMENTS
-- ============================================================================

COMMENT ON TABLE public.subscription_plans IS 'Subscription tier definitions with pricing and feature limits';
COMMENT ON TABLE public.invoices IS 'Stripe invoice records for user subscriptions';
COMMENT ON TABLE public.usage_metrics IS 'Aggregated usage metrics per user per period';
COMMENT ON TABLE public.transcript_access_logs IS 'Audit trail of who accessed which transcripts';
COMMENT ON TABLE public.chat_messages IS 'AI chat conversation history per session';
COMMENT ON TABLE public.citations IS 'Legal citations extracted and verified from chat/documents';
COMMENT ON TABLE public.export_jobs IS 'Transcript export and court document generation jobs';
COMMENT ON TABLE public.document_templates IS 'User-uploaded court document templates';
COMMENT ON TABLE public.generated_documents IS 'Documents generated from templates';
COMMENT ON TABLE public.billable_time IS 'Time tracking for billing purposes';
COMMENT ON TABLE public.feature_flags IS 'System-wide feature toggles';
COMMENT ON TABLE public.system_logs IS 'Application and system logging';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification check
DO $$
DECLARE
  missing_tables TEXT[];
BEGIN
  SELECT array_agg(table_name)
  INTO missing_tables
  FROM (VALUES
    ('sessions'), ('transcription_segments'), ('matters'), ('profiles'),
    ('encrypted_api_keys'), ('subscription_plans'), ('invoices'),
    ('usage_metrics'), ('transcript_access_logs'), ('chat_messages'),
    ('citations'), ('export_jobs'), ('document_templates'),
    ('generated_documents'), ('billable_time'), ('feature_flags'),
    ('system_logs')
  ) AS expected(table_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = expected.table_name
  );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'FAILED: Missing tables: %', array_to_string(missing_tables, ', ');
  ELSE
    RAISE NOTICE 'SUCCESS: All required tables exist';
  END IF;
END $$;
