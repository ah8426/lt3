-- ============================================================================
-- SUPABASE MIGRATION FOR LAW TRANSCRIBED
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ============================================================================

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS transcription_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  speaker TEXT,
  confidence FLOAT,
  start_time INTEGER,
  end_time INTEGER,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_matter_id ON sessions(matter_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_segments_session_id ON transcription_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_segments_created_at ON transcription_segments(created_at);

-- Create storage bucket for audio recordings (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-recordings', 'audio-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS (Row Level Security) policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcription_segments ENABLE ROW LEVEL SECURITY;

-- Sessions: Users can only access their own sessions
CREATE POLICY "Users can view their own sessions"
  ON sessions FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON sessions FOR DELETE
  USING (auth.uid()::text = user_id);

-- Transcription segments: Users can access segments from their sessions
CREATE POLICY "Users can view segments from their sessions"
  ON transcription_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = transcription_segments.session_id
      AND sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert segments to their sessions"
  ON transcription_segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = transcription_segments.session_id
      AND sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update segments from their sessions"
  ON transcription_segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = transcription_segments.session_id
      AND sessions.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete segments from their sessions"
  ON transcription_segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = transcription_segments.session_id
      AND sessions.user_id = auth.uid()::text
    )
  );

-- Storage policies for audio recordings
CREATE POLICY "Users can upload their own audio files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'audio-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read their own audio files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'audio-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own audio files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'audio-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own audio files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'audio-recordings' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on sessions
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Go to: https://supabase.com/dashboard/project/nmllrewdfkpuhchkeogh/sql
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute the migration
-- 4. Verify the tables were created in the Table Editor
-- ============================================================================
