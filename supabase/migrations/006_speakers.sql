-- ============================================================================
-- MIGRATION 006: SPEAKER DIARIZATION
-- ============================================================================
-- Description: Add speaker diarization and identification support
-- Features: Speaker management, statistics, voiceprints
-- Created: 2025-10-08

-- Create speakers table
CREATE TABLE IF NOT EXISTS public.speakers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  -- Speaker identification
  speaker_number INTEGER NOT NULL,
  name TEXT,
  role TEXT,
  organization TEXT,
  color TEXT,

  -- Voiceprint for future matching
  voiceprint JSONB,

  -- Statistics
  first_spoke TIMESTAMPTZ NOT NULL,
  last_spoke TIMESTAMPTZ NOT NULL,
  total_duration_ms INTEGER NOT NULL DEFAULT 0,
  segment_count INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  avg_confidence DECIMAL(5,4),

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT speakers_session_number_unique UNIQUE(session_id, speaker_number)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_speakers_session_id ON public.speakers(session_id);
CREATE INDEX IF NOT EXISTS idx_speakers_speaker_number ON public.speakers(speaker_number);
CREATE INDEX IF NOT EXISTS idx_speakers_created_at ON public.speakers(created_at DESC);

-- Add speaker reference to transcript_segments
ALTER TABLE public.transcript_segments
  ADD COLUMN IF NOT EXISTS speaker_id TEXT REFERENCES public.speakers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transcript_segments_speaker_id
  ON public.transcript_segments(speaker_id) WHERE speaker_id IS NOT NULL;

-- Update transcript_segments to include speaker_number for backward compatibility
ALTER TABLE public.transcript_segments
  ADD COLUMN IF NOT EXISTS speaker_number INTEGER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on speakers table
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view speakers for their sessions
CREATE POLICY "Users can view speakers for their sessions"
  ON public.speakers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = speakers.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Policy: Users can insert speakers for their sessions
CREATE POLICY "Users can insert speakers for their sessions"
  ON public.speakers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = speakers.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Policy: Users can update speakers for their sessions
CREATE POLICY "Users can update speakers for their sessions"
  ON public.speakers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = speakers.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Policy: Users can delete speakers for their sessions
CREATE POLICY "Users can delete speakers for their sessions"
  ON public.speakers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = speakers.session_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update speaker statistics
CREATE OR REPLACE FUNCTION update_speaker_stats(p_speaker_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.speakers
  SET
    segment_count = (
      SELECT COUNT(*)
      FROM public.transcript_segments
      WHERE speaker_id = p_speaker_id
    ),
    word_count = (
      SELECT COALESCE(SUM(LENGTH(text) - LENGTH(REPLACE(text, ' ', '')) + 1), 0)
      FROM public.transcript_segments
      WHERE speaker_id = p_speaker_id
    ),
    total_duration_ms = (
      SELECT COALESCE(SUM(end_ms - start_ms), 0)
      FROM public.transcript_segments
      WHERE speaker_id = p_speaker_id
    ),
    first_spoke = (
      SELECT MIN(created_at)
      FROM public.transcript_segments
      WHERE speaker_id = p_speaker_id
    ),
    last_spoke = (
      SELECT MAX(created_at)
      FROM public.transcript_segments
      WHERE speaker_id = p_speaker_id
    ),
    avg_confidence = (
      SELECT AVG(confidence)
      FROM public.transcript_segments
      WHERE speaker_id = p_speaker_id
      AND confidence IS NOT NULL
    ),
    updated_at = now()
  WHERE id = p_speaker_id;
END;
$$;

-- Function to merge speakers
CREATE OR REPLACE FUNCTION merge_speakers(
  p_source_speaker_id TEXT,
  p_target_speaker_id TEXT,
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id TEXT;
BEGIN
  -- Verify both speakers belong to same session and user owns it
  SELECT s.session_id INTO v_session_id
  FROM public.speakers s
  INNER JOIN public.sessions sess ON s.session_id = sess.id
  WHERE s.id = p_source_speaker_id
  AND sess.user_id = p_user_id;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Source speaker not found or access denied';
  END IF;

  -- Verify target speaker is in same session
  IF NOT EXISTS (
    SELECT 1 FROM public.speakers
    WHERE id = p_target_speaker_id
    AND session_id = v_session_id
  ) THEN
    RAISE EXCEPTION 'Target speaker not in same session';
  END IF;

  -- Move all segments from source to target
  UPDATE public.transcript_segments
  SET speaker_id = p_target_speaker_id
  WHERE speaker_id = p_source_speaker_id;

  -- Update target speaker stats
  PERFORM update_speaker_stats(p_target_speaker_id);

  -- Delete source speaker
  DELETE FROM public.speakers WHERE id = p_source_speaker_id;

  -- Log the merge action
  INSERT INTO public.audit_logs (
    user_id, action, resource, resource_id, metadata
  ) VALUES (
    p_user_id,
    'speaker_merge',
    'speaker',
    p_target_speaker_id,
    jsonb_build_object(
      'source_speaker_id', p_source_speaker_id,
      'target_speaker_id', p_target_speaker_id,
      'session_id', v_session_id
    )
  );
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update speaker stats when segments change
CREATE OR REPLACE FUNCTION trigger_update_speaker_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.speaker_id IS NOT NULL THEN
      PERFORM update_speaker_stats(NEW.speaker_id);
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.speaker_id IS NOT NULL AND OLD.speaker_id != NEW.speaker_id THEN
      PERFORM update_speaker_stats(OLD.speaker_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.speaker_id IS NOT NULL THEN
      PERFORM update_speaker_stats(OLD.speaker_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_speaker_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transcript_segments
FOR EACH ROW
WHEN (NEW.speaker_id IS NOT NULL OR OLD.speaker_id IS NOT NULL)
EXECUTE FUNCTION trigger_update_speaker_stats();

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_speakers_updated_at
BEFORE UPDATE ON public.speakers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
