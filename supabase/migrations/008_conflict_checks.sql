-- Migration: Conflict of Interest Checking System
-- Description: Creates table and functions for comprehensive conflict detection
-- Created: 2025-10-08

-- ============================================================================
-- CREATE TABLE: conflict_checks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conflict_checks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Check Parameters
  client_name TEXT,
  adverse_parties TEXT[] DEFAULT '{}',
  company_names TEXT[] DEFAULT '{}',
  matter_description TEXT,
  exclude_matter_id TEXT,

  -- Results
  conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level TEXT NOT NULL,
  total_matches INTEGER NOT NULL DEFAULT 0,
  high_risk_count INTEGER NOT NULL DEFAULT 0,
  medium_risk_count INTEGER NOT NULL DEFAULT 0,
  low_risk_count INTEGER NOT NULL DEFAULT 0,
  recommendation TEXT NOT NULL,
  summary TEXT NOT NULL,

  -- Resolution
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT conflict_checks_risk_level_valid CHECK (
    risk_level IN ('none', 'low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT conflict_checks_recommendation_valid CHECK (
    recommendation IN ('proceed', 'review', 'decline')
  ),
  CONSTRAINT conflict_checks_status_valid CHECK (
    status IN ('pending', 'waived', 'declined', 'screened', 'cleared')
  )
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_conflict_checks_user_created
  ON public.conflict_checks(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conflict_checks_status_risk
  ON public.conflict_checks(status, risk_level);

CREATE INDEX IF NOT EXISTS idx_conflict_checks_client_name
  ON public.conflict_checks(client_name);

CREATE INDEX IF NOT EXISTS idx_conflict_checks_risk_level
  ON public.conflict_checks(risk_level)
  WHERE risk_level IN ('high', 'critical');

-- GIN index for JSONB conflicts array
CREATE INDEX IF NOT EXISTS idx_conflict_checks_conflicts_gin
  ON public.conflict_checks USING gin(conflicts);

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_conflict_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_conflict_checks_updated_at ON public.conflict_checks;
CREATE TRIGGER trigger_conflict_checks_updated_at
  BEFORE UPDATE ON public.conflict_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_conflict_checks_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get conflict check statistics for a user
CREATE OR REPLACE FUNCTION get_conflict_check_stats(p_user_id UUID)
RETURNS TABLE(
  total_checks BIGINT,
  pending_checks BIGINT,
  critical_conflicts BIGINT,
  high_conflicts BIGINT,
  cleared_checks BIGINT,
  declined_matters BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_checks,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_checks,
    COUNT(*) FILTER (WHERE risk_level = 'critical')::BIGINT as critical_conflicts,
    COUNT(*) FILTER (WHERE risk_level = 'high')::BIGINT as high_conflicts,
    COUNT(*) FILTER (WHERE status = 'cleared')::BIGINT as cleared_checks,
    COUNT(*) FILTER (WHERE status = 'declined')::BIGINT as declined_matters
  FROM public.conflict_checks
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search conflict checks by client or party name
CREATE OR REPLACE FUNCTION search_conflict_checks(
  p_user_id UUID,
  p_search_term TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  id TEXT,
  client_name TEXT,
  adverse_parties TEXT[],
  risk_level TEXT,
  status TEXT,
  total_matches INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.client_name,
    cc.adverse_parties,
    cc.risk_level,
    cc.status,
    cc.total_matches,
    cc.created_at
  FROM public.conflict_checks cc
  WHERE cc.user_id = p_user_id
    AND (
      cc.client_name ILIKE '%' || p_search_term || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(cc.adverse_parties) ap
        WHERE ap ILIKE '%' || p_search_term || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(cc.company_names) cn
        WHERE cn ILIKE '%' || p_search_term || '%'
      )
    )
  ORDER BY cc.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent high-risk conflicts
CREATE OR REPLACE FUNCTION get_recent_high_risk_conflicts(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id TEXT,
  client_name TEXT,
  adverse_parties TEXT[],
  risk_level TEXT,
  status TEXT,
  total_matches INTEGER,
  high_risk_count INTEGER,
  recommendation TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.client_name,
    cc.adverse_parties,
    cc.risk_level,
    cc.status,
    cc.total_matches,
    cc.high_risk_count,
    cc.recommendation
    cc.created_at
  FROM public.conflict_checks cc
  WHERE cc.user_id = p_user_id
    AND cc.risk_level IN ('high', 'critical')
    AND cc.created_at >= now() - (p_days || ' days')::interval
  ORDER BY
    CASE cc.risk_level
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      ELSE 3
    END,
    cc.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for existing conflicts with a client name
CREATE OR REPLACE FUNCTION check_existing_client_conflicts(
  p_user_id UUID,
  p_client_name TEXT,
  p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
  conflict_check_id TEXT,
  existing_client_name TEXT,
  risk_level TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id as conflict_check_id,
    cc.client_name as existing_client_name,
    cc.risk_level,
    cc.status,
    cc.created_at
  FROM public.conflict_checks cc
  WHERE cc.user_id = p_user_id
    AND cc.client_name IS NOT NULL
    AND (
      -- Exact match
      LOWER(cc.client_name) = LOWER(p_client_name)
      -- Fuzzy match using similarity
      OR similarity(LOWER(cc.client_name), LOWER(p_client_name)) >= p_similarity_threshold
    )
  ORDER BY cc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.conflict_checks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own conflict checks
DROP POLICY IF EXISTS "Users can view own conflict checks" ON public.conflict_checks;
CREATE POLICY "Users can view own conflict checks"
  ON public.conflict_checks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own conflict checks
DROP POLICY IF EXISTS "Users can create conflict checks" ON public.conflict_checks;
CREATE POLICY "Users can create conflict checks"
  ON public.conflict_checks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own conflict checks
DROP POLICY IF EXISTS "Users can update own conflict checks" ON public.conflict_checks;
CREATE POLICY "Users can update own conflict checks"
  ON public.conflict_checks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own conflict checks
DROP POLICY IF EXISTS "Users can delete own conflict checks" ON public.conflict_checks;
CREATE POLICY "Users can delete own conflict checks"
  ON public.conflict_checks
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conflict_checks TO authenticated;
GRANT EXECUTE ON FUNCTION get_conflict_check_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_conflict_checks(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_high_risk_conflicts(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_existing_client_conflicts(UUID, TEXT, FLOAT) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.conflict_checks IS
  'Stores conflict of interest check results with comprehensive matching data';

COMMENT ON COLUMN public.conflict_checks.conflicts IS
  'JSONB array of ConflictMatch objects with detailed similarity scores';

COMMENT ON COLUMN public.conflict_checks.risk_level IS
  'Overall risk assessment: none, low, medium, high, critical';

COMMENT ON COLUMN public.conflict_checks.recommendation IS
  'Automated recommendation: proceed, review, decline';

COMMENT ON FUNCTION get_conflict_check_stats(UUID) IS
  'Returns aggregate statistics for a user''s conflict checks';

COMMENT ON FUNCTION search_conflict_checks(UUID, TEXT, INTEGER) IS
  'Searches conflict checks by client name, adverse parties, or company names';

COMMENT ON FUNCTION get_recent_high_risk_conflicts(UUID, INTEGER, INTEGER) IS
  'Returns recent high-risk or critical conflicts for review';

COMMENT ON FUNCTION check_existing_client_conflicts(UUID, TEXT, FLOAT) IS
  'Checks if a client name matches any existing conflict checks using fuzzy matching';
