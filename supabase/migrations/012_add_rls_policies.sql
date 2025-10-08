-- ============================================================================
-- MIGRATION 012: ADD RLS POLICIES
-- ============================================================================
-- Description: Enables RLS and creates policies for new tables
-- Safe to run: Uses DROP POLICY IF EXISTS before CREATE
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billable_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SUBSCRIPTION PLANS (public read)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- INVOICES (user-specific)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- USAGE METRICS (user-specific)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own usage metrics" ON public.usage_metrics;
CREATE POLICY "Users can view own usage metrics"
  ON public.usage_metrics FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRANSCRIPT ACCESS LOGS (via session ownership)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view access logs for own sessions" ON public.transcript_access_logs;
CREATE POLICY "Users can view access logs for own sessions"
  ON public.transcript_access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = transcript_access_logs.session_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- CHAT MESSAGES (via session ownership)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view chat messages for own sessions" ON public.chat_messages;
CREATE POLICY "Users can view chat messages for own sessions"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create chat messages for own sessions" ON public.chat_messages;
CREATE POLICY "Users can create chat messages for own sessions"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- CITATIONS (via session ownership or standalone)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view citations for own sessions" ON public.citations;
CREATE POLICY "Users can view citations for own sessions"
  ON public.citations FOR SELECT
  USING (
    session_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = citations.session_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================================================
-- EXPORT JOBS (user-specific)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own export jobs" ON public.export_jobs;
CREATE POLICY "Users can view own export jobs"
  ON public.export_jobs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own export jobs" ON public.export_jobs;
CREATE POLICY "Users can create own export jobs"
  ON public.export_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- DOCUMENT TEMPLATES (user-specific or public)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own or public templates" ON public.document_templates;
CREATE POLICY "Users can view own or public templates"
  ON public.document_templates FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

DROP POLICY IF EXISTS "Users can create own templates" ON public.document_templates;
CREATE POLICY "Users can create own templates"
  ON public.document_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own templates" ON public.document_templates;
CREATE POLICY "Users can update own templates"
  ON public.document_templates FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- GENERATED DOCUMENTS (user-specific)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own generated documents" ON public.generated_documents;
CREATE POLICY "Users can view own generated documents"
  ON public.generated_documents FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own generated documents" ON public.generated_documents;
CREATE POLICY "Users can create own generated documents"
  ON public.generated_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- BILLABLE TIME (user-specific)
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own billable time" ON public.billable_time;
CREATE POLICY "Users can view own billable time"
  ON public.billable_time FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own billable time" ON public.billable_time;
CREATE POLICY "Users can create own billable time"
  ON public.billable_time FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own billable time" ON public.billable_time;
CREATE POLICY "Users can update own billable time"
  ON public.billable_time FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FEATURE FLAGS (public read)
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view feature flags" ON public.feature_flags;
CREATE POLICY "Anyone can view feature flags"
  ON public.feature_flags FOR SELECT
  USING (true);

-- ============================================================================
-- SYSTEM LOGS (service role only)
-- ============================================================================

DROP POLICY IF EXISTS "Service role can manage system logs" ON public.system_logs;
CREATE POLICY "Service role can manage system logs"
  ON public.system_logs FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- SUCCESS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 012 completed: RLS policies created successfully';
END $$;
