-- ============================================================================
-- MIGRATION 010: ADD MISSING COLUMNS
-- ============================================================================
-- Description: Adds missing columns to sessions, profiles, and transcription_segments
-- Safe to run: Only adds columns with IF NOT EXISTS
-- ============================================================================

-- ============================================================================
-- SESSIONS TABLE - Add missing columns
-- ============================================================================

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
  ADD COLUMN IF NOT EXISTS ai_cost DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS transcript_data JSONB;

-- Add unique constraint on share_token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sessions_share_token_key'
  ) THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_share_token_key UNIQUE (share_token);
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_status_started
  ON public.sessions(user_id, status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_matter_started
  ON public.sessions(matter_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_share_token
  ON public.sessions(share_token) WHERE share_token IS NOT NULL;

-- ============================================================================
-- PROFILES TABLE - Add missing columns
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_id TEXT,
  ADD COLUMN IF NOT EXISTS firm_id UUID,
  ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['user']::TEXT[],
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Add unique constraints (with existence check)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_email_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_stripe_customer_id_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_customer_id_key UNIQUE (stripe_customer_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_stripe_subscription_id_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_stripe_subscription_id_key UNIQUE (stripe_subscription_id);
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_profiles_firm_id
  ON public.profiles(firm_id) WHERE firm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_subscription
  ON public.profiles(subscription_tier, subscription_status);

-- ============================================================================
-- TRANSCRIPTION_SEGMENTS TABLE - Add missing columns
-- ============================================================================

ALTER TABLE public.transcription_segments
  ADD COLUMN IF NOT EXISTS start_ms INTEGER,
  ADD COLUMN IF NOT EXISTS end_ms INTEGER,
  ADD COLUMN IF NOT EXISTS speaker_name TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_by TEXT;

-- Add index
CREATE INDEX IF NOT EXISTS idx_transcription_segments_session_start
  ON public.transcription_segments(session_id, COALESCE(start_ms, start_time));

-- ============================================================================
-- SUCCESS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 010 completed: Missing columns added successfully';
END $$;
