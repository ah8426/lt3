-- ============================================================================
-- MIGRATION 007: PII REDACTION SYSTEM
-- ============================================================================
-- Description: Add comprehensive PII detection and redaction with encryption
-- Features: Encrypted redactions, access control, audit logging
-- Created: 2025-10-08

-- Create redactions table
CREATE TABLE IF NOT EXISTS public.redactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  segment_id TEXT REFERENCES public.transcript_segments(id) ON DELETE CASCADE,

  -- Encrypted original text (using XChaCha20-Poly1305)
  encrypted_original TEXT NOT NULL,
  encryption_nonce TEXT NOT NULL,

  -- Redacted representation
  redacted_text TEXT NOT NULL,
  pii_type TEXT NOT NULL,

  -- Position in text
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,

  -- Metadata
  reason TEXT,
  legal_basis TEXT,

  -- Access control
  created_by TEXT NOT NULL,
  access_control JSONB DEFAULT '[]'::jsonb, -- Array of user IDs who can unredact

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT redactions_offset_valid CHECK (end_offset > start_offset),
  CONSTRAINT redactions_pii_type_valid CHECK (
    pii_type IN (
      'ssn', 'credit_card', 'bank_account', 'email', 'phone',
      'address', 'name', 'date_of_birth', 'driver_license',
      'passport', 'ip_address', 'custom'
    )
  )
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_redactions_session_id ON public.redactions(session_id);
CREATE INDEX IF NOT EXISTS idx_redactions_segment_id ON public.redactions(segment_id) WHERE segment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_redactions_pii_type ON public.redactions(pii_type);
CREATE INDEX IF NOT EXISTS idx_redactions_created_by ON public.redactions(created_by);
CREATE INDEX IF NOT EXISTS idx_redactions_created_at ON public.redactions(created_at DESC);

-- Composite index for filtering
CREATE INDEX IF NOT EXISTS idx_redactions_session_pii_type
  ON public.redactions(session_id, pii_type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on redactions table
ALTER TABLE public.redactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view redactions for their sessions
CREATE POLICY "Users can view redactions for their sessions"
  ON public.redactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = redactions.session_id
      AND s.user_id = auth.uid()
    )
  );

-- Policy: Users can create redactions for their sessions
CREATE POLICY "Users can create redactions for their sessions"
  ON public.redactions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = redactions.session_id
      AND s.user_id = auth.uid()
    )
    AND created_by = auth.uid()::text
  );

-- Policy: Users can update redactions they created
CREATE POLICY "Users can update their own redactions"
  ON public.redactions
  FOR UPDATE
  USING (created_by = auth.uid()::text);

-- Policy: Users can delete redactions they created
CREATE POLICY "Users can delete their own redactions"
  ON public.redactions
  FOR DELETE
  USING (created_by = auth.uid()::text);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user can unredact
