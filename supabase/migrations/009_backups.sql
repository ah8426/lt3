-- Migration: Backup and Disaster Recovery System
-- Description: Creates table and functions for automated backup management
-- Created: 2025-10-08

-- ============================================================================
-- CREATE TABLE: backups
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Backup metadata
  type TEXT NOT NULL,
  scope TEXT NOT NULL,
  scope_id TEXT,

  -- File information
  size INTEGER NOT NULL,
  checksum TEXT NOT NULL,

  -- Encryption and content
  encrypted_with TEXT,
  includes_audio BOOLEAN NOT NULL DEFAULT false,
  includes_documents BOOLEAN NOT NULL DEFAULT true,

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_restored_at TIMESTAMPTZ,
  restore_count INTEGER NOT NULL DEFAULT 0,

  -- Constraints
  CONSTRAINT backups_type_valid CHECK (type IN ('full', 'matter', 'session')),
  CONSTRAINT backups_status_valid CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'))
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_backups_user_created
  ON public.backups(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backups_status_created
  ON public.backups(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_backups_type
  ON public.backups(type);

CREATE INDEX IF NOT EXISTS idx_backups_scope_id
  ON public.backups(scope_id)
  WHERE scope_id IS NOT NULL;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get backup statistics for a user
CREATE OR REPLACE FUNCTION get_backup_stats(p_user_id UUID)
RETURNS TABLE(
  total_backups BIGINT,
  completed_backups BIGINT,
  total_size BIGINT,
  last_backup_at TIMESTAMPTZ,
  encrypted_count BIGINT,
  with_audio_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_backups,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT as completed_backups,
    COALESCE(SUM(size) FILTER (WHERE status = 'completed'), 0)::BIGINT as total_size,
    MAX(created_at) FILTER (WHERE status = 'completed') as last_backup_at,
    COUNT(*) FILTER (WHERE encrypted_with IS NOT NULL)::BIGINT as encrypted_count,
    COUNT(*) FILTER (WHERE includes_audio = true)::BIGINT as with_audio_count
  FROM public.backups
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old backups based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_backups(
  p_user_id UUID,
  p_retention_days INTEGER DEFAULT 30,
  p_max_backups INTEGER DEFAULT 10
)
RETURNS TABLE(
  deleted_count INTEGER,
  freed_space BIGINT
) AS $$
DECLARE
  v_deleted_count INTEGER := 0;
  v_freed_space BIGINT := 0;
  v_cutoff_date TIMESTAMPTZ;
  v_backup RECORD;
BEGIN
  -- Calculate cutoff date
  v_cutoff_date := now() - (p_retention_days || ' days')::interval;

  -- Delete backups older than retention period
  FOR v_backup IN
    SELECT id, size
    FROM public.backups
    WHERE user_id = p_user_id
      AND created_at < v_cutoff_date
      AND status = 'completed'
  LOOP
    DELETE FROM public.backups WHERE id = v_backup.id;
    v_deleted_count := v_deleted_count + 1;
    v_freed_space := v_freed_space + v_backup.size;
  END LOOP;

  -- If still over max backups, delete oldest
  FOR v_backup IN
    SELECT id, size
    FROM public.backups
    WHERE user_id = p_user_id
      AND status = 'completed'
    ORDER BY created_at DESC
    OFFSET p_max_backups
  LOOP
    DELETE FROM public.backups WHERE id = v_backup.id;
    v_deleted_count := v_deleted_count + 1;
    v_freed_space := v_freed_space + v_backup.size;
  END LOOP;

  RETURN QUERY SELECT v_deleted_count, v_freed_space;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record backup restore
CREATE OR REPLACE FUNCTION record_backup_restore(p_backup_id TEXT)
RETURNS void AS $$
BEGIN
  UPDATE public.backups
  SET
    last_restored_at = now(),
    restore_count = restore_count + 1
  WHERE id = p_backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent backups for a user
CREATE OR REPLACE FUNCTION get_recent_backups(
  p_user_id UUID,
  p_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id TEXT,
  type TEXT,
  scope TEXT,
  size INTEGER,
  encrypted_with TEXT,
  includes_audio BOOLEAN,
  includes_documents BOOLEAN,
  status TEXT,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  restore_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.type,
    b.scope,
    b.size,
    b.encrypted_with,
    b.includes_audio,
    b.includes_documents,
    b.status,
    b.created_at,
    b.completed_at,
    b.restore_count
  FROM public.backups b
  WHERE b.user_id = p_user_id
    AND (p_type IS NULL OR b.type = p_type)
    AND b.status = 'completed'
  ORDER BY b.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own backups
DROP POLICY IF EXISTS "Users can view own backups" ON public.backups;
CREATE POLICY "Users can view own backups"
  ON public.backups
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own backups
DROP POLICY IF EXISTS "Users can create backups" ON public.backups;
CREATE POLICY "Users can create backups"
  ON public.backups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own backups
DROP POLICY IF EXISTS "Users can update own backups" ON public.backups;
CREATE POLICY "Users can update own backups"
  ON public.backups
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own backups
DROP POLICY IF EXISTS "Users can delete own backups" ON public.backups;
CREATE POLICY "Users can delete own backups"
  ON public.backups
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT EXECUTE ON FUNCTION get_backup_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_backups(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION record_backup_restore(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_backups(UUID, TEXT, INTEGER) TO authenticated;

-- ============================================================================
-- STORAGE BUCKET CONFIGURATION
-- ============================================================================

-- Create backups storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for backups bucket
DROP POLICY IF EXISTS "Users can upload their own backups" ON storage.objects;
CREATE POLICY "Users can upload their own backups"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'backups' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view their own backups" ON storage.objects;
CREATE POLICY "Users can view their own backups"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'backups' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own backups" ON storage.objects;
CREATE POLICY "Users can delete their own backups"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'backups' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.backups IS
  'Stores backup metadata for automated backup and disaster recovery system';

COMMENT ON COLUMN public.backups.type IS
  'Type of backup: full (entire account), matter (single matter), session (single session)';

COMMENT ON COLUMN public.backups.scope IS
  'Scope identifier matching the type';

COMMENT ON COLUMN public.backups.checksum IS
  'SHA-256 checksum of the backup file for integrity verification';

COMMENT ON COLUMN public.backups.encrypted_with IS
  'Encryption algorithm used (e.g., aes-256-gcm), NULL if not encrypted';

COMMENT ON FUNCTION get_backup_stats(UUID) IS
  'Returns aggregate statistics for a user''s backups';

COMMENT ON FUNCTION cleanup_old_backups(UUID, INTEGER, INTEGER) IS
  'Deletes old backups based on retention policy and maximum backup count';

COMMENT ON FUNCTION record_backup_restore(TEXT) IS
  'Records when a backup was restored, incrementing restore count';

COMMENT ON FUNCTION get_recent_backups(UUID, TEXT, INTEGER) IS
  'Returns recent completed backups for a user, optionally filtered by type';
