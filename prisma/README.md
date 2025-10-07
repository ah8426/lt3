# Prisma Database Setup

## Overview

This directory contains the Prisma schema and seed data for Law Transcribed.

## Schema Structure

The database includes **24 models** organized into the following categories:

### Core Models
- **User** - User accounts and authentication
- **EncryptedApiKey** - Encrypted API keys for AI/ASR providers

### Subscription & Billing (3 models)
- **SubscriptionPlan** - Subscription tier definitions
- **Invoice** - Stripe invoice records
- **UsageMetrics** - Usage tracking per user/period

### Case Management (2 models)
- **Matter** - Legal cases/matters
- **Session** - Dictation/transcription sessions

### Transcription (4 models)
- **TranscriptSegment** - Individual transcript segments
- **TranscriptAccessLog** - Access audit trail
- **Speaker** - Speaker identification
- **ChatMessage** - AI chat messages

### Feature-Specific Models (7 models)
- **AuditLog** - Comprehensive audit logging
- **TranscriptVersion** - Version control for transcripts
- **TimestampProof** - Cryptographic timestamp verification
- **Redaction** - PII redaction tracking
- **Citation** - Legal citation verification
- **ConflictCheck** - Conflict of interest checking
- **Backup** - Backup job tracking

### Document Management (3 models)
- **ExportJob** - Document export jobs
- **DocumentTemplate** - Document templates
- **GeneratedDocument** - Generated documents

### Business (1 model)
- **BillableTime** - Time tracking for billing

### System (2 models)
- **FeatureFlag** - Feature flag management
- **SystemLog** - System-wide logging

## Database Commands

### Generate Prisma Client
```bash
pnpm db:generate
```

### Create Migration (when ready)
```bash
pnpm db:migrate
```

### Push Schema (development only)
```bash
pnpm db:push
```

### Seed Database
```bash
pnpm db:seed
```

### Open Prisma Studio
```bash
pnpm db:studio
```

## Seed Data

The seed file (`seed.ts`) includes:

1. **Subscription Plans** (4 tiers)
   - Free ($0/month)
   - Starter ($29/month)
   - Professional ($99/month)
   - Enterprise ($299/month)

2. **Feature Flags** (5 flags)
   - offline_mode
   - voice_commands
   - advanced_citation_checking
   - conflict_checking
   - realtime_collaboration

## Important Notes

- The schema uses **pgvector** extension for future AI features
- All models include proper indexes for performance
- Foreign keys use `onDelete: Cascade` where appropriate
- Timestamps use `@default(now())` and `@updatedAt`
- All IDs use `@default(cuid())` for better distribution

## Next Steps

1. Set up your PostgreSQL database (Supabase recommended)
2. Configure `DATABASE_URL` and `DIRECT_URL` in `.env.local`
3. Run `pnpm db:push` to create tables (development)
4. Run `pnpm db:seed` to populate initial data
5. For production, use `pnpm db:migrate` instead of `db:push`
