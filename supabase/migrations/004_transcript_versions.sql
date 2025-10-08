-- Create transcript_versions table for version control system
-- Enables Git-like version control for transcript edits with rollback capability

CREATE TABLE IF NOT EXISTS public.transcript_versions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  version INTEGER NOT NULL,

  -- Snapshot data
  segments JSONB NOT NULL,

  -- Change metadata
  change_type TEXT NOT NULL,
  changed_by UUID NOT NULL,
  change_reason TEXT,

  -- Diff summary
  diff_summary JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT fk_session
    FOREIGN KEY (session_id)
    REFERENCES public.sessions(id)
    ON DELETE CASCADE,

  -- Ensure unique version per session
  UNIQUE(session_id, version)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transcript_versions_session_created
  ON public.transcript_versions(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcript_versions_changed_by_created
  ON public.transcript_versions(changed_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcript_versions_session_version
  ON public.transcript_versions(session_id, version);

-- Enable Row Level Security
ALTER TABLE public.transcript_versions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own session versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent direct inserts to transcript versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent updates to transcript versions" ON public.transcript_versions;
DROP POLICY IF EXISTS "Prevent deletes of transcript versions" ON public.transcript_versions;

-- Policy: Users can view versions for their own sessions
CREATE POLICY "Users can view their own session versions"
  ON public.transcript_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = transcript_versions.session_id
      AND sessions.user_id = (SELECT auth.uid())
    )
  );

-- Policy: Prevent direct inserts (only through API)
CREATE POLICY "Prevent direct inserts to transcript versions"
  ON public.transcript_versions
  FOR INSERT
  WITH CHECK (false);

-- Policy: Prevent updates (versions are immutable)
CREATE POLICY "Prevent updates to transcript versions"
  ON public.transcript_versions
  FOR UPDATE
  USING (false);

-- Policy: Prevent deletes (versions are permanent)
CREATE POLICY "Prevent deletes of transcript versions"
  ON public.transcript_versions
  FOR DELETE
  USING (false);

-- Add helpful comments
COMMENT ON TABLE public.transcript_versions IS 'Version control history for transcript edits';
COMMENT ON COLUMN public.transcript_versions.session_id IS 'Reference to the session this version belongs to';
COMMENT ON COLUMN public.transcript_versions.version IS 'Sequential version number starting from 1';
COMMENT ON COLUMN public.transcript_versions.segments IS 'Complete snapshot of all transcript segments at this version';
COMMENT ON COLUMN public.transcript_versions.change_type IS 'Type of change: manual_save, auto_save, segment_edit, segment_add, segment_delete, restore, pre_export, pre_share';
COMMENT ON COLUMN public.transcript_versions.changed_by IS 'User ID who created this version';
COMMENT ON COLUMN public.transcript_versions.change_reason IS 'Optional user-provided reason for the change';
COMMENT ON COLUMN public.transcript_versions.diff_summary IS 'Summary of changes (added, removed, modified counts)';
