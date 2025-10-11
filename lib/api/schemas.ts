import { z } from 'zod';

// Common reusable schemas
export const IdSchema = z.string().cuid();
export const UuidSchema = z.string().uuid();
export const EmailSchema = z.string().email();
export const SlugSchema = z.string().regex(/^[a-z0-9-]+$/);

// Pagination schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.string().optional(),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z.string().optional(),
  orderDir: z.enum(['asc', 'desc']).default('desc'),
});

// Date range schemas
export const DateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).refine(
  (data) => !data.startDate || !data.endDate || data.startDate <= data.endDate,
  { message: "Start date must be before end date" }
);

// User management schemas
export const CreateUserSchema = z.object({
  email: EmailSchema,
  fullName: z.string().min(1).max(255).optional(),
  roles: z.array(z.string()).default(['user']),
  firmId: UuidSchema.optional(),
  subscriptionTier: z.enum(['free', 'starter', 'professional', 'enterprise']).default('free'),
});

export const UpdateUserSchema = z.object({
  email: EmailSchema.optional(),
  fullName: z.string().min(1).max(255).optional(),
  roles: z.array(z.string()).optional(),
  firmId: UuidSchema.optional(),
  subscriptionTier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  settings: z.record(z.any()).optional(),
});

export const UserQuerySchema = z.object({
  ...PaginationSchema.shape,
  search: z.string().optional(),
  role: z.string().optional(),
  subscriptionTier: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  firmId: UuidSchema.optional(),
});

// Matter schemas
export const CreateMatterSchema = z.object({
  name: z.string().min(1).max(255),
  clientName: z.string().min(1).max(255),
  adverseParty: z.string().max(255).optional(),
  jurisdiction: z.string().max(100).optional(),
  courtType: z.string().max(100).optional(),
  caseNumber: z.string().max(100).optional(),
  status: z.enum(['active', 'closed', 'archived']).default('active'),
});

export const UpdateMatterSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  clientName: z.string().min(1).max(255).optional(),
  adverseParty: z.string().max(255).optional(),
  jurisdiction: z.string().max(100).optional(),
  courtType: z.string().max(100).optional(),
  caseNumber: z.string().max(100).optional(),
  status: z.enum(['active', 'closed', 'archived']).optional(),
});

export const MatterQuerySchema = z.object({
  ...PaginationSchema.shape,
  search: z.string().optional(),
  status: z.enum(['active', 'closed', 'archived']).optional(),
  clientName: z.string().optional(),
  jurisdiction: z.string().optional(),
  ...DateRangeSchema.shape,
});

// Session schemas
export const CreateSessionSchema = z.object({
  id: IdSchema.optional(),
  matterId: IdSchema.optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['active', 'completed', 'archived']).default('active'),
  segments: z.array(z.object({
    text: z.string(),
    startMs: z.number().int().min(0),
    endMs: z.number().int().min(0),
    speakerId: z.string().optional(),
    speakerName: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    isFinal: z.boolean().default(false),
    provider: z.string().optional(),
  })).optional(),
});

export const UpdateSessionSchema = z.object({
  matterId: IdSchema.optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  durationMs: z.number().int().min(0).optional(),
  audioStoragePath: z.string().optional(),
  transcriptData: z.record(z.any()).optional(),
});

export const SessionQuerySchema = z.object({
  ...PaginationSchema.shape,
  search: z.string().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
  matterId: IdSchema.optional(),
  hasAudio: z.coerce.boolean().optional(),
  ...DateRangeSchema.shape,
});

// Transcript segment schemas
export const CreateSegmentSchema = z.object({
  text: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
  speakerId: z.string().optional(),
  speakerName: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  isFinal: z.boolean().default(false),
  provider: z.string().optional(),
}).refine(
  (data) => data.startMs < data.endMs,
  { message: "Start time must be before end time" }
);

export const UpdateSegmentSchema = z.object({
  text: z.string().min(1).optional(),
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().min(0).optional(),
  speakerId: z.string().optional(),
  speakerName: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  isFinal: z.boolean().optional(),
});

export const SegmentQuerySchema = z.object({
  ...PaginationSchema.shape,
  search: z.string().optional(),
  speakerId: z.string().optional(),
  isFinal: z.coerce.boolean().optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  startTime: z.coerce.number().int().min(0).optional(),
  endTime: z.coerce.number().int().min(0).optional(),
});

// AI Chat schemas
export const CreateChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(10000),
  provider: z.string().optional(),
  model: z.string().optional(),
  contextUsed: z.record(z.any()).optional(),
});

export const ChatQuerySchema = z.object({
  ...PaginationSchema.shape,
  role: z.enum(['user', 'assistant', 'system']).optional(),
  provider: z.string().optional(),
  ...DateRangeSchema.shape,
});

