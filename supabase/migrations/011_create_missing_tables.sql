-- ============================================================================
-- MIGRATION 011: CREATE MISSING TABLES
-- ============================================================================
-- Description: Creates tables that exist in Prisma but not in database
-- Safe to run: Uses IF NOT EXISTS for all tables
-- ============================================================================

-- Table: subscription_plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  max_sessions INTEGER DEFAULT -1,
  max_storage_gb INTEGER DEFAULT -1,
  max_ai_requests INTEGER DEFAULT -1,
  max_matters INTEGER DEFAULT -1,
  max_users INTEGER DEFAULT 1,
  features JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_active_sort
  ON public.subscription_plans(is_active, sort_order);

-- Table: invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,
  stripe_invoice_id TEXT NOT NULL UNIQUE,
  amount_due INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  invoice_pdf TEXT,
  hosted_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_created ON public.invoices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- Table: usage_metrics
CREATE TABLE IF NOT EXISTS public.usage_metrics (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  sessions_count INTEGER DEFAULT 0,
  transcription_minutes DECIMAL(10, 2) DEFAULT 0,
  ai_requests_count INTEGER DEFAULT 0,
  storage_used_gb DECIMAL(10, 2) DEFAULT 0,
  transcription_cost DECIMAL(10, 2) DEFAULT 0,
  ai_cost DECIMAL(10, 2) DEFAULT 0,
  storage_cost DECIMAL(10, 2) DEFAULT 0,
  total_cost DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_metrics_user_id_period_start_key') THEN
    ALTER TABLE public.usage_metrics ADD CONSTRAINT usage_metrics_user_id_period_start_key UNIQUE(user_id, period_start);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usage_metrics_user_period ON public.usage_metrics(user_id, period_end DESC);

-- Table: transcript_access_logs
CREATE TABLE IF NOT EXISTS public.transcript_access_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  user_id UUID,
  access_type TEXT NOT NULL,
  access_method TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_logs_session ON public.transcript_access_logs(session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON public.transcript_access_logs(user_id, timestamp DESC);

-- Table: chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  tokens INTEGER,
  cost DECIMAL(10, 6),
  context_used JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at DESC);

-- Table: citations
CREATE TABLE IF NOT EXISTS public.citations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  chat_message_id TEXT,
  session_id TEXT,
  document_id TEXT,
  citation_type TEXT NOT NULL,
  full_citation TEXT NOT NULL,
  short_citation TEXT,
  jurisdiction TEXT,
  statute_code TEXT,
  section TEXT,
  case_name TEXT,
  reporter TEXT,
  volume INTEGER,
  page INTEGER,
  year INTEGER,
  court TEXT,
  is_verified BOOLEAN DEFAULT false,
  verification_status TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  verification_notes TEXT,
  treatment_status TEXT,
  treatment_notes TEXT,
  westlaw_url TEXT,
  lexis_url TEXT,
  public_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citations_session ON public.citations(session_id, citation_type);
CREATE INDEX IF NOT EXISTS idx_citations_jurisdiction ON public.citations(jurisdiction, statute_code, section);
CREATE INDEX IF NOT EXISTS idx_citations_verified ON public.citations(is_verified, verification_status);

-- Table: export_jobs
CREATE TABLE IF NOT EXISTS public.export_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  format TEXT NOT NULL,
  template TEXT,
  include_line_numbers BOOLEAN DEFAULT false,
  include_timestamps BOOLEAN DEFAULT true,
  include_page_numbers BOOLEAN DEFAULT true,
  include_certification BOOLEAN DEFAULT false,
  include_index_page BOOLEAN DEFAULT false,
  include_table_of_contents BOOLEAN DEFAULT false,
  certified_by TEXT,
  certification_date TIMESTAMPTZ,
  certification_text TEXT,
  bar_number TEXT,
  status TEXT DEFAULT 'pending',
  file_url TEXT,
  file_size INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON public.export_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_session ON public.export_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON public.export_jobs(status);

-- Table: document_templates
CREATE TABLE IF NOT EXISTS public.document_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  court_type TEXT,
  document_type TEXT,
  jurisdiction TEXT,
  use_count INTEGER DEFAULT 0,
  last_used TIMESTAMPTZ,
  is_public BOOLEAN DEFAULT false,
  shared_with TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_user_type ON public.document_templates(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_templates_public ON public.document_templates(is_public, jurisdiction);

-- Table: generated_documents
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id TEXT NOT NULL,
  session_id TEXT,
  matter_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  format TEXT NOT NULL,
  field_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER DEFAULT 1,
  parent_id TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_docs_matter ON public.generated_documents(matter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_docs_template ON public.generated_documents(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_user ON public.generated_documents(user_id, status);

-- Table: billable_time
CREATE TABLE IF NOT EXISTS public.billable_time (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id TEXT NOT NULL,
  matter_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL,
  billable_seconds INTEGER NOT NULL,
  hourly_rate DECIMAL(10, 2) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  activity_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  invoice_id TEXT,
  invoice_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billable_time_matter ON public.billable_time(matter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billable_time_user ON public.billable_time(user_id, status);
CREATE INDEX IF NOT EXISTS idx_billable_time_invoice ON public.billable_time(invoice_id);

-- Table: feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percent INTEGER DEFAULT 0,
  enabled_for_users TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON public.feature_flags(is_enabled);

-- Table: system_logs
CREATE TABLE IF NOT EXISTS public.system_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  level TEXT NOT NULL,
  service TEXT NOT NULL,
  message TEXT NOT NULL,
  error TEXT,
  stack TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON public.system_logs(service, timestamp DESC);

-- ============================================================================
-- SUCCESS
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 011 completed: All missing tables created successfully';
END $$;
