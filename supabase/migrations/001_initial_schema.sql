-- ============================================================================
-- Law Transcribed Database Schema - Initial Migration
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Sessions table for dictation sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matter_id TEXT,
  title TEXT NOT NULL,
  transcript TEXT,
  audio_url TEXT,
  duration_ms INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('recording', 'paused', 'stopped', 'completed', 'error')) DEFAULT 'recording',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transcription segments table
CREATE TABLE IF NOT EXISTS public.transcription_segments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  speaker INTEGER,
  confidence DECIMAL(5,4),
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Segment edit history
CREATE TABLE IF NOT EXISTS public.segment_edit_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  segment_id TEXT NOT NULL REFERENCES public.transcription_segments(id) ON DELETE CASCADE,
  edited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_text TEXT NOT NULL,
  new_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matters table
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

-- Add foreign key for sessions -> matters (after matters table exists)
ALTER TABLE public.sessions
  ADD CONSTRAINT fk_sessions_matter
  FOREIGN KEY (matter_id)
  REFERENCES public.matters(id)
  ON DELETE SET NULL;

-- Encrypted API keys table
CREATE TABLE IF NOT EXISTS public.encrypted_api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- User profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_matter ON public.sessions(matter_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON public.sessions(created_at DESC);

-- Segments indexes
CREATE INDEX IF NOT EXISTS idx_segments_session ON public.transcription_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_segments_speaker ON public.transcription_segments(speaker);
CREATE INDEX IF NOT EXISTS idx_segments_time ON public.transcription_segments(start_time);
CREATE INDEX IF NOT EXISTS idx_segments_final ON public.transcription_segments(is_final);

-- Edit history indexes
CREATE INDEX IF NOT EXISTS idx_history_segment ON public.segment_edit_history(segment_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON public.segment_edit_history(edited_by);
CREATE INDEX IF NOT EXISTS idx_history_created ON public.segment_edit_history(created_at DESC);

-- Matters indexes
CREATE INDEX IF NOT EXISTS idx_matters_user ON public.matters(user_id);
CREATE INDEX IF NOT EXISTS idx_matters_status ON public.matters(status);
CREATE INDEX IF NOT EXISTS idx_matters_client ON public.matters(client_name);

-- API keys indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.encrypted_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON public.encrypted_api_keys(provider);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.encrypted_api_keys(is_active);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segment_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can view own sessions" ON public.sessions
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own sessions" ON public.sessions
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own sessions" ON public.sessions
  FOR UPDATE
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own sessions" ON public.sessions
  FOR DELETE
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- Segments policies
CREATE POLICY "Users can view own segments" ON public.transcription_segments
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = transcription_segments.session_id AND s.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can create own segments" ON public.transcription_segments
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = transcription_segments.session_id AND s.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can update own segments" ON public.transcription_segments
  FOR UPDATE
  USING ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = transcription_segments.session_id AND s.user_id = (SELECT auth.uid())
  ))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = transcription_segments.session_id AND s.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can delete own segments" ON public.transcription_segments
  FOR DELETE
  USING ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = transcription_segments.session_id AND s.user_id = (SELECT auth.uid())
  ));

-- Edit history policies
CREATE POLICY "Users can view edit history for own segments" ON public.segment_edit_history
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.transcription_segments ts
    JOIN public.sessions s ON s.id = ts.session_id
    WHERE ts.id = segment_edit_history.segment_id AND s.user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Users can create edit history" ON public.segment_edit_history
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = edited_by);

-- Matters policies
CREATE POLICY "Users can view own matters" ON public.matters
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create own matters" ON public.matters
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own matters" ON public.matters
  FOR UPDATE
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own matters" ON public.matters
  FOR DELETE
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- API keys policies
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

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = id);

-- ============================================================================
-- 4. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update triggers
CREATE TRIGGER sessions_updated_at BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER segments_updated_at BEFORE UPDATE ON public.transcription_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER matters_updated_at BEFORE UPDATE ON public.matters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER api_keys_updated_at BEFORE UPDATE ON public.encrypted_api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 5. STORAGE
-- ============================================================================

-- Create audio recordings bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-recordings', 'audio-recordings', false) ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload own recordings" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own recordings" ON storage.objects FOR SELECT
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own recordings" ON storage.objects FOR UPDATE
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own recordings" ON storage.objects FOR DELETE
  USING (bucket_id = 'audio-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