CREATE OR REPLACE FUNCTION can_unredact(
  p_redaction_id TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_created_by TEXT;
  v_access_control JSONB;
BEGIN
  SELECT created_by, access_control
  INTO v_created_by, v_access_control
  FROM public.redactions
  WHERE id = p_redaction_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Creator can always unredact
  IF v_created_by = p_user_id::text THEN
    RETURN TRUE;
  END IF;

  -- Check access control list
  RETURN v_access_control ? p_user_id::text;
END;
$$;

-- Function to get redaction statistics
CREATE OR REPLACE FUNCTION get_redaction_stats(p_session_id TEXT)
RETURNS TABLE(
  total_count BIGINT,
  pii_type TEXT,
  type_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) OVER() as total_count,
    r.pii_type,
    COUNT(*) as type_count
  FROM public.redactions r
  WHERE r.session_id = p_session_id
  GROUP BY r.pii_type
  ORDER BY type_count DESC;
END;
$$;

-- Function to apply redactions to text
CREATE OR REPLACE FUNCTION apply_redactions_to_text(
  p_text TEXT,
  p_session_id TEXT,
  p_segment_id TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_redaction RECORD;
  v_result TEXT := p_text;
  v_offset_adjustment INTEGER := 0;
BEGIN
  -- Get redactions sorted by start offset (descending to preserve offsets)
  FOR v_redaction IN
    SELECT *
    FROM public.redactions
    WHERE session_id = p_session_id
    AND (p_segment_id IS NULL OR segment_id = p_segment_id)
    ORDER BY start_offset DESC
  LOOP
    -- Replace text with redacted version
    v_result :=
      SUBSTRING(v_result FROM 1 FOR v_redaction.start_offset) ||
      v_redaction.redacted_text ||
      SUBSTRING(v_result FROM v_redaction.end_offset + 1);
  END LOOP;

  RETURN v_result;
END;
$$;

-- Function to log unredaction access
CREATE OR REPLACE FUNCTION log_unredaction(
  p_redaction_id TEXT,
  p_user_id UUID,
  p_reason TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_id TEXT;
  v_pii_type TEXT;
BEGIN
  -- Get redaction details
  SELECT session_id, pii_type
  INTO v_session_id, v_pii_type
  FROM public.redactions
  WHERE id = p_redaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Redaction not found';
  END IF;

  -- Verify user has access
  IF NOT can_unredact(p_redaction_id, p_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permission to unredact';
  END IF;

  -- Log the unredaction
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource,
    resource_id,
    metadata
  ) VALUES (
    p_user_id,
    'redaction_unredact',
    'redaction',
    p_redaction_id,
    jsonb_build_object(
      'session_id', v_session_id,
      'pii_type', v_pii_type,
      'reason', p_reason,
      'timestamp', now()
    )
  );
END;
$$;

-- Function to delete expired redactions
CREATE OR REPLACE FUNCTION cleanup_expired_redactions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Note: Current implementation doesn't have expiry
  -- This is a placeholder for future functionality
  DELETE FROM public.redactions
  WHERE created_at < now() - INTERVAL '7 years' -- Legal retention period
  RETURNING COUNT(*) INTO v_deleted_count;

  RETURN COALESCE(v_deleted_count, 0);
END;
$$;

-- ============================================================================
-- AUDIT TRAIL INTEGRATION
-- ============================================================================

-- Add redaction-specific audit actions if not exists
DO $$
BEGIN
  -- These will be logged via application code, but we document them here
  -- Actions: redaction_create, redaction_update, redaction_delete, redaction_unredact, pii_detect
  NULL;
END $$;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for redaction summary by session
CREATE OR REPLACE VIEW redaction_summary AS
SELECT
  r.session_id,
  COUNT(*) as total_redactions,
  COUNT(DISTINCT r.pii_type) as unique_pii_types,
  MIN(r.created_at) as first_redaction_at,
  MAX(r.created_at) as last_redaction_at,
  jsonb_object_agg(
    r.pii_type,
    (SELECT COUNT(*) FROM public.redactions WHERE session_id = r.session_id AND pii_type = r.pii_type)
  ) as counts_by_type
FROM public.redactions r
GROUP BY r.session_id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.redactions IS 'PII redactions with encrypted original content';
COMMENT ON COLUMN public.redactions.encrypted_original IS 'Original text encrypted with XChaCha20-Poly1305';
COMMENT ON COLUMN public.redactions.encryption_nonce IS 'Nonce used for encryption (24 bytes for XChaCha20)';
COMMENT ON COLUMN public.redactions.redacted_text IS 'Text to display in place of original (e.g., [REDACTED: SSN])';
COMMENT ON COLUMN public.redactions.pii_type IS 'Type of PII detected/redacted';
COMMENT ON COLUMN public.redactions.access_control IS 'JSON array of user IDs who can unredact';
COMMENT ON COLUMN public.redactions.legal_basis IS 'Legal justification for redaction (HIPAA, GDPR, etc.)';

COMMENT ON FUNCTION can_unredact IS 'Check if user has permission to view original redacted content';
COMMENT ON FUNCTION get_redaction_stats IS 'Get redaction statistics for a session';
COMMENT ON FUNCTION apply_redactions_to_text IS 'Apply all redactions to text for display';
COMMENT ON FUNCTION log_unredaction IS 'Log unredaction access for audit trail';