// Export schemas
export const CreateExportJobSchema = z.object({
  format: z.enum(['pdf', 'docx', 'txt', 'json']),
  template: z.string().optional(),
  includeLineNumbers: z.boolean().default(false),
  includeTimestamps: z.boolean().default(true),
  includePageNumbers: z.boolean().default(true),
  includeCertification: z.boolean().default(false),
  includeIndexPage: z.boolean().default(false),
  includeTableOfContents: z.boolean().default(false),
  certifiedBy: z.string().optional(),
  certificationText: z.string().optional(),
  barNumber: z.string().optional(),
});

export const ExportQuerySchema = z.object({
  ...PaginationSchema.shape,
  format: z.enum(['pdf', 'docx', 'txt', 'json']).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  ...DateRangeSchema.shape,
});

// Audit log schemas
export const AuditLogQuerySchema = z.object({
  ...PaginationSchema.shape,
  action: z.string().optional(),
  resource: z.string().optional(),
  userId: UuidSchema.optional(),
  sessionId: IdSchema.optional(),
  matterId: IdSchema.optional(),
  clientName: z.string().optional(),
  ...DateRangeSchema.shape,
});

// Conflict check schemas
export const CreateConflictCheckSchema = z.object({
  clientName: z.string().optional(),
  adverseParties: z.array(z.string()).default([]),
  companyNames: z.array(z.string()).default([]),
  matterDescription: z.string().optional(),
  excludeMatterId: IdSchema.optional(),
});

export const UpdateConflictCheckSchema = z.object({
  status: z.enum(['pending', 'waived', 'declined', 'screened', 'cleared']),
  resolutionNotes: z.string().optional(),
});

export const ConflictCheckQuerySchema = z.object({
  ...PaginationSchema.shape,
  status: z.enum(['pending', 'waived', 'declined', 'screened', 'cleared']).optional(),
  riskLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']).optional(),
  clientName: z.string().optional(),
  ...DateRangeSchema.shape,
});

// Billing and usage schemas
export const BillableTimeSchema = z.object({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  hourlyRate: z.number().min(0),
  activityType: z.string().min(1),
  description: z.string().optional(),
}).refine(
  (data) => data.startTime < data.endTime,
  { message: "Start time must be before end time" }
);

export const UsageQuerySchema = z.object({
  ...PaginationSchema.shape,
  metric: z.enum(['sessions', 'transcription', 'ai', 'storage']).optional(),
  ...DateRangeSchema.shape,
});

// API Key schemas
export const CreateApiKeySchema = z.object({
  provider: z.enum(['deepgram', 'assemblyai', 'anthropic', 'openai', 'google', 'openrouter']),
  key: z.string().min(1),
});

export const UpdateApiKeySchema = z.object({
  key: z.string().min(1),
  isActive: z.boolean().optional(),
});

// Citation schemas
export const CreateCitationSchema = z.object({
  citationType: z.enum(['case', 'statute', 'regulation', 'other']),
  fullCitation: z.string().min(1),
  shortCitation: z.string().optional(),
  jurisdiction: z.string().optional(),
  statuteCode: z.string().optional(),
  section: z.string().optional(),
  caseName: z.string().optional(),
  reporter: z.string().optional(),
  volume: z.number().int().optional(),
  page: z.number().int().optional(),
  year: z.number().int().optional(),
  court: z.string().optional(),
});

export const CitationQuerySchema = z.object({
  ...PaginationSchema.shape,
  citationType: z.enum(['case', 'statute', 'regulation', 'other']).optional(),
  jurisdiction: z.string().optional(),
  isVerified: z.coerce.boolean().optional(),
  ...DateRangeSchema.shape,
});

// Backup schemas
export const CreateBackupSchema = z.object({
  type: z.enum(['full', 'incremental', 'matter', 'session']),
  scope: z.enum(['user', 'matter', 'session']),
  scopeId: z.string().optional(),
  includesAudio: z.boolean().default(false),
  includesDocuments: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
});

export const BackupQuerySchema = z.object({
  ...PaginationSchema.shape,
  type: z.enum(['full', 'incremental', 'matter', 'session']).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  ...DateRangeSchema.shape,
});

// Response schemas
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  message: z.string().optional(),
  metadata: z.object({
    totalCount: z.number().optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
    hasNextPage: z.boolean().optional(),
    hasPreviousPage: z.boolean().optional(),
  }).optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
  correlationId: z.string().optional(),
});

// Validation helpers
export function validatePathParams<T>(params: T, schema: z.ZodSchema): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new Error(`Invalid path parameters: ${result.error.message}`);
  }
  return result.data;
}

export function validateQueryParams<T>(searchParams: URLSearchParams, schema: z.ZodSchema): T {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new Error(`Invalid query parameters: ${result.error.message}`);
  }
  return result.data;
}

export function validateRequestBody<T>(body: unknown, schema: z.ZodSchema): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`Invalid request body: ${result.error.message}`);
  }
  return result.data;
}