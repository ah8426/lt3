-- AI Usage Tracking Table
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost DECIMAL(10, 6) NOT NULL DEFAULT 0,
  purpose TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON public.ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON public.ai_usage(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON public.ai_usage(model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON public.ai_usage(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own usage
CREATE POLICY ai_usage_select_own ON public.ai_usage
  FOR SELECT
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- Policy: System can insert usage records (handled by server-side code)
CREATE POLICY ai_usage_insert_system ON public.ai_usage
  FOR INSERT
  WITH CHECK (true);

-- Function to get usage stats for a user
CREATE OR REPLACE FUNCTION get_ai_usage_stats(
  p_user_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_provider TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_cost DECIMAL,
  total_tokens BIGINT,
  total_prompt_tokens BIGINT,
  total_completion_tokens BIGINT,
  request_count BIGINT,
  avg_cost_per_request DECIMAL,
  avg_tokens_per_request DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(cost), 0)::DECIMAL as total_cost,
    COALESCE(SUM(total_tokens), 0)::BIGINT as total_tokens,
    COALESCE(SUM(prompt_tokens), 0)::BIGINT as total_prompt_tokens,
    COALESCE(SUM(completion_tokens), 0)::BIGINT as total_completion_tokens,
    COUNT(*)::BIGINT as request_count,
    COALESCE(AVG(cost), 0)::DECIMAL as avg_cost_per_request,
    COALESCE(AVG(total_tokens), 0)::DECIMAL as avg_tokens_per_request
  FROM ai_usage
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
    AND (p_provider IS NULL OR provider = p_provider);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get usage by provider
CREATE OR REPLACE FUNCTION get_ai_usage_by_provider(
  p_user_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  provider TEXT,
  total_cost DECIMAL,
  total_tokens BIGINT,
  request_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_usage.provider,
    COALESCE(SUM(cost), 0)::DECIMAL as total_cost,
    COALESCE(SUM(total_tokens), 0)::BIGINT as total_tokens,
    COUNT(*)::BIGINT as request_count
  FROM ai_usage
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
  GROUP BY ai_usage.provider
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get usage by model
CREATE OR REPLACE FUNCTION get_ai_usage_by_model(
  p_user_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  model TEXT,
  provider TEXT,
  total_cost DECIMAL,
  total_tokens BIGINT,
  request_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_usage.model,
    ai_usage.provider,
    COALESCE(SUM(cost), 0)::DECIMAL as total_cost,
    COALESCE(SUM(total_tokens), 0)::BIGINT as total_tokens,
    COUNT(*)::BIGINT as request_count
  FROM ai_usage
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR created_at >= p_start_date)
    AND (p_end_date IS NULL OR created_at <= p_end_date)
  GROUP BY ai_usage.model, ai_usage.provider
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on table
COMMENT ON TABLE public.ai_usage IS 'Tracks AI API usage and costs for billing and analytics';
COMMENT ON COLUMN public.ai_usage.provider IS 'AI provider name (anthropic, openai, google, openrouter)';
COMMENT ON COLUMN public.ai_usage.model IS 'Model identifier used for the request';
COMMENT ON COLUMN public.ai_usage.cost IS 'Cost in USD for the request';
COMMENT ON COLUMN public.ai_usage.purpose IS 'Optional purpose/category for the request';
COMMENT ON COLUMN public.ai_usage.metadata IS 'Additional metadata about the request';
