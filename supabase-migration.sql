-- ============================================================================
-- SUPABASE MIGRATION FOR LAW TRANSCRIBED
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENCRYPTED API KEYS TABLE
-- ============================================================================

-- Encrypted API keys table (for Prisma compatibility)
CREATE TABLE IF NOT EXISTS public.encrypted_api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('deepgram', 'assemblyai', 'google-ai', 'anthropic', 'openai', 'openrouter')),
  encrypted_key TEXT NOT NULL,
  masked_key TEXT,
  is_active BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  test_status TEXT,
  test_error TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Indexes for encrypted_api_keys
CREATE INDEX IF NOT EXISTS idx_encrypted_api_keys_user_id ON public.encrypted_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_encrypted_api_keys_provider ON public.encrypted_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_encrypted_api_keys_active ON public.encrypted_api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_encrypted_api_keys_user_active ON public.encrypted_api_keys(user_id, is_active);

-- Enable RLS on encrypted_api_keys
ALTER TABLE public.encrypted_api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own API keys" ON public.encrypted_api_keys;
DROP POLICY IF EXISTS "Users can create own API keys" ON public.encrypted_api_keys;
DROP POLICY IF EXISTS "Users can update own API keys" ON public.encrypted_api_keys;
DROP POLICY IF EXISTS "Users can delete own API keys" ON public.encrypted_api_keys;

-- API keys policies (note: Prisma uses service role, so these are for direct Supabase access)
CREATE POLICY "Users can view own API keys" ON public.encrypted_api_keys
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own API keys" ON public.encrypted_api_keys
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own API keys" ON public.encrypted_api_keys
  FOR UPDATE
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own API keys" ON public.encrypted_api_keys
  FOR DELETE
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- Comments
COMMENT ON TABLE public.encrypted_api_keys IS 'Encrypted API keys for third-party services (Deepgram, OpenAI, etc.)';
COMMENT ON COLUMN public.encrypted_api_keys.encrypted_key IS 'AES-256-GCM encrypted API key (format: version:nonce:ciphertext)';

-- ============================================================================
-- SESSIONS AND TRANSCRIPTION TABLES
-- ============================================================================

-- Create sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,
  matter_id TEXT,
  status TEXT DEFAULT 'recording',
  title TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  audio_url TEXT,
  transcript TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create transcription_segments table
CREATE TABLE IF NOT EXISTS public.transcription_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  speaker TEXT,
  confidence FLOAT,
  start_time INTEGER,
  end_time INTEGER,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_matter_id ON public.sessions(matter_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_segments_session_id ON public.transcription_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_segments_created_at ON public.transcription_segments(created_at);

-- Create storage bucket for audio recordings (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS (Row Level Security) policies
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_segments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.sessions;

-- Sessions: Users can only access their own sessions
CREATE POLICY "Users can view their own sessions"
  ON public.sessions
  FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

CREATE POLICY "Users can insert their own sessions"
  ON public.sessions
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

CREATE POLICY "Users can update their own sessions"
  ON public.sessions
  FOR UPDATE
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

CREATE POLICY "Users can delete their own sessions"
  ON public.sessions
  FOR DELETE
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

-- Drop existing segment policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view segments from their sessions" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can insert segments to their sessions" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can update segments from their sessions" ON public.transcription_segments;
DROP POLICY IF EXISTS "Users can delete segments from their sessions" ON public.transcription_segments;

-- Transcription segments: Users can access segments from their sessions
CREATE POLICY "Users can view segments from their sessions"
  ON public.transcription_segments
  FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transcription_segments.session_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert segments to their sessions"
  ON public.transcription_segments
  FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transcription_segments.session_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update segments from their sessions"
  ON public.transcription_segments
  FOR UPDATE
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transcription_segments.session_id
        AND s.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transcription_segments.session_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete segments from their sessions"
  ON public.transcription_segments
  FOR DELETE
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transcription_segments.session_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- Drop existing storage policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio files" ON storage.objects;

-- Storage policies for audio recordings
CREATE POLICY "Users can upload their own audio files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-recordings'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read their own audio files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'audio-recordings'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own audio files"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'audio-recordings'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'audio-recordings'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own audio files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'audio-recordings'
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
DROP TRIGGER IF EXISTS update_sessions_updated_at ON public.sessions;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_segments_updated_at ON public.transcription_segments;
CREATE TRIGGER update_segments_updated_at
  BEFORE UPDATE ON public.transcription_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUDIT LOGS TABLE
-- ============================================================================

-- Create audit_logs table for comprehensive audit logging
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  location TEXT,
  retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON public.audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention_until ON public.audit_logs(retention_until);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing audit log policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Prevent direct inserts" ON public.audit_logs;
DROP POLICY IF EXISTS "Prevent updates" ON public.audit_logs;
DROP POLICY IF EXISTS "Prevent deletes" ON public.audit_logs;

-- Policy: Users can only view their own audit logs
CREATE POLICY "Users can view their own audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = user_id
  );

-- Policy: Prevent users from inserting audit logs directly (only through API)
CREATE POLICY "Prevent direct inserts"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (false);

-- Policy: Prevent users from updating audit logs
CREATE POLICY "Prevent updates"
  ON public.audit_logs
  FOR UPDATE
  USING (false);

-- Policy: Prevent users from deleting audit logs
CREATE POLICY "Prevent deletes"
  ON public.audit_logs
  FOR DELETE
  USING (false);

-- Add comments for documentation
COMMENT ON TABLE public.audit_logs IS 'Audit log of all user actions for compliance and security';
COMMENT ON COLUMN public.audit_logs.user_id IS 'User who performed the action';
COMMENT ON COLUMN public.audit_logs.action IS 'Type of action performed (from AuditAction enum)';
COMMENT ON COLUMN public.audit_logs.resource IS 'Type of resource affected (from AuditResource enum)';
COMMENT ON COLUMN public.audit_logs.resource_id IS 'ID of the specific resource affected';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional context about the action';
COMMENT ON COLUMN public.audit_logs.ip_address IS 'IP address of the user';
COMMENT ON COLUMN public.audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN public.audit_logs.location IS 'Geographic location (country code)';
COMMENT ON COLUMN public.audit_logs.retention_until IS 'Date until which this log must be retained (legal hold)';
COMMENT ON COLUMN public.audit_logs.created_at IS 'Timestamp when the action was performed';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Go to: https://supabase.com/dashboard/project/nmllrewdfkpuhchkeogh/sql
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute the migration
-- 4. Verify the tables were created in the Table Editor
-- ============================================================================
